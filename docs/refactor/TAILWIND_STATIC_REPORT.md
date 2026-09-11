# Tailwind を CDN から静的CSSへ切り替えられるか(2026-09-12)

`REFACTOR_MASTER_PLAN.md` STEP 7-4 の調査。**切替はしていない。** 判断材料だけを作った。

再現は `node tools/layout/build-tailwind-for-checks.js` →
`node tools/layout/tailwind-static-report.js`。

## 結論: 切り替えられる

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

## いま何にお金を払っているか

`index.html` は `https://cdn.tailwindcss.com` を読み、**ブラウザの中でCSSを作っている**
(`TECH_DEBT_AUDIT.md` TD-13)。つまり起動のたびに

1. スクリプトを取りに行く(CDNが落ちれば見た目が全部崩れる)
2. ソースを走査してクラスを集める
3. CSSを組み立てて流し込む

の3つが走る。静的CSSにすれば1つのファイルを読むだけで済み、2と3が消える。

## 切り替えるときに要ること

**この調査は「クラスが欠けないか」だけを見た。** 実際に切り替えるなら次が要る。

1. `tools/layout/build-tailwind-for-checks.js` と同じ生成を、配信用の出力先で行う
   (いまは検査専用で、`monster-hero/` には入れていない)
2. 生成物をどこに置き、キャッシュキーをどう打つか決める
   (`tools/build.js` が `data/*.js` へ打っているのと同じ仕組みに乗せる)
3. `index.html` の `<script src="https://cdn.tailwindcss.com">` を `<link rel="stylesheet">` へ
4. **全画面を開いて見た目を確かめる。** `node tools/layout-consistency-check.js`、
   `node tools/home-layout-check.js`、`node tools/run-checks.js --area ui` を通す
5. `tailwind.config`(`index.html` 125行目)で `landscape:` を差し替えているので、
   生成側の設定へ移す

> ⚠️ **この調査だけを根拠に切り替えない。** 数え方は近似で、
> 「`${…}` の中がクォート付き文字列を返しているか」で安全と判断している。
> 関数の返り値までは追っていないので、切り替えたら必ず目で見て確かめること。

## 付け足すとき

クラス名を**組み立てる**書き方(`bg-${color}-500` のように、Tailwind のクラス名の一部を
変数にする)を足すと、静的化したときにそこだけ崩れる。
`node tools/layout/tailwind-static-report.js` の「本当に欠ける候補」が 0 のままかを見ること。
