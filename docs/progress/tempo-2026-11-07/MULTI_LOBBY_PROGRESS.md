# モンヒロビートのフリーマッチ入口(作る/入る・一覧・招待)進捗メモ

2026-11-07 テンポ。社長「この案で作る」(止め絵 `multi-lobby-proposal.jpg`)。ブランチ `claude/tempo-multi-lobby`。

## 決まったこと
1. フリーマッチのタイルを押すと下からシート: 「部屋を作る」「部屋に入る」「おまかせで入る(今までどおり)」
2. 部屋に入る: 開いている部屋の一覧(部屋主の名前・アイコン・ビートランク・人数◯/5・状態)。演奏中・満員は押せない。自動で新しくなる
3. 招待: フリーでもプライベートでも、部屋にいるあいだはいつでも。届く所はモードえらびの上(今)＋HOME の上の帯(新)。3分で消える
- SQL なし。一覧は受付の知らせ(lobby)に項目を足して作る。古い版は足した項目を無視(混ざっても壊れないことを検査で確かめる)
- マージ前に、縦 iPhone 幅の実画面の止め絵と、更新履歴・ヘルプの文の案を統括へ送る

## 作り(77-screen-rhythm-multi.jsx)
- 受付の知らせ: `rhythmMultiCleanRoomNotice` / 部屋主が2秒ごとに送る所 / `findRoom` / `watchLobby`
- 招待: `inviteFriend`(view.code)・`sbSendRoomInvite`・`sbFetchRoomInvites`・`friend_invites`。招待の欄は今 `view.mode==='private'` のときだけ

## 進み具合
- [x] 受付の知らせに部屋主の名前・アイコン・ランク・状態を足す(古い版の形も読める)
- [x] 部屋の一覧を聞く `watchRooms`
- [x] シートと一覧の画面
- [x] 指定した部屋に入る/新しく作る
- [x] 招待の欄をフリーにも・どの段階でも
- [x] HOME の上の帯(招待)
- [x] 検査(古い版の知らせが混ざっても壊れない・文字切れ) — tools/mode/rhythm-multi-room-list-check.js
- [ ] 止め絵・文の案を統括へ → マージ

## メモ
- 演奏中・満員の部屋は知らせが止まるので一覧に出ない(止め絵の「演奏中」の行は出ない)
- 招待から入るときは今までどおり 'private' として入る(friend_invites にモードの欄が無い)。元の部屋主が抜けて部屋主になると、一覧に知らせを出さない
- 「部屋を作る」で作った部屋は noMerge(ひとりでも、ほかの部屋へまとめない)
- 💌 ボタンは部屋の上の帯(🏆 と 💬 のあいだ)。待合いの招待の欄もプライベート以外で出す
- HOME の帯: RhythmInviteHomeBar(60-app の RhythmMultiAwayBar の隣)。入る → rhythmMultiPendingInvite → マルチを開いて joinFromInvite
- HOME の帯はお知らせの窓に隠れたので、body へ直接出す(ポータル・z 99000)
- 実画面の止め絵: multi-lobby-real.jpg(HOME の帯・シート・一覧・💌)
- 追加(社長「結果画面で喋ったときも吹き出しだして」): 結果画面の吹き出しは、今まではカードの中の上端にあって MVP の札を隠していた。カードの外の上へ出す `RhythmMultiResultBubble`(止め絵 multi-result-bubble.jpg)。rhythm-multi-layout-check.js で縦・横・回転を見る
