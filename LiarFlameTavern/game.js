(() => {
  const CARD_VALUES = ['K', 'Q', 'A'];
  const PERSONALITIES = {
    aggro: { name: '激进型', bluff: 0.72, challenge: 0.35 },
    calm: { name: '保守型', bluff: 0.28, challenge: 0.48 },
    actor: { name: '演技型', bluff: 0.55, challenge: 0.42 },
    mad: { name: '疯狗型', bluff: 0.62, challenge: 0.75 }
  };

  const app = {
    screen: 'menu',
    mode: 'pve',
    setupPlayers: 4,
    game: null,
    viewer: 0,
    settings: { soundOn: true, speed: 1 },
    modal: null,
    pending: null,
    debug: location.hostname === 'localhost' || location.search.includes('debug=1')
  };

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
  const nextAlive = (players, idx) => { let i=idx; for(let k=0;k<players.length;k++){ i=(i+1)%players.length; if(players[i].alive) return i; } return idx; };
  const aliveCount = (players) => players.filter(p => p.alive).length;

  function makeDeck() {
    const deck = [];
    for (const v of CARD_VALUES) for (let i = 0; i < 14; i++) deck.push({ kind: 'normal', value: v, name: v });
    return shuffle(deck.map((c, i) => ({ ...c, uid: `${c.kind}_${i}_${Math.random().toString(36).slice(2, 7)}` })));
  }

  function newRoundTarget(prev) {
    const options = CARD_VALUES.filter(v => v !== prev);
    return options[Math.floor(Math.random() * options.length)];
  }

  function initGame(mode, count) {
    const names = ['你', '铁爪', '霓虹', '裂齿'];
    const aiTypes = ['aggro', 'calm', 'actor', 'mad'];
    const players = Array.from({ length: count }, (_, i) => {
      const isHuman = mode === 'local' ? true : i === 0;
      return {
        id: i,
        name: mode === 'local' ? `玩家${i + 1}` : names[i],
        isHuman,
        aiType: isHuman ? null : aiTypes[i - 1],
        alive: true,
        hand: [],
        bluffCount: 0,
        challengeWin: 0,
        challengeLose: 0,
        survivedPenalty: 0
      };
    });

    let deck = makeDeck();
    for (let i = 0; i < 6; i++) {
      players.forEach(p => p.hand.push(deck.pop()));
    }

    return {
      mode,
      players,
      deck,
      discard: [],
      tablePile: [], // {owner, cards, claim}
      current: 0,
      target: CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)],
      log: ['🎲 赌局开始。'],
      status: '出1~3张牌并宣称为目标牌值。',
      winner: null,
      revealCards: [],
      waitingChallengeFrom: null,
      busy: false,
      passNeeded: mode === 'local'
    };
  }

  function addLog(msg) {
    app.game.log.push(msg);
    if (app.game.log.length > 120) app.game.log.shift();
  }

  function toast(msg) {
    const root = $('toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function setScreen(s) { app.screen = s; render(); }

  function render() {
    ['menu', 'setup', 'game'].forEach(k => $(`${k}-screen`).classList.toggle('active', app.screen === k));
    if (app.screen === 'menu') renderMenu();
    if (app.screen === 'setup') renderSetup();
    if (app.screen === 'game') renderGame();
    renderModal();
    renderDebug();
  }

  function renderMenu() {
    $('menu-screen').innerHTML = `<div class="menu panel">
      <div>
        <h2>谎焰酒馆</h2>
        <p>盖牌宣称、质疑反质疑、轮盘惩罚，最后只剩一人。</p>
        <div class="menu-grid">
          <button class="btn primary" id="m-pve">开始 PVE（1v3 AI）</button>
          <button class="btn secondary" id="m-local">本地多人（2~4）</button>
          <button class="btn ghost" id="m-rules">规则说明</button>
          <button class="btn ghost" id="m-settings">设置</button>
        </div>
      </div>
    </div>`;
    $('m-pve').onclick = () => { app.mode = 'pve'; app.setupPlayers = 4; setScreen('setup'); };
    $('m-local').onclick = () => { app.mode = 'local'; app.setupPlayers = 4; setScreen('setup'); };
    $('m-rules').onclick = () => { app.modal = 'rules'; render(); };
    $('m-settings').onclick = () => { app.modal = 'settings'; render(); };
  }

  function renderSetup() {
    $('setup-screen').innerHTML = `<div class="setup panel">
      <h2>${app.mode === 'pve' ? 'PVE 模式' : '本地多人'}设置</h2>
      <div class="setup-row">
        <label>人数：</label>
        <select id="s-count">${[2,3,4].map(n => `<option value="${n}" ${n===app.setupPlayers?'selected':''}>${n}人</option>`).join('')}</select>
      </div>
      <div class="setup-row">
        <button id="s-start" class="btn primary">开始</button>
        <button id="s-back" class="btn ghost">返回</button>
      </div>
    </div>`;
    $('s-count').onchange = e => app.setupPlayers = Number(e.target.value);
    $('s-start').onclick = () => {
      const count = app.mode === 'pve' ? 4 : app.setupPlayers;
      app.game = initGame(app.mode, count);
      app.viewer = 0;
      setScreen('game');
      loop();
    };
    $('s-back').onclick = () => setScreen('menu');
  }

  function isMyTurn() {
    const g = app.game; if (!g) return false;
    const p = g.players[g.current];
    return p.alive && p.isHuman && p.id === app.viewer && !g.busy;
  }

  function renderGame() {
    const g = app.game;
    const current = g.players[g.current];
    const me = g.players[app.viewer];

    $('game-screen').innerHTML = `
      <div class="statusbar panel">
        <div>🎯 目标：<strong>${g.target}</strong></div>
        <div>🃏 桌面盖牌：<strong>${g.tablePile.length}</strong> 组</div>
        <div>🎲 当前行动：<strong>${current.name}</strong></div>
        <div class="${g.status.includes('危险')?'danger':''}">${g.status}</div>
      </div>

      <div class="table-layout">
        <div class="players panel">
          ${g.players.map(p => `<div class="player-card ${p.id===g.current?'current':''} ${p.alive?'':'dead'}">
            <div>${p.name} ${p.isHuman?'🙂':'🤖'}</div>
            <div class="meta">手牌:${p.hand.length} | ${p.alive?'存活':'淘汰'}</div>
            <div class="meta">诈唬:${p.bluffCount} | 质疑胜:${p.challengeWin}</div>
            ${app.pending?.type==='pick-target' && app.pending.targets.includes(p.id)?`<button class="btn" data-target="${p.id}">选中</button>`:''}
          </div>`).join('')}
        </div>

        <div class="table panel">
          <div class="table-center ${g.busy?'shake':''}">
            <div class="deck-stack">酒桌<br>盖牌堆<br>${g.tablePile.length} 组</div>
            <div>
              <div class="target-badge">${g.target}</div>
              <div style="text-align:center;color:var(--muted)">本轮宣称目标</div>
            </div>
          </div>
          <div class="reveal-strip">${g.revealCards.map(c=>`<div class="reveal-card">${c.value==='*'?'*':c.value}</div>`).join('')}</div>
        </div>

        <div class="log panel">${[...g.log].reverse().slice(0,90).map(x=>`<div class="log-item">${x}</div>`).join('')}</div>
      </div>

      <div class="hand panel">
        <h3>${me.name} 手牌（${me.hand.length}）</h3>
        <div class="cards">${me.hand.map((c,i)=>`<div class="card ${(app.pending?.selected||[]).includes(i)?'selected':''} ${canUseCard(i)?'':'disabled'}" data-card="${i}"><div class="name">${c.name}</div><div>${c.value}</div><div class="desc">${cardDesc(c)}</div></div>`).join('')}</div>
        <div class="action-bar">
          <button class="btn primary" id="act-play">出牌并宣称</button>
          <button class="btn" id="act-trust">相信上家</button>
          <button class="btn secondary" id="act-call">质疑上家</button>
          <button class="btn ghost" id="act-reset">清空选择</button>
          <button class="btn ghost" id="act-restart">重开</button>
          <button class="btn ghost" id="act-menu">返回菜单</button>
        </div>
        ${renderPendingInline()}
      </div>
    `;

    $('game-screen').querySelectorAll('[data-card]').forEach(el => {
      el.onclick = () => toggleSelect(Number(el.dataset.card));
    });
    $('game-screen').querySelectorAll('[data-target]').forEach(el => {
      el.onclick = () => app.pending?.onPick?.(Number(el.dataset.target));
    });

    $('act-play').onclick = () => playSelected();
    $('act-trust').onclick = () => trustLast();
    $('act-call').onclick = () => challengeLast();
    $('act-reset').onclick = () => { if (app.pending) app.pending.selected = []; render(); };
    $('act-restart').onclick = () => { app.game = initGame(app.mode, app.mode==='pve'?4:app.setupPlayers); app.viewer = 0; render(); loop(); };
    $('act-menu').onclick = () => setScreen('menu');

    bindInlinePending();
  }

  function canUseCard(i) {
    if (!isMyTurn()) return false;
    const g = app.game;
    if (g.waitingChallengeFrom === g.current) return false;
    return g.players[g.current].hand[i] != null;
  }

  function cardDesc(c) {
    return `普通牌 ${c.value}`;
  }

  function renderPendingInline() {
    if (!app.pending) return '';
    if (app.pending.type === 'pick-target') {
      return `<div class="inline-panel">${app.pending.text}（点击左侧玩家卡上的“选中”） <button class="btn" id="in-cancel">取消</button></div>`;
    }
    if (app.pending.type === 'pass-card') {
      const p = app.game.players[app.pending.from];
      return `<div class="inline-panel">${p.name} 请选择要交出的牌：${p.hand.map((c,i)=>`<button class='btn' data-pass='${i}'>${c.name}</button>`).join('')}</div>`;
    }
    return '';
  }

  function bindInlinePending() {
    if (!app.pending) return;
    if (app.pending.type === 'pick-target') $('in-cancel').onclick = () => app.pending.onCancel();
    if (app.pending.type === 'pass-card') {
      document.querySelectorAll('[data-pass]').forEach(el => {
        el.onclick = () => app.pending.onGive(Number(el.dataset.pass));
      });
    }
  }

  function toggleSelect(idx) {
    if (!isMyTurn()) return;
    app.pending ||= { selected: [] };
    app.pending.selected ||= [];
    const arr = app.pending.selected;
    const at = arr.indexOf(idx);
    if (at >= 0) arr.splice(at, 1);
    else {
      if (arr.length >= 3) return toast('最多选择3张');
      arr.push(idx);
    }
    render();
  }

  async function playSelected() {
    const g = app.game;
    if (!isMyTurn()) return;
    const player = g.players[g.current];
    const selected = [...(app.pending?.selected || [])].sort((a,b)=>b-a);
    if (!selected.length) return toast('请先选择1~3张牌');

    const cards = selected.map(i => player.hand[i]);
    selected.forEach(i => player.hand.splice(i, 1));
    app.pending = { selected: [] };

    const hasBluff = cards.some(c => c.value !== g.target);
    if (hasBluff) player.bluffCount += 1;

    g.tablePile.push({ owner: player.id, cards, claim: g.target });
    addLog(`🂠 ${player.name} 盖出 ${cards.length} 张，并宣称全是 ${g.target}`);

    // 下一位决定是否质疑
    g.current = nextAlive(g.players, g.current);
    g.waitingChallengeFrom = g.current;
    g.status = `${g.players[g.current].name} 可选择“相信”或“质疑”`;

    if (aliveCount(g.players) === 1) endGame();
    render();
    loop();
  }

  async function trustLast() {
    const g = app.game;
    if (g.waitingChallengeFrom !== g.current || !isMyTurn()) return;
    addLog(`😐 ${g.players[g.current].name} 选择相信。`);
    g.waitingChallengeFrom = null;
    g.status = `${g.players[g.current].name} 的回合：请出牌。`;
    render();
  }

  async function challengeLast() {
    const g = app.game;
    if (g.waitingChallengeFrom !== g.current || !isMyTurn()) return;
    const challenger = g.players[g.current];
    const last = g.tablePile[g.tablePile.length - 1];
    if (!last) return;

    g.busy = true;
    g.status = '质疑发动！翻牌中...';
    render();
    await sleep(300 / app.settings.speed);

    g.revealCards = [];
    for (const c of last.cards) {
      g.revealCards.push(c);
      render();
      await sleep(220 / app.settings.speed);
    }

    const liar = last.cards.some(c => c.kind === 'normal' && c.value !== last.claim);
    const targetPlayer = liar ? g.players[last.owner] : challenger;
    addLog(`🧨 质疑结果：${liar ? '说谎成立' : '质疑失败'}，${targetPlayer.name} 进入轮盘惩罚。`);

    if (!liar) challenger.challengeLose += 1;
    else challenger.challengeWin += 1;

    await penaltyRoulette(targetPlayer.id);

    // 新轮
    g.tablePile = [];
    g.revealCards = [];
    g.target = newRoundTarget(g.target);
    g.waitingChallengeFrom = null;
    g.busy = false;
    g.status = `新轮开始，目标值：${g.target}`;

    g.current = nextAlive(g.players, g.current);
    if (g.mode === 'local') g.passNeeded = true;

    // 补牌，保持每位存活至少6张（快节奏）
    refillHands();

    if (aliveCount(g.players) === 1) {
      endGame();
      return;
    }

    render();
    loop();
  }

  function refillHands() {
    const g = app.game;
    const alive = g.players.filter(p => p.alive);
    while (alive.some(p => p.hand.length < 6)) {
      if (!g.deck.length) g.deck = shuffle(g.discard.splice(0));
      if (!g.deck.length) break;
      for (const p of alive) {
        if (p.hand.length < 6 && g.deck.length) p.hand.push(g.deck.pop());
      }
    }
  }

  async function penaltyRoulette(playerId) {
    const g = app.game;
    const p = g.players[playerId];
    const dangerSet = new Set();
    while (dangerSet.size < 1) dangerSet.add(Math.floor(Math.random() * 6));

    let index = 0;
    app.modal = { type: 'roulette', playerId, index, dangerSet };
    render();

    const spins = 16 + Math.floor(Math.random() * 8);
    for (let i = 0; i < spins; i++) {
      index = (index + 1) % 6;
      app.modal.index = index;
      render();
      await sleep((60 + i * 14) / app.settings.speed);
    }

    const dead = dangerSet.has(index);
    if (dead) {
      p.alive = false;
      addLog(`💀 ${p.name} 命中危险格，淘汰！`);
    } else {
      p.survivedPenalty += 1;
      addLog(`😮 ${p.name} 逃过一劫，继续留在局内。`);
    }

    app.modal = null;
    render();
    await sleep(180);
  }

  async function loop() {
    const g = app.game;
    if (!g || g.winner != null || g.busy) return;

    while (true) {
      if (g.winner != null || g.busy) return;
      const p = g.players[g.current];
      if (!p.alive) { g.current = nextAlive(g.players, g.current); continue; }

      if (g.mode === 'local' && g.passNeeded) {
        await passOverlay(g.current);
        g.passNeeded = false;
      }

      if (p.isHuman && p.id === app.viewer) {
        g.status = g.waitingChallengeFrom === g.current ? '请选择：相信或质疑' : '请选择 1~3 张出牌并宣称';
        render();
        return;
      }

      // AI
      g.status = `${p.name} 思考中...`;
      render();
      await sleep(400 / app.settings.speed);

      if (g.waitingChallengeFrom === g.current) {
        const last = g.tablePile[g.tablePile.length - 1];
        const owner = g.players[last.owner];
        const persona = PERSONALITIES[p.aiType];
        let chance = persona.challenge + owner.bluffCount * 0.03;
        const call = Math.random() < Math.max(0.05, Math.min(0.92, chance));
        if (call) await challengeAi();
        else {
          addLog(`🤖 ${p.name} 选择相信。`);
          g.waitingChallengeFrom = null;
          render();
        }
        continue;
      }

      await aiPlay(p.id);
      render();
      await sleep(160 / app.settings.speed);
    }
  }

  async function challengeAi() {
    const g = app.game;
    const p = g.players[g.current];
    if (!p.isHuman) {
      // 直接执行质疑结算
      const last = g.tablePile[g.tablePile.length - 1];
      g.revealCards = [];
      for (const c of last.cards) {
        g.revealCards.push(c);
        render();
        await sleep(120 / app.settings.speed);
      }
      const liar = last.cards.some(c => c.value !== last.claim);
      const target = liar ? g.players[last.owner] : p;
      if (liar) p.challengeWin++; else p.challengeLose++;
      addLog(`🧨 ${p.name} 发起质疑：${liar ? '成功' : '失败'}，${target.name} 进轮盘。`);
      await penaltyRoulette(target.id);
      g.tablePile = [];
      g.revealCards = [];
      g.target = newRoundTarget(g.target);
      g.waitingChallengeFrom = null;
      g.current = nextAlive(g.players, g.current);
      refillHands();
      if (aliveCount(g.players) === 1) endGame();
    }
  }

  async function aiPlay(id) {
    const g = app.game;
    const p = g.players[id];
    const persona = PERSONALITIES[p.aiType];
    const count = 1 + Math.floor(Math.random() * 3);

    let picked = [];
    const truthful = p.hand.filter(c => c.value === g.target);
    const others = p.hand.filter(c => c.value !== g.target);
    const willBluff = Math.random() < persona.bluff || truthful.length < count;

    if (!willBluff) {
      picked = truthful.slice(0, count);
    } else {
      picked = [...truthful.slice(0, 1), ...others.slice(0, count - 1)];
      p.bluffCount += 1;
    }

    if (!picked.length) picked = [p.hand[0]];

    // remove
    picked.forEach(card => {
      const i = p.hand.findIndex(x => x.uid === card.uid);
      if (i >= 0) p.hand.splice(i, 1);
    });

    g.tablePile.push({ owner: id, cards: picked, claim: g.target });
    addLog(`🂠 ${p.name} 盖出 ${picked.length} 张并宣称 ${g.target}`);

    g.current = nextAlive(g.players, g.current);
    g.waitingChallengeFrom = g.current;
  }

  function endGame() {
    const winner = app.game.players.find(p => p.alive);
    app.game.winner = winner?.id ?? null;
    app.modal = 'result';
    render();
  }

  function passOverlay(nextViewer) {
    return new Promise(resolve => {
      app.modal = { type: 'pass', nextViewer, resolve };
      render();
    });
  }

  function renderModal() {
    const root = $('modal-root');
    root.innerHTML = '';
    if (!app.modal) return;

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const box = document.createElement('div');
    box.className = 'modal';
    mask.appendChild(box);
    root.appendChild(mask);

    if (app.modal === 'rules') {
      box.innerHTML = `<button class='modal-close' id='m-close'>✕</button><h2>规则</h2>
      <ul><li>轮到你时打出1~3张盖牌，并宣称“全是目标值”。</li><li>下家可选择相信或质疑。</li><li>质疑翻牌：说谎者进轮盘，若没说谎则质疑者进轮盘。</li><li>轮盘6格，命中危险格淘汰。</li><li>本版本只有 K/Q/A 普通牌，无功能牌干扰。</li><li>最后存活者获胜。</li></ul>`;
      $('m-close').onclick = () => { app.modal = null; render(); };
      return;
    }

    if (app.modal === 'settings') {
      box.innerHTML = `<button class='modal-close' id='m-close'>✕</button><h2>设置</h2>
      <div class='setup-row'><label>音效：</label><select id='set-sound'><option value='on'>开</option><option value='off'>关</option></select></div>
      <div class='setup-row'><label>动画速度：</label><input id='set-speed' type='range' min='0.6' max='1.8' step='0.1' value='${app.settings.speed}'><span id='set-speed-v'>${app.settings.speed.toFixed(1)}x</span></div>
      <button class='btn primary' id='set-ok'>保存</button>`;
      $('set-sound').value = app.settings.soundOn ? 'on' : 'off';
      $('set-speed').oninput = e => $('set-speed-v').textContent = `${Number(e.target.value).toFixed(1)}x`;
      $('set-ok').onclick = () => {
        app.settings.soundOn = $('set-sound').value === 'on';
        app.settings.speed = Number($('set-speed').value);
        localStorage.setItem('liarflame-settings', JSON.stringify(app.settings));
        app.modal = null; render();
      };
      $('m-close').onclick = () => { app.modal = null; render(); };
      return;
    }

    if (app.modal?.type === 'pass') {
      const p = app.game.players[app.modal.nextViewer];
      box.innerHTML = `<div class='pass-screen'><h2>请下一位玩家接手</h2><p>即将轮到 ${p.name}</p><button class='btn primary' id='pass-ok'>准备好了</button></div>`;
      $('pass-ok').onclick = () => {
        app.viewer = app.modal.nextViewer;
        const done = app.modal.resolve;
        app.modal = null;
        done();
        render();
      };
      return;
    }

    if (app.modal?.type === 'roulette') {
      const p = app.game.players[app.modal.playerId];
      box.innerHTML = `<h2>命运轮盘</h2><div class='roulette'>${p.name} 正在接受惩罚…</div>
      <div class='roulette-ring'>${Array.from({length:6},(_,i)=>`<div class='slot ${app.modal.index===i?'active':''} ${app.modal.dangerSet.has(i)?'danger':''}'>${i+1}</div>`).join('')}</div>`;
      return;
    }

    if (app.modal === 'result') {
      const w = app.game.players[app.game.winner];
      box.innerHTML = `<h2>🏆 ${w.name} 成为最后生还者</h2><button id='r-again' class='btn primary'>再来一局</button><button id='r-menu' class='btn'>回到菜单</button>`;
      $('r-again').onclick = () => { app.game = initGame(app.mode, app.mode==='pve'?4:app.setupPlayers); app.viewer = 0; app.modal = null; render(); loop(); };
      $('r-menu').onclick = () => { app.modal = null; setScreen('menu'); };
    }
  }

  function renderDebug() {
    const old = $('debug'); if (old) old.remove();
    if (!app.debug) return;
    const d = document.createElement('div');
    d.id = 'debug';
    d.className = 'debug';
    d.innerHTML = `screen:${app.screen}<br>modal:${typeof app.modal==='string'?app.modal:(app.modal?.type||'none')}<br>pending:${app.pending?.type||'none'}`;
    document.body.appendChild(d);
  }

  // user actions wrappers for challenge/trust respecting state
  window.playSelected = playSelected;
  window.trustLast = trustLast;
  window.challengeLast = challengeLast;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('liarflame-settings') || 'null');
      if (saved) app.settings = { ...app.settings, ...saved };
    } catch {}
  }

  // Hook top buttons
  $('btn-rules').onclick = () => { app.modal = 'rules'; render(); };
  $('btn-settings').onclick = () => { app.modal = 'settings'; render(); };

  loadSettings();
  setScreen('menu');
})();
