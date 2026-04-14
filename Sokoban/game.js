// 创新推箱子游戏 - 核心代码

// 游戏状态
let gameState = {
    currentLevel: 1,
    moves: 0,
    startTime: 0,
    elapsedTime: 0,
    player: { x: 0, y: 0 },
    boxes: [],
    buttons: [],
    platforms: [],
    conveyorBelts: [],
    levelData: null
};

// 关卡数据
const levels = [
    {
        name: "入门挑战",
        width: 10,
        height: 8,
        grid: [
            "##########",
            "#        #",
            "#  $     #",
            "#@ $     #",
            "#  . .   #",
            "#        #",
            "#        #",
            "##########"
        ]
    },
    {
        name: "颜色对应",
        width: 12,
        height: 10,
        grid: [
            "############",
            "#          #",
            "#  $r $b   #",
            "#@ $g     #",
            "#  .r .b   #",
            "#  .g     #",
            "#          #",
            "#          #",
            "#          #",
            "############"
        ]
    },
    {
        name: "传送带迷宫",
        width: 14,
        height: 12,
        grid: [
            "##############",
            "#            #",
            "#  > > >     #",
            "#  ^ $ ^     #",
            "#  ^   ^     #",
            "#@^ $ ^     #",
            "#  ^   ^     #",
            "#  v $ v     #",
            "#  v   v     #",
            "#  < < < .   #",
            "#            #",
            "##############"
        ]
    },
    {
        name: "按钮开关",
        width: 12,
        height: 10,
        grid: [
            "############",
            "#          #",
            "#  $   $   #",
            "#  #   #   #",
            "#  #   #   #",
            "#@ #   #   #",
            "#  #   #   #",
            "#  B   B   #",
            "#  .   .   #",
            "############"
        ]
    },
    {
        name: "移动平台",
        width: 16,
        height: 12,
        grid: [
            "################",
            "#              #",
            "#  $     $     #",
            "#  P     P     #",
            "#  P     P     #",
            "#  P     P     #",
            "#@P     P     #",
            "#  P     P     #",
            "#  P     P     #",
            "#  .     .     #",
            "#              #",
            "################"
        ]
    },
    {
        name: "终极挑战",
        width: 18,
        height: 14,
        grid: [
            "##################",
            "#                #",
            "#  $r $b $g     #",
            "#  > > > > >    #",
            "#  ^ $ ^ $ ^    #",
            "#  ^   ^   ^    #",
            "#  ^ $ ^ $ ^    #",
            "#@^   ^   ^    #",
            "#  v $ v $ v    #",
            "#  v   v   v    #",
            "#  v $ v $ v    #",
            "#  < < < < < .r #",
            "#              .b#",
            "##################"
        ]
    }
];

// 游戏元素类型
const TILES = {
    WALL: '#',
    FLOOR: ' ',
    PLAYER: '@',
    BOX: '$',
    TARGET: '.',
    RED_BOX: '$r',
    BLUE_BOX: '$b',
    GREEN_BOX: '$g',
    RED_TARGET: '.r',
    BLUE_TARGET: '.b',
    GREEN_TARGET: '.g',
    CONVEYOR_RIGHT: '>',
    CONVEYOR_LEFT: '<',
    CONVEYOR_UP: '^',
    CONVEYOR_DOWN: 'v',
    BUTTON: 'B',
    PLATFORM: 'P'
};

// DOM 元素
const gameGrid = document.getElementById('gameGrid');
const levelElement = document.getElementById('level');
const movesElement = document.getElementById('moves');
const timeElement = document.getElementById('time');
const messageElement = document.getElementById('message');
const victoryScreen = document.getElementById('victoryScreen');
const victoryMessage = document.getElementById('victoryMessage');
const victoryMoves = document.getElementById('victoryMoves');
const victoryTime = document.getElementById('victoryTime');
const victoryLevel = document.getElementById('victoryLevel');

// 初始化游戏
function initGame() {
    loadLevel(gameState.currentLevel);
    startTimer();
    addKeyboardControls();
}

