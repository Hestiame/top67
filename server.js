/* =========================================================
   quizHub — servidor
   Express + Socket.io + Supabase
   ========================================================= */
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/* ---------- limites e configuração ---------- */
const HOST_PASSWORD   = process.env.HOST_PASSWORD || '';       // vazio = sem senha
const MAX_PLAYERS     = parseInt(process.env.MAX_PLAYERS || '80', 10);
const MAX_QUESTIONS   = 60;
const MAX_ROOMS       = 40;
const SALA_OCIOSA_MS  = 3 * 60 * 60 * 1000;   // sala sem uso: 3h
const SALA_ORFA_MS    = 20 * 60 * 1000;       // sem apresentador: 20min
const IA_MAX_JANELA   = 6;                    // gerações por IP
const IA_JANELA_MS    = 10 * 60 * 1000;       // a cada 10 min

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

/* =========================================================
   1) SENHA DO APRESENTADOR
   ========================================================= */
const tokensHost = new Map();  // token -> expira em
const TOKEN_MS = 12 * 60 * 60 * 1000;

function novoTokenHost() {
  const t = crypto.randomBytes(24).toString('hex');
  tokensHost.set(t, Date.now() + TOKEN_MS);
  return t;
}
function tokenValido(t) {
  if (!t) return false;
  const exp = tokensHost.get(t);
  if (!exp) return false;
  if (Date.now() > exp) { tokensHost.delete(t); return false; }
  return true;
}
function lerCookie(req, nome) {
  const raw = req.headers.cookie || '';
  for (const par of raw.split(';')) {
    const i = par.indexOf('=');
    if (i < 0) continue;
    if (par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim());
  }
  return null;
}
function ehHost(req) {
  if (!HOST_PASSWORD) return true;                 // sem senha configurada = liberado
  return tokenValido(lerCookie(req, 'qh_host'));
}
function exigeHost(req, res, next) {
  if (ehHost(req)) return next();
  res.status(401).json({ error: 'Precisa entrar como apresentador', needAuth: true });
}

app.post('/api/host-login', (req, res) => {
  if (!HOST_PASSWORD) return res.json({ ok: true, semSenha: true });
  const senha = String((req.body && req.body.senha) || '');
  if (senha !== HOST_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
  const t = novoTokenHost();
  res.setHeader('Set-Cookie',
    `qh_host=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TOKEN_MS / 1000)}`);
  res.json({ ok: true });
});
app.get('/api/host-status', (req, res) => {
  res.json({ autenticado: ehHost(req), exigeSenha: !!HOST_PASSWORD });
});

// a tela do apresentador é protegida ANTES do arquivo estático
app.get(['/host.html', '/host'], (req, res, next) => {
  if (ehHost(req)) return next();
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

/* =========================================================
   2) BANCO (Supabase) COM CÓPIA LOCAL DE SEGURANÇA
   ========================================================= */
const temSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const supabase = temSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

const CACHE_FILE = path.join(__dirname, 'quizzes.json');
let cacheQuizzes = [];
let bancoOk = true;
let bancoErro = '';

function lerCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) { return []; }
}
function gravarCache(lista) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(lista, null, 2)); } catch (e) { }
}
cacheQuizzes = lerCache();

function normalizaQuiz(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    desc: row.desc !== undefined ? row.desc : (row.description || ''),
    questions: Array.isArray(row.questions) ? row.questions : []
  };
}

async function loadQuizzes() {
  if (!supabase) { bancoOk = false; bancoErro = 'Supabase não configurado'; return cacheQuizzes; }
  try {
    const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    bancoOk = true; bancoErro = '';
    cacheQuizzes = (data || []).map(normalizaQuiz);
    gravarCache(cacheQuizzes);
    return cacheQuizzes;
  } catch (e) {
    bancoOk = false; bancoErro = e.message || 'falha no banco';
    console.error('[banco] leitura falhou, usando cópia local:', bancoErro);
    return cacheQuizzes;
  }
}

async function getQuiz(id) {
  const lista = await loadQuizzes();
  return lista.find(q => q.id === id) || null;
}

