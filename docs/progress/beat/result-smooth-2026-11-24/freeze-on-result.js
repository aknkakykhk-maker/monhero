// 止め絵用(ページの中で動く)。結果の画面が出た瞬間に、ロボット演奏の --end-shots の時刻のつかみ(__mhRafNow)を 1 にする。
// 数え上げの始まりの時刻が 1 になるので、--result-times の時刻ちょうどの絵が撮れる(実時間で待つと撮るあいだに進んでずれる)
// ★差し込む台本はページの読み込み前に動く(まだ documentElement が無い)ので、DOMContentLoaded を待ってから見張る
document.addEventListener('DOMContentLoaded', () => {
  new MutationObserver((_, obs) => {
    if (document.querySelector('[data-rhythm-result]')) { window.__mhRafNow = 1; obs.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true });
});
