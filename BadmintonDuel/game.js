const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const modePvpBtn = document.getElementById('modePvp');
const modeCpuBtn = document.getElementById('modeCpu');
const restartBtn = document.getElementById('restartBtn');

const W = canvas.width;
const H = canvas.height;
const GROUND = H - 74;
const NET_X = W / 2;
const NET_TOP = GROUND - 145;
const DT = 1 / 60;

const PHYSICS = {
  gravity: 760,
  airDrag: 0.998,
  bounceLoss: 0.74,
};

const PLAYER_SPEED = 340;
const PLAYER_JUMP_SPEED = 520;
const PLAYER_GRAVITY = 1180;
const PLAYER_RADIUS = 26;
const HIT_RADIUS = 94;
const SHUTTLE_RADIUS = 9;
const MAX_SCORE = 11;

const SHOT_CONFIG = {
  clear: { speedX: [280, 360], speedY: [-610, -510], impact: 0.5 },
  smash: { speedX: [530, 680], speedY: [-220, -70], impact: 1.1 },
  net: { speedX: [155, 240], speedY: [-400, -300], impact: 0.35 },
};

const keys = Object.create(null);
const pressedThisFrame = Object.create(null);

const players = [
  {
    name: '红方',
    color: '#ff5a5a',
    x: W * 0.22,
    y: GROUND,
    vy: 0,
    baseX: W * 0.22,
    minX: 70,
    maxX: NET_X - 44,
    controls: {
      left: 'KeyA', right: 'KeyD', clear: 'KeyW', smash: 'KeyS', net: 'KeyQ', jump: 'KeyE'
    },
    score: 0,
    cooldown: 0,
    perfectGlow: 0,
    cpuServeTimer: 0,
  },
  {
    name: '蓝方',
    color: '#4e86ff',
    x: W * 0.78,
    y: GROUND,
    vy: 0,
    baseX: W * 0.78,
    minX: NET_X + 44,
    maxX: W - 70,
    controls: {
      left: 'ArrowLeft', right: 'ArrowRight', clear: 'ArrowUp', smash: 'ArrowDown', net: 'Slash', jump: 'ShiftRight'
    },
    score: 0,
    cooldown: 0,
    perfectGlow: 0,
    cpuServeTimer: 0,
  }
];

const shuttle = {
  x: W * 0.3,
  y: GROUND - 120,
  vx: 0,
  vy: 0,
};

const particles = [];
const shuttleTrail = [];

let mode = 'pvp';
let servingSide = 0;
let winner = null;
let rallyStarted = false;
let rallyHits = 0;
let rallyMomentum = 0;
let wind = 0;
let fxMessage = '';
let fxTimer = 0;
let hitStopFrames = 0;
let cameraShake = 0;

