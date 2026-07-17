/**
 * seed-ops.ts — Popula dados iniciais para o Console de Operações:
 *   - TechDebtItem (5-7 itens realistas baseados no LetraMestre)
 *   - ReleaseRecord (0.1.0, 0.2.0, 0.3.0)
 *
 * Idempotente: usa upsert por chave única (version) ou por (title).
 *
 * Uso:
 *   bun run scripts/seed-ops.ts
 *   (ou: bun scripts/seed-ops.ts)
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

interface DebtSeed {
  title: string
  area: string
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'closed'
  file: string | null
  description: string
  resolution: string | null
  daysAgo: number
  closedDaysAgo?: number
}

interface ReleaseSeed {
  version: string
  tag: string
  type: 'major' | 'minor' | 'patch'
  notes: string
  daysAgo: number
}

const DEBT_ITEMS: DebtSeed[] = [
  {
    title: 'Move model índice quebrado (@@index(oveType]))',
    area: 'database',
    severity: 'high',
    status: 'closed',
    file: 'prisma/schema.prisma',
    description:
      'Sintaxe de índice corrompida no schema do LetraMestre (@@index(oveType])) impedia `prisma db push`.',
    resolution: 'Índice corrigido para @@index([moveType]). Schema validado.',
    daysAgo: 26,
    closedDaysAgo: 12,
  },
  {
    title: 'Sem índice em Player.name (busca lenta)',
    area: 'database',
    severity: 'medium',
    status: 'open',
    file: 'prisma/schema.prisma',
    description:
      'Consultas por nome de jogador (autocomplete, scoreboard) fazem scan completo. Adicionar @@index([name]).',
    resolution: null,
    daysAgo: 22,
  },
  {
    title: 'Testes e2e não rodam em CI',
    area: 'test',
    severity: 'high',
    status: 'open',
    file: 'web/e2e/golden-path.spec.ts',
    description:
      'Playwright está configurado, mas o workflow do GitHub Actions não instala browsers nem sobe o game-server. Cobertura e2e atual = 0 no CI.',
    resolution: null,
    daysAgo: 20,
  },
  {
    title: 'Dicionário hardcoded no app Android',
    area: 'frontend',
    severity: 'medium',
    status: 'closed',
    file: 'app/src/main/res/raw/dictionary_pt_br.json',
    description:
      'Dicionário PT-BR embutido como recurso raw no APK. Não pode ser atualizado sem novo release.',
    resolution:
      'Migrado para download sob demanda via /api/words; fallback local mantido para offline.',
    daysAgo: 18,
    closedDaysAgo: 6,
  },
  {
    title: 'Sem rate-limit no /api/words',
    area: 'security',
    severity: 'high',
    status: 'open',
    file: 'web/src/app/api/words/route.ts',
    description:
      'Endpoint público de validação de palavras não tem rate-limit. Permite abuso (força bruta de palavras, enumeração).',
    resolution: null,
    daysAgo: 15,
  },
  {
    title: 'PWA service worker sem cache de rota',
    area: 'frontend',
    severity: 'low',
    status: 'open',
    file: 'web/public/sw.js',
    description:
      'Service worker atual só faz cache de assets estáticos. Rotas do app quebram offline. Implementar cache stale-while-revalidate para /api/words.',
    resolution: null,
    daysAgo: 10,
  },
  {
    title: 'Logs de query Prisma em produção',
    area: 'backend',
    severity: 'medium',
    status: 'closed',
    file: 'web/src/lib/db.ts',
    description:
      "PrismaClient instanciado com `log: ['query']` vaza SQL em stdout em produção. Ruído + risco de leak de dados em logs.",
    resolution:
      "Conditionalizado para apenas `['error']` em produção; `['query','error','warn']` só em dev.",
    daysAgo: 8,
    closedDaysAgo: 3,
  },
  {
    title: 'Game-server sem healthcheck no Docker Compose',
    area: 'infra',
    severity: 'low',
    status: 'open',
    file: 'docker-compose.yml',
    description:
      'Serviço game-server não tem healthcheck configurado. Restart policy não detecta travamento.',
    resolution: null,
    daysAgo: 4,
  },
]

const RELEASES: ReleaseSeed[] = [
  {
    version: '0.1.0',
    tag: 'v0.1.0',
    type: 'patch',
    notes:
      'Bootstrap do projeto LetraMestre.\n- Estrutura web/ + app/ + mini-services/\n- Modelo de jogo base (board, tiles, score)\n- Dicionário PT-BR inicial',
    daysAgo: 50,
  },
  {
    version: '0.2.0',
    tag: 'v0.2.0',
    type: 'minor',
    notes:
      'Multiplayer WebSocket + painel admin.\n- Game-server Socket.io\n- Auth admin bcrypt+JWT (jose)\n- Dicionário PT-BR dinâmico\n- PWA básico',
    daysAgo: 33,
  },
  {
    version: '0.3.0',
    tag: 'v0.3.0',
    type: 'minor',
    notes:
      'Console de operações + fundação Fase 0.\n- Dashboard de monitoramento (/api/ops/metrics)\n- Validação de secrets (/api/ops/secrets/status)\n- Backup SQLite automatizado (/api/ops/backup/*)\n- Processo de release documentado (/api/ops/release/*)\n- Revisão de débitos técnicos (/api/ops/debt/*)\n- Validação de build Android (/api/ops/build/android/*)',
    daysAgo: 16,
  },
]

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function seedDebt(): Promise<void> {
  for (const item of DEBT_ITEMS) {
    // Idempotência por title (não há unique constraint, mas é chave natural).
    const existing = await db.techDebtItem.findFirst({
      where: { title: item.title },
    })
    const createdAt = daysAgoDate(item.daysAgo)
    const closedAt =
      item.status === 'closed' && item.closedDaysAgo != null
        ? daysAgoDate(item.closedDaysAgo)
        : null

    if (existing) {
      await db.techDebtItem.update({
        where: { id: existing.id },
        data: {
          area: item.area,
          severity: item.severity,
          status: item.status,
          file: item.file,
          description: item.description,
          resolution: item.resolution,
          createdAt,
          closedAt,
        },
      })
    } else {
      await db.techDebtItem.create({
        data: {
          title: item.title,
          area: item.area,
          severity: item.severity,
          status: item.status,
          file: item.file,
          description: item.description,
          resolution: item.resolution,
          createdAt,
          closedAt,
        },
      })
    }
  }
}

async function seedReleases(): Promise<void> {
  for (const r of RELEASES) {
    await db.releaseRecord.upsert({
      where: { version: r.version },
      update: {
        tag: r.tag,
        type: r.type,
        notes: r.notes,
        createdAt: daysAgoDate(r.daysAgo),
      },
      create: {
        version: r.version,
        tag: r.tag,
        type: r.type,
        notes: r.notes,
        createdAt: daysAgoDate(r.daysAgo),
      },
    })
  }
}

async function main(): Promise<void> {
  console.log('[seed-ops] Iniciando seed...')
  await seedDebt()
  await seedReleases()

  const debtCount = await db.techDebtItem.count()
  const releaseCount = await db.releaseRecord.count()
  console.log(
    `[seed-ops] Pronto. TechDebtItem=${debtCount}, ReleaseRecord=${releaseCount}`,
  )
}

main()
  .catch((err) => {
    console.error('[seed-ops] Erro:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
