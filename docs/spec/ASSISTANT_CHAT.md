# 助手とおしゃべり(正本)

2026-10-14 に社長の指示で作った。助手(みゅあ・きき・ももすけ・ドラ)と自由に話せる会話の窓。
返事は Claude(claude-haiku-5-5)が作る。費用は社長の API クレジット(月100ドル)。

公開の印 `RELEASE_FLAGS.assistantChat`(`17-release-changelog-login-missions.jsx`)の後ろにある。
**社長が試して OK を出すまでは偽のまま。** それまではデバッグ設定の「💬 助手とおしゃべり(試す)」からだけ開ける。
印を真にすると、HOMEの「💬 おしゃべり」ボタン・ヘルプ(助手について)の説明・仲良し度の表の「助手とおしゃべりする」・更新履歴が一緒に出る。

## 社長が決めたこと

| 項目 | 値 |
| --- | --- |
| モデル | `claude-haiku-5-5` |
| 回数 | 1人1日100往復・全員合計1日2,500往復(朝5:00 JST で戻る)。中継役の定数。Secrets `ASSISTANT_CHAT_USER_DAILY_LIMIT` / `ASSISTANT_CHAT_TOTAL_DAILY_LIMIT` で上書きできる |
| 仲良し度 | 新しい行動 `chat`。返事が来た1往復で +2、1日 +20 まで(`data/assistants.js` の `ASSISTANT_BOND_ACTIONS`)。話した相手の助手へ入る |
| 思い出メモ | 返事と一緒に120字までのメモを返してもらい、助手ごとに端末へ残す。次の会話で渡す |
| 距離感 | 恋愛ではなく、一緒に遊ぶ相棒(ヘルプの決まり)。未成年も遊ぶ前提 |

## 作り

```
ゲーム(56-assistant-chat.jsx の AssistantChatWindow)
  └ POST {SUPABASE_URL}/functions/v1/assistant-chat
      └ supabase/functions/assistant-chat/index.ts(Deno の入口)
          ├ core.js(中身。検査から偽物の Claude で動かせる)
          ├ assistant_chat_take / assistant_chat_refund(回数。supabase/migrations/202610140001_assistant_chat_usage.sql)
          ├ 材料JSON: 公開中のサイトの monster-hero/data/assistant-chat-digest.json(10分覚えておく)
          └ Claude(Secrets の ANTHROPIC_API_KEY。公式SDK npm:@anthropic-ai/sdk)
```

- **API キーはゲームに書かない。** 中継役が環境変数から読む
- **会話の中身は端末だけ。** `mh_assistant_chat_log_v1`(助手ごとに最後の30件)・`mh_assistant_chat_memo_v1`(助手ごとのメモ)。
  既存のキーは触らない。サーバーへ送るのは直近7件(3往復＋今回)だけ。**中継役のログに本文を書かない**(件数・エラーの種類・トークン数だけ)
- **電話番号・メール・郵便番号・住所らしい文字**は、ゲームが送る前に止める(回数も使わない)。中継役でも同じものを見る
- Claude への頼み方: `thinking: {type:'disabled'}` ＋ `effort: 'low'`(Haiku 5.5 は effort が high 以下なら thinking を切れる)、
  `max_tokens: 400`、構造化出力 `output_config.format = {type:'json_schema'}` で `{reply, expression, memo}` を1回で受け取る
- system の並び(プロンプトキャッシュが効く順。Haiku 5.5 の最小は 512 トークン): 決まり → ヘルプの目次と基本【区切り】→ 助手の人柄【区切り】→ 質問に合うヘルプの項目・プレイヤーごとの値(呼び方・仲良し度・口調・メモ)
- 決まりには「答えのもとに無い仕組み・場所の案内を推測で作らない」「似た名前(モンヒロビートの HELL とバトルの難易度など)を取り違えない」「分からないときはヘルプの項目を案内するか分からないと言う」を入れてある
- 断り: refusal・API エラー・形の崩れた返事 → 「ごめん、今うまく話せないや」(回数を戻す)。上限 → 「今日はもうおしゃべり疲れちゃった。また明日ね」
- 「1人」は端末のブリーダーID(`mh_breeder_id_v1`)で数える。ID を作り直すと抜けられるが、全員合計の上限があるので月の予算は超えない

## 材料JSON(ヘルプの中身・助手の人柄)

