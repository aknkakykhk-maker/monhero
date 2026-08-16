// ラン終了画面(CHAMPION/敗北/リタイア)の「マスモンとして登録」に、
// ちゃんとたどり着けるかを確認する。
//
//   node tools/masu-register-check.js
//
// 【背景】
// 1WAVE以上クリアしていれば、途中で諦めてもマスモンとして登録できる仕様。
// ところが結果画面の中央のスクロール領域が justify-center だったため、
// 中身があふれると上側がスクロールで届かなくなり、獲得内訳が長いときは
// 登録の案内が画面の外に出たまま気づけなかった。
// (flexのjustify-centerは、あふれたぶんを上下へはみ出させる。スクロールでは
//  下側しか追えないので、上側は永久に見られない)
// 内側の入れ物へ m-auto を付ける形にすると、余っているときだけ中央へ寄り、
// あふれたときは先頭から順にたどれる。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// ---- 登録できる条件 ----
check('登録の案内は勇者モンがマスモンでないときだけ出す',
  has('if (!finalRewardSummary?.heroBondGain || finalRewardSummary.heroBondGain.masuId) return null;'));
check('デバッグ戦・デバッグ個体では出さない',
  has('if (debugBattle || mainHero?.debugOnly) return null;'));
check('1WAVEもクリアしていないランでは絆経験値を作らない(登録もさせない)',
  has('if (wavesCleared <= 0) {') && has('heroBondGain: null'));
check('リタイアも敗北と同じく「到達WAVE-1」で報酬を配る',
  has('try { await awardRunRewards(Math.max(0, wave - 1)); } catch {}'));
check('リタイアでも獲得内訳を作ってから結果画面を出す', (() => {
  const at = source.indexOf('const handleGiveUp = useCallback');
  if (at < 0) return false;
  const block = source.slice(at, source.indexOf('const handleRetry', at));
  // 前半はデバッグ戦用の抜け道なので、本来のリタイア処理だけを見る
  const realAt = block.indexOf('if (runFinalizingRef.current) return;');
  if (realAt < 0) return false;
  const real = block.slice(realAt);
  return real.indexOf('awardRunRewards') >= 0 && real.indexOf('awardRunRewards') < real.indexOf('setGaveUp(true)');
})());

// ---- 3画面ともスクロールで全部たどれること ----
// justify-center と overflow-y-auto を同じ要素へ付けると、あふれた上側へ届かなくなる
const SCREENS = [
  ['優勝(CHAMPION)', 'resultWin'],
  ['敗北', 'resultLose'],
  ['リタイア', 'resultRetire'],
];
for (const [label, scene] of SCREENS) {
  const at = source.indexOf(`<AssistantBubble scene="${scene}"`);
  check(`${label}画面を見つけられる`, at >= 0);
  if (at < 0) continue;
  // その画面の中央スクロール領域(直前のflex-1 min-h-0)を取り出す
  const areaAt = source.lastIndexOf('className="flex-1 min-h-0 w-full flex flex-col items-center', at);
  const area = source.slice(areaAt, at);
  check(`${label}: 中央のスクロール領域で justify-center を使っていない(上側が届かなくなるため)`,
    !/flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto/.test(area),
    area.slice(0, 90));
  check(`${label}: 内側の入れ物を m-auto で中央へ寄せている(あふれても切れない)`,
    /<div className="m-auto w-full flex flex-col items-center">/.test(area));
  // 登録の案内は獲得内訳より前に置き、開いた時点で目に入るようにする
  const regAt = area.indexOf('masuRegisterButtonNode()');
  const sumAt = area.indexOf('RewardSummaryCard');
  check(`${label}: 登録の案内を獲得内訳より前に出す`, regAt >= 0 && sumAt >= 0 && regAt < sumAt,
    `登録=${regAt} / 内訳=${sumAt}`);
}

// ---- 登録の中身 ----
check('登録すると今回ためた絆経験値をそのまま初期値にする',
  has('const startXp = Math.min(finalRewardSummary?.heroBondGain?.xpGain || 0, totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP));'));
check('二重登録できないようにしている', has('setMasuRegisteredThisRun(true);'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
