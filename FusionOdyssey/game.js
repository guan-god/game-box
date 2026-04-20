const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  wave: document.getElementById("wave"),
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  hpFill: document.getElementById("hpFill"),
  xpFill: document.getElementById("xpFill"),
  lvl: document.getElementById("lvl"),
  dash: document.getElementById("dash"),
  overdrive: document.getElementById("overdrive"),
  event: document.getElementById("event"),
  eventDesc: document.getElementById("eventDesc"),
  upgradePanel: document.getElementById("upgradePanel"),
  upgradeList: document.getElementById("upgradeList"),
};

const keys = new Set();
document.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const state = {
  t: 0,
  score: 0,
  wave: 1,
  waveTimer: 0,
  paused: false,
  gameOver: false,
  flashes: [],
  particles: [],
  pickups: [],
  terrains: [],
  banners: [],
  bullets: [],
  enemyBullets: [],
  enemies: [],
  gems: [],
  orbitals: [],
  eventTimer: 0,
  activeEvent: null,
  eventDuration: 0,
  combo: 0,
  comboTimer: 0,
  shake: 0,
  arenaRadius: 660,
  bossIntro: 0,
  world: { w: 3200, h: 2200 },
  camera: { x: 0, y: 0 },
  enemyBuff: 1,
  playerBuffTimer: 0,
  mission: null,
};

const player = {
  x: 1600,
  y: 1100,
  r: 14,
  hp: 120,
  hpMax: 120,
  speed: 250,
  damage: 20,
  fireRate: 5,
  bulletSpeed: 680,
  bulletSize: 8,
  pierce: 0,
  xp: 0,
  xpNeed: 100,
  level: 1,
  shootCd: 0,
  dashCd: 0,
  dashTimer: 0,
  iframe: 0,
  lifeSteal: 0,
  critChance: 0.05,
  critMul: 1.7,
  multiShot: 1,
  shield: 0,
  shieldMax: 0,
  shieldRegen: 0,
  overdrive: 0,
  healMul: 1,
  dmgMul: 1,
  hasteMul: 1,
};

const upgrades = [
  { id: "dmg", name: "高能弹头", desc: "+25% 伤害", apply: () => (player.damage *= 1.25) },
  { id: "rate", name: "过载扳机", desc: "+20% 射速", apply: () => (player.fireRate *= 1.2) },
  { id: "speed", name: "离子推进", desc: "+15% 移速", apply: () => (player.speed *= 1.15) },
  {
    id: "vamp",
    name: "吸能核心",
    desc: "命中回复 2% 最大生命",
    apply: () => (player.lifeSteal = Math.min(0.1, player.lifeSteal + 0.02)),
  },
  {
    id: "vital",
    name: "生命熔炉",
    desc: "+30 最大生命并回复 30",
    apply: () => {
      player.hpMax += 30;
      player.hp = Math.min(player.hpMax, player.hp + 30);
    },
  },
  {
    id: "pierce",
    name: "穿透协议",
    desc: "+1 子弹穿透",
    apply: () => player.pierce++,
  },
  {
    id: "orb",
    name: "轨道刃环",
    desc: "生成旋转无人机刀刃",
    apply: () => {
      state.orbitals.push({ angle: Math.random() * Math.PI * 2, dist: 65, dmg: player.damage * 0.6 });
    },
  },
  {
    id: "crit",
    name: "弱点识别",
    desc: "+8% 暴击率（暴击 1.7 倍）",
    apply: () => (player.critChance = Math.min(0.6, player.critChance + 0.08)),
  },
  {
    id: "double",
    name: "分裂射击",
    desc: "每次攻击 +1 额外弹道（轻微散射）",
    apply: () => (player.multiShot = Math.min(4, player.multiShot + 1)),
  },
  {
    id: "barrier",
    name: "相位护盾",
    desc: "+40 护盾上限并缓慢回复",
    apply: () => {
      player.shieldMax += 40;
      player.shield = Math.min(player.shieldMax, player.shield + 25);
      player.shieldRegen = Math.min(16, player.shieldRegen + 2.5);
    },
  },
];

