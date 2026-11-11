# 検査の一覧(棚卸し)

作り方: `node tools/checks-inventory.js --json <全部回した結果>`(2026-11-11)。1本ごとの表は [inventory.tsv](inventory.tsv)。

- 検査 947本(ブラウザを使う 307本・いつも回す 383本・CI 49本)
- 1本ずつ回したときの合計 394分(秒数が分かる 947本)
- 今回: OK 926 / NG 21 / TIMEOUT 0 / SKIP 0

## 2026-11-11 の整理(ケンサ)の要点

| | 整理前 | 整理後 |
| --- | --- | --- |
| 変えたファイルを名指しで読む検査が `--changed` で選ばれない | 697件 / 1615件(43%) | 0件 |
| 過去1500件のコミットで「本体と一緒に直された検査」が選ばれていた割合 | 52.7% | 87.7% |
| `--changed` の平均(直近300件の変更・同じ実測の秒数で) | 401本・20.2分(1本ずつ) | 430本・11.4分(4組で同時に) |
| 全部回した時間(4組・高い負荷の中で) | 約2時間(組ごと83〜102分+1本ずつ16分) | 本数はほぼ同じ(+どこにも入っていなかった1本) |
| どの領域にも入らず一度も回らない検査 | 1本(playbot/sim/hate-sim-check.js) | 0本 |

