# MFバトルカード大会(サーバ側)

決まった仕様と絵: [`docs/progress/card-tournament/plan/README.md`](../progress/card-tournament/plan/README.md)

## 置き場所

| 物 | 場所 |
| --- | --- |
| 大会の計算(組分け・日程・順位・1試合・ごほうび) | `monster-hero/src/parts/82-card-tournament-core.jsx`(画面と保存を触らない部品) |
| サーバの上の関数 | `supabase/functions/card-tournament-run/`(`index.ts` 入口・`core.js` 中身・`game.js` ルールの写し) |
| ルールの写しの作り方 | `tools/build-card-tournament-bundle.js`(`node tools/build.js` が一緒に作り直す。手で直さない) |
| 表と関数 | `docs/sql/card-tournament/CARD_TOURNAMENT_APPLY.sql` |
| 決まった時刻に呼ぶ仕組み | `docs/sql/card-tournament/CARD_TOURNAMENT_SCHEDULE.sql` |
| 検査 | `tools/card/card-tournament-core-check.js`・`tools/card/card-tournament-run-check.js` |

## 1日の流れ(日本時間)

- 0:00〜3:50 に10分おきに関数が呼ばれる(何度呼ばれても同じになる)。サーバの関数は1回に CPU を2秒までしか使えないので、1回に回す試合は 1.2秒ぶん(1試合およそ80ms・15試合ほど)まで。残りは次の呼び出しで回す
  1. 受付の終わりを過ぎた大会: 登録デッキの写しを取り、組分けと日程を作る(デッキが壊れた人は外す)
  2. その日までの試合を回す。実況・解説は AI(失敗したら用意した台詞)
  3. 段が終わったら、頂上決戦の日程を作るか、順位とごほうびを書いて終わる
- 4:00 から結果を見せる(`card_tournament_view`・`card_tournament_match` は `visible_at` を過ぎた試合しか返さない)

## 公開の手順(窓口)

1. `CARD_TOURNAMENT_APPLY.sql` を流す(足すだけ。いまの表は読むだけ)
2. 関数 `card-tournament-run` を出す(verify_jwt を外す。`index.ts`・`core.js`・`game.js` の3つ)。Secrets は既存の `ANTHROPIC_API_KEY` を読む
3. `CARD_TOURNAMENT_SCHEDULE.sql` を流す(合言葉はサーバの中で作る。だれも見ない)
4. 大会の行を足す(名前・開催日・受付の終わり・ごほうびの表)

ルールを直したら、`node tools/build.js` で `game.js` を作り直し、関数を出し直す(出し直さないと、サーバは古いルールのまま回す)。

### 配り方(2026-10-30 から)

- `game.js` は大きくて窓口の道具で送れないため、出すときは `index.ts` の `import * as game from "./game.js"` だけを、jsDelivr のコミット固定の URL(`https://cdn.jsdelivr.net/gh/aknkakykhk-maker/monhero@<コミット>/supabase/functions/card-tournament-run/game.js`)に替えて出す。`core.js` はそのまま送る。リポジトリの `index.ts` は `./game.js` のままにしておく
- `game.js` か `core.js` が変わる PR(カードのルールの部品 82-card-* を直した PR も、ビルドで `game.js` が変わる)をマージしたら、その PR 番号をカード部長へ伝える。窓口が新しいコミットの URL で出し直す
