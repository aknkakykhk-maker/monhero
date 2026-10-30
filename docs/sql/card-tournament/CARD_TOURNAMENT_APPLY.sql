-- MFバトルカード大会(2026-10-30 社長「作り始めて」・カード部 ルールくん)。仕様は docs/progress/card-tournament/plan/README.md
-- 流すのは統括部長。足すだけ(いまの表は変えない。みんなのデッキの表 card_deck_entries は読むだけ)。何度流しても同じになる
--
-- 表(どれも直接は読ませない。読むのも書くのも関数だけ)
--   card_tournaments        … 大会(名前・開催日・受付の終わり・状態・ごほうびの表)
--   card_tournament_entries … エントリー(締め切りで登録デッキの写しを取る)と助手の席
--   card_tournament_matches … 試合(種・先攻・勝ち負け・手の並び・実況と解説・見せてよい時刻)
--   card_tournament_rewards … ごほうびと受け取り済みの印
-- 関数(ゲームから呼ぶ)
--   card_tournament_list()                      … いま見せる大会の一覧
--   card_tournament_enter(tour, owner, key)     … エントリー(受付中だけ。みんなのデッキに登録してある人だけ)
--   card_tournament_withdraw(tour, owner, key)  … エントリーの取り消し(受付中だけ)
--   card_tournament_view(tour, owner)           … 対戦表と試合の一覧(結果は見せてよい時刻を過ぎた試合だけ)
--   card_tournament_match(match_id)             … 1試合の見返しの材料(見せてよい時刻を過ぎた試合だけ)
--   card_tournament_claim(tour, owner, key)     … ごほうびを1回だけ受け取る
-- 試合を回すのはサーバの上の関数 card-tournament-run(service_role で表を読み書きする)。呼ぶ仕組みは CARD_TOURNAMENT_SCHEDULE.sql
-- 持ち主の見分けは、みんなのデッキと同じ owner_id(ブリーダーID)+ 端末の鍵(mh_card_deck_owner_key_v1)。表には md5 の指紋だけ

create table if not exists public.card_tournaments (
  id          text        not null,
  name        text        not null default '',
  open_on     date        not null,
  entry_until timestamptz not null,
  status      text        not null default 'entry',
  rewards     jsonb       not null default '{}'::jsonb,
  first_day   date,
  done_day    date,
  groups      integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint card_tournaments_pkey primary key (id),
  constraint card_tournaments_id_shape check (id ~ '^[a-z0-9_-]{1,32}$'),
  constraint card_tournaments_status check (status in ('entry', 'group', 'final', 'done')),
  constraint card_tournaments_sizes check (length(name) <= 40 and octet_length(rewards::text) <= 4000)
);

create table if not exists public.card_tournament_entries (
  tournament_id text        not null references public.card_tournaments (id),
  seat_id       text        not null,
  owner_id      text,
  key_hash      text,
  entered_at    timestamptz not null default now(),
  is_assist     boolean     not null default false,
  assist_id     text,
  dropped       boolean     not null default false,
  user_name     text        not null default '',
  icon          text,
  profile_frame text,
  deck          jsonb,
  tactics       jsonb,
  deck_version  integer,
  grp           integer,
  seat          integer,
  final_seat    integer,
  place         integer,
  wins          integer,
  constraint card_tournament_entries_pkey primary key (tournament_id, seat_id),
  constraint card_tournament_entries_seat_shape check (seat_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint card_tournament_entries_sizes check (length(user_name) <= 40 and octet_length(coalesce(deck, '{}'::jsonb)::text) <= 2000 and octet_length(coalesce(tactics, '{}'::jsonb)::text) <= 2000)
);
create unique index if not exists card_tournament_entries_owner_idx on public.card_tournament_entries (tournament_id, owner_id) where owner_id is not null;

create table if not exists public.card_tournament_matches (
  id            bigserial   not null,
  tournament_id text        not null references public.card_tournaments (id),
  stage         text        not null,
  grp           integer     not null,
  day           integer     not null,
  a_seat        integer     not null,
  b_seat        integer     not null,
  seed          bigint      not null,
  first         integer     not null,
  play_on       date        not null,
  visible_at    timestamptz not null,
  winner        integer,
  kos           integer[],
  acts          jsonb,
  decided       text,
  rules         integer,
  assist_decks  jsonb,
  live          jsonb,
  done_at       timestamptz,
  constraint card_tournament_matches_pkey primary key (id),
  constraint card_tournament_matches_one unique (tournament_id, stage, grp, a_seat, b_seat),
  constraint card_tournament_matches_stage check (stage in ('group', 'final')),
  constraint card_tournament_matches_winner check (winner is null or winner in (0, 1))
);
create index if not exists card_tournament_matches_due_idx on public.card_tournament_matches (tournament_id, play_on) where winner is null;

create table if not exists public.card_tournament_rewards (
  tournament_id text        not null references public.card_tournaments (id),
  owner_id      text        not null,
  place         integer,
  point         integer     not null default 0,
  title         text        not null default '',
  frame         text        not null default '',
  claimed_at    timestamptz,
  constraint card_tournament_rewards_pkey primary key (tournament_id, owner_id)
);

alter table public.card_tournaments enable row level security;
alter table public.card_tournament_entries enable row level security;
alter table public.card_tournament_matches enable row level security;
alter table public.card_tournament_rewards enable row level security;
-- Supabase は新しい表に anon・authenticated の全部の権限を付ける。全部外す(読むのも関数だけ)
revoke all on public.card_tournaments from anon, authenticated;
revoke all on public.card_tournament_entries from anon, authenticated;
revoke all on public.card_tournament_matches from anon, authenticated;
revoke all on public.card_tournament_rewards from anon, authenticated;

-- いま見せる大会(受付中・開催中・終わって14日まで)
create or replace function public.card_tournament_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'open_on', t.open_on, 'entry_until', t.entry_until, 'status', t.status,
    'first_day', t.first_day, 'done_day', t.done_day, 'groups', t.groups, 'rewards', t.rewards,
    'players', (select count(*) from card_tournament_entries e where e.tournament_id = t.id and not e.is_assist and not e.dropped))
    order by t.open_on desc), '[]'::jsonb)
  from card_tournaments t
  where t.status <> 'done' or t.done_day >= (now() at time zone 'Asia/Tokyo')::date - 14
