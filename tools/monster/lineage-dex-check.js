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
    monsterDexDescription, dexMonsterList, dexMainLineages, MONSTER_LINEAGES, MONSTER_LINEAGE_MAP,
    ALL_PLAYER_MONSTERS };`,
].join('\n'), ctx);
const A = ctx.api;
const monsters = A.dexMonsterList();
check('アーク種はアーク・イブリースとも聖光専用モーションを共有',
  A.ALL_PLAYER_MONSTERS.Ark?.atkMotion === 'arkHolyRain' && A.ALL_PLAYER_MONSTERS.Iblis?.atkMotion === 'arkHolyRain');

// ---------- ① 血統がすべて揃っている ----------
check('図鑑にモンスターが並ぶ', monsters.length > 0, `${monsters.length}体`);
check('図鑑全体の対象は20体', monsters.length === 20, `${monsters.length}体`);
// ---------- ①-2 図鑑は種族(主血統)順に並ぶ ----------
// 以前は ALL_PLAYER_MONSTERS の定義順そのままで、モンスターを足した順に並んでいたため
// 同じ種族が離れて出ていた(2026-09-08・ユーザー指摘「図鑑の全てが種族順になってない」)。
// 期待する並びを検査側へ書き写すと、モンスターを足すたびに検査だけが古くなるので、
// 「まとまっているか」「血統カタログの順か」を性質として確かめる
{
  const mains = monsters.map(mon => A.monsterLineageOf(mon.id).main?.id);
  // 同じ主血統が飛び飛びに出ていないか(いちど途切れた血統が後からまた出てこないか)
  const seen = new Set(); const scattered = [];
  let prev = null;
  for (const id of mains) {
    if (id !== prev && seen.has(id)) scattered.push(id);
    seen.add(id); prev = id;
  }
  check('同じ種族(主血統)がひとまとまりで並ぶ', scattered.length === 0,
    scattered.length ? `離れて出ている: ${[...new Set(scattered)].join(' / ')}` : `${seen.size}種族`);
  // 種族の並びは「ALL_PLAYER_MONSTERS でその種族が最初に出てくる順」。
  // 血統カタログ(MONSTER_LINEAGES)の定義順にすると、カタログではプラントが
  // dragon/joker より後ろに置かれているせいでプラント種だけが末尾へ動き、
  // 図鑑の絞り込みチップを使っている種族チャレンジの種族タブ・超越の実の並びまで
  // 巻き添えで変わってしまう(実測で確認)。図鑑だけを種族順にしたいので初出順を正とする
  const appeared = [...new Set(mains)];
  const firstSeen = [];
  for (const mon of Object.values(A.ALL_PLAYER_MONSTERS)) {
    if (!mon || mon.debugOnly) continue;
    const id = A.monsterLineageOf(mon.id).main?.id;
    if (id && !firstSeen.includes(id)) firstSeen.push(id);
  }
  check('種族の並びは、その種族が最初に出てくる順', JSON.stringify(appeared) === JSON.stringify(firstSeen),
    appeared.map(id => A.MONSTER_LINEAGES[id]?.name || id).join(' / '));
  // 血統の先頭は、その血統を代表するモンスター(カタログの monId)
  const badHead = [];
  for (const id of appeared) {
    const rep = A.MONSTER_LINEAGES[id]?.monId;
    if (!rep) continue; // 代表モンスターが居ない血統(ドラゴン・ジョーカー等)は対象外
    const head = monsters.find(mon => A.monsterLineageOf(mon.id).main?.id === id);
    if (head && head.id !== rep) badHead.push(`${A.MONSTER_LINEAGES[id].name}の先頭が${head.name}`);
  }
  check('種族の先頭はその種族を代表するモンスター', badHead.length === 0, badHead.join(' / '));
  // 絞り込みのチップは図鑑の並びから作るので、こちらも同じ順になる
  // 並べ替えで顔ぶれが変わっていないこと(落ちる・重複する・混ざる)。
  // 体数だけを見ていると、1体落ちて1体重複したときに気づけない
  const expected = Object.values(A.ALL_PLAYER_MONSTERS).filter(m => m && !m.debugOnly).map(m => m.id).sort();
  const got = monsters.map(m => m.id);
  check('並べ替えても顔ぶれが変わらない(落ちも重複もない)',
    got.length === new Set(got).size && JSON.stringify([...got].sort()) === JSON.stringify(expected),
    `${got.length}体 / 重複${got.length - new Set(got).size}件`);
  // 何度呼んでも同じ並びであること(呼ぶたびに変わると図鑑の番号や前後移動がぶれる)
  check('何度呼んでも同じ並びになる',
    JSON.stringify(A.dexMonsterList().map(m => m.id)) === JSON.stringify(got));
  const chips = A.dexMainLineages().map(l => l.id);
  check('血統の絞り込みチップも図鑑と同じ順に並ぶ', JSON.stringify(chips) === JSON.stringify(appeared),
    A.dexMainLineages().map(l => l.name).join(' / '));
  // このチップの並びは、種族チャレンジの種族タブと超越の実(アイテム欄)にも使われている。
  // 図鑑を並べ替えた巻き添えでそちらまで動いていないことを、ここで確かめる
  check('種族チャレンジのタブ・超越の実の並びを巻き添えにしていない',
    JSON.stringify(chips) === JSON.stringify(firstSeen));
}

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
// 居ないモンスターの血統を余分に持っていないか(綴り間違い・消し忘れ)。
// 正式実装前のモンスター(debugOnly)は図鑑には出ないが、デバッグ画面では血統を出すので
// 血統は先に用意してある。ここで見たいのは「そもそも定義が無いidを指していないか」なので、
// 図鑑の一覧ではなく ALL_PLAYER_MONSTERS そのものと突き合わせる
const definedIds = new Set(Object.keys(A.ALL_PLAYER_MONSTERS));
const extra = Object.keys(A.MONSTER_LINEAGE_MAP).filter(id => !definedIds.has(id));
check('存在しないモンスターの血統が残っていない', extra.length === 0, extra.join(' / '));
const debugOnlyIds = Object.values(A.ALL_PLAYER_MONSTERS).filter(mon => mon?.debugOnly).map(mon => mon.id);
console.log(`   正式実装前(debugOnly)で図鑑に出さないモンスター: ${debugOnlyIds.length ? debugOnlyIds.join(' / ') : 'なし'}`);
check('正式実装前のモンスターは図鑑へ出ていない',
  debugOnlyIds.every(id => !monsters.some(mon => mon.id === id)), debugOnlyIds.join(' / '));

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
// 攻撃アクションの確認は専用画面。図鑑一覧のブロックより前に置いてあるので、list/detail とは混ざらない
const attackPreview = slice("{gameState==='MONSTER_ATTACK_PREVIEW'&&(()=>{", "{gameState==='MONSTER_DEX'&&(()=>{");
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
// 立ち絵の上にボタンを重ねると絵が隠れるので、入口は枠の外に置き、再生は専用画面で行う
check('攻撃アクションのボタンは立ち絵の枠の外にあり、専用画面へ移る',
  detail.includes('data-dex-attack-preview')
  && detail.includes("setGameState('MONSTER_ATTACK_PREVIEW')")
  && !detail.slice(detail.indexOf('data-dex-art'), detail.indexOf('攻撃アクションの入口')).includes('data-dex-attack-preview')
  && !detail.includes('attackMotionPreviewSequence('));
check('未解放モンスターには攻撃アクションの入口を出さない',
  detail.includes('{unlocked&&<div className="shrink-0 px-3 pt-1 flex justify-center">')
  && attackPreview.includes('if(!mon||!unlockedMonsterIds.includes(mon.id)){ setGameState(\'MONSTER_DEX\'); return null; }'));
// 専用画面。上へ飛ぶ演出が枠外へ出ないよう縦を大きく取り、通常攻撃と固有技を選んで見比べられる
check('攻撃アクションの専用画面で通常攻撃と固有技を再生できる',
  attackPreview.includes("attackMotionPreviewSequence(atkMotion)")
  && attackPreview.includes("attackMotionUniquePreviewSequence(atkMotion)")
  && attackPreview.includes('data-attack-preview-play={kind}')
  && attackPreview.includes("kindButton('normal','通常攻撃'")
  && attackPreview.includes("kindButton('unique','固有技'"));
check('専用画面は本番と同じ描画部品を使い、立ち絵を下寄りに置いて上へ余白を残す',
  attackPreview.includes('<BattleAttackMotionPreview image={<DexMonsterArt mon={mon} alt={mon.name}/>} anim={previewAnim}/>')
  && /data-attack-preview-art[\s\S]{0,200}bottom:'1[0-9]%'/.test(attackPreview)
  && attackPreview.includes('data-attack-preview-stage'));
check('専用画面から図鑑の詳細へ戻れ、戻るときに再生を止める',
  /backToDetail=\(\)=>\{dexAttackPreviewRunRef\.current\+=1;setDexAttackPreview\(null\);setGameState\('MONSTER_DEX_DETAIL'\);\}/.test(attackPreview));
check('固有技のプレビューは本番と同じく共通のタメを先に入れる',
  source.includes('const attackMotionUniquePreviewSequence =')
  && /attackMotionUniquePreviewSequence[\s\S]{0,400}\{anim:\{charge:true\},ms:650\}/.test(source)
  && /attackMotionUniquePreviewSequence[\s\S]{0,600}anim:\{charge:false,motion,twinBlade:isTwin/.test(source));
check('左右移動と一覧へ戻る操作で途中の再生を止める',
  detail.includes('const stopDexAttackPreview=')
  && detail.includes('const go=(delta)=>{ stopDexAttackPreview();')
  && detail.includes("stopDexAttackPreview();setGameState('MONSTER_DEX')"));
check('図鑑プレビューは本番と同じモーション描画を使う',
  source.includes('const BattleAttackMotionPreview =')
  && source.includes("animation:attackMotionAnimation(anim)")
  && source.includes('anim?.sakura&&<EikiSakuraPetals/>')
  && source.includes("anim?.motion==='arkHolyRain'")
  && source.includes('<ArkHolyRainMotion image={image}')
  && source.includes("anim?.motion==='waterBurst'")
  && source.includes('<WaterBurstMotion image={image}')
  && source.includes("anim?.motion==='miaSongNotes'")
  && source.includes('<MiaSongNotesMotion image={image}')
  && source.includes("anim?.motion==='pandoraDualThunder'")
  && source.includes('<PandoraDualThunder image={image} compact={compact}/>'));
{
  const previewCtx={WATER_BURST_MOTION_MS:680,ARK_HOLY_RAIN_MOTION_MS:900,MIA_SONG_NOTES_MOTION_MS:760};
  vm.createContext(previewCtx);
  vm.runInContext(slice('const attackMotionPreviewSequence =', 'const rpgMotionName =')
    + '\nglobalThis.preview=attackMotionPreviewSequence;', previewCtx);
  const motionKinds=[...new Set(monsters.map(mon=>mon.atkMotion||'default'))];
  const brokenPreview=motionKinds.filter(motion=>{
    const seq=previewCtx.preview(motion);
    return !Array.isArray(seq)||!seq.length||seq.some(step=>!step?.anim||!(Number(step.ms)>0));
  });
  check('全モンスターの atkMotion が1回のプレビュー手順を作れる', brokenPreview.length===0,
    brokenPreview.join(' / '));
  check('図鑑プレビューは通常攻撃と同じく固有技用のタメを入れない',
    motionKinds.every(motion=>previewCtx.preview(motion).every(step=>step.anim?.charge!==true)));
  check('パンドラも専用分身モーションを図鑑で再生できる',
    previewCtx.preview('pandoraDualThunder').some(step=>step.anim?.motion==='pandoraDualThunder'));
}
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
