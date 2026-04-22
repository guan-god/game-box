import { GameEngine } from './engine.js';
import { chooseAiAction, shouldAiCounter, chooseAiDefusePos } from './ai.js';
import {
  renderMenu,
  renderSetup,
  renderGame,
  showRules,
  showSettings,
  promptChooseTarget,
  promptDefusePos,
  showWinner,
  showPassOverlay,
  showTutorialOnce,
  showModal,
  closeModal
} from './ui.js';
import { toast, sfx, setFxSettings, getFxSettings, pulsePile } from './fx.js';
import { sleep } from './utils.js';

const screens = {
  menu: document.getElementById('menu-screen'),
  setup: document.getElementById('setup-screen'),
  game: document.getElementById('game-screen')
};

const state = {
  screen: 'menu',
  setupMode: 'ai',
  setupPlayers: 3,
  showRules: false,
  showSettings: false,
  engine: null,
  viewer: 0,
  busy: false,
  lastError: null,
  debug: location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=1')
};

function logEvent(msg, payload = null) {
  console.log(`[BombCatParty] ${msg}`, payload ?? '');
}

function mountDebugPanel() {
  const old = document.getElementById('debug-panel');
  if (old) old.remove();
  if (!state.debug) return;
  const p = document.createElement('div');
  p.id = 'debug-panel';
  p.className = 'debug-panel';
  p.innerHTML = `screen: <b>${state.screen}</b><br>showRules: <b>${state.showRules}</b><br>showSettings: <b>${state.showSettings}</b>${state.lastError ? `<br>error: <b>${state.lastError}</b>` : ''}`;
  document.body.appendChild(p);
}

function setScreen(next) {
  state.screen = next;
  logEvent('screen changed', next);
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle('active', key === next);
  });
}

function renderFallback(container, error = null) {
  if (!container) return;
  container.innerHTML = `<div class="panel error-card"><h2>主菜单加载失败</h2><p>当前界面状态：${state.screen}</p>${error ? `<pre>${String(error.message || error)}</pre>` : ''}</div>`;
}

function renderScreen() {
  try {
    state.lastError = null;
    if (!screens.menu || !screens.setup || !screens.game) {
      throw new Error('screen 容器节点缺失，无法渲染');
    }

    if (!['menu', 'setup', 'game'].includes(state.screen)) {
      logEvent('invalid screen detected, fallback to menu', state.screen);
      state.screen = 'menu';
    }

    if (state.screen === 'menu') {
      renderMenu(screens.menu, {
        start: (mode) => {
          logEvent('click menu start', mode);
          state.setupMode = mode;
          state.setupPlayers = mode === 'ai' ? 3 : 4;
          setScreen('setup');
          render();
        },
        rules: openRules,
        settings: openSettings
      });
    } else if (state.screen === 'setup') {
      renderSetup(screens.setup, state.setupMode, {
        onPlayers: (n) => {
          state.setupPlayers = n;
          logEvent('setup players changed', n);
        },
        confirm: () => {
          logEvent('click confirm start game', { mode: state.setupMode, players: state.setupPlayers });
          startGame(state.setupMode, state.setupPlayers);
        },
        back: () => {
          setScreen('menu');
          render();
        }
      });
    } else if (state.screen === 'game') {
      const gameState = state.engine?.getPublicState();
      if (!gameState) throw new Error('game state 不存在，无法渲染对局界面');
      renderGame(screens.game, gameState, state.viewer, {
        playCard: (index, card) => onHumanPlay(index, card),
        draw: () => onHumanDraw(),
        combo: () => onHumanCombo(),
        restart: () => startGame(state.setupMode, state.setupPlayers),
        backMenu: () => {
          setScreen('menu');
          render();
        },
        isPlayable: (index, card) => canHumanPlay(index, card),
        handHint: () => state.engine.handLimitHint(state.viewer)
      });
    }
  } catch (err) {
    state.lastError = err?.message || String(err);
    console.error(err);
    renderFallback(screens[state.screen] || screens.menu, err);
  }
}

function render() {
  renderScreen();
  renderModals();
  mountDebugPanel();
}

function renderModals() {
  if (state.showRules) {
    showRules(() => {
      state.showRules = false;
      mountDebugPanel();
    });
    return;
  }
  if (state.showSettings) {
    showSettings(getFxSettings(), saveSettings, () => {
      state.showSettings = false;
      mountDebugPanel();
    });
    return;
  }
  closeModal();
}

function openRules() {
  logEvent('click rules');
  state.showSettings = false;
  state.showRules = true;
  render();
}

function openSettings() {
  logEvent('click settings');
  state.showRules = false;
  state.showSettings = true;
  render();
}

function saveSettings(next) {
  setFxSettings(next);
  localStorage.setItem('bomb-cat-settings', JSON.stringify(next));
  logEvent('save settings', next);
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('bomb-cat-settings');
    if (!raw) return;
    setFxSettings(JSON.parse(raw));
  } catch (err) {
    console.warn('设置读取失败', err);
  }
}

function currentPlayer() {
  return state.engine.state.players[state.engine.state.current];
}

function canHumanPlay(index, card) {
  const p = currentPlayer();
  if (!p?.isHuman || p.id !== state.viewer) return false;
  if (state.busy) return false;
  if (['bomb', 'defuse', 'counter'].includes(card.id) || card.type === 'cat') return false;
  return true;
}

