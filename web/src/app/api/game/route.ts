import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Save game data when game starts/ends
export async function POST(req: NextRequest) {
  try {
    const { action, gameCode, hostId, hostName, status, winnerId, winnerName, playerCount, boardState, tileBagState } = await req.json();

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

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
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
    return NextResponse.json({ error: 'Erro ao salvar jogada' }, { status: 500 });
  }
}
