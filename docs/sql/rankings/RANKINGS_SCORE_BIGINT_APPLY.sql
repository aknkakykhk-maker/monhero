-- public.rankings.score を int4(integer) から bigint へ広げるSQL(実適用)。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。score の型が bigint になる。
--
-- ねらい: 45,054,226,345(約450億)のような int4 の上限(2,147,483,647)を超えるスコアを
--         保存できるようにする。int4 → int8 は値の幅を広げるだけなので、
--         既存の行は1件も書き換わらない(NULLもそのまま)。
--
-- 先に RANKINGS_SCORE_BIGINT_APPLY_TEST.sql が最後まで通っていることを確認してから実行する。
-- 検査に1つでも引っかかればトランザクションごと巻き戻るので、途中の状態は残らない。
begin;

-- 短時間だけ書き込みを止め、検査からDDLまでの間に行が増えないようにする
lock table public.rankings in share row exclusive mode;

-- ---- 適用前のひかえ ----
create temporary table rankings_score_before on commit drop as
select count(*) as row_count, max(score) as max_score, min(score) as min_score,
       sum(score)::numeric as sum_score, count(*) filter (where score is null) as null_score
from public.rankings;

create temporary table rankings_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table rankings_policies_before on commit drop as
select policyname, permissive, roles::text as roles, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table rankings_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

create temporary table rankings_indexes_before on commit drop as
select i.relname as index_name, pg_get_indexdef(i.oid) as definition
from pg_class t join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings';

-- ---- 型を広げる ----
do $$
declare
  current_type text;
  dependent_count integer;
begin
  -- score を使っているビュー・ルールがあると ALTER TYPE は失敗する。
  -- 勝手に消すと表示が壊れるので、ここでは止めるだけにする(定義はAUDITで控えてある)
  select count(*) into dependent_count
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class dependent on dependent.oid = r.ev_class
  join pg_class t on t.oid = d.refobjid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
  where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
    and dependent.relname <> 'rankings';
  if dependent_count > 0 then
    raise exception 'score列に依存するビュー/ルールが%件あります。先にその作り直し手順を決めてください', dependent_count;
  end if;

  select data_type into current_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'score';

  if current_type is null then
    raise exception 'public.rankings に score 列がありません';
  elsif current_type = 'bigint' then
    raise notice 'score はすでに bigint です。変更しません';
  elsif current_type in ('integer', 'smallint') then
    execute 'alter table public.rankings alter column score type bigint';
    raise notice 'score を % から bigint へ広げました', current_type;
  else
    raise exception 'score の型が想定外です(%)。手順を見直してください', current_type;
  end if;
end $$;

comment on column public.rankings.score is
  'ラン1回のスコア。難易度・WAVE・残りターンの倍率が乗って数百億になるため bigint。';

-- ---- 適用後の検査 ----
do $$
declare
  after_type text;
begin
  select data_type into after_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'score';
  if after_type <> 'bigint' then
    raise exception 'score が bigint になっていません(%)', after_type;
  end if;

  -- 行数・最大最小・合計・NULL件数が1つでも変わっていたらデータが壊れている
  if exists (
    (select * from rankings_score_before except
     select count(*), max(score), min(score), sum(score)::numeric,
            count(*) filter (where score is null) from public.rankings)
    union all
    (select count(*), max(score), min(score), sum(score)::numeric,
            count(*) filter (where score is null) from public.rankings
     except select * from rankings_score_before)
  ) then raise exception 'score の中身が適用前から変化しました'; end if;

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

  -- Indexは型変更で作り直されるが、同じ名前で同じ定義に戻っていること
  if exists (
    (select index_name, definition from rankings_indexes_before except
     select i.relname, pg_get_indexdef(i.oid)
     from pg_class t join pg_namespace n on n.oid = t.relnamespace
     join pg_index ix on ix.indrelid = t.oid
     join pg_class i on i.oid = ix.indexrelid
     where n.nspname = 'public' and t.relname = 'rankings')
    union all
    (select i.relname, pg_get_indexdef(i.oid)
     from pg_class t join pg_namespace n on n.oid = t.relnamespace
     join pg_index ix on ix.indrelid = t.oid
     join pg_class i on i.oid = ix.indexrelid
     where n.nspname = 'public' and t.relname = 'rankings'
     except select index_name, definition from rankings_indexes_before)
  ) then raise exception 'Indexの顔ぶれが適用前から変化しました'; end if;

  if exists (
    select 1 from pg_class t join pg_namespace n on n.oid = t.relnamespace
    join pg_index ix on ix.indrelid = t.oid
    where n.nspname = 'public' and t.relname = 'rankings'
      and not (ix.indisvalid and ix.indisready)
  ) then raise exception '使えない状態のIndexが残っています'; end if;
end $$;

-- 結果表示: 型とIndexの状態
select column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings' and column_name = 'score';

select i.relname as index_name, ix.indisunique as is_unique,
       ix.indisvalid as is_valid, ix.indisready as is_ready
from pg_class t join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
order by i.relname;

-- ここまで1つも例外が出ていなければ確定する。
commit;
