import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureDbSchema();
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time, current_database() as db_name;');
    const siteUrl = process.env.SITE_URL || 'https://tibiaonline.klyraai.com.br';
    const port = process.env.PORT || '2020';

    return NextResponse.json({
      success: true,
      status: 'online',
      
      site: {
        url: siteUrl,
        port: port
      },
      api: {
        url: `${siteUrl}/api`,
        port: port
      },
      game: {
        url: process.env.TARGET_GAME_URL || 'https://stonegy-online.com',
        port: '443'
      },
      database: {
        name: dbRes.rows[0].db_name,
        port: process.env.DB_PORT || '4264',
        time: dbRes.rows[0].db_time
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, status: 'offline', error: err.message }, { status: 503 });
  }
}
