/**
 * Stonegy Gear Optimizer & Best-in-Slot (BiS) Engine
 * Analisa todos os 1.669 itens do jogo, compara o equipamento atual do jogador com
 * os itens no inventário e com o catálogo de lojas/drops para recomendar o melhor setup
 * por vocação (Knight, Paladin, Sorcerer, Druid, Monk) e por faixa de level.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let GEAR_CATALOG = null;

function loadGearCatalog() {
  if (GEAR_CATALOG) return GEAR_CATALOG;
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'game_gear_catalog.json'), 'utf8');
    GEAR_CATALOG = JSON.parse(raw);
  } catch (e) {
    GEAR_CATALOG = { HEAD: [], CHEST: [], LEGS: [], FEET: [], NECK: [], RING: [], ROD_WAND: [], HAND_ONE: [] };
  }
  return GEAR_CATALOG;
}

/**
 * Calcula a pontuação de poder de um item (Gear Score) baseado na vocação e atributos
 */
function calculateItemScore(item, vocation = 'KNIGHT') {
  if (!item) return 0;
  const voc = String(vocation).toUpperCase();
  let score = 0;

  // Defesa / Armor (Muito importante para Knights e Paladins, relevante para todos)
  const arm = Number(item.arm || 0);
  const def = Number(item.def || 0);
  const atk = Number(item.atk || 0);
  const speed = Number(item.speed || 0);
  const mlvl = Number(item.magicLevel || item.mlvl || 0);

  // Bônus de skills
  let skillBonus = 0;
  if (item.skillBonus && typeof item.skillBonus === 'object') {
    Object.values(item.skillBonus).forEach(v => { skillBonus += Number(v || 0); });
  }

  // Bônus de resistências elementais
  let resBonus = 0;
  if (item.elementalResistances && typeof item.elementalResistances === 'object') {
    Object.values(item.elementalResistances).forEach(res => {
      if (res < 1) resBonus += (1 - res) * 100; // Redução de dano
    });
  }

  if (voc === 'KNIGHT' || voc === 'MONK') {
    score = (arm * 12) + (def * 8) + (atk * 15) + (skillBonus * 20) + (speed * 1.5) + (resBonus * 2);
  } else if (voc === 'PALADIN') {
    score = (arm * 10) + (def * 6) + (atk * 16) + (skillBonus * 22) + (speed * 2.5) + (resBonus * 2);
  } else if (voc === 'SORCERER' || voc === 'DRUID') {
    score = (arm * 8) + (mlvl * 45) + (atk * 5) + (def * 5) + (speed * 2) + (resBonus * 3);
  } else {
    score = (arm * 10) + (atk * 10) + (def * 6) + (speed * 2);
  }

  if (item.isLegendary) score += 50;
  if (item.imbuementSlots) score += item.imbuementSlots * 15;

  return Math.round(score);
}

/**
 * Compara um item equipado com um candidato do inventário
 */
function compareItems(equippedItem, candidateItem, vocation = 'KNIGHT', playerLevel = 1) {
  const candidateReqLevel = Number(candidateItem.levelMin || candidateItem.minLevel || 0);
  if (playerLevel < candidateReqLevel) {
    return { isUpgrade: false, reason: `Requer level ${candidateReqLevel}` };
  }

  const voc = String(vocation).toUpperCase();
  if (Array.isArray(candidateItem.vocations) && candidateItem.vocations.length > 0) {
    if (!candidateItem.vocations.includes(voc)) {
      return { isUpgrade: false, reason: `Não compatível com ${voc}` };
    }
  }

  const scoreCurrent = equippedItem ? calculateItemScore(equippedItem, voc) : 0;
  const scoreCandidate = calculateItemScore(candidateItem, voc);
  const diff = scoreCandidate - scoreCurrent;

  return {
    isUpgrade: diff > 0,
    scoreCurrent,
    scoreCandidate,
    diff,
    statChanges: {
      arm: (candidateItem.arm || 0) - (equippedItem?.arm || 0),
      atk: (candidateItem.atk || 0) - (equippedItem?.atk || 0),
      def: (candidateItem.def || 0) - (equippedItem?.def || 0),
      speed: (candidateItem.speed || 0) - (equippedItem?.speed || 0),
      magicLevel: (candidateItem.magicLevel || 0) - (equippedItem?.magicLevel || 0)
    }
  };
}

/**
 * Analisa o inventário do jogador em busca de upgrades imediatos para os itens equipados
 */
