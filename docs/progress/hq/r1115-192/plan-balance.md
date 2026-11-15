# r1115-192(前半) サクセスのバランス研究基盤 — 作り方の案

- 作成: 2026-11-15 18:18(JST)・開発部 クラフト45
- 基準: main `cfa4a152460108c43b2fec99686655d80da401a6`
- 依頼文の原文: [prompt.md](prompt.md)(前半「サクセスAI検証・バランス研究基盤」だけ。UI 検証の案はクラフト46 が別に作る)
- この資料は**案**。コードはまだ書いていない。ゲーム本体・保存・ランキング・Supabase・バランス数値には触れていない
- 小さな試しの計測だけ行った(下の「計測」)

## 1. 結論(先に)

- **作れる。** 計算の芯(`monhero-success.js`)と助手マスモンの対戦エンジンを Node で回す土台は既にあり、
  100回の試しは約3秒で終わった。10万回は **4並列で約15〜20分**(1本なら約55分)の見込み
- **ただし、そのままでは大会の勝率が実機とずれる。** 既存の `monsuc-balance-sim.js` の試合の渡し方が
  ゲーム本体(`56-monhero-success-r3-store.jsx` の `msxR3Fight`)と違う(下の 4-③)。研究基盤ではゲーム本体の関数を切り出して使う形に直す
- **調整案の差し替え**は、アシスト表は芯の入口(`deps.assist`)で安全に差し替えられる。修行・トレーニングの成長量は
  芯の中の固定の表なので、「芯の写しの文字を置き換える」方式(既存の balance-sim と同じ・元の文字が無ければ止まる)になる。
  本体に差し替えの口を足すかは社長に決めてもらう(6.)
- Claude API は**最後に1回の分析(3段の呼び出し)だけ**。新しいキーは作らず、Supabase の専用 Edge Function から今の Secrets のキーで呼ぶ(窓口と社長の決定)。1回の分析は約 0.5〜1.1ドルの見込み・1日3回/$4・月$30 まで。API が無くても統計レポートは全部出る

## 2. 既にある物 / 足りない物(main `cfa4a152`)

| 依頼文の項目 | 既にある物 | 足りない物 |
| --- | --- | --- |
| 実際の育成計算を使う | `tools/success/load.js`(芯と依存をゲームと同じ形で読む) | なし(そのまま使う) |
| 同じ乱数IDで再現 | 芯の乱数は `rngOf(育成id, ターン, 用途)` で決まる。`success-soak-check.js` が「同じ id で同じ結果」「中断→再開で同じ」を見ている | 研究基盤の結果に対する再現の確認(同じ id を2回回して一致) |
| 戦略7種 | `monsuc-balance-sim.js` に重みくじの育て方(トレーニング中心・修行中心・大会中心・ほったらかし等)と `--matrix`(同じ子・同じ編成で並べる) | 7種を名前つきで定義(4-②)。友情タッグ重視・期待値優先・体力管理は新しく書く |
| 編成(低・中・高・特化・分散・タッグ・アシスト) | balance-sim の編成 `base` / `box-low/mid/high/max`(10周点検の箱)/ `real-B/A/S` / `buy:*`(アシストの買い方)/ `max` / `tsuika` | 「特定能力に特化」「得意の分散」「一般的なプレイヤー」を名前つきで足す |
| 助手ごとの結果 | 芯は6人の助手を受ける(soak が6人を回している) | balance-sim は `mua` 固定。助手を条件に加える |
| 記録の項目 | 芯の `s.log`(トレーニング・大成功・失敗・サボり・休む・遊ぶ・通院・修行・習得・タッグの回数・勝ち負け) と `evaluate`(総合力・評価) | 1回ずつの行(JSONL)に落とす。イベントによる能力の動き・大会の敗退理由(どの大会の何戦目・相手)は道具側で前後を比べて取る |
| 100→1,000→1万→10万 | なし(balance-sim は 1条件 N 回の中央値を出すだけ) | 段階の実行・割り当て表・層化・サンプル不足の検出 |
| 性能・安定性 | soak が値の範囲(NaN・負・上限超え)・46ターンで終わるか を見ている | 進捗・時間・メモリ・分割保存・途中からの再開・失敗した id の記録・ワーカー並列 |
| 大会を実対戦で | balance-sim・success-sim・cap-sim が `tools/masmon-battle/load.js` の対戦エンジン(ゲームと同じ `assistant-masmon-battle.js`)で勝敗を出している | 渡し方をゲームと同じにする(4-③) |
| 調整案の比較 | balance-sim の `VARIANTS`(芯の写しの文字置き換え)・`monsuc-cap-sim.js`・`monsuc-shugyo-assist-cmp.js`(アシスト表を差し替えて1回の修行を比べる) | 「現行 / 修行案 / アシスト案 / トレーニング案」を検証用シナリオとして名前つきで持ち、現行値と混ざらない表示にする |
| 問題の自動検出(10項目) | なし | ローカル集計でしきい値つきの検出(5.) |
| Claude API 分析 | なし | 集計 JSON → 要点だけ送る小さな呼び出し・キャッシュ・費用上限(7.) |
| 日本語レポート | balance-sim は表を標準出力に出すだけ | Markdown + CSV + JSON |

