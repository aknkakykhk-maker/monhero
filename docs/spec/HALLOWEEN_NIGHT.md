# ハロウィン・ナイト(2026-10-04 8:00 〜 11-01 3:59)

2026-10-03・ユーザー指示。ランキングを開かない「キャンペーン型」のイベント。ランキング型の手順は
[`RHYTHM_EVENT_PLAYBOOK.md`](RHYTHM_EVENT_PLAYBOOK.md)、同じ形の前例は「ビートPアップキャンペーン」(2026-09-28)。

## 何を入れたか

| もの | 置き場 | 要点 |
| --- | --- | --- |
| 期間・ビートP5倍・クイック周回5倍 | `data/rhythm-event.js` の `RHYTHM_EVENT_POINT_CAMPAIGNS`(`halloween_night_2026`) | `boost:5`(ビートP)と `loopScale:5`(演奏で入る周回数)。終わりの `endAt` は 4:00(案内は「3:59まで」) |
| 周回の倍率 | `10-core.jsx` の `rhythmPlayRunLoopScale(songId, event, campaign)` | `loopScale` を持つキャンペーン中は**全曲**その倍率に置き換える(ふだん2倍・ランキングイベントの対象曲3倍とは重ねない) |
| ビートPアップキャンペーンとの重なり | `rhythmEventPointCampaignAt` | 10/4 8:00〜10/5 5:00 は重なる。**あとから始まったほうを使う**(2つ重ねがけはしない) |
| 5部のお話 | `HALLOWEEN_NIGHT_STORIES`(出る時刻)+ `data/assistants.js` の `ASSISTANT_HALLOWEEN_NIGHT_1〜5`(台本)+ `EVENT_REPLAYS` | 第1部=開始・第2〜4部=毎週日曜8:00・第5部=終了(11/1 4:00)。時刻が来た部を古いほうから1つずつHOMEで流す |
| 新曲 | `data/rhythm-mode.js` の `RHYTHM_SONG_RELEASE_AT` | `crazy_party_night` は開始の時刻まで曲えらびに出さない(`rhythmDemoSongs` が見るたびに数え直す) |
| 衣装 | `data/breeder.js` の `halloweenCostume` | みゅあ(魔女)・きき(うさ耳)・もも(小悪魔)。絵は `images/assistant/halloween/`(顔は `make-assistant-faces.js <フォルダ>` で作る) |

## 衣装の売り方(期間で変わる)

`ASSISTANT_COSTUMES` の服に `price` の代わりに `saleWindows` を書く。いま有効な窓だけが売り物になり、**見るたびに数え直す**。

- 開始〜終了(11/1 4:00の前): ビートP交換所で1000P
- 終了から: ダイヤショップで100000ダイヤ
- 開始の前は `released`(getter)が false なので、プロフィールの「着替え」もマーケットのタブも出ない
- 商品の枠は読み込み時に作り、売れるかは `shop`(ダイヤショップ)と `available`(ビートP交換所)の getter が決める

## 守ること

- 保存キーは増やしていない(お話の既読は `mh_rhythm_event_story_v1` の配列へidを足す。服は #2090 の `mh_assistant_costume_*`)
- 期間の文字列は `breeder.js` と `rhythm-event.js` の2か所にある(読み込み順の都合)。食い違わないことは `tools/market/assistant-costume-check.js` が見る
- 検査: `tools/mode/halloween-night-check.js`(倍率・お話の時刻・台本・新曲の出し入れ)、`tools/market/assistant-costume-check.js` と `assistant-costume-browser-check.js`(衣装の売り方を時計を動かして)
- 実ブラウザの検査は `tools/boot/quiet-boot-seed.js` が5部のお話を「見た」ことにする(起動時に画面を覆うため)
