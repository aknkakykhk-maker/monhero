// ===== モンヒロサクセスの大会の「見せる」部品(2026-11-12 バトル部) =====
// 社長の決め: 大会で戦うのは基本1戦。組み合わせ表(トーナメント)とほかの試合は演出(TOURNAMENT.md §9・§15)。
// 見本: docs/progress/player-raise/mock/png/v3-phone-B1(組み合わせ表)・C2(バトルカード)・Y2(特別な1話のカットイン)・B2(優勝)・C4(負け)
//
// ★ここは「見せる」だけ。大会の流れ(いつ大会が立つ・settle・保存)は回3の画面が持つ。ここは何も保存しない。
// ★公開の印は持たない(回3の画面の印の後ろでだけ開く)。プレイヤー向けの文に敵の数字は書かない。
// ★試合は助手マスモン対戦の芯(data/assistant-masmon-battle.js)で1戦だけ回す。観戦は 56-assistant-masmon-battle-view.jsx の部品
//   (ambwLoadEngine・ambwTechTable・ambwFramesOf・ambwIsHighlight・AMBW_CSS・AMBW_SPEEDS・AMBW_DIST)を使い回す。
//   乱数の種は育成の id + ターン + 大会 + 再戦の回数で決まるので、「結果だけ見る」でも観戦しても、中断して続けても同じ結果になる。
//
// 回3から呼ぶ口:
//   <MonsucCupShow suc={SUC} s={state} me={{ name }} settle={(won) => out} onRematch={(item) => …} onNext={(out) => …} onClose={() => …}/>
//     s.battle が立っている状態で開く。組み合わせ表 → バトルカード → (特別な1話のカットイン) → 試合 → 優勝 / 負け の順に見せる。
//     勝ったら settle(true) を呼んで出てきた out(賞金・チケットなど)で優勝の画面を出し、「次へ」で onNext(out)。
//     負けたら やり直し(onRematch('sand' | 'rainbow'))か あきらめる(settle(false) → onNext(out))。
//     onRematch のあと新しい s を渡し直すと、組み合わせ表から始め直す(key に s.battle.again・reroll を使う)。
//   追加の口(2026-11-12 窓口「試合の計算は回3の msxR3Fight を正に」): fight={(s) => ({ won, r?, teamA?, teamB? })} を渡すと、その結果を使う
//     (r.log と teamA・teamB があれば観戦で再生・無ければ勝ち負けだけ)。opp={{ loy, pop, … }} で相手の値を上書き(バトルカードに人気・忠誠を出す)。
//   自分で操作する試合(2026-11-12 社長「モンサクは自分操作にして」): fight の返り値に input(simulate に渡したのと同じ入力 { seed, catalog, teamA, teamB, buffs? })
//     があれば、試合は MonsucArena(56-monhero-success-arena.jsx)で自分で手を選ぶ(オートにもできる)。勝ち負けは自分で戦った結果で決まる。
//     fight を渡さないときも、こちらで input を作って自分で操作する。autoOnly を渡すと(ランキング・フレンド対戦)オートの記録を見せるだけ。
//   monsucCupMatch(engine, catalog, suc, s, me) → { r, teamA, teamB, buffs, seed }   … 試合だけ回す(画面なし・スキップ用)
//   monsucCupInfo(suc, s, me) → { title, venue, bracket, opp, me, mods, buffs, seed } … 画面に要るものをまとめる(純粋)
//   部品だけ使うとき: MonsucBracket / MonsucBattleCard / MonsucArena / MonsucCutin / MonsucCupWin / MonsucCupLose

const MSC_STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const MSC_STAT_JP = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
const MSC_STAT_ICON = Object.freeze({ life: '❤️', pow: '💪', wise: '🧠', hit: '🎯', eva: '💨', tough: '🛡️' });
const MSC_STARS = (n) => (n >= 4 ? '👑' : '★'.repeat(Math.max(1, Math.min(3, n || 1))));
const MSC_VENUE_IMG = Object.freeze({
  debut: 'images/success/scenes/venue-debut.png', cup: 'images/success/scenes/venue-cup.png',
  hero: 'images/success/scenes/venue-hero.png', summit: 'images/success/scenes/venue-summit.png',
});
// 特別な1話の効き目(芯 ASST_STORY[aid].special)→ 対戦の芯の上乗せ(buffs)と、カットインの見え方
const MSC_SPECIAL = Object.freeze({
  mua: { word: '声援!', sub: 'みんなの声が 届いた' },
  atsu: { word: '気合!', sub: 'あつの特別な1話の効き目が かがやいた' },
  kiki: { word: '集中!', sub: 'ききの特別な1話の効き目が かがやいた' },
  momosuke: { word: '見せ場!', sub: 'ももすけの特別な1話の効き目が かがやいた' },
  dra: { word: '直伝!', sub: 'ドラの特別な1話の効き目が かがやいた' },
  kyuko: { word: '見切り!', sub: 'きゅうこの特別な1話の効き目が かがやいた' },
  sorashido: { word: '計算どおり!', sub: 'ソラシドの特別な1話の効き目が かがやいた' },
  erubin: { word: '見守り!', sub: 'エルビンの特別な1話の効き目が かがやいた' },
});
const MSC_LINE = Object.freeze({
  mua: '「みんな見てるよ! いつもどおりで だいじょうぶ!」', atsu: '「最初から全開でいけ!」', kiki: '「そのまま、まっすぐ…!」',
  momosuke: '「ここが見せ場だよ! いちばん目立っちゃお!」', dra: '「教えたとおりに。おまえならできる」', kyuko: '「相手の動き、もう見えてるよ」',
  sorashido: '「計算どおりっす! 落ち着いていきましょう!」', erubin: '「ちゃんと見てるからね」',
});

// 特別な1話の効き目を、対戦の芯の上乗せと説明の行に直す(芯の BUFF_LIMITS の中に収める)
const monsucBuffsOf = (mods) => {
  const m = mods && typeof mods === 'object' ? mods : {};
  const buffs = {}; const rows = [];
  // 芯は対戦の芯の形(hit1・crit・eva は 0〜1・missCut・noSulk)で渡す。前の形(firstHit・crit・eva は %・techFail・noIdle)も読む
  const frac = (v) => (Number.isFinite(v) && v > 0 ? (v > 1 ? v / 100 : v) : 0);
  if (Number.isFinite(m.guts) && m.guts > 0) { buffs.guts = m.guts; rows.push(`試合のはじめから ガッツ +${m.guts}`); }
  const hit1 = frac(m.hit1) || frac(m.firstHit); if (hit1) { buffs.hit1 = hit1; rows.push('最初の技が 当たりやすい'); }
  const crit = frac(m.crit); if (crit) { buffs.crit = crit; rows.push('会心が 出やすい'); }
  const eva = frac(m.eva); if (eva) { buffs.eva = eva; rows.push('相手の技を かわしやすい'); }
  const miss = frac(m.missCut) || (Number.isFinite(m.techFail) && m.techFail < 0 ? Math.min(1, -m.techFail / 100) : 0); if (miss) { buffs.missCut = miss; rows.push('技の はずれが 減る'); }
  if (m.noSulk || m.noIdle) { buffs.noSulk = true; rows.push('そっぽを 向かない'); }
  if (m.noInjury) rows.push('この試合では けがをしない');
  if (m.showFirst) rows.push('相手の 最初の手が 見える');
  if (m.line) rows.push('声援で 気持ちが落ち着く');
  return { buffs: Object.keys(buffs).length ? buffs : null, rows };
};

const mscNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const mscMonName = (sp) => ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[sp]) ? ALL_PLAYER_MONSTERS[sp].name : sp) || '';
const mscMonImg = (sp) => ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[sp]) ? ALL_PLAYER_MONSTERS[sp].imgUrl : '') || '';
const mscAssistant = (id) => (typeof ASSISTANT_LIST !== 'undefined' ? (ASSISTANT_LIST.find(a => a.id === id) || ASSISTANT_LIST[0]) : null);
const mscFace = (id, ex) => { const a = mscAssistant(id); return a && typeof assistantFaceSrc === 'function' ? assistantFaceSrc(a, ex || 'normal') : ''; };

// 大会の名前と会場(芯の battle から)
const monsucCupTitle = (suc, s) => {
  const b = s && s.battle; if (!b) return { name: '大会', star: 1, venue: 'cup' };
  if (b.kind === 'summit') return { name: (suc.SUMMIT[b.round] || {}).name || '頂への道', star: 4, venue: 'summit' };
  if (b.kind === 'cup') {
    const list = typeof suc.cupsOf === 'function' ? (() => { try { return suc.cupsOf({ ...s, battle: null, over: null }); } catch (_) { return []; } })() : [];
    const hit = list.find(c => c.id === b.id);
    const name = hit ? hit.name : (typeof globalThis !== 'undefined' && globalThis.MONSUC_REGULAR_CUPS && globalThis.MONSUC_REGULAR_CUPS[b.sys]) || '大会';
    return { name, star: b.star, venue: String(b.sys || '').startsWith('hero') || b.star >= 4 ? 'hero' : 'cup' };
  }
  const f = suc.FORCED[b.kind] || {};
  return { name: f.name || '大会', star: f.star || 1, venue: b.kind === 'debut' ? 'debut' : 'cup' };
};

// 画面に要るもの(純粋)。me は { name } を渡せる(無ければ種の名前)
const monsucCupInfo = (suc, s, me) => {
  const b = s.battle || {};
  const t = monsucCupTitle(suc, s);
  const opp = (suc.opponents(s) || [])[0] || null;
  const bracket = suc.bracketOf(s);
  const mods = typeof suc.battleMods === 'function' ? suc.battleMods(s) : {};
  const { buffs, rows } = monsucBuffsOf(mods);
  const seed = ['monsuc', s.id, s.turn, b.kind, b.id || '', b.round || 0, b.retry || 0, b.again || 0, b.reroll || 0].join('|');
  const meName = (me && me.name) || mscMonName(s.species);
  return { title: t.name, star: t.star, venue: t.venue, bracket, opp, mods, buffs, buffRows: rows, seed, meName, rival: Boolean(opp && opp.rival), champ: Boolean(opp && opp.champ) };
};

// 対戦の芯の入力に直す(育てる子 = 手前 A・相手 = 奥 B)
const monsucTeams = (catalog, suc, s, info) => {
  const loy = typeof suc.loyalOf === 'function' ? suc.loyalOf(s) : 100;
  const mine = { species: s.species, name: info.meName, lv: mscNum(s.lv, 1), stats: s.stats, ...(typeof suc.aptSendOf === 'function' ? { aptUp: suc.aptSendOf(s) } : {}), techs: Array.isArray(s.techs) ? s.techs.slice() : undefined, mastery: s.mastery || {}, loy, pop: mscNum(s.pop) };
  const o = info.opp || { species: s.species, stats: s.stats, techs: 2, mastery: 20, tactics: 10 };
  const all = (catalog && catalog.species[o.species] && catalog.species[o.species].techs) || [];
  const n = Math.max(1, mscNum(o.techs, 2));
  const techs = all.slice(0, n).map(t => t.id);
  const mastery = {}; techs.forEach(id => { mastery[id] = mscNum(o.mastery, 0); }); ['guard', 'dist', 'swap'].forEach(k => { mastery[k] = mscNum(o.mastery, 0); });
  // 相手の忠誠度・人気は芯(回3の流れ・opp)の値を使う。無ければ今までの決まった値
  const foe = { species: o.species, name: o.name || mscMonName(o.species), lv: 30, stats: o.stats, techs, mastery,
    loy: Number.isFinite(Number(o.loy)) && o.loy != null ? Math.max(0, Math.min(100, Number(o.loy))) : 100,
    pop: Number.isFinite(Number(o.pop)) && o.pop != null ? Math.max(0, Math.min(100, Number(o.pop))) : o.champ ? 60 : o.rival ? 50 : 30 };
  const tac = mscNum(o.tactics, 20);
  return { teamA: { assistantId: s.aid, tactics: tac, members: [mine] }, teamB: { assistantId: 'atsu', tactics: tac, members: [foe] } };
};

// 試合を1戦だけ回す(画面なし)。結果だけ見る・スキップ・観戦のどれでも同じ記録になる
const monsucCupMatch = (engine, catalog, suc, s, me, info0) => {
  const info = info0 || monsucCupInfo(suc, s, me);   // info0: 入れ物が opp・title を上書きした値(相手の忠誠度・人気をそろえる)
  const { teamA, teamB } = monsucTeams(catalog, suc, s, info);
  const r = engine.simulate({ seed: info.seed, catalog, teamA, teamB, balance: 'A', trace: true, ...(info.buffs ? { buffs: { A: info.buffs } } : {}) });
  return { r, teamA, teamB, buffs: info.buffs, seed: info.seed, info };
};

// 組み合わせ表の人気の番号(王者 1・ライバル 2・ほかは決まった乱数)。見せるだけ
const monsucPopOrder = (suc, s, entrants) => {
  const rng = suc.rngOf(s.id, s.turn, 'pop');
  const score = entrants.map((e, i) => ({ i, v: e.champ ? 1000 : e.rival ? 900 : e.you ? 200 + mscNum(s.pop) * 5 : rng() * 600 }));
  const order = score.slice().sort((a, b) => b.v - a.v);
  const no = []; order.forEach((x, k) => { no[x.i] = k + 1; });
  return no;
};

