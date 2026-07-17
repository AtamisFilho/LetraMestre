import { NextResponse } from 'next/server'
import { runPhase2Benchmark } from '@/lib/ops/phase2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/ops/phase2/benchmark — executa benchmark do leaderboard.
 * Valida o entregável M2 (consultas < 200ms).
 */
export async function GET() {
  try {
    const result = await runPhase2Benchmark()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/ops/phase2/benchmark] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