// 加载关卡
function loadLevel(levelNumber) {
    if (levelNumber < 1 || levelNumber > levels.length) {
        showMessage('没有更多关卡了！');
        return;
    }
    
    gameState.currentLevel = levelNumber;
    gameState.moves = 0;
    gameState.startTime = Date.now();
    gameState.elapsedTime = 0;
    gameState.boxes = [];
    gameState.buttons = [];
    gameState.platforms = [];
    gameState.conveyorBelts = [];
    
    const level = levels[levelNumber - 1];
    gameState.levelData = level;
    
    // 解析关卡数据
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            const char = level.grid[y][x];
            
            if (char === TILES.PLAYER) {
                gameState.player.x = x;
                gameState.player.y = y;
            } else if (char === TILES.BOX) {
                gameState.boxes.push({ x, y, color: 'default' });
            } else if (char === TILES.RED_BOX) {
                gameState.boxes.push({ x, y, color: 'red' });
            } else if (char === TILES.BLUE_BOX) {
                gameState.boxes.push({ x, y, color: 'blue' });
            } else if (char === TILES.GREEN_BOX) {
                gameState.boxes.push({ x, y, color: 'green' });
            } else if (char === TILES.BUTTON) {
                gameState.buttons.push({ x, y, pressed: false });
            } else if (char === TILES.PLATFORM) {
                gameState.platforms.push({ x, y, active: false });
            } else if (char === TILES.CONVEYOR_RIGHT || char === TILES.CONVEYOR_LEFT || 
                      char === TILES.CONVEYOR_UP || char === TILES.CONVEYOR_DOWN) {
                gameState.conveyorBelts.push({ x, y, direction: char });
            }
        }
    }
    
    renderLevel();
    updateUI();
}

// 渲染关卡
function renderLevel() {
    const level = gameState.levelData;
    gameGrid.style.gridTemplateColumns = `repeat(${level.width}, 40px)`;
    gameGrid.style.gridTemplateRows = `repeat(${level.height}, 40px)`;
    gameGrid.innerHTML = '';
    
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            const char = level.grid[y][x];
            
            // 设置地面类型
            if (char === TILES.WALL) {
                cell.classList.add('wall');
            } else if (char === TILES.TARGET) {
                cell.classList.add('target');
            } else if (char === TILES.RED_TARGET) {
                cell.classList.add('red-target');
            } else if (char === TILES.BLUE_TARGET) {
                cell.classList.add('blue-target');
            } else if (char === TILES.GREEN_TARGET) {
                cell.classList.add('green-target');
            } else if (char === TILES.PLATFORM) {
                cell.classList.add('platform');
            } else if (char === TILES.CONVEYOR_RIGHT) {
                cell.classList.add('conveyor-right');
                cell.textContent = '→';
            } else if (char === TILES.CONVEYOR_LEFT) {
                cell.classList.add('conveyor-left');
                cell.textContent = '←';
            } else if (char === TILES.CONVEYOR_UP) {
                cell.classList.add('conveyor-up');
                cell.textContent = '↑';
            } else if (char === TILES.CONVEYOR_DOWN) {
                cell.classList.add('conveyor-down');
                cell.textContent = '↓';
            } else if (char === TILES.BUTTON) {
                cell.classList.add('button');
                const button = gameState.buttons.find(b => b.x === x && b.y === y);
                if (button && button.pressed) {
                    cell.classList.add('pressed');
                }
            } else {
                cell.classList.add('floor');
            }
            
            gameGrid.appendChild(cell);
        }
    }
    
    // 渲染箱子
    gameState.boxes.forEach(box => {
        const cell = getCell(box.x, box.y);
        if (cell) {
            const boxElement = document.createElement('div');
            boxElement.className = `box ${box.color}`;
            
            // 检查是否在目标上
            const target = getTargetAt(box.x, box.y);
            if (target && (box.color === target.color || target.color === 'default')) {
                boxElement.classList.add('on-target');
            }
            
            boxElement.textContent = '📦';
            cell.appendChild(boxElement);
        }
    });
    
    // 渲染玩家
    const playerCell = getCell(gameState.player.x, gameState.player.y);
    if (playerCell) {
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.textContent = '👤';
        playerCell.appendChild(playerElement);
    }
}

// 获取指定位置的单元格
function getCell(x, y) {
    const index = y * gameState.levelData.width + x;
    return gameGrid.children[index];
}

// 获取指定位置的目标
function getTargetAt(x, y) {
    const char = gameState.levelData.grid[y][x];
    if (char === TILES.TARGET) {
        return { color: 'default' };
    } else if (char === TILES.RED_TARGET) {
        return { color: 'red' };
    } else if (char === TILES.BLUE_TARGET) {
        return { color: 'blue' };
    } else if (char === TILES.GREEN_TARGET) {
        return { color: 'green' };
    }
    return null;
}

