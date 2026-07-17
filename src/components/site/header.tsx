'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Moon,
  Sun,
  Github,
  Activity,
  Settings2,
  UserCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/lib/mode-store';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { mode, setMode, hydrated } = useAppMode();

  React.useEffect(() => setMounted(true), []);

  const isDark = theme === 'dark';
  const isPlayer = hydrated && mode === 'player';

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Logo + nome */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="LetraMestre — Console de Operações"
        >
          <span
            className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm"
            aria-hidden
          >
            <span className="text-lg font-black leading-none">L</span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">
              LetraMestre
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isPlayer ? 'Conta do Jogador' : 'Console de Operações'}
            </span>
          </span>
        </Link>

        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

        <Badge
          variant="outline"
          className={cn(
            'hidden gap-1.5 border-primary/30 bg-primary/10 text-primary sm:inline-flex',
          )}
        >
          <Activity className="size-3" aria-hidden />
          {isPlayer ? 'Fase 1 · M1' : 'Fase 0 · M0'}
        </Badge>

        {/* Seletor de modo (segmented control) */}
        <div
          role="group"
          aria-label="Alternar modo"
          className="ml-auto flex items-center gap-1 rounded-lg border bg-muted/60 p-0.5 sm:ml-2"
        >
          <ModeButton
            active={hydrated && mode === 'ops'}
            onClick={() => setMode('ops')}
            icon={<Settings2 className="size-3.5" aria-hidden />}
            label="Operações"
            compact
          />
          <ModeButton
            active={hydrated && mode === 'player'}
            onClick={() => setMode('player')}
            icon={<UserCircle2 className="size-3.5" aria-hidden />}
            label="Jogador"
            compact
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ver repositório de referência no GitHub"
                asChild
              >
                <Link
                  href="https://github.com/AtamisFilho/LetraMestre"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="size-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Repositório de referência</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
                }
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              >
                {mounted ? (
                  isDark ? (
                    <Sun className="size-4" aria-hidden />
                  ) : (
                    <Moon className="size-4" aria-hidden />
                  )
                ) : (
                  <Sun className="size-4 opacity-0" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {mounted
                ? isDark
                  ? 'Mudar para tema claro'
                  : 'Mudar para tema escuro'
                : 'Alternar tema'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  compact?: boolean;
}

function ModeButton({ active, onClick, icon, label, compact }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'sm:px-3 sm:text-sm' : '',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span className={cn(compact ? 'hidden sm:inline' : 'inline')}>
        {label}
      </span>
    </button>
  );
}
