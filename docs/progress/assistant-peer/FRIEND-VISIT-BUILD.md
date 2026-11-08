# フレンドの家との行き来 段階1を作る(引き継ぎメモ)

オトズレの1つ目の会話(案と止め絵)はここで区切る(CLAUDE.md ⑨)。作るのは次の会話から。
**最初に読む**: CLAUDE.md → `docs/rules/PRESIDENT_DECISIONS.md`(2026-11-08 の行き来の行)→ `FRIEND-VISIT-PLAN.md`(とくに冒頭の「社長の選び」と0章)→ このメモ。

## 決まっていること

- 社長の選び: ❶A 控え/❷**B 助手が自分で行く**/❸A(相手の助手が自分で来る)/❹A 同じ助手どうしも会う/❺A 写真1枚+100P(1日300Pまで)/❻A ★も写す。「これで作る」済み
- 窓口の注文: 送り出し量が分かるまで `thin` で出せる作り/SQL は流す前に本文を窓口へ(1回にまとめる)/公開前に縦・横・🔄横で撮って自分で見る → ミハリに撮り直し → 更新履歴の文を窓口へ → 社長の「この文で」のあと公開

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

### 残り

1. main の取り込み(#4935 ほか)
2. HOME の「🏘 n」・帯の知らせ(ナカヨシ7の返事待ち)・居間の扉の顔
3. 縦・横・🔄横で本物を撮って見る → 崩れの検査を `assistant-life-browser-check.js` に足す → ミハリに撮り直し
4. SQL 本文を窓口へ → TEST→本番→VERIFY を1回で
5. Edge Function のデプロイ(窓口へ知らせてから)→ キズナへ PR 番号
6. 更新履歴・ヘルプの文を窓口へ → 社長の「この文で」→ 印を真に → 公開 → 本番で確認
7. 台詞の注文書(コトバ・ツムギ)
