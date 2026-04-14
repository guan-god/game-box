// 游戏配置
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 40;
const GRID_SIZE = 40;
const MOVE_SPEED = 2;

// 摄像机系统
const camera = {
    x: 0,
    y: 0
};

// 领地类型定义
const REGIONS = {
    JINGZHOU: { id: 1, name: '荆州', attribute: '水属性', color: '#A3D9FF' },
    YIZHOU: { id: 2, name: '益州', attribute: '木/毒属性', color: '#70B77E' },
    XILIANG: { id: 3, name: '西凉', attribute: '沙/岩石属性', color: '#FFD966' },
    YOUZHOU: { id: 4, name: '幽州', attribute: '冰属性', color: '#B0E0E6' },
    JIZHOU: { id: 5, name: '冀州', attribute: '平原属性', color: '#F5DEB3' },
    OBSTACLE: { id: 99, name: '障碍物', attribute: '不可通过', color: '#8B8B8B' }
};

// 危险区域定义（100-199为危险区域，后两位表示领地类型）
const DANGER_ZONE = {
    JINGZHOU: 101, // 荆州危险区域
    YIZHOU: 102,   // 益州危险区域
    XILIANG: 103,  // 西凉危险区域
    YOUZHOU: 104,  // 幽州危险区域
    JIZHOU: 105    // 冀州危险区域
};

// 地图管理器
const MapManager = {
    currentMap: null,
    currentMapId: null,
    maps: {},
    
    // 注册地图
    registerMap(id, mapData, config) {
        this.maps[id] = {
            data: mapData,
            width: config.width,
            height: config.height,
            name: config.name,
            attribute: config.attribute,
            exits: config.exits || {}
        };
    },
    
    // 加载地图
    loadMap(id, entryPoint = 'default') {
        if (!this.maps[id]) {
            console.error(`地图 ${id} 不存在`);
            return false;
        }
        
        this.currentMap = this.maps[id];
        this.currentMapId = id;
        
        // 根据入口点设置玩家位置
        if (entryPoint === 'default') {
            player.x = (this.currentMap.width * GRID_SIZE) / 2 - PLAYER_SIZE / 2;
            player.y = (this.currentMap.height * GRID_SIZE) / 2 - PLAYER_SIZE / 2;
        } else if (entryPoint === 'top') {
            player.x = (this.currentMap.width * GRID_SIZE) / 2 - PLAYER_SIZE / 2;
            player.y = GRID_SIZE;
        } else if (entryPoint === 'bottom') {
            player.x = (this.currentMap.width * GRID_SIZE) / 2 - PLAYER_SIZE / 2;
            player.y = (this.currentMap.height - 2) * GRID_SIZE;
        }
        
        player.targetX = player.x;
        player.targetY = player.y;
        
        return true;
    },
    
    // 检查地图切换
    checkMapTransition() {
        if (!this.currentMap) return null;
        
        const playerGridX = Math.floor(player.x / GRID_SIZE);
        const playerGridY = Math.floor(player.y / GRID_SIZE);
        
        // 检查是否到达地图边缘
        if (playerGridY < 0 && this.currentMap.exits.north) {
            return { direction: 'north', targetMap: this.currentMap.exits.north };
        }
        if (playerGridY >= this.currentMap.height && this.currentMap.exits.south) {
            return { direction: 'south', targetMap: this.currentMap.exits.south };
        }
        if (playerGridX < 0 && this.currentMap.exits.west) {
            return { direction: 'west', targetMap: this.currentMap.exits.west };
        }
        if (playerGridX >= this.currentMap.width && this.currentMap.exits.east) {
            return { direction: 'east', targetMap: this.currentMap.exits.east };
        }
        
        return null;
    },
    
    // 获取当前地图数据
    getCurrentMapData() {
        return this.currentMap ? this.currentMap.data : null;
    },
    
    // 获取当前地图信息
    getCurrentMapInfo() {
        return this.currentMap ? {
            name: this.currentMap.name,
            attribute: this.currentMap.attribute,
            width: this.currentMap.width,
            height: this.currentMap.height
        } : null;
    }
};

// 生成地图数据的辅助函数
function generateMapData(width, height, regionId, dangerZoneId) {
    const newMap = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            const random = Math.random();
            if (random < 0.05) {
                row.push(REGIONS.OBSTACLE.id);
            } else if (random < 0.3) {
                row.push(dangerZoneId);
            } else {
                row.push(regionId);
            }
        }
        newMap.push(row);
    }
    return newMap;
}

// 属性克制表
const TYPE_CHART = {
    '水': { '火': 2, '木': 0.5, '雷': 1, '岩石': 1 },
    '火': { '木': 2, '水': 0.5, '雷': 1, '岩石': 1 },
    '木': { '岩石': 2, '火': 0.5, '水': 1, '雷': 1 },
    '雷': { '水': 2, '木': 1, '火': 1, '岩石': 0.5 },
    '岩石': { '火': 2, '水': 1, '木': 0.5, '雷': 2 },
    '无': { '水': 1, '火': 1, '木': 1, '雷': 1, '岩石': 1 }
};

// 游戏状态
let gameState = {
    currentState: 'map', // map, battle, menu
    menuState: 'main', // main, team, bag
    encounterCooldown: 0 // 遇敌冷却时间
};

// 战斗状态
let battleState = {
    wildGeneral: null,
    playerGeneral: null,
    currentPhase: 'menu', // menu, skillSelect, battle, ended
    selectedSkill: null,
    message: '',
    showMessage: false,
    messageTimer: 0,
    expGained: 0
};

// 玩家状态
let playerState = {
    items: {
        captureToken: 5 // 招降令数量
    }
};

// 已击败或捕获的唯一武将
const defeatedOrCapturedGenerals = [];

