// モンヒロサクセス 台本 第1弾: ターンごとのことば(助手 みゅあ・あつ)
// PLAN.md §6 の場面ごと。形は README.md。資料だけで、ゲーム本体はまだ読まない。
//   id   … 場面のid + 「.」+ だれ + 番号。場面のidは id の最後の「.」より前(例 'turn.start.great')
//   who  … mua / atsu
//   e    … 表情(assistants.js の ASSISTANT_EXPRESSIONS)
//   t    … 台詞。{name}=プレイヤーの呼び方 / {mon}=育てているモンスターの名前 / {cheer}=編成の子の名前 /
//          {train}=訓練の名前 / {stat}=能力の名前 / {tech}=技の名前 / {cup}=大会の名前
// 同じ場面に2本以上あるときは、くじで1本を出す。
const MONSUC_SCRIPT_TURN = Object.freeze([
  // ── ターンのはじめの様子(疲れ・ストレス・機嫌。数字は言わない) ──
  { id:'turn.start.great.mua1', who:'mua', e:'excited', t:'{mon}、今日まぢ絶好調ぢゃん✨ 目がキラッキラしてるもん！' },
  { id:'turn.start.great.mua2', who:'mua', e:'happy', t:'見て見て、{mon}しっぽブンブンｗ 今日ならなんでもいけそー！' },
  { id:'turn.start.good.mua1', who:'mua', e:'happy', t:'{mon}、いい感じに元気だよ♪ 今月もいっしょにがんばろ！' },
  { id:'turn.start.good.mua2', who:'mua', e:'wink', t:'ごはんもぺろっと食べたし、調子よさげ👍 {name}、今日なにする？' },
  { id:'turn.start.normal.mua1', who:'mua', e:'normal', t:'{mon}はいつもどおりって感じかな〜。ふつうがいちばん！' },
  { id:'turn.start.normal.mua2', who:'mua', e:'normal', t:'可もなく不可もなくってとこ(｡ ˘_˘)ｳﾝｳﾝ 今月どうする？' },
  { id:'turn.start.tired.mua1', who:'mua', e:'troubled', t:'{mon}、ちょっとあくび多めかも…。無理しすぎないでいこ？' },
  { id:'turn.start.tired.mua2', who:'mua', e:'troubled', t:'足どりが重そう💦 そろそろ休ませてあげてもいいかもー' },
  { id:'turn.start.worn.mua1', who:'mua', e:'crying', t:'えっ、{mon}ぐったりしてるぢゃん！ 今日は休も、まぢで！' },
  { id:'turn.start.worn.mua2', who:'mua', e:'troubled', t:'{name}、{mon}もう限界っぽい…。このまま訓練はあぶないかも' },
  { id:'turn.start.stress.mua1', who:'mua', e:'troubled', t:'{mon}、なんかムスッとしてる…。たまにはパーッと遊ばない？' },
  { id:'turn.start.stress.mua2', who:'mua', e:'troubled', t:'最近ため息ついてるの気づいた？ 気分転換いこーよー' },

  { id:'turn.start.great.atsu1', who:'atsu', e:'excited', t:'今日の{mon}、仕上がってんな。重いのいっとく？笑' },
  { id:'turn.start.great.atsu2', who:'atsu', e:'happy', t:'いい顔してるわ。こういう日に詰めとくと後で効くよ笑' },
  { id:'turn.start.good.atsu1', who:'atsu', e:'happy', t:'調子いいね。とりあえず訓練でいいよ笑' },
  { id:'turn.start.good.atsu2', who:'atsu', e:'normal', t:'{mon}、ちゃんと動けてる。この感じ続けよ！' },
  { id:'turn.start.normal.atsu1', who:'atsu', e:'normal', t:'まぁ〜ふつうだな。どうする？笑' },
  { id:'turn.start.normal.atsu2', who:'atsu', e:'normal', t:'可もなく不可もなく。こういう月の積み重ねが大事なんだよ笑' },
  { id:'turn.start.tired.atsu1', who:'atsu', e:'troubled', t:'ちょっと疲れ見えてるかも。様子見ながらいこ…' },
  { id:'turn.start.tired.atsu2', who:'atsu', e:'normal', t:'動きが鈍いな。休むのも作戦のうちだよ笑' },
  { id:'turn.start.worn.atsu1', who:'atsu', e:'troubled', t:'これは休み一択。今無理させてもいいことないよ…' },
  { id:'turn.start.worn.atsu2', who:'atsu', e:'angry', t:'{name}、今日はストップな。けがしたら全部止まるから！' },
  { id:'turn.start.stress.atsu1', who:'atsu', e:'troubled', t:'{mon}、ちょっとピリついてるな。一回遊ばせよ笑' },
  { id:'turn.start.stress.atsu2', who:'atsu', e:'normal', t:'てか最近ずっと詰めすぎたかもな。息抜きしよ…' },

  // ── 訓練の結果 ──
  { id:'turn.result.great.mua1', who:'mua', e:'excited', t:'えっ、すご(๑°ロ°๑)‼️ 大成功ぢゃん！ {mon}天才すぎ！' },
  { id:'turn.result.great.mua2', who:'mua', e:'excited', t:'今のまぢ完璧なのきた✨ 見てた見てた！？' },
  { id:'turn.result.ok.mua1', who:'mua', e:'happy', t:'うんうん、ちゃんとできたね♪ えらいえらい！' },
  { id:'turn.result.ok.mua2', who:'mua', e:'happy', t:'いい感じ〜！ コツコツが大事だよね👍' },
  { id:'turn.result.fail.mua1', who:'mua', e:'troubled', t:'あー、今日はうまくいかなかったね…。ドンマイドンマイ！' },
  { id:'turn.result.fail.mua2', who:'mua', e:'troubled', t:'ちょっと疲れてたかも💦 そういう日もあるって！' },
  { id:'turn.result.slack.mua1', who:'mua', e:'surprise', t:'あれ、{mon}どこ行った？ …木陰で寝てるしｗ' },
  { id:'turn.result.slack.mua2', who:'mua', e:'troubled', t:'途中で遊びはじめちゃった…。甘やかしすぎかなぁ〜' },
  { id:'turn.result.tag.mua1', who:'mua', e:'excited', t:'{cheer}といっしょだと息ぴったりぢゃん！ 友情タッグだよ✨' },
  { id:'turn.result.tag.mua2', who:'mua', e:'happy', t:'みんなで声かけ合ってるの、見てるだけでうれしい♪' },

  { id:'turn.result.great.atsu1', who:'atsu', e:'excited', t:'うわ、今の大成功じゃん。いいね、さすが！' },
  { id:'turn.result.great.atsu2', who:'atsu', e:'happy', t:'これこれ。この感覚、忘れんなよ笑' },
  { id:'turn.result.ok.atsu1', who:'atsu', e:'normal', t:'おけおけー笑 ちゃんと積めてる！' },
  { id:'turn.result.ok.atsu2', who:'atsu', e:'happy', t:'いいね。地味だけどこれが一番強い笑' },
  { id:'turn.result.fail.atsu1', who:'atsu', e:'troubled', t:'残念笑 まぁ〜疲れてたしな。次いこ！' },
  { id:'turn.result.fail.atsu2', who:'atsu', e:'normal', t:'失敗はしゃあない。体力見とこっか…' },
  { id:'turn.result.slack.atsu1', who:'atsu', e:'angry', t:'おーい{mon}、どこ行くんだよ笑 …完全にサボってんな！' },
  { id:'turn.result.slack.atsu2', who:'atsu', e:'troubled', t:'甘やかしすぎるとこうなるんだよな笑' },
  { id:'turn.result.tag.atsu1', who:'atsu', e:'excited', t:'{cheer}と組むとやっぱ強いな。友情タッグ、上等！' },
  { id:'turn.result.tag.atsu2', who:'atsu', e:'happy', t:'仲間がいると伸び方が違うわ笑' },

  // ── 編成がたくさん集まったターン ──
  { id:'turn.gather.mua1', who:'mua', e:'excited', t:'今月は{train}にみんな集まってるよ！ チャンスぢゃん✨' },
  { id:'turn.gather.mua2', who:'mua', e:'happy', t:'{train}、にぎやかすぎるｗ みんなでやったら楽しそー！' },
  { id:'turn.gather.mua3', who:'mua', e:'wink', t:'ねーねー、{train}にこんなに来てる！ 行くしかなくない？' },
  { id:'turn.gather.atsu1', who:'atsu', e:'happy', t:'今月は{train}に集まってんな。ここ踏んどこ笑' },
  { id:'turn.gather.atsu2', who:'atsu', e:'excited', t:'{train}に勢ぞろいじゃん。来るしかないかー笑' },
  { id:'turn.gather.atsu3', who:'atsu', e:'normal', t:'みんな{train}で待ってるよ。とりあえずそこでいいよ笑' },

  // ── 叱る/褒めるのあと(合っていた・合っていなかった) ──
  { id:'turn.praise.fit.mua1', who:'mua', e:'happy', t:'褒められて{mon}うれしそー♪ 今のはナイス判断！' },
  { id:'turn.praise.fit.mua2', who:'mua', e:'excited', t:'見て、しっぽ止まんないｗ がんばったもんね！' },
  { id:'turn.praise.miss.mua1', who:'mua', e:'troubled', t:'あれ、{mon}ちょっと調子のっちゃったかもｗ' },
  { id:'turn.praise.miss.mua2', who:'mua', e:'troubled', t:'うーん、今のは褒めるとこぢゃなかったかも…？' },
  { id:'turn.scold.fit.mua1', who:'mua', e:'normal', t:'{mon}、ちゃんと分かったみたい。次は大丈夫そう！' },
  { id:'turn.scold.fit.mua2', who:'mua', e:'happy', t:'しゅんとしてたけど、目はやる気になってるよ♪' },
  { id:'turn.scold.miss.mua1', who:'mua', e:'crying', t:'えっ、{mon}がんばってたのに…。かわいそうだよぉ😭' },
  { id:'turn.scold.miss.mua2', who:'mua', e:'troubled', t:'今のはちょっと厳しすぎたかも…あとでなでてあげよ？' },

  { id:'turn.praise.fit.atsu1', who:'atsu', e:'happy', t:'いいね、ちゃんと見てたの伝わってるよ笑' },
  { id:'turn.praise.fit.atsu2', who:'atsu', e:'normal', t:'褒めるとこで褒める。それでいいんだよ！' },
  { id:'turn.praise.miss.atsu1', who:'atsu', e:'troubled', t:'今のは甘すぎかもな笑 {mon}、勘違いしてるよ笑' },
  { id:'turn.praise.miss.atsu2', who:'atsu', e:'normal', t:'失敗して褒められたら、そりゃ気がゆるむって笑' },
  { id:'turn.scold.fit.atsu1', who:'atsu', e:'normal', t:'うんうん笑 言うべきときは言わないとな！' },
  { id:'turn.scold.fit.atsu2', who:'atsu', e:'happy', t:'{mon}、ちゃんと受け止めてる。いい根性だわ笑' },
  { id:'turn.scold.miss.atsu1', who:'atsu', e:'troubled', t:'いや今のは叱るとこじゃないって…。ちゃんとできてたよ…' },
  { id:'turn.scold.miss.atsu2', who:'atsu', e:'troubled', t:'{mon}、ちょっとへこんでるな。フォロー入れとこ…' },

  // ── 年齢の節目 ──
  { id:'turn.age.peakin.mua1', who:'mua', e:'excited', t:'なんか{mon}、ひと回り大きくなってない！？ 今が伸びどきかも✨' },
  { id:'turn.age.peakin.mua2', who:'mua', e:'happy', t:'動きがキレッキレ！ いちばんいい時期きたぢゃん！' },
  { id:'turn.age.peakout.mua1', who:'mua', e:'normal', t:'{mon}、ちょっと落ち着いてきたかな。ここからは無理なくいこ' },
  { id:'turn.age.peakout.mua2', who:'mua', e:'troubled', t:'前ほどぐんぐんって感じぢゃないかも…でも経験は負けないよ！' },
  { id:'turn.age.final.mua1', who:'mua', e:'happy', t:'いよいよ最後の期だね。ここまで来たの、まぢすごいって' },
  { id:'turn.age.final.mua2', who:'mua', e:'crying', t:'最後の期かぁ…。あたし、もう泣きそうｗ 最後まで走ろ！' },

  { id:'turn.age.peakin.atsu1', who:'atsu', e:'excited', t:'きたな、伸びどき。今は攻めるとこだよ笑' },
  { id:'turn.age.peakin.atsu2', who:'atsu', e:'happy', t:'{mon}の体つき変わってきたわ。ここが勝負！' },
  { id:'turn.age.peakout.atsu1', who:'atsu', e:'normal', t:'山はこえたっぽいな。ここからは頭使っていこ笑' },
  { id:'turn.age.peakout.atsu2', who:'atsu', e:'normal', t:'伸びが落ちても、勝ち方は増やせるから！' },
  { id:'turn.age.final.atsu1', who:'atsu', e:'excited', t:'最後の期な。てっぺん、取りにいくしかないかー笑' },
  { id:'turn.age.final.atsu2', who:'atsu', e:'normal', t:'ここまで来たら、あとは全部出し切るだけ…！' },

  // ── ごはん ──
  { id:'turn.food.cheap.mua1', who:'mua', e:'normal', t:'今日は節約ごはん！ でも{mon}、文句言わずに食べててえらい♪' },
  { id:'turn.food.normal.mua1', who:'mua', e:'happy', t:'いつものごはん、おいしそーに食べるよね♪' },
  { id:'turn.food.feast.mua1', who:'mua', e:'excited', t:'ごちそうきたーー！ {mon}、目がハートになってるｗ' },
  { id:'turn.food.cheap.atsu1', who:'atsu', e:'normal', t:'今月は節約な。名声は大事なとこで使お笑' },
  { id:'turn.food.normal.atsu1', who:'atsu', e:'normal', t:'ふつうのでいいよ。食べてりゃ育つ笑' },
  { id:'turn.food.feast.atsu1', who:'atsu', e:'happy', t:'ごちそうじゃん。いい食いっぷりだわ笑' },

  // ── 休む・遊ぶ・修行 ──
  { id:'turn.rest.little.mua1', who:'mua', e:'troubled', t:'うーん、あんまり眠れなかったみたい…。寝返りすごかったｗ' },
  { id:'turn.rest.normal.mua1', who:'mua', e:'happy', t:'ぐっすり休めたね♪ これでまたがんばれる！' },
  { id:'turn.rest.deep.mua1', who:'mua', e:'excited', t:'めっちゃ寝た！ {mon}、体ぜんぶ回復ってくらい元気ぢゃん✨' },
  { id:'turn.play.mua1', who:'mua', e:'excited', t:'遊ぶのたのしー！ {mon}もあたしも全力ではしゃいだｗ' },
  { id:'turn.drill.learn.mua1', who:'mua', e:'excited', t:'{tech}覚えたの！？ かっこよすぎるんだけど🔥' },
  { id:'turn.drill.master.mua1', who:'mua', e:'happy', t:'{tech}、前よりずっとキレイになってる！ 練習の成果ぢゃん♪' },
  { id:'turn.rest.little.atsu1', who:'atsu', e:'troubled', t:'あんま休めなかったっぽいな。しゃあない笑' },
  { id:'turn.rest.normal.atsu1', who:'atsu', e:'normal', t:'よく休めたね。これでまた動ける笑' },
  { id:'turn.rest.deep.atsu1', who:'atsu', e:'happy', t:'がっつり寝たな。今なら何でもいけるだろ笑' },
  { id:'turn.play.atsu1', who:'atsu', e:'happy', t:'たまにはこういう日もいいよな。{mon}、楽しそうでなにより笑' },
  { id:'turn.drill.learn.atsu1', who:'atsu', e:'excited', t:'{tech}、ものにしたな。大会で見せつけよ笑' },
  { id:'turn.drill.master.atsu1', who:'atsu', e:'happy', t:'{tech}のキレ、上がってるわ。いいね！' },

  // ── 大会(ふだんの大会) ──
  { id:'turn.cup.before.mua1', who:'mua', e:'excited', t:'{cup}、いよいよだね！ {mon}、いつもどおりでいこ♪' },
  { id:'turn.cup.before.mua2', who:'mua', e:'happy', t:'あたし客席でいちばん大きい声出すから！ まかせてｗ' },
  { id:'turn.cup.win.mua1', who:'mua', e:'excited', t:'勝ったーー！！ {mon}おめでとぉー！ まぢ最高ぢゃん🤣ｗ' },
  { id:'turn.cup.win.mua2', who:'mua', e:'happy', t:'ほらね、できるって言ったでしょ♪ 今日はお祝いしよ！' },
  { id:'turn.cup.lose.mua1', who:'mua', e:'crying', t:'くやしいね…😭 でも{mon}、最後まで逃げなかったよ' },
  { id:'turn.cup.lose.mua2', who:'mua', e:'troubled', t:'今日は相手が上手だった。次はぜったい勝と！' },
  { id:'turn.cup.open.mua1', who:'mua', e:'excited', t:'ねーねー、もう一個上の大会に出られるって！ すごくない！？' },
  { id:'turn.cup.open.mua2', who:'mua', e:'wink', t:'上の星、開いたよ✨ どこまで行けるか見てみたいなー' },
  { id:'turn.cup.before.atsu1', who:'atsu', e:'normal', t:'{cup}な。準備はした。あとは暴れるだけ笑' },
  { id:'turn.cup.before.atsu2', who:'atsu', e:'excited', t:'相手が誰でも関係ない。かかってこい！' },
  { id:'turn.cup.win.atsu1', who:'atsu', e:'excited', t:'勝ったな。いいね、{mon}！ 次いこ次笑' },
  { id:'turn.cup.win.atsu2', who:'atsu', e:'happy', t:'危なげなかったな。ちゃんと強くなってるよ笑' },
  { id:'turn.cup.lose.atsu1', who:'atsu', e:'troubled', t:'残念笑 でも悔しいってことは、本気だったってことだろ…' },
  { id:'turn.cup.lose.atsu2', who:'atsu', e:'normal', t:'負けた理由はだいたい分かった。次で返そ！' },
  { id:'turn.cup.open.atsu1', who:'atsu', e:'excited', t:'上の星、開いたじゃん。行くしかないかー笑' },
  { id:'turn.cup.open.atsu2', who:'atsu', e:'happy', t:'やっぱ上が一番おもしろいからな。挑戦しよ笑' },

  // ── 引退(評価の段 4つ) ──
  { id:'turn.retire.r1.mua1', who:'mua', e:'happy', t:'おつかれさま、{mon}！ 思ったとおりにはいかなかったけど、あたしは楽しかったよ♪' },
  { id:'turn.retire.r2.mua1', who:'mua', e:'happy', t:'ちゃんと強くなったね！ {mon}といっしょの毎日、まぢ宝物ぢゃん✨' },
  { id:'turn.retire.r3.mua1', who:'mua', e:'excited', t:'こんなに立派になるなんて…！ {name}、すごい育て方したね(*ﾟ∀ﾟ)･∵ﾌﾞﾊｯ!!ｗ' },
  { id:'turn.retire.r4.mua1', who:'mua', e:'crying', t:'これ伝説ぢゃん…😭 {mon}、ここまで来てくれてありがと。あたし一生忘れない！' },
  { id:'turn.retire.r1.atsu1', who:'atsu', e:'normal', t:'おつかれ、{mon}。次はもっと上いけるよ、絶対！' },
  { id:'turn.retire.r2.atsu1', who:'atsu', e:'happy', t:'いい仕上がりじゃん。胸張っていいよ、{mon}笑' },
  { id:'turn.retire.r3.atsu1', who:'atsu', e:'excited', t:'強いわ、これ。{name}、いい育て方したな笑' },
  { id:'turn.retire.r4.atsu1', who:'atsu', e:'excited', t:'てっぺんの景色、見せてもらったわ。{mon}、最高だよ…！' },

  // ── けが・病気・家出 ──
  { id:'turn.cond.injury.in.mua1', who:'mua', e:'crying', t:'{mon}、足ひねっちゃった…😭 しばらくは休もうね' },
  { id:'turn.cond.injury.out.mua1', who:'mua', e:'happy', t:'もう走れるって！ よかったぁ ε-(´∀｀*)ﾎｯ' },
  { id:'turn.cond.sick.in.mua1', who:'mua', e:'troubled', t:'おでこ熱い…。{mon}、今日はあったかくして寝てよ？' },
  { id:'turn.cond.sick.out.mua1', who:'mua', e:'happy', t:'熱下がった！ ごはんもちゃんと食べたよ♪' },
  { id:'turn.cond.runaway.in.mua1', who:'mua', e:'crying', t:'{mon}がいない…！ 部屋が空っぽなんだけど😭' },
  { id:'turn.cond.runaway.out.mua1', who:'mua', e:'crying', t:'おかえり{mon}！ もー、心配したんだからね(｡･ω･)ﾉﾞ ｵｶｴﾘ♪' },
  { id:'turn.cond.injury.in.atsu1', who:'atsu', e:'troubled', t:'けがしたか…。今は治すことだけ考えよ…' },
  { id:'turn.cond.injury.out.atsu1', who:'atsu', e:'happy', t:'もう平気そうだな。取り返していこ笑' },
  { id:'turn.cond.sick.in.atsu1', who:'atsu', e:'troubled', t:'具合悪そうだな。今日は寝かせとこ…' },
  { id:'turn.cond.sick.out.atsu1', who:'atsu', e:'normal', t:'治ったな。よし、ぼちぼち再開しよ笑' },
  { id:'turn.cond.runaway.in.atsu1', who:'atsu', e:'troubled', t:'{mon}が戻ってないな…。詰めすぎたかもしれない…' },
  { id:'turn.cond.runaway.out.atsu1', who:'atsu', e:'normal', t:'おかえり。…まぁ、帰ってきたならそれでいいよ笑' },

  // ── ようす(サボりグセ・うつ病)と通院 ──
  { id:'turn.mood.sabori.mua1', who:'mua', e:'troubled', t:'最近{mon}、サボりがちだよね…。一回病院で診てもらお？' },
  { id:'turn.mood.utsu.mua1', who:'mua', e:'troubled', t:'{mon}、元気ないまんまだね…。病院で診てもらおっか' },
  { id:'turn.clinic.cured.mua1', who:'mua', e:'happy', t:'先生、もう大丈夫だって！ よかったね{mon}✨' },
  { id:'turn.clinic.again.mua1', who:'mua', e:'normal', t:'まだ少しかかるみたい。次でちゃんと治るって！' },
  { id:'turn.mood.sabori.atsu1', who:'atsu', e:'normal', t:'最近サボり多いな。一回病院行っとこ笑' },
  { id:'turn.mood.utsu.atsu1', who:'atsu', e:'troubled', t:'{mon}、表情くもってるな。病院、付きそうよ…' },
  { id:'turn.clinic.cured.atsu1', who:'atsu', e:'happy', t:'もう大丈夫だってさ。よかったな、{mon}笑' },
  { id:'turn.clinic.again.atsu1', who:'atsu', e:'normal', t:'もう1回来れば治るってさ。焦らずいこ！' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_TURN };
