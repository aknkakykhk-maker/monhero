// ==================== 上がる値の演出(2026-11-07 社長「色んな親密度があるけど、アイテムであがるものなど、もっと変動の演出をつけたい」) ====================
// 演出担当ハナビ。案と止め絵: docs/progress/growth-fx/PLAN.md(社長が3段・色・「小は全部の行動で出す」を選んだ)
// ★見た目だけ。保存のキー・値の計算・1日の上限には一切触らない。演出を見たかどうかも保存しない(取りこぼしても値は正しい)。
// ★画面を切り替えない・ゲームの状態を書き換えない。出してよい画面(GROWTH_FX_CALM_SCREENS)にいるときだけ出し、
//   演奏中・マルチ中・バトル中・お話の最中は出さずに貯めておき、出してよい画面へ来たときに出す。
// 強さの段:
//   small … 行動でちょっと上がった。右上の札(1.9秒)。同じ値・同じ相手が続いたら1枚にまとめて数字を足す。押せない(下の画面の操作を邪魔しない)
//   item  … アイテムを使った。真ん中のカード(約3.4秒・押せばすぐ閉じる)
//   level … Lvが上がった。画面いっぱい(押すと最後の形へ → もう1回で閉じる)
// 軽さ: バトル設定「画面の軽さ」と端末の「動きを減らす」に合わせる(full / reduced / minimal)。
// 呼び方: growthFxPush({ tier, kind, ... })。値ごとの便利な呼び方は下の growthFxAssistantBond など。

const GROWTH_FX_KINDS = Object.freeze({
  bond:    { color: '#f472b6', deep: '#9d174d', icon: '💗', particle: '♥', label: '仲良し度' },
  friend:  { color: '#fb923c', deep: '#9a3412', icon: '🤝', particle: '✦', label: '友情Lv' },
  star:    { color: '#facc15', deep: '#a16207', icon: '★', particle: '★', label: '絆Lv' },
  session: { color: '#c084fc', deep: '#6b21a8', icon: '🎤', particle: '♪', label: 'セッションLv' },
  beat:    { color: '#a3e635', deep: '#3f6212', icon: '🎵', particle: '♪', label: 'ビートLv' },
  breeder: { color: '#60a5fa', deep: '#1e40af', icon: '🛡️', particle: '◆', label: 'ブリーダーLv' },
});
const growthFxKind = (kind) => GROWTH_FX_KINDS[kind] || GROWTH_FX_KINDS.bond;

// 出してよい画面。ここに無い画面(バトル・モンヒロビート・マルチ・カード対戦・お話・結果画面など)では出さずに貯める
const GROWTH_FX_CALM_SCREENS = Object.freeze(new Set([
  'HOME', 'PROFILE', 'ITEM_INVENTORY', 'GIFT_BOX', 'MISSIONS', 'BREEDER_MARKET', 'MB_MANAGEMENT', 'MASU_MONS',
  'OWNED_MONSTERS', 'MONSTER_DEX', 'MONSTER_DEX_DETAIL', 'MONSTER_LIST_MENU', 'FRIENDS', 'ASSISTANT_SELECT',
  'MASU_ENHANCE', 'MASU_AUTO_ENHANCE', 'MASU_FUSION', 'MASU_DONATION', 'MASU_OFFERING', 'MASU_REBIRTH', 'MASU_REGENERATION',
  'MASU_REGENERATION_DETAIL', 'MASU_REINCARNATE', 'MASU_SOUL_RANK', 'MASU_SOUL_TRAITS', 'MASU_TRANSCENDENCE', 'MASU_TRANSCEND_ENHANCE',
]));
// 画面の上にこれが出ているあいだは出さない(お話・ほかの大きな演出・案内)。中・大の段だけ止める目印もある(おしゃべりの画面)
const GROWTH_FX_HOLD_ALL_SELECTOR = '[data-event-story],[data-story-stage],[data-story-sheet],[data-player-rank-up-fx]';
const GROWTH_FX_HOLD_SHEET_SELECTOR = '[data-assistant-chat]';
const GROWTH_FX_SMALL_MS = 1900;
const GROWTH_FX_ITEM_MS = 3400;
const GROWTH_FX_SMALL_MAX = 3;       // 一度に並べる札の数
const GROWTH_FX_QUEUE_MAX = 24;      // 貯めておく数の上限(古いものから捨てる。値は保存済みなので見えなくなるだけ)