// 玩家对象
const player = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    size: PLAYER_SIZE,
    color: '#FF6B6B',
    moving: false
};

// 初始化地图
function initMaps() {
    // 创建幽州地图（30x30，冰属性）
    const youzhouMap = generateMapData(30, 30, REGIONS.YOUZHOU.id, DANGER_ZONE.YOUZHOU);
    MapManager.registerMap('youzhou', youzhouMap, {
        width: 30,
        height: 30,
        name: '幽州',
        attribute: '冰属性',
        exits: {
            south: { mapId: 'jizhou', entryPoint: 'top' }
        }
    });
    
    // 创建冀州地图（40x40，平原属性）
    const jizhouMap = generateMapData(40, 40, REGIONS.JIZHOU.id, DANGER_ZONE.JIZHOU);
    MapManager.registerMap('jizhou', jizhouMap, {
        width: 40,
        height: 40,
        name: '冀州',
        attribute: '平原属性',
        exits: {
            north: { mapId: 'youzhou', entryPoint: 'bottom' }
        }
    });
    
    // 加载初始地图（幽州）
    MapManager.loadMap('youzhou');
}

// 地图切换效果
let mapTransition = {
    active: false,
    fadeAlpha: 0,
    fadeDirection: 'out', // 'out' 或 'in'
    targetMap: null,
    entryPoint: null
};

function startMapTransition(targetMapId, entryPoint) {
    mapTransition.active = true;
    mapTransition.fadeAlpha = 0;
    mapTransition.fadeDirection = 'out';
    mapTransition.targetMap = targetMapId;
    mapTransition.entryPoint = entryPoint;
}

function updateMapTransition() {
    if (!mapTransition.active) return;
    
    if (mapTransition.fadeDirection === 'out') {
        mapTransition.fadeAlpha += 0.05;
        if (mapTransition.fadeAlpha >= 1) {
            mapTransition.fadeAlpha = 1;
            // 切换地图
            MapManager.loadMap(mapTransition.targetMap, mapTransition.entryPoint);
            mapTransition.fadeDirection = 'in';
        }
    } else {
        mapTransition.fadeAlpha -= 0.05;
        if (mapTransition.fadeAlpha <= 0) {
            mapTransition.fadeAlpha = 0;
            mapTransition.active = false;
        }
    }
}

function drawMapTransition() {
    if (mapTransition.active && mapTransition.fadeAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${mapTransition.fadeAlpha})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
}

// 键盘状态
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    up: false,
    left: false,
    down: false,
    right: false
};

// 初始化Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 键盘事件监听
document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w':
            keys.w = true;
            break;
        case 'a':
            keys.a = true;
            break;
        case 's':
            keys.s = true;
            break;
        case 'd':
            keys.d = true;
            break;
        case 'arrowup':
            keys.up = true;
            break;
        case 'arrowleft':
            keys.left = true;
            break;
        case 'arrowdown':
            keys.down = true;
            break;
        case 'arrowright':
            keys.right = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w':
            keys.w = false;
            break;
        case 'a':
            keys.a = false;
            break;
        case 's':
            keys.s = false;
            break;
        case 'd':
            keys.d = false;
            break;
        case 'arrowup':
            keys.up = false;
            break;
        case 'arrowleft':
            keys.left = false;
            break;
        case 'arrowdown':
            keys.down = false;
            break;
        case 'arrowright':
            keys.right = false;
            break;
    }
});

// 绘制地图
function drawMap() {
    const currentMap = MapManager.getCurrentMapData();
    if (!currentMap) return;
    
    // 计算可见的地图范围
    const startX = Math.max(0, Math.floor(-camera.x / GRID_SIZE));
    const endX = Math.min(currentMap[0].length, Math.ceil((-camera.x + GAME_WIDTH) / GRID_SIZE) + 1);
    const startY = Math.max(0, Math.floor(-camera.y / GRID_SIZE));
    const endY = Math.min(currentMap.length, Math.ceil((-camera.y + GAME_HEIGHT) / GRID_SIZE) + 1);
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const tileId = currentMap[y][x];
            let tileColor = '#FFFFFF';
            
            // 根据领地类型设置颜色
            if (tileId === REGIONS.JINGZHOU.id) {
                tileColor = REGIONS.JINGZHOU.color;
            } else if (tileId === REGIONS.YIZHOU.id) {
                tileColor = REGIONS.YIZHOU.color;
            } else if (tileId === REGIONS.XILIANG.id) {
                tileColor = REGIONS.XILIANG.color;
            } else if (tileId === REGIONS.YOUZHOU.id) {
                tileColor = REGIONS.YOUZHOU.color;
            } else if (tileId === REGIONS.JIZHOU.id) {
                tileColor = REGIONS.JIZHOU.color;
            } else if (tileId === REGIONS.OBSTACLE.id) {
                tileColor = REGIONS.OBSTACLE.color;
            } else if (tileId === DANGER_ZONE.JINGZHOU) {
                tileColor = '#8BC34A'; // 荆州危险区域（浅绿色）
            } else if (tileId === DANGER_ZONE.YIZHOU) {
                tileColor = '#4CAF50'; // 益州危险区域（深绿色）
            } else if (tileId === DANGER_ZONE.XILIANG) {
                tileColor = '#FFA000'; // 西凉危险区域（橙黄色）
            } else if (tileId === DANGER_ZONE.YOUZHOU) {
                tileColor = '#87CEEB'; // 幽州危险区域（天蓝色）
            } else if (tileId === DANGER_ZONE.JIZHOU) {
                tileColor = '#DEB887'; // 冀州危险区域（棕褐色）
            }
            
            // 绘制地砖（添加摄像机偏移）
            ctx.fillStyle = tileColor;
            ctx.fillRect(x * GRID_SIZE + camera.x, y * GRID_SIZE + camera.y, GRID_SIZE, GRID_SIZE);
            
            // 绘制网格线
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.strokeRect(x * GRID_SIZE + camera.x, y * GRID_SIZE + camera.y, GRID_SIZE, GRID_SIZE);
        }
    }
}

