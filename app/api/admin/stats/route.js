import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Acesso negado.' }, { status: 401 });
  }

  try {
    const [usersCount, vipCount, huntsCount, aggHunts, activeSessions, latestReleases] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM stonegy_users;'),
      pool.query("SELECT COUNT(*) as count FROM stonegy_users WHERE is_active = TRUE AND expires_at > NOW();"),
      pool.query('SELECT COUNT(*) as count FROM stonegy_hunts;'),
      pool.query(`
        SELECT 
          COALESCE(SUM(total_damage), 0) as total_damage,
          COALESCE(SUM(xp_gained), 0) as total_xp,
          COALESCE(SUM(loot_total), 0) as total_loot,
          COALESCE(SUM(total_kills), 0) as total_kills,
          COALESCE(MAX(max_hit), 0) as global_max_hit
        FROM stonegy_hunts;
      `),
      pool.query("SELECT COUNT(*) as count FROM stonegy_sessions WHERE expires_at > NOW();"),
      pool.query("SELECT version, title, force_update, created_at FROM stonegy_releases ORDER BY id DESC LIMIT 5;")
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: Number(usersCount.rows[0].count),
        activeVipUsers: Number(vipCount.rows[0].count),
        totalHunts: Number(huntsCount.rows[0].count),
        activeSessions: Number(activeSessions.rows[0].count),
        totalDamageDealt: Number(aggHunts.rows[0].total_damage),
        totalXpTracked: Number(aggHunts.rows[0].total_xp),
        totalLootGold: Number(aggHunts.rows[0].total_loot),
        totalKills: Number(aggHunts.rows[0].total_kills),
        globalMaxHit: Number(aggHunts.rows[0].global_max_hit),
        latestReleases: latestReleases.rows
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: `Erro ao buscar estatísticas: ${err.message}` }, { status: 500 });
  }
}
