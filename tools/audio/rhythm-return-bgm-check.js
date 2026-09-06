// モンヒロビートから戻ったときに、バトルのBGMが鳴り直す作りになっているかを見張る。
//
//   node tools/audio/rhythm-return-bgm-check.js
//
// 2026-09-07・ユーザー報告「バトルの勇者モン選択時でのデフォ曲が変わってる」。
//
// モンヒロビートの画面はBGMのキーを持たない(BGM_STATE_MAP にも RUN_PHASE_STATES にも無い)ので、
// 開いているあいだバトルのBGMは止まる。ところが戻ってきたときの判定が
// 「直前のBGMを維持(__keep_battle_bgm__)」だったため、維持すべき曲が無いまま無音で戻っていた。
//
// 音そのものはこの環境で鳴らせない(Audio_ はモジュールの中で、外から掴めない)ため、
// 判定の作りを静的に見る。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  path.join(root, 'monster-hero/src/parts/60-app.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const compact = src.replace(/\s+/g, '');

  check(`${rel}: 「維持を使わない」で曲を選び直せる`,
    /const bgmKeyForState = \(state, currentWave, enemyId, wavesDone, isGameOver, allowKeep = true\)/.test(src));
  // 「維持」を返すのは3か所。どれも allowKeep を通っていること
  const keeps = (src.match(/return '__keep_battle_bgm__';/g) || []).length;
  const guarded = (src.match(/if \(allowKeep && [^\n]*__keep_battle_bgm__/g) || []).length;
  check(`${rel}: 「維持」を返す判断はすべて allowKeep を通る`, keeps > 0 && guarded === keeps, `${guarded}/${keeps}`);

  check(`${rel}: モンビーで止めたことを覚えている`,
    src.includes('const bgmSuspendedByRhythmRef = useRef(false);')
    && compact.includes('bgmSuspendedByRhythmRef.current=rhythmScreenOpen;'));
  check(`${rel}: 戻った最初の1回は維持せず鳴らし直す`,
    /key === '__keep_battle_bgm__' && bgmSuspendedByRhythmRef\.current/.test(src)
    // 生成物は `(waveHistory || [])` のように空白が入るので、空白を潰してから見る
    && compact.includes('bgmKeyForState(gameState,wave,enemy?.id,(waveHistory||[]).length>0,hp<=0||gaveUp,false)'));
  check(`${rel}: モンビーの開け閉めでBGMを見直す`,
    /autoBgmOverride, rhythmScreenOpen\]\);/.test(src));

  // 前提: モンビーの画面はBGMのキーを持たない(だから止まる)
  if (file.includes('/src/')) {
    const map = src.slice(src.indexOf('const BGM_STATE_MAP = {'), src.indexOf('};', src.indexOf('const BGM_STATE_MAP = {')));
    check(`${rel}: モンビーの画面はBGMのキーを持たない（止まるのが前提）`, !/RHYTHM_/.test(map));
  }
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
