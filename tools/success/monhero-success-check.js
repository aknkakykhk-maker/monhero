#!/usr/bin/env node
// モンヒロサクセスの計算の芯(monster-hero/data/monhero-success.js)の見張り。画面は開かない(1秒ほど)。
//   ・決まった乱数(育成の id + ターン)で、同じ手なら同じ結果になる
//   ・46ターン(5・12・12・12・5)・期末の強制大会・デビュー戦3回負けでゲームオーバー・相手は1割ずつ弱く6割まで・頂への道は負けたら終わり
//   ・結果4種の倍率(大成功 ×1.5/成功 ×1/失敗 ×0/サボり ×0.3)・サボりは方針が普通より甘いときだけ・体力が減ると失敗が増える・サボりグセは失敗の下限 +5%
//   ・休む(10/70/20% で 50/70/90% 回復)・遊ぶ(50% 回復・甘え度 +5・うつ病が治る)・通院(1回目70%・2回目は必ず)
//   ・忠誠 = 甘え度 + 恐れ度(各50まで)・補正は60で +60% 頭打ち・うつ病のあいだは忠誠が動かない
//   ・編成(上位3能力・得意率65%)・タッグの強さ(ランクで15〜35%)・親密度80でタッグ・アシストポイント = 総合力 ÷ 50
//   ・イッサ博士の6択は社長の確率どおり
//   ・芯は Math.random・Date・window・localStorage を使わず、いまは index.html から読まれない(誰にも見えない)
'use strict';
const fs = require('fs');
const path = require('path');
const { load, ROOT, CORE } = require('./load');

const { SUC, deps } = load();
const C = deps.MASMON_CALC;
const K = SUC.KEYS;
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- 芯の中身の決まり ----
const src = fs.readFileSync(CORE, 'utf8').replace(/\/\/.*$/gm, '');
for (const bad of ['Math.random', 'Date.now', 'new Date', 'window.', 'localStorage', 'Math.pow', 'Math.exp', 'Math.log']) ok(!src.includes(bad), `芯が ${bad} を使っている`);
const html = fs.readFileSync(path.join(ROOT, 'monster-hero', 'index.html'), 'utf8');
ok(!html.includes('monhero-success.js'), 'monhero-success.js が index.html から読まれている(回1は誰にも見えない約束)');

// ---- 期とターン ----
ok(SUC.TOTAL_TURNS === 46, `合計が46ターンでない: ${SUC.TOTAL_TURNS}`);
ok(SUC.PERIODS.map(p => p.len).join(',') === '5,12,12,12,5', '期の長さが 5・12・12・12・5 でない');
ok(SUC.periodOf(5).key === 'debut' && SUC.periodOf(5).left === 1 && SUC.periodOf(6).key === 'junior' && SUC.periodOf(42).key === 'final' && SUC.periodOf(46).at === 5, '期の区切りがずれている');

// ---- 決まった乱数 ----
const play = (id, picks) => {
  let s = SUC.newRun({ id, species: 'Golem', aid: 'kiki', team: [] });
  for (let i = 0; i < picks.length && !s.over; i++) {
    if (s.battle) { s = SUC.settle(s, [true, true, true]).state; continue; }
    const v = SUC.peek(s);
    const a = v.can.includes('cond') ? { kind: 'cond' } : v.can.includes('retry') ? { kind: 'retry' } : picks[i];
    s = SUC.act(s, a).state;
    if (s.last && s.last.res) s = SUC.react(s, 'praise').state;
    s = SUC.endTurn(s).state;
  }
  return s;
};
const picks = Array.from({ length: 30 }, (_, i) => (i % 4 === 3 ? { kind: 'rest' } : { kind: 'train', stat: K[i % 6] }));
const a1 = play('same-id', picks); const a2 = play('same-id', picks); const b1 = play('other-id', picks);
ok(JSON.stringify(a1) === JSON.stringify(a2), '同じ育成 id・同じ手なのに結果が違う(決まった乱数になっていない)');
ok(JSON.stringify(a1.stats) !== JSON.stringify(b1.stats), '育成 id を変えても結果が同じ(乱数が id を見ていない)');
ok(JSON.stringify(SUC.gatherOf(a1)) === JSON.stringify(SUC.gatherOf(JSON.parse(JSON.stringify(a1)))), '集まりが同じターンで変わる');

