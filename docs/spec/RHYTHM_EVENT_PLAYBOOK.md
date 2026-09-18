# モンヒロビートのイベントを開く手順

2026-09-11・ユーザー指示「今後イベントはこの形式になると思うから記録に残しといてね」。

週末ゲリラ杯（初開催・2026-09-11 15:00 〜 09-14 05:00）で作った形を、次からの雛形として残す。
仕組みの説明は [`RHYTHM_RANKING.md`](RHYTHM_RANKING.md)、この文書は**やることの順番**だけを書く。

## 0. 先に決めること（ユーザーに聞く）

| 決めること | 週末ゲリラ杯での例 |
| --- | --- |
| 名前 | モンヒロビート 週末ゲリラ杯 |
| 期間 | 9/11(金) 15:00 〜 9/14(月) 5:00 |
| 対象曲 | Monster Hero / 風がそよぐ場所 / Close To Your Heart |
| 曲ごとの報酬 | その曲の種族の超越の実 |
| 総合の報酬 | 勇者の証 |
| 参加報酬 | 対象曲を3曲すべて遊ぶと ダイヤ3,000 ＋ 虹のプシュケー50 |

**終わりは週の区切り（月曜5:00）に合わせる。** 理由は「**イベントが週をまたがないようにする**」ため。
またぐと、そのイベントの記録が2つの週間ランキングへ割れてしまい、
「イベントで出した記録なのに、今週の週間ランキングに半分しか入っていない」状態になる。
区切りに合わせておけば、イベントの期間はまるごと1つの週の中に収まる。

> 週間ランキングは**イベント中もずっと動いている**（別のタブ）。お休みにはならないので、
> 「イベントが終わると週間へ戻る」という理解は違う。2つは最初から同時に動いている。

順位ごとの個数（5/4/3/2/1）とプシュケー（1,000/800/600/400/200）は
`RHYTHM_EVENT_REWARD_COUNTS` / `RHYTHM_EVENT_REWARD_PSYCHE` の共通の決めごと。
**イベントごとに変えない**（変えると全イベントに効く）。

---

## 1. イベントを1つ足す — `monster-hero/data/rhythm-event.js`

`RHYTHM_EVENTS` へ1件足すだけ。**画面のコードは1行も触らない。**

```js
Object.freeze({
  id: 'weekend_2026_09_11',            // 保存にも使う。あとから変えない
  kind: 'limited',                     // 期間限定は必ず 'limited'
  name: 'モンヒロビート 週末ゲリラ杯',
  startAt: '2026-09-11T15:00:00+09:00',
  endAt:   '2026-09-14T05:00:00+09:00',  // ★週の区切り(月曜5:00)に合わせる
  banner: 'images/events/◯◯-wide.jpg',   // 横長。?v= は build.js が打つ
  songIds: Object.freeze(['monster_hero', 'kaze_ga_soyogu', 'close_to_your_heart']),
  rewardLineageBySongId: Object.freeze({ monster_hero:'suezo', kaze_ga_soyogu:'mocchi', close_to_your_heart:'tiger' }),
  totalReward: 'heroProof',
  playBonus: true,                       // 回数ボーナスを付けるなら書く（書かなければ加点なし）
  participationReward: Object.freeze({ songs: 3, gold: 3000, psyche: 50 }),
}),
```

- 部門は「対象曲ごと＋総合」。**数は `songIds` から自動で作られる**ので、3曲でも5曲でも画面は変わらない
- `rewardLineageBySongId` の血統idは実在するものだけ（検査が見る）
- **SQLは触らない。** 対象曲と期間は引数で渡すので、関数の定義はそのまま使い回す
- `playBonus: true` を書くと、期間中に対象曲を遊んだ回数ぶん自分のベストへ加点される
  （割合は `RHYTHM_EVENT_PLAY_BONUS_RATES`。仕様は `RHYTHM_RANKING.md` §7.2）。
  **割合を変えてもSQLは流し直さない**（問い合わせのたびに引数で渡している）

## 2. 告知画像を2枚つくる — `monster-hero/images/events/`

| 用途 | 形 | 目安 |
| --- | --- | --- |
| 起動時の助手の告知・お知らせの項目 | 正方形 880px JPEG | 150KB以内 |
| イベントタブ・イベント詳細 | 横長 1000×500 JPEG | 150KB以内 |

元絵は数MBあるので**そのまま入れない**（CLAUDE.md ⑥-2）。`sharp` で `quality:80` / `mozjpeg`。
**起動時には読み込まない**（`index.html` の `SIZES` に入らないことを検査が見張る）。