## 3. 再利用する既存ツール

| ツール | 使い方 |
| --- | --- |
| `tools/success/load.js`(`loadDeps`・`depsFor`・`sliceConst`) | 芯の読み込み。`depsFor(deps, { assist: 案の表 })` でアシスト表を差し替える |
| `tools/masmon-battle/load.js` | 対戦エンジンと技の表 |
| `tools/success/monsuc-balance-sim.js` | 1周の回し方(`runLap`)・編成の作り方(`teamOf`)・案の文字置き換え(`coreOf`)を**切り出して共通部品にする**(本体の balance-sim の出力は変えない) |
| `tools/success/monsuc-play10.js` の `LAPS`・`boxSeed` | 「一般的なプレイヤー」の編成と育て方の元 |
| `tools/success/success-soak-check.js` | 研究基盤を作ったあとも、そのまま既存の検査として通す(値の範囲の見張りの考え方を借りる) |
| `monster-hero/src/parts/56-monhero-success-r3-store.jsx` の `msxR3Fight`・`MSX_R3_GEAR`、`56-monhero-success-cup.jsx` の `MONSUC_MATCH_RULE` | `sliceConst` で切り出して、試合の入力をゲームと同じに作る(本体は書き換えない) |

新しく置く物(予定・すべて `tools/success/` の下。ゲーム画面には何も足さない):
`balance-lab/`(戦略・編成・シナリオの定義、ワーカー、集計、検出、レポート、API 分析)と入口 `monsuc-balance-lab.js`、
その検査 `monsuc-balance-lab-check.js`(100回で再現・集計の一致・NaN なし を数秒で見る)。

## 4. 確かめたこと

### ① 既存の試算ツールで何ができるか

- `success-sim.js` … 編成ごとのランク分布・忠誠・タッグ・出来事・大会。1回が重め(100回指定で約2分。編成ごとに回すため)
- `success-soak-check.js` … 48通りを最後まで回して壊れないかを見る検査(約6.5秒)
- `monsuc-balance-sim.js` … 10周点検と同じ周を芯だけで N 回。案の比較・`--matrix` でトレーニング中心と修行中心の比較(r1115-173 の数字はこれ)
- `monsuc-cap-sim.js` … 上限アップを入れた写しで何代も育てる試算
- `monsuc-play10.js` … 本物のブラウザで10周通す点検(画面。研究基盤では使わず、周の設計だけ借りる)

### ② 戦略7種を現仕様の行動で書けるか → **書ける(期待値戦略に1つ注意)**

芯の `peek(s)` が、そのターンに選べる行動(`can`: train / rest / play / cup / shugyo / clinic、条件つきで cond / retry)、
トレーニング6札ごとのタッグ・失敗率・大成功率・上がり幅の倍率、修行の残りチケットと覚えられる技、出られる大会を返す。
選べない行動は `can` に出ないので、現仕様で不可能な行動は選ばれない。強制大会は芯がターンの進みで `s.battle` を立てるので、
戦略の側で避けられない(そのまま戦う)。

