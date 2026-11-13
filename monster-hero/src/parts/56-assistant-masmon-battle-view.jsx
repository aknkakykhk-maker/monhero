// ===== 助手のマスモンの対戦を「観戦」する試作(2026-11-11 ミセカタ) =====
// ・入口はデバッグ設定(DEBUG_SETTINGS)だけ。通常の画面からは開かない。公開の印はまだ無い
// ・何も保存しない(localStorage・サーバのどちらにも書かない)。プレイヤーのマスモン・ランキングに触れない
// ・計算は data/assistant-masmon-battle.js(タタカイ)。ここは1戦の記録(log)を再生するだけで、計算には手を入れない
//   計算の本体は index.html で読み込んでいないので、この画面を開いたときにだけ読む
// ・技表は ASSISTANT_MASMON_TECHS(シュギョウ)があればそれ、無ければ下の仮の技表(tools/masmon-battle/draft-techs.js の写し)
// 設計: docs/progress/assistant-peer/masmon-battle/view/VIEW-PLAN.md
const AMBW_ENGINE_SRC = 'data/assistant-masmon-battle.js';
const AMBW_DIST = ['零', '近', '中', '遠'];
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
.ambw-in{max-width:460px;margin:0 auto;padding:10px 12px 28px}
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
.ambw-chip-all{flex:0 0 auto;color:#c4b5fd;border-style:dashed;background:#1e1b4b;font-family:inherit}
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
// reachOnly … 技の札は、いまの間合いで届く技だけ(使った技は残す)。onAll があれば「全部の技」の札を足す(押すと onAll(side))。2026-11-13 段3
function AmbwPanel({ side, team, frame, maxHp, moves, lastMove, mine, catalog = null, teams = null, reachOnly = false, onAll = null }) {
  const who = ASSISTANT_LIST.find(a => a.id === team.assistantId) || ASSISTANT_LIST[0];
  const style = (window.ASSISTANT_MASMON_BATTLE.STYLES[team.assistantId] || {}).label || '';
  const i = frame.act[side];
  const hp = Math.max(0, frame.hp[side][i] || 0), mx = maxHp[side][i] || 1, g = frame.g[side];
  const list = (moves && moves[i]) || [];
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
      <div className="ambw-chips">{list.filter((mv) => !reachOnly || lastMove === mv.id || (Array.isArray(mv.dist) && mv.dist.includes(frame.d))).map((mv) => {
        const reach = Array.isArray(mv.dist) && mv.dist.includes(frame.d), ok = g >= mv.guts;
        const cls = lastMove === mv.id ? 'use' : reach && ok ? 'on' : reach ? 'ng' : '';
        const hp = ambwHitPct(catalog, teams, side, frame, mv.id);
        return <span key={mv.id} className={`ambw-chip ${cls}`}>{mv.kind === 'pow' ? '💪' : '🧠'}{mv.name}{hp != null ? <small className="ambw-hit" data-ambw-hit={hp}>命中 {hp}%</small> : null}<small>ガッツ{mv.guts}・{(mv.dist || []).map(d => AMBW_DIST[d]).join('')}</small></span>;
      })}{onAll && list.length ? <button type="button" className="ambw-chip ambw-chip-all" data-ambw-all={side} onClick={() => onAll(side)}>📜 全部の技<small>{list.length}こ</small></button> : null}</div>
    </div>
  );
}

