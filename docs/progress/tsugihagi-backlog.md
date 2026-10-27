# 開発部ツギハギ 控え(見つけた物・済んだ物)

担当: 設定画面・ヘルプ・お知らせ・プロフィール/フレンドの画面・ミッション・検査ツール(tools/)の整備。
10/29(木)20:00 まで止まらず、小さく直せる物から 1件=1PR で直す(台帳 #3701)。

## 済んだ物

- 2026-10-26 カードの札の文字の直し(29枚)の仕上げ … #3698
- 2026-10-26 ブリーダーP交換所にプレゼント枠(ハロウィン・妖)を条件つきで並べる … #3696
- 2026-10-26 画面の言葉の見直し 42件(ダメダシくんの一覧)の仕上げ … #3705
- 2026-10-26 検査: ゴースト・メロディクロミー・イルミネドリーミーの効果の検査が、数字入りの絵の名前(`HYBRID_C010_IMG`)で落ちていた → 置き換えの正規表現に数字を足す
- 2026-10-27 デバッグメニューの整理(1回目・2回目)。見張り `tools/boot/debug-menu-layout-check.js`
- 2026-10-27 染色の色と濃さを数字で見せ、「−」「+」で動かせるように
- 2026-10-27 merge-main: 両側で同じ行は、ぶつかりにしない … #3904
- 2026-10-27 はじめての人には開催中のイベントのお話だけを流す(昔のお話4本は見た扱い・ログインボーナスの窓と重ねない)。見張り `tools/boot/new-player-stories-browser-check.js` … #3981
- 2026-10-27 更新履歴の題の頭から遊びの名前を外す(240件。元の題は `idTitle` に残して既読を保つ)。見張り `tools/changelog/title-prefix-check.js` … #3996
- 2026-10-27 検査: ムーの札の置き方が、目印 `data-battle-float-right` が足されて読めなくなっていた … #3996
- 2026-10-27 お話の窓: 横向きの低い画面でも「次へ」「スキップ」がいつも画面の中に出るように。見張り `tools/boot/story-sheet-buttons-browser-check.js` … #4023
- 2026-10-27 はじめて遊ぶ人のお話は、続けて流すのを1本まで(新しいキー `mh_story_one_at_a_time_v1`) … #4029

## 全部の検査の見回り(2026-10-27 朝・main 3ce26097 ごろ)

752本のうち 671本を回した(598本 → 2時間の上限で止まる → 残り145本のうち前半73本)。後半の72本は、社長の「動く作業を絞る」で回していない
(残りの一覧は half2: 752本から回した物を除いた後ろ半分。`node tools/run-checks.js --list` から作れる)。
main で NG だった物(各部へはクラフトくん経由で回した):

| 検査 | 落ち方 | 場所 |
| --- | --- | --- |
| viewport-height-check.js | オプションの目次ボタンが scrollIntoView を使う(84-screen-card-battle.jsx) | カード部 0f04d7f6 |
| card/card-battle-browser-check.js | locator.click が30秒で時間切れ | カード部 |
| card/card-battle-settings-browser-check.js | 技を使う前の確認の窓が出ない | カード部 |
| card/card-bind-browser-check.js | 技で相手を狙っても名指しの窓が開かない | カード部 |
| battle/stack-marks-overlap-browser-check.js | 横向きでマーク4つと7桁の予測ダメージが重なる | バトル |
| battle/unit-detail-browser-check.js | 途中で目印が見つからない(getBoundingClientRect of null) | バトル |
| mode/difficulty-item-check.js | 「使う」から対象選択へ進めない(19項目中18 OK) | バトル・アイテム |
| mode/rhythm-gpu-band-check.js | (前半73本で NG・369秒) | ビート部 |
| mode/rhythm-hit-effect-check.js | (前半73本で NG) | ビート部 |
| mode/rhythm-judgment-line-height-check.js | (前半73本で NG) | ビート部 |
| masu/soul-rank-step2-check.js | 魂格画面の吹き出しが専用の scene になったのに検査が古い | 直した … #4010 |

- 見回りの途中で、検査が `tools/mode/authoring/monster-hero-theme-v3-audio.json` を書き換えていた(中身の差は0行・ファイルの形だけ)。元に戻した

## 答え待ち

- デバッグの消す候補(行動カードの絵の切り替え・助手とおしゃべり(試す)・ダンジョンRPG試作・旧バトル画面と旧チュートリアル・ビート体験版・試作7件)
- 言葉の直し残し: ヘルプの「勇者モン選択時」
- 「カボチャの大王ジャック：」の題の頭も外すか

## 見つけた物(まだ)

- `pgrep -f "run-checks.js"` で検査の終わりを待つと、待つ命令そのものに当たって終わらない(道具ではなく使い方の注意)
