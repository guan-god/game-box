// 形状等分切割游戏 - 核心代码

// 游戏状态
let gameState = {
    currentShape: [],
    isDrawing: false,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0, y: 0 },
    difficulty: 'easy',
    bestScore: 0,
    attempts: 0,
    canvasWidth: 600,
    canvasHeight: 400,
    currentFruit: ''
};

// 生成圆形的点
function generateCirclePoints(x, y, radius, segments = 32) {
    const points = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius
        ]);
    }
    return points;
}

// 生成椭圆形的点
function generateEllipsePoints(x, y, width, height, segments = 32) {
    const points = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([
            x + Math.cos(angle) * width,
            y + Math.sin(angle) * height
        ]);
    }
    return points;
}

// 生成半圆形的点
function generateSemicirclePoints(x, y, radius, segments = 16) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI;
        points.push([
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius
        ]);
    }
    // 添加底部直线
    points.push([x - radius, y]);
    return points;
}

// Perlin Noise算法实现
function perlinNoise(x, y, seed = 0) {
    // 简单的2D Perlin Noise实现
    const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = (permutation[X] + Y) & 255;
    const AA = (permutation[A]) & 255;
    const AB = (permutation[A + 1]) & 255;
    const B = (permutation[X + 1] + Y) & 255;
    const BA = (permutation[B]) & 255;
    const BB = (permutation[B + 1]) & 255;
    
    return lerp(v, lerp(u, grad(permutation[AA], x, y), grad(permutation[BA], x - 1, y)),
                   lerp(u, grad(permutation[AB], x, y - 1), grad(permutation[BB], x - 1, y - 1)));
}

// 检测线段是否相交
function doSegmentsIntersect(a1, a2, b1, b2) {
    function ccw(p1, p2, p3) {
        return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
    }
    
    return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

// 检测多边形是否自相交
function isSelfIntersecting(points) {
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const a1 = points[i];
        const a2 = points[(i + 1) % n];
        
        for (let j = i + 2; j < n - 1; j++) {
            const b1 = points[j];
            const b2 = points[(j + 1) % n];
            
            if (doSegmentsIntersect(a1, a2, b1, b2)) {
                return true;
            }
        }
    }
    return false;
}

// 极坐标顶点扰动算法 - 生成不规则形状
function generateIrregularShape(x, y, baseRadius, complexity = 5, segments = 16) {
    let points = [];
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        points = [];
        const angleStep = (Math.PI * 2) / segments;
        
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            // 使用Perlin Noise生成更自然的半径扰动
            const noiseX = Math.cos(angle) * 0.5 + 0.5;
            const noiseY = Math.sin(angle) * 0.5 + 0.5;
            const noiseValue = perlinNoise(noiseX * complexity, noiseY * complexity) * 0.5 + 0.5;
            const radius = baseRadius + (noiseValue - 0.5) * baseRadius * (complexity / 10);
            // 为角度添加微小扰动
            const angleNoise = perlinNoise(angle * 2, 0) * 0.05;
            const perturbedAngle = angle + angleNoise;
            
            points.push([
                x + Math.cos(perturbedAngle) * radius,
                y + Math.sin(perturbedAngle) * radius
            ]);
        }
        
        // 检查是否自相交
        if (!isSelfIntersecting(points)) {
            break;
        }
        
        attempts++;
    }
    
    // 如果多次尝试后仍然自相交，返回一个更简单的形状
    if (isSelfIntersecting(points)) {
        points = generateCirclePoints(x, y, baseRadius, segments);
    }
    
    return points;
}

// 随机点凸包算法 - 生成随机凸多边形
function generateConvexHullShape(x, y, radius, pointCount = 8) {
    const points = [];
    
    // 在圆形区域内随机生成点
    for (let i = 0; i < pointCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        points.push([
            x + Math.cos(angle) * r,
            y + Math.sin(angle) * r
        ]);
    }
    
    // 计算凸包
    return convexHull(points);
}

