'use client';

import * as React from 'react';
import {
  ArrowRight,
  Edit3,
  Gamepad2,
  Loader2,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  Swords,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import {
  getMe,
  getMyGames,
  PlayerApiError,
  playerInitials,
  providerLabel,
  simulateGame,
  type GameRecord,
  type GameResult,
  type NewAchievement,
  type PlayerMe,
  type PlayerStatsResponse,
} from '@/lib/auth-player-client';
import { EditProfileDialog } from './edit-profile-dialog';
import { ExpandedProfile } from './expanded-profile';
import { showAchievementToast } from './achievement-toast';
import { AchievementIcon } from './achievements-panel';

interface ProfileScreenProps {
  player: PlayerMe;
  onUpdated: (p: PlayerMe) => void;
  onLogout: () => void;
  /** Navega para a tab Conquistas no PlayerApp. */
  onViewAchievements?: () => void;
}

const RESULT_META: Record<
  GameResult,
  { label: string; className: string; icon: React.ReactNode }
> = {
  win: {
    label: 'Vitória',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/40',
    icon: <Trophy className="size-3" aria-hidden />,
  },
  loss: {
    label: 'Derrota',
    className:
      'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/40',
    icon: <Swords className="size-3" aria-hidden />,
  },
  draw: {
    label: 'Empate',
    className:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/40',
    icon: <Medal className="size-3" aria-hidden />,
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function resultLabel(r: GameResult): string {
  return r === 'win' ? 'vitória' : r === 'loss' ? 'derrota' : 'empate';
}

/**
 * Dispara toasts de conquista em sequência (com pequeno delay entre eles
 * para evitar empilhamento visual confuso).
 */
function announceNewAchievements(achievements: NewAchievement[]): void {
  if (!achievements || achievements.length === 0) return;
  achievements.forEach((a, i) => {
    window.setTimeout(() => showAchievementToast(a), i * 300);
  });
}

export function ProfileScreen({
  player,
  onUpdated,
  onLogout,
  onViewAchievements,
}: ProfileScreenProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [games, setGames] = React.useState<GameRecord[]>([]);
  const [gamesLoading, setGamesLoading] = React.useState(true);
  const [simulating, setSimulating] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = React.useState(0);
  const [achievementTeaser, setAchievementTeaser] = React.useState<{
    unlocked: number;
    total: number;
    recent: PlayerStatsResponse['achievements']['recent'];
  } | null>(null);

  const loadGames = React.useCallback(async () => {
    setGamesLoading(true);
    try {
      const r = await getMyGames();
      setGames(r.games);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao carregar partidas recentes', { description: msg });
    } finally {
      setGamesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const r = await simulateGame();
      toast.success(
        `Partida simulada: ${resultLabel(r.game.result)} · ${r.game.score} pts.`,
      );
      // Anuncia novas conquistas (se houver) — delay escalonado entre toasts.
      announceNewAchievements(r.newAchievements ?? []);
      // Força re-fetch das estatísticas expandidas + partidas + /me.
      setStatsRefreshKey((k) => k + 1);
      await loadGames();
      try {
        const me = await getMe();
        if (me) onUpdated(me);
      } catch {
        // silent — apenas stats ficam defasadas.
      }
      if ((r.newAchievements ?? []).length > 0) {
        toast.info(`${(r.newAchievements ?? []).length} nova(s) conquista(s)!`, {
          description: 'Veja na aba Conquistas.',
        });
      }
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao simular partida', { description: msg });
    } finally {
      setSimulating(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/player/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // ignore
    } finally {
      setLoggingOut(false);
      onLogout();
      toast.success('Você saiu da conta.');
    }
  };

  const handleStatsLoaded = React.useCallback(
    (stats: PlayerStatsResponse | null) => {
      if (!stats) {
        setAchievementTeaser(null);
        return;
      }
      setAchievementTeaser({
        unlocked: stats.achievements.unlocked,
        total: stats.achievements.total,
        recent: stats.achievements.recent,
      });
    },
    [],
  );

  const teaserPct = achievementTeaser
    ? achievementTeaser.total > 0
      ? Math.round((achievementTeaser.unlocked / achievementTeaser.total) * 100)
      : 0
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Cabeçalho do perfil */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
          <Avatar className="size-16 shrink-0 border sm:size-20">
            {player.avatarUrl ? (
              <AvatarImage src={player.avatarUrl} alt={`Avatar de ${player.displayName}`} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {playerInitials(player.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {player.displayName}
              </h2>
              {player.provider ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {providerLabel(player.provider)}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Fase 2
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono">@{player.username}</span>
              <span aria-hidden>·</span>
              <span>{player.email}</span>
            </div>
            {player.bio ? (
              <p className="mt-1 text-sm text-foreground/90">{player.bio}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground italic">
                Sem bio. Clique em “Editar perfil” para adicionar uma.
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Entrou em{' '}
                <time dateTime={player.createdAt}>
                  {formatDate(player.createdAt)}
                </time>
              </span>
              {player.lastLoginAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    Último login{' '}
                    <time dateTime={player.lastLoginAt}>
                      {formatDate(player.lastLoginAt)}
                    </time>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Edit3 className="size-4" aria-hidden />
              Editar perfil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="size-4" aria-hidden />
              )}
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Perfil expandido (Fase 2): KPIs + gráficos + forma recente */}
      <ExpandedProfile
        refreshKey={statsRefreshKey}
        onStatsLoaded={handleStatsLoaded}
      />

      {/* Resumo de conquistas (teaser) + CTA para a tab Conquistas */}
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-primary" aria-hidden />
                Conquistas
              </CardTitle>
              <CardDescription>
                Acompanhe seu progresso e desbloqueie novas marcas.
              </CardDescription>
            </div>
            {onViewAchievements ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewAchievements}
              >
                Ver todas
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {achievementTeaser ? (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  {achievementTeaser.unlocked} de {achievementTeaser.total}{' '}
                  desbloqueadas
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  {teaserPct}%
                </span>
              </div>
              <Progress value={teaserPct} className="h-2" />
              {achievementTeaser.recent.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {achievementTeaser.recent.slice(0, 5).map((a) => (
                    <Badge
                      key={a.id}
                      variant="outline"
                      className="gap-1 border-primary/30 bg-primary/10 text-primary"
                    >
                      <AchievementIcon name="award" className="size-3" />
                      {a.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Jogue sua primeira partida para começar a desbloquear
                  conquistas.
                </p>
              )}
            </>
          ) : (
            <Skeleton className="h-12 w-full rounded-md" />
          )}
        </CardContent>
      </Card>

      {/* Partidas recentes */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Partidas recentes</CardTitle>
            <CardDescription>
              Histórico de partidas vinculadas à sua conta.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadGames}
              disabled={gamesLoading}
              aria-label="Recarregar partidas"
            >
              <RefreshCw
                className={gamesLoading ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden
              />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleSimulate}
              disabled={simulating}
            >
              {simulating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Simular partida
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {gamesLoading && games.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
              <Gamepad2 className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Nenhuma partida registrada ainda.</p>
              <p className="text-xs text-muted-foreground">
                Clique em “Simular partida” para registrar sua primeira partida.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y" role="list">
              {games.map((g) => {
                const meta = RESULT_META[g.result] ?? RESULT_META.draw;
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Badge
                      variant="outline"
                      className={`gap-1 border ${meta.className}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </Badge>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium">
                        {g.opponent
                          ? `vs. ${g.opponent}`
                          : 'Oponente aleatório'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(g.createdAt)}
                        {g.language ? ` · ${g.language}` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">
                        {g.score}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        pontos
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        player={player}
        onUpdated={onUpdated}
      />
    </motion.div>
  );
}
