# クリスマスのイベントに関わる検査で、いまの main で元から落ちる物(台帳 r1126-079)

社長「(検査の待ちを減らすのは)イベント関連だけでいいよ」→ 検査部(ミハリ)が、いまの main で1回だけ回して、元から落ちる物をまとめた。
**この一覧に載っている物は、各会話で「元からか今回のせいか」を切り分けなくてよい。新しく落ちた物だけ見る。** 検査そのものは省かない。

- 回した main: **`eb46a544a`**(#7921 のマージ・2026-11-27 23:00 ごろ)
- 回し方: `node tools/build.js` のあと `node tools/run-checks.js --script <下の61本> --parallel 4 --timeout 600`
- 結果: **61本 / OK 55 / NG 4 / SKIP 2**(NG の4本は、run-checks が1本ずつ回し直しても NG)

## 元から落ちる物(NG 4本)

| 検査 | 落ちた行の要点 | 原因の見立て |
| --- | --- | --- |
| `boot/changelog-order-check.js` | 「書いてある順も日付の新しい順 — 17か所で逆転」 | `changelog.js` に書いてある順が日付の順と17か所で逆。画面は `17-release` で日付順に並べ替えているので、表示は崩れない。前から(#7876 の時点で18か所)。クリスマスの項目を足すと数が1つ前後することがある |
| `assistant/assistant-chat-check.js` | ㉓「毎回渡す部分に、ヘルプのノーツの見た目の表(TAP 水色・SKY TAP 赤い板など)…が入っている」が NG | 検査が待っている語「SKY SLIDE（青・桃の帯）」「空の判定ライン: 地上の判定ラインより上にある紫の線」が、いまのヘルプ(`help.js`)に無い(ヘルプの書き方が「SKY SLIDE（桃…」などに変わった)。モンヒロビートのヘルプと検査の食い違いで、クリスマスとは関係ない |
| `assistant/assistant-life-quick-lose-check.js` | ②「負け→始め直し→『止める』で、前の負けの札が出ない — live」が NG | 助手ライフの裏クイックの負けの札。クリスマスの変更は触れていない所(未切り分け・持ち主はビート部/助手部) |
| `assistant/assistant-life-quick-run-browser-check.js` | ⑧「『詳細』でカードと同じ詳細の窓が助手ライフの上に出る — null」が NG | 助手ライフの裏クイックの「詳細」の窓が出ない。上と同じく、クリスマスの変更とは別の所(未切り分け) |

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