// ---------- 貯めておく場所(画面の外に置く。React の状態ではないので、どこから呼んでも描画を起こさない) ----------
const GROWTH_FX_STORE = { small: [], sheets: [], seq: 0, listeners: new Set() };
const growthFxEmit = () => { GROWTH_FX_STORE.listeners.forEach(fn => { try { fn(); } catch {} }); };
const growthFxSubscribe = (fn) => { GROWTH_FX_STORE.listeners.add(fn); return () => GROWTH_FX_STORE.listeners.delete(fn); };
const growthFxPct = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; };
const growthFxNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ev: { tier:'small'|'item'|'level', kind, key?, who?, name?, gain?, pctFrom?, pctTo?, ... }
const growthFxPush = (ev) => {
  if (!ev || typeof ev !== 'object') return;
  const tier = ev.tier === 'item' || ev.tier === 'level' ? ev.tier : 'small';
  if (tier === 'small') {
    const gain = growthFxNum(ev.gain);
    if (gain <= 0) return;
    const key = String(ev.key || `${ev.kind}:${ev.who || ''}`);
    const list = GROWTH_FX_STORE.small;
    const same = list.find(c => c.key === key);
    // 続けて上がったら1枚にまとめる(数字を足し上げ、ゲージは今の位置へ)。出し直しの合図(rev)を進めて、消える時間を延ばす
    if (same) { same.gain += gain; same.pctTo = growthFxPct(ev.pctTo); same.rev += 1; }
    else {
      list.push({ id: ++GROWTH_FX_STORE.seq, rev: 0, key, kind: ev.kind, name: String(ev.name || ''), gain,
        pctFrom: growthFxPct(ev.pctFrom), pctTo: growthFxPct(ev.pctTo) });
      if (list.length > GROWTH_FX_QUEUE_MAX) list.splice(0, list.length - GROWTH_FX_QUEUE_MAX);
    }
  } else {
    // 同じ値の Lvアップが続いたら(貯めているあいだに2つ上がったなど)、新しいほうへまとめる(from は古いほうのまま)
    const sheets = GROWTH_FX_STORE.sheets;
    const mergeKey = tier === 'level' ? String(ev.key || `${ev.kind}:${ev.who || ''}`) : null;
    const prev = mergeKey ? sheets.find((s, i) => i > 0 && s.tier === 'level' && s.key === mergeKey) : null;
    if (prev) Object.assign(prev, { ...ev, tier, key: mergeKey, levelFrom: prev.levelFrom, gains: [...(prev.gains || []), ...(ev.gains || [])] });
    else {
      sheets.push({ ...ev, tier, key: mergeKey, id: ++GROWTH_FX_STORE.seq });
      if (sheets.length > GROWTH_FX_QUEUE_MAX) sheets.splice(0, sheets.length - GROWTH_FX_QUEUE_MAX);
    }
  }
  growthFxEmit();
};
const growthFxDropSmall = (id) => { GROWTH_FX_STORE.small = GROWTH_FX_STORE.small.filter(c => c.id !== id); growthFxEmit(); };
const growthFxDropSheet = (id) => { GROWTH_FX_STORE.sheets = GROWTH_FX_STORE.sheets.filter(s => s.id !== id); growthFxEmit(); };

// ---------- 値ごとの呼び方 ----------
// 助手の顔の絵(表情つき)。登録が無ければ null
// 公開済みの助手だけを引く(まだ公開していない助手は、名前も顔も演出に出さない。unreleased-assistant-hidden-check.js)
const growthFxAssistantOf = (assistantId) => {
  if (typeof assistantReleased === 'function' && !assistantReleased(assistantId)) return null;
  return ((typeof ASSISTANT_LIST !== 'undefined' && Array.isArray(ASSISTANT_LIST)) ? ASSISTANT_LIST : [])
    .filter(a => a && (typeof assistantReleased !== 'function' || assistantReleased(a.id))).find(a => a.id === assistantId) || null;
};
const growthFxAssistantFace = (assistantId, expression = 'happy') => {
  const who = growthFxAssistantOf(assistantId);
  if (!who || !who.imageDir || !who.imagePrefix) return null;
  return `${who.imageDir}/${who.imagePrefix}_${expression}.PNG`;
};
const growthFxAssistantName = (assistantId) => {
  const who = growthFxAssistantOf(assistantId);
  return (who && who.name) || '';
};
// 仲良し度の、いまの段の中での位置(0〜100)。段の表は助手ごとに同じ点数(ASSISTANT_BOND_LEVELS)
const growthFxAssistantBondPct = (points) => {
  const p = growthFxNum(points);
  const stage = typeof assistantBondStage === 'function' ? assistantBondStage(p) : null;
  const next = typeof assistantBondNext === 'function' ? assistantBondNext(p) : null;
  if (!stage) return 0;
  if (!next) return 100;
  const span = Math.max(1, next.need - growthFxNum(stage.need));
  return growthFxPct(((p - growthFxNum(stage.need)) / span) * 100);
};
// 助手の仲良し度が上がった(60-app.jsx の addAssistantBondFor から。値と保存はそちらで済んでいる)
const growthFxAssistantBond = (assistantId, beforePoints, afterPoints) => {
  const before = growthFxNum(beforePoints), after = growthFxNum(afterPoints);
  if (!(after > before) || !growthFxAssistantOf(assistantId)) return;
  const name = growthFxAssistantName(assistantId);
  const lvOf = (p) => (typeof assistantBondLevel === 'function' ? assistantBondLevel(p) : 1);
  const levelFrom = lvOf(before), levelTo = lvOf(after);
  growthFxPush({ tier: 'small', kind: 'bond', who: assistantId, name, gain: after - before,
    pctFrom: levelTo > levelFrom ? 0 : growthFxAssistantBondPct(before), pctTo: growthFxAssistantBondPct(after) });
  if (levelTo <= levelFrom) return;
  // 新しく開いたもの(プロフィールの「ごほうび一覧」と同じ表から。56-screen-profile.jsx の assistantBondRewardRows)
  const gains = [];
  const rows = typeof assistantBondRewardRows === 'function' ? assistantBondRewardRows(assistantId) : [];
  for (let lv = levelFrom + 1; lv <= levelTo; lv++) {
    const row = rows.find(r => r && r.level === lv);
    if (!row) continue;
    if (row.rewards && row.rewards.length) gains.push({ icon: '🎁', text: 'ごほうび', note: `${row.rewards.join('・')}(ギフトボックスへ)` });
    (row.frames || []).forEach(frame => gains.push({ icon: '🖼️', text: (frame && frame.name) || `${name}の飾り枠`, note: 'プロフィールで使える', isNew: true }));
    if (row.callStyle) gains.push({ icon: '💬', text: '呼ばれ方を自由に決められる', note: 'プロフィールの助手の欄から', isNew: true });
  }
  const stage = typeof assistantBondStageByLevel === 'function' ? assistantBondStageByLevel(levelTo, assistantId) : null;
  growthFxPush({ tier: 'level', kind: 'bond', who: assistantId, levelFrom, levelTo,
    title: '仲良し度 UP!', sub: `${name} との仲良し度が Lv.${levelTo} になった${stage && stage.title ? `(${stage.title})` : ''}`,
    face: growthFxAssistantFace(assistantId, 'excited'), gains });
};
// マスモンに絆経験値のアイテムを使った(60-app.jsx の useBondXpTickets から)
const growthFxMasuBondItem = ({ masuName, image, itemName, itemEmoji, count, gain, before, after }) => {
  if (!before || !after || !(growthFxNum(gain) > 0)) return;
  const pct = (info) => growthFxPct((growthFxNum(info.xpIntoLevel) / Math.max(1, growthFxNum(info.xpForNext))) * 100);
  growthFxPush({ tier: 'item', kind: 'star', title: `${masuName} に ${itemName}！`, item: `${itemEmoji || ''} ${itemName} ×${count}`,
    faces: image ? [image] : [], faceRound: true,
    rows: [{ kind: 'star', label: '絆Lv', levelFrom: before.level, levelTo: after.level, pctFrom: pct(before), pctTo: pct(after), gain, unit: '絆経験値' }] });
};
// ブリーダーLvが上がった(60-app.jsx でブリーダー経験値を足した所から)。経験値の伸びは結果画面のバーで見せているので、ここは Lvアップだけ
const growthFxBreederLevel = (levelFrom, levelTo, breederName = '') => {
  const a = growthFxNum(levelFrom), b = growthFxNum(levelTo);
  if (!(b > a)) return;
  growthFxPush({ tier: 'level', kind: 'breeder', who: 'self', levelFrom: a, levelTo: b,
    title: 'ブリーダーLv UP!', sub: `${breederName ? `${breederName} の` : ''}ブリーダーLvが Lv.${b} になった`, gains: [] });
};

