-- 読み取り専用。12件すべてを古い順に表示する。
with numbered as (
  select id, created_at, clear_id,
         row_number() over (order by created_at asc nulls last, id) as n
  from public.rankings
  where user_name = 'セフィ'
    and difficulty = 'Normal'
    and score = 265502
)
select id, created_at, clear_id,
       case when n = 1 then '残す（最古）' else '削除対象' end as action
from numbered
order by n;