$$;

-- エントリー。返り値: 'ok' | 'bad'(形がちがう)| 'closed'(受付中でない)| 'nodeck'(みんなのデッキに登録が無い)| 'locked'(鍵がちがう)
create or replace function public.card_tournament_enter(p_tour text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare t public.card_tournaments; d public.card_deck_entries;
begin
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128 then return 'bad'; end if;
  select * into t from card_tournaments where id = p_tour;
  if not found or t.status <> 'entry' or now() >= t.entry_until then return 'closed'; end if;
  select * into d from card_deck_entries where owner_id = p_owner and active;
  if not found then return 'nodeck'; end if;
  if d.key_hash <> md5(p_key) then return 'locked'; end if;
  insert into card_tournament_entries (tournament_id, seat_id, owner_id, key_hash, user_name, icon, profile_frame)
    values (p_tour, p_owner, p_owner, md5(p_key), d.user_name, d.icon, d.profile_frame)
    -- 取り消した人がもう一度エントリーしたら、印を外して受付の順を今にする(行は消さない)
    on conflict (tournament_id, seat_id) do update set user_name = excluded.user_name, icon = excluded.icon, profile_frame = excluded.profile_frame,
      key_hash = excluded.key_hash, dropped = false,
      entered_at = case when card_tournament_entries.dropped then now() else card_tournament_entries.entered_at end;
  return 'ok';
end $$;

-- 取り消し(受付中だけ)。行は消さずに dropped の印を付ける(締め切り・一覧・対戦表は印の付いた人を入れない)。返り値: 'ok' | 'closed' | 'locked' | 'none'
create or replace function public.card_tournament_withdraw(p_tour text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare t public.card_tournaments; e public.card_tournament_entries;
begin
  select * into t from card_tournaments where id = p_tour;
  if not found or t.status <> 'entry' or now() >= t.entry_until then return 'closed'; end if;
  select * into e from card_tournament_entries where tournament_id = p_tour and owner_id = p_owner;
  if not found or e.dropped then return 'none'; end if;
  if p_key is null or e.key_hash <> md5(p_key) then return 'locked'; end if;
  update card_tournament_entries set dropped = true where tournament_id = p_tour and owner_id = p_owner;
  return 'ok';
end $$;

-- 対戦表と試合の一覧。結果(勝ち負け・倒した数・実況と解説)は、見せてよい時刻を過ぎた試合だけ
create or replace function public.card_tournament_view(p_tour text, p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tour', (select jsonb_build_object('id', t.id, 'name', t.name, 'open_on', t.open_on, 'entry_until', t.entry_until, 'status', t.status,
               'first_day', t.first_day, 'done_day', t.done_day, 'groups', t.groups, 'rewards', t.rewards) from card_tournaments t where t.id = p_tour),
    'me', exists (select 1 from card_tournament_entries e where e.tournament_id = p_tour and e.owner_id = p_owner and not e.dropped),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'seat_id', e.seat_id, 'mine', e.owner_id is not null and e.owner_id = p_owner, 'is_assist', e.is_assist, 'assist_id', e.assist_id,
        'user_name', e.user_name, 'icon', e.icon, 'profile_frame', e.profile_frame, 'monsters', e.deck -> 'monsters',
        'grp', e.grp, 'seat', e.seat, 'final_seat', e.final_seat, 'place', e.place, 'wins', e.wins) order by e.grp, e.seat, e.entered_at)
      from card_tournament_entries e where e.tournament_id = p_tour and not e.dropped), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'stage', m.stage, 'grp', m.grp, 'day', m.day, 'a', m.a_seat, 'b', m.b_seat, 'play_on', m.play_on, 'visible_at', m.visible_at,
        'winner', case when m.visible_at <= now() then m.winner end,
        'kos', case when m.visible_at <= now() then to_jsonb(m.kos) end,
        'decided', case when m.visible_at <= now() then m.decided end,
        'live', case when m.visible_at <= now() then m.live end) order by m.day, m.stage, m.grp, m.id)
      from card_tournament_matches m where m.tournament_id = p_tour), '[]'::jsonb))
