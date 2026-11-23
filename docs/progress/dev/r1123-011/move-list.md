# 旧版・予備の絵を保管庫へ移す一覧(r1123-011・案)

<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json の moves) -->

**まだ何も移していない・消していない。** 社長が OK したあとに `git mv` で移す。ゲームが読む絵(`monster-hero/images`)は1枚も動かさない。

合計 38 枚・52.6MB(10 組)

| 元の場所 | 枚数 | 容量 | 行き先(保管庫) | 旧版とする理由 | 移す前に直す道具 |
| --- | ---: | ---: | --- | --- | --- |
| `tools/art-sources/assistant-fullbody/received-v1/mua-normal-8expressions-sheet.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg2-blonde-angel.png` | 2 | 4.7MB | `archive/old-art/assistant/mua/normal/2026-11-11-old-fullbody-received-v1/` | みゅあ(ふだん)の全身絵・立ち絵は 2026-11-21〜22 に作り直した完成品へ差し替え済み。この受け取り第1版から道具を回すと、作り直す前の絵に戻る | `tools/assistant/life-fullbody-art.py`<br>`tools/assistant/life-expression-sheets.py` |
| `tools/art-sources/assistant-fullbody/received-v1/mua-halloween-8expressions-sheet.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg3-blonde-halloween-witch.png` | 2 | 4.9MB | `archive/old-art/assistant/mua/halloween/2026-11-11-old-fullbody-received-v1/` | みゅあ(ハロウィン)。同上(2026-11-21〜22 に差し替え済み) | `tools/assistant/life-fullbody-art.py`<br>`tools/assistant/life-expression-sheets.py` |
| `tools/art-sources/assistant-fullbody/received-v1/mua-cardmaster-8expressions-sheet.png`<br>`tools/art-sources/assistant-fullbody/received-v1/msg4-blonde-blue-cape.png` | 2 | 4.4MB | `archive/old-art/assistant/mua/card-master/2026-11-11-old-fullbody-received-v1/` | みゅあ(デュエルマスター)。同上(2026-11-21〜22 に差し替え済み) | `tools/assistant/life-fullbody-art.py`<br>`tools/assistant/life-expression-sheets.py` |
| `tools/art-sources/assistants/mua-card-master` | 8 | 19.3MB | `archive/old-art/assistant/mua/card-master/2026-10-27-old-bust-received/` | みゅあ(デュエルマスター)のバスト絵の最初の原本(2026-10-27)。バスト絵・顔は 2026-11-21 に作り直した物へ差し替え済み | `tools/art-sources/assistants/README.md` |
| `tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_angry.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_crying.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_excited.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_happy.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_normal.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_surprise.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_troubled.PNG`<br>`tools/art-sources/pre-resize-2026-11-17/images/assistant/myua_wink.PNG` | 8 | 3.1MB | `archive/old-art/assistant/mua/normal/2026-11-17-old-bust-pre-resize/` | みゅあ(ふだん)のバスト絵の、縮める前(2026-11-17)の版。バスト絵は 2026-11-21 に作り直した物へ差し替え済みなので、もう現行の原本ではない | `tools/art-sources/pre-resize-2026-11-17/README.md` |
| `tools/art-sources/assistant-fullbody/received-v1/kyuko-8expressions-sheet.png`<br>`tools/art-sources/assistant-fullbody/received-v1/kyuuko_transparent_fixed.png` | 2 | 3.3MB | `archive/old-art/assistant/kyuko/normal/2026-11-12-old-fullbody-received-v1/` | きゅうこ(ふだん)の全身絵は 2026-11-22 に作り直した完成品へ差し替え済み(立ち絵もそこから切り直した) | `tools/assistant/life-fullbody-art.py` |
| `tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-sheet1.png`<br>`tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-sheet2.png`<br>`tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-sleep.png` | 3 | 4.4MB | `archive/old-art/assistant/sorashido/normal/2026-11-14-old-fullbody-received-v1/` | ソラシド(ふだん=馬骨)の全身絵は #7292(2026-11-23)で作り直した完成品へ差し替え済み。寝顔も 2026-11-21 に直接入れた物が現行 | `tools/assistant/life-fullbody-art.py`<br>`tools/assistant/sorashido-umahone-busts.py` |
| `tools/art-sources/assistant-fullbody/received-v1/sorashido-8expressions-sheet1.png`<br>`tools/art-sources/assistant-fullbody/received-v1/sorashido-8expressions-sheet2.png` | 2 | 4.8MB | `archive/old-art/assistant/sorashido/hosei/2026-11-12-old-fullbody-received-v1/` | ソラシド(補正)の全身絵8表情は 2026-11-20〜21 に直接入れた完成品へ差し替え済み | `tools/assistant/life-fullbody-art.py` |
| `tools/art-sources/assistants/sorashido-faces-sheet.png` | 1 | 3.4MB | `archive/old-art/assistant/sorashido/hosei/2026-10-27-old-bust-sheet/` | ソラシドの最初のバスト絵8表情のシート(2026-10-27)。バスト絵・顔は、ふだん・補正とも 2026-11-20〜21 に直接入れた物へ差し替え済み | `tools/art-sources/assistants/README.md` |
| `tools/art-sources/assistants/dra_angry.PNG`<br>`tools/art-sources/assistants/dra_crying.PNG`<br>`tools/art-sources/assistants/dra_excited.PNG`<br>`tools/art-sources/assistants/dra_happy.PNG`<br>`tools/art-sources/assistants/dra_normal.PNG`<br>`tools/art-sources/assistants/dra_surprise.PNG`<br>`tools/art-sources/assistants/dra_troubled.PNG`<br>`tools/art-sources/assistants/dra_wink.PNG` | 8 | 0.2MB | `archive/old-art/assistant/dra/normal/2026-09-17-duplicate-of-current-bust/` | 旧版ではなく重複。配信中のバスト絵と1バイトも違わない同じ物が2か所にある(「同じ中身を2か所で持たない」決まり)。原本のシート dra-expressions-sheet.png は正本として残す | `tools/art-sources/assistants/README.md` |

