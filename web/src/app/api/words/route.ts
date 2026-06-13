import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const normalized = word.toUpperCase().trim();

    if (action === 'approve') {
      const existing = await db.approvedWord.findUnique({ where: { word: normalized } });
      if (existing) {
        return NextResponse.json({ error: 'Palavra já aprovada' }, { status: 400 });
      }
      // Remove from banned if exists
      await db.bannedWord.deleteMany({ where: { word: normalized } });
      
      const result = await db.approvedWord.create({
        data: { word: normalized, addedBy: addedBy || 'admin' }
      });
      return NextResponse.json({ success: true, word: result });
    } else if (action === 'ban') {
      const existing = await db.bannedWord.findUnique({ where: { word: normalized } });
      if (existing) {
        return NextResponse.json({ error: 'Palavra já banida' }, { status: 400 });
      }
      // Remove from approved if exists
      await db.approvedWord.deleteMany({ where: { word: normalized } });
      
      const result = await db.bannedWord.create({
        data: { word: normalized, addedBy: addedBy || 'admin' }
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
