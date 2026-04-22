import { ACTIONS, EVENT_TYPES, SIDES, TERRAIN_TYPES, UNIT_TEMPLATES } from './constants.js';
import { clone, inBounds, keyOf, manhattan, mirrorPos, randPick, ringCells, shuffle } from './utils.js';

export function createGame(config) {
  const size = Number(config.boardSize || 7);
  const state = {
    mode: config.mode,
    difficulty: config.difficulty,
    eventsEnabled: config.eventsEnabled,
    animationSpeed: Number(config.animationSpeed || 1),
    soundOn: config.soundOn,
    size,
    turn: 1,
    phase: SIDES.BLUE,
    priority: SIDES.BLUE,
    winner: null,
    winnerReason: '',
    centerControl: { blue: 0, red: 0 },
    plans: { blue: {}, red: {} },
    replayLog: null,
    logs: [],
    terrain: {},
    blocked: {},
    eventCells: {},
    boostCells: {},
    units: seedUnits(size),
    selectedUnitId: null,
    selectedAction: null,
  };
  state.terrain = createSymmetricTerrain(size);
  return state;
}

function seedUnits(size) {
  const y = Math.floor(size / 2);
  const blueBase = [
    { role: 'core', x: 1, y },
    { role: 'striker', x: 0, y - 1 },
    { role: 'guard', x: 0, y + 1 },
    { role: 'disruptor', x: 1, y: Math.max(0, y - 2) },
  ];
  const units = [];
  blueBase.forEach((b) => {
    units.push(makeUnit(SIDES.BLUE, b.role, b.x, b.y));
    const m = mirrorPos({ x: b.x, y: b.y }, size);
    units.push(makeUnit(SIDES.RED, b.role, m.x, m.y));
  });
  return units;
}

function makeUnit(side, role, x, y) {
  const tpl = UNIT_TEMPLATES[role];
  return {
    id: `${side}-${role}`,
    side,
    role,
    x,
    y,
    hp: tpl.hp,
    defend: false,
    attackBuff: 0,
    alive: true,
  };
}

function createSymmetricTerrain(size) {
  const terrain = {};
  const types = shuffle([...TERRAIN_TYPES]).slice(0, 2 + Math.floor(Math.random() * 2));
  const half = [];
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      if (x < (size - 1) / 2 || (x === Math.floor(size / 2) && y <= Math.floor(size / 2))) {
        half.push({ x, y });
      }
    }
  }
  shuffle(half);
  for (const type of types) {
    let placed = 0;
    while (placed < Math.max(3, Math.floor(size / 2)) && half.length) {
      const cell = half.pop();
      const mk = keyOf(cell.x, cell.y);
      const mirrored = mirrorPos(cell, size);
      const mmk = keyOf(mirrored.x, mirrored.y);
      if (!terrain[mk] && !terrain[mmk]) {
        terrain[mk] = type;
        terrain[mmk] = type;
        placed += 1;
      }
    }
  }
  return terrain;
}

export function getUnitAt(state, x, y) {
  return state.units.find((u) => u.alive && u.x === x && u.y === y);
}

export function unitsOf(state, side) {
  return state.units.filter((u) => u.side === side && u.alive);
}

export function validTargets(state, unit, action) {
  const out = [];
  if (!unit?.alive) return out;
  const tpl = UNIT_TEMPLATES[unit.role];
  const size = state.size;

  if (action === ACTIONS.MOVE) {
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (manhattan(unit, { x, y }) <= tpl.move && !getUnitAt(state, x, y) && !state.blocked[keyOf(x, y)]) {
          out.push({ x, y });
        }
      }
    }
  }

  if (action === ACTIONS.ATTACK) {
    for (const enemy of state.units.filter((u) => u.side !== unit.side && u.alive)) {
      if (manhattan(unit, enemy) <= tpl.attackRange) out.push({ x: enemy.x, y: enemy.y });
    }
  }

  if (action === ACTIONS.BLOCK && unit.role === 'disruptor') {
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (manhattan(unit, { x, y }) <= tpl.blockRange && !getUnitAt(state, x, y)) out.push({ x, y });
      }
    }
  }
  return out;
}

export function setPlan(state, side, unitId, plan) {
  state.plans[side][unitId] = plan;
}

export function clearPlan(state, side, unitId) {
  delete state.plans[side][unitId];
}

export function allPlanned(state, side) {
  return unitsOf(state, side).every((u) => !!state.plans[side][u.id]);
}

