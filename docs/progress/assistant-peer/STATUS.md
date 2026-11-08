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

## 助手たちの今 段階1(2026-11-07 ナカヨシの3つ目の会話)

- 枝 `claude/assistant-life`。公開の印 `RELEASE_FLAGS.assistantLife`(偽)の後ろ。偽のあいだは何も変わらない
- 仕組み `56-assistant-life.jsx`: 6つの時間ごとに 気分 → したいこと → だれといたいか → 組(2〜4人)/ひとり(さみしい・マイペース・距離をおく)。
  端末ごとの種と時間の通し番号で決まる(同じ時間は同じ様子)。最近のできごと(差し入れ・言い合い・仲直り)と声かけ(誘う・引き合わせる)が次の時間に効く
- にぎわい: ビート +2・バトル +2・カード +3・おしゃべり +1(1日20)・助手どうし +2(1日30)、7日続けて +10・3日 +5。
  段 静か/ふつう/にぎやか/お祭りで `assistantPeerGainState` の倍率(ふだんの行動だけ)と1日の上限 20/30/45/60
- 保存(足しただけ): `mh_assistant_life_v1`・`mh_assistant_life_play_v1`(SAVE_DATA.md)
- 検査 `node tools/assistant/assistant-life-check.js`(`--table` 好みの表・`--stats` お祭りの人の30日)
- コトバへ: `LIFE-WORDS.md`(穴の言葉・好みの表・30日の回数)
- 次: 段階2 画面「助手たちの今」・HOME の帯・関係とアルバムのつなぎ直し・名前「友情Lv」(段の名前の案は窓口へ送った)

## 助手たちの今 段階2(2026-11-07 ナカヨシ3)

- #4718: コトバの指摘で、同じ2人ばかりにならないよう調整(ペアの差 23倍→約7倍・ドラが家でさみしい 1日約0.7回)
- 画面「助手たちの今」(`AssistantLifeScreen`): にぎわいの帯・いまの様子(組=見守る/ひとり=誘う)・引き合わせる・「関係とアルバム」タブ(今の関係図)。HOME の帯(`AssistantLifeBand`)とプロフィールから開く
- 見守る: その組の今ある台本から1本流す。組のペアに talk の上がり・プレイヤーの仲良し度・にぎわい+2。1日に見守れる数は段の moves(6/10/16/24)、同じ時間に同じ組は1回
- 名前: 印が真なら「友情Lv」・Lv3「友だち」・Lv4「いい友だち」・写真「友だちの1枚」(社長 2026-11-07)。今日のペアは出さない・数えない。関係の行に「あと◯」
- 帯は HOME だけ(`gameState==='HOME'&&!busy`)。掛け合いが流れているあいだは隠れる。画面は閉じているあいだ何も読まない・書かない(演奏中・マルチ中に様子を決め直さない)
- 検査 `node tools/assistant/assistant-life-browser-check.js`(`--shots` で止め絵 `shots/life-*.png`)
- 次: 段階3 台詞の取り込み(コトバの道具 → `ASSISTANT_LIFE_TALKS`)と、様子に合う台本を引く仕組み(ひとりごと・声かけ・2人・3人・言い合い・ブリーダーへ)。データの形はコトバへ送った

## 引き継ぎ(2026-11-07 ナカヨシ3 → ナカヨシ4・段階3)

### できたこと(main・印 assistantLife は偽)
- #4717・#4718 段階1(仕組み・にぎわい)/#4722 段階2(画面・帯・友情Lv の名前)。#4715 は急ぎの折り返しの直し
- 検査: `assistant-life-check.js`(仕組み)・`assistant-life-browser-check.js`(画面。`--shots` で止め絵)

### 台詞(枝。まだ main に入れていない)
- コトバ `claude/assistant-life-lines`: `lines/kotoba-life.txt`(ひとりごと431本+2人279本)・`tsumugi.txt` を取り込み済み・`lines/ALLOC.md`(本数)・`lines/KOTOBA-STATUS.md`(残り)・取り込み道具 `tools/assistant/life-talks-import.js`(→ assistants.js 末尾の印のあいだ `ASSISTANT_LIFE_TALKS`。`--check` あり)・検査 `peer-lines-variety-check.js`
- ツムギ `claude/assistant-life-lines-tsumugi`: 2人280本・`lines/tsumugi-rewrite.txt`(今ある台本の書き直し edit 506・tag 209・add 15=けんかの「距離」)。当てる道具は `tools/assistant/peer-rewrite-apply.js` で置いてもらうよう頼んだ
- 残り(コトバ): 声かけ→こたえる・決まった3人の上位20組・言い合い→仲直り・ブリーダーへのひとこと。ツムギ: どの3人でも約30本・折り返しの4行