async function saveQuiz(quiz) {
  const linha = { id: quiz.id, title: quiz.title, description: quiz.desc || '', questions: quiz.questions };
  if (!supabase) {
    const i = cacheQuizzes.findIndex(q => q.id === quiz.id);
    if (i >= 0) cacheQuizzes[i] = quiz; else cacheQuizzes.push(quiz);
    gravarCache(cacheQuizzes);
    return quiz;
  }
  const { data: existe } = await supabase.from('quizzes').select('id').eq('id', quiz.id).maybeSingle();
  if (existe) {
    const { error } = await supabase.from('quizzes').update({ ...linha, updated_at: new Date() }).eq('id', quiz.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('quizzes').insert([linha]);
    if (error) throw error;
  }
  const i = cacheQuizzes.findIndex(q => q.id === quiz.id);
  if (i >= 0) cacheQuizzes[i] = quiz; else cacheQuizzes.unshift(quiz);
  gravarCache(cacheQuizzes);
  return quiz;
}

async function deleteQuiz(id) {
  if (supabase) {
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw error;
  }
  cacheQuizzes = cacheQuizzes.filter(q => q.id !== id);
  gravarCache(cacheQuizzes);
}

/* =========================================================
   3) VALIDAÇÃO / FILTRO DE NOMES / UTILITÁRIOS
   ========================================================= */
const SCORED = ['quiz', 'truefalse', 'type', 'puzzle', 'audioquiz', 'slider', 'pin'];
const TIPOS_OK = [...SCORED, 'poll', 'cloud', 'open', 'brainstorm', 'scale', 'pinop', 'slide'];

function norm(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const PALAVROES = ['merda', 'bosta', 'caralho', 'porra', 'buceta', 'boceta', 'cuzao',
  'viado', 'viadao', 'bicha', 'puta', 'putinha', 'putao', 'vadia', 'vagabunda', 'piranha',
  'foder', 'fodase', 'fdp', 'pqp', 'vsf', 'vtnc', 'arrombado', 'corno', 'otario',
  'desgraca', 'imbecil', 'retardado', 'nazista', 'hitler',
  'pau no cu', 'penis', 'xoxota', 'punheta', 'pedofilo', 'estupro', 'seunome'];

function nomeOfensivo(nome) {
  const n = norm(nome).replace(/[^a-z0-9 ]/g, '');
  const junto = n.replace(/\s+/g, '');
  const palavras = n.split(/\s+/);
  if (palavras.includes('cu')) return true;
  return PALAVROES.some(p => {
    const pn = p.replace(/\s+/g, '');
    if (pn.length <= 3) return palavras.includes(pn);
    return junto.includes(pn);
  });
}

function nomeUnico(room, nome) {
  const usados = new Set(Object.values(room.players).map(p => norm(p.name)));
  if (!usados.has(norm(nome))) return nome;
  for (let i = 2; i < 60; i++) {
    const tent = `${nome} (${i})`;
    if (!usados.has(norm(tent))) return tent;
  }
  return nome + ' ' + Math.floor(Math.random() * 999);
}

function validaQuiz(quiz) {
  if (!quiz || typeof quiz !== 'object') return 'Quiz inválido';
  if (!quiz.id || typeof quiz.id !== 'string' || quiz.id.length > 64) return 'ID inválido';
  if (!quiz.title || typeof quiz.title !== 'string') return 'Título obrigatório';
  if (quiz.title.length > 120) return 'Título muito longo (máx. 120)';
  if (!Array.isArray(quiz.questions)) return 'Perguntas inválidas';
  if (quiz.questions.length > MAX_QUESTIONS) return `Máximo de ${MAX_QUESTIONS} perguntas por quiz`;
  for (const q of quiz.questions) {
    if (!q || !TIPOS_OK.includes(q.type)) return 'Tipo de pergunta desconhecido: ' + (q && q.type);
    if (typeof q.text !== 'string' || q.text.length > 600) return 'Texto de pergunta muito longo';
    if (Array.isArray(q.answers) && q.answers.length > 8) return 'Máximo de 8 alternativas';
  }
  if (JSON.stringify(quiz).length > 900000) return 'Quiz muito grande';
  return null;
}

function lanIP() {
  const ifaces = os.networkInterfaces();
  for (const nome of Object.keys(ifaces)) {
    for (const ni of ifaces[nome]) if (ni.family === 'IPv4' && !ni.internal) return ni.address;
  }
  return 'localhost';
}

/* =========================================================
   4) ROTAS DA API
   ========================================================= */
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/api/status', (req, res) => res.json({
  bancoOk, bancoErro, quizzesEmCache: cacheQuizzes.length, salas: Object.keys(rooms).length
}));

