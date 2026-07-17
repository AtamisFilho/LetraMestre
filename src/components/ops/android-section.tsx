'use client';

import * as React from 'react';
import {
  Smartphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileBox,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import { BuildStatusBadge } from '@/components/ops/status-badge';
import {
  fetchAndroidBuildStatus,
  validateAndroidBuild,
  OpsApiError,
  type AndroidBuildStatus,
} from '@/lib/ops/client';
import { formatDateTime } from '@/lib/ops/client';

export function AndroidSection() {
  const [data, setData] = React.useState<AndroidBuildStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [validating, setValidating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAndroidBuildStatus();
      setData(d);
    } catch (e) {
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar status do build Android.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const d = await validateAndroidBuild();
      setData(d);
      toast.success('Validação concluída.', {
        description:
          d.status === 'pass'
            ? 'Configuração do build íntegra.'
            : `Status: ${d.status}`,
      });
    } catch (e) {
      const msg =
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao validar.';
      toast.error('Falha na validação.', { description: msg });
    } finally {
      setValidating(false);
    }
  };

  return (
    <SectionShell
      id="android"
      title="Build Android"
      description="Entregável 0.3 — validação da configuração do build (./gradlew assembleDebug). A compilação real do APK requer Android SDK e roda em CI dedicado (.github/workflows/android.yml); esta validação confere a integridade da configuração."
      icon={<Smartphone className="size-5" />}
      actions={
        <Button
          variant="default"
          size="sm"
          onClick={handleValidate}
          disabled={validating}
          aria-label="Validar build Android"
        >
          <RefreshCw
            className={validating ? 'size-4 animate-spin' : 'size-4'}
            aria-hidden
          />
          {validating ? 'Validando…' : 'Validar build'}
        </Button>
      }
    >
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Status"
          value={data ? <BuildStatusBadge status={data.status} /> : '—'}
          hint="Configuração atual"
        />
        <KpiCard
          label="Última execução"
          value={
            loading && !data ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              formatDateTime(data?.lastRun ?? null)
            )
          }
          hint="Validação registrada"
        />
        <KpiCard
          label="Duração"
          value={`${data?.durationMs ?? 0} ms`}
          hint="Tempo da validação"
        />
        <KpiCard
          label="Artefato APK"
          value={
            data?.artifact ? (
              <Badge variant="outline" className="gap-1">
                <FileBox className="size-3" aria-hidden />
                {data.artifact}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          hint="Gerado apenas em CI"
        />
      </div>

      {data?.blocker ? (
        <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Bloqueador</AlertTitle>
          <AlertDescription>{data.blocker}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Etapas da validação</CardTitle>
            <CardDescription>
              Cada etapa da checagem de config do build.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading && !data ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              data?.steps.map((step) => (
                <div
                  key={step.name}
                  className="flex items-start gap-3 rounded-lg border bg-card/50 p-3"
                >
                  {step.ok ? (
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
                    <span className="text-sm font-medium">{step.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {step.detail}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Log de validação</CardTitle>
            <CardDescription>Saída bruta da checagem.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre
              className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed scrollbar-thin"
              aria-label="Log de validação do build Android"
            >
              {loading && !data
                ? 'Carregando…'
                : data?.log?.trim() || 'Sem saída.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
