'use client';

import { Player } from '@/lib/game/types';

interface ScoreBoardProps {
  players: Player[];
  currentPlayerId?: string;
  myPlayerId?: string;
}

export function ScoreBoard({ players, currentPlayerId, myPlayerId }: ScoreBoardProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap px-2 py-1">
      {players.map((player) => {
        const isCurrent = player.id === currentPlayerId;
        const isMe = player.id === myPlayerId;
        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
              isCurrent 
                ? 'bg-primary text-primary-foreground shadow-md animate-pulse-glow' 
                : isMe 
                  ? 'bg-primary/10 border border-primary/30' 
                  : 'bg-muted'
            }`}
          >
            <div className="flex flex-col items-center min-w-[60px]">
              <span className={`text-xs font-medium truncate max-w-[80px] ${isCurrent ? 'text-primary-foreground' : ''}`}>
                {player.name} {isMe && '(você)'}
              </span>
              <span className={`text-lg font-bold ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}>
                {player.score}
              </span>
            </div>
            {!player.isConnected && (
              <span className="text-xs text-muted-foreground">(offline)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
