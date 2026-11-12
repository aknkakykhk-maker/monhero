// ===== 助手紹介(2026-11-11 社長「どっかに助手のキャラ紹介ページもほしいね」・docs/progress/assistant-life/profile/PLAN.md) =====
//   助手ライフの下のタブ「📖 紹介」→ 助手の一覧(図鑑のように並ぶ)→ 選ぶとその助手の紹介が開く。
//   紹介に出すもの: ①立ち絵・名前・一言紹介・ひとこと ②人となり(性格・生活・いまの話し方)・好きなもの・苦手なもの
//                   ③仲良し度・呼び方・推し・マスモン ④台詞の試し聞き(文字+表情。ボイスはまだ無い)
//   社長の答え: 好き・苦手は贈って分かったものだけ(まだは「？」+ヒント)/台詞は仲良し度で増える/会っていない助手は開けない(点線の「？」で並べ「会った助手 6/8」)/
//               公開前の助手(公開の印が立っていない)は名前・絵・人数のどれにも出さない/好みが分かった・台詞が増えた助手に NEW
//   データはどれも今あるものを読むだけ(ASSISTANTS の intro・tagline・greeting/ASSISTANT_LIFE_RHYTHM/仲良し度の段/贈り物と家具の好み/マスモンの表/台詞)。
//   保存は NEW の印のための新しいキー1つだけ(mh_assistant_life_profile_seen_v1 = { [助手id]: { n: 見た時点の数 } })。既存のキーには書かない
//   公開の印 assistantLifeProfile が真になるまで、タブも出ない

const ASSISTANT_LIFE_PROFILE_SEEN_KEY = 'mh_assistant_life_profile_seen_v1';
const assistantLifeProfileOn = () => typeof assistantLifeEnabled === 'function' && assistantLifeEnabled()
  && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeProfile === true;

// 一覧に並べる助手(公開の印を通す。公開前の助手は数にも入れない)
const assistantLifeProfileRoster = () => (typeof ASSISTANT_LIST !== 'undefined' && Array.isArray(ASSISTANT_LIST) ? ASSISTANT_LIST : []).filter(w => w && typeof assistantReleased === 'function' && assistantReleased(w.id));

// 「見た」の数の保存を読む。壊れた値は捨てる(無い助手はまだ見ていない扱い)
const normalizeAssistantLifeProfileSeen = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, x] of Object.entries(v)) {
    const n = x && typeof x === 'object' ? Number(x.n) : NaN;
    if (typeof id === 'string' && id.length <= 24 && Number.isFinite(n) && n >= 0) out[id] = { n: Math.floor(n) };
  }
  return out;
};

// 仲良し度(点・Lv・段の名前・次まで)。カード部の口と同じ写し(_assistantLifeCardBonds・56-assistant-life-masmon.jsx)を読む
const assistantLifeProfileBond = (id, levelOf) => {
  let points = 0;
  try {
    const b = typeof _assistantLifeCardBonds !== 'undefined' && _assistantLifeCardBonds ? _assistantLifeCardBonds[id] : null;
    const p = typeof normalizeAssistantBond === 'function' ? normalizeAssistantBond(b).points : 0;
    points = Number.isFinite(p) ? p : 0;
  } catch (_) { points = 0; }
  let lv = typeof assistantBondLevel === 'function' ? assistantBondLevel(points) : 1;
  const fromProp = typeof levelOf === 'function' ? Number(levelOf(id)) : NaN;
  if (Number.isFinite(fromProp) && fromProp > lv) lv = fromProp; // 写しがまだ届いていないとき(開いた直後)は画面の値に合わせる
  let stage = null;
  try { stage = typeof assistantBondStageByLevel === 'function' ? assistantBondStageByLevel(lv, id) : null; } catch (_) { stage = null; }
  const next = typeof assistantBondNext === 'function' ? assistantBondNext(points) : null;
  const cur = (typeof ASSISTANT_BOND_LEVELS !== 'undefined' ? ASSISTANT_BOND_LEVELS : []).find(s => s.level === lv);
  const rate = next && cur && next.need > cur.need ? Math.max(0, Math.min(1, (points - cur.need) / (next.need - cur.need))) : 1;
  return { lv, title: (stage && stage.title) || '', tone: (stage && stage.tone) || '', next: next && next.level > lv ? next : null, rate };
};

// プレイヤーの呼び方({name} を埋める)
const assistantLifeProfileCall = (id) => { try { return typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(id) : 'あなた'; } catch (_) { return 'あなた'; } };

// 持ち物の名前と絵(道具)
const assistantLifeProfileItem = (key) => {
  const def = typeof assistantLifeAnyGiftDef === 'function' ? assistantLifeAnyGiftDef(key) : null;
  if (!def) return null;
  const item = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : []).find(x => x && x.id === def.itemId) || {};
  return { key, name: item.name || '', emoji: item.emoji || '🎁' };
};

