(() => {
  window.__bombBooted = true;

  const CARD_TYPES = { bomb:'bomb', defuse:'defuse', skip:'skip', attack:'attack', foresee:'foresee', shuffle:'shuffle', favor:'favor', counter:'counter', cat:'cat' };
  const CATS = [
    ['cat_ramen','拉面猫','🍜','吃面时会瞬移到你口袋偷牌。'],
    ['cat_drama','戏精猫','🎭','会当场表演“你不抽牌我就闹”。'],
    ['cat_rocket','火箭猫','🚀','擅长把队友送进危险区。'],
    ['cat_pickle','腌黄瓜猫','🥒','味道奇怪但超会薅别人手牌。'],
    ['cat_toast','吐司猫','🍞','看起来温顺，其实很记仇。']
  ];
  const CARD_DB = {
    bomb:{id:'bomb',name:'爆裂猫',type:'bomb',emoji:'💣',desc:'抽到时若没有拆弹包，立即淘汰。'},
    defuse:{id:'defuse',name:'拆弹包',type:'defuse',emoji:'🧯',desc:'可化解爆裂猫并将其塞回牌库。'},
    skip:{id:'skip',name:'跳过',type:'skip',emoji:'⏭️',desc:'结束当前这一小回合，不抽牌。'},
    attack:{id:'attack',name:'连环攻击',type:'attack',emoji:'⚔️',desc:'下一名玩家需要完成2个小回合。'},
    foresee:{id:'foresee',name:'预知未来',type:'foresee',emoji:'🔮',desc:'查看牌库顶部3张牌。'},
    shuffle:{id:'shuffle',name:'洗牌',type:'shuffle',emoji:'🌀',desc:'随机打乱整个牌库。'},
    favor:{id:'favor',name:'索要',type:'favor',emoji:'🫴',desc:'指定目标随机交给你1张手牌。'},
    counter:{id:'counter',name:'反制',type:'counter',emoji:'🛑',desc:'响应其他牌，令其无效。可连锁反制。'}
  };
  CATS.forEach(([id,name,emoji,desc]) => CARD_DB[id] = {id,name,type:'cat',emoji,desc});

  const qs = (id) => document.getElementById(id);
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const nextAlive = (players, from) => { let idx=from; for(let i=0;i<players.length;i++){ idx=(idx+1)%players.length; if(players[idx].alive) return idx; } return from; };
  const makeCard = (id) => ({ uid: `${id}_${Math.random().toString(36).slice(2,8)}`, ...CARD_DB[id] });
  const getCardTag = (c) => c.type==='cat'?'collect':(c.id==='counter'?'reactive':'action');

  const fxState = { soundOn:true, speed:1 };
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx;
  const beep = (freq=440,dur=0.08,type='triangle') => {
    if(!fxState.soundOn || !AudioCtx) return;
    audioCtx ||= new AudioCtx();
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=0.03; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur/fxState.speed);
  };
  const sfx = { draw:()=>beep(520,.05), play:()=>beep(430,.08), danger:()=>{beep(200,.12,'sawtooth'); setTimeout(()=>beep(130,.15,'sawtooth'),80);}, defuse:()=>{beep(660,.08); setTimeout(()=>beep(860,.08),70);}, counter:()=>beep(320,.12,'square'), win:()=>{beep(680,.08); setTimeout(()=>beep(860,.09),90);} };

  const state = { screen:'menu', mode:'ai', setupPlayers:3, showRules:false, showSettings:false, engine:null, viewer:0, busy:false, error:null, debug: location.hostname==='localhost' || location.search.includes('debug=1') };

  function buildDeck(playerCount){
    const ids=[]; const push=(id,n)=>{for(let i=0;i<n;i++) ids.push(id);};
    push('skip',6); push('attack',5); push('foresee',5); push('shuffle',4); push('favor',4); push('counter',6);
    Object.keys(CARD_DB).filter(k=>CARD_DB[k].type==='cat').forEach(cid=>push(cid,4));
    push('defuse', Math.max(2,6-playerCount)); push('bomb', playerCount-1);
    return shuffle(ids.map(makeCard));
  }

  function createGame(mode,total){
    const players=[];
    for(let i=0;i<total;i++) players.push({id:i,name:(mode==='local'?`玩家${i+1}`:(i===0?'你':`AI-${i}`)), isHuman: mode==='local' || i===0, alive:true, hand:[], turns:1});
    let deck = buildDeck(total);
    players.forEach(p=>p.hand.push(makeCard('defuse')));
    for(let r=0;r<6;r++) players.forEach(p=>p.hand.push(deck.shift()));
    return { mode, players, deck, discard:[], current:0, logs:['🎉 对局开始！'], winner:null, waitingPass: mode==='local' };
  }

  function log(msg){ state.engine.logs.push(msg); if(state.engine.logs.length>120) state.engine.logs.shift(); }

  async function resolveCounter(sourcePlayer, sourceCard){
    let chain=0, cursor=sourcePlayer;
    while(true){
      let played=false;
      for(let step=1; step<state.engine.players.length; step++){
        const idx=(cursor+step)%state.engine.players.length; const p=state.engine.players[idx];
        if(!p.alive) continue;
        const cIdx=p.hand.findIndex(c=>c.id==='counter'); if(cIdx<0) continue;
        let will=false;
        if(p.isHuman){
          will = await askYesNo(`${p.name} 是否反制 ${sourceCard.name}？`, '打出反制', '不反制');
        } else {
          will = ['favor','attack','shuffle'].includes(sourceCard.id) ? Math.random()<0.62 : Math.random()<0.15;
        }
        if(will){ p.hand.splice(cIdx,1); state.engine.discard.push(makeCard('counter')); chain++; cursor=idx; played=true; sfx.counter(); log(`🛑 ${p.name} 打出反制（${chain}层）`); break; }
      }
      if(!played) break;
    }
    return chain%2===1;
  }

  function checkWinner(){
    const alive = state.engine.players.filter(p=>p.alive);
    if(alive.length===1){ state.engine.winner = alive[0].id; sfx.win(); showModal(`<h2>🎉 ${alive[0].name} 获胜！</h2>`, [{label:'再来一局', className:'inline-btn primary', onClick:()=>{closeModal(); startGame(state.mode,state.setupPlayers);}}, {label:'返回菜单', className:'inline-btn', onClick:()=>{closeModal(); setScreen('menu'); render();}}], {closeOnMask:false}); return true; }
    return false;
  }

  async function finishSubTurn(playerIdx){
    const p=state.engine.players[playerIdx]; p.turns = p.alive ? p.turns-1 : 0;
    if(checkWinner()) return;
    if(p.turns>0){ log(`⏱️ ${p.name} 还有 ${p.turns} 小回合`); render(); return; }
    state.engine.current = nextAlive(state.engine.players, state.engine.current);
    const np=state.engine.players[state.engine.current]; if(np.turns<=0) np.turns=1;
    log(`👉 轮到 ${np.name}`);
    if(state.engine.mode==='local') state.engine.waitingPass = true;
    render();
  }

  async function drawFor(playerIdx){
    const p=state.engine.players[playerIdx]; if(!p.alive) return;
    const card=state.engine.deck.shift(); if(!card) return;
    sfx.draw(); pulsePile(); log(`🎴 ${p.name} 抽牌`);
    if(card.id==='bomb'){
      sfx.danger(); log(`💣 ${p.name} 抽到了爆裂猫！`);
      const defIdx=p.hand.findIndex(c=>c.id==='defuse');
      if(defIdx<0){ p.alive=false; state.engine.discard.push(card); log(`💥 ${p.name} 被淘汰`); }
      else {
        p.hand.splice(defIdx,1); state.engine.discard.push(makeCard('defuse')); sfx.defuse();
        const pos = p.isHuman ? await chooseDefusePos(state.engine.deck.length) : Math.floor(Math.random()*(state.engine.deck.length+1));
        state.engine.deck.splice(pos,0,card); log(`🧯 拆弹成功，炸弹插回位置 ${pos+1}`);
      }
    } else p.hand.push(card);
    await finishSubTurn(playerIdx);
  }

  async function playCard(playerIdx, idx, target){
    const p=state.engine.players[playerIdx]; const card=p.hand[idx]; if(!card) return;
    if(['bomb','defuse','counter'].includes(card.id) || card.type==='cat') return;
    const cancel = await resolveCounter(playerIdx, card);
    p.hand.splice(idx,1); state.engine.discard.push(card);
    if(cancel){ log(`🚫 ${card.name} 被反制`); render(); return; }
    sfx.play(); log(`🃏 ${p.name} 使用 ${card.name}`);
    if(card.id==='skip'){ await finishSubTurn(playerIdx); return; }
    if(card.id==='attack'){ const nx=nextAlive(state.engine.players, playerIdx); state.engine.players[nx].turns += 1; await finishSubTurn(playerIdx); return; }
    if(card.id==='foresee'){ const top=state.engine.deck.slice(0,3).map(c=>`${c.emoji}${c.name}`).join(' / '); await infoModal(`预知未来：${top || '（空）'}`); }
    if(card.id==='shuffle'){ state.engine.deck = shuffle(state.engine.deck); log('🌀 已洗牌'); }
    if(card.id==='favor'){
      if(target==null){ const opts = aliveOpponents(playerIdx).filter(i=>state.engine.players[i].hand.length>0); target=opts[0] ?? null; }
      if(target!=null){ const t=state.engine.players[target]; if(t.hand.length){ const r=Math.floor(Math.random()*t.hand.length); p.hand.push(t.hand.splice(r,1)[0]); log(`🫴 ${p.name} 从 ${t.name} 那里拿到1张牌`); } }
    }
    render();
  }

  function combos(playerIdx){ const hand=state.engine.players[playerIdx].hand; const map={}; hand.forEach(c=>{ if(c.type==='cat') map[c.id]=(map[c.id]||0)+1; }); return Object.entries(map).filter(([,n])=>n>=2); }
  async function catCombo(playerIdx){
    const list=combos(playerIdx); if(!list.length) return toast('没有可发动的猫咪组合');
    const [catId,count]=list[0];
    const targets=aliveOpponents(playerIdx).filter(i=>state.engine.players[i].hand.length>0); if(!targets.length) return;
    const target = state.engine.players[playerIdx].isHuman ? await chooseTarget(targets) : targets[Math.floor(Math.random()*targets.length)];
    if(target==null) return;
    const cancel = await resolveCounter(playerIdx,{id:'cat_combo',name:'猫咪组合技'});
    if(cancel){ log('🚫 猫咪组合技被反制'); render(); return; }
    const p=state.engine.players[playerIdx];
    for(let i=0;i<2;i++){ const k=p.hand.findIndex(c=>c.id===catId); state.engine.discard.push(p.hand.splice(k,1)[0]); }
    const t=state.engine.players[target]; const steal=count>=3?2:1;
    for(let i=0;i<steal && t.hand.length;i++){ const k=Math.floor(Math.random()*t.hand.length); p.hand.push(t.hand.splice(k,1)[0]); }
    log(`🐾 ${p.name} 组合技成功`); render();
  }

  function aliveOpponents(playerIdx){ return state.engine.players.filter(p=>p.alive&&p.id!==playerIdx).map(p=>p.id); }
  function isPlayable(card){ return !['bomb','defuse','counter'].includes(card.id) && card.type!=='cat'; }

  function setScreen(s){ state.screen=s; render(); }

  function pulsePile(){ const el=qs('deck-pile'); if(!el) return; el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'), 600/fxState.speed); }
  function toast(msg){ const root=qs('toast-root'); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; root.appendChild(t); setTimeout(()=>t.remove(), 1500); }

  let escHandle=null;
  function showModal(html, actions=[], opt={}){
    const root=qs('modal-root'); root.innerHTML='';
    const close=()=>{ closeModal(); opt.onClose && opt.onClose(); };
    const mask=document.createElement('div'); mask.className='modal-mask';
    const m=document.createElement('div'); m.className='modal';
    m.innerHTML=`<button class='modal-close'>✕</button>${html}<div class='actions'></div>`;
    m.querySelector('.modal-close').onclick=close;
    const act=m.querySelector('.actions');
    actions.forEach(a=>{ const b=document.createElement('button'); b.className=a.className||'inline-btn'; b.textContent=a.label; b.onclick=a.onClick; act.appendChild(b); });
    mask.appendChild(m); root.appendChild(mask);
    mask.addEventListener('click', (e)=>{ if(e.target===mask && opt.closeOnMask!==false) close(); });
    if(escHandle) document.removeEventListener('keydown', escHandle);
    escHandle=(e)=>{ if(e.key==='Escape') close(); };
    document.addEventListener('keydown', escHandle);
  }
  function closeModal(){ const r=qs('modal-root'); if(r) r.innerHTML=''; if(escHandle){ document.removeEventListener('keydown', escHandle); escHandle=null; } state.showRules=false; state.showSettings=false; }
  function infoModal(text){ return new Promise(res=>showModal(`<h2>${text}</h2>`,[{label:'确定',className:'inline-btn primary',onClick:()=>{closeModal();res();}}],{closeOnMask:false})); }
  function askYesNo(text, yes='是', no='否'){ return new Promise(res=>showModal(`<h2>${text}</h2>`,[{label:no,className:'inline-btn',onClick:()=>{closeModal();res(false);}},{label:yes,className:'inline-btn warn',onClick:()=>{closeModal();res(true);}}],{closeOnMask:false})); }
  function chooseDefusePos(deckLen){ return new Promise(res=>showModal(`<h2>拆弹成功，放回哪里？</h2>`,[
    {label:'顶部',className:'inline-btn',onClick:()=>{closeModal();res(0);}},
    {label:'中间',className:'inline-btn',onClick:()=>{closeModal();res(Math.floor(deckLen/2));}},
    {label:'底部',className:'inline-btn',onClick:()=>{closeModal();res(deckLen);}},
    {label:'自定义',className:'inline-btn primary',onClick:()=>{const v=prompt(`输入 1-${deckLen+1}`,'1'); const n=Math.max(1,Math.min(deckLen+1,Number(v)||1)); closeModal(); res(n-1);}}
  ],{closeOnMask:false})); }
  function chooseTarget(targetIds){ return new Promise(res=>showModal(`<h2>选择目标</h2>`,[
    ...targetIds.map(id=>({label:state.engine.players[id].name,className:'inline-btn',onClick:()=>{closeModal();res(id);}})),
    {label:'取消',className:'inline-btn',onClick:()=>{closeModal();res(null);}}
  ],{closeOnMask:false})); }

  function renderDebug(){
    const old=qs('debug-panel'); if(old) old.remove(); if(!state.debug) return;
    const d=document.createElement('div'); d.id='debug-panel'; d.className='debug-panel'; d.innerHTML=`screen:<b>${state.screen}</b><br>showRules:<b>${state.showRules}</b><br>showSettings:<b>${state.showSettings}</b>${state.error?`<br>error:<b>${state.error}</b>`:''}`; document.body.appendChild(d);
  }

  function renderMenu(){
    qs('menu-screen').innerHTML = `<div class='menu panel'>
      <div class='title'>爆裂猫团</div>
      <div class='subtitle'>原创派对卡牌：坑人、反制、翻盘与尖叫并存。</div>
      <div class='menu-grid'>
        <button id='btn-fast' class='btn-main'>开始游戏（快速人机）</button>
        <button id='btn-ai' class='btn-main'>开始：人机对战</button>
        <button id='btn-local' class='btn-main btn-sub'>开始：本地多人</button>
        <button id='btn-rule2' class='btn-main btn-sub'>规则说明</button>
        <button id='btn-set2' class='btn-main btn-sub'>设置</button>
      </div>
      <div class='tutorial-tip'>新手提示：每回合通常最后要抽牌，抽到爆裂猫就可能当场爆炸。</div>
    </div>`;
    qs('btn-fast').onclick=()=>{ state.mode='ai'; state.setupPlayers=3; setScreen('setup'); };
    qs('btn-ai').onclick=()=>{ state.mode='ai'; state.setupPlayers=3; setScreen('setup'); };
    qs('btn-local').onclick=()=>{ state.mode='local'; state.setupPlayers=4; setScreen('setup'); };
    qs('btn-rule2').onclick=openRules;
    qs('btn-set2').onclick=openSettings;
  }

  function renderSetup(){
    qs('setup-screen').innerHTML = `<div class='setup panel'><h2>${state.mode==='ai'?'人机模式设置':'本地多人设置'}</h2>
      <div class='setup-row'><label>总人数：</label><select id='setup-num'>${[2,3,4,5].map(n=>`<option value='${n}' ${n===state.setupPlayers?'selected':''}>${n} 人</option>`).join('')}</select></div>
      <div class='setup-row'><button id='btn-start-game' class='btn-main'>开始对局</button><button id='btn-back-menu' class='btn-main btn-sub'>返回菜单</button></div>
    </div>`;
    qs('setup-num').onchange=(e)=>state.setupPlayers=Number(e.target.value);
    qs('btn-start-game').onclick=()=>startGame(state.mode,state.setupPlayers);
    qs('btn-back-menu').onclick=()=>setScreen('menu');
  }

  function renderGame(){
    const g=state.engine; if(!g){ qs('game-screen').innerHTML=`<div class='panel error-card'>主菜单加载失败<br/>当前界面状态：${state.screen}</div>`; return; }
    const current=g.players[g.current]; const viewer=g.players[state.viewer];
    qs('game-screen').innerHTML = `<div class='game-layout'>
      <div class='players panel'>${g.players.map(p=>`<div class='player-chip ${p.id===g.current?'current':''} ${p.alive?'':'dead'}'><div>${p.name} ${p.isHuman?'🙂':'🤖'}</div><div class='meta'>手牌:${p.hand.length} | ${p.alive?'存活':'淘汰'} ${p.id===g.current?`| 回合:${p.turns}`:''}</div></div>`).join('')}</div>
      <div class='center panel'><div class='center-stack'><div class='pile' id='deck-pile'>牌库<div class='count'>${g.deck.length}</div></div><div class='pile'>弃牌堆<div class='count'>${g.discard.length}</div></div></div><div class='turn-info'>当前回合：${current.name}${g.deck.length<=6?`<div class='danger'>⚠️ 牌库快见底</div>`:''}</div></div>
      <div class='log-panel panel'>${[...g.logs].reverse().slice(0,60).map(x=>`<div class='log-item'>${x}</div>`).join('')}</div>
    </div>
    <div class='hand-panel panel'><h3>${viewer.name} 的手牌 (${viewer.hand.length})</h3>
      <div class='hand-row'>${viewer.hand.map((c,i)=>`<div class='card ${getCardTag(c)} ${canAct(viewer,c)?'':'disabled'}' data-i='${i}' title='${c.name}：${c.desc}'><div class='badge'>${c.emoji}</div><div class='name'>${c.name}</div><div class='type'>${c.type}</div><div class='desc'>${c.desc}</div></div>`).join('')}</div>
      <div class='hand-actions'><button id='btn-draw' class='inline-btn primary'>抽牌并结束小回合</button><button id='btn-combo' class='inline-btn'>发动猫咪组合</button><button id='btn-restart' class='inline-btn'>重新开始</button><button id='btn-menu' class='inline-btn warn'>返回菜单</button></div>
    </div>`;

    qs('game-screen').querySelectorAll('.card').forEach(el=>el.onclick=async()=>{
      const i=Number(el.dataset.i), p=current;
      if(!canAct(viewer,p.hand[i])) return;
      let target=null;
      if(p.hand[i].id==='favor'){ const opts=aliveOpponents(p.id).filter(id=>g.players[id].hand.length>0); if(!opts.length) return; target = p.isHuman ? await chooseTarget(opts) : opts[0]; if(target==null) return; }
      await playCard(p.id, i, target);
      await maybeAI();
    });
    qs('btn-draw').onclick=async()=>{ if(!canHumanTurn()) return; await drawFor(g.current); await maybeAI(); };
    qs('btn-combo').onclick=async()=>{ if(!canHumanTurn()) return; await catCombo(g.current); };
    qs('btn-restart').onclick=()=>startGame(state.mode,state.setupPlayers);
    qs('btn-menu').onclick=()=>setScreen('menu');
  }

  function canHumanTurn(){ const p=state.engine.players[state.engine.current]; return p.isHuman && p.id===state.viewer && !state.busy; }
  function canAct(viewer, card){ return canHumanTurn() && isPlayable(card) && viewer.id===state.engine.current; }

  function render(){
    ['menu','setup','game'].forEach(k=>qs(`${k}-screen`).classList.toggle('active', state.screen===k));
    try{
      if(state.screen==='menu') renderMenu();
      if(state.screen==='setup') renderSetup();
      if(state.screen==='game') renderGame();
      state.error = null;
    } catch(err){
      state.error = err.message || String(err);
      const c = qs(`${state.screen}-screen`);
      c.innerHTML = `<div class='panel error-card'><h2>主菜单加载失败</h2><p>当前界面状态：${state.screen}</p><pre>${state.error}</pre></div>`;
    }
    renderDebug();
  }

  function openRules(){ state.showRules=true; state.showSettings=false; showModal(`<h2>规则说明</h2><p>目标：活到最后。每位玩家轮流行动，通常通过<strong>抽一张牌</strong>结束当前小回合。</p><ul><li>爆裂猫：抽到若无拆弹包立即淘汰。</li><li>拆弹包：解除爆裂猫并回插牌库。</li><li>反制：可连锁反制，奇数层取消原牌。</li><li>猫咪组合：两张同名可偷牌。</li></ul>`,[{label:'知道了',className:'inline-btn primary',onClick:closeModal}]); renderDebug(); }
  function openSettings(){ state.showSettings=true; state.showRules=false; showModal(`<h2>设置</h2><div class='setup-row'><label>音效：</label><select id='set-sound'><option value='on'>开</option><option value='off'>关</option></select></div><div class='setup-row'><label>动画速度：</label><input id='set-speed' type='range' min='0.6' max='1.8' step='0.1' value='${fxState.speed}'><span id='set-speed-v'>${fxState.speed.toFixed(1)}x</span></div>`,[{label:'取消',className:'inline-btn',onClick:closeModal},{label:'保存',className:'inline-btn primary',onClick:()=>{ fxState.soundOn = qs('set-sound').value==='on'; fxState.speed = Number(qs('set-speed').value); localStorage.setItem('bomb-cat-settings', JSON.stringify(fxState)); closeModal(); }}]); qs('set-sound').value = fxState.soundOn?'on':'off'; qs('set-speed').oninput=(e)=>qs('set-speed-v').textContent=`${Number(e.target.value).toFixed(1)}x`; renderDebug(); }

  function startGame(mode,total){
    state.mode=mode; state.setupPlayers=total; state.viewer=0; state.engine=createGame(mode,total); state.screen='game';
    log(`👉 轮到 ${state.engine.players[state.engine.current].name}`);
    if(!localStorage.getItem('bomb-cat-tutorial-v1')){ localStorage.setItem('bomb-cat-tutorial-v1','1'); showModal('<h2>欢迎来到爆裂猫团</h2><ol><li>先预知未来，再决定是否抽牌。</li><li>留反制在关键时机翻盘。</li></ol>',[{label:'开整',className:'inline-btn primary',onClick:closeModal}]); }
    render();
    maybeAI();
  }

  async function maybeAI(){
    if(state.busy) return; state.busy=true;
    try{
      while(true){
        if(state.engine.winner!=null) break;
        const p=state.engine.players[state.engine.current];
        if(p.isHuman){
          if(state.engine.mode==='local' && state.engine.waitingPass){
            showModal(`<h2>请下一位玩家接手</h2><p>接下来轮到 ${p.name}</p>`,[{label:'我已接手',className:'inline-btn primary',onClick:()=>{ closeModal(); state.engine.waitingPass=false; state.viewer=p.id; render(); }}],{closeOnMask:false});
          }
          break;
        }
        state.viewer=0; render(); toast(`${p.name} 思考中...`); await sleep(500/fxState.speed);
        const hand=p.hand;
        const top3=state.engine.deck.slice(0,3).map(c=>c.id); const danger=top3.includes('bomb');
        const idx=(id)=>hand.findIndex(c=>c.id===id);
        if(danger && idx('foresee')>=0) await playCard(p.id, idx('foresee'));
        else if(danger && idx('shuffle')>=0) await playCard(p.id, idx('shuffle'));
        else if(danger && idx('skip')>=0) await playCard(p.id, idx('skip'));
        else if(Math.random()<0.45 && idx('attack')>=0) await playCard(p.id, idx('attack'));
        else if(Math.random()<0.35 && idx('favor')>=0){ const t=aliveOpponents(p.id).filter(i=>state.engine.players[i].hand.length>0)[0]; await playCard(p.id, idx('favor'), t); }
        else if(combos(p.id).length && Math.random()<0.5) await catCombo(p.id);
        else await drawFor(p.id);
        await sleep(220/fxState.speed);
      }
    } finally { state.busy=false; }
  }

  function init(){
    try { const saved = JSON.parse(localStorage.getItem('bomb-cat-settings')||'null'); if(saved){ fxState.soundOn = !!saved.soundOn; fxState.speed = Number(saved.speed)||1; } } catch {}
    qs('btn-rules').onclick=openRules;
    qs('btn-settings').onclick=openSettings;
    setScreen('menu');
    render();
  }

  window.addEventListener('error', (e)=>{ state.error=e.message; render(); });
  init();
})();
