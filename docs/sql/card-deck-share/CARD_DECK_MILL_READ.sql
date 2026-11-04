-- 読むだけ(2026-11-04 ルールくん): 山札切れ狙いの登録デッキ(えるびんさんのデッキ)を、測り直しのために読む。
--   表を書き換えない。select だけ。合言葉の列(key_hash)と持ち主の番号(owner_id)は読まない。
--   名前に「えるびん」を含む登録と、戦術カードに「山札を削る」「持久型」が入っている登録(新しい順に20件まで)を返す。
select user_name, version, battles, deck_wins, updated_at, deck, tactics,
       (user_name ilike '%えるびん%') as by_name
from public.card_deck_entries
where active
  and (user_name ilike '%えるびん%'
       or tactics::text like '%山札を削る%'
       or tactics::text like '%tMill%')
order by by_name desc, updated_at desc
limit 20;
