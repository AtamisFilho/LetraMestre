import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  registerSchema,
  hashPassword,
  signPlayerToken,
  buildPlayerSetCookieHeader,
  buildAvatarUrl,
  toPublicPlayer,
} from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }
    const { email, username, password } = parsed.data
    const lowerEmail = email.toLowerCase()

    // Verifica conflitos
    const existing = await db.playerAccount.findFirst({
      where: {
        OR: [{ email: lowerEmail }, { username }],
      },
      select: { id: true, email: true, username: true },
    })
    if (existing) {
      const conflict = existing.email === lowerEmail ? 'email' : 'username'
      return NextResponse.json(
        { error: `${conflict} já está em uso` },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    const player = await db.playerAccount.create({
      data: {
        email: lowerEmail,
        username,
        displayName: username,
        passwordHash,
        avatarUrl: buildAvatarUrl(username),
      },
    })

    const token = await signPlayerToken({
      id: player.id,
      email: player.email,
      username: player.username,
    })

    const res = NextResponse.json(
      {
        player: toPublicPlayer(player),
        session: true,
      },
      { status: 201 },
    )
    res.headers.set('Set-Cookie', buildPlayerSetCookieHeader(token))
    return res
  } catch (err) {
    console.error('[POST /api/auth/player/register] error:', err)
    return NextResponse.json(
      { error: 'Erro interno ao registrar jogador' },
      { status: 500 },
    )
  }
}
