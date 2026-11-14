# えるびんの立ち絵を全身画に(ふだん・石油王)(r1115-017・ココロ)

材料: 枝 hq/incoming-erubin-fullbody-1115 の4枚(1024×1536・2×2で4体ずつ)を `tools/art-sources/assistant-fullbody/received-v1/erubin-{normal,sekiyuou}-sheet{1,2}.png` に原本のまま置いた。
並び: sheet1=normal(ふつう・手をポケット)・happy(腰に手)・wink(親指を立てる)・surprise(両手を広げる) / sheet2=troubled(頭をかく)・angry(腕組み)・crying(泣き)・excited(やったー)(通常も石油王も同じ)。
作り方: `life-fullbody-art.py`(GRID_SHEETS。2×2を切り、シートの切れ目で切れた靴の先などのかけらを消し、背後の茶色の光・ふちの赤いにじみを取る)→ `fullbody/erubin[_sekiyuou]__<表情>.png`。立ち絵は `life-stand-from-fullbody.py`(左右は切らない)→ `stand-normal/erubin_*`・`stand-sekiyuou/erubin_*`。
石油王は既存の着せ替えの服(`erubin_sekiyuou_v1`)の全身画・立ち絵を新しい絵にした(服の id・保存は変えていない。服の一覧の顔アイコンは今のまま)。

## 突き合わせ表
| 決めごと(窓口の頼み) | どこで満たしているか |
| --- | --- |
| 通常・石油王 各8表情を全身画・立ち絵に | `expressions-{normal,sekiyuou}.jpg`(上段=全身・下段=立ち絵) |
| 背後の茶色の光・ふちの赤いにじみを仕上げる | 全身画を暗い・白い背景に重ねて確認(にじみ・光なし)。体から離れた小さな塊(靴の先のかけら)も消した |
| 髪の毛先・頭布の白いふち・肩を拡大で確かめる(11/05「切り抜きの透過が雑」) | 暗い背景(通常)・白い背景(石油王)で拡大: 毛先・頭布のふち・肩とも、段になった所・白や赤のふちなし |
| 止め絵は大きく(2倍)・8表情の一覧 | `scene-*`(場面)・`room-awake-*`・`room-sleep-*`・`map-*`(390)と `*-320.jpg`、`expressions-*.jpg` |
| 顔の大きさ 34px・左右を切らない | `scene-normal-390.jpg`(きゅうこ・えるびんとも 34px)。見た目検査(場面・部屋・地図)OK |