// ---------- 公開前の値の呼び出し口(呼ぶのはそれぞれの担当。公開の印が真になるまで呼ばれない) ----------
// 友情Lv(助手どうし・ナカヨシ)。points は2人の友情の点数。段の表は ASSISTANT_PEER_BOND_LEVELS
const growthFxPeerPct = (points) => {
  const list = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' && Array.isArray(ASSISTANT_PEER_BOND_LEVELS) ? ASSISTANT_PEER_BOND_LEVELS : [];
  const p = growthFxNum(points);
  let cur = list[0], next = null;
  for (let i = 0; i < list.length; i++) { if (p >= growthFxNum(list[i].min)) { cur = list[i]; next = list[i + 1] || null; } }
  if (!cur) return 0;
  if (!next) return 100;
  return growthFxPct(((p - growthFxNum(cur.min)) / Math.max(1, growthFxNum(next.min) - growthFxNum(cur.min))) * 100);
};
const growthFxPeerLevelName = (level, lifeName = true) => {
  const list = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' && Array.isArray(ASSISTANT_PEER_BOND_LEVELS) ? ASSISTANT_PEER_BOND_LEVELS : [];
  const row = list.find(r => r && r.level === level);
  return row ? ((lifeName && row.lifeName) || row.name || '') : '';
};
// 2人の友情Lvが上がった(どの道で上がっても、assistantPeerGain の結果 { pair, levelBefore, levelAfter } を渡せばよい)
const growthFxPeerLevel = ({ pair, levelBefore, levelAfter } = {}) => {
  if (!Array.isArray(pair) || pair.length !== 2 || !(growthFxNum(levelAfter) > growthFxNum(levelBefore))) return;
  if (!growthFxAssistantOf(pair[0]) || !growthFxAssistantOf(pair[1])) return;
  const [a, b] = pair;
  const stage = growthFxPeerLevelName(levelAfter);
  growthFxPush({ tier: 'level', kind: 'friend', who: [a, b].sort().join('-'), levelFrom: levelBefore, levelTo: levelAfter,
    title: '友情Lv UP!', sub: `${growthFxAssistantName(a)} と ${growthFxAssistantName(b)} の友情Lvが Lv.${levelAfter} になった${stage ? `(${stage})` : ''}`,
    face: growthFxAssistantFace(a, 'excited'), gains: [] });
};
// 2人に品物を渡した。名前と絵は持ち物のデータ(BREEDER_MARKET_ITEMS の name・emoji)から取る(種類・名前はあとで変わるため書き込まない)
//   reaction … 'like' | 'dislike' | null(好き嫌いが入ったら渡す) / playerGain … あなたとの仲良し度の増えた量(2人それぞれ)
//   playerGains … 1人ずつの仲良し度の量 [a, b](助手ライフの道具は好みで変わる・2026-11-08)/ likes … 1人ずつの好み ['like'|'mid'|'bad', …](顔の表情)
const growthFxPeerItem = ({ pair, itemId, pointsBefore, pointsAfter, levelBefore, levelAfter, reaction = null, playerGain = 0, playerGains = null, likes = null } = {}) => {
  if (!Array.isArray(pair) || pair.length !== 2 || !growthFxAssistantOf(pair[0]) || !growthFxAssistantOf(pair[1])) return;
  const gain = growthFxNum(pointsAfter) - growthFxNum(pointsBefore);
  if (!(gain > 0) && !(growthFxNum(playerGain) > 0)) return;
  const items = typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : [];
  const item = items.find(i => i && i.id === itemId) || {};
  const [a, b] = pair;
  const rows = [];
  if (gain > 0) rows.push({ kind: 'friend', label: '2人の友情Lv', levelFrom: levelBefore, levelTo: levelAfter,
    pctFrom: growthFxPeerPct(pointsBefore), pctTo: growthFxPeerPct(pointsAfter), gain });
  const each = Array.isArray(playerGains) && playerGains.length === 2 && playerGains[0] !== playerGains[1];
  if (each) pair.forEach((id, i) => { if (growthFxNum(playerGains[i]) > 0) rows.push({ kind: 'bond', label: `あなたとの仲良し度(${growthFxAssistantName(id)})`, pctFrom: 0, pctTo: 100, gain: growthFxNum(playerGains[i]) }); });
  else if (growthFxNum(playerGain) > 0) rows.push({ kind: 'bond', label: 'あなたとの仲良し度(2人とも)', pctFrom: 0, pctTo: 100, gain: growthFxNum(playerGain) });
  const faceOf = (i) => { const l = Array.isArray(likes) ? likes[i] : null; return l === 'bad' ? 'troubled' : l === 'like' ? 'excited' : l === 'mid' ? 'happy' : (reaction === 'dislike' ? 'troubled' : reaction === 'like' ? 'excited' : 'happy'); };
  const face = (id) => growthFxAssistantFace(id, faceOf(pair.indexOf(id)));
  growthFxPush({ tier: 'item', kind: 'friend', title: `${growthFxAssistantName(a)} と ${growthFxAssistantName(b)} に ${item.name || ''}！`,
    item: `${item.emoji || ''} ${item.name || ''} ×1`, faces: [face(a), face(b)].filter(Boolean), reaction, rows });
};
// セッションLv(モンヒロビートの助手・マモリ)。マルチの結果で決まるが、マルチの最中は出さず、出してよい画面へ戻ってから出す。
//   何人も一度に上がったら1回にまとめる(list に [{ assistantId, levelBefore, levelAfter, tickets }] を全部入れて呼ぶ)
const growthFxSessionLevel = (list = []) => {
  const ups = (Array.isArray(list) ? list : []).filter(u => u && growthFxNum(u.levelAfter) > growthFxNum(u.levelBefore) && growthFxAssistantOf(u.assistantId));
  if (!ups.length) return;
  const top = ups[0];
  const gains = ups.map(u => ({ icon: '🎤', text: `${growthFxAssistantName(u.assistantId)} セッションLv.${u.levelAfter}`,
    note: growthFxNum(u.tickets) > 0 ? `セッション券 ×${growthFxNum(u.tickets)}` : '' }));
  growthFxPush({ tier: 'level', kind: 'session', who: ups.map(u => u.assistantId).join('+'), levelFrom: top.levelBefore, levelTo: top.levelAfter,
    title: 'セッションLv UP!', sub: ups.length > 1 ? 'いっしょに演奏した助手のセッションLvが上がった' : `${growthFxAssistantName(top.assistantId)} とのセッションLvが Lv.${top.levelAfter} になった`,
    face: growthFxAssistantFace(top.assistantId, 'excited'), gains: ups.length > 1 || gains[0].note ? gains : [] });
};

