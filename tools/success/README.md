# tools/success/ (モンヒロサクセスの道具)

- `success-sim.js` / `success-sim-check.js` / `success-script-check.js` / `monhero-success-check.js` / `load.js` … 計算の芯の試算と検査
- `success-soak-check.js` … 芯の通し検査。いろいろな編成・助手・持ちこみ・作戦で 46ターンを最後まで回し、値の範囲・デビュー戦3回負け・砂時計のやり直しの数え・同じ id で同じ結果・中断と再開(restore)で結果が変わらないことを見る(数秒・`--runs 200` で増やせる)。芯の既知の不具合は表 `KNOWN` で警告にとどめ、直ると「✓ 直った」と出る
- `success-screen-browser-check.js` … 画面の通し検査(本物のブラウザ・数分)。デバッグの入口 → はじめる6段 → 数ターン → 中断 → 読み直して再開 → 続き を縦390・横844・幅320 で通し、真っ白・エラー・はみ出しを見る。印が偽のとき通常プレイに何も出ず mh_monsuc_* を書かないことも。画面(回2)が無いときは見送り。`SHOT_DIR=<フォルダ>` で止め絵も撮る
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
