// ===== 助手のマスモンの対戦を「観戦」する試作(2026-11-11 ミセカタ) =====
// ・入口はデバッグ設定(DEBUG_SETTINGS)だけ。通常の画面からは開かない。公開の印はまだ無い
// ・何も保存しない(localStorage・サーバのどちらにも書かない)。プレイヤーのマスモン・ランキングに触れない
// ・計算は data/assistant-masmon-battle.js(タタカイ)。ここは1戦の記録(log)を再生するだけで、計算には手を入れない
//   計算の本体は index.html で読み込んでいないので、この画面を開いたときにだけ読む
// ・技表は ASSISTANT_MASMON_TECHS(シュギョウ)があればそれ、無ければ下の仮の技表(tools/masmon-battle/draft-techs.js の写し)
// 設計: docs/progress/assistant-peer/masmon-battle/view/VIEW-PLAN.md
const AMBW_ENGINE_SRC = 'data/assistant-masmon-battle.js';
const AMBW_DIST = ['零', '近', '中', '遠'];
// 助手のひとこと(WHY)。指示を聞かない番(sulk)の言い方は画面では「意味不明」(2026-11-14 社長)。計算側の文は変えない
const ambwWhyOf = (k, why) => (k === 'sulk' ? '意味不明な行動をしてしまった…' : (why || {})[k]);
const AMBW_STAT_JP = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
const AMBW_DIFFS = Object.freeze([-20, -10, 0, 5, 10, 20, 30]);
const AMBW_SPEEDS = Object.freeze([{ id: 'x1', label: '×1', ms: 1100 }, { id: 'x2', label: '×2', ms: 560 }, { id: 'x4', label: '×4', ms: 260 }, { id: 'hl', label: '★ 見せ場だけ', ms: 1300 }]);
const AMBW_BALANCE_NOTE = Object.freeze({ A: 'ふつう', B: 'ゆるめ(能力の差が効きにくい)', C: '強め(能力の差が効きやすい)' });
const AMBW_DEFAULT = Object.freeze({
  A: { assistant: 'kiki', species: ['Golem', 'Eiki', 'Ghost'] },
  B: { assistant: 'mua', species: ['Golem', 'Eiki', 'Ghost'] },
});

let ambwLoading = null;
const ambwLoadEngine = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  if (window.ASSISTANT_MASMON_BATTLE) return Promise.resolve(window.ASSISTANT_MASMON_BATTLE);
  if (!ambwLoading) {
    ambwLoading = new Promise((res) => {
      const s = document.createElement('script');
      s.src = AMBW_ENGINE_SRC;
      s.onload = () => res(window.ASSISTANT_MASMON_BATTLE || null);
      s.onerror = () => { ambwLoading = null; res(null); };
      document.head.appendChild(s);
    });
  }
  return ambwLoading;
};

// 仮の技表(本番の技表が入るまで)。tools/masmon-battle/draft-techs.js と同じ形
const ambwDraftTechs = (mons) => {
  const G = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const species = {};
  for (const id of Object.keys(mons).sort()) {
    const apt = (mons[id].distAptitude || ['C', 'C', 'C', 'C']).map(g => G.indexOf(g));
    let best = 0;
    apt.forEach((v, i) => { if (v > apt[best]) best = i; });
    const near = best === 0 ? 1 : best === 3 ? 2 : (apt[best - 1] >= apt[best + 1] ? best - 1 : best + 1);
    const bigKind = best <= 1 ? 'pow' : 'wise';
    const other = bigKind === 'pow' ? 'wise' : 'pow';
    const k = id.toLowerCase();
    species[id] = [
      { id: `${k}_01`, name: '仮・軽打', kind: 'pow', dist: [0, 1], power: 12, hit: 8, guts: 12, crit: 5, gd: 3, learn: { start: true } },
      { id: `${k}_02`, name: '仮・遠撃', kind: 'wise', dist: [2, 3], power: 14, hit: 4, guts: 16, crit: 5, gd: 5, learn: { start: true } },
      { id: `${k}_03`, name: '仮・大技', kind: bigKind, dist: [best], power: 34, hit: -14, guts: 42, crit: 12, gd: 8 },
      { id: `${k}_04`, name: '仮・ガッツ崩し', kind: other, dist: [Math.min(best, near), Math.max(best, near)], power: 10, hit: 2, guts: 22, crit: 5, gd: 28 },
      { id: `${k}_05`, name: '仮・会心', kind: 'pow', dist: [1, 2], power: 18, hit: 16, guts: 24, crit: 22, gd: 5 },
    ];
  }
  return { version: 0, draft: true, species };
};