// ---------- 見た目 ----------
const GROWTH_FX_CSS = `
.mh-gfx-chips{position:fixed;top:calc(env(safe-area-inset-top,0px) + 52px);right:10px;z-index:44000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}
.mh-gfx-chip{position:relative;display:flex;align-items:center;gap:7px;padding:5px 11px 5px 6px;border-radius:999px;background:linear-gradient(90deg,#1e1b2ef0,#0f172af0);
  border:1.5px solid var(--gc);box-shadow:0 0 14px color-mix(in srgb,var(--gc) 40%,transparent);font-weight:900;font-size:11px;color:#fff;
  animation:mhGfxChipIn .35s cubic-bezier(.2,1.6,.4,1) both}
.mh-gfx-chip.out{animation:mhGfxChipOut .3s ease-in forwards}
.mh-gfx-chip .ico{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--gc) 30%,transparent);font-size:13px;color:var(--gc)}
.mh-gfx-chip .ico.beat{animation:mhGfxBeat .5s ease-out}
.mh-gfx-chip .who{font-size:9px;color:#cbd5e1;line-height:1.1;max-width:9.5em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mh-gfx-chip .bar{width:56px;height:5px;border-radius:9px;background:#334155;overflow:hidden;margin-top:2px}
.mh-gfx-chip .bar i{display:block;height:100%;background:var(--gc);transition:width .7s ease-out}
.mh-gfx-chip .num{color:var(--gc);font-size:14px;font-variant-numeric:tabular-nums}
.mh-gfx-chip .num.pop{animation:mhGfxPop .4s cubic-bezier(.2,1.8,.4,1)}
.mh-gfx-chip .pt{position:absolute;left:12px;top:4px;font-size:12px;color:var(--gc);text-shadow:0 0 6px var(--gc);animation:mhGfxFloat 1.1s ease-out both}
@keyframes mhGfxChipIn{from{transform:translateX(26px) scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes mhGfxChipOut{to{transform:translateY(-12px);opacity:0}}
@keyframes mhGfxBeat{40%{transform:scale(1.45)}}
@keyframes mhGfxPop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes mhGfxFloat{0%{transform:translate(0,0) scale(.4);opacity:0}20%{opacity:1}100%{transform:translate(var(--dx),-46px) scale(.7);opacity:0}}
.mh-gfx-sheet{position:fixed;inset:0;z-index:44500;display:flex;align-items:center;justify-content:center;padding:16px;cursor:pointer}
.mh-gfx-sheet.item{background:#0b102666}
.mh-gfx-card{position:relative;width:min(340px,100%);border-radius:22px;padding:14px 16px 14px;text-align:center;color:#fff;
  background:linear-gradient(180deg,#1f1633f5,#0f172af5);border:2px solid var(--gc);box-shadow:0 0 36px color-mix(in srgb,var(--gc) 40%,transparent),0 12px 40px #0009;
  animation:mhGfxCardIn .45s cubic-bezier(.2,1.5,.4,1) both}
.mh-gfx-card .faces{display:flex;justify-content:center;gap:4px;height:64px}
.mh-gfx-card .faces img{height:116px;margin-top:-60px;object-fit:contain;filter:drop-shadow(0 6px 10px #0008);animation:mhGfxHop .5s .4s ease-out both}
.mh-gfx-card .faces img.round{height:92px;width:92px;margin-top:-46px;border-radius:20px;border:2px solid var(--gc);background:#0f172a;object-fit:cover}
.mh-gfx-card .ttl{font-weight:900;font-size:14px;margin-top:4px;line-height:1.35}
.mh-gfx-card .itm{display:inline-flex;gap:6px;font-size:11px;font-weight:900;color:#e2e8f0;background:#ffffff14;border-radius:999px;padding:3px 10px;margin-top:6px;animation:mhGfxPop .45s .1s ease-out both}
.mh-gfx-card .tag{display:inline-block;font-size:10px;font-weight:900;padding:1px 8px;border-radius:999px;margin-left:4px;background:#ffffff22}
.mh-gfx-card .tag.like{background:#f472b6;color:#3b0a24}.mh-gfx-card .tag.dislike{background:#64748b}
.mh-gfx-row{display:flex;align-items:center;gap:8px;margin-top:10px;text-align:left}
.mh-gfx-row .ico{font-size:18px;width:26px;text-align:center;color:var(--rc)}
.mh-gfx-row .lab{font-size:11px;font-weight:900;color:#cbd5e1}
.mh-gfx-row .lab em{font-style:normal;color:var(--rc)}
.mh-gfx-row .lab .up{margin-left:4px;font-size:10px;background:var(--rc);color:#111;border-radius:6px;padding:0 5px;animation:mhGfxPop .35s cubic-bezier(.2,1.8,.4,1) both}
.mh-gfx-gauge{height:10px;border-radius:9px;background:#334155;position:relative;overflow:hidden;border:1px solid #fff2;margin-top:3px}
.mh-gfx-gauge i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,color-mix(in srgb,var(--rc) 65%,#000),var(--rc))}
.mh-gfx-row .val{font-weight:900;font-size:18px;color:var(--rc);min-width:64px;text-align:right;font-variant-numeric:tabular-nums;line-height:1.1}
.mh-gfx-row .val small{display:block;font-size:9px;color:#94a3b8}
.mh-gfx-hint{font-size:10px;color:#94a3b8;margin-top:10px}
.mh-gfx-burst{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
.mh-gfx-burst span{position:absolute;color:var(--gc);text-shadow:0 0 10px var(--gc);animation:mhGfxBurst 1.2s var(--d) cubic-bezier(.1,.8,.3,1) both}
@keyframes mhGfxBurst{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}15%{opacity:1}100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r));opacity:0}}
@keyframes mhGfxCardIn{from{transform:translateY(30px) scale(.7);opacity:0}to{transform:none;opacity:1}}
@keyframes mhGfxHop{0%{transform:translateY(14px);opacity:0}60%{transform:translateY(-8px);opacity:1}100%{transform:none}}
.mh-gfx-sheet.level{background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--gc) 36%,transparent) 0%,#0b1026f0 62%);animation:mhGfxFade .3s both;overflow:hidden}
.mh-gfx-rays{position:absolute;left:50%;top:38%;width:170vmax;height:170vmax;transform:translate(-50%,-50%);pointer-events:none;
  background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--gc) 14%,transparent) 0 8deg,transparent 8deg 22deg);animation:mhGfxSpin 12s linear infinite;
  -webkit-mask:radial-gradient(circle,#000 0 20%,transparent 60%);mask:radial-gradient(circle,#000 0 20%,transparent 60%)}
.mh-gfx-lv{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;margin-top:-16vh}
.mh-gfx-lv .left{display:flex;flex-direction:column;align-items:center}
.mh-gfx-emblem{position:relative;width:140px;height:140px;display:grid;place-items:center;animation:mhGfxEm .7s .1s cubic-bezier(.2,1.6,.4,1) both}
.mh-gfx-emblem svg{position:absolute;inset:0;width:140px;height:140px;filter:drop-shadow(0 0 20px var(--gc))}
.mh-gfx-emblem .n{position:relative;font-weight:900;font-size:40px;line-height:1;padding-top:6px;text-shadow:0 2px 0 var(--gd),0 0 12px #fff;text-align:center;color:#fff}
.mh-gfx-emblem .n small{display:block;font-size:13px;margin-bottom:-2px}
.mh-gfx-ring{position:absolute;left:50%;top:50%;width:140px;height:140px;border-radius:50%;border:4px solid #fff;transform:translate(-50%,-50%);animation:mhGfxRing .9s .5s ease-out both;pointer-events:none}
.mh-gfx-lv .ttl{font-weight:900;font-size:26px;letter-spacing:.06em;margin-top:6px;color:#fff;text-shadow:0 0 14px var(--gc),0 3px 0 #0006;animation:mhGfxPop .45s .6s cubic-bezier(.2,1.8,.4,1) both}
.mh-gfx-lv .sub{font-size:12px;font-weight:900;color:#e2e8f0;text-align:center;max-width:300px;animation:mhGfxFade .4s .75s both}
.mh-gfx-gains{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px;width:min(300px,82vw)}
.mh-gfx-gains li{display:flex;align-items:center;gap:8px;background:#0f172ae0;border:1px solid color-mix(in srgb,var(--gc) 60%,transparent);border-radius:12px;padding:6px 10px;font-size:12px;font-weight:900;text-align:left;
  animation:mhGfxGain .4s var(--d) cubic-bezier(.2,1.5,.4,1) both}
.mh-gfx-gains li small{display:block;font-size:10px;color:#94a3b8;font-weight:700}
.mh-gfx-gains li .new{margin-left:auto;font-size:9px;background:var(--gc);color:#111;border-radius:6px;padding:1px 5px}
.mh-gfx-face{position:absolute;height:32vh;left:50%;margin-left:-21vh;bottom:0;z-index:1;pointer-events:none;animation:mhGfxRise .6s .85s cubic-bezier(.2,1.4,.4,1) both;filter:drop-shadow(0 0 20px #000a)}
.mh-gfx-lv-hint{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);left:0;right:0;text-align:center;font-size:10px;color:#cbd5e1;z-index:3;animation:mhGfxFade .3s 1.6s both}
.mh-gfx-conf{position:absolute;left:50%;top:38%;width:8px;height:12px;pointer-events:none;animation:mhGfxConf 1.8s var(--d) cubic-bezier(.1,.7,.3,1) both}
@keyframes mhGfxConf{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}10%{opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(var(--r));opacity:0}}
@keyframes mhGfxSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes mhGfxFade{from{opacity:0}to{opacity:1}}
@keyframes mhGfxEm{0%{transform:scale(.1) rotate(-30deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes mhGfxRing{0%{transform:translate(-50%,-50%) scale(.6);opacity:1}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
@keyframes mhGfxRise{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
@keyframes mhGfxGain{from{transform:translateY(14px) scale(.9);opacity:0}to{transform:none;opacity:1}}
@media (orientation:landscape){
  .mh-gfx-lv{flex-direction:row;gap:22px;margin-top:0}
  .mh-gfx-sheet.has-face .mh-gfx-lv{margin-left:min(36vw,300px)}
  .mh-gfx-lv .sub{max-width:240px}
  .mh-gfx-gains{margin-top:0;width:290px}
  .mh-gfx-face{left:0;margin-left:0;height:62vh}
}
/* 最後の形(押して飛ばした・軽い設定): 動きを終わらせた状態で見せる */
.mh-gfx-done *,.mh-gfx-done{animation-delay:0s !important;animation-duration:.01s !important}
.mh-gfx-done .mh-gfx-rays{animation:none !important}
/* 控えめ: 粒・光の筋・紙吹雪・光の輪を出さない */
.mh-gfx-reduced .pt,.mh-gfx-reduced .mh-gfx-burst,.mh-gfx-reduced .mh-gfx-rays,.mh-gfx-reduced .mh-gfx-conf,.mh-gfx-reduced .mh-gfx-ring{display:none}
/* 最小: 動かさない(札・カード・帯がその場に出て消えるだけ) */
.mh-gfx-minimal *,.mh-gfx-minimal{animation:none !important;transition:none !important}
.mh-gfx-minimal .pt,.mh-gfx-minimal .mh-gfx-burst,.mh-gfx-minimal .mh-gfx-rays,.mh-gfx-minimal .mh-gfx-conf,.mh-gfx-minimal .mh-gfx-ring,.mh-gfx-minimal .mh-gfx-face{display:none}
.mh-gfx-band{position:relative;width:100%;padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:2px;font-weight:900;color:#fff;
  background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--gc) 45%,#0f172a) 20% 80%,transparent);border-block:1.5px solid var(--gc)}
.mh-gfx-band .big{font-size:20px;white-space:nowrap}
.mh-gfx-band small{font-size:11px;color:#e2e8f0;text-align:center}
`;
let growthFxCssDone = false;
const ensureGrowthFxCss = () => {
  if (growthFxCssDone || typeof document === 'undefined') return;
  growthFxCssDone = true;
  const el = document.createElement('style');
  el.setAttribute('data-growth-fx-css', '');
  el.textContent = GROWTH_FX_CSS;
  document.head.appendChild(el);
};

