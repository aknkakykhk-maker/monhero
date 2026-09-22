#!/usr/bin/env node
// 正式パンドラ・マーケット解放・禁忌解錠・双極共振・共通モーションを確かめる。
'use strict';
const fs=require('fs');
const assert=require('assert');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const ally=fs.readFileSync('monster-hero/data/ally-monsters.js','utf8');
const breeder=fs.readFileSync('monster-hero/data/breeder.js','utf8');
const lineage=fs.readFileSync('monster-hero/data/lineages.js','utf8');
const data=ally.slice(ally.indexOf("Pandora: { id:'Pandora'"),ally.indexOf('Monol:',ally.indexOf("Pandora: { id:'Pandora'")));
assert(data.includes('baseHp:360, baseGuts:135, baseAtk:180, baseDef:100'));
assert(data.includes('plusStats:{hp:130,atk:35,def:25,guts:40}'));
assert(data.includes("distAptitude:['B','B','B','B']"));
assert(data.includes('baseMult:2.3,baseGuts:52'));
assert(data.includes("atkMotion:'pandoraDualThunder'"));
assert.strictEqual((ally.match(/Pandora: \{ id:'Pandora'/g)||[]).length,1);
assert(!/STARTER_MONSTER_IDS[^;]*Pandora/.test(ally));
assert(breeder.includes("id:'pandora_icon'")&&breeder.includes("id:'pandora_disc_icon'")&&/id:'Pandora'.*cost:3000/.test(breeder));
assert(lineage.includes("Pandora:     { main:'pixie',  sub:'unknown' }"));
// タクティクスバトルは勇者特性を「その札を出した子自身」に効かせるため、
// mainHero を直に見ず attackHeroId(＝新モードでは札を出した子のid)を通す(2026-09-20)。
// 「引き継いだ固有技だけ1.5倍」という判定そのものは変えていない
// 2026-09-22: 持ち主の決め方を traitOwnerOf の1か所へまとめた
assert(source.includes("const traitOwnerOf = (mon) => (isTacticsMode(runMode) ? (mon?.id || null) : (mainHero?.id || null));"));
assert(source.includes("const attackHeroId = traitOwnerOf(mon);"));
// ★連撃へは「勇者モン(heroId)」と「持ち主(traitOwnerId)」の両方を渡す。
//   パンドラの禁忌解錠は**勇者モンにしたからこそ強い**設定なので heroId で見分ける
//   (2026-09-22 ユーザー判断。持ち主で見るのはザンの連斬だけ)
assert(source.includes("attackerId:mon?.id, heroId:mainHero?.id, traitOwnerId:traitOwnerOf(mon),"));
assert(source.includes("attackerId:stunMon?.id, heroId:mainHero?.id, traitOwnerId:traitOwnerOf(stunMon),"));
assert(source.includes("attackerId:activeMon.id, heroId:mainHero?.id, traitOwnerId:traitOwnerOf(activeMon),"));
assert(source.includes("attackHeroId==='Pandora' && card.type==='unique' && card.monId!=='Pandora'"));
// 禁忌解錠のヒット列は予測・実処理とも共通の正本 buildAttackHits(ATTACK_COMBO_RULES)が作る
assert(source.includes("const pandoraSplitNormal = heroId === 'Pandora' && attackerId === 'Pandora' && ['atk', 'range_atk'].includes(card.type);"));
assert(source.includes("if (pandoraSplitNormal) combo(ATTACK_COMBO_RULES.pandoraSplitNormal + comboDmgBonus, '連撃', true);") && source.includes('pandoraSplitNormal: 0.5,'));
assert(source.includes("if (heroId === 'Pandora' && attackerId === 'Pandora' && isUniqueOf('Pandora')) combo(ATTACK_COMBO_RULES.pandoraUnique + comboDmgBonus, '連撃', true);") && source.includes('pandoraUnique: 1.0,'));
assert(source.includes('attackerId:activeMon.id, heroId:mainHero?.id, traitOwnerId:traitOwnerOf(activeMon),')
  && source.includes('attackerId:mon?.id, heroId:mainHero?.id, traitOwnerId:traitOwnerOf(mon),'), '実処理と予測が同じ buildAttackHits を呼ぶ');
assert(source.includes("...(hit.noAnim?{noAnim:true}:{})"));
const splitNormal=(base,bonus=0)=>Math.floor(base*.5)+Math.floor(base*(.5+bonus)); assert.strictEqual(splitNormal(1000),1000); assert.strictEqual(splitNormal(1000,.03),1030);
const combo=(base,bonus=0)=>base+Math.floor(base*(1+bonus)); assert.strictEqual(combo(1000),2000); assert.strictEqual(combo(1000,.03),2030);
const inherited=(base,origin)=>Math.floor(base*(origin==='Pandora'?1:1.5)); assert.strictEqual(inherited(1000,'Zan'),1500); assert.strictEqual(inherited(1000,'Pandora'),1000);
const cost=(base,{zero=false,resonance=0}={})=>{let value=zero?0:base;if(value>0&&resonance>0)value=Math.floor(value*.5);return value;};
assert.strictEqual(cost(52,{resonance:2}),26); assert.strictEqual(cost(52,{zero:true,resonance:2}),0); let turns=2; assert.strictEqual(cost(52,{resonance:turns--}),26);assert.strictEqual(cost(52,{resonance:turns--}),26);assert.strictEqual(cost(52,{resonance:turns}),52);
assert(source.includes("setNextTurnBuff('pandoraResonanceTurns',2)")); assert(source.includes('if (resonanceRefresh==null && resonanceCarry>0)'));
// エイキ追加時に縦長立ち絵の一覧が伸びた。パンドラが引き続き対象に含まれていることだけを見る
assert(/MONSTER_ART_CONTAIN_IDS = Object\.freeze\(\[[^\]]*'Pandora'[^\]]*\]\)/.test(source));
assert(!source.includes('PANDORA_DEBUG'));
console.log('OK: 正式パンドラ・マーケット解放・禁忌解錠・双極共振・共通モーション');
