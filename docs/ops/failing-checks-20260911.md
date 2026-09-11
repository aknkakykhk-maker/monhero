# CIに入っていない検査が5件落ちている（調査済み・未着手）

2026-09-11 に、CIが回す36本とは別に、CLAUDE.md が挙げている検査を手で流したときの記録。
**5件とも、プレイヤーの画面・セーブデータには影響していない。**
4件は「検査の見かたが実装から取り残されている」もので、実データの書き間違いは⑤の後半だけ。

このメモは、別の会話で直すときに**調べ直さずに済ませる**ために残している。
`node tools/where.js` と `sed -n` で必要な行だけ開くこと（CLAUDE.md ⑨）。

いま落ちている5本（どれも `.github/workflows/compiled-check.yml` には入っていない）:

```
node tools/image-asset-check.js
node tools/boot/kiki-intro-check.js
node tools/boot/mission-check.js
node tools/boot/ui-preferences-check.js
node tools/changelog/dev-entry-check.js
```

直す順のおすすめは ④ → ②③⑤ → ①。
④は**そもそも起動できていない**ので、直すと隠れていた別のNGが出てくる可能性がある。

---

## ① `image-asset-check.js` — 使われていない画像が3枚残っている

```
NG: images/ に使われていない画像が残っていない
    images/effects/reincarnate-aura-{blue,red,yellow}.PNG
```

転生オーラの絵が `soul_rank_*.png` へ作り替わったときの**旧デザインの残り**。
いまオーラを描いているのは `SoulRankAura`（`src/parts/16-ranking-detail-and-widgets.jsx:256`）で、
`SOUL_RANK_AURA_IMAGES`（同 248行）から引いている。3枚はどこからも参照されていない。

- 大きさ: 495KB + 474KB + 615KB = **約1.5MB**
- 直し方: 3枚を削除して `node tools/build.js` → `node tools/image-asset-check.js`

**ついでに**: 同じ `images/effects/` に `soul_rank_auras.zip`（**約9.1MB**）が置いてある。
素材の元データで、検査は画像の拡張子しか見ないので素通りしている。
消してよいか、`docs/` 側か別の場所へ移すかは要判断（消せば10MB以上減る）。

## ② `boot/kiki-intro-check.js` — イベントBGMの順番

```
NG: イベントBGMは画面のBGMより先に決まる
```

**実装は正しい。** `src/parts/60-app.jsx`

```
2831:    if (eventBgmScene) return bgmArrangement[eventBgmScene];
2832:    if (isGameOver) return bgmArrangement.gameOver;
```

イベントBGMのほうが先にある。検査（`tools/boot/kiki-intro-check.js:172-174`）が

```js
source.indexOf("if (isGameOver) return 'gameOver';")
```

という**古い文字列**を探していて、見つからず `-1` が返るため
`（イベントの位置） < -1` が false になって落ちている。
BGMアレンジ設定から引く形に変わったときに、検査側が追従していない。

- 直し方: 検査の探す文字列を `if (isGameOver) return bgmArrangement.gameOver;` にする。
  行の文字列そのものを見ると同じことがまた起きるので、
  「`eventBgmScene` の分岐が `isGameOver` の分岐より前にあるか」を見る形にするほうがよい
  （同じ理由で `tools/assistant-bond-check.js` を直した例が PR #1271 にある）

## ③ `boot/mission-check.js` — レベルアップで増えるpt

```
NG: レベルアップで増えるptは上がったレベル数ぶんだけ
```

**二重には配っていない。** 検査（`tools/boot/mission-check.js:156-158`）が
`const next = prev + gainedLevels;` を**1か所だけ**と決め打ちしているが、いまは2か所ある。

| 場所 | 何の入口か |
| --- | --- |
| `src/parts/60-app.jsx:2466` | スキップチケットなどで**まとめてクリア**したとき |
| `src/parts/60-app.jsx:5705` | 通常のリザルト |

