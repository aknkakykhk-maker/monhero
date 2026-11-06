-- 助手どうしの掛け合い・API 版(kind:'peer_talks'・2026-11-07 社長「ガッツリ作りこんで」「APIは余裕ある」)の回数を数える表と関数。
-- ★足すだけ。既存の表(assistant_chat_usage など)と関数には触らない。
-- おしゃべり(1人100往復・全員2,000往復)とは別に数える: 1人1日100回・全員1日3,000回(上限の数は Edge Function が渡す。Secrets で下げられる)。
-- ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。Edge Function(service_role)だけが関数で使う。
-- 1日の区切りはゲームの日替わりと同じ朝5:00(JST)。
create table if not exists public.assistant_peer_talk_usage (
  day date not null,
  breeder_id text not null,
  count integer not null default 0,
  primary key (day, breeder_id)
);
alter table public.assistant_peer_talk_usage enable row level security;

create or replace function public.assistant_peer_talk_take(p_breeder text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
  total int;
  mine int;
begin
  perform pg_advisory_xact_lock(hashtext('assistant_peer_talk_' || d::text));
  select coalesce(sum(count), 0) into total from assistant_peer_talk_usage where day = d;
  select count into mine from assistant_peer_talk_usage where day = d and breeder_id = p_breeder;
  mine := coalesce(mine, 0);
  if total >= p_total_limit then
    return jsonb_build_object('ok', false, 'reason', 'total', 'remaining', greatest(p_user_limit - mine, 0));
  end if;
  if mine >= p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user', 'remaining', 0);
  end if;
  insert into assistant_peer_talk_usage (day, breeder_id, count) values (d, p_breeder, 1)
    on conflict (day, breeder_id) do update set count = assistant_peer_talk_usage.count + 1;
  return jsonb_build_object('ok', true, 'remaining', p_user_limit - mine - 1);
end $$;

create or replace function public.assistant_peer_talk_refund(p_breeder text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
begin
  update assistant_peer_talk_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder;
end $$;

revoke all on function public.assistant_peer_talk_take(text, int, int) from public, anon, authenticated;
revoke all on function public.assistant_peer_talk_refund(text) from public, anon, authenticated;
grant execute on function public.assistant_peer_talk_take(text, int, int) to service_role;
grant execute on function public.assistant_peer_talk_refund(text) to service_role;
