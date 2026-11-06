# 助手どうしのつながり — 進み具合(ナカヨシ)

計画: [`../assistant-peer-plan.md`](../assistant-peer-plan.md)。枝 `claude/assistant-peer`。

## できたこと(2026-11-07)

| 段階 | 中身 | 置き場所 |
| --- | --- | --- |
| 1 会話の共有 | おしゃべりのとき、30日以内に話したほかの助手の思い出メモを `ctx.peerMemos` で送る。メモに「ないしょの話」(secret)の欄を足し、そこと「ないしょ/秘密」らしい言葉・個人情報らしい文は渡さない。話した日は `mh_assistant_chat_last_v1` | 端末 `src/parts/56-assistant-chat.jsx` / サーバ `supabase/functions/assistant-chat/core.js`(`normalizePeerMemos`・`peerMemosText`・決まり文3行・メモの secret 欄)。**サーバは窓口が配るまで古いまま**(古いサーバは peerMemos を読み捨てるだけで壊れない) |
| 2 ペアの仲良し度 | Lv1〜5(0/30/90/180/320)。お話 +6・切り替え +3・掛け合い +2、ペアごとに1日12まで。Lv2 掛け合いが増える / Lv3 関係図に線 / Lv4 息の合った掛け合いが増える・API 版でお互いの話題を多めに(呼び方は変えない・2026-11-07 社長) / Lv5 特別なお話 | データ `data/assistants.js` 末尾 / 端末 `src/parts/56-assistant-peer.jsx` / つなぎ `60-app.jsx`(chooseAssistant・お話の finish・表示)・`56-screen-profile.jsx`(関係図) |
| 3 台本版の掛け合い | 28ペア×(Lv1 2本・Lv2 1本・Lv4 1本・Lv5 特別なお話)= 140本。HOME 1日5回(入るたび4割)・ほかの画面 1日3回(2割5分)・続けて流さない90秒 | `ASSISTANT_PEER_TALKS`(`{c}` = 話し手の相手の呼び方) |
| 3 API 版の掛け合い | HOME に入ったとき、その日の分が尽きていれば頼む(その日に頼むのは3回まで。サーバの上限は1人1日100回・全員1日3,000回)。4本ずつ作り、HOME で台本より先に(6割)出す。失敗・上限は台本版だけ | 端末 `assistantPeerRequestGen`(保存 `mh_assistant_peer_talk_gen_v1`)/ サーバ `core.js` の `handlePeerTalks`・`index.ts` の `takePeer`・SQL `supabase/migrations/202611070001_assistant_peer_talk_usage.sql` |

公開の印: `RELEASE_FLAGS.assistantPeer`(段階2・3 台本版)・`RELEASE_FLAGS.assistantPeerApi`(API 版。**窓口がサーバを配って SQL を流すまで偽**)。検査: `tools/assistant/assistant-peer-check.js`、段階1は `assistant-chat-check.js` ㉕。

止め絵: `shots/1-home-talk.jpg`・`shots/2-home-special.jpg`・`shots/3-profile-map.jpg`。

## 待っていること

- 更新履歴・ヘルプの文を窓口が確かめる(マージ前)
- サーバ(assistant-chat)を窓口が配る。更新履歴の「おしゃべりの話題も伝わる」行は、配ったあとでないと本当にならない

## 窓口がやること(配る)

1. SQL `supabase/migrations/202611070001_assistant_peer_talk_usage.sql` を流す(足すだけ)
2. `supabase/functions/assistant-chat/` を配る(段階1の共有メモ・secret 欄・API 版がまとめて入る)
3. 配ったら `RELEASE_FLAGS.assistantPeerApi` を真にする(1行)
