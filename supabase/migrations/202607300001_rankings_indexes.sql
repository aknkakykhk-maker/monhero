-- ランキング取得を速くするための索引を追加する。
--
-- 背景: rankings は difficulty で絞って score / level / id の順に並べて取得しているが、
-- これらの索引が無いため、取得のたびにテーブル全体を読み込んで並べ替えていた。
-- 記録が増えるほど遅くなり、実機では8秒でも返らず「読み込みが終わらない」「一度出た
-- ランキングが消える」状態になっていた。
--
-- このマイグレーションは索引を足すだけで、行の削除・更新・列の変更は一切行わない。
-- 何度実行しても同じ結果になる(すべて if not exists)。

-- スコアランキング: difficulty で絞って score の降順。NULLは末尾へ送っているので、
-- 並び順の指定まで含めて索引と一致させる。
create index if not exists rankings_difficulty_score_desc_idx
  on public.rankings (difficulty, score desc nulls last);

-- スコア順が使えないときの代替(取得順=id の降順)と、絆Lv用の「新しい記録から」。
create index if not exists rankings_difficulty_id_desc_idx
  on public.rankings (difficulty, id desc);

-- ブリーダーLvランキング: 難易度で絞らず level の降順。
create index if not exists rankings_level_desc_idx
  on public.rankings (level desc nulls last);

-- 追加した索引が実際に有効になっているか確認する。作成に失敗していた場合は例外で止める。
do $$
declare
  missing text;
begin
  select string_agg(name, ', ')
    into missing
    from unnest(array[
      'rankings_difficulty_score_desc_idx',
      'rankings_difficulty_id_desc_idx',
      'rankings_level_desc_idx'
    ]) as name
   where not exists (
     select 1
       from pg_class index_class
       join pg_index index_state on index_state.indexrelid = index_class.oid
       join pg_class table_class on table_class.oid = index_state.indrelid
       join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
      where table_namespace.nspname = 'public'
        and table_class.relname = 'rankings'
        and index_class.relname = name
        and index_state.indisvalid
        and index_state.indisready
   );

  if missing is not null then
    raise exception 'ranking indexes are missing or invalid: %', missing;
  end if;
end $$;
