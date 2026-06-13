'use client';

import { create } from 'zustand';
import { GameState, PlayerInfo, Tile, TilePlacement, MoveData, GamePhase } from './types';

export type AppScreen = 'home' | 'create' | 'join' | 'lobby' | 'game' | 'admin' | 'admin-login';

export interface ChatMsg {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  type: 'chat' | 'system';
  timestamp: number;
}

interface GameStore {
  // Navigation
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Player info
  playerId: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  isHost: boolean;

  // Game room info
  gameId: string | null;
  gameCode: string;
  
  // Game state
  gameState: GameState | null;
  setGameState: (state: GameState) => void;

  // Player list (lobby)
  playerList: PlayerInfo[];
  setPlayerList: (players: PlayerInfo[]) => void;

  // Tile selection for rack
  selectedTileIndices: Set<number>;
  toggleTileSelection: (index: number) => void;
  clearSelection: () => void;

  // Placed tiles on board (temporary, before confirmation)
  placedTiles: Map<string, TilePlacement>; // key: "row,col"
  addPlacedTile: (placement: TilePlacement) => void;
  removePlacedTile: (row: number, col: number) => void;
  clearPlacedTiles: () => void;
  
  // Currently dragging/placing tile
  placingTileIndex: number | null;
  setPlacingTileIndex: (index: number | null) => void;

  // Word validation
  pendingWord: string | null;
  setPendingWord: (word: string | null) => void;
  pendingWordPlayerId: string | null;

  // Chat
  chatMessages: ChatMsg[];
  addChatMessage: (msg: Omit<ChatMsg, 'id' | 'timestamp'>) => void;
  clearChat: () => void;

  // Game over
  gameOverData: { winnerName: string; scores: Record<string, number> } | null;
  setGameOverData: (data: { winnerName: string; scores: Record<string, number> } | null) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Error
  lastError: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;

  // Set game info after create/join
  setGameInfo: (data: { gameId: string; gameCode: string; playerId: string; playerName: string; isHost: boolean }) => void;
}

let chatIdCounter = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  playerId: null,
  playerName: '',
  setPlayerName: (name) => set({ playerName: name }),
  isHost: false,

  gameId: null,
  gameCode: '',
  
  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  playerList: [],
  setPlayerList: (players) => set({ playerList: players }),

  selectedTileIndices: new Set<number>(),
  toggleTileSelection: (index) => {
    const current = new Set(get().selectedTileIndices);
    if (current.has(index)) current.delete(index);
    else current.add(index);
    set({ selectedTileIndices: current });
  },
  clearSelection: () => set({ selectedTileIndices: new Set<number>() }),

  placedTiles: new Map<string, TilePlacement>(),
  addPlacedTile: (placement) => {
    const map = new Map(get().placedTiles);
    map.set(`${placement.row},${placement.col}`, placement);
    set({ placedTiles: map });
  },
  removePlacedTile: (row, col) => {
    const map = new Map(get().placedTiles);
    map.delete(`${row},${col}`);
    set({ placedTiles: map });
  },
  clearPlacedTiles: () => set({ placedTiles: new Map<string, TilePlacement>() }),

  placingTileIndex: null,
  setPlacingTileIndex: (index) => set({ placingTileIndex: index }),

  pendingWord: null,
  setPendingWord: (word) => set({ pendingWord: word }),
  pendingWordPlayerId: null,

  chatMessages: [],
  addChatMessage: (msg) => {
    const newMsg: ChatMsg = { ...msg, id: `msg_${++chatIdCounter}`, timestamp: Date.now() };
    set((state) => ({ chatMessages: [...state.chatMessages, newMsg] }));
  },
  clearChat: () => set({ chatMessages: [] }),

  gameOverData: null,
  setGameOverData: (data) => set({ gameOverData: data }),

  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  lastError: null,
  setError: (error) => set({ lastError: error }),

  reset: () => set({
    screen: 'home',
    playerId: null,
    playerName: get().playerName,
    isHost: false,
    gameId: null,
    gameCode: '',
    gameState: null,
    playerList: [],
    selectedTileIndices: new Set<number>(),
    placedTiles: new Map<string, TilePlacement>(),
    placingTileIndex: null,
    pendingWord: null,
    pendingWordPlayerId: null,
    chatMessages: [],
    gameOverData: null,
    isConnected: false,
    lastError: null,
  }),

  setGameInfo: (data) => set({
    gameId: data.gameId,
    gameCode: data.gameCode,
    playerId: data.playerId,
    playerName: data.playerName,
    isHost: data.isHost,
  }),
}));