app.get('/api/quizzes', async (req, res) => res.json(await loadQuizzes()));
app.get('/api/quiz/:id', async (req, res) => {
  const q = await getQuiz(req.params.id);
  q ? res.json(q) : res.status(404).json({ error: 'Quiz não encontrado' });
});

app.post('/api/quiz', exigeHost, async (req, res) => {
  try {
    const quiz = req.body;
    if (quiz && !quiz.id) quiz.id = 'q' + Date.now().toString(36);
    const erro = validaQuiz(quiz);
    if (erro) return res.status(400).json({ error: erro });
    await saveQuiz(quiz);
    res.json({ ok: true, id: quiz.id });
  } catch (e) {
    res.status(500).json({ error: 'Não deu para salvar: ' + (e.message || 'erro no banco') });
  }
});

app.delete('/api/quiz/:id', exigeHost, async (req, res) => {
  try { await deleteQuiz(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'Não deu para apagar: ' + (e.message || 'erro') }); }
});

const usoIA = new Map();
function limiteIA(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x').split(',')[0].trim();
  const agora = Date.now();
  const lista = (usoIA.get(ip) || []).filter(t => agora - t < IA_JANELA_MS);
  if (lista.length >= IA_MAX_JANELA) {
    const esperaMin = Math.ceil((IA_JANELA_MS - (agora - lista[0])) / 60000);
    return res.status(429).json({ error: `Muitas gerações seguidas. Tente de novo em ~${esperaMin} min.` });
  }
  lista.push(agora); usoIA.set(ip, lista);
  next();
}

app.get('/api/ai-status', (req, res) => {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const chaves = { groq: 'GROQ_API_KEY', openai: 'OPENAI_API_KEY', claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', ollama: null };
  const k = chaves[provider];
  res.json({ provider, ready: k ? !!process.env[k] : true });
});

app.post('/api/generate', exigeHost, limiteIA, async (req, res) => {
  const { theme, count, difficulty } = req.body || {};
  try {
    const { generateQuiz } = require('./ai.js');
    const quiz = await generateQuiz({ theme, count, difficulty });
    res.json({ quiz });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Falha ao gerar' });
  }
});

/* =========================================================
   5) ESTADO DE JOGO
   ========================================================= */
const rooms = {};
const sockets = {};

function novoPin() { let p; do { p = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms[p]); return p; }
function roomOf(socket) { const m = sockets[socket.id]; return m ? rooms[m.pin] : null; }
function ehDono(socket, room) {
  return !!(room && sockets[socket.id] && sockets[socket.id].role === 'host' && sockets[socket.id].pin === room.pin);
}
function limpaAcc(a) {
  a = (a && typeof a === 'object') ? a : {};
  const out = {};
  ['hat', 'glasses'].forEach(s => { if (typeof a[s] === 'string' && a[s] && a[s].length < 40) out[s] = a[s]; });
  return out;
}
function roster(room) {
  return Object.values(room.players).map(p => ({
    id: p.id, name: p.name, avatar: p.avatar, acc: p.acc, score: p.score, online: p.online !== false
  }));
}
function leaderboard(room) {
  return Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      rank: i + 1, id: p.id, name: p.name, avatar: p.avatar, acc: p.acc,
      score: p.score, lastGain: p.lastGain || 0, streak: p.streak || 0
    }));
}
function tocaSala(room) { if (room) room.ultimoUso = Date.now(); }

