import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import { createEmptyBoard, withTilePlaced, CENTER } from "../board";
import { generateAllTiles, getLetterValue } from "../tile-distribution";
import type { GameState, Tile, MoveData, Player, Board } from "../types";

function tile(letter: string, opts: Partial<Tile> = {}): Tile {
  return {
    letter,
    value: opts.value ?? getLetterValue(letter),
    isBlank: opts.isBlank ?? false,
    assignedLetter: opts.assignedLetter,
    id: opts.id ?? `tile_${letter}_${Math.random().toString(36).slice(2, 10)}`,
  };
}

function makeGame(opts: {
  phase?: GameState["phase"];
  currentPlayerIndex?: number;
  board?: Board;
  players?: Player[];
  pendingMoveData?: MoveData | null;
} = {}): GameManager {
  const gm = new GameManager("game_adv", "ADV001");
  const rack1 = opts.players?.[0]?.rack ?? [tile("C"), tile("A"), tile("S"), tile("A"), tile("E"), tile("O"), tile("R")];
  const rack2 = opts.players?.[1]?.rack ?? [tile("B"), tile("D"), tile("F"), tile("G"), tile("H"), tile("I"), tile("J")];
  const state: GameState = {
    board: opts.board ?? createEmptyBoard(),
    players: opts.players ?? [
      { id: "p1", name: "Alice", score: 0, rack: rack1, isHost: true, isConnected: true, joinOrder: 0 },
      { id: "p2", name: "Bob", score: 0, rack: rack2, isHost: false, isConnected: true, joinOrder: 1 },
    ],
    currentPlayerIndex: opts.currentPlayerIndex ?? 0,
    tileBagCount: 100,
    phase: opts.phase ?? "IN_PROGRESS",
    lastPlayedWord: null,
    lastPlayedScore: 0,
    consecutivePasses: 0,
    pendingValidationWord: null,
    pendingValidationPlayerId: null,
    pendingMoveData: opts.pendingMoveData ?? null,
    gameId: "game_adv",
    gameCode: "ADV001",
  };
  gm.loadState(state, generateAllTiles());
  return gm;
}

// Build a valid first move covering center: CASA at (7,7)-(7,10).
function centerCasaMove(rack: Tile[]): MoveData {
  return {
    playerId: "p1",
    placements: [
      { row: 7, col: 7, tile: rack[0], rackIndex: 0 }, // C
      { row: 7, col: 8, tile: rack[1], rackIndex: 1 }, // A
      { row: 7, col: 9, tile: rack[2], rackIndex: 2 }, // S
      { row: 7, col: 10, tile: rack[3], rackIndex: 3 }, // A
    ],
  };
}

