-- 縮めたスコアを元に戻すSQL(SCORE_SHRINK_APPLY.sql をやり直したいとき・間違えたとき用)。2026-10-03。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。最後に commit する。
--
-- 控えの表 rankings_score_shrink_backup_20261003 の「縮める前の点数」を書き戻す。
-- ★戻すのは「縮めたまま変わっていない行」だけ(縮めた点数と今の点数が同じ行)。
--   縮めたあとに別の値へ変わった行があれば、触らずにその件数を表示して止まる。
-- ★戻したあとは、アプリを公開前の状態に戻すか、もう一度 APPLY を当てるまで、
--   新しいアプリ(小さい点数を送る)と混ざる。やり直す前に必ず共有すること。
begin;

lock table public.rankings in share row exclusive mode;

do $$
declare
  changed int;
begin
  if to_regclass('public.rankings_score_shrink_backup_20261003') is null then
    raise exception '控えの表がありません。APPLY を実適用していないか、すでに片付けています。';
  end if;
  select count(*) into changed
  from public.rankings r join public.rankings_score_shrink_backup_20261003 b on b.id = r.id
  where r.score <> greatest(1, b.score_before / 1000);
  if changed > 0 then
    raise exception '縮めたあとに点数が変わった行が % 件あります。戻さずに共有してください。', changed;
  end if;
end $$;

update public.rankings r
set score = b.score_before
from public.rankings_score_shrink_backup_20261003 b
where r.id = b.id;

select count(*) as restored_rows, max(score_before) as max_restored
from public.rankings_score_shrink_backup_20261003;

commit;
