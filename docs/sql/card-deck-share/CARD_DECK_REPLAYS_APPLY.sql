-- MFバトルカード: 登録デッキが戦われた試合の見返し(2026-10-31 社長「案A・戦った人の名前は出す・新しい20試合」)
-- 案: docs/progress/card-replay/deck-replays/README.md
--
-- 足すだけ。今の表(card_deck_entries・card_deck_uses・card_deck_rewards)は読むだけで、形も中身も変えない。
-- 行を消す命令(DELETE)は使わない。持ち主ごとに20の枠(slot 0〜19)を持ち、21試合目からはいちばん古い枠に上書きする。
--
-- 表
--   card_deck_replays … 登録デッキが戦われた試合(戦った人・両方のデッキ・種・先攻・ルールの版・手の並び)
-- 関数(ゲームから呼ぶ)
--   card_deck_replay_put(…)               … 戦った人の端末から。「戦った」の知らせ(card_deck_uses の 'battle')がある試合だけ・1試合1回
--                                            登録デッキは card_deck_entries から写す(端末の言うことを信じない)
--   card_deck_replays_of(owner, key)       … 登録した本人だけ。一覧(見出しだけ・新しい順)
--   card_deck_replay_get(owner, key, slot) … 登録した本人だけ。1試合の中身(card_tournament_match と同じ形)
-- 持ち主の見分けは、みんなのデッキと同じ owner_id(ブリーダーID)+ 端末の鍵(mh_card_deck_owner_key_v1)の md5

create table if not exists public.card_deck_replays (
  owner_id      text        not null,
  slot          integer     not null,
  match_id      text        not null,
  user_id       text        not null,
  user_name     text        not null default '',
  icon          text,
  profile_frame text,
  user_deck     jsonb       not null,
  owner_deck    jsonb       not null,
  owner_version integer     not null,
  seed          bigint      not null,
  first         integer     not null,
  rules         integer     not null,
  acts          jsonb       not null,
  turns         integer,
  deck_won      boolean     not null default false,
  at            timestamptz not null default now(),
  constraint card_deck_replays_pkey primary key (owner_id, slot),
  constraint card_deck_replays_shape check (slot between 0 and 19 and first in (0, 1) and match_id ~ '^[A-Za-z0-9_-]{8,64}$'
    and jsonb_typeof(acts) = 'array' and octet_length(acts::text) <= 30000
    and jsonb_typeof(user_deck) = 'object' and octet_length(user_deck::text) <= 2000 and length(user_name) <= 40)
);
create unique index if not exists card_deck_replays_match_idx on public.card_deck_replays (match_id);
-- 表を直接は読み書きさせない(下の関数だけ)
alter table public.card_deck_replays enable row level security;
revoke all on public.card_deck_replays from anon, authenticated;

-- 書く: 戦った人の端末から。返り値 'ok' | 'none'(「戦った」の知らせが無い・人が違う)| 'dup'(もう書いた)| 'old'(登録し直された)| 'bad'
create or replace function public.card_deck_replay_put(
  p_match_id text, p_owner text, p_user text, p_name text, p_icon text, p_frame text,
  p_user_deck jsonb, p_seed bigint, p_first integer, p_rules integer, p_acts jsonb, p_turns integer, p_deck_won boolean)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries; u public.card_deck_uses; s integer;
