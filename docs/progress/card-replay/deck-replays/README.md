# 案: 登録デッキの試合を、登録した本人が見返す(2026-10-31 リプレイくん・まだ作らない)

テスターさんの声「デッキ登録したやつのリプレイが見たいかな」。ソランド部長の依頼で、作り方の案をまとめる。社長に選んでもらう。

絵(1案1画面・名前は架空):

| 絵 | 中身 |
| --- | --- |
| [`今-デッキ登録.png`](今-デッキ登録.png) | 今。戦われた数は分かるが、試合の中身はどこにも残っていない |
| [`案A-デッキ登録から見る.png`](案A-デッキ登録から見る.png) | デッキ登録の画面に「戦われた試合を見る」→ 一覧 → 見返し(**おすすめ**) |
| [`案B-過去の対戦のタブ.png`](案B-過去の対戦のタブ.png) | 記録 →「過去の対戦」にタブを足して、自分の試合と並べる |

## 今どうなっているか

- フリー対戦「ほかのブリーダー」の試合は、**戦った人の端末にも見返しを残していない**(助手と対戦の記録の作りを通らず、捨てている)
- サーバへ送っているのは「戦った」の知らせだけ(`card_deck_use`: 試合の番号・持ち主・戦った人・勝ち負け・登録の版)。手の並びは無い
- 大会の試合は、サーバに手の並びがある(`card_tournament_match`。PR4 で見返しから開ける)

## 決めてほしいこと(3つ)

1. **入口**: 案A(デッキ登録の画面)/ 案B(記録の「過去の対戦」のタブ)
2. **戦った人の名前**: 出す(**おすすめ**。マルチの履歴・大会と同じ。ランキングで見える名前とアイコン)/ 伏せる(「ブリーダー」とだけ・アイコンなし)
3. **残す数**: 新しい **20試合**(おすすめ)/ 10試合 / 50試合。古い試合は、枠を回して上書きする(下の「消し方」)

## サーバに残す形(足すだけの表)

新しい表 `card_deck_replays` を1つ足す。今の表(`card_deck_entries`・`card_deck_uses`・`card_deck_rewards`)は読むだけで、形も中身も変えない。

| 入れる物 | 中身 |
| --- | --- |
| 持ち主・枠の番号 | `owner_id`・`slot`(0〜19)。この2つで1行 |
| 試合の番号 | `card_deck_uses` と同じ番号(同じ試合は1回だけ) |
| 戦った人 | ブリーダー番号・名前・アイコン・フレーム |
| 両方のデッキ | 戦った人のデッキ(端末から)・登録デッキ(**サーバが `card_deck_entries` から写す**。端末の言うことを信じない)・登録の版 |
| 試合 | 乱数の種・先攻・ルールの版(`CARD_REPLAY_RULES`)・手の並び・ターン数・登録デッキが勝ったか |
| 時刻 | 書いた時刻 |

### 消し方(「消さない」決まりとの兼ね合い)

- **行を消す命令(DELETE)は使わない。** 持ち主ごとに20の枠を持ち、21試合目は**いちばん古い枠に上書き**する(`on conflict (owner_id, slot) do update`)。表の大きさは「登録した人の数 × 20」で頭打ちになる
- 保存データ(`mh_*`)・ランキング・今の表には触らない。端末に新しいキーも足さない(一覧は開くたびにサーバから読む)
- ★(消さない印)は付けない。残したい試合は、見返しの画面から「自分の過去の対戦に写す」で端末の★(今の50試合・★10の枠)へ写せるようにする(任意。後回しでもよい)
- 登録をやめた・登録し直したときも、行は残す(一覧では「前の登録」の印を付ける)

### 書く人と、うその防ぎ方

- 書くのは**戦った人の端末**。試合が終わって「戦った」を送ったあとに、続けて手の並びを送る
- サーバは、`card_deck_uses` に同じ試合番号・同じ持ち主・同じ戦った人の「battle」が**あるときだけ**書く(知らせを出していない試合・人のなりすましは書けない。1試合1回)
- 登録デッキはサーバが写すので、すり替えられない。手の並びがでたらめなら、見返しはその手で止まる(ルール本体で当て直すので、ありえない手は通らない)
- 一覧の「勝ち・負け」は送られた値を出すが、見返しの最後の場はルール本体が決めるので、見ればうそは分かる
- 戦った人には、対戦の前の画面に「この試合は、デッキを登録した人があとから見返せます」と一言出す

