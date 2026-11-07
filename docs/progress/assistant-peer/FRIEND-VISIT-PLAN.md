# 助手ライフ フレンドの家との行き来の案(作る前)

> **無料枠に収まるか: 収まる。** 今の約700人・その5倍までは、ふつうの遊び方で送り出し(egress)が無料枠の約5〜26%、DB は約1〜2%、Realtime と Edge Function は使わない(0%)。10倍で毎日みんなが目いっぱい遊ぶと送り出しが枠を超えうるので、サーバー側のスイッチ1つで「間引く・止める」に切り替える(0章)。

担当: 助手部オトズレ(2026-11-08)。社長の依頼「助手ライフの機能を拡張してフレンドのとこに遊びに行けたりフレンドが遊びに来たりとかもいれたい」。
今回は**案と止め絵だけ**(ゲーム本体・Supabase には触っていない)。作るのは社長の A/B と「これで作る」のあと。

止め絵(本物の「助手たちの家」と HOME・モンヒロビートの画面に、案の部品を重ねて撮った)

| 絵 | 中身 |
| --- | --- |
| [`friend/friend-tate.jpg`](friend/friend-tate.jpg) | 縦 390×844 の8枚(① 家 ② フレンドの家を選ぶ ③ だれが行くか ④ フレンドの家で遊ぶ ⑥ おかえり ⑤ HOME の知らせ ⑦ 置き手紙 ⑧ 設定) |
| [`friend/friend-yoko.jpg`](friend/friend-yoko.jpg) | 横 844×390 の同じ8枚 |
| [`friend/friend-rot.jpg`](friend/friend-rot.jpg) | 🔄横(モンヒロビートの中で回したとき)の知らせ。390×844・375×667 |
| `friend/shoot.js` | 撮り直す道具(家を開いて案の部品を重ねるだけ。本体は変えない) |

撮ったあと、1枚ずつ自分で見て、文字の切れ・言葉の途中の折れ・部品の重なりがないことを確かめた
(途中で見つけて直したもの: 掲示板の「遊びに/来た」の折れ・HOME の知らせの右端の切れ・横で「🏘 1」の印が「助手ライフ」の字にかかる・横で帯が右のシートに隠れる・④の部屋で吹き出しと札が重なる)。

---

## 0. Supabase の無料枠に収まるか(2026-11-08 社長「フレンドと色々できるようにする機能でsupabaseが耐えられるか気になる。無料でつかってる」)

今の状態(窓口が読むだけの SQL で見た): DB 全体 35MB/無料枠 500MB。いちばん大きい rankings 6.9MB(5,101行)、friend_profiles 696行・1.5MB。
無料枠: DB 500MB/送り出し(egress)月 5GB/Edge Function 月50万回/Realtime 同時接続200・メッセージ月200万。

### 0-1. 見積もりの前提

| 項目 | 値 | 理由 |
| --- | --- | --- |
| 遊んでいる人 | 今 700人(friend_profiles の行数)/5倍 3,500人/10倍 7,000人 | 窓口の数字 |
| 1日に開く人 | ふつう 半分/目いっぱい 全員 | |
| 控えの大きさ | 1人 約1KB(上限 2,000字。会った助手8人×部屋の様子+家具の key 3つずつ) | 下の 0-2 |
| 控えを読む | 「🏘 フレンド」を開いたとき+1日1回の来客えらび。30分は端末に控えて読み直さない。**前に読んだあとで変わった家だけ**読む(`updated_at=gt.前回`) | ふつう1日2回・目いっぱい4回 |
| 1回に読む家 | ふつう 10軒(1軒 約1KB+返事のヘッダ)/目いっぱい 20軒 | フレンドの上限は50人だが、14日以内に控えを送った家だけ |
| 行き来の行 | 1人1日 ふつう 1.5行/目いっぱい 5行(行く3+来る2)。1行 約250B(索引込み)。**8日たったら片づける** | 端末が読むのは7日分 |

### 0-2. 見積もり(無料枠の何%か)