| 戦略 | 書き方 |
| --- | --- |
| トレーニング重視 | 体力3割未満は休む、ほかはトレーニング(得意の能力) |
| 修行重視 | チケットがあり体力が足りれば修行(覚えられるいちばん高いランク)、無ければトレーニング |
| バランス型 | 重みくじ(いまの balance-sim の「バランス」) |
| 友情タッグ重視 | `peek` の札のうちタッグの数が多い札を選ぶ |
| 体力管理重視 | 体力5割未満で休む・ストレスが高ければ遊ぶ |
| 大会勝利重視 | 出られる大会に出る・その前のターンは休んで体力を戻す |
| 各ターンの期待値優先 | `peek` の率(成功・大成功・失敗)と上がり幅から期待値を計算して最大の行動 |

**注意: 期待値戦略を「全部の行動を試しに打って、いちばん良かったものを選ぶ」で作ってはいけない。**
芯の乱数は (育成id, ターン, 用途) で決まるので、試し打ちの結果はそのまま本番の結果になる(未来が見えるズルの戦略になる)。
`peek` の率から計算する形にする。

### ③ 大会を実際の対戦計算で決められるか → **決められる。ただし渡し方をゲームに合わせる必要がある**

既存の試算は、ゲームと同じ対戦エンジン(`assistant-masmon-battle.js`)を使っている。しかしゲーム本体の `msxR3Fight` と比べて、
balance-sim の試合の入力に次の違いがある(読んだだけで確かめた。数字のずれの大きさはまだ測っていない):

| 項目 | ゲーム本体 | balance-sim |
| --- | --- | --- |
| 試合の上乗せ(編成の試合型アシスト・特別な1話) | `buffs: { A: battleBuffs(s) }` | `buffs: battleBuffs(s)`(エンジンは `buffs.A` を読むので**届いていない**) |
| 試合の決まり | `MONSUC_MATCH_RULE`(能力の上限 99999・引き分けは相手の勝ち) | 渡していない |
| 覚醒・適性の上がり | `awake`・`aptUp` を渡す | 渡していない |
| 作戦の値 | `MSX_R3_GEAR`(5/10/20/30/40) | `GEAR[期][2]`(同じ値) |
| 乱数の種の形 | `id:ターン:種類:retry:round:0:again` | `id:ターン:種類:round:相手の番号` |

研究基盤では `msxR3Fight` をゲームの parts から切り出して使い(本体は変えない)、ゲームと同じ入力で戦う。
切り出せなかったときは「育成計算のみ(大会は固定シナリオ)」として結果を分けて出す(依頼文 5. のとおり混ぜない)。
手動で戦う試合は再現できないので、すべてオート相当として明記する。
また、既存の r1115-173 の数字(大会の勝率)は上乗せが届いていない計算で出ている可能性があるので、研究基盤で測り直して並べる。

### ④ 調整案を本体を変えずに差し替える口があるか

| 調整の種類 | 差し替えの口 | 安全さ |
| --- | --- | --- |
| アシスト効果 | **ある**: `create(deps)` の `deps.assist`(`monhero-success-assist.js` の表を写して値を変えて渡す。既に `monsuc-shugyo-assist-cmp.js` がこうしている) | 安全(本体を読むだけ) |
| 修行の効果(`SHUGYO`) | **無い**: 芯の中の固定の表 | 芯の写しの文字置き換えならできる(元の文字が無ければ止まる。芯が変わると案を直す手間がある) |
| トレーニングの成長量(`TRAIN_LV`・`GROW_BY_SPECIES` など) | **無い**: 同上 | 同上 |

本体を変えずに比較する方法は「写しの置き換え」しかない。きれいにするなら、芯の `create(deps)` に
「表を上書きする口(`deps.tune`)」を足す変更が要る(芯の数値も動きも変えないが、本体のファイルを触る)。→ 6. で決めてもらう

### ⑤ 100回の実測と10万回の見積り(このコンテナ・4コア)

| 計測 | 結果 |
| --- | --- |
| balance-sim 10周 × 1回(読み込み込み) | 1.0秒・メモリ 196MB |
| balance-sim 10周 × 10回 = 100回 | 4.0秒 |
| balance-sim 10周 × 50回 = 500回 | 16.6秒・メモリ 331MB(結果を全部持つので増える) |
| → 1回あたり | **約31ミリ秒**(試合込み) |
| `peek` の先読み(状態の写し 0.03ms・1手 0.23ms・状態 約4KB) | 期待値戦略は `peek` で計算するので、ほぼ上乗せなし |