// 图形布尔运算（Union）- 生成具有凹陷特征的复杂不规则图形
function generateBooleanUnionShape(x, y, baseRadius, complexity = 5) {
    // 生成多个重叠的圆形或多边形
    const shapes = [];
    const shapeCount = 3 + Math.floor(complexity / 2);
    
    for (let i = 0; i < shapeCount; i++) {
        const offsetX = (Math.random() - 0.5) * baseRadius * 0.6;
        const offsetY = (Math.random() - 0.5) * baseRadius * 0.6;
        const shapeRadius = baseRadius * (0.5 + Math.random() * 0.5) * (1 - i * 0.1);
        
        if (Math.random() > 0.5) {
            // 生成圆形
            shapes.push(generateCirclePoints(x + offsetX, y + offsetY, shapeRadius, 16));
        } else {
            // 生成不规则多边形
            shapes.push(generateIrregularShape(x + offsetX, y + offsetY, shapeRadius, complexity, 8 + Math.floor(Math.random() * 8)));
        }
    }
    
    // 由于Canvas API的限制，我们使用一种简化的方法来模拟布尔运算
    // 这里返回一个特殊的对象，在绘制时使用全局复合操作
    return { type: 'boolean', shapes: shapes };
}

// 曲线平滑功能 - 使用贝塞尔曲线平滑顶点
function smoothShape(points, smoothness = 0.5) {
    if (points.length < 3) return points;
    
    const smoothed = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const prev = points[(i - 1 + n) % n];
        const curr = points[i];
        const next = points[(i + 1) % n];
        
        // 计算控制点
        const control1 = [
            curr[0] + (next[0] - prev[0]) * smoothness,
            curr[1] + (next[1] - prev[1]) * smoothness
        ];
        
        const control2 = [
            next[0] - (next[0] - curr[0]) * smoothness,
            next[1] - (next[1] - curr[1]) * smoothness
        ];
        
        // 添加当前点和控制点
        if (i === 0) {
            smoothed.push(curr);
        }
        smoothed.push(control1);
        smoothed.push(control2);
        
        if (i === n - 1) {
            smoothed.push(points[0]);
        }
    }
    
    return { type: 'smooth', points: smoothed };
}

// 凸包算法
function convexHull(points) {
    // 按x坐标排序，x相同则按y坐标排序
    points.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    
    // 构建下凸壳
    const lower = [];
    for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    
    // 构建上凸壳
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    
    // 合并下凸壳和上凸壳，去除重复点
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

// 计算叉积
function cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// 形状库 - 使用新的不规则形状生成算法
const shapeLibrary = {
    easy: [
        // 简单不规则形状
        { generate: () => generateIrregularShape(300, 200, 150, 5, 18), name: '石头', color: '#9e9e9e' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 120, 4, 16), 0.25), name: '云朵', color: '#e0e0e0' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 100, 5, 15), 0.22), name: '水滴', color: '#2196f3' },
        { generate: () => generateBooleanUnionShape(300, 200, 125, 5), name: '叶子', color: '#4caf50' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 130, 6, 20), 0.2), name: '贝壳', color: '#ffc107' }
    ],
    medium: [
        // 中等复杂度的不规则形状
        { generate: () => generateBooleanUnionShape(300, 200, 145, 7), name: '树干', color: '#795548' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 150, 8, 22), 0.18), name: '山峰', color: '#607d8b' },
        { generate: () => generateBooleanUnionShape(300, 200, 135, 7), name: '果实', color: '#ff5722' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 120, 9, 21), 0.16), name: '鱼', color: '#03a9f4' },
        { generate: () => generateBooleanUnionShape(300, 200, 145, 8), name: '花朵', color: '#e91e63' }
    ],
    hard: [
        // 高复杂度的不规则形状
        { generate: () => generateBooleanUnionShape(300, 200, 155, 10), name: '珊瑚', color: '#ff6b6b' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 160, 11, 28), 0.12), name: '岛屿', color: '#8bc34a' },
        { generate: () => generateBooleanUnionShape(300, 200, 145, 10), name: '岩石', color: '#6d4c41' },
        { generate: () => smoothShape(generateIrregularShape(300, 200, 130, 12, 26), 0.12), name: '彗星', color: '#9c27b0' },
        { generate: () => generateBooleanUnionShape(300, 200, 150, 11), name: '星云', color: '#3f51b5' }
    ]
};

