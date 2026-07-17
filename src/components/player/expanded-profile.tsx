'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Award,
  Equal,
  Flame,
  Gamepad2,
  Loader2,
  Medal,
  Percent,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

import {
  fetchPlayerStats,
  PlayerApiError,
  type GameResult,
  type PlayerStatsResponse,
} from '@/lib/auth-player-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

const RESULT_META: Record<
  GameResult,
  { label: string; className: string; chart: string }
> = {
  win: {
    label: 'Vitória',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/40',
    chart: '#10b981',
  },
  loss: {
    label: 'Derrota',
    className:
      'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/40',
    chart: '#f43f5e',
  },
  draw: {
    label: 'Empate',
    className:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/40',
    chart: '#f59e0b',
  },
};

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  icon,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: string;
  accent?: 'emerald' | 'rose' | 'amber' | 'primary';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'rose'
        ? 'text-rose-600 dark:text-rose-400'
        : accent === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : accent === 'primary'
            ? 'text-primary'
            : 'text-foreground';
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </span>
        <span className={accentClass} aria-hidden>
          {icon}
        </span>
      </div>
      <div className={`mt-1.5 text-xl font-bold tabular-nums sm:text-2xl ${accentClass}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="mt-2 h-6 w-16" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function EvolutionChart({
  evolution,
}: {
  evolution: PlayerStatsResponse['evolution'];
}) {
  const data = React.useMemo(
    () =>
      evolution.map((e, i) => ({
        idx: i + 1,
        date: formatDateShort(e.date),
        score: e.score,
        cumulative: e.cumulativeScore,
      })),
    [evolution],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Sem partidas para exibir evolução ainda.
      </div>
    );
  }

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border, 220 13% 91%))"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="idx"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-muted-foreground"
            label={{
              value: 'Partida nº',
              position: 'insideBottom',
              offset: -2,
              fontSize: 10,
              fill: 'currentColor',
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-muted-foreground"
            width={40}
          />
          <Tooltip
            cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border, 220 13% 91%))',
              background: 'hsl(var(--popover, 0 0% 100%))',
              color: 'hsl(var(--popover-foreground, 222 47% 11%))',
              fontSize: 12,
            }}
            labelFormatter={(label) => `Partida ${label}`}
            formatter={(value: number, name: string) => {
              if (name === 'cumulative') return [value, 'Acumulada'];
              return [value, 'Pontos'];
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#cumulativeFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
            name="cumulative"
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#64748b"
            strokeWidth={1.2}
            strokeOpacity={0.6}
            fill="none"
            dot={false}
            name="score"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionChart({
  distribution,
}: {
  distribution: PlayerStatsResponse['distribution'];
}) {
  const data = [
    { name: 'Vitórias', value: distribution.wins, color: '#10b981' },
    { name: 'Derrotas', value: distribution.losses, color: '#f43f5e' },
    { name: 'Empates', value: distribution.draws, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Sem partidas para distribuir ainda.
      </div>
    );
  }

  const total = distribution.wins + distribution.losses + distribution.draws;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              stroke="hsl(var(--background, 0 0% 100%))"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(var(--border, 220 13% 91%))',
                background: 'hsl(var(--popover, 0 0% 100%))',
                color: 'hsl(var(--popover-foreground, 222 47% 11%))',
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-2" role="list">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 rounded-sm"
              style={{ background: d.color }}
              aria-hidden
            />
            <span className="flex-1 text-muted-foreground">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-60" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface ExpandedProfileProps {
  /** Token que, ao mudar, força re-fetch (ex: após simular partida). */
  refreshKey?: number | string;
  /** Callback chamado após carregar (ou falhar) as estatísticas. */
  onStatsLoaded?: (stats: PlayerStatsResponse | null) => void;
}

export function ExpandedProfile({
  refreshKey,
  onStatsLoaded,
}: ExpandedProfileProps) {
  const [data, setData] = React.useState<PlayerStatsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchPlayerStats();
      setData(r);
      onStatsLoaded?.(r);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      setError(msg);
      onStatsLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }, [onStatsLoaded]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !data) {
    return <StatsSkeleton />;
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Activity className="size-8 text-rose-500" aria-hidden />
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
            Não foi possível carregar suas estatísticas.
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const winRatePct = Math.round(s.winRate ?? 0);
  const recentForm = (data.recentForm ?? []).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-primary" aria-hidden />
                Estatísticas detalhadas
              </CardTitle>
              <CardDescription>
                Visão expandida da sua performance no LetraMestre.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Recarregar estatísticas"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <TrendingUp className="size-4" aria-hidden />
              )}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Partidas"
              value={s.gamesPlayed}
              icon={<Gamepad2 className="size-4" />}
              accent="primary"
            />
            <Kpi
              label="Vitórias"
              value={s.gamesWon}
              icon={<Trophy className="size-4" />}
              accent="emerald"
            />
            <Kpi
              label="Taxa de vitória"
              value={
                <span>
                  {winRatePct}
                  <span className="text-base text-muted-foreground">%</span>
                </span>
              }
              icon={<Percent className="size-4" />}
              accent={winRatePct >= 50 ? 'emerald' : undefined}
              hint={`${s.gamesLost} derrotas · ${s.gamesDraw} empates`}
            />
            <Kpi
              label="Pontuação total"
              value={s.totalScore}
              icon={<Target className="size-4" />}
              accent="primary"
            />
            <Kpi
              label="Pontuação média"
              value={Math.round(s.avgScore)}
              icon={<Activity className="size-4" />}
              hint="por partida"
            />
            <Kpi
              label="Melhor pontuação"
              value={s.bestScore}
              icon={<Medal className="size-4" />}
              accent="amber"
              hint="em uma partida"
            />
            <Kpi
              label="Sequência atual"
              value={
                <span className="flex items-center gap-1">
                  {s.currentStreak}
                  <Flame
                    className={
                      s.currentStreak > 0
                        ? 'size-4 text-orange-500'
                        : 'size-4 text-muted-foreground/40'
                    }
                    aria-hidden
                  />
                </span>
              }
              icon={<Flame className="size-4" />}
              accent={s.currentStreak > 0 ? 'amber' : undefined}
              hint="vitórias seguidas"
            />
            <Kpi
              label="Melhor sequência"
              value={s.bestStreak}
              icon={<Award className="size-4" />}
              accent="amber"
              hint="recorde de streak"
            />
          </div>

          {/* Forma recente */}
          {recentForm.length > 0 ? (
            <section aria-label="Forma recente" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Últimas 5 partidas
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  mais recentes →
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentForm.map((r, i) => {
                  const m = RESULT_META[r] ?? RESULT_META.draw;
                  return (
                    <Badge
                      key={`${i}-${r}`}
                      variant="outline"
                      className={`gap-1 px-2 py-1 ${m.className}`}
                      title={m.label}
                    >
                      {r === 'win' ? (
                        <Trophy className="size-3" aria-hidden />
                      ) : r === 'loss' ? (
                        <X className="size-3" aria-hidden />
                      ) : (
                        <Equal className="size-3" aria-hidden />
                      )}
                      <span className="text-[11px] font-medium">
                        {m.label}
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" aria-hidden />
              Evolução da pontuação
            </CardTitle>
            <CardDescription>
              Pontuação acumulada (verde) e por partida (cinza) nas últimas{' '}
              {data.evolution.length || 0} partidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvolutionChart evolution={data.evolution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-primary" aria-hidden />
              Distribuição de resultados
            </CardTitle>
            <CardDescription>
              Vitórias, derrotas e empates em {s.gamesPlayed} partidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionChart distribution={data.distribution} />
            {/* Barra de win rate visual */}
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Taxa de vitória</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {winRatePct}%
                </span>
              </div>
              <Progress value={winRatePct} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
