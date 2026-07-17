'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import {
  LayoutDashboard,
  Server,
  KeyRound,
  Smartphone,
  DatabaseBackup,
  Activity,
  Tag,
  Bug,
} from 'lucide-react';

import { OverviewSection } from '@/components/ops/overview-section';
import { ProductionSection } from '@/components/ops/production-section';
import { SecretsSection } from '@/components/ops/secrets-section';
import { AndroidSection } from '@/components/ops/android-section';
import { BackupSection } from '@/components/ops/backup-section';
import { MonitoringSection } from '@/components/ops/monitoring-section';
import { ReleaseSection } from '@/components/ops/release-section';
import { DebtSection } from '@/components/ops/debt-section';

interface SectionDef {
  id: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  Component: React.ComponentType;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    short: 'Visão geral',
    description: 'Estado consolidado da Fase 0 e marco M0.',
    icon: LayoutDashboard,
    Component: OverviewSection,
  },
  {
    id: 'producao',
    label: 'Ambiente de produção',
    short: 'Produção',
    description: 'Entregável 0.1 — servidor, domínio, TLS, deploy.',
    icon: Server,
    Component: ProductionSection,
  },
  {
    id: 'secrets',
    label: 'Secrets',
    short: 'Secrets',
    description: 'Entregável 0.2 — validação de variáveis sensíveis.',
    icon: KeyRound,
    Component: SecretsSection,
  },
  {
    id: 'android',
    label: 'Build Android',
    short: 'Android',
    description: 'Entregável 0.3 — validação do build do APK.',
    icon: Smartphone,
    Component: AndroidSection,
  },
  {
    id: 'backup',
    label: 'Backup SQLite',
    short: 'Backup',
    description: 'Entregável 0.4 — backups e restore.',
    icon: DatabaseBackup,
    Component: BackupSection,
  },
  {
    id: 'monitoramento',
    label: 'Monitoramento',
    short: 'Monitoramento',
    description: 'Entregável 0.5 — métricas em tempo real.',
    icon: Activity,
    Component: MonitoringSection,
  },
  {
    id: 'release',
    label: 'Release',
    short: 'Release',
    description: 'Entregável 0.6 — versionamento e changelog.',
    icon: Tag,
    Component: ReleaseSection,
  },
  {
    id: 'divida',
    label: 'Dívida técnica',
    short: 'Dívida',
    description: 'Entregável 0.7 — fechamento auditável.',
    icon: Bug,
    Component: DebtSection,
  },
];

export default function Home() {
  const [activeId, setActiveId] = React.useState<string>('overview');
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
  const ActiveComponent = active.Component;

  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileOpen(false);
    // Rola o conteúdo para o topo ao trocar de seção.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderNavList = (onNavigate?: (id: string) => void) => (
    <nav aria-label="Seções do console" className="flex flex-col gap-1">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate?.(s.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground',
              )}
              aria-hidden
            />
            <span className="flex flex-col leading-tight">
              <span>{s.label}</span>
              <span
                className={cn(
                  'text-[11px] font-normal',
                  isActive
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground/70',
                )}
              >
                {s.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
      {/* Topo da página: breadcrumb mobile + título */}
      <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Abrir navegação de seções">
              <Menu className="size-4" aria-hidden />
              Seções
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw]">
            <SheetHeader className="px-4 pt-4">
              <SheetTitle>Seções do console</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-3 pb-6 pt-2 scrollbar-thin">
              {renderNavList(handleSelect)}
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Fase 0 · M0
          </span>
          <span className="text-sm font-semibold">{active.short}</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar desktop */}
        <aside
          className="sticky top-20 hidden h-[calc(100vh-6rem)] w-64 shrink-0 md:block"
          aria-label="Navegação lateral"
        >
          <div className="flex h-full flex-col rounded-xl border bg-card p-3 shadow-sm">
            <div className="px-2 pb-2 pt-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Console · Fase 0
              </h2>
            </div>
            <div className="overflow-y-auto pr-1 scrollbar-thin">
              {renderNavList(handleSelect)}
            </div>
            <div className="mt-auto rounded-lg border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">LetraMestre</p>
              <p className="mt-0.5">
                Jogo de palavras PT-BR estilo Scrabble. Console de operações da
                Fase 0.
              </p>
            </div>
          </div>
        </aside>

        {/* Conteúdo da seção ativa */}
        <div className="min-w-0 flex-1">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
