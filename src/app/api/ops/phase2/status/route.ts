import { NextResponse } from 'next/server'
import { getPhase2Status } from '@/lib/ops/phase2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/ops/phase2/status — estado consolidado da Fase 2 (marco M2).
 */
export async function GET() {
  try {
    const status = await getPhase2Status()
    return NextResponse.json(status)
  } catch (err) {
    console.error('[GET /api/ops/phase2/status] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
