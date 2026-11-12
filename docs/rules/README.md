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
| [`CHART_ENGINE.md`](CHART_ENGINE.md) | ⑩-2 | 譜面の作り方(最新リビジョンだけ・手の決まり)を触るとき |
| [`CONVERSATION.md`](CONVERSATION.md) | 会話言語 | 英語禁止のフックの経緯 |
| [`ASSISTANT_ADD.md`](ASSISTANT_ADD.md) | ⑤・⑥ | 新しい助手を足すとき(全場面の台詞をそろえる・取り違えの検査) |
| [`CALL_NAMES.md`](CALL_NAMES.md) | ⑤・⑥ | 助手・マスモンの台詞でプレイヤーや助手を呼ぶとき(`{name}`・`{c}` の決まり・呼び方の一覧) |
| [`NEW_DEPT_BRIEF.md`](NEW_DEPT_BRIEF.md) | — | 新しい部署を作るとき・新しい部署になったとき(共通の申し送り) |
| [`ORGANIZATION.md`](ORGANIZATION.md) | — | だれ(どの部署・部長)に仕事を頼むか・報告するかを確かめるとき(組織図) |
| [`MODEL_ROUTING.md`](MODEL_ROUTING.md) | ⑪ | 新しい会話を作るとき(仕事の種類 → モデルの表・要所のモデルを呼ぶ条件・実例) |
| [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md) | ⑪ | 会話が長くなったとき(区切りの目安・引き継ぎメモの型・新しい会話の依頼文の型) |
| [`REVIEW_GATE.md`](REVIEW_GATE.md) | ⑪ | 公開の前(ミハリの確認が要る変更・要らない変更。判定は `node tools/ctx.js gate`) |
| [`EDGE_REDEPLOY.md`](EDGE_REDEPLOY.md) | ⑪ | Edge Function(assistant-chat)を配り直すとき(送るのは数行。窓口が打つもの) |
| [`DECISION_LOCKS.md`](DECISION_LOCKS.md) | 台帳 | 台帳の「進め方」に決めごとを足すとき・道具やフックの文を変えるとき(決めごとの錠。検査は `node tools/team/decision-lock-check.js`) |

## 部署別の手引き(2026-11-11)

部ごとの話(受け持つファイル・入口の関数・回す検査・関係する決まり)は [`docs/depts/`](../depts/README.md) に部ごとに1枚。
新しい会話は CLAUDE.md のあと**自分の部の1枚だけ**読む。正本は `tools/team/depts.json`
(`node tools/team/dept-guide.js --write` で作り直す。`rules-index-check.js` が実在と食い違いを見張る)。
社長の決めごとの台帳は300KBを超えたので、`node tools/ctx.js decisions <部>` で「進め方」と自分の部に関わる行だけ読む。

2026-11-11 にルートの CLAUDE.md を 16.5KB → 14.5KB にした(⑪ を足したうえで)。移した先: ⑥-2〜⑥-4・⑩-2 の一言は
「最初に打つもの」の箇条書きと部の手引きへ、①〜④・⑦・⑨・⑩ の言い回しの重なりは [`FLOW.md`](FLOW.md)・
[`SAVE_DATA_RULES.md`](SAVE_DATA_RULES.md)・[`CONTEXT_BUDGET.md`](CONTEXT_BUDGET.md)・[`SCOPE.md`](SCOPE.md) に本文がある。決まりは消していない。

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