function payloadJogador(q, room) {
  const base = { type: q.type, index: room.qi, total: room.quiz.questions.length, time: q.time, text: q.text };
  if (q.type === 'quiz' || q.type === 'audioquiz' || q.type === 'poll')
    base.answers = q.answers.map((a, i) => ({ i, t: a.t })).filter(a => a.t);
  else if (q.type === 'truefalse') base.answers = q.answers.map((a, i) => ({ i, t: a.t }));
  else if (q.type === 'slider') base.slider = { min: q.min, max: q.max, step: q.step, unit: q.unit || '' };
  else if (q.type === 'scale') base.scale = { smin: q.smin, smax: q.smax, labels: q.labels };
  else if (q.type === 'puzzle') base.items = room.shuffledItems;
  else if (q.type === 'pin' || q.type === 'pinop') base.map = q.map || 'world';
  if (room.fimEm) base.endsAt = room.fimEm;
  return base;
}

function evalAnswer(q, payload, frac) {
  let close = 0, correct = false;
  if (q.type === 'quiz' || q.type === 'audioquiz') {
    const sel = (payload && payload.sel) || [];
    const corr = q.answers.map((a, i) => a.correct ? i : -1).filter(i => i >= 0);
    correct = sel.length === corr.length && sel.every(i => corr.includes(i));
    close = correct ? 1 : 0;
  } else if (q.type === 'truefalse') {
    correct = !!(payload && q.answers[payload.idx] && q.answers[payload.idx].correct);
    close = correct ? 1 : 0;
  } else if (q.type === 'type') {
    const t = norm(payload && payload.text);
    correct = t.length > 0 && (q.accepted || []).some(a => norm(a) === t);
    close = correct ? 1 : 0;
  } else if (q.type === 'puzzle') {
    const order = (payload && payload.order) || []; const n = q.items.length; let good = 0;
    order.forEach((it, i) => { if (it === q.items[i]) good++; });
    close = n ? good / n : 0; correct = good === n;
  } else if (q.type === 'slider') {
    const v = payload ? payload.val : q.min; const range = Math.abs(q.max - q.min) || 1;
    close = clamp(1 - Math.abs(v - q.correct) / (range * 0.5), 0, 1);
    correct = Math.abs(v - q.correct) <= range * 0.06;
  } else if (q.type === 'pin') {
    const pt = payload || { x: 50, y: 50 };
    const d = Math.hypot(pt.x - q.target.x, pt.y - q.target.y);
    close = clamp(1 - d / (q.tol * 2), 0, 1); correct = d <= q.tol;
  }
  const base = close > 0 ? q.points * close * (1 - frac * 0.5) : 0;
  return { correct, close, base };
}

function aggregate(q, room) {
  const ans = Object.values(room.players).map(p => p.answer).filter(a => a != null);
  if (q.type === 'poll') {
    const counts = q.answers.map(() => 0);
    ans.forEach(a => { if (a && a.idx != null && counts[a.idx] != null) counts[a.idx]++; });
    return { kind: 'poll', counts, answers: q.answers.map(a => a.t) };
  }
  if (q.type === 'scale') {
    const n = q.smax - q.smin + 1; const counts = Array(n).fill(0);
    ans.forEach(a => { if (a && a.val != null) { const i = a.val - q.smin; if (counts[i] != null) counts[i]++; } });
    return { kind: 'scale', counts, smin: q.smin, labels: q.labels };
  }
  if (q.type === 'cloud') {
    const words = {};
    ans.forEach(a => { const w = norm(a && a.text); if (w) words[w] = (words[w] || 0) + 1; });
    return { kind: 'cloud', words: Object.entries(words).map(([w, n]) => ({ w, n })).sort((x, y) => y.n - x.n) };
  }
  if (q.type === 'open' || q.type === 'brainstorm') {
    const notes = [];
    Object.values(room.players).forEach(p => { if (p.answer && p.answer.text && p.answer.text.trim()) notes.push({ text: p.answer.text, name: p.name }); });
    return { kind: 'notes', notes };
  }
  if (q.type === 'pinop') {
    const pins = [];
    Object.values(room.players).forEach(p => { if (p.answer && p.answer.x != null) pins.push({ x: p.answer.x, y: p.answer.y, name: p.name }); });
    return { kind: 'pins', pins };
  }
  return { kind: 'none' };
}

