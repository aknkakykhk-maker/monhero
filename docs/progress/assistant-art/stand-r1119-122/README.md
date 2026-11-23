# 立ち絵の切り出し(r1119-122・追跡表 r1123-009)

道具: `tools/assistant/life-stand-from-fullbody.py`(#7325)/ 検査: `tools/assistant/life-stand-edge-check.js`

## 止め絵

| 絵 | 中身 |
| --- | --- |
| `sorashido-stand-before-after.jpg` | ソラシド通常の8表情。上=前・下=後(赤い枠が絵の端) |
| `scene-tate-atsu-sorashido-before-after.jpg` / `scene-yoko-…` | 助手どうしの場面(縦・横) |
| `room-tate-awake-sorashido-before-after.jpg` / `room-yoko-…` | 助手ライフの家(ソラシドの部屋) |
| `../stand-marks/sorashido.png` | 道具が自動で測り直した点(黄=頭のてっぺん・緑=目・赤=顎) |

## 突き合わせ表(r1119-122)

| 台帳の中身 | どう満たしたか | 見る所 |
| --- | --- | --- |
| 切る枠は透過の外形を見て決め、頭の上と左右で絵が切れないようにする | 8表情ぶんの不透明な画素が上・左・右の端に触れない所まで枠を広げた。困り顔の腕(前は左の端で切れていた)・ワクワクのこぶし・驚きの手に余白がある | `sorashido-stand-before-after.jpg` の troubled・excited・surprise |
| 下は胸で切ってよい | 顎の位置が絵の高さの 0.43 になる所で切る(前と同じ) | 同上 |
| 表情ごとに顔の位置がばらつかない | 8表情を頭で重ね合わせ、8枚とも同じ大きさ・同じ目の位置。場面での顔のずれは全表情で前より小さい(例: 喜び 70%→63%・ワクワク 37%→27%。顔の長さに対する割合) | 場面の前と後 |
| 全身画の差し替えのたびに手で測り直さない | 点を `life-stand-marks.json` に持ち、全身画が替わったら git の履歴の前の全身画と重ね合わせて自動で移す。今回も、表情の全身画が元の版に戻ったのを見つけて自動で測り直した | `../stand-marks/sorashido.png` |
| 色を減らさない(r1115-143) | 全身画の画素のまま切り、減色・拡大・縮小なし | — |
| 場面の位置がずれない | 顔の表(56-assistant-life-house.jsx の stand-normal の sorashido)を道具が書きこみ。家・場面で頭の高さと顔の大きさが前とそろっている | 場面・家の前と後 |

## 前提の変化(2026-11-23 09:35 e23eba59)

社長が、ソラシドの表情8枚の全身画を元の版に戻した(差し替えは土台 `sorashido.png` だけ)。そのため:

- 立ち絵は、戻った(元の版の)表情の全身画から作り直した(端の切れの直しと顔のずれを減らすため)
- 顔アイコンは、前の物も同じ全身画から作った物なので作り直していない

## 切れていた立ち絵(全員・ASSISTANT_STAND_ART の 120 枚)

| 置き場 | 枚数 | 扱い |
| --- | --- | --- |
| stand-normal/sorashido_troubled | 1 | 直した(この PR) |
| stand-normal/kyuko_angry・kyuko_normal | 2 | 残り: 全身画そのものが右の端で切れている |
| stand-normal/myua_angry・myua_crying | 2 | 残り: 表情の並んだ絵(シート)から作った物で、全身画とは絵が違う |
| stand-card-master/myua_*(crying・happy・normal・surprise・troubled・wink) | 6 | 保留: 全身画から作れるが、表情ごとに姿勢が違い、場面で顔がずれる(窓口に相談) |
| stand-hosei/sorashido_*(8表情) | 8 | 保留: 同上 |
