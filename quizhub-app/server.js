/* =======================================================
   quizHub — servidor local (multiplayer por PIN)
   Express + Socket.io, estado em memória, sem banco/login.
   ======================================================= */
try { require('dotenv').config(); } catch (e) { /* dotenv opcional */ }
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- armazenamento simples em arquivo (sem banco) ---------- */
const DB_FILE = path.join(__dirname, 'quizzes.json');
function loadQuizzes() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return []; }
}
function saveQuizzes(list) {
  fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2));
}

/* ---------- API de quizzes (criar/editar/exportar) ---------- */
app.get('/api/quizzes', (req, res) => res.json(loadQuizzes()));
app.get('/api/quiz/:id', (req, res) => {
  const q = loadQuizzes().find(x => x.id === req.params.id);
  q ? res.json(q) : res.status(404).json({ error: 'não encontrado' });
});
app.post('/api/quiz', (req, res) => {
  const list = loadQuizzes();
  const quiz = req.body;
  if (!quiz.id) quiz.id = 'q' + Date.now().toString(36);
  const i = list.findIndex(x => x.id === quiz.id);
  if (i >= 0) list[i] = quiz; else list.push(quiz);
  saveQuizzes(list);
  res.json({ ok: true, id: quiz.id });
});
app.delete('/api/quiz/:id', (req, res) => {
  saveQuizzes(loadQuizzes().filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------- IA: gerar quiz a partir de um tema ---------- */
const AI = require('./ai');
app.get('/api/ai-status', (req, res) => res.json(AI.providerInfo()));
app.post('/api/generate', async (req, res) => {
  const theme = String((req.body && req.body.theme) || '').trim();
  const count = Math.max(3, Math.min(20, parseInt(req.body && req.body.count) || 8));
  const difficulty = String((req.body && req.body.difficulty) || 'medio');
  if (!theme) return res.status(400).json({ error: 'Diga um tema para gerar.', code: 'NOTHEME' });
  try {
    const quiz = await AI.generateQuiz({ theme, count, difficulty });
    res.json({ quiz });
  } catch (e) {
    res.status(e.code === 'NOKEY' ? 400 : 502).json({ error: e.message, code: e.code || 'ERR' });
  }
});

/* ---------- util ---------- */
function lanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name]) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address;
    }
  }
  return 'localhost';
}
const SCORED = ['quiz','truefalse','type','puzzle','audioquiz','slider','pin'];
function norm(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function newPin(){let p;do{p=String(Math.floor(100000+Math.random()*900000));}while(rooms[p]);return p;}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---------- estado de jogo (em memória) ---------- */
const rooms = {};   // pin -> room
const sockets = {}; // socket.id -> {pin, role, playerId}

function cleanAcc(a){ a=(a&&typeof a==='object')?a:{}; const out={}; ['hat','glasses'].forEach(s=>{ if(typeof a[s]==='string'&&a[s]&&a[s].length<40) out[s]=a[s]; }); return out; }
function roster(room){
  return Object.values(room.players).map(p => ({ id:p.id, name:p.name, avatar:p.avatar, acc:p.acc, score:p.score }));
}
function leaderboard(room){
  return Object.values(room.players)
    .sort((a,b)=>b.score-a.score)
    .map((p,i)=>({ rank:i+1, id:p.id, name:p.name, avatar:p.avatar, acc:p.acc, score:p.score, lastGain:p.lastGain||0, streak:p.streak||0 }));
}

/* ---------- payloads enviados ao jogador (sem revelar resposta certa) ---------- */
function playerQuestionPayload(q, room){
  const base = { type:q.type, index:room.qi, total:room.quiz.questions.length, time:q.time, text:q.text };
  if (q.type==='quiz'||q.type==='audioquiz'||q.type==='poll')
    base.answers = q.answers.map((a,i)=>({ i, t:a.t })).filter(a=>a.t);
  if (q.type==='quiz'||q.type==='audioquiz') base.multi = !!q.multi;
  else if (q.type==='truefalse')
    base.answers = q.answers.map((a,i)=>({ i, t:a.t }));
  else if (q.type==='slider')
    base.slider = { min:q.min, max:q.max, step:q.step, unit:q.unit||'' };
  else if (q.type==='scale')
    base.scale = { smin:q.smin, smax:q.smax, labels:q.labels };
  else if (q.type==='puzzle')
    base.items = room.shuffledItems;     // ordem embaralhada (mesma p/ todos nesta rodada)
  else if (q.type==='pin'||q.type==='pinop')
    base.map = q.map || 'world';
  return base;
}

/* ---------- avaliação (espelha a do protótipo) ---------- */
function evalAnswer(q, payload, frac){
  let close=0, correct=false;
  if (q.type==='quiz'||q.type==='audioquiz'){
    const sel=(payload&&payload.sel)||[];
    const corr=q.answers.map((a,i)=>a.correct?i:-1).filter(i=>i>=0);
    correct = sel.length===corr.length && sel.every(i=>corr.includes(i));
    close = correct?1:0;
  } else if (q.type==='truefalse'){
    correct = !!(payload && q.answers[payload.idx] && q.answers[payload.idx].correct);
    close = correct?1:0;
  } else if (q.type==='type'){
    const t=norm(payload&&payload.text);
    correct = t.length>0 && q.accepted.some(a=>norm(a)===t);
    close = correct?1:0;
  } else if (q.type==='puzzle'){
    const order=(payload&&payload.order)||[]; const n=q.items.length; let good=0;
    order.forEach((it,i)=>{ if(it===q.items[i]) good++; });
    close = n?good/n:0; correct = good===n;
  } else if (q.type==='slider'){
    const v=payload?payload.val:q.min; const range=Math.abs(q.max-q.min)||1;
    close=clamp(1-Math.abs(v-q.correct)/(range*0.5),0,1); correct=Math.abs(v-q.correct)<=range*0.06;
  } else if (q.type==='pin'){
    const pt=payload||{x:50,y:50}; const d=Math.hypot(pt.x-q.target.x,pt.y-q.target.y);
    close=clamp(1-d/(q.tol*2),0,1); correct=d<=q.tol;
  }
  const base = close>0 ? q.points*close*(1-frac*0.5) : 0;
  return { correct, close, base };
}

/* ---------- agregação (tipos de opinião) ---------- */
function aggregate(q, room){
  const ans = Object.values(room.players).map(p=>p.answer).filter(a=>a!=null);
  if (q.type==='poll'){
    const counts=q.answers.map(()=>0);
    ans.forEach(a=>{ if(a&&a.idx!=null&&counts[a.idx]!=null) counts[a.idx]++; });
    return { kind:'poll', counts, answers:q.answers.map(a=>a.t) };
  }
  if (q.type==='scale'){
    const n=q.smax-q.smin+1; const counts=Array(n).fill(0);
    ans.forEach(a=>{ if(a&&a.val!=null){ const idx=a.val-q.smin; if(counts[idx]!=null) counts[idx]++; } });
    return { kind:'scale', counts, smin:q.smin, labels:q.labels };
  }
  if (q.type==='cloud'){
    const words={};
    ans.forEach(a=>{ const w=norm(a&&a.text); if(w) words[w]=(words[w]||0)+1; });
    return { kind:'cloud', words:Object.entries(words).map(([w,n])=>({w,n})).sort((x,y)=>y.n-x.n) };
  }
  if (q.type==='open'||q.type==='brainstorm'){
    const notes=[];
    Object.values(room.players).forEach(p=>{ if(p.answer&&p.answer.text&&p.answer.text.trim()) notes.push({ text:p.answer.text, name:p.name }); });
    return { kind:'notes', notes };
  }
  if (q.type==='pinop'){
    const pins=[];
    Object.values(room.players).forEach(p=>{ if(p.answer&&p.answer.x!=null) pins.push({ x:p.answer.x, y:p.answer.y, name:p.name }); });
    return { kind:'pins', pins };
  }
  return { kind:'none' };
}

/* ---------- fluxo de jogo ---------- */
function startQuestion(room){
  const q = room.quiz.questions[room.qi];
  Object.values(room.players).forEach(p=>{ p.answered=false; p.answer=null; });
  room.answeredCount = 0;
  room.qStart = Date.now();
  room.shuffledItems = q.type==='puzzle' ? (function(){ let s=shuffle(q.items); if(q.items.length>1 && s.every((t,i)=>t===q.items[i])) s.reverse(); return s; })() : null;

  if (q.type==='slide'){
    room.phase='slide';
    io.to(room.hostId).emit('host:slide', { index:room.qi, total:room.quiz.questions.length, text:q.text, body:q.body||'' });
    io.to('P:'+room.pin).emit('player:slide', { index:room.qi });
    return;
  }
  room.phase='question';
  // host vê a pergunta + opções (sem destacar a certa ainda)
  const hostQ = JSON.parse(JSON.stringify(q));
  io.to(room.hostId).emit('host:question', { index:room.qi, total:room.quiz.questions.length, question:hostQ, time:q.time, scored:SCORED.includes(q.type), shuffledItems:room.shuffledItems });
  // jogadores recebem os controles
  io.to('P:'+room.pin).emit('player:question', playerQuestionPayload(q, room));

  if (q.time>0){
    room.timer = setTimeout(()=>revealQuestion(room), q.time*1000 + 400);
  }
}

function revealQuestion(room){
  if (room.phase!=='question') return;
  clearTimeout(room.timer); room.timer=null;
  const q = room.quiz.questions[room.qi];
  const dur = (Date.now()-room.qStart)/1000;

  if (SCORED.includes(q.type)){
    Object.values(room.players).forEach(p=>{
      const frac = p.answeredAt ? clamp((p.answeredAt-room.qStart)/1000/(q.time||1),0,1) : 1;
      const r = evalAnswer(q, p.answer, frac);
      let gained = 0;
      if (r.correct){ p.streak=(p.streak||0)+1; const mult=1+Math.min(p.streak-1,5)*0.1; gained=Math.round(r.base*mult); }
      else { p.streak=0; gained=Math.round(r.base); }
      p.score += gained; p.lastGain=gained; p.lastCorrect=r.correct; p.lastClose=r.close;
    });
    // distribuição para o host (quiz/poll-like)
    let dist=null;
    if (q.type==='quiz'||q.type==='audioquiz'){
      dist=q.answers.map(()=>0);
      Object.values(room.players).forEach(p=>{ const s=p.answer&&p.answer.sel; if(s) s.forEach(i=>{ if(dist[i]!=null) dist[i]++; }); });
    }
    room.phase='reveal';
    io.to(room.hostId).emit('host:reveal', {
      question:q, dist, leaderboard:leaderboard(room).slice(0,8),
      shuffledItems: room.shuffledItems
    });
    Object.values(room.players).forEach(p=>{
      const lb=leaderboard(room); const rank=lb.findIndex(x=>x.id===p.id)+1;
      io.to(p.socketId).emit('player:result', { correct:p.lastCorrect, gained:p.lastGain, score:p.score, rank, total:lb.length, streak:p.streak });
    });
  } else {
    room.phase='aggregate';
    io.to(room.hostId).emit('host:aggregate', { question:q, data:aggregate(q, room) });
    io.to('P:'+room.pin).emit('player:submitted', { opinion:true });
  }
}

function advance(room){
  if (room.phase==='reveal'){
    room.phase='leaderboard';
    io.to(room.hostId).emit('host:leaderboard', { leaderboard:leaderboard(room).slice(0,8), last:room.qi+1>=room.quiz.questions.length });
    Object.values(room.players).forEach(p=>{
      const lb=leaderboard(room); const rank=lb.findIndex(x=>x.id===p.id)+1;
      io.to(p.socketId).emit('player:standing', { rank, score:p.score, total:lb.length });
    });
    return;
  }
  // leaderboard / aggregate / slide -> próxima
  room.qi++;
  if (room.qi >= room.quiz.questions.length){
    room.phase='podium';
    const lb=leaderboard(room);
    io.to(room.hostId).emit('host:end', { podium:lb.slice(0,3), all:lb });
    Object.values(room.players).forEach(p=>{
      const rank=lb.findIndex(x=>x.id===p.id)+1;
      io.to(p.socketId).emit('player:end', { rank, score:p.score, total:lb.length });
    });
    return;
  }
  startQuestion(room);
}

/* ---------- socket.io ---------- */
io.on('connection', (socket) => {

  socket.on('host:create', async ({ quizId, origin }) => {
    const quiz = loadQuizzes().find(q => q.id === quizId);
    if (!quiz || !quiz.questions.length){ socket.emit('host:error', 'Quiz inválido ou vazio'); return; }
    const pin = newPin();
    const base = (typeof origin==='string' && /^https?:\/\//.test(origin)) ? origin.replace(/\/$/,'') : ('http://'+lanIP()+':'+PORT);
    const joinUrl = `${base}/?pin=${pin}`;
    let qr=''; try { qr = await QRCode.toDataURL(joinUrl, { margin:1, width:240 }); } catch(e){}
    rooms[pin] = { pin, quiz, qi:-1, phase:'lobby', players:{}, hostId:socket.id, joinUrl };
    sockets[socket.id] = { pin, role:'host' };
    socket.join('H:'+pin);
    socket.emit('host:created', { pin, joinUrl, qr, quizTitle:quiz.title });
  });

  socket.on('player:join', ({ pin, name, avatar, acc }) => {
    const room = rooms[pin];
    if (!room){ socket.emit('player:error', 'PIN não encontrado'); return; }
    if (room.phase!=='lobby'){ socket.emit('player:error', 'O jogo já começou'); return; }
    name = String(name||'').trim().slice(0,18) || 'Jogador';
    const id = 'p'+Math.random().toString(36).slice(2,8);
    room.players[id] = { id, name, avatar:avatar||'fox', acc:cleanAcc(acc), score:0, streak:0, socketId:socket.id, answered:false, answer:null };
    sockets[socket.id] = { pin, role:'player', playerId:id };
    socket.join('P:'+pin);
    socket.emit('player:joined', { playerId:id, name, avatar:avatar||'fox', quizTitle:room.quiz.title });
    io.to(room.hostId).emit('host:roster', { players:roster(room) });
  });

  socket.on('host:start', () => {
    const room = roomOf(socket); if (!room || room.hostId!==socket.id) return;
    if (!Object.keys(room.players).length){ socket.emit('host:warn', 'Nenhum jogador entrou ainda — começando mesmo assim.'); }
    room.qi = 0; startQuestion(room);
  });
  socket.on('host:next', () => { const room=roomOf(socket); if(room&&room.hostId===socket.id) advance(room); });
  socket.on('host:skip', () => { const room=roomOf(socket); if(room&&room.hostId===socket.id&&room.phase==='question') revealQuestion(room); });

  socket.on('player:answer', ({ payload }) => {
    const meta = sockets[socket.id]; if(!meta||meta.role!=='player') return;
    const room = rooms[meta.pin]; if(!room||room.phase!=='question') return;
    const p = room.players[meta.playerId]; if(!p||p.answered) return;
    p.answered=true; p.answer=payload; p.answeredAt=Date.now();
    room.answeredCount=(room.answeredCount||0)+1;
    io.to(room.hostId).emit('host:answered', { count:room.answeredCount, total:Object.keys(room.players).length });
    socket.emit('player:submitted', { ok:true });
    if (room.answeredCount >= Object.keys(room.players).length) revealQuestion(room);
  });

  socket.on('disconnect', () => {
    const meta = sockets[socket.id]; if(!meta){ return; }
    const room = rooms[meta.pin];
    if (room){
      if (meta.role==='host'){
        io.to('P:'+meta.pin).emit('player:error', 'O apresentador saiu. Jogo encerrado.');
        delete rooms[meta.pin];
      } else if (meta.role==='player'){
        delete room.players[meta.playerId];
        io.to(room.hostId).emit('host:roster', { players:roster(room) });
      }
    }
    delete sockets[socket.id];
  });
});
function roomOf(socket){ const m=sockets[socket.id]; return m?rooms[m.pin]:null; }

// endpoint de saúde (use num monitor tipo UptimeRobot para manter o serviço acordado)
app.get('/healthz', (req,res)=>res.send('ok'));

// auto-ping opcional: se PUBLIC_URL estiver definido, mantém o serviço acordado sozinho
if (process.env.PUBLIC_URL) {
  const url = process.env.PUBLIC_URL.replace(/\/$/,'') + '/healthz';
  setInterval(() => { fetch(url).catch(()=>{}); }, 10*60*1000); // a cada 10 min
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ✦ quizHub rodando!');
  console.log('  → Apresentador (este PC):  http://localhost:'+PORT+'/host.html');
  console.log('  → Jogadores (mesmo Wi-Fi): http://'+lanIP()+':'+PORT+'\n');
});
