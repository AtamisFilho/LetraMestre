import { NextResponse } from 'next/server'
import { getLeaderboard, type LeaderboardMetric } from '@/lib/ops/leaderboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/leaderboard?metric=wins|avgScore&limit=100&offset=0&search=
 * Público (sem auth). Cache in-memory TTL 5s (search 2s).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const params = url.searchParams
    const metric = (params.get('metric') as LeaderboardMetric | null) ?? 'wins'
    const limitParam = params.get('limit')
    const offsetParam = params.get('offset')
    const search = params.get('search') ?? undefined

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0

    const result = await getLeaderboard({
      metric,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
      search,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/leaderboard] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
