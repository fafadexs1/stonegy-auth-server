import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function safeLimit(value, fallback = 24) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? Math.min(168, Math.max(1, parsed)) : fallback;
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function economyFromPayload(payload) {
  const root = asObject(payload);
  return asObject(root.economy || root);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req) {
  try {
    await ensureDbSchema();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const characterName = searchParams.get('characterName');
    const hours = safeLimit(searchParams.get('hours'));
    const params = [hours];
    let where = `event_type IN ('ECONOMY_SNAPSHOT', 'GOLD_OUT', 'GOLD_IN', 'POTION_CONSUMED')
      AND created_at >= NOW() - ($1 * INTERVAL '1 hour')`;

    if (username) {
      params.push(username);
      where += ` AND LOWER(username) = LOWER($${params.length})`;
    }
    if (characterName) {
      params.push(characterName);
      where += ` AND LOWER(character_name) = LOWER($${params.length})`;
    }

    const result = await pool.query(`
      SELECT id, username, character_name, event_type, payload, created_at
      FROM stonegy_events
      WHERE ${where}
      ORDER BY created_at ASC
      LIMIT 5000;
    `, params);

    let latest = null;
    let goldOut = 0;
    let goldIn = 0;
    let potionEvents = 0;
    const history = [];

    for (const row of result.rows) {
      const payload = asObject(row.payload);
      if (row.event_type === 'ECONOMY_SNAPSHOT') {
        latest = economyFromPayload(payload);
        history.push({
          at: row.created_at,
          netProfit: Number(latest.netProfit || 0),
          inventoryValue: Number(latest.inventory?.knownValue || 0),
          goal: latest.decision?.goal || 'balanced'
        });
      } else if (row.event_type === 'GOLD_OUT') {
        goldOut += Math.max(0, Number(payload.cost || 0));
      } else if (row.event_type === 'GOLD_IN') {
        goldIn += Math.max(0, Number(payload.delta || 0));
      } else if (row.event_type === 'POTION_CONSUMED') {
        potionEvents += Math.max(0, Number(payload.quantity || 0));
      }
    }

    const economy = latest || {
      gold: { start: 0, current: 0, gained: 0, spent: 0 },
      lootValue: 0,
      moneyLost: 0,
      supplyCost: 0,
      healthPotionCost: 0,
      manaPotionCost: 0,
      netProfit: 0,
      netProfitPerHour: 0,
      inventory: { knownValue: 0, sellableValue: 0, unknownItemCount: 0, unknownQuantity: 0, items: [] },
      decision: { goal: 'balanced', reason: 'Ainda não há snapshot suficiente.' },
      potionUsage: { health: 0, mana: 0 }
    };

    return NextResponse.json({
      success: true,
      windowHours: hours,
      samples: history.length,
      aggregates: { goldIn, goldOut, potionEvents },
      economy,
      history: history.slice(-100)
    }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: corsHeaders });
  }
}

