# 簡易シミュレーター 進捗メモ(研究所:ダイスくん)

最終更新: 2026-10-10。続きから始めるときは、これを読んでから。上司は研究所:ハカセくん(Tier 表のまとめ役)。

## 持っているファイル(ダイスくんだけが書く)

- `tools/playbot/sim/*`(battle.js・load-game.js・desk.js・ex-scenes.js)・`tools/playbot/asika-tier.js`
- `docs/playbot/reports/tier/` の sim.md・desk.md・asika-sim.json・asika-tier.md・combo.md・zan.md・lab/
- 触らない: monster-tier.md・tier.json・tier.html(ハカセくん)/ scenarios/*・tactics-knowledge.json(アリーナくん)/ ゲーム本体(monster-hero/)。
  asika-tier.js は tier.json も書き換えるので、tier.json と docs/playbot/dashboard/ の変更はコミットに入れず `git checkout` で戻す

## ハカセくんから受けた順番(2026-10-10)

1. いまのまま(アシカ入り)で sim.md を作り直し、実戦との差を測り直す
2. トレーニングを入れて、差がどこまで縮んだかを測る
3. 子ごとの「best − bot」の差と、best が EX を使う場面をアリーナくんへ渡す(ライガー・ハム・ウンディーネ・プラント・アーク・エイキ。アシカはみゅあ・ニコラオ)
4. 組み合わせ上位(combo.md)の数を増やし、くじのぶれ(±0.3)より確かな上位5つをアリーナくんへ

## やったこと

- 4 版目: トレーニングを入れた(`simulateRun({ training: 'bot'|'none' })`、CLI は `--training`)。
  WAVE 1〜9 のあと毎回、立っている子へ2回ずつ。式は 60-app.jsx handleTraining・19 の resolveTrainingStats・32 の applyTacticsTraining / reviveTacticsAt。
  選び方はボット(tactics-brain.js 550〜587)と同じ: 丸太うけ+走り込み、ガッツの少ない子は丸太うけ+猛勉強。倒れた子を起こすかはランで1回だけ考える(ボットの mem.reviveAsked がランのあいだ戻らないため)
- 場面の記録: `simulateRun({ exLog: true })` で `exLog`(EX)と `assistScenes`(アシカ)を返す。集計は `sim/ex-scenes.js`
- 敵の強さ(tacticsEnemyPowerMultiplier)は編成の元の数字(monsterPowerOf)で決まり、トレーニングでは上がらない。ゲーム(60-app.jsx applySlots 1313)も同じ

## わかったこと(300 回ずつ)

- トレーニングを入れると、全滅はほぼ消えるが時間切れ(20 ターン)が増える。モッチー Hard(EX=best): 全滅 131 → 3 回・時間切れ 157 → 276 回・クリア 12 → 21 回。
  丸太うけで丈夫さが伸びるとガードの段階が上がり、ガードカードが最大4枚まで増えて、手札の攻撃が減るため(ゲームの guardCardCount と同じ)。
  「ボットが丸太うけばかり選ぶので、後半は削り切れずに時間切れ」の疑いがある → アリーナくんへ伝える候補
- 届いた WAVE の平均では、クリアと WAVE 10 の負けが同じ 10 になる。トレーニングの効き目はクリア率と負け方(全滅/時間切れ)で見る

## 実戦とのずれ(実戦 − シミュレーター、回数で重みづけ。各 300 回)

| 版 | Hard | Expert | Master |
| --- | --- | --- | --- |
| 2 版目(スキル入り・EX=best) | +2.43 | +0.89 | +0.23 |
| 3 版目(+アシカ・EX=best) | +1.34 | +0.65 | +0.09 |
| 3 版目(EX=bot) | +1.44 | +0.90 | +0.31 |
| 3 版目(EX 無し) | +2.22 | +1.65 | +0.92 |
| 4 版目(+トレーニング・EX=best) | +0.96 | +0.19 | −0.07 |
| 4 版目(EX=bot) | +0.96 | +0.46 | +0.16 |

## アシカ・組み合わせ(PR #2501 と、そのあと)

- A1〜A3(改善部の指摘)は #2501 で入れた。Tier は上手の数字だけ・おすすめは +0.4 以上・組み合わせは上位/下位 10 組を別の種(seed 1001)で各 300 回測り直す
- 「合うモンスター」はプラスの子だけ。いなければ md・tier.json とも「合う子は見つからなかった(いちばん下がりにくいのは◯◯)」。tier.json は `合うモンスター: []` と `合う子なし: "…"`
- 測り直し: 上位10組・下位10組とも ±0.3 の外に残った(くじではない)。下位で 0 へ戻った例: モッチー×ユグドラシル −0.94 → −0.66
- アシカ・組み合わせのキャッシュはトレーニング無しの条件。トレーニング入りで回し直すかはハカセくんと決める

## 次にやること

- 次に入れるものはハカセくんの mechanics.md(13:30 ごろ)で決まる。候補: 緊急回復・固有技の強化・distDmgBonus・魂格・トレーニングの上手な選び方
- 3: `node tools/playbot/sim/ex-scenes.js --diff Hard,Expert --runs 300 --md docs/playbot/reports/tier/lab/ex-scenes.md`
- 4: combo.md の回数を増やす(asika-tier.js)
