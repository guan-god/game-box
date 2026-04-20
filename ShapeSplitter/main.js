import { generateShape } from './shapeGenerator.js';
import { analyzeShape, scoreCut } from './scoring.js';
import { cutPolygon } from './cutter.js';
import { GameRenderer } from './game.js';
import * as ui from './ui.js';

const canvas = document.getElementById('gameCanvas');
const nextBtn = document.getElementById('nextBtn');
const renderer = new GameRenderer(canvas);

const state = {
  shape: [],
  rank: 'D',
  multiplier: 1,
  dragging: false,
  dragStart: [0, 0],
  dragEnd: [0, 0],
  cutPolys: null,
  best: Number(localStorage.getItem('cut_best') || 0),
};
ui.setBest(state.best);

function newRound() {
  state.shape = generateShape(canvas.width / 2, canvas.height / 2 + 8, 180);
  const info = analyzeShape(state.shape);
  state.rank = info.rank;
  state.multiplier = info.multiplier;
  state.cutPolys = null;
  state.dragging = false;
  ui.setShapeInfo(info.rank, info.multiplier);
  ui.resetResult();
}

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

canvas.addEventListener('mousedown', (e) => {
  if (state.cutPolys) return;
  state.dragging = true;
  state.dragStart = pos(e);
  state.dragEnd = pos(e);
});
canvas.addEventListener('mousemove', (e) => {
  if (!state.dragging) return;
  state.dragEnd = pos(e);
});
canvas.addEventListener('mouseup', (e) => {
  if (!state.dragging || state.cutPolys) return;
  state.dragging = false;
  state.dragEnd = pos(e);
  const cut = cutPolygon(state.shape, state.dragStart, state.dragEnd);
  if (!cut.ok) return ui.toast(cut.reason);
  state.cutPolys = cut.polys;
  const result = scoreCut(cut.polys[0], cut.polys[1], state.multiplier);
  ui.setResult(result);
  if (result.finalScore > state.best) {
    state.best = result.finalScore;
    localStorage.setItem('cut_best', String(state.best));
    ui.setBest(state.best);
  }
});

nextBtn.addEventListener('click', newRound);

function tick() {
  renderer.render(state);
  requestAnimationFrame(tick);
}

newRound();
tick();
