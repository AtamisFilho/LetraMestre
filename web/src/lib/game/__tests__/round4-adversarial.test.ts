import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import { createEmptyBoard } from "../board";
import { generateAllTiles, getLetterValue } from "../tile-distribution";
import { dictionary } from "../dictionary";
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

describe("round4-adversarial: vertical words + approve/reject + personalized state + loadState", () => {
  it("vertical lastPlayedWord 'AO' (placements top-to-bottom)", () => {
    const gm = new GameManager("game_test", "TEST01");
    const rack = [tile("A"), tile("O")];
    const state = baseState({
      players: [
        player("p1", "Alice", 0, rack, true, 0),
        player("p2", "Bob", 0, [tile("X")], false, 1),
      ],
      currentPlayerIndex: 0,
    });
    gm.loadState(state, generateAllTiles());
    const moveData: MoveData = {
      playerId: "p1",
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 }, // A
        { row: 8, col: 7, tile: rack[1], rackIndex: 1 }, // O
      ],
    };
    gm.processValidMove(moveData, 4);
    expect(gm.gameState.lastPlayedWord).toBe("AO");
  });

  it("approveWord is a no-op on game state when there's no pending move (but still adds to dict)", () => {
    const gm = new GameManager("g", "C");
    const state = baseState({ phase: "IN_PROGRESS", pendingMoveData: null });
    gm.loadState(state, []);
    const before = gm.gameState;
    const unique = "ZZXXQQYY";
    gm.approveWord(unique);
    // Phase unchanged, board unchanged, no move processed.
    expect(gm.gameState.phase).toBe("IN_PROGRESS");
    expect(gm.gameState.pendingMoveData).toBeNull();
    // But the word WAS added to the dictionary (approveWord always adds).
    expect(dictionary.isValidWord(unique)).toBe(true);
  });

  it("rejectWord is a no-op when there's no pending move", () => {
    const gm = new GameManager("g", "C");
    const state = baseState({ phase: "IN_PROGRESS", pendingMoveData: null });
    gm.loadState(state, []);
    gm.rejectWord();
    expect(gm.gameState.phase).toBe("IN_PROGRESS");
    expect(gm.gameState.pendingMoveData).toBeNull();
  });

  it("approveWord adds the word to the dictionary (isValidWord true afterwards)", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({ pendingMoveData: null }), []);
    const word = "QWERTYUI";
    expect(dictionary.isValidWord(word)).toBe(false);
    gm.approveWord(word);
    expect(dictionary.isValidWord(word)).toBe(true);
  });

  it("getPersonalizedState hides other players' racks (returns rack: [])", () => {
    const gm = new GameManager("g", "C");
    const p1Rack = [tile("A"), tile("B")];
    const p2Rack = [tile("C"), tile("D"), tile("E")];
    gm.loadState(baseState({
      players: [
        player("p1", "Alice", 0, p1Rack, true, 0),
        player("p2", "Bob", 0, p2Rack, false, 1),
      ],
    }), []);
    const personalized = gm.getPersonalizedState("p1");
    const p1View = personalized.players.find((p) => p.id === "p1")!;
    const p2View = personalized.players.find((p) => p.id === "p2")!;
    // Own rack visible.
    expect(p1View.rack.length).toBe(2);
    expect(p1View.rack.map((t) => t.letter)).toEqual(["A", "B"]);
    // Other player's rack hidden.
    expect(p2View.rack).toEqual([]);
  });

  it("getPersonalizedState returns a defensive copy of own rack (mutating it doesn't affect the original)", () => {
    const gm = new GameManager("g", "C");
    const p1Rack = [tile("A"), tile("B")];
    gm.loadState(baseState({
      players: [player("p1", "Alice", 0, p1Rack, true, 0)],
    }), []);
    const personalized = gm.getPersonalizedState("p1");
    // Mutate the returned rack.
    personalized.players[0].rack.push(tile("Z"));
    // The original gameManager's state must NOT be affected.
    const original = gm.gameState.players[0];
    expect(original.rack.length).toBe(2);
  });

  it("getPersonalizedState does not mutate the original gameState", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({
      players: [player("p1", "Alice", 0, [tile("A")], true, 0)],
      currentPlayerIndex: 0,
    }), []);
    const before = gm.gameState.currentPlayerIndex;
    const personalized = gm.getPersonalizedState("p1");
    personalized.currentPlayerIndex = 999;
    expect(gm.gameState.currentPlayerIndex).toBe(before);
  });

  it("loadState round-trip: gameState and tileBagState are restored", () => {
    const gm = new GameManager("g", "C");
    const tileBag = [tile("A"), tile("B"), tile("C")];
    const state = baseState({
      players: [player("p1", "Alice", 42, [tile("X")], true, 0)],
      tileBagCount: tileBag.length,
    });
    gm.loadState(state, tileBag);
    expect(gm.gameState.players[0].score).toBe(42);
    expect(gm.gameState.tileBagCount).toBe(3);
    expect(gm.getTileBagState().length).toBe(3);
  });

  it("loadState with empty bag: draw returns [] and remainingCount is 0", () => {
    const gm = new GameManager("g", "C");
    gm.loadState(baseState({ tileBagCount: 0 }), []);
    // The tileBag is empty — but the GameManager doesn't expose draw directly.
    // Verify via getTileBagState (returns a copy of the internal tiles array).
    expect(gm.getTileBagState()).toEqual([]);
    // Process a move that tries to draw — rack should not get new tiles.
    const rack = [tile("A")];
    gm.loadState(baseState({
      players: [player("p1", "A", 0, rack, true, 0), player("p2", "B", 0, [tile("X")], false, 1)],
      tileBagCount: 0,
    }), []);
    const before = gm.gameState.players[0].rack.length;
    gm.processValidMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: 0 }],
    }, 1);
    // Rack was [A] (1 tile), used 1, drew 0 → rack is now [].
    expect(gm.gameState.players[0].rack.length).toBe(0);
  });
});
