require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const PORT = process.env.PORT || 3000;
const rooms = {};
const sockets = {};

async function loadQuizzes() {
  const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Erro ao carregar quizzes:', error); return []; }
  return data || [];
}

async function getQuiz(id) {
  const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function saveQuiz(quiz) {
  const { data: existing } = await supabase.from('quizzes').select('id').eq('id', quiz.id).single();
  if (existing) {
    const { error } = await supabase.from('quizzes').update({
      title: quiz.title,
      description: quiz.description || '',
      questions: quiz.questions,
      updated_at: new Date()
    }).eq('id', quiz.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('quizzes').insert([{
      id: quiz.id,
      title: quiz.title,
      description: quiz.description || '',
      questions: quiz.questions
    }]);
    if (error) throw error;
  }
  return quiz;
}

async function deleteQuiz(id) {
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) throw error;
}

function lanIP() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function newPin() { return Math.random().toString().slice(2, 8); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function cleanAcc(a) {
  a = (a && typeof a === 'object') ? a : {};
  const out = {};
  ['hat', 'glasses'].forEach(s => {
    if (typeof a[s] === 'string' && a[s] && a[s].length < 40) out[s] = a[s];
  });
  return out;
}

function roster(room) {
  return Object.values(room.players).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, acc: p.acc, score: p.score }));
}

function leaderboard(room) {
  return Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, avatar: p.avatar, acc: p.acc, score: p.score, lastGain: p.lastGain || 0, streak: p.streak || 0 }));
}

app.get('/healthz', (req, res) => res.send('ok'));

app.get('/api/quizzes', async (req, res) => {
  const quizzes = await loadQuizzes();
  res.json(quizzes);
});

app.get('/api/quiz/:id', async (req, res) => {
  const q = await getQuiz(req.params.id);
  if (!q) return res.status(404).json({ error: 'Quiz não encontrado' });
  res.json(q);
});

