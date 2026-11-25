# みゅあ(mua)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/mua/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/mua/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua[__<表情>].png` | 9 | 2026-11-22 7ce3fcf07(8枚) / 2026-11-21 b17ac15e2(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/myua_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/myua_<表情>.PNG` | 9 | 2026-11-21 f0d5f08a9(8枚) / 2026-11-18 d09cb3dcd(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/myua_<表情>.PNG` | 9 | 2026-11-23 69cee4cd(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 服「ハロウィン」(halloween)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua_halloween[__<表情>].png` | 9 | 2026-11-22 9ecc9bc30(8枚) / 2026-11-21 0ebaba2e1(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-halloween/myua_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/halloween/myua_<表情>.PNG` | 9 | 2026-11-21 2ed9ce84c(8枚) / 2026-11-18 492a7160d(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/halloween/face/myua_<表情>.PNG` | 9 | 2026-11-23 69cee4cd(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 服「デュエルマスター」(card-master)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua_card-master[__<表情>].png` | 9 | 2026-11-23 be464a17(9枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-card-master/myua_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/card-master/myua_<表情>.PNG` | 9 | 2026-11-21 e6b4874ee(8枚) / 2026-11-18 dac414f04(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/card-master/face/myua_<表情>.PNG` | 9 | 2026-11-23 69cee4cd(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 服「サンタ」(santa)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua_santa[__<表情>].png` | 10 | 2026-11-25 3f56c113(10枚・うち表情なし1) | `tools/art-sources/assistants/mua/santa/received/mua_santa_*.png` | `tools/assistant/life-fullbody-art.py`(受け取った全身の10枚。received は加工せずに保管) |
| 立ち絵 | `monster-hero/images/assistant/stand-santa/myua_<表情>.png` | 8 | 2026-11-25 3f56c113(8枚) | `tools/art-sources/assistants/mua/santa/received/mua_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/santa/myua_<表情>.PNG` | 9 | 2026-11-25 3f56c113(9枚・うち寝顔1) | `tools/art-sources/assistants/mua/santa/received/mua_santa_*.png` | `tools/assistant/life-fullbody-art.py` の全身絵をそのまま写す(ききのツインテールと同じく、全身の絵をバスト絵の置き場に置く) |
| 顔アイコン | `monster-hero/images/assistant/santa/face/myua_<表情>.PNG` | 9 | 2026-11-25 b3f0ec5d(1枚・うち寝顔1) / 2026-11-25 3f56c113(8枚) | `tools/art-sources/assistants/mua/santa/received/mua_santa_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(寝顔はふつうの顔と同じ枠で切る) |

## 旧版(正本ではない・保管庫)

- `archive/old-art/assistant/mua/normal/2026-11-11-old-fullbody-received-v1/`(2枚)… みゅあ(ふだん)の全身絵・立ち絵は 2026-11-21〜22 に作り直した完成品へ差し替え済み。この受け取り第1版から道具を回すと、作り直す前の絵に戻る
- `archive/old-art/assistant/mua/halloween/2026-11-11-old-fullbody-received-v1/`(2枚)… みゅあ(ハロウィン)。同上(2026-11-21〜22 に差し替え済み)
- `archive/old-art/assistant/mua/card-master/2026-11-11-old-fullbody-received-v1/`(2枚)… みゅあ(デュエルマスター)。同上(2026-11-21〜22 に差し替え済み)
- `archive/old-art/assistant/mua/card-master/2026-10-27-old-bust-received/`(8枚)… みゅあ(デュエルマスター)のバスト絵の最初の原本(2026-10-27)。バスト絵・顔は 2026-11-21 に作り直した物へ差し替え済み
- `archive/old-art/assistant/mua/normal/2026-11-17-old-bust-pre-resize/`(8枚)… みゅあ(ふだん)のバスト絵の、縮める前(2026-11-17)の版。バスト絵は 2026-11-21 に作り直した物へ差し替え済みなので、もう現行の原本ではない

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

