const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
    score: document.getElementById('score'),
    wave: document.getElementById('wave'),
    energy: document.getElementById('energy'),
    event: document.getElementById('event')
};

const W = canvas.width;
const H = canvas.height;
const BASE_BLOCK_SPEED = 1.1;
const WAVE_SPEED_INCREMENT = 0.14;
const RANDOM_SPEED_VARIANCE = 1.2;
const BULLET_BLOCK_PADDING = 8;
const BLOCK_BOUND_FACTOR = 3;

const eventsPool = [
    { name: '反向控制', duration: 7000, apply: s => (s.reverse = true), clear: s => (s.reverse = false) },
    { name: '暗域遮蔽', duration: 7000, apply: s => (s.darkness = true), clear: s => (s.darkness = false) },
    { name: '方块狂潮', duration: 6500, apply: s => (s.rush = 1.9), clear: s => (s.rush = 1) },
    { name: '好运暴击', duration: 6000, apply: s => (s.lucky = 2), clear: s => (s.lucky = 1) }
];

let game;
let keys = new Set();

function resetGame() {
    game = {
        player: { x: W / 2, y: H - 70, size: 24, speed: 5, cd: 0 },
        bullets: [],
        blocks: [],
        score: 0,
        energy: 100,
        wave: 1,
        spawnTick: 0,
        over: false,
        event: null,
        eventEndAt: 0,
        reverse: false,
        darkness: false,
        rush: 1,
        lucky: 1,
        messageTimer: 0
    };
    ui.event.textContent = '当前异变：无';
}

function randomTetrominoShape() {
    const set = [
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[0,1],[0,2],[0,3]],
        [[0,0],[1,0],[2,0],[1,1]],
        [[0,0],[1,0],[1,1],[2,1]],
        [[1,0],[2,0],[0,1],[1,1]]
    ];
    return set[Math.floor(Math.random() * set.length)];
}

function spawnBlock() {
    const shape = randomTetrominoShape();
    const size = 22;
    const x = 30 + Math.random() * (W - 120);
    const speed = (BASE_BLOCK_SPEED + game.wave * WAVE_SPEED_INCREMENT + Math.random() * RANDOM_SPEED_VARIANCE) * game.rush;
    game.blocks.push({ x, y: -70, size, shape, speed, hp: 4, color: `hsl(${Math.random()*360},80%,62%)` });
}

function shoot() {
    if (game.player.cd > 0 || game.over) return;
    game.bullets.push({ x: game.player.x, y: game.player.y - 10, r: 4, vy: -8 });
    game.player.cd = 9;
}

function triggerEvent(now) {
    if (game.event && now < game.eventEndAt) return;
    if (game.event && now >= game.eventEndAt) {
        game.event.clear(game);
        game.event = null;
        ui.event.textContent = '当前异变：无';
    }

    if (Math.random() < 0.006 + game.wave * 0.0004) {
        const e = eventsPool[Math.floor(Math.random() * eventsPool.length)];
        game.event = e;
        game.eventEndAt = now + e.duration;
        e.apply(game);
        ui.event.textContent = `当前异变：${e.name}`;
        game.messageTimer = 70;
    }
}

function drawTetromino(block) {
    for (const cell of block.shape) {
        const cx = block.x + cell[0] * block.size;
        const cy = block.y + cell[1] * block.size;
        ctx.fillStyle = block.color;
        ctx.fillRect(cx, cy, block.size - 2, block.size - 2);
    }
}

function collidePlayerWithBlock(p, b) {
    for (const c of b.shape) {
        const cx = b.x + c[0] * b.size;
        const cy = b.y + c[1] * b.size;
        if (
            p.x + p.size > cx && p.x - p.size < cx + b.size &&
            p.y + p.size > cy && p.y - p.size < cy + b.size
        ) return true;
    }
    return false;
}

function collideBulletWithBlock(bullet, block) {
    return (
        bullet.x > block.x - BULLET_BLOCK_PADDING &&
        bullet.x < block.x + block.size * BLOCK_BOUND_FACTOR + BULLET_BLOCK_PADDING &&
        bullet.y > block.y - BULLET_BLOCK_PADDING &&
        bullet.y < block.y + block.size * BLOCK_BOUND_FACTOR + BULLET_BLOCK_PADDING
    );
}

function update(now) {
    if (game.over) return;

    let dir = 0;
    if (keys.has('arrowleft') || keys.has('a')) dir -= 1;
    if (keys.has('arrowright') || keys.has('d')) dir += 1;
    if (game.reverse) dir *= -1;

    game.player.x += dir * game.player.speed;
    game.player.x = Math.max(20, Math.min(W - 20, game.player.x));
    if (game.player.cd > 0) game.player.cd--;

    game.spawnTick++;
    const spawnRate = Math.max(15, 48 - game.wave * 2);
    if (game.spawnTick >= spawnRate) {
        game.spawnTick = 0;
        spawnBlock();
    }

    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.y += b.vy;
        if (b.y < -20) game.bullets.splice(i, 1);
    }

    for (let i = game.blocks.length - 1; i >= 0; i--) {
        const block = game.blocks[i];
        block.y += block.speed;

        if (block.y > H + 40) {
            game.blocks.splice(i, 1);
            game.energy -= 8;
            continue;
        }

        if (collidePlayerWithBlock(game.player, block)) {
            game.blocks.splice(i, 1);
            game.energy -= 20;
            continue;
        }

        for (let j = game.bullets.length - 1; j >= 0; j--) {
            const bullet = game.bullets[j];
            if (collideBulletWithBlock(bullet, block)) {
                game.bullets.splice(j, 1);
                block.hp--;
                if (block.hp <= 0) {
                    game.blocks.splice(i, 1);
                    game.score += 10 * game.lucky;
                }
                break;
            }
        }
    }

    if (game.score > game.wave * 180) game.wave++;

    triggerEvent(now);

    if (game.energy <= 0) {
        game.energy = 0;
        game.over = true;
        ui.event.textContent = `当前异变：游戏结束（最终分数 ${game.score}）`;
    }

    ui.score.textContent = `分数：${game.score}`;
    ui.wave.textContent = `波次：${game.wave}`;
    ui.energy.textContent = `能量：${game.energy}`;
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < 25; i++) {
        const x = (i * 139) % W;
        const y = (i * 281 + performance.now() * 0.03) % H;
        ctx.fillStyle = 'rgba(180,160,255,0.25)';
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.beginPath();
    ctx.fillStyle = '#72f9ff';
    ctx.moveTo(game.player.x, game.player.y - game.player.size);
    ctx.lineTo(game.player.x - game.player.size, game.player.y + game.player.size);
    ctx.lineTo(game.player.x + game.player.size, game.player.y + game.player.size);
    ctx.closePath();
    ctx.fill();

    for (const bullet of game.bullets) {
        ctx.fillStyle = '#ffe07b';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const block of game.blocks) drawTetromino(block);

    if (game.darkness) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, W, H);
        ctx.beginPath();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.arc(game.player.x, game.player.y - 50, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    if (game.messageTimer > 0 && game.event) {
        game.messageTimer--;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`异变：${game.event.name}`, W / 2, H / 2);
    }

    if (game.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('游戏结束', W / 2, H / 2 - 20);
        ctx.font = '24px sans-serif';
        ctx.fillText(`最终分数：${game.score}`, W / 2, H / 2 + 25);
    }
}

function loop(now) {
    update(now);
    draw();
    requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", " ", "j"].includes(key)) e.preventDefault();
    keys.add(key);
    if (key === ' ' || key === 'j') shoot();
});

window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

document.getElementById('restart').addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(loop);
