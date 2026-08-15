/**
 * Stonegy Vocation Combat & Spell Rotation Brain
 * Inteligência tática avançada por vocação (Knight, Paladin, Sorcerer, Druid, Monk)
 * com Mana Weaving, Proteção contra Overheal e Rotações Ótimas de DPS/Sustain.
 */

'use strict';

const VOCATION_SPELLS = {
  KNIGHT: [
    { name: "Lesser Front Sweep", level: 1, mana: 6, cdMs: 6000, type: "AOE_PHYSICAL", priority: 3 },
    { name: "Brutal Strike", level: 16, mana: 30, cdMs: 6000, type: "SINGLE_PHYSICAL", priority: 2 },
    { name: "Whirlwind Throw", level: 28, mana: 40, cdMs: 6000, type: "RANGED_PHYSICAL", priority: 2 },
    { name: "Groundshaker", level: 33, mana: 160, cdMs: 8000, type: "AOE_EARTH", priority: 4 },
    { name: "Berserk", level: 35, mana: 115, cdMs: 4000, type: "AOE_PHYSICAL", priority: 5 },
    { name: "Front Sweep", level: 70, mana: 200, cdMs: 6000, type: "AOE_PHYSICAL", priority: 5 },
    { name: "Fierce Berserk", level: 90, mana: 340, cdMs: 6000, type: "AOE_PHYSICAL", priority: 6 },
    { name: "Wound Cleansing", level: 8, mana: 40, cdMs: 1000, type: "HEAL", priority: 10 }
  ],
  PALADIN: [
    { name: "Light Healing", level: 1, mana: 20, cdMs: 1000, type: "HEAL", priority: 10 },
    { name: "Divine Missile", level: 40, mana: 20, cdMs: 2000, type: "SINGLE_HOLY", priority: 4 },
    { name: "Ethereal Spear", level: 23, mana: 25, cdMs: 2000, type: "SINGLE_PHYSICAL", priority: 3 },
    { name: "Divine Caldera", level: 50, mana: 160, cdMs: 4000, type: "AOE_HOLY", priority: 6 },
    { name: "Divine Healing", level: 35, mana: 210, cdMs: 1000, type: "HEAL", priority: 10 },
    { name: "Salvation", level: 60, mana: 210, cdMs: 1000, type: "HEAL", priority: 10 },
    { name: "Recovery", level: 50, mana: 100, cdMs: 60000, type: "BUFF_REGEN", priority: 8 }
  ],
  SORCERER: [
    { name: "Energy Strike", level: 12, mana: 20, cdMs: 2000, type: "SINGLE_ENERGY", priority: 3 },
    { name: "Flame Strike", level: 14, mana: 20, cdMs: 2000, type: "SINGLE_FIRE", priority: 3 },
    { name: "Energy Beam", level: 23, mana: 40, cdMs: 4000, type: "BEAM_ENERGY", priority: 4 },
    { name: "Great Energy Beam", level: 31, mana: 110, cdMs: 6000, type: "BEAM_ENERGY", priority: 5 },
    { name: "Energy Wave", level: 38, mana: 170, cdMs: 4000, type: "WAVE_ENERGY", priority: 6 },
    { name: "Rage of the Skies", level: 55, mana: 600, cdMs: 40000, type: "AOE_ENERGY", priority: 8 },
    { name: "Hells Core", level: 60, mana: 1100, cdMs: 40000, type: "AOE_FIRE", priority: 9 },
    { name: "Magic Shield", level: 14, mana: 50, cdMs: 2000, type: "BUFF_DEFENSE", priority: 9 }
  ],
  DRUID: [
    { name: "Terra Strike", level: 13, mana: 20, cdMs: 2000, type: "SINGLE_EARTH", priority: 3 },
    { name: "Ice Strike", level: 15, mana: 20, cdMs: 2000, type: "SINGLE_ICE", priority: 3 },
    { name: "Ice Wave", level: 18, mana: 25, cdMs: 4000, type: "WAVE_ICE", priority: 4 },
    { name: "Strong Ice Wave", level: 40, mana: 170, cdMs: 8000, type: "WAVE_ICE", priority: 6 },
    { name: "Terra Wave", level: 38, mana: 170, cdMs: 4000, type: "WAVE_EARTH", priority: 6 },
    { name: "Eternal Winter", level: 60, mana: 1050, cdMs: 40000, type: "AOE_ICE", priority: 9 },
    { name: "Wrath of Nature", level: 55, mana: 700, cdMs: 40000, type: "AOE_EARTH", priority: 8 },
    { name: "Heal Friend", level: 18, mana: 140, cdMs: 1000, type: "HEAL", priority: 10 }
  ],
  MONK: [
    { name: "Swift Jab", level: 0, mana: 3, cdMs: 2000, type: "SINGLE_PHYSICAL", priority: 2 },
    { name: "Double Jab", level: 14, mana: 30, cdMs: 4000, type: "SINGLE_PHYSICAL", priority: 3 },
    { name: "Flurry of Blows", level: 35, mana: 110, cdMs: 4000, type: "AOE_PHYSICAL", priority: 5 },
    { name: "Chained Penance", level: 70, mana: 180, cdMs: 4000, type: "AOE_PHYSICAL", priority: 6 },
    { name: "Greater Flurry of Blows", level: 90, mana: 300, cdMs: 16000, type: "AOE_PHYSICAL", priority: 7 },
    { name: "Forceful Uppercut", level: 110, mana: 325, cdMs: 60000, type: "BURST_PHYSICAL", priority: 8 }
  ]
};

