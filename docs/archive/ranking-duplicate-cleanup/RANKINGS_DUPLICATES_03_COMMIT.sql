-- ROLLBACK試験とCHECK再実行が成功した場合だけ実行する。
begin;
lock table public.rankings in share row exclusive mode;

create temporary table duplicate_expected on commit drop as
select * from (values
  ('セフィ'::text, 'Normal'::text, 265502::bigint, 12, 11),
  ('あつ'::text,   'Master'::text, 11495811::bigint, 12, 11),
  ('あつ'::text,   'Master'::text, 7023217::bigint, 6, 5)
) as v(user_name, difficulty, score, expected_before, expected_delete);

-- COMMITまで保持する一時バックアップ。IDと二重限定に必要な列も保存する。
create temporary table duplicate_delete_targets on commit drop as
with numbered as (
  select r.id, r.user_name, r.difficulty, r.score, r.clear_id, r.created_at,
         row_number() over (
           partition by r.user_name, r.difficulty, r.score
           order by r.created_at asc nulls last, r.id asc
         ) as n
  from public.rankings r
  join duplicate_expected e
    on r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score
)
select id, user_name, difficulty, score, clear_id, created_at
from numbered where n > 1;

do $$
declare bad record;
begin
  select e.user_name, e.difficulty, e.score,
         count(r.id) as actual_before,
         count(r.id) filter (where r.created_at is null) as null_dates,
         count(t.id) as targets
    into bad
  from duplicate_expected e
  left join public.rankings r
    on r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score
  left join duplicate_delete_targets t on t.id = r.id
  group by e.user_name, e.difficulty, e.score, e.expected_before, e.expected_delete
  having count(r.id) <> e.expected_before
      or count(r.id) filter (where r.created_at is null) <> 0
      or count(t.id) <> e.expected_delete
  limit 1;
  if found then
    raise exception '中止: %, %, % は削除前=%件、NULL=%件、削除候補=%件です',
      bad.user_name, bad.difficulty, bad.score,
      bad.actual_before, bad.null_dates, bad.targets;
  end if;
end $$;

create temporary table duplicate_deleted_rows on commit drop as
with deleted as (
  delete from public.rankings r using duplicate_delete_targets t
  where r.id = t.id
    and r.user_name = t.user_name
    and r.difficulty = t.difficulty
    and r.score = t.score
  returning r.id, r.user_name, r.difficulty, r.score, r.clear_id, r.created_at
)
select * from deleted;

do $$
declare bad record; total_deleted integer;
begin
  select count(*) into total_deleted from duplicate_deleted_rows;
  if total_deleted <> 27 then
    raise exception '中止: 実削除は%件です（期待値27件）', total_deleted;
  end if;

  select e.user_name, e.difficulty, e.score,
         count(d.id) as deleted_count,
         (select count(*) from public.rankings r
           where r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score) as remaining_count
    into bad
  from duplicate_expected e
  left join duplicate_deleted_rows d
    on d.user_name = e.user_name and d.difficulty = e.difficulty and d.score = e.score
  group by e.user_name, e.difficulty, e.score, e.expected_delete
  having count(d.id) <> e.expected_delete
      or (select count(*) from public.rankings r
           where r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score) <> 1
  limit 1;
  if found then
    raise exception '中止: %, %, % は削除=%件、残存=%件です',
      bad.user_name, bad.difficulty, bad.score, bad.deleted_count, bad.remaining_count;
  end if;
  raise notice '成功: 11件、11件、5件（合計27件）を削除し、各1件を残しました';
end $$;

-- commit直前の最終成功表示。
select e.user_name, e.difficulty, e.score, e.expected_delete as deleted_count,
       count(r.id) as remaining_count, '成功: COMMIT可能' as status
from duplicate_expected e
left join public.rankings r
  on r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score
group by e.user_name, e.difficulty, e.score, e.expected_delete
order by e.user_name desc, e.score desc;

commit;
