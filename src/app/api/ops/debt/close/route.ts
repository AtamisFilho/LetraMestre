import { NextResponse } from 'next/server'
import { closeDebt } from '@/lib/ops/debt'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CloseBody {
  id?: string
  resolution?: string
}

export async function POST(req: Request) {
  try {
    let body: CloseBody = {}
    try {
      body = (await req.json()) as CloseBody
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido. Esperado { id, resolution? }.' },
        { status: 400 },
      )
    }

    const id = (body?.id ?? '').trim()
    if (!id) {
      return NextResponse.json(
        { error: 'Campo "id" é obrigatório.' },
        { status: 400 },
      )
    }

    const payload = await closeDebt({ id, resolution: body?.resolution })
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
