-- あつ / Master の指定2スコアだけを整理する本番COMMIT版。
begin;
lock table public.rankings in share row exclusive mode;

create temporary table master_atsu_duplicate_expected on commit drop as
select * from (values
  ('あつ'::text, 'Master'::text, 11495811::bigint, 12, 11),
  ('あつ'::text, 'Master'::text, 7023217::bigint, 6, 5)
) as v(user_name, difficulty, score, expected_before, expected_delete);

-- created_at ASC, id ASCで各グループの最古1件を除いたIDを固定する。
create temporary table master_atsu_duplicate_delete_targets on commit drop as
with numbered as (
  select r.id, r.user_name, r.difficulty, r.score, r.created_at,
         row_number() over (
           partition by r.user_name, r.difficulty, r.score
           order by r.created_at asc, r.id asc
         ) as row_number_in_group
  from public.rankings r
  join master_atsu_duplicate_expected e
    on r.user_name = e.user_name
   and r.difficulty = e.difficulty
   and r.score = e.score
)
select id, user_name, difficulty, score, created_at
from numbered
where row_number_in_group > 1;

do $$
declare bad record;
begin
  select e.user_name, e.difficulty, e.score,
         count(r.id) as actual_before,
         count(r.id) filter (where r.created_at is null) as null_created_at,
         count(t.id) as delete_targets
    into bad
  from master_atsu_duplicate_expected e
  left join public.rankings r
    on r.user_name = e.user_name
   and r.difficulty = e.difficulty
   and r.score = e.score
  left join master_atsu_duplicate_delete_targets t on t.id = r.id
  group by e.user_name, e.difficulty, e.score,
           e.expected_before, e.expected_delete
  having count(r.id) <> e.expected_before
      or count(r.id) filter (where r.created_at is null) <> 0
      or count(t.id) <> e.expected_delete
  limit 1;

  if found then
    raise exception '中止: %, %, % は削除前=%件、created_at NULL=%件、削除候補=%件です',
      bad.user_name, bad.difficulty, bad.score,
      bad.actual_before, bad.null_created_at, bad.delete_targets;
  end if;
end $$;

create temporary table master_atsu_duplicate_deleted_rows on commit drop as
with deleted as (
  delete from public.rankings r
  using master_atsu_duplicate_delete_targets t
  where r.id = t.id
    and r.user_name = t.user_name
    and r.difficulty = t.difficulty
    and r.score = t.score
  returning r.id, r.user_name, r.difficulty, r.score, r.created_at
)
select * from deleted;

do $$
declare bad record;
declare total_deleted integer;
begin
  select count(*) into total_deleted
  from master_atsu_duplicate_deleted_rows;

  if total_deleted <> 16 then
    raise exception '中止: 合計削除件数は%件です（期待値16件）', total_deleted;
  end if;

  select e.user_name, e.difficulty, e.score,
         count(d.id) as deleted_count,
         (select count(*)
            from public.rankings r
           where r.user_name = e.user_name
             and r.difficulty = e.difficulty
             and r.score = e.score) as remaining_count
    into bad
  from master_atsu_duplicate_expected e
  left join master_atsu_duplicate_deleted_rows d
    on d.user_name = e.user_name
   and d.difficulty = e.difficulty
   and d.score = e.score
  group by e.user_name, e.difficulty, e.score, e.expected_delete
  having count(d.id) <> e.expected_delete
      or (select count(*)
            from public.rankings r
           where r.user_name = e.user_name
             and r.difficulty = e.difficulty
             and r.score = e.score) <> 1
  limit 1;

  if found then
    raise exception '中止: %, %, % は削除=%件、残存=%件です',
      bad.user_name, bad.difficulty, bad.score,
      bad.deleted_count, bad.remaining_count;
  end if;

  raise notice '成功: 11件と5件（合計16件）を削除し、各グループに1件ずつ残しました';
end $$;

-- 成功時に削除した16件を表示する。commitを必ず最終文にする。
select id, score, created_at
from master_atsu_duplicate_deleted_rows
order by score desc, created_at asc, id asc;

commit;
