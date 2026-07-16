'use client';

import { useGameStore } from '@/lib/game/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createGame, joinGame, startGame, setupGameListeners, removeGameListeners, connectSocket, passTurn, exchangeTiles, submitMove, approveWord, sendChatMessage, disconnectSocket, rejoinGame, onReconnect } from '@/lib/game/socket-client';
import { BoardView } from './board';
import { RackView } from './rack';
import { ScoreBoard } from './scoreboard';
import { ChatPanel } from './chat';
import { withTilePlaced, clearNewTiles, isBoardEmpty, SIZE, CENTER } from '@/lib/game/board';
import { TilePlacement, Tile, MoveData, GameState } from '@/lib/game/types';
import { MAX_RACK_SIZE } from '@/lib/game/game-manager';
import { 
  Crown, LogIn, Play, Users, Copy, RefreshCw, ArrowRight, 
  MessageSquare, Hand, Shuffle, Check, X, Trophy, Home, Settings,
  Sparkles, Gamepad2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Home Screen ──────────────────────────────────────────────────────────────
export function HomeScreen() {
  const { setScreen, playerName, setPlayerName } = useGameStore(
    useShallow((s) => ({
      setScreen: s.setScreen,
      playerName: s.playerName,
      setPlayerName: s.setPlayerName,
    }))
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-700 via-green-600 to-emerald-800">
      <div className="text-center mb-8 animate-slide-up">
        <div className="text-7xl mb-4">🎯</div>
        <h1 className="text-5xl font-bold text-white mb-2">LetraMestre</h1>
        <p className="text-green-100 text-lg">O jogo de palavras multiplayer</p>
      </div>

      <Card className="w-full max-w-sm animate-slide-up shadow-2xl border-0">
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Seu nome</label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Digite seu nome..."
              maxLength={20}
              className="text-center text-lg"
            />
          </div>

          <Separator />

          <Button
            onClick={() => setScreen('create')}
            disabled={!playerName.trim()}
            className="w-full h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
            size="lg"
          >
            <Crown className="mr-2 h-5 w-5" />
            Criar Partida
          </Button>

          <Button
            onClick={() => setScreen('join')}
            disabled={!playerName.trim()}
            variant="outline"
            className="w-full h-14 text-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Entrar em Partida
          </Button>

          <Separator />

          <Button
            onClick={() => setScreen('admin-login')}
            variant="ghost"
            className="w-full text-muted-foreground"
            size="sm"
          >
            <Settings className="mr-2 h-4 w-4" />
            Painel Administrativo
          </Button>
        </CardContent>
      </Card>

      <footer className="mt-8 text-center text-green-200/60 text-xs">
        LetraMestre v1.0 • Jogo de palavras em português
      </footer>
    </div>
  );
}

// ─── Create Game Screen ───────────────────────────────────────────────────────
export function CreateGameScreen() {
  const { playerName, setScreen, setGameInfo, setConnected } = useGameStore(
    useShallow((s) => ({
      playerName: s.playerName,
      setScreen: s.setScreen,
      setGameInfo: s.setGameInfo,
      setConnected: s.setConnected,
    }))
  );
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      connectSocket();
      const result = await createGame(playerName);
      if (result.success && result.gameId) {
        setGameInfo({
          gameId: result.gameId,
          gameCode: result.gameCode!,
          playerId: result.playerId!,
          playerName: result.playerName || playerName,
          isHost: true,
        });
        setConnected(true);
        setScreen('lobby');
        toast.success('Partida criada!');
      } else {
        toast.error(result.error || 'Erro ao criar partida');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-700 via-green-600 to-emerald-800">
      <Card className="w-full max-w-sm shadow-2xl border-0 animate-slide-up">
        <CardHeader className="text-center">
          <Crown className="mx-auto h-12 w-12 text-amber-500 mb-2" />
          <CardTitle className="text-2xl">Criar Partida</CardTitle>
          <CardDescription>Crie uma sala e convide seus amigos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Jogando como</p>
            <p className="text-lg font-bold">{playerName}</p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-12 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
          >
            {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            {loading ? 'Criando...' : 'Criar Partida'}
          </Button>

          <Button variant="ghost" onClick={() => setScreen('home')} className="w-full">
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" /> Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Join Game Screen ─────────────────────────────────────────────────────────
export function JoinGameScreen() {
  const { playerName, setScreen, setGameInfo, setConnected } = useGameStore(
    useShallow((s) => ({
      playerName: s.playerName,
      setScreen: s.setScreen,
      setGameInfo: s.setGameInfo,
      setConnected: s.setConnected,
    }))
  );
  const [gameCode, setGameCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!playerName.trim() || !gameCode.trim()) return;
    setLoading(true);
    try {
      connectSocket();
      const result = await joinGame(gameCode.toUpperCase().trim(), playerName);
      if (result.success && result.gameId) {
        setGameInfo({
          gameId: result.gameId,
          gameCode: result.gameCode || gameCode.toUpperCase().trim(),
          playerId: result.playerId!,
          playerName: result.playerName || playerName,
          isHost: false,
        });
        setConnected(true);
        setScreen('lobby');
        toast.success('Conectado!');
      } else {
        toast.error(result.error || 'Erro ao entrar na partida');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-700 via-green-600 to-emerald-800">
      <Card className="w-full max-w-sm shadow-2xl border-0 animate-slide-up">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-green-600 mb-2" />
          <CardTitle className="text-2xl">Entrar em Partida</CardTitle>
          <CardDescription>Digite o código da sala</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Jogando como</p>
            <p className="text-lg font-bold">{playerName}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Código da Sala</label>
            <Input
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Ex: ABC123"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-widest uppercase"
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={loading || gameCode.length < 4}
            className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
            {loading ? 'Conectando...' : 'Entrar'}
          </Button>

          <Button variant="ghost" onClick={() => setScreen('home')} className="w-full">
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" /> Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Lobby Screen ─────────────────────────────────────────────────────────────
export function LobbyScreen() {
  const { gameCode, isHost, playerList, gameId, playerId, setScreen } = useGameStore(
    useShallow((s) => ({
      gameCode: s.gameCode,
      isHost: s.isHost,
      playerList: s.playerList,
      gameId: s.gameId,
      playerId: s.playerId,
      setScreen: s.setScreen,
    }))
  );
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const callbacks = {
      onPlayerList: (players: any) => useGameStore.getState().setPlayerList(players),
      onGameStarted: (state: any) => {
        useGameStore.getState().setGameState(state);
        useGameStore.getState().setScreen('game');
      },
      onChatMessage: (data: any) => {
        useGameStore.getState().addChatMessage(data);
      },
    };
    setupGameListeners(callbacks);
    return () => removeGameListeners();
  }, []);

  const handleStart = async () => {
    if (!gameId || !playerId) return;
    setStarting(true);
    try {
      const result = await startGame(gameId, playerId);
      if (result.success) {
        toast.success('Jogo iniciado!');
      } else {
        toast.error(result.error || 'Erro ao iniciar');
      }
    } catch (err) {
      toast.error('Erro ao iniciar jogo');
    } finally {
      setStarting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode);
    toast.success('Código copiado!');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-700 via-green-600 to-emerald-800">
      <Card className="w-full max-w-md shadow-2xl border-0 animate-slide-up">
        <CardHeader className="text-center">
          <Users className="mx-auto h-10 w-10 text-green-600 mb-2" />
          <CardTitle className="text-2xl">Sala de Espera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Game Code */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Código da Sala</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-mono font-bold tracking-widest">{gameCode}</span>
              <Button size="sm" variant="ghost" onClick={handleCopyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Compartilhe este código com outros jogadores</p>
          </div>

          {/* Player List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Jogadores ({playerList.length}/4)</p>
            {playerList.map((player) => (
              <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium flex-1">{player.name}</span>
                {player.isHost && <Badge className="bg-amber-500 text-white">HOST</Badge>}
              </div>
            ))}
          </div>

          {/* Action */}
          {isHost ? (
            <Button
              onClick={handleStart}
              disabled={starting || playerList.length < 2}
              className="w-full h-12 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
            >
              {starting ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
              {starting ? 'Iniciando...' : 'Iniciar Jogo'}
            </Button>
          ) : (
            <div className="text-center p-4">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Aguardando o anfitrião iniciar...</p>
            </div>
          )}

          <Button variant="ghost" onClick={() => { disconnectSocket(); setScreen('home'); }} className="w-full text-destructive">
            Sair da Sala
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Game Screen ───────────────────────────────────────────────────────────────
export function GameScreen() {
  // Granular selector: only re-render this screen when one of these specific
  // fields changes. Avoids the catastrophic over-subscription where every
  // chat message / connection flag / error toggle re-rendered the entire
  // GameScreen (and indirectly BoardView, ScoreBoard, RackView, ChatPanel).
  const {
    gameState, playerId, isHost, gameId, gameCode, selectedTileIndices,
    toggleTileSelection, clearSelection, placedTiles, addPlacedTile,
    removePlacedTile, clearPlacedTiles, placingTileIndex, setPlacingTileIndex,
    pendingWord, setPendingWord, gameOverData, setGameOverData,
    addChatMessage, setScreen, setError, lastError
  } = useGameStore(
    useShallow((s) => ({
      gameState: s.gameState,
      playerId: s.playerId,
      isHost: s.isHost,
      gameId: s.gameId,
      gameCode: s.gameCode,
      selectedTileIndices: s.selectedTileIndices,
      toggleTileSelection: s.toggleTileSelection,
      clearSelection: s.clearSelection,
      placedTiles: s.placedTiles,
      addPlacedTile: s.addPlacedTile,
      removePlacedTile: s.removePlacedTile,
      clearPlacedTiles: s.clearPlacedTiles,
      placingTileIndex: s.placingTileIndex,
      setPlacingTileIndex: s.setPlacingTileIndex,
      pendingWord: s.pendingWord,
      setPendingWord: s.setPendingWord,
      gameOverData: s.gameOverData,
      setGameOverData: s.setGameOverData,
      addChatMessage: s.addChatMessage,
      setScreen: s.setScreen,
      setError: s.setError,
      lastError: s.lastError,
    }))
  );

  const [showChat, setShowChat] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [exchangeIndices, setExchangeIndices] = useState<Set<number>>(new Set());

  // Setup socket listeners
  useEffect(() => {
    const callbacks = {
      onGameState: (state: GameState) => {
        useGameStore.getState().setGameState(state);
        // Clear placed tiles when state updates (move was accepted)
        useGameStore.getState().clearPlacedTiles();
        useGameStore.getState().clearSelection();
      },
      onGameEnded: (data: any) => {
        useGameStore.getState().setGameOverData(data);
      },
      onWordValidation: (data: any) => {
        useGameStore.getState().setPendingWord(data.word);
      },
      onChatMessage: (data: any) => {
        useGameStore.getState().addChatMessage(data);
      },
    };
    setupGameListeners(callbacks);

    // Transparently resume the match if the socket drops and reconnects.
    const { gameId: gid, playerId: pid } = useGameStore.getState();
    const unsubscribe = onReconnect(async () => {
      if (!gid || !pid) return;
      const result = await rejoinGame(gid, pid);
      if (result.success) {
        toast.success('Reconectado à partida');
      }
    });

    return () => { removeGameListeners(); unsubscribe(); };
  }, []);

  if (!gameState || !playerId) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;

  // Handle tile click in rack
  const handleTileClick = (index: number) => {
    if (!isMyTurn) return;
    // If no tile is being placed, select for placement
    if (placingTileIndex === null) {
      // Toggle selection
      if (selectedTileIndices.has(index)) {
        toggleTileSelection(index);
      } else {
        setPlacingTileIndex(index);
        toggleTileSelection(index);
      }
    } else {
      // Already placing a tile - switch to this one
      setPlacingTileIndex(index);
      clearSelection();
      toggleTileSelection(index);
    }
  };

  // Handle cell click on board
  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn || !myPlayer) return;
    
    // Check if there's a placed tile at this position - remove it
    const key = `${row},${col}`;
    if (placedTiles.has(key)) {
      removePlacedTile(row, col);
      return;
    }

    // If we have a tile selected for placing
    if (placingTileIndex !== null && placingTileIndex < myPlayer.rack.length) {
      const tile = myPlayer.rack[placingTileIndex];
      const placement: TilePlacement = {
        row, col, tile, rackIndex: placingTileIndex,
      };
      addPlacedTile(placement);
      setPlacingTileIndex(null);
    }
  };

  // Confirm move
  const handleConfirmMove = async () => {
    if (!gameId || !playerId || placedTiles.size === 0) return;
    
    const placements = Array.from(placedTiles.values());
    const moveData: MoveData = {
      playerId,
      placements,
    };

    try {
      const result = await submitMove(gameId, moveData);
      if (result.success) {
        clearPlacedTiles();
        clearSelection();
        toast.success(`Jogada válida! +${result.score} pontos (${result.words?.join(', ')})`);
      } else {
        toast.error(result.error || 'Jogada inválida');
      }
    } catch (err) {
      toast.error('Erro ao enviar jogada');
    }
  };

  // Pass turn
  const handlePassTurn = async () => {
    if (!gameId || !playerId) return;
    clearPlacedTiles();
    clearSelection();
    try {
      await passTurn(gameId, playerId);
      toast.info('Você passou a vez');
    } catch (err) {
      toast.error('Erro ao passar');
    }
  };

  // Exchange tiles
  const handleExchange = async () => {
    if (!gameId || !playerId || exchangeIndices.size === 0) return;
    try {
      await exchangeTiles(gameId, playerId, Array.from(exchangeIndices));
      setExchangeIndices(new Set());
      setShowExchange(false);
      toast.info('Peças trocadas!');
    } catch (err) {
      toast.error('Erro ao trocar peças');
    }
  };

  // Word validation
  const handleWordApproval = async (approved: boolean) => {
    if (!gameId || !playerId) return;
    try {
      await approveWord(gameId, playerId, approved);
      setPendingWord(null);
      toast.info(approved ? 'Palavra aprovada!' : 'Palavra rejeitada');
    } catch (err) {
      toast.error('Erro ao validar palavra');
    }
  };

  // Build display board with placed tiles
  let displayBoard = gameState.board;
  for (const placement of placedTiles.values()) {
    displayBoard = withTilePlaced(displayBoard, placement.row, placement.col, placement.tile, true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-amber-100">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 size={18} />
          <span className="font-bold text-sm">LetraMestre</span>
          <Badge variant="secondary" className="text-xs">{gameCode}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-primary-foreground h-7 w-7 p-0" onClick={() => setShowChat(!showChat)}>
            <MessageSquare size={16} />
          </Button>
          <Button size="sm" variant="ghost" className="text-primary-foreground h-7 w-7 p-0" onClick={() => { disconnectSocket(); setScreen('home'); }}>
            <Home size={16} />
          </Button>
        </div>
      </div>

      {/* Score board */}
      <ScoreBoard players={gameState.players} currentPlayerId={currentPlayer?.id} myPlayerId={playerId} />

      {/* Turn indicator */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`px-3 py-1.5 text-center text-sm font-medium ${isMyTurn ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}
      >
        {isMyTurn ? (
          <span className="flex items-center justify-center gap-1">
            <Sparkles size={14} /> Sua vez de jogar!
          </span>
        ) : (
          <span>Vez de {currentPlayer?.name ?? ''}</span>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center p-1 overflow-auto">
        <BoardView board={displayBoard} onCellClick={handleCellClick} isMyTurn={isMyTurn} />
      </div>

      {/* Tile bag info */}
      <div className="text-center text-xs text-muted-foreground py-1">
        Peças no saco: {gameState.tileBagCount}
      </div>

      {/* Player's rack */}
      <div className="px-2 pb-1">
        <RackView
          tiles={myPlayer?.rack || []}
          selectedIndices={selectedTileIndices}
          onTileClick={handleTileClick}
          disabled={!isMyTurn}
        />
      </div>

      {/* Action buttons */}
      {isMyTurn && (
        <div className="flex gap-2 px-3 pb-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10"
            onClick={handlePassTurn}
          >
            <Hand size={16} className="mr-1" /> Passar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10"
            onClick={() => setShowExchange(true)}
            disabled={gameState.tileBagCount < 7}
          >
            <Shuffle size={16} className="mr-1" /> Trocar
          </Button>
          <Button
            size="sm"
            className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleConfirmMove}
            disabled={placedTiles.size === 0}
          >
            <Check size={16} className="mr-1" /> Confirmar
          </Button>
        </div>
      )}

      {/* Last move info */}
      {gameState.lastPlayedWord && (
        <div
          role="status"
          aria-live="polite"
          className="text-center text-xs text-muted-foreground pb-2"
        >
          Última jogada: &quot;{gameState.lastPlayedWord}&quot; (+{gameState.lastPlayedScore} pts)
        </div>
      )}

      {/* Chat drawer */}
      <Dialog open={showChat} onOpenChange={setShowChat}>
        <DialogContent className="max-w-sm h-[60vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={18} /> Chat
            </DialogTitle>
          </DialogHeader>
          <ChatPanel />
        </DialogContent>
      </Dialog>

      {/* Exchange dialog */}
      <Dialog open={showExchange} onOpenChange={setShowExchange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Trocar Peças</DialogTitle>
            <DialogDescription>Selecione as peças que deseja trocar</DialogDescription>
          </DialogHeader>
          <div className="game-rack flex items-center justify-center gap-1 flex-wrap">
            {(myPlayer?.rack || []).map((tile, i) => (
              <button
                key={i}
                className={`tile-piece ${exchangeIndices.has(i) ? 'selected' : ''}`}
                style={{ width: 44, height: 44, fontSize: 20 }}
                onClick={() => {
                  const next = new Set(exchangeIndices);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  setExchangeIndices(next);
                }}
              >
                {tile.isBlank ? '?' : tile.letter}
                {tile.value > 0 && <span className="tile-value">{tile.value}</span>}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowExchange(false); setExchangeIndices(new Set()); }}>Cancelar</Button>
            <Button onClick={handleExchange} disabled={exchangeIndices.size === 0} className="bg-amber-500 hover:bg-amber-600 text-white">
              Trocar {exchangeIndices.size} peça(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Word validation dialog */}
      <Dialog open={!!pendingWord} onOpenChange={() => setPendingWord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Validar Palavra</DialogTitle>
            <DialogDescription>Esta palavra não foi encontrada no dicionário</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-primary mb-2">{pendingWord}</p>
            <p className="text-sm text-muted-foreground">Os jogadores podem validar esta palavra manualmente.</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleWordApproval(false)} className="flex-1">
              <X size={16} className="mr-1" /> Rejeitar
            </Button>
            <Button onClick={() => handleWordApproval(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              <Check size={16} className="mr-1" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game over dialog */}
      <Dialog open={!!gameOverData} onOpenChange={() => setGameOverData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">🏆 Fim de Jogo!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vencedor</p>
              <p className="text-3xl font-bold text-primary">{gameOverData?.winnerName}</p>
            </div>
            <div className="space-y-1">
              {gameOverData?.scores && Object.entries(gameOverData.scores).map(([name, score]) => (
                <div key={name} className="flex justify-between px-4 py-1 bg-muted rounded">
                  <span className="font-medium">{name}</span>
                  <span className="font-bold">{score} pts</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { disconnectSocket(); setScreen('home'); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
              <Home size={16} className="mr-2" /> Voltar ao Início
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
