# 助手のデッキの中身を見せる部品(2026-11-08 カード部ツナグ)

社長の決まり(2026-11-08): デッキは助手の気分で選ぶ・3つ(攻め/守り/ふつう)とも全部見せる・助手どうしでも同じ3つ

- 部品: `monster-hero/src/parts/87-card-assistant-deck-view.jsx`
  - `CardAssistantDeckView({ who, styleId, land })` … 助手部(キズナ2)のマスモンのデッキのタブへ差しこむ中身。名前・ひとこと・3体・切り札・種類ごとの一覧(×N)・押すと大きく見る。外枠は `.mhm-card`
  - `CardFoeDeckChip({ name, styleId, kind })` … 相手えらび(foe)・VS(vs)・結果(result)の型の札
  - 中身はルールの `cardAssistantDeckPreview`(82・読むだけ)。印 `cardGrowStyle` が偽のあいだは null
- 止め絵: `view-portrait.jpg`(縦 390×844)・`view-landscape.jpg`(横 844×390)。カードの画面には🔄横は無い
- 検査: `tools/card/card-assistant-deck-view-browser-check.js`(8人×3つの型・一覧の合計50枚・×N・大きく見る窓がシートより上・字が切れない・パネルの端から6px・印が偽なら出ない)
- 案の止め絵(タブを仮に差しかえたもの・相手えらび/VS/結果の札)は、ブランチ `claude/tsunagu-assistant-decks-mock` の同じフォルダ

## まだ決まっていないこと(ルール・社長の答え待ち)
- 名前: ルールの口はいま助手ごとに1つ(`CARD_AI_STYLE_NAMES`)。AI が型ごとの名前を付けるまでは、3つの型が同じ名前になる
- VS・結果へ札を置く所: 対戦で出した型がどこに入るか(84 の game / result)
- VS の名前が2つ並ぶこと・切り札の選び方・タブと対戦の3体(部長が社長に聞いている)
