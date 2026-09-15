-- public.bond_levels へ profile_frame 列を1つ追加するSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 既存の行・列・RLS・ポリシー・権限は変更しない(DROP・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列1つだけなので、既存の記録はすべてNULLのまま残る(NULL = フレームなし)。
-- 先に PROFILE_FRAME_BOND_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
--
-- なぜ足すのか:
--   絆Lv・総合力ランキングだけは rankings ではなく専用テーブル bond_levels から読んでいる。
--   そのため rankings へ profile_frame を足しただけでは、この2つに飾り枠が出ない
--   (2026-09-15・ユーザー依頼「3もやってよ」)。
--   ここは1人×1個体で1行の単純なテーブルで、ビューも関数もぶら下がっていないので、
--   列を1つ足すだけで済む。
--
-- 先に必要なSQL: BOND_LEVELS_APPLY.sql(テーブルそのもの)
--
-- アプリ側はこのSQLを当てる前でも壊れない。列が無い間は
--   ・送るとき … profile_frame を外して送り直す(絆Lvの記録は必ず残る)
--   ・出すとき … profile_frame を外して取り直す(枠が出ないだけ)
-- ので、SQLの適用とアプリの公開はどちらが先でもよい(26-supabase.jsx)。
-- ★rankings 側とは別に覚えるので、片方だけ当たっている状態でも取り違えない。

begin;

do $$
begin
  if to_regclass('public.bond_levels') is null then
    raise exception 'public.bond_levels がありません。先に BOND_LEVELS_APPLY.sql を適用してください。';
  end if;
end $$;

-- 短時間だけDDLと競合する書き込みを止める。
lock table public.bond_levels in share row exclusive mode;

-- 適用前の状態を控える。中身も権限も変えないので、最後に機械的に確かめる。
create temporary table bond_frame_count_before on commit drop as
select count(*) as row_count from public.bond_levels;

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

-- ===== ここから先は「既存の中身と権限に触っていないこと」の検査 =====
do $$
begin
  if (select row_count from bond_frame_count_before)
     <> (select count(*) from public.bond_levels) then
    raise exception 'bond_levels の件数が変化しました';
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
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
with facts as (
  select 1 as sort, 'profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels'
            and c.conname = 'bond_levels_profile_frame_shape')
  union all
  select 3, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 4, 'ポリシー(変わっていないこと)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='bond_levels')
  union all
  select 5, '権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='bond_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 6, 'bond_levels の件数(適用前と同じであること)',
         (select count(*)::text from public.bond_levels)
  union all
  select 7, 'profile_frame が入っている記録(初回の適用直後は0)',
         (select count(*)::text from public.bond_levels where profile_frame is not null)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しい列を認識させる。
notify pgrst, 'reload schema';