// 检查是否在危险区域
function checkDangerZone() {
    const currentMap = MapManager.getCurrentMapData();
    if (!currentMap) return false;
    
    const playerGridX = Math.floor(player.x / GRID_SIZE);
    const playerGridY = Math.floor(player.y / GRID_SIZE);
    
    if (playerGridY >= 0 && playerGridY < currentMap.length && 
        playerGridX >= 0 && playerGridX < currentMap[playerGridY].length) {
        const tileId = currentMap[playerGridY][playerGridX];
        return tileId === DANGER_ZONE.JINGZHOU || 
               tileId === DANGER_ZONE.YIZHOU || 
               tileId === DANGER_ZONE.XILIANG ||
               tileId === DANGER_ZONE.YOUZHOU ||
               tileId === DANGER_ZONE.JIZHOU;
    }
    return false;
}

// 检查遇敌
function checkEncounter() {
    // 检查冷却时间
    if (gameState.encounterCooldown > 0) {
        return;
    }
    
    if (checkDangerZone() && Math.random() < 0.1) { // 10% 概率遇敌
        triggerBattle();
        // 设置冷却时间为3秒（180帧，假设60fps）
        gameState.encounterCooldown = 180;
    }
}

// 触发战斗
function triggerBattle() {
    const currentMap = MapManager.getCurrentMapData();
    if (!currentMap) return;
    
    const playerGridX = Math.floor(player.x / GRID_SIZE);
    const playerGridY = Math.floor(player.y / GRID_SIZE);
    
    // 确保玩家在地图范围内
    if (playerGridY < 0 || playerGridY >= currentMap.length || 
        playerGridX < 0 || playerGridX >= currentMap[playerGridY].length) {
        return;
    }
    
    const tileId = currentMap[playerGridY][playerGridX];
    let wildGeneral = null;
    
    // 根据领地类型选择敌人
    let availableGenerals = [];
    if (tileId === DANGER_ZONE.JINGZHOU) {
        // 荆州 - 水系敌人
        availableGenerals = [
            new General('蔡瑁', '水', 6, 90, 20, 18, 15, [new Skill('水箭', '水', 15), new Skill('水盾', '水', 10), new Skill('洪水', '水', 20)], true),
            new General('甘宁', '水', 7, 95, 22, 16, 25, [new Skill('水刃', '水', 17), new Skill('潜水', '水', 12), new Skill('水龙卷', '水', 22)], true)
        ];
    } else if (tileId === DANGER_ZONE.YIZHOU) {
        // 益州 - 木系敌人
        availableGenerals = [
            new General('张任', '木', 7, 85, 23, 17, 20, [new Skill('毒箭', '木', 16), new Skill('荆棘阵', '木', 14), new Skill('万箭齐发', '木', 21)], true),
            new General('严颜', '木', 8, 105, 25, 20, 15, [new Skill('木锤', '木', 18), new Skill('藤曼缠绕', '木', 12), new Skill('森林之力', '木', 23)], true)
        ];
    } else if (tileId === DANGER_ZONE.XILIANG) {
        // 西凉 - 岩石系敌人
        availableGenerals = [
            new General('马岱', '岩石', 6, 95, 21, 22, 18, [new Skill('岩石击', '岩石', 16), new Skill('沙暴', '岩石', 14), new Skill('地裂', '岩石', 20)], true),
            new General('韩遂', '岩石', 7, 100, 24, 23, 16, [new Skill('沙刃', '岩石', 17), new Skill('岩石壁垒', '岩石', 12), new Skill('沙尘暴', '岩石', 22)], true)
        ];
    } else if (tileId === DANGER_ZONE.YOUZHOU) {
        // 幽州 - 冰系敌人
        availableGenerals = [
            new General('蔡瑁', '水', 6, 90, 20, 18, 15, [new Skill('水箭', '水', 15), new Skill('水盾', '水', 10), new Skill('洪水', '水', 20)], true),
            new General('甘宁', '水', 7, 95, 22, 16, 25, [new Skill('水刃', '水', 17), new Skill('潜水', '水', 12), new Skill('水龙卷', '水', 22)], true)
        ];
    } else if (tileId === DANGER_ZONE.JIZHOU) {
        // 冀州 - 平原系敌人
        availableGenerals = [
            new General('张任', '木', 7, 85, 23, 17, 20, [new Skill('毒箭', '木', 16), new Skill('荆棘阵', '木', 14), new Skill('万箭齐发', '木', 21)], true),
            new General('严颜', '木', 8, 105, 25, 20, 15, [new Skill('木锤', '木', 18), new Skill('藤曼缠绕', '木', 12), new Skill('森林之力', '木', 23)], true)
        ];
    }
    
    // 过滤掉已经击败或捕获的唯一武将
    const filteredGenerals = availableGenerals.filter(general => 
        !general.isUnique || !defeatedOrCapturedGenerals.includes(general.name)
    );
    
    // 如果没有可用的武将，添加普通小兵
    if (filteredGenerals.length === 0) {
        filteredGenerals.push(GeneralDatabase.HUANG_JIN);
    }
    
    // 随机选择一个武将
    if (filteredGenerals.length > 0) {
        wildGeneral = filteredGenerals[Math.floor(Math.random() * filteredGenerals.length)];
    }
    
    if (wildGeneral) {
        // 停止玩家移动
        player.moving = false;
        player.targetX = player.x;
        player.targetY = player.y;
        
        // 清空所有按键记录
        for (let key in keys) {
            keys[key] = false;
        }
        
        // 设置战斗状态
        gameState.currentState = 'battle';
        battleState.wildGeneral = wildGeneral;
        battleState.playerGeneral = playerGenerals[0]; // 使用第一个武将
        battleState.currentPhase = 'menu';
        battleState.message = `遭遇野生的 ${wildGeneral.name}！`;
        battleState.showMessage = true;
        battleState.messageTimer = 2000;
        battleState.expGained = 0;
        
        // 显示遇敌提示
        alert(`遭遇野生的 ${wildGeneral.name}！`);
    }
}

