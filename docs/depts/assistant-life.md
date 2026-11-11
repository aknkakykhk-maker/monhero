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
- `monster-hero/src/parts/56-assistant-peer.jsx`
- `monster-hero/src/parts/44-time-of-day.jsx`
- `tools/assistant/life-*`
- `tools/assistant/peer-*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`AssistantLifeScreen` / `AssistantLifeRoomSheet`

## 回す検査

- node tools/run-checks.js --changed(tools/assistant から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

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
