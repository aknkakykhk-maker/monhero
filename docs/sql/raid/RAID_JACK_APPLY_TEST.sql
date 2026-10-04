-- 【予行演習】RAID_JACK_APPLY.sql と同じ中身を、最後に rollback して何も残さずに試す。
-- (元の説明) イベント・レイドボス「ジャック」の与ダメージを貯める表 public.raid_jack_hits と、集計のビュー3つを新しく作るSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: いいえ(予行演習。末尾で rollback する)。
--
-- 新しい表を1つと、ビューを3つ作るだけ。既存の表・列・ビュー・関数・RLS・ポリシー・権限には一切触らない
-- (rankings などへの alter / drop / delete / update をしない)。
-- このファイルは RAID_JACK_APPLY.sql の予行演習。エラー無く通ったら本番の RAID_JACK_APPLY.sql を実行する。
--
-- なぜ作るのか(2026-10-04・ユーザー指示「イベント用のレイドボス」「ベースモンで協力して倒す」「マスモンでダメージを競う」):
--   ・A(ベースモン協力戦): 全員の与ダメージを合算して、段階ごとの共有HPから引く。
--   ・B(マスモン): 期間中の累計ダメージで競う。
--   「1戦の与ダメージ = 1行」を貯める。合計・順位はビューが数える(カウンタを +1 で書き換えないので、競合しない)。
--   ・hit_id(端末が作る一意のID)が主キー。同じ送信が2回届いても1行しか入らない(再送しても二重に数えない)。
--   ・誰でも追加と読み出しはできるが、書き換え・削除はできない(update / delete のポリシーを作らない)。
--   ・形の違う行は受け付けない(check 制約)。damage の上限(1億)は「あり得ない桁」を弾くためのもので、
--     ゲーム上の与ダメージの上限ではない(最大のライフ 35,000,000 より十分大きい)。
--
-- アプリ側はこのSQLを当てる前でも壊れない。表が無い間は送信が 404 になり、アプリはそのページを閉じるまで送らない
-- (36-raid-jack-api.jsx)。SQLの適用とアプリの公開フラグ(RAID_JACK_PUBLIC_RELEASE)は、
-- SQLを先に当ててから true にする。

begin;

-- 既に同じ名前の表があって形が違うときは、作り替えずに止まる
do $$
begin
  if to_regclass('public.raid_jack_hits') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'raid_jack_hits' and column_name = 'hit_id') then
      raise exception 'public.raid_jack_hits が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

create table if not exists public.raid_jack_hits (
  hit_id text primary key,
  created_at timestamptz not null default now(),
  event_id text not null default 'raid_jack_2026',
  kind text not null,
  tier smallint not null,
  breeder_id text not null,
  damage bigint not null,
  defeated boolean not null default false,
  app_build text not null default '',
  constraint raid_jack_hits_hit_id_check check (hit_id ~ '^[0-9A-Za-z_-]{8,64}$'),
  constraint raid_jack_hits_event_id_check check (char_length(event_id) between 1 and 40),
  constraint raid_jack_hits_kind_check check (kind in ('a', 'b')),
  constraint raid_jack_hits_tier_check check (tier between 1 and 5),
  constraint raid_jack_hits_breeder_id_check check (breeder_id ~ '^[0-9A-Za-z_-]{8,100}$'),
  constraint raid_jack_hits_damage_check check (damage between 0 and 100000000),
  constraint raid_jack_hits_app_build_check check (char_length(app_build) <= 32)
);

create index if not exists raid_jack_hits_tier_idx on public.raid_jack_hits (event_id, kind, tier);
create index if not exists raid_jack_hits_breeder_idx on public.raid_jack_hits (event_id, kind, breeder_id);

alter table public.raid_jack_hits enable row level security;

drop policy if exists raid_jack_hits_insert on public.raid_jack_hits;
create policy raid_jack_hits_insert on public.raid_jack_hits
  for insert to anon, authenticated with check (true);
drop policy if exists raid_jack_hits_select on public.raid_jack_hits;
create policy raid_jack_hits_select on public.raid_jack_hits
  for select to anon, authenticated using (true);

grant select, insert on public.raid_jack_hits to anon, authenticated;

-- 段階ごとの合計(共有HPを数える。A の共有HP = 段階のライフ - total_damage)
create or replace view public.raid_jack_tier_totals as
  select event_id, kind, tier,
         sum(damage)::bigint as total_damage,
         count(*)::bigint as hit_count,
         count(distinct breeder_id)::bigint as player_count,
         coalesce(bool_or(defeated), false) as any_defeated
    from public.raid_jack_hits
   group by event_id, kind, tier;

-- 人ごとの貢献(A: 段階ごとの貢献ランキング)
create or replace view public.raid_jack_contributions as
  select event_id, kind, tier, breeder_id,
         sum(damage)::bigint as total_damage,
         count(*)::bigint as hit_count,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   group by event_id, kind, tier, breeder_id;

-- B の累計ダメージ(5段階を合算。ランキングは共有)
create or replace view public.raid_jack_b_ranking as
  select event_id, breeder_id,
         sum(damage)::bigint as total_damage,
         max(created_at) as last_hit_at
    from public.raid_jack_hits
   where kind = 'b'
   group by event_id, breeder_id;

grant select on public.raid_jack_tier_totals, public.raid_jack_contributions, public.raid_jack_b_ranking to anon, authenticated;

-- 形が思ったとおりかを確かめ、違えば全部取り消す
do $$
declare
  column_count integer;
  policy_count integer;
  view_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'raid_jack_hits';
  if column_count <> 9 then
    raise exception 'raid_jack_hits の列が % 個です(9個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'raid_jack_hits' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'raid_jack_hits に書き換え・削除のポリシーがあります。取り消しました';
  end if;
  select count(*) into view_count from information_schema.views
   where table_schema = 'public' and table_name in ('raid_jack_tier_totals','raid_jack_contributions','raid_jack_b_ranking');
  if view_count <> 3 then
    raise exception 'ジャックの集計ビューが % 個です(3個のはず)。取り消しました', view_count;
  end if;
end $$;

-- まとめ(予行演習では rollback の前に出す。この表が出れば本番も通る)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'raid_jack_hits') as "列の数(9)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'raid_jack_hits') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'raid_jack_hits') as "ポリシー(insert/selectだけ)",
  (select count(*) from information_schema.views where table_schema = 'public' and table_name in ('raid_jack_tier_totals','raid_jack_contributions','raid_jack_b_ranking')) as "ビューの数(3)",
  (select count(*) from public.raid_jack_hits) as "記録の件数";

rollback;
