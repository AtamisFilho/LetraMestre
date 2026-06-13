import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Admin login
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // Check if admin exists, if not create default
    let admin = await db.adminUser.findFirst({ where: { username } });
    
    if (!admin) {
      // Create default admin on first run
      if (username === 'admin' && password === 'letramestre') {
        admin = await db.adminUser.create({
          data: { username: 'admin', password: 'letramestre' }
        });
      } else {
        return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
      }
    }

    if (admin.password !== password) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      username: admin.username,
      id: admin.id 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