const MSC_CSS = `
.msc-root{position:fixed;inset:0;z-index:9000;overflow-y:auto;color:#fff;background:linear-gradient(180deg,#221a44,#141026 45%);
  padding:calc(8px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));font-family:inherit}
.msc-wrap{max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:8px;min-height:100%}
.msc-top{display:flex;align-items:center;gap:8px}
.msc-top b{flex:1;min-width:0;font-size:14px;color:#fde68a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msc-btn{border:0;border-radius:999px;padding:12px 14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 3px 0 #9d174d;cursor:pointer;min-height:44px}
.msc-btn.y{background:#fde047;color:#3b2a05;box-shadow:0 3px 0 #a16207}
.msc-btn.g{background:#334155;box-shadow:0 3px 0 #0f172a;color:#e2e8f0}
.msc-btn.s{padding:8px 12px;font-size:13px;min-height:36px}
.msc-foot{display:flex;gap:8px;margin-top:auto;padding-top:6px}
.msc-foot>*{flex:1}
.msc-panel{border-radius:16px;overflow:hidden;background:#f6ead0;color:#3b2a14;box-shadow:0 4px 0 rgba(0,0,0,.35)}
.msc-head{background:linear-gradient(180deg,#7c4a1e,#5a3313);color:#fde68a;text-align:center;font-weight:900;padding:7px 8px;font-size:14px;letter-spacing:.04em}
.msc-bk{position:relative;padding:8px 6px 10px 8px}
.msc-row{position:relative;display:flex;align-items:center;gap:5px;height:40px;transition:opacity .4s}
.msc-row.out{opacity:.45}
.msc-no{flex:0 0 auto;width:22px;height:22px;border-radius:6px;background:#fff;border:2px solid #d6a45a;color:#b45309;font-weight:900;font-size:13px;display:grid;place-items:center}
.msc-name{flex:1 1 auto;width:auto;min-width:0;margin-right:6px;height:26px;border-radius:7px;background:#fffaf0;border:1.5px solid #e2c89a;display:flex;align-items:center;gap:4px;padding:0 6px;font-weight:800;font-size:13px}
.msc-name span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msc-name.you{background:#fde68a;border-color:#f59e0b}
.msc-name.foe{background:#fecdd3;border-color:#fb7185}
.msc-tag{flex:0 0 auto;font-size:9.5px;font-weight:900;color:#fff;border-radius:5px;padding:1px 4px;background:#9a3412}
.msc-tag.you{background:#f59e0b}.msc-tag.rv{background:#e11d48}.msc-tag.ch{background:#7c2d12}
.msc-face{flex:0 0 auto;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #e5e7eb;overflow:hidden;display:grid;place-items:center;margin-left:auto}
.msc-face.you,.msc-face.foe{border-color:#f43f5e;box-shadow:0 0 0 2px #fecdd3}
.msc-face img{width:120%;height:120%;object-fit:contain}
.msc-lines{position:absolute;top:8px;bottom:10px;right:6px;pointer-events:none}
.msc-lines path{fill:none;stroke-linecap:round}
.msc-lines .base{stroke:#cbb48b;stroke-width:2}
.msc-lines .win{stroke:#f97316;stroke-width:3.2;stroke-dasharray:1;stroke-dashoffset:1;animation:msc-draw .55s ease-out forwards}
.msc-lines .win.me{stroke:#f43f5e}
@keyframes msc-draw{to{stroke-dashoffset:0}}
.msc-cupbadge{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:48px;padding:6px 0;border-radius:10px;background:linear-gradient(180deg,#7f1d1d,#4c0519);border:2px solid #f59e0b;color:#fde68a;font-weight:900;font-size:11px;text-align:center;line-height:1.2}
.msc-cupbadge.lit{animation:msc-glow 1.2s ease-in-out infinite alternate}
@keyframes msc-glow{from{box-shadow:0 0 0 rgba(251,191,36,0)}to{box-shadow:0 0 16px rgba(251,191,36,.9)}}
.msc-note{font-size:12px;color:#fde68a;line-height:1.5}
.msc-note small{display:block;color:#cbd5e1;font-size:11px}
.msc-talk{display:flex;gap:8px;align-items:flex-start;background:#fffaf0;color:#3b2a14;border-radius:14px;padding:8px 10px;border:2px solid #e2c89a}
.msc-talk img{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:#fde68a}
.msc-talk p{margin:0;font-size:13px;font-weight:700;line-height:1.55}
.msc-talk em{font-style:normal;color:#e11d48}
.msc-vs{position:relative;height:200px;border-radius:16px;overflow:hidden;background:#3b2a52 center/cover no-repeat}
.msc-vs::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,38,.25),rgba(20,16,38,.05) 50%,rgba(20,16,38,.75))}
.msc-vs .cap{position:absolute;z-index:2;top:6px;left:50%;transform:translateX(-50%);background:rgba(20,16,38,.8);border-radius:999px;padding:3px 12px;font-size:12px;font-weight:900;color:#fde68a;white-space:nowrap}
.msc-vs .mon{position:absolute;z-index:1;bottom:26px;width:44%;height:150px;display:flex;align-items:flex-end;justify-content:center}
.msc-vs .mon img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45))}
.msc-vs .mon.a{left:2%;animation:msc-inL .5s ease-out both}.msc-vs .mon.b{right:2%;animation:msc-inR .5s ease-out both}
.msc-vs .mon.a img{transform:scaleX(-1)}
@keyframes msc-inL{from{transform:translateX(-60%);opacity:0}}@keyframes msc-inR{from{transform:translateX(60%);opacity:0}}
.msc-vs .vs{position:absolute;z-index:2;left:50%;top:48%;transform:translate(-50%,-50%);font-size:44px;font-weight:900;font-style:italic;color:#e0e7ff;text-shadow:0 3px 0 #312e81,0 0 14px rgba(129,140,248,.8);animation:msc-pop .5s .35s ease-out both}
@keyframes msc-pop{from{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
.msc-vs .nm{position:absolute;z-index:2;bottom:4px;display:flex;align-items:center;gap:4px;background:rgba(20,16,38,.85);border-radius:8px;padding:2px 8px;font-size:12.5px;font-weight:900;max-width:48%}
.msc-vs .nm span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msc-vs .nm.a{left:6px}.msc-vs .nm.b{right:6px}
.msc-tabs{display:flex;gap:6px}
.msc-tabs button{flex:1;border:2px solid #475569;border-radius:999px;background:transparent;color:#e2e8f0;font-weight:900;font-size:13px;padding:7px 0;cursor:pointer;min-height:36px}
.msc-tabs button.on{background:#fde047;border-color:#fde047;color:#3b2a05}
.msc-sheet{background:rgba(15,12,34,.85);border:1.5px solid #3f3a6b;border-radius:14px;padding:10px 8px}
.msc-st{display:grid;grid-template-columns:34px 1fr 74px 1fr 34px;align-items:center;gap:4px;height:30px;font-size:12.5px}
.msc-st b{text-align:center;font-weight:900;color:#cbd5e1}.msc-st b.up{color:#fde047}
.msc-st .lab{text-align:center;font-size:11.5px;font-weight:800;color:#e2e8f0;white-space:nowrap}
.msc-bar{height:9px;border-radius:5px;background:#1e1b3a;overflow:hidden;position:relative}
.msc-bar i{position:absolute;top:0;bottom:0;border-radius:5px;transform:scaleX(0);animation:msc-grow .8s ease-out forwards}
.msc-bar.l i{right:0;background:linear-gradient(90deg,#f472b6,#fb923c);transform-origin:right}
.msc-bar.r i{left:0;background:linear-gradient(90deg,#60a5fa,#3b82f6);transform-origin:left}
.msx .msc-st b.up{position:static;font-size:inherit;text-shadow:none;white-space:nowrap;color:#fde047}
.msx .msc-btn{border-radius:999px;padding:12px 14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 3px 0 #9d174d;min-height:44px;text-align:center}
.msx .msc-btn.y{background:#fde047;color:#3b2a05;box-shadow:0 3px 0 #a16207}
.msx .msc-btn.g{background:#334155;box-shadow:0 3px 0 #0f172a;color:#e2e8f0}
.msx .msc-btn.s{padding:8px 12px;font-size:13px;min-height:36px}
@keyframes msc-grow{to{transform:scaleX(1)}}
.msc-apt{display:flex;gap:3px;justify-content:center}
.msc-apt span{width:21px;height:21px;border-radius:6px;display:grid;place-items:center;font-size:11px;font-weight:900;background:#1e293b;color:#64748b}
.msc-apt span.S,.msc-apt span.A{background:#fde047;color:#3b2a05}.msc-apt span.B{background:#be123c;color:#fff}.msc-apt span.C{background:#4c1d95;color:#ddd6fe}
.msc-aptrow{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:6px}
.msc-aptrow .lab{font-size:11.5px;font-weight:800;color:#e2e8f0;white-space:nowrap}
.msc-tl{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.msc-tl div{display:flex;flex-direction:column;gap:4px}
.msc-tl span{display:block;border-radius:8px;padding:5px 7px;background:#1e1b3a;font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msc-tl small{color:#94a3b8;font-size:10.5px;margin-left:4px}
.msc-hint{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:800;color:#fff}
.msc-hint img{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto}
.msc-hint em{font-style:normal;color:#fde047}
.msc-stage{position:relative;border-radius:16px;overflow:hidden;background:#2a2147 center/cover no-repeat}
.msc-stage .ambw-ring{background:linear-gradient(180deg,rgba(20,16,38,.15),rgba(20,16,38,.55))}
.msc-mp{border-radius:12px;padding:7px 9px;background:rgba(15,12,34,.88);border:1.5px solid #3f3a6b}
.msc-mp.a{border-color:#f472b6}.msc-mp.b{border-color:#60a5fa}
.msc-mp .h{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:900;min-width:0}
.msc-mp .h span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.msc-mp .h small{color:#94a3b8;font-size:10.5px;font-weight:700}
.msc-mp .h img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.msc-mp .bars{display:flex;align-items:center;gap:6px;margin-top:4px}
.msc-mp .bars>div{flex:1}
.msc-mp .num{font-size:12px;font-weight:900;text-align:right;min-width:62px}
.msc-mp .num small{color:#94a3b8;font-size:10px}
.msc-buff{display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding:1px 6px;border-radius:999px;background:#fde047;color:#3b2a05;font-size:10px;font-weight:900}
.msc-speed{display:flex;gap:5px}
.msc-speed button{flex:1;border:1.5px solid #475569;border-radius:999px;background:transparent;color:#e2e8f0;font-size:12px;font-weight:900;padding:6px 0;min-height:34px;cursor:pointer}
.msc-speed button.on{background:#a5f3fc;color:#0c4a6e;border-color:#a5f3fc}
.msc-end{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(10,8,24,.45);font-size:46px;font-weight:900;letter-spacing:.06em;animation:msc-fade .35s ease-out both}
.msc-end.w{color:#fde047;text-shadow:0 4px 0 #9a3412,0 0 18px rgba(251,191,36,.9)}
.msc-end.l{color:#cbd5e1;text-shadow:0 4px 0 #1e293b}
@keyframes msc-fade{from{opacity:0;transform:scale(1.3)}}
.msc-hero{position:relative;flex:1 1 auto;min-height:330px;border-radius:16px;overflow:hidden;background:#3b2a52 center/cover no-repeat}
.msc-rays{position:absolute;inset:-40%;background:repeating-conic-gradient(from 0deg,rgba(253,224,71,.38) 0 9deg,rgba(253,186,116,.08) 9deg 18deg);animation:msc-spin 14s linear infinite}
.msc-hero.lose .msc-rays{display:none}
.msc-hero.lose::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(15,23,42,.55),rgba(15,23,42,.8))}
@keyframes msc-spin{to{transform:rotate(360deg)}}
.msc-hero .big{position:absolute;z-index:3;left:0;right:0;top:14px;text-align:center;font-size:54px;font-weight:900;letter-spacing:.06em;animation:msc-fade .5s ease-out both}
.msc-hero.win .big{color:#fde047;-webkit-text-stroke:2px #9a3412;text-shadow:0 5px 0 #7c2d12,0 0 22px rgba(251,191,36,.85)}
.msc-hero.lose .big{color:#e2e8f0;-webkit-text-stroke:1.5px #334155;text-shadow:0 4px 0 #0f172a;transform:rotate(-6deg);font-size:46px}
.msc-hero .sub{position:absolute;z-index:3;left:8px;right:8px;top:84px;text-align:center;font-size:13px;font-weight:900;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.8)}
.msc-hero .who{position:absolute;z-index:2;left:50%;bottom:58px;transform:translateX(-50%);width:62%;height:56%;display:flex;align-items:flex-end;justify-content:center}
.msc-hero .who img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 8px 8px rgba(0,0,0,.5))}
.msc-hero.win .who{height:46%}
.msc-hero.win .who img{animation:msc-hop 1.1s ease-in-out infinite}
.msc-hero.lose .who img{filter:grayscale(.65) brightness(.8) drop-shadow(0 8px 8px rgba(0,0,0,.5))}
@keyframes msc-hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-14px)}}
.msc-hero .rival{position:absolute;z-index:3;left:8px;right:8px;bottom:10px;display:flex;align-items:center;gap:6px;border-radius:999px;background:rgba(76,5,25,.9);border:1.5px solid #fb7185;padding:5px 10px;font-size:12.5px;font-weight:900}
.msc-hero .rival span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msc-hero .rival em{font-style:normal;background:#fde047;color:#3b2a05;border-radius:999px;padding:1px 8px;font-size:11px}
.msc-rw{display:flex;align-items:center;gap:8px;border-radius:12px;background:rgba(15,12,34,.88);border:1.5px solid #3f3a6b;padding:9px 10px;font-size:13px;font-weight:800;animation:msc-fade .35s ease-out both}
.msc-rw .i{font-size:20px;width:26px;text-align:center}
.msc-rw .k{flex:0 0 auto;min-width:72px}
.msc-rw .v{flex:1;min-width:0;color:#e2e8f0;font-size:12.5px}
.msc-rw.big{background:linear-gradient(90deg,rgba(161,98,7,.55),rgba(15,12,34,.88));border-color:#fde047}
.msc-again{border-radius:16px;background:rgba(15,12,34,.92);border:1.5px solid #3f3a6b;padding:10px;display:flex;flex-direction:column;gap:7px}
.msc-again h3{margin:0;text-align:center;font-size:15px;font-weight:900}
.msc-again p{margin:0;text-align:center;font-size:11.5px;color:#cbd5e1}
.msc-again p em{font-style:normal;color:#fde047;font-weight:900}
.msc-pick{display:flex;align-items:center;gap:8px;border:0;border-radius:12px;padding:9px 10px;color:#fff;font-weight:900;font-size:14px;text-align:left;cursor:pointer;min-height:48px}
.msc-pick img{width:30px;height:30px;object-fit:contain;flex:0 0 auto}
.msc-pick small{display:block;font-size:11px;font-weight:700;opacity:.9}
.msc-pick.sand{background:linear-gradient(90deg,#ea580c,#f59e0b)}
.msc-pick.rain{background:linear-gradient(90deg,#be185d,#6d28d9,#2563eb)}
.msc-pick.quit{background:#334155;justify-content:center;font-size:13px}
.msc-pick:disabled{opacity:.4;cursor:default}
.msc-cut{position:relative;flex:1 1 auto;min-height:380px;border-radius:16px;overflow:hidden;background:#3b2a52 center/cover no-repeat}
.msc-cut .word{position:absolute;z-index:3;left:0;right:0;top:20px;text-align:center;font-size:56px;font-weight:900;color:#fde047;-webkit-text-stroke:2px #9a3412;text-shadow:0 5px 0 #7c2d12,0 0 22px rgba(251,191,36,.9);animation:msc-fade .45s ease-out both}
.msc-cut .sub{position:absolute;z-index:3;left:8px;right:8px;top:94px;text-align:center;font-size:13px;font-weight:900;text-shadow:0 2px 3px rgba(0,0,0,.85)}
.msc-cut .duo{position:absolute;z-index:2;left:0;right:0;bottom:80px;height:52%;display:flex;align-items:flex-end;justify-content:center;gap:2%}
.msc-cut .duo img{max-width:46%;max-height:100%;object-fit:contain;filter:drop-shadow(0 8px 8px rgba(0,0,0,.5))}
.msc-cut .duo img.a{transform:scaleX(-1);filter:drop-shadow(0 0 14px rgba(253,224,71,.95)) drop-shadow(0 8px 8px rgba(0,0,0,.5))}
.msc-cut .say{position:absolute;z-index:3;left:8px;right:8px;bottom:8px;display:flex;align-items:center;gap:8px;border-radius:14px;background:rgba(15,12,34,.9);border:1.5px solid #fde047;padding:6px 10px}
.msc-cut .say img{width:50px;height:50px;border-radius:50%;object-fit:cover;flex:0 0 auto;border:2px solid #fde047}
.msc-cut .say b{display:block;font-size:11px;color:#fde047}
.msc-cut .say p{margin:0;font-size:13.5px;font-weight:800}
.msc-eff{border-radius:12px;background:rgba(15,12,34,.88);border:1.5px solid #3f3a6b;padding:8px 10px;font-size:12px;display:grid;grid-template-columns:auto 1fr;gap:4px 10px}
.msc-eff b{color:#fbcfe8;white-space:nowrap}
@media (orientation:landscape) and (max-height:520px){
  .msc-wrap{max-width:760px}
  .msc-hero,.msc-cut{min-height:260px}
  .msc-hero .who{height:50%}
  .msc-cut .duo{bottom:70px;height:46%}
  .msc-vs{height:170px}.msc-vs .mon{height:120px}
}
@media (max-width:340px){
  .msc-name{font-size:12px}
  .msc-tag{font-size:8.5px;padding:1px 3px}
  .msc-st{grid-template-columns:30px 1fr 64px 1fr 30px;font-size:12px}
  .msc-hero .big,.msc-cut .word{font-size:46px}
}
`;

