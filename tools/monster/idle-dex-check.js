#!/usr/bin/env node
'use strict';
// モンスター図鑑でも、バトルと同じ待機アニメ(MONSTER_IDLE_RIGS / MonsterIdleArt)が出るかを確かめる。
//
//   node tools/monster/idle-dex-check.js
//
// 【なぜ道具にするか】
// 待機アニメの正本は tools/monster/idle-rig-build.js が書く MONSTER_IDLE_RIGS で、そこへ1体足せば
// バトルでは動き出す。図鑑も同じ入口(withMonsterIdleArt)を通していないと、「バトルでは動くのに
// 図鑑では止まっている子」ができる。止まっていても画面はふつうに開くので、目では気づきにくい。
// また図鑑の軸は「正方形の枠」での % をそのまま使うので、正方形の箱に入れていないと部分が
// 付け根から外れて回る。ここではその入口と箱、止める設定の3つを見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const dex = read('monster-hero/src/parts/57-screen-monster-dex.jsx');
const dexArt = read('monster-hero/src/parts/20-market-notices-help.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (text, from, to) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 切り出せませんでした（${from}）`); process.exit(1); }
  return text.slice(i, j);
};

// --- 入口の関数をそのまま動かす(JSX を返す所は差し替える) ---
const ctx = { Object, Array, String };
vm.createContext(ctx);
vm.runInContext(read('monster-hero/data/images/images-ally.js'), ctx);
vm.runInContext(read('monster-hero/data/ally-monsters.js'), ctx);
vm.runInContext(slice(fx, 'const MONSTER_IDLE_RIGS =', '// ==== MONSTER_IDLE_RIGS ここまで'), ctx);
vm.runInContext(slice(fx, 'const monsterIdleRigOf =', 'const withMonsterIdleArt ='), ctx);
vm.runInContext(slice(fx, 'const MONSTER_IDLE_OFF_MOTIONS =', '\n', ) + '\n' + slice(fx, 'const monsterIdleAllowedDuring =', '\n'), ctx);
vm.runInContext('this.__d = { rigs: MONSTER_IDLE_RIGS, rigOf: monsterIdleRigOf, allowed: monsterIdleAllowedDuring, monsters: ALL_PLAYER_MONSTERS };', ctx);
const { rigs, rigOf, allowed, monsters } = ctx.__d;

const ids = Object.keys(monsters);
const missing = ids.filter(id => !rigOf(id));
check('図鑑に出る味方モンスターは全員、待機アニメの表に居る', missing.length === 0, missing.join('・') || `${ids.length}体`);
check('表に無い名前・空の名前では何も返さない(1枚の絵のまま)', rigOf('NoSuchMonster') === null && rigOf('') === null && rigOf('toString') === null);
check('ミーアは翼を動かす', !!rigs.Mia && rigs.Mia.parts.length >= 2);
// バトルで slotArt を通している演出と、通していない演出(パンドラの雷)を実際の本文から数え、図鑑の分け方と突き合わせる
const battleWrapped = ['arkHolyRain', 'waterBurst', 'miaSongNotes'].filter(m => new RegExp(`motion==='${m}'\\s*\\?<\\w+\\s+image=\\{slotArt\\(`).test(battle));
check('バトルは聖光・水・歌で待機アニメを重ねている', battleWrapped.length === 3, battleWrapped.join('・'));
check('図鑑の攻撃アクションも、待機中・通常の動き・聖光・水・歌では重ねる(バトルと同じ)',
  allowed(null) && allowed({ motion: 'default' }) && battleWrapped.every(m => allowed({ motion: m })));
check('パンドラの雷の最中は重ねない(バトルと同じ)',
  !allowed({ motion: 'pandoraDualThunder' }) && /motion==='pandoraDualThunder'\s*\?<PandoraDualThunder image=\{<DyedMonsterImage/.test(battle));

// --- バトルと図鑑が同じ部品を通す ---
check('バトルは MonsterIdleArt を使う', battle.includes('<MonsterIdleArt baseId={s?.id} image={img}/>'));
check('入口 withMonsterIdleArt は同じ MonsterIdleArt を返す', fx.includes('<MonsterIdleArt baseId={monsterId} image={image} fill={fill}/>'));
check('図鑑の詳細の立ち絵は待機アニメ版を使う', dex.includes('<DexMonsterIdleArt mon={mon} alt={mon.name}/>'));
check('図鑑の攻撃アクションも待機アニメを重ねる',
  dex.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, mon.name), {enabled:monsterIdleAllowedDuring(previewAnim), fill:true})'));
check('図鑑は絵の要素そのものを渡す(部品を複製しない)',
  dexArt.includes('const dexMonsterArtImage =') && dexArt.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, alt), {fill:true})'));
check('図鑑の立ち絵は正方形の箱に入れる(軸の % が正方形の枠での値のため)',
  /data-dex-idle-art className="[^"]*aspect-square/.test(dexArt));
check('図鑑の攻撃アクションの舞台も正方形', /data-attack-preview-art[^>]*width:'clamp\(132px, 44vw, 184px\)',height:'clamp\(132px, 44vw, 184px\)'/.test(dex));
check('大きさを持たない絵は入れ物いっぱいに広げる', css.includes('.mon-idle--fill, .mon-idle--fill > .mon-idle__body { width:100%; height:100%; }'));
check('軽量表示・「待機中の動き：止める」では図鑑でも止まる',
  css.includes('[data-phase-look="calm"] .mon-idle, [data-phase-look="calm"] .mon-idle__part { animation:none; }'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
