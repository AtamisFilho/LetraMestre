/**
 * Seed das conquistas do LetraMestre (Fase 2 — Task 2.6).
 *
 * Uso: bun run scripts/seed-achievements.ts
 *
 * Idempotente: usa upsert por `code`. Pode ser re-executado com segurança.
 */
import { seedAchievements, ACHIEVEMENT_DEFS } from '@/lib/ops/achievements'

async function main() {
  console.log('─ seed-achievements ─────────────────────────────────')
  console.log(`Definições conhecidas: ${ACHIEVEMENT_DEFS.length}`)
  const result = await seedAchievements()
  console.log(
    `Conquistas: ${result.created} criadas, ${result.updated} atualizadas (total ${result.created + result.updated}).`,
  )
  console.log('─────────────────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro no seed de conquistas:', err)
    process.exit(1)
  })
