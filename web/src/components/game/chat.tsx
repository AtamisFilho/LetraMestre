'use client';

import { useGameStore, ChatMsg } from '@/lib/game/store';
import { sendChatMessage } from '@/lib/game/socket-client';
import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Send } from 'lucide-react';

export function ChatPanel() {
  // Granular selector: only re-render when one of these specific fields
  // changes (prevents re-render on every gameState/tile-selection change).
  const { chatMessages, gameId, playerId, playerName } = useGameStore(
    useShallow((s) => ({
      chatMessages: s.chatMessages,
      gameId: s.gameId,
      playerId: s.playerId,
      playerName: s.playerName,
    }))
  );
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim() || !gameId || !playerId) return;
    // Send via socket so other players see it
    sendChatMessage(gameId, playerId, playerName, input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        role="log"
        aria-label="Chat da partida"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1"
      >
        {chatMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma mensagem ainda
          </p>
        ) : (
          chatMessages.map((msg: ChatMsg) => (
            <div key={msg.id} className={`animate-fade-in ${msg.type === 'system' ? 'text-center' : ''}`}>
              {msg.type === 'system' ? (
                <p className="text-xs text-muted-foreground italic py-0.5">
                  {msg.message}
                </p>
              ) : (
                <div className="text-sm">
                  <span className="font-semibold text-primary mr-1">
                    {msg.playerName}:
                  </span>
                  <span className="text-foreground">{msg.message}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex gap-1 p-2 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Mensagem..."
          aria-label="Escrever mensagem"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Enviar mensagem"
          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
