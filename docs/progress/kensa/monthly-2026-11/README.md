# 月次点検 2026-11(検査部・ミハリ)

台帳 r1119-111(社長「最近やってなかった月例点検しときたい」)。点検は見つけて報告するだけ(直していない)。
直したのは「道具が古くて誤って NG を出していた」ボットの3か所だけ(下の「道具を直した所」)。
点検の日時: 2026-11-22 15:00〜2026-11-23 10:15(JST の 11-23 0:00〜19:15 ごろ)。

## 先に読む(結論)

- **全検査 1083 本: 初回 NG 86 本。最新の main に取り込んで回し直すと 69 本が NG のまま・17 本は通った**(直っていた)。
  回し直しで通った17本には「きき加入の会話(呼び方)」「撮り比べ」「ルール索引」などが入る。残りの69本のうち 6 本は時間切れ(重い検査を3並列で回したため。再現は弱い)
- **高 5 件**(下の表)。とくに ①切り欠き(横向き 56 件・縦 1 件)②HOME の顔バッジと吹き出しの重なり ③吹き出しが「[object Object]」になりうる所
- 遊ぶ点検 4 班: 初回は ❌ が 5 担当(バトル・マルチ・新人・ストーリー・時間と保存の一部)。**うちバトル・AUTO・新人の ❌ はボットが古かった**ので直し、❌ は消えた(下)
- 衛生チェック: 異常なし(⚠️ は基準値が古いだけ。下の低)

## やり方と、やり方を変えた所(正直に)

