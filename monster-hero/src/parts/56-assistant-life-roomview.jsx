// ===== 助手の部屋を大きく見る(2026-11-08 社長「助手ごとの部屋の拡大と言うか詳細画面も見れるようにしたい」) =====
// 社長の答え: 形は案A(部屋を押すと大きな部屋・今のシートの代わり)/立ち絵の馴染ませ方は ①〜③を全部/マスモンは全部出して歩く/フレンドの家も同じ大きな部屋。
//   案と止め絵: docs/progress/assistant-peer/ROOM-VIEW-PLAN.md・roomview/
//   ① 立ち絵に床の影と部屋の色味(絵の形で切り抜いた色の層。夜は暗く、灯りの側を暖かく)・輪郭の白っぽさを細い暗い線で消す
//   ② 上半身の絵なので、腰から下を家具(机・ソファ・ベッド)の後ろに置き、絵の切れ目を見せない
//   ③ 大きさは見えている体の高さで決め(社長の決めごと)、奥の床に立たせて手前のマスモンと釣り合わせる
// 部品 AssistantLifeRoomScene は見せるだけ(何も保存しない)。押したときの動きは呼ぶ側が渡す。フレンドの家(オトズレ3)も同じ部品を使える形にしてある
// 部屋のシート(56-assistant-life-house.jsx の AssistantLifeRoomSheet)が、上にこの大きな部屋・下(横は右)に今までの中身を並べる

// 助手ごとの「前に置く家具」(②)。寝ているときはベッド
const ASSISTANT_LIFE_ROOM_FRONT = Object.freeze({ mua: 'sofa', kiki: 'desk', momosuke: 'desk', dra: 'sofa', atsu: 'desk', kyuko: 'desk', sorashido: 'desk', erubin: 'sofa' });
// 机の上の小物(助手の好み。絵文字のまま)
const ASSISTANT_LIFE_ROOM_DESK_ITEMS = Object.freeze({ mua: ['🍰', '🎀'], kiki: ['🫖', '📚'], momosuke: ['🎧', '🎼'], dra: ['🍪', '🧸'], atsu: ['🃏', '☕'], kyuko: ['📚', '🎼'], sorashido: ['🃏', '🧮'], erubin: ['🛡️', '☕'] });

// マスモンが今どこか: 助手が家にいれば全員部屋。出かけていれば、1体ずつ「一緒に出かけた/留守番」(時間の区切りで決まる・半分くらい)
//   当番の1体は家の小さな部屋と同じ決まり(assistantMasmonWhere)にそろえる
const assistantLifeRoomMasmons = (id, life) => {
  let team = [];
  try { team = typeof assistantLifeMasmonTeamOf === 'function' ? assistantLifeMasmonTeamOf(id) : []; } catch (_) { team = []; }
  if (!Array.isArray(team)) return [];
  const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, id) : null;
  if (!w || w.place === 'home') return team;
  const abs = life && Number.isFinite(life.abs) ? life.abs : 0;
  let duty = null; try { duty = typeof assistantMasmonDuty === 'function' ? assistantMasmonDuty(id) : null; } catch (_) { duty = null; }
  let dutyKind = null; try { dutyKind = typeof assistantMasmonWhere === 'function' ? assistantMasmonWhere(id, life).kind : null; } catch (_) { dutyKind = null; }
  return team.filter((t, i) => {
    if (duty && t.monster === duty.monster && t.nick === duty.nick && dutyKind) return dutyKind === 'stay';
    const hsh = typeof assistantMasmonHash === 'function' ? assistantMasmonHash(`${abs}|${id}|${i}|go`) : i;
    return hsh % 2 === 1;
  });
};

// 動きを減らす設定(マスモンの部品と同じ口)
const assistantLifeRoomCalm = () => { try { return typeof assistantMasmonReducedMotion === 'function' ? !!assistantMasmonReducedMotion() : false; } catch (_) { return false; } };

