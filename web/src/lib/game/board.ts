import { Board, BoardCell, CellBonus, Tile } from './types';

const SIZE = 15;
const CENTER = 7;

function getBonusForPosition(row: number, col: number): CellBonus {
  // Center
  if (row === CENTER && col === CENTER) return 'CENTER';

  // Triple Word (PT) - corners and middle of edges
  const tripleWordPositions = [
    [0,0],[0,7],[0,14],
    [7,0],[7,14],
    [14,0],[14,7],[14,14]
  ];
  if (tripleWordPositions.some(([r,c]) => r === row && c === col)) return 'TRIPLE_WORD';

  // Double Word (PD) - diagonals
  const doubleWordPositions = [
    [1,1],[2,2],[3,3],[4,4],
    [1,13],[2,12],[3,11],[4,10],
    [10,4],[11,3],[12,2],[13,1],
    [10,10],[11,11],[12,12],[13,13]
  ];
  if (doubleWordPositions.some(([r,c]) => r === row && c === col)) return 'DOUBLE_WORD';

  // Triple Letter (LT)
  const tripleLetterPositions = [
    [1,5],[1,9],
    [5,1],[5,5],[5,9],[5,13],
    [9,1],[9,5],[9,9],[9,13],
    [13,5],[13,9]
  ];
  if (tripleLetterPositions.some(([r,c]) => r === row && c === col)) return 'TRIPLE_LETTER';

  // Double Letter (LD)
  const doubleLetterPositions = [
    [0,3],[0,11],
    [2,6],[2,8],
    [3,0],[3,7],[3,14],
    [6,2],[6,6],[6,8],[6,12],
    [7,3],[7,11],
    [8,2],[8,6],[8,8],[8,12],
    [11,0],[11,7],[11,14],
    [12,6],[12,8],
    [14,3],[14,11]
  ];
  if (doubleLetterPositions.some(([r,c]) => r === row && c === col)) return 'DOUBLE_LETTER';

  return 'NONE';
}

export function createEmptyBoard(): Board {
  const cells: BoardCell[][] = [];
  for (let row = 0; row < SIZE; row++) {
    cells[row] = [];
    for (let col = 0; col < SIZE; col++) {
      cells[row][col] = {
        row,
        col,
        bonus: getBonusForPosition(row, col),
        tile: null,
        isNewlyPlaced: false
      };
    }
  }
  return { cells, size: SIZE };
}

export function getCell(board: Board, row: number, col: number): BoardCell | null {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  return board.cells[row][col];
}

export function withTilePlaced(board: Board, row: number, col: number, tile: Tile, isNew: boolean = true): Board {
  const newCells = board.cells.map((rowCells, r) =>
    rowCells.map((cell, c) => {
      if (r === row && c === col) {
        return { ...cell, tile, isNewlyPlaced: isNew };
      }
      return cell;
    })
  );
  return { ...board, cells: newCells };
}

export function confirmNewTiles(board: Board): Board {
  const newCells = board.cells.map(rowCells =>
    rowCells.map(cell => {
      if (cell.isNewlyPlaced) return { ...cell, isNewlyPlaced: false };
      return cell;
    })
  );
  return { ...board, cells: newCells };
}

export function isBoardEmpty(board: Board): boolean {
  return board.cells.flat().every(cell => cell.tile === null);
}

export function isCenterOccupied(board: Board): boolean {
  return board.cells[CENTER][CENTER].tile !== null;
}

export function clearNewTiles(board: Board): Board {
  const newCells = board.cells.map(rowCells =>
    rowCells.map(cell => {
      if (cell.isNewlyPlaced) return { ...cell, tile: null, isNewlyPlaced: false };
      return cell;
    })
  );
  return { ...board, cells: newCells };
}

export { SIZE, CENTER };
