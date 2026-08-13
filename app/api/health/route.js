import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureDbSchema();
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time, current_database() as db_name;');
    return NextResponse.json({
      success: true,
      status: 'online',
      
      auth: {
        url: process.env.AUTH_URL || 'https://authtibia.klyraai.com.br',
        port: process.env.AUTH_PORT || '3333'
      },
      website: {
        url: process.env.WEBSITE_URL || 'https://tibiaonline.dialogy.klyraai.com.br',
        port: process.env.WEBSITE_PORT || '3333'
      },
      game: {
        url: process.env.TARGET_GAME_URL || 'https://stonegy-online.com',
        port: process.env.TARGET_GAME_PORT || '443'
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
