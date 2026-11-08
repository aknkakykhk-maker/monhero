# MFバトルカード: 助手のおしゃべり(AI)

2026-10-25 社長の決定。相手の手を外のAIに決めさせる試し(平均5.5秒・最長8秒・HARDに負け)を見て、
**バトル中の手は今のAIのまま**にし、外のAI(Claude Haiku 5.5)は次の3つに使う(社長が3つとも選んだ)。

| 場面 | いつ | 画面 | 待つ長さ | 届かないとき |
| --- | --- | --- | --- | --- |
| 対戦後のひとこと(`after`) | 1試合に1回 | 結果の画面の、相手の助手の吹き出し | 6秒 | 決まった台詞のまま |
| 山場のひとこと(`moment`) | 大技・大きいダメージ・KO・残り1体・逆転(1試合5回まで) | 対戦中の相手の助手の吹き出し | 2.5秒 | 決まった台詞のまま(先に出しておき、届いたら差しかえる) |
| デッキ相談(`deck`) | デッキ編成の画面の「〇〇に相談」 | 小窓(勧めるカードに「入れる」) | 12秒 | 決まった一言。勧めるカードは出さない |

- 手は今のAIが決める。AIが無くても遊べる(失敗・遅れ・上限・切のときは、いまの決まった台詞 `83-card-battle-lines.jsx`)
- 呼べるのは公開の印 `RELEASE_FLAGS.cardAssistantTalk` が立ってから。立つまではデバッグ端末(`DEBUG_UNLOCK_KEY`)だけ
- オプションの「助手のおしゃべり(AI)」で入/切。既定は入。保存は新しいキー `mh_card_ai_talk_v1 { on }`
- 見本の対戦・マルチ・練習試合では呼ばない

## つくり

- 中継役: `supabase/functions/card-assistant-talk/`(入口 `index.ts`・中身 `core.js`)。書き方は助手とおしゃべり(`assistant-chat`)にそろえた。
  あちらの中身と回数の上限には触らない。キーは同じ `ANTHROPIC_API_KEY`
- ゲーム側: `monster-hero/src/parts/83-card-battle-talk-ai.jsx`(呼ぶ口・入/切・材料づくり)。つなぎは 84(山場・結果・オプション)と 87(デッキ相談)
- 人柄: 助手とおしゃべりと同じ材料(`data/assistant-chat-digest.json` の assistants)。その場面の決まった台詞を見本として一緒に送る
- 送るのは数字と名前だけ(ターン・残りの数・カードとモンスターの名前・勝ち負け・逆転・相手の戦い方)。中継役が決まった言い方の文に直す
- デッキ相談の一覧は、デッキ編成と同じ決まり(`cardDeckAddReason`・同じ名前は3枚まで・持っている数・50枚)で入れられるものだけ。
  勧められたカードは中継役とゲームの両方で確かめ直し、合わないものは出さない
- 速さ優先: thinking は切る・effort low・返事は構造化出力(`text`・`expression`、デッキ相談は `picks` も)。やり直しはしない
- キャッシュ: 決まり → 人柄(ここに cache_control)。試合ごとに変わるものは user のほうへ置く
- ログに本文を書かない(件数・エラーの種類・トークン数だけ)

## 回数の上限(2026-10-25 社長が案どおりに決めた)

`card_assistant_talk_take(p_breeder, p_bucket, p_user_limit, p_total_limit)` で数える(`supabase/migrations/202610250001_card_assistant_talk_usage.sql`)。
助手とおしゃべりの `assistant_chat_usage` とは別の表。1日の区切りは朝5:00(JST)。

| 上限 | 既定 | Secrets で上書き |
| --- | --- | --- |
| 1端末1日 ひとこと(after + moment) | 150回 | `CARD_TALK_USER_DAILY_LIMIT` |
| 1端末1日 デッキ相談 | 10回 | `CARD_TALK_DECK_DAILY_LIMIT` |
| 全員の合計1日(全部) | 2,000回 | `CARD_TALK_TOTAL_DAILY_LIMIT` |

## 費用の見込み(Haiku 5.5: 入力 $0.10・キャッシュ読み $0.01・書き込み $0.125・出力 $0.50 / 100万トークン)

- ひとこと: 人柄 約5千トークン(キャッシュ)+場面 約300+返事 約100〜300 → 1回 約 $0.0002(キャッシュあり)〜$0.0008(切れて書き直し)
- デッキ相談: 一覧 約3千トークン(毎回)+返事 約500 → 1回 約 $0.001〜0.0013
- 1試合(ひとこと1+山場最大5): 約 $0.0013〜0.005
- 全員2,000回/日を毎日使い切ると: ふつう 月 約$12・最悪に近いと 月 約$48
- 予算の枠は助手とおしゃべりと分けない(社長「APIの上限は今は絶対行かないからだいじょぶ」)