/* ---------- fluxo do jogo ---------- */
function startQuestion(room) {
  tocaSala(room);
  const q = room.quiz.questions[room.qi];
  Object.values(room.players).forEach(p => { p.answered = false; p.answer = null; p.answeredAt = null; });
  room.answeredCount = 0;
  room.qStart = Date.now();
  room.fimEm = null;
  room.shuffledItems = q.type === 'puzzle'
    ? (() => { let s = shuffle(q.items); if (q.items.length > 1 && s.every((t, i) => t === q.items[i])) s.reverse(); return s; })()
    : null;

  if (q.type === 'slide') {
    room.phase = 'slide';
    io.to('H:' + room.pin).emit('host:slide', { index: room.qi, total: room.quiz.questions.length, text: q.text, body: q.body || '' });
    io.to('P:' + room.pin).emit('player:slide', { index: room.qi });
    return;
  }

  room.phase = 'question';
  if (q.time > 0) room.fimEm = room.qStart + q.time * 1000;

  io.to('H:' + room.pin).emit('host:question', {
    index: room.qi, total: room.quiz.questions.length, question: JSON.parse(JSON.stringify(q)),
    time: q.time, endsAt: room.fimEm, scored: SCORED.includes(q.type), shuffledItems: room.shuffledItems
  });
  io.to('P:' + room.pin).emit('player:question', payloadJogador(q, room));

  clearTimeout(room.timer);
  if (q.time > 0) room.timer = setTimeout(() => revealQuestion(room), q.time * 1000 + 500);
}

function revealQuestion(room) {
  if (!room || room.phase !== 'question') return;
  clearTimeout(room.timer); room.timer = null;
  tocaSala(room);
  const q = room.quiz.questions[room.qi];

  if (SCORED.includes(q.type)) {
    Object.values(room.players).forEach(p => {
      const frac = p.answeredAt ? clamp((p.answeredAt - room.qStart) / 1000 / (q.time || 1), 0, 1) : 1;
      const r = evalAnswer(q, p.answer, frac);
      let ganho = 0;
      if (r.correct) { p.streak = (p.streak || 0) + 1; const mult = 1 + Math.min(p.streak - 1, 5) * 0.1; ganho = Math.round(r.base * mult); }
      else { p.streak = 0; ganho = Math.round(r.base); }
      p.score += ganho; p.lastGain = ganho; p.lastCorrect = r.correct; p.lastClose = r.close;
    });
    let dist = null;
    if (q.type === 'quiz' || q.type === 'audioquiz') {
      dist = q.answers.map(() => 0);
      Object.values(room.players).forEach(p => { const s = p.answer && p.answer.sel; if (s) s.forEach(i => { if (dist[i] != null) dist[i]++; }); });
    }
    room.phase = 'reveal';
    io.to('H:' + room.pin).emit('host:reveal', {
      question: q, dist, leaderboard: leaderboard(room).slice(0, 8), shuffledItems: room.shuffledItems
    });
    const lb = leaderboard(room);
    Object.values(room.players).forEach(p => {
      const rank = lb.findIndex(x => x.id === p.id) + 1;
      if (p.socketId) io.to(p.socketId).emit('player:result',
        { correct: p.lastCorrect, gained: p.lastGain, score: p.score, rank, total: lb.length, streak: p.streak });
    });
  } else {
    room.phase = 'aggregate';
    io.to('H:' + room.pin).emit('host:aggregate', { question: q, data: aggregate(q, room) });
    io.to('P:' + room.pin).emit('player:submitted', { opinion: true });
  }
}