// 绘制菜单界面
function drawMenu() {
    // 绘制背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 绘制菜单标题
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏菜单', 400, 50);
    
    if (gameState.menuState === 'main') {
        drawMainMenu();
    } else if (gameState.menuState === 'team') {
        drawTeamMenu();
    } else if (gameState.menuState === 'bag') {
        drawBagMenu();
    }
}

// 绘制主菜单
function drawMainMenu() {
    const menuOptions = ['我的队伍', '背包', '返回游戏'];
    
    for (let i = 0; i < menuOptions.length; i++) {
        const y = 150 + i * 80;
        ctx.fillStyle = '#34495e';
        ctx.fillRect(200, y, 400, 60);
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(menuOptions[i], 400, y + 40);
    }
}

// 绘制队伍菜单
function drawTeamMenu() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(100, 100, 600, 400);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    
    // 绘制返回按钮
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(100, 520, 100, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('返回', 150, 545);
    
    // 绘制武将信息
    ctx.textAlign = 'left';
    for (let i = 0; i < playerGenerals.length; i++) {
        const general = playerGenerals[i];
        const y = 120 + i * 80;
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText(`${i + 1}. ${general.name} Lv.${general.level}`, 120, y);
        ctx.fillText(`属性: ${general.attribute}`, 120, y + 20);
        ctx.fillText(`HP: ${general.currentHP}/${general.maxHP}`, 120, y + 40);
        ctx.fillText(`攻击: ${general.attack} 防御: ${general.defense} 速度: ${general.speed}`, 120, y + 60);
        ctx.fillText(`经验: ${general.exp}/${general.expToNextLevel}`, 350, y + 40);
    }
}

// 绘制背包菜单
function drawBagMenu() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(100, 100, 600, 400);
    
    // 绘制返回按钮
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(100, 520, 100, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('返回', 150, 545);
    
    // 绘制物品信息
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('背包物品', 120, 130);
    
    ctx.font = '16px Arial';
    ctx.fillText(`招降令: ${playerState.items.captureToken}`, 120, 180);
}

// 处理菜单点击
function handleMenuClick(event) {
    if (gameState.currentState !== 'menu') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (gameState.menuState === 'main') {
        // 主菜单点击
        if (x >= 200 && x <= 600) {
            if (y >= 150 && y <= 210) {
                // 我的队伍
                gameState.menuState = 'team';
            } else if (y >= 230 && y <= 290) {
                // 背包
                gameState.menuState = 'bag';
            } else if (y >= 310 && y <= 370) {
                // 返回游戏
                gameState.currentState = 'map';
            }
        }
    } else if (gameState.menuState === 'team' || gameState.menuState === 'bag') {
        // 返回按钮
        if (x >= 100 && x <= 200 && y >= 520 && y <= 560) {
            gameState.menuState = 'main';
        }
    }
}

// 处理键盘事件
function handleKeyPress(event) {
    if (event.key === 'Enter' || event.key === 'Escape') {
        if (gameState.currentState === 'map') {
            // 从地图进入菜单
            gameState.currentState = 'menu';
            gameState.menuState = 'main';
        } else if (gameState.currentState === 'menu') {
            // 从菜单返回地图
            gameState.currentState = 'map';
        } else if (gameState.currentState === 'battle') {
            // 在战斗中按ESC撤退
            if (event.key === 'Escape') {
                endBattle();
            }
        }
    }
}

// 添加键盘事件监听
document.addEventListener('keydown', handleKeyPress);

// 修改鼠标点击事件监听
canvas.addEventListener('click', function(event) {
    if (gameState.currentState === 'battle') {
        handleMouseClick(event);
    } else if (gameState.currentState === 'menu') {
        handleMenuClick(event);
    }
});

// 绘制战斗场景
function drawBattleScene() {
    // 绘制背景
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 绘制己方武将
    drawPlayerGeneral();
    
    // 绘制敌方武将
    drawWildGeneral();
    
    // 绘制消息
    if (battleState.showMessage) {
        drawMessage();
    }
    
    // 绘制菜单
    if (battleState.currentPhase === 'menu') {
        drawBattleMenu();
    } else if (battleState.currentPhase === 'skillSelect') {
        drawSkillSelectMenu();
    }
}

// 绘制己方武将
function drawPlayerGeneral() {
    const general = battleState.playerGeneral;
    if (!general) return;
    
    // 绘制武将信息
    ctx.fillStyle = '#3498db';
    ctx.fillRect(50, 400, 300, 150);
    
    // 绘制武将名称和等级
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText(`${general.name} Lv.${general.level}`, 70, 430);
    
    // 绘制HP条
    const hpPercent = general.currentHP / general.maxHP;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(70, 460, 260 * hpPercent, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 460, 260, 20);
    
    // 绘制HP数值
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`${general.currentHP}/${general.maxHP} HP`, 70, 495);
    
    // 绘制属性
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`属性: ${general.attribute}`, 70, 525);
}

// 绘制敌方武将
function drawWildGeneral() {
    const general = battleState.wildGeneral;
    if (!general) return;
    
    // 绘制武将信息
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(450, 50, 300, 150);
    
    // 绘制武将名称和等级
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText(`野生的 ${general.name} Lv.${general.level}`, 470, 80);
    
    // 绘制HP条
    const hpPercent = general.currentHP / general.maxHP;
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(470, 110, 260 * hpPercent, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(470, 110, 260, 20);
    
    // 绘制HP数值
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`${general.currentHP}/${general.maxHP} HP`, 470, 145);
    
    // 绘制属性
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`属性: ${general.attribute}`, 470, 175);
}

