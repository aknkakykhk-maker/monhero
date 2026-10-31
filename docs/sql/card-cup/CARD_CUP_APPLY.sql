-- MFバトルカード 個人杯(2026-10-31 社長「作り始めて」・カード部 ルールくん)。案は docs/progress/card-tournament/personal-cup/README.md・仕様は docs/spec/CARD_CUP.md
-- 流すのは統括部長。足すだけ(いまの表は変えない。みんなのデッキの表 card_deck_entries は読むだけ)。何度流しても同じになる。行を消す命令は書かない(消すときは印)
--
-- 表(どれも直接は読ませない。読むのも書くのも関数だけ)
--   card_cups         … 個人杯(主催・名前・遊び方 live/auto・形式 rr/ko・人数の上限・合言葉・公開の一覧に出すか・時刻・状態・山の並び)
--   card_cup_entries  … 参加者(オート杯は締め切りで登録デッキの写しを取る)
--   card_cup_matches  … 試合(種・先攻・勝ち負け・手の並び・実況)
-- 関数(ゲームから呼ぶ)
--   card_cup_create(owner, key, name, host_name, icon, mode, format, max, listed, entry_until, start_at) … 開く(主催も参加者になる)
--   card_cup_list()                    … 公開の一覧(受付中だけ)
--   card_cup_mine(owner)               … 自分が開いた・出ている杯(終わって14日まで)
--   card_cup_find(code)                … 合言葉から杯を探す(受付中だけ)
--   card_cup_join(cup, owner, key, name, icon) / card_cup_leave(cup, owner, key) / card_cup_cancel(cup, owner, key)
--   card_cup_view(cup, owner)          … 杯の様子(オート杯の結果は発表の時刻から)
--   card_cup_match(id)                 … 1試合の見返しの材料(見せてよい試合だけ)
-- オート杯の試合を回すのはサーバの上の関数 card-tournament-run(service_role)。呼ぶ時刻は CARD_CUP_SCHEDULE.sql(1日中10分おき)
-- リアルタイム杯の集合・試合の結果の関数は、あとの段階(④)で足す。結果の決め方はマルチ対戦と同じ(2026-10-31 社長)。来ない人は登録デッキが自動で戦う
-- 持ち主の見分けは、みんなのデッキと同じ owner_id(ブリーダーID)+ 端末の鍵(mh_card_deck_owner_key_v1)。表には md5 の指紋だけ
-- ★続き: CARD_CUP_PUBLIC_DONE.sql(終わった公開の杯の一覧・30日・見返しの範囲。2026-10-31)。このファイルを流し直したら、続きも流し直す

create table if not exists public.card_cups (
  id            text        not null,
  host_id       text        not null,
  host_name     text        not null default '',
  host_icon     text,
  name          text        not null,
  mode          text        not null,
  format        text        not null,
  max_players   integer     not null,
  code          text        not null,
  listed        boolean     not null default true,
  status        text        not null default 'entry',
  entry_until   timestamptz not null,
  start_at      timestamptz not null,
  bracket       jsonb,
  closed_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  done_at       timestamptz,
  constraint card_cups_pkey primary key (id),
  constraint card_cups_id_shape check (id ~ '^[a-z0-9_-]{1,32}$'),
  constraint card_cups_mode check (mode in ('live', 'auto')),
  constraint card_cups_format check (format in ('rr', 'ko')),
  constraint card_cups_status check (status in ('entry', 'running', 'done', 'closed')),
  constraint card_cups_max check ((format = 'rr' and max_players between 4 and 8) or (format = 'ko' and max_players between 4 and 16)),
  constraint card_cups_sizes check (length(name) between 1 and 20 and length(host_name) <= 40 and code ~ '^[0-9]{6}$')
);
create index if not exists card_cups_open_idx on public.card_cups (status, start_at) where status in ('entry', 'running');
create index if not exists card_cups_host_idx on public.card_cups (host_id, status);

create table if not exists public.card_cup_entries (
  cup_id        text        not null references public.card_cups (id),
  owner_id      text        not null,
  key_hash      text        not null,
  user_name     text        not null default '',
  icon          text,
  entered_at    timestamptz not null default now(),
  dropped       boolean     not null default false,
  deck          jsonb,
  tactics       jsonb,
  deck_version  integer,
  seat          integer,
  place         integer,
  wins          integer,
  checkin_at    timestamptz,
  constraint card_cup_entries_pkey primary key (cup_id, owner_id),
  constraint card_cup_entries_owner_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint card_cup_entries_sizes check (length(user_name) <= 40 and octet_length(coalesce(deck, '{}'::jsonb)::text) <= 2000 and octet_length(coalesce(tactics, '{}'::jsonb)::text) <= 2000)
);
create index if not exists card_cup_entries_owner_idx on public.card_cup_entries (owner_id) where not dropped;