const randomEvents = [
  { id: "swarm", name: "虫潮暴走", desc: "10秒内刷怪速度大幅提升", duration: 10 },
  { id: "bloodmoon", name: "血月压境", desc: "12秒内敌人移速和伤害提升", duration: 12 },
  { id: "jam", name: "火力干扰", desc: "8秒内你的射速下降", duration: 8 },
  { id: "storm", name: "陨星风暴", desc: "随机区域连续落陨石", duration: 9 },
  { id: "drought", name: "重伤力场", desc: "12秒内治疗效果降低 75%", duration: 12 },
  { id: "fog", name: "收缩毒圈", desc: "12秒内安全区域缩小，越界持续掉血", duration: 12 },
  { id: "eliteRush", name: "精英暴动", desc: "12秒内精英刷新概率翻倍", duration: 12 },
];

const pickupTypes = [
  { id: "heal", color: "#8bff9f", label: "修复包" },
  { id: "bomb", color: "#ffd166", label: "清场弹" },
  { id: "haste", color: "#77d2ff", label: "超频芯片" },
  { id: "magnet", color: "#d0a2ff", label: "磁吸模块" },
];

const missionPool = [
  { id: "kill", title: "清剿令", desc: "20秒内击杀 18 只敌人", goal: 18, time: 20 },
  { id: "elite", title: "斩首令", desc: "25秒内击杀 2 只精英/首领", goal: 2, time: 25 },
  { id: "noHit", title: "极限闪避", desc: "12秒内不受伤", goal: 12, time: 12 },
];

function startMission() {
  if (state.mission) return;
  const m = { ...missionPool[Math.floor(Math.random() * missionPool.length)], progress: 0, t: 0, failed: false };
  state.mission = m;
  state.banners.push({ title: `任务：${m.title}`, sub: m.desc, t: 2.6 });
}

function resolveMission(success) {
  if (!state.mission) return;
  if (success) {
    player.dmgMul = 1.2;
    player.hasteMul = 1.2;
    state.playerBuffTimer = 18;
    state.banners.push({ title: "任务完成", sub: "你获得了临时强化（伤害+攻速）", t: 2.4 });
  } else {
    player.fireRate *= 0.92;
    player.speed *= 0.95;
    state.enemyBuff = Math.min(2.2, state.enemyBuff + 0.12);
    state.banners.push({ title: "任务失败", sub: "你被削弱且敌人进入狂暴", t: 2.4 });
  }
  state.mission = null;
}

function addParticle(x, y, n = 8, color = "#7ce6ff") {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.25, 0.8),
      c: color,
      s: rand(1, 3),
    });
  }
}

function createTerrain() {
  state.terrains = [];
  const count = 5 + Math.min(8, Math.floor(state.wave / 2));
  for (let i = 0; i < count; i++) {
    state.terrains.push({
      x: rand(180, state.world.w - 180),
      y: rand(150, state.world.h - 150),
      r: rand(22, 46),
    });
  }
}

function resolveWallCollision(entity, padding = 8) {
  for (const t of state.terrains) {
    const dx = entity.x - t.x;
    const dy = entity.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = (entity.r || 10) + t.r + padding;
    if (d < minD) {
      entity.x = t.x + (dx / d) * minD;
      entity.y = t.y + (dy / d) * minD;
    }
  }
}

