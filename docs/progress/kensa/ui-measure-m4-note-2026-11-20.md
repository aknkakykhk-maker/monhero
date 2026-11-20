# 測りの道具の直し: M4「上が実機の安全な領域にかかる」の見立て違い(2026-11-20 開発部より)

受け持ち: 検査部(`tools/browser/ui-measure.js` の 11番)。開発部は道具を直していない。記録だけ。

## 起きたこと

- #7010 で入った測りが、フレンドの詳細(S2FD・S2FT)の窓を「安全な領域の分を空けていない」と拾った
- 実機の形を再現して撮ると(`.msx-wrap` の上の余白を 47px にして撮る・`SHOT_CSS` で再現)、窓は帯の下に出ていて、かかっていない
  止め絵: `docs/progress/monsuc-safe-area/S2FD-before-after.jpg`・`M1D-before-after.jpg`・`M3-before-after.jpg`

## 見立て違いのわけ

- 測りは、窓から親をたどって `env(safe-area-inset-top)` を探すが、いちばん近い absolute・fixed の箱(ここでは `.msx-ov`)で止まる
- `.msx-ov` は absolute だが、位置を決める箱(containing block)は `.msx-wrap` の中の箱なので、`.msx-wrap` が空けた上の余白の下に出る
- 「その外の箱が上を空けていても、inset:0 の箱はその空きに重なる」は、位置を決める箱が余白を持つ箱そのもののときだけ正しい

## 直し方の案

- 案1: absolute の箱で止めずに、その箱の位置を決める箱(`offsetParent`)からたどりを続ける。fixed の箱で止める
- 案2: 撮る前に `env(safe-area-inset-top)` を使っている規則の上の余白を 47px に置き換えて撮り、窓の頭が 47px より下にあるかを数える

## 実際に帯にかかる窓

- 画面に固定した窓(`.msx .v-body>.msx-ov`・position:fixed)だけは、外枠の余白を通らないので帯にかかる
- 29場面で出ていた(はじめる画面の詳細・編成の効果・マスモンボックスやメモリアルの詳細など)。#7021 で上下に safe-area の分を空けた
