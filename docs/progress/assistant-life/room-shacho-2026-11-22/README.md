# 社長の iPhone で助手ライフの部屋が崩れていた件(2026-11-22・台帳 r1119-098・ナカヨシ)

- 直す前: [shacho-iphone-1408.png](shacho-iphone-1408.png)(社長の iPhone 縦・みゅあの部屋・段8 #7155 の公開後)
- 1 の直し(#7180・先に公開): [fix1-notch-house.png](fix1-notch-house.png)・[fix1-notch-room.png](fix1-notch-room.png)
- 2〜6 の直し: [fix2-notch-room-mua.png](fix2-notch-room-mua.png)(切り欠きあり)・[fix2-notch-shortbottom-room-mua.png](fix2-notch-shortbottom-room-mua.png)(切り欠きあり+器が下の端まで届かない形=写真と同じ)・[fix2-notch-house.png](fix2-notch-house.png)
- 撮り方: `node tools/assistant/life-house-typed-shoot.js --notch [--short-bottom 48] --room mua`(`--notch` = iPhone の切り欠き 上47px・下34px)

| # | 写真で崩れていた所 | 原因 | 直し | 止め絵 |
| --- | --- | --- | --- | --- |
| 1 | 上の帯が iPhone の時刻・電池と重なり「戻る」が押せない | 型の上の帯(`.alu-top`)に切り欠きの余白が無かった | 帯の上に `--mh-sa-top` を足す(帯の中身は 48px のまま) | fix1-*・fix2-* の上 47px の下に帯 |
| 2 | 「気分: ご機嫌」が「ご機 / 嫌」で折れる | 部屋の頭の2行目を1つの文で流していた | 「 · 」で区切った塊ごとに折る | fix2-notch-room-mua の頭 |
| 3 | 「いま行くと得」の札と「行く」がタブに隠れる | 4 と同じ(器の下の端が画面より上で、タブの下の余白が二重) | 4 の直しでタブが元の高さになり、中身が送りきれる | fix2-notch-shortbottom-room-mua |
| 4 | 下のタブの絵が上で切れる | タブの高さ 56px の中に下の余白 34px を取り、中身が 22px になっていた。社長の端末は器がもともと下の端より上で終わる | タブは中身 56px+下の余白。器が下の端まで届かないぶんは余白から引く | fix2-notch-house の下・fix2-notch-shortbottom-room-mua の下 |
| 5 | 部屋の場面の上半分(壁)が間延び | 場面の高さが画面の高さの5割(縦で約420px) | 3.6割(縦で約300px・最低240px)に | fix2-notch-room-mua の場面 |
| 6 | 「M/B管理へ」の札が窓に重なる | 留守の札を壁の真ん中に置いていた | 窓の無い左上へ。字も型の段(16px・11px)に | fix2-notch-room-mua の「🍰 おやつ屋さんへ」 |

寝顔(`AssistantLifeRoomBed`)は変えていない(r1119-084)。

## なぜ撮影・測る検査で見逃したか

撮影はどれも**切り欠きの余白 0 のブラウザ**で撮っていた(env() はブラウザで作れない)。帯もタブも余白 0 なら正しく見えるので、①〜⑦の測る決まりも通っていた。
これからは `--notch`(ゲームの切り欠きの変数 `--mh-safe-top/bottom` に 47px・34px を入れる)で撮り、測る決まり③に「『戻る』が切り欠きにかからない」「帯は 48px+切り欠き」を足した。
器が下の端まで届かない形(社長の端末)は `--short-bottom` で作れる。

## 追記: 横の切り欠きと背の低い縦(窓口の全部の部への決まり・2026-11-22)

`--notch` は縦が上47px・下34px、横が左右47px・下21px。4つの大きさとも切り欠きあり・無しの両方で 28枚とも決まりどおり。

| 見つけた所 | 直し | 止め絵 |
| --- | --- | --- |
| 横: 上の帯だけ左右の切り欠きを避け、中身と下のタブが切り欠きにかかっていた | 中身(`.alu-body`)と下のタブにも左右の切り欠きの余白 | [fix3-notch-yoko-house](fix3-notch-yoko-house.png)・[fix3-notch-yoko-room](fix3-notch-yoko-room.png) |
| 幅320(320×568)の縦: 切り欠きで帯とタブが太り、家の主なボタン「見る」が最初の画面に入らなかった(家の絵を小さくすると部屋の札が切れた) | 背の低い縦(高さ640未満)は主なボタンを「次のごほうび」のすぐ下(家の絵の上)へ | [fix3-notch-s320-house](fix3-notch-s320-house.png) |
| 縦の部屋 | (変わらず) | [fix3-notch-tate-room](fix3-notch-tate-room.png) |
