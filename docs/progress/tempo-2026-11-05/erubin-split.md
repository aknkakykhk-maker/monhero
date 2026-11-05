# えるびん(8人目の助手)の分担(2026-11-05・まとめ役テンポ)

社長「分担できるやつは全部分担にして優先で実装」。**公開はまだしない**(公開の印 `RELEASE_FLAGS.assistantErubin` は `false` のまま。社長の「オッケー」のあと)。

## 進め方(全員共通)

- **土台はブランチ `claude/tempo-next`**(えるびんを助手として登録済み・公開の印は偽)。ここから自分のブランチを切って作る(例 `claude/referee-erubin-bg`)
- **main へは自分でマージしない。** できたらブランチ名をテンポへ知らせる。テンポが `claude/tempo-next` へ取り込み、検査を全部通してから、社長の確認用の動画と止め絵を作り、main へ入れる
- 決めごとの正本: [`docs/rules/PRESIDENT_DECISIONS.md`](../../rules/PRESIDENT_DECISIONS.md) の 2026-11-05 の「えるびん」の行。下はその要点
- 足す場所の探し方: **ソラシドの分が書いてある所に、同じ形でえるびん(`erubin`)の分を足す**(`grep -n "sorashido" monster-hero/data/assistants.js monster-hero/data/breeder.js`)
- 絵の元: `tools/art-sources/assistants/erubin/`(通常)・`erubin/sekiyuou/`(衣装『石油王』)。どちらも 384×512・背景透過。配信用(256色)は `monster-hero/images/assistant/erubin_<表情>.PNG`・`images/assistant/sekiyuou/erubin_<表情>.PNG`(+ `face/`)
- 表情の当て方(社長「これで」): normal=まっすぐ / happy=大笑い / wink=あごに手・考える(問いかけ) / surprise=驚き / troubled=横目で気まずい / angry=しかめ顔 / crying=頭を抱える(涙なし) / excited=口元を押さえてにやり(一覧: `erubin-expressions-normal.png`・`-sekiyuou.png`)

## えるびんの人柄と口調(台詞を書く人へ)

- ほかの助手より**少し年上の、穏やかな大人**。見守る・まとめる役。気配りがあって面倒見がいい(「〜大丈夫かな？」「それでもよいかな？」と相手を気づかって確かめる)。素直に喜ぶ
- 見た目は彫りが深いが**純日本人**(ふつうの日本語。片言にしない)
- 一人称はふだん「**俺**」、少し丁寧なとき「**私**」。やわらかいタメ口に、ときどき丁寧語がまざる(「そういうことです笑」)
- 語尾は「〜ね」「〜よね」「〜かな」「〜のかな」「〜だしね」。笑いは「**笑**」と「**w**」の両方(1文に両方は付けない)
- よく言う: 「おけ！」「おけw」「おっけー！」「いいね」「さすが」「楽しかったー！」。絵文字は ☺️😊🤔💦 を軽く(使いすぎない)
- **石油王ネタは「いじられ役」だけ**(本人はいたって普通なのに、みんなに石油王あつかいされる)。お金持ちっぽい発想・衣装でふるまいが変わる、は**入れない**
- この世界のことは**来てから少しずつ覚えている**。MFバトルカードはこっちで覚えてはまっていく(デュラハン種が好き・いろいろな組み方を持つ)。好きなモンスターは**アーク**
- 呼び方: プレイヤーは「**◯◯さん**」(`{name}` は自動で「さん」付けになる)。えるびん→みゅあ「みゅあちゃん」・きき「ききさん」・ももすけ「ももちゃん」・ドラ「ドラちゃん」・あつ「あっくん」・きゅうこ「きゅうこちゃん」・ソラシド「ソラくん」。
  ほか→えるびん: みゅあ「るびちん」・きき「えるびんさん」・ももすけ「えるちゃん」・ドラ「ビンビン」・あつ「エルちゃん」・きゅうこ「えるニキ」・ソラシド「えるさん」(`ASSISTANT_PEER_CALLS`)
- 具体的な年齢・職業・暮らし(住まい・行き先・予定など)は**書かない・推し量らない**。テーマ色は砂色 `#d6b47a`、絵文字は 🏜️

## バトル部レフェリー: お話の背景絵と、場面ごとに切り替える部品

- いまの形: 台本の行の `scene:'desert'`(次に `scene` を書いた行まで続く・`scene:'none'` で消す)と `fx:'fall'`(穴へ落ちる)。描くのは `src/parts/60-app.jsx` の `storyScene`(`data-story-scene`)、見た目は `src/parts/70-bootstrap.jsx` の `[data-story-scene="desert"]`(いまは図形だけの仮)
- 作るもの: 背景絵を数枚と、`scene:'<名前>'` で切り替える部品(名前 → 絵の表を1か所に。例 `STORY_SCENES`)。**画像のパスはデータに直書きせず定数で指す**(`image/data-image-source-check.js`)
  - 石油王の世界: 砂漠の夕方と宮殿(お話の①)・油田(案)・宮殿の中(案)
  - モンヒロの世界: いつもの場所・街・夜(いまのお話の雰囲気に合うもの)
