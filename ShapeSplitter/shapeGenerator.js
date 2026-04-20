import { rand, clamp } from './utils.js';

export function generateShape(cx, cy, baseR = 170) {
  const vertices = Math.floor(rand(11, 22));
  const irregular = rand(0.45, 1.0);
  const concavity = rand(0.12, 0.42);
  const points = [];
  let angle = rand(0, Math.PI * 2);
  const stepBase = (Math.PI * 2) / vertices;

  for (let i = 0; i < vertices; i++) {
    const step = stepBase * rand(0.78, 1.28);
    angle += step;
    let r = baseR * (1 + rand(-0.52, 0.52) * irregular);
    if (Math.random() < concavity) r *= rand(0.45, 0.78); // 局部凹陷
    r = clamp(r, baseR * 0.35, baseR * 1.55);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  // 保证顺时针顺序并去重
  return points.filter((p, i, arr) => {
    const n = arr[(i + 1) % arr.length];
    return Math.hypot(p[0] - n[0], p[1] - n[1]) > 6;
  });
}