// 好き・苦手の行。分かったかどうかは贈った記録(mh_assistant_life_likes_v1)を読むだけ
const assistantLifeProfileLikes = (id, giftSt) => {
  const known = (k) => typeof assistantLifeGiftKnown === 'function' && assistantLifeGiftKnown(id, k, giftSt);
  const rows = [];
  const push = (label, likes, of) => {
    if (!likes) return;
    const cells = [...(likes.like || []).map(k => ({ k, like: true })), ...(likes.bad || []).map(k => ({ k, like: false }))]
      .map(c => { const shown = known(c.k); const it = shown ? of(c.k) : null; return { ...c, shown: !!(shown && it), it }; });
    if (cells.length) rows.push({ label, cells });
  };
  push('道具', typeof ASSISTANT_LIFE_GIFT_LIKES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LIKES[id] : null, assistantLifeProfileItem);
  if (typeof assistantLifeSoloOn === 'function' && assistantLifeSoloOn()) push('1人に', typeof ASSISTANT_LIFE_SOLO_LIKES !== 'undefined' ? ASSISTANT_LIFE_SOLO_LIKES[id] : null, assistantLifeProfileItem);
  if (typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled()) push('家具', typeof ASSISTANT_LIFE_FURN_LIKES !== 'undefined' ? ASSISTANT_LIFE_FURN_LIKES[id] : null, (k) => (typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(k) : null));
  const cells = rows.flatMap(r => r.cells);
  // ヒント: まだ分かっていない「好き」のうち、助手の話(ASSISTANT_LIFE_GIFT_HINT_LINES)があるものを1つ
  const hints = typeof ASSISTANT_LIFE_GIFT_HINT_LINES !== 'undefined' && ASSISTANT_LIFE_GIFT_HINT_LINES[id] ? ASSISTANT_LIFE_GIFT_HINT_LINES[id] : {};
  const hintCell = cells.find(c => c.like && !c.shown && hints[c.k] && typeof hints[c.k].t === 'string');
  // モンスター(マスモンの表の好き・苦手。贈る仕組みが無いので最初から出す)
  const plan = typeof assistantMasmonBasePlanOf === 'function' ? assistantMasmonBasePlanOf(id) : null;
  const monOf = (x) => { const m = x && typeof assistantMasmonMon === 'function' ? assistantMasmonMon(x.monster) : null; return m ? { id: x.monster, name: m.name, icon: m.faceIconUrl || m.iconUrl || '', emoji: m.emoji || '🐾' } : null; };
  const monLike = plan && Array.isArray(plan.likeMon) ? plan.likeMon.map(monOf).filter(Boolean) : [];
  const monBad = plan && Array.isArray(plan.dislikeMon) ? plan.dislikeMon.map(monOf).filter(Boolean) : [];
  return { rows, known: cells.filter(c => c.shown).length, total: cells.length, hint: hintCell ? hints[hintCell.k] : null, monLike, monBad };
};

