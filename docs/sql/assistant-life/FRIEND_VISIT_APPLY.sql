-- 助手ライフ: フレンドの家との行き来(控え・行き来の記録・逃げ道のスイッチ)を足すSQL【本番】。
-- 読み取り専用: いいえ。 本番変更が残るか: はい(新しい表3つと、その表だけの関数・見張りを足す)。
--
-- 既存の表(rankings / breeder_profiles / friend_* など)・ランキング・送信処理には一切触らない。
-- friend_links は「承認済みのフレンドか」を見るために読むだけ。
-- 先に FRIEND_VISIT_APPLY_TEST.sql(末尾 rollback)を通し、あとで FRIEND_VISIT_VERIFY.sql で確かめる。
--
-- しくみ:
--   assistant_life_friend_switch … 1行だけ。mode = on / thin(間引く) / off(止める)。窓口が update で切り替える。端末は読むだけ
--   assistant_life_friend_houses … 1人1行の家の控え(会った助手・部屋の様子・家具の id。2,000字まで)。端末が上書きする
--   assistant_life_friend_visits … 行き来の記録。1日1行ずつ足すだけ
--       go   = 自分の助手がフレンドの家へ行った(書くのは行った人 visitor)
--       come = フレンドの助手が自分の家へ来た(書くのは来られた人 host。visitor はフレンド)
--       player = プレイヤー自身がフレンドの家へ遊びに行った(書くのは訪ねた人 visitor。助手の欄は話した相手の家の助手・0〜2人)
--
-- ★ログインの仕組みは無いので、なりすましまでは防げない(フレンドの表と同じ限界)。
--   守っているのは「消せない」「承認済みのフレンドどうしだけ」「1日の上限」「自由な文が無い」「変えられるのはお礼だけ」の5つ。
-- ★端末に DELETE の権限は与えない。8日たった行き来の行は、この表の見張りがときどき片づける(この表の中だけ)。
-- ★スイッチは最初 thin で入れる(今月の送り出し量が分かるまで)。

begin;

do $$
begin
  if to_regclass('public.friend_links') is null then
    raise exception 'public.friend_links がありません(フレンドの SQL が先)';
  end if;
  if to_regclass('public.assistant_life_friend_houses') is not null
     and not exists (select 1 from information_schema.columns where table_schema='public'
                     and table_name='assistant_life_friend_houses' and column_name='house') then
    raise exception 'assistant_life_friend_houses が別の形で既にあります';
  end if;
  if to_regclass('public.assistant_life_friend_visits') is not null
     and not exists (select 1 from information_schema.columns where table_schema='public'
                     and table_name='assistant_life_friend_visits' and column_name='kind') then
    raise exception 'assistant_life_friend_visits が別の形で既にあります';
  end if;
  if to_regclass('public.assistant_life_friend_switch') is not null
     and not exists (select 1 from information_schema.columns where table_schema='public'
                     and table_name='assistant_life_friend_switch' and column_name='mode') then
    raise exception 'assistant_life_friend_switch が別の形で既にあります';
  end if;
end $$;

-- ⓪ 逃げ道のスイッチ(1行だけ)
create table if not exists public.assistant_life_friend_switch (
  id         smallint    not null default 1,
  mode       text        not null default 'thin',
  updated_at timestamptz not null default now(),
  constraint alf_switch_pkey primary key (id),
  constraint alf_switch_one check (id = 1),
  constraint alf_switch_mode check (mode in ('on','thin','off'))
);
comment on table public.assistant_life_friend_switch is
  '助手ライフの行き来の逃げ道。on=ふつう/thin=間引く/off=止める。窓口が update で切り替える。';
insert into public.assistant_life_friend_switch (id, mode) values (1, 'thin') on conflict (id) do nothing;

-- ① 家の控え(1人1行・上書き)
create table if not exists public.assistant_life_friend_houses (
  breeder_id text        not null,
  open       boolean     not null default true,
  house      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint alf_houses_pkey primary key (breeder_id),
  constraint alf_houses_id_shape check (length(breeder_id) between 1 and 100),
  constraint alf_houses_house_object check (jsonb_typeof(house) = 'object'),
  constraint alf_houses_house_size check (length(house::text) <= 2000)
);
comment on table public.assistant_life_friend_houses is
  '助手ライフの家の控え(会った助手・部屋の様子・家具の id)。フレンドが訪ねるときに読む。1人1行を端末が上書きする。';
create index if not exists alf_houses_updated_idx on public.assistant_life_friend_houses (updated_at);

create or replace function public.alf_houses_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.breeder_id is distinct from old.breeder_id then
    raise exception 'breeder_id は変えられません';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists alf_houses_touch on public.assistant_life_friend_houses;
create trigger alf_houses_touch before insert or update on public.assistant_life_friend_houses
  for each row execute function public.alf_houses_touch();

