-- public.battle_logs ができているか、読むだけで確かめるSQL(2026-10-21)。
-- 読み取り専用: はい。本番変更が残るか: いいえ。
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'battle_logs') as "列の数(18)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'battle_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'battle_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select reltuples::bigint from pg_class where oid = to_regclass('public.battle_logs')) as "記録のおおよその件数";
