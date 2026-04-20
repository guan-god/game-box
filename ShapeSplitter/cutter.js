import { extendLine, lineIntersection } from './utils.js';

export function cutPolygon(points, dragStart, dragEnd) {
  const line = extendLine(dragStart, dragEnd);
  if (!line) return { ok: false, reason: '切割无效，请重试' };

  const hits = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const hit = lineIntersection(line[0], line[1], a, b);
    if (!hit) continue;
    if (hits.some(h => Math.hypot(h.p[0]-hit[0], h.p[1]-hit[1]) < 0.8)) continue;
    const dist = Math.hypot(hit[0] - line[0][0], hit[1] - line[0][1]);
    hits.push({ p: hit, edge: i, dist });
  }

  if (hits.length < 2) return { ok: false, reason: '切割无效，请重试' };
  hits.sort((a, b) => a.dist - b.dist);
  const h1 = hits[0], h2 = hits[hits.length - 1];

  const p1 = [h1.p[0], h1.p[1]], p2 = [h2.p[0], h2.p[1]];
  const poly1 = [p1], poly2 = [p2];

  let i = h1.edge;
  while (i !== h2.edge) {
    i = (i + 1) % points.length;
    poly1.push(points[i]);
  }
  poly1.push(p2);

  i = h2.edge;
  while (i !== h1.edge) {
    i = (i + 1) % points.length;
    poly2.push(points[i]);
  }
  poly2.push(p1);

  if (poly1.length < 3 || poly2.length < 3) return { ok: false, reason: '切割无效，请重试' };
  return { ok: true, polys: [poly1, poly2], line };
}
