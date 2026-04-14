// 像素地牢探险 - 游戏核心代码
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// 游戏配置
const TILE_SIZE = 32;
const MAP_WIDTH = 25;
const MAP_HEIGHT = 18;
const VIEWPORT_WIDTH = Math.ceil(800 / TILE_SIZE);
const VIEWPORT_HEIGHT = Math.ceil(600 / TILE_SIZE);

// 图块类型
const TILES = {
    WALL: 0,
    FLOOR: 1,
    DOOR: 2,
    STAIRS_DOWN: 3,
    STAIRS_UP: 4,
    CHEST: 5,
    TRAP: 6,
    SHOP: 7
};

// 游戏状态
let gameState = {
    running: false,
    floor: 1,
    enemiesKilled: 0,
    messageHistory: []
};

// 玩家对象
let player = {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    atk: 10,
    def: 5,
    gold: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    inventory: [],
    selectedSlot: 0
};

// 地图数据
let map = [];
let explored = [];
let visible = [];

// 实体列表
let enemies = [];
let items = [];
let particles = [];

// 输入状态
const keys = {};
let lastMoveTime = 0;
const MOVE_DELAY = 150;

// 随机数工具
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// 消息系统
function addMessage(text, type = 'normal') {
    const messageLog = document.getElementById('messageLog');
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    messageLog.appendChild(msg);
    messageLog.scrollTop = messageLog.scrollHeight;
    
    // 限制消息数量
    while (messageLog.children.length > 20) {
        messageLog.removeChild(messageLog.firstChild);
    }
}

// 粒子效果
class Particle {
    constructor(x, y, color, type = 'normal') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        
        if (type === 'damage') {
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -1 - Math.random() * 2;
            this.size = 12 + Math.random() * 8;
        } else if (type === 'sparkle') {
            this.vx = (Math.random() - 0.5) * 3;
            this.vy = (Math.random() - 0.5) * 3;
            this.size = 4 + Math.random() * 4;
        } else {
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = (Math.random() - 0.5) * 1;
            this.size = 6 + Math.random() * 4;
        }
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        
        if (this.type === 'damage') {
            this.vy += 0.1; // 重力
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}

function createParticles(x, y, color, count, type = 'normal') {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, type));
    }
}

// 地图生成 - 使用房间和走廊算法
function generateMap() {
    // 初始化地图为墙壁
    map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(TILES.WALL));
    explored = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(false));
    visible = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(false));
    
    enemies = [];
    items = [];
    
    const rooms = [];
    const maxRooms = random(5, 10);
    const minRoomSize = 4;
    const maxRoomSize = 8;
    
    // 生成房间
    for (let i = 0; i < maxRooms; i++) {
        const w = random(minRoomSize, maxRoomSize);
        const h = random(minRoomSize, maxRoomSize);
        const x = random(1, MAP_WIDTH - w - 1);
        const y = random(1, MAP_HEIGHT - h - 1);
        
        const newRoom = { x, y, w, h, cx: Math.floor(x + w/2), cy: Math.floor(y + h/2) };
        
        // 检查房间是否重叠
        let overlap = false;
        for (const room of rooms) {
            if (x < room.x + room.w + 1 && x + w + 1 > room.x &&
                y < room.y + room.h + 1 && y + h + 1 > room.y) {
                overlap = true;
                break;
            }
        }
        
        if (!overlap) {
            // 创建房间
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    map[ry][rx] = TILES.FLOOR;
                }
            }
            
            // 连接前一个房间
            if (rooms.length > 0) {
                const prev = rooms[rooms.length - 1];
                if (Math.random() < 0.5) {
                    createHCorridor(prev.cx, newRoom.cx, prev.cy);
                    createVCorridor(prev.cy, newRoom.cy, newRoom.cx);
                } else {
                    createVCorridor(prev.cy, newRoom.cy, prev.cx);
                    createHCorridor(prev.cx, newRoom.cx, newRoom.cy);
                }
            }
            
            rooms.push(newRoom);
        }
    }
    
    if (rooms.length === 0) {
        // 如果房间生成失败，创建默认房间
        generateDefaultMap();
        return;
    }
    
    // 设置玩家位置
    const startRoom = rooms[0];
    player.x = startRoom.cx;
    player.y = startRoom.cy;
    
    // 设置楼梯位置
    const endRoom = rooms[rooms.length - 1];
    map[endRoom.cy][endRoom.cx] = TILES.STAIRS_DOWN;
    
    // 在房间中放置物品和敌人
    rooms.forEach((room, index) => {
        if (index === 0) return; // 跳过起始房间
        
        // 放置敌人
        const enemyCount = random(0, Math.min(3, Math.floor(index / 2) + 1));
        for (let i = 0; i < enemyCount; i++) {
            const ex = random(room.x + 1, room.x + room.w - 2);
            const ey = random(room.y + 1, room.y + room.h - 2);
            if (map[ey][ex] === TILES.FLOOR && !(ex === player.x && ey === player.y)) {
                enemies.push(createEnemy(ex, ey));
            }
        }
        
        // 放置物品
        if (Math.random() < 0.4) {
            const ix = random(room.x + 1, room.x + room.w - 2);
            const iy = random(room.y + 1, room.y + room.h - 2);
            if (map[iy][ix] === TILES.FLOOR) {
                items.push(createItem(ix, iy));
            }
        }
        
        // 放置宝箱
        if (Math.random() < 0.2) {
            const cx = random(room.x + 1, room.x + room.w - 2);
            const cy = random(room.y + 1, room.y + room.h - 2);
            if (map[cy][cx] === TILES.FLOOR) {
                map[cy][cx] = TILES.CHEST;
            }
        }
        
        // 放置陷阱
        if (Math.random() < 0.15) {
            const tx = random(room.x + 1, room.x + room.w - 2);
            const ty = random(room.y + 1, room.y + room.h - 2);
            if (map[ty][tx] === TILES.FLOOR) {
                map[ty][tx] = TILES.TRAP;
            }
        }
    });
    
    updateVisibility();
}

