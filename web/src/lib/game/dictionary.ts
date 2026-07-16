// Portuguese Brazilian Dictionary for LetraMestre.
//
// Single source of truth: `/shared/dictionary.pt-BR.json` at the repo root.
// That file is mirrored to `./dictionary.pt-br.json` (next to this module)
// by `web/scripts/sync-dictionary.mjs`. The local copy exists because
// Turbopack forbids imports that escape the web/ project root.
//
// API surface preserved exactly: `normalizeWord`, the `Dictionary` class
// with `isValidWord`/`addApprovedWord`/`banWord`/`isBanned`/`getWordCount`/
// `loadApprovedWords`/`loadBannedWords`, the `dictionary` singleton, and the
// default export. Only the origin of the BASE_WORDS array changed.

import BASE_WORDS_JSON from "./dictionary.pt-br.json";

const BASE_WORDS: string[] = BASE_WORDS_JSON as string[];

/**
 * Normalizes a word for dictionary lookup. This makes matching robust to the
 * accent/cedilla mismatch that is inevitable in a tile-based word game: the
 * board can only ever form unaccented letters (plus the Ç tile), while real
 * Portuguese words carry diacritics. Stripping diacritics (and folding Ç → C)
 * means "ABRAÇO" formed on the board matches the stored "ABRACO", and a user
 * approving "café" registers the same key as the in-game "CAFE".
 */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ç/gi, "C")
    .toUpperCase()
    .trim();
}

class Dictionary {
  private validWords: Set<string>;
  private manuallyApproved: Set<string>;
  private bannedWords: Set<string>;

  constructor() {
    this.validWords = new Set(BASE_WORDS.map(normalizeWord));
    this.manuallyApproved = new Set();
    this.bannedWords = new Set();
  }

  isValidWord(word: string): boolean {
    const normalized = normalizeWord(word);
    if (normalized.length < 2) return false;
    if (this.bannedWords.has(normalized)) return false;
    return this.validWords.has(normalized) || this.manuallyApproved.has(normalized);
  }

  addApprovedWord(word: string, _addedBy: string = 'admin'): void {
    const normalized = normalizeWord(word);
    this.manuallyApproved.add(normalized);
    this.bannedWords.delete(normalized);
  }

  banWord(word: string): void {
    const normalized = normalizeWord(word);
    this.bannedWords.add(normalized);
    this.manuallyApproved.delete(normalized);
  }

  isBanned(word: string): boolean {
    return this.bannedWords.has(normalizeWord(word));
  }

  getWordCount(): number {
    return this.validWords.size + this.manuallyApproved.size;
  }

  loadApprovedWords(words: string[]): void {
    words.forEach(w => this.manuallyApproved.add(normalizeWord(w)));
  }

  loadBannedWords(words: string[]): void {
    words.forEach(w => this.bannedWords.add(normalizeWord(w)));
  }
}

// Singleton
export const dictionary = new Dictionary();
export default dictionary;
