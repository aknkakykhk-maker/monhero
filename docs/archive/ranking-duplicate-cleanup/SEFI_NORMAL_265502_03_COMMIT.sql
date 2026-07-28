-- ROLLBACK試験が成功した場合だけ実行する。本番削除を確定する。
begin;
lock table public.rankings in share row exclusive mode;

create temporary table sefi_delete_targets on commit drop as
with numbered as (
  select id, created_at, clear_id,
         row_number() over (order by created_at asc nulls last, id) as n
  from public.rankings
  where user_name = 'セフィ' and difficulty = 'Normal' and score = 265502
)
select id from numbered where n > 1;

do $$
declare total_count integer; delete_count integer; null_dates integer;
begin
  select count(*), count(*) filter (where created_at is null)
    into total_count, null_dates
  from public.rankings
  where user_name = 'セフィ' and difficulty = 'Normal' and score = 265502;
  select count(*) into delete_count from sefi_delete_targets;
  if total_count <> 12 or delete_count <> 11 or null_dates <> 0 then
    raise exception '停止: 全件=%、削除対象=%、created_at NULL=%（期待値 12, 11, 0）',
      total_count, delete_count, null_dates;
  end if;
end $$;

delete from public.rankings r using sefi_delete_targets t
where r.id = t.id
  and r.user_name = 'セフィ' and r.difficulty = 'Normal' and r.score = 265502
returning r.id, r.created_at, r.clear_id;

do $$
declare remaining_count integer;
begin
  select count(*) into remaining_count from public.rankings
  where user_name = 'セフィ' and difficulty = 'Normal' and score = 265502;
  if remaining_count <> 1 then
    raise exception '停止: 削除後件数=%（期待値 1）', remaining_count;
  end if;
end $$;
commit;
