-- public.rankings.score を bigint へ広げたあとの状態を確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。
--
-- 期待する結果:
--   V-1 score の data_type が bigint(udt_name が int8)
--   V-2 件数がAUDITのときと同じで、21億超の行も入れられる状態になっている
--   V-3 score に関わるIndexが is_valid = true / is_ready = true
--   V-4 RLS・ポリシー・Data API権限がAUDITのときと同じ
--   V-5 score に依存するビュー/ルールが増えていない(0行のまま)

-- V-1. score の型
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings' and column_name = 'score';

-- V-2. 件数と最大スコア。AUDIT(A-2)の結果と見比べる。
--   件数・最大値が同じであること。over_int4_rows はこれから増えていく(増えてよい)
select count(*) as row_count,
       max(score) as max_score,
       count(*) filter (where score > 2147483647) as over_int4_rows
from public.rankings;

-- V-3. score に関わるIndexの状態(型変更で作り直されるので、使える状態か確かめる)
select i.relname as index_name, ix.indisunique as is_unique,
       ix.indisvalid as is_valid, ix.indisready as is_ready,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
order by i.relname;

-- V-4. RLS・ポリシー・Data API権限
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies
where schemaname = 'public' and tablename = 'rankings'
order by policyname;

select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- V-5. score に依存するビュー/ルール(0行が期待値)
select distinct dependent.relname as dependent_name,
       case dependent.relkind when 'v' then 'VIEW' when 'm' then 'MATERIALIZED VIEW'
            else dependent.relkind::text end as dependent_kind
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dependent on dependent.oid = r.ev_class
join pg_class t on t.oid = d.refobjid
join pg_namespace n on n.oid = t.relnamespace
join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
  and dependent.relname <> 'rankings'
order by dependent_name;
