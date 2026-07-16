import { NextResponse } from 'next/server'
import { restoreBackup } from '@/lib/ops/backup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RestoreBody {
  id?: string
}

export async function POST(req: Request) {
  try {
    let body: RestoreBody = {}
    try {
      body = (await req.json()) as RestoreBody
    } catch {
      // body opcional/vazio
    }

    const id = (body?.id ?? '').trim()
    if (!id) {
      return NextResponse.json(
        { error: 'Campo "id" é obrigatório no body.' },
        { status: 400 },
      )
    }

    const payload = await restoreBackup(id)
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
