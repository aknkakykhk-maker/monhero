-- 1日の切り替わりを朝4:00(JST)にそろえる(2026-11-07 社長「てかぜんぶ4時に統一して」)。
-- 助手とおしゃべり(assistant_chat_*)と、MFバトルカードの助手のおしゃべり(card_assistant_talk_*)の回数の「今日」を、
-- 朝5:00区切りから朝4:00区切りへ。関数の本体を差し替えるだけ(create or replace)。表・権限・回数の上限は変えない。
-- 切り替えの日だけ、4:00〜5:00 に新しい日の回数が1時間早く戻る(ゲーム側の 5時→4時 の物と同じ扱い)。
-- 元に戻すときは、202610140001 / 202610250001 の関数をそのまま流し直せばよい。
create or replace function public.assistant_chat_take(p_breeder text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
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
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
begin
  update assistant_chat_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder;
end $$;

create or replace function public.card_assistant_talk_take(p_breeder text, p_bucket text, p_user_limit int, p_total_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
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
declare d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
begin
  update card_assistant_talk_usage set count = greatest(count - 1, 0) where day = d and breeder_id = p_breeder and bucket = p_bucket;
end $$;
