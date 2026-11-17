# モンサク・ランキング v5(技の表示用詳細)の適用手順

対象: `MONSUC_RANK_V5_TECH_DETAIL.sql`(リポジトリの `supabase/migrations/202611170001_monsuc_rank_v5_tech_detail.sql` と同じ内容)
目的: ランキング詳細で技の名前と熟練まで出すために、表示専用の列 `tech_detail` を足す。**本番 Supabase への適用はこの手順書で人が行う**(自動では適用しない)。

## 前提

- v4 まで(`MONSUC_RANK_APPLY.sql` → `MONSUC_RANK_V2_TECHS.sql` → `MONSUC_RANK_V3_POWER.sql` → `MONSUC_RANK_V4_CAPUP.sql`)が適用済みであること。
- 端末(クライアント)の公開とは前後してよい。先に端末が出ても壊れない作り:
  - 送る分: 未適用のサーバは `tech_detail` を知らない項目として捨てるだけ(登録は今までどおり通る。ただしその登録には技の名前・熟練は残らない)。
  - 読む分: 見え方に `tech_detail` 等が無い間、端末は今までの列だけで読み直し、詳細は段1表示(技の名前・熟練なし)になる。

## 手順

1. Supabase のダッシュボードで対象プロジェクトを開き、SQL Editor で新しいクエリを作る。
2. `MONSUC_RANK_V5_TECH_DETAIL.sql` の全文を貼って実行する。エラーなく終われば適用完了(何度流しても同じ結果になる)。
3. 下の「適用後の確かめ」を実行して、期待どおりか見る。

## 適用後の確かめ(読むだけ・何も書かない)

```sql
-- 列が足されている(1行返る)
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'monsuc_finishes' and column_name = 'tech_detail';

-- 見え方に詳細の列が出る(空でも通る)
select run_id, loyal, pop, techs, tech_detail from public.monsuc_rank_all limit 1;
select run_id, loyal, pop, techs, tech_detail from public.monsuc_rank_lineage limit 1;

-- 既存の登録は tech_detail が空のまま(書き換えていないこと)
select count(*) as total, count(tech_detail) as with_detail from public.monsuc_finishes;
```

## 動作の確認(適用後)

1. 新しい端末で育成を1件終えて引退し、ランキングに登録する。
2. ランキングでその行を押すと、詳細に技グリッドと熟練が出る。
3. 適用より前に登録された行は、今までどおり詳細が開き、技は習得技数と内訳(ランク・適性)まで出る(技の名前・熟練は出ない。これは仕様)。

## 戻し方

- 列 `tech_detail` は足しただけなので、戻す必要は基本ない(残っていても、古い端末・古い関数は読み書きしない)。
- どうしても戻す場合: 見え方を v3 の定義に戻し、`monsuc_rank_submit` を v4 の定義に戻してから、列を消す。行や既存の列には触らないこと。
