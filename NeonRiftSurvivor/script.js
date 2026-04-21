(() => {
  // ======================= 基础配置 =======================
  const W = 1280, H = 720;
  const RUN_TIME_TARGET = 12 * 60; // 12分钟
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const screens = {
    menu: document.getElementById('menuScreen'),
    game: document.getElementById('gameScreen'),
    upgrade: document.getElementById('upgradeScreen'),
    result: document.getElementById('resultScreen'),
    unlock: document.getElementById('unlockScreen'),
    settings: document.getElementById('settingsScreen'),
  };
  const show = (name, active = true) => screens[name].classList.toggle('active', active);
  const showOnly = (name) => Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));

  const toastEl = document.getElementById('toast');
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 1100);
  };

  // ======================= 元进度 =======================
  const metaKey = 'neon_rift_meta_v1';
  const defaultMeta = {
    crystals: 0,
    unlockedChars: ['pulse_runner'],
    unlockedWeapons: ['pulse_blade', 'arc_laser', 'ember_orb', 'drone_pair'],
    unlockedMaps: ['neon_basin'],
    difficulty: 1,
    bestTime: 0,
  };
  const meta = Object.assign({}, defaultMeta, JSON.parse(localStorage.getItem(metaKey) || '{}'));
  const saveMeta = () => localStorage.setItem(metaKey, JSON.stringify(meta));
  const settingsKey = 'neon_rift_settings_v1';
  const loadedSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}');

  // ======================= 数据池 =======================
  const CHARACTERS = [
    { id: 'pulse_runner', name: '脉冲疾行者', talent: '+15% 移速', mult: { move: 1.15 } },
    { id: 'void_monk', name: '虚空修士', talent: '+20 最大生命', mult: { hp: 1.2 }, unlock: 120 },
    { id: 'spark_hunter', name: '星火猎手', talent: '+12% 暴击', mult: { crit: 0.12 }, unlock: 260 },
    { id: 'quant_guard', name: '量子守卫', talent: '初始护盾 +25', mult: { shield: 25 }, unlock: 460 },
  ];

  const MAP_MODIFIERS = [
    { id: 'swift_enemies', name: '狂速裂隙', desc: '敌人移速 +20%', apply: (s) => s.enemySpeedMul = 1.2 },
    { id: 'inferno', name: '灼烬回路', desc: '火焰伤害 +25%', apply: (s) => s.fireMul = 1.25 },
    { id: 'elite_hunt', name: '猩红猎潮', desc: '精英怪数量 +70%', apply: (s) => s.eliteMul = 1.7 },
    { id: 'rich_xp', name: '丰饶矩阵', desc: '经验获取 +30%', apply: (s) => s.xpMul = 1.3 },
  ];

  // 12种武器（部分共享子弹逻辑但参数不同）
  const WEAPONS = [
    ['pulse_blade', '脉冲飞刃'], ['arc_laser', '电弧激光'], ['ember_orb', '炽焰法球'], ['drone_pair', '双生无人机'],
    ['ice_spike', '冰棱锥'], ['homing_swarm', '追踪蜂群'], ['ion_shotgun', '离子散射'], ['void_rift', '虚空裂隙'],
    ['chain_bolt', '链式雷击'], ['meteor_call', '陨星召唤'], ['boomer_disc', '回旋能刃'], ['gravity_well', '重力井']
  ].map(([id, name]) => ({ id, name }));

  // 12种被动
  const PASSIVES = [
    ['attack_speed', '快频核心', '攻速 +10%'], ['aoe', '扩域框架', '范围 +12%'], ['crit', '极限瞄准', '暴击 +8%'],
    ['lifesteal', '虹吸回路', '吸血 +1.5%'], ['cdr', '降温阵列', '冷却 -8%'], ['move', '相位鞋', '移速 +10%'],
    ['shield', '偏振护盾', '护盾 +20'], ['xp', '求知芯片', '经验 +12%'], ['thorns', '反噬棱镜', '反伤 +8'],
    ['magnet', '引力收束', '拾取范围 +35%'], ['burn', '余烬符文', '附加灼烧'], ['freeze', '寒潮结晶', '附加减速']
  ].map(([id, name, desc]) => ({ id, name, desc }));

  const ENEMY_TYPES = {
    chaser: { hp: 22, speed: 78, dmg: 10, color: '#ff6d95' },
    shooter: { hp: 28, speed: 58, dmg: 11, ranged: true, cd: 1.7, color: '#ff8d4b' },
    bomber: { hp: 18, speed: 96, dmg: 22, explode: true, color: '#ffd86d' },
    tank: { hp: 80, speed: 42, dmg: 18, color: '#8d7cff' },
    splitter: { hp: 32, speed: 70, dmg: 9, split: true, color: '#6dffc8' },
    teleporter: { hp: 24, speed: 66, dmg: 12, teleport: true, color: '#72e6ff' },
    aura: { hp: 46, speed: 56, dmg: 9, aura: true, color: '#cc7dff' },
    boss: { hp: 650, speed: 52, dmg: 28, boss: true, ranged: true, cd: 1.2, color: '#ff3f64' },
    boss_tyrant: { hp: 840, speed: 58, dmg: 32, boss: true, ranged: true, cd: 1.0, charge: true, color: '#ff4b7d' },
    boss_orbit: { hp: 760, speed: 48, dmg: 24, boss: true, ranged: true, cd: .8, nova: true, color: '#8b68ff' },
  };

  // ======================= Canvas + 输入 =======================
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const keys = new Set();
  const mouse = { x: W / 2, y: H / 2 };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright',' ','p','r'].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'p' && state.running) state.paused = !state.paused;
    if (k === 'r' && state.running) startRun(state.selectedChar.id);
    if (k === ' ' && state.running && !state.paused) castDashSkill();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (W / r.width);
    mouse.y = (e.clientY - r.top) * (H / r.height);
  });

  // ======================= 状态 =======================
  const state = {
    running: false, paused: false, inUpgrade: false,
    selectedChar: CHARACTERS[0],
    mapMod: MAP_MODIFIERS[0],
    player: null,
    enemies: [], bullets: [], enemyBullets: [], xpOrbs: [], particles: [], chests: [], aoes: [],
    time: 0, kills: 0, level: 1, xp: 0, xpNeed: 30,
    weaponBag: [], passiveBag: [],
    events: { next: 40, current: '平稳期', doubleXp: 0, cursed: 0, meteor: 0 },
    enemySpeedMul: 1, fireMul: 1, eliteMul: 1, xpMul: 1,
    rewardCrystals: 0,
    floatTexts: [],
    shake: 0,
    settings: { shake: true, damageNum: true, liteFx: false },
    terrain: [],
    missions: [],
    missionProgress: { kill: 0, elite: 0, chest: 0, survive: 0 },
  };
  Object.assign(state.settings, loadedSettings);
  const saveSettings = () => localStorage.setItem(settingsKey, JSON.stringify(state.settings));

  // ======================= 游戏逻辑 =======================
  function makePlayer(char) {
    return {
      x: W / 2, y: H / 2, r: 16,
      hp: 120 * (char.mult.hp || 1), maxHp: 120 * (char.mult.hp || 1), shield: char.mult.shield || 0,
      speed: 230 * (char.mult.move || 1),
      baseCrit: char.mult.crit || 0.06,
      magnet: 95, dashCd: 0,
    };
  }

  function generateTerrain() {
    const terrain = [];
    for (let i = 0; i < 6; i++) {
      terrain.push({ type: 'wall', x: rnd(180, W - 180), y: rnd(130, H - 130), r: rnd(24, 42) });
    }
    for (let i = 0; i < 3; i++) {
      terrain.push({ type: 'lava', x: rnd(180, W - 180), y: rnd(130, H - 130), r: rnd(34, 56) });
    }
    return terrain;
  }

  function initMissions() {
    const pool = [
      { id: 'kill', label: '击杀 120 敌人', target: 120, reward: '经验+40' },
      { id: 'elite', label: '击杀 6 精英', target: 6, reward: '水晶+40' },
      { id: 'chest', label: '开启 3 宝箱', target: 3, reward: '随机武器升级' },
      { id: 'survive', label: '生存 300 秒', target: 300, reward: '满血+护盾' },
    ];
    state.missions = pool.sort(() => Math.random() - 0.5).slice(0, 3).map((m) => ({ ...m, done: false }));
    state.missionProgress = { kill: 0, elite: 0, chest: 0, survive: 0 };
  }

  function applyMissionReward(mission) {
    if (mission.id === 'kill') gainXP(40);
    if (mission.id === 'elite') state.rewardCrystals += 40;
    if (mission.id === 'chest' && state.weaponBag.length) addWeapon(pick(state.weaponBag).id, 1);
    if (mission.id === 'survive') {
      state.player.hp = state.player.maxHp;
      state.player.shield += 25;
    }
    toast(`任务完成：${mission.label}（${mission.reward}）`);
  }

  function updateMissions(dt) {
    state.missionProgress.survive += dt;
    for (const m of state.missions) {
      if (m.done) continue;
      if ((state.missionProgress[m.id] || 0) >= m.target) {
        m.done = true;
        applyMissionReward(m);
      }
    }
  }

  function addWeapon(id, level = 1) {
    const w = state.weaponBag.find((x) => x.id === id);
    if (w) w.level = Math.min(8, w.level + level);
    else state.weaponBag.push({ id, level, cd: 0 });
  }
  function addPassive(id, level = 1) {
    const p = state.passiveBag.find((x) => x.id === id);
    if (p) p.level = Math.min(6, p.level + level);
    else state.passiveBag.push({ id, level });
  }
  const getPassiveLevel = (id) => state.passiveBag.find((p) => p.id === id)?.level || 0;

  function getStats() {
    const atkSpd = 1 + getPassiveLevel('attack_speed') * 0.1;
    const aoe = 1 + getPassiveLevel('aoe') * 0.12;
    const crit = state.player.baseCrit + getPassiveLevel('crit') * 0.08;
    const lifesteal = getPassiveLevel('lifesteal') * 0.015;
    const cdr = 1 - getPassiveLevel('cdr') * 0.08;
    const move = 1 + getPassiveLevel('move') * 0.1;
    const xp = 1 + getPassiveLevel('xp') * 0.12;
    const thorns = getPassiveLevel('thorns') * 8;
    const burn = getPassiveLevel('burn') > 0;
    const freeze = getPassiveLevel('freeze') > 0;
    const magnet = state.player.magnet + getPassiveLevel('magnet') * 35;
    return { atkSpd, aoe, crit, lifesteal, cdr, move, xp, thorns, burn, freeze, magnet };
  }

  function castDashSkill() {
    if (state.player.dashCd > 0) return;
    const dx = mouse.x - state.player.x, dy = mouse.y - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    state.player.x += (dx / len) * 120;
    state.player.y += (dy / len) * 120;
    state.player.dashCd = 4;
    spawnBurst(state.player.x, state.player.y, '#78f9ff', 20);
  }

  function spawnBurst(x, y, color, n = 8) {
    if (state.settings.liteFx) n = Math.max(3, Math.floor(n / 2));
    for (let i = 0; i < n; i++) {
      state.particles.push({ x, y, vx: rnd(-120,120), vy: rnd(-120,120), t: rnd(.25,.7), color, s: rnd(2,5) });
    }
  }

  function addFloatText(x, y, text, color = '#ffffff') {
    if (!state.settings.damageNum) return;
    state.floatTexts.push({ x, y, vy: -36, t: 0.65, text, color });
  }

  function addShake(power = 8) {
    if (!state.settings.shake) return;
    state.shake = Math.max(state.shake, power);
  }

  function spawnEnemy(type, elite = false) {
    const t = ENEMY_TYPES[type];
    const edge = Math.floor(Math.random() * 4);
    const pad = 48;
    const x = edge === 0 ? -pad : edge === 1 ? W + pad : rnd(0, W);
    const y = edge === 2 ? -pad : edge === 3 ? H + pad : rnd(0, H);
    const hpMul = 1 + state.time / 260 + (elite ? 1.4 : 0) + (meta.difficulty - 1) * 0.25;
    state.enemies.push({
      type, x, y, vx: 0, vy: 0, hp: t.hp * hpMul, maxHp: t.hp * hpMul, speed: t.speed * state.enemySpeedMul,
      dmg: t.dmg, rangedCd: t.cd || 0, elite, burn: 0, freeze: 0, auraBoost: 1,
    });
  }

  function spawnWave(dt) {
    state._spawnTimer = (state._spawnTimer || 0) - dt;
    if (state._spawnTimer > 0) return;

    const intensity = 1 + state.time / 90;
    const base = Math.max(0.2, 1.2 - intensity * 0.09);
    state._spawnTimer = base;

    const pool = ['chaser','shooter','bomber','tank','splitter','teleporter','aura'];
    let count = Math.floor(1 + intensity * 0.6 + (state.events.cursed > 0 ? 2 : 0));
    for (let i = 0; i < count; i++) spawnEnemy(pick(pool));

    if (Math.random() < 0.08 * state.eliteMul) spawnEnemy(pick(pool), true);
    if (Math.floor(state.time) % 180 === 0 && !state._bossFlag) {
      spawnEnemy(pick(['boss', 'boss_tyrant', 'boss_orbit']), true);
      state._bossFlag = true;
      toast('Boss 来袭！');
    }
    if (Math.floor(state.time) % 180 === 5) state._bossFlag = false;
  }

  function fireWeapon(w, dt, stats) {
    const cdr = stats.cdr;
    w.cd -= dt;
    const lv = w.level;
    if (w.cd > 0) return;

    const nearest = nearestEnemy();
    if (!nearest) return;
    const dx = nearest.x - state.player.x, dy = nearest.y - state.player.y;
    const ang = Math.atan2(dy, dx);
    const shot = (speed, dmg, spread = 0, life = 1.4, color = '#73ecff', kind = w.id) => {
      const a = ang + rnd(-spread, spread);
      state.bullets.push({ x: state.player.x, y: state.player.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, dmg, life, color, kind, pierce: 0 });
    };

    switch (w.id) {
      case 'pulse_blade':
        shot(360, 15 + lv * 6, 0.2, 1.2, '#8ffbff', 'boomer');
        w.cd = 0.65 / stats.atkSpd * cdr; break;
      case 'arc_laser':
        shot(540, 11 + lv * 5, 0.05, .8, '#84b8ff', 'laser');
        w.cd = 0.2 / stats.atkSpd * cdr; break;
      case 'ember_orb':
        shot(250, 20 + lv * 7 * state.fireMul, 0.18, 1.9, '#ff8f5d', 'ember');
        w.cd = 0.95 / stats.atkSpd * cdr; break;
      case 'drone_pair':
        for (let i = 0; i < 2 + Math.floor(lv / 3); i++) shot(300, 10 + lv * 4, 0.55, 1.6, '#8dffe1', 'drone');
        w.cd = 1.2 / stats.atkSpd * cdr; break;
      case 'ice_spike':
        shot(340, 16 + lv * 5, 0.14, 1.5, '#8dd8ff', 'ice');
        w.cd = 0.6 / stats.atkSpd * cdr; break;
      case 'homing_swarm':
        for (let i = 0; i < 2; i++) shot(210, 14 + lv * 4, 0.45, 2.2, '#f2ff73', 'homing');
        w.cd = 0.8 / stats.atkSpd * cdr; break;
      case 'ion_shotgun':
        for (let i = 0; i < 5 + lv; i++) shot(300, 8 + lv * 2, 0.55, .7, '#b188ff', 'pellet');
        w.cd = 1.0 / stats.atkSpd * cdr; break;
      case 'void_rift':
        state.aoes.push({ x: nearest.x, y: nearest.y, r: 36 * stats.aoe, t: 1.6, dmg: 26 + lv * 9, color: '#8a67ff', kind: 'rift' });
        w.cd = 1.8 / stats.atkSpd * cdr; break;
      case 'chain_bolt':
        shot(420, 18 + lv * 6, 0.1, 1.2, '#7ef6ff', 'chain');
        w.cd = 0.85 / stats.atkSpd * cdr; break;
      case 'meteor_call':
        state.aoes.push({ x: nearest.x + rnd(-40,40), y: nearest.y + rnd(-40,40), r: 48 * stats.aoe, t: .6, dmg: 38 + lv * 11, color: '#ff7c6b', kind: 'meteor' });
        w.cd = 2.4 / stats.atkSpd * cdr; break;
      case 'boomer_disc':
        shot(300, 22 + lv * 7, 0.05, 1.7, '#4df0cb', 'boomer');
        w.cd = 1.1 / stats.atkSpd * cdr; break;
      case 'gravity_well':
        state.aoes.push({ x: nearest.x, y: nearest.y, r: 62 * stats.aoe, t: 1.2, dmg: 16 + lv * 6, color: '#3a7dff', kind: 'gravity' });
        w.cd = 2.0 / stats.atkSpd * cdr; break;
      default: break;
    }
  }

  function nearestEnemy() {
    let best = null, d = 1e9;
    for (const e of state.enemies) {
      const di = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
      if (di < d) { d = di; best = e; }
    }
    return best;
  }

  function gainXP(v) {
    state.xp += v;
    while (state.xp >= state.xpNeed) {
      state.xp -= state.xpNeed;
      state.level++;
      state.xpNeed = Math.floor(24 + state.level * 16 + Math.pow(state.level, 1.22));
      openUpgrade();
    }
  }

  function killEnemy(e) {
    state.kills++;
    state.missionProgress.kill++;
    if (e.elite || (ENEMY_TYPES[e.type]?.boss)) state.missionProgress.elite++;
    state.rewardCrystals += e.elite ? 3 : 1;
    state.xpOrbs.push({ x: e.x, y: e.y, v: e.elite ? 16 : 8, t: 10 });
    if (e.elite && Math.random() < 0.45) state.chests.push({ x: e.x, y: e.y, r: 12 });
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        state.enemies.push({ ...e, type: 'chaser', hp: e.maxHp * 0.35, maxHp: e.maxHp * 0.35, dmg: 7, speed: 120, elite: false });
      }
    }
    addShake(e.elite ? 10 : 4);
    spawnBurst(e.x, e.y, e.elite ? '#ffdb58' : '#7fd1ff', e.elite ? 20 : 10);
  }

  function damageEnemy(e, dmg, type = '') {
    const stats = getStats();
    let hit = dmg;
    const crit = Math.random() < stats.crit;
    if (crit) hit *= 2;
    e.hp -= hit;
    addFloatText(e.x, e.y - 14, `${Math.floor(hit)}${crit ? '!' : ''}`, crit ? '#ffd45a' : '#d9f2ff');

    if (stats.burn || type === 'ember') e.burn = 2.6;
    if (stats.freeze || type === 'ice') e.freeze = 1.1;

    if (type === 'chain') {
      let chained = 0;
      for (const n of state.enemies) {
        if (n === e || chained > 2) continue;
        const d = Math.hypot(n.x - e.x, n.y - e.y);
        if (d < 110) { n.hp -= hit * 0.4; chained++; spawnBurst(n.x, n.y, '#7deeff', 5); }
      }
    }

    if (e.hp <= 0) killEnemy(e);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + hit * stats.lifesteal);
  }

  function damagePlayer(raw) {
    let dmg = raw;
    if (state.player.shield > 0) {
      const a = Math.min(state.player.shield, dmg);
      state.player.shield -= a;
      dmg -= a;
    }
    state.player.hp -= dmg;
    addShake(6);
    addFloatText(state.player.x, state.player.y - 22, `-${Math.floor(dmg)}`, '#ff89a4');
    spawnBurst(state.player.x, state.player.y, '#ff5f7f', 12);
    if (state.player.hp <= 0) endRun(false);
  }

  function updatePlayer(dt) {
    const p = state.player;
    const stats = getStats();
    const prevX = p.x, prevY = p.y;
    let x = 0, y = 0;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    const len = Math.hypot(x, y) || 1;
    p.x += (x / len) * p.speed * stats.move * dt;
    p.y += (y / len) * p.speed * stats.move * dt;

    for (const t of state.terrain) {
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (t.type === 'wall' && d < t.r + p.r) {
        p.x = prevX;
        p.y = prevY;
      }
      if (t.type === 'lava' && d < t.r + p.r * 0.2) {
        damagePlayer(10 * dt);
      }
    }

    p.x = clamp(p.x, 20, W - 20);
    p.y = clamp(p.y, 20, H - 20);
    p.dashCd = Math.max(0, p.dashCd - dt);
  }

  function updateEnemies(dt) {
    const thorns = getStats().thorns;
    for (const e of state.enemies) {
      const dx = state.player.x - e.x, dy = state.player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.teleport && Math.random() < 0.002) { e.x += rnd(-180,180); e.y += rnd(-180,180); }
      if (e.aura) {
        for (const other of state.enemies) {
          if (other === e) continue;
          if (Math.hypot(other.x-e.x, other.y-e.y) < 120) other.auraBoost = 1.2;
        }
      }

      const frz = e.freeze > 0 ? 0.55 : 1;
      e.x += (dx / d) * e.speed * (e.auraBoost || 1) * frz * dt;
      e.y += (dy / d) * e.speed * (e.auraBoost || 1) * frz * dt;
      e.auraBoost = 1;

      if (e.rangedCd !== undefined) {
        e.rangedCd -= dt;
        if (e.rangedCd <= 0) {
          const a = Math.atan2(dy, dx);
          state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a)*180, vy: Math.sin(a)*180, dmg: e.dmg * 0.7, life: 3 });
          if (ENEMY_TYPES[e.type]?.nova) {
            for (let i = 0; i < 8; i++) {
              const na = (Math.PI * 2 * i) / 8;
              state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(na)*140, vy: Math.sin(na)*140, dmg: e.dmg * 0.45, life: 2.2 });
            }
          }
          e.rangedCd = ENEMY_TYPES[e.type].cd || 1.5;
        }
      }

      if (ENEMY_TYPES[e.type]?.charge && Math.random() < 0.006) {
        e.x += (dx / d) * 80;
        e.y += (dy / d) * 80;
      }

      for (const t of state.terrain) {
        if (t.type !== 'wall') continue;
        const dis = Math.hypot(e.x - t.x, e.y - t.y);
        if (dis < t.r + 10) {
          e.x += (e.x - t.x) / (dis || 1) * 20 * dt;
          e.y += (e.y - t.y) / (dis || 1) * 20 * dt;
        }
      }

      if (d < state.player.r + 13) {
        damagePlayer(e.dmg * dt * 0.85);
        if (thorns > 0) e.hp -= thorns * dt;
        if (e.explode) e.hp = -1;
      }

      if (e.burn > 0) { e.burn -= dt; e.hp -= (8 * state.fireMul) * dt; }
      if (e.freeze > 0) e.freeze -= dt;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0 && e.x > -240 && e.y > -240 && e.x < W + 240 && e.y < H + 240);
  }

  function updateProjectiles(dt) {
    for (const b of state.bullets) {
      if (b.kind === 'homing') {
        const t = nearestEnemy();
        if (t) {
          const a = Math.atan2(t.y - b.y, t.x - b.x);
          b.vx += Math.cos(a) * 130 * dt;
          b.vy += Math.sin(a) * 130 * dt;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      for (const e of state.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          damageEnemy(e, b.dmg, b.kind);
          spawnBurst(b.x, b.y, b.color, 4);
          if (b.kind === 'boomer' && b.pierce < 2) { b.pierce++; b.dmg *= 0.7; }
          else { b.life = 0; }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -80 && b.y > -80 && b.x < W + 80 && b.y < H + 80);

    for (const b of state.enemyBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.hypot(state.player.x - b.x, state.player.y - b.y) < 14) { damagePlayer(b.dmg); b.life = 0; }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);
  }

  function updateAOE(dt) {
    for (const a of state.aoes) {
      a.t -= dt;
      for (const e of state.enemies) {
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        if (d < a.r) {
          damageEnemy(e, a.dmg * dt * (a.kind === 'meteor' ? 2.2 : 1), a.kind);
          if (a.kind === 'gravity') {
            const pull = (a.r - d) / a.r;
            e.x += ((a.x - e.x) / (d || 1)) * pull * 80 * dt;
            e.y += ((a.y - e.y) / (d || 1)) * pull * 80 * dt;
          }
        }
      }
    }
    state.aoes = state.aoes.filter((a) => a.t > 0);
  }

  function updateOrbs(dt) {
    const m = getStats().magnet;
    for (const o of state.xpOrbs) {
      const d = Math.hypot(state.player.x - o.x, state.player.y - o.y);
      if (d < m) {
        o.x += (state.player.x - o.x) / (d || 1) * 260 * dt;
        o.y += (state.player.y - o.y) / (d || 1) * 260 * dt;
      }
      o.t -= dt;
      if (d < 15) { gainXP(o.v * state.xpMul * getStats().xp * (state.events.doubleXp > 0 ? 2 : 1)); o.t = -1; }
    }
    state.xpOrbs = state.xpOrbs.filter((o) => o.t > 0);

    state.chests = state.chests.filter((c) => {
      if (Math.hypot(state.player.x-c.x, state.player.y-c.y) < 24) {
        toast('开启宝箱！获得双升级');
        state.missionProgress.chest++;
        openUpgrade(true);
        return false;
      }
      return true;
    });
  }

  function updateEvents(dt) {
    const ev = state.events;
    ev.next -= dt;
    if (ev.next <= 0) {
      ev.next = rnd(35, 58);
      const evt = pick(['meteor','doublexp','cursed','elite']);
      if (evt === 'meteor') { ev.current = '陨石雨'; ev.meteor = 12; }
      if (evt === 'doublexp') { ev.current = '双倍经验'; ev.doubleXp = 15; }
      if (evt === 'cursed') { ev.current = '诅咒波次'; ev.cursed = 18; }
      if (evt === 'elite') { ev.current = '精英追猎'; for (let i = 0; i < 3; i++) spawnEnemy(pick(['tank','teleporter','aura']), true); }
      toast(`事件触发：${ev.current}`);
    }

    if (ev.meteor > 0) {
      ev.meteor -= dt;
      state._meteorCd = (state._meteorCd || 0) - dt;
      if (state._meteorCd <= 0) {
        state._meteorCd = 0.35;
        state.aoes.push({ x: rnd(120, W-120), y: rnd(100, H-100), r: 44, t: .5, dmg: 95, color: '#ff8758', kind: 'meteor' });
      }
    }
    ev.doubleXp = Math.max(0, ev.doubleXp - dt);
    ev.cursed = Math.max(0, ev.cursed - dt);
    if (ev.doubleXp <= 0 && ev.cursed <= 0 && ev.meteor <= 0) ev.current = '平稳期';
  }

  // ======================= 升级 / 进化 =======================
  function openUpgrade(doublePick = false) {
    state.inUpgrade = true;
    state.paused = true;
    show('upgrade', true);

    const choices = buildUpgradeChoices(3 + (doublePick ? 1 : 0)).slice(0, 3);
    const wrap = document.getElementById('upgradeChoices');
    wrap.innerHTML = '';
    choices.forEach((c) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<h3>${c.title}</h3><p>${c.desc}</p>`;
      card.onclick = () => {
        c.apply();
        checkEvolution();
        state.inUpgrade = false;
        state.paused = false;
        show('upgrade', false);
      };
      wrap.appendChild(card);
    });
  }

  function buildUpgradeChoices(n = 3) {
    const opts = [];

    const lockedWeapons = WEAPONS.filter((w) => meta.unlockedWeapons.includes(w.id));
    const newWeapons = lockedWeapons.filter((w) => !state.weaponBag.find((x) => x.id === w.id));
    if (newWeapons.length) {
      opts.push(...newWeapons.map((w) => ({ title: `新武器：${w.name}`, desc: '解锁该武器 Lv1', apply: () => addWeapon(w.id, 1) })));
    }

    opts.push(...state.weaponBag.map((w) => {
      const info = WEAPONS.find((x) => x.id === w.id);
      return { title: `强化武器：${info.name}`, desc: `武器等级 ${w.level} -> ${Math.min(8,w.level+1)}`, apply: () => addWeapon(w.id, 1) };
    }));

    const newPassives = PASSIVES.filter((p) => !state.passiveBag.find((x) => x.id === p.id));
    opts.push(...newPassives.map((p) => ({ title: `新被动：${p.name}`, desc: p.desc, apply: () => addPassive(p.id, 1) })));
    opts.push(...state.passiveBag.map((p) => {
      const info = PASSIVES.find((x) => x.id === p.id);
      return { title: `强化被动：${info.name}`, desc: `${info.desc}（Lv${p.level + 1}）`, apply: () => addPassive(p.id, 1) };
    }));

    // 去重洗牌
    const uniq = [];
    const seen = new Set();
    for (const o of opts) {
      if (seen.has(o.title)) continue;
      seen.add(o.title);
      uniq.push(o);
    }
    uniq.sort(() => Math.random() - 0.5);
    return uniq.slice(0, n);
  }

  function checkEvolution() {
    const has = (id) => !!state.weaponBag.find((w) => w.id === id);
    const pl = (id) => getPassiveLevel(id);

    const evolve = (from, to) => {
      const w = state.weaponBag.find((x) => x.id === from);
      if (!w) return;
      w.id = to; w.level = Math.max(w.level, 6);
      toast(`武器进化：${WEAPONS.find((x) => x.id === to)?.name || to}`);
    };

    if (has('ember_orb') && pl('burn') >= 2) evolve('ember_orb', 'meteor_call');
    if (has('arc_laser') && pl('cdr') >= 2) evolve('arc_laser', 'chain_bolt');
    if (has('void_rift') && pl('aoe') >= 2) evolve('void_rift', 'gravity_well');
  }

  // ======================= 渲染 =======================
  function drawWorld() {
    // 背景层
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake;
      ctx.translate(rnd(-mag, mag), rnd(-mag, mag));
    }
    for (let i = 0; i < 90; i++) {
      const x = (i * 147 + state.time * (i % 3 + 1) * 12) % (W + 120) - 60;
      const y = (i * 83 + state.time * (i % 5 + 1) * 8) % (H + 120) - 60;
      ctx.fillStyle = `rgba(80,120,255,${0.08 + (i % 8) * 0.01})`;
      ctx.beginPath(); ctx.arc(x, y, (i % 3) + 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // 地形
    for (const t of state.terrain) {
      if (t.type === 'wall') {
        ctx.fillStyle = 'rgba(90,108,160,.5)';
        ctx.strokeStyle = 'rgba(170,198,255,.6)';
      } else {
        ctx.fillStyle = 'rgba(255,96,70,.25)';
        ctx.strokeStyle = 'rgba(255,137,92,.75)';
      }
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // AOE
    for (const a of state.aoes) {
      ctx.fillStyle = `${a.color}33`;
      ctx.strokeStyle = `${a.color}aa`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // 经验球/宝箱
    state.xpOrbs.forEach((o) => { ctx.fillStyle = '#ffd75d'; ctx.beginPath(); ctx.arc(o.x,o.y,4,0,Math.PI*2); ctx.fill(); });
    state.chests.forEach((c) => { ctx.fillStyle = '#b7f6ff'; ctx.fillRect(c.x-8,c.y-8,16,16); });

    // 玩家
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#6cf8ff';
    ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#d9ffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo((mouse.x-p.x)*0.12, (mouse.y-p.y)*0.12); ctx.stroke();
    if (p.shield > 0) { ctx.strokeStyle = '#9f79ff'; ctx.beginPath(); ctx.arc(0,0,p.r+6,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();

    // 敌人
    for (const e of state.enemies) {
      ctx.fillStyle = ENEMY_TYPES[e.type]?.color || '#ff799d';
      const r = e.type === 'boss' ? 22 : e.elite ? 14 : 10;
      ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(e.x-r, e.y-r-8, r*2, 4);
      ctx.fillStyle = '#ff5f79'; ctx.fillRect(e.x-r, e.y-r-8, (e.hp/e.maxHp)*r*2, 4);
      if (e.burn > 0) { ctx.strokeStyle = '#ff8f5a'; ctx.strokeRect(e.x-r-2,e.y-r-2,r*2+4,r*2+4); }
      if (e.freeze > 0) { ctx.strokeStyle = '#8fd8ff'; ctx.strokeRect(e.x-r-2,e.y-r-2,r*2+4,r*2+4); }
    }

    // 子弹
    state.bullets.forEach((b) => { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill(); });
    state.enemyBullets.forEach((b) => { ctx.fillStyle = '#ff6c88'; ctx.beginPath(); ctx.arc(b.x,b.y,3.5,0,Math.PI*2); ctx.fill(); });

    // 粒子
    for (const pz of state.particles) {
      ctx.fillStyle = pz.color;
      ctx.globalAlpha = Math.max(0, pz.t / 0.7);
      ctx.beginPath(); ctx.arc(pz.x, pz.y, pz.s, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 伤害数字
    for (const t of state.floatTexts) {
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px Segoe UI';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function updateHUD() {
    document.getElementById('hudChar').textContent = state.selectedChar.name;
    document.getElementById('hudHp').textContent = `${Math.max(0,Math.floor(state.player.hp))}/${Math.floor(state.player.maxHp)} (+盾${Math.floor(state.player.shield)})`;
    document.getElementById('hudLv').textContent = state.level;
    document.getElementById('hudKills').textContent = state.kills;
    document.getElementById('hudTime').textContent = fmtTime(state.time);
    document.getElementById('hudMod').textContent = state.mapMod.name;
    document.getElementById('hudEvent').textContent = state.events.current;
    const missionPending = state.missions.find((m) => !m.done);
    document.getElementById('hudMission').textContent = missionPending
      ? `${missionPending.label} (${Math.floor(state.missionProgress[missionPending.id] || 0)}/${missionPending.target})`
      : '全部完成';

    document.getElementById('hpBar').style.width = `${clamp(state.player.hp / state.player.maxHp, 0, 1) * 100}%`;
    document.getElementById('xpBar').style.width = `${clamp(state.xp / state.xpNeed, 0, 1) * 100}%`;

    document.getElementById('weaponList').innerHTML = state.weaponBag.map((w) => `<li>${WEAPONS.find(x=>x.id===w.id)?.name||w.id} Lv${w.level}</li>`).join('');
    document.getElementById('passiveList').innerHTML = state.passiveBag.map((p) => `<li>${PASSIVES.find(x=>x.id===p.id)?.name||p.id} Lv${p.level}</li>`).join('');
  }

  const fmtTime = (t) => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;

  // ======================= 开局/结算/菜单 =======================
  function rollMapMod() {
    state.mapMod = pick(MAP_MODIFIERS);
    document.getElementById('mapMods').innerHTML = MAP_MODIFIERS.map((m) => `<span class="tag">${m.name}：${m.desc}</span>`).join('');
  }

  function refreshCharList() {
    const wrap = document.getElementById('charList');
    wrap.innerHTML = '';
    CHARACTERS.forEach((c) => {
      const unlocked = meta.unlockedChars.includes(c.id) || !c.unlock;
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<h3>${c.name}</h3><p>${c.talent}</p><p>${unlocked ? '已解锁' : `解锁需要 ${c.unlock} 水晶`}</p>`;
      card.style.opacity = unlocked ? '1' : '.45';
      card.onclick = () => {
        if (!unlocked) return toast('未解锁角色');
        state.selectedChar = c;
        toast(`已选择：${c.name}`);
      };
      wrap.appendChild(card);
    });
  }

  function startRun(charId) {
    const char = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    state.selectedChar = char;
    state.player = makePlayer(char);
    state.enemies = []; state.bullets = []; state.enemyBullets = []; state.xpOrbs = []; state.particles = []; state.chests = []; state.aoes = [];
    state.time = 0; state.kills = 0; state.level = 1; state.xp = 0; state.xpNeed = 30;
    state.events = { next: rnd(25, 45), current: '平稳期', doubleXp: 0, cursed: 0, meteor: 0 };
    state.rewardCrystals = 0;
    state.terrain = generateTerrain();
    initMissions();
    state.enemySpeedMul = 1; state.fireMul = 1; state.eliteMul = 1; state.xpMul = 1;
    state.mapMod.apply(state);

    state.weaponBag = [];
    state.passiveBag = [];
    addWeapon('pulse_blade', 1);
    addWeapon(pick(meta.unlockedWeapons), 1);
    addPassive('move', 1);

    state.running = true; state.paused = false; state.inUpgrade = false;
    showOnly('game');
    show('upgrade', false); show('result', false); show('unlock', false); show('settings', false);
    toast(`地图词缀：${state.mapMod.name}`);
  }

  function endRun(win) {
    state.running = false;
    meta.crystals += Math.floor(state.rewardCrystals + state.time / 12 + (win ? 80 : 25));
    meta.bestTime = Math.max(meta.bestTime, state.time);

    // 解锁推进
    CHARACTERS.forEach((c) => {
      if (c.unlock && meta.crystals >= c.unlock && !meta.unlockedChars.includes(c.id)) meta.unlockedChars.push(c.id);
    });
    if (meta.crystals >= 160) meta.unlockedWeapons = [...new Set([...meta.unlockedWeapons, 'gravity_well', 'meteor_call', 'void_rift', 'chain_bolt'])];
    if (meta.crystals >= 360) meta.difficulty = 2;

    saveMeta();

    document.getElementById('resultTitle').textContent = win ? '生还成功！' : '你被潮汐吞没';
    document.getElementById('resultStats').textContent = `存活 ${fmtTime(state.time)} ｜ 击杀 ${state.kills} ｜ 水晶 +${Math.floor(state.rewardCrystals)}`;
    document.getElementById('resultBuild').textContent = `Build：${state.weaponBag.map(w => WEAPONS.find(x=>x.id===w.id)?.name || w.id).join(' / ')} ｜ 被动：${state.passiveBag.map(p => PASSIVES.find(x=>x.id===p.id)?.name || p.id).join(' / ')}`;
    show('result', true);
  }

  function openUnlock() {
    const info = `当前水晶：${meta.crystals} ｜ 最佳生存：${fmtTime(meta.bestTime)} ｜ 难度：${meta.difficulty}`;
    document.getElementById('metaInfo').textContent = info;
    const list = document.getElementById('unlockContent');
    list.innerHTML = CHARACTERS.map((c) => {
      const ok = meta.unlockedChars.includes(c.id) || !c.unlock;
      return `<article class="card"><h3>${c.name}</h3><p>${c.talent}</p><p>${ok ? '已解锁' : `需要 ${c.unlock} 水晶`}</p></article>`;
    }).join('') + WEAPONS.map((w) => {
      const ok = meta.unlockedWeapons.includes(w.id);
      return `<article class="card"><h3>武器图鉴：${w.name}</h3><p>${ok ? '可在本局随机出现' : '暂未解锁'}</p></article>`;
    }).join('') + PASSIVES.map((p) => {
      return `<article class="card"><h3>被动图鉴：${p.name}</h3><p>${p.desc}</p></article>`;
    }).join('');
    show('unlock', true);
  }

  // ======================= 主循环 =======================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state.running && !state.paused && !state.inUpgrade) {
      state.time += dt;
      if (state.time >= RUN_TIME_TARGET) endRun(true);

      updatePlayer(dt);
      spawnWave(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateAOE(dt);
      updateOrbs(dt);
      updateEvents(dt);
      updateMissions(dt);

      const stats = getStats();
      state.weaponBag.forEach((w) => fireWeapon(w, dt, stats));

      for (const p of state.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
      }
      state.particles = state.particles.filter((p) => p.t > 0);
      for (const t of state.floatTexts) {
        t.y += t.vy * dt;
        t.t -= dt;
      }
      state.floatTexts = state.floatTexts.filter((t) => t.t > 0);
      state.shake = Math.max(0, state.shake - dt * 18);
    }

    if (screens.game.classList.contains('active')) {
      drawWorld();
      updateHUD();
    }

    requestAnimationFrame(loop);
  }

  // ======================= UI绑定 =======================
  const setShakeEl = document.getElementById('setShake');
  const setDamageEl = document.getElementById('setDamageNum');
  const setLiteFxEl = document.getElementById('setLiteFx');
  setShakeEl.checked = state.settings.shake;
  setDamageEl.checked = state.settings.damageNum;
  setLiteFxEl.checked = state.settings.liteFx;
  setShakeEl.onchange = () => { state.settings.shake = setShakeEl.checked; saveSettings(); };
  setDamageEl.onchange = () => { state.settings.damageNum = setDamageEl.checked; saveSettings(); };
  setLiteFxEl.onchange = () => { state.settings.liteFx = setLiteFxEl.checked; saveSettings(); };

  document.getElementById('startBtn').onclick = () => startRun(state.selectedChar.id);
  document.getElementById('pauseBtn').onclick = () => state.paused = !state.paused;
  document.getElementById('unlockBtn').onclick = () => openUnlock();
  document.getElementById('closeUnlockBtn').onclick = () => show('unlock', false);
  document.getElementById('againBtn').onclick = () => startRun(state.selectedChar.id);
  document.getElementById('menuBtn').onclick = () => { showOnly('menu'); rollMapMod(); refreshCharList(); };
  document.getElementById('settingsBtn').onclick = () => show('settings', true);
  document.getElementById('closeSettingsBtn').onclick = () => show('settings', false);

  // 初始
  rollMapMod();
  refreshCharList();
  showOnly('menu');
  requestAnimationFrame(loop);
})();
