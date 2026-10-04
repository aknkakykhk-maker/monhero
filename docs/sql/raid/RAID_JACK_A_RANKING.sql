-- レイドバトル(A)の「累計ダメージ」ランキング用のビュー public.raid_jack_a_ranking を1つ足すSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- ビューを1つ作るだけ。表・列・既存のビュー・関数・RLS・ポリシー・権限には一切触らない
-- (raid_jack_hits などへの alter / drop / delete / update をしない)。
-- RAID_JACK_APPLY.sql を先に当てておくこと(raid_jack_hits が無いと止まる)。
--
-- なぜ作るのか(2026-10-04・ユーザー指示「大王を倒したあとは、レイドバトルの累計ダメージを競う」):
--   大王を倒したあとは段階の更新が無くなり、共有ライフは無限になる。そこからは
--   「5段階をまたいだ、レイドバトル(kind='a')の与ダメージの合計」で順位をつける。
--   グランドスラム(kind='b')のランキング(raid_jack_b_ranking)とは別で、そちらは変えない。
--   大王の報酬(大王への貢献ランキング=raid_jack_contributions)も変えない。
--
-- アプリ側はこのSQLを当てる前でも壊れない。ビューが無い間は「累計ダメージ」の一覧が「準備中」になるだけ。

begin;

do $$
begin
  if to_regclass('public.raid_jack_hits') is null then
    raise exception 'public.raid_jack_hits がありません。先に RAID_JACK_APPLY.sql を当ててください(このSQLは何も変えていません)';
  end if;
  if to_regclass('public.raid_jack_a_ranking') is not null then
    raise notice 'public.raid_jack_a_ranking は既にあります(同じ定義で作り直すだけです)';
  end if;
end $$;

-- A の累計ダメージ(全段階を合算。ランキングは共有)
create or replace view public.raid_jack_a_ranking as
  select event_id, breeder_id,
         sum(damage)::bigint as total_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   where kind = 'a'
   group by event_id, breeder_id;

grant select on public.raid_jack_a_ranking to anon, authenticated;

-- 形が思ったとおりかを確かめ、違えば取り消す
do $$
declare
  column_count integer;
  view_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'raid_jack_a_ranking';
  if column_count <> 4 then
    raise exception 'raid_jack_a_ranking の列が % 個です(4個のはず)。取り消しました', column_count;
  end if;
  select count(*) into view_count from information_schema.views
   where table_schema = 'public' and table_name in ('raid_jack_tier_totals','raid_jack_contributions','raid_jack_b_ranking','raid_jack_a_ranking');
  if view_count <> 4 then
    raise exception 'ジャックの集計ビューが % 個です(4個のはず)。取り消しました', view_count;
  end if;
end $$;

commit;

-- まとめ(Supabase の SQL Editor は最後の1文の結果だけを表示する)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_a_ranking') as "列の数(4)",
  (select count(*) from information_schema.views where table_schema = 'public' and table_name in ('raid_jack_tier_totals','raid_jack_contributions','raid_jack_b_ranking','raid_jack_a_ranking')) as "ビューの数(4)",
  (select count(*) from public.raid_jack_a_ranking) as "累計ダメージの人数";
