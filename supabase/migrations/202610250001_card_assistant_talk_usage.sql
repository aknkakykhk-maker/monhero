-- MFバトルカード: 助手のおしゃべり(AI)(2026-10-25)の回数を数える表と関数。足すだけ(既存の表・関数は触らない)。
-- 助手とおしゃべり(assistant_chat_usage)とは別に数える。ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。
-- Edge Function(service_role)だけが関数で使う。bucket は 'talk'(対戦後・山場のひとこと)か 'deck'(デッキ相談)。
-- 1日の区切りはゲームの日替わりと同じ朝5:00(JST)。全員の合計は bucket をまたいで数える。
create table if not exists public.card_assistant_talk_usage (
  day date not null,
  breeder_id text not null,
  bucket text not null,
  count integer not null default 0,
  primary key (day, breeder_id, bucket)
);
alter table public.card_assistant_talk_usage enable row level security;

create or replace function public.card_assistant_talk_take(p_breeder text, p_bucket text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
  total int;
  mine int;
begin
  if p_bucket not in ('talk', 'deck') then
    return jsonb_build_object('ok', false, 'reason', 'bucket', 'remaining', 0);
  end if;
  perform pg_advisory_xact_lock(hashtext('card_assistant_talk_' || d::text));
  select coalesce(sum(count), 0) into total from card_assistant_talk_usage where day = d;
  select count into mine from card_assistant_talk_usage where day = d and breeder_id = p_breeder and bucket = p_bucket;
  mine := coalesce(mine, 0);
  if total >= p_total_limit then
    return jsonb_build_object('ok', false, 'reason', 'total', 'remaining', greatest(p_user_limit - mine, 0));
  end if;
  if mine >= p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user', 'remaining', 0);
  end if;
  insert into card_assistant_talk_usage (day, breeder_id, bucket, count) values (d, p_breeder, p_bucket, 1)
    on conflict (day, breeder_id, bucket) do update set count = card_assistant_talk_usage.count + 1;
  return jsonb_build_object('ok', true, 'remaining', p_user_limit - mine - 1);
end $$;

create or replace function public.card_assistant_talk_refund(p_breeder text, p_bucket text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
begin
  update card_assistant_talk_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder and bucket = p_bucket;
end $$;

revoke all on function public.card_assistant_talk_take(text, text, int, int) from public, anon, authenticated;
revoke all on function public.card_assistant_talk_refund(text, text) from public, anon, authenticated;
grant execute on function public.card_assistant_talk_take(text, text, int, int) to service_role;
grant execute on function public.card_assistant_talk_refund(text, text) to service_role;
