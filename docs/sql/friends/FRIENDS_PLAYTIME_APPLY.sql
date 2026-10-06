-- 端末ごとのプレイ時間の表 public.friend_playtime_devices を追加するSQL(フレンド機能の第4弾・2026-10-06)。
-- 読み取り専用: いいえ。 本番変更が残るか: はい(全体が1つの処理。途中で失敗すれば何も残らない)。
--
-- なぜ要るか: プレイ時間は端末の中だけで数え、friend_profiles は1人1行を「最後に送った端末」の値で上書きしていた。
-- データ引き継ぎでブリーダーIDごとコピーされるので、2台で遊ぶと、あまり使っていない端末で開いたとたんに
-- フレンドから見たプレイ時間が短くなっていた。端末ごとに1行ずつ持ち、アプリが合計を出す。
-- 既存のテーブル(rankings / bond_levels / breeder_profiles / friend_*)には一切触らない。新しいテーブルを1つ作るだけ。
-- 先に必要なSQL: FRIENDS_PROFILE_APPLY.sql
-- ★DELETEの権限は与えない。1人×1端末で1行を上書きし続けるだけ。
-- ★まだ流していなくても、アプリは今までどおり動く(表が無いことに気づいて、送らない・読まない)。

begin;

do $$
begin
  if to_regclass('public.friend_profiles') is null then
    raise exception 'public.friend_profiles がありません。先に FRIENDS_PROFILE_APPLY.sql を適用してください。';
  end if;
  if to_regclass('public.friend_playtime_devices') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='friend_playtime_devices' and column_name='own_seconds') then
    raise exception 'public.friend_playtime_devices が別の形で既に存在します';
  end if;
end $$;

create table if not exists public.friend_playtime_devices (
  breeder_id   text        not null,
  device_id    text        not null,
  base_seconds bigint      not null default 0,
  own_seconds  bigint      not null default 0,
  started_on   date,
  updated_at   timestamptz not null default now(),
  constraint friend_playtime_devices_pkey primary key (breeder_id, device_id),
  constraint friend_playtime_devices_id_shape check (length(breeder_id) between 1 and 100),
  constraint friend_playtime_devices_device_shape check (device_id ~ '^[a-z0-9]{12,40}$'),
  constraint friend_playtime_devices_seconds check (base_seconds between 0 and 100000000 and own_seconds between 0 and 100000000)
);

comment on table public.friend_playtime_devices is
  '端末ごとのプレイ時間。base_seconds=この仕組みが入った時点でその端末が持っていた時間(引き継ぎでコピーされた昔のぶんを含む)、own_seconds=そのあとその端末で遊んだぶん。合計は max(base)+sum(own)。1人×1端末で1行を上書きする。';

create or replace function public.friend_playtime_devices_touch_updated_at()
returns trigger language plpgsql as $f$
begin
  new.updated_at := now();
  return new;
end $f$;

drop trigger if exists friend_playtime_devices_set_updated_at on public.friend_playtime_devices;
create trigger friend_playtime_devices_set_updated_at
  before insert or update on public.friend_playtime_devices
  for each row execute function public.friend_playtime_devices_touch_updated_at();

alter table public.friend_playtime_devices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_playtime_devices' and policyname='anyone can read playtime devices') then
    create policy "anyone can read playtime devices"
      on public.friend_playtime_devices for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_playtime_devices' and policyname='anyone can insert playtime devices') then
    create policy "anyone can insert playtime devices"
      on public.friend_playtime_devices for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_playtime_devices' and policyname='anyone can update playtime devices') then
    create policy "anyone can update playtime devices"
      on public.friend_playtime_devices for update using (true) with check (true);
  end if;
end $$;

grant select, insert, update on public.friend_playtime_devices to anon, authenticated;
revoke delete on public.friend_playtime_devices from anon, authenticated;

do $$
declare
  cnt int;
begin
  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_playtime_devices'
     and column_name in ('breeder_id','device_id','base_seconds','own_seconds','started_on','updated_at');
  if cnt <> 6 then raise exception 'friend_playtime_devices の列がそろっていません(%件)', cnt; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='friend_playtime_devices' and c.relrowsecurity) then
    raise exception 'friend_playtime_devices のRLSが有効になっていません';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name='friend_playtime_devices'
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'friend_playtime_devices に削除の権限が付いています';
  end if;
end $$;

select 'friend_playtime_devices' as "テーブル", count(*) as "件数" from public.friend_playtime_devices
union all select 'friend_profiles(触っていない)', count(*) from public.friend_profiles
union all select 'rankings(触っていない)', count(*) from public.rankings;

commit;

notify pgrst, 'reload schema';
