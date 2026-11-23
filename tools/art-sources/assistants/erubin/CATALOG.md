# えるびん(erubin)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/erubin/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/erubin/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/erubin[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistants/erubin/normal/fullbody/erubin-normal-sheet*.png`<br>`tools/art-sources/assistants/erubin/normal/fullbody/msg7-curly-man-casual.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/erubin_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistants/erubin/normal/fullbody/erubin-normal-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `tools/art-sources/assistants/erubin/normal/bust/erubin-expressions-sheet.png` | `tools/assistant/refine-assistant-cutout.py`(切り出した減色前の物は `tools/art-sources/assistants/erubin/normal/bust/cut/`)→ 256色 |
| 顔アイコン | `monster-hero/images/assistant/face/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `monster-hero/images/assistant/erubin_*.PNG` | `tools/make-assistant-faces.js`(バスト絵から) |

## 服「石油王」(sekiyuou)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/erubin_sekiyuou[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistants/erubin/sekiyuou/fullbody/erubin-sekiyuou-sheet*.png`<br>`tools/art-sources/assistants/erubin/sekiyuou/fullbody/msg8-curly-man-robe.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-sekiyuou/erubin_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistants/erubin/sekiyuou/fullbody/erubin-sekiyuou-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/sekiyuou/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `tools/art-sources/assistants/erubin/sekiyuou/bust/erubin-costume-sekiyuou-sheet.png` | `tools/assistant/refine-assistant-cutout.py … --cloth`(減色前の物は `tools/art-sources/assistants/erubin/sekiyuou/bust/cut/`)→ 256色 |
| 顔アイコン | `monster-hero/images/assistant/sekiyuou/face/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `monster-hero/images/assistant/sekiyuou/erubin_*.PNG` | `tools/make-assistant-faces.js monster-hero/images/assistant/sekiyuou` |

## 旧版(正本ではない・保管庫)

なし

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

