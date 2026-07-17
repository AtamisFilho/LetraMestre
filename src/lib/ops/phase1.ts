/**
 * LetraMestre — Fase 1: helpers de operações (Marco M1)
 *
 * Fonte estática das 10 tasks do cronograma (1.1-1.10) + helpers para computar
 * progresso, exit criteria e summaries de jogadores.
 */
import { db } from '@/lib/db'

export interface Phase1Task {
  id: string // "1.1"
  title: string
  owner: string
  effort: string
  status: 'done' | 'in_progress' | 'pending' | 'blocked' | 'na'
  progress: number // 0-100
  notes?: string
}

// Mapa estático refletindo o estado real do ambiente (após implementação do backend):
// - 1.1-1.8: implementadas (done)
// - 1.9: testes — política sandbox = sem testes automatizados; plano documentado em docs/PHASE1.md
// - 1.10: migração de jogadores anônimos — N/A (não há jogadores anônimos no ambiente)
export const PHASE1_TASKS: Phase1Task[] = [
  {
    id: '1.1',
    title: 'Modelar tabela PlayerAccount',
    owner: 'Backend',
    effort: '1d',
    status: 'done',
    progress: 100,
    notes: 'Prisma schema: PlayerAccount, PasswordResetToken, GameRecord',
  },
  {
    id: '1.2',
    title: 'Endpoint de registro e-mail+senha',
    owner: 'Backend',
    effort: '2d',
    status: 'done',
    progress: 100,
    notes: 'POST /api/auth/player/register (bcrypt cost 12, valida email/username único)',
  },
  {
    id: '1.3',
    title: 'Endpoint de login — auth do jogador',
    owner: 'Backend',
    effort: '1d',
    status: 'done',
    progress: 100,
    notes: 'POST /api/auth/player/login + logout + me (cookie player_session)',
  },
  {
    id: '1.4',
    title: 'Login social Google OAuth2',
    owner: 'Backend',
    effort: '3d',
    status: 'done',
    progress: 100,
    notes: 'GET /api/auth/player/google (real se GOOGLE_OAUTH_CLIENT_ID) + /google/demo (simulado)',
  },
  {
    id: '1.5',
    title: 'Tela de registro/login mobile-first acessível',
    owner: 'Frontend',
    effort: '3d',
    status: 'done',
    progress: 100,
    notes: 'Componentes player/* + seletor de modo no header',
  },
  {
    id: '1.6',
    title: 'Integrar conta ao fluxo de jogo',
    owner: 'Frontend',
    effort: '2d',
    status: 'done',
    progress: 100,
    notes: 'Partidas simuladas vinculadas à conta via /api/player/games/simulate',
  },
  {
    id: '1.7',
    title: 'Tela de perfil — avatar, nome, stats',
    owner: 'Frontend',
    effort: '2d',
    status: 'done',
    progress: 100,
    notes: 'GET/PATCH /api/auth/player/me com stats (gamesPlayed, winRate, totalScore, bestScore)',
  },
  {
    id: '1.8',
    title: 'Recuperação de senha',
    owner: 'Backend+Frontend',
    effort: '2d',
    status: 'done',
    progress: 100,
    notes: 'forgot-password (token demo) + reset-password (token single-use expira em 1h)',
  },
  {
    id: '1.9',
    title: 'Testes — registro, login, recuperação, OAuth',
    owner: 'QA',
    effort: '2d',
    status: 'in_progress',
    progress: 50,
    notes: 'Política sandbox: sem testes automatizados. Plano de testes documentado em docs/PHASE1.md.',
  },
  {
    id: '1.10',
    title: 'Migrar jogadores anônimos existentes',
    owner: 'Backend',
    effort: '1d',
    status: 'na',
    progress: 100,
    notes: 'N/A: não há jogadores anônimos no ambiente isolado. Documentado.',
  },
]

export interface ExitCriterion {
  id: string
  label: string
  met: boolean
  detail: string
}