| 項目 | やったこと |
| --- | --- |
| 準備 | `cd tools && npm ci`(`--omit=optional` なし) |
| ① 月次メンテ | `node tools/maintenance.js --full --write` を後ろで回したが、**直列だと 3 時間 40 分たっても約 3 割**(card まで)で、全部で 6 時間を超える見込み。**止めて**、同じ全検査を `node tools/run-checks.js --area all --parallel 3` で回し直した(1083 本・約 3 時間 20 分)。衛生チェックは `node tools/maintenance.js --hygiene-only` を別に回した。**そのため `docs/ops/maintenance/latest.md` は書き換えていない**(全検査の結果は本書が正) |
| 回し直し | 全検査の最後の「1本で回し直し」は 29 本で止めた(29 本すべて再現)。残りは、初回 NG の 86 本を **最新の main(#7302 まで・点検の最初から 138 コミット進んでいた)** に取り込んだ枝で 1 本ずつ回し直して仕分けた |
| ② 撮り比べ・切り欠き | `node tools/browser/visual-compare-check.js --head-only`(23 画面・73 枚・188 秒・すべて撮れた)。切り欠きは縦 上47/下34・横 左右47/下21。分析 API は使っていない |
| ③ 遊ぶ点検 | `node tools/playbot/playbot.js --team battle / rhythm / patrol / guard` を順に(この会話で)。ランキングへは送っていない(にせの Supabase が受け止める) |
| ④ 決まりの突き合わせ | 下の「決まりの突き合わせ」 |

## 見つけた物(高・中・低)

受け持ちの名前: ビート部 / カード部 / バトル部 / モンスター部 / モンサク部 / 助手部(助手ライフ) / 開発部(土台・HOME・共通) / 検査部(道具)。

### 高

| # | 画面・場所 | 起きること | 根拠 | 受け持ち |
| --- | --- | --- | --- | --- |
| H1 | 横向きの全画面(切り欠き) | 押す物が左右の切り欠きの帯に 31〜45px 入る。HOME 11 件(右「ソラシドがいます」45px・「更新履歴」41px・「ミッション」41px・左「モンヒロサクセスβ」39px)、ヘルプ 11、モンヒロバトル(仕組み選び)8・曲えらび 8・モンヒロビート入口 6(「戻る」左39px)・クラシック対戦中 5・マーケット 4・設定 2・クラシックのモード選択 1。**縦は ヘルプの「💊」下30px の 1 件だけ**。すべて「前からある」(main にも有る)。計 57 件 | `visual-compare-check.js --head-only`(HEAD=main) | 開発部(共通の枠)。画面ごとは各部 |
| H2 | HOME(ふつうの台詞・長い台詞) | 「細バナー × 吹き出し」のとき、ドックと顔バッジが重なる/画面の外へ出る | `home-layout-check.js`(最新 main で再現・2回) | 開発部(HOME) |
| H3 | カードバトルの吹き出し | 吹き出しへ渡す text に部品(JSX)を入れている所があり、「[object Object]」と出る(`60-app.jsx` 25196 行付近) | `card/card-bubble-text-check.js`(再現) | カード部 |
| H4 | 助手ライフ(部屋・家・友情・地図) | 23 本が NG: 部屋に「マスモンで対戦(β)」の行が出ない・家の上の「得」の1行目が出ない・お知らせの帯に仲良し度の量が出ない・「カード部屋で対戦する」が出ない・「みゅあ編で」が出ない・HOME の「🏘 n」の印が顔バッジに重なる・立ち絵が小さすぎ(最大4.6px)ほか。型への載せ替え(段7 以降)で**検査が古いのか本当に消えたのか**を仕分けが要る | `assistant/*`(最新 main で 20 本再現) | 助手部 |
| H5 | 助手ライフの「閉じる」 | シートを出す部品(`AlfNoteConfirm` ・`AssistantLifeGiftSheet` ほか)が「閉じる」ボタン(`data-mhl-sheet-close`)を持っていない | `assistant-life-sheet-close-check.js` | 助手部 |

### 中

| # | 画面・場所 | 起きること | 根拠 | 受け持ち |
| --- | --- | --- | --- | --- |
| M1 | モンヒロビートの曲選び(縦 390) | 助手の吹き出し「横画面にすると、曲の一覧と選んだ曲を並べて見られるの、べんり」が 292px で幅 257px から切れる。「本オープン記念キャンペーン」(360×640)も 119>113px。難易度の「MASTERで解放」の字が 34〜39px 画面の外へ(見えない所なら誤検出) | 見た目係(6 件) | ビート部 |
| M2 | モンヒロビートのマルチ | 部屋に「マスモンを呼ぶ」が無い・「メンバー確定」が押せない(画面は「つなぎ直しています…」)。コンソールに本番の WebSocket(realtime)が 500 で失敗。**この点検の環境が WebSocket を通さないだけの可能性が高い**(ja-wrap-beat 系の「モード選びが開けない」も同じ疑い)。本番の実機で確かめてほしい | マルチ係・時間と保存係・見回り係 | ビート部(実機確認) |
| M3 | 曲 seasons_of_a_little_plaza | EXPERT/MASTER で「クロスが押さえっぱなしの外側にある」(156・596・266 ほか)。HELL の Lv が v4=44 で、社長の値 Lv.38 の ±2 の外(v3 も 44)。**配信中の譜面なので触らず報告のみ** | `rhythm-chart-v3-check.js` `rhythm-hell-level-check.js` | ビート部 |
| M4 | 助手のお話(ハナウタ・ノート) | `flower3_2026_ep2/5/6/7/8` に `monsters` が付いている(ほかのお話には付けない決まり) | `sorashido-story-check.js` | ビート部 / 助手部 |
| M5 | 戦力ランキング | 「すべて」タブが無い(種族タブが「すべて」から並ばない) | `power-ranking-check.js`(+browser) | 開発部(ランキング) |
| M6 | 固有技の強化画面 | 枠の中で「閉じる」の字が切れる(61px>53px・縦も横も) | `masu/unique-boost-screens-check.js` | モンスター部 |
| M7 | 全WAVE詳細(HELL) | 窓に「← 戻る」が無く「×」だけ。ボットが「← 戻る」を押しても画面が変わらない(窓の裏のボタンを押した=窓の裏へタップが抜ける疑い) | 見回り係の探検 | バトル部 |
| M8 | モンサクの「β版のお話」 | 「次へ ▶」が押せるボタンとして見つからない(行き止まり判定)。実機で押せるか確認 | 時間と保存係 | モンサク部 |
| M9 | モンサクの既読の印 | `MONSUC_STORY_SKIP_SEEN_KEY` が `quiet-boot-seed.js` の `INTRO_STORY_KEY_IDS` から漏れている | `quiet-boot-seed-coverage-check.js` | モンサク部 |
| M10 | カードの絵 | `t.icon` `g.icon` `d.icon` をそのまま描いている所が残る(`cardIconNode()` を通す決まり)。助手の立ち絵の範囲の表(126 枚)が今の絵と合っていない(`make-art-content-boxes.js` の作り直し) | `card-icon-check.js` `card-rules-check.js` `art-content-box-check.js` | カード部 / 開発部(画像) |
| M11 | 検査が古い疑い(遊べてはいる) | クラシックバトル `battle-check.js` は 15 項目中 1 項目だけ OK(勇者モン選びから進めない)。`battle-tutorial-*` 3 本・`card-*-browser` 10 本・`ja-wrap-beat-*` 4 本・`feature-check.js`(音量設定が開けない)・`bgm-check.js`(BGMアレンジ画面を閉じられない)も時間切れや見つからない。**ボットは同じ画面を通れる**ので、画面ではなく検査の操作が古い疑い | 上の検査 | 検査部(次の作業) |
| M12 | 画像 | 立ち絵のふちが硬い・白い塊が残る(kyuko・mua ほか) | `life-fullbody-edge-check.js` `life-fullbody-pocket-check.js` | 助手部(画像) |

### 低

| # | 画面・場所 | 起きること | 受け持ち |
| --- | --- | --- | --- |
| L1 | 更新履歴(データ) | 書いてある順が日付の新しい順でない所が 12 か所(表示は並べ替えているので画面は正しい)。点検の最初には「日時が実際のコミット時刻と合わない 1 件」もあった | 各部(検査部が検査を見守る) |
| L2 | 更新履歴(文) | 11-04 の「別絵キラ」は決まり(10-31「レアキラ」)の前のまま。11-15 は「別絵キラ(レアキラ)」と併記。咲かせて！ハナウタ・ノートの項目の上のコメント(「2曲目・3曲目の曲名は書かない」)と、本文(3曲とも書いてある)が食い違う(開始が 11-23 10:00 で今は公開後なので本文はこのままでよい。コメントが古い) | ビート部 |
| L3 | 文章の折り返し | ひらがなの続きが 1 行に入るのに途中で折れる行が 10 件(「イベントにし／ちゃお！っ」ほか) | 開発部(UI) |
| L4 | 回転時の窓 | `56-monhero-success-manual.jsx:334` の `createPortal(…, document.body)` が「確かめてある一覧」に無い | モンサク部 |
| L5 | 点検の道具 | `rules-index-check`(通った)・`team-tools-check`(トークン節約の道具に 6 件の問題) | 検査部 |
| L6 | 衛生チェック | 基準値が古く、毎回 ⚠️(images 368MB・audio 333MB・compiled 11.8MB など)。`--update-baseline` の取り直しを検討 | 検査部 |
| L7 | 小さいボタン(32px 未満) | HOME の時計・助手の顔、「中身を見る」、「1体目」ほか。改善のヒント(班全員が出す) | 開発部 |
| L8 | ストーリー係 | 「イベント回想」に見返せるものが 0 と出る(プロフィールは 24/58)。ボットの見方が古い疑い | 検査部 |
| L9 | 時間と保存係 | キャンペーン終了後(11/30 01:00)に HOME の「モンヒロビート」の札が出ていると指摘。常設の入口なので判定が古い疑い | 検査部 |
| L10 | 演出中の行き止まり | 「仲良し度UP!」の演出中は押せるボタンが無い(ボットの待ちが足りないだけ) | 検査部 |

## 遊ぶ点検(4 班)の結果

| 班 | 担当ごと | NG と原因 |
| --- | --- | --- |
| バトル(battle) | バトル係 ✅(直したあと)・イベント係 ✅・**タクティクス ✅ 全10 WAVE クリア(32〜33 ターン・倒れた 0〜1 回)** | 初回の ❌ は「勇者モンを選ぶ」の「詳しく見る」(漢字にした)をボットが探せなかったため。**ボットを直して ✅**。AUTO 180 秒で W10 まで進む。イベント(レイド)は開催なし |
| 音ゲー(rhythm) | 音ゲー ✅(EXPERT・スコア 805,825・MISS 15)・ランキング ✅・横画面 ✅(8 か所とも閉じられた・250 ノーツ・MISS 9)・レイド音ゲー ✅(開催なし) | **マルチ係 ❌**(M2・環境の疑い)。コンソールの WebSocket 500 |
| 見回り(patrol) | 見回り係 ✅(入口 16 か所)・見た目係 ✅(小さい画面でも MASTER 789 ノーツ・MISS 35)・ストーリー係(L8)・**新人係 ❌→直して ✅** | 新人係の初回 ❌ は、助手選びの「この助手にする」を押さずに「みゅあを選ぶ」だけを押し続けるボットの古さ。直して 15 手・16 秒で終わる。見た目: M1、全WAVE詳細(M7) |
| 守り(guard) | 久しぶり ✅・時計(L9)・数字係 ✅・意地悪係 ✅・通信不良 ✅(控え 1→0 件・送り直し 1 件) | 数は全部合った。二度押しも 1 回分だけ。昔のセーブは持ち物が残った。行き止まり 1 件(M8) |

**保存データ・ランキング: 守り班で壊れた所なし**(二度押し・読み込み直し・通信切れ・昔のセーブ)。

## 決まりの突き合わせ(④)

| 見る物 | 結果 |
| --- | --- |
| 更新履歴に内部の仕組みを書いていないか(台帳 2026-10-23) | 11 月分 449 件を語で走査(判定・出し分け・並べ替え・キー・ID など 20 件ヒット)。**全部プレイヤーに見える動きの文**で、内部の仕組みの説明は無し。✅ |
| 助手どうしの呼び方(台帳 2026-11-05 ほか) | `callname-check` `player-call-check` `assistant-peer-check` `assistant-call-honorific-check` すべて ✅。点検の最初に NG だった「きき加入の会話でみゅあがききを『ひめちん』と呼んでいない」は、**最新の main で直っていた** ✅ |
| 画面の文の漢字(戻る・閉じる等) | `ui-kanji-check` ✅。`もどる/とじる` のひらがなのボタン表記は無し ✅ |
| ネタバレ | `unreleased-assistant-hidden-check` ✅・`fuda-word-check`(「札」)✅。更新履歴に先の日の中身なし(咲かせて！ハナウタ・ノート: 開始後の公開分のみ) ✅ |
| 「札」「ブリーダー」など | ✅ |

## 道具を直した所(誤って NG を出す古さだけ)

- `tools/playbot/scenarios/battle.js` … 勇者モンのカードを探す語に「詳しく見る」を追加(漢字にそろえた 11-14 の変更に追いついていなかった)
- `tools/playbot/scenarios/tactics.js` … 同じ語を除外側にも追加
- `tools/playbot/scenarios/new-player.js` … 助手選びで「この助手にする」を先に押す(「みゅあを選ぶ」で止まり続けて 150 手を使い切っていた)

直したあとに `--only battle,auto,new` を回し、バトル・AUTO・新人がすべて ✅(新人は 15 手・16 秒)。

## 次にやること(窓口へ)

1. H1 切り欠き(横向き 56 件)を画面ごとに部へ振る — 台帳 r1119-110 の「切り欠きありで点検し直す」とつながる
2. H2・H3 は遊ぶ人に見える崩れなので先に
3. H4・M11 は「検査が古い」か「画面が壊れている」かの仕分けが先(助手部・検査部)
4. 回し直しで残りの 6 本(時間切れ)は、負荷の低いときに 1 本ずつ

## 点検の再現

```
cd tools && npm ci
node tools/run-checks.js --area all --parallel 3 --json <出力先>      # 全検査
node tools/maintenance.js --hygiene-only                               # 衛生チェック
node tools/browser/visual-compare-check.js --head-only                 # 撮り比べ(枝だけ)
node tools/playbot/playbot.js --team battle|rhythm|patrol|guard        # 遊ぶ点検
```

## 追記(窓口からの追加依頼・2026-11-23 昼)

### 撮り比べの揺れ(助手ライフ マスモン)
- `--self`(同じ版どうし)で、縦 0.3〜2.8%・横 2.2〜9.4% の違いが毎回出る。止め絵を見ると、**同じマスモン(もち隊長)でもレベルと見た目が違う**(Lv.26 と Lv.24・別の姿)。つまり画面を撮る道具の揺れではなく、**ゲームが開くたびにマスモンの育ち(実時間で進む `amgTick`・`Date.now()` 基準)と姿を決めており、撮り比べの時計の固定と乱数の種が効いていない**
- 試した直し: タブを開く直前に乱数の種を入れ直す → **効かなかったので戻した**(コードは変えていない)。
- 次の手: ①`__vcFreeze` でこの場面だけ時計を止める ②マスモンの枠(`.rounded` の1枚目・立ち絵とレベル)を `hide` に足す。①を先に試す(検査部の次の作業)

### main でも落ちている検査(最新 main で 1 本ずつ回し直した結果)
依頼で名指しされた 4 本: `boot/home-screen-guide-check.js` = **NG**(実物を最後まで確かめられない・クリックがタイムアウト) / `ui/rotation-height-check.js` = **NG**(`56-monhero-success-manual.jsx:334` の `createPortal(…, document.body)` が確認済み一覧に無い) / `assistant/life-success-entry-check.js` = **NG**(「みゅあは『みゅあ編で』」が出ない) / `mode/rhythm-touch-bridge-check.js` = **通った**(初回は負荷での時間切れ)。

NG のまま(63 本・時間切れ 6 本)。部の受け持ちは上の表のとおり:
- `assistant/assistant-life-quick-lose-check.js`
- `landscape-screens-check.js`
- `assistant/assistant-life-clarity-check.js`
- `home-layout-check.js`
- `assistant/assistant-art-scenes-check.js`
- `assistant/assistant-life-ux3-check.js`
- `assistant/life-peer-label-check.js`
- `assistant/assistant-life-quick-run-browser-check.js`
- `assistant/sorashido-story-check.js`
- `assistant/assistant-life-browser-check.js`
- `assistant/assistant-life-friend-browser-check.js`
- `assistant/assistant-life-scene-stand-browser-check.js`
- `assistant/assistant-life-furn-browser-check.js`
- `battle/battle-tutorial-tactics-check.js`
- `battle/battle-tutorial-split-browser-check.js`
- `assistant/assistant-masmon-battle-row-check.js`
- `assistant/assistant-life-sheet-close-check.js`
- `assistant/assistant-life-map-check.js`
- `assistant/life-fullbody-edge-check.js`
- `assistant/assistant-life-ux-check.js`
- `assistant/assistant-life-taste-check.js`
- `battle/quick-run-anywhere-strip-overlap-check.js`
- `assistant/assistant-masmon-cheer-check.js`
- `audio/auto-bgm-picker-browser-check.js`
- `battle/wave-result-layout-check.js`
- `boot/changelog-order-check.js`
- `assistant/life-fullbody-pocket-check.js`
- `assistant/assistant-life-solo-browser-check.js`
- `boot/home-screen-guide-check.js`
- `assistant/life-success-entry-check.js`
- `battle/battle-tutorial-v2-check.js`
- `audio/bgm-check.js`
- `battle/card-icon-check.js`
- `boot/ja-wrap-beat-multi-check.js`
- `battle/battle-check.js`
- `boot/ja-wrap-beat-tutorial-check.js`
- `boot/quiet-boot-seed-coverage-check.js`
- `card/card-bind-browser-check.js`
- `boot/ja-wrap-lines-check.js`
- `boot/ja-wrap-beat-screen-check.js`
- `boot/ja-wrap-beat-extra-check.js`
- `browser/feature-check.js`
- `card/card-life-limit-browser-check.js`
- `card/card-battle-settings-browser-check.js`
- `card/card-bubble-text-check.js`
- `card/card-deck-drop-dead-browser-check.js`
- `card/card-life-reward-browser-check.js`
- `card/card-rules-check.js`
- `card/card-double-tap-browser-check.js`
- `mode/raid-jack-home-say-tap-check.js`
- `image/art-content-box-check.js`
- `masu/masu-enhance-layer-check.js`
- `card/card-foe-style-browser-check.js`
- `masu/unique-boost-screens-check.js`
- `mode/extreme-browser-check.js`
- `market/market-bubble-collapse-check.js`
- `mode/rhythm-chart-v3-check.js`
- `mode/rhythm-hell-level-check.js`
- `masu/masu-growth-breakdown-check.js`
- `ranking/power-ranking-browser-check.js`
- `ranking/power-ranking-check.js`
- `mode/rhythm-result-effect-check.js`
- `mode/rhythm-multi-layout-check.js`
- `ui/rotation-height-check.js`
- `team/team-tools-check.js`
- `mode/rhythm-song-shop-check.js`
- `ui/time-of-day-clock-browser-check.js`
- `success/success-layout-check.js`
- `mode/rhythm-gpu-band-check.js`

(通った 17 本: assistant-face・kiki-intro・rules-index・life-rel-scene・life-profile-faces・card-focus-browser・visual-compare・card-battle-browser・raid-jack-home-aura・card-shop-two-tabs・rhythm-option-preview・rhythm-landscape-layout・rhythm-song-list-scroll・ghost-browser・screen-render-cost・rhythm-multi-assist-result・rhythm-touch-bridge)

直せる物はこの会話では直していない。多くは「検査が古い」か「画面が変わった」の仕分けが先で、受け持つ部が画面を見て決めるため(M11・H4)。

### 画像の片付け(孤立画像)について
窓口の追加依頼(使っていない画像を `docs/archive/unused-images-2026-11/` へ)は、**台帳 r1119-121・r1119-124 で開発部(土台)の仕事になっている**ため重ねて動かさず、**何も移していない**(移した 0 枚・保留 0 枚・減った大きさ 0MB)。調べて分かったこと:
- `maintenance.js` の孤立画像の検査は、いまの main で候補 **0 枚**(`data/` の一覧にどの画像の名前も書かれているため、名前の照合では何も見つからない)
- 生成の一覧(`asset-manifest.json`・compiled など)を除いて名前だけで数えると候補 1,770 枚(349.5MB)になるが、カードバトルの絵 1,018 枚(`card-battle/l`・`s`)や助手の表情・立ち絵のように**名前を組み立てて読む物が大半**で、**この数は使わない物の数ではない**。実行時に読まれた画像の記録との照合(r1119-064 の方法)が要る
