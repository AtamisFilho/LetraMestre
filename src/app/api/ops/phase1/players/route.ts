import { NextResponse } from 'next/server'
import { getPhase1PlayersReport } from '@/lib/ops/phase1'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const report = await getPhase1PlayersReport(100)
    return NextResponse.json(report)
  } catch (err) {
    console.error('[GET /api/ops/phase1/players] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
