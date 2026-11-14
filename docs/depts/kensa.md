# 検査部(ミハリ)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ミハリ / 受け持ち: 作った人と別の目での通し確認。新機能・保存データ・ランキングに関わる変更だけを見る(小さな直しは見ない)

## 最初に打つもの

```
node tools/ctx.js decisions kensa     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `tools/browser/*`
- `docs/progress/qa-*`

## 回す検査

- node tools/ctx.js gate --base <公開前のコミット>(何を見るかが出る)
- 本物の画面を縦・横・🔄横で開いて撮り、自分で見る
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 見るだけ。直さない・コミットしない。見つけた物は作った部へ返す
- 呼ばれるのは node tools/ctx.js gate が「要る」と出した変更だけ。「要らない」の変更の確認は断ってよい
- 保存データ: 既存のキー(mh_*)が消えない・古い形が読める・移行が1回だけ、を確かめる。ランキング: 既存の記録と送信が壊れない・対象外の遊び方が自己ベストを上書きしない
- 新機能の最終確認だけ claude-fable-5-2 で(docs/rules/MODEL_ROUTING.md)
- モンサクの画面を作る・直す前に docs/reference/line-mf/REF-MAP.md でその画面の行を引き、参考の実物(画像・動画のコマ)を自分の目で見てから作る(要約のメモだけで作らない)
- モンサクの画面は docs/spec/MONSUC_UI.md の決まり(画面の使い方・数字のそろえ方・結果の出し方・札の形)にそろえる

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/rules/REVIEW_GATE.md`](../../docs/rules/REVIEW_GATE.md)
- [`docs/spec/SAVE_DATA.md`](../../docs/spec/SAVE_DATA.md)
- [`docs/rules/SAVE_DATA_RULES.md`](../../docs/rules/SAVE_DATA_RULES.md)

会話が長くなったら: `node tools/ctx.js handoff kensa --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