// DOM 元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startModal = document.getElementById('startModal');

// 初始化游戏
function initGame() {
    // 显示开始模态框
    startModal.classList.add('show');
    
    // 绑定事件
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    // 绑定难度按钮
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            gameState.difficulty = this.dataset.difficulty;
            document.getElementById('currentDifficulty').textContent = this.textContent;
            generateShape();
        });
    });
    
    // 加载最佳成绩
    loadBestScore();
}

// 开始游戏
function startGame() {
    startModal.classList.remove('show');
    generateShape();
}

// 生成形状
function generateShape() {
    const shapes = shapeLibrary[gameState.difficulty];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    gameState.currentShape = randomShape.generate();
    gameState.currentFruit = randomShape.name;
    gameState.shapeColor = randomShape.color;
    gameState.isDrawing = false;
    gameState.startPoint = { x: 0, y: 0 };
    gameState.endPoint = { x: 0, y: 0 };
    gameState.shapeIrregularity = calculateIrregularity(getCuttablePolygon(gameState.currentShape));
    applyDynamicDifficulty(gameState.shapeIrregularity);
    
    updateStatus('准备就绪');
    resetResults();
    drawShape();
}

// 根据形状不规则度动态调整难度展示与得分倍率
function calculateIrregularity(points) {
    if (!points || points.length < 3) return 0.2;
    const area = polygonArea(points);
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    // 圆形最规整，值接近0；越不规则值越大
    const compactness = (4 * Math.PI * area) / (perimeter * perimeter || 1);
    return Math.max(0, Math.min(1, 1 - compactness));
}

function applyDynamicDifficulty(irregularity) {
    let level = '简单';
    if (irregularity > 0.45) level = '困难';
    else if (irregularity > 0.28) level = '中等';
    document.getElementById('currentDifficulty').textContent = `${level}（按不规则度）`;
}

// 重置游戏
function resetGame() {
    gameState.isDrawing = false;
    gameState.startPoint = { x: 0, y: 0 };
    gameState.endPoint = { x: 0, y: 0 };
    updateStatus('准备就绪');
    resetResults();
    drawShape();
}

// 处理鼠标按下
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    gameState.startPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    gameState.isDrawing = true;
    updateStatus('正在绘制切割线...');
}

// 处理鼠标移动
function handleMouseMove(e) {
    if (!gameState.isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    gameState.endPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    drawShape();
    drawCutLine();
}

// 处理鼠标释放
function handleMouseUp(e) {
    if (!gameState.isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    gameState.endPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    gameState.isDrawing = false;
    updateStatus('切割完成，计算面积...');
    
    // 计算面积
    calculateAreas();
    
    // 增加尝试次数
    gameState.attempts++;
    document.getElementById('attempts').textContent = gameState.attempts;
}

// 绘制形状
function drawShape() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 使用形状颜色
    const color = gameState.shapeColor || '#667eea';
    
    // 检查是否是布尔运算生成的形状
    if (gameState.currentShape.type === 'boolean') {
        // 使用全局复合操作绘制多个形状的并集
        ctx.save();
        ctx.globalCompositeOperation = 'union';
        
        for (const shape of gameState.currentShape.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape[0][0], shape[0][1]);
            
            for (let i = 1; i < shape.length; i++) {
                ctx.lineTo(shape[i][0], shape[i][1]);
            }
            
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        
        // 绘制边框
        ctx.globalCompositeOperation = 'source-over';
        for (const shape of gameState.currentShape.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape[0][0], shape[0][1]);
            
            for (let i = 1; i < shape.length; i++) {
                ctx.lineTo(shape[i][0], shape[i][1]);
            }
            
            ctx.closePath();
        }
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    } else if (gameState.currentShape.type === 'smooth') {
        // 绘制平滑曲线形状
        const points = gameState.currentShape.points;
        if (points.length >= 4) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            
            for (let i = 1; i < points.length - 2; i += 3) {
                ctx.bezierCurveTo(
                    points[i][0], points[i][1],
                    points[i + 1][0], points[i + 1][1],
                    points[i + 2][0], points[i + 2][1]
                );
            }
            
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            
            // 添加纹理效果
            addShapeTexture(color);
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } else if (gameState.currentShape.length >= 3) {
        // 绘制普通多边形
        ctx.beginPath();
        ctx.moveTo(gameState.currentShape[0][0], gameState.currentShape[0][1]);
        
        for (let i = 1; i < gameState.currentShape.length; i++) {
            ctx.lineTo(gameState.currentShape[i][0], gameState.currentShape[i][1]);
        }
        
        ctx.closePath();
        
        ctx.fillStyle = color;
        ctx.fill();
        
        // 添加纹理效果
        addShapeTexture(color);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // 绘制形状名称
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameState.currentFruit, canvas.width / 2, 30);
}

