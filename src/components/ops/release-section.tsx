'use client';

import * as React from 'react';
import { Tag, RefreshCw, Plus } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionShell, ErrorBlock, KpiCard } from '@/components/ops/section-shell';
import { ReleaseTypeBadge } from '@/components/ops/status-badge';
import {
  fetchReleaseChangelog,
  fetchReleaseHistory,
  tagRelease,
  OpsApiError,
  type ReleaseChangelog,
  type ReleaseHistory,
  type ReleaseType,
} from '@/lib/ops/client';

export function ReleaseSection() {
  const [changelog, setChangelog] = React.useState<ReleaseChangelog | null>(null);
  const [history, setHistory] = React.useState<ReleaseHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Form de nova release
  const [open, setOpen] = React.useState(false);
  const [version, setVersion] = React.useState('');
  const [type, setType] = React.useState<ReleaseType>('patch');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchReleaseChangelog(),
      fetchReleaseHistory(),
    ]);
    if (results[0].status === 'fulfilled') setChangelog(results[0].value);
    if (results[1].status === 'fulfilled') setHistory(results[1].value);
    const rejected = results.find((r) => r.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const e = rejected.reason;
      setError(
        e instanceof OpsApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro ao carregar releases.',
      );
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim()) {
      toast.error('Informe a versão (ex.: 0.3.1).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await tagRelease({
        version: version.trim(),
        type,
        notes: notes.trim(),
      });
      toast.success('Release registrada.', {
        description: `${res.tag} · ${res.version}`,
      });
      setVersion('');
      setNotes('');
      setType('patch');
      setOpen(false);
      await load();
    } catch (err) {
      const msg =
        err instanceof OpsApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
          : 'Erro desconhecido.';
      toast.error('Falha ao registrar release.', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionShell
      id="release"
      title="Processo de release"
      description="Entregável 0.6 — versionamento semântico, changelog e registro de tags."
      icon={<Tag className="size-5" />}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Recarregar releases"
          >
            <RefreshCw
              className={loading ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden
            />
            Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" aria-label="Registrar nova release">
                <Plus className="size-4" aria-hidden />
                Nova release
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>Registrar nova release</DialogTitle>
                  <DialogDescription>
                    Cria uma tag no formato <code className="font-mono">vX.Y.Z</code>{' '}
                    e adiciona ao histórico.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="rel-version">Versão</Label>
                  <Input
                    id="rel-version"
                    placeholder="0.3.1"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="rel-type">Tipo</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as ReleaseType)}
                  >
                    <SelectTrigger id="rel-type" className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="major">major</SelectItem>
                      <SelectItem value="minor">minor</SelectItem>
                      <SelectItem value="patch">patch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="rel-notes">Notas</Label>
                  <Textarea
                    id="rel-notes"
                    placeholder="Resumo das mudanças desta release…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Registrando…' : 'Registrar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Versão atual"
          value={
            loading && !changelog ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <span className="font-mono">
                v{changelog?.currentVersion ?? '—'}
              </span>
            )
          }
          hint="Em produção"
        />
        <KpiCard
          label="Próxima planejada"
          value={
            loading && !changelog ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <span className="font-mono text-muted-foreground">
                v{changelog?.nextPlanned ?? '—'}
              </span>
            )
          }
          hint="Próxima release"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Changelog</CardTitle>
          <CardDescription>Histórico de versões documentadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !changelog ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : changelog && changelog.entries.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {changelog.entries.map((entry) => (
                <AccordionItem key={entry.version} value={entry.version}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2 pr-2 text-left">
                      <span className="font-mono font-semibold">
                        v{entry.version}
                      </span>
                      <ReleaseTypeBadge type={entry.type} />
                      <span className="text-xs text-muted-foreground">
                        {entry.date}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        — {entry.summary}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="flex flex-col gap-1.5 pl-1">
                      {entry.changes.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrada de changelog registrada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de releases</CardTitle>
          <CardDescription>
            Tags registradas via <code className="font-mono">POST /api/ops/release/tag</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !history ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : history && history.releases.length > 0 ? (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tag</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Notas
                    </TableHead>
                    <TableHead className="pr-6">Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.releases.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-mono text-xs">
                        {r.tag}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.version}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.date}
                      </TableCell>
                      <TableCell>
                        <ReleaseTypeBadge type={r.type} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-md truncate text-muted-foreground">
                        {r.notes}
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground">
                        {r.releasedBy}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="px-6 pb-2 text-sm text-muted-foreground">
              Nenhuma release registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
