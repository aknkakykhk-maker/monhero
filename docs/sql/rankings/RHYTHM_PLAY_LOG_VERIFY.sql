-- public.rhythm_play_logs が思ったとおりにできているかを確かめるSQL(読み取りだけ)。
-- 読み取り専用: はい。本番変更は残らない。
-- RHYTHM_PLAY_LOG_APPLY.sql のあとに実行する。最後の1文がまとめ。
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'rhythm_play_logs') as "列の数(13)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'rhythm_play_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'rhythm_play_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select string_agg(distinct privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'rhythm_play_logs' and grantee = 'anon') as "anon の権限(INSERT,SELECT)",
  (select count(*) from public.rhythm_play_logs) as "記録の件数",
  (select max(created_at) from public.rhythm_play_logs) as "いちばん新しい記録";
