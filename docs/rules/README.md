# `docs/rules/` — ルールの詳細

ルート [`CLAUDE.md`](../../CLAUDE.md) は**毎回すべて読み込まれる**ので、守ることの本文だけを置き、
経緯・失敗例・具体的な手順はここへ寄せている。**正本は CLAUDE.md**で、ここはその裏付け。

必要な節だけを引くには次を打つ（CLAUDE.md・AGENTS.md・このフォルダを横断する）。

```
node tools/ctx.js rules            見出しの一覧
node tools/ctx.js rules 音量       その語に触れている節だけ
```

| ページ | CLAUDE.md の節 | いつ開くか |
| --- | --- | --- |
| [`FLOW.md`](FLOW.md) | ①〜④ | コミット・プッシュ・マージの進め方に迷ったとき |
| [`CHANGELOG_HELP.md`](CHANGELOG_HELP.md) | ⑤ | 更新履歴・ヘルプ・助手の告知を書くとき |
| [`BUILD_CHECKS.md`](BUILD_CHECKS.md) | ⑥ | 検査が何を見ているのか知りたいとき |
| [`ASSETS.md`](ASSETS.md) | ⑥-2 | 画像・音源を入れるとき |
| [`RHYTHM_SONG.md`](RHYTHM_SONG.md) | ⑥-3 | モンヒロビートに曲を足すとき |
| [`RHYTHM_EVENT.md`](RHYTHM_EVENT.md) | ⑥-4 | モンヒロビートのイベントを開くとき |
| [`SAVE_DATA_RULES.md`](SAVE_DATA_RULES.md) | ⑦ | 保存するものを増やす・変えるとき |
| [`CONTEXT_BUDGET.md`](CONTEXT_BUDGET.md) | ⑨ | 大きいファイルを扱うとき／道具の使い方 |
| [`SCOPE.md`](SCOPE.md) | ⑩・⑩-2 | 質問に答えるとき／譜面生成ツールを触るとき |

手順そのものがスキルになっているものは、そちらが正本。

- `.claude/skills/changelog-help-update/SKILL.md` … 更新履歴・ヘルプ・告知の書き方
- `.claude/skills/rhythm-song-add/SKILL.md` … 新曲を足す一連の手順

`node tools/rules-index-check.js` が、CLAUDE.md とこのフォルダの対応・リンク・
要のことばの消失を見張っている。
