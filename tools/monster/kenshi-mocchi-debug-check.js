// 新レア「剣士モッチー」の正式実装前確認。
//
//   node tools/monster/kenshi-mocchi-debug-check.js
//
// 【この段階の位置づけ】
// 剣士モッチーはまだ正式実装していない。エイキと同じく debugOnly:true を付けて、
//   ・通常ロースター(解放していないので出ない)
//   ・図鑑(dexMonsterList が debugOnly を外す)
//   ・種族チャレンジの種族一覧・メンバー(同じく dexMonsterList 経由)
//   ・マーケット(円盤石をまだ商品化していない)
//   ・更新履歴・ヘルプ
// のどこにも出ないまま、デバッグ画面からだけ絵と染色を確かめられる状態にしてある。
//
// この段階で確かめたいのは「モデリングと染色マスクが本番と同じ経路で効くか」なので、
// 能力値そのものの妥当性(仮の値)ではなく、次の3つを見る。
//   ① 表へ出ていないこと
//   ② 染色が5部位として成立していること(ここを間違えると染色が丸ごと消える)
//   ③ デバッグ画面から絵・顔アイコン・円盤石・染色を確認できること
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const source = read('monster-hero/src/game-system.jsx');
const allySrc = read('monster-hero/data/ally-monsters.js');
const lineageSrc = read('monster-hero/data/lineages.js');
const imagesSrc = read('monster-hero/data/images/images-ally.js');
const breederSrc = read('monster-hero/data/breeder.js');
const changelogSrc = read('monster-hero/data/changelog.js');
const helpSrc = read('monster-hero/data/help.js');

const ID = 'KenshiMocchi';
const NAME = '剣士モッチー';

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
const mon = ALL_PLAYER_MONSTERS[ID];

console.log('--- ① 定義と絵 ---');
check(`${NAME}が定義されている`, !!mon);
if (!mon) { console.log('\n定義が無いため以降を中止'); process.exit(1); }
check(`内部IDが ${ID}`, mon.id === ID);
check(`名前が ${NAME}`, mon.name === NAME);
// 立ち絵・全身アイコン・顔アイコンの3つは、モンスター画像・染色確認の画面が直に見る。
// 欠けると壊れた画像になるので、URLが入っていることと実ファイルがあることの両方を見る
for (const [label, url] of [['立ち絵', mon.imgUrl], ['全身アイコン', mon.iconUrl], ['顔アイコン', mon.faceIconUrl]]) {
  const rel = typeof url === 'string' ? url.split('?')[0] : '';
  check(`${label}のPNGが実在する`, !!rel && fs.existsSync(path.join(ROOT, 'monster-hero', rel)), rel || 'URLが無い');
}
check('攻撃モーションを明示している', typeof mon.atkMotion === 'string' && mon.atkMotion.length > 0, String(mon.atkMotion));
check('通常技が9段階そろっている', (HERO_ATK_NAMES[ID] || []).length === 9, `${(HERO_ATK_NAMES[ID] || []).length}段階`);
// 未登録でも落ちないが、HERO_ATK_NAMES['Mocchi'] へ静かに落ちてモッチーの技名が出る
check('通常技がモッチーの使い回しになっていない',
  JSON.stringify(HERO_ATK_NAMES[ID]) !== JSON.stringify(HERO_ATK_NAMES.Mocchi));
check('固有技が9段階そろっている', (mon.unique?.names || []).length === 9, `${(mon.unique?.names || []).length}段階`);
check('固有技の出自が自分自身', mon.unique?.monId === ID, String(mon.unique?.monId));

console.log('--- ② 勇者特性・固有効果が「説明だけ」になっていないこと ---');
// 表示だけ足しても効果は出ない。仮の中身としてモッチー/ミタラシの実装を借りているので、
// その3か所のid分岐に自分が入っていることを見る(入れ忘れると説明と挙動が食い違う)
check('勇者特性(もち肌)の被ダメージ軽減に入っている',
  source.includes(`mainHero?.id==='Mocchi'||mainHero?.id==='Mitarashi'||mainHero?.id==='${ID}'`));