// ---- 結果の倍率・サボり・失敗 ----
ok(SUC.RESULTS.great.mult === 1.5 && SUC.RESULTS.ok.mult === 1 && SUC.RESULTS.fail.mult === 0 && SUC.RESULTS.sab.mult === 0.3, '結果の倍率が 1.5/1/0/0.3 でない');
const base = SUC.newRun({ id: 'r', species: 'Mocchi', aid: 'mua' });
ok(SUC.sabRateOf({ ...base, pol: 0 }) === 0 && SUC.sabRateOf({ ...base, pol: 2 }) === 0, 'サボりが普通〜厳しい方針で起きる');
ok(SUC.sabRateOf({ ...base, pol: -1 }) > 0 && SUC.sabRateOf({ ...base, pol: -3 }) > SUC.sabRateOf({ ...base, pol: -1 }), 'サボりが甘い方針で起きない・甘いほど起きやすくない');
const fFull = SUC.failRateOf({ ...base, hp: 100 }); const fHalf = SUC.failRateOf({ ...base, hp: 50 }); const fLow = SUC.failRateOf({ ...base, hp: 25 }); const fZero = SUC.failRateOf({ ...base, hp: 0 });
ok(fFull === fHalf && fLow > fHalf && fZero - fLow > fLow - fHalf, `体力が減ると失敗がどんどん上がる形でない: ${fFull}/${fHalf}/${fLow}/${fZero}`);
ok(SUC.failRateOf({ ...base, hp: 200, hpMax: 200 }) < SUC.failRateOf({ ...base, hp: 60, hpMax: 200 }) && SUC.failRateOf({ ...base, hp: 60, hpMax: 100 }) < SUC.failRateOf({ ...base, hp: 60, hpMax: 200 }), '体力の上限が上がった子が同じ体力で失敗しにくくない');
ok(near(SUC.failRateOf({ ...base, yosu: { sabori: { visits: 0 } } }) - fFull, 0.05, 1e-9), 'サボりグセが失敗率の下限 +5% になっていない');
// 失敗は上がらない・サボりは3割(同じ札・同じ時期で比べる)
{
  let s = SUC.newRun({ id: 'mult', species: 'Mocchi', aid: 'mua', pol: -3 });
  const seen = {};
  for (let i = 0; i < 400 && Object.keys(seen).length < 4; i++) {
    const t = { ...s, id: `mult-${i}`, hp: i % 2 ? 100 : 5 };
    const r = SUC.act(t, { kind: 'train', stat: 'pow' });
    const g = r.state.stats.pow - t.stats.pow; const res = r.out.result;
    if (!seen[res]) seen[res] = g;
  }
  ok(seen.fail === 0, `失敗で能力が上がっている: ${seen.fail}`);
  ok(seen.ok > 0 && near(seen.great / seen.ok, 1.5, 0.2) && near(seen.sab / seen.ok, 0.3, 0.15), `大成功・サボりの伸びが成功の 1.5倍・0.3倍でない: ${JSON.stringify(seen)}`);
}

// ---- 休む・遊ぶ・通院 ----
{
  const n = 4000; const cnt = { poor: 0, normal: 0, great: 0 }; const rec = {};
  for (let i = 0; i < n; i++) { const t = { ...base, id: `rest-${i}`, hp: 0 }; const r = SUC.act(t, { kind: 'rest' }); cnt[r.out.rest] += 1; rec[r.out.rest] = r.state.hp; }
  ok(near(cnt.poor / n, 0.1, 0.02) && near(cnt.normal / n, 0.7, 0.03) && near(cnt.great / n, 0.2, 0.03), `休むの3つの率が 10/70/20% でない: ${JSON.stringify(cnt)}`);
  ok(rec.poor === 50 && rec.normal === 70 && rec.great === 90, `休むの回復が上限の 50/70/90% でない: ${JSON.stringify(rec)}`);
  const p = SUC.act({ ...base, hp: 10, ama: 20, yosu: { utsu: { visits: 0 } } }, { kind: 'play' }).state;
  ok(p.hp === 60 && p.ama === 25 && !p.yosu.utsu, `遊ぶが 50%回復・甘え度+5・うつ病が治る になっていない: hp ${p.hp} 甘え ${p.ama}`);
  let first = 0; const m = 2000;
  for (let i = 0; i < m; i++) { const r = SUC.act({ ...base, id: `cl-${i}`, yosu: { sabori: { visits: 0 } } }, { kind: 'clinic' }); if (!r.state.yosu.sabori) first += 1; }
  ok(near(first / m, 0.7, 0.03), `通院の1回目で治る率が70%でない: ${first / m}`);
  for (let i = 0; i < 200; i++) { const r = SUC.act({ ...base, id: `cl2-${i}`, yosu: { utsu: { visits: 1 } } }, { kind: 'clinic' }); if (r.state.yosu.utsu) { ok(false, '2回目の通院で治らないことがある'); break; } }
  ok(!SUC.act(base, { kind: 'clinic' }).out.ok, 'ようすが無いのに通院できる');
}

