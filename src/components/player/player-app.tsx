'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Loader2,
  LogIn,
  Trophy,
  UserCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import {
  usePlayerSession,
  type PlayerMe,
} from '@/lib/auth-player-client';
import { AuthScreen } from './auth-screen';
import { ProfileScreen } from './profile-screen';
import { LeaderboardPanel } from './leaderboard-panel';
import { AchievementsPanel } from './achievements-panel';

type PlayerView = 'leaderboard' | 'profile' | 'achievements';

/**
 * Orquestra a experiência do Jogador (Fase 2):
 * - hidrata sessão no mount via /me;
 * - aba pública "Ranking" acessível mesmo sem login;
 * - abas "Meu perfil" e "Conquistas" exigem login (CTA quando não autenticado);
 * - ao logar, perfil expandido mostra gráficos e conquistas disparam toast.
 */
export function PlayerApp() {
  const { player, loading, setPlayer, logout } = usePlayerSession();
  const [view, setView] = React.useState<PlayerView>('leaderboard');
  const [authOpen, setAuthOpen] = React.useState(false);
  // Bump quando o usuário troca para a tab Conquistas — garante dados frescos.
  const [achievementsTabVisits, setAchievementsTabVisits] = React.useState(0);

  const handleAuthenticated = React.useCallback(
    (p: PlayerMe) => {
      setPlayer(p);
      setAuthOpen(false);
      // Após login, leva direto para o perfil.
      setView('profile');
      toast.success(`Bem-vindo(a), ${p.displayName}!`);
    },
    [setPlayer],
  );

  const handleLogout = React.useCallback(async () => {
    await logout();
    setView('leaderboard');
  }, [logout]);

  const handleViewAchievements = React.useCallback(() => {
    setAchievementsTabVisits((v) => v + 1);
    setView('achievements');
  }, []);

  // Quando a tab Conquistas é ativada, bump refreshKey para re-fetch.
  const achievementsRefreshToken = React.useMemo(
    () => `${achievementsTabVisits}`,
    [achievementsTabVisits],
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
      {/* Cabeçalho do modo jogador */}
      <div className="mb-6 flex flex-col gap-3 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Fase 2 · M2
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            LetraMestre · Jogador
          </h1>
          <p className="text-sm text-muted-foreground">
            Ranking global, estatísticas pessoais e conquistas.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          {player ? (
            <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <UserCircle2 className="size-4 text-primary" aria-hidden />
              <span className="font-medium text-foreground">
                {player.displayName}
              </span>
              <span className="font-mono text-muted-foreground">
                @{player.username}
              </span>
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAuthOpen(true)}
            >
              <LogIn className="size-4" aria-hidden />
              Entrar
            </Button>
          )}
        </div>
      </div>

      {/* Navegação interna */}
      <Tabs
        value={view}
        onValueChange={(v) => {
          if (v === 'leaderboard' || v === 'profile' || v === 'achievements') {
            if (v === 'achievements' && player) {
              setAchievementsTabVisits((n) => n + 1);
            }
            setView(v);
          }
        }}
        className="w-full"
      >
        <div className="mb-4 flex justify-center sm:justify-start">
          <TabsList>
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <Trophy className="size-4" aria-hidden />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5">
              <UserCircle2 className="size-4" aria-hidden />
              Meu perfil
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-1.5">
              <Award className="size-4" aria-hidden />
              Conquistas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Ranking — sempre acessível */}
        <TabsContent value="leaderboard" className="outline-none">
          <AnimatePresence mode="wait">
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <LeaderboardPanel />
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* Meu perfil — exige login */}
        <TabsContent value="profile" className="outline-none">
          <AnimatePresence mode="wait">
            {loading && !player ? (
              <motion.div
                key="profile-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ProfileSkeleton />
              </motion.div>
            ) : player ? (
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
                  onViewAchievements={handleViewAchievements}
                />
              </motion.div>
            ) : (
              <motion.div
                key="profile-cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <LoginCta
                  title="Seu perfil expandido"
                  description="Entre para ver suas estatísticas detalhadas, gráficos de evolução e histórico de partidas."
                  onLogin={() => setAuthOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* Conquistas — exige login */}
        <TabsContent value="achievements" className="outline-none">
          <AnimatePresence mode="wait">
            {loading && !player ? (
              <motion.div
                key="ach-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Skeleton className="h-64 w-full rounded-xl" />
              </motion.div>
            ) : player ? (
              <motion.div
                key="ach"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <AchievementsPanel
                  refreshKey={achievementsRefreshToken}
                />
              </motion.div>
            ) : (
              <motion.div
                key="ach-cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <LoginCta
                  title="Suas conquistas"
                  description="Entre para acompanhar seu progresso e desbloquear marcas jogando partidas."
                  onLogin={() => setAuthOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      </Tabs>

      {/* AuthScreen — aberta sob demanda quando não autenticado */}
      <AnimatePresence>
        {authOpen && !player ? (
          <motion.div
            key="auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Autenticação"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAuthOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-md"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthOpen(false)}
                className="absolute -top-2 -right-2 z-10 size-8 rounded-full p-0 shadow-md"
                aria-label="Fechar autenticação"
              >
                ✕
              </Button>
              <AuthScreen onAuthenticated={handleAuthenticated} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auxiliares locais
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function LoginCta({
  title,
  description,
  onLogin,
}: {
  title: string;
  description: string;
  onLogin: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LogIn className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="max-w-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button onClick={onLogin}>
          <LogIn className="size-4" aria-hidden />
          Entrar na conta
        </Button>
      </CardContent>
    </Card>
  );
}

/** Loader inicial do PlayerApp (não usado diretamente, mantido para clareza). */
export function PlayerAppLoader() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-12 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="text-sm text-muted-foreground">Carregando sessão…</span>
    </div>
  );
}
