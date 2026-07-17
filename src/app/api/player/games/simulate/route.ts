import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPlayerSession, simulateGameSchema } from '@/lib/auth-player'
import {
  checkAndUnlockAchievements,
  unlockBingoAchievement,
} from '@/lib/ops/achievements'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FAKE_OPPONENTS = [
  'Bot LetraMestre',
  'Jogador Anônimo',
  'Mestre das Letras',
  'Desafiante Oculto',
  'CPU Nível Médio',
  'CPU Nível Difícil',
  'Adversário Casual',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomResult(): 'win' | 'loss' | 'draw' {
  const r = Math.floor(Math.random() * 3)
  if (r === 0) return 'win'
  if (r === 1) return 'loss'
  return 'draw'
}

// POST — simula uma partida vinculada ao jogador autenticado e atualiza stats
export async function POST(req: Request) {
  try {
    const session = await getPlayerSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const parsed = simulateGameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const result = parsed.data.result ?? randomResult()
    const score = parsed.data.score ?? Math.floor(Math.random() * 351) + 50 // 50-400
    const opponent = parsed.data.opponent ?? pick(FAKE_OPPONENTS)

    const game = await db.gameRecord.create({
      data: {
        playerId: session.id,
        result,
        score,
        opponent,
        language: 'pt-BR',
      },
    })

    // Atualiza agregados do PlayerAccount
    const player = await db.playerAccount.findUniqueOrThrow({
      where: { id: session.id },
      select: {
        gamesPlayed: true,
        gamesWon: true,
        totalScore: true,
        bestScore: true,
      },
    })
    const gamesPlayed = player.gamesPlayed + 1
    const gamesWon = player.gamesWon + (result === 'win' ? 1 : 0)
    const totalScore = player.totalScore + score
    const bestScore = Math.max(player.bestScore, score)
    await db.playerAccount.update({
      where: { id: session.id },
      data: { gamesPlayed, gamesWon, totalScore, bestScore },
    })

    // Verifica conquistas baseadas em contadores/streak (Fase 2 — Task 2.6)
    const newAchievementResults = await checkAndUnlockAchievements(session.id)

    // `bingo`: 10% de chance por vitória (não-determinístico, tratado aqui)
    if (result === 'win' && Math.random() < 0.1) {
      const bingo = await unlockBingoAchievement(session.id)
      if (bingo && bingo.isNew) {
        newAchievementResults.push({ code: 'bingo', achievement: bingo.achievement })
      }
    }

    const newAchievements = newAchievementResults.map(({ achievement }) => ({
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      tier: achievement.tier,
    }))

    return NextResponse.json(
      {
        game: {
          id: game.id,
          playerId: game.playerId,
          result: game.result,
          score: game.score,
          opponent: game.opponent,
          language: game.language,
          createdAt: game.createdAt.toISOString(),
        },
        newAchievements,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/player/games/simulate] error:', err)
    return NextResponse.json({ error: 'Erro interno ao simular partida' }, { status: 500 })
  }
}
