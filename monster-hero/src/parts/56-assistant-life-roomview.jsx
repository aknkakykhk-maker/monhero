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

// 立ち絵1人(①③): 見えている体の高さ vh で大きさを決め、見えている体の下端を baseY に置く
function AssistantLifeRoomFigure({ who, cx, baseY, vh, look, sleep = false, onPress = null, mood = 'happy' }) {
  const src = assistantFullImage(who, sleep ? 'normal' : mood);
  const [box, setBox] = React.useState(() => (typeof ASSISTANT_LIFE_STAND_BOX !== 'undefined' ? ASSISTANT_LIFE_STAND_BOX.get(src) : null) || null);
  React.useEffect(() => { let alive = true; if (typeof assistantLifeStandBox === 'function') assistantLifeStandBox(src).then(b => { if (alive) setBox(b); }); return () => { alive = false; }; }, [src]);
  const b = box || { t: 0, b: 1, l: 0, r: 1, ar: 0.7 };
  const ih = vh / Math.max(0.2, b.b - b.t), iw = ih * (b.ar || 0.7);
  const left = cx - ((b.l + b.r) / 2) * iw, top = baseY - b.b * ih;
  const pos = { position: 'absolute', left, top, width: iw, height: ih, maxWidth: 'none' };
  const night = look === 'night', evening = look === 'evening';
  // 部屋の色味(①)。絵の形で切り抜いた色の層を、かけ算で重ねる
  const tone = night ? 'linear-gradient(100deg,#ffd08a 0%,#c9c2ee 45%,#8a86c0 100%)'
    : evening ? 'linear-gradient(100deg,#ffe0b0 0%,#f2c9b0 60%,#c99a90 100%)'
    : 'linear-gradient(100deg,#ffffff 0%,#f6ece8 60%,#d9c2bc 100%)';
  const mask = { WebkitMaskImage: `url(${src})`, WebkitMaskSize: '100% 100%', maskImage: `url(${src})`, maskSize: '100% 100%' };
  const Tag = onPress ? 'button' : 'div';
  return (
    <Tag type={onPress ? 'button' : undefined} onClick={onPress || undefined} aria-label={onPress ? `${who.name}のようす` : undefined} data-assistant-life-roomview-person={who.id}
      className="absolute inset-0 block" style={{ pointerEvents: 'none' }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: cx - vh * 0.36, top: baseY - 12, width: vh * 0.72, height: 26, borderRadius: '50%', background: 'radial-gradient(#0007,transparent 70%)' }}/>
      <img src={src} alt="" draggable={false} data-assistant-life-roomview-fig={who.id} style={{ ...pos, pointerEvents: onPress ? 'auto' : 'none', filter: `drop-shadow(0 0 .6px #2a1414cc) saturate(.92) sepia(.1)${sleep ? ' brightness(.6)' : ''}` }}/>
      <span aria-hidden="true" style={{ ...pos, ...mask, background: tone, mixBlendMode: 'multiply', pointerEvents: 'none' }}/>
      {sleep && <span aria-hidden="true" style={{ position: 'absolute', left: cx + vh * 0.12, top: top + b.t * ih, fontSize: 18 }}>💤</span>}
    </Tag>);
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
  // ③ 見えている体の高さ(手前のマスモンと釣り合う大きさ)。人数が多いと少し小さく
  const vh = Math.round(Math.min(usable * 0.68, W * (land ? 0.5 : 0.8)) * (n >= 3 ? 0.8 : n === 2 ? 0.9 : 1));
  const xs = n === 1 ? [0.55] : n === 2 ? [0.4, 0.66] : n === 3 ? [0.28, 0.52, 0.76] : [0.2, 0.4, 0.6, 0.8];
  const deskTop = floorY - Math.round(vh * 0.12);
  const asleep = people.length > 0 && people.every(x => sleepIds.includes(x));
  const frontKind = asleep ? 'bed' : (ASSISTANT_LIFE_ROOM_FRONT[id] || 'desk');
  const frontW = Math.min(W - 24, Math.round(vh * 0.62 * Math.max(1.4, n) + 40));
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
      {people.map((pid, i) => { const a = assistantById(pid); if (!a) return null; return (
        <AssistantLifeRoomFigure key={pid} who={a} cx={W * xs[i]} baseY={deskTop + Math.round(vh * 0.32)} vh={vh} look={look} sleep={sleepIds.includes(pid)} onPress={onPerson ? () => onPerson(pid) : null}/>); })}
      {people.length > 0 && <AssistantLifeRoomFront kind={frontKind} cx={W * (n === 1 ? xs[0] : 0.5)} top={deskTop} w={frontW} items={ASSISTANT_LIFE_ROOM_DESK_ITEMS[id] || []}/>}
      {away && (
        <div className="absolute left-1/2 -translate-x-1/2 rounded-2xl border-2 border-pink-300 bg-slate-950/90 px-3 py-2 text-center" style={{ top: floorY - 120 }} data-assistant-life-roomview-away>
          <p className="whitespace-nowrap text-[14px] font-black text-white">{away.title}</p>
          {away.sub && <p className="whitespace-nowrap text-[10.5px] font-bold text-slate-300">{away.sub}</p>}
        </div>)}
      {bubble && people.length > 0 && (
        <p className="absolute max-w-[62%] rounded-2xl bg-white px-2.5 py-1.5 text-[12px] font-black leading-snug text-slate-900 shadow" style={{ left: W * 0.06, top: Math.max(topH + 8, deskTop - vh - 6), wordBreak: 'auto-phrase' }} data-assistant-life-roomview-bubble>{bubble}</p>)}
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
