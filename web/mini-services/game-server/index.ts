import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";
import {
  GameManager,
  MAX_PLAYERS,
  dictionary,
  type MoveData,
  type PlayerInfo,
  type Tile,
} from "../../src/lib/game/index";

// ─── Configuration (env-overridable for different deploy targets) ─────────────
const PORT = Number(process.env.GAME_SERVER_PORT ?? 3003);
const WEB_API_URL = process.env.WEB_API_URL ?? "http://localhost:3000";
// Idle rooms are reclaimed so a long-running server doesn't leak memory as
// thousands of abandoned lobbies/finished games accumulate.
const WAITING_ROOM_TTL_MS = Number(process.env.WAITING_ROOM_TTL_MS ?? 30 * 60_000); // 30 min
const FINISHED_ROOM_TTL_MS = Number(process.env.FINISHED_ROOM_TTL_MS ?? 5 * 60_000); // 5 min
const ABANDONED_ROOM_TTL_MS = Number(process.env.ABANDONED_ROOM_TTL_MS ?? 10 * 60_000); // no one connected
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 60_000);
// Grace period a player has to reconnect before being treated as gone.
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS ?? 45_000);

const MAX_NAME_LEN = 20;
const MAX_CHAT_LEN = 280;

// ─── Lightweight metrics (exposed on /metrics for ops/autoscaling) ────────────
const metrics = {
  startedAt: Date.now(),
  connections: 0,
  peakConnections: 0,
  gamesCreated: 0,
  gamesStarted: 0,
  movesPlayed: 0,
  chatMessages: 0,
  rateLimited: 0,
  reconnections: 0,
};

// ─── Input hardening ──────────────────────────────────────────────────────────
function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  // Strip control chars (incl. zero-width/RTL tricks) and collapse whitespace.
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ─── Per-socket token-bucket rate limiter ─────────────────────────────────────
interface Bucket { tokens: number; last: number }
const buckets = new Map<string, Map<string, Bucket>>();

function allow(socketId: string, action: string, capacity: number, refillPerSec: number): boolean {
  let perSocket = buckets.get(socketId);
  if (!perSocket) { perSocket = new Map(); buckets.set(socketId, perSocket); }
  let b = perSocket.get(action);
  const now = Date.now();
  if (!b) { b = { tokens: capacity, last: now }; perSocket.set(action, b); }
  b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
  b.last = now;
  if (b.tokens < 1) { metrics.rateLimited++; return false; }
  b.tokens -= 1;
  return true;
}

// ─── Database Persistence Helpers (best-effort, non-blocking) ─────────────────
async function postJson(path: string, method: string, body: Record<string, any>): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    await fetch(`${WEB_API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch {
    // Persistence is best-effort; the in-memory game is the source of truth.
  }
}

const persistGame = (action: string, data: Record<string, any>) =>
  void postJson(`/api/game?XTransformPort=3000`, "POST", { action, ...data });
const persistMove = (data: Record<string, any>) =>
  void postJson(`/api/game?XTransformPort=3000`, "PUT", data);
const persistWord = (word: string, action: "approve" | "ban") =>
  void postJson(`/api/words?XTransformPort=3000`, "POST", { word, action });

// Load the persisted dictionary (approved/banned words) so admin decisions and
// previously approved words survive a server restart.
async function loadDictionaryFromDb(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${WEB_API_URL}/api/words?XTransformPort=3000`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const data = (await res.json()) as { approved?: { word: string }[]; banned?: { word: string }[] };
    if (data.approved?.length) dictionary.loadApprovedWords(data.approved.map((w) => w.word));
    if (data.banned?.length) dictionary.loadBannedWords(data.banned.map((w) => w.word));
    console.log(`[DICT] loaded ${data.approved?.length ?? 0} approved / ${data.banned?.length ?? 0} banned words`);
  } catch {
    console.warn("[DICT] could not load persisted words (web API offline?) — using base dictionary");
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface RoomPlayer { socketId: string | null; name: string; disconnectTimer?: ReturnType<typeof setTimeout> }
interface GameRoom {
  gameManager: GameManager;
  players: Map<string, RoomPlayer>;
  tileBagState: Tile[];
  lastActivity: number;
}

// ─── Server Setup ───────────────────────────────────────────────────────────
const httpServer = createServer(handleHttp);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 15000,
  pingTimeout: 15000,
});

const gameRooms = new Map<string, GameRoom>();
// O(1) lookup of gameId by user-facing code — avoids scanning every room on join.
const codeIndex = new Map<string, string>();

