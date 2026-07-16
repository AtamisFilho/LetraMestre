'use client';

import { useState, useEffect, useRef, useCallback, memo, KeyboardEvent } from 'react';
import { Board, BoardCell, CellBonus } from '@/lib/game/types';
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

// Descrição por extenso em pt-BR para leitores de tela (redundância defensiva
// ao aria-label do gridcell, expandindo siglas como "LD" → "letra dupla").
function getBonusFullDescription(bonus: CellBonus): string {
  switch (bonus) {
    case 'DOUBLE_LETTER': return 'letra dupla';
    case 'TRIPLE_LETTER': return 'letra tripla';
    case 'DOUBLE_WORD': return 'palavra dupla';
    case 'TRIPLE_WORD': return 'palavra tripla';
    case 'CENTER': return 'centro, palavra dupla';
    default: return '';
  }
}

// Constrói o aria-label descritivo de uma célula em pt-BR (1-indexado para o
// usuário). Cobrimos os três estados: com peça, vazia com bônus, vazia sem
// bônus. Em português brasileiro para TalkBack/VoiceOver/NVDA.
function getCellAriaLabel(cell: BoardCell): string {
  const linha = cell.row + 1;
  const coluna = cell.col + 1;
  if (cell.tile) {
    const letra = cell.tile.isBlank
      ? `peça curinga${cell.tile.assignedLetter ? ` atribuída ${cell.tile.assignedLetter}` : ''}`
      : `peça ${cell.tile.letter}`;
    const valor = `, valor ${cell.tile.value}`;
    const nova = cell.isNewlyPlaced ? ', recém-colocada' : '';
    return `Linha ${linha}, coluna ${coluna}, ${letra}${valor}${nova}`;
  }
  if (cell.bonus !== 'NONE') {
    return `Linha ${linha}, coluna ${coluna}, bônus ${getBonusFullDescription(cell.bonus)}, vazia`;
  }
  return `Linha ${linha}, coluna ${coluna}, vazia`;
}

// Memoized cell: on a 15x15 board a single move would otherwise re-render all
// 225 cells. Because each server broadcast deserializes fresh objects, we
// compare by value (tile identity + relevant flags) so only the handful of
// cells that actually changed re-render. The comparator also covers the
// keyboard nav (no per-render handler allocations needed) because onKeyDown
// is defined inside the memoized component (stable identity).
const BoardCellView = memo(function BoardCellView({ cell, onClick, isMyTurn, size }: BoardCellProps) {
  const hasTile = cell.tile !== null;
  const fontSize = Math.max(size * 0.45, 10);
  const bonusFontSize = Math.max(size * 0.28, 7);
  const valueFontSize = Math.max(size * 0.22, 5);

  // Células vazias entram na tab order durante a vez do jogador (espelha a
  // regra de click-enable). Células ocupadas permanecem focáveis via setas
  // (tabIndex=-1 ainda aceita .focus() programático).
  const tabIndex = isMyTurn && !hasTile ? 0 : -1;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { row, col } = cell;
    switch (e.key) {
      case 'Enter':
      case ' ':
        // Enter/Space coloca a peça do rack atualmente selecionada na célula
        // vazia (mesmo caminho do click). preventDefault evita scroll/submit.
        if (!hasTile && isMyTurn) {
          e.preventDefault();
          onClick(row, col);
        }
        break;
      case 'Backspace':
        // Remove peça recém-colocada (o handleCellClick em screens.tsx detecta
        // placedTiles.has(key) e remove). preventDefault evita voltar no
        // histórico do navegador.
        if (cell.isNewlyPlaced) {
          e.preventDefault();
          onClick(row, col);
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault();
        const delta: Record<string, [number, number]> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        const [dr, dc] = delta[e.key];
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return;
        const next = document.querySelector<HTMLElement>(`[data-cell="${nr}-${nc}"]`);
        next?.focus();
        break;
      }
    }
  };

  return (
    <div
      role="gridcell"
      aria-rowindex={cell.row + 1}
      aria-colindex={cell.col + 1}
      aria-label={getCellAriaLabel(cell)}
      data-cell={`${cell.row}-${cell.col}`}
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center justify-center border border-amber-800/20 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:z-10 ${hasTile ? '' : getBonusClass(cell.bonus)} ${isMyTurn && !hasTile ? 'cursor-pointer hover:brightness-110' : ''} transition-all duration-100`}
      style={{ width: size, height: size, fontSize }}
      onClick={() => !hasTile && isMyTurn && onClick(cell.row, cell.col)}
    >
      {hasTile ? (
        <div className={`tile-placed ${cell.isNewlyPlaced ? 'newly-placed' : ''} w-full h-full`} aria-hidden="true">
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
        <>
          <span className="font-bold opacity-70" style={{ fontSize: bonusFontSize, color: cell.bonus === 'CENTER' ? '#5d4037' : '#fff' }} aria-hidden="true">
            {getBonusLabel(cell.bonus)}
          </span>
          <span className="sr-only">{getBonusFullDescription(cell.bonus)}</span>
        </>
      ) : null}
    </div>
  );
}, (prev, next) => {
  return (
    prev.size === next.size &&
    prev.isMyTurn === next.isMyTurn &&
    prev.onClick === next.onClick &&
    prev.cell.bonus === next.cell.bonus &&
    prev.cell.isNewlyPlaced === next.cell.isNewlyPlaced &&
    prev.cell.tile?.id === next.cell.tile?.id &&
    prev.cell.tile?.assignedLetter === next.cell.tile?.assignedLetter
  );
});

interface BoardViewProps {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  isMyTurn: boolean;
}

export function BoardView({ board, onCellClick, isMyTurn }: BoardViewProps) {
  const [cellSize, setCellSize] = useState(28);

  // Keep a stable click handler so memoized cells aren't invalidated every
  // render just because the parent re-created its callback closure. The ref
  // is updated inside useEffect (NOT during render) to comply with the
  // react-hooks/refs lint rule.
  const onCellClickRef = useRef(onCellClick);
  useEffect(() => {
    onCellClickRef.current = onCellClick;
  }, [onCellClick]);
  const handleClick = useCallback((row: number, col: number) => {
    onCellClickRef.current(row, col);
  }, []);

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
        role="grid"
        aria-label="Tabuleiro de jogo 15 por 15"
        aria-rowcount={SIZE}
        aria-colcount={SIZE}
        className="inline-grid gap-0 rounded-lg overflow-hidden shadow-lg border-2 border-amber-900/40"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, ${cellSize}px)`,
          background: 'var(--board-bg)',
        }}
      >
        {board.cells.map((rowCells, r) => (
          // display:contents keeps the row wrapper in the ARIA tree (role=row)
          // without breaking the CSS grid layout (gridcells remain direct
          // grid items of the parent inline-grid).
          <div key={`row-${r}`} role="row" aria-rowindex={r + 1} className="contents">
            {rowCells.map((cell) => (
              <BoardCellView
                key={`${cell.row}-${cell.col}`}
                cell={cell}
                onClick={handleClick}
                isMyTurn={isMyTurn}
                size={cellSize}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