| | 今 700人 | 5倍 3,500人 | 10倍 7,000人 |
| --- | --- | --- | --- |
| 増える行(控え) | 700行 | 3,500行 | 7,000行 |
| 増える行(行き来・8日分) | ふつう 4,200行/目いっぱい 28,000行 | 2.1万/14万行 | 4.2万/28万行 |
| DB 容量(控え×2+行き来) | 約2.5MB〜8.5MB(**0.5〜1.7%**) | 約12〜42MB(**2.4〜8.4%**) | 約25〜84MB(**5〜17%**) |
| 送り出し 1日(1人 ふつう 約25KB/目いっぱい 約90KB) | 約9MB〜63MB | 約44〜315MB | 約88〜630MB |
| 送り出し 1月 | 約0.26〜1.9GB(**5〜38%**) | 約1.3〜9.5GB(**26〜190%**) | 約2.6〜19GB(**53〜380%**) |
| Edge Function の呼び出し | 0回(0%) | 0回 | 0回 |
| Realtime の接続・メッセージ | 0(0%) | 0 | 0 |

- **ふつうの遊び方なら 10倍まで枠に収まる**(送り出しが月 2.6GB=53%)。目いっぱいの見積もりは「毎日全員が1日4回フレンド一覧を開き、20軒が毎回変わっている」という上ぶれで、5倍から枠を超えうる → 0-4 のスイッチで「間引く」に切り替える
- 送り出しは**ほかの機能(ランキング・フレンド・マルチなど)と分け合う**。今の月の送り出しの量は窓口が Supabase の Usage の画面で見る(まだ見ていない)。今がすでに枠の半分を超えていたら、最初から「間引く」で出す
- 書き込み(端末 → Supabase)は送り出しに入らない。API の回数に無料枠の上限は無い

### 0-3. 枠に収める作り

- **Realtime は使わない**。同時接続200は今のマルチ(モンヒロビート・MFバトルカード)と分け合うため、行き来はすべて控えを読む形(REST)
- 控えは小さく(上限 2,000字・目安 1KB)。名前の文は入れず id と種類の短い記号だけ
- 開いたときに1回まとめて読む(`breeder_id=in.(…)`)。30分は端末に控えて読み直さない。変わった家だけ読む
- 自分の控えを送るのは10分に1回まで。中身が前と同じなら送らない
- 1日の回数の上限は表の側でも守る(行く3回・同じ家1回・来る2人)
- 古い行き来の記録は**新しい表の中だけ**で8日たったら片づける(足すときの見張りが、ときどき古い行をまとめて消す。既存の表は触らない。端末には消す権限を渡さない)

### 0-4. 危ないときの逃げ道(スイッチ1つ)

新しい小さな表 `assistant_life_friend_switch`(1行だけ)に `mode` を置く。端末は起動して最初に1回だけ読む。

| mode | 動き |
| --- | --- |
| `on` | ふつう |
| `thin`(間引く) | 控えを読むのは1日1回・来客なし・自分の控えは1時間に1回まで。送り出しはおよそ3分の1 |
| `off`(止める) | 「🏘 フレンド」を出さない・通信しない。表の側でも行き来を受け付けない。今までの記録は消さない |

- 窓口が週に1回、DB の大きさ(`pg_database_size`)と Usage の送り出しを見て、**どちらかが枠の8割に近づいたら `thin`、超えそうなら `off`** にする(SQL 1行。ゲームの公開をし直さなくても次に開いた人から効く)
- スイッチの表が読めないとき(無い・失敗)は `thin` として動く(安全側)

---

## 1. 何が起きるか(2つの向き)

### 1-1. 自分の助手が、フレンドの家へ遊びに行く(行く)

1. 家の下のアイコンの列に5つ目「🏘 フレンド」を足す(①)。押すとフレンドの家の一覧(②)
2. 一覧は**承認済みのフレンド**のうち、助手ライフの「家の控え」があり、行き来を入にしている人だけ。最近開いた順。
   「🟢 いま遊んでいる」か「📷 きのう 21:10 の様子」(控えの時刻)を出す。家にいる相手の助手の顔の丸も並べる
3. 家を選ぶと「だれが行く？」(③)。**家にいる自分の助手から1〜2人**。寝ている助手(💤)・けんか中の助手(💢)は選べない
4. 送り出すと、フレンドの家の画面(④)。部屋・家具・相手の助手の様子は**相手が最後に開いたときの控え**。屋根の看板が「🏘 あおいさんの家」になり、上に「📷 きのう 21:10 の様子(控え)」
5. 短い場面(2〜4行)。自分の助手と、相手の家にいた助手が話す。相手の助手は「あおいさんのドラ」のように**フレンドの呼び名+助手の名前**で出す
6. 場面のあと、その時間帯のあいだは自分の部屋に「🏘 あおいさんの家へ」の札(①・今の行き先の札と同じ形)。次の時間の区切りで帰ってきて、家を開くと「おかえり！」(⑥)

