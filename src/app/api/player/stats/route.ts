import { NextResponse } from 'next/server'
import { getPlayerSession } from '@/lib/auth-player'
import { getPlayerStats } from '@/lib/ops/player-stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/player/stats — estatísticas pessoais expandidas (requer auth).
 * Retorna summary, evolution (últimas 50), distribution, recentForm, achievements.
 */
export async function GET() {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const stats = await getPlayerStats(session.id)
    if (!stats) {
      return NextResponse.json({ error: 'Jogador não encontrado' }, { status: 404 })
    }
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[GET /api/player/stats] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
