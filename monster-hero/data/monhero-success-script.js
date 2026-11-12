// モンヒロサクセスの台本(まとめ)。★このファイルは tools/success/success-script-bundle.js が作る。手で直さない
// 正本: docs/progress/player-raise/script/*.js。育成の画面を開いたときにだけ読む(index.html では読まない)
(function (root) {
  'use strict';
  const out = {};
  // ---- turn.js ----
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
  out.turn = MONSUC_SCRIPT_TURN;
  // ---- turn-bond12.js ----
// モンヒロサクセス 台本 第2弾: ターンごとのことばの、みゅあ 仲良し度 Lv1・2 版(ていねい語)
// みゅあは Lv1・2 でていねい語(です・ます)、Lv3 から turn.js のくだけた口調になる(docs/spec/ASSISTANT_MUA_VOICE.md 8・assistants.js と同じ決まり)。
// id は turn.js のみゅあの行の id の最後に b を付けたもの。場面・表情・差しこみは元の行と同じ。形は README.md。
// 出し方: 仲良し度が Lv1・2 の人には、この行(bond:[1,2])を元の行の代わりに出す。
const MONSUC_SCRIPT_TURN_BOND12 = Object.freeze([
  { id:'turn.start.great.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{mon}、今日はすごく調子がいいみたいです✨ 目がキラキラしてますよ！' },
  { id:'turn.start.great.mua2b', who:'mua', e:'happy', bond:[1,2], t:'見てください、{mon}のしっぽがブンブンです！ 今日はなんでもできそうですね' },
  { id:'turn.start.good.mua1b', who:'mua', e:'happy', bond:[1,2], t:'{mon}、いい感じに元気ですよ♪ 今月もいっしょにがんばりましょう！' },
  { id:'turn.start.good.mua2b', who:'mua', e:'wink', bond:[1,2], t:'ごはんもぺろっと食べました。調子よさそうです👍 {name}、今日は何をしますか？' },
  { id:'turn.start.normal.mua1b', who:'mua', e:'normal', bond:[1,2], t:'{mon}はいつもどおりみたいです。ふつうがいちばんですね！' },
  { id:'turn.start.normal.mua2b', who:'mua', e:'normal', bond:[1,2], t:'いつもと変わらない感じです。今月はどうしますか？' },
  { id:'turn.start.tired.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'{mon}、ちょっとあくびが多いかもしれません…。無理しすぎないでいきましょう' },
  { id:'turn.start.tired.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'足どりが少し重そうです💦 そろそろ休ませてあげてもいいかもしれません' },
  { id:'turn.start.worn.mua1b', who:'mua', e:'crying', bond:[1,2], t:'えっ、{mon}がぐったりしています！ 今日は休みましょう！' },
  { id:'turn.start.worn.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'{name}、{mon}はもう限界みたいです…。このまま訓練するのはあぶないと思います' },
  { id:'turn.start.stress.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'{mon}、なんだかムスッとしています…。たまには思いきり遊びませんか？' },
  { id:'turn.start.stress.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'最近ため息が多いの、気づきましたか？ 気分転換しましょう！' },
  { id:'turn.result.great.mua1b', who:'mua', e:'excited', bond:[1,2], t:'えっ、すごいです(๑°ロ°๑)‼️ 大成功です！ {mon}、天才かもしれません！' },
  { id:'turn.result.great.mua2b', who:'mua', e:'excited', bond:[1,2], t:'今の、完璧でした✨ 見てましたか！？' },
  { id:'turn.result.ok.mua1b', who:'mua', e:'happy', bond:[1,2], t:'うんうん、ちゃんとできましたね♪ えらいです！' },
  { id:'turn.result.ok.mua2b', who:'mua', e:'happy', bond:[1,2], t:'いい感じです！ コツコツが大事ですよね👍' },
  { id:'turn.result.fail.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'今日はうまくいきませんでしたね…。次はきっと大丈夫です！' },
  { id:'turn.result.fail.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'ちょっと疲れていたのかもしれません💦 そういう日もありますよ' },
  { id:'turn.result.slack.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'あれ、{mon}はどこに…？ 木陰で寝ちゃってます！' },
  { id:'turn.result.slack.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'途中で遊びはじめちゃいました…。甘やかしすぎでしょうか' },
  { id:'turn.result.tag.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{cheer}といっしょだと息ぴったりです！ 友情タッグですよ✨' },
  { id:'turn.result.tag.mua2b', who:'mua', e:'happy', bond:[1,2], t:'みんなで声をかけ合っていて、見ているだけでうれしいです♪' },
  { id:'turn.gather.mua1b', who:'mua', e:'excited', bond:[1,2], t:'今月は{train}にみんな集まっていますよ！ チャンスです✨' },
  { id:'turn.gather.mua2b', who:'mua', e:'happy', bond:[1,2], t:'{train}、とってもにぎやかです！ みんなでやったら楽しそうですね' },
  { id:'turn.gather.mua3b', who:'mua', e:'wink', bond:[1,2], t:'{name}、{train}にこんなに来ています！ 行ってみませんか？' },
  { id:'turn.praise.fit.mua1b', who:'mua', e:'happy', bond:[1,2], t:'褒められて、{mon}うれしそうです♪ 今のはいい判断でした！' },
  { id:'turn.praise.fit.mua2b', who:'mua', e:'excited', bond:[1,2], t:'見てください、しっぽが止まりません！ がんばりましたもんね' },
  { id:'turn.praise.miss.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'あれ、{mon}がちょっと調子にのっちゃったかもしれません' },
  { id:'turn.praise.miss.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'うーん、今のは褒めるところではなかったかもしれません…' },
  { id:'turn.scold.fit.mua1b', who:'mua', e:'normal', bond:[1,2], t:'{mon}、ちゃんと分かったみたいです。次は大丈夫そうですね！' },
  { id:'turn.scold.fit.mua2b', who:'mua', e:'happy', bond:[1,2], t:'しゅんとしていましたけど、目はやる気になっていますよ♪' },
  { id:'turn.scold.miss.mua1b', who:'mua', e:'crying', bond:[1,2], t:'えっ、{mon}はがんばっていたのに…。かわいそうです😭' },
  { id:'turn.scold.miss.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'今のはちょっと厳しすぎたかもしれません…。あとでなでてあげましょう' },
  { id:'turn.age.peakin.mua1b', who:'mua', e:'excited', bond:[1,2], t:'なんだか{mon}、ひと回り大きくなっていませんか！？ 今が伸びどきかもしれません✨' },
  { id:'turn.age.peakin.mua2b', who:'mua', e:'happy', bond:[1,2], t:'動きがキレキレです！ いちばんいい時期が来ました！' },
  { id:'turn.age.peakout.mua1b', who:'mua', e:'normal', bond:[1,2], t:'{mon}、ちょっと落ち着いてきましたね。ここからは無理なくいきましょう' },
  { id:'turn.age.peakout.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'前ほどぐんぐん伸びる感じではないかもしれません…。でも経験は負けませんよ！' },
  { id:'turn.age.final.mua1b', who:'mua', e:'happy', bond:[1,2], t:'いよいよ最後の期ですね。ここまで来られたの、本当にすごいです' },
  { id:'turn.age.final.mua2b', who:'mua', e:'crying', bond:[1,2], t:'最後の期ですね…。あたし、もう泣きそうです。最後まで走りましょう！' },
  { id:'turn.food.cheap.mua1b', who:'mua', e:'normal', bond:[1,2], t:'今日は節約ごはんです！ でも{mon}、文句を言わずに食べていてえらいです♪' },
  { id:'turn.food.normal.mua1b', who:'mua', e:'happy', bond:[1,2], t:'いつものごはん、おいしそうに食べますよね♪' },
  { id:'turn.food.feast.mua1b', who:'mua', e:'excited', bond:[1,2], t:'ごちそうです！ {mon}の目がハートになってます✨' },
  { id:'turn.rest.little.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'うーん、あんまり眠れなかったみたいです…。寝返りがすごかったです' },
  { id:'turn.rest.normal.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ぐっすり休めましたね♪ これでまたがんばれます！' },
  { id:'turn.rest.deep.mua1b', who:'mua', e:'excited', bond:[1,2], t:'たくさん寝ました！ {mon}、すっかり元気になりましたよ✨' },
  { id:'turn.play.mua1b', who:'mua', e:'excited', bond:[1,2], t:'遊ぶの、楽しかったです！ {mon}もあたしも全力ではしゃいじゃいました' },
  { id:'turn.drill.learn.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{tech}を覚えたんですか！？ かっこいいです🔥' },
  { id:'turn.drill.master.mua1b', who:'mua', e:'happy', bond:[1,2], t:'{tech}、前よりずっとキレイになってます！ 練習の成果ですね♪' },
  { id:'turn.cup.before.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{cup}、いよいよですね！ {mon}、いつもどおりでいきましょう♪' },
  { id:'turn.cup.before.mua2b', who:'mua', e:'happy', bond:[1,2], t:'あたし、客席でいちばん大きい声を出しますね！ まかせてください！' },
  { id:'turn.cup.win.mua1b', who:'mua', e:'excited', bond:[1,2], t:'勝ちました！！ {mon}、おめでとうございます！ 最高です🤣' },
  { id:'turn.cup.win.mua2b', who:'mua', e:'happy', bond:[1,2], t:'ほら、できるって言ったでしょう？ 今日はお祝いしましょう♪' },
  { id:'turn.cup.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'くやしいですね…😭 でも{mon}、最後まで逃げませんでしたよ' },
  { id:'turn.cup.lose.mua2b', who:'mua', e:'troubled', bond:[1,2], t:'今日は相手が上手でした。次はぜったい勝ちましょう！' },
  { id:'turn.cup.open.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{name}、もう一つ上の大会に出られるそうです！ すごいです！' },
  { id:'turn.cup.open.mua2b', who:'mua', e:'wink', bond:[1,2], t:'上の星が開きましたよ✨ どこまで行けるか見てみたいです' },
  { id:'turn.retire.r1.mua1b', who:'mua', e:'happy', bond:[1,2], t:'おつかれさまでした、{mon}！ 思ったとおりにはいきませんでしたけど、あたしは楽しかったです♪' },
  { id:'turn.retire.r2.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ちゃんと強くなりましたね！ {mon}といっしょの毎日は、あたしの宝物です✨' },
  { id:'turn.retire.r3.mua1b', who:'mua', e:'excited', bond:[1,2], t:'こんなに立派になるなんて…！ {name}、すごい育て方をしましたね！' },
  { id:'turn.retire.r4.mua1b', who:'mua', e:'crying', bond:[1,2], t:'これは伝説です…😭 {mon}、ここまで来てくれてありがとう。あたし、一生忘れません！' },
  { id:'turn.cond.injury.in.mua1b', who:'mua', e:'crying', bond:[1,2], t:'{mon}が足をひねっちゃいました…😭 しばらくは休みましょうね' },
  { id:'turn.cond.injury.out.mua1b', who:'mua', e:'happy', bond:[1,2], t:'もう走れるそうです！ よかったです ε-(´∀｀*)ﾎｯ' },
  { id:'turn.cond.sick.in.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'おでこが熱いです…。{mon}、今日はあったかくして寝ましょうね' },
  { id:'turn.cond.sick.out.mua1b', who:'mua', e:'happy', bond:[1,2], t:'熱が下がりました！ ごはんもちゃんと食べましたよ♪' },
  { id:'turn.cond.runaway.in.mua1b', who:'mua', e:'crying', bond:[1,2], t:'{mon}がいません…！ 部屋が空っぽです😭' },
  { id:'turn.cond.runaway.out.mua1b', who:'mua', e:'crying', bond:[1,2], t:'おかえりなさい、{mon}！ もう、心配したんですよ' },
  { id:'turn.mood.sabori.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'最近{mon}、サボりがちですね…。一度、病院で診てもらいましょう' },
  { id:'turn.mood.utsu.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'{mon}、元気がないままですね…。病院で診てもらいましょうか' },
  { id:'turn.clinic.cured.mua1b', who:'mua', e:'happy', bond:[1,2], t:'先生が、もう大丈夫だそうです！ よかったですね、{mon}✨' },
  { id:'turn.clinic.again.mua1b', who:'mua', e:'normal', bond:[1,2], t:'まだ少しかかるみたいです。次でちゃんと治るそうですよ！' },
]);
  out.turnBond12 = MONSUC_SCRIPT_TURN_BOND12;
  // ---- scenario.js ----
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
  { id:'scn.mua.ep2.mua2', who:'mua', e:'crying', t:'まぢごめん…あたし、楽しいとつい止まんなくなっちゃって' },
  { id:'scn.mua.ep2.mua3', who:'mua', e:'troubled', t:'{name}、この後どうしよ…？' },
  { id:'scn.mua.ep2.choice.a', who:'choice', c:'a', t:'今日はもう休もう' },
  { id:'scn.mua.ep2.choice.b', who:'choice', c:'b', t:'もう1本だけやろう' },
  { id:'scn.mua.ep2.a.mua1', who:'mua', e:'happy', c:'a', t:'うん、そうする！ {mon}、今日はいっしょにゴロゴロしよ(｡ ˘-˘)' },
  { id:'scn.mua.ep2.a.mua2', who:'mua', e:'wink', c:'a', t:'{name}が止めてくれてよかった。あたし、いいコンビになれそうかもｗ' },
  { id:'scn.mua.ep2.b.mua1', who:'mua', e:'excited', c:'b', t:'よーし、ラスト1本！ {mon}、いけるとこまでいこ！' },
  { id:'scn.mua.ep2.b.mua2', who:'mua', e:'troubled', c:'b', t:'…やりきったけど、明日はちゃんと休ませてあげよーね💦' },

  // ── 3話「手作りのお守り」(ミドル期・親密度50〜。ここで4話が分かれる) ──
  { id:'scn.mua.ep3.narr1', who:'narr', t:'{cup}の前の日。みゅあが小さな布の袋を差し出してきた。' },
  { id:'scn.mua.ep3.mua1', who:'mua', e:'happy', t:'じゃーん、手作りのお守り！ 夜なべしちゃったｗ' },
  { id:'scn.mua.ep3.narr2', who:'narr', t:'渡すみゅあの手が、少しふるえている。' },
  { id:'scn.mua.ep3.mua2', who:'mua', e:'troubled', t:'…あれ、なんであたしがいちばん緊張してんだろ。おかしいよねｗ' },
  { id:'scn.mua.ep3.mua3', who:'mua', e:'troubled', t:'明日、ちゃんと声出せるかな…' },
  { id:'scn.mua.ep3.choice.a', who:'choice', c:'a', t:'みんなで深呼吸しよう' },
  { id:'scn.mua.ep3.choice.b', who:'choice', c:'b', t:'お守り、ありがたくもらうね' },
  { id:'scn.mua.ep3.a.narr1', who:'narr', c:'a', t:'{name}とみゅあと{mon}、3人で大きく息を吸って、ゆっくり吐いた。' },
  { id:'scn.mua.ep3.a.mua1', who:'mua', e:'happy', c:'a', t:'…うん、落ち着いた ε-(´∀｀*)ﾎｯ 明日はあたしの声、ぜったい届けるから！' },
  { id:'scn.mua.ep3.b.mua1', who:'mua', e:'happy', c:'b', t:'えへへ、大事にしてね！ …あたしもがんばって落ち着かなきゃ💦' },

  // ── シナリオの大会: {cup}(3話の翌月) ──
  { id:'scn.mua.cup1.before.mua1', who:'mua', e:'excited', t:'{mon}、お守り持った？ よーし、いつもの{mon}でいこ！' },
  { id:'scn.mua.cup1.win.mua1', who:'mua', e:'excited', t:'勝ったぁー！ お守り効いたぢゃん✨ …いや、{mon}が強いんだよね！' },
  { id:'scn.mua.cup1.lose.mua1', who:'mua', e:'crying', t:'くやしいね😭 でもお守りはまだ持っててね。次こそだよ！' },

  // ── 4話「みんなの声」(プロ期・親密度70〜。3話で深呼吸=いい結末 / お守りだけ=ほろ苦い結末) ──
  { id:'scn.mua.ep4.narr1', who:'narr', t:'プロ期の大舞台。客席はぎっしり埋まって、声がかき消されそうなほどにぎやかだ。' },
  { id:'scn.mua.ep4.mua1', who:'mua', e:'troubled', t:'うわ、人多すぎ…。あたしの声、ここまで届くかな' },
  { id:'scn.mua.ep4.good.narr1', who:'narr', end:'good', t:'みゅあが、あの日と同じように大きく息を吸った。' },
  { id:'scn.mua.ep4.good.mua1', who:'mua', e:'excited', end:'good', t:'{mon}ーーっ！ いっけぇーーー！！' },
  { id:'scn.mua.ep4.good.narr2', who:'narr', end:'good', t:'その声は、たしかに{mon}に届いた。ふり返った{mon}の目に、もう迷いはない。' },
  { id:'scn.mua.ep4.good.mua2', who:'mua', e:'crying', end:'good', t:'届いた…まぢで届いたよ😭 {name}、あたしたち、最高のチームぢゃん！' },
  { id:'scn.mua.ep4.bitter.narr1', who:'narr', end:'bitter', t:'みゅあの声は歓声にのまれた。それでも{mon}は、お守りを握って前を向いた。' },
  { id:'scn.mua.ep4.bitter.mua1', who:'mua', e:'troubled', end:'bitter', t:'…届かなかったかも。でも{mon}、ちゃんと戦ってた' },
  { id:'scn.mua.ep4.bitter.mua2', who:'mua', e:'happy', end:'bitter', t:'見てた人たち、みんな{mon}のファンになっちゃったよ！ それはそれで最高ぢゃんｗ' },
  // シナリオの大会: 4話の大舞台
  { id:'scn.mua.cup2.before.mua1', who:'mua', e:'excited', t:'いよいよ大舞台！ {mon}、楽しんだもん勝ちだよ✨' },
  { id:'scn.mua.cup2.win.mua1', who:'mua', e:'excited', t:'優勝ーー！！ {mon}、世界一だよ(っ`･ω･´)っﾌﾚｰｯ!ﾌﾚｰｯ!' },
  { id:'scn.mua.cup2.lose.mua1', who:'mua', e:'crying', t:'あとちょっとだったね…。でも今日の{mon}、いちばんかっこよかった' },

  // ── 特別な1話「ここまで来たぢゃん」(最後の期・仲良し度Lv5〜・4話がいい結末) ──
  { id:'scn.mua.sp.narr1', who:'narr', t:'最後の期のある夕方。みゅあに誘われて、{mon}と町をゆっくり一周した。' },
  { id:'scn.mua.sp.mua1', who:'mua', e:'happy', t:'ここ、はじめて{mon}の得意を探しに来たとこ。覚えてる？' },
  { id:'scn.mua.sp.narr2', who:'narr', t:'おやつ屋さん、広場、ひなたの丘。どこにも、ここまでの思い出がある。' },
  { id:'scn.mua.sp.mua2', who:'mua', e:'crying', t:'あの日はちっちゃかったのに…ここまで来たぢゃん😭' },
  { id:'scn.mua.sp.mua3', who:'mua', e:'happy', t:'{name}、{mon}、ありがと。あたし、このチームでほんとによかった♪' },
  { id:'scn.mua.sp.retire.mua1', who:'mua', e:'crying', t:'最後にいっしょに町を回れて、まぢうれしかった。{mon}、ずっと大好きだよ！' },

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
  { id:'scn.atsu.ep2.a.atsu1', who:'atsu', e:'happy', c:'a', t:'おけおけー笑 じゃあ今日は頭の訓練な！' },
  { id:'scn.atsu.ep2.b.atsu1', who:'atsu', e:'excited', c:'b', t:'それもアリ。{mon}の{stat}なら真っ向から行けるだろ笑' },
  // シナリオの大会: 2話の{cup}
  { id:'scn.atsu.cup1.before.atsu1', who:'atsu', e:'normal', t:'格上だろうが関係ない。やることやってきたから！' },
  { id:'scn.atsu.cup1.win.atsu1', who:'atsu', e:'excited', t:'勝ったな。準備は裏切らないんだよ笑' },
  { id:'scn.atsu.cup1.lose.atsu1', who:'atsu', e:'troubled', t:'残念笑 でも差はだいぶ縮まってた。次は取れる！' },

  // ── 3話「くやしい負けの話」(ミドル期・親密度50〜。ここで4話が分かれる) ──
  { id:'scn.atsu.ep3.narr1', who:'narr', t:'訓練のあと、あつが珍しく昔の話を始めた。' },
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
  out.scenario = MONSUC_SCRIPT_SCENARIO;
  // ---- cheer.js ----
// モンヒロサクセス 台本 第1弾: 編成の子との訓練イベント(連続イベント3話)
// ASSIST.md §4b。話の筋はタイプ(5つ)ごとの型に、その子の名前・得意な能力・技を差しこむ。ベースモンは短い3話(3話目は技の伝授なし)。
// 形は README.md。
//   {cheer} … 編成の子の名前(フレンドから借りた子は「◯◯さんの◯◯」を画面側で差しこむ)
//   {stat}  … その子の得意な能力 / {tech} … その子が教えてくれる技 / {mon} … 育てているモンスター
//   who     … narr(地の文) / choice(選択肢の札) / mua / atsu(シナリオの助手のひとこと。選んだ助手の行だけ出す)
//   場面のid … cheer.<タイプ>.ep<話>(タイプは attacker / tank / supporter / healer / shadow / base)
// 選択肢の中身(ASSIST.md §4b): 1話 a=張り切る・b=ていねいに / 2話 a=思いきり・b=のんびり / 3話 a=教わる・b=自分のやり方で
const MONSUC_SCRIPT_CHEER = Object.freeze([
  // ═══════════ アタッカー ═══════════
  { id:'cheer.attacker.ep1.narr1', who:'narr', t:'訓練場に{cheer}がやってきた。拳をぶつけ合う音が、あたりに響く。' },
  { id:'cheer.attacker.ep1.narr2', who:'narr', t:'{cheer}が、{mon}に「打ちこんでこい」と構えてみせた。' },
  { id:'cheer.attacker.ep1.choice.a', who:'choice', c:'a', t:'全力で打ちこむ' },
  { id:'cheer.attacker.ep1.choice.b', who:'choice', c:'b', t:'型をていねいに確かめる' },
  { id:'cheer.attacker.ep1.mua1', who:'mua', e:'excited', t:'{cheer}、気合い入りすぎｗ 練習相手にしてもらお！' },
  { id:'cheer.attacker.ep1.atsu1', who:'atsu', e:'happy', t:'{cheer}が相手してくれるってさ。遠慮すんなよ笑' },
  { id:'cheer.attacker.ep2.narr1', who:'narr', t:'{cheer}に連れられて、町はずれの岩場へ。ひびだらけの大岩が並んでいる。' },
  { id:'cheer.attacker.ep2.narr2', who:'narr', t:'どうやら、ここが{cheer}の秘密の練習場らしい。' },
  { id:'cheer.attacker.ep2.choice.a', who:'choice', c:'a', t:'思いきり岩を打つ' },
  { id:'cheer.attacker.ep2.choice.b', who:'choice', c:'b', t:'岩に腰かけてひと休み' },
  { id:'cheer.attacker.ep2.mua1', who:'mua', e:'surprise', t:'この岩のひび、ぜんぶ{cheer}がやったの！？ すご(๑°ロ°๑)‼️' },
  { id:'cheer.attacker.ep2.atsu1', who:'atsu', e:'excited', t:'ここで鍛えてたのか。そりゃ強いわけだ笑' },
  { id:'cheer.attacker.ep3.narr1', who:'narr', t:'{cheer}が静かに構えた。いつもの荒々しさが消えている。' },
  { id:'cheer.attacker.ep3.narr2', who:'narr', t:'ひと呼吸のあと、{tech}。風を切る一撃が、{mon}の目に焼きついた。' },
  { id:'cheer.attacker.ep3.choice.a', who:'choice', c:'a', t:'{tech}を教わる' },
  { id:'cheer.attacker.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.attacker.ep3.mua1', who:'mua', e:'excited', t:'今の見た！？ {cheer}、とっておき見せてくれたんだよ✨' },
  { id:'cheer.attacker.ep3.atsu1', who:'atsu', e:'normal', t:'あれは{cheer}の全部だな。受け取るかどうかは{mon}しだい…' },

  // ═══════════ タンク ═══════════
  { id:'cheer.tank.ep1.narr1', who:'narr', t:'{cheer}がどっしりと訓練場の真ん中に立った。{mon}がぶつかっても、びくともしない。' },
  { id:'cheer.tank.ep1.narr2', who:'narr', t:'「もっと来い」とでも言うように、{cheer}は胸を張っている。' },
  { id:'cheer.tank.ep1.choice.a', who:'choice', c:'a', t:'何度でもぶつかる' },
  { id:'cheer.tank.ep1.choice.b', who:'choice', c:'b', t:'受け止め方をまねる' },
  { id:'cheer.tank.ep1.mua1', who:'mua', e:'happy', t:'{cheer}、壁みたいにかたいｗ 安心感すごいね！' },
  { id:'cheer.tank.ep1.atsu1', who:'atsu', e:'happy', t:'{cheer}を動かせたら一人前だな笑' },
  { id:'cheer.tank.ep2.narr1', who:'narr', t:'{cheer}に案内されたのは、滝のそばの川原。冷たい水しぶきが降りそそぐ。' },
  { id:'cheer.tank.ep2.narr2', who:'narr', t:'{cheer}は毎朝ここで、滝に打たれて体を鍛えているらしい。' },
  { id:'cheer.tank.ep2.choice.a', who:'choice', c:'a', t:'いっしょに滝に打たれる' },
  { id:'cheer.tank.ep2.choice.b', who:'choice', c:'b', t:'川原で日なたぼっこ' },
  { id:'cheer.tank.ep2.mua1', who:'mua', e:'surprise', t:'えっ、この滝に毎朝！？ 冷たすぎて無理ぢゃんｗ' },
  { id:'cheer.tank.ep2.atsu1', who:'atsu', e:'normal', t:'地味なことを毎日続けるのが一番きついんだよ。尊敬するわ笑' },
  { id:'cheer.tank.ep3.narr1', who:'narr', t:'{cheer}が{mon}の前に立ちはだかり、ゆっくりと構えをとった。' },
  { id:'cheer.tank.ep3.narr2', who:'narr', t:'どんな攻撃も受け止める、{cheer}の{tech}。その背中は大きかった。' },
  { id:'cheer.tank.ep3.choice.a', who:'choice', c:'a', t:'{tech}を教わる' },
  { id:'cheer.tank.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.tank.ep3.mua1', who:'mua', e:'crying', t:'{cheer}の背中、なんかかっこよすぎて泣きそうｗ' },
  { id:'cheer.tank.ep3.atsu1', who:'atsu', e:'normal', t:'仲間を守る技だな。いいもん見せてもらった…' },

  // ═══════════ サポーター ═══════════
  { id:'cheer.supporter.ep1.narr1', who:'narr', t:'{cheer}が、訓練の道具をきちんと並べて待っていた。' },
  { id:'cheer.supporter.ep1.narr2', who:'narr', t:'{mon}の動きに合わせて、次の道具をすっと差し出してくれる。' },
  { id:'cheer.supporter.ep1.choice.a', who:'choice', c:'a', t:'どんどん次へ進む' },
  { id:'cheer.supporter.ep1.choice.b', who:'choice', c:'b', t:'ひとつずつ確かめる' },
  { id:'cheer.supporter.ep1.mua1', who:'mua', e:'happy', t:'{cheer}、気がききすぎる！ あたしも見習わなきゃ！' },
  { id:'cheer.supporter.ep1.atsu1', who:'atsu', e:'happy', t:'段取りがいいな、{cheer}。こういう仲間がいると楽だわ笑' },
  { id:'cheer.supporter.ep2.narr1', who:'narr', t:'{cheer}の秘密の場所は、図書室の奥の小さな部屋だった。' },
  { id:'cheer.supporter.ep2.narr2', who:'narr', t:'机の上には、仲間の動きを書きとめたノートが山のように積まれている。' },
  { id:'cheer.supporter.ep2.choice.a', who:'choice', c:'a', t:'ノートで猛勉強する' },
  { id:'cheer.supporter.ep2.choice.b', who:'choice', c:'b', t:'お茶を飲んでのんびり' },
  { id:'cheer.supporter.ep2.mua1', who:'mua', e:'surprise', t:'えっ、みんなのことこんなに見てたの！？ まぢ尊敬…' },
  { id:'cheer.supporter.ep2.atsu1', who:'atsu', e:'normal', t:'準備の鬼だな。ちょっと俺と気が合うかも笑' },
  { id:'cheer.supporter.ep3.narr1', who:'narr', t:'{cheer}がノートを閉じて、{mon}の横に並んだ。' },
  { id:'cheer.supporter.ep3.narr2', who:'narr', t:'仲間の力を引き出す{tech}。{cheer}が、ずっと磨いてきた技だ。' },
  { id:'cheer.supporter.ep3.choice.a', who:'choice', c:'a', t:'{tech}を教わる' },
  { id:'cheer.supporter.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.supporter.ep3.mua1', who:'mua', e:'happy', t:'{cheer}、{mon}のこと認めてくれたんだね♪' },
  { id:'cheer.supporter.ep3.atsu1', who:'atsu', e:'happy', t:'教える側が一番うれしそうだな笑' },

  // ═══════════ ヒーラー ═══════════
  { id:'cheer.healer.ep1.narr1', who:'narr', t:'訓練で転んだ{mon}のそばに、{cheer}がそっと寄ってきた。' },
  { id:'cheer.healer.ep1.narr2', who:'narr', t:'すり傷に手をかざすと、あたたかい光がふわりと広がる。' },
  { id:'cheer.healer.ep1.choice.a', who:'choice', c:'a', t:'すぐ訓練にもどる' },
  { id:'cheer.healer.ep1.choice.b', who:'choice', c:'b', t:'動き方を見直す' },
  { id:'cheer.healer.ep1.mua1', who:'mua', e:'happy', t:'{cheer}やさしー…。いっしょにいるだけで元気出る♪' },
  { id:'cheer.healer.ep1.atsu1', who:'atsu', e:'normal', t:'助かるわ、{cheer}。ケガしても止まらなくていいからな笑' },
  { id:'cheer.healer.ep2.narr1', who:'narr', t:'{cheer}のお気に入りは、ひなたの丘の上の花畑だった。' },
  { id:'cheer.healer.ep2.narr2', who:'narr', t:'やわらかい風の中、{cheer}は花の香りを集めるように深呼吸している。' },
  { id:'cheer.healer.ep2.choice.a', who:'choice', c:'a', t:'丘を何度も駆け上がる' },
  { id:'cheer.healer.ep2.choice.b', who:'choice', c:'b', t:'花畑で昼寝する' },
  { id:'cheer.healer.ep2.mua1', who:'mua', e:'excited', t:'なにここ、かわいすぎる✨ あたしも毎日来たいー！' },
  { id:'cheer.healer.ep2.atsu1', who:'atsu', e:'happy', t:'いいとこ知ってんな。ここで休んだら回復早そう笑' },
  { id:'cheer.healer.ep3.narr1', who:'narr', t:'{cheer}が{mon}の手をとり、目を閉じた。' },
  { id:'cheer.healer.ep3.narr2', who:'narr', t:'仲間を立ち上がらせる{tech}。その光が、{mon}の体にしみこんでいく。' },
  { id:'cheer.healer.ep3.choice.a', who:'choice', c:'a', t:'{tech}を教わる' },
  { id:'cheer.healer.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.healer.ep3.mua1', who:'mua', e:'crying', t:'こんなにあったかい技、あるんだね…(〃´o｀)ﾌｩ…' },
  { id:'cheer.healer.ep3.atsu1', who:'atsu', e:'normal', t:'こういう技を持ってる奴が、最後に一番強いんだよ…' },

  // ═══════════ シャドウ ═══════════
  { id:'cheer.shadow.ep1.narr1', who:'narr', t:'ふと気づくと、{cheer}が{mon}の真後ろに立っていた。いつの間に…？' },
  { id:'cheer.shadow.ep1.narr2', who:'narr', t:'{cheer}はするりと影にまぎれ、{mon}に「つかまえてみろ」と合図する。' },
  { id:'cheer.shadow.ep1.choice.a', who:'choice', c:'a', t:'全力で追いかける' },
  { id:'cheer.shadow.ep1.choice.b', who:'choice', c:'b', t:'足音をよく聞く' },
  { id:'cheer.shadow.ep1.mua1', who:'mua', e:'surprise', t:'わっ、びっくりしたぁ！ {cheer}、気配なさすぎｗ' },
  { id:'cheer.shadow.ep1.atsu1', who:'atsu', e:'happy', t:'やるじゃん{cheer}。俺も一瞬見失ったわ笑' },
  { id:'cheer.shadow.ep2.narr1', who:'narr', t:'夜。{cheer}に呼ばれて行った先は、月明かりだけが差す古い路地裏だった。' },
  { id:'cheer.shadow.ep2.narr2', who:'narr', t:'壁から壁へ、音もなく跳びうつる。これが{cheer}の練習らしい。' },
  { id:'cheer.shadow.ep2.choice.a', who:'choice', c:'a', t:'いっしょに跳んでみる' },
  { id:'cheer.shadow.ep2.choice.b', who:'choice', c:'b', t:'月を見ながらひと休み' },
  { id:'cheer.shadow.ep2.mua1', who:'mua', e:'troubled', t:'ちょ、ここ暗くてこわいんだけど💦 {cheer}、置いてかないでね！？' },
  { id:'cheer.shadow.ep2.atsu1', who:'atsu', e:'excited', t:'夜の練習か。いいね、こういうの嫌いじゃない笑' },
  { id:'cheer.shadow.ep3.narr1', who:'narr', t:'{cheer}が影の中から、そっと{mon}を手まねきした。' },
  { id:'cheer.shadow.ep3.narr2', who:'narr', t:'目にもとまらぬ{tech}。{cheer}がいままで誰にも見せなかった技だ。' },
  { id:'cheer.shadow.ep3.choice.a', who:'choice', c:'a', t:'{tech}を教わる' },
  { id:'cheer.shadow.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.shadow.ep3.mua1', who:'mua', e:'excited', t:'今の、目で追えなかった…！ {cheer}かっこよすぎ🔥' },
  { id:'cheer.shadow.ep3.atsu1', who:'atsu', e:'normal', t:'秘密の技を見せたってことは、{mon}を認めたってことだよ…' },

  // ═══════════ ベースモン(短い3話・3話目は技の伝授なし) ═══════════
  { id:'cheer.base.ep1.narr1', who:'narr', t:'{cheer}が、少し照れくさそうに訓練に加わった。' },
  { id:'cheer.base.ep1.choice.a', who:'choice', c:'a', t:'いっしょに張り切る' },
  { id:'cheer.base.ep1.choice.b', who:'choice', c:'b', t:'ていねいに教え合う' },
  { id:'cheer.base.ep1.mua1', who:'mua', e:'happy', t:'{cheer}もがんばってるね♪ いっしょにいこ！' },
  { id:'cheer.base.ep1.atsu1', who:'atsu', e:'happy', t:'{cheer}、なかなか根性あるじゃん笑' },
  { id:'cheer.base.ep2.narr1', who:'narr', t:'{cheer}がこっそり教えてくれたのは、広場の裏の小さな空き地だった。' },
  { id:'cheer.base.ep2.choice.a', who:'choice', c:'a', t:'思いきり体を動かす' },
  { id:'cheer.base.ep2.choice.b', who:'choice', c:'b', t:'のんびり過ごす' },
  { id:'cheer.base.ep2.mua1', who:'mua', e:'wink', t:'ここ、あたしたちだけの秘密の場所にしよ♪' },
  { id:'cheer.base.ep2.atsu1', who:'atsu', e:'normal', t:'いい場所知ってんな。ここ使わせてもらお笑' },
  { id:'cheer.base.ep3.narr1', who:'narr', t:'{cheer}は{mon}と並んで、何度も同じ動きをくり返した。言葉はなくても、伝わるものがある。' },
  { id:'cheer.base.ep3.choice.a', who:'choice', c:'a', t:'{cheer}の動きをまねる' },
  { id:'cheer.base.ep3.choice.b', who:'choice', c:'b', t:'自分のやり方で強くなる' },
  { id:'cheer.base.ep3.mua1', who:'mua', e:'happy', t:'{cheer}、{mon}のことずっと見ててくれたんだね✨' },
  { id:'cheer.base.ep3.atsu1', who:'atsu', e:'happy', t:'いいコンビになったな。{cheer}の分まで強くなろ笑' },

  // ── 技を覚えられなかったとき(3話・どのタイプも共通) ──
  { id:'cheer.common.ep3.nolearn.narr1', who:'narr', t:'{tech}はまだ{mon}には難しかった。それでも、体の使い方はしっかり身についた。' },

  // ── 3話を見終わった子の、小さなごほうびのくじ(ASSIST.md §4b) ──
  { id:'cheer.lot.drill.narr1', who:'narr', t:'{cheer}が自主練に付き合ってくれた。' },
  { id:'cheer.lot.rest.narr1', who:'narr', t:'{cheer}といっしょに、木かげでひと休み。' },
  { id:'cheer.lot.chat.narr1', who:'narr', t:'{cheer}と、訓練のあとにのんびりおしゃべり。' },
  { id:'cheer.lot.tip.narr1', who:'narr', t:'{cheer}が、ちょっとしたコツを教えてくれた。' },
  { id:'cheer.lot.friend.narr1', who:'narr', t:'{cheer}が、うれしそうに{mon}にすり寄ってきた。' },
]);
  out.cheer = MONSUC_SCRIPT_CHEER;
  // ---- issa.js ----
// モンヒロサクセス 台本 第1弾: 大きな賭け「イッサ博士」
// EVENTS.md ⑥。博士は おちゃらけて軽いノリ・「へーきへーき」・一人称「ぼく」・ていねい語はほぼ使わない・失敗しても悪びれない・助手にいじられる。
// 形は README.md。
//   who … issa(イッサ博士) / narr(地の文) / choice(選択肢の札) / mua / atsu(シナリオの助手。かけ合いは1回に1人)
//   選択肢の記号 c … stat=ステータスアップ / cap=体力上限アップ / heal=体力回復 / loy=忠誠度アップ / pop=人気アップ / none=何もしない
//   場面のid … issa.meet.first(はじめて)/ issa.meet.won(前に成功した)/ issa.meet.lost(前に失敗した)/ issa.meet.again(同じ育成で2回目以降)
//              issa.pick.<c>(選んだとき)/ issa.ok.<c>(成功)/ issa.ng.<c>(失敗)/ issa.bye(断られた)
//              issa.tease.<助手>.<番号>(かけ合い。3行で1組)/ issa.guess.<段>.<助手>(見立て)/ issa.after.<ok|ng>.<助手>(結果のあとの助手のひとこと)
const MONSUC_SCRIPT_ISSA = Object.freeze([
  // ── 出てきたとき ──
  { id:'issa.meet.first.narr1', who:'narr', t:'町はずれの、針の止まった時計塔。扉の向こうから、白衣の青年がピースしながら飛び出してきた。' },
  { id:'issa.meet.first.issa1', who:'issa', t:'やっほー！ ぼく、イッサ博士！ そこのキミ、ちょっと強くなってみない？' },
  { id:'issa.meet.first.issa2', who:'issa', t:'この「のびのび装置」に入るだけ！ 痛くない痛くない、たぶん！' },
  { id:'issa.meet.won.issa1', who:'issa', t:'あっ、前に大成功したとこの！ ほらね、ぼくの装置ってすごいでしょ？ 今日もいっとく？' },
  { id:'issa.meet.lost.issa1', who:'issa', t:'やっほー！ …あ、前のアレ？ あれはね、装置がちょっと寝ぼけてただけ！ 今日は起きてるから！' },
  { id:'issa.meet.again.issa1', who:'issa', t:'また会ったね！ 前回のは練習！ 今回のが本番！ …ほんとほんと！' },
  { id:'issa.meet.again.issa2', who:'issa', t:'あれから装置、ちゃんと直したんだよ。ネジも1本も余ってない！ …はず！' },

  // ── すすめるとき ──
  { id:'issa.offer.issa1', who:'issa', t:'へーきへーき！ この装置、昨日はちゃんと動いたし！ …一昨日は爆発したけど' },
  { id:'issa.offer.issa2', who:'issa', t:'どれにする？ おすすめは全部！ …あ、1つだけね、1つだけ' },
  { id:'issa.offer.issa3', who:'issa', t:'つまみをひねって、ランプが光ったらスタート！ ちょっとだけガタガタするけど、気にしない気にしない！' },

  // ── 6つの選択肢 ──
  { id:'issa.choice.stat', who:'choice', c:'stat', t:'💪 ステータスアップ' },
  { id:'issa.choice.cap', who:'choice', c:'cap', t:'🔋 体力上限アップ' },
  { id:'issa.choice.heal', who:'choice', c:'heal', t:'❤️ 体力回復' },
  { id:'issa.choice.loy', who:'choice', c:'loy', t:'🤝 忠誠度アップ' },
  { id:'issa.choice.pop', who:'choice', c:'pop', t:'⭐ 人気アップ' },
  { id:'issa.choice.none', who:'choice', c:'none', t:'🙅 何もしない' },

  // ── 選んだとき ──
  { id:'issa.pick.stat.issa1', who:'issa', c:'stat', t:'おっ、いちばん派手なやつ！ わかってるねぇ！ つまみ、全開でいくよー！' },
  { id:'issa.pick.cap.issa1', who:'issa', c:'cap', t:'体力のうつわを大きくするやつね！ 青いランプ、点灯〜！' },
  { id:'issa.pick.heal.issa1', who:'issa', c:'heal', t:'お疲れのキミにはこれ！ ぽかぽかモード、いってみよー！' },
  { id:'issa.pick.loy.issa1', who:'issa', c:'loy', t:'心の距離をぐっと縮めるやつ！ ピンクのランプ、かわいいでしょ？' },
  { id:'issa.pick.pop.issa1', who:'issa', c:'pop', t:'キラキラ度アップね！ 金色のランプ、まぶしすぎて目ぇつぶって！' },

  // ── 成功したとき ──
  { id:'issa.ok.stat.issa1', who:'issa', c:'stat', t:'ほらぁ！ 言ったでしょ、へーきって！ 天才かも、ぼく！' },
  { id:'issa.ok.cap.issa1', who:'issa', c:'cap', t:'いぇーい！ 体力のうつわ、ひと回り大きくなったよ！ ぼくの白衣もひと回り大きく見えない？' },
  { id:'issa.ok.heal.issa1', who:'issa', c:'heal', t:'ぽっかぽか！ 元気いっぱいでしょ？ これはもう、ぼくに感謝だね！' },
  { id:'issa.ok.loy.issa1', who:'issa', c:'loy', t:'見て見て、{mon}がキミのほうばっか見てる！ ぼくのほうは…見てないね。うん、いいの！' },
  { id:'issa.ok.pop.issa1', who:'issa', c:'pop', t:'キラッキラ！ もうファンが並んじゃうレベル！ サインの練習しといて！' },

  // ── 失敗したとき(煙・白衣がすすける・ピースのまま固まる。重くしない) ──
  { id:'issa.ng.stat.issa1', who:'issa', c:'stat', t:'…あっれぇ？ ネジ1本あまってるな…。ま、次はいける気がする！' },
  { id:'issa.ng.cap.issa1', who:'issa', c:'cap', t:'けほっ…。あ、つまみ逆だったかも。ま、まぁ、こういう日もあるって！' },
  { id:'issa.ng.heal.issa1', who:'issa', c:'heal', t:'ぽかぽかのはずが、どんよりモードになっちゃった…。病院で診てもらえば平気！ たぶん！' },
  { id:'issa.ng.loy.issa1', who:'issa', c:'loy', t:'…ぷいってされちゃったね。あれ、ぼくのせい？ ちがうよね？ ね？' },
  { id:'issa.ng.pop.issa1', who:'issa', c:'pop', t:'キラキラのはずが、すすだらけ…。ほ、ほら、ワイルドでいいじゃん！' },

  // ── 断られたとき ──
  { id:'issa.bye.issa1', who:'issa', c:'none', t:'えー、ノリ悪いなぁ。ま、気が向いたらまた来るから〜！' },
  { id:'issa.bye.narr1', who:'narr', c:'none', t:'博士は手を振りながら、装置をずるずる引きずって帰っていった。' },
  { id:'issa.bye.issa2', who:'issa', c:'none', t:'…また来るぞ〜！ 次はもっとすごい装置になってるからね〜！' },

  // ── 助手にからかわれたとき(シナリオの助手だけ。3行で1組) ──
  { id:'issa.tease.mua1.mua1', who:'mua', e:'troubled', t:'博士、それ前も煙出てたぢゃんｗ まぢで平気なの？' },
  { id:'issa.tease.mua1.issa1', who:'issa', t:'平気平気！ たぶん！' },
  { id:'issa.tease.mua1.mua2', who:'mua', e:'happy', t:'今「たぶん」って言ったｗ' },
  { id:'issa.tease.mua2.mua1', who:'mua', e:'wink', t:'博士の白衣、すすけてんの毎回ぢゃない？ﾌﾌﾌ' },
  { id:'issa.tease.mua2.issa1', who:'issa', t:'ちょ、ひどくない!? これは研究の勲章なんだけど!?' },
  { id:'issa.tease.mua2.mua2', who:'mua', e:'happy', t:'勲章多すぎて真っ黒になっちゃうよ(´＾ω＾｀)ﾌﾞﾌｫｗ' },
  { id:'issa.tease.atsu1.atsu1', who:'atsu', e:'happy', t:'とりあえず博士、いったん落ち着こっか笑' },
  { id:'issa.tease.atsu1.issa1', who:'issa', t:'落ち着いてるって！ ほら、ピースもぶれてない！' },
  { id:'issa.tease.atsu1.atsu2', who:'atsu', e:'wink', t:'…じゃ、博士がいっちょ乗ってみる？笑' },
  { id:'issa.tease.atsu2.atsu1', who:'atsu', e:'normal', t:'ちなみに博士、その装置で成功したことあんの？笑' },
  { id:'issa.tease.atsu2.issa1', who:'issa', t:'あるよ！ …きのうの朝、トーストがいい感じに焼けた！' },
  { id:'issa.tease.atsu2.atsu2', who:'atsu', e:'happy', t:'それトースターじゃん笑' },

  // ── 助手の見立て(数字なし。選択肢ごとに出す) ──
  { id:'issa.guess.good.mua1', who:'mua', e:'happy', t:'これはいけそうな気がする！' },
  { id:'issa.guess.even.mua1', who:'mua', e:'normal', t:'うーん、五分五分ってとこかな…' },
  { id:'issa.guess.risky.mua1', who:'mua', e:'troubled', t:'これはちょっとあぶないかも💦' },
  { id:'issa.guess.good.atsu1', who:'atsu', e:'happy', t:'これはいけそう笑' },
  { id:'issa.guess.even.atsu1', who:'atsu', e:'normal', t:'五分五分だな。覚悟あるなら…' },
  { id:'issa.guess.risky.atsu1', who:'atsu', e:'troubled', t:'これはちょっとあぶない。やるなら腹くくって！' },

  // ── 結果のあとの助手のひとこと(失敗の直後は必ず声をかける) ──
  { id:'issa.after.ok.mua1', who:'mua', e:'excited', t:'うそ、ほんとに成功した！？ 博士、たまにはやるぢゃんｗ' },
  { id:'issa.after.ng.mua1', who:'mua', e:'troubled', t:'{mon}、だいじょぶ？ よしよし…今日はゆっくりしよ？' },
  { id:'issa.after.ng.mua2', who:'mua', e:'angry', t:'もー博士！ でも{mon}が笑ってるから、まあいっかｗ' },
  { id:'issa.after.ok.atsu1', who:'atsu', e:'excited', t:'まじで成功した。博士、見直したわ笑' },
  { id:'issa.after.ng.atsu1', who:'atsu', e:'troubled', t:'{mon}、平気か？ 取り返せるから気にすんな…' },
  { id:'issa.after.ng.atsu2', who:'atsu', e:'normal', t:'まぁ〜賭けだしな。しゃあない笑 ここから巻き返そ！' },
  // あつのシナリオは、受けると成功でも失敗でも🔥やる気満々(EVENTS.md ⑥の仕組み)
  { id:'issa.after.fire.atsu1', who:'atsu', e:'excited', t:'受けて立ったのはえらい。その度胸、訓練にぶつけよ笑' },
]);
  out.issa = MONSUC_SCRIPT_ISSA;
  // ---- random.js ----
// モンヒロサクセス 台本 第1弾: ふだんのランダムイベント(EVENTS.md 第1弾の約50種)
// ①ふだん16・③編成8・④育てるモンスター6・⑤期の目標と季節の行事・⑥小さな賭け2・⑦体調3・⑧大会まわり3。
// 地の文と選択肢の札は共通、助手のひとことは みゅあ・あつ(シナリオの助手の行だけ出す)。結果の数字は画面側が出す。
// 形は README.md。
//   who … narr / choice / mua / atsu
//   c   … 選択肢の記号(a / b / c)。見るだけの出来事は choice の行が無い
//   場面のid … ev.<種類>.<出来事>(種類: daily / team / self / goal / season / small / body / cup)
//   {cheer2} … けんかの相手の編成の子 / {food} … 苦手な食べ物の名前(画面側で種ごとに)
const MONSUC_SCRIPT_RANDOM = Object.freeze([
  // ═══════════ ① ふだんの出来事 ═══════════
  { id:'ev.daily.nut.narr1', who:'narr', t:'道ばたに、つやつやの木の実が落ちている。誰かの落とし物みたいだ。' },
  { id:'ev.daily.nut.mua1', who:'mua', e:'happy', t:'わ、おいしそー！ …でも誰かのかも。どうする？' },
  { id:'ev.daily.nut.atsu1', who:'atsu', e:'normal', t:'落とし物か。どうする？ 届けるのが筋だけど笑' },
  { id:'ev.daily.nut.choice.a', who:'choice', c:'a', t:'持ち主に届ける' },
  { id:'ev.daily.nut.choice.b', who:'choice', c:'b', t:'食べちゃう' },

  { id:'ev.daily.rain.narr1', who:'narr', t:'朝から大つぶの雨。訓練場は水たまりだらけだ。' },
  { id:'ev.daily.rain.mua1', who:'mua', e:'troubled', t:'雨すごー💦 今日は屋根の下でやる？ それとも…？' },
  { id:'ev.daily.rain.atsu1', who:'atsu', e:'happy', t:'雨か。こういう日に走るのも悪くないけどな笑' },
  { id:'ev.daily.rain.choice.a', who:'choice', c:'a', t:'屋根の下で軽く体を動かす' },
  { id:'ev.daily.rain.choice.b', who:'choice', c:'b', t:'雨の中を思いきり走る' },

  { id:'ev.daily.night.narr1', who:'narr', t:'夜おそく。{mon}が窓の外をじっと見ていて、なかなか寝ようとしない。' },
  { id:'ev.daily.night.mua1', who:'mua', e:'wink', t:'今日、星がめっちゃきれいなんだよね✨ ちょっとだけ見ちゃう？' },
  { id:'ev.daily.night.atsu1', who:'atsu', e:'normal', t:'寝れないのか。まぁ〜たまにはいいけど、明日に響くぞ笑' },
  { id:'ev.daily.night.choice.a', who:'choice', c:'a', t:'早く寝かせる' },
  { id:'ev.daily.night.choice.b', who:'choice', c:'b', t:'いっしょに星を見る' },

  { id:'ev.daily.kids.narr1', who:'narr', t:'広場で、町の子どもたちが{mon}を見つけて駆け寄ってきた。' },
  { id:'ev.daily.kids.mua1', who:'mua', e:'excited', t:'{mon}、人気者ぢゃん！ ちょっと遊んであげよっか♪' },
  { id:'ev.daily.kids.atsu1', who:'atsu', e:'happy', t:'ファンサービスの時間だな笑 どうする？' },
  { id:'ev.daily.kids.choice.a', who:'choice', c:'a', t:'いっしょに遊んであげる' },
  { id:'ev.daily.kids.choice.b', who:'choice', c:'b', t:'得意の技を見せる' },

  { id:'ev.daily.sweets.narr1', who:'narr', t:'おやつ屋さんの前に「新作」の札。甘いにおいがただよってくる。' },
  { id:'ev.daily.sweets.mua1', who:'mua', e:'excited', t:'新作！？ あたしも食べたいんだけどｗ 買っちゃう？' },
  { id:'ev.daily.sweets.atsu1', who:'atsu', e:'normal', t:'{mon}、よだれ出てるぞ笑 名声と相談な！' },
  { id:'ev.daily.sweets.choice.a', who:'choice', c:'a', t:'買ってあげる' },
  { id:'ev.daily.sweets.choice.b', who:'choice', c:'b', t:'今日はがまん' },

  { id:'ev.daily.book.narr1', who:'narr', t:'図書室のすみで、{mon}がほこりをかぶった古い本を見つけた。' },
  { id:'ev.daily.book.mua1', who:'mua', e:'surprise', t:'なにこれ、めっちゃ古そう！ 読めるかなー？' },
  { id:'ev.daily.book.atsu1', who:'atsu', e:'normal', t:'昔の技の本っぽいな。読んでみる？笑' },
  { id:'ev.daily.book.choice.a', who:'choice', c:'a', t:'いっしょに読む' },
  { id:'ev.daily.book.choice.b', who:'choice', c:'b', t:'枕にしてひと眠り' },

  { id:'ev.daily.chase.narr1', who:'narr', t:'ひなたの丘で、ちょうちょが{mon}の鼻先をひらひら飛んでいく。' },
  { id:'ev.daily.chase.mua1', who:'mua', e:'happy', t:'{mon}、追いかけたくてうずうずしてるｗ' },
  { id:'ev.daily.chase.atsu1', who:'atsu', e:'happy', t:'追いかけっこか。本気出す？笑' },
  { id:'ev.daily.chase.choice.a', who:'choice', c:'a', t:'本気で追いかける' },
  { id:'ev.daily.chase.choice.b', who:'choice', c:'b', t:'のんびり眺める' },

  { id:'ev.daily.juggler.narr1', who:'narr', t:'広場で大道芸人が、玉をいくつも空に投げてはつかまえている。' },
  { id:'ev.daily.juggler.mua1', who:'mua', e:'excited', t:'すごーい！ {mon}もやってみたら？' },
  { id:'ev.daily.juggler.atsu1', who:'atsu', e:'normal', t:'あの手元、見てるだけでも勉強になるな笑' },
  { id:'ev.daily.juggler.choice.a', who:'choice', c:'a', t:'まねしてみる' },
  { id:'ev.daily.juggler.choice.b', who:'choice', c:'b', t:'見るだけにする' },

  { id:'ev.daily.arm.narr1', who:'narr', t:'力自慢のモンスターが「勝負しろ」と{mon}の前に立ちふさがった。' },
  { id:'ev.daily.arm.mua1', who:'mua', e:'troubled', t:'えっ、急に！？ 相手おっきいけど、だいじょぶかな💦' },
  { id:'ev.daily.arm.atsu1', who:'atsu', e:'excited', t:'力くらべか。上等、受けて立つ？笑' },
  { id:'ev.daily.arm.choice.a', who:'choice', c:'a', t:'勝負を受ける' },
  { id:'ev.daily.arm.choice.b', who:'choice', c:'b', t:'ていねいに断る' },

  { id:'ev.daily.dream.narr1', who:'narr', t:'夜中、{mon}がびくっと飛び起きた。こわい夢を見たらしい。' },
  { id:'ev.daily.dream.mua1', who:'mua', e:'troubled', t:'よしよし、こわかったね…。あたしたちがいるから大丈夫だよ' },
  { id:'ev.daily.dream.atsu1', who:'atsu', e:'normal', t:'平気だよ、ここにいるから。…どうする？' },
  { id:'ev.daily.dream.choice.a', who:'choice', c:'a', t:'なだめて寝かせる' },
  { id:'ev.daily.dream.choice.b', who:'choice', c:'b', t:'朝までそばにいる' },

  { id:'ev.daily.picky.narr1', who:'narr', t:'ごはんのお皿から、{food}だけがきれいによけられている。' },
  { id:'ev.daily.picky.mua1', who:'mua', e:'happy', t:'{food}きらいなんだ〜。わかるけど、どうする？' },
  { id:'ev.daily.picky.atsu1', who:'atsu', e:'normal', t:'好き嫌いか。直すなら今だけど笑' },
  { id:'ev.daily.picky.choice.a', who:'choice', c:'a', t:'少しずつ食べさせる' },
  { id:'ev.daily.picky.choice.b', who:'choice', c:'b', t:'好きな物にしてあげる' },

  { id:'ev.daily.mirror.narr1', who:'narr', t:'{mon}が鏡の前で、いろんなポーズを決めている。' },
  { id:'ev.daily.mirror.mua1', who:'mua', e:'excited', t:'なにそれかわいすぎｗ 決めポーズの練習？' },
  { id:'ev.daily.mirror.atsu1', who:'atsu', e:'happy', t:'大会の入場用か？ 気合い入ってんな笑' },
  { id:'ev.daily.mirror.choice.a', who:'choice', c:'a', t:'かっこいいと褒める' },
  { id:'ev.daily.mirror.choice.b', who:'choice', c:'b', t:'もっとキメる練習をさせる' },

  { id:'ev.daily.lost.narr1', who:'narr', t:'町角で、小さなモンスターがひとりぼっちで泣いている。迷子のようだ。' },
  { id:'ev.daily.lost.mua1', who:'mua', e:'troubled', t:'迷子ちゃん？ ほっとけないよね…' },
  { id:'ev.daily.lost.atsu1', who:'atsu', e:'normal', t:'見つけちゃったら放っとけないよな…' },
  { id:'ev.daily.lost.choice.a', who:'choice', c:'a', t:'いっしょに家族を探す' },
  { id:'ev.daily.lost.choice.b', who:'choice', c:'b', t:'助手にまかせる' },

  { id:'ev.daily.map.narr1', who:'narr', t:'押し入れの奥から、古い修行の地図が出てきた。印がいくつも付いている。' },
  { id:'ev.daily.map.mua1', who:'mua', e:'excited', t:'宝の地図っぽい！ 次の修行、ここ行ってみよーよ！' },
  { id:'ev.daily.map.atsu1', who:'atsu', e:'happy', t:'いいもん見つけたな。次の修行の参考にしよ笑' },

  { id:'ev.daily.gift.narr1', who:'narr', t:'玄関に、手紙つきの差し入れが置いてあった。「いつも応援しています」。' },
  { id:'ev.daily.gift.mua1', who:'mua', e:'crying', t:'えー、うれしすぎる…😭 {mon}、ファンがいるんだよ！' },
  { id:'ev.daily.gift.atsu1', who:'atsu', e:'happy', t:'見てくれてる人がいるんだな。ありがたくいただこ笑' },

  { id:'ev.daily.alone.narr1', who:'narr', t:'気づけば、{mon}がひとりで黙々と訓練の続きをしていた。' },
  { id:'ev.daily.alone.mua1', who:'mua', e:'happy', t:'{mon}、えらすぎる…。あたしも見習わなきゃ！' },
  { id:'ev.daily.alone.atsu1', who:'atsu', e:'happy', t:'言われなくてもやる。そういうとこ、好きだわ笑' },

  // ═══════════ ③ 編成の出来事 ═══════════
  { id:'ev.team.selfdrill.narr1', who:'narr', t:'訓練のあと、{cheer}が「もう少しやろう」と{mon}を誘ってきた。' },
  { id:'ev.team.selfdrill.mua1', who:'mua', e:'happy', t:'{cheer}、やる気満々ぢゃん♪ どうする？' },
  { id:'ev.team.selfdrill.atsu1', who:'atsu', e:'normal', t:'{cheer}からの誘いか。乗るかどうかは体力と相談な笑' },
  { id:'ev.team.selfdrill.choice.a', who:'choice', c:'a', t:'いっしょに自主練する' },
  { id:'ev.team.selfdrill.choice.b', who:'choice', c:'b', t:'今日は休む' },

  { id:'ev.team.senpai.narr1', who:'narr', t:'{cheer}がひとりで技をみがいている。その動きには、一切のむだがない。' },
  { id:'ev.team.senpai.mua1', who:'mua', e:'surprise', t:'{cheer}、やっぱ別格ぢゃない…？' },
  { id:'ev.team.senpai.atsu1', who:'atsu', e:'excited', t:'あれが先輩の背中だな。見て盗むか、挑むか笑' },
  { id:'ev.team.senpai.choice.a', who:'choice', c:'a', t:'見て学ぶ' },
  { id:'ev.team.senpai.choice.b', who:'choice', c:'b', t:'手合わせを挑む' },

  { id:'ev.team.fight.narr1', who:'narr', t:'{cheer}と{cheer2}が、訓練場の取り合いでにらみ合っている。' },
  { id:'ev.team.fight.mua1', who:'mua', e:'troubled', t:'ちょ、ケンカはだめだってー💦' },
  { id:'ev.team.fight.atsu1', who:'atsu', e:'normal', t:'似た者どうしだからぶつかるんだよな笑 どうする？' },
  { id:'ev.team.fight.choice.a', who:'choice', c:'a', t:'仲直りさせる' },
  { id:'ev.team.fight.choice.b', who:'choice', c:'b', t:'{mon}も入って競わせる' },

  { id:'ev.team.base.narr1', who:'narr', t:'{cheer}が、遅くまでひとりで練習している。みんなに追いつこうと必死だ。' },
  { id:'ev.team.base.mua1', who:'mua', e:'crying', t:'{cheer}、がんばってる…。声かけてあげよ？' },
  { id:'ev.team.base.atsu1', who:'atsu', e:'happy', t:'いい根性してんな。{cheer}、ちゃんと見てるよ笑' },
  { id:'ev.team.base.choice.a', who:'choice', c:'a', t:'励ます' },

  { id:'ev.team.friend.narr1', who:'narr', t:'{cheer}が、ぺこりと頭を下げてあいさつしてきた。' },
  { id:'ev.team.friend.mua1', who:'mua', e:'happy', t:'来てくれてありがと！ いっしょにがんばろーね♪' },
  { id:'ev.team.friend.atsu1', who:'atsu', e:'happy', t:'よろしくな。頼りにしてるよ笑' },
  { id:'ev.team.friend.choice.a', who:'choice', c:'a', t:'あいさつを返す' },

  { id:'ev.team.typeskill.narr1', who:'narr', t:'{cheer}が、得意の動きを{mon}に見せてくれた。' },
  { id:'ev.team.typeskill.mua1', who:'mua', e:'excited', t:'{cheer}の得意技だ！ 教えてもらお✨' },
  { id:'ev.team.typeskill.atsu1', who:'atsu', e:'normal', t:'タイプが違うと動きも違うな。盗めるもんは盗も笑' },
  { id:'ev.team.typeskill.choice.a', who:'choice', c:'a', t:'教わる' },

  { id:'ev.team.sync.narr1', who:'narr', t:'{cheer}と{cheer2}が、言葉もなしにぴったり同じ動きをしている。' },
  { id:'ev.team.sync.mua1', who:'mua', e:'excited', t:'息ぴったりすぎ！ いいチームになってきたぢゃん✨' },
  { id:'ev.team.sync.atsu1', who:'atsu', e:'happy', t:'いい連携だな。こういうのが試合で効くんだよ笑' },

  { id:'ev.team.tagwake.narr1', who:'narr', t:'{cheer}と{mon}の目が合った。それだけで、次に何をするか分かる。' },
  { id:'ev.team.tagwake.mua1', who:'mua', e:'excited', t:'今の見た！？ ふたりの心、つながったよ✨' },
  { id:'ev.team.tagwake.atsu1', who:'atsu', e:'excited', t:'きたな、友情タッグ。ここから一気に伸びるよ笑' },

  // ═══════════ ④ 育てるモンスターの出来事 ═══════════
  { id:'ev.self.peakin.narr1', who:'narr', t:'{mon}の体が、ひと回り大きく見える。動きにも力強さが出てきた。' },
  { id:'ev.self.peakin.mua1', who:'mua', e:'excited', t:'{mon}、なんか急にたくましくなってない！？ 伸びどききたかも！' },
  { id:'ev.self.peakin.atsu1', who:'atsu', e:'excited', t:'いい時期に入ったな。今は攻めよ笑' },

  { id:'ev.self.peakout.narr1', who:'narr', t:'最近の{mon}は、前より少し落ち着いて見える。' },
  { id:'ev.self.peakout.mua1', who:'mua', e:'normal', t:'無理はしないでいこ。{mon}のペースが大事だよ♪' },
  { id:'ev.self.peakout.atsu1', who:'atsu', e:'normal', t:'無理はしないでいこ。とはいえ、まだやれるけど笑' },
  { id:'ev.self.peakout.choice.a', who:'choice', c:'a', t:'しっかり休ませる' },
  { id:'ev.self.peakout.choice.b', who:'choice', c:'b', t:'まだまだやる' },

  { id:'ev.self.slump.narr1', who:'narr', t:'このところ、{mon}は訓練がうまくいかずにしょんぼりしている。' },
  { id:'ev.self.slump.mua1', who:'mua', e:'troubled', t:'最近うまくいかないね…。気分変えに遊びいこっか？' },
  { id:'ev.self.slump.atsu1', who:'atsu', e:'normal', t:'こういうときは、流れを変えるか、我慢して続けるか笑' },
  { id:'ev.self.slump.choice.a', who:'choice', c:'a', t:'気分を変えに出かける' },
  { id:'ev.self.slump.choice.b', who:'choice', c:'b', t:'このまま続ける' },

  { id:'ev.self.favtrain.narr1', who:'narr', t:'{train}の時間になると、{mon}が自分から準備を始めるようになった。' },
  { id:'ev.self.favtrain.mua1', who:'mua', e:'happy', t:'{mon}、{train}好きになったんだね♪ 楽しそー！' },
  { id:'ev.self.favtrain.atsu1', who:'atsu', e:'happy', t:'好きこそ物の上手なれってやつだな笑' },

  { id:'ev.self.selfish.narr1', who:'narr', t:'{mon}がそっぽを向いて、訓練場に入ろうとしない。' },
  { id:'ev.self.selfish.mua1', who:'mua', e:'troubled', t:'今日はご機嫌ななめだね…。どうしよ？' },
  { id:'ev.self.selfish.atsu1', who:'atsu', e:'angry', t:'わがままだな。言うこと聞かせる？ それとも合わせる？' },
  { id:'ev.self.selfish.choice.a', who:'choice', c:'a', t:'言うことを聞いてあげる' },
  { id:'ev.self.selfish.choice.b', who:'choice', c:'b', t:'きちんと叱る' },

  { id:'ev.self.clingy.narr1', who:'narr', t:'{mon}が、{name}の足もとにぴったりくっついて離れない。' },
  { id:'ev.self.clingy.mua1', who:'mua', e:'happy', t:'甘えんぼさんぢゃんｗ なでてほしいんだって♪' },
  { id:'ev.self.clingy.atsu1', who:'atsu', e:'happy', t:'すっかり懐いたな。なでてやれよ笑' },
  { id:'ev.self.clingy.choice.a', who:'choice', c:'a', t:'なでる' },

  // ═══════════ ⑤ 期のはじめの目標 ═══════════
  { id:'ev.goal.pick.narr1', who:'narr', t:'新しい期が始まった。この期の目標を決めよう。' },
  { id:'ev.goal.pick.mua1', who:'mua', e:'happy', t:'あたしのおすすめは「みんなと仲良く」！ 仲間がいると強くなれるもん♪' },
  { id:'ev.goal.pick.atsu1', who:'atsu', e:'excited', t:'とりあえず「星をつかむ」でいいよ。上を目指さないとな笑' },
  { id:'ev.goal.pick.choice.a', who:'choice', c:'a', t:'星をつかむ' },
  { id:'ev.goal.pick.choice.b', who:'choice', c:'b', t:'得意をのばす' },
  { id:'ev.goal.pick.choice.c', who:'choice', c:'c', t:'みんなと仲良く' },
  { id:'ev.goal.done.mua1', who:'mua', e:'excited', t:'目標達成〜！ やったぢゃん{mon}✨' },
  { id:'ev.goal.done.atsu1', who:'atsu', e:'happy', t:'目標クリアな。有言実行、いいね笑' },
  { id:'ev.goal.miss.mua1', who:'mua', e:'normal', t:'目標には届かなかったけど、ちゃんと前に進んでるよ！' },
  { id:'ev.goal.miss.atsu1', who:'atsu', e:'normal', t:'届かなかったな。次の期で取り返そ笑' },

  // ═══════════ ⑤ 季節の行事(1年目=ジュニア / 2年目=ミドル / 3年目=プロ) ═══════════
  // 1月 初もうで
  { id:'ev.season.jan1.narr1', who:'narr', t:'新しい年。神社は初もうでの人でいっぱいだ。おみくじの箱が置いてある。' },
  { id:'ev.season.jan1.mua1', who:'mua', e:'excited', t:'おみくじ引こ引こ！ 大吉こいっ✨' },
  { id:'ev.season.jan1.atsu1', who:'atsu', e:'happy', t:'運だめしな。凶でもネタになるから笑' },
  { id:'ev.season.jan1.choice.a', who:'choice', c:'a', t:'おみくじを引く' },
  { id:'ev.season.jan2.narr1', who:'narr', t:'2度目の初もうで。願い札に、この1年の願いを書こう。' },
  { id:'ev.season.jan2.mua1', who:'mua', e:'happy', t:'なんて書く？ あたしは「みんな元気で」かな♪' },
  { id:'ev.season.jan2.atsu1', who:'atsu', e:'normal', t:'願い札か。俺は「目標達成」一択だな笑' },
  { id:'ev.season.jan2.choice.a', who:'choice', c:'a', t:'この期の目標を書く' },
  { id:'ev.season.jan2.choice.b', who:'choice', c:'b', t:'{mon}の健康を願う' },
  { id:'ev.season.jan3.narr1', who:'narr', t:'3度目の初もうで。お参りのあと、助手がぽつりと口を開いた。' },
  { id:'ev.season.jan3.mua1', who:'mua', e:'wink', t:'あたしの願い事、教えてあげる。「{mon}とずっといっしょに笑ってたい」…てへｗ' },
  { id:'ev.season.jan3.atsu1', who:'atsu', e:'normal', t:'俺の願い？ …{mon}がてっぺんに立つとこを見る。それだけ笑' },
  // 4月 花見
  { id:'ev.season.apr1.narr1', who:'narr', t:'桜が満開。編成のみんなとお弁当を広げた。' },
  { id:'ev.season.apr1.mua1', who:'mua', e:'excited', t:'お花見さいこー！ みんなで食べるとおいしさ倍ぢゃん！' },
  { id:'ev.season.apr1.atsu1', who:'atsu', e:'happy', t:'たまにはこういうのもいいな。肉、多めに持ってきた笑' },
  { id:'ev.season.apr1.choice.a', who:'choice', c:'a', t:'みんなでお弁当を分け合う' },
  { id:'ev.season.apr1.choice.b', who:'choice', c:'b', t:'桜の下でお昼寝' },
  { id:'ev.season.apr2.narr1', who:'narr', t:'今年の花見は町の人たちといっしょ。{mon}のまわりに人だかりができた。' },
  { id:'ev.season.apr2.mua1', who:'mua', e:'happy', t:'{mon}、町の人気者になってきたね♪' },
  { id:'ev.season.apr2.atsu1', who:'atsu', e:'happy', t:'顔が売れてきたな。悪くない笑' },
  { id:'ev.season.apr2.choice.a', who:'choice', c:'a', t:'みんなにあいさつして回る' },
  { id:'ev.season.apr2.choice.b', who:'choice', c:'b', t:'のんびり桜を眺める' },
  { id:'ev.season.apr3.narr1', who:'narr', t:'3度目の花見。去年の写真と見くらべると、{mon}の成長がよく分かる。' },
  { id:'ev.season.apr3.mua1', who:'mua', e:'crying', t:'見て、去年の{mon}ちっちゃ！ 大きくなったね…😭' },
  { id:'ev.season.apr3.atsu1', who:'atsu', e:'happy', t:'並べると全然違うな。ちゃんと積んできた証拠だよ笑' },
  // 8月 夏祭り
  { id:'ev.season.aug1.narr1', who:'narr', t:'夏祭りの夜。金魚すくいの屋台に{mon}がくぎづけだ。' },
  { id:'ev.season.aug1.mua1', who:'mua', e:'excited', t:'金魚すくいやろ！ あたし下手だけど！' },
  { id:'ev.season.aug1.atsu1', who:'atsu', e:'normal', t:'手元の集中力の訓練になるな。…まぁ遊びだけど笑' },
  { id:'ev.season.aug1.choice.a', who:'choice', c:'a', t:'金魚すくいに挑戦' },
  { id:'ev.season.aug1.choice.b', who:'choice', c:'b', t:'屋台を食べ歩き' },
  { id:'ev.season.aug2.narr1', who:'narr', t:'今年の夏祭りには、力自慢の出し物がある。大きなたるを持ち上げる勝負だ。' },
  { id:'ev.season.aug2.mua1', who:'mua', e:'surprise', t:'あれ持ち上げるの！？ {mon}、いけるかな…' },
  { id:'ev.season.aug2.atsu1', who:'atsu', e:'excited', t:'出るしかないかー笑 見せつけてこい！' },
  { id:'ev.season.aug2.choice.a', who:'choice', c:'a', t:'出し物に出る' },
  { id:'ev.season.aug2.choice.b', who:'choice', c:'b', t:'客席で応援する' },
  { id:'ev.season.aug3.narr1', who:'narr', t:'3度目の夏祭り。夜空に大きな花火が上がった。' },
  { id:'ev.season.aug3.mua1', who:'mua', e:'happy', t:'きれー…。来年もこうやって見れたらいいな(｡ ˘-˘)' },
  { id:'ev.season.aug3.atsu1', who:'atsu', e:'normal', t:'…いい夏だったな。今日は全部忘れてゆっくりしよ笑' },
  // 10月 ハロウィンの夜
  { id:'ev.season.oct1.narr1', who:'narr', t:'ハロウィンの夜。町じゅうがかぼちゃのランプで照らされている。' },
  { id:'ev.season.oct1.mua1', who:'mua', e:'excited', t:'仮装しよ仮装！ {mon}、おばけの格好とか似合いそー🎃' },
  { id:'ev.season.oct1.atsu1', who:'atsu', e:'happy', t:'仮装か。どうせなら一番目立と笑' },
  { id:'ev.season.oct1.choice.a', who:'choice', c:'a', t:'おばけに仮装する' },
  { id:'ev.season.oct1.choice.b', who:'choice', c:'b', t:'勇者に仮装する' },
  { id:'ev.season.oct2.narr1', who:'narr', t:'今年のハロウィンは、お菓子集めの競争があるらしい。' },
  { id:'ev.season.oct2.mua1', who:'mua', e:'wink', t:'お菓子いっぱいもらって、山分けしよｗ🎃' },
  { id:'ev.season.oct2.atsu1', who:'atsu', e:'happy', t:'競争って聞いたら負けらんないな笑' },
  { id:'ev.season.oct2.choice.a', who:'choice', c:'a', t:'町じゅうを回る' },
  { id:'ev.season.oct2.choice.b', who:'choice', c:'b', t:'近所だけ回る' },
  { id:'ev.season.oct3.narr1', who:'narr', t:'3度目のハロウィン。古い時計塔のそばで、ちょっとこわい話を聞いた。' },
  { id:'ev.season.oct3.mua1', who:'mua', e:'troubled', t:'ひゃっ…今なんか動かなかった！？ こわすぎるんだけど🎃' },
  { id:'ev.season.oct3.atsu1', who:'atsu', e:'normal', t:'作り話だろ。…まぁ、技のヒントにはなりそうな話だったけど笑' },
  // 12月 年の瀬
  { id:'ev.season.dec1.narr1', who:'narr', t:'年の瀬。1年分のほこりを落とす大そうじの日だ。' },
  { id:'ev.season.dec1.mua1', who:'mua', e:'happy', t:'大そうじがんばろ！ 終わったらあったかいもの食べよーね♪' },
  { id:'ev.season.dec1.atsu1', who:'atsu', e:'normal', t:'とりあえず高いとこは俺がやる。{mon}は下な笑' },
  { id:'ev.season.dec1.choice.a', who:'choice', c:'a', t:'すみずみまでそうじする' },
  { id:'ev.season.dec1.choice.b', who:'choice', c:'b', t:'ほどほどにして休む' },
  { id:'ev.season.dec2.narr1', who:'narr', t:'2度目の年の瀬。この1年をみんなでふり返った。' },
  { id:'ev.season.dec2.mua1', who:'mua', e:'happy', t:'今年もいろいろあったね！ {mon}、いっぱいがんばった♪' },
  { id:'ev.season.dec2.atsu1', who:'atsu', e:'happy', t:'いい1年だったな。来年も頼むよ笑' },
  { id:'ev.season.dec2.choice.a', who:'choice', c:'a', t:'{mon}にお礼を言う' },
  { id:'ev.season.dec2.choice.b', who:'choice', c:'b', t:'来年の目標を話し合う' },
  { id:'ev.season.dec3.narr1', who:'narr', t:'3度目の年の瀬。来年は、いよいよ最後の期だ。' },
  { id:'ev.season.dec3.mua1', who:'mua', e:'excited', t:'来年はいよいよ最後だね！ 最高の1年にしよ✨' },
  { id:'ev.season.dec3.atsu1', who:'atsu', e:'excited', t:'来年で決まるな。全部出し切ろ笑' },
  // 最後の期(長め)
  { id:'ev.season.finaljan.narr1', who:'narr', t:'最後の初もうで。いつもより長く、手を合わせた。' },
  { id:'ev.season.finaljan.mua1', who:'mua', e:'happy', t:'最後のお願いは決まってるよ。「{mon}が笑って終われますように」♪' },
  { id:'ev.season.finaljan.atsu1', who:'atsu', e:'normal', t:'神頼みはここまで。あとは自分たちでつかむだけ…！' },
  { id:'ev.season.finalapr.narr1', who:'narr', t:'最後の花見。はじめての春から、ずいぶん遠くまで来た。' },
  { id:'ev.season.finalapr.mua1', who:'mua', e:'crying', t:'この桜、ずっと覚えてようね…。あたし、忘れないから' },
  { id:'ev.season.finalapr.atsu1', who:'atsu', e:'happy', t:'いい顔になったな、{mon}。…しめくくりといこっか笑' },

  // ═══════════ ⑥ 小さな賭け ═══════════
  { id:'ev.small.omikuji.great.mua1', who:'mua', e:'excited', t:'大吉ぢゃん！ 今年は最強の年になるやつ✨' },
  { id:'ev.small.omikuji.good.mua1', who:'mua', e:'happy', t:'吉！ ちょうどいいのがいちばんだよ♪' },
  { id:'ev.small.omikuji.bad.mua1', who:'mua', e:'happy', t:'凶ｗ ネタにしよネタに！ 逆に運使ってないってことぢゃん' },
  { id:'ev.small.omikuji.great.atsu1', who:'atsu', e:'excited', t:'大吉。今年はもらったな笑' },
  { id:'ev.small.omikuji.good.atsu1', who:'atsu', e:'normal', t:'吉か。まぁ〜十分でしょ笑' },
  { id:'ev.small.omikuji.bad.atsu1', who:'atsu', e:'happy', t:'凶笑 ネタにしよ。運より実力だから！' },
  { id:'ev.small.nut.narr1', who:'narr', t:'旅の行商人が、見たこともない色の木の実を差し出してきた。「食べると強くなるよ、たぶんね」。' },
  { id:'ev.small.nut.mua1', who:'mua', e:'troubled', t:'色やばくない？ でも強くなるなら…どうする？' },
  { id:'ev.small.nut.atsu1', who:'atsu', e:'normal', t:'あやしいな笑 当たればでかいけど…' },
  { id:'ev.small.nut.choice.a', who:'choice', c:'a', t:'名声で買う' },
  { id:'ev.small.nut.choice.b', who:'choice', c:'b', t:'買わない' },
  { id:'ev.small.nut.ok.narr1', who:'narr', c:'a', t:'木の実を食べた{mon}の体に、力がみなぎった！' },
  { id:'ev.small.nut.ng.narr1', who:'narr', c:'a', t:'…{mon}がおなかを押さえてうずくまった。どうやら合わなかったらしい。' },

  // ═══════════ ⑦ 体調の出来事 ═══════════
  { id:'ev.body.injury.narr1', who:'narr', t:'訓練に向かおうとした{mon}の足が、ふらりともつれた。' },
  { id:'ev.body.injury.mua1', who:'mua', e:'troubled', t:'待って待って！ 今のまま訓練したら、けがしちゃうかも…' },
  { id:'ev.body.injury.atsu1', who:'atsu', e:'angry', t:'ストップ。今やったらけがする。それでも行く？' },
  { id:'ev.body.injury.choice.a', who:'choice', c:'a', t:'休ませる' },
  { id:'ev.body.injury.choice.b', who:'choice', c:'b', t:'それでも訓練する' },

  { id:'ev.body.runaway.narr1', who:'narr', t:'このところ{mon}は、窓の外ばかり見ている。ごはんも少し残しがちだ。' },
  { id:'ev.body.runaway.mua1', who:'mua', e:'troubled', t:'最近、{mon}元気ないね…。どっか連れてってあげたいな' },
  { id:'ev.body.runaway.atsu1', who:'atsu', e:'troubled', t:'最近元気ないな…。ちょっと詰めすぎたかも…' },
  { id:'ev.body.runaway.choice.a', who:'choice', c:'a', t:'遊びに連れ出す' },
  { id:'ev.body.runaway.choice.b', who:'choice', c:'b', t:'様子を見る' },

  { id:'ev.body.healed.narr1', who:'narr', t:'すっかり元気になった{mon}が、うれしそうに跳びはねている。' },
  { id:'ev.body.healed.mua1', who:'mua', e:'happy', t:'よかったぁ…！ またいっしょにがんばろーね♪' },
  { id:'ev.body.healed.atsu1', who:'atsu', e:'happy', t:'もう大丈夫だな。ここから取り返そ笑' },
  { id:'ev.body.home.narr1', who:'narr', t:'夕方、玄関の前に{mon}がちょこんと座っていた。帰ってきたのだ。' },
  { id:'ev.body.home.mua1', who:'mua', e:'crying', t:'おかえりぃ…！ もう、どこ行ってたの😭' },
  { id:'ev.body.home.atsu1', who:'atsu', e:'normal', t:'…おかえり。どうする、{name}？' },
  { id:'ev.body.home.choice.a', who:'choice', c:'a', t:'やさしく迎える' },
  { id:'ev.body.home.choice.b', who:'choice', c:'b', t:'心配したと叱る' },

  // ═══════════ ⑧ 大会まわりの出来事 ═══════════
  { id:'ev.cup.eve.narr1', who:'narr', t:'{cup}の前の晩。{mon}は落ち着かない様子で部屋をうろうろしている。' },
  { id:'ev.cup.eve.mua1', who:'mua', e:'happy', t:'明日だね！ 早く寝る？ それとも作戦会議する？' },
  { id:'ev.cup.eve.atsu1', who:'atsu', e:'normal', t:'寝るか、詰めるか。どっちでもいいよ笑' },
  { id:'ev.cup.eve.choice.a', who:'choice', c:'a', t:'早く寝る' },
  { id:'ev.cup.eve.choice.b', who:'choice', c:'b', t:'作戦を練る' },

  { id:'ev.cup.interview.narr1', who:'narr', t:'優勝した{mon}のもとに、記者がマイクを持って駆け寄ってきた。' },
  { id:'ev.cup.interview.mua1', who:'mua', e:'excited', t:'取材だって！ {mon}、決めぜりふいっちゃう？' },
  { id:'ev.cup.interview.atsu1', who:'atsu', e:'happy', t:'取材か。かっこよく決めるか、控えめにいくか笑' },
  { id:'ev.cup.interview.choice.a', who:'choice', c:'a', t:'決めぜりふを言う' },
  { id:'ev.cup.interview.choice.b', who:'choice', c:'b', t:'控えめに答える' },

  { id:'ev.cup.after.narr1', who:'narr', t:'大会の帰り道。{mon}はうつむいたまま、とぼとぼ歩いている。' },
  { id:'ev.cup.after.mua1', who:'mua', e:'troubled', t:'くやしかったね…。今日はどうしよっか' },
  { id:'ev.cup.after.atsu1', who:'atsu', e:'normal', t:'切りかえるか、反省するか。どっちも大事だよ笑' },
  { id:'ev.cup.after.choice.a', who:'choice', c:'a', t:'励ます' },
  { id:'ev.cup.after.choice.b', who:'choice', c:'b', t:'反省会をする' },
]);
  out.random = MONSUC_SCRIPT_RANDOM;
  // ---- rival.js ----
// モンヒロサクセス 台本 第2弾: ライバル(TOURNAMENT.md §8b・EVENTS.md ⑧「ライバルの前触れ」)
// ライバルは「自分の助手のマスモン」か「フレンドのモンスター」。ライバルのいる大会に勝つとごほうびが大きい。
// 出る大会の割合・強さの寄せ方・ごほうびの上乗せはまだ決まっていない(TOURNAMENT §8b)。台詞は数字を言わない。
// 形は README.md。
//   {rival} … ライバルのモンスターの名前 / {owner} … 持ち主(助手の名前か、フレンドの名前)
//   場面のid … ev.rival.<場面>.<だれのライバルか>
//     だれのライバルか: asst=ほかの助手のマスモン / friend=フレンドのモンスター / self=シナリオの助手(いま育成を手伝っている助手)自身のマスモン
//     場面: notice=1ターン前の前触れ(出るか決める材料)/ meet=大会の会場で顔を合わせる / win・lose=試合のあと / reward=勝ったときの地の文
const MONSUC_SCRIPT_RIVAL = Object.freeze([
  // ── 前触れ(大会の1ターン前) ──
  { id:'ev.rival.notice.asst.narr1', who:'narr', t:'町の掲示板に、次の{cup}の出場者が貼り出された。そこには{owner}の育てる{rival}の名前があった。' },
  { id:'ev.rival.notice.asst.mua1', who:'mua', e:'surprise', t:'えっ、{owner}の{rival}も出るって！ {rival}、まぢ強いんだよ…' },
  { id:'ev.rival.notice.asst.atsu1', who:'atsu', e:'excited', t:'{owner}のとこの{rival}が来るらしい。上等だな笑' },
  { id:'ev.rival.notice.friend.narr1', who:'narr', t:'次の{cup}に、{owner}さんの{rival}が出るといううわさが流れてきた。' },
  { id:'ev.rival.notice.friend.mua1', who:'mua', e:'excited', t:'{owner}さんの{rival}が来るんだって！ どんな相手か楽しみぢゃない？' },
  { id:'ev.rival.notice.friend.atsu1', who:'atsu', e:'normal', t:'{owner}さんの{rival}な。噂だと、なかなかやるらしい笑' },
  { id:'ev.rival.notice.choice.a', who:'choice', c:'a', t:'出て勝負する' },
  { id:'ev.rival.notice.choice.b', who:'choice', c:'b', t:'今回は見送る' },
  { id:'ev.rival.notice.a.mua1', who:'mua', e:'excited', c:'a', t:'そうこなくっちゃ！ 勝ったらごほうびもすごいらしいよ✨' },
  { id:'ev.rival.notice.a.atsu1', who:'atsu', e:'excited', c:'a', t:'いいね。勝てばごほうびもでかい。かかってこいだな笑' },
  { id:'ev.rival.notice.b.mua1', who:'mua', e:'normal', c:'b', t:'今は力をためるときだね。次に会ったときはぜったい負けないもん！' },
  { id:'ev.rival.notice.b.atsu1', who:'atsu', e:'normal', c:'b', t:'それね笑 準備できてから行けばいいよ！' },
  // シナリオの助手のマスモンがライバルのとき
  { id:'ev.rival.notice.self.narr1', who:'narr', t:'次の{cup}の出場者の中に、見覚えのある名前があった。{rival}──助手の育てているモンスターだ。' },
  { id:'ev.rival.notice.self.mua1', who:'mua', e:'surprise', t:'え、{rival}出るの！？ あたしが育ててるんだけど！ どっち応援したらいいのー！？ｗ' },
  { id:'ev.rival.notice.self.mua2', who:'mua', e:'wink', t:'…でも{name}と{mon}のコーチは、あたしだからね。手は抜かないよ♪' },
  { id:'ev.rival.notice.self.atsu1', who:'atsu', e:'happy', t:'次の大会、{rival}が出るらしい。…俺が育ててる奴な笑' },
  { id:'ev.rival.notice.self.atsu2', who:'atsu', e:'excited', t:'遠慮はいらない。むしろ全力で来てくれないと困るわ笑' },

  // ── 会場で顔を合わせる ──
  { id:'ev.rival.meet.asst.narr1', who:'narr', t:'控え室の前で、{rival}とすれちがった。目が合った瞬間、空気がぴんと張りつめる。' },
  { id:'ev.rival.meet.asst.mua1', who:'mua', e:'troubled', t:'うわ、オーラすご…。{mon}、負けてないからね！' },
  { id:'ev.rival.meet.asst.atsu1', who:'atsu', e:'normal', t:'いい目してんな、{rival}。…{mon}も負けてないよ！' },
  { id:'ev.rival.meet.friend.narr1', who:'narr', t:'会場の入口で、{owner}さんの{rival}が待っていた。礼儀正しくおじぎをしてくる。' },
  { id:'ev.rival.meet.friend.mua1', who:'mua', e:'happy', t:'{rival}、礼儀正しー！ {mon}もあいさつしよ♪' },
  { id:'ev.rival.meet.friend.atsu1', who:'atsu', e:'happy', t:'いい相手だな。こういう相手とやるのが一番楽しいんだよ笑' },
  { id:'ev.rival.meet.self.mua1', who:'mua', e:'happy', t:'{rival}、今日は敵どうしだよ！ …お互い全力でね♪' },
  { id:'ev.rival.meet.self.atsu1', who:'atsu', e:'normal', t:'{rival}、手加減すんなよ。{mon}もな笑' },

  // ── 勝った・負けた ──
  { id:'ev.rival.win.asst.mua1', who:'mua', e:'excited', t:'{rival}に勝ったー！！ {mon}、まぢ最強ぢゃん🔥' },
  { id:'ev.rival.win.asst.atsu1', who:'atsu', e:'excited', t:'{rival}に勝ったな。これは胸張っていいやつ笑' },
  { id:'ev.rival.win.friend.mua1', who:'mua', e:'happy', t:'勝った！ {owner}さんの{rival}も強かったね。またやろーね♪' },
  { id:'ev.rival.win.friend.atsu1', who:'atsu', e:'happy', t:'いい勝負だった。{owner}さんにもよろしく言っといて笑' },
  { id:'ev.rival.win.self.mua1', who:'mua', e:'crying', t:'{mon}が勝った…！ うれしいけど{rival}もがんばったよね…複雑すぎるｗ' },
  { id:'ev.rival.win.self.atsu1', who:'atsu', e:'happy', t:'うちの{rival}に勝つとはな。…いや、悔しくはないって笑' },
  { id:'ev.rival.lose.asst.mua1', who:'mua', e:'crying', t:'{rival}、強かった…😭 でも次はぜったい勝と！' },
  { id:'ev.rival.lose.asst.atsu1', who:'atsu', e:'troubled', t:'残念笑 でも差は見えた。次で返そ！' },
  { id:'ev.rival.lose.friend.mua1', who:'mua', e:'troubled', t:'負けちゃった…。{owner}さん、すごい育て方してるね' },
  { id:'ev.rival.lose.friend.atsu1', who:'atsu', e:'normal', t:'{owner}さんのとこ、強いな。いい目標ができたわ笑' },
  { id:'ev.rival.lose.self.mua1', who:'mua', e:'troubled', t:'{rival}が勝っちゃった…。ごめんね{mon}、次はあたしが{mon}を勝たせるから！' },
  { id:'ev.rival.lose.self.atsu1', who:'atsu', e:'normal', t:'{rival}の勝ちか。…次は{mon}で、こいつを越えよ笑' },

  // ── 勝ったときのごほうび ──
  { id:'ev.rival.reward.narr1', who:'narr', t:'ライバルに勝った！ いつもよりごほうびが多くもらえた。' },
]);
  out.rival = MONSUC_SCRIPT_RIVAL;
  // ---- mon.js ----
// モンヒロサクセス 台本 第2弾: モンスターの反応(PLAN.md §6「気分8つの短い声と表情+種ごとの鳴き声1語」)
// 形は README.md。モンスターは言葉を話さない。短い声と記号だけ。
//   who  … mon
//   id   … mon.mood.<気分>.<番号>(共通の声)/ mon.cry.<種のidを小文字>(種ごとの鳴き声1語)
//   {cry} … 種ごとの鳴き声(mon.cry.* の t)。共通の声に差しこむ
//   face … 表情と動きの目安(絵と動きを作るときの手がかり。画面には出さない)
// 気分(8つ): joy うれしい / hype 大はしゃぎ / calm ふつう / tired 疲れた / sulky ふてくされ / sad しょんぼり / surprise びっくり / clingy 甘える
// 場面ごとの気分の目安: ターンのはじめ=様子の5段(great→hype・good→joy・normal→calm・tired/worn→tired・stress→sulky)/
//   大成功→hype・成功→joy・失敗→sad・サボり→calm・叱られた(合っていた→sad・合っていなかった→sulky)・褒められた→clingy/
//   けが・病気→tired・家出から帰った→clingy・ピークに入った→surprise
const MONSUC_SCRIPT_MON = Object.freeze([
  // ── 共通の声(気分8つ × 5) ──
  { id:'mon.mood.joy.1', who:'mon', face:'にっこり・ぴょんと跳ねる', t:'{cry}♪' },
  { id:'mon.mood.joy.2', who:'mon', face:'にっこり・しっぽを振る', t:'{cry}〜♪' },
  { id:'mon.mood.joy.3', who:'mon', face:'目を細める', t:'{cry}！ {cry}！' },
  { id:'mon.mood.joy.4', who:'mon', face:'くるっと回る', t:'♪♪' },
  { id:'mon.mood.joy.5', who:'mon', face:'胸を張る', t:'{cry}っ！' },
  { id:'mon.mood.hype.1', who:'mon', face:'目がキラキラ・大きく跳ねる', t:'{cry}ーーっ！！' },
  { id:'mon.mood.hype.2', who:'mon', face:'その場で何度も跳ねる', t:'{cry}！{cry}！{cry}！' },
  { id:'mon.mood.hype.3', who:'mon', face:'両手を上げる', t:'！！！' },
  { id:'mon.mood.hype.4', who:'mon', face:'鼻息あらく構える', t:'{cry}！ ふんすっ！' },
  { id:'mon.mood.hype.5', who:'mon', face:'走り回る', t:'{cry}〜〜っ！！' },
  { id:'mon.mood.calm.1', who:'mon', face:'ふつうの顔', t:'{cry}' },
  { id:'mon.mood.calm.2', who:'mon', face:'首をかしげる', t:'{cry}？' },
  { id:'mon.mood.calm.3', who:'mon', face:'のびをする', t:'ふぁ〜…' },
  { id:'mon.mood.calm.4', who:'mon', face:'きょろきょろする', t:'……' },
  { id:'mon.mood.calm.5', who:'mon', face:'こくりとうなずく', t:'{cry}。' },
  { id:'mon.mood.tired.1', who:'mon', face:'肩で息をする', t:'ぜぇ…ぜぇ…' },
  { id:'mon.mood.tired.2', who:'mon', face:'ぺたんと座りこむ', t:'{cry}…' },
  { id:'mon.mood.tired.3', who:'mon', face:'目がとろんとする', t:'…zzz' },
  { id:'mon.mood.tired.4', who:'mon', face:'足どりがふらつく', t:'ふにゃ…' },
  { id:'mon.mood.tired.5', who:'mon', face:'大あくび', t:'{cry}ぁ〜…' },
  { id:'mon.mood.sulky.1', who:'mon', face:'ほっぺをふくらませる', t:'むぅ…' },
  { id:'mon.mood.sulky.2', who:'mon', face:'そっぽを向く', t:'{cry}っ！ ぷいっ' },
  { id:'mon.mood.sulky.3', who:'mon', face:'地面をけとばす', t:'……ふんっ' },
  { id:'mon.mood.sulky.4', who:'mon', face:'背中を向けて座る', t:'{cry}…（ぷい）' },
  { id:'mon.mood.sulky.5', who:'mon', face:'じとっとにらむ', t:'むすー…' },
  { id:'mon.mood.sad.1', who:'mon', face:'うつむく', t:'{cry}…' },
  { id:'mon.mood.sad.2', who:'mon', face:'目がうるむ', t:'くぅん…' },
  { id:'mon.mood.sad.3', who:'mon', face:'しっぽが下がる', t:'しょぼ…' },
  { id:'mon.mood.sad.4', who:'mon', face:'小さくまるくなる', t:'……' },
  { id:'mon.mood.sad.5', who:'mon', face:'鼻をすする', t:'{cry}ぅ…' },
  { id:'mon.mood.surprise.1', who:'mon', face:'目をまんまるにする', t:'{cry}！？' },
  { id:'mon.mood.surprise.2', who:'mon', face:'飛びあがる', t:'！？' },
  { id:'mon.mood.surprise.3', who:'mon', face:'固まる', t:'…！' },
  { id:'mon.mood.surprise.4', who:'mon', face:'自分の体を見まわす', t:'{cry}…？ {cry}！？' },
  { id:'mon.mood.surprise.5', who:'mon', face:'口をぽかんとあける', t:'ほぇ…！？' },
  { id:'mon.mood.clingy.1', who:'mon', face:'すり寄る', t:'{cry}〜' },
  { id:'mon.mood.clingy.2', who:'mon', face:'足もとにくっつく', t:'すりすり…' },
  { id:'mon.mood.clingy.3', who:'mon', face:'見上げる', t:'{cry}…♡' },
  { id:'mon.mood.clingy.4', who:'mon', face:'頭を差し出す', t:'なでて…？' },
  { id:'mon.mood.clingy.5', who:'mon', face:'ぴったり寄りそう', t:'{cry}♡ {cry}♡' },

  // ── 種ごとの鳴き声(1語 × 30種) ──
  { id:'mon.cry.plant', who:'mon', t:'ぷらっ' },
  { id:'mon.cry.yggdrasil', who:'mon', t:'ざわわ' },
  { id:'mon.cry.melwhip', who:'mon', t:'ほいっぷ' },
  { id:'mon.cry.oboro', who:'mon', t:'ゆらり' },
  { id:'mon.cry.melody', who:'mon', t:'るるん' },
  { id:'mon.cry.mocchi', who:'mon', t:'もちっ' },
  { id:'mon.cry.monol', who:'mon', t:'ごぉん' },
  { id:'mon.cry.kuromy', who:'mon', t:'くるる' },
  { id:'mon.cry.mitarashi', who:'mon', t:'とろっ' },
  { id:'mon.cry.golem', who:'mon', t:'ゴゴッ' },
  { id:'mon.cry.spooky', who:'mon', t:'ひゅるる' },
  { id:'mon.cry.suezo', who:'mon', t:'ぎょろっ' },
  { id:'mon.cry.orihime', who:'mon', t:'しゃらん' },
  { id:'mon.cry.yaobikuni', who:'mon', t:'ちゃぷん' },
  { id:'mon.cry.kyubi', who:'mon', t:'こーん' },
  { id:'mon.cry.ark', who:'mon', t:'ガルッ' },
  { id:'mon.cry.ghost', who:'mon', t:'ふわわ' },
  { id:'mon.cry.pandora', who:'mon', t:'ぱかっ' },
  { id:'mon.cry.snegurochka', who:'mon', t:'しゃりん' },
  { id:'mon.cry.tiger', who:'mon', t:'ガオッ' },
  { id:'mon.cry.undine', who:'mon', t:'ぴちょん' },
  { id:'mon.cry.eiki', who:'mon', t:'キンッ' },
  { id:'mon.cry.mia', who:'mon', t:'みゃっ' },
  { id:'mon.cry.iblis', who:'mon', t:'グルル' },
  { id:'mon.cry.kenshimocchi', who:'mon', t:'もちんっ' },
  { id:'mon.cry.dreamy', who:'mon', t:'ふわぁ' },
  { id:'mon.cry.ham', who:'mon', t:'ぴきゅ' },
  { id:'mon.cry.pixie', who:'mon', t:'きらっ' },
  { id:'mon.cry.illumine', who:'mon', t:'ぴかっ' },
  { id:'mon.cry.zan', who:'mon', t:'シュッ' },
]);
  out.mon = MONSUC_SCRIPT_MON;
  // ---- heads.js ----
// モンヒロサクセス 台本: 出来事の見出しの分け方(VIDEO-REF.md 参考動画2「イベントの見出しを3種類に分ける」)
// 場面のidの頭で、画面の上に出す見出しを決める。どの出来事の行も、ちょうど1つに当たる(tools/success/success-script-check.js が見張る)。
//   train … 育成イベント(助手と育てているモンスター。ふだんの出来事・季節・体調・大会まわり・ライバル・イッサ博士)
//   cheer … 編成の子のイベント(編成の子との連続3話・くじ・すき間の編成の出来事)
//   main  … メインのお話(シナリオの助手の4話+特別な1話・シナリオの大会。称号や能力ポイントにつながる)
//   none  … 出来事ではない(ターンごとのことば・モンスターの声。見出しを出さない)
const MONSUC_SCRIPT_HEADS = Object.freeze([
  { prefix:'scn.', head:'main', label:'メインのお話' },
  { prefix:'cheer.', head:'cheer', label:'編成の子のイベント' },
  { prefix:'ev.team.', head:'cheer', label:'編成の子のイベント' },
  { prefix:'ev.', head:'train', label:'育成イベント' },
  { prefix:'issa.', head:'train', label:'育成イベント' },
  { prefix:'turn.', head:'none', label:'' },
  { prefix:'mon.', head:'none', label:'' },
  { prefix:'item.', head:'none', label:'' },
]);

// 行の id から見出しを引く(上から順に、最初に当たったもの)
function monsucScriptHeadOf(id) {
  const hit = MONSUC_SCRIPT_HEADS.find(h => String(id).startsWith(h.prefix));
  return hit ? hit.head : null;
}
  out.heads = MONSUC_SCRIPT_HEADS;
  if (typeof monsucScriptHeadOf === 'function') out.headOf = monsucScriptHeadOf;
  const api = Object.freeze(out);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_SCRIPT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