### 1-2. フレンドの助手が、自分の家へ遊びに来る(来る)

2つの入り口がある(どちらも相手がオフラインでよい)。

- **フレンドが送り出したとき**: フレンドが 1-1 で自分の家を選ぶと、その記録(だれが・いつ・決まった一言)が表に残る。自分が次に開いたとき「留守のあいだに来てくれた」(⑦の置き手紙)に並ぶ
- **フレンドの助手が自分で来るとき**: 自分が家を開いたとき、フレンドの控えから、家にいる相手の助手がたまに自分で遊びに来る(1日2人まで)。みんなの居間の扉に顔の丸と 🏘 の印(①)。押すと短い場面。
  このときは「あおいさんのソラシドがあなたの家に遊びに行っていた」という記録を表に残し、あおいさんが次に開いたとき掲示板に1件出る

来てくれた人には、決まった一言で「お礼」を返せる(⑦)。

### 1-3. 来てくれたときの知らせ方(⑤・🔄横)

- HOME: 施設「🏡 助手ライフ」の札の右上に「🏘 1」の印。家の中: 居間の扉に顔、掲示板に「14:20 🏘 ゆうとさんのももすけが来た」
- 知らせの帯(1行・3秒)は、HOME とモンヒロビートの入口・曲えらびだけ。**演奏中・バトル中・カード対戦中・お話・結果では出さない**(時刻の札と同じ線引き)
- 🔄横では、帯を回した器の中に出す(画面の外へ出さない・`document.body` へ直に出さない)。モンヒロビートを出ると回転は戻るので、家・HOME は回して描かない(今の決まりのまま)

---

## 2. 相手がオフラインでも成り立つ形(おすすめ=控え)

**家の控え**: 助手ライフを開いている端末が、自分の家の様子を小さな JSON にして、Supabase の新しい表に1人1行で上書きする
(家を開いたとき・時間の区切りが変わったとき。間隔は10分より短くしない)。フレンドはそれを読んで訪ねる。

控えに入れるもの(これだけ):

| 項目 | 例 |
| --- | --- |
| 会った助手の id | `['mua','kiki','dra',…]` |
| 部屋ごとの様子(家にいる/おでかけ中・していることの種類・気分の種類) | `{dra:{at:'home',doing:'read',mood:'happy'}}` |
| 部屋に置いた家具の key(オクリモノの家具。`mh_assistant_life_room_v1` の `put` の天井・壁・床の3つだけ) | `{atsu:{c:'lantern',w:null,f:'sofa'}}` |
| (❻が A のとき)育ち方の★の数と得意(キズナの `mh_assistant_life_grow_v1` から、★の数と得意の種類だけ) | `{mua:{beat:3,type:'exact'}}` |
| 控えの時刻 | サーバが付ける `updated_at` |

入れないもの: 仲良し度の数字・持ち物・お金・フレンドの一覧・端末の ID を見せる表示・自由な文。
控えを読むときは端末で正規化する(知らない id・知らない種類・長すぎる値は捨てる)。**画面に出す文は、こちらの台本と決まった部品だけ**なので、控えを書き換えられても変な文は出ない。

両方がいるときだけ動く形(リアルタイム)は、相手がいないと何も起きず、置き手紙も作れないので、おすすめしない(❶)。

---

## 3. 何が得られるか(控えめ)

| 行動 | 得られるもの | 1日の上限 |
| --- | --- | --- |
| 自分の助手を送り出して場面を見る | 行った助手の仲良し度 +10(1人ずつ)/2人で行ったら2人の友情Lv +4 | 送り出すのは1日3回・同じ家は1日1回 |
| 〃 のおみやげ | 思い出アルバムの写真1枚「あおいさんの家で」(その家で初めてのとき)+ビートP 100 | ビートPは1日 300P まで |
| フレンドの助手が来た場面を見る | 迎えた自分の助手の仲良し度 +6 | 来てくれるのは1日2人まで |
| お礼を返す | なし(返すだけ。回して得をする形にしない) | 1通に1回 |
| 顔なじみ(同じ相手の助手と会った回数) | 3回・10回・30回で、その2人の会話が少し親しくなる(数字は増えない) | — |

