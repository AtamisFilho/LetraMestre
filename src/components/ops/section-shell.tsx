'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionShellProps {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper reutilizável para cada seção do Console de Operações.
 * Provê título, descrição, área de ações e conteúdo com transição
 * framer-motion sutil ao trocar de seção.
 */
export function SectionShell({
  id,
  title,
  description,
  icon,
  actions,
  children,
  className,
}: SectionShellProps) {
  return (
    <motion.section
      key={id}
      id={id}
      role="region"
      aria-label={title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn('flex flex-col gap-6', className)}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon ? (
            <span
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h2>
            {description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>

      <div className="flex flex-col gap-6">{children}</div>
    </motion.section>
  );
}

/** Cartão KPI simples, usado por várias seções. */
interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function KpiCard({ label, value, hint, icon, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 text-card-foreground shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** Estado de "carregando" genérico com skeleton. */
export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" role="status">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-accent"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Bloco de erro graceful — nunca quebra a página. */
export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <span className="font-medium">Não foi possível carregar os dados.</span>
      <span className="text-xs opacity-80">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 self-start rounded-md border border-amber-400/60 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
