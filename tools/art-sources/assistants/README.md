# 助手・キャラクターの表情の原本

ここには**まだゲームから読み込んでいない**表情画像を置く。配信フォルダ
(`monster-hero/images/assistant/`) に置くと、一度も読まれない絵がサイトに並ぶため
(→ 親の [`../README.md`](../README.md))、使うことが決まるまではこちら側で持つ。

## ドラ

ユーザーの知り合い「ドラ」さん本人のキャラクター。ゲーム「CREATE MONSTERS」の作者で、
モンヒロビートの「もう一つの世界へ」を作った人。ブリーダーの教え `dra`(ドラの緑膝) と
マーケットの「ドラのアイコン」で既に登場していて、その顔アイコンだけが
`monster-hero/images/breeder-icons/dra.png` にある。

| ファイル | シートでの呼び名 | 絵 |
| --- | --- | --- |
| `dra_normal.PNG`   | 通常   | 素の顔 |
| `dra_happy.PNG`    | 笑顔   | 目を閉じて口を開けた笑い＋黄色の効果線 |
| `dra_angry.PNG`    | 怒り   | つり目＋赤い怒りマーク |
| `dra_surprise.PNG` | 驚き   | 白目＋四角い口＋黄色の稲妻 |
| `dra_crying.PNG`   | 悲しみ | 涙 |
| `dra_excited.PNG`  | 照れ   | 頬の赤み |
| `dra_troubled.PNG` | 困り   | 汗 |
| `dra_wink.PNG`     | 考え中 | 「？」マーク |

- `dra-expressions-sheet.png` が受け取った原本(1536x1024・8種が1枚に並んだもの)。
  切り出しをやり直したくなったらこれを使う。1.6MBあるが**減色して軽くしない**。
  絵の周りに薄いアルファ(1〜23)の陰が広く乗っていて、256色へ落とすとそこが崩れる
  (実測で見える画素の75%が変化した)。配信しないので通信量には効かない
- 切り出した8枚は **384x384・背景透過**。顔(肌色)の中心を全枚で同じ位置にそろえてあるので、
  表情を入れ替えても顔が動かない

### 名前が2つある表情について

助手の表情スロットは `ASSISTANT_EXPRESSIONS`
(`normal` / `happy` / `wink` / `surprise` / `troubled` / `angry` / `crying` / `excited`) の8つで固定で、
画面側は `e:'wink'` のようにこの名前で表情を選ぶ。ドラのシートは8種の構成が助手と同じだが、
**「照れ」と「考え中」だけは対応する名前が無い**ため、残った2枠へ次のように割り当てた。

- 「考え中」→ `wink`: `wink` のセリフが「何から始める？」のような**問いかけ**で使われているため
- 「照れ」→ `excited`: 残る1枠。`excited` は「わくわく」で使われているので、
  照れ顔を出すと少しずれる。ドラのセリフを書くときは、この枠を**照れる場面**で使うとよい

**まだどこからも読んでいないので、入れ替えは自由**(ファイル名を変えるだけ)。

## 使うときの手順

1. 8枚を配信フォルダへ写す
   `cp tools/art-sources/assistants/dra_*.PNG monster-hero/images/assistant/`
2. 助手として出すなら `monster-hero/data/assistants.js` の `ASSISTANTS` へ1件足す
   (`imageDir:'images/assistant'` / `imagePrefix:'dra'`)。イベントの会話だけで使うなら
   `ASSISTANTS` へは足さず、パスを直接指すのではなく置き場所を1か所にまとめてから参照する
3. 吹き出し用の顔アイコンを作る
   `node tools/make-assistant-faces.js` → `node tools/assistant-face-check.js`
   ドラは**顔だけの絵**で、みゅあ・ききの全身絵とは構図が違う。ももすけ(512x512のバストアップ)と
   同じ事情なので、`make-assistant-faces.js` の `PER_ASSISTANT` へ `dra` の
   `headRatio` / `headTopSkip` を足して、占有が他とそろうように合わせること
4. 写したあとは原本をここから消す(親の README の「同じ中身を2か所で持たない」)。
   `dra-expressions-sheet.png` は切り出し前の原本なので残してよい

## みゅあの MASTER の服(`mua-card-master/`・2026-10-27)

社長が用意した、MFバトルカードでみゅあの MASTER に勝つと買えるようになる服の原本(1086×1448・背景透け)。
配信用は `monster-hero/images/assistant/card-master/`(立ち絵 768×1024・減色PNG)と、その `face/`
(`node tools/make-assistant-faces.js monster-hero/images/assistant/card-master` で作る。切り出し方は同ツールの `COSTUME_DIR_TUNE`)。

| 原本 | しぐさ | 表情の名前 |
| --- | --- | --- |
| `myua_new_costume_01.png` | ほほえむ | normal |
| `myua_new_costume_02.png` | 手を差し出して笑う | happy |
| `myua_new_costume_03.png` | ウインクで指さし | wink |
| `myua_new_costume_04.png` | 驚く | surprise |
| `myua_new_costume_05.png` | 照れて両手を口元に | troubled |
| `myua_new_costume_06.png` | 腰に手をあてて怒る | angry |
| `myua_new_costume_07.png` | もじもじ(涙をぬぐう) | crying |
| `myua_new_costume_08.png` | 指さして笑う | excited |
## ソラシド(2026-10-27)

7人目の助手。`sorashido-faces-sheet.png` が受け取った原本(1448x1086・背景透過・8表情が4列×2段)。
切り出しをやり直したくなったらこれを使う。配信しないので減色しない。

- 切り出した8枚(`monster-hero/images/assistant/sorashido_<表情>.PNG`)は、きゅうこと同じ **384x512・背景透過**
- 段ごとに透けた隙間から枠を決めた(下の段の2枚目と3枚目だけ x=720 付近で接しているので、そこで分けた)
- 8枚とも、髪の上端をそろえ、そこから8枚に共通の長さ(いちばん短い絵の 454px)で下を切って、枠の高さいっぱいに広げた
  (倍率 1.128)。はみ出た左右は真ん中から切る(4〜21px)。表情を入れ替えても頭が動かない
- 表情の当て方: 上の段 左から normal(目を閉じてほほえむ)・happy(大笑い)・troubled(汗をかいて照れ笑い)・excited(頭をかいて歯を見せて笑う)/
  下の段 左から angry(腕を組んでむくれる)・surprise(驚き慌てる)・wink(指をさしてにっこり)・crying(大泣き)