| 規模 | 1本 | 4並列(ワーカー) |
| --- | --- | --- |
| 100回 | 約3秒 | — |
| 1,000回 | 約30秒 | 約10秒 |
| 1万回 | 約5分 | 約1.5〜2分 |
| 10万回 | **約52分** | **約15〜20分** |

メモリ: 1回の行を JSONL へ1行ずつ書き出し、持つのは集計だけにすれば、ワーカー1本 200〜300MB・4本で約1.2GB の見込み。
10万回の生データ(1行 約1KB)は約100MB。リポジトリには入れず、作業用フォルダに置く(要約の JSON・CSV・Markdown だけ資料に残す)。
期待値戦略や上限付近の育成で1回が重くなる場合は、1万回の段で測り直して見積りを直す。

### ⑥ Claude API(窓口と社長の決定 2026-11-15: 新しいキーは登録しない・Supabase の専用 Edge Function から使う)

新しいキーは作らない。いまの Supabase の Secrets にある `ANTHROPIC_API_KEY`(助手のおしゃべり等と同じ)を、
**サクセス分析専用の Edge Function `monsuc-balance-analyze`** を1つ足して、そこからだけ使う。社長の作業はなし(配るのは窓口)。
形は既にある「モンヒロビートの異常レポート」(`rhythm-anomaly-report`: Vault の合言葉 + pg_net で関数を呼ぶ)にそろえる。
**API が無くても、集計・問題の検出・日本語レポートは全部ローカルでできる前提は変えない**(分析の欄が「未実行」になるだけ)。

#### 流れ(合言葉がリポジトリ・会話・レポートに一度も出ない形)

```
研究基盤(ローカル)  集計 → analysis-request.json(集計値・代表ケースだけ・100KB まで・入力のハッシュつき)
        ↓ 窓口が SQL で渡す(execute_sql)
DB      monsuc_analyze_enqueue(入力) … 上限を確かめ、表 monsuc_analyze_jobs に1行入れ、
        pg_net で関数を呼ぶ(ヘッダー x-monsuc-analyze-token = Vault の値。値は DB の外へ出ない)
        ↓
関数    monsuc_analyze_token_ok で合言葉を照らす → 表から入力を読む → Claude を呼ぶ → 結果・使用量・額を同じ行へ書く
        ↓ 窓口が SQL で結果を読む(select … from monsuc_analyze_jobs where id = …)
研究基盤(ローカル)  analysis-result.json を受けてレポートの「分析」の欄に差し込む(実際に呼んだ結果だけ。無ければ「未実行」)
```

- 合言葉: 窓口が SQL の中で乱数から作って Vault に入れる(`vault.create_secret` は値を返さない)。照らすのも DB の中(`monsuc_analyze_token_ok`)。
  関数は値を受けて照らすだけで、ログに書かない。研究基盤の道具は合言葉を持たない(SQL を窓口に渡すだけ)
- 道具に持たせる別案(推奨しない): 合言葉の値をクラウドの環境のネットワークの秘密にして、プロキシがヘッダーへ付ける。
  値を一度だれかがフォームに入れる必要があり、社長の作業が発生する。窓口が会話で値を見ることにもなる
- 関数は `verify_jwt` を外す(rhythm-anomaly-report と同じ。合言葉で守る)。ゲームからは呼ばない・CORS も開けない

#### 関数の入出力

| | 中身 |
| --- | --- |
| 入力(表の `input` 列。関数への POST は `{ job_id }` だけ) | `kind: 'monsuc_balance'`・`base_sha`・芯の `VERSION`・試行数と条件の内訳・戦略/編成/助手別の分位点・検出した問題の上位20件(条件・頻度・代表の乱数ID)・調整シナリオとの差(検証用と明記)。**生データ・ゲームのコード・保存データ・ランキング・個人の情報は入れない**(研究基盤の側で項目を決め打ちし、決めた項目以外は送らない) |
| 出力(同じ行の `result` 列) | `{ overview, strategies, anomalies, proposals, side_effects, unverified }`(日本語の文。調整案は「提案」・数値は候補として)+ `usage`(モデルごとの入力・出力・キャッシュ読みのトークン)+ `usd_calc` |
| 触る物 | 表 `monsuc_analyze_jobs` と照合の関数だけ。保存データ・ランキング・ほかの表には触らない(service_role でも、使う RPC をこの2つに限る) |

#### モデルの使い分け(関数の中で順に)

