import { describe, it, expect } from "vitest";
import { calculateMoveScore, findAllWords, extractWord } from "../score";
import { createEmptyBoard, withTilePlaced, SIZE, CENTER } from "../board";
import { getLetterValue } from "../tile-distribution";
import type { Tile } from "../types";

// Helper: build a tile from a letter using the real distribution's value.
function tile(letter: string): Tile {
  return {
    letter,
    value: getLetterValue(letter),
    isBlank: false,
    id: `tile_${letter}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

// Helper: place a horizontal word starting at (row, col).
function placeHorizontal(word: string, row: number, startCol: number) {
  let board = createEmptyBoard();
  const placements: { row: number; col: number; tile: Tile; rackIndex: number }[] = [];
  for (let i = 0; i < word.length; i++) {
    const t = tile(word[i]);
    const row_ = row;
    const col_ = startCol + i;
    board = withTilePlaced(board, row_, col_, t, true);
    placements.push({ row: row_, col: col_, tile: t, rackIndex: i });
  }
  return { board, placements };
}

describe("score: calculateMoveScore + findAllWords + extractWord", () => {
  it("returns 0 for an empty placement list", () => {
    const board = createEmptyBoard();
    expect(calculateMoveScore(board, [])).toBe(0);
  });

  it("CASA on CENTER (7,7)-(7,10) scores 10 (sum 5 ×2 CENTER word bonus)", () => {
    // Verify the bonus layout assumption: (7,7) is CENTER.
    expect(SIZE).toBe(15);
    expect(CENTER).toBe(7);
    // C=2, A=1, S=1, A=1 → sum 5; CENTER is a DOUBLE_WORD for newly-placed tiles.
    expect(getLetterValue("C")).toBe(2);
    expect(getLetterValue("A")).toBe(1);
    expect(getLetterValue("S")).toBe(1);

    const { board, placements } = placeHorizontal("CASA", 7, 7);
    expect(calculateMoveScore(board, placements)).toBe(10);
  });

  it("CASA on DOUBLE_LETTER (7,3) scores 7 (C value 2 ×2 = 4, rest 1+1+1)", () => {
    // (7,3) is in doubleLetterPositions per board.ts.
    const { board, placements } = placeHorizontal("CASA", 7, 3);
    expect(calculateMoveScore(board, placements)).toBe(7);
  });

  it("board sanity: SIZE === 15 and CENTER === 7", () => {
    expect(SIZE).toBe(15);
    expect(CENTER).toBe(7);
  });

  it("extractWord returns 'CASA' for the horizontal cells", () => {
    const { board, placements } = placeHorizontal("CASA", 7, 7);
    const words = findAllWords(board, placements);
    // The main word is the horizontal CASA — find it (length 4).
    const casa = words.find((w) => w.length === 4);
    expect(casa).toBeDefined();
    expect(extractWord(casa!)).toBe("CASA");
  });

  it("a single-tile placement yields no words (length < 2 dropped)", () => {
    const t = tile("C");
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    const placements = [{ row: 7, col: 7, tile: t, rackIndex: 0 }];
    const words = findAllWords(board, placements);
    // Single tile → mainWord length 1 (dropped), no perpendicular words.
    expect(words.length).toBe(0);
    expect(calculateMoveScore(board, placements)).toBe(0);
  });
});
