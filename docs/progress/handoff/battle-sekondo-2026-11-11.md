# 引き継ぎメモ: バトル部セコンド(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/battle.md` → `node tools/ctx.js decisions battle` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## この会話で公開したもの(すべて main 入り済み)

- #5035 ミッションの作り直し(`mh_mission_renew_v1`・助手の1日1行 Edge Function `mission-daily-line`)/ #5131 mission-check の日付固定
- #5106 助手ライフの裏クイック(60-app 側)
- #5264 バトルのれんしゅうを「はじめの1戦」(21手)と「つづき」に分ける(86244e6c)
  - 台本: `data/assistants.js` の `ASSISTANT_BATTLE_TUTORIAL_FIRST` / `_MORE` / `BATTLE_SELECT_HINTS` / `BATTLE_TUTORIAL_SCENARIO_FIRST` / `ASSISTANT_BATTLE_TUTORIAL_MORE_OFFER`
  - 保存: 新キー `mh_battle_tutorial_first_v1` `{done, at, hints}`・`mh_battle_tutorial_more_v1` `{offered, done, declined}`。`mh_battle_tutorial_seen_v1` は意味不変(はじめの1戦では立てない)
  - 60-app: `endBattleTutorial`(variant ごとの保存)・HOME の「つづき」の誘い(`realBattlePlayedRef`)・3画面の一言(`battleSelectHint`)・ヘルプの3ボタン(`data-battle-tutorial-launch-first/more/all`)
  - 検査: `tools/battle/battle-tutorial-split-browser-check.js`(縦・横・🔄横で通す)・battle-tutorial-check・battle-scenario-check
  - ハジメテ2(#5268)の `mh_first_battle_done_v1` とは印を別々にすると決めた(ジン了承)。同じ HOME では誘いが先、お話があと

## 残っていること(この部の手は要らない)

- 更新履歴・ヘルプ(#5264 ぶん)は ハジメテ2 がまとめて書く(文案は渡し済み)
- ハジメテ2 が `ASSISTANT_BATTLE_TUTORIAL_GUIDE` の1行目を直す予定(#5264 の後で、と伝えた)
- main で落ちている検査8本はジン部長へ報告済み: peer-lines-variety・card-bubble-text・rotation-height・screen-effects・market-bulk-purchase・card-drag-tap・card-footer-fit・japanese-linebreak

## 気をつけること

- `run-checks --changed` は main 取り込み後に 540 本を超え、30分では終わらないことがある。背景で回すときは timeout を長く、ブラウザ検査は同時に回すとポートがぶつかる
- 3画面の一言は、断った人・前からの人にも1回ずつ出る(社長 2A どおり・ミハリ3確認済み)
