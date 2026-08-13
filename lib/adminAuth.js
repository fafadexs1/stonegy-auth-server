import pool, { ensureDbSchema } from './db';

export async function verifyAdminRequest(req) {
  await ensureDbSchema();
  try {
    let token = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    }

    if (!token) {
      try {
        const body = await req.clone().json();
        token = body.token;
      } catch (e) {}
    }

    if (!token) return null;

    const res = await pool.query(`
      SELECT u.id, u.username, u.plan, u.role, u.is_admin, u.is_active
      FROM stonegy_sessions s
      JOIN stonegy_users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE AND (u.is_admin = TRUE OR u.role = 'ADMIN');
    `, [token]);

    if (res.rows.length > 0) {
      return res.rows[0];
    }
    return null;
  } catch (err) {
    console.error("Admin verification error:", err);
    return null;
  }
}
