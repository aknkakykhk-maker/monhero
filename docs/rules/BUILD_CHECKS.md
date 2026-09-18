# ビルドと検査（詳細）

> ルート [`CLAUDE.md`](../../CLAUDE.md) から切り出した詳細。**守ることの本文は CLAUDE.md が正本**で、
> ここには経緯・失敗例・具体的な手順を置いている。CLAUDE.md は毎回すべて読み込まれるため、
> 読まなくても困らない部分をここへ寄せている（CLAUDE.md ⑨ / [`CONTEXT_BUDGET.md`](CONTEXT_BUDGET.md)）。
>
> 探すときは `node tools/ctx.js rules <語>` を使うと、必要な節だけが出る。

### ⑥ 改修したら必ずビルドと検査を通す

ゲーム本体の編集元は `monster-hero/src/parts/*.jsx`(`parts.json` の順に連結)。`monster-hero/src/game-system.jsx` は
その連結生成物なので、**直すのは parts 側**(直接編集しても parts が未変更なら `build.js` が書き戻す)。
parts を触ったら、コミット前に必ず次を通す。

```
node tools/build.js                      # 配信用JSを作り直す(忘れると変更が反映されない)
node tools/check-syntax.js               # 構文エラーが無いか
node tools/undefined-reference-check.js  # その場所からは見えない変数を使っていないか
node tools/jsx-text-brace-check.js       # 「{」「}」が画面に文字として出ていないか
node tools/render-error-check.js         # 実際に開いて真っ白にならないか
```

とくに3つめは、**構文としては正しいのに特定の画面を開いた瞬間だけ真っ白になる**類の不具合を防ぐためのもの。
実際に「関数の中で定義した定数をマーケットの画面から参照していて、マーケットに入ると
進行不能になる」という不具合を出したことがある。`check-syntax.js` はこれを検出できない。

4つめも同じ理由で足したもの。`{cond&&<div>…</div>}` の**閉じ `}` だけを書いて開き `{cond&&` を
書き忘れる**と、余った `}` はJSXの本文(ただの文字)として扱われるため構文エラーにならない。
実際に「バトル画面に `}` が表示され、しかも足したはずの条件が効いていない」という不具合を出した。
5つめは、構文も参照先も正しいのに**描画した瞬間だけ落ちる**類を拾うためのもの。
実際に「`const A = B && ...` を `const B = ...` より前に書いてしまい、
`Cannot access 'B' before initialization` で画面が真っ白になる」という不具合を出した。
`check-syntax.js` も `undefined-reference-check.js` もこれは検出できない。
実際にブラウザで開いてJSの実行時エラーを拾うので、このサンドボックスでも
「真っ白になるかどうか」は確実に分かる。

モンスターの絵やアイコンを差し替え・追加したら、`node tools/build.js` でキャッシュキーを更新したうえで
`node tools/image-asset-check.js` を通す。絵の実体は `monster-hero/images/` 以下のPNGで、
`data/images/images-*.js` と `data/breeder.js` にはそのパスだけを書く(base64で埋め戻さない)。
参照先の綴り間違いやキャッシュキーの取り違えは、公開してから「絵が出ない・古い絵のまま」になって初めて分かるため、
このチェックで機械的に拾う。

