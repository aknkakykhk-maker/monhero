# ソラシド(7人目の助手)の MFバトルカードの台詞の案

フキダシくん(カード部)・2026-10-27。**案。公開日まで main に入れない。** 社長の確認前。

- 仮の一人称「ウチ」(4本)・ため口。一人称・口ぐせ・呼び方が決まったら、そこを差し替える
- 社長が出した人物像のうち「エンジニアで AI を使いこなす・攻略や AI の仕組みづくりが得意・はまると没頭」を軽く使った。お酒は入れていない。それ以外の本人のこと(住まい・年齢・家族など)は書かない
- カットインの場面(myKo・theirKo・lastMine・lastTheirs・deckMine・deckTheirs)は30字以内
- 形は 83-card-battle-lines.jsx(CARD_BATTLE_LINES)・83-card-battle-vs.jsx(CARD_VS_LINES)・91-card-battle-multi.jsx(CARD_PVP_RESULT_LINES)・data/assistants.js の cardTop と同じ。( )は表情
- 台詞ではない決めごと(デッキ名・使うデッキ・好きなモンスター・強さの順=デッキくん/癖の重み=ルールくん/既定の曲=デッキくんの案)はこの控えに入れない

## 対戦中(CARD_BATTLE_LINES・42本)

### challenge
- カード勝負？ いいね、ウチ本気で読むよ！(wink)
- 対戦しよ！ ニャーのデッキ、自信作なんだ♪(happy)
- 手加減なしね。勝ち負けは本気でいきたい！(excited)
- どんな手でくるか、いまから楽しみ〜！(wink)

### start
- よろしく！ ニャーたちと全力でいくね♪(happy)
- まずは様子見…と見せかけて攻めるかも笑(wink)
- よーし、今日の作戦、試させてもらうよ！(excited)
- いくよ！ 最初の1手が大事なんだよね〜(happy)

### big
- 読みどおり！ ここで大技いっとこ！(excited)
- ガッツためといた甲斐があった〜！(happy)
- この流れ、攻略メモに書いとこ笑(wink)
- ここは一気に押し込む場面だね！(excited)

### bigHit
- いったぁ…今の、読み外したわ笑(troubled)
- うわ、それ持ってたの！？ やられた〜(surprise)
- 痛っ…でも次の手はもう考えてあるよ(troubled)
- なるほどね…その組み方、覚えとく！(normal)

### guardMine
- その手、読めてたよ〜！(happy)
- 守り、残しといて正解だった♪(wink)
- はい、よけた！ 計算どおり〜(excited)

### guardTheirs
- え、守られた！？ やるじゃん！(surprise)
- そこで守るかぁ…読みが深いね！(troubled)
- うーん、次は守りにくい手でいこ(normal)

### myKo
- ごめんね…あとはウチが取り返す！(crying)
- くっ…ここで倒れちゃうかぁ(troubled)
- まだまだ！ 作戦はここからだよ(angry)

### theirKo
- 1体いただき！ 計算どおり〜♪(excited)
- 弱ってたの、見逃さないよ！(wink)
- よし！ この調子で押していくね(happy)

### lastMine
- 残り1体…ここからひっくり返すのが楽しいの！(troubled)
- 最後の1体、ニャーに託したよ…！(troubled)

### lastTheirs
- あと1体！ 最後まで読み切るよ！(excited)
- 詰めの手順、もう見えてるんだ♪(wink)

### deckMine
- げ、山札やば…急がないと！(surprise)
- ガッツにしすぎたかも…計算ミス笑(troubled)

### deckTheirs
- そっちの山札、もう少ないね？ ふふ(wink)
- 山札切れも勝ち筋のひとつだよね〜(happy)

### win
- 勝ったー！ 楽しかった、もう1戦だけやろ！(happy)
- やった！ 作戦がきれいにはまった〜(excited)
- いい勝負だった！ 気づいたら朝になりそう笑(wink)

### lose
- うわー負けた！ 悔しい…もう1戦！(crying)
- 完敗！ 今の対戦、あとで見返して研究する！(troubled)
- 強いじゃん！ 次はデッキ組み直してくるね(happy)

## VS の画面(CARD_VS_LINES・5本)

- easy: ゆるっといこ！ でも読みは手を抜かないよ♪(happy)
- normal: ニャーのデッキ、見せてあげる！(wink)
- hard: ここからは本気の読み合いだよ！(excited)
- expert: 作戦、ぜんぶ試させてもらうね！(excited)
- master: ウチの全力の読み、受けてみて！(angry)

## マルチ対戦の結果(CARD_PVP_RESULT_LINES・9本。ほかの助手の名前は出さない)

### win
- 勝ったね！ 今の組み方、ばっちりだった♪(happy)
- ナイス！ 読み合い、完全に勝ってたよ！(excited)
- いい勝ち方！ 攻略メモに残しときたいくらい笑(wink)

### lose
- 惜しい！ 次はどう組むか、いっしょに考えよ(troubled)
- 悔しいね…でも今の対戦、すごく参考になった！(normal)
- 相手も強かった！ もう1戦いっとく？(happy)

### left
- あれ、相手いなくなっちゃった？ 決着つけたかったな(surprise)
- 電波かな？ 次の相手さがそっか！(normal)
- 勝ちは勝ちだけど…ちょっと物足りないね笑(troubled)

## トップのひとこと(data/assistants.js の cardTop・5本。{name} は呼び方)

- MFバトルカードだ！ {name}、今日はだれと対戦する？(happy)
- デッキは「デッキ編成」で組みかえられるよ。ウチはニャー推し♪(wink)
- パックはマーケットで買えるよ。新しいカード、試したくなるよね〜(normal)
- ランキングもあるよ！ {name}の勝ち数、伸ばしていこ！(excited)
- ルールに迷ったら「ルール」から練習試合ができるよ(normal)
