#!/usr/bin/env node
// ウンディーネ／ヤオビクニ(スネグーラチカと同系統の人魚)の実装を確認する。
//   ① 指定どおりのステータス・合流ボーナス・距離適性
//   ② 通常技9段階・固有技9段階の名前、固有技の初期倍率2.2・基礎消費44
//   ③ 専用モーション waterBurst、勇者特性「氷海の支配者」、固有効果「絶氷の楔」を共有している
//   ④ マーケット6商品(本人アイコン1pt/円盤石アイコン1pt/解放用円盤石1500pt)
//   ⑤ アイコンは画像を複製せず scale/x/y で寄せている
//   ⑥ 3色染色の部位定義がある
//   ⑦ スネグーラチカの性能・見た目に手を入れていない
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('monster-hero/src/game-system.jsx');
const breederSrc = read('monster-hero/data/breeder.js');
const imagesSrc = read('monster-hero/data/images/images-ally.js');
const help = read('monster-hero/data/help.js');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- データはそのまま読み込んで確かめる ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/images/images-enemy.js'),
  read('monster-hero/data/ally-monsters.js'),
  read('monster-hero/data/breeder.js'),
  'globalThis.__d={ALL_PLAYER_MONSTERS,HERO_ATK_NAMES,BREEDER_MARKET_ITEMS};',
].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS: mons, HERO_ATK_NAMES: atkNames, BREEDER_MARKET_ITEMS: market } = ctx.__d;

const SPEC = {
  Undine: {
    name: 'ウンディーネ', hp: 350, guts: 170, atk: 160, def: 50,
    apt: ['G', 'D', 'C', 'C'], plus: { hp: 100, atk: 45, def: 0, guts: 60 },
  },
  Yaobikuni: {
    name: 'ヤオビクニ', hp: 450, guts: 125, atk: 125, def: 105,
    apt: ['D', 'B', 'E', 'C'], plus: { hp: 150, atk: 30, def: 30, guts: 30 },
  },
};
const NORMAL_SKILLS = ['アイスブレード', 'アクアウィップ', 'アクアウェイブ', 'スプラッシュ', '超アイスブレード', '超アクアウィップ', 'ドルフィンブロー', 'ブラッドミスト', 'アクアゲイザー'];
const UNIQUE_SKILLS = ['アイスアロー', 'ダブルバレッド', 'アイスコフィン', 'アクアキッス', 'クリスタルアロー', 'アクアブラスト', 'ホワイトエレジー', 'アクアドーム', 'オーシャンノヴァ'];

for (const [id, spec] of Object.entries(SPEC)) {
  const m = mons[id];
  check(`${spec.name}が登録されている`, !!m && m.name === spec.name);
  if (!m) continue;
  check(`${spec.name}のステータス`, m.baseHp === spec.hp && m.baseGuts === spec.guts && m.baseAtk === spec.atk && m.baseDef === spec.def,
    `HP${m.baseHp}/G${m.baseGuts}/ATK${m.baseAtk}/DEF${m.baseDef}`);
  check(`${spec.name}の距離適性`, JSON.stringify(m.distAptitude) === JSON.stringify(spec.apt), m.distAptitude.join(','));
  check(`${spec.name}の合流ボーナス`, JSON.stringify(m.plusStats) === JSON.stringify(spec.plus), JSON.stringify(m.plusStats));
  check(`${spec.name}の通常技9段階`, JSON.stringify(atkNames[id]) === JSON.stringify(NORMAL_SKILLS), (atkNames[id] || []).join('/'));
  check(`${spec.name}の固有技9段階`, JSON.stringify(m.unique.names) === JSON.stringify(UNIQUE_SKILLS), m.unique.names.join('/'));
  check(`${spec.name}の固有技は倍率2.2・消費44`, m.unique.baseMult === 2.2 && m.unique.baseGuts === 44);
  check(`${spec.name}は専用モーション waterBurst`, m.atkMotion === 'waterBurst');
  check(`${spec.name}の勇者特性は氷海の支配者`, m.trait === '氷海の支配者');
  check(`${spec.name}の勇者特性説明`, m.traitDesc === '勇者モン選択時：絶氷の楔発動中かつ敵と同じ距離の場合、自動ガッツ回復率+50%（上限100%）');
  check(`${spec.name}の固有効果は絶氷の楔`, /絶氷の楔/.test(m.unique.effectDesc) && /30%減少/.test(m.unique.effectDesc) && /消費ガッツ3%減/.test(m.unique.effectDesc));
  check(`${spec.name}の固有技IDが自分を指す`, m.unique.monId === id);
}

