// モンヒロサクセス 台本 第3弾: 持ちこみアイテムを使ったときの一言(ITEMS-REF.md の12種・名前は参考のまま。博士はイッサ博士)
// 始める前に使う物(1〜8)は育成のはじめに、育成中にも使える物(2・9〜12)は使ったターンに出す。
// 形は README.md。
//   場面のid … item.<アイテム>(guide=博士の導き書 / loupe=博士のルーペ / misanga=出会いのミサンガ / weekly=週刊!トレーニング /
//              hachimaki=修行のハチマキ / omamori=縁結びのお守り / kibidango=モモのキビダンゴ / uketsugi=うけつぎ草 /
//              juice=ガロエ印の野菜ジュース / akuyosan=悪様散 / license=ブリーダーライセンス / oily=オイリーパック)
//   who … mua / atsu(シナリオの助手)/ issa(博士の導き書・博士のルーペのときだけ)
const MONSUC_SCRIPT_ITEMS = Object.freeze([
  // 1. 博士の導き書(1度、イッサ博士が現れる)
  { id:'item.guide.mua1', who:'mua', e:'surprise', t:'これ、博士の書類ぢゃん…？ なんか呼んだら来そうｗ' },
  { id:'item.guide.mua1b', who:'mua', e:'surprise', bond:[1,2], t:'これ、博士の書類でしょうか…？ 持っていたら、博士が来てくれそうですね' },
  { id:'item.guide.atsu1', who:'atsu', e:'normal', t:'博士の書類か。持ってたら、そのうち取りに来るだろ笑' },
  { id:'item.guide.issa1', who:'issa', t:'あーっ！ それ、ぼくの大事な書類！ 拾ってくれたの？ お礼に装置、使わせてあげる！' },
  // 2. 博士のルーペ(博士の実験が成功する)
  { id:'item.loupe.mua1', who:'mua', e:'wink', t:'博士、ルーペ持ってきたよ！ これで手元ばっちりでしょ？ｗ' },
  { id:'item.loupe.mua1b', who:'mua', e:'wink', bond:[1,2], t:'博士、ルーペを持ってきました！ これで手元もばっちりですね' },
  { id:'item.loupe.atsu1', who:'atsu', e:'happy', t:'ほら博士、ルーペ。これで失敗したら言い訳できないな笑' },
  { id:'item.loupe.issa1', who:'issa', t:'あっ、ぼくのルーペ！ これがあれば今日は失敗しない！ …ほんとに！ ほんとだってば！' },
  // 3. 出会いのミサンガ(ようす「イベントメーカー」)
  { id:'item.misanga.mua1', who:'mua', e:'happy', t:'ミサンガ結んだら、なんかいいことありそー♪' },
  { id:'item.misanga.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ミサンガを結びました。いい出会いがありそうです♪' },
  { id:'item.misanga.atsu1', who:'atsu', e:'normal', t:'ミサンガね。今回はにぎやかな育成になりそうだな笑' },
  // 4. 週刊!トレーニング(ようす「トレーニング得意」)
  { id:'item.weekly.mua1', who:'mua', e:'normal', t:'週刊!トレーニング、ちゃんと読んだよ！ 今回はトレーニングまかせて👍' },
  { id:'item.weekly.mua1b', who:'mua', e:'normal', bond:[1,2], t:'週刊!トレーニング、しっかり読みました！ トレーニングはまかせてください👍' },
  { id:'item.weekly.atsu1', who:'atsu', e:'happy', t:'とりあえず読んどいた。トレーニングのコツ、だいたい分かったわ笑' },
  // 5. 修行のハチマキ(ようす「修行得意」)
  { id:'item.hachimaki.mua1', who:'mua', e:'excited', t:'ハチマキ巻いたら、{mon}の目つき変わったｗ 修行いけそー！' },
  { id:'item.hachimaki.mua1b', who:'mua', e:'excited', bond:[1,2], t:'ハチマキを巻いたら、{mon}の目つきが変わりました！ 修行がんばれそうです' },
  { id:'item.hachimaki.atsu1', who:'atsu', e:'excited', t:'ハチマキ、似合うじゃん。修行は任せた笑' },
  // 6. 縁結びのお守り(ようす「スターの素質○」)
  { id:'item.omamori.mua1', who:'mua', e:'wink', t:'縁結びのお守り！ {mon}、スターになっちゃうかもよ✨' },
  { id:'item.omamori.mua1b', who:'mua', e:'wink', bond:[1,2], t:'縁結びのお守りです！ {mon}、スターになれるかもしれませんよ✨' },
  { id:'item.omamori.atsu1', who:'atsu', e:'happy', t:'お守りか。人気も実力のうちだからな笑' },
  // 7. モモのキビダンゴ(体力の最大値が初めから上がる)
  { id:'item.kibidango.mua1', who:'mua', e:'happy', t:'キビダンゴもぐもぐ♪ {mon}、なんか体が大きく見えるｗ' },
  { id:'item.kibidango.mua1b', who:'mua', e:'happy', bond:[1,2], t:'キビダンゴを食べたら、{mon}の体力がぐんと増えた気がします♪' },
  { id:'item.kibidango.atsu1', who:'atsu', e:'normal', t:'キビダンゴ食べといた。体力の底上げは大事だよ笑' },
  // 8. うけつぎ草(ようす「うけつぐ魂」)
  { id:'item.uketsugi.mua1', who:'mua', e:'happy', t:'うけつぎ草！ 編成のみんなから、いっぱい教わろーね♪' },
  { id:'item.uketsugi.mua1b', who:'mua', e:'happy', bond:[1,2], t:'うけつぎ草です！ 編成のみんなから、たくさん教わりましょうね♪' },
  { id:'item.uketsugi.atsu1', who:'atsu', e:'normal', t:'うけつぎ草か。先輩の技、全部もらっていこ笑' },
  // 9. ガロエ印の野菜ジュース(体力を完全に回復する)
  { id:'item.juice.mua1', who:'mua', e:'excited', t:'野菜ジュースいっき飲み！ {mon}、元気100倍ぢゃん✨' },
  { id:'item.juice.mua1b', who:'mua', e:'excited', bond:[1,2], t:'野菜ジュースを飲みました！ {mon}、すっかり元気です✨' },
  { id:'item.juice.atsu1', who:'atsu', e:'happy', t:'野菜ジュースで全快。ここから詰めよ笑' },
  // 10. 悪様散(悪いようすを治して体力を回復する)
  { id:'item.akuyosan.mua1', who:'mua', e:'troubled', t:'にがーいお薬だけど、がんばって飲も！ …えらい、全部飲んだ！' },
  { id:'item.akuyosan.mua1b', who:'mua', e:'troubled', bond:[1,2], t:'にがいお薬ですけど、がんばって飲みましょう！ …全部飲めましたね、えらいです！' },
  { id:'item.akuyosan.atsu1', who:'atsu', e:'normal', t:'苦いけど効くやつ。これでスッキリするだろ笑' },
  // 11. ブリーダーライセンス(忠誠度が一定数上がる)
  { id:'item.license.mua1', who:'mua', e:'happy', t:'ライセンス見せたら、{mon}がキラキラした目で見てるｗ' },
  { id:'item.license.mua1b', who:'mua', e:'happy', bond:[1,2], t:'ライセンスを見せたら、{mon}がキラキラした目で{name}を見ています' },
  { id:'item.license.atsu1', who:'atsu', e:'happy', t:'ライセンスか。{mon}、ちゃんと信じてついてきてるよ笑' },
  // 12. オイリーパック(オイリーオイル（大）2個と夏美草1個のセット)
  { id:'item.oily.mua1', who:'mua', e:'normal', t:'オイリーパック開けた！ 中身いっぱいで助かるー♪' },
  { id:'item.oily.mua1b', who:'mua', e:'normal', bond:[1,2], t:'オイリーパックを開けました！ 中身がいっぱいで助かります♪' },
  { id:'item.oily.atsu1', who:'atsu', e:'normal', t:'オイリーパックね。中身は大事に使お笑' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_ITEMS };
