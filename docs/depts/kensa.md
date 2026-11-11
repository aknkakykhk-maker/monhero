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

## 遊び回る点検(roam-bot)

ゲームを自動で遊び回って、人が気づく種類の不具合を拾う道具(`tools/browser/roam-bot.js`。2026-11-11)。決めた手順の検査では拾えない「戻れない・鳴りっぱなし・前の画面の残り」を見る。

```
node tools/browser/roam-bot.js --quick 2>&1 | tail -20      毎晩の点検(縦・横・小さい横 568×320。5分ほど)
node tools/browser/roam-bot.js --out docs/progress/qa-<日付>/roam   しっかり回して、止め絵と report.json を残す(7分ほど)
node tools/browser/roam-bot.js --seed 7 --viewports 横 --routes バトル,裏クイック --trace   場面をしぼって1手ずつ追う
node tools/browser/roam-bot.js --update-known              窓口へ送った物を「既知」に足す(tools/browser/roam-known.json)
```

- **読むのは最後の数行だけ。** 1行目が回した量、「見つけた物」が大きい順の上位、最後の1行が `OK` / `NG`。`NG` は「既知」に無い新しい物があるとき
- 拾う物: ページのエラー・コンソールの赤・画面エラー・真っ白・固まり・戻れない・窓のボタンが画面の外・音が鳴りっぱなし/曲が重なる/だれも押していないのに音が続く・前の画面が一瞬出る/演出や画面揺れが残る・同じ祝いの窓が2回・起動直後にボタンが動く・ボタンが端で切れる・横はみ出し
- **毎晩の点検(安いモデルでよい)**: 回す → 新しい物があれば、持ち場(行の「持ち場」)ごとにまとめて窓口へ送る → 送ったら `--update-known`。止め絵は自分で開いて、道具の見まちがいでないか1度見る。**直さない**(直すのは各部)。同じ物が2晩続けて「道具の見まちがい」なら、道具を直す仕事として窓口へ(道具を直すのは上のモデル)
- 保存データとランキングは壊さない作り: 新しいブラウザ(保存は空)で回し、外への通信は名前解決・HTTP・ソケットの3段でふさぐ。**本番のURLへ向けない・通信のふさぎを外さない**
- 種が同じでも、歩く道は読み込みの速さで少し変わる(毎回まったく同じにはならない)。再現は `--routes` と `--trace` でしぼる
- コースを足す: `roam-bot.js` の `ROUTES` に HOME からの入り方を1行。決まった手順でしか通れない所は `HOOKS`

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/rules/REVIEW_GATE.md`](../../docs/rules/REVIEW_GATE.md)
- [`docs/spec/SAVE_DATA.md`](../../docs/spec/SAVE_DATA.md)
- [`docs/rules/SAVE_DATA_RULES.md`](../../docs/rules/SAVE_DATA_RULES.md)

会話が長くなったら: `node tools/ctx.js handoff kensa --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))
