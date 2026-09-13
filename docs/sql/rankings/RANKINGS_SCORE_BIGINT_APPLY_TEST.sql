-- public.rankings.score を int4(integer) から bigint へ広げる変更を「試すだけ」のSQL。
-- 読み取り専用: いいえ（トランザクション内でDDLを試す）。
-- 本番変更が残るか: いいえ。最後に必ずrollbackする。
--
-- ねらい: 45,054,226,345(約450億)のような int4 の上限(2,147,483,647)を超えるスコアを
--         保存できるようにする。int4 → int8 は値の幅を広げるだけなので、
--         既存の行は1件も書き換わらない(NULLもそのまま)。
--
-- モンビー(モンヒロビート)の集計ビューが rankings.score にぶら下がっている。
--   rhythm_scores → rhythm_identity_map / rhythm_identified_scores
--                 → rhythm_song_bests → rhythm_total_rankings
-- ビューがあると ALTER TYPE は
--   「cannot alter type of a column used by a view or rule」
-- で失敗するので、いったん落として型を広げ、元どおり作り直す。
-- 作り直しは「いま動いているビューの定義(pg_get_viewdef)」をそのまま使うので、
-- リポジトリのSQLと本番の食い違いがあっても、本番の姿がそのまま戻る。
-- 所有者・コメント・with(security_invoker)・権限も控えて戻し、
-- 1つでも違っていたら例外でトランザクションごと巻き戻す。
begin;

-- 短時間だけ書き込みを止め、検査からDDLまでの間に行が増えないようにする
lock table public.rankings in share row exclusive mode;

-- ---- 適用前のひかえ(データ) ----
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

-- ---- 適用前のひかえ(score にぶら下がるビュー) ----
-- score を直接見ているビューと、そのビューを見ているビューを、深さつきで集める。
-- depth が大きいほど「上」にあるので、落とすときは深いほうから、作り直すときは浅いほうから。
create temporary table rankings_view_backup on commit drop as
with recursive deps as (
  select distinct v.oid as view_oid, 1 as depth
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class v on v.oid = r.ev_class
  join pg_class t on t.oid = d.refobjid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
  where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
    and v.relkind in ('v', 'm') and v.oid <> t.oid
  union all
  select distinct v2.oid, deps.depth + 1
  from deps
  join pg_depend d2 on d2.refobjid = deps.view_oid
  join pg_rewrite r2 on r2.oid = d2.objid
  join pg_class v2 on v2.oid = r2.ev_class
  where v2.relkind in ('v', 'm') and v2.oid <> deps.view_oid and deps.depth < 20
)
select grouped.view_oid, grouped.depth,
       n.nspname as schema_name, c.relname as view_name, c.relkind as view_kind,
       pg_get_viewdef(c.oid, true) as definition,
       array_to_string(c.reloptions, ', ') as reloptions,
       pg_get_userbyid(c.relowner) as view_owner,
       obj_description(c.oid, 'pg_class') as view_comment
from (select view_oid, max(depth) as depth from deps group by view_oid) grouped
join pg_class c on c.oid = grouped.view_oid
join pg_namespace n on n.oid = c.relnamespace;

create temporary table rankings_view_grants_before on commit drop as
select b.view_name,
       case when acl.grantee = 0 then 'public' else pg_get_userbyid(acl.grantee) end as grantee_name,
       acl.privilege_type, acl.is_grantable
from rankings_view_backup b
join pg_class c on c.oid = b.view_oid
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl;

-- 控えた内容を目で見えるように出す(落とす前の姿)
select depth, schema_name, view_name, view_kind, reloptions, view_owner
from rankings_view_backup order by depth desc, view_name;

-- ---- ビューを落とす(深いほうから) ----
do $$
declare
  v record;
begin
  if exists (select 1 from rankings_view_backup where view_kind = 'm') then
    raise exception 'マテリアライズドビューが混ざっています。作り直しに中身の再作成が要るので、手順を別に決めてください';
  end if;
  for v in select * from rankings_view_backup order by depth desc, view_name loop
    execute format('drop view if exists %I.%I', v.schema_name, v.view_name);
    raise notice 'ビューを落としました: %.% (depth=%)', v.schema_name, v.view_name, v.depth;
  end loop;
end $$;

-- ---- 型を広げる ----
do $$
declare
  current_type text;
  blocking_count integer;
begin
  select count(*) into blocking_count
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class dependent on dependent.oid = r.ev_class
  join pg_class t on t.oid = d.refobjid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
  where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
    and dependent.relname <> 'rankings';
  if blocking_count > 0 then
    raise exception 'score列にまだ%件の依存が残っています。落としきれていません', blocking_count;
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

-- ---- ビューを元どおり作り直す(浅いほうから) ----
do $$
declare
  v record;
  g record;