// 添加形状纹理
function addShapeTexture(color) {
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, 200
    );
    
    gradient.addColorStop(0, lightenColor(color, 20));
    gradient.addColorStop(1, darkenColor(color, 20));
    
    ctx.fillStyle = gradient;
    ctx.fill();
}

// 绘制切割线
function drawCutLine() {
    ctx.beginPath();
    ctx.moveTo(gameState.startPoint.x, gameState.startPoint.y);
    ctx.lineTo(gameState.endPoint.x, gameState.endPoint.y);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
}

// 计算面积 - 使用精确的切割算法
function calculateAreas() {
    const shape = getCuttablePolygon(gameState.currentShape);
    if (!shape || shape.length < 3) {
        updateStatus('当前形状无法切割，请换一个形状再试');
        return;
    }
    const line = extendCutLine(gameState.startPoint, gameState.endPoint);
    if (!line) {
        updateStatus('切割线太短，请拖动更长的切割线');
        return;
    }
    
    // 找到所有交点
    const intersections = [];
    
    for (let i = 0; i < shape.length; i++) {
        const p1 = { x: shape[i][0], y: shape[i][1] };
        const p2 = { x: shape[(i + 1) % shape.length][0], y: shape[(i + 1) % shape.length][1] };
        
        const intersection = lineIntersection(line.start, line.end, p1, p2);
        
        if (intersection) {
            const duplicate = intersections.some(it =>
                Math.hypot(it.point.x - intersection.x, it.point.y - intersection.y) < 0.6
            );
            if (duplicate) continue;
            intersections.push({
                point: intersection,
                edgeIndex: i,
                dist: Math.sqrt(
                    Math.pow(intersection.x - line.start.x, 2) + 
                    Math.pow(intersection.y - line.start.y, 2)
                )
            });
        }
    }
    
    // 如果没有找到两个交点，说明切割线没有贯穿形状
    if (intersections.length < 2) {
        updateStatus('切割线未贯穿形状，请重新绘制');
        return;
    }
    
    // 按距离排序，确保交点顺序正确
    intersections.sort((a, b) => a.dist - b.dist);
    
    // 取最远的两个交点（确保切割线贯穿形状）
    const entryPoint = intersections[0].point;
    const exitPoint = intersections[intersections.length - 1].point;
    
    // 分割多边形
    const polygons = splitPolygon(shape, entryPoint, exitPoint);
    
    if (!polygons || polygons.length !== 2) {
        updateStatus('切割失败，请重新绘制');
        return;
    }
    
    // 计算两个多边形的面积
    const area1 = polygonArea(polygons[0]);
    const area2 = polygonArea(polygons[1]);
    
    // 计算总面积和百分比
    const totalArea = area1 + area2;
    
    // 避免除零错误
    if (totalArea === 0) {
        updateStatus('计算错误，请重新切割');
        return;
    }
    
    const percent1 = (area1 / totalArea) * 100;
    const percent2 = (area2 / totalArea) * 100;
    
    // 计算误差
    const error = Math.abs(percent1 - percent2);
    
    // 计算得分
    let score = 0;
    if (error < 0.1) {
        score = 100;
    } else if (error < 5) {
        score = Math.floor(100 - error * 4);
    } else if (error < 10) {
        score = Math.floor(80 - (error - 5) * 4);
    } else {
        score = Math.max(0, Math.floor(60 - (error - 10) * 2));
    }
    const irregularityBonus = 1 + (gameState.shapeIrregularity || 0) * 0.45;
    score = Math.round(score * irregularityBonus);
    
    // 更新最佳成绩
    if (score > gameState.bestScore) {
        gameState.bestScore = score;
        document.getElementById('bestScore').textContent = gameState.bestScore;
        saveBestScore();
    }
    
    // 更新UI - 显示百分比
    document.getElementById('leftArea').textContent = percent1.toFixed(1) + '%';
    document.getElementById('rightArea').textContent = percent2.toFixed(1) + '%';
    document.getElementById('error').textContent = error.toFixed(1) + '%';
    document.getElementById('score').textContent = score;
    
    // 更新百分比图表
    updatePercentageChart(percent1, percent2);
    
    // 显示结果
    updateStatus(`切割完成！得分: ${score}`);
    
    // 绘制结果
    drawShape();
    drawCutLine();
    drawSplitPolygons(polygons);
}

