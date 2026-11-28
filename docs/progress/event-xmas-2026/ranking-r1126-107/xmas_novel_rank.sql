-- 事件簿(聖夜の名探偵)のランキングの表と関数(案・r1126-107・2026-11-28 バトル部)。設計: docs/progress/event-xmas-2026/ranking-r1126-107/README.md
-- 社長の選択(r1126-107 追記1): はじめのタブは見たエンドの数・遊んだ回数はエンドに着いた回数(同じエンドは1日1回まで)・入口は事件簿の起動画面だけ・ごほうびなし。
-- 確定版(2026-11-28)。流すのは窓口。
-- 流すのは窓口。**足すだけ**(既存の表・関数・ランキング・保存には触らない)。何度流しても同じになる(if not exists・create or replace・on conflict do nothing)。
-- 前提: 202611110001_masmon_pvp.sql(持ち主の鍵 masmon_pvp_owner_check を使い回す)。
--
-- 表(どれも新しい。書くのは下の関数 xmas_novel_rank_submit だけ。端末は表に直接書けない)
--   xmas_novel_end_ids … 数えてよいエンドの一覧(弾を出すたびに窓口が行を足す。ここに無いエンドは送っても数えない)
--   xmas_novel_players … 人ごとの名前・前の記録の取りこみ済みの印・隠す印
--   xmas_novel_plays   … 1行 = (人・日・エンド)。同じエンドは1日1回まで。見たエンドの数と読んだ回数はこの表から数える
--   xmas_novel_firsts  … 1行 = (人・問い)。一番はじめの答えだけ(あとから上書きできない)
--   xmas_novel_usage   … 送った回数((人・日)で1行)。読ませない
-- 見え方(読むだけ・hidden の行は出さない・owner_id は出さない)
--   xmas_novel_rank_ends / xmas_novel_rank_plays / xmas_novel_rank_perfect … 順位 place つき
-- 関数(端末から呼べる)
--   xmas_novel_rank_submit(owner, key, row) … 1件を入れる。返り値 { ok, reason?, ends, ends_total, plays, perfect, place_ends, place_plays, place_perfect }
--     row = { kind:'end', end_id, user_name } | { kind:'first', qid, ok, user_name } | { kind:'seed', ends:[{id, at}], firsts:{qid:bool}, user_name }
--     reason: 'bad' | 'locked' | 'closed'(期間外) | 'busy'(5秒に1回・1日300回を超えた) | 'seeded'(前の記録はもう取りこんだ)
--   xmas_novel_rank_mine(owner, key) … 自分の数と順位だけを返す(送らずに見るとき)
-- 日の区切りは朝4:00(JST)。ほかの回数の表と同じ。

create table if not exists public.xmas_novel_end_ids (
  event_id  text        not null default 'xmas_novel_2026',
  end_id    text        not null,
  kind      text        not null,
  added_at  timestamptz not null default now(),
  constraint xmas_novel_end_ids_pkey primary key (event_id, end_id),
  constraint xmas_novel_end_ids_shape check (event_id ~ '^[a-z0-9_]{1,40}$' and end_id ~ '^END-[A-Z]+[0-9]*$' and kind ~ '^[a-z]{2,16}$')
);
-- 今ある16のエンドと、分かれ道 第1弾(r1126-108)の7つ。合わせて23(弾を出すときは、同じ形で行を足すだけ)
insert into public.xmas_novel_end_ids (event_id, end_id, kind) values
  ('xmas_novel_2026', 'END-G', 'good'), ('xmas_novel_2026', 'END-N', 'normal'), ('xmas_novel_2026', 'END-A', 'another'), ('xmas_novel_2026', 'END-B', 'bad'),
  ('xmas_novel_2026', 'END-X1', 'forced'), ('xmas_novel_2026', 'END-X2', 'forced'), ('xmas_novel_2026', 'END-X3', 'forced'), ('xmas_novel_2026', 'END-X4', 'forced'), ('xmas_novel_2026', 'END-X5', 'forced'),
  ('xmas_novel_2026', 'END-M1', 'accuse'), ('xmas_novel_2026', 'END-M2', 'accuse'), ('xmas_novel_2026', 'END-M3', 'accuse'), ('xmas_novel_2026', 'END-M4', 'accuse'), ('xmas_novel_2026', 'END-M5', 'accuse'),
  ('xmas_novel_2026', 'END-O', 'omake'), ('xmas_novel_2026', 'END-O2', 'omake'),
  ('xmas_novel_2026', 'END-M6', 'accuse'), ('xmas_novel_2026', 'END-M7', 'accuse'), ('xmas_novel_2026', 'END-M8', 'accuse'), ('xmas_novel_2026', 'END-M9', 'accuse'),
  ('xmas_novel_2026', 'END-K1', 'accuse'), ('xmas_novel_2026', 'END-L1', 'unsolved'), ('xmas_novel_2026', 'END-L2', 'unsolved')
