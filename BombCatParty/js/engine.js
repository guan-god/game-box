import { buildDeck, makeCard, CARD_TYPES } from './cards.js';
import { shuffle, nextAliveIndex, sample } from './utils.js';

export class GameEngine {
  constructor(config, hooks) {
    this.config = config;
    this.hooks = hooks;
    this.state = this.createInitialState(config);
  }

  createInitialState(config) {
    const players = [];
    for (let i = 0; i < config.totalPlayers; i++) {
      const isHuman = config.mode === 'local' ? true : i === 0;
      players.push({
        id: i,
        name: isHuman ? (config.mode === 'local' ? `玩家${i + 1}` : '你') : `AI-${i}`,
        isHuman,
        alive: true,
        hand: [],
        turns: 1
      });
    }

    let deck = shuffle(buildDeck(config.totalPlayers));

    for (const p of players) {
      p.hand.push(makeCard('defuse'));
    }

    for (let r = 0; r < 6; r++) {
      for (const p of players) {
        p.hand.push(deck.shift());
      }
    }

    return {
      mode: config.mode,
      players,
      deck,
      discard: [],
      current: 0,
      chainSource: null,
      logs: ['🎉 对局开始！每位玩家获得 7 张牌（含 1 张拆弹包）。'],
      winner: null,
      waitingPass: config.mode === 'local'
    };
  }

  log(text) {
    this.state.logs.push(text);
    if (this.state.logs.length > 120) this.state.logs.shift();
    this.hooks.onLog?.(text);
  }

  get currentPlayer() {
    return this.state.players[this.state.current];
  }

  getAliveOpponents(playerIndex) {
    return this.state.players
      .filter(p => p.alive && p.id !== playerIndex)
      .map(p => p.id);
  }

  removeCardByIndex(player, index) {
    return player.hand.splice(index, 1)[0];
  }

  findCardIndex(player, id) {
    return player.hand.findIndex(c => c.id === id);
  }

  async startTurn() {
    const p = this.currentPlayer;
    if (!p.alive) {
      this.advanceToNextAlive();
      return;
    }
    if (p.turns <= 0) p.turns = 1;
    this.log(`👉 轮到 ${p.name}（剩余小回合 ${p.turns}）`);
    this.hooks.onState?.(this.state);
    if (this.state.mode === 'local') this.state.waitingPass = true;
  }

  async performDraw(playerIndex) {
    const p = this.state.players[playerIndex];
    if (!p.alive) return;
    const card = this.state.deck.shift();
    if (!card) return;

    this.log(`🎴 ${p.name} 抽到一张牌。`);
    this.hooks.onDraw?.(p, card);

    if (card.id === 'bomb') {
      this.log(`💣 ${p.name} 抽到了【爆裂猫】！`);
      const defuseIdx = this.findCardIndex(p, 'defuse');
      if (defuseIdx === -1) {
        p.alive = false;
        this.state.discard.push(card);
        this.log(`💥 ${p.name} 没有拆弹包，被淘汰！`);
        this.hooks.onEliminate?.(p);
      } else {
        const defuse = this.removeCardByIndex(p, defuseIdx);
        this.state.discard.push(defuse);
        this.log(`🧯 ${p.name} 使用了拆弹包！`);
        const pos = await this.hooks.requestDefusePosition?.(playerIndex, this.state.deck.length) ?? this.state.deck.length;
        const insertAt = Math.max(0, Math.min(this.state.deck.length, pos));
        this.state.deck.splice(insertAt, 0, card);
        this.log(`🪤 爆裂猫被塞回牌库位置 ${insertAt + 1}。`);
      }
    } else {
      p.hand.push(card);
    }

    await this.finishSubTurn(playerIndex);
  }

  async finishSubTurn(playerIndex) {
    const p = this.state.players[playerIndex];
    if (!p.alive) {
      p.turns = 0;
    } else {
      p.turns -= 1;
    }
    this.checkWinner();
    if (this.state.winner) return;

    if (p.turns > 0) {
      this.log(`⏱️ ${p.name} 还有 ${p.turns} 个小回合。`);
      this.hooks.onState?.(this.state);
      return;
    }

    this.advanceToNextAlive();
    await this.startTurn();
  }

  advanceToNextAlive() {
    this.state.current = nextAliveIndex(this.state.players, this.state.current);
    const next = this.currentPlayer;
    if (next.turns <= 0) next.turns = 1;
  }

