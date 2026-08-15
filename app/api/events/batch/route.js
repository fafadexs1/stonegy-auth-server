import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sanitizeForPostgresJson(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\u0000/g, '').replace(/\\u0000/g, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForPostgresJson);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const key of Object.keys(obj)) {
      cleaned[key] = sanitizeForPostgresJson(obj[key]);
    }
    return cleaned;
  }
  return obj;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    await ensureDbSchema();
    const body = await req.json();
    const { events, userId, username, characterName } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: false, message: 'Nenhum evento para gravar.' }, { status: 400, headers: corsHeaders });
    }

    const client = await pool.connect();
    try {
      const values = [];
      const placeholders = [];
      let idx = 1;

      for (const ev of events) {
        placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4})`);
        const cleanObj = sanitizeForPostgresJson(ev.payload || ev);
        const cleanJsonStr = JSON.stringify(cleanObj).replace(/\\u0000/g, '');

        values.push(
          userId || null,
          username || ev.username || 'Hunter',
          characterName || ev.characterName || 'Hunter',
          ev.type || 'UNKNOWN_EVENT',
          cleanJsonStr
        );
        idx += 5;
      }

      const query = `
        INSERT INTO stonegy_events (user_id, username, character_name, event_type, payload)
        VALUES ${placeholders.join(', ')}
        RETURNING id;
      `;

      const insertRes = await client.query(query, values);
      return NextResponse.json({
        success: true,
        insertedCount: insertRes.rowCount,
        message: `${insertRes.rowCount} eventos gravados no PostgreSQL!`
      }, { headers: corsHeaders });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erro na gravação de eventos:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: corsHeaders });
  }
}
