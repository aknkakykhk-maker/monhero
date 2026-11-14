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
// ごはんの効き目の確かめ用: その品が並んだ(mealOpts)ことにする(2026-11-14 並ぶのは9種から3つ)
const OPT3 = (k) => [k, ...Object.keys(SUC.MEALS).filter((z) => z !== k).slice(0, 2)];
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
  // 編成は前と同じ全員モッチーで比べる(2026-11-14 から空き枠は育てる子と別の種で埋まり、編成の出来事が混ざるため)
  let s = SUC.newRun({ id: 'mult', species: 'Mocchi', aid: 'mua', pol: -3, team: Array.from({ length: 6 }, () => ({ kind: 'base', species: 'Mocchi' })) });
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

// ---- 甘え度・恐れ度は下がらない(社長 2026-11-14 r1114-115) ----
{
  let bad = 0;
  for (const res of ['great', 'ok', 'fail', 'sab']) for (const how of ['praise', 'scold', null]) for (const pol of [-3, 0, 3]) {
    for (const buff of [false, true]) {
      const s0 = { ...base, ama: 20, fear: 20, pol, pp: 0, idle: 3, last: { kind: 'train', res }, reacted: false, buffs: buff ? [{ id: 'futekusare', left: 2 }] : base.buffs };
      const r = SUC.react(s0, how); if (!r.out.ok) continue;
      if (r.state.ama < 20 || r.state.fear < 20) bad++;
    }
  }
  ok(bad === 0, `褒める・叱る・ほうっておくで甘え度・恐れ度が下がる経路がある(${bad}件)`);
  const L = SUC.LOYAL, C = SUC.COND;
  ok([L.praiseGood, L.praiseBad, L.scoldGood, L.scoldBad, L.win, L.loseScold, L.idle].every(v => v[0] >= 0 && v[1] >= 0) && C.awayAma >= 0 && C.awayFear >= 0, '忠誠度の表に負の値がある');
}

// ---- 忠誠度 ----
{
  let s = { ...base, last: { kind: 'train', res: 'great' }, reacted: false };
  for (let i = 0; i < 40; i++) s = SUC.react({ ...s, last: { kind: 'train', res: 'great' }, reacted: false, pol: 0, pp: 0 }, 'praise').state;
  // 2026-11-14 ふつうの成功では叱る・褒めるを出さない(なにもしない だけ受け付ける)
  const okR = SUC.react({ ...base, last: { kind: 'train', res: 'ok' }, reacted: false }, 'praise'); ok(!okR.out.ok && okR.out.why === 'no-scene', '成功のあとに褒めるが通ってしまう');
  ok(SUC.react({ ...base, last: { kind: 'train', res: 'ok' }, reacted: false }, null).out.ok, '成功のあとの「なにもしない」が通らない');
  ok(['great', 'fail', 'sab'].every((r) => SUC.reactOf({ last: { kind: 'train', res: r } }) === r) && SUC.reactOf({ last: { kind: 'shugyo' } }) === 'shugyo' && SUC.reactOf({ last: { kind: 'train', res: 'ok' } }) === null, 'reactOf の場面が違う');
  const d = SUC.react({ ...base, last: { kind: 'train', res: 'fail' }, reacted: false }, 'scold').out.d; ok(d && d.fear > 0, `叱ったあとの変わった物 d が無い: ${JSON.stringify(d)}`);
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
  // かけつけ 段3 の得意率(表の値で出す。第1版 +20 → 0.85・第2版 +12 → 0.77。2026-11-12)
  ok(near(m.fav, Math.min(SUC.GATHER.favCap, SUC.GATHER.fav + SUC.ASSISTS.kaketsuke.v[m.assists.find(x => x.id === 'kaketsuke').lv - 1] / 100), 1e-9) && SUC.ASSISTS.kaketsuke.v[m.assists.find(x => x.id === 'kaketsuke').lv - 1] === 12 && m.assists.length === 2, `かけつけの得意率・同じアシストの重なりがおかしい: ${m.fav} ${m.assists.length}`);
  ok(m.startAdd.stat === 'pow' && m.startAdd.v === 24, `はじめの能力が 1位 ÷ 25 でない: ${JSON.stringify(m.startAdd)}`);
  const so2 = SUC.ASSISTS.sokoji.v[m.assists.find(x => x.id === 'sokoji').lv - 1]; // 古い子の段2 は第3版の目盛り10(+10%)に読み替わる(2026-11-14)
  ok(so2 === 10, `古い子の段2 の底力が +10% のままでない: ${so2}`);
  ok(SUC.memberEffect(m, 'life', 0) === so2 && SUC.memberEffect(m, 'pow', 0) === m.bonus.pow + so2, '4位以下のトレーニングで補正0%・アシストは効く になっていない');
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
  // 負け → 再挑戦(トレーニングできない・相手は1割ずつ弱く)
  s = SUC.settle(s, [false]).state;
  ok(s.turn === 6 && !s.over && SUC.peek(s).can.join() === 'retry', '負けたあとのジュニア期が再挑戦だけになっていない');
  ok(!SUC.act(s, { kind: 'train', stat: 'pow' }).out.ok, '再挑戦のターンにトレーニングできてしまう');
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
  ok(w.battle && w.battle.kind === 'junior' && w.turn === 17 && SUC.opponents(w).length === 1, `ジュニアしめくくり杯(2試合)が17ターン目の終わりに来ない: ${w.turn}`);
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
  // 決勝の全能力の上乗せは、エンディングのお祝いへ置きかえた(2026-11-13)。称号・能力ポイントはそのまま
  ok(w.over === 'done' && w.titles.includes('真のヒーロー') && w.ending && ['good', 'super'].includes(w.ending.kind)
    && w.stats.life === Math.min(999, pre.life + SUC.PARTY[w.ending.kind].reduce((a, n) => a + n, 0)), `決勝に勝ったあとのエンディングとお祝いがずれている: ${JSON.stringify(w.ending)}`);
  ok(lose.ending && lose.ending.kind === 'bad' && lose.ending.parties.length === 1, '頂への道で負けてもバッドエンディングが付かない');
  const ev = SUC.evaluate(w); ok(Number.isFinite(ev.power) && Number.isFinite(ev.powerS) && ev.powerS <= ev.power && ev.points === SUC.assistPointsOf(ev.powerS), '評価(総合力・アシストポイント)が出ない(アシストポイントは今までの数え方の総合力 powerS から・案A)');
}

// ---- 能力ポイント ----
{
  const s = { ...base, turn: 25, pts: 10, stats: { ...base.stats, pow: 499, wise: 600 } };
  const a = SUC.spendPts(s, 'pow', 3).state; ok(a.stats.pow === 502 && a.pts === 5, `目安(ミドル 500)を超えると2点で+1 になっていない: ${a.stats.pow}/${a.pts}`);
  const b = SUC.autoPts({ ...base, pts: 7 }).state; ok(b.pts === 0, 'おまかせで点が残る');
}

