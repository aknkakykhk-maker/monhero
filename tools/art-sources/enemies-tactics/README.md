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

| WAVE | 名前 | 原本 |
| ---: | --- | --- |
| 1 | カワズモー | `1-kawazumo.jpg` |
| 2 | メタルナー | `2-metalner.jpg` |
| 3 | イナリ | `3-inari.jpg` |
| 4 | コイノボリ | `4-koinobori.jpg` |