// ---- 組み合わせ表(B1)。勝ち上がりの線が段ごとに伸びる。result が 'win' なら決勝の線が優勝まで伸びる ----
function MonsucBracket({ suc, s, info, result, onFight, onResultOnly, onClose, canSkip }) {
  const bk = info.bracket;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const ts = [setTimeout(() => setStage(1), 350), setTimeout(() => setStage(2), 1050), setTimeout(() => setStage(3), 1700)];
    return () => ts.forEach(clearTimeout);
  }, []);
  if (!bk) return null;
  const E = bk.entrants;
  const no = monsucPopOrder(suc, s, E);
  const r1 = bk.rounds[0] || []; const r2 = bk.rounds[1] || [];
  const out = (i) => (stage >= 1 && !r1.includes(i)) || (stage >= 2 && r1.includes(i) && !r2.includes(i)) || (result === 'win' && i === 4) || (result === 'lose' && i === 0);
  // 線: 8行 × 40px。x は 0(顔の右)→ 22 → 44 → 66 → 優勝の札
  const H = 40; const yOf = (i) => i * H + H / 2;
  const X = [0, 22, 44, 66, 80];
  const W = 84;
  const pair = (a, b, lv) => `M${X[lv]} ${a}H${X[lv + 1]}M${X[lv]} ${b}H${X[lv + 1]}M${X[lv + 1]} ${a}V${b}`;
  const base = [];
  for (let k = 0; k < 4; k++) base.push(pair(yOf(2 * k), yOf(2 * k + 1), 0));
  const mid1 = [0, 1, 2, 3].map(k => (yOf(2 * k) + yOf(2 * k + 1)) / 2);
  base.push(pair(mid1[0], mid1[1], 1), pair(mid1[2], mid1[3], 1));
  const mid2 = [(mid1[0] + mid1[1]) / 2, (mid1[2] + mid1[3]) / 2];
  base.push(pair(mid2[0], mid2[1], 2));
  const mid3 = (mid2[0] + mid2[1]) / 2;
  base.push(`M${X[3]} ${mid3}H${X[4]}`);
  const win = [];
  if (stage >= 1) r1.forEach((i, k) => win.push({ d: `M${X[0]} ${yOf(i)}H${X[1]}V${mid1[k]}`, me: i === 0 || i === 4, key: `a${i}` }));
  if (stage >= 2) r2.forEach((i, k) => win.push({ d: `M${X[1]} ${mid1[k * 2 + (i === r1[k * 2] ? 0 : 1)]}H${X[2]}V${mid2[k]}`, me: true, key: `b${i}` }));
  if (stage >= 3) { win.push({ d: `M${X[2]} ${mid2[0]}H${X[3]}`, me: true, key: 'c0' }, { d: `M${X[2]} ${mid2[1]}H${X[3]}`, me: true, key: 'c1' }); }
  if (result === 'win') win.push({ d: `M${X[3]} ${mid2[0]}V${mid3}H${X[4]}`, me: true, key: 'f' });
  const champ = E.find(e => e.champ) || E[4];
  const foe = E[4];
  const nm = (e) => (e.you ? info.meName : e.name || mscMonName(e.species));
  const coach = mscAssistant(s.aid);
  const champNo1 = no[E.indexOf(champ)] === 1;
  const line = foe.rival
    ? <>「{champNo1 && champ !== foe ? <>1番人気は 王者の {nm(champ)}! でも、</> : null}{info.meName}の相手は <em>ライバルの {nm(foe)}</em> だよ。勝てば ごほうび大!」</>
    : foe.champ
      ? <>「1番人気は 王者の <em>{nm(foe)}</em>! {info.meName}が当たるのは 決勝。{info.opp && info.opp.note ? `${info.opp.note}、だって。` : ''}ここで勝てば 大金星だよ!」</>
      : <>「{info.meName}の相手は <em>{nm(foe)}</em>! あわてずに いこうね」</>;
  return (
    <div className="msc-wrap" data-msc-bracket data-msc-stage={stage}>
      <div className="msc-top"><button className="msc-btn g s" data-msc-close onClick={onClose}>← もどる</button><b>{info.title} {MSC_STARS(info.star)}</b></div>
      <div className="msc-panel">
        <div className="msc-head">{info.title} {MSC_STARS(info.star)}</div>
        <div className="msc-bk">
          {E.map((e, i) => (
            <div key={i} className={`msc-row ${out(i) ? 'out' : ''}`} style={{ paddingRight: W }} data-msc-entrant={e.you ? 'you' : i === 4 ? 'foe' : i}>
              <span className="msc-no">{no[i]}</span>
              <span className={`msc-name ${e.you ? 'you' : i === 4 ? 'foe' : ''}`}><span>{nm(e)}</span>
                {e.you && <i className="msc-tag you">あなた</i>}
                {e.rival && <i className="msc-tag rv">ライバル</i>}
                {e.champ && <i className="msc-tag ch">👑王者</i>}
              </span>
              <span className={`msc-face ${e.you ? 'you' : i === 4 ? 'foe' : ''}`}><img src={mscMonImg(e.species)} alt=""/></span>
            </div>
          ))}
          <svg className="msc-lines" width={W} height={H * 8} viewBox={`0 0 ${W} ${H * 8}`} style={{ width: W, height: H * 8 }}>
            {base.map((d, k) => <path key={k} className="base" d={d}/>)}
            {win.map(w => <path key={w.key} className={`win ${w.me ? 'me' : ''}`} d={w.d} pathLength="1"/>)}
          </svg>
          <div className={`msc-cupbadge ${result === 'win' ? 'lit' : ''}`} style={{ right: 4 }}>🏆<br/>優勝</div>
        </div>
      </div>
      <div className="msc-note">あなたの1戦は 赤い丸の2体のあいだ({info.meName} VS {nm(foe)})。<small>ほかの試合の結果は、見せるだけの演出です</small></div>
      <div className="msc-talk"><img src={mscFace(s.aid)} alt=""/><p>{coach ? <b style={{ display: 'block', fontSize: 11, color: '#b45309' }}>解説 {coach.name}</b> : null}{line}</p></div>
      <div className="msc-foot">
        <button className="msc-btn y s" data-msc-quick onClick={onResultOnly}>{canSkip ? '⏩ 結果だけ見る(優勝ずみ)' : '⏩ 結果だけ見る'}</button>
        <button className="msc-btn" data-msc-go onClick={onFight}>⚔ 1戦へ</button>
      </div>
    </div>
  );
}