// ---- 修行(社長 2026-11-12: チケット・2段で能力2つずつ・最後に技のくじ・外すと次の率が上がる) ----
{
  const s0 = SUC.newRun({ id: 'shu', species: 'Mocchi', aid: 'mua', team: Array.from({ length: 6 }, () => ({ kind: 'base', species: 'Mocchi' })) }); // 編成の得意の上乗せを前と同じにそろえる
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
  // 試す技: 初めからではなく、ほかの技の熟練を要らない技(技表の第1版でも第2版でも同じ選び方。2026-11-13)
  const full = { life: 999, pow: 999, wise: 999, hit: 999, eva: 999, tough: 999 };
  const light = SUC.techsOf('Mocchi').find(t => !(t.learn && (t.learn.start || t.learn.need)) && t.role === 'skill') || SUC.techsOf('Mocchi').find(t => !(t.learn && (t.learn.start || t.learn.need)));
  ok(SUC.canLearn({ ...j, stats: full }, light), '条件を満たした技が覚えられない');
  // 修行の作り直し(2026-11-13 社長): 技ごとに外した回数 ×15・ランク1〜5 のもとの率と仕上がりの幅(q=1 でちょうど 99)・上限 99・超修行 +15
  ok(near(SUC.techRate({ ...j, techMiss: { [light.id]: 2 } }, light), Math.min(SUC.SHUGYO.rateTop / 100, SUC.techRate(j, light) + 0.30), 1e-9), '外した分だけ、その技の次の率が上がらない(上限 99%)');
  ok(near(SUC.techRate({ ...j, techMiss: { other: 2 } }, light), SUC.techRate(j, light), 1e-9), 'ほかの技を外した分が、この技の率に入っている');
  ok(SUC.SHUGYO.rank.base.every((b, i) => b + SUC.SHUGYO.rank.spread[i] === SUC.SHUGYO.rateTop) && SUC.SHUGYO.rateTop === 99, 'ランクごとの幅が、仕上がり q=1 でちょうど 99 に届かない');
  ok(near(SUC.techRate(j, light, { course: 'star', super: true }) - SUC.techRate(j, light, { course: 'star' }), 0.15, 1e-9), '超修行の率 +15 が効いていない');
  let missSeen = false; let hitSeen = false;
  for (let i = 0; i < 300 && !(missSeen && hitSeen); i++) {
    const t = { ...j, id: `shu-${i}`, stats: { ...j.stats, wise: 999, pow: 999 }, techMiss: {} };
    const x = SUC.act(t, { kind: 'shugyo', course: 'star', techs: [light.id] });
    if (x.out.result === 'sab') continue;
    if (x.out.learned) { hitSeen = true; ok(x.state.techs.includes(light.id) && !(x.state.techMiss || {})[light.id] && x.state.mastery[light.id] === 0, '技を覚えたのに一覧・外した回数・熟練がずれている'); }
    else { missSeen = true; ok((x.state.techMiss || {})[light.id] === 1, '外したのに、その技の外した回数が増えない'); }
  }
  ok(missSeen && hitSeen, '修行の技のくじで、当たり・外れの両方が出ない');
  // 超修行: 2つ選ぶと育成中2回まで・残り0なら断る・能力の上がりは2回分
  {
    const base = { ...j, stats: full, tickets: 5 };
    const two = SUC.techsOf('Mocchi').filter(x => SUC.canLearn(base, x)).slice(0, 2).map(x => x.id);
    ok(two.length === 2, '超修行を試す技が2つ見つからない');
    const one = SUC.act(base, { kind: 'shugyo', course: 'fire', techs: [two[0]] }); const sup = SUC.act(base, { kind: 'shugyo', course: 'fire', techs: two });
    ok(one.out.ok && !one.out.super && one.state.superLeft === SUC.SHUGYO.superMax, '技1つの修行で超修行の回数が減る');
    ok(sup.out.ok && sup.out.super && sup.state.superLeft === SUC.SHUGYO.superMax - 1 && sup.state.tickets === base.tickets - SUC.SHUGYO.superTickets, '超修行で回数・チケット(2枚)がずれている');
    ok(!SUC.act({ ...base, tickets: 1 }, { kind: 'shugyo', course: 'fire', techs: two }).out.ok && SUC.act({ ...base, tickets: 1 }, { kind: 'shugyo', course: 'fire', techs: [two[0]] }).out.ok, 'チケット1枚で超修行が選べる/ふつうの修行ができない');
    ok(sup.state.hp < one.state.hp, '超修行の疲れが2回分になっていない');
    ok(!SUC.act({ ...base, superLeft: 0 }, { kind: 'shugyo', course: 'fire', techs: two }).out.ok, '超修行の残りが0なのに2つ選べる');
    const old = SUC.restore(JSON.parse(JSON.stringify({ ...base, techMiss: undefined, superLeft: undefined })));
    ok(old && JSON.stringify(old.techMiss) === '{}' && old.superLeft === SUC.SHUGYO.superMax, '古い保存(外した回数・超修行の残りなし)が 0回・2回残りで読めない');
  }
  // 編成の子からの伝授: 同じ種ならその技、違う種なら同じ役割の技
  const sameSp = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: { life: 300, pow: 500, wise: 300, hit: 300, eva: 300, tough: 300 }, techs: SUC.techsOf('Mocchi').map(t => t.id) });
  const tid = SUC.teachFrom(j, sameSp); ok(tid && !j.techs.includes(tid) && SUC.techsOf('Mocchi').some(t => t.id === tid), `同じ種の子から技を教わらない: ${tid}`);
  const other = SUC.memberOf({ kind: 'raised', species: 'Golem', stats: { life: 300, pow: 500, wise: 300, hit: 300, eva: 300, tough: 300 }, techs: SUC.techsOf('Golem').map(t => t.id) });
  const tid2 = SUC.teachFrom(j, other); const role = (SUC.techsOf('Golem').find(t => SUC.techsOf('Mocchi').find(m => m.id === tid2 && m.role === t.role)) || null);
  ok(tid2 && role, `違う種の子から同じ役割の技を教わらない: ${tid2}`);
  // 大会に勝つとチケット(賞金が大きいほど多い)と名声。負けると準優勝などの一部の賞金だけ
  const b = SUC.settle({ ...s0, turn: 5, acted: false, battle: { kind: 'debut', round: 0 } }, [true]).state;
  ok(b.tickets === s0.tickets + 2 && b.fame === SUC.PRIZE.debut && b.fameRank === 2, `デビュー戦に勝っても賞金ランク2段ぶんのチケット・名声が入らない: ${b.tickets - s0.tickets}`);
  // 賞金ランク10段(2026-11-14 社長): 段が上がるたびに1枚・上がらなければ KEEP・古い途中の育成はいまの段で埋めて配り直さない
  { ok(SUC.FAME_RANK.length === 10 && SUC.FAME_RANK[9].name === 'ヒーロー' && SUC.rankStepOf(s0) === 0, '賞金ランクが10段・いちばん上がヒーローでない');
    const lg = (w, l) => ({ ...s0.log, wins: w, losses: l });
    ok(SUC.rankStepOf({ ...s0, log: lg(0, 1), fameTotal: 99999 }) === 1 && SUC.rankStepOf({ ...s0, log: lg(1, 0), fameTotal: 1499 }) === 2 && SUC.rankStepOf({ ...s0, log: lg(1, 0), fameTotal: 8000 }) === 6 && SUC.rankStepOf({ ...s0, log: lg(3, 0), fameTotal: 50000 }) === 10, '賞金ランクの段の数え方がずれている');
    const rs = SUC.restore(JSON.parse(JSON.stringify({ ...s0, log: lg(2, 0), fameTotal: 9000, fameRank: undefined }))); ok(rs.fameRank === 6, `古い途中の育成の賞金ランクが いまの段で埋まらない: ${rs.fameRank}`);
    const k2 = SUC.settle({ ...b, turn: 6, acted: false, battle: { kind: 'cup', sys: 'str', star: 1, round: 0 } }, [false]); ok(k2.out.rankKeep && k2.state.tickets === b.tickets, '段が上がらないのにチケットが入る・KEEP が出ない');
    // 負けても獲得賞金の合計で段が上がる(2026-11-14 社長): 準優勝の賞金で 一人前(1500G) を越えたら1段・チケット1枚
    const k3 = SUC.settle({ ...b, fameTotal: 1490, turn: 6, acted: false, battle: { kind: 'cup', sys: 'str', star: 3, round: 0 } }, [false]); ok(k3.out.rankUp && k3.state.fameRank === 3 && k3.state.tickets === b.tickets + 1 && !k3.state.mealReady, `負けたとき獲得賞金の合計で賞金ランクが上がらない: ${k3.state.fameRank}`); }
  const pro = SUC.settle({ ...s0, turn: 41, acted: false, battle: { kind: 'pro', round: 0 } }, [true, true, true]).state;
  ok(pro.tickets - s0.tickets > b.tickets - s0.tickets, '賞金の大きい大会ほどチケットが多くない');
  const runner = SUC.settle({ ...s0, turn: 41, acted: false, battle: { kind: 'pro', round: 0 } }, [false]).state;
  ok(runner.tickets === s0.tickets + 1 && runner.fame === Math.round(SUC.PRIZE.pro * 0.4), 'ヒーロー記念で負けたとき準優勝の賞金(40%)と、ルーキーの段の1枚だけになっていない');
  ok(runner.mealReady === false, '大会に負けたのにごはんを選べる(2026-11-13 社長: 勝ったときだけ)');
  // ごほうびのごはん(2026-11-13 社長: 9種に作り直し・体力は回復だけ・賞金を使う・大会のあと1回だけ)
  // 2026-11-14 社長: 並ぶのは9種から3つ(くじ・同じ物なし・保存して引き直しにならない)。下の効き目の確かめでは、その品が並んだことにする
  {
    const o3 = pro.mealOpts; ok(Array.isArray(o3) && o3.length === 3 && new Set(o3).size === 3 && o3.every((k) => SUC.MEALS[k]), `勝ったあとに並ぶごはんが9種から3つでない: ${JSON.stringify(o3)}`);
    ok(JSON.stringify(SUC.mealOpts(pro)) === JSON.stringify(o3), '並ぶ3つ(mealOpts)が保存の値と違う');
    const back = SUC.restore(JSON.parse(JSON.stringify(pro))); ok(JSON.stringify(SUC.mealOpts(back)) === JSON.stringify(o3), '保存から戻すと並ぶ3つが変わる');
    const old = SUC.restore(JSON.parse(JSON.stringify({ ...pro, mealOpts: undefined }))); ok(JSON.stringify(SUC.mealOpts(old)) === JSON.stringify(o3), '古い途中の育成(mealOpts なし)で、くじが引き直しになる');
    const out = Object.keys(SUC.MEALS).find((k) => !o3.includes(k)); ok(!SUC.meal(pro, out).out.ok, '並んでいないごはんが食べられる');
    ok(SUC.meal(pro, o3[0]).out.ok && SUC.meal(pro, o3[0]).state.mealOpts === null, '並んだごはんが食べられない・食べたあとに並びが残る');
    const kinds = new Set(); for (let i = 0; i < 60; i++) SUC.mealOpts({ ...pro, id: `meal3-${i}`, mealOpts: null }).forEach((k) => kinds.add(k)); ok(kinds.size === 9, `くじで出ないごはんがある: ${kinds.size}種`);
  }
  ok(Object.keys(SUC.MEALS).sort().join() === 'f_eva,f_hit,f_life,f_pow,f_tough,f_wise,gochiso,prune,vitamin', `ごはんが9種でない: ${Object.keys(SUC.MEALS).sort().join()}`);
  // 2026-11-14 社長「名前も効き目も参考に合わせる」: ごはんは体力を回復しない。能力の6品は その能力 +15・甘え +2・恐れ +2/スタープルーンは持ち物に1つ
  const mh = SUC.meal({ ...pro, hp: 10, ama: 10, fear: 10, mealOpts: OPT3('vitamin') }, 'vitamin'); ok(mh.out.ok && mh.state.hp === 10 && mh.state.hpMax === pro.hpMax && mh.state.fear === 15 && mh.state.ama === 10 && mh.state.fame === pro.fame && !mh.state.mealReady, 'ホッカイイラブの効き目(恐れ +5・体力は回復しない)が違う');
  ok(!SUC.meal({ ...mh.state, mealOpts: OPT3('prune') }, 'prune').out.ok, 'ごはんが大会のあと2回食べられる');
  const mg = SUC.meal({ ...pro, ama: 10, fear: 10, mealOpts: OPT3('gochiso') }, 'gochiso').state; ok(mg.ama === 15 && mg.fear === 10, `アルタケーキで甘え +5 にならない: ${mg.ama}`);
  const mf = SUC.meal({ ...pro, hp: 10, stats: { ...pro.stats, pow: 100 }, mealOpts: OPT3('f_pow') }, 'f_pow').state; ok(mf.stats.pow === 115 && mf.hp === 10 && K.filter(k => k !== 'pow').every(k => mf.stats[k] === pro.stats[k]), 'パワフルーツで ちから +15・体力そのまま にならない');
  const mp = SUC.meal({ ...pro, pop: 20, pts: 0, bag: {}, mealOpts: OPT3('prune') }, 'prune').state; ok(mp.pop === 20 && mp.pts === 0 && mp.bag.prune === 1, `スタープルーンが持ち物に入らない: ${JSON.stringify(mp.bag)}`);
  { const u = SUC.useItem({ ...mp, itemTurn: -1 }, 'prune'); ok(u.out.ok && u.state.popTurn === mp.turn && u.state.bag.prune === 0, 'スタープルーンが使えない');
    const back = SUC.restore(JSON.parse(JSON.stringify(u.state))); ok(back.popTurn === mp.turn, 'スタープルーンの印が読み直しで消える'); }
  { // 2026-11-14 社長: 能力の餌・スタープルーンでも甘え度・恐れ度が上がる(方針の段の補正つき)・あげずに進むと恐れ度 +1
    const L0 = { ...pro, ama: 10, fear: 10, pol: 0 };
    const want = { f_life: [2, 2], f_pow: [2, 2], f_wise: [2, 2], f_hit: [2, 2], f_eva: [2, 2], f_tough: [2, 2], prune: [0, 0], vitamin: [0, 5], gochiso: [5, 0] };
    for (const [k, [a, f]] of Object.entries(want)) { const r = SUC.meal({ ...L0, mealOpts: OPT3(k) }, k).state; ok(r.ama === 10 + a && r.fear === 10 + f, `${k} で甘え +${a}・恐れ +${f} にならない: 甘え ${r.ama} 恐れ ${r.fear}`); }
    const sweet = SUC.meal({ ...L0, pol: -3, mealOpts: OPT3('f_pow') }, 'f_pow').state; ok(sweet.ama === 13, `甘い方針(-3)で甘え +2 に補正(×1.5)がかからない: ${sweet.ama}`);
    const sk = SUC.mealSkip(L0); ok(sk.out.ok && sk.state.fear === 11 && sk.state.ama === 10 && !sk.state.mealReady && !sk.state.mealOpts, `あげずに進むと恐れ度 +1・ごはんが閉じる にならない: ${JSON.stringify({ f: sk.state.fear, r: sk.state.mealReady })}`);
    ok(!SUC.mealSkip(sk.state).out.ok && sk.state.fear === 11, 'あげずに進むが2回きく');
  }
  ok(SUC.meal({ ...pro, fame: 0, mealOpts: OPT3('vitamin') }, 'vitamin').out.ok && !SUC.meal(s0, 'vitamin').out.ok && !SUC.meal(pro, 'hp').out.ok, '賞金0で食べられない・大会のあとでない・前のごはんの名前で食べられる');
  { // 総合力の技の分(2026-11-13 社長): 覚えた技は全部数える・熟練は入れない・ランクの値 × 間合い適性の補正
    const all = SUC.techsOf(s0.species).map(t => t.id);
    ok(SUC.evaluate({ ...s0, techs: all.slice(0, 4), mastery: {} }).power > SUC.evaluate({ ...s0, techs: all.slice(0, 2), mastery: {} }).power, '覚えた技が総合力に入っていない');
    ok(SUC.evaluate({ ...s0, techs: all.slice(0, 3), mastery: Object.fromEntries(all.map(t => [t, 100])) }).power === SUC.evaluate({ ...s0, techs: all.slice(0, 3), mastery: {} }).power, '熟練が総合力に入っている(入れない決め)');
    ok(SUC.techPowerOfRows([{ r: 1, a: 'C' }, { r: 5, a: 'A' }, { r: 3, a: 'G' }, { r: 2, a: 'M' }]) === 40 + 640 * 1.2 + 160 * 0.6 + 80 * 1.7, '技の分の式(ランクの値 ×(1 +(段 − C)× 0.1))がずれている');
    ok(SUC.evaluate(s0).techRows.length === s0.techs.length, '評価に技ごとの { r, a } が無い(ランキングに送る形)');
  }
  { // 熟練(2026-11-13 社長): 修行では上がらない・試合で使うごと +2(1試合1技 +6 まで)・大会に出るたび全部の技 +2・効き目は熟練100で威力 +10%・命中 +5%
    const b0 = { ...s0, turn: 5, acted: false, battle: { kind: 'debut', round: 0 }, techs: s0.techs.slice(0, 2), mastery: {} };
    const [t1, t2] = b0.techs;
    const g = SUC.settle(b0, [true], { [t1]: 5, [t2]: 1 }).state;
    ok(g.mastery[t1] === 2 + 6 && g.mastery[t2] === 2 + 2, `試合の熟練の付き方がずれている: ${JSON.stringify(g.mastery)}`);
    ok(SUC.settle(b0, [false]).state.mastery[t1] === 2, '大会に出ただけで全部の技 +2 にならない');
    const tb = SUC.techBoostOf({ techs: [t1, t2], mastery: { [t1]: 100, [t2]: 50 } });
    ok(tb[t1].pow === 0.1 && tb[t1].hit === 0.05 && tb[t2].pow === 0.05 && tb[t2].hit === 0.025 && tb[t1].guts === 0, `熟練の効き目がずれている: ${JSON.stringify(tb)}`);
    ok(SUC.SHUGYO.mastery === 0, '修行で熟練が上がる(上げない決め)');
    ok(JSON.stringify(SUC.techUseOf([{ ev: 'tech', side: 'A', move: 'x' }, { ev: 'tech', side: 'B', move: 'x' }, { ev: 'tech', side: 'A', move: 'x' }, { ev: 'move', side: 'A' }], 'A')) === '{"x":2}', '試合の記録から技の使った回数を数えられない');
    const sp = SUC.restore(JSON.parse(JSON.stringify({ ...b0, masterySpent: { [t1]: 7, zz: 3 } })));
    ok(sp && sp.masterySpent && sp.masterySpent[t1] === 7 && !('zz' in sp.masterySpent), '熟練の使った量(masterySpent)が保存から戻らない');
  }
}

