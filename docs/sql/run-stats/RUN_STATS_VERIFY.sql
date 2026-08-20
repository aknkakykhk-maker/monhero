-- turns / reached_wave の適用結果と、既存 rankings が無傷であることを確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。

-- V-1. 列が出来ているか、型・NULL許容
select ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
order by ordinal_position;

-- V-2. 検査制約
select c.conname as constraint_name, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'rankings' and c.contype = 'c'
order by c.conname;

-- V-3. RLS・ポリシー・権限が適用前と変わっていないこと
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings'
order by policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- V-4. 中身。適用直後は両方0件、ゲームを1周してから再実行すると増える
select count(*) as rankings_rows,
       count(*) filter (where turns is not null) as with_turns,
       count(*) filter (where reached_wave is not null) as with_reached_wave
from public.rankings;

-- V-5. 実際の並び。アプリが出す一覧と同じ取り方
select user_name, difficulty, score, turns, reached_wave
from public.rankings
order by score desc
limit 20;

-- V-6. まとめ(ファイル全体を実行すると、Supabase はこの最後の1文だけを表示する)
with facts as (
  select 1 as sort, 'turns 列' as item,
         (select coalesce(string_agg(data_type || ' / NULL可' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='turns') as value
  union all
  select 2, 'reached_wave 列',
         (select coalesce(string_agg(data_type || ' / NULL可' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='reached_wave')
  union all
  select 3, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname in ('rankings_turns_range','rankings_reached_wave_range'))
  union all
  select 4, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rankings')
  union all
  select 5, 'ポリシー',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='rankings')
  union all
  select 6, '権限',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rankings'
            and grantee in ('anon','authenticated'))
  union all
  select 7, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 8, 'ターン数が入っている記録(1周クリアすると増える)',
         (select count(*)::text from public.rankings where turns is not null)
  union all
  select 9, '到達WAVEが入っている記録(1周遊ぶと増える)',
         (select count(*)::text from public.rankings where reached_wave is not null)
  union all
  select 10, '最新の5件',
         (select coalesce(string_agg(t.user_name
              || ' / スコア' || coalesce(t.score::text,'?')
              || ' / ' || coalesce('WAVE'||t.reached_wave::text,'WAVE不明')
              || ' / ' || coalesce(t.turns::text||'ターンでクリア','クリアなし'), ', '), '(まだ無し)')
          from (select * from public.rankings order by id desc limit 5) t)
)
select item as "項目", value as "値" from facts order by sort;
