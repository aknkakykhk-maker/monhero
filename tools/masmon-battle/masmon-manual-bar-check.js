#!/usr/bin/env node
// モンヒロサクセスの「手を選ぶ帯」(56-monhero-success-manual.jsx)を、芯の本物の手の一覧で描いて確かめる。2026-11-12 ジン
//   node tools/masmon-battle/masmon-manual-bar-check.js
//   ① 帯が4つの見出し(攻撃・防御/移動/ガッツ回復)・オートにする を出す。3体なら交代、倒れたあとは次の子を選ぶ形
//   ② 押せる/押せないが芯の ok と同じ(ガッツの足りない技・端の移動・満タンのためる・交代の待ち)
//   ③ 帯のボタンを押した手を芯に渡すと、最後まで進む(選べない手を出さない)
//   ④ 芯が無い・古いときは試合を作らない(null)
//   2026-11-12 バトル部: 撃つ前の命中%・ガッツ・届く距離を出す(社長「命中も技打つ前の技コマンドに出して」)
//   2026-11-13 段3: ふだんは届く技だけ。「全部の技」で開くと、届かない技も押せない形で並ぶ(社長「技の札はいまの間合いで届く技だけ」)
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
const buttons = (html) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(m => ({ disabled: /disabled=""/.test(m[1]), text: m[2].replace(/<[^>]+>/g, ''), tech: (/data-msxm-tech="([^"]+)"/.exec(m[1]) || [])[1], all: /data-msxm-all/.test(m[1]) }));
const input = (i, size) => {
  const rng = engine.makeRng(`bar-${i}`);
  const team = (k) => ({ assistantId: Object.keys(engine.STYLES)[(i + k) % 8], tactics: 40, members: Array.from({ length: size }, () => makeUnit(engine, catalog, rng)) });
  return { seed: `bar-${i}`, catalog, teamA: team(0), teamB: team(3) };
};

let hidden = 0, allBtn = 0, heads = 0, autoBtn = 0, swapShown = 0, enterShown = 0, techMatch = 0, techN = 0, otherOk = 0, otherN = 0, ends = 0, bad = 0, farN = 0, farOk = 0, pShown = 0;
const N = 60;
for (let i = 0; i < N; i++) {
  const size = 1 + (i % 3);
  const m = msxManualOpen(engine, input(i, size));
  const pr = engine.makeRng(`barpick-${i}`);
  let guard = 0;
  while (m && m.pending() && guard++ < 2000) {
    const o = m.pending();
    const html = RDS.renderToStaticMarkup(React.createElement(MsxManualBar, { opt: o, onPick: () => {}, onAuto: () => {}, busy: false }));
    const bs = buttons(html);
    if (o.kind === 'enter') {
      enterShown++;
      const c = o.enter.find(x => x.ok); if (!m.choose({ type: 'enter', to: c.to }).ok) bad++;
      continue;
    }
    if (html.includes('⚔ 攻撃') && html.includes('🛡 防御') && html.includes('移動') && html.includes('ガッツ回復')) heads++;
    if (bs.some(b => b.text === 'オートにする')) autoBtn++;
    if (size > 1 && html.includes('🔁 交代')) swapShown++;
    for (const t of o.tech.filter(x => x.reach)) { techN++; const b = bs.find(x => x.tech === t.key); if (b && b.disabled === !t.ok) techMatch++; }
    const far = o.tech.filter(x => !x.reach);
    if (far.length && far.every(t => !bs.some(x => x.tech === t.key))) hidden++;
    if (far.length && bs.some(x => x.all)) allBtn++;
    const bsAll = buttons(RDS.renderToStaticMarkup(React.createElement(MsxManualBar, { opt: o, onPick: () => {}, onAuto: () => {}, busy: false, allInit: true })));
    for (const t of far) { farN++; const b = bsAll.find(x => x.tech === t.key); if (b && b.disabled && b.text.includes('いまは届かない')) farOk++; }
    if (o.tech.filter(t => t.reach).every(t => { const b = bs.find(x => x.tech === t.key); return b && b.text.includes(`命中 ${Math.round(t.p)}%`) && b.text.includes(`ガッツ ${t.guts}`) && b.text.includes('届く'); })) pShown++;
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
check('② 技のボタンの押せる/押せないが芯の ok と同じ', techMatch === techN && techN > 0, `${techMatch}/${techN}`);
check('② ふだんは届く技だけ(届かない技がある手番では「全部の技」のボタン)', hidden > 0 && hidden === allBtn, `${hidden}/${allBtn}`);
check('② 「全部の技」を開くと、届かない技も押せない形で並ぶ', farN > 0 && farOk === farN, `${farOk}/${farN}`);
check('② 技のボタンに撃つ前の命中%・使うガッツ・届く距離が出る', pShown === acts, `${pShown}/${acts}`);
check('② ためる・前へ/後ろへの押せる/押せないが芯と同じ', otherOk === otherN, `${otherOk}/${otherN}`);
check('③ 帯の手を渡して最後まで進む', ends === N && bad === 0, `${ends}/${N}・断られた ${bad}`);
check('④ 芯が無い・古いときは null', msxManualOpen(null, input(0, 1)) === null && msxManualOpen({ simulate() {} }, input(0, 1)) === null);
const busyHtml = RDS.renderToStaticMarkup(React.createElement(MsxManualBar, { opt: msxManualOpen(engine, input(1, 1)).pending(), onPick: () => {}, busy: true }));
check('② 相手の手を見せている間(busy)は手のボタンを押せない', buttons(busyHtml).filter(b => !b.all).every(b => b.disabled));

console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
process.exit(ng ? 1 : 0);
