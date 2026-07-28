-- 同一クリアの再送を安全に無視するための冪等性キー。
-- 既存行はNULLのまま保持するため、このマイグレーションはデータを削除・変更しない。
alter table public.rankings
  add column if not exists clear_id text;

-- 通常は新しいクライアントが発行したIDだけが入るため重複しない。ただし、このDDLより先に
-- clear_id列だけを追加した環境で重複が生じていた場合は、既存行を勝手に削除せず停止する。
do $$
begin
  if exists (
    select 1
    from public.rankings
    where clear_id is not null
    group by clear_id
    having count(*) > 1
  ) then
    raise exception 'rankings.clear_id has duplicate values; existing rows were not changed';
  end if;
end $$;

create unique index if not exists rankings_clear_id_unique
  on public.rankings (clear_id);

-- IF NOT EXISTSは同名の誤ったindexでも成功扱いになるため、実際にclear_id単独の有効な
-- UNIQUE indexになっているか検証する。不一致時は例外によりマイグレーション全体を戻す。
do $$
begin
  if not exists (
    select 1
    from pg_class table_class
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    join pg_index index_state on index_state.indrelid = table_class.oid
    join pg_class index_class on index_class.oid = index_state.indexrelid
    where table_namespace.nspname = 'public'
      and table_class.relname = 'rankings'
      and index_class.relname = 'rankings_clear_id_unique'
      and index_state.indisunique
      and index_state.indisvalid
      and index_state.indisready
      and index_state.indpred is null
      and index_state.indexprs is null
      and index_state.indnkeyatts = 1
      and index_state.indkey::smallint[] = array[
        (select attnum from pg_attribute
         where attrelid = 'public.rankings'::regclass and attname = 'clear_id')
      ]::smallint[]
  ) then
    raise exception 'rankings_clear_id_unique is not a valid UNIQUE index on clear_id';
  end if;
end $$;

comment on column public.rankings.clear_id is
  'クライアントが周回開始時に生成する一意なクリアID。同一クリアの再送防止用。';
