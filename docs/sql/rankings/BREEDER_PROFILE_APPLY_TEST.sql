-- ブリーダーの「いまの見た目」を1人1行で持つテーブルを追加するSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(BREEDER_PROFILE_APPLY.sql)の前にこちらを通す。
--
-- 既存のテーブル(rankings / bond_levels)には一切触らない。新しいテーブルを1つ作るだけ。
-- これをエラー無く通してから BREEDER_PROFILE_APPLY.sql(末尾 commit;)を実行する。
--
-- なぜ作るのか:
--   ランキングは「1プレイ＝1行」で、その瞬間の名前・アイコン・フレームを記録へ写している。
--   そのため、あとから見た目を変えても過去の行は古いままだった
--   (2026-09-16・ユーザー指摘「アイコンとフレームは更新時じゃなくて常に設定してるやつが
--    ランキングに出るようにできないの？」)。
--   記録そのものは書き換えず、**表示に使う見た目だけ**をこの表から引く。
--
-- ★記録(rankings / bond_levels)は1行も書き換えない。順位・スコア・集計にも一切関わらない。
-- ★1人1行しか増えない(プレイするたびに増えることはない)。
--
-- 先に必要なSQL: BREEDER_ID_APPLY.sql(端末ごとのブリーダーIDを送るようになっていること)

begin;

do $$
begin
  if to_regclass('public.rankings') is null then
    raise exception 'public.rankings がありません。先に RANKINGS_APPLY.sql を適用してください。';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='rankings' and column_name='breeder_id') then
    raise exception 'public.rankings.breeder_id がありません。先に BREEDER_ID_APPLY.sql を適用してください。';
  end if;
end $$;

-- 既に別物の breeder_profiles がある環境では、上書きせず安全側で停止する。
do $$
begin
  if to_regclass('public.breeder_profiles') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='breeder_profiles' and column_name='breeder_id') then
    raise exception 'public.breeder_profiles が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- ===== ① テーブル =====
-- breeder_id は端末ごとに1回だけ作るID(mh_breeder_id_v1)。名前を変えても変わらない。
-- 1人1行なので、プレイ回数が増えても行は増えない。
create table if not exists public.breeder_profiles (
  breeder_id    text        not null,
  user_name     text,
  icon          text,
  profile_frame text,
  updated_at    timestamptz not null default now(),
  constraint breeder_profiles_pkey primary key (breeder_id),
  -- 明らかにありえない値を弾く。フレームidの形は rankings / bond_levels と同じにそろえる
  constraint breeder_profiles_breeder_id_shape check (length(breeder_id) between 1 and 100),
  constraint breeder_profiles_user_name_len    check (user_name is null or length(user_name) <= 40),
  constraint breeder_profiles_icon_len         check (icon is null or length(icon) <= 100),
  constraint breeder_profiles_frame_shape      check (profile_frame is null or (profile_frame ~ '^[a-z0-9_]{1,40}$'))
);

comment on table public.breeder_profiles is
  'ブリーダーの「いまの名前・アイコン・プロフィールフレーム」。1人1行。ランキングの表示にだけ使い、記録(rankings/bond_levels)も順位も一切変えない。';
comment on column public.breeder_profiles.breeder_id is
  '端末ごとに1回だけ作るブリーダーID(mh_breeder_id_v1)。rankings.breeder_id と同じ値。';
comment on column public.breeder_profiles.updated_at is
  '最後に上書きした時刻。名前が重なったときにどれを使うかの判断と、古い行の見分けに使う。';

-- 名前から引く経路のための索引(IDを持たない古い記録の表示に使う)
create index if not exists breeder_profiles_user_name_idx
  on public.breeder_profiles (user_name);

-- 上書きのたびに updated_at を進める
create or replace function public.breeder_profiles_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists breeder_profiles_set_updated_at on public.breeder_profiles;
create trigger breeder_profiles_set_updated_at
  before insert or update on public.breeder_profiles
  for each row execute function public.breeder_profiles_touch_updated_at();

-- ===== ② 権限 =====
-- 読み書きは rankings と同じ考え方(公開キーの anon が触れる)。
-- 消す権限は与えない。間違って書き始めても、行が消えることはない。
alter table public.breeder_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_profiles' and policyname='anyone can read breeder profiles') then
    create policy "anyone can read breeder profiles"
      on public.breeder_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_profiles' and policyname='anyone can insert breeder profiles') then
    create policy "anyone can insert breeder profiles"
      on public.breeder_profiles for insert with check (true);
  end if;
  -- 自分の行を上書きするために要る(on_conflict のupsertがUPDATEを使う)
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_profiles' and policyname='anyone can update breeder profiles') then
    create policy "anyone can update breeder profiles"
      on public.breeder_profiles for update using (true) with check (true);
  end if;
end $$;

grant select, insert, update on public.breeder_profiles to anon, authenticated;
-- 削除は与えない(与えていないことを下の検査で確かめる)
revoke delete on public.breeder_profiles from anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====
do $$
declare
  cnt int;
begin
  if to_regclass('public.breeder_profiles') is null then
    raise exception 'breeder_profiles が作られていません';
  end if;

  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='breeder_profiles'
     and column_name in ('breeder_id','user_name','icon','profile_frame','updated_at');
  if cnt <> 5 then raise exception 'breeder_profiles の列がそろっていません(%件)', cnt; end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='breeder_profiles' and c.relrowsecurity) then
    raise exception 'breeder_profiles のRLSが有効になっていません';
  end if;

  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name='breeder_profiles'
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'breeder_profiles に削除の権限が付いています';
  end if;

  -- 既存のテーブルに触っていないこと
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='rankings' and column_name='breeder_id') then
    raise exception 'rankings.breeder_id が見当たりません(既存テーブルを壊した可能性)';
  end if;

  -- 実際に1行書けて、同じIDで上書きになること(行が増えないこと)
  insert into public.breeder_profiles (breeder_id, user_name, icon, profile_frame)
  values ('__apply_check__', 'テスト', 'Mocchi', 'gold');
  insert into public.breeder_profiles (breeder_id, user_name, icon, profile_frame)
  values ('__apply_check__', 'テスト2', 'Suezo', 'rainbow')
  on conflict (breeder_id) do update
     set user_name = excluded.user_name, icon = excluded.icon, profile_frame = excluded.profile_frame;
  select count(*) into cnt from public.breeder_profiles where breeder_id = '__apply_check__';
  if cnt <> 1 then raise exception '同じIDで2行になりました(1行で上書きされていません)'; end if;
  delete from public.breeder_profiles where breeder_id = '__apply_check__';
end $$;

-- 追加した内容をまとめて表示する。
with facts as (
  select 1 as sort, 'breeder_profiles テーブル' as item,
         (select case when to_regclass('public.breeder_profiles') is null then 'なし' else 'あり' end) as value
  union all
  select 2, '列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_profiles')
  union all
  select 3, '主キー',
         (select coalesce(string_agg(a.attname, ', '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='breeder_profiles' and c.contype='p')
  union all
  select 4, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_profiles')
  union all
  select 5, 'ポリシー',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='breeder_profiles')
  union all
  select 6, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_profiles'
            and grantee in ('anon','authenticated'))
  union all
  select 7, 'breeder_profiles の件数(最初は0)',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 8, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
