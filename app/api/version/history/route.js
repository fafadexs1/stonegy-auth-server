import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureDbSchema();
  try {
    const resList = await pool.query(`
      SELECT version, title, changelog, download_url, force_update, created_at
      FROM stonegy_releases
      WHERE is_active = TRUE
      ORDER BY id DESC;
    `);

    return NextResponse.json({ success: true, releases: resList.rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