// 台詞の最初に聞ける Lv(bond が無い行は Lv1 から)
const assistantLifeProfileMinBond = (line) => {
  const b = line && line.bond;
  if (Array.isArray(b)) return Number.isFinite(b[0]) ? b[0] : 1;
  return Number.isFinite(b) ? b : 1;
};
// 試し聞きの台詞(種類ごと)。open … いま聞ける行、lockedAt … 次に増えるLv、lockedN … その先にある数
const assistantLifeProfileVoices = (id, lv, giftSt) => {
  const call = assistantLifeProfileCall(id);
  const fill = (t, extra = {}) => {
    let s = String(t || '').replace(/\{name\}/g, call);
    for (const [k, v] of Object.entries(extra)) s = s.split(`{${k}}`).join(v);
    return /[{}]/.test(s) ? '' : s; // 埋められない穴(相手の名前・場所など)の行は出さない
  };
  const groups = [];
  // あいさつ(HOME のひとこと。仲良し度の段で増える)
  try {
    const def = typeof ASSISTANT_SCENES !== 'undefined' ? ASSISTANT_SCENES.home : null;
    const list = def && typeof filterAssistantLines === 'function' ? filterAssistantLines(def.lines || [], id) : [];
    const all = list.map(l => ({ e: l.e, t: fill(l.t), min: assistantLifeProfileMinBond(l) })).filter(l => l.t);
    const seen = new Set();
    const uniq = all.filter(l => (seen.has(l.t) ? false : (seen.add(l.t), true)));
    const open = uniq.filter(l => l.min <= lv);
    const later = uniq.filter(l => l.min > lv);
    const at = later.length ? Math.min(...later.map(l => l.min)) : null;
    if (uniq.length) groups.push({ key: 'home', label: 'あいさつ', open, lockedAt: at, lockedN: later.length });
  } catch (_) {}
  // 贈ったとき(好みが分かった道具の台詞だけ)
  try {
    const out = [];
    const add = (table) => {
      const mine = table && table[id] ? table[id] : {};
      for (const [k, rows] of Object.entries(mine)) {
        if (!(typeof assistantLifeGiftKnown === 'function' && assistantLifeGiftKnown(id, k, giftSt))) continue;
        const it = assistantLifeProfileItem(k);
        for (const r of Array.isArray(rows) ? rows : []) { const t = fill(r && r.t, { item: it ? it.name : '' }); if (t) out.push({ e: r.e, t }); }
      }
    };
    add(typeof ASSISTANT_LIFE_GIFT_LINES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LINES : null);
    if (typeof assistantLifeSoloOn === 'function' && assistantLifeSoloOn()) add(typeof ASSISTANT_LIFE_SOLO_LINES !== 'undefined' ? ASSISTANT_LIFE_SOLO_LINES : null);
    groups.push({ key: 'gift', label: '贈ったとき', open: out, lockedAt: null, lockedN: 0, emptyNote: '贈ると、ここで聞けるようになります' });
  } catch (_) {}
  // 寝言
  try {
    const talks = typeof ASSISTANT_LIFE_SLEEP_TALKS !== 'undefined' ? ASSISTANT_LIFE_SLEEP_TALKS : [];
    const mine = talks.filter(x => x && x.who === id && x.line === 'talk' && Array.isArray(x.lines) && x.lines[0])
      .map(x => ({ e: x.lines[0].e, t: fill(x.lines[0].t), min: Number.isFinite(x.lv) ? x.lv : 1 })).filter(l => l.t);
    const open = mine.filter(l => l.min <= lv), later = mine.filter(l => l.min > lv);
    if (mine.length) groups.push({ key: 'sleep', label: '寝言', open, lockedAt: later.length ? Math.min(...later.map(l => l.min)) : null, lockedN: later.length });
  } catch (_) {}
  return groups;
};

// NEW の印に使う数(分かった好みの数+聞ける台詞の数)
const assistantLifeProfileCount = (id, lv, giftSt) => {
  try {
    const likes = assistantLifeProfileLikes(id, giftSt);
    const voices = assistantLifeProfileVoices(id, lv, giftSt);
    return likes.known + voices.reduce((a, g) => a + g.open.length, 0);
  } catch (_) { return 0; }
};

// 生活のリズム(寝る・起きる時刻)
const assistantLifeProfileRhythm = (id) => {
  const r = typeof ASSISTANT_LIFE_RHYTHM !== 'undefined' ? ASSISTANT_LIFE_RHYTHM[id] : null;
  if (!r) return '';
  const h = (n) => (Number.isFinite(n) ? `${n}時` : '');
  return `${r.label}(${h(r.bed)}ごろ寝て、${h(r.wake)}ごろ起きる)`;
};

// 全身画の先読み(2026-11-12 社長「表示が遅い」: 紹介を開いてから取りに行っていた)。助手ライフ・HOMEで落ち着いたあと、手の空いたときに
//   1枚ずつ裏で取っておく(通信や最初の表示を邪魔しない)。取った絵はブラウザと Service Worker(mh-assets)に残るので、紹介を開いた瞬間に出る。
//   データ節約・低速回線・先読みの失敗は何もしない(開いたときに、ふつうに取りに行くだけ)。保存データには触れない
const ASSISTANT_FULLBODY_PRELOADED = new Set();
let assistantFullBodyPreloadTimer = null;
function assistantLifePreloadFullBodies(metIds) {
  try {
    if (typeof Image === 'undefined' || typeof assistantFullBodyImage !== 'function' || typeof assistantById !== 'function') return;
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
    const todo = [];
    (metIds || []).forEach((id) => {
      const who = assistantById(id);
      const src = who ? assistantFullBodyImage(who, 'happy') : null;
      if (src && !ASSISTANT_FULLBODY_PRELOADED.has(src) && !todo.includes(src)) todo.push(src);
    });
    if (!todo.length || assistantFullBodyPreloadTimer) return;
    const later = (fn) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 2500));
    const next = () => {
      const src = todo.shift();
      if (!src) { assistantFullBodyPreloadTimer = null; return; }
      ASSISTANT_FULLBODY_PRELOADED.add(src);
      const im = new Image();
      im.decoding = 'async';
      try { im.fetchPriority = 'low'; } catch (_) { /* 古い端末は付けない */ }
      im.onload = im.onerror = () => { assistantFullBodyPreloadTimer = later(next); };
      im.src = src;
    };
    assistantFullBodyPreloadTimer = later(next);
  } catch (_) { /* 先読みは、できなくても困らない */ }
}

