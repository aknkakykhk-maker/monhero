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
// 付け根から外れて回る。ここではその入口と箱、動かす・止めるのボタンを見る。
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
check('入口 withMonsterIdleArt は同じ MonsterIdleArt を返す', fx.includes('<MonsterIdleArt baseId={monsterId} image={image} fill={fill} own={own}/>'));
check('図鑑の詳細の立ち絵は待機アニメ版を使い、ページのボタンの値で動かす', dex.includes('<DexMonsterIdleArt mon={mon} alt={mon.name} motion={idleMotion} colors={dexSelectedColors(masuMons, mon.id, dexColorKey)}/>'));
check('詳細のページに動かす・止めるのボタンが1つある', (dex.match(/data-dex-idle-toggle/g) || []).length === 1 && dex.includes("{idleMotion?'⏸ 動きを止める':'▶ 動かす'}") && dex.includes('onClick={()=>{Audio_.se.tap();toggleIdleMotion();}}'));
check('最初は動く・新しい保存キーに true/false で残す', dex.includes("const DEX_IDLE_MOTION_KEY = 'mh_dex_idle_motion_v1';") && dex.includes('useState(true)') && dex.includes('storeGet(DEX_IDLE_MOTION_KEY, true).then(v => { if (alive) setMotion(v !== false); });') && dex.includes('storeSet(DEX_IDLE_MOTION_KEY, next)'));
check('保存キーを保存データの資料に載せた', fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8').includes('`mh_dex_idle_motion_v1`'));
check('詳細も攻撃アクションもフックは早い return より前で呼ぶ', (dex.match(/const \[idleMotion(,toggleIdleMotion)?\]=useDexIdleMotion\(\);\n      const monsters=dexMonsterList\(\);/g) || []).length === 2);
check('図鑑の攻撃アクションも待機アニメを重ねる',
  dex.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, mon.name, false, dexSelectedColors(masuMons, mon.id, dexColorKey)), {enabled:idleMotion&&monsterIdleAllowedDuring(previewAnim), fill:true, own:true})'));
check('図鑑は絵の要素そのものを渡す(部品を複製しない)',
  dexArt.includes('const dexMonsterArtImage =') && dexArt.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, alt, false, colors), {fill:true, own:true})') && dexArt.includes('(motion && mon.imgUrl && monsterIdleRigOf(mon.id))'));
check('図鑑の立ち絵は正方形の箱に入れる(軸の % が正方形の枠での値のため)',
  /data-dex-idle-art className="[^"]*aspect-square/.test(dexArt));
check('図鑑の攻撃アクションの舞台も正方形', /data-attack-preview-art[^>]*width:'clamp\(132px, 44vw, 184px\)',height:'clamp\(132px, 44vw, 184px\)'/.test(dex));
check('大きさを持たない絵は入れ物いっぱいに広げる', css.includes('.mon-idle--fill, .mon-idle--fill > .mon-idle__body { width:100%; height:100%; }'));
// 図鑑はページのボタンだけで決める(ユーザー指示)。バトルの設定・軽量表示・「動きを減らす」の止める規則は図鑑(data-idle-own)に効かない
const stopRules = css.split('\n').filter(l => /\.mon-idle[^{]*\{\s*animation:none;\s*\}/.test(l));
check('止める規則は3つあり、どれも図鑑(data-idle-own)を外している', stopRules.length === 3 && stopRules.every(l => l.split(',').every(sel => sel.includes(':not([data-idle-own])'))), `${stopRules.length}本`);
check('バトルは own を付けない(今までどおり設定で止まる)', !/<MonsterIdleArt baseId=\{s\?\.id\}[^>]*own/.test(battle));
check('入口は own を data-idle-own として付ける', fx.includes("const ownAttr = own ? 'true' : undefined;") && (fx.match(/data-idle-own=\{ownAttr\}/g) || []).length === 2);

// --- マスモンの染色で見る(2026-09-24 ユーザー指示「図鑑の表示でマスモンで染色してるカラーも見れるようにしたい」) ---
{
  const c2 = { Array, Map, String };
  vm.createContext(c2);
  vm.runInContext(slice(read('monster-hero/src/parts/11-masu-progression.jsx'), 'const getMasuColors =', '\n') + '\n'
    + slice(dex, 'const dexMasuColorChoices =', 'const DexMasuColorPicker =')
    + '\nthis.__c = dexMasuColorChoices; this.__s = dexSelectedColors;', c2);
  const choices = c2.__c, selected = c2.__s;
  const masus = [
    { id:'a', baseId:'Mia', name:'ミア1', colors:['red','blue'] },
    { id:'b', baseId:'Mia', name:'ミア2', colors:['red','blue'] },
    { id:'c', baseId:'Mia', name:'ミア3', colors:['green'] },
    { id:'d', baseId:'Mia', name:'ミア4', colors:[] },
    { id:'e', baseId:'Tiger', name:'トラ', colors:['gold'] },
    { id:'f', baseId:'Mia', name:'古い形', color:'pink' },
    null,
  ];
  const got = choices(masus, 'Mia');
  check('その種で色を付けたマスモンだけを候補にし、同じ配色は1つにまとめる',
    got.length === 3 && got[0].names.length === 2 && got.every(g => g.colors.length > 0), JSON.stringify(got.map(g => g.key)));
  check('古い形(color 1つ)のマスモンの色も拾う', got.some(g => g.key === 'pink'));
  check('壊れた一覧・空の一覧でも落ちない', choices(null, 'Mia').length === 0 && choices([], 'Mia').length === 0);
  check('選んだ配色が無くなっていたら元の色に戻る', selected(masus, 'Mia', 'green')[0] === 'green' && selected(masus, 'Mia', 'nope') === null && selected(masus, 'Mia', null) === null);
  check('配色は保存しない(図鑑を開くとき・前後へ移るときに元の色へ戻す)',
    !/storeSet\([^)]*dexColor/.test(dex) && (app => app.includes("setDexTab('basic');setDexColorKey(null);setGameState('MONSTER_DEX_DETAIL')") && app.includes("onSelectMonster={(monId)=>{setDexMonsterId(monId);setDexTab('basic');setDexColorKey(null);}}"))(read('monster-hero/src/parts/60-app.jsx')));
  check('詳細に色を選ぶ行があり、色を付けた子が居るときだけ出る',
    dex.includes('<DexMasuColorPicker choices={dexMasuColorChoices(masuMons, mon.id)}') && dex.includes('if (!choices.length) return null;') && dex.includes("chip(null, '元の色', null)"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