-- ② 行き来の記録(1日1行ずつ足すだけ)
create table if not exists public.assistant_life_friend_visits (
  id          bigint generated always as identity,
  kind        text        not null,
  visitor_id  text        not null,
  host_id     text        not null,
  day         date        not null,
  assistants  text[]      not null default '{}',
  word        smallint    not null default 0,
  thanks      smallint,
  created_at  timestamptz not null default now(),
  constraint alf_visits_pkey primary key (id),
  constraint alf_visits_kind check (kind in ('go','come','player')),
  constraint alf_visits_id_shape check (length(visitor_id) between 1 and 100 and length(host_id) between 1 and 100),
  constraint alf_visits_not_self check (visitor_id <> host_id),
  constraint alf_visits_assistants check (
    cardinality(assistants) between (case when kind = 'player' then 0 else 1 end) and 2
    and (cardinality(assistants) = 0 or array_to_string(assistants, ',') ~ '^[a-z]{2,20}(,[a-z]{2,20})?$')),
  constraint alf_visits_word check (word between 0 and 31),
  constraint alf_visits_thanks check (thanks is null or thanks between 0 and 31)
);
comment on table public.assistant_life_friend_visits is
  '助手ライフの行き来。go=助手が行った(行った人が書く)/come=相手の助手が来た(来られた人が書く)/player=プレイヤーが訪ねた(訪ねた人が書く)。一言とお礼は決まった文の番号。';

create unique index if not exists alf_visits_once_a_day
  on public.assistant_life_friend_visits (kind, visitor_id, host_id, day);
create index if not exists alf_visits_host_idx on public.assistant_life_friend_visits (host_id, day);
create index if not exists alf_visits_visitor_idx on public.assistant_life_friend_visits (visitor_id, day);

-- 足すときの見張り(承認済みのフレンドか・両方が入か・1日の上限)。friend_links を読むので security definer
create or replace function public.alf_visits_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date;
  sw    text := coalesce((select mode from public.assistant_life_friend_switch where id = 1), 'thin');
  n     integer;
begin
  if tg_op = 'UPDATE' then
    -- 変えてよいのはお礼だけ
    if (new.kind, new.visitor_id, new.host_id, new.day, new.assistants, new.word, new.created_at)
       is distinct from (old.kind, old.visitor_id, old.host_id, old.day, old.assistants, old.word, old.created_at) then
      raise exception 'お礼のほかは変えられません';
    end if;
    return new;
  end if;
  if sw = 'off' then
    raise exception '行き来はいま止めています';
  end if;
  if new.day not between today - 1 and today + 1 then
    raise exception '日付がずれています';
  end if;
  if not exists (select 1 from public.friend_links l
                 where least(l.requester_id, l.target_id) = least(new.visitor_id, new.host_id)
                   and greatest(l.requester_id, l.target_id) = greatest(new.visitor_id, new.host_id)
                   and l.status = 'accepted') then
    raise exception 'フレンドではありません';
  end if;
  if (select count(*) from public.assistant_life_friend_houses h
      where h.breeder_id in (new.visitor_id, new.host_id) and h.open) < 2 then
    raise exception '行き来を切にしています';
  end if;
  if new.kind = 'come' then
    select count(*) into n from public.assistant_life_friend_visits v
      where v.kind = 'come' and v.host_id = new.host_id and v.day = new.day;
    if n >= (case when sw = 'thin' then 0 else 2 end) then
      raise exception '今日はもう来られません';
    end if;
  else
    select count(*) into n from public.assistant_life_friend_visits v
      where v.kind = new.kind and v.visitor_id = new.visitor_id and v.day = new.day;
    if n >= (case when sw = 'thin' then 1 else 3 end) then
      raise exception '今日はもう行けません';
    end if;
  end if;
  new.thanks := null;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.alf_visits_guard() from public, anon, authenticated;
drop trigger if exists alf_visits_guard on public.assistant_life_friend_visits;
create trigger alf_visits_guard before insert or update on public.assistant_life_friend_visits
  for each row execute function public.alf_visits_guard();

-- 8日たった行き来の行を、足すときにときどき(100回に1回)まとめて片づける。この表の中だけ
create or replace function public.alf_visits_tidy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.01 then
    delete from public.assistant_life_friend_visits
      where day < (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date - 8;
  end if;
  return null;
end $$;
revoke all on function public.alf_visits_tidy() from public, anon, authenticated;
drop trigger if exists alf_visits_tidy on public.assistant_life_friend_visits;
create trigger alf_visits_tidy after insert on public.assistant_life_friend_visits
  for each statement execute function public.alf_visits_tidy();

-- ③ 権限(読む・足す・控えの上書き・お礼の列だけ。消す権限は無し)
alter table public.assistant_life_friend_switch enable row level security;
alter table public.assistant_life_friend_houses enable row level security;
alter table public.assistant_life_friend_visits enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_switch' and policyname='alf switch read') then
    create policy "alf switch read" on public.assistant_life_friend_switch for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_houses' and policyname='alf houses read') then
    create policy "alf houses read"   on public.assistant_life_friend_houses for select using (true);
    create policy "alf houses insert" on public.assistant_life_friend_houses for insert with check (true);
    create policy "alf houses update" on public.assistant_life_friend_houses for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_visits' and policyname='alf visits read') then
    create policy "alf visits read"   on public.assistant_life_friend_visits for select using (true);
    create policy "alf visits insert" on public.assistant_life_friend_visits for insert with check (true);
    create policy "alf visits thanks" on public.assistant_life_friend_visits for update using (true) with check (true);
  end if;
end $$;
revoke all on public.assistant_life_friend_switch from anon, authenticated;
grant select on public.assistant_life_friend_switch to anon, authenticated;
revoke all on public.assistant_life_friend_houses from anon, authenticated;
grant select, insert, update on public.assistant_life_friend_houses to anon, authenticated;
revoke all on public.assistant_life_friend_visits from anon, authenticated;
grant select, insert on public.assistant_life_friend_visits to anon, authenticated;
grant update (thanks) on public.assistant_life_friend_visits to anon, authenticated;

commit;
