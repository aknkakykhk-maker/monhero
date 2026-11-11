# 助手の立ち絵・顔の見直し(2026-11-11 社長「助手の立ち絵も見直して、使う場面全部でうまく表示させるようにして」)

担当: 助手部ナカヨシ15。直す前の止め絵・問題の大きい順の表と、直したあとの止め絵。

- **前後の見比べ(1枚): [`compare.jpg`](compare.jpg)**
- 直したあと(変わった場面だけ): `after/`(モードえらび・地図・場面・アルバム・カードの相手えらび/VS・着替えのモードえらび)

- 表: [`before/00-table.png`](before/00-table.png)
- 場面ごとの止め絵(8人 × 縦 390×844・横 844×390・横小 568×320。🔄横はモンヒロビートの中だけで効くので「モードえらび」だけ): `before/01-home.jpg` 〜 `before/11-cardtutor.jpg`
- 着替え(ハロウィン3着・石油王): `before/outfit-a-*.jpg`
- 丸い顔の絵(全員 × 8表情 + 着替え): `before/20-faces.jpg` / 立ち絵そのもの: `before/21-art.jpg`

## 直した所(共通の所に寄せた)

顔の点の表(頭のてっぺん・目・顎・顔の大きさ)を1つ持ち、どの場面もそこから置く。表は `56-assistant-life-house.jsx` の
`ASSISTANT_LIFE_STAND_FACE`(ふだんの服の8人)と、今回足した `ASSISTANT_LIFE_STAND_FACE_OUTFIT`(着替え5着)。引くのは `assistantLifeStandFace(pid, src)`、置くのは `assistantLifeStandRule(...)`。

| 場面 | 前 | あと |
| --- | --- | --- |
| 思い出アルバムのツーショット(`AssistantPeerPhoto`) | 絵を枠の 56%×170% に object-cover。顔が重なる・横が最大33%切れる・ドラは下が切れる | 表から、2人の顔を同じ大きさ・同じ高さで左右に並べる |
| 地図の小さな全身(`AssistantLifeMapFig`) | 見えている体の高さでそろえる。顔の大きさの差 2.8倍 | 顔でそろえる(差なし) |
| 助手ライフの場面・部屋の着替え | 着替えの絵にも ふだんの服の点を当てていた | 着替えの行を引く(帽子・大きな耳は `above` で上まで見せる) |
| モードえらび(`RHYTHM_MODE_ASSISTANT_FRAMES`) | ももすけ: 古い絵向けの 1.5倍・表情ごとの横ずらしが残り、耳が切れ・横は顔だけの大写し。ソラシド・えるびん・着替え: 横で頭が切れる | ももすけの行をいまの絵に合わせた。縦長の絵は、あふれる分を下へ逃がす。あつ・きゅうこ・ドラ(社長が決めた寄せ方)はそのまま |
| カードの相手えらび・VS・結果(`CardAssistantArt`) | 描かれている範囲いっぱい。顔の大きさの差 1.7〜2.8倍 | 表から顔の大きさをそろえる(羽・肩は枠の外へ出てよい)。VS も同じ部品。顔だけの絵のドラは今までどおり |
| カードの VS(横小 568×320) | ひとことが長いと相手の欄が画面より高くなり、名前の字が上で切れる | 背の低い横画面だけ、絵と字を少し小さくする |

変えなかった所: 丸い顔の絵の切り方(きゅうこ「頭ぜんぶ」・あつ・ソラシド・カードマスターは、社長が見本から選んだ値)。HOME の施設の下の顔(横小で 13px・仕様)。

## 着替えを足すとき

1. 絵を `images/assistant/<服の名前>/` に置く(今までどおり)
2. `ASSISTANT_LIFE_STAND_FACE_OUTFIT` に `<服の名前>: { <助手id>: { top, eye, chin, m } }` を足す(うれしい顔の絵で、見えている体の上を0・下を1。`m` は ふだんの服の m ×「目から顎」の長さの比)
3. `node tools/assistant/assistant-art-scenes-check.js --outfit a`(道具の `OUTFITS` に服を足す)で、全場面を確かめる

## 道具

```
node tools/assistant/assistant-art-scenes-check.js                     全場面 × 全員 × 4つの画面の大きさ。最後の1行に OK / NG
node tools/assistant/assistant-art-scenes-check.js --shots <フォルダ>  止め絵も撮る
  --views tate,yoko,small,rot / --only home,rhythm,house,map,room,scene,album,card / --who mua,kiki / --outfit a|b / --all
```

画面に出ている助手の絵(img)を全部拾い、伸び・ぼやけ・切れ(上/左右/足元)・小さすぎ・助手ごとの顔の大きさのばらつき・寝顔のずれを数字で見る。
場面の作りを知らなくても測れるので、場面を足すときは「開き方」を1つ足すだけ。

## 分かったこと(道具の作りに関わる所)

- 🔄横(端末は縦のまま器を回す)は**モンヒロビートの中だけ**で効き、HOME へ戻ると解ける(`releaseScreenOrientation`)。助手ライフ・カードには🔄横の状態が無い
- 寝姿は立ち絵を傾けて頭だけ切り出す作りなので、切れ・ばらつきは見ない(伸びだけ見る)
- 顔の絵は `AssistantFace`(正方形・object-cover)の1か所を通るので、場面ごとの差は大きさだけ