// ---- バトルカード(C2)。2体と VS・タブ・6能力の棒が伸びる ----
function MonsucBattleCard({ suc, s, info, catalog, onReady, onResultOnly, onBack }) {
  const [tab, setTab] = useState('st');
  const o = info.opp || {};
  const me = s.stats || {}; const op = o.stats || {};
  const mx = Math.max(1, ...MSC_STAT_KEYS.map(k => Math.max(mscNum(me[k]), mscNum(op[k])))) * 1.08;
  const venue = MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup;
  const aptOf = (sp, me) => (me && typeof suc.aptGradesOf === 'function' ? suc.aptGradesOf(s) : (catalog && catalog.species[sp] && catalog.species[sp].apt) || ['C', 'C', 'C', 'C']);
  const techsOf = (sp, ids) => { const all = (catalog && catalog.species[sp] && catalog.species[sp].techs) || []; return ids.map(id => all.find(t => t.id === id)).filter(Boolean); };
  const myTechs = techsOf(s.species, Array.isArray(s.techs) ? s.techs : []);
  const foeTechs = ((catalog && catalog.species[o.species] && catalog.species[o.species].techs) || []).slice(0, Math.max(1, mscNum(o.techs, 2)));
  const loy = typeof suc.loyalOf === 'function' ? suc.loyalOf(s) : 0;
  const sumMe = MSC_STAT_KEYS.reduce((a, k) => a + mscNum(me[k]), 0);
  // 勝っている能力の上位2つと、いちばん得意な間合い(コーチの一言)
  const ahead = MSC_STAT_KEYS.map(k => ({ k, d: mscNum(me[k]) - mscNum(op[k]) })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 2);
  const apt = aptOf(s.species, true); const rankOf = (g) => ['M', 'SS+', 'SS', 'S+', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].indexOf(g) < 0 ? 99 : ['M', 'SS+', 'SS', 'S+', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].indexOf(g);
  const bestD = apt.map((g, d) => ({ g, d })).sort((a, b) => rankOf(a.g) - rankOf(b.g))[0] || { d: 1 };
  const distWord = ['くっついた間合い', '近い間合い', '中くらいの間合い', '遠い間合い'][bestD.d];
  const hint = ahead.length
    ? <>{ahead.map(x => MSC_STAT_JP[x.k]).join('と')}は 勝ってる! <em>{distWord}</em> で押していこう!</>
    : <>能力は 相手が上…。<em>{distWord}</em> で 技を当てていこう!</>;
  const aptRow = (sp, me) => <div className="msc-apt">{aptOf(sp, me).map((g, d) => <span key={d} className={['S+', 'SS', 'SS+', 'M'].includes(g) ? 'S' : g}>{AMBW_DIST[d]}</span>)}</div>;
  return (
    <div className="msc-wrap" data-msc-card>
      <div className="msc-top"><button className="msc-btn g s" onClick={onBack}>← 表へ</button><b>{info.title} {MSC_STARS(info.star)}・1戦</b></div>
      <div className="msc-vs" style={{ backgroundImage: `url(${venue})` }}>
        <div className="cap">{info.title} {MSC_STARS(info.star)}・1戦</div>
        <div className="mon a"><img src={mscMonImg(s.species)} alt=""/></div>
        <div className="mon b"><img src={mscMonImg(o.species)} alt=""/></div>
        <div className="vs">VS</div>
        <div className="nm a"><span>{info.meName}</span></div>
        <div className="nm b"><span>{o.name || mscMonName(o.species)}</span>{o.champ && <i className="msc-tag ch">👑王者</i>}{o.rival && <i className="msc-tag rv">ライバル</i>}</div>
      </div>
      <div className="msc-tabs">{[['st', 'ステータス'], ['tech', '技'], ['abl', '能力']].map(([k, l]) => <button key={k} data-msc-tab={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="msc-sheet" key={tab}>
        {tab === 'st' && <>
          {MSC_STAT_KEYS.map((k, j) => {
            const a = mscNum(me[k]); const b = mscNum(op[k]);
            return (
              <div key={k} className="msc-st" data-msc-stat={k}>
                <b className={a >= b ? 'up' : ''}>{a}</b>
                <div className="msc-bar l"><i style={{ width: `${Math.round(a / mx * 100)}%`, animationDelay: `${j * 0.07}s` }}/></div>
                <span className="lab">{MSC_STAT_ICON[k]} {MSC_STAT_JP[k]}</span>
                <div className="msc-bar r"><i style={{ width: `${Math.round(b / mx * 100)}%`, animationDelay: `${j * 0.07}s` }}/></div>
                <b className={b > a ? 'up' : ''}>{b}</b>
              </div>);
          })}
          <div className="msc-st"><b>{mscNum(s.pop)}</b><div className="msc-bar l"><i style={{ width: `${mscNum(s.pop)}%`, animationDelay: '.45s' }}/></div><span className="lab">⭐ 人気</span>{Number.isFinite(o.pop) ? <><div className="msc-bar r"><i style={{ width: `${o.pop}%`, animationDelay: '.45s' }}/></div><b className={o.pop > mscNum(s.pop) ? 'up' : ''}>{o.pop}</b></> : <><div/><b/></>}</div>
          <div className="msc-st"><b>{loy}</b><div className="msc-bar l"><i style={{ width: `${loy}%`, animationDelay: '.5s' }}/></div><span className="lab">🤝 忠誠</span>{Number.isFinite(o.loy) ? <><div className="msc-bar r"><i style={{ width: `${o.loy}%`, animationDelay: '.5s' }}/></div><b className={o.loy > loy ? 'up' : ''}>{o.loy}</b></> : <><div/><b/></>}</div>
          <div className="msc-aptrow">{aptRow(s.species, true)}<span className="lab">間合いの適性</span>{aptRow(o.species)}</div>
        </>}
        {tab === 'tech' && <div className="msc-tl">
          <div>{myTechs.length ? myTechs.map(t => <span key={t.id}>{t.kind === 'pow' ? '💪' : '🧠'}{t.name}<small>{(t.dist || []).map(d => AMBW_DIST[d]).join('')}</small></span>) : <span>—</span>}</div>
          <div>{foeTechs.length ? foeTechs.map(t => <span key={t.id}>{t.kind === 'pow' ? '💪' : '🧠'}{t.name}<small>{(t.dist || []).map(d => AMBW_DIST[d]).join('')}</small></span>) : <span>—</span>}</div>
        </div>}
        {tab === 'abl' && <div className="msc-tl">
          <div><span>能力の合計 {sumMe}</span><span>技 {myTechs.length}つ</span><span>Lv {mscNum(s.lv, 1)}</span><span>間合い</span>{aptRow(s.species, true)}</div>
          <div><span>{o.champ ? '大会の王者' : o.rival ? 'ライバル' : '大会の常連'}</span><span>技 {foeTechs.length}つ</span><span>{o.breeder ? `育てた人 ${o.breeder}` : '育てた人 —'}</span><span>間合い</span>{aptRow(o.species)}</div>
        </div>}
      </div>
      <div className="msc-hint"><img src={mscFace(s.aid)} alt=""/><span>{hint}</span></div>
      <div className="msc-foot">
        <button className="msc-btn y s" data-msc-quick onClick={onResultOnly}>⏩ 結果だけ見る</button>
        <button className="msc-btn" data-msc-ready onClick={onReady}>準備完了</button>
      </div>
    </div>
  );
}

// ---- 特別な1話の効き目のカットイン(Y2) ----
function MonsucCutin({ s, info, onGo }) {
  const sp = MSC_SPECIAL[s.aid] || { word: '集中!', sub: '特別な1話の効き目が かがやいた' };
  const coach = mscAssistant(s.aid);
  const o = info.opp || {};
  return (
    <div className="msc-wrap" data-msc-cutin>
      <div className="msc-cut" style={{ backgroundImage: `url(${MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup})` }}>
        <div className="msc-rays"/>
        <div className="word">{sp.word}</div>
        <div className="sub">{sp.sub}</div>
        <div className="duo"><img className="a" src={mscMonImg(s.species)} alt=""/><img src={mscMonImg(o.species)} alt=""/></div>
        <div className="say"><img src={mscFace(s.aid, 'happy')} alt=""/><div><b>{coach ? coach.name : ''}</b><p>{MSC_LINE[s.aid] || '「いっしょに がんばろう!」'}</p></div></div>
      </div>
      <div className="msc-eff">
        <b>効いているあいだ</b><span>{info.title}の この1戦だけ</span>
        <b>効き目</b><span>{info.buffRows.join('・') || '—'}</span>
      </div>
      <div className="msc-foot"><button className="msc-btn" data-msc-go onClick={onGo}>試合へ ▶</button></div>
    </div>
  );
}

// 観戦の札(育てる子 = 手前。相手は育てた人の名前を出す)
function MscPanel({ side, team, frame, maxHp, info, s, buffed }) {
  const i = frame.act[side]; const m = team.members[i] || team.members[0];
  const hp = Math.max(0, frame.hp[side][i] || 0); const mx = maxHp[side][i] || 1; const g = frame.g[side];
  const o = info.opp || {};
  return (
    <div className={`msc-mp ${side === 'A' ? 'a' : 'b'}`} data-msc-panel={side}>
      <div className="h">{side === 'A' ? <img src={mscFace(s.aid)} alt=""/> : null}<span>{m.name}{side === 'B' && o.breeder ? <small> ・{o.breeder}</small> : null}{side === 'A' && buffed ? <i className="msc-buff">✨ 特別な1話</i> : null}</span></div>
      <div className="bars">
        <div>
          <div className={`ambw-bar ${hp / mx < 0.3 ? 'low' : ''}`}><i style={{ width: `${Math.round(hp / mx * 100)}%` }}/></div>
          <div className="ambw-gbar"><i style={{ width: `${Math.max(0, Math.min(100, g))}%` }}/>{[25, 50, 75].map(x => <u key={x} style={{ left: `${x}%` }}/>)}</div>
        </div>
        <div className="num">{hp}<small>/{mx}</small><br/><small>ガッツ {Math.round(g)}</small></div>
      </div>
    </div>
  );
}

// ---- 試合の画面は MonsucArena(56-monhero-success-arena.jsx)。自分で操作する・記録を再生する、どちらも同じ画面 ----

// 記録の無い試合(回3の結果だけ)のときの短い間。少し待って勝ち負けへ
function MonsucMatchSkip({ won, onEnd }) {
  useEffect(() => { const t = setTimeout(() => onEnd(won), 900); return () => clearTimeout(t); }, []);
  return <div className="msc-wrap" data-msc-match-skip><p className="msc-note" style={{ textAlign: 'center', marginTop: 40 }}>試合中…</p></div>;
}

// ---- 優勝(B2) ----
function MonsucCupWin({ s, info, match, out, onNext }) {
  const o = info.opp || {};
  const rows = Array.isArray(out && out.rows) ? out.rows : [
    ...(out && out.prize ? [{ i: '💰', k: '賞金', v: `+${out.prize}${info.rival ? '(ライバルに勝って ×1.5)' : ''}`, big: info.rival }] : []),
    ...(out && out.tickets ? [{ i: '🎫', k: '修行チケット', v: `+${out.tickets}` }] : []),
    ...(out && out.title ? [{ i: '🏅', k: '称号', v: `「${out.title}」` }] : []),
  ];
  const coach = mscAssistant(s.aid);
  return (
    <div className="msc-wrap" data-msc-win>
      <div className="msc-hero win" style={{ backgroundImage: `url(${MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup})` }}>
        <div className="msc-rays"/>
        <div className="big">優勝!</div>
        <div className="sub">{info.title} {MSC_STARS(info.star)}・1戦: {o.name || mscMonName(o.species)} に 勝ち{match && match.r ? `(${match.r.rounds} ラウンド)` : ''}</div>
        <div className="who"><img src={mscMonImg(s.species)} alt=""/></div>
        {info.rival && <div className="rival"><span>ライバルの {o.name || mscMonName(o.species)} にも 勝った!</span><em>ごほうび大</em></div>}
      </div>
      {rows.map((r, k) => <div key={k} className={`msc-rw ${r.big ? 'big' : ''}`} style={{ animationDelay: `${0.3 + k * 0.12}s` }}><span className="i">{r.i}</span><span className="k">{r.k}</span><span className="v">{r.v}</span></div>)}
      <div className="msc-talk"><img src={mscFace(s.aid, 'happy')} alt=""/><p>{coach ? <b style={{ display: 'block', fontSize: 11, color: '#b45309' }}>{coach.name}</b> : null}{info.rival ? '「ライバルに勝った! ごほうびも 大きいよ!」' : `「${info.meName}、やったね! 優勝だよ!」`}</p></div>
      <div className="msc-foot"><button className="msc-btn" data-msc-next onClick={onNext}>次へ ▶</button></div>
    </div>
  );
}

// ---- 負け(C4)。やり直し(砂時計)か あきらめる ----
function MonsucCupLose({ suc, s, info, match, onRematch, onGiveUp, onSkipAnim }) {
  const o = info.opp || {};
  const b = s.battle || {};
  const left = Math.max(0, mscNum(suc.REMATCH && suc.REMATCH.max, 3) - mscNum(s.rematchUsed));
  const has = (k) => mscNum(s.items && s.items[k]);
  const can = (k) => (typeof suc.canRematch === 'function' ? suc.canRematch(s, k) : has(k) > 0 && left > 0);
  const summit = b.kind === 'summit';
  const coach = mscAssistant(s.aid);
  const why = (() => {
    if (!match || !match.r) return '';
    const t = match.r.log.filter(x => x.ev === 'tech' && x.side === 'B' && x.hit);
    return t.length ? `${t[t.length - 1].name}が 効いてたね…` : 'あと少しだったね…';
  })();
  return (
    <div className="msc-wrap" data-msc-lose>
      <div className="msc-hero lose" style={{ backgroundImage: `url(${MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup})` }}>
        <div className="big">負けた…</div>
        <div className="sub">{info.title} {MSC_STARS(info.star)}・{o.name || mscMonName(o.species)} に 負け</div>
        <div className="who"><img src={mscMonImg(s.species)} alt=""/></div>
      </div>
      <div className="msc-again">
        <h3>時をもどして、やり直す?</h3>
        <p>やり直せるのは 1回の育成で{mscNum(suc.REMATCH && suc.REMATCH.max, 3)}回まで・<em>のこり {left}/{mscNum(suc.REMATCH && suc.REMATCH.max, 3)}</em></p>
        <button className="msc-pick sand" data-msc-rematch="sand" disabled={!can('sand')} onClick={() => onRematch('sand')}><img src="images/success/items/hourglass.png" alt=""/><span>時渡りの砂時計で やり直す<small>同じ相手と もう一度(持っている ×{has('sand')})</small></span></button>
        <button className="msc-pick rain" data-msc-rematch="rainbow" disabled={!can('rainbow')} onClick={() => onRematch('rainbow')}><img src="images/success/items/hourglass-rainbow.png" alt=""/><span>虹の時渡りの砂時計で 相手を変えて やり直す<small>{info.rival ? '同じライバルと もう一度' : 'ちがう相手と 戦える'}(持っている ×{has('rainbow')})</small></span></button>
        <button className="msc-pick quit" data-msc-giveup onClick={onGiveUp}>{summit ? 'あきらめる(頂への道は ここまで)' : info.star >= 2 ? 'あきらめる(準優勝の ごほうびを もらう)' : 'あきらめる'}</button>
      </div>
      <div className="msc-talk"><img src={mscFace(s.aid, 'sad')} alt=""/><p>{coach ? <b style={{ display: 'block', fontSize: 11, color: '#b45309' }}>{coach.name}</b> : null}「おしかった! {why} もう1回 いく?」</p></div>
    </div>
  );
}

// ---- 入れ物: 組み合わせ表 → バトルカード → (カットイン) → 試合 → 優勝 / 負け ----
function MonsucCupShow(props) {
  const { s } = props;
  const b = (s && s.battle) || {};
  return <MonsucCupShowInner key={[s && s.id, s && s.turn, b.kind, b.id, b.round, b.retry, b.again, b.reroll].join('|')} {...props}/>;
}
function MonsucCupShowInner({ suc, s, me, settle, onRematch, onNext, onClose, startAt, previewOut, fight, opp, title, autoOnly }) {
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState(startAt || 'bracket'); // bracket → card → cutin → match → win / lose
  const [out, setOut] = useState(startAt === 'win' ? (previewOut || {}) : null); // startAt・previewOut は止め絵を撮るときだけ
  const rootRef = useRef(null);
  if (typeof useMhBattleBgmHold === 'function') useMhBattleBgmHold(true); // 大会のあいだはバトルの曲(組み合わせ表〜優勝/負け)
  useEffect(() => {
    let alive = true;
    if (!engine && typeof ambwLoadEngine === 'function') ambwLoadEngine().then((x) => { if (!alive) return; if (x) setEngine(x); else setFailed(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (rootRef.current) rootRef.current.scrollTop = 0; }, [phase]);
  // opp: 回3の流れが決めた相手の値(loy・pop など)を上書きする。fight: 回3の試合の計算(msxR3Fight)。渡されたら、こちらの計算は使わない
  const info = useMemo(() => {
    if (!s || !s.battle) return null;
    const i0 = monsucCupInfo(suc, s, me); const i = title ? { ...i0, title } : i0; // title: 回3が大会の名前を渡せる
    return opp && typeof opp === 'object' ? { ...i, opp: { ...(i.opp || {}), ...opp } } : i;
  }, [suc, s]);
  const catalog = useMemo(() => {
    if (!engine || typeof engine.buildCatalog !== 'function') return null;
    try { return engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() }); } catch (_) { return null; }
  }, [engine]);
  // 回3の結果は毎回聞き直す(回3の計算の読み込みが終わるまでは null。null を「負け」として覚えない)
  const fightRes = (() => { if (typeof fight !== 'function') return undefined; try { return fight(s) || null; } catch (_) { return null; } })();
  const match = useMemo(() => {
    if (!info) return null;
    if (typeof fight === 'function') {
      // 回3の結果: { won, r?, teamA?, teamB?, input? }。input があれば自分で操作・記録(r.log)と両チームがあれば観戦で再生・無ければ勝ち負けだけ
      if (!fightRes) return null;   // まだ読み込み中
      try {
        const f = fightRes; const won = Boolean(f.won != null ? f.won : f.r && f.r.winner === 'A');
        const input = !autoOnly && f.input && f.input.teamA && f.input.teamB ? f.input : null;
        return { ...f, won, input, r: f.r && Array.isArray(f.r.log) && f.teamA && f.teamB ? f.r : null };
      } catch (_) { return null; }
    }
    if (!engine || !catalog) return null;
    try {
      const m = monsucCupMatch(engine, catalog, suc, s, me, info);
      const input = autoOnly ? null : { seed: m.seed, catalog, teamA: m.teamA, teamB: m.teamB, balance: 'A', ...(m.buffs ? { buffs: { A: m.buffs } } : {}) };
      return { ...m, won: m.r.winner === 'A', input };
    } catch (_) { return null; }
  }, [engine, catalog, info, fightRes]);
  // 自分で操作した試合の結果(負けの画面の「何が効いたか」に使う)
  const [played, setPlayed] = useState(null);
  const shown = played && played.result ? { ...match, r: played.result } : match;
  const finish = (won, extra) => {
    if (extra && extra.result) setPlayed(extra);
    if (won) { const o = typeof settle === 'function' ? settle(true) : null; setOut(o || {}); setPhase('win'); } else setPhase('lose');
  };
  const canSkip = typeof suc.canSkip === 'function' && suc.canSkip(s);
  let body = null;
  if (!info) body = <p className="msc-note">大会が見つかりませんでした</p>;
  else if (phase === 'bracket') body = <MonsucBracket suc={suc} s={s} info={info} canSkip={canSkip} onClose={onClose} onFight={() => setPhase('card')} onResultOnly={() => match && finish(match.won)}/>;
  else if (phase === 'card') body = <MonsucBattleCard suc={suc} s={s} info={info} catalog={catalog} onBack={() => setPhase('bracket')} onReady={() => setPhase(info.buffs || info.buffRows.length ? 'cutin' : 'match')} onResultOnly={() => match && finish(match.won)}/>;
  else if (phase === 'cutin') body = <MonsucCutin s={s} info={info} onGo={() => setPhase('match')}/>;
  else if (phase === 'match') {
    const canPlay = match && match.input && engine && typeof engine.createMatch === 'function';
    body = canPlay ? <MonsucArena s={s} info={info} engine={engine} input={match.input} onEnd={finish}/>
      : match && match.r ? <MonsucArena s={s} info={info} watch={match} onEnd={finish}/>
      : match ? <MonsucMatchSkip won={match.won} onEnd={finish}/>
      : <p className="msc-note">{failed ? '試合を読み込めませんでした。もう一度開いてください' : '試合の準備をしています…'}</p>;
  }
  else if (phase === 'win') body = <MonsucCupWin s={s} info={info} match={shown} out={out} onNext={() => onNext && onNext(out)}/>;
  else if (phase === 'lose') body = <MonsucCupLose suc={suc} s={s} info={info} match={shown} onRematch={(k) => onRematch && onRematch(k)} onGiveUp={() => { const o = typeof settle === 'function' ? settle(false) : null; if (onNext) onNext(o); }}/>;
  return (
    <div className="msc-root ambw-root" ref={rootRef} data-msc-root data-msc-phase={phase}>
      <style>{AMBW_CSS}{MSC_CSS}</style>
      {body}
    </div>
  );
}