// ---- 忠誠度 ----
{
  let s = { ...base, last: { kind: 'train', res: 'ok' }, reacted: false };
  for (let i = 0; i < 40; i++) s = SUC.react({ ...s, last: { kind: 'train', res: 'ok' }, reacted: false, pol: 0, pp: 0 }, 'praise').state;
  ok(s.ama === 50 && s.fear === 10 && SUC.loyalOf(s) === 60, `甘え度が50で止まらない: ${s.ama}/${s.fear}`);
  ok(SUC.loyalMult(60) === 1.6 && SUC.loyalMult(100) === 1.6 && SUC.loyalMult(30) === 1.3 && SUC.loyalMult(0) === 1, '忠誠度の補正が 1+min(忠誠,60)/100 でない');
  const u = SUC.react({ ...base, yosu: { utsu: { visits: 0 } }, last: { kind: 'train', res: 'ok' }, reacted: false }, 'praise').state;
  ok(u.ama === base.ama && u.fear === base.fear, 'うつ病のあいだに忠誠度が動いた');
}

// ---- 編成・タッグ・アシスト ----
{
  const bm = SUC.memberOf({ kind: 'base', species: 'Mocchi' });
  ok(bm.tag === 15 && bm.bond0 === 0 && bm.fav === 0.65, `ベースモンの基本値がずれている: ${bm.tag}/${bm.bond0}/${bm.fav}`);
  ok(bm.bonus[bm.top[0]] >= 3 && bm.bonus[bm.top[0]] <= 4.5, `ベースモンの1位の補正が 3〜4% ほどでない: ${bm.bonus[bm.top[0]]}`);
  const st = { life: 300, pow: 600, wise: 200, hit: 530, eva: 500, tough: 250 };
  const m = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: st, lv: 30, masteries: [50, 50, 50, 50], loy: 70, pop: 40, assists: [{ id: 'kaketsuke', lv: 3 }, { id: 'sokoji', lv: 2 }, { id: 'kaketsuke', lv: 1 }, { id: 'x' }] });
  ok(m.rank === C.rankOf(m.power).key, 'ランクが総合力から出し直されていない');
  ok(m.top.join(',') === 'pow,hit,eva', `上位3つが違う: ${m.top}`);
  ok(m.bonus.pow === 600 / 40 + SUC.RANK_ADD[m.rank] && near(m.bonus.hit, 530 / 40 * 0.9 + SUC.RANK_ADD[m.rank], 0.01) && m.bonus.life === 0, `能力の補正の式がずれている: ${JSON.stringify(m.bonus)}`);
  ok(m.tag === SUC.TAG_POWER[m.rank] && SUC.TAG_POWER.B === 25 && SUC.TAG_POWER.M === 35 && SUC.TAG_POWER.aid === 25, 'タッグの強さがランクの表でない');
  ok(near(m.fav, 0.85, 1e-9) && m.assists.length === 2, `かけつけの得意率・同じアシストの重なりがおかしい: ${m.fav} ${m.assists.length}`);
  ok(m.startAdd.stat === 'pow' && m.startAdd.v === 24, `はじめの能力が 1位 ÷ 25 でない: ${JSON.stringify(m.startAdd)}`);
  ok(SUC.memberEffect(m, 'life', 0) === 7 && SUC.memberEffect(m, 'pow', 0) === m.bonus.pow + 7, '4位以下の訓練で補正0%・アシストは効く になっていない');
  // 得意率: 上位3つに 65%(30:20:15)
  const s = SUC.newRun({ id: 'g', species: 'Mocchi', aid: 'mua', team: [{ kind: 'raised', species: 'Mocchi', stats: st, loy: 50 }] });
  const cnt = { top: 0, t1: 0, t2: 0, t3: 0, other: 0, none: 0 }; const n = 6000; const top = s.team[0].top;
  for (let t = 1; t <= n; t++) {
    const g = SUC.gatherOf({ ...s, turn: t }); let where = null;
    for (const c of Object.values(g)) if (c.members.includes(0)) where = c.stat;
    if (!where) cnt.none += 1; else if (where === top[0]) cnt.t1 += 1; else if (where === top[1]) cnt.t2 += 1; else if (where === top[2]) cnt.t3 += 1; else cnt.other += 1;
  }
  ok(near(cnt.t1 / n, 0.3, 0.025) && near(cnt.t2 / n, 0.2, 0.025) && near(cnt.t3 / n, 0.15, 0.02) && near(cnt.other / n, 0.2, 0.025) && near(cnt.none / n, 0.15, 0.02), `集まり方が 30/20/15/20/15% でない: ${JSON.stringify(cnt)}`);
  // タッグは親密度80から
  const card = { kind: 'train', stat: 'pow', members: [0], aid: false };
  ok(SUC.cardMult({ ...s, bond: [79, 0, 0, 0, 0, 0] }, card).tag === 0 && SUC.cardMult({ ...s, bond: [80, 0, 0, 0, 0, 0] }, card).tag > 0, '親密度80でタッグにならない');
  ok(SUC.assistPointsOf(8000) === 160 && SUC.assistPointsOf(100) === 20 && SUC.assistPointsOf(30000) === 400, 'アシストポイントが 総合力÷50(20〜400)でない');
}