window.addEventListener('keydown', (e) => {
  if (!keys[e.code]) {
    pressedThisFrame[e.code] = true;
  }
  keys[e.code] = true;

  if (winner && e.code === 'Space') {
    restartGame();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

modePvpBtn.addEventListener('click', () => setMode('pvp'));
modeCpuBtn.addEventListener('click', () => setMode('cpu'));
restartBtn.addEventListener('click', () => restartGame());

function setMode(nextMode) {
  mode = nextMode;
  restartGame();
}

function restartGame() {
  winner = null;
  rallyHits = 0;
  rallyMomentum = 0;
  fxMessage = '';
  fxTimer = 0;
  particles.length = 0;
  shuttleTrail.length = 0;
  players[0].score = 0;
  players[1].score = 0;
  servingSide = 0;
  resetRally();
}

function resetRally() {
  rallyStarted = false;
  rallyHits = 0;
  rallyMomentum = 0;
  wind = (Math.random() - 0.5) * 36;

  for (const p of players) {
    p.x = p.baseX;
    p.y = GROUND;
    p.vy = 0;
    p.cooldown = 0;
    p.perfectGlow = 0;
    p.cpuServeTimer = 0.35 + Math.random() * 0.35;
  }

  stickShuttleToServer();
  shuttle.vx = 0;
  shuttle.vy = 0;
  shuttleTrail.length = 0;
}

function randomIn([min, max]) {
  return min + Math.random() * (max - min);
}

function isOnGround(player) {
  return player.y >= GROUND - 0.1;
}

function updatePlayerPhysics(player) {
  player.vy += PLAYER_GRAVITY * DT;
  player.y += player.vy * DT;

  if (player.y > GROUND) {
    player.y = GROUND;
    player.vy = 0;
  }

  player.cooldown = Math.max(0, player.cooldown - DT);
  player.perfectGlow = Math.max(0, player.perfectGlow - DT * 2.4);
}

function canHit(player, side) {
  const ownHalf = side === 0 ? shuttle.x < NET_X + 8 : shuttle.x > NET_X - 8;
  if (!ownHalf || player.cooldown > 0) return false;

  const racketX = player.x;
  const racketY = player.y - 64;
  const dx = shuttle.x - racketX;
  const dy = shuttle.y - racketY;
  return Math.hypot(dx, dy) <= HIT_RADIUS;
}

function showFx(message) {
  fxMessage = message;
  fxTimer = 1;
}

function spawnParticles(x, y, color, count, speedMin = 60, speedMax = 260) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.32 + Math.random() * 0.22,
      maxLife: 0.54,
      color,
      size: 1.5 + Math.random() * 3.5,
    });
  }
}

function applyImpact(power) {
  cameraShake = Math.min(14, cameraShake + 6 * power);
  hitStopFrames = Math.max(hitStopFrames, Math.floor(2 + power * 4));
}

function performHit(player, side, type) {
  if (!canHit(player, side)) return false;

  const dir = side === 0 ? 1 : -1;
  const shot = SHOT_CONFIG[type];

  const timingError = Math.abs(shuttle.y - (player.y - 72));
  const perfect = timingError < 14;
  const perfectBoost = perfect ? 1.13 : 1;
  const momentumBoost = Math.min(1.18, 1 + rallyMomentum * 0.015);

  let vx = dir * randomIn(shot.speedX) * perfectBoost * momentumBoost;
  let vy = randomIn(shot.speedY) * (perfect ? 1.05 : 1);

  const playerIsAirborne = !isOnGround(player);
  if (type === 'smash' && playerIsAirborne) {
    vx *= 1.07;
    vy = Math.min(vy, -40);
  }

  const edgeBias = (player.x - (side === 0 ? player.minX : player.maxX)) / (player.maxX - player.minX);
  const angleAdjust = side === 0 ? edgeBias : (1 - edgeBias);
  vx += dir * (angleAdjust - 0.5) * 120;

  shuttle.vx = vx;
  shuttle.vy = vy;
  rallyStarted = true;
  rallyHits += 1;
  rallyMomentum += 1;
  player.cooldown = 0.11;

  const impactPower = shot.impact + (perfect ? 0.35 : 0) + (type === 'smash' && playerIsAirborne ? 0.25 : 0);
  applyImpact(impactPower);
  spawnParticles(shuttle.x, shuttle.y, perfect ? '#fff4ae' : '#cbe7ff', 12 + Math.floor(impactPower * 8));

  if (perfect) {
    player.perfectGlow = 1;
    showFx('Perfect 击球！');
  }
  if (type === 'smash' && playerIsAirborne) {
    showFx('空中重扣！');
  }
  if (rallyHits > 12 && rallyHits % 6 === 0) {
    showFx(`超长回合 x${rallyHits}`);
  }

  return true;
}

function tryHumanShots(player, side) {
  const { clear, smash, net } = player.controls;
  if (pressedThisFrame[smash]) return performHit(player, side, 'smash');
  if (pressedThisFrame[clear]) return performHit(player, side, 'clear');
  if (pressedThisFrame[net]) return performHit(player, side, 'net');
  return false;
}

