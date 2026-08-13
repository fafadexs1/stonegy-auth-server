import { Pool } from 'pg';
import crypto from 'crypto';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable';
const SALT = process.env.SALT || '_stonegy_salt_2026';

let pool;

if (!global.__stonegyPgPool) {
  global.__stonegyPgPool = new Pool({
    connectionString: DB_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}
pool = global.__stonegyPgPool;

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

let isMigrated = false;

export async function ensureDbSchema() {
  if (isMigrated) return;
  try {
    const client = await pool.connect();
    try {
      // 1. Tabela de Usuários
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(128) NOT NULL,
          plan VARCHAR(20) DEFAULT 'VIP PRO',
          is_active BOOLEAN DEFAULT TRUE,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days'),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login TIMESTAMP WITH TIME ZONE
        );
      `);

      // 2. Tabela de Sessões
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_sessions (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES stonegy_users(id) ON DELETE CASCADE,
          token VARCHAR(128) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
        );
      `);

      // 3. Tabela de Hunts
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_hunts (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES stonegy_users(id) ON DELETE CASCADE,
          username VARCHAR(100) NOT NULL,
          character_name VARCHAR(100),
          character_level INT DEFAULT 1,
          duration_sec INT NOT NULL,
          total_damage BIGINT DEFAULT 0,
          dps_avg INT DEFAULT 0,
          max_hit INT DEFAULT 0,
          xp_gained BIGINT DEFAULT 0,
          xp_hour BIGINT DEFAULT 0,
          total_kills INT DEFAULT 0,
          kills_hour INT DEFAULT 0,
          loot_total BIGINT DEFAULT 0,
          supplies_waste BIGINT DEFAULT 0,
          balance_profit BIGINT DEFAULT 0,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // 4. Tabela de Releases
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_releases (
          id SERIAL PRIMARY KEY,
          version VARCHAR(20) UNIQUE NOT NULL,
          title VARCHAR(100) NOT NULL,
          changelog TEXT NOT NULL,
          download_url VARCHAR(255) DEFAULT '/download/latest',
          force_update BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Seed Usuário Admin
      const passHash = hashPassword('123456');
      await client.query(`
        INSERT INTO stonegy_users (username, password_hash, plan, is_active, expires_at)
        VALUES ('fabricio', $1, 'VIP PRO', TRUE, NOW() + INTERVAL '365 days')
        ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = TRUE;
      `, [passHash]);

      // Seed Release Inicial
      await client.query(`
        INSERT INTO stonegy_releases (version, title, changelog, download_url, force_update)
        VALUES (
          '3.4.0',
          'Lançamento Oficial Next.js Hub',
          '• Arquitetura completa em Next.js no domínio tibiaonline.dialogy.klyraai.com.br.\n• Autenticação e leaderboards em authtibia.klyraai.com.br.\n• Gráfico de DPS dinâmico e auto-updater para a extensão.',
          '/download/latest',
          FALSE
        )
        ON CONFLICT (version) DO NOTHING;
      `);

      isMigrated = true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("⚠️ Erro na migração do PostgreSQL:", err.message);
  }
}

export default pool;
