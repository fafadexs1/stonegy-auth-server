/**
 * Stonegy Auto-Sync Engine
 * Baixa periodicamente (a cada 5h) os datasets estáticos oficiais do Stonegy Online,
 * descompacta os arquivos binários .stonegy (STGYDAT1), faz o parsing das 129 hunts,
 * 410 monstros e 1.669 itens, e atualiza o PostgreSQL na nuvem em lote (Upsert).
 */

const zlib = require('zlib');
const { Client } = require('pg');

const STATIC_VERSION_URL = 'https://assets.stonegy-online.com/game-data/static/version.json';
const GAME_URL = 'https://stonegy-online.com';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return await res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function unpackStonegyBinary(buffer) {
  const payload = buffer.subarray(36);
  let decompressed;
  try {
    decompressed = zlib.inflateRawSync(payload);
  } catch (e1) {
    try {
      decompressed = zlib.gunzipSync(payload);
    } catch (e2) {
      decompressed = zlib.inflateSync(payload);
    }
  }
  return JSON.parse(decompressed.toString('utf8'));
}

async function extractHuntsFromAppChunk() {
  try {
    const html = await (await fetch(GAME_URL)).text();
    const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
    const buildId = buildIdMatch ? buildIdMatch[1] : null;

    let appChunkUrl = null;
    if (buildId) {
      const manifestUrl = `${GAME_URL}/_next/static/${buildId}/_buildManifest.js`;
      const manifestText = await (await fetch(manifestUrl)).text();
      const chunkMatches = [...manifestText.matchAll(/"(static\/chunks\/pages\/_app-[^"]+)"/g)];
      if (chunkMatches.length > 0) {
        appChunkUrl = `${GAME_URL}/_next/${chunkMatches[0][1]}`;
      }
    }

    if (!appChunkUrl) {
      const scriptMatches = [...html.matchAll(/src="(\/_next\/static\/chunks\/pages\/_app-[^"]+)"/g)];
      if (scriptMatches.length > 0) {
        appChunkUrl = `${GAME_URL}${scriptMatches[0][1]}`;
      }
    }

    if (!appChunkUrl) return [];

    const code = await (await fetch(appChunkUrl)).text();
    const sewersIdx = code.indexOf('title:"Sewers"');
    if (sewersIdx === -1) return [];

    const mapStart = code.lastIndexOf('new Map([', sewersIdx);
    let bracketCount = 0;
    let mapEnd = -1;
    for (let i = mapStart + 8; i < code.length; i++) {
      if (code[i] === '[') bracketCount++;
      else if (code[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          mapEnd = i;
          break;
        }
      }
    }

    const mapCode = code.substring(mapStart, mapEnd + 2);
    const fn = new Function('r', `return ${mapCode}`);
    const huntsMap = fn(1);
    return Array.from(huntsMap.values());
  } catch (err) {
    console.error('[Sync Engine] Erro ao extrair hunts do chunk do app:', err.message);
    return [];
  }
}

