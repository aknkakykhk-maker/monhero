// モンヒロサクセス 台本 第1弾: 編成の子とのトレーニングイベント(連続イベント3話)
// ASSIST.md §4b。話の筋はタイプ(5つ)ごとの型に、その子の名前・得意な能力・技を差しこむ。ベースモンは短い3話(3話目は技の伝授なし)。
// 形は README.md。
//   {cheer} … 編成の子の名前(フレンドから借りた子は「◯◯さんの◯◯」を画面側で差しこむ)
//   {stat}  … その子の得意な能力 / {tech} … その子が教えてくれる技 / {mon} … 育てているモンスター
//   who     … narr(地の文) / choice(選択肢の札) / mua / atsu(シナリオの助手のひとこと。選んだ助手の行だけ出す)
//   場面のid … cheer.<タイプ>.ep<話>(タイプは attacker / tank / supporter / healer / shadow / base)
// 選択肢の中身(ASSIST.md §4b): 1話 a=張り切る・b=ていねいに / 2話 a=思いきり・b=のんびり / 3話 a=教わる・b=自分のやり方で
const MONSUC_SCRIPT_CHEER = Object.freeze([
  // ═══════════ アタッカー ═══════════
  { id:'cheer.attacker.ep1.narr1', who:'narr', t:'トレーニング場に{cheer}がやってきた。拳をぶつけ合う音が、あたりに響く。' },
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
  { id:'cheer.tank.ep1.narr1', who:'narr', t:'{cheer}がどっしりとトレーニング場の真ん中に立った。{mon}がぶつかっても、びくともしない。' },
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
  { id:'cheer.supporter.ep1.narr1', who:'narr', t:'{cheer}が、トレーニングの道具をきちんと並べて待っていた。' },
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
  { id:'cheer.healer.ep1.narr1', who:'narr', t:'トレーニングで転んだ{mon}のそばに、{cheer}がそっと寄ってきた。' },
  { id:'cheer.healer.ep1.narr2', who:'narr', t:'すり傷に手をかざすと、あたたかい光がふわりと広がる。' },
  { id:'cheer.healer.ep1.choice.a', who:'choice', c:'a', t:'すぐトレーニングにもどる' },
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
  { id:'cheer.base.ep1.narr1', who:'narr', t:'{cheer}が、少し照れくさそうにトレーニングに加わった。' },
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
  { id:'cheer.lot.chat.narr1', who:'narr', t:'{cheer}と、トレーニングのあとにのんびりおしゃべり。' },
  { id:'cheer.lot.tip.narr1', who:'narr', t:'{cheer}が、ちょっとしたコツを教えてくれた。' },
  { id:'cheer.lot.friend.narr1', who:'narr', t:'{cheer}が、うれしそうに{mon}にすり寄ってきた。' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_CHEER };
