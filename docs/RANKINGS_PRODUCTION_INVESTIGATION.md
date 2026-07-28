# 本番 `rankings` 重複防止の調査・適用手順

## 結論

現行ゲームは Supabase Data API を publishable key だけで呼び出し、Supabase Auth のログイン・セッション・ユーザー ID を使用していない。したがって、ゲームからのアクセス主体は `anon` である。

重複防止には、`user_name`・`difficulty`・`score` の UNIQUE 制約ではなく、1周回ごとの `clear_id`（一般的な名称では `result_id`）に UNIQUE インデックスを設定する方式を採用する。

- 同じプレイヤーが同じ難易度で同じスコアを正当に2回出す可能性があり、3列 UNIQUE は正常記録も拒否する。
- 表示名は本人性を保証せず、Auth ユーザー ID の代用にはならない。
- 現行クライアントは周回開始時に `clear_id` を生成し、`on_conflict=clear_id` と `resolution=ignore-duplicates` で送信済みである。
- 既存行の `clear_id` は `NULL` のまま許容するため、過去データを作り直さず段階導入できる。PostgreSQL の通常の UNIQUE インデックスは複数の `NULL` を許容する。

## コードから確定できる事項

| 項目 | 調査結果 |
| --- | --- |
| 接続先 | `https://zrzevudkbgtxlbvmuziy.supabase.co` |
| 認証方式 | publishable key を `apikey` ヘッダーにだけ設定。`Authorization`、`supabase.auth`、ログイン処理はないため `anon` |
| 読み取り | `rankings` を難易度で絞り、スコアまたはレベル順に SELECT |
| 書き込み | `rankings?on_conflict=clear_id` へ POST |
| 冪等化 | 周回単位の `clear_id` と `resolution=ignore-duplicates` |
| 現行コードが読む列 | `user_name`, `hero`, `party`, `score`, `level`, `icon` |
| 現行コードが書く列 | 上記に `difficulty`, `clear_id` を加えた列（互換性のため `level` / `icon` は省略して再試行） |

## 本番接続が必要な事項

カラムの型・既定値・NULL 可否、Primary Key、Unique 制約、Index、RLS の有効状態、各ポリシーはリポジトリや公開 Data API の応答だけでは確定できない。これらを推測で断定せず、[`RANKINGS_PRODUCTION_AUDIT_AND_APPLY.sql`](./RANKINGS_PRODUCTION_AUDIT_AND_APPLY.sql) の **セクション A** を本番 Supabase SQL Editor で実行し、その結果を保存する。

セクション A は SELECT のみであり、本番データ・スキーマ・RLS を変更しない。確認できる内容は次のとおり。

1. 全カラムの型、既定値、NULL 可否、identity/generated 属性
2. Primary Key、Unique/Check/Foreign Key 制約と全 Index
3. RLS の有効・強制状態
4. SELECT・INSERT・UPDATE・DELETE・ALL のポリシー（対象 role、USING、WITH CHECK を含む）
5. `anon` / `authenticated` のテーブル権限
6. 3列完全一致および既存 `clear_id` の重複状況

## 方式比較

| 方式 | 利点 | 問題 | 判定 |
| --- | --- | --- | --- |
| `UNIQUE (user_name, difficulty, score)` | SQL が短く、既存クライアント変更なしでも完全一致の再送を拒否できる | 正当に同点を取った別周回も拒否する。表示名変更・表記揺れ・同名ユーザーにも弱い。`NULL` があれば完全な防止にならない | 不採用 |
| `UNIQUE (clear_id)`（=`result_id` 方式） | 同一クリアの再送だけを拒否し、正当な同点は保持できる。`ON CONFLICT` で成功扱いにできる | クライアントが一意 ID を送る必要がある。旧クライアントの `NULL` 行は冪等化できない | **推奨**。現行コードは対応済み |

`result_id` を新たに追加すると現行コードの `clear_id` と役割が二重化するため、列名は現行実装に合わせて `clear_id` とする。

## 安全な実施順序

1. セクション A（読み取り専用）を実行し、現在の定義・RLS・ポリシーを保存する。
2. 重複候補を目視確認する。今回の適用では既存データを削除しない。3列一致は正当な同点を含み得るが、既存行の `clear_id` は `NULL` のままなので UNIQUE インデックスと共存できる。
3. セクション B を実行する。既定は `ROLLBACK` である。検証結果を確認した後だけ `ROLLBACK` を `COMMIT` に変更して再実行する。
4. セクション C を SQL Editor で実行する。
5. publishable key を使う実ゲームまたは同等の Data API で SELECT と INSERT を確認する。同じ `clear_id` の2回目 POST はエラーではなく無視され、行数が1件だけであることを確認する。

セクション B は RLS の有効化・無効化、ポリシー、GRANT を一切変更しない。さらにトランザクション開始時の RLS・ポリシー・権限を一時表に保存し、終了前に差分がないことを検査する。差分があれば例外で停止するため、ランキングの読み書き権限を意図せず変えることはない。

## 注意事項

- 本手順に `DROP TABLE`、テーブル再作成、RLS/policy の変更は含まない。
- SQL Editor の管理者接続で成功しても `anon` の Data API が成功する証明にはならない。適用後の Data API スモークテストは必須である。
- `clear_id` を送らない旧クライアントの新規行は UNIQUE の対象外になる。公開中の現行コードが `clear_id` を必ず送ることを確認してから適用する。
- 3列一致の既存重複削除と `clear_id` 導入は独立している。3列重複が残っていても `clear_id` の追加は可能であり、今回の適用では既存データを削除しない。
- iPhone から作業する場合を含む実施手順、判定基準、緊急時対応は [`RANKINGS_SUPABASE_IPHONE_RUNBOOK.md`](./RANKINGS_SUPABASE_IPHONE_RUNBOOK.md) を参照する。
