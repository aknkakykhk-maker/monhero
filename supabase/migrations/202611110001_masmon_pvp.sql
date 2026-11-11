-- 助手のマスモンのフレンド対戦(非同期PvP・第④段階)のサーバの表と関数(2026-11-11 タイセン)。設計: docs/spec/MASMON_PVP_SERVER.md
-- 流すのは窓口。**足すだけ**(既存の表・関数・ランキングには触らない)。何度流しても同じになる(if not exists・create or replace)。
--
-- 表(どれも新しい。書くのは Edge Function masmon-pvp(service_role)とこのファイルの関数だけ。端末には書かせない)
--   masmon_pvp_owners   … 1人1行。持ち主の鍵の指紋(md5)。番号だけで他人の登録を書きかえられないようにする(card_deck_entries と同じ考え方)。読ませない
--   masmon_pvp_entries  … 登録編成。(人・助手)で1行。サーバが確かめて通った編成だけが入る。だれでも読める(フレンドの家で見せる)
--   masmon_pvp_anchors  … 1体ごとの「初めて登録したときの値と日」。ここから「日数 × 1日の成長上限」を超えていないかを見る。読ませない
--   masmon_pvp_matches  … 対戦の記録。種(seed)と、計算に渡した編成をそのまま残す(端末が同じ計算で見返す)。だれでも読める
--   masmon_pvp_ratings  … ランキング。区分(raw=育成値そのまま / fair=公平)×(人・助手)で1行。だれでも読める
--   masmon_pvp_usage    … 挑んだ回数((日・人)で1行)。読ませない
--   masmon_pvp_weekly   … (view・読むだけ)週ごとのランキング。対戦記録から足し上げる
-- 関数(service_role だけが呼べる)
--   masmon_pvp_owner_check(owner, key)            … 初めてなら鍵を覚える。2回目からは同じ鍵か。'ok' | 'locked' | 'bad'
--   masmon_pvp_take(owner, limit)                 … 挑む回数を1つ使う。{ ok, remaining }
--   masmon_pvp_refund(owner)                      … 使った回数を1つ戻す(計算が失敗したとき)
--   masmon_pvp_record(...)                        … 試合を1行足し、ランキングを動かす(1つの処理)。{ id, rated, a, b }
-- 日の区切りは朝4:00(JST)。ほかの回数の表と同じ。
-- ★結果は端末から受け取らない。勝ち負けを書けるのは masmon_pvp_record だけで、呼べるのはサーバの関数だけ。

create table if not exists public.masmon_pvp_owners (
  owner_id   text        not null,
  key_hash   text        not null,
  created_at timestamptz not null default now(),
  constraint masmon_pvp_owners_pkey primary key (owner_id),
  constraint masmon_pvp_owners_id_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$')
);

create table if not exists public.masmon_pvp_entries (
  owner_id      text        not null,
  assistant_id  text        not null,
  user_name     text        not null default '',
  icon          text,
  team          jsonb       not null,
  team_total    integer     not null default 0,
  version       integer     not null default 1,
  active        boolean     not null default true,
  tactics_first integer     not null default 0,
  tactics_day   date        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint masmon_pvp_entries_pkey primary key (owner_id, assistant_id),
  constraint masmon_pvp_entries_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and assistant_id ~ '^[a-z]{2,16}$'
    and length(user_name) <= 40 and octet_length(team::text) <= 6000),
  constraint masmon_pvp_entries_counts check (version between 1 and 1000000 and team_total between 0 and 20000 and tactics_first between 0 and 100)
);
create index if not exists masmon_pvp_entries_updated_idx on public.masmon_pvp_entries (active, updated_at desc);

create table if not exists public.masmon_pvp_anchors (
  owner_id     text        not null,
  assistant_id text        not null,
  unit_key     text        not null,
  first_day    date        not null,
  first_stats  jsonb       not null,
  first_total  integer     not null,
  first_lv     integer     not null,
  created_at   timestamptz not null default now(),
  constraint masmon_pvp_anchors_pkey primary key (owner_id, assistant_id, unit_key),
  constraint masmon_pvp_anchors_shape check (unit_key ~ '^[0-9]{1,2}:[A-Za-z0-9_]{1,40}$'
    and first_total between 0 and 6000 and first_lv between 1 and 999 and octet_length(first_stats::text) <= 300)
);

