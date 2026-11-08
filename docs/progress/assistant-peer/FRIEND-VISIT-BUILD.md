# フレンドの家との行き来 段階1を作る(引き継ぎメモ)

オトズレの1つ目の会話(案と止め絵)はここで区切る(CLAUDE.md ⑨)。作るのは次の会話から。
**最初に読む**: CLAUDE.md → `docs/rules/PRESIDENT_DECISIONS.md`(2026-11-08 の行き来の行)→ `FRIEND-VISIT-PLAN.md`(とくに冒頭の「社長の選び」と0章)→ このメモ。

## 決まっていること

- 社長の選び: ❶A 控え/❷**B 助手が自分で行く**/❸A(相手の助手が自分で来る)/❹A 同じ助手どうしも会う/❺A 写真1枚+100P(1日300Pまで)/❻A ★も写す。「これで作る」済み
- 窓口の注文: 送り出し量が分かるまで `thin` で出せる作り/SQL は流す前に本文を窓口へ(1回にまとめる)/公開前に縦・横・🔄横で撮って自分で見る → ミハリに撮り直し → 更新履歴の文を窓口へ → 社長の「この文で」のあと公開

## あとから足された決めごと(2026-11-08)

- プレイヤー自身もフレンドの家(控え)を訪ねる(P1〜P4・表の kind=`player`・1日3軒・同じ家1日1回・ビートP 50 は助手の分と合わせて1日300Pまで)。PLAN の「プレイヤー自身も…」
- Claude API を場面に使ってよい(PLAN 0-5。1人1日1回まとめて・全員1日1,000回・名前は送らない・台本の逃げ道)
- **段階の分け方は窓口・社長の選び待ち**(PLAN「段階の分け方」A=段階1にプレイヤーの訪問も助手の行き来も入れる・API は段階2/B=段階1はプレイヤーの訪問だけ)。下の「段階1」は A のときの中身。B ならプレイヤーの訪問の分だけ先に作る

## 段階1で作るもの

1. **SQL**(FRIEND-VISIT-PLAN.md 5章の本文。表3つ・足すだけ)。`docs/sql/assistant-life/FRIEND_VISIT_APPLY.sql` と `_TEST.sql`(最後 rollback)・`_VERIFY.sql` に分けて置く(フレンドの `docs/sql/friends/` と同じ並び)。本文を窓口へ送り、OK のあと TEST → 本番 → VERIFY を `execute_sql` 1回にまとめて流す。スイッチは最初 `thin`
2. **新しい部品** `monster-hero/src/parts/56-assistant-life-friend.jsx`(`parts.json` で 56-assistant-life-house の後ろ)
   - 通信: `34-friends-api.jsx` の `friendsRequest`(表が無いときの `notReady` の扱いも同じに)。承認済みのフレンドは今の一覧の読み方を使う(`friendsGroup`)
   - スイッチを起動後1回読む(読めなければ `thin`)/控えを送る(10分に1回・同じなら送らない)/控えを読む(「🏘 フレンド」を開いたとき+1日1回・30分は読み直さない・`updated_at=gt.前回`)/行き来を読む・足す/お礼
   - 控えの正規化 `assistantLifeFriendNormalizeHouse`(知らない id・種類・長い値を捨てる)
