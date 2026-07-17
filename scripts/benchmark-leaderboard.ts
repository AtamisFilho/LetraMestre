/**
 * Benchmark de performance do leaderboard (Fase 2 — Task 2.9).
 *
 * Valida o entregável M2: consultas de ranking respondem em < 200ms
 * mesmo com grande volume de jogadores.
 *
 * Uso:
 *   bun run scripts/benchmark-leaderboard.ts           # mede apenas
 *   bun run scripts/benchmark-leaderboard.ts --seed 1000  # cria 1000 jogadores sintéticos antes
 *
 * Notas:
 * - Com volumes pequenos a latência será < 50ms.
 * - Os índices @@index([gamesWon/totalScore/bestScore]) garantem que, com 10k
 *   jogadores, o orderBy indexado permaneça O(log n + limit) ≈ < 200ms.
 * - Para um teste real com 10k, use `--seed 10000` (pode levar alguns minutos).
 */
import { db } from '@/lib/db'
import { getLeaderboard, clearLeaderboardCache } from '@/lib/ops/leaderboard'

function parseArgs(): { seed: number | null } {
  const args = process.argv.slice(2)
  let seed: number | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      seed = Number.parseInt(args[i + 1]!, 10)
      if (Number.isNaN(seed) || seed < 0) {
        console.error('--seed requer um número inteiro >= 0')
        process.exit(1)
      }
    }
  }
  return { seed }
}

async function seedSyntheticPlayers(n: number): Promise<number> {
  console.log(`Gerando ${n} jogadores sintéticos...`)
  const existing = await db.playerAccount.count()
  const toCreate = Math.max(0, n - existing)
  if (toCreate === 0) {
    console.log(`Já existem ${existing} jogadores (>= ${n}). Pulando seed.`)
    return existing
  }
  const batchSize = 500
  let created = 0
  for (let batch = 0; batch < Math.ceil(toCreate / batchSize); batch++) {
    const start = batch * batchSize
    const count = Math.min(batchSize, toCreate - start)
    const data = Array.from({ length: count }, (_, i) => {
      const idx = existing + start + i + 1
      const gamesPlayed = Math.floor(Math.random() * 100) + 1
      const gamesWon = Math.floor(Math.random() * (gamesPlayed + 1))
      const totalScore = Math.floor(Math.random() * 5000) + gamesPlayed * 50
      return {
        email: `bench_${idx}@letramestre.bench`,
        username: `bench_${idx}`,
        displayName: `Bench ${idx}`,
        passwordHash: null,
        gamesPlayed,
        gamesWon,
        totalScore,
        bestScore: Math.floor(Math.random() * 400) + 50,
      }
    })
    await db.playerAccount.createMany({ data, skipDuplicates: true })
    created += count
    process.stdout.write(`  ${created}/${toCreate}\r`)
  }
  console.log(`  ${created}/${toCreate} criados.`)
  return existing + created
}

async function benchMetric(
  metric: 'wins' | 'avgScore',
  runs = 10,
): Promise<{ min: number; avg: number; max: number; p95: number }> {
  const latencies: number[] = []
  for (let i = 0; i < runs; i++) {
    clearLeaderboardCache() // força cold query a cada run
    const t0 = Date.now()
    await getLeaderboard({ metric, limit: 100, offset: 0 })
    latencies.push(Date.now() - t0)
  }
  latencies.sort((a, b) => a - b)
  const min = latencies[0]!
  const max = latencies[latencies.length - 1]!
  const avg = Math.round(latencies.reduce((s, x) => s + x, 0) / latencies.length)
  const p95Idx = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))
  const p95 = latencies[p95Idx]!
  return { min, avg, max, p95 }
}

async function main() {
  const { seed } = parseArgs()
  console.log('─ benchmark-leaderboard ─────────────────────────────')

  if (seed !== null) {
    await seedSyntheticPlayers(seed)
  }

  const playerCount = await db.playerAccount.count()
  console.log(`Jogadores no banco: ${playerCount}`)
  console.log('')

  console.log('metric=wins (10 runs, cache cleared):')
  const wins = await benchMetric('wins')
  console.log(
    `  min=${wins.min}ms avg=${wins.avg}ms max=${wins.max}ms p95=${wins.p95}ms → ${wins.p95 < 200 ? 'OK (<200ms)' : 'ACIMA do limite'}`,
  )

  console.log('metric=avgScore (10 runs, cache cleared):')
  const avgScore = await benchMetric('avgScore')
  console.log(
    `  min=${avgScore.min}ms avg=${avgScore.avg}ms max=${avgScore.max}ms p95=${avgScore.p95}ms → ${avgScore.p95 < 200 ? 'OK (<200ms)' : 'ACIMA do limite'}`,
  )

  // Testa com cache quente
  console.log('')
  console.log('Cache quente (após 1ª chamada aquecer o cache):')
  await getLeaderboard({ metric: 'wins', limit: 100, offset: 0 }) // aquece
  const t0 = Date.now()
  await getLeaderboard({ metric: 'wins', limit: 100, offset: 0 }) // cache hit
  const cachedMs = Date.now() - t0
  console.log(`  leaderboard (cache hit): ${cachedMs}ms`)

  const overall = wins.p95 < 200 && avgScore.p95 < 200
  console.log('')
  console.log(
    overall
      ? '✅ Todas as consultas < 200ms — entregável M2 atendido.'
      : '❌ Alguma consulta > 200ms — revisar índices/cache.',
  )
  console.log('─────────────────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro no benchmark:', err)
    process.exit(1)
  })
