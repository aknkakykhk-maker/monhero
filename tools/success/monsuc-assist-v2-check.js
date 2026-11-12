#!/usr/bin/env node
// モンヒロサクセス: 芯がアシスト能力の第2版の表(段1〜5)を読むことを確かめる。2026-11-12 バトル部(窓口の依頼①)
//   node tools/success/monsuc-assist-v2-check.js
//   ① 表を渡すと、芯が効き目を持つ種類(第1版の9種類)は第2版の段と数字になる。試合型5つ(ひらめき)は保留中なので第1版のまま
//   ② 表を渡さない・壊れた表なら第1版のまま動く
//   ③ 保存データ: 第1版の持ち物(段1〜3)はそのまま読める/段4・5は表が無くても削らない/第2版の新しい種類・知らない id は
//      計算から外すだけで落ちない/壊れた値は既定へ(CLAUDE.md ⑦)
//   ④ 効き目: 段 lv の値は表の lv 段目(表より上の段は表のいちばん上の段)
//   ⑤ 芯の版(VERSION)は 3(ランキングの行に残る)
//   ⑥ 訓練に効く新しい11種(依頼②): 表を渡すと芯に出て、段1〜5の値どおりに効く。表が無ければ出さない
'use strict';
const path = require('path');
const { loadDeps, depsFor, CORE } = require('./load.js');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };

const mod = require(CORE);
const deps = loadDeps();
const AT = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'monhero-success-assist.js'));
const S2 = mod.create(depsFor(deps));                         // 第2版(ゲームと同じ)
const S1 = mod.create(depsFor(deps, { assist: null }));       // 表なし = 第1版
const SB = mod.create(depsFor(deps, { assist: { BY_ID: { sokoji: { type: 'with', v: [1, 'x'], cost: [1] } } } })); // 壊れた表

