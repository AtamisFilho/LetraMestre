import { NextResponse } from 'next/server'
import { buildPlayerClearCookieHeader } from '@/lib/auth-player'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', buildPlayerClearCookieHeader())
  return res
}
