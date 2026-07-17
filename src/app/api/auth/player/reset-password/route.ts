import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resetPasswordSchema, hashPassword } from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }
    const { token, password } = parsed.data

    const record = await db.passwordResetToken.findUnique({
      where: { token },
    })
    if (!record) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 400 },
      )
    }
    if (record.usedAt) {
      return NextResponse.json(
        { error: 'Token já foi utilizado' },
        { status: 400 },
      )
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Token expirado' },
        { status: 400 },
      )
    }

    const passwordHash = await hashPassword(password)
    await db.$transaction([
      db.playerAccount.update({
        where: { id: record.playerId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/auth/player/reset-password] error:', err)
    return NextResponse.json(
      { error: 'Erro interno ao redefinir senha' },
      { status: 500 },
    )
  }
}
