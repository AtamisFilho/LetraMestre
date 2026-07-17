/**
 * LetraMestre — Fase 2 (M2): Sistema de conquistas/badges.
 *
 * Modelos:
 *   - Achievement (definição estática, populada via seed)
 *   - PlayerAchievement (desbloqueio N:N, com @@unique([playerId, achievementId]))
 *
 * Desbloqueio:
 *   - `checkAndUnlockAchievements(playerId)` é chamado após cada simulate.
 *   - Para a conquista `bingo`, o desbloqueio é NÃO-determinístico: 10% de chance
 *     por vitória, aplicado diretamente no simulate. Esta função NÃO desbloqueia
 *     `bingo` automaticamente (apenas preserva o desbloqueio se já existir).
 *
 * Conquistas definidas (seed):
 *   1. first_game       — bronze — target 1 — Jogue sua primeira partida
 *   2. first_win        — bronze — target 1 — Vença sua primeira partida
 *   3. ten_games        — silver — target 10 — Jogue 10 partidas
 *   4. five_wins        — silver — target 5 — Vença 5 partidas
 *   5. high_score_200   — silver — target 1 — Faça 200+ pontos em uma partida
 *   6. high_score_300   — gold   — target 1 — Faça 300+ pontos em uma partida
 *   7. bingo            — gold   — target 1 — Use todas as 7 peças em uma jogada (10% chance/vitória)
 *   8. streak_3         — gold   — target 3 — Vença 3 partidas seguidas
 *
 * IMPORTANTE: server-only. Não expõe dados sensíveis.
 */
import { db } from '@/lib/db'
import type { Achievement } from '@prisma/client'

// ---------------------------------------------------------------
// Definições (fonte de verdade)
// ---------------------------------------------------------------

export type AchievementCategory = 'gameplay' | 'streak' | 'social' | 'special'
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface AchievementDef {
  code: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  tier: AchievementTier
  target: number
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    code: 'first_game',
    name: 'Primeira partida',
    description: 'Jogue sua primeira partida',
    icon: 'gamepad',
    category: 'gameplay',
    tier: 'bronze',
    target: 1,
  },
  {
    code: 'first_win',
    name: 'Primeira vitória!',
    description: 'Vença sua primeira partida',
    icon: 'trophy',
    category: 'gameplay',
    tier: 'bronze',
    target: 1,
  },
  {
    code: 'ten_games',
    name: 'Veterano',
    description: 'Jogue 10 partidas',
    icon: 'sword',
    category: 'gameplay',
    tier: 'silver',
    target: 10,
  },
  {
    code: 'five_wins',
    name: 'Estrategista',
    description: 'Vença 5 partidas',
    icon: 'crown',
    category: 'gameplay',
    tier: 'silver',
    target: 5,
  },
  {
    code: 'high_score_200',
    name: 'Marcador',
    description: 'Faça 200+ pontos em uma partida',
    icon: 'target',
    category: 'gameplay',
    tier: 'silver',
    target: 1,
  },
  {
    code: 'high_score_300',
    name: 'Mestre das palavras',
    description: 'Faça 300+ pontos em uma partida',
    icon: 'star',
    category: 'gameplay',
    tier: 'gold',
    target: 1,
  },
  {
    code: 'bingo',
    name: 'Bingo!',
    description: 'Use todas as 7 peças em uma jogada (10% de chance por vitória)',
    icon: 'sparkles',
    category: 'special',
    tier: 'gold',
    target: 1,
  },
  {
    code: 'streak_3',
    name: 'Imparável',
    description: 'Vença 3 partidas seguidas',
    icon: 'flame',
    category: 'streak',
    tier: 'gold',
    target: 3,
  },
]

// ---------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------

export interface UnlockedAchievementResult {
  code: string
  achievement: Achievement
}

export interface PlayerAchievementPublicView {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  tier: string
  target: number
  unlockedAt: string
}

export interface LockedAchievementView {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  tier: string
  target: number
  progress: {
    current: number
    target: number
    percent: number
  }
}

