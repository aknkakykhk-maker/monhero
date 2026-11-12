// モンヒロサクセス 台本 第3弾: ライバルの持ち主の助手が話す行(仮)
// ライバルが「ほかの助手のマスモン」のとき、その持ち主の助手が会場で会う・試合のあとに話す。rival.js の asst の場面に足して出す。
// みゅあ・あつ以外の6人は仮(その助手のシナリオを書くとき・PLAN §10 の7〜 に直す)。口調は assistants.js の speech に合わせた。
// シナリオの助手が持ち主のとき(self)は rival.js の self の行を使い、ここの行は出さない。
// 形は README.md。
//   場面のid … ev.rival.owner.<助手>.<場面>
//     meet=会場で会う / win=持ち主のマスモン({rival})が勝った(プレイヤーは負けた) / lose=持ち主のマスモンが負けた(プレイヤーが勝った)
//   who … 持ち主の助手(mua / atsu / kiki / momosuke / dra / kyuko / sorashido / erubin)
const MONSUC_SCRIPT_RIVAL_OWNER = Object.freeze([
  { id:'ev.rival.owner.mua.meet.mua1', who:'mua', e:'wink', t:'{name}！ 今日はあたしの{rival}が相手だよ♪ 手加減しないからねｗ' },
  { id:'ev.rival.owner.mua.meet.mua1b', who:'mua', e:'wink', bond:[1,2], t:'{name}、今日はあたしの{rival}がお相手します♪ 手加減はしませんよ' },
  { id:'ev.rival.owner.mua.win.mua1', who:'mua', e:'happy', t:'{rival}の勝ちー！ でも{mon}もまぢ強かったよ✨' },
  { id:'ev.rival.owner.mua.win.mua1b', who:'mua', e:'happy', bond:[1,2], t:'{rival}が勝ちました！ でも{mon}も、とっても強かったです✨' },
  { id:'ev.rival.owner.mua.lose.mua1', who:'mua', e:'crying', t:'{mon}強すぎぢゃん！ {rival}、次はがんばろーね😭' },
  { id:'ev.rival.owner.mua.lose.mua1b', who:'mua', e:'crying', bond:[1,2], t:'{mon}、強かったです…！ {rival}、次はがんばりましょうね😭' },

  { id:'ev.rival.owner.atsu.meet.atsu1', who:'atsu', e:'excited', t:'{name}、今日は俺の{rival}が相手な。全力で来いよ笑' },
  { id:'ev.rival.owner.atsu.win.atsu1', who:'atsu', e:'happy', t:'{rival}の勝ち笑 でも{mon}、いい根性してたよ！' },
  { id:'ev.rival.owner.atsu.lose.atsu1', who:'atsu', e:'surprise', t:'やるじゃん{mon}。うちの{rival}に勝つとはな笑' },

  { id:'ev.rival.owner.kiki.meet.kiki1', who:'kiki', e:'normal', t:'あれま、{name}たちでつか。今日は{rival}で、えんりょなく押し切りまつよ ( ˘ω˘)9グッ!' },
  { id:'ev.rival.owner.kiki.win.kiki1', who:'kiki', e:'happy', t:'火力で押し切れました♪♪ {mon}も、とっても強かったでつよ' },
  { id:'ev.rival.owner.kiki.lose.kiki1', who:'kiki', e:'surprise', t:'そなのか……{mon}、お見事でつ (´ー`*)ウンウン 次は、もっと火力を上げてきまつ' },

  { id:'ev.rival.owner.momosuke.meet.momosuke1', who:'momosuke', e:'wink', t:'え、{name}じゃん！ ももの{rival}、強いよ？ 負けても泣かないでね♡' },
  { id:'ev.rival.owner.momosuke.win.momosuke1', who:'momosuke', e:'excited', t:'{rival}の勝ち〜！！ でも{mon}も結構やるじゃんw えらいえらい♡' },
  { id:'ev.rival.owner.momosuke.lose.momosuke1', who:'momosuke', e:'surprise', t:'え、負けた！？ {mon}つよすぎなんだけどw …次はももが勝つから！！' },

  { id:'ev.rival.owner.dra.meet.dra1', who:'dra', e:'happy', t:'お、{name}か。おでの{rival}は手ごわいぞ。……おでの膝ほどじゃないけどな、えへへ' },
  { id:'ev.rival.owner.dra.win.dra1', who:'dra', e:'happy', t:'おでの{rival}の勝ちだな。{mon}もいい動きだったよ。くさ' },
  { id:'ev.rival.owner.dra.lose.dra1', who:'dra', e:'surprise', t:'まじか、やられたわ。{mon}、強くなったな……えへへ' },

  { id:'ev.rival.owner.kyuko.meet.kyuko1', who:'kyuko', e:'normal', t:'ほい！ 今日は{rival}で行くよぉ。組み方には自信あるから笑' },
  { id:'ev.rival.owner.kyuko.win.kyuko1', who:'kyuko', e:'happy', t:'おけ〜、{rival}の勝ちぃ。{mon}の動きも悪くなかったよw' },
  { id:'ev.rival.owner.kyuko.lose.kyuko1', who:'kyuko', e:'crying', t:'ぐぬぬぬ…負けたぁ😭 {mon}、育て方うまいね。今度教えてぇ' },

  { id:'ev.rival.owner.sorashido.meet.sorashido1', who:'sorashido', e:'normal', t:'{name}、今日は自分の{rival}で挑ませてもらいます。勝率は計算済みです笑' },
  { id:'ev.rival.owner.sorashido.win.sorashido1', who:'sorashido', e:'happy', t:'計算どおりですね笑 {mon}も想定より強かったです' },
  { id:'ev.rival.owner.sorashido.lose.sorashido1', who:'sorashido', e:'surprise', t:'ほほー！ これは計算外でした・・・！ {mon}、強いですね笑' },

  { id:'ev.rival.owner.erubin.meet.erubin1', who:'erubin', e:'normal', t:'{name}、今日は{rival}が相手だよ。お互い、けがだけはしないようにね' },
  { id:'ev.rival.owner.erubin.win.erubin1', who:'erubin', e:'happy', t:'{rival}の勝ちだね。{mon}もよくがんばってたよね' },
  { id:'ev.rival.owner.erubin.lose.erubin1', who:'erubin', e:'happy', t:'{mon}の勝ちだね。ほんとに強くなったよね、見てて分かるよ' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_RIVAL_OWNER };
