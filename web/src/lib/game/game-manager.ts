import { GameState, MoveData, MoveValidation, Player, TilePlacement, GamePhase, Tile } from './types';
import { createEmptyBoard, withTilePlaced, isBoardEmpty, getCell, confirmNewTiles, clearNewTiles, SIZE, CENTER } from './board';
import { TileBag } from './tile-distribution';
import { calculateMoveScore, findAllWords, extractWord } from './score';
import dictionary from './dictionary';

const MAX_RACK_SIZE = 7;
const MAX_PLAYERS = 4;

export class GameManager {
  private tileBag: TileBag;
  private _gameState: GameState;
  private onUpdate?: (state: GameState) => void;

  constructor(gameId: string, gameCode: string) {
    this.tileBag = new TileBag();
    this._gameState = {
      board: createEmptyBoard(),
      players: [],
      currentPlayerIndex: 0,
      tileBagCount: this.tileBag.remainingCount(),
      phase: 'WAITING_FOR_PLAYERS',
      lastPlayedWord: null,
      lastPlayedScore: 0,
      consecutivePasses: 0,
      pendingValidationWord: null,
      pendingValidationPlayerId: null,
      pendingMoveData: null,
      gameId,
      gameCode
    };
  }

  get gameState(): GameState {
    return this._gameState;
  }

  setOnUpdate(callback: (state: GameState) => void): void {
    this.onUpdate = callback;
  }

  private updateState(newState: GameState): void {
    this._gameState = newState;
    this.onUpdate?.(newState);
  }

  addPlayer(name: string): Player {
    const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const player: Player = {
      id,
      name,
      score: 0,
      rack: [],
      isHost: this._gameState.players.length === 0,
      isConnected: true,
      joinOrder: this._gameState.players.length
    };
    this.updateState({
      ...this._gameState,
      players: [...this._gameState.players, player]
    });
    return player;
  }

  removePlayer(playerId: string): void {
    const players = this._gameState.players.filter(p => p.id !== playerId);
    this.updateState({ ...this._gameState, players });
  }

  startGame(): GameState {
    this.tileBag.refill();

    const players = this._gameState.players.map(p => ({
      ...p,
      rack: this.tileBag.draw(MAX_RACK_SIZE),
      score: 0
    }));

    this.updateState({
      ...this._gameState,
      board: createEmptyBoard(),
      players,
      currentPlayerIndex: 0,
      tileBagCount: this.tileBag.remainingCount(),
      phase: 'IN_PROGRESS',
      lastPlayedWord: null,
      lastPlayedScore: 0,
      consecutivePasses: 0
    });

    return this._gameState;
  }

  validateMove(moveData: MoveData): MoveValidation {
    const state = this._gameState;
    const player = state.players.find(p => p.id === moveData.playerId);
    if (!player) return { type: 'InvalidPlacement', reason: 'Jogador não encontrado' };

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== moveData.playerId) {
      return { type: 'InvalidPlacement', reason: 'Não é sua vez' };
    }

    if (moveData.placements.length === 0) {
      return { type: 'InvalidPlacement', reason: 'Nenhuma peça colocada' };
    }

    if (!isValidLine(moveData)) {
      return { type: 'InvalidPlacement', reason: 'Peças devem estar em linha' };
    }

    // First move must cover center
    if (isBoardEmpty(state.board)) {
      const coversCenter = moveData.placements.some(p => p.row === CENTER && p.col === CENTER);
      if (!coversCenter) {
        return { type: 'InvalidPlacement', reason: 'Primeira jogada deve cobrir o centro' };
      }
    }

    // Place tiles temporarily
    let tempBoard = state.board;
    for (const placement of moveData.placements) {
      const cell = getCell(tempBoard, placement.row, placement.col);
      if (cell?.tile != null) {
        return { type: 'InvalidPlacement', reason: 'Célula já ocupada' };
      }
      tempBoard = withTilePlaced(tempBoard, placement.row, placement.col, placement.tile);
    }

    // Check connection with existing tiles (except first move)
    if (!isBoardEmpty(state.board)) {
      const connected = moveData.placements.some(p => {
        return [[-1,0],[1,0],[0,-1],[0,1]].some(([dr, dc]) => {
          const adjCell = getCell(state.board, p.row + dr, p.col + dc);
          return adjCell?.tile != null;
        });
      });
      if (!connected) {
        return { type: 'InvalidPlacement', reason: 'Deve conectar com peças existentes' };
      }
    }

    // Find formed words
    const wordsFound = findAllWords(tempBoard, moveData.placements);
    if (wordsFound.length === 0) {
      return { type: 'InvalidPlacement', reason: 'Nenhuma palavra formada' };
    }

    // Validate words in dictionary
    for (const wordCells of wordsFound) {
      const word = extractWord(wordCells);
      if (!dictionary.isValidWord(word)) {
        return { type: 'InvalidWord', word, moveData };
      }
    }

    const score = calculateMoveScore(tempBoard, moveData.placements);
    const wordStrings = wordsFound.map(wc => extractWord(wc));

