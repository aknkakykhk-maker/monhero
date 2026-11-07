# 助手どうしのつながり — 進み具合(ナカヨシ)

計画: [`../assistant-peer-plan.md`](../assistant-peer-plan.md)。枝 `claude/assistant-peer`。

## できたこと(2026-11-07)

| 段階 | 中身 | 置き場所 |
| --- | --- | --- |
| 1 会話の共有 | おしゃべりのとき、30日以内に話したほかの助手の思い出メモを `ctx.peerMemos` で送る。メモに「ないしょの話」(secret)の欄を足し、そこと「ないしょ/秘密」らしい言葉・個人情報らしい文は渡さない。話した日は `mh_assistant_chat_last_v1` | 端末 `src/parts/56-assistant-chat.jsx` / サーバ `supabase/functions/assistant-chat/core.js`(`normalizePeerMemos`・`peerMemosText`・決まり文3行・メモの secret 欄)。**サーバは窓口が配るまで古いまま**(古いサーバは peerMemos を読み捨てるだけで壊れない) |
| 2 ペアの仲良し度 | Lv1〜5(0/30/90/180/320)。お話 +6・切り替え +3・掛け合い +2、ペアごとに1日12まで。Lv2 掛け合いが増える / Lv3 関係図に線 / Lv4 息の合った掛け合いが増える・API 版でお互いの話題を多めに(呼び方は変えない・2026-11-07 社長) / Lv5 特別なお話 | データ `data/assistants.js` 末尾 / 端末 `src/parts/56-assistant-peer.jsx` / つなぎ `60-app.jsx`(chooseAssistant・お話の finish・表示)・`56-screen-profile.jsx`(関係図) |
| 3 台本版の掛け合い | 28ペア×(Lv1 2本・Lv2 1本・Lv4 1本・Lv5 特別なお話)= 140本。HOME 1日5回(入るたび4割)・ほかの画面 1日3回(2割5分)・続けて流さない90秒 | `ASSISTANT_PEER_TALKS`(`{c}` = 話し手の相手の呼び方) |
| 3 API 版の掛け合い | HOME に入ったとき、その日の分が尽きていれば頼む(その日に頼めるのは100回まで。サーバの上限は1人1日100回・全員1日3,000回)。4本ずつ作り、HOME で台本より先に(6割)出す。失敗・上限は台本版だけ | 端末 `assistantPeerRequestGen`(保存 `mh_assistant_peer_talk_gen_v1`)/ サーバ `core.js` の `handlePeerTalks`・`index.ts` の `takePeer`・SQL `supabase/migrations/202611070001_assistant_peer_talk_usage.sql` |

公開の印: `RELEASE_FLAGS.assistantPeer`(段階2・3 台本版)・`RELEASE_FLAGS.assistantPeerApi`(API 版。**窓口がサーバを配って SQL を流すまで偽**)。検査: `tools/assistant/assistant-peer-check.js`、段階1は `assistant-chat-check.js` ㉕。

止め絵: `shots/1-home-talk.jpg`・`shots/2-home-special.jpg`・`shots/3-profile-map.jpg`。

## 待っていること

- 更新履歴・ヘルプの文を窓口が確かめる(マージ前)
- サーバ(assistant-chat)を窓口が配る。更新履歴の「おしゃべりの話題も伝わる」行は、配ったあとでないと本当にならない

## 窓口がやること(配る)

1. SQL `supabase/migrations/202611070001_assistant_peer_talk_usage.sql` を流す(足すだけ)
2. `supabase/functions/assistant-chat/` を配る(段階1の共有メモ・secret 欄・API 版がまとめて入る)
3. 配ったら `RELEASE_FLAGS.assistantPeerApi` を真にする(1行)

## 作りこみ(2026-11-07 社長が10個を選んだ。3段階に分けて作る)

数字は bond-plan.png と窓口とのやりとりのとおり(プレイヤーの親密度は新しい行動で1人1日 約+154・仲良し度は Lv10 まで)。

