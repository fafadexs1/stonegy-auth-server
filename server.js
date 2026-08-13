/**
 * Stonegy Auth & Leaderboard Server (Produção para Easypanel / VPS)
 * Domínio de Destino: authtibia.klyraai.com.br
 */

const http = require('http');
const crypto = require('crypto');
const { Client } = require('pg');

const PORT = process.env.PORT || 3333;
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable';
const SALT = process.env.SALT || '_stonegy_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getDbClient() {
  const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  return client;
}

// Inicialização e Auto-Migração do Schema no PostgreSQL
async function initDatabaseSchema() {
  console.log("🔍 Verificando e inicializando schema no PostgreSQL...");
  let client;
  try {
    client = await getDbClient();

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

    // 3. Tabela de Hunts / Leaderboard
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

    // 4. Seed do usuário padrão se não existir
    const passHash = hashPassword('123456');
    await client.query(`
      INSERT INTO stonegy_users (username, password_hash, plan, is_active, expires_at)
      VALUES ('fabricio', $1, 'VIP PRO', TRUE, NOW() + INTERVAL '365 days')
      ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = TRUE;
    `, [passHash]);

    console.log("✅ Schema do PostgreSQL verificado com sucesso! Usuário 'fabricio' ativo.");
  } catch (err) {
    console.error("⚠️ Aviso: Não foi possível conectar ao PostgreSQL durante o startup:", err.message);
  } finally {
    if (client) await client.end();
  }
}

