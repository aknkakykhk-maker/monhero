-- public.rankings の既存重複を、削除前の調査から復旧まで安全に扱う手順。
-- clear_id マイグレーションとは独立して実行する。既定では一切 DELETE しない。
-- Supabase SQL Editor の管理者接続で、セクションごとに実行する。

-- ==========================================================================
-- A. 読み取り専用調査
-- ==========================================================================

-- A-1. 総件数、clear_id の有無、難易度別件数。
select count(*) as total_count,
       count(*) filter (where clear_id is null) as legacy_without_clear_id,
       count(*) filter (where clear_id is not null) as with_clear_id
from public.rankings;

select difficulty, count(*) as row_count,
       count(*) filter (where clear_id is null) as legacy_without_clear_id
from public.rankings
group by difficulty
order by difficulty;

-- A-2. 同一 clear_id は新方式で確実に重複と判断できる。1行でも返れば削除せず停止する。
select clear_id, count(*) as row_count,
       array_agg(id order by created_at nulls last, id) as ids,
       min(created_at) as first_created_at, max(created_at) as last_created_at
from public.rankings
where clear_id is not null
group by clear_id
having count(*) > 1
order by row_count desc, clear_id;

-- A-3. 旧データの「同じプレイヤー・難易度・スコア」候補。
-- 同点の正当な別周回も含むため、この結果だけを根拠に削除してはいけない。
select user_name, difficulty, score, count(*) as row_count,
       min(created_at) as first_created_at, max(created_at) as last_created_at,
       array_agg(id order by created_at nulls last, id) as ids
from public.rankings
where clear_id is null
group by user_name, difficulty, score
having count(*) > 1
order by row_count desc, difficulty, user_name, score desc;

-- A-4. 候補の全項目。CSVで必ず保存し、party等も含めて目視確認する。
with candidate_groups as (
  select user_name, difficulty, score
  from public.rankings
  where clear_id is null
  group by user_name, difficulty, score
  having count(*) > 1
)
select r.*
from public.rankings r
join candidate_groups g using (user_name, difficulty, score)
order by r.difficulty, r.user_name, r.score desc, r.created_at nulls last, r.id;

-- ==========================================================================
-- B. 削除候補の事前確認（読み取り専用）
-- ==========================================================================
-- id を比較可能な文字列として扱い、各グループの最古の1件を残す。
-- level / hero / party / icon まで同じ旧データだけを候補にする。ただし、これでも正当な
-- 別周回の可能性は消えないため、CSVと発生時刻を確認し、所有者の承認後に限りCへ進む。
with ranked as (
  select r.*,
         row_number() over (
           partition by user_name, difficulty, score, level, hero,
                        coalesce(party::text, ''), coalesce(icon::text, '')
           order by created_at nulls last, id
         ) as duplicate_number,
         first_value(id) over (
           partition by user_name, difficulty, score, level, hero,
                        coalesce(party::text, ''), coalesce(icon::text, '')
           order by created_at nulls last, id
         ) as retained_id
  from public.rankings r
  where clear_id is null
)
select id as delete_candidate_id, retained_id, created_at, difficulty, user_name,
       score, level, hero, party, icon, clear_id
from ranked
where duplicate_number > 1
order by difficulty, user_name, score desc, created_at nulls last, id;

-- 上の削除候補件数（この値をCの expected_count に転記する）。
with ranked as (
  select row_number() over (
    partition by user_name, difficulty, score, level, hero,
                 coalesce(party::text, ''), coalesce(icon::text, '')
    order by created_at nulls last, id
  ) as duplicate_number
  from public.rankings
  where clear_id is null
)
select count(*) as delete_candidate_count
from ranked
where duplicate_number > 1;

-- ==========================================================================
-- C. 安全な整理（承認後のみ。既定は ROLLBACK）
-- ==========================================================================
begin;
lock table public.rankings in share row exclusive mode;