3. **助手が自分で行く**: `56-assistant-life.jsx` の `assistantLifeDecide`(時間の区切りで居場所を決める所)に、`friend` の行き先を足す。場所の一覧 `ASSISTANT_LIFE_PLACES` に `friend`(行き先の札「🏘 〇〇さんの家へ」)。上限(みんなで1日3回・同じ家1日1回・1〜2人・寝ている/けんか中は行かない・thin は1日1回)は端末で数え、行き来の行(kind=`go`)を足す。決めた結果は `mh_assistant_life_v1` の様子に入るので、**新しい項目を足すだけ**(古い形でも読めること)
4. **相手の助手が自分で来る**: 家を開いたとき、控えから1日2人まで(kind=`come` を自分が書く)。居間の扉に顔
5. **家の画面**(`56-assistant-life-house.jsx`): アイコンの列に5つ目「🏘 フレンド」(②いま・今日の行き来/③行ったことのある家)/居間の来客/掲示板に1件/場面(④)/おかえり(⑥)/置き手紙(⑦)/設定(⑧)。止め絵 `friend/` のとおり
6. **HOME**: 施設「🏡 助手ライフ」の右上に「🏘 n」。帯の知らせは HOME とモンヒロビートの入口・曲えらびだけ(🔄横は器の中に出す)
7. **ごほうび**: 場面を見たとき 仲良し度+10(行った助手)・友情Lv+4(2人)・写真・100P(1日300Pまで)/迎えた助手 +6。`ASSISTANT_BOND_ACTIONS` に新しい行動を足し、`tools/assistant-bond-check.js` の表にも足す
8. **保存キー**(足すだけ): `mh_assistant_life_friend_v1`・`_settings_v1`・`_known_v1`・`_intro_v1`(形は PLAN 6章)
9. **公開の印**: `RELEASE_FLAGS.assistantLifeFriend`(17-release-changelog-login-missions.jsx。既定は偽)
10. **台詞**: 段階1は仮の台本を少し(8人×2本ほど)。本数(約130本)はコトバ・ツムギへ注文書を出す(PLAN 8章)

## 差し込み口(すり合わせ済み)

- キズナ: けんか中は `assistantLifeRelPending()`(56-assistant-life-rel.jsx)を読むだけ。★は `mh_assistant_life_grow_v1`(まだ無い。読み口の関数名は作るときにキズナが知らせる)→ 無ければ★は写さない
- オクリモノ: 家具は `mh_assistant_life_room_v1` の `put`(天井・壁・床)だけ写す。まだ main に無ければ写さない
- ナカヨシ7: 案を送ったが返事待ち(アイコンの列5つ目・居間・行き先の札・掲示板)。作る前にもう一度知らせる

## 検査(足すもの)

- `tools/assistant/assistant-life-friend-check.js`: 控えの正規化/1日の上限(3回・同じ家1回・来る2人・thin 1回)/寝ている・けんか中は行かない/朝4時の区切り/古いキーを読める/表が無いとき通信しない
- 画面: `assistant-life-browser-check.js` に「🏘 フレンド」の縦・横(字の切れ・言葉の途中の折れ・重なり)、HOME の「🏘 n」と顔の列の重なり(`homeFacesProblems`)、🔄横の帯が器の中
- `node tools/run-checks.js --changed`・`node tools/build.js`(⑥の5つ)

## 止め絵を撮り直す道具

`node docs/progress/assistant-peer/friend/shoot.js <出力先>`(本物の家に案の部品を重ねる。playwright は `/opt/node-tools/node_modules/playwright`)。作ったあとは本物の部品で撮る。

---

## オトズレ2 の進み具合(2026-11-08・session_0113GBaBrc4UpNsyAGbBwEvp)

### 前の担当のあとに出た社長の決定(台帳にもある)

- プレイヤー自身もフレンドの家(控え)へ遊びに行ける → **段階1に入れる**(窓口経由・社長)。P1 家の中/P2 声をかける→返事3択/P3 一言を選んで置き手紙を残して帰る(ビートP 50・初めての家なら写真)/P4 相手の置き手紙。1日3軒・同じ家1日1回・ビートPは助手の行き来と合わせて1日300Pまで。表の kind は `player`
- Claude API の場面も **段階1から**(社長)。assistant-chat に kind `friend_scenes`(キズナとそろえた。visit_lines は使わない)。スイッチが thin/off・印 `assistantLifeFriendApi` が偽・失敗・上限のときは台本だけ。上限はおしゃべりと同じ表(`friend:` の頭)・全員の上限を分け合い、そのうえで Secrets `ASSISTANT_FRIEND_DAILY_LIMIT`(既定1000・0で止まる)
- Supabase の送信量はまだ不明 → スイッチは最初 `thin`(APPLY の insert も thin)