function spawnEnemy(kind = "chaser") {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) [x, y] = [rand(0, state.world.w), -20];
  if (side === 1) [x, y] = [state.world.w + 20, rand(0, state.world.h)];
  if (side === 2) [x, y] = [rand(0, state.world.w), state.world.h + 20];
  if (side === 3) [x, y] = [-20, rand(0, state.world.h)];

  const diff = 1 + state.wave * 0.08 + player.level * 0.05 + state.t * 0.004;
  const base = {
    x,
    y,
    hitFlash: 0,
    shootCd: rand(0.8, 1.6),
  };
  if (kind === "chaser") {
    state.enemies.push({ ...base, kind, r: 12, hp: (38 + state.wave * 5) * diff * state.enemyBuff, speed: 90 + state.wave * 2 + player.level, dmg: 10 * diff * state.enemyBuff });
  } else if (kind === "shooter") {
    state.enemies.push({ ...base, kind, r: 13, hp: (30 + state.wave * 4) * diff * state.enemyBuff, speed: 60 + state.wave + player.level * 0.7, dmg: 9 * diff * state.enemyBuff });
  } else if (kind === "tank") {
    state.enemies.push({ ...base, kind, r: 22, hp: (160 + state.wave * 18) * diff * state.enemyBuff, speed: 45 + state.wave + player.level * 0.4, dmg: 18 * diff * state.enemyBuff });
  } else if (kind === "boss") {
    state.enemies.push({ ...base, kind, r: 46, hp: (1800 + state.wave * 250) * (1 + player.level * 0.06) * (state.enemyBuff + 0.25), speed: 70 + player.level * 0.8, dmg: 24 * diff * state.enemyBuff, phase: 1 });
    state.banners.push({ title: "⚠ BOSS 入侵", sub: "高能目标锁定中...", t: 2.8 });
    state.bossIntro = 1.8;
  }
  const latest = state.enemies[state.enemies.length - 1];
  const eliteChance = state.activeEvent === "eliteRush" ? 0.4 : 0.18;
  if (latest && latest.kind !== "boss" && state.wave >= 4 && Math.random() < eliteChance) {
    latest.elite = true;
    latest.r *= 1.2;
    latest.hp *= 1.9;
    latest.speed *= 1.2;
    latest.dmg *= 1.35;
  }
}

function shootAt(target) {
  if (!target) return;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const baseAngle = Math.atan2(dy, dx);
  for (let i = 0; i < player.multiShot; i++) {
    const spread = (i - (player.multiShot - 1) / 2) * 0.09;
    const a = baseAngle + spread;
    const crit = Math.random() < player.critChance;
    state.bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(a) * player.bulletSpeed,
      vy: Math.sin(a) * player.bulletSpeed,
      life: 1.4,
      dmg: player.damage * player.dmgMul * (crit ? player.critMul : 1),
      r: player.bulletSize + (crit ? 1.5 : 0),
      pierce: player.pierce,
      crit,
    });
  }
}

function hitPlayer(dmg) {
  if (player.iframe > 0 || player.gameOver) return;
  if (state.mission?.id === "noHit") state.mission.failed = true;
  if (player.shield > 0) {
    const absorb = Math.min(player.shield, dmg);
    player.shield -= absorb;
    dmg -= absorb;
  }
  if (dmg > 0) player.hp -= dmg * state.enemyBuff;
  player.iframe = 0.4;
  state.flashes.push({ t: 0.1, c: "#ff5b7f" });
  if (player.hp <= 0) {
    player.hp = 0;
    state.gameOver = true;
  }
}

function triggerRandomEvent() {
  const event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  state.activeEvent = event.id;
  state.eventDuration = event.duration;
  ui.event.textContent = event.name;
  ui.eventDesc.textContent = event.desc;
  state.banners.push({ title: `随机事件：${event.name}`, sub: event.desc, t: 2.6 });
  if (event.id === "drought") player.healMul = 0.25;
  if (event.id === "fog") state.arenaRadius = Math.min(state.world.w, state.world.h) * 0.22;
}

function clearEvent() {
  state.activeEvent = null;
  state.eventDuration = 0;
  ui.event.textContent = "无";
  ui.eventDesc.textContent = "事件已结束";
  player.healMul = 1;
  state.arenaRadius = Math.min(state.world.w, state.world.h) * 0.30;
}

