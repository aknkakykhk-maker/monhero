// 「機能を足したのにヘルプに載っていない」を機械的に防ぐ。
//
// ゲームの実データ(画面・難易度・アイテム・ログインボーナス・ミッション・ブリーダーの教え)を
// ヘルプが取りこぼしていないかを見る。取りこぼしがあれば、どれが足りないかを名指しで出す。
//
//   ① すべての画面(gameState)が HELP_SCREEN_COVERAGE に載っていて、
//      指す先のヘルプ項目が実在する(対象外にするときは null を明示する)
//   ② 難易度・アイテム・ログインボーナス・ミッション・教えは、手書きせず
//      t:'data' で実データから表を作っている(= 一部しか載っていない状態にならない)
//   ③ helpDataRows() が実データの件数ぶんを返す
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- ヘルプのデータ ---
const helpCtx = {};
vm.createContext(helpCtx);
vm.runInContext(`${helpSrc}\nglobalThis.__h={HELP_CATEGORIES,HELP_SCREEN_COVERAGE,helpFindTopic};`, helpCtx);
const { HELP_CATEGORIES: categories, HELP_SCREEN_COVERAGE: coverage, helpFindTopic } = helpCtx.__h;

// --- ゲーム側の実データ ---
const gameCtx = {};
vm.createContext(gameCtx);
vm.runInContext([
  breeder.slice(breeder.indexOf('const TEACHING_CARDS = [')).replace(/\b[A-Z_]+_(?:ICON|IMG)\b|\bDISC_STONE_BASE\b/g, "''"),
  grab(source, 'const LOGIN_BONUS_REWARDS = [', 'const LOGIN_BONUS_DEFAULT'),
  grab(source, 'const MISSION_DEFS = {', 'const missionDailyPeriod'),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  grab(source, 'const giftRewardText = ', 'const giftTitleDisplay'),
  grab(source, 'const helpDataRows = (id)', '// ===== 助手(ナビゲーター) ここから ====='),
  "const SKIP_TICKETS = SKIP_TICKET_BY_DIFFICULTY;",
  'globalThis.__g={helpDataRows,HELP_DATA_TITLES,DIFFICULTY_SETTINGS,LOGIN_BONUS_REWARDS,MISSION_DEFS,TEACHING_CARDS,BREEDER_MARKET_ITEMS,SKIP_TICKET_BY_DIFFICULTY};',
].join('\n'), gameCtx);
const g = gameCtx.__g;

// --- ① 画面のカバレッジ ---
const screens = [...new Set([...source.matchAll(/gameState==='([A-Z_]+)'/g)].map(m => m[1]))].sort();
const missing = screens.filter(name => !(name in coverage));
check('すべての画面がヘルプのどの項目で説明されるか決まっている', missing.length === 0,
  missing.length ? `ヘルプ未対応: ${missing.join(', ')} → data/help.js の HELP_SCREEN_COVERAGE に追加してください` : `${screens.length}画面`);

const badRefs = Object.entries(coverage).filter(([, ref]) => {
  if (ref === null) return false;
  if (typeof ref !== 'string' || !ref.includes('/')) return true;
  const [catId, topicId] = ref.split('/');
  return !helpFindTopic(catId, topicId);
});
check('指し先のヘルプ項目が実在する', badRefs.length === 0, badRefs.map(([k, v]) => `${k}→${v}`).join(', '));

const staleScreens = Object.keys(coverage).filter(name => !screens.includes(name));
check('もう無い画面が対応表に残っていない', staleScreens.length === 0, staleScreens.join(', '));

