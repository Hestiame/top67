/* player.js — app do jogador (celular) */
const socket = io();
const root = document.getElementById('root');
let me = { name:'', avatar:'fox', acc:{} };
let sound = true;

const params = new URLSearchParams(location.search);
const prefillPin = params.get('pin') || '';

/* ---------- tela de entrada ---------- */
function joinScreen(){
  root.innerHTML = `
  <div class="join-screen">
    <div class="brand-top">${logo(38)}<span class="brand-name">quiz<b>Hub</b></span></div>
    <div class="join-card">
      <div style="text-align:center;margin-bottom:6px"><div id="charPrev">${renderCharacter(me.avatar,me.acc,120)}</div></div>
      <h2 style="text-align:center">Bora jogar!</h2>
      <div class="step"><label class="jl">PIN do jogo</label>
        <input class="inp" id="pin" inputmode="numeric" maxlength="6" placeholder="000000" value="${esc(prefillPin)}" style="font-family:var(--disp);font-size:28px;text-align:center;letter-spacing:6px;margin-top:6px"></div>
      <div class="step"><label class="jl">Seu nome</label>
        <input class="inp" id="name" maxlength="18" placeholder="Como te chamam?" style="margin-top:6px"></div>
      <div class="step"><label class="jl">Personagem</label><div class="avatar-grid" id="avg"></div></div>
      <div class="step"><label class="jl">Acessórios</label><div id="accSecs"></div></div>
      <button class="btn btn-primary btn-block" id="go" style="margin-top:20px">Entrar no jogo →</button>
    </div>
  </div>`;
  const prev=()=>{document.getElementById('charPrev').innerHTML=renderCharacter(me.avatar,me.acc,120);};
  const avg=document.getElementById('avg');
  AVATARS.forEach((a)=>{
    const b=el(`<button class="av-pick ${a.id===me.avatar?'sel':''}" title="${esc(a.name)}"><img src="/avatars/${a.id}.jpg" alt="${esc(a.name)}"></button>`);
    b.onclick=()=>{me.avatar=a.id;avg.querySelectorAll('.av-pick').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');prev();};
    avg.appendChild(b);
  });
  const secs=document.getElementById('accSecs');
  ACC_SLOTS.forEach(slot=>{
    const wrap=el(`<div class="acc-sec"><div class="acc-sec-h">${esc(ACC[slot].label)}</div><div class="acc-row" id="row-${slot}"></div></div>`);
    secs.appendChild(wrap);
    const row=wrap.querySelector('#row-'+slot);
    const none=el(`<button class="acc-pick none ${!me.acc[slot]?'sel':''}" title="Nenhum">✕</button>`);
    none.onclick=()=>{delete me.acc[slot];row.querySelectorAll('.acc-pick').forEach(x=>x.classList.remove('sel'));none.classList.add('sel');prev();};
    row.appendChild(none);
    ACC[slot].items.forEach(id=>{
      const b=el(`<button class="acc-pick ${me.acc[slot]===id?'sel':''}" title="${esc(ACC_NAMES[id]||id)}"><img src="/accessories/${slot}/${id}.png" alt=""></button>`);
      b.onclick=()=>{me.acc[slot]=id;row.querySelectorAll('.acc-pick').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');prev();};
      row.appendChild(b);
    });
  });
  document.getElementById('go').onclick=()=>{
    const pin=document.getElementById('pin').value.trim();
    const name=document.getElementById('name').value.trim();
    if(pin.length!==6){toast('Digite o PIN de 6 dígitos');return;}
    if(!name){toast('Digite seu nome');return;}
    me.name=name;
    socket.emit('player:join',{pin,name,avatar:me.avatar,acc:me.acc});
  };
  if(prefillPin) setTimeout(()=>document.getElementById('name').focus(),200);
}

/* ---------- telas de jogo (fundo escuro) ---------- */
function gameShell(topRight){
  return `<div class="play">
    <div class="play-bg"><div class="blob" style="width:300px;height:300px;left:-60px;top:-40px;background:#6C2BD9"></div>
      <div class="blob" style="width:280px;height:280px;right:-40px;bottom:-60px;background:#FF3D81"></div></div>
    <div class="play-top"><span class="scorepill">${renderCharacter(me.avatar,me.acc,30)} ${esc(me.name)}</span><span></span>${topRight||''}</div>
    <div class="play-body" id="pbody"></div>
    <div class="foot" id="pfoot"></div></div>`;
}
function footBtn(label,fn){const f=document.getElementById('pfoot');const b=el(`<button class="foot-btn">${label}</button>`);b.onclick=fn;f.appendChild(b);return b;}

function waitScreen(quizTitle){
  root.innerHTML=gameShell();
  document.getElementById('pbody').innerHTML=`<div class="answered-msg"><div style="animation:pulse 1.5s infinite;margin-bottom:12px">${renderCharacter(me.avatar,me.acc,110)}</div>
    <h2 style="font-size:26px">Você entrou!</h2>
    <p style="opacity:.8;font-weight:700;margin-top:8px">${esc(quizTitle||'')}</p>
    <p style="opacity:.7;font-weight:700;margin-top:16px">Aguarde o apresentador começar…</p></div>`;
}

/* ---------- controles por tipo ---------- */
let answered=false;
function renderQuestion(q){
  answered=false;
  root.innerHTML=gameShell(`<span class="scorepill" id="qc">${q.index+1}/${q.total}</span>`);
  const body=document.getElementById('pbody');
  body.innerHTML=`<h1 class="q-title" style="font-size:22px">${esc(q.text||'')}</h1><div id="ctl" style="width:100%;display:flex;justify-content:center"></div>`;
  const ctl=document.getElementById('ctl');
  (CTRL[q.type]||CTRL.quiz)(q,ctl);
}
function send(payload){ if(answered)return; answered=true; socket.emit('player:answer',{payload}); }

const CTRL={};
function choice(q,ctl){
  const grid=el(`<div class="answers"></div>`); const sel=new Set();
  (q.answers||[]).forEach(a=>{
    const b=el(`<button class="ans ${SHAPE_CLASS[a.i]}"><span class="shape">${shapeSVG(a.i,28)}</span><span>${esc(a.t)}</span></button>`);
    b.onclick=()=>{
      if(q.multi){ if(sel.has(a.i)){sel.delete(a.i);b.style.outline='';}else{sel.add(a.i);b.style.outline='4px solid #fff';} }
      else { if(sound)beep('tick'); send({sel:[a.i]}); flashSent(); }
    };
    grid.appendChild(b);
  });
  ctl.appendChild(grid);
  if(q.multi) footBtn('Enviar →',()=>{if(sound)beep('tick');send({sel:[...sel]});flashSent();});
}
CTRL.quiz=choice; CTRL.audioquiz=choice;
CTRL.poll=(q,ctl)=>{
  const grid=el(`<div class="answers"></div>`);
  (q.answers||[]).forEach(a=>{
    const b=el(`<button class="ans ${SHAPE_CLASS[a.i]}"><span class="shape">${shapeSVG(a.i,28)}</span><span>${esc(a.t)}</span></button>`);
    b.onclick=()=>{if(sound)beep('tick');send({idx:a.i});flashSent();};
    grid.appendChild(b);
  });
  ctl.appendChild(grid);
};
CTRL.truefalse=(q,ctl)=>{
  const g=el(`<div class="tf-grid"></div>`); const defs=[['Verdadeiro','var(--a-green)','✓'],['Falso','var(--a-red)','✕']];
  (q.answers||[]).forEach((a,i)=>{const d=defs[i];
    const b=el(`<button class="ans" style="background:${d[1]};justify-content:center;font-size:24px;min-height:120px"><span style="font-size:28px;margin-right:8px">${d[2]}</span>${esc(a.t)}</button>`);
    b.onclick=()=>{if(sound)beep('tick');send({idx:i});flashSent();};g.appendChild(b);});
  ctl.appendChild(g);
};
CTRL.type=(q,ctl)=>{
  const w=el(`<div class="play-input"><input class="big-input" id="ti" placeholder="Sua resposta..." autocomplete="off"></div>`);ctl.appendChild(w);
  const i=w.querySelector('#ti');i.onkeydown=e=>{if(e.key==='Enter')doSend();};setTimeout(()=>i.focus(),100);
  function doSend(){if(sound)beep('tick');send({text:i.value});flashSent();}
  footBtn('Enviar →',doSend);
};
CTRL.slider=(q,ctl)=>{
  const s=q.slider,mid=Math.round((s.min+s.max)/2);
  const w=el(`<div class="slider-wrap"><div class="slider-val" id="sv">${mid}${esc(s.unit?' '+s.unit:'')}</div>
    <input type="range" class="rng" id="rg" min="${s.min}" max="${s.max}" step="${s.step}" value="${mid}">
    <div style="display:flex;justify-content:space-between;font-weight:800;opacity:.7;margin-top:8px"><span>${s.min}</span><span>${s.max}</span></div></div>`);
  ctl.appendChild(w);const rg=w.querySelector('#rg'),sv=w.querySelector('#sv');
  rg.oninput=()=>sv.textContent=rg.value+(s.unit?' '+s.unit:'');
  footBtn('Confirmar →',()=>{if(sound)beep('tick');send({val:parseFloat(rg.value)});flashSent();});
};
CTRL.scale=(q,ctl)=>{
  const s=q.scale;const row=el(`<div style="text-align:center;width:100%"><div class="scale-row" id="sr"></div>
    <div class="scale-labels"><span>${esc(s.labels[0]||'')}</span><span>${esc(s.labels[1]||'')}</span></div></div>`);ctl.appendChild(row);
  const sr=row.querySelector('#sr');let chosen=null;
  for(let v=s.smin;v<=s.smax;v++){const b=el(`<button class="scale-btn">${v}</button>`);
    b.onclick=()=>{chosen=v;sr.querySelectorAll('.scale-btn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');};sr.appendChild(b);}
  footBtn('Enviar →',()=>{if(chosen==null){toast('Escolha um valor');return;}if(sound)beep('tick');send({val:chosen});flashSent();});
};
function textCollect(q,ctl,ph){
  const w=el(`<div class="play-input"><textarea class="big-input" id="tx" rows="3" placeholder="${ph}" style="font-size:19px;resize:none"></textarea></div>`);ctl.appendChild(w);
  setTimeout(()=>w.querySelector('#tx').focus(),100);
  footBtn('Enviar →',()=>{if(sound)beep('tick');send({text:w.querySelector('#tx').value});flashSent();});
}
CTRL.cloud=(q,ctl)=>{
  const w=el(`<div class="play-input"><input class="big-input" id="cw" maxlength="20" placeholder="Uma palavra..." autocomplete="off"></div>`);ctl.appendChild(w);
  const i=w.querySelector('#cw');i.onkeydown=e=>{if(e.key==='Enter')doSend();};setTimeout(()=>i.focus(),100);
  function doSend(){if(sound)beep('tick');send({text:i.value});flashSent();}
  footBtn('Enviar →',doSend);
};
CTRL.open=(q,ctl)=>textCollect(q,ctl,'Escreva sua resposta...');
CTRL.brainstorm=(q,ctl)=>textCollect(q,ctl,'Sua ideia...');
function pinCtrl(q,ctl){
  const w=el(`<div class="pinwrap" id="pm">${mapSVG()}<div class="pin" id="myp" style="display:none">${IPin('#FF3D81')}</div></div>`);ctl.appendChild(w);
  const myp=w.querySelector('#myp');let placed=null;
  w.onclick=e=>{const r=w.getBoundingClientRect();const x=clamp((e.clientX-r.left)/r.width*100,0,100),y=clamp((e.clientY-r.top)/r.height*100,0,100);placed={x,y};myp.style.display='block';myp.style.left=x+'%';myp.style.top=y+'%';};
  footBtn('Confirmar →',()=>{if(!placed){toast('Toque no mapa');return;}if(sound)beep('tick');send(placed);flashSent();});
}
CTRL.pin=pinCtrl; CTRL.pinop=pinCtrl;

function flashSent(){
  const body=document.getElementById('pbody');if(!body)return;
  setTimeout(()=>{ if(answered){ root.innerHTML=gameShell();
    document.getElementById('pbody').innerHTML=`<div class="answered-msg"><div class="em">✅</div><h2 style="font-size:24px">Resposta enviada!</h2><p style="opacity:.75;font-weight:700;margin-top:8px">Olhe para a tela principal 👀</p></div>`;
  }},250);
}

/* ---------- resultado / posição / fim ---------- */
function resultScreen(r){
  if(sound)beep(r.correct?'good':'bad');
  root.innerHTML=gameShell();
  const mood=r.correct?'good':'bad';
  const msg=r.correct?'Acertou! 🎉':'Não foi dessa vez';
  document.getElementById('pbody').innerHTML=`<div class="feedback ${mood}">
    <div class="big">${msg}</div>
    <div class="pts">${r.gained>0?'+'+r.gained+' pontos':'+0 pontos'}</div>
    ${r.streak>1?`<div style="margin-top:10px;font-weight:800;color:#FFD86B">🔥 ${r.streak} seguidas!</div>`:''}
    <div style="margin-top:18px;font-weight:800;opacity:.85">${r.rank}º de ${r.total} · ${r.score} pts</div></div>`;
}
function opinionSent(){
  root.innerHTML=gameShell();
  document.getElementById('pbody').innerHTML=`<div class="answered-msg"><div class="em">💬</div><h2 style="font-size:24px">Valeu pela resposta!</h2><p style="opacity:.75;font-weight:700;margin-top:8px">Olhe para a tela principal 👀</p></div>`;
}
function standingScreen(s){
  root.innerHTML=gameShell();
  document.getElementById('pbody').innerHTML=`<div class="answered-msg"><div style="margin-bottom:10px">${renderCharacter(me.avatar,me.acc,90)}</div>
    <h2 style="font-size:30px">${s.rank}º lugar</h2><p style="font-weight:800;opacity:.85;margin-top:6px">${s.score} pontos</p>
    <p style="opacity:.7;font-weight:700;margin-top:16px">Prepare-se para a próxima…</p></div>`;
}
function slideWait(){
  root.innerHTML=gameShell();
  document.getElementById('pbody').innerHTML=`<div class="answered-msg"><div class="em">📺</div><h2 style="font-size:24px">Olhe para a tela</h2></div>`;
}
function endScreen(e){
  if(e.rank===1&&sound){confetti();beep('good');}
  root.innerHTML=gameShell();
  const won=e.rank===1;
  document.getElementById('pbody').innerHTML=`<div class="feedback ${won?'good':'neutral'}">
    <div class="big">${won?'🏆 Você venceu!':e.rank+'º lugar'}</div>
    <div class="pts">${e.score} pontos</div>
    <p style="margin-top:18px;opacity:.8;font-weight:700">Obrigado por jogar! 💜</p></div>`;
}

/* ---------- eventos do servidor ---------- */
socket.on('player:joined',d=>{me.name=d.name;me.avatar=d.avatar;waitScreen(d.quizTitle);});
socket.on('player:error',m=>{toast(m);setTimeout(joinScreen,300);});
socket.on('player:question',renderQuestion);
socket.on('player:submitted',d=>{ if(d&&d.opinion) opinionSent(); });
socket.on('player:result',resultScreen);
socket.on('player:standing',standingScreen);
socket.on('player:slide',slideWait);
socket.on('player:end',endScreen);
socket.on('disconnect',()=>toast('Conexão perdida'));

joinScreen();