// 紹介の立ち絵。助手ごとに絵の余白・全身か顔だけかが違うので、町の人形と同じ決まり(顔の表 assistantLifeStandFace と assistantLifeStandRule)で
//   「頭(てっぺんから顎)の長さ」と「頭のてっぺんの高さ」をそろえる(2026-11-11 社長「助手ごとのサイズ感がばらばら」)。測れるまでは出さない
function AssistantLifeProfileStand({ who, head = 0.32, top = 0.16 }) {
  const src = typeof assistantFullImage === 'function' ? assistantFullImage(who, 'happy') : '';
  const boxRef = React.useRef(null);
  const [size, setSize] = React.useState(null);
  const [art, setArt] = React.useState(() => (typeof ASSISTANT_LIFE_STAND_BOX !== 'undefined' && ASSISTANT_LIFE_STAND_BOX.get(src)) || null);
  React.useEffect(() => { let alive = true; if (typeof assistantLifeStandBox === 'function') assistantLifeStandBox(src).then(b => { if (alive) setArt(b); }); return () => { alive = false; }; }, [src]);
  React.useEffect(() => {
    const el = boxRef.current; if (!el) return undefined;
    const f = () => setSize(prev => { const n = { w: el.clientWidth, h: el.clientHeight }; return prev && prev.w === n.w && prev.h === n.h ? prev : n; });
    f();
    let ro = null; try { ro = typeof ResizeObserver === 'function' ? new ResizeObserver(f) : null; if (ro) ro.observe(el); } catch (_) { ro = null; }
    window.addEventListener('resize', f);
    return () => { window.removeEventListener('resize', f); if (ro) ro.disconnect(); };
  }, []);
  const fullSrc = typeof assistantFullBodyImage === 'function' ? assistantFullBodyImage(who, 'happy') : null;
  if (fullSrc) { // 全身画: 枠の高さにおさめて足元をそろえる(頭の大きさは絵ごとの全身の比のまま)
    return (
      <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden" data-assistant-life-profile-stand={who.id} data-assistant-life-profile-fullbody={fullSrc}>
        <img src={fullSrc} alt={who.name} draggable={false} className="absolute" style={{ left: 0, right: 0, bottom: '2%', width: '100%', height: '96%', objectFit: 'contain', objectPosition: 'center bottom' }}/>
      </div>);
  }
  const face = typeof assistantLifeStandFace === 'function' ? assistantLifeStandFace(who.id, src) : null;
  const len = typeof ASSISTANT_LIFE_STAND_FACE_LEN !== 'undefined' ? ASSISTANT_LIFE_STAND_FACE_LEN : 2.63;
  const rule = size && size.h > 0 && art && face && typeof assistantLifeStandRule === 'function'
    ? assistantLifeStandRule({ face, box: art, F: (size.h * head) / len, topY: size.h * top, cx: size.w / 2 }) : null;
  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden" data-assistant-life-profile-stand={who.id}>
      {rule && (() => { // 胸から下は町の人形と同じ所でぼかして消す(絵が途中で切れて浮いて見えないように)。顔だけの絵(ドラ)はそのまま
        const mask = rule.fade ? `linear-gradient(#000 ${Math.round(rule.fade[0] * 100)}%, transparent ${Math.round(rule.fade[1] * 100)}%)` : undefined;
        return <img src={src} alt={who.name} draggable={false} className="absolute" style={{ top: rule.top, left: rule.left, width: rule.width, height: rule.height, maxWidth: 'none', objectFit: 'contain', WebkitMaskImage: mask, maskImage: mask }}/>; })()}
    </div>);
}

