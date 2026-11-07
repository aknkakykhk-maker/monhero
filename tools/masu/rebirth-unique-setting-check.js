#!/usr/bin/env node
// 転生しても固有技設定(並び順 uniqueOrder・初期技 initialUniqueKey)が残る(2026-11-07。転生の組み直し resetMasuForRebirth に無く、
// 転生のたびに初期状態へ戻っていた)。1体の転生・まとめて転生・お布施の転生・複数体まとめて転生のすべてで見る。
//   あわせて: 設定していない個体には項目を足さない(保存の形を変えない)・固有技Lv・未使用固有技P・引き継ぎ技はこれまでどおり残る
// 使い方: node tools/masu/rebirth-unique-setting-check.js
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/parts/11-masu-progression.jsx'), 'utf8');
const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const sb = { console, BREEDER_MARKET_ITEMS: [], ALL_PLAYER_MONSTERS: { Test: { id: 'Test', distAptitude: ['C', 'C', 'C', 'C'], baseHp: 10, baseAtk: 10, baseDef: 10, baseGuts: 10, unique: { name: '技', baseMult: 2, baseGuts: 10, names } } } };
vm.createContext(sb);
vm.runInContext(src + '\nthis.__x={resetMasuForRebirth,buildMasuReincarnation,buildMasuReincarnationBatch,buildMasuReincarnationMulti,buildMasuOffering,totalBondXpForLevel,normalizeUniqueOrder,normalizeInitialUniqueKey};', sb);
const X = sb.__x;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const inh = { name: '継', baseMult: 2, baseGuts: 10, names, inheritedUniqueId: 'u1', lineageId: 'L2' };
const ORDER = ['inhId:u1', 'own'], INITIAL = 'inhId:u1';
const masu = (id = 'm1', o = {}) => ({ id, baseId: 'Test', name: 'テスト', bondXp: X.totalBondXpForLevel(250), levelCap: 250, rebirthCount: 44,
  distAptPoints: 0, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0], inheritedUniques: [inh],
  uniqueSkillLevels: { own: 8, 'inhId:u1': 8 }, uniqueSkillPoints: 5, uniqueOrder: [...ORDER], initialUniqueKey: INITIAL, ...o });
const kept = (m) => JSON.stringify(m && m.uniqueOrder) === JSON.stringify(ORDER) && m.initialUniqueKey === INITIAL;
const show = (m) => JSON.stringify({ order: m && m.uniqueOrder, initial: m && m.initialUniqueKey });

const r0 = X.resetMasuForRebirth(masu());
check('転生の組み直し(resetMasuForRebirth)で並び順・初期技が残る', kept(r0), show(r0));
check('固有技Lv・未使用固有技P・引き継ぎ技もこれまでどおり残る', r0.uniqueSkillLevels.own === 8 && r0.uniqueSkillLevels['inhId:u1'] === 8 && r0.uniqueSkillPoints === 5 && r0.inheritedUniques.length === 1);
const plain = masu('m2'); delete plain.uniqueOrder; delete plain.initialUniqueKey;
const r1 = X.resetMasuForRebirth(plain);
check('設定していない個体には項目を足さない(保存の形を変えない)', !('uniqueOrder' in r1) && !('initialUniqueKey' in r1));
const broken = X.resetMasuForRebirth(masu('m3', { uniqueOrder: ['own', 5, null], initialUniqueKey: 7 }));
check('壊れた値は文字だけ残す・初期技が文字でなければ足さない', JSON.stringify(broken.uniqueOrder) === '["own"]' && !('initialUniqueKey' in broken));
check('残した設定は読むときに今の技へ合わせられる(正規化を通る)', JSON.stringify(X.normalizeUniqueOrder(r0)) === JSON.stringify(ORDER) && X.normalizeInitialUniqueKey(r0) === INITIAL,
  `${JSON.stringify(X.normalizeUniqueOrder(r0))} ${X.normalizeInitialUniqueKey(r0)}`);

const one = X.buildMasuReincarnation({ masu: masu(), skillKey: '', gold: 1e9 });
check('1体の転生で残る', one.ok && kept(one.nextMasu), one.ok ? show(one.nextMasu) : one.reason);
const batch = X.buildMasuReincarnationBatch({ masu: masu(), skillKey: 'own', gold: 1e12, count: 3 });
const batchMasu = batch && (batch.nextMasu || batch.masu);
check('まとめて転生(3回)で残る', !!batchMasu && kept(batchMasu), batchMasu ? show(batchMasu) : JSON.stringify(Object.keys(batch || {})));
const offer = X.buildMasuOffering({ masu: masu(), gold: 1e12, ownedItems: {}, mode: 'reincarnate', amount: 3 });
const offerMasu = offer && (offer.nextMasu || offer.masu);
check('お布施の転生で残る', !!offerMasu && kept(offerMasu) && (offer.reincarnations || 0) > 0, offerMasu ? `${show(offerMasu)} 転生${offer.reincarnations}` : JSON.stringify(Object.keys(offer || {})));
const multi = X.buildMasuReincarnationMulti({ masuMons: [masu('a1'), masu('a2')], ids: ['a1', 'a2'], gold: 1e12, times: 2 });
const multiMons = multi && (multi.nextMasuMons || multi.masuMons || []);
check('複数体まとめて転生で、どの個体にも残る', Array.isArray(multiMons) && multiMons.length === 2 && multiMons.every(kept), JSON.stringify(multiMons.map((m) => show(m))));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
