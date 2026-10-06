-- 端末ごとのプレイ時間の表を確かめる(読み取りだけ)。
select count(*) as "行の数", count(distinct breeder_id) as "人の数",
       count(*) filter (where updated_at > now() - interval '1 day') as "1日以内に送った端末"
  from public.friend_playtime_devices;

select breeder_id, count(*) as "端末の数", max(base_seconds) + sum(own_seconds) as "合計(秒)"
  from public.friend_playtime_devices
 group by breeder_id
having count(*) > 1
 order by 3 desc
 limit 20;
