import { describe, it, expect } from "vitest";
import {
  TileBag,
  generateAllTiles,
  getLetterValue,
  shuffleArray,
  getTotalTileCount,
} from "../tile-distribution";
import type { Tile } from "../types";

describe("TileBag: draw edge cases", () => {
  it("draw(0) returns empty array and doesn't drain the bag", () => {
    const bag = new TileBag();
    const before = bag.remainingCount();
    const drawn = bag.draw(0);
    expect(drawn).toEqual([]);
    expect(bag.remainingCount()).toBe(before);
  });

  it("draw(-1) returns empty array (clamped via Math.min)", () => {
    const bag = new TileBag();
    const drawn = bag.draw(-1);
    expect(drawn).toEqual([]);
    expect(bag.remainingCount()).toBe(getTotalTileCount());
  });

  it("draw(NaN) returns empty array (Math.min(NaN, len) → NaN → slice(0,NaN) → [])", () => {
    const bag = new TileBag();
    const drawn = bag.draw(NaN);
    expect(drawn).toEqual([]);
    expect(bag.remainingCount()).toBe(getTotalTileCount());
  });

  it("draw(over) returns all remaining tiles and empties the bag", () => {
    const bag = new TileBag();
    const total = bag.remainingCount();
    const drawn = bag.draw(total + 100);
    expect(drawn.length).toBe(total);
    expect(bag.remainingCount()).toBe(0);
    expect(bag.isEmpty()).toBe(true);
  });

  it("draw on empty bag returns empty array", () => {
    const bag = new TileBag();
    bag.draw(bag.remainingCount()); // drain
    expect(bag.isEmpty()).toBe(true);
    expect(bag.draw(5)).toEqual([]);
  });

  it("returnTiles puts tiles back and reshuffles", () => {
    const bag = new TileBag();
    const drawn = bag.draw(5);
    const before = bag.remainingCount();
    bag.returnTiles(drawn);
    expect(bag.remainingCount()).toBe(before + 5);
  });
});

describe("TileBag: loadState defensive copy", () => {
  it("loadState copies the array — mutating the input afterwards doesn't affect the bag", () => {
    const bag = new TileBag();
    const state: Tile[] = bag.getState();
    const snapshot = [...state];
    // Pass the same array reference, then mutate it.
    bag.loadState(state);
    state.push({
      letter: "Z",
      value: 8,
      isBlank: false,
      id: "tile_injected",
    });
    // Bag should NOT contain the injected tile.
    expect(bag.remainingCount()).toBe(snapshot.length);
    expect(bag.getState().some((t) => t.id === "tile_injected")).toBe(false);
  });

  it("getState returns a copy — mutating it doesn't affect the bag", () => {
    const bag = new TileBag();
    const state = bag.getState();
    const lenBefore = bag.remainingCount();
    state.pop();
    expect(bag.remainingCount()).toBe(lenBefore);
  });
});

describe("generateAllTiles: counts and values", () => {
  it("generates the expected total tile count (sum of DISTRIBUTION quantities)", () => {
    const tiles = generateAllTiles();
    // A=14 B=3 C=4 D=5 E=11 F=2 G=2 H=2 I=8 J=2 L=5 M=6 N=4 O=10 P=4
    // Q=1 R=6 S=8 T=5 U=7 V=2 X=1 Z=1 Ç=2 blank=3
    // = 14+3+4+5+11+2+2+2+8+2+5+6+4+10+4+1+6+8+5+7+2+1+1+2+3 = 118
    expect(tiles.length).toBe(getTotalTileCount());
    expect(getTotalTileCount()).toBe(118);
  });

  it("produces exactly 3 blank tiles with value 0", () => {
    const tiles = generateAllTiles();
    const blanks = tiles.filter((t) => t.isBlank);
    expect(blanks.length).toBe(3);
    expect(blanks.every((t) => t.value === 0 && t.letter === " ")).toBe(true);
  });

  it("produces exactly 14 A tiles with value 1", () => {
    const tiles = generateAllTiles();
    const aTiles = tiles.filter((t) => t.letter === "A" && !t.isBlank);
    expect(aTiles.length).toBe(14);
    expect(aTiles.every((t) => t.value === 1)).toBe(true);
  });

  it("produces exactly 1 Q tile with value 6", () => {
    const tiles = generateAllTiles();
    const qTiles = tiles.filter((t) => t.letter === "Q" && !t.isBlank);
    expect(qTiles.length).toBe(1);
    expect(qTiles[0].value).toBe(6);
  });

  it("produces exactly 1 X tile with value 8", () => {
    const tiles = generateAllTiles();
    const xTiles = tiles.filter((t) => t.letter === "X" && !t.isBlank);
    expect(xTiles.length).toBe(1);
    expect(xTiles[0].value).toBe(8);
  });

  it("produces exactly 2 Ç tiles with value 3", () => {
    const tiles = generateAllTiles();
    const cedilha = tiles.filter((t) => t.letter === "Ç" && !t.isBlank);
    expect(cedilha.length).toBe(2);
    expect(cedilha.every((t) => t.value === 3)).toBe(true);
  });

  it("every tile has a unique id", () => {
    const tiles = generateAllTiles();
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(tiles.length);
  });
});

describe("getLetterValue", () => {
  it("returns the documented value for each letter", () => {
    expect(getLetterValue("A")).toBe(1);
    expect(getLetterValue("E")).toBe(1);
    expect(getLetterValue("O")).toBe(1);
    expect(getLetterValue("C")).toBe(2);
    expect(getLetterValue("B")).toBe(3);
    expect(getLetterValue("Ç")).toBe(3);
    expect(getLetterValue("D")).toBe(2);
    expect(getLetterValue("Q")).toBe(6);
    expect(getLetterValue("X")).toBe(8);
    expect(getLetterValue("Z")).toBe(8);
  });

  it("returns 0 for blank/space", () => {
    expect(getLetterValue(" ")).toBe(0);
  });

  it("returns 0 for unknown letters", () => {
    expect(getLetterValue("W")).toBe(0);
    expect(getLetterValue("Y")).toBe(0);
    expect(getLetterValue("K")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(getLetterValue("a")).toBe(1);
    expect(getLetterValue("c")).toBe(2);
    expect(getLetterValue("ç")).toBe(3);
  });
});

describe("shuffleArray", () => {
  it("returns a new array (doesn't mutate input)", () => {
    const input = [1, 2, 3, 4, 5];
    const inputCopy = [...input];
    const shuffled = shuffleArray(input);
    expect(input).toEqual(inputCopy); // input unchanged
    expect(shuffled).not.toBe(input); // new reference
  });

  it("preserves the multiset of elements", () => {
    const input = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    const shuffled = shuffleArray(input);
    expect(shuffled.sort()).toEqual(input.sort());
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([42])).toEqual([42]);
  });
});
