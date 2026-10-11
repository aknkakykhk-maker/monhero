-- モンヒロビートの6段目の難易度 HELL を、プレイ記録とタッチ診断の表で受け付ける(2026-10-10)。
-- 2026-10-10 に社長の OK をもらい、本番へ流し済み(migration 名 rhythm_add_hell_difficulty_check)。
-- 行の数は前後で同じ(rhythm_play_logs 610 / rhythm_touch_diagnostics 626)。既存の行は消さず・書き換えない。
-- ★表の名前は rhythm_touch_diagnostics(制約の名前だけが rhythm_touch_diag_… で始まる)。
-- 全国ランキング(rankings)は触らない。HELL はランキングへ送らない作り(data/rhythm-mode.js の rhythmRankingDifficultyKey)。
begin;
alter table public.rhythm_play_logs drop constraint if exists rhythm_play_logs_difficulty_check;
alter table public.rhythm_play_logs add constraint rhythm_play_logs_difficulty_check
  check (difficulty in ('EASY','NORMAL','HARD','EXPERT','MASTER','HELL'));
alter table public.rhythm_touch_diagnostics drop constraint if exists rhythm_touch_diag_difficulty_check;
alter table public.rhythm_touch_diagnostics add constraint rhythm_touch_diag_difficulty_check
  check (difficulty in ('EASY','NORMAL','HARD','EXPERT','MASTER','HELL'));
commit;
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conname in ('rhythm_play_logs_difficulty_check','rhythm_touch_diag_difficulty_check');
