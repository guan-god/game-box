const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;
const GROUND = H - 74;
const NET_X = W / 2;
const NET_TOP = GROUND - 150;
const DT = 1 / 60;
const GRAVITY = 880;
const PLAYER_SPEED = 320;
const PLAYER_RADIUS = 26;
const HIT_RADIUS = 70;
const SHUTTLE_RADIUS = 9;

const keyState = Object.create(null);

const players = [
  {
    name: '红方',
    color: '#ff5a5a',
    x: W * 0.22,
    y: GROUND,
    minX: 70,
    maxX: NET_X - 40,
    controls: {
      left: 'KeyA', right: 'KeyD', clear: 'KeyW', smash: 'KeyS', net: 'KeyQ'
    },
    score: 0,
    cooldown: 0,
  },
  {
    name: '蓝方',
    color: '#4e86ff',
    x: W * 0.78,
    y: GROUND,
    minX: NET_X + 40,
    maxX: W - 70,
    controls: {
      left: 'ArrowLeft', right: 'ArrowRight', clear: 'ArrowUp', smash: 'ArrowDown', net: 'Slash'
    },
    score: 0,
    cooldown: 0,
  }
];

const shuttle = {
  x: W * 0.3,
  y: GROUND - 120,
  vx: 260,
  vy: -260,
  lastHitter: 0,
};

let servingSide = 0;
let winner = null;

window.addEventListener('keydown', (e) => {
  keyState[e.code] = true;
  if (winner && e.code === 'Space') {
    restart();
  }
});

window.addEventListener('keyup', (e) => {
  keyState[e.code] = false;
});

function restart() {
  winner = null;
  players[0].score = 0;
  players[1].score = 0;
  servingSide = 0;
  resetRally();
}

function resetRally() {
  const server = players[servingSide];
  const dir = servingSide === 0 ? 1 : -1;
  shuttle.x = server.x + dir * 45;
  shuttle.y = GROUND - 160;
  shuttle.vx = dir * 220;
  shuttle.vy = -260;
  shuttle.lastHitter = servingSide;

  players[0].x = W * 0.22;
  players[1].x = W * 0.78;
}

function applyHit(p, type, side) {
  const dir = side === 0 ? 1 : -1;
  const closeEnough = Math.hypot(shuttle.x - p.x, shuttle.y - (p.y - 56)) <= HIT_RADIUS;
  const onOwnSide = side === 0 ? shuttle.x < NET_X : shuttle.x > NET_X;
  if (!closeEnough || p.cooldown > 0 || !onOwnSide) return;

  if (type === 'clear') {
    shuttle.vx = dir * (210 + Math.random() * 90);
    shuttle.vy = -(500 + Math.random() * 70);
  } else if (type === 'smash') {
    shuttle.vx = dir * (460 + Math.random() * 80);
    shuttle.vy = -(110 + Math.random() * 40);
  } else if (type === 'net') {
    shuttle.vx = dir * (130 + Math.random() * 40);
    shuttle.vy = -(320 + Math.random() * 50);
  }

  shuttle.lastHitter = side;
  p.cooldown = 0.16;
}

function updatePlayer(p, side) {
  const { left, right, clear, smash, net } = p.controls;

  let move = 0;
  if (keyState[left]) move -= 1;
  if (keyState[right]) move += 1;
  p.x += move * PLAYER_SPEED * DT;
  p.x = Math.max(p.minX, Math.min(p.maxX, p.x));

  p.cooldown = Math.max(0, p.cooldown - DT);

  if (keyState[clear]) applyHit(p, 'clear', side);
  if (keyState[smash]) applyHit(p, 'smash', side);
  if (keyState[net]) applyHit(p, 'net', side);
}

function updateShuttle() {
  shuttle.vy += GRAVITY * DT;
  shuttle.x += shuttle.vx * DT;
  shuttle.y += shuttle.vy * DT;

  if (shuttle.x < 16) {
    shuttle.x = 16;
    shuttle.vx *= -0.8;
  }
  if (shuttle.x > W - 16) {
    shuttle.x = W - 16;
    shuttle.vx *= -0.8;
  }

  const touchNetX = Math.abs(shuttle.x - NET_X) < 8;
  const belowTop = shuttle.y + SHUTTLE_RADIUS > NET_TOP;
  if (touchNetX && belowTop && shuttle.y < GROUND) {
    shuttle.x = NET_X + Math.sign(shuttle.x - NET_X || 1) * 8;
    shuttle.vx *= -0.5;
    shuttle.vy *= 0.75;
  }

  if (shuttle.y + SHUTTLE_RADIUS >= GROUND) {
    const landedLeft = shuttle.x < NET_X;
    const scorer = landedLeft ? 1 : 0;
    players[scorer].score += 1;
    servingSide = scorer;

    if (players[scorer].score >= 11) {
      winner = players[scorer].name;
    }

    resetRally();
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
  ctx.fillRect(0, 0, W, 62);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText(`${players[0].score} : ${players[1].score}`, W / 2 - 54, 42);
}

function drawPlayer(p) {
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 56, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f7fdff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 30);
  ctx.lineTo(p.x, p.y + 10);
  ctx.stroke();

  ctx.fillStyle = '#f5faff';
  ctx.font = '16px sans-serif';
  ctx.fillText(p.name, p.x - 22, p.y - 86);
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

function drawWinner() {
  if (!winner) return;
  ctx.fillStyle = 'rgba(2, 6, 10, 0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f8fbff';
  ctx.font = 'bold 54px Segoe UI';
  ctx.fillText(`${winner} 获胜！`, W / 2 - 150, H / 2 - 20);
  ctx.font = '24px Segoe UI';
  ctx.fillText('按 空格 键重新开始', W / 2 - 110, H / 2 + 30);
}

function loop() {
  if (!winner) {
    updatePlayer(players[0], 0);
    updatePlayer(players[1], 1);
    updateShuttle();
  }

  drawCourt();
  drawPlayer(players[0]);
  drawPlayer(players[1]);
  drawShuttle();
  drawWinner();

  requestAnimationFrame(loop);
}

resetRally();
loop();
