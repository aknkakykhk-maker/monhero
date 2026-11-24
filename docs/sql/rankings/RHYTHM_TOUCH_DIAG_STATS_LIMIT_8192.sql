-- タッチの診断の行(public.rhythm_touch_diagnostics)の stats の大きさの上限を 4096 → 8192 バイトへ上げる(2026-11-24)。
--
-- 【なぜ】決まりは pg_column_size(stats) で、文字数ではなくデータベースの中の形(jsonb)の大きさ。数字の多い行は文字の約1.7倍になる。
--   11/17 に診断へ数を足したあと、iPhone の行の 96% が 4096 を超えて断られ、黙って消えていた(11/17〜11/23 の iPhone の診断の行が、ほぼ届いていない)。
--   送る側も直した(データベースの形で大きさを見積もって 7600 で守る・断られたら大きい物を外して送り直す)。
-- 【影響】決まりを1つ付け替えるだけ。行・列・ほかの表・権限には触らない。既存の行はすべて 4096 以下なので、そのまま通る。行は消えない。
-- 【適用】2026-11-24 に窓口が本番へ流した。もう一度流しても同じ結果になる。
begin;
alter table public.rhythm_touch_diagnostics drop constraint if exists rhythm_touch_diag_stats_check;
alter table public.rhythm_touch_diagnostics add constraint rhythm_touch_diag_stats_check
  check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) <= 8192);
commit;