画像を参照するファイルを増やしたときは、`tools/stamp-version.js` の `IMAGE_HOST_FILES` と
`tools/image-asset-check.js` の `sources` の**両方**へ足す。片方だけだと「使われていない画像」と誤判定される。

## 3. お知らせを1件足す — `monster-hero/data/changelog.js`

**先頭へ**足す。日時は**一覧に出はじめる時刻**（＝`visibleFrom`）にそろえる。

```js
{
  date: "2026-09-11 15:00", type:'event', title:'【週末限定】…週末ゲリラ杯を開催します', status:'new',
  releaseFlag:'rhythmWeeklyRanking',
  visibleFrom:'2026-09-11T15:00:00+09:00',        // ★開始まで一覧に出さない
  image: 'images/events/◯◯.jpg',                   // 正方形のほう
  assistantNotice: {
    id:'update_notice_◯◯_v1', type:'content',
    notifyFrom:'2026-09-11T15:00:00+09:00',        // ★visibleFrom と同じ時刻にそろえる
    notifyUntil:'2026-09-14T05:00:00+09:00',
    destination:'RHYTHM_DEMO_HOME', buttonLabel:'モンヒロビートへ',
  },
  items:[ … ],
}
```

- **`visibleFrom` と `notifyFrom` は同じ時刻にする。** 一覧と助手の告知が同時に出はじめる（検査が見る）
- **`date` も同じ時刻にする**（2026-09-17・ユーザー指摘「時間前に更新情報が入ってた」）。
  一覧に出はじめるのは `visibleFrom` の時刻なのに、書いた実時刻（11:37）を `date` に入れていたため、
  12:00開始のイベントなのに **11:37 と表示されていた**。⑤の「日時は実時刻」は
  「未来の日時やきりのいい連番を作らない」ための決めごとなので、
  **時刻で出し入れする項目では『出はじめる時刻』がその項目の実時刻**になる。
  （第1回でも同じずれが3件あるが、すでに公開・既読済みで並び順にも関わるため直していない）
- **種別は `type:'event'`（画面では「イベント」）**。`update` は「改善」と表示されるので使わない
  （2026-09-17・ユーザー指摘「タブが改善になってる」）
- 対象曲の名前と報酬の中身は**ここには書いてよい**（そのイベント1回かぎりの案内なので古くならない）。
  「全◯曲」のような、曲が増えると古くなる数字は書かない

## 4. 助手のセリフを3人ぶん書く — `monster-hero/data/assistants.js`

`ASSISTANT_UPDATE_NOTICE_SCRIPTS['update_notice_◯◯_v1']` へ `mua` / `kiki` / `momosuke` の3人ぶん。
用意しないと `items` の事務的な文をそのまま読み上げるので、助手が説明している感じにならない。

**呼び方の決めごと**（2026-09-11・ユーザー指示）
- みゅあ・ももすけ … 「モンビー」（略称）
- きき … 「モンヒロビート」（正式名称）

## 5. イベント会話を書く — `monster-hero/data/assistants.js`

```js
const ASSISTANT_◯◯_EVENT = [ { who:'momosuke', e:'excited', t:'…' }, … ];
const ASSISTANT_◯◯_EVENT_CALLS = { mua:'もも', kiki:'ももさん', momosuke:'みゅあねぇ／ききちゃん' };
// EVENT_REPLAYS へ1行足す
{ id:'◯◯_2026_09', title:'… ～はじめての大会～', script:ASSISTANT_◯◯_EVENT,
  calls:ASSISTANT_◯◯_EVENT_CALLS, unlockedKey:'◯◯EventSeen' },
```

- 長さの目安は**38行・約850字**（きき加入10行 / ももすけ登場39行）。スキップできるので長くてよい
- **数字（報酬の個数・順位）を書かない。** 次のイベントで必ず古くなる
- セリフの `{name}` は、話している助手の呼び方（絆Lvと `assistantCallStyles`）に置き換わる
- 期間が終わってもプロフィールの「イベント回想」から見返せる
- BGMは `EVENT_BGM_SCENES` へ枠を足して既定曲を指定する

`60-app.jsx` の `MONBEAT_CUP_STORY_ID` にあたる定数を、新しい回想idへ向ける。

## 6. デバッグから確かめられるようにする

ヘルプ → 💊 → デバッグ設定 →「💖 みゅあデバッグ」に5つ置いてある。
**どれも「見た」ことにしない**ので、本番のときにちゃんと出る。

