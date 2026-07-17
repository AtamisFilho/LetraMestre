/**
 * LetraMestre — Fase 2 (M2): Estatísticas pessoais expandidas.
 *
 * Endpoint: GET /api/player/stats (auth).
 *
 * Contrato (ver worklog Task ID 10):
 *   - summary: agregados + winRate + avgScore + currentStreak + bestStreak
 *   - evolution: últimas 50 partidas (ASC) com cumulativeScore e cumulativeWins
 *   - distribution: { wins, losses, draws }
 *   - recentForm: últimas 5 results (mais recentes primeiro)
 *   - achievements: { unlocked, total, recent: últimos 5 PlayerAchievement }
 *
 * IMPORTANTE: server-only. Não expõe passwordHash/email/googleId.
 */
import { db } from '@/lib/db'
import {
  computeCurrentStreak,
  computeBestStreak,
  toPlayerAchievementView,
} from '@/lib/ops/achievements'

// ---------------------------------------------------------------
// Tipos do contrato
// ---------------------------------------------------------------

export interface PlayerStatsSummary {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  winRate: number
  totalScore: number
  avgScore: number
  bestScore: number
  currentStreak: number
  bestStreak: number
}

export interface PlayerStatsEvolutionEntry {
  gameId: string
  date: string
  result: string
  score: number
  cumulativeScore: number
  cumulativeWins: number
}

export interface PlayerStatsDistribution {
  wins: number
  losses: number
  draws: number
}

export interface PlayerStatsAchievements {
  unlocked: number
  total: number
  recent: Array<{
    id: string
    code: string
    name: string
    unlockedAt: string
  }>
}

export interface PlayerStats {
  summary: PlayerStatsSummary
  evolution: PlayerStatsEvolutionEntry[]
  distribution: PlayerStatsDistribution
  recentForm: string[]
  achievements: PlayerStatsAchievements
}

// ---------------------------------------------------------------
// Implementação
// ---------------------------------------------------------------

export async function getPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const player = await db.playerAccount.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      gamesPlayed: true,
      gamesWon: true,
      totalScore: true,
      bestScore: true,
    },
  })
  if (!player) return null

  // Busca histórico ASC (para evolução e streaks). Limitamos a 50 mais recentes para evolução,
  // mas buscamos todos para streak (currentStreak é do final; bestStreak é global).
  // Para volumes grandes, otimizaríamos com consulta agregada; aqui volumes são pequenos.
  const allGames = await db.gameRecord.findMany({
    where: { playerId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, result: true, score: true, createdAt: true },
  })

  const currentStreak = computeCurrentStreak(allGames)
  const bestStreak = computeBestStreak(allGames)

  // Distribuição
  let wins = 0
  let losses = 0
  let draws = 0
  for (const g of allGames) {
    if (g.result === 'win') wins++
    else if (g.result === 'loss') losses++
    else if (g.result === 'draw') draws++
  }

  // Evolução: últimas 50 ASC com cumulativos
  const last50 = allGames.slice(-50)
  let cumulativeScore = 0
  let cumulativeWins = 0
  // Para o cumulativeScore começar correto quando há >50 partidas, somamos as anteriores
  if (allGames.length > 50) {
    for (let i = 0; i < allGames.length - 50; i++) {
      cumulativeScore += allGames[i]!.score
      if (allGames[i]!.result === 'win') cumulativeWins++
    }
  }
  const evolution: PlayerStatsEvolutionEntry[] = last50.map((g) => {
    cumulativeScore += g.score
    if (g.result === 'win') cumulativeWins++
    return {
      gameId: g.id,
      date: g.createdAt.toISOString(),
      result: g.result,
      score: g.score,
      cumulativeScore,
      cumulativeWins,
    }
  })

  // recentForm: últimas 5 (mais recentes primeiro)
  const recentForm = allGames.slice(-5).reverse().map((g) => g.result)

  // Achievements
  const [totalAchievements, unlockedCount, playerAchievements] = await Promise.all([
    db.achievement.count(),
    db.playerAchievement.count({ where: { playerId } }),
    db.playerAchievement.findMany({
      where: { playerId },
      orderBy: { unlockedAt: 'desc' },
      take: 5,
      include: { achievement: true },
    }),
  ])

  const recentAch = playerAchievements.map(toPlayerAchievementView)

  // Summary
  const gamesPlayed = player.gamesPlayed
  const gamesWon = player.gamesWon
  const gamesLost = losses
  const gamesDraw = draws
  const totalScore = player.totalScore
  const bestScore = player.bestScore
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
  const avgScore = gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0

  return {
    summary: {
      gamesPlayed,
      gamesWon,
      gamesLost,
      gamesDraw,
      winRate,
      totalScore,
      avgScore,
      bestScore,
      currentStreak,
      bestStreak,
    },
    evolution,
    distribution: { wins, losses, draws },
    recentForm,
    achievements: {
      unlocked: unlockedCount,
      total: totalAchievements,
      recent: recentAch.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        unlockedAt: a.unlockedAt,
      })),
    },
  }
}
