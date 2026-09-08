// 新レア「剣士モッチー」の正式実装の回帰チェック。
//
//   node tools/monster/kenshi-mocchi-check.js
//
// 正式実装前は debugOnly:true で、図鑑・マーケット・更新履歴・ヘルプのどこにも出さず、
// デバッグ画面からだけ絵と染色を確かめられる状態にしていた(この段階の検証は完了・ユーザー承認済み)。
// 正式実装で debugOnly を外し、マーケット・図鑑・更新履歴・ヘルプへ表に出したので、
// ここからは「仕様どおりの数値のまま公開できているか」を見る回帰チェックになる。
// 正式実装前の kenshi-mocchi-debug-check.js は、④を「表へ出ていること」へ反転させたうえで
// このファイルへ畳んである(エイキの mode/eiki-debug-check.js と同じ流れ。
// 1体につき1本にしないと、絵と数値で見るファイルが分かれて片方だけ古くなる)。
//
// 連撃の実測は、式を検査側へ書き写すのではなく game-system.jsx の buildAttackHits
// そのものを切り出して動かしている(写すと本体を変えたときに検査だけが古くなるため)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const source = read('monster-hero/src/game-system.jsx');
const compiled = read('monster-hero/game-system.compiled.js');
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
  'globalThis.__x={ALL_PLAYER_MONSTERS,HERO_ATK_NAMES,MONSTER_LINEAGE_MAP,MONSTER_LINEAGES,MONSTER_DEX_DESCRIPTIONS,STARTER_MONSTER_IDS};'].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS, HERO_ATK_NAMES, MONSTER_LINEAGE_MAP, MONSTER_LINEAGES, MONSTER_DEX_DESCRIPTIONS, STARTER_MONSTER_IDS } = ctx.__x;
const mon = ALL_PLAYER_MONSTERS[ID];

console.log('--- ① 定義と基礎データ ---');
check(`${NAME}が定義されている`, !!mon);
if (!mon) { console.log('\n定義が無いため以降を中止'); process.exit(1); }
check(`内部IDが ${ID}`, mon.id === ID);
check(`名前が ${NAME}`, mon.name === NAME);
check('基礎能力 ライフ350/ちから185/丈夫さ25/ガッツ130',
  mon.baseHp === 350 && mon.baseAtk === 185 && mon.baseDef === 25 && mon.baseGuts === 130,
  `HP${mon.baseHp}/ATK${mon.baseAtk}/DEF${mon.baseDef}/GUTS${mon.baseGuts}`);
check('距離適性 零A/近A/中C/遠D',
  JSON.stringify(mon.distAptitude) === JSON.stringify(['A', 'A', 'C', 'D']), mon.distAptitude.join('/'));
// 供モン加入値は今回の依頼で新しい数値を指定していないため、仮実装のときの値をそのまま維持している
check('供モン加入値は仮実装から変えていない(+200/+55/+20/+25)',
  mon.plusStats.hp === 200 && mon.plusStats.atk === 55 && mon.plusStats.def === 20 && mon.plusStats.guts === 25,
  JSON.stringify(mon.plusStats));
// 立ち絵・全身アイコン・顔アイコン・円盤石は仮実装のときのものをそのまま使う(作り直していない)
for (const [label, url] of [['立ち絵', mon.imgUrl], ['全身アイコン', mon.iconUrl], ['顔アイコン', mon.faceIconUrl]]) {
  const rel = typeof url === 'string' ? url.split('?')[0] : '';
  check(`${label}のPNGが実在する`, !!rel && fs.existsSync(path.join(ROOT, 'monster-hero', rel)), rel || 'URLが無い');
}
check('円盤石のPNGが実在する', fs.existsSync(path.join(ROOT, 'monster-hero/images/disc-icons/kenshi-mocchi-disc.PNG')));

console.log('--- ② 技 ---');
const NORMALS = ['エッジもんた', 'もちき・リープ', 'ガッチョスラント', 'エアリアルもっちゃん', 'ガッチャー・クロス', '黒桜吹雪', 'もっさんスピン', '枝垂れクロス', 'バーストもっさま'];
const UNIQUES = ['ソニック・リープ', 'ホリゾンタル・スクエア', 'ヴォーパル・ストライク', 'デュアル・サーキュラー', 'ブラック・テンペスト', 'ブラック・チェイン', 'ナイトメア・レイド', 'ジ・エクリプス', 'スターバースト・ストリーム'];
check('通常技が9段階そろっている', (HERO_ATK_NAMES[ID] || []).length === 9, `${(HERO_ATK_NAMES[ID] || []).length}段階`);
check('通常技の名称が指定どおり', JSON.stringify(HERO_ATK_NAMES[ID]) === JSON.stringify(NORMALS));
check('固有技が9段階そろっている', (mon.unique?.names || []).length === 9, `${(mon.unique?.names || []).length}段階`);
check('固有技の名称が指定どおり', JSON.stringify(mon.unique.names) === JSON.stringify(UNIQUES));
check('固有技名は1段階目と同じ', mon.unique.name === UNIQUES[0]);
check('最終固有技が スターバースト・ストリーム', mon.unique.names[8] === 'スターバースト・ストリーム');
check('固有倍率が2.4', mon.unique.baseMult === 2.4, String(mon.unique.baseMult));
check('消費ガッツが48', mon.unique.baseGuts === 48, String(mon.unique.baseGuts));
check('固有技の出自が自分自身', mon.unique.monId === ID, String(mon.unique.monId));

