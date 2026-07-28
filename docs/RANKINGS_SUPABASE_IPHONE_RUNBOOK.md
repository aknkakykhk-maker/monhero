# iPhone から行う `clear_id` 本番適用手順

## 前提と禁止事項

この手順は Supabase Dashboard の SQL Editor を使い、既存ランキングを残したまま同一クリアの再送だけを防止する。`rankings` テーブルの DROP、既存行の DELETE、3列（名前・難易度・スコア）を使った UNIQUE 制約の追加は行わない。

リポジトリの公開クライアントは、周回ごとの `clear_id` を `rankings?on_conflict=clear_id` に送信し、`resolution=ignore-duplicates` を指定する。既存行の `clear_id` は `NULL` のまま残り、PostgreSQL の通常の UNIQUE インデックスでは複数の `NULL` が共存できる。

## iPhone での実行

1. Safari で Supabase Dashboard を開き、対象プロジェクト `zrzevudkbgtxlbvmuziy` を選ぶ。
2. 左上のメニューから **SQL Editor** を開き、**New query** を選ぶ。
3. GitHub で `docs/RANKINGS_PRODUCTION_AUDIT_AND_APPLY.sql` を開き、まずセクション **A**（A-1〜A-8）だけをコピーして **Run** する。結果をスクリーンショットまたは CSV で保存する。
4. `clear_id` が既にある場合、A-8 のコメントを外して実行する。非 `NULL` の同一 `clear_id` が複数あれば停止し、削除せず担当者へ結果を共有する。
5. 同ファイルのセクション **B** を、末尾が `rollback;` のまま実行する。`rankings_clear_id_unique` が `is_unique=true`、`is_valid=true`、`is_ready=true` と表示され、エラーがないことを確認する。この試行は保存されない。
6. B の末尾で `rollback;` を `-- rollback;` にし、直前の `-- commit;` を `commit;` に変えて、B 全体をもう一度 **Run** する。
7. セクション **C** を実行する。`clear_id` が `text`、`rankings_clear_id_unique` が `UNIQUE` と表示されることを確認する。A-4〜A-6も再実行し、RLS、policy、権限が事前結果と同じであることを確認する。
8. 公開ゲームでテスト用の1周をクリアする。同じ `clear_id` を使う再送検証が必要な場合は、ブラウザから推測で行わず、管理された検証クライアントで同一リクエストを2回送り、その `clear_id` の件数が1件であることを SQL Editor で確認する。

## 成功判定

- 既存ランキング件数が適用前後で減っていない。
- `clear_id` カラムが存在し、NULLを許容している。
- `rankings_clear_id_unique` が妥当な UNIQUE インデックスである。
- RLS、policy、`anon` / `authenticated` の権限が変わっていない。
- 同一の非NULL `clear_id` は最大1件で、異なる `clear_id` の正当な同点は保存できる。
- Master、Normal、Hard、Expert のランキング SELECT が成功する。

## エラー時

`rollback;` の試行中にエラーが出た場合は、そのまま停止する。トランザクションは保存されない。実適用後に異常が見つかった場合は、データを削除せず [`RANKINGS_CLEAR_ID_EMERGENCY.sql`](./RANKINGS_CLEAR_ID_EMERGENCY.sql) の読み取り専用確認を先に実行する。

Supabase の管理者接続情報はリポジトリに保存しない。SQL Editor を操作できない場合は「未適用」と記録し、適用済みとは報告しない。
