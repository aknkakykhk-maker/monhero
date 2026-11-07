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
