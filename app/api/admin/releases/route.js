import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const res = await pool.query('SELECT * FROM stonegy_releases ORDER BY id DESC;');
    return NextResponse.json({ success: true, releases: res.rows });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  try {
    const { version, title, changelog, downloadUrl, forceUpdate } = await req.json();

    if (!version || !title || !changelog) {
      return NextResponse.json({ success: false, message: 'Versão, título e changelog são obrigatórios.' }, { status: 400 });
    }

    const cleanVer = version.trim().replace(/^v/, '');

    await pool.query(`
      INSERT INTO stonegy_releases (version, title, changelog, download_url, force_update, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (version) DO UPDATE SET
        title = $2, changelog = $3, download_url = $4, force_update = $5, created_at = NOW();
    `, [cleanVer, title.trim(), changelog.trim(), downloadUrl || '/download/latest', !!forceUpdate]);

    return NextResponse.json({ success: true, message: `Versão ${cleanVer} publicada com sucesso no PostgreSQL!` });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) return NextResponse.json({ success: false, message: 'ID é obrigatório.' }, { status: 400 });

  try {
    await pool.query('DELETE FROM stonegy_releases WHERE id = $1;', [id]);
    return NextResponse.json({ success: true, message: 'Versão removida.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
