# ソラシド(sorashido)の絵の目録 — どれが正本で、ゲームはどれを使っているか

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)
- このフォルダ(`tools/art-sources/assistants/sorashido/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/sorashido/` にあり、正本ではない**
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

## ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/sorashido[__<表情>].png` | 9 | 2026-11-24 5f1c4f99(8枚) / 2026-11-23 #7292(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない。8表情は 2026-11-23 に #7292 の前の版(2026-11-20〜21 に入れた物)へ戻した。表情なしの絵だけ #7292 の版 |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/sorashido_<表情>.png` | 8 | 2026-11-24 #7501(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた(2026-11-20〜21 の高画質版)。作り直すなら全身絵から `tools/assistant/life-stand-from-fullbody.py`(r1119-122) |
| バスト絵 | `monster-hero/images/assistant/sorashido_<表情>.PNG` | 9 | 2026-11-21 4c8aa98d0(4枚・うち寝顔1) / 2026-11-20 ffdba7903(5枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/sorashido_<表情>.PNG` | 9 | 2026-11-24 #7501(8枚) / 2026-11-20 633bd64be(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 服「補正」(hosei)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/sorashido_hosei[__<表情>].png` | 9 | 2026-11-21 79035943b(7枚) / 2026-11-20 15464edad(1枚) / 2026-11-18 f24fe446e(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-hosei/sorashido_<表情>.png` | 8 | 2026-11-23 69cee4cd(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/hosei/sorashido_<表情>.PNG` | 8 | 2026-11-20 3e9923f8c(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/hosei/face/sorashido_<表情>.PNG` | 8 | 2026-11-25 b4ab01f3(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## 旧版(正本ではない・保管庫)

- `archive/old-art/assistant/sorashido/normal/2026-11-14-old-fullbody-received-v1/`(3枚)… ソラシド(ふだん=馬骨)の全身絵は #7292(2026-11-23)で作り直した完成品へ差し替え済み。寝顔も 2026-11-21 に直接入れた物が現行
- `archive/old-art/assistant/sorashido/hosei/2026-11-12-old-fullbody-received-v1/`(2枚)… ソラシド(補正)の全身絵8表情は 2026-11-20〜21 に直接入れた完成品へ差し替え済み
- `archive/old-art/assistant/sorashido/hosei/2026-10-27-old-bust-sheet/`(1枚)… ソラシドの最初のバスト絵8表情のシート(2026-10-27)。バスト絵・顔は、ふだん・補正とも 2026-11-20〜21 に直接入れた物へ差し替え済み

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/assistants/_shared/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は 各キャラの `<服>/pre-resize-2026-11-17/bust/` にある。

