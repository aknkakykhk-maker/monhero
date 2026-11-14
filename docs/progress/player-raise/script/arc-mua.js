// モンヒロサクセス 台本: みゅあ編の「1連のストーリー」(2026-11-13 開発部・設計 docs/progress/player-raise/STORY-ARC.md)
// 固有イベント4つ・頂への道の3連戦(みゅあが相手を選ぶ・試合の前後)・エンディング3つ・お祝い・特別演出。
// 形は README.md。みゅあの行は仲良し度 Lv1・2 のていねい語版(id の最後に b・bond:[1,2])つき。
//   {rival} … 頂への道で選んだ相手のモンスターの名前 / {owner} … その子を育てている人
//   場面の id: scn.mua.uq.<名前>(固有イベント)/ scn.mua.summit.r<1〜3>.(pick|win|lose)/ scn.mua.end.(bad|good|super)/
//             scn.mua.party.(bad1|good1〜3|super1〜3)/ scn.mua.fx.super(特別演出)
const MONSUC_SCRIPT_ARC_MUA = Object.freeze([
  // ═══════════ 固有イベント ═══════════
  // A 写真とろ！(ジュニア期)
  { id:'scn.mua.uq.photo.narr1', who:'narr', t:'トレーニングのあいま。みゅあがスマホを構えて、{mon}のまわりをぐるぐる回っている。' },
  { id:'scn.mua.uq.photo.mua1', who:'mua', e:'excited', t:'ちょ、{mon}こっち向いて！ この角度まぢ盛れるｗ' },
  { id:'scn.mua.uq.photo.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{mon}、こっちを向いてもらえますか？ この角度、すごくかわいいです！' },
  { id:'scn.mua.uq.photo.mua2', who:'mua', e:'wink', t:'{name}も入っちゃう？ それともベストショット狙う？' },
  { id:'scn.mua.uq.photo.mua2b', who:'mua', e:'wink', bond:[1,2], t:'{name}もいっしょに入りますか？ それとも、いちばんいい1枚を狙いますか？' },
  { id:'scn.mua.uq.photo.choice.a', who:'choice', c:'a', t:'みんなでいっしょに映る' },
  { id:'scn.mua.uq.photo.choice.b', who:'choice', c:'b', t:'動きの速い1枚を狙う' },
  { id:'scn.mua.uq.photo.a.narr1', who:'narr', c:'a', t:'3人でぎゅっと寄って、パシャリ。{mon}が少しだけ照れくさそうだ。' },
  { id:'scn.mua.uq.photo.a.mua1', who:'mua', e:'happy', c:'a', t:'いい顔ー！ これ待ち受けにしよ♪ 見た人みんな{mon}のファンになるってｗ' },
  { id:'scn.mua.uq.photo.a.mua1b', who:'mua', e:'happy', c:'a', bond:[1,2], t:'いい写真が撮れました♪ 待ち受けにしてもいいですか？' },
  { id:'scn.mua.uq.photo.b.narr1', who:'narr', c:'b', t:'みゅあの「せーの！」に合わせて、{mon}が右へ左へひらりと跳ぶ。' },
  { id:'scn.mua.uq.photo.b.mua1', who:'mua', e:'surprise', c:'b', t:'はやっ！ ブレブレすぎて逆にかっこいいんだけどｗ 身のこなし、上がってるぢゃん！' },
  { id:'scn.mua.uq.photo.b.mua1b', who:'mua', e:'surprise', c:'b', bond:[1,2], t:'速すぎて、うまく撮れませんでした…！ でも、身のこなしがすごく軽くなっていますね！' },

  // B おやつ作戦会議(ジュニア後半〜ミドル前半)
  { id:'scn.mua.uq.snack.narr1', who:'narr', t:'みゅあが、かわいい箱を抱えてやってきた。ふたを開けると、ちょっと焦げたクッキーが並んでいる。' },
  { id:'scn.mua.uq.snack.mua1', who:'mua', e:'troubled', t:'手作りしたんだけど…ちょい焦げたｗ 味はぜったいおいしいから！' },
  { id:'scn.mua.uq.snack.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'手作りしてみたんですけど、少し焦げちゃいました…。でも、味はおいしいはずです！' },
  { id:'scn.mua.uq.snack.mua2', who:'mua', e:'happy', t:'いま食べる？ それとも大会のごほうびにとっとく？' },
  { id:'scn.mua.uq.snack.mua2b', who:'mua', e:'happy', bond:[1,2], t:'いま食べますか？ それとも、がんばったごほうびにとっておきますか？' },
  { id:'scn.mua.uq.snack.choice.a', who:'choice', c:'a', t:'いま、みんなで食べる' },
  { id:'scn.mua.uq.snack.choice.b', who:'choice', c:'b', t:'ごほうびにとっておく' },
  { id:'scn.mua.uq.snack.a.narr1', who:'narr', c:'a', t:'さくっ、ほろっ。焦げたところも香ばしい。{mon}はあっという間に3枚たいらげた。' },
  { id:'scn.mua.uq.snack.a.mua1', who:'mua', e:'excited', c:'a', t:'食べっぷりよすぎ！ 作ったかいあったぁ〜✨ 今日はゆっくりしよ♪' },
  { id:'scn.mua.uq.snack.a.mua1b', who:'mua', e:'excited', c:'a', bond:[1,2], t:'そんなにおいしそうに食べてもらえて、うれしいです！ 今日はゆっくりしましょう♪' },
  { id:'scn.mua.uq.snack.b.narr1', who:'narr', c:'b', t:'箱を見つめる{mon}の目が、いつもよりきらきらしている。' },
  { id:'scn.mua.uq.snack.b.mua1', who:'mua', e:'wink', c:'b', t:'がんばったら食べれるやつね！ {mon}、目の色変わってるしｗ やる気まんまんぢゃん🔥' },
  { id:'scn.mua.uq.snack.b.mua1b', who:'mua', e:'wink', c:'b', bond:[1,2], t:'がんばったら食べられますよ！ {mon}、やる気がいっぱいみたいです🔥' },

  // C 夜の電話(ミドル期)
  { id:'scn.mua.uq.call.narr1', who:'narr', t:'夜おそく。{name}の電話が小さく鳴った。みゅあからだ。' },
  { id:'scn.mua.uq.call.mua1', who:'mua', e:'troubled', t:'…起きてる？ なんか寝れなくてさ。あたしの応援、ちゃんと{mon}の役に立ってるかなって' },
  { id:'scn.mua.uq.call.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'夜おそくにすみません…。あたしの応援、ちゃんと{mon}の役に立っているのかなって、考えてしまって' },
  { id:'scn.mua.uq.call.mua2', who:'mua', e:'troubled', t:'ごめん、変なこと言った。…{name}はどう思う？' },
  { id:'scn.mua.uq.call.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'ごめんなさい、変なことを言いました。…{name}はどう思いますか？' },
  { id:'scn.mua.uq.call.choice.a', who:'choice', c:'a', t:'ゆっくり話を聞く' },
  { id:'scn.mua.uq.call.choice.b', who:'choice', c:'b', t:'「明日も早いし、もう寝よう」' },
  { id:'scn.mua.uq.call.a.narr1', who:'narr', c:'a', t:'今日のトレーニングのこと、{mon}の寝ぐせのこと。話しているうちに、みゅあの声がだんだん明るくなった。' },
  { id:'scn.mua.uq.call.a.mua1', who:'mua', e:'happy', c:'a', t:'…聞いてくれてありがと。{name}がいてくれて、まぢでよかった。おやすみ♪' },
  { id:'scn.mua.uq.call.a.mua1b', who:'mua', e:'happy', c:'a', bond:[1,2], t:'聞いてくれて、ありがとうございます。{name}がいてくれて、よかったです。おやすみなさい♪' },
  { id:'scn.mua.uq.call.b.narr1', who:'narr', c:'b', t:'電話の向こうで、みゅあがふふっと笑った。' },
  { id:'scn.mua.uq.call.b.mua1', who:'mua', e:'wink', c:'b', t:'だよね！ 寝不足で応援とか、ありえんしｗ 明日も{mon}といっしょにがんばろ！' },
  { id:'scn.mua.uq.call.b.mua1b', who:'mua', e:'wink', c:'b', bond:[1,2], t:'そうですよね！ 明日も{mon}といっしょに、がんばりましょう！' },

  // D 応援うちわ作り(プロ期)
  { id:'scn.mua.uq.uchiwa.narr1', who:'narr', t:'机の上に、色紙とはさみとシールの山。みゅあが頂への道に向けて、応援うちわを作っている。' },
  { id:'scn.mua.uq.uchiwa.mua1', who:'mua', e:'excited', t:'「{mon} 世界一」って入れたいの！ でっかく、キラッキラに✨' },
  { id:'scn.mua.uq.uchiwa.mua1b', who:'mua', e:'excited', bond:[1,2], t:'「{mon} 世界一」って入れたいんです！ 大きく、キラキラにしたくて✨' },
  { id:'scn.mua.uq.uchiwa.mua2', who:'mua', e:'happy', t:'{name}も手伝ってくれる？ それとも{mon}の練習見てる？' },
  { id:'scn.mua.uq.uchiwa.mua2b', who:'mua', e:'happy', bond:[1,2], t:'{name}も手伝ってくれますか？ それとも、{mon}の練習を見ますか？' },
  { id:'scn.mua.uq.uchiwa.choice.a', who:'choice', c:'a', t:'いっしょにうちわを作る' },
  { id:'scn.mua.uq.uchiwa.choice.b', who:'choice', c:'b', t:'{mon}の練習につき合う' },
  { id:'scn.mua.uq.uchiwa.a.narr1', who:'narr', c:'a', t:'できあがったうちわは、ちょっと文字がななめ。でも町のだれよりも目立っている。' },
  { id:'scn.mua.uq.uchiwa.a.mua1', who:'mua', e:'excited', c:'a', t:'完成ーー！ これ客席で振ったら、ぜったい{mon}に気づいてもらえるぢゃん♪' },
  { id:'scn.mua.uq.uchiwa.a.mua1b', who:'mua', e:'excited', c:'a', bond:[1,2], t:'できました！ これを客席で振ったら、きっと{mon}に気づいてもらえますね♪' },
  { id:'scn.mua.uq.uchiwa.b.narr1', who:'narr', c:'b', t:'練習場から、{mon}の元気なかけ声が聞こえてくる。みゅあも窓から身を乗り出した。' },
  { id:'scn.mua.uq.uchiwa.b.mua1', who:'mua', e:'happy', c:'b', t:'いい動き！ うちわはあたしにまかせて、{mon}はいちばんの武器みがいてこ！' },
  { id:'scn.mua.uq.uchiwa.b.mua1b', who:'mua', e:'happy', c:'b', bond:[1,2], t:'いい動きです！ うちわはあたしにまかせて、{mon}は得意をみがいてくださいね！' },

  // ═══════════ 頂への道の3連戦(みゅあが相手を選ぶ) ═══════════
  // 1回戦: 人気がいちばん高い常連
  { id:'scn.mua.summit.r1.pick.narr1', who:'narr', t:'頂への道の朝。出場するモンスターの名前が並ぶ紙を、みゅあがじっと見ている。' },
  { id:'scn.mua.summit.r1.pick.mua1', who:'mua', e:'wink', t:'1回戦は{rival}にしたよ！ この中でいちばん人気のモンスターなんだって' },
  { id:'scn.mua.summit.r1.pick.mua1b', who:'mua', e:'wink', bond:[1,2], t:'1回戦は、{rival}にしました。この中でいちばん人気があるモンスターなんです' },
  { id:'scn.mua.summit.r1.pick.mua2', who:'mua', e:'excited', t:'客席ぜんぶ向こうの応援かもだけど…{mon}の笑顔で、ぜんぶこっちに向けちゃお！' },
  { id:'scn.mua.summit.r1.pick.mua2b', who:'mua', e:'excited', bond:[1,2], t:'客席は向こうの応援ばかりかもしれません。でも、{mon}の笑顔ならきっと負けません！' },
  { id:'scn.mua.summit.r1.win.mua1', who:'mua', e:'excited', t:'勝ったぁー！ 見て、客席で{mon}のうちわ振ってる人いるよ！ 人気までもらっちゃったぢゃんｗ' },
  { id:'scn.mua.summit.r1.win.mua1b', who:'mua', e:'excited', bond:[1,2], t:'勝ちました！ 客席で{mon}を応援してくれている人もいます！' },
  { id:'scn.mua.summit.r1.win.mua2', who:'mua', e:'happy', t:'次の相手も、あたしが決めとくね。…たぶん、{name}も同じこと考えてると思う' },
  { id:'scn.mua.summit.r1.win.mua2b', who:'mua', e:'happy', bond:[1,2], t:'次の相手も、あたしが決めておきますね。たぶん、{name}も同じことを考えていると思います' },
  { id:'scn.mua.summit.r1.lose.mua1', who:'mua', e:'crying', t:'…負けちゃった。あたしが相手選んだのに、ごめん😭' },
  { id:'scn.mua.summit.r1.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'…負けてしまいました。あたしが相手を選んだのに、ごめんなさい' },
  // 準決勝: この育成のライバル
  { id:'scn.mua.summit.r2.pick.narr1', who:'narr', t:'準決勝の相手の札をめくる前に、みゅあが大きく息を吸った。' },
  { id:'scn.mua.summit.r2.pick.mua1', who:'mua', e:'normal', t:'準決勝の相手、決めたよ。…やっぱ、{rival}とやらなきゃ終われないぢゃん' },
  { id:'scn.mua.summit.r2.pick.mua1b', who:'mua', e:'normal', bond:[1,2], t:'準決勝の相手を決めました。…やっぱり、{rival}と戦わないと終われないと思って' },
  { id:'scn.mua.summit.r2.pick.mua2', who:'mua', e:'excited', t:'ここまで来れたのは、ライバルがいたからでもあるし。だからこそ、ぜったい勝と！' },
  { id:'scn.mua.summit.r2.pick.mua2b', who:'mua', e:'excited', bond:[1,2], t:'ここまで来られたのは、ライバルがいたからでもあります。だからこそ、勝ちたいです！' },
  { id:'scn.mua.summit.r2.win.mua1', who:'mua', e:'crying', t:'勝った…！ {rival}に勝ったよ{mon}😭 あたし、声かれるまで叫んぢゃった' },
  { id:'scn.mua.summit.r2.win.mua1b', who:'mua', e:'crying', bond:[1,2], t:'勝ちました…！ {mon}、すごいです。あたし、声が出なくなるまで応援しちゃいました' },
  { id:'scn.mua.summit.r2.win.mua2', who:'mua', e:'happy', t:'{rival}、最後に{mon}にあいさつしてくれたね。いいライバルだったぢゃん' },
  { id:'scn.mua.summit.r2.win.mua2b', who:'mua', e:'happy', bond:[1,2], t:'{rival}、最後に{mon}へあいさつしてくれましたね。いいライバルでした' },
  { id:'scn.mua.summit.r2.lose.mua1', who:'mua', e:'crying', t:'…やっぱ強かったね、{rival}。でも{mon}、いちばん{mon}らしく戦ってたよ' },
  { id:'scn.mua.summit.r2.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'…やっぱり強かったですね、{rival}。でも{mon}は、最後まで{mon}らしかったです' },
  // 決勝: 王者
  { id:'scn.mua.summit.r3.pick.narr1', who:'narr', t:'決勝の舞台。いちばん奥で、王者の{rival}が静かに待っている。' },
  { id:'scn.mua.summit.r3.pick.mua1', who:'mua', e:'troubled', t:'さいごは、いちばん上。…足ふるえてんの、あたしのほうなんだけどｗ' },
  { id:'scn.mua.summit.r3.pick.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'最後は、いちばん上の相手です。…足がふるえているのは、あたしのほうですね' },
  { id:'scn.mua.summit.r3.pick.mua2', who:'mua', e:'excited', t:'{mon}なら届くって、あたし知ってる。いってらっしゃい、{mon}！' },
  { id:'scn.mua.summit.r3.pick.mua2b', who:'mua', e:'excited', bond:[1,2], t:'{mon}なら届くって、あたしは信じています。いってらっしゃい、{mon}！' },
  { id:'scn.mua.summit.r3.win.mua1', who:'mua', e:'excited', t:'うそ…勝った…？ 勝ったぁぁーーー！！ {mon}、てっぺんだよ！！' },
  { id:'scn.mua.summit.r3.win.mua1b', who:'mua', e:'excited', bond:[1,2], t:'勝った…？ 勝ちました！！ {mon}、いちばん上です！！' },
  { id:'scn.mua.summit.r3.lose.mua1', who:'mua', e:'crying', t:'…あとちょっとだった。でも、ここまで来たの、ほんとにすごいことなんだよ' },
  { id:'scn.mua.summit.r3.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'…あと少しでした。でも、ここまで来られたのは、本当にすごいことなんです' },

  // ═══════════ エンディング ═══════════
  // バッド: 頂への道で負けて終わる
  { id:'scn.mua.end.bad.narr1', who:'narr', t:'夕暮れの帰り道。みゅあと{mon}の影が、長くのびている。' },
  { id:'scn.mua.end.bad.mua1', who:'mua', e:'crying', t:'…くやしいね。てっぺん、見せてあげたかったな' },
  { id:'scn.mua.end.bad.mua1b', who:'mua', e:'crying', bond:[1,2], t:'…くやしいですね。いちばん上からの景色、見せてあげたかったです' },
  { id:'scn.mua.end.bad.narr2', who:'narr', t:'{mon}が、みゅあの手をそっとつついた。' },
  { id:'scn.mua.end.bad.mua2', who:'mua', e:'happy', t:'…うん。{mon}と来れたとこ、ぜんぶ宝物だよ。帰ったら、おつかれさま会しよ♪' },
  { id:'scn.mua.end.bad.mua2b', who:'mua', e:'happy', bond:[1,2], t:'…はい。{mon}と来られたところは、ぜんぶ宝物です。帰ったら、おつかれさま会をしましょう♪' },
  // グッド: 決勝に勝つ
  { id:'scn.mua.end.good.narr1', who:'narr', t:'表彰台のいちばん上。紙吹雪の中で、{mon}がトロフィーを掲げた。' },
  { id:'scn.mua.end.good.mua1', who:'mua', e:'excited', t:'{mon}が世界でいちばん！ ねぇ{name}、あたしの声、ちゃんと届いてた？' },
  { id:'scn.mua.end.good.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{mon}がいちばんです！ {name}、あたしの声、ちゃんと届いていましたか？' },
  { id:'scn.mua.end.good.narr2', who:'narr', t:'{mon}が、客席のうちわに向かって大きく手をふった。' },
  { id:'scn.mua.end.good.mua2', who:'mua', e:'happy', t:'…届いてたみたい！ よーし、今日はお祝いいっぱいしよ✨' },
  { id:'scn.mua.end.good.mua2b', who:'mua', e:'happy', bond:[1,2], t:'…届いていたみたいです！ 今日は、たくさんお祝いしましょう✨' },
  // 超グッド: 決勝に勝つ・親密度が最大・連続イベントを完走
  { id:'scn.mua.end.super.narr1', who:'narr', t:'表彰台のいちばん上。拍手が鳴りやまない。町じゅうの人が、{mon}の名前を呼んでいる。' },
  { id:'scn.mua.end.super.mua1', who:'mua', e:'crying', t:'得意を探しに町を歩いたあの日から、ずっといっしょだったね…' },
  { id:'scn.mua.end.super.mua1b', who:'mua', e:'crying', bond:[1,2], t:'得意を探しに町を歩いたあの日から、ずっといっしょでしたね…' },
  { id:'scn.mua.end.super.narr2', who:'narr', t:'みゅあが手作りのお守りを、ぎゅっとにぎりしめた。' },
  { id:'scn.mua.end.super.mua2', who:'mua', e:'excited', t:'{name}、{mon}。最高のチームだったよね…まぢで、世界でいちばん！' },
  { id:'scn.mua.end.super.mua2b', who:'mua', e:'excited', bond:[1,2], t:'{name}、{mon}。最高のチームでした…本当に、世界でいちばんです！' },

  // ═══════════ お祝い ═══════════
  { id:'scn.mua.party.bad1.narr1', who:'narr', t:'おつかれさま会。テーブルには、みゅあが焼いたちょっと焦げたクッキー。' },
  { id:'scn.mua.party.bad1.mua1', who:'mua', e:'happy', t:'今日までほんとにおつかれさま！ {mon}、またいっしょに遊ぼーね♪' },
  { id:'scn.mua.party.bad1.mua1b', who:'mua', e:'happy', bond:[1,2], t:'今日まで本当におつかれさまでした！ {mon}、またいっしょに遊びましょうね♪' },
  { id:'scn.mua.party.good1.narr1', who:'narr', t:'祝勝会。トレーニング場が、風船とごちそうでいっぱいになった。' },
  { id:'scn.mua.party.good1.mua1', who:'mua', e:'excited', t:'かんぱーい！ 今日は{mon}が主役だから、いちばん大きいの食べてｗ' },
  { id:'scn.mua.party.good1.mua1b', who:'mua', e:'excited', bond:[1,2], t:'かんぱい！ 今日は{mon}が主役ですから、いちばん大きいのをどうぞ！' },
  { id:'scn.mua.party.good2.narr1', who:'narr', t:'町のパレード。{mon}が通るたびに、子どもたちが手をふって追いかけてくる。' },
  { id:'scn.mua.party.good2.mua1', who:'mua', e:'wink', t:'見て見て、{mon}のまね流行ってるっぽいｗ すっかり町のヒーローぢゃん！' },
  { id:'scn.mua.party.good2.mua1b', who:'mua', e:'wink', bond:[1,2], t:'見てください、{mon}のまねをしている子どもがいます！ すっかり町のヒーローですね！' },
  { id:'scn.mua.party.good3.narr1', who:'narr', t:'夜、{name}の部屋にみゅあからの手紙が届いていた。丸っこい字で、びっしり書いてある。' },
  { id:'scn.mua.party.good3.mua1', who:'mua', e:'happy', t:'「{mon}の育成、いっしょにできて楽しかった！ これからも、あたしは{mon}のいちばんのファンだよ♪」' },
  { id:'scn.mua.party.good3.mua1b', who:'mua', e:'happy', bond:[1,2], t:'「{mon}の育成、いっしょにできて楽しかったです。これからも、あたしは{mon}のいちばんのファンです♪」' },
  { id:'scn.mua.party.super1.narr1', who:'narr', t:'町じゅうがお祭り騒ぎ。商店街には「おめでとう {mon}」の旗がずらりと並んだ。' },
  { id:'scn.mua.party.super1.mua1', who:'mua', e:'excited', t:'やばっ、どこ見ても{mon}ぢゃん！ おやつ屋さんのおばちゃんまで泣いてるしｗ' },
  { id:'scn.mua.party.super1.mua1b', who:'mua', e:'excited', bond:[1,2], t:'どこを見ても{mon}です！ おやつ屋さんのおばさんまで泣いていますね' },
  { id:'scn.mua.party.super2.narr1', who:'narr', t:'ヒーロー新聞の取材。カメラの前で、{mon}が得意のポーズを決める。' },
  { id:'scn.mua.party.super2.mua1', who:'mua', e:'wink', t:'「強さのひみつは？」だって！ そんなの決まってるぢゃん、チームの力っしょ✨' },
  { id:'scn.mua.party.super2.mua1b', who:'mua', e:'wink', bond:[1,2], t:'「強さのひみつは？」ですって。それはもちろん、チームの力です✨' },
  { id:'scn.mua.party.super3.narr1', who:'narr', t:'ふたりきりの打ち上げ…ではなく、{mon}もいっしょの3人の打ち上げ。ひなたの丘で夕日を見た。' },
  { id:'scn.mua.party.super3.mua1', who:'mua', e:'happy', t:'ここ、{mon}がいちばん楽しそうに走ってたとこ。また何回でも、いっしょに来よーね' },
  { id:'scn.mua.party.super3.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ここは、{mon}がいちばん楽しそうに走っていたところです。また、いっしょに来ましょうね' },

  // ═══════════ 特別演出(超グッド = 親密度が最大) ═══════════
  { id:'scn.mua.fx.super.narr1', who:'narr', t:'丘の上で、みゅあがスマホを高く構えた。' },
  { id:'scn.mua.fx.super.mua1', who:'mua', e:'excited', t:'さいごに1枚！ {name}も{mon}も、もっと寄って！ …せーのっ！' },
  { id:'scn.mua.fx.super.mua1b', who:'mua', e:'excited', bond:[1,2], t:'最後に1枚、撮りましょう！ {name}も{mon}も、もう少し寄ってください。…せーのっ！' },
  { id:'scn.mua.fx.super.mua2', who:'mua', e:'crying', t:'…これ、一生の宝物にする。ありがとう、あたしの最高のチーム💖' },
  { id:'scn.mua.fx.super.mua2b', who:'mua', e:'crying', bond:[1,2], t:'…これは、一生の宝物にします。ありがとうございます、あたしの最高のチーム💖' },
]);

if (typeof module !== 'undefined' && module.exports) module.exports = { MONSUC_SCRIPT_ARC_MUA };
