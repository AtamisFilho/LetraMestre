// Core game types for LetraMestre - Portuguese Scrabble-like word game

export type CellBonus = 'NONE' | 'DOUBLE_LETTER' | 'TRIPLE_LETTER' | 'DOUBLE_WORD' | 'TRIPLE_WORD' | 'CENTER';

export interface Tile {
  letter: string;
  value: number;
  isBlank: boolean;
  assignedLetter?: string;
  id: string;
}

export interface BoardCell {
  row: number;
  col: number;
  bonus: CellBonus;
  tile: Tile | null;
  isNewlyPlaced: boolean;
}

export interface Board {
  cells: BoardCell[][];
  size: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  rack: Tile[];
  isHost: boolean;
  isConnected: boolean;
  joinOrder: number;
}

export interface TilePlacement {
  row: number;
  col: number;
  tile: Tile;
  rackIndex: number;
}

export interface MoveData {
  playerId: string;
  placements: TilePlacement[];
}

export type GamePhase = 'WAITING_FOR_PLAYERS' | 'IN_PROGRESS' | 'VALIDATION_PENDING' | 'GAME_OVER';

export interface GameState {
  board: Board;
  players: Player[];
  currentPlayerIndex: number;
  tileBagCount: number;
  phase: GamePhase;
  lastPlayedWord: string | null;
  lastPlayedScore: number;
  consecutivePasses: number;
  pendingValidationWord: string | null;
  pendingValidationPlayerId: string | null;
  pendingMoveData: MoveData | null;
  gameId: string;
  gameCode: string;
}

export type MoveValidation =
  | { type: 'Valid'; score: number; words: string[] }
  | { type: 'InvalidWord'; word: string; moveData: MoveData }
  | { type: 'InvalidPlacement'; reason: string };

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
}

// Network messages
export type NetworkMessage =
  | { type: 'JoinRequest'; playerName: string }
  | { type: 'JoinAccepted'; playerId: string; playerName: string }
  | { type: 'PlayerList'; players: PlayerInfo[] }
  | { type: 'GameStarted'; gameState: GameState }
  | { type: 'GameStateUpdate'; gameState: GameState }
  | { type: 'MoveSubmit'; moveData: MoveData }
  | { type: 'PassTurn'; playerId: string }
  | { type: 'ExchangeTiles'; playerId: string; tileIndices: number[] }
  | { type: 'WordValidationRequest'; word: string; fromPlayerId: string }
  | { type: 'WordApproval'; playerId: string; approved: boolean }
  | { type: 'GameEnded'; winnerId: string; winnerName: string; scores: Record<string, number> }
  | { type: 'ErrorMessage'; message: string }
  | { type: 'ChatMessage'; playerId: string; playerName: string; message: string }
  | { type: 'LeaveGame'; playerId: string }
  | { type: 'Ping' }
  | { type: 'Pong' };
