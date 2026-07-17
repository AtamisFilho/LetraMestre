import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getPlayerSession,
  updateProfileSchema,
  toPublicPlayer,
} from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — retorna o jogador autenticado + stats agregadas
export async function GET() {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 },
      )
    }
    const player = await db.playerAccount.findUnique({
      where: { id: session.id },
    })
    if (!player) {
      return NextResponse.json(
        { error: 'Conta não encontrada' },
        { status: 401 },
      )
    }
    const base = toPublicPlayer(player)
    const winRate =
      base.gamesPlayed > 0
        ? Math.round((base.gamesWon / base.gamesPlayed) * 100)
        : 0
    return NextResponse.json({
      player: { ...base, winRate, googleLinked: !!player.googleId },
    })
  } catch (err) {
    console.error('[GET /api/auth/player/me] error:', err)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 },
    )
  }
}

// PATCH — atualiza displayName/bio/avatarUrl
export async function PATCH(req: Request) {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 },
      )
    }
    const body = await req.json().catch(() => null)
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }
    const data: {
      displayName?: string
      bio?: string
      avatarUrl?: string
    } = {}
    if (parsed.data.displayName !== undefined)
      data.displayName = parsed.data.displayName
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio
    if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl

    const updated = await db.playerAccount.update({
      where: { id: session.id },
      data,
    })
    const base = toPublicPlayer(updated)
    const winRate =
      base.gamesPlayed > 0
        ? Math.round((base.gamesWon / base.gamesPlayed) * 100)
        : 0
    return NextResponse.json({
      player: { ...base, winRate, googleLinked: !!updated.googleId },
    })
  } catch (err) {
    console.error('[PATCH /api/auth/player/me] error:', err)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 },
    )
  }
}


