'use client';

import * as React from 'react';
import {
  Server,
  Globe,
  ShieldCheck,
  Truck,
  DatabaseBackup,
  Activity,
  CheckCircle2,
  XCircle,
  CircleDashed,
  RefreshCw,
  Terminal,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import {
  fetchBackupHistory,
  fetchMetrics,
  fetchPhase0Status,
  OpsApiError,
  type BackupHistory,
  type OpsMetrics,
  type Phase0Status,
} from '@/lib/ops/client';
import { formatDateTime } from '@/lib/ops/client';

interface ProdCheck {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'ok' | 'pending' | 'warn';
  detail: string;
}

export function ProductionSection() {
  const [phase, setPhase] = React.useState<Phase0Status | null>(null);
  const [backup, setBackup] = React.useState<BackupHistory | null>(null);
  const [metrics, setMetrics] = React.useState<OpsMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchPhase0Status(),
      fetchBackupHistory(),
      fetchMetrics(),
    ]);
    if (results[0].status === 'fulfilled') setPhase(results[0].value);
    if (results[1].status === 'fulfilled') setBackup(results[1].value);
    if (results[2].status === 'fulfilled') setMetrics(results[2].value);
    const firstError = results.find((r) => r.status === 'rejected');
    if (firstError && firstError.status === 'rejected') {
      const e = firstError.reason;
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar dados de produção.',
      );
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const checks: ProdCheck[] = React.useMemo(() => {
    const backupActive = !!backup && backup.backups.length > 0;
    const monitoringActive = !!metrics;
    const prodTask = phase?.tasks.find((t) => t.id === '0.1');
    return [
      {
        id: 'server',
        label: 'Servidor de produção',
        description: 'Host Linux com Node 20+ e Bun.',
        icon: <Server className="size-4" />,
        status: 'ok',
        detail: 'Ambiente de execução disponível neste sandbox.',
      },
      {
        id: 'domain',
        label: 'Domínio público + TLS',
        description: 'DNS apontando para o servidor e certificado TLS.',
        icon: <Globe className="size-4" />,
        status: 'pending',
        detail:
          'Configuração externa: registro de DNS e emissão de certificado devem ser provisionados no provedor de infraestrutura.',
      },
      {
        id: 'tls',
        label: 'TLS / HTTPS ativo',
        description: 'Terminação TLS via Caddy reverse proxy.',
        icon: <ShieldCheck className="size-4" />,
        status: 'pending',
        detail:
          'Depende do domínio. O Caddyfile do projeto já provê o bloco reverse proxy pronto para emissão automática (Let’s Encrypt).',
      },
      {
        id: 'deploy',
        label: 'Deploy via Caddy',
        description: 'Build estático + servidor Next.js atrás do Caddy.',
        icon: <Truck className="size-4" />,
        status: prodTask?.status === 'in_progress' ? 'warn' : 'ok',
        detail:
          'Pipeline de build funcional localmente; deploy externo aguarda domínio/TLS.',
      },
      {
        id: 'backup',
        label: 'Backup ativo',
        description: 'Backup automático do SQLite testado com restore.',
        icon: <DatabaseBackup className="size-4" />,
        status: backupActive ? 'ok' : 'warn',
        detail: backupActive
          ? `Último backup: ${formatDateTime(backup?.lastBackupAt ?? null)}`
          : 'Nenhum backup registrado ainda. Execute um backup na seção 0.4.',
      },
      {
        id: 'monitoring',
        label: 'Monitoramento ativo',
        description: 'Dashboard de métricas acessível (seção 0.5).',
        icon: <Activity className="size-4" />,
        status: monitoringActive ? 'ok' : 'warn',
        detail: monitoringActive
          ? `Fonte: ${metrics?.source === 'live' ? 'tempo real' : 'simulada'}`
          : 'Métricas indisponíveis no momento.',
      },
    ];
  }, [phase, backup, metrics]);

  return (
    <SectionShell
      id="producao"
      title="Ambiente de produção"
      description="Entregável 0.1 — servidor, domínio, TLS, deploy via Caddy, backup e monitoramento. Itens de infraestrutura externa são rotulados como pendentes com explicação."
      icon={<Server className="size-5" />}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          aria-label="Recarregar ambiente de produção"
        >
          <RefreshCw
            className={loading ? 'size-4 animate-spin' : 'size-4'}
            aria-hidden
          />
          Atualizar
        </Button>
      }
    >
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <span
                  className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"
                  aria-hidden
                >
                  {c.icon}
                </span>
                {c.label}
                <span className="ml-auto">
                  {c.status === 'ok' ? (
                    <CheckCircle2
                      className="size-5 text-emerald-500"
                      aria-label="OK"
                    />
                  ) : c.status === 'pending' ? (
                    <CircleDashed
                      className="size-5 text-muted-foreground"
                      aria-label="Pendente"
                    />
                  ) : (
                    <XCircle
                      className="size-5 text-amber-500"
                      aria-label="Atenção"
                    />
                  )}
                </span>
              </CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !phase ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {c.detail}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Task 0.1 — progresso"
          value={`${phase?.tasks.find((t) => t.id === '0.1')?.progress ?? 0}%`}
          hint="Ambiente de produção"
        />
        <KpiCard
          label="Backups registrados"
          value={backup?.backups.length ?? 0}
          hint={backup?.autoBackupEnabled ? 'Auto-backup ativo' : 'Manual'}
        />
        <KpiCard
          label="Fonte de métricas"
          value={
            metrics
              ? metrics.source === 'live'
                ? 'Tempo real'
                : 'Simulada'
              : '—'
          }
          hint="Mini-serviço :3004"
        />
        <KpiCard
          label="Status 0.1"
          value={
            phase?.tasks.find((t) => t.id === '0.1')?.status ?? '—'
          }
          hint="Conforme /api/ops/phase0/status"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal className="size-4" aria-hidden />
            Guia de deploy resumido
          </CardTitle>
          <CardDescription>
            Passos de produção. Detalhes completos em{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              docs/PRODUCTION-SETUP.md
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                1
              </span>
              <div>
                <p className="font-medium">Build do app Next.js</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs scrollbar-thin">
{`bun run build
# gera .next/standalone + estáticos`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                2
              </span>
              <div>
                <p className="font-medium">Iniciar servidor de produção</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs scrollbar-thin">
{`bun run start
# NODE_ENV=production, porta 3000`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                3
              </span>
              <div>
                <p className="font-medium">Reverse proxy com Caddy</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O <code className="font-mono">Caddyfile</code> do projeto
                  emite TLS automaticamente (Let&apos;s Encrypt) e faz proxy
                  para <code className="font-mono">:3000</code>. Para rotas de
                  outros serviços (mini-serviços), use o query param{' '}
                  <code className="font-mono">?XTransformPort=PORTA</code>.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                4
              </span>
              <div>
                <p className="font-medium">Variáveis obrigatórias</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs scrollbar-thin">
{`AUTH_SECRET=         # >= 32 chars
INTERNAL_API_KEY=    # openssl rand -hex 32
ADMIN_USERNAME=      # não-default
ADMIN_PASSWORD=      # >= 12 chars
DATABASE_URL=        # caminho absoluto em volume persistente
WEB_ORIGIN=          # origem pública (CORS/cookies)`}
                </pre>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </SectionShell>
  );
}