| 段階 | 中身 | 状態 |
| --- | --- | --- |
| ① | 今日のペア(3回見て達成・ペア+10・2人の親密度+20、連続ログインでペア+2)/返事を選ぶ掛け合い(28本・ペア+3・2人の親密度+5)/その日の出来事(9種類×4本=36本)/思い出アルバム(写真 Lv3・5・8・10、見た掛け合いの見返し)/仲良し度 Lv10・ペアの1日の上限20/プレイヤーの親密度の行動 peerTalk・peerChoice・peerDaily | できた(この枝) |
| ② | 差し入れ(ビートP交換所 200P・ペア+15・2人の親密度+30)・友情のしるし(500P・ペア+30・2人の親密度+25)。どちらも全体で1日1回、思い出アルバムの「2人にしてあげる」から渡す/遊びに連れていくペア(ビート・バトル・カードを遊び終えるとペア+4・2人の親密度+6、次の画面で2人がひとこと) | できた(この枝) |
| ③ | ミニイベント(12本・Lv3 から、Lv6 から3倍)・3人の掛け合い(8組×2本・3組とも Lv2 以上、Lv7 のペアがいれば6倍)・けんか→仲直り(8組・Lv2〜3・HOME)・Lv10 の2本目の特別なお話の仕組み・プレイヤーの親密度 peerTrio/peerEvent/peerMakeup | ナカヨシの分はできた(この枝)。Lv7/9 の掛け合いと Lv10 の台本はコトバの取り込み待ち |

止め絵(①): `shots/4-map-daily.jpg`(関係図と今日のペア)・`shots/5-album.jpg`(思い出アルバム)・`shots/6-choice.jpg`(返事を選ぶ)・`shots/7-reply.jpg`(選んだあとの反応)
止め絵(②): `shots/8-album-actions.jpg`(2人にしてあげる)・`shots/9-gift-thanks.jpg`(差し入れのあとの2人のひとこと)
止め絵(③): `shots/10-trio.jpg`(3人の帯)・`shots/11-event.jpg`(ミニイベントの判定)・`shots/12-quarrel.jpg`(言い合い)・`shots/13-makeup.jpg`(仲直り)

## 引き継ぎ(2026-11-07 ナカヨシの1つ目の会話から)

### いまの状態
- 枝 `claude/assistant-peer`・PR #4657(マージしない。全部そろってから窓口が社長に更新履歴の文を確かめ、窓口のオッケーでマージ)
- ①②はできて、社長「これで続ける」。止め絵 `shots/`
- 別件の PR #4675(今ある親密度の行動を2倍)はマージ済み。この枝にも main を取り込み済み
- 「今日」は `assistantPeerDayKey`(56-assistant-chat.jsx。いまは `loginBonusPeriodKey`=朝4時区切り)。セコンドの `jstDayKey4` が main に入ったら、この1行を差しかえる(窓口の指示)
- サーバ(assistant-chat の peerMemos・secret 欄・peer_talks)と SQL `supabase/migrations/202611070001_assistant_peer_talk_usage.sql` は窓口が配る。配ったら `RELEASE_FLAGS.assistantPeerApi` を真に

### ③でやること(分担: 窓口 2026-11-07)
- ナカヨシ(この続き)が作る: 仕組みと、ミニイベント・3人の掛け合い・けんか→仲直りの台本
  - プレイヤーの親密度の行動: 3人の掛け合いを見る +3/6(3人それぞれ)・ミニイベント +8/16・仲直り +8/8(bond-plan.png の直した数字。`ASSISTANT_BOND_ACTIONS` に peerTrio・peerEvent・peerMakeup として足し、`tools/assistant-bond-check.js` の表にも足す)
  - ペアへの増え方: ミニイベント +5(1日5)・仲直り +5(1回きり)。3人の掛け合いは3組のペアにそれぞれ +2(掛け合いと同じ扱い)
  - ミニイベント: 料理対決・おつかい・ビート勝負など 6〜8行×12本ほど。最後にプレイヤーが判定(返事を選ぶ仕組み `choice` を使える)。Lv6 から増える
  - 3人の掛け合い: 決まった8組(みゅあ・きき・もも/ドラ・あつ・えるびん/きゅうこ・ソラシド・みゅあ など)×2本。3人とも Lv2 以上のペアなら出る。帯に3人の顔。{c} は2人用なので、3人用に `{c:kiki}`(話し手が kiki を呼ぶ呼び方)を足すとよい
  - けんか→仲直り: Lv2〜3 のペアでたまに軽い言い合い(おやつ・順番の取り合い程度、悪口なし)→ 次に HOME を開いたとき仲直りの掛け合い。8組
  - Lv10 の特別なお話2: 選び方で `special` を Lv5 用と Lv10 用(`lv:10`)で分ける(いまは special を Lv5 で1本だけ見る作り。`st.special` はペアの記録なので、Lv10 用は別のキーか `pair:sp2` の形で持つ)
  - 写真 Lv8・Lv10 はもう出る(ASSISTANT_PEER_PHOTOS)
