'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  TaskStatus,
  SecretStrength,
  SecretOverall,
  BuildStatus,
  DebtSeverity,
  DebtStatus,
  ReleaseType,
} from '@/lib/ops/client';

type Tone = 'emerald' | 'amber' | 'rose' | 'muted' | 'teal' | 'violet';

const toneClass: Record<Tone, string> = {
  emerald:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  muted:
    'border-border bg-muted text-muted-foreground',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  violet:
    'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(toneClass[tone], className)}>
      {children}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { tone: Tone; label: string }> = {
    done: { tone: 'emerald', label: 'Concluída' },
    in_progress: { tone: 'amber', label: 'Em andamento' },
    blocked: { tone: 'rose', label: 'Bloqueada' },
    pending: { tone: 'muted', label: 'Pendente' },
  };
  const { tone, label } = map[status];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function SecretStrengthBadge({ strength }: { strength: SecretStrength }) {
  const map: Record<SecretStrength, { tone: Tone; label: string }> = {
    strong: { tone: 'emerald', label: 'Forte' },
    weak: { tone: 'amber', label: 'Fraca' },
    missing: { tone: 'rose', label: 'Ausente' },
  };
  const { tone, label } = map[strength];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function SecretOverallBadge({ overall }: { overall: SecretOverall }) {
  const map: Record<SecretOverall, { tone: Tone; label: string }> = {
    ok: { tone: 'emerald', label: 'OK' },
    warning: { tone: 'amber', label: 'Atenção' },
    critical: { tone: 'rose', label: 'Crítico' },
  };
  const { tone, label } = map[overall];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function BuildStatusBadge({ status }: { status: BuildStatus }) {
  const map: Record<BuildStatus, { tone: Tone; label: string }> = {
    pass: { tone: 'emerald', label: 'Sucesso' },
    fail: { tone: 'rose', label: 'Falha' },
    blocked: { tone: 'amber', label: 'Bloqueado' },
    pending: { tone: 'muted', label: 'Pendente' },
  };
  const { tone, label } = map[status];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function DebtSeverityBadge({ severity }: { severity: DebtSeverity }) {
  const map: Record<DebtSeverity, { tone: Tone; label: string }> = {
    high: { tone: 'rose', label: 'Alta' },
    medium: { tone: 'amber', label: 'Média' },
    low: { tone: 'muted', label: 'Baixa' },
  };
  const { tone, label } = map[severity];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  const map: Record<DebtStatus, { tone: Tone; label: string }> = {
    open: { tone: 'amber', label: 'Em aberto' },
    closed: { tone: 'emerald', label: 'Fechada' },
  };
  const { tone, label } = map[status];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function ReleaseTypeBadge({ type }: { type: ReleaseType }) {
  const map: Record<ReleaseType, { tone: Tone; label: string }> = {
    major: { tone: 'rose', label: 'major' },
    minor: { tone: 'teal', label: 'minor' },
    patch: { tone: 'muted', label: 'patch' },
  };
  const { tone, label } = map[type];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function BoolBadge({ ok, okLabel = 'Sim', noLabel = 'Não' }: { ok: boolean; okLabel?: string; noLabel?: string }) {
  return ok ? (
    <ToneBadge tone="emerald">{okLabel}</ToneBadge>
  ) : (
    <ToneBadge tone="rose">{noLabel}</ToneBadge>
  );
}

export function OwnerBadge({ owner }: { owner: string }) {
  return (
    <ToneBadge tone="violet" className="font-mono">
      {owner}
    </ToneBadge>
  );
}
