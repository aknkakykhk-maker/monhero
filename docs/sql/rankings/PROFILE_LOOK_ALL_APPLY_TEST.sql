-- 「いまの見た目をランキングに出す」ために残っている作業をまとめて行うSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(PROFILE_LOOK_ALL_APPLY.sql)の前にこちらを通す。
--
-- このファイル1本で、次の2つをまとめて行う。
--   ① public.bond_levels へ profile_frame 列を1つ足す
--      (絆Lv・総合力ランキングにプロフィールフレームを出すため)
--      = PROFILE_FRAME_BOND_APPLY.sql と同じ内容
--   ② public.breeder_profiles テーブルを1つ作る
--      (名前・アイコン・フレームを「いま設定しているもの」で出すため)
--      = BREEDER_PROFILE_APPLY.sql と同じ内容
--   ③ public.bond_levels へ breeder_id 列を1つ足す
--      (絆Lv・総合力で、人を名前ではなくIDで見分けるため)
--      = BOND_LEVELS_BREEDER_ID_APPLY.sql と同じ内容
--
-- ★①②③は1つのトランザクションに入っているので、途中で1つでもおかしければ
--   **すべて**元に戻る。中途半端に一部だけ当たった状態にはならない。
-- ★既存の記録(rankings / bond_levels の行)は1行も書き換えない。DROP・DELETE・UPDATEをしない。
-- ★順位・スコア・集計には一切関わらない。変わるのは見た目だけ。
--
-- これをエラー無く通してから PROFILE_LOOK_ALL_APPLY.sql(末尾 commit;)を実行する。
--
-- 既に片方だけ当ててしまっていても、そのまま実行してよい
-- (add column if not exists / create table if not exists なので、当たっている側は何もしない)。
--
-- 先に必要なSQL:
--   RANKINGS_APPLY.sql       … rankings そのもの
--   BOND_LEVELS_APPLY.sql    … bond_levels そのもの
--   BREEDER_ID_APPLY.sql     … rankings.breeder_id(端末ごとのブリーダーID)
--   PROFILE_FRAME_APPLY.sql  … rankings.profile_frame(通常ランキングのフレーム。適用済み)
-- どれか足りなければ、何も変えずに先頭の点検でその場で止まる。

begin;

-- ===== ⓪ 前提の点検。足りないものがあれば、何も変えずにここで止まる =====
do $$
begin
  if to_regclass('public.rankings') is null then
    raise exception 'public.rankings がありません。先に RANKINGS_APPLY.sql を適用してください。';
  end if;
  if to_regclass('public.bond_levels') is null then
    raise exception 'public.bond_levels がありません。先に BOND_LEVELS_APPLY.sql を適用してください。';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='rankings' and column_name='breeder_id') then
    raise exception 'public.rankings.breeder_id がありません。先に BREEDER_ID_APPLY.sql を適用してください。';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='rankings' and column_name='profile_frame') then
    raise exception 'public.rankings.profile_frame がありません。先に PROFILE_FRAME_APPLY.sql を適用してください。';
  end if;
end $$;

-- 短時間だけDDLと競合する書き込みを止める。
lock table public.bond_levels in share row exclusive mode;

-- 適用前の状態を控える。中身も権限も変えないので、最後に機械的に確かめる。
create temporary table bond_frame_count_before on commit drop as
select count(*) as row_count from public.bond_levels;

create temporary table rankings_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table bond_look_pkey_before on commit drop as
select a.attname
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p';

create temporary table bond_frame_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'bond_levels';

create temporary table bond_frame_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'bond_levels';

create temporary table bond_frame_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'bond_levels'
  and grantee in ('anon', 'authenticated');


-- ============================================================
-- ① bond_levels へ profile_frame 列を足す
--    (絆Lv・総合力ランキングにフレームを出すため)
-- ============================================================

-- 既に同名の列が別の型である環境では、作り替えず安全側で停止する。
do $$
declare
  frame_type text;
begin
  select data_type into frame_type from information_schema.columns
  where table_schema = 'public' and table_name = 'bond_levels' and column_name = 'profile_frame';
  if frame_type is not null and frame_type <> 'text' then
    raise exception 'public.bond_levels.profile_frame が別の型(%)で既に存在します。内容を確認してから再実行してください', frame_type;
  end if;
end $$;

-- 列を1つ足す。列を足す前の記録はNULLのままで、あとから埋めない(NULL = フレームなし)。
alter table public.bond_levels add column if not exists profile_frame text;

comment on column public.bond_levels.profile_frame is
  'プロフィールフレームのid(data/breeder.js の PROFILE_FRAMES)。NULL = フレームなし。表示だけに使い、絆Lv・総合力の順位には影響しない。';

-- 明らかにありえない値を弾く。rankings 側とまったく同じ形にそろえる。
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'bond_levels'
                   and c.conname = 'bond_levels_profile_frame_shape') then
    alter table public.bond_levels add constraint bond_levels_profile_frame_shape
      check (profile_frame is null or (profile_frame ~ '^[a-z0-9_]{1,40}$'));
  end if;
end $$;


-- ============================================================
-- ② breeder_profiles テーブルを作る
--    (名前・アイコン・フレームを「いま設定しているもの」で出すため)
-- ============================================================

-- 既に別物の breeder_profiles がある環境では、上書きせず安全側で停止する。
do $$
begin
  if to_regclass('public.breeder_profiles') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='breeder_profiles' and column_name='breeder_id') then
    raise exception 'public.breeder_profiles が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

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


