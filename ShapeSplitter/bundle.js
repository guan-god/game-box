(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const polygonArea = (points) => {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) * 0.5;
  };
  const centroid = (points) => {
    let x = 0, y = 0;
    for (const p of points) { x += p[0]; y += p[1]; }
    return [x / points.length, y / points.length];
  };
  function lineIntersection(a, b, c, d) {
    const den = (a[0]-b[0])*(c[1]-d[1]) - (a[1]-b[1])*(c[0]-d[0]);
    if (Math.abs(den) < 1e-6) return null;
    const t = ((a[0]-c[0])*(c[1]-d[1]) - (a[1]-c[1])*(c[0]-d[0])) / den;
    const u = -((a[0]-b[0])*(a[1]-c[1]) - (a[1]-b[1])*(a[0]-c[0])) / den;
    if (t < -1e-6 || t > 1+1e-6 || u < -1e-6 || u > 1+1e-6) return null;
    return [a[0] + t * (b[0]-a[0]), a[1] + t * (b[1]-a[1])];
  }
  function extendLine(start, end, scale = 4000) {
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const len = Math.hypot(dx, dy);
    if (len < 4) return null;
    const ux = dx / len, uy = dy / len;
    return [[start[0] - ux * scale, start[1] - uy * scale], [start[0] + ux * scale, start[1] + uy * scale]];
  }

  function generateShape(cx, cy, baseR = 170) {
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
      if (Math.random() < concavity) r *= rand(0.45, 0.78);
      r = clamp(r, baseR * 0.35, baseR * 1.55);
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
    return points;
  }

  function cutPolygon(points, dragStart, dragEnd) {
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
    while (i !== h2.edge) { i = (i + 1) % points.length; poly1.push(points[i]); }
    poly1.push(p2);
    i = h2.edge;
    while (i !== h1.edge) { i = (i + 1) % points.length; poly2.push(points[i]); }
    poly2.push(p1);
    if (poly1.length < 3 || poly2.length < 3) return { ok: false, reason: '切割无效，请重试' };
    return { ok: true, polys: [poly1, poly2] };
  }

  const CONFIG = { multipliers: { S: 1.5, A: 1.3, B: 1.15, C: 1.0, D: 0.9 } };
  function analyzeShape(points) {
    const n = points.length;
    const edges = [], angles = []; let concaveCount = 0;
    for (let i = 0; i < n; i++) {
      const a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
      edges.push(Math.hypot(c[0]-b[0], c[1]-b[1]));
      const v1x = a[0]-b[0], v1y = a[1]-b[1], v2x = c[0]-b[0], v2y = c[1]-b[1];
      const dot = v1x*v2x + v1y*v2y;
      const m = Math.hypot(v1x,v1y)*Math.hypot(v2x,v2y) || 1;
      angles.push(Math.acos(Math.max(-1, Math.min(1, dot / m))));
      const cross = (b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0]);
      if (cross < 0) concaveCount++;
    }
    const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
    const variance = (arr) => avg(arr.map(x => (x-avg(arr))**2));
    const area = polygonArea(points), perimeter = edges.reduce((s,x)=>s+x,0);
    const complexity = (perimeter*perimeter)/(area||1);
    const edgeVar = Math.min(1, variance(edges)/((avg(edges)**2)||1));
    const angleVar = Math.min(1, variance(angles)/0.5);
    const concavity = concaveCount / n;
    const edgeCountScore = Math.min(1, (n-8)/14);
    const complexityScore = Math.min(1, Math.max(0,(complexity-14)/22));
    const irregular = 100*(0.2*edgeCountScore + 0.2*edgeVar + 0.2*angleVar + 0.2*concavity + 0.2*complexityScore);
    let rank = 'D'; if (irregular >= 78) rank='S'; else if (irregular >= 62) rank='A'; else if (irregular >=46) rank='B'; else if (irregular>=30) rank='C';
    return { irregular, rank, multiplier: CONFIG.multipliers[rank] };
  }
  function scoreCut(polyA, polyB) {
    const area1=polygonArea(polyA), area2=polygonArea(polyB), total=area1+area2;
    const diffRatio=Math.abs(area1-area2)/(total||1);
    const areaScore=Math.max(0,100-diffRatio*100);
    return { leftPct: area1/total*100, rightPct: area2/total*100, areaScore, finalScore: Math.round(areaScore) };
  }

  const ui = {
    bestScore: document.getElementById('bestScore'),
    shapeRank: document.getElementById('shapeRank'),
    multiplier: document.getElementById('multiplier'),
    leftPct: document.getElementById('leftPct'),
    rightPct: document.getElementById('rightPct'),
    finalScore: document.getElementById('finalScore'),
    toast: document.getElementById('toast'),
  };
  function toast(msg){ ui.toast.textContent = msg; ui.toast.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>ui.toast.classList.remove('show'),1200); }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextBtn = document.getElementById('nextBtn');
  const retryBtn = document.getElementById('retryBtn');
  const state = { shape:[], dragging:false, dragStart:[0,0], dragEnd:[0,0], cutPolys:null, anim:0, multiplier:1, best:Number(localStorage.getItem('cut_best')||0) };
  ui.bestScore.textContent = state.best;

  function drawPoly(poly, fill, stroke, offset=[0,0]) {
    if (!poly || !poly.length) return;
    ctx.beginPath(); ctx.moveTo(poly[0][0]+offset[0], poly[0][1]+offset[1]);
    for(let i=1;i<poly.length;i++) ctx.lineTo(poly[i][0]+offset[0], poly[i][1]+offset[1]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke();
  }

  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (state.cutPolys) {
      state.anim = Math.min(1, state.anim + 0.05);
      ['#f7aef8','#9ad1ff'].forEach((col, i)=>{
        const poly = state.cutPolys[i], c = centroid(poly);
        const dx = c[0]-canvas.width/2, dy=c[1]-canvas.height/2, mag=Math.hypot(dx,dy)||1, off=22*state.anim;
        drawPoly(poly,col,'#2b3157',[dx/mag*off,dy/mag*off]);
      });
    } else {
      state.anim = 0;
      drawPoly(state.shape,'#ffe14f','#2b3157');
    }
    if (state.dragging) {
      ctx.beginPath(); ctx.moveTo(state.dragStart[0], state.dragStart[1]); ctx.lineTo(state.dragEnd[0], state.dragEnd[1]);
      ctx.strokeStyle='#ff4f58'; ctx.lineWidth=3; ctx.setLineDash([8,6]); ctx.stroke(); ctx.setLineDash([]);
    }
    requestAnimationFrame(render);
  }

  const pos = (e)=>{ const r=canvas.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  function newRound(){
    state.shape = generateShape(canvas.width/2, canvas.height/2+8, 180);
    const info = analyzeShape(state.shape);
    state.multiplier = info.multiplier; state.cutPolys = null; state.dragging = false;
    ui.shapeRank.textContent = info.rank; ui.multiplier.textContent = `x${info.multiplier.toFixed(2)}`;
    ui.leftPct.textContent = ui.rightPct.textContent = ui.finalScore.textContent = '-';
  }
  function retrySameShape(){
    state.cutPolys = null;
    state.dragging = false;
    state.anim = 0;
    ui.leftPct.textContent = ui.rightPct.textContent = ui.finalScore.textContent = '-';
  }
  canvas.addEventListener('mousedown', (e)=>{ if(state.cutPolys) return; state.dragging=true; state.dragStart=pos(e); state.dragEnd=pos(e); });
  canvas.addEventListener('mousemove', (e)=>{ if(!state.dragging) return; state.dragEnd=pos(e); });
  window.addEventListener('mouseup', (e)=>{
    if(!state.dragging || state.cutPolys) return;
    state.dragging=false; state.dragEnd=pos(e);
    const cut = cutPolygon(state.shape, state.dragStart, state.dragEnd);
    if(!cut.ok) return toast(cut.reason);
    state.cutPolys = cut.polys;
    const r = scoreCut(cut.polys[0], cut.polys[1]);
    ui.leftPct.textContent=`${r.leftPct.toFixed(1)}%`; ui.rightPct.textContent=`${r.rightPct.toFixed(1)}%`; ui.finalScore.textContent=String(r.finalScore);
    ui.finalScore.animate([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:380});
    if(r.finalScore > state.best){ state.best=r.finalScore; localStorage.setItem('cut_best', String(state.best)); ui.bestScore.textContent=String(state.best); }
  });
  nextBtn.addEventListener('click', newRound);
  retryBtn.addEventListener('click', retrySameShape);

  newRound();
  render();
})();
