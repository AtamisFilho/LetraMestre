'use client';

import { useGameStore } from '@/lib/game/store';
import { HomeScreen } from '@/components/game/screens';
import { CreateGameScreen, JoinGameScreen, LobbyScreen, GameScreen } from '@/components/game/screens';
import { AdminLoginScreen, AdminPanel } from '@/components/game/admin';

export default function LetraMestrePage() {
  const screen = useGameStore((s) => s.screen);

  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'create':
      return <CreateGameScreen />;
    case 'join':
      return <JoinGameScreen />;
    case 'lobby':
      return <LobbyScreen />;
    case 'game':
      return <GameScreen />;
    case 'admin-login':
      return <AdminLoginScreen />;
    case 'admin':
      return <AdminPanel />;
    default:
      return <HomeScreen />;
  }
}