$$;

-- 1試合の見返しの材料(見せてよい時刻を過ぎて、回し終えた試合だけ)。デッキは写し(助手の席は試合で使ったデッキ)
create or replace function public.card_tournament_match(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', m.id, 'tournament_id', m.tournament_id, 'stage', m.stage, 'day', m.day, 'seed', m.seed, 'first', m.first,
    'winner', m.winner, 'kos', to_jsonb(m.kos), 'rules', m.rules, 'acts', m.acts, 'live', m.live,
    'a', jsonb_build_object('name', ea.user_name, 'icon', ea.icon, 'is_assist', ea.is_assist, 'assist_id', ea.assist_id, 'deck', coalesce(ea.deck, m.assist_decks -> 0)),
    'b', jsonb_build_object('name', eb.user_name, 'icon', eb.icon, 'is_assist', eb.is_assist, 'assist_id', eb.assist_id, 'deck', coalesce(eb.deck, m.assist_decks -> 1)))
  from card_tournament_matches m
  join card_tournament_entries ea on ea.tournament_id = m.tournament_id and not ea.dropped
    and (case when m.stage = 'final' then ea.final_seat = m.a_seat else ea.grp = m.grp and ea.seat = m.a_seat end)
  join card_tournament_entries eb on eb.tournament_id = m.tournament_id and not eb.dropped
    and (case when m.stage = 'final' then eb.final_seat = m.b_seat else eb.grp = m.grp and eb.seat = m.b_seat end)
  where m.id = p_id and m.visible_at <= now() and m.winner is not null
$$;

-- ごほうびを1回だけ受け取る。返り値: { status: 'ok' | 'claimed' | 'none' | 'locked' | 'wait', point, title, frame, place }
create or replace function public.card_tournament_claim(p_tour text, p_owner text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.card_tournaments; e public.card_tournament_entries; r public.card_tournament_rewards;
begin
  select * into t from card_tournaments where id = p_tour;
  if not found or t.status <> 'done' or now() < (t.done_day::timestamp + interval '4 hours') at time zone 'Asia/Tokyo' then return jsonb_build_object('status', 'wait'); end if;
  select * into e from card_tournament_entries where tournament_id = p_tour and owner_id = p_owner;
  if not found then return jsonb_build_object('status', 'none'); end if;
  if p_key is null or e.key_hash <> md5(p_key) then return jsonb_build_object('status', 'locked'); end if;
  update card_tournament_rewards set claimed_at = now() where tournament_id = p_tour and owner_id = p_owner and claimed_at is null returning * into r;
  if not found then
    return jsonb_build_object('status', case when exists (select 1 from card_tournament_rewards where tournament_id = p_tour and owner_id = p_owner) then 'claimed' else 'none' end);
  end if;
  return jsonb_build_object('status', 'ok', 'point', r.point, 'title', r.title, 'frame', r.frame, 'place', r.place);
end $$;

revoke all on function public.card_tournament_list() from public;
revoke all on function public.card_tournament_enter(text, text, text) from public;
revoke all on function public.card_tournament_withdraw(text, text, text) from public;
revoke all on function public.card_tournament_view(text, text) from public;
revoke all on function public.card_tournament_match(bigint) from public;
revoke all on function public.card_tournament_claim(text, text, text) from public;
grant execute on function public.card_tournament_list() to anon, authenticated;
grant execute on function public.card_tournament_enter(text, text, text) to anon, authenticated;
grant execute on function public.card_tournament_withdraw(text, text, text) to anon, authenticated;
grant execute on function public.card_tournament_view(text, text) to anon, authenticated;
grant execute on function public.card_tournament_match(bigint) to anon, authenticated;
grant execute on function public.card_tournament_claim(text, text, text) to anon, authenticated;

-- サーバの上の関数が、決まった時刻の仕組みから呼ばれたかを確かめる(合言葉は vault の card_tournament_secret。service_role だけ)
create or replace function public.card_tournament_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_secret is not null and length(p_secret) >= 32 and exists (select 1 from vault.decrypted_secrets where name = 'card_tournament_secret' and decrypted_secret = p_secret)
$$;
revoke all on function public.card_tournament_secret_ok(text) from public, anon, authenticated;
grant execute on function public.card_tournament_secret_ok(text) to service_role;
