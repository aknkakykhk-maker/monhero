-- 読み取り専用の一次調査SQL。最初にこれを実行し、結果を退避してから修復を判断すること。
-- 発生日時とプレイヤー名が分かったら各 :placeholder を実値に置き換える。
select id, created_at, difficulty, user_name, score, level, hero, party, icon, clear_id
from public.rankings
where lower(difficulty) = 'master'
  and score between 9000000 and 13000000
  and created_at between :incident_from and :incident_to
  and user_name = :player_name
order by created_at, id;

-- 同一プレイヤー・近接時刻・ほぼ同一内容の重複候補（削除はしない）。
select user_name, score, hero, party, level,
       date_trunc('second', created_at) as saved_second,
       count(*) as duplicate_count,
       array_agg(id order by id) as record_ids
from public.rankings
where lower(difficulty) = 'master'
  and score between 9000000 and 13000000
  and created_at between :incident_from and :incident_to
group by user_name, score, hero, party, level, date_trunc('second', created_at)
having count(*) > 1
order by saved_second;

-- 型はPostgreSQL列定義で保証されるが、範囲外・欠損・JSON形状異常を明示的に数える。
select id, created_at, user_name, score, level, hero, party, icon, clear_id
from public.rankings
where lower(difficulty) = 'master'
  and (
    user_name is null or btrim(user_name) = ''
    or score is null or score < 0
    or level is null or level < 0
    or (party is not null and jsonb_typeof(party::jsonb) <> 'array')
  )
order by created_at desc;
