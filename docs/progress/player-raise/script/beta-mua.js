// モンヒロサクセス 台本: β版の始まりの話と、みゅあのチュートリアルの台詞(2026-11-13 キズナ・台帳「β版」)
// 2026-11-13 社長「このまま入れる」(台帳)。draft/ から script/ の直下へ移し、ゲームが読む(node tools/success/build-script.js)。
// 形は README.md。みゅあの行はすべて仲良し度 Lv1・2 のていねい語版(id の最後に b・bond:[1,2])つき。
// 数字(ターン数・%・回数)は台詞に入れない(変わっても台詞を直さずに済むように。数字はヘルプが受け持つ)。
//
// 場面と出す時(開発部が画面に組み込んだ時):
//   scn.mua.beta.open      … モンヒロサクセスをはじめて開いたとき(β版の始まりの話・2択)
//   scn.mua.beta.firstend  … はじめての育成を終えたとき(引退のあと。β版のお試し1周目のしめくくり)
//   tut.lock               … 準備中の助手(みゅあ以外)を押したとき
//   tut.scn                … ストーリー選択の画面をはじめて開いたとき(2026-11-14 窓口 OK)
//   tut.prep               … 育成の準備の画面(育てるモンスター・編成・持ちこみ)をはじめて開いたとき
//   tut.turn               … はじめてのターン(期とターン・毎ターンひとつ選ぶ)
//   tut.train              … トレーニングの札をはじめて見たとき
//   tut.result             … はじめてのトレーニングの結果(叱る・褒める)
//   tut.rest               … 体力がはじめて半分を下回ったとき(休む・遊ぶ・通院)
//   tut.shugyo             … 修行チケットをはじめて持ったとき
//   tut.cup                … はじめて大会の札が並んだとき(デビュー戦の前)
//   tut.rank               … はじめて「ランク UP!」の段が出たとき(2026-11-14 窓口 OK)
//   tut.meal               … はじめてごはんを選ぶとき(2026-11-14 窓口 OK)
//   tut.match              … はじめての試合(自分で操作・オート・技の札・間合い・ガッツ)
//   tut.rematch            … はじめて大会で負けたとき(砂時計でやり直す)
//   tut.event              … はじめての出来事(選択肢・見出し)
//   tut.awake              … はじめての覚醒の前触れ(体が光った)
//   tut.retire             … はじめての引退(評価・アシスト能力・マスモンボックス・次の育成の編成)
// 読み方: SE.event('tut.train', ctx) の lines を順に出す(tut.* は2択なし)。tut.lock だけは SE.say で1本。
const MONSUC_SCRIPT_BETA_MUA = Object.freeze([
  // ═══════════ β版の始まりの話 ═══════════
  { id:'scn.mua.beta.open.narr1', who:'narr', t:'ホームでひと息ついていると、みゅあが1枚のチラシを手に走ってきた。' },
  { id:'scn.mua.beta.open.mua1', who:'mua', e:'excited', t:'{name}、見て見て！ 新しい育成場ができたんだって！ 名前は「モンヒロサクセス」✨' },
  { id:'scn.mua.beta.open.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{name}、見てください！ 新しい育成場ができたそうです。名前は「モンヒロサクセス」です！' },
  { id:'scn.mua.beta.open.narr2', who:'narr', t:'チラシには、デビューしたてのモンスターが、ヒーローズファイナルの優勝を目指して駆けていく絵が描かれている。' },
  { id:'scn.mua.beta.open.mua2', who:'mua', e:'happy', t:'モンスターを1体、デビューからヒーローズファイナルまでじっくり育てるとこなの。トレーニングして、大会に出て、いっしょに強くなってくやつ！' },
  { id:'scn.mua.beta.open.mua2b', who:'mua', e:'happy', bond:[1,2], t:'モンスターを1体、デビューからヒーローズファイナルまで、じっくり育てる場所なんです。トレーニングをして、大会に出て、いっしょに強くなっていきます。' },
  { id:'scn.mua.beta.open.mua3', who:'mua', e:'normal', t:'あたし、いつもは横で応援してるだけぢゃん？ 今度はいちばん最初から、{name}といっしょに育ててみたいなって' },
  { id:'scn.mua.beta.open.mua3b', who:'mua', e:'normal', bond:[1,2], t:'あたし、いつもは横で応援しているだけでした。今度はいちばん最初から、{name}といっしょに育ててみたいんです。' },
  { id:'scn.mua.beta.open.mua4', who:'mua', e:'wink', t:'だから助手の一番乗り、手あげてきちゃったｗ' },
  { id:'scn.mua.beta.open.mua4b', who:'mua', e:'wink', bond:[1,2], t:'それで、助手の一番乗りに手をあげてきました。' },
  { id:'scn.mua.beta.open.mua5', who:'mua', e:'troubled', t:'ただね、まだお試しの「β版」なんだって。遊べるとこも、いまはまだ少しだけ' },
  { id:'scn.mua.beta.open.mua5b', who:'mua', e:'troubled', bond:[1,2], t:'ただ、まだお試しの「β版」だそうです。遊べるところも、いまはまだ少しだけなんです。' },
  { id:'scn.mua.beta.open.mua6', who:'mua', e:'happy', t:'ももやドラケンたちは、いま準備中！ これからちょっとずつ増えてくから、楽しみにしてて♪' },
  { id:'scn.mua.beta.open.mua6b', who:'mua', e:'happy', bond:[1,2], t:'ほかの助手のみんなは、いま準備中です。これから少しずつ増えていくので、楽しみにしていてくださいね。' },
  { id:'scn.mua.beta.open.choice.a', who:'choice', c:'a', t:'一番乗りで、いっしょに始める' },
  { id:'scn.mua.beta.open.choice.b', who:'choice', c:'b', t:'「β版って、どういうこと？」' },
  { id:'scn.mua.beta.open.a.narr1', who:'narr', c:'a', t:'みゅあの顔が、ぱっと明るくなった。' },
  { id:'scn.mua.beta.open.a.mua1', who:'mua', e:'excited', c:'a', t:'やった！ {name}とならぜったい楽しいって思ってたんだよね〜！ ٩(`･ω･´)و' },
  { id:'scn.mua.beta.open.a.mua1b', who:'mua', e:'excited', c:'a', bond:[1,2], t:'ありがとうございます！ {name}といっしょなら、きっと楽しいです！' },
  { id:'scn.mua.beta.open.b.mua1', who:'mua', e:'normal', c:'b', t:'先にお試しで遊べるってこと！ 育てるのにいちばん大事なとこは、もうちゃんとそろってるよ' },
  { id:'scn.mua.beta.open.b.mua1b', who:'mua', e:'normal', c:'b', bond:[1,2], t:'先にお試しで遊べる、ということです。育てるのにいちばん大事なところは、もうそろっていますよ。' },
  { id:'scn.mua.beta.open.b.mua2', who:'mua', e:'wink', c:'b', t:'増えたらあたしがすぐ教えるし、まずはいっしょにやってみよ？' },
  { id:'scn.mua.beta.open.b.mua2b', who:'mua', e:'wink', c:'b', bond:[1,2], t:'増えたら、あたしがすぐにお知らせしますね。まずは、いっしょにやってみませんか？' },
  // 選んだあと(どちらでも)
  { id:'scn.mua.beta.open.mua7', who:'mua', e:'happy', t:'よーし決まり！ わかんないとこは、そのつどあたしが教えるから安心してね♪' },
  { id:'scn.mua.beta.open.mua7b', who:'mua', e:'happy', bond:[1,2], t:'では、決まりですね！ わからないところは、そのたびにあたしがお伝えしますから、安心してください。' },

  // ═══════════ はじめての育成を終えたとき(β版のお試し1周目のしめくくり) ═══════════
  { id:'scn.mua.beta.firstend.narr1', who:'narr', t:'育成場からの帰り道。みゅあは、{mon}といっしょに撮った写真を何度も見返している。' },
  { id:'scn.mua.beta.firstend.mua1', who:'mua', e:'happy', t:'おつかれさま〜！ デビューから引退まで、ほんとにいっしょに走りきっちゃったね' },
  { id:'scn.mua.beta.firstend.mua1b', who:'mua', e:'happy', bond:[1,2], t:'おつかれさまでした！ デビューから引退まで、いっしょに走りきりましたね。' },
  { id:'scn.mua.beta.firstend.mua2', who:'mua', e:'excited', t:'{mon}はマスモンボックスでひと休み。次の育成では、編成で力を貸してくれるんだって！ まぢ頼もしい✨' },
  { id:'scn.mua.beta.firstend.mua2b', who:'mua', e:'excited', bond:[1,2], t:'{mon}はマスモンボックスでひと休みです。次の育成では、編成で力を貸してくれるそうですよ。' },
  { id:'scn.mua.beta.firstend.mua3', who:'mua', e:'wink', t:'β版はまだまだこれから。新しいことが増えたら、また{name}といっしょに育てたいな♪' },
  { id:'scn.mua.beta.firstend.mua3b', who:'mua', e:'wink', bond:[1,2], t:'β版は、まだまだこれからです。新しいことが増えたら、また{name}といっしょに育てたいです。' },

  // ═══════════ 準備中の助手を押したとき ═══════════
  { id:'tut.lock.mua1', who:'mua', e:'troubled', t:'みんなはいま準備中なんだって。それまで、あたしががんばるね！' },
  { id:'tut.lock.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'ほかのみんなは、いま準備中だそうです。それまでは、あたしががんばりますね。' },

  // ═══════════ チュートリアル(説明の台詞) ═══════════
  // 育成の準備
  { id:'tut.scn.mua1', who:'mua', e:'excited', t:'ストーリーは『ヒーローへの道』！ デビュー戦からヒーローズファイナルまで、いっしょに駆け上がろ♪ くわしくは『ストーリー詳細』で見られるよ' },
  { id:'tut.scn.mua1b', who:'mua', e:'excited', bond:[1,2], t:'ストーリーは『ヒーローへの道』です。デビュー戦からヒーローズファイナルまで、いっしょに駆け上がりましょう。くわしくは『ストーリー詳細』で見られますよ。' },
  { id:'tut.prep.mua1', who:'mua', e:'happy', t:'まずは育てるモンスターを1体えらぼ！ ベースモンか、合体で生まれたモンスターから選べるよ' },
  { id:'tut.prep.mua1b', who:'mua', e:'happy', bond:[1,2], t:'まずは、育てるモンスターを1体選びましょう。ベースモンか、合体で生まれたモンスターから選べます。' },
  { id:'tut.prep.mua2', who:'mua', e:'normal', t:'次は編成。ここに入れたマスモンが、トレーニングを手伝いに来てくれるの' },
  { id:'tut.prep.mua2b', who:'mua', e:'normal', bond:[1,2], t:'次は編成です。ここに入れたマスモンが、トレーニングを手伝いに来てくれます。' },
  { id:'tut.prep.mua3', who:'mua', e:'wink', t:'持ちこみの物も選べるけど、数に限りがあるから、よーく考えてね♪' },
  { id:'tut.prep.mua3b', who:'mua', e:'wink', bond:[1,2], t:'持ちこみの物も選べますが、数に限りがあるので、よく考えてくださいね。' },

  // 期とターン
  { id:'tut.turn.mua1', who:'mua', e:'happy', t:'育成はターンで進むよ。デビュー期からはじまって、最後の期まで駆け抜けるの！' },
  { id:'tut.turn.mua1b', who:'mua', e:'happy', bond:[1,2], t:'育成は、ターンで進みます。デビュー期からはじまって、最後の期まで駆け抜けます。' },
  { id:'tut.turn.mua2', who:'mua', e:'normal', t:'毎ターン、トレーニング・休む・遊ぶ・修行・大会から、ひとつ選んでね。いまの期とあと何ターンかは、画面の上に出てるよ' },
  { id:'tut.turn.mua2b', who:'mua', e:'normal', bond:[1,2], t:'毎ターン、トレーニング・休む・遊ぶ・修行・大会から、ひとつ選びます。いまの期と残りのターンは、画面の上に出ています。' },
  { id:'tut.turn.mua3', who:'mua', e:'wink', t:'1ターンごとに保存されるから、途中でやめても続きからできるよ (｡ ˘-˘)ｳﾝｳﾝ' },
  { id:'tut.turn.mua3b', who:'mua', e:'wink', bond:[1,2], t:'1ターンごとに保存されるので、途中でやめても続きから遊べます。' },

  // トレーニング
  { id:'tut.train.mua1', who:'mua', e:'normal', t:'トレーニングは6つ。選んだ能力がぐんっと伸びて、ほかの能力もちょっとずつ上がるよ' },
  { id:'tut.train.mua1b', who:'mua', e:'normal', bond:[1,2], t:'トレーニングは6つあります。選んだ能力が大きく伸びて、ほかの能力も少しずつ上がります。' },
  { id:'tut.train.mua2', who:'mua', e:'happy', t:'札に顔が並んでるのは、手伝いに来てくれた編成のマスモン！ たくさん来てる札ほど、よく伸びるの' },
  { id:'tut.train.mua2b', who:'mua', e:'happy', bond:[1,2], t:'札に顔が並んでいるのは、手伝いに来てくれた編成のマスモンです。たくさん来ている札ほど、よく伸びます。' },
  { id:'tut.train.mua3', who:'mua', e:'excited', t:'同じトレーニングを続けるとトレーニングLvが上がるし、仲良くなったマスモンとは友情タッグで、もっと伸びるんだって！' },
  { id:'tut.train.mua3b', who:'mua', e:'excited', bond:[1,2], t:'同じトレーニングを続けるとトレーニングLvが上がります。仲良くなったマスモンとは友情タッグになって、もっと伸びるそうです。' },
  { id:'tut.train.mua4', who:'mua', e:'troubled', t:'でもトレーニングすると体力が減るから、そこだけ見ててあげてね' },
  { id:'tut.train.mua4b', who:'mua', e:'troubled', bond:[1,2], t:'ただ、トレーニングをすると体力が減ります。そこだけは見ていてあげてくださいね。' },

  // トレーニングの結果と叱る・褒める
  { id:'tut.result.mua1', who:'mua', e:'surprise', t:'結果が出たね！ 大成功・成功・失敗・サボりの4つがあるの' },
  { id:'tut.result.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'結果が出ましたね。大成功・成功・失敗・サボりの4つがあります。' },
  { id:'tut.result.mua2', who:'mua', e:'normal', t:'結果のあとは、叱るか褒めるかを1回選べるよ。選ばなくても大丈夫！' },
  { id:'tut.result.mua2b', who:'mua', e:'normal', bond:[1,2], t:'結果のあとは、叱るか褒めるかを1回選べます。選ばなくても大丈夫ですよ。' },
  { id:'tut.result.mua3', who:'mua', e:'wink', t:'どっちが正解ってことはないの。甘えん坊にするか、きりっとさせるか、{name}の育て方しだい！' },
  { id:'tut.result.mua3b', who:'mua', e:'wink', bond:[1,2], t:'どちらが正解、ということはありません。甘えん坊にするか、きりっとさせるかは、{name}の育て方しだいです。' },

  // 休む・遊ぶ・通院
  { id:'tut.rest.mua1', who:'mua', e:'troubled', t:'{mon}、ちょっと疲れてきたかも💦 体力が減ってると、トレーニングで失敗しやすくなるの' },
  { id:'tut.rest.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'{mon}、少し疲れてきたみたいです。体力が減っていると、トレーニングで失敗しやすくなります。' },
  { id:'tut.rest.mua2', who:'mua', e:'normal', t:'そんなときは「休む」でしっかり回復！ 「遊ぶ」は回復は少しだけど、気分が晴れて甘えてくれるようになるよ' },
  { id:'tut.rest.mua2b', who:'mua', e:'normal', bond:[1,2], t:'そんなときは「休む」で回復しましょう。「遊ぶ」は回復が少しですが、気分が晴れて、甘えてくれるようになります。' },
  { id:'tut.rest.mua3', who:'mua', e:'happy', t:'悪いようすが付いちゃったら「通院」で治せるからね。無理させないのがいちばん♪' },
  { id:'tut.rest.mua3b', who:'mua', e:'happy', bond:[1,2], t:'悪いようすが付いたときは、「通院」で治せます。無理をさせないのが、いちばんです。' },

  // 修行
  { id:'tut.shugyo.mua1', who:'mua', e:'excited', t:'修行チケットもらったぢゃん！ これで修行に行けるよ✨' },
  { id:'tut.shugyo.mua1b', who:'mua', e:'excited', bond:[1,2], t:'修行チケットをもらいましたね！ これで修行に行けます。' },
  { id:'tut.shugyo.mua2', who:'mua', e:'normal', t:'行き先を選ぶと、能力が上がって、最後に技を覚えるチャンスがあるの。チケットは、賞金ランクが上がるともらえるよ。大会で賞金をためていこ！' },
  { id:'tut.shugyo.mua2b', who:'mua', e:'normal', bond:[1,2], t:'行き先を選ぶと能力が上がって、最後に技を覚えるチャンスがあります。チケットは、賞金ランクが上がるともらえます。大会で賞金をためていきましょう。' },
  { id:'tut.shugyo.mua3', who:'mua', e:'wink', t:'覚えられなくても、次は覚えやすくなるから大丈夫！ ただ体力はけっこう使うから気をつけてね' },
  { id:'tut.shugyo.mua3b', who:'mua', e:'wink', bond:[1,2], t:'覚えられなくても、次は覚えやすくなります。ただ、体力を多めに使うので気をつけてくださいね。' },

  // 大会
  { id:'tut.cup.mua1', who:'mua', e:'excited', t:'大会の札が出てきたよ！ 出るとそのターンを使うけど、勝てば賞金と賞品のアイテムがもらえて、ごはんも1つ選べるの🔥' },
  { id:'tut.cup.mua1b', who:'mua', e:'excited', bond:[1,2], t:'大会の札が出てきました。出るとそのターンを使いますが、勝つと賞金と賞品のアイテムがもらえて、ごはんも1つ選べます。' },
  { id:'tut.cup.mua2', who:'mua', e:'normal', t:'期の終わりにも大会があるよ。まずはデビュー戦！ 最後の期は「ヒーローズファイナル」で、いちばん上を目指すの' },
  { id:'tut.cup.mua2b', who:'mua', e:'normal', bond:[1,2], t:'期の終わりにも大会があります。まずはデビュー戦です。最後の期は「ヒーローズファイナル」で、いちばん上を目指します。' },
  { id:'tut.rank.mua1', who:'mua', e:'excited', t:'ランク UP！ 大会でもらった賞金の合計で、賞金ランクが上がるの。1段上がるたびに修行チケットが1枚もらえるよ。負けても賞金が入れば上がるからね♪' },
  { id:'tut.rank.mua1b', who:'mua', e:'excited', bond:[1,2], t:'ランク UP です！ 大会でもらった賞金の合計で、賞金ランクが上がります。1段上がるたびに修行チケットが1枚もらえます。負けても、賞金が入れば上がりますよ。' },
  { id:'tut.meal.mua1', who:'mua', e:'happy', t:'勝ったごほうびに、ごはんを1つ選べるよ！ 体力が回復したり、能力が上がったりするの。負けたときはごはんなしだから、がんばろ！' },
  { id:'tut.meal.mua1b', who:'mua', e:'happy', bond:[1,2], t:'勝ったごほうびに、ごはんを1つ選べます。体力が回復したり、能力が上がったりします。負けたときはごはんがないので、がんばりましょう。' },

  // 試合
  { id:'tut.match.mua1', who:'mua', e:'happy', t:'試合は自分で操作できるよ！ 手番ごとに、技・前へ・後ろへ・ガード・ためるから選んでね' },
  { id:'tut.match.mua1b', who:'mua', e:'happy', bond:[1,2], t:'試合は、自分で操作できます。手番ごとに、技・前へ・後ろへ・ガード・ためるから選んでください。' },
  { id:'tut.match.mua2', who:'mua', e:'normal', t:'技の札は間合いごとに並んでて、押すとその間合いの技が全部見られるの。届く間合いと命中を見て選ぶのがコツ！' },
  { id:'tut.match.mua2b', who:'mua', e:'normal', bond:[1,2], t:'技の札は間合いごとに並んでいて、押すとその間合いの技が全部見られます。届く間合いと命中を見て選ぶのがコツです。' },
  { id:'tut.match.mua3', who:'mua', e:'wink', t:'技を撃つとガッツを使うから、足りないときは「ためる」！ 見てるだけがいいならオートにもできるよ' },
  { id:'tut.match.mua3b', who:'mua', e:'wink', bond:[1,2], t:'技を撃つとガッツを使います。足りないときは「ためる」です。見ているだけがよければ、オートにもできますよ。' },

  // はじめて負けたとき
  { id:'tut.rematch.mua1', who:'mua', e:'crying', t:'くやしい〜！ でも大丈夫、時渡りの砂時計があれば、もう一回挑めるよ' },
  { id:'tut.rematch.mua1b', who:'mua', e:'crying', bond:[1,2], t:'くやしいですね…。でも、時渡りの砂時計があれば、もう一度挑めます。' },
  { id:'tut.rematch.mua2', who:'mua', e:'normal', t:'虹の砂時計なら、相手を変えてやり直せるの。使える回数には限りがあるから、ここぞってときにね' },
  { id:'tut.rematch.mua2b', who:'mua', e:'normal', bond:[1,2], t:'虹の砂時計なら、相手を変えてやり直せます。使える回数に限りがあるので、ここぞというときに使ってください。' },

  // 出来事
  { id:'tut.event.mua1', who:'mua', e:'surprise', t:'あ、なんか起きたみたい！ ときどきこんなふうに、出来事が起きるの' },
  { id:'tut.event.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'あ、何か起きたみたいです。ときどき、こんなふうに出来事が起きます。' },
  { id:'tut.event.mua2', who:'mua', e:'normal', t:'選ぶものによって、上がる能力や{mon}の気持ちが変わるよ。上の見出しを見ると、だれとのお話か分かるからね' },
  { id:'tut.event.mua2b', who:'mua', e:'normal', bond:[1,2], t:'選ぶものによって、上がる能力や{mon}の気持ちが変わります。上の見出しを見ると、だれとのお話か分かりますよ。' },
  { id:'tut.event.mua3', who:'mua', e:'wink', t:'あたしとのお話も、ちゃんとあるから楽しみにしてて (ΦωΦ)ﾌﾌﾌ…' },
  { id:'tut.event.mua3b', who:'mua', e:'wink', bond:[1,2], t:'あたしとのお話もありますから、楽しみにしていてくださいね。' },

  // 覚醒の前触れ
  { id:'tut.awake.mua1', who:'mua', e:'surprise', t:'ちょ、{mon}の体、光ってない!? これ、覚醒の前触れかも(๑°ロ°๑)‼️' },
  { id:'tut.awake.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'{mon}の体が、光っていませんか…!? これは、覚醒の前触れかもしれません！' },
  { id:'tut.awake.mua2', who:'mua', e:'excited', t:'覚醒すると、全部の能力と間合いの得意がぐんと上がって、キラキラの姿になるの。虹色に光ったら超覚醒！' },
  { id:'tut.awake.mua2b', who:'mua', e:'excited', bond:[1,2], t:'覚醒すると、全部の能力と間合いの得意が大きく上がって、キラキラの姿になります。虹色に光ったら、超覚醒です！' },
  { id:'tut.awake.mua3', who:'mua', e:'normal', t:'めったに起きないから、光ったら見逃さないでね' },
  { id:'tut.awake.mua3b', who:'mua', e:'normal', bond:[1,2], t:'めったに起きないので、光ったら見逃さないでくださいね。' },

  // 引退
  { id:'tut.retire.mua1', who:'mua', e:'happy', t:'育成はここまで！ 最後の総合力で評価が決まるよ' },
  { id:'tut.retire.mua1b', who:'mua', e:'happy', bond:[1,2], t:'育成はここまでです。最後の総合力で、評価が決まります。' },
  { id:'tut.retire.mua2', who:'mua', e:'normal', t:'もらったポイントでアシスト効果を選んでね。次の育成でこのモンスターを編成に連れていくと、効いてくれるの' },
  { id:'tut.retire.mua2b', who:'mua', e:'normal', bond:[1,2], t:'もらったポイントで、アシスト効果を選んでください。次の育成でこのモンスターを編成に連れていくと、効いてくれます。' },
  { id:'tut.retire.mua3', who:'mua', e:'wink', t:'引退しても、いなくなるわけぢゃないよ！ マスモンボックスに入って、名前や色もあとから変えられるからね' },
  { id:'tut.retire.mua3b', who:'mua', e:'wink', bond:[1,2], t:'引退しても、いなくなるわけではありません。マスモンボックスに入って、名前や色もあとから変えられますよ。' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_BETA_MUA };
