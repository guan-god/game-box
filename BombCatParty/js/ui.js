import { CARD_DB, getCardTag } from './cards.js';

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null) continue;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

export function renderMenu(root, handlers) {
  root.innerHTML = '';
  const box = h('div', { class: 'menu panel' }, [
    h('div', { class: 'title' }, '爆裂猫团'),
    h('div', { class: 'subtitle' }, '原创派对卡牌：坑人、反制、翻盘与尖叫并存。'),
    h('div', { class: 'menu-grid' }, [
      h('button', { class: 'btn-main', onclick: () => handlers.start('ai') }, '开始游戏（快速人机）'),
      h('button', { class: 'btn-main', onclick: () => handlers.start('ai') }, '开始：人机对战'),
      h('button', { class: 'btn-main btn-sub', onclick: () => handlers.start('local') }, '开始：本地多人'),
      h('button', { class: 'btn-main btn-sub', onclick: handlers.rules }, '规则说明'),
      h('button', { class: 'btn-main btn-sub', onclick: handlers.settings }, '设置')
    ]),
    h('div', { class: 'tutorial-tip' }, '新手提示：每回合通常最后要抽牌，抽到爆裂猫就可能当场爆炸。')
  ]);
  root.appendChild(box);
}

export function renderSetup(root, mode, handlers) {
  root.innerHTML = '';
  const box = h('div', { class: 'setup panel' }, [
    h('h2', {}, mode === 'ai' ? '人机模式设置' : '本地多人设置'),
    h('div', { class: 'setup-row' }, [
      h('label', {}, '总人数：'),
      (() => {
        const select = h('select');
        [2, 3, 4, 5].forEach(n => select.appendChild(h('option', { value: n }, `${n} 人`)));
        select.value = mode === 'ai' ? 3 : 4;
        select.onchange = () => handlers.onPlayers(Number(select.value));
        return select;
      })()
    ]),
    h('div', { class: 'setup-row' }, [
      h('button', { class: 'btn-main', onclick: handlers.confirm }, '开始对局'),
      h('button', { class: 'btn-main btn-sub', onclick: handlers.back }, '返回菜单')
    ])
  ]);
  root.appendChild(box);
}

export function renderGame(root, state, viewerIndex, handlers) {
  root.innerHTML = '';
  const current = state.players[state.current];
  const viewer = state.players[viewerIndex];

  const playersPanel = h('div', { class: 'players panel' });
  state.players.forEach(p => {
    playersPanel.appendChild(h('div', {
      class: `player-chip ${state.current === p.id ? 'current' : ''} ${p.alive ? '' : 'dead'}`
    }, [
      h('div', {}, `${p.name} ${p.isHuman ? '🙂' : '🤖'}`),
      h('div', { class: 'meta' }, `手牌: ${p.hand.length} | ${p.alive ? '存活' : '淘汰'} ${state.current === p.id ? `| 回合:${p.turns}` : ''}`)
    ]));
  });

  const centerPanel = h('div', { class: 'center panel' }, [
    h('div', { class: 'center-stack' }, [
      h('div', { class: 'pile', id: 'deck-pile' }, ['牌库', h('div', { class: 'count' }, `${state.deck.length}`)]),
      h('div', { class: 'pile' }, [
        '弃牌堆',
        h('div', { class: 'count' }, `${state.discard.length}`),
        h('div', { style: 'position:absolute;top:8px;left:8px;font-size:22px' }, state.discard.at(-1)?.emoji || '🗑️')
      ])
    ]),
    h('div', { class: 'turn-info' }, [
      h('div', {}, `当前回合：${current.name}`),
      state.deck.length <= 6 ? h('div', { class: 'danger' }, '⚠️ 牌库快见底了，爆裂概率上升！') : null
    ])
  ]);

  const logPanel = h('div', { class: 'log-panel panel' });
  [...state.logs].reverse().slice(0, 60).forEach(it => logPanel.appendChild(h('div', { class: 'log-item' }, it)));

  const handPanel = h('div', { class: 'hand-panel panel' }, [
    h('h3', {}, `${viewer.name} 的手牌 (${viewer.hand.length})`),
    h('div', { class: 'hand-row' }, viewer.hand.map((card, i) => {
      const playable = handlers.isPlayable(i, card);
      return h('div', {
        class: `card ${getCardTag(card)} ${playable ? '' : 'disabled'}`,
        title: `${card.name}：${card.desc}`,
        onclick: () => playable && handlers.playCard(i, card)
      }, [
        h('div', { class: 'badge' }, card.emoji),
        h('div', { class: 'name' }, card.name),
        h('div', { class: 'type' }, card.type),
        h('div', { class: 'desc' }, card.desc)
      ]);
    }))
  ]);

  const actionBar = h('div', { class: 'hand-actions' }, [
    h('button', { class: 'inline-btn primary', onclick: handlers.draw }, '抽牌并结束小回合'),
    h('button', { class: 'inline-btn', onclick: handlers.combo }, '发动猫咪组合'),
    h('button', { class: 'inline-btn', onclick: handlers.restart }, '重新开始'),
    h('button', { class: 'inline-btn warn', onclick: handlers.backMenu }, '返回菜单')
  ]);
  handPanel.appendChild(actionBar);
  const hint = handlers.handHint();
  if (hint) handPanel.appendChild(h('div', { class: 'tutorial-tip' }, hint));

  const layout = h('div', { class: 'game-layout' }, [playersPanel, centerPanel, logPanel]);
  root.appendChild(layout);
  root.appendChild(handPanel);
}