    return { type: 'Valid', score, words: wordStrings };
  }

  processValidMove(moveData: MoveData, score: number): GameState {
    const state = this._gameState;
    const playerIndex = state.players.findIndex(p => p.id === moveData.playerId);
    if (playerIndex === -1) return state;
    const player = state.players[playerIndex];

    // Place tiles on board
    let newBoard = state.board;
    for (const placement of moveData.placements) {
      newBoard = withTilePlaced(newBoard, placement.row, placement.col, placement.tile, false);
    }

    // Update player's rack
    const usedIndices = new Set(moveData.placements.map(p => p.rackIndex));
    const newRack = player.rack.filter((_, i) => !usedIndices.has(i));
    const drawnTiles = this.tileBag.draw(MAX_RACK_SIZE - newRack.length);
    const updatedPlayer: Player = {
      ...player,
      score: player.score + score,
      rack: [...newRack, ...drawnTiles]
    };

    const newPlayers = [...state.players];
    newPlayers[playerIndex] = updatedPlayer;

    const lastWord = moveData.placements.length > 0
      ? moveData.placements.map(p => p.tile.isBlank ? (p.tile.assignedLetter || '?') : p.tile.letter).join('')
      : null;

    let newState: GameState = {
      ...state,
      board: newBoard,
      players: newPlayers,
      tileBagCount: this.tileBag.remainingCount(),
      consecutivePasses: 0,
      lastPlayedWord: lastWord,
      lastPlayedScore: score,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % newPlayers.length
    };

    // Check game end
    if (this.shouldEndGame(newState)) {
      newState = { ...newState, phase: 'GAME_OVER' };
    }

    this.updateState(newState);
    return newState;
  }

  passTurn(playerId: string): GameState {
    const state = this._gameState;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== playerId) return state;

    let newState: GameState = {
      ...state,
      consecutivePasses: state.consecutivePasses + 1,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length
    };

    if (this.shouldEndGame(newState)) {
      newState = { ...newState, phase: 'GAME_OVER' };
    }

    this.updateState(newState);
    return newState;
  }

  exchangeTiles(playerId: string, indices: number[]): GameState {
    const state = this._gameState;
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return state;
    const player = state.players[playerIndex];

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== playerId) return state;

    if (this.tileBag.remainingCount() < indices.length) return state;

    const tilesToReturn = indices.map(i => player.rack[i]).filter(Boolean);
    const newRack = player.rack.filter((_, i) => !indices.includes(i));
    const drawnTiles = this.tileBag.draw(indices.length);
    this.tileBag.returnTiles(tilesToReturn);

    const updatedPlayer: Player = {
      ...player,
      rack: [...newRack, ...drawnTiles]
    };

    const newPlayers = [...state.players];
    newPlayers[playerIndex] = updatedPlayer;

    let newState: GameState = {
      ...state,
      players: newPlayers,
      tileBagCount: this.tileBag.remainingCount(),
      consecutivePasses: 0,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % newPlayers.length
    };

    this.updateState(newState);
    return newState;
  }

  approveWord(word: string): GameState {
    dictionary.addApprovedWord(word);
    const state = this._gameState;
    const pendingMove = state.pendingMoveData;
    if (!pendingMove) return state;

    const validation = this.validateMove(pendingMove);
    if (validation.type === 'Valid') {
      this.processValidMove(pendingMove, validation.score);
      this.updateState({
        ...this._gameState,
        pendingValidationWord: null,
        pendingMoveData: null,
        pendingValidationPlayerId: null,
        phase: 'IN_PROGRESS'
      });
    }
    return this._gameState;
  }

  rejectWord(): GameState {
    // Return tiles to player's rack and clear pending
    const state = this._gameState;
    const pendingMove = state.pendingMoveData;
    if (!pendingMove) return state;

    // Clear new tiles from board
    const clearedBoard = clearNewTiles(state.board);

    this.updateState({
      ...state,
      board: clearedBoard,
      pendingValidationWord: null,
      pendingMoveData: null,
      pendingValidationPlayerId: null,
      phase: 'IN_PROGRESS'
    });

    return this._gameState;
  }

  setPendingValidation(word: string, moveData: MoveData): void {
    this.updateState({
      ...this._gameState,
      pendingValidationWord: word,
      pendingMoveData: moveData,
      pendingValidationPlayerId: moveData.playerId,
      phase: 'VALIDATION_PENDING'
    });
  }

  shouldEndGame(state: GameState): boolean {
    // All players passed two rounds
    if (state.consecutivePasses >= state.players.length * 2) return true;

    // A player ran out of tiles and bag is empty
    const playerWithoutTiles = state.players.find(p => p.rack.length === 0);
    if (playerWithoutTiles && state.tileBagCount === 0) return true;

    return false;
  }

  getWinner(): Player | null {
    if (this._gameState.players.length === 0) return null;
    return this._gameState.players.reduce((best, p) => p.score > best.score ? p : best, this._gameState.players[0]);
  }

  getPlayerById(playerId: string): Player | undefined {
    return this._gameState.players.find(p => p.id === playerId);
  }

  getPersonalizedState(playerId: string): GameState {
    const state = this._gameState;
    return {
      ...state,
      players: state.players.map(player => {
        if (player.id === playerId) return player;
        return { ...player, rack: [] }; // Hide other players' racks
      })
    };
  }

  loadState(state: GameState, tileBagState: Tile[]): void {
    this.tileBag.loadState(tileBagState);
    this._gameState = state;
  }

  getTileBagState(): Tile[] {
    return this.tileBag.getState();
  }
}

function isValidLine(moveData: MoveData): boolean {
  if (moveData.placements.length <= 1) return true;
  const rows = new Set(moveData.placements.map(p => p.row));
  const cols = new Set(moveData.placements.map(p => p.col));
  return rows.size === 1 || cols.size === 1;
}

export { MAX_RACK_SIZE, MAX_PLAYERS };
