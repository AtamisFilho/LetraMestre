import { Board, BoardCell, CellBonus, TilePlacement } from './types';
import { getCell, SIZE } from './board';

export function calculateMoveScore(board: Board, placements: TilePlacement[]): number {
  if (placements.length === 0) return 0;

  let totalScore = 0;
  const wordsFound = findAllWords(board, placements);

  for (const word of wordsFound) {
    totalScore += calculateWordScore(word);
  }

  // Bonus of 50 points for using all 7 tiles
  if (placements.length === 7) {
    totalScore += 50;
  }

  return totalScore;
}

function calculateWordScore(cells: BoardCell[]): number {
  let wordScore = 0;
  let wordMultiplier = 1;

  for (const cell of cells) {
    const tile = cell.tile;
    if (!tile) continue;
    let letterValue = tile.value;

    // Apply bonus only for newly placed tiles
    if (cell.isNewlyPlaced) {
      switch (cell.bonus) {
        case 'DOUBLE_LETTER': letterValue *= 2; break;
        case 'TRIPLE_LETTER': letterValue *= 3; break;
        case 'DOUBLE_WORD': wordMultiplier *= 2; break;
        case 'CENTER': wordMultiplier *= 2; break;
        case 'TRIPLE_WORD': wordMultiplier *= 3; break;
      }
    }

    wordScore += letterValue;
  }

  return wordScore * wordMultiplier;
}

export function findAllWords(board: Board, placements: TilePlacement[]): BoardCell[][] {
  const words: BoardCell[][] = [];
  const isHorizontal = placements.length <= 1 ||
    new Set(placements.map(p => p.row)).size === 1;

  // Main word
  const mainWord = isHorizontal
    ? findHorizontalWord(board, placements[0].row, placements[0].col)
    : findVerticalWord(board, placements[0].row, placements[0].col);

  if (mainWord.length >= 2) words.push(mainWord);

  // Perpendicular words
  for (const placement of placements) {
    const perpWord = isHorizontal
      ? findVerticalWord(board, placement.row, placement.col)
      : findHorizontalWord(board, placement.row, placement.col);
    if (perpWord.length >= 2) words.push(perpWord);
  }

  return words;
}

function findHorizontalWord(board: Board, row: number, startCol: number): BoardCell[] {
  const cells: BoardCell[] = [];

  // Go left
  let col = startCol;
  while (col > 0 && getCell(board, row, col - 1)?.tile != null) col--;

  // Collect all cells of the word
  while (col < SIZE) {
    const cell = getCell(board, row, col);
    if (!cell || cell.tile == null) break;
    cells.push(cell);
    col++;
  }

  return cells;
}

function findVerticalWord(board: Board, startRow: number, col: number): BoardCell[] {
  const cells: BoardCell[] = [];

  // Go up
  let row = startRow;
  while (row > 0 && getCell(board, row - 1, col)?.tile != null) row--;

  // Collect all cells of the word
  while (row < SIZE) {
    const cell = getCell(board, row, col);
    if (!cell || cell.tile == null) break;
    cells.push(cell);
    row++;
  }

  return cells;
}

export function extractWord(cells: BoardCell[]): string {
  return cells.map(c => c.tile ? getEffectiveLetter(c.tile) : '').join('');
}

function getEffectiveLetter(tile: { letter: string; isBlank: boolean; assignedLetter?: string }): string {
  if (tile.isBlank && tile.assignedLetter) return tile.assignedLetter;
  return tile.letter;
}
