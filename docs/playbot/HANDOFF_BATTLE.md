# バトル部 部長ブレイブくん の引き継ぎ(2026-10-13 未明)

前の会話: session_01JEr9tDMYKaEM1yA1yBv46Z。会話の長さが交代の目安を超えたので交代する(窓口の依頼)。新しい会話は窓口が立てる。
報告・相談・見込みの返事は **窓口 session_014GTmSNS2ae9tRr57k3zFjC** へ送る(正は `docs/playbot/SESSIONS.md` の窓口の行)。

## 次の会話が最初に読むもの

1. ルートの `CLAUDE.md`(日本語のみ・AskUserQuestion・②③ は確認なしでマージまで・⑦ 保存データ・⑨ 大きいファイルを開かない)
2. `docs/playbot/RULES.md`(とくに 20: 許可の前に日本語で説明 / 21: 見込みは AI の実作業時間で出す)
3. この1枚
4. 演出の一覧と静止画: `docs/proto/monster-visuals/README.md`
5. 止めてある検査のメモ: `docs/playbot/RANKING_CHECKS_PENDING.md`

## いまの状態(10/13 2:50)

- **手を付けている作業は無い。** 作業ブランチ `claude/battle-select-redesign` は main と同じで、きれい
- 10/12 の社長の依頼は全部公開済み:

| 何 | PR | 中身 |
| --- | --- | --- |
| マーク×数(第1段) | #2851 | 味方の枠: 🍪クッキー・🎵黒音符(0でも×0・満タンで光る)/🎀旋律/💪🛡️💚トリック/🎲🪙運命/💥連撃パワー。敵: ライフの帯の右端に 💧水牢・❄️氷結・📢咆哮 |
| 残りターン・残り回数(第2段) | #2856 | ⏳nT(EXの残りターン・残り1で赤く光る)・👻完全回避・🔥根性・EX の札に「EX×残り回数」。水牢・氷結の札にも残りターン |
| 演出の案と見本 | #2857 | 26体の一覧 `docs/proto/monster-visuals/README.md` |
| あつの挑発に黒音符の連撃 | #2859 | 通常攻撃・予測とそろえた。`battle-damage-preview-check` の探し方も直した |
| 26体の演出 | #2862 / #2867 / #2868 / #2870 / #2871 | 区切り1〜5。全員そろった |
| 検査3本(検査が古いだけ) | #2867 | `battle-mode-check`・`power-ranking-check`・`bond-ranking-species-check` |

## 作り(どこを触ればよいか)

- **絵柄の表は2つだけ**(社長があとで差し替える前提。`mark` は絵文字、`img` に画像パスを入れると絵に替わる)
  - `BATTLE_STACK_MARKS`(マーク×数)… `src/parts/22-enemy-and-bond-entries.jsx`
  - `BATTLE_MONSTER_FX`(26体の演出)… 同じファイル。`avoidClone`・`present`・`swordStyle`・`aura`・`glove`・`spotlight`・`afterimage`・`thunder`・`scatter`・`leafShield`・`overlay`・`coverFilm`・`sprout`・`pandoraBox`・`springRing`・`cookiePile`・`noteStaff`・`coinSpin`
- **部品** … `71-screen-battle.jsx` の `BattleStackMarks`(マーク×数)と `BattleMonsterFx`(演出)
  - 味方の数は `allyStackCounts`(強化の札と同じ出どころ)、敵の数は 60-app の `enemyStackCounts`
  - EX まわりの数・種類は 60-app の `tacticsSlotCountersAt(i)`(詳細パネルと同じ関数 `tacticsExRemainOf` / `tacticsExAvoidLeftOf` / `tacticsExActiveEffect` ほかから作る)
- **置き場所の決めごと**: 数字(マーク)は枠の絵の左下(タクティクス)/名前の帯の下(ほかのモード)/距離の字の横(超省エネ)。演出は絵の上側・右側で、数字にかけない。
  演出はタクティクスの枠だけ・軽量表示と超省エネでは出さない・「待機中の動き：止める」(`battleFx.idleMotion==='OFF'`)と端末の動きを減らす設定で止める