on conflict (event_id, end_id) do nothing;

create table if not exists public.xmas_novel_players (
  event_id   text        not null default 'xmas_novel_2026',
  owner_id   text        not null,
  user_name  text        not null default '',
  seeded     boolean     not null default false,
  hidden     boolean     not null default false,
  updated_at timestamptz not null default now(),
  constraint xmas_novel_players_pkey primary key (event_id, owner_id),
  constraint xmas_novel_players_shape check (owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and length(user_name) <= 40)
);

create table if not exists public.xmas_novel_plays (
  event_id  text        not null default 'xmas_novel_2026',
  owner_id  text        not null,
  day       date        not null,
  end_id    text        not null,
  at        timestamptz not null default now(),
  seed      boolean     not null default false,
  constraint xmas_novel_plays_pkey primary key (event_id, owner_id, day, end_id),
  constraint xmas_novel_plays_shape check (end_id ~ '^END-[A-Z]+[0-9]*$')
);
create index if not exists xmas_novel_plays_owner_idx on public.xmas_novel_plays (event_id, owner_id, end_id, at);

create table if not exists public.xmas_novel_firsts (
  event_id  text        not null default 'xmas_novel_2026',
  owner_id  text        not null,
  qid       text        not null,
  ok        boolean     not null,
  at        timestamptz not null default now(),
  constraint xmas_novel_firsts_pkey primary key (event_id, owner_id, qid),
  constraint xmas_novel_firsts_qid check (qid in ('Q2a', 'Q3a', 'Q4a', 'Q5a', 'Q6a', 'Q6b', 'Q7a', 'Q7m'))
);

create table if not exists public.xmas_novel_usage (
  owner_id  text        not null,
  day       date        not null,
  sent      integer     not null default 0,
  last_at   timestamptz not null default now(),
  constraint xmas_novel_usage_pkey primary key (owner_id, day)
);

alter table public.xmas_novel_end_ids enable row level security;
alter table public.xmas_novel_players enable row level security;
alter table public.xmas_novel_plays   enable row level security;
alter table public.xmas_novel_firsts  enable row level security;
alter table public.xmas_novel_usage   enable row level security;
revoke all on public.xmas_novel_end_ids from anon, authenticated;
revoke all on public.xmas_novel_players from anon, authenticated;
revoke all on public.xmas_novel_plays   from anon, authenticated;
revoke all on public.xmas_novel_firsts  from anon, authenticated;
revoke all on public.xmas_novel_usage   from anon, authenticated;
grant select on public.xmas_novel_end_ids to anon, authenticated;   -- エンドの総数を画面に出すため(名前は持たない・id と種類だけ)

