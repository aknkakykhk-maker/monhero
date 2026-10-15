-- 助手とおしゃべり(2026-10-14・社長の決定)の回数を数える表と関数。
-- 窓口が 2026-10-14 に本番へ流した SQL と同じもの(記録として残す)。既存の表は触らない。
-- ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。Edge Function(service_role)だけが関数で使う。
-- 1日の区切りはゲームの日替わりと同じ朝5:00(JST)。
create table if not exists public.assistant_chat_usage (
  day date not null,
  breeder_id text not null,
  count integer not null default 0,
  primary key (day, breeder_id)
);
alter table public.assistant_chat_usage enable row level security;

create or replace function public.assistant_chat_take(p_breeder text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
  total int;
  mine int;
begin
  perform pg_advisory_xact_lock(hashtext('assistant_chat_' || d::text));
  select coalesce(sum(count), 0) into total from assistant_chat_usage where day = d;
  select count into mine from assistant_chat_usage where day = d and breeder_id = p_breeder;
  mine := coalesce(mine, 0);
  if total >= p_total_limit then
    return jsonb_build_object('ok', false, 'reason', 'total', 'remaining', greatest(p_user_limit - mine, 0));
  end if;
  if mine >= p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user', 'remaining', 0);
  end if;
  insert into assistant_chat_usage (day, breeder_id, count) values (d, p_breeder, 1)
    on conflict (day, breeder_id) do update set count = assistant_chat_usage.count + 1;
  return jsonb_build_object('ok', true, 'remaining', p_user_limit - mine - 1);
end $$;

create or replace function public.assistant_chat_refund(p_breeder text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
begin
  update assistant_chat_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder;
end $$;

revoke all on function public.assistant_chat_take(text, int, int) from public, anon, authenticated;
revoke all on function public.assistant_chat_refund(text) from public, anon, authenticated;
grant execute on function public.assistant_chat_take(text, int, int) to service_role;
grant execute on function public.assistant_chat_refund(text) to service_role;