// Optional horizontal scaling: if REDIS_URL is set and the adapter is present,
// fan out Socket.IO events across multiple instances. Degrades gracefully.
async function maybeAttachRedis(): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    // Resolved via string variables so the optional peer deps aren't required
    // at type-check / install time — only when REDIS_URL is actually set.
    const adapterMod = "@socket.io/redis-adapter";
    const redisMod = "redis";
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import(adapterMod),
      import(redisMod),
    ]);
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[SCALE] Redis adapter attached — multi-instance fan-out enabled");
  } catch (e) {
    console.warn("[SCALE] REDIS_URL set but adapter unavailable; running single-instance.", (e as Error).message);
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────────
function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (codeIndex.has(code)); // guarantee uniqueness even under load
  return code;
}

function touch(room: GameRoom): void {
  room.lastActivity = Date.now();
}

function destroyRoom(gameId: string): void {
  const room = gameRooms.get(gameId);
  if (room) {
    for (const p of room.players.values()) if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    codeIndex.delete(room.gameManager.gameState.gameCode);
  }
  gameRooms.delete(gameId);
}

function findRoomByCode(code: string): { gameId: string; room: GameRoom } | null {
  const gameId = codeIndex.get(code);
  if (!gameId) return null;
  const room = gameRooms.get(gameId);
  return room ? { gameId, room } : null;
}

function broadcastGameState(room: GameRoom, gameId: string) {
  const state = room.gameManager.gameState;

  // Send personalized state to each connected player (hide other racks).
  for (const [playerId, info] of room.players) {
    if (!info.socketId) continue;
    io.to(info.socketId).emit("game:state", room.gameManager.getPersonalizedState(playerId));
  }

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
  const playerList: PlayerInfo[] = room.gameManager.gameState.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
  }));
  io.to(gameId).emit("lobby:players", playerList);
}

function systemMessage(gameId: string, message: string) {
  io.to(gameId).emit("chat:message", { playerId: "system", playerName: "Sistema", message, type: "system" });
}

// ─── Idle room sweeper ────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [gameId, room] of gameRooms) {
    const phase = room.gameManager.gameState.phase;
    const idle = now - room.lastActivity;
    const anyConnected = [...room.players.values()].some((p) => p.socketId);

    const expired =
      (phase === "GAME_OVER" && idle > FINISHED_ROOM_TTL_MS) ||
      (phase === "WAITING_FOR_PLAYERS" && idle > WAITING_ROOM_TTL_MS) ||
      (!anyConnected && idle > ABANDONED_ROOM_TTL_MS);

    if (expired) {
      destroyRoom(gameId);
      console.log(`[SWEEP] reclaimed room ${gameId} (phase=${phase}, idleMs=${idle})`);
    }
  }
}, SWEEP_INTERVAL_MS).unref?.();

// ─── HTTP endpoints (health & metrics) ────────────────────────────────────────
function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptimeMs: Date.now() - metrics.startedAt, rooms: gameRooms.size }));
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ...metrics,
      uptimeMs: Date.now() - metrics.startedAt,
      activeRooms: gameRooms.size,
      activeConnections: io.engine.clientsCount,
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    }));
    return;
  }
  // Anything else is handled by Socket.IO's own upgrade/polling handlers.
  res.writeHead(404).end();
}

