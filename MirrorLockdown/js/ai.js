import { ACTIONS, SIDES } from './constants.js';
import { validTargets, unitsOf } from './gameState.js';
import { clone, manhattan, randPick } from './utils.js';

export function buildAiPlans(state) {
  const plans = {};
  const aiUnits = unitsOf(state, SIDES.RED);
  for (const unit of aiUnits) {
    plans[unit.id] = pickAction(state, unit, state.difficulty);
  }
  return plans;
}

function pickAction(state, unit, difficulty) {
  const attacks = validTargets(state, unit, ACTIONS.ATTACK);
  const moves = validTargets(state, unit, ACTIONS.MOVE);
  const blocks = validTargets(state, unit, ACTIONS.BLOCK);

  if (difficulty === 'easy') {
    if (attacks.length) return { action: ACTIONS.ATTACK, target: randPick(attacks) };
    const opts = [];
    if (moves.length) opts.push(() => ({ action: ACTIONS.MOVE, target: randPick(moves) }));
    if (unit.role === 'disruptor' && blocks.length) opts.push(() => ({ action: ACTIONS.BLOCK, target: randPick(blocks) }));
    opts.push(() => ({ action: ACTIONS.DEFEND }));
    return randPick(opts)();
  }

  const scored = [];
  attacks.forEach((target) => {
    const score = 70 + targetPriority(state, target) + (difficulty === 'hard' ? centerBias(target, state.size) : 0);
    scored.push({ score, plan: { action: ACTIONS.ATTACK, target } });
  });

  moves.forEach((target) => {
    let score = 30 + centerBias(target, state.size);
    if (difficulty !== 'easy') score -= distanceToEnemyCore(state, target) * -3;
    if (difficulty === 'hard') score += safetyScore(state, target) * 5;
    scored.push({ score, plan: { action: ACTIONS.MOVE, target } });
  });

  if (unit.role === 'disruptor') {
    blocks.forEach((target) => {
      const score = 28 + nearEnemyCore(state, target) * 8;
      scored.push({ score, plan: { action: ACTIONS.BLOCK, target } });
    });
  }

  scored.push({ score: 20 + (difficulty === 'hard' ? protectCoreScore(state, unit) : 0), plan: { action: ACTIONS.DEFEND } });
  scored.sort((a, b) => b.score - a.score);

  if (difficulty === 'normal') return scored[0].plan;
  // hard difficulty: evaluate opponent likely attacks with shallow sim
  const bestTwo = scored.slice(0, 2);
  if (bestTwo.length === 1) return bestTwo[0].plan;
  return evaluateHard(state, unit.id, bestTwo.map((x) => x.plan));
}

function evaluateHard(state, unitId, candidates) {
  let best = candidates[0];
  let bestValue = -Infinity;
  for (const candidate of candidates) {
    const sim = clone(state);
    sim.plans.red = { [unitId]: candidate };
    const value = scoreBoard(sim);
    if (value > bestValue) {
      bestValue = value;
      best = candidate;
    }
  }
  return best;
}

function scoreBoard(state) {
  let v = 0;
  state.units.forEach((u) => {
    if (!u.alive) return;
    v += (u.side === SIDES.RED ? 1 : -1) * u.hp * 4;
    v += (u.side === SIDES.RED ? 1 : -1) * centerBias(u, state.size);
  });
  return v;
}

function targetPriority(state, targetPos) {
  const target = state.units.find((u) => u.alive && u.x === targetPos.x && u.y === targetPos.y);
  if (!target) return 0;
  if (target.role === 'core') return 60;
  if (target.role === 'striker') return 25;
  if (target.role === 'disruptor') return 18;
  return 14;
}

function centerBias(pos, size) {
  const c = Math.floor(size / 2);
  return 6 - manhattan(pos, { x: c, y: c });
}

function distanceToEnemyCore(state, pos) {
  const core = state.units.find((u) => u.id === 'blue-core' && u.alive);
  if (!core) return 0;
  return manhattan(pos, core);
}

function safetyScore(state, pos) {
  const foes = unitsOf(state, SIDES.BLUE);
  return foes.filter((u) => manhattan(pos, u) > 1).length / Math.max(1, foes.length);
}

function nearEnemyCore(state, pos) {
  const core = state.units.find((u) => u.id === 'blue-core' && u.alive);
  if (!core) return 0;
  return manhattan(pos, core) <= 2 ? 1 : 0;
}

function protectCoreScore(state, unit) {
  const core = state.units.find((u) => u.id === 'red-core' && u.alive);
  if (!core) return 0;
  return manhattan(unit, core) <= 2 ? 8 : 0;
}
