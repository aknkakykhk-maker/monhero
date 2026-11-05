# 新しい助手を足すとき

2026-11-05、8人目の助手えるびんを公開した直後に、モンヒロビートのモードえらびでえるびんが
みゅあの台詞(「てかてか、みんなで遊ぶと周回のごほうびも増えるんだって！ まぢおいしい✨」)を話していた。
社長「これみゅあのせりふじゃない？」「新助手出るたびにみゅあのセリフとごっちゃになるのどうにかして」。

## なぜ起きたか

- 台詞は `data/assistants.js` の場面(`ASSISTANT_SCENES`)と、場面の定義を持たない束(`addAssistantLinePack` だけで作る場面。
  `rhythmModeSelect` など)の2通りで持っている
- `filterAssistantLines` は、その助手の行が無い場面で**みゅあの行へ黙って落としていた**。
  新しい助手の行を書き忘れた場面は、画面の上ではみゅあの口調で話してしまい、気づけなかった
- 既存の `assistant-sets-coverage-check` は `ASSISTANT_SCENES` だけを見ていて、束だけの場面を見ていなかった

## いまの作り

- `filterAssistantLines` は**ほかの助手の行へ落とさない**。行が無い場面では何も言わない(吹き出しが出ないだけで、画面は止まらない)
- 抜けと取り違えは `node tools/assistant/assistant-line-owner-check.js` が止める(毎回回る検査に入っている)
  - ① 全助手(公開前も含む)×全場面(場面と束の両方)に、その助手自身の行がある
  - ② 行の無い助手で引いても、ほかの助手の行を返さない
  - ③ 各助手の行に、ほかの助手の口ぐせが混ざっていない。目印は `ASSISTANTS[].speechQuirks` の「」の中から自動で作る。
    みんなが使う言葉(「です」「いいね」など)は検査の `SHARED` で外す
  - ④ ヘルプの助手のひとこと(`help.js` の `assistant`)は、選んでいる助手がそのまま読むので、だれの口ぐせも入れない
  - ⑤ 助手ごとの台本の表(`ASSISTANT_..._SETS`)にも、ほかの助手の口ぐせが混ざっていない

## 足すときの手順

1. `ASSISTANTS` に登録し、`speechQuirks` に口ぐせを「」で書く(③の目印になる)。ほかの助手と言い回しがかぶる言葉は、
   検査の `SHARED` に足すか、「」に入れない
2. **全場面の行をそろえる。** いちばん近い前の助手(例: ソラシド)の束を `grep -n "assistantId: 'sorashido'" monster-hero/data/assistants.js` で探し、
   同じ場面に同じ本数を、新しい助手の口調で書く。束だけの場面(`rhythmModeSelect` など)も忘れない
3. 助手ごとの表(`ASSISTANT_..._SETS`・`ASSISTANT_PEER_CALLS`・カードの `CARD_BATTLE_LINES` など)にも行を足す
4. 次を通す
   ```
   node tools/assistant/assistant-line-owner-check.js      全場面の行・口ぐせの取り違え
   node tools/assistant/assistant-sets-coverage-check.js   助手ごとの表に全員がいるか
   node tools/run-checks.js --changed
   ```
5. 公開前の確認では、新しい助手を選んで**各画面を開き、ほかの助手の口調で話していないか**も見る
