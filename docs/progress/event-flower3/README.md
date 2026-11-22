# 咲かせて！ハナウタ・ノート(r1119-101)の受け口

台本: [`script.md`](script.md)(社長の確認待ち)。検査: `node tools/mode/rhythm-flower3-event-check.js`

## 仕組み(できていること)

| 何 | どこ |
| --- | --- |
| 期間(11/23 10:00〜11/30 0:00・画面は 11/29 23:59 まで)・名前・曲の受け口 | `data/rhythm-event.js` の `FLOWER3_*` |
| ランキング(曲ごと＋総合・回数ボーナス・参加報酬) | 同じファイルの `flower3RhythmEvent` → `RHYTHM_EVENTS` |
| HOMEの帯・周回5倍 | `RHYTHM_EVENT_POINT_CAMPAIGNS` の `flower3_2026`(本オープン記念 `grand_open_2026` も 11/30 0:00 まで延長) |
| ビートP: イベント曲7倍・ほかの曲5倍(r1119-103) | イベントの `targetPointBoost`(`rhythmEventPointAwardAt`) |
| 3曲は開始(11/23 10:00)から全部遊べる(社長「1曲ずつ追加は意図と違う」)。開始より前は曲えらびに出ない | `FLOWER3_SONG_SLOTS` の `openAt`(3曲とも開始)を `rhythm-mode.js` の `rhythmSongReleased` が見る |
| (仕組みだけ残した)開く前の曲は部門に名前を出さない | `rhythmEventDivisions` の `lockedText`。今回は開始前にイベントが開いていないので出ない |
| 開催中は無料・終わったら 500 ビートP | `39-rhythm-song-owned.jsx` の `rhythmSongPrice`(`rhythmEventFreeSongUntilMs` を見る。値段の表には書かない) |
| お話 第1話(開幕)・第2〜7話(毎朝10:00)・第8話(閉幕) | `FLOWER3_STORIES` / `60-app.jsx`。**本文が `EVENT_REPLAYS` に入った話だけ流れる** |
| 回想のまとまり | `10-core.jsx` の `EVENT_REPLAY_GROUPS` の `flower3` |

受け口の曲が1曲も公開曲(`RHYTHM_DEMO_SONG_IDS`)に無いあいだは、イベント・帯・お話はどれも出ない(いまの本番と同じ)。

## 曲を入れる会話へ(rhythm-song-add のあと)

1. `data/rhythm-event.js` の `FLOWER3_SONG_SLOTS` の `songId` を、仮の名前から本物の id へ差し替える

   | 枠 | 開く時刻 | 仮の名前 |
   | --- | --- | --- |
   | 1 みゅあ「BRAND NEW SKY」 | 11/23 10:00 | `flower3_mua_song` |
   | 2 きき「全部必殺技でつ( `･ω･)」 | 11/23 10:00 | `flower3_kiki_song` |
   | 3 もも「きみ待ち♡ループ」 | 11/23 10:00 | `flower3_momo_song` |

2. short ver. を作ったら `FLOWER3_SONG_VERSIONS` に `{ 本編のid: ['本編のid_short'] }`、`39-rhythm-song-owned.jsx` の `RHYTHM_SONG_BUNDLE_OWNER` に `本編のid_short: '本編のid'`
3. **`RHYTHM_SONG_PRICES` には書かない**(書くと開催中も有料になる)。`RHYTHM_SONG_RELEASE_AT` にも書かない(開く時刻はこの表が正本)
4. `node tools/mode/rhythm-flower3-event-check.js` と `node tools/mode/rhythm-event-window-check.js` を通す
5. 曲の告知(更新履歴)を書くなら `visibleFrom` を 11/23 10:00 にそろえる(開始より前は曲えらびに出ないため)

## 残っていること(ことばが続ける)

- お話の本文を `data/assistants.js` へ(社長の OK のあと)。BGM は `EVENT_BGM_SCENES`(曲が入ったら)
- 更新履歴・助手の告知は入れた(11/23 10:00 から出る)。ヘルプのイベントの項目は曲が入ってから
- キービジュアル(横長・社長が作り直し中)。届いたら `images/events/flower3-2026-wide.jpg` に置き、`FLOWER3_BANNER` と更新履歴の予告・開始の2件の `image` にその道を書く(元の大きさのまま・r1115-143)
- 止め絵(縦横・iPhone の切り欠き)は、曲が1曲入ってイベントが出る状態になってから撮る