// 绘制消息
function drawMessage() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(50, 250, 700, 100);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(battleState.message, 400, 300);
    ctx.textAlign = 'left';
}

// 绘制战斗菜单
function drawBattleMenu() {
    const menuOptions = ['攻击', '道具', '招降', '撤退'];
    
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 550, GAME_WIDTH, 50);
    
    for (let i = 0; i < menuOptions.length; i++) {
        const x = i * (GAME_WIDTH / 4);
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x, 550, GAME_WIDTH / 4, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(menuOptions[i], x + GAME_WIDTH / 8, 580);
    }
    ctx.textAlign = 'left';
}

// 绘制技能选择菜单
function drawSkillSelectMenu() {
    const general = battleState.playerGeneral;
    if (!general) return;
    
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 550, GAME_WIDTH, 50);
    
    for (let i = 0; i < general.skills.length; i++) {
        const skill = general.skills[i];
        const x = i * (GAME_WIDTH / general.skills.length);
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x, 550, GAME_WIDTH / general.skills.length, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${skill.name} (${skill.attribute})`, x + GAME_WIDTH / (general.skills.length * 2), 575);
    }
    ctx.textAlign = 'left';
}

// 处理战斗逻辑
function handleBattleLogic() {
    if (battleState.currentPhase === 'battle') {
        // 战斗逻辑
        const playerGeneral = battleState.playerGeneral;
        const wildGeneral = battleState.wildGeneral;
        
        if (!playerGeneral || !wildGeneral) return;
        
        // 根据速度决定谁先出手
        let firstAttacker, secondAttacker;
        if (playerGeneral.speed >= wildGeneral.speed) {
            firstAttacker = playerGeneral;
            secondAttacker = wildGeneral;
        } else {
            firstAttacker = wildGeneral;
            secondAttacker = playerGeneral;
        }
        
        // 第一回合攻击
        let attackResult;
        if (firstAttacker === playerGeneral && battleState.selectedSkill) {
            attackResult = playerGeneral.attackTarget(wildGeneral, battleState.selectedSkill);
        } else if (firstAttacker === wildGeneral) {
            // 野生武将随机选择技能
            const randomSkill = Math.floor(Math.random() * wildGeneral.skills.length);
            attackResult = wildGeneral.attackTarget(playerGeneral, randomSkill);
        }
        
        if (attackResult) {
            battleState.message = attackResult.message;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
        }
        
        // 检查战斗是否结束
        if (!wildGeneral.isAlive()) {
            battleState.message = `野生的 ${wildGeneral.name} 被击败了！`;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
            battleState.currentPhase = 'ended';
            setTimeout(() => {
                endBattle();
            }, 2000);
            return;
        }
        
        if (!playerGeneral.isAlive()) {
            battleState.message = `${playerGeneral.name} 被击败了！`;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
            battleState.currentPhase = 'ended';
            setTimeout(() => {
                endBattle();
            }, 2000);
            return;
        }
        
        // 第二回合攻击
        if (secondAttacker === playerGeneral && battleState.selectedSkill) {
            attackResult = playerGeneral.attackTarget(wildGeneral, battleState.selectedSkill);
        } else if (secondAttacker === wildGeneral) {
            // 野生武将随机选择技能
            const randomSkill = Math.floor(Math.random() * wildGeneral.skills.length);
            attackResult = wildGeneral.attackTarget(playerGeneral, randomSkill);
        }
        
        if (attackResult) {
            battleState.message = attackResult.message;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
        }
        
        // 检查战斗是否结束
        if (!wildGeneral.isAlive()) {
            battleState.message = `野生的 ${wildGeneral.name} 被击败了！`;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
            battleState.currentPhase = 'ended';
            setTimeout(() => {
                endBattle();
            }, 2000);
            return;
        }
        
        if (!playerGeneral.isAlive()) {
            battleState.message = `${playerGeneral.name} 被击败了！`;
            battleState.showMessage = true;
            battleState.messageTimer = 2000;
            battleState.currentPhase = 'ended';
            setTimeout(() => {
                endBattle();
            }, 2000);
            return;
        }
        
        // 战斗结束，返回菜单
        battleState.currentPhase = 'menu';
        battleState.selectedSkill = null;
    }
}

// 处理战斗菜单选择
function handleBattleMenuSelect(option) {
    switch(option) {
        case 'attack':
            battleState.currentPhase = 'skillSelect';
            break;
        case 'items':
            battleState.message = '道具系统暂未实现';
            battleState.showMessage = true;
            battleState.messageTimer = 1000;
            break;
        case 'capture':
            handleCapture();
            break;
        case 'retreat':
            endBattle();
            break;
    }
}

// 处理技能选择
function handleSkillSelect(skillIndex) {
    battleState.selectedSkill = skillIndex;
    battleState.currentPhase = 'battle';
}

// 处理招降
function handleCapture() {
    const wildGeneral = battleState.wildGeneral;
    if (!wildGeneral) return;
    
    if (playerState.items.captureToken <= 0) {
        battleState.message = '招降令不足！';
        battleState.showMessage = true;
        battleState.messageTimer = 1000;
        return;
    }
    
    // 计算捕获成功率
    const hpPercent = wildGeneral.currentHP / wildGeneral.maxHP;
    let captureRate = (1 - hpPercent) * 0.8; // 基础成功率
    
    // 生成随机数
    const random = Math.random();
    
    if (random < captureRate) {
        // 捕获成功
        playerState.items.captureToken--;
        playerGenerals.push(wildGeneral);
        battleState.message = `成功招降了野生的 ${wildGeneral.name}！`;
        battleState.showMessage = true;
        battleState.messageTimer = 2000;
        
        // 记录捕获的唯一武将
        if (wildGeneral.isUnique && !defeatedOrCapturedGenerals.includes(wildGeneral.name)) {
            defeatedOrCapturedGenerals.push(wildGeneral.name);
        }
        
        battleState.currentPhase = 'ended';
        setTimeout(() => {
            endBattle();
        }, 2000);
    } else {
        // 捕获失败
        playerState.items.captureToken--;
        battleState.message = `招降失败！野生的 ${wildGeneral.name} 逃脱了！`;
        battleState.showMessage = true;
        battleState.messageTimer = 2000;
        battleState.currentPhase = 'menu';
    }
}

// 结束战斗
function endBattle() {
    // 计算经验值奖励
    if (battleState.playerGeneral && battleState.wildGeneral && !battleState.wildGeneral.isAlive()) {
        // 战斗胜利，获得经验值
        const expReward = battleState.wildGeneral.level * 50;
        const leveledUp = battleState.playerGeneral.gainExp(expReward);
        
        if (leveledUp) {
            alert(`${battleState.playerGeneral.name} 升级了！`);
        }
        
        // 记录击败的唯一武将
        if (battleState.wildGeneral.isUnique && !defeatedOrCapturedGenerals.includes(battleState.wildGeneral.name)) {
            defeatedOrCapturedGenerals.push(battleState.wildGeneral.name);
        }
    }
    
    // 重置战斗状态
    gameState.currentState = 'map';
    battleState.wildGeneral = null;
    battleState.playerGeneral = null;
    battleState.currentPhase = 'menu';
    battleState.selectedSkill = null;
    battleState.message = '';
    battleState.showMessage = false;
    battleState.messageTimer = 0;
    battleState.expGained = 0;
    
    // 清空所有按键记录
    for (let key in keys) {
        keys[key] = false;
    }
    
    // 设置遇敌冷却时间，确保战斗结束后不会立即再次触发战斗
    gameState.encounterCooldown = 180; // 3秒冷却
}

// 处理鼠标点击
function handleMouseClick(event) {
    if (gameState.currentState !== 'battle') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (y >= 550) {
        if (battleState.currentPhase === 'menu') {
            const optionWidth = GAME_WIDTH / 4;
            const option = Math.floor(x / optionWidth);
            switch(option) {
                case 0:
                    handleBattleMenuSelect('attack');
                    break;
                case 1:
                    handleBattleMenuSelect('items');
                    break;
                case 2:
                    handleBattleMenuSelect('capture');
                    break;
                case 3:
                    handleBattleMenuSelect('retreat');
                    break;
            }
        } else if (battleState.currentPhase === 'skillSelect') {
            const general = battleState.playerGeneral;
            if (general) {
                const skillWidth = GAME_WIDTH / general.skills.length;
                const skillIndex = Math.floor(x / skillWidth);
                if (skillIndex >= 0 && skillIndex < general.skills.length) {
                    handleSkillSelect(skillIndex);
                }
            }
        }
    }
}



// 更新区域信息
function updateRegionInfo() {
    if (gameState.currentState === 'battle') {
        // 战斗状态下显示战斗信息
        if (battleState.wildGeneral) {
            document.getElementById('region-info').textContent = `战斗中：野生的 ${battleState.wildGeneral.name} (${battleState.wildGeneral.attribute})`;
        } else {
            document.getElementById('region-info').textContent = '战斗中';
        }
        return;
    }
    
    if (gameState.currentState === 'menu') {
        // 菜单状态下显示菜单信息
        document.getElementById('region-info').textContent = '游戏菜单';
        return;
    }
    
    // 显示当前地图信息
    const mapInfo = MapManager.getCurrentMapInfo();
    if (mapInfo) {
        document.getElementById('region-info').textContent = `当前位置：${mapInfo.name} (${mapInfo.attribute})`;
    }
}

// 游戏循环
function gameLoop() {
    // 清空画布
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    switch(gameState.currentState) {
        case 'map':
            // 检查地图切换
            if (!mapTransition.active) {
                const transition = MapManager.checkMapTransition();
                if (transition) {
                    startMapTransition(transition.targetMap.mapId, transition.targetMap.entryPoint);
                }
            }
            
            // 更新摄像机位置
            updateCamera();
            
            // 绘制地图
            drawMap();
            
            // 处理玩家移动
            handlePlayerMovement();
            
            // 绘制玩家
            drawPlayer();
            
            // 更新区域信息
            updateRegionInfo();
            
            // 更新遇敌冷却时间
            if (gameState.encounterCooldown > 0) {
                gameState.encounterCooldown--;
            }
            
            // 检查遇敌
            checkEncounter();
            
            // 更新和绘制地图切换效果
            updateMapTransition();
            drawMapTransition();
            break;
        
        case 'battle':
            // 绘制战斗场景
            drawBattleScene();
            
            // 处理战斗逻辑
            handleBattleLogic();
            
            // 更新消息计时器
            if (battleState.showMessage && battleState.messageTimer > 0) {
                battleState.messageTimer -= 16; // 假设60fps
                if (battleState.messageTimer <= 0) {
                    battleState.showMessage = false;
                }
            }
            break;
        
        case 'menu':
            // 绘制菜单
            drawMenu();
            break;
    }
    
    // 循环调用
    requestAnimationFrame(gameLoop);
}

// 更新摄像机位置
function updateCamera() {
    const mapInfo = MapManager.getCurrentMapInfo();
    if (!mapInfo) return;
    
    // 计算摄像机目标位置，使玩家位于屏幕中央
    let targetCameraX = GAME_WIDTH / 2 - player.x - player.size / 2;
    let targetCameraY = GAME_HEIGHT / 2 - player.y - player.size / 2;
    
    // 计算地图边界
    const mapWidthPixels = mapInfo.width * GRID_SIZE;
    const mapHeightPixels = mapInfo.height * GRID_SIZE;
    
    // 限制摄像机位置，防止看到地图外的黑边
    targetCameraX = Math.max(targetCameraX, GAME_WIDTH - mapWidthPixels);
    targetCameraX = Math.min(targetCameraX, 0);
    targetCameraY = Math.max(targetCameraY, GAME_HEIGHT - mapHeightPixels);
    targetCameraY = Math.min(targetCameraY, 0);
    
    // 平滑过渡
    camera.x += (targetCameraX - camera.x) * 0.1;
    camera.y += (targetCameraY - camera.y) * 0.1;
}

// 处理玩家移动
function handlePlayerMovement() {
    const currentMap = MapManager.getCurrentMapData();
    const mapInfo = MapManager.getCurrentMapInfo();
    if (!currentMap || !mapInfo) return;
    
    if (!player.moving) {
        let newTargetX = player.targetX;
        let newTargetY = player.targetY;
        
        // 检查键盘输入
        if (keys.w || keys.up) {
            newTargetY -= GRID_SIZE;
        } else if (keys.s || keys.down) {
            newTargetY += GRID_SIZE;
        } else if (keys.a || keys.left) {
            newTargetX -= GRID_SIZE;
        } else if (keys.d || keys.right) {
            newTargetX += GRID_SIZE;
        }
        
        // 计算地图边界（允许玩家走到地图边缘外一格以触发切换）
        const mapWidthPixels = mapInfo.width * GRID_SIZE;
        const mapHeightPixels = mapInfo.height * GRID_SIZE;
        
        // 检查是否在地图范围内（包括边缘外一格）
        if (newTargetX >= -GRID_SIZE && newTargetX + player.size <= mapWidthPixels + GRID_SIZE &&
            newTargetY >= -GRID_SIZE && newTargetY + player.size <= mapHeightPixels + GRID_SIZE) {
            
            // 碰撞检测（障碍物）- 只在地图范围内检查
            const targetGridX = Math.floor(newTargetX / GRID_SIZE);
            const targetGridY = Math.floor(newTargetY / GRID_SIZE);
            
            if (targetGridY >= 0 && targetGridY < currentMap.length && 
                targetGridX >= 0 && targetGridX < currentMap[targetGridY].length) {
                const targetTileId = currentMap[targetGridY][targetGridX];
                
                // 检查是否是障碍物
                if (targetTileId !== REGIONS.OBSTACLE.id) {
                    player.targetX = newTargetX;
                    player.targetY = newTargetY;
                    player.moving = true;
                }
            } else {
                // 在地图边缘外，允许移动以触发地图切换
                player.targetX = newTargetX;
                player.targetY = newTargetY;
                player.moving = true;
            }
        }
    }
    
    // 移动动画过渡
    if (player.moving) {
        let dx = player.targetX - player.x;
        let dy = player.targetY - player.y;
        
        if (Math.abs(dx) < MOVE_SPEED && Math.abs(dy) < MOVE_SPEED) {
            player.x = player.targetX;
            player.y = player.targetY;
            player.moving = false;
        } else {
            if (dx !== 0) {
                player.x += dx > 0 ? MOVE_SPEED : -MOVE_SPEED;
            }
            if (dy !== 0) {
                player.y += dy > 0 ? MOVE_SPEED : -MOVE_SPEED;
            }
        }
    }
}

// 绘制玩家
function drawPlayer() {
    // 玩家始终显示在屏幕中央
    const screenX = GAME_WIDTH / 2 - player.size / 2;
    const screenY = GAME_HEIGHT / 2 - player.size / 2;
    
    ctx.fillStyle = player.color;
    ctx.fillRect(screenX, screenY, player.size, player.size);
    
    // 绘制玩家名称
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('刘备', screenX + player.size / 2, screenY - 5);
}

// 绘制网格（可选）
function drawGrid() {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    // 绘制垂直线
    for (let x = 0; x <= GAME_WIDTH; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = 0; y <= GAME_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
        ctx.stroke();
    }
}

// 技能类
class Skill {
    constructor(name, attribute, baseDamage) {
        this.name = name;
        this.attribute = attribute;
        this.baseDamage = baseDamage;
    }
}

// 武将类
class General {
    constructor(name, attribute, level, maxHP, attack, defense, speed, skills, isUnique = false) {
        this.name = name;
        this.attribute = attribute;
        this.level = level;
        this.exp = 0;
        this.expToNextLevel = level * 100;
        this.maxHP = maxHP;
        this.currentHP = maxHP;
        this.attack = attack;
        this.defense = defense;
        this.speed = speed;
        this.skills = skills;
        this.isUnique = isUnique;
    }
    
    // 获得经验值
    gainExp(amount) {
        this.exp += amount;
        let leveledUp = false;
        
        // 检查是否升级
        while (this.exp >= this.expToNextLevel) {
            this.levelUp();
            leveledUp = true;
        }
        
        return leveledUp;
    }
    
    // 升级
    levelUp() {
        this.level++;
        this.exp -= this.expToNextLevel;
        this.expToNextLevel = this.level * 100;
        
        // 属性提升
        this.maxHP += Math.floor(this.maxHP * 0.1) + 5;
        this.currentHP = this.maxHP;
        this.attack += Math.floor(this.attack * 0.1) + 2;
        this.defense += Math.floor(this.defense * 0.1) + 1;
        this.speed += Math.floor(this.speed * 0.1) + 1;
        
        console.log(`${this.name} 升级到 Lv.${this.level}！`);
    }
    
    // 攻击方法
    attackTarget(target, skillIndex) {
        if (skillIndex < 0 || skillIndex >= this.skills.length) {
            return { success: false, message: '无效的技能索引' };
        }
        
        const skill = this.skills[skillIndex];
        
        // 计算属性克制
        let typeMultiplier = 1;
        if (TYPE_CHART[skill.attribute] && TYPE_CHART[skill.attribute][target.attribute]) {
            typeMultiplier = TYPE_CHART[skill.attribute][target.attribute];
        }
        
        // 计算伤害
        let damage = (skill.baseDamage + this.attack - target.defense / 2) * typeMultiplier;
        damage = Math.max(1, Math.floor(damage));
        
        target.currentHP = Math.max(0, target.currentHP - damage);
        
        // 生成消息
        let message = `${this.name} 使用了 ${skill.name}，`;
        if (typeMultiplier > 1) {
            message += `效果拔群！对 ${target.name} 造成了 ${damage} 点伤害！`;
        } else if (typeMultiplier < 1) {
            message += `效果不佳...对 ${target.name} 造成了 ${damage} 点伤害！`;
        } else {
            message += `对 ${target.name} 造成了 ${damage} 点伤害！`;
        }
        
        return {
            success: true,
            message: message,
            damage: damage,
            skill: skill
        };
    }
    
    // 恢复HP
    recoverHP(amount) {
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
        return this.currentHP;
    }
    
    // 检查是否存活
    isAlive() {
        return this.currentHP > 0;
    }
}

// 武将数据库
const GeneralDatabase = {
    // 初始精灵 - 赵云
    ZHAOYUN: new General(
        '赵云',
        '雷',
        5,
        80,
        25,
        15,
        30,
        [
            new Skill('龙胆枪', '雷', 15),
            new Skill('冲阵', '无', 10),
            new Skill('雷光一闪', '雷', 20)
        ],
        true // isUnique
    ),
    
    // 野生敌人 - 华雄
    HUA_XIONG: new General(
        '华雄',
        '火',
        8,
        100,
        30,
        20,
        15,
        [
            new Skill('烈火戟', '火', 18),
            new Skill('横扫', '无', 12),
            new Skill('火炎冲击', '火', 22)
        ],
        true // isUnique
    ),
    
    // 神兽级别 - 吕布
    LV_BU: new General(
        '吕布',
        '无',
        15,
        150,
        45,
        30,
        25,
        [
            new Skill('方天画戟', '无', 25),
            new Skill('天下无双', '无', 30),
            new Skill('赤兔冲锋', '无', 20),
            new Skill('鬼神降临', '无', 35)
        ],
        true // isUnique
    ),
    
    // 其他武将 - 关羽
    GUAN_YU: new General(
        '关羽',
        '火',
        10,
        120,
        35,
        25,
        20,
        [
            new Skill('青龙偃月刀', '火', 22),
            new Skill('拖刀计', '火', 25),
            new Skill('水淹七军', '水', 18)
        ],
        true // isUnique
    ),
    
    // 其他武将 - 诸葛亮
    ZHUGE_LIANG: new General(
        '诸葛亮',
        '木',
        12,
        90,
        20,
        15,
        35,
        [
            new Skill('奇门遁甲', '木', 15),
            new Skill('八卦阵', '木', 20),
            new Skill('东风', '风', 25),
            new Skill('草船借箭', '水', 18)
        ],
        true // isUnique
    ),
    
    // 荆州水系武将 - 蔡瑁
    CAI_MAO: new General(
        '蔡瑁',
        '水',
        6,
        90,
        20,
        18,
        15,
        [
            new Skill('水箭', '水', 15),
            new Skill('水盾', '水', 10),
            new Skill('洪水', '水', 20)
        ],
        true // isUnique
    ),
    
    // 荆州水系武将 - 甘宁
    GAN_NING: new General(
        '甘宁',
        '水',
        7,
        95,
        22,
        16,
        25,
        [
            new Skill('水刃', '水', 17),
            new Skill('潜水', '水', 12),
            new Skill('水龙卷', '水', 22)
        ],
        true // isUnique
    ),
    
    // 益州木系武将 - 张任
    ZHANG_REN: new General(
        '张任',
        '木',
        7,
        85,
        23,
        17,
        20,
        [
            new Skill('毒箭', '木', 16),
            new Skill('荆棘阵', '木', 14),
            new Skill('万箭齐发', '木', 21)
        ],
        true // isUnique
    ),
    
    // 益州木系武将 - 严颜
    YAN_YAN: new General(
        '严颜',
        '木',
        8,
        105,
        25,
        20,
        15,
        [
            new Skill('木锤', '木', 18),
            new Skill('藤曼缠绕', '木', 12),
            new Skill('森林之力', '木', 23)
        ],
        true // isUnique
    ),
    
    // 西凉岩石系武将 - 马岱
    MA_DAI: new General(
        '马岱',
        '岩石',
        6,
        95,
        21,
        22,
        18,
        [
            new Skill('岩石击', '岩石', 16),
            new Skill('沙暴', '岩石', 14),
            new Skill('地裂', '岩石', 20)
        ],
        true // isUnique
    ),
    
    // 西凉岩石系武将 - 韩遂
    HAN_SUI: new General(
        '韩遂',
        '岩石',
        7,
        100,
        24,
        23,
        16,
        [
            new Skill('沙刃', '岩石', 17),
            new Skill('岩石壁垒', '岩石', 12),
            new Skill('沙尘暴', '岩石', 22)
        ],
        true // isUnique
    ),
    
    // 普通小兵 - 黄巾军
    HUANG_JIN: new General(
        '黄巾军',
        '无',
        3,
        50,
        15,
        10,
        10,
        [
            new Skill('刀砍', '无', 10),
            new Skill('冲锋', '无', 8)
        ],
        false // isUnique
    )
};

// 玩家拥有的武将
const playerGenerals = [
    GeneralDatabase.ZHAOYUN
];

// 初始化地图
initMaps();

// 启动游戏
gameLoop();