- コトバ(session_0113GBaB9YGcrBJ9rzgiBJgR)が書く: Lv7・Lv9 の掛け合い(28ペア×各1本)と Lv10 の2本目の特別なお話(28本・6行)
  - 基準 `VOICE.md`。テキストを別の枝 `claude/assistant-peer-lines` の `docs/progress/assistant-peer/lines/kotoba.txt` に出す
  - 取り込み: `node tools/assistant/peer-talks-import.js docs/progress/assistant-peer/lines/kotoba.txt`(id は ペア-7・ペア-9・ペア-sp2)→ `node tools/assistant/assistant-peer-check.js`

### 終わったら
- 止め絵(3人の帯・ミニイベント・仲直り)・台本の抜粋・更新履歴の文を窓口へ。⑥の検査(`run-checks.js --changed`)を通す

## ③ ナカヨシの分(2026-11-07 ナカヨシの2つ目の会話)

- データ `data/assistants.js` 末尾: `ASSISTANT_PEER_EVENTS`(title・choice つき)・`ASSISTANT_PEER_QUARRELS`(lines と makeup)・`ASSISTANT_PEER_TRIO_TALKS`(trio・`{c:id}`)。
  ペアの行動 `event`(+5・1日5)・`makeup`(+5・上限の外)。プレイヤーの親密度 `peerTrio` 3/6・`peerEvent` 8/16・`peerMakeup` 8/8
- 端末 `56-assistant-peer.jsx`: `assistantPeerExtraTalks`(kind 付きの形にそろえる)・`assistantPeerPickTalk`(HOME で 仲直り→Lv5→Lv10 の順に先に流す)・
  `assistantPeerMarkShown`(けんかで待ちを残す・Lv10 は別キー)・帯の3人表示・アルバム(3人は3組それぞれに入る)
- 保存(足しただけ): `mh_assistant_peer_quarrel_v1`・`mh_assistant_peer_special2_seen_v1`(SAVE_DATA.md に記載)
- 検査 `assistant-peer-check.js` ⑪。口調・守りの検査は③の台本にも広げた。返事は1人1行に書く(行ごとに見る口調の検査が取り違えるため。前からあった kiki-kyuko-c1 の NG もこれで直った)
- 残り: コトバの台本(`claude/assistant-peer-lines` の `lines/kotoba.txt`)を `peer-talks-import.js` で取り込む → ⑪ の「(参考)」が 28・28・28 になる。
  更新履歴の「Lv5とLv10で特別なお話」は、取り込んでから本当になる

## 公開の段取り(2026-11-07 社長「この文で公開」・窓口の段取り)

- `assistantPeerDayKey` を `jstDayKey4` に差しかえた(前の loginBonusPeriodKey と中身は同じ。保存した日付はそのまま読める)
- `RELEASE_FLAGS.assistantPeerApi` を真にした(この PR に入れた)。**サーバ(SQL → assistant-chat)を窓口が配ってからマージする**
- SQL の1日の区切りを朝5時 → 朝4時にそろえた(まだ流す前。ゲームの jstDayKey4 と同じ)
- `assistant-chat-check.js` のブラウザ検査は、HOME で飛ぶ peer_talks をおしゃべりと別に数えるよう直した

## 引き継ぎ(2026-11-07 ナカヨシの2つ目の会話の終わり)

- PR #4657 はマージ済み(main 9d21861)。サーバー(SQL・assistant-chat 版15)は窓口が配った。公開済み
- 社長「わかりにくい・台詞が少ない」→ 調べ `UX-REVIEW.md`、作り直しの案 `LIFE-PLAN.md`(助手たちの今・にぎわい・状況の鍵で引く台本)。見本 `ux/`
- **社長が選んだ(2026-11-07)**: この形で作り直す/見せ方は専用の画面「助手たちの今」+ HOME の帯/名前は「**友情Lv**」(画面・ヘルプ・更新履歴すべて。段の名前「名コンビ」「最強コンビ」などが友情Lvに合うかを見て、合わなければ案を窓口へ)/台詞は A/にぎわい4段は表のとおり。台帳にも1行足した
- 段階に分けて PR を出してよい(公開の印で隠す)。全部そろったら、マージの前に 止め絵・台詞の抜粋・更新履歴とヘルプの文 を窓口へ。台詞が足りなければ、窓口がもう1人台詞担当を立てる
- 次の一手: LIFE-PLAN.md の「7. 作る順」の1(様子を決める仕組みとにぎわい・画面なし・検査つき)と、「8」で約束した したいことの好みの表・穴の言葉の一覧 をコトバへ。コトバ(session_0113GBaB9YGcrBJ9rzgiBJgR)は気持ちの紙・関係メモ・数える検査、ナカヨシは様子を決める仕組みとにぎわい
- まねる道具: 30日の出方の見積もりは、選び方の関数を vm で動かして数えた(UX-REVIEW.md の数字)
