// モンヒロサクセスの「技の升の選び」(芯 data/monhero-success.js の techPick)を確かめる(画面は開かない)
//   ・升(ランク×間合い)に技が2つ以上ある種族で、選ばなかった技は覚える候補(learnable)から外れる
//   ・項目の無い育成(古い保存)は絞らない・壊れた値は並びの1つ目に直る・保存から戻しても残る
//   ・その升の技を1つでも覚えたら選びは変えられない・選べる技は同じ升の技だけ
'use strict';
const { load } = require('./load.js');
const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };
const { SUC } = load();

// 升に技が2つ以上ある種族を探す(スネグーラチカなど)
const sp = ['Snegurochka', 'Pandora', 'Melody', 'Kuromy'].find((x) => Object.values(SUC.techCells(x)).some((l) => l.length >= 2));
ok(!!sp, '升に技が2つ以上ある種族が見つからない');
if (sp) {
  const cells = SUC.techCells(sp); const cell = Object.keys(cells).find((c) => cells[c].length >= 2 && !cells[c].some((t) => t.learn && t.learn.start));
  ok(!!cell, '「はじめからの技が無い」被った升が見つからない');
  if (cell) {
    const [a, b] = cells[cell];
    const mk = (techPick) => { const s = SUC.newRun({ id: 't', species: sp, ...(techPick ? { techPick } : {}) }); s.stats = Object.fromEntries(Object.keys(s.stats).map((k) => [k, 999])); s.mastery = new Proxy(s.mastery, { get: (o, k) => (k in o ? o[k] : 999) }); return s; };
    const ids = (s) => SUC.learnable(s, 'fire').map((t) => t.id);
    // 項目なし → 絞らない
    let s0 = mk(null); ok(s0.techPick === undefined, '項目を渡さない育成に techPick が付いている');
    ok(ids(s0).includes(a.id) && ids(s0).includes(b.id), '項目なしで被った升の技が両方出ない');
    // 既定(空の選び) → 1つ目
    let s1 = mk({}); ok(s1.techPick[cell] === a.id, `空の選びが1つ目にならない: ${s1.techPick[cell]}`);
    ok(ids(s1).includes(a.id) && !ids(s1).includes(b.id), '既定で2つ目が候補に残っている');
    // 2つ目を選ぶ
    let s2 = mk({ [cell]: b.id }); ok(ids(s2).includes(b.id) && !ids(s2).includes(a.id), '2つ目を選んだのに候補が合わない');
    // 壊れた値
    let s3 = mk({ [cell]: 'zzz', 'x-y': 'q' }); ok(s3.techPick[cell] === a.id && !('x-y' in s3.techPick), '壊れた選びが直らない');
    // 保存から戻す
    const back = SUC.restore ? SUC.restore(JSON.parse(JSON.stringify(s2))) : null;
    ok(!back || back.techPick[cell] === b.id, '保存から戻すと選びが消える');
    const old = JSON.parse(JSON.stringify(s0)); const back0 = SUC.restore ? SUC.restore(old) : null;
    ok(!back0 || back0.techPick === undefined, '古い保存を戻すと選びが付いてしまう');
    // 変えられる・変えられない
    let s4 = mk({}); ok(SUC.setTechPick(s4, cell, b.id) === true && s4.techPick[cell] === b.id, '覚える前なのに選びが変えられない');
    ok(SUC.setTechPick(s4, cell, 'zzz') === false, '知らない技を選べてしまう');
    s4.techs.push(b.id); ok(SUC.techPickLocked(s4, cell) && SUC.setTechPick(s4, cell, a.id) === false && s4.techPick[cell] === b.id, '覚えたあとなのに選びが変えられる');
  }
}
if (errors.length) { console.log('NG: 技の升の選び'); errors.forEach((e) => console.log(' - ' + e)); process.exit(1); }
console.log('OK: 技の升の選び(候補の絞り込み・既定・保存から戻す・覚えたあとは固定)');
