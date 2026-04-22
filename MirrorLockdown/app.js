(() => {
  const SIDES = { BLUE: 'blue', RED: 'red' };
  const UNIT_TEMPLATES = {
    core: { name: '主核', hp: 4, move: 1, attackRange: 1, damage: 1 },
    striker: { name: '突击者', hp: 3, move: 2, attackRange: 1, damage: 1 },
    guard: { name: '守卫者', hp: 4, move: 1, attackRange: 1, damage: 1, armor: 1 },
    disruptor: { name: '扰乱者', hp: 3, move: 1, attackRange: 1, damage: 1, blockRange: 2 },
  };
  const ACTIONS = { MOVE: 'move', ATTACK: 'attack', DEFEND: 'defend', BLOCK: 'block' };
  const TERRAIN_TYPES = ['energy', 'jam', 'shield'];
  const EVENT_TYPES = ['centerLock', 'edgeCollapse', 'boostSpawn'];

  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const keyOf = (x, y) => `${x},${y}`;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const mirrorPos = (pos, size) => ({ x: size - 1 - pos.x, y: size - 1 - pos.y });
  const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function ringCells(size, ring = 0) {
    const max = size - 1 - ring;
    const cells = [];
    for (let i = ring; i <= max; i += 1) {
      cells.push({ x: ring, y: i }, { x: max, y: i });
      if (i !== ring && i !== max) cells.push({ x: i, y: ring }, { x: i, y: max });
    }
    return cells;
  }

  function createGame(config) {
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
      { role: 'striker', x: 0, y: y - 1 },
      { role: 'guard', x: 0, y: y + 1 },
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
    return { id: `${side}-${role}`, side, role, x, y, hp: tpl.hp, defend: false, attackBuff: 0, alive: true };
  }

  function createSymmetricTerrain(size) {
    const terrain = {};
    const types = shuffle([...TERRAIN_TYPES]).slice(0, 2 + Math.floor(Math.random() * 2));
    const half = [];
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (x < (size - 1) / 2 || (x === Math.floor(size / 2) && y <= Math.floor(size / 2))) half.push({ x, y });
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

  const getUnitAt = (state, x, y) => state.units.find((u) => u.alive && u.x === x && u.y === y);
  const unitsOf = (state, side) => state.units.filter((u) => u.side === side && u.alive);

  function validTargets(state, unit, action) {
    const out = [];
    if (!unit || !unit.alive) return out;
    const tpl = UNIT_TEMPLATES[unit.role];
    if (action === ACTIONS.MOVE) {
      for (let x = 0; x < state.size; x += 1) {
        for (let y = 0; y < state.size; y += 1) {
          if (manhattan(unit, { x, y }) <= tpl.move && !getUnitAt(state, x, y) && !state.blocked[keyOf(x, y)]) out.push({ x, y });
        }
      }
    }
    if (action === ACTIONS.ATTACK) {
      state.units.filter((u) => u.side !== unit.side && u.alive).forEach((enemy) => {
        if (manhattan(unit, enemy) <= tpl.attackRange) out.push({ x: enemy.x, y: enemy.y });
      });
    }
    if (action === ACTIONS.BLOCK && unit.role === 'disruptor') {
      for (let x = 0; x < state.size; x += 1) {
        for (let y = 0; y < state.size; y += 1) {
          if (manhattan(unit, { x, y }) <= tpl.blockRange && !getUnitAt(state, x, y)) out.push({ x, y });
        }
      }
    }
    return out;
  }

  const setPlan = (state, side, unitId, plan) => { state.plans[side][unitId] = plan; };
  const clearPlan = (state, side, unitId) => { delete state.plans[side][unitId]; };
  const allPlanned = (state, side) => unitsOf(state, side).every((u) => !!state.plans[side][u.id]);

  function stepTurn(state) {
    const snapshot = clone({ units: state.units, terrain: state.terrain, blocked: state.blocked, eventCells: state.eventCells });
    const logs = [];
    state.units.forEach((u) => { u.defend = false; });

    [SIDES.BLUE, SIDES.RED].forEach((side) => {
      Object.entries(state.plans[side]).forEach(([uid, plan]) => {
        const unit = state.units.find((u) => u.id === uid && u.alive);
        if (!unit) return;
        if (plan.action === ACTIONS.DEFEND) { unit.defend = true; logs.push(`${nameOf(unit)}进入防御姿态`); }
        if (plan.action === ACTIONS.BLOCK && unit.role === 'disruptor' && plan.target) {
          state.blocked[keyOf(plan.target.x, plan.target.y)] = { by: side, ttl: 1 };
          logs.push(`${nameOf(unit)}封锁了(${plan.target.x + 1},${plan.target.y + 1})`);
        }
      });
    });

    resolveMoves(state, logs);
    resolveAttacks(state, logs);
    applyTerrainAndEvent(state, logs);
    updateCenterControl(state, logs);

    const winner = detectWinner(state);
    if (winner) { state.winner = winner.side; state.winnerReason = winner.reason; }

    state.priority = state.priority === SIDES.BLUE ? SIDES.RED : SIDES.BLUE;
    state.turn += 1;
    state.phase = SIDES.BLUE;
    state.plans = { blue: {}, red: {} };

    if (state.eventsEnabled && state.turn % 3 === 0 && !state.winner) triggerEvent(state, logs);
    else state.eventCells = {};

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
    intents.forEach((i) => {
      const k = keyOf(i.target.x, i.target.y);
      if (!targetMap[k]) targetMap[k] = [];
      targetMap[k].push(i);
    });

    Object.values(targetMap).forEach((conflicts) => {
      if (conflicts.length > 1 && conflicts.some((c) => c.unit.side !== conflicts[0].unit.side)) {
        conflicts.sort((a, b) => (a.unit.side === priorityFirst ? -1 : 1));
        const loser = conflicts[1];
        loser.cancel = true;
        logs.push(`${nameOf(loser.unit)}移动冲突失败（优先权劣势）`);
      }
    });

    intents.forEach((intent) => {
      if (intent.cancel || !intent.unit.alive) return;
      const k = keyOf(intent.target.x, intent.target.y);
      if (state.blocked[k] || getUnitAt(state, intent.target.x, intent.target.y)) return;
      if (manhattan(intent.unit, intent.target) > UNIT_TEMPLATES[intent.unit.role].move) return;
      intent.unit.x = intent.target.x;
      intent.unit.y = intent.target.y;
      logs.push(`${nameOf(intent.unit)}移动到(${intent.unit.x + 1},${intent.unit.y + 1})`);
    });
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
        if (dmg > 0) { damages[tk] = (damages[tk] || 0) + dmg; logs.push(`${nameOf(unit)}攻击${nameOf(target)}造成${dmg}点威胁`); }
        unit.attackBuff = 0;
      });
    });

    state.units.filter((u) => u.alive).forEach((unit) => {
      const tk = keyOf(unit.x, unit.y);
      if (!damages[tk]) return;
      let taken = damages[tk];
      if (UNIT_TEMPLATES[unit.role].armor) taken -= UNIT_TEMPLATES[unit.role].armor;
      if (unit.defend) taken -= 1;
      if (state.terrain[tk] === 'shield') taken -= 1;
      unit.hp -= Math.max(0, taken);
      logs.push(`${nameOf(unit)}受到${Math.max(0, taken)}点伤害，剩余${Math.max(0, unit.hp)} HP`);
      if (unit.hp <= 0) { unit.alive = false; logs.push(`${nameOf(unit)}被击破`); }
    });
  }

  function applyTerrainAndEvent(state, logs) {
    state.units.filter((u) => u.alive).forEach((u) => {
      const t = state.terrain[keyOf(u.x, u.y)];
      if (t === 'energy') { u.attackBuff = 1; logs.push(`${nameOf(u)}获得能量强化（下次攻击+1）`); }
      if (state.boostCells[keyOf(u.x, u.y)]) { u.attackBuff = 1; logs.push(`${nameOf(u)}踏入事件增益区`); }
      if (state.eventCells[keyOf(u.x, u.y)] === 'danger') {
        u.hp -= 1; logs.push(`${nameOf(u)}受到边缘坍缩伤害`);
        if (u.hp <= 0) { u.alive = false; logs.push(`${nameOf(u)}在坍缩区被摧毁`); }
      }
    });
    Object.keys(state.blocked).forEach((k) => { state.blocked[k].ttl -= 1; if (state.blocked[k].ttl <= 0) delete state.blocked[k]; });
  }

  function updateCenterControl(state, logs) {
    const c0 = Math.floor(state.size / 2) - 1;
    const c1 = Math.floor(state.size / 2) + 1;
    let blue = 0;
    let red = 0;
    state.units.filter((u) => u.alive).forEach((u) => {
      if (u.x >= c0 && u.x <= c1 && u.y >= c0 && u.y <= c1) {
        if (u.side === SIDES.BLUE) blue += 1;
        else red += 1;
      }
    });
    if (blue > red && blue > 0) { state.centerControl.blue += 1; state.centerControl.red = 0; logs.push('蓝方占领中心区进度 +1'); }
    else if (red > blue && red > 0) { state.centerControl.red += 1; state.centerControl.blue = 0; logs.push('红方占领中心区进度 +1'); }
    else { state.centerControl.blue = 0; state.centerControl.red = 0; }
  }

  function detectWinner(state) {
    const blueCore = state.units.find((u) => u.id === 'blue-core');
    const redCore = state.units.find((u) => u.id === 'red-core');
    if (!blueCore || !blueCore.alive) return { side: SIDES.RED, reason: '击破了蓝方主核' };
    if (!redCore || !redCore.alive) return { side: SIDES.BLUE, reason: '击破了红方主核' };
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
      for (let x = c - 1; x <= c + 1; x += 1) for (let y = c - 1; y <= c + 1; y += 1) state.blocked[keyOf(x, y)] = { by: 'event', ttl: 1 };
      logs.push('事件：中心封锁（本回合结束后消失）');
    }
    if (event === 'edgeCollapse') {
      ringCells(state.size, 0).forEach((p) => { state.eventCells[keyOf(p.x, p.y)] = 'danger'; });
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
    return `${unit.side === SIDES.BLUE ? '蓝' : '红'}${UNIT_TEMPLATES[unit.role].name}`;
  }

  function buildAiPlans(state) {
    const plans = {};
    unitsOf(state, SIDES.RED).forEach((unit) => { plans[unit.id] = pickAiAction(state, unit, state.difficulty); });
    return plans;
  }

  function pickAiAction(state, unit, difficulty) {
    const attacks = validTargets(state, unit, ACTIONS.ATTACK);
    const moves = validTargets(state, unit, ACTIONS.MOVE);
    const blocks = validTargets(state, unit, ACTIONS.BLOCK);

    if (difficulty === 'easy') {
      if (attacks.length) return { action: ACTIONS.ATTACK, target: randPick(attacks) };
      const options = [];
      if (moves.length) options.push({ action: ACTIONS.MOVE, target: randPick(moves) });
      if (unit.role === 'disruptor' && blocks.length) options.push({ action: ACTIONS.BLOCK, target: randPick(blocks) });
      options.push({ action: ACTIONS.DEFEND });
      return randPick(options);
    }

    const scored = [];
    attacks.forEach((target) => {
      const targetUnit = getUnitAt(state, target.x, target.y);
      let score = 60;
      if (targetUnit && targetUnit.role === 'core') score += 80;
      else if (targetUnit && targetUnit.role === 'striker') score += 25;
      else score += 15;
      scored.push({ score, plan: { action: ACTIONS.ATTACK, target } });
    });

    moves.forEach((target) => {
      const c = Math.floor(state.size / 2);
      const centerBonus = 6 - manhattan(target, { x: c, y: c });
      const core = state.units.find((u) => u.id === 'blue-core' && u.alive);
      const coreAggro = core ? (10 - manhattan(target, core)) : 0;
      let score = 25 + centerBonus + coreAggro;
      if (difficulty === 'hard') {
        const foes = unitsOf(state, SIDES.BLUE);
        const safe = foes.filter((f) => manhattan(target, f) > 1).length;
        score += safe;
      }
      scored.push({ score, plan: { action: ACTIONS.MOVE, target } });
    });

    if (unit.role === 'disruptor') blocks.forEach((target) => scored.push({ score: 30, plan: { action: ACTIONS.BLOCK, target } }));
    scored.push({ score: 18, plan: { action: ACTIONS.DEFEND } });
    scored.sort((a, b) => b.score - a.score);
    return (scored[0] && scored[0].plan) || { action: ACTIONS.DEFEND };
  }

  const roleTag = { core: '核', striker: '突', guard: '卫', disruptor: '扰' };

  function bindUI(state, onCellClick, onActionClick, onEndPlan, onReplay, onRestart, onMenu) {
    const board = document.getElementById('board');
    board.style.gridTemplateColumns = `repeat(${state.size},1fr)`;
    board.innerHTML = '';
    for (let x = 0; x < state.size; x += 1) {
      for (let y = 0; y < state.size; y += 1) {
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.type = 'button';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.onclick = () => onCellClick(x, y);
        board.appendChild(cell);
      }
    }
    document.querySelectorAll('.action-buttons button').forEach((btn) => { btn.type = 'button'; btn.onclick = () => onActionClick(btn.dataset.action); });
    document.getElementById('end-plan-btn').onclick = onEndPlan;
    document.getElementById('replay-btn').onclick = onReplay;
    document.getElementById('restart-btn').onclick = onRestart;
    document.getElementById('to-menu-btn').onclick = onMenu;
  }

  function render(state) {
    document.getElementById('turn-label').textContent = String(state.turn);
    document.getElementById('priority-label').textContent = state.priority === SIDES.BLUE ? '蓝方' : '红方';
    document.getElementById('phase-label').textContent = state.mode === 'pve' && state.phase === SIDES.RED ? 'AI 规划中' : `${state.phase === SIDES.BLUE ? '蓝' : '红'}方规划`;

    renderBoard(state);
    renderStatus(state);
    renderLogs(state);

    const hint = document.getElementById('hint');
    hint.textContent = allPlanned(state, state.phase) ? `${state.phase === SIDES.BLUE ? '蓝方' : '红方'}已完成，点击确认。` : `请为${state.phase === SIDES.BLUE ? '蓝方' : '红方'}单位设置行动。`;
    document.getElementById('end-plan-btn').textContent = state.phase === SIDES.BLUE ? '确认蓝方行动' : '确认红方行动';
  }

  function renderBoard(state) {
    const center = Math.floor(state.size / 2);
    const targets = state.selectedUnitId && state.selectedAction ? validTargets(state, state.units.find((u) => u.id === state.selectedUnitId), state.selectedAction) : [];
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
      if (!unit) return;
      const u = document.createElement('div');
      u.className = `unit ${unit.side}`;
      if (unit.id === state.selectedUnitId) u.classList.add('selected');
      u.textContent = `${roleTag[unit.role]} ${unit.hp}`;
      const badge = document.createElement('span');
      badge.className = 'badge';
      const plan = state.plans[unit.side][unit.id];
      badge.textContent = !plan ? '-' : (plan.action === ACTIONS.MOVE ? '移' : plan.action === ACTIONS.ATTACK ? '攻' : plan.action === ACTIONS.DEFEND ? '守' : '锁');
      u.appendChild(badge);
      cell.appendChild(u);
    });
  }

  function renderStatus(state) {
    const left = document.getElementById('left-status');
    left.innerHTML = [SIDES.BLUE, SIDES.RED].map((side) => {
      const unitsHtml = unitsOf(state, side).map((u) => `<div class="unit-row"><span>${UNIT_TEMPLATES[u.role].name}${u.attackBuff ? '⚡' : ''}</span><span>HP ${u.hp}</span></div>`).join('');
      return `<div class="status-team"><h4>${side === SIDES.BLUE ? '蓝方' : '红方'}（中心连控:${state.centerControl[side]}/2）</h4>${unitsHtml || '<p>全灭</p>'}</div>`;
    }).join('');
    const selected = state.units.find((u) => u.id === state.selectedUnitId);
    document.getElementById('selected-unit').textContent = selected ? `已选：${selected.side === SIDES.BLUE ? '蓝' : '红'}${UNIT_TEMPLATES[selected.role].name}` : '已选：无';
  }

  function renderLogs(state) {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    state.logs.slice(-8).forEach((log) => { const li = document.createElement('li'); li.textContent = log; list.appendChild(li); });
  }

  function switchScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function showResult(state, onRestart, onMenu) {
    const modal = document.getElementById('result-modal');
    modal.classList.remove('hidden');
    document.getElementById('result-title').textContent = state.winner === SIDES.BLUE ? '蓝方胜利' : '红方胜利';
    document.getElementById('result-text').textContent = state.winnerReason;
    document.getElementById('modal-restart-btn').onclick = onRestart;
    document.getElementById('modal-menu-btn').onclick = onMenu;
  }

  const hideResult = () => document.getElementById('result-modal').classList.add('hidden');

  let state = null;
  let pendingAction = null;
  const $ = (id) => document.getElementById(id);

  function initMenu() {
    const toRules = () => switchScreen('rules-screen');
    const toMenu = () => switchScreen('menu-screen');

    window.__ML_startGame = startGame;
    window.__ML_toRules = toRules;
    window.__ML_toMenu = toMenu;

    $('mode-select').onchange = () => { $('difficulty-wrap').style.display = $('mode-select').value === 'pve' ? 'flex' : 'none'; };
    $('rules-btn').onclick = toRules;
    $('back-menu-btn').onclick = toMenu;
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
    bindUI(state, onCellClick, onActionClick, onEndPlan, replayTurn, startGame, () => switchScreen('menu-screen'));
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

    for (const b of before) {
      const a = state.units.find((u) => u.id === b.id);
      if (!a) continue;
      if (b.alive && !a.alive) beep(160, 0.12);
      if (b.x !== a.x || b.y !== a.y) {
        flashCell(a.x, a.y, '#7cf3ff');
        beep(520, 0.04);
        await sleep(300 / state.animationSpeed);
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
    if (!state || !state.replayLog) return;
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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let audioCtx;
  function beep(freq, duration) {
    if (!state || !state.soundOn) return;
    try {
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
    } catch (e) {
      // ignore audio errors silently
    }
  }

  initMenu();
})();
