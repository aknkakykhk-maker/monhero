-- public.bond_levels の適用結果と、既存 rankings が無傷であることを確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。

-- V-1. テーブルが出来ているか、カラムの型・NULL許容・既定値
select ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'bond_levels'
order by ordinal_position;

-- V-2. 主キー(user_name, individual_id)と検査制約
select c.conname as constraint_name,
       case c.contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
                      when 'c' then 'CHECK' else c.contype::text end as kind,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'bond_levels'
order by c.conname;

-- V-3. 索引(絆Lv順・種類別)がVALID・READYか
select i.relname as index_name, ix.indisunique as is_unique,
       ix.indisvalid as is_valid, ix.indisready as is_ready,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'bond_levels'
order by i.relname;

-- V-4. updated_at を入れ直すトリガーが付いているか
select tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'bond_levels' and not t.tgisinternal
order by tgname;

-- V-5. RLSが有効か
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('bond_levels', 'rankings')
order by c.relname;

-- V-6. ポリシー(select / insert / update の3つだけ。deleteは作らない)
select tablename, policyname, permissive, roles, cmd,
       qual as using_expression, with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename in ('bond_levels', 'rankings')
order by tablename, policyname;

-- V-7. Data APIロールの権限。bond_levels に DELETE が無いことも確認する
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('bond_levels', 'rankings')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- V-8. 既存ランキングの件数(調査時のA-4と同じ数であること)
select count(*) as rankings_rows from public.rankings;

-- V-9. 中身の確認。適用直後は0件、ゲームを1周してから再実行すると増える
select count(*) as bond_levels_rows,
       count(distinct user_name) as breeders,
       count(*) filter (where detail is not null) as with_detail
from public.bond_levels;

-- V-10. 実際の並び。アプリが出す一覧と同じ取り方
select user_name, mon_name, bond_level, updated_at
from public.bond_levels
order by bond_level desc
limit 20;

-- V-11. まとめ(ファイル全体を実行すると、Supabase はこの最後の1文だけを表示する)
with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='bond_levels') || ' (1なら作成済み)' as value
  union all
  select 2, '主キー',
         (select coalesce(string_agg(pg_get_constraintdef(c.oid), ' / '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 3, '索引(valid/ready)',
         (select string_agg(i.relname||':'||ix.indisvalid||'/'||ix.indisready, ', ' order by i.relname)
          from pg_class t join pg_namespace n on n.oid=t.relnamespace
          join pg_index ix on ix.indrelid=t.oid join pg_class i on i.oid=ix.indexrelid
          where n.nspname='public' and t.relname='bond_levels')
  union all
  select 4, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 5, 'ポリシー',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='bond_levels')
  union all
  select 6, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='bond_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 7, 'updated_atのトリガー',
         (select coalesce(string_agg(tgname, ', '), 'なし')
          from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels' and not tg.tgisinternal)
  union all
  select 8, 'rankings の件数(調査時と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 9, 'bond_levels の件数(適用直後は0、1周後に増える)',
         (select count(*)::text from public.bond_levels)
  union all
  select 10, '絆Lv上位5件',
         (select coalesce(string_agg(t.user_name||'/'||coalesce(t.mon_name,'?')||' Lv'||t.bond_level, ', '), '(まだ無し)')
          from (select * from public.bond_levels order by bond_level desc limit 5) t)
)
select item as "項目", value as "値" from facts order by sort;
