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
    // Persistence/realtime fan-out is best-effort: a thrown error in the
    // onUpdate callback (e.g. dead socket, transient DB hiccup) must NOT
    // roll back the already-applied game state. Log and swallow.
    try {
      this.onUpdate?.(newState);
    } catch (err) {
      console.error('[GameManager] onUpdate callback threw; state already applied.', err);
    }
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

    // ─── Phase gate ───────────────────────────────────────────────────────
    // Moves are only legal during IN_PROGRESS. During VALIDATION_PENDING we
    // only allow re-validating the EXACT pending move (by reference), which
    // is what approveWord does after the admin lets an unknown word through.
    // A fresh move during VALIDATION_PENDING would silently overwrite the
    // pending one and corrupt the board's "newly placed" tiles.
    if (state.phase === 'GAME_OVER') {
      return { type: 'InvalidPlacement', reason: 'Partida encerrada' };
    }
    if (state.phase === 'WAITING_FOR_PLAYERS') {
      return { type: 'InvalidPlacement', reason: 'Partida ainda não começou' };
    }
    if (state.phase === 'VALIDATION_PENDING') {
      if (moveData !== state.pendingMoveData) {
        return { type: 'InvalidPlacement', reason: 'Aguardando validação de palavra' };
      }
      // Fall through: the same pending move is being re-validated (admin
      // approved the word). No further checks needed — they passed before.
    }

    const player = state.players.find(p => p.id === moveData.playerId);
    if (!player) return { type: 'InvalidPlacement', reason: 'Jogador não encontrado' };

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== moveData.playerId) {
      return { type: 'InvalidPlacement', reason: 'Não é sua vez' };
    }

    if (moveData.placements.length === 0) {
      return { type: 'InvalidPlacement', reason: 'Nenhuma peça colocada' };
    }

    // ─── Rack integrity ───────────────────────────────────────────────────
    // Each placement must reference a real tile in the player's rack. We
    // check: integer rackIndex, in-range, that the tile at that slot has the
    // same id as the placement's tile (defeats phantom-tile and cross-rack
    // swap cheats), and that no rackIndex is reused (a single physical tile
    // can't be spent in two cells).
    const seenRackIndices = new Set<number>();
    for (const placement of moveData.placements) {
      if (!Number.isInteger(placement.rackIndex)) {
        return { type: 'InvalidPlacement', reason: 'Índice de rack inválido' };
      }
      if (placement.rackIndex < 0 || placement.rackIndex >= player.rack.length) {
        return { type: 'InvalidPlacement', reason: 'Peça fora do rack' };
      }
      const rackTile = player.rack[placement.rackIndex];
      if (!rackTile || rackTile.id !== placement.tile.id) {
        return { type: 'InvalidPlacement', reason: 'Peça não corresponde ao rack' };
      }
      if (seenRackIndices.has(placement.rackIndex)) {
        return { type: 'InvalidPlacement', reason: 'Peça do rack reutilizada' };
      }
      seenRackIndices.add(placement.rackIndex);
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
    // Phase guard: a move applied outside IN_PROGRESS/VALIDATION_PENDING
    // would advance the turn after GAME_OVER or during WAITING_FOR_PLAYERS.
    if (state.phase !== 'IN_PROGRESS' && state.phase !== 'VALIDATION_PENDING') {
      return state;
    }
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

    // Build lastPlayedWord in board order (top-to-bottom, left-to-right)
    // rather than in the order the client happened to send. Without this,
    // a horizontal CASA placed right-to-left would be announced as "ASAC".
    const sortedPlacements = [...moveData.placements].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    const lastWord = sortedPlacements.length > 0
      ? sortedPlacements.map(p => p.tile.isBlank ? (p.tile.assignedLetter || '?') : p.tile.letter).join('')
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
    // Phase guard: passing during WAITING_FOR_PLAYERS or GAME_OVER would
    // either start the game prematurely or revive a finished one.
    if (state.phase !== 'IN_PROGRESS') return state;
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
    // Phase guard: exchanging during WAITING_FOR_PLAYERS (no rack dealt yet)
    // or GAME_OVER would corrupt state.
    if (state.phase !== 'IN_PROGRESS') return state;
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return state;
    const player = state.players[playerIndex];

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== playerId) return state;

    // Dedupe indices: exchanging [0,0,0] would push 3 refs to the SAME tile
    // into the bag (duplication) and overflow the rack to 9 tiles on draw.
    const uniqueIndices = [...new Set(indices)];
    // Range-validate each index and require an integer.
    for (const idx of uniqueIndices) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= player.rack.length) return state;
    }
    // Empty exchange is a no-op that should NOT burn the player's turn.
    if (uniqueIndices.length === 0) return state;
    if (this.tileBag.remainingCount() < uniqueIndices.length) return state;

    const tilesToReturn = uniqueIndices.map(i => player.rack[i]).filter(Boolean);
    const newRack = player.rack.filter((_, i) => !uniqueIndices.includes(i));
    const drawnTiles = this.tileBag.draw(uniqueIndices.length);
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

  /**
   * Marks a player's connection status. Returns true if the state changed.
   * Used by the realtime layer so that mid-game disconnects are reflected to
   * everyone instead of being silently dropped.
   */
  setPlayerConnection(playerId: string, isConnected: boolean): boolean {
    const idx = this._gameState.players.findIndex(p => p.id === playerId);
    if (idx === -1 || this._gameState.players[idx].isConnected === isConnected) return false;
    const players = [...this._gameState.players];
    players[idx] = { ...players[idx], isConnected };
    this.updateState({ ...this._gameState, players });
    return true;
  }

  /**
   * Ensures there is always exactly one host while at least one player is
   * connected. If the current host left, the host role migrates to the
   * longest-standing connected player. Returns the new host id (or null).
   */
  reassignHostIfNeeded(): string | null {
    const state = this._gameState;
    const connected = state.players.filter(p => p.isConnected);
    if (connected.length === 0) return null;
    const hostStillHere = state.players.some(p => p.isHost && p.isConnected);
    if (hostStillHere) return state.players.find(p => p.isHost)?.id ?? null;

    const newHost = [...connected].sort((a, b) => a.joinOrder - b.joinOrder)[0];
    const players = state.players.map(p => ({ ...p, isHost: p.id === newHost.id }));
    this.updateState({ ...state, players });
    return newHost.id;
  }

  /**
   * If it is currently the given (now-disconnected) player's turn during an
   * active game, advance the turn so the match doesn't stall waiting on someone
   * who left. Counts as a pass for end-of-game detection. Returns true if the
   * turn was advanced.
   */
  skipTurnIfCurrent(playerId: string): boolean {
    const state = this._gameState;
    if (state.phase !== 'IN_PROGRESS') return false;
    if (state.players.length === 0) return false;
    if (state.players[state.currentPlayerIndex]?.id !== playerId) return false;

    let newState: GameState = {
      ...state,
      consecutivePasses: state.consecutivePasses + 1,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
    };
    if (this.shouldEndGame(newState)) {
      newState = { ...newState, phase: 'GAME_OVER' };
    }
    this.updateState(newState);
    return true;
  }

  getPersonalizedState(playerId: string): GameState {
    const state = this._gameState;
    return {
      ...state,
      players: state.players.map(player => {
        if (player.id === playerId) {
          // Defensive copy of the requesting player's rack: callers mutate
          // the returned state (e.g. optimistic tile placement on the
          // client), and sharing the live array would leak those mutations
          // back into the authoritative game state.
          return { ...player, rack: [...player.rack] };
        }
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
