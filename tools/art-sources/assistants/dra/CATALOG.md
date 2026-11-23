# ドラ(dra)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/dra/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/dra/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | なし | 0 | | | |
| 立ち絵 | なし | 0 | | | |
| バスト絵 | `monster-hero/images/assistant/dra_<表情>.PNG` | 8 | 2026-09-17 #1468(8枚) | `tools/art-sources/assistants/dra/normal/bust/dra-expressions-sheet.png` | 8表情のシートから切り出し(`tools/image/split-expression-sheet.js`) |
| 顔アイコン | `monster-hero/images/assistant/face/dra_<表情>.PNG` | 8 | 2026-09-17 #1468(8枚) | `monster-hero/images/assistant/dra_*.PNG` | `tools/make-assistant-faces.js`(バスト絵から) |

## 旧版(正本ではない・保管庫)

- `archive/old-art/assistant/dra/normal/2026-09-17-duplicate-of-current-bust/`(8枚)… 旧版ではなく重複。配信中のバスト絵と1バイトも違わない同じ物が2か所にある(「同じ中身を2か所で持たない」決まり)。原本のシート dra-expressions-sheet.png は正本として残す

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

