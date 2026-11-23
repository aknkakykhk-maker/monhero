# 助手の絵の目録(どれが正本で、ゲームはどれを使っているか)

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->

台帳 r1119-124。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。** 旧版は保管庫 `archive/old-art/` にあり、正本ではない。

- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない
- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)
- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)

助手 8 人・服 16 着・絵 535 枚。

## みゅあ(mua)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua[__<表情>].png` | 9 | 2026-11-22 7ce3fcf07(8枚) / 2026-11-21 b17ac15e2(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/myua_<表情>.png` | 8 | 2026-11-21 8b7083819(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/myua_<表情>.PNG` | 9 | 2026-11-21 f0d5f08a9(8枚) / 2026-11-18 d09cb3dcd(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/myua_<表情>.PNG` | 9 | 2026-11-21 7a8aa6d5e(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

### 服「ハロウィン」(halloween)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua_halloween[__<表情>].png` | 9 | 2026-11-22 9ecc9bc30(8枚) / 2026-11-21 0ebaba2e1(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-halloween/myua_<表情>.png` | 8 | 2026-11-21 b5363d200(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/halloween/myua_<表情>.PNG` | 9 | 2026-11-21 2ed9ce84c(8枚) / 2026-11-18 492a7160d(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/halloween/face/myua_<表情>.PNG` | 9 | 2026-11-21 06eb0fa27(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

### 服「デュエルマスター」(card-master)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/mua_card-master[__<表情>].png` | 9 | 2026-11-22 55e71c92d(8枚) / 2026-11-21 bd547ce08(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-card-master/myua_<表情>.png` | 8 | 2026-11-21 402c536c1(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/card-master/myua_<表情>.PNG` | 9 | 2026-11-21 e6b4874ee(8枚) / 2026-11-18 dac414f04(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/card-master/face/myua_<表情>.PNG` | 9 | 2026-11-21 577ea1976(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## きき(kiki)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kiki[__<表情>].png` | 9 | 2026-11-18 f24fe446e(9枚・うち表情なし1) | `tools/art-sources/assistant-fullbody/received-v1/kiki__*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/kiki_transparent_fixed.png` | `tools/assistant/life-fullbody-art.py`。2026-11-18 に表示の大きさへ縮めた |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/kiki_<表情>.png` | 8 | 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/kiki__*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/kiki_<表情>.PNG` | 9 | 2026-11-18 d09cb3dcd(4枚・うち寝顔1) / 2026-11-18 42fb3f2ab(5枚) | `tools/art-sources/pre-resize-2026-11-17/images/assistant/kiki_*.PNG` | 正本は表示の大きさへ縮める前(2026-11-17)の物。縮めただけ |
| 顔アイコン | `monster-hero/images/assistant/face/kiki_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-09-05 #1092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

### 服「ハロウィン」(halloween)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kiki_halloween[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/kiki-halloween-8expressions-sheet*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/kiki_halloween_transparent_fixed.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-halloween/kiki_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistant-fullbody/received-v1/kiki-halloween-8expressions-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/halloween/kiki_<表情>.PNG` | 9 | 2026-11-18 492a7160d(1枚・うち寝顔1) / 2026-10-04 #2092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/halloween/face/kiki_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-10-04 #2092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

### 服「ツインテール」(twintail)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kiki_twintail[__<表情>].png` | 9 | 2026-11-21 3ed340183(9枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-twintail/kiki_<表情>.png` | 8 | 2026-11-21 0e0e0a1ca(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/twintail/kiki_<表情>.PNG` | 9 | 2026-11-21 3ec3d725a(9枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/twintail/face/kiki_<表情>.PNG` | 9 | 2026-11-21 b1c3ecb6c(9枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## ももすけ(momosuke)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/momosuke[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/momosuke-normal-sheet*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg1-pink-bunny.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/momosuke_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistant-fullbody/received-v1/momosuke-normal-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/momosuke_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-10-04 #2091(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/face/momosuke_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-10-04 #2091(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