// ---- イッサ博士 ----
{
  const want = { stat: 0.35, hpmax: 0.6, hp: 0.9, loyal: 0.75, pop: 0.75 };
  const mid = { ...base, hp: 50, ama: 20, fear: 20, stress: 20, issaMet: 0 };
  for (const [k, p] of Object.entries(want)) ok(SUC.issaRate(mid, k) === p, `博士の ${k} の成功率が社長の値 ${p} でない: ${SUC.issaRate(mid, k)}`);
  ok(SUC.issaRate(mid, 'none') === 0 && Object.keys(SUC.ISSA.choices).length === 6, '博士の選択肢が6つでない');
  // 来たターンで選ぶ: 成功/失敗の中身
  let found = null;
  for (let t = 12; t <= 39 && !found; t++) for (let j = 0; j < 400 && !found; j++) { const s = { ...base, id: `issa-${j}`, turn: t, acted: true }; if (SUC.issaComes(s)) found = s; }
  ok(Boolean(found), '博士が来るターンが見つからない');
  if (found) {
    const r = SUC.issa(found, 'stat'); const d = r.state.stats.pow - found.stats.pow;
    ok((r.out.win && d === 50) || (!r.out.win && d === -10 && r.state.yosu.sabori), `ステータスアップの結果が +50 / −10とサボりグセ でない: ${d}`);
    ok(!SUC.issa(r.state, 'hp').out.ok, '博士は1ターンに2回選べてしまう');
  }
}

// ---- 大会: 強制大会・デビュー戦・頂への道 ----
{
  const toBattle = (s) => { let x = s; let g = 0; while (!x.battle && !x.over && g++ < 60) { x = SUC.act(x, SUC.peek(x).can.includes('cond') ? { kind: 'cond' } : { kind: 'rest' }).state; x = SUC.endTurn(x).state; } return x; };
  let s = toBattle(SUC.newRun({ id: 'tour', species: 'Mocchi', aid: 'mua' }));
  ok(s.battle && s.battle.kind === 'debut' && s.turn === 5, `デビュー戦がデビュー期の終わりに来ない: ${JSON.stringify(s.battle)} ${s.turn}`);
  const o0 = SUC.opponents(s)[0];
  // 負け → 再挑戦(訓練できない・相手は1割ずつ弱く)
  s = SUC.settle(s, [false]).state;
  ok(s.turn === 6 && !s.over && SUC.peek(s).can.join() === 'retry', '負けたあとのジュニア期が再挑戦だけになっていない');
  ok(!SUC.act(s, { kind: 'train', stat: 'pow' }).out.ok, '再挑戦のターンに訓練できてしまう');
  s = SUC.endTurn(SUC.act(s, { kind: 'retry' }).state).state;
  ok(s.battle && s.battle.kind === 'debut' && s.battle.retry === 1, '再挑戦の大会が立たない');
  const w1 = SUC.opponents(s)[0];
  s = SUC.settle(s, [false]).state; s = SUC.endTurn(SUC.act(s, { kind: 'retry' }).state).state;
  const w2 = SUC.opponents(s)[0];
  ok(w1.sum < o0.sum * 0.97 && w2.sum < w1.sum, `再挑戦の相手が弱くなっていない: ${o0.sum} → ${w1.sum} → ${w2.sum}`);
  const s3 = SUC.settle(s, [false]).state;
  ok(s3.over === 'gameover', 'デビュー戦に3回負けてもゲームオーバーにならない');
  // 6割の床
  const deep = { ...s, battle: { kind: 'debut', retry: 9, round: 0 } };
  const floorSum = SUC.opponents(deep)[0].sum; const firstSum = SUC.opponents({ ...deep, battle: { kind: 'debut', retry: 0, round: 0 } })[0].sum;
  ok(near(floorSum / firstSum, 0.6, 0.12), `再挑戦の相手の弱さが6割で止まらない: ${floorSum}/${firstSum}`);
  // 勝てば次へ。ジュニアの終わりに ★★(2試合)
  let w = SUC.settle(s, [true]).state;
  ok(w.debutWon && w.titles.includes('遅咲きの一歩') && !w.over, '再挑戦に勝ったのに先へ進まない');
  w = toBattle(w);
  ok(w.battle && w.battle.kind === 'junior' && w.turn === 17 && SUC.opponents(w).length === 2, `ジュニアしめくくり杯(2試合)が17ターン目の終わりに来ない: ${w.turn}`);
  const before = { ...w.stats }; const pts = w.pts;
  w = SUC.settle(w, [true, true]).state;
  ok(w.stats.pow === Math.min(999, before.pow + 2) && w.pts === pts + 5 && w.turn === 18, '強制大会に勝ったごほうび(全能力+2・能力ポイント+5)がずれている');
  w = toBattle(w); ok(w.battle.kind === 'middle' && w.turn === 29, 'ミドルしめくくり杯が29ターン目の終わりに来ない');
  w = SUC.settle(w, [false]).state; ok(!w.over && w.turn === 30, '強制大会で負けても育成は続く はずが止まった');
  w = toBattle(w); ok(w.battle.kind === 'pro' && w.turn === 41, '冬のヒーロー記念が41ターン目の終わりに来ない');
  w = SUC.settle(w, [true, true, true]).state; ok(w.crowns === 1, '👑 の勝ちが数えられていない');
  w = toBattle(w); ok(w.battle.kind === 'summit' && w.battle.round === 0 && w.turn === 44, `頂への道の1回戦が最後の期の3ターン目に来ない: ${w.turn}`);
  const lose = SUC.settle(w, [false]).state; ok(lose.over === 'lost', '頂への道で負けても終わらない');
  w = SUC.settle(w, [true]).state; w = toBattle(w); w = SUC.settle(w, [true]).state; w = toBattle(w);
  ok(w.battle.round === 2 && w.turn === 46, '頂への道の決勝が46ターン目に来ない');
  const pre = { ...w.stats };
  w = SUC.settle(w, [true]).state;
  ok(w.over === 'done' && w.titles.includes('ヒーローの頂') && w.stats.life === Math.min(999, pre.life + 15), '決勝の大きいほうのごほうび(👑 を勝っていれば全能力+15)が付かない');
  const ev = SUC.evaluate(w); ok(Number.isFinite(ev.power) && ev.points === SUC.assistPointsOf(ev.power), '評価(総合力・アシストポイント)が出ない');
}

