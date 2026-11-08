-- 助手ライフ: フレンドの家の「くわしい控え」の表(2026-11-08 社長 F「控えは別の表に分けて、もっと載せる」・オトズレ3)
-- 足すだけ。DROP なし。既存の assistant_life_friend_houses は消さず・書き換えない(今の控えは今までどおり読む)。
-- 端末は、この表が無い・行が無いときは今の控え(houses.house)だけで家を描く。
-- 読むのは「その家を訪ねたとき」の1行だけ(一覧では読まない)。書くのは自分の行だけ(houses と同じく1人1行を上書き)。
create table if not exists public.assistant_life_friend_house_more (
  breeder_id text        not null,
  more       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint alf_more_pkey primary key (breeder_id),
  constraint alf_more_id_shape check (length(breeder_id) between 1 and 100),
  constraint alf_more_object check (jsonb_typeof(more) = 'object'),
  constraint alf_more_size check (length(more::text) <= 6000)
);
comment on table public.assistant_life_friend_house_more is
  '助手ライフの家のくわしい控え(部屋ごとの家具・押し入れ・今日あったこと・助手のマスモン)。フレンドがその家を訪ねたときだけ読む。1人1行を端末が上書きする。';

-- 更新日の見張り(houses の alf_houses_touch と同じ考え方。新しい名前の関数)
create or replace function public.alf_more_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.breeder_id is distinct from old.breeder_id then
    raise exception 'breeder_id は変えられません';
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace trigger alf_more_touch before insert or update on public.assistant_life_friend_house_more
  for each row execute function public.alf_more_touch();

-- 権限(houses と同じ: 読む・足す・上書き。消す権限は無し)
alter table public.assistant_life_friend_house_more enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_house_more' and policyname='alf more read') then
    create policy "alf more read"   on public.assistant_life_friend_house_more for select using (true);
    create policy "alf more insert" on public.assistant_life_friend_house_more for insert with check (true);
    create policy "alf more update" on public.assistant_life_friend_house_more for update using (true) with check (true);
  end if;
end $$;
revoke all on public.assistant_life_friend_house_more from anon, authenticated;
grant select, insert, update on public.assistant_life_friend_house_more to anon, authenticated;
