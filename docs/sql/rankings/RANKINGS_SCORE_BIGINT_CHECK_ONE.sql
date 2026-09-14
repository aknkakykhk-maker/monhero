-- 「score が int4 のままか」を、1回の Run で1枚の表にして出すSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。
--
-- Supabase の SQL Editor は、まとめて実行したときに「最後のSQLの結果」しか画面に出さない。
-- RANKINGS_SCORE_BIGINT_AUDIT.sql は項目ごとに select を並べてあるため、
-- そのまま Run すると最後の A-6b しか見えない(2026-09-13・実際にそうなった)。
-- こちらは全部を1枚の表にまとめてあるので、貼って Run するだけで判断できる。
-- 控え(RLS・ポリシー・権限・索引・ビューの定義)が要るときは AUDIT のほうを使う。
select *
from (
  values
    (1, 'score の型',
        coalesce((select data_type from information_schema.columns
                   where table_schema = 'public' and table_name = 'rankings' and column_name = 'score'),
                 '(列がありません)')),
    (2, '記録の件数',
        (select count(*)::text from public.rankings)),
    (3, 'いまの最大スコア',
        (select coalesce(max(score), 0)::text from public.rankings)),
    (4, '21億を超えている記録',
        (select count(*)::text || ' 件' from public.rankings where score > 2147483647)),
    (5, 'score にぶら下がるビュー',
        -- 上に乗っているビューまでたどる(APPLYが落として作り直す顔ぶれと同じ)
        coalesce((select string_agg(name, ', ' order by name) from (
                    with recursive deps as (
                      select distinct dependent.oid as view_oid, 1 as depth
                      from pg_depend d
                      join pg_rewrite r on r.oid = d.objid
                      join pg_class dependent on dependent.oid = r.ev_class
                      join pg_class t on t.oid = d.refobjid
                      join pg_namespace n on n.oid = t.relnamespace
                      join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
                      where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
                        and dependent.relkind in ('v', 'm') and dependent.oid <> t.oid
                      union all
                      select distinct v2.oid, deps.depth + 1
                      from deps
                      join pg_depend d2 on d2.refobjid = deps.view_oid
                      join pg_rewrite r2 on r2.oid = d2.objid
                      join pg_class v2 on v2.oid = r2.ev_class
                      where v2.relkind in ('v', 'm') and v2.oid <> deps.view_oid and deps.depth < 20
                    )
                    select distinct c.relname ||
                           case c.relkind when 'v' then '' when 'm' then '(マテリアライズド)'
                                else '(' || c.relkind::text || ')' end as name
                    from (select distinct view_oid from deps) g
                    join pg_class c on c.oid = g.view_oid
                  ) v), 'なし')),
    (6, 'マテリアライズドビュー',
        case when exists (
               select 1
               from pg_depend d
               join pg_rewrite r on r.oid = d.objid
               join pg_class dependent on dependent.oid = r.ev_class
               join pg_class t on t.oid = d.refobjid
               join pg_namespace n on n.oid = t.relnamespace
               join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
               where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
                 and dependent.relkind = 'm')
             then 'あり(止めて共有してください)' else 'なし' end),
    (7, '→ どうするか',
        case
          when (select data_type from information_schema.columns
                 where table_schema = 'public' and table_name = 'rankings' and column_name = 'score') = 'bigint'
            then 'score はすでに bigint。ランキングへ載らない原因は別なので、ここで止めて共有してください'
          when exists (
                 select 1
                 from pg_depend d
                 join pg_rewrite r on r.oid = d.objid
                 join pg_class dependent on dependent.oid = r.ev_class
                 join pg_class t on t.oid = d.refobjid
                 join pg_namespace n on n.oid = t.relnamespace
                 join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
                 where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
                   and dependent.relkind = 'm')
            then 'マテリアライズドビューがあるので、ここで止めて共有してください'
          when (select data_type from information_schema.columns
                 where table_schema = 'public' and table_name = 'rankings' and column_name = 'score') in ('integer', 'smallint')
            then '原因はこれ。RANKINGS_SCORE_BIGINT_APPLY_TEST.sql へ進んでください'
          else '想定外の型です。止めて共有してください'
        end)
) as t(番号, 確認項目, 結果)
order by 番号;
