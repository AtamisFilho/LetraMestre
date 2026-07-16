'use client';

import { Tile } from '@/lib/game/types';
import { MAX_RACK_SIZE } from '@/lib/game/game-manager';

interface RackViewProps {
  tiles: Tile[];
  selectedIndices: Set<number>;
  onTileClick: (index: number) => void;
  disabled?: boolean;
}

// Rótulo pt-BR para cada peça do rack (1-indexado para bater com a contagem
// visual). Blanks recebem "curinga atribuída X" para que o leitor de tela
// anuncie a letra efetiva da peça.
function getTileAriaLabel(tile: Tile, index: number): string {
  const posicao = index + 1;
  const letra = tile.isBlank
    ? `curinga${tile.assignedLetter ? ` atribuída ${tile.assignedLetter}` : ''}`
    : tile.letter;
  return `Peça ${letra}, valor ${tile.value}, posição ${posicao}`;
}

export function RackView({ tiles, selectedIndices, onTileClick, disabled }: RackViewProps) {
  return (
    <div role="group" aria-label="Suas peças" className="game-rack flex items-center justify-center gap-1 flex-wrap">
      {Array.from({ length: MAX_RACK_SIZE }, (_, i) => {
        const tile = tiles[i];
        const isSelected = selectedIndices.has(i);
        return (
          <div key={i} className="relative">
            {tile ? (
              <button
                type="button"
                aria-label={getTileAriaLabel(tile, i)}
                aria-pressed={isSelected}
                className={`tile-piece outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 ${isSelected ? 'selected' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ width: 44, height: 44, fontSize: 20 }}
                onClick={() => !disabled && onTileClick(i)}
                disabled={disabled}
              >
                {tile.isBlank ? (tile.assignedLetter || '?') : tile.letter}
                {tile.value > 0 && <span className="tile-value">{tile.value}</span>}
              </button>
            ) : (
              <div
                aria-hidden="true"
                className="rounded border-2 border-dashed border-amber-700/30 opacity-40"
                style={{ width: 44, height: 44 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
