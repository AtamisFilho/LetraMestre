'use client';

import { useState, useEffect } from 'react';
import { Board, BoardCell, CellBonus, Tile } from '@/lib/game/types';
import { SIZE } from '@/lib/game/board';

interface BoardCellProps {
  cell: BoardCell;
  onClick: (row: number, col: number) => void;
  isMyTurn: boolean;
  size: number;
}

function getBonusLabel(bonus: CellBonus): string {
  switch (bonus) {
    case 'DOUBLE_LETTER': return 'LD';
    case 'TRIPLE_LETTER': return 'LT';
    case 'DOUBLE_WORD': return 'PD';
    case 'TRIPLE_WORD': return 'PT';
    case 'CENTER': return '★';
    default: return '';
  }
}

function getBonusClass(bonus: CellBonus): string {
  switch (bonus) {
    case 'DOUBLE_LETTER': return 'cell-bonus-dl';
    case 'TRIPLE_LETTER': return 'cell-bonus-tl';
    case 'DOUBLE_WORD': return 'cell-bonus-dw';
    case 'TRIPLE_WORD': return 'cell-bonus-tw';
    case 'CENTER': return 'cell-bonus-center';
    default: return 'cell-bonus-none';
  }
}

function BoardCellView({ cell, onClick, isMyTurn, size }: BoardCellProps) {
  const hasTile = cell.tile !== null;
  const fontSize = Math.max(size * 0.45, 10);
  const bonusFontSize = Math.max(size * 0.28, 7);
  const valueFontSize = Math.max(size * 0.22, 5);

  return (
    <div
      className={`relative flex items-center justify-center border border-amber-800/20 ${hasTile ? '' : getBonusClass(cell.bonus)} ${isMyTurn && !hasTile ? 'cursor-pointer hover:brightness-110' : ''} transition-all duration-100`}
      style={{ width: size, height: size, fontSize }}
      onClick={() => !hasTile && isMyTurn && onClick(cell.row, cell.col)}
    >
      {hasTile ? (
        <div className={`tile-placed ${cell.isNewlyPlaced ? 'newly-placed' : ''} w-full h-full`}>
          <span style={{ fontSize: fontSize * 0.7 }}>
            {cell.tile!.isBlank ? (cell.tile!.assignedLetter || '?') : cell.tile!.letter}
          </span>
          {cell.tile!.value > 0 && (
            <span className="tile-value" style={{ fontSize: valueFontSize }}>
              {cell.tile!.value}
            </span>
          )}
        </div>
      ) : cell.bonus !== 'NONE' ? (
        <span className="font-bold opacity-70" style={{ fontSize: bonusFontSize, color: cell.bonus === 'CENTER' ? '#5d4037' : '#fff' }}>
          {getBonusLabel(cell.bonus)}
        </span>
      ) : null}
    </div>
  );
}

interface BoardViewProps {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  isMyTurn: boolean;
}

export function BoardView({ board, onCellClick, isMyTurn }: BoardViewProps) {
  const [cellSize, setCellSize] = useState(28);

  useEffect(() => {
    const updateSize = () => {
      const width = Math.min(window.innerWidth - 16, 600);
      setCellSize(Math.min(Math.floor(width / SIZE), 38));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="flex justify-center overflow-auto p-1">
      <div 
        className="inline-grid gap-0 rounded-lg overflow-hidden shadow-lg border-2 border-amber-900/40"
        style={{ 
          gridTemplateColumns: `repeat(${SIZE}, ${cellSize}px)`,
          background: 'var(--board-bg)',
        }}
      >
        {board.cells.flat().map((cell) => (
          <BoardCellView
            key={`${cell.row}-${cell.col}`}
            cell={cell}
            onClick={onCellClick}
            isMyTurn={isMyTurn}
            size={cellSize}
          />
        ))}
      </div>
    </div>
  );
}
