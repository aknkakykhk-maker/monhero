# 助手部オクリモノ(贈り物・道具・家具)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: オクリモノ / 受け持ち: 助手ライフの贈り物(買って贈る)・道具・家具

## 最初に打つもの

```
node tools/ctx.js decisions gift     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/56-assistant-life-gifts.jsx`
- `tools/assistant/life-gift-*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`AssistantLifeGiftSheet` / `AssistantLifeFurnSheet`

## 回す検査

- node tools/run-checks.js --changed(tools/assistant から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- ダイヤ・ポイントが減る/増える所は保存データ。新しいキーに足す。変えたら ミハリ確認が要る
- 値段・ごほうびの数字は自分で決めず、案を窓口へ

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/progress/assistant-peer/GIFT-PLAN.md`](../../docs/progress/assistant-peer/GIFT-PLAN.md)
- [`docs/progress/assistant-peer/GIFT-HANDOFF.md`](../../docs/progress/assistant-peer/GIFT-HANDOFF.md)

## 仕事の板・残りの仕事

- [`docs/progress/assistant-peer/GIFT-HANDOFF.md`](../../docs/progress/assistant-peer/GIFT-HANDOFF.md)

会話が長くなったら: `node tools/ctx.js handoff gift --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
