-- MASTER_ATSU_DUPLICATES_COMMIT.sql 実行後の読み取り専用検証。
with expected(user_name, difficulty, score) as (
  values
    ('あつ'::text, 'Master'::text, 11495811::bigint),
    ('あつ'::text, 'Master'::text, 7023217::bigint)
)
select e.user_name, e.difficulty, e.score,
       count(r.id) as remaining_count,
       case when count(r.id) = 1 then '成功'
            else '中止: 1件ではありません' end as status
from expected e
left join public.rankings r
  on r.user_name = e.user_name
 and r.difficulty = e.difficulty
 and r.score = e.score
group by e.user_name, e.difficulty, e.score
order by e.score desc;

select count(*) as target_total,
       case when count(*) = 2 then '成功: 対象合計2件'
            else '中止: 対象合計が2件ではありません' end as status
from public.rankings
where user_name = 'あつ'
  and difficulty = 'Master'
  and score in (11495811, 7023217);

select count(*) as duplicate_clear_id_groups,
       case when count(*) = 0 then '成功: clear_id重複0件'
            else '中止: clear_id重複あり' end as status
from (
  select clear_id
  from public.rankings
  where clear_id is not null
  group by clear_id
  having count(*) > 1
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
  and index_state.indisunique
  and index_state.indisvalid
  and index_state.indisready
  and index_state.indpred is null
  and index_state.indexprs is null
  and index_state.indnkeyatts = 1
  and index_state.indkey::smallint[] = array[
    (select attnum
       from pg_attribute
      where attrelid = 'public.rankings'::regclass
        and attname = 'clear_id')
  ]::smallint[];
