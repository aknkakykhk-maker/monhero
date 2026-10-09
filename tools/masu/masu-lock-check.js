const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// マスモンのお気に入り(ロック)(2026-10-01)を確かめる。
//
//   ユーザー指示「マスモンのロック機能がほしい。お気に入りにすると売却や合体等いなくなるやつができなくなる」。
//   いなくなる操作は 削除・合体の副・寄付 の3つ。画面で押せなくするだけでなく、処理そのものでも止める。
//
// 見るもの
//   ① 印の保存は新しいキー mh_masu_locked_v1(IDの並びだけ)。壊れた保存値は「お気に入りなし」になる
//   ② 寄付の計算(buildMasuDonation / buildMasuDonations)はお気に入りの子を断り、何も確定しない
//   ③ 削除・合体の処理が、お気に入りの子を止めている(本体のソース)
//   ④ 画面: 詳細の切り替え・削除ボタンを押せない・カードの🔒・合体と寄付で選べない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const context = {
  BREEDER_MARKET_ITEMS: [],
  React: { Component: class { setState() {} }, PureComponent: class { setState() {} }, createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} },
  ALL_PLAYER_MONSTERS: {
    Ark: { id:'Ark', name:'アーク', baseHp:100, baseAtk:20, baseDef:20, baseGuts:20, distAptitude:['C','C','C','C'] },
    Suezo: { id:'Suezo', name:'スエゾー', baseHp:50, baseAtk:10, baseDef:10, baseGuts:10, distAptitude:['C','C','C','C'] },
  },
};
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.__lock = { MASU_LOCK_KEY, MASU_REBIRTH_LOCK_KEY, MASU_LOCK_KINDS, normalizeMasuLockIds, isMasuLocked, toggleMasuLockIds, buildMasuDonation, buildMasuDonations, buildMasuReincarnation, buildMasuReincarnationBatch };`, context);
const L = context.__lock;
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };

// ① 保存
check('印の保存キーは新しい mh_masu_locked_v1', L.MASU_LOCK_KEY === 'mh_masu_locked_v1');
check('壊れた保存値は「お気に入りなし」になる',
  JSON.stringify(L.normalizeMasuLockIds(null)) === '[]' && JSON.stringify(L.normalizeMasuLockIds({ a:1 })) === '[]'
  && JSON.stringify(L.normalizeMasuLockIds('x')) === '[]');
check('重複・空・おかしな値を取り除き、IDは文字にそろえる',
  JSON.stringify(L.normalizeMasuLockIds(['a', 'a', '', null, 12, {}, 'b'])) === '["a","12","b"]');
check('切り替えで付けて、もう一度で外れる',
  JSON.stringify(L.toggleMasuLockIds(['a'], 'b')) === '["a","b"]' && JSON.stringify(L.toggleMasuLockIds(['a', 'b'], 'a')) === '["b"]');
check('判定はIDの数と文字を区別しない', L.isMasuLocked(['12'], 12) && !L.isMasuLocked(['12'], 13) && !L.isMasuLocked(null, 'a'));

// ② 寄付
const masuMons = [
  { id:'target', baseId:'Ark', name:'ぼんた', bondXp:1250 },
  { id:'keep', baseId:'Suezo', name:'キープ', bondXp:99 },
];
const unlocked = ['Ark','Suezo','Mocchi','Mitarashi','Golem','Pixie','Tiger','Ham','Oboro'];
const roster = ['Ark','Suezo','Mocchi','Mitarashi','Golem','Pixie','Tiger','Ham'];
const base = { masuMons, gold:50, monsterRosterIds:roster, draftMonsterRoster:roster, unlockedMonsterIds:unlocked, validBaseIds:[...unlocked], requiredCount:8 };
const blocked = L.buildMasuDonation({ ...base, targetId:'target', lockedIds:['target'] });
check('お気に入りの子は寄付できない(理由を返す)', !blocked.ok && /お気に入り/.test(blocked.reason));
const free = L.buildMasuDonation({ ...base, targetId:'target', lockedIds:['keep'] });
check('お気に入りでない子はこれまでどおり寄付できる', free.ok && free.nextMasuMons.length === 1);
check('お気に入りを渡さない呼び方(これまでの形)も動く', L.buildMasuDonation({ ...base, targetId:'target' }).ok);
const multi = L.buildMasuDonations({ ...base, targetIds:['keep', 'target'], lockedIds:['target'] });
check('まとめて寄付で1体でもお気に入りが混ざると、何も確定しない', !multi.ok && /お気に入り/.test(multi.reason));

// ②' ロックの種類(2026-10-01・ユーザー指示「転生もしたくない場合もあるからロックにも種類を分けたい」)
check('ロックは「お気に入り」と「転生ロック」の2種類で、保存キーが別',
  Object.keys(L.MASU_LOCK_KINDS).join() === 'keep,rebirth'
  && L.MASU_LOCK_KINDS.keep.key === 'mh_masu_locked_v1' && L.MASU_LOCK_KINDS.rebirth.key === 'mh_masu_lock_rebirth_v1'
  && L.MASU_REBIRTH_LOCK_KEY === 'mh_masu_lock_rebirth_v1');
const lv100 = { id:'r1', baseId:'Ark', name:'リンネ', bondXp:9999999, levelCap:99 };
const reinOk = L.buildMasuReincarnation({ masu:lv100, skillKey:'', gold:99999999 });
check('転生ロックを渡さなければ、これまでどおり転生の計算が進む(この個体がLv条件を満たす場合)',
  reinOk.ok || !/転生ロック/.test(reinOk.reason || ''));
const reinBlocked = L.buildMasuReincarnation({ masu:lv100, skillKey:'', gold:99999999, lockedIds:['r1'] });
check('転生ロックの子は転生できない(理由に転生ロックと出る)', !reinBlocked.ok && /転生ロック/.test(reinBlocked.reason));
check('転生ロックは別の子には効かない', !/転生ロック/.test(L.buildMasuReincarnation({ masu:lv100, skillKey:'', gold:99999999, lockedIds:['other'] }).reason || ''));
check('お気に入りだけでは転生は止まらない(別々のロック)', !/転生ロック/.test(L.buildMasuReincarnation({ masu:lv100, skillKey:'', gold:99999999, lockedIds:[] }).reason || ''));
// まとめ転生(2026-10-08 PR #2348)も、1回ぶんの転生と同じロックで止まる(何回ぶんでも、1回目で止まって何も変わらない)
const batchBlocked = L.buildMasuReincarnationBatch({ masu:lv100, skillKey:'', gold:99999999, lockedIds:['r1'], count:5 });
check('まとめ転生でも、転生ロックの子は1回も転生できない', !batchBlocked.ok && batchBlocked.count === 0 && /転生ロック/.test(batchBlocked.reason || ''));
const batchOther = L.buildMasuReincarnationBatch({ masu:lv100, skillKey:'', gold:99999999, lockedIds:['other'], count:2 });
check('まとめ転生の転生ロックも、別の子には効かない', !/転生ロック/.test(batchOther.reason || '') && !/転生ロック/.test(batchOther.stopReason || ''));
check('転生ロックだけでは寄付は止まらない(別々のロック)', L.buildMasuDonation({ ...base, targetId:'target', lockedIds:[] }).ok);

// ③ 処理の止め(本体)
check('削除の処理がお気に入りを止める',
  /const deleteMasuMon = \(masuId\) => \{\n\s*if \(isMasuLocked\(lockedMasuIds, masuId\)\) return;/.test(source));
check('合体の処理がお気に入りの副を止める',
  source.includes('if (requestedSubIds.some(id=>isMasuLocked(lockedMasuIds, id))) return null;'));
check('寄付の処理へお気に入りを渡している', /buildMasuDonations\(\{[\s\S]{0,400}lockedIds: lockedMasuIds,/.test(source));
check('起動時に印を読み込む(お気に入りと転生ロック)',
  source.includes('setLockedMasuIds(normalizeMasuLockIds(await storeGet(MASU_LOCK_KEY, [], false)));')
  && source.includes('setRebirthLockedMasuIds(normalizeMasuLockIds(await storeGet(MASU_REBIRTH_LOCK_KEY, [], false)));'));
check('印の保存は種類ごとの専用キーだけ(マスモン本体には書かない)',
  /const toggleMasuLock = \(masuId, kind = 'keep'\) => \{[\s\S]{0,420}storeSet\(storeKey, next, false\);/.test(source)
  && source.includes('(MASU_LOCK_KINDS[kind] || MASU_LOCK_KINDS.keep).key'));
// 転生ボタンの処理は、まとめ転生(buildMasuReincarnationBatch)へ転生ロックを渡し、まとめ転生は1回ごとの転生へそのまま渡す
// (2026-10-08 にまとめ転生へ変わり、ここが1回ぶんの呼び方のままで落ちていた。2026-10-09 に今の書き方へ合わせた)
check('転生の処理へ転生ロックを渡している',
  source.includes('buildMasuReincarnationBatch({ masu, skillKey:reincarnateSkillKey, gold, lockedIds:rebirthLockedMasuIds, count:reincarnateTimes })')
    && source.includes('const r = buildMasuReincarnation({ masu:cur, skillKey, gold:goldLeft, lockedIds });'));
check('転生の画面の「何回ぶん」の見積もりにも、同じ転生ロックを渡している',
  source.includes('const batchArgs={masu:selected,skillKey:reincarnateSkillKey||\'\',gold,lockedIds:rebirthLockedMasuIds};'));

// ④ 画面
check('詳細の見出しの下に、お気に入りと転生ロックの切り替えが並ぶ(右上の✕から離れている)',
  source.includes('data-masu-lock-row') && source.includes('data-masu-lock-quick={kind}') && source.includes("{['keep','rebirth'].map(kind=>")
  && !source.includes('data-masu-lock-quick={locked'));
check('詳細の下にも、何を防ぐかの説明つきで2種類の切り替えがある', source.includes('data-masu-lock-panel') && source.includes('data-masu-lock-toggle={kind}'));
check('お気に入りの子は詳細の削除ボタンを押せない', source.includes('<button disabled={isMasuLocked(lockedMasuIds, masu.id)} onClick={async()=>{ if(isMasuLocked(lockedMasuIds, masu.id)) return;'));
check('マスモンのカードにロックの印が出る(🔒 お気に入り・🔁 転生ロック)',
  source.includes('data-masu-locked=') && source.includes("isMasuLocked(rebirthLockedMasuIds, masu.id)&&'🔁'") && source.includes("isMasuLocked(lockedMasuIds, masu.id)&&'🔒'"));
check('転生の一覧で転生ロックの子を選べない', source.includes('data-reincarnate-locked') && source.includes('🔁 転生ロック</span>'));
check('合体の副に選べない', source.includes('disabled={locked} data-fusion-sub-locked'));
check('寄付の一覧でもお気に入りを渡して選べなくしている', source.includes('lockedIds:lockedMasuIds};') && source.includes('🔒 お気に入り</span>:<span'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
