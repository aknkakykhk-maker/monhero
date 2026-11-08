-- 助手ライフ: フレンドの家との行き来の表を足すSQLの【予行演習】。末尾で rollback するので本番には何も残らない。
-- 中身は FRIEND_VISIT_APPLY.sql と同じ(最後の commit を外し、確かめの手順を足した)。既存の表は読むだけ(friend_links から承認済みの1組を借りる)。
--
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


-- ④ 確かめ(結果は一時表にためて最後に出す)
create temp table alf_test_result (sort int, item text, value text) on commit drop;
do $$
declare a text; b text; ok text;
begin
  select requester_id, target_id into a, b from public.friend_links where status = 'accepted' limit 1;
  if a is null then
    insert into alf_test_result values (0, '承認済みの組', 'なし(行き来の確かめは飛ばす)');
    return;
  end if;
  insert into alf_test_result values (0, '承認済みの組', 'あり');
  update public.assistant_life_friend_switch set mode = 'on' where id = 1;
  -- 控えを2人ぶん
  insert into public.assistant_life_friend_houses (breeder_id, house) values (a, '{"v":1}'), (b, '{"v":1}')
    on conflict (breeder_id) do update set house = excluded.house, open = true;
  -- 2,000字を超える控えは入らない
  begin
    update public.assistant_life_friend_houses set house = jsonb_build_object('x', repeat('a', 2100)) where breeder_id = a;
    ok := 'NG(入ってしまった)';
  exception when check_violation then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (1, '2,000字を超える控え', ok);
  -- go を1回 → 入る
  insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day, assistants, word)
    values ('go', a, b, (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date, array['mua'], 1);
  insert into alf_test_result values (2, 'go 1回目', 'OK(入った)');
  -- 同じ家へ同じ日にもう1回 → 断られる
  begin
    insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day, assistants)
      values ('go', a, b, (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date, array['kiki']);
    ok := 'NG(入ってしまった)';
  exception when unique_violation then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (3, '同じ家へ同じ日に2回目', ok);
  -- player(助手なし)→ 入る
  insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day)
    values ('player', a, b, (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date);
  insert into alf_test_result values (4, 'player(プレイヤーが訪ねた)', 'OK(入った)');
  -- お礼は変えられる/ほかの列は変えられない
  update public.assistant_life_friend_visits set thanks = 2 where kind = 'go' and visitor_id = a and host_id = b;
  begin
    update public.assistant_life_friend_visits set word = 5 where kind = 'go' and visitor_id = a and host_id = b;
    ok := 'NG(変わってしまった)';
  exception when raise_exception then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (5, 'お礼のほかを変える', ok);
  -- 切にすると入らない
  update public.assistant_life_friend_houses set open = false where breeder_id = b;
  begin
    insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day, assistants)
      values ('come', b, a, (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date, array['dra']);
    ok := 'NG(入ってしまった)';
  exception when raise_exception then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (6, '相手が切のとき', ok);
  -- off にすると入らない
  update public.assistant_life_friend_houses set open = true where breeder_id = b;
  update public.assistant_life_friend_switch set mode = 'off' where id = 1;
  begin
    insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day, assistants)
      values ('come', b, a, (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date, array['dra']);
    ok := 'NG(入ってしまった)';
  exception when raise_exception then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (7, 'スイッチ off のとき', ok);
  -- フレンドでない相手には入らない
  update public.assistant_life_friend_switch set mode = 'on' where id = 1;
  insert into public.assistant_life_friend_houses (breeder_id) values ('alf_test_stranger') on conflict do nothing;
  begin
    insert into public.assistant_life_friend_visits (kind, visitor_id, host_id, day, assistants)
      values ('go', a, 'alf_test_stranger', (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date, array['mua']);
    ok := 'NG(入ってしまった)';
  exception when raise_exception then ok := 'OK(断られた)'; end;
  insert into alf_test_result values (8, 'フレンドでない相手', ok);
end $$;
insert into alf_test_result
  select 9, '公開の鍵(anon)の権限', coalesce(string_agg(distinct table_name||':'||privilege_type, ', '), 'なし')
  from information_schema.role_table_grants
  where table_schema='public' and grantee='anon' and table_name like 'assistant_life_friend_%';
insert into alf_test_result
  select 10, 'rankings の件数(触っていないこと)', count(*)::text from public.rankings;
select item as "項目", value as "値" from alf_test_result order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる
rollback;