// ---- トレーニングで能力が下がらない・トレーニングLv(社長 2026-11-12) ----
{
  let dropped = false;
  for (let i = 0; i < 60 && !dropped; i++) { const t = { ...base, id: `nd-${i}` }; const r = SUC.act(t, { kind: 'train', stat: K[i % 6] }); if (K.some(k => r.state.stats[k] < t.stats[k])) dropped = true; }
  ok(!dropped, 'トレーニングで下がる能力がある(社長: 3能力が上がるだけ)');
  ok(SUC.trainLvOf(0) === 1 && SUC.trainLvOf(4) === 2 && SUC.trainLvOf(22) === 5 && SUC.trainLvOf(999) === 5, 'トレーニングLv が 1〜5 で上がらない');
  ok(SUC.TRAIN_LV.mult.every((v, i, a) => i === 0 || v > a[i - 1]), 'トレーニングLv ごとに基礎値が上がらない');
  // 同じ札・同じ乱数で、Lv5 のトレーニングは Lv1 よりよく伸びる
  let lo = null; let hi = null;
  for (let i = 0; i < 80 && (lo === null || hi === null); i++) {
    const t = { ...base, id: `tl-${i}` }; const r1 = SUC.act(t, { kind: 'train', stat: 'pow' }); if (r1.out.result !== 'ok') continue;
    const r5 = SUC.act({ ...t, trainXp: { 'train:pow': 22 } }, { kind: 'train', stat: 'pow' });
    lo = r1.out.gain.pow; hi = r5.out.gain.pow;
    ok(r1.state.trainXp['train:pow'] === 1, 'トレーニングを踏んでもトレ経験値が増えない');
  }
  ok(hi > lo, `トレーニングLv5 が Lv1 より伸びない: ${lo} → ${hi}`);
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
  ok(Object.values(SUC.ITEMS).filter(x => x.use === 'before').length === 7 && Object.values(SUC.ITEMS).filter(x => x.use === 'during').length === 22, '持ちこみの分け方(始める前 7・育成中 5+詰め合わせの中身 3+大会の賞品 11+覚醒の実 2+スタープルーン 1)がずれている');
  ok(Object.keys(SUC.GOOD).sort().join() === 'eventMaker,shugyoGood,star,trainGood,uketsugu', 'よいようすが5つでない');
  const s0 = SUC.newRun({ id: 'it', species: 'Mocchi', aid: 'mua', carry: ['dango', 'mag', 'hachi', 'juice'], bag: { juice: 1, pack: 1 } });
  ok(s0.carry.length === 2 && !s0.carry.includes('juice') && s0.hpMax === 120 && s0.good.trainGood && !s0.good.shugyoGood && Object.keys(s0.bag).length === 0, `持ちこみが2つまでになっていない: ${s0.carry} ${JSON.stringify(s0.bag)}`);
  const s1 = SUC.newRun({ id: 'it', species: 'Mocchi', aid: 'mua', carry: ['mag'], bag: { juice: 3, pack: 1 } });
  ok(s1.bag.juice === 1 && !s1.bag.pack, `始める前の物と育成中の袋を合わせて2つまでになっていない: ${JSON.stringify(s1.bag)}`);
  ok(SUC.ITEMS.guide.name === '博士の導き書' && SUC.ITEMS.juice.name === 'ガロエ印の野菜ジュース' && SUC.ITEMS.dango.name === 'モモのキビダンゴ', 'アイテムの名前が参考のままでない');
  const u1 = SUC.useItem({ ...s0, hp: 5, bag: { juice: 1, pack: 1 } }, 'juice'); ok(u1.out.ok && u1.state.hp === 120, '野菜ジュースで体力が全部戻らない');
  ok(!SUC.useItem(u1.state, 'pack').out.ok, '1ターンに2個使えてしまう');
  const u2 = SUC.useItem({ ...u1.state, turn: 2 }, 'pack').state; ok(u2.bag.oilyoil === 2 && u2.bag.herb === 1 && u2.bag.pack === 0, '詰め合わせの中身(オイリーオイル2・薬草1)が入らない');
  ok(SUC.useItem({ ...s0, hp: 0, bag: { oilyoil: 1 } }, 'oilyoil').state.hp === Math.round(s0.hpMax * 0.4) && SUC.useItem({ ...s0, hp: 0, bag: { oil: 1 } }, 'oil').state.hp === Math.round(s0.hpMax * 0.2), 'オイリーオイル(上限の40%)・オイル(上限の20%)の回復がずれている');
  const u3 = SUC.useItem({ ...u2, turn: 3, hp: 0, yosu: { sabori: { visits: 0 }, utsu: { visits: 0 } }, bag: { powder: 1 } }, 'powder').state; ok(!u3.yosu.sabori && !u3.yosu.utsu && u3.hp === 36, '粉薬で悪いようすが治らない・体力が戻らない');
  const u4 = SUC.useItem({ ...s0, ama: 10, fear: 10, bag: { license: 1 } }, 'license').state; ok(u4.ama === 20 && u4.fear === 20, `ブリーダーライセンスで甘え度 +10・恐れ度 +10 にならない: ${u4.ama}/${u4.fear}`);
  // 研究ノート: 来られる最初のターンに博士が必ず来る/ルーペ: 実験が必ず成功
  const note = { ...SUC.newRun({ id: 'note', species: 'Mocchi', aid: 'mua', carry: ['guide'] }), turn: 12, acted: true };
  ok(SUC.issaComes(note) && !SUC.issaComes({ ...note, turn: 11 }), '研究ノートで博士が来ない(ジュニア期の7ターン目から)');
  const lou = SUC.useItem({ ...note, bag: { loupe: 1 } }, 'loupe').state; const ex = SUC.issa(lou, 'stat'); ok(ex.out.win === true, 'ルーペを使ったのに博士の実験が失敗した');
  // トレーニング得意でトレーニングの伸びが上がる
  const t0 = SUC.newRun({ id: 'tg', species: 'Mocchi', aid: 'mua' }); const t1 = SUC.newRun({ id: 'tg', species: 'Mocchi', aid: 'mua', carry: ['mag'] });
  const a0 = SUC.act(t0, { kind: 'train', stat: 'pow' }); const a1 = SUC.act(t1, { kind: 'train', stat: 'pow' });
  if (a0.out.result === 'ok' && a1.out.result === 'ok') ok(a1.out.gain.pow > a0.out.gain.pow, 'トレーニング得意で伸びが上がらない');
}