// いま出してよいか(画面と、画面の上に出ているもの)。tools/ui/growth-fx-check.js が確かめる
//   all … 札も含めて出す / sheet … 真ん中のカード・Lvアップも出す
const growthFxVisible = (screen, domHold = {}) => {
  const all = GROWTH_FX_CALM_SCREENS.has(screen) && !domHold.all;
  return { all, sheet: all && !domHold.sheet };
};
// 軽さ: 端末の「動きを減らす」と最軽量は minimal、標準・軽めは reduced、豪華は full
const growthFxLevelOf = (load) => {
  let reduce = false;
  try { reduce = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  if (reduce || load === 'MINIMAL') return 'minimal';
  if (load === 'STANDARD' || load === 'LIGHT') return 'reduced';
  return 'full';
};

// 決まった並びの粒(毎回同じ形。乱数を使わないので止め絵の検査でぶれない)
const growthFxBurstBits = (n, delay, size) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, r = 150 + (i % 3) * 40;
  return { x: `${Math.round(Math.cos(a) * r)}px`, y: `${Math.round(Math.sin(a) * r - 30)}px`, r: `${(i * 47) % 90 - 45}deg`, d: `${(delay + (i % 4) * 0.04).toFixed(2)}s`, s: size - (i % 3) * 4 };
});
const GROWTH_FX_CONFETTI_COLORS = ['#fde047', '#ffffff', '#c084fc', '#22d3ee'];