| 段 | モデル | 仕事 | 1回の見積り |
| --- | --- | --- | --- |
| 1 | Haiku 5.5($0.10/$0.50) | 問題の候補20件を1件ずつ短く要約し、仕様上の差か・実装の不具合の疑いか・未判定か の下仕分け | 約$0.01〜0.03 |
| 2 | Sonnet 5.5($2/$10) | 戦略・編成・助手の優劣の説明、レポートの本文 | 約$0.15〜0.3 |
| 3 | Opus 5.5($4/$20) | 調整案3〜5件と、改善・悪化する指標・副作用の洗い出し | 約$0.3〜0.8 |
| 計 | | | **約$0.5〜1.1/回**(考える分の出力を多めに見て、1回の上限 $1.5) |

(料金は 100万トークンあたり 入力/出力。1回の入力は合わせて約2〜4万トークン・出力は約1〜2万トークンで見積り)

#### 上限・キャッシュ・記録

- 1回の上限: 呼ぶ前に入力のトークンを数えて見積る(`count_tokens`)。見積りが $1.5 を超えたら呼ばずに `status = 'over_budget'`。`max_tokens` も段ごとに決める
- 1日の上限: **3回・$4**(朝4:00 JST 区切り。ゲームの日替わりと同じ)/ 月の上限: **$30**。Secrets の数値で変えられる(0 で止まる)
- 助手のおしゃべりと同じキーを使うので、分析は**別の表で数え**、おしゃべりの回数・上限には混ざらない
- 同じ入力(ハッシュが同じ)なら、終わった行の結果を返して呼ばない
- 固定の前置き(仕様の要約・出力の形)を先頭に置いてプロンプトキャッシュ(3段で同じ前置き)
- 額は3つに分けて残す: `usd_est`(呼ぶ前の見積り)/ `usd_calc`(返ってきた使用量から計算)/ `usd_console`(Console で確かめた額。人が書き込む欄・空なら「未確認」)

#### 流す SQL(案。窓口が PR 3 で流す。既存の表は変えない)

```sql
-- サクセスの分析(r1115-192)。ゲームからは読めも書けもしない(RLS を入れてポリシーを作らない)。
create table if not exists public.monsuc_analyze_jobs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date,
  input_hash text not null,
  input jsonb not null,
  status text not null default 'queued',  -- queued / running / done / error / over_budget / refused
  result jsonb,
  usage jsonb,
  usd_est numeric(10,4),
  usd_calc numeric(10,4),
  usd_console numeric(10,4),
  error text
);
create index if not exists monsuc_analyze_jobs_hash on public.monsuc_analyze_jobs (input_hash);
alter table public.monsuc_analyze_jobs enable row level security;

-- 合言葉(値は DB の外へ出さない)
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'monsuc_analyze_token');

create or replace function public.monsuc_analyze_token_ok(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'monsuc_analyze_token' and decrypted_secret = p_token);
$$;

-- 頼む: 上限を確かめて1行入れ、関数を呼ぶ。同じ入力の終わった行があればそれを返す
create or replace function public.monsuc_analyze_enqueue(p_input jsonb, p_day_calls int default 3, p_day_usd numeric default 4, p_month_usd numeric default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  h text := md5(p_input::text);
  old record; calls int; usd_d numeric; usd_m numeric; jid bigint;
begin
  if octet_length(p_input::text) > 100000 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  select id, status into old from monsuc_analyze_jobs where input_hash = h and status = 'done' order by id desc limit 1;
  if found then return jsonb_build_object('ok', true, 'job_id', old.id, 'cached', true); end if;
  perform pg_advisory_xact_lock(hashtext('monsuc_analyze_' || d::text));
  select count(*), coalesce(sum(coalesce(usd_calc, usd_est, 0)), 0) into calls, usd_d from monsuc_analyze_jobs where day = d and status in ('queued', 'running', 'done');
  select coalesce(sum(coalesce(usd_calc, usd_est, 0)), 0) into usd_m from monsuc_analyze_jobs where day >= date_trunc('month', d)::date and status in ('queued', 'running', 'done');
  if calls >= p_day_calls then return jsonb_build_object('ok', false, 'reason', 'day_calls'); end if;
  if usd_d >= p_day_usd then return jsonb_build_object('ok', false, 'reason', 'day_usd'); end if;
  if usd_m >= p_month_usd then return jsonb_build_object('ok', false, 'reason', 'month_usd'); end if;
  insert into monsuc_analyze_jobs (day, input_hash, input) values (d, h, p_input) returning id into jid;
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/monsuc-balance-analyze',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-monsuc-analyze-token', (select decrypted_secret from vault.decrypted_secrets where name = 'monsuc_analyze_token')),
    body := jsonb_build_object('job_id', jid));
  return jsonb_build_object('ok', true, 'job_id', jid, 'cached', false);
end $$;

revoke all on function public.monsuc_analyze_token_ok(text) from public, anon, authenticated;
revoke all on function public.monsuc_analyze_enqueue(jsonb, int, numeric, numeric) from public, anon, authenticated;
grant execute on function public.monsuc_analyze_token_ok(text) to service_role;
```

