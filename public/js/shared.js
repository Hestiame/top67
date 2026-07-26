/* shared.js — usado pelo apresentador e pelo jogador */
const SCORED = ['quiz','truefalse','type','puzzle','audioquiz','slider','pin'];
const SHAPE_CLASS = ['bg-red','bg-blue','bg-amber','bg-green','bg-purple','bg-teal'];
function eyes(x1, x2, y, r, dark) {
  dark = dark || '#2A2140';
  return `<circle cx="${x1}" cy="${y}" r="${r}" fill="${dark}"/>
          <circle cx="${x2}" cy="${y}" r="${r}" fill="${dark}"/>
          <circle cx="${x1 + r * .35}" cy="${y - r * .38}" r="${r * .32}" fill="#fff"/>
          <circle cx="${x2 + r * .35}" cy="${y - r * .38}" r="${r * .32}" fill="#fff"/>`;
}

const CHARS = [
  { id:'fox', name:'Raposa', bg:'#FFB443', svg:`
    <path d="M20 40 L24 12 L44 30 Z" fill="#E8622C"/>
    <path d="M80 40 L76 12 L56 30 Z" fill="#E8622C"/>
    <path d="M25 39 L27 20 L40 31 Z" fill="#FFD9C2"/>
    <path d="M75 39 L73 20 L60 31 Z" fill="#FFD9C2"/>
    <ellipse cx="50" cy="55" rx="30" ry="27" fill="#F4763A"/>
    <path d="M50 82 C33 82 24 70 26 60 L74 60 C76 70 67 82 50 82 Z" fill="#FFF3E6"/>
    ${eyes(39, 61, 50, 5.5)}
    <ellipse cx="50" cy="66" rx="5" ry="3.8" fill="#2A2140"/>
    <path d="M50 70 q-5 6 -10 2 M50 70 q5 6 10 2" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>` },

  { id:'panda', name:'Panda', bg:'#8ED3F5', svg:`
    <circle cx="24" cy="26" r="12" fill="#2A2140"/>
    <circle cx="76" cy="26" r="12" fill="#2A2140"/>
    <ellipse cx="50" cy="54" rx="31" ry="28" fill="#FFFFFF"/>
    <ellipse cx="37" cy="50" rx="10" ry="12" fill="#2A2140" transform="rotate(-12 37 50)"/>
    <ellipse cx="63" cy="50" rx="10" ry="12" fill="#2A2140" transform="rotate(12 63 50)"/>
    <circle cx="38" cy="50" r="4.5" fill="#fff"/><circle cx="62" cy="50" r="4.5" fill="#fff"/>
    <circle cx="38.8" cy="49" r="2" fill="#2A2140"/><circle cx="62.8" cy="49" r="2" fill="#2A2140"/>
    <ellipse cx="50" cy="66" rx="6" ry="4.2" fill="#2A2140"/>
    <path d="M50 70 q-6 6 -11 1 M50 70 q6 6 11 1" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>` },

  { id:'frog', name:'Sapo', bg:'#B6E85F', svg:`
    <circle cx="32" cy="34" r="13" fill="#5FBF3D"/>
    <circle cx="68" cy="34" r="13" fill="#5FBF3D"/>
    <circle cx="32" cy="34" r="9" fill="#fff"/><circle cx="68" cy="34" r="9" fill="#fff"/>
    <circle cx="32" cy="35" r="5" fill="#2A2140"/><circle cx="68" cy="35" r="5" fill="#2A2140"/>
    <circle cx="33.6" cy="33" r="1.9" fill="#fff"/><circle cx="69.6" cy="33" r="1.9" fill="#fff"/>
    <ellipse cx="50" cy="60" rx="30" ry="24" fill="#6BCF45"/>
    <ellipse cx="50" cy="66" rx="22" ry="14" fill="#8FE063"/>
    <path d="M32 64 q18 14 36 0" stroke="#2A2140" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="41" cy="57" r="1.8" fill="#2A2140"/><circle cx="59" cy="57" r="1.8" fill="#2A2140"/>` },

  { id:'cat', name:'Gato', bg:'#FFAECF', svg:`
    <path d="M22 42 L24 14 L44 30 Z" fill="#9B8AAE"/>
    <path d="M78 42 L76 14 L56 30 Z" fill="#9B8AAE"/>
    <path d="M27 40 L28 22 L40 32 Z" fill="#FFC9DE"/>
    <path d="M73 40 L72 22 L60 32 Z" fill="#FFC9DE"/>
    <ellipse cx="50" cy="55" rx="30" ry="27" fill="#B0A0C2"/>
    ${eyes(38, 62, 51, 6)}
    <path d="M50 63 l-4.5 4 h9 Z" fill="#FF7BA8"/>
    <path d="M50 67 q-5 5 -9 1 M50 67 q5 5 9 1" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M18 60 h12 M18 66 h12 M82 60 h-12 M82 66 h-12" stroke="#2A2140" stroke-width="1.7" stroke-linecap="round" opacity=".65"/>` },

  { id:'dog', name:'Cachorro', bg:'#FFD166', svg:`
    <ellipse cx="20" cy="52" rx="11" ry="20" fill="#8A5A33"/>
    <ellipse cx="80" cy="52" rx="11" ry="20" fill="#8A5A33"/>
    <ellipse cx="50" cy="54" rx="30" ry="28" fill="#C68642"/>
    <ellipse cx="50" cy="68" rx="17" ry="13" fill="#F3D8B6"/>
    ${eyes(39, 61, 48, 5.5)}
    <ellipse cx="50" cy="63" rx="6" ry="4.4" fill="#2A2140"/>
    <path d="M50 68 v4 M50 72 q-6 5 -10 0 M50 72 q6 5 10 0" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>` },

  { id:'tiger', name:'Tigre', bg:'#FFC44D', svg:`
    <circle cx="24" cy="28" r="11" fill="#E8622C"/>
    <circle cx="76" cy="28" r="11" fill="#E8622C"/>
    <circle cx="24" cy="28" r="6" fill="#FFD9C2"/>
    <circle cx="76" cy="28" r="6" fill="#FFD9C2"/>
    <ellipse cx="50" cy="55" rx="31" ry="28" fill="#F58220"/>
    <path d="M34 30 l4 12 M50 27 v13 M66 30 l-4 12" stroke="#2A2140" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M21 52 h9 M21 62 h9 M79 52 h-9 M79 62 h-9" stroke="#2A2140" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="66" rx="18" ry="13" fill="#FFF3E6"/>
    ${eyes(38, 62, 50, 5.5)}
    <path d="M50 61 l-5 4 h10 Z" fill="#2A2140"/>
    <path d="M50 65 q-5 6 -9 2 M50 65 q5 6 9 2" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>` },

  { id:'penguin', name:'Pinguim', bg:'#7FD8FF', svg:`
    <ellipse cx="50" cy="54" rx="30" ry="29" fill="#3A3550"/>
    <ellipse cx="50" cy="60" rx="21" ry="22" fill="#FFFFFF"/>
    ${eyes(40, 60, 48, 5.5)}
    <path d="M50 58 l-7 5 l7 5 l7 -5 Z" fill="#FF9F1C"/>
    <ellipse cx="30" cy="72" rx="5" ry="3.4" fill="#FF9F1C" opacity=".55"/>
    <ellipse cx="70" cy="72" rx="5" ry="3.4" fill="#FF9F1C" opacity=".55"/>` },

  { id:'owl', name:'Coruja', bg:'#C9A0FF', svg:`
    <path d="M22 34 L30 16 L42 30 Z" fill="#7A5B3D"/>
    <path d="M78 34 L70 16 L58 30 Z" fill="#7A5B3D"/>
    <ellipse cx="50" cy="56" rx="31" ry="28" fill="#9C6F47"/>
    <circle cx="38" cy="50" r="13" fill="#F3E2C7"/>
    <circle cx="62" cy="50" r="13" fill="#F3E2C7"/>
    <circle cx="38" cy="50" r="7" fill="#2A2140"/><circle cx="62" cy="50" r="7" fill="#2A2140"/>
    <circle cx="40" cy="47.5" r="2.6" fill="#fff"/><circle cx="64" cy="47.5" r="2.6" fill="#fff"/>
    <path d="M50 58 l-5 7 l5 6 l5 -6 Z" fill="#FF9F1C"/>
    <path d="M32 74 q18 8 36 0" stroke="#7A5B3D" stroke-width="3" fill="none" stroke-linecap="round"/>` },

  { id:'koala', name:'Coala', bg:'#A8E6D0', svg:`
    <circle cx="20" cy="42" r="15" fill="#9AA3AD"/>
    <circle cx="80" cy="42" r="15" fill="#9AA3AD"/>
    <circle cx="20" cy="42" r="9" fill="#C9D2DA"/>
    <circle cx="80" cy="42" r="9" fill="#C9D2DA"/>
    <ellipse cx="50" cy="55" rx="29" ry="27" fill="#AEB7C1"/>
    ${eyes(38, 62, 51, 5.5)}
    <ellipse cx="50" cy="65" rx="9" ry="7" fill="#3A3550"/>
    <path d="M50 73 q-6 5 -10 0 M50 73 q6 5 10 0" stroke="#2A2140" stroke-width="2" fill="none" stroke-linecap="round"/>` },

  { id:'monkey', name:'Macaco', bg:'#FFC98B', svg:`
    <circle cx="19" cy="52" r="12" fill="#8A5A33"/>
    <circle cx="81" cy="52" r="12" fill="#8A5A33"/>
    <circle cx="19" cy="52" r="7" fill="#E0B089"/>
    <circle cx="81" cy="52" r="7" fill="#E0B089"/>
    <ellipse cx="50" cy="54" rx="29" ry="27" fill="#8A5A33"/>
    <ellipse cx="50" cy="60" rx="23" ry="22" fill="#E0B089"/>
    ${eyes(40, 60, 50, 5.5)}
    <ellipse cx="45" cy="66" rx="2.2" ry="3" fill="#2A2140"/>
    <ellipse cx="55" cy="66" rx="2.2" ry="3" fill="#2A2140"/>
    <path d="M40 72 q10 8 20 0" stroke="#2A2140" stroke-width="2.2" fill="none" stroke-linecap="round"/>` },

  { id:'unicorn', name:'Unicórnio', bg:'#FFC2E8', svg:`
    <path d="M50 6 L57 30 L43 30 Z" fill="#FFD166"/>
    <path d="M50 12 l4 6 l-8 4 l6 4" stroke="#E8A317" stroke-width="1.6" fill="none"/>
    <path d="M24 40 L26 18 L42 32 Z" fill="#F6EDFF"/>
    <path d="M76 40 L74 18 L58 32 Z" fill="#F6EDFF"/>
    <path d="M28 30 q-8 14 -2 28 q8 -12 14 -16 Z" fill="#FF7BA8"/>
    <path d="M72 30 q8 14 2 28 q-8 -12 -14 -16 Z" fill="#8ED3F5"/>
    <ellipse cx="50" cy="56" rx="29" ry="27" fill="#FFFFFF"/>
    ${eyes(39, 61, 52, 5.5)}
    <ellipse cx="50" cy="68" rx="12" ry="9" fill="#FFE0F0"/>
    <ellipse cx="46" cy="67" rx="2" ry="2.6" fill="#C77BA0"/>
    <ellipse cx="54" cy="67" rx="2" ry="2.6" fill="#C77BA0"/>` },

  { id:'octopus', name:'Polvo', bg:'#9AD7FF', svg:`
    <ellipse cx="50" cy="46" rx="29" ry="27" fill="#B15CD9"/>
    <path d="M24 62 q-6 16 2 24 q6 -8 8 -18 Z" fill="#9B45C4"/>
    <path d="M38 68 q-4 16 2 22 q5 -9 6 -18 Z" fill="#B15CD9"/>
    <path d="M62 68 q4 16 -2 22 q-5 -9 -6 -18 Z" fill="#B15CD9"/>
    <path d="M76 62 q6 16 -2 24 q-6 -8 -8 -18 Z" fill="#9B45C4"/>
    ${eyes(39, 61, 44, 6.5)}
    <path d="M42 58 q8 7 16 0" stroke="#2A2140" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="32" cy="52" r="4" fill="#FF9BD2" opacity=".6"/>
    <circle cx="68" cy="52" r="4" fill="#FF9BD2" opacity=".6"/>` }
];

