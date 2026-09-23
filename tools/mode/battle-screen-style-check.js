// バトル画面3択の保存・設定画面・タクティクス旧新UI描画の接続を固定する回帰検査。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = read('monster-hero/src/parts/10-core.jsx');
const settings = read('monster-hero/src/parts/51-screen-settings.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  if (!ok) failed++;
};

check('3種類の画面設定を定義',
  core.includes("const BATTLE_SCREEN_STYLES = ['CLASSIC', 'TACTICS_OLD', 'TACTICS_NEW'];"));
check('未保存・不正値は新タクティクスUI',
  core.includes("BATTLE_SCREEN_STYLES.includes(String(value)) ? String(value) : 'TACTICS_NEW'"));
check('専用の新規保存キー',
  core.includes("const BATTLE_SCREEN_STYLE_KEY = 'mh_battle_screen_style_v1';"));
check('設定画面に3択を表示',
  settings.includes('BATTLE_SCREEN_STYLE_LABELS.map') &&
  settings.includes('battleScreenStyle') &&
  settings.includes('onChangeBattleScreenStyle'));
check('起動時に保存値を読み込み',
  app.includes("storeGet(BATTLE_SCREEN_STYLE_KEY, 'TACTICS_NEW', false)"));
check('変更時に保存',
  app.includes('storeSet(BATTLE_SCREEN_STYLE_KEY, value, false)'));
check('設定画面へ値と変更関数を渡す',
  app.includes('battleScreenStyle={battleScreenStyle}') &&
  app.includes('onChangeBattleScreenStyle={setBattleScreenStyle}'));
check('BattleScreenへ表示設定を渡す',
  app.includes("battleScreenActive={gameState==='BATTLE'} battleScreenStyle={battleScreenStyle}"));
check('新UIはタクティクス盤面かつTACTICS_NEWだけ',
  battle.includes("const tacticsNewLayout = Array.isArray(tacticsUnits) && normalizeBattleScreenStyle(battleScreenStyle) === 'TACTICS_NEW';"));
check('旧デバッグ用レイアウト名を残さない',
  !battle.includes('tacticsDebugLayout'));
check('タクティクス戦闘ロジックの盤面受け渡しを維持',
  app.includes('tacticsUnits={isTacticsMode(runMode)?tacticsUnits:null}') &&
  app.includes('tacticsCanAssign={tacticsCanAssign}'));

if (failed) {
  console.error(`battle screen style check failed: ${failed}`);
  process.exit(1);
}
console.log('battle screen style check passed');
