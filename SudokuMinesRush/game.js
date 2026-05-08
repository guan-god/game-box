const SIZE = 9;
const BOX = 3;
const HINT_PENALTY = 12;
const WIN_BONUS = 100;
const ENERGY_MAX = 100;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

const DIFFICULTY = {
  easy: { label: "轻松", clues: 44, mines: 8, lives: 3 },
  medium: { label: "中等", clues: 36, mines: 12, lives: 3 },
  hard: { label: "困难", clues: 30, mines: 16, lives: 2 },
  expert: { label: "狂潮", clues: 26, mines: 20, lives: 2 },
};

const boardEl = document.querySelector("#board");
const padEl = document.querySelector("#pad");
const messageEl = document.querySelector("#message");
const difficultyEl = document.querySelector("#difficulty");
const difficultyLabelEl = document.querySelector("#difficultyLabel");
const timerEl = document.querySelector("#timer");
const livesEl = document.querySelector("#lives");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const energyEl = document.querySelector("#energy");
const progressEl = document.querySelector("#progress");
const fusionInfoEl = document.querySelector("#fusionInfo");
const newGameBtn = document.querySelector("#newGameBtn");
const hintBtn = document.querySelector("#hintBtn");
const modeBtn = document.querySelector("#modeBtn");
const pulseBtn = document.querySelector("#pulseBtn");

let solution = [];
let puzzle = [];
let player = [];
let given = [];
let selectedIndex = 0;
let mines = new Set();
let flags = new Set();
let hitMines = new Set();
let mode = "fill";
let lives = 3;
let score = 0;
let combo = 0;
let energy = 0;
let seconds = 0;
let timerId = null;
let gameOver = false;

function makeGrid(fill = 0) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(fill));
}

function shuffle(arr) {
  const x = [...arr];
  for (let i = x.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function isSafe(grid, row, col, n) {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === n || grid[i][col] === n) return false;
  }
  const sr = Math.floor(row / BOX) * BOX;
  const sc = Math.floor(col / BOX) * BOX;
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      if (grid[sr + r][sc + c] === n) return false;
    }
  }
  return true;
}

function fillGrid(grid) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] !== 0) continue;
      for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isSafe(grid, row, col, n)) continue;
        grid[row][col] = n;
        if (fillGrid(grid)) return true;
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  const copy = grid.map((r) => [...r]);

  function solve() {
    if (count >= limit) return;
    let tr = -1;
    let tc = -1;
    let best = null;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (copy[row][col] !== 0) continue;
        const candidates = [];
        for (let n = 1; n <= SIZE; n += 1) {
          if (isSafe(copy, row, col, n)) candidates.push(n);
        }
        if (candidates.length === 0) return;
        if (!best || candidates.length < best.length) {
          best = candidates;
          tr = row;
          tc = col;
        }
      }
    }

    if (!best) {
      count += 1;
      return;
    }

    for (const n of best) {
      copy[tr][tc] = n;
      solve();
      copy[tr][tc] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

function generatePuzzle(clues) {
  const full = makeGrid();
  fillGrid(full);
  const p = full.map((r) => [...r]);
  const cells = shuffle([...Array(SIZE * SIZE).keys()]);
  let filled = SIZE * SIZE;

  for (const idx of cells) {
    if (filled <= clues) break;
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    const temp = p[row][col];
    p[row][col] = 0;
    if (countSolutions(p) !== 1) p[row][col] = temp;
    else filled -= 1;
  }

  return { solution: full, puzzle: p };
}

function toIndex(row, col) {
  return row * SIZE + col;
}

function toRowCol(index) {
  return { row: Math.floor(index / SIZE), col: index % SIZE };
}

function setMessage(text, type = "") {
  messageEl.className = `message ${type}`.trim();
  messageEl.textContent = text;
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(timerId);
  seconds = 0;
  timerEl.textContent = formatTime(0);
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function getAdjMineCount(index) {
  const { row, col } = toRowCol(index);
  let c = 0;
  for (const [dr, dc] of DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    if (mines.has(toIndex(nr, nc))) c += 1;
  }
  return c;
}

function placeMines(count) {
  mines = new Set();
  flags = new Set();
  hitMines = new Set();
  const candidates = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const { row, col } = toRowCol(i);
    if (!given[row][col]) candidates.push(i);
  }
  for (const idx of shuffle(candidates).slice(0, count)) mines.add(idx);
}

function getSolvedSafeCount() {
  let solved = 0;
  let total = 0;
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    if (mines.has(i)) continue;
    total += 1;
    const { row, col } = toRowCol(i);
    if (player[row][col] === solution[row][col]) solved += 1;
  }
  return { solved, total };
}

