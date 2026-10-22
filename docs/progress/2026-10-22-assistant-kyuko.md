# 新しい助手「きゅうこ」(2026-10-22〜・改善部ダメダシくんの会話で社長と直接進める)

依頼: 社長(窓口から「ダメダシくんの会話で社長が直接進める」と変更)。手本はあつ助手(`docs/progress/2026-10-22-assistant-atsu.md`・コミット ebdc835a)。
決めることは社長に選択式で1つずつ聞く。お話は社長に全文を見せてから。決まったことは `docs/rules/PRESIDENT_DECISIONS.md` に1行ずつ。公開の印は切のまま入れ、社長の OK で公開。

## 絵
- 原本: ブランチ `claude/kyuko-art` の `tools/art-sources/kyuko-2026-10-22/kyuko-expressions.png`(1536×1024・背景は透明・384×512 が4列2段)
- 表情の当て方(ゲームの8つの枠): 微笑み=normal / 笑顔=happy / ウインク=wink / 驚き=surprise / むくれ=angry / 困り=troubled / したり顔=excited / 照れ=crying(crying は負けたときなど9回しか出ないため)
- 顔アイコンの案A〜D(顔のアップ・頭ぜんぶ・胸まで・少し寄り)を社長に見せた。四角の切り出し: A (80,115,280,315) / B (45,20,345,320) / C (12,40,372,400) / D (55,75,305,325) → 256×256

## 決まったこと
- 見た目は女だけど中身は男。一人称「俺」。おだやかで頭脳派。ただしいいかげんなところもある。無課金なのにランカー
- 口調・呼び方・加わる条件(最初から選べる)・アシストカード「きゅうこの譜面」・顔アイコン案B → 中身は docs/rules/PRESIDENT_DECISIONS.md の 2026-10-22 の行
- 社長の話し方もあつに足す(台帳)

## 決めることは全部そろった(10/22 夜)。次は作る

## 進み具合(10/22 夜)
- [x] 絵(384×512)と顔アイコン(案B)を images/assistant/kyuko_*.PNG・face/ へ
- [x] ASSISTANTS・呼び方・見本・仲良し度の30段・呼び方の例・連打・全場面のセリフ(552本・あつと同じ場面と事実)
- [x] アシストカード「きゅうこの譜面/編曲/交響曲」(breeder.js の KYUKO_TIERS・バトルの処理・説明・残りターンの札・タクティクスは単体攻撃を引き受け🔥なし)
- [x] マーケットに 150000。公開の印が立ち、お話を見たあとだけ並ぶ(kyukoCardOnSale)
- [x] 加入のお話(社長OK)。イルミネ・ドリーミィは STORY_GUEST_SPEAKERS。Toward the Stars の行で holdMs 4秒止まる
- [x] あつに社長の話し方を足した(speech・くせ・見本・HOMEのセリフ6本)
- [x] 見張り tools/assistant/kyuko-check.js(run-checks-always.json に登録)
- [ ] 公開: 社長の OK でイルミネ・ドリーミィと同時に assistantKyuko を真に。そのとき更新履歴・ヘルプ・告知(changelog-help-update スキル)と、おしゃべりの材料の作り直し

## 作る場所(あつと同じ)
- `data/assistants.js`: ASSISTANTS・ASSISTANT_PEER_CALLS・ASSISTANT_CHAT_EXAMPLES・ASSISTANT_UNLOCK_STORIES・ASSISTANT_BOND_STYLES・全68場面の基本セリフ・お話と EVENT_REPLAYS
- `data/breeder.js`: TEACHING_CARDS にカード・顔アイコン・マーケット
- ゲーム: 公開の印(10-core.jsx)・お話を流す条件(60-app.jsx)・カードの効果(バトルの処理)・検査・ヘルプ
