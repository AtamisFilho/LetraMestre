'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  Medal,
  Search,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  fetchLeaderboard,
  PlayerApiError,
  playerInitials,
  type LeaderboardMetric,
  type LeaderboardPlayer,
  type LeaderboardResult,
} from '@/lib/auth-player-client';

const LIMIT = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rankBadge(rank: number): {
  label: string;
  className: string;
  icon?: React.ReactNode;
} {
  if (rank === 1) {
    return {
      label: '1º',
      className:
        'bg-yellow-500/15 text-yellow-700 border-yellow-500/40 dark:text-yellow-300',
      icon: <Crown className="size-3" aria-hidden />,
    };
  }
  if (rank === 2) {
    return {
      label: '2º',
      className:
        'bg-slate-400/15 text-slate-700 border-slate-400/40 dark:text-slate-200',
      icon: <Medal className="size-3" aria-hidden />,
    };
  }
  if (rank === 3) {
    return {
      label: '3º',
      className:
        'bg-amber-700/15 text-amber-800 border-amber-700/40 dark:text-amber-300',
      icon: <Medal className="size-3" aria-hidden />,
    };
  }
  return {
    label: `${rank}º`,
    className: 'bg-muted text-muted-foreground border-border',
  };
}

function relativeCachedAt(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 1000) return 'agora';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  return new Date(iso).toLocaleTimeString('pt-BR');
}

function metricLabel(m: LeaderboardMetric): string {
  return m === 'avgScore' ? 'Pontuação média' : 'Vitórias';
}

// ---------------------------------------------------------------------------
// Linha da tabela
// ---------------------------------------------------------------------------

function PlayerRow({
  player,
  metric,
}: {
  player: LeaderboardPlayer;
  metric: LeaderboardMetric;
}) {
  const rank = player.rank;
  const rb =
    typeof rank === 'number' && rank > 0
      ? rankBadge(rank)
      : {
          label: '—',
          className: 'bg-muted text-muted-foreground border-border',
          icon: <Search className="size-3" aria-hidden />,
        };
  return (
    <TableRow>
      <TableCell className="w-12 text-center">
        <Badge
          variant="outline"
          className={`min-w-9 justify-center gap-0.5 tabular-nums ${rb.className}`}
          aria-label={`Posição ${rb.label}`}
        >
          {rb.icon}
          {rb.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 border">
            {player.avatarUrl ? (
              <AvatarImage
                src={player.avatarUrl}
                alt={`Avatar de ${player.displayName}`}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {playerInitials(player.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {player.displayName}
            </span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              @{player.username}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-sm">{player.gamesPlayed}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-sm font-medium">{player.gamesWon}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span
          className={
            player.winRate >= 60
              ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
              : 'text-sm'
          }
        >
          {Math.round(player.winRate)}%
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-sm">{player.totalScore}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span
          className={
            metric === 'avgScore'
              ? 'text-sm font-semibold text-primary'
              : 'text-sm'
          }
        >
          {Math.round(player.avgScore)}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-sm">{player.bestScore}</span>
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-6 w-9 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-6" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-6" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-8" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-10" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-8" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-3 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Ranking global público (Fase 2). Não requer autenticação.
 *
 * Consome `GET /api/leaderboard?metric=&limit=&offset=&search=` com debounce
 * de busca (~300ms), paginação prev/next e indicadores de cache/perf.
 */
export function LeaderboardPanel() {
  const [metric, setMetric] = React.useState<LeaderboardMetric>('wins');
  const [offset, setOffset] = React.useState(0);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [data, setData] = React.useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce da busca (~300ms).
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchLeaderboard({
        metric,
        limit: LIMIT,
        offset,
        search: search || undefined,
      });
      setData(r);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metric, offset, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Polling opcional a cada 15s — só quando não há busca ativa.
  React.useEffect(() => {
    if (search) return;
    const id = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [load, search]);

  const total = data?.total ?? 0;
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;
  const showingFrom = total > 0 ? offset + 1 : 0;
  const showingTo = Math.min(offset + LIMIT, total);

  const isSearchMode = !!search && data?.searchResults !== null && data?.searchResults !== undefined;
  const rows = isSearchMode && data?.searchResults ? data.searchResults : (data?.players ?? []);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" aria-hidden />
              Ranking global
            </CardTitle>
            <CardDescription>
              Top 100 jogadores por {metric === 'avgScore' ? 'pontuação média' : 'vitórias'}.
              Atualizado a cada 15s.
            </CardDescription>
          </div>
          {data?.durationMs !== undefined ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              title="Tempo de resposta do servidor"
            >
              <Zap className="size-3" aria-hidden />
              &lt;{data.durationMs}ms
            </Badge>
          ) : null}
        </div>

        {/* Controles */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(v) => {
              if (v === 'wins' || v === 'avgScore') {
                setMetric(v);
                setOffset(0);
              }
            }}
            variant="outline"
            size="sm"
            aria-label="Métrica do ranking"
          >
            <ToggleGroupItem value="wins" aria-label="Ordenar por vitórias">
              <Trophy className="size-3.5" aria-hidden />
              Vitórias
            </ToggleGroupItem>
            <ToggleGroupItem
              value="avgScore"
              aria-label="Ordenar por pontuação média"
            >
              <Medal className="size-3.5" aria-hidden />
              Pontuação média
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Buscar jogador…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
              aria-label="Buscar jogador por nome ou @username"
            />
          </div>
        </div>

        {/* Indicadores de cache + range */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {data?.cachedAt ? (
            <Badge variant="outline" className="gap-1 font-normal">
              <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden
              />
              cache: {relativeCachedAt(data.cachedAt)}
            </Badge>
          ) : null}
          {!isSearchMode && total > 0 ? (
            <span className="tabular-nums">
              Exibindo {showingFrom}–{showingTo} de {total}
            </span>
          ) : null}
          {isSearchMode ? (
            <Badge variant="outline" className="gap-1">
              <Search className="size-3" aria-hidden />
              {rows.length} resultado(s) para “{search}”
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-rose-50/40 px-4 py-10 text-center dark:bg-rose-950/10">
            <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Não foi possível carregar o ranking.
            </span>
            <span className="text-xs text-muted-foreground">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead className="text-right">Partidas</TableHead>
                  <TableHead className="text-right">Vitórias</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Melhor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
            {isSearchMode ? (
              <>
                <Search className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">
                  Nenhum jogador encontrado para “{search}”.
                </p>
                <p className="text-xs text-muted-foreground">
                  Tente buscar por outro nome ou @username.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchInput('')}
                >
                  Limpar busca
                </Button>
              </>
            ) : (
              <>
                <Users className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">
                  Ainda não há jogadores no ranking.
                </p>
                <p className="text-xs text-muted-foreground">
                  Quando alguém registrar a primeira partida, aparecerá aqui.
                </p>
              </>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="rounded-lg border"
          >
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Jogador</TableHead>
                    <TableHead className="text-right">Partidas</TableHead>
                    <TableHead className="text-right">Vitórias</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    <TableHead className="text-right">Melhor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <PlayerRow
                      key={p.playerId}
                      player={p}
                      metric={metric}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {!isSearchMode && total > LIMIT ? (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {Math.floor(offset / LIMIT) + 1} de{' '}
                  {Math.max(1, Math.ceil(total / LIMIT))}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={!hasPrev || loading}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={!hasNext || loading}
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {loading && data ? (
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Atualizando…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
