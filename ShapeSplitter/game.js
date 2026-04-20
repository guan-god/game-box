import { centroid, lerp } from './utils.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.anim = 1;
  }

  render(state) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.cutPolys) {
      this.anim = Math.min(1, this.anim + 0.05);
      const colors = ['#f7aef8', '#9ad1ff'];
      state.cutPolys.forEach((poly, i) => {
        const c = centroid(poly);
        const dx = c[0] - canvas.width / 2;
        const dy = c[1] - canvas.height / 2;
        const mag = Math.hypot(dx, dy) || 1;
        const off = 22 * this.anim;
        this.drawPoly(poly, colors[i], '#2b3157', [dx / mag * off, dy / mag * off]);
      });
    } else {
      this.anim = 0;
      this.drawPoly(state.shape, '#ffe14f', '#2b3157');
    }

    if (state.dragging) {
      ctx.beginPath();
      ctx.moveTo(state.dragStart[0], state.dragStart[1]);
      ctx.lineTo(state.dragEnd[0], state.dragEnd[1]);
      ctx.strokeStyle = '#ff4f58';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawPoly(poly, fill, stroke, offset = [0, 0]) {
    const { ctx } = this;
    if (!poly?.length) return;
    ctx.beginPath();
    ctx.moveTo(poly[0][0] + offset[0], poly[0][1] + offset[1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] + offset[0], poly[i][1] + offset[1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
