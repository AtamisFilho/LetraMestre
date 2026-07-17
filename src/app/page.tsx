'use client';

import * as React from 'react';

import { OpsConsole } from '@/components/ops/ops-console';
import { PlayerApp } from '@/components/player/player-app';
import { useAppMode } from '@/lib/mode-store';

/**
 * Shell raiz da rota `/`.
 *
 * Renderiza o Console de Operações (Fase 0 + seção Fase 1) ou a
 * experiência do Jogador (Fase 1) conforme o modo selecionado no
 * cabeçalho. Estado persistido em localStorage (default: 'ops').
 */
export default function Home() {
  const { mode, hydrated } = useAppMode();

  // Antes da hidratação do store, renderizamos 'ops' (default) para evitar
  // mismatch com o SSR. Após hidratar, trocamos conforme o estado salvo.
  const effectiveMode: 'ops' | 'player' = hydrated ? mode : 'ops';

  if (effectiveMode === 'player') {
    return <PlayerApp />;
  }
  return <OpsConsole />;
}
