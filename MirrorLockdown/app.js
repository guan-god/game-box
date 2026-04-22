(() => {
  const W = 7; const H = 5;
  const SIDES = ['blue', 'red'];

  const CARD_POOL = {
    // 随从（12）
    bulwark_guard: { name: '晶壁守卫', type: 'minion', cost: 3, atk: 1, hp: 6, move: 1, range: 1, keywords: ['守卫'], role: '护脸', desc: '守卫前排，稳住阵线。' },
    grave_engineer: { name: '墓光工程师', type: 'minion', cost: 2, atk: 2, hp: 2, move: 2, range: 1, keywords: ['亡语'], role: '亡语铺场', deathrattle: 'spawn_shard', desc: '亡语：召唤1/1晶片。' },
    prism_archer: { name: '棱镜弓手', type: 'minion', cost: 3, atk: 2, hp: 3, move: 2, range: 3, keywords: ['远程'], role: '解场', desc: '远程稳定清场。' },
    sky_raider: { name: '裂空袭骑', type: 'minion', cost: 4, atk: 3, hp: 3, move: 3, range: 1, keywords: ['突袭'], role: '抢节奏', desc: '召唤回合可打敌方随从。' },
    warp_executor: { name: '折跃处刑者', type: 'minion', cost: 5, atk: 4, hp: 4, move: 2, range: 1, keywords: ['冲锋'], role: '终结', desc: '召唤回合可直扑水晶。' },
    phase_sniper: { name: '相位狙击手', type: 'minion', cost: 5, atk: 3, hp: 3, move: 1, range: 4, keywords: ['穿透','远程'], role: '解场', desc: '穿透射线，后排杀手。' },
    shield_drone: { name: '光盾无人机', type: 'minion', cost: 2, atk: 1, hp: 2, move: 3, range: 1, keywords: ['飞行','圣盾'], role: '反快攻', desc: '高机动首伤免疫。' },
    stealth_blade: { name: '静默刃客', type: 'minion', cost: 3, atk: 3, hp: 2, move: 3, range: 1, keywords: ['潜行'], role: '刺客', desc: '潜行直到首次攻击。' },
    blood_reaper: { name: '虹吸收割者', type: 'minion', cost: 4, atk: 3, hp: 4, move: 2, range: 1, keywords: ['吸血'], role: '续航', desc: '造成伤害时回复己方水晶。' },
    aura_priest: { name: '晶辉祭司', type: 'minion', cost: 3, atk: 1, hp: 4, move: 1, range: 2, keywords: ['光环'], role: '辅助', desc: '相邻友军+1攻击。' },
    twin_hunter: { name: '双脉猎手', type: 'minion', cost: 4, atk: 2, hp: 4, move: 2, range: 1, keywords: ['连击'], role: '站场', desc: '每回合可攻击两次。' },
    arc_magus: { name: '奥术法长', type: 'minion', cost: 4, atk: 2, hp: 3, move: 2, range: 2, keywords: ['战吼'], role: '解场', battlecry: 'adjacent_blast', desc: '战吼：对周围敌人造成1。' },

    // 法术（8）
    flare_bolt: { name: '裂焰箭', type: 'spell', cost: 2, targeting: 'enemyAny', role: '直伤', desc: '对单位或水晶造成2伤害。' },
    freeze_ray: { name: '冰封术', type: 'spell', cost: 2, targeting: 'enemyUnit', role: '控制', desc: '冻结一个单位1回合。' },
    shockwave: { name: '震荡术', type: 'spell', cost: 2, targeting: 'enemyUnit', role: '控制', desc: '击退目标1格。' },
    silence_mark: { name: '静默印记', type: 'spell', cost: 1, targeting: 'enemyUnit', role: '解场', desc: '沉默目标并移除关键词。' },
    blink_swap: { name: '折跃换位', type: 'spell', cost: 2, targeting: 'twoUnits', role: '节奏', desc: '交换两个单位位置。' },
    arc_barrier: { name: '奥能屏障', type: 'terrain', cost: 2, targeting: 'empty', role: '控制', desc: '封锁格子2回合。' },
    overload_core: { name: '过载核心', type: 'spell', cost: 1, targeting: 'allyUnit', role: '增益', desc: '友方单位+1攻击并获得冲锋（本回合）。' },
    draw_sync: { name: '同步过载', type: 'spell', cost: 2, targeting: 'none', role: '过牌', desc: '抽2张牌。' },

    // 秘术（5）
    sec_guard_echo: { name: '秘术·守门回响', type: 'secret', cost: 2, trigger: 'enemy_attack_core', role: '秘术联动', desc: '触发：敌方攻击水晶时，取消本次攻击并召唤守卫晶片。' },
    sec_spell_snare: { name: '秘术·法缚网', type: 'secret', cost: 2, trigger: 'enemy_cast_spell', role: '反制', desc: '触发：反制一张敌方法术。' },
    sec_frost_ring: { name: '秘术·霜环陷域', type: 'secret', cost: 1, trigger: 'enemy_enter_center', role: '控制', desc: '触发：敌方进入中心区时冻结之。' },
    sec_revenant_wall: { name: '秘术·余烬壁垒', type: 'secret', cost: 2, trigger: 'ally_minion_died', role: '反快攻', desc: '触发：友方随从死亡后在前线召唤守卫。' },
    sec_heavy_punish: { name: '秘术·超载制裁', type: 'secret', cost: 2, trigger: 'enemy_summon_highcost', role: '反制', desc: '触发：敌方召唤5费+随从时对其造成3伤害并击退。' },

    coin: { name: '幸运币', type: 'spell', cost: 0, targeting: 'none', role: '抢节奏', desc: '本回合 +1 法力。' },
  };
  const key = (x, y) => `${x},${y}`;
  const $ = (id) => document.getElementById(id);
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  function createDefaultState() {
    return {
      board: [],
      players: {
        blue: { mana: 1, maxMana: 1, deck: [], hand: [], coreHp: 20, heroSkillUsed: false, secrets: [] },
        red: { mana: 1, maxMana: 1, deck: [], hand: [], coreHp: 20, heroSkillUsed: false, secrets: [] },
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
  const FX_SPEED = { normal: 1, fast: 1.6 };

  const PRESET_DECKS = {
    midrange_guard: ['bulwark_guard','bulwark_guard','grave_engineer','grave_engineer','prism_archer','sky_raider','blood_reaper','aura_priest','twin_hunter','arc_magus','flare_bolt','freeze_ray','overload_core','draw_sync','sec_revenant_wall','sec_guard_echo','arc_barrier','warp_executor'],
    secret_control: ['shield_drone','stealth_blade','phase_sniper','arc_magus','prism_archer','prism_archer','freeze_ray','shockwave','silence_mark','blink_swap','flare_bolt','draw_sync','sec_spell_snare','sec_spell_snare','sec_frost_ring','sec_heavy_punish','arc_barrier','sec_guard_echo']
  };

  function makeDeck(preset) {
    return shuffle([...(PRESET_DECKS[preset] || PRESET_DECKS.midrange_guard)]);
  }

  function initState(opts) {
    const blueDeck = makeDeck('midrange_guard');
    const redDeck = makeDeck('secret_control');
    const s = {
      ...createDefaultState(),
      mode: opts.mode,
      difficulty: opts.difficulty,
      sound: opts.sound,
      animSpeed: opts.animSpeed || 'normal',
      turn: 1,
      current: opts.first,
      players: {
        blue: { mana: 0, maxMana: 0, deck: blueDeck, hand: [], coreHp: 20, heroSkillUsed: false, secrets: [] },
        red: { mana: 0, maxMana: 0, deck: redDeck, hand: [], coreHp: 20, heroSkillUsed: false, secrets: [] },
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
    s.swapBuffer = null;
    p.heroSkillUsed = false;

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
    showTurnBanner(`${sideTxt(side)}方回合`);
    playSfx('turn');
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
      if (e.keywords.includes('潜行')) return false;
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

    if (card.type === 'secret') {
      player.mana -= card.cost;
      player.hand.splice(handIdx, 1);
      if (!Array.isArray(player.secrets)) player.secrets = [];
      player.secrets.push({ id: cardId });
      pushLog(state, `${sideTxt(side)}埋伏了一张秘术`);
      playSfx('spell');
      renderAll();
      return;
    }

    if (card.type === 'spell' && card.targeting === 'none') {
      castNoTarget(cardId, side);
      player.hand.splice(handIdx, 1);
      player.mana -= card.cost;
      playSfx('card');
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

  async function onBoardClick(x, y) {
    const side = state.current;
    const player = state.players[side];

    if (state.pendingCast && state.pendingCast.side === side) {
      const card = CARD_POOL[state.pendingCast.cardId];
      if (player.mana < card.cost) return;
      if (!(await resolveCast(card, side, x, y))) return;
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
        if (x >= 2 && x <= 4 && y >= 1 && y <= 3) triggerSecret(side === 'blue' ? 'red' : 'blue', 'enemy_enter_center', { unit });
        pushLog(state, `${sideTxt(side)}${unit.name}移动`);
        beep(460, 0.04);
      }
      renderAll();
    }

    if (state.actionMode === 'attack' && unit.attacksLeft > 0) {
      const target = unitAt(x, y);
      if (target && target.side !== side) {
        if (attackableTargets(unit).some((t) => t.id === target.id)) {
          await hitUnit(unit, target);
          unit.attacksLeft -= 1;
          renderAll();
        }
      } else {
        const cp = corePos(side === 'blue' ? 'red' : 'blue');
        if (x === cp.x && y === cp.y && canAttackCore(unit)) {
          const enemySide = side === 'blue' ? 'red' : 'blue';
          const dmg = unit.atk + auraAtkBonus(unit);
          await playAttackAnim(unit, cp, true);
          if (!(state.cancelNextCoreAttackFrom && state.cancelNextCoreAttackFrom === side)) {
            state.players[enemySide].coreHp -= dmg;
          } else {
            pushLog(state, `${sideTxt(enemySide)}秘术抵消了本次水晶攻击`);
            state.cancelNextCoreAttackFrom = null;
          }
          unit.attacksLeft -= 1;
          pushLog(state, `${sideTxt(side)}${unit.name}攻击敌方水晶 ${dmg} 点`);
          crystalHitFx(side === 'blue' ? 'red' : 'blue', dmg);
          playSfx('crystal');
          checkWinner();
          renderAll();
        }
      }
    }
  }

  async function resolveCast(card, side, x, y) {
    const target = unitAt(x, y);
    const enemy = side === 'blue' ? 'red' : 'blue';

    if ((card.type === 'spell' || card.type === 'terrain') && triggerSecret(enemy, 'enemy_cast_spell', { caster: side })) {
      pushLog(state, `${sideTxt(enemy)}秘术反制了法术`);
      rippleFx(x, y, '#b38bff');
      return true;
    }

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
        shield: card.keywords.includes('圣盾'),
        frozen: 0,
deathrattle: card.deathrattle || null,
        battlecry: card.battlecry || null,
      };
      state.units.push(u);
      playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'summon');
      pushLog(state, `${sideTxt(side)}召唤 ${card.name}`);
      flashCell(x, y, '#7ecbff');
      rippleFx(x, y, '#8de6ff');
      playSfx('summon');
      onSummonEffect(u, side);
      if (card.cost >= 5) triggerSecret(enemy, 'enemy_summon_highcost', { unit: u });
      return true;
    }

    if (card.type === 'spell' || card.type === 'terrain') {
      if (card.name === '裂焰箭') {
        const enemyCore = corePos(side === 'blue' ? 'red' : 'blue');
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        if (target && target.side !== side) hitRaw(target, 2, '裂焰箭命中');
        else if (x === enemyCore.x && y === enemyCore.y) { state.players[side === 'blue' ? 'red' : 'blue'].coreHp -= 2; crystalHitFx(side === 'blue' ? 'red' : 'blue', 2); }
        else return false;
        playSfx('spell');
        return true;
      }
      if (card.name === '静默印记') {
        if (!target || target.side === side) return false;
        target.keywords = []; target.shield = false; target.frozen = 0;
        pushLog(state, `${target.name}被沉默`);
        playSfx('spell');
        return true;
      }
      if (card.name === '折跃换位') {
        if (!target) return false;
        if (!state.swapBuffer) { state.swapBuffer = { x, y }; hint('选择第二个单位完成换位。'); return false; }
        const first = unitAt(state.swapBuffer.x, state.swapBuffer.y);
        const second = target;
        if (!first || !second || first.id === second.id) { state.swapBuffer = null; return false; }
        const tx = first.x; const ty = first.y; first.x = second.x; first.y = second.y; second.x = tx; second.y = ty;
        state.swapBuffer = null;
        pushLog(state, '折跃换位完成');
        playSfx('spell');
        return true;
      }
      if (card.name === '震荡术') {
        if (!target || target.side === side) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        pushUnit(target, side === 'blue' ? 1 : -1, 0);
        pushLog(state, `${sideTxt(side)}施放震荡术`);
        playSfx('spell');
        return true;
      }
      if (card.name === '冰封术') {
        if (!target || target.side === side) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        target.frozen = 1;
        pushLog(state, `${sideTxt(side)}冰封 ${target.name}`);
        rippleFx(x, y, '#9dd9ff');
        playSfx('spell');
        return true;
      }
      if (card.name === '奥能屏障') {
        if (target || terrainAt(x, y) || !inBoard(x, y)) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        state.terrain[key(x, y)] = { type: 'barrier', ttl: 2, side };
        pushLog(state, `${sideTxt(side)}生成奥能屏障`);
        rippleFx(x, y, '#ffd58c');
        playSfx('spell');
        return true;
      }
      if (card.name === '过载核心') {
        if (!target || target.side !== side) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        target.atk += 1;
        pushLog(state, `${sideTxt(side)}强化 ${target.name} 攻击 +1`);
        floatingText(x, y, '+1攻', 'heal');
        playSfx('spell');
        return true;
      }
      if (card.name === '晶核修补') {
        const cp = corePos(side);
        if (x !== cp.x || y !== cp.y) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        state.players[side].coreHp = Math.min(20, state.players[side].coreHp + 3);
        pushLog(state, `${sideTxt(side)}水晶回复 3`);
        floatingText(x, y, '+3', 'heal big');
        return true;
      }
      if (card.name === '脉冲地雷') {
        if (target || terrainAt(x, y) || !inBoard(x, y)) return false;
        playCardFlight(state.pendingCast && state.pendingCast.handIdx, x, y, 'spell');
        state.terrain[key(x, y)] = { type: 'mine', ttl: 3, side };
        pushLog(state, `${sideTxt(side)}部署脉冲地雷`);
        rippleFx(x, y, '#d8ff8a');
        return true;
      }
    }
    return false;
  }

  function onSummonEffect(u, side) {
    if (u.battlecry === 'adjacent_blast') {
      state.units.filter((e) => e.alive && e.side !== side && Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= 1).forEach((e) => hitRaw(e, 1, `战吼爆裂命中${e.name}`));
    }
  }

  function pushUnit(u, dx, dy) {
    const nx = u.x + dx; const ny = u.y + dy;
    if (!inBoard(nx, ny) || unitAt(nx, ny) || terrainAt(nx, ny)) return;
    u.x = nx; u.y = ny;
    flashCell(nx, ny, '#b8ff72');
  }

  async function hitUnit(attacker, target) {
    await playAttackAnim(attacker, { x: target.x, y: target.y }, false);
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
    if (attacker.keywords.includes('吸血')) {
      state.players[attacker.side].coreHp = Math.min(20, state.players[attacker.side].coreHp + dmg);
      floatingText(attacker.x, attacker.y, `+${dmg}`, 'heal');
    }
    if (attacker.keywords.includes('潜行')) attacker.keywords = attacker.keywords.filter((k) => k !== '潜行');
    playSfx('hit');
  }

  function hitRaw(target, dmg, logText) {
    if (!target.alive) return;
    if (target.shield) {
      target.shield = false;
      pushLog(state, `${target.name}护盾抵消伤害`);
      return;
    }
    target.hp -= dmg;
    flashCell(target.x, target.y, '#ff789e', true);
    floatingText(target.x, target.y, `-${dmg}`, 'dmg');
    pushLog(state, `${logText}，造成 ${dmg}`);
    if (target.hp <= 0) killUnit(target);
  }

  function killUnit(u) {
    u.alive = false;
    pushLog(state, `${u.name}被击破`);
    playSfx('death');
    floatingText(u.x, u.y, '击破', 'dmg big');
    if (u.deathrattle === 'spawn_shard') {
      const nx = Math.min(W - 1, u.x + (u.side === 'blue' ? 1 : -1));
      if (!unitAt(nx, u.y) && !terrainAt(nx, u.y)) {
        state.units.push({ id: `${u.side}-shard-${Date.now()}`, side: u.side, name: '晶片', type: 'unit', x: nx, y: u.y, hp: 1, maxHp: 1, atk: 1, move: 1, range: 1, keywords: [], desc: '亡语晶片', alive: true, moved: true, attacksLeft: 0, justSummoned: true, justSummonedRushOnly: false, shield: false, frozen: 0 });
      }
    }
    if (u.deathrattle) {
      state.units.filter((a) => a.alive && a.side !== u.side && Math.abs(a.x - u.x) + Math.abs(a.y - u.y) <= 1).forEach((a) => hitRaw(a, 1, `${u.name}亡语震荡`));
    }
    triggerSecret(u.side, 'ally_minion_died', { x: u.x, y: u.y });
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


  function triggerSecret(secretSide, trigger, payload) {
    const p = state.players[secretSide];
    if (!p || !Array.isArray(p.secrets) || !p.secrets.length) return false;
    const idx = p.secrets.findIndex((s) => CARD_POOL[s.id] && CARD_POOL[s.id].trigger === trigger);
    if (idx < 0) return false;
    const secret = p.secrets.splice(idx, 1)[0];
    const sid = secret.id;
    pushLog(state, `${sideTxt(secretSide)}秘术触发：${CARD_POOL[sid].name}`);
    playSfx('spell');

    if (sid === 'sec_guard_echo') {
      const enemy = secretSide === 'blue' ? 'red' : 'blue';
      const sx = secretSide === 'blue' ? 1 : W - 2;
      if (!unitAt(sx, 2) && !terrainAt(sx, 2)) {
        state.units.push({ id: `${secretSide}-echo-${Date.now()}`, side: secretSide, name: '回响守卫', type: 'unit', x: sx, y: 2, hp: 2, maxHp: 2, atk: 1, move: 1, range: 1, keywords: ['守卫'], desc: '秘术召唤', alive: true, moved: true, attacksLeft: 0, justSummoned: true, justSummonedRushOnly: false, shield: false, frozen: 0 });
      }
      state.cancelNextCoreAttackFrom = enemy;
    }
    if (sid === 'sec_frost_ring' && payload && payload.unit) { payload.unit.frozen = 1; }
    if (sid === 'sec_revenant_wall') {
      const sx = secretSide === 'blue' ? 1 : W - 2;
      const sy = payload && typeof payload.y === 'number' ? payload.y : 2;
      if (!unitAt(sx, sy) && !terrainAt(sx, sy)) {
        state.units.push({ id: `${secretSide}-wall-${Date.now()}`, side: secretSide, name: '壁垒晶片', type: 'unit', x: sx, y: sy, hp: 2, maxHp: 2, atk: 1, move: 1, range: 1, keywords: ['守卫'], desc: '秘术产物', alive: true, moved: true, attacksLeft: 0, justSummoned: true, justSummonedRushOnly: false, shield: false, frozen: 0 });
      }
    }
    if (sid === 'sec_heavy_punish' && payload && payload.unit) { hitRaw(payload.unit, 3, '秘术制裁'); pushUnit(payload.unit, secretSide === 'blue' ? -1 : 1, 0); }
    return true;
  }

  async function aiTurn() {
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
    for (const u of state.units.filter((u) => u.alive && u.side === side)) {
      if (u.frozen > 0) continue;
      while (u.attacksLeft > 0) {
        const target = attackableTargets(u).sort((a, b) => (a.name.includes('守卫') ? -3 : 0) - (b.name.includes('守卫') ? -3 : 0) + a.hp - b.hp)[0];
        if (target) {
          await hitUnit(u, target); u.attacksLeft -= 1;
        } else if (canAttackCore(u)) {
          const dmg = u.atk + auraAtkBonus(u);
          await playAttackAnim(u, corePos('blue'), true);
          if (!(state.cancelNextCoreAttackFrom && state.cancelNextCoreAttackFrom === 'red')) {
            state.players.blue.coreHp -= dmg;
            pushLog(state, `红方${u.name}攻击蓝方水晶 ${dmg}`);
          } else {
            pushLog(state, '蓝方秘术抵消了本次水晶攻击');
            state.cancelNextCoreAttackFrom = null;
          }
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
          if (u.x >= 2 && u.x <= 4 && u.y >= 1 && u.y <= 3) triggerSecret('blue', 'enemy_enter_center', { unit: u });
        }
      }
    }

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
$('status-box').textContent = `当前模式：${s.mode === 'pve' ? 'PVE' : 'PVP'}，AI：${s.difficulty || 'normal'}，动画：${s.animSpeed === 'fast' ? '快速' : '正常'}，秘术：蓝${(s.players.blue.secrets||[]).length}/红${(s.players.red.secrets||[]).length}`;

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
        if (x === bCore.x && y === bCore.y) { cell.classList.add('crystal-blue'); if (state.players.blue.coreHp <= 8) cell.classList.add('crystal-danger'); }
        if (x === rCore.x && y === rCore.y) { cell.classList.add('crystal-red'); if (state.players.red.coreHp <= 8) cell.classList.add('crystal-danger'); }

        if (moveTargets.some((p) => p.x === x && p.y === y) || attackTargets.some((p) => p.x === x && p.y === y) || castTargets.some((p) => p.x === x && p.y === y)) cell.classList.add('target');

        const u = unitAt(x, y);
        if (u) {
          const ue = document.createElement('div');
          ue.className = `unit ${u.side}`;
          if (state.selectedUnit === u.id) ue.classList.add('selected');
          if (u.frozen > 0 || (u.moved && u.attacksLeft <= 0)) ue.classList.add('exhausted');
          ue.dataset.unitId = u.id;
          ue.textContent = `${u.name.slice(0,2)} ${u.hp}`;
          const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = `攻${u.atk}`; ue.appendChild(bd);
          const hp = document.createElement('div'); hp.className = 'hpbar';
          const fill = document.createElement('div'); fill.className = 'hpfill'; fill.style.width = `${Math.max(0, (u.hp / u.maxHp) * 100)}%`;
          hp.appendChild(fill); ue.appendChild(hp);
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
    }
    handArr.forEach((id, idx) => {
      const c = CARD_POOL[id];
      if (!c) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'card';
      item.dataset.handIdx = String(idx);
      if (p.mana < c.cost) item.classList.add('unplayable');
      const k = c.keywords ? `关键词：${c.keywords.join('、')}` : '';
      item.innerHTML = `<h4>${c.name} [${c.cost}]</h4><div class="type">${c.type === 'minion' ? '随从' : c.type === 'secret' ? '秘术' : '法术'}</div><div class="tag">用途：${c.role || '通用'}</div><div>${c.desc}</div><div class="tag">${k}</div>`;
      item.onclick = () => playCard(idx);
      hand.appendChild(item);
    });
    const secretZone = $('secret-zone');
    secretZone.innerHTML = '';
    const mine = (state.players[side].secrets || []);
    const enemy = (state.players[side === 'blue' ? 'red' : 'blue'].secrets || []);
    mine.forEach(() => { const t = document.createElement('div'); t.className = 'secret-token'; t.textContent = '你的秘术'; secretZone.appendChild(t); });
    enemy.forEach(() => { const t = document.createElement('div'); t.className = 'secret-token'; t.textContent = '敌方未知秘术'; secretZone.appendChild(t); });
    if (!mine.length && !enemy.length) secretZone.innerHTML = '<div class="secret-token">暂无秘术</div>';
  }


  function renderDetail() {
    if (!state.selectedUnit) { $('unit-detail').textContent = '未选择单位'; return; }
    const u = state.units.find((x) => x.id === state.selectedUnit && x.alive);
    if (!u) { $('unit-detail').textContent = '未选择单位'; return; }
    $('unit-detail').innerHTML = `<b>${u.name}</b><br/>ATK ${u.atk} / HP ${u.hp}/${u.maxHp}<br/>移动 ${u.move} / 射程 ${u.range}<br/>关键词：${u.keywords.join('、') || '无'}<br/>状态：${u.frozen>0?'冻结 ':''}${u.shield?'圣盾':''}`;
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
        if (c.targeting === 'enemyUnit' && u && u.side !== side && !u.keywords.includes('潜行')) out.push({ x, y });
        if (c.targeting === 'enemyAny') {
          const enemyCore = corePos(side === 'blue' ? 'red' : 'blue');
          if ((u && u.side !== side && !u.keywords.includes('潜行')) || (x === enemyCore.x && y === enemyCore.y)) out.push({ x, y });
        }
        if (c.targeting === 'allyUnit' && u && u.side === side) out.push({ x, y });
        if (c.targeting === 'empty' && !u && !terrainAt(x, y)) out.push({ x, y });
        if (c.targeting === 'twoUnits' && u) out.push({ x, y });
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

  function flashCell(x, y, color, strong) {
    const cell = [...document.querySelectorAll('.cell')][y * W + x];
    if (!cell) return;
    cell.style.boxShadow = `0 0 16px ${color}`;
    if (strong) { cell.classList.add('hit-flash'); setTimeout(() => cell.classList.remove('hit-flash'), 120 / speedScale()); }
    setTimeout(() => { cell.style.boxShadow = ''; }, 150 / speedScale());
  }

  function speedScale() {
    const m = state && state.animSpeed ? state.animSpeed : 'normal';
    return FX_SPEED[m] || 1;
  }

  async function playAttackAnim(attacker, targetPos, crystal) {
    const ue = document.querySelector(`.unit[data-unit-id="${attacker.id}"]`);
    if (ue) ue.classList.add('pre-attack');
    await sleep(70 / speedScale());
    if (ue) ue.classList.remove('pre-attack');
    hitStop(crystal ? 110 : 70);
    await sleep((crystal ? 110 : 70) / speedScale());
    if (ue) {
      ue.classList.add('recover');
      setTimeout(() => ue.classList.remove('recover'), 90 / speedScale());
    }
    if (!crystal) {
      const targetUnit = unitAt(targetPos.x, targetPos.y);
      const te = targetUnit ? document.querySelector(`.unit[data-unit-id="${targetUnit.id}"]`) : null;
      if (te) { te.classList.add('hit-shake'); setTimeout(() => te.classList.remove('hit-shake'), 180 / speedScale()); }
    }
  }

  function hitStop(ms) {
    const b = $('board');
    b.style.transform = 'scale(1.01)';
    setTimeout(() => { b.style.transform = ''; }, ms / speedScale());
  }

  function floatingText(x, y, text, cls) {
    const fx = $('fx-layer');
    const cell = [...document.querySelectorAll('.cell')][y * W + x];
    if (!fx || !cell) return;
    const rect = cell.getBoundingClientRect();
    const host = fx.getBoundingClientRect();
    const n = document.createElement('div');
    n.className = `floating ${cls || ''}`;
    n.style.left = `${rect.left - host.left + rect.width * 0.35}px`;
    n.style.top = `${rect.top - host.top + rect.height * 0.28}px`;
    n.textContent = text;
    fx.appendChild(n);
    setTimeout(() => n.remove(), 760 / speedScale());
  }

  function rippleFx(x, y, color) {
    const fx = $('fx-layer');
    const cell = [...document.querySelectorAll('.cell')][y * W + x];
    if (!fx || !cell) return;
    const rect = cell.getBoundingClientRect();
    const host = fx.getBoundingClientRect();
    const n = document.createElement('div');
    n.className = 'impact';
    n.style.borderColor = color;
    n.style.left = `${rect.left - host.left + rect.width * 0.38}px`;
    n.style.top = `${rect.top - host.top + rect.height * 0.38}px`;
    n.style.width = `${rect.width * 0.25}px`;
    n.style.height = `${rect.width * 0.25}px`;
    fx.appendChild(n);
    setTimeout(() => n.remove(), 460 / speedScale());
  }

  function crystalHitFx(side, dmg) {
    const p = corePos(side);
    floatingText(p.x, p.y, `-${dmg}`, 'dmg big');
    rippleFx(p.x, p.y, '#ff9a6e');
    const cell = [...document.querySelectorAll('.cell')][p.y * W + p.x];
    if (cell) {
      cell.classList.add('hit-flash');
      setTimeout(() => cell.classList.remove('hit-flash'), 160 / speedScale());
      const hp = state.players[side].coreHp;
      if (hp <= 8) cell.classList.add('crystal-danger');
    }
  }

  function playCardFlight(handIdx, x, y, type) {
    const fx = $('fx-layer');
    const from = document.querySelector(`.card[data-hand-idx="${handIdx}"]`);
    const to = [...document.querySelectorAll('.cell')][y * W + x];
    if (!fx || !from || !to) return;
    const fr = from.getBoundingClientRect();
    const tr = to.getBoundingClientRect();
    const hr = fx.getBoundingClientRect();
    const n = document.createElement('div');
    n.className = 'trail';
    n.style.left = `${fr.left - hr.left + fr.width / 2}px`;
    n.style.top = `${fr.top - hr.top + fr.height / 2}px`;
    fx.appendChild(n);
    n.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${tr.left - fr.left}px,${tr.top - fr.top}px) scale(${type === 'summon' ? 1.6 : 1.2})`, opacity: 0.1 },
    ], { duration: 220 / speedScale(), easing: 'ease-out' });
    setTimeout(() => n.remove(), 260 / speedScale());
  }

  function showTurnBanner(text) {
    const b = $('turn-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('hidden');
    setTimeout(() => b.classList.add('hidden'), 900 / speedScale());
  }

  function playSfx(type) {
    if (!state || !state.sound) return;
    const tones = {
      card: [520, 0.04], summon: [610, 0.05], hit: [260, 0.05], spell: [430, 0.06], crystal: [180, 0.1], death: [120, 0.12], turn: [700, 0.04],
    };
    const t = tones[type] || [500, 0.03];
    beep(t[0], t[1]);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let audioCtx;
  function beep(freq, dur) {
    if (!state || !state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'triangle'; o.frequency.value = freq; g.gain.value = 0.02; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }


  function useHeroSkill() {
    if (!state || state.winner) return;
    const side = state.current;
    const p = state.players[side];
    if (p.heroSkillUsed || p.mana < 2) { hint('本回合已用技能或法力不足。'); return; }
    p.mana -= 2;
    p.heroSkillUsed = true;
    const core = corePos(side);
    const enemies = state.units.filter((u) => u.alive && u.side !== side && Math.abs(u.x - core.x) + Math.abs(u.y - core.y) <= 1);
    if (enemies.length) {
      enemies.forEach((e) => hitRaw(e, 1, `${sideTxt(side)}水晶技能脉冲`));
      rippleFx(core.x, core.y, '#8df6ff');
      pushLog(state, `${sideTxt(side)}发动水晶技能：晶能脉冲`);
    } else {
      state.players[side].coreHp = Math.min(20, state.players[side].coreHp + 2);
      floatingText(core.x, core.y, '+2', 'heal big');
      pushLog(state, `${sideTxt(side)}发动水晶技能：修复回路`);
    }
    playSfx('spell');
    renderAll();
  }

  function bindMenu() {
    $('start-btn').onclick = () => {
      try {
        state = initState({ mode: $('mode-select').value, first: $('first-select').value, difficulty: $('difficulty-select').value, sound: $('sound-select').value === 'on', animSpeed: $('anim-speed-select').value });
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
    $('rules-btn').onclick = () => { playSfx('card'); $('rules-modal').classList.remove('hidden'); };
    $('rules-close').onclick = () => { $('rules-modal').classList.add('hidden'); playSfx('card'); };
    $('rules-mask').onclick = () => $('rules-modal').classList.add('hidden');
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('rules-modal').classList.add('hidden'); $('result-modal').classList.add('hidden'); } });

$('hero-skill-btn').onclick = useHeroSkill;
    $('end-turn-btn').onclick = () => { playSfx('turn'); endTurn(); };
    $('restart-btn').onclick = () => $('start-btn').click();
    $('menu-btn').onclick = () => switchScreen('menu-screen');
    $('move-mode-btn').onclick = () => { playSfx('card'); state.actionMode = 'move'; hint('移动模式：点高亮格移动。'); renderBoard(); };
    $('attack-mode-btn').onclick = () => { playSfx('card'); state.actionMode = 'attack'; hint('攻击模式：点高亮目标攻击。'); renderBoard(); };
    $('cancel-mode-btn').onclick = () => { state.actionMode = null; state.pendingCast = null; state.swapBuffer = null; hint('已取消当前操作。'); renderBoard(); };
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