// ---- 能力ポイント ----
{
  const s = { ...base, turn: 25, pts: 10, stats: { ...base.stats, pow: 499, wise: 600 } };
  const a = SUC.spendPts(s, 'pow', 3).state; ok(a.stats.pow === 502 && a.pts === 5, `目安(ミドル 500)を超えると2点で+1 になっていない: ${a.stats.pow}/${a.pts}`);
  const b = SUC.autoPts({ ...base, pts: 7 }).state; ok(b.pts === 0, 'おまかせで点が残る');
}

// ---- 修行(社長 2026-11-12: チケット・2段で能力2つずつ・最後に技のくじ・外すと次の率が上がる) ----
{
  const s0 = SUC.newRun({ id: 'shu', species: 'Mocchi', aid: 'mua' });
  ok(s0.techs.length === 2 && s0.tickets === SUC.SHUGYO.ticket0, `はじめの技(はじめから覚えている2つ)・チケットがずれている: ${s0.techs} ${s0.tickets}`);
  ok(SUC.peek(s0).can.includes('shugyo') && SUC.shugyoLeft(s0) === s0.tickets, '修行がチケットの数だけ行けない(期ごとの回数は決めない)');
  const j = { ...s0, turn: 8, tickets: 3 };
  ok(SUC.shugyoLeft(j) === 3, 'チケット3枚で修行が3回できない');
  ok(SUC.shugyoLeft({ ...j, tickets: 0 }) === 0, 'チケットが無いのに修行できる');
  const r = SUC.act(j, { kind: 'shugyo', course: 'fire', techs: [] });
  const up = Object.keys(r.out.gain).sort().join(',');
  ok(r.out.result === 'fail' || r.out.result === 'sab' || up === 'eva,hit,life,tough', `修行の2段で4つの能力(命中・ライフ/丈夫さ・回避)が上がっていない: ${up}`);
  ok(r.state.tickets === j.tickets - 1 && r.state.shugyoUsed.junior === 1 && r.state.hp <= j.hp - 9, 'チケット・期の回数・体力の減りがずれている');
  ok(SUC.react(r.state, 'praise').out.ok, '修行のあとに褒める/叱るができない');
  // 技の条件と、外したときの救い
  const big = SUC.techsOf('Mocchi').find(t => t.role === 'big');
  ok(!SUC.canLearn(j, big), '能力・熟練の条件を満たさない技が覚えられる');
  const light = SUC.techsOf('Mocchi').find(t => t.role === 'skill');
  ok(SUC.canLearn({ ...j, stats: { ...j.stats, wise: 999 } }, light), '条件を満たした技が覚えられない');
  ok(near(SUC.techRate({ ...j, pity: 30 }, light) - SUC.techRate(j, light), 0.30, 1e-9), '外した分だけ次の率が上がらない');
  let missSeen = false; let hitSeen = false;
  for (let i = 0; i < 300 && !(missSeen && hitSeen); i++) {
    const t = { ...j, id: `shu-${i}`, stats: { ...j.stats, wise: 999 }, pity: 0 };
    const x = SUC.act(t, { kind: 'shugyo', course: 'star', techs: [light.id] });
    if (x.out.result === 'sab') continue;
    if (x.out.learned) { hitSeen = true; ok(x.state.techs.includes(light.id) && x.state.pity === 0 && x.state.mastery[light.id] === 0, '技を覚えたのに一覧・救い・熟練がずれている'); }
    else { missSeen = true; ok(x.state.pity === SUC.SHUGYO.pity, '外したのに次の率が上がらない'); }
  }
  ok(missSeen && hitSeen, '修行の技のくじで、当たり・外れの両方が出ない');
  // 編成の子からの伝授: 同じ種ならその技、違う種なら同じ役割の技
  const sameSp = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: { life: 300, pow: 500, wise: 300, hit: 300, eva: 300, tough: 300 }, techs: SUC.techsOf('Mocchi').map(t => t.id) });
  const tid = SUC.teachFrom(j, sameSp); ok(tid && !j.techs.includes(tid) && SUC.techsOf('Mocchi').some(t => t.id === tid), `同じ種の子から技を教わらない: ${tid}`);
  const other = SUC.memberOf({ kind: 'raised', species: 'Golem', stats: { life: 300, pow: 500, wise: 300, hit: 300, eva: 300, tough: 300 }, techs: SUC.techsOf('Golem').map(t => t.id) });
  const tid2 = SUC.teachFrom(j, other); const role = (SUC.techsOf('Golem').find(t => SUC.techsOf('Mocchi').find(m => m.id === tid2 && m.role === t.role)) || null);
  ok(tid2 && role, `違う種の子から同じ役割の技を教わらない: ${tid2}`);
  // 大会に勝つとチケット(賞金が大きいほど多い)と名声。負けると準優勝などの一部の賞金だけ
  const b = SUC.settle({ ...s0, turn: 5, acted: false, battle: { kind: 'debut', round: 0 } }, [true]).state;
  ok(b.tickets === s0.tickets + 1 && b.fame === SUC.PRIZE.debut, 'デビュー戦に勝ってもチケット・名声が入らない');
  const pro = SUC.settle({ ...s0, turn: 41, acted: false, battle: { kind: 'pro', round: 0 } }, [true, true, true]).state;
  ok(pro.tickets - s0.tickets > b.tickets - s0.tickets, '賞金の大きい大会ほどチケットが多くない');
  const runner = SUC.settle({ ...s0, turn: 41, acted: false, battle: { kind: 'pro', round: 0 } }, [true, true, false]).state;
  ok(runner.tickets === s0.tickets && runner.fame === Math.round(SUC.PRIZE.pro * 0.4), '決勝で負けたとき準優勝の賞金(40%)だけになっていない');
  // ごほうびのごはん(体力・忠誠度・能力の3種類・名声を使う・大会のあと1回だけ)
  ok(Object.keys(SUC.MEALS).sort().join() === 'hp,loyal,stat', 'ごはんが体力・忠誠度・能力の3種類でない');
  const mh = SUC.meal({ ...pro, hp: 10 }, 'hp'); ok(mh.out.ok && mh.state.hp === 50 && mh.state.fame === pro.fame - SUC.MEALS.hp.cost && !mh.state.mealReady, '体力のごはんの効き・値段がずれている');
  ok(!SUC.meal(mh.state, 'stat').out.ok, 'ごはんが大会のあと2回食べられる');
  const ml = SUC.meal({ ...pro, ama: 10, fear: 10 }, 'loyal').state; ok(SUC.loyalOf(ml) === 25, `忠誠のごはんで忠誠 +5 にならない: ${SUC.loyalOf(ml)}`);
  const ms = SUC.meal(pro, 'stat').state; ok(K.every(k => ms.stats[k] > pro.stats[k] || pro.stats[k] >= 999), '能力のごはんで6能力が上がらない');
  ok(!SUC.meal({ ...pro, fame: 10 }, 'hp').out.ok && !SUC.meal(s0, 'hp').out.ok, '名声が足りない・大会のあとでないのに食べられる');
  ok(SUC.evaluate({ ...s0, techs: ['a', 'b', 'c'], mastery: { a: 50, b: 0, c: 100 } }).power > SUC.evaluate(s0).power, '覚えた技と熟練が総合力に入っていない');
}

