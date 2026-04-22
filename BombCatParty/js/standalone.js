(() => {
  window.__bombBooted = true;

  const CARD_DEF = {
    kitten: { id: 'kitten', name: '爆裂猫', type: 'kitten', emoji: '💣', desc: '抽到且无法拆弹则淘汰。' },
    defuse: { id: 'defuse', name: '拆弹', type: 'action', emoji: '🧯', desc: '仅在抽到爆裂猫时救命。' },
    attack: { id: 'attack', name: '连环攻击', type: 'action', emoji: '⚔️', desc: '结束回合，下家承担额外回合。' },
    favor: { id: 'favor', name: '索要', type: 'action', emoji: '🎁', desc: '指定玩家交给你1张牌。' },
    nope: { id: 'nope', name: '反制', type: 'nope', emoji: '🛑', desc: '打断动作（不可打断炸弹/拆弹）。' },
    shuffle: { id: 'shuffle', name: '洗牌', type: 'action', emoji: '🌀', desc: '重新洗牌。' },
    skip: { id: 'skip', name: '跳过', type: 'action', emoji: '⏭️', desc: '结束当前回合且不抽牌。' },
    future: { id: 'future', name: '预知未来', type: 'action', emoji: '🔮', desc: '查看牌库顶3张。' },
    cat_a: { id: 'cat_a', name: '胡子队长', type: 'cat', emoji: '😼', desc: '组合牌。' },
    cat_b: { id: 'cat_b', name: '毛线狂魔', type: 'cat', emoji: '🧶', desc: '组合牌。' },
    cat_c: { id: 'cat_c', name: '罐头骑士', type: 'cat', emoji: '🥫', desc: '组合牌。' },
    cat_d: { id: 'cat_d', name: '激光团长', type: 'cat', emoji: '🔦', desc: '组合牌。' },
    cat_e: { id: 'cat_e', name: '飞饼喵喵', type: 'cat', emoji: '🥏', desc: '组合牌。' }
  };

  const DECK_COUNTS = {
    kitten: 4, defuse: 6, attack: 4, favor: 4, nope: 5,
    shuffle: 4, skip: 4, future: 5,
    cat_a: 4, cat_b: 4, cat_c: 4, cat_d: 4, cat_e: 4
  };

  const $ = (id) => document.getElementById(id);
  const cloneCard = (id) => ({ uid: `${id}_${Math.random().toString(36).slice(2, 8)}`, ...CARD_DEF[id] });
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const nextAlive = (players, i) => { let idx=i; for(let k=0;k<players.length;k++){ idx=(idx+1)%players.length; if(players[idx].alive) return idx; } return i; };

  const app = {
    screen: 'menu',
    mode: 'ai',
    setupPlayers: 3,
    game: null,
    viewer: 0,
    pendingUI: null,
    modal: null,
    debug: location.hostname === 'localhost' || location.search.includes('debug=1')
  };

  function initGame(mode, count) {
    const players = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: mode === 'local' ? `玩家${i + 1}` : (i === 0 ? '你' : `AI-${i}`),
      isHuman: mode === 'local' ? true : i === 0,
      alive: true,
      hand: [],
      graveyard: [],
      pendingTurns: 0
    }));

    let pool = [];
    Object.entries(DECK_COUNTS).forEach(([id, n]) => {
      for (let i = 0; i < n; i++) pool.push(cloneCard(id));
    });

    // 按原版流程：拿出全部炸弹和拆弹
    const kittens = pool.filter(c => c.id === 'kitten');
    pool = pool.filter(c => c.id !== 'kitten');
    let defuses = pool.filter(c => c.id === 'defuse');
    pool = pool.filter(c => c.id !== 'defuse');

    // 每人1拆弹
    players.forEach(p => p.hand.push(defuses.pop()));

    // 每人再发7
    pool = shuffle(pool);
    for (let r = 0; r < 7; r++) players.forEach(p => p.hand.push(pool.pop()));

    // 炸弹洗回 玩家数-1 张
    const needKittens = count - 1;
    const usedKittens = kittens.slice(0, needKittens);

    // 额外拆弹：通常2张，5人局1张
    const extraDefuseCount = count === 5 ? 1 : 2;
    const extraDefuses = defuses.slice(0, extraDefuseCount);

    const deck = shuffle([...pool, ...usedKittens, ...extraDefuses]);

    const game = {
      mode,
      players,
      deck,
      discard: [],
      current: 0,
      logs: ['🎉 开局完成：每人8张（含1张拆弹）。'],
      status: '你的回合：可以打任意牌，最后抽1张结束回合。',
      winner: null,
      resolving: false,
      passRequired: mode === 'local',
      seenFuture: null
    };

    game.players[0].pendingTurns = 1;
    return game;
  }

  function log(msg) {
    app.game.logs.push(msg);
    if (app.game.logs.length > 120) app.game.logs.shift();
  }

  function setScreen(screen) {
    app.screen = screen;
    render();
  }

  function openModal(type) { app.modal = type; render(); }
  function closeModal() { app.modal = null; render(); }

  function render() {
    ['menu', 'setup', 'game'].forEach(s => $(`${s}-screen`).classList.toggle('active', app.screen === s));
    if (app.screen === 'menu') renderMenu();
    if (app.screen === 'setup') renderSetup();
    if (app.screen === 'game') renderGame();
    renderModal();
    renderDebug();
  }

  function renderMenu() {
    $('menu-screen').innerHTML = `<div class="menu panel">
      <div class="title">爆裂猫团</div>
      <div class="subtitle">规则机制对齐基础版：抽牌、炸弹、拆弹、Nope连锁、组合技。</div>
      <div class="menu-grid">
        <button id="menu-ai" class="btn-main">人机对战</button>
        <button id="menu-local" class="btn-main btn-sub">本地多人 Hotseat</button>
        <button id="menu-rules" class="btn-main btn-sub">规则说明</button>
        <button id="menu-settings" class="btn-main btn-sub">设置</button>
      </div>
    </div>`;
    $('menu-ai').onclick = () => { app.mode = 'ai'; app.setupPlayers = 3; setScreen('setup'); };
    $('menu-local').onclick = () => { app.mode = 'local'; app.setupPlayers = 4; setScreen('setup'); };
    $('menu-rules').onclick = () => openModal('rules');
    $('menu-settings').onclick = () => openModal('settings');
  }

  function renderSetup() {
    $('setup-screen').innerHTML = `<div class="setup panel">
      <h2>${app.mode === 'ai' ? '人机模式' : '本地多人'}设置</h2>
      <div class="setup-row"><label>人数：</label><select id="setup-count">${[2,3,4,5].map(n => `<option value="${n}" ${n===app.setupPlayers?'selected':''}>${n}人</option>`).join('')}</select></div>
      <div class="setup-row">
        <button id="setup-start" class="btn-main">开始对局</button>
        <button id="setup-back" class="btn-main btn-sub">返回菜单</button>
      </div>
    </div>`;
    $('setup-count').onchange = (e) => app.setupPlayers = Number(e.target.value);
    $('setup-start').onclick = () => { app.game = initGame(app.mode, app.setupPlayers); app.viewer = 0; setScreen('game'); loopAi(); };
    $('setup-back').onclick = () => setScreen('menu');
  }

  function renderGame() {
    const g = app.game;
    if (!g) {
      $('game-screen').innerHTML = `<div class="panel error-card">主菜单加载失败<br>当前界面状态：${app.screen}</div>`;
      return;
    }
    const current = g.players[g.current];
    const viewer = g.players[app.viewer];

    $('game-screen').innerHTML = `
      <div class="panel" style="padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div><strong>当前玩家：</strong>${current.name}</div>
        <div><strong>待执行回合：</strong>${current.pendingTurns || 1}</div>
        <div><strong>牌库：</strong>${g.deck.length}</div>
        <div style="color:#ffe9a6;">${g.status}</div>
      </div>
      <div class="game-layout">
        <div class="players panel">
          ${g.players.map(p => `<div class="player-chip ${p.id===g.current?'current':''} ${p.alive?'':'dead'} ${app.pendingUI?.targetable?.includes(p.id)?'targetable':''}">
            <div>${p.name} ${p.isHuman?'🙂':'🤖'}</div>
            <div class="meta">手牌:${p.hand.length} | ${p.alive?'存活':'淘汰'}</div>
            ${app.pendingUI?.targetable?.includes(p.id)?`<button class="inline-btn" data-target="${p.id}">选中</button>`:''}
          </div>`).join('')}
        </div>
        <div class="center panel">
          <div class="center-stack">
            <div class="pile" id="deck-pile">抽牌堆<div class="count">${g.deck.length}</div></div>
            <div class="pile">弃牌堆<div class="count">${g.discard.length}</div><div style="position:absolute;top:8px;left:8px;font-size:20px;">${g.discard.at(-1)?.emoji || '🗑️'}</div></div>
          </div>
          ${g.seenFuture ? `<div class="panel" style="padding:8px;margin:8px;background:#ffffff10;">预知未来：${g.seenFuture.map(c => `${c.emoji}${c.name}`).join(' / ')}</div>` : ''}
        </div>
        <div class="log-panel panel">${[...g.logs].reverse().slice(0, 80).map(x => `<div class="log-item">${x}</div>`).join('')}</div>
      </div>
      <div class="hand-panel panel">
        <h3>${viewer.name} 的手牌（${viewer.hand.length}）</h3>
        <div class="hand-row">${viewer.hand.map((c, i) => `<div class="card ${c.type==='cat'?'collect':(c.id==='nope'?'reactive':'action')} ${(canClickCard(c,i)?'':'disabled')}" data-hand="${i}"><div class="badge">${c.emoji}</div><div class="name">${c.name}</div><div class="type">${c.type}</div><div class="desc">${c.desc}</div></div>`).join('')}</div>
        <div class="hand-actions">
          <button class="inline-btn primary" id="btn-draw">抽1张结束回合</button>
          <button class="inline-btn" id="btn-combo2">两张同名组合</button>
          <button class="inline-btn" id="btn-combo3">三张同名点名</button>
          <button class="inline-btn" id="btn-restart">重开</button>
          <button class="inline-btn warn" id="btn-menu">菜单</button>
        </div>
        ${renderPendingActionBar()}
      </div>
    `;

    $('game-screen').querySelectorAll('[data-target]').forEach(btn => {
      btn.onclick = () => app.pendingUI?.onTarget?.(Number(btn.dataset.target));
    });

    $('game-screen').querySelectorAll('[data-hand]').forEach(el => {
      el.onclick = async () => {
        const i = Number(el.dataset.hand);
        const p = g.players[g.current];
        if (!p.isHuman || p.id !== app.viewer || p.id !== current.id) return;
        await playCard(i);
        render();
        loopAi();
      };
    });

    $('btn-draw').onclick = async () => { if (!isMyTurn()) return; await drawAndEndTurn(); render(); loopAi(); };
    $('btn-combo2').onclick = () => startCombo(2);
    $('btn-combo3').onclick = () => startCombo(3);
    $('btn-restart').onclick = () => { app.game = initGame(app.mode, app.setupPlayers); app.viewer = 0; render(); loopAi(); };
    $('btn-menu').onclick = () => setScreen('menu');
  }

  function renderPendingActionBar() {
    if (!app.pendingUI) return '';
    if (app.pendingUI.type === 'choose_target') {
      return `<div class="panel" style="margin-top:8px;padding:8px;border:1px solid #ffd16666;">${app.pendingUI.text}（点击左侧玩家的“选中”）<button class="inline-btn" id="pending-cancel">取消</button></div>`;
    }
    if (app.pendingUI.type === 'choose_card_from_self') {
      const cards = app.game.players[app.pendingUI.playerId].hand;
      return `<div class="panel" style="margin-top:8px;padding:8px;border:1px solid #7ee0ff66;">请选择要交出的牌：${cards.map((c,idx)=>`<button class='inline-btn' data-give='${idx}'>${c.emoji}${c.name}</button>`).join('')}</div>`;
    }
    if (app.pendingUI.type === 'defuse_insert') {
      const len = app.game.deck.length;
      return `<div class="panel" style="margin-top:8px;padding:8px;border:1px solid #73ffa066;">拆弹成功：选择把炸弹放回位置
        <input id="defuse-pos" type="range" min="0" max="${len}" value="0" style="width:220px;vertical-align:middle;">
        <span id="defuse-pos-label">顶部(1/${len+1})</span>
        <button class="inline-btn primary" id="defuse-confirm">确认</button>
      </div>`;
    }
    if (app.pendingUI.type === 'nope_decision') {
      return `<div class="panel" style="margin-top:8px;padding:8px;border:1px solid #ff9f9f66;">${app.pendingUI.text}
        <button class="inline-btn" id="nope-no">放过</button>
        <button class="inline-btn warn" id="nope-yes">打出 Nope</button>
      </div>`;
    }
    return '';
  }

  function bindPendingBar() {
    if (!app.pendingUI) return;
    if (app.pendingUI.type === 'choose_target') {
      $('pending-cancel')?.addEventListener('click', () => app.pendingUI.onCancel?.());
    }
    if (app.pendingUI.type === 'choose_card_from_self') {
      document.querySelectorAll('[data-give]').forEach(b => {
        b.onclick = () => app.pendingUI.onChoose(Number(b.dataset.give));
      });
    }
    if (app.pendingUI.type === 'defuse_insert') {
      const slider = $('defuse-pos');
      const label = $('defuse-pos-label');
      slider.oninput = () => {
        const pos = Number(slider.value);
        const total = app.game.deck.length + 1;
        label.textContent = pos === 0 ? `顶部(1/${total})` : (pos === app.game.deck.length ? `底部(${total}/${total})` : `位置 ${pos+1}/${total}`);
      };
      $('defuse-confirm').onclick = () => app.pendingUI.onConfirm(Number(slider.value));
    }
    if (app.pendingUI.type === 'nope_decision') {
      $('nope-no').onclick = () => app.pendingUI.resolve(false);
      $('nope-yes').onclick = () => app.pendingUI.resolve(true);
    }
  }

  function canClickCard(card, idx) {
    if (!isMyTurn()) return false;
    if (app.pendingUI) return false;
    const p = app.game.players[app.game.current];
    return idx >= 0 && p.alive && card.id !== 'kitten' && card.id !== 'defuse';
  }

  function isMyTurn() {
    const g = app.game; if (!g) return false;
    const p = g.players[g.current];
    return p.alive && p.isHuman && p.id === app.viewer && !g.resolving;
  }

  async function waitPending(setup) {
    return new Promise(resolve => {
      app.pendingUI = setup(resolve);
      render();
      bindPendingBar();
    });
  }

  async function resolveNopeChain(sourcePlayerId, actionName) {
    let chain = 0;
    let cursor = sourcePlayerId;

    while (true) {
      let played = false;
      for (let step = 1; step < app.game.players.length; step++) {
        const idx = (cursor + step) % app.game.players.length;
        const p = app.game.players[idx];
        if (!p.alive) continue;
        const nopeIndex = p.hand.findIndex(c => c.id === 'nope');
        if (nopeIndex < 0) continue;

        let willNope = false;
        if (p.isHuman) {
          if (app.game.mode === 'local' && app.viewer !== p.id) {
            await hotseatSwitch(p.id);
          }
          willNope = await waitPending(resolve => ({
            type: 'nope_decision',
            text: `${p.name}：是否对「${actionName}」打出 Nope？`,
            resolve
          }));
          app.pendingUI = null;
        } else {
          willNope = Math.random() < 0.45;
          await sleep(200);
        }

        if (willNope) {
          const used = p.hand.splice(nopeIndex, 1)[0];
          app.game.discard.push(used);
          chain += 1;
          cursor = idx;
          played = true;
          log(`🛑 ${p.name} 打出 Nope（连锁${chain}）`);
          render();
          break;
        }
      }
      if (!played) break;
    }
    return chain % 2 === 1;
  }

  async function playCard(handIndex) {
    const g = app.game;
    const p = g.players[g.current];
    const card = p.hand[handIndex];
    if (!card) return;

    // Nope 在非轮到自己时不从这里打
    if (card.id === 'nope') return;

    // 组合牌单打无效果，不允许直接打出
    if (card.type === 'cat') {
      g.status = '猫咪单打无效果，请用组合按钮。';
      return;
    }

    // 炸弹/拆弹不能主动打
    if (['kitten', 'defuse'].includes(card.id)) return;

    const cancelled = await resolveNopeChain(p.id, card.name);
    const used = p.hand.splice(handIndex, 1)[0];
    g.discard.push(used);

    if (cancelled) {
      log(`🚫 ${card.name} 被 Nope 取消。`);
      return;
    }

    log(`🃏 ${p.name} 打出 ${card.name}`);

    if (card.id === 'skip') {
      consumeOneTurnAndAdvance();
      return;
    }

    if (card.id === 'attack') {
      const next = nextAlive(g.players, g.current);
      const transfer = (p.pendingTurns || 1) + 2;
      g.players[next].pendingTurns += transfer;
      p.pendingTurns = 0;
      log(`⚔️ 攻击生效：${g.players[next].name} 待执行回合 +${transfer}`);
      g.current = next;
      if (g.players[g.current].pendingTurns <= 0) g.players[g.current].pendingTurns = 1;
      g.status = `轮到 ${g.players[g.current].name}`;
      if (g.mode === 'local') g.passRequired = true;
      return;
    }

    if (card.id === 'future') {
      g.seenFuture = g.deck.slice(0, 3);
      g.status = '你看了未来3张牌（仅自己可见）。';
      return;
    }

    if (card.id === 'shuffle') {
      g.deck = shuffle(g.deck);
      g.seenFuture = null;
      g.status = '牌库已洗牌。';
      return;
    }

    if (card.id === 'favor') {
      const targetId = await chooseTargetFromAlive('选择一个目标玩家索要1张牌');
      if (targetId == null) return;
      const t = g.players[targetId];
      if (!t.hand.length) {
        g.status = `${t.name} 没有手牌。`;
        return;
      }
      if (t.isHuman) {
        if (g.mode === 'local' && app.viewer !== t.id) await hotseatSwitch(t.id);
        const chosen = await waitPending(resolve => ({
          type: 'choose_card_from_self',
          playerId: t.id,
          onChoose: (idx) => resolve(idx)
        }));
        app.pendingUI = null;
        const cardGive = t.hand.splice(chosen, 1)[0];
        p.hand.push(cardGive);
      } else {
        const rand = Math.floor(Math.random() * t.hand.length);
        p.hand.push(t.hand.splice(rand, 1)[0]);
      }
      log(`🎁 ${t.name} 交给 ${p.name} 1张牌。`);
      g.status = '索要完成。';
    }
  }

  async function drawAndEndTurn() {
    const g = app.game;
    const p = g.players[g.current];

    const card = g.deck.shift();
    if (!card) return;

    log(`🎴 ${p.name} 抽到1张牌。`);
    g.seenFuture = null;

    if (card.id !== 'kitten') {
      p.hand.push(card);
      consumeOneTurnAndAdvance();
      return;
    }

    log(`💣 ${p.name} 抽到了爆裂猫！`);
    const defuseIdx = p.hand.findIndex(c => c.id === 'defuse');
    if (defuseIdx < 0) {
      p.alive = false;
      p.graveyard = [...p.hand];
      p.hand = [];
      g.discard.push(card);
      log(`💥 ${p.name} 没有拆弹，已淘汰。`);
      checkWinner();
      if (!g.winner) advanceToNextAlive();
      return;
    }

    // 使用拆弹：defuse入弃牌，炸弹插回牌库任意位置
    const defuse = p.hand.splice(defuseIdx, 1)[0];
    g.discard.push(defuse);
    g.status = '拆弹中：选择把炸弹插回牌库的位置。';
    const insertPos = p.isHuman ? await waitPending(resolve => ({
      type: 'defuse_insert',
      onConfirm: resolve
    })) : Math.floor(Math.random() * (g.deck.length + 1));
    app.pendingUI = null;
    g.deck.splice(insertPos, 0, card);
    log(`🧯 ${p.name} 成功拆弹并把炸弹插回牌库。`);
    consumeOneTurnAndAdvance();
  }

  function consumeOneTurnAndAdvance() {
    const g = app.game;
    const p = g.players[g.current];
    p.pendingTurns = Math.max(0, (p.pendingTurns || 1) - 1);
    if (p.pendingTurns > 0) {
      g.status = `${p.name} 还有 ${p.pendingTurns} 个待执行回合。`;
      return;
    }
    advanceToNextAlive();
  }

  function advanceToNextAlive() {
    const g = app.game;
    g.current = nextAlive(g.players, g.current);
    if (g.players[g.current].pendingTurns <= 0) g.players[g.current].pendingTurns = 1;
    g.status = `轮到 ${g.players[g.current].name}`;
    if (g.mode === 'local') g.passRequired = true;
  }

  async function chooseTargetFromAlive(text) {
    const alive = app.game.players.filter(x => x.alive && x.id !== app.game.current).map(x => x.id);
    if (!alive.length) return null;
    return waitPending(resolve => ({
      type: 'choose_target',
      text,
      targetable: alive,
      onTarget: (id) => resolve(id),
      onCancel: () => resolve(null)
    })).then(v => { app.pendingUI = null; return v; });
  }

  async function startCombo(size) {
    if (!isMyTurn()) return;
    const g = app.game;
    const p = g.players[g.current];

    const counts = {};
    p.hand.forEach(c => counts[c.id] = (counts[c.id] || 0) + 1);
    const options = Object.keys(counts).filter(id => counts[id] >= size && !['kitten','defuse'].includes(id));
    if (!options.length) {
      g.status = `没有可用的 ${size} 张同名组合。`;
      render();
      return;
    }

    const comboId = options[0];

    const cancelled = await resolveNopeChain(p.id, `${size}张同名组合`);
    for (let i = 0; i < size; i++) {
      const idx = p.hand.findIndex(c => c.id === comboId);
      g.discard.push(p.hand.splice(idx, 1)[0]);
    }

    if (cancelled) {
      log('🚫 组合技被 Nope。');
      render();
      return;
    }

    if (size === 2) {
      const targetId = await chooseTargetFromAlive('两张同名：选择目标，随机偷1张');
      if (targetId == null) return;
      const t = g.players[targetId];
      if (!t.hand.length) {
        g.status = `${t.name} 没有手牌。`;
        return;
      }
      const rand = Math.floor(Math.random() * t.hand.length);
      p.hand.push(t.hand.splice(rand, 1)[0]);
      log(`🕵️ ${p.name} 用两张同名从 ${t.name} 随机偷了1张牌。`);
      return;
    }

    // size === 3
    const targetId = await chooseTargetFromAlive('三张同名：选择目标并点名想要的牌');
    if (targetId == null) return;
    const t = g.players[targetId];
    const requestId = Object.keys(CARD_DEF).find(id => !['kitten'].includes(id)) || 'skip';
    const have = t.hand.findIndex(c => c.id === requestId);
    if (have >= 0) {
      p.hand.push(t.hand.splice(have, 1)[0]);
      log(`🎯 ${p.name} 点名【${CARD_DEF[requestId].name}】成功，${t.name} 交出该牌。`);
    } else {
      log(`❌ ${p.name} 点名失败，${t.name} 没有【${CARD_DEF[requestId].name}】。`);
    }
  }

  function checkWinner() {
    const alive = app.game.players.filter(p => p.alive);
    if (alive.length === 1) {
      app.game.winner = alive[0].id;
      openModal('result');
      return true;
    }
    return false;
  }

  async function hotseatSwitch(nextViewer) {
    if (app.mode !== 'local') return;
    return new Promise(resolve => {
      app.modal = { type: 'pass', nextViewer, resolve };
      render();
    });
  }

  async function loopAi() {
    const g = app.game;
    if (!g || g.resolving || g.winner != null) return;

    while (true) {
      if (g.winner != null) return;
      const p = g.players[g.current];
      if (!p.alive) { advanceToNextAlive(); continue; }

      if (g.mode === 'local' && g.passRequired) {
        await hotseatSwitch(g.current);
        g.passRequired = false;
      }

      if (p.isHuman && app.viewer === p.id) {
        render();
        bindPendingBar();
        return;
      }

      // AI turn
      g.status = `${p.name} 思考中...`;
      render();
      await sleep(250);

      const idx = (id) => p.hand.findIndex(c => c.id === id);
      const top3 = g.deck.slice(0, 3).map(c => c.id);
      const danger = top3.includes('kitten');

      if (danger && idx('future') >= 0) await playCard(idx('future'));
      else if (danger && idx('shuffle') >= 0) await playCard(idx('shuffle'));
      else if (danger && idx('skip') >= 0) await playCard(idx('skip'));
      else if (idx('attack') >= 0 && Math.random() < 0.4) await playCard(idx('attack'));
      else if (idx('favor') >= 0 && Math.random() < 0.35) await playCard(idx('favor'));
      else await drawAndEndTurn();

      if (checkWinner()) return;
      render();
      await sleep(200);
    }
  }

  function renderModal() {
    const root = $('modal-root');
    root.innerHTML = '';
    const modal = app.modal;
    if (!modal) return;

    const wrap = document.createElement('div');
    wrap.className = 'modal-mask';
    const box = document.createElement('div');
    box.className = 'modal';

    const closeBtn = `<button class="modal-close" id="modal-close">✕</button>`;

    if (modal === 'rules') {
      box.innerHTML = `${closeBtn}<h2>规则说明（基础版对齐）</h2><ul>
        <li>你的回合可打任意牌，最后必须抽1张结束回合。</li>
        <li>抽到爆裂猫必须立刻处理：有拆弹可活，否则淘汰。</li>
        <li>Attack：结束回合不抽牌，并把回合压力叠给下家。</li>
        <li>Skip：结束当前1个待执行回合，不抽牌。</li>
        <li>Nope 可打断动作，可打断 Nope，但不能打断爆裂猫与拆弹。</li>
        <li>两张同名：随机偷牌；三张同名：点名索牌。</li>
      </ul>`;
      wrap.appendChild(box); root.appendChild(wrap);
      $('modal-close').onclick = () => closeModal();
      return;
    }

    if (modal === 'settings') {
      box.innerHTML = `${closeBtn}<h2>设置</h2><p>当前版本保留轻量设置入口。</p><button id="modal-ok" class="inline-btn primary">关闭</button>`;
      wrap.appendChild(box); root.appendChild(wrap);
      $('modal-close').onclick = () => closeModal();
      $('modal-ok').onclick = () => closeModal();
      return;
    }

    if (modal?.type === 'pass') {
      box.innerHTML = `<h2>请下一位玩家接手</h2><p>接下来轮到 ${app.game.players[modal.nextViewer].name}</p><button id="pass-ok" class="btn-main">我准备好了</button>`;
      wrap.appendChild(box); root.appendChild(wrap);
      $('pass-ok').onclick = () => {
        app.viewer = modal.nextViewer;
        app.modal = null;
        modal.resolve();
        render();
      };
      return;
    }

    if (modal === 'result') {
      const winner = app.game.players[app.game.winner];
      box.innerHTML = `<h2>🏆 ${winner.name} 获胜</h2><button id="result-restart" class="inline-btn primary">再来一局</button><button id="result-menu" class="inline-btn">返回菜单</button>`;
      wrap.appendChild(box); root.appendChild(wrap);
      $('result-restart').onclick = () => { app.game = initGame(app.mode, app.setupPlayers); app.viewer = 0; app.modal = null; render(); loopAi(); };
      $('result-menu').onclick = () => { app.modal = null; setScreen('menu'); };
    }
  }

  function renderDebug() {
    const old = $('debug-panel');
    if (old) old.remove();
    if (!app.debug) return;
    const d = document.createElement('div');
    d.id = 'debug-panel';
    d.className = 'debug-panel';
    d.innerHTML = `screen:<b>${app.screen}</b><br>modal:<b>${typeof app.modal === 'string' ? app.modal : (app.modal?.type || 'none')}</b><br>pendingUI:<b>${app.pendingUI?.type || 'none'}</b>`;
    document.body.appendChild(d);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (app.modal === 'rules' || app.modal === 'settings')) {
      closeModal();
    }
  });

  $('btn-rules').onclick = () => openModal('rules');
  $('btn-settings').onclick = () => openModal('settings');

  setScreen('menu');

  // 每次渲染后绑定内联操作条事件
  const rawRender = render;
  render = function patchedRender() {
    rawRender();
    bindPendingBar();
  };
  render();
})();