// 立ち絵の置き方(2026-11-08 社長「きき・みゅあが重なる・ドラが大きすぎる」→ オクリモノ3と社長が決めた測り方を使う):
//   顔の大きさ m(手で置いた目・顎・頬の点から)で縮尺を決め、全員を同じ所で上下に切る(頭のてっぺんの上 顔0.55個・てっぺんから顔1.8個・下の 顔0.45個で消す)。
//   表と関数はオクリモノ3の共通のもの(assistantLifeStandFace・assistantLifeStandVisH・assistantLifeStandRule。docs/progress/assistant-peer/gifts/stagec/STAND-MEASURE.md)を読む。
//   まだ無い版では、同じ決まりの既定(ふつうの形)で置く
const assistantLifeRoomFaceOf = (pid, src) => {
  try { if (typeof assistantLifeStandFace === 'function') return assistantLifeStandFace(pid, src); } catch (_) { /* 既定へ */ }
  return { top: 0.05, eye: 0.33, chin: 0.47, m: 1 };
};
// オクリモノ3の共通の関数(56-assistant-life-house.jsx「立ち絵の大きさと切る位置」)を使う。まだ無い版では同じ値の既定で計算する
//   ・assistantLifeStandVisH(face, F) … 見えている体の高さ(fit を含む)
//   ・assistantLifeStandRule({ face, box, F, topY, cx }) … 1人ぶんの { top, height, width, left, clip, fade, frameTop, frameBottom, visTop, visBottom, U }
const ASSISTANT_LIFE_ROOM_STAND_DEF = Object.freeze({ ec: 0.1639, len: 2.63, cut: Object.freeze({ above: 0.55, below: 1.8, fade: 0.45 }) });
const assistantLifeRoomVisH = (face, F) => {
  try { if (typeof assistantLifeStandVisH === 'function') { const v = assistantLifeStandVisH(face, F); if (Number.isFinite(v) && v > 0) return v; } } catch (_) { /* 既定へ */ }
  return F / (ASSISTANT_LIFE_ROOM_STAND_DEF.ec * (face.m || 1)) * (face.fit || 1);
};
const assistantLifeRoomPlace = (x, F, topY, cx) => {
  try { if (typeof assistantLifeStandRule === 'function') { const r = assistantLifeStandRule({ face: x.face, box: x.box, F, topY, cx }); if (r && Number.isFinite(r.top) && Number.isFinite(r.height)) return r; } } catch (_) { /* 既定へ */ }
  const D = ASSISTANT_LIFE_ROOM_STAND_DEF, U = F * D.len;
  const vh = assistantLifeRoomVisH(x.face, F), ih = vh / (x.box.b - x.box.t), iw = ih * x.box.ar;
  const visTop = topY - (x.face.top || 0) * vh, imgTop = visTop - x.box.t * ih;
  const frameTop = topY - D.cut.above * U, frameBottom = topY + D.cut.below * U;
  return { top: imgTop, height: ih, width: iw, left: cx - ((x.box.l + x.box.r) / 2) * iw, clip: [Math.max(0, frameTop - imgTop), Math.max(0, imgTop + ih - frameBottom)],
    fade: x.face.head ? null : [Math.max(0, (frameBottom - D.cut.fade * U - imgTop) / ih), Math.min(1, (frameBottom - imgTop) / ih)], frameTop, frameBottom, visTop, visBottom: visTop + vh, U };
};
// 部屋の大きさから、並ぶ人の置き場所を決める(px)。顔の長さ F を全員同じに(人数で決める高さと、受け持ちの幅を超えない長さの小さいほう)。
//   頭のてっぺんの線は、切る下端(てっぺんから顔1.8個)が前の家具の天板より少し下に来る高さ。寝ているとき(ベッド)は顎がベッドの上。左右は受け持ちの幅の真ん中(重ならない)
const assistantLifeRoomStandLayout = (items, W, usable, deskTop, land, bed = false) => {
  const n = items.length;
  if (!n || items.some(x => !x.box)) return null;
  const D = ASSISTANT_LIFE_ROOM_STAND_DEF;
  const span = W * (land ? 0.8 : 0.86), sw = span / n, x0 = (W - span) / 2;
  let F = Math.min(usable * ({ 1: 0.07, 2: 0.07, 3: 0.062, 4: 0.055 }[Math.min(4, n)]), W * 0.085); // 1人でも2人でも顔の大きさがなるべく同じ(縦は幅で上限)
  const visW = (x, f) => assistantLifeRoomVisH(x.face, f) * (x.box.r - x.box.l) * x.box.ar / (x.box.b - x.box.t);
  for (const x of items) { const w1 = visW(x, 1); if (w1 > 0) F = Math.min(F, (sw * 0.98) / w1); }
  const U = F * D.len;
  const topY = bed ? deskTop + 0.15 * U - U : deskTop + 0.2 * U - D.cut.below * U;
  return items.map((x, i) => {
    const cx = x0 + sw * (i + 0.5);
    const r = assistantLifeRoomPlace(x, F, topY, cx);
    return { left: r.left, top: r.top, width: r.width, height: r.height, clip: r.clip, fade: r.fade, cx, face: F, visTop: r.visTop, headTop: topY, frameBottom: r.frameBottom, w: visW(x, F) };
  });
};

// 立ち絵1人(①): 決まった場所 p に、部屋の色味の層と影を付けて置く
function AssistantLifeRoomFigure({ who, src, p, look, sleep = false, onPress = null }) {
  const night = look === 'night', evening = look === 'evening';
  const tone = night ? 'linear-gradient(100deg,#ffd08a 0%,#c9c2ee 45%,#8a86c0 100%)'
    : evening ? 'linear-gradient(100deg,#ffe0b0 0%,#f2c9b0 60%,#c99a90 100%)'
    : 'linear-gradient(100deg,#ffffff 0%,#f6ece8 60%,#d9c2bc 100%)';
  const fadeMask = p.fade ? `linear-gradient(to bottom,#000 ${(p.fade[0] * 100).toFixed(1)}%,transparent ${(p.fade[1] * 100).toFixed(1)}%)` : null;
  const box = { position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height,
    clipPath: `inset(${p.clip[0].toFixed(1)}px 0 ${p.clip[1].toFixed(1)}px 0)`, ...(fadeMask ? { WebkitMaskImage: fadeMask, maskImage: fadeMask } : {}) };
  const shape = { WebkitMaskImage: `url(${src})`, WebkitMaskSize: '100% 100%', maskImage: `url(${src})`, maskSize: '100% 100%' };
  return (<>
    <span aria-hidden="true" style={{ position: 'absolute', left: p.cx - p.w * 0.45, top: p.frameBottom - 16, width: p.w * 0.9, height: 26, borderRadius: '50%', background: 'radial-gradient(#0007,transparent 70%)', pointerEvents: 'none' }}/>
    <div style={box} data-assistant-life-roomview-person={who.id} data-assistant-life-roomview-face={Math.round(p.face)} data-assistant-life-roomview-head={Math.round(p.headTop)}>
      <img src={src} alt="" draggable={false} data-assistant-life-roomview-fig={who.id} onClick={onPress || undefined}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', filter: `drop-shadow(0 0 .6px #2a1414cc) saturate(.92) sepia(.1)${sleep ? ' brightness(.6)' : ''}`, cursor: onPress ? 'pointer' : undefined }}/>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, ...shape, background: tone, mixBlendMode: 'multiply', pointerEvents: 'none' }}/>
    </div>
    {sleep && <span aria-hidden="true" style={{ position: 'absolute', left: p.cx + p.w * 0.2, top: p.visTop, fontSize: 18, pointerEvents: 'none' }}>💤</span>}
  </>);
}

