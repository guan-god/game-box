import { ACTIONS, SIDES, UNIT_TEMPLATES } from './constants.js';
import { allPlanned, getUnitAt, unitsOf, validTargets } from './gameState.js';
import { keyOf } from './utils.js';

const roleTag = { core: '核', striker: '突', guard: '卫', disruptor: '扰' };

export function bindUI({ state, onCellClick, onActionClick, onEndPlan, onReplay, onRestart, onMenu }) {
  const board = document.getElementById('board');
  board.style.gridTemplateColumns = `repeat(${state.size},1fr)`;

  board.innerHTML = '';
  for (let x = 0; x < state.size; x += 1) {
    for (let y = 0; y < state.size; y += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onCellClick(x, y));
      board.appendChild(cell);
    }
  }

  document.querySelectorAll('.action-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => onActionClick(btn.dataset.action));
  });

  document.getElementById('end-plan-btn').addEventListener('click', onEndPlan);
  document.getElementById('replay-btn').addEventListener('click', onReplay);
  document.getElementById('restart-btn').addEventListener('click', onRestart);
  document.getElementById('to-menu-btn').addEventListener('click', onMenu);
}

export function render(state) {
  document.getElementById('turn-label').textContent = String(state.turn);
  document.getElementById('priority-label').textContent = state.priority === SIDES.BLUE ? '蓝方' : '红方';
  const phaseLabel = state.mode === 'pve' && state.phase === SIDES.RED ? 'AI 规划中' : `${state.phase === SIDES.BLUE ? '蓝' : '红'}方规划`;
  document.getElementById('phase-label').textContent = phaseLabel;

  renderBoard(state);
  renderStatus(state);
  renderLogs(state);

  const hint = document.getElementById('hint');
  const planSide = state.phase;
  hint.textContent = allPlanned(state, planSide)
    ? `${planSide === SIDES.BLUE ? '蓝方' : '红方'}已完成，点击确认。`
    : `请为${planSide === SIDES.BLUE ? '蓝方' : '红方'}单位设置行动。`;

  const endBtn = document.getElementById('end-plan-btn');
  endBtn.textContent = state.phase === SIDES.BLUE ? '确认蓝方行动' : '确认红方行动';
}

function renderBoard(state) {
  const center = Math.floor(state.size / 2);
  const targets = state.selectedUnitId && state.selectedAction
    ? validTargets(state, state.units.find((u) => u.id === state.selectedUnitId), state.selectedAction)
    : [];
  const targetSet = new Set(targets.map((t) => keyOf(t.x, t.y)));

  document.querySelectorAll('.cell').forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cell.className = 'cell';
    if (Math.abs(x - center) <= 1 && Math.abs(y - center) <= 1) cell.classList.add('center-zone');
    if (state.terrain[keyOf(x, y)]) cell.classList.add(`terrain-${state.terrain[keyOf(x, y)]}`);
    if (state.blocked[keyOf(x, y)]) cell.classList.add('blocked');
    if (state.eventCells[keyOf(x, y)] === 'danger') cell.classList.add('event-danger');
    if (state.boostCells[keyOf(x, y)]) cell.classList.add('terrain-energy');
    if (targetSet.has(keyOf(x, y))) cell.classList.add('target');
    cell.innerHTML = '';

    const unit = getUnitAt(state, x, y);
    if (unit) {
      const unitEl = document.createElement('div');
      unitEl.className = `unit ${unit.side}`;
      if (unit.id === state.selectedUnitId) unitEl.classList.add('selected');
      unitEl.textContent = `${roleTag[unit.role]} ${unit.hp}`;
      const badge = document.createElement('span');
      badge.className = 'badge';
      const plan = state.plans[unit.side][unit.id];
      badge.textContent = plan ? badgeText(plan.action) : '-';
      unitEl.appendChild(badge);
      cell.appendChild(unitEl);
    }
  });
}

function badgeText(action) {
  if (action === ACTIONS.MOVE) return '移';
  if (action === ACTIONS.ATTACK) return '攻';
  if (action === ACTIONS.DEFEND) return '守';
  if (action === ACTIONS.BLOCK) return '锁';
  return '-';
}

function renderStatus(state) {
  const left = document.getElementById('left-status');
  left.innerHTML = [SIDES.BLUE, SIDES.RED].map((side) => {
    const unitsHtml = unitsOf(state, side).map((u) => {
      const tpl = UNIT_TEMPLATES[u.role];
      const buff = u.attackBuff ? '⚡' : '';
      return `<div class="unit-row"><span>${tpl.name}${buff}</span><span>HP ${u.hp}</span></div>`;
    }).join('');
    const cc = state.centerControl[side];
    return `<div class="status-team"><h4>${side === SIDES.BLUE ? '蓝方' : '红方'}（中心连控:${cc}/2）</h4>${unitsHtml || '<p>全灭</p>'}</div>`;
  }).join('');

  const selected = state.units.find((u) => u.id === state.selectedUnitId);
  document.getElementById('selected-unit').textContent = selected
    ? `已选：${selected.side === SIDES.BLUE ? '蓝' : '红'}${UNIT_TEMPLATES[selected.role].name}`
    : '已选：无';
}

function renderLogs(state) {
  const logList = document.getElementById('log-list');
  logList.innerHTML = '';
  state.logs.slice(-8).forEach((log) => {
    const li = document.createElement('li');
    li.textContent = log;
    logList.appendChild(li);
  });
}

export function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

export function showResult(state, onRestart, onMenu) {
  const modal = document.getElementById('result-modal');
  modal.classList.remove('hidden');
  document.getElementById('result-title').textContent = state.winner === SIDES.BLUE ? '蓝方胜利' : '红方胜利';
  document.getElementById('result-text').textContent = state.winnerReason;
  document.getElementById('modal-restart-btn').onclick = onRestart;
  document.getElementById('modal-menu-btn').onclick = onMenu;
}

export function hideResult() {
  document.getElementById('result-modal').classList.add('hidden');
}