function updatePulseButton() {
  if (energy >= ENERGY_MAX) {
    pulseBtn.disabled = false;
    pulseBtn.textContent = "融合脉冲（已就绪）";
  } else {
    pulseBtn.disabled = true;
    pulseBtn.textContent = `融合脉冲（${energy}%）`;
  }
}

function chargeEnergy(delta) {
  energy = Math.max(0, Math.min(ENERGY_MAX, energy + delta));
}

function groupSummary(indices) {
  let total = 0;
  let flagged = 0;
  for (const idx of indices) {
    if (mines.has(idx)) total += 1;
    if (flags.has(idx)) flagged += 1;
  }
  const pending = Math.max(0, total - flagged);
  return { total, flagged, pending };
}

function getFusionIntel(index) {
  const { row, col } = toRowCol(index);
  const rowIndices = Array.from({ length: SIZE }, (_, c) => toIndex(row, c));
  const colIndices = Array.from({ length: SIZE }, (_, r) => toIndex(r, col));
  const sr = Math.floor(row / BOX) * BOX;
  const sc = Math.floor(col / BOX) * BOX;
  const boxIndices = [];
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      boxIndices.push(toIndex(sr + r, sc + c));
    }
  }
  return {
    row: groupSummary(rowIndices),
    col: groupSummary(colIndices),
    box: groupSummary(boxIndices),
    rowNo: row + 1,
    colNo: col + 1,
    boxNo: Math.floor(row / BOX) * (SIZE / BOX) + Math.floor(col / BOX) + 1,
  };
}

function renderFusionInfo() {
  if (selectedIndex < 0 || selectedIndex >= SIZE * SIZE) {
    fusionInfoEl.textContent = "情报：请选择一个格子查看行/列/宫雷区态势。";
    return;
  }
  const intel = getFusionIntel(selectedIndex);
  fusionInfoEl.textContent =
    `情报：R${intel.rowNo} 雷 ${intel.row.flagged}/${intel.row.total}（待排 ${intel.row.pending}）` +
    ` ｜ C${intel.colNo} 雷 ${intel.col.flagged}/${intel.col.total}（待排 ${intel.col.pending}）` +
    ` ｜ 宫${intel.boxNo} 雷 ${intel.box.flagged}/${intel.box.total}（待排 ${intel.box.pending}）`;
}

function updateTopStats() {
  livesEl.textContent = String(lives);
  scoreEl.textContent = String(score);
  comboEl.textContent = `x${combo}`;
  energyEl.textContent = `${energy}%`;
  const p = getSolvedSafeCount();
  progressEl.textContent = `${p.solved}/${p.total}`;
  updatePulseButton();
}

function isRelated(a, b) {
  const x = toRowCol(a);
  const y = toRowCol(b);
  return (
    x.row === y.row ||
    x.col === y.col ||
    (Math.floor(x.row / BOX) === Math.floor(y.row / BOX) &&
      Math.floor(x.col / BOX) === Math.floor(y.col / BOX))
  );
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const { row, col } = toRowCol(i);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    btn.dataset.index = String(i);

    const value = player[row][col];
    if (given[row][col]) btn.classList.add("given");
    if (i === selectedIndex) {
      btn.classList.add("selected");
      if (energy >= ENERGY_MAX) btn.classList.add("fusion-ready");
    }
    else if (isRelated(i, selectedIndex)) btn.classList.add("related");

    if (flags.has(i)) {
      btn.classList.add("flagged");
      btn.textContent = "🚩";
    } else if (hitMines.has(i)) {
      btn.classList.add("mine-hit");
      btn.textContent = "💣";
    } else if (value) {
      btn.textContent = String(value);
      if (!given[row][col] && value === solution[row][col]) btn.classList.add("safe");
    } else {
      btn.textContent = "";
    }

    const adj = getAdjMineCount(i);
    if (!mines.has(i) && adj > 0) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `邻雷 ${adj}`;
      btn.append(badge);
    }

    btn.addEventListener("click", () => {
      selectedIndex = i;
      if (mode === "flag") toggleFlag(i);
      renderBoard();
    });
    boardEl.append(btn);
  }

  updateTopStats();
  renderFusionInfo();
}

