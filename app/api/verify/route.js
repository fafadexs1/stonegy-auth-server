import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Token não fornecido.' }, { status: 401 });
    }

    const resCheck = await pool.query(`
      SELECT u.id, u.username, u.plan, u.is_active, u.expires_at
      FROM stonegy_sessions s
      JOIN stonegy_users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE;
    `, [token]);

    if (resCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Sessão inválida ou expirada no banco de dados.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: resCheck.rows[0] });
  } catch (err) {
    return NextResponse.json({ success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' }, { status: 503 });
  }
}
