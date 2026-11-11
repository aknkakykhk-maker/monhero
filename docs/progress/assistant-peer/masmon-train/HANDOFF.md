# 引き継ぎメモ: シュギョウ(助手のマスモン 第②段階・修行と助手の成長)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/masmon.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## いまの状態

- **公開済み**: PR #5345(main `dcc474f3`)。公開の印 `assistantMasmonTrain: true`
- 社長の決めごとは台帳に記録済み(`node tools/ctx.js decisions masmon` で出る)

## 受け持ちのファイル

| ファイル | 中身 |
| --- | --- |
| `monster-hero/src/parts/56-assistant-life-masmon-train.jsx` | 修行6系統・技の習得と熟練・ブリーダー能力・相談・札(`AmgtCard`) |
| `tools/assistant/assistant-masmon-techs-build.js` → `monster-hero/data/assistant-masmon-techs.js` | 30種族×8の技表(生成物。表を直すなら道具側) |
| `tools/assistant/assistant-masmon-train-check.js` | 検査。`--sim --rate=0.25` で 30・90・180 日の伸びを試算 |
| `tools/assistant/assistant-masmon-train-mock.js` | 止め絵 `mock.jpg` を作る |
| 保存キー `mh_assistant_masmon_train_v1` | 形は `docs/spec/SAVE_DATA.md` |

## ほかの部とのつなぎ目

- キズナ4(第①段階・`56-assistant-life-masmon-grow.jsx`)から呼ばれる口: `amgtChoose` / `amgtDo` / `amgtAfterAct` / `amgtRestAt`、掛け算 `amgtLeadMult` / `amgtFailMult` / `amgtStressMult`
- タタカイ(第③段階)へ渡す口: `amgtBattleOf(aid, slot)` → `{ techs, mastery }`、`amgtTacticsOf(aid, rows)` → 0〜100
- ナカヨシ11(生活)から: `amgtOnLifeSlot(life, slot, now)` でモンヒロバトル(`battle`)にいた回を覚える。その日の残りの回で1日2回まで修行(案A)

## 残りの仕事

- **ナカヨシ11の「1日12回の移動」が入ったら**、その割合で `node tools/assistant/assistant-masmon-train-check.js --sim --rate=<割合>` を回し、180日で極みまで届くかを窓口へ出す(いまは 25% で 180日・技8/8・熟練57〜100)
- それ以外は無し

## 気をつけること

- 第①段階の乱数の列を引かない(修行は `assistantMasmonRng` で自分の種から作る)
- 保存を読み込む前は書かない(`AMGT_STORE.loaded` の守り)。同じ回は二度当てない(`log.s` で見る)
- `card-battle-browser-check` ⑧(助手ライフの保存キー)は main でも落ちる。修行とは関係なし