- ダイヤ・ブリーダーP・道具・家具は配らない(オクリモノの道具の流れを動かさない)
- 友情Lv はこちらの助手どうしのまま。フレンドの助手とのあいだは「顔なじみ」の回数だけ(友情Lv の表は触らない)
- 上がる値の演出はハナビの3段(小=行動)にそろえる。仲良し度はピンクのハート、友情Lv はオレンジの手

---

## 4. 1日の回数・フレンドの選び方

- 日の区切りは**朝4時(日本時間)**。`assistantLifeDayKey`(中は `jstDayKey4`)を使う
- 行く: 1日3回まで・同じ家は1日1回。一覧は最近開いた順。控えが14日より古い家は出さない
- 来る: 1日2人まで。自分の家を開いたときに、7日以内に控えを送っているフレンドから選ぶ。同じフレンドの助手は1日1人
- 行き来を切にしている人・ブロック/解除した人・「来ないようにした人」は、一覧にも来客にも出さない

---

## 5. サーバー(Supabase・ランキングと同じプロジェクト zrzevudkbgtxlbvmuziy)

**新しい表を2つ足すだけ。** 既存の表(`rankings`・`breeder_profiles`・`friend_*` など)・ランキング・送る処理は触らない(`friend_links` は読むだけ)。
SQL は**まだ流さない**。社長の「これで作る」のあと、フレンドのときと同じく TEST(最後に rollback)→ 本番 → VERIFY の順で流す(足すだけなので窓口の判断で流してよい決まり)。

| 表 | 中身 |
| --- | --- |
| `assistant_life_friend_houses` | 1人1行の家の控え(`house` JSON・2,000字まで)と、行き来を入にしているか(`open`) |
| `assistant_life_friend_switch` | 1行だけ。`mode` = on/thin/off(0-4 の逃げ道) |
| `assistant_life_friend_visits` | 行き来の記録。`kind` = `go`(送り出した・書くのは行った人)/`come`(相手の助手が自分で来た・書くのは来られた人)。決まった一言の番号・お礼の番号 |

守り(表の側):
- **端末に消す権限は与えない**。控えは上書き、行き来は1日1行ずつ足すだけ。8日たった行き来の行は、表の見張り(security definer)がときどき片づける
- 行き来は**承認済みのフレンドどうし**で、両方が `open` のときだけ入る(足すときに `friend_links` を見る)
- 1日の上限を表の側でも数える(行くは1人1日3回・同じ家は1日1回、来るは1人1日2人)
- 書いたあと変えられるのは「お礼」の列だけ(列ごとの権限+見張り)
- 自由な文の列は無い(一言は番号)

