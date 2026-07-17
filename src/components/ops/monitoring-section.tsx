'use client';

import * as React from 'react';
import {
  Activity,
  Users,
  Wifi,
  Cpu,
  MemoryStick,
  Clock,
  Database,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import {
  fetchMetrics,
  OpsApiError,
  formatBytes,
  formatUptime,
  formatTimeShort,
  type OpsMetrics,
} from '@/lib/ops/client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const POLL_MS = 3000;

export function MonitoringSection() {
  const [data, setData] = React.useState<OpsMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [polling, setPolling] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const [reconnecting, setReconnecting] = React.useState(false);

  // Mantém o último valor conhecido em ref para não perder histórico.
  const lastGoodRef = React.useRef<OpsMetrics | null>(null);

  const load = React.useCallback(async (isPoll: boolean) => {
    if (isPoll) setPolling(true);
    try {
      const d = await fetchMetrics();
      setData(d);
      lastGoodRef.current = d;
      setError(null);
      setReconnecting(false);
      setLastUpdate(new Date());
    } catch (e) {
      const msg =
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar métricas.';
      setError(msg);
      setReconnecting(true);
      // Mantém o último valor conhecido (lastGoodRef) — não sobrescrevemos `data`.
    } finally {
      setLoading(false);
      setPolling(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const safePoll = () => {
      if (!mounted) return;
      // Pausa o polling quando a aba não está visível.
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return;
      }
      load(true);
    };

    // Primeira carga imediata.
    load(false);

    timer = setInterval(safePoll, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Retomada: dispara um poll imediato para atualizar.
        load(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const chartData = React.useMemo(() => {
    const hist = (data?.history ?? []).map((h) => ({
      t: formatTimeShort(h.t),
      activeRooms: h.activeRooms,
      activeConnections: h.activeConnections,
      memoryMb: h.memoryMb,
    }));
    // Anexa o ponto atual no fim do histórico para continuidade visual.
    if (data) {
      hist.push({
        t: formatTimeShort(data.timestamp),
        activeRooms: data.game.activeRooms,
        activeConnections: data.game.activeConnections,
        memoryMb: data.system.memoryMb,
      });
    }
    return hist;
  }, [data]);

  const db = data?.database;
  const sys = data?.system;
  const game = data?.game;

  return (
    <SectionShell
      id="monitoramento"
      title="Monitoramento"
      description="Entregável 0.5 — métricas em tempo real do mini-serviço (porta 3004), do sistema e do banco. Atualização a cada 3 segundos."
      icon={<Activity className="size-5" />}
      actions={
        <>
          {reconnecting ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              role="status"
            >
              <span
                className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-amber-500"
                aria-hidden
              />
              reconectando
            </Badge>
          ) : null}
          {data ? (
            <Badge
              variant="outline"
              className={
                data.source === 'live'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }
            >
              {data.source === 'live' ? 'tempo real' : 'simulado'}
            </Badge>
          ) : null}
          {lastUpdate ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <RefreshCw
                className={polling ? 'size-3 animate-spin' : 'size-3'}
                aria-hidden
              />
              {lastUpdate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          ) : null}
        </>
      }
    >
      {error && !data ? (
        <ErrorBlock message={error} onRetry={() => load(false)} />
      ) : null}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Salas ativas"
          value={loading && !data ? <Skeleton className="h-8 w-12" /> : game?.activeRooms ?? 0}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Conexões ativas"
          value={loading && !data ? <Skeleton className="h-8 w-12" /> : game?.activeConnections ?? 0}
          icon={<Wifi className="size-4" />}
        />
        <KpiCard
          label="Pico de conexões"
          value={loading && !data ? <Skeleton className="h-8 w-12" /> : game?.peakConnections ?? 0}
          icon={<TrendingUp className="size-4" />}
        />
        <KpiCard
          label="Memória"
          value={
            loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              `${sys?.memoryMb ?? 0} MB`
            )
          }
          icon={<MemoryStick className="size-4" />}
        />
        <KpiCard
          label="Uptime"
          value={
            loading && !data ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-base">{formatUptime(data?.uptimeMs ?? 0)}</span>
            )
          }
          icon={<Clock className="size-4" />}
        />
        <KpiCard
          label="CPU load"
          value={
            loading && !data ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              `${Math.round((sys?.cpuLoad ?? 0) * 100)}%`
            )
          }
          hint={`${sys?.nodeVersion ?? '—'} · ${sys?.platform ?? '—'}`}
          icon={<Cpu className="size-4" />}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4" aria-hidden />
              Salas e conexões ao longo do tempo
            </CardTitle>
            <CardDescription>
              Histórico dos últimos snapshots (poll a cada 3s).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full" aria-label="Gráfico de salas e conexões">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="t"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={32}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--popover-foreground)',
                      }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeRooms"
                      name="Salas"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeConnections"
                      name="Conexões"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Aguardando dados de histórico…
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MemoryStick className="size-4" aria-hidden />
              Memória do sistema (MB)
            </CardTitle>
            <CardDescription>
              Consumo de memória do processo ao longo do tempo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full" aria-label="Gráfico de memória">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="t"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={32}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--popover-foreground)',
                      }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(v: number) => [`${v} MB`, 'Memória']}
                    />
                    <Area
                      type="monotone"
                      dataKey="memoryMb"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      fill="url(#memGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Aguardando dados de histórico…
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banco de dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4" aria-hidden />
            Banco de dados
          </CardTitle>
          <CardDescription>
            Contadores e tamanho do SQLite local.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Partidas" value={db?.totalGames ?? 0} />
              <MiniStat label="Ativas" value={db?.activeGames ?? 0} />
              <MiniStat label="Aguardando" value={db?.waitingGames ?? 0} />
              <MiniStat label="Finalizadas" value={db?.finishedGames ?? 0} />
              <MiniStat label="Jogadores" value={db?.totalPlayers ?? 0} />
              <MiniStat label="Jogadas" value={db?.totalMoves ?? 0} />
              <MiniStat label="Palavras aprovadas" value={db?.approvedWords ?? 0} />
              <MiniStat label="Palavras banidas" value={db?.bannedWords ?? 0} />
              <div className="col-span-2 rounded-lg border bg-card/50 p-3 sm:col-span-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tamanho do banco
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatBytes(Math.round((db?.dbSizeMb ?? 0) * 1024 * 1024))}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({(db?.dbSizeMb ?? 0).toFixed(2)} MB)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo do game-server */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Total de conexões"
          value={game?.totalConnections ?? 0}
          hint="Desde o início"
        />
        <KpiCard
          label="Reconexões"
          value={game?.reconnections ?? 0}
          hint="Sessões retomadas"
        />
        <KpiCard
          label="Rate-limited"
          value={game?.rateLimited ?? 0}
          hint="Conexões limitadas"
        />
        <KpiCard
          label="Memória game-server"
          value={`${game?.memoryMb ?? 0} MB`}
          hint={game?.source === 'live' ? 'tempo real' : 'simulado'}
        />
      </div>
    </SectionShell>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
