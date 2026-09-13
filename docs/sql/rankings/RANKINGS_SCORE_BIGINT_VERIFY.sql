-- public.rankings.score を bigint へ広げたあとの状態を確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。
--
-- 期待する結果:
--   V-1 score の data_type が bigint(udt_name が int8)
--   V-2 件数がAUDITのときと同じで、21億超の行も入れられる状態になっている
--   V-3 score に関わるIndexが is_valid = true / is_ready = true
--   V-4 RLS・ポリシー・Data API権限がAUDITのときと同じ
--   V-5 score にぶら下がるビューが、AUDIT(A-3)と同じ顔ぶれで戻っている
--   V-6 そのビューが実際に引ける(モンビーの集計が動く)

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

-- V-5. score にぶら下がるビュー。落として作り直しているので、
--   AUDIT(A-3)と同じ顔ぶれが並ぶのが期待値(0行ではない)。
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

-- V-6. score にぶら下がるビューを、上に乗っているものまでたどって実際に引いてみる。
--   定義が戻っていても、権限や参照先で落ちることがある。
--   モンビーの集計(rhythm_scores → … → rhythm_total_rankings)がここで通れば、
--   ゲーム側の曲別ランキングと全曲合算ランキングも動く。
do $$
declare
  v record;
  n bigint;
begin
  for v in
    with recursive deps as (
      select distinct dependent.oid as view_oid, 1 as depth
      from pg_depend d
      join pg_rewrite r on r.oid = d.objid
      join pg_class dependent on dependent.oid = r.ev_class
      join pg_class t on t.oid = d.refobjid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
      where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
        and dependent.relkind in ('v', 'm') and dependent.oid <> t.oid
      union all
      select distinct v2.oid, deps.depth + 1
      from deps
      join pg_depend d2 on d2.refobjid = deps.view_oid
      join pg_rewrite r2 on r2.oid = d2.objid
      join pg_class v2 on v2.oid = r2.ev_class
      where v2.relkind in ('v', 'm') and v2.oid <> deps.view_oid and deps.depth < 20
    )
    select grouped.depth, n.nspname as schema_name, c.relname as view_name
    from (select view_oid, max(depth) as depth from deps group by view_oid) grouped
    join pg_class c on c.oid = grouped.view_oid
    join pg_namespace n on n.oid = c.relnamespace
    order by grouped.depth, c.relname
  loop
    execute format('select count(*) from %I.%I', v.schema_name, v.view_name) into n;
    raise notice 'ビュー %.% は引けます(%行, depth=%)', v.schema_name, v.view_name, n, v.depth;
  end loop;
end $$;
