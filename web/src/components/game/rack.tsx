'use client';

import { Tile } from '@/lib/game/types';
import { MAX_RACK_SIZE } from '@/lib/game/game-manager';

interface RackViewProps {
  tiles: Tile[];
  selectedIndices: Set<number>;
  onTileClick: (index: number) => void;
  disabled?: boolean;
}

export function RackView({ tiles, selectedIndices, onTileClick, disabled }: RackViewProps) {
  return (
    <div className="game-rack flex items-center justify-center gap-1 flex-wrap">
      {Array.from({ length: MAX_RACK_SIZE }, (_, i) => {
        const tile = tiles[i];
        const isSelected = selectedIndices.has(i);
        return (
          <div key={i} className="relative">
            {tile ? (
              <button
                className={`tile-piece ${isSelected ? 'selected' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ width: 44, height: 44, fontSize: 20 }}
                onClick={() => !disabled && onTileClick(i)}
                disabled={disabled}
              >
                {tile.isBlank ? (tile.assignedLetter || '?') : tile.letter}
                {tile.value > 0 && <span className="tile-value">{tile.value}</span>}
              </button>
            ) : (
              <div
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
