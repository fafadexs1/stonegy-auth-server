import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const { adminPass, version, title, changelog, downloadUrl, forceUpdate } = await req.json();

    if (adminPass !== '123456' && adminPass !== process.env.ADMIN_KEY) {
      return NextResponse.json({ success: false, message: 'Senha de administrador incorreta.' }, { status: 403 });
    }

    if (!version || !title || !changelog) {
      return NextResponse.json({ success: false, message: 'Versão, título e changelog são obrigatórios.' }, { status: 400 });
    }

    await pool.query(`
      INSERT INTO stonegy_releases (version, title, changelog, download_url, force_update)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (version) DO UPDATE SET
        title = $2, changelog = $3, download_url = $4, force_update = $5, created_at = NOW();
    `, [version, title, changelog, downloadUrl || '/download/latest', !!forceUpdate]);

    return NextResponse.json({ success: true, message: `Versão ${version} publicada com sucesso no PostgreSQL!` });
  } catch (err) {
    return NextResponse.json({ success: false, message: `Erro ao publicar: ${err.message}` }, { status: 500 });
  }
}
