# 立ち絵を全身画に差し替え(r1114-093・ココロ)

きき(ふだん・ハロウィン)・あつ・キュウコ・ソラシドの立ち絵を、みゅあと同じく8表情の全身画から切った胸から上の絵にした。
道具: `tools/assistant/life-stand-from-fullbody.py`(全身画の png から作る。元のシートが無いきき(ふだん)もこれで作れる)。

## 突き合わせ表

| 決めごと | どこで満たしているか(止め絵 `shots/`) |
| --- | --- |
| 11/11「立ち絵を使っている所すべてを全身画の8表情に」 | `home`・`house`・`map`・`room`・`scene`・`album`・`cardvs/cardfoe/cardresult/cardtutor`・`rhythm` の全場面を検査(`assistant-art-scenes-check` 865枚 OK) |
| 助手ライフのトップ・部屋 | `house-tate-awake.jpg`(きき・あつ・キュウコ・ソラシドが全身画の顔) / `room-tate-awake-kyuko.jpg` ほか |
| 顔の大きさがそろう・切れない | 検査の「ばらつき」「切れ」なし。顔の表 `ASSISTANT_LIFE_STAND_FACE_OUTFIT` に5着ぶん |
| 寝顔のずれなし | `room-*-sleep-*.jpg` ・検査の「寝顔のずれ」なし |

## 残り(まだの助手)
ももすけ・えるびん・ももすけハロウィン・ドラは8表情の全身画が無いので今のまま(下の切れ目を目立たなくする案は未着手。社長に見せてから)。

## 窓口の確認(main と枝の比べ)
- `compare-room-kyuko-main-vs-branch.jpg`(左 main・右 枝): 机の上の黒い影は main にもある(机の影)。枝の差し替えで出たものではない。胸の下は、みゅあと同じ作りで薄く消える。
- `compare-scene-atsu-sorashido-main-vs-branch.jpg`(左 main・右 枝): main は顔のアップ(顔の絵)。枝は胸から上で、顔が小さくなり下の消え際が上がる。顎の位置の割合(0.43→0.33)や幅の切り詰めを試したが、場面では変わらなかった(顔の大きさは場面の組み方で決まる)。
