import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ACHIEVEMENT_DEFS, toAchievementView } from '@/lib/ops/achievements'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/achievements — lista todas as conquistas definidas (público).
 * Retorna { achievements: [...] }.
 */
export async function GET() {
  try {
    // Garante que o catálogo está populado (idempotente) para visitantes.
    let achievements = await db.achievement.findMany()
    if (achievements.length === 0) {
      // Auto-seed defensivo caso o script ainda não tenha rodado.
      const { seedAchievements } = await import('@/lib/ops/achievements')
      await seedAchievements()
      achievements = await db.achievement.findMany()
    }

    // Ordena pela ordem canônica das defs (mantém consistência com a UI).
    const byCode = new Map(achievements.map((a) => [a.code, a]))
    const ordered = ACHIEVEMENT_DEFS.map((def) => byCode.get(def.code)).filter(
      (a): a is NonNullable<typeof a> => !!a,
    )

    return NextResponse.json({
      achievements: ordered.map(toAchievementView),
    })
  } catch (err) {
    console.error('[GET /api/achievements] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
