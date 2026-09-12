# main 由来で落ちている検査が6件ある(2026-09-12)

Tailwind の静的化(STEP 10)で全407本を流したときに見つかった。
**6件とも、この改修より前から落ちている**(切り替え前のコミットを別の作業ツリーへ出して
同じ検査を流し、まったく同じNGが出ることを確かめた)。
つまり**この改修が壊したものではない**ので、そのままにして先へ進めた。

別の会話で直すときに調べ直さずに済むよう、分かっていることをここに残す。
`node tools/where.js` と `sed -n` で必要な行だけ開くこと(CLAUDE.md ⑨)。

```
node tools/audio/bgm-preview-stop-check.js
node tools/battle/battle-check.js
node tools/battle/battle-menu-browser-check.js
node tools/masu/masu-enhance-layer-check.js
node tools/mode/extreme-browser-check.js
node tools/mode/rhythm-audio-independence-check.js
```

どれも `.github/workflows/compiled-check.yml` には入っていない(CIは通る)。

---

## ① `battle/battle-menu-browser-check.js` — イベント回想のモーダルがクリックを遮る

```
TimeoutError: <button aria-label="次へ" class="absolute inset-0 w-full h-full"> from
<div role="dialog" aria-label="イベント回想: 週末ゲリラ杯 ～はじめての大会～"
     class="fixed inset-0 flex items-end justify-center"> subtree intercepts pointer events
```

イベント回想(週末ゲリラ杯)のモーダルが画面全体を覆っていて、その下のボタンを押せない。
検査側でこのモーダルを先に閉じる必要がある。**切り替え前もまったく同じ場所で止まっていた。**

> ⚠️ 静的CSSにしたことで、このモーダルは検査の中でも**本当に画面を覆うようになった**
> (以前はTailwindが効かず `fixed inset-0` が何もしなかったので、たまたま素通りできた検査もある)。
> 直すときは「モーダルを閉じてから押す」に変えること。効かないCSSを前提に戻さない。

## ② `battle/battle-check.js` — 固有技の強化画面へ進めない(10/15項目)

```
NG  固有技の強化画面へ進める / 自分の固有技が並ぶ / 引き継いだ固有技も並ぶ
NG  引き継いだ固有技を強化できる — 強化ポイントが0のため確認できず
```

①と同じ「何かが前に出ていて押せない」系に見える。切り替え前は 8/15、切り替え後は 10/15 で、
**静的CSSにしたぶん2項目は通るようになった**。残り4項目は main 由来。

## ③ `masu/masu-enhance-layer-check.js` — 暗いレイヤーが二重になる(7件)

```
NG: 詳細だけが出ている — fixed inset-0 flex items@z60000 + fixed inset-0 flex items@z31000
NG: 通常強化で詳細が重なっていない — fixed inset-0 flex items@z60000 + absolute inset-0 z-[3000@z30000
NG: 超越強化で詳細が重なっていない — fixed inset-0 flex items@z60000 + 超越強化@z30000
NG: 戻ったあとに暗いレイヤーが残らない
```

z60000 の層が常に前に居座っている。**切り替え前も7件で、件数も内容も同じ。**
z60000 が何かを `node tools/where.js --text 'z-\[60000'` で当たるところから。

## ④ `mode/extreme-browser-check.js` — EXTREMEの倍率と報酬(31/32項目)

```
NG  EXTREMEの倍率と報酬が出ている — … 敵強度 ×13 スコア ×20 ダイヤ ×7.5 経験値 ×25 虹のプシ…
```

画面には出ているので、検査が探している文字列と実装の文言がずれている可能性が高い。
切り替え前も同じ1件。

## ⑤ `mode/rhythm-audio-independence-check.js` — gainノードの配線

```
✗ 音ゲーBGMのgainノードはメインのbgmGainではなくctx.destinationへ直結
```

ソースの文字列を見る検査。ブラウザを使わないので、静的化とは無関係。切り替え前も同じ。

## ⑥ `audio/bgm-preview-stop-check.js` — 仕込みで音源が始まらない

```
NG: 仕込みで実際に音源が始まる(検査が空振りしていない) — start=0 / previewBGMの戻り=false
```

ほかの5項目はOKだが、**その5項目は音が鳴っていない状態でも通ってしまう**ので、
いまは実質なにも確かめられていない。`previewBGM` が false を返す理由から。切り替え前も同じ。

---

## 調べ方(同じことをするとき)

```
git worktree add -f /tmp/before <切り替え前のコミット>
ln -sfn /home/user/monhero/tools/node_modules /tmp/before/tools/node_modules
cd /tmp/before && node tools/<検査>.js
```

`tools/node_modules` は作業ツリーへコピーされないので、シンボリックリンクで貸す。
これで「自分が壊したのか、もともと落ちていたのか」を数分で切り分けられる。
