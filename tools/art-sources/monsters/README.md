# モンスターの原本画像

`node tools/image/make-face-icons.js` が顔アイコンを切り出すときに使う、**立ち絵より高解像度な原本**を置く。

- ファイル名は `FACE_BOXES` のキーと同じ大文字(例: `ZAN.PNG`)。
- ここにファイルがあれば、`monster-hero/images/monsters/` の配信画像より優先して使う。
- ゲーム内で直接参照する完成アイコンは `monster-hero/images/monster-icons/` にある。

## 探す順番

`make-face-icons.js` は上から順に探し、最初に見つかったものを使う。

1. `tools/art-sources/monsters/<名前>.png` / `.PNG`
2. `tools/art-sources/monsters/` の1つ上（昔の置き場所）
3. `monster-hero/images/monsters/<名前>.PNG`（大文字名の高解像度版。マーケットのアイコン商品として配信しているもの）
4. `images-ally.js` の立ち絵（表示用に縮小されていることがある）

## 顔アイコン以外にも使っているもの

| ファイル | 使うところ |
| --- | --- |
| `PLANT.PNG` | `node tools/image/make-plant-dye-mask.js` が読む、手を入れていない原本。配信中の `plant.PNG` は透過を掃除した後の絵なので中身が違う。配信中の絵を読んで同じ場所へ書き戻すと、Canvasが半透明画素の色を丸めるぶん結果が少しずつ変わり、何度流しても同じ絵にならなくなるため原本を分けている。 |

## 顔アイコン用の原本が今このフォルダに無い理由

ここへ置いていた原本(`MOCCHI.PNG` / `SNEGUROCHKA.PNG` / `SNEGUROCHKA_AWAKENED.PNG`)は、
`monster-hero/images/monsters/` の同名ファイルと1バイトも違わない重複だった。
二重管理をやめ、配信側の1枚を正本にした（上の3番）。
出来上がる顔アイコンは削除前と同一であることを確認済み。

**立ち絵を表示用に縮小した画像しか無い状態で、それより大きい原本を受け取ったときだけ**
ここへ足す。同じ中身のコピーは置かない。