// 固有技の成長は既存の共通式をそのまま通す。専用の式を作っていないことを、実装から切り出して確かめる
const levelsSrc = source.match(/^\s*const getUniqueSkillLevels = .*$/m);
check('固有技Lvの計算を実装から取り出せる', !!levelsSrc);
if (levelsSrc) {
  const lv = vm.runInNewContext(`${levelsSrc[0]}getUniqueSkillLevels;`, { Math, Array, Object });
  const rows = lv(mon);
  const want = [[2.4, 48], [2.9, 58], [3.4, 68], [3.9, 78], [4.4, 88], [4.9, 98], [5.4, 108], [5.9, 118], [6.4, 128]];
  want.forEach(([mult, guts], i) => {
    const row = rows[i] || {};
    // power は倍率を100倍した整数(画面の「威力」表示)。2.4倍 → 240
    check(`Lv${i} が ${mult}倍 / 消費${guts}`,
      Number(row.power) === Math.round(mult * 100) && Number(row.guts) === guts,
      `威力${row.power}(${(Number(row.power) / 100).toFixed(1)}倍) / 消費${row.guts}`);
  });
  check('剣士モッチーだけ別の成長式にしていない', !/KenshiMocchi/.test(levelsSrc[0]));
}

console.log('--- ③ 血統・区分・図鑑説明 ---');
check('血統が モッチー × ？？？',
  MONSTER_LINEAGE_MAP[ID]?.main === 'mocchi' && MONSTER_LINEAGE_MAP[ID]?.sub === 'unknown',
  `${MONSTER_LINEAGE_MAP[ID]?.main} × ${MONSTER_LINEAGE_MAP[ID]?.sub}`);
check('副血統がレア扱いなので区分はレアになる', MONSTER_LINEAGES[MONSTER_LINEAGE_MAP[ID].sub]?.rare === true);
check('図鑑説明が指定文のまま',
  MONSTER_DEX_DESCRIPTIONS[ID] === '黒の剣士と呼ばれる人物に憧れるモッチー。二本の剣を背負い、素早い連続攻撃を得意とする。一匹で戦おうとするが、仲間が困っていると放っておけない。');

console.log('--- ④ 正式実装で表へ出ていること ---');
check('debugOnly を外している(正式実装済み)', mon.debugOnly === undefined || mon.debugOnly === false);
// 図鑑の一覧は種族順に並べ替えるようになったので、実装の行を丸ごと写さない。
// 見たいのは「除いているのは debugOnly だけで、剣士モッチーを外す条件を足していないか」。
// 実際に切り出して動かし、剣士モッチーが図鑑の並びに居ることまで確かめる
{
  const dexSrc = source.match(/const dexMonsterList = \(\) => \{[\s\S]*?\n\};/);
  check('図鑑一覧(dexMonsterList)を取り出せる', !!dexSrc);
  if (dexSrc) {
    check('除いているのは debugOnly だけ(剣士モッチーを名指しで外していない)',
      /!mon\.debugOnly/.test(dexSrc[0]) && !/KenshiMocchi/.test(dexSrc[0]));
    // 血統まわりの関数ごと切り出して、本物の並びを作る
    const region = (from, to) => { const i = source.indexOf(from), j = source.indexOf(to, i); return (i >= 0 && j > i) ? source.slice(i, j) : null; };
    const lineageRegion = region('const UNKNOWN_LINEAGE =', '// ==================== 総合力');
    check('血統まわりの実装を取り出せる', !!lineageRegion);
    if (lineageRegion) {
      const dexCtx = { console, Object, Array, Set, Map, String, Number };
      vm.createContext(dexCtx);
      vm.runInContext([imagesSrc, allySrc, lineageSrc, lineageRegion,
        'globalThis.__dex = { dexMonsterList, monsterLineageOf };'].join('\n'), dexCtx);
      const dexList = dexCtx.__dex.dexMonsterList();
      const names = dexList.map(m => m.id);
      check('剣士モッチーが図鑑の並びに入っている', names.includes(ID), `${names.length}体中 ${names.indexOf(ID) + 1}番目`);
      // 種族順なので、モッチー血統の3体(モッチー・剣士モッチー・ミタラシ)が続いて並ぶ
      const mocchiRun = names.filter((_, i) => dexCtx.__dex.monsterLineageOf(names[i]).main?.id === 'mocchi');
      const first = names.indexOf(mocchiRun[0]);
      const contiguous = mocchiRun.every((id, k) => names[first + k] === id);
      check('剣士モッチーはモッチー種のとなりに並ぶ(種族順)', contiguous && mocchiRun.includes(ID),
        mocchiRun.map(id => ALL_PLAYER_MONSTERS[id]?.name).join(' → '));
    }
  }
}
const marketStart = breederSrc.indexOf('const BREEDER_MARKET_ITEMS = [');
const marketSrc = marketStart >= 0 ? breederSrc.slice(marketStart) : '';
check('マーケットの商品一覧を取り出せる', marketStart >= 0);
check('マーケットに「剣士モッチーのアイコン」がある(pt購入)',
  /\{ id:'kenshi_mocchi_icon', name:"剣士モッチーのアイコン", type:'icon', icon:KENSHI_MOCCHI_FACE_ICON, cost:1 \}/.test(marketSrc));
