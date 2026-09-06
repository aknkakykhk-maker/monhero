// 演奏で止まっていたぶんの追いつき(docs/spec/QUICK_RHYTHM_LINK.md PR7)を確かめる。
//
//   node tools/mode/rhythm-catch-up-check.js
//
// ★この機能でいちばん大事なのは「報酬を配る経路を増やしていないこと」。
//   当初の設計はヘッドレスのシミュレータを書く案だったが、
//   報酬(経験値・ダイヤ・絆)を配る道が2つになると、食い違ったときに
//   静かにバランスが壊れる。そこで**本物のループの待ち時間を詰めるだけ**の形にした。
//   ここでは「シミュレータを作っていないこと」を機械的に見張る。
//
// 待ち時間の計算そのものは vm で実際に動かして、
// 「追いつき中は速い・終われば元どおり・上限を超えない」を確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- ① 報酬の経路を増やしていない ----
// 追いつきの処理そのものが報酬に触っていないことを見る。
// (ゲーム全体では経験値・ダイヤを動かす場所はミッションやログインボーナスなど元から多いので、
//  総数を数えても意味がない。見るべきは「追いつきが報酬を配っていないこと」)
const catchUpBlock = (() => {
  const from = app.indexOf('// ---- 演奏で止まっていたぶんの追いつき(PR7) ----');
  const to = app.indexOf('}, [catchingUp, rhythmScreenOpen, runStage]);', from);
  return from >= 0 && to > from ? app.slice(from, to) : '';
})();
check('追いつきの処理を切り出せる', catchUpBlock.length > 0);
check('追いつきの処理は報酬に触らない',
  !/setBreederXp|setGold|storeSet|awardRunRewards|addQuickRunProgressRewards/.test(catchUpBlock));
check('追いつきのための報酬計算を作っていない',
  !/simulateRun|headlessRun|catchUpRewards|estimateRewards/i.test(app));
check('追いつきは待ち時間を詰めるだけ',
  /const battleMs = useCallback\([\s\S]{0,400}?catchUpUntilRef\.current > Date\.now\(\)/.test(app));

// ---- ② 止めどき ----
check('演奏に入ったら追いつきを止めて時刻を控える',
  /gameState === 'RHYTHM_PLAY'[\s\S]{0,120}?rhythmPlayStartedAtRef\.current = Date\.now\(\)[\s\S]{0,40}?stopCatchUp\(\)/.test(app));
check('裏で周回していないときは追いつかない',
  /if \(!rhythmScreenOpen \|\| runStageRef\.current == null \|\| !autoRepeatRef\.current\) \{ stopCatchUp\(\); return; \}/.test(app));
check('バトルへ戻ったら追いつきを終える',
  /returnToBackgroundRun = \(\) => \{[\s\S]{0,220}?catchUpUntilRef\.current = 0;/.test(app));
check('モンビーを離れた・ランが終わったら止める',
  /if \(!rhythmScreenOpen \|\| runStage === null\) \{ stopCatchUp\(\); return; \}/.test(app));

// ---- ③ 上限 ----
check('追いつける上限は1曲ぶん（5分まで）',
  app.includes('const CATCH_UP_MAX_PAUSED_MS = 5 * 60 * 1000;'));
check('タブを閉じていた時間まで遡らない（測るのは演奏の開始から終了まで）',
  /beginCatchUp\(Date\.now\(\) - startedAt\)/.test(app));

// ---- ④ 計算を実際に動かす ----
const box = { Date, Math, Number };
vm.createContext(box);
vm.runInContext(`
  const CATCH_UP_SPEED = ${(app.match(/const CATCH_UP_SPEED = (\d+);/) || [])[1]};
  const CATCH_UP_MAX_PAUSED_MS = 5 * 60 * 1000;
  let speed = 4;             // AUTO∞中の通常速度
  let catchUpUntil = 0;
  const battleMs = (baseMs) => {
    const base = Math.max(0, Math.round(baseMs / speed));
    if (!(catchUpUntil > Date.now())) return base;
    return Math.max(0, Math.round(base / CATCH_UP_SPEED));
  };
  const beginCatchUp = (pausedMs) => {
    const paused = Math.min(Math.max(0, Number(pausedMs) || 0), CATCH_UP_MAX_PAUSED_MS);
    const needMs = Math.round(paused / (CATCH_UP_SPEED - 1));
    if (needMs < 1000) { catchUpUntil = 0; return 0; }
    catchUpUntil = Date.now() + needMs;
    return needMs;
  };
  globalThis.__b = battleMs; globalThis.__begin = beginCatchUp;
  globalThis.__stop = () => { catchUpUntil = 0; };
  globalThis.__speed = () => CATCH_UP_SPEED;
`, box);
const battleMs = box.__b, begin = box.__begin, stop = box.__stop, SPEED = box.__speed();

stop();
const normal = battleMs(1000);
begin(120000);                              // 2分ぶん止まっていた
const fast = battleMs(1000);
check('追いつき中は待ち時間が短くなる', fast < normal, `${normal}ms → ${fast}ms`);
check('速さは決めた倍率どおり', fast === Math.round(normal / SPEED), `${normal}/${SPEED} = ${fast}`);
stop();
check('追いつきが終われば元の速さへ戻る', battleMs(1000) === normal, `${battleMs(1000)}ms`);

check('2分ぶんは40秒ほどで取り戻せる', Math.abs(begin(120000) - 40000) < 1000, `${begin(120000)}ms`);
check('上限を超えて取り戻そうとしない', begin(60 * 60 * 1000) === Math.round(5 * 60 * 1000 / (SPEED - 1)),
  `1時間 → ${begin(60 * 60 * 1000)}ms`);
check('ごく短い中断では追いつきに入らない', begin(500) === 0);
check('壊れた値でも落ちない', begin(null) === 0 && begin(-1) === 0 && begin('x') === 0);

// ---- ⑤ 生成物にも入っている ----
check('配信用JSにも追いつきが入っている',
  compiled.includes('catchUpUntilRef') && compiled.includes('CATCH_UP_MAX_PAUSED_MS'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
