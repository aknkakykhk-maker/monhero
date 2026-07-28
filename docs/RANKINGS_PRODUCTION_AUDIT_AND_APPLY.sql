-- public.rankings の本番調査と clear_id UNIQUE の安全な適用手順。
-- セクションAは読み取り専用。セクションBは既定でROLLBACKする。
-- DROP TABLE、テーブル再作成、RLS/policy/GRANTの変更は行わない。

-- ===========================================================================
-- A. 読み取り専用の現況調査
-- ===========================================================================

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

-- A-5. SELECT / INSERT / UPDATE / DELETE / ALL ポリシー
select policyname, permissive, roles, cmd, qual as using_expression,
       with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'rankings'
order by case cmd when 'SELECT' then 1 when 'INSERT' then 2
                      when 'UPDATE' then 3 when 'DELETE' then 4 else 5 end,
         policyname;

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

-- A-8. clear_idが既に存在する場合だけ実行する。
-- select clear_id, count(*) as row_count,
--        array_agg(id order by created_at nulls last, id) as ids
-- from public.rankings
-- where clear_id is not null
-- group by clear_id
-- having count(*) > 1
-- order by row_count desc, clear_id;

-- ===========================================================================
-- 既存重複の削除
-- ===========================================================================
-- 3列一致を一括削除すると正当な同点も消すため、このファイルでは自動DELETEしない。
-- A-7の結果を確認し、事故と確定したIDだけを
-- docs/MASTER_RANKING_INCIDENT_AUDIT.sql の件数ガード付き手順で先に削除する。

-- ===========================================================================
-- B. clear_id方式の適用（既定はROLLBACK）
-- ===========================================================================
begin;

-- 短時間だけDDLと競合する書き込みを止め、検査からIndex作成までの競合を防ぐ。
lock table public.rankings in share row exclusive mode;

-- RLS、policy、anon/authenticated権限の適用前スナップショット。
create temporary table rankings_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table rankings_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table rankings_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

alter table public.rankings add column if not exists clear_id text;

-- 既にclear_id付き行がある環境では、同一ID重複を削除せず安全側で停止する。
do $$
begin
  if exists (
    select 1 from public.rankings
    where clear_id is not null
    group by clear_id having count(*) > 1
  ) then
    raise exception 'clear_idの重複があります。対象を確認・削除してから再実行してください';
  end if;
end $$;

create unique index if not exists rankings_clear_id_unique
  on public.rankings (clear_id);

comment on column public.rankings.clear_id is
  'クライアントが周回開始時に生成する一意なクリアID。同一クリアの再送防止用。';

-- セキュリティ状態が一切変わっていないことを集合差で検査する。
do $$
begin
  if exists (
    (select * from rankings_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from rankings_security_before)
  ) then raise exception 'RLS状態が適用前から変化しました'; end if;

  if exists (
    (select * from rankings_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from rankings_policies_before)
  ) then raise exception 'RLSポリシーが適用前から変化しました'; end if;

  if exists (
    (select * from rankings_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from rankings_grants_before)
  ) then raise exception 'Data API roleの権限が適用前から変化しました'; end if;
end $$;

-- Indexが妥当か確認する。
select i.relname as index_name, ix.indisunique, ix.indisvalid, ix.indisready,
       pg_get_indexdef(i.oid) as definition
from pg_class t join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
  and i.relname = 'rankings_clear_id_unique';

-- 初回は必ずこのまま。確認後の実適用時だけrollbackをコメント化しcommitを有効化する。
-- commit;
rollback;

-- ===========================================================================
-- C. COMMIT後の確認（読み取り専用）
-- ===========================================================================
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
  and column_name = 'clear_id';

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'rankings'
  and indexname = 'rankings_clear_id_unique';

-- A-4〜A-6も再実行し、RLS・policy・権限が保存結果と一致することを確認する。
-- 最後に実ゲーム相当のanon Data APIでSELECT/INSERTを実施する。