begin
  for v in select * from rankings_view_backup order by depth asc, view_name loop
    if coalesce(v.reloptions, '') = '' then
      execute format('create view %I.%I as %s', v.schema_name, v.view_name, v.definition);
    else
      execute format('create view %I.%I with (%s) as %s',
                     v.schema_name, v.view_name, v.reloptions, v.definition);
    end if;
    execute format('alter view %I.%I owner to %I', v.schema_name, v.view_name, v.view_owner);
    if v.view_comment is not null then
      execute format('comment on view %I.%I is %L', v.schema_name, v.view_name, v.view_comment);
    end if;
    raise notice 'ビューを戻しました: %.% (depth=%)', v.schema_name, v.view_name, v.depth;
  end loop;

  for g in select * from rankings_view_grants_before loop
    execute format('grant %s on public.%I to %s%s',
                   g.privilege_type, g.view_name,
                   case when g.grantee_name = 'public' then 'public' else quote_ident(g.grantee_name) end,
                   case when g.is_grantable then ' with grant option' else '' end);
  end loop;
end $$;

-- ---- 適用後の検査 ----
-- 450億が入るか試した結果を、最後のまとめ表で出せるように控えておく
create temporary table score_bigint_probe_result(result text) on commit drop;

do $$
declare
  after_type text;
  v record;
  probe bigint;
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

  -- ビューが全部戻っていて、定義・with・所有者・コメントも同じであること
  for v in select * from rankings_view_backup loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = v.schema_name and c.relname = v.view_name and c.relkind = v.view_kind
    ) then raise exception 'ビュー %.% が戻っていません', v.schema_name, v.view_name; end if;

    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = v.schema_name and c.relname = v.view_name
        and (pg_get_viewdef(c.oid, true) is distinct from v.definition
          or coalesce(array_to_string(c.reloptions, ', '), '') is distinct from coalesce(v.reloptions, '')
          or pg_get_userbyid(c.relowner) is distinct from v.view_owner
          or obj_description(c.oid, 'pg_class') is distinct from v.view_comment)
    ) then raise exception 'ビュー %.% の定義・with・所有者・コメントのどれかが元と違います', v.schema_name, v.view_name; end if;

    -- 実際に引けるか(定義が通っても権限や参照先で落ちることがある)
    execute format('select count(*) from %I.%I', v.schema_name, v.view_name);
  end loop;

  if exists (
    (select * from rankings_view_grants_before except
     select b.view_name,
            case when acl.grantee = 0 then 'public' else pg_get_userbyid(acl.grantee) end,
            acl.privilege_type, acl.is_grantable
     from rankings_view_backup b
     join pg_class c on c.relname = b.view_name
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = b.schema_name
     cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl)
    union all
    (select b.view_name,
            case when acl.grantee = 0 then 'public' else pg_get_userbyid(acl.grantee) end,
            acl.privilege_type, acl.is_grantable
     from rankings_view_backup b
     join pg_class c on c.relname = b.view_name
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = b.schema_name
     cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
     except select * from rankings_view_grants_before)
  ) then raise exception 'ビューの権限が元と違います'; end if;

  -- 21億を超えるスコアが本当に入るか、この中だけで試す(rollbackするので残らない)
  insert into public.rankings (difficulty, user_name, hero, score, clear_id)
  values ('Normal', '__score_bigint_probe__', 'probe', 45054226345,
          'score-bigint-probe-' || clock_timestamp()::text)
  returning score into probe;
  if probe <> 45054226345 then
    raise exception '450億のスコアを保存できませんでした';
  end if;
  delete from public.rankings where user_name = '__score_bigint_probe__';
  insert into score_bigint_probe_result values ('できた(この行は取り消します)');
  raise notice '450億のスコアを保存できることを確認しました(この行は取り消します)';
end $$;

-- 結果表示: 最後に「これ1枚で分かる」まとめを出す。
-- Supabase の SQL Editor は最後のSQLの結果しか画面に出さないので、ここを1枚にしておく。
select *
from (
  values
    (1, 'score の型(この試験の中)',
        coalesce((select data_type from information_schema.columns
                   where table_schema = 'public' and table_name = 'rankings' and column_name = 'score'), '(なし)')),
    (2, '落としたビュー',
        (select count(*)::text || ' 枚' from rankings_view_backup)),
    (3, '戻ったビュー',
        (select count(*)::text || ' 枚' from rankings_view_backup b
          where exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = b.schema_name and c.relname = b.view_name))),
    (4, '450億のスコアの保存',
        (select coalesce(max(result), '(試していません)') from score_bigint_probe_result)),
    (5, '記録の件数(変わっていないこと)',
        (select count(*)::text from public.rankings)),
    (6, '使えないIndex',
        (select count(*)::text || ' 本' from pg_class t join pg_namespace n on n.oid = t.relnamespace
          join pg_index ix on ix.indrelid = t.oid
          where n.nspname = 'public' and t.relname = 'rankings' and not (ix.indisvalid and ix.indisready))),
    (7, '→ どうするか',
        case when (select data_type from information_schema.columns
                    where table_schema = 'public' and table_name = 'rankings' and column_name = 'score') = 'bigint'
              and (select count(*) from rankings_view_backup) =
                  (select count(*) from rankings_view_backup b
                    where exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                   where n.nspname = b.schema_name and c.relname = b.view_name))
             then '試験は成功。この変更は取り消されます。RANKINGS_SCORE_BIGINT_APPLY.sql へ進んでください'
             else 'うまくいっていません。結果を共有してください' end)
) as t(番号, 確認項目, 結果)
order by 番号;

-- 試験結果を本番へ残さない。
rollback;
