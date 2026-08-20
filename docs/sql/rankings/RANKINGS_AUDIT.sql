-- public.rankings の現在の構成・セキュリティ・重複候補を確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。

-- A-1. カラム構成
select ordinal_position, column_name, data_type, udt_name, is_nullable,
       column_default, is_identity, identity_generation, is_generated,
       generation_expression
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
order by ordinal_position;

-- A-2. Primary Key / Unique / その他の制約
select c.conname as constraint_name,
       case c.contype
         when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
         when 'f' then 'FOREIGN KEY' when 'c' then 'CHECK'
         when 'x' then 'EXCLUDE' else c.contype::text
       end as constraint_type,
       pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'rankings'
order by constraint_type, constraint_name;

-- A-3. 全Index（制約由来か、UNIQUEか、妥当な状態かも表示）
select i.relname as index_name, ix.indisprimary as is_primary,
       ix.indisunique as is_unique, ix.indisvalid as is_valid,
       ix.indisready as is_ready,
       con.conname as backing_constraint,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
left join pg_constraint con on con.conindid = i.oid
where n.nspname = 'public' and t.relname = 'rankings'
order by ix.indisprimary desc, ix.indisunique desc, i.relname;

-- A-4. RLS状態
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

-- A-5. 全コマンド種別のポリシー
select policyname, permissive, roles, cmd, qual as using_expression,
       with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'rankings'
order by cmd, policyname;

-- A-6. Data APIで使用されるroleのテーブル権限
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- A-7. 3列完全一致の候補。これだけでは事故か正当な同点か判定できない。
select user_name, difficulty, score, count(*) as row_count,
       array_agg(id order by created_at nulls last, id) as ids
from public.rankings
group by user_name, difficulty, score
having count(*) > 1
order by row_count desc, difficulty, user_name, score desc;