  async playCard(playerIndex, handIndex, payload = {}) {
    const p = this.state.players[playerIndex];
    if (!p.alive) return;
    const card = p.hand[handIndex];
    if (!card) return;
    if (card.id === 'bomb' || card.id === 'defuse' || card.type === CARD_TYPES.cat || card.id === 'counter') return;

    const cancelled = await this.resolveCounterChain(playerIndex, card);
    if (cancelled) {
      this.removeCardByIndex(p, handIndex);
      this.state.discard.push(card);
      this.log(`🚫 ${card.name} 被连锁反制，无事发生。`);
      this.hooks.onState?.(this.state);
      return;
    }

    this.removeCardByIndex(p, handIndex);
    this.state.discard.push(card);
    this.log(`🃏 ${p.name} 打出【${card.name}】`);

    if (card.id === 'skip') {
      await this.finishSubTurn(playerIndex);
      return;
    }

    if (card.id === 'attack') {
      const nextIdx = nextAliveIndex(this.state.players, playerIndex);
      this.state.players[nextIdx].turns += 1;
      this.log(`⚔️ ${this.state.players[nextIdx].name} 将额外执行 1 个小回合（合计 ${this.state.players[nextIdx].turns}）。`);
      p.turns = 1;
      await this.finishSubTurn(playerIndex);
      return;
    }

    if (card.id === 'foresee') {
      const peek = this.state.deck.slice(0, 3);
      await this.hooks.showFuture?.(playerIndex, peek);
    }

    if (card.id === 'shuffle') {
      this.state.deck = shuffle(this.state.deck);
      this.log('🌀 牌库被重新洗牌。');
    }

    if (card.id === 'favor') {
      const target = payload.target;
      if (target == null || !this.state.players[target]?.alive || this.state.players[target].hand.length === 0) {
        this.log('🤷 索要失败：目标没有可给的牌。');
      } else {
        const victim = this.state.players[target];
        const idx = Math.floor(Math.random() * victim.hand.length);
        const stolen = victim.hand.splice(idx, 1)[0];
        p.hand.push(stolen);
        this.log(`🫴 ${victim.name} 被迫交出 1 张牌给 ${p.name}。`);
      }
    }

    this.hooks.onState?.(this.state);
  }

  async resolveCounterChain(sourcePlayer, sourceCard) {
    let chain = 0;
    let cursor = sourcePlayer;

    while (true) {
      let someonePlayed = false;
      for (let step = 1; step < this.state.players.length; step++) {
        const idx = (cursor + step) % this.state.players.length;
        const p = this.state.players[idx];
        if (!p.alive) continue;
        const counterIdx = this.findCardIndex(p, 'counter');
        if (counterIdx < 0) continue;

        const will = await this.hooks.askCounter?.({
          reactor: idx,
          sourcePlayer,
          sourceCard,
          chain
        });

        if (will) {
          const c = this.removeCardByIndex(p, counterIdx);
          this.state.discard.push(c);
          chain += 1;
          someonePlayed = true;
          cursor = idx;
          this.log(`🛑 ${p.name} 打出反制！当前连锁层数：${chain}`);
          this.hooks.onCounter?.(chain);
          break;
        }
      }
      if (!someonePlayed) break;
    }

    return chain % 2 === 1;
  }

  async doCatCombo(playerIndex, catId, targetId) {
    const p = this.state.players[playerIndex];
    if (!p.alive) return;
    const same = p.hand.filter(c => c.id === catId);
    if (same.length < 2) return;

    const cancelled = await this.resolveCounterChain(playerIndex, { id: 'cat_combo', name: '猫咪组合技' });
    if (cancelled) {
      this.log('🚫 猫咪组合技被反制。');
      return;
    }

    const removeOne = () => {
      const idx = p.hand.findIndex(c => c.id === catId);
      this.state.discard.push(p.hand.splice(idx, 1)[0]);
    };
    removeOne();
    removeOne();

    const target = this.state.players[targetId];
    if (!target?.alive || target.hand.length === 0) {
      this.log('🐾 组合技发动了，但目标没有手牌。');
      return;
    }

    const stealCount = same.length >= 3 ? 2 : 1;
    let got = 0;
    while (got < stealCount && target.hand.length) {
      const idx = Math.floor(Math.random() * target.hand.length);
      p.hand.push(target.hand.splice(idx, 1)[0]);
      got += 1;
    }
    this.log(`🐾 ${p.name} 用两张【${same[0].name}】发动组合，从 ${target.name} 手里拿走 ${got} 张牌！`);
    this.hooks.onState?.(this.state);
  }

  checkWinner() {
    const alive = this.state.players.filter(p => p.alive);
    if (alive.length === 1) {
      this.state.winner = alive[0].id;
      this.log(`🏆 ${alive[0].name} 获胜！`);
      this.hooks.onWin?.(alive[0]);
      return true;
    }
    return false;
  }

  restart(config = this.config) {
    this.config = config;
    this.state = this.createInitialState(config);
  }

  canUseCombo(playerIndex) {
    const hand = this.state.players[playerIndex].hand;
    const counts = {};
    hand.forEach(c => {
      if (c.type === CARD_TYPES.cat) counts[c.id] = (counts[c.id] || 0) + 1;
    });
    return Object.entries(counts).filter(([, n]) => n >= 2).map(([id, n]) => ({ id, count: n }));
  }

  getPublicState() {
    return this.state;
  }

  getPlayableCardIndexes(playerIndex) {
    const p = this.state.players[playerIndex];
    if (!p || !p.alive) return [];
    return p.hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !['bomb', 'defuse', 'counter'].includes(c.id) && c.type !== CARD_TYPES.cat)
      .map(({ i }) => i);
  }

  drawKnownDanger(playerIndex) {
    const p = this.state.players[playerIndex];
    return p.hand.some(c => c.id === 'foresee') && this.state.deck.slice(0, 3).some(c => c.id === 'bomb');
  }

  handLimitHint(playerIndex) {
    const n = this.state.players[playerIndex].hand.length;
    if (n >= 12) return '⚠️ 手牌很多，容易被索要或反制断节奏！';
    if (n >= 9) return '📦 手牌偏多，注意节奏。';
    return '';
  }

  aliveCount() {
    return this.state.players.filter(p => p.alive).length;
  }

  randomTargetFrom(playerIndex) {
    const opts = this.getAliveOpponents(playerIndex).filter(i => this.state.players[i].hand.length > 0);
    return opts.length ? sample(opts) : null;
  }
}