- 消した検査: 0本。ソースがよく似ている組は全部見たが、縦と横・相手の顔ぶれなど見ている中身が別で、「同じことを別の検査が確実に見ている」ものは無かった
- 作り直した検査: home-layout-check.js(HOME の CSS を当てた見本 → 9つの大きさで本物の画面。62件の NG → 0件)
- 足した見張り: run-checks-select-check.js(選び方)・event-replay-tap-check.js ④(光る演出の無い行の場面の説明。#4568 の再発防止)
- 単独で回すと配信(:8899)が無くて落ちていた60本は、tools/shared-serve.js で無ければ立てる
- 秒数はすべて、4組を同時に回した高い負荷の中で測ったもの。比べるための数字で、ふだんはもっと短い

## 領域ごと

| 領域 | 本数 | ブラウザ | 合計(分) | 30日で直された回数 |
| --- | ---: | ---: | ---: | ---: |
| card | 116 | 59 | 101.0 | 541 |
| mode | 317 | 86 | 83.6 | 428 |
| assistant | 62 | 28 | 57.2 | 248 |
| boot | 74 | 28 | 55.6 | 132 |
| battle | 81 | 29 | 27.1 | 175 |
| monster | 29 | 8 | 13.8 | 90 |
| masu | 60 | 12 | 11.0 | 30 |
| ui | 12 | 7 | 8.8 | 25 |
| audio | 26 | 7 | 7.8 | 21 |
| ranking | 42 | 11 | 6.0 | 59 |
| root | 31 | 7 | 5.8 | 98 |
| market | 14 | 6 | 5.2 | 28 |
| image | 22 | 4 | 4.1 | 17 |
| run | 28 | 3 | 2.5 | 15 |
| friends | 5 | 2 | 1.8 | 10 |
| text | 1 | 1 | 1.4 | 0 |
| changelog | 14 | 4 | 0.9 | 12 |
| browser | 3 | 3 | 0.4 | 5 |
| profile | 1 | 1 | 0.3 | 1 |
| playbot | 6 | 1 | 0.1 | 7 |
| masmon-battle | 1 | 0 | 0.0 | 2 |
| hooks | 1 | 0 | 0.0 | 0 |
| team | 1 | 0 | 0.0 | 2 |

## 重い検査(上位20本)

| 検査 | 秒 | 何を見るか |
| --- | ---: | --- |
| card/card-pvp-browser-check.js | 943.8 | MFバトルカードのマルチ対戦(91-card-battle-multi.jsx)を、実際のブラウザの2つのページで最後ま |
| card/card-ai-grow-style-check.js | 471.6 | MFバトルカード: 育つ助手の型(2026-11-08 社長「助手の相談の答えで、助手と対戦のデッキの中身が変わる。強さ |
| card/card-ai-deck-browser-check.js | 445 | MFバトルカード: 助手の推し・好き・素顔のデッキを AI で組む(83-card-ai-deck.jsx・2026-1 |
| mode/rhythm-gpu-band-check.js | 432.4 | スライドの帯を GPU に一度だけ置いて描く描き方(作り替え B・rhythmCreateGpuSlideBand)が、 |
| assistant/assistant-life-furn-browser-check.js | 430.7 | 助手ライフの家具(段階B・2026-11-08 社長 GIFT-PLAN.md)を、実際に開いて確かめる。公開の印 as |
| boot/ja-wrap-beat-screen-check.js | 418.5 | モンヒロビートの画面の文(説明・助手の吹き出し・札)が、言葉の途中で折れていないかを数える(2026-10-26)。 |
| boot/ja-wrap-beat-extra-check.js | 362.5 | モンヒロビートの画面のうち、全国ランキング・マスモンランキングの窓・HELL の鍵・ノーツ図鑑・これまでの記録の文が、言 |
| assistant/assistant-life-browser-check.js | 355.6 | 助手ライフ(助手たちの家・段階1 2026-11-07)の画面と HOME の施設の顔を、実際に開いて確かめる。公開の印 |
| boot/changelog-order-check.js | 335 | 更新履歴の日付と並び順を見張る。 |
| card/card-qa-board-browser-check.js | 333.8 | MFバトルカードの通しの見回り(docs/progress/card-battle/qa/README.md)のうち、対 |
| mode/rhythm-phrase-copy-check.js | 329.3 | 譜面の作り方のリビジョン(chartRevision)と、Rev.2の「フレーズの写し」を見張る。 |
| boot/ja-wrap-beat-play-check.js | 327.8 | モンヒロビートの演奏中の画面の文が、言葉の途中で折れていないか・字が切れていないかを数える(2026-10-27 ビート |
| audio/rhythm-loudness-check.js | 326.6 | モンヒロビートの曲が、どれも同じ大きさで鳴るか。 |
| card/card-drag-tap-browser-check.js | 323.9 | MFバトルカード: 手札を運ぶ(ドラッグ)と、タップ・ボタンで出したときの手が食い違わないか(2026-10-27 総点 |
| boot/ja-wrap-check.js | 323.6 | 主な画面の短い字(題名・タブ・16字までの札)が、言葉の途中で折れていないかを数える(2026-10-20 改善部の見直 |
| mode/tactics-ex-skills-browser-check.js | 318.8 | タクティクス専用 EXスキル(STEP1: 共通基盤)を、実際のブラウザで操作して確かめる。 |
| assistant/assistant-life-map-check.js | 290.3 | 助手ライフ「📋 みんなの居場所」の地図(案A・2026-11-08 社長「推奨でいいけどもっと矛盾のない作りとわかりや |
| boot/story-monsters-browser-check.js | 244.5 | お話の真ん中に出すモンスター(キュービ・オリヒメ)が、窓(セリフの枠・助手の顔の列・ボタン)と重ならないかを、実際に開い |
| ui/rhythm-multi-assist-result-check.js | 237.5 | マルチの🔄横(縦の端末をアプリが回した表示)などで、助手を呼んだライブの曲えらび・結果の画面が切れないか(2026-1 |
| card/card-rules-check.js | 236.6 | MFバトルカードのルールの本体(src/parts/82-card-battle-core.jsx)を、ブラウザなしで動 |

## よく直される検査(30日で5回以上)

書き方が本体の小さな変化に弱い(文字の並びをそのまま探している等)ものが多い。直すときは docs/rules/BUILD_CHECKS.md「検査を書くとき・直すときの決めごと」へ。

| 検査 | 回数 |
| --- | ---: |
| card/card-battle-browser-check.js | 69 |
| card/card-rules-check.js | 59 |
| card/card-pvp-browser-check.js | 38 |
| assistant/assistant-life-browser-check.js | 30 |
| assistant/assistant-chat-check.js | 24 |
| card/card-pvp-check.js | 24 |
| mode/rhythm-chart-level-check.js | 22 |
| monster/kyubi-orihime-traits-check.js | 21 |
| battle/card-art-check.js | 14 |
| mode/rhythm-assistant-session-check.js | 14 |
| assistant/assistant-masmon-browser-check.js | 13 |
| card/card-tactics-gambit-check.js | 13 |
| battle/tactics-hate-check.js | 12 |
| card/card-qa-board-browser-check.js | 12 |
| help-render-check.js | 11 |
| home-layout-check.js | 11 |
| assistant/assistant-life-friend-browser-check.js | 11 |
| boot/kaizen2-layout-check.js | 11 |
| assistant-bond-check.js | 10 |
| assistant-check.js | 10 |
| assistant/assistant-life-check.js | 10 |
| battle/battle-mode-check.js | 10 |
| boot/ja-wrap-beat-screen-check.js | 10 |
| card/card-foe-style-browser-check.js | 10 |
| assistant-bond-reward-check.js | 9 |
| assistant/assistant-life-friend-check.js | 9 |
| assistant/assistant-masmon-suggest-check.js | 9 |
| assistant/kyuko-check.js | 9 |
| assistant/quick-guide-check.js | 9 |
| battle/card-name-fit-browser-check.js | 9 |
| battle/stack-marks-overlap-browser-check.js | 9 |
| boot/event-replay-tap-check.js | 9 |
| card/card-double-tap-browser-check.js | 9 |
| assistant-face-check.js | 8 |
| assistant/atsu-unlock-browser-check.js | 8 |
| battle/stack-marks-check.js | 8 |
| boot/ja-wrap-check.js | 8 |
| card/card-drag-tap-browser-check.js | 8 |
| card/card-focus-browser-check.js | 8 |
| card/card-pvp-watch-browser-check.js | 8 |
| mode/rhythm-background-run-check.js | 8 |
| monster/lineage-dex-check.js | 8 |
| assistant/assistant-life-quick-run-browser-check.js | 7 |
| assistant/event-line-bgm-check.js | 7 |
| battle/damage-parity-check.js | 7 |
| battle/unit-detail-browser-check.js | 7 |
| boot/card-battle-intro-story-browser-check.js | 7 |
| boot/event-replay-check.js | 7 |
| boot/ja-wrap-lines-check.js | 7 |
| card/card-audit-pack-check.js | 7 |
| card/card-battle-settings-browser-check.js | 7 |
| card/card-bind-browser-check.js | 7 |
| card/card-replay-list-browser-check.js | 7 |
| mode/rhythm-chart-hand-rules-check.js | 7 |
| mode/rhythm-multi-layout-check.js | 7 |
| mode/rhythm-ranking-check.js | 7 |
| ui/rotation-height-check.js | 7 |
| assistant/assistant-chat-ranking-check.js | 6 |
| assistant/sorashido-story-check.js | 6 |
| card/card-deck-pick-check.js | 6 |
| card/card-drag-set-browser-check.js | 6 |
| card/card-quick-run-browser-check.js | 6 |
| image/data-image-source-check.js | 6 |
| mode/eternal-rules-check.js | 6 |
| mode/raid-jack-check.js | 6 |
| mode/raid-jack-screen-browser-check.js | 6 |
| mode/rhythm-held-finger-owner-check.js | 6 |
| mode/tactics-ex-skills-check.js | 6 |
| ranking/breeder-level-table-check.js | 6 |
| ranking/profile-frame-unlock-browser-check.js | 6 |
| layout-consistency-check.js | 5 |
| assistant/assistant-life-buygive-browser-check.js | 5 |
| assistant/assistant-masmon-plan-check.js | 5 |
| battle/ai-copy-classic-check.js | 5 |
| battle/battle-damage-preview-check.js | 5 |
| battle/run-stage-check.js | 5 |
| card/card-assistant-talk-check.js | 5 |
| card/card-auto-ticket-check.js | 5 |
| card/card-cpu-playlist-browser-check.js | 5 |
| card/card-cup-screen-browser-check.js | 5 |
| card/card-foe-grid-browser-check.js | 5 |
| card/card-foe-release-check.js | 5 |
| card/card-replay-check.js | 5 |
| card/card-share-auto-browser-check.js | 5 |
| card/card-share-deck-pick-browser-check.js | 5 |
| card/card-watch-board-browser-check.js | 5 |
| changelog/monster-ko-check.js | 5 |
| friends/friends-api-check.js | 5 |
| market/assistant-costume-browser-check.js | 5 |
| mode/extreme-browser-check.js | 5 |
| mode/extreme-challenge-check.js | 5 |
| mode/infinity-rules-check.js | 5 |
| mode/raid-jack-after-story-browser-check.js | 5 |
| mode/raid-jack-story-check.js | 5 |
| mode/rhythm-hit-effect-check.js | 5 |
| mode/rhythm-options-tabs-check.js | 5 |
| mode/tactics-ex-skills-browser-check.js | 5 |
| monster/illumine-dreamy-effects-check.js | 5 |
| monster/kyubi-orihime-browser-check.js | 5 |
| monster/melody-kuromy-browser-check.js | 5 |
| monster/melody-kuromy-effects-check.js | 5 |

## ソースがよく似ている組(0.75以上)

似ているだけで、見ている中身(縦画面と横画面・相手の顔ぶれ・モンスターごと)は別のことが多い。**消すのは、同じことを別の検査が確実に見ているときだけ。**

| 検査 | 似ている検査(重なり) |
| --- | --- |
| battle/auto-run-browser-check.js | mode/rhythm-background-run-check.js(0.83) |
| battle/stack-marks-overlap-browser-check.js | battle/unit-detail-browser-check.js(0.79) |
| boot/ja-wrap-beat-extra-check.js | boot/ja-wrap-beat-multi-check.js(0.92) |
| boot/ja-wrap-beat-tutorial-check.js | boot/ja-wrap-beat-extra-check.js(0.92) |
| card/card-big-guts-browser-check.js | card/card-choose-browser-check.js(0.78) |
| card/card-choose-browser-check.js | card/card-field-browser-check.js(0.81) |
| card/card-foe-style-browser-check.js | card/card-top-landscape-browser-check.js(0.82) |
| card/card-head-browser-check.js | card/card-choose-browser-check.js(0.78) |
| card/card-mia-spooky-check.js | card/card-pink-gujira-check.js(0.82) |
| card/card-oborogesou-check.js | card/card-pink-gujira-check.js(0.86) |
| card/card-pvp-all-decks-check.js | card/card-pvp-check.js(0.99) |
| card/card-qa-board-browser-check.js | card/card-choose-browser-check.js(0.76) |
| card/card-quick-autostart-browser-check.js | card/card-top-landscape-browser-check.js(0.79) |
| image/art-body-center-check.js | image/art-content-box-check.js(0.84) |
| image/mia-dye-mask-check.js | image/undine-dye-mask-check.js(0.92) |
| image/mocchi-dye-mask-check.js | image/plant-dye-mask-check.js(0.81) |
| image/yaobikuni-dye-mask-check.js | image/undine-dye-mask-check.js(0.83) |
| mode/rhythm-hud-wedge-check.js | mode/rhythm-landscape-hud-check.js(0.87) |
| mode/rhythm-run-loop-check.js | mode/rhythm-run-progress-check.js(0.82) |
| mode/tactics-ex-skills-browser-check.js | mode/tactics-ex-turn-smoke-check.js(0.78) |
| monster/ghost-browser-check.js | mode/tactics-ex-turn-smoke-check.js(0.76) |
| monster/illumine-dreamy-browser-check.js | monster/kyubi-orihime-browser-check.js(0.82) |
| monster/melody-kuromy-browser-check.js | mode/tactics-ex-turn-smoke-check.js(0.77) |
| playbot/ledger-check.js | playbot/scoreboard-check.js(0.90) |
| run/quick-run-battle-band-browser-check.js | battle/auto-run-browser-check.js(0.76) |

## 今回落ちた検査

| 検査 | 結果 |
| --- | --- |
| assistant/unreleased-assistant-hidden-check.js | NG |
| battle/battle-mode-check.js | NG |
| battle/soul-rank-step4-check.js | NG |
| boot/ja-wrap-word-check.js | NG |
| boot/kaizen2-layout-check.js | NG |
| boot/new-player-stories-browser-check.js | NG |
| browser/screen-render-cost-check.js | NG |
| card/card-auto-ticket-browser-check.js | NG |
| card/card-battle-browser-check.js | NG |
| card/card-footer-fit-browser-check.js | NG |
| card/card-qa-board-browser-check.js | NG |
| card/card-safe-area-browser-check.js | NG |
| masu/rebirth-check.js | NG |
| masu/soul-rank-step4-check.js | NG |
| mode/rhythm-options-tabs-check.js | NG |
| monster/ghost-effects-check.js | NG |
| monster/kyubi-orihime-traits-check.js | NG |
| monster/yggdrasil-effects-check.js | NG |
| text/japanese-linebreak-check.js | NG |
| ui/rotation-height-check.js | NG |
| ui/screen-effects-check.js | NG |
