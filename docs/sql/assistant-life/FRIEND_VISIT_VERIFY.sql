-- 助手ライフ: フレンドの家との行き来の表が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。 本番変更が残るか: いいえ。
with facts as (
  select 1 as sort, '表(スイッチ / 控え / 行き来)' as item,
         (case when to_regclass('public.assistant_life_friend_switch') is null then 'なし' else 'あり' end)
         ||' / '||(case when to_regclass('public.assistant_life_friend_houses') is null then 'なし' else 'あり' end)
         ||' / '||(case when to_regclass('public.assistant_life_friend_visits') is null then 'なし' else 'あり' end) as value
  union all
  select 2, 'スイッチの mode(最初は thin)',
         (select coalesce(string_agg(mode, ','), 'なし') from public.assistant_life_friend_switch)
  union all
  select 3, 'RLS(3つとも有効なら 3)',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname like 'assistant_life_friend_%' and c.relkind='r' and c.relrowsecurity)
  union all
  select 4, '公開の鍵(anon)の権限(DELETE が無いこと)',
         (select coalesce(string_agg(distinct table_name||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and grantee='anon' and table_name like 'assistant_life_friend_%')
  union all
  select 5, '列ごとの権限(行き来は thanks だけ UPDATE)',
         (select coalesce(string_agg(distinct table_name||'.'||column_name||':'||privilege_type, ', '), 'なし')
          from information_schema.column_privileges
          where table_schema='public' and grantee='anon' and table_name='assistant_life_friend_visits' and privilege_type='UPDATE')
  union all
  select 6, '見張り',
         (select coalesce(string_agg(tgname, ', ' order by tgname), 'なし') from pg_trigger
           where not tgisinternal and tgrelid::regclass::text like '%assistant_life_friend_%')
  union all
  select 7, '控え / 行き来の件数',
         (select (select count(*) from public.assistant_life_friend_houses)::text||' / '||(select count(*) from public.assistant_life_friend_visits)::text)
  union all
  select 8, 'rankings の件数(触っていないこと)', (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