function addScore(base) {
  score += base + combo * 5;
}

function comboText() {
  if (combo >= 8) return "爆裂连击！";
  if (combo >= 5) return "火热手感！";
  if (combo >= 3) return "节奏起来了！";
  return "稳定推进中。";
}

function loseLife(reason) {
  lives -= 1;
  combo = 0;
  chargeEnergy(-20);
  setMessage(`${reason}，生命 -1。`, "bad");
  if (lives <= 0) {
    gameOver = true;
    clearInterval(timerId);
    setMessage(`游戏结束！最终得分 ${score}，用时 ${formatTime(seconds)}。`, "bad");
  }
}

function placeNumber(n) {
  if (gameOver || mode === "flag") return;
  const { row, col } = toRowCol(selectedIndex);
  if (given[row][col]) {
    setMessage("题目数字不可修改。", "warn");
    return;
  }
  if (flags.has(selectedIndex)) {
    setMessage("该格已插旗，先取消旗帜再填数。", "warn");
    return;
  }
  if (mines.has(selectedIndex)) {
    hitMines.add(selectedIndex);
    loseLife("你踩到雷了");
    renderBoard();
    return;
  }

  player[row][col] = n;
  if (n === solution[row][col]) {
    combo += 1;
    chargeEnergy(18);
    addScore(20);
    setMessage(`正确！${comboText()}`, "ok");
    checkWin();
  } else {
    // 错误数字短暂显示，给出反馈后再清空，避免干扰后续数独推理。
    combo = 0;
    loseLife("数字不正确");
    renderBoard();
    const cell = boardEl.querySelector(`[data-index='${selectedIndex}']`);
    if (cell) {
      cell.classList.add("bad");
      setTimeout(() => cell.classList.remove("bad"), 240);
    }
    const wrongIndex = selectedIndex;
    setTimeout(() => {
      const current = toRowCol(wrongIndex);
      if (player[current.row][current.col] === n) {
        player[current.row][current.col] = 0;
        renderBoard();
      }
    }, 240);
    return;
  }
  renderBoard();
}

function toggleFlag(index) {
  if (gameOver) return;
  const { row, col } = toRowCol(index);
  if (given[row][col]) return;
  if (player[row][col]) return;

  if (flags.has(index)) {
    flags.delete(index);
    combo = 0;
    chargeEnergy(-8);
    setMessage("已取消旗帜。", "warn");
  } else {
    flags.add(index);
    if (mines.has(index)) {
      combo += 1;
      chargeEnergy(12);
      addScore(15);
      setMessage(`精准插旗！${comboText()}`, "ok");
    } else {
      combo = 0;
      chargeEnergy(-10);
      setMessage("这里看起来不像雷，注意观察邻雷提示。", "warn");
    }
    checkWin();
  }
}

function giveHint() {
  if (gameOver) return;
  const candidates = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    if (mines.has(i)) continue;
    const { row, col } = toRowCol(i);
    if (given[row][col]) continue;
    if (player[row][col] !== solution[row][col]) candidates.push(i);
  }
  if (!candidates.length) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  selectedIndex = pick;
  const { row, col } = toRowCol(pick);
  player[row][col] = solution[row][col];
  flags.delete(pick);
  combo = 0;
  chargeEnergy(-15);
  score = Math.max(0, score - HINT_PENALTY);
  setMessage(
    `提示已使用：自动填入一个安全正确数字（扣 ${HINT_PENALTY} 分）。`,
    "warn",
  );
  checkWin();
  renderBoard();
}

function getNeighborIndices(index) {
  const { row, col } = toRowCol(index);
  const neighbors = [];
  for (const [dr, dc] of DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    neighbors.push(toIndex(nr, nc));
  }
  return neighbors;
}

