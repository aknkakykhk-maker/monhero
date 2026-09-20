const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンヒロバトルの入口(BATTLE_SYSTEM_SELECT)を確かめる。
//
//   node tools/battle/battle-system-select-check.js
//
// 2026-09-20 ユーザー指示で、モード選択の1つ上に画面を増やした。
//   モンヒロバトル → どのバトルで遊ぶか → モード選択 → 難易度選択
//   クイックだけは中のモードが1つなので、選んだらそのまま難易度選択へ進む
//
// 【見ているもの】
// ・仕組みの定義(BATTLE_SYSTEMS)と、そこへ属するモードの対応
// ・公開フラグで出し入れできること(新モードは公開前、プロはデバッグだけ)
// ・画面と導線の結線。モード選択のカルーセルが「選んだ仕組みのモードだけ」を並べること
// ・ヘルプ(HELP_SCREEN_COVERAGE)と助手のひとことが付いていること
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GAME_SYSTEM } = require(path.join(TOOLS_DIR, 'harness'));
const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(GAME_SYSTEM, 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'monster-hero/src/parts/69-screen-home.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  if (i < 0) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  const j = source.indexOf(to, i);
  if (j <= i) { console.log(`NG: 終わりが見つかりません（${to}）`); process.exit(1); }
  return source.slice(i, j);
};

// ===== 定義を本体から切り出して動かす =====
// 公開フラグは差し替えて試すので、定数はサンドボックスへ与える側で持つ
const body = slice('const BATTLE_SYSTEM_CLASSIC =', '// 極限チャレンジは通常の3モードとは別に');
const run = (flags) => {
  const sandbox = { Object, ...flags };
  vm.createContext(sandbox);
  vm.runInContext(`${body};globalThis.api={BATTLE_SYSTEMS,battleSystemOf,battleSystemModes,visibleBattleSystems,battleSystemComingSoon,`
    + 'BATTLE_SYSTEM_CLASSIC,BATTLE_SYSTEM_TACTICS,BATTLE_SYSTEM_QUICK};', sandbox);
  return sandbox.api;
};
const MODE_IDS = {
  BATTLE_MODE_CHALLENGE: 'challenge', BATTLE_MODE_QUICK: 'quick',
  BATTLE_MODE_SPECIES_CHALLENGE: 'speciesChallenge', BATTLE_MODE_TACTICS: 'tactics',
  BATTLE_MODE_TACTICS_SPECIES: 'tacticsSpecies', BATTLE_MODE_TACTICS_PRO: 'tacticsPro',
  BATTLE_MODE_PRO: 'pro',
};
// 盤面がタクティクス側のモードかどうか。本体と同じ並びを検査からも渡す
MODE_IDS.isTacticsMode = (mode) => [MODE_IDS.BATTLE_MODE_TACTICS,
  MODE_IDS.BATTLE_MODE_TACTICS_SPECIES, MODE_IDS.BATTLE_MODE_TACTICS_PRO].includes(mode);
const api = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: false });

// ===== ① 仕組みの定義 =====
check('仕組みは3つ（クラシック / タクティクス / クイック）', api.BATTLE_SYSTEMS.length === 3,
  api.BATTLE_SYSTEMS.map(s => s.label).join(' / '));
check('どの仕組みにも中身のモードがある',
  api.BATTLE_SYSTEMS.every(s => Array.isArray(s.modes) && s.modes.length > 0));
check('クイックだけが「そのまま難易度へ」',
  api.BATTLE_SYSTEMS.filter(s => s.direct).map(s => s.id).join(',') === api.BATTLE_SYSTEM_QUICK,
  api.BATTLE_SYSTEMS.filter(s => s.direct).map(s => s.id).join(',') || 'なし');
check('同じモードが2つの仕組みに入っていない', (() => {
  const all = api.BATTLE_SYSTEMS.flatMap(s => s.modes);
  return new Set(all).size === all.length;
})());
check('クイックは「これまでのバトル」から外れている',
  !api.BATTLE_SYSTEMS.find(s => s.id === api.BATTLE_SYSTEM_CLASSIC).modes.includes('quick'));
check('モードから仕組みを引ける',
  api.battleSystemOf('challenge').id === api.BATTLE_SYSTEM_CLASSIC
    && api.battleSystemOf('quick').id === api.BATTLE_SYSTEM_QUICK
    && api.battleSystemOf('tactics').id === api.BATTLE_SYSTEM_TACTICS);
check('知らないモードは「これまでのバトル」へ寄せる',
  api.battleSystemOf('しらないid').id === api.BATTLE_SYSTEM_CLASSIC);

// ===== ② 公開フラグで出し入れできる =====
const beforeRelease = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: false });
// ★2026-09-20 ユーザー指示で、公開前でも「準備中」の枠として並べるようにした
//   (モンヒロビートの準備中と同じ扱い。押せないだけで、場所は取っておく)
check('新モードは公開前でも「準備中」の枠として並ぶ',
  beforeRelease.visibleBattleSystems().some(s => s.id === beforeRelease.BATTLE_SYSTEM_TACTICS),
  beforeRelease.visibleBattleSystems().map(s => s.label).join(' / '));
check('公開前は「準備中」の印が付く',
  beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_TACTICS) === true);
check('デバッグからは準備中にならない(遊べる)',
  beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_TACTICS, { debugBattle: true }) === false
    && beforeRelease.battleSystemModes(beforeRelease.BATTLE_SYSTEM_TACTICS, { debugBattle: true }).length > 0);
