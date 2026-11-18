-- v6 適用後、β2の端末を公開する前に実行する。既存行・旧端末はβ1。
begin;
alter table public.monsuc_finishes add column if not exists rank_beta smallint not null default 1 check (rank_beta in (1, 2));

create or replace view public.monsuc_rank_all as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv,
         coalesce(power_v3, power) as power, coalesce(grade_v3, grade) as grade, finished_at,
         rank() over (order by coalesce(power_v3, power) desc, finished_at asc) as place, loyal, pop, techs, tech_detail, cap_detail, apt_detail
  from public.monsuc_finishes where not hidden and rank_beta = 1;
create or replace view public.monsuc_rank_lineage as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv,
         coalesce(power_v3, power) as power, coalesce(grade_v3, grade) as grade, finished_at,
         rank() over (partition by lineage order by coalesce(power_v3, power) desc, finished_at asc) as place, loyal, pop, techs, tech_detail, cap_detail, apt_detail
  from public.monsuc_finishes where not hidden and rank_beta = 1;
revoke all on public.monsuc_rank_all     from anon, authenticated;
revoke all on public.monsuc_rank_lineage from anon, authenticated;
grant select on public.monsuc_rank_all     to anon, authenticated;
grant select on public.monsuc_rank_lineage to anon, authenticated;

create or replace view public.monsuc_rank_all_beta2 as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv,
         coalesce(power_v3, power) as power, coalesce(grade_v3, grade) as grade, finished_at,
         rank() over (order by coalesce(power_v3, power) desc, finished_at asc) as place, loyal, pop, techs, tech_detail, cap_detail, apt_detail
  from public.monsuc_finishes where not hidden and rank_beta = 2;
create or replace view public.monsuc_rank_lineage_beta2 as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv,
         coalesce(power_v3, power) as power, coalesce(grade_v3, grade) as grade, finished_at,
         rank() over (partition by lineage order by coalesce(power_v3, power) desc, finished_at asc) as place, loyal, pop, techs, tech_detail, cap_detail, apt_detail
  from public.monsuc_finishes where not hidden and rank_beta = 2;
revoke all on public.monsuc_rank_all_beta2     from anon, authenticated;
revoke all on public.monsuc_rank_lineage_beta2 from anon, authenticated;
grant select on public.monsuc_rank_all_beta2     to anon, authenticated;
grant select on public.monsuc_rank_lineage_beta2 to anon, authenticated;

-- 共通の認証・採点・送信回数制限はv6を使う。新規登録時だけ同じトランザクションで版を確定する。
do $$ begin
  if to_regprocedure('public.monsuc_rank_submit_v6(text,text,jsonb)') is null then
    alter function public.monsuc_rank_submit(text,text,jsonb) rename to monsuc_rank_submit_v6;
  end if;
end $$;
revoke all on function public.monsuc_rank_submit_v6(text,text,jsonb) from public, anon, authenticated, service_role;

create or replace function public.monsuc_rank_submit_for_beta(p_owner text, p_key text, p_row jsonb, p_beta integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
  id text := p_row->>'run_id';
  all_place bigint;
  lineage_place bigint;
begin
  result := public.monsuc_rank_submit_v6(p_owner, p_key, p_row);
  if result->>'ok' is distinct from 'true' then return result; end if;
  if p_beta = 2 and result->>'reason' is distinct from 'dup' then
    update public.monsuc_finishes set rank_beta = 2 where run_id = id and owner_id = p_owner;
  end if;
  if p_beta = 2 then
    select place into all_place from public.monsuc_rank_all_beta2 where run_id = id;
    select place into lineage_place from public.monsuc_rank_lineage_beta2 where run_id = id;
  else
    select place into all_place from public.monsuc_rank_all where run_id = id;
    select place into lineage_place from public.monsuc_rank_lineage where run_id = id;
  end if;
  return result || jsonb_build_object('place_all', all_place, 'place_lineage', lineage_place);
end $$;
revoke all on function public.monsuc_rank_submit_for_beta(text,text,jsonb,integer) from public, anon, authenticated, service_role;

create or replace function public.monsuc_rank_submit(p_owner text, p_key text, p_row jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.monsuc_rank_submit_for_beta(p_owner, p_key, p_row, 1);
$$;
revoke all on function public.monsuc_rank_submit(text,text,jsonb) from public;
grant execute on function public.monsuc_rank_submit(text,text,jsonb) to anon, authenticated, service_role;
create or replace function public.monsuc_rank_submit_beta2(p_owner text, p_key text, p_row jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.monsuc_rank_submit_for_beta(p_owner, p_key, p_row, 2);
$$;
revoke all on function public.monsuc_rank_submit_beta2(text,text,jsonb) from public;
grant execute on function public.monsuc_rank_submit_beta2(text,text,jsonb) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
