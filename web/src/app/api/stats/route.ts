import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const totalGames = await db.game.count();
    const finishedGames = await db.game.count({ where: { status: 'finished' } });
    const activeGames = await db.game.count({ where: { status: 'playing' } });
    const waitingGames = await db.game.count({ where: { status: 'waiting' } });
    const totalPlayers = await db.player.count();
    const totalMoves = await db.move.count();
    const approvedWords = await db.approvedWord.count();
    const bannedWords = await db.bannedWord.count();

    // Average score
    const moves = await db.move.findMany({ where: { moveType: 'place' }, select: { score: true } });
    const avgScore = moves.length > 0 
      ? Math.round(moves.reduce((sum, m) => sum + m.score, 0) / moves.length) 
      : 0;

    // Top scoring moves
    const topMoves = await db.move.findMany({
      where: { moveType: 'place' },
      orderBy: { score: 'desc' },
      take: 10,
    });

    // Recent games
    const recentGames = await db.game.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { players: true },
    });

    return NextResponse.json({
      totalGames,
      finishedGames,
      activeGames,
      waitingGames,
      totalPlayers,
      totalMoves,
      approvedWords,
      bannedWords,
      avgScore,
      topMoves,
      recentGames,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 });
  }
}