check('準備中になるのは新モードだけ',
  !beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_CLASSIC)
    && !beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_QUICK));
check('クイックの上に並ぶ', (() => {
  const ids = beforeRelease.visibleBattleSystems().map(s => s.id);
  return ids.indexOf(beforeRelease.BATTLE_SYSTEM_TACTICS) < ids.indexOf(beforeRelease.BATTLE_SYSTEM_QUICK);
})(), beforeRelease.visibleBattleSystems().map(s => s.label).join(' → '));
const afterRelease = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: true });
check('公開フラグを立てると、準備中が外れて遊べるようになる',
  afterRelease.visibleBattleSystems().some(s => s.id === afterRelease.BATTLE_SYSTEM_TACTICS)
    && afterRelease.battleSystemComingSoon(afterRelease.BATTLE_SYSTEM_TACTICS) === false);
check('種族チャレンジは公開前だと中身から外れる', (() => {
  const hidden = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: false, TACTICS_MODE_PUBLIC_RELEASE: false });
  return !hidden.battleSystemModes(hidden.BATTLE_SYSTEM_CLASSIC).includes('speciesChallenge');
})());
// ★仕組みを足しただけで、モードの出し入れは変えていない。プロは今までどおり本番にも並ぶ
check('プロモードは今までどおり本番のモード選択に並ぶ',
  api.battleSystemModes(api.BATTLE_SYSTEM_CLASSIC).includes('pro'));

// ===== ③ 画面と導線の結線 =====
check('仕組みを選ぶ画面がある', has("{gameState==='BATTLE_SYSTEM_SELECT'&&(()=>{"));
check('HOMEの入口は仕組みの画面へ入る', has('onOpenBattle={openBattleSystemSelect}'));
check('HOMEのボタンは正式名称', home.includes('aria-label="モンヒロバトル"') && home.includes('モンヒロバトル</span>'));
check('カードに検査の手がかりがある', has('data-battle-system={sys.id}') && has('data-battle-systems={systems.length}'));
check('準備中のカードは押せない',
  has("const soon=battleSystemComingSoon(sys.id,{debugBattle});")
    && has('disabled={soon}')
    && has("data-battle-system-soon={soon?'1':undefined}")
    && has('if (battleSystemComingSoon(system.id, { debugBattle })) return; // 準備中は枠だけ'));
check('準備中と分かる書き方をしている',
  has('準備中</span>') && has("aria-label={soon?`${sys.label}（準備中）`:sys.label}"));
check('「そのまま難易度へ」の仕組みは難易度選択へ飛ぶ',
  has('if (system.direct) {') && has("setGameState('BATTLE_DIFFICULTY_SELECT');"));
check('モード選択は「選んだ仕組みのモードだけ」を並べる',
  (source.match(/const modes=battleSystemModes\(battleSystem,\{debugBattle\}\)\.map\(id=>battleModeInfo\(id\)\);/g) || []).length === 2,
  '描画と初期位置の2か所');
check('モード選択の戻るは仕組みの画面へ',
  has("setGameState('BATTLE_SYSTEM_SELECT');}}"));
check('選んだ仕組みは保存しない', !source.includes("mh_battle_system") && !source.includes("'mh_system"));
// ★「そのまま難易度へ」で入ったモードは、戻る先もモード選択ではなく入口。
//   モード選択へ戻すと、そのモード1つだけが並ぶ画面が出てしまう(2026-09-20 に検査が見つけた)
check('そのまま難易度へ入ったときは、戻ると入口に帰る',
  has("battleSystemOf(battleMode).direct?'BATTLE_SYSTEM_SELECT':'BATTLE_MODE_SELECT'"));

// ===== ④ ヘルプと助手 =====
check('画面がヘルプの対応表にある', help.includes("BATTLE_SYSTEM_SELECT:     'basics/battle-modes',"));
check('助手のひとことが付いている', has('<AssistantBubble scene="battleSystemSelect" compact/>'));
check('助手の場面が定義してある', assistants.includes('battleSystemSelect: {'));
check('助手4人ぶんのセリフがある',
  ['battleSystemSelectGuide', 'battleSystemSelectGuideKiki', 'battleSystemSelectGuideMomosuke', 'battleSystemSelectGuideDra']
    .every(id => assistants.includes(`id: '${id}'`)));
check('ヘルプの本文が新しい入口を説明している',
  help.includes('HOMEの「モンヒロバトル」を開くと、まず「どのバトルで遊ぶか」を選びます'));
// ★名前は定義が正本。ヘルプや更新履歴へ書き写した名前が古くなっていないか見る
const labelOf = (id) => (api.BATTLE_SYSTEMS.find(s => s.id === id) || {}).label || '';
check('ヘルプがいまの名前で書いてある', help.includes(labelOf(api.BATTLE_SYSTEM_CLASSIC)),
  labelOf(api.BATTLE_SYSTEM_CLASSIC));
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
check('更新履歴がいまの名前で書いてある',
  changelog.includes(labelOf(api.BATTLE_SYSTEM_CLASSIC)) && changelog.includes(labelOf(api.BATTLE_SYSTEM_TACTICS)),
  `${labelOf(api.BATTLE_SYSTEM_CLASSIC)} / ${labelOf(api.BATTLE_SYSTEM_TACTICS)}`);
check('仮の名前が残っていない',
  !source.includes("label: 'これまでのバトル'") && !source.includes("label:'戦術モード'"));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
