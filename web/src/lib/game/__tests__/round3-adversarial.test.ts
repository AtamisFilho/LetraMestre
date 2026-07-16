import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import { createEmptyBoard } from "../board";
import { generateAllTiles, getLetterValue } from "../tile-distribution";
import type { GameState, Tile, MoveData, Player } from "../types";

function tile(letter: string): Tile {
  return {
    letter,
    value: getLetterValue(letter),
    isBlank: false,
    id: `tile_${letter}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: createEmptyBoard(),
    players: [],
    currentPlayerIndex: 0,
    tileBagCount: 100,
    phase: "IN_PROGRESS",
    lastPlayedWord: null,
    lastPlayedScore: 0,
    consecutivePasses: 0,
    pendingValidationWord: null,
    pendingValidationPlayerId: null,
    pendingMoveData: null,
    gameId: "game_test",
    gameCode: "TEST01",
    ...overrides,
  };
}

function player(id: string, name: string, score = 0, rack: Tile[] = [], isHost = false, joinOrder = 0): Player {
  return { id, name, score, rack, isHost, isConnected: true, joinOrder };
}

describe("round3-adversarial: lastPlayedWord + shouldEndGame + getWinner + addPlayer", () => {
  it("lastPlayedWord is in board order (sorted by row then col), not placement order", () => {
    const gm = new GameManager("game_test", "TEST01");
    const rack = [tile("C"), tile("A"), tile("S"), tile("A")];
    const state = baseState({
      players: [
        player("p1", "Alice", 0, rack, true, 0),
        player("p2", "Bob", 0, [tile("X")], false, 1),
      ],
      currentPlayerIndex: 0,
    });
    gm.loadState(state, generateAllTiles());
    // Place CASA at cols 7,8,9,10 but specify placements in REVERSE order
    // (right-to-left: col 10 first, col 7 last).
    const moveData: MoveData = {
      playerId: "p1",
      placements: [
        { row: 7, col: 10, tile: rack[3], rackIndex: 3 }, // A
        { row: 7, col: 9, tile: rack[2], rackIndex: 2 },  // S
        { row: 7, col: 8, tile: rack[1], rackIndex: 1 },  // A
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 },  // C
      ],
    };
    gm.processValidMove(moveData, 10);
    // The board reads "CASA" left-to-right. processValidMove sorts placements
    // by (row, col) before building lastPlayedWord, so the word is "CASA"
    // (board order) regardless of the placement order the client sent.
    expect(gm.gameState.lastPlayedWord).toBe("CASA");
    expect(gm.gameState.lastPlayedScore).toBe(10);
  });

  it("shouldEndGame returns true when a player's rack is empty AND bag is empty", () => {
    const gm = new GameManager("g", "C");
    const state = baseState({
      players: [player("p1", "A", 0, [], true, 0)],
      tileBagCount: 0,
    });
    expect(gm.shouldEndGame(state)).toBe(true);
  });

  it("shouldEndGame returns true when consecutivePasses >= players.length * 2", () => {
    const gm = new GameManager("g", "C");
    const state = baseState({
      players: [player("p1", "A"), player("p2", "B")],
      consecutivePasses: 4, // 2 players × 2 rounds
    });
    expect(gm.shouldEndGame(state)).toBe(true);
  });

  it("shouldEndGame returns false when consecutivePasses < players.length * 2", () => {
    const gm = new GameManager("g", "C");
    const state = baseState({
      players: [player("p1", "A"), player("p2", "B")],
      consecutivePasses: 3,
    });
    expect(gm.shouldEndGame(state)).toBe(false);
  });

  it("getWinner returns the first player on a tie (reduce keeps best when score is not strictly greater)", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({
      players: [
        player("p1", "A", 10, [], true, 0),
        player("p2", "B", 10, [], false, 1),
      ],
    }), []);
    expect(gm.getWinner()?.id).toBe("p1");
  });

  it("getWinner returns the player with the highest score", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({
      players: [
        player("p1", "A", 5, [], true, 0),
        player("p2", "B", 15, [], false, 1),
        player("p3", "C", 10, [], false, 2),
      ],
    }), []);
    expect(gm.getWinner()?.id).toBe("p2");
  });

  it("getWinner returns null when there are no players", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({ players: [] }), []);
    expect(gm.getWinner()).toBe(null);
  });

  it("addPlayer: the first player added becomes the host", () => {
    const gm = new GameManager("g", "C");
    const p = gm.addPlayer("Alice");
    expect(p.isHost).toBe(true);
    expect(p.joinOrder).toBe(0);
  });

  it("addPlayer: subsequent players are NOT host and get incrementing joinOrder", () => {
    const gm = new GameManager("g", "C");
    const p1 = gm.addPlayer("Alice");
    const p2 = gm.addPlayer("Bob");
    const p3 = gm.addPlayer("Carol");
    expect(p1.isHost).toBe(true);
    expect(p2.isHost).toBe(false);
    expect(p3.isHost).toBe(false);
    expect(p1.joinOrder).toBe(0);
    expect(p2.joinOrder).toBe(1);
    expect(p3.joinOrder).toBe(2);
  });
});