### 読む人

- **登録した本人だけ**(登録と同じ「持ち主の鍵」の md5 で確かめる)。ほかの人は、人のデッキの試合を一覧できない
- 一覧(見出しだけ: 枠・時刻・名前・アイコン・勝ち負け・ターン数)と、1試合の中身を分けて読む

### 大会とのそろえ方

- 1試合の中身を返す関数は、**`card_tournament_match` と同じ形**で返す(`seed`・`first`・`rules`・`acts`・`winner`・`a:{ name, icon, deck }`・`b:{ … }`)。見返しの入口(93 の `cardReplayFromTour`)を少し広げて、両方を同じ道で開く
- 違いは種類の印だけ(会場と実況の枠は大会のときだけ出す)
- 案A の一覧の「大会」タブは、大会の表(`card_tournament_view`)から自分の試合を拾って並べる(表は増やさない)

### 見返しの上下

- 試合は「戦った人が下(0番)・登録デッキが上」の並びで山札を切っているので、**上下を入れかえると同じ試合にならない**。見返しは戦った人の画面と同じ並びで出し、上の帯に「あなたの登録デッキ」と書く
- 入れかえて見たい場合は、盤面の描き方を上下逆にする改修が別に要る(大きいので、今回は入れない案)

## サーバの負担と通信の量(見積もり)

いまのルールでコンピューターどうしを60試合回して測った(`card-tour-replay-check` と同じ部品):

| 物 | 大きさ |
| --- | --- |
| 1試合の手の数 | 平均 88手・いちばん長くて 129手 |
| 1行(手の並び+両方のデッキ) | 平均 約3.9KB・いちばん大きくて 約5.1KB(表の中では圧縮されて、およそ半分) |
| 表の大きさの上限 | 登録した人 100人 → 約8MB / 1,000人 → 約80MB(20試合のとき。10試合なら半分) |
| 戦った人の送信 | 1試合ごとに 約4KB を1回(今の「戦った」の知らせに続けて) |
| 本人の読み込み | 一覧 約4KB(20行の見出し)・見返し1試合 約4KB |

- 書き込みは「戦われた回数」と同じ回数だけ(今の `card_deck_uses` と同じ多さ)。サーバの関数で回す処理は無い(大会と違い、試合は端末で回ったものを残すだけ)
- 1行の大きさに上限を付ける(手の並び 30KB まで・手 4,000 手まで)
- 1,000人を超えそうなら、残す数を10試合にするか、古い枠を「見た試合から上書き」にする

## SQL(本文だけ。流していない。決まったら窓口へ)