function pickUpgrades() {
  state.paused = true;
  ui.upgradePanel.classList.remove("hide");
  ui.upgradeList.innerHTML = "";
  const pool = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach((u, i) => {
    const el = document.createElement("div");
    el.className = "upgrade";
    el.innerHTML = `<b>${i + 1}. ${u.name}</b><div style="font-size:13px;color:#9fc2ff">${u.desc}</div>`;
    el.onclick = () => chooseUpgrade(i, pool);
    ui.upgradeList.appendChild(el);
  });
  state.currentUpgradePool = pool;
}

function chooseUpgrade(i, pool = state.currentUpgradePool) {
  if (!state.paused || !pool?.[i]) return;
  pool[i].apply();
  state.paused = false;
  ui.upgradePanel.classList.add("hide");
}

document.addEventListener("keydown", (e) => {
  if (["1", "2", "3"].includes(e.key)) chooseUpgrade(Number(e.key) - 1);
  if (e.key.toLowerCase() === "q" && player.overdrive >= 100 && !state.paused && !state.gameOver) {
    player.overdrive = 0;
    state.shake = 0.2;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      e.hp -= Math.max(80, 240 - d * 0.28);
      e.hitFlash = 0.2;
    }
    addParticle(player.x, player.y, 70, "#ffe37a");
  }
});