function createHCorridor(x1, x2, y) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
            map[y][x] = TILES.FLOOR;
        }
    }
}

function createVCorridor(y1, y2, x) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
            map[y][x] = TILES.FLOOR;
        }
    }
}

function generateDefaultMap() {
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            map[y][x] = TILES.FLOOR;
        }
    }
    player.x = Math.floor(MAP_WIDTH / 2);
    player.y = Math.floor(MAP_HEIGHT / 2);
    map[MAP_HEIGHT - 2][MAP_WIDTH - 2] = TILES.STAIRS_DOWN;
}

// 敌人系统
function createEnemy(x, y) {
    const types = [
        { name: '史莱姆', char: '🟢', hp: 20, atk: 5, def: 2, xp: 15, gold: random(5, 15), color: '#44ff44' },
        { name: '哥布林', char: '👺', hp: 30, atk: 8, def: 3, xp: 25, gold: random(10, 25), color: '#44ff44' },
        { name: '骷髅兵', char: '💀', hp: 25, atk: 10, def: 2, xp: 30, gold: random(15, 30), color: '#cccccc' },
        { name: '蝙蝠', char: '🦇', hp: 15, atk: 6, def: 1, xp: 12, gold: random(3, 10), color: '#8844ff' },
        { name: '老鼠', char: '🐀', hp: 12, atk: 4, def: 1, xp: 8, gold: random(2, 8), color: '#888888' },
        { name: '蜘蛛', char: '🕷️', hp: 18, atk: 7, def: 2, xp: 18, gold: random(5, 12), color: '#884444' },
        { name: '幽灵', char: '👻', hp: 35, atk: 12, def: 5, xp: 40, gold: random(20, 40), color: '#aaaaff' },
        { name: '兽人', char: '👹', hp: 50, atk: 15, def: 6, xp: 60, gold: random(30, 60), color: '#44aa44' },
        { name: '恶魔', char: '👿', hp: 80, atk: 20, def: 8, xp: 100, gold: random(50, 100), color: '#ff4444' },
        { name: '龙', char: '🐉', hp: 150, atk: 30, def: 15, xp: 300, gold: random(200, 500), color: '#ff8800' }
    ];
    
    // 根据层数选择敌人类型
    const availableTypes = types.slice(0, Math.min(types.length, 3 + Math.floor(gameState.floor / 2)));
    const type = randomChoice(availableTypes);
    
    return {
        x, y,
        ...type,
        maxHp: type.hp + random(0, Math.floor(gameState.floor * 2)),
        hp: type.hp + random(0, Math.floor(gameState.floor * 2)),
        atk: type.atk + Math.floor(gameState.floor * 0.5),
        def: type.def + Math.floor(gameState.floor * 0.3),
        moved: false,
        chaseTimer: 0,
        maxChaseTime: 3000 // 最大追击时间（毫秒）
    };
}

