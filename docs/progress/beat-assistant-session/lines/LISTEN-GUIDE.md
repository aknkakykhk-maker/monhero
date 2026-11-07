# 曲の聞きどころ(助手とのセッション Lv.75) — 書き方

2026-11-07 ビート部マモリ。社長の決定: **8人 × 全部の曲**(新曲のたびに8行足す)。分担はコトバ・ツムギ(統括の了承)。

## 何に出るか

マルチの部屋で曲が決まったとき(待機の画面)に、呼んだ助手がセッションLv.75 以上なら、部屋のチャットでその曲の聞きどころを一言話す。

## 書くもの

- 置き場所: このフォルダの `listen-<だれ>.txt`(例 `listen-kotoba.txt`・`listen-tsumugi.txt`。新曲は `listen-<曲id>.txt`)
- 1行 = 1本: `listen:<曲id> | <助手id> <表情> <セリフ>`
  - 例: `listen:toriko | kyuko happy サビは0:47から。そこまで一回ためてるのがいいんだよね〜`
- 曲id と、曲の特徴は `listen-facts.md`(`node tools/mode/rhythm-assistant-session-listen-facts.js` で作る)。曲の別の版(短い版・フル版)は1つにまとめてある
- 1曲につき8人ぶん(mua kiki momosuke dra atsu kyuko sorashido erubin)。同じ人が1曲に2行書いてもよい(どちらかを選ぶ)
- 書き終えた曲は `listen-pending.json` から消す。全部の行を入れたら `node tools/mode/rhythm-assistant-session-lines-import.js`

## 守ること

- **`listen-facts.md` の事実だけで書く**(テンポ・盛り上がりの流れ・音の性格・サビの時刻・ノーツ数)。作り話の歌詞・作曲者や歌い手の話・曲の由来は書かない(社長)
- その助手の目のつけどころで: ソラシドは数字・きゅうこは構成・ききは静かな所の美しさ・あつは締め・ドラは冒険っぽさ・ももすけは盛り上がり・えるびんは落ち着く所・みゅあはテンションが上がる所 など
- 口調は `docs/progress/assistant-peer/VOICE.md`。1行60字まで。表情は normal happy wink surprise troubled angry crying excited
- 好きな曲・苦手な曲(PLAN.md 4章)は、その気持ちが出てよい(苦手でも悪く言わない)