function update(dt) {
  if (state.gameOver) return;
  state.t += dt;
  state.shake = Math.max(0, state.shake - dt);
  state.bossIntro = Math.max(0, state.bossIntro - dt);
  state.banners = state.banners.filter((b) => (b.t -= dt) > 0);
  state.playerBuffTimer = Math.max(0, state.playerBuffTimer - dt);
  if (state.playerBuffTimer <= 0) {
    player.dmgMul = 1;
    player.hasteMul = 1;
  }
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer <= 0) state.combo = 0;
  if (state.paused) return;

  player.iframe = Math.max(0, player.iframe - dt);
  player.shootCd -= dt;
  player.dashCd -= dt;
  player.dashTimer -= dt;
  if (player.shieldRegen > 0) player.shield = Math.min(player.shieldMax, player.shield + player.shieldRegen * dt);

  let mx = 0;
  let my = 0;
  if (keys.has("w")) my -= 1;
  if (keys.has("s")) my += 1;
  if (keys.has("a")) mx -= 1;
  if (keys.has("d")) mx += 1;
  const mLen = Math.hypot(mx, my) || 1;

  if (keys.has(" ") && player.dashCd <= 0) {
    player.dashCd = 3;
    player.dashTimer = 0.18;
    player.iframe = 0.25;
  }
  const dashMult = player.dashTimer > 0 ? 3.2 : 1;
  player.x += (mx / mLen) * player.speed * dashMult * dt;
  player.y += (my / mLen) * player.speed * dashMult * dt;
  player.x = clamp(player.x, 10, state.world.w - 10);
  player.y = clamp(player.y, 10, state.world.h - 10);
  resolveWallCollision(player, 3);

  if (state.activeEvent === "fog") {
    const cx = state.world.w / 2;
    const cy = state.world.h / 2;
    const d = Math.hypot(player.x - cx, player.y - cy);
    if (d > state.arenaRadius) hitPlayer((8 + state.wave) * dt);
  }

  state.camera.x = clamp(player.x, canvas.width / 2, state.world.w - canvas.width / 2);
  state.camera.y = clamp(player.y, canvas.height / 2, state.world.h - canvas.height / 2);

  state.waveTimer += dt;
  let spawnRate = Math.max(0.08, 0.8 - state.wave * 0.04 - player.level * 0.015);
  if (state.activeEvent === "swarm") spawnRate *= 0.5;
  if (Math.random() < dt / spawnRate) {
    const r = Math.random();
    if (state.wave % 5 === 0 && !state.enemies.some((e) => e.kind === "boss")) spawnEnemy("boss");
    else if (r < 0.6) spawnEnemy("chaser");
    else if (r < 0.9) spawnEnemy("shooter");
    else spawnEnemy("tank");
  }

  state.eventTimer += dt;
  const nextEventAt = Math.max(12, 22 - player.level * 0.4);
  if (!state.activeEvent && state.eventTimer >= nextEventAt) {
    state.eventTimer = 0;
    triggerRandomEvent();
  }
  if (state.activeEvent) {
    state.eventDuration -= dt;
    if (state.activeEvent === "storm" && Math.random() < dt * 5) {
      const mx = rand(100, state.world.w - 100);
      const my = rand(100, state.world.h - 100);
      state.particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.55, c: "#ffb36b", s: 20, meteor: true });
      if (Math.hypot(player.x - mx, player.y - my) < 85) hitPlayer(18);
      for (const e of state.enemies) {
        if (Math.hypot(e.x - mx, e.y - my) < 75) e.hp -= 120;
      }
    }
    if (state.eventDuration <= 0) clearEvent();
  }

  if (state.waveTimer > 28 && !state.enemies.some((e) => e.kind === "boss")) {
    state.wave++;
    state.waveTimer = 0;
    createTerrain();
    state.banners.push({ title: `第 ${state.wave} 波`, sub: "地形已重构，注意走位", t: 1.8 });
    startMission();
  }

  if (state.mission) {
    state.mission.t += dt;
    if (state.mission.id === "noHit") state.mission.progress += dt;
    if (state.mission.progress >= state.mission.goal) resolveMission(true);
    else if (state.mission.t >= state.mission.time || state.mission.failed) resolveMission(false);
  }

  let nearest = null;
  let nd = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }
  if (player.shootCd <= 0 && nearest) {
    const jam = state.activeEvent === "jam" ? 1.45 : 1;
    const comboBoost = 1 + Math.min(0.5, state.combo * 0.03);
    player.shootCd = jam / (player.fireRate * comboBoost * player.hasteMul);
    shootAt(nearest);
  }

  for (const o of state.orbitals) {
    o.angle += dt * 2.4;
    const ox = player.x + Math.cos(o.angle) * o.dist;
    const oy = player.y + Math.sin(o.angle) * o.dist;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - ox, e.y - oy) < e.r + 8) {
        e.hp -= o.dmg * dt * 5;
        e.hitFlash = 0.08;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) return false;
    if (b.x < -20 || b.y < -20 || b.x > state.world.w + 20 || b.y > state.world.h + 20) return false;
    for (const t of state.terrains) {
      if (Math.hypot(b.x - t.x, b.y - t.y) < t.r + b.r) return false;
    }

    for (const e of state.enemies) {
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        e.hp -= b.dmg;
        e.hitFlash = 0.08;
        addParticle(b.x, b.y, 6, "#9df6ff");
        if (player.lifeSteal > 0) {
          player.hp = Math.min(player.hpMax, player.hp + player.hpMax * player.lifeSteal * 0.18 * player.healMul);
        }
        if (b.pierce > 0) {
          b.pierce--;
          b.dmg *= 0.8;
          return true;
        }
        return false;
      }
    }
    return true;
  });

  state.enemyBullets = state.enemyBullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r) {
      hitPlayer(b.dmg);
      return false;
    }
    for (const t of state.terrains) {
      if (Math.hypot(b.x - t.x, b.y - t.y) < t.r + b.r) return false;
    }
    return b.life > 0 && b.x > -20 && b.y > -20 && b.x < state.world.w + 20 && b.y < state.world.h + 20;
  });

  state.enemies = state.enemies.filter((e) => {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.hitFlash = Math.max(0, e.hitFlash - dt);

    const bloodMoonSpeed = state.activeEvent === "bloodmoon" ? 1.25 : 1;
    const bloodMoonDmg = state.activeEvent === "bloodmoon" ? 1.3 : 1;
    if (e.kind === "shooter") {
      const prefer = 260;
      const mv = d > prefer ? 1 : -0.5;
      e.x += (dx / d) * e.speed * bloodMoonSpeed * mv * dt;
      e.y += (dy / d) * e.speed * bloodMoonSpeed * mv * dt;
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = rand(0.9, 1.6);
        state.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / d) * 280, vy: (dy / d) * 280, r: 7, life: 4, dmg: e.dmg * bloodMoonDmg });
      }
    } else if (e.kind === "boss") {
      if (e.hp < 900 && e.phase === 1) {
        e.phase = 2;
        e.speed = 130;
        state.banners.push({ title: "BOSS 二阶段", sub: "追加召唤与高密弹幕", t: 2 });
      }
      e.x += (dx / d) * e.speed * bloodMoonSpeed * dt;
      e.y += (dy / d) * e.speed * bloodMoonSpeed * dt;
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = e.phase === 1 ? 0.95 : 0.5;
        const ring = e.phase === 1 ? 10 : 18;
        for (let i = 0; i < ring; i++) {
          const a = (Math.PI * 2 * i) / ring + state.t * 0.25;
          state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 8, life: 5, dmg: 11 * bloodMoonDmg * state.enemyBuff });
        }
        if (e.phase === 2 && Math.random() < 0.45) spawnEnemy(Math.random() < 0.5 ? "shooter" : "chaser");
      }
    } else {
      e.x += (dx / d) * e.speed * bloodMoonSpeed * dt;
      e.y += (dy / d) * e.speed * bloodMoonSpeed * dt;
    }
    resolveWallCollision(e, 2);

    if (d < player.r + e.r) hitPlayer(e.dmg * bloodMoonDmg * dt * 4.5);

    if (e.hp <= 0) {
      addParticle(e.x, e.y, e.kind === "boss" ? 45 : 14, e.kind === "boss" ? "#ffde59" : "#90f7ff");
      state.combo = Math.min(25, state.combo + 1);
      state.comboTimer = 3.5;
      state.score += (e.kind === "boss" ? 1000 : e.kind === "tank" ? 120 : 60) * (1 + state.combo * 0.08);
      player.overdrive = Math.min(100, player.overdrive + (e.kind === "boss" ? 55 : e.elite ? 15 : 7));
      state.gems.push({ x: e.x, y: e.y, v: e.kind === "boss" ? 150 : e.kind === "tank" ? 36 : 18, r: e.kind === "boss" ? 9 : 6 });
      if (state.mission?.id === "kill") state.mission.progress++;
      if (state.mission?.id === "elite" && (e.elite || e.kind === "boss")) state.mission.progress++;
      if (Math.random() < (e.kind === "boss" ? 1 : 0.14)) {
        const tp = pickupTypes[Math.floor(Math.random() * pickupTypes.length)];
        state.pickups.push({ x: e.x, y: e.y, r: 11, ...tp, ttl: 14 });
      }
      return false;
    }
    return true;
  });

  state.gems = state.gems.filter((g) => {
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 150) {
      g.x += (dx / d) * 480 * dt;
      g.y += (dy / d) * 480 * dt;
    }
    if (d < player.r + g.r + 5) {
      player.xp += g.v;
      return false;
    }
    return true;
  });

  state.pickups = state.pickups.filter((p) => {
    p.ttl -= dt;
    if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r + 4) {
      if (p.id === "heal") player.hp = Math.min(player.hpMax, player.hp + player.hpMax * 0.22 * player.healMul);
      if (p.id === "bomb") {
        for (const e of state.enemies) e.hp -= 260;
        state.enemyBullets = [];
        state.shake = 0.2;
      }
      if (p.id === "haste") player.fireRate *= 1.12;
      if (p.id === "magnet") {
        for (const g of state.gems) {
          g.x += (player.x - g.x) * 0.75;
          g.y += (player.y - g.y) * 0.75;
        }
      }
      state.banners.push({ title: `获得道具：${p.label}`, sub: "来自狂潮式战斗掉落", t: 1.6 });
      return false;
    }
    return p.ttl > 0;
  });

  while (player.xp >= player.xpNeed) {
    player.xp -= player.xpNeed;
    player.level++;
    player.xpNeed = Math.floor(player.xpNeed * 1.25 + 28);
    pickUpgrades();
  }

  state.particles = state.particles.filter((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
    return p.life > 0;
  });

  state.flashes = state.flashes.filter((f) => (f.t -= dt) > 0);
}

