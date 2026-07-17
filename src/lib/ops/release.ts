/**
 * release.ts — Processo de release: changelog, histórico, criação de tags.
 *
 * Contrato:
 * - GET  /api/ops/release/changelog → getChangelog()
 * - GET  /api/ops/release/history   → getReleaseHistory()
 * - POST /api/ops/release/tag       → createRelease({ version, type, notes })
 */

import { db } from '@/lib/db'
import fs from 'fs'

const CHANGELOG_PATH = '/home/z/my-project/CHANGELOG.md'

export type ReleaseType = 'major' | 'minor' | 'patch'

export interface ChangelogEntry {
  version: string
  date: string
  type: ReleaseType
  summary: string
  changes: string[]
}

export interface ChangelogPayload {
  currentVersion: string
  nextPlanned: string
  entries: ChangelogEntry[]
}

export interface ReleaseHistoryItem {
  id: string
  version: string
  tag: string
  date: string
  type: ReleaseType
  notes: string
  releasedBy: string
}

export interface ReleaseHistory {
  releases: ReleaseHistoryItem[]
}

export interface CreateReleaseInput {
  version: string
  type: ReleaseType
  notes?: string
}

export interface CreateReleaseResult {
  id: string
  tag: string
  version: string
  createdAt: string
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/

// Seed fallback (usado se CHANGELOG.md não existir ou estiver vazio).
// Sincronizado com o seed do banco (scripts/seed-ops.ts).
const SEED_ENTRIES: ChangelogEntry[] = [
  {
    version: '0.3.0',
    date: '2025-10-01',
    type: 'minor',
    summary: 'Console de operações + fundação Fase 0',
    changes: [
      'Dashboard de monitoramento',
      'Validação de secrets',
      'Backup SQLite automatizado',
      'Processo de release documentado',
    ],
  },
  {
    version: '0.2.0',
    date: '2025-09-15',
    type: 'minor',
    summary: 'Multiplayer WebSocket + painel admin',
    changes: [
      'Game-server Socket.io',
      'Auth admin bcrypt+JWT',
      'Dicionário PT-BR',
    ],
  },
  {
    version: '0.1.0',
    date: '2025-08-30',
    type: 'patch',
    summary: 'Bootstrap do projeto LetraMestre',
    changes: [
      'Estrutura web/ + app/ + mini-services/',
      'Modelo de jogo base (board, tiles, score)',
    ],
  },
]

function bumpPatch(version: string): string {
  const m = version.match(SEMVER_RE)
  if (!m) return version
  const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10))
  return `${major}.${minor}.${patch + 1}`
}

/**
 * Faz um parse de um CHANGELOG.md no estilo Keep-a-Changelog:
 *   ## [x.y.z] - YYYY-MM-DD
 *   ### Resumo
 *   <texto do resumo>
 *   ### Added | Changed | Fixed | Removed | Deprecated | Security
 *   - bullet
 *     continuação (linha indentada)
 *
 * Também aceita formato simples (bullets diretos após o header).
 * Seções `## [Unreleased]` são ignoradas (sem versão semver).
 *
 * O `type` de cada entrada é inferido comparando com a versão ANTERIOR
 * (mais velha), que em um changelog newest-first é a PRÓXIMA entrada
 * no array resultante.
 */
function parseChangelog(content: string): ChangelogEntry[] {
  const sections: Array<{
    version: string
    date: string
    summary: string
    changes: string[]
    currentSubheader: string | null
    pendingBullet: string[]
  }> = []
  const lines = content.split('\n')

  let current: (typeof sections)[number] | null = null

  const headerRe = /^##\s*\[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/
  const subHeaderRe = /^###\s+(.+)$/
  const bulletRe = /^[-*+]\s+(.*)$/
  const continuationRe = /^\s{2,}\S/

  function flushBullet(s: (typeof sections)[number]): void {
    if (s.pendingBullet.length > 0) {
      s.changes.push(s.pendingBullet.join(' ').trim())
      s.pendingBullet = []
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    // Header de versão.
    const hm = line.match(headerRe)
    if (hm) {
      if (current) {
        flushBullet(current)
        sections.push(current)
      }
      current = {
        version: hm[1],
        date: hm[2] ?? new Date().toISOString().slice(0, 10),
        summary: '',
        changes: [],
        currentSubheader: null,
        pendingBullet: [],
      }
      continue
    }

    // Linha separadora (`---`) ou comentário HTML → apenas finaliza bullet.
    if (/^---\s*$/.test(line) || /^<!--/.test(line)) {
      if (current) flushBullet(current)
      continue
    }

    if (!current) continue

    // Subheader `### Resumo` / `### Added` etc.
    const sm = line.match(subHeaderRe)
    if (sm) {
      flushBullet(current)
      current.currentSubheader = sm[1].trim().toLowerCase()
      continue
    }

    // Bullet.
    const bm = line.match(bulletRe)
    if (bm) {
      flushBullet(current)
      current.pendingBullet = [cleanBullet(bm[1])]
      continue
    }

    // Continuação indentada de bullet.
    if (current.pendingBullet.length > 0 && continuationRe.test(line)) {
      current.pendingBullet.push(cleanBullet(line.trim()))
      continue
    }

    // Linha de texto livre (resumo ou descrição).
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      flushBullet(current)
      continue
    }
    if (current.currentSubheader === 'resumo' && !current.summary) {
      current.summary = trimmed
    } else if (current.changes.length === 0 && !current.summary) {
      // Fallback: se não há bullets nem Resumo, usa a primeira linha.
      current.summary = trimmed
    }
  }

  if (current) {
    flushBullet(current)
    sections.push(current)
  }

  // Converte para ChangelogEntry, inferindo type a partir da versão
  // ANTERIOR (mais velha). Em changelog newest-first, a entrada mais velha
  // de cada versão é a PRÓXIMA no array.
  const entries: ChangelogEntry[] = sections.map((s, i) => {
    const older = sections[i + 1]?.version
    return {
      version: s.version,
      date: s.date,
      type: inferType(s.version, older),
      summary: s.summary,
      changes: s.changes,
    }
  })

  return entries
}

