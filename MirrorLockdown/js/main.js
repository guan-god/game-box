import { buildAiPlans } from './ai.js';
import { ACTIONS, SIDES } from './constants.js';
import { allPlanned, clearPlan, createGame, setPlan, stepTurn, unitsOf, validTargets } from './gameState.js';
import { keyOf } from './utils.js';
import { bindUI, hideResult, render, showResult, switchScreen } from './ui.js';

let state = null;
let pendingAction = null;

const $ = (id) => document.getElementById(id);

function initMenu() {
  $('mode-select').addEventListener('change', () => {
    $('difficulty-wrap').style.display = $('mode-select').value === 'pve' ? 'flex' : 'none';
  });
  $('rules-btn').onclick = () => switchScreen('rules-screen');
  $('back-menu-btn').onclick = () => switchScreen('menu-screen');
  $('start-btn').onclick = startGame;
}

function startGame() {
  hideResult();
  state = createGame({
    mode: $('mode-select').value,
    difficulty: $('difficulty-select').value,
    boardSize: Number($('board-size-select').value),
    eventsEnabled: $('events-select').value === 'on',
    animationSpeed: Number($('speed-range').value),
    soundOn: $('sound-select').value === 'on',
  });
  switchScreen('game-screen');
  bindUI({
    state,
    onCellClick,
    onActionClick,
    onEndPlan,
    onReplay: replayTurn,
    onRestart: startGame,
    onMenu: () => switchScreen('menu-screen'),
  });
  render(state);
}

function onCellClick(x, y) {
  if (!state || state.winner) return;
  const unit = state.units.find((u) => u.alive && u.x === x && u.y === y);
  if (unit && unit.side === state.phase) {
    state.selectedUnitId = unit.id;
    state.selectedAction = null;
    pendingAction = null;
    render(state);
    return;
  }

  if (!state.selectedUnitId || !pendingAction) return;
  const selected = state.units.find((u) => u.id === state.selectedUnitId && u.alive);
  if (!selected || selected.side !== state.phase) return;
  const valid = validTargets(state, selected, pendingAction).some((t) => t.x === x && t.y === y);
  if (!valid) return;
  setPlan(state, state.phase, selected.id, { action: pendingAction, target: { x, y } });
  beep(440, 0.06);
  pendingAction = null;
  state.selectedAction = null;
  render(state);
}

function onActionClick(action) {
  if (!state || !state.selectedUnitId) return;
  const unit = state.units.find((u) => u.id === state.selectedUnitId && u.alive);
  if (!unit || unit.side !== state.phase) return;

  if (action === 'clear') {
    clearPlan(state, state.phase, unit.id);
    pendingAction = null;
    state.selectedAction = null;
    render(state);
    return;
  }

  if (action === ACTIONS.DEFEND) {
    setPlan(state, state.phase, unit.id, { action: ACTIONS.DEFEND });
    beep(360, 0.06);
    render(state);
    return;
  }

  if (action === ACTIONS.BLOCK && unit.role !== 'disruptor') return;
  pendingAction = action;
  state.selectedAction = action;
  render(state);
}

async function onEndPlan() {
  if (!state) return;
  if (!allPlanned(state, state.phase)) {
    $('hint').textContent = '该方仍有单位未下达行动。';
    return;
  }

  if (state.mode === 'pvp' && state.phase === SIDES.BLUE) {
    state.phase = SIDES.RED;
    state.selectedUnitId = null;
    pendingAction = null;
    state.selectedAction = null;
    render(state);
    return;
  }

  if (state.mode === 'pve' && state.phase === SIDES.BLUE) {
    state.phase = SIDES.RED;
    state.plans.red = buildAiPlans(state);
  }

  await resolveTurnAnim();
}

async function resolveTurnAnim() {
  const before = state.units.map((u) => ({ id: u.id, x: u.x, y: u.y, alive: u.alive }));
  stepTurn(state);
  render(state);
  const speed = 300 / state.animationSpeed;

  for (const b of before) {
    const a = state.units.find((u) => u.id === b.id);
    if (!a) continue;
    if (b.alive && !a.alive) beep(160, 0.12);
    if (b.x !== a.x || b.y !== a.y) {
      flashCell(a.x, a.y, '#7cf3ff');
      beep(520, 0.04);
      await sleep(speed);
    }
  }

  state.logs.forEach((line) => {
    if (line.includes('攻击')) flashRandom('#ff6ca8');
    if (line.includes('封锁')) flashRandom('#c799ff');
  });

  if (state.winner) {
    beep(740, 0.2);
    showResult(state, startGame, () => switchScreen('menu-screen'));
  }
  render(state);
}

async function replayTurn() {
  if (!state?.replayLog) return;
  const logs = state.replayLog.logs || [];
  $('hint').textContent = '正在回放上回合...';
  for (const l of logs.slice(0, 8)) {
    $('hint').textContent = `回放：${l}`;
    if (l.includes('攻击')) flashRandom('#ff6ca8');
    else if (l.includes('封锁')) flashRandom('#b58fff');
    else flashRandom('#6ed9ff');
    await sleep(220 / state.animationSpeed);
  }
  $('hint').textContent = '回放结束。';
}

function flashRandom(color) {
  const cells = [...document.querySelectorAll('.cell')];
  const cell = cells[Math.floor(Math.random() * cells.length)];
  if (!cell) return;
  cell.style.boxShadow = `0 0 18px ${color}`;
  setTimeout(() => { cell.style.boxShadow = ''; }, 150);
}

function flashCell(x, y, color) {
  const cell = [...document.querySelectorAll('.cell')].find((c) => Number(c.dataset.x) === x && Number(c.dataset.y) === y);
  if (!cell) return;
  cell.style.boxShadow = `0 0 18px ${color}`;
  setTimeout(() => { cell.style.boxShadow = ''; }, 180);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let audioCtx;
function beep(freq, duration) {
  if (!state?.soundOn) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.value = 0.02;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

initMenu();