check('マーケットに「剣士モッチーの円盤石アイコン」がある(pt購入)',
  /\{ id:'kenshi_mocchi_disc_icon', name:"剣士モッチーの円盤石アイコン", type:'icon', icon:KENSHI_MOCCHI_DISC_ICON, cost:1 \}/.test(marketSrc));
check('マーケットに「剣士モッチーの円盤石」が3000ダイヤである',
  /\{ id:'KenshiMocchi', name:"剣士モッチーの円盤石", type:'disc', icon:KENSHI_MOCCHI_DISC_ICON, cost:3000 \}/.test(marketSrc));
// 円盤石の商品idはモンスターidそのもの。これが解放のキーになる(購入するまでは使えない)
check('円盤石の商品idがモンスターidと同じ(購入で解放される)', /\{ id:'KenshiMocchi',[^\n]*type:'disc'/.test(marketSrc));
check('はじめから解放されるモンスターには入れない(円盤石購入で解放する)',
  !STARTER_MONSTER_IDS.includes(ID), STARTER_MONSTER_IDS.join(','));
check('更新履歴に新モンスター追加の項目がある', /新レアモンスター 剣士モッチーを追加/.test(changelogSrc));
// 剣士モッチー自身はもう debugOnly ではないが、正式実装前に通ってきた「デバッグ段階の仕組み」は
// 次の新モンスターがまた通る道なので、ここで一緒に見張っておく(専用の検査ファイルを分けると、
// debugOnly のモンスターが1体もいない期間に誰も動かさなくなり、静かに壊れる)
check('デバッグ段階の仕組みが残っている(次の新モンスターがまた通る)',
  source.includes('const debugOnlyMonsterList = () => Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon?.debugOnly);')
  && source.includes("imageUrlsFor(allIds.filter(id => !ALL_PLAYER_MONSTERS[id]?.debugOnly))")
  && /const runHasDebugOnlyMonster = \(\) => \[mainHero, \.\.\.slots\]\.some/.test(source));
check('更新履歴のマーケット追加は助手の告知(assistantNotice)付き',
  /title: '新レアモンスター 剣士モッチーを追加'[\s\S]{0,1600}?assistantNotice: \{ id:'update_notice_kenshi_mocchi_market_v1', type:'market' \}/.test(changelogSrc));
check('ヘルプのマーケット項目に剣士モッチーが載っている',
  /パンドラ・エイキ・剣士モッチーの円盤石は各3000ダイヤ/.test(helpSrc));
check('ヘルプの図鑑項目に剣士モッチー専用の解説がある',
  /title:'剣士モッチー', text:'剣士モッチーは「モッチー × ？？？」のレアモンスター/.test(helpSrc));
check('画像は仮実装のものを使い回している(円盤石を作り直していない)',
  breederSrc.includes('const KENSHI_MOCCHI_DISC_ICON = "images/disc-icons/kenshi-mocchi-disc.PNG'));

console.log('--- ⑤ 勇者特性「二刀流」: 同時使用可能枚数+1 ---');
// ハムの「連続攻撃」と同じ共通ルールへ乗せる。種ごとの分岐をコピーしない
check('加算する種を一覧で持っている',
  source.includes("const HERO_CARD_BONUS_MONSTER_IDS = Object.freeze(['Ham', 'KenshiMocchi']);")
  && source.includes("const heroCardBonusOf = (heroId) => (HERO_CARD_BONUS_MONSTER_IDS.includes(heroId) ? 1 : 0);"));
check('枚数の計算はその一覧だけを見る',
  source.includes("const heroCardBonus = useMemo(() => heroCardBonusOf(mainHero?.id), [mainHero]);")
  && source.includes('limit += heroCardBonus + kikiCardBonus;'));
check('剣士モッチー専用の枚数分岐を書き足していない',
  !/if \(mainHero\?\.id === 'KenshiMocchi'\) limit \+= 1;/.test(source));
{
  // 実装から枚数計算を切り出して、勇者ごとの結果を実測する(ハムの既存挙動を壊していないことも見る)
  const bonusSrc = source.match(/const HERO_CARD_BONUS_MONSTER_IDS = [\s\S]*?const heroCardBonusOf = [^\n]+\n/);
  const fn = bonusSrc ? vm.runInNewContext(`${bonusSrc[0]}heroCardBonusOf;`, { Object }) : null;
  check('枚数ボーナスの関数を取り出せる', !!fn);
  if (fn) {
    const limitOf = (heroId, maxGuts, allies) => {
      let limit = 1;
      if (maxGuts >= 180 && allies >= 3) limit = 3;
      else if (maxGuts >= 120 && allies >= 2) limit = 2;
      return limit + fn(heroId);
    };
    check('勇者が通常モンスターなら既存ルールのまま',
      limitOf('Mocchi', 100, 1) === 1 && limitOf('Mocchi', 120, 2) === 2 && limitOf('Mocchi', 180, 3) === 3);
    check('勇者ハムは既存どおり+1', limitOf('Ham', 100, 1) === 2 && limitOf('Ham', 180, 3) === 4);
    check('勇者剣士モッチーもハムと同じく+1',
      limitOf(ID, 100, 1) === 2 && limitOf(ID, 120, 2) === 3 && limitOf(ID, 180, 3) === 4);
  }
}
// AUTOは手動と同じ cardLimit / slotMaxUses を受け取る。ここが切れると手動とAUTOで食い違う
check('AUTOへ手動と同じ枚数ルールを渡している',
  source.includes('hand, slots, guts, cardLimit, strategy:autoSettings.strategy,')
  && source.includes('getCardGuts, cardNeedsMonster, slotMaxUses,'));
// 1つのスロットへ重ねられる枚数も、枚数+1の勇者特性を持つ種の共通ルール(heroCardBonusOf)へ乗せる。
// 種ごとの分岐(mainHero?.id==='Ham' のような直書き)へ戻っていないことを見る
check('同じスロットへ重ねる条件も共通ルールで決めている',
  source.includes("const slotMaxUses = (mon) => ((heroCardBonusOf(mainHero?.id)>0&&mon?.id===mainHero?.id)||kikiCardBonus>0) ? cardLimit : 1;"));
{
  // 実際に同じ式を動かして、ハム・ききの既存の答えが1つも変わっていないことと、
  // 剣士モッチーだけが新しく重ねられるようになったことを突き合わせる
  // 判定に使う heroCardBonusOf は、検査側に書き写さず実装から切り出したものを使う
  const bonusSrc2 = source.match(/const HERO_CARD_BONUS_MONSTER_IDS = [\s\S]*?const heroCardBonusOf = [^\n]+\n/);
  const bonusOf = bonusSrc2 ? vm.runInNewContext(`${bonusSrc2[0]}heroCardBonusOf;`, { Object }) : (() => 0);
  const before = (heroId, monId, kiki, limit) => ((heroId === 'Ham' && monId === 'Ham') || kiki > 0) ? limit : 1;
  const after = (heroId, monId, kiki, limit) => ((bonusOf(heroId) > 0 && monId === heroId) || kiki > 0) ? limit : 1;
  const ids = [null, 'Ham', 'KenshiMocchi', 'Zan', 'Eiki', 'Pandora', 'Mocchi'];
  const diff = [];
  for (const h of ids) for (const m of ids) for (const kiki of [0, 1]) for (const limit of [1, 2, 3, 4]) {
    if (before(h, m, kiki, limit) !== after(h, m, kiki, limit)) diff.push(`${h}/${m}/きき${kiki}/上限${limit}`);
  }
  check('答えが変わるのは「勇者=剣士モッチー かつ 剣士モッチーのカード」だけ(ハム・きき・他は従来どおり)',
    diff.length > 0 && diff.every(d => d.startsWith('KenshiMocchi/KenshiMocchi/きき0/')),
    `${diff.length}件: ${diff.slice(0, 4).join(' / ')}`);
  check('勇者ハムはハムのカードを重ねられる(従来どおり)', after('Ham', 'Ham', 0, 3) === 3);
  check('勇者剣士モッチーも剣士モッチーのカードを重ねられる', after('KenshiMocchi', 'KenshiMocchi', 0, 3) === 3);
  check('勇者剣士モッチーでも他のモンスターのカードは1枚のまま', after('KenshiMocchi', 'Zan', 0, 3) === 1);
  check('勇者でない剣士モッチー(供モン)は重ねられない', after('Zan', 'KenshiMocchi', 0, 3) === 1);
}

console.log('--- ⑥ ヒット列(二刀流・ソードスキル)を実装から切り出して実測 ---');
const rulesSrc = source.match(/const ATTACK_COMBO_RULES = Object\.freeze\(\{[\s\S]*?\n\}\);\n/);
const buildSrc = source.match(/const buildAttackHits = \(\{[\s\S]*?\n\};\n/);
check('ヒット列の正本(ATTACK_COMBO_RULES / buildAttackHits)を取り出せる', !!rulesSrc && !!buildSrc);
if (rulesSrc && buildSrc) {
  const hitCtx = { Math, Object, Array };
  vm.createContext(hitCtx);
  vm.runInContext(`${rulesSrc[0]}${buildSrc[0]}globalThis.__b=buildAttackHits;`, hitCtx);
  const build = hitCtx.__b;
  // 会心なし・距離補正なし・その他バフなしで、基準ダメージD=1000のヒット列を作る
  const hits = (opts) => build({ d: 1000, rollCrit: () => false, ...opts });
  const dmgs = (opts) => hits(opts).map(h => h.dmg);
  const total = (opts) => dmgs(opts).reduce((a, b) => a + b, 0);
  const normal = { card: { type: 'atk' }, attackerId: ID, heroId: ID };
  const ranged = { card: { type: 'range_atk' }, attackerId: ID, heroId: ID };
  const unique = { card: { type: 'unique', monId: ID }, attackerId: ID, heroId: ID };

  check('A. 通常攻撃は 500+500(合計は元の100%のまま)',
    JSON.stringify(dmgs(normal)) === JSON.stringify([500, 500]), dmgs(normal).join('+'));
  check('A. 距離技も同じく 500+500', JSON.stringify(dmgs(ranged)) === JSON.stringify([500, 500]), dmgs(ranged).join('+'));
  // 「合計は元のまま」が仕様なので、基準ダメージが奇数でも1減らない(余りはメインへ寄せる)。
  // 両方 floor だと 1001 が 500+500=1000 になる
  const odd = build({ d: 1001, rollCrit: () => false, ...normal }).map(h => h.dmg);
  check('A. 基準ダメージが奇数でも合計が減らない(1001 → 501+500)',
    JSON.stringify(odd) === JSON.stringify([501, 500]) && odd[0] + odd[1] === 1001, odd.join('+'));
  // 禁忌解錠(パンドラ)は公開済みの挙動をそのまま保つ(こちらは従来どおり両方 floor)
  const oddPandora = build({ d: 1001, rollCrit: () => false, card: { type: 'atk' }, attackerId: 'Pandora', heroId: 'Pandora' }).map(h => h.dmg);
  check('パンドラの分割は従来のまま変えていない(1001 → 500+500)',
    JSON.stringify(oddPandora) === JSON.stringify([500, 500]), oddPandora.join('+'));
  check('B. 自身の固有技は 1000 + 10%×3 + 20%×2 = 1700',
    JSON.stringify(dmgs(unique)) === JSON.stringify([1000, 100, 100, 100, 200, 200]), dmgs(unique).join('+'));
  check('B. 固有技のメインは分割しない(100%のまま)', hits(unique)[0].dmg === 1000);
  check('C. 連撃ダメージ+3%は各連撃の率へ加わる(50%→53% / 10%→13% / 20%→23%)',
    JSON.stringify(dmgs({ ...normal, comboDmgBonus: 0.03 })) === JSON.stringify([500, 530])
    && JSON.stringify(dmgs({ ...unique, comboDmgBonus: 0.03 })) === JSON.stringify([1000, 130, 130, 130, 230, 230]));
  check('D. 固有技3回後(+9%・追加連撃1本)の通常攻撃は 500+590+190',
    JSON.stringify(dmgs({ ...normal, comboDmgBonus: 0.09, kenshiExtraCombos: 1 })) === JSON.stringify([500, 590, 190]),
    dmgs({ ...normal, comboDmgBonus: 0.09, kenshiExtraCombos: 1 }).join('+'));
  // E. 固有技6回後(+18%・追加連撃2本)。連撃ダメージ補正はゲーム中「0.03を6回足した値」になるため、
  // ここでも同じ足し方で作る。50%+18%=68% は小数の丸めで 0.6799999999999999 になり、
  // 共通の連撃計算 Math.floor(d*率) が 680 ではなく 679 を返す(ザン・エイキでも前から同じ挙動)。
  // 既存モンスターの出目を動かさないため今回は共通側へ手を入れておらず、現状の値をそのまま記録する。
  // 将来 Math.floor(d*率+1e-9) のような補正を共通側へ入れたら、ここが落ちて気づけるようにしてある。
  let e18 = 0; for (let i = 0; i < 6; i++) e18 += 0.03;
  const eHits = dmgs({ ...normal, comboDmgBonus: e18, kenshiExtraCombos: 2 });
  check('E. 固有技6回後(+18%・追加連撃2本)の通常攻撃は 500+679+280×2(679は小数の丸めによる既存挙動)',
    JSON.stringify(eHits) === JSON.stringify([500, 679, 280, 280]), eHits.join('+'));
  check('F. 固有技9回後(+27%・追加連撃3本)の通常攻撃は 500+770+370×3',
    JSON.stringify(dmgs({ ...normal, comboDmgBonus: 0.27, kenshiExtraCombos: 3 })) === JSON.stringify([500, 770, 370, 370, 370]),
    dmgs({ ...normal, comboDmgBonus: 0.27, kenshiExtraCombos: 3 }).join('+'));
  // 永久追加連撃には上限を設けない。多くしても本数どおり並ぶことを実測する
  check('永久追加連撃に本数の上限が無い(30本でも30ヒット増える)',
    hits({ ...normal, kenshiExtraCombos: 30 }).length === 2 + 30, `${hits({ ...normal, kenshiExtraCombos: 30 }).length}ヒット`);
  check('永久追加連撃にも連撃ダメージ補正が乗る(10%+補正)',
    dmgs({ ...normal, comboDmgBonus: 0.5, kenshiExtraCombos: 1 })[2] === 600);
  // 連撃は「直前のヒット」ではなく分割前の基準ダメージを基準にする
  check('連撃は分割前の基準ダメージ基準(500の10%=50 ではない)',
    dmgs({ ...unique })[1] === 100);
  // 勇者特性は本人条件。継承しただけでは付かない
  check('継承した固有技ではソードスキル(20%×2)だけが出る(勇者特性の10%×3は付かない)',
    JSON.stringify(dmgs({ card: { type: 'unique', monId: ID }, attackerId: 'Zan', heroId: 'Zan' })) === JSON.stringify([1000, 300, 200, 200]),
    dmgs({ card: { type: 'unique', monId: ID }, attackerId: 'Zan', heroId: 'Zan' }).join('+'));
  check('勇者が別のモンスターなら通常攻撃は分割しない',
    JSON.stringify(dmgs({ card: { type: 'atk' }, attackerId: ID, heroId: 'Mocchi' })) === JSON.stringify([1000]));
  // 各ヒットは個別に会心判定される(専用の会心式を作っていない)
  check('連撃は1ヒットずつ会心判定する',
    hits({ ...unique, rollCrit: () => true, critDmgBonus: 0 }).every(h => h.crit === true)
    && hits({ ...unique, rollCrit: () => true }).slice(1).every(h => h.dmg === Math.floor((h.dmg / 1.5) * 1.5)));

  console.log('--- ⑦ 既存モンスターの回帰(ヒット列が変わっていないこと) ---');
  const regress = [
    ['ハム勇者・ハム通常', { card: { type: 'atk' }, attackerId: 'Ham', heroId: 'Ham' }, [1000]],
    ['ザン勇者・ザン通常', { card: { type: 'atk' }, attackerId: 'Zan', heroId: 'Zan' }, [1000, 300]],
    ['ザン勇者・ザン固有', { card: { type: 'unique', monId: 'Zan' }, attackerId: 'Zan', heroId: 'Zan' }, [1000, 300, 200]],
    ['エイキ勇者・エイキ固有', { card: { type: 'unique', monId: 'Eiki' }, attackerId: 'Eiki', heroId: 'Eiki' }, [1000, 100, 100, 300, 150, 150]],
    ['パンドラ勇者・パンドラ通常', { card: { type: 'atk' }, attackerId: 'Pandora', heroId: 'Pandora' }, [500, 500]],
    ['パンドラ勇者・パンドラ固有', { card: { type: 'unique', monId: 'Pandora' }, attackerId: 'Pandora', heroId: 'Pandora' }, [1000, 1000]],
    ['アーク勇者・アーク固有', { card: { type: 'unique', monId: 'Ark' }, attackerId: 'Ark', heroId: 'Ark' }, [1000]],
    ['モッチー勇者・モッチー通常', { card: { type: 'atk' }, attackerId: 'Mocchi', heroId: 'Mocchi' }, [1000]],
    ['ミタラシ勇者・ミタラシ固有', { card: { type: 'unique', monId: 'Mitarashi' }, attackerId: 'Mitarashi', heroId: 'Mitarashi' }, [1000]],
  ];
  for (const [label, opts, want] of regress) {
    check(`${label} が ${want.join('+')}`, JSON.stringify(dmgs(opts)) === JSON.stringify(want), dmgs(opts).join('+'));
  }
}

console.log('--- ⑧ ソードスキルの積み上げ(連撃パワー・永久追加連撃) ---');
check('連撃パワーの上限が定数で置かれている', /const KENSHI_COMBO_POWER_MAX = 3;/.test(source));
// 固有技の効果ブロックそのものを読み、積み上げの中身を確かめる
const effectBlock = (() => {
  const from = source.indexOf("else if(card.monId==='KenshiMocchi'){");
  if (from < 0) return '';
  return source.slice(from, source.indexOf('\n          }', from) + 12);
})();
check('ソードスキルの効果ブロックがある', effectBlock.length > 0);
check('連撃ダメージ+3%はザン・エイキと同じ comboDmgPct へ積む',
  /addPermaBuff\('comboDmgPct',0\.03\*effMul\);/.test(effectBlock));
check('連撃パワーを1ずつ貯める', /kenshiComboPower:nextPower/.test(effectBlock) && /livePermaBuff\('kenshiComboPower'\)\+1/.test(effectBlock));
check('3たまったら永久追加連撃+1して0へ戻す',
  /nextPower>=KENSHI_COMBO_POWER_MAX/.test(effectBlock)
  && /kenshiComboPower:0,kenshiExtraCombo:\(p\.kenshiExtraCombo\|\|0\)\+1/.test(effectBlock));
check('永久追加連撃に上限を書いていない', !/kenshiExtraCombo[^\n]*Math\.min/.test(effectBlock));
// permaBuffs はラン開始でだけ初期化され、WAVEを跨いでも保持される(セーブデータには入らない)
check('連撃パワー・永久追加連撃はランの永続バフに持つ(WAVEを跨いで保持)',
  /writePermaBuffs\(p=>\(\{\.\.\.p,kenshiComboPower:/.test(source));
// 剣士モッチーのカードを同じターンに複数枚使えるようになったので、2枚目の扱いも見る。
// 連撃ダメージ+3%は2枚目で半減(effMul)、連撃パワーは回数なので半減しない
check('2枚目の連撃ダメージ+3%には半減(effMul)が掛かる',
  /else if\(card\.monId==='KenshiMocchi'\)\{\s*\n?\s*addPermaBuff\('comboDmgPct',0\.03\*effMul\);/.test(source));
check('連撃パワーは2枚目でも1たまる(回数なので半減しない)',
  /const nextPower=livePermaBuff\('kenshiComboPower'\)\+1;/.test(source)
  && !/kenshiComboPower.*\*effMul/.test(source));
// 固有技は山札に1枚しか入らない(buildDeck が pool.push を1回だけ行う)。
// 「同じターンに固有技を2回撃って連撃パワーを一気に2ためる」ことはできない。
// ここが崩れると、連撃パワーの貯まる速さがそもそも変わってしまう
check('固有技は1スロットにつき1枚しか山札へ入らない(同じターンに2回は撃てない)', (() => {
  const deck = source.match(/const options=getAvailableUniquesForSlot\(s,cUniques,idx,cInhEvo\);[\s\S]*?\n\s*\}\n/);
  if (!deck) return false;
  return (deck[0].match(/pool\.push\(\{\.\.\.u,/g) || []).length === 1
    && !/for\s*\([^)]*\)\s*pool\.push/.test(deck[0]);
})());

check('ラン開始時に永続バフごと0へ戻る',
  (source.match(/writePermaBuffs\(\{autoHpRecovery:0\.1\}\); setWaveBuffs\(\{\}\);/g) || []).length >= 2);
check('セーブデータ(mh_*)へ保存していない', !/mh_kenshi/.test(source));
check('ヒット列へ本数を渡している(予測と実処理の3経路すべて)',
  (source.match(/kenshiExtraCombos:getPermaBuff\('kenshiExtraCombo'\)/g) || []).length === 3);
// 予測ダメージと実ダメージは同じ関数を通る(予測専用の式を書き写していない)
check('予測ダメージも同じ buildAttackHits を通る',
  /const hits=buildAttackHits\(\{ d:baseDmg, card, attackerId:mon\?\.id, heroId:mainHero\?\.id/.test(source));
check('状態表示に連撃パワーと追加連撃を出している',
  /連撃パワー \{getPermaBuff\('kenshiComboPower'\)\}\/\{KENSHI_COMBO_POWER_MAX\}/.test(source));

console.log('--- ⑨ 専用の二刀流モーション ---');
check('atkMotion が専用種別になっている', mon.atkMotion === 'kenshiTwinBlade', String(mon.atkMotion));
check('X字に振り抜く keyframes がある', /@keyframes kenshiTwinBladeSlash \{/.test(source));
check('斬撃の軌跡は＼と／の2本', /KENSHI_TWIN_SLASHES = Object\.freeze\(\[/.test(source)
  && /angle:'-38deg'/.test(source) && /angle:'38deg'/.test(source));
check('本番とDEBUGが同じ入口(attackMotionAnimation)を通る',
  /if \(anim\.twinBlade\) return 'kenshiTwinBladeSlash 420ms ease-out forwards';/.test(source));
// 軌跡(2本目は270ms遅れ)がモーション(420ms)より先に終わること。
// 尺が合っていないと、振り抜きの途中で軌跡だけ消える/軌跡が出たまま切れる
check('斬撃の軌跡はモーションの尺(420ms)に収まる',
  /animation: kenshiTwinSlashSweep 150ms ease-out forwards;/.test(source)
  && /delay:'270ms'/.test(source) && 270 + 150 <= 420);
// 待ち時間も同じ420ms。ここがずれると、モーションの途中でダメージ数値が出はじめる
check('本番とDEBUGの待ち時間もモーションと同じ420ms',
  /isTwinBlade\?420:320/.test(source) && /isTwin\?420:320/.test(source));
// 連撃をまとめて1回だけ流す作りに乗せる。永久追加連撃が増えてもターンの長さが変わらない
check('連撃はまとめて1回だけモーションを流す(ザン・エイキと同じ束ね方)',
  /const isComboDashMotion = hitMotion==='zanCombo' \|\| hitMotion==='eikiSakuraCombo' \|\| hitMotion==='kenshiTwinBlade';/.test(source));
// 永久追加連撃が増えてもターンが伸び続けないよう、数値を出す間隔は本数で詰める。
// ザン(最大3ヒット)・エイキ(最大6ヒット)はこれまでどおり1本140msのままであることも確かめる
check('連撃の数値表示は本数が増えると間隔を詰める(ターンが伸び続けない)',
  /const comboStepMs=Math\.max\(30,Math\.min\(140,Math\.floor\(840\/group\.length\)\)\);/.test(source)
  && /await battleWait\(comboStepMs\);/.test(source));
{
  const step = (n) => Math.max(30, Math.min(140, Math.floor(840 / n)));
  check('ザン(3ヒット)・エイキ(6ヒット)の間隔は140msのまま', step(1) === 140 && step(3) === 140 && step(6) === 140);
  check('本数が増えても出しきる時間が伸び続けない(16本でも1秒未満)',
    16 * step(16) < 1000 && 32 * step(32) < 1200, `16本 ${16 * step(16)}ms / 32本 ${32 * step(32)}ms`);
}
check('RPG表示のモーション対応表にも入れている', /kenshiTwinBlade:'Dash'/.test(source));
check('既存モンスターのモーションは変えていない',
  /zanCombo:'Dash', eikiSakuraCombo:'Dash'/.test(source)
  && /if \(anim\.zanCombo\) return 'zanComboDash 320ms ease-out forwards';/.test(source));
check('動きを減らす設定への代替がある', /@keyframes kenshiTwinSlashFade \{/.test(source));

console.log('--- ⑩ ビルド生成物 ---');
check('compiled にも反映されている(ビルド済み)',
  compiled.includes('kenshiTwinBlade') && compiled.includes('kenshiExtraCombo') && compiled.includes('HERO_CARD_BONUS_MONSTER_IDS'));

// ここから先は画像を実際に読むため非同期。⑪染色と⑫デバッグ画面は、正式実装前の
// kenshi-mocchi-debug-check.js が見ていた内容をそのまま引き継いでいる
(async () => {
  console.log('--- ⑪ 染色(5部位・承認済みマスクが正本) ---');
  // 部位数は MASU_COLOR_REGION_HUES[id].length だけが決めている。
  // 本数が足りないと _exactDyeMaskRegion が返す④⑤に対応するマスクが無く、
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

  console.log('--- ⑫ デバッグ画面(モンスター画像・染色確認)からも見られること ---');
  // 正式実装後も、絵と染色の作り直しはこの画面から確かめる。
  // 候補は ALL_PLAYER_MONSTERS から作るので、debugOnly を弾く実装へ戻っていないかを見る
  check('染色マスク編集の候補を ALL_PLAYER_MONSTERS から作っている',
    source.includes('const makeDyeMaskEditorTargets = () => Object.values(ALL_PLAYER_MONSTERS).map(monster => ({'));
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
  // 顔アイコンは本番(BreederIcon)で MARKET_PROFILE_ICON_STYLES の拡大・位置調整が掛かる
  check('顔アイコンの枠へ本番と同じ拡大・位置調整を渡している',
    source.includes('const profileIconStyle=marketProfileIconStyle(')
    && (source.match(/renderCurrent\('(?:顔アイコン|プロフィール／選択アイコン)'[^)]*profileIconStyle/g) || []).length === 2);

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
