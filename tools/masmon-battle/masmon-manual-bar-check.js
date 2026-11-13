#!/usr/bin/env node
// モンヒロサクセスの「手を選ぶ帯」(56-monhero-success-manual.jsx)を、芯の本物の手の一覧で描いて確かめる。2026-11-12 ジン
//   node tools/masmon-battle/masmon-manual-bar-check.js
//   ① 帯が4つの見出し(攻撃・防御/移動/ガッツ回復)・オートにする を出す。3体なら交代、倒れたあとは次の子を選ぶ形
//   ② 押せる/押せないが芯の ok と同じ(ガッツの足りない技・端の移動・満タンのためる・交代の待ち)
//   ③ 帯のボタンを押した手を芯に渡すと、最後まで進む(選べない手を出さない)
//   ④ 芯が無い・古いときは試合を作らない(null)
//   2026-11-12 バトル部: 撃つ前の命中%・ガッツ・届く距離を出す(社長「命中も技打つ前の技コマンドに出して」)
//   2026-11-13 段3: 技の札は間合いごとの4枚(社長)。札を押すと必ずその間合いの一覧(いちばん上が代表の技)。
//     いまの間合いの一覧だけ押して使える・ほかの間合いは見るだけ・「全部の技」では届かない技が押せない形/代表は決めた技・無ければ命中×威力
'use strict';
const fs = require('fs'); const path = require('path');
const babel = require(path.join(__dirname, '..', 'node_modules', '@babel', 'core'));
const React = require(path.join(__dirname, '..', 'node_modules', 'react'));
const RDS = require(path.join(__dirname, '..', 'node_modules', 'react-dom', 'server'));
const { load, makeUnit } = require('./load');
const ROOT = path.resolve(__dirname, '..', '..');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const { engine, catalog } = load();

const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', '56-monhero-success-manual.jsx'), 'utf8');
const code = babel.transformSync(src + '\n;module.exports = { MsxManualBar, msxManualOpen, useMsxManualMatch };',
  { presets: [[require.resolve(path.join(__dirname, '..', 'node_modules', '@babel', 'preset-react')), { runtime: 'classic' }]], filename: 'manual.jsx' }).code;
const mod = { exports: {} };
new Function('module', 'React', 'useState', 'useEffect', 'useCallback', code)(mod, React, React.useState, React.useEffect, React.useCallback);
const { MsxManualBar, msxManualOpen } = mod.exports;

// 帯の HTML から、ボタンの「押せる/押せない」を取り出す
const buttons = (html) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(m => ({ disabled: /disabled=""/.test(m[1]), text: m[2].replace(/<[^>]+>/g, ''), tech: (/data-msxm-tech="([^"]+)"/.exec(m[1]) || [])[1], all: /data-msxm-all/.test(m[1]),
  card: (/data-msa-dc-card="(\d)"/.exec(m[1]) || [])[1], cardRep: (/data-msa-dc-rep="([^"]*)"/.exec(m[1]) || [])[1], row: /msa-sh-use/.test(m[1]), repBtn: (/data-msa-rep="([^"]+)"/.exec(m[1]) || [])[1] }));
const bar = (o, extra = {}) => RDS.renderToStaticMarkup(React.createElement(MsxManualBar, { opt: o, onPick: () => {}, onAuto: () => {}, busy: false, ...extra }));
// 代表の決め方(決めていなければ 命中×威力 が最大・同じならガッツの軽いほう)を、検査の側でも計算する
const repAuto = (o, d) => { const at = o.tech.filter(t => t.dist.includes(d)); if (!at.length) return null; let b = at[0]; for (const t of at) { const a = t.p * t.power, c = b.p * b.power; if (a > c || (a === c && t.guts < b.guts)) b = t; } return b.key; };
const input = (i, size) => {
  const rng = engine.makeRng(`bar-${i}`);
  const team = (k) => ({ assistantId: Object.keys(engine.STYLES)[(i + k) % 8], tactics: 40, members: Array.from({ length: size }, () => makeUnit(engine, catalog, rng)) });
  return { seed: `bar-${i}`, catalog, teamA: team(0), teamB: team(3) };
};