// 将任意形状转换为可切割的多边形顶点
function getCuttablePolygon(shape) {
    if (!shape) return null;
    if (Array.isArray(shape)) return shape;
    
    if (shape.type === 'boolean' && Array.isArray(shape.shapes)) {
        // 不再使用凸包“规整化”，改为选择面积最大的真实子轮廓
        let best = null;
        let bestArea = 0;
        shape.shapes.forEach(s => {
            if (Array.isArray(s) && s.length >= 3) {
                const area = polygonArea(s);
                if (area > bestArea) {
                    bestArea = area;
                    best = s;
                }
            }
        });
        return best;
    }
    
    if (shape.type === 'smooth' && Array.isArray(shape.points)) {
        const sampled = [];
        for (let i = 0; i < shape.points.length; i += 3) {
            sampled.push(shape.points[i]);
        }
        return sampled.length >= 3 ? sampled : null;
    }
    
    return null;
}

// 将用户拖拽线段延长到整个画布，避免“一刀切不出去”
function extendCutLine(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) return null;
    const ux = dx / len;
    const uy = dy / len;
    const extend = Math.max(canvas.width, canvas.height) * 2;
    return {
        start: { x: start.x - ux * extend, y: start.y - uy * extend },
        end: { x: start.x + ux * extend, y: start.y + uy * extend }
    };
}

// 更新百分比图表
function updatePercentageChart(percent1, percent2) {
    const chartLeft = document.getElementById('chartLeft');
    const chartRight = document.getElementById('chartRight');
    
    chartLeft.style.flex = percent1 / 100;
    chartRight.style.flex = percent2 / 100;
    
    chartLeft.textContent = percent1.toFixed(1) + '%';
    chartRight.textContent = percent2.toFixed(1) + '%';
}

// 分割多边形
function splitPolygon(shape, entryPoint, exitPoint) {
    if (!entryPoint || !exitPoint) return null;
    
    const polygon1 = [];
    const polygon2 = [];
    
    // 找到entryPoint和exitPoint在形状上的位置
    let entryEdge = -1;
    let exitEdge = -1;
    
    for (let i = 0; i < shape.length; i++) {
        const p1 = { x: shape[i][0], y: shape[i][1] };
        const p2 = { x: shape[(i + 1) % shape.length][0], y: shape[(i + 1) % shape.length][1] };
        
        if (isPointOnSegment(entryPoint, p1, p2)) {
            entryEdge = i;
        }
        if (isPointOnSegment(exitPoint, p1, p2)) {
            exitEdge = i;
        }
    }
    
    if (entryEdge === -1 || exitEdge === -1) return null;
    
    // 构建两个多边形
    // 多边形1：从entryPoint开始，沿着形状边界到exitPoint，再沿着切割线返回
    let current = entryEdge;
    polygon1.push([entryPoint.x, entryPoint.y]);
    
    while (current !== exitEdge) {
        current = (current + 1) % shape.length;
        polygon1.push([shape[current][0], shape[current][1]]);
    }
    
    polygon1.push([exitPoint.x, exitPoint.y]);
    
    // 多边形2：从exitPoint开始，沿着形状边界到entryPoint，再沿着切割线返回
    current = exitEdge;
    polygon2.push([exitPoint.x, exitPoint.y]);
    
    while (current !== entryEdge) {
        current = (current + 1) % shape.length;
        polygon2.push([shape[current][0], shape[current][1]]);
    }
    
    polygon2.push([entryPoint.x, entryPoint.y]);
    
    return [polygon1, polygon2];
}

