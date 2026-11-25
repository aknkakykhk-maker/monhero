# ももすけ(momosuke)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/momosuke/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/momosuke/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/momosuke[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistants/momosuke/normal/fullbody/momosuke-normal-sheet*.png`<br>`tools/art-sources/assistants/momosuke/normal/fullbody/msg1-pink-bunny.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/momosuke_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | `tools/art-sources/assistants/momosuke/normal/fullbody/momosuke-normal-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/momosuke_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-10-04 #2091(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/face/momosuke_<表情>.PNG` | 9 | 2026-11-25 88b1da45(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

## 服「ハロウィン」(halloween)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/momosuke_halloween[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistants/momosuke/halloween/fullbody/momosuke-halloween-sheet*.png`<br>`tools/art-sources/assistants/momosuke/halloween/fullbody/msg5-pink-bunny-devil-halloween.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-halloween/momosuke_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | `tools/art-sources/assistants/momosuke/halloween/fullbody/momosuke-halloween-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/halloween/momosuke_<表情>.PNG` | 9 | 2026-11-18 492a7160d(1枚・うち寝顔1) / 2026-10-04 #2092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/halloween/face/momosuke_<表情>.PNG` | 9 | 未コミット (8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

## 服「サンタ」(santa)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/momosuke_santa[__<表情>].png` | 10 | 2026-11-25 01c7413c(10枚・うち表情なし1) | `tools/art-sources/assistants/momosuke/santa/received/momosuke_santa_*.png` | `tools/assistant/life-fullbody-art.py`(受け取った全身の10枚。received は加工せずに保管) |
| 立ち絵 | `monster-hero/images/assistant/stand-santa/momosuke_<表情>.png` | 8 | 2026-11-25 01c7413c(8枚) | `tools/art-sources/assistants/momosuke/santa/received/momosuke_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/santa/momosuke_<表情>.PNG` | 9 | 2026-11-25 01c7413c(9枚・うち寝顔1) | `tools/art-sources/assistants/momosuke/santa/received/momosuke_santa_*.png` | `tools/assistant/life-fullbody-art.py` の全身絵をそのまま写す(みゅあ・ききのサンタと同じく、全身の絵をバスト絵の置き場に置く) |
| 顔アイコン | `monster-hero/images/assistant/santa/face/momosuke_<表情>.PNG` | 9 | 2026-11-25 01c7413c(9枚・うち寝顔1) | `tools/art-sources/assistants/momosuke/santa/received/momosuke_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(寝顔は座った姿の絵から、ふつうの顔と同じ大きさで切る) |

## 旧版(正本ではない・保管庫)

なし

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

