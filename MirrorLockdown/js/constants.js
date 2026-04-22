export const SIDES = { BLUE: 'blue', RED: 'red' };

export const UNIT_TEMPLATES = {
  core: { name: '主核', hp: 4, move: 1, attackRange: 1, damage: 1 },
  striker: { name: '突击者', hp: 3, move: 2, attackRange: 1, damage: 1 },
  guard: { name: '守卫者', hp: 4, move: 1, attackRange: 1, damage: 1, armor: 1 },
  disruptor: { name: '扰乱者', hp: 3, move: 1, attackRange: 1, damage: 1, blockRange: 2 },
};

export const ACTIONS = {
  MOVE: 'move',
  ATTACK: 'attack',
  DEFEND: 'defend',
  BLOCK: 'block',
};

export const TERRAIN_TYPES = ['energy', 'jam', 'shield'];

export const EVENT_TYPES = ['centerLock', 'edgeCollapse', 'boostSpawn'];