// ---- 月の大会・常連と王者・ライバル・組み合わせ表(社長 2026-11-12: 大会は1戦・ほかの試合は演出) ----
{
  const s0 = SUC.newRun({ id: 'cup', species: 'Mocchi', aid: 'mua', rivals: [{ kind: 'aid', name: 'みゅあのマスモン', species: 'Golem', stats: { life: 900, pow: 999, wise: 100, hit: 500, eva: 300, tough: 900 } }] });
  ok(SUC.cupsOf({ ...s0, turn: 3 }).length === 0, 'デビュー期に月の大会が並ぶ');
  const j = { ...s0, turn: 6, stats: { ...s0.stats, pow: 200 } };
  const cj = SUC.cupsOf(j); ok(cj.length === 2 && cj.every(c => c.star === 1) && cj[0].sys === 'str' && cj[0].entry.ok, `ジュニア1月の大会(ちから自慢・間合い 零 ★)がずれている: ${JSON.stringify(cj.map(c => c.id))}`);
  ok(!SUC.canEnter({ ...j, stats: { ...j.stats, pow: 100 } }, cj[0]).ok, '自慢の大会の能力の条件(ジュニア 150)が効かない');
  const mid = { ...s0, turn: 18, stats: { ...s0.stats, pow: 400 } }; const cm = SUC.cupsOf(mid);
  // ミドル1月は、月の並び2つ(銀・銅) + 第2版(間合いトーナメント4つ)。四大大会の1つ目(グレイテスト4)はミドル3月
  const cmRow = cm.filter(c => !c.ex);
  ok(cmRow.length === 2 && cmRow[0].star === 2 && !cmRow[0].entry.ok && cmRow[0].entry.why === 'chain', `ミドルの ★★ がジュニアで優勝していなくても出られる: ${JSON.stringify(cm.map(c => c.id))}`);
  ok(SUC.cupsOf({ ...mid, wonNow: ['str:1'] }).filter(c => !c.ex)[0].entry.ok, 'ジュニアで優勝したのにミドルの ★★ に出られない');
  // 第2版: 四大大会の出る条件(賞金の段)・間合いトーナメント・制覇
  const mid3 = { ...mid, turn: 20 }; const cm3 = SUC.cupsOf(mid3);
  const four = cm3.find(c => c.sys === 'four1');
  ok(four && four.ex && four.prize === 12500 && !four.entry.ok && four.entry.why === 'rank', `四大大会の賞金の段の条件が効かない: ${JSON.stringify(four && four.entry)}`);
  ok(SUC.cupsOf({ ...mid3, fameTotal: 8000, log: { ...mid.log, wins: 1 } }).find(c => c.sys === 'four1').entry.ok && !SUC.cupsOf({ ...mid3, fameTotal: 7999, log: { ...mid.log, wins: 1 } }).find(c => c.sys === 'four1').entry.ok, '賞金ランクが はなまる(8,000G)で四大大会に出られる、にならない');
  ok(cm.filter(c => c.sys.startsWith('distT')).length === 4, '間合いトーナメント4つが並ばない');
  const pc = SUC.cupsOf({ ...s0, turn: 30 }).find(c => c.sys === 'distC0'); // プロ期1月(ターン30)
  ok(pc && !pc.entry.ok && pc.entry.why === 'won' && pc.entry.wonSys === 'distT0', `間合いチャンピオンズの「◯◯ 優勝で」が効かない: ${JSON.stringify(pc && pc.entry)}`);
  { // 四大大会を4つ勝つと制覇(一度きり)
    const wonAll = SUC.EX_CUPS.filter(c => c.four).map(c => `${c.sys}:${c.star}`);
    const before = { ...s0, turn: 18, fameTotal: 60000, wonNow: wonAll.slice(0, 3), battle: { kind: 'cup', id: 'x', sys: 'four4', star: 4, round: 0 } }; // 残り1つ(four4)に勝つ
    const r1 = SUC.settle(before, true);
    ok(r1.out.fourDone && r1.state.fourDone && r1.state.titles.includes(SUC.FOUR_DONE.title), '四大大会を4つ勝っても制覇が起きない');
    const r2 = SUC.settle({ ...r1.state, battle: { kind: 'cup', id: 'x', sys: 'four1', star: 4, round: 0 } }, true);
    ok(!r2.out.fourDone, '四大大会の制覇が二度起きる');
  }
  const pro6 = SUC.cupsOf({ ...s0, turn: 35, fameTotal: 5000 }); ok(pro6.some(c => c.sys === 'herosummer' && c.star === 4), 'プロの6月に 👑(夏のヒーロー記念)が並ばない');
  // ライバルは月のはじめに決まる(同じ月なら何度見ても同じ)・出るとごほうびが大きい
  let rv = null; for (let t = 6; t <= 41 && !rv; t++) { const c = SUC.cupsOf({ ...s0, turn: t }).find(x => x.rival); if (c) rv = { t, c }; }
  ok(Boolean(rv), 'ライバルの大会が1度も並ばない');
  if (rv) {
    ok(JSON.stringify(SUC.cupsOf({ ...s0, turn: rv.t })) === JSON.stringify(SUC.cupsOf({ ...s0, turn: rv.t })), 'ライバルが見るたびに変わる');
    const b = { ...s0, turn: rv.t, battle: { kind: 'cup', id: rv.c.id, sys: rv.c.sys, star: rv.c.star, rival: rv.c.rival, round: 0 } };
    const op = SUC.opponents(b)[0]; ok(op.rival && op.species === 'Golem' && op.name === 'みゅあのマスモン', 'ライバルの大会の相手がライバルでない');
    const plain = SUC.opponents({ ...b, battle: { ...b.battle, rival: null } })[0];
    ok(op.sum > plain.sum * 1.0 && op.sum < plain.sum * 1.35, `ライバルの強さが期の基準に寄っていない: ${op.sum} / ${plain.sum}`);
    ok(op.stats.pow > op.stats.wise, 'ライバルの6能力の形がもとの子のままでない');
    const w1 = SUC.settle(b, [true]).state; const w0 = SUC.settle({ ...b, battle: { ...b.battle, rival: null } }, [true]).state;
    ok(w1.fame > w0.fame && w1.tickets > w0.tickets && w1.pts === w0.pts && K.every(k => w1.stats[k] === Math.min(999, w0.stats[k] + 12)) && w1.titles.includes(SUC.RIVAL.title), 'ライバルに勝ったごほうび(賞金×1.5・チケット+1・全能力+12・称号)がずれている');
  }
  // 王者・常連・組み合わせ表
  const d = { ...s0, turn: 5, battle: { kind: 'debut', round: 0 } };
  const od = SUC.opponents(d); ok(od.length === 1 && od[0].champ && od[0].name, 'デビュー戦の相手が王者1体になっていない');
  const br = SUC.bracketOf(d); ok(br && br.entrants.length === 8 && br.entrants[0].you && br.final[0] === 0 && br.final[1] >= 4 && br.entrants[br.final[1]].name === od[0].name && br.rounds[1].join() === br.final.join() && br.rounds[0][0] === 0 && br.rounds[0][br.final[1] >> 1] === br.final[1] && br.pop.slice().sort((x, y) => x - y).join() === '1,2,3,4,5,6,7,8', '組み合わせ表(8人・決勝で自分と反対の山の相手・人気の番号が1〜8・勝ち上がり)がずれている');
  { // どの大会の日でも、人気は1〜8が1つずつ・王者は反対の山の相手か自分の山・勝ち上がりが筋の通る形
    let bad = 0; for (let t = 1; t <= 40; t++) for (const kind of ['debut', 'junior', 'middle', 'pro']) { const w = { ...d, turn: t, battle: { kind, round: 0 } }; let x; try { x = SUC.bracketOf(w); } catch (e) { bad++; continue; } if (!x) continue; const f = x.final[1]; const okp = x.pop.slice().sort((p, q) => p - q).join() === '1,2,3,4,5,6,7,8'; const okr = x.rounds[0].length === 4 && x.rounds[1].length === 2 && x.rounds[0].every((q, k) => q >> 1 === k) && x.rounds[1].every((q, j) => x.rounds[0].slice(2 * j, 2 * j + 2).includes(q)) && x.rounds[0][0] === 0 && x.rounds[0][f >> 1] === f && f >= 4 && x.rounds[1].join() === `0,${f}`; if (!okp || !okr) bad++; } ok(bad === 0, `組み合わせ表の人気の番号・勝ち上がりが筋に合わない場面 ${bad}件`); }
  ok(JSON.stringify(br) === JSON.stringify(SUC.bracketOf(d)), '組み合わせ表が決まった乱数になっていない');
  const r1 = SUC.opponents(SUC.rematch({ ...d, items: { sand: 0, rainbow: 1 } }, 'rainbow').state)[0]; ok(r1.name !== od[0].name, '虹の砂時計で相手(王者)が変わらない');
  // 月の大会に出る(ターンを使う・ターンの終わりに1戦)
  const e = SUC.act(j, { kind: 'cup', id: cj[0].id }); ok(e.out.ok, '月の大会に出られない');
  const eb = SUC.endTurn(e.state).state; ok(eb.battle && eb.battle.kind === 'cup' && eb.battle.star === 1, '月の大会の試合が立たない');
  const ew = SUC.settle(eb, [true]).state; ok(ew.turn === 7 && ew.wonNow.includes('str:1') && ew.stats.pow > eb.stats.pow && Number(ew.bag.oil || 0) === Number(eb.bag.oil || 0) + 1, `月の大会に勝ったあとがずれている(★ はその能力 +4・オイル1): ちから ${eb.stats.pow}→${ew.stats.pow}`);
  // 大会に勝ったときのアイテム(2026-11-14 社長「このまま作る」)
  { const ci = (sys, star, st) => SUC.cupItemsOf(st || eb, sys, star); const top = Object.keys(eb.stats).sort((x, y) => eb.stats[y] - eb.stats[x])[0];
    ok(ci('str', 1).oil === 1 && ci('str', 2).fruit_pow === 1 && ci('str', 3).fruit_pow === 1 && ci('str', 3).oilyoil === 1, `ふつうの大会の賞品がずれている: ${JSON.stringify([ci('str', 1), ci('str', 2), ci('str', 3)])}`);
    const c4 = ci('normal', 4); ok(Object.keys(c4).length === 2 && Object.keys(c4).some(k => /^elixir[0-3]$/.test(k)) && Object.keys(c4).some(k => k.startsWith('fruit_')), `👑の賞品(得意の間合いの秘薬+得意の能力の実)がずれている: ${JSON.stringify(c4)}`);
    ok(ci('derby', 3).stamina === 1 && !(SUC.EX_BY_SYS.derby.rw.hpMax) && ci('four1', 4).oilyoil === 1 && ci('four1', 4)[`fruit_${top}`] === 1 && ci('mem_pow', 3).fruit_pow === 2 && ci('ssn3_0', 2).fruit_life === 1 && Object.keys(ci('gem_tank', 3)).some(k => /^elixir/.test(k)), '第2版の大会の賞品がずれている');
    const sb = SUC.useItem({ ...eb, hp: 50, hpMax: 100, bag: { stamina: 1 }, itemTurn: -1 }, 'stamina').state; ok(sb.hpMax === 115 && sb.hp === 65, `スタミナだんごで体力の最大値 +15 にならない: ${sb.hpMax}/${sb.hp}`); }
  const last = SUC.endTurn(SUC.act({ ...j, turn: 17, stats: { ...j.stats, pow: 300, life: 300 } }, { kind: 'cup', id: SUC.cupsOf({ ...j, turn: 17, stats: { ...j.stats, pow: 300, life: 300 } }).find(c => c.entry.ok).id }).state).state;
  const after = SUC.settle(last, [true]).state; ok(after.battle && after.battle.kind === 'junior', '期の最後のターンに大会に出たあと、強制大会が続かない');
}

