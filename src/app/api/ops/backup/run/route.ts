import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/ops/backup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  try {
    const payload = await runBackup()
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
