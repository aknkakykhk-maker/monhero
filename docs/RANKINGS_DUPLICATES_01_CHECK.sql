-- 読み取り専用。結果を確認し、status が「中止」なら後続SQLを実行しない。
with expected(user_name, difficulty, score, expected_count) as (
  values
    ('セフィ'::text, 'Normal'::text, 265502::bigint, 12),
    ('あつ'::text,   'Master'::text, 11495811::bigint, 12),
    ('あつ'::text,   'Master'::text, 7023217::bigint, 6)
), actual as (
  select e.*, count(r.id)::integer as actual_count,
         count(r.id) filter (where r.created_at is null)::integer as null_created_at_count
  from expected e
  left join public.rankings r
    on r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score
  group by e.user_name, e.difficulty, e.score, e.expected_count
)
select user_name, difficulty, score, expected_count, actual_count,
       null_created_at_count,
       case
         when null_created_at_count > 0 then '中止: created_atがNULLです'
         when actual_count <> expected_count then '中止: 件数が期待値と異なります'
         else '成功: ROLLBACKへ進めます'
       end as status
from actual
order by user_name desc, score desc;

-- 対象30件。各グループ内で created_at、id の順に最古の1件を残す。
with targets as (
  select r.id, r.user_name, r.difficulty, r.score, r.clear_id, r.created_at,
         row_number() over (
           partition by r.user_name, r.difficulty, r.score
           order by r.created_at asc nulls last, r.id asc
         ) as row_number_in_group,
         count(*) over (partition by r.user_name, r.difficulty, r.score) as group_count
  from public.rankings r
  where (r.user_name, r.difficulty, r.score) in (
    ('セフィ', 'Normal', 265502),
    ('あつ', 'Master', 11495811),
    ('あつ', 'Master', 7023217)
  )
)
select id, user_name, difficulty, score, clear_id, created_at, group_count,
       case when row_number_in_group = 1 then '残す1件（最古）' else '削除対象' end as action
from targets
order by user_name desc, score desc, row_number_in_group;

-- VERIFY時との比較用。この3値をスクリーンショットまたはメモで保存する。
select count(*) as total_rankings_before,
       count(*) filter (where user_name in ('セフィ', 'あつ')) as named_users_rows_before,
       count(*) filter (
         where user_name in ('セフィ', 'あつ')
           and (user_name, difficulty, score) not in (
             ('セフィ', 'Normal', 265502),
             ('あつ', 'Master', 11495811),
             ('あつ', 'Master', 7023217)
           )
       ) as named_users_non_target_rows_before
from public.rankings;
