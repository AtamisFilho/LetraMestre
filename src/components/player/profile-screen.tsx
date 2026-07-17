'use client';

import * as React from 'react';
import {
  Edit3,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trophy,
  Swords,
  Gamepad2,
  Medal,
  Target,
  Percent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import {
  getMyGames,
  getMe,
  simulateGame,
  PlayerApiError,
  playerInitials,
  providerLabel,
  type GameRecord,
  type GameResult,
  type PlayerMe,
} from '@/lib/auth-player-client';
import { EditProfileDialog } from './edit-profile-dialog';

interface ProfileScreenProps {
  player: PlayerMe;
  onUpdated: (p: PlayerMe) => void;
  onLogout: () => void;
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

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function ProfileScreen({
  player,
  onUpdated,
  onLogout,
}: ProfileScreenProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [games, setGames] = React.useState<GameRecord[]>([]);
  const [gamesLoading, setGamesLoading] = React.useState(true);
  const [simulating, setSimulating] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

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
        `Partida simulada: ${
          r.game.result === 'win'
            ? 'vitória'
            : r.game.result === 'loss'
              ? 'derrota'
              : 'empate'
        } · ${r.game.score} pts.`,
      );
      // Refresh jogos + stats (busca /me novamente via callback).
      await loadGames();
      // Recarrega perfil para atualizar stats.
      try {
        const me = await getMe();
        if (me) onUpdated(me);
      } catch {
        // silent — apenas stats ficam defasadas.
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

  const stats = player.stats;
  const winRatePct = Math.round(stats.winRate ?? 0);

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
                Conta Fase 1
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

      {/* Stats grid */}
      <section aria-label="Estatísticas do jogador">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Estatísticas
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Partidas"
            value={stats.gamesPlayed}
            icon={<Gamepad2 className="size-4" />}
          />
          <StatCard
            label="Vitórias"
            value={stats.gamesWon}
            icon={<Trophy className="size-4" />}
          />
          <StatCard
            label="Taxa de vitória"
            value={
              <span>
                {winRatePct}
                <span className="text-base text-muted-foreground">%</span>
              </span>
            }
            icon={<Percent className="size-4" />}
          />
          <StatCard
            label="Pontuação total"
            value={stats.totalScore}
            icon={<Target className="size-4" />}
          />
          <StatCard
            label="Melhor pontuação"
            value={stats.bestScore}
            icon={<Medal className="size-4" />}
          />
        </div>
      </section>

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