begin
  if p_match_id is null or p_match_id !~ '^[A-Za-z0-9_-]{8,64}$' or p_owner is null or p_user is null then return 'bad'; end if;
  if p_acts is null or jsonb_typeof(p_acts) <> 'array' or jsonb_array_length(p_acts) < 1 or jsonb_array_length(p_acts) > 4000 or octet_length(p_acts::text) > 30000 then return 'bad'; end if;
  if p_user_deck is null or jsonb_typeof(p_user_deck) <> 'object' or octet_length(p_user_deck::text) > 2000 then return 'bad'; end if;
  if p_first is null or p_first not in (0, 1) or p_seed is null or p_seed < 0 or p_seed > 4294967295 or p_rules is null then return 'bad'; end if;
  select * into u from public.card_deck_uses where match_id = p_match_id;
  if not found or u.owner_id <> p_owner or u.user_id <> p_user or u.kind <> 'battle' then return 'none'; end if;
  -- 同じ持ち主の書き込みは1つずつ(空いた枠えらびがぶつからないように)
  perform pg_advisory_xact_lock(hashtext('card_deck_replays|' || p_owner));
  if exists (select 1 from public.card_deck_replays where match_id = p_match_id) then return 'dup'; end if;
  select * into cur from public.card_deck_entries where owner_id = p_owner;
  if not found or cur.version <> u.version then return 'old'; end if;
  -- 空いている枠 → 無ければいちばん古い枠に上書き
  select g into s from generate_series(0, 19) g
    where not exists (select 1 from public.card_deck_replays r where r.owner_id = p_owner and r.slot = g) order by g limit 1;
  if s is null then select slot into s from public.card_deck_replays where owner_id = p_owner order by at asc, slot asc limit 1; end if;
  insert into public.card_deck_replays (owner_id, slot, match_id, user_id, user_name, icon, profile_frame, user_deck, owner_deck, owner_version, seed, first, rules, acts, turns, deck_won, at)
    values (p_owner, s, p_match_id, p_user, left(coalesce(p_name, ''), 40), left(p_icon, 64), left(p_frame, 40), p_user_deck, cur.deck, cur.version,
      p_seed, p_first, p_rules, p_acts, p_turns, coalesce(p_deck_won, false), now())
    on conflict (owner_id, slot) do update set match_id = excluded.match_id, user_id = excluded.user_id, user_name = excluded.user_name, icon = excluded.icon,
      profile_frame = excluded.profile_frame, user_deck = excluded.user_deck, owner_deck = excluded.owner_deck, owner_version = excluded.owner_version,
      seed = excluded.seed, first = excluded.first, rules = excluded.rules, acts = excluded.acts, turns = excluded.turns, deck_won = excluded.deck_won, at = excluded.at;
  return 'ok';
end $$;

-- 読む: 登録した本人だけ(持ち主の鍵)。一覧は見出しだけ。old … 今の登録より前の登録で戦われた試合
create or replace function public.card_deck_replays_of(p_owner text, p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', r.slot, 'at', r.at, 'name', r.user_name, 'icon', r.icon, 'frame', r.profile_frame,
    'deck_won', r.deck_won, 'turns', r.turns, 'old', r.owner_version <> e.version) order by r.at desc), '[]'::jsonb)
  from public.card_deck_replays r join public.card_deck_entries e on e.owner_id = r.owner_id
  where r.owner_id = p_owner and p_key is not null and e.key_hash = md5(p_key)
$$;

-- 1試合の中身(card_tournament_match と同じ形)。a = 戦った人(見返しの下)・b = 登録デッキ(上)。winner … 1 なら登録デッキの勝ち
create or replace function public.card_deck_replay_get(p_owner text, p_key text, p_slot integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.slot, 'kind', 'deck', 'seed', r.seed, 'first', r.first, 'rules', r.rules, 'acts', r.acts,
    'winner', case when r.deck_won then 1 else 0 end,
    'a', jsonb_build_object('name', r.user_name, 'icon', r.icon, 'is_assist', false, 'deck', r.user_deck),
    'b', jsonb_build_object('name', e.user_name, 'icon', e.icon, 'is_assist', false, 'deck', r.owner_deck))
  from public.card_deck_replays r join public.card_deck_entries e on e.owner_id = r.owner_id
  where r.owner_id = p_owner and r.slot = p_slot and p_key is not null and e.key_hash = md5(p_key)
$$;

grant execute on function public.card_deck_replay_put(text, text, text, text, text, text, jsonb, bigint, integer, integer, jsonb, integer, boolean) to anon, authenticated;
grant execute on function public.card_deck_replays_of(text, text) to anon, authenticated;
grant execute on function public.card_deck_replay_get(text, text, integer) to anon, authenticated;
