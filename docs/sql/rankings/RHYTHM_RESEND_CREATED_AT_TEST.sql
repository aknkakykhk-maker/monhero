-- 【予行演習】送り直した記録に「遊んだ時刻」を入れられるか確かめる。
-- 読み取り専用: いいえ(1行だけ入れて試す)。
-- 本番変更が残るか: いいえ。末尾が rollback; なので、何も残らずに元へ戻る。
--
-- 2026-09-14・ユーザー指摘「この時間は開いた時間なんだけどそれがスコアとして
-- 何かしらの方法でカウントされてる？」への調査でわかったこと。
--
--   端末が送れなかった記録を貯めておき、次にアプリを開いたときへ送り直す仕組み
--   (2026-09-13に追加)が、created_at を付けずに送っていた。
--   rankings.created_at の既定値は now() なので、**送り直した瞬間**が記録の時刻になる。
--   週間ランキング(月曜5:00区切り)は created_at で期間を数えているため、
--   先週以前の記録を送り直すと、遊んでいない今週の合計へ足されてしまう。
--   実際に 9/14(月) 6:22 にアプリを開いただけで、4曲ぶんが今週の週間へ載った。
--
-- アプリ側は「送り直すときだけ created_at を明示して送る」ように直した。
-- ここで確かめるのは、**その形をDBが受け取れるか**の1点だけ。
--   ・ゲームからの書き込みは anon(公開キー)で行われる
--   ・anon に列単位のGRANT制限がかかっていると created_at を指定できず、400/403になる
--
-- ★テーブル・ビュー・関数は一切変えない(ALTER・DROP・CREATE をしない)。
-- ★入れた行は rollback で消える。本番のランキングには何も残らない。

begin;

-- 実際のゲームと同じ立場(anon)になって試す
set local role anon;

-- 先週の時刻を明示して、1行だけ入れてみる。
-- clear_id は絶対にぶつからない名前にしておく(どのみち rollback で消える)。
insert into public.rankings (difficulty, user_name, hero, party, score, clear_id, created_at)
values ('Rhythm-__probe__-easy', '__probe__', '__probe__', '[]'::jsonb, 1,
        'probe_created_at_' || gen_random_uuid()::text,
        (now() at time zone 'utc') - interval '7 days');

reset role;

-- 結果を1枚の表にまとめて出す(SQL Editor は最後の1つしか表示しないため)
with probe as (
  select created_at
    from public.rankings
   where user_name = '__probe__'
   order by created_at desc
   limit 1
)
select '① anon で created_at を指定して入れられたか' as 項目,
       case when exists (select 1 from probe) then 'はい(OK)' else 'いいえ(NG)' end as 値
union all
select '② 入った行の created_at(JST)',
       coalesce((select to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') from probe), '(なし)')
union all
select '③ 7日前のままか(now()に上書きされていないか)',
       case when (select created_at from probe) < now() - interval '6 days'
            then 'はい(OK)' else 'いいえ(NG。既定値で上書きされている)' end
union all
select '④ この予行演習で残るもの', 'なし(このあと rollback します)';

rollback;
