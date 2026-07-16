import { Tile } from './types';

// Portuguese Brazilian tile distribution (Scrabble standard)
const DISTRIBUTION: Record<string, [number, number]> = {
  'A': [14, 1], 'B': [3, 3], 'C': [4, 2], 'D': [5, 2],
  'E': [11, 1], 'F': [2, 4], 'G': [2, 4], 'H': [2, 4],
  'I': [8, 1], 'J': [2, 5], 'L': [5, 2], 'M': [6, 1],
  'N': [4, 3], 'O': [10, 1], 'P': [4, 2], 'Q': [1, 6],
  'R': [6, 1], 'S': [8, 1], 'T': [5, 1], 'U': [7, 1],
  'V': [2, 4], 'X': [1, 8], 'Z': [1, 8], 'Ç': [2, 3],
  ' ': [3, 0]
};

let tileIdCounter = 0;

function nextTileId(): string {
  return `tile_${++tileIdCounter}`;
}

export function generateAllTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (const [letter, [quantity, value]] of Object.entries(DISTRIBUTION)) {
    for (let i = 0; i < quantity; i++) {
      if (letter === ' ') {
        tiles.push({ letter: ' ', value: 0, isBlank: true, id: nextTileId() });
      } else {
        tiles.push({ letter, value, isBlank: false, id: nextTileId() });
      }
    }
  }
  return shuffleArray(tiles);
}

export function getLetterValue(letter: string): number {
  return DISTRIBUTION[letter.toUpperCase()]?.[1] ?? 0;
}

export function getTotalTileCount(): number {
  return Object.values(DISTRIBUTION).reduce((sum, [qty]) => sum + qty, 0);
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class TileBag {
  private tiles: Tile[] = [];

  constructor() {
    this.refill();
  }

  refill(): void {
    this.tiles = generateAllTiles();
  }

  draw(count: number): Tile[] {
    // Guard against NaN, Infinity, negative numbers, and zero: callers
    // would otherwise slice an unexpected number of tiles (or, with
    // count = Infinity, drain the entire bag in one shot).
    if (!Number.isFinite(count) || count <= 0) return [];
    const drawn = this.tiles.slice(0, Math.min(count, this.tiles.length));
    this.tiles = this.tiles.slice(drawn.length);
    return drawn;
  }

  returnTiles(returnedTiles: Tile[]): void {
    this.tiles.push(...returnedTiles);
    this.tiles = shuffleArray(this.tiles);
  }

  remainingCount(): number {
    return this.tiles.length;
  }

  isEmpty(): boolean {
    return this.tiles.length === 0;
  }

  getState(): Tile[] {
    return [...this.tiles];
  }

  loadState(state: Tile[]): void {
    this.tiles = [...state];
  }
}
