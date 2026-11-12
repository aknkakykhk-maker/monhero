# 引き継ぎメモ(ビート部・テンポ・2026-11-12): 横画面の黒い帯と、演奏後に漏れる裏クイックの音

## 出したもの
- **#5604(マージ済み)**
  - 横画面の黒い帯: 自前回転の器(`RHYTHM_VIEW_ROTATION.frameStyle`・`data/rhythm-mode.js`)の余白を、戻るボタンのある側(90度=端末の上・270度=端末の下)だけにした。反対側(ホームバー側)は0
  - 演奏後の裏クイックの音: 結果画面のランクアップ演出で効果音の音量を戻す間、裏のバトルの音まで鳴っていた。`60-app.jsx` の `rhythmRunBackgroundQuiet`(モンビーで周回が残っているあいだ `Audio_.setBackgroundSeQuiet` を立てる)。演出の音は `fgSe` なので消えない
  - 検査: `tools/mode/rhythm-forced-rotation-check.js`(反対の端に帯を作らない)・`tools/battle/run-stage-check.js`(印を立てる)
- 更新履歴 type:'fix' を2件(助手の告知なし・ヘルプなし)

## なぜ再発したか
- 帯: 前回は「中の画面が余白を二重に足す」分だけ0にした。器自身が四方に取る余白(2026-09-12)は残り、検査もそれを正としていた
- 音: 2026-11-11 は音量0と「裏の音だけ止める印」を使い分けたが、ランクアップ演出で音量を戻す所を印の対象に入れていなかった

## 気をつけること・残り
- 実機(iPhone)では未確認。本番で見る所: 🔄で横にして端の帯がない/裏クイックを回して1曲演奏し結果を見てもバトルの効果音が聞こえず、ランクアップの音は鳴る
- `run-checks.js --changed` は `60-app.jsx` を触ると量が多く時間切れになる。必要な検査を選んで回した(構文・未定義・{}・render-error・run-stage・quick-run-anywhere・回転・マルチ配置)
- main の `pages build and deployment`(dynamic)が #5604 の直後に1回 failure。同じコミットの compiled-check は success。次の run は進行中だった(原因は未調査)
