# タクティクスバトル専用の敵 原本

ユーザーから届いた**加工前のスクリーンショット**を置く。ここはゲームから読み込まない。

切り抜き(背景を抜いて長辺160pxの透過PNGにする)は、次の道具が行う。

```
node tools/image/cutout-enemy-art.js tools/art-sources/enemies-tactics/1-kawazumo.jpg monster-hero/images/enemies/kawazumo.png
```

**イナリだけ `FILL_ALL=1` を付ける。** 顔と体がくっついていて、そのあいだに背景が見えていないため。
付けないと、顎の下の白い毛が背景とまちがえられて横線が入る。

```
FILL_ALL=1 node tools/image/cutout-enemy-art.js tools/art-sources/enemies-tactics/3-inari.jpg monster-hero/images/enemies/inari.png
```

- ファイル名の先頭の数字は**WAVEの順番**。届いた順に増やす
- 切り抜いた結果を `monster-hero/images/enemies/` へ置くのは、**データ(`TACTICS_ENEMY_DATA`)へ
  組み込むときだけ**。先に置くと `tools/image-asset-check.js` が「どこからも参照されていない絵」
  として落とす

| WAVE | 名前 | 原本 | 切り抜き後 | 56px枠での面積 |
| ---: | --- | --- | --- | ---: |
| 1 | カワズモー | `1-kawazumo.jpg` | 160×142 | 40% |
| 2 | メタルナー | `2-metalner.jpg` | 112×160 | 33% |
| 3 | イナリ | `3-inari.jpg` | 66×160 | 29% |
| 4 | コイノボリ | `4-koinobori.jpg` | 160×153 | 58% |
| 5 | デルピエロ | `5-delpiero.jpg` | 77×160 | 17% |
| 6 | ドクドク | `6-dokudoku.jpg` | 160×121 | 54% |
| 7 | ラミア | `7-lamia.jpg` | 118×160 | 27% |
| 8 | ニャルラトホテプ | `8-nyarlathotep.jpg` | 160×157 | 44% |
| 9 | スプラッター | `9-splatter.jpg` | 103×160 | 30% |
| 10 | 覚醒ムー | `10-awakened-moo.jpg` | **1024×598** | ボス扱い |

**覚醒ムーだけ長辺1024pxで置く。** クラシックのムー(1536×971)と同じ扱いで、
表示のときに大きく拡大する(`ENEMY_ART_LAYOUT` の scanScale 2.75 / waveDetailScale 2)。
160pxで置くと拡大したときに粗くなる。

```
LONG=1024 node tools/image/cutout-enemy-art.js tools/art-sources/enemies-tactics/10-awakened-moo.jpg monster-hero/images/enemies/awakened-moo.png
```

## ⚠ 透過はこちらでやらない（2026-09-21 ユーザー指摘「透過精度が悪すぎる」）

`cutout-enemy-art.js` は背景を色と輪郭から推し量って抜くので、**白い体・薄い色・淡い縁**を
背景とまちがえる。4段の工夫を重ねてもまだ足りず、ユーザーから
**「透過精度が悪すぎる。モンスター画像は改めてこっちで出し直す」**と言われた。

**これからは透過済みで受け取る。** こちらは背景を抜かず、大きさをそろえるだけにする。

```
node tools/image/prepare-enemy-art.js <届いた透過PNG> monster-hero/images/enemies/◯◯.png
LONG=1024 node tools/image/prepare-enemy-art.js …    ボス(覚醒ムー)のように大きく拡大して出す絵
```

やることは「透明な余白を切る → 長辺160pxへ → パレット化して数KBに」だけ。
あわせて、届いた絵の透過を数字で出す。

| 出る数字 | 意味 | 気にする値 |
| --- | --- | --- |
| 縁のなめらかさ | アルファが0でも255でもない画素の割合 | **0.5%未満**だとアンチエイリアスが無く、拡大でギザギザ |
| 切れ端 | 本体から離れた小さな島の数 | **1個以上**なら背景の消し残り・UIの写り込み |
| 縁の明るさ | 本体のまわり1周の明るさ | **210超**だと白い背景が1px残っている（ハロー） |

透過されていない絵を渡すと、その場で止まる（黙って進めると背景ごと枠へ収まり、絵だけ小さく並ぶ）。

> この3つで拾えるのは**縁と消し残り**まで。「体の内部が欠けた」「輪郭が削れた」は拾えない
> （いまの10体はこの3つでは異常が出ないのに、見ると精度が足りていない）。
> **そこは目で見て判断する。** 数字が全部きれいでも、必ず実際の画面に並べて確かめる。

## 大きさのそろえ方

届くスクリーンショットは解像度も引きもまちまちだが、切り抜きで**長辺160px**にそろえるので、
そこは吸収される（配信中の敵も同じ形）。

そろわないのは「**体の大きさ感**」のほう。鎌・耳・広げた腕のように細長いものが付いていると、
長辺をそこに取られて本体が小さく見える。実際に見えている大きさは次で測る。

```
node tools/image/enemy-art-size-report.js <切り抜いたPNG> …
```

配信中の敵も **13%〜68%**（まんなか31%）とばらついているので、**その幅に収まっていれば手を入れない**。
外れたものだけ `ENEMY_ART_LAYOUT`（`22-enemy-and-bond-entries.jsx`）の `scanScale` /
`waveDetailScale` で持ち上げる。ムーが 2.75 倍で入っているのと同じ仕組み。

> 10体そろったら、実際のバトル画面に並べて見比べてから値を決める。
> 数字だけで決めると、枠からはみ出して隣と重なることがある。
