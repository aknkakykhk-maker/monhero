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

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_ISSA };