// 前に置く家具(②)。CSS で描く(絵が届いたら差しかえる)。top は家具の天板の高さ
function AssistantLifeRoomFront({ kind, cx, top, w, items = [] }) {
  if (kind === 'bed') return (
    <div aria-hidden="true" data-assistant-life-roomview-front="bed" style={{ position: 'absolute', left: cx - w / 2, top, width: w, height: 92, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 46, borderRadius: '14px 14px 6px 6px', background: 'linear-gradient(#e0e7ff,#a5b4fc)', boxShadow: 'inset 0 -6px 0 #818cf8' }}/>
      <div style={{ position: 'absolute', left: -6, right: -6, top: 40, bottom: 0, borderRadius: 8, background: 'linear-gradient(#8a5a33,#5c3a1f)' }}/>
    </div>);
  if (kind === 'sofa') return (
    <div aria-hidden="true" data-assistant-life-roomview-front="sofa" style={{ position: 'absolute', left: cx - w / 2, top, width: w, height: 96, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 8, right: 8, top: 0, height: 52, borderRadius: '18px 18px 8px 8px', background: 'linear-gradient(#f9a8d4,#db2777)', boxShadow: 'inset 0 -8px 0 #be185d' }}/>
      <div style={{ position: 'absolute', left: -4, width: 34, top: 18, bottom: 6, borderRadius: 14, background: 'linear-gradient(#f472b6,#be185d)' }}/>
      <div style={{ position: 'absolute', right: -4, width: 34, top: 18, bottom: 6, borderRadius: 14, background: 'linear-gradient(#f472b6,#be185d)' }}/>
      <div style={{ position: 'absolute', left: 10, right: 10, top: 46, bottom: 0, borderRadius: 10, background: 'linear-gradient(#be185d,#831843)' }}/>
    </div>);
  return (
    <div aria-hidden="true" data-assistant-life-roomview-front="desk" style={{ position: 'absolute', left: cx - w / 2, top, width: w, height: 96, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 18, borderRadius: 6, background: 'linear-gradient(#c89060,#a06a3c)', boxShadow: '0 4px 6px #0005' }}/>
      <div style={{ position: 'absolute', left: 10, right: 10, top: 16, bottom: 0, borderRadius: '0 0 6px 6px', background: 'linear-gradient(#8a5a33,#6b4426)' }}/>
      {items.slice(0, 2).map((e, i) => <span key={i} style={{ position: 'absolute', [i ? 'right' : 'left']: 24, top: -30, fontSize: 28, lineHeight: 1 }}>{e}</span>)}
    </div>);
}

