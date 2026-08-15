/**
 * Stonegy Stats - Servidor de Autenticação e API de Leaderboard / Hunts
 * Conexão direta e transparente com PostgreSQL
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { startPeriodicSync, runFullSync } = require('./sync_engine');
const { recommendBestInSlot, findBagUpgrades, calculateItemScore } = require('./gear_optimizer');
const { calculateSurvivalPolicy, getOptimalSpellRotation, VOCATION_SPELLS } = require('./vocation_combat_brain');
const { recommendCharmsForMonster, analyzeHuntBestiary } = require('./charm_bestiary_optimizer');

const PORT = process.env.PORT || 2020;
const DB_URL = 'postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable';

// Carrega catálogo em memória para respostas instantâneas
let LOCAL_HUNTS_CATALOG = [];
try {
  LOCAL_HUNTS_CATALOG = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'full_game_hunts_catalog.json'), 'utf8'));
} catch (e) {
  LOCAL_HUNTS_CATALOG = [];
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_stonegy_salt_2026').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getDbClient() {
  const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 4000 });
  await client.connect();
  return client;
}

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

  try {
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
          dbPort: 4264,
          message: 'PostgreSQL conectado e ativo!'
        });
      } catch (dbErr) {
        return sendJson(503, {
          success: false,
          status: 'offline',
          error: dbErr.message,
          message: 'Banco de dados PostgreSQL está offline ou inacessível na porta 4264.'
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
          return sendJson(403, { success: false, message: 'Conta desativada pelo administrador no banco.' });
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

    // 6. ROTA DE HUNT ADVISOR / MELHORES HUNTS (/api/hunts/advisor)
    if (req.method === 'GET' && url.pathname === '/api/hunts/advisor') {
      const levelParam = parseInt(url.searchParams.get('level') || '1', 10);
      const sortParam = url.searchParams.get('sort') || 'xp'; // 'xp' | 'profit' | 'level'
      const filterParam = url.searchParams.get('filter') || 'all'; // 'all' | 'level_fit'
      const goalParam = url.searchParams.get('goal') || 'balanced'; // 'money' | 'xp' | 'balanced'

      let hunts = LOCAL_HUNTS_CATALOG;

      // Tenta buscar do PostgreSQL se a tabela existir
      try {
        const client = await getDbClient();
        const dbRes = await client.query(`
          SELECT id, title, recommended_level as "recommendedLevel", level_min as "levelMin", 
                 max_lure as "maxLure", min_lure as "minLure", is_premium as "isPremmium", 
                 map_id as "mapId", monsters_json as "monsterDetails", xp_hour_est as "xpHourEst", 
                 profit_hour_est as "profitHourEst", tier 
          FROM stonegy_hunts_catalog 
          ORDER BY recommended_level ASC;
        `);
        await client.end();
        if (dbRes.rows && dbRes.rows.length > 0) {
          hunts = dbRes.rows.map(r => ({
            ...r,
            monsters: Array.isArray(r.monsterDetails) ? r.monsterDetails.map(m => m.name || m) : []
          }));
          LOCAL_HUNTS_CATALOG = hunts;
        }
      } catch (e) {
        // Fallback em memória já pronto com todas as 129 hunts
      }

      // Encontra a melhor masmorra recomendada para o nível atual do jogador de acordo com a meta
      const eligibleForLevel = hunts.filter(d => levelParam >= (d.levelMin || 1) && levelParam <= ((d.recommendedLevel || 1) + 20));
      let bestForUser = hunts[0];
      if (eligibleForLevel.length > 0) {
        if (goalParam === 'money') {
          bestForUser = [...eligibleForLevel].sort((a, b) => b.profitHourEst - a.profitHourEst)[0];
        } else if (goalParam === 'xp') {
          bestForUser = [...eligibleForLevel].sort((a, b) => b.xpHourEst - a.xpHourEst)[0];
        } else {
          // Balanceado: pontuação composta
          bestForUser = [...eligibleForLevel].sort((a, b) => (b.xpHourEst + b.profitHourEst * 2) - (a.xpHourEst + a.profitHourEst * 2))[0];
        }
      }

      let list = [...hunts];
      if (filterParam === 'level_fit') {
        list = list.filter(d => levelParam >= (d.levelMin || 1));
      }

      if (sortParam === 'xp') {
        list.sort((a, b) => b.xpHourEst - a.xpHourEst);
      } else if (sortParam === 'profit') {
        list.sort((a, b) => b.profitHourEst - a.profitHourEst);
      } else if (sortParam === 'level') {
        list.sort((a, b) => a.recommendedLevel - b.recommendedLevel);
      }

      return sendJson(200, {
        success: true,
        userLevel: levelParam,
        goal: goalParam,
        bestRecommended: bestForUser || hunts[0],
        totalHunts: hunts.length,
        hunts: list
      });
    }

    // 6.1 ROTA DE CATÁLOGO COMPLETO DE ITENS (/api/catalog/items)
    if (req.method === 'GET' && url.pathname === '/api/catalog/items') {
      try {
        const client = await getDbClient();
        const resDb = await client.query('SELECT id, name, npc_sell_price as "npcSellPrice", image, weight, stackable FROM stonegy_items_catalog ORDER BY id ASC;');
        await client.end();
        return sendJson(200, { success: true, count: resDb.rows.length, items: resDb.rows });
      } catch (e) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'item_prices.json'), 'utf8'));
          return sendJson(200, { success: true, count: Object.keys(raw).length, items: raw });
        } catch (err2) {
          return sendJson(500, { success: false, message: e.message });
        }
      }
    }

    // 6.2 ROTA DE CATÁLOGO COMPLETO DE MONSTROS (/api/catalog/monsters)
    if (req.method === 'GET' && url.pathname === '/api/catalog/monsters') {
      try {
        const client = await getDbClient();
        const resDb = await client.query('SELECT id, name, hp, xp, image, bestiary_race as "bestiaryRace", bestiary_difficulty as "bestiaryDifficulty", elemental_resistances as "elementalResistances", loot_json as "loot", avg_gold as "avgGold" FROM stonegy_monsters_catalog ORDER BY id ASC;');
        await client.end();
        return sendJson(200, { success: true, count: resDb.rows.length, monsters: resDb.rows });
      } catch (e) {
        return sendJson(500, { success: false, message: e.message });
      }
    }

    // 6.3 ROTA MANUAL DE SYNC DO CATÁLOGO (/api/catalog/sync)
    if (req.method === 'POST' && url.pathname === '/api/catalog/sync') {
      try {
        const syncResult = await runFullSync(DB_URL);
        return sendJson(200, syncResult);
      } catch (e) {
        return sendJson(500, { success: false, message: e.message });
      }
    }

    // 6.4 ROTA DE RECOMENDAÇÃO BEST-IN-SLOT (/api/gear/recommendations)
    if (req.method === 'GET' && url.pathname === '/api/gear/recommendations') {
      const vocation = url.searchParams.get('vocation') || 'KNIGHT';
      const level = parseInt(url.searchParams.get('level') || '1', 10);
      const budget = parseInt(url.searchParams.get('budget') || '999999999', 10);
      const recommendations = recommendBestInSlot(vocation, level, budget);
      return sendJson(200, { success: true, vocation, level, budget, recommendations });
    }

    // 6.5 ROTA DE COMPARAÇÃO DE GEAR COM INVENTÁRIO (/api/gear/compare)
    if (req.method === 'POST' && url.pathname === '/api/gear/compare') {
      const body = await readBody();
      const { equippedGear, bagItems, vocation, level } = body;
      const upgrades = findBagUpgrades(equippedGear || {}, bagItems || [], vocation || 'KNIGHT', level || 1);
      return sendJson(200, { success: true, upgradesCount: upgrades.length, upgrades });
    }

    // 6.6 ROTA DE ROTAÇÃO E INTELIGÊNCIA DE COMBATE (/api/combat/rotation)
    if (req.method === 'GET' && url.pathname === '/api/combat/rotation') {
      const vocation = url.searchParams.get('vocation') || 'KNIGHT';
      const level = parseInt(url.searchParams.get('level') || '1', 10);
      const monstersCount = parseInt(url.searchParams.get('monsters') || '1', 10);
      const rotation = getOptimalSpellRotation(vocation, level, monstersCount);
      const policy = calculateSurvivalPolicy({ vocation, hpPct: 1, manaPct: 1 }, []);
      return sendJson(200, { success: true, rotation, survivalPolicy: policy });
    }

    // 6.7 ROTA DE RADAR DE BESTIÁRIO E CHARMS POR HUNT (/api/bestiary/hunt-charms)
    if (req.method === 'GET' && url.pathname === '/api/bestiary/hunt-charms') {
      const huntId = parseInt(url.searchParams.get('huntId') || '1', 10);
      const hunt = LOCAL_HUNTS_CATALOG.find(h => h.id === huntId) || LOCAL_HUNTS_CATALOG[0];
      const bestiary = analyzeHuntBestiary(hunt);
      return sendJson(200, { success: true, bestiary });
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

    // 7. ROTA DE INGESTÃO DE EVENTOS / TELEMETRIA EM LOTE (/api/events/batch)
    if (req.method === 'POST' && url.pathname === '/api/events/batch') {
      const body = await readBody();
      const { events, userId, username, characterName } = body;

      if (!Array.isArray(events) || events.length === 0) {
        return sendJson(400, { success: false, message: 'Lista de eventos vazia.' });
      }

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

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
        return sendJson(200, {
          success: true,
          insertedCount: insertRes.rowCount,
          message: `${insertRes.rowCount} eventos gravados no PostgreSQL com sucesso!`
        });
      } finally {
        await client.end();
      }
    }

    // 8. ROTA DE CONSULTA DE HISTÓRICO DE EVENTOS (/api/events/history)
    if (req.method === 'GET' && url.pathname === '/api/events/history') {
      const usernameParam = url.searchParams.get('username');
      const eventTypeParam = url.searchParams.get('type');
      const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

      try {
        let query = 'SELECT id, username, character_name, event_type, payload, created_at FROM stonegy_events WHERE 1=1';
        const params = [];
        let pIdx = 1;

        if (usernameParam) {
          query += ` AND LOWER(username) = LOWER($${pIdx++})`;
          params.push(usernameParam);
        }
        if (eventTypeParam) {
          query += ` AND event_type = $${pIdx++}`;
          params.push(eventTypeParam);
        }

        query += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
        params.push(limit);

        const result = await client.query(query, params);
        return sendJson(200, { success: true, count: result.rowCount, events: result.rows });
      } finally {
        await client.end();
      }
    }

    // 10. ROTA DE TELEMETRIA DE IA (STATE-ACTION PAIRS & TRAJETÓRIAS)
    if (req.method === 'POST' && url.pathname === '/api/ai/telemetry') {
      const body = await readBody();
      const { sessionId, username, characterName, stateActions, trajectories, biometricSamples } = body;

      let client;
      try {
        client = await getDbClient();
      } catch (dbErr) {
        return sendJson(503, { success: false, errorType: 'DB_OFFLINE', message: 'PostgreSQL offline.' });
      }

      try {
        // 1. Grava pares Estado-Ação
        if (Array.isArray(stateActions) && stateActions.length > 0) {
          const values = [];
          const placeholders = [];
          let idx = 1;
          for (const sa of stateActions) {
            placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6})`);
            values.push(
              sessionId || 'session_default',
              username || 'Hunter',
              characterName || 'Hunter',
              sa.actionType || 'UNKNOWN',
              JSON.stringify(sanitizeForPostgresJson(sa.actionPayload || {})).replace(/\\u0000/g, ''),
              JSON.stringify(sanitizeForPostgresJson(sa.stateSnapshot || {})).replace(/\\u0000/g, ''),
              sa.reactionMs || 0
            );
            idx += 7;
          }
          await client.query(`
            INSERT INTO stonegy_ai_state_actions (session_id, username, character_name, action_type, action_payload, state_snapshot, reaction_ms)
            VALUES ${placeholders.join(', ')}
          `, values);
        }

        // 2. Grava trajetórias de exploração / mapa
        if (Array.isArray(trajectories) && trajectories.length > 0) {
          for (const tr of trajectories) {
            await client.query(`
              INSERT INTO stonegy_ai_trajectories (session_id, username, map_phase, lure_id, path_nodes, duration_sec, monsters_encountered)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              sessionId || 'session_default',
              username || 'Hunter',
              tr.mapPhase || 'unknown',
              tr.lureId || 0,
              JSON.stringify(sanitizeForPostgresJson(tr.pathNodes || [])).replace(/\\u0000/g, ''),
              tr.durationSec || 0,
              tr.monstersCount || 0
            ]);
          }
        }

        // 3. Grava biometria humana (tempo entre cliques/teclas)
        if (Array.isArray(biometricSamples) && biometricSamples.length > 0) {
          for (const b of biometricSamples) {
            await client.query(`
              INSERT INTO stonegy_human_biometrics (username, action_category, interval_ms, jitter_ms, key_code)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              username || 'Hunter',
              b.category || 'KEY',
              b.intervalMs || 0,
              b.jitterMs || 0,
              b.keyCode || ''
            ]);
          }
        }

        return sendJson(200, {
          success: true,
          message: 'Dataset de IA gravado com sucesso no PostgreSQL!'
        });
      } finally {
        await client.end();
      }
    }

    // 9. ROTA DE VERIFICAÇÃO DE VERSÃO (/api/version/check)
    if (req.method === 'GET' && url.pathname === '/api/version/check') {
      return sendJson(200, {
        success: true,
        latestVersion: '3.5.0',
        minSupportedVersion: '3.0.0',
        forceUpdate: false,
        title: 'Stonegy Pro v3.5.0',
        changelog: 'Suporte a telemetria completa no PostgreSQL, Training Analyser dinâmico e persistência offline.',
        downloadUrl: 'http://localhost:2020/StonegyStats_PROTECTED.zip'
      });
    }

    sendJson(404, { success: false, message: 'Endpoint não encontrado.' });
  } catch (err) {
    console.error("API Server Error:", err);
    sendJson(500, { success: false, message: `Erro interno no servidor: ${err.message}` });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Stonegy Server rodando em http://localhost:${PORT} conectado ao PostgreSQL na porta 4264`);
  // Inicia o sincronizador periódico a cada 5 horas para manter PostgreSQL sempre atualizado
  startPeriodicSync(DB_URL, 5);
});

