-- Master「あつ」・Normal「セフィ」ランキング異常データの調査・削除手順。
-- Supabase SQL Editor など、public.rankings を更新できる管理者接続で実行する。
-- Data API の publishable key は管理者資格情報ではないため、この作業には使用しない。

-- ---------------------------------------------------------------------------
-- 1. 読み取り専用の事前調査（このブロックだけ先に実行する）
-- ---------------------------------------------------------------------------

-- SQL 権限の確認。DELETE が true でも RLS ポリシーで拒否される場合があるため、
-- 下の pg_policies も確認する。SQL Editor の管理者接続は通常 RLS を迂回できる。
select current_user,
       has_table_privilege(current_user, 'public.rankings', 'select') as can_select,
       has_table_privilege(current_user, 'public.rankings', 'delete') as can_delete;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'rankings'
  and cmd in ('ALL', 'DELETE')
order by policyname;

-- Master は依頼されたプレイヤー名と約1,100万点の範囲だけを候補にする。
select id, created_at, difficulty, user_name, score, level, hero, party, icon, clear_id
from public.rankings
where lower(difficulty) = 'master'
  and user_name = 'あつ'
  and score between 9000000 and 13000000
order by created_at, id;

-- Normal は依頼どおり「セフィ」の全レコードを候補にする。
select id, created_at, difficulty, user_name, score, level, hero, party, icon, clear_id
from public.rankings
where lower(difficulty) = 'normal'
  and user_name = 'セフィ'
order by score desc, created_at, id;

-- 削除前件数。master_count と normal_count を控え、次の設定値へ転記する。
select count(*) filter (
         where lower(difficulty) = 'master'
           and user_name = 'あつ'
           and score between 9000000 and 13000000
       ) as master_count,
       count(*) filter (
         where lower(difficulty) = 'normal'
           and user_name = 'セフィ'
       ) as normal_count
from public.rankings;

-- Normal の同一スコア重複を確認する。依頼内容では正常な1件も残さないため、
-- duplicate_count にかかわらず上の normal_count 全件が削除対象となる。
select score, count(*) as duplicate_count, array_agg(id order by id) as record_ids
from public.rankings
where lower(difficulty) = 'normal'
  and user_name = 'セフィ'
group by score
order by duplicate_count desc, score desc;

-- ---------------------------------------------------------------------------
-- 2. 削除（事前調査の結果を確認してから、このブロック全体を実行する）
-- ---------------------------------------------------------------------------
-- 安全のため既定では最後に ROLLBACK する。実削除時だけ末尾の ROLLBACK をコメント化し、
-- COMMIT のコメントを外す。expected_* を事前調査で確認した件数へ必ず置き換える。

begin;

create temporary table ranking_cleanup_expected (
  master_count bigint not null,
  normal_count bigint not null
) on commit drop;

-- 必ず実件数へ置換する。-1 のままでは削除前に停止する。
insert into ranking_cleanup_expected values (-1, -1);

-- 対象IDをトランザクション内で固定し、以降はこのIDだけを削除する。
create temporary table ranking_cleanup_targets on commit drop as
select id, difficulty, user_name, score
from public.rankings
where (lower(difficulty) = 'master'
       and user_name = 'あつ'
       and score between 9000000 and 13000000)
   or (lower(difficulty) = 'normal'
       and user_name = 'セフィ');

do $$
declare
  actual_master bigint;
  actual_normal bigint;
  expected_master bigint;
  expected_normal bigint;
begin
  select count(*) filter (where lower(difficulty) = 'master'),
         count(*) filter (where lower(difficulty) = 'normal')
    into actual_master, actual_normal
  from ranking_cleanup_targets;

  select master_count, normal_count
    into expected_master, expected_normal
  from ranking_cleanup_expected;

  if expected_master < 0 or expected_normal < 0 then
    raise exception 'expected_* が未設定です。事前調査の件数へ置き換えてください';
  end if;

  if actual_master <> expected_master or actual_normal <> expected_normal then
    raise exception '対象件数が変化しました (Master: %/%、Normal: %/%)',
      actual_master, expected_master, actual_normal, expected_normal;
  end if;
end $$;

-- DELETE ... RETURNING の結果も保存し、削除件数と内容を再確認できるようにする。
create temporary table ranking_cleanup_deleted on commit drop as
with deleted as (
  delete from public.rankings as rankings
  using ranking_cleanup_targets as targets
  where rankings.id = targets.id
  returning rankings.*
)
select * from deleted;

select id, created_at, difficulty, user_name, score
from ranking_cleanup_deleted
order by difficulty, created_at, id;

select count(*) filter (where lower(difficulty) = 'master') as deleted_master_count,
       count(*) filter (where lower(difficulty) = 'normal') as deleted_normal_count
from ranking_cleanup_deleted;

-- 対象が0件であり、対象外のランキングが残っていることをコミット前に確認する。
select count(*) filter (
         where lower(difficulty) = 'master'
           and user_name = 'あつ'
           and score between 9000000 and 13000000
       ) as remaining_master_count,
       count(*) filter (
         where lower(difficulty) = 'normal'
           and user_name = 'セフィ'
       ) as remaining_normal_count,
       count(*) filter (
         where not (
           (lower(difficulty) = 'master' and user_name = 'あつ'
            and score between 9000000 and 13000000)
           or (lower(difficulty) = 'normal' and user_name = 'セフィ')
         )
       ) as unaffected_record_count
from public.rankings;

-- COMMIT;
rollback;

-- ---------------------------------------------------------------------------
-- 3. コミット後の表示確認
-- ---------------------------------------------------------------------------
-- COMMIT 後、Data API と本番ゲームを再読込し、Master・Normal の上位20件を確認する。
-- SQL では各難易度の表示元データを次のクエリで確認できる。
select id, created_at, difficulty, user_name, score, level, hero, party, icon
from public.rankings
where lower(difficulty) = 'master'
order by score desc, created_at desc
limit 20;

select id, created_at, difficulty, user_name, score, level, hero, party, icon
from public.rankings
where lower(difficulty) = 'normal'
order by score desc, created_at desc
limit 20;