- `project_url` は Vault に既にある名前を使う想定(rhythm-anomaly-report の cron が使っている物の名前を、窓口が流す前に確かめる。無ければ URL を SQL にじかに書く。URL は秘密ではない)
- 頼む関数 `monsuc_analyze_enqueue` は service_role にも渡さない(窓口が execute_sql で流すときだけ使う。関数からは呼ばない)
- 関数側が結果を書くための RPC(`monsuc_analyze_take`/`monsuc_analyze_finish`)は PR 3 で SQL 本文に足す(行を running にする・結果と額を書く。この表だけを触る)
- 止める: `revoke` 済みなので、関数を配らない・`p_day_calls` を 0 で呼ぶ・Vault の合言葉を消す の どれでも止まる。表を残してもゲームには何も起きない

## 5. 問題の自動検出(依頼文 6.)の作り方

ローカル集計だけで「候補」を出し、判定は人(と API 分析)に任せる。差が大きいだけでは不具合と書かない。

- 戦略・編成・助手の比較は**同じ乱数ID群**のペア比較(差の中央値と、ブートストラップの幅)
- 検出: 総合力の中央値の差が N%超 / 1つの戦略が全条件の X 割で1位 / 能力ごとの伸びの偏り / 同じ条件の総合力のばらつき(変動係数)/
  大会ごとの敗退率の急な上がり / 編成の強さと総合力の差の広がり / アシストの重ねで倍率が想定(表の上限)を超えた回 / 上限・覚醒の有無の差
- しきい値は既定の仮の値で始め、レポートに「仮のしきい値」と書く(社長が決めてよい)
- サンプル不足: 1条件 200回未満は「少ない」と出す

## 6. できない所・危ない所(依頼文と現仕様が合わない所)

| 依頼文 | 現仕様との違い・危ない所 | 案での扱い |
| --- | --- | --- |
| 3-C「休養・遊び・通院」 | 芯にある(rest / play / clinic)。「育成終了ターン」は 46ターン固定か、ゲームオーバーで途中終了 | そのまま記録 |
| 3-C「大会の敗退理由」 | 芯は勝ち負けしか持たない | 道具側で「どの大会・何戦目・相手・体力が尽きたか判定か」を試合の記録から取る |
| 3-A「強制大会」 | 戦略で避けられない(芯がターンで立てる) | そのまま戦う。戦略は大会の前後の休み方だけ変えられる |
| 5.「大会を実際の対戦計算で」 | 手動の試合は再現できない・既存の試算は渡し方がずれている | ゲームの `msxR3Fight` を切り出して使う。オート相当と明記 |
| 3-B「血統」 | 合体の子の種類は芯の `fuse` で決まる。研究基盤の1回の育成には血統の差は入らない(育てる種族の差として扱う) | 種族を条件にする。合体を何代も重ねる試算は `monsuc-cap-sim.js` の範囲 |
| 6-9「上限突破・覚醒・超覚醒」 | 上限アップ(r1115-103)は試算の案のまま。覚醒は芯にある(乱数で起きる) | 覚醒の有無で分けて集計。上限アップは cap-sim の範囲として別にする |
| 7.「修行・トレーニングの調整案」 | 差し替えの口が無い(4-④) | 写しの置き換え。口を足すかは社長が決める |
| 期待値優先の戦略 | 試し打ちは未来が見えるズルになる(4-②) | `peek` の率から計算 |
| 3-B「実際の保存枠データを使わない」 | balance-sim の箱の子は10周点検の作った子(匿名・保存とは無関係) | そのまま使ってよい |
| 10.「CI で通す」 | 10万回は CI に載せない(時間がかかる)。CI には100回の検査だけを足す | `run-checks.js` の表に検査を1行足す(新しいワークフローは作らない) |

