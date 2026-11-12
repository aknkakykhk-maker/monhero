// モンヒロサクセス 止め絵の部品。絵は今ある立ち絵を仮に置いている(あとで差し替える前提)
const IMG = '../../../../monster-hero/images';
const M = (f) => `${IMG}/monsters/${f}`;
const T = (n) => `${IMG}/monster-thumbs/${n}.png`;
const F = (a, mood = 'normal') => `${IMG}/assistant/face/${a}_${mood}.PNG`;
const BODY = (f) => `${IMG}/assistant/fullbody/${f}.png`;
const BG = (f) => `${IMG}/story-bg/${f}.jpg`;
const ST = [['ライフ', '❤️'], ['ちから', '💪'], ['かしこさ', '🧠'], ['命中', '🎯'], ['回避', '💨'], ['丈夫さ', '🛡️']];
const SCREENS = [];
const scr = (id, name, lead, phones, notes) => SCREENS.push({ id, name, lead, phones, notes });

const rl = (r) => String(r).replace(/\d+$/, ''); // 評価の字(C2 → C)。色の名前に使う
const rk = (r, big) => `<i class="rk r${rl(r)}${big ? ' big' : ''}">${r}</i>`; // 評価は助手マスモンと同じ表(G 0・F 2,000・E 3,000・D 4,500・C 6,000・B 8,000・A 11,000・S 14,000・SS 16,000・SSS 18,000・M 19,500)+500ごとの数字
const hd = (right, back = 'もどる', title = '🌱 モンヒロサクセス') =>
  `<div class="hd"><span class="bk">← ${back}</span><span class="ti">${title}</span><span class="rt">${right}</span></div>`;
// 6能力の棒。vals: 数字6つ / up: 上がった数(任意) / apt: 伸びやすさの印(任意)
const sts = (vals, up, apt) => `<div class="sts">${ST.map((s, i) =>
  `<div class="st1"><span class="nm">${s[1]} ${s[0]}</span>${apt ? `<span class="ap">${apt[i]}</span>` : ''}<span class="bar"><i style="width:${Math.max(3, vals[i] / 9.99)}%"></i></span><b>${vals[i]}</b>${up ? `<em>${up[i] ? '+' + up[i] : ''}</em>` : ''}</div>`).join('')}</div>`;
// 応援の顔。o: { t:絵, r:ランク, fav:得意, base:ベースモン, fr:フレンド, lg:大きい }
const cf = (o) => `<span class="cf r${rl(o.r || 'G')}${o.fav ? ' fav' : ''}${o.base ? ' base' : ''}${o.fr ? ' fr' : ''}${o.lg ? ' lg' : ''}"><img src="${T(o.t)}"></span>`;
const CH = { // 応援の編成(仮)
  a: { t: 'undine', r: 'A', n: 'しずく' }, b: { t: 'golem', r: 'B', n: 'がんてつ' }, c: { t: 'pixie', r: 'S', n: 'ぴくりん' },
  d: { t: 'tiger', r: 'C', n: 'らいが' }, e: { t: 'suezo', r: 'G', n: 'スエゾー', base: 1 }, f: { t: 'kyubi', r: 'M', n: 'こんこ', fr: 1 },
};
// 訓練の札。faces: [[キー, 得意か], …]
const tc = (ic, nm, ex, faces, cls = '', rib = '') => `<div class="tc ${cls}">${rib ? `<span class="rib">${rib}</span>` : ''}<div class="ic">${ic}</div><div class="nm">${nm}</div><div class="ex">${ex}</div><div class="fs">${faces.length ? faces.map(([k, fav]) => cf({ ...CH[k], fav })).join('') : 'だれもいない'}</div></div>`;
const coach = (a, mood, text, name) => `<div class="row" style="align-items:flex-start"><img class="fc" src="${F(a, mood)}"><div class="bub f1">${name ? `<span style="color:#be185d">${name}</span>「` : ''}${text}${name ? '」' : ''}</div></div>`;
const life = (now, max, pk) => `<div class="life"><i style="width:${now / max * 100}%"></i>${pk ? `<span class="pk" style="left:${pk[0]}%;width:${pk[1] - pk[0]}%"></span>` : ''}<u style="left:${now / max * 100}%"></u></div>`;
// 成長の曲線(いまここ)
const curve = (x, w = 120, h = 46) => {
  const y = (t) => h - 6 - (h - 14) * Math.exp(-Math.pow((t - 0.55) / 0.3, 2));
  let d = ''; for (let i = 0; i <= 30; i++) { const t = i / 30; d += `${i ? 'L' : 'M'}${(t * w).toFixed(1)},${y(t).toFixed(1)}`; }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round"/><line x1="${x * w}" y1="2" x2="${x * w}" y2="${h}" stroke="#fde047" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${x * w}" cy="${y(x)}" r="4.5" fill="#fde047" stroke="#422006" stroke-width="1.5"/></svg>`;
};

function renderAll() {
  const q = new URLSearchParams(location.search);
  if (q.get('play')) document.body.classList.add('play');
  const root = document.getElementById('root');
  if (q.get('sheet')) {
    root.className = 'sheet';
    root.innerHTML = `<h1>モンヒロサクセス 止め絵の一覧(14画面)</h1><p>スマホ縦 390×844。絵は今ある立ち絵を仮に置いたもの(あとで差し替え)。文・数字は見た目を決めるための仮。4-B・4-C は「育成のメイン」の配置の別案。</p><div class="sg">${SCREENS.map((s) => s.phones.map((p) =>
      `<div class="it"><b>${p.id} ${p.label}</b><div class="z"><div class="phone">${p.html}</div></div></div>`).join('')).join('')}</div>`;
    return;
  }
  const only = q.get('s');
  root.innerHTML = SCREENS.filter((s) => !only || s.id === only).map((s) =>
    `<section class="scr" id="s${s.id}"><h2>${s.id}. ${s.name}</h2><p class="lead">${s.lead}</p><div class="rowp">${s.phones.map((p) =>
      `<div class="pw"><p class="cap">${p.id} ${p.label}</p><div class="phone" id="p${p.id}">${p.html}</div></div>`).join('')}<div class="note">${s.notes}</div></div></section>`).join('');
}