// 寝ているときのベッド(2026-11-08 社長「寝ている感じがしない」): 横から見たベッド(頭板・枕・掛け布団・脚)に、頭を横にして枕にのせる。
//   頭は立ち絵から「頭のてっぺんの少し上〜顎の少し下」だけを切り出して倒す(目の下で切らない)。首から下は掛け布団の下
const ASSISTANT_LIFE_ROOM_QUILT = Object.freeze({ mua: ['#fbcfe8', '#f472b6'], kiki: ['#ddd6fe', '#a78bfa'], momosuke: ['#fed7aa', '#fb923c'], dra: ['#bbf7d0', '#4ade80'], atsu: ['#fecaca', '#ef4444'], kyuko: ['#bae6fd', '#38bdf8'], sorashido: ['#fef08a', '#facc15'], erubin: ['#e2e8f0', '#94a3b8'] });
// 寝ているときの閉じた目(2026-11-08 社長「寝てるときは目を閉じるようにできないの？ どらちゃんは眼鏡だからそのままでいい」)。
//   寝顔の絵は無いので、ふつうの顔(normal)の絵の上に、まわりの肌の色で目をふさぎ、閉じたまぶたの線(下向きの弧)とまつ毛を描く。
//   描くのは目を開いた絵の みゅあ・きき・ももすけ・あつ・きゅうこ(ソラシドは元から目を閉じた絵、ドラは眼鏡、えるびんは社長「そのままでいい」)。
//   2026-11-11 社長「寝ているときに目を開けっぱなしの人がいる。えるびんだけそのままでいい」: みゅあ・きゅうこを足し、顔アイコン(face/)の絵の表も持つ。
//   ベッドだけでなく、家の部屋の顔・場面の立ち絵・地図の全身(寝ている姿が出る所すべて)に重ねる
//   eyes … [x, y, 幅, 高さ, 肌の色](絵の幅・高さに対する割合。左右の目)/ang … 顔の傾き(度)/line … まぶたの線の色。測り方: 絵を目盛りつきで切り出して手で読んだ
const ASSISTANT_LIFE_SLEEP_EYES = Object.freeze({
  kiki: { ang: -3, line: '#4a2030', eyes: [[0.4492, 0.4868, 0.0579, 0.0703, '#fccfc3'], [0.5592, 0.4766, 0.0579, 0.0664, '#fddbcf']] },
  momosuke: { ang: -17, line: '#5a3a28', eyes: [[0.4254, 0.4363, 0.0918, 0.0781, '#e8b8b2'], [0.5967, 0.3836, 0.0918, 0.0859, '#fcece4']] },
  atsu: { ang: -27, line: '#3a1f2a', eyes: [[0.4188, 0.3125, 0.0768, 0.0391, '#efa696'], [0.5661, 0.2553, 0.0911, 0.0342, '#f9ccb8']] },
  mua: { ang: 8, line: '#5a3a2a', eyes: [[0.46, 0.334, 0.043, 0.048, '#fef3e7'], [0.524, 0.347, 0.032, 0.046, '#fae2d3']] },
  kyuko: { ang: -10, line: '#4a2418', eyes: [[0.342, 0.415, 0.117, 0.072, '#f9c7b0'], [0.579, 0.383, 0.142, 0.075, '#fbd6bf']] },
});
// 顔アイコン(face の ◯◯_normal の絵)の目。測り方は全身と同じ(目盛りつきで切り出して手で読んだ・2026-11-11)
const ASSISTANT_LIFE_SLEEP_EYES_FACE = Object.freeze({
  mua: { ang: 10, line: '#5a3a2a', eyes: [[0.375, 0.49, 0.14, 0.10, '#fbe5d6'], [0.61, 0.53, 0.115, 0.095, '#fae4d5']] },
  kiki: { ang: -2, line: '#4a2030', eyes: [[0.37, 0.555, 0.135, 0.085, '#fbcabd'], [0.645, 0.545, 0.145, 0.105, '#fdd4c8']] },
  momosuke: { ang: -19, line: '#5a3a28', eyes: [[0.39, 0.53, 0.11, 0.095, '#f8cac1'], [0.605, 0.455, 0.125, 0.09, '#fad0c7']] },
  atsu: { ang: -30, line: '#3a1f2a', eyes: [[0.35, 0.60, 0.095, 0.05, '#f6baa7'], [0.56, 0.48, 0.12, 0.06, '#f8c7b3']] },
  kyuko: { ang: -11, line: '#4a2418', eyes: [[0.315, 0.64, 0.145, 0.12, '#f9c7b0'], [0.605, 0.585, 0.185, 0.115, '#fbd6bf']] },
});
// 社長が描いた寝顔(2026-11-11 社長「寝顔こっちでつくる」→ 7枚・「絵をそのまま使う」): 寝ているあいだは、上半身の寝顔の絵をまるごと出す。
//   tools/assistant/life-sleep-faces-make.js が、元の絵と同じ大きさ・同じ顔の位置で、同じフォルダに ◯◯_sleep.PNG として置く(着せ替えの見分け・顔の位置の表がそのまま使える)
//   全身(地図・場面の立ち絵・ベッド)は assistantLifeSleepSrc で絵を差し替える。顔アイコン(家の部屋の顔)は、顔の絵の部品が絵のパスを受け取らないので、上から重ねる
//   絵の無い助手(ドラ・えるびん・ソラシド)と、絵の無い着せ替えは、いままでどおり下の SVG の閉じた目
const ASSISTANT_LIFE_SLEEP_ART = Object.freeze(new Set([
  'atsu_normal.PNG', 'face/atsu_normal.PNG', 'kiki_normal.PNG', 'face/kiki_normal.PNG', 'halloween/kiki_normal.PNG', 'halloween/face/kiki_normal.PNG',
  'kyuko_normal.PNG', 'face/kyuko_normal.PNG', 'myua_normal.PNG', 'face/myua_normal.PNG',
  'card-master/myua_normal.PNG', 'card-master/face/myua_normal.PNG', 'halloween/myua_normal.PNG', 'halloween/face/myua_normal.PNG',
  'momosuke_normal.PNG', 'face/momosuke_normal.PNG', 'halloween/momosuke_normal.PNG', 'halloween/face/momosuke_normal.PNG',
]));
// その絵(ふつうの顔 normal)に社長の寝顔の絵があれば、その絵のパス。無ければ null
function assistantLifeSleepArt(pid, src) {
  const who = typeof assistantById === 'function' ? assistantById(pid) : null;
  const s0 = String(src || '').replace(/[?#].*$/, ''), dir = who && who.imageDir ? `${who.imageDir}/` : null;
  const rel = dir && s0.includes(dir) ? s0.slice(s0.indexOf(dir) + dir.length) : null;
  return rel && ASSISTANT_LIFE_SLEEP_ART.has(rel) ? `${dir}${rel.replace(/_normal\.PNG$/, '_sleep.PNG')}` : null;
}
// 寝ているときに出す全身の絵: 社長の寝顔の絵があればそれ、無ければ元の絵のまま。
//   起きているときの全身の絵が別の場所(全身画など)を指す助手もいるので、見つからないときは顔アイコン(ふつうの顔)のパスから、どの服の寝顔かを割り出す(…/face/◯◯_normal.PNG → …/◯◯_sleep.PNG)
const assistantLifeSleepSrc = (pid, src) => {
  const a = assistantLifeSleepArt(pid, src); if (a) return a;
  const who = typeof assistantById === 'function' ? assistantById(pid) : null;
  const face = who && typeof assistantFaceImage === 'function' ? assistantFaceImage(who, 'normal') : null;
  const f = face ? assistantLifeSleepArt(pid, String(face).replace(/\/face\/([^/]+)$/, '/$1')) : null;
  return f || src;
};
function AssistantLifeSleepEyes({ pid, src, w, h, style }) {
  // すでに社長の寝顔の絵を出している(全身を差し替えた)ときは何も重ねない
  if (/_sleep\.PNG/i.test(String(src || ''))) return null;
  {
    const art = assistantLifeSleepArt(pid, src);
    if (art) {
      // 顔アイコン: 社長の寝顔の絵(上半身まるごと)を上から重ねる。立ち絵の影(drop-shadow)は付けない(まわりに暗い輪が出る)
      const filter = style && style.filter ? String(style.filter).replace(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g, '').trim() || undefined : undefined;
      return <img data-assistant-life-roomview-sleep-eyes={pid} src={art} alt="" aria-hidden="true" draggable={false}
        style={{ position: 'absolute', width: w, height: h, maxWidth: 'none', pointerEvents: 'none', ...style, filter }}/>;
    }
  }
  const isFace = /\/face\//.test(String(src || ''));
  const def = (isFace ? ASSISTANT_LIFE_SLEEP_EYES_FACE : ASSISTANT_LIFE_SLEEP_EYES)[pid];
  const who = typeof assistantById === 'function' ? assistantById(pid) : null;
  // 着替えなど別の絵では目の位置がちがうので描かない(その助手のふつうの顔の絵のときだけ)
  if (!def || !who || !who.imagePrefix || !String(src || '').includes(`/${who.imagePrefix}_normal`)) return null;
  const fid = `mhlse-${pid}${isFace ? '-f' : ''}`;
  return (
    <svg data-assistant-life-roomview-sleep-eyes={pid} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', ...style }}>
      <defs><filter id={fid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={Math.max(0.6, w * 0.006)}/></filter></defs>
      {def.eyes.map(([fx, fy, fw, fh, skin], i) => {
        const cx = fx * w, cy = fy * h, ew = fw * w, eh = fh * h;
        const outer = i === 0 ? -1 : 1; // 外側(見て左の目は左・右の目は右)
        const lw = Math.max(1.1, eh * 0.11);
        const lid = `M${cx - ew * 0.5},${cy} Q${cx},${cy + eh * 0.42} ${cx + ew * 0.5},${cy}`;
        const ox = cx + outer * ew * 0.42, oy = cy + eh * 0.08;
        return (
          <g key={i} transform={`rotate(${def.ang} ${cx} ${cy})`}>
            <ellipse cx={cx} cy={cy + eh * 0.04} rx={ew * 0.6} ry={eh * 0.62} fill={skin} filter={`url(#${fid})`}/>
            <ellipse cx={cx} cy={cy + eh * 0.04} rx={ew * 0.54} ry={eh * 0.54} fill={skin}/>
            <path d={lid} fill="none" stroke={def.line} strokeWidth={lw} strokeLinecap="round"/>
            {[0, 1, 2].map(k => <path key={k} d={`M${ox - outer * k * ew * 0.12},${oy + k * eh * 0.07} l${outer * ew * (0.14 - k * 0.02)},${eh * (0.16 + k * 0.03)}`} fill="none" stroke={def.line} strokeWidth={lw * 0.8} strokeLinecap="round"/>)}
          </g>); })}
    </svg>);
}

function AssistantLifeRoomBed({ id, W, floorY, sleepers = [], look }) {
  const bw = Math.min(W * 0.8, 340), left = W / 2 - bw / 2, bottom = floorY + 58, mattTop = bottom - 50;
  const quilt = ASSISTANT_LIFE_ROOM_QUILT[id] || ASSISTANT_LIFE_ROOM_QUILT.mua;
  const pillow = { left: left + 22, top: mattTop - 20, w: Math.min(110, bw * 0.34), h: 36 };
  const [boxes, setBoxes] = React.useState({});
  const items = sleepers.map(pid => { const a = assistantById(pid); if (!a) return null; const src = assistantLifeSleepSrc(pid, assistantFullImage(a, 'normal')); return { pid, who: a, src, face: assistantLifeRoomFaceOf(pid, src) }; }).filter(Boolean);
  const key = items.map(x => x.src).join('|');
  React.useEffect(() => { let alive = true; Promise.all(items.map(x => (typeof assistantLifeStandBox === 'function' ? assistantLifeStandBox(x.src) : Promise.resolve(null)))).then(bs => { if (!alive) return; const o = {}; items.forEach((x, i) => { o[x.src] = bs[i] || { t: 0, b: 1, l: 0, r: 1, ar: 0.7 }; }); setBoxes(o); }); return () => { alive = false; }; }, [key]);
  const F = Math.min(30, W * 0.078); // 顔の大きさ(m=1 の人の目から顎)。閉じた目が見える大きさ
  const night = look === 'night';
  return (
    <div aria-hidden="true" data-assistant-life-roomview-front="bed" className="pointer-events-none absolute inset-0">
      {/* 床の影・脚 */}
      <span style={{ position: 'absolute', left: left - 6, top: bottom - 6, width: bw + 12, height: 18, borderRadius: '50%', background: 'radial-gradient(#0007,transparent 70%)' }}/>
      {[left + 8, left + bw - 20].map((x, i) => <span key={i} style={{ position: 'absolute', left: x, top: bottom - 14, width: 12, height: 16, borderRadius: 3, background: '#5c3a1f' }}/>)}
      {/* 頭板(左)と足板(右) */}
      <span style={{ position: 'absolute', left, top: mattTop - 64, width: 18, height: 118, borderRadius: '9px 9px 3px 3px', background: 'linear-gradient(90deg,#a06a3c,#7a4a2a)', boxShadow: '2px 0 4px #0004' }}/>
      <span style={{ position: 'absolute', left: left + bw - 16, top: mattTop - 22, width: 16, height: 76, borderRadius: '8px 8px 3px 3px', background: 'linear-gradient(90deg,#a06a3c,#7a4a2a)' }}/>
      {/* 敷き布団の台 */}
      <span style={{ position: 'absolute', left: left + 14, top: mattTop + 18, width: bw - 26, height: 26, borderRadius: 4, background: 'linear-gradient(#8a5a33,#6b4426)' }}/>
      <span style={{ position: 'absolute', left: left + 14, top: mattTop + 2, width: bw - 26, height: 20, borderRadius: 6, background: '#f8fafc' }}/>
      {/* 枕 */}
      <span data-assistant-life-roomview-pillow style={{ position: 'absolute', left: pillow.left, top: pillow.top, width: pillow.w, height: pillow.h, borderRadius: 16, background: 'linear-gradient(#ffffff,#e2e8f0)', boxShadow: 'inset 0 -4px 0 #cbd5e1, 0 2px 3px #0003' }}/>
      {/* 寝ている頭(倒して枕の上) */}
      {items.map((x, i) => {
        const box = boxes[x.src]; if (!box) return null;
        const r = assistantLifeRoomPlace({ ...x, box }, F, 0, 0);
        const U = r.U || F * 2.63;
        const cw = U * 1.2, ch = U * 1.32, y0 = -0.22 * U; // 切り出す枠(頭のてっぺんの少し上〜顎の少し下・頭の幅)
        // 倒すと縦横が入れかわる(見た目の幅 ch・高さ cw)。頭の後ろを枕の左端に、下端を枕の6割の高さに沈める
        const cx = pillow.left + ch / 2 + 2 + i * 14, cy = pillow.top + pillow.h * 0.6 - cw / 2 - i * 6;
        return (
          <div key={x.pid} data-assistant-life-roomview-sleeper={x.pid} style={{ position: 'absolute', left: cx - cw / 2, top: cy - ch / 2, width: cw, height: ch, transform: 'rotate(-78deg)', transformOrigin: '50% 50%', overflow: 'hidden',
            WebkitMaskImage: 'linear-gradient(#000 82%,transparent)', maskImage: 'linear-gradient(#000 82%,transparent)' }}>
            <img src={x.src} alt="" draggable={false} style={{ position: 'absolute', left: r.left + cw / 2, top: r.top - y0, width: r.width, height: r.height, maxWidth: 'none', filter: `saturate(.9) brightness(${night ? 0.72 : 0.9})` }}/>
            <AssistantLifeSleepEyes pid={x.pid} src={x.src} w={r.width} h={r.height} style={{ left: r.left + cw / 2, top: r.top - y0, filter: `saturate(.9) brightness(${night ? 0.72 : 0.9})` }}/>
          </div>); })}
      {/* 掛け布団(2026-11-08 社長「布団を膨らませて顔にちょっとかかる感じに」): 肩・体・足のふくらみのある形で、顔の下半分〜目のあたりまでかぶせる(髪と頭のてっぺんは見せる) */}
      {(() => {
        const U = U0(F), ch = U * 1.32, cw = U * 1.2;
        const headLeft = pillow.left + 2, cy = pillow.top + pillow.h * 0.6 - cw / 2;
        const qx = items.length ? headLeft + 1.0 * U : pillow.left + pillow.w * 0.62; // 閉じた目が見える所から右(顎の側)を覆う(2026-11-08 社長「目を閉じる」)
        // 胴体(胸〜腰)がいちばん高く、腰で少し下がり、ひざの山・すねで下がり・足先でまたふくらむ(2026-11-08 社長「足の方とか胴体分を意識して膨らませたい」)
        const qTop = items.length ? cy - cw * 0.42 : mattTop - 30; // 胴体のいちばん高い所は頭の上の端くらい
        const qw = Math.max(60, left + bw - 14 - qx), qh = Math.max(50, mattTop + 34 - qTop);
        const pid = `mhlq-${id}`;
        const X = (r) => (qw * r).toFixed(1), Y = (r) => (qh * r).toFixed(1);
        const d = `M0,${qh} L0,${Y(0.42)} Q0,${Y(0.3)} ${X(0.05)},${Y(0.28)}`
          + ` C${X(0.1)},${Y(0.26)} ${X(0.12)},${Y(0.06)} ${X(0.22)},${Y(0.02)}`   // 肩から胸へ
          + ` C${X(0.32)},${Y(-0.01)} ${X(0.4)},${Y(0.04)} ${X(0.46)},${Y(0.16)}`  // 胸〜腰のいちばん高いふくらみ
          + ` C${X(0.5)},${Y(0.24)} ${X(0.54)},${Y(0.26)} ${X(0.58)},${Y(0.22)}`   // 腰のくぼみ
          + ` C${X(0.64)},${Y(0.12)} ${X(0.7)},${Y(0.1)} ${X(0.75)},${Y(0.18)}`    // ひざの山
          + ` C${X(0.79)},${Y(0.26)} ${X(0.83)},${Y(0.34)} ${X(0.87)},${Y(0.3)}`   // すね
          + ` C${X(0.9)},${Y(0.18)} ${X(0.96)},${Y(0.14)} ${X(0.99)},${Y(0.3)}`    // 足先のふくらみ
          + ` L${qw},${Y(0.62)} L${qw},${qh} Z`;
        // しわ(くぼみから下へ流れる影)
        const folds = [[0.5, 0.24, 0.47, 0.75], [0.8, 0.3, 0.82, 0.8], [0.6, 0.2, 0.66, 0.6], [0.2, 0.06, 0.16, 0.5]];
        return (
          <svg data-assistant-life-roomview-quilt width={qw} height={qh} viewBox={`0 0 ${qw} ${qh}`} style={{ position: 'absolute', left: qx, top: qTop, overflow: 'visible', filter: 'drop-shadow(0 4px 5px #0006)' }}>
            <defs>
              <pattern id={pid} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill={quilt[0]}/><rect width="2" height="14" fill={quilt[1]} opacity=".45"/></pattern>
              <linearGradient id={`${pid}-s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".42"/><stop offset=".45" stopColor="#fff" stopOpacity="0"/><stop offset=".8" stopColor="#000" stopOpacity=".12"/><stop offset="1" stopColor="#000" stopOpacity=".3"/></linearGradient>
            </defs>
            <path d={d} fill={`url(#${pid})`}/>
            <path d={d} fill={`url(#${pid}-s)`}/>
            {folds.map(([x1, y1, x2, y2], i) => <path key={i} d={`M${X(x1)},${Y(y1)} Q${X((x1 + x2) / 2 + 0.02)},${Y((y1 + y2) / 2)} ${X(x2)},${Y(y2)}`} fill="none" stroke="#000" strokeOpacity=".16" strokeWidth="3" strokeLinecap="round"/>)}
            {/* ふくらみの上の光 */}
            <path d={`M${X(0.18)},${Y(0.07)} C${X(0.26)},${Y(0.02)} ${X(0.36)},${Y(0.03)} ${X(0.42)},${Y(0.1)}`} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round"/>
            <path d={`M${X(0.66)},${Y(0.15)} C${X(0.69)},${Y(0.12)} ${X(0.72)},${Y(0.13)} ${X(0.74)},${Y(0.17)}`} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round"/>
            {/* 顔の側の折り返し */}
            <path d={`M3,${qh} L3,${Y(0.42)} Q3,${Y(0.31)} ${X(0.05)},${Y(0.3)}`} fill="none" stroke="#ffffff" strokeOpacity=".85" strokeWidth="9" strokeLinecap="round"/>
          </svg>); })()}
      {items.length > 0 && <span style={{ position: 'absolute', left: pillow.left + pillow.w * 0.3, top: pillow.top - U0(F) * 1.2, fontSize: 22 }}>💤</span>}
    </div>);
}
const U0 = (F) => F * 2.63;

// 大きな部屋の絵。people … 部屋にいる助手(1〜4人)/away … 留守のときの札 { title, sub }/team … マスモン { monster, nick, colors }
//   onPerson(id)・onMasmon(index)・onFurn(f) … 押したとき(無ければ押せない)。dock … 下に重ねる札の段(呼ぶ側の部品)
function AssistantLifeRoomScene({ id, look = 'noon', land = false, people = [], sleepIds = [], away = null, team = [], furn = [], bubble = '', title = '', sub = '', onBack = null, onPerson = null, onMasmon = null, dock = null, backLabel = '← 家へ', padLeft = 0, layoutWho = null, layoutEdit = null, layoutItems = null }) {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState({ w: 390, h: 640 });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const re = () => setSize(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    re();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', re); return () => window.removeEventListener('resize', re); }
    const ro = new ResizeObserver(re); ro.observe(el); return () => ro.disconnect();
  }, []);
  const [tip, setTip] = React.useState(null);
  React.useEffect(() => { if (!tip) return undefined; const t = setTimeout(() => setTip(null), 2200); return () => clearTimeout(t); }, [tip]);
  const roomLook = ASSISTANT_LIFE_ROOM_LOOK[id] || ASSISTANT_LIFE_ROOM_LOOK.mua;
  const { w: W, h: H } = size;
  const dockH = dock ? (land ? 96 : 104) : 0;
  const topH = land ? 46 : 64;
  // 床の線: 部屋の高さ(帯と札の段を除く)の 55% あたり
  const usable = Math.max(200, H - dockH - topH);
  const floorY = topH + Math.round(usable * (land ? 0.58 : 0.56));
  const night = look === 'night', evening = look === 'evening';
  const n = Math.max(1, Math.min(4, people.length));
  const deskTop = floorY - Math.round(usable * 0.05);
  // 立ち絵(①②③): 見えている体の範囲を測り、オクリモノ3の測り方で置く
  const standItems = people.slice(0, 4).map(pid => { const a = assistantById(pid); if (!a) return null; const src = assistantFullImage(a, sleepIds.includes(pid) ? 'normal' : 'happy'); return { pid, who: a, src, face: assistantLifeRoomFaceOf(pid, src) }; }).filter(Boolean);
  const [boxes, setBoxes] = React.useState({});
  const srcKey = standItems.map(x => x.src).join('|');
  React.useEffect(() => { let alive = true; Promise.all(standItems.map(x => (typeof assistantLifeStandBox === 'function' ? assistantLifeStandBox(x.src) : Promise.resolve(null)))).then(bs => { if (!alive) return; const o = {}; standItems.forEach((x, i) => { o[x.src] = bs[i] || { t: 0, b: 1, l: 0, r: 1, ar: 0.7 }; }); setBoxes(o); }); return () => { alive = false; }; }, [srcKey]);
  const lay = assistantLifeRoomStandLayout(standItems.map(x => ({ ...x, box: boxes[x.src] })), W, usable, deskTop, land, people.length > 0 && people.every(x => sleepIds.includes(x)));
  const asleep = people.length > 0 && people.every(x => sleepIds.includes(x));
  const frontKind = asleep ? 'bed' : (ASSISTANT_LIFE_ROOM_FRONT[id] || 'desk');
  const frontW = Math.min(W - 24, lay ? Math.round(Math.max(...lay.map(p => p.cx + p.w / 2)) - Math.min(...lay.map(p => p.cx - p.w / 2)) + 60) : Math.round(W * 0.6));
  // マスモン: 手前の床に2列(4体までは1列)。奥の列は小さく
  const mN = team.length, rows = mN > 4 ? 2 : 1, perRow = Math.ceil(mN / rows);
  const mBig = Math.round(Math.min(78, (W - 24) / Math.max(4, perRow) * 0.9, (H - dockH - floorY - 40) / (rows === 2 ? 1.9 : 1.15)));
  const calm = assistantLifeRoomCalm();
  // layoutWho … 自分の家の助手(保存してある並びで描く)/ layoutItems … よその家の並び(フレンドの家。assistantLifeLayoutUnpack の結果)/ layoutEdit … 模様替えの間
  const layoutOn = (!!layoutWho || Array.isArray(layoutItems)) && typeof assistantLifeRoomEditEnabled === 'function' && assistantLifeRoomEditEnabled() && typeof AssistantLifeRoomLayoutLayer === 'function';
  const layoutGeom = { W, top: topH, floorY, bottom: H - dockH };
  const furnBox = (slot) => slot === 'ceil' ? { left: W * 0.42, top: topH + 6, fs: 36 } : slot === 'wall' ? { left: W * 0.06, top: topH + usable * 0.18, fs: 44 } : { left: W * 0.06, top: floorY - 58, fs: 52 };
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden" data-assistant-life-roomview={id} data-assistant-life-roomview-look={look}
      style={{ background: `linear-gradient(${roomLook.wall[0]},${roomLook.wall[1]})` }}>
      <style>{`@keyframes mhlRvWalk{0%,18%{transform:translateX(0)}45%,62%{transform:translateX(var(--d))}90%,100%{transform:translateX(0)}}`}</style>
      {/* 腰板・床・窓 */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: floorY - 64, height: 64, background: 'linear-gradient(#ffffff40,#00000018)', borderTop: '3px solid #00000022' }}/>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: floorY, bottom: 0, background: 'repeating-linear-gradient(90deg,#a8713f 0 64px,#9a6538 64px 66px),linear-gradient(#b07a4a,#7d5230)', backgroundBlendMode: 'multiply', borderTop: '4px solid #6b4426' }}/>
      <div aria-hidden="true" style={{ position: 'absolute', right: W * 0.06, top: topH + usable * 0.06, width: Math.min(130, W * 0.3), height: Math.min(96, usable * 0.22), borderRadius: 8, border: '6px solid #ffffff99',
        background: night ? 'radial-gradient(circle at 70% 30%,#fff 0 5px,transparent 6px),linear-gradient(#0b1030,#1e2a5a)' : evening ? 'linear-gradient(#f59e0b,#fb7185)' : look === 'morning' ? 'linear-gradient(#93c5fd,#fde68a)' : 'linear-gradient(#7cc4ff,#d6f0ff)' }}/>
      {/* 置いた家具(天井・壁・床)。押すと名前 */}
      {/* 模様替え(公開の印 assistantLifeRoomEdit・56-assistant-life-roomedit.jsx): 自分の家の部屋は、保存してある並びで描く。助手の後ろの層 */}
      {layoutOn && <AssistantLifeRoomLayoutLayer who={layoutWho} items={layoutEdit ? layoutEdit.items : layoutItems} geom={layoutGeom} front={false} onTip={layoutEdit ? null : setTip}/>}
      {!layoutOn && furn.map((f) => { const b = furnBox(f.slot); return (
        <button key={f.slot} type="button" data-assistant-life-roomview-furn={f.key} onClick={() => setTip(`${f.emoji} ${f.name}`)} className="absolute" style={{ left: b.left, top: b.top, fontSize: b.fs, lineHeight: 1, filter: 'drop-shadow(0 5px 4px #0005)' }}>{f.emoji}</button>); })}
      {/* 助手(①③)と前の家具(②) */}
      {asleep && <AssistantLifeRoomBed id={id} W={W} floorY={floorY} sleepers={people} look={look}/>}
      {!asleep && lay && standItems.map((x, i) => (
        <AssistantLifeRoomFigure key={x.pid} who={x.who} src={x.src} p={lay[i]} look={look} sleep={sleepIds.includes(x.pid)} onPress={onPerson ? () => onPerson(x.pid) : null}/>))}
      {people.length > 0 && !asleep && <AssistantLifeRoomFront kind={frontKind} cx={W / 2} top={deskTop} w={frontW} items={ASSISTANT_LIFE_ROOM_DESK_ITEMS[id] || []}/>}
      {/* 助手より前に出した家具(机の前) */}
      {layoutOn && <AssistantLifeRoomLayoutLayer who={layoutWho} items={layoutEdit ? layoutEdit.items : layoutItems} geom={layoutGeom} front={true} onTip={layoutEdit ? null : setTip}/>}
      {away && (
        <div className="absolute left-1/2 -translate-x-1/2 rounded-2xl border-2 border-pink-300 bg-slate-950/90 px-3 py-2 text-center" style={{ top: floorY - 120 }} data-assistant-life-roomview-away>
          <p className="whitespace-nowrap text-[14px] font-black text-white">{away.title}</p>
          {away.sub && <p className="whitespace-nowrap text-[10.5px] font-bold text-slate-300">{away.sub}</p>}
        </div>)}

      {/* マスモン(全部・歩く)。押すとくわしい画面 */}
      {team.map((t, i) => {
        const row = rows === 2 && i < perRow ? 0 : rows === 2 ? 1 : 1, k = rows === 2 && i >= perRow ? i - perRow : i, cnt = rows === 2 ? (row === 0 ? perRow : mN - perRow) : mN;
        const s = row === 0 && rows === 2 ? Math.round(mBig * 0.8) : mBig;
        const span = W - 24, x = 12 + (span / cnt) * (k + 0.5) - s / 2 + (row === 1 && rows === 2 ? span / cnt / 4 : 0);
        const yTop = asleep ? floorY + 70 : floorY + 18; // ベッドは床の手前まで出るので、マスモンはその下
        const y = Math.min(H - dockH - s - 6, row === 0 && rows === 2 ? yTop : yTop + (rows === 2 ? s * 0.85 : Math.max(6, (H - dockH - yTop - s) * 0.4))); // 部屋の下にはみ出さない
        const d = Math.round(((i % 2) ? -1 : 1) * Math.min(28, span / cnt / 3));
        const mt = { monster: t.monster, nick: t.nick, dye: { colors: t.colors || [] } };
        return (
          <button key={`${t.monster}-${i}`} type="button" data-assistant-life-roomview-masmon={i} aria-label={t.nick || 'マスモン'} onClick={() => (onMasmon ? onMasmon(i) : setTip(t.nick))} className="absolute"
            style={{ left: Math.max(4, Math.min(W - s - 4, x)), top: y, width: s, height: s, '--d': `${d}px`, animation: calm ? 'none' : `mhlRvWalk ${7 + (i % 3) * 2}s ease-in-out ${i * 0.7}s infinite` }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 6, right: 6, bottom: -3, height: 10, borderRadius: '50%', background: 'radial-gradient(#0006,transparent 70%)' }}/>
            {typeof AssistantMasmonPic === 'function' ? <AssistantMasmonPic t={mt} size={s}/> : null}
          </button>); })}
      {/* 時間帯: 夜は暗く・灯り */}
      {layoutOn && layoutEdit && <AssistantLifeRoomLayoutHandles items={layoutEdit.items} geom={layoutGeom} sel={layoutEdit.sel} onSelect={layoutEdit.onSelect} onMove={layoutEdit.onMove} onDrop={layoutEdit.onDrop} onScale={layoutEdit.onScale}/>}
      {night && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 18% 30%,#ffc46b40 0,#ffc46b18 110px,transparent 220px),#050a2480' }}/>}
      {night && <span aria-hidden="true" className="pointer-events-none absolute" style={{ left: W * 0.08, top: topH + 2, fontSize: 26 }}>🏮</span>}
      {evening && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: '#ff8a3018' }}/>}
      {/* 吹き出しは夜の暗さ・灯り・壁の家具より前(横で🏮と壁の家具が字に重なった・2026-11-08 オトズレ3)。左の壁の家具と灯りの列(幅の22%まで)を避ける */}
      {bubble && people.length > 0 && (
        <p className="absolute z-[6] max-w-[64%] rounded-2xl bg-white px-2.5 py-1.5 text-[12px] font-black leading-snug text-slate-900 shadow" style={{ left: W * 0.24, top: Math.max(topH + 8, (lay ? Math.min(...lay.map(p => p.visTop)) : deskTop - 200) - 40), wordBreak: 'auto-phrase' }} data-assistant-life-roomview-bubble>{bubble}</p>)}
      {/* 上の帯 */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-[#0b1020f0] to-transparent px-3 pb-4" style={{ paddingTop: land ? 6 : 'calc(8px + env(safe-area-inset-top))', paddingLeft: 12 + padLeft }}>
        {onBack && <button type="button" data-assistant-life-roomview-back onClick={onBack} className="shrink-0 rounded-xl border border-pink-300/60 bg-slate-950/85 px-2.5 py-1.5 text-[12px] font-black text-pink-100 active:scale-95">{backLabel}</button>}
        <div className="min-w-0">
          <p className="truncate text-[17px] font-black leading-tight text-white" style={{ textShadow: '0 2px 4px #000' }}>{title}</p>
          {sub && <p className="truncate text-[10.5px] font-bold text-slate-100" style={{ textShadow: '0 1px 3px #000' }} data-assistant-life-roomview-sub>{sub}</p>}
        </div>
      </div>
      {tip && <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/90 px-3 py-1 text-[11px] font-black text-white" style={{ top: topH + 6 }} data-assistant-life-roomview-tip>{tip}</p>}
      {dock && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1020f2] via-[#0b1020d0] to-transparent px-3 pt-4" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>{dock}</div>}
    </div>);
}