// 移动玩家
function movePlayer(dx, dy) {
    const newX = gameState.player.x + dx;
    const newY = gameState.player.y + dy;
    
    // 检查边界
    if (newX < 0 || newX >= gameState.levelData.width || 
        newY < 0 || newY >= gameState.levelData.height) {
        return;
    }
    
    // 检查墙壁
    if (gameState.levelData.grid[newY][newX] === TILES.WALL) {
        return;
    }
    
    // 检查箱子
    const boxIndex = gameState.boxes.findIndex(box => box.x === newX && box.y === newY);
    if (boxIndex !== -1) {
        const box = gameState.boxes[boxIndex];
        const boxNewX = box.x + dx;
        const boxNewY = box.y + dy;
        
        // 检查箱子移动边界
        if (boxNewX < 0 || boxNewX >= gameState.levelData.width || 
            boxNewY < 0 || boxNewY >= gameState.levelData.height) {
            return;
        }
        
        // 检查箱子移动是否撞墙
        if (gameState.levelData.grid[boxNewY][boxNewX] === TILES.WALL) {
            return;
        }
        
        // 检查箱子是否撞到其他箱子
        if (gameState.boxes.some(otherBox => 
            otherBox.x === boxNewX && otherBox.y === boxNewY && 
            otherBox !== box)) {
            return;
        }
        
        // 移动箱子
        box.x = boxNewX;
        box.y = boxNewY;
    }
    
    // 移动玩家
    gameState.player.x = newX;
    gameState.player.y = newY;
    gameState.moves++;
    
    // 检查按钮
    checkButtons();
    
    // 检查传送带
    checkConveyorBelts();
    
    // 检查胜利条件
    if (checkVictory()) {
        showVictory();
    }
    
    renderLevel();
    updateUI();
}

// 检查按钮
function checkButtons() {
    gameState.buttons.forEach(button => {
        const hasBox = gameState.boxes.some(box => box.x === button.x && box.y === button.y);
        button.pressed = hasBox;
    });
}

// 检查传送带
function checkConveyorBelts() {
    gameState.conveyorBelts.forEach(belt => {
        // 检查是否有箱子在传送带上
        const boxIndex = gameState.boxes.findIndex(box => box.x === belt.x && box.y === belt.y);
        if (boxIndex !== -1) {
            const box = gameState.boxes[boxIndex];
            let newX = box.x;
            let newY = box.y;
            
            // 根据传送带方向移动箱子
            switch (belt.direction) {
                case TILES.CONVEYOR_RIGHT:
                    newX++;
                    break;
                case TILES.CONVEYOR_LEFT:
                    newX--;
                    break;
                case TILES.CONVEYOR_UP:
                    newY--;
                    break;
                case TILES.CONVEYOR_DOWN:
                    newY++;
                    break;
            }
            
            // 检查边界和碰撞
            if (newX >= 0 && newX < gameState.levelData.width && 
                newY >= 0 && newY < gameState.levelData.height && 
                gameState.levelData.grid[newY][newX] !== TILES.WALL &&
                !gameState.boxes.some(otherBox => 
                    otherBox.x === newX && otherBox.y === newY && 
                    otherBox !== box)) {
                box.x = newX;
                box.y = newY;
            }
        }
    });
}

// 检查胜利条件
function checkVictory() {
    for (const box of gameState.boxes) {
        const target = getTargetAt(box.x, box.y);
        if (!target || (box.color !== target.color && target.color !== 'default')) {
            return false;
        }
    }
    return gameState.boxes.length > 0;
}

// 显示胜利界面
function showVictory() {
    victoryMessage.textContent = `恭喜完成 ${levels[gameState.currentLevel - 1].name}！`;
    victoryMoves.textContent = gameState.moves;
    victoryTime.textContent = Math.floor(gameState.elapsedTime / 1000);
    victoryLevel.textContent = gameState.currentLevel;
    victoryScreen.style.display = 'flex';
}

// 更新UI
function updateUI() {
    levelElement.textContent = gameState.currentLevel;
    movesElement.textContent = gameState.moves;
    timeElement.textContent = Math.floor(gameState.elapsedTime / 1000);
}

// 显示消息
function showMessage(text) {
    messageElement.textContent = text;
    messageElement.classList.add('show');
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, 2000);
}

// 开始计时器
function startTimer() {
    setInterval(() => {
        gameState.elapsedTime = Date.now() - gameState.startTime;
        updateUI();
    }, 1000);
}

// 添加键盘控制
function addKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                movePlayer(0, -1);
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                movePlayer(0, 1);
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                movePlayer(-1, 0);
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                movePlayer(1, 0);
                break;
        }
    });
}

// 重置关卡
function resetLevel() {
    victoryScreen.style.display = 'none';
    loadLevel(gameState.currentLevel);
}

// 下一关
function nextLevel() {
    victoryScreen.style.display = 'none';
    loadLevel(gameState.currentLevel + 1);
}

// 上一关
function prevLevel() {
    loadLevel(gameState.currentLevel - 1);
}

// 初始化游戏
window.onload = initGame;