function AssistantMasmonBattleWatch({ onClose }) {
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [size, setSize] = useState(3);
  const [sideA, setSideA] = useState(AMBW_DEFAULT.A);
  const [sideB, setSideB] = useState(AMBW_DEFAULT.B);
  const [diff, setDiff] = useState(0);            // A の能力の合計を B より何%多くするか
  const [balance, setBalance] = useState('A');
  const [allTechs, setAllTechs] = useState(true);  // 技を全部使うか、最初の技だけか
  const [seedNo, setSeedNo] = useState(1);
  const [speed, setSpeed] = useState('x1');
  const [phase, setPhase] = useState('setup');    // setup → watch → result
  const [battle, setBattle] = useState(null);     // { r, frames, teamA, teamB, maxHp }
  const [pos, setPos] = useState(0);
  const [paused, setPaused] = useState(false);
  const [compare, setCompare] = useState(null);
  const rootRef = useRef(null);
  useEffect(() => { if (rootRef.current) rootRef.current.scrollTop = 0; }, [phase]);

  useEffect(() => {
    let alive = true;
    if (!engine) ambwLoadEngine().then((e) => { if (!alive) return; if (e) setEngine(e); else setLoadFailed(true); });
    return () => { alive = false; };
  }, []);

  const ready = !!(engine && engine.BALANCE && typeof engine.simulate === 'function');
  const catalog = useMemo(() => {
    if (!ready) return null;
    try { return engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() }); } catch (e) { return null; }
  }, [ready]);
  const speciesIds = useMemo(() => (catalog ? Object.keys(catalog.species) : Object.keys(ALL_PLAYER_MONSTERS)), [catalog]);
  const assistants = useMemo(() => ASSISTANT_LIST.filter(a => ready && engine.STYLES[a.id] && (typeof assistantReleased !== 'function' || assistantReleased(a.id))), [ready]);
  const BASE_TOTAL = 1800;
  const teamsNow = () => ({
    teamA: ambwTeamOf(engine, sideA, size, Math.round(BASE_TOTAL * (1 + diff / 100)), catalog, allTechs),
    teamB: ambwTeamOf(engine, sideB, size, BASE_TOTAL, catalog, allTechs),
  });
  const seedOf = (n) => `watch-${n}`;

  const start = (n = seedNo, bal = balance) => {
    if (!ready || !catalog) return;
    const { teamA, teamB } = teamsNow();
    const r = engine.simulate({ seed: seedOf(n), catalog, teamA, teamB, balance: bal, trace: true });
    const st = r.log[0] || {};
    setBattle({ r, frames: ambwFramesOf(r.log), teamA, teamB, maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] }, balance: bal, seedNo: n });
    setPos(0); setPaused(false); setCompare(null); setPhase('watch');
  };

  // 再生: 1行ずつ進める。「見せ場だけ」は見せ場の行までとぶ
  useEffect(() => {
    if (phase !== 'watch' || !battle || paused) return undefined;
    const log = battle.r.log;
    if (pos >= log.length - 1) { const t = setTimeout(() => setPhase('result'), 900); return () => clearTimeout(t); }
    const sp = AMBW_SPEEDS.find(s => s.id === speed) || AMBW_SPEEDS[0];
    const t = setTimeout(() => {
      let next = pos + 1;
      if (speed === 'hl') while (next < log.length - 1 && !ambwIsHighlight(log[next], battle.maxHp)) next++;
      setPos(next);
    }, sp.ms);
    return () => clearTimeout(t);
  }, [phase, battle, pos, paused, speed]);

  // 結果: 同じ編成で 効き方 A・B・C を見比べる(この試合の勝ち負けと、100戦の勝率)。保存しない
  useEffect(() => {
    if (phase !== 'result' || !battle || compare) return undefined;
    const t = setTimeout(() => {
      const N = 100, out = {};
      for (const b of ['A', 'B', 'C']) {
        const same = engine.simulate({ seed: seedOf(battle.seedNo), catalog, teamA: battle.teamA, teamB: battle.teamB, balance: b });
        let w = 0;
        for (let k = 0; k < N; k++) if (engine.simulate({ seed: `cmp-${k}`, catalog, teamA: battle.teamA, teamB: battle.teamB, balance: b }).winner === 'A') w++;
        out[b] = { same: same.winner, rounds: same.rounds, rate: Math.round(w / N * 100) };
      }
      setCompare(out);
    }, 60);
    return () => clearTimeout(t);
  }, [phase, battle, compare]);

  const nameOf = (id) => (ASSISTANT_LIST.find(a => a.id === id) || {}).name || id;
  const setSpecies = (which, idx, sp) => { const set = which === 'A' ? setSideA : setSideB; set(s => ({ ...s, species: s.species.map((x, j) => j === idx ? sp : x) })); };

  const sideEditor = (which, side, set) => {
    const total = which === 'A' ? Math.round(BASE_TOTAL * (1 + diff / 100)) : BASE_TOTAL;
    return (
      <div className={`ambw-card ${which === 'A' ? 'me' : 'foe'}`} data-ambw-side={which}>
        <div className="ambw-row">
          <img className="ambw-face" src={assistantFaceSrc(ASSISTANT_LIST.find(a => a.id === side.assistant) || ASSISTANT_LIST[0], 'normal')} alt=""/>
          <div style={{ flex: 1 }}>
            <div className="ambw-small">{which === 'A' ? '手前の助手' : '奥の助手'}・能力の合計 {total}</div>
            <select className="ambw-sel" data-ambw-assistant={which} value={side.assistant} onChange={(e) => set(s => ({ ...s, assistant: e.target.value }))}>
              {assistants.map(a => <option key={a.id} value={a.id}>{a.name}({engine.STYLES[a.id].label})</option>)}
            </select>
          </div>
        </div>
        <div className="ambw-row" style={{ marginTop: 8, alignItems: 'flex-start' }}>
          {side.species.slice(0, size).map((sp, j) => (
            <div key={j} className="ambw-slot">
              <img src={ALL_PLAYER_MONSTERS[sp].imgUrl} alt=""/>
              <select className="ambw-sel" data-ambw-species={`${which}${j}`} value={sp} onChange={(e) => setSpecies(which, j, e.target.value)}>
                {speciesIds.map(id => <option key={id} value={id}>{ALL_PLAYER_MONSTERS[id].name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  let body = null;
  if (!ready || !catalog) {
    body = <div className="ambw-card"><p className="ambw-small">{loadFailed || (engine && !engine.BALANCE) || (ready && !catalog) ? '対戦の計算を読み込めませんでした(計算の第2版がまだ入っていないか、通信が切れています)。' : '対戦の計算を読み込んでいます…'}</p></div>;
  } else if (phase === 'setup') {
    body = (
      <div data-ambw-setup>
        <div className="ambw-card">
          <div className="ambw-small">対戦の形</div>
          <div className="ambw-tabs">{[1, 2, 3].map(n => <button key={n} data-ambw-size={n} className={size === n ? 'on' : ''} onClick={() => setSize(n)}>{n} VS {n}</button>)}</div>
        </div>
        {sideEditor('B', sideB, setSideB)}
        {sideEditor('A', sideA, setSideA)}
        <div className="ambw-ctl" style={{ marginTop: 6 }}><button className="ambw-btn2" data-ambw-mirror onClick={() => setSideA(s => ({ ...s, species: sideB.species.slice() }))}>手前を奥と同じ種族にそろえる</button></div>
        <p className="ambw-small" style={{ textAlign: 'center' }}>同じ種族どうしなら、能力の形も同じになり、能力の差だけを見比べられます。</p>
        <div className="ambw-card">
          <div className="ambw-small">能力の差(手前の能力の合計を、奥よりどれだけ多くするか)</div>
          <div className="ambw-tabs">{AMBW_DIFFS.map(d => <button key={d} data-ambw-diff={d} className={diff === d ? 'on' : ''} onClick={() => setDiff(d)}>{d > 0 ? `+${d}%` : d === 0 ? '同じ' : `${d}%`}</button>)}</div>
          <div className="ambw-small" style={{ marginTop: 8 }}>能力の差の効き方</div>
          <div className="ambw-tabs">{['A', 'B', 'C'].map(b => <button key={b} data-ambw-balance={b} className={balance === b ? 'on' : ''} onClick={() => setBalance(b)}>{b}</button>)}</div>
          <div className="ambw-small" style={{ marginTop: 4 }}>{balance}: {AMBW_BALANCE_NOTE[balance]}</div>
          <div className="ambw-small" style={{ marginTop: 8 }}>使う技</div>
          <div className="ambw-tabs"><button data-ambw-techs="all" className={allTechs ? 'on' : ''} onClick={() => setAllTechs(true)}>全部の技</button><button data-ambw-techs="start" className={!allTechs ? 'on' : ''} onClick={() => setAllTechs(false)}>最初の技だけ</button></div>
          <div className="ambw-small" style={{ marginTop: 8 }}>速さ</div>
          <div className="ambw-tabs">{AMBW_SPEEDS.map(s => <button key={s.id} className={speed === s.id ? 'on' : ''} onClick={() => setSpeed(s.id)}>{s.label}</button>)}</div>
        </div>
        <div className="ambw-ctl">
          <button className="ambw-btn" data-ambw-start onClick={() => start()}>⚔ 対戦を見る(試合 {seedNo})</button>
          <button className="ambw-btn2" onClick={() => setSeedNo(n => n + 1)}>🎲 別の試合にする</button>
        </div>
        <p className="ambw-small" style={{ textAlign: 'center', marginTop: 8 }}>同じ設定・同じ試合の番号なら、何度見ても同じ結果になります。何も保存しません。</p>
      </div>
    );
  } else if (battle) {
    const log = battle.r.log, e = log[pos] || {}, f = battle.frames[pos] || battle.frames[0];
    const ended = phase === 'result';
    const mem = (side, i) => (side === 'A' ? battle.teamA : battle.teamB).members[i];
    const who = (side, i) => (mem(side, i) || {}).name || '';
    const WHY = engine.WHY || {};
    const lineOf = (x) => {
      if (!x || !x.side) return '';
      const n = who(x.side, x.i);
      if (x.ev === 'tech') return x.hit ? `${n}の ${x.name}${x.crit ? ' 会心!' : ''} → ${x.dmg}${x.guarded ? '(ガード)' : ''}` : `${n}の ${x.name} … はずれ`;
      if (x.ev === 'move') return `${n}が ${AMBW_DIST[x.to]}距離へ ${x.step > 0 ? 'さがる' : 'つめる'}`;
      if (x.ev === 'charge') return x.why === 'sulk' ? `${n}は そっぽを向いた…(ガッツだけたまった)` : `${n}は ガッツをためた`;
      if (x.ev === 'guard') return `${n}は 身を守った`;
      if (x.ev === 'swap') return `交代! ${who(x.side, x.from)} → ${n}`;
      if (x.ev === 'ko') return `${x.name} は たおれた`;
      if (x.ev === 'enter') return `${n} が出た`;
      return '';
    };
    const recent = [];
    for (let k = pos - 1; k >= 1 && recent.length < 3; k--) { const t = lineOf(log[k]); if (t) recent.unshift({ k, t, side: log[k].side, r: log[k].r }); }
    const gap = [6, 44, 92, 146][f.d] || 44;
    const foeSide = e.side === 'A' ? 'B' : 'A';
    const actor = e.side ? (ASSISTANT_LIST.find(a => a.id === (e.side === 'A' ? battle.teamA : battle.teamB).assistantId) || ASSISTANT_LIST[0]) : null;
    const fighter = (side) => {
      const i = f.act[side], m = mem(side, i), down = f.hp[side][i] <= 0;
      const acting = e.side === side && (e.ev === 'tech') ? `ambw-lunge${side}` : '';
      const hurt = e.ev === 'tech' && foeSide === side && e.hit ? 'ambw-hit' : '';
      return (
        <div key={`${side}-${pos}`} className={`ambw-f ${down ? 'down' : ''} ${acting} ${hurt}`}>
          <img className={side === 'A' ? 'ambw-flip' : ''} src={ALL_PLAYER_MONSTERS[m.species].imgUrl} alt=""/>
          <em>{m.name}</em>
          {e.ev === 'tech' && foeSide === side && (e.hit
            ? <div className="ambw-dmg">{e.crit ? <small>会心!</small> : e.guarded ? <small>ガード!</small> : null}−{e.dmg}</div>
            : <div className="ambw-dmg miss">はずれ</div>)}
        </div>
      );
    };
    const cutText = e.ev === 'tech' ? e.name : e.ev === 'move' ? (e.step > 0 ? 'さがる' : 'つめる') : e.ev === 'charge' ? 'ガッツをためる' : e.ev === 'guard' ? 'ガード' : e.ev === 'swap' ? `交代 → ${who(e.side, e.i)}` : e.ev === 'ko' ? `${e.name} たおれた` : '';
    const cutSmall = e.ev === 'tech' ? `${e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}${Number.isFinite(e.p) ? `・命中 ${Math.round(e.p)}%` : ''}` : (e.side ? who(e.side, e.ev === 'swap' ? e.from : e.i) : '');
    const kos = log.map((x, k) => x.ev === 'ko' ? { k, side: x.side } : null).filter(Boolean);
    const winName = battle.r.winner === 'draw' ? null : nameOf((battle.r.winner === 'A' ? battle.teamA : battle.teamB).assistantId);
    const tech = (side) => log.filter(x => x.ev === 'tech' && x.side === side);
    const stat = (side) => { const t = tech(side); return { n: t.length, hit: t.filter(x => x.hit).length, crit: t.filter(x => x.crit).length, dmg: t.reduce((a, x) => a + (x.dmg || 0), 0) }; };
    const sa = stat('A'), sb = stat('B');
    body = (
      <div data-ambw-watch data-ambw-pos={pos} data-ambw-phase={phase}>
        {ended && (
          <div data-ambw-result>
            <div className="ambw-res"><b>{winName ? `${winName} の勝ち!` : '引き分け'}</b><span>{battle.r.winner === 'A' ? '手前' : battle.r.winner === 'B' ? '奥' : ''}・{battle.r.rounds} ラウンド・{battle.r.reason === 'judge' ? '判定' : '全滅で決着'}・効き方 {battle.balance}・試合 {battle.seedNo}</span></div>
            <div className="ambw-card">
              <table className="ambw-tbl"><tbody>
                <tr><td>この1戦</td><td className="A">手前 {nameOf(battle.teamA.assistantId)}</td><td className="B">奥 {nameOf(battle.teamB.assistantId)}</td></tr>
                <tr><td>技が当たった</td><td className="A">{sa.hit}/{sa.n}</td><td className="B">{sb.hit}/{sb.n}</td></tr>
                <tr><td>会心</td><td className="A">{sa.crit}回</td><td className="B">{sb.crit}回</td></tr>
                <tr><td>与えたダメージ</td><td className="A">{sa.dmg}</td><td className="B">{sb.dmg}</td></tr>
              </tbody></table>
            </div>
            <div className="ambw-card" data-ambw-compare>
              <div className="ambw-small">効き方の見比べ(同じ編成・能力の差 {diff > 0 ? `+${diff}%` : diff === 0 ? 'なし' : `${diff}%`})</div>
              {!compare ? <p className="ambw-small">計算しています…</p> : ['A', 'B', 'C'].map(b => (
                <div key={b} className="ambw-k"><span>{b}: この試合は {compare[b].same === 'draw' ? '引き分け' : compare[b].same === 'A' ? '手前の勝ち' : '奥の勝ち'}</span><div className="ambw-bar pt"><i style={{ width: `${compare[b].rate}%` }}/></div><b>{compare[b].rate}%</b></div>
              ))}
              <div className="ambw-small">右の数字は、同じ編成で100戦したときに手前が勝つ割合</div>
              <div className="ambw-tabs">{['A', 'B', 'C'].map(b => <button key={b} className={battle.balance === b ? 'on' : ''} onClick={() => { setBalance(b); start(battle.seedNo, b); }}>同じ試合を {b} で見る</button>)}</div>
            </div>
            <div className="ambw-ctl">
              <button className="ambw-btn" onClick={() => start(battle.seedNo, battle.balance)}>▶ もう一度見る</button>
              <button className="ambw-btn2" onClick={() => { const n = battle.seedNo + 1; setSeedNo(n); start(n, battle.balance); }}>🎲 次の試合</button>
              <button className="ambw-btn2" data-ambw-back onClick={() => setPhase('setup')}>⚙ 設定へ</button>
            </div>
          </div>
        )}
        <AmbwPanel side="B" team={battle.teamB} frame={f} maxHp={battle.maxHp} moves={battle.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false}/>
        <div className="ambw-ring">
          <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: gap }}/>{fighter('B')}</div>
          <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
          {cutText && e.ev !== 'end' && (
            <div key={`cut-${pos}`} className={`ambw-cut ${e.ev === 'tech' ? e.kind : 'etc'} ${e.side === 'B' ? 'B' : ''}`}><small>{cutSmall}</small><b>{cutText}</b></div>
          )}
        </div>
        <AmbwPanel side="A" team={battle.teamA} frame={f} maxHp={battle.maxHp} moves={battle.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine/>
        {!ended && (
          <div className="ambw-card ambw-log">
            {recent.map(x => <p key={x.k} className={x.side}><small>R{x.r}</small>{x.t}</p>)}
            {actor && e.why && WHY[e.why] && (
              <div className="ambw-row" style={{ marginTop: 6 }}><img className="ambw-face" src={assistantFaceSrc(actor, 'normal')} alt=""/><div className="ambw-bubble">{actor.name}「{WHY[e.why]}」</div></div>
            )}
          </div>
        )}
        <div className="ambw-seek"><i style={{ width: `${Math.round(pos / Math.max(1, log.length - 1) * 100)}%` }}/>
          {kos.map(x => <button key={x.k} className={x.side} style={{ left: `${x.k / Math.max(1, log.length - 1) * 100}%` }} onClick={() => { setPos(x.k); setPaused(true); setPhase('watch'); }}>✖</button>)}
        </div>
        {!ended && (
          <div className="ambw-ctl">
            <button className="ambw-btn2" data-ambw-pause onClick={() => setPaused(p => !p)}>{paused ? '▶' : '⏸'}</button>
            {AMBW_SPEEDS.map(s => <button key={s.id} className={`ambw-sp ${speed === s.id ? 'on' : ''}`} data-ambw-speed={s.id} onClick={() => { setSpeed(s.id); setPaused(false); }}>{s.label}</button>)}
            <button className="ambw-btn2" data-ambw-skip onClick={() => { setPos(log.length - 1); setPhase('result'); }}>⏭ 結果へ</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ambw" data-ambw-root ref={rootRef}>
      <style>{AMBW_CSS}</style>
      <div className="ambw-in">
        <div className="ambw-top">
          <button className="ambw-btn2" data-ambw-close onClick={phase === 'setup' || !battle ? onClose : () => setPhase('setup')}>← {phase === 'setup' || !battle ? 'もどる' : '設定へ'}</button>
          <span>⚔ 助手マスモンの対戦(観戦の試作)</span>
          <b>{phase !== 'setup' && battle ? `ラウンド ${(battle.frames[pos] || {}).r || 0}` : '試作'}</b>
        </div>
        {body}
      </div>
    </div>
  );
}
