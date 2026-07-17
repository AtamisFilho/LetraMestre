'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import type { NewAchievement } from '@/lib/auth-player-client';
import { AchievementIcon, tierStyles, tierLabel } from './achievements-panel';

interface AchievementToastProps {
  achievement: NewAchievement;
  onClose?: () => void;
}

/**
 * Toast customizado (sonner) que anuncia o desbloqueio de uma conquista.
 * Renderizado via `showAchievementToast` abaixo.
 */
function AchievementToastContent({ achievement, onClose }: AchievementToastProps) {
  const t = tierStyles[achievement.tier] ?? tierStyles.bronze;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-lg ${t.border}`}
      role="status"
      aria-live="polite"
    >
      {/* halo */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-12 -right-10 size-32 rounded-full blur-2xl ${t.glow}`}
      />
      <div
        className={`relative flex size-12 shrink-0 items-center justify-center rounded-lg ${t.bg} ${t.text}`}
        aria-hidden
      >
        <AchievementIcon name={achievement.icon} className="size-6" />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Conquista desbloqueada!
          </span>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.badge}`}
          >
            {tierLabel(achievement.tier)}
          </span>
        </div>
        <p className="truncate text-sm font-semibold leading-tight">
          {achievement.name}
        </p>
        {achievement.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {achievement.description}
          </p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="relative -mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fechar notificação"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </motion.div>
  );
}

/**
 * Dispara um toast sonner customizado anunciando o desbloqueio de uma
 * conquista. Auto-dismiss após 5s, com botão de fechar.
 */
export function showAchievementToast(achievement: NewAchievement): void {
  toast.custom(
    (id) => (
      <AchievementToastContent
        achievement={achievement}
        onClose={() => toast.dismiss(id)}
      />
    ),
    {
      duration: 5000,
      // Mantém o toast acessível mesmo com focus em outra área.
      unstyled: true,
    },
  );
}