describe("adversarial: phase gates", () => {
  it("rejects a move during GAME_OVER", () => {
    const gm = makeGame({ phase: "GAME_OVER" });
    const move = centerCasaMove(gm.gameState.players[0].rack);
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a move during WAITING_FOR_PLAYERS", () => {
    const gm = makeGame({ phase: "WAITING_FOR_PLAYERS" });
    const move = centerCasaMove(gm.gameState.players[0].rack);
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a FRESH move during VALIDATION_PENDING (only the exact pending move may be re-validated)", () => {
    const gm = makeGame({ phase: "VALIDATION_PENDING" });
    const freshMove = centerCasaMove(gm.gameState.players[0].rack);
    const v = gm.validateMove(freshMove);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("allows re-validation of the EXACT pending move during VALIDATION_PENDING (approveWord path)", () => {
    // The pending move must use the SAME tile objects as the player's rack so
    // the rack-integrity check (tile.id === rack[rackIndex].id) passes.
    const rack = [tile("C"), tile("A"), tile("S"), tile("A"), tile("E"), tile("O"), tile("R")];
    const pendingMove = centerCasaMove(rack);
    const gm = makeGame({ phase: "VALIDATION_PENDING", pendingMoveData: pendingMove, players: [{ id: "p1", name: "Alice", score: 0, rack, isHost: true, isConnected: true, joinOrder: 0 }] });
    // Re-validate the SAME reference.
    const v = gm.validateMove(pendingMove);
    // The pending move covers center on an empty board → should be Valid (all words real).
    expect(v.type).toBe("Valid");
  });
});

describe("adversarial: rack anti-cheat", () => {
  it("rejects a forged tile (tile.id doesn't match the rack slot's tile)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const forged = tile("C"); // same letter, different id
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: forged, rackIndex: 0 }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a cross-rack swap (rackIndex 0 but tile is from rack slot 1)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[1], rackIndex: 0 }], // tile A at index 0 (which is C)
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a negative rackIndex", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: -1 }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects an overflow rackIndex (>= rack.length)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: rack.length }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a non-integer rackIndex (NaN)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: NaN }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a duplicate rackIndex (same physical tile spent in two cells)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 },
        { row: 7, col: 8, tile: rack[0], rackIndex: 0 }, // duplicate
      ],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("accepts a blank tile with assignedLetter that matches the rack slot", () => {
    const blank = tile(" ", { isBlank: true, assignedLetter: "C", value: 0 });
    const gm = makeGame({
      players: [{
        id: "p1", name: "Alice", score: 0, rack: [blank, tile("A"), tile("S"), tile("A")],
        isHost: true, isConnected: true, joinOrder: 0,
      }, {
        id: "p2", name: "Bob", score: 0, rack: [tile("X")], isHost: false, isConnected: true, joinOrder: 1,
      }],
    });
    const v = gm.validateMove({
      playerId: "p1",
      placements: [
        { row: 7, col: 7, tile: blank, rackIndex: 0 }, // blank assigned "C" at center
        { row: 7, col: 8, tile: gm.gameState.players[0].rack[1], rackIndex: 1 }, // A
        { row: 7, col: 9, tile: gm.gameState.players[0].rack[2], rackIndex: 2 }, // S
        { row: 7, col: 10, tile: gm.gameState.players[0].rack[3], rackIndex: 3 }, // A
      ],
    });
    // "CASA" forms — blank assignedLetter "C" + A + S + A.
    expect(v.type).toBe("Valid");
  });

  it("rejects gracefully when the rack is empty (no crash on rack[0].id)", () => {
    const gm = makeGame({
      players: [{
        id: "p1", name: "Alice", score: 0, rack: [],
        isHost: true, isConnected: true, joinOrder: 0,
      }, {
        id: "p2", name: "Bob", score: 0, rack: [tile("X")], isHost: false, isConnected: true, joinOrder: 1,
      }],
    });
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: tile("C"), rackIndex: 0 }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects duplicate (row,col) in placements", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 },
        { row: 7, col: 7, tile: rack[1], rackIndex: 1 }, // same cell
      ],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a placement on an already-occupied prior cell", () => {
    // Pre-place a tile on the board (existing, not newly placed).
    const board = withTilePlaced(createEmptyBoard(), 7, 7, tile("X"), false);
    const gm = makeGame({ board });
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: 0 }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });
});

describe("adversarial: approveWord / rejectWord noop", () => {
  it("approveWord is a noop on game state when no pending move (phase stays IN_PROGRESS)", () => {
    const gm = makeGame({ phase: "IN_PROGRESS", pendingMoveData: null });
    gm.approveWord("SOMEWORD");
    expect(gm.gameState.phase).toBe("IN_PROGRESS");
    expect(gm.gameState.pendingMoveData).toBeNull();
  });

  it("rejectWord is a noop when no pending move (phase stays IN_PROGRESS)", () => {
    const gm = makeGame({ phase: "IN_PROGRESS", pendingMoveData: null });
    gm.rejectWord();
    expect(gm.gameState.phase).toBe("IN_PROGRESS");
    expect(gm.gameState.pendingMoveData).toBeNull();
  });
});

