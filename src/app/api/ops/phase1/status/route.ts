import { NextResponse } from 'next/server'
import { getPhase1Status } from '@/lib/ops/phase1'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const status = await getPhase1Status()
    return NextResponse.json(status)
  } catch (err) {
    console.error('[GET /api/ops/phase1/status] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
