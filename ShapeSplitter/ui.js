const el = {
  bestScore: document.getElementById('bestScore'),
  shapeRank: document.getElementById('shapeRank'),
  multiplier: document.getElementById('multiplier'),
  leftPct: document.getElementById('leftPct'),
  rightPct: document.getElementById('rightPct'),
  areaScore: document.getElementById('areaScore'),
  finalScore: document.getElementById('finalScore'),
  toast: document.getElementById('toast'),
};

export function setBest(v) { el.bestScore.textContent = String(v); }
export function setShapeInfo(rank, m) { el.shapeRank.textContent = rank; el.multiplier.textContent = `x${m.toFixed(2)}`; }
export function setResult(r) {
  el.leftPct.textContent = `${r.leftPct.toFixed(1)}%`;
  el.rightPct.textContent = `${r.rightPct.toFixed(1)}%`;
  el.areaScore.textContent = r.areaScore.toFixed(1);
  el.finalScore.textContent = String(r.finalScore);
  el.finalScore.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 380 });
}
export function resetResult() {
  el.leftPct.textContent = '-'; el.rightPct.textContent = '-'; el.areaScore.textContent = '-'; el.finalScore.textContent = '-';
}
export function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove('show'), 1200);
}
