'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, UserCircle2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  usePlayerSession,
  type PlayerMe,
} from '@/lib/auth-player-client';
import { AuthScreen } from './auth-screen';
import { ProfileScreen } from './profile-screen';

/**
 * Orquestra a experiência do Jogador (Fase 1):
 * - hidrata sessão no mount via /me;
 * - não autenticado → AuthScreen;
 * - autenticado → ProfileScreen.
 */
export function PlayerApp() {
  const { player, loading, setPlayer, logout } = usePlayerSession();

  const handleAuthenticated = React.useCallback(
    (p: PlayerMe) => setPlayer(p),
    [setPlayer],
  );
  const handleLogout = React.useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
      {/* Cabeçalho do modo jogador */}
      <div className="mb-6 flex flex-col gap-1 text-center sm:text-left">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Fase 1 · M1
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Conta do Jogador
        </h1>
        <p className="text-sm text-muted-foreground">
          Crie sua conta, jogue partidas simuladas e acompanhe suas
          estatísticas. Tudo vinculado à sua conta persistente.
        </p>
      </div>

      {loading && !player ? (
        <div className="mx-auto w-full max-w-md">
          <div className="flex flex-col items-center gap-3 pb-6 text-center">
            <Loader2
              className="size-6 animate-spin text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground">
              Carregando sessão…
            </span>
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {player ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <ProfileScreen
                player={player}
                onUpdated={setPlayer}
                onLogout={handleLogout}
              />
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-md"
            >
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <UserCircle2 className="size-5" aria-hidden />
                <span>Você não está autenticado.</span>
              </div>
              <AuthScreen onAuthenticated={handleAuthenticated} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
