# Muse への引き継ぎ: 助手の絵の位置の細かい調整(r1119-153 追記2・追跡 r1124-001)

社長「その方向だけど位置調整は muse に引き継いで」。ナカヨシが、全身絵がある全助手・全服の**立ち絵と顔アイコンを最新の全身絵からの切り出しへ切り替えた**(README の切り方案どおり)。
残っているのは**位置の細かい調整**(顔アイコンの寄せ・立ち絵の場面ごとの置き方)。

## 触る所(数字は1か所)

| 何を | どこ | 中身 |
| --- | --- | --- |
| 顔アイコンの寄せ・立ち絵の上限 | `tools/assistant/life-stand-cut.json` | `default` が全組の既定、キー(`mua`・`kiki:halloween` など)ごとに上書き |
| 頭のてっぺん・目・顎の点(全身画 normal の画素) | `tools/assistant/life-stand-marks.json` | 切る範囲の元。ずれていたら直す |
| 立ち絵を場面のどこに置くか(顔の点) | `monster-hero/src/parts/56-assistant-life-house.jsx` の `ASSISTANT_LIFE_STAND_FACE_OUTFIT` | 道具の `--write` が書く。手で直さない |
| 場面の置き方の計算 | 同じファイルの `assistantLifeStandBox` / `assistantLifeStandFrameSrc` / `assistantLifeStandLayout` | 立ち絵の置き場(`stand-*`)は全部「どの表情も normal の範囲で置く」 |

`life-stand-cut.json` の `face` の数字:

- `head` … 一辺が頭(てっぺん〜顎)の何倍か。大きいほど引く(既定 1.5)
- `up` … 頭のてっぺんより上へ、頭の高さの何割から切るか(既定 0.1)
- `dx` / `dy` … 一辺の何割ずらすか(+は右・下。既定 0)
- `px` … 縮める一辺(既定 256。吹き出しは 48〜72px で出る)
- `"face": null` … 顔アイコンを作らない(あつは `tools/assistant/face-from-fullbody.py` で作った物のまま)

`stand_max` … 立ち絵の長い辺の上限(既定 1000)。

## 打ち方

```
python3 tools/assistant/life-stand-from-fullbody.py --only <キー> --write --marks   # 1組だけ作り直す(立ち絵・顔アイコン・顔の表)
python3 tools/assistant/life-stand-from-fullbody.py --write                         # 全組(15組・15分ほど)
node tools/build.js
```

キー: `mua` `mua:halloween` `mua:card-master` `kiki` `kiki:halloween` `kiki:twintail` `momosuke` `momosuke:halloween`
`atsu` `kyuko` `kyuko:winter` `sorashido` `sorashido:hosei` `erubin` `erubin:sekiyuou`(ドラは全身絵が無いので対象外)

## 確かめ方

1. `--marks` の確かめ絵 `docs/progress/assistant-art/stand-marks/<キー>.png` で、目(緑)・顎(赤)の線が合っているか
2. 道具の「注意」: 表情ごとの大きさの違い・場面での顔のずれが出ていないか
3. `node tools/assistant/life-stand-stale-check.js`(全身画より立ち絵が古い組が無い) / `node tools/assistant/life-stand-edge-check.js`(頭・腕が枠で切れていない)
4. 画面の前後: `node tools/assistant/life-stand-before-after-shots.js --who <助手id> --outfits ,<服id>:<短い名前> --pair <下ごしらえの組の相手> --out docs/progress/assistant-art/<名前>`
   (バトルの入口・助手ライフの「見守る」を、前=origin/main と後=手元で並べる。組の相手は きき→mua、えるびん→sorashido など `tools/assistant/life-browser-shared.js` の組)
5. 場面の検査: `node tools/assistant/assistant-life-scene-stand-browser-check.js` / `node tools/assistant/assistant-art-scenes-check.js`
6. 顔アイコンは吹き出し・HOME の顔・部屋で丸く切って出る。`docs/progress/assistant-art/r1119-153-switch/face-*.png` の作り方(丸く切って並べる)で前後を見る

## 守ること

- 色を減らさない・引き伸ばさない(縮めるのはよい)・古い絵は消さない(r1115-143・r1119-153)
- `tools/make-assistant-faces.js`(古い胸から上の絵から顔を作る道具)は、全身絵がある表情をとばす。`--force-old` で上書きしない
- MFバトルカードの範囲の表 `CARD_ART_KNOWN_BOX`(84-screen-card-battle.jsx)は今回触らない(前から今の絵と合っていない。カード部の残り)

## 気になっている所(ナカヨシが見た範囲)

- 目の大きい絵柄(みゅあ・きき・ももすけ・きゅうこ)と男性陣で、同じ `head` だと顔の大きさの見え方が違う。助手ごとに `head` をそろえるか
- 表情ごとに全身画の大きさが大きく違う組(きき ふだん・ソラシド・みゅあ カードマスター)は、わくわく などで顔の大きさが 5〜7% 残る

## 済んだ所(ナカヨシ・2026-11-24 r1119-153 追記4)

- モードえらびの枠(モンヒロバトル・MFバトルカード・モンヒロビート)は、立ち絵(stand-*)を顔の位置と大きさで寄せるようにした(`77-screen-rhythm-multi.jsx` の `rhythmModeStandFacePlace`)。
  顔の表に `cx`(顔の横の真ん中)を足した(測り直し `python3 -I tools/assistant/life-stand-face-cx.py --write`)。前後の止め絵と突き合わせ表は `frame/`
- 顔の表(`ASSISTANT_LIFE_STAND_FACE_OUTFIT` の stand-*)の目・顎・てっぺん・m が、立ち絵を長い辺1000へ縮めた組(みゅあ3・きき3・きゅうこ・きゅうこ冬ほか)だけ下へずれていた(#7449 の切り出し道具の不具合: 縮めた絵の範囲に縮める前の点を当てていた)。
  `life-stand-from-fullbody.py` を直して全15組の top・eye・chin・cx を出し直した(絵は変えていない)。きき ツインテールの印(目が前髪・顎が口元)も直した。
  **m(場面での大きさ)だけは main の値のまま残した**。道具が出す正しい m にすると、助手ライフの場面でみゅあが大きくなり、みゅあ・ももすけの重なりが 54%→85% に増えたため(場面の大きさは Muse の受け持ち)。
  次に `--write` で切り出し直すと正しい m が書かれる。どちらにするかは Muse が場面を見て決める(道具が出した m: みゅあ ふだん 0.474・ハロウィン 0.434・カードマスター 0.81・きき ふだん 0.702・ハロウィン 0.709・ツインテール 0.67・きゅうこ 0.841・ソラシド補正 1.014)
