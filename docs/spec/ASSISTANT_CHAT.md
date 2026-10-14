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
- system の並び(プロンプトキャッシュが効く順。Haiku 5.5 の最小は 512 トークン): 決まり → ヘルプ【区切り】→ 助手の人柄【区切り】→ プレイヤーごとの値(呼び方・仲良し度・口調・メモ)
- 断り: refusal・API エラー・形の崩れた返事 → 「ごめん、今うまく話せないや」(回数を戻す)。上限 → 「今日はもうおしゃべり疲れちゃった。また明日ね」
- 「1人」は端末のブリーダーID(`mh_breeder_id_v1`)で数える。ID を作り直すと抜けられるが、全員合計の上限があるので月の予算は超えない

## 材料JSON(ヘルプの中身・助手の人柄)

`tools/build-assistant-chat-digest.js` が `node tools/build.js` のたびに作る(`--check` でずれを見る)。

- ヘルプ: `help.js` の各トピックの見出しと本文。1トピック380字まで、全体で26,000字まで(超えたらビルドが止まる)
- **公開の印(releaseFlag / unreleasedFlag)が付いたヘルプは全部はぶく**(まだ出ていない機能を助手が話さないため)
- 人柄: `assistants.js` の名前・tagline・intro・greeting と、HOMEのセリフから24本の見本(等間隔で選ぶ。乱数は使わない)
- 中継役は公開中のサイトから読むので、**ヘルプを直しても中継役を公開し直す必要はない**(次のサイト更新から10分以内に追従)

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