### 決めたデータの形
- `ASSISTANT_LIFE_TALKS`: { id:'life-<kind>-<人>-<3けた>', kind:'solo'|'invite'|'pair'|'trio'|'quarrel'|'breeder', keys:{place,mood,why,doing,lv('1-3'/'4-6'/'7-10'),air(normal/after/makeup),answer(glad/decline/shy),seed}, lines:[{who,e,t}] }
  - solo: who・line('scene'|'feel'。ひとりごとは scene→feel の順でつなぐ)/ invite: who(誘われる人)・from / quarrel: lines・distance・makeup
  - trio: 決まった3人は trio:[3人]。どの3人でもは { trio:null, pair:[A,B], any:true }(A・B だけが話す。A と B がいる3人以上の組で、決まった3人の台本が無いときに出す)
  - 穴 {c}・{c:id}・{place}・{doing}・{doing_te} は文字のまま。置きかえはゲーム側
- 今ある台本の書き直し: **id を変えない**(思い出アルバムが id で覚えている)。公開中なので **印が真のときだけ** 書き直した文で出す(書き直しの表を足す形。assistants.js の今の文は消さない)。tag の doing・lv は新しい選び方で使う。similar= は新しい選び方で出しにくくするだけ(アルバムには残す)
- when(その日の出来事)は今の仕組みのまま

### 段階3でやること
1. コトバの道具で `ASSISTANT_LIFE_TALKS` を main へ(コトバがコミット後)。assistant-life-check に id の重なり・鍵の名前・話し手が組の中の人か を足す
2. 様子に合う台本を引く: 帯・見守る・誘う(invite の answer)・ひとりの助手をタップ(solo scene→feel)・言い合い(quarrel → 距離 → 引き合わせで makeup)・ブリーダーへ。見たものは14日出さない(新しいキー `mh_assistant_peer_seen14_v1`。LIFE-PLAN の4)
3. 書き直しの表の当て込み(印が真のときだけ)
4. 全部そろったら: 止め絵(縦・横の iPhone 幅)・台詞の抜粋・更新履歴とヘルプの文を窓口へ(changelog-help-update スキル)。社長の「この文で公開」をもらってから印を真に

## 助手たちの今 段階3(2026-11-07 ナカヨシ4)

- 台本: コトバ `kotoba-life.txt`(ひとりごと431・2人279)とツムギ `tsumugi.txt`(2人280・どの3人でも30)を main へ。`life-talks-import.js` で `ASSISTANT_LIFE_TALKS`(1020本)。
  コトバの1行「おいしそうでつい」は、みゅあの口調の検査が「でつ」と取り違えるので「おいしそうだったから、つい」に言いかえた(テキストも直した)
- 書き直しの表: `tools/assistant/peer-rewrite-table.js` が `tsumugi-rewrite.txt` を当てた結果と今の文を比べて `ASSISTANT_PEER_REWRITES`(319本・ひとこと6)を作る。
  **今の文(ASSISTANT_PEER_TALKS など)は1行も変えていない**。印 assistantLife が真のときだけ `assistantPeerRewrite` が表の文で出す(id・行の数・話す人は同じ)。
  `peer-rewrite-apply.js` は当て方の本体 `applyEdits` を貸すだけ(--write でゲームへ書かない)
- 引き方(56-assistant-life.jsx「様子に合う台本を引く」): 鍵が全部合うもの → ゆるめてよい鍵を順に外す(2人: していること → 段。ひとり: 理由 → 気分)。場所の型・空気(言い合いのあと)は外さない。友情Lv の段より上は出さない。見たものは14日出さない(`mh_assistant_peer_seen14_v1`)
  - 見守る・HOME の掛け合い(7割5分): 2人 → 2人の掛け合い(新しい台本+今の台本の doing/lv の鍵)/3人以上 → 決まった3人 → どの3人でも(顔は組の全員・話すのは2人)→ 組の中の2人
  - 言い合い: 気分がすぐれない2人(すねてる・そわそわ)は 3割、ふだん5分で言い合い(Lv2 から)→ 2人は距離をおく → 引き合わせる/また一緒になると仲直り。HOME の「次に開いたら仲直り」は、印が真なら2人が一緒にいるときだけ
  - ひとりの助手「ようすを見る」: 距離をおいているなら「距離をおく」の行/3割でブリーダーへのひとこと/ふだんは ひとりごと(様子 → 気持ち)。同じ時間に同じ助手は1回・何も増えない
  - 誘う: 声をかける台本があれば、その場で流す(答えは気分と理由から)
  - 穴 {place}{doing}{doing_te} は `assistantLifeFillHoles`(いまの様子 → 台本の鍵 → していることの場所)
