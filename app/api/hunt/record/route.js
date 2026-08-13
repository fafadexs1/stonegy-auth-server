import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureDbSchema();
  try {
    const body = await req.json();
    await pool.query(`
      INSERT INTO stonegy_hunts 
      (user_id, username, character_name, character_level, duration_sec, total_damage, dps_avg, max_hit, xp_gained, xp_hour, total_kills, kills_hour, loot_total, supplies_waste, balance_profit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
    `, [
      body.userId || null, body.username || 'Hunter', body.characterName || 'Hunter', body.level || 1,
      body.durationSec || 0, body.totalDamage || 0, body.dpsAvg || 0, body.maxHit || 0,
      body.xpGained || 0, body.xpHour || 0, body.totalKills || 0, body.killsHour || 0,
      body.lootTotal || 0, body.suppliesWaste || 0, body.balanceProfit || 0
    ]);

    return NextResponse.json({ success: true, message: 'Hunt gravada no PostgreSQL com sucesso!' });
  } catch (err) {
    return NextResponse.json({ success: false, message: `Erro ao gravar: ${err.message}` }, { status: 500 });
  }
}