export function stepTurn(state) {
  const snapshot = clone({
    units: state.units,
    terrain: state.terrain,
    blocked: state.blocked,
    eventCells: state.eventCells,
  });
  const logs = [];

  state.units.forEach((u) => { u.defend = false; });

  // 1) defend and block
  for (const side of [SIDES.BLUE, SIDES.RED]) {
    Object.entries(state.plans[side]).forEach(([uid, plan]) => {
      const unit = state.units.find((u) => u.id === uid && u.alive);
      if (!unit) return;
      if (plan.action === ACTIONS.DEFEND) {
        unit.defend = true;
        logs.push(`${nameOf(unit)}进入防御姿态`);
      }
      if (plan.action === ACTIONS.BLOCK && unit.role === 'disruptor' && plan.target) {
        state.blocked[keyOf(plan.target.x, plan.target.y)] = { by: side, ttl: 1 };
        logs.push(`${nameOf(unit)}封锁了(${plan.target.x + 1},${plan.target.y + 1})`);
      }
    });
  }

  resolveMoves(state, logs);
  resolveAttacks(state, logs);
  applyTerrainAndEvent(state, logs);
  updateCenterControl(state, logs);

  const winner = detectWinner(state);
  if (winner) {
    state.winner = winner.side;
    state.winnerReason = winner.reason;
  }

  // turn rotate
  state.priority = state.priority === SIDES.BLUE ? SIDES.RED : SIDES.BLUE;
  state.turn += 1;
  state.phase = SIDES.BLUE;
  state.plans = { blue: {}, red: {} };

  if (state.eventsEnabled && state.turn % 3 === 0 && !state.winner) {
    triggerEvent(state, logs);
  } else {
    state.eventCells = {};
  }

  state.replayLog = { before: snapshot, after: clone({ units: state.units }), logs };
  state.logs = logs;
}

function resolveMoves(state, logs) {
  const intents = [];
  [SIDES.BLUE, SIDES.RED].forEach((side) => {
    Object.entries(state.plans[side]).forEach(([uid, plan]) => {
      const unit = state.units.find((u) => u.id === uid && u.alive);
      if (unit && plan.action === ACTIONS.MOVE && plan.target) intents.push({ unit, target: plan.target });
    });
  });

  const priorityFirst = state.priority;
  intents.sort((a, b) => (a.unit.side === priorityFirst ? -1 : 1));

  const targetMap = {};
  intents.forEach((intent) => {
    const k = keyOf(intent.target.x, intent.target.y);
    targetMap[k] = targetMap[k] || [];
    targetMap[k].push(intent);
  });

  for (const [k, conflicts] of Object.entries(targetMap)) {
    if (conflicts.length > 1 && conflicts.some((c) => c.unit.side !== conflicts[0].unit.side)) {
      conflicts.sort((a, b) => (a.unit.side === priorityFirst ? -1 : 1));
      const loser = conflicts[1];
      loser.cancel = true;
      logs.push(`${nameOf(loser.unit)}移动冲突失败（优先权劣势）`);
    }
  }

  for (const intent of intents) {
    if (intent.cancel || !intent.unit.alive) continue;
    const k = keyOf(intent.target.x, intent.target.y);
    if (state.blocked[k] || getUnitAt(state, intent.target.x, intent.target.y)) continue;
    if (manhattan(intent.unit, intent.target) > UNIT_TEMPLATES[intent.unit.role].move) continue;
    intent.unit.x = intent.target.x;
    intent.unit.y = intent.target.y;
    logs.push(`${nameOf(intent.unit)}移动到(${intent.unit.x + 1},${intent.unit.y + 1})`);
  }
}

function resolveAttacks(state, logs) {
  const damages = {};
  [SIDES.BLUE, SIDES.RED].forEach((side) => {
    Object.entries(state.plans[side]).forEach(([uid, plan]) => {
      const unit = state.units.find((u) => u.id === uid && u.alive);
      if (!unit || plan.action !== ACTIONS.ATTACK || !plan.target) return;
      const target = getUnitAt(state, plan.target.x, plan.target.y);
      if (!target || target.side === unit.side) return;
      if (manhattan(unit, target) > UNIT_TEMPLATES[unit.role].attackRange) return;
      const tk = keyOf(target.x, target.y);
      let dmg = UNIT_TEMPLATES[unit.role].damage + unit.attackBuff;
      if (state.terrain[keyOf(unit.x, unit.y)] === 'jam') dmg -= 1;
      dmg = Math.max(0, dmg);
      if (dmg > 0) {
        damages[tk] = (damages[tk] || 0) + dmg;
        logs.push(`${nameOf(unit)}攻击${nameOf(target)}造成${dmg}点威胁`);
      }
      unit.attackBuff = 0;
    });
  });

  for (const unit of state.units.filter((u) => u.alive)) {
    const tk = keyOf(unit.x, unit.y);
    if (!damages[tk]) continue;
    let taken = damages[tk];
    if (UNIT_TEMPLATES[unit.role].armor) taken -= UNIT_TEMPLATES[unit.role].armor;
    if (unit.defend) taken -= 1;
    if (state.terrain[tk] === 'shield') taken -= 1;
    unit.hp -= Math.max(0, taken);
    logs.push(`${nameOf(unit)}受到${Math.max(0, taken)}点伤害，剩余${Math.max(0, unit.hp)} HP`);
    if (unit.hp <= 0) {
      unit.alive = false;
      logs.push(`${nameOf(unit)}被击破`);
    }
  }
}

