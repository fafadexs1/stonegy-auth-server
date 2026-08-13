import { NextResponse } from 'next/server';
import pool, { hashPassword } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET: Listar Usuários com busca
export async function GET(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('q') || '';

  try {
    let query = `
      SELECT id, username, plan, role, is_admin, is_active, expires_at, created_at, last_login
      FROM stonegy_users
    `;
    const params = [];

    if (search) {
      query += ` WHERE LOWER(username) LIKE LOWER($1)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY id DESC LIMIT 100;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, users: res.rows });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: Criar novo usuário pelo admin
export async function POST(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const { username, password, plan, role, vipDays } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const passHash = hashPassword(password);
    const days = parseInt(vipDays) || 30;

    const res = await pool.query(`
      INSERT INTO stonegy_users (username, password_hash, plan, role, is_admin, is_active, expires_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW() + INTERVAL '${days} days')
      RETURNING id, username, plan, role, is_admin, expires_at;
    `, [username.trim(), passHash, plan || 'VIP PRO', role || 'USER', role === 'ADMIN']);

    return NextResponse.json({ success: true, user: res.rows[0], message: 'Usuário criado com sucesso!' });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ success: false, message: 'Nome de usuário já cadastrado.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT: Atualizar Usuário (adicionar dias VIP, mudar plano, resetar senha, ativar/desativar)
export async function PUT(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const { id, action, value } = await req.json();
    if (!id) return NextResponse.json({ success: false, message: 'ID do usuário não fornecido.' }, { status: 400 });

    if (action === 'toggle_active') {
      await pool.query('UPDATE stonegy_users SET is_active = NOT is_active WHERE id = $1;', [id]);
      return NextResponse.json({ success: true, message: 'Status de ativação alterado.' });
    }

    if (action === 'add_days') {
      const days = parseInt(value) || 30;
      await pool.query(`
        UPDATE stonegy_users 
        SET expires_at = GREATEST(NOW(), expires_at) + INTERVAL '${days} days'
        WHERE id = $1;
      `, [id]);
      return NextResponse.json({ success: true, message: `Adicionados +${days} dias de VIP.` });
    }

    if (action === 'reset_password') {
      if (!value || value.length < 4) {
        return NextResponse.json({ success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' }, { status: 400 });
      }
      const passHash = hashPassword(value);
      await pool.query('UPDATE stonegy_users SET password_hash = $1 WHERE id = $2;', [passHash, id]);
      return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso.' });
    }

    if (action === 'change_role') {
      const isAdmin = value === 'ADMIN';
      await pool.query('UPDATE stonegy_users SET role = $1, is_admin = $2 WHERE id = $3;', [value, isAdmin, id]);
      return NextResponse.json({ success: true, message: `Permissão alterada para ${value}.` });
    }

    if (action === 'change_plan') {
      await pool.query('UPDATE stonegy_users SET plan = $1 WHERE id = $2;', [value, id]);
      return NextResponse.json({ success: true, message: `Plano alterado para ${value}.` });
    }

    return NextResponse.json({ success: false, message: 'Ação desconhecida.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// DELETE: Remover Usuário
export async function DELETE(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) return NextResponse.json({ success: false, message: 'ID é obrigatório.' }, { status: 400 });

  try {
    await pool.query('DELETE FROM stonegy_users WHERE id = $1;', [id]);
    return NextResponse.json({ success: true, message: 'Usuário removido do PostgreSQL.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
