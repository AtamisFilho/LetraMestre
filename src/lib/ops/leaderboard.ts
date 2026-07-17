/**
 * LetraMestre — Fase 2 (M2): consultas de ranking público com cache in-memory.
 *
 * Endpoints que usam este módulo:
 *   - GET /api/leaderboard
 *   - GET /api/ops/phase2/benchmark
 *
 * Cache: Map em escopo de módulo, TTL 5s, chave = `${metric}:${limit}:${offset}:${search||''}`.
 *   Consultas com `search` usam TTL mais curto (2s) para reduzir staleness sem perder o
 *   benefício de cache em buscas repetidas (ex: autocomplete).
 *
 * Nota de performance (Task 2.9):
 *   Para `metric=avgScore`, o SQLite não suporta divisão em ORDER BY do Prisma. Buscamos
 *   todos os PlayerAccount com gamesPlayed>=1 (sem paginação), computamos avgScore em JS
 *   e ordenamos em memória. Para volumes pequenos (<10k) isso é aceitável.
 *   Otimização futura (Task 2.10 / tech debt): adicionar campo denormalizado `avgScore`
 *   em PlayerAccount, atualizado via hook no simulate, permitindo `orderBy: { avgScore: 'desc' }`
 *   direto no Prisma com índice `@@index([avgScore])`. Manteria <200ms mesmo com 100k jogadores.
 *
 * IMPORTANTE: server-only. Nunca expõe passwordHash/email/googleId.
 */
import { db } from '@/lib/db'

// ---------------------------------------------------------------
// Tipos do contrato
// ---------------------------------------------------------------

export type LeaderboardMetric = 'wins' | 'avgScore'

export interface LeaderboardPlayer {
  rank: number
  playerId: string
  displayName: string
  username: string
  avatarUrl: string | null
  gamesPlayed: number
  gamesWon: number
  winRate: number
  totalScore: number
  avgScore: number
  bestScore: number
}

export interface LeaderboardSearchEntry {
  playerId: string
  displayName: string
  username: string
  avatarUrl: string | null
  gamesPlayed: number
  gamesWon: number
  winRate: number
  totalScore: number
  avgScore: number
  bestScore: number
}

export interface LeaderboardResult {
  metric: LeaderboardMetric
  total: number
  limit: number
  offset: number
  players: LeaderboardPlayer[]
  searchResults: LeaderboardSearchEntry[] | null
  search: string | null
  cachedAt: string
  durationMs: number
  cacheHit: boolean
}

export interface GetLeaderboardOptions {
  metric?: LeaderboardMetric
  limit?: number
  offset?: number
  search?: string
}

// ---------------------------------------------------------------
// Cache in-memory (módulo)
// ---------------------------------------------------------------

const CACHE_TTL_MS = 5_000
const SEARCH_CACHE_TTL_MS = 2_000

interface CacheEntry {
  at: number
  payload: LeaderboardResult
}

const cache = new Map<string, CacheEntry>()

function cacheKey(opts: Required<Omit<GetLeaderboardOptions, never>>): string {
  return `${opts.metric}:${opts.limit}:${opts.offset}:${opts.search}`
}

function readCache(key: string, ttl: number): LeaderboardResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > ttl) {
    cache.delete(key)
    return null
  }
  return entry.payload
}

function writeCache(key: string, payload: LeaderboardResult): void {
  cache.set(key, { at: Date.now(), payload })
  // Evicção simples: se cache crescer demais (>256 entradas), limpa as mais antigas.
  if (cache.size > 256) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
    for (let i = 0; i < 64 && i < oldest.length; i++) {
      cache.delete(oldest[i]![0])
    }
  }
}

/**
 * Limpa todo o cache (utilitário para testes/manual; não usado em rotas).
 */
export function clearLeaderboardCache(): void {
  cache.clear()
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function clampLimit(limit: unknown): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 100
  if (n < 1) return 1
  if (n > 100) return 100
  return n
}

function clampOffset(offset: unknown): number {
  const n = typeof offset === 'number' && Number.isFinite(offset) ? Math.floor(offset) : 0
  if (n < 0) return 0
  return n
}

function normalizeMetric(metric: unknown): LeaderboardMetric {
  return metric === 'avgScore' ? 'avgScore' : 'wins'
}

function normalizeSearch(search: unknown): string {
  if (typeof search !== 'string') return ''
  const trimmed = search.trim()
  // Limite de comprimento para evitar abusos.
  return trimmed.slice(0, 80)
}

function computeWinRate(gamesPlayed: number, gamesWon: number): number {
  return gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
}

function computeAvgScore(gamesPlayed: number, totalScore: number): number {
  return gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0
}

// ---------------------------------------------------------------
// Consulta principal
// ---------------------------------------------------------------

interface PlayerRow {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
  gamesPlayed: number
  gamesWon: number
  totalScore: number
  bestScore: number
}

/**
 * Executa a consulta de leaderboard (sem cache). Chamada por `getLeaderboard`.
 *
 * Para `metric=wins`: orderBy Prisma direto (usa índice `@@index([gamesWon])`).
 * Para `metric=avgScore`: fetch de todos os elegíveis, ordenação em JS por
 *   (totalScore/gamesPlayed) desc. Comentário de otimização futura no topo do arquivo.
 */
