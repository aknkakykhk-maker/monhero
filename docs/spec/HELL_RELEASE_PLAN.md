# 難易度 HELL の公開の手順(下書き・2026-10-12)

公開そのものは**社長の OK のあと**。ここは「公開の日に何をどこで変えるか」と、そのとき出す更新履歴の下書き。
書いた人: マクアケくん(ビート部・演出係)。数字は 2026-10-12 時点の main。

## 1. 公開の日にすること(上から順に)

| # | すること | 場所 | いまの値 |
| --- | --- | --- | --- |
| 1 | 公開の印を真にする | `src/parts/17-release-changelog-login-missions.jsx` の `RELEASE_FLAGS.rhythmHell` | `false` |
| 1.5 | マスモンランキングの SQL(`docs/sql/rhythm-buddy-ranks/RHYTHM_BUDDY_RANKS_HELL_APPLY.sql`)を社長に流してもらう(印より先) | Supabase | 未 |
| 2 | 更新履歴を1件足す(下の §3 を貼り、**日時はその時の実時刻**に直す) | `data/changelog.js` の `const CHANGELOG = [` の直後 | 未記入(下書きは §3) |
| 3 | ビルドと検査(§4) | — | — |
| 4 | コミット → PR → マージ(CLAUDE.md ②③) | — | — |

印を真にするだけで、下の §2 はすべて自動で切り替わる(コードを書き足す必要はない)。

## 2. 印を真にすると変わるもの(どれも作り込み済み・1か所で変えられる)

| もの | 中身 | 1か所の値 |
| --- | --- | --- |
| HELL がある曲 | Sheriruth(Lv.54・642ノーツ・うち空239)/ Grievous Lady(Lv.60・649ノーツ・うち空220)/ 風がそよぐ場所(Lv.23・193ノーツ・うち空19・空中の入口) | `data/rhythm-mode.js` の `RHYTHM_HELL_CHARTS`(曲を外すときはその1行を消す) |
| レベル | 譜面の値(空中は地上と見なした Lv. の1.2倍・10/12 夕方に3割→2割へ戻した)。レベル表 `RHYTHM_CHART_LEVELS` には HELL の行が無く、譜面の値がそのまま出る | `sheriruthHellChart` / `grievousLadyHellChart` の `mhChart(<Lv>, …)` |
| 開く条件 | その曲の MASTER を1回クリアすると、その曲の HELL が開く。結果画面に「🔓 HELL が解放されました！」 | `data/rhythm-mode.js` の `RHYTHM_DIFFICULTY_UNLOCK_BY.HELL`(`'MASTER'`) |
| お話 | 公開後に HOME へ着いたとき、まだ見ていない全員に「空まで届くビート」→ 説明4枚を1回だけ(MASTER のクリアとは関係なし) | `RHYTHM_HELL_STORY_TRIGGER`(`'release'`。ほかに `'after-result'`・`'home'`・`'none'`) |
| お話の既読 | `mh_rhythm_hell_story_seen_v1`。印が偽のあいだは誰も書けないので、公開の日はまっさら。デバッグの「印が真だったら」で見たぶんは別のキー `mh_rhythm_hell_story_seen_preview_proto` | `rhythmHellStorySeenKey()`(17-*.jsx) |
| 回想 | プロフィールの「イベント回想」に「空まで届くビート ～難易度 HELL～」が出る | `data/assistants.js` の `EVENT_REPLAYS`(`releaseFlag:'rhythmHell'`) |
| ヘルプ | 「難易度 HELL と空のノーツ」(モンヒロビート → ノーツと操作)が出る | `data/help.js` の `id:'rhythm-hell'`(`releaseFlag:'rhythmHell'`) |
| 見た目の既定 | 見やすさ 案2(`RHYTHM_HELL_VIS_DEFAULT='v2'`)・空中の道 Eはっきり(`RHYTHM_SKY_LANE_LOOK_DEFAULT='em'`)・空中のタップ 深い赤・縁を細く薄く(`RHYTHM_SKY_NOTE_COLOR_DEFAULT='deep'`・右手の空中の長押しは桃のまま。前後の絵 `docs/proto/sky-tap-deep/`)・空中の判定の文字は線の下(`RHYTHM_HELL_SKY_TEXT` 既定 `below`)・空中を叩いた柱の光は切(`RHYTHM_HELL_SKY_HIT`。ドライバーくんが軽くしてから) | `data/rhythm-mode.js`・`30-rhythm-play.jsx` |

### 記録とランキング(2026-10-12 社長の決定「満点を105万にしてランキングには乗るようにして/105万のランク【MF】で」)