function updateHumanPlayer(player, side) {
  const { left, right, jump } = player.controls;

  let move = 0;
  if (keys[left]) move -= 1;
  if (keys[right]) move += 1;

  player.x += move * PLAYER_SPEED * DT;
  player.x = Math.max(player.minX, Math.min(player.maxX, player.x));

  if (pressedThisFrame[jump] && isOnGround(player)) {
    player.vy = -PLAYER_JUMP_SPEED;
    spawnParticles(player.x, player.y - 6, 'rgba(255,255,255,0.7)', 8, 20, 110);
  }

  tryHumanShots(player, side);
  updatePlayerPhysics(player);
}

function predictLandingX() {
  let px = shuttle.x;
  let py = shuttle.y;
  let vx = shuttle.vx;
  let vy = shuttle.vy;

  for (let i = 0; i < 240; i += 1) {
    vy += PHYSICS.gravity * DT;
    vx = vx * PHYSICS.airDrag + wind * DT;
    px += vx * DT;
    py += vy * DT;

    if (px < 16 || px > W - 16) {
      vx *= -0.78;
      px = Math.max(16, Math.min(W - 16, px));
    }
    if (py >= GROUND - SHUTTLE_RADIUS) {
      return px;
    }
  }
  return shuttle.x;
}

function updateCpuPlayer(cpu, side) {
  const home = cpu.baseX;
  const landingX = rallyStarted ? predictLandingX() : home;
  const attackX = Math.max(cpu.minX + 16, Math.min(cpu.maxX - 16, landingX));
  const shuttleOnCpuHalf = side === 1 ? shuttle.x > NET_X : shuttle.x < NET_X;

  const targetX = shuttleOnCpuHalf ? attackX : home;
  const delta = targetX - cpu.x;
  const speedMul = mode === 'cpu' ? 1.05 : 1;
  cpu.x += Math.sign(delta) * PLAYER_SPEED * speedMul * DT;
  cpu.x = Math.max(cpu.minX, Math.min(cpu.maxX, cpu.x));

  const shouldJumpForSmash = shuttleOnCpuHalf && shuttle.y < cpu.y - 120 && Math.abs(shuttle.x - cpu.x) < 90;
  if (shouldJumpForSmash && isOnGround(cpu)) {
    cpu.vy = -PLAYER_JUMP_SPEED * 0.94;
  }

  if (!rallyStarted && servingSide === side) {
    cpu.cpuServeTimer -= DT;
    if (cpu.cpuServeTimer <= 0) {
      performHit(cpu, side, Math.random() < 0.68 ? 'clear' : 'smash');
    }
  } else if (canHit(cpu, side)) {
    const highBall = shuttle.y < GROUND - 220;
    const nearNet = Math.abs(shuttle.x - NET_X) < 92;
    const airborne = !isOnGround(cpu);

    let shot = 'clear';
    if (nearNet && Math.random() < 0.6) shot = 'net';
    else if (highBall || airborne) shot = 'smash';
    else if (Math.random() < 0.45) shot = 'smash';

    performHit(cpu, side, shot);
  }

  updatePlayerPhysics(cpu);
}

function updatePlayers() {
  updateHumanPlayer(players[0], 0);

  if (mode === 'pvp') {
    updateHumanPlayer(players[1], 1);
  } else {
    updateCpuPlayer(players[1], 1);
  }
}

function stickShuttleToServer() {
  const server = players[servingSide];
  const dir = servingSide === 0 ? 1 : -1;
  shuttle.x = server.x + dir * 34;
  shuttle.y = server.y - 74;
}