// Criação do Servidor HTTP
const server = http.createServer(async (req, res) => {
  // CORS universal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  const readBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    // 0. STATUS RAIZ
    if (req.method === 'GET' && url.pathname === '/') {
      return sendJson(200, {
        status: 'online',
        service: 'Stonegy Auth & Leaderboard API',
        domain: 'authtibia.klyraai.com.br',
        version: '1.0.0'
      });
    }

    // 1. HEALTH CHECK REAL-TIME DO POSTGRESQL (/api/health)
    if (req.method === 'GET' && url.pathname === '/api/health') {
      try {
        const client = await getDbClient();
        const dbRes = await client.query('SELECT NOW() as db_time, current_database() as db_name;');
        await client.end();
        return sendJson(200, {
          success: true,
          status: 'online',
          dbName: dbRes.rows[0].db_name,
          dbTime: dbRes.rows[0].db_time,
          message: 'PostgreSQL conectado e ativo!'
        });
      } catch (dbErr) {
        return sendJson(503, {
          success: false,
          status: 'offline',
          error: dbErr.message,
          message: 'Banco de dados PostgreSQL está offline ou inacessível.'
        });
      }
    }

    // 2. ROTA DE LOGIN REAL NO POSTGRESQL (/api/login)
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { username, password } = await readBody();
      if (!username || !password) {
        return sendJson(400, { success: false, message: 'Usuário e senha são obrigatórios.' });
      }

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, {
          success: false,
          errorType: 'DB_OFFLINE',
          message: `Falha de conexão com o PostgreSQL: ${dbErr.message}`
        });
      }

      try {
        const passHash = hashPassword(password);
        const userRes = await client.query(
          'SELECT id, username, plan, is_active, expires_at FROM stonegy_users WHERE LOWER(username) = LOWER($1) AND password_hash = $2;',
          [username.trim(), passHash]
        );

        if (userRes.rows.length === 0) {
          return sendJson(401, { success: false, message: 'Usuário ou senha incorretos no PostgreSQL.' });
        }

        const user = userRes.rows[0];
        if (!user.is_active) {
          return sendJson(403, { success: false, message: 'Conta desativada pelo administrador.' });
        }

        if (user.expires_at && new Date(user.expires_at) < new Date()) {
          return sendJson(403, { success: false, message: 'Sua assinatura VIP expirou no banco de dados.' });
        }

        const token = generateToken();
        await client.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);
        await client.query('UPDATE stonegy_users SET last_login = NOW() WHERE id = $1;', [user.id]);

        return sendJson(200, {
          success: true,
          token,
          user: { id: user.id, username: user.username, plan: user.plan || 'VIP PRO', expires_at: user.expires_at }
        });
      } finally {
        await client.end();
      }
    }

    // 3. ROTA DE VERIFICAÇÃO DE SESSÃO (/api/verify)
    if (req.method === 'POST' && url.pathname === '/api/verify') {
      const { token } = await readBody();
      if (!token) return sendJson(401, { success: false, message: 'Token não fornecido.' });

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

      try {
        const resCheck = await client.query(`
          SELECT u.id, u.username, u.plan, u.is_active, u.expires_at
          FROM stonegy_sessions s
          JOIN stonegy_users u ON s.user_id = u.id
          WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE;
        `, [token]);

        if (resCheck.rows.length === 0) {
          return sendJson(401, { success: false, message: 'Sessão inválida ou expirada no banco.' });
        }

        return sendJson(200, { success: true, user: resCheck.rows[0] });
      } finally {
        await client.end();
      }
    }

    // 4. ROTA DE REGISTRO (/api/register)
    if (req.method === 'POST' && url.pathname === '/api/register') {
      const { username, password } = await readBody();
      if (!username || !password || username.length < 3 || password.length < 4) {
        return sendJson(400, { success: false, message: 'Usuário (mín 3 letras) e Senha (mín 4 letras) obrigatórios.' });
      }

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: `PostgreSQL inacessível: ${dbErr.message}` });
      }

      try {
        const passHash = hashPassword(password);
        const insertRes = await client.query(`
          INSERT INTO stonegy_users (username, password_hash, plan, is_active, expires_at)
          VALUES ($1, $2, 'VIP PRO', TRUE, NOW() + INTERVAL '30 days')
          RETURNING id, username, plan, expires_at;
        `, [username.trim(), passHash]);

        const user = insertRes.rows[0];
        const token = generateToken();
        await client.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);

        return sendJson(201, {
          success: true,
          token,
          user: { id: user.id, username: user.username, plan: user.plan, expires_at: user.expires_at }
        });
      } catch (err) {
        if (err.code === '23505') {
          return sendJson(409, { success: false, message: 'Este nome de usuário já existe no PostgreSQL.' });
        }
        throw err;
      } finally {
        await client.end();
      }
    }

    // 5. ROTA DE GRAVAR HUNT (/api/hunt/record)
    if (req.method === 'POST' && url.pathname === '/api/hunt/record') {
      const body = await readBody();
      const { userId, username, characterName, level, durationSec, totalDamage, dpsAvg, maxHit, xpGained, xpHour, totalKills, killsHour, lootTotal, suppliesWaste, balanceProfit } = body;

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

      try {
        await client.query(`
          INSERT INTO stonegy_hunts 
          (user_id, username, character_name, character_level, duration_sec, total_damage, dps_avg, max_hit, xp_gained, xp_hour, total_kills, kills_hour, loot_total, supplies_waste, balance_profit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
        `, [
          userId || null,
          username || 'Hunter',
          characterName || 'Hunter',
          level || 1,
          durationSec || 0,
          totalDamage || 0,
          dpsAvg || 0,
          maxHit || 0,
          xpGained || 0,
          xpHour || 0,
          totalKills || 0,
          killsHour || 0,
          lootTotal || 0,
          suppliesWaste || 0,
          balanceProfit || 0
        ]);

        return sendJson(200, { success: true, message: 'Hunt gravada no PostgreSQL com sucesso!' });
      } finally {
        await client.end();
      }
    }

    // 6. ROTA DE LEADERBOARD (/api/hunt/leaderboard)
    if (req.method === 'GET' && url.pathname === '/api/hunt/leaderboard') {
      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

      try {
        const topXp = await client.query(`
          SELECT username, character_name, character_level, xp_hour, total_damage, dps_avg, total_kills, balance_profit, recorded_at
          FROM stonegy_hunts
          ORDER BY xp_hour DESC
          LIMIT 10;
        `);

        return sendJson(200, {
          success: true,
          topXp: topXp.rows
        });
      } finally {
        await client.end();
      }
    }

    sendJson(404, { success: false, message: 'Endpoint não encontrado.' });
  } catch (err) {
    console.error("API Server Error:", err);
    sendJson(500, { success: false, message: `Erro interno no servidor: ${err.message}` });
  }
});

server.listen(PORT, async () => {
  console.log(`🚀 Stonegy Auth Server online na porta ${PORT}`);
  console.log(`🌐 Domínio configurado: authtibia.klyraai.com.br`);
  await initDatabaseSchema();
});