// 物品系统
function createItem(x, y) {
    const types = [
        { name: '生命药水', char: '❤️', type: 'potion', effect: 'heal', value: 30, color: '#ff4444' },
        { name: '大生命药水', char: '💖', type: 'potion', effect: 'heal', value: 60, color: '#ff8888' },
        { name: '力量药水', char: '💪', type: 'potion', effect: 'atk', value: 5, color: '#ff8800' },
        { name: '防御药水', char: '🛡️', type: 'potion', effect: 'def', value: 3, color: '#4488ff' },
        { name: '金币袋', char: '💰', type: 'gold', value: random(20, 100), color: '#ffff00' },
        { name: '经验书', char: '📖', type: 'xp', value: random(30, 80), color: '#88ff88' },
        { name: '传送卷轴', char: '📜', type: 'scroll', effect: 'teleport', color: '#ff88ff' },
        { name: '鉴定卷轴', char: '🔮', type: 'scroll', effect: 'identify', color: '#88ffff' },
        { name: '弓箭', char: '🏹', type: 'ammo', effect: 'arrows', value: 5, color: '#888800' }
    ];
    
    const item = randomChoice(types);
    return { x, y, ...item };
}

// 视野系统
function updateVisibility() {
    const viewRadius = 6;
    
    // 重置可见性
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            visible[y][x] = false;
        }
    }
    
    // 使用简单的圆形视野
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const x = player.x + dx;
            const y = player.y + dy;
            
            if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= viewRadius) {
                    visible[y][x] = true;
                    explored[y][x] = true;
                }
            }
        }
    }
}

// 移动系统
function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // 检查边界
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) {
        return false;
    }
    
    // 检查墙壁
    if (map[newY][newX] === TILES.WALL) {
        return false;
    }
    
    // 检查敌人
    const enemy = enemies.find(e => e.x === newX && e.y === newY);
    if (enemy) {
        attackEnemy(enemy);
        return true;
    }
    
    // 移动玩家
    player.x = newX;
    player.y = newY;
    
    // 检查特殊地块
    checkTile(newX, newY);
    
    // 更新视野
    updateVisibility();
    
    // 敌人回合
    enemyTurn();
    
    return true;
}

function checkTile(x, y) {
    const tile = map[y][x];
    
    switch(tile) {
        case TILES.STAIRS_DOWN:
            addMessage('发现向下的楼梯！按E键进入下一层', 'item');
            break;
        case TILES.CHEST:
            openChest(x, y);
            break;
        case TILES.TRAP:
            triggerTrap(x, y);
            break;
    }
    
    // 检查物品
    const itemIndex = items.findIndex(i => i.x === x && i.y === y);
    if (itemIndex !== -1) {
        const item = items[itemIndex];
        addMessage(`发现 ${item.name}！按E键拾取`, 'item');
    }
}

function openChest(x, y) {
    map[y][x] = TILES.FLOOR;
    const gold = random(30, 100) + gameState.floor * 10;
    player.gold += gold;
    addMessage(`打开宝箱，获得 ${gold} 金币！`, 'item');
    createParticles(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, '#ffff00', 10, 'sparkle');
    updateUI();
}

function triggerTrap(x, y) {
    map[y][x] = TILES.FLOOR;
    const damage = random(10, 20) + gameState.floor * 2;
    player.hp = Math.max(0, player.hp - damage);
    addMessage(`触发陷阱！受到 ${damage} 点伤害！`, 'damage');
    createParticles(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, '#ff0000', 8, 'damage');
    updateUI();
    
    if (player.hp <= 0) {
        gameOver();
    }
}