function findBagUpgrades(equippedGear = {}, bagItems = [], vocation = 'KNIGHT', playerLevel = 1) {
  const catalog = loadGearCatalog();
  const upgradesFound = [];

  const slotMap = {
    HEAD: equippedGear.HEAD || equippedGear.head || equippedGear.helmet,
    CHEST: equippedGear.CHEST || equippedGear.chest || equippedGear.armor,
    LEGS: equippedGear.LEGS || equippedGear.legs,
    FEET: equippedGear.FEET || equippedGear.feet || equippedGear.boots,
    NECK: equippedGear.NECK || equippedGear.neck || equippedGear.amulet,
    RING: equippedGear.RING || equippedGear.ring,
    HAND_ONE: equippedGear.HAND_ONE || equippedGear.handOne || equippedGear.weapon || equippedGear.shield
  };

  bagItems.forEach(bagItem => {
    if (!bagItem || !bagItem.name) return;
    const name = bagItem.name.toLowerCase();

    // Determina o slot
    let targetSlot = null;
    if (name.includes('helmet') || name.includes('hood') || name.includes('circlet')) targetSlot = 'HEAD';
    else if (name.includes('armor') || name.includes('robe') || name.includes('coat') || name.includes('mail')) targetSlot = 'CHEST';
    else if (name.includes('legs') || name.includes('trousers') || name.includes('pants')) targetSlot = 'LEGS';
    else if (name.includes('boots') || name.includes('shoes') || name.includes('spats')) targetSlot = 'FEET';
    else if (name.includes('amulet') || name.includes('necklace') || name.includes('pendant')) targetSlot = 'NECK';
    else if (name.includes('ring')) targetSlot = 'RING';
    else if (bagItem.atk > 0 || bagItem.def > 0 || name.includes('sword') || name.includes('axe') || name.includes('club') || name.includes('bow') || name.includes('rod') || name.includes('wand') || name.includes('shield')) targetSlot = 'HAND_ONE';

    if (!targetSlot) return;

    const currentEquipped = slotMap[targetSlot];
    const comparison = compareItems(currentEquipped, bagItem, vocation, playerLevel);

    if (comparison.isUpgrade) {
      upgradesFound.push({
        slot: targetSlot,
        current: currentEquipped ? { name: currentEquipped.name, arm: currentEquipped.arm, atk: currentEquipped.atk } : null,
        candidate: {
          id: bagItem.id || bagItem.itemId,
          name: bagItem.name,
          image: bagItem.image,
          arm: bagItem.arm || 0,
          atk: bagItem.atk || 0,
          def: bagItem.def || 0,
          magicLevel: bagItem.magicLevel || 0,
          speed: bagItem.speed || 0
        },
        scoreDiff: comparison.diff,
        statChanges: comparison.statChanges
      });
    }
  });

  upgradesFound.sort((a, b) => b.scoreDiff - a.scoreDiff);
  return upgradesFound;
}

/**
 * Recomenda os melhores upgrades disponíveis no jogo para a vocação e level do jogador
 */
function recommendBestInSlot(vocation = 'KNIGHT', playerLevel = 1, budgetGold = Infinity) {
  const catalog = loadGearCatalog();
  const voc = String(vocation).toUpperCase();
  const bisRecommendations = {};

  const slots = ['HEAD', 'CHEST', 'LEGS', 'FEET', 'NECK', 'RING', 'HAND_ONE'];

  slots.forEach(slot => {
    const candidateList = (catalog[slot] || []).filter(item => {
      const minLv = item.levelMin || 0;
      if (playerLevel < minLv) return false;
      if (Array.isArray(item.vocations) && item.vocations.length > 0 && !item.vocations.includes(voc)) return false;
      if (item.npcSellPrice && item.npcSellPrice > budgetGold) return false;
      return true;
    });

    candidateList.sort((a, b) => calculateItemScore(b, voc) - calculateItemScore(a, voc));

    if (candidateList.length > 0) {
      const best = candidateList[0];
      bisRecommendations[slot] = {
        id: best.id,
        name: best.name,
        image: best.image,
        arm: best.arm,
        atk: best.atk,
        def: best.def,
        speed: best.speed,
        magicLevel: best.magicLevel,
        gearScore: calculateItemScore(best, voc),
        npcPrice: best.npcSellPrice || 0,
        alternatives: candidateList.slice(1, 4).map(alt => ({
          name: alt.name,
          gearScore: calculateItemScore(alt, voc),
          price: alt.npcSellPrice || 0
        }))
      };
    }
  });

  return bisRecommendations;
}

module.exports = {
  calculateItemScore,
  compareItems,
  findBagUpgrades,
  recommendBestInSlot,
  loadGearCatalog
};
