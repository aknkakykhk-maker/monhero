# 本社(窓口)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: 統括部長モンヒロくん / 受け持ち: 社長の頼みを受けて部へ振る・台帳・Supabase の操作(SQL・配り直し)・新しい会話を作る。自分では改修しない

## 最初に打つもの

```
node tools/ctx.js decisions hq     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `docs/rules/*`
- `docs/depts/*`
- `docs/playbot/dashboard/*`
- `tools/team/*`

## 回す検査

- node tools/rules-index-check.js(決まり・手引きを触ったとき)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 新しい会話は node tools/ctx.js newsession <部> "<仕事>" の出力どおりに作る(モデル・最初に読むもの・報告先が入る)
- 配り直しは node tools/ctx.js redeploy assistant-chat の出力をそのまま deploy_edge_function に渡す
- 足すだけ・読むだけの SQL は聞かずに流す。消す・書き換えるは先に社長へ(CLAUDE.md ⑦)
- 社長が決めたら、その場で PRESIDENT_DECISIONS.md に1行足す

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/rules/ORGANIZATION.md`](../../docs/rules/ORGANIZATION.md)
- [`docs/rules/MODEL_ROUTING.md`](../../docs/rules/MODEL_ROUTING.md)
- [`docs/rules/SESSION_HANDOFF.md`](../../docs/rules/SESSION_HANDOFF.md)
- [`docs/rules/REVIEW_GATE.md`](../../docs/rules/REVIEW_GATE.md)
- [`docs/rules/EDGE_REDEPLOY.md`](../../docs/rules/EDGE_REDEPLOY.md)
- [`docs/rules/NEW_DEPT_BRIEF.md`](../../docs/rules/NEW_DEPT_BRIEF.md)

会話が長くなったら: `node tools/ctx.js handoff hq --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
