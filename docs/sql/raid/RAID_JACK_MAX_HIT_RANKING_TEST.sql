-- レイドボス「ジャック」の「1戦あたりの最大ダメージ」ランキング用のビュー public.raid_jack_max_hit_ranking を1つ足すSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: いいえ(予行演習。最後に rollback するので何も残らない)。
--
-- ビューを1つ作るだけ。表・列・既存のビュー・関数・RLS・ポリシー・権限には一切触らない
-- (raid_jack_hits などへの alter / drop / delete / update をしない)。
-- RAID_JACK_APPLY.sql を先に当てておくこと(raid_jack_hits が無いと止まる)。
--
-- なぜ作るのか(2026-10-05・ユーザー指示「1ラン辺りの最大累計ダメージランキングも作れない？」):
--   raid_jack_hits は「1戦の与ダメージ = 1行」なので、人ごとに max(damage) を取れば
--   「1戦で出したいちばん大きいダメージ」の順位になる。A(kind='a')・B(kind='b')を1つのビューで持つ。
--   順位報酬は付けない(記録を見て楽しむだけ)。既存のランキング・報酬の判定には影響しない。
--
-- アプリ側はこのSQLを当てる前でも壊れない。ビューが無い間は「1戦の最大ダメージ」の一覧が「準備中」になるだけ。

begin;

do $$
begin
  if to_regclass('public.raid_jack_hits') is null then
    raise exception 'public.raid_jack_hits がありません。先に RAID_JACK_APPLY.sql を当ててください(このSQLは何も変えていません)';
  end if;
end $$;

create or replace view public.raid_jack_max_hit_ranking as
  select event_id, kind, breeder_id,
         max(damage)::bigint as max_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   group by event_id, kind, breeder_id;

grant select on public.raid_jack_max_hit_ranking to anon, authenticated;

do $$
declare
  column_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'raid_jack_max_hit_ranking';
  if column_count <> 5 then
    raise exception 'raid_jack_max_hit_ranking の列が % 個です(5個のはず)。取り消しました', column_count;
  end if;
end $$;

rollback;

-- まとめ(Supabase の SQL Editor は最後の1文の結果だけを表示する)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_max_hit_ranking') as "列の数(5)",
  (select count(*) from public.raid_jack_max_hit_ranking where kind = 'a') as "A(レイドバトル)の人数",
  (select count(*) from public.raid_jack_max_hit_ranking where kind = 'b') as "B(グランドスラム)の人数";
