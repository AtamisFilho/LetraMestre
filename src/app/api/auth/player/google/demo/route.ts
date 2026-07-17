import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  googleDemoSchema,
  signPlayerToken,
  buildPlayerSetCookieHeader,
  buildAvatarUrl,
  toPublicPlayer,
} from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Simula o callback do Google OAuth: cria/reativa uma PlayerAccount com
 * googleId = `demo-${email}` (sem passwordHash). Seta cookie de sessão.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = googleDemoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const email = (parsed.data.email ?? 'demo.google@example.com').toLowerCase()
    const name = parsed.data.name ?? 'Jogador Google'
    const googleId = `demo-${email}`
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20) || 'jogador_google'

    // Upsert: se já existe (por email ou googleId), reativa; senão cria.
    let player = await db.playerAccount.findFirst({
      where: { OR: [{ email }, { googleId }] },
    })

    if (player) {
      player = await db.playerAccount.update({
        where: { id: player.id },
        data: {
          googleId,
          lastLoginAt: new Date(),
          displayName: player.displayName || name,
        },
      })
    } else {
      // Garante username único (sufixo se colidir)
      let finalUsername = username
      let suffix = 1
      while (await db.playerAccount.findUnique({ where: { username: finalUsername } })) {
        const s = String(suffix)
        finalUsername = `${username.slice(0, 20 - s.length)}${s}`
        suffix++
      }
      player = await db.playerAccount.create({
        data: {
          email,
          username: finalUsername,
          displayName: name,
          googleId,
          avatarUrl: buildAvatarUrl(name),
          lastLoginAt: new Date(),
        },
      })
    }

    const token = await signPlayerToken({
      id: player.id,
      email: player.email,
      username: player.username,
    })

    const res = NextResponse.json(
      { player: toPublicPlayer(player), session: true },
      { status: 200 },
    )
    res.headers.set('Set-Cookie', buildPlayerSetCookieHeader(token))
    return res
  } catch (err) {
    console.error('[POST /api/auth/player/google/demo] error:', err)
    return NextResponse.json(
      { error: 'Erro interno no login Google demo' },
      { status: 500 },
    )
  }
}
