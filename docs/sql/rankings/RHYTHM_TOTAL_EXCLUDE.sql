-- 合算ランキングの集計から曲を外すSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- ★rankings の記録は1件も消さない。除外テーブルへ曲IDを足すだけで、
--   その曲が合算の集計から外れる。戻したくなったら、その行を消せば元どおり。
--
-- 使いどころ:
--   いま曲えらびに無い曲(曲IDを入れ替えた・公開をやめた)の記録が合算に残っていると、
--   いま始めた人は絶対に追いつけない(もう遊べない曲の点が、上位の人にだけ乗っているため)。
--   RHYTHM_TOTAL_SONGS.sql でどの曲かを確かめてから、ここへ書いて実行する。

begin;

-- ★★★ ここに除外したい曲IDを書く(複数行ぶん並べられる) ★★★
--
-- 2026-09-11の1件目:
--   monster_hero_theme_candidate … 体験版のいちばん最初に出していた「Monster Hero 候補」。
--   いまの monster_hero と同じ音源(monster_hero_theme)の、譜面だけが古いもの。
--   曲を monster_hero へ入れ替えたあとも記録(3件・1人)だけが残っていて、
--   合算だけが18曲になっていた。いま曲えらびには無いので、新しく始めた人は
--   この曲ぶんを取りようがない。記録は消さず、合算からだけ外す。
create temporary table rhythm_exclude_target on commit drop as
select unnest(array[
  'monster_hero_theme_candidate'
]::text[]) as song_id;

-- 書き間違いで存在しない曲IDを入れても気づけるよう、記録があるかを確かめる。
-- 1件も記録が無い曲IDは、たいてい打ち間違い。安全側で止める
do $$
declare
  unknown_ids text;
begin
  select string_agg(t.song_id, ', ' order by t.song_id) into unknown_ids
    from rhythm_exclude_target t
   where not exists (select 1 from public.rhythm_scores s where s.song_id = t.song_id);
  if unknown_ids is not null then
    raise exception '記録が1件も無い曲IDが含まれています(打ち間違い？): %', unknown_ids;
  end if;
end $$;

-- 外す前に、その曲がいまどれだけ載っているかを控える
create temporary table rhythm_exclude_before on commit drop as
select (select count(*) from public.rhythm_total_rankings) as breeders,
       (select coalesce(max(total_score), 0) from public.rhythm_total_rankings) as top_score,
       (select count(distinct b.song_id) from public.rhythm_song_bests b) as songs;

insert into public.rhythm_ranking_song_exclusions (song_id, reason)
select t.song_id, 'いま曲えらびに無い曲。記録は残したまま合算からだけ外す'
  from rhythm_exclude_target t
 on conflict (song_id) do nothing;

-- rankings には触っていないこと(行が1件も減っていないこと)
do $$
declare
  rhythm_rows int;
begin
  select count(*) into rhythm_rows from public.rankings where difficulty like 'Rhythm-%';
  if rhythm_rows = 0 then
    raise exception 'モンビーの記録が0件になっています。中止します';
  end if;
end $$;

-- 外したことで何が変わったかを1つの表にまとめて出す
with facts as (
  select 1 as sort, '外した曲' as item,
         (select string_agg(song_id, ', ' order by song_id) from rhythm_exclude_target) as value
  union all
  select 2, '外した曲の記録数(消えてはいない)',
         (select count(*)::text from public.rhythm_scores s
           where s.song_id in (select song_id from rhythm_exclude_target))
  union all
  select 3, '合算に入っている曲の数(前 → 後)',
         (select songs::text from rhythm_exclude_before) || ' → '
         || (select count(distinct b.song_id)::text from public.rhythm_song_bests b)
  union all
  select 4, '合算に載るブリーダー数(前 → 後)',
         (select breeders::text from rhythm_exclude_before) || ' → '
         || (select count(*)::text from public.rhythm_total_rankings)
  union all
  select 5, '1位の合計点(前 → 後)',
         (select top_score::text from rhythm_exclude_before) || ' → '
         || (select coalesce(max(total_score), 0)::text from public.rhythm_total_rankings)
  union all
  select 6, '上位3人(名前 / 合計点 / 曲数)',
         (select coalesce(string_agg(line, ' | '), 'なし') from (
            select user_name || ' / ' || total_score || ' / ' || song_count || '曲' as line
              from public.rhythm_total_rankings
             order by total_score desc, last_scored_at asc limit 3) t)
  union all
  select 7, 'モンビーの記録(消えていないこと)',
         (select count(*)::text from public.rankings where difficulty like 'Rhythm-%')
)
select item as "項目", value as "値" from facts order by sort;

commit;

-- 除外はビューの中で効くので、スキーマの読み込み直しは要らない。
-- 戻したくなったら次の1行(記録はそのまま残っている)。
--   delete from public.rhythm_ranking_song_exclusions where song_id = '曲ID';
