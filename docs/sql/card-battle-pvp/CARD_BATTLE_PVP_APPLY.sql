-- MFバトルカード マルチ対戦(人どうし)の表(2026-10-24 ブレイブくん)。区切り3で窓口が流す(足すだけの SQL)。
-- 端末から呼ぶのは 91-card-battle-multi.jsx の sbCardPvpReport(関数)と sbFetchCardPvpRatings(点数の表を読む)だけ。
-- 足すだけ。いまある表(rankings・card_battle_ranks・friend_invites など)は読みも書きもしない。
-- 何回流しても同じ結果になる(if not exists / create or replace)。

-- 強さの点数(1人1行)。書くのは下の関数だけ
create table if not exists public.card_battle_pvp_ratings (
  breeder_id   text        not null,
  user_name    text        not null,
  icon         text,
  profile_frame text,
  rating       integer     not null default 1500,
  wins         integer     not null default 0,
  loses        integer     not null default 0,
  best_rating  integer     not null default 1500,
  updated_at   timestamptz not null default now(),
  constraint card_battle_pvp_ratings_pkey primary key (breeder_id),
  constraint card_battle_pvp_ratings_range check (rating between 0 and 10000 and best_rating between 0 and 10000
    and wins between 0 and 10000000 and loses between 0 and 10000000)
);
create index if not exists card_battle_pvp_ratings_rating_idx on public.card_battle_pvp_ratings (rating desc);

-- 1試合1行。2人がそれぞれ結果を届け、合ったときだけ点数を動かす(applied で二重に数えない)
create table if not exists public.card_battle_pvp_matches (
  match_id     text        not null,
  a_id         text        not null,
  b_id         text        not null,
  a_winner     text,
  b_winner     text,
  a_reason     text,
  b_reason     text,
  turns        integer,
  applied      boolean     not null default false,
  created_at   timestamptz not null default now(),
  constraint card_battle_pvp_matches_pkey primary key (match_id),
  constraint card_battle_pvp_matches_id_shape check (match_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint card_battle_pvp_matches_two check (a_id <> b_id)
);

alter table public.card_battle_pvp_ratings enable row level security;
alter table public.card_battle_pvp_matches enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='card_battle_pvp_ratings' and policyname='card_battle_pvp_ratings_select') then
    create policy card_battle_pvp_ratings_select on public.card_battle_pvp_ratings for select to anon, authenticated using (true);
  end if;
end $$;
-- 表へ直接は書かせない(読むのは点数の表だけ)
grant select on public.card_battle_pvp_ratings to anon, authenticated;

-- 結果を届ける入口。me / foe … ブリーダーid、winner … 勝った人のブリーダーid、reason … 'ko'|'deck'|'surrender'|'leave'|'timeout'
create or replace function public.card_battle_pvp_report(
  p_match_id text, p_me text, p_foe text, p_winner text, p_reason text, p_turns integer,
  p_name text, p_icon text, p_frame text)
returns text language plpgsql security definer set search_path = public as $$
declare m public.card_battle_pvp_matches; ra integer; rb integer; ea numeric; k integer := 32; w text; l text;
begin
  if p_me is null or p_foe is null or p_me = p_foe or p_winner not in (p_me, p_foe) then return 'bad'; end if;
  insert into public.card_battle_pvp_matches (match_id, a_id, b_id) values (p_match_id, least(p_me, p_foe), greatest(p_me, p_foe))
    on conflict (match_id) do nothing;
  select * into m from public.card_battle_pvp_matches where match_id = p_match_id for update;
  if m.a_id <> least(p_me, p_foe) or m.b_id <> greatest(p_me, p_foe) then return 'bad'; end if;
  if p_me = m.a_id then update public.card_battle_pvp_matches set a_winner = p_winner, a_reason = p_reason, turns = coalesce(turns, p_turns) where match_id = p_match_id;
  else update public.card_battle_pvp_matches set b_winner = p_winner, b_reason = p_reason, turns = coalesce(turns, p_turns) where match_id = p_match_id; end if;
  insert into public.card_battle_pvp_ratings (breeder_id, user_name, icon, profile_frame) values (p_me, left(coalesce(p_name, ''), 40), p_icon, p_frame)
    on conflict (breeder_id) do update set user_name = excluded.user_name, icon = excluded.icon, profile_frame = excluded.profile_frame;
  select * into m from public.card_battle_pvp_matches where match_id = p_match_id;
  if m.applied or m.a_winner is null or m.b_winner is null then return 'wait'; end if;
  if m.a_winner <> m.b_winner then update public.card_battle_pvp_matches set applied = true where match_id = p_match_id; return 'mismatch'; end if;
  w := m.a_winner; l := case when w = m.a_id then m.b_id else m.a_id end;
  -- 3つの部屋(だれとでも・合言葉・フレンド招待)のどれでも点数を動かす(2026-10-24 社長「マルチは全部動くようにして」)。
  -- 同じ2人が続けて対戦しても小さくしない(いつも最大32点。社長「同じ相手と続けて当たったときも小さくしないで」)
  insert into public.card_battle_pvp_ratings (breeder_id, user_name) values (l, '') on conflict (breeder_id) do nothing;
  select rating into ra from public.card_battle_pvp_ratings where breeder_id = w;
  select rating into rb from public.card_battle_pvp_ratings where breeder_id = l;
  ea := 1 / (1 + power(10, (rb - ra) / 400.0));
  update public.card_battle_pvp_ratings set rating = least(10000, ra + round(k * (1 - ea))), best_rating = greatest(best_rating, least(10000, ra + round(k * (1 - ea)))), wins = wins + 1, updated_at = now() where breeder_id = w;
  update public.card_battle_pvp_ratings set rating = greatest(0, rb - round(k * (1 - ea))), loses = loses + 1, updated_at = now() where breeder_id = l;
  update public.card_battle_pvp_matches set applied = true where match_id = p_match_id;
  return 'applied';
end $$;
grant execute on function public.card_battle_pvp_report(text, text, text, text, text, integer, text, text, text) to anon, authenticated;

-- フレンドの招待(区切り4)。いまの friend_invites と同じ形の、カード用の新しい表
create table if not exists public.card_battle_invites (
  sender_id  text        not null,
  target_id  text        not null,
  room_code  text        not null,
  created_at timestamptz not null default now(),
  constraint card_battle_invites_pkey primary key (sender_id, target_id),
  constraint card_battle_invites_code_shape check (room_code ~ '^[A-HJ-NP-Z2-9]{4}$')
);
alter table public.card_battle_invites enable row level security;
-- (招待の読み書きの決まりは friend_invites と同じ形にする。区切り4で書く)

-- ---- 流したあとの確かめ(読むだけ) ----
select 'card_battle_pvp_ratings' as 表, count(*) as 行の数,
       (select case when c.relrowsecurity then '有効' else '無効(要確認)' end from pg_class c where c.oid = 'public.card_battle_pvp_ratings'::regclass) as rls
  from public.card_battle_pvp_ratings
union all
select 'card_battle_pvp_matches', count(*), (select case when c.relrowsecurity then '有効' else '無効(要確認)' end from pg_class c where c.oid = 'public.card_battle_pvp_matches'::regclass)
  from public.card_battle_pvp_matches
union all
select 'card_battle_invites', count(*), (select case when c.relrowsecurity then '有効' else '無効(要確認)' end from pg_class c where c.oid = 'public.card_battle_invites'::regclass)
  from public.card_battle_invites;