-- ============================================================
-- ③ bond_levels へ breeder_id 列を足す
--    (絆Lv・総合力で、人を名前ではなくIDで見分けるため)
-- ============================================================
--
-- bond_levels は主キーが (user_name, individual_id) ＝「名前 × 個体」なので、
-- 人を見分ける手がかりが名前しか無かった。そのため改名すると同じマスモンが2行に分かれ、
-- 同名の人がいるとどれが誰か決められなかった
-- (2026-09-16・ユーザー指摘「名前管理はさすがにだめだろ」)。
--
-- ★主キーは変えない。既存の行はそのまま残り、これまでのupsertも今までどおり動く。
--   改名して増えてしまった古い行は、**画面側がIDでまとめて1行に見せる**。
--   行を消すのは危険なので消さない。

do $$
declare
  id_type text;
begin
  select data_type into id_type from information_schema.columns
  where table_schema = 'public' and table_name = 'bond_levels' and column_name = 'breeder_id';
  if id_type is not null and id_type <> 'text' then
    raise exception 'public.bond_levels.breeder_id が別の型(%)で既に存在します。内容を確認してから再実行してください', id_type;
  end if;
end $$;

alter table public.bond_levels add column if not exists breeder_id text;

comment on column public.bond_levels.breeder_id is
  '端末ごとに1回だけ作るブリーダーID(mh_breeder_id_v1)。rankings.breeder_id と同じ値。NULL = IDが無かった時代の記録。表示で人を見分けるためだけに使い、順位や集計には影響しない。';

do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'bond_levels'
                   and c.conname = 'bond_levels_breeder_id_shape') then
    alter table public.bond_levels add constraint bond_levels_breeder_id_shape
      check (breeder_id is null or (length(breeder_id) between 1 and 100));
  end if;
end $$;

-- 「同じ人の同じ個体」をまとめて引くための索引。
-- ★unique にはしない。改名して2行になっている人が既にいる可能性があり、
--   unique を付けると適用そのものが失敗する(既存データを壊しにいかない)。
create index if not exists bond_levels_breeder_idx
  on public.bond_levels (breeder_id, individual_id);


-- ============================================================
-- ここから先は検査。1つでも違えば例外で止まり、①②③とも元に戻る
-- ============================================================

-- ①の検査: 既存の中身と権限に触っていないこと
do $$
begin
  if (select row_count from bond_frame_count_before)
     <> (select count(*) from public.bond_levels) then
    raise exception 'bond_levels の件数が変化しました';
  end if;

  if (select row_count from rankings_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from bond_frame_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'bond_levels')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'bond_levels'
     except select * from bond_frame_security_before)
  ) then raise exception 'bond_levels のRLS状態が変化しました'; end if;

  if exists (
    (select * from bond_frame_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'bond_levels')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'bond_levels'
     except select * from bond_frame_policies_before)
  ) then raise exception 'bond_levels のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from bond_frame_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bond_levels'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bond_levels'
       and grantee in ('anon', 'authenticated')
     except select * from bond_frame_grants_before)
  ) then raise exception 'bond_levels のData API権限が変化しました'; end if;

  -- 新しい列にも既存と同じ権限が要る(列単位の権限がある環境では引き継がれない)
  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'bond_levels'
      and grantee = 'anon' and privilege_type = 'INSERT'
  ) then raise exception 'anon が bond_levels へINSERTできません'; end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bond_levels' and column_name='profile_frame') then
    raise exception 'bond_levels.profile_frame が作られていません';
  end if;

  -- ③ 主キーを変えていないこと(既存の行を壊さない)
  if exists (
    (select * from bond_look_pkey_before except
     select a.attname from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     join unnest(c.conkey) k(attnum) on true
     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p')
    union all
    (select a.attname from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     join unnest(c.conkey) k(attnum) on true
     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p'
     except select * from bond_look_pkey_before)
  ) then raise exception 'bond_levels の主キーが変化しました'; end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bond_levels' and column_name='breeder_id') then
    raise exception 'bond_levels.breeder_id が作られていません';
  end if;
end $$;

-- ②の検査
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

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
with facts as (
  select 1 as sort, '① bond_levels.profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '① bond_levels の検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels'
            and c.conname = 'bond_levels_profile_frame_shape')
  union all
  select 3, '① bond_levels のRLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 4, '① bond_levels のポリシー(変わっていないこと)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='bond_levels')
  union all
  select 5, '① bond_levels の権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='bond_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 6, '① bond_levels の件数(適用前と同じであること)',
         (select count(*)::text from public.bond_levels)
  union all
  select 7, '② breeder_profiles テーブル',
         (select case when to_regclass('public.breeder_profiles') is null then 'なし' else 'あり' end)
  union all
  select 8, '② breeder_profiles の列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_profiles')
  union all
  select 9, '② breeder_profiles の主キー',
         (select coalesce(string_agg(a.attname, ', '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='breeder_profiles' and c.contype='p')
  union all
  select 10, '② breeder_profiles のRLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_profiles')
  union all
  select 11, '② breeder_profiles のポリシー',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='breeder_profiles')
  union all
  select 12, '② breeder_profiles の権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_profiles'
            and grantee in ('anon','authenticated'))
  union all
  select 13, '② breeder_profiles の件数(最初は0)',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 14, '③ bond_levels.breeder_id 列',
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='breeder_id')
         || ' (text / YES なら正しい)'
  union all
  select 15, '③ bond_levels の索引',
         (select coalesce(string_agg(indexname, ', ' order by indexname), 'なし')
          from pg_indexes where schemaname='public' and tablename='bond_levels'
            and indexname = 'bond_levels_breeder_idx')
  union all
  select 16, '③ bond_levels の主キー(変わっていないこと)',
         (select coalesce(string_agg(a.attname, ', ' order by a.attname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 17, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
