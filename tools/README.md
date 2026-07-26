# 開発用の検証ツール

`monster-hero/` 本体(GitHub Pages で配信される静的サイト)には含まれない、開発時だけ使う
Node.js 製の検証スクリプト。ビルド工程は無いので、これらを実行してもサイトの中身は一切変わらない。

過去のセッションではこれらを一時ディレクトリ(scratchpad)に置いていたためセッションが変わるたびに
消えて作り直しになっていた。今後はこのディレクトリで管理する。

## セットアップ

```
cd tools && npm install
```

`@babel/core` / `@babel/preset-react`(JSXの構文チェック・変換用)、`canvas`
(ブラウザのCanvas APIをNode上で再現し、染色マスクの生成を実画像で検証するため)、
`playwright`(実ブラウザでのスモークテスト用)を入れる。
`node_modules/` はコミットしない(`.gitignore` 済み)。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `node check-syntax.js` | `monster-hero/game-system.jsx` をBabelで変換して構文エラーが無いか確認する。**改修後は必ず実行する。** |
| `node dye-report.js [モンスターID...]` | 染色もどきの部位マスクを実画像で生成し、部位ごとの画素数・被覆率を出力する。回帰テスト用。 |
| `node dye-report.js --save-baseline` | 現在の結果を `dye-baseline.json` に保存する。以降は実行のたびに差分が表示される。 |
| `node region-map.js [モンスターID...]` | 部位分けを色分けしたPNGを `out/` に書き出す。目視確認用。 |
| `node image-report.js` | 埋め込み画像(base64)の一覧をサイズ順に出す。重複した実体も検出する。 |
| `node dedupe-images.js [--dry-run]` | 同じ base64 が複数の変数に重複して埋め込まれている箇所を、先に定義した変数への参照に置き換える。画像は1バイトも変えない。 |
| `node build.js` | **game-system.jsx を配信用JSへ変換し `monster-hero/game-system.compiled.js` を書き出す。改修したら必ず実行する。** |
| `node build.js --check` | compiled が jsx と一致しているか確認する(古ければ終了コード1)。出荷前チェック用。 |
| `node feature-check.js` | 実ブラウザでゲームを起動し、主要機能が動くかを確認する。 |
| `node perf-check.js` | 読み込みにかかる時間と転送量を実ブラウザで計測する。 |
| `node smoke.js` | 実ブラウザ(Chromium)で `data/*.js` を読み込み、画像の変数がすべて解決されるか確認する。事前にリポジトリのルートをHTTPで配信しておくこと(`python3 -m http.server 8899`)。 |
| `node grid-overlay.js 変数名...` | 立ち絵に0.1刻みの目盛りを重ねたPNGを出す。顔クロップや染色bboxの範囲を実測するときに使う。 |
| `node make-face-icons.js [--preview]` | 立ち絵から顔部分を切り出して256pxの顔アイコンを作り、`_FACE_ICON` を差し替える。切り出し範囲はスクリプト内の `FACE_BOXES`。 |
| `node face-render-check.js` | 顔アイコンが実ブラウザで正しく描画されるか確認し、アイコン選択画面と同じ見た目のスクリーンショットを出す。 |

`dye-baseline.json` は「現在正しいとされている染色結果」の記録なので、
染色を意図的に変更したときだけ `--save-baseline` で更新すること。

モンスターIDは `MASU_COLOR_REGION_HUES` のキー(`Iblis` / `Suezo` / `Mocchi` / `Mitarashi` /
`Golem` / `Pixie` / `Tiger` / `Ham` / `Oboro` / `Zan` / `Ark` / `Monol`)。省略すると全モンスター。

## 出荷手順

1. `game-system.jsx` などを改修する
2. `node build.js` で `game-system.compiled.js` を作り直す(**忘れると変更が反映されない**)
3. `node check-syntax.js` / `node dye-report.js` / `node feature-check.js` を通す
4. `BUILD_DATE`(game-system.jsx 冒頭)と `monster-hero/version.json` の `build` を同じ値に更新する
5. `data/changelog.js` の先頭に今回の更新内容を追記する(日時は BUILD_DATE と同じ)
6. コミット → PR → squash マージ

## ブラウザに配信しているもの

`monster-hero/` は静的サイトとして配信される。以前は React・Tailwind・Babel をすべてCDNから読み、
さらに `game-system.jsx` を毎回取得しなおしてブラウザ上でJSXを変換していたため、
ページを開くたびに数秒かかっていた。現在は次のようにしている。

- **React / ReactDOM**: `monster-hero/vendor/` に同梱(CDNへの往復が2回減る)
- **ゲーム本体**: `tools/build.js` で事前変換した `game-system.compiled.js` を普通の `<script>` で読む
  (Babel本体(約2.8MB)のダウンロードも、端末上での変換(モバイルで数秒)も不要になる)
- **Tailwind**: 現状はCDNのまま(実行時にCSSを生成する方式のため、静的CSS化は別途対応が必要)

## 仕組み

`game-system.jsx` は素の `<script type="text/babel">` として読ませる前提の1枚岩ファイルで、
モジュールのexportが無い。そのため `harness.js` では次の手順で染色ロジックだけを取り出している。

1. Babel(preset-react)でJSXを変換する
2. 末尾に `globalThis.__dyeExports = { ... }` を追記して、トップレベルの `const` を取り出せるようにする
3. React / ReactDOM / document / window の最小スタブを用意した `vm` コンテキストで実行する
   (`document.createElement('canvas')` は node-canvas を返し、`window.Image` も node-canvas のものを使う)

これにより `getDyeRegionMasks` などを本番と同じコードのまま Node 上で呼べる。
