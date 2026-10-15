# ボット用の早送り(タクティクスプロ)の進み具合メモ

2026-10-10 16:10 修理部:部長ドライバーくん。社長の指示「新曲(sheriruth)以外を止める」で、ここで止めた。**main には入れていない**(ブランチ `claude/playbot-fast` だけ)。

## 頼み
研究所:部長ハカセくん(社長の選択「ボット用の早送りも作る」)。ボット側は研究所のアリーナくん(`tools/playbot/scenarios/tactics.js`)。

## できていること(ブランチにコミット済み)
- `?playbotFast=1` … `battleMs`(60-app.jsx)を通る演出の待ちを 1/20(`PLAYBOT_FAST_DIVISOR`)。ダメージ・抽選・報酬には渡らない
- `?playbotSeed=<数>` … ランの始まり(`applyResetAllState`)ごとに `Math.random` を同じ種から作り直す(`playbotReseedRandom`・mulberry32)
- どちらかが付いた周回は全国ランキングにも自己ベストにも残さない(`PLAYBOT_ACTIVE`。`submitRunScoreOnce`・`submitTacticsScoreOnce`・`submitSpeciesChallengeScoreOnce`)
- 定義は 10-core.jsx の `PLAYBOT_*`。check-syntax / undefined-reference / jsx-text-brace / render-error は通過
- `battleMs` を通らない待ちはバトルの外か見た目だけ(技の光 `TACTICS_SLOT_FX_MS`・ボスの登場映像・図鑑の見本)

## 残り
1. 同じ種で早送りあり/なしを回して、WAVEごとの記録が一致するかを確かめる(まだ結果なし。止めたため)
   - やり方: playbot.js の `PAGE_URL` に `?playbotSeed=123`(と `&playbotFast=1`)を付けた使い捨ての写しで `--only tactics --seed 7` を2本
   - ずれたら: 戦いの外で `Math.random` を使う所(助手のセリフ選び・ポップアップのidなど)が混ざっていないかを見る
2. `run-checks --changed` → PR → マージ
3. 印の名前と縮めた所の一覧を、アリーナくん(session_01GC6TmQQkN6wfT4a8EymrPz)とハカセくん(session_01911k2UUtVGudFqekCw9DB9)へ送る
4. 更新履歴・ヘルプには載せない(デバッグ専用)

## 2026-10-15 再開 → 社長の指示「モンヒロビート以外を止める」で、また止めた(修理部:ドライバーくん)
- できたこと: いまの main へ載せ直した(ブランチ claude/playbot-fast)。アリーナくんの希望で、印をそのタブの sessionStorage(mhdev_playbot_v1)にも控えて読み直し・タイトルへ戻っても残るようにし、window.__playbotFast / window.__playbotSeed で読めるようにした。playbot.js に PLAYBOT_QUERY(開く URL に印を付ける)を足した
- 比べ走り: 早送りありの1本(種123・--seed 7)は tacticsPro(Hard)を WAVE 10 まで 29ターン・12.1分。早送りなしの1本は止めたため未完。まだ main へは入れていない
- 次にやること: 同じ種で早送りなしの1本を回して比べる → run-checks → PR → マージ → アリーナくんへ印の名前と縮めた所を送る