```sql
-- 助手ライフ: フレンドの家の控えと行き来の記録(足すだけ)。案。まだ流さない。
-- 既存の表には触らない。friend_links は読むだけ。DELETE の権限は与えない。
begin;

do $$
begin
  if to_regclass('public.friend_links') is null then
    raise exception 'public.friend_links がありません(フレンドの SQL が先)';
  end if;
  if to_regclass('public.assistant_life_friend_houses') is not null
     and not exists (select 1 from information_schema.columns where table_schema='public'
                     and table_name='assistant_life_friend_houses' and column_name='house') then
    raise exception 'assistant_life_friend_houses が別の形で既にあります';
  end if;
  if to_regclass('public.assistant_life_friend_visits') is not null
     and not exists (select 1 from information_schema.columns where table_schema='public'
                     and table_name='assistant_life_friend_visits' and column_name='kind') then
    raise exception 'assistant_life_friend_visits が別の形で既にあります';
  end if;
end $$;

-- ⓪ 逃げ道のスイッチ(1行だけ。窓口が update で切り替える。端末は読むだけ)
create table if not exists public.assistant_life_friend_switch (
  id   smallint not null default 1,
  mode text     not null default 'on',
  updated_at timestamptz not null default now(),
  constraint alf_switch_pkey primary key (id),
  constraint alf_switch_one check (id = 1),
  constraint alf_switch_mode check (mode in ('on','thin','off'))
);
insert into public.assistant_life_friend_switch (id, mode) values (1, 'on') on conflict (id) do nothing;

-- ① 家の控え(1人1行・上書き)
create table if not exists public.assistant_life_friend_houses (
  breeder_id text        not null,
  open       boolean     not null default true,
  house      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint alf_houses_pkey primary key (breeder_id),
  constraint alf_houses_id_shape check (length(breeder_id) between 1 and 100),
  constraint alf_houses_house_object check (jsonb_typeof(house) = 'object'),
  constraint alf_houses_house_size check (length(house::text) <= 2000)
);
comment on table public.assistant_life_friend_houses is
  '助手ライフの家の控え(会った助手・部屋の様子・家具の id)。フレンドが訪ねるときに読む。1人1行を端末が上書きする。';

create or replace function public.alf_houses_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists alf_houses_touch on public.assistant_life_friend_houses;
create trigger alf_houses_touch before insert or update on public.assistant_life_friend_houses
  for each row execute function public.alf_houses_touch();

-- ② 行き来の記録(1日1行ずつ足すだけ)
create table if not exists public.assistant_life_friend_visits (
  id          bigint generated always as identity,
  kind        text        not null,
  visitor_id  text        not null,
  host_id     text        not null,
  day         date        not null,
  assistants  text[]      not null,
  word        smallint    not null default 0,
  thanks      smallint,
  created_at  timestamptz not null default now(),
  constraint alf_visits_pkey primary key (id),
  constraint alf_visits_kind check (kind in ('go','come')),
  constraint alf_visits_id_shape check (length(visitor_id) between 1 and 100 and length(host_id) between 1 and 100),
  constraint alf_visits_not_self check (visitor_id <> host_id),
  constraint alf_visits_assistants check (
    cardinality(assistants) between 1 and 2
    and array_to_string(assistants, ',') ~ '^[a-z]{2,20}(,[a-z]{2,20})?$'),
  constraint alf_visits_word check (word between 0 and 31),
  constraint alf_visits_thanks check (thanks is null or thanks between 0 and 31)
);
comment on table public.assistant_life_friend_visits is
  '助手ライフの行き来。go=送り出した(行った人が書く)/come=相手の助手が自分で来た(来られた人が書く)。一言とお礼は決まった文の番号。';

create unique index if not exists alf_visits_once_a_day
  on public.assistant_life_friend_visits (kind, visitor_id, host_id, day);
create index if not exists alf_visits_host_idx on public.assistant_life_friend_visits (host_id, day);
create index if not exists alf_visits_visitor_idx on public.assistant_life_friend_visits (visitor_id, day);

create or replace function public.alf_visits_guard()
returns trigger language plpgsql as $$
declare today date := (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date;
begin
  if tg_op = 'INSERT'
     and coalesce((select mode from public.assistant_life_friend_switch where id = 1), 'thin') = 'off' then
    raise exception '行き来はいま止めています';
  end if;
  if tg_op = 'UPDATE' then
    -- 変えてよいのはお礼だけ
    if (new.kind, new.visitor_id, new.host_id, new.day, new.assistants, new.word, new.created_at)
       is distinct from (old.kind, old.visitor_id, old.host_id, old.day, old.assistants, old.word, old.created_at) then
      raise exception 'お礼のほかは変えられません';
    end if;
    return new;
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
  if new.kind = 'go' and (select count(*) from public.assistant_life_friend_visits v
      where v.kind = 'go' and v.visitor_id = new.visitor_id and v.day = new.day) >= 3 then
    raise exception '今日はもう3回行きました';
  end if;
  if new.kind = 'come' and (select count(*) from public.assistant_life_friend_visits v
      where v.kind = 'come' and v.host_id = new.host_id and v.day = new.day) >= 2 then
    raise exception '今日はもう2人来ました';
  end if;
  new.thanks := null;
  new.created_at := now();
  return new;
end $$;
-- 8日たった行き来の行を、足すときにときどき(100回に1回)まとめて片づける。この表の中だけ
create or replace function public.alf_visits_tidy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.01 then
    delete from public.assistant_life_friend_visits
      where day < (now() at time zone 'Asia/Tokyo' - interval '4 hours')::date - 8;
  end if;
  return null;
end $$;
revoke all on function public.alf_visits_tidy() from public, anon, authenticated;
drop trigger if exists alf_visits_tidy on public.assistant_life_friend_visits;
create trigger alf_visits_tidy after insert on public.assistant_life_friend_visits
  for each statement execute function public.alf_visits_tidy();

drop trigger if exists alf_visits_guard on public.assistant_life_friend_visits;
create trigger alf_visits_guard before insert or update on public.assistant_life_friend_visits
  for each row execute function public.alf_visits_guard();

-- ③ 権限(読む・足す・控えの上書き・お礼の列だけ。消す権限は無し)
alter table public.assistant_life_friend_switch enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_switch' and policyname='alf switch read') then
    create policy "alf switch read" on public.assistant_life_friend_switch for select using (true);
  end if;
end $$;
grant select on public.assistant_life_friend_switch to anon, authenticated;
revoke insert, update, delete on public.assistant_life_friend_switch from anon, authenticated;
alter table public.assistant_life_friend_houses enable row level security;
alter table public.assistant_life_friend_visits enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_houses' and policyname='alf houses read') then
    create policy "alf houses read"   on public.assistant_life_friend_houses for select using (true);
    create policy "alf houses insert" on public.assistant_life_friend_houses for insert with check (true);
    create policy "alf houses update" on public.assistant_life_friend_houses for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assistant_life_friend_visits' and policyname='alf visits read') then
    create policy "alf visits read"   on public.assistant_life_friend_visits for select using (true);
    create policy "alf visits insert" on public.assistant_life_friend_visits for insert with check (true);
    create policy "alf visits thanks" on public.assistant_life_friend_visits for update using (true) with check (true);
  end if;
end $$;
grant select, insert, update on public.assistant_life_friend_houses to anon, authenticated;
revoke delete on public.assistant_life_friend_houses from anon, authenticated;
grant select, insert on public.assistant_life_friend_visits to anon, authenticated;
grant update (thanks) on public.assistant_life_friend_visits to anon, authenticated;
revoke delete on public.assistant_life_friend_visits from anon, authenticated;

commit;
```

