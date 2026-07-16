import { describe, it, expect } from "vitest";
import { normalizeWord, dictionary } from "../dictionary";

describe("dictionary: normalizeWord + isValidWord + banWord", () => {
  it("folds acute accent: café → CAFE", () => {
    expect(normalizeWord("café")).toBe("CAFE");
  });

  it("folds cedilla: ABRAÇO / abraço / AbRaÇo → ABRACO (regression)", () => {
    // Pre-fix bug: uppercasing before stripping left precomposed Ç intact.
    expect(normalizeWord("ABRAÇO")).toBe("ABRACO");
    expect(normalizeWord("abraço")).toBe("ABRACO");
    expect(normalizeWord("AbRaÇo")).toBe("ABRACO");
  });

  it("trims and uppercases: '  casa  ' → 'CASA'", () => {
    expect(normalizeWord("  casa  ")).toBe("CASA");
  });

  it("accepts CASA in any case", () => {
    expect(dictionary.isValidWord("CASA")).toBe(true);
    expect(dictionary.isValidWord("casa")).toBe(true);
  });

  it("rejects nonsense XYZWQ", () => {
    expect(dictionary.isValidWord("XYZWQ")).toBe(false);
  });

  it("rejects empty / 1-char inputs", () => {
    expect(dictionary.isValidWord("")).toBe(false);
    expect(dictionary.isValidWord("A")).toBe(false);
  });

  it("bans BOLO: valid → ban → invalid + isBanned", () => {
    // Use BOLO (not CASA) so the singleton ban doesn't poison other tests.
    expect(dictionary.isValidWord("BOLO")).toBe(true);
    dictionary.banWord("BOLO");
    expect(dictionary.isValidWord("BOLO")).toBe(false);
    expect(dictionary.isBanned("BOLO")).toBe(true);
  });
});
