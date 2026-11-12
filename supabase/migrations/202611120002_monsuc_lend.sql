-- モンヒロサクセス: フレンドからのレンタル(段取りの回5・2026-11-12 オトズレ)。設計: docs/progress/player-raise/PLAN.md §2「フレンドからのレンタル」
-- 流すのは窓口。**足すだけ**(既存の表・関数・ランキング・alf_masmon_share・masmon_pvp_* には触らない)。何度流しても同じになる。
--
-- 表(どれも新しい。書くのは Edge Function masmon-pvp(service_role)とこのファイルの関数だけ。端末には書かせない)
--   monsuc_lend       … 1人1行。保存枠から選んだ「貸し出しの子」の写し(種・名前・色・型・6能力・アシスト)。
--                       サーバが形を確かめて通ったものだけが入る。active な行はだれでも読める(フレンドの一覧に出す)
--   monsuc_lend_uses  … 借りた記録(1回1行)。続けて同じ人の子を借りすぎないかと、貸した側の名声に使う。読ませない
-- 関数(service_role だけが呼べる)
--   monsuc_lend_use(borrower, lender, streak)          … 借りた記録を1行足す。直前 streak 回が全部同じ相手なら断る。{ ok, reason? }
--   monsuc_lend_claim(owner, daily_n, fame_each)       … 貸した子が借りられた回数をまとめて受け取る。名声は1日 daily_n 回ぶんまで。{ n, paid, fame }
-- 持ち主の鍵は masmon_pvp_owners をそのまま使う(masmon-pvp の Edge Function が確かめる)。
-- 日の区切りは朝4:00(JST)。masmon_pvp_today() を使い回す。
-- ★端末は借りる子の能力を送られたまま信じない(ランク・効き・アシストのポイントは借りる側で出し直す)。

create table if not exists public.monsuc_lend (
  owner_id   text        not null,
  user_name  text        not null default '',
  icon       text,
  mon        jsonb       not null,
  version    integer     not null default 1,
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monsuc_lend_pkey primary key (owner_id),
  constraint monsuc_lend_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and length(user_name) <= 40
    and octet_length(mon::text) <= 2000 and version between 1 and 1000000)
);

create table if not exists public.monsuc_lend_uses (
  id          bigserial   not null,
  day         date        not null,
  at          timestamptz not null default now(),
  borrower    text        not null,
  lender      text        not null,
  claimed     boolean     not null default false,
  paid        boolean     not null default false,
  claimed_day date,
  constraint monsuc_lend_uses_pkey primary key (id),
  constraint monsuc_lend_uses_shape check (borrower ~ '^[A-Za-z0-9_-]{1,64}$' and lender ~ '^[A-Za-z0-9_-]{1,64}$' and borrower <> lender)
);
create index if not exists monsuc_lend_uses_borrower_idx on public.monsuc_lend_uses (borrower, at desc);
create index if not exists monsuc_lend_uses_lender_idx on public.monsuc_lend_uses (lender, claimed, at);

alter table public.monsuc_lend      enable row level security;
alter table public.monsuc_lend_uses enable row level security;
revoke all on public.monsuc_lend      from anon, authenticated;
revoke all on public.monsuc_lend_uses from anon, authenticated;
revoke all on sequence public.monsuc_lend_uses_id_seq from anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'monsuc_lend' and policyname = 'monsuc_lend_select') then
    create policy monsuc_lend_select on public.monsuc_lend for select to anon, authenticated using (active);
  end if;
end $$;
grant select (owner_id, user_name, icon, mon, version, active, updated_at) on public.monsuc_lend to anon, authenticated;

-- 借りた記録を1行足す。直前 p_streak 回が全部 p_lender なら断る(同じフレンドの子は続けて p_streak 回まで)
create or replace function public.monsuc_lend_use(p_borrower text, p_lender text, p_streak int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare same int; total int;
begin
  if p_borrower is null or p_lender is null or p_borrower = p_lender then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  perform pg_advisory_xact_lock(hashtext('monsuc_lend_use_' || p_borrower));
  select count(*), count(*) filter (where lender = p_lender) into total, same
    from (select lender from public.monsuc_lend_uses where borrower = p_borrower order by at desc, id desc limit greatest(p_streak, 1)) t;
  if total >= p_streak and same >= p_streak then return jsonb_build_object('ok', false, 'reason', 'streak'); end if;
  insert into public.monsuc_lend_uses (day, borrower, lender) values (public.masmon_pvp_today(), p_borrower, p_lender);
  return jsonb_build_object('ok', true);
end $$;

-- 貸した子が借りられた回数をまとめて受け取る。古い順に、今日まだ名声を受け取っていない分(1日 p_daily_n 回)だけ paid にする
create or replace function public.monsuc_lend_claim(p_owner text, p_daily_n int, p_fame_each int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.masmon_pvp_today(); done int; room int; n int; k int;
begin
  perform pg_advisory_xact_lock(hashtext('monsuc_lend_claim_' || p_owner));
  select count(*) into done from public.monsuc_lend_uses where lender = p_owner and claimed and paid and claimed_day = d;
  room := greatest(p_daily_n - coalesce(done, 0), 0);
  select count(*) into n from public.monsuc_lend_uses where lender = p_owner and not claimed;
  with pick as (
    select id from public.monsuc_lend_uses where lender = p_owner and not claimed order by at, id limit room
  ) update public.monsuc_lend_uses u set paid = true from pick where u.id = pick.id;
  get diagnostics k = row_count;
  update public.monsuc_lend_uses set claimed = true, claimed_day = d where lender = p_owner and not claimed;
  return jsonb_build_object('n', coalesce(n, 0), 'paid', coalesce(k, 0), 'fame', coalesce(k, 0) * p_fame_each);
end $$;

revoke all on function public.monsuc_lend_use(text, text, int) from public, anon, authenticated;
revoke all on function public.monsuc_lend_claim(text, int, int) from public, anon, authenticated;
grant execute on function public.monsuc_lend_use(text, text, int) to service_role;
grant execute on function public.monsuc_lend_claim(text, int, int) to service_role;
