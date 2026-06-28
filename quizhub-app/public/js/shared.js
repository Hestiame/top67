/* shared.js — usado pelo apresentador e pelo jogador */
const SCORED = ['quiz','truefalse','type','puzzle','audioquiz','slider','pin'];
const SHAPE_CLASS = ['bg-red','bg-blue','bg-amber','bg-green','bg-purple','bg-teal'];
const AVATARS = [
  {id:'fox',name:'Raposa'},{id:'panda',name:'Panda'},{id:'frog',name:'Sapo'},{id:'unicorn',name:'Unicórnio'},
  {id:'octopus',name:'Polvo'},{id:'tiger',name:'Tigre'},{id:'koala',name:'Coala'},{id:'monkey',name:'Macaco'},
  {id:'crocodile',name:'Crocodilo'},{id:'tiger2',name:'Tigre'},{id:'penguin',name:'Pinguim'},{id:'owl',name:'Coruja'},
  {id:'dog',name:'Cachorro'},{id:'cat',name:'Gato'},{id:'turtle',name:'Tartaruga'},{id:'otter',name:'Lontra'}
];
function avatarImg(id,size){ size=size||32; if(!id||!AVATARS.some(a=>a.id===id)) id='fox';
  return `<img class="av-photo" src="/avatars/${id}.jpg" alt="" style="width:${size}px;height:${size}px">`; }
function avatarName(id){ const a=AVATARS.find(x=>x.id===id); return a?a.name:''; }

/* ----- acessórios (sistema 2D por encaixe) ----- */
const ACC = {
  hat:     {label:'Chapéus', items:['bone','bone_tras','cowboy','mago','bruxa','palha','mexicano','viking','coroa','tiara','boina','touca','natal','medieval','bombeiro','construcao']},
  glasses: {label:'Óculos',  items:['aviador','monoculo','oculos3d','cientista','coracao','estrela']}
};
const ACC_SLOTS = ['hat','glasses'];
const ACC_NAMES = {bone:'Boné',bone_tras:'Boné p/ trás',cowboy:'Cowboy',mago:'Mago',bruxa:'Bruxa',palha:'Palha',mexicano:'Mexicano',viking:'Viking',coroa:'Coroa',tiara:'Tiara',boina:'Boina',touca:'Touca',natal:'Natal',medieval:'Medieval',bombeiro:'Bombeiro',construcao:'Construção',aviador:'Aviador',monoculo:'Monóculo',oculos3d:'Óculos 3D',cientista:'Cientista',coracao:'Coração',estrela:'Estrela'};
const ACC_POS = { hat:{w:62,top:-15}, glasses:{w:56,top:36} };

// monta o personagem (avatar + acessórios sobrepostos) num tamanho dado
function renderCharacter(avId, acc, size){
  size=size||64; acc=acc||{};
  if(!AVATARS.some(a=>a.id===avId)) avId='fox';
  let h=`<img class="ch-base" src="/avatars/${avId}.jpg" style="width:${size}px;height:${size}px">`;
  ['glasses','hat'].forEach(slot=>{                 // óculos embaixo, chapéu por cima
    const id=acc[slot];
    if(!id || !ACC[slot] || !ACC[slot].items.includes(id)) return;
    const p=ACC_POS[slot];
    h+=`<img class="ch-acc" src="/accessories/${slot}/${id}.png" style="width:${p.w}%;left:50%;top:${p.top}%;transform:translateX(-50%)">`;
  });
  return `<span class="character" style="width:${size}px;height:${size}px">${h}</span>`;
}

