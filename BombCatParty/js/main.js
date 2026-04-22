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
  showFutureCards,
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

const appState = {
  screen: 'menu',
  setupMode: 'ai',
  setupPlayers: 3,
  engine: null,
  viewer: 0,
  busy: false
};

function switchScreen(name) {
  appState.screen = name;
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

function render() {
  if (appState.screen === 'menu') {
    renderMenu(screens.menu, {
      start: (mode) => {
        appState.setupMode = mode;
        appState.setupPlayers = mode === 'ai' ? 3 : 4;
        switchScreen('setup');
        render();
      },
      rules: showRules,
      settings: () => showSettings(getFxSettings(), saveSettings)
    });
    return;
  }

  if (appState.screen === 'setup') {
    renderSetup(screens.setup, appState.setupMode, {
      onPlayers: (n) => appState.setupPlayers = n,
      confirm: () => startGame(appState.setupMode, appState.setupPlayers),
      back: () => { switchScreen('menu'); render(); }
    });
    return;
  }

  if (appState.screen === 'game') {
    const state = appState.engine.getPublicState();
    renderGame(screens.game, state, appState.viewer, {
      playCard: (index, card) => onHumanPlay(index, card),
      draw: () => onHumanDraw(),
      combo: () => onHumanCombo(),
      restart: () => startGame(appState.setupMode, appState.setupPlayers),
      backMenu: () => { switchScreen('menu'); render(); },
      isPlayable: (index, card) => canHumanPlay(index, card),
      handHint: () => appState.engine.handLimitHint(appState.viewer)
    });
  }
}

function saveSettings(next) {
  setFxSettings(next);
  localStorage.setItem('bomb-cat-settings', JSON.stringify(next));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('bomb-cat-settings');
    if (!raw) return;
    setFxSettings(JSON.parse(raw));
  } catch {
    // ignore
  }
}

function currentPlayer() {
  return appState.engine.state.players[appState.engine.state.current];
}

function canHumanPlay(index, card) {
  const p = currentPlayer();
  if (!p.isHuman || p.id !== appState.viewer) return false;
  if (appState.busy) return false;
  if (['bomb', 'defuse', 'counter'].includes(card.id) || card.type === 'cat') return false;
  return true;
}

async function onHumanPlay(index, card) {
  const p = currentPlayer();
  if (!canHumanPlay(index, card)) return;

  let payload = {};
  if (card.id === 'favor') {
    const t = await promptChooseTarget(appState.engine.state.players, p.id, '索要目标');
    if (t == null) return;
    payload.target = t;
  }

  sfx.play();
  await appState.engine.playCard(p.id, index, payload);
  render();
  if (maybeEnded()) return;
  await maybeRunAi();
}

async function onHumanDraw() {
  const p = currentPlayer();
  if (!p.isHuman || p.id !== appState.viewer || appState.busy) return;
  sfx.draw();
  pulsePile('deck-pile');
  await appState.engine.performDraw(p.id);
  render();
  if (maybeEnded()) return;
  await maybeRunAi();
}

async function onHumanCombo() {
  const p = currentPlayer();
  if (!p.isHuman || p.id !== appState.viewer || appState.busy) return;
  const comboOptions = appState.engine.canUseCombo(p.id);
  if (!comboOptions.length) {
    toast('你没有两张同名猫咪牌。');
    return;
  }
  const combo = comboOptions[0];
  const target = await promptChooseTarget(appState.engine.state.players, p.id, '猫咪组合目标');
  if (target == null) return;
  await appState.engine.doCatCombo(p.id, combo.id, target);
  render();
}

function maybeEnded() {
  const state = appState.engine.state;
  if (state.winner != null) return true;
  return false;
}

async function maybeRunAi() {
  if (appState.busy) return;
  appState.busy = true;

  try {
    while (true) {
      const state = appState.engine.state;
      if (state.winner != null) break;
      const p = currentPlayer();
      if (p.isHuman) {
        if (state.mode === 'local' && state.waitingPass) {
          showPassOverlay(p.name, () => {
            state.waitingPass = false;
            appState.viewer = p.id;
            render();
          });
        }
        break;
      }

      appState.viewer = 0;
      render();
      toast(`${p.name} 思考中...`);
      await sleep(600 / getFxSettings().speed);

      const action = chooseAiAction(appState.engine, p.id);
      if (action.type === 'draw') {
        sfx.draw();
        pulsePile('deck-pile');
        await appState.engine.performDraw(p.id);
      } else if (action.type === 'play') {
        sfx.play();
        await appState.engine.playCard(p.id, action.cardIndex, { target: action.target });
      } else if (action.type === 'combo') {
        await appState.engine.doCatCombo(p.id, action.catId, action.target);
      }
      render();
      await sleep(350 / getFxSettings().speed);
    }
  } finally {
    appState.busy = false;
  }
}

function startGame(mode, totalPlayers) {
  appState.setupMode = mode;
  appState.setupPlayers = totalPlayers;
  appState.viewer = 0;

  appState.engine = new GameEngine({ mode, totalPlayers }, {
    onLog: () => render(),
    onState: () => render(),
    onDraw: async (_player, card) => {
      if (card.id === 'bomb') { sfx.danger(); pulsePile('deck-pile'); }
    },
    onEliminate: () => sfx.danger(),
    onCounter: () => sfx.counter(),
    onWin: (winner) => {
      sfx.win();
      showWinner(winner.name, () => startGame(appState.setupMode, appState.setupPlayers), () => {
        switchScreen('menu');
        render();
      });
    },
    requestDefusePosition: async (playerIndex, deckLen) => {
      const p = appState.engine.state.players[playerIndex];
      sfx.defuse();
      if (p.isHuman) {
        return promptDefusePos(deckLen);
      }
      await sleep(250 / getFxSettings().speed);
      return chooseAiDefusePos(deckLen);
    },
    showFuture: async (playerIndex, cards) => {
      const p = appState.engine.state.players[playerIndex];
      if (p.isHuman) {
        showFutureCards(cards);
        await new Promise(resolve => {
          showModal(`<h2>预知未来</h2><p>${cards.map(c => `${c.emoji}${c.name}`).join(' / ')}</p>`, [
            { label: '收起', className: 'inline-btn primary', onClick: () => { closeModal(); resolve(); } }
          ]);
        });
      } else {
        appState.engine.log(`🤖 ${p.name} 看了看未来，神秘一笑。`);
      }
    },
    askCounter: async ({ reactor, sourcePlayer, sourceCard }) => {
      const p = appState.engine.state.players[reactor];
      if (!p.alive) return false;
      if (p.isHuman) {
        return new Promise(resolve => {
          showModal(`<h2>是否反制？</h2>
            <p>${p.name}：${appState.engine.state.players[sourcePlayer].name} 打出了【${sourceCard.name}】。</p>
            <p>你要不要打出【反制】？</p>`, [
            { label: '不反制', className: 'inline-btn', onClick: () => { closeModal(); resolve(false); } },
            { label: '打出反制', className: 'inline-btn warn', onClick: () => { closeModal(); resolve(true); } }
          ]);
        });
      }
      await sleep(280 / getFxSettings().speed);
      return shouldAiCounter(appState.engine, reactor, sourceCard.id);
    }
  });

  switchScreen('game');
  render();
  showTutorialOnce();
  appState.engine.startTurn().then(() => maybeRunAi());
}

document.getElementById('btn-rules').addEventListener('click', showRules);
document.getElementById('btn-settings').addEventListener('click', () => showSettings(getFxSettings(), saveSettings));

loadSettings();
switchScreen('menu');
render();
