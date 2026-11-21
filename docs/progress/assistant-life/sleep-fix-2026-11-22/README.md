# 寝姿の作り直し(2026-11-22 社長「寝顔はききだけじゃなくて全部だめ」「サイズ感も合ってないよ」→「全員ぶん作り直す」)

## 社長に見てほしい止め絵

- **縦 390×844**: [after-all-390.png](after-all-390.png)(助手8人のふだんの服+着せ替え5着=13部屋・深夜2時)
- **幅320**: [after-all-320.png](after-all-320.png)(同じ13部屋)
- 前の形(崩れていたききのツインテールと、11/15 の形): [before-after-390.png](before-after-390.png)の左端・[../sleep-face-2026-11-15/after-sleep-8people.png](../sleep-face-2026-11-15/after-sleep-8people.png)

## 変えたこと(`56-assistant-life-roomview.jsx` の `AssistantLifeRoomBed`)

| 社長の言葉 | 前 | 後 |
| --- | --- | --- |
| 頭が枕の上に乗る・枕からはみ出して布団の左端に重ならない | 枕(幅110px)より頭が大きく、布団が顔の下半分にかぶっていた | 枕を頭の長さの1.1倍にし、頭を枕の上に置く。布団は顎の手前から右だけに掛ける(顔にかぶせない) |
| 布団は壁のように立てず、体に掛かる低い高さ | 布団のいちばん高い所が頭の上の端(敷き布団から約1.5U) | 敷き布団から体の厚みぶん(0.5U)の低いふくらみ。胸・ひざ・足先のふくらみの形は前のまま |
| ベッド・枕・布団・頭の大きさの釣り合い | ベッド・枕・頭がそれぞれ別の数(幅の80%・110px・顔30px)で決まっていた | ベッドの長さ=頭の長さの4つぶん。頭・枕・布団・ベッド・頭板を、全部その1つの単位から決める |
| 全身の寝顔の絵(ききのツインテール・きゅうこの冬の装い) | 縮める決まり(r1115-005)がつま先まで数えて、頭がとても小さく浮いていた | 縦が横の2.2倍より長い全身の絵には縮める決まりを当てない |

- 床のマスモンの大きさは変えていない(対戦の場の大きさの表 `MONSTER_STAGE_SIZE` は使っていない。部屋のマスモンは今までの大きさ)
- 撮り直し: `node tools/assistant/life-house-typed-shoot.js --phone --hour 2 --rooms mua,kiki,momosuke,dra,atsu,kyuko,sorashido,erubin`(着せ替えは `--worn kiki:kiki_twintail_v1,mua:mua_card_master_v1,kyuko:kyuko_winter_v1,sorashido:sorashido_hosei_v1,erubin:erubin_sekiyuou_v1`)
