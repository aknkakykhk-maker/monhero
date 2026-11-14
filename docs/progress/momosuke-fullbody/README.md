# ももすけの立ち絵を全身画に(r1115-011・ココロ)

材料: 枝 hq/incoming-momosuke-fullbody-1115 の4枚(1774×887・4体ずつ)を `tools/art-sources/assistant-fullbody/received-v1/momosuke-{normal,halloween}-sheet{1,2}.png` に原本のまま置いた。
並び: sheet1=normal(にっこり)・happy(両手を広げる)・wink(指を口に)・surprise / sheet2=troubled(悩み)・angry・crying・excited(やったー)。
作り方: `life-fullbody-art.py`(縫い目で切る・背景のにじみと光を取る・減色)→ 全身画 `images/assistant/fullbody/momosuke[_halloween]__<表情>.png`。
立ち絵: `life-stand-from-fullbody.py`(胸から上・左右は顔の長さの6倍で切って外側を薄く消す)→ `stand-normal/momosuke_*`・`stand-halloween/momosuke_*`。

## 突き合わせ表

| 決めごと(台帳・窓口の頼み) | どこで満たしているか |
| --- | --- |
| #6264 と同じ形で立ち絵を全身画に | `ASSISTANT_STAND_ART` に momosuke・momosuke:halloween。顔の表は `stand-normal`/`stand-halloween` |
| 顔の大きさ 34px(みゅあ・ももすけと同じ) | `shots-normal-390.jpg` 場面左(みゅあ・ももすけとも 34px)。ハロウィンは みゅあのハロウィンの羽に合わせて 27px(同じ場面の2人は同じ) |
| ふちのピンク・赤のにじみを仕上げる | 全身画を暗い背景・白い背景に重ねて確認(にじみなし)。立ち絵は左右を薄く消した |
| 通常・ハロウィン × 幅390/320 × 2人の場面・部屋・地図 | `shots-{normal,halloween}-{390,320}.jpg`(390: 場面・部屋(起)・部屋(寝)・地図 / 320: 左上=場面・右上=部屋(起)・左下=部屋(寝)・右下=地図) |
| 見た目検査 | `assistant-art-scenes-check`(通常・ハロウィン)とも「伸び・ぼやけ・切れ・小さすぎ・ばらつき・寝顔のずれ なし」 |