export interface AchievementPublicView {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  tier: string
  target: number
  createdAt: string
}

// ---------------------------------------------------------------
// Seed (chamado por scripts/seed-achievements.ts)
// ---------------------------------------------------------------

export async function seedAchievements(): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0
  for (const def of ACHIEVEMENT_DEFS) {
    const result = await db.achievement.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        tier: def.tier,
        target: def.target,
      },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        tier: def.tier,
        target: def.target,
      },
    })
    // O Prisma upsert não retorna info de create vs update; inferimos via count prévio
    // simplificado: se o resultado já existia (mesmo createdAt), foi update.
    // Para métricas precisas, fazemos um find prévio. Aqui mantemos simples.
    if (result) {
      // Heurística: reconta createdAt vs now()
      const ageMs = Date.now() - result.createdAt.getTime()
      if (ageMs < 5_000) created++
      else updated++
    }
  }
  return { created, updated }
}

// ---------------------------------------------------------------
// Helpers de progresso (compartilhados com /api/player/achievements)
// ---------------------------------------------------------------

/**
 * Calcula streak atual de vitórias consecutivas a partir do final do histórico.
 * Espera `games` em ordem ASC (mais antiga → mais recente).
 */
export function computeCurrentStreak(games: Array<{ result: string }>): number {
  let streak = 0
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i]!.result === 'win') streak++
    else break
  }
  return streak
}

/**
 * Calcula a maior sequência de vitórias em todo o histórico.
 * Espera `games` em ordem ASC.
 */
export function computeBestStreak(games: Array<{ result: string }>): number {
  let best = 0
  let current = 0
  for (const g of games) {
    if (g.result === 'win') {
      current++
      if (current > best) best = current
    } else {
      current = 0
    }
  }
  return best
}

/**
 * Computa o progresso (current, target, percent) de uma conquista para um jogador.
 * Para `bingo`, sempre retorna current=0/target=1 (não-determinístico).
 */
export function computeAchievementProgress(
  code: string,
  target: number,
  ctx: {
    gamesPlayed: number
    gamesWon: number
    bestScore: number
    currentStreak: number
    bingoUnlocked: boolean
  },
): { current: number; target: number; percent: number } {
  let current = 0
  switch (code) {
    case 'first_game':
      current = Math.min(ctx.gamesPlayed, target)
      break
    case 'first_win':
      current = Math.min(ctx.gamesWon, target)
      break
    case 'ten_games':
      current = Math.min(ctx.gamesPlayed, target)
      break
    case 'five_wins':
      current = Math.min(ctx.gamesWon, target)
      break
    case 'high_score_200':
      current = ctx.bestScore >= 200 ? 1 : 0
      break
    case 'high_score_300':
      current = ctx.bestScore >= 300 ? 1 : 0
      break
    case 'bingo':
      current = ctx.bingoUnlocked ? 1 : 0
      break
    case 'streak_3':
      current = Math.min(ctx.currentStreak, target)
      break
    default:
      current = 0
  }
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return { current, target, percent }
}

// ---------------------------------------------------------------
// Desbloqueio
// ---------------------------------------------------------------

/**
 * Verifica e desbloqueia conquistas para um jogador. Idempotente (não recria
 * PlayerAchievement existente; usa catch de unique constraint para race-safety).
 *
 * `bingo` NÃO é desbloqueado aqui (é não-determinístico, tratado no simulate).
 *
 * @returns Lista de { code, achievement } para conquistas recém-desbloqueadas.
 */
