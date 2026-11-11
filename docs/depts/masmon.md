# 助手部キズナ(育つ助手・助手のマスモン・提案)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: キズナ / 受け持ち: 助手のマスモン(名前・染め方・育て方)・育つ助手・「助手に提案する」

## 最初に打つもの

```
node tools/ctx.js decisions masmon     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/56-assistant-life-masmon.jsx`
- `monster-hero/src/parts/56-assistant-life-masmon-*.jsx`
- `monster-hero/src/parts/56-assistant-masmon-battle-view.jsx`
- `monster-hero/src/parts/56-assistant-masmon-battle-beta.jsx`
- `monster-hero/data/assistant-masmon-battle.js`
- `monster-hero/data/assistant-masmon-techs.js`
- `tools/assistant/assistant-masmon-*`
- `tools/masmon-battle/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`AssistantMasmonSheet` / `AssistantMasmonAskSheet`

## 回す検査

- node tools/run-checks.js --changed(tools/assistant から選ばれる)
- node tools/assistant/assistant-chat-check.js --unit(中継役の masmon_names・masmon_suggest を触ったとき)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 名前付け・提案は中継役(assistant-chat)を通る。core.js を変えて main に入れたら、窓口へ配り直しを頼む
- プレイヤーが選んだ色は季節で上書きしない・前に戻せること(台帳 2026-11-08)
- 1日の回数の上限は台帳の値(社長の決定)。変えるときは先に窓口へ

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/ASSISTANT_CHAT.md`](../../docs/spec/ASSISTANT_CHAT.md)
- [`docs/progress/assistant-peer/STATUS.md`](../../docs/progress/assistant-peer/STATUS.md)

会話が長くなったら: `node tools/ctx.js handoff masmon --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
