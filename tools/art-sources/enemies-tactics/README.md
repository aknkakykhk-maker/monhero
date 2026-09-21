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
