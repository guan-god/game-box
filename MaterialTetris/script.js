(() => {
  /** ===================== 常量与数据 ===================== */
  const COLS = 10, ROWS = 20;
  const SHAPES = {
    I: [[1,1,1,1]], O: [[1,1],[1,1]], T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]], Z: [[1,1,0],[0,1,1]], J: [[1,0,0],[1,1,1]], L: [[0,0,1],[1,1,1]],
  };
  const MODES = {
    metal: {
      name: '金属模式', className: 'mode-metal',
      desc: '更重更快，旋转略迟缓，硬降触发重砸，消行得分更高。',
      style: '激进速攻', dropBase: 600, rotateCooldown: 140, scoreMult: 1.45,
    },
    glass: {
      name: '玻璃模式', className: 'mode-glass',
      desc: '高堆叠会裂纹，裂纹块可能破碎。高风险高回报。',
      style: '高风险操作', dropBase: 760, rotateCooldown: 60, scoreMult: 1.2,
    },
    wood: {
      name: '木头模式', className: 'mode-wood',
      desc: '连接加固，连消触发生长奖励（短时减速+加分）。',
      style: '稳扎稳打', dropBase: 820, rotateCooldown: 80, scoreMult: 1.1,
    },
    rock: {
      name: '岩石模式', className: 'mode-rock',
      desc: '下落慢但顽固，岩石块需两次消行才会彻底消失。',
      style: '规划构筑', dropBase: 930, rotateCooldown: 90, scoreMult: 1.35,
    },
    jelly: {
      name: '果冻模式', className: 'mode-jelly',
      desc: '落地后会弹跳修正并轻微滑动，更容易贴合空隙。',
      style: '灵活手感', dropBase: 780, rotateCooldown: 70, scoreMult: 1.05,
    },
    neon: {
      name: '霓虹能量模式', className: 'mode-neon',
      desc: '连消积攒能量，满能量触发超载：减速+清理一列。',
      style: '连击爽感', dropBase: 740, rotateCooldown: 55, scoreMult: 1.2,
    },
  };

  const rand = (n) => Math.floor(Math.random() * n);
  const clone = (m) => m.map((r) => [...r]);
  const rotate = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());

  /** ===================== UI状态切换 ===================== */
  const screens = {
    title: document.getElementById('titleScreen'),
    select: document.getElementById('selectScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen'),
  };
  const showScreen = (name) => {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  };

  /** ===================== 渲染器 ===================== */
  class Renderer {
    constructor() {
      this.boardEl = document.getElementById('board');
      this.nextEl = document.getElementById('nextBoard');
      this.fxEl = document.getElementById('fx');
      this.scoreEl = document.getElementById('score');
      this.levelEl = document.getElementById('level');
      this.linesEl = document.getElementById('lines');
      this.modeNameEl = document.getElementById('modeName');
      this.statusEl = document.getElementById('specialStatus');
      this.energyWrap = document.getElementById('energyWrap');
      this.energyBar = document.getElementById('energyBar');
      this.toastEl = document.getElementById('toast');

      this.cells = Array.from({ length: ROWS * COLS }, () => {
        const d = document.createElement('div');
        d.className = 'cell';
        this.boardEl.appendChild(d);
        return d;
      });
      this.nextCells = Array.from({ length: 16 }, () => {
        const d = document.createElement('div');
        d.className = 'cell';
        this.nextEl.appendChild(d);
        return d;
      });
    }

    toast(msg) {
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      clearTimeout(this.t);
      this.t = setTimeout(() => this.toastEl.classList.remove('show'), 900);
    }

    draw(game) {
      const modeCfg = MODES[game.mode];
      this.modeNameEl.textContent = modeCfg.name;
      this.scoreEl.textContent = game.score;
      this.levelEl.textContent = game.level;
      this.linesEl.textContent = game.lines;
      this.statusEl.textContent = game.specialStatus;
      this.energyWrap.classList.toggle('hidden', game.mode !== 'neon');
      if (game.mode === 'neon') this.energyBar.style.width = `${game.energy}%`;

      const display = game.board.map((r) => r.map((c) => c ? { ...c } : null));
      for (let y = 0; y < game.piece.matrix.length; y++) {
        for (let x = 0; x < game.piece.matrix[y].length; x++) {
          if (!game.piece.matrix[y][x]) continue;
          const by = game.piece.y + y, bx = game.piece.x + x;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            display[by][bx] = { modeClass: modeCfg.className, active: true };
          }
        }
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = this.cells[y * COLS + x];
          c.className = 'cell';
          const v = display[y][x];
          if (!v) continue;
          c.classList.add('block', v.modeClass || modeCfg.className);
          if (v.cracked) c.classList.add('cracked');
          if (v.reinforced) c.classList.add('reinforced');
          if (v.hp === 1) c.classList.add('hp1');
        }
      }

      this.nextCells.forEach((c) => c.className = 'cell');
      const n = game.next;
      const ox = Math.floor((4 - n.matrix[0].length) / 2), oy = Math.floor((4 - n.matrix.length) / 2);
      for (let y = 0; y < n.matrix.length; y++) {
        for (let x = 0; x < n.matrix[y].length; x++) {
          if (!n.matrix[y][x]) continue;
          this.nextCells[(oy + y) * 4 + (ox + x)].className = `cell block ${modeCfg.className}`;
        }
      }
    }

    burst(row, color = '#9fd1ff') {
      for (let i = 0; i < COLS; i++) {
        const cell = this.cells[row * COLS + i].getBoundingClientRect();
        const host = this.fxEl.getBoundingClientRect();
        for (let k = 0; k < 5; k++) {
          const p = document.createElement('i');
          p.className = 'particle';
          p.style.left = `${cell.left - host.left + cell.width / 2}px`;
          p.style.top = `${cell.top - host.top + cell.height / 2}px`;
          p.style.background = color;
          p.style.setProperty('--dx', `${(Math.random() - .5) * 70}px`);
          p.style.setProperty('--dy', `${(Math.random() - .5) * 70}px`);
          this.fxEl.appendChild(p);
          setTimeout(() => p.remove(), 760);
        }
      }
    }
  }

  /** ===================== 基础俄罗斯方块逻辑 + 材质机制系统 ===================== */
  class Game {
    constructor(renderer) {
      this.renderer = renderer;
      this.reset('metal');
    }

    reset(mode) {
      this.mode = mode;
      this.cfg = MODES[mode];
      this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      this.score = 0; this.lines = 0; this.level = 1;
      this.energy = 0; this.overdriveTimer = 0;
      this.combo = 0; this.paused = false; this.running = false; this.over = false;
      this.specialStatus = '等待开始';
      this.lastRotateAt = 0;
      this.piece = this.makePiece();
      this.next = this.makePiece();
    }

    makePiece() {
      const key = Object.keys(SHAPES)[rand(7)];
      const mat = clone(SHAPES[key]);
      return { key, matrix: mat, x: Math.floor((COLS - mat[0].length) / 2), y: -1 };
    }

    interval() {
      let base = Math.max(120, this.cfg.dropBase - (this.level - 1) * 55);
      if (this.mode === 'wood' && this.overdriveTimer > 0) base += 120; // 木头生长奖励：减速
      if (this.mode === 'neon' && this.overdriveTimer > 0) base += 160; // 霓虹超载：减速
      return base;
    }

    collide(piece = this.piece, dx = 0, dy = 0, matrix = piece.matrix) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (!matrix[y][x]) continue;
          const nx = piece.x + x + dx, ny = piece.y + y + dy;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && this.board[ny][nx]) return true;
        }
      }
      return false;
    }

    move(dx, dy) {
      if (this.over || this.paused || !this.running) return false;
      if (!this.collide(this.piece, dx, dy)) {
        this.piece.x += dx; this.piece.y += dy;
        return true;
      }
      return false;
    }

    rotateNow() {
      if (this.over || this.paused || !this.running) return;
      const now = performance.now();
      if (now - this.lastRotateAt < this.cfg.rotateCooldown) return;
      const r = rotate(this.piece.matrix);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!this.collide(this.piece, kick, 0, r)) {
          this.piece.matrix = r; this.piece.x += kick; this.lastRotateAt = now;
          return;
        }
      }
    }

    hardDrop() {
      if (this.over || this.paused || !this.running) return;
      let dist = 0;
      while (this.move(0, 1)) dist++;
      if (this.mode === 'metal' && dist >= 7) {
        this.score += 30;
        this.specialStatus = '重砸冲击 +30';
      }
      this.lockPiece();
    }

    tick() {
      if (this.over || this.paused || !this.running) return;
      if (!this.move(0, 1)) this.lockPiece();
      if (this.overdriveTimer > 0) {
        this.overdriveTimer -= 1;
        if (this.overdriveTimer === 0) this.specialStatus = '特殊状态结束';
      }
    }

    // 果冻模式：落地后轻微位移修正
    jellyAdjust() {
      if (this.mode !== 'jelly') return;
      const canL = !this.collide(this.piece, -1, 0);
      const canR = !this.collide(this.piece, 1, 0);
      if (!canL && !canR) return;
      const toward = Math.random() < 0.5 ? -1 : 1;
      if ((toward === -1 && canL) || (toward === 1 && canR)) this.piece.x += toward;
      else if (canL) this.piece.x -= 1;
      else if (canR) this.piece.x += 1;
      this.specialStatus = '果冻弹性修正';
    }

    lockPiece() {
      this.jellyAdjust();
      const placed = [];
      for (let y = 0; y < this.piece.matrix.length; y++) {
        for (let x = 0; x < this.piece.matrix[y].length; x++) {
          if (!this.piece.matrix[y][x]) continue;
          const by = this.piece.y + y, bx = this.piece.x + x;
          if (by < 0) { this.over = true; this.running = false; return; }
          const cell = { modeClass: this.cfg.className, cracked: false, reinforced: false, hp: this.mode === 'rock' ? 2 : 1 };
          this.board[by][bx] = cell;
          placed.push([bx, by]);
        }
      }

      if (this.mode === 'wood') this.applyWoodReinforce(placed);
      if (this.mode === 'glass') this.applyGlassCrack();
      if (this.mode === 'glass') this.glassRandomBreak();

      const cleared = this.clearRows();
      this.updateScore(cleared);
      this.piece = this.next;
      this.next = this.makePiece();
      if (this.collide(this.piece, 0, 0)) { this.over = true; this.running = false; }
    }

    applyWoodReinforce(placed) {
      let count = 0;
      for (const [x, y] of placed) {
        let n = 0;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
          const nx=x+dx, ny=y+dy;
          if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&this.board[ny][nx]) n++;
        });
        if (n >= 2) { this.board[y][x].reinforced = true; count++; }
      }
      if (count) this.specialStatus = `木块加固 x${count}`;
    }

    applyGlassCrack() {
      // 堆高过高时生成裂纹
      let high = 0;
      for (let y = 0; y < ROWS; y++) if (this.board[y].some(Boolean)) { high = ROWS - y; break; }
      if (high < 13) return;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = this.board[y][x];
          if (c && Math.random() < 0.07 + (high - 12) * 0.01) c.cracked = true;
        }
      }
      this.specialStatus = '玻璃出现裂纹';
    }

    glassRandomBreak() {
      let broke = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
          const c = this.board[y][x];
          if (!c?.cracked) continue;
          const pressure = y > 0 && this.board[y - 1][x];
          if (pressure && Math.random() < 0.2) {
            this.board[y][x] = null;
            broke++;
          }
        }
      }
      if (broke) this.specialStatus = `玻璃破碎 ${broke} 块`;
    }

    clearRows() {
      const cleared = [];
      for (let y = ROWS - 1; y >= 0; y--) {
        if (!this.board[y].every(Boolean)) continue;

        if (this.mode === 'rock') {
          // 岩石模式：第一次消行只裂解，第二次才消失
          let still = 0;
          for (let x = 0; x < COLS; x++) {
            this.board[y][x].hp -= 1;
            if (this.board[y][x].hp <= 0) this.board[y][x] = null;
            else still++;
          }
          if (still > 0) {
            this.specialStatus = '岩石层被裂解，需要再次消行';
            continue;
          }
        }

        cleared.push(y);
        this.board.splice(y, 1);
        this.board.unshift(Array(COLS).fill(null));
        y++;
      }
      return cleared;
    }

    updateScore(cleared) {
      if (!cleared.length) { this.combo = 0; return; }

      const base = [0, 100, 300, 500, 800][cleared.length];
      let scoreGain = Math.floor(base * this.level * this.cfg.scoreMult);

      if (this.mode === 'wood') {
        this.combo += 1;
        if (this.combo >= 2) {
          scoreGain += 80 * this.combo;
          this.overdriveTimer = 240;
          this.specialStatus = `木头生长奖励：减速中（连消${this.combo}）`;
        }
      }

      if (this.mode === 'neon') {
        this.combo += 1;
        this.energy = Math.min(100, this.energy + 20 + cleared.length * 12 + this.combo * 4);
        if (this.energy >= 100) this.triggerNeonPower();
        else this.specialStatus = `霓虹连击 x${this.combo}，能量 ${this.energy}%`;
      } else if (this.mode !== 'wood') {
        this.combo += 1;
      }

      if (this.mode === 'glass') this.specialStatus = '玻璃碎裂消除';
      if (this.mode === 'metal') this.specialStatus = '金属高压消除';
      if (this.mode === 'rock') this.specialStatus = '岩层被击碎';
      if (this.mode === 'jelly') this.specialStatus = '果冻弹性清行';

      this.score += scoreGain;
      this.lines += cleared.length;
      this.level = Math.floor(this.lines / 10) + 1;

      const colors = { metal:'#d8e6ff', glass:'#94ecff', wood:'#c1875a', rock:'#96928c', jelly:'#ff9bdd', neon:'#5dfff3' };
      cleared.forEach((r) => this.renderer.burst(r, colors[this.mode]));
    }

    triggerNeonPower() {
      this.energy = 0;
      this.overdriveTimer = 300;
      this.specialStatus = '霓虹超载：时间减缓 + 清理高危列';
      // 清除最高列
      let maxH = -1, target = 0;
      for (let x = 0; x < COLS; x++) {
        let h = 0;
        for (let y = 0; y < ROWS; y++) if (this.board[y][x]) { h = ROWS - y; break; }
        if (h > maxH) { maxH = h; target = x; }
      }
      for (let y = 0; y < ROWS; y++) this.board[y][target] = null;
      this.score += 240;
    }
  }

  /** ===================== 控制器 ===================== */
  const renderer = new Renderer();
  const game = new Game(renderer);
  let selectedMode = 'metal';

  const modeCards = document.getElementById('modeCards');
  Object.entries(MODES).forEach(([key, cfg]) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `<h3>${cfg.name}</h3><p>${cfg.desc}</p><p>推荐：${cfg.style}</p>`;
    card.addEventListener('click', () => {
      selectedMode = key;
      startMode();
    });
    modeCards.appendChild(card);
  });

  function startMode() {
    game.reset(selectedMode);
    game.running = true;
    game.specialStatus = '游戏进行中';
    showScreen('game');
    renderer.toast(`${MODES[selectedMode].name} 开始`);
  }

  function endGame() {
    if (!game.over) return;
    document.getElementById('resultText').textContent = `${MODES[game.mode].name} · 本局得分 ${game.score}（等级 ${game.level}）`;
    showScreen('result');
  }

  document.getElementById('enterSelectBtn').onclick = () => showScreen('select');
  document.getElementById('backTitleBtn').onclick = () => showScreen('title');
  document.getElementById('pauseBtn').onclick = () => { game.paused = !game.paused; renderer.toast(game.paused ? '已暂停' : '继续'); };
  document.getElementById('restartBtn').onclick = () => startMode();
  document.getElementById('backSelectBtn').onclick = () => showScreen('select');
  document.getElementById('playAgainBtn').onclick = () => startMode();
  document.getElementById('toSelectBtn').onclick = () => showScreen('select');

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft","arrowright","arrowup","arrowdown"," ","p","r"].includes(k)) e.preventDefault();
    if (!screens.game.classList.contains('active')) return;

    if (k === 'p') game.paused = !game.paused;
    if (k === 'r') return startMode();
    if (game.paused || game.over || !game.running) return;

    if (k === 'arrowleft') game.move(-1, 0);
    if (k === 'arrowright') game.move(1, 0);
    if (k === 'arrowdown') game.move(0, 1);
    if (k === 'arrowup') game.rotateNow();
    if (k === ' ') game.hardDrop();
  });

  /** ===================== 主循环 ===================== */
  let acc = 0, last = 0;
  function loop(ts) {
    const dt = ts - (last || ts);
    last = ts;

    if (game.running && !game.paused && !game.over && screens.game.classList.contains('active')) {
      acc += dt;
      if (acc >= game.interval()) {
        game.tick();
        acc = 0;
      }
    }

    renderer.draw(game);
    endGame();
    requestAnimationFrame(loop);
  }

  showScreen('title');
  renderer.draw(game);
  requestAnimationFrame(loop);
})();
