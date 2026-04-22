import { CARD_TYPES } from './cards.js';
import { sample } from './utils.js';

function hasCard(player, id) {
  return player.hand.some(c => c.id === id);
}

function cardIndex(player, id) {
  return player.hand.findIndex(c => c.id === id);
}

export function chooseAiAction(engine, playerIndex) {
  const state = engine.state;
  const me = state.players[playerIndex];
  const top3 = state.deck.slice(0, 3).map(c => c.id);
  const dangerKnown = top3.includes('bomb');

  if (dangerKnown && hasCard(me, 'foresee')) return { type: 'play', cardIndex: cardIndex(me, 'foresee') };
  if (dangerKnown && hasCard(me, 'shuffle')) return { type: 'play', cardIndex: cardIndex(me, 'shuffle') };
  if (dangerKnown && hasCard(me, 'skip')) return { type: 'play', cardIndex: cardIndex(me, 'skip') };

  if (hasCard(me, 'attack') && Math.random() < 0.45) return { type: 'play', cardIndex: cardIndex(me, 'attack') };
  if (hasCard(me, 'favor') && Math.random() < 0.4) {
    const targets = engine.getAliveOpponents(playerIndex);
    if (targets.length) return { type: 'play', cardIndex: cardIndex(me, 'favor'), target: sample(targets) };
  }
  if (hasCard(me, 'shuffle') && Math.random() < 0.25) return { type: 'play', cardIndex: cardIndex(me, 'shuffle') };

  const cats = {};
  for (const c of me.hand) {
    if (c.type === CARD_TYPES.cat) {
      cats[c.id] = (cats[c.id] || 0) + 1;
    }
  }
  const comboKey = Object.keys(cats).find(k => cats[k] >= 2);
  if (comboKey) {
    const targets = engine.getAliveOpponents(playerIndex).filter(i => state.players[i].hand.length > 0);
    if (targets.length && Math.random() < 0.6) return { type: 'combo', catId: comboKey, target: sample(targets) };
  }

  return { type: 'draw' };
}

export function shouldAiCounter(engine, aiIndex, sourceCardId) {
  const state = engine.state;
  const me = state.players[aiIndex];
  if (!me.alive) return false;
  if (!me.hand.some(c => c.id === 'counter')) return false;

  const threatening = ['favor', 'attack', 'shuffle'];
  if (threatening.includes(sourceCardId) && Math.random() < 0.65) return true;
  if (sourceCardId === 'skip' && Math.random() < 0.25) return true;
  return Math.random() < 0.15;
}

export function chooseAiDefusePos(deckLength) {
  const r = Math.random();
  if (r < 0.34) return 0;
  if (r < 0.67) return Math.floor(deckLength / 2);
  if (r < 0.9) return deckLength;
  return Math.floor(Math.random() * (deckLength + 1));
}
