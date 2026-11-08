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
//   表と関数はオクリモノ3の共通のもの(assistantLifeStandFace(pid, src)・assistantLifeStandRule() → { ec, len, cut }。docs/progress/assistant-peer/gifts/stagec/STAND-MEASURE.md)を読む。
//   まだ無い版では、同じ決まりの既定(ふつうの形)で置く
const assistantLifeRoomStandRule = () => {
  const def = { ec: 0.1639, len: 2.63, cut: { above: 0.55, below: 1.8, fade: 0.45 } };
  try { if (typeof assistantLifeStandRule === 'function') { const r = assistantLifeStandRule(); if (r && Number.isFinite(r.ec) && Number.isFinite(r.len) && r.cut) return r; } } catch (_) { /* 既定へ */ }
  return def;
};
const assistantLifeRoomFaceOf = (pid, src) => {
  try { if (typeof assistantLifeStandFace === 'function') return assistantLifeStandFace(pid, src); } catch (_) { /* 既定へ */ }
  return { top: 0.05, eye: 0.33, chin: 0.47, m: 1 };
};
// 部屋の大きさから、並ぶ人の置き場所を決める(px)。顔の長さ F を全員同じに(人数で決める高さと、受け持ちの幅を超えない長さの小さいほう)。
//   頭のてっぺんの線は、切る下端(てっぺんから顔1.8個)が前の家具の天板より少し下に来る高さ。左右は受け持ちの幅の真ん中(重ならない)
const assistantLifeRoomStandLayout = (items, W, usable, deskTop, land, bed = false) => {
  const n = items.length;
  if (!n || items.some(x => !x.box)) return null;
  const R = assistantLifeRoomStandRule();
  const span = W * (land ? 0.8 : 0.86), sw = span / n, x0 = (W - span) / 2;
  let F = Math.min(usable * ({ 1: 0.07, 2: 0.07, 3: 0.062, 4: 0.055 }[Math.min(4, n)]), W * 0.085); // 1人でも2人でも顔の大きさがなるべく同じ(縦は幅で上限)
  const visH = (x, f) => f / (R.ec * (x.face.m || 1));
  const visW = (x, f) => visH(x, f) * (x.box.r - x.box.l) * x.box.ar / (x.box.b - x.box.t);
  for (const x of items) { const w1 = visW(x, 1); if (w1 > 0) F = Math.min(F, (sw * 0.98) / w1); }
  const U = F * R.len;
  // 寝ているとき(ベッド)は、顎がベッドの上に来る高さ(頭を枕にのせる)
  const topY = bed ? deskTop + 0.15 * U - U : deskTop + 0.2 * U - R.cut.below * U;
  return items.map((x, i) => {
    const vh = visH(x, F), ih = vh / (x.box.b - x.box.t), iw = ih * x.box.ar;
    const visTop = topY - (x.face.top || 0) * vh, imgTop = visTop - x.box.t * ih;
    const cx = x0 + sw * (i + 0.5);
    const frameTop = topY - R.cut.above * U, frameBottom = topY + R.cut.below * U;
    const clip = [Math.max(0, frameTop - imgTop), Math.max(0, imgTop + ih - frameBottom)];
    const fade = x.face.head ? null : [Math.max(0, (frameBottom - R.cut.fade * U - imgTop) / ih), Math.min(1, (frameBottom - imgTop) / ih)];
    return { left: cx - ((x.box.l + x.box.r) / 2) * iw, top: imgTop, width: iw, height: ih, clip, fade, cx, face: F, visTop, headTop: topY, frameBottom, w: visW(x, F) };
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

// 大きな部屋の絵。people … 部屋にいる助手(1〜4人)/away … 留守のときの札 { title, sub }/team … マスモン { monster, nick, colors }
//   onPerson(id)・onMasmon(index)・onFurn(f) … 押したとき(無ければ押せない)。dock … 下に重ねる札の段(呼ぶ側の部品)
function AssistantLifeRoomScene({ id, look = 'noon', land = false, people = [], sleepIds = [], away = null, team = [], furn = [], bubble = '', title = '', sub = '', onBack = null, onPerson = null, onMasmon = null, dock = null, backLabel = '← 家へ', padLeft = 0 }) {
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
      {furn.map((f) => { const b = furnBox(f.slot); return (
        <button key={f.slot} type="button" data-assistant-life-roomview-furn={f.key} onClick={() => setTip(`${f.emoji} ${f.name}`)} className="absolute" style={{ left: b.left, top: b.top, fontSize: b.fs, lineHeight: 1, filter: 'drop-shadow(0 5px 4px #0005)' }}>{f.emoji}</button>); })}
      {/* 助手(①③)と前の家具(②) */}
      {lay && standItems.map((x, i) => (
        <AssistantLifeRoomFigure key={x.pid} who={x.who} src={x.src} p={lay[i]} look={look} sleep={sleepIds.includes(x.pid)} onPress={onPerson ? () => onPerson(x.pid) : null}/>))}
      {people.length > 0 && <AssistantLifeRoomFront kind={frontKind} cx={W / 2} top={deskTop} w={frontW} items={ASSISTANT_LIFE_ROOM_DESK_ITEMS[id] || []}/>}
      {away && (
        <div className="absolute left-1/2 -translate-x-1/2 rounded-2xl border-2 border-pink-300 bg-slate-950/90 px-3 py-2 text-center" style={{ top: floorY - 120 }} data-assistant-life-roomview-away>
          <p className="whitespace-nowrap text-[14px] font-black text-white">{away.title}</p>
          {away.sub && <p className="whitespace-nowrap text-[10.5px] font-bold text-slate-300">{away.sub}</p>}
        </div>)}
      {bubble && people.length > 0 && (
        <p className="absolute max-w-[62%] rounded-2xl bg-white px-2.5 py-1.5 text-[12px] font-black leading-snug text-slate-900 shadow" style={{ left: W * 0.06, top: Math.max(topH + 8, (lay ? Math.min(...lay.map(p => p.visTop)) : deskTop - 200) - 40), wordBreak: 'auto-phrase' }} data-assistant-life-roomview-bubble>{bubble}</p>)}
      {/* マスモン(全部・歩く)。押すとくわしい画面 */}
      {team.map((t, i) => {
        const row = rows === 2 && i < perRow ? 0 : rows === 2 ? 1 : 1, k = rows === 2 && i >= perRow ? i - perRow : i, cnt = rows === 2 ? (row === 0 ? perRow : mN - perRow) : mN;
        const s = row === 0 && rows === 2 ? Math.round(mBig * 0.8) : mBig;
        const span = W - 24, x = 12 + (span / cnt) * (k + 0.5) - s / 2 + (row === 1 && rows === 2 ? span / cnt / 4 : 0);
        const y = row === 0 && rows === 2 ? floorY + 18 : floorY + (rows === 2 ? 18 + s * 0.85 : Math.max(24, (H - dockH - floorY - s) * 0.45));
        const d = Math.round(((i % 2) ? -1 : 1) * Math.min(28, span / cnt / 3));
        const mt = { monster: t.monster, nick: t.nick, dye: { colors: t.colors || [] } };
        return (
          <button key={`${t.monster}-${i}`} type="button" data-assistant-life-roomview-masmon={i} aria-label={t.nick || 'マスモン'} onClick={() => (onMasmon ? onMasmon(i) : setTip(t.nick))} className="absolute"
            style={{ left: Math.max(4, Math.min(W - s - 4, x)), top: y, width: s, height: s, '--d': `${d}px`, animation: calm ? 'none' : `mhlRvWalk ${7 + (i % 3) * 2}s ease-in-out ${i * 0.7}s infinite` }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 6, right: 6, bottom: -3, height: 10, borderRadius: '50%', background: 'radial-gradient(#0006,transparent 70%)' }}/>
            {typeof AssistantMasmonPic === 'function' ? <AssistantMasmonPic t={mt} size={s}/> : null}
          </button>); })}
      {/* 時間帯: 夜は暗く・灯り */}
      {night && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 18% 30%,#ffc46b40 0,#ffc46b18 110px,transparent 220px),#050a2480' }}/>}
      {night && <span aria-hidden="true" className="pointer-events-none absolute" style={{ left: W * 0.1, top: topH + usable * 0.12, fontSize: 28 }}>🏮</span>}
      {evening && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: '#ff8a3018' }}/>}
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
