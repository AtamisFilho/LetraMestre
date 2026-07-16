import { describe, it, expect } from "vitest";
import { GameManager } from "../game-manager";
import type { MoveData, Tile, GameState } from "../types";
import { createEmptyBoard, getCell, isBoardEmpty, isCenterOccupied, withTilePlaced, clearNewTiles, confirmNewTiles, SIZE, CENTER } from "../board";

let tc = 0;
function tile(letter: string, value: number, isBlank = false, assignedLetter?: string): Tile {
  return { letter, value, isBlank, assignedLetter, id: `r5_${++tc}` };
}

function freshGame(): GameManager {
  const gm = new GameManager("g_r5", "R5R5R5");
  gm.addPlayer("Alice");
  gm.addPlayer("Bob");
  gm.startGame();
  return gm;
}

/**
 * Round 5 adversarial — hunt for bugs in the anti-cheat and board logic that
 * prior rounds missed. Several of these are CRITICAL.
 */
describe("CRITICAL: rack anti-cheat — tile mutation bypass", () => {
  it("rejects a tile whose LETTER was mutated (same id, different letter)", () => {
    // The rack integrity check only compared tile.id. A malicious client can
    // take an "A" from their rack, change its letter to "Q" (keeping the id),
    // and the check would pass — effectively turning an A into a Q.
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const realRack = gm.gameState.players[0].rack;
    // Force rack to [C, A, S, A, ...]
    const knownRack: Tile[] = [
      { letter: "C", value: 2, isBlank: false, id: "mut_c" },
      { letter: "A", value: 1, isBlank: false, id: "mut_a" },
      ...realRack.slice(2),
    ];
    gm.loadState({
      ...gm.gameState,
      players: [
        { ...gm.gameState.players[0], rack: knownRack },
        ...gm.gameState.players.slice(1),
      ],
    }, gm.getTileBagState());

    // Forged tile: same id "mut_a" but letter changed from "A" to "Q".
    const forgedTile: Tile = { letter: "Q", value: 8, isBlank: false, id: "mut_a" };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: { ...knownRack[0] }, rackIndex: 0 }, // C (genuine)
        { row: 7, col: 8, tile: forgedTile, rackIndex: 1 }, // A→Q forged
      ],
    };
    const v = gm.validateMove(move);
    // BUG: if this passes, the client turned an "A" into a "Q".
    expect(v.type).not.toBe("Valid");
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a tile whose VALUE was mutated (same id, different value)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const realRack = gm.gameState.players[0].rack;
    const knownRack: Tile[] = [
      { letter: "A", value: 1, isBlank: false, id: "val_a" },
      { letter: "O", value: 1, isBlank: false, id: "val_o" },
      ...realRack.slice(2),
    ];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, gm.getTileBagState());

    // Forged: same id "val_a" but value changed from 1 to 99.
    const forgedTile: Tile = { letter: "A", value: 99, isBlank: false, id: "val_a" };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: forgedTile, rackIndex: 0 },
        { row: 7, col: 8, tile: { ...knownRack[1] }, rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a tile whose isBlank was mutated (non-blank → blank)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const realRack = gm.gameState.players[0].rack;
    const knownRack: Tile[] = [
      { letter: "A", value: 1, isBlank: false, id: "blk_a" },
      { letter: "O", value: 1, isBlank: false, id: "blk_o" },
      ...realRack.slice(2),
    ];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, gm.getTileBagState());

    // Forged: same id but isBlank flipped to true (with assignedLetter "Q").
    const forgedTile: Tile = { letter: "A", value: 1, isBlank: true, assignedLetter: "Q", id: "blk_a" };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: forgedTile, rackIndex: 0 },
        { row: 7, col: 8, tile: { ...knownRack[1] }, rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });
});

