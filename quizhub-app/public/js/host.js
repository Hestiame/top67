/* host.js — app do apresentador (telão) */
const socket = io();
const root = document.getElementById('root');
let game = null;        // {pin, qr, joinUrl, ip, port}
let curQ = null;        // pergunta atual (host:question)
let tick = null;

/* ---------- HOME: escolher quiz ---------- */
async function home(){
  let quizzes=[];
  try{ quizzes=await (await fetch('/api/quizzes')).json(); }catch(e){}
  const thumbs=['linear-gradient(135deg,#6C2BD9,#FF3D81)','linear-gradient(135deg,#2D8CFF,#17C3B2)','linear-gradient(135deg,#9B59F6,#FF3D81)','linear-gradient(135deg,#26C281,#2D8CFF)'];
  root.innerHTML=`<div class="hwrap">
    <div class="htop">
      <div style="display:flex;align-items:center;gap:12px">${logo(38)}<span class="brand-name">quiz<b>Hub</b></span><span class="chip muted">Apresentador</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" id="ai">✨ Criar com IA</button><button class="btn btn-ghost btn-sm" id="novo">＋ Criar do zero</button><button class="btn btn-line btn-sm" id="imp">⬆ Importar</button></div>
    </div>
    <h2 style="font-size:24px;margin-bottom:14px">Escolha um quiz para apresentar</h2>
    <div class="grid" id="grid"></div>
    <p style="color:var(--muted);font-weight:700;margin-top:26px">💡 Os jogadores entram em <b>${location.host}</b> e digitam o PIN (ou usam o QR que aparece no jogo).</p>
  </div>`;
  const grid=document.getElementById('grid');
  if(!quizzes.length) grid.innerHTML=`<p style="color:var(--muted);font-weight:700">Nenhum quiz ainda. Importe um arquivo .json.</p>`;
  quizzes.forEach((q,i)=>{
    const types=[...new Set(q.questions.map(x=>x.type))].length;
    const c=el(`<div class="qcard">
      <div class="thumb" style="background:${thumbs[i%thumbs.length]}"><span class="count">${q.questions.length} perguntas · ${types} tipos</span></div>
      <div class="b"><h3>${esc(q.title)}</h3><p>${esc(q.desc||'')}</p>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn btn-primary btn-sm" data-host="${q.id}" style="flex:1">▶ Apresentar</button>
          <button class="btn btn-line btn-sm" data-edit="${q.id}" title="Editar">✏️</button>
          <button class="btn btn-line btn-sm" data-exp="${q.id}" title="Exportar">⬇</button>
          <button class="btn btn-line btn-sm" data-del="${q.id}" title="Apagar">🗑</button>
        </div></div></div>`);
    grid.appendChild(c);
  });
  grid.querySelectorAll('[data-host]').forEach(b=>b.onclick=()=>socket.emit('host:create',{quizId:b.dataset.host,origin:location.origin}));
  grid.querySelectorAll('[data-exp]').forEach(b=>b.onclick=async()=>{
    const q=await (await fetch('/api/quiz/'+b.dataset.exp)).json();
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(q,null,2)],{type:'application/json'}));
    a.download=(q.title||'quiz')+'.json';a.click();
  });
  document.getElementById('imp').onclick=()=>document.getElementById('importFile').click();
  document.getElementById('ai').onclick=aiScreen;
  document.getElementById('novo').onclick=()=>openEditor({title:'Quiz sem título',desc:'',questions:[]},true);
  grid.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const q=quizzes.find(x=>x.id===b.dataset.edit);if(q)openEditor(q,false);});
  grid.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    const q=quizzes.find(x=>x.id===b.dataset.del); if(!q)return;
    if(confirm('Apagar o quiz "'+q.title+'"?\nIsso não tem como desfazer.')){
      try{ await fetch('/api/quiz/'+q.id,{method:'DELETE'}); toast('Quiz apagado'); home(); }catch(e){ toast('Erro ao apagar'); }
    }
  });
}
document.getElementById('importFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const q=JSON.parse(await f.text());delete q.id;
    await fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});
    toast('Quiz importado ✓');home();
  }catch(err){toast('Arquivo inválido');}
};

/* ---------- telão (fundo escuro) ---------- */
function shell(topRight){
  root.innerHTML=`<div class="play">
    <div class="play-bg"><div class="blob" style="width:340px;height:340px;left:-60px;top:-40px;background:#6C2BD9"></div>
      <div class="blob" style="width:300px;height:300px;right:-40px;bottom:-60px;background:#FF3D81"></div>
      <div class="blob" style="width:220px;height:220px;right:30%;top:20%;background:#2D8CFF;opacity:.5"></div></div>
    <div class="play-top" id="ptop">${topRight||''}</div>
    <div class="play-body" id="pbody"></div>
    <div class="foot" id="pfoot"></div></div>`;
}
function footBtn(label,fn,ghost){const f=document.getElementById('pfoot');const b=el(`<button class="foot-btn ${ghost?'ghost':''}">${label}</button>`);b.onclick=fn;f.appendChild(b);return b;}

/* ---------- lobby ---------- */
function lobby(){
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="scorepill">${logo(22)} quizHub</span><span></span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  document.getElementById('pbody').innerHTML=`<div class="lobby">
    <p style="opacity:.85;font-weight:800;font-size:18px">Entre no celular e digite o PIN</p>
    <div class="join-info">
      <div><div class="pin-display">${game.pin}</div><p style="opacity:.8;font-weight:700">${esc((game.joinUrl||'').replace(/^https?:\/\//,'').replace(/\/\?pin=.*$/,''))}</p></div>
      ${game.qr?`<div style="text-align:center"><img src="${game.qr}" width="150" height="150" alt="QR"><p style="opacity:.8;font-weight:700;font-size:13px;margin-top:4px">aponte a câmera</p></div>`:''}
    </div>
    <h2 style="font-size:24px;margin-top:10px">${esc(game.quizTitle)}</h2>
    <div class="players-join" id="pj"></div></div>`;
  document.getElementById('pfoot').innerHTML='';
  footBtn('Começar →',()=>socket.emit('host:start'));
}
function renderRoster(players){
  const pj=document.getElementById('pj');if(!pj)return;
  pj.innerHTML=players.map(p=>`<span class="pj">${renderCharacter(p.avatar,p.acc,28)}${esc(p.name)}</span>`).join('')
    || `<span style="opacity:.7;font-weight:700">aguardando jogadores…</span>`;
}

