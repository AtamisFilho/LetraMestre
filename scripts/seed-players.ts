/**
 * LetraMestre — Fase 1: Seed de jogadores demo.
 *
 * Popula PlayerAccount + GameRecord para o ambiente de desenvolvimento.
 * Idempotente (upsert por email/username). NÃO cria reset tokens.
 *
 * Credenciais de teste (senha):
 *   - jogador@letramestre.com / senha12345
 *
 * Uso: `bun run scripts/seed-players.ts`
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12
const NOW = Date.now()
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function iso(offsetMs: number): Date {
  return new Date(NOW - offsetMs)
}

async function upsertPlayer(params: {
  email: string
  username: string
  displayName: string
  password?: string
  googleId?: string
  bio?: string
  gamesPlayed: number
  gamesWon: number
  totalScore: number
  bestScore: number
  lastLoginAgoMs: number
  createdAtAgoMs: number
  games?: Array<{ result: 'win' | 'loss' | 'draw'; score: number; opponent: string; agoMs: number }>
}) {
  const existing = await db.playerAccount.findUnique({ where: { email: params.email } })
  const passwordHash = params.password ? await bcrypt.hash(params.password, BCRYPT_COST) : null

  if (existing) {
    const updated = await db.playerAccount.update({
      where: { id: existing.id },
      data: {
        username: params.username,
        displayName: params.displayName,
        passwordHash,
        googleId: params.googleId,
        bio: params.bio ?? '',
        gamesPlayed: params.gamesPlayed,
        gamesWon: params.gamesWon,
        totalScore: params.totalScore,
        bestScore: params.bestScore,
        lastLoginAt: iso(params.lastLoginAgoMs),
      },
    })
    // Recria GameRecords (apaga anteriores deste jogador para evitar duplicação)
    if (params.games && params.games.length > 0) {
      await db.gameRecord.deleteMany({ where: { playerId: updated.id } })
      await db.gameRecord.createMany({
        data: params.games.map((g) => ({
          playerId: updated.id,
          result: g.result,
          score: g.score,
          opponent: g.opponent,
          language: 'pt-BR',
          createdAt: iso(g.agoMs),
        })),
      })
    }
    return { email: params.email, id: updated.id }
  }

  const created = await db.playerAccount.create({
    data: {
      email: params.email,
      username: params.username,
      displayName: params.displayName,
      passwordHash,
      googleId: params.googleId,
      bio: params.bio ?? '',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(params.displayName)}`,
      gamesPlayed: params.gamesPlayed,
      gamesWon: params.gamesWon,
      totalScore: params.totalScore,
      bestScore: params.bestScore,
      lastLoginAt: iso(params.lastLoginAgoMs),
      createdAt: iso(params.createdAtAgoMs),
    },
  })
  if (params.games && params.games.length > 0) {
    await db.gameRecord.createMany({
      data: params.games.map((g) => ({
        playerId: created.id,
        result: g.result,
        score: g.score,
        opponent: g.opponent,
        language: 'pt-BR',
        createdAt: iso(g.agoMs),
      })),
    })
  }
  return { email: params.email, id: created.id }
}

async function main() {
  console.log('[seed-players] Iniciando seed de jogadores demo...')

  // 1) Jogador com senha (credenciais: jogador@letramestre.com / senha12345)
  await upsertPlayer({
    email: 'jogador@letramestre.com',
    username: 'jogador',
    displayName: 'Jogador Principal',
    password: 'senha12345',
    bio: 'Conta de teste do LetraMestre (e-mail+senha).',
    gamesPlayed: 6,
    gamesWon: 3,
    totalScore: 950,
    bestScore: 280,
    lastLoginAgoMs: 2 * HOUR,
    createdAtAgoMs: 30 * DAY,
    games: [
      { result: 'win', score: 280, opponent: 'Bot LetraMestre', agoMs: 5 * DAY },
      { result: 'win', score: 210, opponent: 'Jogador Anônimo', agoMs: 4 * DAY },
      { result: 'loss', score: 90, opponent: 'CPU Nível Difícil', agoMs: 3 * DAY },
      { result: 'draw', score: 150, opponent: 'Adversário Casual', agoMs: 2 * DAY },
      { result: 'win', score: 180, opponent: 'Bot LetraMestre', agoMs: 1 * DAY },
      { result: 'loss', score: 40, opponent: 'Mestre das Letras', agoMs: 6 * HOUR },
    ],
  })

  // 2) Jogador Google demo (sem senha)
  await upsertPlayer({
    email: 'demo.google@example.com',
    username: 'demo_google',
    displayName: 'Jogador Google',
    googleId: 'demo-demo.google@example.com',
    bio: 'Conta criada via Google OAuth (demo).',
    gamesPlayed: 3,
    gamesWon: 1,
    totalScore: 420,
    bestScore: 200,
    lastLoginAgoMs: 1 * DAY,
    createdAtAgoMs: 10 * DAY,
    games: [
      { result: 'win', score: 200, opponent: 'Bot LetraMestre', agoMs: 9 * DAY },
      { result: 'loss', score: 80, opponent: 'CPU Nível Médio', agoMs: 7 * DAY },
      { result: 'draw', score: 140, opponent: 'Adversário Casual', agoMs: 2 * DAY },
    ],
  })

  // 3) Jogador misto (senha + Google) — demonstra provider='both'
  await upsertPlayer({
    email: 'misto@letramestre.com',
    username: 'misto',
    displayName: 'Jogador Misto',
    password: 'senha12345',
    googleId: 'demo-misto@letramestre.com',
    bio: 'Conta vinculada a senha e Google.',
    gamesPlayed: 4,
    gamesWon: 2,
    totalScore: 610,
    bestScore: 220,
    lastLoginAgoMs: 3 * HOUR,
    createdAtAgoMs: 20 * DAY,
    games: [
      { result: 'win', score: 220, opponent: 'Mestre das Letras', agoMs: 18 * DAY },
      { result: 'loss', score: 70, opponent: 'CPU Nível Difícil', agoMs: 15 * DAY },
      { result: 'win', score: 190, opponent: 'Jogador Anônimo', agoMs: 10 * DAY },
      { result: 'draw', score: 130, opponent: 'Bot LetraMestre', agoMs: 4 * DAY },
    ],
  })

  // 4) Jogador apenas senha, sem partidas (perfil recém-criado)
  await upsertPlayer({
    email: 'novato@letramestre.com',
    username: 'novato',
    displayName: 'Jogador Novato',
    password: 'senha12345',
    bio: '',
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    bestScore: 0,
    lastLoginAgoMs: 30 * MIN,
    createdAtAgoMs: 30 * MIN,
  })

  const total = await db.playerAccount.count()
  const games = await db.gameRecord.count()
  console.log(`[seed-players] OK — PlayerAccount=${total}, GameRecord=${games}`)
  console.log('[seed-players] Credenciais demo:')
  console.log('  - jogador@letramestre.com / senha12345')
  console.log('  - misto@letramestre.com  / senha12345')
  console.log('  - novato@letramestre.com / senha12345')
}

main()
  .catch((err) => {
    console.error('[seed-players] FALHA:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
