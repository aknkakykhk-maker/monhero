-- マスモンランキング(public.rhythm_buddy_ranks)へ、難易度 HELL の最高スコアの列 score_hell を足す(2026-10-12)。
-- 社長の決定「HELL もランキング(相棒を含む)に入れる」。流すのは HELL の公開(RELEASE_FLAGS.rhythmHell を真にする)より前。
-- 読み取り専用: いいえ。本番変更が残るか: はい(列・制約・索引を足すだけ)。
-- 既存の行・列は消さず・書き換えない(既存の行の score_hell は null)。rankings / bond_levels には触らない。
-- ゲームは公開の印が真になるまで score_hell を読み書きしないので、流すのが公開より前でも後でも、それまでの動きは変わらない。
-- ただし公開の日は、この SQL を流してから印を真にする(列が無いうちに送ると、相棒の行ごと断られる)。
begin;

create temporary table buddy_hell_counts_before on commit drop as
select (select count(*) from public.rhythm_buddy_ranks) as buddy_count,
       (select count(*) from public.rankings) as rankings_count;

alter table public.rhythm_buddy_ranks add column if not exists score_hell integer;

-- スコアの範囲の決まりに score_hell を足す(ほかの5列の範囲は今と同じ)
alter table public.rhythm_buddy_ranks drop constraint if exists rhythm_buddy_ranks_score_range;
alter table public.rhythm_buddy_ranks add constraint rhythm_buddy_ranks_score_range check (
  coalesce(score_easy, 0) between 0 and 10000000 and coalesce(score_normal, 0) between 0 and 10000000
  and coalesce(score_hard, 0) between 0 and 10000000 and coalesce(score_expert, 0) between 0 and 10000000
  and coalesce(score_master, 0) between 0 and 10000000 and coalesce(score_hell, 0) between 0 and 10000000);

create index if not exists rhythm_buddy_ranks_score_hell_idx on public.rhythm_buddy_ranks (score_hell desc nulls last);

-- 行の数が変わっていないことを確かめる。違えば止まる(commit されない)
do $$
declare b record;
begin
  select * into b from buddy_hell_counts_before;
  if (select count(*) from public.rhythm_buddy_ranks) <> b.buddy_count
     or (select count(*) from public.rankings) <> b.rankings_count then
    raise exception '行の数が変わりました。止めます';
  end if;
end $$;

commit;

-- 確かめ(読むだけ): score_hell の列があり、どの行も null のまま
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'rhythm_buddy_ranks' and column_name = 'score_hell';
select count(*) as rows_total, count(score_hell) as rows_with_hell from public.rhythm_buddy_ranks;
