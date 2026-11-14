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
- node tools/team/decision-lock-check.js(台帳の進め方・道具・フックを触ったとき)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 新しい会話は node tools/ctx.js newsession <部> "<仕事>" の出力どおりに作る(モデル・最初に読むもの・報告先が入る)
- claude-fable-5-2 を使ってよいのは決まりの3つ(道具・仕組みを作る/強化する1回・新機能の公開前の最終確認・2回直しても直らない不具合)だけ。外れるときは社長に選択式で聞いてから
- 配り直しは node tools/ctx.js redeploy assistant-chat の出力をそのまま deploy_edge_function に渡す
- SQL は消す・書き換える・既存の表を変えるものも含めて、窓口の判断で社長に聞かずに流す(2026-11-12 社長。CLAUDE.md ⑦)。保存データ・ランキングを壊さない決まりは変わらない
- 社長が決めたら、その場で PRESIDENT_DECISIONS.md に1行足す。進め方の決めごとは「<日付> 進め方:」で書き、同じ PR で tools/team/decision-locks.json に錠を足す(docs/rules/DECISION_LOCKS.md)
- 見た目が変わる仕上げは、公開の前に必ず社長に止め絵を見せて OK をもらう(部へ「公開まで」と回すのは社長の OK のあと)
- モンサクは社長に見せる前・β公開の前に、1回の育成を始めから引退・合体まで通して遊ぶ点検を挟む(画面ごとに止め絵・プレイヤーの目で拾い、各部へ振り分け、直したらもう一度通す)
- 社長に聞く前に台帳を語で引く(node tools/ctx.js decisions hq や grep)。もう決まっていることは聞かずにそれで進める
- 社長が寝る・離れるときは、相当重要なこと以外は窓口の判断で進める。同時に進める仕事は3〜5つ(優先順位は窓口が決める)。20時を過ぎたら作業の数を減らし、モンサクを優先する(モンヒロビートの新曲はいつも優先)
- 表は画像(PNG)で見せる(送る前に拡大して確かめる。返事に表の記法が残るとフックが止める)。仕上がりは社長に報告する前にカゲあつくんに見てもらう
- モンサクの画面を作る・直す前に docs/reference/line-mf/REF-MAP.md でその画面の行を引き、参考の実物(画像・動画のコマ)を自分の目で見てから作る(要約のメモだけで作らない)
- モンサクの画面は docs/spec/MONSUC_UI.md の決まり(画面の使い方・数字のそろえ方・結果の出し方・札の形)にそろえる

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/rules/ORGANIZATION.md`](../../docs/rules/ORGANIZATION.md)
- [`docs/rules/MODEL_ROUTING.md`](../../docs/rules/MODEL_ROUTING.md)
- [`docs/rules/SESSION_HANDOFF.md`](../../docs/rules/SESSION_HANDOFF.md)
- [`docs/rules/REVIEW_GATE.md`](../../docs/rules/REVIEW_GATE.md)
- [`docs/rules/EDGE_REDEPLOY.md`](../../docs/rules/EDGE_REDEPLOY.md)
- [`docs/rules/NEW_DEPT_BRIEF.md`](../../docs/rules/NEW_DEPT_BRIEF.md)

会話が長くなったら: `node tools/ctx.js handoff hq --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