async function queryLeaderboard(opts: {
  metric: LeaderboardMetric
  limit: number
  offset: number
  search: string
}): Promise<Omit<LeaderboardResult, 'cachedAt' | 'durationMs' | 'cacheHit'>> {
  const { metric, limit, offset, search } = opts

  // Modo busca (search): retorna searchResults, players vazio
  if (search.length > 0) {
    // SQLite é case-insensitive por padrão em `contains` para strings ASCII.
    // Prisma com SQLite não suporta `mode: 'insensitive'` explicitamente; `contains` já atende.
    const where = {
      OR: [
        { username: { contains: search } },
        { displayName: { contains: search } },
      ],
    }
    const [rows, total] = await Promise.all([
      db.playerAccount.findMany({
        where,
        orderBy: [{ gamesWon: 'desc' }, { totalScore: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          gamesPlayed: true,
          gamesWon: true,
          totalScore: true,
          bestScore: true,
        },
      }),
      db.playerAccount.count({ where }),
    ])

    const searchResults: LeaderboardSearchEntry[] = rows.map((r: PlayerRow) => ({
      playerId: r.id,
      displayName: r.displayName,
      username: r.username,
      avatarUrl: r.avatarUrl,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      winRate: computeWinRate(r.gamesPlayed, r.gamesWon),
      totalScore: r.totalScore,
      avgScore: computeAvgScore(r.gamesPlayed, r.totalScore),
      bestScore: r.bestScore,
    }))

    return {
      metric,
      total,
      limit,
      offset,
      players: [],
      searchResults,
      search,
    }
  }

  // Modo ranking (sem search)
  if (metric === 'wins') {
    const [rows, total] = await Promise.all([
      db.playerAccount.findMany({
        orderBy: [{ gamesWon: 'desc' }, { totalScore: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          gamesPlayed: true,
          gamesWon: true,
          totalScore: true,
          bestScore: true,
        },
      }),
      db.playerAccount.count(),
    ])

    const players: LeaderboardPlayer[] = rows.map((r: PlayerRow, i: number) => ({
      rank: offset + i + 1,
      playerId: r.id,
      displayName: r.displayName,
      username: r.username,
      avatarUrl: r.avatarUrl,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      winRate: computeWinRate(r.gamesPlayed, r.gamesWon),
      totalScore: r.totalScore,
      avgScore: computeAvgScore(r.gamesPlayed, r.totalScore),
      bestScore: r.bestScore,
    }))

    return {
      metric,
      total,
      limit,
      offset,
      players,
      searchResults: null,
      search: null,
    }
  }

  // metric === 'avgScore'
  // Otimização futura: campo denormalizado `avgScore` em PlayerAccount (ver topo do arquivo).
  const allRows = await db.playerAccount.findMany({
    where: { gamesPlayed: { gte: 1 } },
    orderBy: [{ totalScore: 'desc' }],
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      gamesPlayed: true,
      gamesWon: true,
      totalScore: true,
      bestScore: true,
    },
  })

  const total = allRows.length
  const sorted = allRows
    .map((r: PlayerRow) => ({
      row: r,
      avg: computeAvgScore(r.gamesPlayed, r.totalScore),
    }))
    .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg
      // Tiebreak: mais vitórias, depois mais totalScore
      if (b.row.gamesWon !== a.row.gamesWon) return b.row.gamesWon - a.row.gamesWon
      return b.row.totalScore - a.row.totalScore
    })
    .slice(offset, offset + limit)

  const players: LeaderboardPlayer[] = sorted.map((entry, i) => {
    const r = entry.row
    return {
      rank: offset + i + 1,
      playerId: r.id,
      displayName: r.displayName,
      username: r.username,
      avatarUrl: r.avatarUrl,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      winRate: computeWinRate(r.gamesPlayed, r.gamesWon),
      totalScore: r.totalScore,
      avgScore: entry.avg,
      bestScore: r.bestScore,
    }
  })

  return {
    metric,
    total,
    limit,
    offset,
    players,
    searchResults: null,
    search: null,
  }
}

// ---------------------------------------------------------------
// API pública
// ---------------------------------------------------------------

export async function getLeaderboard(
  opts: GetLeaderboardOptions = {},
): Promise<LeaderboardResult> {
  const metric = normalizeMetric(opts.metric)
  const limit = clampLimit(opts.limit ?? 100)
  const offset = clampOffset(opts.offset ?? 0)
  const search = normalizeSearch(opts.search ?? '')
  const key = cacheKey({ metric, limit, offset, search })
  const ttl = search.length > 0 ? SEARCH_CACHE_TTL_MS : CACHE_TTL_MS

  const cached = readCache(key, ttl)
  if (cached) {
    return {
      ...cached,
      cacheHit: true,
      // Mantém durationMs e cachedAt do cache hit para auditoria.
    }
  }

  const start = Date.now()
  const partial = await queryLeaderboard({ metric, limit, offset, search })
  const durationMs = Date.now() - start
  const cachedAt = new Date().toISOString()

  const payload: LeaderboardResult = {
    ...partial,
    cachedAt,
    durationMs,
    cacheHit: false,
  }

  writeCache(key, payload)
  return payload
}
