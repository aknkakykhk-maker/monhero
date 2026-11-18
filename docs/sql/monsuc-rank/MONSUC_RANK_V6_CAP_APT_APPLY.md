# モンサク・ランキング v6(上限・適性の表示用詳細)の適用手順

対象: `MONSUC_RANK_V6_CAP_APT.sql`(リポジトリの `supabase/migrations/202611180001_monsuc_rank_v6_cap_apt.sql` と同じ内容)
目的: ランキング詳細で、その育成で実際に効いていた能力の上限と実際の間合い適性を出すために、表示専用の列 `cap_detail`(6能力の上限)と `apt_detail`(適性4間合い)を足す。**本番 Supabase への適用はこの手順書で人が行う**(自動では適用しない)。

## 前提

- v5 まで(`MONSUC_RANK_APPLY.sql` → `MONSUC_RANK_V2_TECHS.sql` → `MONSUC_RANK_V3_POWER.sql` → `MONSUC_RANK_V4_CAPUP.sql` → `MONSUC_RANK_V5_TECH_DETAIL.sql`)が適用済みであること。
  - **本番がまだ v5 未適用なら、先に v5(`MONSUC_RANK_V5_TECH_DETAIL.sql`)を流してから、この v6 を流す**。v6 の送信の関数は v5 の `tech_detail` 対応を含んだ上書きなので、v6 を先に流すと `tech_detail` の列が無く送信が失敗する。
- 端末(クライアント)の公開とは前後してよい。先に端末が出ても壊れない作り:
  - 送る分: 未適用のサーバは `cap_detail`・`apt_detail` を知らない項目として捨てるだけ(登録は今までどおり通る。ただしその登録には上限・適性は残らない)。
  - 読む分: 見え方に `cap_detail`・`apt_detail` が無い間、端末は v5 の列(技の表示用詳細まで)で読み直し、それも無い間は今までの列で読み直す。詳細の上限は目安表示・適性は種類の素になる。

## 手順

1. Supabase のダッシュボードで対象プロジェクトを開き、SQL Editor で新しいクエリを作る。
2. (v5 未適用なら)`MONSUC_RANK_V5_TECH_DETAIL.sql` の全文を貼って実行する。
3. `MONSUC_RANK_V6_CAP_APT.sql` の全文を貼って実行する。エラーなく終われば適用完了(何度流しても同じ結果になる)。
4. 下の「適用後の確かめ」を実行して、期待どおりか見る。

## 適用後の確かめ(読むだけ・何も書かない)

```sql
-- 列が足されている(2行返る)
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'monsuc_finishes' and column_name in ('cap_detail', 'apt_detail');

-- 見え方に詳細の列が出る(空でも通る)
select run_id, loyal, pop, techs, tech_detail, cap_detail, apt_detail from public.monsuc_rank_all limit 1;
select run_id, loyal, pop, techs, tech_detail, cap_detail, apt_detail from public.monsuc_rank_lineage limit 1;

-- 既存の登録は cap_detail・apt_detail が空のまま(書き換えていないこと)
select count(*) as total, count(cap_detail) as with_cap, count(apt_detail) as with_apt from public.monsuc_finishes;
```

## 動作の確認(適用後)

1. 新しい端末で育成を1件終えて引退し、ランキングに登録する。
2. ランキングでその行を押すと、詳細の能力に実際の上限(/○○○○)、間合い適性に実際の適性が出る。
3. 適用より前に登録された行は、今までどおり詳細が開き、上限は目安表示・適性は種類の素の適性になる(育成情報にその旨が出る。これは仕様で、過去の登録は元のデータが無いため遡れない)。

## 戻し方

- 列 `cap_detail`・`apt_detail` は足しただけなので、戻す必要は基本ない(残っていても、古い端末・古い関数は読み書きしない)。
- どうしても戻す場合: 見え方を v5 の定義に戻し、`monsuc_rank_submit` を v5 の定義に戻してから、列を消す。行や既存の列には触らないこと。
