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
check('詳細のページに動かす・止めるのボタンが1つある', (dex.match(/data-dex-idle-toggle/g) || []).length === 1 && dex.includes("<DexSideLabel text={idleMotion?'⏸ 動きを止める':'▶ 動かす'}/>") && dex.includes('onClick={()=>{Audio_.se.tap();toggleIdleMotion();}}'));
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

// --- マスモンの染色で見る(2026-09-24 ユーザー指示「図鑑の表示でマスモンで染色してるカラーも見れるようにしたい」)
//     同日「マスモン選択式にしたら？」「この画面で染色も出来てどんな色か見れるようにする機能もあるといいね」で作り替えた ---
{
  const c2 = { Array, Map, String };
  vm.createContext(c2);
  vm.runInContext(slice(read('monster-hero/src/parts/11-masu-progression.jsx'), 'const getMasuColors =', '\n') + '\n'
    + slice(dex, 'const dexMasuListOf =', 'const DexColorSwatches =')
    + '\nthis.__l = dexMasuListOf; this.__s = dexSelectedColors; this.__n = dexColorLabel;', c2);
  const listOf = c2.__l, selected = c2.__s, label = c2.__n;
  const masus = [
    { id:'a', baseId:'Mia', name:'ミア1', colors:['red','blue'] },
    { id:'d', baseId:'Mia', name:'ミア4', colors:[] },
    { id:'b', baseId:'Mia', name:'ミア2', colors:['red','blue'] },
    { id:'c', baseId:'Mia', name:'ミア3', colors:['green'] },
    { id:'e', baseId:'Tiger', name:'トラ', colors:['gold'] },
    { id:'f', baseId:'Mia', name:'古い形', color:'pink' },
    null,
  ];
  const got = listOf(masus, 'Mia');
  check('一覧はその種のマスモンだけ。同じ色の子もまとめずに1体ずつ出し、色を付けた子を先に並べる',
    got.map(m => m.id).join(',') === 'a,b,c,f,d', got.map(m => m.id).join(','));
  check('壊れた一覧・空の一覧でも落ちない', listOf(null, 'Mia').length === 0 && listOf([], 'Mia').length === 0);
  check('選んだマスモンの色で見る。古い形(color 1つ)の色も拾う',
    selected(masus, 'Mia', { masuId:'c' })[0] === 'green' && selected(masus, 'Mia', { masuId:'f' })[0] === 'pink');
  check('居なくなった子・色の無い子・ほかの種の子を選んでいたら元の色に戻る',
    selected(masus, 'Mia', { masuId:'nope' }) === null && selected(masus, 'Mia', { masuId:'d' }) === null
    && selected(masus, 'Mia', { masuId:'e' }) === null && selected(masus, 'Mia', null) === null && selected(masus, 'Mia', 'green') === null);
  check('「染めてみる」で決めた色で見る(色が1つも無ければ元の色)',
    selected(masus, 'Mia', { colors:['gold', null] })[0] === 'gold' && selected(masus, 'Mia', { colors:[null] }) === null);
  check('ボタンの名前は 元の色 / マスモンの名前 / 染めてみた色',
    label(masus, 'Mia', null) === '元の色' && label(masus, 'Mia', { masuId:'a' }) === 'ミア1' && label(masus, 'Mia', { colors:['red'] }) === '染めてみた色');
  const app = read('monster-hero/src/parts/60-app.jsx');
  check('配色は保存しない(図鑑を開くとき・前後へ移るときに元の色へ戻し、染めてみる途中の色も捨てる)',
    !/storeSet\([^)]*dex(Color|TryDye)/.test(dex + app)
    && app.includes("setDexTab('basic');setDexColorKey(null);setDexTryDyeDraft(null);setGameState('MONSTER_DEX_DETAIL')")
    && app.includes("onSelectMonster={(monId)=>{setDexMonsterId(monId);setDexTab('basic');setDexColorKey(null);setDexTryDyeDraft(null);}}"));
  check('詳細に色のボタンと「染めてみる」があり、マスモンの一覧と染めてみる画面を開ける',
    dex.includes('<DexColorPickButton masuMons={masuMons} mon={mon} value={dexColorKey}') && dex.includes('data-dex-color-try') && dex.includes('<DexMasuColorSheet ') && dex.includes('<DexTryDyeSheet '));
  check('「染めてみる」は本番の染色と同じ色の選び方を使い、染色アイテムを使わない',
    slice(dex, 'const DexTryDyeSheet =', 'function MonsterAttackPreviewScreen').includes('<DyeRegionColorControls baseId={mon.id} colors={draft} onChange={onChange} onCustom={onCustom}/>')
    && !/useDyeItem/.test(slice(dex, 'const DexTryDyeSheet =', 'function MonsterAttackPreviewScreen')));
  check('カスタムカラーは図鑑の下書きへ戻す(マスモンの色には書き込まない)',
    app.includes("mode==='dex'?setDexTryDyeDraft:") && app.includes("mode==='dex'?(dexTryDyeDraft||[]):"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