describe("CRITICAL: processValidMove uses server-trusted tile, not client-sent", () => {
  it("places the RACK tile on the board, not the client's (possibly forged) tile", () => {
    // Even if validateMove is strengthened, processValidMove must use the
    // server's rack tile — not placement.tile — when placing on the board.
    // Otherwise a client that passes validateMove with a genuine id but a
    // forged letter (via a race or a bypassed check) would get the forged
    // letter on the board.
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const realRack = gm.gameState.players[0].rack;
    // Force rack: [A, O, ...] to form "AO" at center.
    const knownRack: Tile[] = [
      { letter: "A", value: 1, isBlank: false, id: "pv_a" },
      { letter: "O", value: 1, isBlank: false, id: "pv_o" },
      ...realRack.slice(2),
    ];
    gm.loadState({
      ...gm.gameState,
      players: [{ ...gm.gameState.players[0], rack: knownRack }, ...gm.gameState.players.slice(1)],
    }, gm.getTileBagState());

    // Send the genuine tiles but with a forged letter on rackIndex 0.
    // (If validateMove is properly strict, this would be rejected. But we
    // test processValidMove directly to ensure defense-in-depth: even if
    // validateMove is bypassed, the board gets the SERVER tile.)
    const serverTileA = knownRack[0];
    const forgedTileA: Tile = { ...serverTileA, letter: "Q", value: 8 };
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: forgedTileA, rackIndex: 0 }, // forged
        { row: 7, col: 8, tile: { ...knownRack[1] }, rackIndex: 1 }, // genuine
      ],
    };
    // processValidMove is called AFTER validateMove passes. To test it in
    // isolation, we call it directly (bypassing validateMove).
    gm.processValidMove(move, 4);
    // The board cell at (7,7) should have the SERVER's "A", NOT the forged "Q".
    const placedTile = getCell(gm.gameState.board, 7, 7)?.tile;
    expect(placedTile).toBeTruthy();
    expect(placedTile!.letter).toBe("A"); // server tile, not forged "Q"
    expect(placedTile!.value).toBe(1); // server value, not forged 8
  });
});

describe("BUG: out-of-bounds placements silently dropped", () => {
  it("rejects a placement with row=15 (out of bounds) instead of silently ignoring it", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    // Place a tile at row=15 (out of bounds, SIZE=15 so valid rows are 0-14).
    // Also place a valid tile at center to form a "word".
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 7, tile: rack[0], rackIndex: 0 },
        { row: 15, col: 7, tile: rack[1], rackIndex: 1 }, // OUT OF BOUNDS
      ],
    };
    const v = gm.validateMove(move);
    // BUG: if this is "Valid", the out-of-bounds tile was silently dropped.
    expect(v.type).toBe("InvalidPlacement");
    if (v.type === "InvalidPlacement") expect(v.reason).toMatch(/fora do tabuleiro|inválid/i);
  });

  it("rejects a placement with row=-1 (negative)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: -1, col: 7, tile: rack[0], rackIndex: 0 },
        { row: 7, col: 7, tile: rack[1], rackIndex: 1 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });

  it("rejects a placement with col=15 (out of bounds)", () => {
    const gm = freshGame();
    const p1 = gm.gameState.players[0].id;
    const rack = gm.gameState.players[0].rack;
    const move: MoveData = {
      playerId: p1,
      placements: [
        { row: 7, col: 15, tile: rack[0], rackIndex: 0 },
      ],
    };
    const v = gm.validateMove(move);
    expect(v.type).toBe("InvalidPlacement");
  });
});

describe("board.ts — getCell bounds", () => {
  it("returns null for negative row", () => {
    const b = createEmptyBoard();
    expect(getCell(b, -1, 0)).toBeNull();
  });
  it("returns null for negative col", () => {
    const b = createEmptyBoard();
    expect(getCell(b, 0, -1)).toBeNull();
  });
  it("returns null for row=SIZE (out of bounds)", () => {
    const b = createEmptyBoard();
    expect(getCell(b, SIZE, 0)).toBeNull();
  });
  it("returns null for col=SIZE (out of bounds)", () => {
    const b = createEmptyBoard();
    expect(getCell(b, 0, SIZE)).toBeNull();
  });
  it("returns the cell for valid bounds (0,0) and (SIZE-1, SIZE-1)", () => {
    const b = createEmptyBoard();
    expect(getCell(b, 0, 0)).toBeTruthy();
    expect(getCell(b, SIZE - 1, SIZE - 1)).toBeTruthy();
  });
});