// 判断点是否在线段上
function isPointOnSegment(point, segStart, segEnd) {
    const epsilon = 0.01;
    const cross = (point.x - segStart.x) * (segEnd.y - segStart.y) - 
                  (point.y - segStart.y) * (segEnd.x - segStart.x);
    
    if (Math.abs(cross) > epsilon) return false;
    
    const dot = (point.x - segStart.x) * (segEnd.x - segStart.x) + 
                (point.y - segStart.y) * (segEnd.y - segStart.y);
    
    if (dot < -epsilon) return false;
    
    const lenSq = Math.pow(segEnd.x - segStart.x, 2) + Math.pow(segEnd.y - segStart.y, 2);
    
    if (dot > lenSq + epsilon) return false;
    
    return true;
}

// 多边形面积计算
function polygonArea(points) {
    if (points.length < 3) return 0;
    
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const x1 = points[i][0];
        const y1 = points[i][1];
        const x2 = points[(i + 1) % n][0];
        const y2 = points[(i + 1) % n][1];
        area += (x1 * y2) - (x2 * y1);
    }
    
    return Math.abs(area) / 2;
}

// 线段相交检测
function lineIntersection(p1, p2, p3, p4) {
    const denom = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    
    if (Math.abs(denom) < 0.0001) return null;
    
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / denom;
    const u = -((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) / denom;
    
    const epsilon = 0.001;
    if (t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }
    
    return null;
}

// 绘制分割后的多边形
function drawSplitPolygons(polygons) {
    if (!polygons || polygons.length !== 2) return;
    
    const baseColor = gameState.shapeColor || '#667eea';
    const colors = [lightenColor(baseColor, 30), darkenColor(baseColor, 30)];
    
    polygons.forEach((polygon, index) => {
        if (polygon.length < 3) return;
        
        ctx.beginPath();
        ctx.moveTo(polygon[0][0], polygon[0][1]);
        
        for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i][0], polygon[i][1]);
        }
        
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// 颜色工具函数
function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const B = (num >> 8 & 0x00FF) + amt;
    const G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const B = (num >> 8 & 0x00FF) - amt;
    const G = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R>0?R:0)*0x10000 + (B>0?B:0)*0x100 + (G>0?G:0)).toString(16).slice(1);
}

// 更新状态
function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

// 重置结果
function resetResults() {
    document.getElementById('leftArea').textContent = '0%';
    document.getElementById('rightArea').textContent = '0%';
    document.getElementById('error').textContent = '0%';
    document.getElementById('score').textContent = '0';
    
    // 重置图表
    updatePercentageChart(50, 50);
}

// 保存最佳成绩
function saveBestScore() {
    localStorage.setItem('shapeSplitterBestScore', gameState.bestScore);
    localStorage.setItem('shapeSplitterAttempts', gameState.attempts);
}

// 加载最佳成绩
function loadBestScore() {
    const savedScore = localStorage.getItem('shapeSplitterBestScore');
    const savedAttempts = localStorage.getItem('shapeSplitterAttempts');
    
    if (savedScore) {
        gameState.bestScore = parseInt(savedScore);
        document.getElementById('bestScore').textContent = gameState.bestScore;
    }
    
    if (savedAttempts) {
        gameState.attempts = parseInt(savedAttempts);
        document.getElementById('attempts').textContent = gameState.attempts;
    }
}

// 初始化游戏
window.onload = initGame;