## 7. 作業の規模

| PR | 中身 | 会話の時間の目安 |
| --- | --- | --- |
| 1 | 共通部品の切り出し(1周の回し方・編成・ゲームと同じ試合の入力)+ 戦略7種 + 1回ずつの記録(JSONL)+ 100回の検査(再現・集計一致・NaN なし)。balance-sim の今の出力は変えない | 2〜3時間 |
| 2 | 段階の実行(100/1,000/1万/10万)・割り当て表・ワーカー並列・進捗・時間とメモリ・分割保存と再開・失敗 id の記録 / 調整案のシナリオ(アシストは deps、修行・トレーニングは写し)/ 集計・検出・日本語レポート(Markdown・CSV・JSON) | 3〜4時間(10万回の本番 約20分を含む) |
| 3 | 分析の Edge Function `monsuc-balance-analyze`(3段のモデル・上限・キャッシュ・記録・偽物の Claude で動かす検査)+ 表と関数の SQL(窓口が流して配る)+ 研究基盤の `--prepare`/`--attach` と分析つきのレポート。ミハリの確認が要る(Supabase に足すため) | 2〜3時間 |

合計: **PR 3本・会話 1〜2本で 7〜10時間**。PR 1・2 は API なしで完成する。API の費用は1回の分析で約 $0.5〜1.1(上限 1回 $1.5・1日 $4・月 $30)。

## 8. 社長に決めてもらう事

1. **修行・トレーニングの調整案の差し替え方**
   - (推奨)芯の写しの文字置き換え(本体を触らない。既存の balance-sim と同じ方式。芯が変わると案を直す手間はある)
   - 芯に「表を上書きする口(`deps.tune`)」を足す(本体のファイルを触るが、数値も動きも変えない。ミハリの確認が要る)
   - アシストの調整案だけにする(安全な口だけ使う)
2. **大会の勝敗**
   - (推奨)ゲームの試合の関数を切り出して使い、ゲームと同じ入力で戦う(既存の試算とずれた分は並べて出す)
   - 既存の balance-sim と同じ渡し方のまま(r1115-173 の数字と並べやすいが、アシストの試合の上乗せが入らない)
3. **10万回の割り当て**
   - (推奨)層化: 一般的なプレイヤーの編成に厚く(4割)、戦略7種 × 編成8種 × 助手6人の代表条件をペア比較で(1条件 200回以上)
   - 総当たり(戦略7 × 編成8 × 助手6 × 種族6 = 2,016条件 × 約50回。1条件のサンプルが少ない)
4. **Claude API の進め方**(キーの扱いは決定済み: 専用の Edge Function・今の Secrets のキー)
   - (推奨)まず PR 1・2(API なし)を作って結果を見てから PR 3(関数と SQL)
   - PR 1 と並べて PR 3 も作る
4b. **分析の上限**
   - (推奨)1回 $1.5・1日3回/$4・月 $30
   - もっと絞る(1回 $1・1日1回・月 $10)
   - もっと広げる(1日10回/$10・月 $60)
5. **問題の検出のしきい値** … 仮の値で始めてよいか(推奨: 仮で始め、レポートに「仮」と書く)/ 社長が先に決める

## 9. 守ること(作るときも変わらない)

- ゲーム本体・保存・ランキング・Supabase・バランス数値は変えない。調整は提案まで(採用する数値は社長が決める)
- 通常プレイに現れない開発用の道具。ゲーム画面にボタンやメニューを足さない。更新履歴・ヘルプには載せない(開発用のため)
- 新しいワークフロー(yml)を作らない。リポジトリの依存は足さない(API の SDK は Edge Function の中で `npm:@anthropic-ai/sdk` を読む。assistant-chat と同じ)
- API キー・分析の合言葉・デバッグの合言葉・個人の情報を、コード・資料・コミット・レポートに書かない
- 分析の関数は保存データとランキングに触らない(自分の表 `monsuc_analyze_jobs` だけ)
- レポートの最後に「本レポートはゲーム計算の自動シミュレーション結果であり、実機での操作感・画面表示・体感バランスまで確認したものではありません。」と書く
