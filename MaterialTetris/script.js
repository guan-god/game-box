(() => {
  // ===================== 常量 =====================
  const COLS = 10;
  const ROWS = 20;
  const BASE_DROP_MS = 800;
  const MATERIALS = [
    { key: 'metal', name: '金属', hint: '冷光反射 · 硬朗边缘' },
    { key: 'glass', name: '玻璃', hint: '半透明折射 · 发光边框' },
    { key: 'wood', name: '木头', hint: '暖色纹理 · 自然质感' },
    { key: 'rock', name: '岩石', hint: '粗糙颗粒 · 沉稳厚重' },
    { key: 'jelly', name: '果冻', hint: '柔和渐变 · Q弹内光' },
    { key: 'neon', name: '霓虹科技', hint: '高饱和光效 · 电子感纹理' },
  ];
  const SHAPES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
  };

  // ===================== 工具 =====================
  const rand = (n) => Math.floor(Math.random() * n);
  const clone = (m) => m.map((r) => [...r]);
  const rotateMatrix = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());

  // ===================== 材质系统 =====================
  class MaterialEngine {
    constructor() {
      this.theme = MATERIALS[rand(MATERIALS.length)];
      this.switchCounter = 0;
    }

    currentTheme() { return this.theme; }

    // 每 7 个方块轮换一次偏好主题，形成“主题轮换模式”
    maybeRotateTheme() {
      this.switchCounter += 1;
      if (this.switchCounter % 7 === 0) {
        this.theme = MATERIALS[rand(MATERIALS.length)];
      }
    }

    assignMaterial() {
      // 60% 使用当前主题，40% 随机其他材质
      const useTheme = Math.random() < 0.6;
      if (useTheme) return this.theme;
      return MATERIALS[rand(MATERIALS.length)];
    }
  }

  // ===================== 游戏逻辑 =====================
  class TetrisGame {
    constructor(materialEngine) {
      this.materialEngine = materialEngine;
      this.reset();
    }

    reset() {
      this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.active = this.createPiece();
      this.next = this.createPiece();
    }

    createPiece() {
      const keys = Object.keys(SHAPES);
      const shapeKey = keys[rand(keys.length)];
      const material = this.materialEngine.assignMaterial();
      this.materialEngine.maybeRotateTheme();
      const matrix = clone(SHAPES[shapeKey]);
      return {
        key: shapeKey,
        matrix,
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: -1,
        material,
      };
    }

    getDropInterval() {
      return Math.max(120, BASE_DROP_MS - (this.level - 1) * 70);
    }

    collide(piece = this.active, dx = 0, dy = 0, matrix = piece.matrix) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (!matrix[y][x]) continue;
          const nx = piece.x + x + dx;
          const ny = piece.y + y + dy;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && this.board[ny][nx]) return true;
        }
      }
      return false;
    }

    move(dx, dy) {
      if (!this.running || this.paused || this.gameOver) return false;
      if (!this.collide(this.active, dx, dy)) {
        this.active.x += dx;
        this.active.y += dy;
        return true;
      }
      return false;
    }

    rotate() {
      if (!this.running || this.paused || this.gameOver) return;
      const rotated = rotateMatrix(this.active.matrix);
      const kicks = [0, -1, 1, -2, 2];
      for (const k of kicks) {
        if (!this.collide(this.active, k, 0, rotated)) {
          this.active.matrix = rotated;
          this.active.x += k;
          return;
        }
      }
    }

    hardDrop() {
      if (!this.running || this.paused || this.gameOver) return;
      while (this.move(0, 1));
      this.lockPiece();
    }

    tick() {
      if (!this.running || this.paused || this.gameOver) return { locked: false, cleared: [] };
      if (!this.move(0, 1)) return this.lockPiece();
      return { locked: false, cleared: [] };
    }

    lockPiece() {
      const piece = this.active;
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const by = piece.y + y;
          const bx = piece.x + x;
          if (by < 0) {
            this.gameOver = true;
            this.running = false;
            return { locked: true, cleared: [] };
          }
          this.board[by][bx] = { material: piece.material.key, lockPulse: 1 };
        }
      }
      const cleared = this.clearLines();
      this.active = this.next;
      this.next = this.createPiece();
      if (this.collide(this.active, 0, 0)) {
        this.gameOver = true;
        this.running = false;
      }
      return { locked: true, cleared };
    }

    clearLines() {
      const clearedRows = [];
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.board[y].every(Boolean)) {
          clearedRows.push(y);
          this.board.splice(y, 1);
          this.board.unshift(Array(COLS).fill(null));
          y++;
        }
      }
      if (clearedRows.length) {
        const scoreTable = [0, 100, 300, 500, 800];
        this.score += scoreTable[clearedRows.length] * this.level;
        this.lines += clearedRows.length;
        this.level = Math.floor(this.lines / 10) + 1;
      }
      return clearedRows;
    }
  }

  // ===================== 渲染逻辑 =====================
  class Renderer {
    constructor() {
      this.boardEl = document.getElementById('board');
      this.nextEl = document.getElementById('nextBoard');
      this.fxLayer = document.getElementById('fxLayer');
      this.scoreEl = document.getElementById('score');
      this.levelEl = document.getElementById('level');
      this.linesEl = document.getElementById('lines');
      this.themeNameEl = document.getElementById('themeName');
      this.themeHintEl = document.getElementById('themeHint');
      this.toastEl = document.getElementById('toast');

      this.cells = Array.from({ length: ROWS * COLS }, () => {
        const c = document.createElement('div');
        c.className = 'cell';
        this.boardEl.appendChild(c);
        return c;
      });
      this.nextCells = Array.from({ length: 16 }, () => {
        const c = document.createElement('div');
        c.className = 'cell';
        this.nextEl.appendChild(c);
        return c;
      });
    }

    showToast(msg) {
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1000);
    }

    render(game, theme) {
      this.scoreEl.textContent = game.score;
      this.levelEl.textContent = game.level;
      this.linesEl.textContent = game.lines;
      this.themeNameEl.textContent = theme.name;
      this.themeHintEl.textContent = theme.hint;

      const display = game.board.map((r) => r.map((c) => c ? { ...c } : null));
      const p = game.active;
      if (!game.gameOver) {
        for (let y = 0; y < p.matrix.length; y++) {
          for (let x = 0; x < p.matrix[y].length; x++) {
            if (!p.matrix[y][x]) continue;
            const by = p.y + y;
            const bx = p.x + x;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
              display[by][bx] = { material: p.material.key, active: true };
            }
          }
        }
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const idx = y * COLS + x;
          const cell = this.cells[idx];
          const d = display[y][x];
          cell.className = 'cell';
          if (!d) continue;
          cell.classList.add('block', `mat-${d.material}`);
          if (d.lockPulse) cell.classList.add('locked');
        }
      }
      for (const row of game.board) {
        for (const item of row) if (item && item.lockPulse) item.lockPulse = 0;
      }

      this.renderNext(game.next);
    }

    renderNext(piece) {
      this.nextCells.forEach((c) => c.className = 'cell');
      const ox = Math.floor((4 - piece.matrix[0].length) / 2);
      const oy = Math.floor((4 - piece.matrix.length) / 2);
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const idx = (oy + y) * 4 + (ox + x);
          this.nextCells[idx].className = `cell block mat-${piece.material.key}`;
        }
      }
    }

    playClearFx(rows, boardState) {
      rows.forEach((row) => {
        for (let x = 0; x < COLS; x++) {
          const idx = row * COLS + x;
          const cell = this.cells[idx];
          const material = boardState[row]?.[x]?.material || 'neon';
          cell.classList.add('clearing');
          this.spawnParticles(cell, material);
          setTimeout(() => cell.classList.remove('clearing'), 380);
        }
      });
    }

    spawnParticles(cell, material) {
      const colorMap = {
        metal: '#d6e7ff', glass: '#8ef1ff', wood: '#cc8f5d',
        rock: '#a8a29c', jelly: '#ff9ce2', neon: '#50f7ff',
      };
      const rect = cell.getBoundingClientRect();
      const host = this.fxLayer.getBoundingClientRect();
      const cx = rect.left - host.left + rect.width / 2;
      const cy = rect.top - host.top + rect.height / 2;
      const count = material === 'glass' ? 10 : material === 'rock' ? 7 : 8;

      for (let i = 0; i < count; i++) {
        const p = document.createElement('i');
        p.className = 'particle';
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        p.style.background = colorMap[material];
        p.style.setProperty('--dx', `${(Math.random() - 0.5) * 56}px`);
        p.style.setProperty('--dy', `${(Math.random() - 0.5) * 56}px`);
        if (material === 'neon') p.style.boxShadow = `0 0 8px ${colorMap[material]}`;
        if (material === 'glass') p.style.borderRadius = '2px';
        if (material === 'wood') p.style.width = '10px';
        this.fxLayer.appendChild(p);
        setTimeout(() => p.remove(), 700);
      }
    }
  }

  // ===================== UI/控制器 =====================
  class App {
    constructor() {
      this.materialEngine = new MaterialEngine();
      this.game = new TetrisGame(this.materialEngine);
      this.renderer = new Renderer();

      this.startBtn = document.getElementById('startBtn');
      this.pauseBtn = document.getElementById('pauseBtn');
      this.restartBtn = document.getElementById('restartBtn');
      this.touchPanel = document.querySelector('.touch-controls');
      this.dropAccumulator = 0;
      this.lastTime = 0;

      this.bindEvents();
      this.renderer.render(this.game, this.materialEngine.currentTheme());
    }

    bindEvents() {
      this.startBtn.addEventListener('click', () => {
        if (!this.game.running && !this.game.gameOver) {
          this.game.running = true;
          this.renderer.showToast('开始游戏');
        } else if (this.game.gameOver) {
          this.restart();
        }
      });

      this.pauseBtn.addEventListener('click', () => {
        if (!this.game.running || this.game.gameOver) return;
        this.game.paused = !this.game.paused;
        this.renderer.showToast(this.game.paused ? '已暂停' : '继续游戏');
      });

      this.restartBtn.addEventListener('click', () => this.restart());

      document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (["arrowleft","arrowright","arrowup","arrowdown"," ","p"].includes(key)) e.preventDefault();
        if (key === 'p') {
          if (this.game.running && !this.game.gameOver) this.game.paused = !this.game.paused;
          return;
        }
        if (!this.game.running || this.game.paused || this.game.gameOver) return;
        if (key === 'arrowleft') this.game.move(-1, 0);
        else if (key === 'arrowright') this.game.move(1, 0);
        else if (key === 'arrowdown') this.game.move(0, 1);
        else if (key === 'arrowup') this.game.rotate();
        else if (key === ' ') this.game.hardDrop();
      });

      this.touchPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        if (!this.game.running) this.game.running = true;
        const { action } = btn.dataset;
        if (action === 'left') this.game.move(-1, 0);
        if (action === 'right') this.game.move(1, 0);
        if (action === 'rotate') this.game.rotate();
        if (action === 'down') this.game.move(0, 1);
        if (action === 'drop') this.game.hardDrop();
        if (action === 'pause') this.game.paused = !this.game.paused;
      });

      requestAnimationFrame((ts) => this.loop(ts));
    }

    restart() {
      this.materialEngine = new MaterialEngine();
      this.game = new TetrisGame(this.materialEngine);
      this.game.running = true;
      this.renderer.showToast('新的一局开始');
    }

    loop(ts) {
      const delta = ts - (this.lastTime || ts);
      this.lastTime = ts;

      if (this.game.running && !this.game.paused && !this.game.gameOver) {
        this.dropAccumulator += delta;
        if (this.dropAccumulator >= this.game.getDropInterval()) {
          const before = this.game.board.map((r) => r.map((c) => c ? { ...c } : null));
          const result = this.game.tick();
          this.dropAccumulator = 0;
          if (result.cleared.length) this.renderer.playClearFx(result.cleared, before);
          if (this.game.gameOver) this.renderer.showToast('游戏结束');
        }
      }

      this.renderer.render(this.game, this.materialEngine.currentTheme());
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  new App();
})();