function updateShuttle() {
  if (!rallyStarted) {
    stickShuttleToServer();
    return;
  }

  shuttle.vy += PHYSICS.gravity * DT;
  shuttle.vx = shuttle.vx * PHYSICS.airDrag + wind * DT;
  shuttle.x += shuttle.vx * DT;
  shuttle.y += shuttle.vy * DT;

  const speed = Math.hypot(shuttle.vx, shuttle.vy);
  shuttleTrail.push({ x: shuttle.x, y: shuttle.y, life: 0.34, speed });
  if (shuttleTrail.length > 16) shuttleTrail.shift();

  if (shuttle.x < 16) {
    shuttle.x = 16;
    shuttle.vx *= -PHYSICS.bounceLoss;
    spawnParticles(shuttle.x, shuttle.y, 'rgba(220,240,255,0.75)', 8);
  }
  if (shuttle.x > W - 16) {
    shuttle.x = W - 16;
    shuttle.vx *= -PHYSICS.bounceLoss;
    spawnParticles(shuttle.x, shuttle.y, 'rgba(220,240,255,0.75)', 8);
  }

  const touchNetX = Math.abs(shuttle.x - NET_X) < 8;
  const touchNetY = shuttle.y + SHUTTLE_RADIUS > NET_TOP && shuttle.y - SHUTTLE_RADIUS < GROUND;
  if (touchNetX && touchNetY) {
    shuttle.x = NET_X + Math.sign(shuttle.x - NET_X || 1) * 9;
    shuttle.vx *= -0.4;
    shuttle.vy *= 0.86;
    applyImpact(0.45);
    spawnParticles(shuttle.x, shuttle.y, 'rgba(230,236,255,0.8)', 10, 40, 140);
  }

  if (shuttle.y + SHUTTLE_RADIUS >= GROUND) {
    const landedLeft = shuttle.x < NET_X;
    const scorer = landedLeft ? 1 : 0;
    players[scorer].score += 1;
    servingSide = scorer;

    applyImpact(0.8);
    spawnParticles(shuttle.x, GROUND - 4, '#fffde5', 22, 50, 240);
    showFx(`${players[scorer].name} 得分！`);

    if (players[scorer].score >= MAX_SCORE) {
      winner = players[scorer].name;
      showFx(`${winner} 拿下比赛！`);
    }

    resetRally();
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= DT;
    p.vy += 500 * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = shuttleTrail.length - 1; i >= 0; i -= 1) {
    shuttleTrail[i].life -= DT;
    if (shuttleTrail[i].life <= 0) shuttleTrail.splice(i, 1);
  }
}

function drawCourt() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#2c9959';
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.strokeStyle = '#f4fcff';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 72, W - 56, GROUND - 72);
  ctx.beginPath();
  ctx.moveTo(NET_X, 72);
  ctx.lineTo(NET_X, GROUND);
  ctx.stroke();

  ctx.fillStyle = '#eceff4';
  ctx.fillRect(NET_X - 4, NET_TOP, 8, GROUND - NET_TOP);

  ctx.fillStyle = 'rgba(20, 30, 44, 0.45)';
  ctx.fillRect(0, 0, W, 68);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText(`${players[0].score} : ${players[1].score}`, W / 2 - 54, 42);

  ctx.font = '17px Segoe UI';
  const modeText = mode === 'pvp' ? '模式：PVP' : '模式：玩家 vs 电脑';
  ctx.fillText(modeText, 28, 42);
  ctx.fillText(`发球方：${players[servingSide].name}`, W - 198, 42);

  const windText = wind > 0 ? `→ 顺风 ${wind.toFixed(1)}` : `← 逆风 ${Math.abs(wind).toFixed(1)}`;
  ctx.fillStyle = '#d3ecff';
  ctx.font = '15px Segoe UI';
  ctx.fillText(`风力: ${windText}`, W / 2 - 72, 63);

  if (!winner && !rallyStarted) {
    ctx.fillStyle = 'rgba(4, 12, 22, 0.72)';
    ctx.fillRect(W / 2 - 278, 88, 556, 56);
    ctx.fillStyle = '#f5fbff';
    ctx.font = '20px Segoe UI';
    ctx.fillText(`${players[servingSide].name} 准备发球：按 高远/扣杀/放网 发球`, W / 2 - 244, 124);
  }

  ctx.fillStyle = '#ecf8ff';
  ctx.font = '16px Segoe UI';
  ctx.fillText(`当前回合拍数：${rallyHits}`, 28, 94);

  const momentumPct = Math.min(100, Math.floor(rallyMomentum * 6));
  ctx.fillStyle = 'rgba(12,25,38,0.55)';
  ctx.fillRect(W - 220, 78, 176, 16);
  ctx.fillStyle = '#ffd36e';
  ctx.fillRect(W - 220, 78, 1.76 * momentumPct, 16);
  ctx.strokeStyle = 'rgba(250, 252, 255, 0.85)';
  ctx.strokeRect(W - 220, 78, 176, 16);
  ctx.fillStyle = '#ffefc6';
  ctx.font = '12px Segoe UI';
  ctx.fillText('节奏槽', W - 218, 90);
}

