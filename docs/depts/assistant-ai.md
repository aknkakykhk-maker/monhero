# 助手部ココロ(助手の AI・おしゃべり)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ココロ / 受け持ち: 助手の人柄と台詞の土台・おしゃべり・ミッションのひとこと・Edge Function assistant-chat(中継役)

## 最初に打つもの

```
node tools/ctx.js decisions assistant-ai     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/21-assistant.jsx`
- `monster-hero/src/parts/52-mission-daily-line.jsx`
- `monster-hero/src/parts/56-assistant-chat.jsx`
- `monster-hero/data/assistants.js`(2.0MB・開かない)
- `monster-hero/data/assistant-chat-digest.json`(0.5MB・開かない)
- `supabase/functions/assistant-chat/*`
- `supabase/functions/mission-daily-line/*`
- `tools/assistant/assistant-chat-*`
- `tools/assistant/edge-*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`handleRequest` / `loadDigest` / `normalizeAssistantChatMemo` / `assistantChatSendWindow`

## 回す検査

- node tools/assistant/assistant-chat-check.js --unit(中継役を触ったとき)
- node tools/assistant/edge-serve-check.js(serve.js を触ったとき)
- node tools/run-checks.js --changed
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 助手の一人称と性格のくせは消さない(台帳「中身の決めごと」)
- 会話の本文はログに書かない。API キーは Secrets だけ(チャット・リポジトリに貼らない)
- 中継役(core.js・serve.js)を変えて main に入れたら、窓口へ「assistant-chat の配り直し」を頼む
- D/assistants.js(大きい)は開かず、node tools/ctx.js read で切り出す

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/ASSISTANT_CHAT.md`](../../docs/spec/ASSISTANT_CHAT.md)
- [`docs/rules/EDGE_REDEPLOY.md`](../../docs/rules/EDGE_REDEPLOY.md)
- [`docs/rules/ASSISTANT_ADD.md`](../../docs/rules/ASSISTANT_ADD.md)
- [`docs/rules/CALL_NAMES.md`](../../docs/rules/CALL_NAMES.md)
- [`docs/spec/ASSISTANT_MUA_VOICE.md`](../../docs/spec/ASSISTANT_MUA_VOICE.md)

会話が長くなったら: `node tools/ctx.js handoff assistant-ai --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
