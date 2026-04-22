export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function nextAliveIndex(players, from) {
  if (!players.some(p => p.alive)) return -1;
  let idx = from;
  for (let k = 0; k < players.length; k++) {
    idx = (idx + 1) % players.length;
    if (players[idx].alive) return idx;
  }
  return -1;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
