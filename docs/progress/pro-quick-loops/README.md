# プロモードで入るクイック周回数を、社長の表に(2026-11-10 レフェリーくん)

- 表: `src/parts/19-difficulties-and-rules.jsx` の `PRO_CLEAR_QUICK_LOOPS`(Hard 10・Expert 50・Master 100・GrandMaster 150・Hell 200・Legend 300)と、
  極限(タクティクスのプロ)の `PRO_CLEAR_QUICK_LOOPS_EXTREME` 500(その上は並び順に +200。社長の「とりあえず仮に」)。Normal 以下は今までの式(`proRunQuickLoops`)のまま
- 途中で負けたとき: WAVE n の重みを n にして、周回 = 切り捨て(表 × 進んだ重みの合計 ÷ 55)。1WAVE以上なら最低1周
  - Hell(200): WAVE3 → 21 / WAVE5 → 54 / WAVE8 → 130 / 完走 → 200
  - Legend(300): 5・16・32・54・81・114・152・196・245・300(WAVE1〜10)
- 本体(`60-app.jsx` の `awardProRunQuickLoops`)もヘルプの表(`proQuickLoops`)も `proQuickLoopsFor` だけを読む。条件・入口・結果画面・スコア/ランキング/保存キーは今のまま
- 検査: `node tools/run/pro-quick-loop-check.js`(⑤ を足した)

## 止め絵(実際にプロモードで遊んだ結果画面と、ヘルプ)
- `後-結果-プロHard完走-{縦|横}.png` … Hard を完走して「⚔ クイック周回ぶん 10周」
- `後-結果-プロExpertのWAVE5で負け-縦.png` … Expert で WAVE5 の途中で負け(4WAVE ぶん)→「9周」(50 × 10/55 = 9.09 の切り捨て)
- `後-ヘルプ-プロのクイック周回の表-{縦|横|回横}.png` … ヘルプ「M/B管理と編成」の表(10WAVE完走/WAVE5まで)
- 🔄横はモンヒロビートの中だけで回るので、バトルの結果画面は回らない(結果画面の🔄横は撮っていない)

## 2026-11-10 夜: 途中で負けたときを減らした(社長「クリアだけは劇的に高くしないと報酬美味しすぎる」)
- 途中(nWAVEクリア、n=1〜9): 切り捨て(表 × n(n+1)/2 ÷ 135)、最低1周。WAVE9 でクリアの3分の1。完走は表のまま
- 止め絵: `後2-ヘルプ-途中は135で割る-縦.png`(ヘルプの表。5WAVEクリア: Hard 1・Expert 5・Master 11・GM 16・Hell 22・Legend 33)
- Normal 以下は今の式のままなので、4〜9WAVE で Normal(2〜4周)が Hard(1〜3周)より多い(逆転はこの6か所だけ)