### できたもの(まだコミット前)

- SQL: `docs/sql/assistant-life/FRIEND_VISIT_APPLY.sql`・`_TEST.sql`(rollback)・`_VERIFY.sql`。**まだ流していない**(本文を窓口へ送ってから)
- 部品 `56-assistant-life-friend.jsx`(parts.json で rel の後ろ): 保存4キー・控えの正規化・専用の通信(表が無いと準備中。friendsRequest は使わない=フレンド全体を止めないため)・スイッチ・控えを送る/読む・助手が自分で行く(`assistantLifeFriendPickOuting`)・来る(`assistantLifeFriendPickCome`)・プレイヤーが訪ねる・置き手紙・お礼・設定・台本(8人ぶん仮)・API の場面・「🏘 フレンド」のページ・訪問の画面・HOME の印の部品 `AssistantLifeFriendBadge`(まだ HOME に置いていない)
- 差し込み: `assistantLifeNow` の掲示板の直後に `assistantLifeFriendOnSlot`/家のアイコン列の5つ目(印が真のときだけ)/部屋の札 `assistantLifeFriendDecorateRooms`/60-app のギフトの渡し口 `assistantLifeFriendSetGiftSender`
- 行き先は `mh_assistant_life_v1` に入れず、新しいキーの `out` に持つ(場所の一覧・地図は触らない)
- 仲良し度 `friendGo`(+10・1日30)・`friendWelcome`(+6・1日12)、友情Lv `friend`(+4・1日12)。assistant-bond-check の表に足した
- 公開の印 `assistantLifeFriend: false`・`assistantLifeFriendApi: false`
- Edge Function: core.js に `handleFriendScenes`(共通部分は触らない)、index.ts に専用の上限と `friendUsed`。**まだデプロイしていない**(デプロイ前に窓口へ・今の v16 の形を読んでから)
- 検査: `tools/assistant/assistant-life-friend-check.js`(①〜⑨・64件)、`assistant-chat-check.js` に ㉗

### 残り(2026-11-08 コミット 28f9a2f の時点)

済み: main の取り込み/HOME の「🏘 n」と HOME の帯(3秒・HOME だけ。モンヒロビートの中には出さない)/画面の検査 `tools/assistant/assistant-life-friend-browser-check.js`(縦・横・375・🔄横・印が偽。撮るときは `--shots <出力先>`)を通して、絵を1枚ずつ見た/ミハリへ撮り直しを頼んだ/SQL の本文(aa41ecc の3本)と更新履歴・ヘルプの文案を窓口へ送った

1. 窓口の返事待ち: SQL「流してよい」・更新履歴とヘルプの「この文で」・ナカヨシ7(居間の扉の顔はまだ作っていない)・ミハリの撮り直し
2. 「この文で」のあと: changelog-help-update スキルを開いて書く → 検査 → PR → マージ
3. SQL を TEST→APPLY→VERIFY の1回で流す(スイッチは thin)
4. main に入ったら Edge Function のデプロイ(今の v16 を get_edge_function で読み、friend_scenes だけ足す。jsdelivr の固定版を新しいコミットへ)。窓口へ知らせてから。済んだらキズナへ PR 番号
5. 印 `assistantLifeFriend` を真に(API の印 `assistantLifeFriendApi` はデプロイを確かめてから真)→ 公開 → 本番で確認して報告
6. 台詞の注文書(コトバ・ツムギ。PLAN 8章)

### 2026-11-08 10:10 の状態(オトズレ2)

- ミハリ「4つとも OK・残りなし」(88c36f4)。更新履歴・ヘルプは社長の「この文で」のまま書いた(d739dc3・公開の印の後ろ・必須検査17本 OK)
- SQL: こちらも窓口も execute_sql で Supabase の確認の質問に答えが無く止まった。**表はまだ無い**(窓口が to_regclass で確認)。社長が答えられるときに窓口が流す。それまで公開しない
- 流したあと: 印 `assistantLifeFriend` を真 → main へマージ → 窓口へ知らせて Edge Function(friend_scenes)をデプロイ(今の v16 を読んでから)→ 確かめて `assistantLifeFriendApi` を真 → 本番で確認 → 窓口と、キズナ2へ PR 番号