### 服「ハロウィン」(halloween)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/momosuke_halloween[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/momosuke-halloween-sheet*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg5-pink-bunny-devil-halloween.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-halloween/momosuke_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistant-fullbody/received-v1/momosuke-halloween-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/halloween/momosuke_<表情>.PNG` | 9 | 2026-11-18 492a7160d(1枚・うち寝顔1) / 2026-10-04 #2092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/halloween/face/momosuke_<表情>.PNG` | 9 | 2026-11-12 #5492(1枚・うち寝顔1) / 2026-10-04 #2092(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | `tools/make-assistant-faces.js`(バスト絵から)で作った物。原本は別に無い |

## ドラ(dra)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | なし | 0 | | | |
| 立ち絵 | なし | 0 | | | |
| バスト絵 | `monster-hero/images/assistant/dra_<表情>.PNG` | 8 | 2026-09-17 #1468(8枚) | `tools/art-sources/assistants/dra-expressions-sheet.png` | 8表情のシートから切り出し(`tools/art-sources/assistants/README.md`) |
| 顔アイコン | `monster-hero/images/assistant/face/dra_<表情>.PNG` | 8 | 2026-09-17 #1468(8枚) | `monster-hero/images/assistant/dra_*.PNG` | `tools/make-assistant-faces.js`(バスト絵から) |

## あつ(atsu)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/atsu[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-16 #6742(8枚) | `tools/art-sources/assistant-fullbody/received-v1/atsu-8expressions-sheet.png`<br>`tools/art-sources/assistant-fullbody/received-v1/atsu_transparent_fixed.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/atsu_<表情>.png` | 8 | 2026-11-16 #6742(8枚) | `tools/art-sources/assistant-fullbody/received-v1/atsu-8expressions-sheet.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/atsu_<表情>.PNG` | 9 | 2026-11-18 42fb3f2ab(1枚・うち寝顔1) / 2026-10-22 #3286(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/face/atsu_<表情>.PNG` | 9 | 2026-11-16 #6742(8枚) / 2026-11-15 7a486a01c(1枚・うち寝顔1) | `tools/art-sources/assistant-fullbody/received-v1/atsu-8expressions-sheet.png` | `tools/assistant/face-from-fullbody.py`(原画の画素のまま・r1115-203) |

## きゅうこ(kyuko)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kyuko[__<表情>].png` | 9 | 2026-11-22 7d171f10f(9枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/kyuko_<表情>.png` | 8 | 2026-11-22 59c9a8d00(8枚) | `monster-hero/images/assistant/fullbody/kyuko__*.png` | `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/kyuko_<表情>.PNG` | 9 | 2026-11-22 5da1fb0de(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/kyuko_<表情>.PNG` | 9 | 2026-11-22 9fa32a9a6(8枚) / 2026-11-12 #5492(1枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

