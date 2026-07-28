-- public.rankings へ clear_id とUNIQUEインデックスを安全確認後に適用するSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。

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

-- 安全確認済みの変更を本番へ保存する。
commit;