/* ---------- acessórios (desenhados no mesmo sistema) ---------- */
const ACC2 = {
  hat: {
    label: 'Chapéus',
    items: {
      bone:     { name:'Boné',    svg:`<path d="M22 30 q28 -22 56 0 v5 H22 Z" fill="#E8433F"/><path d="M78 30 q10 2 12 8 H74 Z" fill="#C22F2C"/><circle cx="50" cy="12" r="3.5" fill="#C22F2C"/>` },
      coroa:    { name:'Coroa',   svg:`<path d="M24 34 L28 10 L38 22 L50 6 L62 22 L72 10 L76 34 Z" fill="#FFC93C"/><rect x="24" y="32" width="52" height="7" rx="3" fill="#E8A317"/><circle cx="50" cy="20" r="3" fill="#FF5B8D"/><circle cx="32" cy="24" r="2.4" fill="#5BC8FF"/><circle cx="68" cy="24" r="2.4" fill="#5BC8FF"/>` },
      cartola:  { name:'Cartola', svg:`<rect x="32" y="2" width="36" height="28" rx="3" fill="#2A2140"/><rect x="32" y="20" width="36" height="7" fill="#E8433F"/><ellipse cx="50" cy="31" rx="32" ry="6" fill="#1D162E"/>` },
      mago:     { name:'Mago',    svg:`<path d="M50 0 L70 32 H30 Z" fill="#4B3FBF"/><ellipse cx="50" cy="33" rx="30" ry="6" fill="#3A2F9E"/><path d="M46 14 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -1 Z" fill="#FFD166"/><circle cx="58" cy="24" r="2" fill="#FFD166"/>` },
      cowboy:   { name:'Cowboy',  svg:`<path d="M34 30 q2 -24 16 -24 q14 0 16 24 Z" fill="#A6703E"/><path d="M14 32 q36 -12 72 0 q-36 12 -72 0 Z" fill="#8A5A33"/><rect x="33" y="24" width="34" height="6" fill="#5E3D22"/>` },
      natal:    { name:'Natal',   svg:`<path d="M26 32 q6 -30 30 -30 q18 0 20 14 q-14 4 -20 16 Z" fill="#E8433F"/><rect x="20" y="28" width="52" height="9" rx="4.5" fill="#fff"/><circle cx="78" cy="16" r="7" fill="#fff"/>` },
      viking:   { name:'Viking',  svg:`<path d="M28 32 q22 -18 44 0 Z" fill="#9AA3AD"/><rect x="26" y="28" width="48" height="7" rx="3" fill="#7A828B"/><path d="M28 30 q-16 -6 -14 -20 q10 2 12 12 Z" fill="#F3E2C7"/><path d="M72 30 q16 -6 14 -20 q-10 2 -12 12 Z" fill="#F3E2C7"/>` },
      tiara:    { name:'Tiara',   svg:`<path d="M28 34 q22 -16 44 0" stroke="#FFC93C" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 14 l4 8 l-8 0 Z" fill="#FF5B8D"/><circle cx="36" cy="26" r="2.6" fill="#8ED3F5"/><circle cx="64" cy="26" r="2.6" fill="#8ED3F5"/>` },
      palha:    { name:'Palha',   svg:`<path d="M34 30 q2 -22 16 -22 q14 0 16 22 Z" fill="#F0C674"/><ellipse cx="50" cy="31" rx="34" ry="7" fill="#E0B25A"/><rect x="33" y="24" width="34" height="6" fill="#E8433F"/>` },
      touca:    { name:'Touca',   svg:`<path d="M26 34 q4 -26 24 -26 q20 0 24 26 Z" fill="#2D8CFF"/><rect x="24" y="30" width="52" height="8" rx="4" fill="#1F6FD0"/><circle cx="50" cy="6" r="6" fill="#8ED3F5"/>` }
    }
  },
  glasses: {
    label: 'Óculos',
    items: {
      escuros:  { name:'Escuros',  svg:`<rect x="26" y="42" width="20" height="15" rx="4" fill="#2A2140"/><rect x="54" y="42" width="20" height="15" rx="4" fill="#2A2140"/><path d="M46 47 h8" stroke="#2A2140" stroke-width="3"/><path d="M26 47 h-8 M74 47 h8" stroke="#2A2140" stroke-width="2.6" stroke-linecap="round"/>` },
      redondos: { name:'Redondos', svg:`<circle cx="37" cy="50" r="10" fill="none" stroke="#3A3550" stroke-width="3"/><circle cx="63" cy="50" r="10" fill="none" stroke="#3A3550" stroke-width="3"/><path d="M47 50 h6" stroke="#3A3550" stroke-width="3"/><path d="M27 48 h-8 M73 48 h8" stroke="#3A3550" stroke-width="2.6" stroke-linecap="round"/>` },
      aviador:  { name:'Aviador',  svg:`<path d="M26 44 h20 q1 12 -10 12 q-11 0 -10 -12 Z" fill="#7A6A3D" opacity=".85"/><path d="M54 44 h20 q1 12 -10 12 q-11 0 -10 -12 Z" fill="#7A6A3D" opacity=".85"/><path d="M46 46 h8" stroke="#FFC93C" stroke-width="2.6"/><path d="M26 44 h20 M54 44 h20" stroke="#FFC93C" stroke-width="2.6"/>` },
      coracao:  { name:'Coração',  svg:`<path d="M37 44 q5 -6 9 0 q3 6 -9 12 q-12 -6 -9 -12 q4 -6 9 0 Z" fill="#FF5B8D"/><path d="M63 44 q5 -6 9 0 q3 6 -9 12 q-12 -6 -9 -12 q4 -6 9 0 Z" fill="#FF5B8D"/><path d="M47 48 h6" stroke="#FF5B8D" stroke-width="3"/>` },
      oculos3d: { name:'Óculos 3D',svg:`<rect x="25" y="43" width="22" height="14" rx="2" fill="#E8433F"/><rect x="53" y="43" width="22" height="14" rx="2" fill="#2D8CFF"/><rect x="24" y="40" width="52" height="4" rx="2" fill="#F5F5F5"/><path d="M47 46 h6" stroke="#F5F5F5" stroke-width="3"/>` },
      estrela:  { name:'Estrela',  svg:`<path d="M37 40 l3.2 7 l7.8 .6 l-6 5 l1.9 7.4 l-6.9 -4 l-6.9 4 l1.9 -7.4 l-6 -5 l7.8 -.6 Z" fill="#FFC93C"/><path d="M63 40 l3.2 7 l7.8 .6 l-6 5 l1.9 7.4 l-6.9 -4 l-6.9 4 l1.9 -7.4 l-6 -5 l7.8 -.6 Z" fill="#FFC93C"/>` }
    }
  }
};

