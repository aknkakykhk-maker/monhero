# マルチの小さいアイコンにも、縮めた絵の枠を出す(2026-10-19)

#3187 で、マルチの部屋の上の並び(28px)とチャット(32px)では絵の枠を外した。
社長「フレーム出なくしたの？」→ 窓口と決めて「小さい所用に、その大きさに合わせた絵で枠を出す」に変えた。

## やったこと

- 画像フレーム23枚すべてに、小さい版 `images/profile-frames/small/<名前>.png` を作った
  - 元絵(384px)の細かい点を均してから(median 5)、Lanczos で `枠の箱 × 32px × 画素密度3` の大きさ(120〜184px)へ縮めた
  - 1枚 6〜19KB(23枚で約220KB)。穴の比(hole)は元絵とそろう(差 0.01 以内)ので、位置合わせはそのまま
- `PROFILE_FRAMES` の画像フレームに `srcSmall` を足した
- `ProfileAvatar` / `ProfileFrameLayer` に `small` を足し、small のときは `srcSmall` を使う
- `RhythmMultiAvatar` は枠を外さず `small` を渡す(上の並び・チャット)
- 色の縁取りに倒す枠は無し(23枚とも、小さい版で潰れずに分かる形だった)

## 前・後

`frames-a.jpg`(12枚)・`frames-b.jpg`(11枚)。画素密度 2.6 倍で、左から
① 今朝まで(大きい絵をその場で縮めた・粗く縮む端末の再現)
② #3187 のあと(枠なし)
③ 直した後(小さい版)
④ 直した後を粗く縮む端末で再現したもの
の28px・32px。

## 検査

- `tools/ranking/profile-frame-check.js`: 小さい版があること・大きさと重さ・穴がそろうこと
- `tools/mode/rhythm-multi-small-frame-check.js`: small のときも枠を外さず、小さい版を使うこと