const V1_IDS = ['sokoji', 'kaketsuke', 'hirameki', 'atooshi', 'kizuna', 'ochitsuki', 'itawari', 'shugyo', 'hitonatsu'];
const BATTLE = ['gatsu', 'miseba', 'mitate', 'kensho', 'mimamori'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ①②
const NEW11 = ['miharu', 'kibarashi', 'kunpow', 'kunwise', 'kunhit', 'kuneva', 'kuntough', 'kunlife', 'nakayoshi', 'tagpow', 'shitashi'];
check('① 芯の種類は第1版の14 + 訓練に効く11種 = 25(ほかの新しい種類は効き目を作るまで出さない)', same(Object.keys(S2.ASSISTS).sort(), [...Object.keys(S1.ASSISTS), ...NEW11].sort()) && Object.keys(S2.ASSISTS).length === 25);
check('② 表なし・壊れた表では11種を出さない', NEW11.every((id) => !S1.ASSISTS[id] && !SB.ASSISTS[id]));
check('① 第1版の9種類は第2版の段(5段)と数字・値段', V1_IDS.every((id) => same(S2.ASSISTS[id].v, AT.BY_ID[id].v) && same(S2.ASSISTS[id].cost, AT.BY_ID[id].cost) && S2.ASSISTS[id].v.length === 5));
check('① 人なつっこさの「はじめの親密度」も第2版', same(S2.ASSISTS.hitonatsu.start, AT.BY_ID.hitonatsu.start));
check('① 試合型5つ(ひらめき・保留中)は第1版のまま', BATTLE.every((id) => same(S2.ASSISTS[id], S1.ASSISTS[id])));
check('② 表なしは第1版(3段)', V1_IDS.every((id) => S1.ASSISTS[id].v.length === 3));
check('② 壊れた表の種類は第1版のまま', same(SB.ASSISTS.sokoji, S1.ASSISTS.sokoji));
check('⑤ 芯の版は 3', mod.VERSION === 3 && S2.VERSION === 3);

// ③ 保存データ
const sp = S2.speciesList[0];
const child = (assists) => ({ kind: 'raised', species: sp, stats: { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 }, lv: 10, assists });
const asOf = (S, a) => { try { return S.memberOf(child(a)).assists; } catch (e) { return 'THROW ' + e.message; } };
const old = [{ id: 'sokoji', lv: 3 }, { id: 'kizuna', lv: 1 }, { id: 'shugyo', lv: 2 }];
check('③ 第1版の持ち物(段1〜3)は第1版でも第2版でもそのまま', same(asOf(S2, old), old) && same(asOf(S1, old), old));
check('③ 段4・5は表が無くても削らない', same(asOf(S1, [{ id: 'sokoji', lv: 5 }, { id: 'kizuna', lv: 4 }]), [{ id: 'sokoji', lv: 5 }, { id: 'kizuna', lv: 4 }]));
check('③ 効き目のまだ無い種類・知らない id は計算から外すだけ(落ちない)', same(asOf(S2, [{ id: 'gussuri', lv: 3 }, { id: 'sokoji', lv: 2 }, { id: 'nope', lv: 1 }]), [{ id: 'sokoji', lv: 2 }]));
check('③ 11種は第2版で読める/表なしでは計算から外すだけ', same(asOf(S2, [{ id: 'miharu', lv: 3 }, { id: 'sokoji', lv: 2 }]), [{ id: 'miharu', lv: 3 }, { id: 'sokoji', lv: 2 }]) && same(asOf(S1, [{ id: 'miharu', lv: 3 }, { id: 'sokoji', lv: 2 }]), [{ id: 'sokoji', lv: 2 }]));
check('③ 壊れた値は既定へ(段が文字→1・段9→5・段−1→1・重なり→1つ・配列でない→なし)',
  same(asOf(S2, [{ id: 'sokoji', lv: 'x' }]), [{ id: 'sokoji', lv: 1 }]) && same(asOf(S2, [{ id: 'sokoji', lv: 9 }]), [{ id: 'sokoji', lv: 5 }])
  && same(asOf(S2, [{ id: 'sokoji', lv: -1 }]), [{ id: 'sokoji', lv: 1 }]) && same(asOf(S2, [{ id: 'sokoji', lv: 2 }, { id: 'sokoji', lv: 5 }]), [{ id: 'sokoji', lv: 2 }])
  && same(asOf(S2, 'abc'), []) && same(asOf(S2, null), []) && same(asOf(S2, [null, 3, { lv: 2 }]), []));
check('③ 5種類以上は先の4つまで(今までどおり)', asOf(S2, V1_IDS.map((id) => ({ id, lv: 1 }))).length === 4);

// ④ 効き目(特訓の底力: memberEffect に足される%)
const eff = (S, lv) => { const m = S.memberOf(child(lv ? [{ id: 'sokoji', lv }] : [])); return S.memberEffect(m, 'pow', 100); };
const base2 = eff(S2, 0); const base1 = eff(S1, 0);
const d2 = [1, 2, 3, 4, 5].map((lv) => Math.round((eff(S2, lv) - base2) * 100) / 100);
const d1 = [1, 2, 3, 4, 5].map((lv) => Math.round((eff(S1, lv) - base1) * 100) / 100);
check('④ 第2版: 底力 段1〜5 = 表の値', same(d2, AT.BY_ID.sokoji.v), d2.join('/'));
check('④ 第1版: 段4・5は段3と同じ値(頭打ち)', same(d1, [...S1.ASSISTS.sokoji.v, S1.ASSISTS.sokoji.v[2], S1.ASSISTS.sokoji.v[2]]), d1.join('/'));

// ⑥ 訓練に効く11種の効き目
const L5 = [1, 2, 3, 4, 5];
const r2 = (x) => Math.round(x * 100) / 100;
// 能力ごとの特訓: その能力の訓練だけ +v
const kunOk = ['pow', 'wise', 'hit', 'eva', 'tough', 'life'].every((k) => {
  const other = k === 'pow' ? 'wise' : 'pow';
  const d = L5.map((lv) => { const m = S2.memberOf(child([{ id: `kun${k}`, lv }])); const m0 = S2.memberOf(child([])); return [r2(S2.memberEffect(m, k, 100) - S2.memberEffect(m0, k, 100)), r2(S2.memberEffect(m, other, 100) - S2.memberEffect(m0, other, 100))]; });
  return same(d.map(x => x[0]), AT.BY_ID[`kun${k}`].v) && d.every(x => x[1] === 0);
});
check('⑥ 能力ごとの特訓6つ: その能力の訓練だけ 段1〜5 = 表の値', kunOk);
// はじめの親しさ: bond0 +v
const b0 = S2.memberOf(child([])).bond0;
const shi = L5.map((lv) => S2.memberOf(child([{ id: 'shitashi', lv }])).bond0 - b0);
check('⑥ はじめの親しさ: はじめの親密度 +表の値', same(shi, AT.BY_ID.shitashi.v), shi.join('/'));
// 訓練1回で確かめる(編成の0番だけ持たせ、その子が来た札を選ぶ)
const runWith = (assists, tweak) => {
  for (let t = 0; t < 400; t++) {
    let s = S2.newRun({ id: `chk${t}`, species: sp, aid: 'mua', team: [child(assists), child([])] });
    if (tweak) tweak(s);
    const cards = S2.gatherOf(s);
    const c = Object.values(cards).find(x => x.members.includes(0) && !x.members.includes(1));
    if (!c) continue;
    return { s, c, card: S2.peek(s).cards[`train:${c.stat}`] };
  }
  return null;
};
// タッグの息: タッグの強さ +v(%の点)
const tg = L5.map((lv) => { const r = runWith([{ id: 'tagpow', lv }], (s) => { s.bond[0] = 100; }); const r0 = runWith([], (s) => { s.bond[0] = 100; }); return r && r0 ? r2((r.card.tag - r0.card.tag) * 100) : null; });
check('⑥ タッグの息: タッグの強さ +表の値', same(tg, AT.BY_ID.tagpow.v), tg.join('/'));
// 見張り役: サボりの率 −v%(方針を甘やかしにしてサボりが出る形で)
const sb = L5.map((lv) => { const r = runWith([{ id: 'miharu', lv }], (s) => { s.pol = -3; }); const r0 = runWith([], (s) => { s.pol = -3; }); const p = S2.sabRateOf(r.s, r.card); const p0 = S2.sabRateOf(r0.s, r0.card); return p0 > 0 ? Math.round((1 - p / p0) * 100) : null; });
check('⑥ 見張り役: その札のサボりの率 −表の値%', sb.every((x, i) => x !== null && x === AT.BY_ID.miharu.v[i]), sb.join('/'));
// 気晴らし: 見通しのストレスが減る
const kb = L5.map((lv) => { const r = runWith([{ id: 'kibarashi', lv }]); return r ? S2.preview(r.s, { kind: 'train', stat: r.c.stat }).stress : null; });
const kb0 = (() => { const r = runWith([]); return r ? S2.preview(r.s, { kind: 'train', stat: r.c.stat }).stress : null; })();
check('⑥ 気晴らし: 訓練でたまるストレスが段ごとに減る', kb0 > 0 && kb.every((x, i) => x === Math.round(kb0 * (1 - AT.BY_ID.kibarashi.v[i] / 100))), `${kb0} → ${kb.join('/')}`);
// 仲よし特訓: 訓練1回の親密度の上がり +v(サボり等でも親密度は上がる)
const nk = L5.map((lv) => {
  for (let t = 0; t < 400; t++) {
    const mk = (as) => S2.newRun({ id: `nk${t}`, species: sp, aid: 'mua', team: [child(as), child([])] });
    const x = mk([{ id: 'nakayoshi', lv }]); const y = mk([]);
    const c = Object.values(S2.gatherOf(x)).find(z => z.members.includes(0) && !z.members.includes(1)); if (!c) continue;
    const rx = S2.act(x, { kind: 'train', stat: c.stat }); const ry = S2.act(y, { kind: 'train', stat: c.stat });
    if (rx.out.event || ry.out.event) continue;
    return (rx.state.bond[0] - x.bond[0]) - (ry.state.bond[0] - y.bond[0]);
  }
  return null;
});
check('⑥ 仲よし特訓: 訓練1回の親密度の上がり +表の値', same(nk, AT.BY_ID.nakayoshi.v), nk.join('/'));

console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
process.exit(ng ? 1 : 0);
