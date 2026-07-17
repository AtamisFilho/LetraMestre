import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPlayerSession } from '@/lib/auth-player'
import {
  ACHIEVEMENT_DEFS,
  computeCurrentStreak,
  computeAchievementProgress,
  toPlayerAchievementView,
  type PlayerAchievementPublicView,
  type LockedAchievementView,
} from '@/lib/ops/achievements'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/player/achievements — conquistas do jogador autenticado.
 * Retorna { unlocked: [...], locked: [...], stats: { unlocked, total, percent } }.
 */
export async function GET() {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const player = await db.playerAccount.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        gamesPlayed: true,
        gamesWon: true,
        bestScore: true,
        games: {
          orderBy: { createdAt: 'asc' },
          select: { result: true },
        },
        achievements: {
          include: { achievement: true },
          orderBy: { unlockedAt: 'desc' },
        },
      },
    })
    if (!player) {
      return NextResponse.json({ error: 'Jogador não encontrado' }, { status: 404 })
    }

    const allAchievements = await db.achievement.findMany()

    const unlockedMap = new Map(player.achievements.map((pa) => [pa.achievement.code, pa]))
    const currentStreak = computeCurrentStreak(player.games)
    const bingoUnlocked = unlockedMap.has('bingo')

    const unlocked: PlayerAchievementPublicView[] = []
    const locked: LockedAchievementView[] = []

    // Itera pelas defs (ordem canônica) para construir views consistentes
    for (const def of ACHIEVEMENT_DEFS) {
      const pa = unlockedMap.get(def.code)
      const ach = allAchievements.find((a) => a.code === def.code)
      if (!ach) continue // seed não rodou

      if (pa) {
        unlocked.push(toPlayerAchievementView(pa))
      } else {
        const progress = computeAchievementProgress(def.code, def.target, {
          gamesPlayed: player.gamesPlayed,
          gamesWon: player.gamesWon,
          bestScore: player.bestScore,
          currentStreak,
          bingoUnlocked,
        })
        locked.push({
          id: ach.id,
          code: def.code,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          tier: def.tier,
          target: def.target,
          progress,
        })
      }
    }

    const total = allAchievements.length
    const unlockedCount = unlocked.length
    const percent = total > 0 ? Math.round((unlockedCount / total) * 100) : 0

    return NextResponse.json({
      unlocked,
      locked,
      stats: { unlocked: unlockedCount, total, percent },
    })
  } catch (err) {
    console.error('[GET /api/player/achievements] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
