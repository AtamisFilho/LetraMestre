'use client';

import * as React from 'react';
import { KeyRound, RefreshCw, AlertTriangle, Check, X } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SectionShell, ErrorBlock } from '@/components/ops/section-shell';
import {
  SecretOverallBadge,
  SecretStrengthBadge,
} from '@/components/ops/status-badge';
import {
  fetchSecretsStatus,
  OpsApiError,
  type SecretsStatus,
} from '@/lib/ops/client';

export function SecretsSection() {
  const [data, setData] = React.useState<SecretsStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchSecretsStatus();
      setData(d);
    } catch (e) {
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar secrets.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRevalidate = async () => {
    try {
      await load();
      toast.success('Secrets revalidados.');
    } catch {
      toast.error('Falha ao revalidar secrets.');
    }
  };

  const overall = data?.overall;
  const showAlert = overall && overall !== 'ok';

  return (
    <SectionShell
      id="secrets"
      title="Secrets"
      description="Entregável 0.2 — validação de variáveis sensíveis (presença, força e recomendações)."
      icon={<KeyRound className="size-5" />}
      actions={
        <>
          {overall ? <SecretOverallBadge overall={overall} /> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevalidate}
            disabled={loading}
            aria-label="Revalidar secrets"
          >
            <RefreshCw
              className={loading ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden
            />
            Validar novamente
          </Button>
        </>
      }
    >
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      {showAlert ? (
        <Alert
          variant={overall === 'critical' ? 'destructive' : 'default'}
          className="border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>
            {overall === 'critical'
              ? 'Configuração crítica de secrets'
              : 'Secrets com ressalvas'}
          </AlertTitle>
          <AlertDescription>
            Um ou mais secrets obrigatórios estão ausentes ou usam valores
            padrão fracos. Corrija antes de qualquer deploy de produção
            seguindo as recomendações da tabela abaixo.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Variáveis de ambiente</CardTitle>
          <CardDescription>
            Validação server-side contra o ambiente em execução.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !data ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Nome</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Presente</TableHead>
                    <TableHead>Força</TableHead>
                    <TableHead className="pr-6">Problema / recomendação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.secrets.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="pl-6 font-mono text-xs">
                        {s.name}
                      </TableCell>
                      <TableCell>
                        {s.required ? (
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            sim
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            opcional
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.present ? (
                          <Check
                            className="size-4 text-emerald-500"
                            aria-label="Presente"
                          />
                        ) : (
                          <X
                            className="size-4 text-rose-500"
                            aria-label="Ausente"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <SecretStrengthBadge strength={s.strength} />
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex flex-col gap-0.5">
                          {s.issue ? (
                            <span className="text-xs text-rose-600 dark:text-rose-400">
                              {s.issue}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {s.recommendation}
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
