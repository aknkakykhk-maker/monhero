// モンヒロサクセスの「技の升の選び」(芯 data/monhero-success.js の techPick)を確かめる(画面は開かない)
//   ・升(ランク×間合い)に技が2つ以上ある種族で、選ばなかった技は覚える候補(learnable)から外れる
//   ・項目の無い育成(古い保存)は絞らない・壊れた値は並びの1つ目に直る・保存から戻しても残る
//   ・その升の技を覚えたあとでも選び直せて、もう片方も候補に出る(方式C・2026-11-17)。前に覚えた技は残る
//   ・選べる技は同じ升の技だけ。はじめからの技と同居する升(剣士モッチー 1-2)でも、保存した選びが start 技に戻らない
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
    s4.techs.push(b.id); // 方式C: 覚えたあとでも選び直せる(ロック無し)
    ok(SUC.techPickLocked(s4, cell) === false, '覚えたあとにロックが掛かっている');
    ok(SUC.setTechPick(s4, cell, a.id) === true && s4.techPick[cell] === a.id, '覚えたあとなのに選び直せない');
    ok(s4.techs.includes(b.id), '選び直しで前に覚えた技が消えた');
    ok(ids(s4).includes(a.id) && !ids(s4).includes(b.id), '選び直したあとの候補が合わない(覚えた技は候補に戻らない・もう片方が出る)');
    // 両方覚える: a も覚えたら、同じ升の技を両方持てる
    s4.techs.push(a.id); ok(s4.techs.includes(a.id) && s4.techs.includes(b.id), '同じ升の技を両方持てない');
  }
}
// はじめからの技と同居する升(剣士モッチー 1-2): 保存した選びが start 技に戻らない・既定は start 技
{
  const kc = SUC.techCells('KenshiMocchi'); const kcell = Object.keys(kc).find((c) => kc[c].length >= 2 && kc[c].some((t) => t.learn && t.learn.start));
  ok(!!kcell, '剣士モッチーの start 同居升が見つからない');
  if (kcell) {
    const start = kc[kcell].find((t) => t.learn && t.learn.start); const other = kc[kcell].find((t) => t !== start);
    ok(SUC.techPickNorm({}, 'KenshiMocchi')[kcell] === start.id, '剣士モッチー: 選びが無いときの既定が start 技でない');
    ok(SUC.techPickNorm({ [kcell]: other.id }, 'KenshiMocchi')[kcell] === other.id, '剣士モッチー: 保存した選びが start 技に戻ってしまう');
    const ks = SUC.newRun({ id: 'k', species: 'KenshiMocchi', techPick: { [kcell]: other.id } });
    ok(ks.techPick[kcell] === other.id, '剣士モッチー: 育成開始で選びが戻ってしまう');
    const kback = SUC.restore ? SUC.restore(JSON.parse(JSON.stringify(ks))) : null;
    ok(!kback || kback.techPick[kcell] === other.id, '剣士モッチー: 保存から戻すと選びが戻ってしまう');
  }
}
if (errors.length) { console.log('NG: 技の升の選び'); errors.forEach((e) => console.log(' - ' + e)); process.exit(1); }
console.log('OK: 技の升の選び(候補の絞り込み・既定・保存から戻す・覚えたあとでも選び直し可=方式C・start同居升の選び保持)');