create table if not exists public.masmon_pvp_matches (
  id             bigserial   primary key,
  day            date        not null,
  at             timestamptz not null default now(),
  division       text        not null,
  size           integer     not null,
  rated          boolean     not null default false,
  a_owner        text        not null,
  a_assistant    text        not null,
  b_owner        text        not null,
  b_assistant    text        not null,
  seed           text        not null,
  engine_version integer     not null,
  tech_version   integer     not null default 0,
  balance        text        not null default 'A',
  team_a         jsonb       not null,
  team_b         jsonb       not null,
  winner         text        not null,
  reason         text        not null,
  rounds         integer     not null,
  digest         text        not null,
  a_delta        integer     not null default 0,
  b_delta        integer     not null default 0,
  constraint masmon_pvp_matches_shape check (division in ('raw', 'fair') and size between 1 and 3 and winner in ('A', 'B', 'draw')
    and reason in ('wipe', 'judge') and balance in ('A', 'B', 'C') and a_owner <> b_owner and seed ~ '^[A-Za-z0-9_-]{8,64}$' and digest ~ '^[0-9a-f]{1,16}$'
    and octet_length(team_a::text) <= 6000 and octet_length(team_b::text) <= 6000)
);
create index if not exists masmon_pvp_matches_a_idx on public.masmon_pvp_matches (a_owner, at desc);
create index if not exists masmon_pvp_matches_b_idx on public.masmon_pvp_matches (b_owner, at desc);
create index if not exists masmon_pvp_matches_pair_idx on public.masmon_pvp_matches (day, a_owner, b_owner);

create table if not exists public.masmon_pvp_ratings (
  division     text        not null,
  owner_id     text        not null,
  assistant_id text        not null,
  user_name    text        not null default '',
  icon         text,
  rating       integer     not null default 1500,
  best         integer     not null default 1500,
  wins         integer     not null default 0,
  losses       integer     not null default 0,
  draws        integer     not null default 0,
  matches      integer     not null default 0,
  updated_at   timestamptz not null default now(),
  constraint masmon_pvp_ratings_pkey primary key (division, owner_id, assistant_id),
  constraint masmon_pvp_ratings_shape check (division in ('raw', 'fair') and rating between 0 and 5000 and best between 0 and 5000
    and wins >= 0 and losses >= 0 and draws >= 0 and matches = wins + losses + draws)
);
create index if not exists masmon_pvp_ratings_rank_idx on public.masmon_pvp_ratings (division, rating desc, matches desc);

create table if not exists public.masmon_pvp_usage (
  day      date    not null,
  owner_id text    not null,
  count    integer not null default 0,
  constraint masmon_pvp_usage_pkey primary key (day, owner_id)
);

-- 読む権限: Supabase は新しい表に anon・authenticated の全部の権限を付けるので、いったん全部外し、見せてよい列だけ select を戻す
alter table public.masmon_pvp_owners  enable row level security;
alter table public.masmon_pvp_entries enable row level security;
alter table public.masmon_pvp_anchors enable row level security;
alter table public.masmon_pvp_matches enable row level security;
alter table public.masmon_pvp_ratings enable row level security;
alter table public.masmon_pvp_usage   enable row level security;
revoke all on public.masmon_pvp_owners  from anon, authenticated;
revoke all on public.masmon_pvp_entries from anon, authenticated;
revoke all on public.masmon_pvp_anchors from anon, authenticated;
revoke all on public.masmon_pvp_matches from anon, authenticated;
revoke all on public.masmon_pvp_ratings from anon, authenticated;
revoke all on public.masmon_pvp_usage   from anon, authenticated;
revoke all on sequence public.masmon_pvp_matches_id_seq from anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'masmon_pvp_entries' and policyname = 'masmon_pvp_entries_select') then
    create policy masmon_pvp_entries_select on public.masmon_pvp_entries for select to anon, authenticated using (active);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'masmon_pvp_matches' and policyname = 'masmon_pvp_matches_select') then
    create policy masmon_pvp_matches_select on public.masmon_pvp_matches for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'masmon_pvp_ratings' and policyname = 'masmon_pvp_ratings_select') then
    create policy masmon_pvp_ratings_select on public.masmon_pvp_ratings for select to anon, authenticated using (true);
  end if;
end $$;
grant select (owner_id, assistant_id, user_name, icon, team, team_total, version, active, updated_at)
  on public.masmon_pvp_entries to anon, authenticated;
grant select (id, day, at, division, size, rated, a_owner, a_assistant, b_owner, b_assistant, seed, engine_version, tech_version, balance,
  team_a, team_b, winner, reason, rounds, digest, a_delta, b_delta)
  on public.masmon_pvp_matches to anon, authenticated;
grant select (division, owner_id, assistant_id, user_name, icon, rating, best, wins, losses, draws, matches, updated_at)
  on public.masmon_pvp_ratings to anon, authenticated;