create table if not exists public.card_cup_matches (
  id         bigserial   not null,
  cup_id     text        not null references public.card_cups (id),
  round      integer     not null,
  slot       integer     not null,
  a_seat     integer     not null,
  b_seat     integer     not null,
  seed       bigint      not null,
  first      integer     not null,
  winner     integer,
  kos        integer[],
  acts       jsonb,
  decided    text,
  rules      integer,
  live       jsonb,
  done_at    timestamptz,
  constraint card_cup_matches_pkey primary key (id),
  constraint card_cup_matches_one unique (cup_id, round, slot),
  constraint card_cup_matches_winner check (winner is null or winner in (0, 1))
);

alter table public.card_cups enable row level security;
alter table public.card_cup_entries enable row level security;
alter table public.card_cup_matches enable row level security;
revoke all on public.card_cups from anon, authenticated;
revoke all on public.card_cup_entries from anon, authenticated;
revoke all on public.card_cup_matches from anon, authenticated;

-- 開く。返り値 { status, id, code }。status: 'ok' | 'bad'(形がちがう)| 'busy'(開いている杯がもうある)| 'slot'(その発表の時刻はいっぱい)
--   | 'crowded'(全体の上限)| 'many'(出ている杯が多い)| 'nodeck'(オート杯は登録デッキが要る)| 'locked'(鍵がちがう)
--   決まり: 名前1〜20字 / 総当たり4〜8人・トーナメント4〜16人 / 1人が開ける杯は同時に1つ / 出られる杯は同時に3つ / 同時に開いている杯は全体で200まで
--   どちらの遊び方も主催と参加者は登録デッキが要る(リアルタイム杯でも、来ない人は登録デッキが自動で戦うため。2026-10-31 社長の答えを待つ案)
--   オート杯: 締め切りは10分後〜3日後・発表は締め切りの1時間後から・ちょうどの時(分は0)・同じ発表の時刻は3杯まで
--   リアルタイム杯: 始まる時刻は15分後〜3日後・15分きざみ。締め切りは始まる時刻
create or replace function public.card_cup_create(p_owner text, p_key text, p_name text, p_host_name text, p_icon text,
  p_mode text, p_format text, p_max integer, p_listed boolean, p_entry_until timestamptz, p_start_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.card_deck_entries; v_id text; v_code text; v_until timestamptz; v_hash text;
begin
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128
    or p_name is null or length(btrim(p_name)) not between 1 and 20 or length(coalesce(p_host_name, '')) > 40
    or p_mode not in ('live', 'auto') or p_format not in ('rr', 'ko') or p_max is null
    or (p_format = 'rr' and p_max not between 4 and 8) or (p_format = 'ko' and p_max not between 4 and 16) or p_start_at is null then
    return jsonb_build_object('status', 'bad');
  end if;
  if p_mode = 'auto' then
    if p_entry_until is null or p_entry_until < now() + interval '10 minutes' or p_entry_until > now() + interval '3 days'
      or p_start_at < p_entry_until + interval '1 hour' or p_start_at > now() + interval '4 days'
      or date_trunc('hour', p_start_at) <> p_start_at then return jsonb_build_object('status', 'bad'); end if;
    v_until := p_entry_until;
  else
    if p_start_at < now() + interval '15 minutes' or p_start_at > now() + interval '3 days'
      or date_trunc('minute', p_start_at) <> p_start_at or extract(minute from p_start_at)::int % 15 <> 0 then return jsonb_build_object('status', 'bad'); end if;
    v_until := p_start_at;
  end if;
  v_hash := md5(p_key);
  select * into d from card_deck_entries where owner_id = p_owner and active;
  if not found then return jsonb_build_object('status', 'nodeck'); end if;
  if d.key_hash <> v_hash then return jsonb_build_object('status', 'locked'); end if;
  if exists (select 1 from card_cups where host_id = p_owner and status in ('entry', 'running')) then return jsonb_build_object('status', 'busy'); end if;
  if (select count(*) from card_cup_entries e join card_cups c on c.id = e.cup_id where e.owner_id = p_owner and not e.dropped and c.status in ('entry', 'running')) >= 3 then
    return jsonb_build_object('status', 'many');
  end if;
  if (select count(*) from card_cups where status in ('entry', 'running')) >= 200 then return jsonb_build_object('status', 'crowded'); end if;
  if p_mode = 'auto' and (select count(*) from card_cups where mode = 'auto' and status in ('entry', 'running') and start_at = p_start_at) >= 3 then
    return jsonb_build_object('status', 'slot');
  end if;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from card_cups where code = v_code and status in ('entry', 'running'));
  end loop;
  v_id := 'c' || substr(md5(random()::text || clock_timestamp()::text || p_owner), 1, 11);
  insert into card_cups (id, host_id, host_name, host_icon, name, mode, format, max_players, code, listed, entry_until, start_at)
    values (v_id, p_owner, coalesce(p_host_name, ''), p_icon, btrim(p_name), p_mode, p_format, p_max, v_code, coalesce(p_listed, true), v_until, p_start_at);
  insert into card_cup_entries (cup_id, owner_id, key_hash, user_name, icon) values (v_id, p_owner, v_hash, coalesce(p_host_name, ''), p_icon);
  return jsonb_build_object('status', 'ok', 'id', v_id, 'code', v_code);
