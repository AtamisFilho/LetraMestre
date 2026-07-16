import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import type { MoveData, Tile } from "../types";

let tc = 0;
function tile(letter: string, value: number, isBlank = false, assignedLetter?: string): Tile {
  return { letter, value, isBlank, assignedLetter, id: `r6_${++tc}` };
}

function freshGame(): GameManager {
  const gm = new GameManager("g_r6", "R6R6R6");
  gm.addPlayer("Alice");
  gm.addPlayer("Bob");
  gm.startGame();
  return gm;
}

/**
 * Round 6 — verify the round-5 anti-cheat fix doesn't break blank tiles (where
 * assignedLetter is legitimately client-chosen) and probe adjacent branches.
 */
describe("anti-cheat: blank tile assignedLetter is client-chosen (not rejected)", () => {
  it("accepts a blank tile with an assignedLetter set by the client", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    // Force rack: [blank (assigned 'Q'), O, ...] to form "QO"... wait, QO isn't
    // a word. Use blank assigned as 'A' + 'O' → "AO" (valid).
    const blankTile: Tile = { letter: " ", value: 0, isBlank: true, id: "blk1" };
    const oTile: Tile = { letter: "O", value: 1, isBlank: false, id: "o1" };
    const knownRack: Tile[] = [blankTile, oTile, ...gm.gameState.players[0].rack.slice(2)];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, gm.getTileBagState());

    // Client assigns 'A' to the blank. The id/letter/value/isBlank all match
    // the server rack; only assignedLetter differs (client-chosen). Must pass.
    const clientBlank: Tile = { ...blankTile, assignedLetter: "A" };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: clientBlank, rackIndex: 0 },
        { row: 7, col: 8, tile: oTile, rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("Valid");
    if (v.type === "Valid") expect(v.words).toContain("AO");
  });

  it("rejects a blank tile whose letter was mutated to a non-blank letter", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const blankTile: Tile = { letter: " ", value: 0, isBlank: true, id: "blk2" };
    const oTile: Tile = { letter: "O", value: 1, isBlank: false, id: "o2" };
    const knownRack: Tile[] = [blankTile, oTile, ...gm.gameState.players[0].rack.slice(2)];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, gm.getTileBagState());

    // Forged: change letter from " " to "Q" (and isBlank stays true — a
    // contradiction). The isBlank matches but letter doesn't → must reject.
    const forged: Tile = { letter: "Q", value: 0, isBlank: true, assignedLetter: "Q", id: "blk2" };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: forged, rackIndex: 0 },
        { row: 7, col: 8, tile: oTile, rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });
});

describe("anti-cheat: non-integer rackIndex / row / col", () => {
  it("rejects a non-integer rackIndex (3.5)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: 3.5 }],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a non-integer row (7.5)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [{ row: 7.5, col: 7, tile: rack[0], rackIndex: 0 }],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects NaN row", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [{ row: NaN, col: 7, tile: rack[0], rackIndex: 0 }],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });
});

describe("validateMove: occupied-cell check (within the same move)", () => {
  it("rejects two placements targeting the SAME cell in one move", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 },
        { row: 7, col: 7, tile: rack[1], rackIndex: 1 }, // same cell!
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
    if (v.type === "InvalidPlacement") expect(v.reason).toMatch(/ocupada|fora do rack/i);
  });
});

describe("validateMove: connection check edge cases", () => {
  it("rejects a move that is diagonally adjacent (not orthogonally) to an existing tile", () => {
    // Scrabble requires orthogonal adjacency, not diagonal. A placement at
    // (6,6) is diagonal to an existing tile at (7,7) — should NOT count as
    // connected.
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    // Place a permanent tile at (7,7) center, then try to play at (6,6) which
    // is diagonal — no orthogonal neighbor.
    const rack = gm.gameState.players[0].rack;
    const board = gm.gameState.board;
    board.cells[7][7] = { ...board.cells[7][7], tile: { letter: "A", value: 1, isBlank: false, id: "perm" }, isNewlyPlaced: false };
    gm.loadState({ ...gm.gameState, board }, gm.getTileBagState());
    // (6,6) neighbors: (5,6),(7,6),(6,5),(6,7) — none have a tile (only (7,7) diagonal).
    const move: MoveData = {
      playerId: p1,
      placements: [{ row: 6, col: 6, tile: rack[0], rackIndex: 0 }],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
    if (v.type === "InvalidPlacement") expect(v.reason).toMatch(/conectar/i);
  });
});

describe("processValidMove: rack refill when bag is partially empty", () => {
  it("refills fewer tiles than used when the bag runs out", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    // Force rack: [A, O, ...] to form "AO". Bag has only 1 tile left.
    const knownRack: Tile[] = [
      { letter: "A", value: 1, isBlank: false, id: "pa" },
      { letter: "O", value: 1, isBlank: false, id: "po" },
      ...gm.gameState.players[0].rack.slice(2),
    ];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, [tile("X", 8)]); // bag has exactly 1 tile
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: knownRack[0], rackIndex: 0 },
        { row: 7, col: 8, tile: knownRack[1], rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("Valid");
    if (v.type !== "Valid") return;
    gm.processValidMove(move, v.score);
    // Used 2 tiles, drew 1 (bag had 1). Rack = 7 - 2 + 1 = 6.
    expect(gm.gameState.players[0].rack).toHaveLength(6);
    // Bag is now empty.
    expect(gm.gameState.tileBagCount).toBe(0);
  });
});

describe("exchangeTiles: edge cases after the dedup fix", () => {
  it("does nothing when the bag has fewer tiles than requested", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    // Bag has 1 tile, player tries to exchange 3.
    gm.loadState({ ...gm.gameState }, [tile("X", 8)]);
    const rackBefore = [...gm.gameState.players[0].rack];
    gm.exchangeTiles(p1, [0, 1, 2]);
    // Should be a no-op: rack unchanged, bag still 1.
    expect(gm.gameState.players[0].rack.map(t => t.id)).toEqual(rackBefore.map(t => t.id));
    expect(gm.gameState.tileBagCount).toBe(1);
  });

  it("does nothing on empty indices (no turn burned)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const stateBefore = gm.gameState;
    gm.exchangeTiles(p1, []);
    expect(gm.gameState).toBe(stateBefore); // unchanged reference
  });
});
