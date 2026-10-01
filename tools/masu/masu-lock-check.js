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
vm.runInContext(`${prefix}\nglobalThis.__lock = { MASU_LOCK_KEY, normalizeMasuLockIds, isMasuLocked, toggleMasuLockIds, buildMasuDonation, buildMasuDonations };`, context);
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

// ③ 処理の止め(本体)
check('削除の処理がお気に入りを止める',
  /const deleteMasuMon = \(masuId\) => \{\n\s*if \(isMasuLocked\(lockedMasuIds, masuId\)\) return;/.test(source));
check('合体の処理がお気に入りの副を止める',
  source.includes('if (requestedSubIds.some(id=>isMasuLocked(lockedMasuIds, id))) return null;'));
check('寄付の処理へお気に入りを渡している', /buildMasuDonations\(\{[\s\S]{0,400}lockedIds: lockedMasuIds,/.test(source));
check('起動時に印を読み込む', source.includes('setLockedMasuIds(normalizeMasuLockIds(await storeGet(MASU_LOCK_KEY, [], false)));'));
check('印の保存は専用キーだけ(マスモン本体には書かない)',
  /const toggleMasuLock = \(masuId\) => setLockedMasuIds\(prev => \{[\s\S]{0,120}storeSet\(MASU_LOCK_KEY, next, false\);/.test(source));

// ④ 画面
check('詳細にお気に入りの切り替えがある', source.includes('data-masu-lock-toggle={locked?\'on\':\'off\'}'));
check('お気に入りの子は詳細の削除ボタンを押せない', source.includes('<button disabled={isMasuLocked(lockedMasuIds, masu.id)} onClick={async()=>{ if(isMasuLocked(lockedMasuIds, masu.id)) return;'));
check('マスモンのカードに🔒が出る', source.includes('{masu&&isMasuLocked(lockedMasuIds, masu.id)&&(') && source.includes('data-masu-locked'));
check('合体の副に選べない', source.includes('disabled={locked} data-fusion-sub-locked'));
check('寄付の一覧でもお気に入りを渡して選べなくしている', source.includes('lockedIds:lockedMasuIds};') && source.includes('🔒 お気に入り</span>:<span'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
