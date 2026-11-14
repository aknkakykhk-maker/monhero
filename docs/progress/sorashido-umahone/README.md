# ソラシド『馬骨』(新しい絵を既定の服に)・『補正』(いままでの絵)(r1115-013・ココロ)

材料: 枝 hq/incoming-soracid-umahone-1115(sheet1=ふつう・やったー・ウインク・びっくり / sheet2=困り・怒り・泣き・大喜び / sleep.png=寝顔の全身)。
原本は `tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-{sheet1,sheet2,sleep}.png` に加工せず置いた。
8表情の当てはめ: normal=ふつう・happy=やったー・wink=ウインク・surprise=びっくり・troubled=困り・angry=怒り・crying=泣き・excited=大喜び。

## 絵の置き場(馬骨=既定 / 補正=服)
| | 馬骨(既定) | 補正(服 `sorashido_hosei_v1`) |
| --- | --- | --- |
| 全身画 | `fullbody/sorashido__<表情>.png`(`life-fullbody-art.py`・縫い目で切って背景のにじみ・光を取る) | `fullbody/sorashido_hosei__<表情>.png`(移しただけ) |
| 立ち絵(胸から上) | `stand-normal/sorashido_*.png`(`life-stand-from-fullbody.py`) | `stand-hosei/sorashido_*.png`(移しただけ) |
| 胸から上の絵・顔アイコン | `sorashido_<表情>.PNG`・`face/`(`sorashido-umahone-busts.py`) | `hosei/sorashido_<表情>.PNG`・`hosei/face/`(移しただけ) |
| 寝顔 | `sorashido_sleep.PNG`・`face/sorashido_sleep.PNG`(sleep.png から。ZZZ の記号は消した) | いままでの閉じた目(絵なし・SVG) |

## 保存(CLAUDE.md ⑦)
- キーは増やさない。`mh_assistant_costume_owned_v1`・`mh_assistant_costume_worn_v1` の意味は変えない。
- 『補正』=starter の服(えるびんの石油王と同じ)。全員が持っている扱いで owned には書かない。着ると `worn.sorashido='sorashido_hosei_v1'` だけが入る(`picker.js` で確認: 着替え後の worn=`{"sorashido":"sorashido_hosei_v1"}`・owned=変化なし)。
- いままでソラシドの服を持っていた人はいない(服が1着も無かった)ので、読む人は全員「元の服」=新しい『馬骨』。移行の処理は書いていない。

## 突き合わせ表
| 決めごと(窓口の頼み) | どこで満たしているか |
| --- | --- |
| 新しい絵を既定=馬骨、いまの絵を補正(着替えで選べる) | `picker-{umahone,hosei}-{390,320}.jpg`(着替えの窓に「馬骨」「補正」) |
| 新しい絵から顔アイコン8表情と寝顔 | `expressions-umahone.jpg`(上から 全身・立ち絵・顔アイコン(+寝顔)・寝顔の胸から上) |
| ふちを仕上げる | 全身画を暗い・白い背景に重ねて確認(にじみなし) |
| 顔の大きさ 34px | `scene-*`(あつ・ソラシド。両方 34px)。検査 `assistant-art-scenes-check`(通常・`--outfit c`=補正)OK |
| 止め絵(着替えの窓・2人の場面・部屋・地図・寝顔 × 馬骨と補正 × 390/320) | `picker-*`・`scene-*`・`room-awake-*`・`room-sleep-*`・`map-*`(`-390`=幅390・`-320`=横の小さい画面 568×320 / 着替えの窓だけ幅320×640) |