async function runFullSync(dbUrl) {
  console.log('[Sync Engine] ⏳ Iniciando verificação de versão e dados do Stonegy...');
  const startTime = Date.now();

  try {
    // 1. Obter versão e manifesto
    const versionData = await fetchJson(STATIC_VERSION_URL);
    const version = versionData.version || 'v1';
    const manifestUrl = new URL(versionData.manifest, STATIC_VERSION_URL).toString();
    const manifest = await fetchJson(manifestUrl);

    // 2. Baixar datasets binários
    const rawItemsData = await fetchBuffer(new URL(manifest.datasets.items.url, manifestUrl).toString());
    const rawMonstersData = await fetchBuffer(new URL(manifest.datasets.monsters.url, manifestUrl).toString());

    const itemsList = unpackStonegyBinary(rawItemsData);
    const monstersList = unpackStonegyBinary(rawMonstersData);
    const huntsList = await extractHuntsFromAppChunk();

    const rawMonsters = monstersList.map(e => Array.isArray(e) ? e[1] : e).filter(Boolean);
    const rawItems = itemsList.map(e => Array.isArray(e) ? e[1] : e).filter(Boolean);

    const monsterMap = new Map(rawMonsters.map(m => [m.id, m]));
    const itemMap = new Map(rawItems.map(i => [i.id, i]));

    // 3. Enriquecer catálogo de hunts
    const enrichedHunts = huntsList.map(hunt => {
      const huntMonsters = (hunt.monsters || []).map(mId => {
        const m = monsterMap.get(mId);
        if (!m) return { id: mId, name: `Monster #${mId}` };

        const lootList = (m.loot || []).map(l => {
          const it = itemMap.get(l.itemId);
          return {
            itemId: l.itemId,
            name: it ? it.name : `Item #${l.itemId}`,
            chance: l.chance,
            maxCount: l.maxCount || 1,
            npcPrice: it?.npcSellPrice || 0,
            image: it?.image || ''
          };
        });

        let avgGold = 0;
        if (m.goldCoins && m.goldCoins.rolls) {
          m.goldCoins.rolls.forEach(r => {
            const avgCount = ((r.minCount || 1) + (r.maxCount || 1)) / 2;
            avgGold += (r.chance / 100) * avgCount * (r.coinValue || 1);
          });
        }

        let avgLootValue = 0;
        lootList.forEach(l => {
          avgLootValue += (l.chance / 100) * ((1 + l.maxCount) / 2) * l.npcPrice;
        });

        return {
          id: m.id,
          name: m.name,
          hp: m.hp || 0,
          xp: m.xp || 0,
          image: m.image,
          bestiaryRace: m.bestiaryRace,
          bestiaryDifficulty: m.bestiaryDifficulty,
          elementalResistances: m.elementalResistances || {},
          avgGoldPerKill: Math.round(avgGold),
          avgLootPerKill: Math.round(avgLootValue),
          loot: lootList
        };
      });

      let totalWeight = 0;
      let weightedXp = 0;
      let weightedProfit = 0;
      const monsterNames = [];

      huntMonsters.forEach(m => {
        monsterNames.push(m.name);
        const weight = (hunt.monsterWeights && hunt.monsterWeights[m.id]) || (100 / huntMonsters.length);
        totalWeight += weight;
        weightedXp += (m.xp || 0) * weight;
        weightedProfit += ((m.avgGoldPerKill || 0) + (m.avgLootPerKill || 0)) * weight;
      });

      const avgMonsterXp = totalWeight > 0 ? weightedXp / totalWeight : 0;
      const avgMonsterProfit = totalWeight > 0 ? weightedProfit / totalWeight : 0;
      const lureCount = Math.max(1, Math.round(((hunt.minLure || 1) + (hunt.maxLure || 2)) / 2));
      const estimatedKillsHour = Math.min(1800, Math.max(200, lureCount * 220));

      let tier = "Tier 1";
      const recLv = hunt.recommendedLevel || 1;
      if (recLv >= 600) tier = "Tier 10 (Endgame)";
      else if (recLv >= 400) tier = "Tier 9 (Endgame)";
      else if (recLv >= 300) tier = "Tier 8 (High End)";
      else if (recLv >= 200) tier = "Tier 7 (Master)";
      else if (recLv >= 130) tier = "Tier 6 (Expert)";
      else if (recLv >= 80) tier = "Tier 5 (Advanced)";
      else if (recLv >= 45) tier = "Tier 4 (Mid-High)";
      else if (recLv >= 25) tier = "Tier 3 (Mid)";
      else if (recLv >= 10) tier = "Tier 2 (Starter-Mid)";
      else tier = "Tier 1 (Starter)";

      return {
        id: hunt.id,
        title: hunt.title,
        levelMin: hunt.levelMin || 1,
        recommendedLevel: hunt.recommendedLevel || 1,
        maxLure: hunt.maxLure || 1,
        minLure: hunt.minLure || 1,
        isPremmium: !!hunt.isPremmium,
        mapId: hunt.mapId,
        monsters: monsterNames,
        monstersCount: huntMonsters.length,
        xpHourEst: Math.round(avgMonsterXp * estimatedKillsHour) || 25000,
        profitHourEst: Math.round(avgMonsterProfit * estimatedKillsHour) || 5000,
        tier,
        monsterDetails: huntMonsters
      };
    });

    // 4. Salvar no PostgreSQL
    const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });
    await client.connect();

    try {
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(777888999);');
      } catch (e) {}

      // Garante tabelas
      await client.query(`
        CREATE TABLE IF NOT EXISTS stonegy_hunts_catalog (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          recommended_level INTEGER NOT NULL,
          level_min INTEGER NOT NULL,
          max_lure INTEGER DEFAULT 1,
          min_lure INTEGER DEFAULT 1,
          is_premium BOOLEAN DEFAULT FALSE,
          map_id INTEGER,
          monsters_json JSONB DEFAULT '[]'::jsonb,
          xp_hour_est INTEGER DEFAULT 0,
          profit_hour_est INTEGER DEFAULT 0,
          tier TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stonegy_monsters_catalog (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          hp INTEGER DEFAULT 0,
          xp INTEGER DEFAULT 0,
          image TEXT,
          bestiary_race TEXT,
          bestiary_difficulty INTEGER DEFAULT 1,
          elemental_resistances JSONB DEFAULT '{}'::jsonb,
          loot_json JSONB DEFAULT '[]'::jsonb,
          avg_gold INTEGER DEFAULT 0,
          avg_loot INTEGER DEFAULT 0,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stonegy_items_catalog (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          npc_sell_price INTEGER DEFAULT 0,
          image TEXT,
          weight NUMERIC DEFAULT 0,
          stackable BOOLEAN DEFAULT FALSE,
          raw_json JSONB DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stonegy_sync_logs (
          id SERIAL PRIMARY KEY,
          game_version TEXT,
          hunts_count INTEGER,
          monsters_count INTEGER,
          items_count INTEGER,
          status TEXT,
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Upsert Hunts
      for (const h of enrichedHunts) {
        await client.query(`
          INSERT INTO stonegy_hunts_catalog (id, title, recommended_level, level_min, max_lure, min_lure, is_premium, map_id, monsters_json, xp_hour_est, profit_hour_est, tier, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            recommended_level = EXCLUDED.recommended_level,
            level_min = EXCLUDED.level_min,
            max_lure = EXCLUDED.max_lure,
            min_lure = EXCLUDED.min_lure,
            is_premium = EXCLUDED.is_premium,
            map_id = EXCLUDED.map_id,
            monsters_json = EXCLUDED.monsters_json,
            xp_hour_est = EXCLUDED.xp_hour_est,
            profit_hour_est = EXCLUDED.profit_hour_est,
            tier = EXCLUDED.tier,
            updated_at = NOW();
        `, [
          h.id,
          h.title,
          h.recommendedLevel,
          h.levelMin,
          h.maxLure,
          h.minLure,
          h.isPremmium,
          h.mapId || null,
          JSON.stringify(h.monsterDetails || []),
          h.xpHourEst,
          h.profitHourEst,
          h.tier
        ]);
      }

      // Upsert Itens em Batch
      for (const item of rawItems) {
        if (!item || !item.id) continue;
        await client.query(`
          INSERT INTO stonegy_items_catalog (id, name, npc_sell_price, image, weight, stackable, raw_json, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            npc_sell_price = EXCLUDED.npc_sell_price,
            image = EXCLUDED.image,
            weight = EXCLUDED.weight,
            stackable = EXCLUDED.stackable,
            raw_json = EXCLUDED.raw_json,
            updated_at = NOW();
        `, [
          item.id,
          item.name || `Item ${item.id}`,
          item.npcSellPrice || 0,
          item.image || null,
          item.weight || 0,
          !!item.stackable,
          JSON.stringify(item)
        ]);
      }

      // Upsert Monstros
      for (const monster of rawMonsters) {
        if (!monster || !monster.id) continue;
        let avgGold = 0;
        if (monster.goldCoins && monster.goldCoins.rolls) {
          monster.goldCoins.rolls.forEach(r => {
            const avgCount = ((r.minCount || 1) + (r.maxCount || 1)) / 2;
            avgGold += (r.chance / 100) * avgCount * (r.coinValue || 1);
          });
        }

        await client.query(`
          INSERT INTO stonegy_monsters_catalog (id, name, hp, xp, image, bestiary_race, bestiary_difficulty, elemental_resistances, loot_json, avg_gold, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            hp = EXCLUDED.hp,
            xp = EXCLUDED.xp,
            image = EXCLUDED.image,
            bestiary_race = EXCLUDED.bestiary_race,
            bestiary_difficulty = EXCLUDED.bestiary_difficulty,
            elemental_resistances = EXCLUDED.elemental_resistances,
            loot_json = EXCLUDED.loot_json,
            avg_gold = EXCLUDED.avg_gold,
            updated_at = NOW();
        `, [
          monster.id,
          monster.name || `Monster ${monster.id}`,
          monster.hp || 0,
          monster.xp || 0,
          monster.image || null,
          monster.bestiaryRace || 'UNKNOWN',
          monster.bestiaryDifficulty || 1,
          JSON.stringify(monster.elementalResistances || {}),
          JSON.stringify(monster.loot || []),
          Math.round(avgGold)
        ]);
      }

      // Log de sincronização bem-sucedida
      await client.query(`
        INSERT INTO stonegy_sync_logs (game_version, hunts_count, monsters_count, items_count, status)
        VALUES ($1, $2, $3, $4, $5);
      `, [version, enrichedHunts.length, rawMonsters.length, rawItems.length, 'SUCCESS']);

      await client.query('COMMIT');
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Sync Engine] ✅ Sincronização concluída com sucesso em ${elapsed}s! (${enrichedHunts.length} Hunts, ${rawMonsters.length} Monstros, ${rawItems.length} Itens)`);

      return {
        success: true,
        version,
        hunts: enrichedHunts,
        monsters: rawMonsters,
        items: rawItems
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('[Sync Engine] ❌ Erro ao sincronizar catálogo do Stonegy:', err);
    return { success: false, error: err.message };
  }
}

function startPeriodicSync(dbUrl, intervalHours = 5) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  console.log(`[Sync Engine] 🕒 Agendador de sincronização ativado: executando a cada ${intervalHours} horas.`);

  // Executa uma vez na inicialização em background
  setTimeout(() => {
    runFullSync(dbUrl).catch(e => console.error('[Sync Engine] Erro no sync inicial:', e));
  }, 3000);

  // Agenda periodicamente a cada 5h
  setInterval(() => {
    runFullSync(dbUrl).catch(e => console.error('[Sync Engine] Erro no sync periódico:', e));
  }, intervalMs);
}

module.exports = {
  runFullSync,
  startPeriodicSync
};
