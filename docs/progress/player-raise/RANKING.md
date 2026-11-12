# モンヒロサクセス 育成完了時の総合力ランキング(設計・第1版)

クラフトくん 2026-11-12。**設計だけ**(コード・表はまだ作らない。SQL は本文を書くだけで、流すのは窓口)。段取りは PLAN.md §10 の 5a。

## 社長の決めたこと(2026-11-12・窓口経由)

1. **血統別** と **全モンスター** の2つ
2. プレイヤー1人1件ではなく、**育てた子ごとに全部載せる**
3. 期間は **ずっと(累計)だけ**
4. 行に出すのは **育てた子の名前・染めた姿の絵・評価(G〜M の11段+数字。例 C3)・総合力・育てた人の名前**(押すと6能力)

## 1. 表の形(新しい表だけ・既存のランキングの表は触らない)

- 新しい表 `monsuc_finishes`(1行 = 育て終えた子1体)。既存のランキング(`mh_*` の保存キー・チャレンジ・クイック・マスモン対戦の表)には一切触れない
- 持ち主の確かめは、助手マスモン対戦の **持ち主の鍵**(`masmon_pvp_owners`・`masmon_pvp_owner_check`)をそのまま使い回す(番号だけで他人の名前で送れないように)

| 列 | 中身 |
| --- | --- |
| `run_id` | 育成の id(主キー)。**同じ育成は二度入らない** |
| `owner_id` | 育てた人(持ち主の鍵と同じ番号) |
| `user_name` | 育てた人の名前(送ったときの名前。40字まで) |
| `child_name` | 育てた子の名前(言葉の見張りを通したもの。24字まで) |
| `species` | 種(ベースモンの id) |
| `lineage` | 主血統(`lineages.js` の主血統。血統別の絞りこみに使う) |
| `dye` | 染めた色(部位ごとの色。今の染色のしくみの形のまま・小さな JSON) |
| `stats` | 6能力(押したときに見せる) |
| `techs` | 覚えた技の数と熟練(総合力をサーバで出し直すため) |
| `lv`・`loyal`・`pop` | 総合力の式に入るもの |
| `power` | 総合力(**サーバが出し直した値**。端末の値は信じない) |
| `grade` | 評価(G〜M のランク。画面は C〜S を中心に出す) |
| `engine_version` | 計算の芯の版(`MONHERO_SUCCESS.VERSION`。式が変わったら上げる) |
| `finished_at` | 送った時刻 |

- 読むのは2つの見え方(view)だけ: `monsuc_rank_all`(全モンスター・総合力の高い順)・`monsuc_rank_lineage`(血統ごとの順位を付けたもの)。どちらも **読むだけ**(端末には書かせない)
- 載せる数: 全モンスターは上位100件、血統別は血統ごとに上位50件を画面で読む(表には全部残す)

## 2. 送る時

- **引退して育成が完了したとき1回だけ**(46ターンを走り切った・頂への道で負けた・途中で引退した、のどれも「完了」)。**デビュー戦のゲームオーバーは送らない**
- **同じ育成は二度送らない**: 端末は送れた育成の id を新しいキー `mh_monsuc_rank_sent_v1`(送った id の一覧・最後の50件)に残す(⑦: 新しいキーを足すだけ)。サーバも `run_id` を主キーにして、二度目は入れない(`on conflict do nothing`)
- 送れなかったとき(電波など)は、次に開いたときに1回だけ送り直す(送り直しの印は同じキー)
- **送らない遊び方**: デバッグで進めた育成・テストの育成は送らない(送る前に印を見る)。ほかのランキングの決まり(スキップチケット・クイックは送らない)と同じ考え方

## 3. ずる対策(サーバ側で弾く)

送るのは Edge Function `monsuc-rank`(新しい・service_role で表に書く)。端末から表には直接書かせない。

