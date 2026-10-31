# 個人杯 ④ リアルタイム杯の進め方(ブレイブくん)

2026-10-31 開始。仕様: [`docs/spec/CARD_CUP.md`](../../../spec/CARD_CUP.md)「リアルタイム杯」。

## 区切り

| 区切り | 中身 | 状態 |
| --- | --- | --- |
| 1 | サーバの関数(`docs/sql/card-cup/CARD_CUP_LIVE_APPLY.sql`・足すだけ)と検査 `card-cup-live-sql-check` | #4350 |
| 2.5 | 止まった杯は30分でサーバが決める(`CARD_CUP_LIVE_AUTO_APPLY.sql`・`cup.js` の `runLiveCups`)・ごほうびのある杯の決まり方 A(`card_cup_live_reward`) | #4356 |
| 2 | 画面 `99-card-cup-live.jsx` の `CardCupLivePanel`(集合・始める・自分の次の試合・開催中の表)。③の杯の画面 `CardCupDetail` に1行で差し込む。参加の画面は③の `CardCupJoinPanel`。検査 `card-cup-live-browser-check` | #4353 |
| 3a | 来ない相手の登録デッキと戦う(absent): 84 の `playCupLive`(杯の画面の「試合へ」)→ `startBattle` に杯の種・先攻・写し → 終わったら `card_cup_live_report`(ごほうび・記録なし)。2人とも来ない・食い違いは開催の画面が端末で回す(auto)。b 側の試合は手の並びを `{ order: 'ba', acts }` で送り、93 の `cardReplayFromTour` が並びを戻す。検査 `card-cup-live-play-browser-check`・`card-tour-replay-check` の L | このPR |
| 3b | 2人で戦う部屋(91 に杯の口を足す。ふつうのマルチは変えない) | 次 |
| (旧3) | 試合のつなぎ(`CardCupLivePanel` の `onPlay` に、84 の入口1か所から試合の画面を渡す): 91 の部屋を合言葉(8文字)で開く・登録デッキの写しで戦う・終わったら `card_cup_live_report`。来ない相手は `cardSharePolicy` で戦う(absent)。食い違い・2人とも来ないは写しどうしを `cardTourPlay` で回す(auto)。観戦の一覧(94)に杯の印 | 次の次 |

## 決めたこと(区切り1)

- 部屋の合言葉はサーバが試合ごとに作る(8文字。ふつうのマルチの4文字とぶつからない)。その試合の2人にだけ返す
- 試合のデッキは、始まる時刻に取った登録デッキの写し(来ない人が代わりに戦うのと同じデッキ)
- 結果は今のマルチと同じ決め方(なぞり直しが合えば決まる)。片方だけが送って90秒は抜けた側の負け(`leave`)
- 集合はしたが試合の部屋に2分来ない人は「来ない」とみなす(`absent`)
- 2人とも来ない・食い違いは、来ている人の端末が写しどうしを試合の種で回して送る(`auto`)。だれが回しても同じ結果になるので、サーバで回さない(リアルタイム杯はすぐ進めたいため。10分おきのサーバを待たない)
- トーナメントの1回戦の組み合わせ・次の回戦はサーバ(SQL)で作る。山の並びは 82 の `cardTourKoOrder` と同じ作り。種順のくじは SQL の `random()`(オート杯の `cardTourKoFirst` の種とは別。リアルタイム杯は見返しの再現に要らない)
- 見返し: 手の並びは試合を決めた1回だけ書く(2台目の送りは `done`)。抜けた試合は待つあいだに先に送った側の手を残す。食い違いは auto の手。画面は③の見返しの入口から
- 82-card-tournament-core は触っていない(game.js は変わらない)

## 区切り3への申し送り

- 端末が auto で回すとき(2人とも来ない・食い違い)は、サーバと同じ `cardTourPlay(db, {deck,tactics}, {deck,tactics}, { seed, first, key: `杯|回戦|枠` })`
- サーバの関数の出し直しは公開前にまとめて1回(`cup.js`・`index.ts` を変えた)

## 残り・気になる所

- 送られた結果は端末を信じている(いまのマルチの強さの点数と同じ)。ごほうび・ランキングが無いので、まずはこのまま
- 主催がいなくなっても、参加者のだれかが開けば進む(start・settle はだれでも呼べる)。だれも開かない杯は30分でサーバが決める(区切り2.5)
