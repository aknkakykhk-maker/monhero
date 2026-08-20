const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 神殿の寄付計算・編成補正・保存経路を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const sourcePath = path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const context = {
  React: { createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} },
  ALL_PLAYER_MONSTERS: {
    Ark: { id:'Ark', name:'アーク', baseHp:100, baseAtk:20, baseDef:20, baseGuts:20, distAptitude:['C','C','C','C'] },
    Suezo: { id:'Suezo', name:'スエゾー', baseHp:50, baseAtk:10, baseDef:10, baseGuts:10, distAptitude:['C','C','C','C'] },
  },
};
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.__donation = { donationDiamondValue, buildMasuDonation, buildMasuDonations, masuPowerOf, sortDonationMasuMons };`, context);
const { donationDiamondValue, buildMasuDonation, buildMasuDonations, masuPowerOf, sortDonationMasuMons } = context.__donation;
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
const masuMons = [
  { id:'target', baseId:'Ark', name:'ぼんた', bondXp:1250 },
  { id:'keep', baseId:'Suezo', name:'キープ', bondXp:99 },
];
const unlocked = ['Ark','Suezo','Mocchi','Mitarashi','Golem','Pixie','Tiger','Ham','Oboro'];
const valid = [...unlocked];
const roster = ['masu:target','Suezo','Mocchi','Mitarashi','Golem','Pixie','Tiger','Ham'];
const result = buildMasuDonation({ masuMons, targetId:'target', gold:50, monsterRosterIds:roster, draftMonsterRoster:roster, unlockedMonsterIds:unlocked, validBaseIds:valid, requiredCount:8 });
check('bondXp 1,250で1,250ダイヤ増える', result.ok && result.nextGold === 1300 && result.diamonds === 1250);
check('寄付対象だけが一覧から消える', result.ok && !result.nextMasuMons.some(m=>m.id==='target') && result.nextMasuMons.some(m=>m.id==='keep'));
check('編成中のmasu IDが残らない', result.ok && !result.nextRoster.includes('masu:target') && !result.nextDraftRoster.includes('masu:target'));
check('編成は8体かつ同種重複なし', result.ok && result.nextRoster.length===8 && new Set(result.nextRoster).size===8);
const missing = buildMasuDonation({ masuMons, targetId:'missing', gold:50, monsterRosterIds:roster, draftMonsterRoster:roster, unlockedMonsterIds:unlocked, validBaseIds:valid, requiredCount:8 });
check('存在しないIDではダイヤが増えない', !missing.ok && missing.nextGold === undefined);
const bulk = buildMasuDonations({ masuMons, targetIds:['keep','target','keep'], gold:50, monsterRosterIds:roster, draftMonsterRoster:roster, unlockedMonsterIds:unlocked, validBaseIds:valid, requiredCount:8 });
check('複数寄付は重複IDを除いて全対象を処理する', bulk.ok && bulk.donated.length===2 && bulk.nextMasuMons.length===0);
check('複数寄付の合計報酬を1回だけ加算する', bulk.ok && bulk.diamonds===1349 && bulk.nextGold===1399);
const atomicFailure = buildMasuDonations({ masuMons, targetIds:['keep','missing'], gold:50, monsterRosterIds:roster, draftMonsterRoster:roster, unlockedMonsterIds:unlocked, validBaseIds:valid, requiredCount:8 });
check('一括処理の途中で失敗したときは完成データを返さない', !atomicFailure.ok && atomicFailure.nextGold===undefined);
check('不正bondXpを0以上の整数へ正規化', [-1, NaN, Infinity, 'abc'].every(v=>donationDiamondValue(v)===0) && donationDiamondValue('12.9')===12);
check('保存キーと同期ロックが実装されている', /donationProcessingRef\.current/.test(source) && /storeSet\('mh_gold', result\.nextGold, false\)/.test(source) && /storeSet\('mh_monster_roster', result\.nextRoster, false\)/.test(source) && /storeSet\('mh_masu_mons', result\.nextMasuMons, false\)/.test(source));
check('複数選択・選択解除・最終確認を備える', /setDonationSelectedIds\(ids=>selected\?ids\.filter/.test(source) && /選択数：/.test(source) && /donationConfirmOpen/.test(source));
check('寄付一覧の総合力は共通関数を使う', /formatMonsterPower\(masuPowerOf\(masu\)\)/.test(source));
const powerSortedHigh = sortDonationMasuMons(masuMons, 'power', 'desc').map(m=>m.id);
const powerSortedLow = sortDonationMasuMons(masuMons, 'power', 'asc').map(m=>m.id);
check('総合力の高い順・低い順は表示と同じ共通計算値で並ぶ',
  powerSortedHigh[0] === (masuPowerOf(masuMons[0]) >= masuPowerOf(masuMons[1]) ? 'target' : 'keep')
  && powerSortedLow[0] === powerSortedHigh[1]);
check('ソート前後の選択は配列位置でなく個体IDを維持する',
  /new Set\(donationSelectedIds\.map\(String\)\)/.test(source)
  && /key=\{masu\.id\}/.test(source)
  && /targetIds:donationSelectedIds/.test(source));
check('総合力ソートは高い順・低い順を1ボタンで切り替える',
  /key:'power',label:'総合力'/.test(source) && /総合力を\$\{direction\}で表示中/.test(source));
check('一括寄付後に選択を消し、個体数ぶんミッションを進める', /setDonationSelectedIds\(\[\]\); setDonationConfirmOpen\(false\)/.test(source) && /saveMissionProgress\('donation', result\.donated\.length\)/.test(source));
check('寄付の3表示は通常の全身画像と共通染色を使う', (source.match(/src=\{masuDisplayImageUrl\(/g)||[]).length >= 2 && /src: masuDisplayImageUrl\(ALL_PLAYER_MONSTERS\[animationMasu\.baseId\]\)/.test(source));
// キャッシュキーには最低限この3つが要る(どれかが抜けると別のモンスター・別の色の画像を
// 使い回してしまう)。光沢保持の設定など、これ以外の条件が足されるのは構わない
check('染色キャッシュは種類・元画像・色をキーにする',
  /const cacheKey = baseId \+ .*\bimgUrl\b.*\bcolorId\b/.test(source));
check('寄付一覧と演出の画像サイズを抑えて全身を収める', /relative w-16 h-16 rounded-lg/.test(source) && /\.mh-donation-monster\{position:absolute;width:96px;height:96px/.test(source));
check('MASU_DONATIONは神殿BGM', /MASU_DONATION:\s*'temple'/.test(source));
check('寄付の戻り先は神殿', /resetDonationFlow\(\);setGameState\('TEMPLE'\)/.test(source));
check('一覧タイトルが統一されている', source.includes('>ベースモン一覧</h2>') && source.includes('>マスモン一覧</h2>'));
process.exit(failed ? 1 : 0);