let escHandler = null;

export function showModal(contentHtml, actions = [], options = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const onClose = options.onClose || (() => {});
    const close = () => {
      closeModal();
      onClose();
    };
    const body = h('div', { class: 'modal-mask' }, [
      h('div', { class: 'modal' }, [
        h('button', { class: 'modal-close', onclick: close, title: '关闭' }, '✕'),
        (() => {
          const c = h('div');
          c.innerHTML = contentHtml;
          return c;
        })(),
      h('div', { class: 'actions' }, actions.map(a => h('button', { class: a.className || 'inline-btn', onclick: a.onClick }, a.label)))
      ])
    ]);
    body.addEventListener('click', (e) => {
      if (e.target === body && options.closeOnMask !== false) close();
    });
    root.appendChild(body);

    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escHandler);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
}

export function showPassOverlay(playerName, onReady) {
  const old = document.getElementById('pass-overlay');
  if (old) old.remove();
  const box = h('div', { class: 'overlay-pass', id: 'pass-overlay' }, [
    h('div', { class: 'box' }, [
      h('h2', {}, '请下一位玩家接手'),
      h('p', {}, `接下来轮到 ${playerName}。请确认周围没有人偷看手牌。`),
      h('button', { class: 'btn-main', onclick: () => { box.remove(); onReady?.(); } }, '我已接手，开始操作')
    ])
  ]);
  document.body.appendChild(box);
}

export function showRules(onClose) {
  showModal(`
    <h2>规则说明</h2>
    <p>目标：活到最后。每位玩家轮流行动，通常通过<strong>抽一张牌</strong>结束当前小回合。</p>
    <ul>
      <li><strong>爆裂猫</strong>：抽到就危险；没有拆弹包则立刻淘汰。</li>
      <li><strong>拆弹包</strong>：化解爆裂猫，并决定把炸弹塞回牌库的位置。</li>
      <li><strong>连环攻击</strong>：让下家多一个小回合压力。</li>
      <li><strong>反制</strong>：可响应他人出牌；反制可再被反制，奇数层生效（取消原牌），偶数层失效。</li>
      <li><strong>猫咪组合</strong>：两张同名猫可发动偷牌，三张以上可增强。</li>
    </ul>
    <p>节目效果建议：在你怀疑顶部有炸弹时，先预知未来，再选择跳过、洗牌或攻击甩锅。</p>
  `, [{ label: '知道了', className: 'inline-btn primary', onClick: () => { closeModal(); onClose?.(); } }], { onClose });
}

