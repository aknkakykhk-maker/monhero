-- 合算ランキングに入っている曲を、曲ごとに並べて見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- 使いどころ:
--   RHYTHM_TOTAL_VERIFY.sql の「曲の数(記録がある曲)」が、いま遊べる公開曲の数と
--   合わないときに、どの曲が余分なのかを突き止める。
--   曲IDを入れ替えたり、公開をやめたりすると、その曲の記録だけが残ったままになる。
--   合算にそれが入っていると、いま始めた人は絶対に追いつけない
--   (もう遊べない曲の点が、上位の人にだけ乗っているため)。
--
-- 見かた:
--   「除外中」が false の曲だけが合算に入っている。
--   いま曲えらびに無い曲がここに並んでいたら、その song_id を
--   RHYTHM_TOTAL_EXCLUDE.sql で除外テーブルへ入れる(記録そのものは消さない)。

select s.song_id                                   as "曲ID",
       count(*)                                    as "記録数",
       count(distinct s.identity_key)              as "人数",
       max(s.score)                                as "最高スコア",
       to_char(min(s.created_at), 'YYYY-MM-DD')    as "最初の記録",
       to_char(max(s.created_at), 'YYYY-MM-DD')    as "最後の記録",
       exists (select 1 from public.rhythm_ranking_song_exclusions x
                where x.song_id = s.song_id)       as "除外中"
  from public.rhythm_identified_scores s
 group by s.song_id
 order by max(s.created_at) desc, s.song_id;