// ---- 訓練で能力が下がらない・訓練Lv(社長 2026-11-12) ----
{
  let dropped = false;
  for (let i = 0; i < 60 && !dropped; i++) { const t = { ...base, id: `nd-${i}` }; const r = SUC.act(t, { kind: 'train', stat: K[i % 6] }); if (K.some(k => r.state.stats[k] < t.stats[k])) dropped = true; }
  ok(!dropped, '訓練で下がる能力がある(社長: 3能力が上がるだけ)');
  ok(SUC.trainLvOf(0) === 1 && SUC.trainLvOf(4) === 2 && SUC.trainLvOf(22) === 5 && SUC.trainLvOf(999) === 5, '訓練Lv が 1〜5 で上がらない');
  ok(SUC.TRAIN_LV.mult.every((v, i, a) => i === 0 || v > a[i - 1]), '訓練Lv ごとに基礎値が上がらない');
  // 同じ札・同じ乱数で、Lv5 の訓練は Lv1 よりよく伸びる
  let lo = null; let hi = null;
  for (let i = 0; i < 80 && (lo === null || hi === null); i++) {
    const t = { ...base, id: `tl-${i}` }; const r1 = SUC.act(t, { kind: 'train', stat: 'pow' }); if (r1.out.result !== 'ok') continue;
    const r5 = SUC.act({ ...t, trainXp: { 'train:pow': 22 } }, { kind: 'train', stat: 'pow' });
    lo = r1.out.gain.pow; hi = r5.out.gain.pow;
    ok(r1.state.trainXp['train:pow'] === 1, '訓練を踏んでもトレ経験値が増えない');
  }
  ok(hi > lo, `訓練Lv5 が Lv1 より伸びない: ${lo} → ${hi}`);
}