1. **持ち主の鍵**: `masmon_pvp_owner_check(owner, key)` が 'ok' でなければ断る
2. **形**: 6能力は 0〜999 の整数・技は8つまで・熟練 0〜100・Lv 1〜99・忠誠/人気 0〜100・名前の長さ
3. **総合力は出し直す**: サーバで総合力の式(MASMON_CALC.power と同じ式)を計算し、その値を `power` に入れる。端末から来た総合力は使わない
4. **上限**: 総合力 20,070(式の最大)を超えない。さらに「46ターンで届く上限」として **6能力の合計 5,400・総合力 16,500** を超えたら弾く(試算の最強の編成でも 6能力の合計 約4,100・総合力 約13,000 のため。数は試算の版が上がったら見直す)
5. **重複**: `run_id` の重複は入れない。**同じ人の送信は1分に1回・1日50回まで**(回数の表 `monsuc_rank_usage`)
6. **育成の id の形**: `持ち主の番号` + `-` + 端末で作る乱数(サーバは「持ち主の番号で始まるか」を確かめる。他人の育成の id を使えないように)
7. 怪しい行を消せるよう `hidden`(真なら見え方から外す)を持つ。消すのは窓口の判断で(行そのものは消さない)

## 4. 画面の置き場所

- **モンヒロサクセスの入口の画面**(はじめる・保存枠・合体の並び)に「🏆 ランキング」のボタン
- 開くと上にタブ「全モンスター」「血統別」。血統別は血統の札(主血統の一覧)を選んで切り替える
- 1行: 順位・**染めた姿の絵**(種の絵に `dye` で色を付ける・今の染色の描き方)・**名前**・**評価**(G〜M の札の色+数字)・**総合力**・**育てた人の名前**
- 行を押すと下から板が出て、**6能力**(棒)と種・覚えた技の数を見せる
- 自分の子の行は色を変え、「自分の子だけ」の絞りこみも置く
- 引退の画面(振り返り)の最後に「ランキングに載りました: 全体 ◯位・◯◯血統 ◯位」を出す

## 5. 保存(CLAUDE.md ⑦)

- 新しいキー `mh_monsuc_rank_sent_v1` だけを足す(既存のキーは触らない)。読み込みは「無い・壊れている → 空の一覧」
- 育成の中身(保存枠の子)は回2・回3の新しいキーのまま。ランキングに送ったかどうかで保存枠の子を書き換えない

## 6. SQL(本文だけ・流すのは窓口)

