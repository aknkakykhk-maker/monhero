# モンヒロビートの見た目の直し(r1119-094・2026-11-22 テンポくん)

社長「ここの右側の決定の押しにくさとか空きスペースとかもいつなおすの？」(写真 `docs/progress/beat/result-yoko-bug-2026-11-22/shacho-iphone-1405.png`)。
点検 `docs/progress/kensa/beat-api-2026-11/README.md` の指摘 高・中 を画面ごとに直す。止め絵は `tools/browser/visual-shoot.js` で撮った
(直す前は `SHOT_REV=origin/main`)。🔄横は新しく足した場面 `beat-songs-rot`(縦 390×844 の端末で絵だけ回す。社長の iPhone の形)。

## 1. 曲えらびの右側(ソロ・マルチ共通の部品)

| 大きさ | 直す前 | 直したあと |
|---|---|---|
| 縦 390×844 | [before/songs-tate.png](before/songs-tate.png) | [after/songs-tate.png](after/songs-tate.png) |
| 横 844×390 | [before/songs-yoko.png](before/songs-yoko.png) | [after/songs-yoko.png](after/songs-yoko.png) |
| 🔄横(社長の形) | [before/songs-rot.png](before/songs-rot.png) | [after/songs-rot.png](after/songs-rot.png) |
| 小さい横 568×320 | — | [after/songs-yoko-s.png](after/songs-yoko-s.png) |
| PC 1280×800 | [before/songs-pc.png](before/songs-pc.png) | [after/songs-pc.png](after/songs-pc.png) |

| 指摘 | 中身 | どう直したか | 結果 |
|---|---|---|---|
| 社長の写真 | 🔄横で「決定」が細く、右の欄の下が空く | 素の CSS(index.html)がソロにも「ジャケット88px・決定36px」を当てていた。マルチだけに絞り、ソロは欄の高さ(container)で伸び縮みする作りにした。決定は欄の下端・高さ52px | 直した |
| N1 | PC: 決定が140×40px・右の欄の下半分が空き | 欄が高い(540px以上)ときはジャケット・HIGH SCORE・切り替えを全幅に縦へ積み、決定は下端に高さ64px | 直した(欄そのものが幅264pxと細いので、難易度と助手の一言の間に約170pxの空きは残る → V8・V10 の PC の列の広さと一緒に直す) |
| N2 | 決定がランダムと同じ大きさ・横は36〜38px | 決定 52px(高い欄 64px)・段の大半の幅・一番強い色。ランダムは幅22%の🎲の小さなボタン | 直した(縦 223×52・横 262×52・PC 178×64) |
| N3 / V11 | PC: HIGH SCORE の箱が110pxで割れる | 高い欄では全幅 | 直した |
| N4 | 横・PC: ジャケットが小さい | 横はジャケットの幅を「欄の高さ − 222px」(88〜幅の46%)に。PC は欄の幅いっぱい(240px) | 直した |
| N5 | 下の BPM の帯が曲名の下と二重 | 帯を外し、BPM を曲名の下の行へ | 直した |
| N10 / V13 | 横・PC: アシスト・ミラーが「OFF」だけ | 名前を小さく添えた(ボタンが60px未満のときだけ畳む) | 直した(568×320 は幅が足りず名前なし) |
| N13(一部) | 横の助手の一言 | 決定のすぐ上へ。欄が290px未満なら畳む | 置き場所だけ直した(文の切れ・台詞は後) |
| N14 / N15 | マルチの曲えらび | PC は同じ部品なのでソロと同じに。横の狭い欄(上に席の列)は今までどおり詰める | PC は直した。横の決定36pxは残る(欄が254pxしか無い) |

## 2. 曲えらび(縦・鍵・足りないビートP)

止め絵: [after2/songs-tate.png](after2/songs-tate.png)・[after2/songs-yoko.png](after2/songs-yoko.png)・[after2/songs-pc.png](after2/songs-pc.png)・[after2/songs-rot.png](after2/songs-rot.png)(直す前は 1. の before)

| 指摘 | どう直したか | 結果 |
|---|---|---|
| N6 | 縦の助手の一言を1行の形に(押すと全文)。一覧の上が約35px減り、見える曲が5曲→5曲半 | 直した(キャンペーンの帯・「裏でクイック…」の行はそのまま) |
| N7 | 幅380px未満は「モード選びへ戻る」を矢印だけに | 直した(320×568 の題の切れの検査が通るようになった) |
| N8 / V14 | 札の中の6pxの「HARDで解放」を外し、札の下に10pxの1行「🔒 HARDをクリアすると EXPERT・MASTER が遊べます」 | 直した(札には読み上げ用に「◯◯で解放」を残す) |
| N9 | 買っていない曲でビートPが足りないときは暗くし「あと◯ビートP」 | 直した(押すと今までどおり買う窓) |

残り(曲えらび): N11・N12、V7・V8・V12・V16(PC の列の広さ)。

### 回した検査
- 必須 20本 OK(ui-kanji は直した)
- rhythm-song-notice-landscape / rhythm-multi-select-fit / rhythm-song-select / rhythm-small-screen-layout / rhythm-edge-band / rhythm-safe-area-raw / rhythm-song-paid / rhythm-song-version / rhythm-rotated-dialog-height: OK
- 直す前の main でも落ちる物(今回の変更とは別): rhythm-landscape-layout(曲えらびまで入れない 6件)・rhythm-multi-play-guard(モード選びで待ち切れ)・rhythm-portrait-play-modes(320幅の題「曲選び」の切れ = N7)・rotation-height(モンサクの窓)・changelog-order(並びの逆転7か所)
- ja-wrap-beat-screen は10分で終わらず回し切れていない

## 切り欠きありの撮り直し(2026-11-22 窓口の決まり)

`SHOT_NOTCH=1 node tools/browser/visual-shoot.js …`(縦 上47・下34 / 横 左右47・下21 を `--mh-safe-*` から入れる)で撮った:
[notch/songs-tate.png](notch/songs-tate.png)・[notch/songs-yoko.png](notch/songs-yoko.png)・[notch/songs-rot.png](notch/songs-rot.png)

- 縦: 上の帯は切り欠きの下・「決定」は下の余白の上で隠れない。字の途中の折れ・数字の切れは無し。キャンペーンの帯(ビートP ×5)が出ている状態で撮った
- 横: 欄が低くなり、助手の一言が「決定」の裏に潜っていた → 欄の高さが300px以下なら一言を畳むようにした(667×375 の切り欠きなしでは出る)(切り欠きなしの横では今までどおり出る)
- 気づいた別の件: 横の左右47pxの余白が、曲選びの見出しにも一覧にも入っていない(`--mh-sa-left` を使っていない)。今回の変更とは別。本物の端末で切り欠きの裏に入るかは確かめていない
