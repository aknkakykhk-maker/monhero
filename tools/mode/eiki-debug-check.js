// 新レア「エイキ」の正式実装前確認。
//
//   node tools/mode/eiki-debug-check.js
//
// 【この段階の位置づけ】
// エイキはまだ正式実装していない。debugOnly:true を付けて、
//   ・通常ロースター(解放していないので出ない)
//   ・図鑑(dexMonsterList が debugOnly を外す)
//   ・種族チャレンジの種族一覧・メンバー(同じく dexMonsterList 経由)
//   ・マーケット(円盤石をまだ商品化していない)
//   ・更新履歴・ヘルプ
// のどこにも出ないまま、デバッグ戦の勇者モン選択からだけ選んで確かめられる状態にしてある。
// ここでは「仕様どおりの数値になっているか」と「まだ表へ出ていないか」の両方を機械的に見る。
//
// 連撃の実測は、実装から rollCombo と同じ式を切り出して動かすのではなく、
// game-system.jsx の該当行そのものを読み、倍率と回数を数えている
// (式を検査側へ写すと、本体を変えたときに検査だけが古くなるため)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(ROOT, 'monster-hero/game-system.compiled.js'), 'utf8');
const allySrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/ally-monsters.js'), 'utf8');
const lineageSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/lineages.js'), 'utf8');
const imagesSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8');
const breederSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/breeder.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
const helpSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- データを実際に読み込む ---
const ctx = { console };
vm.createContext(ctx);
vm.runInContext([imagesSrc, allySrc, lineageSrc,
  'globalThis.__x={ALL_PLAYER_MONSTERS,HERO_ATK_NAMES,MONSTER_LINEAGE_MAP,MONSTER_LINEAGES,MONSTER_DEX_DESCRIPTIONS};'].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS, HERO_ATK_NAMES, MONSTER_LINEAGE_MAP, MONSTER_LINEAGES, MONSTER_DEX_DESCRIPTIONS } = ctx.__x;
const eiki = ALL_PLAYER_MONSTERS.Eiki;

console.log('--- ① 定義と基礎データ ---');
check('エイキが定義されている', !!eiki);
if (!eiki) { console.log('\n定義が無いため以降を中止'); process.exit(1); }
check('内部IDが Eiki', eiki.id === 'Eiki');
check('名前が エイキ', eiki.name === 'エイキ');
check('emojiが 🌸', eiki.emoji === '🌸');
check('基礎能力 ライフ400/ちから165/丈夫さ20/ガッツ135',
  eiki.baseHp === 400 && eiki.baseAtk === 165 && eiki.baseDef === 20 && eiki.baseGuts === 135,
  `HP${eiki.baseHp}/ATK${eiki.baseAtk}/DEF${eiki.baseDef}/GUTS${eiki.baseGuts}`);
check('供モン加入値 +150/+50/+20/+45',
  eiki.plusStats.hp === 150 && eiki.plusStats.atk === 50 && eiki.plusStats.def === 20 && eiki.plusStats.guts === 45,
  JSON.stringify(eiki.plusStats));
check('距離適性 零A/近A/中C/遠C',
  JSON.stringify(eiki.distAptitude) === JSON.stringify(['A', 'A', 'C', 'C']), eiki.distAptitude.join('/'));