/* ---------- pergunta ---------- */
function startTick(time){
  clearInterval(tick);let rem=time;
  const t=document.getElementById('timer');if(!t||time<=0)return;
  tick=setInterval(()=>{rem--;if(t){t.textContent=Math.max(0,rem);t.classList.toggle('low',rem<=5);}if(rem<=0)clearInterval(tick);},1000);
}
function hostQuestion(d){
  curQ=d; const q=d.question;
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="qcount">Pergunta ${d.index+1}/${d.total}</span>
    ${q.time>0?`<div class="timer" id="timer">${q.time}</div>`:`<span class="scorepill" id="ac">0 respostas</span>`}`);
  document.getElementById('quit').onclick=()=>location.reload();
  const body=document.getElementById('pbody');
  let media='';
  if(q.type==='audioquiz')media=`<div style="margin:10px 0"><button class="foot-btn" id="aud">🔊 Tocar áudio</button></div>`;
  body.innerHTML=`<h1 class="q-title">${esc(q.text)}</h1>${media}<div id="disp" style="width:100%;display:flex;justify-content:center"></div>
    <div style="margin-top:16px"><span class="scorepill" id="ac">0 responderam</span></div>`;
  if(q.type==='audioquiz'){const a=document.getElementById('aud');a.onclick=()=>playMelody(q.melody);setTimeout(()=>playMelody(q.melody),500);}
  showQuestionDisplay(q,d.shuffledItems,false);
  document.getElementById('pfoot').innerHTML='';
  if(q.time>0)footBtn('Pular ⏭',()=>socket.emit('host:skip'),true);
  startTick(q.time);
}
function showQuestionDisplay(q,shuffled,reveal){
  const disp=document.getElementById('disp');if(!disp)return;
  if(q.type==='quiz'||q.type==='audioquiz'||q.type==='poll'){
    disp.innerHTML=`<div class="answers">`+q.answers.map((a,i)=>{
      if(!a.t)return'';
      const cls=reveal?(a.correct?'right':'dim'):'';
      return `<div class="ans ${SHAPE_CLASS[i]} ${cls}"><span class="shape">${shapeSVG(i,28)}</span><span>${esc(a.t)}</span>${reveal&&a.correct?'<span class="mark">✓</span>':''}</div>`;
    }).join('')+`</div>`;
  }else if(q.type==='truefalse'){
    disp.innerHTML=`<div class="tf-grid">`+q.answers.map((a,i)=>{
      const cls=reveal?(a.correct?'right':'dim'):'';
      return `<div class="ans ${cls}" style="background:${i===0?'var(--a-green)':'var(--a-red)'};justify-content:center;font-size:24px">${i===0?'✓':'✕'} ${esc(a.t)}${reveal&&a.correct?' ✓':''}</div>`;
    }).join('')+`</div>`;
  }else if(q.type==='type'){
    disp.innerHTML=reveal?`<div style="font-size:24px;font-weight:800">Resposta: <span style="color:#9CFFCB">${esc(q.accepted[0])}</span></div>`
      :`<div class="answered-msg"><div class="em">⌨️</div><p style="font-weight:700;opacity:.8">Digite a resposta no celular</p></div>`;
  }else if(q.type==='puzzle'){
    const list=reveal?q.items:(shuffled||q.items);
    disp.innerHTML=`<div class="puzzle-list">`+list.map((t,i)=>`<div class="puzzle-item" ${reveal?'style="background:rgba(38,194,129,.25)"':''}><span class="pos">${i+1}</span><span>${esc(t)}</span></div>`).join('')+`</div>`;
  }else if(q.type==='slider'){
    if(reveal){const range=Math.abs(q.max-q.min)||1,px=clamp((q.correct-q.min)/range*100,0,100);
      disp.innerHTML=`<div class="slider-wrap"><div style="position:relative;height:60px;margin-top:20px"><div style="position:absolute;left:0;right:0;top:26px;height:10px;border-radius:999px;background:rgba(255,255,255,.18)"></div>
        <div style="position:absolute;top:-6px;left:${px}%;transform:translateX(-50%);text-align:center"><div style="font-weight:800;color:#9CFFCB">${q.correct}${esc(q.unit?' '+q.unit:'')}</div><div style="font-size:22px">📍</div></div></div></div>`;
    }else disp.innerHTML=`<div class="answered-msg"><div class="em">⇆</div><p style="font-weight:700;opacity:.8">Arraste a barra no celular (${q.min}–${q.max})</p></div>`;
  }else if(q.type==='pin'){
    disp.innerHTML=`<div class="pinwrap" style="max-width:560px">${mapSVG()}${reveal?`<div class="pin" style="left:${q.target.x}%;top:${q.target.y}%">${IPin('#26C281')}</div>`:''}</div>`;
  }
}

/* ---------- reveal (com pontos) ---------- */
function hostReveal(d){
  clearInterval(tick);
  const q=d.question;
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="qcount">Resultado</span><span class="scorepill">⭐ Ranking a seguir</span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  const body=document.getElementById('pbody');
  body.innerHTML=`<h1 class="q-title" style="font-size:26px;margin-bottom:14px">${esc(q.text)}</h1><div id="disp" style="width:100%;display:flex;justify-content:center"></div>`;
  // reidrata accepted/items/etc já vêm no q
  showQuestionDisplay(q,d.shuffledItems,true);
  footBtn('Ver ranking →',()=>socket.emit('host:next'));
}
/* ---------- leaderboard ---------- */
function hostLeaderboard(d){
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="qcount">Ranking</span><span></span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  document.getElementById('pbody').innerHTML=`<h1 class="q-title" style="margin-bottom:20px">Ranking</h1><div class="lead">`+
    d.leaderboard.map((p,i)=>`<div class="lrow" style="animation-delay:${i*0.06}s"><span class="rk">${p.rank}</span>${renderCharacter(p.avatar,p.acc,32)}<span class="nm">${esc(p.name)}</span>${p.lastGain?`<span style="opacity:.8;font-size:13px;font-weight:800">+${p.lastGain}</span>`:''}<span class="pt">${p.score}</span></div>`).join('')+`</div>`;
  footBtn(d.last?'Ver pódio →':'Próxima pergunta →',()=>socket.emit('host:next'));
}
/* ---------- agregados (opinião) ---------- */
function hostAggregate(d){
  clearInterval(tick);
  const q=d.question,data=d.data;
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="qcount">Respostas</span><span></span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  const body=document.getElementById('pbody');let html=`<h1 class="q-title" style="margin-bottom:18px">${esc(q.text)}</h1>`;
  if(data.kind==='poll'){
    const total=data.counts.reduce((a,b)=>a+b,0)||1;
    html+=`<div class="poll-bars">`+data.answers.map((t,i)=>{if(!t)return'';const pct=Math.round(data.counts[i]/total*100);
      return `<div class="poll-bar"><div class="pl"><span class="shape">${shapeSVG(i,18)}</span>${esc(t)}</div><div class="track"><div class="fill ${SHAPE_CLASS[i]}" style="width:${Math.max(pct,8)}%">${pct}%</div></div></div>`;}).join('')+`</div>`;
  }else if(data.kind==='scale'){
    const max=Math.max(...data.counts,1);
    html+=`<div class="scale-dist">`+data.counts.map((c,i)=>`<div class="c"><div class="b" style="height:${Math.max(c/max*100,4)}%"></div><div class="lb">${data.smin+i}</div></div>`).join('')+`</div>
      <div class="scale-labels" style="max-width:420px"><span>${esc(data.labels[0]||'')}</span><span>${esc(data.labels[1]||'')}</span></div>`;
  }else if(data.kind==='cloud'){
    const max=Math.max(...data.words.map(w=>w.n),1),cols=['#9CFFCB','#FFD86B','#7DC4FF','#FFB4C6','#C9B6FF','#fff'];
    html+=data.words.length?`<div class="cloud">`+data.words.map((w,i)=>`<span style="font-size:${20+(w.n/max)*46}px;color:${cols[i%6]};animation-delay:${i*0.04}s">${esc(w.w)}</span>`).join('')+`</div>`:`<p style="opacity:.7">sem respostas</p>`;
  }else if(data.kind==='notes'){
    html+=data.notes.length?`<div class="notes">`+data.notes.map((n,i)=>`<div class="note" style="animation-delay:${i*0.05}s"><b style="opacity:.6;font-size:12px">${esc(n.name)}</b><br>${esc(n.text)}</div>`).join('')+`</div>`:`<p style="opacity:.7">sem respostas</p>`;
  }else if(data.kind==='pins'){
    html+=`<div class="pinwrap" style="max-width:580px" id="pmv">${mapSVG()}</div>`;
  }
  body.innerHTML=html;
  if(data.kind==='pins'){const w=document.getElementById('pmv');data.pins.forEach((p,i)=>{const m=el(`<div class="pin" style="left:${p.x}%;top:${p.y}%;animation:pop .3s ease backwards;animation-delay:${i*0.05}s">${IPin('#FFD86B')}</div>`);w.appendChild(m);});}
  footBtn('Próximo →',()=>socket.emit('host:next'));
}
/* ---------- slide ---------- */
function hostSlide(d){
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="qcount">${d.index+1}/${d.total}</span><span></span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  document.getElementById('pbody').innerHTML=`<div class="slide-card"><h2>${esc(d.text)}</h2>${d.body?`<p>${esc(d.body)}</p>`:''}</div>`;
  footBtn('Continuar →',()=>socket.emit('host:next'));
}
/* ---------- fim ---------- */
function hostEnd(d){
  confetti();
  shell(`<button class="qcount" id="quit">✕ Sair</button><span class="scorepill">${logo(22)} Resultado</span><span></span>`);
  document.getElementById('quit').onclick=()=>location.reload();
  const top=d.podium,order=[1,0,2];
  document.getElementById('pbody').innerHTML=`<h1 class="q-title">🏆 Pódio</h1><div class="podium">`+
    order.filter(i=>top[i]).map(i=>{const p=top[i],place=i+1;
      return `<div class="pod p${place}">${renderCharacter(p.avatar,p.acc,72)}<div class="colp"><span class="rk">${place}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score} pts</span></div></div>`;
    }).join('')+`</div>`;
  document.getElementById('pfoot').innerHTML='';
  footBtn('🏠 Início',()=>location.reload());
}

/* ---------- eventos ---------- */
socket.on('host:created',d=>{game=d;lobby();});
socket.on('host:roster',d=>renderRoster(d.players));
socket.on('host:question',hostQuestion);
socket.on('host:answered',d=>{const a=document.getElementById('ac');if(a)a.textContent=`${d.count}/${d.total} responderam`;});
socket.on('host:reveal',hostReveal);
socket.on('host:leaderboard',hostLeaderboard);
socket.on('host:aggregate',hostAggregate);
socket.on('host:slide',hostSlide);
socket.on('host:end',hostEnd);
socket.on('host:error',m=>{toast(m);});
socket.on('host:warn',m=>toast(m));

/* ---------- CRIAR COM IA ---------- */
async function aiScreen(prefill){
  let status={};
  try{ status=await (await fetch('/api/ai-status')).json(); }catch(e){}
  root.innerHTML=`<div class="hwrap">
    <div class="htop"><div style="display:flex;align-items:center;gap:12px">${logo(38)}<span class="brand-name">quiz<b>Hub</b></span><span class="chip">✨ Criar com IA</span></div>
      <button class="btn btn-line btn-sm" id="back">← Voltar</button></div>
    ${status.ready===false?`<div style="background:#FFF2D6;border:1px solid #F0D48A;border-radius:14px;padding:14px 16px;margin-bottom:18px;color:#7a5a10;font-weight:700">
      ⚠️ A IA (${esc(status.name||'')}) ainda não está configurada. Crie uma chave grátis em <b>console.groq.com/keys</b>, coloque no arquivo <b>.env</b> (campo <b>${esc(status.keyEnv||'GROQ_API_KEY')}</b>) e reinicie o servidor.</div>`:''}
    <div style="max-width:640px">
      <h2 style="font-size:26px;margin-bottom:6px">Gerar um quiz com IA</h2>
      <p style="color:var(--muted);font-weight:700;margin-bottom:18px">Diga o tema e a IA monta o quiz com tipos variados. Você revisa antes de salvar.${status.name?` <span class="chip muted">via ${esc(status.name)}</span>`:''}</p>
      <label style="font-weight:800;font-size:13px;color:var(--muted)">Tema do quiz</label>
      <textarea class="inp" id="theme" rows="2" placeholder="Ex: crie um kahoot sobre a Alemanha nazista" style="margin:6px 0 16px;font-size:17px">${esc(prefill&&prefill.theme||'')}</textarea>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px"><label style="font-weight:800;font-size:13px;color:var(--muted)">Quantas perguntas?</label>
          <select class="inp" id="count" style="margin-top:6px">
            ${[5,8,10,12,15].map(n=>`<option value="${n}" ${(prefill&&prefill.count||8)===n?'selected':''}>${n} perguntas</option>`).join('')}</select></div>
        <div style="flex:1;min-width:160px"><label style="font-weight:800;font-size:13px;color:var(--muted)">Dificuldade</label>
          <select class="inp" id="diff" style="margin-top:6px">
            <option value="facil">Fácil</option><option value="medio" selected>Médio</option><option value="dificil">Difícil</option></select></div>
      </div>
      <button class="btn btn-primary btn-block" id="gen" style="margin-top:22px">✨ Gerar quiz</button>
      <div id="genmsg" style="text-align:center;margin-top:16px;font-weight:700;color:var(--muted)"></div>
    </div></div>`;
  document.getElementById('back').onclick=home;
  document.getElementById('gen').onclick=async()=>{
    const theme=document.getElementById('theme').value.trim();
    const count=parseInt(document.getElementById('count').value);
    const difficulty=document.getElementById('diff').value;
    if(!theme){toast('Digite um tema');return;}
    const btn=document.getElementById('gen'),msg=document.getElementById('genmsg');
    btn.disabled=true;btn.textContent='Gerando…';
    msg.innerHTML=`<span style="display:inline-block;width:16px;height:16px;border:3px solid var(--line);border-top-color:var(--brand2);border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle"></span> A IA está montando seu quiz… (pode levar alguns segundos)`;
    try{
      const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme,count,difficulty})});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'Falha ao gerar');
      aiPreview(data.quiz,{theme,count,difficulty});
    }catch(e){
      btn.disabled=false;btn.textContent='✨ Gerar quiz';
      msg.innerHTML=`<span style="color:var(--bad)">${esc(e.message)}</span>`;
    }
  };
}
function previewDetail(q){
  if(q.type==='quiz'){
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">`+q.answers.map((a,i)=>
      `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;background:${a.correct?'#E7F8EF':'var(--bg)'};border:1px solid ${a.correct?'#A6E6C4':'var(--line)'};font-weight:700;font-size:14px"><span style="width:14px;height:14px;border-radius:4px;display:inline-block;background:${['#F2426A','#2D8CFF','#FFB020','#26C281'][i%4]}"></span>${esc(a.t)}${a.correct?' <b style="color:var(--good);margin-left:auto">✓</b>':''}</div>`).join('')+`</div>`;
  }
  if(q.type==='truefalse'){const c=q.answers[0].correct?'Verdadeiro':'Falso';
    return `<p style="margin-top:6px;font-weight:700;font-size:14px">Resposta certa: <b style="color:var(--good)">${c}</b></p>`;}
  if(q.type==='type')
    return `<p style="margin-top:6px;font-weight:700;font-size:14px">Aceita: ${q.accepted.map(a=>`<span class="chip muted" style="margin:2px">${esc(a)}</span>`).join('')}</p>`;
  if(q.type==='puzzle')
    return `<ol style="margin:8px 0 0 20px;font-weight:700;font-size:14px">${q.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ol><p style="color:var(--muted);font-size:12px;font-weight:700;margin-top:4px">(embaralhado no jogo)</p>`;
  if(q.type==='slider')
    return `<p style="margin-top:6px;font-weight:700;font-size:14px">Faixa ${q.min}–${q.max}${q.unit?' '+esc(q.unit):''} · resposta <b style="color:var(--good)">${q.correct}${q.unit?' '+esc(q.unit):''}</b></p>`;
  return '';
}
function aiPreview(quiz, params){
  const tmap={quiz:'Múltipla escolha',truefalse:'Verdadeiro/Falso',type:'Resposta curta',puzzle:'Quebra-cabeça',slider:'Controle deslizante'};
  const tcol={quiz:'#6C2BD9',truefalse:'#2D8CFF',type:'#26C281',puzzle:'#FFB020',slider:'#F2426A'};
  root.innerHTML=`<div class="hwrap">
    <div class="htop"><div style="display:flex;align-items:center;gap:12px">${logo(38)}<span class="brand-name">quiz<b>Hub</b></span><span class="chip">✨ Revisar</span></div></div>
    <div style="max-width:760px;margin:0 auto">
      <input class="inp" id="qtitle" value="${esc(quiz.title)}" style="font-family:var(--disp);font-weight:600;font-size:22px;margin-bottom:6px">
      <p style="color:var(--muted);font-weight:700;margin-bottom:6px">${esc(quiz.desc)}</p>
      <span class="chip muted">${quiz.questions.length} perguntas geradas — confira e ajuste se quiser</span>
      <div id="qs" style="margin:18px 0"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;position:sticky;bottom:0;background:var(--bg);padding:14px 0">
        <button class="btn btn-primary" id="save" style="flex:1;min-width:140px">💾 Salvar quiz</button>
        <button class="btn btn-line" id="edit">✏️ Editar</button>
        <button class="btn btn-line" id="regen">🔄 Gerar de novo</button>
      </div>
    </div></div>`;
  document.getElementById('qtitle').oninput=e=>quiz.title=e.target.value;
  const qs=document.getElementById('qs');
  quiz.questions.forEach((q,i)=>{
    qs.appendChild(el(`<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="width:26px;height:26px;border-radius:8px;background:var(--ink);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center">${i+1}</span>
        <span class="chip" style="background:${tcol[q.type]}22;color:${tcol[q.type]}">${tmap[q.type]||q.type}</span>
        <span class="chip muted">${q.points>0?q.points+' pts':'—'} · ${q.time}s</span></div>
      <p style="font-family:var(--disp);font-weight:600;font-size:18px;margin-top:6px">${esc(q.text)}</p>
      ${previewDetail(q)}</div>`));
  });
  document.getElementById('regen').onclick=()=>aiScreen(params);
  document.getElementById('edit').onclick=()=>openEditor(quiz,true);
  document.getElementById('save').onclick=async()=>{
    const b=document.getElementById('save');b.disabled=true;b.textContent='Salvando…';
    try{
      await fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(quiz)});
      toast('Quiz salvo ✓');home();
    }catch(e){b.disabled=false;b.textContent='💾 Salvar quiz';toast('Erro ao salvar');}
  };
}

