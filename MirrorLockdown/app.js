(() => {
  const SIDES = ['blue', 'red'];
  const CARDS = [
    { id: 'move', name: '移动', hint: '移动 1 格' },
    { id: 'assault', name: '突袭', hint: '相邻造成 1 伤害' },
    { id: 'dash', name: '冲刺', hint: '移动 2 格，本回合不可突袭' },
    { id: 'pulse', name: '脉冲', hint: '击退周围 1 格单位' },
    { id: 'barrier', name: '屏障', hint: '相邻空格生成障碍 1 回合' },
  ];

  const UNIT_CFG = {
    core: { name: '核心体', hp: 3, icon: '核' },
    striker: { name: '突击者', hp: 2, icon: '突' },
    disruptor: { name: '干扰者', hp: 2, icon: '扰' },
  };

  const $ = (id) => document.getElementById(id);
  const key = (x, y) => `${x},${y}`;
  const mht = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const mirror = (p) => ({ x: 5 - p.x, y: 5 - p.y });

  let state = null;
  let pendingCard = null;

  function makeState(opts) {
    const units = seedUnits();
    const terrain = seedSymmetricTerrain(units);
    return {
      mode: opts.mode,
      difficulty: opts.difficulty,
      soundOn: opts.soundOn,
      speed: opts.speed,
      turn: 1,
      phase: 'blue',
      priority: 'blue',
      selectedUnit: null,
      logs: [],
      winner: null,
      winnerReason: '',
      units,
      terrain,
      barriers: {},
      energy: { blue: 0, red: 0 },
      planned: { blue: [], red: [] },
      cooldown: { blue: {}, red: {} },
      stuck: { blue: 0, red: 0 },
      dashedThisTurn: { blue: {}, red: {} },
    };
  }

  function seedUnits() {
    const blueBase = [
      { role: 'core', x: 0, y: 2 },
      { role: 'striker', x: 1, y: 1 },
      { role: 'disruptor', x: 1, y: 3 },
    ];
    const units = [];
    blueBase.forEach((u) => {
      units.push({ id: `blue-${u.role}`, side: 'blue', role: u.role, x: u.x, y: u.y, hp: UNIT_CFG[u.role].hp, alive: true });
      const m = mirror(u);
      units.push({ id: `red-${u.role}`, side: 'red', role: u.role, x: m.x, y: m.y, hp: UNIT_CFG[u.role].hp, alive: true });
    });
    return units;
  }

  function seedSymmetricTerrain(units) {
    const terrain = {};
    const blocked = new Set(units.map((u) => key(u.x, u.y)));
    let pairs = 0;
    while (pairs < 4) {
      const x = Math.floor(Math.random() * 3);
      const y = Math.floor(Math.random() * 6);
      const a = key(x, y);
      const m = mirror({ x, y });
      const b = key(m.x, m.y);
      const center = (x >= 2 && x <= 3 && y >= 2 && y <= 3) || (m.x >= 2 && m.x <= 3 && m.y >= 2 && m.y <= 3);
      if (!terrain[a] && !terrain[b] && !blocked.has(a) && !blocked.has(b) && !center) {
        terrain[a] = 'rock';
        terrain[b] = 'rock';
        pairs += 1;
      }
    }
    return terrain;
  }

  function unitAt(x, y) {
    return state.units.find((u) => u.alive && u.x === x && u.y === y);
  }

  function isBlocked(x, y) {
    if (x < 0 || y < 0 || x > 5 || y > 5) return true;
    if (state.terrain[key(x, y)] === 'rock') return true;
    if (state.barriers[key(x, y)]) return true;
    return false;
  }

  function switchScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function openRules() { $('rules-modal').classList.remove('hidden'); }
  function closeRules() { $('rules-modal').classList.add('hidden'); }

  function showRuntimeError(msg) {
    const box = $('runtime-error');
    if (!msg) {
      box.textContent = '';
      box.classList.add('hidden');
    } else {
      box.textContent = `⚠️ ${msg}`;
      box.classList.remove('hidden');
    }
  }

  function initMenuEvents() {
    $('start-btn').onclick = startGame;
    $('rules-btn').onclick = openRules;
    $('rules-close').onclick = closeRules;
    $('rules-mask').onclick = closeRules;
    $('mode-select').onchange = () => { $('difficulty-wrap').style.display = $('mode-select').value === 'pve' ? 'flex' : 'none'; };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRules();
    });
  }

  function startGame() {
    closeRules();
    try {
      state = makeState({
        mode: $('mode-select').value,
        difficulty: $('difficulty-select').value,
        soundOn: $('sound-select').value === 'on',
        speed: Number($('speed-range').value),
      });
      pendingCard = null;
      switchScreen('game-screen');
      bindGameEvents();
      renderAll();
      if (!document.querySelector('#board .cell')) {
        showRuntimeError('棋盘未正确渲染，请刷新页面重试。');
      } else {
        showRuntimeError('');
      }
    } catch (e) {
      switchScreen('game-screen');
      showRuntimeError(`启动失败：${e && e.message ? e.message : '未知错误'}`);
      console.error(e);
    }
  }

  function bindGameEvents() {
    $('restart-btn').onclick = startGame;
    $('to-menu-btn').onclick = () => switchScreen('menu-screen');
    $('confirm-btn').onclick = confirmCurrentSide;
    $('undo-btn').onclick = undoLast;
    $('modal-restart').onclick = () => {
      $('result-modal').classList.add('hidden');
      startGame();
    };
    $('modal-menu').onclick = () => {
      $('result-modal').classList.add('hidden');
      switchScreen('menu-screen');
    };
    document.querySelectorAll('[data-close="result"]').forEach((n) => {
      n.onclick = () => $('result-modal').classList.add('hidden');
    });
  }

  function renderAll() {
    $('turn-label').textContent = String(state.turn);
    $('priority-label').textContent = state.priority === 'blue' ? '蓝方' : '红方';
    $('phase-label').textContent = `${state.phase === 'blue' ? '蓝方' : '红方'}选牌`;
    $('energy-blue').textContent = String(state.energy.blue);
    $('energy-red').textContent = String(state.energy.red);
    $('phase-side').textContent = `当前：${state.phase === 'blue' ? '蓝方' : '红方'}`;

    renderBoard();
    renderCards();
    renderSelected();
    renderStatus();
    renderLogs();
  }

  function renderBoard() {
    const board = $('board');
    board.innerHTML = '';
    const targets = getTargets();
    const targetSet = new Set(targets.map((t) => key(t.x, t.y)));

    for (let x = 0; x < 6; x += 1) {
      for (let y = 0; y < 6; y += 1) {
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.type = 'button';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        if (x >= 2 && x <= 3 && y >= 2 && y <= 3) cell.classList.add('center');
        if (state.terrain[key(x, y)] === 'rock' || state.barriers[key(x, y)]) cell.classList.add('block');
        if (targetSet.has(key(x, y))) cell.classList.add('target');
        cell.onclick = () => onCellClick(x, y);

        const u = unitAt(x, y);
        if (u) {
          const ue = document.createElement('div');
          ue.className = `unit ${u.side}`;
          ue.textContent = `${UNIT_CFG[u.role].icon} ${u.hp}`;
          const bd = document.createElement('span');
          bd.className = 'badge';
          bd.textContent = UNIT_CFG[u.role].name;
          ue.appendChild(bd);
          cell.appendChild(ue);
        }
        board.appendChild(cell);
      }
    }
  }

  function renderCards() {
    const wrap = $('cards-list');
    wrap.innerHTML = '';
    const chosen = state.planned[state.phase].map((p) => p.cardId);

    CARDS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-btn';
      const cd = state.cooldown[state.phase][c.id] || 0;
      if (cd > 0) btn.classList.add('cooldown');
      if (pendingCard === c.id) btn.classList.add('selected');
      btn.disabled = cd > 0 || chosen.length >= 2;
      btn.textContent = `${c.name}｜${c.hint}${cd > 0 ? '（冷却）' : ''}`;
      btn.onclick = () => {
        pendingCard = c.id;
        state.selectedUnit = null;
        hint(`已选择 ${c.name}，请在棋盘选择单位/目标。`);
        renderBoard();
        renderCards();
      };
      wrap.appendChild(btn);
    });
  }

  function renderSelected() {
    const list = $('selected-list');
    list.innerHTML = '';
    state.planned[state.phase].forEach((p, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${cardName(p.cardId)} → ${planDesc(p)}`;
      list.appendChild(li);
    });
  }

  function renderStatus() {
    const panel = $('status-panel');
    panel.innerHTML = SIDES.map((side) => {
      const rows = state.units.filter((u) => u.side === side && u.alive).map((u) => `<div class="unit-row"><span>${UNIT_CFG[u.role].name}</span><span>HP ${u.hp}</span></div>`).join('');
      const cd = Object.entries(state.cooldown[side]).filter((x) => x[1] > 0).map((x) => cardName(x[0])).join('、') || '无';
      return `<h4>${side === 'blue' ? '蓝方' : '红方'}（能量 ${state.energy[side]}）</h4>${rows}<p>冷却牌：${cd}</p>`;
    }).join('<hr/>');
  }

  function renderLogs() {
    const box = $('logs');
    box.innerHTML = '';
    state.logs.slice(-8).forEach((l) => {
      const li = document.createElement('li');
      li.textContent = l;
      box.appendChild(li);
    });
  }

  function planDesc(p) {
    if (p.target) return `(${p.target.x + 1},${p.target.y + 1})`;
    return p.unitId || '单位效果';
  }

  function onCellClick(x, y) {
    if (!pendingCard) return;
    const side = state.phase;
    const cellUnit = unitAt(x, y);
    if (!state.selectedUnit) {
      if (!cellUnit || cellUnit.side !== side) return;
      state.selectedUnit = cellUnit.id;
      hint(`已选单位 ${UNIT_CFG[cellUnit.role].name}，请选目标格。`);
      renderBoard();
      return;
    }

    const unit = state.units.find((u) => u.id === state.selectedUnit && u.alive);
    if (!unit) return;
    const valid = getTargets().some((t) => t.x === x && t.y === y);
    if (!valid) return;

    state.planned[side].push({ cardId: pendingCard, unitId: unit.id, target: { x, y } });
    beep(420, 0.05);
    state.selectedUnit = null;
    pendingCard = null;
    renderAll();
    hint(`${side === 'blue' ? '蓝方' : '红方'}已选 ${state.planned[side].length}/2 张牌。`);
  }

  function getTargets() {
    if (!pendingCard || !state.selectedUnit) return [];
    const unit = state.units.find((u) => u.id === state.selectedUnit && u.alive);
    if (!unit) return [];
    const out = [];
    for (let x = 0; x < 6; x += 1) {
      for (let y = 0; y < 6; y += 1) {
        if (isValidPlan(unit, pendingCard, { x, y })) out.push({ x, y });
      }
    }
    return out;
  }

  function isValidPlan(unit, cardId, target) {
    const d = mht(unit, target);
    const occupied = unitAt(target.x, target.y);
    if (cardId === 'move') return d === 1 && !occupied && !isBlocked(target.x, target.y);
    if (cardId === 'dash') return d > 0 && d <= 2 && !occupied && !isBlocked(target.x, target.y);
    if (cardId === 'assault') return d === 1 && occupied && occupied.side !== unit.side;
    if (cardId === 'pulse') return target.x === unit.x && target.y === unit.y;
    if (cardId === 'barrier') return d === 1 && !occupied && !isBlocked(target.x, target.y);
    return false;
  }

  function undoLast() {
    const arr = state.planned[state.phase];
    if (!arr.length) return;
    arr.pop();
    renderAll();
  }

  async function confirmCurrentSide() {
    if (state.planned[state.phase].length !== 2) {
      hint('当前方必须选满 2 张牌。');
      return;
    }

    if (state.mode === 'pvp' && state.phase === 'blue') {
      state.phase = 'red';
      pendingCard = null;
      state.selectedUnit = null;
      renderAll();
      hint('红方请选牌（同屏对战请避开视线）。');
      return;
    }

    if (state.mode === 'pve' && state.phase === 'blue') {
      state.phase = 'red';
      state.planned.red = buildAiPlans();
    }

    await resolveTurn();
    if (!state.winner) {
      state.phase = 'blue';
      pendingCard = null;
      state.selectedUnit = null;
      renderAll();
      hint('新回合开始：蓝方选牌。');
    }
  }

  async function resolveTurn() {
    state.dashedThisTurn = { blue: {}, red: {} };
    state.logs = [];

    for (let slot = 0; slot < 2; slot += 1) {
      const bluePlan = state.planned.blue[slot];
      const redPlan = state.planned.red[slot];
      if (!bluePlan || !redPlan) continue;

      state.logs.push(`翻牌 ${slot + 1}：蓝[${cardName(bluePlan.cardId)}] vs 红[${cardName(redPlan.cardId)}]`);
      renderLogs();
      await sleep(180 / state.speed);

      const order = state.priority === 'blue' ? ['blue', 'red'] : ['red', 'blue'];
      for (const side of order) {
        const plan = side === 'blue' ? bluePlan : redPlan;
        applyPlan(side, plan);
        renderAll();
        await sleep(220 / state.speed);
      }
    }

    tickBarriers();
    collectEnergy();
    updateCooldowns();
    checkStuck();
    checkWinner();

    if (!state.winner) {
      state.turn += 1;
      state.priority = state.priority === 'blue' ? 'red' : 'blue';
      state.planned = { blue: [], red: [] };
    } else {
      showResult();
    }
  }

  function applyPlan(side, plan) {
    const unit = state.units.find((u) => u.id === plan.unitId && u.alive && u.side === side);
    if (!unit) {
      state.logs.push(`${sideText(side)}行动失效（单位不存在）`);
      return;
    }

    const target = plan.target;
    if (plan.cardId === 'move') {
      if (!isValidPlan(unit, 'move', target)) return;
      unit.x = target.x; unit.y = target.y;
      state.logs.push(`${sideText(side)}${UNIT_CFG[unit.role].name}移动`);
      flash(target.x, target.y, '#7ee5ff');
      beep(460, 0.03);
    }

    if (plan.cardId === 'dash') {
      if (!isValidPlan(unit, 'dash', target)) return;
      unit.x = target.x; unit.y = target.y;
      state.dashedThisTurn[side][unit.id] = true;
      state.logs.push(`${sideText(side)}${UNIT_CFG[unit.role].name}冲刺`);
      flash(target.x, target.y, '#c9a6ff');
      beep(520, 0.04);
    }

    if (plan.cardId === 'assault') {
      if (state.dashedThisTurn[side][unit.id]) {
        state.logs.push(`${sideText(side)}突袭失败（该单位本回合已冲刺）`);
        return;
      }
      const enemy = unitAt(target.x, target.y);
      if (!enemy || enemy.side === side || mht(unit, enemy) !== 1) return;
      enemy.hp -= 1;
      state.logs.push(`${sideText(side)}突袭命中 ${sideText(enemy.side)}${UNIT_CFG[enemy.role].name}`);
      flash(target.x, target.y, '#ff7ea8');
      beep(260, 0.06);
      if (enemy.hp <= 0) { enemy.alive = false; state.logs.push(`${sideText(enemy.side)}${UNIT_CFG[enemy.role].name}被击破`); }
    }

    if (plan.cardId === 'barrier') {
      if (!isValidPlan(unit, 'barrier', target)) return;
      state.barriers[key(target.x, target.y)] = 1;
      state.logs.push(`${sideText(side)}部署屏障`);
      flash(target.x, target.y, '#ffcb6e');
    }

    if (plan.cardId === 'pulse') {
      if (target.x !== unit.x || target.y !== unit.y) return;
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      dirs.forEach(([dx, dy]) => {
        const near = unitAt(unit.x + dx, unit.y + dy);
        if (!near) return;
        const nx = near.x + dx;
        const ny = near.y + dy;
        if (!isBlocked(nx, ny) && !unitAt(nx, ny)) {
          near.x = nx; near.y = ny;
          state.logs.push(`${sideText(side)}脉冲击退了${sideText(near.side)}${UNIT_CFG[near.role].name}`);
          flash(nx, ny, '#9bf26f');
        }
      });
      beep(350, 0.05);
    }
  }

  function tickBarriers() {
    Object.keys(state.barriers).forEach((k) => {
      state.barriers[k] -= 1;
      if (state.barriers[k] <= 0) delete state.barriers[k];
    });
  }

  function collectEnergy() {
    let blueIn = 0; let redIn = 0;
    state.units.filter((u) => u.alive).forEach((u) => {
      if (u.x >= 2 && u.x <= 3 && u.y >= 2 && u.y <= 3) {
        if (u.side === 'blue') blueIn += 1; else redIn += 1;
      }
    });
    if (blueIn > redIn && blueIn > 0) { state.energy.blue += 1; state.logs.push('蓝方夺取中心能量 +1'); }
    if (redIn > blueIn && redIn > 0) { state.energy.red += 1; state.logs.push('红方夺取中心能量 +1'); }
  }

  function updateCooldowns() {
    SIDES.forEach((side) => {
      Object.keys(state.cooldown[side]).forEach((id) => {
        if (state.cooldown[side][id] > 0) state.cooldown[side][id] -= 1;
      });
      state.planned[side].forEach((p) => { state.cooldown[side][p.cardId] = 1; });
    });
  }

  function hasAnyValid(side) {
    const alive = state.units.filter((u) => u.alive && u.side === side);
    if (!alive.length) return false;
    for (const u of alive) {
      for (const c of CARDS) {
        if (state.cooldown[side][c.id] > 0) continue;
        for (let x = 0; x < 6; x += 1) for (let y = 0; y < 6; y += 1) if (isValidPlan(u, c.id, { x, y })) return true;
      }
    }
    return false;
  }

  function checkStuck() {
    SIDES.forEach((side) => {
      state.stuck[side] = hasAnyValid(side) ? 0 : state.stuck[side] + 1;
    });
  }

  function checkWinner() {
    const blueCore = state.units.find((u) => u.id === 'blue-core');
    const redCore = state.units.find((u) => u.id === 'red-core');
    if (!blueCore.alive) return setWinner('red', '击破蓝方核心体');
    if (!redCore.alive) return setWinner('blue', '击破红方核心体');
    if (state.energy.blue >= 3) return setWinner('blue', '累计 3 点中心能量');
    if (state.energy.red >= 3) return setWinner('red', '累计 3 点中心能量');
    if (state.stuck.blue >= 1) return setWinner('red', '蓝方连续一回合无有效行动');
    if (state.stuck.red >= 1) return setWinner('blue', '红方连续一回合无有效行动');
  }

  function setWinner(side, reason) {
    state.winner = side;
    state.winnerReason = reason;
  }

  function showResult() {
    $('result-title').textContent = state.winner === 'blue' ? '蓝方胜利' : '红方胜利';
    $('result-text').textContent = state.winnerReason;
    $('result-modal').classList.remove('hidden');
  }

  function buildAiPlans() {
    const ai = 'red';
    const plans = [];
    const used = {};
    for (let slot = 0; slot < 2; slot += 1) {
      let best = null;
      let bestScore = -1e9;
      const units = state.units.filter((u) => u.alive && u.side === ai);
      for (const card of CARDS) {
        if (state.cooldown[ai][card.id] > 0 || used[card.id]) continue;
        for (const u of units) {
          for (let x = 0; x < 6; x += 1) {
            for (let y = 0; y < 6; y += 1) {
              const target = { x, y };
              if (!isValidPlan(u, card.id, target)) continue;
              const score = scoreAiPlan(u, card.id, target);
              if (score > bestScore) {
                bestScore = score;
                best = { cardId: card.id, unitId: u.id, target };
              }
            }
          }
        }
      }
      if (!best) {
        const fallback = units[0];
        best = { cardId: 'pulse', unitId: fallback.id, target: { x: fallback.x, y: fallback.y } };
      }
      used[best.cardId] = true;
      plans.push(best);
    }
    return plans;
  }

  function scoreAiPlan(unit, cardId, target) {
    const center = { x: 2.5, y: 2.5 };
    const blueCore = state.units.find((u) => u.id === 'blue-core' && u.alive);
    const redCore = state.units.find((u) => u.id === 'red-core' && u.alive);
    let s = 0;

    if (cardId === 'assault') {
      const enemy = unitAt(target.x, target.y);
      if (!enemy) return -999;
      s += enemy.role === 'core' ? 220 : 90;
      if (enemy.hp === 1) s += 50;
    }

    if (cardId === 'move' || cardId === 'dash') {
      s += 16 - (Math.abs(target.x - center.x) + Math.abs(target.y - center.y)) * 2;
      if (blueCore) s += 8 - mht(target, blueCore);
      if (redCore && unit.role === 'core') s += mht(target, redCore) * 1.5;
      if (cardId === 'dash') s += 4;
    }

    if (cardId === 'barrier') {
      if (blueCore) s += 10 - mht(target, blueCore) * 1.2;
      s += (target.x >= 2 && target.x <= 3 && target.y >= 2 && target.y <= 3) ? 8 : 0;
    }

    if (cardId === 'pulse') {
      const around = [[1,0],[-1,0],[0,1],[0,-1]];
      around.forEach(([dx,dy]) => {
        const e = unitAt(unit.x + dx, unit.y + dy);
        if (e && e.side === 'blue') s += e.role === 'core' ? 35 : 18;
      });
    }

    if (state.difficulty === 'easy') s *= 0.7;
    if (state.difficulty === 'hard') s *= 1.15;
    return s;
  }

  function cardName(id) { return (CARDS.find((c) => c.id === id) || { name: id }).name; }
  function sideText(s) { return s === 'blue' ? '蓝' : '红'; }

  function hint(text) { $('hint').textContent = text; }

  function flash(x, y, color) {
    const cell = [...document.querySelectorAll('.cell')].find((c) => Number(c.dataset.x) === x && Number(c.dataset.y) === y);
    if (!cell) return;
    cell.style.boxShadow = `0 0 18px ${color}`;
    setTimeout(() => { cell.style.boxShadow = ''; }, 120);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let audioCtx;
  function beep(freq, dur) {
    if (!state || !state.soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq; gain.gain.value = 0.02;
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  initMenuEvents();
})();
