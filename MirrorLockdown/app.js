(() => {
  const W = 7; const H = 5;
  const SIDES = ['blue', 'red'];

  const CARD_POOL = {
    iron_guard: { name: '铁壁守卫', type: 'minion', cost: 3, atk: 1, hp: 6, move: 1, range: 1, keywords: ['守卫'], desc: '前排护核盾墙。' },
    crystal_archer: { name: '水晶弓手', type: 'minion', cost: 3, atk: 2, hp: 3, move: 2, range: 3, keywords: [], desc: '远程稳定输出。' },
    sky_lancer: { name: '裂空骑兵', type: 'minion', cost: 4, atk: 3, hp: 3, move: 3, range: 1, keywords: ['突袭'], desc: '高机动突入。' },
    phase_mage: { name: '相位法师', type: 'minion', cost: 4, atk: 2, hp: 3, move: 2, range: 2, keywords: ['亡语'], desc: '登场对周围敌人造成 1 点伤害。' },
    repair_bot: { name: '修复机仆', type: 'minion', cost: 2, atk: 1, hp: 3, move: 2, range: 1, keywords: [], desc: '登场可治疗友方 2 点。' },
    guardian_drone: { name: '棱盾无人机', type: 'minion', cost: 2, atk: 1, hp: 2, move: 3, range: 1, keywords: ['飞行','护盾'], desc: '机动骚扰，首伤免疫。' },
    warp_blade: { name: '折跃刃客', type: 'minion', cost: 5, atk: 4, hp: 4, move: 2, range: 1, keywords: ['冲锋'], desc: '落地即可压制。' },
    rail_sniper: { name: '贯轨狙击手', type: 'minion', cost: 5, atk: 3, hp: 3, move: 1, range: 4, keywords: ['穿透'], desc: '直线穿透首目标后继续伤害。' },
    combo_twin: { name: '双脉连击者', type: 'minion', cost: 4, atk: 2, hp: 4, move: 2, range: 1, keywords: ['连击'], desc: '每回合可攻击两次。' },
    anchor_warden: { name: '锚点守望', type: 'minion', cost: 3, atk: 1, hp: 4, move: 1, range: 1, keywords: ['守卫','光环'], desc: '周围友军 +1 攻击。' },

    shockwave: { name: '震荡术', type: 'spell', cost: 2, targeting: 'enemyUnit', desc: '将目标击退 1 格。' },
    freeze_ray: { name: '冰封术', type: 'spell', cost: 2, targeting: 'enemyUnit', desc: '冻结目标 1 回合。' },
    arc_barrier: { name: '奥能屏障', type: 'terrain', cost: 2, targeting: 'empty', desc: '生成持续 2 回合障碍。' },
    overload_core: { name: '过载核心', type: 'spell', cost: 1, targeting: 'allyUnit', desc: '友方单位本局 +1 攻击。' },
    coin: { name: '幸运币', type: 'spell', cost: 0, targeting: 'none', desc: '本回合 +1 法力。' },
    pulse_mine: { name: '脉冲地雷', type: 'terrain', cost: 1, targeting: 'empty', desc: '敌方踏入时受 1 伤害。' },
    draw_sync: { name: '同步抽取', type: 'spell', cost: 2, targeting: 'none', desc: '抽 2 张牌。' },
    crystal_patch: { name: '晶核修补', type: 'spell', cost: 2, targeting: 'allyCore', desc: '己方水晶回复 3。' },
  };

  const key = (x, y) => `${x},${y}`;
  const $ = (id) => document.getElementById(id);
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  function createDefaultState() {
    return {
      board: [],
      players: {
        blue: { mana: 1, maxMana: 1, deck: [], hand: [], coreHp: 20, heroSkillUsed: false },
        red: { mana: 1, maxMana: 1, deck: [], hand: [], coreHp: 20, heroSkillUsed: false },
      },
      hands: { blue: [], red: [] },
      decks: { blue: [], red: [] },
      crystals: { blue: 20, red: 20 },
      mana: {
        blue: { current: 1, max: 1 },
        red: { current: 1, max: 1 },
      },
      turn: 1,
      currentPlayer: 'blue',
      phase: 'main',
      selectedUnit: null,
      winner: null,
      logs: [],
      mode: 'pvp',
      difficulty: 'normal',
      sound: true,
      units: [],
      terrain: {},
      pendingCast: null,
      actionMode: null,
      current: 'blue',
    };
  }

  let state = createDefaultState();

  function makeDeck() {
    return shuffle([
      'iron_guard','iron_guard','crystal_archer','crystal_archer','sky_lancer','phase_mage','repair_bot','guardian_drone',
      'warp_blade','rail_sniper','combo_twin','anchor_warden',
      'shockwave','shockwave','freeze_ray','arc_barrier','overload_core','pulse_mine','draw_sync','crystal_patch'
    ]);
  }

  function initState(opts) {
    const blueDeck = makeDeck();
    const redDeck = makeDeck();
    const s = {
      ...createDefaultState(),
      mode: opts.mode,
      difficulty: opts.difficulty,
      sound: opts.sound,
      turn: 1,
      current: opts.first,
      players: {
        blue: { mana: 0, maxMana: 0, deck: blueDeck, hand: [], coreHp: 20, heroSkillUsed: false },
        red: { mana: 0, maxMana: 0, deck: redDeck, hand: [], coreHp: 20, heroSkillUsed: false },
      },
      units: [],
      terrain: seedTerrain(),
      pendingCast: null,
      selectedUnit: null,
      actionMode: null,
      logs: [],
      winner: null,
    };
    for (let i = 0; i < 4; i += 1) { drawCard(s, 'blue', 1); drawCard(s, 'red', 1); }
    const second = opts.first === 'blue' ? 'red' : 'blue';
    s.players[second].hand.push('coin');
    syncDerivedState(s);
    startTurn(s, s.current, true);
    syncDerivedState(s);
    return s;
  }

  function syncDerivedState(s) {
    s.currentPlayer = s.current;
    s.phase = 'main';
    s.hands = { blue: s.players.blue.hand, red: s.players.red.hand };
    s.decks = { blue: s.players.blue.deck, red: s.players.red.deck };
    s.crystals = { blue: s.players.blue.coreHp, red: s.players.red.coreHp };
    s.mana = {
      blue: { current: s.players.blue.mana, max: s.players.blue.maxMana },
      red: { current: s.players.red.mana, max: s.players.red.maxMana },
    };
    s.board = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ({ x, y })));
    return s;
  }

  function seedTerrain() {
    const t = {};
    let pairs = 0;
    while (pairs < 3) {
      const x = 1 + Math.floor(Math.random() * 2);
      const y = Math.floor(Math.random() * H);
      const a = key(x, y);
      const b = key(W - 1 - x, y);
      if (!t[a] && !t[b] && !(x === 1 && y === 2) && !(W - 1 - x === 5 && y === 2)) {
        t[a] = { type: 'rock', ttl: 99, side: null };
        t[b] = { type: 'rock', ttl: 99, side: null };
        pairs += 1;
      }
    }
    return t;
  }

  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function sideTxt(s) { return s === 'blue' ? '蓝' : '红'; }

  function drawCard(s, side, n) {
    for (let i = 0; i < n; i += 1) {
      const p = s.players[side];
      if (p.deck.length) p.hand.push(p.deck.shift());
    }
  }

  function startTurn(s, side, initial) {
    const p = s.players[side];
    if (!initial) p.maxMana = Math.min(10, p.maxMana + 1);
    if (initial && p.maxMana === 0) p.maxMana = 1;
    p.mana = p.maxMana;
    drawCard(s, side, 1);
    s.pendingCast = null;
    s.selectedUnit = null;
    s.actionMode = null;

    s.units.filter((u) => u.side === side && u.alive).forEach((u) => {
      u.moved = false;
      u.frozen = Math.max(0, (u.frozen || 0) - 1);
      u.summonSick = u.summonSick ? 0 : 0;
      const baseAtkCount = u.keywords.includes('连击') ? 2 : 1;
      u.attacksLeft = baseAtkCount;
      if (u.justSummoned) {
        const canAct = u.keywords.includes('冲锋') || u.keywords.includes('突袭');
        if (!canAct) u.attacksLeft = 0;
        if (!u.keywords.includes('冲锋')) u.moved = true;
        u.justSummoned = false;
      }
    });

    pushLog(s, `${sideTxt(side)}方回合开始：法力 ${p.mana}/${p.maxMana}`);
  }

  function endTurn() {
    if (state.winner) return;
    tickTerrain();
    const next = state.current === 'blue' ? 'red' : 'blue';
    if (state.current === 'red') state.turn += 1;
    state.current = next;
    startTurn(state, next, false);
    syncDerivedState(state);
    renderAll();
    if (state.mode === 'pve' && state.current === 'red' && !state.winner) {
      setTimeout(aiTurn, 300);
    }
  }

  function tickTerrain() {
    Object.keys(state.terrain).forEach((k) => {
      const t = state.terrain[k];
      if (!t) return;
      if (t.ttl < 90) {
        t.ttl -= 1;
        if (t.ttl <= 0) delete state.terrain[k];
      }
    });
  }

  function summonZone(side, x) { return side === 'blue' ? x === 1 : x === W - 2; }
  function unitAt(x, y) { return state.units.find((u) => u.alive && u.x === x && u.y === y); }
  function terrainAt(x, y) { return state.terrain[key(x, y)]; }

  function canMoveThrough(unit, x, y) {
    if (!inBoard(x, y)) return false;
    if (unit.keywords.includes('飞行')) return !unitAt(x, y);
    const t = terrainAt(x, y);
    if (t && (t.type === 'rock' || t.type === 'barrier')) return false;
    return !unitAt(x, y);
  }

  function auraAtkBonus(unit) {
    let bonus = 0;
    state.units.filter((u) => u.alive && u.side === unit.side && u.keywords.includes('光环')).forEach((a) => {
      if (Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y) <= 1 && a.id !== unit.id) bonus += 1;
    });
    return bonus;
  }

  function attackableTargets(attacker) {
    const enemySide = attacker.side === 'blue' ? 'red' : 'blue';
    const guards = state.units.filter((u) => u.alive && u.side === enemySide && u.keywords.includes('守卫'));
    const enemies = state.units.filter((u) => u.alive && u.side === enemySide);
    return enemies.filter((e) => {
      const inRange = Math.abs(e.x - attacker.x) + Math.abs(e.y - attacker.y) <= attacker.range;
      if (!inRange) return false;
      if (guards.length && !e.keywords.includes('守卫')) return false;
      if (attacker.justSummonedRushOnly && e.type === 'core') return false;
      return true;
    });
  }

  function corePos(side) { return side === 'blue' ? { x: 0, y: 2 } : { x: W - 1, y: 2 }; }

  function canAttackCore(attacker) {
    const enemy = attacker.side === 'blue' ? 'red' : 'blue';
    if (state.units.some((u) => u.alive && u.side === enemy && u.keywords.includes('守卫'))) return false;
    if (attacker.justSummonedRushOnly) return false;
    const cp = corePos(enemy);
    return Math.abs(cp.x - attacker.x) + Math.abs(cp.y - attacker.y) <= attacker.range;
  }

  function playCard(handIdx) {
    const side = state.current;
    const player = state.players[side];
    const cardId = player.hand[handIdx];
    const card = CARD_POOL[cardId];
    if (!card || player.mana < card.cost) return;

    if (card.type === 'spell' && card.targeting === 'none') {
      castNoTarget(cardId, side);
      player.hand.splice(handIdx, 1);
      player.mana -= card.cost;
      renderAll();
      return;
    }

    state.pendingCast = { handIdx, cardId, side };
    state.selectedUnit = null;
    state.actionMode = null;
    hint(`选择目标：${card.name}`);
    renderBoard();
  }

  function castNoTarget(cardId, side) {
    if (cardId === 'coin') {
      state.players[side].mana += 1;
      pushLog(state, `${sideTxt(side)}使用幸运币，法力 +1`);
      beep(520, 0.05);
    }
    if (cardId === 'draw_sync') {
      drawCard(state, side, 2);
      pushLog(state, `${sideTxt(side)}抽 2 张牌`);
    }
  }

  function onBoardClick(x, y) {
    const side = state.current;
    const player = state.players[side];

    if (state.pendingCast && state.pendingCast.side === side) {
      const card = CARD_POOL[state.pendingCast.cardId];
      if (player.mana < card.cost) return;
      if (!resolveCast(card, side, x, y)) return;
      player.mana -= card.cost;
      player.hand.splice(state.pendingCast.handIdx, 1);
      state.pendingCast = null;
      renderAll();
      return;
    }

    const u = unitAt(x, y);
    if (u && u.side === side) {
      state.selectedUnit = u.id;
      hint(`选中 ${u.name}，可进行移动/攻击。`);
      renderAll();
      return;
    }

    if (!state.selectedUnit) return;
    const unit = state.units.find((it) => it.id === state.selectedUnit && it.alive);
    if (!unit || unit.side !== side) return;

    if (state.actionMode === 'move') {
      if (unit.moved || unit.frozen > 0) return;
      const dist = Math.abs(unit.x - x) + Math.abs(unit.y - y);
      if (dist <= unit.move && canMoveThrough(unit, x, y)) {
        unit.x = x; unit.y = y; unit.moved = true;
        checkMine(unit);
        pushLog(state, `${sideTxt(side)}${unit.name}移动`);
        beep(460, 0.04);
      }
      renderAll();
    }

    if (state.actionMode === 'attack' && unit.attacksLeft > 0) {
      const target = unitAt(x, y);
      if (target && target.side !== side) {
        if (attackableTargets(unit).some((t) => t.id === target.id)) {
          hitUnit(unit, target);
          unit.attacksLeft -= 1;
          renderAll();
        }
      } else {
        const cp = corePos(side === 'blue' ? 'red' : 'blue');
        if (x === cp.x && y === cp.y && canAttackCore(unit)) {
          const dmg = unit.atk + auraAtkBonus(unit);
          state.players[side === 'blue' ? 'red' : 'blue'].coreHp -= dmg;
          unit.attacksLeft -= 1;
          pushLog(state, `${sideTxt(side)}${unit.name}攻击敌方水晶 ${dmg} 点`);
          flashCell(x, y, '#ff9f5b');
          beep(230, 0.07);
          checkWinner();
          renderAll();
        }
      }
    }
  }

  function resolveCast(card, side, x, y) {
    const target = unitAt(x, y);

    if (card.type === 'minion') {
      if (!summonZone(side, x) || y < 0 || y >= H || target || terrainAt(x, y)) return false;
      const u = {
        id: `${side}-${Date.now()}-${Math.random()}`,
        side,
        name: card.name,
        type: 'unit',
        x, y,
        hp: card.hp,
        maxHp: card.hp,
        atk: card.atk,
        move: card.move,
        range: card.range,
        keywords: [...card.keywords],
        desc: card.desc,
        alive: true,
        moved: true,
        attacksLeft: 0,
        justSummoned: true,
        justSummonedRushOnly: card.keywords.includes('突袭') && !card.keywords.includes('冲锋'),
        shield: card.keywords.includes('护盾'),
        frozen: 0,
        deathrattle: card.name === '相位法师',
      };
      state.units.push(u);
      pushLog(state, `${sideTxt(side)}召唤 ${card.name}`);
      flashCell(x, y, '#7ecbff');
      beep(530, 0.05);
      onSummonEffect(u, side);
      return true;
    }

    if (card.type === 'spell' || card.type === 'terrain') {
      if (card.name === '震荡术') {
        if (!target || target.side === side) return false;
        pushUnit(target, side === 'blue' ? 1 : -1, 0);
        pushLog(state, `${sideTxt(side)}施放震荡术`);
        return true;
      }
      if (card.name === '冰封术') {
        if (!target || target.side === side) return false;
        target.frozen = 1;
        pushLog(state, `${sideTxt(side)}冰封 ${target.name}`);
        return true;
      }
      if (card.name === '奥能屏障') {
        if (target || terrainAt(x, y) || !inBoard(x, y)) return false;
        state.terrain[key(x, y)] = { type: 'barrier', ttl: 2, side };
        pushLog(state, `${sideTxt(side)}生成奥能屏障`);
        return true;
      }
      if (card.name === '过载核心') {
        if (!target || target.side !== side) return false;
        target.atk += 1;
        pushLog(state, `${sideTxt(side)}强化 ${target.name} 攻击 +1`);
        return true;
      }
      if (card.name === '晶核修补') {
        const cp = corePos(side);
        if (x !== cp.x || y !== cp.y) return false;
        state.players[side].coreHp = Math.min(20, state.players[side].coreHp + 3);
        pushLog(state, `${sideTxt(side)}水晶回复 3`);
        return true;
      }
      if (card.name === '脉冲地雷') {
        if (target || terrainAt(x, y) || !inBoard(x, y)) return false;
        state.terrain[key(x, y)] = { type: 'mine', ttl: 3, side };
        pushLog(state, `${sideTxt(side)}部署脉冲地雷`);
        return true;
      }
    }
    return false;
  }

  function onSummonEffect(u, side) {
    if (u.name === '相位法师') {
      state.units.filter((e) => e.alive && e.side !== side && Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= 1).forEach((e) => hitRaw(e, 1, `相位爆裂命中${e.name}`));
    }
    if (u.name === '修复机仆') {
      const target = state.units.find((a) => a.alive && a.side === side && a.hp < a.maxHp);
      if (target) {
        target.hp = Math.min(target.maxHp, target.hp + 2);
        pushLog(state, `${u.name}修复 ${target.name} 2 点`);
      } else {
        state.players[side].coreHp = Math.min(20, state.players[side].coreHp + 2);
        pushLog(state, `${u.name}修复己方水晶 2 点`);
      }
    }
  }

  function pushUnit(u, dx, dy) {
    const nx = u.x + dx; const ny = u.y + dy;
    if (!inBoard(nx, ny) || unitAt(nx, ny) || terrainAt(nx, ny)) return;
    u.x = nx; u.y = ny;
    flashCell(nx, ny, '#b8ff72');
  }

  function hitUnit(attacker, target) {
    const dmg = attacker.atk + auraAtkBonus(attacker);
    if (attacker.keywords.includes('穿透')) {
      hitRaw(target, dmg, `${attacker.name}穿透射击`);
      const dirX = Math.sign(target.x - attacker.x); const dirY = Math.sign(target.y - attacker.y);
      const nx = target.x + dirX; const ny = target.y + dirY;
      const second = unitAt(nx, ny);
      if (second && second.side !== attacker.side) hitRaw(second, Math.max(1, dmg - 1), `${attacker.name}穿透余波`);
    } else {
      hitRaw(target, dmg, `${attacker.name}攻击${target.name}`);
    }
    beep(250, 0.05);
  }

  function hitRaw(target, dmg, logText) {
    if (!target.alive) return;
    if (target.shield) {
      target.shield = false;
      pushLog(state, `${target.name}护盾抵消伤害`);
      return;
    }
    target.hp -= dmg;
    flashCell(target.x, target.y, '#ff789e');
    pushLog(state, `${logText}，造成 ${dmg}`);
    if (target.hp <= 0) killUnit(target);
  }

  function killUnit(u) {
    u.alive = false;
    pushLog(state, `${u.name}被击破`);
    if (u.deathrattle) {
      state.units.filter((a) => a.alive && a.side !== u.side && Math.abs(a.x - u.x) + Math.abs(a.y - u.y) <= 1).forEach((a) => hitRaw(a, 1, `${u.name}亡语震荡`));
    }
  }

  function checkMine(unit) {
    const t = terrainAt(unit.x, unit.y);
    if (t && t.type === 'mine' && t.side !== unit.side) {
      delete state.terrain[key(unit.x, unit.y)];
      hitRaw(unit, 1, `${unit.name}触发脉冲地雷`);
    }
  }

  function checkWinner() {
    if (state.players.blue.coreHp <= 0) state.winner = 'red';
    if (state.players.red.coreHp <= 0) state.winner = 'blue';
    if (state.winner) {
      $('result-title').textContent = `${sideTxt(state.winner)}方胜利`;
      $('result-text').textContent = `摧毁了${sideTxt(state.winner === 'blue' ? 'red' : 'blue')}方水晶`;
      $('result-modal').classList.remove('hidden');
    }
  }

  function aiTurn() {
    if (state.current !== 'red' || state.winner) return;
    const side = 'red';
    const player = state.players.red;

    // 出牌阶段：优先曲线、击杀、抢位
    let safety = 0;
    while (safety < 20) {
      safety += 1;
      const playable = player.hand.map((id, i) => ({ id, i, card: CARD_POOL[id] })).filter((c) => c.card && c.card.cost <= player.mana);
      if (!playable.length) break;
      let acted = false;

      // 优先法术击杀
      const shock = playable.find((c) => c.id === 'shockwave');
      if (shock) {
        const target = state.units.find((u) => u.alive && u.side === 'blue' && (u.name.includes('守卫') || u.hp <= 2));
        if (target) {
          state.pendingCast = { handIdx: shock.i, cardId: shock.id, side };
          resolveCast(CARD_POOL.shockwave, side, target.x, target.y);
          player.hand.splice(shock.i, 1); player.mana -= CARD_POOL.shockwave.cost; acted = true;
        }
      }

      if (!acted) {
        const summon = playable.filter((c) => c.card.type === 'minion').sort((a, b) => b.card.cost - a.card.cost)[0];
        if (summon) {
          const pos = findSummonPos(side);
          if (pos) {
            state.pendingCast = { handIdx: summon.i, cardId: summon.id, side };
            resolveCast(summon.card, side, pos.x, pos.y);
            player.hand.splice(summon.i, 1); player.mana -= summon.card.cost; acted = true;
          }
        }
      }

      if (!acted) break;
    }

    // 行动阶段：先攻击再移动到中心/前线
    state.units.filter((u) => u.alive && u.side === side).forEach((u) => {
      if (u.frozen > 0) return;
      while (u.attacksLeft > 0) {
        const target = attackableTargets(u).sort((a, b) => (a.name.includes('守卫') ? -3 : 0) - (b.name.includes('守卫') ? -3 : 0) + a.hp - b.hp)[0];
        if (target) {
          hitUnit(u, target); u.attacksLeft -= 1;
        } else if (canAttackCore(u)) {
          const dmg = u.atk + auraAtkBonus(u);
          state.players.blue.coreHp -= dmg;
          pushLog(state, `红方${u.name}攻击蓝方水晶 ${dmg}`);
          u.attacksLeft -= 1;
          checkWinner();
          if (state.winner) break;
        } else break;
      }

      if (!u.moved && u.frozen <= 0) {
        const steps = neighborCells(u.x, u.y).filter((c) => canMoveThrough(u, c.x, c.y));
        if (steps.length) {
          const best = steps.sort((a, b) => scorePos('red', b.x, b.y) - scorePos('red', a.x, a.y))[0];
          u.x = best.x; u.y = best.y; u.moved = true; checkMine(u);
        }
      }
    });

    checkWinner();
    renderAll();
    if (!state.winner) setTimeout(endTurn, 350);
  }

  function scorePos(side, x, y) {
    const enemyCore = corePos(side === 'blue' ? 'red' : 'blue');
    return -Math.abs(enemyCore.x - x) - Math.abs(enemyCore.y - y) + (x >= 2 && x <= 4 ? 1.5 : 0);
  }

  function findSummonPos(side) {
    const col = side === 'blue' ? 1 : W - 2;
    const cells = [];
    for (let y = 0; y < H; y += 1) {
      if (!unitAt(col, y) && !terrainAt(col, y)) cells.push({ x: col, y });
    }
    return cells[0] || null;
  }

  function neighborCells(x, y) {
    return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].filter((c) => inBoard(c.x, c.y));
  }

  function renderAll() {
    const s = state || createDefaultState();
    syncDerivedState(s);
    $('turn-label').textContent = String(s.turn || 1);
    $('side-label').textContent = `${sideTxt(s.current || 'blue')}方`;
    const side = s.current || 'blue';
    const mp = (s.players && s.players[side]) ? s.players[side] : { mana: 0, maxMana: 0 };
    $('mana-label').textContent = `${mp.mana}/${mp.maxMana}`;
    $('blue-core').textContent = String((s.players && s.players.blue && s.players.blue.coreHp) || 20);
    $('red-core').textContent = String((s.players && s.players.red && s.players.red.coreHp) || 20);
    $('deck-count').textContent = `蓝 ${((s.players&&s.players.blue&&s.players.blue.deck)||[]).length} 张 / 红 ${((s.players&&s.players.red&&s.players.red.deck)||[]).length} 张`;
    $('status-box').textContent = `当前模式：${s.mode === 'pve' ? 'PVE' : 'PVP'}，AI：${s.difficulty || 'normal'}`;

    renderBoard();
    renderHand();
    renderDetail();
    renderLogs();
  }

  function renderBoard() {
    const board = $('board');
    board.innerHTML = '';
    if (!state) {
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        board.appendChild(cell);
      }
      return;
    }
    const moveTargets = getMoveTargets();
    const attackTargets = getAttackTargets();
    const castTargets = getCastTargets();

    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        const t = terrainAt(x, y);
        if (t && (t.type === 'rock' || t.type === 'barrier')) cell.classList.add('obstacle');
        if (summonZone('blue', x)) cell.classList.add('spawn-blue');
        if (summonZone('red', x)) cell.classList.add('spawn-red');
        const bCore = corePos('blue'); const rCore = corePos('red');
        if (x === bCore.x && y === bCore.y) cell.classList.add('crystal-blue');
        if (x === rCore.x && y === rCore.y) cell.classList.add('crystal-red');

        if (moveTargets.some((p) => p.x === x && p.y === y) || attackTargets.some((p) => p.x === x && p.y === y) || castTargets.some((p) => p.x === x && p.y === y)) cell.classList.add('target');

        const u = unitAt(x, y);
        if (u) {
          const ue = document.createElement('div');
          ue.className = `unit ${u.side}`;
          if (u.frozen > 0 || (u.moved && u.attacksLeft <= 0)) ue.classList.add('exhausted');
          ue.textContent = `${u.name.slice(0,2)} ${u.hp}`;
          const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = `攻${u.atk}`; ue.appendChild(bd);
          cell.appendChild(ue);
        }

        cell.onclick = () => onBoardClick(x, y);
        board.appendChild(cell);
      }
    }
  }

  function renderHand() {
    if (!state) {
      $('hand-list').innerHTML = '<div class="card unplayable">当前无手牌</div>';
      return;
    }
    const side = state.current;
    const p = state.players[side];
    const hand = $('hand-list');
    hand.innerHTML = '';
    const handArr = p && p.hand ? p.hand : [];
    if (!handArr.length) {
      $('hand-list').innerHTML = '<div class="card unplayable">当前无手牌</div>';
      return;
    }
    handArr.forEach((id, idx) => {
      const c = CARD_POOL[id];
      if (!c) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'card';
      if (p.mana < c.cost) item.classList.add('unplayable');
      item.innerHTML = `<h4>${c.name} [${c.cost}]</h4><div>${c.type}</div><div>${c.desc}</div>`;
      item.onclick = () => playCard(idx);
      hand.appendChild(item);
    });
  }

  function renderDetail() {
    if (!state.selectedUnit) { $('unit-detail').textContent = '未选择单位'; return; }
    const u = state.units.find((x) => x.id === state.selectedUnit && x.alive);
    if (!u) { $('unit-detail').textContent = '未选择单位'; return; }
    $('unit-detail').innerHTML = `<b>${u.name}</b><br/>ATK ${u.atk} / HP ${u.hp}/${u.maxHp}<br/>移动 ${u.move} / 射程 ${u.range}<br/>关键词：${u.keywords.join('、') || '无'}<br/>状态：${u.frozen>0?'冻结 ':''}${u.shield?'护盾':''}`;
  }

  function renderLogs() {
    const ul = $('logs'); ul.innerHTML = '';
    const logs = (state && Array.isArray(state.logs)) ? state.logs : [];
    if (!logs.length) {
      const li = document.createElement('li');
      li.textContent = '暂无战斗日志';
      ul.appendChild(li);
      return;
    }
    logs.slice(-9).forEach((l) => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
  }

  function getMoveTargets() {
    if (state.actionMode !== 'move' || !state.selectedUnit) return [];
    const u = state.units.find((x) => x.id === state.selectedUnit && x.alive);
    if (!u || u.side !== state.current || u.moved || u.frozen > 0) return [];
    const out = [];
    for (let x = 0; x < W; x += 1) for (let y = 0; y < H; y += 1) if (Math.abs(u.x - x) + Math.abs(u.y - y) <= u.move && canMoveThrough(u, x, y)) out.push({ x, y });
    return out;
  }

  function getAttackTargets() {
    if (state.actionMode !== 'attack' || !state.selectedUnit) return [];
    const u = state.units.find((x) => x.id === state.selectedUnit && x.alive);
    if (!u || u.side !== state.current || u.attacksLeft <= 0 || u.frozen > 0) return [];
    const arr = attackableTargets(u).map((t) => ({ x: t.x, y: t.y }));
    if (canAttackCore(u)) arr.push(corePos(u.side === 'blue' ? 'red' : 'blue'));
    return arr;
  }

  function getCastTargets() {
    if (!state.pendingCast) return [];
    const c = CARD_POOL[state.pendingCast.cardId];
    const side = state.pendingCast.side;
    const out = [];
    for (let x = 0; x < W; x += 1) {
      for (let y = 0; y < H; y += 1) {
        const u = unitAt(x, y);
        if (c.type === 'minion' && summonZone(side, x) && !u && !terrainAt(x, y)) out.push({ x, y });
        if (c.targeting === 'enemyUnit' && u && u.side !== side) out.push({ x, y });
        if (c.targeting === 'allyUnit' && u && u.side === side) out.push({ x, y });
        if (c.targeting === 'empty' && !u && !terrainAt(x, y)) out.push({ x, y });
      }
    }
    if (c.targeting === 'allyCore') out.push(corePos(side));
    return out;
  }

  function hint(msg) { $('hint').textContent = msg; }
  function pushLog(s, msg) {
    if (!s) return;
    if (!Array.isArray(s.logs)) s.logs = [];
    s.logs.push(msg);
  }
  function log(msg) { pushLog(state, msg); }

  function flashCell(x, y, color) {
    const cell = [...document.querySelectorAll('.cell')][y * W + x];
    if (!cell) return;
    cell.style.boxShadow = `0 0 16px ${color}`;
    setTimeout(() => { cell.style.boxShadow = ''; }, 150);
  }

  let audioCtx;
  function beep(freq, dur) {
    if (!state || !state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'triangle'; o.frequency.value = freq; g.gain.value = 0.02; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function bindMenu() {
    $('start-btn').onclick = () => {
      try {
        state = initState({ mode: $('mode-select').value, first: $('first-select').value, difficulty: $('difficulty-select').value, sound: $('sound-select').value === 'on' });
        $('runtime-error').classList.add('hidden');
        switchScreen('game-screen');
        renderAll();
        if (state.mode === 'pve' && state.current === 'red') setTimeout(aiTurn, 300);
      } catch (e) {
        state = createDefaultState();
        switchScreen('game-screen');
        $('runtime-error').classList.remove('hidden');
        $('runtime-error').textContent = `初始化失败：${e.message || e}`;
        renderAll();
      }
    };
    $('rules-btn').onclick = () => $('rules-modal').classList.remove('hidden');
    $('rules-close').onclick = () => $('rules-modal').classList.add('hidden');
    $('rules-mask').onclick = () => $('rules-modal').classList.add('hidden');
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('rules-modal').classList.add('hidden'); $('result-modal').classList.add('hidden'); } });

    $('end-turn-btn').onclick = endTurn;
    $('restart-btn').onclick = () => $('start-btn').click();
    $('menu-btn').onclick = () => switchScreen('menu-screen');
    $('move-mode-btn').onclick = () => { state.actionMode = 'move'; hint('移动模式：点高亮格移动。'); renderBoard(); };
    $('attack-mode-btn').onclick = () => { state.actionMode = 'attack'; hint('攻击模式：点高亮目标攻击。'); renderBoard(); };
    $('cancel-mode-btn').onclick = () => { state.actionMode = null; state.pendingCast = null; hint('已取消当前操作。'); renderBoard(); };
    $('result-mask').onclick = () => $('result-modal').classList.add('hidden');
    $('result-restart').onclick = () => { $('result-modal').classList.add('hidden'); $('start-btn').click(); };
    $('result-menu').onclick = () => { $('result-modal').classList.add('hidden'); switchScreen('menu-screen'); };
  }

  function switchScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  bindMenu();
})();
