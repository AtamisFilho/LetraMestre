import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPlayerSession } from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — lista partidas do jogador autenticado (até 50, mais recentes primeiro)
export async function GET() {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const games = await db.gameRecord.findMany({
      where: { playerId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const serialized = games.map((g) => ({
      id: g.id,
      playerId: g.playerId,
      result: g.result,
      score: g.score,
      opponent: g.opponent,
      language: g.language,
      createdAt: g.createdAt.toISOString(),
    }))
    return NextResponse.json({ games: serialized })
  } catch (err) {
    console.error('[GET /api/player/games] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