// ---- 決める前の見通し・保存から戻す(回2の画面のため) ----
{
  const s0 = SUC.newRun({ id: 'pv', species: 'Mocchi', aid: 'mua' });
  const pv = SUC.preview(s0, { kind: 'train', stat: 'pow' }); const r = SUC.act(s0, { kind: 'train', stat: 'pow' });
  ok(pv && pv.hp === 16 && pv.gain.pow > 0 && Object.keys(pv.gain).length === 3, `見通しの形がずれている: ${JSON.stringify(pv)}`);
  if (r.out.result === 'ok') ok(Math.abs(pv.gain.pow - r.out.gain.pow) <= 1, `見通しと成功の伸びが合わない: ${pv.gain.pow} / ${r.out.gain.pow}`);
  const mid = play('restore-id', picks);
  const back = SUC.restore(JSON.parse(JSON.stringify(mid)));
  // 賞金の桁(2026-11-13): 印 fameV の無い古い途中の育成は一度だけ ×FAME_SCALE。いまの形は掛からない・二度読んでも同じ
  { const f0 = { ...JSON.parse(JSON.stringify(mid)), fame: 350, fameTotal: 600 }; delete f0.fameV;
    const f1 = SUC.restore(f0); const f2 = SUC.restore(JSON.parse(JSON.stringify(f1)));
    ok(f1.fame === 350 * SUC.FAME_SCALE && f1.fameTotal === 600 * SUC.FAME_SCALE && f1.fameV === SUC.FAME_V, `古い途中の育成の賞金が換算されない: ${f1.fame}/${f1.fameTotal}`);
    ok(f2.fame === f1.fame && f2.fameTotal === f1.fameTotal, `賞金の換算が二度かかる: ${f2.fame}`);
    ok(back.fame === mid.fame && back.fameTotal === mid.fameTotal, `いまの形の賞金が読み直しで変わる: ${mid.fame} → ${back.fame}`); }
  ok(back && JSON.stringify(back.stats) === JSON.stringify(mid.stats) && back.turn === mid.turn && back.hp === mid.hp && JSON.stringify(back.trainXp) === JSON.stringify(mid.trainXp) && JSON.stringify(back.techs) === JSON.stringify(mid.techs), '保存から戻すと中身が変わる');
  // 編成の育てた子の熟練が残る(総合力・ランク・タッグが変わらない)・途中で足される記録(ごはん・アイテム・再戦・お話)も残る
  const tm = SUC.newRun({ id: 'rs-team', species: 'Mocchi', aid: 'mua', team: [{ kind: 'raised', species: 'Golem', stats: { life: 700, pow: 800, wise: 300, hit: 600, eva: 400, tough: 700 }, lv: 40, masteries: [80, 80, 80, 80, 80], loy: 80, pop: 50 }] });
  const tb = SUC.restore(JSON.parse(JSON.stringify({ ...tm, log: { ...tm.log, meal: 2, items: 1, rematch: 1, astory: 3 } })));
  ok(tb.team[0].power === tm.team[0].power && tb.team[0].rank === tm.team[0].rank && tb.team[0].tag === tm.team[0].tag, `保存から戻すと編成の子の総合力が変わる(熟練が消える): ${tm.team[0].power} → ${tb.team[0].power}`);
  ok(tb.log.meal === 2 && tb.log.items === 1 && tb.log.rematch === 1 && tb.log.astory === 3, '保存から戻すと記録(ごはん・アイテム・再戦・お話)が消える');
  ok(SUC.restore(null) === null && SUC.restore([]) === null && SUC.restore({ id: 'x', species: 'NoSuch' }) === null, '壊れた保存を戻せてしまう');
  const bad = SUC.restore({ ...JSON.parse(JSON.stringify(mid)), hp: 'abc', stats: { pow: 5000 }, turn: -3, bond: 'x', techs: ['nope'] });
  ok(bad && bad.hp === bad.hpMax && bad.stats.pow === 999 && bad.turn === 1 && Array.isArray(bad.bond) && bad.techs.length === 0, '壊れた値が既定に戻らない');
  const v = SUC.peek(s0).cards['train:pow']; ok(v.lv === 1 && v.xp === 0 && v.next === 4, `札のトレーニングLv・経験・次までがない: ${JSON.stringify({ lv: v.lv, xp: v.xp, next: v.next })}`);
}

