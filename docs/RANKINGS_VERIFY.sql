-- public.rankings への clear_id 適用結果とセキュリティ・件数を確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。

-- clear_idの存在、型、NULL許容状態
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
  and column_name = 'clear_id';

-- 対象IndexのUNIQUE、VALID、READY状態
select i.relname as index_name, ix.indisunique as is_unique,
       ix.indisvalid as is_valid, ix.indisready as is_ready,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
  and i.relname = 'rankings_clear_id_unique';

-- RLS状態
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

-- ポリシー
select policyname, permissive, roles, cmd, qual as using_expression,
       with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'rankings'
order by cmd, policyname;

-- Data APIで使用されるroleのテーブル権限
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 既存総件数
select count(*) as total_rows from public.rankings;

-- 非NULLのclear_id重複（成功時は0行）
select clear_id, count(*) as row_count,
       array_agg(id order by created_at nulls last, id) as ids
from public.rankings
where clear_id is not null
group by clear_id
having count(*) > 1
order by row_count desc, clear_id;