function drawPlayer(player) {
  const glow = player.perfectGlow;
  if (glow > 0.01) {
    ctx.fillStyle = `rgba(255, 241, 140, ${0.2 + glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 66, PLAYER_RADIUS + 10 + glow * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y - 58, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f7fdff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 32);
  ctx.lineTo(player.x, player.y + 8);
  ctx.stroke();

  ctx.fillStyle = '#f5faff';
  ctx.font = '16px sans-serif';
  ctx.fillText(player.name, player.x - 24, player.y - 86);
}

function drawShuttleTrail() {
  for (const t of shuttleTrail) {
    const alpha = Math.max(0, t.life / 0.34);
    const radius = 3 + (t.speed / 900) * 4;
    ctx.fillStyle = `rgba(214, 238, 255, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShuttle() {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(shuttle.x, shuttle.y, SHUTTLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d9e6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shuttle.x + 5, shuttle.y - 4);
  ctx.lineTo(shuttle.x + 16, shuttle.y - 18);
  ctx.moveTo(shuttle.x + 2, shuttle.y - 7);
  ctx.lineTo(shuttle.x + 12, shuttle.y - 24);
  ctx.stroke();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color.includes('rgba') ? p.color : p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawFx() {
  if (fxTimer <= 0 || !fxMessage) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, fxTimer * 1.2);
  ctx.fillStyle = '#fff7bf';
  ctx.font = 'bold 26px Segoe UI';
  ctx.fillText(fxMessage, W / 2 - ctx.measureText(fxMessage).width / 2, 176);
  ctx.restore();
}

function drawWinner() {
  if (!winner) return;
  ctx.fillStyle = 'rgba(2, 6, 10, 0.74)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f8fbff';
  ctx.font = 'bold 54px Segoe UI';
  ctx.fillText(`${winner} 获胜！`, W / 2 - 148, H / 2 - 20);
  ctx.font = '24px Segoe UI';
  ctx.fillText('按 空格 重新开始（或点击下方按钮）', W / 2 - 182, H / 2 + 30);
}

function endFrameCleanup() {
  for (const code of Object.keys(pressedThisFrame)) {
    delete pressedThisFrame[code];
  }
  if (fxTimer > 0) fxTimer -= DT;
  cameraShake = Math.max(0, cameraShake - 0.8);
}

function drawFrame() {
  const shakeX = cameraShake > 0 ? (Math.random() * 2 - 1) * cameraShake : 0;
  const shakeY = cameraShake > 0 ? (Math.random() * 2 - 1) * cameraShake * 0.7 : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawCourt();
  drawParticles();
  drawPlayer(players[0]);
  drawPlayer(players[1]);
  drawShuttleTrail();
  drawShuttle();
  drawFx();
  drawWinner();

  ctx.restore();
}

function loop() {
  if (hitStopFrames > 0) {
    hitStopFrames -= 1;
    updateParticles();
    drawFrame();
    endFrameCleanup();
    requestAnimationFrame(loop);
    return;
  }

  if (!winner) {
    updatePlayers();
    updateShuttle();
  }
  updateParticles();

  drawFrame();

  endFrameCleanup();
  requestAnimationFrame(loop);
}

resetRally();
loop();
