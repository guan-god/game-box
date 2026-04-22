export const CARD_TYPES = {
  bomb: 'bomb',
  defuse: 'defuse',
  skip: 'skip',
  attack: 'attack',
  foresee: 'foresee',
  shuffle: 'shuffle',
  favor: 'favor',
  counter: 'counter',
  cat: 'cat'
};

const CATS = [
  ['cat_ramen', '拉面猫', '🍜', '吃面时会瞬移到你口袋偷牌。'],
  ['cat_drama', '戏精猫', '🎭', '会当场表演“你不抽牌我就闹”。'],
  ['cat_rocket', '火箭猫', '🚀', '擅长把队友送进危险区。'],
  ['cat_pickle', '腌黄瓜猫', '🥒', '味道奇怪但超会薅别人手牌。'],
  ['cat_toast', '吐司猫', '🍞', '看起来温顺，其实很记仇。']
];

export const CARD_DB = {
  bomb: { id: 'bomb', name: '爆裂猫', type: CARD_TYPES.bomb, emoji: '💣', desc: '抽到时若没有拆弹包，立即淘汰。' },
  defuse: { id: 'defuse', name: '拆弹包', type: CARD_TYPES.defuse, emoji: '🧯', desc: '可化解爆裂猫并将其塞回牌库。' },
  skip: { id: 'skip', name: '跳过', type: CARD_TYPES.skip, emoji: '⏭️', desc: '结束当前这一小回合，不抽牌。' },
  attack: { id: 'attack', name: '连环攻击', type: CARD_TYPES.attack, emoji: '⚔️', desc: '下一名玩家需要完成2个小回合。' },
  foresee: { id: 'foresee', name: '预知未来', type: CARD_TYPES.foresee, emoji: '🔮', desc: '查看牌库顶部3张牌。' },
  shuffle: { id: 'shuffle', name: '洗牌', type: CARD_TYPES.shuffle, emoji: '🌀', desc: '随机打乱整个牌库。' },
  favor: { id: 'favor', name: '索要', type: CARD_TYPES.favor, emoji: '🫴', desc: '指定目标随机交给你1张手牌。' },
  counter: { id: 'counter', name: '反制', type: CARD_TYPES.counter, emoji: '🛑', desc: '响应其他牌，令其无效。可连锁反制。' }
};

for (const [id, name, emoji, desc] of CATS) {
  CARD_DB[id] = { id, name, type: CARD_TYPES.cat, emoji, desc };
}

export function makeCard(id) {
  const base = CARD_DB[id];
  return {
    uid: `${id}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`,
    ...base
  };
}

export function buildDeck(playerCount) {
  const deckIds = [];

  const pushMany = (id, n) => { for (let i = 0; i < n; i++) deckIds.push(id); };
  pushMany('skip', 6);
  pushMany('attack', 5);
  pushMany('foresee', 5);
  pushMany('shuffle', 4);
  pushMany('favor', 4);
  pushMany('counter', 6);

  for (const catId of Object.keys(CARD_DB).filter(k => CARD_DB[k].type === CARD_TYPES.cat)) {
    pushMany(catId, 4);
  }

  pushMany('defuse', Math.max(2, 6 - playerCount));
  pushMany('bomb', playerCount - 1);

  return deckIds.map(makeCard);
}

export function getCardTag(card) {
  if (card.type === CARD_TYPES.cat) return 'collect';
  if (card.type === CARD_TYPES.counter) return 'reactive';
  return 'action';
}
