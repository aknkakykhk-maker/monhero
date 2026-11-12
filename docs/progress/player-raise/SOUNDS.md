# モンヒロサクセスの音の割り当て(2026-11-12 開発部)

新しい音源は作らない。今ある BGM(`BGM_TRACKS` の id)と効果音(`Audio_.fgSe`)を場面に割り当てるだけ。
表: `monster-hero/data/success-sounds.js` / 鳴らす口: `monster-hero/src/parts/14-success-sound.jsx` / 見張り: `node tools/success/success-sound-check.js`

| 場面 id | 曲 | 効果音 |
| --- | --- | --- |
| `main`(住む場所) | 春 `original_home` / 夏 `ichika_home` / 秋 `original_profile` / 冬 `original_enhance` | なし |
| `trainGreat` 大成功 | 続ける | `trainingGoal` |
| `trainOk` 成功 | 続ける | `trainingGood` |
| `trainFail` 失敗 | 続ける | `trainingFail` |
| `trainSkip` サボり | 続ける | `trainingMove` |
| `scold` 叱る | 続ける | `trainingBad` |
| `praise` 褒める | 続ける | `trainingReward` |
| `trainLvUp` 訓練Lvアップ | 続ける | `levelUp` |
| `ascetic` 修行 | `original_prep` | `trainingDecide` |
| `cupEntry` 大会の受付 | 続ける | `join` |
| `cupMatch` 大会の試合 | `original_battle` | `trainingDice` |
| `cupWin` 大会の勝ち | `ichika_clear` | `rankFanfare` |
| `cupLose` 大会の負け | 続ける | `trainingFail` |
| `issa` イッサ博士 | `original_event_01` | `trainingTool` |
| `gameOver` | `original_game_over` | なし |
| `retire` 引退 | `original_result` | `rankFanfareGrand` |

## 画面からの呼び方(回2・回3)
- 画面の中: `useSuccessSound(場面id, { season, delayMs })`。場面が替わるたびに鳴り、画面が消えると後片付けする。
  `on:false` を渡すあいだは何もしない
- フックを使えない所: `SuccessSound.scene(場面id, { season, delayMs })` で入る/鳴らす、離れるときに `SuccessSound.leave()`。
  `SuccessSound.bgm(id, season)` と `SuccessSound.se(id, delayMs)` は曲と効果音を別々に鳴らす
- `season` は `successSeasonOfMonth(月)`(`data/success-scenes.js`)の値(spring/summer/autumn/winter)
- 音量・消音はいまの設定がそのまま効く(口は触らない)。サクセスにいるあいだ、裏の周回(クイック)のバトルの効果音は止まる
- ★`60-app.jsx` の `setBackgroundSeQuiet` の effect(`cardScreenOpen || quickAnywhereScreenOpen || …`)に、サクセスの画面が開いているか(`successScreenOpen`)も足すこと。
  足さないと、ほかの画面の都合で印が外れて裏の音が出る
- ★BGM を画面の状態から決める流れ(`bgmKeyForState`)に載せるなら、`successSoundBgm(場面id, season)` の値を返す。口の `bgm` と二重にしない(どちらか一方)
