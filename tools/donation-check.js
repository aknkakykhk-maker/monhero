// 神殿の寄付計算・編成補正・保存経路を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const sourcePath = path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const context = { React: { createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} } };
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.__donation = { donationDiamondValue, buildMasuDonation };`, context);
const { donationDiamondValue, buildMasuDonation } = context.__donation;
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
check('不正bondXpを0以上の整数へ正規化', [-1, NaN, Infinity, 'abc'].every(v=>donationDiamondValue(v)===0) && donationDiamondValue('12.9')===12);
check('保存キーと同期ロックが実装されている', /donationProcessingRef\.current/.test(source) && /storeSet\('mh_gold', result\.nextGold, false\)/.test(source) && /storeSet\('mh_monster_roster', result\.nextRoster, false\)/.test(source) && /storeSet\('mh_masu_mons', result\.nextMasuMons, false\)/.test(source));
check('MASU_DONATIONはfusion BGM', /MASU_DONATION:\s*'fusion'/.test(source));
check('寄付の戻り先は神殿', /resetDonationFlow\(\);setGameState\('TEMPLE'\)/.test(source));
check('一覧タイトルが統一されている', source.includes('>ベースモン一覧</h2>') && source.includes('>マスモン一覧</h2>'));
process.exit(failed ? 1 : 0);