function applyTerrainAndEvent(state, logs) {
  // terrain buffs
  for (const u of state.units.filter((x) => x.alive)) {
    const t = state.terrain[keyOf(u.x, u.y)];
    if (t === 'energy') {
      u.attackBuff = 1;
      logs.push(`${nameOf(u)}获得能量强化（下次攻击+1）`);
    }
    if (state.boostCells[keyOf(u.x, u.y)]) {
      u.attackBuff = 1;
      logs.push(`${nameOf(u)}踏入事件增益区`);
    }
    if (state.eventCells[keyOf(u.x, u.y)] === 'danger') {
      u.hp -= 1;
      logs.push(`${nameOf(u)}受到边缘坍缩伤害`);
      if (u.hp <= 0) {
        u.alive = false;
        logs.push(`${nameOf(u)}在坍缩区被摧毁`);
      }
    }
  }

  Object.keys(state.blocked).forEach((k) => {
    state.blocked[k].ttl -= 1;
    if (state.blocked[k].ttl <= 0) delete state.blocked[k];
  });
}

function updateCenterControl(state, logs) {
  const c0 = Math.floor(state.size / 2) - 1;
  const c1 = Math.floor(state.size / 2) + 1;
  let blue = 0;
  let red = 0;
  for (const u of state.units.filter((x) => x.alive)) {
    if (u.x >= c0 && u.x <= c1 && u.y >= c0 && u.y <= c1) {
      if (u.side === SIDES.BLUE) blue += 1;
      else red += 1;
    }
  }
  if (blue > red && blue > 0) {
    state.centerControl.blue += 1;
    state.centerControl.red = 0;
    logs.push('蓝方占领中心区进度 +1');
  } else if (red > blue && red > 0) {
    state.centerControl.red += 1;
    state.centerControl.blue = 0;
    logs.push('红方占领中心区进度 +1');
  } else {
    state.centerControl.blue = 0;
    state.centerControl.red = 0;
  }
}

function detectWinner(state) {
  const blueCore = state.units.find((u) => u.id === 'blue-core');
  const redCore = state.units.find((u) => u.id === 'red-core');
  if (!blueCore?.alive) return { side: SIDES.RED, reason: '击破了蓝方主核' };
  if (!redCore?.alive) return { side: SIDES.BLUE, reason: '击破了红方主核' };

  if (state.centerControl.blue >= 2) return { side: SIDES.BLUE, reason: '连续两回合占领中心区' };
  if (state.centerControl.red >= 2) return { side: SIDES.RED, reason: '连续两回合占领中心区' };

  if (!hasEffectiveActions(state, SIDES.BLUE)) return { side: SIDES.RED, reason: '蓝方无有效行动' };
  if (!hasEffectiveActions(state, SIDES.RED)) return { side: SIDES.BLUE, reason: '红方无有效行动' };
  return null;
}

function hasEffectiveActions(state, side) {
  for (const u of unitsOf(state, side)) {
    if (validTargets(state, u, ACTIONS.MOVE).length) return true;
    if (validTargets(state, u, ACTIONS.ATTACK).length) return true;
    if (u.role === 'disruptor' && validTargets(state, u, ACTIONS.BLOCK).length) return true;
  }
  return false;
}

function triggerEvent(state, logs) {
  state.eventCells = {};
  state.boostCells = {};
  const event = randPick(EVENT_TYPES);
  if (event === 'centerLock') {
    const c = Math.floor(state.size / 2);
    for (let x = c - 1; x <= c + 1; x += 1) {
      for (let y = c - 1; y <= c + 1; y += 1) {
        state.blocked[keyOf(x, y)] = { by: 'event', ttl: 1 };
      }
    }
    logs.push('事件：中心封锁（本回合结束后消失）');
  }
  if (event === 'edgeCollapse') {
    ringCells(state.size, 0).forEach((p) => {
      state.eventCells[keyOf(p.x, p.y)] = 'danger';
    });
    logs.push('事件：边缘坍缩（外圈单位受到1点伤害）');
  }
  if (event === 'boostSpawn') {
    const x = Math.floor(Math.random() * Math.floor(state.size / 2));
    const y = Math.floor(Math.random() * state.size);
    const a = { x, y };
    const b = mirrorPos(a, state.size);
    state.boostCells[keyOf(a.x, a.y)] = true;
    state.boostCells[keyOf(b.x, b.y)] = true;
    logs.push('事件：镜像增益区出现（站上去攻击+1）');
  }
}

function nameOf(unit) {
  const sideText = unit.side === SIDES.BLUE ? '蓝' : '红';
  return `${sideText}${UNIT_TEMPLATES[unit.role].name}`;
}