check('固有技(モッチ砲)の敵被ダメ増加に入っている',
  source.includes(`card.monId==='Mocchi'||card.monId==='Mitarashi'||card.monId==='${ID}'`)
  && source.includes(`card.monId==='${ID}')) return { dmgMod: 0.1 };`));
check('固有技(モッチ砲)の被ダメージ軽減に入っている',
  new RegExp(`card\\.monId==='${ID}'\\)\\{addPermaBuff\\('dmgCutPct'`).test(source));

console.log('--- ③ 血統・区分・図鑑説明 ---');
check('血統が モッチー × ？？？',
  MONSTER_LINEAGE_MAP[ID]?.main === 'mocchi' && MONSTER_LINEAGE_MAP[ID]?.sub === 'unknown',
  `${MONSTER_LINEAGE_MAP[ID]?.main} × ${MONSTER_LINEAGE_MAP[ID]?.sub}`);
check('副血統がレア扱いなので区分はレアになる', MONSTER_LINEAGES[MONSTER_LINEAGE_MAP[ID].sub]?.rare === true);
check('図鑑説明が入っている',
  typeof MONSTER_DEX_DESCRIPTIONS[ID] === 'string' && MONSTER_DEX_DESCRIPTIONS[ID].length > 40,
  `${(MONSTER_DEX_DESCRIPTIONS[ID] || '').length}文字`);

console.log('--- ④ まだ表へ出ていないこと(正式実装前) ---');
check('debugOnly が立っている', mon.debugOnly === true);
check('図鑑一覧(dexMonsterList)が debugOnly を外している',
  /const dexMonsterList = \(\) => \(typeof ALL_PLAYER_MONSTERS !== 'undefined' \? Object\.values\(ALL_PLAYER_MONSTERS\)\.filter\(mon => mon && !mon\.debugOnly\) : \[\]\);/.test(source));
// 円盤石の画像だけは breeder.js へ定数として先に置いてある。
// 見るべきは「商品の並び(BREEDER_MARKET_ITEMS)へ入っていないか」なので、そこだけを取り出して確かめる
const marketStart = breederSrc.indexOf('const BREEDER_MARKET_ITEMS = [');
const marketSrc = marketStart >= 0 ? breederSrc.slice(marketStart) : '';
check('マーケットの商品一覧を取り出せる', marketStart >= 0);
check('マーケットへ商品として登録していない', !/KenshiMocchi|kenshi_mocchi|剣士モッチー/i.test(marketSrc));
check('円盤石の画像だけは先に置いてある(商品ではない)', breederSrc.includes('KENSHI_MOCCHI_DISC_ICON'));
check('円盤石のPNGが実在する',
  fs.existsSync(path.join(ROOT, 'monster-hero/images/disc-icons/kenshi-mocchi-disc.PNG')));