// --- ③ 絶氷の楔・氷海の支配者はスネグーラチカと実装を共有する ---
check('絶氷の楔を持つ人魚を1か所のID一覧で持つ',
  source.includes("const ICE_LOCK_MONSTER_IDS = Object.freeze(['Snegurochka', 'Undine', 'Yaobikuni'])")
    && source.includes('isIceLockMonster(heroId)') && source.includes('isIceLockMonster(card.monId)')
    && source.includes('&& iceLockActive') && source.includes('&& heroDist===enemyDist'));
check('絶氷の楔の実処理を増やしていない(共有のまま)', (source.match(/iceLockTurns:5/g) || []).length === 1);

// --- ④ マーケット6商品 ---
const item = (id) => market.find(i => i.id === id);
const expectItems = [
  ['undine_icon', 'icon', 1, 'ウンディーネのアイコン'],
  ['undine_disc_icon', 'icon', 1, 'ウンディーネの円盤石アイコン'],
  ['Undine', 'disc', 1500, 'ウンディーネの円盤石'],
  ['yaobikuni_icon', 'icon', 1, 'ヤオビクニのアイコン'],
  ['yaobikuni_disc_icon', 'icon', 1, 'ヤオビクニの円盤石アイコン'],
  ['Yaobikuni', 'disc', 1500, 'ヤオビクニの円盤石'],
];
for (const [id, type, cost, name] of expectItems) {
  const it = item(id);
  check(`マーケット商品 ${id}`, !!it && it.type === type && it.cost === cost && it.name === name,
    it ? `${it.name} / ${it.type} / ${it.cost}` : '見つかりません');
}
check('今回追加したマーケット商品は6件', expectItems.filter(([id]) => item(id)).length === 6);
check('円盤石のidは解放するモンスターのidと同じ', !!mons[item('Undine').id] && !!mons[item('Yaobikuni').id]);

// --- ⑤ 画像は複製せず、表示側で寄せる ---
check('立ち絵はいただいた画像をそのまま使う',
  /const UNDINE_IMG = "images\/monsters\/undine\.PNG(\?v=[a-f0-9]{12})?"/.test(imagesSrc)
    && /const YAOBIKUNI_IMG = "images\/monsters\/yaobikuni\.PNG(\?v=[a-f0-9]{12})?"/.test(imagesSrc));
check('一覧・顔アイコンも同じ画像を使い回す(用途別に複製しない)',
  imagesSrc.includes('const UNDINE_ICON = UNDINE_IMG;') && imagesSrc.includes('const UNDINE_FACE_ICON = UNDINE_IMG;')
    && imagesSrc.includes('const YAOBIKUNI_ICON = YAOBIKUNI_IMG;') && imagesSrc.includes('const YAOBIKUNI_FACE_ICON = YAOBIKUNI_IMG;'));
check('円盤石の画像はいただいたものをそのまま使う',
  /const UNDINE_DISC_ICON = "images\/disc-icons\/undine-disc\.PNG(\?v=[a-f0-9]{12})?"/.test(breederSrc)
    && /const YAOBIKUNI_DISC_ICON = "images\/disc-icons\/yaobikuni-disc\.PNG(\?v=[a-f0-9]{12})?"/.test(breederSrc));
for (const id of ['undine_icon', 'undine_disc_icon', 'yaobikuni_icon', 'yaobikuni_disc_icon']) {
  check(`${id} は丸い枠での見え方を scale/x/y で合わせている`, new RegExp(`${id}: \\{ scale: [\\d.]+, x: -?[\\d.]+, y: -?[\\d.]+ \\}`).test(source));
}
// 立ち絵が縦長なので、丸枠(正方形)では object-cover のままだと頭と尾びれが切れる
check('縦長の立ち絵は丸枠で object-contain にして全身を収める',
  /const MONSTER_ART_CONTAIN_IDS = Object\.freeze\(\['Undine', 'Yaobikuni'\]\)/.test(source)
    && source.includes("objectFit: 'contain'") && source.includes('monsterArtFitStyle(baseId, rawStyle)'));
