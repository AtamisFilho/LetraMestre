import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forgotPasswordSchema } from '@/lib/auth-player'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hora

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      // Não vaza existência — retorna ok genérico
      return NextResponse.json({ ok: true })
    }
    const lowerEmail = parsed.data.email.toLowerCase()
    const player = await db.playerAccount.findUnique({
      where: { email: lowerEmail },
      select: { id: true, email: true },
    })

    if (!player) {
      // Não vaza existência — retorna ok genérico sem token
      return NextResponse.json({ ok: true })
    }

    // Modo demo: sem servidor de e-mail — retornamos o token diretamente.
    // Em produção, este token seria enviado por e-mail e NUNCA retornado no JSON.
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TTL_MS)
    await db.passwordResetToken.create({
      data: {
        playerId: player.id,
        token,
        expiresAt,
      },
    })

    return NextResponse.json({
      ok: true,
      demoResetToken: token,
      demoResetUrl: `/?reset-token=${token}`,
      demoNote:
        'Ambiente sem SMTP: o token é retornado aqui para demonstração. Em produção seria enviado por e-mail.',
    })
  } catch (err) {
    console.error('[POST /api/auth/player/forgot-password] error:', err)
    return NextResponse.json({ ok: true })
  }
}
