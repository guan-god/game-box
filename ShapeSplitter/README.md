# 一刀两断（ShapeSplitter 重制版）

一个纯前端 Canvas 小游戏：面对随机不规则图形，只能切一刀。

## 玩法
1. 打开 `index.html`
2. 按住鼠标拖动切割线，松开完成切割
3. 若切割有效，会显示两半面积比例、面积分、最终分
4. 点击“再来一局”进入下一局

## 评分
- `areaScore = max(0, 100 - diffRatio * 100)`
- `finalScore = areaScore × difficultyMultiplier`
- 难度评级（S/A/B/C/D）依据形状不规则度指标综合计算

## 技术结构
- `main.js`：入口与流程编排
- `shapeGenerator.js`：随机不规则图形生成
- `cutter.js`：切割线与多边形求交 / 一刀分割
- `scoring.js`：不规则度分析与评分结算
- `game.js`：Canvas 渲染与分裂动画
- `ui.js`：界面显示与提示
- `utils.js`：几何基础工具

无需后端，直接本地打开可玩。
