# 引き継ぎメモ: バトル部 クリスマスのレイドの土台(2026-11-25)

次の会話は CLAUDE.md → `docs/depts/battle.md` → `node tools/ctx.js decisions battle` → このメモ → [`BUILD.md`](../event-xmas-2026/BUILD.md) の順に読む。前の会話(session_0113GBaCMf3gBkPXK3WJFy3T)は読みに行かない。

## 済んだこと

- ① つなぎ目 `docs/progress/event-xmas-2026/BUILD.md` — #7591(マージ済み)
- ② 定義 `35-raid-xmas.jsx`・回数と与ダメージ `36-raid-xmas-api.jsx`(`raidXmasUseTry` / `raidXmasAddDamage` / `raidXmasFlushStoredPending`)・`RELEASE_FLAGS.raidXmas`・検査 `tools/battle/raid-xmas-check.js` — **#7608(ミハリ待ち・マージしていない)**。イベント名 `RAID_XMAS_EVENT.title = '聖夜の名探偵'` も入れた
- SQL(source に 'card')とジャックの実績を読む SQL は BUILD.md §7。窓口へ渡した

## 残りの仕事(順に)

1. **③ レイド画面と1戦・報酬・ランキング・`openRaidXmasResult`**(#7608 のマージ後に、その上で)
   - 方針: ジャックの画面(`79-screen-raid-jack.jsx`)と 60-app.jsx の流れを「イベントの定義(def)を受け取る形」に寄せる。ジャックの動きは変えない
   - 60-app.jsx で触る所(行は 11/25 時点): `raidJackEventId`(3629)・ホームの BGM(6696)・討伐の確認(9519)・敵を作る `raidJackMakeEnemy`(17632)・`finishRaidJack`(18262〜)・ビート挑戦(18320〜・ビート部と分担)・報酬の受け取り(18451〜)・`startRaidJackFromPrep`(18590〜)・HOME の入口(20328)・画面(22737〜)・結果画面(26688〜)
   - バトルの1戦の終わりは `raidXmasAddDamage({ source:'battle', defeated, log:{party,units,turns} })` を呼ぶ
   - 画面のランキングの切り替えに「バトルカード」(source card)を足す
   - 敵の絵: **`tools/art-sources/raid-xmas-2026/received/santa_black_kakusei_glare.png`**(黒・にらみ目の版・社長決定 #7610・追跡 r1125-047。元の `santa_black_kakusei.png` は使わない)・`santa_red.png`(赤・お話用)。配信用に整えるとき(`prepare-enemy-art.js` など)縁の赤いにじみを落とす(`monster-hero/images/CLAUDE.md`・画質を下げない)。**目元には手を入れない**(社長が3回見て決めた形)。追跡 r1125-046。ボスの名前は仮のまま
   - 組み込んだら、報告に PR 番号と本番で見る所を書く(窓口の頼み)
2. **④ お話の仕組み**: 段階ごとの話(id は `RAID_XMAS_STORY_IDS`・候補は `raidXmasStoryCandidates`)と、ひとりで進める物語(`XMAS_STORY_CHAPTERS`・`mh_xmas_story_v1`・`completeXmasStoryChapter`)。台本は `docs/progress/event-xmas-2026/SCRIPT.md`(別の会話)
3. **⑤ HOME のボス**(ジャックの `HomeRaidJack` を def で動く形に)
4. **期間中のモンヒロバトルのごほうび1.5倍**(窓口 11/25・r1125-044・レイドと別の PR): 何に掛けるか(経験値・ビートP・ドロップ)の案、レイド・グランドスラムにも掛けるかの案、ほかの倍率と重なったときの扱い、更新履歴・ヘルプの文案(11/30 10:00 まで出さない)。ふつうのバトルから作る

## 気をつけること

- `run-checks.js --changed` は parts を触ると全部(約490本・15分超)回る。出力は `tail` に通さずファイルへ書き、背景で回す
- main 側に既存の NG がある(`RHYTHM_TOUCH_DIAG_STATS_MAX`(#7514)で node の読み込みの検査が落ちる・顔アイコン・依頼文の大きさ・音量設定ボタン)。自分の変更と分けて報告する
- 検査が `docs/progress/player-raise/shots/beta-2026-11-13/lock.png` を書き換えることがある。コミットに混ぜない
- 数字はまだ仮(ジャックと同じ)。ジャックの実績が窓口から来たら案の表を出す