## オトズレ2 の区切り(2026-11-08 11:20)— 次の担当へ

公開済み: #4987(段階1・印 assistantLifeFriend 真)/#4993(API の場面・印 assistantLifeFriendApi 真・端末の口調の見張り)/#4998(訪ねる前・開いたときに自分の控えを必ず送る・断られた理由の文。本番で社長の置き手紙が「残せませんでした」になった件)/#4999(中継役 friend_scenes の決まりを強める。**配るのは窓口。配ってよい版は main 57db076**)。
本番の表: 窓口が apply_migration で入れた(片づけの見張り alf_visits_tidy は無し・create or replace trigger)。スイッチは thin。

### 残り(窓口 2026-11-08 の依頼。順に)

1. **#4999 を配ったあと**、friend_scenes を10組ほど試して、使える場面の割合を数えて窓口へ(ゲームと同じ形で curl。Origin は github.io、公開の鍵は 26-supabase.jsx。端末の見張り alfApiLineOk も通るか数える)
2. **フレンドのプロフィールに入口「🏘 家へ遊びに行く」**(社長決定・更新履歴は不要・ヘルプの行き来の節に1行): 「このデッキと戦う」「借りる」の近く(75-screen-friends.jsx・フレンドの画面の持ち主の部品なので差し込み口だけ)。押すとその人の家(AlfFriendHouseView)→戻ると同じプロフィール。家が届いていない・今日もう訪ねた・上限・切 のときは押せない形で理由(「◯◯さんが助手ライフを開くと遊びに行けます」)
3. 「🏘 フレンド」の「フレンドの家」の一覧に、**まだ家が届いていないフレンドも薄く並べて**同じ説明(alfOpenHouses は届いた家だけ。roster 全員から届いていない人を足す)
4. **案と止め絵(縦・横)を先に窓口へ**: (a) 訪ねた家の助手が全員おでかけ・おやすみでも何かできる(いない部屋も覗ける・家具/置き物・留守の助手に置き手紙・全員いないときの説明) (b) **置き手紙の自由文**(社長の依頼): 40字くらい・悪口/下品/連絡先(URL・メール・長い数字)/個人情報をはじく(マルチのチャットの言葉の見張りと同じ表)・受け取った側で「この人の置き手紙を見ない/来ないようにする」・通報は要るか案で。保存は visits に列を足す SQL(足すだけ・DROP なし)の本文を窓口へ
5. キズナ2(session_0113GBaDtdAaLtP4k1GNgu2e)の「助手のマスモンを控えに写す」: 形は返事済み(r.<助手>.ms = { mo, c }・ニックネームは写さない・新しい SQL なし)。口 assistantLifeMasmonLead が main に入ったら alfBuildHouse / assistantLifeFriendNormalizeHouse と検査に足す
6. 台詞の注文書(コトバ・ツムギ。PLAN 8章)

検査: `tools/assistant/assistant-life-friend-check.js`・`assistant-life-friend-browser-check.js`(`--shots <出力先>`)・`assistant-chat-check.js --unit` の ㉗。

## オトズレ3 の進み具合(2026-11-08)

- 1 の10組の試し(v18): 頼んだ10組のうち使えたのは5組。ログでは5場面ぶん書けていて、中継役の見張りが半分捨てていた。
  原因: 決まりの見本に「2人」「2倍」(数字は全部捨てる見張りと食い違い・同じ助手どうしが落ちる)/ドラの「やろう」「撮る」まで関西弁扱い/あつの「。」・絵文字終わり。
  直した: 見本と決まり(数字を書かない・相手はどちらも {f})・ドラの見張りを狭める(端末と同じ FRIEND_DRA_KANSAI)・あつの「。」は「！」へ・捨てた理由の名前だけをログ(friend_dropped)へ。配ったら同じ10組で数え直す
