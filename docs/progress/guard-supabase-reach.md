# ブラウザの検査のうち、本番の Supabase へ届いているもの(2026-10-27・ガードくん調べ)

クラフトくんの依頼(ハヤテくんの調べ「約150本が Supabase への通信を止めていない」)への答え。**静的に分類しただけ**(検査を全部回したわけではない)。

## 分け方と数

| 分類 | 本数 | 本番へ届くもの |
| --- | --- | --- |
| 差し替えなし(`route`・fake が1つも無い) | 167 | **読み込み(GET・rpc)が届く**。書き込み(POST など)とおしゃべりの中継(functions)は、ゲームの止めが自動操作のブラウザでは止める |
| 表(`rest/v1`)や host を差し替えている | 77 | 差し替えた範囲は届かない。functions の差し替え漏れは #3963・#3971 で直した |
| supabase 以外だけ差し替え(データ・音など) | 13 | 差し替え漏れの可能性(要確認) |

## 「書きうる」検査(書き込みが本番へ届くもの)

いまは **0本**。見つけて直したもの: `debug-passphrase-browser-check`(#3887・webdriver を偽っていた)/ `debug-trials-check`(#3942・`__mhSupabaseStubbed = true` で差し替えなし)/ `rhythm-achievement-browser-check`(#3963)ほか18本(#3971・functions の差し替え漏れ)。
見張り: `tools/ranking/breeder-level-table-check.js`(「webdriver を偽る」「`__mhSupabaseStubbed = true` を立てる」検査は必ず差し替えていること)。

## 届く「読み込み」で困ること

- 画面の中身が**本番のデータで変わる**(例: #3804 のあと `breeder-ranking-browser-check` が「3件のはずが5件」で落ちた)。検査が本番の都合で落ちる
- ランキングの全行読み(ブリーダーLvは最大24,000行)など、**通信量**がかさむ
- 本番が落ちている・遅いときに、検査も落ちる・遅くなる


## 【いまの状態と続き】(2026-10-27・社長の「動く作業を絞る」で、ここで止めた)

### 分かったこと
- **本番へ書き込んでいた検査は見つけて直した**: `debug-passphrase-browser-check`(#3887・webdriver を偽って止めを外していた)/ `debug-trials-check`(#3942・印だけで差し替えなし)/ `rhythm-achievement-browser-check`(#3963)ほか18本(#3971・助手の中継 functions の差し替え漏れ)。
  見張りは `tools/ranking/breeder-level-table-check.js`(webdriver を偽る検査・`__mhSupabaseStubbed = true` を立てる検査は必ず差し替えること)。**書き込みが本物へ届く検査は、いまは 0本**(調べた範囲)
- **残る心配は「読み込み」だけ**: 上の167本(差し替えなし)は読み込みが本番へ届く。画面が本番のデータで変わる・通信量・本番が落ちると検査も落ちる。書き込みと中継はゲームの止めが止めている
- 本番の `breeder_levels` / `breeder_profiles` にテスト行が残っている(社長の決定で消さない・書き換えない)。`breeder_levels` はランキングを作るとき Lv.2 以上だけを使うので画面に出ない(#3907)。出どころは `docs/spec/BREEDER_PROFILE.md` §6.1

### 案A(読み込みも止める)の作りかけ(社長の決定でここで止めた・マージしていない)
- ブランチ: `claude/guard-offline-all`(プッシュ済み・ビルド済み。**main にはまだ入っていない**)
- 中身: `monster-hero/src/parts/26-supabase.jsx` の `sbAutomationWriteBlocked` を `sbAutomationBlocked` に広げた。自動操作のブラウザ(`navigator.webdriver` が true)で、差し替えの印が無い表への読み込みは本物へ出さず空の配列(200)を返す。rpc は空・書き込みは 201・functions は 503。**ふつうに遊ぶ人のブラウザ(webdriver が false)は何も変わらない**
  - 印を立てずに自分で `page.route` している検査 17本に、印(`window.__mhSupabaseStubbed = true`)を足した(印が無いと、差し替え先へ届く前にゲーム側が空の返事で止める)
  - 新しい検査 `tools/boot/automation-offline-guard-check.js`: 判定の組み合わせ(webdriver・印・URL・メソッド)と、実ブラウザで「遊ぶ人は届く / 自動操作・印なしは止まる / 印ありは差し替え先へ届く」を確かめる。**通っている**
  - 資料 `docs/rules/BUILD_CHECKS.md` の説明も直してある
- 確かめた範囲: ブラウザを使う検査 237本のうち、約112本を回した(94本が通り、18本が落ちた・下の表)。**落ちた18本が main でも落ちるかは、まだ比べていない**(未確認)

### 落ちた18本(案Aのブランチで・main との比べは未了)
- 名前だけ見ると案Aと関係の薄いものが多い(ゲームの中身の検査・描画の検査・絵の書き出しの道具)。ただし「関係ない」とは確かめていない
- `tools/assistant/atsu-unlock-browser-check.js` / `tools/battle/moo-notice-visibility-check.js`(0秒で落ちる=ファイルか準備の問題の疑い)/ `tools/battle/stack-marks-overlap-browser-check.js` / `tools/battle/unit-detail-browser-check.js` / `tools/browser/screen-render-cost-check.js`
- 時間切れ(200秒): `tools/boot/ja-wrap-beat-screen-check.js` / `tools/boot/ja-wrap-check.js` / `tools/card/card-footer-fit-browser-check.js` / `tools/card/card-pvp-browser-check.js` / `tools/card/card-qa-board-browser-check.js`
- カード部の検査: `card-battle-browser-check`(「ステップ」の札が見つからない)/ `card-battle-settings-browser-check` / `card-bind-browser-check`(①③ が落ちる・ゲームの中身)
- 絵や動画を作る道具で、検査ではない: `tools/card/card-art-kenshi-mocchi.js` / `card-art-pandora.js` / `card-image-ja.js` / `card-pack-video.js`(0秒で落ちる=引数や素材が要る道具。落ちて当然)

### 続きに要ること(再開するとき)
1. `claude/guard-offline-all` を main の最新に取り込む(`node tools/merge-main.js`。生成物のぶつかりは `--theirs` で取り `node tools/build.js`)
2. 残りの検査(237本のうち約125本、`tools/` 配下でブラウザを起動する検査)を回す。1本ずつ・1時間半ほど。落ちたものは、**main の作業場**(`git worktree add ../monhero-main origin/main`・`tools/node_modules` へのリンクが要る)で同じ検査を回し、main でも落ちるかを比べる。**案Aで新しく落ちたものだけ**が直す対象
3. 新しく落ちたものが「差し替えの印が要る」型なら、印を足す(17本と同じ直し)。本番の中身を読むこと自体が目的の検査があれば、印を付けて残す(落とさない)
4. 全部そろったら `node tools/run-checks.js --area required` と `tools/boot/automation-offline-guard-check.js` を通し、PR → 部長へ一言 → マージ。更新履歴なし
- 注意: 検査を回すときは作業場に `card-motion.mp4`(カード部の検査が作業ディレクトリへ書き出す動画)が出る。リポジトリへは入れない
- 注意: 古い版の検査を回すと本番へまた書く恐れがある。**必ず main を取り込んでから**回す

### 案B・案C(使わなかった案)
- 案B: 共通の部品 `tools/lib/offline-supabase.js` を作り、167本の先頭へ1行ずつ足す(忘れうる)
- 案C: 「chromium を起動する検査は差し替えを持つこと」を静的に調べる見張りだけ足す(167本は一度は直す)

## そろえる案(作る前の案・クラフトくんへ)

**案A(推奨・1か所): ゲーム側の止めを「書き込みだけ」から「全部」へ広げる**
- いま `monster-hero/src/parts/26-supabase.jsx` の `sbAutomationWriteBlocked` が、自動操作のブラウザ(`navigator.webdriver === true`)で `__mhSupabaseStubbed` が無いとき、書き込みだけを止めて偽の 201 を返している
- これを読み込み(GET・rpc)にも広げる: 自動操作のブラウザで、差し替えの印が無い(または表の名前の配列に入っていない)表への読み込みは、本物へ出さず空の配列(200)を返す。functions は 503
- 検査の側は**1行も直さずに**167本が本番へ出なくなる。差し替えの印(`__mhSupabaseStubbed`)を立てた検査は今までどおり自分で差し替える。ふつうに遊ぶ人のブラウザ(`webdriver` が false)は何も変わらない
- 気を付ける点: 本番の中身を読むこと自体が目的の検査(あれば)は、印を立てて通す。公開する前に167本を全部回して、落ちたものを洗い出す(1時間半ほど)
- 手間: ゲーム側 約20行 + 検査 + 資料。1〜2時間(AI の手の時間)

**案B: 検査ごとに共通の部品で差し替える**: `tools/lib/offline-supabase.js` を作り、167本それぞれの先頭へ1行足す。本数が多く、新しい検査を足すたびに忘れうる(いま見張りで防ぐのは「印を立てる検査」だけ)。案Aのほうが漏れない

**案C: 見張りだけ足す**: 「`chromium` を起動する検査は差し替えを1つ持つこと」を静的に調べる検査を足す。167本を一度は直す必要がある

## 差し替えなし167本(読みが本番へ届く)

### (tools 直下)(5本)
- `tools/assistant-bond-reward-browser-check.js`
- `tools/assistant-bubble-wrap-check.js`
- `tools/home-layout-check.js`
- `tools/landscape-screens-check.js`
- `tools/render-error-check.js`

### assistant(1本)
- `tools/assistant/atsu-unlock-browser-check.js`

### audio(8本)
- `tools/audio/auto-bgm-picker-browser-check.js`
- `tools/audio/bgm-arrangement-layout-check.js`
- `tools/audio/bgm-check.js`
- `tools/audio/bgm-light-check.js`
- `tools/audio/default-volume-check.js`
- `tools/audio/song-buffer-limit-check.js`
- `tools/audio/tap-sound-trace.js`
- `tools/audio/title-bgm-check.js`

### battle(21本)
- `tools/battle/auto-run-browser-check.js`
- `tools/battle/battle-check.js`
- `tools/battle/battle-menu-browser-check.js`
- `tools/battle/battle-menu-shake-check.js`
- `tools/battle/battle-mode-card-fit-check.js`
- `tools/battle/battle-mode-select-check.js`
- `tools/battle/battle-text-cover-check.js`
- `tools/battle/battle-tutorial-tactics-check.js`
- `tools/battle/battle-tutorial-v2-check.js`
- `tools/battle/card-drag-browser-check.js`
- `tools/battle/card-drag-perf.js`
- `tools/battle/card-name-fit-browser-check.js`
- `tools/battle/debug-battle-modes-check.js`
- `tools/battle/eiki-motion-check.js`
- `tools/battle/ham-counter-fx-check.js`
- `tools/battle/lib/tactics-battle-page.js`
- `tools/battle/moo-notice-visibility-check.js`
- `tools/battle/move-hint-layout-check.js`
- `tools/battle/rpg-debug-layout-check.js`
- `tools/battle/skill-motion-check.js`
- `tools/battle/wave-result-layout-check.js`

### boot(15本)
- `tools/boot/asset-prefetch-check.js`
- `tools/boot/boot-check.js`
- `tools/boot/boot-progress-check.js`
- `tools/boot/code-prefetch-check.js`
- `tools/boot/event-replay-tap-check.js`
- `tools/boot/help-new-badge-check.js`
- `tools/boot/ja-wrap-check.js`
- `tools/boot/ja-wrap-lines-check.js`
- `tools/boot/ja-wrap-word-check.js`
- `tools/boot/legacy-save-boot-check.js`
- `tools/boot/mission-claim-all-check.js`
- `tools/boot/new-player-story-check.js`
- `tools/boot/onboarding-required-check.js`
- `tools/boot/reload-log-check.js`
- `tools/boot/screen-error-boundary-check.js`

### browser(4本)
- `tools/browser/feature-check.js`
- `tools/browser/perf-check.js`
- `tools/browser/screen-render-cost-check.js`
- `tools/browser/smoke.js`

### card(15本)
- `tools/card/card-art-kenshi-mocchi.js`
- `tools/card/card-art-pandora.js`
- `tools/card/card-battle-browser-check.js`
- `tools/card/card-battle-settings-browser-check.js`
- `tools/card/card-cpu-playlist-browser-check.js`
- `tools/card/card-drag-video.js`
- `tools/card/card-foe-style-browser-check.js`
- `tools/card/card-hand-name-browser-check.js`
- `tools/card/card-image-ja.js`
- `tools/card/card-motion-video.js`
- `tools/card/card-pack-video.js`
- `tools/card/card-quick-autostart-browser-check.js`
- `tools/card/card-quick-run-browser-check.js`
- `tools/card/card-teaser-browser-check.js`
- `tools/card/card-top-landscape-browser-check.js`

### changelog(4本)
- `tools/changelog/collapsed-detail-check.js`
- `tools/changelog/raid-jack-visible-check.js`
- `tools/changelog/seen-across-tabs-check.js`
- `tools/changelog/type-badge-check.js`

### image(5本)
- `tools/image/dye-edge-check.js`
- `tools/image/dye-quality-report.js`
- `tools/image/dye-recolor-worker-check.js`
- `tools/image/dye-switch-flicker-check.js`
- `tools/image/face-render-check.js`

### market(5本)
- `tools/market/assistant-costume-browser-check.js`
- `tools/market/beat-point-disc-check.js`
- `tools/market/frame-shop-browser-check.js`
- `tools/market/halloween-icon-browser-check.js`
- `tools/market/market-bulk-purchase-browser-check.js`

### masu(8本)
- `tools/masu/auto-enhance-browser-check.js`
- `tools/masu/bulk-enhance-check.js`
- `tools/masu/bulk-reincarnate-browser-check.js`
- `tools/masu/fusion-animation-browser-check.js`
- `tools/masu/masu-enhance-layer-check.js`
- `tools/masu/masu-growth-breakdown-check.js`
- `tools/masu/transcend-badge-position-check.js`
- `tools/masu/transcend-debug-check.js`

### mode(62本)
- `tools/mode/difficulty-item-check.js`
- `tools/mode/difficulty-tab-check.js`
- `tools/mode/extreme-browser-check.js`
- `tools/mode/extreme-rule-detail-browser-check.js`
- `tools/mode/portrait-layout-landscape-check.js`
- `tools/mode/pro-mode-check.js`
- `tools/mode/pro-pick-room-check.js`
- `tools/mode/quick-rhythm-autostart-check.js`
- `tools/mode/ragnarok-browser-check.js`
- `tools/mode/rhythm-audio-decode.js`
- `tools/mode/rhythm-audio-reencode.js`
- `tools/mode/rhythm-background-run-check.js`
- `tools/mode/rhythm-calibration-check.js`
- `tools/mode/rhythm-climax-fx-check.js`
- `tools/mode/rhythm-debug-select-check.js`
- `tools/mode/rhythm-decor-pixel-check.js`
- `tools/mode/rhythm-effect-amount-check.js`
- `tools/mode/rhythm-end-flick-check.js`
- `tools/mode/rhythm-forced-rotation-check.js`
- `tools/mode/rhythm-gpu-estimate.js`
- `tools/mode/rhythm-gpu-load-report.js`
- `tools/mode/rhythm-hell-entry-check.js`
- `tools/mode/rhythm-history-check.js`
- `tools/mode/rhythm-hud-wedge-check.js`
- `tools/mode/rhythm-ios-touch-guard-check.js`
- `tools/mode/rhythm-judgment-band-check.js`
- `tools/mode/rhythm-judgment-line-height-check.js`
- `tools/mode/rhythm-landscape-hud-check.js`
- `tools/mode/rhythm-landscape-layout-check.js`
- `tools/mode/rhythm-last-difficulty-check.js`
- `tools/mode/rhythm-level-v3-report.js`
- `tools/mode/rhythm-look-sample-shot.js`
- `tools/mode/rhythm-monster-effect-check.js`
- `tools/mode/rhythm-multi-layout-check.js`
- `tools/mode/rhythm-note-dex-check.js`
- `tools/mode/rhythm-options-tabs-check.js`
- `tools/mode/rhythm-pause-bridge-check.js`
- `tools/mode/rhythm-play-area-resize-check.js`
- `tools/mode/rhythm-play-smoke-check.js`
- `tools/mode/rhythm-portrait-play-modes-check.js`
- `tools/mode/rhythm-result-effect-check.js`
- `tools/mode/rhythm-robot-play.js`
- `tools/mode/rhythm-run-loop-check.js`
- `tools/mode/rhythm-run-progress-check.js`
- `tools/mode/rhythm-same-place-report.js`
- `tools/mode/rhythm-sky-far-reach-check.js`
- `tools/mode/rhythm-sky-judgment-text-check.js`
- `tools/mode/rhythm-slowmo-shot.js`
- `tools/mode/rhythm-small-screen-layout-check.js`
- `tools/mode/rhythm-song-art-zoom-check.js`
- `tools/mode/rhythm-song-intro-check.js`
- `tools/mode/rhythm-song-list-scroll-check.js`
- `tools/mode/rhythm-song-select-check.js`
- `tools/mode/rhythm-song-version-check.js`
- `tools/mode/rhythm-stage-gl-check.js`
- `tools/mode/rhythm-tutorial-check.js`
- `tools/mode/rhythm-visual-sync-check.js`
- `tools/mode/rhythm-webgl-fallback-check.js`
- `tools/mode/species-challenge-browser-check.js`
- `tools/mode/species-challenge-reward-claimed-check.js`
- `tools/mode/tactics-browser-check.js`
- `tools/mode/tactics-enemy-art-shot.js`

### monster(4本)
- `tools/monster/mermaid-browser-check.js`
- `tools/monster/monster-card-browser-check.js`
- `tools/monster/monster-check-debug-check.js`
- `tools/monster/monster-list-space-check.js`

### playbot(1本)
- `tools/playbot/tier-page-wrap-check.js`

### ranking(3本)
- `tools/ranking/profile-frame-unlock-browser-check.js`
- `tools/ranking/ranking-check.js`
- `tools/ranking/ranking-dye-cost-check.js`

### run(3本)
- `tools/run/auto-quick-run-settings-browser-check.js`
- `tools/run/auto-resume-on-visible-check.js`
- `tools/run/quick-run-battle-band-browser-check.js`

### speed(1本)
- `tools/speed/speed-measure.js`

### text(1本)
- `tools/text/japanese-linebreak-check.js`

### ui(1本)
- `tools/ui/screen-effects-browser-check.js`
