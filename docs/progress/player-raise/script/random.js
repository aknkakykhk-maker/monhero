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
  // 間合いの稽古(2026-11-13: 間合い適性が1段上がる)
  { id:'ev.daily.range.narr1', who:'narr', t:'広場のすみで、{mon}が見えない相手との間合いをはかるように、前へ出たり下がったりしている。' },
  { id:'ev.daily.range.mua1', who:'mua', e:'excited', t:'{mon}、ひとりで間合いの練習してる！ つきあってあげよっか？' },
  { id:'ev.daily.range.atsu1', who:'atsu', e:'normal', t:'間合いの稽古か。得意を伸ばすか、苦手をつぶすか、どっちにする？' },
  { id:'ev.daily.range.choice.a', who:'choice', c:'a', t:'得意な間合いをきわめる' },
  { id:'ev.daily.range.choice.b', who:'choice', c:'b', t:'苦手な間合いをおぎなう' },

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

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_RANDOM };
