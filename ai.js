/* ai.js — geração de quiz com IA (trocável entre provedores)
   Provedor escolhido por AI_PROVIDER (padrão: groq).
   Chaves via variáveis de ambiente (.env). Nada de chave no navegador. */

const PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();

/* ---------- adaptadores de provedor ----------
   Cada um diz: como montar a requisição e como ler o texto da resposta. */
const PROVIDERS = {
  groq: {
    label: 'Groq',
    keyEnv: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    url: () => 'https://api.groq.com/openai/v1/chat/completions',
    headers: (key) => ({ 'content-type':'application/json', 'authorization':'Bearer '+key }),
    body: (sys, user, model) => ({ model, temperature:0.6, max_tokens:8000,
      response_format:{type:'json_object'},
      messages:[{role:'system',content:sys},{role:'user',content:user}] }),
    parse: (d) => d.choices?.[0]?.message?.content || ''
  },
  openai: {
    label: 'OpenAI',
    keyEnv: 'OPENAI_API_KEY',
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini',
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ 'content-type':'application/json', 'authorization':'Bearer '+key }),
    body: (sys, user, model) => ({ model, temperature:0.6, max_tokens:8000,
      response_format:{type:'json_object'},
      messages:[{role:'system',content:sys},{role:'user',content:user}] }),
    parse: (d) => d.choices?.[0]?.message?.content || ''
  },
  claude: {
    label: 'Claude (Anthropic)',
    keyEnv: 'ANTHROPIC_API_KEY',
    model: () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' }),
    body: (sys, user, model) => ({ model, max_tokens:8000, system:sys, messages:[{role:'user',content:user}] }),
    parse: (d) => (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')
  },
  gemini: {
    label: 'Google Gemini',
    keyEnv: 'GEMINI_API_KEY',
    model: () => process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    url: (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    headers: () => ({ 'content-type':'application/json' }),
    body: (sys, user) => ({ contents:[{role:'user',parts:[{text:sys+'\n\n'+user}]}],
      generationConfig:{ temperature:0.6, responseMimeType:'application/json' } }),
    parse: (d) => d.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || '',
    keyInUrl: true
  },
  ollama: {
    label: 'Ollama (local)',
    keyEnv: null,
    model: () => process.env.OLLAMA_MODEL || 'llama3.1',
    url: () => (process.env.OLLAMA_URL || 'http://localhost:11434') + '/api/chat',
    headers: () => ({ 'content-type':'application/json' }),
    body: (sys, user, model) => ({ model, stream:false, format:'json',
      messages:[{role:'system',content:sys},{role:'user',content:user}] }),
    parse: (d) => d.message?.content || ''
  }
};

const SYS = 'Você é um gerador de quizzes educativos do quizHub. Responda SEMPRE e SOMENTE com JSON válido em português do Brasil, sem markdown e sem texto extra.';

/* ---------- prompt ---------- */
function buildPrompt(opts){
  const { theme, count, difficulty } = opts;
  const diff = { facil:'fácil (perguntas diretas)', medio:'médio', dificil:'difícil (exige mais conhecimento)' }[difficulty] || 'médio';
  return `Crie um quiz educativo em PORTUGUÊS DO BRASIL sobre o tema: "${theme}".

Número de perguntas: ${count}.
Nível de dificuldade: ${diff}.

VARIE os tipos de pergunta entre estes 5 (não use só múltipla escolha):
- "quiz": múltipla escolha com EXATAMENTE 4 alternativas, apenas 1 correta.
- "truefalse": uma afirmação para julgar Verdadeiro ou Falso.
- "type": resposta curta digitada (uma palavra ou nome).
- "puzzle": ordenar de 3 a 5 itens numa ordem correta (cronológica, crescente, etc.).
- "slider": uma pergunta cuja resposta é um NÚMERO (ano, quantidade, porcentagem...).

Use uma boa mistura: cerca de metade "quiz" e o resto distribuído entre os outros 4 tipos. Inclua pelo menos um "truefalse", um "type" e um "slider" quando o número de perguntas permitir.

Responda SOMENTE com um objeto JSON válido neste formato exato:
{
  "title": "título curto",
  "desc": "descrição de uma linha",
  "questions": [
    { "type":"quiz", "text":"pergunta?", "answers":[
        {"t":"A","correct":false},{"t":"B","correct":true},{"t":"C","correct":false},{"t":"D","correct":false}] },
    { "type":"truefalse", "text":"afirmação.", "answers":[{"t":"Verdadeiro","correct":true},{"t":"Falso","correct":false}] },
    { "type":"type", "text":"pergunta curta?", "accepted":["resposta","variação sem acento"] },
    { "type":"puzzle", "text":"ordene ...", "items":["primeiro","segundo","terceiro","quarto"] },
    { "type":"slider", "text":"em que ano ...?", "min":1900, "max":2000, "correct":1945, "step":1, "unit":"" }
  ]
}

Regras:
- Conteúdo factual e correto. Em "type", inclua variações aceitáveis (com/sem acento).
- Em "puzzle", os itens já na ORDEM CORRETA (o app embaralha depois).
- Em "slider", "correct" entre "min" e "max", faixa plausível.
- Em "quiz", exatamente 1 alternativa correta. Não repita perguntas.`;
}

/* ---------- saneamento ---------- */
const TIME = { quiz:20, truefalse:15, type:30, puzzle:35, slider:25 };
const ALLOWED = ['quiz','truefalse','type','puzzle','slider'];
const num = (v,d)=>{ const n=Number(v); return Number.isFinite(n)?n:d; };
const str = (v)=> (v==null?'':String(v)).trim();

function sanitize(data, opts){
  const out = { title: str(data.title)||('Quiz: '+opts.theme).slice(0,60),
                desc: str(data.desc)||('Gerado por IA sobre '+opts.theme).slice(0,120), questions:[] };
  for (const raw of (Array.isArray(data.questions)?data.questions:[])){
    const t = str(raw.type); if(!ALLOWED.includes(t)) continue;
    const q = { id:'g'+Math.random().toString(36).slice(2,9), type:t, text:str(raw.text), time:TIME[t]||20, points:1000 };
    if(!q.text) continue;
    if(t==='quiz'){
      let ans=(Array.isArray(raw.answers)?raw.answers:[]).map(a=>({t:str(a.t),correct:!!a.correct})).filter(a=>a.t).slice(0,6);
      if(ans.length<2) continue;
      if(!ans.some(a=>a.correct)) ans[0].correct=true;
      let seen=false; ans.forEach(a=>{ if(a.correct){ if(seen)a.correct=false; else seen=true; } });
      q.answers=ans; q.multi=false;
    } else if(t==='truefalse'){
      const tv = raw.answers&&raw.answers[0]?!!raw.answers[0].correct:true;
      q.answers=[{t:'Verdadeiro',correct:tv},{t:'Falso',correct:!tv}]; q.time=TIME.truefalse;
    } else if(t==='type'){
      const acc=(Array.isArray(raw.accepted)?raw.accepted:[]).map(str).filter(Boolean);
      if(!acc.length) continue; q.accepted=acc.slice(0,8); q.time=TIME.type;
    } else if(t==='puzzle'){
      const items=(Array.isArray(raw.items)?raw.items:[]).map(str).filter(Boolean);
      if(items.length<3) continue; q.items=items.slice(0,6); q.time=TIME.puzzle; q.points=2000;
    } else if(t==='slider'){
      let min=num(raw.min,0),max=num(raw.max,100),correct=num(raw.correct,50),step=num(raw.step,1);
      if(min===max) max=min+100; if(min>max)[min,max]=[max,min];
      correct=Math.max(min,Math.min(max,correct));
      q.min=min;q.max=max;q.correct=correct;q.step=step>0?step:1;q.unit=str(raw.unit);q.time=TIME.slider;
    }
    out.questions.push(q);
    if(out.questions.length>=(opts.count||10)) break;
  }
  return out;
}

/* ---------- chamada ao provedor ---------- */
function providerInfo(){
  const p = PROVIDERS[PROVIDER] || PROVIDERS.groq;
  const key = p.keyEnv ? process.env[p.keyEnv] : 'local';
  return { name:p.label, provider:PROVIDER, model:p.model(), ready: !p.keyEnv || !!key, keyEnv:p.keyEnv };
}

async function generateQuiz(opts){
  const p = PROVIDERS[PROVIDER];
  if(!p){ const e=new Error('Provedor de IA desconhecido: '+PROVIDER); e.code='CONFIG'; throw e; }
  const key = p.keyEnv ? process.env[p.keyEnv] : null;
  if(p.keyEnv && !key){ const e=new Error(`Nenhuma chave configurada. Defina ${p.keyEnv} no arquivo .env (veja o README).`); e.code='NOKEY'; throw e; }

  const model = p.model();
  const url = p.keyInUrl ? p.url(key, model) : p.url();
  const headers = p.headers(key);
  const payload = p.body(SYS, buildPrompt(opts), model);

  const ctrl = new AbortController();
  const to = setTimeout(()=>ctrl.abort(), 90000);
  let resp;
  try { resp = await fetch(url, { method:'POST', headers, body:JSON.stringify(payload), signal:ctrl.signal }); }
  catch(e){ clearTimeout(to); const err=new Error('Não consegui conectar à IA ('+p.label+'). Verifique a internet/serviço.'); err.code='NET'; throw err; }
  clearTimeout(to);

  if(resp.status===401||resp.status===403){ const e=new Error('Chave de API inválida ('+p.label+').'); e.code='AUTH'; throw e; }
  if(!resp.ok){ let det=''; try{ const j=await resp.json(); det=(j.error&&(j.error.message||j.error))||''; }catch(_){}
    const e=new Error('A IA retornou erro '+resp.status+(det?(': '+det):'')); e.code='API'; throw e; }

  const data = await resp.json();
  let text = (p.parse(data)||'').trim();
  text = text.replace(/^```(json)?/i,'').replace(/```$/,'').trim();
  const s=text.indexOf('{'), e2=text.lastIndexOf('}');
  if(s>=0&&e2>s) text=text.slice(s,e2+1);
  let parsed; try{ parsed=JSON.parse(text); }
  catch(_){ const err=new Error('A IA respondeu num formato inesperado. Tente de novo.'); err.code='PARSE'; throw err; }
  const quiz = sanitize(parsed, opts);
  if(!quiz.questions.length){ const err=new Error('A IA não gerou perguntas válidas. Tente reformular o tema.'); err.code='EMPTY'; throw err; }
  return quiz;
}

module.exports = { generateQuiz, sanitize, buildPrompt, providerInfo, PROVIDER };
