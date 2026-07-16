import { NextResponse } from 'next/server'
import { getChangelog } from '@/lib/ops/release'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const payload = await getChangelog()
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
