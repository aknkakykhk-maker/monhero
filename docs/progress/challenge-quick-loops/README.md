# チャレンジモードをクリアすると、裏のクイック周回ぶんも入る(2026-11-10 社長の表・レフェリーくん)

- 表: `src/parts/19-difficulties-and-rules.jsx` の `CHALLENGE_CLEAR_QUICK_LOOPS`(Hard 10・Expert 50・Master 100・GrandMaster 150・Hell 200・Legend 300・Beginner/Easy/Normal は 0)と、
  極限の `CHALLENGE_CLEAR_QUICK_LOOPS_EXTREME`(EXTREME 500。その上は並び順に +200 で、社長の「とりあえず仮に」)。本体もヘルプもここだけを読む
- 配り方: `60-app.jsx` の `awardChallengeClearQuickLoops`。プロと同じ入口 `awardBackQuickLoops`(AUTO設定がそろっている・AUTO設定のクイックの難易度をクイックでクリア済み)。
  10WAVE をクリアしたときだけ。報酬の入口 `awardRunRewards` の同期ロックの後ろで1回だけ。スコア・ランキング・自己ベスト・保存キーは触らない
- 結果画面: プロと同じ「⚔ クイック周回ぶん ◯周」のまとまり(`data-pro-quick-award`)
- 検査: `node tools/run/challenge-quick-loop-check.js`

## 止め絵
- `後-結果-チャレンジHardクリア-{縦|横}.png` … 実際に Hard をクリアした結果画面(10周ぶん)
- `参考-結果-チャレンジHardクリア-回横(ふだんは回らない).png` … 「🔄 横」はモンヒロビートの中だけで回るので、バトルの結果画面が回ることはない(参考に回して撮っただけ)
- `後-ヘルプ-チャレンジのクイック周回の表-{縦|横|回横}.png` … ヘルプ「M/B管理と編成」の表
