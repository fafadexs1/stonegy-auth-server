import { NextResponse } from 'next/server';
import pool, { ensureDbSchema, hashPassword, generateToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const { username, password } = await req.json();
    if (!username || !password || username.length < 3 || password.length < 4) {
      return NextResponse.json({ success: false, message: 'Usuário (mín 3 caracteres) e Senha (mín 4 caracteres) obrigatórios.' }, { status: 400 });
    }

    const passHash = hashPassword(password);
    const insertRes = await pool.query(`
      INSERT INTO stonegy_users (username, password_hash, plan, is_active, expires_at)
      VALUES ($1, $2, 'VIP PRO', TRUE, NOW() + INTERVAL '30 days')
      RETURNING id, username, plan, expires_at;
    `, [username.trim(), passHash]);

    const user = insertRes.rows[0];
    const token = generateToken();
    await pool.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);

    return NextResponse.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, plan: user.plan, expires_at: user.expires_at }
    }, { status: 201 });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ success: false, message: 'Este nome de usuário já existe no PostgreSQL.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: `Erro ao registrar: ${err.message}` }, { status: 500 });
  }
}