/**
 * Calcula a política ótima de cura e uso de potes
 */
function calculateSurvivalPolicy(player = {}, huntMonsters = []) {
  const hpPct = Number(player.hpPct ?? 1.0);
  const manaPct = Number(player.manaPct ?? 1.0);
  const vocation = String(player.vocation || 'KNIGHT').toUpperCase();

  // Calcula o maior dano potencial que os monstros da hunt podem causar em 1 turno
  let maxBurstDamage = 50;
  huntMonsters.forEach(m => {
    const melee = m.meleeAtk?.maxDamage || (m.hp ? m.hp * 0.08 : 50);
    maxBurstDamage = Math.max(maxBurstDamage, melee);
  });

  // Limiares dinâmicos para economizar potes e cortar overheal
  let healSpellThreshold = 0.80;
  let potionHealthThreshold = 0.40;
  let potionManaThreshold = 0.50;

  if (vocation === 'KNIGHT') {
    // Knights têm muito HP, curam no Exura Ico com 80% e só usam Health Potion se HP < 45%
    healSpellThreshold = 0.78;
    potionHealthThreshold = 0.42;
    potionManaThreshold = 0.55; // Knight precisa manter mana para soltar Exori Gran
  } else if (vocation === 'PALADIN') {
    healSpellThreshold = 0.82;
    potionHealthThreshold = 0.45;
    potionManaThreshold = 0.50;
  } else if (vocation === 'SORCERER' || vocation === 'DRUID') {
    // Mages têm pouco HP e muita Mana: curam com spell e usam Mana Potion constantemente
    healSpellThreshold = 0.88;
    potionHealthThreshold = 0.50;
    potionManaThreshold = 0.65; // Mages precisam de mana alta para Utamo / Waves
  }

  const needsSpellHeal = hpPct < healSpellThreshold;
  const needsHealthPotion = hpPct < potionHealthThreshold;
  const needsManaPotion = manaPct < potionManaThreshold;

  return {
    vocation,
    hpPct: Math.round(hpPct * 100),
    manaPct: Math.round(manaPct * 100),
    maxMonsterBurst: Math.round(maxBurstDamage),
    thresholds: {
      spellHealPct: Math.round(healSpellThreshold * 100),
      healthPotPct: Math.round(potionHealthThreshold * 100),
      manaPotPct: Math.round(potionManaThreshold * 100)
    },
    actions: {
      castSpellHeal: needsSpellHeal,
      useHealthPotion: needsHealthPotion,
      useManaPotion: needsManaPotion
    },
    overhealProtected: !needsHealthPotion && hpPct >= potionHealthThreshold
  };
}

/**
 * Obtém a rotação de magias recomendada para o nível e vocação
 */
function getOptimalSpellRotation(vocation = 'KNIGHT', playerLevel = 1, monsterCount = 1) {
  const voc = String(vocation).toUpperCase();
  const spellList = VOCATION_SPELLS[voc] || VOCATION_SPELLS.KNIGHT;

  const availableSpells = spellList.filter(s => playerLevel >= s.level && s.type !== 'HEAL');

  // Se tem 3+ monstros, prioriza AoE; se tem 1-2 monstros, prioriza Single/Burst
  availableSpells.sort((a, b) => {
    if (monsterCount >= 3) {
      const aAoe = a.type.startsWith('AOE') || a.type.startsWith('WAVE') ? 10 : 0;
      const bAoe = b.type.startsWith('AOE') || b.type.startsWith('WAVE') ? 10 : 0;
      return (b.priority + bAoe) - (a.priority + aAoe);
    }
    return b.priority - a.priority;
  });

  return {
    vocation: voc,
    level: playerLevel,
    monsterCount,
    rotation: availableSpells,
    topPrioritySpell: availableSpells[0] || null,
    nextSpellUnlock: spellList.find(s => s.level > playerLevel) || null
  };
}

module.exports = {
  VOCATION_SPELLS,
  calculateSurvivalPolicy,
  getOptimalSpellRotation
};
