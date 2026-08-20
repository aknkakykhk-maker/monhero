# docs/ の案内

モンスターヒーローの資料置き場。**どこに何があるか**をここにまとめている。

## まず読むもの

| 文書 | 中身 |
| --- | --- |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | プロジェクトの目的・技術的な前提・ディレクトリ構成の要約 |
| [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) | フォルダ構成と責務境界の詳細 |
| [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) | 確認済みで未解決の課題 |

開発手順そのものはルートの [`DEVELOPMENT.md`](../DEVELOPMENT.md)、
Claude 固有の会話・公開フローは [`CLAUDE.md`](../CLAUDE.md) が正本。

## `spec/` — 現行のゲーム仕様

| 文書 | 中身 |
| --- | --- |
| [`spec/BATTLE_SYSTEM.md`](spec/BATTLE_SYSTEM.md) | バトルの進行、ダメージ計算、カード、WAVE |
| [`spec/MONSTER_SYSTEM.md`](spec/MONSTER_SYSTEM.md) | 育成、マスモン、総合力、融合、ランキング詳細 |
| [`spec/SAVE_DATA.md`](spec/SAVE_DATA.md) | 保存キー(`mh_*`)の一覧と互換性の方針 |
| [`spec/UI_RULES.md`](spec/UI_RULES.md) | 画面まわりの共通ルール |

コードと食い違ったときは `monster-hero/src/game-system.jsx` と `monster-hero/data/` が正本。

## `sql/` — Supabase へ流す SQL と手順

読み取り専用の監査 → 末尾 `rollback;` の予行演習 → 末尾 `commit;` の実適用 →
適用後の確認、という順で使う。`_IPHONE_STEPS.md` に iPhone からの実行手順がある。

| フォルダ | 対象 |
| --- | --- |
| [`sql/rankings/`](sql/rankings/) | `rankings` テーブル本体、緊急対応、重複整理 |
| [`sql/bond-levels/`](sql/bond-levels/) | `bond_levels` テーブル（2026-08-14 適用済み） |
| [`sql/run-stats/`](sql/run-stats/) | `rankings` へ後から足した `turns` / `reached_wave`（2026-08-15 適用済み） |

再現可能な構造変更の正本はリポジトリルートの [`supabase/migrations/`](../supabase/migrations/)。

## `history/` — 過去の調査記録

そのときの判断と根拠を残すためのもの。現行仕様の説明ではない。

- [`history/MASU_BASELINE_HISTORY.md`](history/MASU_BASELINE_HISTORY.md)
- [`history/MASU_BASELINE_MIGRATION_AUDIT.md`](history/MASU_BASELINE_MIGRATION_AUDIT.md)
- [`history/RANKINGS_PRODUCTION_INVESTIGATION.md`](history/RANKINGS_PRODUCTION_INVESTIGATION.md)

## `codex/` — Codex で作業を始めるとき

- [`codex/START_NEW_CODEX_CHAT.md`](codex/START_NEW_CODEX_CHAT.md)
- [`codex/PROMPT_TEMPLATE.md`](codex/PROMPT_TEMPLATE.md)

## `references/` — 参考資料

- [`references/game-development-rules.svg`](references/game-development-rules.svg) … 制作ルールの図
- [`references/battle-difficulty-carousel.html`](references/battle-difficulty-carousel.html) … 難易度選択の試作

## `archive/` — 実行済みの単発作業

[`archive/`](archive/) の SQL は**本番で実行済み**。記録として残しているだけで、再実行しない。

## 置き場所の決め方

- 今の仕様の説明 → `spec/`
- 本番DBを触る SQL と手順 → `sql/<対象>/`
- 「あのときなぜそうしたか」の記録 → `history/`
- 役目を終えた単発作業 → `archive/`（再実行しない旨を README に書く）
- 図・試作など読み物でないもの → `references/`
