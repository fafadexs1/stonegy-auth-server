/**
 * Stonegy Bestiary & Charm Optimizer Engine
 * Analisa os 410 monstros do jogo, suas fraquezas elementais e calcula a melhor
 * estratégia de Bestiário e alocação de Charms para maximizar o DPS nas 129 hunts.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let CHARMS_CATALOG = [];
try {
  CHARMS_CATALOG = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'game_charms.json'), 'utf8'));
} catch (e) {
  CHARMS_CATALOG = [];
}

/**
 * Recomenda os melhores charms para cada monstro com base nas suas resistências elementais
 */
function recommendCharmsForMonster(monster) {
  if (!monster) return [];
  const res = monster.elementalResistances || {};
  const recs = [];

  // Se o monstro recebe > 100% de dano de um elemento, esse charm é muito mais forte
  if ((res.FIRE || 1) > 1) {
    recs.push({ charm: 'Enflame', element: 'FIRE', damageMultiplier: res.FIRE, reason: `Fraqueza a Fogo (${Math.round(res.FIRE * 100)}%)` });
  }
  if ((res.ICE || 1) > 1) {
    recs.push({ charm: 'Freeze', element: 'ICE', damageMultiplier: res.ICE, reason: `Fraqueza a Gelo (${Math.round(res.ICE * 100)}%)` });
  }
  if ((res.ENERGY || 1) > 1) {
    recs.push({ charm: 'Zap', element: 'ENERGY', damageMultiplier: res.ENERGY, reason: `Fraqueza a Energia (${Math.round(res.ENERGY * 100)}%)` });
  }
  if ((res.EARTH || 1) > 1) {
    recs.push({ charm: 'Poison', element: 'EARTH', damageMultiplier: res.EARTH, reason: `Fraqueza a Terra (${Math.round(res.EARTH * 100)}%)` });
  }
  if ((res.HOLY || 1) > 1) {
    recs.push({ charm: 'Divine Wrath / Holy', element: 'HOLY', damageMultiplier: res.HOLY, reason: `Fraqueza a Sagrado (${Math.round(res.HOLY * 100)}%)` });
  }
  if ((res.PHYSICAL || 1) >= 1) {
    recs.push({ charm: 'Wound', element: 'PHYSICAL', damageMultiplier: res.PHYSICAL || 1, reason: 'Dano físico consistente (5% HP)' });
  }

  // Ordena pelo maior multiplicador de dano
  recs.sort((a, b) => b.damageMultiplier - a.damageMultiplier);
  return recs;
}

/**
 * Analisa uma hunt e retorna o radar de Bestiário com charms ideais para a sala
 */
function analyzeHuntBestiary(hunt = {}) {
  const monsters = hunt.monsterDetails || [];
  const analysis = monsters.map(m => {
    const recommendedCharms = recommendCharmsForMonster(m);
    const difficulty = m.bestiaryDifficulty || 1;
    const requiredKills = difficulty === 1 ? 250 : difficulty === 2 ? 500 : difficulty === 3 ? 1000 : 2500;
    const charmPoints = difficulty === 1 ? 15 : difficulty === 2 ? 25 : difficulty === 3 ? 50 : 100;

    return {
      monsterId: m.id,
      name: m.name,
      image: m.image,
      hp: m.hp,
      xp: m.xp,
      difficulty,
      requiredKills,
      charmPoints,
      recommendedCharms: recommendedCharms.slice(0, 3)
    };
  });

  return {
    huntId: hunt.id,
    huntTitle: hunt.title,
    monstersCount: monsters.length,
    monsters: analysis
  };
}

module.exports = {
  CHARMS_CATALOG,
  recommendCharmsForMonster,
  analyzeHuntBestiary
};
