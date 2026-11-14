// モンヒロサクセス 台本 第1弾: 助手のシナリオ(みゅあ・あつ)
// EVENTS.md ②「助手の連続イベント」(4話+特別な1話・3話の選び方で4話が「いい結末/ほろ苦い結末」)と、
// そのシナリオだけの大会の前後。形は README.md。
//   who  … mua / atsu / narr(地の文) / choice(選択肢の札)
//   c    … 選択肢の記号。choice の行と、その選択肢を選んだあとの行に付ける(a / b)
//   end  … 4話・特別な1話の結末(good=いい結末 / bitter=ほろ苦い結末)
//   bond … この助手の仲良し度の段がこの範囲のときだけ出す行(みゅあの Lv1・2 はていねい語。assistants.js と同じ決まり)
//          bond の付いた行がある場面では、段が合う人には bond の行、それ以外の人には bond の無い行を出す
// {cup} はシナリオで決まった大会の名前(画面側で、その期の ★★★ か 👑 から1つ選んで差しこむ)
const MONSUC_SCRIPT_SCENARIO = Object.freeze([
  // ═══════════ みゅあの話 ═══════════
  // ── 1話「この子の得意、見つけよ！」(デビュー期・必ず出る) ──
  { id:'scn.mua.ep1.narr1', who:'narr', t:'朝いちばん、みゅあが{mon}の手を引いて町へ飛び出していった。' },
  { id:'scn.mua.ep1.mua1', who:'mua', e:'excited', t:'ねーねー{name}！ {mon}の得意、いっしょに見つけよ！' },
  { id:'scn.mua.ep1.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{name}、おはようございます！ {mon}の得意なこと、いっしょに探しに行きませんか？' },
  { id:'scn.mua.ep1.narr2', who:'narr', t:'おやつ屋さん、広場、ひなたの丘。{mon}はどこへ行っても目をかがやかせる。' },
  { id:'scn.mua.ep1.mua2', who:'mua', e:'happy', t:'どこでも楽しそーで決めらんないｗ {name}はどう思う？' },
  { id:'scn.mua.ep1.mua2b', who:'mua', e:'happy', bond:[1,2], t:'どこでも楽しそうで、迷っちゃいますね。{name}はどう思いますか？' },
  { id:'scn.mua.ep1.choice.a', who:'choice', c:'a', t:'走るのが好きそう' },
  { id:'scn.mua.ep1.choice.b', who:'choice', c:'b', t:'食べるのが好きそう' },
  { id:'scn.mua.ep1.a.mua1', who:'mua', e:'excited', c:'a', t:'だよね！ 丘を走ってるときの顔、いちばんキラキラしてた✨' },
  { id:'scn.mua.ep1.a.mua1b', who:'mua', e:'excited', c:'a', bond:[1,2], t:'やっぱり！ 丘を走っているとき、いちばんいい顔をしていました✨' },
  { id:'scn.mua.ep1.b.mua1', who:'mua', e:'happy', c:'b', t:'わかるｗ おやつ屋さんの前から動かなかったもんね！' },
  { id:'scn.mua.ep1.b.mua1b', who:'mua', e:'happy', c:'b', bond:[1,2], t:'ふふ、おやつ屋さんの前からずっと動きませんでしたもんね！' },
  { id:'scn.mua.ep1.mua3', who:'mua', e:'wink', t:'今日から{mon}の「好き」、いっぱい伸ばしてこ♪' },
  { id:'scn.mua.ep1.mua3b', who:'mua', e:'wink', bond:[1,2], t:'{mon}の「好き」を、これからいっしょに伸ばしていきましょう♪' },

  // ── 2話「張り切りすぎ」(ジュニア期・親密度30〜) ──
  { id:'scn.mua.ep2.narr1', who:'narr', t:'今月のみゅあは張り切りっぱなし。朝から晩まで、{mon}とずっと走り回っている。' },
  { id:'scn.mua.ep2.narr2', who:'narr', t:'夕方、{mon}は芝生の上でぺたんと座りこんでしまった。' },
  { id:'scn.mua.ep2.mua1', who:'mua', e:'surprise', t:'えっ、{mon}？ …うわ、へとへとぢゃん…' },
  { id:'scn.mua.ep2.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'えっ、{mon}？ …へとへとになっちゃってますね…' },
  { id:'scn.mua.ep2.mua2', who:'mua', e:'crying', t:'まぢごめん…あたし、楽しいとつい止まんなくなっちゃって' },
  { id:'scn.mua.ep2.mua2b', who:'mua', e:'crying', bond:[1,2], t:'ごめんなさい…。あたし、楽しいとつい止まらなくなってしまうんです' },
  { id:'scn.mua.ep2.mua3', who:'mua', e:'troubled', t:'{name}、この後どうしよ…？' },
  { id:'scn.mua.ep2.mua3b', who:'mua', e:'troubled', bond:[1,2], t:'{name}、このあとどうしましょう…？' },
  { id:'scn.mua.ep2.choice.a', who:'choice', c:'a', t:'今日はもう休もう' },
  { id:'scn.mua.ep2.choice.b', who:'choice', c:'b', t:'もう1本だけやろう' },
  { id:'scn.mua.ep2.a.mua1', who:'mua', e:'happy', c:'a', t:'うん、そうする！ {mon}、今日はいっしょにゴロゴロしよ(｡ ˘-˘)' },
  { id:'scn.mua.ep2.a.mua1b', who:'mua', e:'happy', c:'a', bond:[1,2], t:'はい、そうします！ {mon}、今日はいっしょにゴロゴロしましょう(｡ ˘-˘)' },
  { id:'scn.mua.ep2.a.mua2', who:'mua', e:'wink', c:'a', t:'{name}が止めてくれてよかった。あたし、いいコンビになれそうかもｗ' },
  { id:'scn.mua.ep2.a.mua2b', who:'mua', e:'wink', c:'a', bond:[1,2], t:'{name}が止めてくれてよかったです。あたしたち、いいコンビになれそうですね' },
  { id:'scn.mua.ep2.b.mua1', who:'mua', e:'excited', c:'b', t:'よーし、ラスト1本！ {mon}、いけるとこまでいこ！' },
  { id:'scn.mua.ep2.b.mua1b', who:'mua', e:'excited', c:'b', bond:[1,2], t:'わかりました、あと1本！ {mon}、いけるところまでいきましょう！' },
  { id:'scn.mua.ep2.b.mua2', who:'mua', e:'troubled', c:'b', t:'…やりきったけど、明日はちゃんと休ませてあげよーね💦' },
  { id:'scn.mua.ep2.b.mua2b', who:'mua', e:'troubled', c:'b', bond:[1,2], t:'…やりきりましたね。明日はちゃんと休ませてあげましょうね💦' },

  // ── 3話「手作りのお守り」(ミドル期・親密度50〜。ここで4話が分かれる) ──
  { id:'scn.mua.ep3.narr1', who:'narr', t:'{cup}の前の日。みゅあが小さな布の袋を差し出してきた。' },
  { id:'scn.mua.ep3.mua1', who:'mua', e:'happy', t:'じゃーん、手作りのお守り！ 夜なべしちゃったｗ' },
  { id:'scn.mua.ep3.mua1b', who:'mua', e:'happy', bond:[1,2], t:'じゃーん、手作りのお守りです！ 夜なべしちゃいました' },
  { id:'scn.mua.ep3.narr2', who:'narr', t:'渡すみゅあの手が、少しふるえている。' },
  { id:'scn.mua.ep3.mua2', who:'mua', e:'troubled', t:'…あれ、なんであたしがいちばん緊張してんだろ。おかしいよねｗ' },
  { id:'scn.mua.ep3.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'…あれ、どうしてあたしがいちばん緊張しているんでしょう。おかしいですよね' },
  { id:'scn.mua.ep3.mua3', who:'mua', e:'troubled', t:'明日、ちゃんと声出せるかな…' },
  { id:'scn.mua.ep3.mua3b', who:'mua', e:'troubled', bond:[1,2], t:'明日、ちゃんと声を出せるでしょうか…' },
  { id:'scn.mua.ep3.choice.a', who:'choice', c:'a', t:'みんなで深呼吸しよう' },
  { id:'scn.mua.ep3.choice.b', who:'choice', c:'b', t:'お守り、ありがたくもらうね' },
  { id:'scn.mua.ep3.a.narr1', who:'narr', c:'a', t:'{name}とみゅあと{mon}、3人で大きく息を吸って、ゆっくり吐いた。' },
  { id:'scn.mua.ep3.a.mua1', who:'mua', e:'happy', c:'a', t:'…うん、落ち着いた ε-(´∀｀*)ﾎｯ 明日はあたしの声、ぜったい届けるから！' },
  { id:'scn.mua.ep3.a.mua1b', who:'mua', e:'happy', c:'a', bond:[1,2], t:'…はい、落ち着きました ε-(´∀｀*)ﾎｯ 明日はあたしの声、ぜったい届けますから！' },
  { id:'scn.mua.ep3.b.mua1', who:'mua', e:'happy', c:'b', t:'えへへ、大事にしてね！ …あたしもがんばって落ち着かなきゃ💦' },
  { id:'scn.mua.ep3.b.mua1b', who:'mua', e:'happy', c:'b', bond:[1,2], t:'大事にしてくださいね！ …あたしも、落ち着かなきゃ💦' },

  // ── シナリオの大会: {cup}(3話の翌月) ──
  { id:'scn.mua.cup1.before.mua1', who:'mua', e:'excited', t:'{mon}、お守り持った？ よーし、いつもの{mon}でいこ！' },
  { id:'scn.mua.cup1.before.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{mon}、お守りは持ちましたか？ いつもの{mon}でいきましょう！' },
  { id:'scn.mua.cup1.win.mua1', who:'mua', e:'excited', t:'勝ったぁー！ お守り効いたぢゃん✨ …いや、{mon}が強いんだよね！' },
  { id:'scn.mua.cup1.win.mua1b', who:'mua', e:'excited', bond:[1,2], t:'勝ちました！ お守りが効きましたね✨ …いえ、{mon}が強いんですよね！' },
  { id:'scn.mua.cup1.lose.mua1', who:'mua', e:'crying', t:'くやしいね😭 でもお守りはまだ持っててね。次こそだよ！' },
  { id:'scn.mua.cup1.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'くやしいですね。でも、お守りはまだ持っていてくださいね。次こそです！' },

  // ── 4話「みんなの声」(プロ期・親密度70〜。3話で深呼吸=いい結末 / お守りだけ=ほろ苦い結末) ──
  { id:'scn.mua.ep4.narr1', who:'narr', t:'プロ期の大舞台。客席はぎっしり埋まって、声がかき消されそうなほどにぎやかだ。' },
  { id:'scn.mua.ep4.mua1', who:'mua', e:'troubled', t:'うわ、人多すぎ…。あたしの声、ここまで届くかな' },
  { id:'scn.mua.ep4.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'人がすごく多いですね…。あたしの声、ここまで届くでしょうか' },
  { id:'scn.mua.ep4.good.narr1', who:'narr', end:'good', t:'みゅあが、あの日と同じように大きく息を吸った。' },
  { id:'scn.mua.ep4.good.mua1', who:'mua', e:'excited', end:'good', t:'{mon}ーーっ！ いっけぇーーー！！' },
  { id:'scn.mua.ep4.good.mua1b', who:'mua', e:'excited', end:'good', bond:[1,2], t:'{mon}ーーっ！ がんばってください！！' },
  { id:'scn.mua.ep4.good.narr2', who:'narr', end:'good', t:'その声は、たしかに{mon}に届いた。ふり返った{mon}の目に、もう迷いはない。' },
  { id:'scn.mua.ep4.good.mua2', who:'mua', e:'crying', end:'good', t:'届いた…まぢで届いたよ😭 {name}、あたしたち、最高のチームぢゃん！' },
  { id:'scn.mua.ep4.good.mua2b', who:'mua', e:'crying', end:'good', bond:[1,2], t:'届いた…ちゃんと届きました😭 {name}、あたしたち、最高のチームです！' },
  { id:'scn.mua.ep4.bitter.narr1', who:'narr', end:'bitter', t:'みゅあの声は歓声にのまれた。それでも{mon}は、お守りを握って前を向いた。' },
  { id:'scn.mua.ep4.bitter.mua1', who:'mua', e:'troubled', end:'bitter', t:'…届かなかったかも。でも{mon}、ちゃんと戦ってた' },
  { id:'scn.mua.ep4.bitter.mua1b', who:'mua', e:'troubled', end:'bitter', bond:[1,2], t:'…届かなかったかもしれません。でも{mon}、ちゃんと戦っていました' },
  { id:'scn.mua.ep4.bitter.mua2', who:'mua', e:'happy', end:'bitter', t:'見てた人たち、みんな{mon}のファンになっちゃったよ！ それはそれで最高ぢゃんｗ' },
  { id:'scn.mua.ep4.bitter.mua2b', who:'mua', e:'happy', end:'bitter', bond:[1,2], t:'見ていた人たち、みんな{mon}のファンになっちゃいましたね！ それも最高です' },
  // シナリオの大会: 4話の大舞台
  { id:'scn.mua.cup2.before.mua1', who:'mua', e:'excited', t:'いよいよ大舞台！ {mon}、楽しんだもん勝ちだよ✨' },
  { id:'scn.mua.cup2.before.mua1b', who:'mua', e:'excited', bond:[1,2], t:'いよいよ大舞台です！ {mon}、楽しんだもの勝ちですよ✨' },
  { id:'scn.mua.cup2.win.mua1', who:'mua', e:'excited', t:'優勝ーー！！ {mon}、世界一だよ(っ`･ω･´)っﾌﾚｰｯ!ﾌﾚｰｯ!' },
  { id:'scn.mua.cup2.win.mua1b', who:'mua', e:'excited', bond:[1,2], t:'優勝です！！ {mon}、世界一ですよ(っ`･ω･´)っﾌﾚｰｯ!ﾌﾚｰｯ!' },
  { id:'scn.mua.cup2.lose.mua1', who:'mua', e:'crying', t:'あとちょっとだったね…。でも今日の{mon}、いちばんかっこよかった' },
  { id:'scn.mua.cup2.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'あと少しでしたね…。でも今日の{mon}、いちばんかっこよかったです' },

  // ── 特別な1話「ここまで来たぢゃん」(最後の期・仲良し度Lv5〜・4話がいい結末) ──
  { id:'scn.mua.sp.narr1', who:'narr', t:'最後の期のある夕方。みゅあに誘われて、{mon}と町をゆっくり一周した。' },
  { id:'scn.mua.sp.mua1', who:'mua', e:'happy', t:'ここ、はじめて{mon}の得意を探しに来たとこ。覚えてる？' },
  { id:'scn.mua.sp.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ここ、はじめて{mon}の得意を探しに来たところです。覚えていますか？' },
  { id:'scn.mua.sp.narr2', who:'narr', t:'おやつ屋さん、広場、ひなたの丘。どこにも、ここまでの思い出がある。' },
  { id:'scn.mua.sp.mua2', who:'mua', e:'crying', t:'あの日はちっちゃかったのに…ここまで来たぢゃん😭' },
  { id:'scn.mua.sp.mua2b', who:'mua', e:'crying', bond:[1,2], t:'あの日はちっちゃかったのに…ここまで来ましたね😭' },
  { id:'scn.mua.sp.mua3', who:'mua', e:'happy', t:'{name}、{mon}、ありがと。あたし、このチームでほんとによかった♪' },
  { id:'scn.mua.sp.mua3b', who:'mua', e:'happy', bond:[1,2], t:'{name}、{mon}、ありがとうございます。あたし、このチームで本当によかったです♪' },
  { id:'scn.mua.sp.retire.mua1', who:'mua', e:'crying', t:'最後にいっしょに町を回れて、まぢうれしかった。{mon}、ずっと大好きだよ！' },
  { id:'scn.mua.sp.retire.mua1b', who:'mua', e:'crying', bond:[1,2], t:'最後にいっしょに町を回れて、本当にうれしかったです。{mon}、ずっと大好きですよ！' },

  // ═══════════ あつの話 ═══════════
  // ── 1話「上の星を見とく」(デビュー期・必ず出る) ──
  { id:'scn.atsu.ep1.narr1', who:'narr', t:'育成を始めた最初の月。あつが{mon}を連れて、いちばん大きな大会の会場へ向かった。' },
  { id:'scn.atsu.ep1.atsu1', who:'atsu', e:'happy', t:'とりあえず、上の星だけ見とこっか笑' },
  { id:'scn.atsu.ep1.narr2', who:'narr', t:'誰もいない会場。広い舞台と、見上げるほど高い客席。' },
  { id:'scn.atsu.ep1.atsu2', who:'atsu', e:'normal', t:'いつかここで戦う。{mon}、どう？' },
  { id:'scn.atsu.ep1.choice.a', who:'choice', c:'a', t:'燃えてきた！' },
  { id:'scn.atsu.ep1.choice.b', who:'choice', c:'b', t:'ちょっとこわいかも' },
  { id:'scn.atsu.ep1.a.atsu1', who:'atsu', e:'excited', c:'a', t:'いい顔するじゃん。その気持ち、持って帰ろ笑' },
  { id:'scn.atsu.ep1.b.atsu1', who:'atsu', e:'normal', c:'b', t:'こわいって言えるのは強いよ。最初はそれでいい…' },
  { id:'scn.atsu.ep1.b.atsu2', who:'atsu', e:'happy', c:'b', t:'大丈夫、ここに来るまでに俺らが鍛えるから笑' },

  // ── 2話「準備で負けんのはナシ」(ジュニア期・親密度30〜) ──
  { id:'scn.atsu.ep2.narr1', who:'narr', t:'次の{cup}で、格上の相手と当たることが分かった。' },
  { id:'scn.atsu.ep2.narr2', who:'narr', t:'その夜、あつは相手の試合を何度も見返して、紙にびっしり書きこんでいた。' },
  { id:'scn.atsu.ep2.atsu1', who:'atsu', e:'normal', t:'相手のクセ、だいたい分かった。てか、ここ毎回同じ動きしてる笑' },
  { id:'scn.atsu.ep2.atsu2', who:'atsu', e:'happy', t:'勝てるかは分かんない。でも、準備で負けんのはナシな笑' },
  { id:'scn.atsu.ep2.choice.a', who:'choice', c:'a', t:'作戦どおりに戦う' },
  { id:'scn.atsu.ep2.choice.b', who:'choice', c:'b', t:'自分の得意で押す' },
  { id:'scn.atsu.ep2.a.atsu1', who:'atsu', e:'happy', c:'a', t:'おけおけー笑 じゃあ今日は頭のトレーニングな！' },
  { id:'scn.atsu.ep2.b.atsu1', who:'atsu', e:'excited', c:'b', t:'それもアリ。{mon}の{stat}なら真っ向から行けるだろ笑' },
  // シナリオの大会: 2話の{cup}
  { id:'scn.atsu.cup1.before.atsu1', who:'atsu', e:'normal', t:'格上だろうが関係ない。やることやってきたから！' },
  { id:'scn.atsu.cup1.win.atsu1', who:'atsu', e:'excited', t:'勝ったな。準備は裏切らないんだよ笑' },
  { id:'scn.atsu.cup1.lose.atsu1', who:'atsu', e:'troubled', t:'残念笑 でも差はだいぶ縮まってた。次は取れる！' },

  // ── 3話「くやしい負けの話」(ミドル期・親密度50〜。ここで4話が分かれる) ──
  { id:'scn.atsu.ep3.narr1', who:'narr', t:'トレーニングのあと、あつが珍しく昔の話を始めた。' },
  { id:'scn.atsu.ep3.atsu1', who:'atsu', e:'normal', t:'{cup}ってあるだろ。昔、あそこで一回負けてんだよ笑' },
  { id:'scn.atsu.ep3.atsu2', who:'atsu', e:'troubled', t:'準備も足りてなかったし、完敗。…別に、気にしてないけど笑' },
  { id:'scn.atsu.ep3.narr2', who:'narr', t:'そう言いながら、あつは遠くの会場のほうをしばらく見ていた。' },
  { id:'scn.atsu.ep3.choice.a', who:'choice', c:'a', t:'その大会、いっしょに勝とう' },
  { id:'scn.atsu.ep3.choice.b', who:'choice', c:'b', t:'今は自分たちのペースでいこう' },
  { id:'scn.atsu.ep3.a.atsu1', who:'atsu', e:'surprise', c:'a', t:'…は？ 何それ、まじで言ってる？笑' },
  { id:'scn.atsu.ep3.a.atsu2', who:'atsu', e:'happy', c:'a', t:'…上等。約束な、{name}。{mon}も聞いたからな！' },
  { id:'scn.atsu.ep3.b.atsu1', who:'atsu', e:'normal', c:'b', t:'それね笑 今は{mon}のことだけ考えよ。俺の話はいいから！' },

  // ── 4話「約束の大会」(プロ期・親密度70〜。3話で約束=いい結末 / 自分のペース=ほろ苦い結末) ──
  { id:'scn.atsu.ep4.narr1', who:'narr', t:'プロ期の{cup}。あつがかつて負けた、あの舞台。' },
  { id:'scn.atsu.ep4.good.atsu1', who:'atsu', e:'normal', end:'good', t:'約束、覚えてる？ …俺は覚えてるよ笑' },
  { id:'scn.atsu.ep4.good.narr1', who:'narr', end:'good', t:'あつが{mon}の背中を軽くたたく。いつもより、少しだけ力がこもっていた。' },
  { id:'scn.atsu.ep4.good.atsu2', who:'atsu', e:'excited', end:'good', t:'{mon}、あの日の俺の分まで暴れてこい！' },
  { id:'scn.atsu.ep4.good.atsu3', who:'atsu', e:'happy', end:'good', t:'…ありがとな、{name}。やっと、あの日の続きが見れた笑' },
  { id:'scn.atsu.ep4.bitter.atsu1', who:'atsu', e:'normal', end:'bitter', t:'ここ、俺が負けたとこ。…まぁ、今日は{mon}の舞台だから笑' },
  { id:'scn.atsu.ep4.bitter.narr1', who:'narr', end:'bitter', t:'あつは客席の端で、静かに腕を組んで見守っていた。' },
  { id:'scn.atsu.ep4.bitter.atsu2', who:'atsu', e:'happy', end:'bitter', t:'いい試合だった。{mon}は{mon}の道でいいんだよ笑' },
  // シナリオの大会: 4話の{cup}
  { id:'scn.atsu.cup2.before.atsu1', who:'atsu', e:'excited', t:'さぁ、行こっか。かかってこいって顔して入れよ笑' },
  { id:'scn.atsu.cup2.win.atsu1', who:'atsu', e:'excited', t:'…勝った。勝ったな！ {mon}、最高だよ( *˘ω˘*)ノ' },
  { id:'scn.atsu.cup2.lose.atsu1', who:'atsu', e:'troubled', t:'残念笑 …でも、あの日の俺よりずっと強かったよ…！' },

  // ── 特別な1話「頂への道の前に」(最後の期・仲良し度Lv5〜・4話がいい結末) ──
  { id:'scn.atsu.sp.narr1', who:'narr', t:'頂への道の前の晩。あつは珍しく、作戦の話をしなかった。' },
  { id:'scn.atsu.sp.atsu1', who:'atsu', e:'normal', t:'もう教えることないわ。てか、最初から{mon}は強かったんだよ笑' },
  { id:'scn.atsu.sp.narr2', who:'narr', t:'しばらく黙ってから、あつは{mon}の目をまっすぐ見た。' },
  { id:'scn.atsu.sp.atsu2', who:'atsu', e:'excited', t:'{mon}、おまえなら行ける…！' },
  { id:'scn.atsu.sp.atsu3', who:'atsu', e:'happy', t:'…以上。寝よ寝よ、明日早いから笑' },
  { id:'scn.atsu.sp.retire.atsu1', who:'atsu', e:'happy', t:'てっぺんまで付き合ってくれてありがとな。{mon}、おまえは俺の自慢だよ笑' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_SCENARIO };