-- 週ごとのランキング(読むだけ)。ランキングに数えた試合(rated)の点の増減と勝敗を、週(月曜4:00 JST 始まり)ごとに足し上げる。
--   security_invoker なので、読む人の権限(対戦記録は誰でも読める)で動く。書く口は無い
create or replace view public.masmon_pvp_weekly with (security_invoker = true) as
  with sides as (
    select date_trunc('week', (m.at at time zone 'Asia/Tokyo') - interval '4 hours')::date as week, m.division,
           m.a_owner as owner_id, m.a_assistant as assistant_id, m.a_delta as delta,
           (m.winner = 'A')::int as win, (m.winner = 'B')::int as lose, (m.winner = 'draw')::int as draw
      from public.masmon_pvp_matches m where m.rated
    union all
    select date_trunc('week', (m.at at time zone 'Asia/Tokyo') - interval '4 hours')::date, m.division,
           m.b_owner, m.b_assistant, m.b_delta,
           (m.winner = 'B')::int, (m.winner = 'A')::int, (m.winner = 'draw')::int
      from public.masmon_pvp_matches m where m.rated
  )
  select week, division, owner_id, assistant_id, sum(delta)::int as points, sum(win)::int as wins, sum(lose)::int as losses,
         sum(draw)::int as draws, count(*)::int as matches
    from sides group by week, division, owner_id, assistant_id;
revoke all on public.masmon_pvp_weekly from anon, authenticated;
grant select on public.masmon_pvp_weekly to anon, authenticated;

-- 朝4:00(JST)で区切った今日
create or replace function public.masmon_pvp_today()
returns date language sql stable set search_path = public as $$
  select ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date
$$;

