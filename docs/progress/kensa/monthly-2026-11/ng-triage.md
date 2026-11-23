# main で落ちている検査 69 本の仕分け(受け持つ部ごと・見立て付き)

窓口の依頼(2026-11-23)。最新 main(#7316 時点)で 1 本ずつ回した結果。**見立ては、出力の最後の数行と止め絵 1 枚の範囲**で付けた(深追いしていない)。

- **古い** … 画面の今の形に合わせて検査を直せば済む見込み
- **壊れ** … 画面(またはデータ・絵)が壊れている見込み。測りの値が出ているものが多い
- **不明** … 出力だけでは分からない(部が画面を1枚見れば決まる)
- **時間切れ** … 3並列の負荷での時間切れの疑い。1本で回し直しが先

合計 69 本(古い 24・壊れ 21・不明 19・時間切れ 5)

## 部ごとの件数

| 部 | 件数 | 古い | 壊れ | 不明 | 時間切れ |
| --- | --- | --- | --- | --- | --- |
| 助手部 | 21 | 10 | 8 | 3 | 0 |
| 開発部 | 11 | 4 | 4 | 1 | 2 |
| ビート部 | 11 | 0 | 2 | 8 | 1 |
| カード部 | 10 | 2 | 3 | 4 | 1 |
| バトル部 | 7 | 5 | 1 | 1 | 0 |
| モンサク部 | 3 | 1 | 1 | 0 | 1 |
| モンスター部 | 3 | 1 | 1 | 1 | 0 |
| 検査部 | 2 | 1 | 0 | 1 | 0 |
| 各部 | 1 | 0 | 1 | 0 | 0 |

## 「壊れ」の見立ての上位(先に画面を見てほしい順)

1. HOME の細バナー×吹き出しでドック・顔バッジが重なる(`home-layout-check`・開発部)
2. カードバトルの吹き出しに「[object Object]」が出うる(`card-bubble-text-check`・カード部)
3. 320×568 でバトルの結果画面が描けない(`wave-result-layout-check`・バトル部)
4. 助手ライフ: HOME の「🏘 n」の印の重なり・立ち絵が小さすぎ・町の札の重なり・仲良し度の知らせが帯にかぶる(助手部)
5. 固有技強化の枠で「閉じる」が切れる(`unique-boost-screens-check`・モンスター部)
6. ランキング「すべて」タブが無い(2本・開発部)
7. 配信中の譜面 seasons_of_a_little_plaza の値(ビート部・触らず報告)
8. 画像(立ち絵のふち・白い塊)・更新履歴の並び・既読の印の漏れ(各部・直しは小さい)

## 全 69 本

### 助手部(21)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `assistant/sorashido-story-check.js` | 古い | flower3_2026_ep2/5/6/7/8 に monsters が付いている=ハナウタのお話は付ける仕様に変わった疑い(ビート部と確認) |
| `assistant/assistant-life-sheet-close-check.js` | 壊れ | シートの部品(AlfNoteConfirm・AssistantLifeGiftSheet ほか)に data-mhl-sheet-close が無い(ソース検査) |
| `assistant/assistant-life-map-check.js` | 壊れ | 横で町の札が重なる(札 ranch×札…) |
| `assistant/assistant-life-friend-browser-check.js` | 壊れ | HOME の「🏘 n」の印が顔バッジ・ほかのボタンに重なる(測りの値) |
| `assistant/assistant-life-scene-stand-browser-check.js` | 壊れ | 縦 390 でみゅあ・ももすけの立ち絵が重なる 38% |
| `assistant/assistant-art-scenes-check.js` | 壊れ | 助手の立ち絵が小さすぎ(最大 4.6px)・ばらつき 1.27。測りの値 |
| `assistant/life-fullbody-edge-check.js` | 壊れ | kyuko ほかの立ち絵のふちが硬い・半透明が足りない(画像の作り直し) |
| `assistant/life-fullbody-pocket-check.js` | 壊れ | mua.png に囲まれた白い塊 34611 画素(許す 28486) |
| `assistant/life-peer-label-check.js` | 古い | 「線の上の札(0)」=札が 0 件で測れていない。画面が変わって札が出なくなった(検査が古い)か、札が消えたか。ほぼ古い |
| `assistant/assistant-life-clarity-check.js` | 古い | 「見守る・贈るの札」「にぎわい」が null=型への載せ替えで場所が変わった |
| `assistant/assistant-life-ux-check.js` | 古い | 「家の上の得の1行目」firstN=0。同上 |
| `assistant/assistant-life-ux3-check.js` | 不明 | TimeoutError。出力に NG 行なし |
| `assistant/assistant-life-quick-lose-check.js` | 古い | 「負け→始め直し→止める」で live が出る。時計・待ちの条件が変わった疑い |
| `assistant/assistant-life-quick-run-browser-check.js` | 壊れ | rot で仲良し度の知らせが帯のボタン・時計にかぶる。「詳細」の窓が出ない(null) |
| `assistant/assistant-life-browser-check.js` | 古い | 「声をかけたあとの一言は別の部屋で消える」0→0=一言が出ていない。時間切れ(124) |
| `assistant/assistant-life-furn-browser-check.js` | 古い | お知らせの帯に「好きな家具 +40」が出ない。帯の文が変わった疑い。時間切れ(124) |
| `assistant/assistant-life-solo-browser-check.js` | 古い | お知らせの帯に仲良し度の量が出ない。同上 |
| `assistant/assistant-life-taste-check.js` | 不明 | click 時間切れ |
| `assistant/assistant-masmon-battle-row-check.js` | 古い | 部屋に「マスモンで対戦(β)」の行が null。行が「もっと見る」の中へ入った可能性が高い |
| `assistant/assistant-masmon-cheer-check.js` | 不明 | 「フレンドの登録編成を見つけたら friend(伸びは1)」。ロジックの値。出力本文で足りる |
| `assistant/life-success-entry-check.js` | 古い | 「みゅあ編で」「いまはみゅあ編だけ」が null。モンサクの入口の文が変わった疑い |

### 開発部(11)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `home-layout-check.js` | 壊れ | 細バナー×吹き出しでドックと顔バッジが重なる/外へ出る。2回再現・測りの値が出ている |
| `landscape-screens-check.js` | 古い | 「M/B管理から HOME へ戻る」「神殿へ入る」ボタンが見つからない=名前が変わった疑い |
| `boot/home-screen-guide-check.js` | 不明 | page.click が 30 秒で時間切れ。入口のボタンの形が変わった疑い。撮影1枚で足りる |
| `boot/ja-wrap-lines-check.js` | 壊れ | ひらがなの続きが入るのに途中で折れる行 10 件。測った値あり |
| `ui/time-of-day-clock-browser-check.js` | 時間切れ | Timeout。出力に NG 行なし。1本で回し直しが先 |
| `audio/bgm-check.js` | 古い | 「BGMアレンジ画面を閉じられない」同上。閉じるが下の丸ボタンになった |
| `audio/auto-bgm-picker-browser-check.js` | 古い | 「BGM設定を閉じられる」同上 |
| `image/art-content-box-check.js` | 古い | ART_CONTENT_BOXES が今の立ち絵と合わない。同じ作り直しコマンドで済む |
| `market/market-bubble-collapse-check.js` | 時間切れ | 出力に NG 行なし(Error)。1本で回し直しが先 |
| `ranking/power-ranking-check.js` | 壊れ | 「すべて」タブが無い。画面の仕様が変わったなら検査が古い。2本とも同じ |
| `ranking/power-ranking-browser-check.js` | 壊れ | 種族タブが「すべて」から並ばない(上と同じ原因) |

### ビート部(11)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `boot/ja-wrap-beat-multi-check.js` | 不明 | マルチ(320×568)が開けない。この環境の WebSocket 不通の疑い(マルチ係と同じ) |
| `boot/ja-wrap-beat-tutorial-check.js` | 不明 | 練習の案内が開けない(20秒時間切れ)。同上 |
| `boot/ja-wrap-beat-screen-check.js` | 不明 | モード選び・曲えらび(320×568)が開けない。同上 |
| `boot/ja-wrap-beat-extra-check.js` | 不明 | ランキング・マスモンが開けない。同上 |
| `mode/raid-jack-home-say-tap-check.js` | 不明 | 横で「吹き出しを出していない」。出ないのが仕様に変わったなら古い。HOME の吹き出し規則との照合が先 |
| `mode/rhythm-chart-v3-check.js` | 壊れ | seasons_of_a_little_plaza のクロスが押さえっぱなしの外側(配信中の譜面。触らず報告) |
| `mode/rhythm-hell-level-check.js` | 壊れ | seasons_of_a_little_plaza の HELL Lv が 44(社長の値 38 の±2の外)。譜面の値(触らず報告) |
| `mode/rhythm-result-effect-check.js` | 不明 | リザルトの難易度・コンボ数に色が付いていない。結果の絵1枚で足りる |
| `mode/rhythm-multi-layout-check.js` | 不明 | click 時間切れ。マルチは WebSocket 不通の疑い |
| `mode/rhythm-song-shop-check.js` | 不明 | 「▶ 試し聴き」で試聴が始まらない(音の環境かも)。実機の確認が要る |
| `mode/rhythm-gpu-band-check.js` | 時間切れ | 10分で時間切れ。重い検査(単独の組) |

### カード部(10)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `battle/card-icon-check.js` | 壊れ | t.icon g.icon d.icon を cardIconNode() を通さず描く所が残る(ソースの決まり違反。3か所を直す) |
| `card/card-bubble-text-check.js` | 壊れ | 60-app.jsx 25196 付近で吹き出しの text に JSX を渡している=画面に「[object Object]」が出うる |
| `card/card-rules-check.js` | 古い | 助手の立ち絵の範囲の表(126枚)が絵と合っていない。make-art-content-boxes.js で作り直すだけ |
| `card/card-bind-browser-check.js` | 時間切れ | 出力に NG 行なし(TimeoutError)。1本で回し直しが先 |
| `card/card-life-limit-browser-check.js` | 不明 | 「最後まで触れる」が waitFor 時間切れ。助手ライフの作り替えの影響の疑い |
| `card/card-life-reward-browser-check.js` | 古い | ソラシドの部屋に「カード部屋で対戦する」が見つからない=助手ライフの部屋が型に載り替わった |
| `card/card-battle-settings-browser-check.js` | 不明 | click が 30 秒で時間切れ |
| `card/card-deck-drop-dead-browser-check.js` | 不明 | 同上 |
| `card/card-double-tap-browser-check.js` | 不明 | 同上 |
| `card/card-foe-style-browser-check.js` | 壊れ | きき→みゅあに替えたとき立ち絵が欄の高さに合わない(欄80px・絵80px・測った輪郭)の測りが NG |

### バトル部(7)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `battle/battle-check.js` | 古い | 15項目中1つだけ OK。勇者モン選びから進めない=選び方が変わった。ボットは同じ画面を通れる |
| `battle/battle-tutorial-v2-check.js` | 古い | dispatchEvent が 30 秒で時間切れ。同系3本(v2・split・tactics) |
| `battle/battle-tutorial-split-browser-check.js` | 古い | 同上 |
| `battle/battle-tutorial-tactics-check.js` | 古い | 同上 |
| `battle/wave-result-layout-check.js` | 壊れ | 320×568 で結果の画面が描けない(内訳 最多/最少とも)。見た目の崩れの疑いが強い |
| `battle/quick-run-anywhere-strip-overlap-check.js` | 不明 | 「モンヒロビートの上では帯を出さない」縦も横も。帯が出ているなら壊れ。撮影1枚で足りる |
| `mode/extreme-browser-check.js` | 古い | 「閉じる」が3つに当たる(strict mode)=窓が増えた。検査の絞り込みを直す |

### モンサク部(3)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `boot/quiet-boot-seed-coverage-check.js` | 壊れ | MONSUC_STORY_SKIP_SEEN_KEY が INTRO_STORY_KEY_IDS に無い。1行足す |
| `ui/rotation-height-check.js` | 古い | 56-monhero-success-manual.jsx:334 の createPortal が「確かめてある一覧」に無いだけ。確認して一覧へ足す |
| `success/success-layout-check.js` | 時間切れ | 12分で時間切れ(124)。重い検査。1本で回し直しが先 |

### モンスター部(3)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `masu/unique-boost-screens-check.js` | 壊れ | 固有技強化の枠で「閉じる」の字が切れる(61px>53px・縦も横も)。測りの値あり |
| `masu/masu-enhance-layer-check.js` | 古い | null.click=強化の入口のボタンが見つからない |
| `masu/masu-growth-breakdown-check.js` | 不明 | waitFor 20秒時間切れ |

### 検査部(2)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `browser/feature-check.js` | 古い | 「音量設定を開ける — ボタンが見つからない」=設定の窓の作り替え(閉じる丸ボタン化 11-19)に検査が追いついていない疑い |
| `team/team-tools-check.js` | 不明 | トークン節約の道具に 6 件の問題。出力の本文で足りる |

### 各部(1)

| 検査 | 見立て | 理由(1行) |
| --- | --- | --- |
| `boot/changelog-order-check.js` | 壊れ | 書いてある順が日付の新しい順でない所が 12 か所(表示は並べ替え済みで画面は正しい)。データの並べ直しで済む |
