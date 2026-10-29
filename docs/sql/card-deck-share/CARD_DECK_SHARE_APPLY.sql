-- MFバトルカード: デッキ登録の対戦・デッキのレンタル(2026-10-29 社長「すぐ作り始める」・カード部 ツナグくん)
-- 流すのは統括部長。足すだけ(いまの表は変えない)。何度流しても同じになる(if not exists・create or replace)
--
-- 表
--   card_deck_entries … 1人1組の登録デッキ(だれでも読める。持ち主の鍵の指紋 key_hash だけは読ませない)
--   card_deck_uses    … 登録デッキと戦った・借りて使った記録(試合ごとに1行。読ませない)
--   card_deck_rewards … 貸した人が受け取った日の印((人・日)で1行。読ませない)
-- 関数(表へ書くのは関数だけ)
--   card_deck_register(owner, key, name, icon, frame, deck, tactics) … 登録・登録し直し。2回目からは同じ鍵が要る
--   card_deck_unregister(owner, key)                               … 登録をやめる(みんなのデッキに出さない)
--   card_deck_use(match_id, owner, user, kind, deck_won, version)   … 戦った('battle')・借りて使った('rent')を1回だけ数える
--   card_deck_claim(owner, key)                                    … 前の日までの報酬を数えて、(人・日)で1回だけ渡す
-- 報酬(ビートP): 戦われた1回 10・登録デッキが勝った回は +10・借りて使われた1回 15。
--   同じ人からの分は1日3回まで数える・1人が1日に受け取れるのは 300 まで。日の区切りは日本時間の 0:00
-- 持ち主の鍵: 登録した端末が作る長い文字列(mh_card_deck_owner_key_v1)。表には md5 の指紋だけを置く(ブリーダーの番号は人に見えるので、
--   番号だけで登録を書きかえたり報酬を受け取ったりできないようにする)

create table if not exists public.card_deck_entries (
  owner_id      text        not null,
  key_hash      text        not null,
  user_name     text        not null default '',
  icon          text,
  profile_frame text,
  deck          jsonb       not null,
  tactics       jsonb       not null default '{}'::jsonb,
  version       integer     not null default 1,
  active        boolean     not null default true,
  battles       integer     not null default 0,
  deck_wins     integer     not null default 0,
  rents         integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint card_deck_entries_pkey primary key (owner_id),
  constraint card_deck_entries_id_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint card_deck_entries_sizes check (octet_length(deck::text) <= 2000 and octet_length(tactics::text) <= 2000 and length(user_name) <= 40),
  constraint card_deck_entries_counts check (version between 1 and 1000000 and battles >= 0 and deck_wins >= 0 and rents >= 0)
);
create index if not exists card_deck_entries_battles_idx on public.card_deck_entries (active, battles desc);
create index if not exists card_deck_entries_updated_idx on public.card_deck_entries (active, updated_at desc);

create table if not exists public.card_deck_uses (
  match_id  text        not null,
  owner_id  text        not null,
  user_id   text        not null,
  kind      text        not null,
  deck_won  boolean     not null default false,
  version   integer     not null default 1,
  day       date        not null,
  at        timestamptz not null default now(),
  constraint card_deck_uses_pkey primary key (match_id),
  constraint card_deck_uses_shape check (match_id ~ '^[A-Za-z0-9_-]{8,64}$' and kind in ('battle', 'rent') and owner_id <> user_id)
);
create index if not exists card_deck_uses_owner_day_idx on public.card_deck_uses (owner_id, day);

create table if not exists public.card_deck_rewards (
  owner_id   text        not null,
  day        date        not null,
  amount     integer     not null,
  uses       integer     not null default 0,
  claimed_at timestamptz not null default now(),
  constraint card_deck_rewards_pkey primary key (owner_id, day),
  constraint card_deck_rewards_amount check (amount between 0 and 300 and uses >= 0)
);

alter table public.card_deck_entries enable row level security;
alter table public.card_deck_uses enable row level security;
alter table public.card_deck_rewards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'card_deck_entries' and policyname = 'card_deck_entries_select') then
    create policy card_deck_entries_select on public.card_deck_entries for select to anon, authenticated using (active);
  end if;
