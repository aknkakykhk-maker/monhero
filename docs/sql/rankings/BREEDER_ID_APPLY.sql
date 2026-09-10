-- public.rankings へ breeder_id 列を1つ追加するSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 既存の行・列・RLS・ポリシー・権限は変更しない(DROP・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列1つだけなので、既存の記録はすべてNULLのまま残る。
-- 先に BREEDER_ID_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
--
-- なぜ足すのか:
--   全国ランキングはこれまで user_name だけで人を見分けていた。曲別ランキング(その名前の
--   最高1件を見せるだけ)なら同名がいても大きな害は無いが、これから作る「全曲合算」は
--   その人の全曲を足すため、同名の人がいると別人の点まで足されてしまう。
--   詳しくは docs/spec/RHYTHM_RANKING.md §4。

begin;

-- 短時間だけDDLと競合する書き込みを止め、検査から列追加までの競合を防ぐ。
lock table public.rankings in share row exclusive mode;

-- 適用前の状態を控える。この作業では中身も権限も変えないので、
-- 最後に「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table breeder_id_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table breeder_id_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table breeder_id_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table breeder_id_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 既に同名の列が別の型である環境では、作り替えず安全側で停止する。
do $$
declare
  breeder_type text;
begin
  select data_type into breeder_type from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'breeder_id';
  if breeder_type is not null and breeder_type <> 'text' then
    raise exception 'public.rankings.breeder_id が別の型(%)で既に存在します。内容を確認してから再実行してください', breeder_type;
  end if;
end $$;

-- 端末ごとに1回だけ作るID。名前を変えても変わらない。
-- 列を足す前の記録はNULLのままで、あとから埋めることもしない
-- (誰のものか分からない記録を推測で誰かに結び付けない。docs/spec/RHYTHM_RANKING.md §4.4)。
alter table public.rankings add column if not exists breeder_id text;

comment on column public.rankings.breeder_id is
  '端末ごとに1回だけ作るブリーダーID(mh_breeder_id_v1)。同名の別人を見分けるために使う。列を足す前の記録はNULL。';

-- 明らかにありえない値を弾く。既存行はすべてNULLなので、この制約に引っかかる行は無い
-- (UUIDは36文字。フォールバックのIDでも100文字には遠く届かない)。
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'rankings'
                   and c.conname = 'rankings_breeder_id_shape') then
    alter table public.rankings add constraint rankings_breeder_id_shape
      check (breeder_id is null or (length(breeder_id) between 1 and 100));
  end if;
end $$;

-- ここから先は「既存の中身と権限に触っていないこと」の検査。1つでも違えば例外で止まる。
do $$
begin
  if (select row_count from breeder_id_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from breeder_id_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from breeder_id_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from breeder_id_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from breeder_id_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from breeder_id_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from breeder_id_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;

  -- 新しい列にも既存と同じ権限が要る。Supabaseはテーブル単位の権限を引き継ぐが、
  -- 列単位の権限が設定されている環境では引き継がれないため、ここで確かめる
  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'rankings'
      and grantee = 'anon' and privilege_type = 'INSERT'
  ) then raise exception 'anon が rankings へINSERTできません'; end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
-- Supabase の SQL Editor はファイル全体を実行すると「最後の1文」の結果しか出さないため、
-- 見たい項目を縦に並べた1文にしてある。
with facts as (
  select 1 as sort, 'breeder_id 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='breeder_id')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname = 'rankings_breeder_id_shape')
  union all
  select 3, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rankings')
  union all
  select 4, 'ポリシー(変わっていないこと)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='rankings')
  union all
  select 5, '権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rankings'
            and grantee in ('anon','authenticated'))
  union all
  select 6, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 7, 'breeder_id が入っている記録(適用直後は0)',
         (select count(*)::text from public.rankings where breeder_id is not null)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しい列を認識させる。
-- これを忘れると、しばらくの間アプリから breeder_id が見えないことがある。
notify pgrst, 'reload schema';