create temporary table ranking_duplicate_targets on commit drop as
with ranked as (
  select r.*,
         row_number() over (
           partition by user_name, difficulty, score, level, hero,
                        coalesce(party::text, ''), coalesce(icon::text, '')
           order by created_at nulls last, id
         ) as duplicate_number
  from public.rankings r
  where clear_id is null
)
select * from ranked where duplicate_number > 1;

-- -1 をBで確認し承認された件数へ置換しない限り、DELETE前に停止する。
create temporary table ranking_duplicate_expected (expected_count bigint not null) on commit drop;
insert into ranking_duplicate_expected values (-1);

do $$
declare actual_count bigint; expected_count bigint;
begin
  select count(*) into actual_count from ranking_duplicate_targets;
  select e.expected_count into expected_count from ranking_duplicate_expected e;
  if expected_count < 0 then
    raise exception 'expected_count が未設定です。承認された件数へ置き換えてください';
  end if;
  if actual_count <> expected_count then
    raise exception '削除候補件数が変化しました（現在 %、承認済み %）', actual_count, expected_count;
  end if;
end $$;

-- 復旧用の永続バックアップ。初回だけ作成し、対象行をJSONBで退避する。
-- cleanup_id は実行単位なので、結果を必ず控える。
create table if not exists public.rankings_duplicate_cleanup_backup (
  cleanup_id uuid not null,
  backed_up_at timestamptz not null default now(),
  ranking_id text not null,
  row_data jsonb not null,
  primary key (cleanup_id, ranking_id)
);

create temporary table ranking_cleanup_run on commit drop as
select gen_random_uuid() as cleanup_id;

insert into public.rankings_duplicate_cleanup_backup (cleanup_id, ranking_id, row_data)
select run.cleanup_id, targets.id::text, to_jsonb(targets) - 'duplicate_number'
from ranking_duplicate_targets targets cross join ranking_cleanup_run run;

select run.cleanup_id, count(backup.*) as backed_up_count
from ranking_cleanup_run run
left join public.rankings_duplicate_cleanup_backup backup using (cleanup_id)
group by run.cleanup_id;

delete from public.rankings rankings
using ranking_duplicate_targets targets
where rankings.id = targets.id
returning rankings.*;

-- 削除対象が残らず、バックアップ件数が一致することをCOMMIT前に確認する。
select (select count(*) from ranking_duplicate_targets) as target_count,
       (select count(*) from public.rankings_duplicate_cleanup_backup b
        cross join ranking_cleanup_run run where b.cleanup_id = run.cleanup_id) as backup_count,
       (select count(*) from public.rankings r
        join ranking_duplicate_targets t on r.id = t.id) as remaining_target_count;

-- 初回は必ずROLLBACK。結果確認と明示承認後だけCOMMITを有効化する。
-- commit;
rollback;

-- ==========================================================================
-- D. 実行後確認（読み取り専用）
-- ==========================================================================
-- A-1〜A-4とBを再実行する。さらに、使用したcleanup_idを指定して退避件数を確認する。
-- select cleanup_id, backed_up_at, ranking_id, row_data
-- from public.rankings_duplicate_cleanup_backup
-- where cleanup_id = 'Cで控えたUUID'::uuid
-- order by ranking_id;

-- ==========================================================================
-- E. 誤削除時の復旧（自動実行禁止）
-- ==========================================================================
-- 1) 対象cleanup_idのrow_dataをCSV/JSONで保存する。
-- 2) public.rankingsの現在の列と型がバックアップ時から変わっていないことを確認する。
-- 3) 次のSQLをトランザクション内で実行し、件数確認後だけCOMMITする。
-- begin;
-- insert into public.rankings
-- select restored.*
-- from public.rankings_duplicate_cleanup_backup backup
-- cross join lateral jsonb_populate_record(null::public.rankings, backup.row_data) restored
-- where backup.cleanup_id = '復旧するUUID'::uuid
-- on conflict (id) do nothing;
-- select count(*) from public.rankings_duplicate_cleanup_backup
-- where cleanup_id = '復旧するUUID'::uuid;
-- -- commit;
-- rollback;
