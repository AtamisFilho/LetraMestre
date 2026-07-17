/**
 * Cliente de dados da experiência do Jogador (Fase 1).
 *
 * Tipos e fetchers alinhados ao contrato de API definido em
 * `/home/z/my-project/worklog.md` (seção "Task ID: 5 — Contrato de API da Fase 1").
 *
 * Todas as funções fazem fetch client-side com `credentials: 'include'`
 * (para o cookie `player_session` HttpOnly ser enviado/gravado) e
 * `cache: 'no-store'`. Lançam `PlayerApiError` em caso de falha — os
 * componentes devem tratar com toast/skeleton graceful.
 *
 * IMPORTANTE: o cookie de sessão é HttpOnly (não acessível via JS), então
 * a hidratação do estado client é feita chamando `GET /api/auth/player/me`
 * no mount do hook `usePlayerSession`.
 */

'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Tipos — respostas do contrato
// ---------------------------------------------------------------------------

export type PlayerProvider = 'password' | 'google' | 'both';
export type GameResult = 'win' | 'loss' | 'draw';

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalScore: number;
  bestScore: number;
}

export interface PlayerPublic {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  /** Provider de auth — pode não vir no /me (contrato mínimo não inclui). */
  provider?: PlayerProvider;
}

export interface PlayerMe extends PlayerPublic {
  bio: string;
  stats: PlayerStats;
}

export interface GameRecord {
  id: string;
  playerId: string;
  result: GameResult;
  score: number;
  opponent: string;
  language?: string;
  createdAt: string;
}