通信の量は0章。「🏘 フレンド」を開いたときと1日1回の来客えらびに、変わった家の控えだけまとめて読む(`breeder_id=in.(…)&updated_at=gt.前回`・30分は読み直さない)/自分の控えは10分に1回まで・同じなら送らない/HOME と家を開いたときに自分あての行き来を読む(`host_id=eq.自分&day=gte.7日前`・30分は読み直さない)。
表が無い環境では、今のフレンドと同じく「準備中」にして、ページを閉じるまで通信しない。

**限界**(フレンドの設計書 3 と同じ): ログインが無いので、ID を知っている人のなりすましまでは防げない。防いでいるのは「消せない」「フレンドどうしだけ」「1日の上限」「自由な文が無い」「変えられるのはお礼だけ」の5つ。

---

## 6. 端末の保存(新しいキーを足すだけ)

既存の `mh_*` は変えない。読み込みは必ず正規化の関数を通し、無い・壊れているときは既定値。

| キー | 中身 | 既定 |
| --- | --- | --- |
| `mh_assistant_life_friend_v1` | 今日(朝4時区切り)に行った回数・行った家・受け取ったおみやげの P・見た置き手紙の id・送った控えの時刻 | `{ day: null, went: {}, beatP: 0, seen: [], sentAt: 0 }` |
| `mh_assistant_life_friend_settings_v1` | 行き来する(入/切)・来ないようにした人の一覧(最大100人) | `{ open: true, muted: [] }` |
| `mh_assistant_life_friend_known_v1` | 顔なじみの回数(`自分の助手|相手の呼び名の id|相手の助手` → 回数・最大300組) | `{}` |
| `mh_assistant_life_friend_intro_v1` | はじめての案内を見たか | `false` |

写真は今の思い出アルバムの形に「フレンドの家で」の種類を足す(写真の保存キーは変えず、項目を足す形)。
ランキング・チャレンジモードの記録には何も書かない。

---

## 7. いたずら・荒らし・個人情報の対策

| 心配 | 対策 |
| --- | --- |
| 相手のセーブを書き換える | **相手の端末・保存には何も書かない**。表に残すのは「自分がしたこと」の記録だけで、相手の端末はそれを読んで自分の掲示板に出すかを自分で決める |
| 知らない人が来る | 承認済みのフレンドだけ(端末でも表でも確かめる)。解除・ブロックで止まる |
| ひどい文を送る | 自由に書ける所が無い。一言とお礼は決まった文(12種類・6種類)から選ぶだけ |
| 何度も来る・通知を荒らす | 1日の上限(行く3回・同じ家1回・来る2人)を端末と表の両方で数える。知らせは1日1回まとめて置き手紙に |
| 来てほしくない | 設定「フレンドの助手が遊びに来る」切/人ごとに「来ないようにする」(相手には知らせない・いつでも戻せる)⑦⑧ |
| 見せたくない | 設定「家の様子をフレンドに見せる」切で控えを送らない(すでに送った控えは中身を空にして上書き) |
| 個人情報 | 画面に出すのは**呼び名**(今のフレンドの一覧と同じもの)と、助手・部屋・家具・気分の種類だけ。フレンドコード・ID・遊んでいる時間・プロフィールの性別などは出さない |
| 控えの中身をいじる | 端末で正規化してから使う。出す文はこちらの台本だけ |