describe("board.ts — isBoardEmpty / isCenterOccupied", () => {
  it("isBoardEmpty returns true for a fresh board", () => {
    expect(isBoardEmpty(createEmptyBoard())).toBe(true);
  });
  it("isBoardEmpty returns false after placing a tile anywhere", () => {
    const b = createEmptyBoard();
    const t = tile("A", 1);
    const b2 = withTilePlaced(b, 0, 0, t);
    expect(isBoardEmpty(b2)).toBe(false);
    // Original is unchanged (immutability).
    expect(isBoardEmpty(b)).toBe(true);
  });
  it("isCenterOccupied returns false for a fresh board", () => {
    expect(isCenterOccupied(createEmptyBoard())).toBe(false);
  });
  it("isCenterOccupied returns true after placing a tile at center", () => {
    const b = createEmptyBoard();
    const t = tile("A", 1);
    const b2 = withTilePlaced(b, CENTER, CENTER, t);
    expect(isCenterOccupied(b2)).toBe(true);
  });
  it("isCenterOccupied returns false after placing a tile OFF center", () => {
    const b = createEmptyBoard();
    const t = tile("A", 1);
    const b2 = withTilePlaced(b, 0, 0, t);
    expect(isCenterOccupied(b2)).toBe(false);
  });
});

describe("board.ts — withTilePlaced immutability", () => {
  it("does not mutate the original board", () => {
    const b = createEmptyBoard();
    const t = tile("A", 1);
    const b2 = withTilePlaced(b, 5, 5, t);
    // Original board cell (5,5) still has no tile.
    expect(getCell(b, 5, 5)?.tile).toBeNull();
    // New board cell (5,5) has the tile.
    expect(getCell(b2, 5, 5)?.tile).toBe(t);
  });
  it("overwrites an existing tile at the same cell (isNew param)", () => {
    const b = createEmptyBoard();
    const t1 = tile("A", 1);
    const t2 = tile("B", 3);
    const b1 = withTilePlaced(b, 5, 5, t1, true);
    const b2 = withTilePlaced(b1, 5, 5, t2, false);
    expect(getCell(b2, 5, 5)?.tile).toBe(t2);
    expect(getCell(b2, 5, 5)?.isNewlyPlaced).toBe(false);
  });
});

describe("board.ts — clearNewTiles / confirmNewTiles", () => {
  it("clearNewTiles removes ONLY newly-placed tiles (sets tile to null)", () => {
    const b = createEmptyBoard();
    const t1 = tile("A", 1);
    const t2 = tile("B", 3);
    // t1 at (5,5) as newly placed; t2 at (5,6) as permanent.
    const b1 = withTilePlaced(b, 5, 5, t1, true);
    const b2 = withTilePlaced(b1, 5, 6, t2, false);
    const cleared = clearNewTiles(b2);
    expect(getCell(cleared, 5, 5)?.tile).toBeNull(); // new tile removed
    expect(getCell(cleared, 5, 6)?.tile).toBe(t2); // permanent kept
  });
  it("confirmNewTiles sets isNewlyPlaced=false for all new tiles, keeps the tile", () => {
    const b = createEmptyBoard();
    const t1 = tile("A", 1);
    const b1 = withTilePlaced(b, 5, 5, t1, true);
    expect(getCell(b1, 5, 5)?.isNewlyPlaced).toBe(true);
    const confirmed = confirmNewTiles(b1);
    expect(getCell(confirmed, 5, 5)?.tile).toBe(t1); // tile kept
    expect(getCell(confirmed, 5, 5)?.isNewlyPlaced).toBe(false); // flag cleared
  });
});