const ambwTechTable = () => {
  // 本番の技表(data/assistant-masmon-techs.js・シュギョウ)は const で置かれ、window には載らないので typeof で見る
  const real = typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null;
  if (real && typeof real === 'object' && real.species) return real;
  return ambwDraftTechs(ALL_PLAYER_MONSTERS);
};

// 種族ごとに決まった形の6能力(合計 total)。同じ種族ならいつも同じ形
const ambwStatsOf = (engine, speciesId, total) => {
  const rnd = engine.makeRng('ambw-shape-' + speciesId);
  const w = engine.STAT_KEYS.map(() => 0.55 + rnd());
  const sum = w.reduce((a, b) => a + b, 0);
  const out = {};
  engine.STAT_KEYS.forEach((k, i) => { out[k] = Math.max(1, Math.min(engine.STAT_MAX || 999, Math.round(total * w[i] / sum))); });
  return out;
};

const ambwTeamOf = (engine, side, size, total, catalog, allTechs) => ({
  assistantId: side.assistant,
  tactics: 40,
  members: side.species.slice(0, size).map((sp) => ({
    species: sp, name: (ALL_PLAYER_MONSTERS[sp] && ALL_PLAYER_MONSTERS[sp].name) || sp, lv: 30, stats: ambwStatsOf(engine, sp, total),
    // 技: 全部(技表の8つ)か、最初から使える技だけ(techs を渡さない)
    ...(allTechs && catalog && catalog.species[sp] && Array.isArray(catalog.species[sp].techs) ? { techs: catalog.species[sp].techs.map(t => t.id) } : {}),
  })),
});

// 記録をたどって、1行ごとの場のようす(ライフ・ガッツ・場の1体・距離)を作る
const ambwFramesOf = (log) => {
  const st = log[0] || {};
  const cur = { hp: { A: (st.aHp || []).slice(), B: (st.bHp || []).slice() }, g: { A: 50, B: 50 }, act: { A: 0, B: 0 }, d: st.d || 0, r: 0 };
  return log.map((e) => {
    cur.d = Number.isFinite(e.d) ? e.d : cur.d;
    cur.r = Number.isFinite(e.r) ? e.r : cur.r;
    if ((e.ev === 'enter' || e.ev === 'swap') && e.side) cur.act[e.side] = e.i;
    if (Number.isFinite(e.ga)) cur.g.A = e.ga; else if (e.side === 'A' && Number.isFinite(e.guts)) cur.g.A = e.guts;
    if (Number.isFinite(e.gb)) cur.g.B = e.gb; else if (e.side === 'B' && Number.isFinite(e.guts)) cur.g.B = e.guts;
    if (e.ev === 'tech' && e.side) {
      const foe = e.side === 'A' ? 'B' : 'A';
      const ti = Number.isFinite(e.ti) ? e.ti : cur.act[foe];
      if (Number.isFinite(e.foeHp)) cur.hp[foe][ti] = e.foeHp;
      if (!Number.isFinite(e.ga) && Number.isFinite(e.foeGuts)) cur.g[foe] = e.foeGuts;
    }
    return { hp: { A: cur.hp.A.slice(), B: cur.hp.B.slice() }, g: { A: cur.g.A, B: cur.g.B }, act: { A: cur.act.A, B: cur.act.B }, d: cur.d, r: cur.r };
  });
};

// 見せ場(たおれた・交代・会心・大きな一撃・大技のはずれ・決着)
const ambwIsHighlight = (e, maxHp) => {
  if (!e) return false;
  if (e.ev === 'ko' || e.ev === 'swap' || e.ev === 'end' || e.ev === 'start') return true;
  if (e.ev !== 'tech') return false;
  if (e.crit) return true;
  const foe = e.side === 'A' ? 'B' : 'A';
  const mx = Math.max(...(maxHp[foe] || [1]), 1);
  if (e.hit && e.dmg >= mx * 0.3) return true;
  return false;
};

