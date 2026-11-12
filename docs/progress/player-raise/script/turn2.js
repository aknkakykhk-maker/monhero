// モンヒロサクセス 台本 第3弾: ターンごとのことばの追加(訓練Lvアップ・修行で覚えられなかった・砂時計でやり直す・ライバル大会の札)
// 形は turn.js・README.md と同じ。みゅあの行には Lv1・2 版(id の最後に b・bond:[1,2])を並べた。
//   turn.trainlv.up      … 訓練のLvが上がった({train}=訓練の名前)
//   turn.drill.nolearn   … 修行で技を覚えられなかった(覚えたときは turn.js の turn.drill.learn)
//   turn.retry.glass     … 時渡りの砂時計で、同じ相手とやり直す
//   turn.retry.rainbow   … 虹の時渡りの砂時計で、相手を変えてやり直す
//   turn.cup.rivalcard   … 大会を選ぶ画面で、ライバルのいる大会の札を見たとき({rival} / {owner})
const MONSUC_SCRIPT_TURN2 = Object.freeze([
  { id:'turn.trainlv.up.mua1', who:'mua', e:'excited', t:'{train}のLvが上がったよ！ これからもっと伸びるぢゃん✨' },
  { id:'turn.trainlv.up.mua1b', who:'mua', e:'excited', bond:[1,2], t:'{train}のLvが上がりました！ これからもっと伸びそうです✨' },
  { id:'turn.trainlv.up.mua2', who:'mua', e:'happy', t:'通いつめたかいあったね♪ {train}、レベルアップ！' },
  { id:'turn.trainlv.up.mua2b', who:'mua', e:'happy', bond:[1,2], t:'通いつめたかいがありましたね♪ {train}がレベルアップです！' },
  { id:'turn.trainlv.up.atsu1', who:'atsu', e:'happy', t:'{train}のLv上がったな。積んだ分だけ返ってくるんだよ笑' },
  { id:'turn.trainlv.up.atsu2', who:'atsu', e:'excited', t:'Lvアップ。ここからは伸び方が変わるよ！' },

  { id:'turn.drill.nolearn.mua1', who:'mua', e:'troubled', t:'うーん、今回は覚えられなかったね…。でも体の使い方はうまくなったよ！' },
  { id:'turn.drill.nolearn.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'今回は覚えられませんでしたね…。でも、体の使い方はうまくなりましたよ！' },
  { id:'turn.drill.nolearn.atsu1', who:'atsu', e:'normal', t:'残念笑 まぁ〜技はタイミングもあるから。次いこ！' },

  { id:'turn.retry.glass.mua1', who:'mua', e:'surprise', t:'砂時計がくるっと回って…さっきの試合の前に戻ってる！？ もう1回いこ！' },
  { id:'turn.retry.glass.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'砂時計が回って…試合の前に戻っています！？ もう1回いきましょう！' },
  { id:'turn.retry.glass.atsu1', who:'atsu', e:'excited', t:'同じ相手にもう1回な。負け方は分かってる、次は返す笑' },
  { id:'turn.retry.rainbow.mua1', who:'mua', e:'excited', t:'虹の砂時計キラキラすぎｗ 相手も変わったし、気分も新しくいこ！' },
  { id:'turn.retry.rainbow.mua1b', who:'mua', e:'excited', bond:[1,2], t:'虹の砂時計、キラキラしています！ 相手も変わったので、気持ちを新しくいきましょう！' },
  { id:'turn.retry.rainbow.atsu1', who:'atsu', e:'normal', t:'相手が変わったか。仕切り直しだな、いけるいける笑' },

  { id:'turn.cup.rivalcard.mua1', who:'mua', e:'surprise', t:'この大会、{owner}の{rival}が出るって書いてある！ どうする？' },
  { id:'turn.cup.rivalcard.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'この大会、{owner}の{rival}が出るそうです！ どうしますか？' },
  { id:'turn.cup.rivalcard.mua2', who:'mua', e:'wink', t:'ライバルがいる大会、勝ったらごほうびすごいんだって♪' },
  { id:'turn.cup.rivalcard.mua2b', who:'mua', e:'wink', bond:[1,2], t:'ライバルがいる大会は、勝つとごほうびが多いそうですよ♪' },
  { id:'turn.cup.rivalcard.atsu1', who:'atsu', e:'excited', t:'{rival}が出る大会な。勝てばでかい、行くしかないかー笑' },
  { id:'turn.cup.rivalcard.atsu2', who:'atsu', e:'normal', t:'ライバルの札か。今の{mon}なら、いい勝負になると思うよ笑' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_TURN2 };
