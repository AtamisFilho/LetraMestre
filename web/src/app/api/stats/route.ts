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

    // Average score — computed in DB (audit 2-b A5) instead of loading every
    // place-move row into JS memory. _avg.score is null when _count=0; the
    // fallback preserves the prior "no moves → 0" behavior.
    const placeAgg = await db.move.aggregate({
      _avg: { score: true },
      _count: true,
      where: { moveType: 'place' },
    });
    const avgScore = placeAgg._count > 0 && placeAgg._avg.score != null
      ? Math.round(placeAgg._avg.score)
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
