const SIZE = 9;
const BOX = 3;
const DIFFICULTY_CLUES = {
  easy: 40,
  medium: 34,
  hard: 28,
  expert: 24,
};
const DIFFICULTY_NAMES = {
  easy: "轻松",
  medium: "中等",
  hard: "困难",
  expert: "大师",
};

const boardEl = document.querySelector("#board");
const difficultyEl = document.querySelector("#difficulty");
const difficultyLabelEl = document.querySelector("#difficultyLabel");
const gameModeEl = document.querySelector("#gameMode");
const timerEl = document.querySelector("#timer");
const mistakesEl = document.querySelector("#mistakes");
const messageEl = document.querySelector("#message");
const noteBtn = document.querySelector("#noteBtn");
const newGameBtn = document.querySelector("#newGameBtn");
const hintBtn = document.querySelector("#hintBtn");
const undoBtn = document.querySelector("#undoBtn");
const eraseBtn = document.querySelector("#eraseBtn");
const rulesBtn = document.querySelector("#rulesBtn");
const closeRulesBtn = document.querySelector("#closeRulesBtn");
const rulesDialog = document.querySelector("#rulesDialog");
const missionCard = document.querySelector("#missionCard");
const missionListEl = document.querySelector("#missionList");
const missionTitleEl = document.querySelector("#missionTitle");
const streakEl = document.querySelector("#streak");
const starsEl = document.querySelector("#stars");
const toastEl = document.querySelector("#toast");

let solution = [];
let puzzle = [];
let player = [];
let given = [];
let notes = [];
let selectedIndex = 0;
let noteMode = false;
let mistakes = 0;
let seconds = 0;
let timerId = null;
let history = [];
let isGameOver = false;
let missionTargets = [];
let streak = 0;
let stars = 0;
let badgeAwarded = false;

function createEmptyGrid(fillValue = 0) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(fillValue));
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isSafe(grid, row, col, number) {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === number || grid[i][col] === number) return false;
  }

  const startRow = Math.floor(row / BOX) * BOX;
  const startCol = Math.floor(col / BOX) * BOX;
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      if (grid[startRow + r][startCol + c] === number) return false;
    }
  }
  return true;
}

