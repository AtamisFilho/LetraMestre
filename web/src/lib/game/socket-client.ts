'use client';

import { io, Socket } from 'socket.io-client';
import { GameState, MoveData, PlayerInfo } from '@/lib/game/types';

const GAME_SERVER_PORT = 3003;

let socket: Socket | null = null;

function createSocketConnection(): Socket {
  const s = io('/', {
    transports: ['websocket'],
    query: { XTransformPort: GAME_SERVER_PORT.toString() },
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  s.on('connect', () => {
    console.log('[Socket] Connected:', s.id);
  });

  s.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  s.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return s;
}

export function getSocket(): Socket {
  if (!socket || socket.disconnected) {
    socket = createSocketConnection();
  }
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  
  // Disconnect old socket if exists
  if (socket) {
    socket.disconnect();
  }
  
  socket = createSocketConnection();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}

// Wait for connection with timeout
export function waitForConnection(timeoutMs: number = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (s.connected) {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);

    s.on('connect', () => {
      clearTimeout(timer);
      resolve(true);
    });

    s.on('connect_error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// Type-safe event helpers
export interface GameCallbacks {
  onGameState?: (state: GameState) => void;
  onGameStarted?: (state: GameState) => void;
  onGameEnded?: (data: { winnerId: string; winnerName: string; scores: Record<string, number> }) => void;
  onPlayerList?: (players: PlayerInfo[]) => void;
  onWordValidation?: (data: { word: string; fromPlayerId: string }) => void;
  onChatMessage?: (data: { playerId: string; playerName: string; message: string; type: string }) => void;
  onError?: (message: string) => void;
}

export function setupGameListeners(callbacks: GameCallbacks): void {
  const s = getSocket();

  if (callbacks.onGameState) s.on('game:state', callbacks.onGameState);
  if (callbacks.onGameStarted) s.on('game:started', callbacks.onGameStarted);
  if (callbacks.onGameEnded) s.on('game:ended', callbacks.onGameEnded);
  if (callbacks.onPlayerList) s.on('lobby:players', callbacks.onPlayerList);
  if (callbacks.onWordValidation) s.on('game:word-validation', callbacks.onWordValidation);
  if (callbacks.onChatMessage) s.on('chat:message', callbacks.onChatMessage);
  if (callbacks.onError) s.on('game:error', callbacks.onError);
}

export function removeGameListeners(): void {
  if (!socket) return;
  const s = socket;
  s.off('game:state');
  s.off('game:started');
  s.off('game:ended');
  s.off('lobby:players');
  s.off('game:word-validation');
  s.off('chat:message');
  s.off('game:error');
}

// Action emitters with timeout protection
function emitWithTimeout<T>(event: string, data: any, timeoutMs: number = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    
    const timer = setTimeout(() => {
      reject(new Error('Tempo esgotado - verifique sua conexão'));
    }, timeoutMs);

    s.emit(event, data, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });

    // If socket is not connected, wait for connection first
    if (!s.connected) {
      s.on('connect', () => {
        s.emit(event, data, (response: T) => {
          clearTimeout(timer);
          resolve(response);
        });
      });
    }
  });
}

export async function createGame(playerName: string): Promise<{
  success: boolean;
  gameId?: string;
  gameCode?: string;
  playerId?: string;
  playerName?: string;
  isHost?: boolean;
  error?: string;
}> {
  try {
    const connected = await waitForConnection();
    if (!connected) {
      return { success: false, error: 'Não foi possível conectar ao servidor' };
    }
    return await emitWithTimeout<any>('game:create', { playerName });
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

export async function joinGame(gameCode: string, playerName: string): Promise<{
  success: boolean;
  gameId?: string;
  gameCode?: string;
  playerId?: string;
  playerName?: string;
  isHost?: boolean;
  error?: string;
}> {
  try {
    const connected = await waitForConnection();
    if (!connected) {
      return { success: false, error: 'Não foi possível conectar ao servidor' };
    }
    return await emitWithTimeout<any>('game:join', { gameCode, playerName });
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

export async function startGame(gameId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await emitWithTimeout<any>('game:start', { gameId, playerId });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitMove(gameId: string, moveData: MoveData): Promise<{
  success: boolean;
  score?: number;
  words?: string[];
  error?: string;
}> {
  try {
    return await emitWithTimeout<any>('game:move', { gameId, moveData });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function passTurn(gameId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await emitWithTimeout<any>('game:pass', { gameId, playerId });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function exchangeTiles(gameId: string, playerId: string, tileIndices: number[]): Promise<{ success: boolean; error?: string }> {
  try {
    return await emitWithTimeout<any>('game:exchange', { gameId, playerId, tileIndices });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function approveWord(gameId: string, playerId: string, approved: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    return await emitWithTimeout<any>('game:word-approval', { gameId, playerId, approved });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function sendChatMessage(gameId: string, playerId: string, playerName: string, message: string): void {
  getSocket().emit('chat:message', { gameId, playerId, playerName, message });
}

export async function rejoinGame(gameId: string, playerId: string): Promise<{
  success: boolean;
  gameId?: string;
  gameCode?: string;
  playerId?: string;
  playerName?: string;
  isHost?: boolean;
  phase?: string;
  error?: string;
}> {
  try {
    const connected = await waitForConnection();
    if (!connected) return { success: false, error: 'Não foi possível reconectar' };
    return await emitWithTimeout<any>('game:rejoin', { gameId, playerId });
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de reconexão' };
  }
}

/**
 * Registers a handler that fires whenever the underlying socket (re)connects.
 * Returns an unsubscribe function. Used to transparently resume a match after
 * a network blip without the player losing their seat.
 */
export function onReconnect(handler: () => void): () => void {
  const s = getSocket();
  s.on('connect', handler);
  return () => s.off('connect', handler);
}

export async function getGameInfo(gameCode: string): Promise<{
  success: boolean;
  exists: boolean;
  status?: string;
  playerCount?: number;
  maxPlayers?: number;
  hostName?: string;
}> {
  try {
    return await emitWithTimeout<any>('game:info', { gameCode });
  } catch (err: any) {
    return { success: false, exists: false };
  }
}
