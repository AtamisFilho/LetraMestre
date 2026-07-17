/**
 * Store de modo da aplicação (Operações vs Jogador).
 *
 * Permite compartilhar o estado entre o Header (renderizado no layout)
 * e a página `/` sem precisar modificar o layout. Persiste em
 * localStorage. Default: 'ops'.
 */

'use client';

import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'ops' | 'player';

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  toggle: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: 'ops',
      setMode: (m) => set({ mode: m }),
      toggle: () =>
        set((s) => ({ mode: s.mode === 'ops' ? 'player' : 'ops' })),
    }),
    {
      name: 'letramestre:mode',
      version: 1,
      // Evita hydration mismatch: começamos sempre em 'ops' no SSR
      // e o cliente reidrata após o mount.
      skipHydration: true,
    },
  ),
);

/**
 * Hook seguro para uso no cliente — garante hidratação após o mount
 * (evita warnings de hydration mismatch com o persist).
 */
export function useAppMode(): {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  hydrated: boolean;
} {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    useModeStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return { mode, setMode, hydrated };
}
