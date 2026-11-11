# 引き継ぎメモ: ナカヨシ12(助手ライフ「得の見せ方 B+C」と「初めての人への1枚」)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/assistant-life.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。
最初に `cd tools && npm install`(無いと検査が @babel/core で落ちる)。

## 済んだこと(main に入っている)
- 点検の道具 `tools/assistant/life-walkthrough.js`(#5216)。使い方は手引きの「通しの点検」。控えは 3001点
- 小さな直し(#5258): 今日やれることの札に「🤝💗 アップ」と済み✓/にぎわいの札を押すと説明/今日あったことが空のときの案内/声をかける窓の1行/フレンドの空の案内。検査 `tools/assistant/assistant-life-clarity-check.js`
- 改善案10個 `docs/progress/assistant-life/IMPROVE-2026-11-11.md`、得の見せ方の案 `docs/progress/assistant-life/BENEFIT-PLAN.md`(見本 `benefit/mock-all.png`。本物の画面ではない)

## 残りの仕事(社長が選んだ・これから作る)
1. **B 今日の得ボード**: 家のいちばん上に3行「⏰ いま(STEP2 の得)/📅 今日(あと何回 → 何が上がる)/🌱 次のごほうび(いちばん近い1つ・あと◯)」。行を押すとその場所へ
   - STEP2 の帯は `56-assistant-life-ux.jsx` の `AssistantLifeNowPerks`・行の元は `assistantLifePerkRows(life, ids, nameOf)`(ナカヨシ10。帯の中身をこちらの案に合わせて直してよいと返事あり。1行目はこの帯をそのまま使う)
   - 「次のごほうび」は STEP1 の `AssistantLifeBondRoad` と同じ読み口(`assistantLifeBondPointsOf`・`ASSISTANT_BOND_LEVELS`)。8人でいちばん「あと◯」が小さい助手
   - 家の絵が縦で約150px 下がる。横(844×390)は右の欄が詰まっているので置き場所に注意
2. **C ごほうびの道のり**: 「きずな」タブの先頭に、8人の仲良し度・組の友情Lv・マスモンの「次にもらえるもの」を近い順。きずなはナカヨシ13 が STEP3/4 で触っている(題・説明・組の行に「あと◯で Lv◯ → 開くもの」済み)。触る前に場所を共有
3. **案1 初めての人への1枚**: 1回だけ。「①見守る・贈る・おしゃべり ②仲良くなるとごほうび ③ほかの遊びも得に」+最初に押す札(見守る)を光らせる。「見た」の印は新しい保存キーを1つ足すだけ(既存キーは触らない・⑦)。3行の文は止め絵と一緒に案として窓口へ
4. 新しい部品は `monster-hero/src/parts/56-assistant-life-guide.jsx`(新規。`parts.json` と `tools/team/depts.json` の files に足す)に置き、house.jsx は差し込みだけにする
5. **公開の前に**: 本物の止め絵(縦・横)と更新履歴の案を窓口へ → 社長の「この文で」を待つ。保存キーを足すので `node tools/ctx.js gate` に従う(「要る」と出たらマージ前に窓口へ)

## 返事待ち
- #5258 の更新履歴: 新UI既定化の告知(ナカヨシ13)に足す2行の文案を、ナカヨシ13 と窓口へ送った。窓口の了承待ち(入れるのはナカヨシ13)

## 分担中の部員(触る前に場所を共有)
- ナカヨシ13 session_0113GBaCD4d89ea1WzHQAPjA … STEP3/4・新UI既定化(見出しの切替ボタンを外す枝)。家の先頭の1行は足さない約束
- ナカヨシ10 session_0113GBaBXeXz5b5yGY9pbXaV … STEP2 の帯・施設の得
- オクリモノ4 session_0113GBaCLkEaifrXZKgN6BLC … 贈るまわり(gifts.jsx・道具の一覧)。得の言い方は「💗 仲良し度」「🤝 友情Lv」でそろえた
- 窓口 session_014GTmSNS2ae9tRr57k3zFjC

## はまった所
- `run-checks.js --changed` は道具の名前が「life」「baseline」に当たると400本以上選ばれ、この環境では30分かかる。`--parallel 4` で裏で回し、出力はファイルへ。`masu/safe-masu-baseline-migration-check.js` は環境が遅いと時間切れになる(単独で回すと通る)
- 検査で顔ぶれを差し替えるときは8人とも決める(決まっていない助手がいると組み直されて「今日あったこと」に1件入る)
- main の進みが速く、PR 作成後にもう一度 `node tools/merge-main.js` が要ることがある(house.jsx は tiles・見出し・シートの並びがぶつかりやすい。両方残す)
- 旧UIには新しい機能を足さない。モンスターも助手も「子」と呼ばない