- 2 プロフィールの入口 `AssistantLifeFriendProfileVisit`(75 の デッキの下)・一覧に家が届いていないフレンドを薄く(data-alf-house-waiting)。ヘルプに1行。止め絵の道具 ⑩
- 3 の案: `FRIEND-AWAY-NOTE-PLAN.md`・止め絵 `friend/away-note-*.jpg`・SQL `docs/sql/assistant-life/FRIEND_VISIT_NOTE_ADD.sql`(窓口へ送って返事待ち)

## オトズレ3 の区切り(2026-11-08 13:40)

公開済み: #5007(プロフィールの入口・家が届いていない人を一覧に)/#5037(訪ねた家を自分の家と同じ絵に作り直し・くわしい控え・置き手紙の自由文とあて先・受け取る側の見ない設定・更新履歴とヘルプ)/#5038(台詞の注文書)/#5039(friend_scenes の「2人」→「ふたり」・{f} の後ろの名前を外す)。
本番の表: assistant_life_friend_house_more(くわしい控え)・visits の note/note_to と見張り alf_visits_note_guard は窓口が流し済み。

- 中継役: v19 は10/10・v20 は7/10(数字2・ドラ1)。v21(main f2a70db)を窓口が配ったら同じ10組で数え直す。試しは scratchpad の run.sh/eval.js と同じ形(ブリーダーIDは test_otozure3_* を毎回変える)。捨てた理由はログ friend_dropped
- マスモン: キズナ2の口 assistantLifeMasmonTeamOf(id) → [{ monster, nick, colors, lead }] が main に入ったら、alfBuildMore に more.ms = { id: [{ mo, n, c, l }] } で写し、assistantLifeFriendNormalizeMore で受ける(colors は 色id / 色id@10〜100 / null)。部屋のシートの masmonOf を写したもの優先に
- 台詞: ORDER-FRIEND.md(コトバ・ツムギへ依頼済み)。返ってきたら ALF_TALK_LINES などに入れる(doing ごとの迎え・寝言を足す口が要る)
- 検査: assistant-life-friend-check(⑩⑪)・browser-check(⑩⑫・--shots)・assistant-chat-check --unit ㉗

## オトズレ3 の区切り(2026-11-08 16:30)

公開済み(この区切りまで): #5056(訪ねる回数の制限なし・台本144本)/#5070(フレンドの最近)/#5077(いまの状態: ⚡ オート周回中・演奏中・助手ライフ・🔑 プライベート中・見せない設定)。

- いまの状態: 34-friends-api.jsx(FRIEND_PLACE_TEXT・friendsPresenceText(place, at, now, records)・records.au/im・friendsSetRoomPrivate)/75(表示・FriendPresenceShowSetting)/60-app(上書きに auto・show)。新しいキー mh_friend_presence_show_v1
- 最近: 56-assistant-life-friend.jsx の alfCollectActivity(端末の記録から)・30-rhythm-play の1行(曲名)・控え houses.ac1/house_more.ac。新しいキー mh_assistant_life_friend_activity_v1
- 残り
  - キズナ3の口 assistantLifeMasmonTeamOf(id) → [{ monster, nick, colors, lead }] が main に入ったら、alfBuildMore に ms を足して部屋のシートのマスモンを写したものにする(colors は 色id@濃さ/null)
  - 中継役 friend_scenes: 見張りに「攻略・課金・ガチャ」、決まりに「今日の天気」(次に配るとき)
  - 🔑 プライベート中はビート部テンポが friendsSetRoomPrivate を呼ぶと出る
  - 訪ねたときの助手が「最近」を話題にする台本(コトバ・ツムギへの注文がまだ)
- 手順の注意: merge-main は単独で打ち、結果を見てから次へ(ぶつかりの印が main に入った件 #5057)
