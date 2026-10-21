-- raid_battle_logs・tactics_pro_logs ができているか、読むだけで確かめるSQL(流したあとに使う・2026-10-21)。
-- 読み取り専用: はい。本番変更が残るか: いいえ。
-- 期待: 2行とも 列の数 15・RLS true・ポリシー *_insert:INSERT, *_select:SELECT・anon の権限 INSERT,SELECT。件数は印を真にするまで 0
select t.table_name as "表",
  (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as "列の数(どちらも15)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = t.table_name) as "RLS(true)",
  (select string_agg(p.policyname || ':' || p.cmd, ', ' order by p.policyname) from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name) as "ポリシー(INSERT と SELECT だけ)",
  (select string_agg(g.privilege_type, ',' order by g.privilege_type) from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'anon') as "anon の権限(INSERT,SELECT)"
from (values ('raid_battle_logs'), ('tactics_pro_logs')) as t(table_name);
select
  (select count(*) from public.raid_battle_logs) as "raid_battle_logs の件数",
  (select count(*) from public.tactics_pro_logs) as "tactics_pro_logs の件数";