-- 人ごとの数(一覧に入っているエンドだけ数える)。owner_id は見え方には出さない
create or replace view public.xmas_novel_stats as
  with seen as (
    select p.event_id, p.owner_id, p.end_id, min(p.at) as first_at
    from public.xmas_novel_plays p join public.xmas_novel_end_ids e on e.event_id = p.event_id and e.end_id = p.end_id
    group by p.event_id, p.owner_id, p.end_id),
  ends as (select event_id, owner_id, count(*)::int as ends, max(first_at) as ends_at, array_agg(end_id order by end_id) as end_list from seen group by event_id, owner_id),
  plays as (
    select p.event_id, p.owner_id, count(*)::int as plays, max(p.at) as plays_at
    from public.xmas_novel_plays p join public.xmas_novel_end_ids e on e.event_id = p.event_id and e.end_id = p.end_id
    group by p.event_id, p.owner_id),
  perfect as (
    select event_id, owner_id,
      (count(*) filter (where ok and qid in ('Q2a', 'Q3a', 'Q4a', 'Q5a', 'Q6a', 'Q6b'))
       + case when bool_and(ok) filter (where qid in ('Q7a', 'Q7m')) and count(*) filter (where qid in ('Q7a', 'Q7m')) = 2 then 1 else 0 end)::int as perfect,
      max(at) as perfect_at
    from public.xmas_novel_firsts group by event_id, owner_id)
  select pl.event_id, pl.owner_id, pl.user_name, pl.hidden,
         coalesce(e.ends, 0) as ends, e.ends_at, coalesce(e.end_list, '{}') as end_list,
         coalesce(p.plays, 0) as plays, p.plays_at,
         coalesce(f.perfect, 0) as perfect, f.perfect_at
  from public.xmas_novel_players pl
  left join ends e on e.event_id = pl.event_id and e.owner_id = pl.owner_id
  left join plays p on p.event_id = pl.event_id and p.owner_id = pl.owner_id
  left join perfect f on f.event_id = pl.event_id and f.owner_id = pl.owner_id;
revoke all on public.xmas_novel_stats from anon, authenticated;     -- owner_id を含むので読ませない(下の3つだけ読む)

-- 見たエンドの数: 多い順。同じなら、先にその数に届いた人が上(ends_at が早い)
create or replace view public.xmas_novel_rank_ends as
  select event_id, user_name, ends, end_list, ends_at,
         rank() over (partition by event_id order by ends desc, ends_at asc nulls last) as place
  from public.xmas_novel_stats where not hidden and ends > 0;
-- 読んだ回数: 多い順。同じなら、先にその回数に届いた人が上
create or replace view public.xmas_novel_rank_plays as
  select event_id, user_name, plays, plays_at,
         rank() over (partition by event_id order by plays desc, plays_at asc nulls last) as place
  from public.xmas_novel_stats where not hidden and plays > 0;
-- 一発正解: 多い順(0〜7)。同じなら、見たエンドの多い人、それも同じなら先に決まった人が上
create or replace view public.xmas_novel_rank_perfect as
  select event_id, user_name, perfect, ends, perfect_at,
         rank() over (partition by event_id order by perfect desc, ends desc, perfect_at asc nulls last) as place
  from public.xmas_novel_stats where not hidden and perfect_at is not null;
revoke all on public.xmas_novel_rank_ends    from anon, authenticated;
revoke all on public.xmas_novel_rank_plays   from anon, authenticated;
revoke all on public.xmas_novel_rank_perfect from anon, authenticated;
grant select on public.xmas_novel_rank_ends    to anon, authenticated;
grant select on public.xmas_novel_rank_plays   to anon, authenticated;
grant select on public.xmas_novel_rank_perfect to anon, authenticated;

-- 自分の数と順位
create or replace function public.xmas_novel_rank_me(p_event text, p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    'ends', coalesce(s.ends, 0), 'ends_total', (select count(*) from public.xmas_novel_end_ids where event_id = p_event),
    'plays', coalesce(s.plays, 0), 'perfect', coalesce(s.perfect, 0),
    'place_ends',    case when coalesce(s.ends, 0) > 0 then (select count(*) + 1 from public.xmas_novel_stats o where o.event_id = p_event and not o.hidden and (o.ends > s.ends or (o.ends = s.ends and o.ends_at < s.ends_at))) end,
    'place_plays',   case when coalesce(s.plays, 0) > 0 then (select count(*) + 1 from public.xmas_novel_stats o where o.event_id = p_event and not o.hidden and (o.plays > s.plays or (o.plays = s.plays and o.plays_at < s.plays_at))) end,
    'place_perfect', case when s.perfect_at is not null then (select count(*) + 1 from public.xmas_novel_stats o where o.event_id = p_event and not o.hidden and o.perfect_at is not null
                       and (o.perfect > s.perfect or (o.perfect = s.perfect and (o.ends > s.ends or (o.ends = s.ends and o.perfect_at < s.perfect_at))))) end)
  from (select 1) one left join public.xmas_novel_stats s on s.event_id = p_event and s.owner_id = p_owner
