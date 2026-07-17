'use client';

import * as React from 'react';
import {
  Bug,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  FileCode2,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import {
  DebtSeverityBadge,
  DebtStatusBadge,
} from '@/components/ops/status-badge';
import {
  closeDebt,
  fetchDebtItems,
  OpsApiError,
  formatDateTime,
  type DebtItem,
  type DebtList,
} from '@/lib/ops/client';

export function DebtSection() {
  const [data, setData] = React.useState<DebtList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showClosed, setShowClosed] = React.useState(false);

  // Dialog de fechamento
  const [closingItem, setClosingItem] = React.useState<DebtItem | null>(null);
  const [resolution, setResolution] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchDebtItems();
      setData(d);
    } catch (e) {
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar débitos técnicos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openClose = (item: DebtItem) => {
    setClosingItem(item);
    setResolution('');
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingItem) return;
    if (!resolution.trim()) {
      toast.error('Descreva a resolução adotada.');
      return;
    }
    setSubmitting(true);
    try {
      await closeDebt({
        id: closingItem.id,
        resolution: resolution.trim(),
      });
      toast.success('Dívida técnica fechada.', {
        description: closingItem.title,
      });
      setClosingItem(null);
      setResolution('');
      await load();
    } catch (err) {
      const msg =
        err instanceof OpsApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
          : 'Erro desconhecido.';
      toast.error('Falha ao fechar dívida.', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const openItems = data?.items.filter((i) => i.status === 'open') ?? [];
  const closedItems = data?.items.filter((i) => i.status === 'closed') ?? [];

  return (
    <SectionShell
      id="divida"
      title="Dívida técnica"
      description="Entregável 0.7 — itens herdados do worklog, com fechamento auditável."
      icon={<Bug className="size-5" />}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          aria-label="Recarregar dívidas técnicas"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Em aberto"
          value={loading && !data ? <Skeleton className="h-8 w-12" /> : data?.openCount ?? 0}
          hint="Requer atenção"
        />
        <KpiCard
          label="Fechadas"
          value={loading && !data ? <Skeleton className="h-8 w-12" /> : data?.closedCount ?? 0}
          hint="Resolvidas"
        />
        <KpiCard
          label="Total"
          value={
            loading && !data ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              (data?.openCount ?? 0) + (data?.closedCount ?? 0)
            )
          }
          hint="Catálogo"
        />
      </div>

      {/* Em aberto */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Em aberto
        </h3>
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : openItems.length > 0 ? (
          openItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <DebtSeverityBadge severity={item.severity} />
                      <Badge variant="outline" className="font-mono">
                        {item.area}
                      </Badge>
                      <DebtStatusBadge status={item.status} />
                    </div>
                    <h4 className="text-base font-semibold leading-tight">
                      {item.title}
                    </h4>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openClose(item)}
                    aria-label={`Fechar dívida ${item.title}`}
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    Fechar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FileCode2 className="size-3.5" aria-hidden />
                    <code className="font-mono">{item.file}</code>
                  </span>
                  <span>Registrada em {formatDateTime(item.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma dívida em aberto. Tudo certo por aqui!
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fechadas — colapsável */}
      {closedItems.length > 0 ? (
        <Collapsible
          open={showClosed}
          onOpenChange={setShowClosed}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Fechadas ({closedItems.length})
            </h3>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Mostrar/esconder fechadas">
                <ChevronDown
                  className={
                    showClosed
                      ? 'size-4 rotate-180 transition-transform'
                      : 'size-4 transition-transform'
                  }
                  aria-hidden
                />
                {showClosed ? 'Ocultar' : 'Mostrar'}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="flex flex-col gap-3">
            {closedItems.map((item) => (
              <Card key={item.id} className="opacity-80">
                <CardContent className="flex flex-col gap-2 pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DebtSeverityBadge severity={item.severity} />
                    <Badge variant="outline" className="font-mono">
                      {item.area}
                    </Badge>
                    <DebtStatusBadge status={item.status} />
                  </div>
                  <h4 className="text-base font-semibold leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  {item.resolution ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                      <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Resolução
                      </span>
                      <p className="mt-1 text-foreground">{item.resolution}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileCode2 className="size-3.5" aria-hidden />
                      <code className="font-mono">{item.file}</code>
                    </span>
                    {item.closedAt ? (
                      <span>Fechada em {formatDateTime(item.closedAt)}</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {/* Dialog de fechamento */}
      <Dialog
        open={!!closingItem}
        onOpenChange={(o) => {
          if (!o) {
            setClosingItem(null);
            setResolution('');
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleClose} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Fechar dívida técnica</DialogTitle>
              <DialogDescription>
                {closingItem?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="resolution">Resolução aplicada</Label>
              <Textarea
                id="resolution"
                placeholder="Descreva como a dívida foi resolvida…"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Será registrado em <code className="font-mono">closedAt</code> e
                visível na seção de fechadas.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setClosingItem(null);
                  setResolution('');
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Fechando…' : 'Fechar dívida'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