function attackEnemy(enemy) {
    // 计算伤害
    const damage = Math.max(1, player.atk - enemy.def + random(-2, 5));
    enemy.hp -= damage;
    
    addMessage(`你攻击 ${enemy.name}，造成 ${damage} 点伤害！`, 'damage');
    createParticles(
        enemy.x * TILE_SIZE + TILE_SIZE/2, 
        enemy.y * TILE_SIZE + TILE_SIZE/2, 
        '#ff0000', 5, 'damage'
    );
    
    if (enemy.hp <= 0) {
        // 敌人死亡
        addMessage(`击败了 ${enemy.name}！获得 ${enemy.xp} 经验值和 ${enemy.gold} 金币！`, 'level');
        player.gold += enemy.gold;
        gainXp(enemy.xp);
        gameState.enemiesKilled++;
        
        // 掉落物品
        if (Math.random() < 0.3) {
            items.push(createItem(enemy.x, enemy.y));
        }
        
        enemies = enemies.filter(e => e !== enemy);
        createParticles(
            enemy.x * TILE_SIZE + TILE_SIZE/2, 
            enemy.y * TILE_SIZE + TILE_SIZE/2, 
            enemy.color, 15, 'sparkle'
        );
    }
    
    updateUI();
}

function enemyTurn() {
    const now = Date.now();
    
    enemies.forEach(enemy => {
        const dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
        
        // 检查是否在视野内
        if (dist <= 8) {
            // 重置追击计时器
            enemy.chaseTimer = now;
            
            // 追击玩家
            let dx = 0, dy = 0;
            
            if (enemy.x < player.x) dx = 1;
            else if (enemy.x > player.x) dx = -1;
            else if (enemy.y < player.y) dy = 1;
            else if (enemy.y > player.y) dy = -1;
            
            const newX = enemy.x + dx;
            const newY = enemy.y + dy;
            
            // 检查是否可以移动
            if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT) {
                if (map[newY][newX] !== TILES.WALL && 
                    !enemies.some(e => e !== enemy && e.x === newX && e.y === newY)) {
                    if (newX === player.x && newY === player.y) {
                        // 攻击玩家
                        const damage = Math.max(1, enemy.atk - player.def + random(-2, 3));
                        player.hp = Math.max(0, player.hp - damage);
                        addMessage(`${enemy.name} 攻击你，造成 ${damage} 点伤害！`, 'damage');
                        createParticles(
                            player.x * TILE_SIZE + TILE_SIZE/2, 
                            player.y * TILE_SIZE + TILE_SIZE/2, 
                            '#ff0000', 5, 'damage'
                        );
                        
                        if (player.hp <= 0) {
                            gameOver();
                        }
                    } else {
                        enemy.x = newX;
                        enemy.y = newY;
                    }
                }
            }
        } else if (now - enemy.chaseTimer > enemy.maxChaseTime) {
            // 追击时间结束，随机移动
            if (Math.random() < 0.3) {
                const moves = [[0,1], [0,-1], [1,0], [-1,0]];
                const [dx, dy] = randomChoice(moves);
                const newX = enemy.x + dx;
                const newY = enemy.y + dy;
                
                if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT) {
                    if (map[newY][newX] !== TILES.WALL && 
                        !enemies.some(e => e !== enemy && e.x === newX && e.y === newY) &&
                        !(newX === player.x && newY === player.y)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    }
                }
            }
        }
    });
    
    updateUI();
}

function gainXp(amount) {
    player.xp += amount;
    
    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.maxHp += 10;
        player.hp = player.maxHp;
        player.atk += 2;
        player.def += 1;
        player.xpToNext = Math.floor(player.xpToNext * 1.5);
        
        addMessage(`升级了！等级提升至 ${player.level}！`, 'level');
        createParticles(
            player.x * TILE_SIZE + TILE_SIZE/2, 
            player.y * TILE_SIZE + TILE_SIZE/2, 
            '#00ff00', 20, 'sparkle'
        );
    }
    
    updateUI();
}

function pickupItem() {
    const itemIndex = items.findIndex(i => i.x === player.x && i.y === player.y);
    if (itemIndex !== -1) {
        const item = items[itemIndex];
        
        if (player.inventory.length < 5) {
            player.inventory.push(item);
            items.splice(itemIndex, 1);
            addMessage(`拾取了 ${item.name}`, 'item');
            updateUI();
        } else {
            addMessage('背包已满！', 'damage');
        }
    }
}

