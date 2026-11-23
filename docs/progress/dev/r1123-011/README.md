# 助手の絵の最新版と旧版の見分け(r1123-011・台帳 r1119-124・r1119-128)

## C の段(2026-11-23・移した)

社長の答え「移すけど目録はキャラごと」(r1119-128)で、次のとおりにした。**ゲームが読む絵(`monster-hero/images`)は1枚も動かしていない。消した絵も無い。**

| したこと | 場所 |
| --- | --- |
| 旧版 38 枚(52.6MB)を保管庫へ `git mv` | `archive/old-art/assistant/<キャラ>/<服>/<日付>-old-<何の版>/`(表は `archive/old-art/README.md`) |
| いまも正本の原本 105 枚を、キャラごとのフォルダへ並べ直し | `tools/art-sources/assistants/<キャラ>/<服>/`(寝顔のシートだけ `_shared/sleep-faces/`) |
| キャラごとの目録(道具が書く) | `tools/art-sources/assistants/<キャラ>/CATALOG.md`(8 人ぶん) |
| 道具が旧版から絵を作らないようにした | `tools/assistant/art_source.py`(原本の場所を引く・正本が「現行そのもの」の組は断る)。`life-fullbody-art.py`・`life-expression-sheets.py`・`sorashido-umahone-busts.py` が使う |
| 検査をつないだ | `tools/image/assistant-art-catalog-check.js`(`run-checks.js --changed` が、助手の絵・原本・保管庫・絵を作る道具を触ったときに選ぶ) |
| 要確認の一覧(道具が書く) | [`confirm.md`](confirm.md) |

回し方: `node tools/image/assistant-art-catalog.js`(目録を書き直す)/ `--check` / `--why <語>` / `--all`

以下は A の段(調べて案を作った時点)の記録。

---

## A の段(調べて案を作る)の記録

**このPRでは画像を1枚も動かしていない・消していない。** 社長が下の案を OK してから移す(C の段)。

| 物 | 場所 |
| --- | --- |
| 目録の下書き・移す一覧 | C の段で、キャラごとの `CATALOG.md` と `archive/old-art/README.md` に置き換えた |
| 道具 | `node tools/image/assistant-art-catalog.js`(`--check` 検査 / `--why <語>` その絵は正本か旧版か / `--all` / `--selftest`) |
| 目録の元(人が書く) | `tools/image/assistant-art-catalog.json` |
| 絵ごとの「最後に変えたコミット」の控え(道具が書く) | `tools/image/assistant-art-ledger.json` |

## 分かったこと

1. **取り違えの元は「道具が旧版を正本だと思っている」こと。** 2026-11-18 以降、みゅあ3着・きゅうこ(ふだん)・ソラシド2着・
   きき(ツインテール)は、作り直した完成品が `monster-hero/images/assistant` へ直接入っている(原本はリポジトリに無い)。
   ところが `tools/art-sources/assistant-fullbody/received-v1/` には作り直す前の原本が残り、助手部の道具
   (`life-fullbody-art.py`・`life-expression-sheets.py`・`sorashido-umahone-busts.py`)はいまもそれを元に同じ名前の絵を書き出せる。
   引数なしで回すと、現行の絵が旧版で上書きされる。
2. 配信フォルダの中に旧版は混ざっていない(組に分けられない絵 0 枚)。ただし「表情なしの全身絵」4 枚(みゅあ3着・ソラシド補正)は
   表情つきより1世代古い(8表情がそろっているので画面には出ない)。
3. `docs/progress` の助手に関わる画像(約 2,460 枚・約 560MB)は画面の撮影と比べ絵で、現行と同じ名前の付け方の絵は 0 枚。動かさない案。
4. 62 組のうち、正本が「現行のファイルそのもの」35 組・原本あり 27 組。旧版の候補は 38 枚・52.6MB(10 組)。

## 目録の置き場所の案

- **推す案: `docs/art/ASSISTANT_ART.md` の1枚**(道具が書く)。元は `tools/image/assistant-art-catalog.json`。
  原本は `assistant-fullbody/received-v1/`・`assistants/`・`pre-resize-2026-11-17/`・`sleep-faces/` に分かれていて、
  キャラごとのフォルダになっていないので、キャラごとの `CATALOG.md` にすると置き場が決まらない。1枚なら「絵を触る前にここを見る」で済む。
  `tools/art-sources/assistants/README.md`・`monster-hero/images/CLAUDE.md` から1行で指す。
- 別の案: `tools/art-sources/assistants/<キャラ>/CATALOG.md`(原本をキャラごとのフォルダへ並べ直すのと組。道具3本の道筋の直しが要る)。

## 保管庫の形の案

`archive/old-art/assistant/<キャラ>/<服>/<その版が入った日>-old-<何の版>/`(例 `archive/old-art/assistant/mua/normal/2026-11-11-old-fullbody-received-v1/`)。
`archive/old-art/README.md` に「ここは旧版。正本ではない。正本は目録を見る」と、移した物の表(道具が書く)を置く。

## C の段でやること(OK のあと)

1. 助手部の切り出し直し(r1119-122)の PR が入ったかを確かめる(入っていれば `knownStale` を外す)
2. 助手部の道具から、旧版を元にした組を外す(または目録で正本が「現行そのもの」の組は道具が断るようにする)— 助手部の受け持ちなので窓口経由
3. `git mv` で移す → README(`art-sources`・`pre-resize`・`assistants`)の道筋を直す → 目録の書き先を決まった場所へ
4. `--check` を `tools/run-checks.js` へつなぐ(絵を替えたのに目録を作り直していない・正本が無い・現行が正本より古い、で落ちる)
5. build・image-asset-check・unused-images・撮り比べ