// 一覧(タブ「📖 紹介」の中身)
function AssistantLifeProfilePage({ metIds, bondLevelOf = null, land = false, onMasmon = null }) {
  const giftSt = typeof useAssistantLifeGiftState === 'function' ? useAssistantLifeGiftState() : null;
  const [seen, setSeen] = React.useState(null); // 読めるまで null(NEW を出さない)
  const [openId, setOpenId] = React.useState(null);
  const boxRef = React.useRef(null);
  const roster = assistantLifeProfileRoster();
  const met = new Set(Array.isArray(metIds) ? metIds : []);
  const metList = roster.filter(w => met.has(w.id));
  const counts = {};
  for (const w of metList) counts[w.id] = assistantLifeProfileCount(w.id, assistantLifeProfileBond(w.id, bondLevelOf).lv, giftSt);
  React.useEffect(() => {
    let alive = true;
    Promise.resolve(typeof storeGet === 'function' ? storeGet(ASSISTANT_LIFE_PROFILE_SEEN_KEY, null, false) : null)
      .then(v => { if (alive) setSeen(normalizeAssistantLifeProfileSeen(v)); }).catch(() => { if (alive) setSeen({}); });
    return () => { alive = false; };
  }, []);
  const save = (next) => { setSeen(next); try { if (typeof storeSet === 'function') void storeSet(ASSISTANT_LIFE_PROFILE_SEEN_KEY, next, false); } catch (_) {} };
  // はじめて一覧を開いたとき(まだ記録の無い助手)は、いまの数を控えるだけ(全員に NEW が付かないように)
  // 贈った記録が読み終わるまでは数を控えない・NEW も出さない(読む前の少ない数を控えると、あとで全員に NEW が付く・2026-11-11 最終確認の留意)
  const giftReady = typeof ASSISTANT_LIFE_GIFT_STORE === 'undefined' || ASSISTANT_LIFE_GIFT_STORE.loaded === true;
  React.useEffect(() => {
    if (!seen || !giftReady) return;
    const miss = metList.filter(w => !seen[w.id]);
    if (!miss.length) return;
    const next = { ...seen };
    for (const w of miss) next[w.id] = { n: counts[w.id] || 0 };
    save(next);
  }, [seen, giftReady, metList.map(w => w.id).join(',')]);
  const isNew = (id) => !!(giftReady && seen && seen[id] && (counts[id] || 0) > seen[id].n);
  const open = (id) => {
    if (!met.has(id)) return;
    if (seen && giftReady) save({ ...seen, [id]: { n: counts[id] || 0 } });
    setOpenId(id);
  };
  const face = land ? 48 : 60;
  return (
    <div ref={boxRef} className="px-3 pb-3 pt-1" data-assistant-life-profile-list>
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black text-white">📖 助手紹介</p>
          <p className="text-[11px] font-bold text-indigo-200">選ぶと、その助手のことが分かります</p>
        </div>
        <span data-assistant-life-profile-count={`${metList.length}/${roster.length}`} className="shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-slate-950/80 px-2.5 py-1 text-[11px] font-black text-slate-100">会った助手 {metList.length}/{roster.length}</span>
      </div>
      <div className={`grid gap-2 ${land ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {roster.map(w => {
          if (!met.has(w.id)) return (
            <div key={w.id} data-assistant-life-profile-card="unmet" aria-label="まだ会っていない助手" className="rounded-2xl border-2 border-slate-600 bg-slate-950/70 p-2">
              <div className="flex items-center justify-center rounded-full border-2 border-dashed border-slate-500 font-black text-slate-500" style={{ width: face, height: face, fontSize: face / 2 }}>？</div>
              <p className="mt-1 text-[15px] font-black text-slate-400">？？？</p>
              <p className="text-[11px] font-bold text-slate-400">まだ会っていません</p>
            </div>);
          const b = assistantLifeProfileBond(w.id, bondLevelOf);
          return (
            <button key={w.id} type="button" data-assistant-life-profile-card={w.id} onClick={() => open(w.id)} aria-label={`${w.name}の紹介を見る`}
              className="relative overflow-hidden rounded-2xl border-2 bg-slate-900/85 p-2 text-left active:scale-[.98]" style={{ borderColor: w.accent, backgroundImage: `linear-gradient(160deg, ${w.accent}44, transparent 65%)` }}>
              {isNew(w.id) && <span data-assistant-life-profile-new className="absolute right-1.5 top-1.5 rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black text-slate-950">NEW</span>}
              {typeof AssistantFace === 'function' && <AssistantFace who={w} size={face} accent={w.accent} expression="happy"/>}
              <p className="mt-1 text-[15px] font-black text-white">{w.name}</p>
              <p className="text-[10.5px] font-bold leading-snug text-slate-200" style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{typeof jaWrap === 'function' ? jaWrap(w.tagline || '') : (w.tagline || '')}</p>
              <span className="mt-1 inline-block rounded-full bg-slate-950/80 px-2 py-0.5 text-[10.5px] font-black text-pink-100">💗 Lv{b.lv}</span>
            </button>);
        })}
      </div>
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-300">💗 好きなものは、贈ると分かって紹介に残ります。{metList.length < roster.length ? 'まだ会っていない助手は、お話で出会うと紹介が開きます。' : ''}</p>
      {/* 紹介は家の画面のいちばん外の枠(data-assistant-life-screen)へ描く。見出しやタブの下に潜らないように(🔄横でも同じ枠の中) */}
      {openId && (() => {
        const sheet = <AssistantLifeProfileSheet id={openId} bondLevelOf={bondLevelOf} land={land} giftSt={giftSt} onMasmon={onMasmon} onClose={() => setOpenId(null)}/>;
        const host = boxRef.current && boxRef.current.closest ? boxRef.current.closest('[data-assistant-life-screen]') : null;
        return host && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal ? ReactDOM.createPortal(sheet, host) : sheet;
      })()}
    </div>);
}

// 1人ずつの紹介(一覧の上にかぶせる)
function AssistantLifeProfileSheet({ id, bondLevelOf = null, land = false, giftSt = null, onMasmon = null, onClose }) {
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  const [vKey, setVKey] = React.useState('home');
  const [vIdx, setVIdx] = React.useState(0);
  const scrollRef = React.useRef(null);
  const refs = { who: React.useRef(null), likes: React.useRef(null), bond: React.useRef(null), voice: React.useRef(null) };
  if (!who) return null;
  const b = assistantLifeProfileBond(id, bondLevelOf);
  const likes = assistantLifeProfileLikes(id, giftSt);
  const voices = assistantLifeProfileVoices(id, b.lv, giftSt);
  const vg = voices.find(g => g.key === vKey) || voices[0] || null;
  const vLine = vg && vg.open.length ? vg.open[vIdx % vg.open.length] : null;
  const team = typeof assistantLifeMasmonTeamOf === 'function' ? assistantLifeMasmonTeamOf(id) : [];
  const teamShow = [...team.filter(t => t.lead), ...team.filter(t => !t.lead)].slice(0, 3);
  const mat = typeof assistantLifeCardMaterial === 'function' ? assistantLifeCardMaterial(id) : null;
  const oshi = mat && mat.core && typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[mat.core] ? MONSTER_LINEAGES[mat.core] : null;
  const oshiMon = oshi && typeof assistantMasmonMon === 'function' ? assistantMasmonMon(oshi.monId) : null;
  const call = assistantLifeProfileCall(id);
  const greeting = String(who.greeting || '').replace(/\{name\}/g, call);
  const jump = (k) => { try { const box = scrollRef.current, el = refs[k].current; if (box && el) box.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' }); } catch (_) {} };
  const card = 'rounded-2xl border border-white/10 bg-slate-800/90 px-3 py-2.5';
  const h3 = 'mb-1.5 flex items-center justify-between gap-2 text-[13.5px] font-black text-white';
  const jw = (t) => (typeof t === 'string' && typeof jaWrap === 'function' ? jaWrap(t) : t); // 言葉の途中で折れないように
  const kv = (k, v) => (<div className="grid gap-x-3 py-0.5 text-[12px] leading-relaxed" style={{ gridTemplateColumns: 'max-content 1fr' }}><span className="whitespace-nowrap font-bold text-slate-400">{k}</span><span className="font-bold text-slate-100" style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{jw(v)}</span></div>);
  const chip = (c, i) => (
    <span key={i} data-assistant-life-profile-like={c.shown ? (c.like ? 'like' : 'bad') : 'unknown'}
      className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11.5px] font-black ${!c.shown ? 'border-dashed border-slate-600 text-slate-500' : c.like ? 'border-pink-400 text-pink-100' : 'border-sky-400 text-sky-100'}`}>
      {c.like ? '💗' : '💧'} {c.shown ? `${c.it.emoji} ${c.it.name}` : '？'}</span>);
  const monChip = (m, like) => (
    <span key={`${like}-${m.id}`} className={`inline-flex items-center gap-1 rounded-xl border px-1.5 py-1 text-[11.5px] font-black ${like ? 'border-pink-400 text-pink-100' : 'border-sky-400 text-sky-100'}`}>
      {like ? '💗' : '💧'}{m.icon ? <img src={m.icon} alt="" className="h-5 w-5 rounded-md object-contain"/> : m.emoji} {m.name}</span>);
  const hero = (
    <div className="relative overflow-hidden" data-assistant-life-profile-hero style={{ height: land ? '100%' : 300, backgroundImage: `linear-gradient(160deg, ${who.accent}55, #0f172a 72%)` }}>
      {/* 立ち絵は右側の枠の中で、顔の大きさと頭の高さをそろえる(縦は右6割・横は名前の下から) */}
      <div className="absolute bottom-0 right-0" style={land ? { left: '40%', top: 0 } : { top: 0, width: '62%' }}><AssistantLifeProfileStand who={who} head={land ? 0.22 : 0.34} top={land ? 0.3 : 0.12}/></div>
      <div className="absolute left-3.5 z-[2]" style={{ top: land ? 56 : 14, width: land ? 150 : 210 }}>
        <p className="text-[28px] font-black leading-tight text-white" style={{ textShadow: '0 2px 6px #000' }}>{who.name}</p>
        <p className="text-[12.5px] font-black leading-snug" style={{ color: who.accent, textShadow: '0 1px 3px #000', ...(typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : {}) }}>{typeof jaWrap === 'function' ? jaWrap(who.tagline || '') : who.tagline}</p>
        <span className="mt-1.5 inline-block rounded-full border border-white/15 bg-slate-950/80 px-2 py-0.5 text-[11px] font-black text-white">💗 Lv{b.lv} {b.title}</span>
      </div>
      {greeting && <div data-assistant-life-profile-greeting className="absolute bottom-3 left-3 z-[2] rounded-2xl border-2 bg-white px-3 py-2 text-[12px] font-bold leading-relaxed text-slate-800 shadow-lg" style={{ borderColor: who.accent, width: land ? 170 : 205 }}>
        <span className="block text-[10px] font-black" style={{ color: who.accent }}>ひとこと</span><span style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{jw(greeting)}</span></div>}
    </div>);
  const jumps = (
    <div className="flex gap-1.5 border-b border-white/10 bg-slate-950/90 px-2.5 py-2" data-assistant-life-profile-jump>
      {[['who', '人となり'], ['likes', '好き・苦手'], ['bond', 'きずな'], ['voice', '台詞']].map(([k, l]) => (
        <button key={k} type="button" onClick={() => jump(k)} className="min-h-[36px] flex-1 rounded-xl border border-white/10 bg-slate-800 text-[11.5px] font-black text-slate-100 active:scale-95">{l}</button>))}
    </div>);
  const secWho = (
    <div ref={refs.who} className={card} data-assistant-life-profile-sec="who">
      <p className={h3}>{who.emoji || '🌟'} 人となり</p>
      {who.intro && kv('性格', who.intro)}
      {assistantLifeProfileRhythm(id) && kv('生活', assistantLifeProfileRhythm(id))}
      {b.tone && kv('話し方(いま)', b.tone)}
    </div>);
  const secLikes = (
    <div ref={refs.likes} className={card} data-assistant-life-profile-sec="likes">
      <p className={h3}><span className="whitespace-nowrap">{land ? '💗 好き・💧 苦手' : '💗 好きなもの・💧 苦手なもの'}</span>{likes.total > 0 && <em className="whitespace-nowrap text-[10.5px] font-bold not-italic text-slate-400">分かったもの {likes.known}/{likes.total}</em>}</p>
      {likes.rows.map(r => (
        <div key={r.label} className="my-1 flex flex-wrap items-center gap-1"><span className="w-[4.6em] shrink-0 whitespace-nowrap text-[11px] font-bold text-slate-400">{r.label}</span>{r.cells.map(chip)}</div>))}
      {(likes.monLike.length > 0 || likes.monBad.length > 0) && (
        <div className="my-1 flex flex-wrap items-center gap-1"><span className="w-[4.6em] shrink-0 whitespace-nowrap text-[11px] font-bold text-slate-400">モンスター</span>{likes.monLike.map(m => monChip(m, true))}{likes.monBad.map(m => monChip(m, false))}</div>)}
      {likes.hint && <p data-assistant-life-profile-hint className="mt-1.5 rounded-xl bg-slate-950/80 px-2 py-1.5 text-[11px] font-bold leading-snug text-slate-200">💭 {who.name}の話から:「{String(likes.hint.t).replace(/\{name\}/g, call)}」</p>}
      {likes.total > 0 && <p className="mt-1 text-[10.5px] font-bold text-slate-400">？は贈ると分かります。分かった好みはここに残ります。</p>}
    </div>);
  const secBond = (
    <div ref={refs.bond} className={card} data-assistant-life-profile-sec="bond">
      <p className={h3}>🤝 いまのきずな</p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2"><span className="whitespace-nowrap text-[14px] font-black text-white">💗 仲良し度 Lv{b.lv} <span className="text-[11px] text-pink-200">{b.title}</span></span>{b.next && <span className="whitespace-nowrap text-[11px] font-bold text-slate-400">あと {b.next.remain} で Lv{b.next.level}</span>}</div>
      <div className="my-1.5 h-2 overflow-hidden rounded-full bg-slate-700"><i className="block h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500" style={{ width: `${Math.round(b.rate * 100)}%` }}/></div>
      {kv('呼び方', call)}
      {oshi && kv('推し', <span className="inline-flex items-center gap-1">{oshiMon && (oshiMon.faceIconUrl || oshiMon.iconUrl) ? <img src={oshiMon.faceIconUrl || oshiMon.iconUrl} alt="" className="h-5 w-5 rounded-md object-contain"/> : null}{oshi.name}種</span>)}
      {teamShow.length > 0 && <>
        <p className="mb-1 mt-2 text-[11px] font-bold text-slate-400">マスモン{team.length > teamShow.length ? `(${team.length}体のうち${teamShow.length}体)` : ''}</p>
        <div className="flex gap-1.5">{teamShow.map((t, i) => { const m = typeof assistantMasmonMon === 'function' ? assistantMasmonMon(t.monster) : null; return (
          <div key={i} className={`flex-1 rounded-xl border bg-slate-950/80 px-1 py-1.5 text-center ${t.lead ? 'border-amber-300' : 'border-white/10'}`}>
            {m && (m.faceIconUrl || m.iconUrl) ? <img src={m.faceIconUrl || m.iconUrl} alt="" className="mx-auto h-10 w-10 rounded-lg object-contain"/> : <span className="block text-[24px]">{(m && m.emoji) || '🐾'}</span>}
            <b className="block truncate text-[11px] text-white">{t.nick || (m && m.name) || ''}</b><span className="text-[10px] font-bold text-slate-300">{t.lead ? '👑 勇者モン' : (m && m.name) || ''}</span>
          </div>); })}</div>
        {onMasmon && <button type="button" data-assistant-life-profile-masmon onClick={() => { onClose(); onMasmon(id); }} className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[12.5px] font-black text-white active:scale-[.98]">🐾 マスモンをくわしく見る ›</button>}
      </>}
    </div>);
  const secVoice = (
    <div ref={refs.voice} className={card} data-assistant-life-profile-sec="voice">
      <p className={h3}><span>🔊 台詞を聞く</span>{vg && <em className="whitespace-nowrap text-[10.5px] font-bold not-italic text-slate-400">聞ける台詞 {voices.reduce((a, g) => a + g.open.length, 0)}</em>}</p>
      <div className="flex items-start gap-2">
        {typeof AssistantFace === 'function' && <span className="shrink-0"><AssistantFace who={who} size={52} accent={who.accent} expression={(vLine && vLine.e) || 'happy'}/></span>}
        <p data-assistant-life-profile-voice-line className="min-h-[52px] flex-1 rounded-2xl bg-white px-3 py-2 text-[12px] font-bold leading-relaxed text-slate-800"><span style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{jw(vLine ? vLine.t : (vg && vg.emptyNote) || 'まだ聞ける台詞がありません')}</span></p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {voices.map(g => (
          <button key={g.key} type="button" data-assistant-life-profile-voice-tab={g.key} aria-pressed={vg && vg.key === g.key} onClick={() => { setVKey(g.key); setVIdx(0); }}
            className={`min-h-[34px] rounded-full border px-2.5 text-[11px] font-black ${vg && vg.key === g.key ? 'text-white' : 'border-white/10 bg-slate-950/80 text-slate-200'}`} style={vg && vg.key === g.key ? { borderColor: who.accent, backgroundColor: `${who.accent}33` } : undefined}>{g.label} {g.open.length}</button>))}
        {vg && vg.lockedAt && <span data-assistant-life-profile-voice-lock className="inline-flex min-h-[34px] items-center rounded-full border border-white/10 bg-slate-950/80 px-2.5 text-[11px] font-black text-slate-500">🔒 Lv{vg.lockedAt} から あと{vg.lockedN}</span>}
      </div>
      <button type="button" data-assistant-life-profile-voice-next disabled={!vg || vg.open.length < 2} onClick={() => setVIdx(i => i + 1)} className="mt-2 min-h-[44px] w-full rounded-xl text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40" style={{ backgroundColor: who.accent }}>▶ もう1つ聞く</button>
      <p className="mt-1.5 text-[10.5px] font-bold leading-snug text-slate-400">表情つきで台詞が出ます(ボイスはまだありません)。仲良し度が上がると、聞ける台詞が増えます。</p>
    </div>);
  const top = (
    <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950 px-3 py-2" style={{ paddingTop: land ? 8 : 'calc(8px + env(safe-area-inset-top))' }}>
      <button type="button" data-assistant-life-profile-close onClick={onClose} className="min-h-[44px] shrink-0 rounded-xl border border-white/15 bg-slate-800 px-3 text-[13px] font-black text-white active:scale-95">← 一覧へ</button>
      <p className="min-w-0 truncate text-[17px] font-black text-white">{who.name}のこと</p>
    </div>);
  return (
    <div className="absolute inset-0 z-[60] flex bg-slate-950" data-assistant-life-profile={id} role="dialog" aria-label={`${who.name}の紹介`} style={land ? { flexDirection: 'row' } : { flexDirection: 'column' }}>
      {land ? <>
        <div className="relative h-full w-[34%] max-w-[320px] shrink-0">{hero}
          <button type="button" data-assistant-life-profile-close onClick={onClose} className="absolute left-2 top-2 z-[3] min-h-[44px] rounded-xl border border-white/15 bg-slate-800/90 px-3 text-[13px] font-black text-white active:scale-95">← 一覧へ</button></div>
        <div className="flex min-w-0 flex-1 flex-col">{jumps}
          <div ref={scrollRef} className="mh-scroll relative min-h-0 flex-1 overflow-y-auto p-2.5"><div className="grid grid-cols-2 items-start gap-2.5"><div className="flex flex-col gap-2.5">{secWho}{secLikes}</div><div className="flex flex-col gap-2.5">{secBond}{secVoice}</div></div></div>
        </div>
      </> : <>
        {top}
        <div ref={scrollRef} className="mh-scroll relative min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {hero}
          <div className="sticky top-0 z-[3]">{jumps}</div>
          <div className="flex flex-col gap-2.5 p-3">{secWho}{secLikes}{secBond}{secVoice}</div>
        </div>
      </>}
    </div>);
}
