# クリスマスのイベントに関わる検査で、いまの main で元から落ちる物(台帳 r1126-079)

社長「(検査の待ちを減らすのは)イベント関連だけでいいよ」→ 検査部(ミハリ)が、いまの main で1回だけ回して、元から落ちる物をまとめた。
**この一覧に載っている物は、各会話で「元からか今回のせいか」を切り分けなくてよい。新しく落ちた物だけ見る。** 検査そのものは省かない。

- 回した main: **`eb46a544a`**(#7921 のマージ・2026-11-27 23:00 ごろ)
- 回し方: `node tools/build.js` のあと `node tools/run-checks.js --script <下の61本> --parallel 4 --timeout 600`
- 結果: **61本 / OK 55 / NG 4 / SKIP 2**(NG の4本は、run-checks が1本ずつ回し直しても NG)
- 2026-11-28 ビート部(台帳 r1126-083): `assistant/assistant-chat-check.js` ㉓ を直して外した(ヘルプの「SKY SLIDE（桃・青の帯）」を受けるように)。下の表で直っていないのは `boot/changelog-order-check.js` の1本(開発部)

## 元から落ちる物(NG 3本)

| 検査 | 落ちた行の要点 | 原因の見立て |
| --- | --- | --- |
| `boot/changelog-order-check.js` | 「書いてある順も日付の新しい順 — 17か所で逆転」 | `changelog.js` に書いてある順が日付の順と17か所で逆。画面は `17-release` で日付順に並べ替えているので、表示は崩れない。前から(#7876 の時点で18か所)。クリスマスの項目を足すと数が1つ前後することがある |
| `assistant/assistant-life-quick-lose-check.js` | ②「負け→始め直し→『止める』で、前の負けの札が出ない — live」が NG | **直した(検査が古かった)**。11/22 に入った「初めての1回は自動で開く ❓ 助手ライフの見かた」の窓が帯にかぶり、「止める」が押せていなかった(Hell でまた負けた正しい札が見えていた)。検査で見かたを既読にし、押す所のかぶりも見るようにした(助手部ナカヨシ) |
| `assistant/assistant-life-quick-run-browser-check.js` | ⑧「『詳細』でカードと同じ詳細の窓が助手ライフの上に出る — null」が NG | **直した(検査が古かった)**。上と同じく見かたの窓が「詳細」にかぶっていた。同じ直し(助手部ナカヨシ) |
| `assistant/assistant-art-scenes-check.js` | 「ばらつき map — 最大÷最小 1.62(mua 5.7px 〜 kiki 9.2px)」「map 立ち絵 小さすぎ」 | **絵の問題で、検査は正しい。今回は触らない**。全身絵への切り替えで、みゅあ(ふだん)が羽まで横に広く入り地図の顔が小さい。社長の選択「今のまま公開して Muse が直す」(台帳 r1124-006・Muse 待ち)。横小(568×320)ではほかの助手も一部 5px を割る。数字は `docs/progress/assistant-art/r1119-153-switch/MUSE.md`(助手部ナカヨシ・2026-11-28) |

## この環境で回らない物(SKIP 2本)

| 検査 | 理由 |
| --- | --- |
| `assistant/life-fullbody-pocket-check.js` | 部品 `canvas` が入っていない(`Cannot find module 'canvas'`)。手で回すと止まる |
| `mode/rhythm-help-structure-check.js` | run-checks の中では SKIP。1本で回すと「すべてOK」 |

## 回した61本(すべて OK 以外は上の表)

- 必須: `check-syntax.js`・`undefined-reference-check.js`・`jsx-text-brace-check.js`・`render-error-check.js`
- 事件簿: `novel/xmas-novel-check.js`・`xmas-novel-browser-check.js`・`xmas-novel-wrap-check.js`
- イベントページ・開幕・序章・レイドのお話: `battle/xmas-flow-browser-check.js`・`xmas-open-1128-browser-check.js`・`xmas-prologue-browser-check.js`・`raid-xmas-check.js`・`raid-xmas-story-browser-check.js`
- レイド(ビート・カード): `mode/raid-xmas-rhythm-browser-check.js`・`raid-rhythm-adapter-check.js`・`card/card-raid-check.js`・`card-raid-browser-check.js`・`card-raid-xmas-browser-check.js`・`card-raid-xmas-starter-browser-check.js`・`card-event-bonus-check.js`
- 曲・Battle #5・5倍: `mode/rhythm-song-version-check.js`・`rhythm-released-chart-lock-check.js`・`rhythm-flower3-event-check.js`・`boot/rhythm-xmas-campaign-check.js`・`mode/quick-rhythm-autostart-check.js`・`quick-rhythm-guide-check.js`
- 更新履歴・ヘルプ・お知らせ: `changelog/*`(14本)・`boot/changelog-order-check.js`・`help-new-badge-check.js`・`market-notice-check.js`・`update-notice-style-check.js`・`assistant/assistant-update-notice-check.js`・`update-notice-bundle-check.js`
- 文字の折り返し・表記: `boot/ja-wrap-check.js`・`ja-wrap-beat-play-check.js`・`ui/ui-kanji-check.js`
- HOME の帯・台詞・裏クイック: `assistant/assistant-season-lines-check.js`・`assistant-chat-check.js`・`battle/quick-run-anywhere-browser-check.js`・`quick-run-anywhere-strip-overlap-check.js`・`assistant/assistant-life-quick-*`・`quick-guide-check.js`・`mode/rhythm-background-run-check.js` ほか

一覧は `node tools/ctx.js checks <語>`(クリスマス・聖夜・事件簿・レイド・裏クイックなど)で引いた物から、クリスマスに直接関わる物を選んだ。main が進んで、この表に無い物が落ちたら、それは新しく落ちた物として切り分ける。

## 2026-11-28 直した物: 「RHYTHM_TOUCH_DIAG_STATS_MAX is not defined」で落ちていた52本(ビート部・r1126-083)

- 原因: 検査が共通で使う `tools/harness.js` の `loadDyeModule` が、本体より先に読むデータに `data/rhythm-mode.js` を入れていなかった。
  `30-rhythm-play.jsx` の頭の `RHYTHM_TOUCH_DIAG_MON_MAX=RHYTHM_TOUCH_DIAG_STATS_MAX` で止まる。**本番は index.html が `data/rhythm-mode.js` を本体より先に読むので、壊れていなかった**
- 直し方: `DATA_FILES` に `data/rhythm-mode.js` を index.html と同じ順(`skills.js` の次)で足した。検査は弱めていない
- `loadDyeModule` を使う52本すべてが落ちていた → 直した後は50本が通る。残り2本はこの名前の先まで進んで、それぞれ中身の NG が見えるようになった(元は手前で止まって隠れていた):

| 検査 | 落ちた行の要点 | 持ち主 |
| --- | --- | --- |
| `battle/card-icon-check.js` | 「iconをそのまま描いている箇所が残っていない — ev.icon, t.icon, g.icon, d.icon」 | バトル部 → **直した(2026-11-28)**: 4か所(助手ライフのタブと成長・モンサクの効果・レイドの報酬一覧の見出し)を `cardIconNode()` に通した。絵文字はそのまま文字で出るので見た目は同じ |
| `ui/screen-effects-check.js` | 「表の目印は…ちょうど1つある — totals.a[prep.tierIndex + 1](2件)…」「表の件数と setTimeout の数が合っている — 172 箇所 / 表 164 行」 | 画面の演出(`40-screen-effects`・開発部) |

## バトル部: `battle/wave-result-layout-check.js`(2026-11-28 直した)

- 落ちていた所: 3つの大きさ×2つの場合すべてで「画面を描ける」
- 原因: WAVE の結果画面の点数の欄が、幅に合わせて字を縮める部品 `FitNumber`(41-screen-ui.jsx)を使うようになったのに、検査が画面を切り出して描くときにその部品を持っていなかった(`FitNumber is not defined`)。ゲーム本体は壊れていない
- 直し方: 検査が `FitNumber` の本体をゲームの元からそのまま切り出して一緒に描くようにした(ダミーにしない)。測る中身(ボタンが画面内・先頭がはみ出さない・押せる高さ・横にはみ出さない)は変えていない
