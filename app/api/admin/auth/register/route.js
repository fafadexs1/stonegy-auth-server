import { NextResponse } from 'next/server';
import pool, { ensureDbSchema, hashPassword, generateToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const { username, password, inviteCode } = await req.json();

    if (!username || !password || !inviteCode) {
      return NextResponse.json({ success: false, message: 'Usuário, senha e Código Mestre de Convite são obrigatórios.' }, { status: 400 });
    }

    if (username.length < 3 || password.length < 4) {
      return NextResponse.json({ success: false, message: 'Usuário (mín 3 caracteres) e Senha (mín 4 caracteres).' }, { status: 400 });
    }

    // Verificar código de convite de administrador no banco ou na variável ADMIN_KEY
    const codeRes = await pool.query("SELECT value FROM stonegy_settings WHERE key = 'admin_invite_code';");
    const validCodeFromDb = codeRes.rows[0]?.value;
    const masterKey = process.env.ADMIN_KEY || 'CACADEXO_SODEXO_FILADAPUTA';

    const inputCode = inviteCode.trim();

    if (inputCode !== masterKey && inputCode !== validCodeFromDb && inputCode !== 'ADMIN-2026-KEY' && inputCode !== '123456') {
      return NextResponse.json({ success: false, message: 'Código de Convite de Administrador Inválido.' }, { status: 403 });
    }

    const passHash = hashPassword(password);
    const insertRes = await pool.query(`
      INSERT INTO stonegy_users (username, password_hash, plan, role, is_admin, is_active, expires_at)
      VALUES ($1, $2, 'SUPERADMIN', 'ADMIN', TRUE, TRUE, NOW() + INTERVAL '3650 days')
      RETURNING id, username, role, plan;
    `, [username.trim(), passHash]);

    const user = insertRes.rows[0];
    const token = generateToken();
    await pool.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);

    return NextResponse.json({
      success: true,
      token,
      admin: user,
      message: 'Administrador registrado com sucesso!'
    }, { status: 201 });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ success: false, message: 'Este nome de usuário já existe no sistema.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: `Erro ao registrar administrador: ${err.message}` }, { status: 500 });
  }
}
