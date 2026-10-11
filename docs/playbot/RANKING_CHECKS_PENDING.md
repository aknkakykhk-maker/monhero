# ランキング領域で main に残っている、落ちている検査(止めてあるもの)

2026-10-11 に守り部:部長ガードくんが書いた。社長の決定「**今は止めておく**」(新曲・モンヒロビートが落ち着いてから取りかかる)に従い、
**原因の特定と直しはまだしていない。** このメモは、再開したときに最初から始められるようにするための一枚。
ランキングのデータ(Supabase の表・保存データ)には、調べるときも直すときも触れない。

## 経緯

窓口の依頼で、main で落ちている検査を調べた。`tools/ranking/profile-frame-browser-check.js` と
`tools/mode/species-challenge-clear-flow-check.js` の2本は原因が分かり、直して公開した(PR #2688)。
原因は、モンヒロバトルのモード・難易度えらびの作り直し(branch `claude/battle-select-redesign`。
#2349 の 0fb535b と #2359 の c3409b6)が、対応する検査を直さないまま入っていたこと。

そのとき `node tools/run-checks.js --area ranking` を回すと、**ほかに次の8本が main で落ちていた。**
(2本の直しの前から落ちていたもので、直しとは関係がない)

## 落ちている8本と、いま分かっていること

「当たり」と書いたものは、**失敗の文言から見当を付けただけで、まだ確かめていない。**

| 検査 | 失敗の文言(抜粋) | 原因の当たり |
| --- | --- | --- |
| `ranking/ranking-check.js` | モードのカードからスコアランキングを開ける — 「◯◯のランキング」が見つからない | モードカードのボタンが「🏆 ランキング」(`data-mode-ranking-link`)に替わった(#2359 の c3409b6)。検査が古い文字を探している。species の2本目と同じ型 |
| `ranking/power-ranking-check.js` | 画面側は並べ替えの式を書き写さず `collectPowerRankingEntries` を呼ぶ / 上のタブに総合力が並んでいる | 画面の作り直しで、ソースの書き方・タブの並べ方が替わった。検査が古い文字列(ソースの形)を探している |
| `ranking/bond-ranking-species-check.js` | 絞り込みを血統idで行っている | 同じく、ソースの書き方が替わって、検査が探す文字列とずれた当たり |
| `ranking/power-ranking-browser-check.js` | 上のタブが4つ並ぶ — モード選択 / 🏆ブリーダーLv / 🏆絆Lv / 🏆総合力 / 絆Lvタブはこれまでどおり絆Lvの高い順 / 絆Lvタブには総合力の無い古い記録も出る | タブの文字に「🏆」が付いた(0fb535b)。検査が文字そのものでタブを探すため、見つからない。aria-label(「◯◯ランキング」)で探す形に直すのが定石(#2688 と同じ) |
| `ranking/breeder-ranking-paging-check.js` | よく遊ぶ人が一覧に出る — 0件 / 記録が少ない人も消えない | 一覧が0件=タブを開けていない当たり(同上) |
| `ranking/breeder-profile-browser-check.js` | ブリーダーLv: 改名しても1人1行にまとまる — 0行 / 残るのは高いほうのレベル | 同上(一覧が0行) |
| `ranking/bond-levels-table-check.js` | テーブルあり: 正本にいる人が全員出る / 絆Lvの高い順に並ぶ | 同上の当たり(絆Lvタブが開けず、一覧が出ない) |
| `ranking/breeder-ranking-browser-check.js` | `TimeoutError`(30秒) | 待っている要素が出ない=タブが開けない当たり。ただし、別の原因(画面の遷移の変更)の可能性もある |

## 再開したときの進め方

1. `node tools/run-checks.js --area ranking` で、まだ8本落ちているかを確かめる(その間に誰かが直しているかもしれない)
2. まず「0件・見つからない」系を、`#2688` と同じ直し方(タブを `aria-label` で探す。`button[aria-label="ブリーダーLvランキング"]` など)で直せるか試す。
   「🏆」が付いたのは 0fb535b(#2349)。タブのボタンは `60-app.jsx` の `mhbs-tab`(`aria-label` は `モード選択` と `${label}ランキング`)
3. ソースの形を見る検査(`power-ranking-check` / `bond-ranking-species-check` / `ranking-check`)は、**いまの書き方を読んでから**、
   検査が何を守ろうとしていたか(例: 並べ替えの式を画面に書き写さない)を残したまま、探す文字列を直す
4. `TimeoutError` の `breeder-ranking-browser-check` は、どこで待っているかを先に確かめる
5. **検査を外す・甘くするのは無し。** いまの作りに合わせて探し方を直す。ゲーム本体が本当に壊れていたなら、本体を直す

## 補足

- 原因になった作り直しはバトル部(ブレイブくん)の担当。同じ種類の置き去りを防ぐため、
  「画面を作り直すときは、対応する検査も同じ PR で直す(コミット前に `node tools/run-checks.js --changed`)」と伝えてある
- 主な画面の場所: モードカードのランキング導線は `60-app.jsx` の `data-mode-ranking-link`、
  難易度の札のランキングは `aria-label` が「◯◯のランキング」、ランキング画面の見出しは `BattleScreenHead`(`note="ランキング"`)