export interface PlayerAccountSummary {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  provider: PlayerProvider;
  gamesPlayed: number;
  gamesWon: number;
  lastLoginAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Respostas completas (envelopes)
// ---------------------------------------------------------------------------

export interface RegisterResponse {
  player: PlayerPublic;
  session: boolean;
}

export interface LoginResponse {
  player: PlayerPublic;
}

export interface MeResponse {
  player: PlayerMe;
}

export interface UpdateMeResponse {
  player: PlayerMe;
}

export interface ForgotPasswordResponse {
  ok: boolean;
  demoResetToken?: string;
  demoResetUrl?: string;
}

export interface ResetPasswordResponse {
  ok: boolean;
}

export interface GoogleConfigResponse {
  configured: boolean;
  demo: boolean;
  authUrl?: string;
}

export interface GoogleDemoResponse {
  player: PlayerPublic;
  session: boolean;
}

export interface AchievementSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface UnlockedAchievement extends AchievementSummary {
  unlockedAt: string;
}

export interface LockedAchievementProgress {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  progress: { current: number; target: number; percent: number };
}

export interface NewAchievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface SimulateGameResponse {
  game: GameRecord;
  newAchievements?: NewAchievement[];
}

export interface MyGamesResponse {
  games: GameRecord[];
}

export interface LogoutResponse {
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Ops Phase 1 (consumido pela seção do console)
// ---------------------------------------------------------------------------

export interface Phase1Task {
  id: string;
  title: string;
  owner: string;
  effort: string;
  status: 'done' | 'in_progress' | 'pending' | 'blocked' | 'na';
  progress: number;
}

export interface Phase1ExitCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface Phase1Status {
  milestone: string;
  phase: string;
  weeks: string;
  overallProgress: number;
  exitCriteria: Phase1ExitCriterion[];
  tasks: Phase1Task[];
}

export interface Phase1PlayersList {
  players: PlayerAccountSummary[];
  total: number;
  withGoogle: number;
  withPassword: number;
}

// ---------------------------------------------------------------------------
// Erro de API
// ---------------------------------------------------------------------------

export class PlayerApiError extends Error {
  status: number;
  endpoint: string;
  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'PlayerApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface PlayerFetchOptions {
  method?: string;
  body?: unknown;
  /** Permite tratar 401 como resposta normal (não erro) — usado no GET /me. */
  allow401?: boolean;
}

async function playerFetch<T>(
  endpoint: string,
  opts: PlayerFetchOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new PlayerApiError(
      `Falha de conexão com ${endpoint}.`,
      0,
      endpoint,
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail =
        (typeof data === 'object' && data !== null
          ? (data as { error?: string; message?: string }).error ||
            (data as { message?: string }).message ||
            JSON.stringify(data)
          : String(data)) ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new PlayerApiError(
      detail || `Erro ${res.status} em ${endpoint}`,
      res.status,
      endpoint,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new PlayerApiError(
      `Resposta inválida (não-JSON) de ${endpoint}`,
      res.status,
      endpoint,
    );
  }
}

// ---------------------------------------------------------------------------
// Fetchers — auth
// ---------------------------------------------------------------------------

export const registerPlayer = (body: {
  email: string;
  username: string;
  password: string;
}) =>
  playerFetch<RegisterResponse>('/api/auth/player/register', {
    method: 'POST',
    body,
  });

export const loginPlayer = (body: { email: string; password: string }) =>
  playerFetch<LoginResponse>('/api/auth/player/login', {
    method: 'POST',
    body,
  });

export const logoutPlayer = () =>
  playerFetch<LogoutResponse>('/api/auth/player/logout', {
    method: 'POST',
  });

/** Retorna a sessão atual ou null se 401. */
export async function getMe(): Promise<PlayerMe | null> {
  let res: Response;
  try {
    res = await fetch('/api/auth/player/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new PlayerApiError('Falha de conexão com /api/auth/player/me.', 0, '/api/auth/player/me');
  }
  if (res.status === 401) return null;
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail =
        (typeof data === 'object' && data !== null
          ? (data as { error?: string }).error || JSON.stringify(data)
          : String(data)) ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new PlayerApiError(
      detail || `Erro ${res.status} em /api/auth/player/me`,
      res.status,
      '/api/auth/player/me',
    );
  }
  try {
    const data = (await res.json()) as { player: RawPlayerMeLike };
    return normalizePlayerMe(data.player);
  } catch {
    throw new PlayerApiError(
      'Resposta inválida (não-JSON) de /api/auth/player/me',
      res.status,
      '/api/auth/player/me',
    );
  }
}

/**
 * Forma "crua" do player — aceita tanto o formato do contrato (com `stats`
 * aninhado) quanto o formato efetivamente implementado pelo backend (com
 * gamesPlayed/gamesWon/totalScore/bestScore/winRate/googleLinked no nível
 * raiz do player). Esta flexibilidade permite que o frontend funcione mesmo
 * se o backend ainda não tiver alinhado 100% ao contrato.
 */
interface RawPlayerMeLike {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  provider?: PlayerProvider;
  // Forma flat (backend atual):
  gamesPlayed?: number;
  gamesWon?: number;
  totalScore?: number;
  bestScore?: number;
  winRate?: number;
  googleLinked?: boolean;
  // Forma aninhada (contrato):
  stats?: PlayerStats;
}

function normalizePlayerMe(raw: RawPlayerMeLike): PlayerMe {
  const stats: PlayerStats =
    raw.stats ??
    ({
      gamesPlayed: raw.gamesPlayed ?? 0,
      gamesWon: raw.gamesWon ?? 0,
      winRate: raw.winRate ?? 0,
      totalScore: raw.totalScore ?? 0,
      bestScore: raw.bestScore ?? 0,
    } satisfies PlayerStats);

  // Deriva provider se não estiver explícito.
  let provider: PlayerProvider | undefined = raw.provider;
  if (!provider && typeof raw.googleLinked === 'boolean') {
    // Sem info de senha no /me — assumimos 'google' se googleLinked,
    // caso contrário 'password'. Se o backend evoluir para expor ambos,
    // o campo `provider` explícito tem prioridade.
    provider = raw.googleLinked ? 'google' : 'password';
  }

  return {
    id: raw.id,
    email: raw.email,
    username: raw.username,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    bio: raw.bio ?? '',
    createdAt: raw.createdAt,
    lastLoginAt: raw.lastLoginAt ?? null,
    provider,
    stats,
  };
}

export async function updateMe(body: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
}): Promise<PlayerMe> {
  const data = await playerFetch<{ player: RawPlayerMeLike }>(
    '/api/auth/player/me',
    {
      method: 'PATCH',
      body,
    },
  );
  return normalizePlayerMe(data.player);
}

export const forgotPassword = (body: { email: string }) =>
  playerFetch<ForgotPasswordResponse>('/api/auth/player/forgot-password', {
    method: 'POST',
    body,
  });

export const resetPassword = (body: { token: string; password: string }) =>
  playerFetch<ResetPasswordResponse>('/api/auth/player/reset-password', {
    method: 'POST',
    body,
  });

export const getGoogleConfig = () =>
  playerFetch<GoogleConfigResponse>('/api/auth/player/google');

export const googleDemoLogin = (body: { email?: string; name?: string }) =>
  playerFetch<GoogleDemoResponse>('/api/auth/player/google/demo', {
    method: 'POST',
    body,
  });

// ---------------------------------------------------------------------------
// Fetchers — partidas
// ---------------------------------------------------------------------------

export const simulateGame = (body?: {
  result?: GameResult;
  score?: number;
  opponent?: string;
}) =>
  playerFetch<SimulateGameResponse>('/api/player/games/simulate', {
    method: 'POST',
    body: body ?? {},
  });

export const getMyGames = () =>
  playerFetch<MyGamesResponse>('/api/player/games');

// ---------------------------------------------------------------------------
// Fetchers — Fase 2 (ranking, estatísticas expandidas, conquistas)
// ---------------------------------------------------------------------------

export type LeaderboardMetric = 'wins' | 'avgScore';

export interface LeaderboardPlayer {
  rank?: number;
  playerId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalScore: number;
  avgScore: number;
  bestScore: number;
}

export interface LeaderboardResult {
  metric: LeaderboardMetric;
  total: number;
  limit: number;
  offset: number;
  players: LeaderboardPlayer[];
  searchResults: LeaderboardPlayer[] | null;
  cachedAt?: string;
  durationMs?: number;
}

export interface PlayerStatsSummary {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
  winRate: number;
  totalScore: number;
  avgScore: number;
  bestScore: number;
  currentStreak: number;
  bestStreak: number;
}

export interface PlayerStatsEvolutionPoint {
  gameId: string;
  date: string;
  result: GameResult;
  score: number;
  cumulativeScore: number;
  cumulativeWins: number;
}

export interface PlayerStatsResponse {
  summary: PlayerStatsSummary;
  evolution: PlayerStatsEvolutionPoint[];
  distribution: { wins: number; losses: number; draws: number };
  recentForm: GameResult[];
  achievements: {
    unlocked: number;
    total: number;
    recent: { id: string; code: string; name: string; unlockedAt: string }[];
  };
}

export interface AchievementsListResponse {
  achievements: AchievementSummary[];
}

export interface PlayerAchievementsStats {
  unlocked: number;
  total: number;
  percent: number;
}

export interface PlayerAchievementsResponse {
  unlocked: UnlockedAchievement[];
  locked: LockedAchievementProgress[];
  stats: PlayerAchievementsStats;
}

export interface FetchLeaderboardParams {
  metric?: LeaderboardMetric;
  limit?: number;
  offset?: number;
  search?: string;
}

export function fetchLeaderboard(
  params: FetchLeaderboardParams = {},
): Promise<LeaderboardResult> {
  const sp = new URLSearchParams();
  if (params.metric) sp.set('metric', params.metric);
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') sp.set('offset', String(params.offset));
  if (params.search) sp.set('search', params.search);
  const qs = sp.toString();
  const url = qs ? `/api/leaderboard?${qs}` : '/api/leaderboard';
  return playerFetch<LeaderboardResult>(url);
}

export function fetchPlayerStats(): Promise<PlayerStatsResponse> {
  return playerFetch<PlayerStatsResponse>('/api/player/stats');
}

export function fetchPlayerAchievements(): Promise<PlayerAchievementsResponse> {
  return playerFetch<PlayerAchievementsResponse>('/api/player/achievements');
}

export function fetchAchievements(): Promise<AchievementsListResponse> {
  return playerFetch<AchievementsListResponse>('/api/achievements');
}

// ---------------------------------------------------------------------------
// Fetchers — ops phase 1
// ---------------------------------------------------------------------------

export const fetchPhase1Status = () =>
  playerFetch<Phase1Status>('/api/ops/phase1/status');

export const fetchPhase1Players = () =>
  playerFetch<Phase1PlayersList>('/api/ops/phase1/players');

// ---------------------------------------------------------------------------
// Hook de sessão do jogador
// ---------------------------------------------------------------------------

export interface UsePlayerSessionResult {
  player: PlayerMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<PlayerMe | null>;
  logout: () => Promise<void>;
  /** Setter local — usado para hidratar imediatamente após login/registro. */
  setPlayer: (p: PlayerMe | null) => void;
}

/**
 * Hidrata a sessão do jogador no mount chamando GET /me.
 * Em 401 → não autenticado (player = null, sem erro).
 * Em outro erro → exibe erro (mas mantém player = null).
 */
export function usePlayerSession(): UsePlayerSessionResult {
  const [player, setPlayer] = React.useState<PlayerMe | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getMe();
      setPlayer(p);
      return p;
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro desconhecido.';
      setError(msg);
      setPlayer(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await logoutPlayer();
    } catch {
      // Mesmo se o logout remoto falhar, limpamos o estado local.
    }
    setPlayer(null);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const p = await refresh();
      if (!mounted) return;
      void p;
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  return { player, loading, error, refresh, logout, setPlayer };
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Iniciais para o fallback do avatar. */
export function playerInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** Provider badge label em PT-BR. */
export function providerLabel(p: PlayerProvider | undefined): string {
  switch (p) {
    case 'password':
      return 'Senha';
    case 'google':
      return 'Google';
    case 'both':
      return 'Senha + Google';
    default:
      return '—';
  }
}