## 要確認(13 件)

- [直している最中] sorashido/normal/stand の現行の絵(2026-11-21)が、正本(2026-11-23 monster-hero/images/assistant/fullbody/sorashido__angry.png)より古い。正本から作り直す — 全身絵を #7292 で作り直した。立ち絵は助手部が切り直している最中(r1119-122)
- mua/card-master/stand: 全身絵(2026-11-22)のほうが立ち絵(2026-11-21)より新しい。立ち絵は作り直した全身絵と同じ絵か
- mua/halloween/stand: 全身絵(2026-11-22)のほうが立ち絵(2026-11-21)より新しい。立ち絵は作り直した全身絵と同じ絵か
- mua/normal/stand: 全身絵(2026-11-22)のほうが立ち絵(2026-11-21)より新しい。立ち絵は作り直した全身絵と同じ絵か
- mua/normal/fullbody: 表情なしの全身絵(mua.png・2026-11-21)が、表情つき(2026-11-22)より古い世代のまま現行フォルダにある
- mua/card-master/fullbody: 表情なしの全身絵(mua_card-master.png・2026-11-21)が、表情つき(2026-11-22)より古い世代のまま現行フォルダにある
- mua/halloween/fullbody: 表情なしの全身絵(mua_halloween.png・2026-11-21)が、表情つき(2026-11-22)より古い世代のまま現行フォルダにある
- sorashido/hosei/fullbody: 表情なしの全身絵(sorashido_hosei.png・2026-11-18)が、表情つき(2026-11-20)より古い世代のまま現行フォルダにある
- 正本が「現行のファイルそのもの」の組が多い(みゅあ3着・きゅうこ(ふだん)・ソラシド2着・きき(ツインテール)の全身絵/立ち絵/バスト絵/顔)。2026-11-18 以降に完成品を直接入れた物で、切り出す前の原本(大きい絵・レイヤー)はリポジトリに無い。原本が社長の手元にあるなら tools/art-sources/assistant-fullbody/<キャラ>-<服>-<日付>/ へ置いてもらえると、目録の正本をそちらに替えられる
- tools/art-sources/assistant-fullbody/received-v1/msg6-kimono-boy.png: ソラシド(補正)の表情なしの全身絵(sorashido_hosei.png)だけが、まだこの受け取り第1版から作った物。表情なしの絵を現行の normal と同じ絵に替える(#7292 がソラシドふだんでした形)なら、これも旧版へ移せる。いまは残す側
- 助手部の道具(life-fullbody-art.py・life-expression-sheets.py・sorashido-umahone-busts.py)は、旧版の候補を元にした組(みゅあ3着・きゅうこ・ソラシド2着)もまだ作れる。引数なしで回すと、作り直した現行の絵が旧版で上書きされる。移すのと同時に、その組を道具から外す(目録で正本が「現行そのもの」の組は道具が断る)必要がある=助手部の受け持ち
- フォルダの名前 received-v1 には、いまも正本の物(きき・ももすけ・あつ・えるびん・きゅうこ冬 34 枚)が残る。旧版を移したあとなら名前はそのままでよい(道具 3 本がこの道筋を読んでいるので、変えるなら助手部と合わせる)
- docs/progress の助手に関わる画像(約 2,460 枚・約 560MB)は、画面の撮影と比べ絵(作業の記録)で、現行と同じ名前の付け方をした絵は 0 枚。取り違えの元にはならないので動かさない案

## 検査で落ちている物(0 件)

なし
