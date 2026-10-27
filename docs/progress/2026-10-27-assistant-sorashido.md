# 新しい助手「ソラシド」(7人目・2026-10-27〜)

依頼: 社長 → 開発部クラフト部長。下地は開発部ストックくん、お話の台本はツギハギくん(同じ枝 `claude/sorashido`)。
公開の印 `assistantSorashido` は偽のまま main へ入れる。カード部ナガメくんも同じ印を使う。

## 人物像(社長が決めた)
攻略班のエンジニア。パソコンが得意で AI をかなり使う。攻略サイトや AI の仕組みづくりが得意。はまると寝る間も惜しんで没頭。
お酒に強い(軽く扱う)。沖縄の味付け(言葉・浜・三線など)。MFバトルカード好き(ニャーのデッキ)。キュービとオリヒメの推し(とくにオリヒメ)。
ため口・語尾に「笑」・盛り上がると「うぉぉぉ！」「なに！？」・かっこつけの「〜ぜ・・・！」。勝ち負けに本気。自分の失敗も笑いにする。
一人称はふだん「俺」、少し丁寧なときは「自分」か「私」。
★元のテスターさんご本人の暮らし(仕事・住まい・年齢・家族・性別など)は書かない・推し量らない。

## 呼び方
ソラシド→ みゅあ「みゅあ」/きき「きき」/もも「もも」/ドラ「ドラちゃん」/あつ「あっくん」/きゅうこ「きゅうこ」
→ソラシド: みゅあ「ソラちん」/きき「ソラシドさん」/もも「ソラ」/ドラ「ソラさん」/あつ「ソラシド」/きゅうこ「ソラ」

## 入れたもの(下地・ストックくん)
- [x] `RELEASE_FLAGS.assistantSorashido: false`(17-release-changelog-login-missions.jsx)・`EVENT_REPLAY_RELEASE_FLAGS.assistantSorashido`(10-core.jsx・お話用)
- [x] `ASSISTANTS` の7人目(data/assistants.js)・`ASSISTANT_RELEASE_FLAGS.sorashido`。印が偽のあいだは一覧・選ぶ画面・ヘルプの表(助手の一覧・仲良し度の表)に出ない
- [x] `ASSISTANT_PEER_CALLS`(両向き)・`ASSISTANT_CHAT_EXAMPLES`(6問)・`ASSISTANT_BOND_STYLES.sorashido`(段階の名前30。呼び方は既定)
- [x] 基本のセリフ `sorashidoCore`(よく開く24場面+仲良し度アップ・自己ベスト)・連打のセリフ(ASSISTANT_SPAM_SETS)。HOME のフレンド申請のひとこと
- [x] 検査: `assistant-check.js` の「全場面に自分のセリフ」は、公開の印が偽の助手には求めない(印を真にした時点で求める)。`assistant-face-check.js` に仮の顔の基準・`kyuko-check.js`・`assistant-bond-reward-check.js` を7人に合わせた
- [x] 仮の顔 `images/assistant/temp/sorashido_<表情>.png`(8つ・「仮」の札つき)。`tempImageDir` で吹き出しにも大きい絵の場所にも出る

## 公開までに残っていること
- [ ] 社長の絵(表情8つ)→ `images/assistant/sorashido_*.PNG`・顔アイコン `face/`(tools/make-assistant-faces.js)。届いたら `tempImageDir`・`tempImageExt` の2行と仮の顔を消す
- [ ] 残りの場面のセリフ(いまはみゅあのセリフへ落ちる。きゅうこは71場面・550本前後)・マーケットの売り場・お布施の束
- [ ] お話の台本(ツギハギくん)
- [ ] MFバトルカードの相手にするなら `CARD_AI_HABITS` など(カード部)
- [ ] 公開の日に更新履歴・ヘルプ・告知(changelog-help-update スキル)と、おしゃべりの材料の作り直し
