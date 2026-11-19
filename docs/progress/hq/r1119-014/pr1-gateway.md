# r1119-014 PR1 分析の入り口(Edge Function `analysis-gateway`)— 中身と配りの手順

クラフトくん(開発部)作。正本の案は [README.md](README.md)。ゲーム本体・保存・ランキングには触らない。

## 作った物

| ファイル | 中身 |
|---|---|
| `supabase/functions/analysis-gateway/index.ts` | 入口(Deno)。合言葉・上限を Secrets から読み、DB の関数を呼ぶ |
| `supabase/functions/analysis-gateway/core.js` | 中身。頼みの形の確かめ・見積り・Claude の呼び出し・額の計算 |
| `supabase/migrations/202611190001_analysis_gateway.sql` | 記録の表 `analysis_gateway_usage` と関数4つ(**新しい物だけ**。既存の表は変えない) |
| `tools/analysis/gateway-client.js` | 道具から送る口(`usage` / `message` / `batch-get` / `batch-cancel` / `--dry-run` で見積りだけ) |
| `tools/analysis/analysis-gateway-check.js` | 偽物の Claude・DB で 49 項目を確かめる検査 |

## 決まり(コードの中で守っている)

- 合言葉: ヘッダー `x-analysis-token`。Secrets の `ANALYSIS_GATEWAY_TOKEN`(16文字以上)と照らす。Secrets に無ければ全部を断る(503)
- モデル: `claude-opus-5-5` に固定(呼ぶ側から変えられない)。考えは adaptive、effort は既定 `high`
  - その場で返す `message` は、安全の判定で断られたとき `claude-opus-4-8` へ回す(server-side fallback)。見積りは高い方の値段で出す
  - 急がない物は `batch_submit`(Message Batches・半額)。結果は `batch_get` で受け取る
- 受ける物: 文字と絵(png・jpeg を base64。1つの頼みに20枚・1枚5MBまで)。道具・文書・url の絵は断る
- 上限: 1回 $20・1日 $25(日本時間の0時区切り)。呼ぶ前の**多めの見積り**(出力は max_tokens を全部使った額)で確かめ、超えたら呼ばずに断る。
  1日の分は DB の錠つきの関数で数えるので、同時に頼まれても超えない。終わった物は実際の額で数え直す
- 記録: 1回ごとに 種類・見積り・実際の額・トークン数・モデル。**中身(文や絵)は残さない**。ログも額とトークン数だけ
- ゲームからは呼ばない(CORS なし)。表は RLS あり・ポリシーなし、関数は service_role だけ

## 窓口にやってほしいこと(この順)

1. **SQL を流す**: `supabase/migrations/202611190001_analysis_gateway.sql` の本文をそのまま `execute_sql` で1回(新しい表と関数だけ)
2. **Secrets に合言葉を入れる**: 名前 `ANALYSIS_GATEWAY_TOKEN`、値は乱数で32文字以上(例: 窓口の機械で `openssl rand -hex 24`)。値は会話・PR・資料に書かない
   - 上限を変えたいときだけ `ANALYSIS_DAY_USD`(既定 25)・`ANALYSIS_CALL_USD`(既定 20)。0 にすると全部止まる
   - `ANTHROPIC_API_KEY` は今のものをそのまま使う(新しいキーは作らない)
3. **関数を配る**: 名前 `analysis-gateway`、ファイルは `index.ts` と `core.js`、**verify_jwt は外す**(合言葉で守る。`rhythm-anomaly-report` と同じ)
4. **確かめる**(Claude を呼ばない・費用0): 合言葉なしで POST → 403 が返る / 合言葉ありで `{"action":"usage"}` → `usd_used: 0`
5. **道具に合言葉を渡す方法を決める**(下のどれか)

| 方法 | 中身 | 注意 |
|---|---|---|
| A(おすすめ) | 道具を回す会話の環境に、ネットワークの秘密として入れる(ホスト `zrzevudkbgtxlbvmuziy.supabase.co`・ヘッダー `x-analysis-token`)。道具は `ANALYSIS_GATEWAY_TOKEN=proxy` で動かす | 値はフォームに1回入れる。会話には出ない |
| B | 窓口の会話で道具を回す(窓口だけが値を持つ) | 部署の会話からは送れない |

## 道具の使い方(配ったあと)

```
node tools/analysis/gateway-client.js usage
node tools/analysis/gateway-client.js message --kind balance --system 前置き.md --prompt 表.md --out 報告.md
node tools/analysis/gateway-client.js message --kind ui-check --prompt 頼み.md --image 画面.png --dry-run   # 見積りだけ
```

## 止め方

Secrets の `ANALYSIS_GATEWAY_TOKEN` を消す / `ANALYSIS_DAY_USD` を 0 / 関数を消す のどれでも止まる。表を残してもゲームには何も起きない。