check('更新履歴へ書いていない', !changelogSrc.includes(NAME));
check('ヘルプへ書いていない', !helpSrc.includes(NAME));
check('はじめから解放されるモンスターに入れていない', !new RegExp(`STARTER_MONSTER_IDS[^\\n]*${ID}`).test(allySrc));
check('デバッグ戦の勇者モン選択にだけ並べる仕組みが残っている',
  source.includes('const debugOnlyMonsterList = () => Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon?.debugOnly);')
  && /const debugHeroMonsterList = \(list\) => \{\s*\n\s*if \(!debugBattleRef\.current && !debugMonsterPreviewRef\.current\) return list;/.test(source));
check('起動時の画像先読みからも外している',
  source.includes("imageUrlsFor(allIds.filter(id => !ALL_PLAYER_MONSTERS[id]?.debugOnly))"));
check('連れた周回はスコア・全国ランキングへ残さない',
  /if \(runHasDebugOnlyMonster\(\)\) return;/.test(source)
  && /const runHasDebugOnlyMonster = \(\) => \[mainHero, \.\.\.slots\]\.some/.test(source));
check('マスモン登録の対象外(セーブデータへ入らない)',
  source.includes('if (debugBattle || mainHero?.debugOnly) return null;')
  && source.includes('if (!mainHero || mainHero.masuId || mainHero.debugOnly || debugBattleRef.current) return null;'));

console.log('--- ⑤ 染色(5部位・承認済みマスクが正本) ---');
// ここが今回の本題。EXACT_DYE_MASKS だけでは「部位が何枚あるか」を表せず、
// 部位数は MASU_COLOR_REGION_HUES[id].length だけが決めている。
// 本数が足りないと _exactDyeMaskRegion が返す③④に対応するマスクが無く、
// 例外は catch されて getDyeRegionMasks が null を返すため、
// 画面はエラーも出さずに「このモンスターだけ染色が丸ごと効かない」状態になる。
const dye = require('../harness').loadDyeModule();
const hues = dye.MASU_COLOR_REGION_HUES[ID];
check('染色の部位定義がある', Array.isArray(hues), hues ? `${hues.length}部位` : 'なし');
check('染色は5部位として登録されている', Array.isArray(hues) && hues.length === 5, `${hues ? hues.length : 0}部位`);
check('dyeRegionCount も5を返す', dye.dyeRegionCount(ID) === 5, String(dye.dyeRegionCount(ID)));
check('承認済みマスク(EXACT_DYE_MASKS)を正本にしている', !!dye.EXACT_DYE_MASKS[ID], String(dye.EXACT_DYE_MASKS[ID]));

// マスクと立ち絵は同じ座標系(同寸)でなければならない。
// _loadExactDyeMask はマスクを解析キャンバスへ引き伸ばして描くので、縦横比が違うと丸ごとズレる
const { loadImage } = require('canvas');
const { createCanvas } = require('../harness');
const maskRel = String(dye.EXACT_DYE_MASKS[ID] || '').split('?')[0];
const artRel = String(mon.imgUrl).split('?')[0];

(async () => {
  const [art, mask] = await Promise.all([
    loadImage(path.join(ROOT, 'monster-hero', artRel)),
    loadImage(path.join(ROOT, 'monster-hero', maskRel)),
  ]);
  check('マスクと立ち絵の大きさが同じ',
    art.width === mask.width && art.height === mask.height,
    `立ち絵 ${art.width}x${art.height} / マスク ${mask.width}x${mask.height}`);

  // マスクの色を、本番と同じ判定(_exactDyeMaskRegion)で数える。
  // 5部位ぶんすべてに画素があること = 黄・マゼンタが赤へ潰れていないこと
  const canvas = createCanvas(mask.width, mask.height);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(mask, 0, 0);
  const px = g.getImageData(0, 0, mask.width, mask.height).data;
  const region = (o) => {
    if (px[o + 3] < 20) return -1;
    const r = px[o], gg = px[o + 1], b = px[o + 2];
    if (r > 200 && gg < 80 && b < 80) return 0;
    if (gg > 200 && r < 80 && b < 80) return 1;
    if (b > 200 && r < 80 && gg < 80) return 2;
    if (r > 200 && gg > 200 && b < 80) return 3;
    if (r > 200 && gg < 80 && b > 200) return 4;
    return -1;
  };
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < mask.width * mask.height; i++) { const k = region(i * 4); if (k >= 0) counts[k]++; }
  const LABELS = ['①肌', '②コート・ブーツ', '③髪', '④左手の剣', '⑤右手の剣'];
  counts.forEach((n, i) => check(`染色${LABELS[i]}の画素がある`, n > 0, `${n}画素`));
  check('黄(染色④)とマゼンタ(染色⑤)が赤へ潰れていない', counts[3] > 0 && counts[4] > 0);

  console.log('--- ⑥ デバッグ画面から確認できること ---');
  // 染色マスクエディタの候補は ALL_PLAYER_MONSTERS から作るのでフィルタ不要。
  // ここで見るのは「作り方が変わっていないか」(debugOnly を弾く実装に戻っていないか)
  check('染色マスク編集の候補を ALL_PLAYER_MONSTERS から作っている(debugOnly も並ぶ)',
    source.includes('const makeDyeMaskEditorTargets = () => Object.values(ALL_PLAYER_MONSTERS).map(monster => ({'));
  check('モンスター画像・染色確認へ debugOnly の疑似個体を差し込んでいる',
    source.includes("if(mon?.debugOnly&&!owned.some(m=>m.baseId===mon.id))owned.push({id:`debug-preview-${mon.id}`"));
  // マスクエディタは以前3色(赤・緑・青)しか扱えず、黄・マゼンタを赤へ潰していた。
  // 5部位のマスクをエディタ経由で確認・書き出しできるかはここで決まる
  check('マスクエディタが5色を塗れる',
    source.includes("MASK_PALETTE=[['red','赤','#f00'],['green','緑','#080'],['blue','青','#00f'],['yellow','黄','#880'],['magenta','マゼンタ','#808']]"));
  check('マスクエディタの正規化が部位数ぶんの純色へ寄せる',
    source.includes('const normalizeMask=(image,outside,regionCount=3)=>')
    && source.includes('normalizeMask(image,outsideRef.current,dyeRegionCount(target.baseId))'));

  // 「実際の表示条件」の枠は、本番と同じ形(縦横比・角丸・収め方)でなければ意味が無い。
  // 以前は高さだけを指定していたため、幅がグリッドの列いっぱいに広がり、
  // 本番では丸いアイコンが横長のカプセルになっていた(2026-09-08・ユーザー指摘)。
  // 本番の実物: 一覧48px丸/cover・編成枠40px丸/contain・バトル64px正方形/contain・
  //             プロフィール80px丸/contain・アイコン選択マス約59px角丸/contain
  const frames = [
    ['バトル／立ち絵', 'imgUrl', 'aspect-square', 'object-contain'],
    ['一覧／全身アイコン', 'iconUrl', 'aspect-square rounded-full', 'object-cover'],
    ['顔アイコン', 'faceIconUrl', 'aspect-square rounded-full', 'object-contain'],
    ['プロフィール／選択アイコン', 'faceIconUrl', 'aspect-square rounded-2xl', 'object-contain'],
    ['小型／編成枠', 'imgUrl', 'aspect-square rounded-full', 'object-contain'],
  ];
  for (const [label, sourceKey, frameClass, fit] of frames) {
    // ラベルごとに1本の呼び出しとして照合する(同じ枠指定が他のラベルにもあるため、
    // 文字列がどこかに在るだけでは「その枠が正しい」ことにならない)
    check(`「${label}」の枠が本番と同じ形になっている`,
      source.includes(`renderCurrent('${label}','${sourceKey}',colors,'${frameClass}','${fit}'`),
      `${frameClass} / ${fit}`);
  }
  // 高さだけの枠(幅が列いっぱいに広がる)へ戻っていないか。丸を指定したのに横長のカプセルになる
  check('丸・角丸の枠に高さだけの指定が残っていない',
    !/renderCurrent\('(?:一覧／全身アイコン|顔アイコン|プロフィール／選択アイコン|小型／編成枠)','[^']*',colors,'h-\d+/.test(source));
  // 顔アイコンは本番(BreederIcon)で MARKET_PROFILE_ICON_STYLES の拡大・位置調整が掛かる。
  // これが無いと、faceIconUrl が立ち絵そのままのモンスター(ライガー・ミーア・パンドラ等)だけ
  // プレビューに全身が写り、本番とまったく別物になる
  check('顔アイコンの枠へ本番と同じ拡大・位置調整を渡している',
    source.includes('const profileIconStyle=marketProfileIconStyle(')
    && (source.match(/renderCurrent\('(?:顔アイコン|プロフィール／選択アイコン)'[^)]*profileIconStyle/g) || []).length === 2);

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
