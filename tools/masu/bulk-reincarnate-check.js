// まとめて転生(2026-10-17 社長依頼「転生可能な各キャラにチェックボックス…すべて選択…まとめて転生」)を確かめる。
//
//   node tools/masu/bulk-reincarnate-check.js
//
//   ① 何体かをまとめて転生した結果(個体・ダイヤ・Lv・強化P・固有技ポイント)が、1体ずつ「あとで決める」で
//      転生したときと全く同じ
//   ② 同じ子を2回選んでも1回しか転生しない(二重に転生しない)
//   ③ 途中で転生できない子(ダイヤ不足・転生ロック・Lv不足)が出たら、そこで止まり、手前の子だけが変わる。
//      1体目から転生できなければ何も変わらない
//   ④ 本体: 個体とダイヤを1回の取引で保存する / 処理中の印を待ちの前に立てる / 仲良し度は1体ごとに足す /
//      保存に失敗したら何も変わらない
//   ⑤ 画面: 選ぶ印・すべて選択(編成中とお気に入りは選ばない)・選択を外す・確認の窓が、同じ計算を使う
//   実際の画面(iPhone幅・二度押し)は bulk-reincarnate-browser-check.js
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const L = loadDyeModule();
const { buildMasuReincarnation, buildMasuReincarnationMulti, REINCARNATE_POINTS, REINCARNATE_LEVEL_DROP } = L;

const mk = (id, baseId, bondXp) => ({ id, baseId, name:`テスト${id}`, bondXp, levelCap:400, rebirthCount:30 });
const mons = [mk('a', 'Ark', 9999999), mk('b', 'Zan', 7000000), mk('c', 'Mocchi', 50), mk('d', 'Ark', 8500000)];

// 1体ずつ「あとで決める」で順に転生する(画面で1体ずつ押したときと同じ)
const oneByOne = (list, ids, gold, lockedIds = []) => {
  let cur = list.slice(), g = gold;
  for (const id of ids) {
    const masu = cur.find(m => String(m.id) === String(id));
    const r = buildMasuReincarnation({ masu, skillKey:'', gold:g, lockedIds });
    if (!r.ok) break;
    cur = cur.map(m => String(m.id) === String(id) ? r.nextMasu : m);
    g = r.nextGold;
  }
  return { mons:cur, gold:g };
};

// ① 1体ずつと同じ
{
  const gold = 99999999;
  const multi = buildMasuReincarnationMulti({ masuMons:mons, ids:['a', 'b', 'd'], gold });
  const single = oneByOne(mons, ['a', 'b', 'd'], gold);
  check('3体まとめて転生 = 1体ずつ3回(個体・ダイヤ)', multi.ok && multi.count === 3 && same(multi.nextMasuMons, single.mons) && multi.nextGold === single.gold,
    `ダイヤ ${multi.nextGold} / ${single.gold}`);
  check('ダイヤの合計 = 1体ずつの値段の合計', multi.cost === gold - single.gold && multi.cost === multi.done.reduce((s, d) => s + d.result.cost, 0));
  check('選ばなかった子は変わらない', same(multi.nextMasuMons.find(m => m.id === 'c'), mons.find(m => m.id === 'c')));
  check(`1体ごとにLvが${REINCARNATE_LEVEL_DROP}下がり、転生ぶんの強化P+${REINCARNATE_POINTS}・固有技ポイント+1`,
    multi.done.every(d => d.result.fromLevel - d.result.nextLevel === REINCARNATE_LEVEL_DROP || d.result.nextLevel === 1)
    && multi.gainedPoints === REINCARNATE_POINTS * 3 && multi.done.every(d => d.result.raisesSkill === false && d.result.gainedPoints === REINCARNATE_POINTS));
  check('固有技は上げない(「あとで決める」と同じ)', multi.done.every(d => d.result.skillKey === null));
  check('元の配列は書き換えない', mons[0].bondXp === 9999999 && !('reincarnateCount' in mons[0] && mons[0].reincarnateCount > 0));
}
// ② 二重に転生しない
{
  const multi = buildMasuReincarnationMulti({ masuMons:mons, ids:['a', 'a', 'a'], gold:99999999 });
  const single = oneByOne(mons, ['a'], 99999999);
  check('同じ子を3回選んでも1回だけ転生する', multi.ok && multi.count === 1 && same(multi.nextMasuMons, single.mons));
  const numeric = buildMasuReincarnationMulti({ masuMons:[{ ...mons[0], id:7 }], ids:[7, '7'], gold:99999999 });
  check('数字と文字のidが混ざっても1回だけ', numeric.ok && numeric.count === 1);
}
// ③ 途中で止まる
{
  const costA = buildMasuReincarnation({ masu:mons[0], skillKey:'', gold:99999999 }).cost;
  const multi = buildMasuReincarnationMulti({ masuMons:mons, ids:['a', 'b', 'd'], gold:costA });
  check('ダイヤが1体ぶんしか無いと、1体目だけ転生して2体目で止まる', multi.ok && multi.count === 1 && multi.stoppedId === 'b'
    && /ダイヤ/.test(multi.stopReason) && multi.nextGold === 0 && same(multi.nextMasuMons, oneByOne(mons, ['a'], costA).mons));
  const lv = buildMasuReincarnationMulti({ masuMons:mons, ids:['a', 'c', 'd'], gold:99999999 });
  check('Lvが足りない子で止まり、その先の子は転生しない', lv.ok && lv.count === 1 && lv.stoppedId === 'c' && same(lv.nextMasuMons.find(m => m.id === 'd'), mons.find(m => m.id === 'd')));
  const locked = buildMasuReincarnationMulti({ masuMons:mons, ids:['b', 'a'], gold:99999999, lockedIds:['a'] });
  check('転生ロックの子で止まる', locked.ok && locked.count === 1 && locked.stoppedId === 'a' && /転生ロック/.test(locked.stopReason));
  const none = buildMasuReincarnationMulti({ masuMons:mons, ids:['c'], gold:99999999 });
  check('1体目から転生できなければ何も変わらない', !none.ok && none.nextMasuMons === mons && none.cost === 0);
  const poor = buildMasuReincarnationMulti({ masuMons:mons, ids:['a'], gold:0 });
  check('ダイヤが0なら何も変わらない', !poor.ok && poor.nextGold === 0 && poor.nextMasuMons === mons);
  const missing = buildMasuReincarnationMulti({ masuMons:mons, ids:['zz'], gold:99999999 });
  check('いない子を選んでいても壊れない', !missing.ok && missing.nextMasuMons === mons);
}

