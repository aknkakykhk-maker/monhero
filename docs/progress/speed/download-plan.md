# 事前ダウンロードを本体の JS・譜面・更新履歴・ヘルプへ広げる案

社長の決定で、事前ダウンロード(いまは音源と画像だけ)を、ゲーム本体の JS・データ(譜面・更新履歴・ヘルプ)にも広げる。
**新しい版を出したら、必ず新しい版が動くこと**が条件。まだ作っていない(案)。

- Service Worker の作り: ストックくん(この節)
- 速さの見込み・どのファイルを入れるか: ハヤテくん(下の節)
- 今の事前ダウンロードの説明: [`docs/spec/ASSET_PREFETCH.md`](../../spec/ASSET_PREFETCH.md)

## 1. Service Worker の作り(ストックくん)

### いまの読み込みの形(調べた結果)

- `index.html` は Service Worker(SW)を通らず、毎回ネットから取っている(sw.js は navigate に `respondWith` しない)
- `index.html` が読む JS・CSS は、`manifest.json` を除いて **21件すべて `?v=<版>` 付き**
  - `game-system.compiled.js?v=<GAME_BUILD>`(ビルドの時刻)
  - `data/*.js?v=<中身のハッシュ>`(譜面 `rhythm-mode.js`・更新履歴 `changelog.js`・ヘルプ `help.js` など。stamp-version.js が打つ)
  - `tailwind.css?v=<中身のハッシュ>`・`vendor/react*.js?v=18`
- 合わせて約14MB(圧縮前)。GitHub Pages のキャッシュは10分(max-age=600)なので、10分を過ぎると毎回の問い合わせになり、
  ブラウザのキャッシュが消されれば全部取り直しになる
- 本体の読み込みに失敗すると、`index.html` が `&retry=<時刻>` を付けて1回だけ取り直す
- 効果音の Tone.js は外のサイト(cdnjs)から読んでいる。SW は外のサイトに手を出さない(入れるかは別に決める)

### 版の確かめ方(いちばん大事)

**`index.html` を版の正にする。** `index.html` は今までどおり毎回ネットから取り、SW は触らない。
`index.html` の中の URL が新しい版の `?v=` を持っているので、新しい版を出すと URL が変わり、
SW のためた古い版には当たらない。`version.json` を見る「新しいバージョンがあります」のお知らせも今のまま。

- SW がためるのは「`?v=` 付きの同じサイトの `.js`・`.css`」だけ。鍵は URL まるごと(中身が変われば鍵も変わる)
- `?v=` の無いもの・`&retry=` の付いたもの・`index.html`・`version.json`・`asset-manifest.json`・`manifest.json`・
  Supabase は素通し(今と同じ)
- `GAME_BUILD` はビルドの時刻で、中身のハッシュではない。中身が同じでも時刻が変わると取り直しになるが、
  古い版を出す向きの事故にはならない

### 変わった分だけ取り直す

1. ビルド(`tools/build-asset-manifest.js`)で、`index.html` から `?v=` 付きの URL を拾い、`asset-manifest.json` に
   `code: ["game-system.compiled.js?v=…", "data/help.js?v=…", …]` として書く(手で書かない)
2. SW は今の画像・音源と同じく、ページを開くたびに一覧を取り直し、**一覧に無い URL をためた物から消す**。
   置き場は画像・音源と分けて `mh-code-v1` にする(消し方の決まりが違うので混ぜない)
3. 取るのは、使った時点(cache-first。無ければネットから取ってためる)と、自動ダウンロードのとき(一覧の中で無いもの)。
   変わっていないファイルは URL が同じなので取り直さない

### 失敗したら戻る

- **読み込みに失敗したとき**: `index.html` が `&retry=` 付きで取り直す → SW は素通しなのでネットへ行く(今と同じ)
- **ためた中身がおかしいとき**: ためるのは `res.ok` かつ 200 の同じサイトの応答だけ。中身の長さが一覧の大きさと違えばためない
- **仕組みごと止めたいとき**: sw.js の先頭に `CODE_CACHE_ENABLED = true` を置く。`false` にして出せば、
  次に開いたとき(sw.js は `updateViaCache:'none'` で毎回確かめている)から JS・CSS は素通しになり、`mh-code-v1` も消す
- **端末で切ったとき**: 今の DEBUG MENU の「事前ダウンロード」を切ると、SW を外して `mh-code-v1` も消す
- 保存データ(`mh_*`)・ランキングには触れない。足す保存キーは無し

### 危ないところ

- `index.html` だけは毎回ネットなので、電波が無いときは今までどおり開けない(オフラインで遊べるようにはしない。
  するなら別に決める: `index.html` もためると、古い版を開く入口になる)
- iPhone で置き場が消されても、ネットから取るだけで壊れない(今の画像・音源と同じ)
- ビルドで一覧を作り忘れると、新しい URL がためられないだけ(古い版は出ない)。`build.js --check` で一覧の古さを見る

### 確かめ方(bot)

`tools/boot/asset-prefetch-check.js` に足す:

- 2回目に開いたとき、`?v=` 付きの JS・CSS が SW から返る(`fromServiceWorker`)
- 版を変えた `index.html` を出したら、新しい URL を取りにいき、新しい版の本体が動く(古い `GAME_BUILD` が動かない)
- 一覧から消えた古い版の URL が、置き場から消える
- `&retry=` 付き・`index.html`・`version.json` は SW から返らない
- `CODE_CACHE_ENABLED = false` の sw.js を出すと、JS が素通しになり置き場が消える

### 手間の見込み(AI が手を動かす時間)

- ビルドの一覧づくり: 15分 / sw.js の改修: 20分 / bot: 30分 / 合わせて約1時間+検査

## 2. 速さの見込み・どのファイルを入れるか(ハヤテくん)

(ハヤテくんが書く)