function advance(room) {
  if (!room) return;
  tocaSala(room);
  if (room.phase === 'reveal') {
    room.phase = 'leaderboard';
    const lb = leaderboard(room);
    io.to('H:' + room.pin).emit('host:leaderboard',
      { leaderboard: lb.slice(0, 8), last: room.qi + 1 >= room.quiz.questions.length });
    Object.values(room.players).forEach(p => {
      const rank = lb.findIndex(x => x.id === p.id) + 1;
      if (p.socketId) io.to(p.socketId).emit('player:standing', { rank, score: p.score, total: lb.length });
    });
    return;
  }
  room.qi++;
  if (room.qi >= room.quiz.questions.length) {
    room.phase = 'podium';
    const lb = leaderboard(room);
    io.to('H:' + room.pin).emit('host:end', { podium: lb.slice(0, 3), all: lb });
    Object.values(room.players).forEach(p => {
      const rank = lb.findIndex(x => x.id === p.id) + 1;
      if (p.socketId) io.to(p.socketId).emit('player:end', { rank, score: p.score, total: lb.length });
    });
    return;
  }
  startQuestion(room);
}

/* =========================================================
   6) SOCKET.IO
   ========================================================= */
io.on('connection', (socket) => {

  socket.on('host:create', async ({ quizId, origin, senha } = {}) => {
    if (HOST_PASSWORD && senha !== HOST_PASSWORD) { socket.emit('host:error', 'Sem permissão para apresentar'); return; }
    if (Object.keys(rooms).length >= MAX_ROOMS) { socket.emit('host:error', 'Muitas salas abertas agora. Tente em alguns minutos.'); return; }
    const quiz = await getQuiz(quizId);
    if (!quiz || !quiz.questions.length) { socket.emit('host:error', 'Quiz inválido ou vazio'); return; }

    const pin = novoPin();
    const base = (typeof origin === 'string' && /^https?:\/\//.test(origin))
      ? origin.replace(/\/$/, '') : ('http://' + lanIP() + ':' + PORT);
    const joinUrl = `${base}/?pin=${pin}`;
    let qr = ''; try { qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 240 }); } catch (e) { }

    const hostToken = crypto.randomBytes(16).toString('hex');
    rooms[pin] = {
      pin, quiz, qi: -1, phase: 'lobby', players: {}, hostId: socket.id, hostToken,
      hostOnline: true, joinUrl, trancada: false, ultimoUso: Date.now(), criadaEm: Date.now()
    };
    sockets[socket.id] = { pin, role: 'host' };
    socket.join('H:' + pin);
    socket.emit('host:created', { pin, joinUrl, qr, quizTitle: quiz.title, hostToken });
  });

  socket.on('host:resume', ({ pin, hostToken } = {}) => {
    const room = rooms[pin];
    if (!room || room.hostToken !== hostToken) { socket.emit('host:resume:fail'); return; }
    room.hostId = socket.id; room.hostOnline = true; room.orfaDesde = null;
    sockets[socket.id] = { pin, role: 'host' };
    socket.join('H:' + pin);
    tocaSala(room);
    const q = room.qi >= 0 ? room.quiz.questions[room.qi] : null;
    socket.emit('host:resumed', {
      pin, joinUrl: room.joinUrl, quizTitle: room.quiz.title, hostToken,
      phase: room.phase, index: room.qi, total: room.quiz.questions.length,
      question: q ? JSON.parse(JSON.stringify(q)) : null,
      endsAt: room.fimEm, shuffledItems: room.shuffledItems,
      players: roster(room), leaderboard: leaderboard(room).slice(0, 8), trancada: room.trancada
    });
    io.to('P:' + pin).emit('player:info', 'O apresentador voltou 🎉');
  });

  socket.on('player:join', ({ pin, name, avatar, acc } = {}) => {
    const room = rooms[pin];
    if (!room) { socket.emit('player:error', 'PIN não encontrado'); return; }
    if (room.phase !== 'lobby') { socket.emit('player:error', 'O jogo já começou'); return; }
    if (room.trancada) { socket.emit('player:error', 'A sala está trancada'); return; }
    if (Object.keys(room.players).length >= MAX_PLAYERS) {
      socket.emit('player:error', `Sala cheia (máx. ${MAX_PLAYERS} jogadores)`); return;
    }
    let nome = String(name || '').trim().slice(0, 18) || 'Jogador';
    if (nomeOfensivo(nome)) { socket.emit('player:error', 'Escolha outro nome, por favor 🙂'); return; }
    nome = nomeUnico(room, nome);

    const id = 'p' + crypto.randomBytes(4).toString('hex');
    const token = 't' + crypto.randomBytes(10).toString('hex');
    room.players[id] = {
      id, token, name: nome, avatar: avatar || 'fox', acc: limpaAcc(acc),
      score: 0, streak: 0, socketId: socket.id, answered: false, answer: null, online: true
    };
    sockets[socket.id] = { pin, role: 'player', playerId: id };
    socket.join('P:' + pin);
    tocaSala(room);
    socket.emit('player:joined', { playerId: id, token, name: nome, avatar: avatar || 'fox', quizTitle: room.quiz.title });
    io.to('H:' + pin).emit('host:roster', { players: roster(room) });
  });

  socket.on('player:resume', ({ pin, playerId, token } = {}) => {
    const room = rooms[pin];
    if (!room) { socket.emit('player:resume:fail'); return; }
    const p = room.players[playerId];
    if (!p || p.token !== token) { socket.emit('player:resume:fail'); return; }
    p.socketId = socket.id; p.online = true;
    sockets[socket.id] = { pin, role: 'player', playerId: p.id };
    socket.join('P:' + pin);
    tocaSala(room);
    const q = room.qi >= 0 ? room.quiz.questions[room.qi] : null;
    socket.emit('player:resumed', {
      playerId: p.id, token: p.token, name: p.name, avatar: p.avatar, acc: p.acc,
      score: p.score, quizTitle: room.quiz.title, phase: room.phase,
      question: (room.phase === 'question' && q) ? payloadJogador(q, room) : null,
      answered: p.answered
    });
    io.to('H:' + pin).emit('host:roster', { players: roster(room) });
  });

  socket.on('host:start', () => {
    const room = roomOf(socket); if (!ehDono(socket, room)) return;
    if (!Object.keys(room.players).length) socket.emit('host:warn', 'Nenhum jogador entrou ainda — começando mesmo assim.');
    room.qi = 0; startQuestion(room);
  });
  socket.on('host:next', () => { const r = roomOf(socket); if (ehDono(socket, r)) advance(r); });
  socket.on('host:skip', () => { const r = roomOf(socket); if (ehDono(socket, r) && r.phase === 'question') revealQuestion(r); });

  socket.on('host:lock', ({ trancada } = {}) => {
    const room = roomOf(socket); if (!ehDono(socket, room)) return;
    room.trancada = !!trancada; tocaSala(room);
    socket.emit('host:locked', { trancada: room.trancada });
  });

  socket.on('host:kick', ({ playerId } = {}) => {
    const room = roomOf(socket); if (!ehDono(socket, room)) return;
    const p = room.players[playerId]; if (!p) return;
    if (p.socketId) {
      io.to(p.socketId).emit('player:kicked', 'O apresentador removeu você da sala.');
      const s = io.sockets.sockets.get(p.socketId);
      if (s) { s.leave('P:' + room.pin); delete sockets[p.socketId]; }
    }
    delete room.players[p.id];
    tocaSala(room);
    io.to('H:' + room.pin).emit('host:roster', { players: roster(room) });
  });

  socket.on('host:end', () => {
    const room = roomOf(socket); if (!ehDono(socket, room)) return;
    clearTimeout(room.timer);
    io.to('P:' + room.pin).emit('player:error', 'O apresentador encerrou o jogo.');
    delete rooms[room.pin];
  });

  socket.on('player:answer', ({ payload } = {}) => {
    const meta = sockets[socket.id]; if (!meta || meta.role !== 'player') return;
    const room = rooms[meta.pin]; if (!room || room.phase !== 'question') return;
    const p = room.players[meta.playerId]; if (!p || p.answered) return;
    if (room.fimEm && Date.now() > room.fimEm + 1500) return;   // fora do tempo
    p.answered = true; p.answer = payload; p.answeredAt = Date.now();
    room.answeredCount = (room.answeredCount || 0) + 1;
    tocaSala(room);
    const ativos = Object.values(room.players).filter(x => x.online !== false).length;
    io.to('H:' + room.pin).emit('host:answered', { count: room.answeredCount, total: Object.keys(room.players).length });
    socket.emit('player:submitted', { ok: true });
    if (room.answeredCount >= Math.max(ativos, 1)) revealQuestion(room);
  });

  socket.on('disconnect', () => {
    const meta = sockets[socket.id];
    delete sockets[socket.id];
    if (!meta) return;
    const room = rooms[meta.pin];
    if (!room) return;
    if (meta.role === 'host') {
      room.hostOnline = false;
      room.orfaDesde = Date.now();
      io.to('P:' + meta.pin).emit('player:info', 'O apresentador caiu — aguardando ele voltar…');
    } else if (meta.role === 'player') {
      const p = room.players[meta.playerId];
      if (p) { p.online = false; p.socketId = null; }
      io.to('H:' + meta.pin).emit('host:roster', { players: roster(room) });
    }
  });
});