-- 持ち主の鍵。初めてなら覚える。返り値: 'ok' | 'locked'(鍵がちがう) | 'bad'(形がちがう)
create or replace function public.masmon_pvp_owner_check(p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128 then return 'bad'; end if;
  insert into public.masmon_pvp_owners (owner_id, key_hash) values (p_owner, md5(p_key)) on conflict (owner_id) do nothing;
  select key_hash into h from public.masmon_pvp_owners where owner_id = p_owner;
  if h is distinct from md5(p_key) then return 'locked'; end if;
  return 'ok';
end $$;

-- 挑む回数を1つ使う(1人1日 p_limit 回まで)
create or replace function public.masmon_pvp_take(p_owner text, p_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.masmon_pvp_today(); mine int;
begin
  perform pg_advisory_xact_lock(hashtext('masmon_pvp_take_' || p_owner));
  select count into mine from public.masmon_pvp_usage where day = d and owner_id = p_owner;
  mine := coalesce(mine, 0);
  if mine >= p_limit then return jsonb_build_object('ok', false, 'remaining', 0); end if;
  insert into public.masmon_pvp_usage (day, owner_id, count) values (d, p_owner, 1)
    on conflict (day, owner_id) do update set count = public.masmon_pvp_usage.count + 1;
  return jsonb_build_object('ok', true, 'remaining', p_limit - mine - 1);
end $$;
create or replace function public.masmon_pvp_refund(p_owner text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.masmon_pvp_usage set count = greatest(count - 1, 0) where day = public.masmon_pvp_today() and owner_id = p_owner;
end $$;

-- 試合を記録し、ランキングを動かす(1つの処理)。
--   ランキングに数えるのは size=3(3対3)で、同じ2人(どちらが挑んでも)の今日の数えた試合が p_pair_limit 未満のときだけ。
--   点は Elo(K=p_k・はじめ 1500)。挑まれた側も動く(非同期の対戦のふつうの形)。
-- 返り値: { id, rated, a:{rating, delta}, b:{rating, delta} }
create or replace function public.masmon_pvp_record(
  p_division text, p_size int,
  p_a_owner text, p_a_assistant text, p_a_name text, p_a_icon text,
  p_b_owner text, p_b_assistant text, p_b_name text, p_b_icon text,
  p_seed text, p_engine_version int, p_tech_version int, p_balance text, p_team_a jsonb, p_team_b jsonb,
  p_winner text, p_reason text, p_rounds int, p_digest text,
  p_pair_limit int, p_k int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.masmon_pvp_today();
  lo text := least(p_a_owner, p_b_owner);
  hi text := greatest(p_a_owner, p_b_owner);
  pair_rated int;
  v_rated boolean := false;
  ra int; rb int; ea numeric; sa numeric; da int := 0; db int := 0;
  mid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('masmon_pvp_pair_' || lo || '_' || hi));
  if p_size = 3 then
    select count(*) into pair_rated from public.masmon_pvp_matches m
     where m.day = v_day and m.rated and least(a_owner, b_owner) = lo and greatest(a_owner, b_owner) = hi;
    v_rated := pair_rated < p_pair_limit;
  end if;
  if v_rated then
    insert into public.masmon_pvp_ratings (division, owner_id, assistant_id, user_name, icon) values (p_division, p_a_owner, p_a_assistant, left(coalesce(p_a_name, ''), 40), left(p_a_icon, 64))
      on conflict (division, owner_id, assistant_id) do nothing;
    insert into public.masmon_pvp_ratings (division, owner_id, assistant_id, user_name, icon) values (p_division, p_b_owner, p_b_assistant, left(coalesce(p_b_name, ''), 40), left(p_b_icon, 64))
      on conflict (division, owner_id, assistant_id) do nothing;
    select rating into ra from public.masmon_pvp_ratings where division = p_division and owner_id = p_a_owner and assistant_id = p_a_assistant for update;
    select rating into rb from public.masmon_pvp_ratings where division = p_division and owner_id = p_b_owner and assistant_id = p_b_assistant for update;
    ea := 1 / (1 + power(10::numeric, (rb - ra)::numeric / 400));
    sa := case p_winner when 'A' then 1 when 'B' then 0 else 0.5 end;
    da := round(p_k * (sa - ea));
    db := -da;
    update public.masmon_pvp_ratings set rating = greatest(0, rating + da), best = greatest(best, rating + da),
      wins = wins + (case when p_winner = 'A' then 1 else 0 end), losses = losses + (case when p_winner = 'B' then 1 else 0 end),
      draws = draws + (case when p_winner = 'draw' then 1 else 0 end), matches = matches + 1,
      user_name = left(coalesce(p_a_name, user_name), 40), icon = coalesce(left(p_a_icon, 64), icon), updated_at = now()
      where division = p_division and owner_id = p_a_owner and assistant_id = p_a_assistant;
    update public.masmon_pvp_ratings set rating = greatest(0, rating + db), best = greatest(best, rating + db),
      wins = wins + (case when p_winner = 'B' then 1 else 0 end), losses = losses + (case when p_winner = 'A' then 1 else 0 end),
      draws = draws + (case when p_winner = 'draw' then 1 else 0 end), matches = matches + 1,
      user_name = left(coalesce(p_b_name, user_name), 40), icon = coalesce(left(p_b_icon, 64), icon), updated_at = now()
      where division = p_division and owner_id = p_b_owner and assistant_id = p_b_assistant;
  end if;
  insert into public.masmon_pvp_matches (day, division, size, rated, a_owner, a_assistant, b_owner, b_assistant, seed, engine_version, tech_version, balance,
      team_a, team_b, winner, reason, rounds, digest, a_delta, b_delta)
    values (v_day, p_division, p_size, v_rated, p_a_owner, p_a_assistant, p_b_owner, p_b_assistant, p_seed, p_engine_version, p_tech_version, p_balance,
      p_team_a, p_team_b, p_winner, p_reason, p_rounds, p_digest, da, db)
    returning id into mid;
  return jsonb_build_object('id', mid, 'rated', v_rated,
    'a', jsonb_build_object('delta', da, 'rating', (select rating from public.masmon_pvp_ratings where division = p_division and owner_id = p_a_owner and assistant_id = p_a_assistant)),
    'b', jsonb_build_object('delta', db, 'rating', (select rating from public.masmon_pvp_ratings where division = p_division and owner_id = p_b_owner and assistant_id = p_b_assistant)));
end $$;

revoke all on function public.masmon_pvp_today() from public;
revoke all on function public.masmon_pvp_owner_check(text, text) from public, anon, authenticated;
revoke all on function public.masmon_pvp_take(text, int) from public, anon, authenticated;
revoke all on function public.masmon_pvp_refund(text) from public, anon, authenticated;
revoke all on function public.masmon_pvp_record(text, int, text, text, text, text, text, text, text, text, text, int, int, text, jsonb, jsonb, text, text, int, text, int, int) from public, anon, authenticated;
grant execute on function public.masmon_pvp_today() to anon, authenticated, service_role;
grant execute on function public.masmon_pvp_owner_check(text, text) to service_role;
grant execute on function public.masmon_pvp_take(text, int) to service_role;
grant execute on function public.masmon_pvp_refund(text) to service_role;
grant execute on function public.masmon_pvp_record(text, int, text, text, text, text, text, text, text, text, text, int, int, text, jsonb, jsonb, text, text, int, text, int, int) to service_role;
