export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => Math.random() * (b - a) + a;

export function polygonArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) * 0.5;
}

export function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

export function lineIntersection(a, b, c, d) {
  const den = (a[0]-b[0])*(c[1]-d[1]) - (a[1]-b[1])*(c[0]-d[0]);
  if (Math.abs(den) < 1e-6) return null;
  const t = ((a[0]-c[0])*(c[1]-d[1]) - (a[1]-c[1])*(c[0]-d[0])) / den;
  const u = -((a[0]-b[0])*(a[1]-c[1]) - (a[1]-b[1])*(a[0]-c[0])) / den;
  if (t < -1e-6 || t > 1+1e-6 || u < -1e-6 || u > 1+1e-6) return null;
  return [a[0] + t * (b[0]-a[0]), a[1] + t * (b[1]-a[1])];
}

export function extendLine(start, end, scale = 4000) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const ux = dx / len, uy = dy / len;
  return [[start[0] - ux * scale, start[1] - uy * scale], [start[0] + ux * scale, start[1] + uy * scale]];
}