// 数え上げ(TrainingCountUp と同じ考え方。軽い設定では最初から最後の数)
const GrowthFxCount = ({ from = 0, to = 0, delay = 0, duration = 1000, instant = false, prefix = '' }) => {
  const [v, setV] = useState(instant ? to : from);
  useEffect(() => {
    if (instant) { setV(to); return undefined; }
    let raf = 0; const t0 = performance.now() + delay;
    const step = (now) => {
      const x = Math.max(0, Math.min(1, (now - t0) / Math.max(1, duration)));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - x, 3))));
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, duration, instant]);
  return <span>{prefix}{Number(v).toLocaleString()}</span>;
};

// ゲージ(Lvをまたぐときは満タン → 0 → 伸び直す。LevelGrowthBar と同じ動き)
const GrowthFxGauge = ({ from = 0, to = 0, wrap = false, delay = 700, instant = false }) => {
  const [w, setW] = useState(instant ? to : from);
  const [noTr, setNoTr] = useState(false);
  useEffect(() => {
    if (instant) { setW(to); return undefined; }
    const ts = [];
    if (wrap) {
      ts.push(setTimeout(() => setW(100), delay));
      ts.push(setTimeout(() => { setNoTr(true); setW(0); }, delay + 650));
      ts.push(setTimeout(() => { setNoTr(false); setW(to); }, delay + 720));
    } else ts.push(setTimeout(() => setW(to), delay));
    return () => ts.forEach(clearTimeout);
  }, [from, to, wrap, delay, instant]);
  return <div className="mh-gfx-gauge"><i style={{ width: `${w}%`, transition: noTr ? 'none' : 'width .65s cubic-bezier(.3,0,.2,1)' }}/></div>;
};

