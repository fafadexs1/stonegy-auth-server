import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  const url = new URL(req.url);
  const sortBy = url.searchParams.get('sort') || 'recorded_at';
  const order = url.searchParams.get('order') || 'DESC';

  const validSorts = ['recorded_at', 'xp_hour', 'total_damage', 'dps_avg', 'max_hit', 'balance_profit', 'total_kills'];
  const safeSort = validSorts.includes(sortBy) ? sortBy : 'recorded_at';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  try {
    const res = await pool.query(`
      SELECT id, user_id, username, character_name, character_level, duration_sec, total_damage, dps_avg, max_hit, xp_gained, xp_hour, total_kills, balance_profit, recorded_at
      FROM stonegy_hunts
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT 100;
    `);

    return NextResponse.json({ success: true, hunts: res.rows });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action');

  try {
    if (action === 'clear_all') {
      await pool.query('TRUNCATE TABLE stonegy_hunts;');
      return NextResponse.json({ success: true, message: 'Todas as hunts foram limpas.' });
    }

    if (!id) return NextResponse.json({ success: false, message: 'ID não fornecido.' }, { status: 400 });

    await pool.query('DELETE FROM stonegy_hunts WHERE id = $1;', [id]);
    return NextResponse.json({ success: true, message: 'Registro de hunt removido.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
