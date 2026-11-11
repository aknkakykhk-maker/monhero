# カード部(MFバトルカード)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ソランドくん / 受け持ち: MFバトルカード(対戦・デッキ・パック・マルチ・リプレイ・観戦・大会・カップ・ランキング・助手の台詞)

## 最初に打つもの

```
node tools/ctx.js decisions card     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/82-card-*`
- `monster-hero/src/parts/83-card-*`
- `monster-hero/src/parts/84-screen-card-battle.jsx`(0.4MB・開かない)
- `monster-hero/src/parts/85-card-*`
- `monster-hero/src/parts/86-card-*`
- `monster-hero/src/parts/87-card-*`
- `monster-hero/src/parts/88-card-*`
- `monster-hero/src/parts/89-card-*`
- `monster-hero/src/parts/90-card-*`
- `monster-hero/src/parts/91-card-*`
- `monster-hero/src/parts/92-card-*`
- `monster-hero/src/parts/93-card-*`
- `monster-hero/src/parts/94-card-*`
- `monster-hero/src/parts/95-card-*`
- `monster-hero/src/parts/96-card-*`
- `monster-hero/src/parts/97-card-*`
- `monster-hero/src/parts/98-card-*`
- `monster-hero/src/parts/99-card-*`
- `monster-hero/data/card-battle-cards.js`
- `tools/card/*`
- `supabase/functions/card-tournament-run/*`
- `supabase/functions/card-assistant-talk/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`CardBattleScreen` / `CardStatusSheet` / `CardChatPanel`

## 回す検査

- node tools/run-checks.js --changed(tools/card から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 大会用の game.js を変えたら、窓口へ「card-tournament-run の配り直し」を頼む(部は Supabase に触れない)
- カードの数字・ルールの釣り合いは自分で決めず、案を窓口へ
- ランキング・戦績の送信を変えるときは ミハリ確認が要る(node tools/ctx.js gate が判定)

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/CARD_BATTLE.md`](../../docs/spec/CARD_BATTLE.md)
- [`docs/spec/CARD_CUP.md`](../../docs/spec/CARD_CUP.md)
- [`docs/spec/CARD_TOURNAMENT.md`](../../docs/spec/CARD_TOURNAMENT.md)
- [`docs/spec/CARD_ASSISTANT_TALK.md`](../../docs/spec/CARD_ASSISTANT_TALK.md)

## 仕事の板・残りの仕事

- [`docs/progress/card-board.md`](../../docs/progress/card-board.md)
- [`docs/progress/card-backlog.md`](../../docs/progress/card-backlog.md)

会話が長くなったら: `node tools/ctx.js handoff card --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