/* =========================================================
   7) FAXINA DE SALAS ABANDONADAS
   ========================================================= */
setInterval(() => {
  const agora = Date.now();
  for (const pin of Object.keys(rooms)) {
    const r = rooms[pin];
    const ociosa = agora - (r.ultimoUso || r.criadaEm) > SALA_OCIOSA_MS;
    const orfa = !r.hostOnline && r.orfaDesde && (agora - r.orfaDesde > SALA_ORFA_MS);
    if (ociosa || orfa) {
      clearTimeout(r.timer);
      io.to('P:' + pin).emit('player:error', 'A sala foi encerrada por inatividade.');
      delete rooms[pin];
      console.log('[faxina] sala', pin, ociosa ? 'ociosa' : 'sem apresentador');
    }
  }
  for (const [t, exp] of tokensHost) if (agora > exp) tokensHost.delete(t);
}, 5 * 60 * 1000);

/* =========================================================
   8) ERROS AMIGÁVEIS
   ========================================================= */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endereço não encontrado' });
  res.status(404).sendFile(path.join(__dirname, 'public', 'erro.html'));
});
app.use((err, req, res, next) => {
  console.error('[erro]', err && err.message);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Erro interno no servidor' });
  res.status(500).sendFile(path.join(__dirname, 'public', 'erro.html'));
});
process.on('unhandledRejection', e => console.error('[promessa não tratada]', e && e.message));
process.on('uncaughtException', e => console.error('[exceção]', e && e.message));

/* =========================================================
   9) INÍCIO
   ========================================================= */
async function semearDemo() {
  try {
    const atuais = await loadQuizzes();
    if (atuais.length > 0) return;
    const seed = lerCache();
    for (const q of (Array.isArray(seed) ? seed : [])) await saveQuiz(q);
    if (seed.length) console.log('  ✓ quiz de demonstração criado no banco');
  } catch (e) { console.log('  ! não deu para semear o demo:', e.message); }
}
setTimeout(semearDemo, 1500);

if (process.env.PUBLIC_URL) {
  const url = process.env.PUBLIC_URL.replace(/\/$/, '') + '/healthz';
  setInterval(() => { fetch(url).catch(() => { }); }, 10 * 60 * 1000);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ✦ quizHub rodando!');
  console.log('  → Apresentador: http://localhost:' + PORT + '/host.html');
  console.log('  → Jogadores:    http://' + lanIP() + ':' + PORT);
  console.log('  → Senha do apresentador: ' + (HOST_PASSWORD ? 'ATIVADA' : 'desligada (defina HOST_PASSWORD)'));
  console.log('  → Banco: ' + (temSupabase ? 'Supabase' : 'arquivo local') + '\n');
});