- 検査: `assistant-life-check.js` ⑧(id・鍵・話し手・書き直しの表・組/ひとり/言い合い・穴・14日・2つの道具の --check)/`assistant-life-browser-check.js` ⑦(見守る・ようすを見る。止め絵 `shots/life-7-solo.png`)
- 残り: コトバの 声かけ・決まった3人の上位20組・言い合い→仲直り・ブリーダーへ(取り込めば仕組みはそのまま使う)。そろったら 止め絵・台詞の抜粋・更新履歴とヘルプの文を窓口へ → 社長の「この文で」→ 印を真に

### 2人にあげる道具を分かりやすく(2026-11-07 社長「この見本で作る」 ux/items-mock.png)
- 「助手たちの今」: 上に「2人にあげる道具」の欄(持っている数・今日あと何回・起きること・手に入れる所。誘う/引き合わせるは無料と書く)。組ごとに「🧺 渡す」(3人以上は「だれに渡す？」で2人を選ぶ)。
  印「⬆ もうすぐ友情Lv(あと30以内)」「💦 言い合いのあと」。渡す前の確かめ `AssistantLifeGiveSheet`(何の道具か・起きること・使える数・手に入れる所・このあと)
- 持ち物: 印が真なら「使う ▸」で「助手たちの今」が開く。持ち物・交換所の説明は `assistantLifeItemDesc`(印が真のときだけ何が起きるか中心)
- はじめての案内 `AssistantLifeItemIntro`(HOME で1回・掛け合いと重ねない・新しいキー `mh_assistant_life_item_intro_v1`)
- 名前・絵・値段・上がる量は書き込まず、BREEDER_MARKET_ITEMS・RHYTHM_EVENT_POINT_SHOP_OFFERS・上がり方の表から読む(名前と種類はあとで「道具を広げる」ときに決める)
- 止め絵 `shots/life-8-give.png`・`life-9-intro.png`。検査 assistant-life-check ⑧・browser ⑧

## 引き継ぎ(2026-11-07 ナカヨシ4 の終わりごろ)

### 公開したもの
- #4736 段階3(様子に合う台本・書き直しの表)/#4744 2人にあげる道具を分かりやすく・演出/#4745 残りの台本(1401本)/#4750 **公開**(印 assistantLife 真・更新履歴・ヘルプ)
- #4761 画面の検査の直し(様子を決めて入れる)/#4764 プレイヤーの呼び方 `{name}`(一覧 `docs/rules/CALL_NAMES.md`・検査 `player-call-check.js`)/#4767 小さい直し

### 待っていること
- 社長: 助手ライフの本番の形(`LIFE-CONTENT-PLAN.md`・`ux/life-content-mock.png`)の A/B
  - 決まっていること: がっつり仕上げる/HOME の上の帯は作らない・各施設に顔だけ/名前「助手ライフ」(表示そろえはこの形と一緒に)
- マモリ: セッションの台詞の `{name}`(枝 claude/beat-assistant-session-7)。main に入ったら `player-call-check.js` の(参考)を必ず止める形へ。デュオの見直しは返した(4行)
- 窓口へ送った案のあと: 遊び場のアイコン・家・行事は LIFE-CONTENT-PLAN の段階2〜5

## 助手ライフ 専用ページ「助手たちの家」(2026-11-07 ナカヨシ5)

