# きゅうこ(kyuko)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/kyuko/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/kyuko/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kyuko[__<表情>].png` | 9 | 2026-11-22 7d171f10f(9枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/kyuko_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | `monster-hero/images/assistant/fullbody/kyuko__*.png` | `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/kyuko_<表情>.PNG` | 9 | 2026-11-22 5da1fb0de(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/kyuko_<表情>.PNG` | 9 | 2026-11-25 381dcb0e(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 服「冬の装い」(winter)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kyuko_winter[__<表情>].png` | 9 | 2026-11-18 f24fe446e(9枚・うち表情なし1) | `tools/art-sources/assistants/kyuko/winter/fullbody/kyuko_winter__*.png` | `tools/assistant/life-fullbody-art.py`。2026-11-18 に表示の大きさへ縮めた |
| 立ち絵 | `monster-hero/images/assistant/stand-winter/kyuko_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | `tools/art-sources/assistants/kyuko/winter/pre-resize-2026-11-17/stand/kyuko_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す)。正本は表示の大きさへ縮める前(2026-11-17)の物 |
| バスト絵 | `monster-hero/images/assistant/winter/kyuko_<表情>.PNG` | 9 | 2026-11-18 3d0172a97(1枚) / 2026-11-18 7f0d4898a(8枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/winter/face/kyuko_<表情>.PNG` | 9 | 2026-11-23 69cee4cd(8枚) / 2026-11-18 0f3cfbb7e(1枚・うち寝顔1) | `tools/art-sources/assistants/kyuko/winter/pre-resize-2026-11-17/face/kyuko_*.PNG` | 正本は表示の大きさへ縮める前(2026-11-17)の物。縮めただけ |

## 服「クリスマス」(santa)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kyuko_santa[__<表情>].png` | 10 | 2026-11-25 76509b02b(10枚・うち表情なし1) | `tools/art-sources/assistants/kyuko/santa/received/kyuko_santa_*.png` | `tools/assistant/life-fullbody-art.py`(受け取った全身の10枚。received は加工せずに保管。輪郭の外の薄いもやは書き出しで掃除) |
| 立ち絵 | `monster-hero/images/assistant/stand-santa/kyuko_<表情>.png` | 8 | 2026-11-25 76509b02b(8枚) | `tools/art-sources/assistants/kyuko/santa/received/kyuko_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/santa/kyuko_<表情>.PNG` | 9 | 2026-11-25 76509b02b(9枚・うち寝顔1) | `tools/art-sources/assistants/kyuko/santa/received/kyuko_santa_*.png` | `tools/assistant/life-fullbody-art.py` の全身絵をそのまま写す(ほかの助手のクリスマスの衣装と同じく、全身の絵をバスト絵の置き場に置く) |
| 顔アイコン | `monster-hero/images/assistant/santa/face/kyuko_<表情>.PNG` | 9 | 未コミット (9枚・うち寝顔1) | `tools/art-sources/assistants/kyuko/santa/received/kyuko_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(顔の切り方は life-stand-cut.json の kyuko:santa。きゅうこ(ふだん)・冬の装いの顔にそろえる) |

## 旧版(正本ではない・保管庫)

- `archive/old-art/assistant/kyuko/normal/2026-11-12-old-fullbody-received-v1/`(2枚)… きゅうこ(ふだん)の全身絵は 2026-11-22 に作り直した完成品へ差し替え済み(立ち絵もそこから切り直した)

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