function el(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function norm(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function toast(m){const t=el(`<div class="toast">${esc(m)}</div>`);document.body.appendChild(t);setTimeout(()=>t.remove(),2400);}

function shapeSVG(i,size){
  size=size||26;
  const s=[
    `<polygon points="12,3 22,21 2,21" fill="#fff"/>`,
    `<polygon points="12,2 22,12 12,22 2,12" fill="#fff"/>`,
    `<circle cx="12" cy="12" r="10" fill="#fff"/>`,
    `<rect x="3" y="3" width="18" height="18" rx="3" fill="#fff"/>`,
    `<polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" fill="#fff"/>`,
    `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#fff"/>`
  ];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${s[i%6]}</svg>`;
}
const IPin = c => `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.2 7 11.4 7.3 11.7.4.4 1 .4 1.4 0C13 21.4 20 15.2 20 10c0-4.4-3.6-8-8-8z" fill="${c}"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`;

function logo(size){
  size=size||34;
  return `<span style="display:inline-block;vertical-align:middle"><svg width="${size}" height="${size}" viewBox="0 0 44 44">
    <defs><linearGradient id="lg${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6C2BD9"/><stop offset="1" stop-color="#FF3D81"/></linearGradient></defs>
    <circle cx="22" cy="22" r="20" fill="url(#lg${size})"/><circle cx="22" cy="22" r="6.5" fill="#fff"/>
    <circle cx="22" cy="8.5" r="3.4" fill="#fff"/><circle cx="34" cy="28" r="3.4" fill="#fff"/><circle cx="10" cy="28" r="3.4" fill="#fff"/>
    <line x1="22" y1="22" x2="22" y2="8.5" stroke="#fff" stroke-width="2" opacity=".6"/>
    <line x1="22" y1="22" x2="34" y2="28" stroke="#fff" stroke-width="2" opacity=".6"/>
    <line x1="22" y1="22" x2="10" y2="28" stroke="#fff" stroke-width="2" opacity=".6"/></svg></span>`;
}
function mapSVG(){
  return `<svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="1000" height="560" fill="#1f6f9e"/>
    <g fill="#7BC47F" stroke="#5BA463" stroke-width="3" stroke-linejoin="round">
      <path d="M120 90 q60-30 130-10 q40 30 10 70 q20 40-20 70 q-50 30-90 0 q-40-20-30-70 q-20-40 10-60z"/>
      <path d="M250 300 q40-20 70 10 q30 50 5 120 q-20 60-55 90 q-30-30-25-100 q-20-70 0-120z"/>
      <path d="M470 110 q50-25 90 0 q30 20 5 50 q30 10 10 40 q-30 25-70 10 q-30 40-60 5 q-25-50 5-80 q-10-25 15-25z"/>
      <path d="M500 200 q60-15 80 30 q20 80-10 150 q-25 55-55 35 q-40-30-35-110 q-10-80 20-95z"/>
      <path d="M640 90 q120-40 230 0 q50 40 10 90 q-30 50-110 60 q-90 20-150-20 q-40-50 0-100 q-10-25 10-30z"/>
      <path d="M780 360 q60-20 100 10 q25 40-15 65 q-60 25-100-5 q-25-45 15-70z"/>
    </g></svg>`;
}

/* áudio sintetizado p/ quiz+áudio */
let _AC=null;
function playMelody(notes){
  try{
    _AC=_AC||new (window.AudioContext||window.webkitAudioContext)();
    if(_AC.state==='suspended')_AC.resume();
    let t=_AC.currentTime+0.05;
    (notes||[0,4,7]).forEach(n=>{
      const o=_AC.createOscillator(),g=_AC.createGain();
      o.type='triangle';o.frequency.value=261.63*Math.pow(2,n/12);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.25,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.34);
      o.connect(g).connect(_AC.destination);o.start(t);o.stop(t+.36);t+=.4;
    });
  }catch(e){}
}
/* sons curtos de UI/jogo */
function beep(kind){
  try{
    _AC=_AC||new (window.AudioContext||window.webkitAudioContext)();
    if(_AC.state==='suspended')_AC.resume();
    const seq = kind==='good'?[7,12]:kind==='bad'?[5,2]:kind==='tick'?[12]:[0,4,7,12];
    let t=_AC.currentTime+0.02;
    seq.forEach(n=>{const o=_AC.createOscillator(),g=_AC.createGain();o.type='square';o.frequency.value=261.63*Math.pow(2,n/12);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.18,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.18);
      o.connect(g).connect(_AC.destination);o.start(t);o.stop(t+.2);t+=.12;});
  }catch(e){}
}
function confetti(){
  const c=['#FFD86B','#FF3D81','#6C2BD9','#26C281','#2D8CFF'];
  for(let i=0;i<70;i++){
    const p=document.createElement('div');
    p.style.cssText=`position:fixed;top:-20px;left:${Math.random()*100}vw;width:10px;height:14px;background:${c[i%5]};z-index:200;border-radius:2px;animation:confetti ${1.8+Math.random()*1.4}s linear ${Math.random()*0.6}s forwards;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(p);setTimeout(()=>p.remove(),3600);
  }
}
