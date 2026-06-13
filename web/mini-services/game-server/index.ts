import { createServer } from "http";
import { Server } from "socket.io";
import {
  GameManager,
  MAX_PLAYERS,
  dictionary,
  type GameState,
  type MoveData,
  type PlayerInfo,
  type Tile,
} from "../../src/lib/game/index";

// ─── Database Persistence Helper ────────────────────────────────────────────
async function persistGame(action: string, data: Record<string, any>) {
  try {
    await fetch(`http://localhost:3000/api/game?XTransformPort=3000`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
  } catch (e) {
    // Silently fail - persistence is best-effort
  }
}

async function persistMove(data: Record<string, any>) {
  try {
    await fetch(`http://localhost:3000/api/game?XTransformPort=3000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    // Silently fail
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface GameRoom {
  gameManager: GameManager;
  players: Map<string, { socketId: string; name: string }>;
  tileBagState: Tile[];
}

// ─── Server Setup ───────────────────────────────────────────────────────────
const PORT = 3003;
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 15000,
  pingTimeout: 15000,
});

const gameRooms = new Map<string, GameRoom>();

// ─── Helper Functions ───────────────────────────────────────────────────────
function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function broadcastGameState(room: GameRoom, gameId: string) {
  const state = room.gameManager.gameState;
  const players = Array.from(room.players.entries());

  // Send personalized state to each player (hide other players' racks)
  for (const [playerId, info] of players) {
    const personalizedState = room.gameManager.getPersonalizedState(playerId);
    io.to(info.socketId).emit("game:state", personalizedState);
  }

  // If game over, also broadcast game ended event
  if (state.phase === "GAME_OVER") {
    const winner = room.gameManager.getWinner();
    const scores: Record<string, number> = {};
    state.players.forEach((p) => (scores[p.name] = p.score));
    io.to(gameId).emit("game:ended", {
      winnerId: winner?.id ?? "",
      winnerName: winner?.name ?? "",
      scores,
    });
  }
}

function broadcastPlayerList(room: GameRoom, gameId: string) {
  const state = room.gameManager.gameState;
  const playerList: PlayerInfo[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
  }));
  io.to(gameId).emit("lobby:players", playerList);
}

// ─── Socket.IO Connection Handling ──────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  let currentGameId: string | null = null;
  let currentPlayerId: string | null = null;

  // ─── Create Game ────────────────────────────────────────────────────────
  socket.on("game:create", (data: { playerName: string }, callback) => {
    const gameCode = generateGameCode();
    const gameId = `game_${Date.now()}_${gameCode}`;

    const gameManager = new GameManager(gameId, gameCode);
    const player = gameManager.addPlayer(data.playerName);

    const room: GameRoom = {
      gameManager,
      players: new Map([[player.id, { socketId: socket.id, name: data.playerName }]]),
      tileBagState: gameManager.getTileBagState(),
    };

    gameRooms.set(gameId, room);
    currentGameId = gameId;
    currentPlayerId = player.id;

    socket.join(gameId);

    callback({
      success: true,
      gameId,
      gameCode,
      playerId: player.id,
      playerName: player.name,
      isHost: true,
    });

    broadcastPlayerList(room, gameId);
    console.log(`[GAME CREATED] ${gameCode} by ${data.playerName}`);

    // Persist to database
    persistGame("create", {
      gameCode,
      hostId: player.id,
      hostName: data.playerName,
      playerCount: 1,
    });
  });

  // ─── Join Game ──────────────────────────────────────────────────────────
  socket.on("game:join", (data: { gameCode: string; playerName: string }, callback) => {
    // Find room by game code
    let foundGameId: string | null = null;
    let foundRoom: GameRoom | null = null;

    for (const [gid, room] of gameRooms.entries()) {
      if (room.gameManager.gameState.gameCode === data.gameCode && room.gameManager.gameState.phase === "WAITING_FOR_PLAYERS") {
        foundGameId = gid;
        foundRoom = room;
        break;
      }
    }

    if (!foundRoom || !foundGameId) {
      callback({ success: false, error: "Partida não encontrada ou já em andamento" });
      return;
    }

    if (foundRoom.gameManager.gameState.players.length >= MAX_PLAYERS) {
      callback({ success: false, error: "Partida cheia" });
      return;
    }

    // Check if name already taken
    const nameExists = foundRoom.gameManager.gameState.players.some(
      (p) => p.name.toLowerCase() === data.playerName.toLowerCase()
    );
    if (nameExists) {
      callback({ success: false, error: "Nome já está em uso nesta partida" });
      return;
    }

    const player = foundRoom.gameManager.addPlayer(data.playerName);
    foundRoom.players.set(player.id, { socketId: socket.id, name: data.playerName });

    currentGameId = foundGameId;
    currentPlayerId = player.id;

    socket.join(foundGameId);

    callback({
      success: true,
      gameId: foundGameId,
      gameCode: data.gameCode,
      playerId: player.id,
      playerName: player.name,
      isHost: false,
    });

    broadcastPlayerList(foundRoom, foundGameId);

    // Notify others
    socket.to(foundGameId).emit("chat:message", {
      playerId: "system",
      playerName: "Sistema",
      message: `${data.playerName} entrou na partida`,
      type: "system",
    });

    console.log(`[JOIN] ${data.playerName} joined ${data.gameCode}`);
  });

  // ─── Start Game ─────────────────────────────────────────────────────────
  socket.on("game:start", (data: { gameId: string; playerId: string }, callback) => {
    const room = gameRooms.get(data.gameId);
    if (!room) {
      callback({ success: false, error: "Partida não encontrada" });
      return;
    }

    const state = room.gameManager.gameState;
    const player = state.players.find((p) => p.id === data.playerId);
    if (!player?.isHost) {
      callback({ success: false, error: "Apenas o anfitrião pode iniciar" });
      return;
    }

    if (state.players.length < 2) {
      callback({ success: false, error: "Mínimo de 2 jogadores" });
      return;
    }

    room.gameManager.startGame();
    room.tileBagState = room.gameManager.getTileBagState();

    io.to(data.gameId).emit("game:started", room.gameManager.gameState);
    broadcastGameState(room, data.gameId);

    io.to(data.gameId).emit("chat:message", {
      playerId: "system",
      playerName: "Sistema",
      message: "O jogo começou!",
      type: "system",
    });

    callback({ success: true });
    console.log(`[GAME STARTED] ${state.gameCode}`);

    // Persist game start to database
    persistGame("start", {
      gameCode: state.gameCode,
      hostId: state.players.find((p) => p.isHost)?.id || "",
      hostName: state.players.find((p) => p.isHost)?.name || "",
      playerCount: state.players.length,
      boardState: JSON.stringify(room.gameManager.gameState.board),
      tileBagState: JSON.stringify(room.tileBagState),
    });
  });

  // ─── Submit Move ────────────────────────────────────────────────────────
  socket.on("game:move", (data: { gameId: string; moveData: MoveData }, callback) => {
    const room = gameRooms.get(data.gameId);
    if (!room) {
      callback?.({ success: false, error: "Partida não encontrada" });
      return;
    }

    const validation = room.gameManager.validateMove(data.moveData);

    switch (validation.type) {
      case "Valid": {
        room.gameManager.processValidMove(data.moveData, validation.score);
        room.tileBagState = room.gameManager.getTileBagState();
        broadcastGameState(room, data.gameId);

        const wordStr = validation.words.join(", ");
        const playerName = room.gameManager.gameState.players.find(
          (p) => p.id === data.moveData.playerId
        )?.name ?? "Jogador";

        io.to(data.gameId).emit("chat:message", {
          playerId: "system",
          playerName: "Sistema",
          message: `${playerName} jogou "${wordStr}" por ${validation.score} pontos`,
          type: "system",
        });

        // Persist move to database
        persistMove({
          gameCode: room.gameManager.gameState.gameCode,
          playerId: data.moveData.playerId,
          playerName,
          word: wordStr,
          score: validation.score,
          tiles: data.moveData.placements.map((p: any) => ({ row: p.row, col: p.col, letter: p.tile?.letter })),
          moveType: "place",
        });

        // Check if game ended after this move
        if (room.gameManager.gameState.phase === "GAME_OVER") {
          const winner = room.gameManager.getWinner();
          persistGame("end", {
            gameCode: room.gameManager.gameState.gameCode,
            winnerId: winner?.id || "",
            winnerName: winner?.name || "",
          });
        }

        callback?.({ success: true, score: validation.score, words: validation.words });
        break;
      }
      case "InvalidWord": {
        // Request manual validation
        room.gameManager.setPendingValidation(validation.word, data.moveData);
        io.to(data.gameId).emit("game:word-validation", {
          word: validation.word,
          fromPlayerId: data.moveData.playerId,
        });
        broadcastGameState(room, data.gameId);
        callback?.({ success: false, error: `Palavra "${validation.word}" não encontrada no dicionário` });
        break;
      }
      case "InvalidPlacement": {
        callback?.({ success: false, error: validation.reason });
        break;
      }
    }
  });

  // ─── Pass Turn ──────────────────────────────────────────────────────────
  socket.on("game:pass", (data: { gameId: string; playerId: string }, callback) => {
    const room = gameRooms.get(data.gameId);
    if (!room) {
      callback?.({ success: false, error: "Partida não encontrada" });
      return;
    }

    const playerName = room.gameManager.gameState.players.find(
      (p) => p.id === data.playerId
    )?.name ?? "Jogador";

    room.gameManager.passTurn(data.playerId);
    broadcastGameState(room, data.gameId);

    io.to(data.gameId).emit("chat:message", {
      playerId: "system",
      playerName: "Sistema",
      message: `${playerName} passou a vez`,
      type: "system",
    });

    callback?.({ success: true });
  });

  // ─── Exchange Tiles ─────────────────────────────────────────────────────
  socket.on("game:exchange", (data: { gameId: string; playerId: string; tileIndices: number[] }, callback) => {
    const room = gameRooms.get(data.gameId);
    if (!room) {
      callback?.({ success: false, error: "Partida não encontrada" });
      return;
    }

    const playerName = room.gameManager.gameState.players.find(
      (p) => p.id === data.playerId
    )?.name ?? "Jogador";

    room.gameManager.exchangeTiles(data.playerId, data.tileIndices);
    room.tileBagState = room.gameManager.getTileBagState();
    broadcastGameState(room, data.gameId);

    io.to(data.gameId).emit("chat:message", {
      playerId: "system",
      playerName: "Sistema",
      message: `${playerName} trocou ${data.tileIndices.length} peça(s)`,
      type: "system",
    });

    callback?.({ success: true });
  });

  // ─── Word Approval ──────────────────────────────────────────────────────
  socket.on("game:word-approval", (data: { gameId: string; playerId: string; approved: boolean }, callback) => {
    const room = gameRooms.get(data.gameId);
    if (!room) {
      callback?.({ success: false, error: "Partida não encontrada" });
      return;
    }

    if (data.approved) {
      const word = room.gameManager.gameState.pendingValidationWord ?? "";
      room.gameManager.approveWord(word);
      io.to(data.gameId).emit("chat:message", {
        playerId: "system",
        playerName: "Sistema",
        message: `Palavra "${word}" foi aprovada`,
        type: "system",
      });
    } else {
      room.gameManager.rejectWord();
      io.to(data.gameId).emit("chat:message", {
        playerId: "system",
        playerName: "Sistema",
        message: "Palavra foi rejeitada",
        type: "system",
      });
    }

    room.tileBagState = room.gameManager.getTileBagState();
    broadcastGameState(room, data.gameId);
    callback?.({ success: true });
  });

  // ─── Chat Message ───────────────────────────────────────────────────────
  socket.on("chat:message", (data: { gameId: string; playerId: string; playerName: string; message: string }) => {
    io.to(data.gameId).emit("chat:message", {
      playerId: data.playerId,
      playerName: data.playerName,
      message: data.message,
      type: "chat",
    });
  });

  // ─── Disconnect ─────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id}`);

    if (currentGameId && currentPlayerId) {
      const room = gameRooms.get(currentGameId);
      if (room) {
        const playerInfo = room.players.get(currentPlayerId);
        room.players.delete(currentPlayerId);

        // Mark player as disconnected
        const state = room.gameManager.gameState;
        const playerIndex = state.players.findIndex((p) => p.id === currentPlayerId);
        if (playerIndex !== -1) {
          const updatedPlayers = [...state.players];
          updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            isConnected: false,
          };
          // We don't remove player, just mark as disconnected
        }

        io.to(currentGameId).emit("chat:message", {
          playerId: "system",
          playerName: "Sistema",
          message: `${playerInfo?.name ?? "Jogador"} desconectou`,
          type: "system",
        });

        broadcastPlayerList(room, currentGameId);

        // Clean up empty rooms
        if (room.players.size === 0) {
          gameRooms.delete(currentGameId);
          console.log(`[ROOM DELETED] ${currentGameId}`);
        }
      }
    }
  });

  // ─── Get Game Info ──────────────────────────────────────────────────────
  socket.on("game:info", (data: { gameCode: string }, callback) => {
    for (const [, room] of gameRooms.entries()) {
      if (room.gameManager.gameState.gameCode === data.gameCode) {
        const state = room.gameManager.gameState;
        callback({
          success: true,
          exists: true,
          status: state.phase,
          playerCount: state.players.length,
          maxPlayers: MAX_PLAYERS,
          hostName: state.players.find((p) => p.isHost)?.name ?? "",
        });
        return;
      }
    }
    callback({ success: true, exists: false });
  });

  // ─── Admin: List Rooms ──────────────────────────────────────────────────
  socket.on("admin:list-rooms", (callback) => {
    const rooms = Array.from(gameRooms.entries()).map(([id, room]) => {
      const state = room.gameManager.gameState;
      return {
        gameId: id,
        gameCode: state.gameCode,
        status: state.phase,
        playerCount: state.players.length,
        players: state.players.map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          isHost: p.isHost,
          isConnected: p.isConnected,
        })),
        tileBagCount: state.tileBagCount,
        createdAt: new Date().toISOString(),
      };
    });
    callback(rooms);
  });

  // ─── Admin: Approve Word ────────────────────────────────────────────────
  socket.on("admin:approve-word", (data: { word: string }, callback) => {
    dictionary.addApprovedWord(data.word, "admin");
    callback({ success: true });
  });

  // ─── Admin: Ban Word ────────────────────────────────────────────────────
  socket.on("admin:ban-word", (data: { word: string }, callback) => {
    dictionary.banWord(data.word);
    callback({ success: true });
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🎮 LetraMestre Game Server running on port ${PORT}`);
});