function inferType(version: string, olderVersion?: string): ReleaseType {
  if (!olderVersion) return 'patch'
  const [a1, b1, c1] = version.split('.').map((n) => parseInt(n, 10))
  const [a2, b2, c2] = olderVersion.split('.').map((n) => parseInt(n, 10))
  if (a1 !== a2) return 'major'
  if (b1 !== b2) return 'minor'
  if (c1 !== c2) return 'patch'
  return 'patch'
}

function cleanBullet(s: string): string {
  // Remove marcações `**negrito**` deixando o texto.
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[-*+]\s+/, '').trim()
}

export async function getChangelog(): Promise<ChangelogPayload> {
  let entries: ChangelogEntry[] = []

  // 1. Tenta ler CHANGELOG.md (criado pelo Agente C).
  try {
    if (fs.existsSync(CHANGELOG_PATH)) {
      const content = fs.readFileSync(CHANGELOG_PATH, 'utf-8')
      const parsed = parseChangelog(content)
      if (parsed.length > 0) entries = parsed
    }
  } catch {
    // ignore
  }

  // 2. Fallback: seed do banco (ReleaseRecord) + SEED_ENTRIES.
  if (entries.length === 0) {
    try {
      const rows = await db.releaseRecord.findMany({
        orderBy: { createdAt: 'desc' },
      })
      if (rows.length > 0) {
        entries = rows.map((r) => ({
          version: r.version,
          date: r.createdAt.toISOString().slice(0, 10),
          type: (r.type as ReleaseType) ?? 'patch',
          summary: r.notes?.split('\n')[0] ?? '',
          changes: r.notes
            ? r.notes.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^\s*-\s*/, '').trim())
            : [],
        }))
      } else {
        entries = SEED_ENTRIES
      }
    } catch {
      entries = SEED_ENTRIES
    }
  }

  // currentVersion = primeira entrada; nextPlanned = bump patch.
  const currentVersion = entries[0]?.version ?? '0.3.0'
  const nextPlanned = bumpPatch(currentVersion)

  return { currentVersion, nextPlanned, entries }
}

export async function getReleaseHistory(): Promise<ReleaseHistory> {
  const rows = await db.releaseRecord.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const releases: ReleaseHistoryItem[] = rows.map((r) => ({
    id: r.id,
    version: r.version,
    tag: r.tag,
    date: r.createdAt.toISOString(),
    type: r.type as ReleaseType,
    notes: r.notes,
    releasedBy: r.releasedBy,
  }))

  return { releases }
}

export async function createRelease(
  input: CreateReleaseInput,
): Promise<CreateReleaseResult> {
  const version = (input.version ?? '').trim()
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Version inválida (esperado semver x.y.z): ${version}`)
  }

  const type: ReleaseType = ['major', 'minor', 'patch'].includes(input.type)
    ? input.type
    : 'patch'

  const tag = `v${version}`
  const notes = input.notes ?? ''

  // Idempotência: se já existe, atualiza notes/type.
  const existing = await db.releaseRecord.findUnique({ where: { version } })
  let record
  if (existing) {
    record = await db.releaseRecord.update({
      where: { version },
      data: { type, notes, tag },
    })
  } else {
    record = await db.releaseRecord.create({
      data: { version, tag, type, notes },
    })
  }

  return {
    id: record.id,
    tag: record.tag,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  }
}
