# 開催中の絵(リボンを消した版)の作り方

台帳 r1126-061 追記1(社長「リボンだけ切り取る」)。告知ポスター(`../received/xmas-2026-notice-*_v3.png`。11/27 に開催期間を 11/28 10:00 からに直した版・r1126-063)の上の赤いリボン「クリスマスイベント 開催予告」だけを消し、開催中のお知らせ・開幕の更新履歴に使う。予告の絵はリボン入りのまま。

- リボンの本体: リボンの右の空き(夜空と金の枠の線)の「行ごとの平均の色」を土台にし、雪の細かい模様をずらしながら重ねて置き換える
- 題字の左右に垂れた所: 左右の端の範囲だけで、赤・緑(と金の縁)を選んで周りの色で埋める(題字の金色は選ばない)
- 横長は、列ごとに題字の上の端を測り、その手前まで置き換える(リボンの下の金の縁を残さない)

## 作り直す(日付を直した絵が届いたとき)

`opencv-python-headless` と `numpy` が要る(`pip install opencv-python-headless numpy`)。新しい絵のリボンと題字の位置が同じなら、下のとおり打つだけ。位置が違うときは数(本体の x・y、写す元、垂れの範囲)を測り直す。

```
R=tools/art-sources/promo/xmas-2026/received; D=tools/art-sources/promo/xmas-2026/derived
python3 $D/deribbon.py $R/xmas-2026-notice-square_v3.png $D/xmas-2026-open-square.png '{"body":[215,1045,80],"sample":[1045,1090],"tails":[[215,330,40,86,"gold"],[215,272,86,118],[930,1045,40,86,"gold"],[978,1045,86,118]]}'
python3 $D/deribbon.py $R/xmas-2026-notice-wide_v3.png $D/xmas-2026-open-wide.png '{"body":[540,1215,52],"sample":[1225,1290],"feather":18,"extend":14,"tails":[[540,660,28,62,"gold"],[540,612,62,84],[1100,1215,28,62,"gold"],[1145,1215,62,84]]}'
```

道具は確かめ用に、消した所の印(`<出力>.mask.png`)も書き出す。見終わったら消してよい(リポジトリには入れない)。

縮めて入れる(配信するのは横長だけ。正方形は使う所が無いので入れていない):

```
node -e "require('./tools/node_modules/sharp')('tools/art-sources/promo/xmas-2026/derived/xmas-2026-open-wide.png').resize(1000,500,{fit:'fill',kernel:'lanczos3'}).jpeg({quality:90,mozjpeg:true}).toFile('monster-hero/images/events/xmas-2026-open-wide.jpg')"
node tools/build.js && node tools/image-asset-check.js
```

消す前と後の止め絵: `docs/progress/event-xmas-2026/opening-review/ribbon-before-after-*.jpg`。作り直したら、目で見て題字が溶けていないか・赤が残っていないかを確かめる。