- 社長の答え(がっつり案の4問): 顔の丸/HOME の施設の顔は全部出す/最初の公開は段階1だけ/専用ページはもっと作り込む
- そのあと社長「専用ページは助手たちの家みたいな感じ」→ 町の地図が真ん中の案(#4779)は置きかえた。町の地図は「📋 みんなの居場所」の先へ
- 案 `LIFE-HOUSE-PLAN.md`・止め絵 `ux/life-house-mock-tate.jpg`(縦)・`ux/life-house-mock-yoko.jpg`(横)・`ux/life-house-mock-ab.png`(A/B 5つ)。窓口へ送った
- セッションとのつなぎ: マモリ(2)(session_0113GBaBXVrsDeVzvjC9ndFy)に要るものを返した(OnLive の知らせ・Invite の入口はプライベート・券なしは段階2。こちらは assistantLifeAtBeat・assistantLifeBeatIds を出し、マモリ側が呼んだ時点で paid:visit を付ける。線引きはマモリ案に合わせ A=出かけているあいだ何回でも/B=1日1回/C=その日ずっと・段の名前は assistantPeerStageName・暮らしの経験値は入れない)
- 待っていること: 社長の A/B(❶ 家の絵 ❷ 下の作り ❸ 入場 ❹ 曲 ❺ 券なしの線引き A/B/C)と「これで作る」→ 段階1を作る
- 2026-11-07 社長の答え: ❶ B(家の絵は描き下ろし。届くまでは図形の形)/❷ A 札4つ+アイコンの列/❸ A 毎回/❹ A「風がそよぐ場所」/❺ 出かけているあいだは何回でも券なし(段階2)。注文書 `HOUSE-ART-ORDER.md`(縦 1080×1680・横 1560×1080・部屋の位置の表)。→ 段階1を作り始めた(枝 claude/assistant-life-stage1)
- 2026-11-07 段階1を作った(枝 claude/assistant-life-stage1・まだ main に入れていない)。新しい部品 `56-assistant-life-house.jsx`(家・部屋・場面・みんなの居場所・入場・HOME の顔)。今の一覧は家の「📋 居場所」の中に embedded で入れた。曲は「風がそよぐ場所」。保存キー `mh_assistant_life_diary_v1`・`mh_assistant_life_intro_v1`
  - 社長の直し「ホームの助手のアイコンをもっと小さくしてコンテンツの下において」→ 札の下に 12〜20px で1列(すき間を測る)。横の「🏡 助手ライフ」はマーケットの左隣。止め絵 `shots/home2-*.png` を窓口へ送った
  - ビート部とのつなぎは向きを逆に: ビート部が `assistantLifeOnSessionLive(ev)` を呼ぶ・`ASSISTANT_LIFE_LINKS.beatInvite` を入れる(まだ無い関数名は undefined-reference-check が止めるため)。マモリに送った
  - ハナビ(時間帯の色の共通化)に、区切り・色・重ね方を返した
  - 次: 窓口の OK → 文案 `LIFE-HOUSE-RELEASE.md` と家の止め絵を送る → 社長の「この文で」→ 更新履歴を書いて PR・マージ
- 2026-11-07 **段階1を公開**(#4824・社長「この文で公開」)。生活のリズム・誘い方で変わるリズム・3人4人の全員の名前・💢 の印・時刻の札まで入れた。マモリに main 入りを伝えた(つなぎはビート部が足す)
- 台詞: コトバ 404本(kotoba-house.txt)・ツムギ 332本(tsumugi-house.txt)がそろった。ゲームへつなぐのは段階3(取り込み道具に新しい種類を足す)
- 画面の検査の ⑨ が運で落ちる件(見守ったときに言い合いが選ばれる)は、選ぶあいだだけ乱数を固定して直した
- 次: 段階2(出かける先にゲームの遊び・モンビーにいる助手と券なし=出かけているあいだは何回でも・マモリとつなぐ)
- 段階2の案 `LIFE-STAGE2-PLAN.md`(遊び場・券なしで会いに行く・台詞約240本・止め絵を先に)。この会話は長くなったので、作るのは次の会話へ引き継ぐよう窓口に伝えた
- 2026-11-07 本番の不具合「声をかけたら別の助手が話していた」を直した(声をかけるは {name} へのひとことの台本だけ・場面の立ち絵は話す助手とそろえる・検査 ⑪)。カード部(ルールくん)に「いまカード部屋にいる助手」の読み方を返した → LIFE-STAGE2-PLAN.md の 6
- 2026-11-07 本番の不具合の直し(2つ目): 寝ている助手に声をかけると寝言・起こされた反応(コトバの80本を tools/assistant/life-sleep-talks-import.js で取り込み)/場面はその場にいる助手だけ/地図の場所を建物に合わせ直した(闘技場まで入れた・助手の家はおやつ屋さんと離した)/見出しの題が切れない・名前の途中で折れない・掲示板は2行と全文/広場ではおやつをしない。検査 ⑪⑫⑬。社長の道具・家具の話は LIFE-STAGE2-PLAN.md の 7(ナカヨシ6へ)

## ナカヨシ6(2026-11-07 夜)

### HOME の顔の置き場所・札の重なり(本番で確かめて直した)
- 本番(#4844 入り)で確かめた結果: 縦はどの幅でも顔は札の下だった。崩れていたのは次の2つ
  - 横 667×375・844×390: みゅあの吹き出しが長いと M/B管理が下がり、モンヒロビートの札に重なる(縦でも、長い台詞で M/B管理が助手ライフに重なる)
  - 🔄横: HOME はモンヒロビートを出ると回転を戻すので、遊んでいて HOME が回ることは無い(戻ったときに回っていないことを検査に入れた)。顔の測り方は回っていても器の中の座標で測る形にした(念のため)
- 直し: 横はモンヒロビートを M/B管理の右隣に並べた(「開催中」の札の分だけ下げる)。縦は 上の札の下端(+顔の列の分)より下へ押す `max()`(ふだんの % は変えない)。押されてイベントの札・MFバトルカードにかかるときだけ、下の札を translate でまとめて下げる(CSS の変数 --mh-home-*-bottom・--mh-home-left-push は 69-screen-home.jsx が測る)
- 検査 `tools/assistant/assistant-life-home-layout-check.js`(縦4・横2・🔄横2 の大きさ × ふつう/いちばん長い台詞66文字。`LIFE_BASE=本番URL` で本番を見る)。下ごしらえは `life-browser-shared.js` に出した
- 止め絵 `shots/home-faces-portrait.jpg`・`home-faces-land-844.jpg`・`home-faces-land-667.jpg`・`home-faces-rot-back.jpg`

### ナカヨシ6 の続き(次の会話へ)
- 公開済み: #4869(HOME の顔・札の重なり)/#4871(assistant-chat-check ⑭ の揺れ止め: `loginBonusDoneSeed`。マモリ・窓口へ伝える)
- マモリ #4868 で `assistantLifeOnWoken` が本番でつながった(起こして来てくれたら今日あったことに1件)
- 段階1の残り(ナカヨシ5→ミハリの撮り直し #4863・どれも低。止め絵 docs/progress/qa-2026-11-07/shots/life2-*.jpg)
  ① 横の掲示板「今日あったこと」(2行)で言葉の途中で折れる(「カード研/究」)→ 名前は AssistantLifeNames、していることの言葉も nowrap のまとまりに
  ② 地図で中庭の2人の顔が「練習スタジオ」の札の頭に重なる → ASSISTANT_LIFE_MAP_POS の garden/studio を離すか fit に顔と札の重なりを足す。browser-check ⑫ に「顔と札の重なり」
  ③ 縦の今日やれること「声をかける ソラシドがさみし…」が切れる → small を短く(名前+💭)か2行
  ④ ようすを見るで、練習スタジオのソラシドが「広場、だれもいないな笑」→ assistantLifePickSoloTalk で台本の place といまの場所を合わせる。検査: 8人×場所
- そのあと段階2(LIFE-STAGE2-PLAN.md)。作る前に止め絵(縦・横)と更新履歴の文案を窓口へ。カード部屋の読むだけの口(assistantLifeAtCard 等)が main に入ったらソランドへ知らせる

## ナカヨシ7(2026-11-07 夜〜)

### 段階1の残り4件(ミハリ #4863)を直した
- ① 掲示板の言葉が途中で折れる → `AssistantLifeChunks`(空白のまとまり・名前は「・」・「〇〇で」のあとだけで折れる)。縦は1組・横は2組までと「ほか◯組」(`assistantLifeBoardShort`)。全部は押した先の一覧
- ② 地図で中庭の顔が練習スタジオの札に重なる → 地図の fit で、顔の丸に重なった札(顔のいない側)を上下左右の空いている所へ逃がす
- ③ 縦の今日やれること「ソラシドがさみし…」→「💭 ソラシド」
- ④ ようすを見るの台本の場所 → 台本に「どこで言う台詞か」(`assistantLifeTalkAt`: 鍵の place か、台詞に出る場所の名前。家は見ない)を持たせ、ようすを見る・声をかけるはいまの場所と合うものだけ
- ついで: 縦で屋根の札「🏡 助手の家」の下半分が家の枠に隠れていた(前から)→ 前に出した
- 検査: assistant-life-check ⑧(8人×場所×気分×理由で別の場所の名前を言わない)/browser ⑫(掲示板のまとまり・今日やれることの字・屋根の札・地図の顔と札)。止め絵 shots/life-16-board*.png・life-17-map-garden.png
- カード部とのつなぎ口(読むだけ)を足した: `assistantLifeAtCard(id)`・`assistantLifeCardIds()`(カード部屋でカード研究の組の全員。図書室は入れない)・`assistantLifeOnCardMatch({ assistantId, won, at })`(今日あったことに1件・生活のリズムに数える)。browser ⑭
- 公開: #4880(main 0c55472)。本番で画面の検査・HOME の配置(🔄横含む)OK。ミハリの撮り直し(#4881)で4件とも直っていた
- 段階2(一歩目)は枝 claude/assistant-life-stage2-step1(未公開)。止め絵 shots/stage2/・文案 LIFE-STAGE2-RELEASE.md を窓口へ送った。窓口の「この文で」待ち
- 🔄横(rotation-height-check #4874 の助手部3件): 仲良し度のシート・おしゃべり・助手たちの今のアルバムに、回したとき用の上限(vw)を足した。回した器の中で 331/343px(回した画面 390px に収まる)
- ミハリの小さい残り2件: 横の部屋の吹き出しが切れる → 狭い部屋は「💭 さみしいな…」(1行・名札に重ならない)/夕方に「朝の散歩で」→ 台本に言える時間帯(`assistantLifeTalkTods`: 朝の・寝る前・夕方にな・昼寝)。検査 assistant-life-check ⑧・browser ⑫

## キズナ(2026-11-08〜・人間らしい出来事/育つ・相談・マスモンの案)

- 枝 `claude/assistant-life-rel`(未公開)。窓口の「この文で」待ち。文案 `REL-RELEASE.md`・止め絵 `shots/rel-*.png`
- 仕組み `56-assistant-life-rel.jsx`(新しい部品)。台本 396本は `tools/assistant/life-rel-talks-import.js` が kotoba-house.txt・tsumugi-house.txt から書く(fight・mend・mend3・jealous・secret・consult・tease・rival・awkward。trio・quad・home・rhythm・owl はナカヨシ7の取り込み)
- 差し込み口(typeof で呼ぶだけ): 56-assistant-life.jsx(仲直りの形・2日はけんかしない・2人/3人の出来事・アルバム・朝4時の自分たちの仲直り)/56-assistant-peer.jsx(仲直りのあと・差し入れで仲直り・HOME でも2日はけんかしない)/56-assistant-life-house.jsx(扉・居間・シートの1行と「🤝 取り持つ」)/data/assistants.js(友情Lv の行動 mediate +3)
- 検査: `life-rel-check.js`(決まり)・`life-rel-browser-check.js`(縦・横・🔄横 × 朝昼夕夜。文字の切れ・名前の折れ・重なり・話し手・寝ている/出かけている・色の差)
- 間に入るの台本は28組のうち21組(残り7組は謝る・けんか自身の仲直りに戻る)。足すならツムギへ7本
- 育つ・相談・マスモンの案: `GROW-PLAN.md`・見本 `ux/grow-mock.png`(社長に選んでもらう ❶〜❺)
- 2026-11-08 段階2の一歩目を公開(社長「この文で公開」・告知なし)。枝は古い履歴の上だったので、main から claude/assistant-life-stage2-step1b に載せ直した。カード部の「🃏 カード部屋で対戦する」と並ぶ
- 二歩目の台詞をコトバ(solo 120・visit 32 → lines/kotoba-stage2.txt)・ツムギ(pair 56・lure 32 → lines/tsumugi-stage2.txt)へ注文。注文書 LIFE-STAGE2-LINES-ORDER.md。届いたら取り込み道具に temple/shopping・visit・lure を足し、抜き出しを窓口へ
- AssistantBubble に oneLine(#4888)。ビート部が曲えらびの横につないだ(#4889)

## オクリモノ(2026-11-08〜・道具の種類・好み・家具のプレゼント)
- 案 `GIFT-PLAN.md`・表 `gifts/tables.png`・止め絵 `gifts/gifts-tate.jpg`・`gifts/gifts-yoko.jpg`(本物の家の画面に案の部品を重ねて撮った)を窓口へ送った
- 道具10種類(今の2つは id・数そのまま)・8人の好み(好き3・苦手2)・家具12種類(置き場所は天井・壁・床の3つ。顔・吹き出し・札とぶつからない所)・新しいキー3つ・段階A/B/C・A/B 6つ
- 待っていること: 社長の A/B → 好みの表が決まったら台詞(約350本)をコトバ・ツムギへ。作るときはナカヨシ7と、渡す画面・部屋・地図の建物をすり合わせる

### キズナの続き(2026-11-08 朝・次の会話へ)
- 公開済み: けんか・仲直り #4915(本番 build 2026-11-08 08:41 で life-rel-browser-check 135項目OK)。ミハリの小さい4件も直して公開。ミハリに本番の撮り直しを依頼中
- 候補表を実装済みの血統だけに直した #4920(`ux/masmon-candidates.png`)。台帳 #4914「助手のマスモンは実装済み(ALL_PLAYER_MONSTERS)からだけ」
- 待ち: ツムギに間に入る7組(dra-mua・kiki-momosuke・kiki-sorashido・momosuke-sorashido・erubin-momosuke・dra-kyuko・erubin-kyuko)を注文。届いたら `node tools/assistant/life-rel-talks-import.js` → life-rel-check
- 待ち: オクリモノの改名(🧺おやつバスケット)のとき、更新履歴 08:33 の3行目とヘルプ「けんかと仲直り」の「差し入れ」を直してもらう約束(画面は道具の表から読む)
- 次にやること(窓口から・社長の追加の指示「助手のバトルカードやマスモンはちゃんと名前とか考えて作らせて、助手にもマスモン一覧とか編成とかもプレイヤーと同じように存在すると面白い」):
  8人ぶんの「マスモン一覧(ニックネーム・血統の候補・わけ)・編成・デッキ名と中身の方針」の表と、見る画面の止め絵(縦・横・🔄横)を作って窓口へ。血統は実装済みだけ。名前はコトバ・ツムギに頼んでよい。デッキはカード部ソランドとすり合わせ。プレイヤーのセーブ・ランキングには触らない・保存は新しいキー
- 社長の選び(育つ助手)は全部 A(台帳 2026-11-08)。作り始めはこの案が決まってから。オトズレ(フレンド)には★の保存キー予定 mh_assistant_life_grow_v1 と見せてよい項目(★と得意)を伝えた

## オトズレ(2026-11-08〜・フレンドの家との行き来)
- 社長「助手ライフの機能を拡張してフレンドのとこに遊びに行けたりフレンドが遊びに来たりとかもいれたい」→ 先に案と止め絵(社長の選択)
- 案 `FRIEND-VISIT-PLAN.md`・止め絵 `friend/friend-tate.jpg`(縦8枚)・`friend/friend-yoko.jpg`(横8枚)・`friend/friend-rot.jpg`(🔄横の知らせ)。撮り直しは `friend/shoot.js`
- 形: 相手がオフラインでも「家の控え」を訪ねる/行き来の記録は新しい表2つ(足すだけ・SQL は案のまま未実行)/新しいキー4つ/相手のセーブには書かない
- 2026-11-08 社長の選び ❶A ❷B(助手が自分で行く) ❸A ❹A ❺A ❻A・「これで作る」。止め絵②③を作り直した。作るのは次の会話から: 引き継ぎ `FRIEND-VISIT-BUILD.md`

### キズナの続き(2026-11-08 09:30ごろ・育つ助手を作り始める前)
- 社長: 育つ助手は「直しながら作る」でOK。API は「使う」(grow_consult・grow_report)
- 案の正本: `GROW-PLAN.md`(6 マスモン・好き苦手・デッキ/7 API と オトズレ2との取り決め)・データ `masmon-plan.json`・表 `ux/masmon-table.png`・見本 `ux/masmon-screen.png`
  - 染めた絵はゲームの部品で作る: `python3 -m http.server 9291`(リポジトリの一番上)→ `node docs/progress/assistant-peer/ux/masmon-dye-shots.js` → `node docs/progress/assistant-peer/ux/masmon-mock.js`
  - 検査: `tools/assistant/assistant-masmon-plan-check.js`(未実装のモンスター・染色の枠数・好き苦手の決まり)
- 未確定: 好き・苦手のモンスター(4候補ずつ)と好きな色(4候補)を、窓口が社長に1人ずつ聞いている。決まるまで作る中では masmon-plan.json の今の値を仮に置き、決まったら差し替える
- 見本の直し(作るときに本物で確かめる): 助手ライフは🔄横でも回らない(回るのはモンヒロビートの画面だけ)。デッキのタブも縦と同じ見た目。左の列のカードが枠の端にくっつかないように
- すり合わせ中(返事待ち): ビート部マモリ(腕前の元にセッションLvを読む・結果のひとことの口)/カード部ソランド(CARD_AI_DECKS に型2〜3・assistantLifeCardStyle・デッキ名)/バトル部ジン(能力の伸び方の関数・DyedMonsterImage・神殿の応援の口 assistantLifeCheerOf)
- API: オトズレ2の friend_scenes が先にデプロイ → そのあと main を取り込んで grow_consult・grow_report を足す(同じ日にデプロイしない)
- 作る順(案): ①データとマスモンの画面(部屋の「🐾 マスモン」・一覧・編成・デッキ・好き苦手。縦・横・🔄横)②成長(育成場・練習スタジオ・カード部屋に行った回数で Lv)③相談(部屋の「？」・台本で先に作り、API はあと)④神殿の応援 ⑤API。どれも作る前に止め絵と更新履歴の文案を窓口へ
- 2026-11-08 段階A(道具10種類・好み)を公開: #4940(本体・更新履歴・告知・ヘルプ)/#4946(コトバの台詞)/#4952(検査の直し)。本番で assistant-life-browser-check すべて OK・ミハリの撮り直し OK(#4945)
- 次: 段階B(家具)。交換所に「家具」の段・部屋の天井・壁・床・贈ったときの反応(furn 96本は届いている)。家具は z-index 3 以下(キズナの扉が前)。オトズレの控えには put の3つ

### キズナ → キズナ2 への引き継ぎ(2026-11-08 10時ごろ・ここで区切り)
- 決まったこと(社長): デッキ名は A(今の自動のデッキ名は残し「型: キラキラ速攻」のように添える)・8つの名前は「この文で」/好き・苦手・好きな色は確定(masmon-plan.json・表 ux/masmon-table.png・#4950)
- 社長の選び待ち: 好き嫌いが変わる仕組み(GROW-PLAN 8 の ❶〜❹)
- すり合わせ済みの口(作るときに足す。どれも typeof で確かめて呼ぶ・数字には効かせない):
  - ビート部マモリ: 読むだけ rhythmAssistSessionLevel・rhythmAssistSessionMon().lives/.songs・rhythmAssistSessionOnLive。こちらが出す口 assistantLifeGrowBeatOf(id) → { stars 1〜5, style 'accuracy'|'fast'|'slide' }(main に入ったらマモリへ知らせる。マモリが結果のひとことに3割で使う。台詞 grow:<style> はコトバに注文)
  - カード部ソランド: こちらが出す口 assistantLifeCardStyle(id) → 'attack'|'guard'|'normal'|null(えるびんは blade/shield/mind に対応)。カード部が 84 で読み cardAiBuildDeck に渡す(フリー対戦だけ)。カード部の読むだけの口 cardAssistantDeckPreview(who, styleId, level)(部屋では NORMAL・「対戦では毎回少し入れかわります」)
  - バトル部ジン: 能力は助手ライフ側の見た目用の伸び方(基礎値は読むだけ)/染色は DyedMonsterImage・色はゲームの色の名前・プレイヤーの染色の保存は触らない/神殿の応援 assistantLifeCheerOf() → { id, line } を神殿の入口(合体・転生の画面の上)の小さな札とひとことだけ・バトル中は出さない・try で包む。足したら PR 番号をジンへ
  - ココロ(AI 会話): こちらが出す口 assistantLifeTasteOnTalk({ assistantId, monsterId, positive })(false も受けて今は無視・1日1回 +4 はこちらで数える)・assistantLifeTasteOf(id) → { likes:[表示名≤5], dislikes:[≤5], changed:[{ name, to }≤3] }(血統は「○○種」・印が偽なら null)
  - オトズレ2: assistant-chat は friend_scenes が先にデプロイ → main 取り込みのあと grow_consult・grow_report(GROW-PLAN 7-(4))
  - オクリモノ: 差し入れの改名(🧺おやつバスケット)で、けんか・仲直りの更新履歴 08:33 の3行目とヘルプ「けんかと仲直り」の「差し入れ」を直してもらう約束。仲直りに使える道具は食べ物・飲み物の4つ(gift・cake・onigiri・tea)の案 → 決まったら assistantLifeRelOnGift の頭(kind !== 'gift')を直す
- 公開済み(キズナ): けんか・仲直り #4915・間に入る28組 #4925。検査 life-rel-check・life-rel-browser-check・assistant-masmon-plan-check

## キズナ2(2026-11-08〜・育つ助手を作る)
- ① データとマスモンの画面を作った(ブランチ claude/kizuna2-grow・未公開): 部品 `56-assistant-life-masmon.jsx`。部屋のシートに「🐾 マスモン」の1行 → シート(🐾 マスモン・⚔ 編成・🃏 デッキ・💗 好き・苦手)。何も保存しない
  - 表 ASSISTANT_MASMON_PLAN は `node tools/assistant/assistant-masmon-import.js` が masmon-plan.json から書く(手で直さない。`--check` で食い違いを見る)
  - 口: assistantLifeCardStyle(id)(mua/kiki/atsu=attack・dra/erubin=guard・ほか normal)・assistantLifeTasteOf(id)(changed はまだ空)
  - デッキのカードの並びは、カード部の cardAssistantDeckPreview が main に入ってからつなぐ(未定義の名前は undefined-reference-check が typeof でも落とすので、入るまで書かない)
  - 検査・撮影: `node tools/assistant/assistant-masmon-browser-check.js [--shots]`(縦・横・🔄横から戻った。端にくっつかない・切れない・絵が出る)→ shots/masmon-*.jpg
- 待ち: 更新履歴・ヘルプの文の「この文で」/ミハリの撮り直し/好き嫌いが変わる ❶〜❹
- 次: ② 成長(育成場・練習スタジオ・カード部屋に行った回数で Lv。新しいキー mh_assistant_life_masmon_v1)
