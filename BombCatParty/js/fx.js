let settings = {
  soundOn: true,
  speed: 1
};

export function setFxSettings(next) {
  settings = { ...settings, ...next };
}

export function getFxSettings() {
  return settings;
}

export function toast(msg, ms = 1800) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;
function beep(freq = 440, duration = 0.08, type = 'triangle') {
  if (!settings.soundOn || !AudioCtx) return;
  ctx ||= new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / settings.speed);
}

export const sfx = {
  draw: () => beep(520, 0.06),
  play: () => beep(430, 0.08),
  danger: () => { beep(200, 0.12, 'sawtooth'); setTimeout(() => beep(130, 0.18, 'sawtooth'), 80); },
  defuse: () => { beep(660, 0.08); setTimeout(() => beep(860, 0.1), 60); },
  counter: () => beep(320, 0.12, 'square'),
  win: () => { beep(680, 0.08); setTimeout(() => beep(860, 0.09), 90); setTimeout(() => beep(1020, 0.1), 180); }
};

export function pulsePile(id = 'deck-pile') {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 650 / settings.speed);
}