function drawGrid() {
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#27406e";
  for (let x = 0; x < state.world.w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.world.h);
    ctx.stroke();
  }
  for (let y = 0; y < state.world.h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.world.w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = state.camera.x - canvas.width / 2;
  const camY = state.camera.y - canvas.height / 2;
  if (state.shake > 0) {
    ctx.save();
    ctx.translate(rand(-9, 9) * state.shake, rand(-9, 9) * state.shake);
  }
  ctx.save();
  ctx.translate(-camX, -camY);
  drawGrid();

  if (state.activeEvent === "fog") {
    const cx = state.world.w / 2;
    const cy = state.world.h / 2;
    ctx.fillStyle = "#4bd1a122";
    ctx.beginPath();
    ctx.arc(cx, cy, state.arenaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4bd1a1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, state.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const t of state.terrains) {
    ctx.fillStyle = "#2f3d62";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#45598f";
    ctx.stroke();
  }

  for (const g of state.gems) {
    ctx.fillStyle = "#67e8ff";
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of state.pickups) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.font = "12px Segoe UI";
    ctx.fillText("道具", p.x - 12, p.y + 4);
  }

  for (const b of state.bullets) {
    ctx.fillStyle = b.crit ? "#ffe37a" : "#9df6ff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.enemyBullets) {
    ctx.fillStyle = "#ff8ca2";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const o of state.orbitals) {
    const ox = player.x + Math.cos(o.angle) * o.dist;
    const oy = player.y + Math.sin(o.angle) * o.dist;
    ctx.fillStyle = "#ffd96f";
    ctx.beginPath();
    ctx.arc(ox, oy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of state.enemies) {
    ctx.fillStyle = e.hitFlash > 0 ? "#fff" : e.elite ? "#ff3d3d" : e.kind === "boss" ? "#ffcf66" : e.kind === "tank" ? "#e2698f" : e.kind === "shooter" ? "#b185ff" : "#ff7398";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    const w = e.r * 1.8;
    ctx.fillStyle = "#263353";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = "#7ef5a6";
    const ratio = clamp(e.hp / (e.kind === "boss" ? 1800 + state.wave * 250 : e.kind === "tank" ? 160 + state.wave * 18 : e.kind === "shooter" ? 30 + state.wave * 4 : 38 + state.wave * 5), 0, 1);
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * ratio, 4);
  }

  ctx.fillStyle = player.iframe > 0 ? "#fff" : "#61dafb";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  for (const f of state.flashes) {
    ctx.globalAlpha = f.t * 0.5;
    ctx.fillStyle = f.c;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = 1;

  if (state.gameOver) {
    ctx.fillStyle = "#0009";
    ctx.fillRect(camX, camY, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px Segoe UI";
    ctx.fillText("任务失败", state.camera.x - 140, state.camera.y - 20);
    ctx.font = "26px Segoe UI";
    ctx.fillText("按 F5 重新开始", state.camera.x - 95, state.camera.y + 35);
  }
  ctx.restore();

  const mmW = 210;
  const mmH = 130;
  const mmX = canvas.width - mmW - 20;
  const mmY = 20;
  ctx.fillStyle = "#0009";
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = "#67e8ff";
  ctx.strokeRect(mmX, mmY, mmW, mmH);
  const sx = mmW / state.world.w;
  const sy = mmH / state.world.h;
  ctx.fillStyle = "#7f8db9";
  for (const t of state.terrains) ctx.fillRect(mmX + t.x * sx - 1, mmY + t.y * sy - 1, 2, 2);
  ctx.fillStyle = "#ff6b8c";
  for (let i = 0; i < Math.min(120, state.enemies.length); i++) {
    const e = state.enemies[i];
    ctx.fillRect(mmX + e.x * sx - 1, mmY + e.y * sy - 1, 2, 2);
  }
  ctx.fillStyle = "#61dafb";
  ctx.beginPath();
  ctx.arc(mmX + player.x * sx, mmY + player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b2ecff";
  ctx.strokeRect(mmX + camX * sx, mmY + camY * sy, canvas.width * sx, canvas.height * sy);
  if (state.bossIntro > 0) {
    ctx.globalAlpha = Math.min(0.85, state.bossIntro / 1.8);
    ctx.fillStyle = "#000b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffcc55";
    ctx.font = "bold 82px Segoe UI";
    ctx.fillText("BOSS ARRIVAL", canvas.width / 2 - 260, canvas.height / 2 - 10);
    ctx.font = "28px Segoe UI";
    ctx.fillText("请准备闪避与爆发输出", canvas.width / 2 - 135, canvas.height / 2 + 34);
    ctx.globalAlpha = 1;
  }
  if (state.banners[0]) {
    const b = state.banners[0];
    ctx.fillStyle = "#0008";
    ctx.fillRect(canvas.width / 2 - 260, 28, 520, 84);
    ctx.strokeStyle = "#67e8ff";
    ctx.strokeRect(canvas.width / 2 - 260, 28, 520, 84);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px Segoe UI";
    ctx.fillText(b.title, canvas.width / 2 - 238, 65);
    ctx.font = "20px Segoe UI";
    ctx.fillStyle = "#9fe6ff";
    ctx.fillText(b.sub, canvas.width / 2 - 238, 94);
  }
  if (state.shake > 0) ctx.restore();
}

function updateUI() {
  ui.wave.textContent = state.wave;
  ui.score.textContent = Math.floor(state.score);
  ui.lvl.textContent = player.level;
  ui.hpFill.style.width = `${(player.hp / player.hpMax) * 100}%`;
  ui.xpFill.style.width = `${(player.xp / player.xpNeed) * 100}%`;
  ui.dash.textContent = `${Math.max(0, player.dashCd).toFixed(1)}s`;
  ui.overdrive.textContent = `${Math.floor(player.overdrive)}%`;
  if (state.combo > 1) ui.score.textContent = `${Math.floor(state.score)}  x${state.combo}`;
  if (state.activeEvent) ui.event.textContent = `${ui.event.textContent.split(" (")[0]} (${Math.ceil(state.eventDuration)}s)`;
  if (state.mission) {
    const p = state.mission.id === "noHit" ? state.mission.progress.toFixed(1) : Math.floor(state.mission.progress);
    ui.eventDesc.textContent = `任务[${state.mission.title}] ${p}/${state.mission.goal} | 剩余 ${Math.max(0, state.mission.time - state.mission.t).toFixed(1)}s`;
  }
  if (player.shieldMax > 0) {
    ui.hpFill.style.background = "linear-gradient(90deg, #8b9dff, #d0d8ff)";
  }
  const t = Math.floor(state.t);
  ui.time.textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

let last = performance.now();
state.arenaRadius = Math.min(state.world.w, state.world.h) * 0.30;
createTerrain();
state.banners.push({ title: "终极融合：孤胆远征", sub: "狂潮模式已激活", t: 2.4 });
startMission();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateUI();
  requestAnimationFrame(loop);
}
loop(last);