function fillGrid(grid) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] !== 0) continue;
      for (const number of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isSafe(grid, row, col, number)) continue;
        grid[row][col] = number;
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
  const copy = grid.map((row) => [...row]);

  function solve() {
    if (count >= limit) return;
    let targetRow = -1;
    let targetCol = -1;
    let bestCandidates = null;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (copy[row][col] !== 0) continue;
        const candidates = [];
        for (let number = 1; number <= SIZE; number += 1) {
          if (isSafe(copy, row, col, number)) candidates.push(number);
        }
        if (candidates.length === 0) return;
        if (!bestCandidates || candidates.length < bestCandidates.length) {
          bestCandidates = candidates;
          targetRow = row;
          targetCol = col;
        }
      }
    }

    if (!bestCandidates) {
      count += 1;
      return;
    }

    for (const number of bestCandidates) {
      copy[targetRow][targetCol] = number;
      solve();
      copy[targetRow][targetCol] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

function generatePuzzle(difficulty) {
  const full = createEmptyGrid();
  fillGrid(full);
  const puzzleGrid = full.map((row) => [...row]);
  const cells = shuffle([...Array(SIZE * SIZE).keys()]);
  const clues = DIFFICULTY_CLUES[difficulty];
  let filled = SIZE * SIZE;

  for (const index of cells) {
    if (filled <= clues) break;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const backup = puzzleGrid[row][col];
    puzzleGrid[row][col] = 0;
    if (countSolutions(puzzleGrid) !== 1) {
      puzzleGrid[row][col] = backup;
    } else {
      filled -= 1;
    }
  }

  return { puzzleGrid, solutionGrid: full };
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const rest = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startTimer() {
  clearInterval(timerId);
  seconds = 0;
  timerEl.textContent = formatTime(seconds);
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function setMessage(text, tone = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${tone}`.trim();
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(
    () => toastEl.classList.remove("show"),
    1800,
  );
}

function isStarlightMode() {
  return gameModeEl.value !== "classic";
}

function initializeMission() {
  streak = 0;
  stars = 0;
  badgeAwarded = false;
  missionTargets = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
  updateMission();
}

function getMissionProgress(number) {
  let solved = 0;
  let total = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (solution[row][col] !== number) continue;
      total += 1;
      if (player[row][col] === number) solved += 1;
    }
  }
  return { solved, total };
}

function updateMission() {
  missionCard.hidden = !isStarlightMode();
  streakEl.textContent = streak;
  starsEl.textContent = stars;

  if (!isStarlightMode() || !missionTargets.length || !solution.length) return;

  missionTitleEl.textContent = badgeAwarded ? "星轨徽章已获得" : "点亮目标数字";
  missionListEl.innerHTML = "";
  let allComplete = true;

  for (const number of missionTargets) {
    const { solved, total } = getMissionProgress(number);
    const chip = document.createElement("span");
    chip.className = "mission-chip";
    chip.textContent = `${number} · ${solved}/${total}`;
    if (total > 0 && solved === total) chip.classList.add("complete");
    else allComplete = false;
    missionListEl.append(chip);
  }

  if (allComplete && !badgeAwarded) {
    badgeAwarded = true;
    stars += 9;
    starsEl.textContent = stars;
    missionTitleEl.textContent = "星轨徽章已获得";
    showToast("三条星轨全部点亮，获得星轨徽章！");
  }
}

function rewardCorrectMove(number) {
  if (!isStarlightMode()) return;
  streak += 1;
  if (missionTargets.includes(number)) {
    stars += 2 + Math.floor(streak / 3);
    showToast(`目标数字 ${number} 点亮！连击 ${streak}`);
  } else if (streak > 1 && streak % 4 === 0) {
    stars += 1;
    showToast(`连续答对 ${streak} 次，额外获得 1 点星光`);
  }
  updateMission();
}

function resetStreak() {
  if (!isStarlightMode()) return;
  streak = 0;
  updateMission();
}

function getCellCoords(index) {
  return { row: Math.floor(index / SIZE), col: index % SIZE };
}

function getCellValue(index) {
  const { row, col } = getCellCoords(index);
  return player[row][col];
}

function isRelated(index, otherIndex) {
  const a = getCellCoords(index);
  const b = getCellCoords(otherIndex);
  return (
    a.row === b.row ||
    a.col === b.col ||
    (Math.floor(a.row / BOX) === Math.floor(b.row / BOX) &&
      Math.floor(a.col / BOX) === Math.floor(b.col / BOX))
  );
}

function renderBoard() {
  boardEl.innerHTML = "";
  const selectedValue = getCellValue(selectedIndex);

  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const { row, col } = getCellCoords(index);
    const cell = document.createElement("button");
    const value = player[row][col];
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute(
      "aria-label",
      `第 ${row + 1} 行第 ${col + 1} 列${value ? `，数字 ${value}` : "，空白"}`,
    );
    cell.dataset.index = String(index);

    if (given[row][col]) cell.classList.add("given");
    if (index === selectedIndex) cell.classList.add("selected");
    else if (isRelated(index, selectedIndex)) cell.classList.add("related");
    if (value && selectedValue === value && index !== selectedIndex)
      cell.classList.add("same");
    if (value && value !== solution[row][col]) cell.classList.add("error");
    if (!given[row][col] && value === solution[row][col])
      cell.classList.add("hint");

    if (value) {
      cell.textContent = value;
    } else if (notes[row][col].size) {
      const noteGrid = document.createElement("span");
      noteGrid.className = "notes";
      for (let number = 1; number <= SIZE; number += 1) {
        const mark = document.createElement("span");
        mark.textContent = notes[row][col].has(number) ? number : "";
        noteGrid.append(mark);
      }
      cell.append(noteGrid);
    }

    cell.addEventListener("click", () => selectCell(index));
    boardEl.append(cell);
  }
}

function selectCell(index) {
  selectedIndex = index;
  renderBoard();
}

function pushHistory(row, col) {
  history.push({
    row,
    col,
    value: player[row][col],
    notes: new Set(notes[row][col]),
    mistakes,
    streak,
    stars,
    badgeAwarded,
  });
}

function placeNumber(number) {
  if (isGameOver) return;
  const { row, col } = getCellCoords(selectedIndex);
  if (given[row][col]) {
    showToast("题目数字不能修改");
    return;
  }

  if (!noteMode && player[row][col] === number) {
    showToast("这个数字已经填在当前格了");
    return;
  }

  pushHistory(row, col);

  if (noteMode) {
    if (player[row][col]) player[row][col] = 0;
    if (notes[row][col].has(number)) notes[row][col].delete(number);
    else notes[row][col].add(number);
    updateMission();
    setMessage("已更新笔记。再次点击同一数字可移除候选数。");
    renderBoard();
    return;
  }

  player[row][col] = number;
  notes[row][col].clear();

  if (number !== solution[row][col]) {
    mistakes += 1;
    mistakesEl.textContent = mistakes;
    resetStreak();
    setMessage(`这个数字不太对，再检查一下行、列或宫。`, "danger");
    if (mistakes >= 3) endGame(false);
  } else {
    removeNumberFromRelatedNotes(row, col, number);
    rewardCorrectMove(number);
    setMessage("漂亮！这个位置填写正确。", "success");
    if (isCompleted()) endGame(true);
  }
  renderBoard();
}

function removeNumberFromRelatedNotes(row, col, number) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const sameBox =
        Math.floor(r / BOX) === Math.floor(row / BOX) &&
        Math.floor(c / BOX) === Math.floor(col / BOX);
      if (r === row || c === col || sameBox) notes[r][c].delete(number);
    }
  }
}

function eraseCell() {
  if (isGameOver) return;
  const { row, col } = getCellCoords(selectedIndex);
  if (given[row][col]) {
    showToast("题目数字不能清除");
    return;
  }
  pushHistory(row, col);
  player[row][col] = 0;
  notes[row][col].clear();
  updateMission();
  setMessage("已清除当前格。");
  renderBoard();
}

function giveHint() {
  if (isGameOver) return;
  const emptyCells = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!given[row][col] && player[row][col] !== solution[row][col])
        emptyCells.push({ row, col });
    }
  }
  if (!emptyCells.length) return;
  const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  pushHistory(target.row, target.col);
  player[target.row][target.col] = solution[target.row][target.col];
  notes[target.row][target.col].clear();
  selectedIndex = target.row * SIZE + target.col;
  updateMission();
  setMessage("提示已点亮一个正确答案。", "success");
  if (isCompleted()) endGame(true);
  renderBoard();
}

function undo() {
  if (!history.length || isGameOver) {
    showToast("没有可撤销的操作");
    return;
  }
  const last = history.pop();
  player[last.row][last.col] = last.value;
  notes[last.row][last.col] = last.notes;
  mistakes = last.mistakes;
  streak = last.streak;
  stars = last.stars;
  badgeAwarded = last.badgeAwarded;
  mistakesEl.textContent = mistakes;
  selectedIndex = last.row * SIZE + last.col;
  updateMission();
  setMessage("已撤销上一步操作。");
  renderBoard();
}

function isCompleted() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (player[row][col] !== solution[row][col]) return false;
    }
  }
  return true;
}

function endGame(won) {
  isGameOver = true;
  clearInterval(timerId);
  if (won) {
    setMessage(
      `恭喜完成！总用时 ${formatTime(seconds)}，错误 ${mistakes} 次。`,
      "success",
    );
    showToast("星河已被你点亮 ✨");
  } else {
    setMessage("错误达到 3 次，本局结束。点击“新开一局”再挑战吧。", "danger");
    showToast("别灰心，再来一局！");
  }
}

function newGame() {
  setMessage("正在生成唯一解题盘……");
  isGameOver = false;
  mistakes = 0;
  history = [];
  mistakesEl.textContent = mistakes;
  difficultyLabelEl.textContent = DIFFICULTY_NAMES[difficultyEl.value];
  missionCard.hidden = !isStarlightMode();

  setTimeout(() => {
    const generated = generatePuzzle(difficultyEl.value);
    puzzle = generated.puzzleGrid;
    solution = generated.solutionGrid;
    player = puzzle.map((row) => [...row]);
    given = puzzle.map((row) => row.map(Boolean));
    notes = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => new Set()),
    );
    selectedIndex = puzzle.flat().findIndex((value) => value === 0);
    if (selectedIndex < 0) selectedIndex = 0;
    initializeMission();
    startTimer();
    setMessage("点选空格后输入数字，或开启笔记记录候选数。");
    renderBoard();
  }, 80);
}

noteBtn.addEventListener("click", () => {
  noteMode = !noteMode;
  noteBtn.classList.toggle("active", noteMode);
  noteBtn.setAttribute("aria-pressed", String(noteMode));
  setMessage(
    noteMode
      ? "笔记模式已开启：数字会以候选数形式记录。"
      : "笔记模式已关闭：数字会直接填入格子。",
  );
});

newGameBtn.addEventListener("click", newGame);
gameModeEl.addEventListener("change", newGame);
hintBtn.addEventListener("click", giveHint);
undoBtn.addEventListener("click", undo);
eraseBtn.addEventListener("click", eraseCell);
rulesBtn.addEventListener("click", () => {
  if (typeof rulesDialog.showModal === "function") rulesDialog.showModal();
  else rulesDialog.setAttribute("open", "");
});
closeRulesBtn.addEventListener("click", () => {
  if (typeof rulesDialog.close === "function") rulesDialog.close();
  else rulesDialog.removeAttribute("open");
});
rulesDialog.addEventListener("click", (event) => {
  if (event.target === rulesDialog) closeRulesBtn.click();
});

document.querySelectorAll("[data-number]").forEach((button) => {
  button.addEventListener("click", () =>
    placeNumber(Number(button.dataset.number)),
  );
});

document.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "9") placeNumber(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0")
    eraseCell();
  if (event.key.toLowerCase() === "n") noteBtn.click();

  const { row, col } = getCellCoords(selectedIndex);
  const moves = {
    ArrowUp: Math.max(0, row - 1) * SIZE + col,
    ArrowDown: Math.min(SIZE - 1, row + 1) * SIZE + col,
    ArrowLeft: row * SIZE + Math.max(0, col - 1),
    ArrowRight: row * SIZE + Math.min(SIZE - 1, col + 1),
  };
  if (event.key in moves) {
    event.preventDefault();
    selectCell(moves[event.key]);
  }
});

newGame();