| ボタン | 見えるもの |
| --- | --- |
| 🏆 イベント開催を再生（会話→告知） | 本番と同じ順番で通し |
| イベント会話だけ再生 | 会話だけ |
| イベント告知だけ再生 | 選んでいる助手の説明（画像つき） |
| 入賞の受け取り画面を見る | 見本の順位で受け取り画面 |
| イベントを未読へ戻す | 会話と告知を未読に戻す |

デバッグ専用なので、**更新履歴とヘルプには載せない**（CLAUDE.md ⑤の但し書き）。

## 7. 画面の構成（触らなくてよいが、こうなっている）

```
曲えらび          初回だけ大きい案内(吹き出し・告知画像・対象曲・ボタン)。×で閉じたら出ない
イベントタブ      期間の帯 → 🎁 イベント詳細 → 部門 → 順位の一覧
イベント詳細      告知画像 → 名前と期間 → 対象曲 → 部門ごとの報酬(全部門) → 参加報酬 → 受け取り方
```

- **報酬の表は詳細の中だけ。** 一覧の上に積むと順位が画面の外へ出る（2026-09-11・ユーザー指摘）
- 詳細は画面の**真ん中**に出す。高さは `--mh-vh` から引く（`max-h-full` に頼らない）
- 数字は1つも書き写さない。部門も順位も個数もデータから作る

## 8. 公開の流れ

```
node tools/build.js
node tools/check-syntax.js
node tools/undefined-reference-check.js
node tools/jsx-text-brace-check.js
node tools/render-error-check.js
node tools/mode/rhythm-event-window-check.js
node tools/mode/rhythm-play-bonus-check.js   # 回数ボーナスを付けたイベントのとき
node tools/assistant/assistant-update-notice-check.js
node tools/boot/changelog-order-check.js
node tools/image-asset-check.js
```

通ったらコミット → プッシュ → PR → マージ（CLAUDE.md ②③）。
**開始時刻より前に公開してよい。** `visibleFrom` / `notifyFrom` が時間になるまで止める。

## 8-2. 閉幕の会話（2026-09-13 に足した形）

イベントが**終わった時刻に自動で流れる**会話。初開催のお礼（参加賞へ勇者の証10個）を
知らせるために作ったが、次のイベントでも同じ形で使える。

- 台本は `data/assistants.js` へ1本足して、`EVENT_REPLAYS` に登録する
  （`unlockedKey` は本体側の `EVENT_REPLAY_UNLOCK_FLAGS` へ1行）
- BGMは `EVENT_BGM_SCENES` へ1行（開催の会話と同じ曲でよい）
- 流すのは `rhythmLimitedEventJustEnded(Date.now())`。**見るたびに数え直す**ので、
  開きっぱなしの端末でも終了時刻をまたいだ次の見回り（1分おき）で流れる
- **会話が先、受け取り画面はあと。** `checkRhythmEventRewards` は会話を見るまで何もせずに戻り、
  見終えたところで呼び直す。逆にすると「先に報酬が出て、あとから説明」になる
- 報酬を増やしたときは、**会話で言う数と実際に配る数を一致させる**
  （`tools/mode/rhythm-event-thanks-check.js` が突き合わせる）
- 更新履歴の `visibleFrom` は**イベントの終了時刻と同じ**にする（会話と同時に出はじめる）
- 参加賞へ勇者の証を足すときは `participationReward` に `heroProof` を書く。
  書かないイベントでは 0 になるので、これまでの形をそのまま読める

## 8-3. 報酬は**ギフトで届ける**（2026-09-14）

> 「イベント報酬が直接アイテム欄に入ってた / ギフト経由して」

受け取り画面の「🎁 ギフトで受け取る」は、**アイテム欄へ直接入れずギフトを1件作る**。
プレイヤーはHOMEの「ギフト」から受け取る。何をいくつもらったかが残るのが狙い。

- 中身の組み立ては `rhythmEventGiftRewards(prize)`（`28-rhythm-shared.jsx`）。
  **同じ種類は1行にまとめる**（部門ごとにプシュケーが付くので、まとめないと同じ行が並ぶ）
- アイテムは `{ type:'gameItem', itemId, amount }` で**idをそのまま持つ**。
  名前は実データから引かれるので、種族の数だけ種類を書き足さなくてよい。
  知らないidはギフトごと無効になる（黙って配らない）
- ダイヤ・虹のプシュケーは既存の種類（`diamond` / `rainbowPsyche`）のまま
- ギフトのidは `rhythm_event_<イベントid>`。`grantGiftOnce` が同じidを二重に作らない
- `expiresAt` は書かない＝**ギフトボックスに届いたあとは期限なし**
  （受取期限2週間は「受け取り画面が出るまで」の話）
