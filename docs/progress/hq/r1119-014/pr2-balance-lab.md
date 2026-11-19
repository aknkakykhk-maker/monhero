# r1119-014 PR2 モンサクのバランス研究の道具

クラフトくん(開発部)作。正本の案は [README.md](README.md)。ゲーム本体・保存・ランキング・バランスの数値は変えない。

## 試合の渡し方(ゲーム本体とそろえる)

既存の `tools/success/game-fight.js`(r1115-202 H2)が、本体の parts から `msxR3Fight` をそのまま切り出している。
研究の道具はこれを**1試合に1回**呼び、本体と同じ入力で戦う。検査で、毎試合の入力を本体の式と比べている:

- `MONSUC_MATCH_RULE`(能力の上限・引き分けの扱い)/ 作戦の値 `MSX_R3_GEAR` / 試合型アシストの上乗せ `buffs.A`(= 芯の `battleBuffs`)/ `aptUp` / 覚醒

(覚醒は、この試しの育て方では起きないので「付かないことが同じ」までしか見ていない。手で戦う試合は再現できないので、すべてオート相当。)

## 作った物

| ファイル | 中身 |
|---|---|
| `tools/success/balance-lab/run.js` | 1回の育成。子(30種)× 育て方7つ × 編成6つ × 助手8人。育て方は `peek` だけで決める(試し打ちはしない) |
| `tools/success/monsuc-balance-lab.js` | 最大10万回をワーカーで並列に回し、`summary.json`・`table.md`(表と気になる点)・1回1行の `rows-*.jsonl` を出す。`--analyze` で入り口へ送って報告書 |
| `tools/success/monsuc-balance-lab-check.js` | 再現・試合の入力・条件の回り方・表・偽物の Claude をつないだ入り口で報告書まで(約2秒・費用0) |

- 育て方: トレーニング重視 / 修行重視 / バランス型 / 友情タッグ重視 / 体力管理重視 / 大会勝利重視 / 各ターンの期待値優先
- 編成: base / box-mid / real-B / real-A / real-S / battle-S(real-S + 試合型アシストを最大)

## 使い方

```
node tools/success/monsuc-balance-lab.js --runs 1000                     # 表だけ(API なし・費用0)
node tools/success/monsuc-balance-lab.js --runs 100000 --workers 4       # 本番(約20分の見込み)
node tools/success/monsuc-balance-lab.js --from <出力> --analyze --dry-run   # 見積りだけ
node tools/success/monsuc-balance-lab.js --from <出力> --analyze             # 報告書 → docs/progress/success-balance/
```

`--analyze` は PR1 の入り口(配ったあと)と合言葉(`ANALYSIS_GATEWAY_TOKEN`)が要る。

## 試し(2026-11-19・1,000回・4並列で12秒)

- 表: [`docs/progress/success-balance/20261119-trial-1000-table.md`](../../success-balance/20261119-trial-1000-table.md)
- 報告書の見積り: 1回 **約$0.35**(多め。Claude Opus 5.5・出力は max_tokens 12,000 を全部使った額)。入り口がまだ配られていないので、本物はまだ呼んでいない(費用0)
- 10万回の見込み: 1,000回が12秒 → 約20分(4並列)。生の行は約50MBで作業用フォルダに置く(リポジトリには入れない)
- 10万回を回して分析するのは、モンサクの直し(バトル・イベント)の公開のあと(r1119-014)