home();

/* ============================== EDITOR DE QUIZ ============================== */
let ed=null;
function uid(){return Math.random().toString(36).slice(2,9);}
const ICheck='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const EDTYPES={
  quiz:{name:'Quiz',ico:'◆',color:'#6C2BD9',group:'know',desc:'Múltipla escolha'},
  truefalse:{name:'Verdadeiro/Falso',ico:'✓✕',color:'#2D8CFF',group:'know',desc:'Duas opções'},
  type:{name:'Resposta curta',ico:'⌨',color:'#26C281',group:'know',desc:'Digitar a resposta'},
  puzzle:{name:'Quebra-cabeça',ico:'⇅',color:'#FFB020',group:'know',desc:'Ordenar itens'},
  audioquiz:{name:'Quiz + áudio',ico:'♫',color:'#9B59F6',group:'know',desc:'Quiz com som'},
  slider:{name:'Controle deslizante',ico:'⇆',color:'#F2426A',group:'know',desc:'Número numa barra'},
  pin:{name:'Largar marcador',ico:'⚲',color:'#17C3B2',group:'know',desc:'Marcar no mapa'},
  poll:{name:'Enquete',ico:'▣',color:'#6C2BD9',group:'op',desc:'Votação'},
  cloud:{name:'Nuvem de palavras',ico:'❋',color:'#2D8CFF',group:'op',desc:'Palavras viram nuvem'},
  open:{name:'Pergunta aberta',ico:'❝',color:'#26C281',group:'op',desc:'Resposta livre'},
  brainstorm:{name:'Brainstorm',ico:'✦',color:'#FFB020',group:'op',desc:'Coletar ideias'},
  scale:{name:'Escala',ico:'⏱',color:'#F2426A',group:'op',desc:'Likert 1–5'},
  pinop:{name:'Marcador (opinião)',ico:'⚐',color:'#17C3B2',group:'op',desc:'Pin sem resposta'},
  slide:{name:'Slide',ico:'ℹ',color:'#7C6F93',group:'info',desc:'Só informação'}
};
const EDGROUPS=[{id:'know',label:'Avaliar conhecimento',sub:'Valem pontos'},{id:'op',label:'Coletar opiniões',sub:'Não valem pontos'},{id:'info',label:'Apresentar informações',sub:''}];
function newQuestion(type){
  const base={id:uid(),type,text:'',time:20,points:1000};
  switch(type){
    case 'quiz': return {...base,answers:[{t:'',correct:false},{t:'',correct:false},{t:'',correct:false},{t:'',correct:false}],multi:false};
    case 'truefalse': return {...base,answers:[{t:'Verdadeiro',correct:true},{t:'Falso',correct:false}]};
    case 'type': return {...base,time:30,accepted:['']};
    case 'puzzle': return {...base,items:['','','','']};
    case 'audioquiz': return {...base,answers:[{t:'',correct:false},{t:'',correct:false},{t:'',correct:false},{t:'',correct:false}],melody:[0,2,4,5,7]};
    case 'slider': return {...base,min:0,max:100,correct:50,step:1,unit:''};
    case 'pin': return {...base,map:'world',target:{x:50,y:50},tol:14};
    case 'poll': return {...base,points:0,answers:[{t:''},{t:''},{t:''},{t:''}]};
    case 'cloud': return {...base,points:0,time:40};
    case 'open': return {...base,points:0,time:60};
    case 'brainstorm': return {...base,points:0,time:60};
    case 'scale': return {...base,points:0,smin:1,smax:5,labels:['Discordo','Concordo']};
    case 'pinop': return {...base,points:0,map:'world'};
    case 'slide': return {...base,points:0,time:0,body:''};
  }
  return base;
}
function openEditor(quiz,isNew){
  ed={quiz:JSON.parse(JSON.stringify(quiz)),qi:0,isNew:!!isNew};
  if(!ed.quiz.id) ed.quiz.id=uid();
  if(!ed.quiz.questions||!ed.quiz.questions.length) ed.quiz.questions=[newQuestion('quiz')];
  editorScreen();
}
function editorScreen(){
  root.innerHTML=`
   <div class="ed-topbar">
     <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
       <button class="btn btn-line btn-sm" id="edBack">←</button>${logo(28)}
       <input class="inp" id="edTitle" value="${esc(ed.quiz.title||'')}" placeholder="Título do quiz" style="max-width:340px;font-family:var(--disp);font-weight:600;font-size:18px">
     </div>
     <div style="display:flex;gap:8px">
       <button class="btn btn-line btn-sm" id="edPlay">▶ Testar</button>
       <button class="btn btn-primary btn-sm" id="edSave">💾 Salvar</button>
     </div></div>
   <div class="creator"><div class="q-list" id="qlist"></div><div class="editor" id="editor"></div></div>`;
  document.getElementById('edBack').onclick=()=>{ if(confirm('Sair sem salvar? Alterações não salvas serão perdidas.')) home(); };
  document.getElementById('edSave').onclick=()=>saveEditor(false);
  document.getElementById('edPlay').onclick=()=>saveEditor(true);
  document.getElementById('edTitle').oninput=e=>ed.quiz.title=e.target.value;
  edQList(); edRender();
}
function edQList(){
  const list=document.getElementById('qlist'); list.innerHTML='';
  ed.quiz.questions.forEach((q,i)=>{
    const T=EDTYPES[q.type]||{name:q.type,ico:'?',color:'#888'};
    const li=el(`<div class="qli ${i===ed.qi?'active':''}">
      <span class="num">${i+1}</span><span class="ico" style="color:${T.color}">${T.ico}</span>
      <span class="meta"><span class="t">${esc(q.text||T.name)}</span><span class="s">${esc(T.name)}</span></span></div>`);
    li.onclick=()=>{ed.qi=i;edQList();edRender();};
    list.appendChild(li);
  });
  const add=el(`<button class="btn btn-line btn-sm" style="margin-top:6px">＋ Pergunta</button>`);
  add.onclick=openAddModal; list.appendChild(add);
}
function edRender(){
  const quiz=ed.quiz; if(ed.qi>=quiz.questions.length)ed.qi=quiz.questions.length-1;
  const q=quiz.questions[ed.qi], box=document.getElementById('editor'); const T=EDTYPES[q.type]||{name:q.type,ico:'?',color:'#888'};
  box.innerHTML=`<div class="editor-head">
      <div style="display:flex;align-items:center;gap:10px"><span class="chip" style="background:${T.color}22;color:${T.color}">${T.ico} ${esc(T.name)}</span>
        <span class="chip muted">Pergunta ${ed.qi+1}/${quiz.questions.length}</span></div>
      <div style="display:flex;gap:8px"><button class="btn btn-line btn-sm" id="dup">Duplicar</button>
        <button class="btn btn-line btn-sm" id="del" ${quiz.questions.length<=1?'disabled':''}>🗑</button></div>
    </div><div id="edbody"></div>`;
  document.getElementById('dup').onclick=()=>{const c=JSON.parse(JSON.stringify(q));c.id=uid();quiz.questions.splice(ed.qi+1,0,c);ed.qi++;edQList();edRender();};
  document.getElementById('del').onclick=()=>{if(quiz.questions.length<=1)return;quiz.questions.splice(ed.qi,1);ed.qi=Math.max(0,ed.qi-1);edQList();edRender();};
  (EDITORS[q.type]||EDITORS.quiz)(q,document.getElementById('edbody'));
}
function settingsRow(q){
  const scored=SCORED.includes(q.type);
  return `<div class="row" style="margin-bottom:20px">
    ${q.type!=='slide'?`<div><label>Tempo (s)</label><input class="inp" type="number" min="5" max="240" value="${q.time}" id="f-time"></div>`:''}
    ${scored?`<div><label>Pontos</label><select class="inp" id="f-points">
      <option value="0"${q.points===0?' selected':''}>Sem pontos</option>
      <option value="1000"${q.points===1000?' selected':''}>1000 (padrão)</option>
      <option value="2000"${q.points===2000?' selected':''}>2000 (dobro)</option></select></div>`:`<div><label>Tipo</label><div class="inp" style="background:var(--bg);border-color:transparent">Opinião — sem pontos</div></div>`}
  </div>`;
}
function bindSettings(q){const t=document.getElementById('f-time');if(t)t.oninput=e=>q.time=clamp(parseInt(e.target.value)||0,0,240);const p=document.getElementById('f-points');if(p)p.onchange=e=>q.points=parseInt(e.target.value);}
function qTextField(q,ph){return `<div class="field"><label>Pergunta</label><input class="q-input" id="f-text" placeholder="${ph||'Digite a pergunta...'}" value="${esc(q.text)}"></div>`;}
function bindText(q){const f=document.getElementById('f-text');f.oninput=e=>{q.text=e.target.value;const li=document.querySelector('.qli.active .t');if(li)li.textContent=q.text||(EDTYPES[q.type]||{}).name;};}
const EDITORS={};
function answersEditor(q,body,opts){
  opts=opts||{}; const correct=opts.correct!==false; const max=opts.max||6,min=opts.min||2;
  body.innerHTML=qTextField(q)+settingsRow(q)+(opts.pre||'')+
    `<div class="field"><label>Respostas ${correct?'(marque a✓ correta)':''}</label><div class="ans-grid" id="ansg"></div>
     <button class="btn btn-line btn-sm" id="addans" style="margin-top:12px" ${q.answers.length>=max?'disabled':''}>＋ Adicionar resposta</button></div>`;
  bindText(q);bindSettings(q);if(opts.after)opts.after();
  const g=document.getElementById('ansg');
  q.answers.forEach((a,i)=>{
    const row=el(`<div class="ans-edit ${SHAPE_CLASS[i]}"><span class="shape">${shapeSVG(i,24)}</span>
      <input placeholder="Resposta ${i+1}" value="${esc(a.t)}">
      ${correct?`<button class="corr ${a.correct?'on':''}" title="Correta">${a.correct?ICheck:''}</button>`:''}
      ${q.answers.length>min?`<button class="corr" data-rm style="background:rgba(0,0,0,.18)">✕</button>`:''}</div>`);
    row.querySelector('input').oninput=e=>a.t=e.target.value;
    if(correct)row.querySelector('.corr').onclick=()=>{if(!q.multi){q.answers.forEach(x=>x.correct=false);}a.correct=!a.correct;edRender();};
    const rm=row.querySelector('[data-rm]');if(rm)rm.onclick=()=>{q.answers.splice(i,1);edRender();};
    g.appendChild(row);
  });
  const add=document.getElementById('addans');if(add)add.onclick=()=>{if(q.answers.length<max){q.answers.push({t:'',correct:false});edRender();}};
}
EDITORS.quiz=(q,body)=>{
  answersEditor(q,body,{correct:true,pre:`<div class="field" style="margin-bottom:14px"><label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:14px;color:var(--text)"><input type="checkbox" id="f-multi" ${q.multi?'checked':''}> Permitir mais de uma resposta correta</label></div>`,
    after:()=>{const m=document.getElementById('f-multi');if(m)m.onchange=e=>{q.multi=e.target.checked;if(!q.multi){let f=false;q.answers.forEach(a=>{if(a.correct&&f)a.correct=false;if(a.correct)f=true;});}edRender();};}});
};
EDITORS.truefalse=(q,body)=>{
  body.innerHTML=qTextField(q,'Faça uma afirmação...')+settingsRow(q)+
    `<div class="field"><label>Qual é a correta?</label><div class="row">
       <button class="btn ${q.answers[0].correct?'btn-primary':'btn-line'}" id="tT" style="background:${q.answers[0].correct?'var(--good)':''};${q.answers[0].correct?'color:#fff':''}">✓ Verdadeiro</button>
       <button class="btn ${q.answers[1].correct?'btn-primary':'btn-line'}" id="tF" style="background:${q.answers[1].correct?'var(--bad)':''};${q.answers[1].correct?'color:#fff':''}">✕ Falso</button></div></div>`;
  bindText(q);bindSettings(q);
  document.getElementById('tT').onclick=()=>{q.answers[0].correct=true;q.answers[1].correct=false;edRender();};
  document.getElementById('tF').onclick=()=>{q.answers[0].correct=false;q.answers[1].correct=true;edRender();};
};
EDITORS.type=(q,body)=>{
  body.innerHTML=qTextField(q,'Pergunta de resposta curta...')+settingsRow(q)+
    `<div class="field"><label>Respostas aceitas (qualquer uma conta como certa)</label><div id="acc"></div>
     <button class="btn btn-line btn-sm" id="addacc" style="margin-top:8px">＋ Adicionar variação</button>
     <p class="help">Dica: adicione variações comuns (com/sem acento, sinônimos). A comparação ignora maiúsculas e acentos.</p></div>`;
  bindText(q);bindSettings(q);
  const acc=document.getElementById('acc');
  q.accepted.forEach((a,i)=>{
    const r=el(`<div class="opt-line"><span class="dot bg-green"></span><input class="inp" placeholder="Resposta aceita ${i+1}" value="${esc(a)}">${q.accepted.length>1?'<button class="rm">✕</button>':''}</div>`);
    r.querySelector('input').oninput=e=>q.accepted[i]=e.target.value;
    const rm=r.querySelector('.rm');if(rm)rm.onclick=()=>{q.accepted.splice(i,1);edRender();};
    acc.appendChild(r);
  });
  document.getElementById('addacc').onclick=()=>{q.accepted.push('');edRender();};
};
EDITORS.puzzle=(q,body)=>{
  body.innerHTML=qTextField(q,'Ex: ordene os eventos...')+settingsRow(q)+
    `<div class="field"><label>Itens na ORDEM CORRETA (serão embaralhados no jogo)</label><div id="items"></div>
     <button class="btn btn-line btn-sm" id="additem" style="margin-top:8px" ${q.items.length>=6?'disabled':''}>＋ Adicionar item</button></div>`;
  bindText(q);bindSettings(q);
  const box=document.getElementById('items');
  q.items.forEach((it,i)=>{
    const r=el(`<div class="opt-line">
      <span class="pos" style="width:30px;height:30px;border-radius:9px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${i+1}</span>
      <input class="inp" placeholder="Item ${i+1}" value="${esc(it)}">
      <div style="display:flex;gap:4px"><button class="rm" ${i===0?'disabled':''} data-up>↑</button>
        <button class="rm" ${i===q.items.length-1?'disabled':''} data-dn>↓</button>
        ${q.items.length>2?'<button class="rm" data-rm>✕</button>':''}</div></div>`);
    r.querySelector('input').oninput=e=>q.items[i]=e.target.value;
    r.querySelector('[data-up]').onclick=()=>{if(i>0){[q.items[i-1],q.items[i]]=[q.items[i],q.items[i-1]];edRender();}};
    r.querySelector('[data-dn]').onclick=()=>{if(i<q.items.length-1){[q.items[i+1],q.items[i]]=[q.items[i],q.items[i+1]];edRender();}};
    const rm=r.querySelector('[data-rm]');if(rm)rm.onclick=()=>{q.items.splice(i,1);edRender();};
    box.appendChild(r);
  });
  document.getElementById('additem').onclick=()=>{if(q.items.length<6){q.items.push('');edRender();}};
};
EDITORS.audioquiz=(q,body)=>{
  answersEditor(q,body,{correct:true,pre:`<div class="field"><label>Áudio da pergunta</label>
    <div class="media-box has" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span>🎵 Melodia de exemplo (${q.melody.length} notas)</span>
      <button class="btn btn-primary btn-sm" id="playmel" type="button">▶ Tocar</button></div>
    <p class="help">No protótipo o som é gerado pelo navegador (melodia de exemplo).</p></div>`,
    after:()=>{document.getElementById('playmel').onclick=()=>playMelody(q.melody);}});
};
EDITORS.slider=(q,body)=>{
  body.innerHTML=qTextField(q,'Ex: em que ano...?')+settingsRow(q)+
    `<div class="field"><label>Faixa da barra</label><div class="row">
      <div><label style="font-size:11px">Mínimo</label><input class="inp" type="number" id="s-min" value="${q.min}"></div>
      <div><label style="font-size:11px">Máximo</label><input class="inp" type="number" id="s-max" value="${q.max}"></div>
      <div><label style="font-size:11px">Passo</label><input class="inp" type="number" id="s-step" min="1" value="${q.step}"></div></div></div>
    <div class="field"><label>Resposta correta</label><div class="row">
      <div><input class="inp" type="number" id="s-corr" value="${q.correct}"></div>
      <div><label style="font-size:11px">Unidade (opcional)</label><input class="inp" id="s-unit" placeholder="ex: kg, %, anos" value="${esc(q.unit||'')}"></div>
    </div><p class="help">Quem chegar mais perto ganha mais pontos.</p></div>`;
  bindText(q);bindSettings(q);
  document.getElementById('s-min').oninput=e=>q.min=parseFloat(e.target.value)||0;
  document.getElementById('s-max').oninput=e=>q.max=parseFloat(e.target.value)||0;
  document.getElementById('s-step').oninput=e=>q.step=parseFloat(e.target.value)||1;
  document.getElementById('s-corr').oninput=e=>q.correct=parseFloat(e.target.value)||0;
  document.getElementById('s-unit').oninput=e=>q.unit=e.target.value;
};
function pinEditor(q,body,scored){
  body.innerHTML=qTextField(q,'Ex: onde fica...?')+settingsRow(q)+
    `<div class="field"><label>${scored?'Clique no mapa para marcar o ponto CORRETO':'Mapa de fundo'}</label>
     <div class="pinwrap" id="pmap" style="max-width:520px">${mapSVG()}${scored?`<div class="pin" style="left:${q.target.x}%;top:${q.target.y}%">${IPin('#26C281')}</div>`:''}</div>
     ${scored?`<div class="row" style="margin-top:12px"><div><label style="font-size:11px">Tolerância (raio %)</label><input class="inp" type="number" id="p-tol" min="4" max="40" value="${q.tol}"></div></div>`:'<p class="help">Sem resposta certa — os jogadores marcam onde quiserem.</p>'}</div>`;
  bindText(q);bindSettings(q);
  const map=document.getElementById('pmap');
  if(scored){
    map.onclick=e=>{const r=map.getBoundingClientRect();q.target.x=clamp((e.clientX-r.left)/r.width*100,0,100);q.target.y=clamp((e.clientY-r.top)/r.height*100,0,100);edRender();};
    const tol=document.getElementById('p-tol');if(tol)tol.oninput=e=>q.tol=clamp(parseInt(e.target.value)||10,4,40);
  }
}
EDITORS.pin=(q,body)=>pinEditor(q,body,true);
EDITORS.pinop=(q,body)=>pinEditor(q,body,false);
EDITORS.poll=(q,body)=>answersEditor(q,body,{correct:false,min:2,max:6});
function plainEditor(q,body,ph,help){body.innerHTML=qTextField(q,ph)+settingsRow(q)+`<p class="help">${help}</p>`;bindText(q);bindSettings(q);}
EDITORS.cloud=(q,body)=>plainEditor(q,body,'Ex: descreva em uma palavra...','Os participantes enviam palavras e elas formam uma nuvem — as mais repetidas aparecem maiores.');
EDITORS.open=(q,body)=>plainEditor(q,body,'Ex: o que você achou de...?','Respostas livres aparecem como cartões na tela. Não vale pontos.');
EDITORS.brainstorm=(q,body)=>plainEditor(q,body,'Ex: dê ideias para...','Coleta ideias da galera em post-its. Não vale pontos.');
EDITORS.scale=(q,body)=>{
  body.innerHTML=qTextField(q,'Ex: o quanto você concorda...?')+settingsRow(q)+
    `<div class="field"><label>Faixa da escala</label><div class="row">
      <div><label style="font-size:11px">De</label><input class="inp" type="number" id="sc-min" value="${q.smin}"></div>
      <div><label style="font-size:11px">Até</label><input class="inp" type="number" id="sc-max" min="2" max="10" value="${q.smax}"></div></div></div>
    <div class="field"><label>Rótulos das pontas</label><div class="row">
      <div><input class="inp" id="sc-l0" placeholder="Ex: Discordo" value="${esc(q.labels[0])}"></div>
      <div><input class="inp" id="sc-l1" placeholder="Ex: Concordo" value="${esc(q.labels[1])}"></div>
    </div><p class="help">Escala tipo Likert. Não vale pontos.</p></div>`;
  bindText(q);bindSettings(q);
  document.getElementById('sc-min').oninput=e=>q.smin=parseInt(e.target.value)||1;
  document.getElementById('sc-max').oninput=e=>q.smax=clamp(parseInt(e.target.value)||5,2,10);
  document.getElementById('sc-l0').oninput=e=>q.labels[0]=e.target.value;
  document.getElementById('sc-l1').oninput=e=>q.labels[1]=e.target.value;
};
EDITORS.slide=(q,body)=>{
  body.innerHTML=`<div class="field"><label>Título</label><input class="q-input" id="f-text" placeholder="Título do slide" value="${esc(q.text)}"></div>
    <div class="field"><label>Texto</label><textarea class="inp" id="s-body" rows="5" placeholder="Conteúdo que aparece na tela...">${esc(q.body||'')}</textarea>
    <p class="help">Slides não têm interação nem pontos — servem para explicar algo entre as perguntas.</p></div>`;
  bindText(q);
  document.getElementById('s-body').oninput=e=>q.body=e.target.value;
};
function closeEdModal(){const m=document.querySelector('.modal-bg');if(m)m.remove();}
function openAddModal(){
  const m=el(`<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>Adicionar pergunta</h2><button class="mclose" id="mc">✕</button></div><div id="groups"></div></div></div>`);
  m.onclick=e=>{if(e.target===m)closeEdModal();};
  document.body.appendChild(m);
  document.getElementById('mc').onclick=closeEdModal;
  const groups=document.getElementById('groups');
  EDGROUPS.forEach(gr=>{
    groups.appendChild(el(`<div class="group-h">${esc(gr.label)}${gr.sub?` <span class="chip muted" style="font-size:11px">${esc(gr.sub)}</span>`:''}</div>`));
    const grid=el(`<div class="type-grid"></div>`);
    Object.keys(EDTYPES).filter(k=>EDTYPES[k].group===gr.id).forEach(k=>{
      const T=EDTYPES[k];
      const c=el(`<button class="type-card"><span class="ti" style="background:${T.color}1f;color:${T.color}">${T.ico}</span><span class="tn">${esc(T.name)}</span><span class="td">${esc(T.desc)}</span></button>`);
      c.onclick=()=>addQuestion(k);grid.appendChild(c);
    });
    groups.appendChild(grid);
  });
}
function addQuestion(type){ed.quiz.questions.splice(ed.qi+1,0,newQuestion(type));ed.qi++;closeEdModal();edQList();edRender();}
async function saveEditor(thenPlay){
  if(!ed.quiz.title||!ed.quiz.title.trim()) ed.quiz.title='Quiz sem título';
  try{
    const r=await fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ed.quiz)});
    if(!r.ok) throw new Error();
    if(thenPlay===true){ toast('Salvo ✓ — iniciando teste'); socket.emit('host:create',{quizId:ed.quiz.id,origin:location.origin}); }
    else { toast('Quiz salvo ✓'); home(); }
  }catch(e){ toast('Erro ao salvar'); }
}