- 形式: 縦(390×844 前後)を基本に、横の低い画面(844×390)でも切れて見えない構図。WebP か軽い PNG。画像を足したら `node tools/build.js` → `node tools/image-asset-check.js`(CLAUDE.md ⑥-2・[`monster-hero/images/CLAUDE.md`](../../../monster-hero/images/CLAUDE.md))
- 置き場所の案: `monster-hero/images/story-bg/<名前>.webp`。えるびんのお話(`ASSISTANT_ERUBIN_JOIN_STORY`)の①は `scene:'desert'`、②の着いた所から `scene:'none'`(またはいつもの場所の背景)。**ほかのお話でも使える形**にしておく
- 返してほしいもの: 背景の一覧の止め絵(どの場面用か)・ブランチ名

## カード部ツナグ: マーケットの表情アイコン・顔アイコンの基準合わせ・お話の大きい立ち絵

- マーケットの表情アイコン8種(各 1pt。ソラシドと同じ形): `data/breeder.js` の助手の表情アイコンの並び(`MARKET_FACE_OF` など。`grep -n sorashido monster-hero/data/breeder.js`)。検査 `monster/market-icon-check.js`
  - ★公開前の助手のアイコンは、公開の印が立つまで**ふつうの画面に出さない**(台帳 2026-10-27「公開前の助手やモンスターの名前や絵は、ふつうの画面のどこにも出さない」)
- 顔アイコンの切り方を、ほかの助手と同じ基準にそろえる: `tools/make-assistant-faces.js` の `PER_ASSISTANT_BASE` に `erubin`(と衣装のフォルダ `sekiyuou` の切り方)を足して作り直す。検査 `assistant-face-check.js`(いま「枠が頭で埋まっている」「真ん中に顔がある(肌色)」「肌色の基準」で落ちる。肌の色の基準 `SKIN_RULES` にえるびんの肌を足す必要がありそう)
  - ★作り直すのは**えるびんの顔だけ**。ほかの助手の顔のファイルを書き換えない
- お話の真ん中に出す大きい立ち絵(通常・石油王): いまある 384×512 の胸から上の絵を、お話の真ん中に出す。仕組みはお話の `monsters:[{ id, pose }]`(`STORY_MONSTER_ART`・ソラシドのお話のキュービ・オリヒメと同じ層)に足すのが近い。**胸から上をどこまで大きく見せるかの案を止め絵で**(初登場の場面は石油王、着替えたあとは通常)
- 返してほしいもの: 立ち絵の切り出しの止め絵・ブランチ名

## リバース: 台詞の半分(連打・毎日のマスの助言・モンスター案内)

- 連打したときの台詞: `data/assistants.js` の `ASSISTANT_SPAM_SETS` に `erubin`(専用の6行と戻り。ソラシドの形)。検査 `assistant-check.js`
- 毎日のマスの助言: `addAssistantLinePack({ id:'dailyMasuAdviceBasic_<助手>', … })` の形でえるびんの分(ふつうの助言5件以上・「あきらめる」の近道の分も)。検査 `assistant/daily-masu-advice-check.js`
- モンヒロビートのモンスター案内の台詞: 検査 `mode/rhythm-monster-guide-check.js` が名指しする場所に、えるびんの分
- 書き方: 上の「人柄と口調」どおり。ゲームの数字はほかの助手の台詞と同じ扱い(書いてあるものは同じ数字に)。石油王ネタは入れても「いじられ役」の範囲だけ
- 返してほしいもの: ブランチ名(台詞は社長が動画で見るので、テンポがまとめて見せる)

## テンポ(まとめ役)

- 登場のお話の頭の直し(済み)・おしゃべりの見本(`ASSISTANT_CHAT_EXAMPLES`)・仲良し度のごほうびの表(`assistant-bond-reward-check.js`)・回想の並び(`boot/event-replay-check.js`)
- 案内の台詞の残り(`ASSISTANT_ONBOARDING_SETS`・`ASSISTANT_INTRO_SETS`・`ASSISTANT_TUTORIAL_SETS`・`ASSISTANT_RHYTHM_TUTORIAL_SETS`・`ASSISTANT_BATTLE_TUTORIAL_GUIDE_SETS`・`addAssistantLinePack` の `<助手>Core`)は、いまの検査が求めていないぶんも含めてテンポが書く
- 3人の分を `claude/tempo-next` へ取り込み、`node tools/run-checks.js --changed --base origin/main` を全部通す → 社長の確認用の動画・止め絵 → 社長の「オッケー」で公開の印を立てて main へ
