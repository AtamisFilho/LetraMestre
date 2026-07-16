import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import { createEmptyBoard, withTilePlaced } from "../board";
import { generateAllTiles, getLetterValue } from "../tile-distribution";
import type { GameState, Tile, MoveData, Player } from "../types";

function tile(letter: string): Tile {
  return {
    letter,
    value: getLetterValue(letter),
    isBlank: false,
    id: `tile_${letter}_${Math.random().toString(36).slice(2, 10)}`,
  };
}

function makeGame(opts: { phase?: GameState["phase"]; players?: Player[]; tileBag?: Tile[] } = {}): GameManager {
  const gm = new GameManager("game_persist", "PERS001");
  const rack1 = [tile("C"), tile("A"), tile("S"), tile("A"), tile("E"), tile("O"), tile("R")];
  const rack2 = [tile("B"), tile("D"), tile("F"), tile("G"), tile("H"), tile("I"), tile("J")];
  const state: GameState = {
    board: createEmptyBoard(),
    players: opts.players ?? [
      { id: "p1", name: "Alice", score: 0, rack: rack1, isHost: true, isConnected: true, joinOrder: 0 },
      { id: "p2", name: "Bob", score: 0, rack: rack2, isHost: false, isConnected: true, joinOrder: 1 },
    ],
    currentPlayerIndex: 0,
    tileBagCount: 100,
    phase: opts.phase ?? "IN_PROGRESS",
    lastPlayedWord: null,
    lastPlayedScore: 0,
    consecutivePasses: 0,
    pendingValidationWord: null,
    pendingValidationPlayerId: null,
    pendingMoveData: null,
    gameId: "game_persist",
    gameCode: "PERS001",
  };
  gm.loadState(state, opts.tileBag ?? generateAllTiles());
  return gm;
}

function centerCasaMove(rack: Tile[]): MoveData {
  return {
    playerId: "p1",
    placements: [
      { row: 7, col: 7, tile: rack[0], rackIndex: 0 },
      { row: 7, col: 8, tile: rack[1], rackIndex: 1 },
      { row: 7, col: 9, tile: rack[2], rackIndex: 2 },
      { row: 7, col: 10, tile: rack[3], rackIndex: 3 },
    ],
  };
}

describe("persist-adversarial: loadState + getTileBagState", () => {
  it("loadState round-trip: gameState and tileBag are restored", () => {
    const gm = new GameManager("g", "C");
    const bag = [tile("A"), tile("B"), tile("C")];
    const state: GameState = {
      board: createEmptyBoard(), players: [], currentPlayerIndex: 0,
      tileBagCount: bag.length, phase: "WAITING_FOR_PLAYERS",
      lastPlayedWord: null, lastPlayedScore: 0, consecutivePasses: 0,
      pendingValidationWord: null, pendingValidationPlayerId: null, pendingMoveData: null,
      gameId: "g", gameCode: "C",
    };
    gm.loadState(state, bag);
    expect(gm.gameState).toBe(state); // same reference (loadState sets directly)
    expect(gm.getTileBagState().length).toBe(3);
  });

  it("getTileBagState returns a copy — mutating it doesn't affect the bag", () => {
    const gm = makeGame();
    const state = gm.getTileBagState();
    const lenBefore = state.length;
    state.pop();
    expect(gm.getTileBagState().length).toBe(lenBefore);
  });

  it("loadState with empty bag: getTileBagState returns []", () => {
    const gm = makeGame({ tileBag: [] });
    expect(gm.getTileBagState()).toEqual([]);
    expect(gm.gameState.tileBagCount).toBe(100); // tileBagCount is set by the state, not derived
  });

  it("loadState defensive copy: mutating the input tileBag array doesn't affect the bag", () => {
    const bag = [tile("A"), tile("B")];
    const gm = makeGame({ tileBag: bag });
    const lenBefore = gm.getTileBagState().length;
    bag.push(tile("Z"));
    expect(gm.getTileBagState().length).toBe(lenBefore); // unaffected
  });
});