// ---- シナリオの大会(§4b・8人)・助手のお話の結末と特別な1話 ----
{
  const at = (aid, turn, extra) => ({ ...SUC.newRun({ id: `sc-${aid}`, species: 'Mocchi', aid }), turn, ...(extra || {}) });
  const has = (s) => SUC.cupsOf(s).find(c => c.scenario);
  ok(Object.keys(SUC.SC_CUPS).length === 8, 'シナリオの大会が8人分ない');
  ok(has(at('mua', 13)) && has(at('mua', 25)) && !has(at('mua', 14)), 'みゅあの笑顔の大会がジュニア・ミドルの8月に並ばない');
  ok(has(at('atsu', 33)) && SUC.cupsOf(at('atsu', 33)).find(c => c.scenario).star === 3, 'あつの格上への挑戦がプロの4月 ★★★ に並ばない');
  ok(!has(at('kiki', 27)).entry.ok && has(at('kiki', 27, { stats: { ...at('kiki', 27).stats, wise: 450 } })).entry.ok, 'ききの大会の条件(ちからかかしこさ 400 以上)が効かない');
  ok(has(at('momosuke', 40, { pop: 60 })).star === 3 && has(at('momosuke', 40, { pop: 10 })).star === 2, 'ももすけの人気投票の大会が人気 50 以上で ★★★ にならない');
  const er = at('erubin', 10); ok(has(er) && !has(er).entry.ok && has({ ...er, ama: 40, fear: 35 }).entry.ok, 'えるびんの見守りの大会(ジュニア5月・忠誠 70 以上)がずれている');
  let peaks = 0; for (let t = 2; t <= 46; t++) if (SUC.peakTurn(at('kyuko', t))) peaks += 1; ok(peaks === 1, `きゅうこのピークの大会が1回の育成で1度でない: ${peaks}`);
  // 格上への挑戦は1つ上の星の強さ・負けても賞金の半分
  const ab = { ...at('atsu', 33), battle: { kind: 'cup', sys: 'scatsu', star: 3, round: 0 } }; const nb = { ...ab, battle: { kind: 'cup', sys: 'normal', star: 3, round: 0 } };
  ok(SUC.opponents(ab)[0].sum > SUC.opponents(nb)[0].sum * 1.05, '格上への挑戦の相手が強くない');
  const al = SUC.settle(ab, false).state; ok(al.fame === Math.round(SUC.CUP_PRIZE[3] * 1.5 * 0.5), '格上への挑戦で負けても賞金の半分にならない');
  const aw = SUC.settle(ab, true).state; ok(aw.pts === 10 + 15, `格上への挑戦に勝っても能力ポイント +15 が付かない: ${aw.pts}`);
  const ew = SUC.settle({ ...at('erubin', 10, { ama: 40, fear: 35 }), battle: { kind: 'cup', sys: 'scerubin', star: 1, round: 0 } }, true).state;
  { const st = { ...ew.stats, pow: 100 }; const ewm = SUC.meal({ ...ew, stats: st, mealOpts: OPT3('f_pow') }, 'f_pow'); const ewn = SUC.meal({ ...ew, stats: st, freeMeal: false, mealOpts: OPT3('f_pow') }, 'f_pow');
    ok(ew.freeMeal && ewm.out.ok && ewm.out.boost === 1.5 && ewm.state.stats.pow - 100 === Math.round(15 * 1.5) && ewn.state.stats.pow === 115 && ewm.state.freeMeal === false, `見守りの大会のあと、次のごはんの効き目が1.5倍(1回)にならない: ${ewm.state.stats.pow}/${ewn.state.stats.pow}`);
    ok(!SUC.meal({ ...ew }, '__proto__').out.ok && !SUC.meal({ ...ew }, 'constructor').out.ok, 'ごはんの名前でないもの(__proto__ など)で食べられる'); }
  // お話の結末
  const g = SUC.storyEnd(at('kiki', 40), 'good'); ok(g.out.ok && K.every(k => g.state.stats[k] > at('kiki', 40).stats[k]) && g.state.hints[0].name === '静かな一撃', 'いい結末で全能力とひらめきが付かない');
  ok(!SUC.storyEnd(g.state, 'bitter').out.ok, 'お話の結末が2回付く');
  const b = SUC.storyEnd(at('atsu', 40), 'bitter').state; ok(b.pts === 10, 'ほろ苦い結末(あつ)で能力ポイント +10 が付かない');
  // 特別な1話: 頂への道の1回戦だけ
  const sp = SUC.markSpecial(at('atsu', 44)).state;
  ok(JSON.stringify(SUC.battleBuffs({ ...sp, battle: { kind: 'summit', round: 0 } })) === '{"A":{"guts":10}}' && SUC.battleBuffs({ ...sp, battle: { kind: 'summit', round: 1 } }) === undefined, '対戦の芯に渡す上乗せ(buffs)の形がずれている');
  const ky = SUC.markSpecial({ ...SUC.newRun({ id: 'k', species: 'Mocchi', aid: 'kyuko' }), turn: 44 }).state; const kb = SUC.battleBuffs({ ...ky, battle: { kind: 'summit', round: 0 } });
  ok(kb && kb.A.eva === 0.1 && kb.A.showFirst === undefined, '画面の印(showFirst)が対戦の芯の上乗せに混ざっている');
  ok(SUC.battleMods({ ...sp, battle: { kind: 'summit', round: 0 } }).guts === 10 && !SUC.battleMods({ ...sp, battle: { kind: 'summit', round: 1 } }).guts && !SUC.battleMods({ ...at('atsu', 44), battle: { kind: 'summit', round: 0 } }).guts, '特別な1話の効き目が頂への道の1回戦だけになっていない');
}

// ---- 助手の連続イベント(1〜4話・特別な1話) ----
{
  const due = (s, turns) => { for (const t of turns) { const x = { ...s, turn: t }; const d = SUC.storyDue(x); if (d !== null) return { d, t }; } return null; };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  let s = { ...SUC.newRun({ id: 'astory', species: 'Mocchi', aid: 'atsu', aidBondLv: 5 }), aidBond: 100 };
  const e1 = due(s, range(1, 5)); ok(e1 && e1.d === 1, 'デビュー期に1話が出ない');
  s = SUC.storyStep({ ...s, turn: e1.t }, 'a').state; ok(s.astory.ep === 1, '1話のあとに話が進まない');
  ok(due(s, range(1, 5)) === null, '1話のあとデビュー期に2話が出る');
  const e2 = due(s, range(6, 17)); ok(e2 && e2.d === 2, 'ジュニア期に2話が出ない');
  s = SUC.storyStep({ ...s, turn: e2.t }, 'b').state;
  const e3 = due(s, range(18, 29)); s = SUC.storyStep({ ...s, turn: e3.t }, 'a').state; ok(s.astory.path === 'good', '3話の a でいい結末への道にならない');
  const e4 = due(s, range(30, 41)); const before = s.stats.pow; s = SUC.storyStep({ ...s, turn: e4.t }, 'a').state;
  ok(s.storyEnd === 'good' && s.stats.pow > before && s.hints.length === 1, '4話がいい結末にならない');
  const sp = due(s, range(42, 43)); ok(sp && sp.d === 'special', '仲良し度 Lv5・いい結末で特別な1話が出ない');
  s = SUC.storyStep({ ...s, turn: sp.t }, 'a').state; ok(s.special && s.astory.done && due(s, range(42, 46)) === null, '特別な1話のあとがずれている');
  // 仲良し度の段で見られる話が変わる・親密度が足りないと出ない
  const lv1 = { ...SUC.newRun({ id: 'astory', species: 'Mocchi', aid: 'atsu', aidBondLv: 1 }), aidBond: 100, astory: { ep: 1, path: null, done: false } };
  ok(due(lv1, range(6, 17)) !== null, '仲良し度 Lv1 で2話が出ない(1〜4話は Lv に関係なく見られる・2026-11-13)');
  const lv1sp = { ...lv1, astory: { ep: 4, path: 'good', done: false }, storyEnd: 'good' };
  ok(due(lv1sp, range(42, 43)) === null, '仲良し度 Lv1 で特別な1話が出る(Lv5〜 だけ)');
  const low = { ...SUC.newRun({ id: 'astory', species: 'Mocchi', aid: 'atsu', aidBondLv: 5 }), aidBond: 10, astory: { ep: 1, path: null, done: false } };
  ok(due(low, range(6, 17)) === null, '親密度 30 未満で2話が出る');
  const bit = { ...SUC.newRun({ id: 'astory', species: 'Mocchi', aid: 'atsu', aidBondLv: 5 }), aidBond: 100, astory: { ep: 3, path: 'bitter', done: false } };
  const b4 = due(bit, range(30, 41)); const bs = SUC.storyStep({ ...bit, turn: b4.t }, 'a').state; ok(bs.storyEnd === 'bitter' && bs.astory.done, 'ほろ苦い結末のあと特別な1話へつながってしまう');
}

// ---- 助手1人分のストーリー(固有イベント・頂への道の相手えらび・エンディング。STORY-ARC.md) ----
{
  const A = SUC.ARC.mua; ok(A && A.uniq.length === 4 && A.summit.length === 3, 'みゅあの表(固有イベント4つ・相手えらび3つ)がない');
  // 固有イベントは決まった期に1回ずつ出る(to のターンで必ず)・ほかの助手には出ない
  for (const u of A.uniq) {
    let s = { ...SUC.newRun({ id: 'uq', species: 'Mocchi', aid: 'mua' }), turn: u.to };
    const v = SUC.events.due(s, 'start'); ok(v && v.id === u.id, `固有イベント ${u.id} が ${u.to} ターン目に出ない: ${v && v.id}`);
    s = SUC.events.open(s, 'start').state; s = SUC.events.pick(s, 'a').state;
    ok(!(SUC.events.due({ ...s, turn: u.to + 1, ev: { ...s.ev, rolled: {} } }, 'start') || {}).id?.startsWith(u.id), `固有イベント ${u.id} が2回出る`);
    const at = { ...SUC.newRun({ id: 'uq', species: 'Mocchi', aid: 'atsu' }), turn: u.to };
    ok(!((SUC.events.due(at, 'start') || {}).id || '').startsWith('scn.mua'), 'みゅあの固有イベントがほかの助手に出る');
  }
  // 頂への道: みゅあが選ぶ相手(1回戦 人気者・準決勝 ライバル・決勝 王者)
  const rv = { name: 'ライバルくん', kind: 'aid', species: 'Golem', stats: { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 } };
  let s = { ...SUC.newRun({ id: 'pick', species: 'Mocchi', aid: 'mua', rivals: [rv] }), turn: 44 };
  const op = (round) => SUC.opponents({ ...s, battle: { kind: 'summit', round } })[0];
  ok(op(0).pick === 'pop' && op(0).pop >= 80, `1回戦の相手が人気者になっていない: ${op(0).pick} ${op(0).pop}`);
  ok(op(1).pick === 'rival' && op(1).name === 'ライバルくん', `準決勝の相手がライバルになっていない: ${op(1).pick} ${op(1).name}`);
  ok(op(2).pick === 'champ' && op(2).champ, '決勝の相手が王者になっていない');
  const noRival = { ...SUC.newRun({ id: 'pick', species: 'Mocchi', aid: 'mua' }), turn: 45, battle: { kind: 'summit', round: 1 } };
  ok(SUC.opponents(noRival)[0].pick === 'strong', 'ライバルがいないとき、準決勝の相手が強い常連にならない');
  // エンディング: 親密度 100・4話まで見た → 超グッド(お祝い3回 +15・+17・+20)/どちらか欠けるとグッド/負けるとバッド
  const fin = (o) => SUC.settle({ ...SUC.newRun({ id: 'end', species: 'Mocchi', aid: 'mua' }), turn: 46, battle: { kind: 'summit', round: 2 }, ...o }, [true]);
  const sup = fin({ aidBond: 100, astory: { ep: 4, path: 'good', done: false } });
  ok(sup.out.ending === 'super' && sup.state.titles.includes('みゅあの最高のチーム') && sup.out.party.life === 52, `超グッドにならない: ${sup.out.ending} ${JSON.stringify(sup.out.party)}`);
  ok(fin({ aidBond: 99, astory: { ep: 4, path: 'good', done: false } }).out.ending === 'good', '親密度 99 で超グッドになる');
  ok(fin({ aidBond: 100, astory: { ep: 3, path: 'good', done: false } }).out.ending === 'good', '連続イベントを完走していないのに超グッドになる');
  const r = SUC.restore(JSON.parse(JSON.stringify(sup.state))); ok(r && r.ending && r.ending.kind === 'super' && !r.ending.seen && SUC.endingSeen(r).state.ending.seen, 'エンディングが保存から戻らない');
  ok(SUC.restore({ ...JSON.parse(JSON.stringify(sup.state)), ending: { kind: 'zzz' } }).ending === null, '壊れたエンディングの値を既定に直さない');
}

