import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// List active games for crash-recovery rehydrate (game-server startup).
// Middleware already blocks unauthenticated callers — this handler trusts the
// caller (admin cookie or x-internal-key) and returns the minimal shape the
// game-server needs to rebuild its in-memory rooms Map.
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  if (action !== 'active') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }

  try {
    const games = await db.game.findMany({
      where: { status: { in: ['waiting', 'playing'] } },
      include: { players: true },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ success: true, games });
  } catch (error) {
    console.error('[api/game GET active] failed', error);
    return NextResponse.json({ error: 'Erro ao buscar partidas ativas' }, { status: 500 });
  }
}

interface SyncPlayer {
  id: string;
  name: string;
  score: number;
  rack: unknown;
  isHost: boolean;
  isConnected: boolean;
  joinOrder: number;
}

function isValidSyncPlayer(p: unknown): p is SyncPlayer {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.score === 'number' &&
    Array.isArray(o.rack) &&
    typeof o.isHost === 'boolean' &&
    typeof o.isConnected === 'boolean' &&
    typeof o.joinOrder === 'number'
  );
}

// Save game data when game starts/ends, OR full-state sync (transactional
// upsert of Game + all Players with orphan cleanup). The sync action is the
// superset used by the game-server's persistFullState debounce path; the
// start/end/create actions remain for partial mid-game persistence.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, gameCode, hostId, hostName, status, winnerId, winnerName, playerCount, boardState, tileBagState } = body;

    if (action === 'start') {
      // Create or update game in DB
      const game = await db.game.upsert({
        where: { code: gameCode },
        create: {
          code: gameCode,
          status: 'playing',
          hostId,
          hostName,
          playerCount,
          boardState: boardState || '{}',
          tileBagState: tileBagState || '[]',
        },
        update: {
          status: 'playing',
          playerCount,
          boardState: boardState || '{}',
          tileBagState: tileBagState || '[]',
        },
      });
      return NextResponse.json({ success: true, game });
    }

    if (action === 'end') {
      const game = await db.game.update({
        where: { code: gameCode },
        data: {
          status: 'finished',
          winnerId,
          winnerName,
          boardState: boardState || '{}',
        },
      });
      return NextResponse.json({ success: true, game });
    }

    if (action === 'create') {
      const game = await db.game.create({
        data: {
          code: gameCode,
          status: 'waiting',
          hostId,
          hostName,
          playerCount: playerCount || 1,
        },
      });
      return NextResponse.json({ success: true, game });
    }

    if (action === 'sync') {
      // Comprehensive state sync from the game-server. Upsert Game + Players
      // transactionally; remove Players that no longer exist in-memory.
      if (typeof gameCode !== 'string' || !gameCode.trim()) {
        return NextResponse.json({ error: 'gameCode é obrigatório' }, { status: 400 });
      }

      const serverGameId: unknown = body.serverGameId;
      const playersRaw: unknown = body.players;
      const statusSync: unknown = body.status;
      const boardSync: unknown = body.boardState;
      const tileBagSync: unknown = body.tileBagState;
      const winnerIdSync: unknown = body.winnerId;
      const winnerNameSync: unknown = body.winnerName;
      const hostIdSync: unknown = body.hostId;
      const hostNameSync: unknown = body.hostName;
      const playerCountSync: unknown = body.playerCount;

      if (!Array.isArray(playersRaw) || !playersRaw.every(isValidSyncPlayer)) {
        return NextResponse.json({ error: 'Player inválido no sync' }, { status: 400 });
      }

      const players = playersRaw as SyncPlayer[];
      const providedIds = players.map((p) => p.id);

      const game = await db.$transaction(async (tx) => {
        const upserted = await tx.game.upsert({
          where: { code: gameCode },
          create: {
            code: gameCode,
            status: typeof statusSync === 'string' ? statusSync : 'playing',
            hostId: typeof hostIdSync === 'string' ? hostIdSync : '',
            hostName: typeof hostNameSync === 'string' ? hostNameSync : '',
            // Only stamp serverGameId when the caller provides one — a sync
            // without it must NOT blow away a value set by a prior sync.
            ...(typeof serverGameId === 'string' && serverGameId ? { serverGameId } : {}),
            winnerId: typeof winnerIdSync === 'string' ? winnerIdSync : null,
            winnerName: typeof winnerNameSync === 'string' ? winnerNameSync : null,
            boardState: typeof boardSync === 'string' ? boardSync : '{}',
            tileBagState: typeof tileBagSync === 'string' ? tileBagSync : '[]',
            playerCount: typeof playerCountSync === 'number' ? playerCountSync : players.length,
          },
          update: {
            status: typeof statusSync === 'string' ? statusSync : 'playing',
            hostId: typeof hostIdSync === 'string' ? hostIdSync : undefined,
            hostName: typeof hostNameSync === 'string' ? hostNameSync : undefined,
            ...(typeof serverGameId === 'string' && serverGameId ? { serverGameId } : {}),
            winnerId: typeof winnerIdSync === 'string' ? winnerIdSync : undefined,
            winnerName: typeof winnerNameSync === 'string' ? winnerNameSync : undefined,
            boardState: typeof boardSync === 'string' ? boardSync : undefined,
            tileBagState: typeof tileBagSync === 'string' ? tileBagSync : undefined,
            playerCount: typeof playerCountSync === 'number' ? playerCountSync : players.length,
          },
        });

        for (const p of players) {
          await tx.player.upsert({
            where: { id: p.id },
            create: {
              id: p.id,
              gameId: upserted.id,
              name: p.name,
              score: p.score,
              rack: JSON.stringify(p.rack ?? []),
              isHost: p.isHost,
              isConnected: p.isConnected,
              joinOrder: p.joinOrder,
            },
            update: {
              name: p.name,
              score: p.score,
              rack: JSON.stringify(p.rack ?? []),
              isHost: p.isHost,
              isConnected: p.isConnected,
              joinOrder: p.joinOrder,
            },
          });
        }

        // Orphan cleanup — CRITICAL: scope by gameId so a sync for game A
        // never deletes players belonging to game B.
        if (providedIds.length > 0) {
          await tx.player.deleteMany({
            where: { gameId: upserted.id, id: { notIn: providedIds } },
          });
        }

        return tx.game.findUnique({
          where: { id: upserted.id },
          include: { players: true },
        });
      });

      return NextResponse.json({ success: true, game });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[api/game POST] failed', error);
    return NextResponse.json({ error: 'Erro ao processar jogo' }, { status: 500 });
  }
}

// Save move
export async function PUT(req: NextRequest) {
  try {
    const { gameCode, playerId, playerName, word, score, tiles, moveType } = await req.json();

    const game = await db.game.findUnique({ where: { code: gameCode } });
    if (!game) {
      return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 });
    }

    const move = await db.move.create({
      data: {
        gameId: game.id,
        playerId,
        playerName,
        word,
        score,
        tiles: JSON.stringify(tiles || []),
        moveType,
      },
    });

    return NextResponse.json({ success: true, move });
  } catch (error) {
    console.error('[api/game PUT] failed', error);
    return NextResponse.json({ error: 'Erro ao salvar jogada' }, { status: 500 });
  }
}
