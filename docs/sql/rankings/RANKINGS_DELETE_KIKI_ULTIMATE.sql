-- ブリーダー名「【★きき★】」の、極限チャレンジ ULTIMATE(difficulty='ExtremeULTIMATE')の
-- 記録のうち、スコアが一番高い1件だけを削除する。
--
-- 読み取り専用: A・Bのみ。Cは削除を行うトランザクション(既定はROLLBACK)。
-- 本番変更が残るか: Cの `commit;` の行を有効化して実行したときだけ。
--
-- 対象を「id」という一意な値で確定させてから消す(名前とスコアの一致だけで
-- 消すと、同名・同スコアの別の周回まで巻き込む恐れがあるため)。
-- 削除前にバックアップテーブルへ退避するので、誤りに気づいた場合は
-- Eの手順でその1行だけ復元できる。

-- ==========================================================================
-- A. 読み取り専用調査: 対象になりうる行をすべて見る
-- ==========================================================================
select id, created_at, user_name, difficulty, score, level, hero, clear_id, turns, reached_wave
from public.rankings
where user_name = '【★きき★】' and difficulty = 'ExtremeULTIMATE'
order by score desc, created_at nulls last, id;

-- A-2. このうち「スコアが一番高い1件」だけが削除対象になる。
-- id列の値を必ず控える(下のBの確認・Cの対象IDに使う)。
select id as target_id, score, created_at
from public.rankings
where user_name = '【★きき★】' and difficulty = 'ExtremeULTIMATE'
order by score desc, created_at nulls last, id
limit 1;

-- ==========================================================================
-- B. 削除候補の事前確認(読み取り専用)
-- ==========================================================================
-- Aで控えた target_id を下のCの `target_ranking_id` へ転記してから進める。
-- ここでは常に1件だけが対象であることを確かめる。
with target as (
  select id, score, created_at
  from public.rankings
  where user_name = '【★きき★】' and difficulty = 'ExtremeULTIMATE'
  order by score desc, created_at nulls last, id
  limit 1
)
select count(*) as matches_expected_one from target;

-- ==========================================================================
-- C. 削除(承認後のみ。既定は ROLLBACK)
-- ==========================================================================
begin;
lock table public.rankings in share row exclusive mode;

-- Aで控えたidへ書き換えてから実行する。書き換えないまま進めると0件になり、
-- 下のDOブロックで安全に停止する(何も削除されない)。
create temporary table ranking_kiki_target (target_ranking_id bigint not null) on commit drop;
insert into ranking_kiki_target values (-1); -- ← ここをAで控えたidへ書き換える

create temporary table ranking_kiki_row on commit drop as
select r.*
from public.rankings r
join ranking_kiki_target t on r.id = t.target_ranking_id
where r.user_name = '【★きき★】' and r.difficulty = 'ExtremeULTIMATE';

do $$
declare row_count bigint;
begin
  select count(*) into row_count from ranking_kiki_row;
  if row_count <> 1 then
    raise exception '対象が1件ではありません(%件)。target_ranking_id を確認してください', row_count;
  end if;
end $$;

-- 復旧用の永続バックアップ。誤削除に気づいたときEの手順で戻せる。
create table if not exists public.rankings_manual_delete_backup (
  deleted_at timestamptz not null default now(),
  reason text not null,
  ranking_id text not null,
  row_data jsonb not null,
  primary key (ranking_id, deleted_at)
);

insert into public.rankings_manual_delete_backup (reason, ranking_id, row_data)
select 'delete kiki ExtremeULTIMATE highest score (user request)', id::text, to_jsonb(t)
from ranking_kiki_row t;

delete from public.rankings r
using ranking_kiki_row t
where r.id = t.id
returning r.*;

-- 削除対象が残っていないこと、バックアップが1件増えたことを確認する。
select
  (select count(*) from public.rankings r join ranking_kiki_row t on r.id = t.id) as remaining_should_be_zero,
  (select count(*) from public.rankings_manual_delete_backup
   where reason = 'delete kiki ExtremeULTIMATE highest score (user request)') as backup_count_should_be_one;

-- 上の結果で remaining_should_be_zero = 0、backup_count_should_be_one = 1 を確認してから
-- 次の行の -- を外して commit; だけを有効にする(rollback; は削除する)。
-- commit;
rollback;

-- ==========================================================================
-- D. 実行後確認(読み取り専用)
-- ==========================================================================
-- commit後に実行する。Aの結果から対象の1行が消えていることを確認する。
-- select id, created_at, user_name, difficulty, score
-- from public.rankings
-- where user_name = '【★きき★】' and difficulty = 'ExtremeULTIMATE'
-- order by score desc, created_at nulls last, id;

-- ==========================================================================
-- E. 誤削除時の復旧(自動実行禁止)
-- ==========================================================================
-- 1) 対象行を確認する。
-- select * from public.rankings_manual_delete_backup
-- where reason = 'delete kiki ExtremeULTIMATE highest score (user request)';
-- 2) 次のSQLをトランザクション内で実行し、件数確認後だけCOMMITする。
-- begin;
-- insert into public.rankings
-- select restored.*
-- from public.rankings_manual_delete_backup backup
-- cross join lateral jsonb_populate_record(null::public.rankings, backup.row_data) restored
-- where backup.reason = 'delete kiki ExtremeULTIMATE highest score (user request)'
-- on conflict (id) do nothing;
-- select count(*) from public.rankings
-- where user_name = '【★きき★】' and difficulty = 'ExtremeULTIMATE';
-- -- commit;
-- rollback;