console.log('--- ② 技 ---');
const NORMALS = ['桜牙', '花裂き', '桜風刃', '花霞斬', '桜月輪', '桜嵐刃', '千花連刃', '桜閃爪', '桜華絶閃爪'];
const UNIQUES = ['華影緋閃', '氷花一閃', '桜月斬華', '緋雪乱刃', '花氷双牙', '千華氷嵐', '緋桜六華閃', '絶影桜華乱舞', '絶華緋閃・零桜'];
check('通常技が9段階そろっている', (HERO_ATK_NAMES.Eiki || []).length === 9, `${(HERO_ATK_NAMES.Eiki || []).length}段階`);
check('通常技の名称が指定どおり', JSON.stringify(HERO_ATK_NAMES.Eiki) === JSON.stringify(NORMALS));
check('固有技が9段階そろっている', (eiki.unique?.names || []).length === 9, `${(eiki.unique?.names || []).length}段階`);
check('固有技の名称が指定どおり', JSON.stringify(eiki.unique.names) === JSON.stringify(UNIQUES));
check('固有技名は1段階目と同じ', eiki.unique.name === UNIQUES[0]);
check('固有倍率が2.8', eiki.unique.baseMult === 2.8, String(eiki.unique.baseMult));
check('消費ガッツが56', eiki.unique.baseGuts === 56, String(eiki.unique.baseGuts));
check('固有技の出自がエイキ', eiki.unique.monId === 'Eiki');
// 「既存の倍率2.8技と同じ消費基準」= 倍率2.8の技はどれも消費56
const sameMult = Object.values(ALL_PLAYER_MONSTERS).filter(m => m.unique?.baseMult === 2.8);
check('倍率2.8の技はすべて消費ガッツ56で揃っている',
  sameMult.every(m => m.unique.baseGuts === 56), sameMult.map(m => `${m.name}:${m.unique.baseGuts}`).join(' / '));

console.log('--- ③ 血統・区分・図鑑説明 ---');
check('血統が ザン × ？？？', MONSTER_LINEAGE_MAP.Eiki?.main === 'zan' && MONSTER_LINEAGE_MAP.Eiki?.sub === 'unknown',
  `${MONSTER_LINEAGE_MAP.Eiki?.main} × ${MONSTER_LINEAGE_MAP.Eiki?.sub}`);
check('副血統がレア扱いなので区分はレアになる', MONSTER_LINEAGES[MONSTER_LINEAGE_MAP.Eiki.sub]?.rare === true);
check('図鑑説明が入っている', typeof MONSTER_DEX_DESCRIPTIONS.Eiki === 'string' && MONSTER_DEX_DESCRIPTIONS.Eiki.length > 40);
check('図鑑説明が指定文のまま',
  MONSTER_DEX_DESCRIPTIONS.Eiki === 'ザンの純血を色濃く継ぎ、一つの体に桜と氷、相反する二つの力を宿す。人の目では追えない速さで舞い、花吹雪とともに敵を斬る。意外にも穏やかで、争いより美しいものを愛でる性質がある。');

console.log('--- ④ まだ表へ出ていないこと(正式実装前) ---');
check('debugOnly が立っている', eiki.debugOnly === true);
check('図鑑一覧(dexMonsterList)が debugOnly を外している',
  /const dexMonsterList = \(\) => \(typeof ALL_PLAYER_MONSTERS !== 'undefined' \? Object\.values\(ALL_PLAYER_MONSTERS\)\.filter\(mon => mon && !mon\.debugOnly\) : \[\]\);/.test(source));