### 服「冬の装い」(winter)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/kyuko_winter[__<表情>].png` | 9 | 2026-11-18 f24fe446e(9枚・うち表情なし1) | `tools/art-sources/assistant-fullbody/received-v1/kyuko_winter__*.png` | `tools/assistant/life-fullbody-art.py`。2026-11-18 に表示の大きさへ縮めた |
| 立ち絵 | `monster-hero/images/assistant/stand-winter/kyuko_<表情>.png` | 8 | 2026-11-18 dbf1c9138(8枚) | `tools/art-sources/pre-resize-2026-11-17/images/assistant/stand-winter/kyuko_*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す)。正本は表示の大きさへ縮める前(2026-11-17)の物 |
| バスト絵 | `monster-hero/images/assistant/winter/kyuko_<表情>.PNG` | 9 | 2026-11-18 3d0172a97(1枚) / 2026-11-18 7f0d4898a(8枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 受け取った絵を配信の形にした物。原本は別に無い(道具で作り直さない) |
| 顔アイコン | `monster-hero/images/assistant/winter/face/kyuko_<表情>.PNG` | 9 | 2026-11-18 0f3cfbb7e(9枚・うち寝顔1) | `tools/art-sources/pre-resize-2026-11-17/images/assistant/winter/face/kyuko_*.PNG` | 正本は表示の大きさへ縮める前(2026-11-17)の物。縮めただけ |

## ソラシド(sorashido)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/sorashido[__<表情>].png` | 9 | 2026-11-23 #7292(9枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/sorashido_<表情>.png` | 8 | 2026-11-21 f90620422(8枚) | `monster-hero/images/assistant/fullbody/sorashido__*.png` | `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す)。r1119-122 で、作り直した全身絵から切り直す<br>**いま古い**: 全身絵を #7292 で作り直した。立ち絵は助手部が切り直している最中(r1119-122) |
| バスト絵 | `monster-hero/images/assistant/sorashido_<表情>.PNG` | 9 | 2026-11-21 4c8aa98d0(4枚・うち寝顔1) / 2026-11-20 ffdba7903(5枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/face/sorashido_<表情>.PNG` | 9 | 2026-11-20 633bd64be(9枚・うち寝顔1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

### 服「補正」(hosei)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/sorashido_hosei[__<表情>].png` | 9 | 2026-11-21 79035943b(7枚) / 2026-11-20 15464edad(1枚) / 2026-11-18 f24fe446e(1枚・うち表情なし1) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 立ち絵 | `monster-hero/images/assistant/stand-hosei/sorashido_<表情>.png` | 8 | 2026-11-21 4445932d0(7枚) / 2026-11-20 8f6123607(1枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| バスト絵 | `monster-hero/images/assistant/hosei/sorashido_<表情>.PNG` | 8 | 2026-11-20 3e9923f8c(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |
| 顔アイコン | `monster-hero/images/assistant/hosei/face/sorashido_<表情>.PNG` | 8 | 2026-11-20 8d71362cc(8枚) | 現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い) | 社長が完成品を直接入れた。道具で作り直さない |

## えるびん(erubin)

### ふだんの服

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/erubin[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/erubin-normal-sheet*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg7-curly-man-casual.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-normal/erubin_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistant-fullbody/received-v1/erubin-normal-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `tools/art-sources/assistants/erubin-expressions-sheet.png` | `tools/assistant/refine-assistant-cutout.py`(切り出した減色前の物は `tools/art-sources/assistants/erubin/`)→ 256色 |
| 顔アイコン | `monster-hero/images/assistant/face/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `monster-hero/images/assistant/erubin_*.PNG` | `tools/make-assistant-faces.js`(バスト絵から) |

### 服「石油王」(sekiyuou)

| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |
| --- | --- | ---: | --- | --- | --- |
| 全身絵 | `monster-hero/images/assistant/fullbody/erubin_sekiyuou[__<表情>].png` | 9 | 2026-11-18 f24fe446e(1枚・うち表情なし1) / 2026-11-15 bf5f3397a(8枚) | `tools/art-sources/assistant-fullbody/received-v1/erubin-sekiyuou-sheet*.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg8-curly-man-robe.png` | `tools/assistant/life-fullbody-art.py` |
| 立ち絵 | `monster-hero/images/assistant/stand-sekiyuou/erubin_<表情>.png` | 8 | 2026-11-15 ddf1e5a77(8枚) | `tools/art-sources/assistant-fullbody/received-v1/erubin-sekiyuou-sheet*.png` | `tools/assistant/life-fullbody-art.py` → `tools/assistant/life-stand-from-fullbody.py`(全身絵から切り出す) |
| バスト絵 | `monster-hero/images/assistant/sekiyuou/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `tools/art-sources/assistants/erubin-costume-sekiyuou-sheet.png` | `tools/assistant/refine-assistant-cutout.py … --cloth`(減色前の物は `tools/art-sources/assistants/erubin/sekiyuou/`)→ 256色 |
| 顔アイコン | `monster-hero/images/assistant/sekiyuou/face/erubin_<表情>.PNG` | 8 | 2026-11-05 #4592(8枚) | `monster-hero/images/assistant/sekiyuou/erubin_*.PNG` | `tools/make-assistant-faces.js monster-hero/images/assistant/sekiyuou` |

## 寝顔(`_sleep`)

寝顔(`<接頭辞>_sleep.PNG`)は各組の枚数に入っているが、作った日の新旧の検査からは外している。原本は `tools/art-sources/sleep-faces/`(9着ぶんのシート `received-v1.png`・ももすけ2着)で、`tools/assistant/life-sleep-faces-make.js` が切り出す。ソラシド2着・きき(ツインテール)の寝顔は社長が直接入れた完成品。縮める前(2026-11-17)の寝顔は `tools/art-sources/pre-resize-2026-11-17/images/assistant/` にある。

