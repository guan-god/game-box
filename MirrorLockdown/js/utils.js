export const clone = (obj) => JSON.parse(JSON.stringify(obj));
export const keyOf = (x, y) => `${x},${y}`;
export const inBounds = (x, y, size) => x >= 0 && y >= 0 && x < size && y < size;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function mirrorPos(pos, size) {
  return { x: size - 1 - pos.x, y: size - 1 - pos.y };
}

export function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ringCells(size, ring = 0) {
  const max = size - 1 - ring;
  const cells = [];
  for (let i = ring; i <= max; i += 1) {
    cells.push({ x: ring, y: i }, { x: max, y: i });
    if (i !== ring && i !== max) {
      cells.push({ x: i, y: ring }, { x: i, y: max });
    }
  }
  return cells;
}
