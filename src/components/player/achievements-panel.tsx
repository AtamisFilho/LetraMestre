'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  Flame,
  Gamepad2,
  Lock,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import {
  fetchPlayerAchievements,
  PlayerApiError,
  type LockedAchievementProgress,
  type PlayerAchievementsResponse,
  type UnlockedAchievement,
} from '@/lib/auth-player-client';

// ---------------------------------------------------------------------------
// Helpers compartilhados (ícones, tiers) — reutilizados pelo toast.
// ---------------------------------------------------------------------------

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface TierStyle {
  badge: string;
  border: string;
  bg: string;
  text: string;
  glow: string;
  ring: string;
}

export const tierStyles: Record<Tier, TierStyle> = {
  bronze: {
    badge: 'bg-amber-700/15 text-amber-800 border border-amber-700/30 dark:text-amber-300',
    border: 'border-amber-700/20',
    bg: 'bg-amber-700/10',
    text: 'text-amber-700 dark:text-amber-300',
    glow: 'bg-amber-600/20',
    ring: 'ring-amber-700/30',
  },
  silver: {
    badge: 'bg-slate-400/15 text-slate-700 border border-slate-400/30 dark:text-slate-200',
    border: 'border-slate-400/20',
    bg: 'bg-slate-400/10',
    text: 'text-slate-600 dark:text-slate-200',
    glow: 'bg-slate-400/20',
    ring: 'ring-slate-400/30',
  },
  gold: {
    badge: 'bg-yellow-500/15 text-yellow-700 border border-yellow-500/30 dark:text-yellow-300',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600 dark:text-yellow-300',
    glow: 'bg-yellow-500/20',
    ring: 'ring-yellow-500/30',
  },
  platinum: {
    badge: 'bg-cyan-400/15 text-cyan-700 border border-cyan-400/30 dark:text-cyan-300',
    border: 'border-cyan-400/20',
    bg: 'bg-cyan-400/10',
    text: 'text-cyan-600 dark:text-cyan-300',
    glow: 'bg-cyan-400/20',
    ring: 'ring-cyan-400/30',
  },
};

export function tierLabel(tier: Tier | string): string {
  switch (tier) {
    case 'bronze':
      return 'Bronze';
    case 'silver':
      return 'Prata';
    case 'gold':
      return 'Ouro';
    case 'platinum':
      return 'Platina';
    default:
      return tier;
  }
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  gamepad: Gamepad2,
  gamepad2: Gamepad2,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  flame: Flame,
  target: Target,
  zap: Zap,
  sparkles: Sparkles,
};

export function AchievementIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Comp = ICON_MAP[name] ?? Award;
  return <Comp className={className} aria-hidden />;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Card individual de conquista
// ---------------------------------------------------------------------------

function UnlockedCard({
  achievement,
  index,
}: {
  achievement: UnlockedAchievement;
  index: number;
}) {
  const t = tierStyles[achievement.tier] ?? tierStyles.bronze;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.25) }}
    >
      <Card
        className={`relative h-full overflow-hidden border ${t.border} ring-1 ${t.ring}/40`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-10 -right-10 size-24 rounded-full blur-2xl ${t.glow}`}
        />
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${t.bg} ${t.text}`}
            >
              <AchievementIcon name={achievement.icon} className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm leading-tight">
                {achievement.name}
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2 text-xs">
                {achievement.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between pt-0">
          <Badge className={t.badge}>{tierLabel(achievement.tier)}</Badge>
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" aria-hidden />
            {formatDate(achievement.unlockedAt)}
          </span>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LockedCard({
  achievement,
  index,
}: {
  achievement: LockedAchievementProgress;
  index: number;
}) {
  const t = tierStyles[achievement.tier] ?? tierStyles.bronze;
  const pct = Math.max(0, Math.min(100, Math.round(achievement.progress.percent)));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.25) }}
    >
      <Card className="relative h-full overflow-hidden border-dashed opacity-90">
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground`}
            >
              <Lock className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm leading-tight text-foreground/80">
                {achievement.name}
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2 text-xs">
                {achievement.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {achievement.progress.current}
              <span className="text-muted-foreground/70">
                {' '}
                / {achievement.progress.target}
              </span>
            </span>
            <span className="tabular-nums font-medium">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <div className="flex items-center justify-between pt-1">
            <Badge variant="outline" className={t.badge}>
              {tierLabel(achievement.tier)}
            </Badge>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Bloqueada
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel principal
// ---------------------------------------------------------------------------

interface AchievementsPanelProps {
  /** Token que, ao mudar, força re-fetch (ex: após simular partida). */
  refreshKey?: number | string;
  /** Callback quando os dados são carregados — permite saber total desbloqueado. */
  onStats?: (s: PlayerAchievementsResponse['stats'] | null) => void;
}

export function AchievementsPanel({
  refreshKey,
  onStats,
}: AchievementsPanelProps) {
  const [data, setData] = React.useState<PlayerAchievementsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchPlayerAchievements();
      setData(r);
      onStats?.(r.stats);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      setError(msg);
      onStats?.(null);
    } finally {
      setLoading(false);
    }
  }, [onStats]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const recent = React.useMemo(() => {
    if (!data) return [] as UnlockedAchievement[];
    return [...data.unlocked]
      .sort(
        (a, b) =>
          new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime(),
      )
      .slice(0, 5);
  }, [data]);

  const pct = data ? Math.round(data.stats.percent) : 0;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" aria-hidden />
              Conquistas
            </CardTitle>
            <CardDescription>
              Desbloqueie marcas jogando partidas no LetraMestre.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Recarregar conquistas"
          >
            {loading ? 'Carregando…' : 'Atualizar'}
          </Button>
        </div>

        {/* Barra de progresso geral */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Progresso geral
            </span>
            <span className="tabular-nums font-semibold">
              {data ? `${data.stats.unlocked} / ${data.stats.total}` : '— / —'}
              <span className="ml-2 text-muted-foreground">{pct}%</span>
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loading && !data ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-rose-50/40 px-4 py-10 text-center dark:bg-rose-950/10">
            <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Não foi possível carregar suas conquistas.
            </span>
            <span className="text-xs text-muted-foreground">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        ) : !data || (data.unlocked.length === 0 && data.locked.length === 0) ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
            <Award className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Nenhuma conquista definida.</p>
            <p className="text-xs text-muted-foreground">
              Volte mais tarde — o catálogo está sendo populado.
            </p>
          </div>
        ) : (
          <>
            {/* Recentes */}
            {recent.length > 0 ? (
              <section aria-label="Conquistas recentes" className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recentes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recent.map((a) => {
                    const t = tierStyles[a.tier] ?? tierStyles.bronze;
                    return (
                      <Badge
                        key={a.id}
                        variant="outline"
                        className={`gap-1 ${t.badge}`}
                      >
                        <AchievementIcon name={a.icon} className="size-3" />
                        {a.name}
                      </Badge>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Desbloqueadas */}
            {data.unlocked.length > 0 ? (
              <section aria-label="Conquistas desbloqueadas" className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Desbloqueadas ({data.unlocked.length})
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.unlocked.map((a, i) => (
                    <UnlockedCard key={a.id} achievement={a} index={i} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Bloqueadas */}
            {data.locked.length > 0 ? (
              <section aria-label="Conquistas bloqueadas" className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Em progresso ({data.locked.length})
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.locked.map((a, i) => (
                    <LockedCard key={a.id} achievement={a} index={i} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Dispara um toast de erro genérico (caso o caller precise).
 */
export function notifyAchievementsError(message: string): void {
  toast.error('Falha ao carregar conquistas', { description: message });
}