let cardsOk = 0, nowOk = 0, autoRep = 0, autoRepN = 0, chosenRep = 0, chosenRepN = 0, viewOnly = 0, viewN = 0, repBtns = 0, heads = 0, autoBtn = 0, swapShown = 0, enterShown = 0, techMatch = 0, techN = 0, otherOk = 0, otherN = 0, ends = 0, bad = 0, farN = 0, farOk = 0, pShown = 0, pShownN = 0, noTechs = 0;
const N = 60;
for (let i = 0; i < N; i++) {
  const size = 1 + (i % 3);
  const m = msxManualOpen(engine, input(i, size));
  const pr = engine.makeRng(`barpick-${i}`);
  let guard = 0;
  while (m && m.pending() && guard++ < 2000) {
    const o = m.pending();
    const html = bar(o);
    const bs = buttons(html);
    if (o.kind === 'enter') {
      enterShown++;
      const c = o.enter.find(x => x.ok); if (!m.choose({ type: 'enter', to: c.to }).ok) bad++;
      continue;
    }
    if (html.includes('⚔ 攻撃') && html.includes('🛡 防御') && html.includes('移動') && html.includes('ガッツ回復')) heads++;
    if (bs.some(b => b.text === 'オートにする')) autoBtn++;
    if (size > 1 && html.includes('🔁 交代')) swapShown++;
    // 4枚の札: 間合いごとに1枚・代表は 命中×威力 が最大(決めていないとき)・いまの間合いの札に「いま」・ふだんは技のボタンを出さない
    const cards = bs.filter(b => b.card != null);
    if (cards.length === 4 && !bs.some(b => b.tech)) cardsOk++;
    if ((cards.find(b => b.card === String(o.dist)) || { text: '' }).text.includes('いま')) nowOk++;
    for (let d = 0; d < 4; d++) { autoRepN++; const c = cards.find(b => b.card === String(d)); if (c && (c.cardRep || null) === repAuto(o, d) && c.disabled === !repAuto(o, d)) autoRep++; }
    if (!o.tech.some(t => t.reach)) noTechs++;
    // 決めた代表(各間合いで届く技のうち、並びの最後の技)を渡すと、その札とその一覧のいちばん上がそれになる
    const pickRep = [0, 1, 2, 3].map(d => { const at = o.tech.filter(t => t.dist.includes(d)); return at.length ? at[at.length - 1].key : null; });
    const csR = buttons(bar(o, { rep: pickRep })).filter(b => b.card != null);
    for (let d = 0; d < 4; d++) if (pickRep[d]) { chosenRepN++; const top = buttons(bar(o, { rep: pickRep, sheetInit: d, onRep: () => {} })).find(b => b.row); if ((csR.find(b => b.card === String(d)) || {}).cardRep === pickRep[d] && top && top.text.includes('★')) chosenRep++; }
    // いまの間合いの一覧: 押せる/押せないが芯の ok と同じ・撃つ前の命中%・ガッツ・届く距離が出る
    if (o.tech.some(t => t.reach)) {
      const bsNow = buttons(bar(o, { sheetInit: o.dist, onRep: () => {} }));
      for (const t of o.tech.filter(x => x.reach)) { techN++; const b = bsNow.find(x => x.tech === t.key); if (b && b.disabled === !t.ok) techMatch++; }
      pShownN++;
      if (o.tech.filter(t => t.reach).every(t => { const b = bsNow.find(x => x.tech === t.key); return b && b.text.includes(`命中 ${Math.round(t.p)}%`) && b.text.includes(`ガッツ ${t.guts}`) && b.text.includes('届く'); })) pShown++;
      if (bsNow.some(b => b.repBtn) || o.tech.filter(t => t.reach).length === 1) repBtns++;   // 届く技が1つなら、それが代表(☆ は出ない)
    }
    // ほかの間合いの一覧は見るだけ(押して使えない)
    const other = [0, 1, 2, 3].find(d => d !== o.dist && o.tech.some(t => t.dist.includes(d)));
    if (other != null) { viewN++; const rows = buttons(bar(o, { sheetInit: other })).filter(b => b.row); if (rows.length && rows.every(b => b.disabled && !b.tech)) viewOnly++; }
    // 全部の技: 届かない技は押せない形
    const far = o.tech.filter(x => !x.reach);
    const bsAll = buttons(bar(o, { sheetInit: 'all' }));
    for (const t of far) { farN++; const b = bsAll.find(x => x.tech === t.key); if (b && b.disabled && b.text.includes('いまは届かない')) farOk++; }
    const ch = bs.find(b => b.text.startsWith('💪 ためる')); otherN++; if (ch && ch.disabled === !o.charge.ok) otherOk++;
    for (const mv of o.move) { otherN++; const b = bs.find(x => x.text.startsWith(mv.step < 0 ? '◀ 前へ' : '後ろへ')); if (b && b.disabled === !mv.ok) otherOk++; }
    // 押せるボタンの手を芯に渡す
    const all = [...o.tech.filter(x => x.ok), o.guard, ...o.move.filter(x => x.ok), ...(o.charge.ok ? [o.charge] : []), ...o.swap.filter(x => x.ok)];
    const c = all[Math.floor(pr() * all.length)];
    if (!m.choose(c).ok) bad++;
  }
  if (m && m.done()) ends++;
}
const acts = autoBtn;
check('① 帯に4つの見出しと「オートにする」が出る', heads === acts && acts > 0, `${heads}/${acts}`);
check('① 3体なら交代の段、倒れたら次の子を選ぶ形', swapShown > 0 && enterShown > 0, `交代 ${swapShown}・次の子 ${enterShown}`);
check('② 技の札は間合いごとの4枚(ふだんは技のボタンを出さない)・いまの間合いの札に「いま」', cardsOk === acts && nowOk === acts, `${cardsOk}・${nowOk}/${acts}`);
check('② 代表を決めていなければ 命中×威力 が最大の技(届く技が無い間合いは押せない札)', autoRep === autoRepN && autoRepN > 0, `${autoRep}/${autoRepN}`);
check('② 決めた代表がその札と一覧のいちばん上(★)に出る', chosenRep === chosenRepN && chosenRepN > 0, `${chosenRep}/${chosenRepN}`);
check('② いまの間合いの一覧: 技の押せる/押せないが芯の ok と同じ', techMatch === techN && techN > 0, `${techMatch}/${techN}`);
check('② いまの間合いの一覧: 撃つ前の命中%・使うガッツ・届く距離が出る・代表でない技に「☆ 代表にする」', pShown === pShownN && repBtns === pShownN && pShownN > 0, `${pShown}・${repBtns}/${pShownN}`);
check('② ほかの間合いの一覧は見るだけ(押して使えない)', viewOnly === viewN && viewN > 0, `${viewOnly}/${viewN}`);
check('② 「全部の技」の一覧では、届かない技が押せない形で並ぶ', farN > 0 && farOk === farN, `${farOk}/${farN}`);
check('② ためる・前へ/後ろへの押せる/押せないが芯と同じ', otherOk === otherN, `${otherOk}/${otherN}`);
check('③ 帯の手を渡して最後まで進む', ends === N && bad === 0, `${ends}/${N}・断られた ${bad}`);
check('④ 芯が無い・古いときは null', msxManualOpen(null, input(0, 1)) === null && msxManualOpen({ simulate() {} }, input(0, 1)) === null);
const busyHtml = RDS.renderToStaticMarkup(React.createElement(MsxManualBar, { opt: msxManualOpen(engine, input(1, 1)).pending(), onPick: () => {}, busy: true }));
check('② 相手の手を見せている間(busy)は手のボタンも札も押せない', buttons(busyHtml).filter(b => !b.all).every(b => b.disabled));

console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
process.exit(ng ? 1 : 0);