---

## 8. 台詞(作るとき。コトバ・ツムギへの注文の目安 約130本)

| 種類 | 本数 |
| --- | --- |
| 訪ねた家での場面(自分の助手8人 × 6本。相手の助手は `{f}` で差しこむ) | 48 |
| 2人で行ったときの場面(8人 × 2本) | 16 |
| 来てくれた助手を迎える(8人 × 4本) | 32 |
| 同じ助手どうしが会ったとき(❹で A のとき。8人 × 2本) | 16 |
| 置き手紙の決まった一言 12・お礼の一言 6 | 18 |

- 相手の助手の呼び方は「あおいさんのドラ」。プレイヤー(自分)は `{name}`。助手やマスモンを「子」と呼ばない
- 性格のくせは今のまま(みゅあの「ぢゃん・まぢ」など)。えるびんは実在の人の私生活を書かない
- よその家なので、けんか・言い合いは起こさない

---

## 9. 他の部署との差し込み口(すり合わせ)

| 部署 | 使う所 | 状態 |
| --- | --- | --- |
| (返事) | キズナ: 3点ともぶつからない。けんか中は `assistantLifeRelPending()`(56-assistant-life-rel.jsx)を読むだけで使う。★は `mh_assistant_life_grow_v1`(予定)・見せるのは★の数と得意だけ/オクリモノ: 家具は段階Bで作る。key と `mh_assistant_life_room_v1` の `put` を控えに写せば足りる。道具・家具を配らない形に賛成 | 2026-11-08 |
| ナカヨシ7(地図と施設) | 家のアイコンの列の5つ目「🏘 フレンド」/居間の扉の来客/部屋の行き先の札(場所の一覧に `friend` を足す)/掲示板に1件。町の地図・HOME の施設の顔の列は増やさない | 送った(2026-11-08)・返事待ち |
| オクリモノ(道具と家具) | 控えに家具の key を写して見せるだけ(相手の家具は動かさない)。おみやげで道具・家具を配らない | 返事あり・賛成 |
| キズナ(けんかと育つ助手) | けんか中(💢)の助手は行けない/よその家ではけんかしない/育ち方の★を控えに写すかは❻ | 返事あり・賛成 |
| ハナビ(上がる値の演出) | 3段の「小」と色・印をそのまま使う | 作るとき |

---

## 10. 段階

| 段階 | 中身 |
| --- | --- |
| 1 | 表2つ・控えを送る・「行く」(②③④⑥)・置き手紙(⑦)・設定(⑧)・HOME の印(⑤) |
| 2 | 「来る」(フレンドの助手が自分で来る)・顔なじみ・同じ助手どうしの場面 |
| 3 | 台詞の積み増し(コトバ・ツムギ)・季節の家具が控えに出る など |

---

## 11. 社長に選んでもらう所(A がおすすめ)

| | 選ぶこと | A(おすすめ) | B |
| --- | --- | --- | --- |
| ❶ | 相手がいないとき | 控え(最後に開いたときの家)を訪ねる。いつでも行ける | 2人とも開いているときだけ行ける |
| ❷ | 行き方 | 自分で「どの家へ・だれが行くか」を選んで送り出す(1日3回) | 助手が自分でときどき行く(選べない・知らせだけ) |
| ❸ | フレンドの助手が来るのは | 相手が送り出したとき+相手の助手が自分でたまに来る(1日2人まで) | 相手が送り出したときだけ |
| ❹ | 同じ助手どうし(自分のみゅあと、あおいさんのみゅあ) | 会う。「もうひとりのあたし！？」のような場面がある | 会わない(同じ助手は一覧で選べない) |
| ❺ | おみやげ | 写真1枚+ビートP 100(1日 300P まで) | 写真だけ |
| ❻ | 控えに育ち方の★(キズナ)も写して見せる | 写す(「あおいさんのみゅあ ビートの腕前★3」) | 写さない(部屋・家具・気分だけ) |