export async function checkAndUnlockAchievements(
  playerId: string,
): Promise<UnlockedAchievementResult[]> {
  // Busca o jogador e seu histórico (ordenado ASC por createdAt)
  const player = await db.playerAccount.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      gamesPlayed: true,
      gamesWon: true,
      bestScore: true,
      games: {
        orderBy: { createdAt: 'asc' },
        select: { result: true },
      },
    },
  })
  if (!player) return []

  const currentStreak = computeCurrentStreak(player.games)

  // Busca todos os Achievement definidos + os já desbloqueados pelo jogador
  const [allAchievements, existingUnlocks] = await Promise.all([
    db.achievement.findMany(),
    db.playerAchievement.findMany({
      where: { playerId },
      select: { achievementId: true },
    }),
  ])
  const unlockedIds = new Set(existingUnlocks.map((u) => u.achievementId))
  const unlockedByCode = new Map(allAchievements.map((a) => [a.code, a]))

  const newlyUnlocked: UnlockedAchievementResult[] = []

  for (const def of ACHIEVEMENT_DEFS) {
    // `bingo`: não desbloqueia automaticamente (apenas via simulate)
    if (def.code === 'bingo') continue

    const achievement = unlockedByCode.get(def.code)
    if (!achievement) continue // seed não rodou ainda; skip

    if (unlockedIds.has(achievement.id)) continue // já desbloqueado

    let conditionMet = false
    switch (def.code) {
      case 'first_game':
        conditionMet = player.gamesPlayed >= 1
        break
      case 'first_win':
        conditionMet = player.gamesWon >= 1
        break
      case 'ten_games':
        conditionMet = player.gamesPlayed >= 10
        break
      case 'five_wins':
        conditionMet = player.gamesWon >= 5
        break
      case 'high_score_200':
        conditionMet = player.bestScore >= 200
        break
      case 'high_score_300':
        conditionMet = player.bestScore >= 300
        break
      case 'streak_3':
        conditionMet = currentStreak >= 3
        break
      default:
        conditionMet = false
    }

    if (!conditionMet) continue

    try {
      const created = await db.playerAchievement.create({
        data: {
          playerId,
          achievementId: achievement.id,
        },
      })
      if (created) {
        newlyUnlocked.push({ code: def.code, achievement })
      }
    } catch (err) {
      // Race condition (unique constraint) — ignora silenciosamente.
      // Verifica se o desbloqueio já existe para não propagar erro.
      const exists = await db.playerAchievement.findUnique({
        where: {
          playerId_achievementId: {
            playerId,
            achievementId: achievement.id,
          },
        },
      })
      if (!exists) {
        // Erro real, propaga
        throw err
      }
    }
  }

  return newlyUnlocked
}

/**
 * Desbloqueia explicitamente a conquista `bingo` para um jogador (idempotente).
 * Retorna a Achievement se foi recém-desbloqueada, ou null se já existia.
 * Chamado pelo simulate (10% de chance por vitória).
 */
export async function unlockBingoAchievement(
  playerId: string,
): Promise<{ achievement: Achievement; isNew: boolean } | null> {
  const bingo = await db.achievement.findUnique({ where: { code: 'bingo' } })
  if (!bingo) return null // seed não rodou

  const existing = await db.playerAchievement.findUnique({
    where: {
      playerId_achievementId: {
        playerId,
        achievementId: bingo.id,
      },
    },
  })
  if (existing) return { achievement: bingo, isNew: false }

  try {
    await db.playerAchievement.create({
      data: { playerId, achievementId: bingo.id },
    })
    return { achievement: bingo, isNew: true }
  } catch {
    // Race: outro path criou no meio — trata como já desbloqueado.
    return { achievement: bingo, isNew: false }
  }
}

/**
 * Helper para serializar uma Achievement como PlayerAchievementPublicView (com unlockedAt).
 */
export function toPlayerAchievementView(
  pa: { id: string; unlockedAt: Date; achievement: Achievement },
): PlayerAchievementPublicView {
  return {
    id: pa.id,
    code: pa.achievement.code,
    name: pa.achievement.name,
    description: pa.achievement.description,
    icon: pa.achievement.icon,
    category: pa.achievement.category,
    tier: pa.achievement.tier,
    target: pa.achievement.target,
    unlockedAt: pa.unlockedAt.toISOString(),
  }
}

/**
 * Helper para serializar uma Achievement como AchievementPublicView.
 */
export function toAchievementView(a: Achievement): AchievementPublicView {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    description: a.description,
    icon: a.icon,
    category: a.category,
    tier: a.tier,
    target: a.target,
    createdAt: a.createdAt.toISOString(),
  }
}