export function showSettings(current, onSave, onClose) {
  const html = `
    <h2>设置</h2>
    <div class="setup-row"><label>音效：</label><select id="set-sound"><option value="on">开</option><option value="off">关</option></select></div>
    <div class="setup-row"><label>动画速度：</label><input id="set-speed" type="range" min="0.6" max="1.8" step="0.1" value="${current.speed}"><span id="set-speed-v">${current.speed.toFixed(1)}x</span></div>
  `;
  showModal(html, [
    { label: '取消', className: 'inline-btn', onClick: closeModal },
    { label: '保存', className: 'inline-btn primary', onClick: () => {
      const soundOn = document.getElementById('set-sound').value === 'on';
      const speed = Number(document.getElementById('set-speed').value);
      onSave?.({ soundOn, speed });
      closeModal();
      onClose?.();
    }}
  ], { onClose });

  document.getElementById('set-sound').value = current.soundOn ? 'on' : 'off';
  document.getElementById('set-speed').oninput = (e) => {
    document.getElementById('set-speed-v').textContent = `${Number(e.target.value).toFixed(1)}x`;
  };
}

export function promptChooseTarget(players, excludeId, title = '选择目标') {
  return new Promise(resolve => {
    const opts = players.filter(p => p.alive && p.id !== excludeId && p.hand.length > 0);
    if (!opts.length) return resolve(null);
    showModal(`<h2>${title}</h2><p>请选择一名玩家。</p>`, [
      ...opts.map(p => ({ label: `${p.name} (${p.hand.length})`, className: 'inline-btn', onClick: () => { closeModal(); resolve(p.id); } })),
      { label: '取消', className: 'inline-btn', onClick: () => { closeModal(); resolve(null); } }
    ]);
  });
}

export function promptDefusePos(deckLen) {
  return new Promise(resolve => {
    showModal(`<h2>拆弹成功！</h2><p>请选择把爆裂猫塞回牌库的位置：</p>`, [
      { label: '顶部', className: 'inline-btn', onClick: () => { closeModal(); resolve(0); } },
      { label: '中间', className: 'inline-btn', onClick: () => { closeModal(); resolve(Math.floor(deckLen / 2)); } },
      { label: '底部', className: 'inline-btn', onClick: () => { closeModal(); resolve(deckLen); } },
      { label: '自定义', className: 'inline-btn primary', onClick: () => {
        const val = prompt(`输入 1 ~ ${deckLen + 1} 的位置`, '1');
        const num = Math.max(1, Math.min(deckLen + 1, Number(val) || 1));
        closeModal();
        resolve(num - 1);
      } }
    ]);
  });
}

export function showFutureCards(cards) {
  showModal(`<h2>预知未来</h2><p>接下来顶部三张：</p>
  <div class="setup-row">${cards.map(c => `<div class='card ${getCardTag(c)}'><div class='badge'>${c.emoji}</div><div class='name'>${c.name}</div><div class='desc'>${c.desc}</div></div>`).join('')}</div>`, [
    { label: '收好情报', className: 'inline-btn primary', onClick: closeModal }
  ], { closeOnMask: false });
}

export function showWinner(playerName, onRestart, onMenu) {
  showModal(`<h2>🎉 ${playerName} 获胜！</h2><p>本局结束，想继续整活吗？</p>`, [
    { label: '再来一局', className: 'inline-btn primary', onClick: () => { closeModal(); onRestart?.(); } },
    { label: '返回菜单', className: 'inline-btn', onClick: () => { closeModal(); onMenu?.(); } }
  ]);
}

export function showTutorialOnce() {
  const key = 'bomb-cat-tutorial-v1';
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  showModal(`<h2>欢迎来到爆裂猫团</h2>
    <ol>
      <li>先尝试打出预知未来，再决定要不要抽牌。</li>
      <li>记得留一张反制，关键时刻能保命。</li>
      <li>本地多人会在每回合切换时遮罩防偷看。</li>
    </ol>`,
    [{ label: '开整！', className: 'inline-btn primary', onClick: closeModal }]);
}

export { CARD_DB };
