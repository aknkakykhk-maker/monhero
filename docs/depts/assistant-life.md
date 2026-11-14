# 助手部ナカヨシ(助手ライフ・地図・助手どうし)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ナカヨシ / 受け持ち: 助手ライフ本体(家・部屋・時間帯・仲良し度・けんかと仲直り)・地図・助手どうしの掛け合い

## 最初に打つもの

```
node tools/ctx.js decisions assistant-life     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/56-assistant-life.jsx`
- `monster-hero/src/parts/56-assistant-life-house.jsx`
- `monster-hero/src/parts/56-assistant-life-roomview.jsx`
- `monster-hero/src/parts/56-assistant-life-rel.jsx`
- `monster-hero/src/parts/56-assistant-life-map.jsx`
- `monster-hero/src/parts/56-assistant-life-ux.jsx`
- `monster-hero/src/parts/56-assistant-life-guide.jsx`
- `monster-hero/src/parts/56-assistant-life-profile.jsx`
- `monster-hero/src/parts/56-assistant-life-partner.jsx`
- `monster-hero/src/parts/56-assistant-peer.jsx`
- `monster-hero/src/parts/44-time-of-day.jsx`
- `tools/assistant/life-*`
- `tools/assistant/peer-*`
- `monster-hero/src/parts/56-assistant-life-plan.jsx`
- `monster-hero/src/parts/56-assistant-life-body.jsx`
- `monster-hero/src/parts/56-assistant-life-finds.jsx`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`AssistantLifeScreen` / `AssistantLifeRoomSheet`

## 回す検査

- node tools/run-checks.js --changed(tools/assistant から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 通しの点検(見やすさ・やる意味。安いモデルで回せる)

新しいUIを「初めての人」「毎日来る人」× 縦・横で歩いて、画面ごとの数字と気になる所を出す道具(ゲーム本体は変えない・2分ほど)。

```
node tools/build.js && node tools/assistant/life-walkthrough.js 2>&1 | tail -30   点検(最後の1行が OK/NG)
node tools/assistant/life-walkthrough.js --shots            止め絵も撮る(docs/progress/assistant-life/walkthrough/)
node tools/assistant/life-walkthrough.js --save-baseline    直して点が下がったら、控えを新しくする
```

- 読み方: 「画面ごと」は点が大きいほど気になる所が多い。「得 a/b」= 押せる所 b個のうち何が上がるか字に出ているもの、「また来る」= 次に来る理由の言葉がある枚数。「気になる所」は大きい順
- **NG のとき**: 「NG」の付いた行(たどり着けない・エラー・画面の外・押せる所の重なり)か、控えより1割より多く悪くなった画面。自分の変更の画面なら直す。ほかの部員の画面・理由が分からないときは直さず窓口へ
- OK でも「気になる所」は残る(直すかは人が決める)。点を下げるためだけに字や札を消さない
- 画面を足したとき・目印(data-assistant-life-*)を変えたときは、道具の歩く順(step の並び)も合わせる。これは判断が要るので上のモデルで
- 改善案の一覧: [`docs/progress/assistant-life/IMPROVE-2026-11-11.md`](../../docs/progress/assistant-life/IMPROVE-2026-11-11.md)

## 関係する決まり

- 台詞は取り込みの道具(tools/assistant/*-import.js)で入れる。助手ごとの口調の見張りを通す
- 贈り物・フレンドの家・マスモンは別の担当(gift・friend・masmon)。同じファイルを触るときは先に窓口へ
- 表示の直しは縦・横・🔄横で崩れないこと(検査が見る)

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/progress/assistant-peer/STATUS.md`](../../docs/progress/assistant-peer/STATUS.md)
- [`docs/progress/assistant-peer-plan.md`](../../docs/progress/assistant-peer-plan.md)
- [`docs/progress/assistant-peer/LIFE-HOUSE-RELEASE.md`](../../docs/progress/assistant-peer/LIFE-HOUSE-RELEASE.md)

## 仕事の板・残りの仕事

- [`docs/progress/assistant-peer/STATUS.md`](../../docs/progress/assistant-peer/STATUS.md)

会話が長くなったら: `node tools/ctx.js handoff assistant-life --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
