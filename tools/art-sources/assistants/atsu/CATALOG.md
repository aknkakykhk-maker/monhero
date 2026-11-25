# あつ(atsu)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/atsu/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/atsu/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/atsu[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-16 #6742(8枚) | `tools/art-sources/assistants/atsu/normal/fullbody/atsu-8expressions-sheet.png`<br>`tools/art-sources/assistants/atsu/normal/fullbody/atsu_transparent_fixed.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/atsu_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | `tools/art-sources/assistants/atsu/normal/fullbody/atsu-8expressions-sheet.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/atsu_<表情>.PNG` | 9 | 2026-11-18 42fb3f2ab(1枚・うち寝顔1) / 2026-10-22 #3286(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/face/atsu_<表情>.PNG` | 9 | 2026-11-16 #6742(8枚) / 2026-11-15 7a486a01c(1枚・うち寝顔1) | `tools/art-sources/assistants/atsu/normal/fullbody/atsu-8expressions-sheet.png` | `tools/assistant/face-from-fullbody.py`(原画の画素のまま・r1115-203) |

## 服「クリスマス(探偵)」(santa)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/atsu_santa[__<表情>].png` | 10 | 2026-11-25 5bbff8fab(10枚・うち表情なし1) | `tools/art-sources/assistants/atsu/santa/received/atsu_santa_*.png` | `tools/assistant/life-fullbody-art.py`(受け取った全身の10枚。received は加工せずに保管) |
| 立ち絵 | `monster-hero/images/assistant/stand-santa/atsu_<表情>.png` | 8 | 2026-11-25 5bbff8fab(8枚) | `tools/art-sources/assistants/atsu/santa/received/atsu_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/santa/atsu_<表情>.PNG` | 9 | 2026-11-25 5bbff8fab(9枚・うち寝顔1) | `tools/art-sources/assistants/atsu/santa/received/atsu_santa_*.png` | `tools/assistant/life-fullbody-art.py` の全身絵をそのまま写す(ほかの助手のクリスマスの衣装と同じく、全身の絵をバスト絵の置き場に置く) |
| 顔アイコン | `monster-hero/images/assistant/santa/face/atsu_<表情>.PNG` | 9 | 2026-11-25 2805e672(9枚・うち寝顔1) | `tools/art-sources/assistants/atsu/santa/received/atsu_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(顔の切り方は life-stand-cut.json の atsu:santa。目の高さ・顔の幅はナカヨシの基準に合わせた) |

## 旧版(正本ではない・保管庫)

なし

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

