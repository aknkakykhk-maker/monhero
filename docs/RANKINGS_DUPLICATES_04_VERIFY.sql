-- COMMIT後の読み取り専用検証。
with expected(user_name, difficulty, score) as (
  values
    ('セフィ'::text, 'Normal'::text, 265502::bigint),
    ('あつ'::text,   'Master'::text, 11495811::bigint),
    ('あつ'::text,   'Master'::text, 7023217::bigint)
)
select e.user_name, e.difficulty, e.score, count(r.id) as remaining_count,
       case when count(r.id) = 1 then '成功' else '中止: 1件ではありません' end as status
from expected e
left join public.rankings r
  on r.user_name = e.user_name and r.difficulty = e.difficulty and r.score = e.score
group by e.user_name, e.difficulty, e.score
order by e.user_name desc, e.score desc;

select count(*) as target_total,
       case when count(*) = 3 then '成功: 対象合計3件' else '中止: 対象合計が3件ではありません' end as status
from public.rankings
where (user_name, difficulty, score) in (
  ('セフィ', 'Normal', 265502),
  ('あつ', 'Master', 11495811),
  ('あつ', 'Master', 7023217)
);

-- current値がCHECKのtotal_rankings_beforeより27小さいことを手元のメモと照合する。
select count(*) as total_rankings_after,
       count(*) + 27 as expected_total_rankings_before,
       'CHECKのtotal_rankings_beforeとexpected_total_rankings_beforeが同じなら成功' as status
from public.rankings;

select count(*) as duplicate_clear_id_groups,
       case when count(*) = 0 then '成功: clear_id重複0件' else '中止: clear_id重複あり' end as status
from (
  select clear_id from public.rankings
  where clear_id is not null
  group by clear_id having count(*) > 1
) duplicates;

select count(*) as valid_unique_index_count,
       case when count(*) = 1 then '成功: rankings_clear_id_uniqueあり'
            else '中止: 有効なUNIQUE indexを確認できません' end as status
from pg_class table_class
join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
join pg_index index_state on index_state.indrelid = table_class.oid
join pg_class index_class on index_class.oid = index_state.indexrelid
where table_namespace.nspname = 'public'
  and table_class.relname = 'rankings'
  and index_class.relname = 'rankings_clear_id_unique'
  and index_state.indisunique and index_state.indisvalid and index_state.indisready
  and index_state.indpred is null and index_state.indexprs is null
  and index_state.indnkeyatts = 1
  and index_state.indkey::smallint[] = array[
    (select attnum from pg_attribute
     where attrelid = 'public.rankings'::regclass and attname = 'clear_id')
  ]::smallint[];

-- CHECKの同名2列と比較し、対象外が変わっていないことを確認する。
select count(*) filter (where user_name in ('セフィ', 'あつ')) as named_users_rows_after,
       count(*) filter (
         where user_name in ('セフィ', 'あつ')
           and (user_name, difficulty, score) not in (
             ('セフィ', 'Normal', 265502),
             ('あつ', 'Master', 11495811),
             ('あつ', 'Master', 7023217)
           )
       ) as named_users_non_target_rows_after,
       'CHECK比: 前者は27減、後者は同数なら対象外変更なし' as status
from public.rankings;