- **静止画用の差し込み口** … 自動操作のブラウザ(`navigator.webdriver`)のときだけ `window.__mhStackMarksDebug.set({ ally:{枠:{kind:数}}, enemy:{kind:数}, fx:{枠:{...}} })` が使える。見た目だけで効き目は変えない
- CSS は `monster-hero/index.html` の `.mh-stack-mark*` と `.mh-mfx-*`
- **ヘイト(確認待ちの試作・10/17)** … 数字は `32-tactics-units.jsx` の `TACTICS_HATE` の1か所(役割・子ごとの上書きもここ)。60-app は `tacticsHateOnFor`(タクティクスバトルだけ・試作が入のときだけ)・カードと EX でためて敵の次の狙いの直前に `stepTacticsHate`・WAVE の始めに `resetTacticsHate`。炎は `71-screen-battle.jsx` の `hateFlame`。検査 `battle/tactics-hate-check.js`、説明と動画 `docs/playbot/reports/2026-10-17/tactics-hate-proto/`

## 残っていること・宿題

| 何 | 状態 | 次にやること |
| --- | --- | --- |
| `battle/damage-parity-check.js` | main で前から落ちる。本体から関数を切り出して組む作りに、あとから足した関数(黒音符 `withBlackNoteCombo`・アクアフィールド `aquaStackFromCard` など)が無い | 直すかは窓口の判断待ち(10/12 に伝えた)。直すなら足りない関数を順に足す |
| `monster/melody-kuromy-effects-check.js` の禁止語の項目 | main で前から落ちる。バトル部の差分とは無関係 | 窓口へ伝え済み |
| バトル部の画面の作り直しに追いついていない検査6本 | `RANKING_CHECKS_PENDING.md` の追記の表(battle-menu-browser ほか) | 社長の「今は止めておく」。再開の指示が出たらメモから |
| ユグドラシル本人の絵が、左下の距離の欄にかかる | 演出ではなく前からの絵の置き方(`ygg-compare-nofx-vs-leaf.jpg`) | 直すなら別件。窓口に「必要なら言って」と伝え済み |
| 演出の実プレイの確かめ | メロディー・クロミーの数とEXの残りターンは検査で実プレイを確かめている。ほかの子は差し込み口の静止画と、同じ関数から作ることの検査だけ | 社長から見え方の指摘が来たら、その子だけ実プレイで撮る |

## よく使う道具と検査

```
node tools/build.js                              # parts を触ったら必ず
node tools/run-checks.js --area required         # 必須15本(約1分)
node tools/run-checks.js --changed --base origin/main   # 変更に関係する分(約10分・394本前後。裏で回す)
node tools/battle/stack-marks-check.js           # マーク×数・演出の作り(①〜⑩)
node tools/monster/melody-kuromy-browser-check.js   # 実プレイ: 貯めた数とマーク・EXの残りターンが 3→2→1 と減る(MK_SHOT=<フォルダ> で静止画)
node tools/battle/battle-damage-preview-check.js # 予測と実処理の連撃のそろい
```

- 静止画を撮るときは `melody-kuromy-browser-check.js` の入り方(タクティクスプロ・勇者えらび)を写して、最後に差し込み口で数を入れて撮った。
  クラシックは勇者えらびで「勇者モンに選ぶ」を押す。横持ちは 844×390 / 667×375
- 3本以上の検査を回すときは裏で回し(`run_in_background`)、待つあいだに次の作業の下調べをする

## 守っている決まり(この会話で決まったもの)

- 報告は部員ごとの見出し(クラシックくん/タクティクスくん/イベントくん)。返事待ちは AskUserQuestion
- 許可が出そうな操作(プッシュ・マージ・送信など)の前に、何のため・書き込みか・取り消せるかを日本語で1〜2行(RULES 20)
- 見込みは AI の実作業時間で。延びるなら理由を添えて先に言う(RULES 21)。時刻は必ず `date` で取ってから書く(報告で1回間違えた)
- 画面を作り直したら、対応する検査も同じ PR で直す。検査は外さない・甘くしない。探し方を今の作りに合わせる
- Supabase には部署から触らない(読むだけでも窓口へ頼む)。ランキングの送信・保存データは触らない
- 英語の一言を書くと Stop フックに止められる。作業中のつぶやきも日本語
- **見た目・動きの変更を報告するときは、必ず動画(数秒〜20秒の mp4)と前後の画像を `docs/playbot/reports/<日付>/<名前>/` に置き、パスを窓口へ**(1ファイル10MB以下。2026-10-16 社長「実機で試すのも良いんだけど、動画とか画像を見せてくれる方が助かる」。窓口が社長に見せる)
- 点検(playbot)の最中に作業場所でビルドしない。ボットのブラウザに「新しいバージョンがあります」の帯が出て止まる(2026-10-16 の点検で1回止まった)
