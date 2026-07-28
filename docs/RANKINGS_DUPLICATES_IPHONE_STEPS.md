# ランキング重複27件整理：iPhone実行手順

本番Supabaseの **SQL Editor** で、ファイルを1つずつ全文貼り付けて実行します。途中のSQLだけを選択実行せず、必ず各ファイル単位で実行してください。Codexは本番への実行を行いません。

## 対象と削除予定

| user_name | difficulty | score | 削除前 | 残す | 削除予定 |
|---|---:|---:|---:|---:|---:|
| セフィ | Normal | 265502 | 12 | 1 | 11 |
| あつ | Master | 11495811 | 12 | 1 | 11 |
| あつ | Master | 7023217 | 6 | 1 | 5 |
| **合計** |  |  | **30** | **3** | **27** |

残す基準は、各グループを `created_at asc nulls last, id asc` で並べた先頭（最古）の1件です。対象に `created_at IS NULL` が1件でもあれば自動停止します。

## 貼り付ける順番

### 1. CHECK

`docs/RANKINGS_DUPLICATES_01_CHECK.sql`

- **成功:** 3行すべてが「成功: ROLLBACKへ進めます」、件数が12・12・6、一覧が30件で各グループに「残す1件（最古）」が1行だけ表示されます。
- `total_rankings_before`、`named_users_rows_before`、`named_users_non_target_rows_before` をスクリーンショットまたはメモに残します。
- **中止:** 「中止」、NULL件数、期待値以外の件数、一覧30件以外が出た場合。後続を実行しません。

### 2. ROLLBACK

`docs/RANKINGS_DUPLICATES_02_ROLLBACK.sql`

- **成功:** noticeに合計27件の試験削除成功、削除候補27行、3グループの `remaining_count = 1` が表示され、最後が `ROLLBACK` です。本番データは元に戻ります。
- **中止:** `ERROR` / 「中止」、削除候補が27行以外、残存が1以外。COMMITへ進みません。

### 3. CHECK再実行

もう一度 `docs/RANKINGS_DUPLICATES_01_CHECK.sql` を全文実行します。

- **成功:** 手順1と同じ12・12・6、対象30件、同じ3つの比較用件数です。ROLLBACKでデータが戻った証拠です。
- **中止:** 1回目との差、NULL、件数不一致があればCOMMITしません。

### 4. COMMIT

`docs/RANKINGS_DUPLICATES_03_COMMIT.sql`

- **成功:** noticeに11・11・5（合計27件）の削除成功が出て、結果3行がすべて `deleted_count` 11・11・5、`remaining_count = 1`、「成功: COMMIT可能」と表示され、最後が `COMMIT` です。
- **中止:** `ERROR` / 「中止」、27件以外、残存が1以外。例外時はトランザクションが失敗状態になるため、SQL Editorで `rollback;` を実行して終了します。

### 5. VERIFY

`docs/RANKINGS_DUPLICATES_04_VERIFY.sql`

- **成功:** 各グループ1件、対象合計3件、`duplicate_clear_id_groups = 0`、`valid_unique_index_count = 1` が表示されます。
- `total_rankings_after` がCHECKの `total_rankings_before` より27少なく、表示された `expected_total_rankings_before` がメモと一致することを確認します。
- `named_users_rows_after` はCHECKより27少なく、`named_users_non_target_rows_after` はCHECKと同数なら、対象外の難易度・スコアを変更していません。
- **中止・連絡:** 「中止」、比較値の不一致、重複あり、indexなしが表示された場合。追加のDELETEは行わず、結果を保存して調査します。
