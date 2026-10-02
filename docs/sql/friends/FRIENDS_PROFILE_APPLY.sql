-- フレンドに見せる情報を1人1行で持つテーブル public.friend_profiles を追加するSQL(フレンド機能の第2弾)。
-- 読み取り専用: いいえ。 本番変更が残るか: はい(全体が1つの処理。途中で失敗すれば何も残らない)。
--
-- 既存のテーブル(rankings / bond_levels / breeder_profiles / friend_*)には一切触らない。新しいテーブルを1つ作るだけ。
-- 先に必要なSQL: FRIENDS_APPLY.sql(2026-10-02適用済み)
--
-- 入るもの(すべて端末が自分で計算して書く。「フレンド」の画面でフレンドにだけ見せる):
--   place … いまいる場所の大分類(ホーム・バトル・モンヒロビート・みんなで対戦・マスモン・マーケット・その他)
--   started_on / play_seconds … 遊び始めた日(プレイ時間を数え始めた日)と、プレイ時間の合計
--   best_bond / best_power(と、その子の種類) … 持っているマスモンの最高絆Lv・最高総合力
--   favorite … 「好きなマスモン」1体ぶんの詳細(ランキングの詳細画面と同じ形のJSON)
--   updated_at … 最後にゲームから送ってきた時刻(ログイン中かどうかの判定にも使う)
-- ★DELETEの権限は与えない。1人1行を上書きし続けるだけなので、行は増え続けない。
-- ★ログインの仕組みが無いので、公開キーで読み書きできる(なりすましで書き換えること自体は防げない)。

begin;

do $$
begin
  if to_regclass('public.friend_links') is null then
    raise exception 'public.friend_links がありません。先に FRIENDS_APPLY.sql を適用してください。';
  end if;
  if to_regclass('public.friend_profiles') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='friend_profiles' and column_name='best_bond') then
    raise exception 'public.friend_profiles が別の形で既に存在します';
  end if;
end $$;

create table if not exists public.friend_profiles (
  breeder_id    text        not null,
  place         text,
  started_on    date,
  play_seconds  bigint,
  best_bond     integer,
  best_bond_mon text,
  best_power    integer,
  best_power_mon text,
  favorite      jsonb,
  updated_at    timestamptz not null default now(),
  constraint friend_profiles_pkey primary key (breeder_id),
  constraint friend_profiles_id_shape check (length(breeder_id) between 1 and 100),
  constraint friend_profiles_place_values check (
    place is null or place in ('home','battle','rhythm','multi','masu','market','other')),
  constraint friend_profiles_play_seconds check (play_seconds is null or play_seconds between 0 and 100000000),
  constraint friend_profiles_best_bond check (best_bond is null or best_bond between 0 and 9999),
  constraint friend_profiles_best_power check (best_power is null or best_power between 0 and 100000000),
  constraint friend_profiles_mon_len check (
    (best_bond_mon is null or length(best_bond_mon) <= 100) and (best_power_mon is null or length(best_power_mon) <= 100)),
  constraint friend_profiles_favorite_size check (favorite is null or length(favorite::text) <= 6000)
);

comment on table public.friend_profiles is
  'フレンドに見せる情報(いまの場所・遊び始めた日・プレイ時間・最高絆Lv・最高総合力・好きなマスモン)。1人1行。端末が自分で計算して上書きする。';

create or replace function public.friend_profiles_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists friend_profiles_set_updated_at on public.friend_profiles;
create trigger friend_profiles_set_updated_at
  before insert or update on public.friend_profiles
  for each row execute function public.friend_profiles_touch_updated_at();

alter table public.friend_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_profiles' and policyname='anyone can read friend profiles') then
    create policy "anyone can read friend profiles"
      on public.friend_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_profiles' and policyname='anyone can insert friend profiles') then
    create policy "anyone can insert friend profiles"
      on public.friend_profiles for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_profiles' and policyname='anyone can update friend profiles') then
    create policy "anyone can update friend profiles"
      on public.friend_profiles for update using (true) with check (true);
  end if;
end $$;

grant select, insert, update on public.friend_profiles to anon, authenticated;
revoke delete on public.friend_profiles from anon, authenticated;

do $$
declare
  cnt int;
begin
  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_profiles'
     and column_name in ('breeder_id','place','started_on','play_seconds','best_bond','best_bond_mon','best_power','best_power_mon','favorite','updated_at');
  if cnt <> 10 then raise exception 'friend_profiles の列がそろっていません(%件)', cnt; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='friend_profiles' and c.relrowsecurity) then
    raise exception 'friend_profiles のRLSが有効になっていません';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name='friend_profiles'
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'friend_profiles に削除の権限が付いています';
  end if;

  -- 実際に書けて、同じIDで上書きになり、ありえない値は弾かれること
  insert into public.friend_profiles (breeder_id, place, started_on, play_seconds, best_bond, best_power, favorite)
  values ('__apply_check__', 'home', '2026-09-01', 3600, 12, 3456, '{"monsterId":"Mocchi"}'::jsonb);
  insert into public.friend_profiles (breeder_id, place) values ('__apply_check__', 'battle')
  on conflict (breeder_id) do update set place = excluded.place;
  select count(*) into cnt from public.friend_profiles where breeder_id = '__apply_check__';
  if cnt <> 1 then raise exception '同じIDが2行になりました(1行で上書きされていません)'; end if;
  begin
    insert into public.friend_profiles (breeder_id, place) values ('__apply_check_x__', 'nowhere');
    raise exception '知らない場所の値が入りました';
  exception when check_violation then null;
  end;
  begin
    insert into public.friend_profiles (breeder_id, play_seconds) values ('__apply_check_y__', -1);
    raise exception 'マイナスのプレイ時間が入りました';
  exception when check_violation then null;
  end;
  delete from public.friend_profiles where breeder_id like '\_\_apply\_check\_%';
end $$;

select 'friend_profiles' as "テーブル", count(*) as "件数(0なら正常)" from public.friend_profiles
union all select 'friend_links(触っていない)', count(*) from public.friend_links
union all select 'rankings(触っていない)', count(*) from public.rankings;

commit;

notify pgrst, 'reload schema';