const ACC_SLOTS2 = ['glasses', 'hat']; // óculos primeiro (ficam embaixo do chapéu)

/* monta o personagem completo num SVG só */
function renderCharacter(charId, acc, size) {
  size = size || 64; acc = acc || {};
  const c = CHARS.find(x => x.id === charId) || CHARS[0];
  let layers = '';
  ACC_SLOTS2.forEach(slot => {
    const id = acc[slot];
    const item = ACC2[slot] && ACC2[slot].items[id];
    if (item) layers += item.svg;
  });
  return `<svg class="character" viewBox="0 0 100 100" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <circle cx="50" cy="50" r="50" fill="${c.bg}"/>
    ${c.svg}${layers}</svg>`;
}

/* só o rostinho, sem fundo (para o seletor) */
function renderCharacterPick(charId, size) {
  return renderCharacter(charId, {}, size);
}

/* miniatura de um acessório sozinho (para o seletor) */
function renderAccIcon(slot, id, size) {
  const item = ACC2[slot] && ACC2[slot].items[id];
  if (!item) return '';
  const vb = slot === 'hat' ? '10 0 80 42' : '14 36 72 28';
  return `<svg viewBox="${vb}" width="${size}" height="${size}" style="display:block">${item.svg}</svg>`;
}

function charName(id) { const c = CHARS.find(x => x.id === id); return c ? c.name : ''; }

/* ---- compatibilidade com o resto do app ---- */
const AVATARS = CHARS.map(c => ({ id: c.id, name: c.name }));
const ACC = { hat: { label: ACC2.hat.label, items: Object.keys(ACC2.hat.items) },
              glasses: { label: ACC2.glasses.label, items: Object.keys(ACC2.glasses.items) } };
const ACC_SLOTS = ['hat', 'glasses'];
const ACC_NAMES = {};
Object.keys(ACC2).forEach(sl => Object.entries(ACC2[sl].items).forEach(([k, v]) => ACC_NAMES[k] = v.name));
function avatarName(id) { return charName(id); }
function avatarImg(id, size) { return renderCharacter(id, {}, size || 32); }

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
