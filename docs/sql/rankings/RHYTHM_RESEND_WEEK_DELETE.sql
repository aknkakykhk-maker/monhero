-- 【本番変更・取り消せません】送り直しで今週へ混ざった記録を消す。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい(commit します)。
--
-- ★流す前に、必ず RHYTHM_RESEND_WEEK_AUDIT.sql で clear_id を確かめること。
-- ★下の clear_id は**空のまま**にしてある。消したい行の clear_id を書き入れてから流す。
--   空のまま流すと 0件 と出て何も起きない(安全側)。
-- ★消えた記録は戻せない。曲別ランキングにも載らなくなる。
--
-- 2026-09-14。原因はアプリ側で直した(送り直すときは遊んだ時刻を付けて送る)ので、
-- 今後この操作が要ることはない。

begin;

-- ここに、消したい行の clear_id を並べる。例:
--   ('11111111-2222-3333-4444-555555555555'),
--   ('66666666-7777-8888-9999-000000000000')
create temporary table _to_delete (clear_id text) on commit drop;
insert into _to_delete (clear_id) values
  (null)  -- ← この行は残したまま、下へ clear_id を足していく(null は当たらない)
;

-- 消す前に、何件当たるかを見る
select '消す対象の件数' as 項目,
       (select count(*)::text from public.rankings r
         where r.clear_id in (select clear_id from _to_delete where clear_id is not null)) as 値;

delete from public.rankings r
 where r.clear_id in (select clear_id from _to_delete where clear_id is not null);

-- 消したあとの今週の件数
select '消したあとの今週のモンビーの件数' as 項目,
       (select count(*)::text
          from public.rankings r, public.rhythm_week_window w
         where r.difficulty like 'Rhythm-%'
           and r.created_at >= w.week_start and r.created_at < w.week_end) as 値;

commit;
