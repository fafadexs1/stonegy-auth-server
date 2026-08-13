import { NextResponse } from 'next/server';
import pool, { ensureDbSchema, hashPassword, generateToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const passHash = hashPassword(password);
    const userRes = await pool.query(
      `SELECT id, username, plan, role, is_admin, is_active 
       FROM stonegy_users 
       WHERE LOWER(username) = LOWER($1) AND password_hash = $2;`,
      [username.trim(), passHash]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário ou senha incorretos.' }, { status: 401 });
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return NextResponse.json({ success: false, message: 'Conta desativada pelo sistema.' }, { status: 403 });
    }

    if (!user.is_admin && user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Acesso negado: Este usuário não possui privilégios de Administrador.' }, { status: 403 });
    }

    const token = generateToken();
    await pool.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);
    await pool.query('UPDATE stonegy_users SET last_login = NOW() WHERE id = $1;', [user.id]);

    return NextResponse.json({
      success: true,
      token,
      admin: {
        id: user.id,
        username: user.username,
        role: user.role,
        plan: user.plan
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: `Erro no servidor: ${err.message}` }, { status: 500 });
  }
}