## 公開の手順(窓口)

1. `supabase/migrations/202610250001_card_assistant_talk_usage.sql` を流す(足すだけ)
2. 関数 `card-assistant-talk` を出す(verify_jwt を外す)。Secrets は既存の `ANTHROPIC_API_KEY` を読む
3. デバッグ端末で3つの場面を試す → 社長が「公開」と言ったら `RELEASE_FLAGS.cardAssistantTalk` を真にする(更新履歴・ヘルプは MFバトルカードの公開の日にまとめて書く)

## 検査

`node tools/card/card-assistant-talk-check.js`(偽物の Claude と偽物の回数の数え方で、中継役とゲーム側の材料づくりを確かめる)

## デッキを組む(deckPlan・2026-11-08 社長の決定「助手のデッキを AI で組む」)

ゲーム側はルールくん、中継役はブレイブくん。同じ中継役 `card-assistant-talk` に種類 `deckPlan` を足した(Haiku 5.5・構造化出力)。

### ゲームが送るもの(数字と名前だけ。自由な文は送らない)

```json
{ "kind": "deckPlan", "breederId": "…", "assistantId": "mua", "samples": ["その助手のふだんの台詞(60字まで・6つまで)"],
  "facts": {
    "style": "attack | guard | normal",
    "favorites": ["好きなモンスターの名前(5つまで)"],
    "cards": [{ "no": "101", "name": "…", "kind": "pow", "guts": 4, "damage": 6, "user": "mocchi", "area": true }],
    "fields": ["場のカードの候補の名前"],
    "habit": { "big": [下, 上], "saveGuts": [下, 上], "keepGuard": [下, 上] },
    "prefer": [下, 上]
  } }
```

- 人柄は、ほかの種類と同じく中継役が `assistant-chat-digest.json` から読む(ゲームは送らない)。口調の見本は `samples`
- 候補は200枚まで・場のカードは30まで。くせの幅は 0〜5 の中に丸め、下>上なら入れかえる。`prefer` が無ければ 5〜8
- `style` が無い・候補のカードが無いときは 400

### 中継役が返すもの

```json
{ "ok": true, "kind": "plan", "name": "12字まで | null", "line": "60字まで | null", "prefer": ["候補の no だけ・重なりなし・上の枚数まで"],
  "field": ["候補の名前だけ・2枚まで"], "habit": { "big": 1.5, "saveGuts": 0, "keepGuard": 1.5 }, "remainingToday": 39 }
```

- 候補に無い no・名前は捨てる。くせの数は幅の中へ丸める(無ければ幅の真ん中)。`prefer` が下の枚数に届かないことはある(ゲームが足す)
- `name`・`line` は言葉の見張りに通し、落ちたら `null`(ゲームが既定の名前・ひとことを使う)。見張るもの: ゲームに出してはいけない言葉(マルチ対戦のチャットの `CARD_CHAT_NG` と同じ表)・連絡先らしいもの・モンスターを「子」と呼ぶ言い方(名前は「子」を全部・ひとことは「子たち」「どの子」など。`tools/changelog/monster-ko-check.js` と同じ決まり)
- 上限のとき `{ ok: true, kind: "tired", text: null, limited: "user" | "total" }`、遅れ・読めない返事は `{ ok: true, kind: "sorry", text: null }`(回数は返す)。どちらもゲームは AI なしで組み直す

### 回数(ひとこと・デッキ相談とは別に数える)

| 上限 | 既定 | Secrets で変える |
| --- | --- | --- |
| 全員合わせて1日 | 100回(社長の決定) | `CARD_DECK_PLAN_TOTAL_DAILY_LIMIT` |
| 1人1日 | 40回(8人 ×(はじめの3回+10対戦ごと)を見て) | `CARD_DECK_PLAN_USER_DAILY_LIMIT` |

数える表と関数は `supabase/migrations/202611080001_card_deck_plan_usage.sql`(足すだけ。`card_deck_plan_usage`・`card_deck_plan_take`・`card_deck_plan_refund`。service_role だけが呼べる)。1日の区切りは朝4:00。

### 公開の手順(窓口)

1. `202611080001_card_deck_plan_usage.sql` を流す(足すだけ)
2. 関数 `card-assistant-talk` を出し直す(`index.ts`・`core.js`)。Secrets は足さなくても既定の上限で動く