end $$;

-- 杯の1行を、一覧に出す形へ(合言葉は出さない)
create or replace function public.card_cup_row(c public.card_cups)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'host_id', c.host_id, 'host_name', c.host_name, 'host_icon', c.host_icon, 'mode', c.mode, 'format', c.format,
    'max', c.max_players, 'listed', c.listed, 'status', c.status, 'entry_until', c.entry_until, 'start_at', c.start_at, 'closed_reason', c.closed_reason, 'done_at', c.done_at,
    'players', (select count(*) from card_cup_entries e where e.cup_id = c.id and not e.dropped))
$$;

-- 公開の一覧(受付中・一覧に出す杯・始まりの早い順に50まで)
create or replace function public.card_cup_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card_cup_row(c) order by c.start_at), '[]'::jsonb)
  from (select * from card_cups where status = 'entry' and listed and entry_until > now() order by start_at limit 50) c
$$;

-- 自分が開いた・出ている杯(受付中・開催中と、終わって14日まで)
create or replace function public.card_cup_mine(p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card_cup_row(c) order by c.start_at desc), '[]'::jsonb)
  from card_cups c
  where exists (select 1 from card_cup_entries e where e.cup_id = c.id and e.owner_id = p_owner and not e.dropped)
    and (c.status in ('entry', 'running') or coalesce(c.done_at, c.updated_at) > now() - interval '14 days')
$$;

