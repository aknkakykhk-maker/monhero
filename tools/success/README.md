# tools/success/ (モンヒロサクセスの道具)

- `success-sound-check.js` … 音の割り当て表(`data/success-sounds.js`)と鳴らす口の見張り
- `success-sim.js` / `success-sim-check.js` / `success-script-check.js` / `monhero-success-check.js` / `load.js` … 計算の芯の試算と検査
- `build-script.js` … 台本(docs の正本)→ ゲームが読む `data/monhero-success-script-*.js`。`success-script-engine-check.js` が台本エンジンを見張る
- `item-icons.js` … アイテムの絵を SVG で描いて PNG にする(元の SVG は `tools/art-sources/success/items/`)

## 新しいアイテムの絵を1つ足す手順

参考の画面の絵は切り抜いて使わない(よそのゲームの絵そのもの・数や文字が重なる・小さくてぼやける)。いまの15枚と同じ部品で描く。

1. `monster-hero/data/success-items.js` の `SUCCESS_ITEMS` に1行足す(`id` は英小文字とハイフン・`image` は `images/success/items/<id>.png`・`kind` は retry / start / use / ticket)
2. `item-icons.js` の `ART['<id>']` に絵を1つ足す。次の部品を使うと、いまの15枚とそろう
   - ふちの線 `line`(こげ茶 #3d2618・太さ9)/ 細い線 `thin` / 足もとの影 `groundShadow()` / きらめき `sparkle()` / 星 `star5()` / 金のグラデーション `GOLD`
   - 光は左上: グラデーションは左上を明るく、白い半透明の筋を左上側に1本
   - 中身は 512 の枠の 50〜460 に収める(余白1割)。文字・数字・ロゴは入れない
3. `node tools/success/item-icons.js` を打つ(SVG・PNG・一覧の絵 `docs/progress/player-raise/art/items-sheet.png` がまとめて作り直される。表と絵の数が合わないと止まる)
4. 一覧の絵を開き、64px でも何の物か読めるか・ほかと並べて浮いていないかを見る
5. `node tools/build.js` → `node tools/image-asset-check.js` → `node tools/run-checks.js --changed`

対応表: `docs/progress/player-raise/art/ITEMS.md`

## 景色の絵(住む場所・大会の会場・修行の段)

- `scene-art.js` … 景色(1080×1920)を SVG で描いて PNG にする(元の SVG は `tools/art-sources/success/scenes/`・表は `monster-hero/data/success-scenes.js`)
- 足し方・画面の決まり・一覧の絵: `docs/progress/player-raise/art/SCENES.md`
