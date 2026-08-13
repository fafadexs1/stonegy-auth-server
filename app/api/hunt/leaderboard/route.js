import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureDbSchema();
  try {
    const topXp = await pool.query(`
      SELECT username, character_name, character_level, xp_hour, total_damage, dps_avg, total_kills, balance_profit, recorded_at
      FROM stonegy_hunts
      ORDER BY xp_hour DESC
      LIMIT 10;
    `);

    return NextResponse.json({ success: true, topXp: topXp.rows });
  } catch (err) {
    return NextResponse.json({ success: false, message: `Erro ao obter leaderboard: ${err.message}` }, { status: 500 });
  }
}