// ---- 修行にも編成の補正がかかる ----
{
  const st = { life: 300, pow: 300, wise: 300, hit: 700, eva: 650, tough: 600 };
  const t0 = { ...SUC.newRun({ id: 'sht', species: 'Mocchi', aid: 'mua' }), turn: 10, tickets: 1 };
  const t1 = { ...SUC.newRun({ id: 'sht', species: 'Mocchi', aid: 'mua', team: Array.from({ length: 6 }, () => ({ kind: 'raised', species: 'Mocchi', stats: st, lv: 30, loy: 70 })) }), turn: 10, tickets: 1, stats: t0.stats };
  const g0 = SUC.act(t0, { kind: 'shugyo', course: 'fire', techs: [] }); const g1 = SUC.act(t1, { kind: 'shugyo', course: 'fire', techs: [] });
  if (g0.out.result === g1.out.result && g0.out.result === 'ok') ok(g1.out.gain.hit > g0.out.gain.hit && g1.out.stages[0].length > 0 && g1.out.stages[0].length <= SUC.SHUGYO.joinMax, `修行に編成の補正がかからない: ${g0.out.gain.hit} → ${g1.out.gain.hit}`);
}

// ---- 再戦(時渡りの砂時計・虹の時渡りの砂時計)・勝った大会のスキップ(社長 2026-11-12) ----
{
  const s0 = { ...SUC.newRun({ id: 'rem', species: 'Mocchi', aid: 'mua', items: { sand: 9, rainbow: 2 }, wonBefore: ['debut'] }), turn: 5, acted: false, battle: { kind: 'debut', round: 0 } };
  ok(s0.items.sand === SUC.REMATCH.carry && s0.items.rainbow === 2, '砂時計の持ちこみが上限で止まらない');
  ok(SUC.canSkip(s0) && !SUC.canSkip({ ...s0, battle: { kind: 'junior', round: 0 } }), '前に勝った大会だけスキップできる になっていない');
  const sa = SUC.rematch(s0, 'sand').state;
  ok(JSON.stringify(SUC.opponents(sa)) === JSON.stringify(SUC.opponents(s0)), '時渡りの砂時計で相手が変わる(同じ相手のはず)');
  const rb = SUC.rematch(sa, 'rainbow').state;
  ok(JSON.stringify(SUC.opponents(rb)) !== JSON.stringify(SUC.opponents(s0)), '虹の時渡りの砂時計で相手が変わらない');
  const r3 = SUC.rematch(rb, 'sand').state;
  ok(r3.rematchUsed === 3 && !SUC.canRematch(r3, 'sand') && !SUC.canRematch(r3, 'rainbow'), '2種類あわせて1回の育成で3回までになっていない');
  ok(!SUC.canRematch({ ...s0, items: { sand: 0, rainbow: 0 } }, 'sand'), '砂時計が無いのにやり直せる');
  // デビュー戦: やり直して勝てば負けに数えない
  const w = SUC.settle(sa, [true]).state; ok(w.debutLoss === 0 && w.debutWon, 'やり直して勝ったデビュー戦が負けに数えられた');
  const won = SUC.settle({ ...s0, wonBefore: [] }, [true]).state; ok(won.wonNow.includes('debut'), '勝った大会が記録されない(次の育成でスキップに使う)');
  const crown = SUC.settle({ ...s0, turn: 41, battle: { kind: 'pro', round: 0 } }, [true, true, true]).state; ok(crown.items.sand === s0.items.sand + 1, '👑 に勝っても砂時計が増えない');
}

