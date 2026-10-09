# `docs/rules/` — ルールの詳細

ルート [`CLAUDE.md`](../../CLAUDE.md) は**毎回すべて読み込まれる**ので、どの場面でも守ることの本文だけを置き、
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
| [`CONVERSATION.md`](CONVERSATION.md) | 会話言語 | 英語禁止のフックの経緯 |

## 節の置き場所(2026-10-09 にルートから移したもの)

ルートの CLAUDE.md は毎回全文が読み込まれるので、**場面が限られる節の本文は、その作業で必ず読むファイルの
隣へ移した**。決まりは1つも消していない(移しただけ)。ルートには、どの場面でも要る決まりと、
「どの場面でどこを開くか」の表、破ってはいけない一言だけを残している。

| 節 | 本文の置き場所 | 読み込まれる場面 | ルートに残した一言 |
| --- | --- | --- | --- |
| ⑤ 更新履歴・ヘルプ・助手の告知 | [`changelog-help-update` スキル](../../.claude/skills/changelog-help-update/SKILL.md)「守ること」 | スキルを開いたとき | ヘルプも必ず更新・実時刻(JST)・プレイヤー向けの文・ネタバレ禁止・正式名称・デバッグ専用は載せない |
| ⑥ のうち絵を差し替えたとき | [`monster-hero/images/CLAUDE.md`](../../monster-hero/images/CLAUDE.md)・[`monster-hero/audio/CLAUDE.md`](../../monster-hero/audio/CLAUDE.md) | そのフォルダのファイルを読んだとき | `image-asset-check.js` を通す |
| ⑥-2 画像・音源は軽くしてから | [`monster-hero/images/CLAUDE.md`](../../monster-hero/images/CLAUDE.md)・[`monster-hero/audio/CLAUDE.md`](../../monster-hero/audio/CLAUDE.md)(同じ本文) | 同上 | そのまま入れない |
| ⑥-3 モンヒロビートの新曲 | [`rhythm-song-add` スキル](../../.claude/skills/rhythm-song-add/SKILL.md)「守ること」 | スキルを開いたとき | スキルで最後まで通す・聞き返すのは難易度だけ |
| ⑥-4 モンヒロビートのイベント | [`monster-hero/data/CLAUDE.md`](../../monster-hero/data/CLAUDE.md) | `monster-hero/data/` のファイルを読んだとき | 手順書を開いてから・対象曲の譜面は開催中に触らない |
| ⑩-2 譜面生成ツール | [`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md) | `tools/mode/` のファイルを読んだとき | 既存曲の譜面・解析を作り直さない |
| 会話言語の経緯(Stop フック) | [`CONVERSATION.md`](CONVERSATION.md) | — | 日本語に固定・フックに止められたら書き直す |

サブフォルダの CLAUDE.md は、Claude Code が**そのフォルダのファイルを Read したとき**に読み込む
(2026-10-09 に `tools/mode/` と `monster-hero/data/` で確かめた)。Bash でスクリプトを走らせるだけでは
読み込まれないので、ルートの場面の表から「その作業を始める前に開く」とたどれるようにしている。

手順そのものがスキルになっているものは、そちらが正本。

- `.claude/skills/changelog-help-update/SKILL.md` … 更新履歴・ヘルプ・告知の書き方
- `.claude/skills/rhythm-song-add/SKILL.md` … 新曲を足す一連の手順
- `.claude/skills/monster-add/SKILL.md` … 味方モンスターを足す一連の手順

`node tools/rules-index-check.js` が、CLAUDE.md とこのフォルダの対応・リンク・
要のことばの消失を、移した先(上の表)も含めて見張っている。
