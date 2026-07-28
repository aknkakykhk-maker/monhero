-- 同一クリアの再送を安全に無視するための冪等性キー。
-- 既存行はNULLのまま保持するため、このマイグレーションはデータを削除・変更しない。
alter table public.rankings
  add column if not exists clear_id text;

create unique index if not exists rankings_clear_id_unique
  on public.rankings (clear_id);

comment on column public.rankings.clear_id is
  'クライアントが周回開始時に生成する一意なクリアID。同一クリアの再送防止用。';
