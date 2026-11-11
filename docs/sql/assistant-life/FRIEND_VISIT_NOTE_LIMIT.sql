-- 助手ライフ: 置き手紙(kind='player')の1日の合計の上限をなくす(2026-11-11 社長「置き手紙はフレンドごとの回数制限にして」「上限はなしで1人1通」・トモダチ)
-- 関数 alf_visits_guard の置き換えだけ(create or replace)。表・行・ほかの関数・トリガーは変えない。DROP なし。
-- 変わるのは1か所: 「行った人の1日の上限(on 3 / thin 1)」を数えるのを kind='go'(助手が行く)だけにする。
--   kind='player'(プレイヤーの置き手紙)は合計を数えない。同じフレンドへ1日1通は、今ある一意の決まり alf_visits_once_a_day (kind, visitor_id, host_id, day) がそのまま守る。
--   kind='come'(来てもらう・1日2人)は今のまま。フレンドか・両方が入か・日付・お礼のほかは変えられない、も今のまま。
create or replace function public.alf_visits_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date;
  sw    text := coalesce((select mode from public.assistant_life_friend_switch where id = 1), 'thin');
  n     integer;
begin
  if tg_op = 'UPDATE' then
    -- 変えてよいのはお礼だけ
    if (new.kind, new.visitor_id, new.host_id, new.day, new.assistants, new.word, new.created_at)
       is distinct from (old.kind, old.visitor_id, old.host_id, old.day, old.assistants, old.word, old.created_at) then
      raise exception 'お礼のほかは変えられません';
    end if;
    return new;
  end if;
  if sw = 'off' then
    raise exception '行き来はいま止めています';
  end if;
  if new.day not between today - 1 and today + 1 then
    raise exception '日付がずれています';
  end if;
  if not exists (select 1 from public.friend_links l
                 where least(l.requester_id, l.target_id) = least(new.visitor_id, new.host_id)
                   and greatest(l.requester_id, l.target_id) = greatest(new.visitor_id, new.host_id)
                   and l.status = 'accepted') then
    raise exception 'フレンドではありません';
  end if;
  if (select count(*) from public.assistant_life_friend_houses h
      where h.breeder_id in (new.visitor_id, new.host_id) and h.open) < 2 then
    raise exception '行き来を切にしています';
  end if;
  if new.kind = 'come' then
    select count(*) into n from public.assistant_life_friend_visits v
      where v.kind = 'come' and v.host_id = new.host_id and v.day = new.day;
    if n >= (case when sw = 'thin' then 0 else 2 end) then
      raise exception '今日はもう来られません';
    end if;
  elsif new.kind = 'go' then
    select count(*) into n from public.assistant_life_friend_visits v
      where v.kind = 'go' and v.visitor_id = new.visitor_id and v.day = new.day;
    if n >= (case when sw = 'thin' then 1 else 3 end) then
      raise exception '今日はもう行けません';
    end if;
  end if;
  -- kind = 'player'(置き手紙)は合計を数えない。同じフレンドへ1日1通は alf_visits_once_a_day が守る
  new.thanks := null;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.alf_visits_guard() from public, anon, authenticated;