// object-contain にすると絵の左右に余白ができる。マスクだけ枠いっぱい(100% 100%)に伸ばすと
// 部位が横へずれて別の場所が染まるので、マスクの収め方も絵と同じ contain・中央・繰り返しなしにそろえる
check('部位マスクの収め方を絵の収め方に合わせている',
  source.includes("const monsterArtMaskSize = (baseId)") && source.includes("? 'contain' : '100% 100%'")
    && source.includes('WebkitMaskSize:monsterArtMaskSize(baseId), maskSize:monsterArtMaskSize(baseId)')
    && source.includes("WebkitMaskPosition:'center', maskPosition:'center'")
    && source.includes("WebkitMaskRepeat:'no-repeat', maskRepeat:'no-repeat'"));
// 参照している画像が実在すること
for (const rel of ['monster-hero/images/monsters/undine.PNG', 'monster-hero/images/monsters/yaobikuni.PNG',
  'monster-hero/images/disc-icons/undine-disc.PNG', 'monster-hero/images/disc-icons/yaobikuni-disc.PNG']) {
  check(`${rel} が存在する`, fs.existsSync(path.join(root, rel)));
}

// --- ⑥ 3色染色 ---
for (const id of ['Undine', 'Yaobikuni']) {
  const start = source.indexOf(`  ${id}: [`, source.indexOf('const MASU_COLOR_REGION_HUES'));
  const block = start < 0 ? '' : source.slice(start, source.indexOf('\n  ],', start));
  // 1部位は「1つの定義」または「複数の判定をまとめた配列」なので、行頭のインデントで数える
  check(`${id}の染色は3部位`, (block.match(/^ {4}[[{]/gm) || []).length === 3, block ? '' : '定義が見つかりません');
  // 瞳は髪と同系色なので染色①から位置(notBbox)で外し、肌は指定された染色枠へ分けている
  const upper = id === 'Undine' ? 'UNDINE' : 'YAOBIKUNI';
  check(`${id}は目を染めない(左右の目をnotBboxで除外)`,
    new RegExp(`const ${upper}_EYE_BOXES = \\[\\[[\\d., ]+\\], \\[[\\d., ]+\\]\\];`).test(source)
      && block.includes(`${upper}_EYE_BOXES`));
}
check('ウンディーネの染色②は肌(顔・腕・尻尾)',
  source.includes('ウンディーネ: 髪(染色①)/肌(顔・腕・尻尾、染色②)/白い衣装(染色③)'));
check('ヤオビクニは保存済み3色マスクを染色に使う',
  source.includes("baseId === 'Yaobikuni'") && source.includes('YAOBIKUNI_DYE_MASK'));
check('notBboxは染色エンジン側で効いている', source.includes('const _defExcluded = (def, nx, ny)') && (source.match(/_defExcluded\(def, nx, ny\)/g) || []).length >= 4);
check('ヘルプに2体の染色部位を書いている', help.includes('ウンディーネの染色部位') && help.includes('ヤオビクニの染色部位'));

// --- ⑦ スネグーラチカに手を入れていない ---
const sneg = mons.Snegurochka;
check('スネグーラチカの性能は変えていない',
  sneg.baseHp === 400 && sneg.baseGuts === 150 && sneg.baseAtk === 135 && sneg.baseDef === 80
    && JSON.stringify(sneg.distAptitude) === JSON.stringify(['D', 'E', 'B', 'A'])
    && JSON.stringify(sneg.plusStats) === JSON.stringify({ hp: 150, atk: 40, def: 10, guts: 40 }));
check('スネグーラチカの固有技名は変えていない', sneg.unique.names[3] === 'プレゼントキッス' && sneg.unique.names[8] === 'メリークリスマス');
check('スネグーラチカの画像・アイコン調整は変えていない',
  imagesSrc.includes('const SNEGUROCHKA_ICON = SNEGUROCHKA_IMG;')
    && source.includes('snegurochka_icon: { scale: 4.28, x: 11, y: 111 }'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