const AMBW_CSS = `
.ambw{position:fixed;inset:0;z-index:9500;overflow-y:auto;background:linear-gradient(180deg,#221a44,#141026 40%);color:#fff;font-weight:700;-webkit-overflow-scrolling:touch}
/* iPhone の時計・電波の帯(上)とホームの棒(下)・横向きの切り欠きにかからないよう、端の安全な余白を足す(2026-11-14 えるびんさん「もどるが押せない」) */
.ambw-in{max-width:460px;margin:0 auto;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
.ambw-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:900;color:#f9a8d4}
.ambw-top b{color:#fff;background:#3b3566;border-radius:99px;padding:2px 10px;white-space:nowrap}
.ambw-card{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:9px;margin-top:8px}
.ambw-card.me{border-color:#f472b6aa}.ambw-card.foe{border-color:#38bdf8aa}
.ambw-row{display:flex;align-items:center;gap:8px}
.ambw-face{width:36px;height:36px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #fff3;background:#312e5a;flex-shrink:0}
.ambw-small{font-size:11px;color:#cbd5e1;line-height:1.5}
.ambw-bench{display:flex;gap:4px}.ambw-bn{width:32px}.ambw-bn img{display:block;width:32px;height:30px;object-fit:contain;background:#0f172a;border-radius:7px}
.ambw-bn i{display:block;height:3px;border-radius:3px;background:#34d399;margin-top:2px}.ambw-bn.dead img{filter:grayscale(1) brightness(.45)}
.ambw-mn{font-size:13px;width:84px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ambw-bar{height:10px;border-radius:9px;background:#334155;overflow:hidden}.ambw-bar i{display:block;height:100%;background:linear-gradient(90deg,#34d399,#a3e635);transition:width .35s}
.ambw-bar.low i{background:linear-gradient(90deg,#fb7185,#f97316)}.ambw-bar.pt i{background:linear-gradient(90deg,#f59e0b,#fb923c)}
.ambw-gbar{height:6px;border-radius:6px;background:#334155;margin-top:4px;position:relative;overflow:hidden}.ambw-gbar i{display:block;height:100%;background:linear-gradient(90deg,#fde047,#facc15);transition:width .35s}
.ambw-gbar u{position:absolute;top:0;width:1px;height:100%;background:#0f172a}
.ambw-num{width:78px;text-align:right;font-size:14px;line-height:1.15;font-weight:900}.ambw-num small{font-size:10px;color:#94a3b8}.ambw-num em{font-style:normal;font-size:11px;color:#fde047}
.ambw-chips{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
.ambw-chip{flex:1 1 22%;min-width:0;font-size:10px;font-weight:800;background:#0f172a;border:1px solid #475569;color:#64748b;border-radius:8px;padding:3px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;line-height:1.3}
.ambw-chip .msa-tn{display:block;white-space:normal;word-break:keep-all;overflow-wrap:normal;line-height:1.15}.ambw-chip .msa-tn-s{white-space:nowrap}
.ambw-chip{white-space:normal!important;text-overflow:clip!important}
[data-ambw-cards]{display:block}
.ambw-chip small{display:block;font-size:9px;line-height:1.2}.ambw-chip small.ambw-hit{font-size:10px;font-weight:900;color:#fde68a}.ambw-chip.use small.ambw-hit{color:#7c2d12}.ambw-chip.on{border-color:#fde047;color:#fff;background:#3b2f0b}.ambw-chip.ng{border-color:#64748b;color:#cbd5e1}.ambw-chip.use{background:#fde047;color:#422006;border-color:#fde047}
.ambw-ring{position:relative;height:244px;margin-top:8px;border-radius:14px;background:radial-gradient(ellipse at 50% 85%,#4c3f8f 0,#241d4a 55%,#171230 100%);border:1px solid #3b3566;overflow:hidden}
.ambw-dist{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px}
.ambw-dist span{font-size:11px;font-weight:900;color:#94a3b8;background:#0f172a;border-radius:6px;padding:1px 10px}.ambw-dist .cur{background:#fde047;color:#422006}
.ambw-stage{position:absolute;z-index:2;left:0;right:0;bottom:30px;display:flex;justify-content:center;align-items:flex-end}
.ambw-gap{transition:width .4s}
.ambw-f{position:relative;text-align:center;width:92px}.ambw-f img{width:88px;height:88px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 6px 4px #0008)}
.ambw-f em{font-style:normal;font-size:10.5px;font-weight:900;background:#0009;border-radius:6px;padding:0 6px;white-space:nowrap}
.ambw-f.down img{filter:grayscale(1) brightness(.5);transform:rotate(80deg) translateY(10px)}
.ambw-flip{transform:scaleX(-1)}
@keyframes ambwLungeA{0%{transform:translateX(0)}35%{transform:translateX(26px)}100%{transform:translateX(0)}}
@keyframes ambwLungeB{0%{transform:translateX(0)}35%{transform:translateX(-26px)}100%{transform:translateX(0)}}
@keyframes ambwShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px) rotate(-5deg)}45%{transform:translateX(7px) rotate(5deg)}70%{transform:translateX(-4px)}}
@keyframes ambwPop{0%{opacity:0;transform:translateY(12px) scale(.6) rotate(-8deg)}25%{opacity:1;transform:translateY(-6px) scale(1.2) rotate(-8deg)}100%{opacity:1;transform:translateY(-14px) scale(1) rotate(-8deg)}}
@keyframes ambwCut{0%{opacity:0;transform:translateX(-40px) skewX(-10deg)}100%{opacity:1;transform:translateX(0) skewX(-10deg)}}
@keyframes ambwFlash{0%{filter:drop-shadow(0 0 14px #f87171) brightness(1.7)}100%{filter:drop-shadow(0 6px 4px #0008)}}
.ambw-lungeA{animation:ambwLungeA .42s ease-out}.ambw-lungeB{animation:ambwLungeB .42s ease-out}
.ambw-hit{animation:ambwShake .45s ease-out}.ambw-hit img{animation:ambwFlash .5s ease-out}
.ambw-dmg{position:absolute;z-index:3;top:-30px;left:50%;margin-left:-60px;width:120px;text-align:center;font-size:27px;font-weight:900;color:#fde047;text-shadow:0 2px 0 #b91c1c,0 0 8px #f97316;line-height:.95;animation:ambwPop .5s ease-out both;pointer-events:none}
.ambw-dmg small{display:block;font-size:12px;color:#fff;margin-bottom:3px}.ambw-dmg.miss{color:#cbd5e1;font-size:19px;text-shadow:0 2px 0 #0f172a}
.ambw-cut{position:absolute;z-index:1;top:8px;left:-6px;right:36px;padding:3px 18px;background:linear-gradient(90deg,#a855f7,#6366f1 70%,#6366f100);animation:ambwCut .22s ease-out both}
.ambw-cut.pow{background:linear-gradient(90deg,#f97316,#ef4444 70%,#ef444400)}.ambw-cut.B{left:36px;right:-6px;text-align:right;background:linear-gradient(270deg,#0ea5e9,#2563eb 70%,#2563eb00)}
.ambw-cut.etc{background:linear-gradient(90deg,#475569,#334155 70%,#33415500)}
.ambw-cut b{display:block;font-size:17px;letter-spacing:.04em;text-shadow:0 2px 0 #0006;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ambw-cut small{font-size:10px;font-weight:900}
.ambw-bubble{background:#fff;color:#1e1b4b;border-radius:12px;padding:6px 10px;font-size:12px;font-weight:800;line-height:1.5;flex:1}
.ambw-log p{margin:2px 0;font-size:11px;color:#cbd5e1;padding-left:6px;border-left:3px solid #64748b}.ambw-log p.A{border-color:#f472b6}.ambw-log p.B{border-color:#38bdf8}.ambw-log p small{color:#64748b;margin-right:4px}
.ambw-seek{height:8px;border-radius:6px;background:#334155;margin-top:12px;position:relative}.ambw-seek i{display:block;height:100%;border-radius:6px;background:#f472b6}
.ambw-seek button{position:absolute;top:-9px;margin-left:-9px;width:18px;height:22px;font-size:11px;color:#7dd3fc;background:none;border:0;padding:0}.ambw-seek button.A{color:#f9a8d4}
.ambw-ctl{display:flex;gap:6px;justify-content:center;align-items:center;margin-top:10px;flex-wrap:wrap}
.ambw-btn,.ambw-btn2,.ambw-sp{border-radius:999px;padding:8px 13px;font-weight:900;font-size:12px;white-space:nowrap;border:0;color:#fff;min-height:36px}
.ambw-btn{background:linear-gradient(90deg,#f472b6,#fb923c)}.ambw-btn2{background:#334155}
.ambw-sp{background:#1e293b;border:1px solid #475569;color:#94a3b8}.ambw-sp.on{background:#fde047;color:#422006;border-color:#fde047}
.ambw-tabs{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}
.ambw-tabs button{flex:1;text-align:center;font-size:12px;font-weight:900;padding:7px 4px;border-radius:10px;background:#1e293b;color:#94a3b8;border:1px solid #475569;white-space:nowrap;min-height:34px}
.ambw-tabs button.on{background:#fde047;color:#422006;border-color:#fde047}
.ambw-sel{width:100%;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:9px;padding:6px 4px;font-size:12px;font-weight:800;min-height:34px}
.ambw-slot{flex:1;min-width:0;text-align:center}.ambw-slot img{width:54px;height:54px;object-fit:contain;display:block;margin:0 auto 3px}
.ambw-res{text-align:center;margin-top:8px}.ambw-res b{display:block;font-size:30px;letter-spacing:.08em;color:#fde047}.ambw-res span{display:block;font-size:12px;color:#e2e8f0}
.ambw-tbl{width:100%;border-collapse:collapse;font-size:12px;font-weight:800}.ambw-tbl td{padding:4px 3px;border-bottom:1px solid #fff1;text-align:right}.ambw-tbl td:first-child{text-align:left}
.ambw-tbl .A{color:#f9a8d4}.ambw-tbl .B{color:#7dd3fc}.ambw-tbl tr.cur td{background:#fde04718}
.ambw-k{display:flex;align-items:center;gap:6px;font-size:12px;margin:4px 0}.ambw-k span:first-child{width:150px;white-space:nowrap}.ambw-k b{width:46px;text-align:right;color:#fcd34d}.ambw-k .ambw-bar{flex:1}
`;