async function onHumanPlay(index, card) {
  const p = currentPlayer();
  if (!canHumanPlay(index, card)) return;
  let payload = {};
  if (card.id === 'favor') {
    const t = await promptChooseTarget(state.engine.state.players, p.id, '索要目标');
    if (t == null) return;
    payload.target = t;
  }
  sfx.play();
  await state.engine.playCard(p.id, index, payload);
  render();
  if (state.engine.state.winner != null) return;
  await maybeRunAi();
}

async function onHumanDraw() {
  const p = currentPlayer();
  if (!p?.isHuman || p.id !== state.viewer || state.busy) return;
  sfx.draw();
  pulsePile('deck-pile');
  await state.engine.performDraw(p.id);
  render();
  if (state.engine.state.winner != null) return;
  await maybeRunAi();
}

async function onHumanCombo() {
  const p = currentPlayer();
  if (!p?.isHuman || p.id !== state.viewer || state.busy) return;
  const combos = state.engine.canUseCombo(p.id);
  if (!combos.length) {
    toast('你没有两张同名猫咪牌。');
    return;
  }
  const choice = combos[0];
  const target = await promptChooseTarget(state.engine.state.players, p.id, '猫咪组合目标');
  if (target == null) return;
  await state.engine.doCatCombo(p.id, choice.id, target);
  render();
}

async function maybeRunAi() {
  if (state.busy) return;
  state.busy = true;
  try {
    while (true) {
      const gs = state.engine.state;
      if (gs.winner != null) break;
      const p = currentPlayer();
      if (p.isHuman) {
        if (gs.mode === 'local' && gs.waitingPass) {
          showPassOverlay(p.name, () => {
            gs.waitingPass = false;
            state.viewer = p.id;
            render();
          });
        }
        break;
      }
      state.viewer = 0;
      render();
      toast(`${p.name} 思考中...`);
      await sleep(580 / getFxSettings().speed);

      const action = chooseAiAction(state.engine, p.id);
      if (action.type === 'draw') {
        sfx.draw();
        pulsePile('deck-pile');
        await state.engine.performDraw(p.id);
      } else if (action.type === 'play') {
        sfx.play();
        await state.engine.playCard(p.id, action.cardIndex, { target: action.target });
      } else if (action.type === 'combo') {
        await state.engine.doCatCombo(p.id, action.catId, action.target);
      }
      render();
      await sleep(260 / getFxSettings().speed);
    }
  } finally {
    state.busy = false;
  }
}

function startGame(mode, totalPlayers) {
  state.setupMode = mode;
  state.setupPlayers = totalPlayers;
  state.viewer = 0;
  state.showRules = false;
  state.showSettings = false;

  state.engine = new GameEngine({ mode, totalPlayers }, {
    onLog: () => render(),
    onState: () => render(),
    onDraw: (_player, card) => {
      if (card.id === 'bomb') {
        sfx.danger();
        pulsePile('deck-pile');
      }
    },
    onEliminate: () => sfx.danger(),
    onCounter: () => sfx.counter(),
    onWin: (winner) => {
      sfx.win();
      showWinner(winner.name, () => startGame(state.setupMode, state.setupPlayers), () => {
        setScreen('menu');
        render();
      });
    },
    requestDefusePosition: async (playerIndex, deckLen) => {
      const p = state.engine.state.players[playerIndex];
      sfx.defuse();
      if (p.isHuman) return promptDefusePos(deckLen);
      await sleep(220 / getFxSettings().speed);
      return chooseAiDefusePos(deckLen);
    },
    showFuture: async (playerIndex, cards) => {
      const p = state.engine.state.players[playerIndex];
      if (p.isHuman) {
        await new Promise(resolve => {
          showModal(`<h2>预知未来</h2><p>${cards.map(c => `${c.emoji}${c.name}`).join(' / ')}</p>`, [
            { label: '收起', className: 'inline-btn primary', onClick: () => { closeModal(); resolve(); } }
          ], { closeOnMask: false });
        });
      } else {
        state.engine.log(`🤖 ${p.name} 看了看未来，神秘一笑。`);
      }
    },
    askCounter: async ({ reactor, sourcePlayer, sourceCard }) => {
      const p = state.engine.state.players[reactor];
      if (!p.alive) return false;
      if (p.isHuman) {
        return new Promise(resolve => {
          showModal(`<h2>是否反制？</h2>
            <p>${p.name}：${state.engine.state.players[sourcePlayer].name} 打出了【${sourceCard.name}】。</p>
            <p>你要不要打出【反制】？</p>`, [
            { label: '不反制', className: 'inline-btn', onClick: () => { closeModal(); resolve(false); } },
            { label: '打出反制', className: 'inline-btn warn', onClick: () => { closeModal(); resolve(true); } }
          ], { closeOnMask: false });
        });
      }
      await sleep(220 / getFxSettings().speed);
      return shouldAiCounter(state.engine, reactor, sourceCard.id);
    }
  });

  setScreen('game');
  render();
  showTutorialOnce();
  state.engine.startTurn().then(() => maybeRunAi());
}

window.addEventListener('error', (event) => {
  state.lastError = event.message || '未知运行时错误';
  render();
});

document.getElementById('btn-rules').addEventListener('click', openRules);
document.getElementById('btn-settings').addEventListener('click', openSettings);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state.showRules || state.showSettings)) {
    state.showRules = false;
    state.showSettings = false;
    render();
  }
});

loadSettings();
setScreen('menu');
render();