// ④ 本体
const app = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const body = (app.split('const executeMasuReincarnationBulk = async')[1] || '').split('\n  };')[0];
check('本体: まとめて転生の処理がある', body.length > 0 && app.includes('executeMasuReincarnationBulk={executeMasuReincarnationBulk}'));
check('本体: 処理中なら最初に断る', /^ \(ids\) => \{\n\s*if \(reincarnateProcessingRef\.current\) return/.test(body));
check('本体: 処理中の印を、保存を待つ前に立てる', body.indexOf('reincarnateProcessingRef.current = true') > 0 && body.indexOf('reincarnateProcessingRef.current = true') < body.indexOf('await '));
check('本体: 画面と同じ計算(buildMasuReincarnationMulti)を使う', body.includes('buildMasuReincarnationMulti({ masuMons:before, ids, gold, lockedIds:rebirthLockedMasuIds })'));
check('本体: 個体とダイヤを1回の取引で保存する(失敗したらどちらも戻る)',
  /saveStoredValuesOrRollback\(\[\s*\{ key:'mh_masu_mons', before, next:result\.nextMasuMons \},\s*\{ key:'mh_gold', before:gold, next:result\.nextGold \},\s*\], storeGet, storeSet\)/.test(body)
  && /if \(!saved\) throw/.test(body));
check('本体: 保存できてから画面の値を変える', body.indexOf('if (!saved) throw') < body.indexOf('setMasuMons(result.nextMasuMons)'));
check('本体: 仲良し度は1体ずつ転生したときと同じく、1体ごとに足す', body.includes("result.done.forEach(() => addAssistantBond('reincarnate'))"));

// ⑤ 画面
const screen = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/62-screen-masu-temple.jsx'), 'utf8');
check('画面: 転生できる子にだけ選ぶ印(role=checkbox)を出す', /\{can&&<button type="button" role="checkbox" aria-checked=\{on\}/.test(screen));
check('画面: 「すべて選択」は編成中とお気に入りの子を選ばない', screen.includes('eligible.filter(masu=>!inParty(masu)&&!isFavorite(masu))'));
check('画面: 「選択を外す」がある', screen.includes('onClick={()=>setBulkIds([])}') && screen.includes('選択を外す'));
check('画面: 確認の窓は実行と同じ計算(buildMasuReincarnationMulti)で見積もる', screen.includes('buildMasuReincarnationMulti({masuMons,ids:picked,gold,lockedIds:rebirthLockedMasuIds})'));
check('画面: 確認の窓に一覧・得られる物・失う物・ダイヤの合計と残りが出る',
  ['data-reincarnate-bulk-list', '得られる物', '失う物', '必要ダイヤ合計', '所持ダイヤ', '転生後'].every(t => screen.includes(t)));
check('画面: 実行中は「転生する」を押せない', /disabled=\{busy\|\|!preview\?\.ok\} onClick=\{confirmBulk\}/.test(screen) && /if\(busy\|\|!preview\?\.ok\) return;/.test(screen));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
