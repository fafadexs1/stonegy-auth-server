import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureDbSchema();
  try {
    const verRes = await pool.query(`
      SELECT version, title, changelog, download_url, force_update, created_at
      FROM stonegy_releases
      WHERE is_active = TRUE
      ORDER BY id DESC
      LIMIT 1;
    `);

    const SITE_URL = process.env.SITE_URL || 'https://tibiaonline.klyraai.com.br';

    if (verRes.rows.length > 0) {
      const rel = verRes.rows[0];
      const dlUrl = rel.download_url.startsWith('http') ? rel.download_url : `${SITE_URL}${rel.download_url}`;
      return NextResponse.json({
        success: true,
        latestVersion: rel.version,
        title: rel.title,
        changelog: rel.changelog,
        downloadUrl: dlUrl,
        websiteUrl: SITE_URL,
        forceUpdate: rel.force_update,
        releaseDate: rel.created_at
      });
    }

    return NextResponse.json({
      success: true,
      latestVersion: '3.4.0',
      websiteUrl: SITE_URL,
      downloadUrl: `${SITE_URL}/download/latest`
    });
  } catch (err) {
    return NextResponse.json({ success: true, latestVersion: '3.4.0' });
  }
}