- HELL の満点は **1,050,000**(`RHYTHM_EXTRA_DIFFICULTIES`)。HELL の満点でだけ届く最上位のランク **MF**(`RHYTHM_RANKS`・色は橙)
- 印を真にすると、**全国ランキング(曲ごと・全曲合算・週間)・マスモンランキング・イベント(回数ボーナス +0.9%/回)・称号(FC/AE/AM の報酬)・フレンドの実績**に HELL が入る(`rhythmScoredDifficultyIds`)。印が偽のあいだは送らない・数えない
- モンヒロビートのミッションはもともと無いので、変わらない
- 自己ベストは `mh_rhythm_best_v1` の `HELL` の欄。110万満点のころにデバッグで付いた値は、起動時に一度だけ 105/110 に縮める(`mh_rhythm_hell_best_rescaled_v1`)
- 全国ランキング(`rankings`)の表・ビューは難易度で絞っていないので SQL は要らない
- ⚠️ **マスモンランキングには SQL が要る**(列 `score_hell` を足す)。**印を真にする前に**社長に流してもらう:
  `docs/sql/rhythm-buddy-ranks/RHYTHM_BUDDY_RANKS_HELL_APPLY.sql`。流さないまま印を真にすると、マスモンランキングの読み書きが断られる

### 公開しても残るもの(デバッグ専用・プレイヤーには出ない)

- デバッグの試作の枠 `sheriruth_hell_debug`・`grievous_lady_hell`(同じ譜面を指している)
- デバッグの切り替え(見やすさ・空中の道・空中の板・手ごたえ・「公開の印が真だったら」)と、その新しいキー(`*_proto`)

## 3. 更新履歴の下書き(公開の日に貼る)

**docs に置いた理由:** 更新履歴の日時は「書いた実時刻」で、`changelog-order-check` がコミット時刻と1時間以上ずれると止める。
いま `releaseFlag` 付きで入れると、公開の日に**今日の日付の古い項目**として並んでしまう。公開の日に、日時をその時の実時刻(`TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'`)に直して貼る。

```js
  {
    date: "YYYY-MM-DD HH:MM", type:'update', title:'モンヒロビート：MASTER のさらに上の難易度「HELL」が遊べるようになりました', status:'new', group:'rhythm',
    items:[
      'Sheriruth と Grievous Lady に、6段目の難易度 HELL が加わりました。地上のノーツに加えて、空から SKY TAP と SKY SLIDE が流れてきます。',
      'その曲の MASTER を1回クリアすると、その曲の HELL が遊べるようになります。',
      'レベルは Sheriruth Lv.54 ／ Grievous Lady Lv.60 ／ 風がそよぐ場所 Lv.23 です。',
      'ノーツ数は Sheriruth 638 ／ Grievous Lady 649 です。',
      'SKY TAP（赤い板）は、地上の判定ラインより上にある紫の線で叩きます。横の位置は地上と同じレーンです。',
      'SKY SLIDE は、押さえたまま帯をなぞります。帯が青なら左手、桃なら右手が取る目印です。',
      'HELL が遊べるようになった日に、助手のお話「空まで届くビート」と遊び方の説明が1度だけ流れます。プロフィールの「イベント回想」から見返せます。',
      'HELL の満点は 1,050,000点です。満点を取ったときだけ、M のさらに上のランク「MF」が付きます。',
      'HELL のスコアは自己ベストに残り、全国ランキング（曲ごと・全曲の合算・週間）やマスモンランキング、イベントにも入ります。',
    ],
  },
```

- `assistantNotice`(助手の告知)は**付けない**(2026-10-12 社長の決定)。公開の日にお話と説明が全員に流れるので、告知を付けると同じ知らせが2回になるため。上の下書きにも `assistantNotice` は書いていない
- 公開の日にレベル・ノーツ数が変わっていたら、上の2行を直す(`song-numbers-check` が見張る)

## 4. 公開の前後に回すもの

```
node tools/build.js
node tools/run-checks.js --area required 2>&1 | tail -20
node tools/run-checks.js --changed 2>&1 | tail -20
node tools/boot/changelog-order-check.js
node tools/changelog/player-words-check.js
node tools/changelog/song-numbers-check.js
node tools/boot/save-keys-check.js
node tools/mode/rhythm-released-chart-lock-check.js
node tools/mode/rhythm-chart-level-check.js          # 公開したら公開曲のほうを見る(検査のコメントどおり)
node tools/boot/event-replay-check.js
node tools/playbot/rhythm-hell-unlock-bot.js --story   # お話が HOME で1回だけ流れるか
```

- ⚠️ `rhythm-hell-unlock-bot.js` は「印が偽なら出ない」を最初に確かめる作りなので、**印を真にしたら最初の2項目が NG になる**。
  公開の PR で、印が真のときは「印が偽」の項目を飛ばすように直す(ボットは CI には入っていない)
- 公開前に、デバッグの「公開の印が真だったら」で、MASTER クリア → HELL が開く → お話 → 説明、を一度通しておく(`node tools/playbot/rhythm-hell-unlock-bot.js` の通し版・約6分)

## 5. 社長に聞いてから決めること

- ~~助手の告知を付けるか~~ → **付けない**に決まった(2026-10-12 社長)
- 空中を叩いた柱の光を既定にするか(ドライバーくんが軽くしたあと)