どちらも `gainedLevels`（上がったレベル数）ぶんしか足さず、直後に
`storeSet('mh_breeder_points_granted', ...)` で配った総数を記録している。
`gainedBreederLevels` のほう（同 5838行）は1か所のままで、検査も通っている。

- 直し方: 「1か所であること」ではなく「**見つかったすべてが正しい形か**」を見る。
  `prev + gainedLevels` 以外の足し方（定数・掛け算）が混じっていないこと、
  各所に `mh_breeder_points_granted` の記録が付いていることを見るのが本来の意図

## ④ `boot/ui-preferences-check.js` — そもそも起動できていない

```
ReferenceError: QUICK_RHYTHM_LINK_PUBLIC_RELEASE is not defined
```

検査（`tools/boot/ui-preferences-check.js:26`）が、評価に必要な宣言を
**手書きの一覧**で持っている。

```js
const prelude = ['SPECIES_CHALLENGE_PUBLIC_RELEASE', 'RHYTHM_MODE_PUBLIC_RELEASE',
                 'RELEASE_FLAGS', 'releasedForPlayers'].map(pick).join('\n');
```

あとから増えた4つが足されていない。

- `QUICK_RHYTHM_LINK_PUBLIC_RELEASE`
- `RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE`
- `RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE`
- `RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE`

- 直し方: 名前を手書きせず、`RELEASE_FLAGS` の行から `*_PUBLIC_RELEASE` を正規表現で
  拾って `prelude` を組み立てる。そうすれば今後フラグが増えても落ちない
- ★これは**実行時エラーで止まっている**ので、直すと隠れていた本来のNGが出てくる可能性がある。
  最初に着手して、出てきたものを見てから残りの段取りを決めるとよい

## ⑤ `changelog/dev-entry-check.js` — 2件

### (a) `releaseFlag:'rhythmMode'` なのに `dev:true` が無い 7件

```
NG: モンヒロビート公開前に書いた項目は、すべて作業メモ扱いになっている — 80/87件
```

7件とも日付は **2026-09-07**。モンヒロビートのプレオープン（2026-09-05）より**あと**の、
プレイヤーが実際に体験した改善（譜面の見直し・発熱対策・描画の不具合修正など）。
**お知らせに出ているのが正しい。**

検査が「`releaseFlag:'rhythmMode'` が付いている＝公開前に書いたメモ」と決めつけているのが古い。

- 直し方: 判定を日付にする。プレオープンの日時より前の項目だけを対象にする
  （`dev:true` を7件へ足すのは**間違い**。出ているべきものが消える）

### (b) `dev:true` なのに `status:'new'` が付いている 12件

```
NG: 作業メモに新着バッジ(status:new)を付けていない
```

こちらは**実データの書き間違い**。ただし `dev:true` の項目はどちらのタブにも出ないので、
バッジは**誰にも見えていない**（害は無い）。

- 直し方: `monster-hero/data/changelog.js` の該当12件から `status:'new'` を外す。
  一覧はこれで出る:

```
node -e "const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);
vm.runInContext(fs.readFileSync('monster-hero/data/changelog.js','utf8')+';globalThis.x=CHANGELOG;',c);
c.x.filter(e=>e.dev===true&&e.status==='new').forEach(e=>console.log(e.date,e.title));"
```

---

## 直したあとに通すもの

```
node tools/build.js
node tools/check-syntax.js
node tools/undefined-reference-check.js
node tools/render-error-check.js
上の5本
```

検査が落ちたときに**検査側を緩めて通す**のは禁止（CLAUDE.md ⑤）。
ただし今回の①〜④・⑤(a) は「検査の見かたが実装から取り残されている」ケースなので、
**見かたを実態に合わせる**のが正しい直し方。緩めるのとは違う。
そのときは「なぜその見かたにしたか」をコメントで残すこと
（`tools/assistant-bond-check.js` の直し方が参考になる）。
