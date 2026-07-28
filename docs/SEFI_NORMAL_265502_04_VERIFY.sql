-- 読み取り専用。COMMIT後に、最古の1件だけが残ったことを確認する。
select id, created_at, clear_id
from public.rankings
where user_name = 'セフィ'
  and difficulty = 'Normal'
  and score = 265502
order by created_at asc nulls last, id;

select count(*) as remaining_count
from public.rankings
where user_name = 'セフィ'
  and difficulty = 'Normal'
  and score = 265502;
