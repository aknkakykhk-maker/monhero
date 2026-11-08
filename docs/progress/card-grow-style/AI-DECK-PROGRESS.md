# 助手のデッキを AI で組む(3つのデッキ)— 進捗メモ

2026-11-08 カード部ルールくん。ブランチ `claude/card-ai-deck`。社長の決定(部長経由): 助手ごとに3つのデッキ(attack/guard/normal)を持ち、時期が来たら「いちばん古い1つ」を AI(中継役 deckPlan)で組み直す。全部 `RELEASE_FLAGS.cardGrowStyle`(いまは偽)で止める。

## 作り(決めたこと)
- 新しい部品 `src/parts/83-card-ai-deck.jsx`(画面なし・node で検査できる)。82 の型・方針の口(#5015)の上に作る
- 保存(新しいキーだけ)
  - `mh_card_ai_recipe_v1` = { v:1, day, perWho: { [who]: { met, gamesSince, slotsDone, decks: { attack|guard|normal: { plan, name, line, at, ai } } } } }
  - `mh_card_ai_deck_v1` = { on }(無い・壊れているときは入)
- 組み直しの時期: カードの1日(朝4時区切り)を8時間ずつ3つに分け、各枠の中の時刻を端末の id と日付の種で決める。過ぎた枠のぶん組み直していなければ、カードのトップを開いたとき裏で1回。別に、その助手と10戦ごとに1回
- 対象は会った助手だけ(相手えらびで選んだ・部屋を開いた → `cardAiDeckMarkMet(who)`)
- 組み直すのは3つのうち一番古い1つ。AI が使えない(切・上限・失敗・印が偽)ときは、型の中の揺らぎ(くせを幅の中で少し動かす・prefer を候補から1〜2枚入れかえる)
- 対戦で出すデッキ: `assistantLifeCardStyle` の型を6割・ほか2つを2割ずつ(null なら均等)
- 読むだけの口: `cardAssistantDeckPick(who, rand, level)` → { styleId, name, line, plan, deck }(キズナ2が助手どうしの対戦で使う)・`cardAssistantDeckPreview` は型ごとに保存の plan・name・line・at を返す
- VS の画面に型の札(「型: ◯◯」とひとこと)・結果の画面と記録にデッキ名と型

## 社長の「この文で」が要るもの(部長へ送る)
- 型ごとの既定の名前(AI が名前を付けられないとき。いまは助手ごとに1つしか決まっていない)
- VS で助手が言うひとことの既定(助手ごとの口調)
- 設定の入/切の見出し・説明
- 更新履歴・ヘルプ

## 済み
- 83-card-ai-deck.jsx: 保存の正規化・時期(3つの枠・10戦)・いちばん古い型・揺らぎ・6割2割・中継役 deckPlan・組み直し・会った印・10戦の数え・cardAssistantDeckPick・cardAiRecipeOf・VS のひとこと(既定の言い方は案)
- 82: CARD_SAVE_KEYS に aiRecipe・aiDeck、cardAssistantDeckPreview が保存した plan・name・line・at を読む
- 84: 対戦の始めに3つのデッキから選ぶ(印が真のとき)・VS の型の札・結果の型・記録の型の名前・10戦の数え・相手えらびで会った印・トップで裏の組み直し・設定「助手のデッキ(AI)」の入/切
- 93: 記録の foe.styleName
- SAVE_DATA.md に2つのキー
- 検査: tools/card/card-ai-deck-check.js(46件・中継役は偽物)・card-ai-grow-style-check.js を合わせた

## 残り
- 印を真にした状態で縦・横を触って撮る(検査の中だけ RELEASE_FLAGS.cardGrowStyle を真に・中継役は偽物)
- 文案(既定の名前の出し方・VS のひとこと・「型: 」・設定の見出しと説明・更新履歴・ヘルプ)を部長へ
- 社長の「この文で」のあと、印を真にして公開
