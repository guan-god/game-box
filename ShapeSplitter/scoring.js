import { polygonArea } from './utils.js';

export const CONFIG = {
  multipliers: { S: 1.5, A: 1.3, B: 1.15, C: 1.0, D: 0.9 },
};

export function analyzeShape(points) {
  const n = points.length;
  const edges = [];
  const angles = [];
  let concaveCount = 0;

  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
    const e = Math.hypot(c[0] - b[0], c[1] - b[1]);
    edges.push(e);

    const v1x = a[0] - b[0], v1y = a[1] - b[1];
    const v2x = c[0] - b[0], v2y = c[1] - b[1];
    const dot = v1x * v2x + v1y * v2y;
    const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
    angles.push(Math.acos(Math.max(-1, Math.min(1, dot / m))));
    const cross = (b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0]);
    if (cross < 0) concaveCount++;
  }

  const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = (arr) => avg(arr.map(x => (x - avg(arr)) ** 2));
  const area = polygonArea(points);
  const perimeter = edges.reduce((s, x) => s + x, 0);
  const complexity = (perimeter * perimeter) / (area || 1);

  const edgeVar = Math.min(1, variance(edges) / ((avg(edges) ** 2) || 1));
  const angleVar = Math.min(1, variance(angles) / 0.5);
  const concavity = concaveCount / n;
  const edgeCountScore = Math.min(1, (n - 8) / 14);
  const complexityScore = Math.min(1, Math.max(0, (complexity - 14) / 22));

  const irregular = 100 * (0.2 * edgeCountScore + 0.2 * edgeVar + 0.2 * angleVar + 0.2 * concavity + 0.2 * complexityScore);

  let rank = 'D';
  if (irregular >= 78) rank = 'S';
  else if (irregular >= 62) rank = 'A';
  else if (irregular >= 46) rank = 'B';
  else if (irregular >= 30) rank = 'C';

  return { irregular, rank, multiplier: CONFIG.multipliers[rank] };
}

export function scoreCut(polyA, polyB) {
  const area1 = polygonArea(polyA);
  const area2 = polygonArea(polyB);
  const totalArea = area1 + area2;
  const diffRatio = Math.abs(area1 - area2) / (totalArea || 1);
  const areaScore = Math.max(0, 100 - diffRatio * 100);
  const finalScore = Math.round(areaScore);
  return {
    area1, area2,
    leftPct: (area1 / totalArea) * 100,
    rightPct: (area2 / totalArea) * 100,
    areaScore,
    finalScore,
  };
}