// ─── Socket.IO Connection Handling ──────────────────────────────────────────
io.on("connection", (socket) => {
  metrics.connections++;
  metrics.peakConnections = Math.max(metrics.peakConnections, io.engine.clientsCount);

  let currentGameId: string | null = null;
  let currentPlayerId: string | null = null;

  const fail = (cb: any, error: string) => cb?.({ success: false, error });

  // ─── Create Game ────────────────────────────────────────────────────────
  socket.on("game:create", (data: { playerName: string }, callback) => {
    if (!allow(socket.id, "create", 5, 1)) return fail(callback, "Muitas tentativas, aguarde um momento");
    const playerName = sanitizeText(data?.playerName, MAX_NAME_LEN);
    if (!playerName) return fail(callback, "Nome inválido");

    const gameCode = generateGameCode();
    const gameId = `game_${Date.now()}_${gameCode}`;
    const gameManager = new GameManager(gameId, gameCode);
    const player = gameManager.addPlayer(playerName);

    const room: GameRoom = {
      gameManager,
      players: new Map([[player.id, { socketId: socket.id, name: playerName }]]),
      tileBagState: gameManager.getTileBagState(),
      lastActivity: Date.now(),
    };

    gameRooms.set(gameId, room);
    codeIndex.set(gameCode, gameId);
    metrics.gamesCreated++;
    currentGameId = gameId;
    currentPlayerId = player.id;
    socket.join(gameId);

    callback?.({ success: true, gameId, gameCode, playerId: player.id, playerName: player.name, isHost: true });
    broadcastPlayerList(room, gameId);
    console.log(`[GAME CREATED] ${gameCode} by ${playerName}`);

    persistGame("create", { gameCode, hostId: player.id, hostName: playerName, playerCount: 1 });
  });

  // ─── Join Game ──────────────────────────────────────────────────────────
  socket.on("game:join", (data: { gameCode: string; playerName: string }, callback) => {
    if (!allow(socket.id, "join", 10, 2)) return fail(callback, "Muitas tentativas, aguarde um momento");
    const code = sanitizeText(data?.gameCode, 6).toUpperCase();
    const playerName = sanitizeText(data?.playerName, MAX_NAME_LEN);
    if (!playerName) return fail(callback, "Nome inválido");

    const found = findRoomByCode(code);
    if (!found || found.room.gameManager.gameState.phase !== "WAITING_FOR_PLAYERS") {
      return fail(callback, "Partida não encontrada ou já em andamento");
    }
    const { gameId, room } = found;

    if (room.gameManager.gameState.players.length >= MAX_PLAYERS) return fail(callback, "Partida cheia");
    if (room.gameManager.gameState.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
      return fail(callback, "Nome já está em uso nesta partida");
    }

    const player = room.gameManager.addPlayer(playerName);
    room.players.set(player.id, { socketId: socket.id, name: playerName });
    touch(room);

    currentGameId = gameId;
    currentPlayerId = player.id;
    socket.join(gameId);

    callback?.({ success: true, gameId, gameCode: code, playerId: player.id, playerName: player.name, isHost: false });
    broadcastPlayerList(room, gameId);
    socket.to(gameId).emit("chat:message", {
      playerId: "system", playerName: "Sistema", message: `${playerName} entrou na partida`, type: "system",
    });
    console.log(`[JOIN] ${playerName} joined ${code}`);
  });

  // ─── Rejoin (reconnection) ────────────────────────────────────────────────
  // Lets a player resume a match after a refresh or network blip using the
  // identifiers they already hold, instead of losing their seat and rack.
  socket.on("game:rejoin", (data: { gameId: string; playerId: string }, callback) => {
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada ou expirada");
    const member = room.players.get(data?.playerId);
    if (!member) return fail(callback, "Jogador não faz parte desta partida");

    if (member.disconnectTimer) { clearTimeout(member.disconnectTimer); member.disconnectTimer = undefined; }
    member.socketId = socket.id;
    currentGameId = data.gameId;
    currentPlayerId = data.playerId;
    socket.join(data.gameId);
    touch(room);

    const changed = room.gameManager.setPlayerConnection(data.playerId, true);
    metrics.reconnections++;

    const player = room.gameManager.gameState.players.find((p) => p.id === data.playerId);
    callback?.({
      success: true,
      gameId: data.gameId,
      gameCode: room.gameManager.gameState.gameCode,
      playerId: data.playerId,
      playerName: player?.name ?? "",
      isHost: player?.isHost ?? false,
      phase: room.gameManager.gameState.phase,
    });

    // Restore the player's view immediately.
    socket.emit("game:state", room.gameManager.getPersonalizedState(data.playerId));
    broadcastPlayerList(room, data.gameId);
    if (changed) systemMessage(data.gameId, `${player?.name ?? "Jogador"} reconectou`);
    console.log(`[REJOIN] ${player?.name} -> ${room.gameManager.gameState.gameCode}`);
  });

  // ─── Start Game ─────────────────────────────────────────────────────────
  socket.on("game:start", (data: { gameId: string; playerId: string }, callback) => {
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada");

    const state = room.gameManager.gameState;
    if (!state.players.find((p) => p.id === data.playerId)?.isHost) {
      return fail(callback, "Apenas o anfitrião pode iniciar");
    }
    if (state.players.length < 2) return fail(callback, "Mínimo de 2 jogadores");

    room.gameManager.startGame();
    room.tileBagState = room.gameManager.getTileBagState();
    touch(room);
    metrics.gamesStarted++;

    io.to(data.gameId).emit("game:started", room.gameManager.gameState);
    broadcastGameState(room, data.gameId);
    systemMessage(data.gameId, "O jogo começou!");
    callback?.({ success: true });
    console.log(`[GAME STARTED] ${state.gameCode}`);

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
    if (!allow(socket.id, "move", 8, 2)) return fail(callback, "Calma! Muitas jogadas em sequência");
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada");
    // Reject moves spoofing another player's identity.
    if (currentPlayerId && data.moveData?.playerId !== currentPlayerId) {
      return fail(callback, "Identidade do jogador inválida");
    }
    touch(room);

    const validation = room.gameManager.validateMove(data.moveData);
    switch (validation.type) {
      case "Valid": {
        room.gameManager.processValidMove(data.moveData, validation.score);
        room.tileBagState = room.gameManager.getTileBagState();
        metrics.movesPlayed++;
        broadcastGameState(room, data.gameId);

        const wordStr = validation.words.join(", ");
        const playerName = room.gameManager.gameState.players.find((p) => p.id === data.moveData.playerId)?.name ?? "Jogador";
        systemMessage(data.gameId, `${playerName} jogou "${wordStr}" por ${validation.score} pontos`);

        persistMove({
          gameCode: room.gameManager.gameState.gameCode,
          playerId: data.moveData.playerId,
          playerName,
          word: wordStr,
          score: validation.score,
          tiles: data.moveData.placements.map((p: any) => ({ row: p.row, col: p.col, letter: p.tile?.letter })),
          moveType: "place",
        });

        if (room.gameManager.gameState.phase === "GAME_OVER") {
          const winner = room.gameManager.getWinner();
          persistGame("end", { gameCode: room.gameManager.gameState.gameCode, winnerId: winner?.id || "", winnerName: winner?.name || "" });
        }
        callback?.({ success: true, score: validation.score, words: validation.words });
        break;
      }
      case "InvalidWord": {
        room.gameManager.setPendingValidation(validation.word, data.moveData);
        io.to(data.gameId).emit("game:word-validation", { word: validation.word, fromPlayerId: data.moveData.playerId });
        broadcastGameState(room, data.gameId);
        fail(callback, `Palavra "${validation.word}" não encontrada no dicionário`);
        break;
      }
      case "InvalidPlacement":
        fail(callback, validation.reason);
        break;
    }
  });

  // ─── Pass Turn ──────────────────────────────────────────────────────────
  socket.on("game:pass", (data: { gameId: string; playerId: string }, callback) => {
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada");
    touch(room);
    const playerName = room.gameManager.gameState.players.find((p) => p.id === data.playerId)?.name ?? "Jogador";
    room.gameManager.passTurn(data.playerId);
    broadcastGameState(room, data.gameId);
    systemMessage(data.gameId, `${playerName} passou a vez`);
    callback?.({ success: true });
  });

  // ─── Exchange Tiles ─────────────────────────────────────────────────────
  socket.on("game:exchange", (data: { gameId: string; playerId: string; tileIndices: number[] }, callback) => {
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada");
    touch(room);
    const playerName = room.gameManager.gameState.players.find((p) => p.id === data.playerId)?.name ?? "Jogador";
    room.gameManager.exchangeTiles(data.playerId, data.tileIndices);
    room.tileBagState = room.gameManager.getTileBagState();
    broadcastGameState(room, data.gameId);
    systemMessage(data.gameId, `${playerName} trocou ${data.tileIndices.length} peça(s)`);
    callback?.({ success: true });
  });

  // ─── Word Approval ──────────────────────────────────────────────────────
  socket.on("game:word-approval", (data: { gameId: string; playerId: string; approved: boolean }, callback) => {
    const room = gameRooms.get(data?.gameId);
    if (!room) return fail(callback, "Partida não encontrada");
    touch(room);

    if (data.approved) {
      const word = room.gameManager.gameState.pendingValidationWord ?? "";
      room.gameManager.approveWord(word);
      if (word) persistWord(word, "approve");
      systemMessage(data.gameId, `Palavra "${word}" foi aprovada`);
    } else {
      room.gameManager.rejectWord();
      systemMessage(data.gameId, "Palavra foi rejeitada");
    }
    room.tileBagState = room.gameManager.getTileBagState();
    broadcastGameState(room, data.gameId);
    callback?.({ success: true });
  });

  // ─── Chat Message ───────────────────────────────────────────────────────
  socket.on("chat:message", (data: { gameId: string; playerId: string; playerName: string; message: string }) => {
    if (!allow(socket.id, "chat", 5, 1)) return; // drop spam silently
    const room = gameRooms.get(data?.gameId);
    if (!room) return;
    const message = sanitizeText(data?.message, MAX_CHAT_LEN);
    if (!message) return;
    // Trust the server-side identity rather than client-claimed name.
    const playerName = room.gameManager.gameState.players.find((p) => p.id === data.playerId)?.name
      ?? sanitizeText(data?.playerName, MAX_NAME_LEN) ?? "Jogador";
    metrics.chatMessages++;
    touch(room);
    io.to(data.gameId).emit("chat:message", { playerId: data.playerId, playerName, message, type: "chat" });
  });

  // ─── Disconnect ─────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (!currentGameId || !currentPlayerId) return;
    const room = gameRooms.get(currentGameId);
    if (!room) return;
    const gameId = currentGameId;
    const playerId = currentPlayerId;
    const member = room.players.get(playerId);
    if (!member) return;

    member.socketId = null; // keep the seat for a grace period to allow reconnect
    const state = room.gameManager.gameState;

    if (state.phase === "WAITING_FOR_PLAYERS") {
      // In the lobby there's no rack to preserve — free the seat right away.
      room.players.delete(playerId);
      room.gameManager.removePlayer(playerId);
      room.gameManager.reassignHostIfNeeded();
      systemMessage(gameId, `${member.name} saiu da sala`);
      broadcastPlayerList(room, gameId);
      if (room.players.size === 0) { destroyRoom(gameId); console.log(`[ROOM DELETED] ${gameId}`); }
      return;
    }

    // Mid-game: mark disconnected, keep their tiles, and don't let the match
    // stall on their turn. A grace timer reclaims the seat if they don't return.
    room.gameManager.setPlayerConnection(playerId, false);
    room.gameManager.reassignHostIfNeeded();
    if (room.gameManager.skipTurnIfCurrent(playerId)) {
      systemMessage(gameId, `${member.name} desconectou — vez avançada`);
    } else {
      systemMessage(gameId, `${member.name} desconectou`);
    }
    broadcastGameState(room, gameId);
    broadcastPlayerList(room, gameId);

    member.disconnectTimer = setTimeout(() => {
      const r = gameRooms.get(gameId);
      if (!r) return;
      const m = r.players.get(playerId);
      if (!m || m.socketId) return; // reconnected in time
      r.players.delete(playerId);
      const stillConnected = [...r.players.values()].some((p) => p.socketId);
      if (!stillConnected) { destroyRoom(gameId); console.log(`[ROOM DELETED] ${gameId} (all left)`); }
    }, DISCONNECT_GRACE_MS);
  });

  // ─── Get Game Info ──────────────────────────────────────────────────────
  socket.on("game:info", (data: { gameCode: string }, callback) => {
    const found = findRoomByCode(sanitizeText(data?.gameCode, 6).toUpperCase());
    if (!found) return callback?.({ success: true, exists: false });
    const state = found.room.gameManager.gameState;
    callback?.({
      success: true,
      exists: true,
      status: state.phase,
      playerCount: state.players.length,
      maxPlayers: MAX_PLAYERS,
      hostName: state.players.find((p) => p.isHost)?.name ?? "",
    });
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
        players: state.players.map((p) => ({ id: p.id, name: p.name, score: p.score, isHost: p.isHost, isConnected: p.isConnected })),
        tileBagCount: state.tileBagCount,
        lastActivity: new Date(room.lastActivity).toISOString(),
      };
    });
    callback?.(rooms);
  });

  // ─── Admin: Approve / Ban Word (persisted) ────────────────────────────────
  socket.on("admin:approve-word", (data: { word: string }, callback) => {
    const word = sanitizeText(data?.word, 30);
    if (word) { dictionary.addApprovedWord(word, "admin"); persistWord(word, "approve"); }
    callback?.({ success: true });
  });
  socket.on("admin:ban-word", (data: { word: string }, callback) => {
    const word = sanitizeText(data?.word, 30);
    if (word) { dictionary.banWord(word); persistWord(word, "ban"); }
    callback?.({ success: true });
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
async function main() {
  await loadDictionaryFromDb();
  await maybeAttachRedis();
  httpServer.listen(PORT, () => {
    console.log(`🎮 LetraMestre Game Server running on port ${PORT}`);
    console.log(`   health: http://localhost:${PORT}/healthz   metrics: http://localhost:${PORT}/metrics`);
  });
}

main();
