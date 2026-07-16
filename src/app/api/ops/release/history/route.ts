import { NextResponse } from 'next/server'
import { getReleaseHistory } from '@/lib/ops/release'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const payload = await getReleaseHistory()
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
