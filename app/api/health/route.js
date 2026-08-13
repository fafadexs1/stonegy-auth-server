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
      authUrl: process.env.AUTH_URL || 'https://authtibia.klyraai.com.br',
      websiteUrl: process.env.WEBSITE_URL || 'https://tibiaonline.dialogy.klyraai.com.br',
      gameUrl: process.env.TARGET_GAME_URL || 'https://stonegy-online.com',
      dbName: dbRes.rows[0].db_name,
      dbTime: dbRes.rows[0].db_time,
    });
  } catch (err) {
    return NextResponse.json({ success: false, status: 'offline', error: err.message }, { status: 503 });
  }
}
