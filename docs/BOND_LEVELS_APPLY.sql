-- 絆Lvランキング用テーブル public.bond_levels を本番へ追加するSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 既存の public.rankings は変更しない(DROP・DELETE・ALTER・RLS/権限の変更をしない)。
-- 追加するのは新しいテーブル1つと、その索引・トリガー・ポリシー・権限だけ。
-- 先に BOND_LEVELS_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。

begin;

-- 既存 rankings の状態を先に控える。この作業では rankings を一切変更しないので、
-- 最後に「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table bond_rankings_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table bond_rankings_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table bond_rankings_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table bond_rankings_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 既に別物の bond_levels がある環境では、上書きせず安全側で停止する。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bond_levels'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bond_levels'
      and column_name = 'individual_id'
  ) then
    raise exception 'public.bond_levels が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- 絆Lvランキングの正本。「1人 × 1個体」で必ず1行になるので、記録が何回増えても
-- 一覧から人が消えない。並べ替えもDB側で完結する。
create table if not exists public.bond_levels (
  user_name     text        not null,
  -- 個体ID。マスモンは masuId、個体を特定できない古い記録は 'legacy:種ID'
  individual_id text        not null,
  monster_id    text,
  mon_name      text,
  bond_level    integer     not null,
  icon          text,
  -- 詳細表示用の育成スナップショット(rankings.party の member.detail と同じ形)
  detail        jsonb,
  colors        jsonb,
  updated_at    timestamptz not null default now(),
  constraint bond_levels_pkey primary key (user_name, individual_id),
  constraint bond_levels_bond_level_range check (bond_level >= 0 and bond_level <= 10000)
);

comment on table public.bond_levels is
  '絆Lvランキングの正本。1人1個体1行。プレイ終了時にクライアントがupsertする。';
comment on column public.bond_levels.individual_id is
  'マスモンのmasuId。個体を特定できない古い記録は legacy:種ID を使う。';
comment on column public.bond_levels.bond_level is
  'その個体の現在の絆Lv。転生で下がることがあるため、最新値で上書きする。';
comment on column public.bond_levels.detail is
  'ランキングの詳細表示に使う育成スナップショット。無い場合は詳細を出さない。';

-- 一覧は絆Lvの高い順に上位だけを取る。
create index if not exists bond_levels_level_idx
  on public.bond_levels (bond_level desc);
-- 種類別タブ(モンスターごとの絞り込み)用。
create index if not exists bond_levels_monster_idx
  on public.bond_levels (monster_id, bond_level desc);

-- upsertは指定した列だけを更新するため、updated_at は触られない。
-- 「最後に更新した時刻」を必ず正しく残すため、書き込みのたびにサーバー側で入れ直す。
create or replace function public.bond_levels_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bond_levels_set_updated_at on public.bond_levels;
create trigger bond_levels_set_updated_at
  before insert or update on public.bond_levels
  for each row execute function public.bond_levels_touch_updated_at();

-- RLSと権限。公開キーで読み書きする点は既存の rankings と同じ信頼レベルにそろえる。
-- 削除だけはどのロールにも許可しない(消えたら復旧できないため)。
alter table public.bond_levels enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='bond_levels' and policyname='bond_levels_select') then
    create policy bond_levels_select on public.bond_levels
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='bond_levels' and policyname='bond_levels_insert') then
    create policy bond_levels_insert on public.bond_levels
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='bond_levels' and policyname='bond_levels_update') then
    create policy bond_levels_update on public.bond_levels
      for update to anon, authenticated using (true) with check (true);
  end if;
end $$;

-- Supabaseは既定で「テーブル作成時に anon/authenticated へ全権限(DELETEを含む)を
-- 自動付与する」設定になっていることがあるため、grantの前にいったん全て外してから
-- 必要な3つだけを与え直す。これをしないと、grantで書いていないDELETEが
-- 自動付与されたまま残ってしまう。
revoke all on public.bond_levels from anon, authenticated;
grant select, insert, update on public.bond_levels to anon, authenticated;

-- ここから先は「既存の rankings に触っていないこと」の検査。1つでも違えば例外で止まる。
do $$
begin
  if (select row_count from bond_rankings_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from bond_rankings_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from bond_rankings_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from bond_rankings_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from bond_rankings_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from bond_rankings_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from bond_rankings_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
-- Supabase の SQL Editor はファイル全体を実行すると「最後の1文」の結果しか出さないため、
-- 見たい項目を縦に並べた1文にしてある。
with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='bond_levels') || ' (1なら作成済み)' as value
  union all
  select 2, 'カラム',
         (select string_agg(column_name, ', ' order by ordinal_position)
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels')
  union all
  select 3, '主キー',
         (select coalesce(string_agg(pg_get_constraintdef(c.oid), ' / '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 4, '索引(valid/readyがすべてtrueであること)',
         (select string_agg(i.relname||':'||ix.indisvalid||'/'||ix.indisready, ', ' order by i.relname)
          from pg_class t join pg_namespace n on n.oid=t.relnamespace
          join pg_index ix on ix.indrelid=t.oid join pg_class i on i.oid=ix.indexrelid
          where n.nspname='public' and t.relname='bond_levels')
  union all
  select 5, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 6, 'ポリシー(select/insert/updateの3つ)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='bond_levels')
  union all
  select 7, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='bond_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 8, 'updated_atのトリガー',
         (select coalesce(string_agg(tgname, ', '), 'なし')
          from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels' and not tg.tgisinternal)
  union all
  select 9, 'rankings の件数(調査時と同じであること)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しいテーブルを認識させる。
-- これを忘れると、しばらくの間アプリから bond_levels が見えないことがある。
notify pgrst, 'reload schema';