function useItem(slot) {
    if (slot >= player.inventory.length) return;
    
    const item = player.inventory[slot];
    
    switch(item.effect) {
        case 'heal':
            const healAmount = Math.min(item.value, player.maxHp - player.hp);
            player.hp += healAmount;
            addMessage(`使用了 ${item.name}，恢复 ${healAmount} 点生命值！`, 'heal');
            createParticles(
                player.x * TILE_SIZE + TILE_SIZE/2, 
                player.y * TILE_SIZE + TILE_SIZE/2, 
                '#00ff00', 10, 'sparkle'
            );
            break;
        case 'atk':
            player.atk += item.value;
            addMessage(`使用了 ${item.name}，攻击力提升 ${item.value}！`, 'item');
            break;
        case 'def':
            player.def += item.value;
            addMessage(`使用了 ${item.name}，防御力提升 ${item.value}！`, 'item');
            break;
        case 'arrows':
            player.arrows += item.value;
            addMessage(`获得了 ${item.value} 支弓箭！`, 'item');
            break;
    }
    
    player.inventory.splice(slot, 1);
    if (player.selectedSlot >= player.inventory.length) {
        player.selectedSlot = Math.max(0, player.inventory.length - 1);
    }
    updateUI();
}

// 远程攻击函数
function rangedAttack() {
    if (player.arrows <= 0) {
        addMessage('没有弓箭了！', 'damage');
        return;
    }
    
    // 找到最近的敌人
    let closestEnemy = null;
    let minDist = Infinity;
    
    enemies.forEach(enemy => {
        const dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
        if (dist <= 5 && dist < minDist) { // 最大攻击距离5格
            minDist = dist;
            closestEnemy = enemy;
        }
    });
    
    if (closestEnemy) {
        // 计算伤害
        const damage = Math.max(1, player.atk - closestEnemy.def / 2 + random(-1, 3));
        closestEnemy.hp -= damage;
        player.arrows--;
        
        addMessage(`使用弓箭攻击 ${closestEnemy.name}，造成 ${damage} 点伤害！`, 'damage');
        createParticles(
            closestEnemy.x * TILE_SIZE + TILE_SIZE/2, 
            closestEnemy.y * TILE_SIZE + TILE_SIZE/2, 
            '#ff8800', 8, 'damage'
        );
        
        if (closestEnemy.hp <= 0) {
            // 敌人死亡
            addMessage(`击败了 ${closestEnemy.name}！获得 ${closestEnemy.xp} 经验值和 ${closestEnemy.gold} 金币！`, 'level');
            player.gold += closestEnemy.gold;
            gainXp(closestEnemy.xp);
            gameState.enemiesKilled++;
            
            // 掉落物品
            if (Math.random() < 0.3) {
                items.push(createItem(closestEnemy.x, closestEnemy.y));
            }
            
            enemies = enemies.filter(e => e !== closestEnemy);
            createParticles(
                closestEnemy.x * TILE_SIZE + TILE_SIZE/2, 
                closestEnemy.y * TILE_SIZE + TILE_SIZE/2, 
                closestEnemy.color, 15, 'sparkle'
            );
        }
        
        updateUI();
    } else {
        addMessage('没有敌人在攻击范围内！', 'damage');
    }
}

function nextFloor() {
    if (map[player.y][player.x] === TILES.STAIRS_DOWN) {
        gameState.floor++;
        addMessage(`进入第 ${gameState.floor} 层...`, 'level');
        generateMap();
        updateUI();
    }
}