`tools/build-assistant-chat-digest.js` が `node tools/build.js` のたびに作る(`--check` でずれを見る)。

2026-10-14 に作り直した(窓口の指摘: HELL の質問に「バトルの難易度」と答えた。最初の形は公開の印の付いたヘルプを全部はぶいていて、
HELL・モンヒロビート・マルチの項目が材料に無かった)。

- `index`: ヘルプ全項目の目次。`basics`: 最初のカテゴリ(基本ルール)の本文(5,000字まで)。この2つと人柄が**毎回渡す部分**で、キャッシュする(合わせて20,000字まで。超えたらビルドが止まる)
- `topics`: 全項目の見出し・小見出しと助手のひとこと(`heads`)・本文(1項目1,500字まで)。中継役が**質問の言葉で上位3項目を選び**、キャッシュの区切りの後ろへ足す
  - 選び方(`core.js` の `selectHelpTopics`): 2文字ずつの並びと英数字の語で比べ、どの項目にも出る並びは重みを下げる(IDF)。見出し4倍・小見出し2倍・本文は長さで割り引く。ひらがなだけの並びは数えない。ひとつ前のプレイヤーの発言も軽く足す。**2回目の Claude 呼び出しはしない**
  - 見出しと遊ぶ人の呼び方がずれている項目だけ、生成スクリプトの `TOPIC_ALIASES` に検索用の言いかえを書く(例: 「みんなで対戦」← マルチ)
- **公開の印(releaseFlag / unreleasedFlag)は、ビルドの時点の `RELEASE_FLAGS` の値で決める**(parts の定数で評価する)。値が分からない印は出ていないものとしてはぶく
- `glossary` / `terms`: ゲームの用語の小さな表(2026-10-14 社長が試して「みゅあが自分の愛称『モンビー』を知らない」と分かったため)。
  生成スクリプトの `TERM_GROUPS` に「同じものの言い方の組」と説明を取る項目だけを書き、説明の1文はヘルプから、
  助手ごとの呼び方はセリフ(場面・束・告知の読み上げ)で実際に使っている回数から機械で作る。毎回渡す部分に入れてキャッシュする。
  中継役は `terms` で質問を広げてから項目を選ぶ(「モンビーって何?」でもモンヒロビートの項目が選ばれる)
- 人柄: `assistants.js` の名前・tagline・intro・greeting と、HOMEのセリフから24本の見本(等間隔で選ぶ。乱数は使わない)
- 中継役は公開中のサイトから読むので、**ヘルプを直しても中継役を公開し直す必要はない**(次のサイト更新から10分以内に追従)。
  ただし材料JSONの形(`version`)を変えたときは、中継役も一緒に公開し直す

## 公開(deploy)の手順 — 窓口が行う

部署は Supabase に触れない決まりなので、窓口が Supabase の道具で行う。

1. 表と関数(済み・2026-10-14 窓口が実行): `supabase/migrations/202610140001_assistant_chat_usage.sql`
2. Secrets に `ANTHROPIC_API_KEY` を登録(社長)
3. Edge Function `assistant-chat` を公開する。ファイルは `supabase/functions/assistant-chat/index.ts` と `core.js` の2つ。
   **verify_jwt は外す**(ゲームが送る publishable key は JWT ではないため。外さないと 401 になる)
4. 呼べるのは `https://aknkakykhk-maker.github.io` からだけ(CORS と Origin の確認)。増やすなら Secrets `ASSISTANT_CHAT_ALLOWED_ORIGINS`(カンマ区切り)

## 検査

`node tools/assistant/assistant-chat-check.js`(本番の API は叩かない。偽物の Claude を core.js へ渡す)

- 前半: 頼み方・system の並び・返事・断り・上限・個人情報・ログに本文が出ないこと(`--unit` で前半だけ)
- 後半(実ブラウザ): デバッグ設定から開く → 偽物の返事が出る → 仲良し度 +2・メモと会話が新しいキーに残る・既存のキーが消えない・直近の会話だけ送る

## 費用の目安

上限の2,500往復を毎日使い切った場合で、月30〜50ドル(入力の大半はキャッシュ読み込み)。
実際はログのトークン数(`cacheRead` / `cacheWrite` / `input` / `output`)で確かめ、上振れしたら上限の Secrets を下げる。