const covered = Object.entries(coverage).filter(([, v]) => v !== null);
check('対象外にした画面は開発用と別担当のものだけ',
  // 対象外にしてよいのは、デバッグ設定からだけ入れて通常プレイに一切現れない画面と、別担当のTRAINING_*。
  // RPG_DEBUG_* は将来のダンジョンRPGの戦闘だけを先に試す試作で、正式コンテンツ化するときに
  // ここから外してヘルプ項目を作る。プレイヤーが到達できる画面は今までどおり必ず説明が要る。
  Object.entries(coverage).filter(([, v]) => v === null).every(([k]) => k === 'DEBUG_SETTINGS' || k === 'EXTREME_DEBUG_DIFFICULTY_SELECT' || k === 'SPECIES_CHALLENGE_DEBUG' || k === 'SPECIES_CHALLENGE_SELECT' || k.startsWith('TRAINING_') || k.startsWith('RPG_DEBUG_')),
  `説明あり${covered.length} / 対象外${Object.keys(coverage).length - covered.length}`);

// --- ② 一覧は実データから作る ---
const blocks = categories.flatMap(c => c.topics.flatMap(t => t.blocks.map(b => ({ ...b, at: `${c.id}/${t.id}` }))));
const dataIds = blocks.filter(b => b.t === 'data').map(b => b.id);
for (const id of ['difficulties', 'teachings', 'skipTickets', 'items', 'loginBonus', 'missionsDaily', 'missionsWeekly']) {
  check(`${g.HELP_DATA_TITLES[id]}は実データから表を作っている`, dataIds.includes(id), dataIds.includes(id) ? '' : `data/help.js に { t:'data', id:'${id}' } がありません`);
}
check('使っているデータ表のidがすべて実在する', dataIds.every(id => id in g.HELP_DATA_TITLES), dataIds.filter(id => !(id in g.HELP_DATA_TITLES)).join(', '));

// --- ③ 件数が実データと一致する ---
const rowCount = (id) => g.helpDataRows(id).length;
check('難易度は9段階すべて出る', rowCount('difficulties') === Object.keys(g.DIFFICULTY_SETTINGS).length, `${rowCount('difficulties')}件 / 実データ${Object.keys(g.DIFFICULTY_SETTINGS).length}件`);
check('ブリーダーの教えは全種類出る', rowCount('teachings') === g.TEACHING_CARDS.length, `${rowCount('teachings')}件`);
check('スキップチケットは3種すべて出る', rowCount('skipTickets') === Object.keys(g.SKIP_TICKET_BY_DIFFICULTY).length, `${rowCount('skipTickets')}件`);
const plainItems = g.BREEDER_MARKET_ITEMS.filter(i => i.type === 'item' && !Object.values(g.SKIP_TICKET_BY_DIFFICULTY).includes(i.id));
check('スキップ以外のアイテムも全種類出る', rowCount('items') === plainItems.length, `${rowCount('items')}件 / 実データ${plainItems.length}件`);
check('ログインボーナスは7日ぶん出る', rowCount('loginBonus') === g.LOGIN_BONUS_REWARDS.length, `${rowCount('loginBonus')}件`);
check('デイリーミッションは全件出る', rowCount('missionsDaily') === g.MISSION_DEFS.daily.length, `${rowCount('missionsDaily')}件`);
check('ウィークリーミッションは全件出る', rowCount('missionsWeekly') === g.MISSION_DEFS.weekly.length, `${rowCount('missionsWeekly')}件`);

// 中身も実データの値をそのまま出しているか(Masterなど、以前は載っていなかった難易度で確かめる)
const master = g.helpDataRows('difficulties').find(r => r[0] === 'Master');
check('難易度の倍率が実データそのまま', !!master && master[1] === `敵×${g.DIFFICULTY_SETTINGS.Master.power} ／ スコア×${g.DIFFICULTY_SETTINGS.Master.score} ／ ダイヤ×${g.DIFFICULTY_SETTINGS.Master.gold}`, master ? master.join(': ') : 'Masterが無い');
check('難易度の表に手書きの倍率が残っていない', !helpSrc.includes('敵1.5倍') && !helpSrc.includes('基準(倍率1.0)'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
