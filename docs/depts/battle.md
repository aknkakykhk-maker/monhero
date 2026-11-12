# バトル部(モンヒロバトル)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ジンくん / 受け持ち: モンヒロバトル(難易度とルール・敵・戦闘画面・演出・タクティクス・レイドのジャック・編成・結果)

## 最初に打つもの

```
node tools/ctx.js decisions battle     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/19-difficulties-and-rules.jsx`
- `monster-hero/src/parts/22-enemy-and-bond-entries.jsx`
- `monster-hero/src/parts/24-*`
- `monster-hero/src/parts/32-*`
- `monster-hero/src/parts/33-ai-copy*`
- `monster-hero/src/parts/34-tactics-ex-effects.jsx`
- `monster-hero/src/parts/35-raid-jack.jsx`
- `monster-hero/src/parts/36-raid-jack-api.jsx`
- `monster-hero/src/parts/37-raid-jack-aura.jsx`
- `monster-hero/src/parts/38-raid-jack-home-lines.jsx`
- `monster-hero/src/parts/67-screen-pick.jsx`
- `monster-hero/src/parts/68-screen-run-result.jsx`
- `monster-hero/src/parts/71-screen-battle.jsx`(0.4MB・開かない)
- `monster-hero/src/parts/78-screen-raid-jack-debug.jsx`
- `monster-hero/src/parts/79-screen-raid-jack.jsx`
- `monster-hero/src/parts/56-monhero-success-cup.jsx`
- `monster-hero/data/enemy-monsters.js`
- `monster-hero/data/skills.js`
- `tools/battle/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`BattleScreen` / `BattleUnitDetailPanel` / `ExtremeRuleOverlay`

## 回す検査

- node tools/run-checks.js --changed(tools/battle から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 敵の数字・まだ出ていない敵は更新履歴・ヘルプに書かない(ネタバレ)
- ランキング対象外の遊び方(スキップチケット・クイック)は、送信しないだけでなく自己ベストも上書きしない(CLAUDE.md ⑦)
- 数字の釣り合いは自分で決めず、案を窓口へ

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/BATTLE_SYSTEM.md`](../../docs/spec/BATTLE_SYSTEM.md)
- [`docs/spec/TACTICS_EX_SKILLS.md`](../../docs/spec/TACTICS_EX_SKILLS.md)
- [`docs/spec/RAID_BOSS_JACK.md`](../../docs/spec/RAID_BOSS_JACK.md)
- [`docs/spec/BATTLE_LOG.md`](../../docs/spec/BATTLE_LOG.md)

## 仕事の板・残りの仕事

- [`docs/progress/battle-board.md`](../../docs/progress/battle-board.md)
- [`docs/progress/battle-backlog.md`](../../docs/progress/battle-backlog.md)

会話が長くなったら: `node tools/ctx.js handoff battle --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