app.post('/api/quiz', async (req, res) => {
  try {
    const quiz = req.body;
    if (!quiz.id || !quiz.title) return res.status(400).json({ error: 'id e title obrigatórios' });
    if (!Array.isArray(quiz.questions)) quiz.questions = [];
    await saveQuiz(quiz);
    res.json({ success: true, id: quiz.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/quiz/:id', async (req, res) => {
  try {
    await deleteQuiz(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ai-status', (req, res) => {
  const provider = process.env.AI_PROVIDER || 'groq';
  const hasKey = !!process.env[provider.toUpperCase() + '_API_KEY'];
  res.json({ provider, ready: hasKey });
});

app.post('/api/generate', async (req, res) => {
  const { theme, count, difficulty } = req.body;
  try {
    const result = await require('./ai.js').generate(theme, count, difficulty);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function roomOf(socket) { const m = sockets[socket.id]; return m ? rooms[m.pin] : null; }

io.on('connection', (socket) => {
  socket.on('host:create', async ({ quizId, origin }) => {
    const quiz = await getQuiz(quizId);
    if (!quiz || !quiz.questions.length) { socket.emit('host:error', 'Quiz inválido ou vazio'); return; }
    const pin = newPin();
    const base = (typeof origin === 'string' && /^https?:\/\//.test(origin)) ? origin.replace(/\/$/, '') : ('http://' + lanIP() + ':' + PORT);
    const joinUrl = `${base}/?pin=${pin}`;
    let qr = ''; try { qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 240 }); } catch (e) { }
    rooms[pin] = { pin, quiz, qi: -1, phase: 'lobby', players: {}, hostId: socket.id, joinUrl };
    sockets[socket.id] = { pin, role: 'host' };
    socket.join('H:' + pin);
    socket.emit('host:created', { pin, joinUrl, qr, quizTitle: quiz.title });
  });

  socket.on('player:join', ({ pin, name, avatar, acc }) => {
    const room = rooms[pin];
    if (!room) { socket.emit('player:error', 'PIN não encontrado'); return; }
    if (room.phase !== 'lobby') { socket.emit('player:error', 'O jogo já começou'); return; }
    name = String(name || '').trim().slice(0, 18) || 'Jogador';
    const id = 'p' + Math.random().toString(36).slice(2, 8);
    room.players[id] = { id, name, avatar: avatar || 'fox', acc: cleanAcc(acc), score: 0, streak: 0, socketId: socket.id, answered: false, answer: null };
    sockets[socket.id] = { pin, role: 'player', playerId: id };
    socket.join('P:' + pin);
    socket.emit('player:joined', { playerId: id, name, avatar: avatar || 'fox', quizTitle: room.quiz.title });
    io.to('H:' + pin).emit('host:roster', { players: roster(room) });
  });

  socket.on('host:start', () => {
    const room = roomOf(socket);
    if (!room || room.hostId !== socket.id) return;
    room.qi = 0;
    room.phase = 'question';
    const q = room.quiz.questions[room.qi];
    io.to('H:' + room.pin).emit('host:question', { qi: room.qi, q, total: room.quiz.questions.length });
    io.to('P:' + room.pin).emit('player:question', { q, qi: room.qi, total: room.quiz.questions.length });
    Object.values(room.players).forEach(p => p.answered = false);
  });

  socket.on('player:answer', (answer) => {
    const room = roomOf(socket);
    if (!room) return;
    const m = sockets[socket.id];
    const p = room.players[m.playerId];
    if (!p) return;
    p.answered = true;
    p.answer = answer;
  });

  socket.on('host:reveal', () => {
    const room = roomOf(socket);
    if (!room || room.hostId !== socket.id) return;
    const q = room.quiz.questions[room.qi];
    room.phase = 'reveal';
    const ans = Object.values(room.players).map(p => ({ id: p.id, name: p.name, answer: p.answer, avatar: p.avatar, acc: p.acc }));
    io.to('H:' + room.pin).emit('host:reveal', { q, answers: ans });
    io.to('P:' + room.pin).emit('player:reveal', { q, your_answer: room.players[sockets[socket.id]?.playerId]?.answer });
  });

  socket.on('host:score', ({ scores }) => {
    const room = roomOf(socket);
    if (!room || room.hostId !== socket.id) return;
    Object.entries(scores).forEach(([id, gain]) => {
      if (room.players[id]) {
        room.players[id].score += gain;
        room.players[id].lastGain = gain;
      }
    });
    room.phase = 'leaderboard';
    io.to('H:' + room.pin).emit('host:leaderboard', { leaderboard: leaderboard(room) });
    io.to('P:' + room.pin).emit('player:standing', { leaderboard: leaderboard(room), me: sockets[socket.id]?.playerId });
  });

  socket.on('host:next', () => {
    const room = roomOf(socket);
    if (!room || room.hostId !== socket.id) return;
    room.qi++;
    if (room.qi >= room.quiz.questions.length) {
      room.phase = 'podium';
      const top = leaderboard(room).slice(0, 3);
      io.to('H:' + room.pin).emit('host:podium', { podium: top });
      io.to('P:' + room.pin).emit('player:podium', { podium: top, me: sockets[socket.id]?.playerId });
      return;
    }
    room.phase = 'question';
    const q = room.quiz.questions[room.qi];
    io.to('H:' + room.pin).emit('host:question', { qi: room.qi, q, total: room.quiz.questions.length });
    io.to('P:' + room.pin).emit('player:question', { q, qi: room.qi, total: room.quiz.questions.length });
    Object.values(room.players).forEach(p => p.answered = false);
  });

  socket.on('host:end', () => {
    const room = roomOf(socket);
    if (!room || room.hostId !== socket.id) return;
    delete rooms[room.pin];
    io.to('H:' + room.pin).emit('host:ended');
    io.to('P:' + room.pin).emit('player:ended');
  });

  socket.on('disconnect', () => {
    const m = sockets[socket.id];
    if (m && rooms[m.pin]) {
      const room = rooms[m.pin];
      if (m.role === 'player') delete room.players[m.playerId];
      io.to('H:' + m.pin).emit('host:roster', { players: roster(room) });
    }
    delete sockets[socket.id];
  });
});

if (process.env.PUBLIC_URL) {
  const url = process.env.PUBLIC_URL.replace(/\/$/, '') + '/healthz';
  setInterval(() => { fetch(url).catch(() => { }); }, 10 * 60 * 1000);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ✦ quizHub (Supabase) rodando!');
  console.log('  → Apresentador: http://localhost:' + PORT + '/host.html');
  console.log('  → Jogadores: http://' + lanIP() + ':' + PORT + '\n');
});
