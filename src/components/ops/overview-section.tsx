'use client';

import * as React from 'react';
import { LayoutDashboard, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionShell, ErrorBlock } from '@/components/ops/section-shell';
import {
  TaskStatusBadge,
  OwnerBadge,
} from '@/components/ops/status-badge';
import {
  fetchPhase0Status,
  OpsApiError,
  type Phase0Status,
} from '@/lib/ops/client';

export function OverviewSection() {
  const [data, setData] = React.useState<Phase0Status | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    try {
      const d = await fetchPhase0Status();
      setData(d);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      const msg =
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro desconhecido.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const safeLoad = () => {
      if (!mounted) return;
      load();
    };
    safeLoad();
    const interval = setInterval(safeLoad, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [load]);

  return (
    <SectionShell
      id="visao-geral"
      title="Visão geral"
      description="Estado consolidado da Fase 0 — Fundação e preparação e progresso rumo ao marco M0. Atualização automática a cada 15 segundos."
      icon={<LayoutDashboard className="size-5" />}
      actions={
        <>
          {lastUpdate ? (
            <span className="text-xs text-muted-foreground" role="status">
              Atualizado às{' '}
              {lastUpdate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Recarregar visão geral"
          >
            <RefreshCw
              className={loading ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden
            />
            Atualizar
          </Button>
        </>
      }
    >
      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : null}

      {/* Progresso geral + critérios M0 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Progresso geral da Fase 0</CardTitle>
            <CardDescription>
              {data ? data.phase : 'Carregando…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading && !data ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">
                  {data?.overallProgress ?? 0}
                </span>
                <span className="text-lg text-muted-foreground">%</span>
              </div>
            )}
            <Progress value={data?.overallProgress ?? 0} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Marco: <span className="font-mono">{data?.milestone ?? '—'}</span>
              </span>
              <span>{data?.weeks ?? '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Critérios de saída do M0</CardTitle>
            <CardDescription>
              Condições para declarar o marco concluído.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data?.exitCriteria.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2 rounded-lg border bg-card/50 p-3"
                  >
                    {c.met ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 size-4 shrink-0 text-rose-500"
                        aria-hidden
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-tight">
                        {c.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {c.id}
                      </span>
                    </div>
                    <span className="ml-auto self-center text-xs font-medium">
                      {c.met ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Atendido
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          Pendente
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de tarefas 0.1–0.7 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Entregáveis da Fase 0</CardTitle>
          <CardDescription>
            7 tarefas mapeadas para os entregáveis 0.1 a 0.7.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !data ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Esforço
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 min-w-[140px]">
                      Progresso
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 font-mono text-xs">
                        {t.id}
                      </TableCell>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>
                        <OwnerBadge owner={t.owner} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {t.effort}
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-2">
                          <Progress value={t.progress} className="h-2" />
                          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {t.progress}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
