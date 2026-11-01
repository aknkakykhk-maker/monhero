-- public.rankings へ played_turns の1列を追加するSQL(2026-11-01 社長「負けたときもターン数を記録して」)。
-- 読み取り専用: いいえ(列を1つ足すだけ)。
--
-- turns は「クリアしたときの累計ターン数」で、最速クリアの表示・並びに使っているので意味を変えない。
-- played_turns は「その回で遊んだ累計ターン数」で、クリアでも負け・リタイアでも入る。
-- 既存の行・列・RLS・ポリシー・権限は変更しない(DROP・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列1つだけなので、既存の記録はすべてNULLのまま残る。
-- ゲーム側は、列が無い間は played_turns を外して送るので、SQLとゲームの公開はどちらが先でも記録は落ちない。

begin;

alter table public.rankings add column if not exists played_turns integer;

comment on column public.rankings.played_turns is
  'その周回で遊んだ累計ターン数(クリア・負け・リタイアのどれでも入る)。列を足す前の記録はNULL。';

-- 明らかにありえない値を弾く(turns と同じ幅)。既存行はすべてNULLなので引っかかる行は無い
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'rankings'
                   and c.conname = 'rankings_played_turns_range') then
    alter table public.rankings add constraint rankings_played_turns_range
      check (played_turns is null or (played_turns > 0 and played_turns <= 1000));
  end if;
end $$;

commit;

-- 確かめ(読むだけ): 列があり、まだ値の入った行が無いこと
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings' and column_name = 'played_turns';
select count(*) filter (where played_turns is not null) as filled_rows, count(*) as all_rows
from public.rankings;