$$;

create or replace function public.xmas_novel_rank_mine(p_owner text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_chk text;
begin
  v_chk := public.masmon_pvp_owner_check(p_owner, p_key);
  if v_chk <> 'ok' then return jsonb_build_object('ok', false, 'reason', v_chk); end if;
  return public.xmas_novel_rank_me('xmas_novel_2026', p_owner);
end $$;

create or replace function public.xmas_novel_rank_submit(p_owner text, p_key text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event text := 'xmas_novel_2026';
  v_day date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  v_chk text; v_kind text; v_name text; v_end text; v_q text; u record; e jsonb; v_at timestamptz; v_seeded boolean;
begin
  if p_row is null or jsonb_typeof(p_row) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  -- 期間(11/28 10:00 〜 12/31 3:59 JST)の外は受けない。順位は見え方でそのあとも見られる
  if now() < timestamptz '2026-11-28 10:00:00+09' or now() >= timestamptz '2026-12-31 04:00:00+09' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  v_chk := public.masmon_pvp_owner_check(p_owner, p_key);
  if v_chk <> 'ok' then return jsonb_build_object('ok', false, 'reason', v_chk); end if;

  v_kind := p_row->>'kind';
  v_name := left(regexp_replace(coalesce(p_row->>'user_name', ''), '[\r\n\t]', '', 'g'), 40);
  if v_kind is null or v_kind not in ('end', 'first', 'seed') then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;

  -- 5秒に1回・1日300回まで
  insert into public.xmas_novel_usage (owner_id, day, sent, last_at) values (p_owner, v_day, 0, now() - interval '1 hour')
    on conflict (owner_id, day) do nothing;
  select * into u from public.xmas_novel_usage where owner_id = p_owner and day = v_day for update;
  if u.sent >= 300 or u.last_at > now() - interval '5 seconds' then return jsonb_build_object('ok', false, 'reason', 'busy'); end if;
  update public.xmas_novel_usage set sent = sent + 1, last_at = now() where owner_id = p_owner and day = v_day;

  insert into public.xmas_novel_players (event_id, owner_id, user_name) values (v_event, p_owner, v_name)
    on conflict (event_id, owner_id) do update set user_name = case when excluded.user_name <> '' then excluded.user_name else xmas_novel_players.user_name end, updated_at = now();

  if v_kind = 'end' then
    -- エンドに着いた: (人・今日・エンド)で1行。同じ日の2回目は何も増えない。一覧に無い id も残す(あとで一覧に足せば数える)
    v_end := p_row->>'end_id';
    if v_end is null or v_end !~ '^END-[A-Z]{1,4}[0-9]{0,2}$' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    insert into public.xmas_novel_plays (event_id, owner_id, day, end_id) values (v_event, p_owner, v_day, v_end)
      on conflict (event_id, owner_id, day, end_id) do nothing;

  elsif v_kind = 'first' then
    -- 一番はじめの答え: 一度入れたら変えない
    v_q := p_row->>'qid';
    if v_q is null or v_q not in ('Q2a', 'Q3a', 'Q4a', 'Q5a', 'Q6a', 'Q6b', 'Q7a', 'Q7m') or jsonb_typeof(p_row->'ok') <> 'boolean' then
      return jsonb_build_object('ok', false, 'reason', 'bad');
    end if;
    insert into public.xmas_novel_firsts (event_id, owner_id, qid, ok) values (v_event, p_owner, v_q, (p_row->>'ok')::boolean)
      on conflict (event_id, owner_id, qid) do nothing;

  else
    -- ランキングを入れる前の記録(端末の mh_xmas_novel_v1 の endings・endAt・first)を1回だけ取りこむ
    select seeded into v_seeded from public.xmas_novel_players where event_id = v_event and owner_id = p_owner;
    if v_seeded then return public.xmas_novel_rank_me(v_event, p_owner) || jsonb_build_object('reason', 'seeded'); end if;
    if jsonb_typeof(coalesce(p_row->'ends', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_row->'ends', '[]'::jsonb)) > 60
       or jsonb_typeof(coalesce(p_row->'firsts', '{}'::jsonb)) <> 'object' then
      return jsonb_build_object('ok', false, 'reason', 'bad');
    end if;
    for e in select value from jsonb_array_elements(coalesce(p_row->'ends', '[]'::jsonb)) loop
      v_end := e->>'id';
      if v_end is null or v_end !~ '^END-[A-Z]{1,4}[0-9]{0,2}$' then continue; end if;
      begin v_at := (e->>'at')::timestamptz; exception when others then v_at := null; end;
      -- 日時は期間の中に収める(前の日時が無い・おかしい物は今)
      if v_at is null or v_at < timestamptz '2026-11-28 10:00:00+09' or v_at > now() then v_at := now(); end if;
      insert into public.xmas_novel_plays (event_id, owner_id, day, end_id, at, seed)
        values (v_event, p_owner, ((v_at at time zone 'Asia/Tokyo') - interval '4 hours')::date, v_end, v_at, true)
        on conflict (event_id, owner_id, day, end_id) do nothing;
    end loop;
    for v_q in select key from jsonb_each(coalesce(p_row->'firsts', '{}'::jsonb)) loop
      if v_q in ('Q2a', 'Q3a', 'Q4a', 'Q5a', 'Q6a', 'Q6b', 'Q7a', 'Q7m') and jsonb_typeof(p_row->'firsts'->v_q) = 'boolean' then
        insert into public.xmas_novel_firsts (event_id, owner_id, qid, ok) values (v_event, p_owner, v_q, (p_row->'firsts'->>v_q)::boolean)
          on conflict (event_id, owner_id, qid) do nothing;
      end if;
    end loop;
    update public.xmas_novel_players set seeded = true where event_id = v_event and owner_id = p_owner;
  end if;

  return public.xmas_novel_rank_me(v_event, p_owner);
end $$;

revoke all on function public.xmas_novel_rank_me(text, text) from public, anon, authenticated;
revoke all on function public.xmas_novel_rank_mine(text, text) from public, anon, authenticated;
revoke all on function public.xmas_novel_rank_submit(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.xmas_novel_rank_mine(text, text) to anon, authenticated, service_role;
grant execute on function public.xmas_novel_rank_submit(text, text, jsonb) to anon, authenticated, service_role;

-- 弾を出したときに足す行(r1126-108)。第2弾(4つ・合わせて27)
insert into public.xmas_novel_end_ids (event_id, end_id, kind) values
  ('xmas_novel_2026', 'END-X6', 'forced'), ('xmas_novel_2026', 'END-X7', 'forced'), ('xmas_novel_2026', 'END-X8', 'forced'), ('xmas_novel_2026', 'END-A2', 'another')
on conflict (event_id, end_id) do nothing;
-- 第3弾(3つ・合わせて30)
insert into public.xmas_novel_end_ids (event_id, end_id, kind) values
  ('xmas_novel_2026', 'END-G2', 'truebad'), ('xmas_novel_2026', 'END-O3', 'omake'), ('xmas_novel_2026', 'END-O4', 'omake')
on conflict (event_id, end_id) do nothing;
-- ずるの疑いのある人を隠す(消さない)
-- update public.xmas_novel_players set hidden = true where event_id = 'xmas_novel_2026' and user_name = '…';