- 通しで動くかは `tools/mode/rhythm-reward-gift-check.js` が実際に数を突き合わせる

## 9. 終わったあと

- 終了後の最初の起動で、閉幕の会話（あれば）が流れ、そのあと入賞していた人に受け取り画面が出る
- 「ギフトで受け取る」を押すとギフトが届く。アイテムが入るのはギフトボックスで受け取ったとき
- 受け取れるのは**終了から2週間**（`RHYTHM_EVENT_REWARD_CLAIM_MS`）
- 順位は終了した時点で固まるので、遅れて受け取っても内容は変わらない
- 受け取り済みは `mh_rhythm_event_reward_v1` に残る。**先にフラグを保存してからアイテムを足す**

---

## ★踏んだ落とし穴（同じことを繰り返さないため）

初開催のときに実際に出した不具合。どれも**公開してから**分かったもの。

| 症状 | 原因 | 直し方 |
| --- | --- | --- |
| 開始前なのにお知らせ一覧にイベントが並ぶ | 一覧に時刻の制限が無かった（告知だけ `notifyFrom` で止めていた） | 更新履歴の項目へ `visibleFrom` |
| 15:00になってもお知らせに NEW が付かない | NEW は「未読か」で出る。開始前に一覧を開いた端末が既読にしていた | `visibleFrom` の項目だけ一度きりで未読へ戻す（`mh_changelog_timed_seen_fix_v1`） |
| 会話に `{name}` がそのまま出る | 回想の台本を素の `{line.t}` で描いていた | `assistantSpeakText` を通す。呼び方は `assistantCallStyles[助手id]`（`normalizeAssistantBond` には**入っていない**） |
| 遊んでいる最中の人に会話も告知も出ない | 開催中かの判定が起動時の1回だけ | 1分おきに見に行く。流すのはHOMEに着いてから |
| ↑を直しても告知だけ出ない | 告知の `enabled` が読み込み時に1回だけ決まる値だった | `notifyFrom`/`notifyUntil` を持たせ、`availableUpdateNotices` が毎回数え直す |
| ↑を直してもまだ出ない | `visibleFrom` の副作用で、告知idが `HIDDEN_UPDATE_NOTICE_IDS`（読み込み時に1回だけ作る）へ入っていた | ここで隠すのは `dev` と `releaseFlag` だけにする |
| 曲えらびが1画面に収まらない | 吹き出し・告知画像・対象曲・ボタンを縦に積んでいた | 初回だけ出す形に戻す（×で閉じたら出ない） |
| イベントタブで順位が見えない | 告知画像と報酬表を一覧の上に積んでいた | 詳細へ移す |
| 詳細が下にずれる | 下から生やす形（`items-end`）だった | 真ん中に出し、高さを `--mh-vh` から引く |
| 閉幕の会話より先に受け取り画面が出る | 受け取りは起動時に1回だけ確かめていた | 会話を見るまで待たせ、見終えたら呼び直す（§8-2） |
| 閉幕の会話が2回続けて流れる | 「見た」が付くのは最後まで見たとき。読んでいる最中に1分おきの見回りが回り、もう一度並べていた | 流し始めたことを覚えるref（`rhythmEventStoryStartedRef`）で二度並べない |
| 報酬が黙ってアイテム欄に増える | 受け取りで `mh_owned_items` へ直接足していた | ギフトで届ける（§8-3） |
| 総合の順位だけ反映が遅い | タブを開いたときに一度取ったきりだった | タブ・部門を押すたびに取り直す（前の順位は消さない） |
| 回数ボーナスを端末で足すと上位が消える | 並べ替えと上位50件の切り出しはサーバーがしている | 加点はSQLの中でやり、加点込みの値で並べる（§7.2） |

**共通の教訓**: 「時刻で出し入れするもの」は、**読み込んだときに1回だけ決まる値を使わない**。
`enabled` のような静的な値も、`HIDDEN_UPDATE_NOTICE_IDS` のような静的な集合も、
開きっぱなしの端末では永久に古い答えのままになる。時刻の判定は**見るたびに数え直す**。

## まだ入っていないもの

- **イベント行の「詳細」ボタン**。判定の内訳は `rankings` の `party` 列にあるが、
  `rhythm_event_song_bests` の返り値に含まれていないので出せない。
  ビューと関数へ `party` を通すSQLを1回適用すれば、以後のイベントでも自動で効く