```sql
-- モンヒロサクセス 育成完了時の総合力ランキング(足すだけ。既存の表・関数・ランキングには触らない。何度流しても同じ)
create table if not exists public.monsuc_finishes (
  run_id         text        not null,
  owner_id       text        not null,
  user_name      text        not null default '',
  child_name     text        not null default '',
  species        text        not null,
  lineage        text        not null,
  dye            jsonb       not null default '{}'::jsonb,
  stats          jsonb       not null,
  techs          jsonb       not null default '[]'::jsonb,
  lv             integer     not null default 1,
  loyal          integer     not null default 0,
  pop            integer     not null default 0,
  power          integer     not null,
  grade          text        not null,
  engine_version integer     not null default 1,
  hidden         boolean     not null default false,
  finished_at    timestamptz not null default now(),
  constraint monsuc_finishes_pkey primary key (run_id),
  constraint monsuc_finishes_shape check (
    run_id ~ '^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$' and owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and left(run_id, length(owner_id) + 1) = owner_id || '-'
    and species ~ '^[A-Za-z]{2,32}$' and lineage ~ '^[A-Za-z_]{1,32}$'
    and length(user_name) <= 40 and length(child_name) <= 24
    and octet_length(dye::text) <= 2000 and octet_length(stats::text) <= 400 and octet_length(techs::text) <= 800),
  constraint monsuc_finishes_counts check (
    lv between 1 and 99 and loyal between 0 and 100 and pop between 0 and 100
    and power between 0 and 16500 and grade in ('G','F','E','D','C','B','A','S','SS','SSS','M') and engine_version between 1 and 1000)
);
create index if not exists monsuc_finishes_power_idx on public.monsuc_finishes (hidden, power desc);
create index if not exists monsuc_finishes_lineage_idx on public.monsuc_finishes (hidden, lineage, power desc);

create table if not exists public.monsuc_rank_usage (
  owner_id  text        not null,
  day       date        not null,
  sent      integer     not null default 0,
  last_at   timestamptz not null default now(),
  constraint monsuc_rank_usage_pkey primary key (owner_id, day)
);

alter table public.monsuc_finishes   enable row level security;
alter table public.monsuc_rank_usage enable row level security;
revoke all on public.monsuc_finishes   from anon, authenticated;
revoke all on public.monsuc_rank_usage from anon, authenticated;

-- 読むのは見え方だけ(hidden の行は出さない)
create or replace view public.monsuc_rank_all as
  select run_id, user_name, child_name, species, lineage, dye, stats, power, grade, finished_at,
         rank() over (order by power desc, finished_at asc) as place
  from public.monsuc_finishes where not hidden;
create or replace view public.monsuc_rank_lineage as
  select run_id, user_name, child_name, species, lineage, dye, stats, power, grade, finished_at,
         rank() over (partition by lineage order by power desc, finished_at asc) as place
  from public.monsuc_finishes where not hidden;
revoke all on public.monsuc_rank_all     from anon, authenticated;
revoke all on public.monsuc_rank_lineage from anon, authenticated;
grant select on public.monsuc_rank_all     to anon, authenticated;
grant select on public.monsuc_rank_lineage to anon, authenticated;

-- 1件を入れる(Edge Function monsuc-rank だけが呼ぶ。総合力・評価はサーバで出し直した値を渡す)
-- 返り値: 'ok' | 'dup'(同じ育成はもう入っている) | 'busy'(1分に1回・1日50回を超えた)
create or replace function public.monsuc_rank_submit(p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_owner text := p_row->>'owner_id'; v_day date := (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date; u record;
begin
  select * into u from public.monsuc_rank_usage where owner_id = v_owner and day = v_day;
  if found and (u.sent >= 50 or u.last_at > now() - interval '1 minute') then return 'busy'; end if;
  insert into public.monsuc_finishes (run_id, owner_id, user_name, child_name, species, lineage, dye, stats, techs, lv, loyal, pop, power, grade, engine_version)
  values (p_row->>'run_id', v_owner, coalesce(p_row->>'user_name', ''), coalesce(p_row->>'child_name', ''), p_row->>'species', p_row->>'lineage',
          coalesce(p_row->'dye', '{}'::jsonb), p_row->'stats', coalesce(p_row->'techs', '[]'::jsonb),
          (p_row->>'lv')::int, (p_row->>'loyal')::int, (p_row->>'pop')::int, (p_row->>'power')::int, p_row->>'grade', coalesce((p_row->>'engine_version')::int, 1))
  on conflict (run_id) do nothing;
  if not found then return 'dup'; end if;
  insert into public.monsuc_rank_usage (owner_id, day, sent, last_at) values (v_owner, v_day, 1, now())
  on conflict (owner_id, day) do update set sent = public.monsuc_rank_usage.sent + 1, last_at = now();
  return 'ok';
end $$;
revoke all on function public.monsuc_rank_submit(jsonb) from public, anon, authenticated;
grant execute on function public.monsuc_rank_submit(jsonb) to service_role;
```

- 日の区切りは朝4:00(JST)。ほかの回数の表と同じ
- 表・見え方の名前は `monsuc_` で始め、既存の名前とぶつからない
- 流したあとの確かめ: `select count(*) from public.monsuc_finishes;`(0件)・`select * from public.monsuc_rank_all limit 1;`(空で通る)

## 7. 決まった(2026-11-12 社長・窓口経由)

- **評価に関係なく全部載せる**(G〜D の子も。画面は上位だけ読む)
- **名前を出さない設定は置かない**(育てた人の名前はそのまま出す)
- 評価は助手マスモンと同じランク表(社長の最新 2026-11-12・前の「C〜S の4段」「M 20,000」は取り消し): G 0〜 / F 2,000〜 / E 3,000〜 / D 4,500〜 / C 6,000〜 / B 8,000〜 / A 11,000〜 / S 14,000〜 / SS 16,000〜 / SSS 18,000〜 / M 19,500〜(500ごとに下から数字。C1〜C4・M は上限なしで M1・M2…)
