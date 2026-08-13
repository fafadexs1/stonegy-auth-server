import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const res = await pool.query('SELECT key, value, updated_at FROM stonegy_settings;');
    const settingsObj = {};
    res.rows.forEach(r => { settingsObj[r.key] = r.value; });

    return NextResponse.json({ success: true, settings: settingsObj });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const { settings } = await req.json();
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ success: false, message: 'Configurações inválidas.' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO stonegy_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW();
      `, [key, String(value)]);
    }

    return NextResponse.json({ success: true, message: 'Configurações salvas no PostgreSQL com sucesso!' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
