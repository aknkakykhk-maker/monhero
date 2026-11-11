# 引き継ぎメモ: ナカヨシ20 → 次の会話(助手ライフのトップの家・できごとの場面・2026-11-11)

読む順: CLAUDE.md → docs/depts/assistant-life.md → `node tools/ctx.js decisions assistant-life` → このメモ → docs/progress/assistant-life/top-scene/PLAN.md

## いまの状態
- 本体は main に入っている(PR #5424・直し #5433)。公開の印 `assistantLifeTopHouse`・`assistantLifeDailyScene` は main ではまだ偽
- **公開の PR #5436**(印を真・更新履歴4行・ヘルプ3か所・台帳)。更新履歴もヘルプも社長「この文で」済み・ミハリ3は「ほぼ OK」(直しは #5433 で済み)
  → **窓口が Fable の最終確認に回している。OK が出たら #5436 をマージ**(main を取り込み → `node tools/build.js` → 必須の検査 → 更新履歴の日時がコミット時刻と1時間以上ずれたら `TZ=Asia/Tokyo date` で取り直す)

## 作りの要点
- トップ: 今の家の絵 `AssistantLifeHouseArt` を `grid4`(縦でも4部屋×2段)で一番上へ。下に `AssistantLifeTopStrip`(出かけ先の丸・1行)、できごとの札、得の帯(`fold` で「今日・次」を▼)
- できごと: `assistantLifeDailyWho`(同じ場所の2人)→ `assistantLifeDailyPlan`(場面/珍しい5%)→ `AssistantLifeDailySceneView` → `assistantLifeDailyFinish`(今の `mh_assistant_life_daily_v1` に「聞いた」・💗 `lifeDaily` +4/+8・1日12・珍しいはアルバム)
- 台詞: ココロ3(session_0113GBaCbyGHhFd5kDm8ea7z)の `top-scene/daily-lines.txt`・`daily-scenes.txt` → `node tools/assistant/life-daily-import.js`。2場面めを足すならココロ3へ(形は LINES-SPEC.md)
- 検査: `tools/assistant/assistant-life-top-check.js`(①〜⑧。`--shots` で `top-scene/real/` に止め絵)・assistant-line-owner-check の⑥

## はまった所
- data/assistants.js の末尾は peer-rewrite-table.js の範囲。足すブロックはその BEGIN より前に置く
- 新しい 💗 の行動は tools/assistant-bond-check.js の表と PEER_KEYS にも足す
- 取り込んだ台詞は印に関係なく読めるので、使う所は必ず印で止める(#5433)
- 台帳(PRESIDENT_DECISIONS.md)は末尾で毎回ぶつかる。両方残す

## 残り
- 公開後: 本番で助手ライフを開いた最初の画面を社長に見てもらう
- ミヤスサ(session_0113GBaAnn6WbUTcsgkFfpPv)のトップ以外の指摘は、窓口から回ってきたら
