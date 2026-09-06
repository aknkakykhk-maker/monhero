// ∞周回の進捗を、バトル画面(超省エネ)の空いているところにも出しているかを見張る。
//
//   node tools/run/quick-run-battle-band-check.js
//
// 2026-09-07・ユーザー指示
//   「無限周回時の空いてるスペースにもモンビーの帯のように進捗状況を表示するようにしたい」
//   「止めるまでは増えてくけど止めたらリセットされるみたいな感じで」
//
// ここで守りたいのは3つ。
//   1. 数字はモンビーの帯とまったく同じもの(quickRunProgress ＋ quickRunPendingRewards)を使う。
//      別々に数えると、同じ周回なのに画面によって違う値が出る
//   2. ∞を切ったら消える(finished を残さない)。モンビー側は「終わったよ」と知らせる役目が
//      あるので finished でも残すが、バトル画面は本人が切った直後なので残す意味がない
//   3. 置き場所は超省エネの空いたところ。ボタンの帯(下段)へ割り込ませない
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
  // 生成物は空白が入り括弧が外れるので、空白を落としてから見る
  const compact = src.replace(/\s+/g, '');

  check(`${rel}: バトル画面の帯がある`, src.includes('data-quick-run-battle-band'));

  // 出す条件。∞周回中・クイック・バトル画面で、まだ終わっていないときだけ
  check(`${rel}: クイックの∞周回中だけ出す`,
    compact.includes("gameState==='BATTLE'&&isQuickMode(runMode)&&autoRepeat===true&&quickRunProgress&&!quickRunProgress.finished"));
  // ★「止めたらリセット」。finished を残す作りになっていないこと
  check(`${rel}: ∞を切ったら消える（終わった印を残さない）`,
    !/data-quick-run-battle-band[\s\S]{0,600}quickRunProgress\.finished\s*\?/.test(src));

  // 数字はモンビーの帯と同じ出どころ
  check(`${rel}: 数字はモンビーの帯と同じものを使う`,
    /const quickRunBattleBandNode[\s\S]{0,600}quickRunPendingRewards\(\)/.test(src)
    && compact.includes('quickRunProgress.xp+pending.xp')
    && compact.includes('quickRunProgress.gold+pending.gold'));
  // 生成物は日本語を 周目 のように書き出すので、文言ではなく
  // 「loops と wave が同じ場所から出ている」ことで見る
  check(`${rel}: 周回数とWAVEを出す`,
    src.includes('data-quick-run-battle-loops')
    && /data-quick-run-battle-loops[\s\S]{0,400}?quickRunProgress\.loops[\s\S]{0,120}?wave/.test(src));
  check(`${rel}: 経験値とダイヤを出す`,
    src.includes('data-quick-run-battle-xp') && src.includes('data-quick-run-battle-gold'));

  // 置き場所。超省エネの上側(空いているところ)であって、ボタンの帯ではない
  check(`${rel}: 超省エネの空いたところへ置いている`,
    /data-ultra-ally-log[\s\S]{0,900}?quickRunBattleBandNode/.test(src));
  check(`${rel}: ボタンの帯へ割り込ませていない`,
    !/quickRunBattleBandNode[\s\S]{0,400}?data-auto-bgm-button/.test(src));

  // 作るのは1か所だけ(2つ書くと片方だけ直す事故になる)
  const defs = (src.match(/data-quick-run-battle-band/g) || []).length;
  check(`${rel}: 帯の中身は1か所で作る`, defs === 1, `${defs}か所`);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