describe("persist-adversarial: setOnUpdate called on every mutator", () => {
  it("addPlayer triggers onUpdate", () => {
    const gm = new GameManager("g", "C");
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.addPlayer("Alice");
    expect(calls).toBe(1);
  });

  it("removePlayer triggers onUpdate", () => {
    const gm = makeGame();
    gm.addPlayer("Carol");
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.removePlayer("p1");
    expect(calls).toBe(1);
  });

  it("startGame triggers onUpdate", () => {
    const gm = new GameManager("g", "C");
    gm.addPlayer("A");
    gm.addPlayer("B");
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.startGame();
    expect(calls).toBe(1);
  });

  it("processValidMove triggers onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.processValidMove(centerCasaMove(gm.gameState.players[0].rack), 10);
    expect(calls).toBe(1);
  });

  it("passTurn triggers onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.passTurn("p1");
    expect(calls).toBe(1);
  });

  it("exchangeTiles triggers onUpdate (when valid)", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.exchangeTiles("p1", [0]);
    expect(calls).toBe(1);
  });

  it("setPendingValidation triggers onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.setPendingValidation("XYZ", centerCasaMove(gm.gameState.players[0].rack));
    expect(calls).toBe(1);
  });

  it("approveWord triggers onUpdate when there's a pending move (processValidMove + clear)", () => {
    const gm = makeGame();
    const move = centerCasaMove(gm.gameState.players[0].rack);
    gm.setPendingValidation("CASA", move);
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.approveWord("CASA");
    expect(calls).toBeGreaterThan(0); // processValidMove + updateState(pending=null)
  });

  it("rejectWord triggers onUpdate when there's a pending move", () => {
    const gm = makeGame();
    const move = centerCasaMove(gm.gameState.players[0].rack);
    gm.setPendingValidation("XYZ", move);
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.rejectWord();
    expect(calls).toBe(1);
  });

  it("setPlayerConnection triggers onUpdate (when state changes)", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    const changed = gm.setPlayerConnection("p1", false);
    expect(changed).toBe(true);
    expect(calls).toBe(1);
  });

  it("setPlayerConnection does NOT trigger onUpdate when state is unchanged", () => {
    const gm = makeGame(); // p1.isConnected = true
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    const changed = gm.setPlayerConnection("p1", true); // already true
    expect(changed).toBe(false);
    expect(calls).toBe(0);
  });

  it("reassignHostIfNeeded triggers onUpdate when a new host is assigned", () => {
    const gm = makeGame();
    // Make p1 (host) disconnected so reassign triggers.
    gm.setPlayerConnection("p1", false);
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    const newHost = gm.reassignHostIfNeeded();
    expect(newHost).toBe("p2");
    expect(calls).toBe(1);
  });

  it("skipTurnIfCurrent triggers onUpdate when the current player is skipped", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    const skipped = gm.skipTurnIfCurrent("p1");
    expect(skipped).toBe(true);
    expect(calls).toBe(1);
  });
});

describe("persist-adversarial: onUpdate throw isolation", () => {
  it("a throwing onUpdate doesn't corrupt the state — state is updated and the throw is swallowed", () => {
    const gm = new GameManager("g", "C");
    gm.setOnUpdate(() => { throw new Error("callback boom"); });
    // The fix wraps onUpdate in try/catch, so addPlayer does NOT throw.
    // The state IS updated before the callback runs, so the player is added.
    expect(() => gm.addPlayer("Alice")).not.toThrow();
    expect(gm.gameState.players.length).toBe(1); // state was still updated
    expect(gm.gameState.players[0].name).toBe("Alice");
  });

  it("a throwing onUpdate doesn't prevent the tileBag from being updated by processValidMove", () => {
    const gm = makeGame();
    const bagBefore = gm.getTileBagState().length;
    gm.setOnUpdate(() => { throw new Error("boom"); });
    // The fix swallows the throw, so processValidMove does NOT throw.
    expect(() => gm.processValidMove(centerCasaMove(gm.gameState.players[0].rack), 10)).not.toThrow();
    // The tileBag was drawn from: 4 tiles used, 4 drawn to refill → bag
    // decreased by 4. The throw was swallowed so the draw still happened.
    const bagAfter = gm.getTileBagState().length;
    expect(bagAfter).toBe(bagBefore - 4); // 4 tiles drawn to replace the 4 used
  });
});

describe("persist-adversarial: non-mutating accessors do NOT trigger onUpdate", () => {
  it("gameState getter doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    void gm.gameState;
    expect(calls).toBe(0);
  });

  it("getPersonalizedState doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.getPersonalizedState("p1");
    expect(calls).toBe(0);
  });

  it("getWinner doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.getWinner();
    expect(calls).toBe(0);
  });

  it("shouldEndGame doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.shouldEndGame(gm.gameState);
    expect(calls).toBe(0);
  });

  it("getPlayerById doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.getPlayerById("p1");
    expect(calls).toBe(0);
  });

  it("getTileBagState doesn't trigger onUpdate", () => {
    const gm = makeGame();
    let calls = 0;
    gm.setOnUpdate(() => { calls++; });
    gm.getTileBagState();
    expect(calls).toBe(0);
  });
});

describe("persist-adversarial: TileBag edge cases via mutators", () => {
  it("processValidMove refills the rack to MAX_RACK_SIZE (7) when the bag has tiles", () => {
    const gm = makeGame();
    const rackBefore = gm.gameState.players[0].rack.length; // 7
    gm.processValidMove(centerCasaMove(gm.gameState.players[0].rack), 10);
    // Used 4 tiles, drew 4 → rack back to 7.
    expect(gm.gameState.players[0].rack.length).toBe(rackBefore);
  });

  it("processValidMove updates tileBagCount to match the bag's remaining count", () => {
    const gm = makeGame();
    const bagBefore = gm.getTileBagState().length;
    gm.processValidMove(centerCasaMove(gm.gameState.players[0].rack), 10);
    expect(gm.gameState.tileBagCount).toBe(bagBefore - 4); // drew 4 to refill
  });

  it("processValidMove with empty bag leaves rack shorter (no draw)", () => {
    const gm = makeGame({ tileBag: [] });
    gm.processValidMove(centerCasaMove(gm.gameState.players[0].rack), 10);
    // Used 4 tiles, drew 0 → rack is 3.
    expect(gm.gameState.players[0].rack.length).toBe(3);
  });
});
