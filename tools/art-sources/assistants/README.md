# 助手・キャラクターの絵の原本(キャラごと)

2026-11-23 に並べ直した(社長「目録はキャラごと」・台帳 r1119-124・r1119-128)。

```
tools/art-sources/assistants/
  <キャラ>/CATALOG.md            そのキャラの目録(正本はどれ・ゲームはどれを使っているか・いつどの PR で作ったか・作り方)。道具が書く
  <キャラ>/<服>/fullbody/        全身絵の原本(服は normal・halloween・card-master・twintail・winter・hosei・sekiyuou)
  <キャラ>/<服>/bust/            バスト絵の原本(8表情のシート)。cut/ は切り出した減色前の物
  <キャラ>/<服>/pre-resize-2026-11-17/  表示の大きさへ縮める前の物(bust・face・stand)
  _shared/sleep-faces/           寝顔の原本(1枚に7人のシートなのでキャラに分けられない)
```

- **絵を作り直す・差し替える前に、そのキャラの `CATALOG.md` で正本を確かめる。** 正本が「現行のファイルそのもの」の組は、
  ゲームの絵(`monster-hero/images/assistant/`)が完成品で、道具で作り直さない(道具 `tools/assistant/art_source.py` が断る)
- **ここに旧版は置かない。** 作り直して要らなくなった原本は保管庫 `archive/old-art/assistant/<キャラ>/<服>/<日付>-old-<何の版>/` へ
  `git mv` し、`tools/image/assistant-art-catalog.json` の `moved` に1行足す
- 絵や原本を替えたら `node tools/image/assistant-art-catalog.js`(目録を書き直す)。検査は `--check`、その絵が正本か旧版かは `--why <語>`
- 新しい原本を受け取ったら `<キャラ>/<服>/` へ置き、`assistant-art-catalog.json` の `groups` の `master` に書く

## クリスマスの服の拡大版(2026-11-28 r1126-095)

社長「助手画像が全部荒い」→「クリスマスで出したやつは原本全部あるはずだから直して」。受け取った原本(`<キャラ>/santa/received/`・
`kyuko/winter/fullbody/`)は高さ 1500〜3200px ほどで、iPhone(倍率3)のモンヒロバトルの入口などで足りなかった。

- `<キャラ>/santa/upscaled-2026-11-28/received/<原本の名前>_x2.webp` … 原本を拡大の道具(`tools/image/upscale-anime/upscale.py`・Real-ESRGAN のアニメ用。
  線や色は描き変えない)で4倍にして2倍へ縮めた物(PNG だと1枚 3.5MB になるので、中間の置き場は WebP 画質95)。きゅうこの冬服は `kyuko/winter/upscaled-2026-11-28/fullbody/`
- ゲームの絵はここから `python3 tools/assistant/life-xmas-art-remake.py` で作る(全身 → 半身の置き場 → 立ち絵・顔アイコン)。全身・半身・立ち絵は WebP 画質90
  (`tools/assistant/art_webp.py`。ゲーム側は `assistantArtFile`)。ドラ(顔だけの絵)は原本が 1254px あるので拡大せず `tools/assistant/life-dra-santa-art.py`
- 受け取った原本(received)は加工せずにそのまま残す

以下は、原本ごとの切り出し方の控え(道筋は 2026-11-23 の並べ直しに合わせてある)。

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

- `dra/normal/bust/dra-expressions-sheet.png` が受け取った原本(1536x1024・8種が1枚に並んだもの)。
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
   (2026-09-17 に配信へ写した。同じ中身の控え 8 枚は 2026-11-23 に保管庫 `archive/old-art/assistant/dra/normal/` へ移した)
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

## みゅあの MASTER の服(2026-10-27 の原本は旧版 → `archive/old-art/assistant/mua/card-master/2026-10-27-old-bust-received/`)

**バスト絵・顔は 2026-11-21 に作り直した完成品へ差し替え済み。下は最初の版の控え。**

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

