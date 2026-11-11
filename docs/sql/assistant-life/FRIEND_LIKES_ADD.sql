-- 助手ライフ: フレンドの家の「💗 すてき」の表(2026-11-11 社長 第1弾 B「今日の見どころ・すてき」・トモダチ)
-- 足すだけ。DROP なし。既存の表(assistant_life_friend_switch / _houses / _visits / _house_more)は消さず・書き換えない。
-- 端末は、この表が無いあいだ「すてき」のボタンを出さない(ほかの行き来は今までどおり)。
-- 載るのは「だれが・だれの家の・どこに」の印だけ(spot は決まった形。自由文は入らない)。
--   spot: 'h'(家) / 'm:<助手>'(その助手のマスモン) / 'f:<助手>:<c|w|f>'(その部屋の天井・壁・床の家具)
create table if not exists public.assistant_life_friend_likes (
  id          bigint generated always as identity,
  visitor_id  text        not null,
  host_id     text        not null,
  day         date        not null,
  spot        text        not null,
  created_at  timestamptz not null default now(),
  constraint alf_likes_pkey primary key (id),
  constraint alf_likes_id_shape check (length(visitor_id) between 1 and 100 and length(host_id) between 1 and 100),
  constraint alf_likes_not_self check (visitor_id <> host_id),
  constraint alf_likes_spot check (spot ~ '^(h|m:[a-z]{2,20}|f:[a-z]{2,20}:[cwf])$')
);
comment on table public.assistant_life_friend_likes is
  '助手ライフのフレンドの家の「すてき」。訪ねた人が書く。場所の印だけ(自由文なし)。1軒につき1日3つまで。端末は7日分しか読まない';

create unique index if not exists alf_likes_once
  on public.assistant_life_friend_likes (visitor_id, host_id, day, spot);
create index if not exists alf_likes_host_idx on public.assistant_life_friend_likes (host_id, day);

-- 足すときの見張り(承認済みのフレンドか・両方が入か・1軒1日3つ)。friend_links を読むので security definer
create or replace function public.alf_likes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date;
  sw    text := coalesce((select mode from public.assistant_life_friend_switch where id = 1), 'thin');
  n     integer;
begin
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
  select count(*) into n from public.assistant_life_friend_likes v
    where v.visitor_id = new.visitor_id and v.host_id = new.host_id and v.day = new.day;
  if n >= 3 then
    raise exception '今日はもう送れません';
  end if;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.alf_likes_guard() from public, anon, authenticated;
create or replace trigger alf_likes_guard before insert on public.assistant_life_friend_likes
  for each row execute function public.alf_likes_guard();

-- 権限(読む・足すだけ。書き換える・消す権限は無し)
alter table public.assistant_life_friend_likes enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_likes' and policyname='alf likes read') then
    create policy "alf likes read"   on public.assistant_life_friend_likes for select using (true);
    create policy "alf likes insert" on public.assistant_life_friend_likes for insert with check (true);
  end if;
end $$;
revoke all on public.assistant_life_friend_likes from anon, authenticated;
grant select, insert on public.assistant_life_friend_likes to anon, authenticated;
