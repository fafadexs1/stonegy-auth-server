import { NextResponse } from 'next/server';
import pool, { ensureDbSchema } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  try {
    await ensureDbSchema();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const eventType = searchParams.get('type');
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));

    const client = await pool.connect();
    try {
      let query = 'SELECT id, username, character_name, event_type, payload, created_at FROM stonegy_events WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (username) {
        query += ` AND LOWER(username) = LOWER($${pIdx++})`;
        params.push(username);
      }
      if (eventType) {
        query += ` AND event_type = $${pIdx++}`;
        params.push(eventType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
      params.push(limit);

      const result = await client.query(query, params);
      return NextResponse.json({
        success: true,
        count: result.rowCount,
        events: result.rows
      }, { headers: corsHeaders });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erro na consulta de eventos:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: corsHeaders });
  }
}
