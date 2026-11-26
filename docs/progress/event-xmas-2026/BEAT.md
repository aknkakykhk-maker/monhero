# クリスマスのレイド: モンヒロビート挑戦(ビート部・テンポくん)

台帳 r1119-172(追記・作り始め)/ 追跡 r1125-041。土台はジャックのビート挑戦
(`docs/spec/RAID_JACK_RHYTHM_DAMAGE.md`・`RAID_JACK_RANKING_SOURCE.md`)。つなぎ目はバトル部の [`BUILD.md`](BUILD.md) §2〜§4。

## いまの状態(2026-11-25)

| 段 | 中身 | 状態 |
| --- | --- | --- |
| 1 | ビート挑戦の流れを、イベントごとの**つなぎ口(アダプタ)**で動く部品 `39-raid-rhythm.jsx` に切り出した。ジャックは同じ動き(`raidJackRhythmAdapter`)。クリスマスのつなぎ口 `raidXmasRhythmAdapter` も BUILD.md の形で用意 | この PR |
| 2 | App で `startRaidXmasRhythm(tierIndex)` を作り、クリスマスのつなぎ口に BUILD.md の関数を渡した(画面は `RAID_JACK` を共用・結果は `openRaidXmasResult`・絵は `RAID_XMAS_BOSS_IMG`) | つないだ(止め絵 `beat-connect/`) |
| 3 | BGM: 社長の新曲が届いたら `rhythm-song-add` スキルで入れる。届くまでは今ある曲で遊べる(曲は選び放題のまま) | 新曲待ち |
| 4 | ひとりで進める物語の `startXmasStoryRhythm(chapterId)`(BUILD.md §5) | 段2のあと |

## 流れ(クリスマス)

レイド画面「モンヒロビートで挑む」→ `startRaidXmasRhythm(i)` → 曲えらび(帯は 🎄・段階の名前)→ 決定で `raidXmasUseTry()`(回数1回・hitId と eventId は向こうの値)
→ 演奏 → 最後まで遊ぶとダメージの演出(ボスの絵 `RAID_XMAS_BOSS_IMG`・ライフは `raid_jack_hits` を eventId で引く)
→ `raidXmasRhythmDamageOf(result, difficulty)` → `raidXmasAddDamage({ source:'rhythm', kind:'a', ... detail:{ songName, difficultyName, score, assist } })`
→ 演奏のリザルトを出ていくと `openRaidXmasResult(res)`。途中でやめたら `{ way:'rhythm', damage:0, tierIndex, outcome:'sent', detail }` で結果画面。
表へ直接は送らない(送る・倒した印・再送待ち・バトルの記録はバトル部の関数)。

## つなぐ所(段2・60-app.jsx に数行)

```js
// raidRhythmAdapterOf の中で、鍵が 'xmas' のときだけ ctx を差し替える
raidRhythmAdapter('xmas', { event: RAID_XMAS_EVENT, tiers: RAID_XMAS_A_TIERS, tierAt: (i) => raidXmasTierAt('a', i), bossImg: RAID_XMAS_BOSS_IMG,
  damageOf: raidXmasRhythmDamageOf, useTry: raidXmasUseTry, addDamage: raidXmasAddDamage, openResult: openRaidXmasResult, screen: '<レイド画面の gameState>' })
const startRaidXmasRhythm = (tierIndex) => startRaidJackRhythmSelect(tierIndex, 'xmas');
```

- 曲えらびから戻る画面(gameState)の名前を BUILD.md に書いてほしい(今はジャックの `RAID_JACK` へ倒れる)
- 大王のあとの「無限の相手」の名前があれば `infiniteName` で渡す(演出の名前だけに使う)

## 検査

- `tools/mode/raid-rhythm-adapter-check.js`(偽のつなぎ口で、ジャックの形と BUILD.md の形の両方を見る。保存キーを持たないことも)
- ジャック: `tools/mode/raid-jack-check.js`・`raid-jack-screen-browser-check.js`・`raid-jack-debug-browser-check.js`

## 保存データ・SQL(⑦)

- この部品は保存キーを持たない。回数・倒した印はバトル部の `mh_raid_xmas_v1`。`mh_raid_jack_v1` は触らない
- ビートの source `'rhythm'` は今の制約で許されているので、ビート部としての SQL は無い

## 止め絵と決めごとの突き合わせ(段2)

`beat-connect/xmas-rhythm-sheet.png`(左から: クリスマスのレイド画面 / 曲えらびの帯 / 途中でやめた結果。デバッグの強制表示・390×844)

| 決めごと | 止め絵のどこで満たすか |
| --- | --- |
| レイドバトル(A)だけにモンヒロビートの入口(r1119-172 追記4) | 左: 下の「モンヒロビートで挑戦する」(グランドスラムには出ない) |
| 回数はバトルと同じ(3つの入口で共通) | 中: 帯の「決定すると挑戦回数を1回使います」(回数の口は raidXmasUseTry) |
| ボスは仮(黒いサンタ)・開始まで外に出さない | 左・中: 名前は定義から読む「黒いサンタ(仮)・一」。入口はバトル部の画面(RELEASE_FLAGS.raidXmas)の中だけ |
| ジャックのデータは触らない(⑦) | 検査 `raid-xmas-rhythm-browser-check` ④(mh_raid_jack_v1 は変わらない) |
| 途中でやめたらダメージ0・送らない | 右: 「途中でやめた」「与えたダメージ 0」(検査で送信0件) |
