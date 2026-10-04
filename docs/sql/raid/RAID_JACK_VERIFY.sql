-- ジャックの表とビューが正しい形で入っているかを確かめる(読み取り専用。何も変えない)。
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_hits') as "列の数(9)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'raid_jack_hits') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'raid_jack_hits') as "ポリシー",
  (select count(*) from information_schema.views where table_schema = 'public' and table_name in ('raid_jack_tier_totals','raid_jack_contributions','raid_jack_b_ranking')) as "ビューの数(3)",
  (select count(*) from public.raid_jack_hits) as "記録の件数",
  (select coalesce(sum(damage), 0) from public.raid_jack_hits) as "与ダメージの合計";
