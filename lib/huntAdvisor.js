export const HUNT_CATALOG = Object.freeze([
  { id: 1, title: 'Sewers', levelMin: 1, recommendedLevel: 1, maxLure: 2, monsters: ['Rat', 'Cave Rat'], xpHourEst: 25000, profitHourEst: 3000, tier: 'Tier 1' },
  { id: 2, title: 'Forest', levelMin: 2, recommendedLevel: 2, maxLure: 2, monsters: ['Wolf', 'Bear'], xpHourEst: 45000, profitHourEst: 5000, tier: 'Tier 1' },
  { id: 11, title: 'Tomb Floor I', levelMin: 4, recommendedLevel: 5, maxLure: 2, monsters: ['Skeleton', 'Ghoul', 'Mummy'], xpHourEst: 85000, profitHourEst: 9000, tier: 'Tier 1' },
  { id: 9, title: 'Venore Rotworms', levelMin: 8, recommendedLevel: 10, maxLure: 2, monsters: ['Rotworm', 'Carrion Worm'], xpHourEst: 140000, profitHourEst: 18000, tier: 'Tier 2' },
  { id: 6, title: 'Amazon Camp Venore', levelMin: 8, recommendedLevel: 12, maxLure: 2, monsters: ['Amazon', 'Valkyrie', 'Witch'], xpHourEst: 180000, profitHourEst: 22000, tier: 'Tier 2' },
  { id: 19, title: 'Elf Quarter', levelMin: 13, recommendedLevel: 17, maxLure: 2, monsters: ['Elf', 'Elf Scout', 'Elf Arcanist'], xpHourEst: 230000, profitHourEst: 28000, tier: 'Tier 2' },
  { id: 10, title: 'Tiquanda Tarantula Cave', levelMin: 14, recommendedLevel: 20, maxLure: 3, monsters: ['Tarantula', 'Giant Spider'], xpHourEst: 260000, profitHourEst: 32000, tier: 'Tier 2' },
  { id: 8, title: 'Daramian Minotaur Pyramid', levelMin: 12, recommendedLevel: 30, maxLure: 5, monsters: ['Minotaur Guard', 'Minotaur Mage', 'Minotaur Archer'], xpHourEst: 620000, profitHourEst: 78000, tier: 'Tier 3' },
  { id: 7, title: 'Cyclops Mistrock Surface', levelMin: 15, recommendedLevel: 35, maxLure: 4, monsters: ['Cyclops', 'Cyclops Drone', 'Cyclops Smith'], xpHourEst: 550000, profitHourEst: 65000, tier: 'Tier 3' },
  { id: 18, title: 'Dragon Lair', levelMin: 30, recommendedLevel: 40, maxLure: 2, monsters: ['Dragon', 'Dragon Hatchling'], xpHourEst: 850000, profitHourEst: 130000, tier: 'Tier 4' },
  { id: 37, title: 'Feyrist Surface', levelMin: 30, recommendedLevel: 60, maxLure: 4, monsters: ['Feyrist Pixie', 'Faun', 'Dark Faun'], xpHourEst: 1400000, profitHourEst: 250000, tier: 'Tier 5' },
  { id: 29, title: 'Wyrms', levelMin: 45, recommendedLevel: 80, maxLure: 5, monsters: ['Wyrm'], xpHourEst: 1550000, profitHourEst: 240000, tier: 'Tier 5' },
  { id: 43, title: 'Lava Lurker', levelMin: 100, recommendedLevel: 100, maxLure: 7, monsters: ['Lava Lurker', 'Ravenous Lava Lurker'], xpHourEst: 4200000, profitHourEst: -50000, tier: 'Tier 7' },
  { id: 57, title: 'Asura Palace', levelMin: 120, recommendedLevel: 230, maxLure: 7, monsters: ['Dawnfire Asura', 'Midnight Asura', 'Hellhound'], xpHourEst: 7500000, profitHourEst: 1600000, tier: 'Tier 9' },
  { id: 44, title: 'Gazer Spectre', levelMin: 100, recommendedLevel: 300, maxLure: 7, monsters: ['Gazer Spectre', 'Thanatursus'], xpHourEst: 8900000, profitHourEst: 2100000, tier: 'Tier 10' }
]);

function safeLevel(value) {
  const parsed = Number.parseInt(String(value ?? '1'), 10);
  return Number.isFinite(parsed) ? Math.min(2000, Math.max(1, parsed)) : 1;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildHuntAdvisor({ level, sort = 'xp', filter = 'all', goal = 'balanced', currentGold = 0, inventoryValue = 0, netProfitHour = 0 } = {}) {
  const userLevel = safeLevel(level);
  const safeSort = ['xp', 'profit', 'level'].includes(sort) ? sort : 'xp';
  const safeFilter = ['all', 'level_fit'].includes(filter) ? filter : 'all';
  const safeGoal = ['money', 'xp', 'balanced'].includes(goal) ? goal : 'balanced';
  const cash = Math.max(0, safeNumber(currentGold));
  const carriedValue = Math.max(0, safeNumber(inventoryValue));
  const currentMargin = safeNumber(netProfitHour);

  let hunts = [...HUNT_CATALOG];
  if (safeFilter === 'level_fit') {
    hunts = hunts.filter(hunt => userLevel >= hunt.levelMin);
  }

  const maxXp = Math.max(1, ...hunts.map(hunt => hunt.xpHourEst));
  const maxProfit = Math.max(1, ...hunts.map(hunt => Math.max(0, hunt.profitHourEst)));
  const scored = hunts.map(hunt => {
    const xpScore = hunt.xpHourEst / maxXp;
    const profitScore = Math.max(0, hunt.profitHourEst) / maxProfit;
    const decisionScore = safeGoal === 'money'
      ? profitScore
      : safeGoal === 'xp'
        ? xpScore
        : (xpScore * 0.55) + (profitScore * 0.45);
    return { ...hunt, decisionScore: Number(decisionScore.toFixed(4)) };
  });

  const recommendedPool = scored.filter(hunt =>
    userLevel >= hunt.levelMin && userLevel <= hunt.recommendedLevel + 15
  );
  const bestRecommended = [...(recommendedPool.length ? recommendedPool : scored)]
    .sort((a, b) => b.decisionScore - a.decisionScore)[0] || HUNT_CATALOG[0];

  hunts = scored;
  if (safeSort === 'profit') hunts.sort((a, b) => b.profitHourEst - a.profitHourEst);
  else if (safeSort === 'level') hunts.sort((a, b) => a.recommendedLevel - b.recommendedLevel);
  else hunts.sort((a, b) => b.xpHourEst - a.xpHourEst);

  return {
    success: true,
    userLevel,
    goal: safeGoal,
    context: {
      currentGold: cash,
      inventoryValue: carriedValue,
      netProfitHour: currentMargin
    },
    strategy: safeGoal === 'money'
      ? 'Priorizando margem e caixa.'
      : safeGoal === 'xp'
        ? 'Priorizando velocidade para o próximo level.'
        : 'Equilibrando XP e margem.',
    bestRecommended,
    hunts
  };
}