// 円盤石の画像だけは breeder.js へ定数(EIKI_DISC_ICON)として先に置いてある。
// 見るべきは「商品の並び(BREEDER_MARKET_ITEMS)へ入っていないか」なので、そこだけを取り出して確かめる
const marketStart = breederSrc.indexOf('const BREEDER_MARKET_ITEMS = [');
const marketSrc = marketStart >= 0 ? breederSrc.slice(marketStart) : '';
check('マーケットの商品一覧を取り出せる', marketStart >= 0);
check('マーケットへ商品として登録していない', !/Eiki|eiki/i.test(marketSrc));
check('円盤石の画像だけは先に置いてある(商品ではない)', breederSrc.includes('EIKI_DISC_ICON'));
check('更新履歴へ書いていない', !changelogSrc.includes('エイキ'));
check('ヘルプへ書いていない', !helpSrc.includes('エイキ'));
check('はじめから解放されるモンスターに入れていない', !/STARTER_MONSTER_IDS[^\n]*Eiki/.test(source));
check('デバッグ戦の勇者モン選択にだけ並べる',
  source.includes("const debugOnlyMonsterList = () => Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon?.debugOnly);")
  && /const debugHeroMonsterList = \(list\) => \{\s*\n\s*if \(!debugBattleRef\.current\) return list;/.test(source));
check('起動時の画像先読みからも外している',
  source.includes("imageUrlsFor(allIds.filter(id => !ALL_PLAYER_MONSTERS[id]?.debugOnly))"));
// debugOnly はマスモン登録も止める(セーブデータへ入らない)。既存の作りをそのまま使う
check('マスモン登録の対象外(セーブデータへ入らない)',
  source.includes('if (debugBattle || mainHero?.debugOnly) return null;')
  && source.includes('if (!mainHero || mainHero.masuId || mainHero.debugOnly || debugBattleRef.current) return null;'));

console.log('--- ⑤ 勇者特性「桜花連舞」と固有効果「緋桜連華」---');
check('特性名が 桜花連舞', eiki.trait === '桜花連舞');
check('固有効果の説明に 緋桜連華 がある', /緋桜連華/.test(eiki.unique.effectDesc));
// 実装の該当行をそのまま読み、倍率と回数を数える
const comboBlockStart = source.indexOf("// 勇者特性「桜花連舞」");
const comboBlockEnd = source.indexOf('// 禁忌解錠の通常攻撃', comboBlockStart);
const comboBlock = comboBlockStart >= 0 ? source.slice(comboBlockStart, comboBlockEnd) : '';
check('桜花連舞・緋桜連華の連撃が実装されている', comboBlock.length > 0);
const heroPart = comboBlock.slice(comboBlock.indexOf("mainHero?.id==='Eiki' && activeMon.id==='Eiki'"), comboBlock.indexOf('// 固有効果「緋桜連華」の連撃'));
const uniquePart = comboBlock.slice(comboBlock.indexOf('// 固有効果「緋桜連華」の連撃'));
const countRolls = (text, rate) => (text.match(new RegExp(`rollCombo\\(${rate}\\+comboDmgBonus\\)`, 'g')) || []).length;
check('桜花連舞: 通常も固有も 10%の連撃×2', countRolls(heroPart, '0\\.1') === 2, `${countRolls(heroPart, '0\\.1')}回`);
check('桜花連舞: 自身の固有技のときだけ 30%を追加',
  countRolls(heroPart, '0\\.3') === 1 && /if \(card\.type==='unique' && card\.monId==='Eiki'\) rollCombo\(0\.3\+comboDmgBonus\);/.test(heroPart));
check('桜花連舞はエイキが勇者モンのときだけ発動',
  /if \(mainHero\?\.id==='Eiki' && activeMon\.id==='Eiki'\) \{/.test(comboBlock));
check('緋桜連華: 固有技命中時に 15%の連撃×2', countRolls(uniquePart, '0\\.15') === 2, `${countRolls(uniquePart, '0\\.15')}回`);
check('緋桜連華は技の出自で判定(引き継いでも出る)',
  /if \(card\.type==='unique' && card\.monId==='Eiki'\) \{/.test(uniquePart));
check('連撃はザンと同じ rollCombo を使う(独自計算を増やしていない)',
  !/const eikiCombo|eikiRollCombo|function eikiCombo/.test(source));

console.log('--- ⑥ 固有技を使うたびのスタック(+3%) ---');
check('連撃ダメージ+3%と攻撃力+3%を同時に積む',
  source.includes("else if(card.monId==='Eiki'){addPermaBuff('comboDmgPct',0.03*effMul); addPermaBuff('atkPct',0.03*effMul);"));
check('ザンの連斬と同じ comboDmgPct へ積む(別系統を作っていない)',
  source.includes("else if(card.monId==='Zan'){addPermaBuff('comboDmgPct',0.03*effMul);"));
check('攻撃力はゴーレムの闘志と同じ atkPct へ積む', source.includes("addPermaBuff('atkPct'"));
// addPermaBuff は state 経由なので、そのターンの getPermaBuff には乗らない = 次のターンから
check('その場の計算(localOryoAdd)へは足していない=次のターンから効く',
  !/card\.monId==='Eiki'[^\n]*localOryoAdd/.test(source));
check('永続・重複は addPermaBuff の加算でそのまま成立',
  source.includes("const addPermaBuff = (key, delta) => writePermaBuffs(p => ({ ...p, [key]: (p[key] || 0) + delta }));"));

console.log('--- ⑦ 攻撃モーション ---');
check('専用モーション種別が eikiSakuraCombo', eiki.atkMotion === 'eikiSakuraCombo');
check('ザン本体のモーション種別は変えていない', ALL_PLAYER_MONSTERS.Zan.atkMotion === 'zanCombo');
check('ザンと同じ高速斬撃の動きを共有する',
  source.includes("const isComboDashMotion = hitMotion==='zanCombo' || hitMotion==='eikiSakuraCombo';"));
check('RPG表示のモーションもザンと同じDash', /eikiSakuraCombo:'Dash'/.test(source));
check('花びらは攻撃中だけ描く(常時アニメーションにしない)',
  source.includes('{isAnimating&&attackAnim.sakura&&<EikiSakuraPetals/>}')
  && source.includes("sakura: hitMotion==='eikiSakuraCombo'"));
check('花びらはエイキのときだけ立つ(ザンでは立たない)',
  !/zanCombo:true, sakura: *true/.test(source));
// スマホ負荷: 花びらは固定枚数・CSSアニメーション1本・transform/opacityのみ
const petals = (source.match(/EIKI_SAKURA_PETALS = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || '';
const petalCount = (petals.match(/\{ left:/g) || []).length;
check('花びらの枚数が固定で控えめ(8枚以下)', petalCount > 0 && petalCount <= 8, `${petalCount}枚`);
check('花びらはtransformとopacityだけを動かす(レイアウトを作り直さない)',
  /@keyframes eikiSakuraFall \{[\s\S]*?\}/.test(source)
  && !/@keyframes eikiSakuraFall \{[\s\S]*?(width|height|top:|left:)\s*[0-9]/.test(source.slice(source.indexOf('@keyframes eikiSakuraFall'), source.indexOf('@keyframes eikiSakuraFall') + 400)));
check('動きを減らす設定の端末では流さない', source.includes('@media (prefers-reduced-motion: reduce)') && source.includes('eikiSakuraFade'));

console.log('--- ⑧ 画像・染色・円盤石 ---');
const imgFile = (rel) => path.join(ROOT, 'monster-hero', rel);
const sizeOf = (rel) => { const b = fs.readFileSync(imgFile(rel)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: Math.round(b.length / 1024) }; };
for (const [label, rel] of [['立ち絵', 'images/monsters/eiki.png'], ['染色マスク', 'images/monsters/eiki-dye-mask.PNG'],
  ['顔アイコン', 'images/monster-icons/face/eiki.png'], ['円盤石', 'images/disc-icons/eiki-disc.PNG']]) {
  const exists = fs.existsSync(imgFile(rel));
  check(`${label}が置いてある (${rel})`, exists, exists ? `${sizeOf(rel).w}x${sizeOf(rel).h} ${sizeOf(rel).kb}KB` : '');
}
const art = sizeOf('images/monsters/eiki.png'), mask = sizeOf('images/monsters/eiki-dye-mask.PNG');
check('染色マスクが立ち絵と同じ大きさ', art.w === mask.w && art.h === mask.h, `${art.w}x${art.h} / ${mask.w}x${mask.h}`);
check('顔アイコンが256x256', sizeOf('images/monster-icons/face/eiki.png').w === 256 && sizeOf('images/monster-icons/face/eiki.png').h === 256);
check('顔アイコンはザンと同じ大きさ', sizeOf('images/monster-icons/face/zan.png').w === sizeOf('images/monster-icons/face/eiki.png').w);
check('立ち絵・全身アイコン・顔アイコンを宣言している',
  /const EIKI_IMG = "images\/monsters\/eiki\.png\?v=/.test(imagesSrc)
  && /const EIKI_ICON = EIKI_IMG;/.test(imagesSrc)
  && /const EIKI_FACE_ICON = "images\/monster-icons\/face\/eiki\.png\?v=/.test(imagesSrc));
check('承認済みマスクの原本を art-sources へ残している',
  fs.existsSync(path.join(ROOT, 'tools/art-sources/dye-masks/eiki-dye-mask.PNG')));
check('染色は実マスク(EXACT_DYE_MASKS)を正本にする', /EXACT_DYE_MASKS = Object\.freeze\(\{[^}]*Eiki:EIKI_DYE_MASK/.test(source));
check('染色は3領域', /Eiki: \[\s*\n\s*\{ hue: 0,[\s\S]{0,200}?\{ hue: 240,/.test(source));
check('配信用JSにも反映されている(ビルド済み)',
  compiled.includes("id: 'Eiki'") && compiled.includes('eikiSakuraCombo') && compiled.includes('EIKI_DYE_MASK') === false ? compiled.includes('eiki-dye-mask') : compiled.includes('eikiSakuraCombo'));

// 円盤石は「共通の土台(DISC_STONE_BASE)の上へキャラを重ねる」決まりなので、
// 土台そのものを別デザインへ描き直していないかを実測する。
// 円盤の外接矩形で正規化してから外周のリングだけを比べれば、
// 画像の切り方(1536x1024の余白付き / 正方形に切り抜き)が違っても比べられる。
const discCheck = async () => {
  const { createCanvas } = require('../harness');
  const { loadImage } = require('canvas');
  const N = 256;
  const normalize = async (rel) => {
    const img = await loadImage(imgFile(rel));
    const src = createCanvas(img.width, img.height);
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const d = sctx.getImageData(0, 0, img.width, img.height).data;
    let x1 = img.width, y1 = img.height, x2 = -1, y2 = -1;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 32) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
    const out = createCanvas(N, N);
    const octx = out.getContext('2d');
    octx.drawImage(img, x1, y1, x2 - x1 + 1, y2 - y1 + 1, 0, 0, N, N);
    return octx.getImageData(0, 0, N, N).data;
  };
  // 外周のリング(半径0.88〜0.96)だけを比べる。中央はキャラで隠れるので見ない
  const ringDiff = (a, b) => {
    let n = 0, color = 0, shapeBad = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N - 0.5, dy = (y + 0.5) / N - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      if (r < 0.88 || r > 0.96) continue;
      const o = (y * N + x) * 4; n++;
      color += (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
      if (Math.abs(a[o + 3] - b[o + 3]) > 64) shapeBad++;
    }
    return { color: color / n, shape: shapeBad / n };
  };
  const base = await normalize('images/disc-icons/disc-stone-base.PNG');
  const eikiDisc = await normalize('images/disc-icons/eiki-disc.PNG');
  const mine = ringDiff(base, eikiDisc);
  // 「どのくらい違えば同じ土台と言えるか」は既存の円盤石から決める。検査側に固定値を書かない
  const others = ['mia-disc', 'plant-disc', 'undine-disc', 'yaobikuni-disc', 'pandora-disc', 'snegurochka-disc'];
  const existing = [];
  for (const name of others) {
    const rel = `images/disc-icons/${name}.PNG`;
    if (!fs.existsSync(imgFile(rel))) continue;
    existing.push({ name, ...ringDiff(base, await normalize(rel)) });
  }
  const worst = Math.max(...existing.map(e => e.color));
  console.log(`  既存の円盤石の外周リング色差: ${existing.map(e => `${e.name} ${e.color.toFixed(1)}`).join(' / ')}`);
  check('円盤石の土台の形が共通のもの(DISC_STONE_BASE)と同じ', mine.shape < 0.01, `輪郭のズレ ${(mine.shape * 100).toFixed(1)}%`);
  check('円盤石の土台を別デザインへ描き直していない', mine.color <= worst + 10,
    `エイキ ${mine.color.toFixed(1)} / 既存の最大 ${worst.toFixed(1)}`);
};

discCheck().then(() => {
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
