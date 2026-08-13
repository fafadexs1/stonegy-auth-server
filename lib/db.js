const { Pool } = require('pg');
const crypto = require('crypto');

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable';
const SALT = process.env.SALT || '_stonegy_salt_2026';

let pool;

if (!global.__stonegyPgPool) {
  global.__stonegyPgPool = new Pool({
    connectionString: DB_URL,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}
pool = global.__stonegyPgPool;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

let isMigrated = false;

async function ensureDbSchema() {
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
          role VARCHAR(20) DEFAULT 'USER',
          is_admin BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days'),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login TIMESTAMP WITH TIME ZONE
        );
      `);

      // Garantir colunas role e is_admin
      await client.query(`
        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE stonegy_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'USER';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE stonegy_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END $$;
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

      // 5. Tabela de Configurações
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_settings (
          key VARCHAR(50) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Seed Admin
      const passHash = hashPassword('123456');
      await client.query(`
        INSERT INTO stonegy_users (username, password_hash, plan, role, is_admin, is_active, expires_at)
        VALUES ('fabricio', $1, 'SUPERADMIN', 'ADMIN', TRUE, TRUE, NOW() + INTERVAL '3650 days')
        ON CONFLICT (username) DO UPDATE SET 
          password_hash = $1, 
          role = 'ADMIN', 
          is_admin = TRUE, 
          is_active = TRUE;
      `, [passHash]);

      // Seed Settings
      await client.query(`
        INSERT INTO stonegy_settings (key, value) VALUES
        ('maintenance_mode', 'false'),
        ('allow_public_register', 'true'),
        ('discord_webhook', ''),
        ('admin_invite_code', 'CACADEXO_SODEXO_FILADAPUTA')
        ON CONFLICT (key) DO NOTHING;
      `);

      isMigrated = true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("⚠️ Erro na migração do PostgreSQL:", err.message);
  }
}

module.exports = pool;
module.exports.ensureDbSchema = ensureDbSchema;
module.exports.hashPassword = hashPassword;
module.exports.generateToken = generateToken;
module.exports.default = pool;