const GrowthFxChip = ({ chip, level, held }) => {
  const k = growthFxKind(chip.kind);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (held) return undefined;
    setOut(false);
    const t1 = setTimeout(() => setOut(true), GROWTH_FX_SMALL_MS);
    const t2 = setTimeout(() => growthFxDropSmall(chip.id), GROWTH_FX_SMALL_MS + 320);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [chip.id, chip.rev, held]);
  const pts = level === 'full' ? [0, 1, 2, 3] : [];
  return (
    <div className={`mh-gfx-chip${out ? ' out' : ''}`} data-growth-fx-chip={chip.kind} style={{ '--gc': k.color }}>
      <span key={`i${chip.rev}`} className="ico beat" aria-hidden="true">{cardIconNode(k.icon, 13)}</span>
      <span className="min-w-0"><span className="who block">{chip.name ? `${chip.name}・` : ''}{k.label}</span>
        <span className="bar block"><i style={{ width: `${chip.pctTo}%` }}/></span></span>
      <span key={`n${chip.rev}`} className="num pop">+{Number(chip.gain).toLocaleString()}</span>
      {pts.map(i => <span key={`p${chip.rev}-${i}`} className="pt" aria-hidden="true" style={{ '--dx': `${(i * 53) % 50 - 25}px`, animationDelay: `${0.15 + i * 0.1}s` }}>{k.particle}</span>)}
    </div>
  );
};

const GrowthFxItemCard = ({ sheet, level, onClose }) => {
  const k = growthFxKind(sheet.kind);
  const instant = level === 'minimal';
  useEffect(() => { const t = setTimeout(onClose, GROWTH_FX_ITEM_MS); return () => clearTimeout(t); }, [sheet.id]);
  const reaction = sheet.reaction === 'like' || sheet.reaction === 'dislike' ? sheet.reaction : null;
  return (
    <div className={`mh-gfx-sheet item mh-gfx-${level}`} data-growth-fx-sheet="item" data-growth-fx-kind={sheet.kind} role="dialog" aria-label={sheet.title || ''}
      style={{ '--gc': k.color }} onClick={onClose}>
      <div className="mh-gfx-card">
        {(sheet.faces || []).length > 0 && <div className="faces">{sheet.faces.map((src, i) => <img key={i} src={src} alt="" className={sheet.faceRound ? 'round' : ''} style={{ animationDelay: `${0.4 + i * 0.15}s` }}/>)}</div>}
        <div className="ttl">{sheet.title}{reaction && <span className={`tag ${reaction}`}>{reaction === 'like' ? '大好き！' : 'ちょっと苦手…'}</span>}</div>
        {sheet.item && <div className="itm">{sheet.item}</div>}
        {(sheet.rows || []).map((row, i) => {
          const rk = growthFxKind(row.kind);
          const lvUp = growthFxNum(row.levelTo) > growthFxNum(row.levelFrom);
          return (
            <div key={i} className="mh-gfx-row" style={{ '--rc': rk.color }}>
              <span className="ico" aria-hidden="true">{cardIconNode(rk.icon, 18)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lab"><em>{row.label || rk.label}{row.levelTo != null ? <> Lv.<GrowthFxCount from={row.levelFrom} to={row.levelTo} delay={900} duration={900} instant={instant}/></> : null}</em>
                  {lvUp && <span className="up" style={{ animationDelay: instant ? '0s' : '1.6s' }}>Lv +{row.levelTo - row.levelFrom}</span>}</div>
                <GrowthFxGauge from={row.pctFrom} to={row.pctTo} wrap={lvUp} delay={700 + i * 400} instant={instant}/>
              </div>
              <div className="val"><GrowthFxCount from={0} to={growthFxNum(row.gain)} delay={700 + i * 400} duration={1100} instant={instant} prefix="+"/>{row.unit && <small>{row.unit}</small>}</div>
            </div>
          );
        })}
        <div className="mh-gfx-hint">押すと閉じる</div>
      </div>
      {level === 'full' && <div className="mh-gfx-burst" aria-hidden="true">{growthFxBurstBits(reaction === 'like' ? 18 : 12, 0.7, 18).map((b, i) =>
        <span key={i} style={{ '--x': b.x, '--y': b.y, '--r': b.r, '--d': b.d, fontSize: `${b.s}px` }}>{k.particle}</span>)}</div>}
    </div>
  );
};

const GrowthFxLevelUp = ({ sheet, level, onClose }) => {
  const k = growthFxKind(sheet.kind);
  const [done, setDone] = useState(level === 'minimal');
  const opened = useRef(Date.now());
  useEffect(() => { try { if (level !== 'minimal' && typeof Audio_ !== 'undefined') Audio_.se.levelUp(); } catch {} }, [sheet.id]);
  // 押すと先へ: 演出中 → 最後の形 → 閉じる(開いた直後の押し間違いでは閉じない)
  const next = () => { if (Date.now() - opened.current < 250) return; if (!done) setDone(true); else onClose(); };
  const gains = Array.isArray(sheet.gains) ? sheet.gains : [];
  const label = `${k.label}が Lv.${sheet.levelTo} に上がりました`;
  if (level === 'minimal') {
    return (
      <div className="mh-gfx-sheet level-mini mh-gfx-minimal" data-growth-fx-sheet="level" data-growth-fx-kind={sheet.kind} role="dialog" aria-label={label}
        style={{ '--gc': k.color, background: '#0b102699' }} onClick={onClose}>
        <div className="mh-gfx-band"><span className="big">{cardIconNode(k.icon, 20)} {k.label} Lv.{sheet.levelTo}</span>
          <small>{sheet.sub}{gains.length ? ` ・ ${gains.map(g => g.text).join('・')}` : ''}</small><small>押すと閉じる</small></div>
      </div>
    );
  }
  const conf = level === 'full' ? Array.from({ length: 24 }, (_, i) => ({ c: i % 2 ? k.color : GROWTH_FX_CONFETTI_COLORS[i % 4],
    x: `${(i * 71) % 340 - 170}px`, y: `${(i * 43) % 300 - 200}px`, r: `${i * 57}deg`, d: `${(0.5 + (i % 6) * 0.05).toFixed(2)}s` })) : [];
  return (
    <div className={`mh-gfx-sheet level mh-gfx-${level}${done ? ' mh-gfx-done' : ''}${sheet.face ? ' has-face' : ''}`} data-growth-fx-sheet="level" data-growth-fx-kind={sheet.kind}
      role="dialog" aria-modal="true" aria-label={label} tabIndex={0} style={{ '--gc': k.color, '--gd': k.deep }} onClick={next}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); next(); } }}>
      <div className="mh-gfx-rays" aria-hidden="true"/>
      {conf.map((c, i) => <span key={i} className="mh-gfx-conf" aria-hidden="true" style={{ background: c.c, '--x': c.x, '--y': c.y, '--r': c.r, '--d': c.d }}/>)}
      {sheet.face && <img className="mh-gfx-face" src={sheet.face} alt=""/>}
      <div className="mh-gfx-lv">
        <div className="left">
          <div className="mh-gfx-emblem">
            <svg viewBox="0 0 100 100" aria-hidden="true">{sheet.kind === 'bond'
              ? <path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C40 8 46 14 50 21 C54 14 60 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88Z" fill={k.color} stroke="#fff" strokeWidth="3"/>
              : sheet.kind === 'friend'
                ? <g fill={k.color} stroke="#fff" strokeWidth="3"><circle cx="36" cy="52" r="32"/><circle cx="64" cy="52" r="32" fillOpacity=".85"/></g>
                : sheet.kind === 'star'
                  ? <path d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z" fill={k.color} stroke="#fff" strokeWidth="3"/>
                  : <path d="M50 6 L88 20 L84 58 C80 76 66 88 50 95 C34 88 20 76 16 58 L12 20 Z" fill={k.color} stroke="#fff" strokeWidth="3"/>}</svg>
            <span className="n"><small>Lv.</small>{sheet.levelTo}</span>
            <div className="mh-gfx-ring" aria-hidden="true"/>
          </div>
          <div className="ttl">{sheet.title || `${k.label} UP!`}</div>
          {sheet.sub && <div className="sub">{sheet.sub}</div>}
        </div>
        {gains.length > 0 && <ul className="mh-gfx-gains" aria-label="新しく開いたもの">
          {gains.map((g, i) => (
            <li key={i} style={{ '--d': `${1.2 + i * 0.3}s` }}>
              <span aria-hidden="true">{cardIconNode(g.icon || '✨', 14)}</span>
              <span className="min-w-0"><b>{String(g.text || '')}</b>{g.note && <small>{String(g.note)}</small>}</span>
              {g.isNew && <span className="new">NEW</span>}
            </li>
          ))}
        </ul>}
      </div>
      <div className="mh-gfx-lv-hint">{done ? '押すと閉じる' : '押すと先へ'}</div>
    </div>
  );
};