// ---- 持ちこみアイテム・よいようす(社長 2026-11-12・ITEMS-REF.md) ----
{
  ok(Object.values(SUC.ITEMS).filter(x => x.use === 'before').length === 7 && Object.values(SUC.ITEMS).filter(x => x.use === 'during').length === 7, '持ちこみの分け方(始める前 7・育成中 5+詰め合わせの中身 2)がずれている');
  ok(Object.keys(SUC.GOOD).sort().join() === 'eventMaker,shugyoGood,star,trainGood,uketsugu', 'よいようすが5つでない');
  const s0 = SUC.newRun({ id: 'it', species: 'Mocchi', aid: 'mua', carry: ['kibidango', 'weekly', 'hachimaki', 'juice'], bag: { juice: 1, pack: 1 } });
  ok(s0.carry.length === 2 && !s0.carry.includes('juice') && s0.hpMax === 120 && s0.good.trainGood && !s0.good.shugyoGood && Object.keys(s0.bag).length === 0, `持ちこみが2つまでになっていない: ${s0.carry} ${JSON.stringify(s0.bag)}`);
  const s1 = SUC.newRun({ id: 'it', species: 'Mocchi', aid: 'mua', carry: ['weekly'], bag: { juice: 3, pack: 1 } });
  ok(s1.bag.juice === 1 && !s1.bag.pack, `始める前の物と育成中の袋を合わせて2つまでになっていない: ${JSON.stringify(s1.bag)}`);
  ok(SUC.ITEMS.issaNote.name === '博士の導き書' && SUC.ITEMS.juice.name === 'ガロエ印の野菜ジュース' && SUC.ITEMS.kibidango.name === 'モモのキビダンゴ', 'アイテムの名前が参考のままでない');
  const u1 = SUC.useItem({ ...s0, hp: 5, bag: { juice: 1, pack: 1 } }, 'juice'); ok(u1.out.ok && u1.state.hp === 120, '野菜ジュースで体力が全部戻らない');
  ok(!SUC.useItem(u1.state, 'pack').out.ok, '1ターンに2個使えてしまう');
  const u2 = SUC.useItem({ ...u1.state, turn: 2 }, 'pack').state; ok(u2.bag.oil === 2 && u2.bag.herb === 1 && u2.bag.pack === 0, '詰め合わせの中身(オイル2・薬草1)が入らない');
  const u3 = SUC.useItem({ ...u2, turn: 3, hp: 0, yosu: { sabori: { visits: 0 }, utsu: { visits: 0 } }, bag: { powder: 1 } }, 'powder').state; ok(!u3.yosu.sabori && !u3.yosu.utsu && u3.hp === 36, '粉薬で悪いようすが治らない・体力が戻らない');
  const u4 = SUC.useItem({ ...s0, ama: 10, fear: 10, bag: { license: 1 } }, 'license').state; ok(SUC.loyalOf(u4) === 30, '育成ライセンスで忠誠度が上がらない');
  // 研究ノート: 来られる最初のターンに博士が必ず来る/ルーペ: 実験が必ず成功
  const note = { ...SUC.newRun({ id: 'note', species: 'Mocchi', aid: 'mua', carry: ['issaNote'] }), turn: 12, acted: true };
  ok(SUC.issaComes(note) && !SUC.issaComes({ ...note, turn: 11 }), '研究ノートで博士が来ない(ジュニア期の7ターン目から)');
  const lou = SUC.useItem({ ...note, bag: { issaLoupe: 1 } }, 'issaLoupe').state; const ex = SUC.issa(lou, 'stat'); ok(ex.out.win === true, 'ルーペを使ったのに博士の実験が失敗した');
  // トレーニング得意で訓練の伸びが上がる
  const t0 = SUC.newRun({ id: 'tg', species: 'Mocchi', aid: 'mua' }); const t1 = SUC.newRun({ id: 'tg', species: 'Mocchi', aid: 'mua', carry: ['weekly'] });
  const a0 = SUC.act(t0, { kind: 'train', stat: 'pow' }); const a1 = SUC.act(t1, { kind: 'train', stat: 'pow' });
  if (a0.out.result === 'ok' && a1.out.result === 'ok') ok(a1.out.gain.pow > a0.out.gain.pow, 'トレーニング得意で伸びが上がらない');
}

if (errors.length) { console.error(`NG monhero-success-check: ${errors.length}件`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
console.log('OK monhero-success-check: 46ターン・決まった乱数・結果4種・休む/遊ぶ/通院・忠誠・編成とタッグ・イッサ博士・大会の流れ・修行と技・訓練Lv・再戦とスキップ・持ちこみ');
