# Tailwind を CDN から静的CSSへ切り替えた(2026-09-12)

`EXECUTION_PLAN.md` STEP 10 / `TECH_DEBT_AUDIT.md` TD-13。
**調査 → 切替 → 検証まで完了している。**

## 何が変わったか

| | 前 | 後 |
| --- | --- | --- |
| `index.html` | `<script src="https://cdn.tailwindcss.com">` | `<link rel="stylesheet" href="tailwind.css?v=…">` |
| CSSを作る場所 | **起動のたびにブラウザの中** | ビルド時に1回(`tools/build-tailwind.js`) |
| 外部CDNへの往復 | 1回(落ちると見た目が全部崩れる) | **0回** |
| `landscape:` の差し替え | `index.html` の `tailwind.config` | 生成側の設定(`tools/build-tailwind.js`) |
| 大きさ | (実行時に生成) | **111 KB**(`monster-hero/tailwind.css`) |

起動のたびに走っていた次の3つのうち、2と3が消えた。

1. スクリプトを取りに行く(CDNが落ちれば見た目が全部崩れる)
2. ソースを走査してクラスを集める
3. CSSを組み立てて流し込む

## 切り替える前に数えたこと

| 見たこと | 結果 |
| --- | --- |
| 静的CSSの大きさ | **111 KB**(gzip前) |
| `className` のテンプレートリテラル | 455 箇所 |
| うち クラス名を組み立てているもの | 56 箇所 |
| そのうち **静的化で本当に欠ける候補** | **0 箇所** |

56箇所の内訳は、すべて次のどちらかだった。

- **自前CSSのクラス**を組み立てている(`mh-soul-rank-badge is-stage-${stage}`、
  `pandora-dual-clone--${side}` など)。これらのCSSは `index.html` と parts の中に
  直接書いてあるので、Tailwind の生成とは関係がない
- **クラス名を文字として書いた条件式**(`w-full${cond ? ' m-auto' : ''}`)。
  Tailwind はソースを文字列として見るので、`' m-auto'` はそのまま拾える

再現は `node tools/layout/tailwind-static-report.js`。

## 仕組み

```
node tools/build.js
  └ tools/build-tailwind.js … 中身が変わっていれば monster-hero/tailwind.css を作り直す(7秒)
  └ tools/stamp-version.js  … tailwind.css?v=<中身のハッシュ> を index.html へ打つ
  └ tools/stamp-boot-sizes.js … ローディングのゲージの分母へ tailwind.css を入れる
```

**古いまま公開しないための見張り**が2段ある。

- `node tools/build.js --check`(CIが実行) … CSSの1行目に書いてある
  **元の中身の指紋**が、いまのソースと一致するかを見る。クラスを1つ足して
  `build.js` を忘れると、ここで止まる
- `node tools/boot/data-cache-key-check.js`(CIが実行) … キャッシュキーが中身と一致するか、
  `BOOT_SIZES` が実サイズと一致するか、**外部CDNへ戻っていないか**を見る

`tailwindcss` は `optionalDependencies` なのでCI(`npm ci --omit=optional`)には入らない。
だからCIでは**作り直さず**、コミットした `tailwind.css` をそのまま配る。上の指紋はそのための仕掛け。

指紋からは「毎回必ず変わるもの」を外してある(外さないと、中身が1文字も変わっていなくても
ビルドのたびに7秒かかる)。外しているのは `BUILD_DATE` の値、`?v=<ハッシュ>` のキャッシュキー、
`game-system.jsx` 先頭の `generated-sha256` の3つ。どれも Tailwind のクラス名ではない。

## 副次効果: このサンドボックスでも本物の見た目で測れるようになった

これまでは外部CDNへ出られないため、**Tailwindのクラスがまったく効かない状態でしか画面を開けなかった**。
そのぶん検査ごとに手元でCSSを作って差し込んでいた(`tools/layout/build-tailwind-for-checks.js`)。
配信物そのものがCSSを持つようになったので、その細工は要らなくなり、削除した。

- `index.html` を配って開く検査(`landscape-screens-check.js`、`masu/masu-growth-breakdown-check.js`)
  → **何もしなくてよい**。ページが自分で読む
- `setContent` で部品だけ組み立てる検査(`audio/bgm-arrangement-layout-check.js`)
  → `monster-hero/tailwind.css` を読んで `addStyleTag` する

どちらにも「**Tailwind が効いているか**」の確認を1行足した。効いていないと
`flex` も `w-full` も無い状態で数字だけ出てしまい、測定がまるごと意味を失うため
(実測すると、スタイルが効かないプレイエリアは 844px の画面で 3352px になる)。

## 付け足すとき

クラス名を**組み立てる**書き方(`bg-${color}-500` のように、Tailwind のクラス名の一部を
変数にする)を足すと、そこだけ崩れる。`node tools/layout/tailwind-static-report.js` の
「本当に欠ける候補」が 0 のままかを見ること。

数え方は近似(「`${…}` の中がクォート付き文字列を返しているか」で安全と判断しており、
関数の返り値までは追っていない)。**0件を鵜呑みにせず、実機でも1周すること。**
