#!/usr/bin/env node
'use strict';
// 血統データとモンスター図鑑を確かめる。
//
//   node tools/monster/lineage-dex-check.js
//
// 【なぜ道具にするか】
// 血統は「モンスターを1体足したときに書き忘れる」形で欠ける。欠けても画面は
// ふつうに開いてしまい、その1体だけ血統が「？？？ × ？？？」になっていることに
// 気づけない。将来の血統限定モードでは参加判定にそのまま使うデータなので、
// 全モンスターぶん揃っていることを機械的に確かめる。
// 図鑑の画面も、全プレイヤーモンスターを順に開いて落ちないことをここで見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'docs/spec/MONSTER_SYSTEM.md'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from), j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// --- 実データと本体の引き方をそのまま動かす ---
const ctx = { console, Object, Array, Set, Map, String, Number };
vm.createContext(ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/lineages.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext([
  slice('const UNKNOWN_LINEAGE =', '// ==================== 総合力'),
  `globalThis.api = { monsterLineageOf, monsterCategoryOf, monsterCategoryName, lineageIconUrl,
    monsterDexDescription, dexMonsterList, dexMainLineages, MONSTER_LINEAGES, MONSTER_LINEAGE_MAP };`,
].join('\n'), ctx);
const A = ctx.api;
const monsters = A.dexMonsterList();

// ---------- ① 血統がすべて揃っている ----------
check('図鑑にモンスターが並ぶ', monsters.length > 0, `${monsters.length}体`);
check('図鑑全体の対象は18体', monsters.length === 18, `${monsters.length}体`);
const missing = monsters.filter(mon => !A.monsterLineageOf(mon.id).known).map(mon => mon.name);
check('全プレイヤーモンスターに血統が設定されている', missing.length === 0, missing.join(' / '));
const broken = monsters.filter(mon => {
  const { main, sub } = A.monsterLineageOf(mon.id);
  return !main || !sub || !main.name || !sub.name;
}).map(mon => mon.name);
check('主血統・副血統の欠損がない', broken.length === 0, broken.join(' / '));
// 血統カタログに無いidを指していないか(綴り間違いはここで出る)
const unknownRefs = Object.entries(A.MONSTER_LINEAGE_MAP).flatMap(([id, entry]) =>
  [entry.main, entry.sub].filter(key => !(key in A.MONSTER_LINEAGES)).map(key => `${id}:${key}`));
check('血統カタログに無い血統を指していない', unknownRefs.length === 0, unknownRefs.join(' / '));
// 図鑑に無いモンスターの血統を余分に持っていないか
const ids = new Set(monsters.map(mon => mon.id));
const extra = Object.keys(A.MONSTER_LINEAGE_MAP).filter(id => !ids.has(id));
check('存在しないモンスターの血統が残っていない', extra.length === 0, extra.join(' / '));

// ---------- ② 区分 ----------
check('モッチーは純血', A.monsterCategoryOf('Mocchi') === 'pure');
check('ミタラシは派生種', A.monsterCategoryOf('Mitarashi') === 'derived');
check('スネグーラチカはレア', A.monsterCategoryOf('Snegurochka') === 'rare');
check('？？？ 血統はレア扱いになる', A.monsterLineageOf('Snegurochka').sub.rare === true
  && A.monsterLineageOf('Snegurochka').sub.name === '？？？');
check('区分の名前が全モンスターで出せる',
  monsters.every(mon => ['純血','派生種','レア'].includes(A.monsterCategoryName(A.monsterCategoryOf(mon.id)))));
check('血統を書いていないモンスターでも落ちず ？？？ になる',
  A.monsterLineageOf('存在しないid').main.name === '？？？' && A.monsterCategoryOf('存在しないid') === 'rare');

// ---------- ③ 血統アイコン ----------
// プレイアブルなモンスターがいる血統だけ絵を使い、いない血統は絵を作らず名前で出す
const iconless = ['dragon', 'joker', 'gel', 'unknown'];
check('モンスターがいない血統は画像を持たない',
  iconless.every(id => !A.MONSTER_LINEAGES[id]?.monId && A.lineageIconUrl(A.MONSTER_LINEAGES[id]) === null));
check('モンスターがいる血統はアイコンを引ける',
  ['mocchi','undine','ark'].every(id => !!A.lineageIconUrl(A.MONSTER_LINEAGES[id])));

// ---------- ④ 図鑑説明 ----------
check('全プレイヤーモンスターに図鑑説明がある',
  monsters.every(mon => A.monsterDexDescription(mon.id).trim().length > 0
    && !A.monsterDexDescription(mon.id).includes('調査が進むと')));
check('Plantの図鑑説明が指定文どおり',
  A.monsterDexDescription('Plant') === '非力だが多彩な攻撃手段を持っている\nほかの地域と比べると、IMa地方のプラントは弱いと言われているようだ');
check('説明が未記入のモンスターでも空欄にならない',
  monsters.every(mon => A.monsterDexDescription(mon.id).trim().length > 0));

// ---------- ⑤ 絞り込み ----------
const filters = A.dexMainLineages();
check('主血統の絞り込みに重複が無い', new Set(filters.map(l => l.id)).size === filters.length);
check('どの主血統でしぼっても1体以上出る',
  filters.every(l => monsters.some(mon => A.monsterLineageOf(mon.id).main.id === l.id)));
check('主血統プラントの対象はPlantとOboro',
  JSON.stringify(monsters.filter(mon => A.monsterLineageOf(mon.id).main.id === 'plant').map(mon => mon.id).sort())
    === JSON.stringify(['Oboro', 'Plant']));

// ---------- ⑥ 図鑑の画面 ----------
const list = slice("{gameState==='MONSTER_DEX'&&(()=>{", "{gameState==='MONSTER_DEX_DETAIL'&&(()=>{");
const detail = slice("{gameState==='MONSTER_DEX_DETAIL'&&(()=>{", "{gameState==='AUTO_SETTINGS'&&(()=>{");
const sharedDex = slice('const DexMonsterIcon =', 'const MarketProductIcon =');
check('M/B管理のモンスターから図鑑へ入れる',
  source.includes("setGameState('MONSTER_DEX');") && source.includes('モンスター図鑑</button>'));
check('HOMEへ施設を増やしていない', !/mh-home-facility [a-z]*dex/.test(source));
check('図鑑登録数と全体数を出している', list.includes('data-dex-count') && list.includes('図鑑登録数'));
check('解放判定は既存の mh_unlocked_monsters を使う',
  list.includes('unlockedMonsterIds.includes(mon.id)') && detail.includes('unlockedMonsterIds.includes(mon.id)'));
check('図鑑のための保存キーを増やしていない', !/['"]mh_[^'"]*(?:dex|zukan)/i.test(source));
check('未解放はシルエットと ？？？ で出す',
  list.includes("'？？？'") && sharedDex.includes('brightness(0)') && detail.includes('hidden={!unlocked}'));
check('主血統でしぼりこめる', list.includes('dexLineageFilter') && list.includes('主血統でしぼりこむ'));
check('詳細に前後移動のボタンとスワイプがある',
  detail.includes('data-dex-prev') && detail.includes('data-dex-next')
  && detail.includes('onTouchStart') && detail.includes('onTouchEnd'));
check('詳細に名前・血統・区分・説明がある',
  detail.includes('data-dex-lineage') && detail.includes('data-dex-category') && detail.includes('data-dex-desc'));
check('基本・能力・技の3タブがある',
  detail.includes("['basic','基本'],['stats','能力'],['skills','技']")
  && detail.includes('data-dex-tab-basic') && detail.includes('data-dex-tab-stats') && detail.includes('data-dex-tab-skills'));
check('技は既存の技データから作る（図鑑用の写しを作らない）',
  detail.includes('getAtkSkillLevels(mon)') && detail.includes('getUniqueSkillLevels(mon)')
  && !/HERO_ATK_NAMES/.test(detail));
check('能力はベースモンの基礎値を出す',
  detail.includes('mon.baseHp') && detail.includes('mon.distAptitude') && !/masuPowerOf|normalizeMasuProgression/.test(detail));
check('基本タブは既存のモンスターデータから勇者特性を出す',
  detail.includes('mon.trait') && detail.includes('mon.traitDesc'));
check('スマホで押せる大きさ（40px以上）を確保している',
  (list.match(/min-h-\[(?:4\d|[5-9]\d|\d{3,})px\]/g) || []).length >= 2
  && (detail.match(/min-h-\[(?:4\d|[5-9]\d|\d{3,})px\]/g) || []).length >= 2);
// 文字数で表示位置が動かないこと。血統名(2文字〜6文字)や区分(2〜3文字)、説明文の行数が
// 変わるたびにラベル・×・タブ・表が左右上下へずれる、という形で実際に気になった箇所
check('血統の行は文字数で位置が動かない（左右のチップが同じ幅・端は固定）',
  detail.includes('data-dex-lineage-row')
  && detail.includes("gridTemplateColumns:'auto minmax(0,1fr) auto minmax(0,1fr) auto'")
  && !/血統の行[\s\S]{0,200}justify-center/.test(detail));
check('血統チップは枠いっぱいに広がる（中身の長さで幅が変わらない）',
  detail.includes('<DexLineageChip') && sharedDex.includes('data-dex-lineage className="flex w-full items-center justify-center'));
// 丸アイコンは円の内側へ収める。枠いっぱいに絵を入れると、円の外側へかかる部分が
// どのモンスターでも切れる(アークの冠と翼、ザンの腕、ゴーレムの肩が実際に切れていた)
check('血統チップのアイコンが円の内側へ収まる',
  detail.includes('<DexLineageChip') && sharedDex.includes('data-dex-lineage-icon') && /data-dex-lineage-icon[\s\S]{0,220}padding:'10%'/.test(sharedDex));
check('図鑑一覧のアイコンも円の内側へ収まる',
  list.includes('<DexMonsterIcon') && sharedDex.includes('data-dex-entry-icon') && /data-dex-entry-icon[\s\S]{0,220}padding:'10%'/.test(sharedDex));
check('区分バッジの幅を固定している', detail.includes('data-dex-category') && detail.includes('min-w-[42px]'));
check('説明文は行数が変わってもタブより下を動かさない',
  detail.includes('data-dex-desc') && detail.includes("height:'calc(1.625em * 3)'"));
// 立ち絵の大きさは枠で決める。元画像は160px四方と1024px四方が混ざっているので、
// 寸法を指定しないと小さい元画像だけそのままの大きさで表示され、
// モンスターごとに見た目が2倍近く変わる(ザンだけ極端に大きく見えた)
check('立ち絵は枠に合わせて縮尺する（元画像の解像度で大きさが変わらない）',
  detail.includes('data-dex-art')
  && detail.includes('<DexMonsterArt')
  && sharedDex.includes('className="w-full h-full object-contain"')
  && !detail.includes('max-w-full max-h-full'));
check('立ち絵の枠の高さを決めている', /data-dex-art[\s\S]{0,300}height:'clamp\(/.test(detail));
check('Safe Areaを避けている', list.includes('env(safe-area-inset-top)') && detail.includes('env(safe-area-inset-bottom)'));
check('横はみ出し対策(truncate/min-w-0/break-words)がある',
  detail.includes('truncate') && detail.includes('min-w-0') && detail.includes('break-words'));
// 全モンスターぶん、詳細で参照する値が取り出せる(画面が落ちないこと)
const dexSafe = monsters.filter(mon => {
  const { main, sub } = A.monsterLineageOf(mon.id);
  return main?.name && sub?.name && Array.isArray(mon.unique?.names) && mon.unique.names.length >= 9
    && Array.isArray(mon.distAptitude) && mon.distAptitude.length === 4 && !!mon.imgUrl;
});
check(`図鑑の詳細が全${monsters.length}体ぶん組み立てられる`, dexSafe.length === monsters.length,
  monsters.filter(m => !dexSafe.includes(m)).map(m => m.name).join(' / '));

// ---------- ⑦ 血統をマスモンへ二重保存していない ----------
check('マスモンの保存へ血統を書いていない',
  !/uniqueOrder[\s\S]{0,400}lineageMain|lineageMain\s*:|mainLineage\s*:/.test(source));
check('血統は種(baseId)から引く',
  slice('const monsterLineageOf =', 'const monsterCategoryOf').includes('lineageEntryMap()[monsterId]'));

// ---------- ⑧ 読み込みと案内 ----------
check('index.htmlが data/lineages.js を読み込んでいる',
  /<script src="data\/lineages\.js\?v=[0-9a-f]{12}"[^>]*><\/script>/.test(indexHtml));
check('ヘルプに図鑑と血統の項目がある', help.includes("id: 'monster-dex'") && help.includes('モンスター図鑑と血統'));
check('血統一覧はヘルプへ手書きせず実データから作る',
  help.includes("{ t:'data', id:'monsterLineages' }") && source.includes("case 'monsterLineages':"));
check('更新履歴に図鑑の追加が載っている', changelog.includes('モンスター図鑑'));
check('仕様書に血統と図鑑を書いてある', spec.includes('主血統') && spec.includes('モンスター図鑑'));
check('仕様書のモンスター数が実データと合っている',
  spec.includes(`${monsters.length}種`), `実データは${monsters.length}種`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
