import { describe, it, expect } from "vitest";
import { calculateMoveScore, findAllWords, extractWord } from "../score";
import { createEmptyBoard, withTilePlaced } from "../board";
import { getLetterValue } from "../tile-distribution";
import type { Tile, TilePlacement } from "../types";

function tile(letter: string, opts: Partial<Tile> = {}): Tile {
  return {
    letter,
    value: opts.value ?? getLetterValue(letter),
    isBlank: opts.isBlank ?? false,
    assignedLetter: opts.assignedLetter,
    id: opts.id ?? `tile_${letter}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

function place(word: string, row: number, startCol: number, isNew = true) {
  let board = createEmptyBoard();
  const placements: TilePlacement[] = [];
  for (let i = 0; i < word.length; i++) {
    const t = tile(word[i]);
    const col = startCol + i;
    board = withTilePlaced(board, row, col, t, isNew);
    placements.push({ row, col, tile: t, rackIndex: i });
  }
  return { board, placements };
}

describe("score-adversarial: bonus stacking + cross-words + bingo", () => {
  it("CENTER applies DOUBLE_WORD to a newly-placed tile (CASA at center = 10)", () => {
    const { board, placements } = place("CASA", 7, 7);
    expect(calculateMoveScore(board, placements)).toBe(10);
  });

  it("DOUBLE_LETTER doubles a newly-placed tile's value (CASA at (7,3) = 7)", () => {
    const { board, placements } = place("CASA", 7, 3);
    expect(calculateMoveScore(board, placements)).toBe(7);
  });

  it("TRIPLE_WORD + DOUBLE_LETTER stacking: CASAS at (0,3)-(0,7) = 24", () => {
    // C(0,3)=DOUBLE_LETTER → 2×2=4; A(0,4)=1; S(0,5)=1; A(0,6)=1; S(0,7)=TRIPLE_WORD.
    // wordScore = (4+1+1+1+1) × 3 = 24.
    const { board, placements } = place("CASAS", 0, 3);
    expect(calculateMoveScore(board, placements)).toBe(24);
  });

  it("TRIPLE_LETTER triples a newly-placed tile's value (CA at (1,5) = 7)", () => {
    // (1,5)=TRIPLE_LETTER. C=2×3=6; A=1. Sum=7, no word mult.
    const { board, placements } = place("CA", 1, 5);
    expect(calculateMoveScore(board, placements)).toBe(7);
  });

  it("DOUBLE_WORD doubles the word score (CA at (1,1) = 6)", () => {
    // (1,1)=DOUBLE_WORD. C=2; A=1. Sum=3, ×2=6.
    const { board, placements } = place("CA", 1, 1);
    expect(calculateMoveScore(board, placements)).toBe(6);
  });

  it("TRIPLE_WORD only (no letter bonus): CA at (0,0) = 9", () => {
    // (0,0)=TRIPLE_WORD. C=2; A=1. Sum=3, ×3=9.
    const { board, placements } = place("CA", 0, 0);
    expect(calculateMoveScore(board, placements)).toBe(9);
  });

  it("bingo: 7-tile placement adds +50 (AAAAAAA at (5,2)-(5,8) = 59)", () => {
    // (5,5)=TRIPLE_LETTER → A=1×3=3; others A=1 each. Sum=1+1+1+3+1+1+1=9. +50=59.
    const { board, placements } = place("AAAAAAA", 5, 2);
    expect(calculateMoveScore(board, placements)).toBe(59);
  });

  it("empty placement list scores 0", () => {
    const board = createEmptyBoard();
    expect(calculateMoveScore(board, [])).toBe(0);
  });

  it("single isolated tile scores 0 (no words of length >= 2)", () => {
    const t = tile("C");
    const board = withTilePlaced(createEmptyBoard(), 5, 5, t, true);
    const placements: TilePlacement[] = [{ row: 5, col: 5, tile: t, rackIndex: 0 }];
    expect(calculateMoveScore(board, placements)).toBe(0);
  });

  it("findAllWords returns the main horizontal word", () => {
    const { board, placements } = place("CASA", 7, 7);
    const words = findAllWords(board, placements);
    // Main horizontal CASA (length 4) must be present.
    expect(words.some((w) => extractWord(w) === "CASA")).toBe(true);
  });

  it("findAllWords returns a perpendicular word when a new tile extends an existing tile", () => {
    // Pre-place "CA" horizontally at (7,7)-(7,8) as EXISTING (isNew=false).
    let board = createEmptyBoard();
    const ca = tile("C"), aa = tile("A");
    board = withTilePlaced(board, 7, 7, ca, false);
    board = withTilePlaced(board, 7, 8, aa, false);
    // Place "S" at (8,8) — forms vertical "AS" (A at (7,8) + S at (8,8)).
    const s = tile("S");
    board = withTilePlaced(board, 8, 8, s, true);
    const placements: TilePlacement[] = [{ row: 8, col: 8, tile: s, rackIndex: 0 }];
    const words = findAllWords(board, placements);
    // The perpendicular vertical word "AS" must be found.
    expect(words.some((w) => extractWord(w) === "AS")).toBe(true);
  });

  it("extractWord uses assignedLetter for blank tiles", () => {
    const blank = tile(" ", { isBlank: true, assignedLetter: "C", value: 0 });
    const board = withTilePlaced(createEmptyBoard(), 7, 7, blank, true);
    const cells = [board.cells[7][7]];
    expect(extractWord(cells)).toBe("C");
  });

  it("extractWord returns '' for cells without tiles", () => {
    const board = createEmptyBoard();
    expect(extractWord([board.cells[0][0]])).toBe("");
  });

  it("bonus does NOT apply to pre-existing (non-newly-placed) tiles", () => {
    // Pre-place C at CENTER (7,7) as existing — CENTER bonus should NOT apply.
    const existingC = tile("C");
    let board = withTilePlaced(createEmptyBoard(), 7, 7, existingC, false);
    // Place "AS" at (7,8)-(7,9) as new — forms "CAS" with the existing C.
    const a = tile("A"), s = tile("S");
    board = withTilePlaced(board, 7, 8, a, true);
    board = withTilePlaced(board, 7, 9, s, true);
    const placements: TilePlacement[] = [
      { row: 7, col: 8, tile: a, rackIndex: 0 },
      { row: 7, col: 9, tile: s, rackIndex: 1 },
    ];
    // C(7,7)=2 (no bonus — not newly placed); A(7,8)=1; S(7,9)=1.
    // Sum=4, no word mult (CENTER bonus only applies to newly-placed).
    expect(calculateMoveScore(board, placements)).toBe(4);
  });
});