```sql
-- MFバトルカード: 登録デッキが戦われた試合の見返し(足すだけ。今の表は読むだけ)
create table if not exists public.card_deck_replays (
  owner_id      text        not null,
  slot          integer     not null,
  match_id      text        not null,
  user_id       text        not null,
  user_name     text        not null default '',
  icon          text,
  profile_frame text,
  user_deck     jsonb       not null,
  owner_deck    jsonb       not null,
  owner_version integer     not null,
  seed          bigint      not null,
  first         integer     not null,
  rules         integer     not null,
  acts          jsonb       not null,
  turns         integer,
  deck_won      boolean     not null default false,
  at            timestamptz not null default now(),
  constraint card_deck_replays_pkey primary key (owner_id, slot),
  constraint card_deck_replays_shape check (slot between 0 and 19 and first in (0, 1) and match_id ~ '^[A-Za-z0-9_-]{8,64}$'
    and octet_length(acts::text) <= 30000 and jsonb_array_length(acts) between 1 and 4000
    and octet_length(user_deck::text) <= 2000 and length(user_name) <= 40)
);
create unique index if not exists card_deck_replays_match_idx on public.card_deck_replays (match_id);
alter table public.card_deck_replays enable row level security; -- 直接は読めない(下の関数だけ)

-- 書く: 戦った人の端末から。「戦った」の知らせ(card_deck_uses)がある試合だけ・1試合1回。登録デッキはサーバが写す
create or replace function public.card_deck_replay_put(
  p_match_id text, p_owner text, p_user text, p_name text, p_icon text, p_frame text,
  p_user_deck jsonb, p_seed bigint, p_first integer, p_rules integer, p_acts jsonb, p_turns integer, p_deck_won boolean)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.card_deck_entries; use public.card_deck_uses; s integer;
begin
  select * into use from public.card_deck_uses where match_id = p_match_id;
  if not found or use.owner_id <> p_owner or use.user_id <> p_user or use.kind <> 'battle' then return 'none'; end if;
  if exists (select 1 from public.card_deck_replays where match_id = p_match_id) then return 'dup'; end if;
  select * into cur from public.card_deck_entries where owner_id = p_owner;
  if not found or cur.version <> use.version then return 'old'; end if;
  if p_acts is null or jsonb_typeof(p_acts) <> 'array' or p_user_deck is null or jsonb_typeof(p_user_deck) <> 'object' then return 'bad'; end if;
  -- 空いている枠 → 無ければいちばん古い枠
  select g into s from generate_series(0, 19) g
    where not exists (select 1 from public.card_deck_replays r where r.owner_id = p_owner and r.slot = g) order by g limit 1;
  if s is null then select slot into s from public.card_deck_replays where owner_id = p_owner order by at asc limit 1; end if;
  insert into public.card_deck_replays (owner_id, slot, match_id, user_id, user_name, icon, profile_frame, user_deck, owner_deck, owner_version, seed, first, rules, acts, turns, deck_won, at)
    values (p_owner, s, p_match_id, p_user, left(coalesce(p_name, ''), 40), left(p_icon, 64), left(p_frame, 40), p_user_deck, cur.deck, cur.version,
      p_seed, p_first, p_rules, p_acts, p_turns, coalesce(p_deck_won, false), now())
    on conflict (owner_id, slot) do update set match_id = excluded.match_id, user_id = excluded.user_id, user_name = excluded.user_name, icon = excluded.icon,
      profile_frame = excluded.profile_frame, user_deck = excluded.user_deck, owner_deck = excluded.owner_deck, owner_version = excluded.owner_version,
      seed = excluded.seed, first = excluded.first, rules = excluded.rules, acts = excluded.acts, turns = excluded.turns, deck_won = excluded.deck_won, at = excluded.at;
  return 'ok';
end $$;

-- 読む: 登録した本人だけ(持ち主の鍵)。一覧は見出しだけ
create or replace function public.card_deck_replays_of(p_owner text, p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', r.slot, 'at', r.at, 'name', r.user_name, 'icon', r.icon, 'frame', r.profile_frame,
    'deck_won', r.deck_won, 'turns', r.turns, 'old', r.owner_version <> e.version) order by r.at desc), '[]'::jsonb)
  from public.card_deck_replays r join public.card_deck_entries e on e.owner_id = r.owner_id
  where r.owner_id = p_owner and e.key_hash = md5(p_key)
$$;

-- 1試合の中身(card_tournament_match と同じ形。a = 戦った人(下)・b = 登録デッキ(上))
create or replace function public.card_deck_replay_get(p_owner text, p_key text, p_slot integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.slot, 'kind', 'deck', 'seed', r.seed, 'first', r.first, 'rules', r.rules, 'acts', r.acts,
    'winner', case when r.deck_won then 1 else 0 end,
    'a', jsonb_build_object('name', r.user_name, 'icon', r.icon, 'is_assist', false, 'deck', r.user_deck),
    'b', jsonb_build_object('name', e.user_name, 'icon', e.icon, 'is_assist', false, 'deck', r.owner_deck))
  from public.card_deck_replays r join public.card_deck_entries e on e.owner_id = r.owner_id
  where r.owner_id = p_owner and r.slot = p_slot and e.key_hash = md5(p_key)
$$;
grant execute on function public.card_deck_replay_put(text, text, text, text, text, text, jsonb, bigint, integer, integer, jsonb, integer, boolean) to anon, authenticated;
grant execute on function public.card_deck_replays_of(text, text) to anon, authenticated;
grant execute on function public.card_deck_replay_get(text, text, integer) to anon, authenticated;
```

## 作るときの区切り(決まったら)

1. 端末: フリー対戦「ほかのブリーダー」の試合も手を記録する(今は捨てている)。終わったら「戦った」に続けて `card_deck_replay_put` を送る。戦う前の一言
2. 見返し: `cardReplayFromTour` を、大会と登録デッキの両方を開ける形に広げる(上の帯に「あなたの登録デッキ」)
3. 入口: 案A なら デッキ登録の画面のボタンと一覧、案B なら 過去の対戦のタブ
4. 更新履歴・ヘルプ(文は公開前に部長へ)