7人目の助手。**バスト絵・顔は 2026-11-20〜21 に直接入れた完成品へ差し替え済みで、下のシートは旧版**(`archive/old-art/assistant/sorashido/hosei/2026-10-27-old-bust-sheet/`)。`sorashido-faces-sheet.png` が最初に受け取った原本(1448x1086・背景透過・8表情が4列×2段)。
切り出しをやり直したくなったらこれを使う。配信しないので減色しない。

- 切り出した8枚(`monster-hero/images/assistant/sorashido_<表情>.PNG`)は、きゅうこと同じ **384x512・背景透過**
- 段ごとに透けた隙間から枠を決めた(下の段の2枚目と3枚目だけ x=720 付近で接しているので、そこで分けた)
- 8枚とも、髪の上端をそろえ、そこから8枚に共通の長さ(いちばん短い絵の 454px)で下を切って、枠の高さいっぱいに広げた
  (倍率 1.128)。はみ出た左右は真ん中から切る(4〜21px)。表情を入れ替えても頭が動かない
- 表情の当て方: 上の段 左から normal(目を閉じてほほえむ)・happy(大笑い)・troubled(汗をかいて照れ笑い)・excited(頭をかいて歯を見せて笑う)/
  下の段 左から angry(腕を組んでむくれる)・surprise(驚き慌てる)・wink(指をさしてにっこり)・crying(大泣き)

## えるびん(2026-11-05・公開前)

8人目の助手。`erubin/normal/bust/erubin-expressions-sheet.png`(通常衣装)・`erubin/sekiyuou/bust/erubin-costume-sekiyuou-sheet.png`(衣装『石油王』)が受け取った原本
(どちらも 1536x1024・4列×2段・1マス 384x512・背景はクリーム色で塗られている)。

- 切り分けた絵は `erubin/normal/bust/cut/`(通常)・`erubin/sekiyuou/bust/cut/`(石油王)。**384x512・背景透過**。顔アイコンは各 `face/`(256px)
- 公開が決まるまで配信フォルダへは写さない(このフォルダの決まりどおり)。写すときは通常を `monster-hero/images/assistant/`、
  石油王を `monster-hero/images/assistant/sekiyuou/` へ
- 切り方: `python3 tools/assistant/cut-assistant-sheet.py <シート> <出力> erubin normal,happy,surprise,troubled,crying,excited,angry,wink [--pockets]`
  (通常衣装だけ `--pockets`。石油王の白い頭布は背景とほぼ同じ色なので、囲まれた所まで抜くと頭布が消える)
- **2026-11-05 仕上げ直し(社長「透過の雑さが目立つ」)**: いまの16枚は `python3 tools/assistant/refine-assistant-cutout.py <シート> <出力> erubin normal,happy,surprise,troubled,crying,excited,angry,wink`
  で作ったもの(石油王は最後に `--cloth` を付ける。外側の輪郭が布と輪だけなので、縁を形からなめらかにし、輪にくっついた細い線を消す)。くせ毛のすき間と髪のまわりの白いふち取りを抜き、毛先は半透明のまま背景の色かぶりを引き、白い頭布の縁はなめらかに、肩はマスの端でなじませる。
  配信へ写すときは 256色・ディザあり(`compress-images.js` と同じ `sharp` の `palette:true, colors:256, dither:1.0`)にし、`node tools/make-assistant-faces.js`(石油王は `… monster-hero/images/assistant/sekiyuou`)で顔アイコンを作り直す
- ただし `erubin_normal.PNG`(通常・石油王。お話の大きい立ち絵)の2枚は、ツナグの `tools/assistant/rematte-assistant-art.py` の版(縁をなめらかに・毛先は半透明・頭布の輪郭線は残す)(2026-11-05 社長「透過の雑さが目立つ」。石油王は `--cloth`)。
  配信用はディザ付き256色(imagequant)
- 表情の当て方・お話の骨組み: [`docs/progress/tempo-2026-11-05/erubin-prep.md`](../../../docs/progress/tempo-2026-11-05/erubin-prep.md)
