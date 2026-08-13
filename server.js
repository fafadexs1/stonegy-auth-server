/**
 * Stonegy Pro Tracker - Auth Server, Leaderboard & Updates Hub
 * - Auth API: https://authtibia.klyraai.com.br
 * - Website & Updates: https://tibiaonline.dialogy.klyraai.com.br
 * - Target Game: https://stonegy-online.com
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const PORT = process.env.PORT || 3333;
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable';
const SALT = process.env.SALT || '_stonegy_salt_2026';
const AUTH_URL = process.env.AUTH_URL || 'https://authtibia.klyraai.com.br';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://tibiaonline.dialogy.klyraai.com.br';
const TARGET_GAME_URL = process.env.TARGET_GAME_URL || 'https://stonegy-online.com';

const PUBLIC_DIR = path.join(__dirname, 'public');

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

// Auto-Migração do Schema no PostgreSQL
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

    // 4. Tabela de Atualizações da Extensão
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

    // Seed Usuário Admin Fabricio
    const passHash = hashPassword('123456');
    await client.query(`
      INSERT INTO stonegy_users (username, password_hash, plan, is_active, expires_at)
      VALUES ('fabricio', $1, 'VIP PRO', TRUE, NOW() + INTERVAL '365 days')
      ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = TRUE;
    `, [passHash]);

    // Seed Versão Inicial da Extensão
    await client.query(`
      INSERT INTO stonegy_releases (version, title, changelog, download_url, force_update)
      VALUES (
        '3.4.0',
        'Lançamento Oficial Stonegy Pro Tracker',
        '• Integração total com authtibia.klyraai.com.br e PostgreSQL.\n• Portal oficial de updates em tibiaonline.dialogy.klyraai.com.br.\n• Sintetizador de som WebAudio para monstros raros e level up.\n• Gráfico de ondas de DPS dinâmico e balanço de hunt.',
        '/download/latest',
        FALSE
      )
      ON CONFLICT (version) DO NOTHING;
    `);

    console.log("✅ Schema do PostgreSQL verificado com sucesso!");
  } catch (err) {
    console.error("⚠️ Aviso: Não foi possível conectar ao PostgreSQL durante o startup:", err.message);
  } finally {
    if (client) await client.end();
  }
}

// Servidor HTTP Principal
const server = http.createServer(async (req, res) => {
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

  const serveFile = (filePath, contentType = 'text/html') => {
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      sendJson(404, { error: 'Arquivo não encontrado' });
    }
  };

  try {
    // 1. PÁGINA INICIAL DO WEBSITE (HUB DE UPDATES)
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/updates')) {
      return serveFile(path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    }

    // 2. PAINEL ADMIN PARA PUBLICAR ATUALIZAÇÕES
    if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin.html')) {
      return serveFile(path.join(PUBLIC_DIR, 'admin.html'), 'text/html; charset=utf-8');
    }

    // 3. DOWNLOAD DO PACOTE MAIS RECENTE DA EXTENSÃO (.ZIP)
    if (req.method === 'GET' && url.pathname === '/download/latest') {
      const zipPath = path.join(__dirname, 'StonegyStats_PROTECTED.zip');
      const rootZipPath = path.join(__dirname, '..', 'StonegyStats_PROTECTED.zip');
      const finalZip = fs.existsSync(zipPath) ? zipPath : (fs.existsSync(rootZipPath) ? rootZipPath : null);

      if (finalZip) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="StonegyStats_PROTECTED.zip"'
        });
        return fs.createReadStream(finalZip).pipe(res);
      } else {
        return sendJson(404, { success: false, message: 'Pacote ZIP ainda não compilado no servidor.' });
      }
    }

    // 4. API DE VERIFICAÇÃO DE ATUALIZAÇÃO (USADO PELA EXTENSÃO)
    if (req.method === 'GET' && url.pathname === '/api/version/check') {
      let client;
      try {
        client = await getDbClient();
        const verRes = await client.query(`
          SELECT version, title, changelog, download_url, force_update, created_at
          FROM stonegy_releases
          WHERE is_active = TRUE
          ORDER BY id DESC
          LIMIT 1;
        `);
        await client.end();

        if (verRes.rows.length > 0) {
          const rel = verRes.rows[0];
          const dlUrl = rel.download_url.startsWith('http') ? rel.download_url : `${WEBSITE_URL}${rel.download_url}`;
          return sendJson(200, {
            success: true,
            latestVersion: rel.version,
            title: rel.title,
            changelog: rel.changelog,
            downloadUrl: dlUrl,
            websiteUrl: WEBSITE_URL,
            forceUpdate: rel.force_update,
            releaseDate: rel.created_at
          });
        }

        return sendJson(200, { success: true, latestVersion: '3.4.0', websiteUrl: WEBSITE_URL, downloadUrl: `${WEBSITE_URL}/download/latest` });
      } catch (e) {
        return sendJson(200, { success: true, latestVersion: '3.4.0', websiteUrl: WEBSITE_URL });
      }
    }

    // 5. API DE HISTÓRICO DE ATUALIZAÇÕES (USADO PELO WEBSITE)
    if (req.method === 'GET' && url.pathname === '/api/version/history') {
      let client;
      try {
        client = await getDbClient();
        const resList = await client.query(`
          SELECT version, title, changelog, download_url, force_update, created_at
          FROM stonegy_releases
          WHERE is_active = TRUE
          ORDER BY id DESC;
        `);
        await client.end();
        return sendJson(200, { success: true, releases: resList.rows });
      } catch (e) {
        return sendJson(500, { success: false, error: e.message });
      }
    }

    // 6. API ADMIN PARA PUBLICAR NOVA VERSÃO
    if (req.method === 'POST' && url.pathname === '/api/version/publish') {
      const { adminPass, version, title, changelog, downloadUrl, forceUpdate } = await readBody();
      
      // Validação do Admin
      if (adminPass !== '123456' && adminPass !== process.env.ADMIN_KEY) {
        return sendJson(403, { success: false, message: 'Senha de administrador incorreta.' });
      }

      if (!version || !title || !changelog) {
        return sendJson(400, { success: false, message: 'Versão, título e changelog são obrigatórios.' });
      }

      let client;
      try {
        client = await getDbClient();
        await client.query(`
          INSERT INTO stonegy_releases (version, title, changelog, download_url, force_update)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (version) DO UPDATE SET
            title = $2, changelog = $3, download_url = $4, force_update = $5, created_at = NOW();
        `, [version, title, changelog, downloadUrl || '/download/latest', !!forceUpdate]);

        await client.end();
        console.log(`📢 [ADMIN] Nova versão ${version} publicada no PostgreSQL!`);
        return sendJson(200, { success: true, message: `Versão ${version} publicada com sucesso!` });
      } catch (e) {
        return sendJson(500, { success: false, message: `Erro no banco: ${e.message}` });
      }
    }

    // 7. HEALTH CHECK (/api/health)
    if (req.method === 'GET' && url.pathname === '/api/health') {
      try {
        const client = await getDbClient();
        const dbRes = await client.query('SELECT NOW() as db_time, current_database() as db_name;');
        await client.end();
        return sendJson(200, {
          success: true,
          status: 'online',
          authUrl: AUTH_URL,
          websiteUrl: WEBSITE_URL,
          gameUrl: TARGET_GAME_URL,
          dbName: dbRes.rows[0].db_name,
          dbTime: dbRes.rows[0].db_time
        });
      } catch (dbErr) {
        return sendJson(503, { success: false, status: 'offline', error: dbErr.message });
      }
    }

    // 8. ROTA DE LOGIN (/api/login)
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { username, password } = await readBody();
      if (!username || !password) return sendJson(400, { success: false, message: 'Usuário e senha são obrigatórios.' });

      let client;
      try { client = await getDbClient(); }
      catch (dbErr) { return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: `PostgreSQL inacessível: ${dbErr.message}` }); }

      try {
        const passHash = hashPassword(password);
        const userRes = await client.query(
          'SELECT id, username, plan, is_active, expires_at FROM stonegy_users WHERE LOWER(username) = LOWER($1) AND password_hash = $2;',
          [username.trim(), passHash]
        );

        if (userRes.rows.length === 0) return sendJson(401, { success: false, message: 'Usuário ou senha incorretos no PostgreSQL.' });

        const user = userRes.rows[0];
        if (!user.is_active) return sendJson(403, { success: false, message: 'Conta desativada pelo administrador.' });
        if (user.expires_at && new Date(user.expires_at) < new Date()) return sendJson(403, { success: false, message: 'Sua assinatura VIP expirou no banco de dados.' });

        const token = generateToken();
        await client.query('INSERT INTO stonegy_sessions (user_id, token) VALUES ($1, $2);', [user.id, token]);
        await client.query('UPDATE stonegy_users SET last_login = NOW() WHERE id = $1;', [user.id]);

        return sendJson(200, {
          success: true,
          token,
          user: { id: user.id, username: user.username, plan: user.plan || 'VIP PRO', expires_at: user.expires_at }
        });
      } finally { await client.end(); }
    }

    // 9. ROTA DE VERIFICAÇÃO DE SESSÃO (/api/verify)
    if (req.method === 'POST' && url.pathname === '/api/verify') {
      const { token } = await readBody();
      if (!token) return sendJson(401, { success: false, message: 'Token não fornecido.' });

      let client;
      try { client = await getDbClient(); }
      catch (dbErr) { return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' }); }

      try {
        const resCheck = await client.query(`
          SELECT u.id, u.username, u.plan, u.is_active, u.expires_at
          FROM stonegy_sessions s
          JOIN stonegy_users u ON s.user_id = u.id
          WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE;
        `, [token]);

        if (resCheck.rows.length === 0) return sendJson(401, { success: false, message: 'Sessão inválida ou expirada no banco.' });

        return sendJson(200, { success: true, user: resCheck.rows[0] });
      } finally { await client.end(); }
    }

    // 10. ROTA DE REGISTRO (/api/register)
    if (req.method === 'POST' && url.pathname === '/api/register') {
      const { username, password } = await readBody();
      if (!username || !password || username.length < 3 || password.length < 4) {
        return sendJson(400, { success: false, message: 'Usuário (mín 3 letras) e Senha (mín 4 letras) obrigatórios.' });
      }

      let client;
      try { client = await getDbClient(); }
      catch (dbErr) { return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: `PostgreSQL inacessível: ${dbErr.message}` }); }

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
        if (err.code === '23505') return sendJson(409, { success: false, message: 'Este nome de usuário já existe no PostgreSQL.' });
        throw err;
      } finally { await client.end(); }
    }

    // 11. GRAVAR HUNT (/api/hunt/record)
    if (req.method === 'POST' && url.pathname === '/api/hunt/record') {
      const body = await readBody();
      let client;
      try { client = await getDbClient(); }
      catch (dbErr) { return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' }); }

      try {
        await client.query(`
          INSERT INTO stonegy_hunts 
          (user_id, username, character_name, character_level, duration_sec, total_damage, dps_avg, max_hit, xp_gained, xp_hour, total_kills, kills_hour, loot_total, supplies_waste, balance_profit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
        `, [
          body.userId || null, body.username || 'Hunter', body.characterName || 'Hunter', body.level || 1,
          body.durationSec || 0, body.totalDamage || 0, body.dpsAvg || 0, body.maxHit || 0,
          body.xpGained || 0, body.xpHour || 0, body.totalKills || 0, body.killsHour || 0,
          body.lootTotal || 0, body.suppliesWaste || 0, body.balanceProfit || 0
        ]);
        return sendJson(200, { success: true, message: 'Hunt gravada no PostgreSQL com sucesso!' });
      } finally { await client.end(); }
    }

    // 12. LEADERBOARD (/api/hunt/leaderboard)
    if (req.method === 'GET' && url.pathname === '/api/hunt/leaderboard') {
      let client;
      try { client = await getDbClient(); }
      catch (dbErr) { return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' }); }

      try {
        const topXp = await client.query(`
          SELECT username, character_name, character_level, xp_hour, total_damage, dps_avg, total_kills, balance_profit, recorded_at
          FROM stonegy_hunts
          ORDER BY xp_hour DESC
          LIMIT 10;
        `);
        return sendJson(200, { success: true, topXp: topXp.rows });
      } finally { await client.end(); }
    }

    sendJson(404, { success: false, message: 'Endpoint não encontrado.' });
  } catch (err) {
    console.error("API Server Error:", err);
    sendJson(500, { success: false, message: `Erro interno no servidor: ${err.message}` });
  }
});

server.listen(PORT, async () => {
  console.log(`🚀 Stonegy Server online na porta ${PORT}`);
  console.log(`🌐 Auth API URL: ${AUTH_URL}`);
  console.log(`🌐 Website URL:  ${WEBSITE_URL}`);
  console.log(`🎮 Game Site:    ${TARGET_GAME_URL}`);
  await initDatabaseSchema();
});
