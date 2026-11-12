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

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_RIVAL };