// 片方の陣営の札(助手・場の1体のライフとガッツ・控え・技の札)
// 技の札の命中率(2026-11-13 社長「命中表記は技のコマンドのところにも出してほしい」)。芯の公開の口 hitPreviewer で、いまのガッツ・能力・サイズから出す(計算は変えない)
//   catalog と teams を渡したときだけ出す。編成ごとに1回だけ組み立てて使い回す
const ambwHitCache = new WeakMap();
const ambwHitPct = (catalog, teams, side, frame, id) => {
  const eng = typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE : null;
  if (!eng || typeof eng.hitPreviewer !== 'function' || !catalog || !teams || !teams.A || !teams.B) return null;
  let st = ambwHitCache.get(teams.A);
  if (!st || st.b !== teams.B) { st = { b: teams.B, f: eng.hitPreviewer(catalog, teams.A, teams.B) }; ambwHitCache.set(teams.A, st); }
  const v = st.f(side, frame.act.A, frame.act.B, frame.g[side], frame.d)[id];
  return Number.isFinite(v) ? v : null;
};
// 技の札の形にそろえる(56-monhero-success-manual.jsx の MsaDistCards・MsaTechSheet が読む形)。
//   命中の目安 hit と威力 power は技表から(代表の技を「命中×威力」で決めるため)。版9から技表の hit は最後に掛ける係数(5 で1段・×1.35)なので、
//   目安は「命中=回避・ガッツ半分」のときの命中%(芯の techHitPreview。B の技で 50%)。芯が古いときだけ 75+補正
//   (能力の差はどの技にも同じだけ効くので、目安には入れない。札と一覧に出す命中%は hitPreviewer のいまの値)。技表に無い技は 0
const AMBW_HIT_BASE = 75;
const ambwHitOf = (hitPct, extra) => {
  const eng = typeof window !== 'undefined' && window.ASSISTANT_MASMON_BATTLE ? window.ASSISTANT_MASMON_BATTLE : null;
  return eng && typeof eng.techHitPreview === 'function' ? eng.techHitPreview(hitPct, extra) : AMBW_HIT_BASE + (Number(hitPct) || 0) + (Number(extra) || 0) * 100;
};
const ambwTechItems = (catalog, member, list) => {
  const sp = catalog && member && catalog.species && catalog.species[member.species];
  const byId = {}; if (sp && Array.isArray(sp.techs)) for (const t of sp.techs) byId[t.id] = t;
  return (Array.isArray(list) ? list : []).map((mv) => { const t = byId[mv.id]; return { ...mv, dist: Array.isArray(mv.dist) ? mv.dist : [], hit: t ? ambwHitOf(t.hit) : 0, power: t ? Number(t.power) || 0 : 0,
    ...(t ? { base: { power: t.power, hit: t.hit, gd: t.gd, crit: t.crit } } : {}) }; });
};
// cards … 技の札を間合いごとの4枚にする(2026-11-13 社長)。rep … [零,近,中,遠] の代表の技 id/onOpen(side, d) … 札を押すと一覧
function AmbwPanel({ side, team, frame, maxHp, moves, lastMove, mine, catalog = null, teams = null, cards = false, rep = null, onOpen = null }) {
  const who = ASSISTANT_LIST.find(a => a.id === team.assistantId) || ASSISTANT_LIST[0];
  const style = (window.ASSISTANT_MASMON_BATTLE.STYLES[team.assistantId] || {}).label || '';
  const i = frame.act[side];
  const hp = Math.max(0, frame.hp[side][i] || 0), mx = maxHp[side][i] || 1, g = frame.g[side];
  const list = (moves && moves[i]) || [];
  useEffect(() => { if (typeof msaFitTechNames === 'function') msaFitTechNames(); });
  return (
    <div className={`ambw-card ${mine ? 'me' : 'foe'}`} data-ambw-panel={side}>
      <div className="ambw-row">
        <img className="ambw-face" src={assistantFaceSrc(who, 'normal')} alt=""/>
        <div style={{ flex: 1, minWidth: 0 }}><div className="ambw-small">{mine ? '手前' : '奥'}</div><b style={{ fontSize: 14 }}>{who.name} <small style={{ fontSize: 10.5, color: '#cbd5e1' }}>{style}</small></b></div>
        <div className="ambw-bench">{team.members.map((m, j) => j === i ? null : (
          <div key={j} className={`ambw-bn ${frame.hp[side][j] <= 0 ? 'dead' : ''}`}><img src={ALL_PLAYER_MONSTERS[m.species].imgUrl} alt=""/><i style={{ width: `${Math.max(0, Math.round(frame.hp[side][j] / (maxHp[side][j] || 1) * 100))}%` }}/></div>
        ))}</div>
      </div>
      <div className="ambw-row" style={{ marginTop: 6 }}>
        <b className="ambw-mn">{team.members[i].name}</b>
        <div style={{ flex: 1 }}>
          <div className={`ambw-bar ${hp / mx < 0.3 ? 'low' : ''}`}><i style={{ width: `${Math.round(hp / mx * 100)}%` }}/></div>
          <div className="ambw-gbar"><i style={{ width: `${Math.max(0, Math.min(100, g))}%` }}/>{[25, 50, 75].map(x => <u key={x} style={{ left: `${x}%` }}/>)}</div>
        </div>
        <div className="ambw-num"><span data-ambw-hp={side}>{hp}</span><small>/{mx}</small><br/><em>ガッツ {Math.round(g)}</em></div>
      </div>
      {cards && typeof MsaDistCards === 'function' ? (
        <div className="ambw-chips" data-ambw-cards={side}>
          <MsaDistCards list={ambwTechItems(catalog, team.members && team.members[i], list)} rep={rep} dist={frame.d} guts={g} lastMove={lastMove} dataSide={side}
            hitAt={(t, d) => { const v = ambwHitPct(catalog, teams, side, { ...frame, d }, t.id); return v != null ? v : t.hit; }} onOpen={onOpen ? (d) => onOpen(side, d) : null}/>
        </div>
      ) : <div className="ambw-chips">{list.map((mv) => {
        const reach = Array.isArray(mv.dist) && mv.dist.includes(frame.d), ok = g >= mv.guts;
        const cls = lastMove === mv.id ? 'use' : reach && ok ? 'on' : reach ? 'ng' : '';
        const hp = ambwHitPct(catalog, teams, side, frame, mv.id);
        return <span key={mv.id} className={`ambw-chip ${cls}`}>{typeof MsaTechName === 'function' ? <MsaTechName name={mv.name} icon={mv.kind === 'pow' ? '🏋️' : '📖'}/> : <>{mv.kind === 'pow' ? '🏋️' : '📖'}{mv.name}</>}{hp != null ? <small className="ambw-hit" data-ambw-hit={hp}>命中 {hp}%</small> : null}<small>ガッツ{mv.guts}・{(mv.dist || []).map(d => AMBW_DIST[d]).join('')}</small></span>;
      })}</div>}
    </div>
  );
}
