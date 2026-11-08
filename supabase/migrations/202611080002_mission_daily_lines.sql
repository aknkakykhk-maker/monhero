-- ミッション: 助手の1日1行の案内(2026-11-08 社長 ③A・docs/progress/mission-renewal/PLAN.md 4)の文を置く表と関数。足すだけ(既存の表・関数は触らない)。
-- 1日1行(朝4:00 JST 区切り)。Edge Function mission-daily-line が、その日のはじめの1回だけ Claude に8人ぶんを作らせてここへ置き、ほかの人はここを読むだけ。
-- ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。Edge Function(service_role)だけが関数で使う。
create table if not exists public.mission_daily_lines (
  day date primary key,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  lines jsonb not null default '{}'::jsonb,
  tries integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.mission_daily_lines enable row level security;
revoke all on table public.mission_daily_lines from anon, authenticated;

-- 今日の文をもらう。できていれば ready と文。だれも作っていなければ、呼んだ人が作る番(claimed)。
-- 作っている途中(pending)や、落ちたばかり(failed)は p_retry_seconds あけるまで待つ。1日 p_max_tries 回で打ち切る(done)
create or replace function public.mission_daily_line_claim(p_max_tries int, p_retry_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext('mission_daily_line_' || d::text));
  select * into r from mission_daily_lines where day = d;
  if not found then
    insert into mission_daily_lines (day, status, tries, updated_at) values (d, 'pending', 1, now());
    return jsonb_build_object('state', 'claimed', 'day', d);
  end if;
  if r.status = 'ready' then
    return jsonb_build_object('state', 'ready', 'day', d, 'lines', r.lines);
  end if;
  if r.tries >= p_max_tries then
    return jsonb_build_object('state', 'done', 'day', d);
  end if;
  if r.updated_at < now() - make_interval(secs => p_retry_seconds) then
    update mission_daily_lines set status = 'pending', tries = tries + 1, updated_at = now() where day = d;
    return jsonb_build_object('state', 'claimed', 'day', d);
  end if;
  return jsonb_build_object('state', 'pending', 'day', d);
end $$;

-- 作った文を置く(できた: ready / だめだった: failed)。ready の行は書き換えない(全員が同じ文を読む)
create or replace function public.mission_daily_line_put(p_day date, p_lines jsonb, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update mission_daily_lines
    set status = case when p_ok then 'ready' else 'failed' end,
        lines = case when p_ok then coalesce(p_lines, '{}'::jsonb) else lines end,
        updated_at = now()
    where day = p_day and status <> 'ready';
end $$;

revoke all on function public.mission_daily_line_claim(int, int) from public, anon, authenticated;
revoke all on function public.mission_daily_line_put(date, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.mission_daily_line_claim(int, int) to service_role;
grant execute on function public.mission_daily_line_put(date, jsonb, boolean) to service_role;