// 60-app.jsx に1つだけ置く。screen … いまの gameState / load … バトル設定「画面の軽さ」
const GrowthFxLayer = ({ screen, load }) => {
  const [, setTick] = useState(0);
  const [domHold, setDomHold] = useState({ all: false, sheet: false });
  useEffect(() => { ensureGrowthFxCss(); return growthFxSubscribe(() => setTick(t => t + 1)); }, []);
  const small = GROWTH_FX_STORE.small, sheets = GROWTH_FX_STORE.sheets;
  const pending = small.length + sheets.length;
  // お話・ほかの大きな演出が画面に出ているかを見る(貯めているものがあるときだけ、0.6秒ごと)
  useEffect(() => {
    if (!pending || typeof document === 'undefined') return undefined;
    const check = () => {
      const all = !!document.querySelector(GROWTH_FX_HOLD_ALL_SELECTOR);
      const sheet = all || !!document.querySelector(GROWTH_FX_HOLD_SHEET_SELECTOR);
      setDomHold(prev => (prev.all === all && prev.sheet === sheet ? prev : { all, sheet }));
    };
    check();
    const t = setInterval(check, 600);
    return () => clearInterval(t);
  }, [pending > 0]);
  if (!pending) return null;
  const vis = growthFxVisible(screen, domHold);
  const holdAll = !vis.all;
  const holdSheet = !vis.sheet;
  const level = growthFxLevelOf(load);
  const sheet = !holdSheet ? sheets[0] : null;
  return (
    <>
      {!holdAll && !sheet && small.length > 0 && <div className={`mh-gfx-chips mh-gfx-${level}`} data-growth-fx-chips aria-live="polite">
        {small.slice(0, GROWTH_FX_SMALL_MAX).map(c => <GrowthFxChip key={c.id} chip={c} level={level} held={false}/>)}
      </div>}
      {sheet && (sheet.tier === 'level'
        ? <GrowthFxLevelUp key={sheet.id} sheet={sheet} level={level} onClose={() => growthFxDropSheet(sheet.id)}/>
        : <GrowthFxItemCard key={sheet.id} sheet={sheet} level={level} onClose={() => growthFxDropSheet(sheet.id)}/>)}
    </>
  );
};