-- 合言葉から探す(受付中だけ)。返り値: 杯の1行 / null
create or replace function public.card_cup_find(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select card_cup_row(c) from card_cups c where p_code ~ '^[0-9]{6}$' and c.code = p_code and c.status = 'entry' and c.entry_until > now() limit 1
$$;

-- 入る。返り値: 'ok' | 'bad' | 'closed' | 'full' | 'many' | 'nodeck' | 'locked'
create or replace function public.card_cup_join(p_cup text, p_owner text, p_key text, p_name text, p_icon text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; d public.card_deck_entries; e public.card_cup_entries; v_hash text;
begin
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128 or length(coalesce(p_name, '')) > 40 then return 'bad'; end if;
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  v_hash := md5(p_key);
  select * into d from card_deck_entries where owner_id = p_owner and active;
  if not found then return 'nodeck'; end if;
  if d.key_hash <> v_hash then return 'locked'; end if;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = p_owner;
  if found and e.key_hash <> v_hash then return 'locked'; end if;
  if found and not e.dropped then return 'ok'; end if;
  if (select count(*) from card_cup_entries where cup_id = p_cup and not dropped) >= c.max_players then return 'full'; end if;
  if (select count(*) from card_cup_entries x join card_cups y on y.id = x.cup_id where x.owner_id = p_owner and not x.dropped and y.status in ('entry', 'running')) >= 3 then return 'many'; end if;
  insert into card_cup_entries (cup_id, owner_id, key_hash, user_name, icon) values (p_cup, p_owner, v_hash, coalesce(p_name, ''), p_icon)
    on conflict (cup_id, owner_id) do update set dropped = false, user_name = excluded.user_name, icon = excluded.icon, entered_at = now();
  return 'ok';
end $$;

-- 抜ける(受付中だけ。行は消さずに印)。主催は抜けられない(取り消す)。返り値: 'ok' | 'closed' | 'none' | 'locked' | 'host'
create or replace function public.card_cup_leave(p_cup text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if c.host_id = p_owner then return 'host'; end if;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = p_owner;
  if not found or e.dropped then return 'none'; end if;
  if p_key is null or e.key_hash <> md5(p_key) then return 'locked'; end if;
  update card_cup_entries set dropped = true where cup_id = p_cup and owner_id = p_owner;
  return 'ok';
end $$;

-- 主催が取り消す(受付中だけ。行は消さずに状態を 'closed' に)。返り値: 'ok' | 'closed' | 'locked'
create or replace function public.card_cup_cancel(p_cup text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.status <> 'entry' then return 'closed'; end if;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = c.host_id;
  if c.host_id <> p_owner or not found or p_key is null or e.key_hash <> md5(p_key) then return 'locked'; end if;
  update card_cups set status = 'closed', closed_reason = 'host', updated_at = now() where id = p_cup;
  return 'ok';
end $$;

-- 杯の様子。合言葉は参加者にだけ。結果: オート杯は発表の時刻を過ぎて終わった杯だけ・リアルタイム杯はすぐ
create or replace function public.card_cup_view(p_cup text, p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select * from card_cups where id = p_cup),
  me as (select exists (select 1 from card_cup_entries e where e.cup_id = p_cup and e.owner_id = p_owner and not e.dropped) as v),
  vis as (select (c.mode = 'live' or (c.status = 'done' and now() >= c.start_at)) as v from c)
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'cup', (select card_cup_row(c) || jsonb_build_object('code', case when (select v from me) then c.code end, 'bracket', case when (select v from vis) then c.bracket end) from c),
    'me', (select v from me),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('owner_id', e.owner_id, 'mine', e.owner_id = p_owner, 'user_name', e.user_name, 'icon', e.icon,
        'monsters', e.deck -> 'monsters', 'seat', e.seat, 'checkin', e.checkin_at is not null,
        'place', case when (select v from vis) then e.place end, 'wins', case when (select v from vis) then e.wins end) order by e.seat nulls last, e.entered_at)
      from card_cup_entries e where e.cup_id = p_cup and not e.dropped), '[]'::jsonb),
    'matches', case when (select v from vis) then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'round', m.round, 'slot', m.slot, 'a', m.a_seat, 'b', m.b_seat,
        'winner', m.winner, 'kos', to_jsonb(m.kos), 'decided', m.decided, 'live', m.live) order by m.round, m.slot)
      from card_cup_matches m where m.cup_id = p_cup), '[]'::jsonb) else '[]'::jsonb end) end
$$;

-- 1試合の見返しの材料(見せてよい試合だけ)
create or replace function public.card_cup_match(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', m.id, 'cup_id', m.cup_id, 'round', m.round, 'slot', m.slot, 'seed', m.seed, 'first', m.first, 'winner', m.winner, 'kos', to_jsonb(m.kos),
    'rules', m.rules, 'acts', m.acts, 'live', m.live,
    'a', jsonb_build_object('name', ea.user_name, 'icon', ea.icon, 'deck', ea.deck),
    'b', jsonb_build_object('name', eb.user_name, 'icon', eb.icon, 'deck', eb.deck))
  from card_cup_matches m
  join card_cups c on c.id = m.cup_id
  join card_cup_entries ea on ea.cup_id = m.cup_id and ea.seat = m.a_seat
  join card_cup_entries eb on eb.cup_id = m.cup_id and eb.seat = m.b_seat
  where m.id = p_id and m.winner is not null and m.acts is not null and (c.mode = 'live' or (c.status = 'done' and now() >= c.start_at))
$$;

revoke all on function public.card_cup_create(text, text, text, text, text, text, text, integer, boolean, timestamptz, timestamptz) from public;
revoke all on function public.card_cup_row(public.card_cups) from public;
revoke all on function public.card_cup_list() from public;
revoke all on function public.card_cup_mine(text) from public;
revoke all on function public.card_cup_find(text) from public;
revoke all on function public.card_cup_join(text, text, text, text, text) from public;
revoke all on function public.card_cup_leave(text, text, text) from public;
revoke all on function public.card_cup_cancel(text, text, text) from public;
revoke all on function public.card_cup_view(text, text) from public;
revoke all on function public.card_cup_match(bigint) from public;
grant execute on function public.card_cup_create(text, text, text, text, text, text, text, integer, boolean, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.card_cup_list() to anon, authenticated;
grant execute on function public.card_cup_mine(text) to anon, authenticated;
grant execute on function public.card_cup_find(text) to anon, authenticated;
grant execute on function public.card_cup_join(text, text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_leave(text, text, text) to anon, authenticated;
grant execute on function public.card_cup_cancel(text, text, text) to anon, authenticated;
grant execute on function public.card_cup_view(text, text) to anon, authenticated;
grant execute on function public.card_cup_match(bigint) to anon, authenticated;
