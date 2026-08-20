# モンスターの原本画像

`node tools/make-face-icons.js` が顔アイコンを切り出すときに使う、**立ち絵より高解像度な原本**を置く。

- ファイル名は `FACE_BOXES` のキーと同じ大文字(例: `ZAN.PNG`)。
- ここにファイルがあれば、`monster-hero/images/monsters/` の配信画像より優先して使う。
- ゲーム内で直接参照する完成アイコンは `monster-hero/images/monster-icons/` にある。

## 探す順番

`make-face-icons.js` は上から順に探し、最初に見つかったものを使う。

1. `tools/art-sources/monsters/<名前>.png` / `.PNG`
2. `tools/art-sources/monsters/` の1つ上（昔の置き場所）
3. `monster-hero/images/monsters/<名前>.PNG`（大文字名の高解像度版。マーケットのアイコン商品として配信しているもの）
4. `images-ally.js` の立ち絵（表示用に縮小されていることがある）

## 今このフォルダが空になっている理由

ここへ置いていた原本(`MOCCHI.PNG` / `SNEGUROCHKA.PNG` / `SNEGUROCHKA_AWAKENED.PNG`)は、
`monster-hero/images/monsters/` の同名ファイルと1バイトも違わない重複だった。
二重管理をやめ、配信側の1枚を正本にした（上の3番）。
出来上がる顔アイコンは削除前と同一であることを確認済み。

**立ち絵を表示用に縮小した画像しか無い状態で、それより大きい原本を受け取ったときだけ**
ここへ足す。同じ中身のコピーは置かない。