// 绘制系统
function draw() {
    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 计算视野偏移
    const offsetX = Math.max(0, Math.min(player.x - VIEWPORT_WIDTH/2, MAP_WIDTH - VIEWPORT_WIDTH));
    const offsetY = Math.max(0, Math.min(player.y - VIEWPORT_HEIGHT/2, MAP_HEIGHT - VIEWPORT_HEIGHT));
    
    // 绘制地图
    for (let y = Math.floor(offsetY); y < Math.min(MAP_HEIGHT, offsetY + VIEWPORT_HEIGHT + 1); y++) {
        for (let x = Math.floor(offsetX); x < Math.min(MAP_WIDTH, offsetX + VIEWPORT_WIDTH + 1); x++) {
            const screenX = Math.floor((x - offsetX) * TILE_SIZE);
            const screenY = Math.floor((y - offsetY) * TILE_SIZE);
            
            if (explored[y][x]) {
                const tile = map[y][x];
                
                // 绘制地板
                if (tile !== TILES.WALL) {
                    ctx.fillStyle = visible[y][x] ? '#3a3a4a' : '#2a2a3a';
                    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                }
                
                // 绘制特殊图块
                switch(tile) {
                    case TILES.WALL:
                        ctx.fillStyle = visible[y][x] ? '#5a5a6a' : '#3a3a4a';
                        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = visible[y][x] ? '#6a6a7a' : '#4a4a5a';
                        ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        break;
                    case TILES.STAIRS_DOWN:
                        ctx.fillStyle = visible[y][x] ? '#ffff00' : '#888800';
                        ctx.font = '24px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('⬇️', screenX + TILE_SIZE/2, screenY + TILE_SIZE - 4);
                        break;
                    case TILES.CHEST:
                        ctx.fillStyle = visible[y][x] ? '#ff8800' : '#884400';
                        ctx.font = '24px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('📦', screenX + TILE_SIZE/2, screenY + TILE_SIZE - 4);
                        break;
                    case TILES.TRAP:
                        if (visible[y][x]) {
                            ctx.fillStyle = '#ff0000';
                            ctx.font = '20px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('⚠️', screenX + TILE_SIZE/2, screenY + TILE_SIZE - 6);
                        }
                        break;
                }
                
                // 绘制阴影
                if (!visible[y][x]) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
    
    // 绘制物品
    items.forEach(item => {
        if (visible[item.y][item.x]) {
            const screenX = Math.floor((item.x - offsetX) * TILE_SIZE);
            const screenY = Math.floor((item.y - offsetY) * TILE_SIZE);
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.char, screenX + TILE_SIZE/2, screenY + TILE_SIZE - 6);
        }
    });
    
    // 绘制敌人
    enemies.forEach(enemy => {
        if (visible[enemy.y][enemy.x]) {
            const screenX = Math.floor((enemy.x - offsetX) * TILE_SIZE);
            const screenY = Math.floor((enemy.y - offsetY) * TILE_SIZE);
            
            // 绘制敌人
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(enemy.char, screenX + TILE_SIZE/2, screenY + TILE_SIZE - 4);
            
            // 绘制血条
            const hpPercent = enemy.hp / enemy.maxHp;
            ctx.fillStyle = '#333';
            ctx.fillRect(screenX + 2, screenY - 6, TILE_SIZE - 4, 4);
            ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillRect(screenX + 2, screenY - 6, (TILE_SIZE - 4) * hpPercent, 4);
        }
    });
    
    // 绘制玩家
    const playerScreenX = Math.floor((player.x - offsetX) * TILE_SIZE);
    const playerScreenY = Math.floor((player.y - offsetY) * TILE_SIZE);
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🧙', playerScreenX + TILE_SIZE/2, playerScreenY + TILE_SIZE - 4);
    
    // 绘制粒子效果
    particles.forEach(p => p.draw(ctx));
    
    // 绘制小地图
    drawMinimap();
}

function drawMinimap() {
    const scaleX = minimapCanvas.width / MAP_WIDTH;
    const scaleY = minimapCanvas.height / MAP_HEIGHT;
    
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (explored[y][x]) {
                const px = x * scaleX;
                const py = y * scaleY;
                
                if (map[y][x] === TILES.WALL) {
                    minimapCtx.fillStyle = '#444';
                } else {
                    minimapCtx.fillStyle = '#666';
                }
                
                minimapCtx.fillRect(px, py, scaleX, scaleY);
            }
        }
    }
    
    // 绘制玩家位置
    minimapCtx.fillStyle = '#00ff00';
    minimapCtx.fillRect(player.x * scaleX, player.y * scaleY, scaleX, scaleY);
    
    // 绘制楼梯
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (explored[y][x] && map[y][x] === TILES.STAIRS_DOWN) {
                minimapCtx.fillStyle = '#ffff00';
                minimapCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
            }
        }
    }
}

