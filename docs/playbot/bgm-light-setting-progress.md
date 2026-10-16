# 場面のBGMを軽く持つ(通常設定化)の進み具合メモ(2026-10-16・修理部ドライバーくん)

**状態: 保留(社長の指示「モンヒロビート以外の作業はいったん全部止める」)。ブランチ `claude/bgm-light-setting` にコミット済み・PR は未作成・main には入っていない。**

## できていること(コミット済み)
- 音量設定の小窓(タイトルの設定・ゲーム中の設定の2か所)に「🪶 場面のBGMを軽く持つ（メモリを節約）」の入/切。既定は切
- 新しいキー `mh_bgm_light_pref_v1`('on'/'off'/無し)。無い間だけ、デバッグの検証用キー `mh_bgm_light_v1` の 'on' を入として読む(古いキーは書き換えない)
- デバッグ設定の「確認待ちの試作」から外した
- 更新履歴(2026-10-16 18:55)・ヘルプ(「音が出ないとき」の隣)・SAVE_DATA.md
- 検査: `tools/audio/bgm-light-check.js`・`tools/debug-trials-check.js`・changelog/help の検査は通過。`run-checks --changed` は途中で止めた(未完了)
- 報告の画像と動画: `docs/playbot/reports/2026-10-16/bgm-light/`(before/after の音量設定・引き継ぎ・入→切の動画)

## 再開するとき
1. `git checkout claude/bgm-light-setting && git merge origin/main`(生成物のぶつかりは `--theirs` → `node tools/build.js`)
2. 更新履歴の日時を再開した時刻(JST)に書き直す(コミット時刻と1時間以上ずれると changelog-order-check が落ちる)
3. `node tools/run-checks.js --changed` を通して PR → マージ → 窓口へ報告の置き場所を送る