// ---- 評価の表示(gradeOf)・ひらめきのアシスト5つ ----
{
  const g = (p) => SUC.gradeOf(p).label;
  // 2026-11-14 社長「M は 20,000」: M より上は名前そのものが500ごと(M・M1〜M9・MG・MG1…)で番号を付けない
  ok(g(6000) === 'C1' && g(6499) === 'C1' && g(6500) === 'C2' && g(7999) === 'C4' && g(8000) === 'B1' && g(19500) === 'SSS4' && g(20000) === 'M' && g(20500) === 'M1' && g(25100) === 'MG' && g(0) === 'G1', `評価の番号がずれている: ${[6000, 6500, 7999, 8000, 19500, 20000, 20500, 25100].map(g)}`);
  ok(SUC.gradeOf(7200).toNext === 300 && SUC.gradeOf(19500).next === 20000 && SUC.gradeOf(20000).next === 20500 && SUC.gradeOf(99999).next === null, '次の番号までの数がずれている');
  ok(['gatsu', 'miseba', 'mitate', 'kensho', 'mimamori'].every(id => SUC.ASSISTS[id] && SUC.ASSISTS[id].type === 'battle'), 'ひらめきのアシスト5つ(型 battle)がない');
  const st = { life: 600, pow: 700, wise: 300, hit: 500, eva: 400, tough: 600 };
  const mk = (as) => SUC.newRun({ id: 'hint', species: 'Mocchi', aid: 'mua', team: [{ kind: 'raised', species: 'Golem', stats: st, lv: 30, loy: 70, assists: as }, { kind: 'raised', species: 'Golem', stats: st, lv: 30, loy: 70, assists: [{ id: 'gatsu', lv: 1 }] }] });
  const plain = mk([]); const all = mk([{ id: 'gatsu', lv: 3 }, { id: 'miseba', lv: 3 }, { id: 'mitate', lv: 3 }, { id: 'mimamori', lv: 3 }]);
  const cup = { kind: 'cup', sys: 'str', star: 1, round: 0 };
  ok(JSON.stringify(SUC.battleBuffs({ ...all, battle: cup })) === JSON.stringify({ A: { guts: 8, hit1: 0.1, crit: 0.08, eva: 0.08, noSulk: true } }), `ひらめきのアシストの上乗せ(一番高い段の1つだけ)がずれている: ${JSON.stringify(SUC.battleBuffs({ ...all, battle: cup }))}`);
  ok(JSON.stringify(SUC.battleBuffs({ ...plain, battle: cup })) === '{"A":{"guts":3}}' && SUC.battleBuffs(all) === undefined, '大会の試合のときだけ上乗せが付く になっていない');
  // トレーニングには効かない
  const tp = SUC.act(plain, { kind: 'train', stat: 'pow' }); const ta = SUC.act(all, { kind: 'train', stat: 'pow' });
  ok(JSON.stringify(tp.out.gain) === JSON.stringify(ta.out.gain), 'ひらめきのアシスト(型 battle)がトレーニングに効いている');
  // 特別な1話と足し合わせて範囲で切る
  const sp = SUC.markSpecial({ ...SUC.newRun({ id: 'h2', species: 'Mocchi', aid: 'atsu', team: [{ kind: 'raised', species: 'Golem', stats: st, lv: 30, loy: 70, assists: [{ id: 'gatsu', lv: 3 }] }] }), turn: 44 }).state;
  ok(SUC.battleBuffs({ ...sp, battle: { kind: 'summit', round: 0 } }).A.guts === 18, '特別な1話とひらめきのガッツが足し合わさらない');
}

// ---- 合体(保存枠の育て終えた子どうし・PLAN.md §3) ----
{
  const mk = (id, sp, v, extra) => ({ id, species: sp, raised: true, gen: 1, st: { life: v, pow: v, wise: v, hit: v, eva: v, tough: v }, techs: [], gt: 2, rank: 'B', ...(extra || {}) });
  const p = SUC.fusePlan(mk('a', 'Undine', 999), mk('b', 'Mocchi', 999));
  ok(p.ok && p.child.species === 'Yaobikuni', 'ウンディーネ + モッチー がヤオビクニにならない');
  ok(p.child.raised === false && p.child.gen === 2 && p.child.parents.join() === 'a,b' && p.parentInfo[0].id === 'a' && p.parentInfo[0].rank === 'B', '生まれた子の未育成・世代・親が違う');
  ok(SUC.KEYS.every(k => p.child.st[k] === p.base[k] + p.add[k] && p.add[k] === 200), '6能力が「生まれた種類の初期値 + 上乗せ(平均999で+200)」になっていない');
  const q = SUC.fusePlan(mk('a', 'Undine', 999), mk('b', 'Mocchi', 999));
  ok(JSON.stringify(p) === JSON.stringify(q) && p.child.id === SUC.fuseId('a', 'b') && SUC.fuseId('a', 'b') !== SUC.fuseId('b', 'a'), '同じ2体で見通しと結果が変わる・id が決まらない');
  const lop = SUC.fusePlan(mk('a', 'Mocchi', 999), mk('b', 'Mocchi', 100));
  ok(lop.ok && SUC.KEYS.every(k => lop.add[k] < 60), '片方だけ強いのに上乗せが大きい');
  ok(SUC.fusePlan(mk('a', 'Mocchi', 999), mk('b', 'Mocchi', 999)).child.species === 'Mocchi', '同じ血統どうしで種類が変わる');
  // 組み合わせのモンスターがいなければ主の親の種類
  const none = SUC.fuseKinds('Golem', 'Ghost');
  ok(none.every(x => SUC.speciesList.includes(x.species)), '種類の候補に下書きや無い種類が入る');
  ok(SUC.fusePlan(mk('a', 'Mocchi', 500), { ...mk('b', 'Mocchi', 500), raised: false }).ok === false, '未育成の子を合体に使える');
  ok(SUC.fusePlan(mk('a', 'Mocchi', 500), mk('a', 'Mocchi', 500)).ok === false, '同じ子どうしで合体できる');
  ok(SUC.fusePlan(mk('a', 'Mocchi', 500), mk('b', 'NoSuch', 500)).ok === false, '知らない種類で合体できる');
  // 技: 親の技のうち生まれた種類で覚えられるもの2つまで・熟練は0
  const all = SUC.techsOf('Mocchi').filter(t => !(t.learn || {}).start).map(t => t.id);
  if (all.length >= 3) {
    const tp = SUC.fusePlan(mk('a', 'Mocchi', 500, { techs: all.slice(0, 2), gen: 3 }), mk('b', 'Mocchi', 500, { techs: [all[2], 'nope'], gen: 5 }));
    ok(tp.child.techs.length === 2 && tp.child.techs.every(t => all.includes(t)) && tp.child.mast.length === 2 && tp.child.mast.every(x => x === 0), '受け継ぐ技が2つまで・熟練0になっていない');
    ok(tp.child.gen === 6, '世代が「親の大きい方 + 1」になっていない');
  }
  // 型: いつも生まれた種類の決まった型(2026-11-14 社長。親の型は継がない・くじなし)
  let same = 0; for (let i = 0; i < 200; i++) { const r = SUC.fusePlan(mk('m' + i, 'Mocchi', 500, { gt: 5 }), mk('n' + i, 'Mocchi', 500)); if (r.child.gt === SUC.speciesType(r.child.species)) same += 1; }
  ok(same === 200, `合体の子の型が種類の決まった型になっていない(${same}/200)`);
  // 新しく始める育成の型は種族の型・30種すべて表にある・空き枠に育てる子と同じ種を入れない
  ok(SUC.speciesList.every(sp => Number.isInteger(SUC.GROW_BY_SPECIES[sp]) && [1, 2, 3].includes(SUC.GROW_BY_SPECIES[sp])), '種族の成長の型の表に無い種族がある');
  ok(SUC.newRun({ id: 'gt', species: 'Golem' }).type === 3 && SUC.newRun({ id: 'gt', species: 'Pixie' }).type === 1 && SUC.newRun({ id: 'gt', species: 'Golem', type: 5 }).type === 5, '新しい育成の型が種族の型でない(または途中の育成の型を書き換えている)');
  ok(SUC.newRun({ id: 'self', species: 'Pixie' }).team.every(m => m.species !== 'Pixie'), '空いた編成の枠に、育てる子と同じ種が入っている');
  // 合体で生まれたモンスターから始めるときは、その能力(st)から始まる(2026-11-14 社長・台帳 #6108)。壊れた値なら種族の値
  { const T6 = Array.from({ length: 6 }, () => ({ kind: 'base', species: 'Mocchi' })); const st = { life: 300, pow: 250, wise: 200, hit: 220, eva: 210, tough: 230 };
    const a = SUC.newRun({ id: 'fz', species: 'Golem', team: T6, startSt: st }); const b = SUC.newRun({ id: 'fz', species: 'Golem', team: T6 }); const c = SUC.newRun({ id: 'fz', species: 'Golem', team: T6, startSt: 'x' });
    ok(K.every(k => a.stats[k] - b.stats[k] === st[k] - SUC.initStats('Golem')[k]) && JSON.stringify(c.stats) === JSON.stringify(b.stats), '合体で生まれたモンスターの能力から育成が始まっていない'); }
  // 壊れた保存値でも落ちない
  const bad = SUC.fusePlan({ id: 'x', species: 'Mocchi', raised: true, st: { life: 'abc', pow: -5, wise: 1e9 }, techs: 'zz', gen: NaN }, mk('y', 'Mocchi', 500));
  ok(bad.ok && SUC.KEYS.every(k => Number.isFinite(bad.child.st[k]) && bad.child.st[k] >= 1 && bad.child.st[k] <= 999) && bad.child.gen === 2, '壊れた保存値で合体の値がおかしくなる');
}