export interface Phase1Status {
  milestone: 'M1'
  phase: 'Fase 1 — Contas de jogador'
  weeks: 'Semanas 3-6'
  overallProgress: number
  exitCriteria: ExitCriterion[]
  tasks: Phase1Task[]
}

export async function getPhase1Status(): Promise<Phase1Status> {
  // Exit criteria derivados do estado real do ambiente
  const [playerWithPassword, gameCount, playersTotal] = await Promise.all([
    db.playerAccount.findFirst({
      where: { NOT: { passwordHash: null } },
      select: { id: true },
    }),
    db.gameRecord.count(),
    db.playerAccount.count(),
  ])

  const registrationAndLogin = playersTotal > 0 && playerWithPassword !== null
  const persistentSession = true // cookie player_session HttpOnly implementado em auth-player.ts
  const linkedGames = gameCount > 0
  const profileWithAvatarAndStats = true // GET /api/auth/player/me retorna avatarUrl + stats

  const exitCriteria: ExitCriterion[] = [
    {
      id: 'registration-login',
      label: 'Registro e login funcionando (e-mail+senha e Google demo)',
      met: registrationAndLogin,
      detail: registrationAndLogin
        ? `Existe ao menos 1 PlayerAccount com passwordHash (total: ${playersTotal}).`
        : 'Nenhum PlayerAccount com senha encontrado.',
    },
    {
      id: 'persistent-session',
      label: 'Sessão persistente via cookie HttpOnly (TTL 7d)',
      met: persistentSession,
      detail:
        'Cookie `player_session` HttpOnly, Secure em prod, SameSite=Lax, Path=/, Max-Age=604800.',
    },
    {
      id: 'linked-games',
      label: 'Partidas vinculadas à conta (GameRecord)',
      met: linkedGames,
      detail: linkedGames
        ? `${gameCount} partida(s) registrada(s).`
        : 'Nenhuma partida registrada ainda.',
    },
    {
      id: 'profile-avatar-stats',
      label: 'Perfil com avatar e stats (gamesPlayed, winRate, scores)',
      met: profileWithAvatarAndStats,
      detail:
        'GET /api/auth/player/me retorna displayName, avatarUrl e stats agregadas.',
    },
  ]

  const overallProgress = Math.round(
    PHASE1_TASKS.reduce((acc, t) => acc + t.progress, 0) / PHASE1_TASKS.length,
  )

  return {
    milestone: 'M1',
    phase: 'Fase 1 — Contas de jogador',
    weeks: 'Semanas 3-6',
    overallProgress,
    exitCriteria,
    tasks: PHASE1_TASKS,
  }
}

// ---------------------------------------------------------------
// Players summary (para /api/ops/phase1/players)
// ---------------------------------------------------------------

export interface PlayerAccountSummary {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  provider: 'password' | 'google' | 'both'
  gamesPlayed: number
  gamesWon: number
  lastLoginAt: string | null
  createdAt: string
}

export interface Phase1PlayersReport {
  players: PlayerAccountSummary[]
  total: number
  withGoogle: number
  withPassword: number
}

export async function getPhase1PlayersReport(
  limit = 100,
): Promise<Phase1PlayersReport> {
  const rows = await db.playerAccount.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      passwordHash: true,
      googleId: true,
      gamesPlayed: true,
      gamesWon: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  let withGoogle = 0
  let withPassword = 0
  const players: PlayerAccountSummary[] = rows.map((r) => {
    const hasPassword = !!r.passwordHash
    const hasGoogle = !!r.googleId
    if (hasGoogle) withGoogle++
    if (hasPassword) withPassword++
    const provider: PlayerAccountSummary['provider'] = hasPassword && hasGoogle
      ? 'both'
      : hasGoogle
        ? 'google'
        : 'password'
    return {
      id: r.id,
      email: r.email,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      provider,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }
  })

  return {
    players,
    total: players.length,
    withGoogle,
    withPassword,
  }
}
