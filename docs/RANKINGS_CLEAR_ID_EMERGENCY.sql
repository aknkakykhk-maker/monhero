-- clear_id適用後の緊急時確認。最初のセクションは読み取り専用。
-- 既存ランキングをDELETEせず、rankingsテーブルをDROPしない。

-- 1. 現況確認
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
  and column_name = 'clear_id';

select i.relname as index_name, ix.indisunique, ix.indisvalid, ix.indisready,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
  and i.relname = 'rankings_clear_id_unique';

select clear_id, count(*) as row_count
from public.rankings
where clear_id is not null
group by clear_id
having count(*) > 1
order by row_count desc, clear_id;

-- 2. UNIQUEインデックスが欠落しており、上の重複確認が0行の場合だけ実行する。
--    既存データは変更しない。重複が1行でも表示された場合は実行せず停止する。
-- begin;
-- lock table public.rankings in share row exclusive mode;
-- create unique index rankings_clear_id_unique on public.rankings (clear_id);
-- commit;

-- 3. ロールバックについて
-- インデックスを外すと再送の二重登録が再発するため、自動ロールバックSQLは用意しない。
-- 障害時はまず公開クライアントのランキングPOSTを止め、上の結果を保存して調査する。
-- clear_idカラムや既存行は削除しない。
