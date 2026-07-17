/**
 * debt.ts — Tech debt items (open/closed).
 *
 * Contrato:
 * - GET  /api/ops/debt/items → getDebtItems()
 * - POST /api/ops/debt/close  → closeDebt({ id, resolution })
 */

import { db } from '@/lib/db'

export type DebtSeverity = 'low' | 'medium' | 'high'
export type DebtStatus = 'open' | 'closed'

export interface DebtItem {
  id: string
  title: string
  area: string
  severity: DebtSeverity
  status: DebtStatus
  file: string | null
  description: string
  resolution: string | null
  createdAt: string
  closedAt: string | null
}

export interface DebtListPayload {
  items: DebtItem[]
  openCount: number
  closedCount: number
}

export interface CloseDebtInput {
  id: string
  resolution?: string
}

export interface CloseDebtResult {
  id: string
  status: 'closed'
  closedAt: string
  resolution: string
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }
const STATUS_RANK: Record<string, number> = { open: 0, closed: 1 }

export async function getDebtItems(): Promise<DebtListPayload> {
  const rows = await db.techDebtItem.findMany()

  // Ordena: open primeiro; depois severity high→low.
  rows.sort((a, b) => {
    const s = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)
    if (s !== 0) return s
    return (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
  })

  const items: DebtItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    area: r.area,
    severity: r.severity as DebtSeverity,
    status: r.status as DebtStatus,
    file: r.file,
    description: r.description,
    resolution: r.resolution,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  }))

  const openCount = rows.filter((r) => r.status === 'open').length
  const closedCount = rows.filter((r) => r.status === 'closed').length

  return { items, openCount, closedCount }
}

export async function closeDebt(input: CloseDebtInput): Promise<CloseDebtResult> {
  const id = (input.id ?? '').trim()
  if (!id) throw new Error('id é obrigatório')

  const existing = await db.techDebtItem.findUnique({ where: { id } })
  if (!existing) throw new Error(`Débito técnico não encontrado: ${id}`)

  const closedAt = new Date()
  const resolution = (input.resolution ?? '').trim() || 'Resolvido.'

  const updated = await db.techDebtItem.update({
    where: { id },
    data: { status: 'closed', closedAt, resolution },
  })

  return {
    id: updated.id,
    status: 'closed',
    closedAt: updated.closedAt!.toISOString(),
    resolution: updated.resolution ?? resolution,
  }
}

// Helper exportado para outros módulos (ex.: phase0.ts).
export async function getOpenDebtCount(): Promise<number> {
  try {
    return await db.techDebtItem.count({ where: { status: 'open' } })
  } catch {
    return 0
  }
}
