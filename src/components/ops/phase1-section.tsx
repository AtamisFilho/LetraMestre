'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  KeyRound,
  Globe,
  Trophy,
} from 'lucide-react';

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionShell, ErrorBlock } from '@/components/ops/section-shell';
import { OwnerBadge } from '@/components/ops/status-badge';
import { Badge } from '@/components/ui/badge';

import {
  fetchPhase1Status,
  fetchPhase1Players,
  playerInitials,
  providerLabel,
  PlayerApiError,
  type Phase1Status,
  type Phase1PlayersList,
  type Phase1Task,
  type PlayerProvider,
} from '@/lib/auth-player-client';

/** Status local da Fase 1 — inclui 'na' (não aplicável). */
function Phase1TaskStatusBadge({ status }: { status: Phase1Task['status'] }) {
  const toneClass: Record<Phase1Task['status'], string> = {
    done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    in_progress: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    blocked: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    pending: 'border-border bg-muted text-muted-foreground',
    na: 'border-border bg-muted/60 text-muted-foreground',
  };
  const label: Record<Phase1Task['status'], string> = {
    done: 'Concluída',
    in_progress: 'Em andamento',
    blocked: 'Bloqueada',
    pending: 'Pendente',
    na: 'N/A',
  };
  return (
    <Badge variant="outline" className={toneClass[status]}>
      {label[status]}
    </Badge>
  );
}

function ProviderBadge({ provider }: { provider: PlayerProvider }) {
  const tone =
    provider === 'google'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : provider === 'both'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : 'border-border bg-muted text-muted-foreground';
  return (
    <Badge variant="outline" className={tone}>
      {providerLabel(provider)}
    </Badge>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
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

export function Phase1Section() {
  const [status, setStatus] = React.useState<Phase1Status | null>(null);
  const [players, setPlayers] = React.useState<Phase1PlayersList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        fetchPhase1Status(),
        fetchPhase1Players(),
      ]);
      setStatus(s);
      setPlayers(p);
      setLastUpdate(new Date());
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro desconhecido.';
      // Provável backend ainda não implementou — mostrar mensagem clara.
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const safeLoad = () => {
      if (!mounted) return;
      void load();
    };
    safeLoad();
    return () => {
      mounted = false;
    };
  }, [load]);

  return (
    <SectionShell
      id="fase1"
      title="Contas de jogador (Fase 1)"
      description="Marco M1 — Semanas 3-6: registro/login, sessão persistente, partidas vinculadas e perfil com avatar + stats. Endpoints /api/auth/player/*, /api/player/*, /api/ops/phase1/*."
      icon={<Users className="size-5" />}
      actions={
        <>
          {lastUpdate ? (
            <span className="text-xs text-muted-foreground" role="status">
              Atualizado às{' '}
              {lastUpdate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Recarregar contas Fase 1"
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
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      {/* Linha 1: progresso M1 + critérios */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Progresso da Fase 1</CardTitle>
            <CardDescription>
              {status ? status.phase : 'Carregando…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading && !status ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">
                  {status?.overallProgress ?? 0}
                </span>
                <span className="text-lg text-muted-foreground">%</span>
              </div>
            )}
            <Progress value={status?.overallProgress ?? 0} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Marco:{' '}
                <span className="font-mono">{status?.milestone ?? '—'}</span>
              </span>
              <span>{status?.weeks ?? 'Semanas 3-6'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Critérios de saída do M1</CardTitle>
            <CardDescription>
              Condições para declarar o marco concluído.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !status ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {status?.exitCriteria.map((c) => (
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

      {/* Linha 2: KPIs de contas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total de contas"
          value={players?.total ?? '—'}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Com senha"
          value={players?.withPassword ?? '—'}
          icon={<KeyRound className="size-4" />}
        />
        <KpiCard
          label="Com Google"
          value={players?.withGoogle ?? '—'}
          icon={<Globe className="size-4" />}
        />
        <KpiCard
          label="Vitórias registradas"
          value={
            players?.players.reduce((acc, p) => acc + p.gamesWon, 0) ?? '—'
          }
          icon={<Trophy className="size-4" />}
        />
      </div>

      {/* Linha 3: Tabela de contas + Tabela de tarefas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contas cadastradas</CardTitle>
          <CardDescription>
            Lista de PlayerAccount (resumo) — rota{' '}
            <code className="font-mono text-[11px]">/api/ops/phase1/players</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !players ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : players && players.players.length > 0 ? (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Jogador</TableHead>
                    <TableHead className="hidden md:table-cell">
                      E-mail
                    </TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-center">Partidas</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">
                      Vitórias
                    </TableHead>
                    <TableHead className="hidden lg:table-cell pr-6">
                      Último login
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.players.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 border">
                            {p.avatarUrl ? (
                              <AvatarImage
                                src={p.avatarUrl}
                                alt={`Avatar de ${p.displayName}`}
                              />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                              {playerInitials(p.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col leading-tight">
                            <span className="text-sm font-medium">
                              {p.displayName}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              @{p.username}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {p.email}
                      </TableCell>
                      <TableCell>
                        <ProviderBadge provider={p.provider} />
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {p.gamesPlayed}
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden sm:table-cell">
                        {p.gamesWon}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell pr-6 text-xs text-muted-foreground">
                        {formatDate(p.lastLoginAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="px-6 pb-6 pt-2 text-center text-sm text-muted-foreground">
              Nenhuma conta cadastrada ainda. Alterne para o modo “Jogador” no
              cabeçalho para criar a primeira conta.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tarefas da Fase 1</CardTitle>
          <CardDescription>
            10 tarefas (1.1 a 1.10) mapeadas aos entregáveis M1.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !status ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
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
                  {status?.tasks.map((t) => (
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
                        <Phase1TaskStatusBadge status={t.status} />
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

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    </motion.div>
  );
}
