import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeWord } from '@/lib/game/dictionary';

// Get all approved/banned words
export async function GET() {
  try {
    const approved = await db.approvedWord.findMany({ orderBy: { createdAt: 'desc' } });
    const banned = await db.bannedWord.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ approved, banned });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar palavras' }, { status: 500 });
  }
}

// Add approved word
export async function POST(req: NextRequest) {
  try {
    const { word, action, addedBy } = await req.json();
    if (typeof word !== 'string' || !word.trim()) {
      return NextResponse.json({ error: 'Palavra inválida' }, { status: 400 });
    }
    const normalized = normalizeWord(word);
    if (normalized.length < 2) {
      return NextResponse.json({ error: 'Palavra muito curta' }, { status: 400 });
    }

    if (action === 'approve') {
      // Idempotent: the realtime server may replay approvals on every game.
      await db.bannedWord.deleteMany({ where: { word: normalized } });
      const result = await db.approvedWord.upsert({
        where: { word: normalized },
        create: { word: normalized, addedBy: addedBy || 'admin' },
        update: {},
      });
      return NextResponse.json({ success: true, word: result });
    } else if (action === 'ban') {
      await db.approvedWord.deleteMany({ where: { word: normalized } });
      const result = await db.bannedWord.upsert({
        where: { word: normalized },
        create: { word: normalized, addedBy: addedBy || 'admin' },
        update: {},
      });
      return NextResponse.json({ success: true, word: result });
    } else if (action === 'delete') {
      await db.approvedWord.deleteMany({ where: { word: normalized } });
      await db.bannedWord.deleteMany({ where: { word: normalized } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao processar palavra' }, { status: 500 });
  }
}
