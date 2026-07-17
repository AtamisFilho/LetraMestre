import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  loginSchema,
  verifyPassword,
  signPlayerToken,
  buildPlayerSetCookieHeader,
  toPublicPlayer,
} from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 },
      )
    }
    const { email, password } = parsed.data
    const lowerEmail = email.toLowerCase()

    const player = await db.playerAccount.findUnique({
      where: { email: lowerEmail },
    })
    if (!player || !player.passwordHash) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 },
      )
    }
    const ok = await verifyPassword(password, player.passwordHash)
    if (!ok) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 },
      )
    }

    const updated = await db.playerAccount.update({
      where: { id: player.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await signPlayerToken({
      id: updated.id,
      email: updated.email,
      username: updated.username,
    })

    const res = NextResponse.json({ player: toPublicPlayer(updated) })
    res.headers.set('Set-Cookie', buildPlayerSetCookieHeader(token))
    return res
  } catch (err) {
    console.error('[POST /api/auth/player/login] error:', err)
    return NextResponse.json(
      { error: 'Erro interno ao autenticar' },
      { status: 500 },
    )
  }
}
