-- レイドボス「ジャック」の「1戦あたりの最大ダメージ」を難易度別に見るためのビュー public.raid_jack_max_hit_by_tier を1つ足すSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- ビューを1つ作るだけ。表・列・既存のビュー(raid_jack_max_hit_ranking を含む)・関数・RLS・ポリシー・権限には一切触らない。
-- RAID_JACK_APPLY.sql を先に当てておくこと(raid_jack_hits が無いと止まる)。
--
-- なぜ作るのか(2026-10-05・ユーザー指示「1戦の最高ダメージは難易度別にわけれない？」):
--   raid_jack_hits には段階(tier 1〜5)の列がある。A は男爵〜大王、B は初級〜極級。
--   人ごと・段階ごとに max(damage) を取れば、難易度別の「1戦の最大ダメージ」の順位になる。
--   全難易度でいちばん大きい1戦は、いままでの raid_jack_max_hit_ranking が引き続き担う。
--   順位報酬は付けない。
--
-- アプリ側はこのSQLを当てる前でも壊れない。ビューが無い間は、難易度を選んだ一覧が「準備中」になるだけ。

begin;

do $$
begin
  if to_regclass('public.raid_jack_hits') is null then
    raise exception 'public.raid_jack_hits がありません。先に RAID_JACK_APPLY.sql を当ててください(このSQLは何も変えていません)';
  end if;
end $$;

create or replace view public.raid_jack_max_hit_by_tier as
  select event_id, kind, tier, breeder_id,
         max(damage)::bigint as max_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   group by event_id, kind, tier, breeder_id;

grant select on public.raid_jack_max_hit_by_tier to anon, authenticated;

do $$
declare
  column_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'raid_jack_max_hit_by_tier';
  if column_count <> 6 then
    raise exception 'raid_jack_max_hit_by_tier の列が % 個です(6個のはず)。取り消しました', column_count;
  end if;
end $$;

commit;

-- まとめ(Supabase の SQL Editor は最後の1文の結果だけを表示する)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_max_hit_by_tier') as "列の数(6)",
  (select count(*) from public.raid_jack_max_hit_by_tier where kind = 'a') as "A(段階ごとの人数の合計)",
  (select count(*) from public.raid_jack_max_hit_by_tier where kind = 'b') as "B(難易度ごとの人数の合計)";