function useFusionPulse() {
  if (gameOver) return;
  if (selectedIndex < 0 || selectedIndex >= SIZE * SIZE) {
    setMessage("请先选择一个格子，再释放融合脉冲。", "warn");
    return;
  }
  if (energy < ENERGY_MAX) {
    setMessage("融合能量不足，继续连击以充能。", "warn");
    return;
  }

  let autoFilled = 0;
  let autoFlagged = 0;
  for (const idx of getNeighborIndices(selectedIndex)) {
    if (mines.has(idx)) {
      if (!flags.has(idx)) {
        flags.add(idx);
        autoFlagged += 1;
      }
      continue;
    }

    const { row, col } = toRowCol(idx);
    if (given[row][col]) continue;
    if (player[row][col] !== solution[row][col]) {
      player[row][col] = solution[row][col];
      autoFilled += 1;
    }
    flags.delete(idx);
  }

  chargeEnergy(-ENERGY_MAX);
  if (autoFilled || autoFlagged) {
    combo += 1;
    addScore(autoFilled * 18 + autoFlagged * 15 + 12);
    setMessage(
      `融合脉冲释放：自动填入 ${autoFilled} 格，锁定 ${autoFlagged} 枚地雷。`,
      "ok",
    );
  } else {
    setMessage("融合脉冲已释放，但当前周围暂无可处理目标。", "warn");
  }
  checkWin();
  renderBoard();
}

function checkWin() {
  if (gameOver) return;

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const { row, col } = toRowCol(i);
    if (mines.has(i)) {
      if (!flags.has(i)) return;
      continue;
    }
    if (player[row][col] !== solution[row][col]) return;
  }

  gameOver = true;
  clearInterval(timerId);
  score += WIN_BONUS;
  setMessage(
    `通关！你完成了雷数狂潮，奖励 +${WIN_BONUS}，最终得分 ${score}。`,
    "ok",
  );
}

function switchMode() {
  mode = mode === "fill" ? "flag" : "fill";
  modeBtn.textContent = `模式：${mode === "fill" ? "填数" : "插旗"}`;
  setMessage(
    mode === "fill" ? "已切换到填数模式。" : "已切换到插旗模式，点击格子可标雷。",
    "warn",
  );
}

function initPad() {
  padEl.innerHTML = "";
  for (let n = 1; n <= 9; n += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(n);
    btn.addEventListener("click", () => placeNumber(n));
    padEl.append(btn);
  }
}

function newGame() {
  const cfg = DIFFICULTY[difficultyEl.value];
  difficultyLabelEl.textContent = cfg.label;

  const g = generatePuzzle(cfg.clues);
  solution = g.solution;
  puzzle = g.puzzle;
  player = puzzle.map((r) => [...r]);
  given = puzzle.map((row) => row.map(Boolean));

  placeMines(cfg.mines);
  selectedIndex = 0;
  mode = "fill";
  modeBtn.textContent = "模式：填数";
  lives = cfg.lives;
  score = 0;
  combo = 0;
  energy = 0;
  gameOver = false;

  startTimer();
  setMessage("新局开始！连击可充能，满能量后释放融合脉冲。", "ok");
  renderBoard();
}

newGameBtn.addEventListener("click", newGame);
hintBtn.addEventListener("click", giveHint);
modeBtn.addEventListener("click", switchMode);
pulseBtn.addEventListener("click", useFusionPulse);
difficultyEl.addEventListener("change", newGame);

window.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "9") placeNumber(Number(e.key));
  if (e.key.toLowerCase() === "f") switchMode();
  if (e.key.toLowerCase() === "e") useFusionPulse();

  const { row, col } = toRowCol(selectedIndex);
  const move = {
    ArrowUp: toIndex(Math.max(0, row - 1), col),
    ArrowDown: toIndex(Math.min(SIZE - 1, row + 1), col),
    ArrowLeft: toIndex(row, Math.max(0, col - 1)),
    ArrowRight: toIndex(row, Math.min(SIZE - 1, col + 1)),
  };
  if (e.key in move) {
    e.preventDefault();
    selectedIndex = move[e.key];
    renderBoard();
  }
  if (e.key === " " || e.key.toLowerCase() === "x") {
    e.preventDefault();
    if (mode === "flag") {
      toggleFlag(selectedIndex);
      renderBoard();
    }
  }
});

initPad();
newGame();
