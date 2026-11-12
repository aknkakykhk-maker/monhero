# モンヒロサクセスの景色(住む場所・大会の会場・修行の段)

社長の決め(2026-11-12): 住む場所の景色は **季節と時間で替わる**・明るくて遊びたくなる・まわりの帯とボタンは暗い紺のまま。
19枚は Claude が SVG で描いて PNG にした(外の画像AIは使っていない。参考の動画 `docs/reference/line-mf/` は
「住む場所が大きく、真ん中の地面に子が立つ」という組み立て方だけを見て、絵・形・色は写していない)。

- 表の正本: `monster-hero/data/success-scenes.js`(`SUCCESS_SCENES`・`successHomeScene(season, time)`・`successSeasonOfMonth(month)`。まだ index.html からは読まれない。画面は回2・回3)
- 絵: `monster-hero/images/success/scenes/<id>.png`(1080×1920・色数を絞った PNG・1枚 40〜190KB・19枚で約1.7MB)
- 元の SVG: `tools/art-sources/success/scenes/<id>.svg` / 作る道具: `node tools/success/scene-art.js`(`--check` でそろっているかだけ・`--only <id>` で1枚だけ)
- 一覧の絵: [`scenes-sheet.png`](scenes-sheet.png)(1枚ごとに「景色だけ」と「帯・ボタン・育てる子を重ねた見え方」を並べた)

## 並び

| 種類 | id | 中身 |
| --- | --- | --- |
| 住む場所 12枚 | `home-<spring/summer/autumn/winter>-<day/evening/night>` | 左に家(赤い屋根・肉球の丸窓)・右に大きな木・真ん中に土の広場。春=桜とチューリップと花びら / 夏=緑の木・ひまわり・入道雲・夜はほたる / 秋=紅葉・かぼちゃ・落ち葉 / 冬=雪の屋根・雪だるま・降る雪。夕方は夕日と暖かい色、夜は月と星・窓と灯籠が光る(暗くしすぎず明るい紺) |
| 大会の会場 4枚 | `venue-debut` / `venue-cup` / `venue-hero` / `venue-summit` | デビュー戦=木の観客席とテント・旗 / ★〜★★★と期末の強制大会=石の観客席と芝の円 / ヒーロー記念=金の縁どり・紋章・光の柱・紙吹雪 / 頂への道=雲の上の石の舞台・昇る日・古い柱 |
| 修行の段 3枚 | `training-volcano` / `training-iceberg` / `training-waterfall` | 火山・氷山・大滝(どの段にどれを使うかは回2・回3で決める) |

季節は月で決める(春 3〜5月・夏 6〜8月・秋 9〜11月・冬 12〜2月)。時間(昼・夕方・夜)の替え方は回2・回3で決める。

## 画面の決まり(描くときに守ること)

- 縦 1080×1920。上の約15%(y<290)は帯、下の約30%(y>1344)はボタンで隠れる。見せたい物は y 290〜1344 に置く
- 育てる子は真ん中に立つ(足もと y≈1190・高さ約650)。真ん中(x 330〜750・y 520〜1190)は込み入った物を置かず、色の差を小さくする。見どころは左右へ
- 光は左上(アイテムの絵とそろえる)。夜でも暗くしすぎない(社長「明るくて遊びたくなる」)

## 新しい景色を足す手順

1. `monster-hero/data/success-scenes.js` の `SUCCESS_SCENES` に1行足す(`id` は英小文字とハイフン・`image` は `images/success/scenes/<id>.png`・`kind` は home / venue / training)
2. `tools/success/scene-art.js` に描き方を足す。住む場所の季節や時間は `SEASON`・`SKY`・`TIME_TINT` に1つ足せば `homeScene` が描く。会場・修行は関数を1つ書き、`artFor` の表に id を足す
   - 部品: 雲 `cloud()` / 稜線 `ridge()` / 観客席 `stands()` / 旗の列 `bunting()` / 旗 `flagPole()` / きらめき `star4()` / 星 `star5()`
   - 真ん中の広場は `FEET_Y` を中心にした楕円(色は明るめ・ふちはぼかす)
3. `node tools/success/scene-art.js --only <id>` を打つ(SVG・PNG・一覧の絵が作り直される)
4. `scenes-sheet.png` を開き、右側(帯・ボタン・子を重ねた見え方)で子が埋もれていないか・ほかと並べて浮いていないかを見る
5. `node tools/build.js` → `node tools/image-asset-check.js` → `node tools/run-checks.js --changed`