end $$;
-- Supabase は新しい表に anon・authenticated の全部の権限を付ける。いったん全部外して、読むのは登録デッキの見せてよい列だけ
revoke all on public.card_deck_entries from anon, authenticated;
revoke all on public.card_deck_uses from anon, authenticated;
revoke all on public.card_deck_rewards from anon, authenticated;
grant select (owner_id, user_name, icon, profile_frame, deck, tactics, version, active, battles, deck_wins, rents, updated_at)
  on public.card_deck_entries to anon, authenticated;

-- 日本時間の今日
create or replace function public.card_deck_today()
returns date language sql stable set search_path = public as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

-- 登録・登録し直し。返り値: 'ok' | 'bad'(形がちがう) | 'locked'(鍵がちがう)
create or replace function public.card_deck_register(
  p_owner text, p_key text, p_name text, p_icon text, p_frame text, p_deck jsonb, p_tactics jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries; mons jsonb; cards jsonb; ok boolean;
begin
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128 then return 'bad'; end if;
  if p_deck is null or jsonb_typeof(p_deck) <> 'object' or p_tactics is null or jsonb_typeof(p_tactics) <> 'object'
    or octet_length(p_deck::text) > 2000 or octet_length(p_tactics::text) > 2000 then return 'bad'; end if;
  mons := p_deck -> 'monsters'; cards := p_deck -> 'cards';
  if jsonb_typeof(mons) <> 'array' or jsonb_array_length(mons) <> 3 or jsonb_typeof(cards) <> 'array' or jsonb_array_length(cards) <> 50 then return 'bad'; end if;
  select bool_and(jsonb_typeof(x) = 'string' and (x #>> '{}') ~ '^C-[0-9]{3}$') into ok from jsonb_array_elements(mons) x;
  if not ok then return 'bad'; end if;
  select bool_and(jsonb_typeof(x) = 'string' and (x #>> '{}') ~ '^[0-9]{3}$') into ok from jsonb_array_elements(cards) x;
  if not ok then return 'bad'; end if;
  -- 同じ番号のカードは3枚まで(同じ名前で番号がちがう札は、登録の画面で確かめる)
  if exists (select 1 from jsonb_array_elements_text(cards) c group by c having count(*) > 3) then return 'bad'; end if;
  select * into cur from public.card_deck_entries where owner_id = p_owner for update;
  if found then
    if cur.key_hash <> md5(p_key) then return 'locked'; end if;
    update public.card_deck_entries set user_name = left(coalesce(p_name, ''), 40), icon = left(p_icon, 64), profile_frame = left(p_frame, 40),
      deck = jsonb_build_object('monsters', mons, 'cards', cards), tactics = p_tactics, version = least(1000000, version + 1), active = true, updated_at = now()
      where owner_id = p_owner;
  else
    insert into public.card_deck_entries (owner_id, key_hash, user_name, icon, profile_frame, deck, tactics)
      values (p_owner, md5(p_key), left(coalesce(p_name, ''), 40), left(p_icon, 64), left(p_frame, 40), jsonb_build_object('monsters', mons, 'cards', cards), p_tactics);
  end if;
  return 'ok';
end $$;

-- 登録をやめる(みんなのデッキに出さない。行と数は残す)。返り値: 'ok' | 'none' | 'locked'
create or replace function public.card_deck_unregister(p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries;
begin
  select * into cur from public.card_deck_entries where owner_id = p_owner for update;
  if not found then return 'none'; end if;
  if p_key is null or cur.key_hash <> md5(p_key) then return 'locked'; end if;
  update public.card_deck_entries set active = false, updated_at = now() where owner_id = p_owner;
  return 'ok';
end $$;

-- 戦った・借りて使ったを数える(試合の番号ごとに1回だけ)。返り値: 'ok' | 'dup' | 'self' | 'none' | 'bad'
create or replace function public.card_deck_use(
  p_match_id text, p_owner text, p_user text, p_kind text, p_deck_won boolean, p_version integer)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries; n integer;
begin
  if p_match_id is null or p_match_id !~ '^[A-Za-z0-9_-]{8,64}$' or p_kind not in ('battle', 'rent') or p_user is null or p_user !~ '^[A-Za-z0-9_-]{1,64}$' then return 'bad'; end if;
  if p_owner = p_user then return 'self'; end if;
  select * into cur from public.card_deck_entries where owner_id = p_owner;
  if not found then return 'none'; end if;
  insert into public.card_deck_uses (match_id, owner_id, user_id, kind, deck_won, version, day)
    values (p_match_id, p_owner, p_user, p_kind, p_kind = 'battle' and coalesce(p_deck_won, false), coalesce(p_version, cur.version), public.card_deck_today())
    on conflict (match_id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'dup'; end if;
  update public.card_deck_entries
     set battles = battles + (case when p_kind = 'battle' then 1 else 0 end),
         deck_wins = deck_wins + (case when p_kind = 'battle' and coalesce(p_deck_won, false) then 1 else 0 end),
         rents = rents + (case when p_kind = 'rent' then 1 else 0 end)
   where owner_id = p_owner;
  return 'ok';
end $$;

-- 前の日までの報酬を受け取る。(人・日)で1回だけ。返り値: { "status": 'ok'|'locked'|'none', "total": 合計, "days": [{ "day", "amount", "uses" }] }
create or replace function public.card_deck_claim(p_owner text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries; r record; total integer := 0; days jsonb := '[]'::jsonb;
begin
  select * into cur from public.card_deck_entries where owner_id = p_owner;
  if not found then return jsonb_build_object('status', 'none', 'total', 0, 'days', days); end if;
  if p_key is null or cur.key_hash <> md5(p_key) then return jsonb_build_object('status', 'locked', 'total', 0, 'days', days); end if;
  for r in
    with ranked as (
      select u.day, u.kind, u.deck_won,
             row_number() over (partition by u.day, u.user_id order by u.at, u.match_id) as nth
        from public.card_deck_uses u
       where u.owner_id = p_owner and u.day < public.card_deck_today()
         and not exists (select 1 from public.card_deck_rewards w where w.owner_id = p_owner and w.day = u.day)
    )
    select day, count(*)::integer as uses,
           least(300, sum(case when kind = 'battle' then 10 + (case when deck_won then 10 else 0 end) else 15 end))::integer as amount
      from ranked where nth <= 3 group by day order by day
  loop
    insert into public.card_deck_rewards (owner_id, day, amount, uses) values (p_owner, r.day, r.amount, r.uses) on conflict (owner_id, day) do nothing;
    if found then
      total := total + r.amount;
      days := days || jsonb_build_object('day', r.day, 'amount', r.amount, 'uses', r.uses);
    end if;
  end loop;
  return jsonb_build_object('status', 'ok', 'total', total, 'days', days);
end $$;

revoke all on function public.card_deck_register(text, text, text, text, text, jsonb, jsonb) from public;
revoke all on function public.card_deck_unregister(text, text) from public;
revoke all on function public.card_deck_use(text, text, text, text, boolean, integer) from public;
revoke all on function public.card_deck_claim(text, text) from public;
grant execute on function public.card_deck_register(text, text, text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.card_deck_unregister(text, text) to anon, authenticated;
grant execute on function public.card_deck_use(text, text, text, text, boolean, integer) to anon, authenticated;
grant execute on function public.card_deck_claim(text, text) to anon, authenticated;
grant execute on function public.card_deck_today() to anon, authenticated;

-- ---- 足し(2026-10-29・区切り⑤): 受け取った報酬の一覧を読む(本人の鍵が要る・読むだけ) ----
-- 端末は「サーバで受け取った日」のうち、まだ端末に足していない日だけをビートPに足す(端末の保存に失敗しても、次に開いたときに足し直せる)
create or replace function public.card_deck_rewards_of(p_owner text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries;
begin
  select * into cur from public.card_deck_entries where owner_id = p_owner;
  if not found or p_key is null or cur.key_hash <> md5(p_key) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'amount', r.amount, 'uses', r.uses) order by r.day desc)
    from (select day, amount, uses from public.card_deck_rewards where owner_id = p_owner and day >= public.card_deck_today() - 60 order by day desc limit 60) r), '[]'::jsonb);
end $$;
revoke all on function public.card_deck_rewards_of(text, text) from public;
grant execute on function public.card_deck_rewards_of(text, text) to anon, authenticated;

-- ---- 流したあとの確かめ(読むだけ) ----
select c.relname as 表, case when c.relrowsecurity then '有効' else '無効(要確認)' end as rls
  from pg_class c where c.oid in ('public.card_deck_entries'::regclass, 'public.card_deck_uses'::regclass, 'public.card_deck_rewards'::regclass);
