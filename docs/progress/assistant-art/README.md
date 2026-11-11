# 助手の立ち絵・顔の見直し(2026-11-11 社長「助手の立ち絵も見直して、使う場面全部でうまく表示させるようにして」)

担当: 助手部ナカヨシ15。直す前の止め絵と、問題の大きい順の表。

- 表: [`before/00-table.png`](before/00-table.png)
- 場面ごとの止め絵(8人 × 縦 390×844・横 844×390・横小 568×320。🔄横はモンヒロビートの中だけで効くので「モードえらび」だけ): `before/01-home.jpg` 〜 `before/11-cardtutor.jpg`
- 着替え(ハロウィン3着・石油王=a、カードマスター=b): `before/outfit-*.jpg`
- 丸い顔の絵(全員 × 8表情 + 着替え): `before/20-faces.jpg` / 立ち絵そのもの: `before/21-art.jpg`

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
