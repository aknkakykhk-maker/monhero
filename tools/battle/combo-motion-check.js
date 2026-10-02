#!/usr/bin/env node
// 連撃のある攻撃(ザン・エイキ・剣士モッチー)が、動きを「1回だけ」流しているかを見る。
//
// 実際にあった不具合: 全体連撃・二刀流・EXの連撃(数字だけを出すヒット=noAnim)が、
// 連撃のまとめに入ってしまい、連撃のあとにもう一度ただの残像ダッシュ(技の動きを無視した通常モーション)が流れた。
// processTurn のヒット処理ループを切り出し、本物の buildAttackHits が作るヒット列で動かして、
// 動きの出た回数を数える。
const fs = require('fs');
const vm = require('vm');
const babel = require('@babel/core');
const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
let failed = 0;
const check = (label, ok, note='') => { if(!ok) failed++; console.log(`${ok?'OK':'NG'}: ${label}${note?` — ${note}`:''}`); };

const LOOP_HEAD = '        while (hitIdx < attackHits.length) {';
const LOOP_TAIL = '          hitIdx++;\n        }';
const s = src.indexOf(LOOP_HEAD), e = s >= 0 ? src.indexOf(LOOP_TAIL, s) : -1;
if (s < 0 || e <= s) { console.log('NG: ヒット処理ループを切り出せません'); process.exit(1); }
const battleLoop = src.slice(s, e) + LOOP_TAIL;

const ctx = { WATER_BURST_MOTION_MS:680, ARK_HOLY_RAIN_MOTION_MS:900, MIA_SONG_NOTES_MOTION_MS:760 };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('monster-hero/data/images/images-ally.js', 'utf8') + '\n' + ally, ctx);
vm.runInContext(src.slice(src.indexOf('const SKFX_RING ='), src.indexOf('const SkillFxMotion =')), ctx);
vm.runInContext(src.slice(src.indexOf('const DEFAULT_ATTACK_THEMES ='), src.indexOf('const rpgMotionName ='))
  + '\nglobalThis.__p={skillAttackThemeOf,themedAttackMotionMs};', ctx);
const bs = src.indexOf('const ATTACK_COMBO_RULES ='), be = src.indexOf('// 贖罪の追撃(アーク・イブリース');
vm.runInContext(src.slice(bs, be) + '\nglobalThis.__b=buildAttackHits;', ctx);
const { skillAttackThemeOf, themedAttackMotionMs } = ctx.__p;
const APM = vm.runInContext('ALL_PLAYER_MONSTERS', ctx);

const run = async (monId, isUnique, opts) => {
  const mon = APM[monId];
  const card = { type: isUnique ? 'unique' : 'atk', monId, name: isUnique ? mon.unique.names[1] : 'こうげき', crit: 0 };
  const hits = ctx.__b({ d:1000, card, attackerId:monId, heroId:monId, ...opts });
  const attackHits = [{ dmg:hits[0].dmg, isCrit:false, slotIdx:0, isSpecial:isUnique, skillName:card.name, isUnique, monId:isUnique?monId:undefined }];
  const themeOf = { skillName:card.name, isUnique, monId:isUnique?monId:undefined };
  for (const h of hits.slice(1)) attackHits.push({ dmg:h.dmg, isCrit:false, slotIdx:0, isSpecial:true, skillName:h.skillName, isUnique:false, themeOf, ...(h.noAnim?{noAnim:true}:{}) });
  const anims = [];
  const env = {
    ALL_PLAYER_MONSTERS: APM,
    slots: [{ id:monId, atkMotion:mon.atkMotion, name:'テスト', imgUrl:'x' }, null, null, null],
    fallbackSlot: 0, hitIdx: 0, attackHits, totalDmg: 0, multiHit: false,
    setAttackAnim: (a) => { if (a && !a.charge) anims.push({ ...a }); },
    setSlotSkill: ()=>{}, setEnemy: ()=>{}, setEnemyDist: ()=>{}, syncAtkTierForDist: ()=>{},
    addPopup: ()=>{}, triggerShake: ()=>{}, battleWait: async()=>{},
    pushBattleLog: ()=>{}, battleActorName: ()=>'テスト',
    Audio_: { se: new Proxy({}, { get: () => () => {} }) },
    RANGE_LABELS: ['零','近','中','遠'],
    WATER_BURST_MOTION_MS:680, ARK_HOLY_RAIN_MOTION_MS:900, MIA_SONG_NOTES_MOTION_MS:760,
    themedAttackMotionMs, skillAttackThemeOf, specialMoveImpact: ()=>{},
  };
  vm.createContext(env);
  vm.runInContext(babel.transformSync(`(async()=>{\n${battleLoop}\n})().then(()=>{globalThis.__done=true;},e=>{globalThis.__err=e;});`).code, env);
  await new Promise(r => setImmediate(r));
  if (env.__err) throw env.__err;
  return { anims, hitCount: attackHits.length };
};

(async () => {
  const extras = [
    ['連撃のみ', {}],
    ['全体連撃つき', { globalComboRate: 0.1 }],
    ['二刀流の繰り返しつき', { hitRepeat: 2 }],
    ['EXの連撃つき', { exCombos: { count: 4, rate: 0.3, label: 'スイーツパラダイス' } }],
    ['3つとも', { globalComboRate: 0.1, hitRepeat: 2, exCombos: { count: 4, rate: 0.3, label: 'スイーツパラダイス' }, kenshiExtraCombos: 2 }],
  ];
  for (const monId of ['Zan', 'Eiki', 'KenshiMocchi']) {
    for (const isUnique of [false, true]) {
      for (const [label, opts] of extras) {
        const { anims, hitCount } = await run(monId, isUnique, opts);
        check(`${monId} ${isUnique?'固有技':'通常'} ${label}: 動きは1回だけ(ヒット${hitCount}本)`, anims.length === 1, `${anims.length}回`);
      }
    }
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\n問題なし');
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
