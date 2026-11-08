# オクリモノ(道具・家具)の引き継ぎ(2026-11-08 オクリモノ2 → 次の会話)

会話が長くなったので切る。次の会話はこの1枚と CLAUDE.md・PRESIDENT_DECISIONS.md・GIFT-PLAN.md・SOLO-GIFT-PLAN.md を読んでから始める。
報告・質問は窓口モンヒロくん(session_014GTmSNS2ae9tRr57k3zFjC)へ。見直しは検査部ミハリ(session_0113GBaDm4jk1s7jhDHX4fEx)。

## 公開済み(本番で確かめ済み・ミハリ OK)
- 段階A 道具10種類・好み: #4940・#4946・#4952 / 段階B 家具: #4991
- #5044 友情Lv・仲良し度の説明と数字の重み(贈るシートの棒・あと何点・段の何割・次の段で起きること)/「🛒」から交換所の道具の棚・家具の棚へ行って戻る/部屋の家具を吹き出し・名札・顔・もとの家具に重ならない所へ測ってずらす。更新履歴2行(社長「この文で」)
- #5055・#5062 仲良し度の知らせの札(44-growth-fx.jsx)の置き場所: 札の四角に重なる文字・押せるもの・顔を全部見る/右で空きが無ければ左寄せ/高さを24pxおきにも探す(フレンドの家・横の交換所)
- #5071 助手1人に贈る(❶B 1人に1日3回は2人とは別・❷A 量は2人の1人ぶん・❸A ひとりのチェキ・❹A 分かった◯/14・❺A 一緒にいる助手にも声かけ)。1人用4種類(手紙・キャンディ・キーホルダー・おまもり)。台詞 solo 224本+hint 8本(コトバ・ツムギ)。更新履歴4行・告知 market・印 assistantLifeSolo 真
- #5075 ミハリの小さい2点(背の低い横で部屋のシートのボタンを低く・道具タブの注を折らない)

## 部品と検査
- 部品 56-assistant-life-gifts.jsx(道具・好み・贈るシート[2人に/◯◯だけに]・重み・交換所への入口・家具)・56-assistant-life-house.jsx(部屋のシート・道具タブ)・60-app.jsx(giveAssistantLifeSolo・交換所を開く口 lifeShopEntry・仲良し度の読み口)
- 保存: mh_assistant_life_solo_gift_v1(新・SAVE_DATA.md に記載)。チェキ1人ぶんは mh_assistant_life_cheki_v1 の { [助手]: [日] }
- 検査: assistant-life-gift-weight-browser-check.js・assistant-life-solo-browser-check.js・assistant-life-furn-browser-check.js(⑧ 3つずつ置いた部屋)。どれも LIFE_BASE=本番URL で本番の版を見られる(フレンドの家の検査は見られない)
- 検査の家の開き方: HOME の助手どうしの会話の帯はタップで進む(社長)ので、[data-assistant-peer-close] を押してから [data-home-assistant-life] を押す
- 台詞の取り込み: tools/assistant/life-gift-lines-import.js(gift・hint・furn・solo)

## まだやること
3. **買って贈るを1回で**(社長: 止め絵 docs/progress/assistant-peer/gifts/buygive/ の形で作る/確かめの窓は毎回出す)
   - 贈るシート(2人に・1人に)・家具のシート(「まだ持っていない家具」の並びを足す)・道具タブの各行・思い出アルバムの「2人にしてあげる」(🧺🤝 の2つ→10種類。56-assistant-peer.jsx の data-assistant-peer-actions)で、持っていない品に「🛒 ◯◯P で買って贈る」
   - 確かめの窓: 品名・「ビートP ◯ で買って、そのまま ◯◯ に贈ります」・所持ビートP 前→後・上がる量/[やめる][🛒 買って贈る]。足りなければ「ビートPが足りません(あと◯P)」で押せない
   - ビートPは 60-app.jsx の exchangeRhythmEventPoints(offer, 1) と同じ処理で引く(二重に引かない)。**買う前に贈れるか確かめる**(1日3回・同じ道具は1日1回・家具は1人に1つ)。贈れなかったら買った品は持ち物に残る
   - アルバムの札の名前は ASSISTANT_LIFE_GIFT_WRAP で言葉の区切りで折る(止め絵では「おやつバス/ケット」と割れていた)
   - 作り終えたら本物の止め絵(縦・横・🔄横)と更新履歴・ヘルプの文案を窓口へ → 社長「この文で」・ミハリ OK → 公開 → 本番で確かめて報告
4. お知らせの帯の朝・夕・夜(前のオクリモノの引き継ぎから。ミハリの低い指摘)
5. 段階C: 好きな家具を使っている吹き出し(furnuse 24本・ツムギ)・遊びに来た助手が家具に触れる(visitfurn 40本・ツムギ)・描き下ろしの家具の絵。案から

## すり合わせ
- オトズレ3(フレンドの家): 作り直した画面は上を空けてあり、札の置き場所の直しと両立する。家具の部品 AssistantLifeRoomFurn は put でフレンドの家の家具も描く
- キズナ: assistantPeerUseItem の最後で assistantLifeRelOnGift を呼ぶ1行は残す
- 前からある NG: unreleased-assistant-hidden-check(60-app.jsx で助手の一覧を回している)は担当が別


## 2026-11-08 オクリモノ3 の区切り(引き継ぎの3〜5は済み)
- #5096・#5097 買って贈るを1回で(贈るシート2人に・1人に/家具のシート「まだ持っていない家具」/道具タブの各行/思い出アルバム10種類)。確かめの窓は毎回。ビートPは exchangeRhythmEventPoints(offer,1) で1回だけ(60-app の assistantLifeSetBuyer)。検査 assistant-life-buygive-browser-check
- 同じPR: 居場所タブのお知らせの帯を濃い下地に(朝・夕で字が沈んでいた)。検査 assistant-life-note-band-check
- #5107 1人に贈る・家具を贈るときも仲良し度の札(assistantLifeAddBondWithFx。60-app と 44-growth-fx は触っていない)。段が上がると Lv の画面も出るので、solo・furn・buygive の検査は閉じてから進む
- #5115 段階C(❶A 好きな家具の吹き出し・❷A 遊びに来た助手と家具の掛け合い→見守るで流す)と、場面の立ち絵(手で測った顔で縮尺・頭のてっぺんをそろえ・顔の何倍かで上下を切る・きゅうこ fit 0.95)。共通の表と関数は 56-assistant-life-house.jsx(assistantLifeStandRule ほか。ナカヨシ9 の部屋を大きく見る画面も使う)。測り方と使い方は gifts/stagec/STAND-MEASURE.md。検査 assistant-life-furn-stagec-browser-check・assistant-life-scene-stand-browser-check。assistant-life-browser-check ⑰ も新しい決まりで測る形に
- 取り下げ: 仲良し度の知らせの札の置き場所の直し(ナカヨシ8 の裏周回の枝が 44-growth-fx を書き換えているため)。横844のフレンドの家で札がボタンに重なる件は、ナカヨシ8 へ(main でも夕方以降に assistant-life-friend-browser-check の横2件が落ちることがある)
- 残り: 家具の描き下ろしの絵(届くまで絵文字のまま)。ほかの画面の立ち絵へ共通の決まりを当てはめるのは、社長に聞いてから
- 社長「次のリセットまで多人数を動かさない」: ここで区切り