// ---- 覚醒・超覚醒(2026-11-13): くじの率・前触れ → 次のターンに起きる・最後の期は同じターンの終わり・適性の上がり方・上限・保存の読み直し ----
if (typeof SUC.awakeOpen === 'function') {
  const N = 3000; let a1 = 0; let a2 = 0;
  for (let r = 0; r < N; r++) {
    let s = SUC.newRun({ id: 'aw' + r, species: 'Mocchi', aid: 'mua' });
    for (let t = 1; t <= SUC.TOTAL_TURNS; t++) { s.turn = t; s = SUC.awakeOpen(s, 'start').state; s = SUC.awakeOpen(s, 'end').state; }
    if (s.awake >= 1) a1++; if (s.awake >= 2) a2++;
  }
  ok(a1 / N > 0.12 && a1 / N < 0.21, `覚醒の率がおかしい(${a1}/${N}・目安 16%)`);
  ok(a2 / N > 0.02 && a2 / N < 0.09, `超覚醒の率がおかしい(${a2}/${N})`);
  // デビュー期はくじを引かない・1回の育成で1回まで
  let d = SUC.newRun({ id: 'awd', species: 'Mocchi', aid: 'mua' }); let hit = 0;
  for (let t = 1; t <= 5; t++) { d.turn = t; const o = SUC.awakeOpen(d, 'start'); if (o.out.omen || o.out.fire) hit++; d = o.state; }
  ok(hit === 0 && d.omen === null, 'デビュー期に覚醒のくじを引いている');
  // 前触れのターンは起きない → 次のターンのはじめに起きる
  let s = SUC.newRun({ id: 'aw-x', species: 'Mocchi', aid: 'mua' }); s.turn = 10; s.omen = { k: 1, turn: 10 };
  let o = SUC.awakeOpen(s, 'start'); ok(o.out.omen === 1 && !o.out.fire && o.state.awake === 0, '前触れのターンに覚醒が起きている');
  o = SUC.awakeOpen(o.state, 'end'); ok(!o.out.fire, '最後の期でないのにターンの終わりに覚醒が起きる');
  s = o.state; s.turn = 11; const before = { ...s.stats };
  o = SUC.awakeOpen(s, 'start');
  ok(o.out.fire && o.out.fire.kind === 1 && o.state.awake === 1 && o.state.omen === null && SUC.KEYS.every(k => o.state.stats[k] === Math.min(999, before[k] + 30)), '覚醒で全能力 +30 にならない');
  ok(o.out.fire.apt.length === 1 && o.state.aptAwake.reduce((a, b) => a + b, 0) === 1, '覚醒で間合い適性が1つ上がらない');
  ok(SUC.awakeOpen(o.state, 'start').state.omen === null, '覚醒したターンに超覚醒のくじを引いている');
  // 超覚醒: 2つ +1・合計 3 まで・M は飛ばす
  let s2 = o.state; s2.turn = 12; s2.omen = { k: 2, turn: 11 };
  const o2 = SUC.awakeOpen(s2, 'start');
  ok(o2.out.fire && o2.out.fire.kind === 2 && o2.out.fire.add === 40 && o2.out.fire.apt.length === 2 && o2.state.awake === 2, '超覚醒で全能力 +40・適性2つにならない');
  ok(o2.state.aptAwake.reduce((a, b) => a + b, 0) === 3 && SUC.aptSendOf(o2.state).reduce((a, b) => a + b, 0) === 3, '覚醒の段が試合へ渡す段数に入らない');
  ok(!SUC.awakeOpen({ ...o2.state, turn: 13 }, 'start').out.omen, '超覚醒のあともくじを引いている');
  const m = SUC.newRun({ id: 'aw-m', species: 'Mocchi', aid: 'mua' }); m.aptUp = [0, 11, 0, 0];
  ok(!SUC.awakePick(m, 1).includes(1), 'M の間合いを覚醒で上げようとしている');
  // 最後の期: 当たったターンの終わりに起きる
  let f = SUC.newRun({ id: 'aw-f', species: 'Mocchi', aid: 'mua' }); f.awake = 1; f.awakeTurn = 20; f.turn = 44; f.omen = { k: 2, turn: 44 };
  ok(SUC.awakeOpen(f, 'end').out.fire, '最後の期の前触れが同じターンの終わりに起きない');
  // 保存の読み直し(壊れた値 → 起きていない)
  const rs = SUC.restore(JSON.parse(JSON.stringify(o2.state)));
  ok(rs.awake === 2 && rs.aptAwake.join() === o2.state.aptAwake.join(), '覚醒の印が読み直しで消える');
  const bad = SUC.restore({ ...JSON.parse(JSON.stringify(s)), awake: 'x', aptAwake: [9, 9, 9, 9], omen: { k: 7 } });
  ok(bad.awake === 0 && bad.aptAwake.reduce((a, b) => a + b, 0) <= 3 && bad.omen === null, '壊れた覚醒の値を読み直せない');
  // 合体で継ぐ段数に親の覚醒の分が入る(印そのものは継がない)
  const p = { aptUp: [0, 0, 0, 0], aptBase: [0, 0, 0, 0], aptAwake: [0, 3, 0, 0], awake: 2 };
  ok(SUC.aptInherit(p, p)[1] >= 3, '合体で継ぐ段数に親の覚醒の分が入らない');
}

// 覚醒の実・超覚醒の実(2026-11-13 社長 r1113-038): 使うとその場で起きる・超覚醒の実は期の条件なしで覚醒→超覚醒まで
if (SUC.ITEMS.awakeFruit && SUC.ITEMS.superAwakeFruit) {
  const at = (turn, bag) => { const s = SUC.newRun({ id: 'aw-item', species: 'Mocchi', aid: 'mua' }); s.turn = turn; s.bag = bag; return s; };
  const d = at(2, { awakeFruit: 1, superAwakeFruit: 1 });
  ok(SUC.itemUsable(d, 'awakeFruit'), 'デビュー期に覚醒の実が使えない(参考どおり育成中いつでも)');
  ok(SUC.itemUsable(d, 'superAwakeFruit'), 'デビュー期に超覚醒の実が使えない(期の条件なしのはず)');
  const r = SUC.useItem(d, 'superAwakeFruit');
  ok(r.out.ok && r.state.awake === 2 && r.out.fires.length === 2 && r.out.fires[0].kind === 1 && r.out.fires[1].kind === 2 && r.state.bag.superAwakeFruit === 0, '超覚醒の実で覚醒→超覚醒まで進まない');
  ok(SUC.KEYS.every(k => r.state.stats[k] === Math.min(999, d.stats[k] + 70)), '超覚醒の実(覚醒前)で全能力 +70 にならない');
  ok(!SUC.itemUsable(r.state, 'superAwakeFruit'), '超覚醒ずみに超覚醒の実が使えてしまう');
  const j = at(12, { awakeFruit: 1 });
  const r1 = SUC.useItem(j, 'awakeFruit');
  ok(r1.out.ok && r1.state.awake === 1 && r1.out.fires.length === 1 && r1.out.fires[0].add === 30, 'ジュニア期に覚醒の実で覚醒しない');
  ok(!SUC.itemUsable({ ...r1.state, turn: 13 }, 'awakeFruit'), '覚醒ずみに覚醒の実が使えてしまう');
  const r2 = SUC.useItem({ ...r1.state, turn: 13, bag: { superAwakeFruit: 1 } }, 'superAwakeFruit');
  ok(r2.out.ok && r2.state.awake === 2 && r2.out.fires.length === 1 && r2.out.fires[0].kind === 2, '覚醒ずみに超覚醒の実で超覚醒だけにならない');
  const rs = SUC.restore(JSON.parse(JSON.stringify({ ...j, bag: { awakeFruit: 1, superAwakeFruit: 2 } })));
  ok(rs.bag.awakeFruit === 1 && rs.bag.superAwakeFruit === 2, '覚醒の実が読み直しで消える');
}

if (errors.length) { console.error(`NG monhero-success-check: ${errors.length}件`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
console.log('OK monhero-success-check: 46ターン・決まった乱数・結果4種・休む/遊ぶ/通院・忠誠・編成とタッグ・イッサ博士・大会の流れ・修行と技・トレーニングLv・再戦とスキップ・持ちこみ・月の大会とライバル・見通しと保存から戻す・シナリオの大会とお話・助手の連続イベント・評価の番号とひらめきのアシスト・合体');
