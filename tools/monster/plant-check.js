#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
const images = fs.readFileSync('monster-hero/data/images/images-ally.js', 'utf8');
const lineages = fs.readFileSync('monster-hero/data/lineages.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const changelog = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${images}\n${ally}\n${lineages}\nglobalThis.data={HERO_ATK_NAMES,ALL_PLAYER_MONSTERS,STARTER_MONSTER_IDS,MONSTER_LINEAGES,MONSTER_LINEAGE_MAP};`, ctx);

const { HERO_ATK_NAMES: attacks, ALL_PLAYER_MONSTERS: monsters, STARTER_MONSTER_IDS: starters,
  MONSTER_LINEAGES: lineagesById, MONSTER_LINEAGE_MAP: lineageMap } = ctx.data;
const plant = monsters.Plant;
const oboro = monsters.Oboro;
const checks = [
  ['Plantがプレイヤーモンスターに存在', plant?.id === 'Plant' && plant.name === 'プラント'],
  ['基礎能力', plant?.baseHp === 930 && plant.baseAtk === 100 && plant.baseDef === 65 && plant.baseGuts === 120],
  ['合流ボーナス', JSON.stringify(plant?.plusStats) === JSON.stringify({ hp:620, atk:10, def:0, guts:15 })],
  ['距離適性', JSON.stringify(plant?.distAptitude) === JSON.stringify(['C','D','F','A'])],
  ['通常技9種がOboroと共通', attacks.Plant?.length === 9 && JSON.stringify(attacks.Plant) === JSON.stringify(attacks.Oboro)],
  ['固有技9段階がOboroと共通', plant?.unique.names.length === 9 && JSON.stringify(plant.unique.names) === JSON.stringify(oboro.unique.names)],
  ['固有倍率・消費・ドレイン', plant?.unique.baseMult === 2 && plant.unique.baseGuts === 40 && plant.unique.effectDesc === oboro.unique.effectDesc],
  ['勇者特性「吸収」', plant?.trait === '吸収' && plant.traitDesc === oboro.traitDesc],
  ['Plantも吸収の実効果対象', game.includes("(mainHero?.id==='Oboro'||mainHero?.id==='Plant')&&Math.random()<0.3")],
  ['Plantもドレインの実効果対象', game.includes("card.monId==='Oboro'||card.monId==='Plant'")],
  ['本体画像を全用途で再利用', plant?.imgUrl === plant?.iconUrl && plant?.iconUrl === plant?.faceIconUrl && /plant\.PNG\?v=f2123e579d45/.test(plant.imgUrl)],
  ['Plantはプラント純血', lineageMap.Plant?.main === 'plant' && lineageMap.Plant?.sub === 'plant'],
  ['プラント血統の代表はPlant', lineagesById.plant?.monId === 'Plant'],
  ['Oboroの定義を維持', oboro?.baseHp === 900 && oboro.baseAtk === 90 && oboro.baseDef === 60 && oboro.baseGuts === 115 && lineageMap.Oboro?.main === 'plant' && lineageMap.Oboro?.sub === 'gel'],
  ['Plantは初期解放しない', !starters.includes('Plant')],
  ['Plant円盤石画像参照', /const PLANT_DISC_ICON = "images\/disc-icons\/plant-disc\.PNG\?v=e62804cf3a5c"/.test(breeder)],
  ['プラントの通常アイコンは1pt', /id:'plant_icon', name:"プラントのアイコン", type:'icon', icon:PLANT_IMG, cost:1/.test(breeder)],
  ['プラントの円盤石アイコンは1pt', /id:'plant_disc_icon', name:"プラントの円盤石アイコン", type:'icon', icon:PLANT_DISC_ICON, cost:1/.test(breeder)],
  ['プラントの円盤石は購入可能・1500ダイヤ', /id:'Plant', name:"プラントの円盤石", type:'disc', icon:PLANT_DISC_ICON, cost:1500/.test(breeder) && !/id:'Plant'[^\n]*available:false/.test(breeder)],
  ['円盤石購入は既存キーへ解放IDを保存', game.includes("if (item.type === 'disc')") && game.includes("storeSet('mh_unlocked_monsters', next, false)")],
  ['購入済み円盤石の二重購入を防止', game.includes("if (item.type === 'disc') return unlockedMonsterIds.includes(item.id);") && game.includes('if (isMarketItemOwned(item)) return;')],
  ['既存円盤石商品の価格を維持', [
    ['Zan',1500], ['Mitarashi',500], ['Ark',1500], ['Iblis',1500], ['Snegurochka',1500], ['Undine',1500], ['Yaobikuni',1500],
  ].every(([id,cost]) => new RegExp(`id:'${id}'[^\\n]*type:'disc'[^\\n]*cost:${cost}`).test(breeder))],
  ['Plant更新履歴は1件だけ', (changelog.match(/title: '新モンスター「プラント」を追加しました'/g) || []).length === 1],
  ['Plant助手告知IDは1件だけ', (changelog.match(/update_notice_plant_market_v1/g) || []).length === 1],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
