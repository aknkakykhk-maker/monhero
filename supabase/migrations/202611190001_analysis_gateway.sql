-- 分析の入り口(r1119-014 PR1・Edge Function analysis-gateway)の使った量の記録。
-- 新しい表と関数だけ。既存の表・保存データ・ランキングには触らない。
-- ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない・関数は service_role だけ)。
-- 止める: Secrets の ANALYSIS_GATEWAY_TOKEN を消す / ANALYSIS_DAY_USD を 0 にする(表を残してもゲームには何も起きない)。

create table if not exists public.analysis_gateway_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  day date not null,                       -- 日本時間の日(上限の区切り)
  kind text not null,                      -- 仕事の種類(balance・ui-check など)
  label text,
  mode text not null,                      -- message / batch
  status text not null default 'reserved', -- reserved / batch_pending / done / refused / error
  batch_id text,
  model text,
  usd_est numeric(10,4) not null,          -- 呼ぶ前の多めの見積り
  usd_actual numeric(10,4),                -- 返ってきた使用量から計算した額
  usage jsonb                              -- 入力・出力・キャッシュのトークン数(中身は残さない)
);
create index if not exists analysis_gateway_usage_day on public.analysis_gateway_usage (day);
create unique index if not exists analysis_gateway_usage_batch on public.analysis_gateway_usage (batch_id) where batch_id is not null;
alter table public.analysis_gateway_usage enable row level security;

-- その日に使った額(終わった物は実際の額・まだの物は見積り)
create or replace function public.analysis_gateway_day_used(p_day date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when status in ('done', 'refused', 'error') then coalesce(usd_actual, 0) else usd_est end), 0)
  from analysis_gateway_usage where day = p_day;
$$;

-- 頼む前に1日の上限を確かめて1行入れる。日ごとの錠で、同時に頼まれても上限を超えない
create or replace function public.analysis_gateway_reserve(p_day date, p_kind text, p_label text, p_mode text, p_usd_est numeric, p_day_cap numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare used numeric; jid bigint;
begin
  if p_mode not in ('message', 'batch') or p_usd_est is null or p_usd_est < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  perform pg_advisory_xact_lock(hashtext('analysis_gateway_' || p_day::text));
  used := public.analysis_gateway_day_used(p_day);
  if used + p_usd_est > p_day_cap then
    return jsonb_build_object('ok', false, 'reason', 'day_cap', 'used', used);
  end if;
  insert into analysis_gateway_usage (day, kind, label, mode, usd_est)
  values (p_day, p_kind, left(p_label, 120), p_mode, p_usd_est) returning id into jid;
  return jsonb_build_object('ok', true, 'id', jid, 'used', used);
end $$;

-- バッチの番号を行に付ける
create or replace function public.analysis_gateway_attach_batch(p_id bigint, p_batch_id text)
returns void language sql security definer set search_path = public as $$
  update analysis_gateway_usage set batch_id = p_batch_id, status = 'batch_pending'
  where id = p_id and status = 'reserved';
$$;

-- 終わった額を書く。まだ終わっていない行だけ(何度呼ばれても二重に書かない)。書いたら true
create or replace function public.analysis_gateway_finish(p_id bigint, p_status text, p_usd_actual numeric, p_usage jsonb, p_model text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_status not in ('done', 'refused', 'error') then return false; end if;
  update analysis_gateway_usage
     set status = p_status, usd_actual = p_usd_actual, usage = p_usage, model = p_model, finished_at = now()
   where id = p_id and status in ('reserved', 'batch_pending');
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.analysis_gateway_day_used(date) from public, anon, authenticated;
revoke all on function public.analysis_gateway_reserve(date, text, text, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.analysis_gateway_attach_batch(bigint, text) from public, anon, authenticated;
revoke all on function public.analysis_gateway_finish(bigint, text, numeric, jsonb, text) from public, anon, authenticated;
grant execute on function public.analysis_gateway_day_used(date) to service_role;
grant execute on function public.analysis_gateway_reserve(date, text, text, text, numeric, numeric) to service_role;
grant execute on function public.analysis_gateway_attach_batch(bigint, text) to service_role;
grant execute on function public.analysis_gateway_finish(bigint, text, numeric, jsonb, text) to service_role;
