# tools/success/ (モンヒロサクセスの道具)

- `success-sound-check.js` … 音の割り当て表(`data/success-sounds.js`)と鳴らす口の見張り
- `success-sim.js` / `success-sim-check.js` / `success-script-check.js` / `monhero-success-check.js` / `load.js` … 計算の芯の試算と検査
- `success-soak-check.js` … 芯の通し検査。いろいろな編成・助手・持ちこみ・作戦で 46ターンを最後まで回し、値の範囲・デビュー戦3回負け・砂時計のやり直しの数え・同じ id で同じ結果・中断と再開(restore)で結果が変わらないことを見る(数秒・`--runs 200` で増やせる)。芯の既知の不具合は表 `KNOWN` で警告にとどめ、直ると「✓ 直った」と出る
- `success-screen-browser-check.js` … 画面の通し検査(本物のブラウザ・数分)。デバッグの入口 → はじめる6段 → 数ターン → 中断 → 読み直して再開 → 続き を縦390・横844・幅320 で通し、真っ白・エラー・はみ出しを見る。印が偽のとき通常プレイに何も出ず mh_monsuc_* を書かないことも。画面(回2)が無いときは見送り。`SHOT_DIR=<フォルダ>` で止め絵も撮る
- `success-shoot.js` / `success-layout-check.js` … 全画面×7つの大きさの並びの見張り(押せる大きさ・字の小ささ・はみ出し・重なり・字の真ん中)。本体は shoot で、`SHOT_ONLY=<場面>`・`SHOT_SIZES=<大きさ>` で絞れる。layout-check は大きさごとに4組へ分けて同時に回し、出た NG を場面×大きさごとに単独で再実行して flake(並列の過負荷でだけ落ちたもの)と実物を切り分ける。`--jobs 1` で1組ずつ(低並列)、`--no-retry` で切り分けなし
- `success-suite.js` … 点検の束ね(下の「点検の回し方」)
- `monsuc-rank-shot.js` … 総合力ランキング画面の止め絵と safe-area の効き。Supabase は空で返して空の状態を見て、`--mh-sa-top` 模擬で戻るボタンが時計帯を避けるか測る。`SHOT_DIR=<フォルダ>` で止め絵の置き場所
- `msx-glyph-probe.js` … ボタンの字の真ん中ずれを DOM 矩形と画素の2方式で測り、`padding-left` の候補を比べて直す量を決める(`--scene s0 / birth`)
- `monhero-success-events-check.js` … ランダムイベント(`monster-hero/data/monhero-success-events.js`)の表の形・台本との突き合わせ・決まった乱数・1回の育成の回数。試算は `success-sim.js --no-events` で出来事なしと比べられる
- `monsuc-event-result-check.js` … 育成イベントで選んだあとに結果(動いた数字の札)が出るか。全部の出来事・選択肢を芯に通し、何も動かない選択肢は一覧の物だけ
- `success-act-crew-shoot.js` … トレーニングの演出に、いっしょにいた編成の子(友情タッグは金色)と助手が出るか。`SHOT_DIR=` で止め絵
- `monsuc-fuse-check.js` … 合体(56-monsuc-fuse.jsx)の保存の順番・失敗で何も消えない・二重押し / `monsuc-fuse-browser-check.js [--shots]` … 合体の画面を本物のゲームで(止め絵 docs/progress/player-raise/shots/fuse-*.png)
- `build-script.js` … 台本(docs の正本)→ ゲームが読む `data/monhero-success-script-*.js`。`success-script-engine-check.js` が台本エンジンを見張る
- `item-icons.js` … アイテムの絵を SVG で描いて PNG にする(元の SVG は `tools/art-sources/success/items/`)
- `success-r3-shoot.js` … 回3の画面(大会・修行・引退・ゲームオーバー・保存枠へしまう)を本物のブラウザで開き、真っ白・はみ出し・エラー・「保存枠に1回だけ入る」を見る(`SHOT_DIR=<フォルダ>` で撮る)

## 点検の回し方

芯 → 画面の順に、軽いものから回す。束ねは `success-suite.js` が順に回して最後に1枚の要約(OK / NG / 環境不足)を出す。

```
node tools/success/success-suite.js            … 全部(15〜20分ほど)
node tools/success/success-suite.js --quick    … レイアウトを縦390だけにして短く
node tools/success/success-suite.js --only soak,core,sim   … 芯だけ(数秒〜十数秒)
```

1. `success-soak-check.js`(芯の通し・数秒)… 何十回も最後まで回して壊れないか
2. `monhero-success-check.js`(芯の決まり・1秒ほど)… 決まった乱数で同じ結果か、倍率・回復などの決まり
3. `success-sim-check.js`(試算の形・数秒)… 育ち方の中央値が想定の帯にあるか
4. `success-screen-browser-check.js`(画面の通し・数分)… 入口から実際に押して進め、中断と再開まで
5. `success-layout-check.js`(画面の並び・10分ほど)… 全画面×7つの大きさ

### flake の見分け方

ブラウザの検査は、機械の負荷が高いときだけ落ちることがある(子がタイムアウトする・演出の途中の半透明を拾う等)。1回落ちただけで直しに行かない。

- layout-check は自動で切り分ける。最初の実行で出た NG を場面×大きさごとに単独で再実行し、消えたものを `flake` と付けて出し、残ったものだけを実物の NG として数える。直すのは実物だけ
- 「未切り分け」と出たものは、再実行の上限(12組・4分)に当たって確かめ切れなかったもの。失敗に数えているので、機械が空いているときに単独で回し直す(`SHOT_ONLY=<場面> SHOT_SIZES=<大きさ> node tools/success/success-shoot.js`)
- ほかのブラウザ検査でも、まず単独でもう1回回して再現するかを見る。再現しないものは flake として報告にそう書く

### 足りないファイル(環境不足)

作業コピーが sparse checkout などで `docs/` や `supabase/` を含まないと、それらを読む検査が ENOENT で止まる。これは変更の不具合ではない。

- suite は ENOENT で止まった検査を「環境不足」として分けて出し、足りないファイル名を知らせる。書き込みが止められる環境(EPERM)で止まったときも環境不足に分ける
- 環境不足のまま「全部 OK」とは言わない。ファイルを揃えた環境(ふつうの clone や CI)で回し直して確かめる

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
