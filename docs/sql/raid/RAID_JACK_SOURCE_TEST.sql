-- (試験用: 最後に rollback するので何も残らない)
-- レイドボス「ジャック」の与ダメージを「バトル」と「モンヒロビート」に分けて数えるSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- やること: raid_jack_hits へ列 source を1つ足し、集計のビューを2つ(raid_jack_source_ranking / raid_jack_source_by_tier)作る。
-- 既存の行・列・ビュー・関数・ポリシー・権限は消さない・書き換えない(足すだけ)。
-- RAID_JACK_APPLY.sql を先に当てておくこと。
--
-- source は 'battle'(バトルで与えたダメージ)か 'rhythm'(モンヒロビートで与えたダメージ)。
-- 既に入っている行は、列の既定値で 'battle' になる(これまでに送られたモンヒロビートのダメージは区別できず、バトル扱いのまま残る)。
-- アプリ側は、このSQLを当てる前でも壊れない(列が無いと分かったら列を付けずに送り、ランキングは「準備中」になる)。
--
-- 仕様の正本: docs/spec/RAID_JACK_RANKING_SOURCE.md

begin;

do $$
begin
  if to_regclass('public.raid_jack_hits') is null then
    raise exception 'public.raid_jack_hits がありません。先に RAID_JACK_APPLY.sql を当ててください(このSQLは何も変えていません)';
  end if;
end $$;

alter table public.raid_jack_hits add column if not exists source text not null default 'battle';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'raid_jack_hits_source_check') then
    alter table public.raid_jack_hits add constraint raid_jack_hits_source_check check (source in ('battle', 'rhythm'));
  end if;
end $$;

create or replace view public.raid_jack_source_ranking as
  select event_id, kind, source, breeder_id,
         sum(damage)::bigint as total_damage,
         max(damage)::bigint as max_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   group by event_id, kind, source, breeder_id;

create or replace view public.raid_jack_source_by_tier as
  select event_id, kind, tier, source, breeder_id,
         sum(damage)::bigint as total_damage,
         max(damage)::bigint as max_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   group by event_id, kind, tier, source, breeder_id;

grant select on public.raid_jack_source_ranking to anon, authenticated;
grant select on public.raid_jack_source_by_tier to anon, authenticated;

do $$
declare
  c1 integer;
  c2 integer;
begin
  select count(*) into c1 from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_source_ranking';
  select count(*) into c2 from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_source_by_tier';
  if c1 <> 7 or c2 <> 8 then
    raise exception 'ビューの列の数が合いません(% / %)。取り消しました', c1, c2;
  end if;
end $$;

rollback;

-- まとめ(Supabase の SQL Editor は最後の1文の結果だけを表示する)
select
  (select count(*) from public.raid_jack_hits) as "行の数(変わらないはず)",
  (select count(*) from public.raid_jack_hits where source = 'battle') as "battle",
  (select count(*) from public.raid_jack_hits where source = 'rhythm') as "rhythm(いまは0)";