describe("adversarial: exchangeTiles guards", () => {
  it("rejects empty indices (no-op, doesn't burn the turn)", () => {
    const gm = makeGame();
    const before = gm.gameState.currentPlayerIndex;
    gm.exchangeTiles("p1", []);
    expect(gm.gameState.currentPlayerIndex).toBe(before); // turn NOT advanced
  });

  it("dedupes duplicate indices ([0,0,0] exchanges only 1 tile)", () => {
    const gm = makeGame();
    const rackBefore = gm.gameState.players[0].rack.length;
    gm.exchangeTiles("p1", [0, 0, 0]);
    // 3 dups → 1 unique → exchange 1 tile. Rack size stays 7 (1 returned, 1 drawn).
    expect(gm.gameState.players[0].rack.length).toBe(rackBefore);
  });

  it("rejects out-of-range indices (no exchange, no turn advance)", () => {
    const gm = makeGame();
    const before = gm.gameState.currentPlayerIndex;
    const rackBefore = gm.gameState.players[0].rack;
    gm.exchangeTiles("p1", [99]);
    expect(gm.gameState.currentPlayerIndex).toBe(before);
    expect(gm.gameState.players[0].rack).toBe(rackBefore); // unchanged
  });

  it("rejects when the bag has fewer tiles than requested", () => {
    const gm = makeGame();
    // Drain the bag by loading an empty tileBag state.
    gm.loadState({ ...gm.gameState, tileBagCount: 0 }, []);
    const before = gm.gameState.currentPlayerIndex;
    gm.exchangeTiles("p1", [0, 1, 2]);
    expect(gm.gameState.currentPlayerIndex).toBe(before); // turn NOT advanced
  });

  it("rejects exchange by a non-current player", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    const before = gm.gameState.currentPlayerIndex;
    gm.exchangeTiles("p2", [0]); // p2 is not current
    expect(gm.gameState.currentPlayerIndex).toBe(before);
  });
});

describe("adversarial: passTurn guards", () => {
  it("rejects pass by a non-current player", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    const before = gm.gameState.currentPlayerIndex;
    gm.passTurn("p2");
    expect(gm.gameState.currentPlayerIndex).toBe(before);
  });

  it("rejects pass during GAME_OVER (no turn advance, no revive)", () => {
    const gm = makeGame({ phase: "GAME_OVER" });
    const before = gm.gameState.currentPlayerIndex;
    gm.passTurn("p1");
    expect(gm.gameState.phase).toBe("GAME_OVER");
    expect(gm.gameState.currentPlayerIndex).toBe(before);
  });
});

describe("adversarial: processValidMove turn lifecycle", () => {
  it("advances the turn after a valid move", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    const move = centerCasaMove(gm.gameState.players[0].rack);
    gm.processValidMove(move, 10);
    expect(gm.gameState.currentPlayerIndex).toBe(1); // advanced to p2
  });

  it("resets consecutivePasses to 0 after a valid move", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    // Load a state with consecutivePasses > 0.
    gm.loadState({ ...gm.gameState, consecutivePasses: 3 }, generateAllTiles());
    const move = centerCasaMove(gm.gameState.players[0].rack);
    gm.processValidMove(move, 10);
    expect(gm.gameState.consecutivePasses).toBe(0);
  });
});

describe("adversarial: first-move + non-current + forged fields", () => {
  it("rejects a first move that doesn't cover the center", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    // Place at (0,0)-(0,3) — doesn't cover (7,7).
    const v = gm.validateMove({
      playerId: "p1",
      placements: [
        { row: 0, col: 0, tile: rack[0], rackIndex: 0 },
        { row: 0, col: 1, tile: rack[1], rackIndex: 1 },
        { row: 0, col: 2, tile: rack[2], rackIndex: 2 },
        { row: 0, col: 3, tile: rack[3], rackIndex: 3 },
      ],
    });
    expect(v.type).toBe("InvalidPlacement");
    expect(CENTER).toBe(7);
  });

  it("rejects a move from a non-current player", () => {
    const gm = makeGame({ currentPlayerIndex: 0 });
    const rack = gm.gameState.players[1].rack; // p2's rack
    const v = gm.validateMove({
      playerId: "p2", // not the current player (p1)
      placements: [{ row: 7, col: 7, tile: rack[0], rackIndex: 0 }],
    });
    expect(v.type).toBe("InvalidPlacement");
  });

  it("ignores forged extra fields on MoveData/placements (doesn't crash, validates normally)", () => {
    const gm = makeGame();
    const rack = gm.gameState.players[0].rack;
    const v = gm.validateMove({
      playerId: "p1",
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0, hack: true, score: 999 },
        { row: 7, col: 8, tile: rack[1], rackIndex: 1, extra: "forge" },
        { row: 7, col: 9, tile: rack[2], rackIndex: 2 },
        { row: 7, col: 10, tile: rack[3], rackIndex: 3 },
      ],
      // @ts-expect-error — forging an extra field on MoveData
      forgedField: "should-be-ignored",
    } as MoveData);
    expect(v.type).toBe("Valid");
  });
});
