'use client';

import * as React from 'react';
import {
  DatabaseBackup,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import {
  fetchBackupHistory,
  restoreBackup,
  runBackup,
  OpsApiError,
  formatBytes,
  formatDateTime,
  type BackupHistory,
} from '@/lib/ops/client';

export function BackupSection() {
  const [data, setData] = React.useState<BackupHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchBackupHistory();
      setData(d);
    } catch (e) {
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar histórico de backups.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await runBackup();
      toast.success('Backup executado com sucesso.', {
        description: `${res.filename} · ${formatBytes(res.sizeBytes)} · ${res.durationMs}ms`,
      });
      await load();
    } catch (e) {
      const msg =
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro desconhecido.';
      toast.error('Falha ao executar backup.', { description: msg });
    } finally {
      setRunning(false);
    }
  };

  const handleRestore = async (id: string, filename: string) => {
    setRestoringId(id);
    try {
      const res = await restoreBackup(id);
      toast.success('Restore testado com sucesso.', {
        description: `${filename} restaurado (${formatBytes(res.sizeBytes)}).`,
      });
      await load();
    } catch (e) {
      const msg =
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro desconhecido.';
      toast.error('Falha no restore.', { description: msg });
    } finally {
      setRestoringId(null);
    }
  };

  const last = data?.backups[0];

  return (
    <SectionShell
      id="backup"
      title="Backup do banco SQLite"
      description="Entregável 0.4 — backups manuais e agendados, com teste de restore."
      icon={<DatabaseBackup className="size-5" />}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Recarregar histórico de backup"
          >
            <RefreshCw
              className={loading ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden
            />
            Atualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRun}
            disabled={running}
            aria-label="Executar backup agora"
          >
            <Play className="size-4" aria-hidden />
            {running ? 'Executando…' : 'Backup agora'}
          </Button>
        </>
      }
    >
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Último backup"
          value={
            loading && !data ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              formatDateTime(data?.lastBackupAt ?? null)
            )
          }
          hint={last ? last.filename : 'Sem backups'}
        />
        <KpiCard
          label="Tamanho total"
          value={
            loading && !data ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatBytes(data?.totalSizeBytes ?? 0)
            )
          }
          hint={`${data?.backups.length ?? 0} arquivo(s)`}
        />
        <KpiCard
          label="Auto-backup"
          value={
            data?.autoBackupEnabled ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Ativo
              </span>
            ) : (
              <span className="text-muted-foreground">Inativo</span>
            )
          }
          hint={data?.schedule ?? '—'}
        />
        <KpiCard
          label="Agendamento"
          value={data?.schedule ?? '—'}
          hint="Cron interno"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de backups</CardTitle>
          <CardDescription>
            Últimos backups disponíveis em <code className="font-mono">backups/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !data ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : data && data.backups.length > 0 ? (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Arquivo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Verificado</TableHead>
                    <TableHead className="pr-6 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.backups.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="pl-6 font-mono text-xs">
                        {b.filename}
                      </TableCell>
                      <TableCell>{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatBytes(b.sizeBytes)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {b.durationMs}ms
                      </TableCell>
                      <TableCell>
                        {b.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            sim
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            não
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(b.id, b.filename)}
                          disabled={restoringId === b.id}
                          aria-label={`Testar restore de ${b.filename}`}
                        >
                          <RotateCcw
                            className={
                              restoringId === b.id
                                ? 'size-3.5 animate-spin'
                                : 'size-3.5'
                            }
                            aria-hidden
                          />
                          {restoringId === b.id ? 'Restaurando…' : 'Restore'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="px-6 pb-2 text-sm text-muted-foreground">
              Nenhum backup registrado. Clique em <strong>Backup agora</strong>{' '}
              para criar o primeiro.
            </div>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
