import { NextResponse } from 'next/server'
import { createRelease, type ReleaseType } from '@/lib/ops/release'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TagBody {
  version?: string
  type?: ReleaseType
  notes?: string
}

export async function POST(req: Request) {
  try {
    let body: TagBody = {}
    try {
      body = (await req.json()) as TagBody
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido. Esperado { version, type, notes? }.' },
        { status: 400 },
      )
    }

    const version = (body?.version ?? '').trim()
    if (!version) {
      return NextResponse.json(
        { error: 'Campo "version" é obrigatório.' },
        { status: 400 },
      )
    }
    const type = (body?.type ?? 'patch') as ReleaseType
    const notes = body?.notes ?? ''

    const payload = await createRelease({ version, type, notes })
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
