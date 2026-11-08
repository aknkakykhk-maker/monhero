-- MFバトルカード: 助手のデッキを AI で組む(deckPlan・2026-11-08 社長の決定)の回数を数える表と関数。足すだけ(既存の表・関数は触らない)。
-- ひとこと・デッキ相談(card_assistant_talk_usage)とは別の表で、全員の合計もほかと混ぜずに数える(全員合わせて1日100回)。
-- ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。Edge Function(service_role)だけが関数で使う。
-- 1日の区切りは朝4:00(JST)。card_assistant_talk_take と同じ数え方。
create table if not exists public.card_deck_plan_usage (
  day date not null,
  breeder_id text not null,
  count integer not null default 0,
  primary key (day, breeder_id)
);
alter table public.card_deck_plan_usage enable row level security;
revoke all on table public.card_deck_plan_usage from anon, authenticated;

create or replace function public.card_deck_plan_take(p_breeder text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  total int;
  mine int;
begin
  perform pg_advisory_xact_lock(hashtext('card_deck_plan_' || d::text));
  select coalesce(sum(count), 0) into total from card_deck_plan_usage where day = d;
  select count into mine from card_deck_plan_usage where day = d and breeder_id = p_breeder;
  mine := coalesce(mine, 0);
  if total >= p_total_limit then
    return jsonb_build_object('ok', false, 'reason', 'total', 'remaining', greatest(p_user_limit - mine, 0));
  end if;
  if mine >= p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user', 'remaining', 0);
  end if;
  insert into card_deck_plan_usage (day, breeder_id, count) values (d, p_breeder, 1)
    on conflict (day, breeder_id) do update set count = card_deck_plan_usage.count + 1;
  return jsonb_build_object('ok', true, 'remaining', p_user_limit - mine - 1);
end $$;
create or replace function public.card_deck_plan_refund(p_breeder text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
begin
  update card_deck_plan_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder;
end $$;

revoke all on function public.card_deck_plan_take(text, int, int) from public, anon, authenticated;
revoke all on function public.card_deck_plan_refund(text) from public, anon, authenticated;
grant execute on function public.card_deck_plan_take(text, int, int) to service_role;
grant execute on function public.card_deck_plan_refund(text) to service_role;
