-- 助手ライフ: 置き手紙の自由文と、留守の助手あての一言(案・2026-11-08 オトズレ3)
-- 足すだけ。DROP・既存の関数や見張りの書き換えはしない。何度流しても同じ(if not exists / create or replace は新しい名前だけ)
-- 1) 列を足す: note=自由文(40字まで・無くてよい) / note_to=あて先の助手(留守の助手に残すとき)
alter table public.assistant_life_friend_visits add column if not exists note text;
alter table public.assistant_life_friend_visits add column if not exists note_to text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alf_visits_note_shape') then
    alter table public.assistant_life_friend_visits add constraint alf_visits_note_shape check (
      note is null or (kind = 'player' and char_length(note) between 1 and 40 and note !~ '[\r\n]'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'alf_visits_note_to_shape') then
    alter table public.assistant_life_friend_visits add constraint alf_visits_note_to_shape check (
      note_to is null or (kind = 'player' and note_to ~ '^[a-z]{2,20}$'));
  end if;
end $$;
-- 2) 新しい見張り(既存の alf_visits_guard はそのまま)。
--    足すとき: 連絡先らしいもの(URL・メール・7けた以上の数字・SNSのID)をはじく(端末でもはじく。こちらは抜け道ふさぎ)
--    変えるとき: note・note_to はあとから変えられない(既存の見張りはお礼のほかを見ているが、新しい列は知らないため)
create or replace function public.alf_visits_note_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare flat text;
begin
  if tg_op = 'UPDATE' then
    if (new.note, new.note_to) is distinct from (old.note, old.note_to) then
      raise exception '置き手紙の文は変えられません';
    end if;
    return new;
  end if;
  if new.note is not null then
    flat := lower(translate(normalize(new.note, NFKC), ' 　-ー_.。・,、:：/／', ''));
    if flat ~ '(https?|www|\.(com|net|org|jp|io|me|ly|co|app|gg|tv))' or new.note ~* '[a-z0-9._%+-]+@[a-z0-9-]+'
       or flat ~ '[0-9]{7,}' or flat ~ '(line|insta|twitter|tiktok|discord|youtube|らいん|いんすた|でぃすこ)@?[a-z0-9_]{3,}' then
      raise exception '連絡先のような文は置けません';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.alf_visits_note_guard() from public, anon, authenticated;
create or replace trigger alf_visits_note_guard before insert or update on public.assistant_life_friend_visits
  for each row execute function public.alf_visits_note_guard();
