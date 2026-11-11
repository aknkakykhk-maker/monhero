# 助手部オトズレ(フレンドの家・フレンド)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: オトズレ / 受け持ち: フレンドの家(助手の行き来・場面)とフレンド機能(一覧・申請・通信)

## 最初に打つもの

```
node tools/ctx.js decisions friend     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/56-assistant-life-friend.jsx`
- `monster-hero/src/parts/34-friends-api.jsx`
- `monster-hero/src/parts/75-screen-friends.jsx`
- `tools/friends/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`AssistantLifeFriendPage` / `AlfFriendHouseView` / `FriendsScreen`

## 回す検査

- node tools/run-checks.js --changed(tools/friends・tools/assistant から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- フレンドの通信は Supabase。表・関数を変える SQL は自分で流さず、本文を窓口へ。変えたら ミハリ確認が要る
- ほかのプレイヤーの個人の情報を画面・ログに出さない

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/FRIENDS.md`](../../docs/spec/FRIENDS.md)
- [`docs/progress/assistant-peer/FRIEND-VISIT-PLAN.md`](../../docs/progress/assistant-peer/FRIEND-VISIT-PLAN.md)
- [`docs/progress/assistant-peer/FRIEND-VISIT-BUILD.md`](../../docs/progress/assistant-peer/FRIEND-VISIT-BUILD.md)

## 仕事の板・残りの仕事

- [`docs/progress/assistant-peer/FRIEND-VISIT-BUILD.md`](../../docs/progress/assistant-peer/FRIEND-VISIT-BUILD.md)

会話が長くなったら: `node tools/ctx.js handoff friend --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