// UI更新
function updateUI() {
    document.getElementById('hp').textContent = player.hp;
    document.getElementById('maxHp').textContent = player.maxHp;
    document.getElementById('hpBar').style.width = (player.hp / player.maxHp * 100) + '%';
    document.getElementById('atk').textContent = player.atk;
    document.getElementById('def').textContent = player.def;
    document.getElementById('gold').textContent = player.gold;
    document.getElementById('level').textContent = player.level;
    document.getElementById('xpBar').style.width = (player.xp / player.xpToNext * 100) + '%';
    document.getElementById('floorNum').textContent = gameState.floor;
    
    // 更新物品栏
    const slots = document.querySelectorAll('.item-slot');
    slots.forEach((slot, index) => {
        slot.textContent = '';
        slot.classList.remove('active');
        
        if (index < player.inventory.length) {
            slot.textContent = player.inventory[index].char;
        }
        
        if (index === player.selectedSlot) {
            slot.classList.add('active');
        }
    });
    
    // 更新弓箭数量显示
    const statsDiv = document.querySelector('.stats');
    let arrowsDisplay = document.getElementById('arrows');
    if (!arrowsDisplay) {
        arrowsDisplay = document.createElement('div');
        arrowsDisplay.id = 'arrows';
        statsDiv.appendChild(arrowsDisplay);
    }
    arrowsDisplay.textContent = `🏹 弓箭: ${player.arrows}`;
}

// 游戏循环
function gameLoop() {
    if (!gameState.running) return;
    
    // 更新粒子
    particles = particles.filter(p => {
        p.update();
        return p.life > 0;
    });
    
    // 绘制
    draw();
    
    requestAnimationFrame(gameLoop);
}

// 输入处理
document.addEventListener('keydown', (e) => {
    if (!gameState.running) return;
    
    const now = Date.now();
    if (now - lastMoveTime < MOVE_DELAY) return;
    
    keys[e.key] = true;
    
    let moved = false;
    
    switch(e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            moved = movePlayer(0, -1);
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            moved = movePlayer(0, 1);
            break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
            moved = movePlayer(-1, 0);
            break;
        case 'd':
        case 'D':
        case 'ArrowRight':
            moved = movePlayer(1, 0);
            break;
        case ' ':
            e.preventDefault();
            if (player.inventory.length > 0) {
                useItem(player.selectedSlot);
            }
            break;
        case 'e':
        case 'E':
            if (map[player.y][player.x] === TILES.STAIRS_DOWN) {
                nextFloor();
            } else {
                pickupItem();
            }
            break;
        case 'f':
        case 'F':
            rangedAttack();
            break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
            const slot = parseInt(e.key) - 1;
            if (slot < player.inventory.length) {
                player.selectedSlot = slot;
                updateUI();
            }
            break;
    }
    
    if (moved) {
        lastMoveTime = now;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 游戏控制
function showGuide() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('guideScreen').style.display = 'flex';
}

function hideGuide() {
    document.getElementById('guideScreen').style.display = 'none';
    document.getElementById('titleScreen').style.display = 'flex';
}

function showSettings() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('settingsScreen').style.display = 'flex';
}

function hideSettings() {
    document.getElementById('settingsScreen').style.display = 'none';
    document.getElementById('titleScreen').style.display = 'flex';
}

function startGame() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    
    // 重置游戏状态
    gameState = {
        running: true,
        floor: 1,
        enemiesKilled: 0,
        messageHistory: []
    };
    
    // 重置玩家
    player = {
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 5,
        gold: 0,
        level: 1,
        xp: 0,
        xpToNext: 100,
        inventory: [],
        selectedSlot: 0,
        arrows: 5 // 初始弓箭数量
    };
    
    // 清空消息日志
    document.getElementById('messageLog').innerHTML = '';
    addMessage('欢迎来到像素地牢！使用WASD或方向键移动', 'normal');
    addMessage('找到楼梯并按下E键进入下一层', 'normal');
    addMessage('按F键使用弓箭进行远程攻击', 'normal');
    
    // 生成地图
    generateMap();
    updateUI();
    
    // 开始游戏循环
    gameLoop();
}

function restartGame() {
    startGame();
}

function gameOver() {
    gameState.running = false;
    
    document.getElementById('finalFloor').textContent = gameState.floor;
    document.getElementById('enemiesKilled').textContent = gameState.enemiesKilled;
    document.getElementById('finalGold').textContent = player.gold;
    document.getElementById('finalLevel').textContent = player.level;
    
    document.getElementById('gameOver').style.display = 'flex';
}

// 初始化
window.onload = () => {
    // 游戏等待开始
};
