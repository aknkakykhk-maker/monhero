// 自動で作った写し(tools/build-card-tournament-bundle.js)。手で直さない。直すのは monster-hero/src/parts の元の部品
;
const CARD_REPLAY_RULES = 10;
;
// MFバトルカードのカードのデータ。tools/card/card-data-build.js が tools/art-sources/card-battle/*/cards.json から作る。
// ★手で書き換えない(書き写しの元は cards.json。効果の部品は card-data-build.js)。設計: docs/spec/CARD_BATTLE.md
const CARD_BATTLE_DATA = {"version":1,"cards":{"100":{"no":"100","name":"もちき","kind":"pow","damage":3,"guts":2,"text":"","user":"mocchi","wave":1,"ready":true,"effects":[],"img":"100"},"101":{"no":"101","name":"もっちゃん","kind":"pow","damage":5,"guts":3,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"101"},"102":{"no":"102","name":"ガッチャー","kind":"pow","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"102"},"103":{"no":"103","name":"ぺろりん","kind":"int","damage":2,"guts":2,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを1減らす。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":1}],"img":"103"},"104":{"no":"104","name":"さくら吹雪","kind":"int","damage":2,"guts":3,"text":"この技は全ての相手モンスターにダメージを与える。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"area","who":"enemies"}],"img":"104"},"105":{"no":"105","name":"モッチー砲","kind":"int","damage":6,"guts":4,"text":"","user":"mocchi","wave":1,"ready":true,"effects":[],"img":"105"},"106":{"no":"106","name":"まるまる","kind":"blk","damage":null,"guts":0,"text":"ちから技か、かしこさ技で与えられるダメージを−3する。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"reduce","kinds":["pow","int"],"n":3}],"img":"106"},"107":{"no":"107","name":"隠れる","kind":"blk","damage":null,"guts":1,"text":"ちから技か、かしこさ技の目標を自分から他の味方モンスターに変更する。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"redirect"}],"img":"107","note":"目標を移す先は、守る人が倒れていない味方から選びます。移した先のモンスターは、もう守れません"},"108":{"no":"108","name":"転がる","kind":"dge","damage":null,"guts":1,"text":"ちから技か、かしこさ技を回避する。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"108"},"109":{"no":"109","name":"緊急回避","kind":"dge","damage":null,"guts":0,"text":"ちから技か、かしこさ技を回避する。自分のガッツを全て失う。","user":"any","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]},{"t":"selfGutsAll"}],"img":"109"},"110":{"no":"110","name":"底力","kind":"spe","damage":null,"guts":1,"text":"このターンの、ライフが2以下のモンスターの技を使う前に、使用できる。その技のダメージを2倍にする。","user":"any","wave":1,"ready":true,"effects":[{"t":"attach","when":{"lifeMax":2}},{"t":"attachMult","n":2}],"img":"110"},"111":{"no":"111","name":"根性","kind":"blk","damage":null,"guts":2,"text":"ちから技か、かしこさ技でこのモンスターのライフがちょうど0になるとき、ライフ1で残る。","user":"any","wave":1,"ready":true,"effects":[{"t":"endure","kinds":["pow","int"]}],"img":"111","note":"残りのライフ以上のダメージでも、ライフ1で残ります"},"112":{"no":"112","name":"加勢","kind":"pow","damage":1,"guts":1,"text":"この技でモンスターのライフを0にしてはならない。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"nonLethal"}],"img":"112"},"113":{"no":"113","name":"カララギマンゴー","kind":"spe","damage":null,"guts":0,"text":"1体の味方モンスターのライフを1回復する。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"heal","n":1}],"img":"113"},"114":{"no":"114","name":"突進","kind":"spe","damage":null,"guts":3,"text":"攻撃のはじめ(最初のカード)に使う。山札の上から5枚をガッツにする。このターンは、ほかのカードを使用できない。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"rush","n":5}],"img":"114","note":"そのターンは、ほかの技・ブリーダーのカードを出せません(ガッツ置きはできます)"},"121":{"no":"121","name":"クリティカル","kind":"spe","damage":null,"guts":2,"text":"ちから技か、かしこさ技と同時に使用する。その技のダメージを+2する。","user":"any","wave":1,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachAdd","n":2}],"img":"121"},"122":{"no":"122","name":"最後の切札","kind":"spe","damage":null,"guts":0,"text":"手札の中から1枚のカードを山札に戻し、山札をシャッフルする。その後、自分の山札からカードを1枚引く。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"choose","src":"hand","then":"toDeckShuffleDraw"}],"img":"122"},"123":{"no":"123","name":"みんな下がれ","kind":"dge","damage":null,"guts":1,"text":"相手が複数のモンスターにダメージを与える技を使ったときに使用できる。その技を全員が回避する。","user":"any","wave":1,"ready":true,"effects":[{"t":"evadeAll"}],"img":"123"},"124":{"no":"124","name":"劇的な幕切れ","kind":"spe","damage":null,"guts":0,"text":"自分の山札が0のときに、ちから技か、かしこさ技と同時に使用できる。その技のダメージを3倍にする。","user":"any","wave":1,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"],"deckEmpty":true}},{"t":"attachMult","n":3}],"img":"124"},"125":{"no":"125","name":"後は頼んだ","kind":"spe","damage":null,"guts":0,"text":"このモンスターをKOする。残りのライフと同じ枚数のカードを、自分の捨て札からガッツにする。","user":"any","wave":1,"ready":true,"effects":[{"t":"lastWish"}],"img":"125","note":"捨て札の新しいほうから、残りライフの枚数をガッツにします"},"126":{"no":"126","name":"戦意喪失","kind":"spe","damage":null,"guts":5,"text":"お互いのガッツを0にする。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"gutsZeroBoth"}],"img":"126","note":"精神集中をしている相手のガッツは減りません。自分のガッツは必ず0になります"},"127":{"no":"127","name":"最後のきらめき","kind":"spe","damage":null,"guts":4,"text":"味方モンスターが1体の時に使用できる。山札のカードを全てガッツにする。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"useWhenAllies","n":1},{"t":"deckToGuts"}],"img":"127"},"128":{"no":"128","name":"ヒノトリの復活","kind":"spe","damage":null,"guts":2,"text":"KOされた「ヒノトリ」をライフ4で復活させる。そのターンは攻撃できない。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"revive","species":"phoenix","life":4}],"img":"128"},"129":{"no":"129","name":"くちばし","kind":"pow","damage":2,"guts":2,"text":"この技は回避されても、半分のダメージを与える。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"129"},"130":{"no":"130","name":"かぎづめ","kind":"pow","damage":3,"guts":2,"text":"","user":"phoenix","wave":2,"ready":true,"effects":[],"img":"130"},"131":{"no":"131","name":"火炎砲","kind":"int","damage":3,"guts":2,"text":"","user":"phoenix","wave":2,"ready":true,"effects":[],"img":"131"},"132":{"no":"132","name":"炎ハリケーン","kind":"int","damage":4,"guts":3,"text":"この技は回避されても、半分のダメージを与える。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"132"},"133":{"no":"133","name":"炎タイフーン","kind":"int","damage":6,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"133"},"134":{"no":"134","name":"ファイアリバー","kind":"int","damage":3,"guts":4,"text":"この技は地上にいる全ての相手モンスターにダメージを与える。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"area","who":"enemies","only":"ground"}],"img":"134"},"135":{"no":"135","name":"フレイムビーム","kind":"int","damage":8,"guts":5,"text":"","user":"phoenix","wave":2,"ready":true,"effects":[],"img":"135"},"136":{"no":"136","name":"ファイアウェーブ","kind":"int","damage":4,"guts":6,"text":"この技は地上にいる全ての相手モンスターにダメージを与える。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"area","who":"enemies","only":"ground"}],"img":"136"},"137":{"no":"137","name":"伝説のちから","kind":"spe","damage":null,"guts":1,"text":"自分の捨て札の中から1枚選んで、自分の山札の一番下に戻す。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"choose","src":"discard","then":"toDeckBottom"}],"img":"137"},"138":{"no":"138","name":"頭を隠す","kind":"blk","damage":null,"guts":1,"text":"ちから技か、かしこさ技で与えられるダメージを−3する。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"reduce","kinds":["pow","int"],"n":3}],"img":"138"},"139":{"no":"139","name":"洞察","kind":"dge","damage":null,"guts":0,"text":"ちから技を回避する。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["pow"]}],"img":"139"},"140":{"no":"140","name":"直感","kind":"dge","damage":null,"guts":0,"text":"かしこさ技を回避する。","user":"phoenix","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["int"]}],"img":"140"},"141":{"no":"141","name":"くし刺し","kind":"pow","damage":1,"guts":1,"text":"この技は防御によってダメージをマイナスされない。","user":"jell","wave":3,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"141"},"142":{"no":"142","name":"つきさし","kind":"pow","damage":2,"guts":1,"text":"","user":"jell","wave":3,"ready":true,"effects":[],"img":"142"},"143":{"no":"143","name":"ムチ","kind":"pow","damage":3,"guts":2,"text":"「ムチ」は同一ターンに連続して使用できる。","user":"jell","wave":3,"ready":true,"effects":[{"t":"chain","names":["ムチ"]}],"img":"143"},"144":{"no":"144","name":"ハエたたき","kind":"pow","damage":3,"guts":3,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"jell","wave":3,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"144"},"145":{"no":"145","name":"げんこつ","kind":"pow","damage":6,"guts":4,"text":"","user":"jell","wave":3,"ready":true,"effects":[],"img":"145"},"146":{"no":"146","name":"大砲","kind":"int","damage":4,"guts":3,"text":"","user":"jell","wave":3,"ready":true,"effects":[],"img":"146"},"147":{"no":"147","name":"パラボラビーム","kind":"int","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"jell","wave":3,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"147"},"148":{"no":"148","name":"ゲルコプター","kind":"int","damage":5,"guts":5,"text":"この技は空中にいる全ての相手モンスターにダメージを与える。","user":"jell","wave":3,"ready":true,"effects":[{"t":"area","who":"enemies","only":"air"}],"img":"148"},"149":{"no":"149","name":"ハテナマーク","kind":"spe","damage":null,"guts":0,"text":"相手ブリーダーの全ての手札を相手の山札の一番下に戻す。その後、相手ブリーダーはカードを4枚ドローする。","user":"jell","wave":3,"ready":true,"effects":[{"t":"oppHandToDeckBottom"},{"t":"oppDraw","n":4}],"img":"149"},"150":{"no":"150","name":"ものまね","kind":"spe","damage":null,"guts":1,"text":"ちから技と同時に使用する。全てのモンスターのちから技を、このモンスターが使用できる","user":"jell","wave":3,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"],"mimic":true}},{"t":"mimic"}],"img":"150","note":"手札のちから技なら、どの種族の技でもこのモンスターが出せます(一緒に出します)"},"151":{"no":"151","name":"うけとめる","kind":"blk","damage":null,"guts":0,"text":"ちから技で受けるダメージの半分(切り捨て)をマイナスする。","user":"jell","wave":3,"ready":true,"effects":[{"t":"reduceHalf","kinds":["pow"]}],"img":"151"},"152":{"no":"152","name":"グニャリ","kind":"dge","damage":null,"guts":1,"text":"かしこさ技を回避する。","user":"jell","wave":3,"ready":true,"effects":[{"t":"evade","kinds":["int"]}],"img":"152"},"153":{"no":"153","name":"アタック","kind":"pow","damage":2,"guts":2,"text":"「アタック」は同一ターンに連続して使用できる。","user":"monol","wave":2,"ready":true,"effects":[{"t":"chain","names":["アタック"]}],"img":"153"},"154":{"no":"154","name":"体当たり","kind":"pow","damage":4,"guts":2,"text":"この技を使用した場合、自分は2ダメージ受ける。","user":"monol","wave":2,"ready":true,"effects":[{"t":"selfDamage","n":2}],"img":"154"},"155":{"no":"155","name":"たおれこみ","kind":"pow","damage":5,"guts":3,"text":"この技を使用した場合、自分は2ダメージ受ける。","user":"monol","wave":2,"ready":true,"effects":[{"t":"selfDamage","n":2}],"img":"155"},"156":{"no":"156","name":"わらわら","kind":"pow","damage":2,"guts":5,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"monol","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"156"},"157":{"no":"157","name":"針かみつき","kind":"pow","damage":7,"guts":5,"text":"","user":"monol","wave":2,"ready":true,"effects":[],"img":"157"},"158":{"no":"158","name":"おんぱ","kind":"int","damage":2,"guts":2,"text":"","user":"monol","wave":2,"ready":true,"effects":[],"img":"158"},"159":{"no":"159","name":"サケビ声","kind":"int","damage":3,"guts":3,"text":"この技は回避されない。","user":"monol","wave":2,"ready":true,"effects":[{"t":"noEvade"}],"img":"159"},"160":{"no":"160","name":"ビーム","kind":"int","damage":4,"guts":3,"text":"","user":"monol","wave":2,"ready":true,"effects":[],"img":"160"},"161":{"no":"161","name":"フォーメーション","kind":"int","damage":8,"guts":6,"text":"","user":"monol","wave":2,"ready":true,"effects":[],"img":"161"},"162":{"no":"162","name":"衝撃吸収","kind":"blk","damage":null,"guts":2,"text":"ちから技で与えられるダメージを0にする。","user":"monol","wave":2,"ready":true,"effects":[{"t":"reduceAll","kinds":["pow"]}],"img":"162"},"163":{"no":"163","name":"盾になる","kind":"blk","damage":null,"guts":2,"text":"1回の攻撃技で、味方モンスターに与えられる全ダメージを、自分のダメージにする。","user":"monol","wave":2,"ready":true,"effects":[{"t":"shield"}],"img":"163","note":"全員に当たる技なら、味方のぶんを全部このモンスターが受けます。1体を狙う技なら、かばいます"},"164":{"no":"164","name":"縦になる","kind":"dge","damage":null,"guts":3,"text":"ちから技か、かしこさ技を回避する。","user":"monol","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"164"},"165":{"no":"165","name":"ピコピコハンマー","kind":"pow","damage":2,"guts":1,"text":"","user":"ghost","wave":2,"ready":true,"effects":[],"img":"165"},"166":{"no":"166","name":"大パンチ","kind":"pow","damage":3,"guts":2,"text":"","user":"ghost","wave":2,"ready":true,"effects":[],"img":"166"},"167":{"no":"167","name":"体当たり","kind":"pow","damage":4,"guts":2,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"167"},"168":{"no":"168","name":"コンビネーション","kind":"pow","damage":4,"guts":3,"text":"この技は回避されても、半分のダメージを与える。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"168"},"169":{"no":"169","name":"カード投げ","kind":"int","damage":0,"guts":0,"text":"この技を使うときに好きな枚数の手札を捨てる。こうして捨てた枚数をこの技のダメージにプラスする。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"tossBonus"}],"img":"169","note":"使うときに、捨てる手札を選びます(0枚でもよい)。捨てた枚数がダメージになります"},"170":{"no":"170","name":"ソウルビーム","kind":"int","damage":2,"guts":1,"text":"","user":"ghost","wave":2,"ready":true,"effects":[],"img":"170"},"171":{"no":"171","name":"びっくり","kind":"int","damage":1,"guts":2,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを2減らす。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":2}],"img":"171"},"172":{"no":"172","name":"ドクロビーム","kind":"int","damage":3,"guts":3,"text":"この技は回避されない。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"noEvade"}],"img":"172"},"173":{"no":"173","name":"ハトのおとしもの","kind":"int","damage":2,"guts":3,"text":"この技は全ての相手モンスターにダメージを与える。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"area","who":"enemies"}],"img":"173"},"174":{"no":"174","name":"のりうつる","kind":"spe","damage":null,"guts":0,"text":"KOされた味方モンスター1体を、このモンスターの今のライフで復活させ、このモンスターをKOにする。復活したモンスターは、このターンは攻撃できない。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"possess"}],"img":"174","note":"戻るモンスターのライフは、このモンスターの今のライフです(戻るモンスターのもとのライフより多くはなりません)。戻ったモンスターは、そのターン攻撃できません"},"175":{"no":"175","name":"ゴーストラッシュ","kind":"spe","damage":null,"guts":2,"text":"このターン、このモンスターは好きなだけ技カードを使用できる。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"unlimitedAttacks"}],"img":"175","note":"そのモンスターは、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)"},"176":{"no":"176","name":"帽子に隠れる","kind":"blk","damage":null,"guts":1,"text":"ちから技か、かしこさ技で与えられるダメージを0にする。","user":"ghost","wave":2,"ready":true,"effects":[{"t":"reduceAll","kinds":["pow","int"]}],"img":"176"},"177":{"no":"177","name":"パンチ","kind":"pow","damage":2,"guts":1,"text":"","user":"henger","wave":2,"ready":true,"effects":[],"img":"177"},"178":{"no":"178","name":"キック","kind":"pow","damage":2,"guts":2,"text":"「キック」は2枚同時に使用できる。2枚なら10のダメージを与える。","user":"henger","wave":2,"ready":true,"effects":[{"t":"pair","dmg":10}],"img":"178"},"179":{"no":"179","name":"ヨーヨー","kind":"pow","damage":2,"guts":3,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを1減らす。","user":"henger","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":1}],"img":"179"},"180":{"no":"180","name":"ロケットパンチ","kind":"pow","damage":4,"guts":3,"text":"この技は回避されても、半分のダメージを与える。","user":"henger","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"180"},"181":{"no":"181","name":"レーザーブレード","kind":"pow","damage":5,"guts":5,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを5減らす。","user":"henger","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":5}],"img":"181"},"182":{"no":"182","name":"ファイナルソード","kind":"int","damage":8,"guts":3,"text":"この技は自分のライフが2以下の時に使用できる。","user":"henger","wave":2,"ready":true,"effects":[{"t":"useWhen","lifeMax":2}],"img":"182"},"183":{"no":"183","name":"レーザー","kind":"int","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"henger","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"183"},"184":{"no":"184","name":"バーストキャノン","kind":"int","damage":8,"guts":5,"text":"","user":"henger","wave":2,"ready":true,"effects":[],"img":"184"},"185":{"no":"185","name":"変形","kind":"spe","damage":null,"guts":0,"text":"このモンスターの持ちょうを空中または地上にする。自分の山札からカードを1枚引く。","user":"henger","wave":2,"ready":true,"effects":[{"t":"form"},{"t":"draw","n":1}],"img":"185","note":"空中か地上かを選びます。次に変わるまで、ずっとそのままです"},"186":{"no":"186","name":"回避プログラム","kind":"spe","damage":null,"guts":1,"text":"自分の捨て札の中から、このモンスターが使用できる回避カード1枚を選んで手札に加える。","user":"henger","wave":2,"ready":true,"effects":[{"t":"choose","src":"discard","filter":{"kind":"dge","usable":true},"then":"toHand"}],"img":"186"},"187":{"no":"187","name":"見切り","kind":"dge","damage":null,"guts":0,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"henger","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"187"},"188":{"no":"188","name":"高速移動","kind":"dge","damage":null,"guts":1,"text":"ちから技か、かしこさ技を回避する。","user":"henger","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"188"},"189":{"no":"189","name":"ポッコ","kind":"pow","damage":2,"guts":1,"text":"この技は回避されても、半分のダメージを与える。","user":"mew","wave":3,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"189"},"190":{"no":"190","name":"ごっちん","kind":"pow","damage":3,"guts":1,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"mew","wave":3,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"190"},"191":{"no":"191","name":"ボンバ","kind":"pow","damage":2,"guts":2,"text":"この技は空中にいるモンスターには2倍のダメージを与える。","user":"mew","wave":3,"ready":true,"effects":[{"t":"multVs","type":"air","n":2}],"img":"191"},"192":{"no":"192","name":"ぐるぐる","kind":"pow","damage":3,"guts":4,"text":"この技は空中にいる全ての相手モンスターにダメージを与える。","user":"mew","wave":3,"ready":true,"effects":[{"t":"area","who":"enemies","only":"air"}],"img":"192"},"193":{"no":"193","name":"ポカポカ","kind":"pow","damage":5,"guts":4,"text":"この技は回避されない。","user":"mew","wave":3,"ready":true,"effects":[{"t":"noEvade"}],"img":"193"},"194":{"no":"194","name":"ぺったん","kind":"pow","damage":6,"guts":4,"text":"","user":"mew","wave":3,"ready":true,"effects":[],"img":"194"},"195":{"no":"195","name":"ニャーにゃー","kind":"int","damage":1,"guts":3,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"mew","wave":3,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"195"},"196":{"no":"196","name":"メーム","kind":"int","damage":4,"guts":4,"text":"この技は回避されない。","user":"mew","wave":3,"ready":true,"effects":[{"t":"noEvade"}],"img":"196"},"197":{"no":"197","name":"うたうニャ","kind":"spe","damage":null,"guts":0,"text":"このターン、好きなだけ「ブリーダーカード」を使用できる。","user":"mew","wave":3,"ready":true,"effects":[{"t":"breederUnlimited"}],"img":"197"},"198":{"no":"198","name":"ぬいぐるみ","kind":"spe","damage":null,"guts":0,"text":"このモンスターは次の自分のターンまでダメージを受けない。","user":"mew","wave":3,"ready":true,"effects":[{"t":"safe"}],"img":"198","note":"相手の技・はね返し・全員に当たる技・自分の技の反動も0にします"},"199":{"no":"199","name":"がまんニャ","kind":"blk","damage":null,"guts":0,"text":"ちから技で与えられるダメージを−2する。","user":"mew","wave":3,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":2}],"img":"199"},"200":{"no":"200","name":"にげるニャ","kind":"dge","damage":null,"guts":1,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"mew","wave":3,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"200"},"201":{"no":"201","name":"ビンタ","kind":"pow","damage":1,"guts":0,"text":"","user":"plant","wave":2,"ready":true,"effects":[],"img":"201"},"202":{"no":"202","name":"つっつき","kind":"pow","damage":2,"guts":1,"text":"","user":"plant","wave":2,"ready":true,"effects":[],"img":"202"},"203":{"no":"203","name":"種ガン","kind":"pow","damage":2,"guts":2,"text":"「種ガン」は同一ターンに連続して使用できる。","user":"plant","wave":2,"ready":true,"effects":[{"t":"chain","names":["種ガン"]}],"img":"203"},"204":{"no":"204","name":"根っこ","kind":"pow","damage":3,"guts":2,"text":"この技は空中にいるモンスターには、ダメージを与えられない。","user":"plant","wave":2,"ready":true,"effects":[{"t":"cannotHit","type":"air"}],"img":"204"},"205":{"no":"205","name":"フェイスドリル","kind":"pow","damage":4,"guts":3,"text":"この技は空中にいるモンスターには、ダメージを与えられない。","user":"plant","wave":2,"ready":true,"effects":[{"t":"cannotHit","type":"air"}],"img":"205"},"206":{"no":"206","name":"ミツ","kind":"int","damage":2,"guts":3,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを3減らす。","user":"plant","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":3}],"img":"206"},"207":{"no":"207","name":"花粉","kind":"int","damage":2,"guts":4,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを5減らす。","user":"plant","wave":2,"ready":true,"effects":[{"t":"gutsLossOnHit","n":5}],"img":"207"},"208":{"no":"208","name":"ドレイン","kind":"int","damage":3,"guts":6,"text":"この技で与えたダメージ分、自分のライフを回復する。","user":"plant","wave":2,"ready":true,"effects":[{"t":"drain"}],"img":"208"},"209":{"no":"209","name":"光合成","kind":"spe","damage":null,"guts":0,"text":"このターンの自分のちから技かかしこさ技を使う前に使用できる。その技を使用するのに必要なガッツを−2する。","user":"plant","wave":2,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachCost","n":2}],"img":"209","note":"技に付けて一緒に出します(攻撃の1回には数えません)"},"210":{"no":"210","name":"根を張る","kind":"spe","damage":null,"guts":2,"text":"次の自分のちから技1回のダメージを2倍する。この効果はダメージを受けると終了する。","user":"plant","wave":2,"ready":true,"effects":[{"t":"charge","kinds":["pow"],"n":2}],"img":"210"},"211":{"no":"211","name":"葉を切らす","kind":"blk","damage":null,"guts":0,"text":"ちから技で受けるダメージの半分(切り捨て)をマイナスする。","user":"plant","wave":2,"ready":true,"effects":[{"t":"reduceHalf","kinds":["pow"]}],"img":"211"},"212":{"no":"212","name":"こらえる","kind":"blk","damage":null,"guts":1,"text":"ちから技か、かしこさ技で与えられるダメージを−2する。","user":"plant","wave":2,"ready":true,"effects":[{"t":"reduce","kinds":["pow","int"],"n":2}],"img":"212"},"213":{"no":"213","name":"牙きり","kind":"pow","damage":3,"guts":3,"text":"この技は空中にいるモンスターには2倍のダメージを与える。","user":"worm","wave":3,"ready":true,"effects":[{"t":"multVs","type":"air","n":2}],"img":"213"},"214":{"no":"214","name":"しっぽキック","kind":"pow","damage":3,"guts":3,"text":"「しっぽキック」は2枚同時に使用できる。2枚なら12のダメージを与える。","user":"worm","wave":3,"ready":true,"effects":[{"t":"pair","dmg":12}],"img":"214"},"215":{"no":"215","name":"かみつき","kind":"pow","damage":3,"guts":3,"text":"この技は防御によってダメージをマイナスされない。","user":"worm","wave":3,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"215"},"216":{"no":"216","name":"くしざし","kind":"pow","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"worm","wave":3,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"216"},"217":{"no":"217","name":"バックドロップ","kind":"pow","damage":5,"guts":5,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"worm","wave":3,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"217"},"218":{"no":"218","name":"空中回転アタック","kind":"pow","damage":8,"guts":6,"text":"この技は回避されても、半分のダメージを与える。","user":"worm","wave":3,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"218"},"219":{"no":"219","name":"きりもみアタック","kind":"pow","damage":10,"guts":7,"text":"","user":"worm","wave":3,"ready":true,"effects":[],"img":"219"},"220":{"no":"220","name":"毒煙幕","kind":"int","damage":3,"guts":5,"text":"この技は自分以外の全てのモンスターにダメージを与える。","user":"worm","wave":3,"ready":true,"effects":[{"t":"area","who":"others"}],"img":"220"},"221":{"no":"221","name":"まゆ化","kind":"spe","damage":null,"guts":0,"text":"このモンスターは「羽化」以外のカードを使用できない。","user":"worm","wave":3,"ready":true,"effects":[{"t":"cocoon"}],"img":"221"},"222":{"no":"222","name":"羽化","kind":"spe","damage":null,"guts":0,"text":"この技は「まゆ化」したモンスターが使用できる。このモンスターを「ワームがSUB」の派生モンスターと取りかえる。取りかえたモンスターは、ライフが最大まで回復する。","user":"worm","wave":3,"ready":true,"effects":[{"t":"emerge","to":"C-062"}],"img":"222","note":"取りかえる先はムラサキチュウです。ライフは、ムラサキチュウの最大まで回復します"},"223":{"no":"223","name":"こうらで守る","kind":"blk","damage":null,"guts":2,"text":"ちから技で与えられるダメージを−3する。","user":"worm","wave":3,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":3}],"img":"223"},"224":{"no":"224","name":"横ジャンプ","kind":"dge","damage":null,"guts":2,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"worm","wave":3,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"224"},"225":{"no":"225","name":"しっぽアタック","kind":"pow","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"225"},"226":{"no":"226","name":"かみつき","kind":"pow","damage":6,"guts":4,"text":"","user":"dragon","wave":2,"ready":true,"effects":[],"img":"226"},"227":{"no":"227","name":"コンビネーション","kind":"pow","damage":8,"guts":4,"text":"「しっぽアタック」「かみつき」を、この技と同時に出さなければならない。「しっぽアタック」と「かみつき」の消費ガッツ、ダメージは無視される。この技は全ての相手モンスターにダメージを与える。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"requires","names":["しっぽアタック","かみつき"]},{"t":"area","who":"enemies"}],"img":"227","note":"「しっぽアタック」「かみつき」が手札に1枚ずつあるときだけ出せます。3枚を一緒に出し、払うガッツは4だけです"},"228":{"no":"228","name":"ウィングカッター","kind":"pow","damage":4,"guts":5,"text":"この技は空中にいる全ての相手モンスターにダメージを与える。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"area","who":"enemies","only":"air"}],"img":"228"},"229":{"no":"229","name":"クローアタック","kind":"pow","damage":5,"guts":5,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"229"},"230":{"no":"230","name":"ドラゴンパンチ","kind":"pow","damage":8,"guts":5,"text":"","user":"dragon","wave":2,"ready":true,"effects":[],"img":"230"},"231":{"no":"231","name":"ふみつけ","kind":"pow","damage":12,"guts":7,"text":"","user":"dragon","wave":2,"ready":true,"effects":[],"img":"231"},"232":{"no":"232","name":"ドラゴンラッシュ","kind":"pow","damage":14,"guts":8,"text":"この技は回避されても、半分のダメージを与える。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"232"},"233":{"no":"233","name":"ファイアブレス","kind":"int","damage":3,"guts":4,"text":"この技は地上にいる全ての相手モンスターにダメージを与える。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"area","who":"enemies","only":"ground"}],"img":"233"},"234":{"no":"234","name":"ほうり上げる","kind":"spe","damage":null,"guts":0,"text":"1体の相手モンスターの持ちょうを空中にする。ターン終了時に、そのモンスターは本来の持ちょうに戻る。このモンスターはもう1回攻撃できる。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"liftTarget"},{"t":"extraAttack","n":1}],"img":"234"},"235":{"no":"235","name":"ハガネのウロコ","kind":"blk","damage":null,"guts":0,"text":"ちから技で与えられるダメージを−3する。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":3}],"img":"235"},"236":{"no":"236","name":"飛び上がる","kind":"dge","damage":null,"guts":2,"text":"ちから技を回避する。次のターンの自分のちから技か、かしこさ技のダメージが2倍する。次のターン終了まで、このモンスターの持ちょうを空中にする。","user":"dragon","wave":2,"ready":true,"effects":[{"t":"evade","kinds":["pow"]},{"t":"nextTurnMult","kinds":["pow","int"],"n":2},{"t":"becomeAir"}],"img":"236"},"237":{"no":"237","name":"まっぷたつ","kind":"pow","damage":2,"guts":1,"text":"","user":"durahan","wave":3,"ready":true,"effects":[],"img":"237"},"238":{"no":"238","name":"居合斬り","kind":"pow","damage":4,"guts":2,"text":"この技は空中にいるモンスターには、ダメージを与えられない。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"cannotHit","type":"air"}],"img":"238"},"239":{"no":"239","name":"乱れ突き","kind":"pow","damage":3,"guts":3,"text":"この技は回避されない。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"noEvade"}],"img":"239"},"240":{"no":"240","name":"Vの字斬り","kind":"pow","damage":5,"guts":3,"text":"","user":"durahan","wave":3,"ready":true,"effects":[],"img":"240"},"241":{"no":"241","name":"最終奥義","kind":"pow","damage":8,"guts":3,"text":"この技は自分のライフが2以下の時に使用できる。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"useWhen","lifeMax":2}],"img":"241"},"242":{"no":"242","name":"冥王剣","kind":"pow","damage":8,"guts":4,"text":"この技が回避された場合、自分は3ダメージを受ける。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"selfDamageIfEvaded","n":3}],"img":"242"},"243":{"no":"243","name":"風神剣","kind":"int","damage":5,"guts":4,"text":"この技は回避されない。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"noEvade"}],"img":"243"},"244":{"no":"244","name":"雷神剣","kind":"int","damage":7,"guts":4,"text":"","user":"durahan","wave":3,"ready":true,"effects":[],"img":"244"},"245":{"no":"245","name":"精神集中","kind":"spe","damage":null,"guts":0,"text":"次のターンまで、相手によってガッツを減らされる効果を無効にする。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"gutsGuard"}],"img":"245"},"246":{"no":"246","name":"静の構え","kind":"spe","damage":null,"guts":0,"text":"次の自分のかしこさ技1回のダメージを2倍にする。この効果はダメージを受けると終了する。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"charge","kinds":["int"],"n":2}],"img":"246"},"247":{"no":"247","name":"盾で受ける","kind":"blk","damage":null,"guts":0,"text":"かしこさ技で与えられるダメージを−3する。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"reduce","kinds":["int"],"n":3}],"img":"247"},"248":{"no":"248","name":"剣で受ける","kind":"blk","damage":null,"guts":0,"text":"ちから技で与えられるダメージを−3する。","user":"durahan","wave":3,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":3}],"img":"248"},"249":{"no":"249","name":"肉を切らせて","kind":"blk","damage":null,"guts":0,"text":"ちから技を受けるときに使用する。受けるダメージは2倍になる。次のターン、このモンスターのちから技のダメージを3倍にする。","user":"any","wave":2,"ready":true,"effects":[{"t":"takeMult","kinds":["pow"],"n":2},{"t":"nextTurnMult","kinds":["pow"],"n":3}],"img":"249"},"250":{"no":"250","name":"孤軍奮闘","kind":"spe","damage":null,"guts":1,"text":"味方モンスターが1体の時に使用できる。このターン、このモンスターはもう一回攻撃できる。","user":"any","wave":2,"ready":true,"effects":[{"t":"useWhenAllies","n":1},{"t":"extraAttack","n":1}],"img":"250"},"251":{"no":"251","name":"怒り","kind":"spe","damage":null,"guts":1,"text":"次の自分のターンまで、このモンスターは回避・防御のカードを使用できない。次のターン、このモンスターの技のダメージを2倍にする。","user":"any","wave":2,"ready":true,"effects":[{"t":"rage"}],"img":"251","note":"次のターンのちから技・かしこさ技が2倍になります"},"252":{"no":"252","name":"時間稼ぎ","kind":"spe","damage":null,"guts":0,"text":"自分のガッツを山札に戻す。その後、山札をシャッフルする。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"gutsToDeckShuffle"}],"img":"252"},"253":{"no":"253","name":"冬虫散","kind":"spe","damage":null,"guts":0,"text":"1体の味方モンスターのライフを1減らす。自分の山札からカードを1枚引く。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"selfHurt","n":1},{"t":"draw","n":1}],"img":"253","note":"ライフ1のモンスターにも使えて、そのモンスターはKOになります"},"254":{"no":"254","name":"オイリーオイル","kind":"spe","damage":null,"guts":2,"text":"このターン、既に攻撃したモンスターに使用する。そのモンスターは、もう一回攻撃できる。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"extraAttackTarget","n":1}],"img":"254"},"261":{"no":"261","name":"ひっかき","kind":"pow","damage":2,"guts":2,"text":"","user":"zilla","wave":3,"ready":true,"effects":[],"img":"261"},"262":{"no":"262","name":"はら","kind":"pow","damage":3,"guts":3,"text":"","user":"zilla","wave":3,"ready":true,"effects":[],"img":"262"},"263":{"no":"263","name":"しっぽビンタ","kind":"pow","damage":4,"guts":4,"text":"この技は回避されても、半分のダメージを与える。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"263"},"264":{"no":"264","name":"ボディプレス","kind":"pow","damage":8,"guts":5,"text":"この技が回避された場合、自分は2ダメージを受ける。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"selfDamageIfEvaded","n":2}],"img":"264"},"265":{"no":"265","name":"ぐるぐるプレス","kind":"pow","damage":10,"guts":6,"text":"この技が回避された場合、自分は3ダメージを受ける。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"selfDamageIfEvaded","n":3}],"img":"265"},"266":{"no":"266","name":"くしゃみ","kind":"int","damage":1,"guts":2,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを1減らす。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"gutsLossOnHit","n":1}],"img":"266"},"267":{"no":"267","name":"しゃぼんアタック","kind":"int","damage":1,"guts":5,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"267"},"268":{"no":"268","name":"大津波","kind":"int","damage":4,"guts":7,"text":"この技は自分以外の全ての地上にいるモンスターにダメージを与える。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"area","who":"others","only":"ground"}],"img":"268"},"269":{"no":"269","name":"たちはだかる","kind":"spe","damage":null,"guts":0,"text":"次のターン、相手モンスターは、このモンスター以外の味方モンスターにダメージを与える技を、使用できない。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"taunt","mode":"only","noArea":true}],"img":"269","note":"相手は次のターン、このモンスターを狙う技しか出せません(全員に当たる技も出せません)"},"270":{"no":"270","name":"吹き上げる","kind":"blk","damage":null,"guts":1,"text":"この技は自分が目標でなくても使用できる。次のターン終了まで、自分以外の全ての味方モンスターの持ちょうを、空中にする。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"liftAllies"}],"img":"270"},"271":{"no":"271","name":"気にしない","kind":"blk","damage":null,"guts":1,"text":"ちから技で与えられるダメージを−3する。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":3}],"img":"271"},"272":{"no":"272","name":"はねかえす","kind":"blk","damage":null,"guts":4,"text":"ちから技によって与えられるダメージを使用したモンスターに反射する。特別な効果は反射しない。","user":"zilla","wave":3,"ready":true,"effects":[{"t":"reflect","kinds":["pow"],"frac":1}],"img":"272"},"273":{"no":"273","name":"吹き飛ばし","kind":"spe","damage":null,"guts":0,"text":"相手モンスター1体を選ぶ。そのモンスターは次のターン攻撃できない。","user":"any","wave":3,"ready":true,"effects":[{"t":"stunTarget"}],"img":"273","note":"技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます"},"274":{"no":"274","name":"集中","kind":"spe","damage":null,"guts":1,"text":"ちから技か、かしこさ技と同時に使用する。この技に対して、消費ガッツ0の回避・防御のカードは使用できない。","user":"any","wave":3,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachNoZeroGuard"}],"img":"274"},"275":{"no":"275","name":"我慢","kind":"blk","damage":null,"guts":1,"text":"ちから技やかしこさ技によるガッツ減少を無効にする。","user":"any","wave":3,"ready":true,"effects":[{"t":"noGutsLoss"}],"img":"275"},"276":{"no":"276","name":"ジョイのサポート","kind":"spe","damage":null,"guts":0,"text":"消費ガッツが3以下の技の「ブリーダーカード」(全体カードは除く)と同時に使用する。その技はガッツを消費せずに使用できる。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"attach","when":{"breederMaxGuts":3}},{"t":"attachFree"}],"img":"276"},"277":{"no":"277","name":"意味不明","kind":"spe","damage":null,"guts":1,"text":"この技を受けたモンスターは、次のターン攻撃できない。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"stunTarget"}],"img":"277"},"278":{"no":"278","name":"泣き真似","kind":"spe","damage":null,"guts":1,"text":"相手ブリーダーはガッツを1減らす。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"oppGutsLoss","n":1}],"img":"278"},"279":{"no":"279","name":"リフレッシュ","kind":"spe","damage":null,"guts":1,"text":"手札を全部捨て、捨てた枚数だけ山札からカードを引く。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"refresh"}],"img":"279"},"280":{"no":"280","name":"おいのり","kind":"blk","damage":null,"guts":0,"text":"この技は相手ブリーダーが「全体カード」を使用した瞬間に使用できる。全体カードを場から無くす。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"pray"}],"img":"280","note":"相手が全体カードを出した瞬間に出せます(相手のターンでも出せます)。その全体カードは効かずに捨て札へ行き、前から場にあった全体カードはそのまま残ります"},"285":{"no":"285","name":"右掌","kind":"pow","damage":1,"guts":0,"text":"「左掌」と同時に使用できる。2種類なら4ダメージを与える。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"combo","names":["右掌","左掌"],"table":{"2":4}}],"img":"285"},"286":{"no":"286","name":"左掌","kind":"pow","damage":1,"guts":0,"text":"「右掌」と同時に使用できる。2種類なら4ダメージを与える。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"combo","names":["右掌","左掌"],"table":{"2":4}}],"img":"286"},"287":{"no":"287","name":"右たん脚","kind":"pow","damage":2,"guts":1,"text":"「右たん脚」は同一ターンに連続して使用できる。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"chain","names":["右たん脚"]}],"img":"287"},"288":{"no":"288","name":"ポン拳","kind":"pow","damage":1,"guts":2,"text":"この技でダメージを与えた場合、このカードは捨て札にならずに手札に戻る。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"returnOnHit"}],"img":"288"},"289":{"no":"289","name":"ちょうちゅう","kind":"pow","damage":2,"guts":2,"text":"この技は回避されても、半分のダメージを与える。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"289"},"290":{"no":"290","name":"連たん脚","kind":"pow","damage":3,"guts":2,"text":"","user":"metalner","wave":4,"ready":true,"effects":[],"img":"290"},"291":{"no":"291","name":"大極変化","kind":"pow","damage":6,"guts":4,"text":"","user":"metalner","wave":4,"ready":true,"effects":[],"img":"291"},"292":{"no":"292","name":"メタビーム","kind":"int","damage":4,"guts":3,"text":"","user":"metalner","wave":4,"ready":true,"effects":[],"img":"292"},"293":{"no":"293","name":"トランスフォーム","kind":"spe","damage":null,"guts":0,"text":"このモンスターの持ちょうを空中または地上にする。自分の山札からカードを1枚引く。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"form"},{"t":"draw","n":1}],"img":"293","note":"空中か地上かを選びます。次に変わるまで、ずっとそのままです"},"294":{"no":"294","name":"タイムディレイ","kind":"spe","damage":null,"guts":1,"text":"このターン、このモンスターは好きなだけ技カードを使用できる。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"unlimitedAttacks"}],"img":"294","note":"そのモンスターは、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)"},"295":{"no":"295","name":"メタルコート","kind":"blk","damage":null,"guts":0,"text":"ちから技で与えられるダメージを−2する。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":2}],"img":"295"},"296":{"no":"296","name":"メタルガード","kind":"blk","damage":null,"guts":1,"text":"ちから技か、かしこさ技で与えられるダメージを−2する。","user":"metalner","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow","int"],"n":2}],"img":"296"},"297":{"no":"297","name":"デスパンチ","kind":"pow","damage":2,"guts":2,"text":"","user":"joker","wave":4,"ready":true,"effects":[],"img":"297"},"298":{"no":"298","name":"デスナックル","kind":"pow","damage":3,"guts":3,"text":"","user":"joker","wave":4,"ready":true,"effects":[],"img":"298"},"299":{"no":"299","name":"デススラッシュ","kind":"pow","damage":6,"guts":4,"text":"","user":"joker","wave":4,"ready":true,"effects":[],"img":"299"},"300":{"no":"300","name":"デスファイナル","kind":"pow","damage":3,"guts":5,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"joker","wave":4,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"300"},"301":{"no":"301","name":"デスエナジー","kind":"int","damage":2,"guts":3,"text":"この技は回避されない。","user":"joker","wave":4,"ready":true,"effects":[{"t":"noEvade"}],"img":"301"},"302":{"no":"302","name":"デスカッター","kind":"int","damage":4,"guts":3,"text":"","user":"joker","wave":4,"ready":true,"effects":[],"img":"302"},"303":{"no":"303","name":"悪夢","kind":"spe","damage":null,"guts":0,"text":"自分の捨て札の中から、このモンスターが使用できる、攻撃用カード1枚を選んで手札に加える。","user":"joker","wave":4,"ready":true,"effects":[{"t":"choose","src":"discard","filter":{"attack":true,"usable":true},"then":"toHand"}],"img":"303"},"304":{"no":"304","name":"死神の力","kind":"spe","damage":null,"guts":2,"text":"相手の手札の内容を見る。その中から1枚を、あなたが選んで捨てさせる。","user":"joker","wave":4,"ready":true,"effects":[{"t":"peekPick"}],"img":"304"},"305":{"no":"305","name":"恐怖","kind":"spe","damage":null,"guts":2,"text":"このターン、相手モンスターは防御技を使用できない。","user":"joker","wave":4,"ready":true,"effects":[{"t":"forbidThisTurn","kinds":["blk"]}],"img":"305"},"306":{"no":"306","name":"大鎌","kind":"spe","damage":null,"guts":3,"text":"相手の山札を3枚、捨て札にする。","user":"joker","wave":4,"ready":true,"effects":[{"t":"millOpp","n":3}],"img":"306"},"307":{"no":"307","name":"鎌で受ける","kind":"blk","damage":null,"guts":2,"text":"ちから技か、かしこさ技で与えられるダメージを−3する。","user":"joker","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow","int"],"n":3}],"img":"307"},"308":{"no":"308","name":"予感","kind":"dge","damage":null,"guts":2,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"joker","wave":4,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"308"},"309":{"no":"309","name":"ズームパンチ","kind":"pow","damage":2,"guts":2,"text":"この技は回避されない。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"noEvade"}],"img":"309"},"310":{"no":"310","name":"パンチ","kind":"pow","damage":3,"guts":2,"text":"","user":"arrowhead","wave":4,"ready":true,"effects":[],"img":"310"},"311":{"no":"311","name":"ニードルターン","kind":"pow","damage":4,"guts":3,"text":"","user":"arrowhead","wave":4,"ready":true,"effects":[],"img":"311"},"312":{"no":"312","name":"地雷針","kind":"pow","damage":4,"guts":4,"text":"この技は地上にいるモンスターには2倍のダメージを与える。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"multVs","type":"ground","n":2}],"img":"312"},"313":{"no":"313","name":"大旋風","kind":"pow","damage":4,"guts":4,"text":"この技は空中にいるモンスターには2倍のダメージを与える。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"multVs","type":"air","n":2}],"img":"313"},"314":{"no":"314","name":"クロー","kind":"pow","damage":4,"guts":4,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"314"},"315":{"no":"315","name":"怪光弾","kind":"int","damage":1,"guts":2,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを1減らす。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"gutsLossOnHit","n":1}],"img":"315"},"316":{"no":"316","name":"ニードル","kind":"int","damage":2,"guts":2,"text":"この技は回避されても、半分のダメージを与える。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"316"},"317":{"no":"317","name":"ファイナルボム","kind":"int","damage":7,"guts":5,"text":"","user":"arrowhead","wave":4,"ready":true,"effects":[],"img":"317"},"318":{"no":"318","name":"ひきずりこむ","kind":"blk","damage":null,"guts":0,"text":"この技は自分が目標でなくても使用できる。このターン、全ての味方モンスターの持ちょうを水中にする。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"waterAll"}],"img":"318"},"319":{"no":"319","name":"頑丈な殻","kind":"blk","damage":null,"guts":1,"text":"ちから技で与えられるダメージを−4する。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":4}],"img":"319"},"320":{"no":"320","name":"後ずさる","kind":"dge","damage":null,"guts":2,"text":"1以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"arrowhead","wave":4,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":1}],"img":"320"},"321":{"no":"321","name":"後足キック","kind":"pow","damage":1,"guts":0,"text":"","user":"centaur","wave":4,"ready":true,"effects":[],"img":"321"},"322":{"no":"322","name":"スマッシュ","kind":"pow","damage":2,"guts":1,"text":"","user":"centaur","wave":4,"ready":true,"effects":[],"img":"322"},"323":{"no":"323","name":"ハイパー突き","kind":"pow","damage":3,"guts":2,"text":"この技は防御によってダメージをマイナスされない。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"323"},"324":{"no":"324","name":"きりすて","kind":"pow","damage":4,"guts":2,"text":"この技は地上にいるモンスターにしかダメージを与えられない。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"onlyHit","type":"ground"}],"img":"324"},"325":{"no":"325","name":"3段突き","kind":"pow","damage":4,"guts":3,"text":"この技は防御によってダメージをマイナスされない。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"325"},"326":{"no":"326","name":"サテラアタック","kind":"pow","damage":7,"guts":4,"text":"この技は地上にいるモンスターにしかダメージを与えられない。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"onlyHit","type":"ground"}],"img":"326"},"327":{"no":"327","name":"メテオドライブ","kind":"pow","damage":8,"guts":5,"text":"この技は防御によってダメージをマイナスされない。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"327"},"328":{"no":"328","name":"エネルギー弾","kind":"int","damage":3,"guts":2,"text":"","user":"centaur","wave":4,"ready":true,"effects":[],"img":"328"},"329":{"no":"329","name":"マインドフレア","kind":"int","damage":4,"guts":3,"text":"","user":"centaur","wave":4,"ready":true,"effects":[],"img":"329"},"330":{"no":"330","name":"捨て身","kind":"spe","damage":null,"guts":1,"text":"ちから技と同時に使用する。その技のダメージを2倍する。その技が回避されなかった場合、自分は2ダメージ受ける。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"]}},{"t":"attachMult","n":2},{"t":"attachSelfIfHit","n":2}],"img":"330"},"331":{"no":"331","name":"ヤリで受ける","kind":"blk","damage":null,"guts":2,"text":"ちから技で与えられるダメージを−3する。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":3}],"img":"331"},"332":{"no":"332","name":"飛び退く","kind":"dge","damage":null,"guts":3,"text":"ちから技か、かしこさ技を回避する。","user":"centaur","wave":4,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"332"},"333":{"no":"333","name":"ヒップアタック","kind":"pow","damage":1,"guts":0,"text":"「ヒップアタック」は同一ターンに連続して使用できる。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"chain","names":["ヒップアタック"]}],"img":"333"},"334":{"no":"334","name":"かま首突き","kind":"pow","damage":2,"guts":1,"text":"","user":"colorpandora","wave":4,"ready":true,"effects":[],"img":"334"},"335":{"no":"335","name":"デス・ドミノ","kind":"pow","damage":3,"guts":2,"text":"この技は地上にいるモンスターにしかダメージを与えられない。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"onlyHit","type":"ground"}],"img":"335"},"336":{"no":"336","name":"ねずみ花火","kind":"pow","damage":2,"guts":3,"text":"この技は自分以外の全ての地上にいるモンスターにダメージを与える。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"area","who":"others","only":"ground"}],"img":"336"},"337":{"no":"337","name":"マッハトルネード","kind":"pow","damage":4,"guts":3,"text":"","user":"colorpandora","wave":4,"ready":true,"effects":[],"img":"337"},"338":{"no":"338","name":"いけにえ","kind":"pow","damage":6,"guts":3,"text":"この技を使用した場合、自分は3ダメージ受ける。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"selfDamage","n":3}],"img":"338"},"339":{"no":"339","name":"メテオドライブ","kind":"pow","damage":10,"guts":5,"text":"この技を使用した場合、自分は3ダメージ受ける。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"selfDamage","n":3}],"img":"339"},"340":{"no":"340","name":"ショットガン","kind":"int","damage":2,"guts":2,"text":"この技のダメージは複数の相手モンスターに割り振れる。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"split"}],"img":"340","note":"ダメージを1点ずつ、相手のモンスターに割り振ります(1体に全部でもよい)。守りは割り振られたモンスターごとに出せます"},"341":{"no":"341","name":"デルタアタック","kind":"int","damage":3,"guts":4,"text":"この技は回避されない。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"noEvade"}],"img":"341"},"342":{"no":"342","name":"友情の証","kind":"spe","damage":null,"guts":0,"text":"このターン、全ての味方モンスターは「特殊技」を0ガッツで使用できる。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"freeSpeThisTurn"}],"img":"342","note":"出したモンスターの攻撃1回に数えます。そのターン、ほかの味方の特殊技は0ガッツで出せます"},"343":{"no":"343","name":"団結","kind":"spe","damage":null,"guts":0,"text":"ちから技かかしこさ技と同時に使用する。その技を使用するのに必要なガッツを−1する。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachCost","n":1}],"img":"343"},"344":{"no":"344","name":"コロガル","kind":"dge","damage":null,"guts":1,"text":"1以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"colorpandora","wave":4,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":1}],"img":"344"},"345":{"no":"345","name":"必死","kind":"spe","damage":null,"guts":0,"text":"自分のライフが2以下の時に、ちから技か、かしこさ技と同時に使用できる。その技のダメージを+2する。","user":"any","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"],"lifeMax":2}},{"t":"attachAdd","n":2}],"img":"345"},"346":{"no":"346","name":"純血のスピード","kind":"spe","damage":null,"guts":0,"text":"純血のモンスターのちから技か、かしこさ技と同時に使用する。その技は派生モンスターに回避されない。","user":"any","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"],"pure":true}},{"t":"attachNoEvadeHybrid"}],"img":"346","note":"サブが「？？？」のモンスターは純血ではありません"},"347":{"no":"347","name":"急襲","kind":"spe","damage":null,"guts":1,"text":"複数のモンスターにダメージを与える技と同時に使用する。その技の消費ガッツを半分(切り上げ)にする。","user":"any","wave":4,"ready":true,"effects":[{"t":"attach","when":{"area":true}},{"t":"attachCostHalf"}],"img":"347"},"348":{"no":"348","name":"太古の記憶","kind":"spe","damage":null,"guts":1,"text":"特殊技と同時に使用する。派生モンスターが、サブの種族の特殊技を使えるようになる。","user":"any","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["spe"],"subSpe":true}},{"t":"ancient"}],"img":"348","note":"混血のモンスターの特殊技に付けると、サブの種族の特殊技も出せます(一緒に出します)"},"349":{"no":"349","name":"挟み撃ち","kind":"spe","damage":null,"guts":1,"text":"ちから技か、かしこさ技と同時に使用する。このターンすでに回避・防御を使ったモンスターは、この技を回避・防御できない。","user":"any","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachNoGuardIfGuarded"}],"img":"349"},"350":{"no":"350","name":"光の盾","kind":"blk","damage":null,"guts":1,"text":"ちから技で与えられるダメージを−1する。","user":"any","wave":4,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":1}],"img":"350"},"351":{"no":"351","name":"夏美草","kind":"spe","damage":null,"guts":0,"text":"このターン攻撃できないモンスター1体を、攻撃できるようにする。","user":"breeder","wave":4,"ready":true,"effects":[{"t":"unstunTarget"}],"img":"351","note":"「攻撃できない」を消します。もう攻撃したモンスターには使えません"},"352":{"no":"352","name":"合体","kind":"spe","damage":null,"guts":0,"text":"味方モンスター2体をKOする。片方のメインと、もう片方のサブを持つ派生モンスターを出す。そのターンは攻撃できない。","user":"breeder","wave":4,"ready":true,"effects":[{"t":"fuse"}],"img":"352","note":"メインとサブが合う混血だけ出せます。ライフは最大で、メインを出したモンスターの場所に出ます。出たモンスターだけ、そのターン攻撃できません"},"357":{"no":"357","name":"ブリザード","kind":"int","damage":2,"guts":5,"text":"この技は全ての相手モンスターにダメージを与える。この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"tiger","wave":4,"ready":true,"effects":[{"t":"area","who":"enemies"},{"t":"stunOnHit"}],"img":"357"},"358":{"no":"358","name":"魔神ファイナル","kind":"int","damage":0,"guts":7,"text":"この技は回避されない。この技を使用する前に、自分の捨て札の中にある、「ガリ」の技カード枚数だけ、この技のダメージをプラスする。","user":"gali","wave":4,"ready":true,"effects":[{"t":"noEvade"},{"t":"bonusDiscard","user":"gali"}],"img":"358","note":"捨て札にある、ガリ専用の攻撃の技(ちから・かしこさ・特殊)の枚数を足します"},"359":{"no":"359","name":"体当たり","kind":"pow","damage":6,"guts":3,"text":"この技が回避されなかった場合、自分は2ダメージ受ける。","user":"golem","wave":4,"ready":true,"effects":[{"t":"selfDamageIfHit","n":2}],"img":"359"},"360":{"no":"360","name":"縦回転","kind":"dge","damage":null,"guts":2,"text":"1以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"suezo","wave":4,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":1}],"img":"360"},"361":{"no":"361","name":"ビッグバン","kind":"int","damage":3,"guts":5,"text":"この技は回避されない。このモンスターのライフの減少分だけ、この技のダメージにプラスする。","user":"pixie","wave":4,"ready":true,"effects":[{"t":"noEvade"},{"t":"bonusLost"}],"img":"361"},"362":{"no":"362","name":"渾身","kind":"spe","damage":null,"guts":1,"text":"ちから技と同時に使用する。そのちから技は防御によってダメージをマイナスされない。","user":"dino","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"]}},{"t":"attachNoBlockReduce"}],"img":"362"},"363":{"no":"363","name":"瞬殺","kind":"spe","damage":null,"guts":2,"text":"ちから技と同時に使用する。そのちから技は守備されない。","user":"naga","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"]}},{"t":"attachNoGuard"}],"img":"363","note":"回避も防御も出せません"},"364":{"no":"364","name":"超大声","kind":"spe","damage":null,"guts":1,"text":"お互いの手札を全部捨てる。","user":"hare","wave":4,"ready":true,"effects":[{"t":"discardBothHands"}],"img":"364"},"365":{"no":"365","name":"レロレロ","kind":"spe","damage":null,"guts":0,"text":"次のターン、相手モンスターは、このモンスターにダメージを与える技しか使用できない。","user":"mocchi","wave":4,"ready":true,"effects":[{"t":"taunt","mode":"only"}],"img":"365","note":"相手は次のターン、このモンスターを狙う技しか出せません(全員に当たる技は、このモンスターにも当たるものだけ出せます)"},"366":{"no":"366","name":"影縛り","kind":"spe","damage":null,"guts":0,"text":"ちから技か、かしこさ技と同時に使用する。回避・防御のカードを1つ名指しする。そのカードは、この技に使用できない。","user":"breeder","wave":4,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow","int"]}},{"t":"attachBind"}],"img":"366","note":"回避・防御のカードを名前で名指しします。同じ名前のカードは全部使えません"},"001":{"no":"001","name":"右爪","kind":"pow","damage":1,"guts":0,"text":"「左爪」「ツノ」と同時に使用できる。2種類なら3、3種類なら7ダメージを与える。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"combo","names":["右爪","左爪","ツノ"],"table":{"2":3,"3":7}}],"img":"001"},"002":{"no":"002","name":"左爪","kind":"pow","damage":1,"guts":0,"text":"「右爪」「ツノ」と同時に使用できる。2種類なら3、3種類なら7ダメージを与える。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"combo","names":["右爪","左爪","ツノ"],"table":{"2":3,"3":7}}],"img":"002"},"003":{"no":"003","name":"ツノ","kind":"pow","damage":1,"guts":0,"text":"「右爪」「左爪」と同時に使用できる。2種類なら3、3種類なら7ダメージを与える。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"combo","names":["右爪","左爪","ツノ"],"table":{"2":3,"3":7}}],"img":"003"},"004":{"no":"004","name":"体当たり","kind":"pow","damage":4,"guts":2,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"004"},"005":{"no":"005","name":"突き刺し","kind":"pow","damage":4,"guts":3,"text":"","user":"tiger","wave":1,"ready":true,"effects":[],"img":"005"},"006":{"no":"006","name":"冷気弾","kind":"int","damage":2,"guts":2,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"006"},"007":{"no":"007","name":"電撃","kind":"int","damage":3,"guts":2,"text":"","user":"tiger","wave":1,"ready":true,"effects":[],"img":"007"},"008":{"no":"008","name":"超電撃","kind":"int","damage":5,"guts":4,"text":"","user":"tiger","wave":1,"ready":true,"effects":[],"img":"008"},"009":{"no":"009","name":"電光石火","kind":"spe","damage":null,"guts":0,"text":"このターンの自分のちから技を使う前に使用できる。そのちから技は回避されない。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"]}},{"t":"attachNoEvade"}],"img":"009","note":"技に付けて一緒に出します(攻撃の1回には数えません)"},"010":{"no":"010","name":"吠え","kind":"spe","damage":null,"guts":3,"text":"全ての相手モンスターは次のターン攻撃できない","user":"tiger","wave":1,"ready":true,"effects":[{"t":"stunAllEnemies"}],"img":"010","note":"技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます"},"011":{"no":"011","name":"バック転","kind":"dge","damage":null,"guts":1,"text":"ちから技か、かしこさ技を回避する。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"011"},"012":{"no":"012","name":"ジャンプ","kind":"dge","damage":null,"guts":2,"text":"ちから技を回避する。次のターンの自分のちから技のダメージを2倍する。次のターン終了までこのモンスターの特ちょうを空中にする。","user":"tiger","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow"]},{"t":"nextTurnMult","kinds":["pow"],"n":2},{"t":"becomeAir"}],"img":"012"},"013":{"no":"013","name":"ひっかき","kind":"pow","damage":1,"guts":1,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"013"},"014":{"no":"014","name":"けり","kind":"pow","damage":2,"guts":2,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"014"},"015":{"no":"015","name":"スピンカッター","kind":"pow","damage":8,"guts":5,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"015"},"016":{"no":"016","name":"魔神ダンス","kind":"pow","damage":10,"guts":7,"text":"この技は回避されても、半分のダメージを与える。","user":"gali","wave":1,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"016"},"017":{"no":"017","name":"聖なる光","kind":"int","damage":2,"guts":3,"text":"この技は回避されない。","user":"gali","wave":1,"ready":true,"effects":[{"t":"noEvade"}],"img":"017"},"018":{"no":"018","name":"雷","kind":"int","damage":4,"guts":3,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"018"},"019":{"no":"019","name":"炎のカベ","kind":"int","damage":2,"guts":4,"text":"この技は全ての相手モンスターにダメージを与える。","user":"gali","wave":1,"ready":true,"effects":[{"t":"area","who":"enemies"}],"img":"019"},"020":{"no":"020","name":"魔神パンチ","kind":"int","damage":6,"guts":4,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"020"},"021":{"no":"021","name":"炎","kind":"int","damage":8,"guts":5,"text":"","user":"gali","wave":1,"ready":true,"effects":[],"img":"021"},"022":{"no":"022","name":"作戦の指示","kind":"spe","damage":null,"guts":3,"text":"自分の捨て札の中から1枚を選んで手札に加える。","user":"gali","wave":1,"ready":true,"effects":[{"t":"choose","src":"discard","then":"toHand"}],"img":"022"},"023":{"no":"023","name":"魔法反射","kind":"blk","damage":null,"guts":3,"text":"かしこさ技によって与えられるダメージを使用したモンスターに反射する。特別な効果は全て無視する。","user":"gali","wave":1,"ready":true,"effects":[{"t":"reflect","kinds":["int"],"frac":1}],"img":"023"},"024":{"no":"024","name":"ふせる","kind":"dge","damage":null,"guts":3,"text":"ちから技か、かしこさ技を回避する。","user":"gali","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"024"},"025":{"no":"025","name":"クロー","kind":"pow","damage":3,"guts":3,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"golem","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"025"},"026":{"no":"026","name":"でこぴん","kind":"pow","damage":5,"guts":3,"text":"","user":"golem","wave":1,"ready":true,"effects":[],"img":"026"},"027":{"no":"027","name":"キック","kind":"pow","damage":7,"guts":4,"text":"","user":"golem","wave":1,"ready":true,"effects":[],"img":"027"},"028":{"no":"028","name":"クロー投げ","kind":"pow","damage":5,"guts":5,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"golem","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"028"},"029":{"no":"029","name":"チョップ","kind":"pow","damage":8,"guts":5,"text":"","user":"golem","wave":1,"ready":true,"effects":[],"img":"029"},"030":{"no":"030","name":"ダブルチョップ","kind":"pow","damage":10,"guts":6,"text":"","user":"golem","wave":1,"ready":true,"effects":[],"img":"030"},"031":{"no":"031","name":"ぐるぐるアタック","kind":"pow","damage":12,"guts":7,"text":"","user":"golem","wave":1,"ready":true,"effects":[],"img":"031"},"032":{"no":"032","name":"竜巻アタック","kind":"pow","damage":4,"guts":8,"text":"この技は全ての相手モンスターにダメージを与える。","user":"golem","wave":1,"ready":true,"effects":[{"t":"area","who":"enemies"}],"img":"032"},"033":{"no":"033","name":"地震","kind":"int","damage":3,"guts":6,"text":"この技は自分以外の全ての地上にいるモンスターにダメージを与える。","user":"golem","wave":1,"ready":true,"effects":[{"t":"area","who":"others","only":"ground"}],"img":"033"},"034":{"no":"034","name":"力をためる","kind":"spe","damage":null,"guts":2,"text":"次の自分のちから技1回のダメージを2倍する。この効果はダメージを受けると終了する。","user":"golem","wave":1,"ready":true,"effects":[{"t":"charge","kinds":["pow"],"n":2}],"img":"034"},"035":{"no":"035","name":"堅い守り","kind":"blk","damage":null,"guts":2,"text":"ちから技で与えられるダメージを−5する。","user":"golem","wave":1,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":5}],"img":"035"},"036":{"no":"036","name":"友をかばう","kind":"blk","damage":null,"guts":1,"text":"味方モンスターへの1回分のダメージを、自分のダメージにする。","user":"golem","wave":1,"ready":true,"effects":[{"t":"cover"}],"img":"036"},"037":{"no":"037","name":"ツバはき","kind":"pow","damage":2,"guts":1,"text":"","user":"suezo","wave":1,"ready":true,"effects":[],"img":"037"},"038":{"no":"038","name":"テレポート","kind":"pow","damage":2,"guts":2,"text":"この技は回避されない。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"noEvade"}],"img":"038"},"039":{"no":"039","name":"しっぽアタック","kind":"pow","damage":2,"guts":2,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを1減らす。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":1}],"img":"039"},"040":{"no":"040","name":"かみつき","kind":"pow","damage":6,"guts":4,"text":"","user":"suezo","wave":1,"ready":true,"effects":[],"img":"040"},"041":{"no":"041","name":"ベロビンタ","kind":"pow","damage":6,"guts":5,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを3減らす。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":3}],"img":"041"},"042":{"no":"042","name":"キッス","kind":"int","damage":2,"guts":3,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを3減らす。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":3}],"img":"042"},"043":{"no":"043","name":"なめる","kind":"int","damage":2,"guts":4,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"043"},"044":{"no":"044","name":"熱視線","kind":"int","damage":5,"guts":4,"text":"","user":"suezo","wave":1,"ready":true,"effects":[],"img":"044"},"045":{"no":"045","name":"偵察","kind":"spe","damage":null,"guts":1,"text":"相手の手札の内容を見る。自分の山札からカードを1枚引く。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"peekHand"},{"t":"draw","n":1}],"img":"045"},"046":{"no":"046","name":"挑発","kind":"spe","damage":null,"guts":0,"text":"次のターン、相手モンスターは、このモンスターにダメージを与える技しか使用できない。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"taunt","mode":"only"}],"img":"046","note":"相手は次のターン、このモンスターを狙う技しか出せません(全員に当たる技は、このモンスターにも当たるものだけ出せます)"},"047":{"no":"047","name":"歌う","kind":"spe","damage":null,"guts":4,"text":"相手のターンを1回飛ばす。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"skipTurn"}],"img":"047","note":"相手の次のターンは、引く・攻撃・ガッツ置きが全部なくなります。「攻撃できない」のモンスターは、飛ばしたターンのあとのターンまで攻撃できないままです"},"048":{"no":"048","name":"横回転","kind":"dge","damage":null,"guts":1,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"suezo","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"048"},"049":{"no":"049","name":"ひっかき","kind":"pow","damage":1,"guts":0,"text":"","user":"pixie","wave":1,"ready":true,"effects":[],"img":"049"},"050":{"no":"050","name":"キック","kind":"pow","damage":2,"guts":1,"text":"","user":"pixie","wave":1,"ready":true,"effects":[],"img":"050"},"051":{"no":"051","name":"体当たり","kind":"pow","damage":4,"guts":2,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"051"},"052":{"no":"052","name":"雷","kind":"int","damage":1,"guts":0,"text":"「雷」「電撃」は同一ターンに連続して使用できる。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"chain","names":["雷","電撃"]}],"img":"052"},"053":{"no":"053","name":"電撃","kind":"int","damage":2,"guts":1,"text":"「雷」「電撃」は同一ターンに連続して使用できる。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"chain","names":["雷","電撃"]}],"img":"053"},"054":{"no":"054","name":"ショットガン","kind":"int","damage":3,"guts":3,"text":"この技のダメージは複数の相手モンスターに割り振れる。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"split"}],"img":"054","note":"ダメージを1点ずつ、相手のモンスターに割り振ります(1体に全部でもよい)。守りは割り振られたモンスターごとに出せます"},"055":{"no":"055","name":"ライトニング","kind":"int","damage":4,"guts":4,"text":"この技は回避されない。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"noEvade"}],"img":"055"},"056":{"no":"056","name":"キッス","kind":"int","damage":1,"guts":4,"text":"この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"gutsLossOnHit","n":"all"}],"img":"056"},"057":{"no":"057","name":"魅了","kind":"spe","damage":null,"guts":1,"text":"次のターン、相手モンスターは、このモンスターにダメージを与える技を使用できない。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"taunt","mode":"not"}],"img":"057","note":"相手は次のターン、このモンスターに当たる技を出せません(全員に当たる技も出せません)"},"058":{"no":"058","name":"回復","kind":"spe","damage":null,"guts":2,"text":"1体の味方モンスターのライフを3回復する。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"heal","n":3}],"img":"058"},"059":{"no":"059","name":"ステップ","kind":"dge","damage":null,"guts":0,"text":"1以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":1}],"img":"059"},"060":{"no":"060","name":"舞い上がる","kind":"dge","damage":null,"guts":1,"text":"ちから技を回避する。次のターンの自分のちから技のダメージを2倍する。次のターン終了までこのモンスターの特ちょうを空中にする。","user":"pixie","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow"]},{"t":"nextTurnMult","kinds":["pow"],"n":2},{"t":"becomeAir"}],"img":"060"},"061":{"no":"061","name":"パンチ","kind":"pow","damage":3,"guts":2,"text":"","user":"dino","wave":1,"ready":true,"effects":[],"img":"061"},"062":{"no":"062","name":"体当たり","kind":"pow","damage":4,"guts":2,"text":"この技が回避されなかった場合、自分は1ダメージ受ける。","user":"dino","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":1}],"img":"062"},"063":{"no":"063","name":"しっぽビンタ","kind":"pow","damage":5,"guts":3,"text":"この技は空中にいるモンスターには、ダメージを与えられない。","user":"dino","wave":1,"ready":true,"effects":[{"t":"cannotHit","type":"air"}],"img":"063"},"064":{"no":"064","name":"かみつき","kind":"pow","damage":6,"guts":4,"text":"","user":"dino","wave":1,"ready":true,"effects":[],"img":"064"},"065":{"no":"065","name":"かみつき投げ","kind":"pow","damage":6,"guts":5,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"dino","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"065"},"066":{"no":"066","name":"ひざげり","kind":"pow","damage":8,"guts":5,"text":"","user":"dino","wave":1,"ready":true,"effects":[],"img":"066"},"067":{"no":"067","name":"炎の体当たり","kind":"pow","damage":11,"guts":6,"text":"この技が回避されなかった場合、自分は3ダメージ受ける。","user":"dino","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":3}],"img":"067"},"068":{"no":"068","name":"砂キック","kind":"int","damage":3,"guts":3,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"dino","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"068"},"069":{"no":"069","name":"火炎","kind":"int","damage":4,"guts":3,"text":"","user":"dino","wave":1,"ready":true,"effects":[],"img":"069"},"070":{"no":"070","name":"跳躍","kind":"spe","damage":null,"guts":1,"text":"このターンの自分のちから技を使う前に使用できる。そのちから技は回避されない。","user":"dino","wave":1,"ready":true,"effects":[{"t":"attach","when":{"kinds":["pow"]}},{"t":"attachNoEvade"}],"img":"070","note":"技に付けて一緒に出します(攻撃の1回には数えません)"},"071":{"no":"071","name":"踏ん張る","kind":"blk","damage":null,"guts":1,"text":"ちから技で与えられるダメージを−2する。","user":"dino","wave":1,"ready":true,"effects":[{"t":"reduce","kinds":["pow"],"n":2}],"img":"071"},"072":{"no":"072","name":"横っ飛び","kind":"dge","damage":null,"guts":2,"text":"ちから技か、かしこさ技を回避する。","user":"dino","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"]}],"img":"072"},"073":{"no":"073","name":"ボディーブロー","kind":"pow","damage":2,"guts":2,"text":"この技は防御によってダメージをマイナスされない。","user":"naga","wave":1,"ready":true,"effects":[{"t":"noBlockReduce"}],"img":"073"},"074":{"no":"074","name":"つき","kind":"pow","damage":3,"guts":2,"text":"","user":"naga","wave":1,"ready":true,"effects":[],"img":"074"},"075":{"no":"075","name":"くしざし","kind":"pow","damage":2,"guts":3,"text":"この技は回避されない。","user":"naga","wave":1,"ready":true,"effects":[{"t":"noEvade"}],"img":"075"},"076":{"no":"076","name":"はたき","kind":"pow","damage":4,"guts":3,"text":"","user":"naga","wave":1,"ready":true,"effects":[],"img":"076"},"077":{"no":"077","name":"回転アタック","kind":"pow","damage":9,"guts":6,"text":"","user":"naga","wave":1,"ready":true,"effects":[],"img":"077"},"078":{"no":"078","name":"毒ギリ","kind":"int","damage":4,"guts":4,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"naga","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"078"},"079":{"no":"079","name":"魔空弾","kind":"int","damage":5,"guts":4,"text":"","user":"naga","wave":1,"ready":true,"effects":[],"img":"079"},"080":{"no":"080","name":"ドレイン","kind":"int","damage":4,"guts":6,"text":"この技で与えたダメージ分、自分のライフを回復する。","user":"naga","wave":1,"ready":true,"effects":[{"t":"drain"}],"img":"080"},"081":{"no":"081","name":"連続魔空弾","kind":"int","damage":8,"guts":6,"text":"この技は回避されても、半分のダメージを与える。","user":"naga","wave":1,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"081"},"082":{"no":"082","name":"にらむ","kind":"spe","damage":null,"guts":3,"text":"このターン、相手モンスターは回避技を使用できない。","user":"naga","wave":1,"ready":true,"effects":[{"t":"forbidThisTurn","kinds":["dge"]}],"img":"082"},"083":{"no":"083","name":"死亡遊戯","kind":"spe","damage":null,"guts":1,"text":"このターン、このモンスターは好きなだけ技カードを使用できる。","user":"naga","wave":1,"ready":true,"effects":[{"t":"unlimitedAttacks"}],"img":"083","note":"そのモンスターは、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)"},"084":{"no":"084","name":"カウンター","kind":"blk","damage":null,"guts":3,"text":"ちから技で受けるダメージの半分(切り捨て)を技を使用したモンスターに反射する。特別な効果は反射しない。","user":"naga","wave":1,"ready":true,"effects":[{"t":"reflect","kinds":["pow"],"frac":0.5,"keep":true}],"img":"084","note":"ちから技のダメージの半分(切り捨て)を返し、残りだけ受けます(5ダメージなら2を返して3を受けます)"},"085":{"no":"085","name":"頭つき","kind":"pow","damage":4,"guts":1,"text":"この技が回避されなかった場合、自分は2ダメージ受ける。","user":"hare","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":2}],"img":"085"},"086":{"no":"086","name":"ソバット","kind":"pow","damage":3,"guts":2,"text":"","user":"hare","wave":1,"ready":true,"effects":[],"img":"086"},"087":{"no":"087","name":"ワンツーパンチ","kind":"pow","damage":4,"guts":3,"text":"この技は回避されても、半分のダメージを与える。","user":"hare","wave":1,"ready":true,"effects":[{"t":"halfOnEvade"}],"img":"087"},"088":{"no":"088","name":"超頭つき","kind":"pow","damage":6,"guts":3,"text":"この技が回避されなかった場合、自分は2ダメージ受ける。","user":"hare","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":2}],"img":"088"},"089":{"no":"089","name":"巴投げ","kind":"pow","damage":5,"guts":4,"text":"この技でダメージを受けたモンスターは次のターン攻撃できない。","user":"hare","wave":1,"ready":true,"effects":[{"t":"stunOnHit"}],"img":"089"},"090":{"no":"090","name":"ぐるぐるパンチ","kind":"pow","damage":6,"guts":4,"text":"","user":"hare","wave":1,"ready":true,"effects":[],"img":"090"},"091":{"no":"091","name":"タックル","kind":"pow","damage":8,"guts":4,"text":"この技が回避されなかった場合、自分は2ダメージ受ける。","user":"hare","wave":1,"ready":true,"effects":[{"t":"selfDamageIfHit","n":2}],"img":"091"},"092":{"no":"092","name":"マシンガンパンチ","kind":"pow","damage":10,"guts":6,"text":"","user":"hare","wave":1,"ready":true,"effects":[],"img":"092"},"093":{"no":"093","name":"おなら","kind":"int","damage":2,"guts":3,"text":"この技は全ての相手モンスターにダメージを与える。","user":"hare","wave":1,"ready":true,"effects":[{"t":"area","who":"enemies"}],"img":"093"},"094":{"no":"094","name":"素早い計算","kind":"spe","damage":null,"guts":0,"text":"手札を1枚捨て、新たに2枚のカードを山札から引く。","user":"hare","wave":1,"ready":true,"effects":[{"t":"choose","src":"hand","then":"discardDraw2"}],"img":"094"},"095":{"no":"095","name":"大声","kind":"spe","damage":null,"guts":0,"text":"相手の手札を1枚捨てさせる。","user":"hare","wave":1,"ready":true,"effects":[{"t":"discardOpp","n":1}],"img":"095"},"096":{"no":"096","name":"フットワーク","kind":"dge","damage":null,"guts":0,"text":"2以上のガッツを消費する、ちから技かかしこさ技を回避する。","user":"hare","wave":1,"ready":true,"effects":[{"t":"evade","kinds":["pow","int"],"minGuts":2}],"img":"096"},"097":{"no":"097","name":"もんた","kind":"pow","damage":1,"guts":0,"text":"","user":"mocchi","wave":1,"ready":true,"effects":[],"img":"097"},"098":{"no":"098","name":"ローリン","kind":"pow","damage":2,"guts":1,"text":"","user":"mocchi","wave":1,"ready":true,"effects":[],"img":"098"},"099":{"no":"099","name":"ガッチョ","kind":"pow","damage":2,"guts":2,"text":"この技は回避されない。","user":"mocchi","wave":1,"ready":true,"effects":[{"t":"noEvade"}],"img":"099"},"F115":{"no":"F115","name":"冷静な判断","kind":"fld","damage":null,"guts":1,"text":"このカードを出した時に、カードを1枚引く。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldDrawOnPlay","n":1}],"img":"F115","note":"出した時に1枚引きます。場に残っているあいだは、ほかに何もしません"},"F116":{"no":"F116","name":"壮絶な戦い","kind":"fld","damage":null,"guts":2,"text":"ちから技か、かしこさ技で与える最終的なダメージを+1する。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldDmg","kinds":["pow","int"],"n":1}],"img":"F116"},"F117":{"no":"F117","name":"興奮のるつぼ","kind":"fld","damage":null,"guts":2,"text":"かしこさ技が与える最終的なダメージを-2する。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldDmg","kinds":["int"],"n":-2}],"img":"F117"},"F118":{"no":"F118","name":"ホリィの声援","kind":"fld","damage":null,"guts":3,"text":"カードを使用するのに必要なガッツを-1する。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldCost","n":-1}],"img":"F118"},"F119":{"no":"F119","name":"必殺技の応酬","kind":"fld","damage":null,"guts":3,"text":"最終的なダメージが3以下の、ちから技かかしこさ技は使用できない。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldBanDmg","kinds":["pow","int"],"max":3}],"img":"F119","note":"最終的なダメージは、技に付けた札と全体カードの分まで足した数です"},"F120":{"no":"F120","name":"大混乱","kind":"fld","damage":null,"guts":4,"text":"ドローステップ開始時に、そのターンのブリーダーの山札の上から2枚のカードを捨てる。","user":"breeder","wave":1,"ready":true,"effects":[{"t":"fieldMill","n":2}],"img":"F120","note":"それぞれのターンのドローの前に、そのターンの人の山札の上から2枚を捨て札にします"},"F255":{"no":"F255","name":"純血のプライド","kind":"fld","damage":null,"guts":2,"text":"全ての純血モンスターの攻撃に対して、全ての派生モンスターは回避技を使用できない。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldPurePride"}],"img":"F255","note":"サブが「？？？」のモンスターは純血ではありません"},"F256":{"no":"F256","name":"師匠のまなざし","kind":"fld","damage":null,"guts":3,"text":"カードを使用するのに必要なガッツを+1する。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldCost","n":1}],"img":"F256"},"F257":{"no":"F257","name":"がんじがらめ","kind":"fld","damage":null,"guts":3,"text":"全てのモンスターは特殊技を使用できない。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldBanKind","kinds":["spe"]}],"img":"F257"},"F258":{"no":"F258","name":"必殺技の封印","kind":"fld","damage":null,"guts":3,"text":"最終的なダメージが4以上の、ちから技かかしこさ技は使用できない。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldBanDmg","kinds":["pow","int"],"min":4}],"img":"F258","note":"最終的なダメージは、技に付けた札と全体カードの分まで足した数です"},"F259":{"no":"F259","name":"悪天候","kind":"fld","damage":null,"guts":3,"text":"全てのモンスターの持ちょうを地上にする。「悪天候」が場から無くなった時、全てのモンスターは本来の持ちょうに戻る。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldType","type":"ground"}],"img":"F259"},"F260":{"no":"F260","name":"灼熱の地","kind":"fld","damage":null,"guts":4,"text":"それぞれの攻撃ステップ終了時、攻撃側の全てのモンスターに1ダメージ与える。","user":"breeder","wave":2,"ready":true,"effects":[{"t":"fieldBurn","n":1}],"img":"F260","note":"攻撃を終えて「攻撃おわり」にしたとき、攻撃した側のモンスター全員に1ダメージです"},"F261":{"no":"F261","name":"飛び散る火花","kind":"fld","damage":null,"guts":2,"text":"かしこさ技が与える最終的なダメージを+1する。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"fieldDmg","kinds":["int"],"n":1}],"img":"F261"},"F262":{"no":"F262","name":"空間のひずみ","kind":"fld","damage":null,"guts":3,"text":"全てのモンスターの持ちょうを空中にする。「空間のひずみ」が場から無くなった時、全てのモンスターは本来の持ちょうに戻る。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"fieldType","type":"air"}],"img":"F262"},"F263":{"no":"F263","name":"長期戦の予感","kind":"fld","damage":null,"guts":3,"text":"ガッツステップ時、2枚までしかガッツにできない。","user":"breeder","wave":3,"ready":true,"effects":[{"t":"fieldGutsMax","n":2}],"img":"F263","note":"ガッツの段でガッツにできるのは2枚までです(手札が5枚のときに山札の上がガッツになるのは数えません)"}},"monsters":{"C-001":{"no":"C-001","species":"tiger","name":"ライガー","type":"ground","life":6,"variant":null,"wave":1,"img":"C-001"},"C-001S":{"no":"C-001S","species":"tiger","name":"ライガー","type":"ground","life":6,"variant":"キラ","wave":1,"img":"C-001S"},"C-001V":{"no":"C-001V","species":"tiger","name":"ライガー","type":"ground","life":6,"variant":"別絵キラ","wave":1,"img":"C-001V"},"C-002":{"no":"C-002","species":"gali","name":"ガリ","type":"air","life":7,"variant":null,"wave":1,"img":"C-002"},"C-002S":{"no":"C-002S","species":"gali","name":"ガリ","type":"air","life":7,"variant":"キラ","wave":1,"img":"C-002S"},"C-003":{"no":"C-003","species":"golem","name":"ゴーレム","type":"ground","life":9,"variant":null,"wave":1,"img":"C-003"},"C-003S":{"no":"C-003S","species":"golem","name":"ゴーレム","type":"ground","life":9,"variant":"キラ","wave":1,"img":"C-003S"},"C-003V":{"no":"C-003V","species":"golem","name":"ゴーレム","type":"ground","life":9,"variant":"別絵キラ","wave":1,"img":"C-003V"},"C-004":{"no":"C-004","species":"suezo","name":"スエゾー","type":"ground","life":7,"variant":null,"wave":1,"img":"C-004"},"C-004S":{"no":"C-004S","species":"suezo","name":"スエゾー","type":"ground","life":7,"variant":"キラ","wave":1,"img":"C-004S"},"C-004V":{"no":"C-004V","species":"suezo","name":"スエゾー","type":"ground","life":7,"variant":"別絵キラ","wave":1,"img":"C-004V"},"C-005":{"no":"C-005","species":"pixie","name":"ピクシー","type":"air","life":6,"variant":null,"wave":1,"img":"C-005"},"C-005S":{"no":"C-005S","species":"pixie","name":"ピクシー","type":"air","life":6,"variant":"キラ","wave":1,"img":"C-005S"},"C-005V":{"no":"C-005V","species":"pixie","name":"ピクシー","type":"air","life":6,"variant":"別絵キラ","wave":1,"img":"C-005V"},"C-006":{"no":"C-006","species":"dino","name":"ディノ","type":"ground","life":8,"variant":null,"wave":1,"img":"C-006"},"C-006S":{"no":"C-006S","species":"dino","name":"ディノ","type":"ground","life":8,"variant":"キラ","wave":1,"img":"C-006S"},"C-007":{"no":"C-007","species":"naga","name":"ナーガ","type":"ground","life":8,"variant":null,"wave":1,"img":"C-007"},"C-007S":{"no":"C-007S","species":"naga","name":"ナーガ","type":"ground","life":8,"variant":"キラ","wave":1,"img":"C-007S"},"C-008":{"no":"C-008","species":"hare","name":"ハム","type":"ground","life":6,"variant":null,"wave":1,"img":"C-008"},"C-008S":{"no":"C-008S","species":"hare","name":"ハム","type":"ground","life":6,"variant":"キラ","wave":1,"img":"C-008S"},"C-008V":{"no":"C-008V","species":"hare","name":"ハム","type":"ground","life":6,"variant":"別絵キラ","wave":1,"img":"C-008V"},"C-009":{"no":"C-009","species":"mocchi","name":"モッチー","type":"ground","life":7,"variant":null,"wave":1,"img":"C-009"},"C-009S":{"no":"C-009S","species":"mocchi","name":"モッチー","type":"ground","life":7,"variant":"キラ","wave":1,"img":"C-009S"},"C-009V":{"no":"C-009V","species":"mocchi","name":"モッチー","type":"ground","life":7,"variant":"別絵キラ","wave":1,"img":"C-009V"},"C-021":{"no":"C-021","species":"phoenix","name":"ヒノトリ","type":"air","life":4,"variant":null,"wave":2,"img":"C-021"},"C-021S":{"no":"C-021S","species":"phoenix","name":"ヒノトリ","type":"air","life":4,"variant":"キラ","wave":2,"img":"C-021S"},"C-022":{"no":"C-022","species":"jell","name":"ゲル","type":"ground","life":7,"variant":null,"wave":3,"img":"C-022"},"C-022S":{"no":"C-022S","species":"jell","name":"ゲル","type":"ground","life":7,"variant":"キラ","wave":3,"img":"C-022S"},"C-023":{"no":"C-023","species":"monol","name":"モノリス","type":"air","life":8,"variant":null,"wave":2,"img":"C-023"},"C-023S":{"no":"C-023S","species":"monol","name":"モノリス","type":"air","life":8,"variant":"キラ","wave":2,"img":"C-023S"},"C-025":{"no":"C-025","species":"henger","name":"ヘンガー","type":"ground","life":6,"variant":null,"wave":2,"img":"C-025"},"C-025S":{"no":"C-025S","species":"henger","name":"ヘンガー","type":"ground","life":6,"variant":"キラ","wave":2,"img":"C-025S"},"C-026":{"no":"C-026","species":"mew","name":"ニャー","type":"ground","life":6,"variant":null,"wave":3,"img":"C-026"},"C-026S":{"no":"C-026S","species":"mew","name":"ニャー","type":"ground","life":6,"variant":"キラ","wave":3,"img":"C-026S"},"C-027":{"no":"C-027","species":"plant","name":"プラント","type":"ground","life":10,"variant":null,"wave":2,"img":"C-027"},"C-027S":{"no":"C-027S","species":"plant","name":"プラント","type":"ground","life":10,"variant":"キラ","wave":2,"img":"C-027S"},"C-028":{"no":"C-028","species":"worm","name":"ワーム","type":"ground","life":9,"variant":null,"wave":3,"img":"C-028"},"C-028S":{"no":"C-028S","species":"worm","name":"ワーム","type":"ground","life":9,"variant":"キラ","wave":3,"img":"C-028S"},"C-029":{"no":"C-029","species":"dragon","name":"ドラゴン","type":"ground","life":8,"variant":null,"wave":2,"img":"C-029"},"C-029S":{"no":"C-029S","species":"dragon","name":"ドラゴン","type":"ground","life":8,"variant":"キラ","wave":2,"img":"C-029S"},"C-031":{"no":"C-031","species":"zilla","name":"グジラ","type":"ground","life":10,"variant":null,"wave":3,"img":"C-031"},"C-031S":{"no":"C-031S","species":"zilla","name":"グジラ","type":"ground","life":10,"variant":"キラ","wave":3,"img":"C-031S"},"C-031R":{"no":"C-031R","species":"zilla","name":"グジラ","type":"water","life":10,"variant":"別の特徴(水中)","wave":4,"img":"C-031R"},"C-031RS":{"no":"C-031RS","species":"zilla","name":"グジラ","type":"water","life":10,"variant":"別の特徴(水中)のキラ","wave":4,"img":"C-031RS"},"C-046":{"no":"C-046","species":"metalner","name":"メタルナー","type":"ground","life":6,"variant":null,"wave":4,"img":"C-046"},"C-046S":{"no":"C-046S","species":"metalner","name":"メタルナー","type":"ground","life":6,"variant":"キラ","wave":4,"img":"C-046S"},"C-047":{"no":"C-047","species":"joker","name":"ジョーカー","type":"air","life":7,"variant":null,"wave":4,"img":"C-047"},"C-047S":{"no":"C-047S","species":"joker","name":"ジョーカー","type":"air","life":7,"variant":"キラ","wave":4,"img":"C-047S"},"C-048":{"no":"C-048","species":"arrowhead","name":"アローヘッド","type":"water","life":7,"variant":null,"wave":4,"img":"C-048"},"C-048S":{"no":"C-048S","species":"arrowhead","name":"アローヘッド","type":"water","life":7,"variant":"キラ","wave":4,"img":"C-048S"},"C-049":{"no":"C-049","species":"centaur","name":"ケンタウロス","type":"ground","life":7,"variant":null,"wave":4,"img":"C-049"},"C-049S":{"no":"C-049S","species":"centaur","name":"ケンタウロス","type":"ground","life":7,"variant":"キラ","wave":4,"img":"C-049S"},"C-050":{"no":"C-050","species":"colorpandora","name":"コロペンドラ","type":"ground","life":8,"variant":null,"wave":4,"img":"C-050"},"C-050S":{"no":"C-050S","species":"colorpandora","name":"コロペンドラ","type":"ground","life":8,"variant":"キラ","wave":4,"img":"C-050S"},"C-030":{"no":"C-030","species":"durahan","name":"デュラハン","type":"ground","life":7,"variant":null,"wave":3,"img":"C-030"},"C-030S":{"no":"C-030S","species":"durahan","name":"デュラハン","type":"ground","life":7,"variant":"キラ","wave":3,"img":"C-030S"},"C-024":{"no":"C-024","species":"ghost","name":"ゴースト","type":"air","life":5,"variant":null,"wave":2,"img":"C-024"},"C-024S":{"no":"C-024S","species":"ghost","name":"ゴースト","type":"air","life":5,"variant":"キラ","wave":2,"img":"C-024S"},"C-051":{"no":"C-051","species":"hybrid:C-051","name":"バロン","type":"ground","life":7,"variant":null,"main":"tiger","sub":"gali","wave":"hybrid","img":"C051","ready":true},"C-052":{"no":"C-052","species":"hybrid:C-052","name":"アクアリウス","type":"air","life":7,"variant":null,"main":"gali","sub":"jell","wave":"hybrid","img":"C052","ready":true},"C-053":{"no":"C-053","species":"hybrid:C-053","name":"プラムラー","type":"ground","life":8,"variant":null,"main":"suezo","sub":"plant","wave":"hybrid","img":"C053","ready":true},"C-054":{"no":"C-054","species":"hybrid:C-054","name":"ストライクリパー","type":"ground","life":7,"variant":null,"main":"naga","sub":"tiger","wave":"hybrid","img":"C054","ready":true},"C-055":{"no":"C-055","species":"hybrid:C-055","name":"ダークハム","type":"ground","life":7,"variant":null,"main":"hare","sub":"monol","wave":"hybrid","img":"C055","ready":true},"C-056":{"no":"C-056","species":"hybrid:C-056","name":"ヘルファット","type":"ground","life":7,"variant":null,"main":"mocchi","sub":"joker","wave":"hybrid","img":"C056","ready":true},"C-057":{"no":"C-057","species":"hybrid:C-057","name":"ウロコゲル","type":"ground","life":7,"variant":null,"main":"jell","sub":"dino","wave":"hybrid","img":"C057","ready":true},"C-058":{"no":"C-058","species":"hybrid:C-058","name":"ワカクサケンザイ","type":"air","life":9,"variant":null,"main":"monol","sub":"plant","wave":"hybrid","img":"C058","ready":true},"C-059":{"no":"C-059","species":"hybrid:C-059","name":"ガーラント","type":"ground","life":8,"variant":null,"main":"henger","sub":"dragon","wave":"hybrid","img":"C059","ready":true},"C-060":{"no":"C-060","species":"hybrid:C-060","name":"ミミニャー","type":"ground","life":6,"variant":null,"main":"mew","sub":"hare","wave":"hybrid","img":"C060","ready":true},"C-061":{"no":"C-061","species":"hybrid:C-061","name":"ベニヒメソウ","type":"ground","life":6,"variant":null,"main":"plant","sub":"pixie","wave":"hybrid","img":"C061","ready":true},"C-062":{"no":"C-062","species":"hybrid:C-062","name":"ムラサキチュウ","type":"ground","life":9,"variant":null,"main":"worm","sub":"naga","wave":"hybrid","img":"C062","ready":true},"C-063":{"no":"C-063","species":"hybrid:C-063","name":"アーマードラゴン","type":"ground","life":7,"variant":null,"main":"dragon","sub":"durahan","wave":"hybrid","img":"C063","ready":true},"C-064":{"no":"C-064","species":"hybrid:C-064","name":"ケルマディクス","type":"ground","life":8,"variant":null,"main":"durahan","sub":"golem","wave":"hybrid","img":"C064","ready":true},"C-065":{"no":"C-065","species":"hybrid:C-065","name":"ギガロン","type":"water","life":11,"variant":null,"main":"zilla","sub":"jell","wave":"hybrid","img":"C065","ready":true},"C-010":{"no":"C-010","species":"hybrid:C-010","name":"ハムライガー","type":"ground","life":6,"variant":null,"main":"tiger","sub":"hare","wave":"hybrid","img":"C010","ready":true},"C-011":{"no":"C-011","species":"hybrid:C-011","name":"ブルーマウンテン","type":"ground","life":7,"variant":null,"main":"golem","sub":"tiger","wave":"hybrid","img":"C011","ready":true},"C-012":{"no":"C-012","species":"hybrid:C-012","name":"メロンボ","type":"ground","life":6,"variant":null,"main":"suezo","sub":"dino","wave":"hybrid","img":"C012","ready":true},"C-013":{"no":"C-013","species":"hybrid:C-013","name":"ラベンダーキール","type":"air","life":7,"variant":null,"main":"pixie","sub":"naga","wave":"hybrid","img":"C013","ready":true},"C-014":{"no":"C-014","species":"hybrid:C-014","name":"アンキロックス","type":"ground","life":7,"variant":null,"main":"dino","sub":"golem","wave":"hybrid","img":"C014","ready":true},"C-015":{"no":"C-015","species":"hybrid:C-015","name":"ヴァージアハピ","type":"ground","life":5,"variant":null,"main":"hare","sub":"pixie","wave":"hybrid","img":"C015","ready":true},"C-016":{"no":"C-016","species":"hybrid:C-016","name":"エンジェル","type":"air","life":7,"variant":null,"main":"pixie","sub":"gali","wave":"hybrid","img":"C016","ready":true},"C-017":{"no":"C-017","species":"hybrid:C-017","name":"ヒトツメオウジ","type":"air","life":7,"variant":null,"main":"gali","sub":"suezo","wave":"hybrid","img":"C017","ready":true},"C-018":{"no":"C-018","species":"hybrid:C-018","name":"ツノマル","type":"ground","life":6,"variant":null,"main":"suezo","sub":"tiger","wave":"hybrid","img":"C018","ready":true},"C-019":{"no":"C-019","species":"hybrid:C-019","name":"バズラ","type":"ground","life":7,"variant":null,"main":"naga","sub":"gali","wave":"hybrid","img":"C019","ready":true},"C-020":{"no":"C-020","species":"hybrid:C-020","name":"ジェントル","type":"ground","life":7,"variant":null,"main":"mocchi","sub":"unknown","wave":"hybrid","img":"C020","ready":true},"C-032":{"no":"C-032","species":"hybrid:C-032","name":"マグナビートル","type":"ground","life":7,"variant":null,"main":"golem","sub":"worm","wave":"hybrid","img":"C032","ready":true},"C-033":{"no":"C-033","species":"hybrid:C-033","name":"ナハトファルター","type":"air","life":7,"variant":null,"main":"pixie","sub":"worm","wave":"hybrid","img":"C033","ready":true},"C-034":{"no":"C-034","species":"hybrid:C-034","name":"カッチュウサウル","type":"ground","life":8,"variant":null,"main":"dino","sub":"worm","wave":"hybrid","img":"C034","ready":true},"C-035":{"no":"C-035","species":"hybrid:C-035","name":"ヨロイモッチー","type":"ground","life":8,"variant":null,"main":"mocchi","sub":"durahan","wave":"hybrid","img":"C035","ready":true},"C-036":{"no":"C-036","species":"hybrid:C-036","name":"パー・プリン","type":"ground","life":8,"variant":null,"main":"jell","sub":"naga","wave":"hybrid","img":"C036","ready":true},"C-037":{"no":"C-037","species":"hybrid:C-037","name":"ソボロベント","type":"air","life":9,"variant":null,"main":"monol","sub":"worm","wave":"hybrid","img":"C037","ready":true},"C-038":{"no":"C-038","species":"hybrid:C-038","name":"ダークヘンガー","type":"ground","life":7,"variant":null,"main":"henger","sub":"monol","wave":"hybrid","img":"C038","ready":true},"C-039":{"no":"C-039","species":"hybrid:C-039","name":"ママニャー","type":"ground","life":6,"variant":null,"main":"mew","sub":"pixie","wave":"hybrid","img":"C039","ready":true},"C-040":{"no":"C-040","species":"hybrid:C-040","name":"ヒネクレソウ","type":"ground","life":9,"variant":null,"main":"plant","sub":"suezo","wave":"hybrid","img":"C040","ready":true},"C-041":{"no":"C-041","species":"hybrid:C-041","name":"コロネ","type":"ground","life":8,"variant":null,"main":"worm","sub":"hare","wave":"hybrid","img":"C041","ready":true},"C-042":{"no":"C-042","species":"hybrid:C-042","name":"ジハード","type":"ground","life":8,"variant":null,"main":"dragon","sub":"golem","wave":"hybrid","img":"C042","ready":true},"C-043":{"no":"C-043","species":"hybrid:C-043","name":"ベスビオス","type":"ground","life":7,"variant":null,"main":"durahan","sub":"dragon","wave":"hybrid","img":"C043","ready":true},"C-044":{"no":"C-044","species":"hybrid:C-044","name":"ギンギライガー","type":"ground","life":6,"variant":null,"main":"tiger","sub":"unknown","wave":"hybrid","img":"C044","ready":true},"C-045":{"no":"C-045","species":"hybrid:C-045","name":"ムー","type":"ground","life":8,"variant":null,"main":"dragon","sub":"unknown","wave":"hybrid","img":"C045","ready":true},"C-066":{"no":"C-066","species":"hybrid:C-066","name":"剣士モッチー","type":"ground","life":7,"variant":null,"main":"mocchi","sub":"unknown","wave":"hybrid","img":"C066","ready":true},"C-066S":{"no":"C-066S","species":"hybrid:C-066","name":"剣士モッチー","type":"ground","life":7,"variant":"キラ","main":"mocchi","sub":"unknown","wave":"hybrid","img":"C066S","ready":true},"C-066V":{"no":"C-066V","species":"hybrid:C-066","name":"剣士モッチー","type":"ground","life":7,"variant":"別絵キラ","main":"mocchi","sub":"unknown","wave":"hybrid","img":"C066V","ready":true},"C-067":{"no":"C-067","species":"hybrid:C-067","name":"パンドラ","type":"air","life":6,"variant":null,"main":"pixie","sub":"unknown","wave":"hybrid","img":"C067","ready":true},"C-067S":{"no":"C-067S","species":"hybrid:C-067","name":"パンドラ","type":"air","life":6,"variant":"キラ","main":"pixie","sub":"unknown","wave":"hybrid","img":"C067S","ready":true},"C-067V":{"no":"C-067V","species":"hybrid:C-067","name":"パンドラ","type":"air","life":6,"variant":"別絵キラ","main":"pixie","sub":"unknown","wave":"hybrid","img":"C067V","ready":true},"C-208":{"no":"C-208","species":"hybrid:C-208","name":"オボロゲソウ","type":"ground","life":10,"variant":null,"main":"plant","sub":"jell","wave":"hybrid","img":"C208","ready":true},"C-208S":{"no":"C-208S","species":"hybrid:C-208","name":"オボロゲソウ","type":"ground","life":10,"variant":"キラ","main":"plant","sub":"jell","wave":"hybrid","img":"C208S","ready":true},"C-208V":{"no":"C-208V","species":"hybrid:C-208","name":"オボロゲソウ","type":"ground","life":10,"variant":"別絵キラ","main":"plant","sub":"jell","wave":"hybrid","img":"C208V","ready":true}},"starters":{"speed":{"id":"speed","name":"先手必勝スピードチーム","monsters":["C-006","C-008","C-009"],"cards":["061","061","061","062","064","064","064","067","069","069","071","071","071","072","072","085","085","086","086","086","087","087","090","090","090","093","095","096","096","096","097","097","097","098","098","098","099","100","100","100","104","106","106","108","108","110","112","112","113","113"]},"powerful":{"id":"powerful","name":"一撃必殺パワフルチーム","monsters":["C-003","C-005","C-007"],"cards":["026","026","026","027","027","027","029","029","029","031","033","035","035","036","036","049","049","049","052","052","052","053","053","055","055","056","058","059","059","059","074","074","074","075","075","075","076","076","076","080","080","081","082","084","084","110","112","112","113","113"]},"miracle":{"id":"miracle","name":"一発逆転ミラクルチーム","monsters":["C-004","C-002","C-001"],"cards":["037","037","037","039","039","039","040","040","041","041","043","045","048","048","048","013","013","013","014","014","014","017","019","021","021","021","023","023","024","024","001","001","001","002","002","002","003","003","003","005","005","007","011","011","012","110","112","112","113","113"]}}};

;
// ---- 82-card-battle-core.jsx ----
// ===== MFバトルカード: ルールの本体とコンピューターの考え方(純粋な計算) =====
// 紙の『モンスターファームバトルカード』のルールを、カードの文のとおりに動かす。
// 設計: docs/spec/CARD_BATTLE.md(1-3 ルール本文・2-3 効果の部品・5-5 コンピューター戦)。元のルールの正本は docs/spec/card-battle/RULES_SOURCE.md
// ★この部品は pure(React・画面・保存・タイマーを触らない)。カードの表(CARD_BATTLE_DATA)は引数で受け取る。
//   同じ式を検査(tools/card/card-rules-check.js)とコンピューターどうしの対戦(勝率を出す)でもそのまま使う。
//
// 状態はただのオブジェクトで、操作のたびに作り直して返す(画面はそれを描くだけ)。
//   players[0/1] … mons(場の3体)・deck(山札・上が末尾)・hand(手札)・guts(ガッツ・新しく置いたものが末尾)・discard(捨て札)
//   phase … 'setup'(後攻が始める前に2枚までガッツ)/ 'main'(攻撃)/ 'guts'(手札をガッツへ)/ 'over'
//   pending … 攻撃を受けている途中(守る側が回避・防御を出せる)
//
// 効果の部品(tools/card/card-data-build.js がカードの文から作る。名前はここが正本)
//   攻撃: noEvade 回避されない / halfOnEvade 回避されても半分(切り上げ) / stunOnHit 当てた子は次のターン攻撃できない /
//         selfDamageIfHit(n) 回避されなかったら自分もnダメージ / selfDamageIfEvaded(n) / selfDamage(n) 使ったら自分もn /
//         gutsLossOnHit(n|'all') 当てたら相手のガッツを減らす / noBlockReduce 防御で減らされない /
//         area(who:'enemies'|'others', only:'ground'|'air') 全員に / cannotHit(type) その特徴の子には当たらない /
//         onlyHit(type) その特徴の子にしか当たらない / multVs(type,n) その特徴の子にはn倍 / drain 与えたぶん回復 /
//         chain(names) 同じターンに続けて使える / combo(names,table) 同時に使う種類の数でダメージが変わる / nonLethal とどめにならない
//   付ける: attach(when) 技に付けて使う(攻撃の回数に数えない) / attachMult(n) 付けた技のダメージn倍
//         when … kinds(付けられる技の種類。無ければちから・かしこさ)/ lifeMax / deckEmpty(山札0)/ area(全員に当たる技)/
//                pure(純血の子)/ breederMaxGuts(n)(そのガッツ以下のブリーダーのカードに付ける)
//         attachAdd(n) +n / attachCost(n) 払うガッツ-n / attachCostHalf 半分(切り上げ)/ attachFree 0 /
//         attachNoEvade 回避されない / attachNoGuard 回避も防御もされない / attachNoBlockReduce 防御で減らない /
//         attachNoZeroGuard そのとき払うガッツが0の守りは出せない / attachNoGuardIfGuarded このターンもう守った子は守れない /
//         attachNoEvadeHybrid 混血(派生)の子は回避できない / attachBind 守りの札を1つ名前で名指し(act.bind)/ attachSelfIfHit(n)
//         付ける札は1回の攻撃に2枚まで(ブリーダーのカードは1枚)
//   特殊: draw(n) / peekHand / discardOpp(n) 相手が選んで捨てる / heal(n) 味方1体 / forbidThisTurn(kinds) このターン相手は回避(防御)を使えない
//         gutsGuard 次のターンまでガッツを減らされない / charge(kinds,n) 次のその種類の技1回をn倍(ダメージを受けると消える)
//         freeSpeThisTurn このターン、味方の特殊技(モンスターの)は0ガッツ(友情の証)
//         extraAttack(n) この子はこのターンもうn回攻撃できる / extraAttackTarget(n) もう攻撃した味方1体に / useWhenAllies(n) 味方がn体のときだけ /
//         unstunTarget 味方1体の「攻撃できない」を消す / liftTarget 相手1体をこのターンだけ空中に / unlimitedAttacks この子はこのターン何枚でも /
//         breederUnlimited このターン、ブリーダーのカードを何枚でも / taunt(mode:'only'|'not', noArea) 相手の次の番に狙える相手を縛る /
//         stunAllEnemies・stunTarget 相手(1体)は次のターン攻撃できない / skipTurn 相手の次の番を飛ばす /
//         rage 次の自分の番まで、この子は守れない。次の自分の番の技は2倍
//         ---- 区切り4: 山札・手札・捨て札・ガッツ ----
//         choose(src:'discard'|'hand', filter:{kind,attack,usable}, then) 1枚選ぶ段(st.pendingChoice)。then … toHand / toDeckBottom /
//                toDeckShuffleDraw(山札へ戻して切り、1枚引く)/ discardDraw2(捨てて2枚引く)/ oppDiscard(相手の手札から捨てさせる)
//         peekPick 相手が手札を見せる段(st.pendingReveal)→ こちらが1枚選んで捨てさせる / rush(n) 山札の上からnをガッツ。そのターンはもう出せない /
//         lastWish 自分をKO、残りライフの枚数を捨て札の新しいほうからガッツへ / gutsZeroBoth / deckToGuts / oppHandToDeckBottom・oppDraw(n) /
//         gutsToDeckShuffle / selfHurt(n) 味方1体 / oppGutsLoss(n) / refresh 手札を全部捨てて同じ数引く / millOpp(n) / discardBothHands
//         ★山札を切り直すのは、その山札の持ち主の種(players[i].rng)。マルチで相手の端末と同じ順になる(場の種 st.seed は使わない)
//         ---- 区切り5: 守りの新しい形・持ちょう ----
//         守り: redirect 目標を自分から他の味方へ(act.to。移した先はもう守れない)/ endure(kinds) ライフ1で残る / evadeAll 全員に当たる技を全員が回避 /
//               shield 1回の攻撃で味方が受けるダメージを全部この子が / noGutsLoss / takeMult(kinds,n) 受けるダメージn倍 /
//               liftAllies・waterAll 狙われていなくても出せる(自分以外の味方を空中に・味方を全員このターン水中に)
//         特殊: safe 次の自分の番まで、どこからのダメージも0 / form 空中か地上かを選ぶ(act.form)
//         ★守りで持ちょうが変わったら、当てる直前に「当たるか」を見直す(当たらなければ0)
//         ---- 区切り6: 同時に2枚・ダメージの数え方 ----
//         pair(dmg) 同じ名前を2枚同時に出したらdmg / requires(names) その札を全部一緒に出すときだけ(払うのはこの札のガッツだけ)/
//         returnOnHit ダメージを与えたら手札へ戻る / split ダメージを相手に割り振る(act.split … 相手の3体ぶんの点)/
//         bonusDiscard(user) 捨て札のその種族の攻撃の技の枚数を足す / bonusLost 減ったライフのぶんを足す / mimic(attach) どの種族のちから技でもこの子が出せる
//         tossBonus 使うときに手札を好きな枚数捨て、その枚数をダメージに足す(act.toss … 捨てる手札の番号。0枚でもよい。カード投げ)
//         ---- 区切り7: モンスターが入れ替わる ----
//         revive(species,life) 倒れたその種族の子を戻す(そのターンは攻撃できない)/ cocoon その子は emerge の札のほかを出せない /
//         emerge(to) まゆ化した子を to のモンスターと取りかえ、ライフを最大に / fuse 味方2体をKOし、メインとサブが合う混血を出す(act.fuse)/
//         ancient(attach) 混血の子が、サブの種族の特殊技を出せる /
//         possess KOされた味方1体を、この子の今のライフで戻し(もとの最大まで)、この子はKO。戻った子はそのターン攻撃できない(のりうつる)
//   使える時: useWhen(lifeMax) 自分のライフがその数以下のときだけ出せる
//   守り: evade(kinds,minGuts) / reduce(kinds,n) / reduceHalf(kinds) 半分(切り捨て)減らす / reduceAll(kinds) / reflect(kinds,frac,keep) はね返す /
//         cover 味方への1回分を自分が受ける / nextTurnMult(kinds,n) 次の自分のターンの技n倍 / becomeAir 次のターン終わりまで空中 /
//         selfGutsAll 使った人が自分のガッツを全て失う(緊急回避)
//
// 決まり(社長が決めたもの。台帳 2026-10-24)
//   ・各モンスターは1ターンに攻撃用の技(ちから・かしこさ・特殊)1枚まで。ただしカードの文が先(chain・combo・attach)
//   ・ブリーダーカードは1ターン1枚。モンスターの攻撃とは別(加勢はその子が攻撃したあとにも使える)
//   ・特殊技はふつうの回避・防御で守れない
//   ・回避されても半分は切り上げ(文に「切り捨て」とあるカードは文のとおり)
//   ・最後の1体どうしが同時に倒れたら攻撃した側の勝ち
//   ・全員に当たる技は、狙われた1体ずつ守るかどうかを選べる
//   ・相手の手札を捨てさせるのは、捨てる側が選ぶ
const CARD_BATTLE_HAND_MAX = 5;
const CARD_BATTLE_DECK_SIZE = 50;
const CARD_BATTLE_SETUP_GUTS_MAX = 2;
const CARD_BATTLE_LOG_MAX = 80;

// ---- 乱数(種から決まる。対人戦で両方の端末が同じ山札になるように) ----
const cardRngNext = (s) => {
  let t = (s + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { s: t, v: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
};
const cardShuffle = (arr, seed) => {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    const n = cardRngNext(s); s = n.s;
    const j = Math.floor(n.v * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { list: a, seed: s };
};

const cardEff = (card, t) => (card && Array.isArray(card.effects) ? card.effects.find((e) => e && e.t === t) : null);
const cardHasEff = (card, t) => !!cardEff(card, t);
const cardOf = (db, no) => (db && db.cards && db.cards[no]) || null;
const cardMonsterOf = (db, no) => (db && db.monsters && db.monsters[no]) || null;
const cardIsAttackKind = (k) => k === 'pow' || k === 'int' || k === 'spe';
const cardIsGuardKind = (k) => k === 'dge' || k === 'blk';
// ---- 全体カード(2026-10-25)。場に1枚だけ残り、両方のブリーダーに効く。st.field = { no, p(出した人), effects(置いたときに写す) } ----
// 効き目は、ほかの技の効果より先に見る(持ちょうは cardMonType がいちばん先に見る)
const cardFieldEff = (st, t) => (st && st.field && Array.isArray(st.field.effects) ? st.field.effects.find((e) => e.t === t) || null : null);
// カードを使うのに要るガッツ(ホリィの声援 -1・師匠のまなざし +1。0 より下にならない)
const cardFieldCostOf = (st, n) => { const e = cardFieldEff(st, 'fieldCost'); return e ? Math.max(0, n + e.n) : n; };
const cardGuardCost = (st, c) => cardFieldCostOf(st, (c && c.guts) || 0);
// 当たったダメージに足す数(その技の種類に効くものだけ)
const cardFieldDmgAdd = (st, main) => (st && st.field && Array.isArray(st.field.effects) ? st.field.effects : [])
  .filter((e) => e.t === 'fieldDmg' && main && e.kinds.includes(main.kind)).reduce((a, e) => a + e.n, 0);
const cardClone = (st) => JSON.parse(JSON.stringify(st));
const cardOther = (p) => 1 - p;

// 混血(派生)の子か。サブが「？？？」(unknown)の子(剣士モッチー・パンドラなど・レア)は純血と同じに扱う(2026-10-27 社長「サブが？？？は純血扱い」)
const cardIsHybridMon = (mon) => !!(mon && mon.main && mon.sub && mon.sub !== 'unknown');
// 純血かどうか(純血のスピード・純血のプライドで見る)。メインの種族が無い子だけが純血。サブが「？？？」の子は純血ではない
//   (2026-10-27 社長 案A「サブレアは純血扱いじゃなくす。ただ防御回避カードは純血と同じ扱いはルールのまま」)。守りの札をどの種族で使うかは cardIsHybridMon のまま
const cardIsPureMon = (mon) => !!mon && !mon.main;
// その子が、そのカードを使えるか(専用の技は書いてある種族だけ。全モンスターは誰でも)
//   混血: 攻撃・特殊はメインの種族の札だけ、防御・回避はサブの種族の札だけ(2026-10-27 社長「ヘルファットがモッチーの守備技使ってきます」。
//   前は「サブの守りも使える」と読み、メインの守りまで使えていた)。サブが？？？の子は純血と同じで、メインの種族の札を全部使える
const cardUsableBy = (card, mon) => {
  if (!card || !mon || mon.ko) return false;
  if (card.user === 'any') return true;
  if (card.user === 'breeder') return false;
  if (card.user === mon.species) return true;
  if (!mon.main) return false;
  if (!cardIsHybridMon(mon)) return card.user === mon.main;
  return card.user === (cardIsGuardKind(card.kind) ? mon.sub : mon.main);
};
// デッキの3体のだれも使えないカードの枚数(ブリーダー・全モンスター・全体のカードは数えない)。
//   混血のメイン・サブの直し(2026-10-27)で、前に入れたメインの種族の守りが使えなくなった人に、デッキの画面で知らせる。デッキはそのまま使える
const cardDeckDeadCount = (db, deck) => {
  const mons = ((deck && deck.monsters) || []).map((no) => cardMonsterOf(db, no)).filter(Boolean);
  if (!mons.length) return 0;
  return ((deck && deck.cards) || []).filter((no) => { const c = cardOf(db, no); return c && c.user !== 'breeder' && c.user !== 'any' && c.kind !== 'fld' && !mons.some((m) => cardUsableBy(c, { ...m, ko: false })); }).length;
};
// いまの特徴(空中・地上・水中)。ジャンプなどで期限つきで空中になる
const cardMonType = (mon, turn) => (mon.fieldType ? mon.fieldType : mon.waterUntil >= turn ? 'water' : mon.airUntil >= turn ? 'air' : mon.type); // 全体カード(悪天候・空間のひずみ)がいちばん先・ひきずりこむ(水中)は空中より先

const cardLog = (st, text, extra) => {
  st.log.push({ turn: st.turn, text, ...(extra || {}) });
  if (st.log.length > CARD_BATTLE_LOG_MAX) st.log.splice(0, st.log.length - CARD_BATTLE_LOG_MAX);
};
const cardEvent = (st, ev) => { st.events.push(ev); };

// ---- ゲームを始める ----
// decks: [{ monsters:[3つの番号], cards:[50枚の番号] }, …]。first: 先攻(0/1)
const cardCreateGame = (db, { decks, names = ['あなた', 'あいて'], seed = 1, first = 0 }) => {
  let s = seed >>> 0;
  const players = decks.map((d, i) => {
    const sh = cardShuffle(d.cards, s); s = sh.seed;
    const mons = d.monsters.map((no) => {
      const m = cardMonsterOf(db, no);
      return { no, species: m.species, name: m.name, main: m.main || null, sub: m.sub || null, type: m.type, life: m.life, max: m.life,
        ko: false, attacks: 0, lastCard: null, stunTurn: -1, airUntil: -1, mult: null, charge: null };
    });
    const deck = sh.list;
    const hand = deck.splice(deck.length - CARD_BATTLE_HAND_MAX, CARD_BATTLE_HAND_MAX).reverse();
    // rng … この山札を試合の中で切り直すときの種(自分の山札の切り方から決まる。マルチでも、山札の持ち主の端末と同じ数になる)
    return { name: names[i] || `P${i + 1}`, mons, deck, hand, guts: [], discard: [], breederUsed: false, gutsGuardUntil: -1, prayTurn: -1, rng: (sh.seed ^ 0x9E3779B9) >>> 0 };
  });
  // field … 場の全体カード { no, p(出した人) }。場に1枚だけ
  const st = { v: 1, seed: s, turn: 0, first, active: cardOther(first), phase: 'setup', players, pending: null, field: null, forbid: {}, winner: null, reason: null, log: [], events: [] };
  cardLog(st, `${players[first].name}が先攻、${players[cardOther(first)].name}が後攻`);
  return st;
};

const cardGameOver = (st, winner, reason) => {
  if (st.winner !== null) return;
  st.winner = winner; st.reason = reason; st.phase = 'over'; st.pending = null;
  cardLog(st, `${st.players[winner].name}の勝ち(${reason})`, { kind: 'over' });
  cardEvent(st, { t: 'over', winner, reason });
};

// ターンのはじめ: ドロー(手札5枚まで。5枚なら山札の上をガッツへ)。引けなければ負け
const cardBeginTurn = (st) => {
  st.turn += 1;
  const p = st.active;
  const me = st.players[p];
  me.breederUsed = false;
  st.forbid = {};
  me.mons.forEach((m) => { m.attacks = 0; m.lastCard = null; });
  st.phase = 'main';
  cardLog(st, `ターン${st.turn}: ${me.name}の番`, { kind: 'turn' });
  cardEvent(st, { t: 'turn', p, turn: st.turn });
  if (st.turn === 1) return; // 先攻の1ターン目は引かない
  // 大混乱(全体カード): ドローの前に、その番の人の山札の上から n 枚を捨て札へ
  const mill = cardFieldEff(st, 'fieldMill');
  if (mill) { const k = Math.min(mill.n, me.deck.length); for (let i = 0; i < k; i++) me.discard.push(me.deck.pop()); if (k) cardLog(st, `大混乱: ${me.name}は山札の上から${k}枚を捨てた`); }
  if (me.hand.length >= CARD_BATTLE_HAND_MAX) {
    if (!me.deck.length) { cardGameOver(st, cardOther(p), '山札切れ'); return; }
    me.guts.push(me.deck.pop());
    cardLog(st, `${me.name}の手札は5枚なので、山札の上をガッツにした`);
    return;
  }
  while (me.hand.length < CARD_BATTLE_HAND_MAX) {
    if (!me.deck.length) { cardGameOver(st, cardOther(p), '山札切れ'); return; }
    me.hand.push(me.deck.pop());
  }
};

const cardPayGuts = (st, p, n) => {
  const me = st.players[p];
  for (let i = 0; i < n; i++) me.discard.push(me.guts.pop());
};
// 山札を切り直す(持ち主の種で。古い保存で種が無ければ場の種)
const cardReshuffle = (st, p) => {
  const me = st.players[p];
  const sh = cardShuffle(me.deck, Number.isFinite(me.rng) ? me.rng : st.seed);
  me.deck = sh.list; me.rng = sh.seed;
};
const cardDrawN = (st, p, n) => { const me = st.players[p]; let k = 0; for (let i = 0; i < n; i++) { if (!me.deck.length) break; me.hand.push(me.deck.pop()); k += 1; } return k; };
// 選ぶ段の候補(手札・捨て札の番号)。discardLen … 選ぶ段を作ったときの捨て札の数(いま使った札は選べない)
const cardChoiceCands = (db, st, p, mi, e, discardLen) => {
  const me = st.players[p];
  const list = e.src === 'hand' ? me.hand : me.discard.slice(0, discardLen === undefined ? me.discard.length : discardLen);
  const mon = mi >= 0 ? me.mons[mi] : null;
  const f = e.filter || {};
  // 絞り込みの無い選び方なら、中身の分からない札(マルチで相手の手札は仮の札)も候補に数える。数がずれると、相手の手が当てられない
  const any = !f.kind && !f.attack && !f.usable;
  return list.map((no, i) => ({ i, c: cardOf(db, no) })).filter(({ c }) => (c ? (!f.kind || c.kind === f.kind) && (!f.attack || cardIsAttackKind(c.kind)) && (!f.usable || (mon && cardUsableBy(c, mon))) : any)).map((x) => x.i);
};
const cardLoseGuts = (st, p, n) => {
  const me = st.players[p];
  if (me.gutsGuardUntil >= st.turn) { cardLog(st, `${me.name}のガッツは減らされなかった(精神集中)`); return 0; }
  const k = n === 'all' ? me.guts.length : Math.min(n, me.guts.length);
  for (let i = 0; i < k; i++) me.discard.push(me.guts.pop());
  return k;
};
// 手札の番号の組が正しいか(整数・手札の中・重ならない)。ガッツにする手・捨てる手で使う
//   2026-10-27 総点検 E: 確かめていなかったので、手札に無い番号を送ると、何も無いガッツが増えた(マルチで相手が送る手も同じ)
const cardHandIdxsOk = (hand, idxs) => Array.isArray(idxs) && idxs.every((i) => Number.isInteger(i) && i >= 0 && i < hand.length) && new Set(idxs).size === idxs.length;
const cardTakeFromHand = (st, p, idxs) => {
  const me = st.players[p];
  const sorted = [...new Set(idxs)].sort((a, b) => b - a);
  const taken = sorted.map((i) => me.hand[i]);
  sorted.forEach((i) => me.hand.splice(i, 1));
  return taken;
};

// 攻撃の総ガッツ(付ける札も含む)。技のぶん(組の札も)に、付けた札の「ガッツ-n・半分・0」と友情の証を効かせてから、付けた札のぶんを足す
const cardActionCost = (db, st, p, hand, idxs) => {
  const cards = idxs.map((i) => cardOf(db, hand[i])).filter(Boolean);
  const att = cards.filter((c) => cardHasEff(c, 'attach'));
  const core = cards.filter((c) => !cardHasEff(c, 'attach'));
  let main = core.reduce((s, c) => s + (c.guts || 0), 0);
  if (core[0] && cardHasEff(core[0], 'requires')) main = core[0].guts || 0; // コンビネーション: 一緒に出す2枚のガッツは無視
  const fs = st && st.freeSpe;
  if (core[0] && core[0].kind === 'spe' && core[0].user !== 'breeder' && fs && fs.p === p && fs.turn === st.turn) main = 0;
  if (att.some((c) => cardHasEff(c, 'attachCostHalf'))) main = Math.ceil(main / 2);
  att.forEach((c) => { const e = cardEff(c, 'attachCost'); if (e) main -= e.n; });
  if (att.some((c) => cardHasEff(c, 'attachFree'))) main = 0;
  return cardFieldCostOf(st, Math.max(0, main) + att.reduce((s, c) => s + (c.guts || 0), 0));
};
// 付けた札の効き目をまとめる(ダメージ +n・×n と、守りの縛り)。攻撃を出すときとコンピューターの見積もりで同じものを使う
const CARD_ATTACH_FLAGS = ['attachNoEvade', 'attachNoGuard', 'attachNoBlockReduce', 'attachNoZeroGuard', 'attachNoGuardIfGuarded', 'attachNoEvadeHybrid'];
const cardAttachMods = (cards) => {
  const m = { add: 0, mult: 1, flags: {} };
  cards.forEach((c) => {
    if (!cardHasEff(c, 'attach')) return;
    (c.effects || []).forEach((e) => {
      if (e.t === 'attachAdd') m.add += e.n;
      if (e.t === 'attachMult') m.mult *= e.n;
      if (e.t === 'attachSelfIfHit') m.flags.selfIfHit = (m.flags.selfIfHit || 0) + e.n;
      if (CARD_ATTACH_FLAGS.includes(e.t)) m.flags[e.t] = true;
    });
  });
  return m;
};
// 全体カードで、その手が出せないか(がんじがらめ: モンスターの特殊技 / 必殺技の応酬・封印: 最終的なダメージで決める)
//   最終的なダメージ … 書いてある数・同時に使う組・付けた札(+n・×n)・次のターンn倍・静の構え・全体カードの足し引き(守る前の数)
//   extra … カード投げで捨てる枚数(ダメージに足す)/ target … 狙う子(ボンバのように「空中の子には2倍」の技は、狙う子で数が変わる)
//   2026-10-27 総点検 E: カード投げは捨てる枚数を、ボンバ・牙きり・地雷針・大旋風は狙う子の2倍を数えていなかった(応酬・封印をすり抜けた/出せる手を止めていた)
const cardFieldBanned = (db, st, p, mi, card, idxs, extra = 0, target = null) => {
  if (!st.field || !card) return false;
  const kinds = cardFieldEff(st, 'fieldBanKind');
  if (kinds && mi >= 0 && kinds.kinds.includes(card.kind)) return true;
  const ban = cardFieldEff(st, 'fieldBanDmg');
  if (!ban || !ban.kinds.includes(card.kind)) return false;
  const me = st.players[p];
  const cards = idxs.map((i) => cardOf(db, me.hand[i])).filter(Boolean);
  const mods = cardAttachMods(cards);
  const mon = mi >= 0 ? me.mons[mi] : null;
  let mult = mods.mult;
  if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(card.kind)) mult *= mon.mult.n;
  if (mon && mon.charge && mon.charge.kinds.includes(card.kind)) mult *= mon.charge.n;
  const mv = cardEff(card, 'multVs');
  if (mv && target && cardMonType(target, st.turn) === mv.type) mult *= mv.n;
  const dmg = Math.max(0, (cardBaseDamage(db, st, p, mi, card, cards) + mods.add + extra) * mult + cardFieldDmgAdd(st, card));
  return (ban.max !== undefined && dmg <= ban.max) || (ban.min !== undefined && dmg >= ban.min);
};
// 場の全体カードを置く・外す。外すときは出した人の捨て札へ、持ちょうを元に戻す(悪天候・空間のひずみ)
const cardFieldClear = (st) => {
  if (!st.field) return;
  const f = st.field;
  st.players[f.p].discard.push(f.no);
  st.field = null;
  st.players.forEach((pl) => pl.mons.forEach((m) => { m.fieldType = null; }));
};
const cardFieldPlace = (db, st, p, no) => {
  const c = cardOf(db, no);
  const old = st.field ? cardOf(db, st.field.no) : null;
  if (old) cardLog(st, `全体カード「${old.name}」は場から無くなった`);
  cardFieldClear(st);
  st.field = { no, p, effects: (c.effects || []).map((e) => ({ ...e })) };
  cardLog(st, `全体カード「${c.name}」が場に出た`, { kind: 'field' });
  cardEvent(st, { t: 'field', p, no });
  const ty = cardFieldEff(st, 'fieldType');
  if (ty) st.players.forEach((pl) => pl.mons.forEach((m) => { m.fieldType = ty.type; }));
  const dr = cardFieldEff(st, 'fieldDrawOnPlay');
  if (dr) { const k = cardDrawN(st, p, dr.n); if (k) cardLog(st, `${st.players[p].name}は${k}枚引いた`); }
};
// おいのりの窓を開くか(マルチでも両方の端末で同じになるよう、隠れた手札の中身は見ない: 手札がある・その番にまだ出していない・ガッツが足りる)
const cardPrayWindowOpen = (st, q) => {
  const me = st.players[q];
  return me.hand.length > 0 && me.prayTurn !== st.turn && me.guts.length >= cardFieldCostOf(st, 0);
};
// おいのりの手: 出す(手札のおいのりの、いちばん前の1枚)か、出さない
const cardPrayOptions = (db, st) => {
  const pr = st.pendingPray;
  if (!pr) return [];
  const me = st.players[pr.p];
  const out = [];
  const i = me.hand.findIndex((no) => { const c = cardOf(db, no); return c && c.ready && cardHasEff(c, 'pray'); });
  if (i >= 0 && me.guts.length >= cardGuardCost(st, cardOf(db, me.hand[i]))) out.push({ type: 'pray', hand: [i] });
  out.push({ type: 'pray' });
  return out;
};
// その札を、その技に付けられるか(main … 付ける先の技。mon … 技を出す子。ブリーダーのカードに付ける札は mon が無くてよい)
const cardAttachOk = (db, st, p, mon, main, c) => {
  const w = (cardEff(c, 'attach') || {}).when || {};
  const me = st.players[p];
  if (w.breederMaxGuts !== undefined) return main.user === 'breeder' && !cardHasEff(main, 'attach') && (main.guts || 0) <= w.breederMaxGuts;
  if (!mon || main.user === 'breeder') return false;
  if (!(w.kinds || ['pow', 'int']).includes(main.kind)) return false;
  if (w.area && !cardHasEff(main, 'area')) return false;
  if (w.lifeMax !== undefined && mon.life > w.lifeMax) return false;
  if (w.deckEmpty && me.deck.length) return false;
  if (w.pure && !cardIsPureMon(mon)) return false;
  if (w.subSpe && !(cardIsHybridMon(mon) && main.user === mon.sub)) return false; // 太古の記憶: サブの種族の特殊技にだけ
  return c.user === 'breeder' ? (!me.breederUsed || cardBreederFree(st, p)) : cardUsableBy(c, mon);
};
// 付ける札の組み合わせ(0〜2枚。ブリーダーのカードは1枚まで)
const cardAttachSets = (db, st, p, mon, main, exclude) => {
  const me = st.players[p];
  const idx = me.hand.map((no, j) => ({ j, c: cardOf(db, no) })).filter(({ j, c }) => !exclude.includes(j) && c && c.ready && cardHasEff(c, 'attach') && cardAttachOk(db, st, p, mon, main, c));
  const out = [[]];
  idx.forEach((a) => out.push([a.j]));
  idx.forEach((a, k) => idx.slice(k + 1).forEach((b) => { if (a.c.name !== b.c.name && !(a.c.user === 'breeder' && b.c.user === 'breeder')) out.push([a.j, b.j]); }));
  return out;
};
// 影縛りで名指しできる名前(回避・防御の札の名前)
const cardBindNames = (db) => [...new Set(Object.values(db.cards).filter((c) => c.ready && cardIsGuardKind(c.kind)).map((c) => c.name))].sort();

// その子が、いまもう一度攻撃できるか(1ターン1枚。chain の続きだけはもう一度)
const cardMonCanAttack = (db, st, p, mi, card) => {
  const mon = st.players[p].mons[mi];
  if (!mon || mon.ko) return false;
  if (mon.stunTurn === st.turn) return false;
  if (mon.attacks === 0) return true;
  if (mon.unlimited === st.turn) return true; // 死亡遊戯・タイムディレイ
  if (mon.bonus && mon.bonus.turn === st.turn && mon.attacks < 1 + mon.bonus.n) return true; // 孤軍奮闘・オイリーオイル・ほうり上げる
  const prev = cardOf(db, mon.lastCard);
  const chainNow = cardEff(card, 'chain');
  const chainPrev = cardEff(prev, 'chain');
  if (chainNow && chainPrev && chainNow.names.includes(prev.name) && chainPrev.names.includes(card.name)) return true;
  return false;
};

// 狙える相手か(cannotHit・onlyHit)
const cardCanTarget = (card, target, turn) => {
  if (!target || target.ko) return false;
  const ty = cardMonType(target, turn);
  const ch = cardEff(card, 'cannotHit'); if (ch && ch.type === ty) return false;
  const oh = cardEff(card, 'onlyHit'); if (oh && oh.type !== ty) return false;
  return true;
};

// 全員に当たる技の相手(自分以外の地上の全員、なら味方も入る)
const cardAreaTargets = (st, p, mi, card) => {
  const ar = cardEff(card, 'area');
  const out = [];
  const pushIf = (q, j) => {
    const t = st.players[q].mons[j];
    if (t.ko) return;
    if (ar.only && cardMonType(t, st.turn) !== ar.only) return;
    out.push({ p: q, m: j });
  };
  st.players[cardOther(p)].mons.forEach((_, j) => pushIf(cardOther(p), j));
  if (ar.who === 'others') st.players[p].mons.forEach((_, j) => { if (j !== mi) pushIf(p, j); });
  return out;
};

// このターン、ブリーダーのカードを何枚でも出せるか(うたうニャ)
const cardBreederFree = (st, p) => !!(st.breederFree && st.breederFree.p === p && st.breederFree.turn === st.turn);
// 挑発・魅了などの縛り(相手の次の番に効く)。いま攻撃する p に効いているもの(縛った子が倒れていたら効かない)
const cardTauntsOn = (st, p) => (st.taunts || []).filter((t) => t.turn === st.turn && t.by === cardOther(p) && !st.players[t.by].mons[t.m].ko);
// 狙う相手の組(1体を狙う技は [その子]、全員に当たる技は当たる子の全部)が、縛りに合うか
const cardTauntOk = (st, p, targets, area) => cardTauntsOn(st, p).every((t) => {
  const hits = targets.filter((x) => x.p === t.by);
  if (t.mode === 'not') return !hits.some((x) => x.m === t.m);
  // 全員に当たる技も、縛った子に当たらないもの(空中だけ・地上だけで外れる)は出せない(2026-10-27 総点検D。文「このモンスターにダメージを与える技しか」)
  if (area) return hits.some((x) => x.m === t.m) && (!t.noArea || !hits.some((x) => x.m !== t.m));
  return hits.every((x) => x.m === t.m);
});
// 合体: 生きている味方2体(a のメイン・b のサブ)で出せる混血の組。混血の子は、もとの種族が無いので材料にならない
const cardFuseOptions = (db, st, p) => {
  const mons = st.players[p].mons;
  const out = [];
  mons.forEach((a, ai) => mons.forEach((b, bi) => {
    if (ai === bi || a.ko || b.ko || a.main || b.main) return;
    Object.values(db.monsters).filter((m) => m.main === a.species && m.sub === b.species && m.ready !== false).sort((x, y) => (x.no < y.no ? -1 : 1)).slice(0, 1).forEach((m) => out.push({ a: ai, b: bi, no: m.no }));
  }));
  return out;
};
// 子を別のモンスターに取りかえる(羽化・合体)。ライフは最大・印は消す
const cardSwapMon = (db, mon, no) => {
  const m = cardMonsterOf(db, no);
  Object.assign(mon, { no: m.no, species: m.species, name: m.name, main: m.main || null, sub: m.sub || null, type: m.type, life: m.life, max: m.life, ko: false,
    cocoon: false, charge: null, mult: null, airUntil: -1, waterUntil: -1, safeUntil: -1, noGuardUntil: -1 });
};
// 特殊技の狙い(null は狙わない技)。使えない場面なら空
const cardSpeTargets = (db, st, p, mi, card) => {
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  const ua = cardEff(card, 'useWhenAllies'); if (ua && me.mons.filter((m) => !m.ko).length !== ua.n) return [];
  if (cardHasEff(card, 'heal')) return me.mons.map((m, j) => (!m.ko && m.life < m.max ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'extraAttackTarget')) return me.mons.map((m, j) => (!m.ko && m.attacks > 0 && m.stunTurn !== st.turn ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'unstunTarget')) return me.mons.map((m, j) => (!m.ko && m.stunTurn === st.turn ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'stunTarget') || cardHasEff(card, 'liftTarget')) return opp.mons.map((m, j) => (!m.ko ? { p: cardOther(p), m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'selfHurt')) return me.mons.map((m, j) => (!m.ko ? { p, m: j } : null)).filter(Boolean);
  const rv = cardEff(card, 'revive'); if (rv) return me.mons.map((m, j) => (m.ko && m.species === rv.species ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'possess')) return me.mons.map((m, j) => (m.ko && j !== mi ? { p, m: j } : null)).filter(Boolean); // のりうつる: KOされた味方(この子のほか)
  const self0 = mi >= 0 ? me.mons[mi] : null;
  if (cardHasEff(card, 'emerge') && !(self0 && self0.cocoon)) return [];
  if (cardHasEff(card, 'cocoon') && self0 && self0.cocoon) return [];
  if (cardHasEff(card, 'fuse') && !cardFuseOptions(db, st, p).length) return [];
  // 選ぶ札が1枚も無いときは出さない(手札から選ぶ札は、このカードのほかに手札が要る)
  const ch = cardEff(card, 'choose');
  if (ch) { const n = cardChoiceCands(db, st, p, mi, ch).length - (ch.src === 'hand' ? 1 : 0); if (n <= 0) return []; }
  if (cardHasEff(card, 'peekPick') && !opp.hand.length) return [];
  return [null];
};

// ---- いまできる操作 ----
// 攻撃の候補を全部並べる(コンピューターと画面の「使えるカード」の両方に使う)
const cardAttackOptions = (db, st) => {
  if (st.phase !== 'main' || st.pending || st.pendingChoice || st.pendingReveal || st.pendingPray || st.winner !== null) return [];
  const p = st.active;
  if (st.lock && st.lock.p === p && st.lock.turn === st.turn) return []; // 突進のあと: そのターンはもう出せない
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  const guts = me.guts.length;
  const out = [];
  me.hand.forEach((no, hi) => {
    const card = cardOf(db, no);
    if (!card || !card.ready || !(cardIsAttackKind(card.kind) || card.kind === 'fld')) return;
    if (cardHasEff(card, 'attach')) return; // 付ける札は単独では出さない(下で技に付ける)
    if (card.user === 'breeder') {
      if (me.breederUsed && !cardBreederFree(st, p)) return;
      if (cardHasEff(card, 'rush') && me.playedTurn === st.turn) return; // 突進は、そのターンの最初のカード
      // ジョイのサポートなど、ブリーダーのカードに付ける札も一緒に(付けると払うガッツが変わる)
      cardAttachSets(db, st, p, null, card, [hi]).forEach((att) => {
        const hand = [hi, ...att];
        if (cardActionCost(db, st, p, me.hand, hand) > guts) return;
        if (card.kind === 'fld') { if (!att.length) out.push({ type: 'breeder', hand, target: null }); return; } // 全体カード: 場に置く(狙いは無い)
        if (cardFieldBanned(db, st, p, -1, card, hand)) return; // 必殺技の応酬・封印
        if (card.kind === 'spe') {
          if (cardHasEff(card, 'fuse')) { cardFuseOptions(db, st, p).forEach((fuse) => out.push({ type: 'breeder', hand, target: null, fuse })); return; }
          cardSpeTargets(db, st, p, -1, card).forEach((target) => out.push({ type: 'breeder', hand, target }));
        } else {
          me.mons.forEach((m, mi) => { if (m.ko) return; opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn)) out.push({ type: 'breeder', hand, mon: mi, target: { p: cardOther(p), m: j } }); }); });
        }
      });
      return;
    }
    me.mons.forEach((mon, mi) => {
      // ものまね: その子が使えないちから技でも、ものまねを付ければ出せる / 太古の記憶: 混血の子が、サブの種族の特殊技を出せる
      const enabler = card.kind === 'pow' ? 'mimic' : card.kind === 'spe' && cardIsHybridMon(mon) && card.user === mon.sub ? 'ancient' : null;
      const mimicIdx = enabler ? me.hand.map((n2, j) => ({ j, c: cardOf(db, n2) })).filter(({ j, c }) => j !== hi && c && c.ready && cardHasEff(c, enabler) && cardUsableBy(c, mon)).map((x) => x.j) : [];
      const byMimic = !cardUsableBy(card, mon) && card.user !== 'breeder' && mimicIdx.length > 0 && !mon.ko;
      if ((!cardUsableBy(card, mon) && !byMimic) || !cardMonCanAttack(db, st, p, mi, card)) return;
      if (mon.cocoon && !cardHasEff(card, 'emerge')) return; // まゆ化: 羽化のほかは出せない
      const uw = cardEff(card, 'useWhen'); if (uw && uw.lifeMax !== undefined && mon.life > uw.lifeMax) return; // 最終奥義など: ライフが少ないときだけ
      const combo = cardEff(card, 'combo');
      // 同時に使う札の組(右爪・左爪・ツノ)。いちばん小さい手札の番号の札を主にして、ほかを足す
      const sets = [[hi]];
      if (combo) {
        const others = me.hand.map((n2, j) => ({ j, c: cardOf(db, n2) })).filter(({ j, c }) => j !== hi && c && combo.names.includes(c.name) && c.name !== card.name && cardUsableBy(c, mon));
        const byName = {};
        others.forEach((o) => { if (!(o.c.name in byName)) byName[o.c.name] = o.j; });
        const names = Object.keys(byName);
        if (names.length >= 1) { names.forEach((n) => sets.push([hi, byName[n]])); }
        if (names.length >= 2) sets.push([hi, byName[names[0]], byName[names[1]]]);
        // 同じ組を別の主の札で二重に数えない(主は組の中でいちばん小さい手札の番号)
        for (let k = sets.length - 1; k >= 0; k--) if (Math.min(...sets[k]) !== hi) sets.splice(k, 1);
      }
      // キック・しっぽキック: 同じ名前の札を2枚同時に(主は手札の番号の小さいほう)
      if (cardHasEff(card, 'pair')) { const j = me.hand.findIndex((n2, k) => k > hi && cardOf(db, n2) && cardOf(db, n2).name === card.name); if (j >= 0) sets.push([hi, j]); }
      // コンビネーション: 決まった札を全部一緒に出すときだけ
      const req = cardEff(card, 'requires');
      if (req) {
        const pick = req.names.map((nm) => me.hand.findIndex((n2, k) => k !== hi && cardOf(db, n2) && cardOf(db, n2).name === nm && cardUsableBy(cardOf(db, n2), mon)));
        sets.splice(0, sets.length);
        if (pick.every((k) => k >= 0)) sets.push([hi, ...pick]);
      }
      // 付ける札(底力・クリティカルなど。0〜2枚)
      const withAttach = [];
      sets.forEach((s) => { cardAttachSets(db, st, p, mon, card, s).forEach((att) => { if (mon.cocoon && att.length) return; if (!byMimic || att.some((a) => mimicIdx.includes(a))) withAttach.push([...s, ...att]); }); });
      // カード投げ: 捨てる手札の組ごとに1つの手(toss。残りの手札の組を全部。0枚も入る)
      const tossSets = (idxs) => {
        if (!cardHasEff(card, 'tossBonus')) return [undefined];
        const rest = me.hand.map((_, j) => j).filter((j) => !idxs.includes(j)).slice(0, 6);
        const out2 = [];
        for (let bits = 0; bits < (1 << rest.length); bits++) out2.push(rest.filter((_, k) => bits & (1 << k)));
        return out2;
      };
      withAttach.forEach((idxs) => {
        const cost = cardActionCost(db, st, p, me.hand, idxs);
        if (cost > guts) return;
        if (cardHasEff(card, 'tossBonus')) {
          tossSets(idxs).forEach((toss) => { if (cardFieldBanned(db, st, p, mi, card, idxs, toss.length)) return; opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn) && cardTauntOk(st, p, [{ p: cardOther(p), m: j }], false)) out.push({ type: 'attack', mon: mi, hand: idxs, target: { p: cardOther(p), m: j }, toss }); }); });
          return;
        }
        // 全体カード: がんじがらめ・必殺技の応酬・必殺技の封印(狙う子で数が変わる技は、下で1体ずつ見る)
        const byTarget = cardHasEff(card, 'multVs') && !cardHasEff(card, 'area') && !cardHasEff(card, 'split');
        if (!byTarget && cardFieldBanned(db, st, p, mi, card, idxs)) return;
        if (card.kind === 'spe') {
          // 変形・トランスフォーム: 空中か地上かを選ぶ(手に form を持たせる)
          const forms = cardHasEff(card, 'form') ? ['air', 'ground'] : [undefined];
          cardSpeTargets(db, st, p, mi, card).forEach((target) => forms.forEach((form) => out.push(form ? { type: 'attack', mon: mi, hand: idxs, target, form } : { type: 'attack', mon: mi, hand: idxs, target })));
          return;
        }
        if (cardHasEff(card, 'area')) {
          const at = cardAreaTargets(st, p, mi, card);
          if (at.some((t) => t.p !== p) && cardTauntOk(st, p, at, true)) out.push({ type: 'attack', mon: mi, hand: idxs, target: null });
          return;
        }
        if (cardHasEff(card, 'split')) {
          // ショットガン: 割り振りごとに1つの手(target は無し・split に相手の3体ぶんの点)
          const alive = opp.mons.map((t) => cardCanTarget(card, t, st.turn));
          cardSplits(card.damage || 0, alive).forEach((sp) => { const ts = sp.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean); if (cardTauntOk(st, p, ts, false)) out.push({ type: 'attack', mon: mi, hand: idxs, target: null, split: sp }); });
          return;
        }
        opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn) && cardTauntOk(st, p, [{ p: cardOther(p), m: j }], false) && !(byTarget && cardFieldBanned(db, st, p, mi, card, idxs, 0, t))) out.push({ type: 'attack', mon: mi, hand: idxs, target: { p: cardOther(p), m: j } }); });
      });
    });
  });
  return out;
};

// 守りの候補(攻撃を受けている途中だけ)。狙われた子が使えるカード・誰でも使える守り・味方をかばう札
const cardGuardOptions = (db, st) => {
  const pd = st.pending;
  if (!pd || st.winner !== null) return [];
  const q = pd.defender;
  const me = st.players[q];
  const tgt = pd.targets[pd.ti];
  if (!tgt) return [];
  const target = st.players[tgt.p].mons[tgt.m];
  const atkCard = cardOf(db, pd.main);
  const forbid = st.forbid[q] || [];
  const fl = pd.flags || {};
  if (fl.attachNoGuard) return []; // 瞬殺: 回避も防御も出せない
  if (pd.redirected) return []; // 隠れるで目標を移したら、移した先の子はもう守れない
  const isArea = cardHasEff(atkCard, 'area');
  // 純血のプライド(全体カード): 純血の子の攻撃に、派生の子は回避を出せない
  const atkMon0 = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  const pride = !!cardFieldEff(st, 'fieldPurePride') && atkMon0 && cardIsPureMon(atkMon0) && !cardIsPureMon(target);
  const evadeBlocked = cardHasEff(atkCard, 'noEvade') || pd.noEvade || fl.attachNoEvade;
  const guts = me.guts.length;
  const out = [];
  // 挟み撃ち: このターンもう守りを出した子は、守れない
  const guardedNow = (m) => (fl.attachNoGuardIfGuarded && m.guardTurn === st.turn) || m.noGuardUntil >= st.turn || !!m.cocoon; // 挟み撃ち・怒り・まゆ化
  me.hand.forEach((no, hi) => {
    const c = cardOf(db, no);
    if (!c || !c.ready || !cardIsGuardKind(c.kind)) return;
    if (forbid.includes(c.kind)) return;
    if (cardGuardCost(st, c) > guts) return;
    if (pride && c.kind === 'dge') return; // 純血のプライド: 回避の札は出せない(狙われた派生の子)
    // 集中: そのとき払うガッツが0の守りは出せない(全体カードのホリィの声援で0になった札も止める・師匠のまなざしで1になった札は出せる。2026-10-27 案A)
    if (fl.attachNoZeroGuard && cardGuardCost(st, c) === 0) return;
    if (fl.bind && c.name === fl.bind) return; // 影縛りで名指しされた札
    // ---- 区切り5 ----
    // 狙われていなくても出せる守り(吹き上げる・ひきずりこむ): 味方のだれかが狙われているとき、カードの持ち主が出す
    if (cardHasEff(c, 'liftAllies') || cardHasEff(c, 'waterAll')) {
      if (tgt.p === q) me.mons.forEach((m, mi) => { if (cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    // 盾になる: かばう(cover)と同じく、狙われた味方の代わりの子が出す。全員に当たる技なら、そのあとの味方のぶんも全部
    if (cardHasEff(c, 'shield')) {
      if (pd.shield !== null && pd.shield !== undefined) return;
      me.mons.forEach((m, mi) => { if (mi !== tgt.m && tgt.p === q && cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    if (cardHasEff(c, 'redirect')) {
      if (tgt.p !== q || isArea || !['pow', 'int'].includes(atkCard.kind) || !cardUsableBy(c, target) || guardedNow(target)) return;
      me.mons.forEach((m, j) => { if (j !== tgt.m && !m.ko) out.push({ type: 'guard', hand: hi, mon: tgt.m, to: j }); });
      return;
    }
    if (cardHasEff(c, 'evadeAll')) {
      if (tgt.p === q && isArea && !pd.evadeAll && !evadeBlocked && !(fl.attachNoEvadeHybrid && !cardIsPureMon(target)) && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m });
      return;
    }
    const en = cardEff(c, 'endure') || cardEff(c, 'takeMult');
    if (en) { if (tgt.p === q && en.kinds.includes(atkCard.kind) && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    if (cardHasEff(c, 'noGutsLoss')) { if (tgt.p === q && cardHasEff(atkCard, 'gutsLossOnHit') && !pd.noGutsLoss && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    if (cardHasEff(c, 'cover')) {
      // 味方への1回分を自分が受ける: 狙われたのが味方で、カードの持ち主(生きている別の子)が使う
      if (pd.cover !== null && pd.cover !== undefined) return;
      me.mons.forEach((m, mi) => { if (mi !== tgt.m && tgt.p === q && cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    if (tgt.p !== q || !cardUsableBy(c, target) || guardedNow(target)) return;
    const ev = cardEff(c, 'evade');
    if (ev) {
      if (pd.evaded) return;
      if (cardHasEff(atkCard, 'noEvade') || pd.noEvade || fl.attachNoEvade) return;
      if (fl.attachNoEvadeHybrid && !cardIsPureMon(target)) return; // 純血のスピード
      if (!ev.kinds.includes(atkCard.kind)) return;
      if (ev.minGuts && pd.cost < ev.minGuts) return;
      out.push({ type: 'guard', hand: hi, mon: tgt.m });
      return;
    }
    const re = cardEff(c, 'reduce') || cardEff(c, 'reduceHalf') || cardEff(c, 'reduceAll');
    // 防御でマイナスされない技(技そのもの・渾身を付けたちから技)には、−N・半分・0 の防御の札は出せない(効かないので。社長の答え 2026-10-27・案A。回避されない技の回避の札と同じ扱い)
    if (re) { if (re.kinds.includes(atkCard.kind) && !cardHasEff(atkCard, 'noBlockReduce') && !fl.attachNoBlockReduce) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    const rf = cardEff(c, 'reflect');
    if (rf) { if (rf.kinds.includes(atkCard.kind) && !pd.reflect) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
  });
  return out;
};

const cardLegalActions = (db, st) => {
  if (st.winner !== null) return [];
  if (st.phase === 'setup') return [{ type: 'setupGuts', hand: [] }];
  if (st.pendingPray) return cardPrayOptions(db, st);
  if (st.pendingReveal) return [{ type: 'reveal' }];
  if (st.pendingChoice) return st.pendingChoice.cands.map((i) => ({ type: 'choose', pick: i }));
  if (st.pending) return [...cardGuardOptions(db, st), { type: 'pass' }];
  if (st.phase === 'main') return [...cardAttackOptions(db, st), { type: 'endAttacks' }];
  if (st.phase === 'guts') return [{ type: 'guts', hand: [] }];
  return [];
};
// いま決める番の人(守りの途中なら守る側)
// 攻撃に戻れるか。ガッツの段で、守り・選ぶ・捨てるの途中でなく、灼熱の地が効いた番でないときだけ(助手は使わない)
const cardCanBackToAttack = (st) => !!st && st.winner === null && st.phase === 'guts' && !st.pending && !st.pendingDiscard && !st.pendingChoice && !st.pendingPray && !st.pendingReveal && st.noBackTurn !== st.turn;
const cardDecider = (st) => (st.pendingPray ? st.pendingPray.p : st.pendingReveal ? st.pendingReveal.p : st.pendingChoice ? st.pendingChoice.p : st.pending ? st.pending.defender : st.active);

// ---- 攻撃を出す ----
// 技を使った人の書き方(2026-10-24 窓口・カゲあつくん: 記録・まんなかの「いま使った技」・守りの番の文を1つの形にそろえる)。
//   モンスターの技 … 「モッチーの「ローリン」」 / ブリーダーのカード … 「検査ブリーダーの「加勢」(モッチーで)」(子を選ばないカードは「(…で)」なし)
const cardUseWho = (db, st, p, mi, cardNo) => {
  const c = cardOf(db, cardNo);
  const pl = st.players[p];
  const mon = mi >= 0 ? pl.mons[mi] : null;
  if (c && c.user === 'breeder') return { who: pl.name, by: mon ? mon.name : '' };
  return { who: mon ? mon.name : pl.name, by: '' };
};
const cardUseText = (db, st, p, mi, cards) => {
  const l = cardUseWho(db, st, p, mi, cards[0]);
  return `${l.who}の「${cards.map((n) => (cardOf(db, n) || {}).name || '').join('＋')}」${l.by ? `(${l.by}で)` : ''}`;
};
// 技のダメージの元(書いてある数・組・2枚同時・捨て札やライフで増える分)。付けた札・倍は別(攻撃を出すときとコンピューターの見積もりで同じ)
// discard … 技を出す前の捨て札(払ったガッツは入れない。マルチで相手の端末では、払ったガッツは仮の札のため)
const cardBaseDamage = (db, st, p, mi, main, cards, discard = st.players[p].discard) => {
  let dmg = main.damage || 0;
  const combo = cardEff(main, 'combo');
  if (combo) {
    const kinds = new Set(cards.filter((c) => combo.names.includes(c.name)).map((c) => c.name)).size;
    if (combo.table[kinds]) dmg = combo.table[kinds];
  }
  const pair = cardEff(main, 'pair'); if (pair && cards.filter((c) => c.name === main.name).length >= 2) dmg = pair.dmg;
  const me = st.players[p];
  const bd = cardEff(main, 'bonusDiscard'); if (bd) dmg += discard.map((no) => cardOf(db, no)).filter((c) => c && c.user === bd.user && cardIsAttackKind(c.kind)).length;
  const mon = mi >= 0 ? me.mons[mi] : null;
  if (cardHasEff(main, 'bonusLost') && mon) dmg += mon.max - mon.life;
  return dmg;
};
// ショットガン: ダメージの点を、生きている相手に割り振る全部の分け方(1体に全部も入る)
const cardSplits = (total, alive) => {
  const out = [];
  const rec = (i, left, cur) => {
    if (i === 3) { if (left === 0) out.push(cur.slice()); return; }
    if (!alive[i]) { cur.push(0); rec(i + 1, left, cur); cur.pop(); return; }
    for (let k = left; k >= 0; k--) { cur.push(k); rec(i + 1, left - k, cur); cur.pop(); }
  };
  rec(0, total, []);
  return out.filter((sp) => sp.some((x) => x > 0));
};
const cardStartAttack = (db, st, act) => {
  const p = st.active;
  const me = st.players[p];
  const isBreeder = act.type === 'breeder';
  const mainNo = me.hand[act.hand[0]];
  const main = cardOf(db, mainNo);
  const cost = cardActionCost(db, st, p, me.hand, act.hand);
  // カード投げ: 捨てる手札(技の札と重ならない番号だけ)。技の札を取ったあとの番号に直して取る
  const tossIdx = cardHasEff(main, 'tossBonus') && Array.isArray(act.toss) ? [...new Set(act.toss)].filter((i) => Number.isInteger(i) && i >= 0 && i < me.hand.length && !act.hand.includes(i)) : [];
  const used = cardTakeFromHand(st, p, act.hand);
  const tossed = cardTakeFromHand(st, p, tossIdx.map((i) => i - act.hand.filter((h) => h < i).length));
  const discardBefore = me.discard.slice(); // 魔神ファイナルが数える(払うガッツより前)
  cardPayGuts(st, p, cost);
  me.playedTurn = st.turn; // 突進(そのターンの最初のカード)が見る
  const mi = isBreeder ? (act.mon !== undefined ? act.mon : -1) : act.mon;
  const mon = mi >= 0 ? me.mons[mi] : null;
  if (isBreeder || used.some((n) => { const c = cardOf(db, n); return c && c.user === 'breeder'; })) me.breederUsed = true; // 影縛りなどブリーダーの札を付けたときも1枚に数える
  if (!isBreeder) { mon.attacks += 1; mon.lastCard = mainNo; }
  cardLog(st, cardUseText(db, st, p, mi, used), { kind: 'use', p, cards: used });
  cardEvent(st, { t: 'use', p, mon: mi, cards: used, target: act.target || null });
  if (tossed.length) { me.discard.push(...tossed); cardLog(st, `${me.name}は手札を${tossed.length}枚捨てた`); }
  // 全体カード: 場に置く。相手は出た瞬間に「おいのり」で無くせる(窓は、隠れた手札を見ずに開く。マルチの2台で同じにするため)
  if (main.kind === 'fld') {
    const q = cardOther(p);
    if (cardPrayWindowOpen(st, q)) { st.pendingPray = { p: q, by: p, no: mainNo }; return; }
    cardFieldPlace(db, st, p, mainNo);
    return;
  }
  // 特殊技: 守れない。その場で効く
  if (main.kind === 'spe') {
    cardApplySpecial(db, st, p, mi, main, act.target, act);
    me.discard.push(...used);
    return;
  }
  // ダメージの元: 書いてある数・同時に使う組・付けた札・次のターンn倍
  let dmg = cardBaseDamage(db, st, p, mi, main, used.map((n) => cardOf(db, n)).filter(Boolean), discardBefore);
  const mods = cardAttachMods(used.map((n) => cardOf(db, n)).filter(Boolean));
  dmg += mods.add + tossed.length; // カード投げ: 捨てた枚数を足す
  let mult = mods.mult;
  if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) { mult *= mon.mult.n; mon.mult = null; }
  if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) { mult *= mon.charge.n; mon.charge = null; } // 静の構え
  // ショットガン: 割り振った点のある子だけが目標。付けた札の +n は、いちばん前の子のぶんに足す
  const split = cardHasEff(main, 'split') && Array.isArray(act.split) ? act.split.slice() : null;
  if (split && mods.add) { const k = split.findIndex((x) => x > 0); split[k] += mods.add; }
  const targets = split ? split.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean) : cardHasEff(main, 'area') ? cardAreaTargets(st, p, mi, main) : [act.target];
  st.pending = { attacker: p, defender: cardOther(p), mon: mi, main: mainNo, used, cost, base: dmg, mult, targets, ti: 0, shares: split,
    evaded: false, reduce: 0, reduceHalf: false, reduceAll: false, reflect: null, cover: null, hitAny: false, evadedAny: false, results: [],
    flags: { ...mods.flags, bind: act.bind || null } };
  cardAdvancePending(db, st);
};

// 守る番を、次に守れる相手へ進める(自分の味方に当たる分=地震など は守りを聞かない)
const cardAdvancePending = (db, st) => {
  const pd = st.pending;
  while (pd && pd.ti < pd.targets.length) {
    const t = pd.targets[pd.ti];
    pd.defender = t.p;
    // 味方(攻撃した側)に当たる分は守らずにそのまま当てる
    if (t.p === pd.attacker) { cardResolveTarget(db, st); continue; }
    return;
  }
  if (pd) cardFinishAttack(db, st);
};

// 1体ぶんの結果を出す
const cardResolveTarget = (db, st) => {
  const pd = st.pending;
  const main = cardOf(db, pd.main);
  let t = pd.targets[pd.ti];
  if (pd.cover !== null && pd.cover !== undefined) t = { p: t.p, m: pd.cover };
  if (pd.shield !== null && pd.shield !== undefined && t.p === pd.defender && !st.players[t.p].mons[pd.shield].ko) t = { p: t.p, m: pd.shield }; // 盾になる
  const target = st.players[t.p].mons[t.m];
  let dmg = (pd.shares ? pd.shares[pd.targets[pd.ti].m] : pd.base) * pd.mult; // ショットガンは、その子に割り振った点
  const mv = cardEff(main, 'multVs');
  if (mv && cardMonType(target, st.turn) === mv.type) dmg *= mv.n;
  // 守らなかったら受けたダメージ(画面の「5 → 2」の「前」。全体カードの足し引きは守らなくても掛かるので含め、
  //   守る側が出す肉を切らせては含めない)。出来事に付けるだけで、結果は変えない(2026-10-27 社長・案A)
  const baseDmg = dmg > 0 ? Math.max(0, dmg + cardFieldDmgAdd(st, main)) : dmg;
  if (pd.takeMult) dmg *= pd.takeMult; // 肉を切らせて
  // 守りで持ちょうが変わった(吹き上げる・ひきずりこむ)ときは、当てる直前に当たるかを見直す
  const ar = cardEff(main, 'area');
  const missed = t.p !== pd.attacker && (!cardCanTarget(main, target, st.turn) || (ar && ar.only && cardMonType(target, st.turn) !== ar.only));
  if (missed) dmg = 0;
  // みんな下がれ: 純血のプライド(純血の子の攻撃)と純血のスピードのときは、派生の味方は一緒に回避できない(かばう回避も止める。2026-10-27 社長・案A)
  const atkMon1 = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  const noEvadeHere = !cardIsPureMon(target) && ((!!cardFieldEff(st, 'fieldPurePride') && atkMon1 && cardIsPureMon(atkMon1)) || !!(pd.flags || {}).attachNoEvadeHybrid);
  const evaded = pd.evaded || (pd.evadeAll && t.p !== pd.attacker && !noEvadeHere);
  if (evaded) dmg = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
  if (!cardHasEff(main, 'noBlockReduce') && !(pd.flags || {}).attachNoBlockReduce) {
    if (pd.reduceAll) dmg = 0;
    if (pd.reduceHalf) dmg -= Math.floor(dmg / 2);
    dmg = Math.max(0, dmg - pd.reduce);
  }
  // 全体カード(壮絶な戦い・興奮のるつぼ・飛び散る火花): 当たったダメージ(最終的なダメージ)に足す・引く
  if (dmg > 0) dmg = Math.max(0, dmg + cardFieldDmgAdd(st, main));
  let reflected = 0;
  if (pd.reflect) {
    // カウンター(keep): 半分(切り捨て)を返し、残りだけ受ける(5ダメージなら2を返して3を受ける。2026-10-27 社長)
    if (pd.reflect.keep) { reflected = Math.floor(dmg * pd.reflect.frac); dmg -= reflected; }
    else { reflected = dmg; dmg = 0; }
  }
  if (cardHasEff(main, 'nonLethal')) dmg = Math.max(0, Math.min(dmg, target.life - 1));
  if (pd.endure && dmg >= target.life && target.life > 0) dmg = target.life - 1; // 根性: ライフ1で残る
  if (target.safeUntil >= st.turn) dmg = 0; // ぬいぐるみ
  const lifeBefore = target.life; // ドレインは、実際に減ったライフだけ回復する
  target.life = Math.max(0, target.life - dmg);
  if (dmg > 0) target.charge = null; // 静の構えはダメージを受けると終わる
  const guarded = pd.reduce > 0 || pd.reduceHalf || pd.reduceAll || !!pd.reflect || pd.cover !== null;
  const res = { p: t.p, m: t.m, dmg, evaded, reflected };
  pd.results.push(res);
  cardEvent(st, { t: 'hit', p: t.p, m: t.m, dmg, base: baseDmg, evaded, guarded, card: pd.main });
  // 守り・回避で減ったときは、記録の行に「前 → 後」の数も持たせる(文は変えない。画面が「(5 → 2)」を添える。2026-10-27 社長・案A)
  cardLog(st, missed ? `${target.name}には当たらなかった` : evaded && dmg === 0 ? `${target.name}は回避した` : `${target.name}に${dmg}ダメージ${evaded ? '(回避されても半分)' : ''}`, { kind: 'hit', ...(!missed && (evaded || guarded) && baseDmg !== dmg ? { from: baseDmg, to: dmg } : {}) });
  const atkMon = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  if (dmg > 0) {
    pd.hitAny = true;
    const gl = cardEff(main, 'gutsLossOnHit');
    if (gl && t.p !== pd.attacker && !pd.noGutsLoss) { const k = cardLoseGuts(st, t.p, gl.n); if (k) cardLog(st, `${st.players[t.p].name}はガッツを${k}失った`); }
    if (cardHasEff(main, 'stunOnHit')) { target.stunTurn = st.turn + 1; cardLog(st, `${target.name}は次のターン攻撃できない`); }
    // ドレイン: 「与えたダメージ分」は、実際に減ったライフ(残りライフ1の子を倒したら1。2026-10-27 社長が案Aに決めた)
    if (cardHasEff(main, 'drain') && atkMon && !atkMon.ko) { const h = Math.min(lifeBefore - target.life, atkMon.max - atkMon.life); atkMon.life += h; if (h) cardLog(st, `${atkMon.name}はライフを${h}回復`); }
  }
  if (!evaded || cardHasEff(main, 'halfOnEvade')) { if (!evaded) pd.hitAnyNotEvaded = true; }
  if (evaded) pd.evadedAny = true;
  if (atkMon && atkMon.safeUntil >= st.turn) reflected = 0; // ぬいぐるみ: はね返しも0
  if (reflected > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - reflected);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: reflected, reflect: true });
    cardLog(st, `${reflected}ダメージをはね返した`);
    // はね返されてライフが0になったら、攻撃した子も倒れる(2026-10-24 までここが抜けていて、ライフ0のまま場に残っていた)
    if (atkMon.life <= 0) cardKo(st, pd.attacker, pd.mon);
  }
  if (target.life <= 0 && !target.ko) cardKo(st, t.p, t.m);
  // 次の相手へ(守りの状態は1体ごとに戻す)
  pd.ti += 1; pd.evaded = false; pd.reduce = 0; pd.reduceHalf = false; pd.reduceAll = false; pd.reflect = null; pd.cover = null; pd.noEvade = false;
  pd.redirected = false; pd.endure = false; pd.takeMult = 0; pd.guardCards = []; // 隠れる・根性・肉を切らせては1体ぶん(盾になる・みんな下がれ・我慢は1回の攻撃ぶん)
};

const cardKo = (st, p, m) => {
  const mon = st.players[p].mons[m];
  mon.ko = true; mon.life = 0;
  cardLog(st, `${mon.name}はKOされた`, { kind: 'ko' });
  cardEvent(st, { t: 'ko', p, m });
};

const cardFinishAttack = (db, st) => {
  const pd = st.pending;
  const main = cardOf(db, pd.main);
  const me = st.players[pd.attacker];
  const atkMon = pd.mon >= 0 ? me.mons[pd.mon] : null;
  // 使った子が自分もダメージを受ける(回避されなかった・回避された・いつでも)
  let self = 0;
  const sh = cardEff(main, 'selfDamageIfHit'); if (sh && pd.results.some((r) => !r.evaded)) self += sh.n;
  const se = cardEff(main, 'selfDamageIfEvaded'); if (se && pd.results.some((r) => r.evaded)) self += se.n;
  const sa = cardEff(main, 'selfDamage'); if (sa) self += sa.n;
  if (pd.flags && pd.flags.selfIfHit && pd.results.some((r) => !r.evaded)) self += pd.flags.selfIfHit; // 捨て身
  if (atkMon && atkMon.safeUntil >= st.turn) self = 0; // ぬいぐるみ: 自分の技の反動も0
  if (self > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - self);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: self, self: true });
    cardLog(st, `${atkMon.name}も${self}ダメージを受けた`);
    if (atkMon.life <= 0) cardKo(st, pd.attacker, pd.mon);
  }
  // ポン拳: ダメージを与えたら、この札は捨て札にならず手札へ戻る
  if (cardHasEff(main, 'returnOnHit') && pd.results.some((r) => r.dmg > 0 && r.p !== pd.attacker)) {
    const k = pd.used.indexOf(pd.main);
    me.discard.push(...pd.used.filter((_, i) => i !== k));
    me.hand.push(pd.main);
    cardLog(st, `「${main.name}」は手札に戻った`);
  } else me.discard.push(...pd.used);
  st.pending = null;
  cardCheckWin(st, pd.attacker);
};

// 勝ち負け: 3体とも KO。同時なら攻撃した側の勝ち
const cardCheckWin = (st, attacker) => {
  const dead = st.players.map((pl) => pl.mons.every((m) => m.ko));
  if (dead[0] && dead[1]) cardGameOver(st, attacker, '同時にKO(攻撃した側の勝ち)');
  else if (dead[0]) cardGameOver(st, 1, '全員KO');
  else if (dead[1]) cardGameOver(st, 0, '全員KO');
};

// 特殊技・ブリーダーの特殊
const cardApplySpecial = (db, st, p, mi, card, target, act = {}) => {
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  (card.effects || []).forEach((e) => {
    if (e.t === 'draw') { const k = cardDrawN(st, p, e.n); cardLog(st, `${me.name}は${k}枚引いた`); } // 山札が足りなければ引けた枚数を書く(2026-10-27 総点検D)
    if (e.t === 'peekHand') { cardEvent(st, { t: 'peek', p, hand: opp.hand.slice() }); cardLog(st, `${me.name}は相手の手札を見た`); }
    if (e.t === 'discardOpp') { st.pendingDiscard = { p: cardOther(p), n: Math.min(e.n, opp.hand.length) }; if (!st.pendingDiscard.n) st.pendingDiscard = null; }
    if (e.t === 'heal' && target) { const m = me.mons[target.m]; const h = Math.min(e.n, m.max - m.life); m.life += h; cardEvent(st, { t: 'heal', p, m: target.m, n: h }); cardLog(st, `${m.name}のライフが${h}回復`); }
    if (e.t === 'gutsGuard') { me.gutsGuardUntil = st.turn + 1; cardLog(st, `${me.name}は次のターンまでガッツを減らされない`); }
    if (e.t === 'charge' && mi >= 0) { me.mons[mi].charge = { kinds: e.kinds, n: e.n }; cardLog(st, `${me.mons[mi].name}は次の${e.kinds.includes('pow') ? 'ちから' : 'かしこさ'}技のダメージが${e.n}倍`); }
    const self = mi >= 0 ? me.mons[mi] : null;
    const tm = target ? st.players[target.p].mons[target.m] : null;
    const addBonus = (m, n) => { m.bonus = { turn: st.turn, n: (m.bonus && m.bonus.turn === st.turn ? m.bonus.n : 0) + n }; };
    if (e.t === 'extraAttack' && self) { addBonus(self, e.n); cardLog(st, `${self.name}はこのターン、もう${e.n}回攻撃できる`); }
    if (e.t === 'extraAttackTarget' && tm) { addBonus(tm, e.n); cardLog(st, `${tm.name}はもう${e.n}回攻撃できる`); }
    if (e.t === 'unstunTarget' && tm) { tm.stunTurn = -1; cardLog(st, `${tm.name}は攻撃できるようになった`); }
    if (e.t === 'liftTarget' && tm) { tm.airUntil = Math.max(tm.airUntil, st.turn); cardLog(st, `${tm.name}はこのターン空中になった`); }
    if (e.t === 'unlimitedAttacks' && self) { self.unlimited = st.turn; cardLog(st, `${self.name}はこのターン、技を何枚でも出せる`); }
    if (e.t === 'breederUnlimited') { st.breederFree = { p, turn: st.turn }; cardLog(st, `このターン、${me.name}はブリーダーのカードを何枚でも出せる`); }
    if (e.t === 'taunt' && self) { st.taunts = [...(st.taunts || []).filter((t) => t.turn >= st.turn), { by: p, m: mi, mode: e.mode, noArea: !!e.noArea, turn: st.turn + 1 }]; cardLog(st, e.mode === 'not' ? `相手は次の番、${self.name}に当たる技を出せない` : `相手は次の番、${self.name}を狙う技しか出せない`); }
    if (e.t === 'stunAllEnemies') { opp.mons.forEach((m) => { if (!m.ko) m.stunTurn = st.turn + 1; }); cardLog(st, '相手のモンスターは全員、次のターン攻撃できない'); }
    if (e.t === 'stunTarget' && tm) { tm.stunTurn = st.turn + 1; cardLog(st, `${tm.name}は次のターン攻撃できない`); }
    if (e.t === 'skipTurn') { st.skip = cardOther(p); cardLog(st, `${opp.name}の次の番を飛ばす`); }
    if (e.t === 'rage' && self) { self.noGuardUntil = st.turn + 1; self.mult = { turn: st.turn + 2, kinds: ['pow', 'int'], n: 2 }; cardLog(st, `${self.name}は次の番まで守れない。次の番の技は2倍`); }
    // ---- 区切り7 ----
    if (e.t === 'revive' && tm && tm.ko) { tm.ko = false; tm.life = Math.min(e.life, tm.max); tm.stunTurn = st.turn; tm.attacks = 0; cardLog(st, `${tm.name}がライフ${tm.life}で戻った(このターンは攻撃できない)`); }
    if (e.t === 'possess' && self && !self.ko && tm && tm.ko && tm !== self) {
      const n = self.life;
      tm.ko = false; tm.life = Math.max(1, Math.min(n, tm.max)); tm.stunTurn = st.turn; tm.attacks = 0;
      cardLog(st, `${self.name}が${tm.name}にのりうつった(${tm.name}はライフ${tm.life}で戻った。このターンは攻撃できない)`);
      cardKo(st, p, mi);
    }
    if (e.t === 'cocoon' && self) { self.cocoon = true; cardLog(st, `${self.name}はまゆになった(羽化のほかは出せない)`); }
    if (e.t === 'emerge' && self && self.cocoon) { const from = self.name; cardSwapMon(db, self, e.to); cardLog(st, `${from}は${self.name}になった(ライフ${self.life})`); }
    if (e.t === 'fuse' && act.fuse) {
      const f = act.fuse; const a = me.mons[f.a], b = me.mons[f.b];
      cardKo(st, p, f.a); cardKo(st, p, f.b);
      cardSwapMon(db, a, f.no); a.stunTurn = st.turn; a.attacks = 0;
      cardLog(st, `${b.name}と合体して、${a.name}が出た(このターンは攻撃できない)`);
    }
    // ---- 区切り5 ----
    if (e.t === 'safe' && self) { self.safeUntil = st.turn + 1; cardLog(st, `${self.name}は次の番までダメージを受けない`); }
    if (e.t === 'form' && self && (act.form === 'air' || act.form === 'ground')) { self.type = act.form; cardLog(st, `${self.name}は${act.form === 'air' ? '空中' : '地上'}になった`); }
    // ---- 区切り4 ----
    if (e.t === 'choose') {
      const cands = cardChoiceCands(db, st, p, mi, e);
      if (cands.length) st.pendingChoice = { p, src: e.src, then: e.then, cands, card: card.no };
      else cardLog(st, '選べるカードが無かった');
    }
    if (e.t === 'peekPick') {
      if (opp.hand.length) { st.pendingReveal = { p: cardOther(p), next: { p, src: 'oppHand', then: 'oppDiscard', card: card.no } }; cardLog(st, `${opp.name}は手札を見せる`); }
    }
    if (e.t === 'rush') { let k = 0; for (let i = 0; i < e.n && me.deck.length; i++) { me.guts.push(me.deck.pop()); k += 1; } st.lock = { p, turn: st.turn }; cardLog(st, `${me.name}は山札の上から${k}枚をガッツにした。このターンはもう出せない`); }
    if (e.t === 'lastWish' && self) {
      const n = self.life;
      cardKo(st, p, mi);
      const k = Math.min(n, me.discard.length);
      me.guts.push(...me.discard.splice(me.discard.length - k, k));
      cardLog(st, `捨て札から${k}枚をガッツにした`);
      cardCheckWin(st, p);
    }
    if (e.t === 'gutsZeroBoth') { me.discard.push(...me.guts.splice(0)); const k = cardLoseGuts(st, cardOther(p), 'all'); cardLog(st, `お互いのガッツが0になった${k === 0 && opp.guts.length ? '(相手は精神集中で減らない)' : ''}`); }
    if (e.t === 'deckToGuts') { const k = me.deck.length; me.guts.push(...me.deck.splice(0)); cardLog(st, `山札の${k}枚を全部ガッツにした`); }
    if (e.t === 'oppHandToDeckBottom') { const k = opp.hand.length; opp.deck.unshift(...opp.hand.splice(0)); cardLog(st, `${opp.name}の手札${k}枚を山札の一番下へ`); }
    if (e.t === 'oppDraw') { const k = cardDrawN(st, cardOther(p), e.n); cardLog(st, `${opp.name}は${k}枚引いた`); }
    if (e.t === 'gutsToDeckShuffle') { const k = me.guts.length; me.deck.push(...me.guts.splice(0)); cardReshuffle(st, p); cardLog(st, `${me.name}はガッツ${k}枚を山札に戻して切った`); }
    if (e.t === 'selfHurt' && tm && tm.safeUntil >= st.turn) cardLog(st, `${tm.name}はダメージを受けない(ぬいぐるみ)`);
    else if (e.t === 'selfHurt' && tm) { tm.life = Math.max(0, tm.life - e.n); tm.charge = null; /* 溜めはダメージで終わる(はね返し・反動と同じ。2026-10-27 総点検D) */ cardEvent(st, { t: 'hit', p: target.p, m: target.m, dmg: e.n, self: true }); cardLog(st, `${tm.name}のライフが${e.n}減った`); if (tm.life <= 0) { cardKo(st, target.p, target.m); cardCheckWin(st, p); } }
    if (e.t === 'oppGutsLoss') { const k = cardLoseGuts(st, cardOther(p), e.n); cardLog(st, `${opp.name}はガッツを${k}失った`); }
    if (e.t === 'refresh') { const k = me.hand.length; me.discard.push(...me.hand.splice(0)); cardDrawN(st, p, k); cardLog(st, `${me.name}は手札を${k}枚捨てて、引き直した`); }
    if (e.t === 'millOpp') { let k = 0; for (let i = 0; i < e.n && opp.deck.length; i++) { opp.discard.push(opp.deck.pop()); k += 1; } cardLog(st, `${opp.name}の山札を${k}枚捨て札にした`); }
    if (e.t === 'discardBothHands') { me.discard.push(...me.hand.splice(0)); opp.discard.push(...opp.hand.splice(0)); cardLog(st, 'お互いの手札を全部捨てた'); }
    if (e.t === 'freeSpeThisTurn') { st.freeSpe = { p, turn: st.turn }; cardLog(st, `このターン、${me.name}の味方の特殊技は0ガッツ`); }
    if (e.t === 'forbidThisTurn') { st.forbid[cardOther(p)] = [...(st.forbid[cardOther(p)] || []), ...e.kinds]; cardLog(st, `このターン、相手は${e.kinds.includes('dge') ? '回避' : '防御'}を使えない`); }
  });
};

// 守りのカードを1枚出す
const cardApplyGuard = (db, st, act) => {
  const pd = st.pending;
  const q = pd.defender;
  const me = st.players[q];
  const no = me.hand[act.hand];
  const c = cardOf(db, no);
  cardTakeFromHand(st, q, [act.hand]);
  cardPayGuts(st, q, cardGuardCost(st, c));
  me.discard.push(no);
  const user = me.mons[act.mon];
  user.guardTurn = st.turn; // 挟み撃ちが見る
  cardLog(st, `${user.name}の「${c.name}」`, { kind: 'guard', p: q, cards: [no] });
  cardEvent(st, { t: 'guard', p: q, mon: act.mon, card: no });
  (pd.guardCards || (pd.guardCards = [])).push(no); // 画面の「◯◯(防御 −3)を使った」用(ルールは見ない)
  (c.effects || []).forEach((e) => {
    if (e.t === 'evade') pd.evaded = true;
    if (e.t === 'reduce') pd.reduce += e.n;
    if (e.t === 'reduceHalf') pd.reduceHalf = true;
    if (e.t === 'reduceAll') pd.reduceAll = true;
    if (e.t === 'reflect') pd.reflect = { frac: e.frac, keep: !!e.keep };
    if (e.t === 'cover') pd.cover = act.mon;
    if (e.t === 'redirect') { pd.targets[pd.ti] = { p: q, m: act.to }; pd.redirected = true; cardLog(st, `目標が${me.mons[act.to].name}に変わった`); }
    if (e.t === 'endure') pd.endure = true;
    if (e.t === 'evadeAll') { pd.evadeAll = true; pd.evaded = true; }
    if (e.t === 'shield') pd.shield = act.mon;
    if (e.t === 'noGutsLoss') pd.noGutsLoss = true;
    if (e.t === 'takeMult') pd.takeMult = e.n;
    if (e.t === 'liftAllies') { me.mons.forEach((m, j) => { if (j !== act.mon && !m.ko) m.airUntil = Math.max(m.airUntil, st.turn + 1); }); cardLog(st, `${user.name}以外の味方が空中になった`); }
    if (e.t === 'waterAll') { me.mons.forEach((m) => { if (!m.ko) m.waterUntil = st.turn; }); cardLog(st, '味方が全員水中になった'); }
    if (e.t === 'nextTurnMult') user.mult = { turn: st.turn + 1, kinds: e.kinds, n: e.n };
    if (e.t === 'becomeAir') user.airUntil = st.turn + 1;
    // 自分で捨てるガッツなので、精神集中(相手に減らされない)でも止まらない
    if (e.t === 'selfGutsAll' && me.guts.length) { const k = me.guts.length; me.discard.push(...me.guts.splice(0)); cardLog(st, `${me.name}はガッツを${k}失った`); }
  });
};

// ---- 操作を1つ進める(作り直した状態を返す。だめな操作は null) ----
const cardApplyAction = (db, st0, act) => {
  if (!act || st0.winner !== null) return null;
  const st = cardClone(st0);
  st.events = [];
  const p = st.active;
  // おいのりの窓: 相手が全体カードを出した瞬間。出すと、その全体カードは効かずに捨て札へ(前から場にあった全体カードはそのまま)
  if (st.pendingPray) {
    if (act.type !== 'pray') return null;
    const pr = st.pendingPray;
    const key = (o) => JSON.stringify(o.hand || null);
    if (!cardPrayOptions(db, st0).some((o) => key(o) === key(act))) return null;
    st.pendingPray = null;
    const fc = cardOf(db, pr.no);
    if (act.hand) {
      const me = st.players[pr.p];
      const no = me.hand[act.hand[0]];
      const c = cardOf(db, no);
      cardTakeFromHand(st, pr.p, act.hand);
      cardPayGuts(st, pr.p, cardGuardCost(st, c));
      me.discard.push(no);
      me.prayTurn = st.turn;
      st.players[pr.by].discard.push(pr.no);
      cardLog(st, `${me.name}の「${c.name}」で、全体カード「${fc.name}」は場から無くなった`, { kind: 'use', p: pr.p, cards: [no] });
      cardEvent(st, { t: 'use', p: pr.p, mon: -1, cards: [no], target: null });
      cardEvent(st, { t: 'pray', p: pr.p, no: pr.no });
    } else cardFieldPlace(db, st, pr.by, pr.no);
    return st;
  }
  // 見せる段(死神の力): 手札の持ち主が見せる。そのあと、使った人が1枚選ぶ
  if (st.pendingReveal) {
    if (act.type !== 'reveal') return null;
    const nx = st.pendingReveal.next;
    const q = st.pendingReveal.p;
    st.pendingReveal = null;
    cardEvent(st, { t: 'peek', p: nx.p, hand: st.players[q].hand.slice() });
    const cands = st.players[q].hand.map((_, i) => i);
    if (cands.length) st.pendingChoice = { ...nx, cands };
    return st;
  }
  // 選ぶ段: 候補の中から1枚
  if (st.pendingChoice) {
    const ch = st.pendingChoice;
    if (act.type !== 'choose' || !ch.cands.includes(act.pick)) return null;
    const me = st.players[ch.p];
    const opp = st.players[cardOther(ch.p)];
    const take = (list) => list.splice(act.pick, 1)[0];
    st.pendingChoice = null;
    if (ch.then === 'toHand') { const no = take(me.discard); me.hand.push(no); cardLog(st, `${me.name}は捨て札から「${(cardOf(db, no) || {}).name || ''}」を手札に加えた`); }
    if (ch.then === 'toDeckBottom') { const no = take(me.discard); me.deck.unshift(no); cardLog(st, `${me.name}は捨て札から「${(cardOf(db, no) || {}).name || ''}」を山札の一番下へ戻した`); }
    if (ch.then === 'toDeckShuffleDraw') { me.deck.push(take(me.hand)); cardReshuffle(st, ch.p); cardDrawN(st, ch.p, 1); cardLog(st, `${me.name}は手札を1枚山札に戻して切り、1枚引いた`); }
    if (ch.then === 'discardDraw2') { me.discard.push(take(me.hand)); const k = cardDrawN(st, ch.p, 2); cardLog(st, `${me.name}は手札を1枚捨てて、${k}枚引いた`); }
    if (ch.then === 'oppDiscard') { const no = take(opp.hand); opp.discard.push(no); cardLog(st, `${opp.name}は「${(cardOf(db, no) || {}).name || ''}」を捨てた`); }
    return st;
  }
  if (st.pendingDiscard) {
    // 相手の手札を捨てさせる: 捨てる側が選ぶ
    if (act.type !== 'discard') return null;
    const q = st.pendingDiscard.p;
    const idxs = (act.hand || []).slice(0, st.pendingDiscard.n);
    if (idxs.length !== st.pendingDiscard.n || !cardHandIdxsOk(st.players[q].hand, idxs)) return null;
    const taken = cardTakeFromHand(st, q, idxs);
    st.players[q].discard.push(...taken);
    cardLog(st, `${st.players[q].name}は手札を${taken.length}枚捨てた`);
    st.pendingDiscard = null;
    return st;
  }
  if (st.phase === 'setup') {
    if (act.type !== 'setupGuts') return null;
    const idxs = (act.hand || []).slice(0, CARD_BATTLE_SETUP_GUTS_MAX);
    const q = cardOther(st.first);
    if (!cardHandIdxsOk(st.players[q].hand, idxs)) return null;
    const taken = cardTakeFromHand(st, q, idxs);
    st.players[q].guts.push(...taken);
    if (taken.length) cardLog(st, `${st.players[q].name}は始める前に${taken.length}枚をガッツにした`);
    cardLog(st, 'モンスターを表にした');
    st.active = st.first;
    cardBeginTurn(st);
    return st;
  }
  if (st.pending) {
    if (act.type === 'pass') { cardResolveTarget(db, st); cardAdvancePending(db, st); return st; }
    if (act.type !== 'guard') return null;
    const ok = cardGuardOptions(db, st0).some((o) => o.hand === act.hand && o.mon === act.mon && o.to === act.to); // 隠れるは移す先(to)も合わせる
    if (!ok) return null;
    cardApplyGuard(db, st, act);
    return st;
  }
  if (st.phase === 'main') {
    if (act.type === 'endAttacks') {
      // 灼熱の地(全体カード): 攻撃を終えたとき、攻撃した側のモンスター全員に n ダメージ
      const burn = cardFieldEff(st, 'fieldBurn');
      if (burn) {
        st.players[p].mons.forEach((m, mi) => {
          if (m.ko) return;
          const d = m.safeUntil >= st.turn ? 0 : burn.n; // ぬいぐるみの子は0
          m.life = Math.max(0, m.life - d);
          if (d > 0) m.charge = null; // 力をためる・根を張る・静の構えは、ダメージを受けると終わる(2026-10-27 総点検D)
          cardEvent(st, { t: 'hit', p, m: mi, dmg: d, self: true });
          cardLog(st, `灼熱の地: ${m.name}に${d}ダメージ`, { kind: 'hit' });
          if (m.life <= 0) cardKo(st, p, mi);
        });
        if (st.players[p].mons.every((m) => m.ko)) { cardGameOver(st, cardOther(p), '全員KO'); return st; }
        st.noBackTurn = st.turn; // 灼熱の地が効いた番は、攻撃に戻れない(案A)
      }
      st.phase = 'guts'; return st;
    }
    if (act.type !== 'attack' && act.type !== 'breeder') return null;
    const ok = cardAttackOptions(db, st0).some((o) => o.type === act.type && o.mon === act.mon && JSON.stringify(o.hand) === JSON.stringify(act.hand) && JSON.stringify(o.target) === JSON.stringify(act.target || null) && o.form === act.form && JSON.stringify(o.split) === JSON.stringify(act.split) && JSON.stringify(o.fuse) === JSON.stringify(act.fuse)
      && JSON.stringify(o.toss) === JSON.stringify(Array.isArray(act.toss) ? act.toss.slice().sort((x, y) => x - y) : act.toss)); // カード投げ: 捨てる手札の組
    if (!ok) return null;
    // 影縛り: 名指しが要る札を付けたら、回避・防御の札の名前が1つ要る(付けていなければ名指しは持たない)
    const needBind = act.hand.some((i) => cardHasEff(cardOf(db, st0.players[p].hand[i]), 'attachBind'));
    if (needBind ? !(typeof act.bind === 'string' && cardBindNames(db).includes(act.bind)) : act.bind !== undefined && act.bind !== null) return null;
    cardStartAttack(db, st, act);
    return st;
  }
  if (st.phase === 'guts') {
    // 攻撃に戻る: ガッツにする前なら、攻撃の番へ戻れる。その番に攻撃した印などはそのまま(2026-10-27 社長)
    if (act.type === 'backToAttack') {
      if (!cardCanBackToAttack(st0)) return null;
      st.phase = 'main';
      cardLog(st, `${st.players[p].name}は攻撃に戻った`);
      return st;
    }
    if (act.type !== 'guts') return null;
    const gm = cardFieldEff(st, 'fieldGutsMax'); // 長期戦の予感: ガッツの段で n 枚まで
    if (gm && (act.hand || []).length > gm.n) return null;
    if (!cardHandIdxsOk(st.players[p].hand, act.hand || [])) return null;
    const taken = cardTakeFromHand(st, p, act.hand || []);
    st.players[p].guts.push(...taken);
    if (taken.length) cardLog(st, `${st.players[p].name}は${taken.length}枚をガッツにした`);
    st.active = cardOther(p);
    // 歌う: 相手の番を飛ばす(引く・攻撃・ガッツ置きが無い。その番の数だけ進めて、こちらの番へ)
    //   飛ばした番では「攻撃できない」(吠え・吹き飛ばしなど)を使い切らず、次の本当の番(2つ先)まで残す(2026-10-27 社長)
    if (st.skip === st.active) {
      st.skip = null; st.turn += 1;
      st.players[st.active].mons.forEach((m) => { if (m.stunTurn === st.turn) m.stunTurn = st.turn + 2; });
      cardLog(st, `ターン${st.turn}: ${st.players[st.active].name}の番は飛ばされた`, { kind: 'turn' }); st.active = p;
    }
    cardBeginTurn(st);
    return st;
  }
  return null;
};

// ===== コンピューターの考え方 =====
// 外のAIは入れない(社長)。いまの手を並べて点を付け、助手ごとの「くせの重み」を掛けて選ぶ。
// 先読みの深さと気まぐれは難易度で決まる(5-5)。★次の1手を選ぶ所・デッキを組む所は差し替えられる口にしておく
// sloppy … その場の1手を、考えずに選ぶ割合(守りを出し忘れる・手札を適当にガッツへ回す・適当な相手を狙う)
const CARD_AI_LEVELS = Object.freeze({
  // point … 勝ったときのビートP / loops … 勝ったときのクイック周回(◯周ぶん)。社長が案Aに決めた(台帳 #3484)
  easy:   { depth: 0, whim: 0.30, sloppy: 0.55, point: 80, loops: 14 },
  normal: { depth: 1, whim: 0.15, sloppy: 0.30, point: 110, loops: 16 },
  hard:   { depth: 2, whim: 0.08, sloppy: 0.15, point: 140, loops: 18 },
  expert: { depth: 3, whim: 0.04, sloppy: 0.06, point: 170, loops: 20 },
  master: { depth: 3, whim: 0.01, sloppy: 0, point: 200, loops: 22, readHand: true },
});
// くせの重み(設計書 5-5 の表と同じ数)
const CARD_AI_HABITS = Object.freeze({
  mua:      { attack: 1.5, keepGuard: 0.2, saveGuts: 0.2, big: 0.8, disrupt: 0.5, area: 0.8, finish: 0.5 },
  momosuke: { attack: 1.0, keepGuard: 0.6, saveGuts: 0.8, big: 0.6, disrupt: 1.8, area: 0.8, finish: 0.8 },
  kiki:     { attack: 0.9, keepGuard: 0.7, saveGuts: 1.6, big: 1.8, disrupt: 0.5, area: 1.0, finish: 1.0 },
  kyuko:    { attack: 1.0, keepGuard: 1.0, saveGuts: 1.0, big: 1.0, disrupt: 1.0, area: 1.0, finish: 1.2 },
  dra:      { attack: 0.7, keepGuard: 1.5, saveGuts: 1.0, big: 0.6, disrupt: 0.8, area: 0.8, finish: 0.8 },
  // あつ: 臨機応変(2026-10-29 社長「頭も良く、ゴリ押しもできる。型がいちばん多い子」)。土台は全部ふつうで、場を見て型を切り替える(cardAiHabitNow)
  atsu:     { attack: 1.0, keepGuard: 1.0, saveGuts: 1.0, big: 1.0, disrupt: 1.0, area: 1.0, finish: 1.0, flex: true },
  // ソラシド: 計算して山札切れを狙う(2026-10-29 社長「山札やガッツを削って山札勝ちを狙いやすい」)。mill … 山札を削る・引かせる・ガッツを削る札の重み
  sorashido: { attack: 1.1, keepGuard: 0.9, saveGuts: 1.0, big: 0.9, disrupt: 1.5, area: 1.0, finish: 1.3, mill: 1 },   // 相手の手を崩す(2026-10-27 ルールくんの S2。好きな子ハムで5段×450試合を測った)
});
// 公開の印(RELEASE_FLAGS・data/assistants.js の ASSISTANT_RELEASE_FLAGS)が立つまで、カードの相手えらび・マルチ・観戦・記録・曲の並びに出さない(2026-10-27。ソラシド)。
//   カードだけの一覧は作らず、助手の一覧と同じ assistantReleased で見る。デバッグからも出さない
const cardFoeReleased = (who) => typeof assistantReleased !== 'function' || assistantReleased(who);
// デッキを組むときだけ、くせの値を強さごとに上書きする(打ち方のくせは CARD_AI_HABITS のまま)
//   ドラ MASTER: 大技を軽く見るくせ(big 0.6)でデッキが弱く、プレイヤー役への勝率が目安(38〜65%)の下の境目だった。
//   デッキを組むときだけ 1.0 にして 39%→44%(900試合。2026-10-27 社長が案Aを選んだ)。守りを手放さない打ち方はそのまま
const CARD_AI_DECK_HABIT = Object.freeze({ dra: { master: { big: 1.0 } } });
const cardAiDeckHabit = (who, levelId) => { const h = CARD_AI_HABITS[who] || CARD_AI_HABITS.kyuko; const o = ((CARD_AI_DECK_HABIT[who] || {})[levelId]) || null; return o ? { ...h, ...o } : h; };
// 助手どうしの強さをそろえる数(雑な手の割合に掛ける)。くせとデッキの違いで、同じ難易度でも勝率に差が出るため。
// tools/card/card-rules-check.js の試算で、どの助手もスターター相手に同じくらいの勝率になるように決めた
const CARD_AI_TUNE = Object.freeze({ mua: 0.6, momosuke: 0.5, kiki: 1.3, kyuko: 1, dra: 1.15, atsu: 1, sorashido: 1 });
// 深く読む難易度で、くせの重みを「真ん中(1.0)」へ寄せる割合(1 = そのまま・0.5 = 半分だけ寄せる)。くせの向きは変えない。
//   みゅあ(攻める 1.5・守りを残す 0.2・ガッツをためる 0.2)は、深く読む相手には極端なくせが裏目に出て、
//   EXPERT・MASTER でプレイヤー役に 29〜32% しか勝てなかった(公開の条件。tools/card/card-ai-balance.js で測る)
const CARD_AI_HABIT_BLEND = Object.freeze({ expert: { mua: 0.6 }, master: { mua: 0.6, momosuke: 0.5 } });
// 助手ごと・強さごとに「その場の1手を考えずに選ぶ割合」へ足す値(+ で弱く・- で強く。0〜0.9 に収める)。
// デッキの組み方を毎試合変えた(2026-10-25)ので、card-ai-balance.js で勝率がそろうように決め直した。
// ★きゅうこは足さない(プレイヤー役の考え方にも使うので。きゅうこはデッキ側の CARD_AI_DECK_TUNE だけで合わせる)
const CARD_AI_PLAY_TUNE = Object.freeze({
  // EASY・NORMAL で同じ血統(モッチーの仲間)でも組むようになって強くなった(2026-10-26)ぶん、みゅあの雑さを戻した(前は easy -0.035・normal -0.105)
  mua: { easy: 0.1, normal: -0.04, hard: -0.11, expert: 0.03, master: 0.12 },
  momosuke: { easy: 0.12, normal: 0.06, hard: 0, expert: 0.04, master: 0 },   // 全体カードを入れた(2026-10-30)ぶん EXPERT 0.1 → 0.04・MASTER 0.05 → 0。   // MASTER は3体目を揺らした(2026-10-26)ぶん 0.165 → 0.14。混血のメイン・サブの直し(2026-10-27)で弱くなったぶん 0.05
  kiki: { easy: -0.045, normal: 0.06, hard: 0.15, expert: -0.08, master: 0 },   // 全体カードを入れた(2026-10-30)ぶん EXPERT 0 → -0.08・MASTER 0.1 → 0   // MASTER は3体目を揺らした(2026-10-26)ぶん 0.345 → 0.3。意味不明(277)・混血の直し(2026-10-27)のあと 0.1
  dra: { easy: -0.075, normal: -0.075, hard: 0.03, expert: -0.06, master: 0 },
  atsu: { easy: 0.05, normal: 0, hard: 0.02, expert: 0.06, master: 0 },   // 臨機応変(2026-10-29)で強くなった(NORMAL 55→69%・EASY 73%・EXPERT 69%)ので、各強さで雑さを足した(40戦で測った)   // EXPERT は同じ血統(弱い)でも組むようになった(2026-10-26)ので 0.03 → 0
});
// 同じ血統で組んだ試合だけの、カードの出し方の雑さの足し引き(2026-10-26。HARD から上でも同じ血統で組むようにしたぶん)。
//   モッチーの仲間(みゅあ)は強く、ドラゴンの仲間(あつ)・グジラの仲間(ドラ)は弱かったので、その試合だけ戻す。MASTER は雑さがもう0なので強くはできない
const CARD_AI_SAME_BLOOD_PLAY = Object.freeze({
  mua: { hard: 0.25, expert: 0.1 },
  atsu: { hard: -0.1, expert: -0.1 },
  dra: { expert: -0.06 },
});
// opts.sameBlood … 同じ血統で組んだデッキか(cardAiBuildDeck の返り値の sameBlood)
const cardAiPolicy = (habitId, levelId, opts = {}) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  const tune = CARD_AI_TUNE[habitId] === undefined ? 1 : CARD_AI_TUNE[habitId];
  const base = CARD_AI_HABITS[habitId] || CARD_AI_HABITS.kyuko;
  const blend = (CARD_AI_HABIT_BLEND[levelId] || {})[habitId];
  const habit = blend === undefined ? base : Object.fromEntries(Object.entries(base).map(([k, v]) => [k, typeof v === 'number' ? 1 + (v - 1) * blend : v]));
  const add = (((CARD_AI_PLAY_TUNE[habitId] || {})[levelId]) || 0) + (opts && opts.sameBlood ? (((CARD_AI_SAME_BLOOD_PLAY[habitId] || {})[levelId]) || 0) : 0);
  // opts.playerRole … 勝率を測るときのプレイヤー役(tools/card の検査・道具だけが付ける)。山札切れを気にしない前の打ち方のまま
  //   (2026-10-27 ソランド判断: 人が相手のときと測り方をそろえるため。プレイヤー役まで山札切れを避けると、守り型のドラが EXPERT 34%・MASTER 36% に下がった)
  const out = { habit, level: { ...level, sloppy: Math.max(0, Math.min(0.9, (level.sloppy || 0) * tune + add)) }, playerRole: !!(opts && opts.playerRole) };
  // 助手の得意な全体カード(CARD_AI_DECKS の field)。デッキに入れるだけでは場の点が低くて出さない札があったので、出すときに点を足す(2026-10-30)
  if (!out.playerRole && CARD_AI_DECKS[habitId] && CARD_AI_DECKS[habitId].field) out.fields = CARD_AI_DECKS[habitId].field;
  // 助手と対戦の EXPERT・MASTER は、戦術カードの基本カードを2枚・3枚持つ(82-card-tactics-core の CARD_AI_TACTIC_BASE)。プレイヤー役は持たない
  const gambit = !out.playerRole && !(opts && opts.noTactics) && typeof cardAiTacticGambit === 'function' ? cardAiTacticGambit(habitId, levelId) : null;
  const when = gambit && typeof CARD_AI_TACTIC_WHEN !== 'undefined' ? CARD_AI_TACTIC_WHEN[habitId] || null : null;
  return gambit ? { ...out, gambit, gambitKeepMain: true, gambitWhen: when } : out;
};

// その場で使うくせの値。ふつうは policy.habit のまま。flex(あつ)の子だけ、自分(p)から見た場で型を1つ選び、その向きを 1.6 にする(2026-10-29 社長)
//   上から順に見て、最初に当たった型: とどめ(この番に倒せる相手がいる)→ 全体(相手が2体以上で、全体攻撃を出せる)→
//   守り(倒された数で負けている・主力のライフが半分以下。守りとガッツを残す)→ ゴリ押し(攻める)
const CARD_AI_FLEX_HIGH = 1.6;
const cardAiFlexMode = (db, st, p) => {
  const me = st.players[p], opp = st.players[cardOther(p)];
  const mine = me.mons.filter((m) => !m.ko), foes = opp.mons.filter((m) => !m.ko);
  const ready = me.hand.map((n) => cardOf(db, n)).filter((c) => c && cardIsAttackKind(c.kind) && c.kind !== 'spe' && cardFieldCostOf(st, c.guts || 0) <= me.guts.length && mine.some((m) => cardUsableBy(c, m)));
  if (ready.some((c) => foes.some((t) => (c.damage || 0) >= t.life))) return 'finish';
  if (foes.length >= 2 && ready.some((c) => cardHasEff(c, 'area'))) return 'area';
  const lost = me.mons.filter((m) => m.ko).length, took = opp.mons.filter((m) => m.ko).length;
  const top = mine.slice().sort((a, b) => b.max - a.max)[0];
  if (lost > took || (top && top.life * 2 <= top.max)) return 'guard';
  return 'attack';
};
const cardAiHabitNow = (db, st, p, policy) => {
  const habit = policy.habit;
  if (!habit || !habit.flex) return habit;
  const mode = cardAiFlexMode(db, st, p);
  if (mode === 'guard') return { ...habit, keepGuard: CARD_AI_FLEX_HIGH, saveGuts: CARD_AI_FLEX_HIGH };
  return { ...habit, [mode]: CARD_AI_FLEX_HIGH };
};

// 相手が回避できそうな見込み(見えない手札は、残りの山札＋手札から平均で見積もる)
// atkMon … 攻める子(純血のプライドを見る)。ルールの守りの候補(cardGuardOptions)と同じ決まりで、出せない回避は見込まない
// 切り札(みんなのデッキ・95 の cardSharePolicy が policy.aces にカード番号を3つまで入れる)。手に切り札が入っていれば、その手を優先する。
//   aces が無い・空なら何もしない(助手と対戦・マルチの検査・勝率は変わらない。2026-10-29 社長「戦術カードなどを細かく設定」・ルールくんと相談)
const cardAiAceHit = (policy, hand, idxs) => {
  const aces = policy && Array.isArray(policy.aces) ? policy.aces : null;
  if (!aces || !aces.length || !Array.isArray(hand)) return false;
  const list = Array.isArray(idxs) ? idxs : Number.isInteger(idxs) ? [idxs] : [];
  return list.some((i) => aces.includes(hand[i]));
};
const cardAiEvadeChance = (db, st, p, card, target, level, flags = {}, atkMon = null) => {
  if (cardHasEff(card, 'noEvade') || card.kind === 'spe') return 0;
  if (flags.attachNoEvade || flags.attachNoGuard) return 0; // 電光石火・瞬殺など
  const q = cardOther(p);
  const opp = st.players[q];
  const tmon = opp.mons[target.m];
  if (flags.attachNoEvadeHybrid && !cardIsPureMon(tmon)) return 0; // 純血のスピード
  if (cardFieldEff(st, 'fieldPurePride') && atkMon && cardIsPureMon(atkMon) && !cardIsPureMon(tmon)) return 0; // 純血のプライド: 派生の子は回避を出せない
  // 払うのは「そのとき払うガッツ」(全体カードで変わる)。集中を付けた技には、払うガッツが0の守りは出せない
  const fits = (no) => { const c = cardOf(db, no); const ev = cardEff(c, 'evade'); const cost = c ? cardGuardCost(st, c) : 99; return c && ev && ev.kinds.includes(card.kind) && cardUsableBy(c, tmon) && cost <= opp.guts.length && !(flags.attachNoZeroGuard && cost === 0) && (!ev.minGuts || card.guts >= ev.minGuts); };
  if ((st.forbid[q] || []).includes('dge')) return 0;
  if (level.readHand) return opp.hand.some(fits) ? 0.85 : 0;
  const unseen = [...opp.hand, ...opp.deck];
  if (!unseen.length) return 0;
  const frac = unseen.filter(fits).length / unseen.length;
  return Math.min(0.8, 1 - Math.pow(1 - frac, opp.hand.length));
};

// 攻撃の1手に点を付ける
// 全体カードを出すかの見積もり(両方に効くので、自分に得な向きのときだけ点が上がる)。見るのは自分のカードと、相手の見えている札(捨て札・場)だけ
const cardAiScoreField = (db, st, p, card, cost, habit = null) => {
  const me = st.players[p], op = st.players[cardOther(p)];
  const mine = [...me.hand, ...me.deck, ...me.discard].map((n) => cardOf(db, n)).filter(Boolean);
  const theirs = op.discard.map((n) => cardOf(db, n)).filter(Boolean);
  const share = (list, f, d) => (list.length ? list.filter(f).length / list.length : d);
  const alive = (pl) => pl.mons.filter((m) => !m.ko);
  let v = -cost * 0.25;
  if (st.field) v += st.field.p === p ? -3 : 0.8; // 自分の全体カードは入れ替えない・相手のものは消すと得
  (card.effects || []).forEach((e) => {
    if (e.t === 'fieldDrawOnPlay') v += 0.9 * e.n;
    if (e.t === 'fieldDmg') v += e.n * (share(mine, (c) => e.kinds.includes(c.kind), 0.5) - share(theirs, (c) => e.kinds.includes(c.kind), 0.5)) * 4;
    if (e.t === 'fieldCost') v += e.n < 0 ? 0.6 : (op.guts.length - me.guts.length) * 0.2;
    if (e.t === 'fieldBanDmg') {
      const hit = (c) => ['pow', 'int'].includes(c.kind) && Number.isFinite(c.damage) && (e.max !== undefined ? c.damage <= e.max : c.damage >= e.min);
      v += (share(theirs, hit, 0.3) - share(mine, hit, 0.3)) * 4;
    }
    if (e.t === 'fieldMill') v += (me.deck.length > op.deck.length + 5 ? 1 : -1.5) + (habit && habit.mill ? (me.deck.length >= op.deck.length ? 2 : 0.5) * habit.mill : 0);
    if (e.t === 'fieldPurePride') v += (alive(op).filter((m) => !cardIsPureMon(m)).length - alive(me).filter((m) => !cardIsPureMon(m)).length) * 0.6;
    if (e.t === 'fieldBanKind') v += (share(theirs, (c) => e.kinds.includes(c.kind), 0.2) - share(mine, (c) => e.kinds.includes(c.kind), 0.2)) * 4;
    if (e.t === 'fieldType') v += (alive(me).filter((m) => m.type === e.type).length - alive(op).filter((m) => m.type === e.type).length) * 0.2;
    if (e.t === 'fieldBurn') v += (alive(me).length - alive(op).length) * 0.5 - 0.4;
    if (e.t === 'fieldGutsMax') v += (me.guts.length - op.guts.length) * 0.15;
  });
  return v;
};
const cardAiScoreAttack = (db, st, opt, policy) => {
  const p = st.active;
  const me = st.players[p];
  const { level } = policy;
  const habit = cardAiHabitNow(db, st, p, policy);
  const main = cardOf(db, me.hand[opt.hand[0]]);
  const cost = cardActionCost(db, st, p, me.hand, opt.hand);
  let score = 0;
  if (main.kind === 'fld') return cardAiScoreField(db, st, p, main, cost, habit) + (policy.fields && policy.fields.includes(main.name) && !(st.field && st.field.p === p) ? CARD_AI_FIELD_LIKE : 0);
  if (main.kind === 'spe') {
    (main.effects || []).forEach((e) => {
      if (e.t === 'heal' && opt.target) { const m = me.mons[opt.target.m]; score += Math.min(e.n, m.max - m.life) * 1.1; }
      if (e.t === 'draw') score += e.n * 0.9;
      if (e.t === 'peekHand') score += 0.4 * habit.disrupt;
      if (e.t === 'discardOpp' && st.players[cardOther(p)].hand.length > 0) score += 1.4 * habit.disrupt; // 相手の手札が0なら効き目が無い(2026-10-27 見回り)
      if (e.t === 'gutsGuard') score += st.players[cardOther(p)].hand.length >= 3 ? 0.4 : 0.1;
      // 区切り7
      if (e.t === 'revive') score += 4;
      // のりうつる: 戻す子が、この子より強い(最大ライフが大きい・手札に使える技が多い)ときだけ得。この子は KO になる
      if (e.t === 'possess' && opt.target && opt.mon >= 0) {
        const self0 = me.mons[opt.mon], back = me.mons[opt.target.m];
        const usable = (m) => me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && cardIsAttackKind(c.kind) && cardUsableBy(c, { ...m, ko: false })).length;
        score += (Math.min(self0.life, back.max) - self0.life) * 0.4 + (usable(back) - usable(self0)) * 0.7 + (back.max - self0.max) * 0.15 - 0.3;
      }
      if (e.t === 'cocoon') score += me.hand.some((n) => cardHasEff(cardOf(db, n), 'emerge')) ? 1 : -3;
      if (e.t === 'emerge') { const m0 = opt.mon >= 0 ? me.mons[opt.mon] : null; const to = cardMonsterOf(db, e.to); score += 2 + (m0 && to ? (to.life - m0.life) * 0.3 : 0); }
      if (e.t === 'fuse' && opt.fuse) { const to = cardMonsterOf(db, opt.fuse.no); score += to.life - (me.mons[opt.fuse.a].life + me.mons[opt.fuse.b].life) * 0.8 - 1; }
      // 区切り5
      if (e.t === 'safe') { const m0 = opt.mon >= 0 ? me.mons[opt.mon] : null; score += m0 && m0.life <= Math.ceil(m0.max / 2) ? 1.4 : 0.4; }
      if (e.t === 'form') score += 0.2;
      // 区切り4: 山札・手札・捨て札・ガッツ
      const oppP = st.players[cardOther(p)];
      if (e.t === 'choose') score += e.then === 'toHand' ? 1.3 : e.then === 'discardDraw2' ? 0.9 : 0.3;
      if (e.t === 'peekPick') score += 1.4 * habit.disrupt;
      if (e.t === 'rush') score += me.guts.length < 4 ? 1.6 : 0.2;
      if (e.t === 'lastWish') { const m0 = opt.mon >= 0 ? me.mons[opt.mon] : null; score += m0 ? Math.min(m0.life, me.discard.length) * 0.6 - 2.5 - (me.mons.filter((m) => !m.ko).length <= 1 ? 99 : 0) : -9; }
      if (e.t === 'gutsZeroBoth') score += (oppP.guts.length - me.guts.length) * 0.6;
      if (e.t === 'deckToGuts') score += me.deck.length <= 3 ? 1 : -3;
      if (e.t === 'oppHandToDeckBottom') score += 0.5 * habit.disrupt;
      if (e.t === 'gutsToDeckShuffle') score += me.deck.length < 6 ? me.guts.length * 0.5 : -1;
      if (e.t === 'selfHurt') { const t0 = opt.target ? me.mons[opt.target.m] : null; score += t0 && t0.life >= 3 ? 0.3 : -5; }
      if (e.t === 'oppGutsLoss') score += Math.min(e.n, oppP.guts.length) * 0.8 * habit.disrupt;
      if (e.t === 'refresh') score += me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && c.user !== 'breeder' && c.user !== 'any' && !me.mons.some((m) => !m.ko && cardUsableBy(c, m))).length * 0.6 - 0.4;
      if (e.t === 'millOpp') score += oppP.deck.length <= e.n ? 3 : 0.5;
      // 山札切れを狙う子(mill): 相手の山札が少ないほど、削る・引かせる手を高く見る(自分の山札のほうが多いときだけ)。自分の山札は長持ちさせる
      if (habit.mill) {
        const ahead = me.deck.length >= oppP.deck.length;
        const near = 1 + Math.max(0, 20 - oppP.deck.length) / 10;
        if (e.t === 'millOpp' && ahead) score += Math.min(e.n, oppP.deck.length) * 0.6 * near * habit.mill;
        if (e.t === 'oppDraw' && ahead) score += Math.min(e.n, oppP.deck.length) * 0.4 * near * habit.mill;
        if (e.t === 'gutsToDeckShuffle' && me.deck.length < oppP.deck.length + 3) score += me.guts.length * 0.3 * habit.mill;
      }
      if (e.t === 'discardBothHands') score += (oppP.hand.length - (me.hand.length - opt.hand.length)) * 0.6;
      // 区切り3: もう1回・何枚でも・攻撃できない・縛り・番を飛ばす
      const mine = opt.mon >= 0 ? me.mons[opt.mon] : null;
      const tmon = opt.target ? st.players[opt.target.p].mons[opt.target.m] : null;
      const attacksFor = (m) => (m ? me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && cardIsAttackKind(c.kind) && c.kind !== 'spe' && cardUsableBy(c, m) && c.guts <= me.guts.length - cost).length : 0);
      if (e.t === 'extraAttack') score += Math.min(1, attacksFor(mine)) * 1.6;
      if (e.t === 'extraAttackTarget' || e.t === 'unstunTarget') score += Math.min(1, attacksFor(tmon)) * 1.6;
      if (e.t === 'unlimitedAttacks') score += Math.min(3, attacksFor(mine)) * 0.9 - 0.4;
      if (e.t === 'breederUnlimited') score += me.hand.filter((n) => (cardOf(db, n) || {}).user === 'breeder').length * 0.7 - 0.3;
      if (e.t === 'liftTarget') score += 0.3;
      if (e.t === 'taunt') score += 0.9 * habit.disrupt;
      if (e.t === 'stunAllEnemies') score += st.players[cardOther(p)].mons.filter((m) => !m.ko).length * 1.0;
      // もう「次のターン攻撃できない」印が付いている子に重ねても効き目が無い(2026-10-27 見回り: EXPERT・MASTER で1試合に約0.3回)
      if (e.t === 'stunTarget' && tmon) score += tmon.stunTurn > st.turn ? -3 : 0.8 + (tmon.life / Math.max(1, tmon.max)) * 0.6;
      if (e.t === 'skipTurn') score += 3;
      if (e.t === 'rage' && mine) score += Math.max(0, ...me.hand.map((n) => cardOf(db, n)).filter((c) => c && (c.kind === 'pow' || c.kind === 'int') && cardUsableBy(c, mine)).map((c) => c.damage || 0)) * 0.35 - 0.6;
      // 友情の証: このターン、手札のほかの特殊技を0ガッツで出せる
      if (e.t === 'freeSpeThisTurn') score += me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && c.kind === 'spe' && c.user !== 'breeder' && !cardHasEff(c, 'attach')).reduce((s2, c) => s2 + (c.guts || 0) * 0.4, 0);
      if (e.t === 'charge') {
        const m = opt.mon >= 0 ? me.mons[opt.mon] : null;
        const big = m && !m.charge ? Math.max(0, ...me.hand.map((n) => cardOf(db, n)).filter((c) => c && e.kinds.includes(c.kind) && cardUsableBy(c, m)).map((c) => c.damage || 0)) : 0;
        score += big * 0.5;
      }
      if (e.t === 'forbidThisTurn') {
        const followUp = cardAttackOptions(db, st).filter((o) => o.type === 'attack' && cardOf(db, me.hand[o.hand[0]]).kind !== 'spe').length;
        score += followUp ? 1.5 * habit.disrupt : 0;
      }
    });
  } else {
    let dmg = cardBaseDamage(db, st, p, opt.mon, main, opt.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean));
    const mods = cardAttachMods(opt.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean));
    // カード投げ: 捨てた枚数を足す。捨てる札の値打ちを引く(だれも使えない札は安い。守りの札は高い)
    const toss = Array.isArray(opt.toss) ? opt.toss : [];
    if (toss.length) {
      const live = me.mons.filter((m) => !m.ko);
      score -= toss.map((i) => cardOf(db, me.hand[i])).reduce((a, c) => a + (!c ? 0.3 : c.user === 'breeder' ? 0.6 : !live.some((m) => cardUsableBy(c, m)) ? 0.15 : cardIsGuardKind(c.kind) ? 1.3 * habit.keepGuard : 1.0), 0); // 手札はあとでガッツにもなるので、捨てる値打ちは高め(0.7 だと4枚まとめて捨てがちだった)
    }
    dmg = (dmg + mods.add + toss.length) * mods.mult;
    const mon = opt.mon >= 0 ? me.mons[opt.mon] : null;
    if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) dmg *= mon.mult.n;
    if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) dmg *= mon.charge.n;
    const targets = opt.split ? opt.split.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean) : cardHasEff(main, 'area') ? cardAreaTargets(st, p, opt.mon, main) : [opt.target];
    let drained = 0; // ドレインで回復すると見込んだ合計(全員に当たる技でも、減っている分までしか回復しない)
    let kills = 0; // 倒せる相手の数(相手の最後の子まで倒せるなら、自分へのダメージは気にしない)
    const per = dmg / Math.max(1, main.damage || 1); // ショットガン: 割り振った点に、付けた札・倍の割合を掛ける
    targets.forEach((t) => {
      const tm = st.players[t.p].mons[t.m];
      let d = opt.split ? Math.round(opt.split[t.m] * per) : dmg;
      const mv = cardEff(main, 'multVs'); if (mv && cardMonType(tm, st.turn) === mv.type) d *= mv.n;
      if (cardHasEff(main, 'nonLethal')) d = Math.min(d, tm.life - 1);
      // とどめにならない技(加勢)をライフ1の子に撃っても0ダメージ。撃たない(2026-10-27 見回り)
      if (t.p !== p && d <= 0 && cardHasEff(main, 'nonLethal')) { score -= 2; return; }
      if (t.p !== p && d >= tm.life) kills += 1;
      // 影縛り: 名指しで当たりやすくなる見込み(半分)
      const ev = cardAiEvadeChance(db, st, p, main, t, level, mods.flags, mon) * (opt.hand.some((i) => cardHasEff(cardOf(db, me.hand[i]), 'attachBind')) ? 0.5 : 1);
      const half = cardHasEff(main, 'halfOnEvade') ? Math.ceil(d / 2) : 0;
      const exp = d * (1 - ev) + half * ev;
      const sign = t.p === p ? -1.3 : 1;
      score += sign * Math.min(exp, tm.life) * habit.attack;
      // ドレイン: 実際に減らしたライフの分だけ、減っている自分のライフまで回復する(2026-10-27 社長)
      if (cardHasEff(main, 'drain') && mon && t.p !== p) { const heal = Math.min(Math.min(exp, tm.life), Math.max(0, mon.max - mon.life - drained)); drained += heal; score += heal * 0.5; }
      if (t.p !== p && d >= tm.life) score += (1 - ev) * 4 * habit.finish;
      const gl = cardEff(main, 'gutsLossOnHit');
      if (gl && t.p !== p) score += (1 - ev) * (gl.n === 'all' ? st.players[t.p].guts.length : Math.min(gl.n, st.players[t.p].guts.length)) * 0.8 * habit.disrupt;
      if (cardHasEff(main, 'stunOnHit') && t.p !== p) score += (1 - ev) * 1.2;
    });
    if (targets.length > 1) score *= 1 + 0.15 * (habit.area - 1);
    if (cost >= 5) score *= 1 + 0.12 * (habit.big - 1);
    // 相手の残りを全部倒せる手は、自分も倒れても勝ち(同時に全滅=攻撃した側の勝ち)。自分へのダメージを引かない(2026-10-27 見回り: 相打ちで勝てるのに攻撃をやめていた)
    const winsNow = kills > 0 && kills >= st.players[cardOther(p)].mons.filter((m) => !m.ko).length;
    const sh = cardEff(main, 'selfDamageIfHit'); if (sh && mon && !winsNow) score -= sh.n * (mon.life <= sh.n ? 3 : 0.6);
    const si = mods.flags.selfIfHit; if (si && mon && !winsNow) score -= si * (mon.life <= si ? 3 : 0.6); // 捨て身
    const sa = cardEff(main, 'selfDamage'); if (sa && mon && !winsNow) score -= sa.n * (mon.life <= sa.n ? 3 : 0.6);
  }
  // ガッツを使いすぎると、相手の番に守れない(先読み1以上・くせ「守りを残す」「ガッツをためる」)
  const left = me.guts.length - cost;
  const cheapGuard = Math.min(9, ...me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && cardIsGuardKind(c.kind)).map((c) => c.guts));
  if (level.depth >= 1 && cheapGuard < 9 && left < cheapGuard) score -= 1.2 * habit.keepGuard;
  score -= cost * 0.12 * habit.saveGuts * (level.depth >= 2 ? 1.2 : 1);
  // 先読み2以上: 相手のいちばん強い子(残りライフあたりの火力)を先に落とす
  if (level.depth >= 2 && opt.target && opt.target.p !== p) {
    const tm = st.players[opt.target.p].mons[opt.target.m];
    score += (tm.max - tm.life) * 0.15 + (tm.life <= 3 ? 0.8 : 0);
  }
  return score;
};

// 狙われた子が受けるダメージを、ルール(cardResolveTarget)と同じ順で見込む: 回避 → 防御で減らす → 全体カードで足し引き → はね返す → 根性
//   add … これから出す守りで足される分 { evaded, reduce, reduceHalf, reduceAll, reflect, endure }。返す { dmg, back }
const cardAiFinalDamage = (db, st, add = {}) => {
  const pd = st.pending;
  const main = cardOf(db, pd.main);
  const tgt = pd.targets[pd.ti];
  const target = st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m];
  let dmg = (pd.shares ? pd.shares[tgt.m] : pd.base) * pd.mult;
  const mv = cardEff(main, 'multVs'); if (mv && cardMonType(target, st.turn) === mv.type) dmg *= mv.n;
  if (pd.takeMult) dmg *= pd.takeMult;
  if (pd.evaded || add.evaded) dmg = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
  if (!cardHasEff(main, 'noBlockReduce') && !(pd.flags || {}).attachNoBlockReduce) {
    if (pd.reduceAll || add.reduceAll) dmg = 0;
    if (pd.reduceHalf || add.reduceHalf) dmg -= Math.floor(dmg / 2);
    dmg = Math.max(0, dmg - pd.reduce - (add.reduce || 0));
  }
  if (dmg > 0) dmg = Math.max(0, dmg + cardFieldDmgAdd(st, main));
  let back = 0;
  const rf = add.reflect || pd.reflect;
  if (rf) { if (rf.keep) { back = Math.floor(dmg * rf.frac); dmg -= back; } else { back = dmg; dmg = 0; } }
  if (cardHasEff(main, 'nonLethal')) dmg = Math.max(0, Math.min(dmg, target.life - 1));
  if ((pd.endure || add.endure) && dmg >= target.life && target.life > 0) dmg = target.life - 1;
  if (target.safeUntil >= st.turn) dmg = 0;
  return { dmg, back };
};
const cardAiIncomingDamage = (db, st) => cardAiFinalDamage(db, st).dmg;
// 守りの番の画面に出す「受けるダメージ 前 → 後」(2026-10-27 社長「いくつからいくつとか、わかりやすい表記」)。
//   before … 守りを使わなかったら受けるダメージ / after … いま出した守りで受けるダメージ / cards … 出した守りの札
//   みんな下がれ(evadeAll)は狙われた子も回避する。かばう・身代わりで受ける子が替わったときは after を出さない(null)
const cardGuardPreview = (db, st) => {
  const pd = st && st.pending;
  if (!pd || !Array.isArray(pd.targets) || !pd.targets[pd.ti]) return null;
  const cards = Array.isArray(pd.guardCards) ? pd.guardCards.slice() : [];
  const clean = { ...pd, evaded: false, evadeAll: false, reduce: 0, reduceHalf: false, reduceAll: false, reflect: null, endure: false, cover: null, takeMult: 0 };
  const before = cardAiFinalDamage(db, { ...st, pending: clean }).dmg;
  if (!cards.length) return { before, after: before, cards };
  const moved = (pd.cover !== null && pd.cover !== undefined) || (pd.shield !== null && pd.shield !== undefined);
  const after = moved ? null : (pd.evadeAll ? cardAiFinalDamage(db, st, { evaded: true }).dmg : cardAiFinalDamage(db, st).dmg);
  return { before, after, cards };
};
// 守りの1枚を出したときの見込み。ルール(cardResolveTarget)と同じ決まりで数える。tools/card/card-ai-rule-sync-check.js が実際の結果と突き合わせる
//   返す: after(狙われた子が受けるダメージ)/ extra(ほかの得損)/ back(はね返すダメージ)/ cost(そのとき払うガッツ)
const cardAiGuardEstimate = (db, st, o, dmg) => {
  const pd = st.pending;
  const me = st.players[pd.defender];
  const main = cardOf(db, pd.main);
  const tgt = pd.targets[pd.ti];
  const target = st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m];
  const c = cardOf(db, me.hand[o.hand]);
  let after = dmg;
  // 回避・防御・はね返す・根性は、ルールと同じ順で数える(防御でマイナスされない技・全体カードの足し引きも cardAiFinalDamage が見る)
  const re = cardEff(c, 'reduce'); const rf = cardEff(c, 'reflect');
  const add = { evaded: cardHasEff(c, 'evade') || cardHasEff(c, 'evadeAll'), reduce: re ? re.n : 0, reduceHalf: cardHasEff(c, 'reduceHalf'), reduceAll: cardHasEff(c, 'reduceAll'), reflect: rf ? { frac: rf.frac, keep: !!rf.keep } : null, endure: cardHasEff(c, 'endure') };
  const fin = (add.evaded || add.reduce || add.reduceHalf || add.reduceAll || add.reflect || add.endure) ? cardAiFinalDamage(db, st, add) : null;
  if (fin) after = fin.dmg;
  if (cardHasEff(c, 'cover') || cardHasEff(c, 'shield')) {
    const cm = me.mons[o.mon];
    after = target.life <= dmg && cm.life > dmg ? 0 : dmg; // 倒れそうな味方を、硬い子がかばう
  }
  // 区切り5
  let extra = 0;
  if (cardHasEff(c, 'redirect')) { const am = me.mons[o.to]; after = 0; extra -= Math.min(dmg, am.life) * 0.9 + (am.life <= dmg ? 5 : 0); }
  if (cardHasEff(c, 'evadeAll')) { extra += cardAiEvadeAllCovers(st, pd) * Math.min(3, dmg) * 0.6; }
  if (cardHasEff(c, 'noGutsLoss')) { const gl = cardEff(main, 'gutsLossOnHit'); extra += (gl ? (gl.n === 'all' ? me.guts.length : Math.min(gl.n, me.guts.length)) : 0) * 0.6; }
  if (cardHasEff(c, 'takeMult')) { after = dmg * 2; extra += 1.2; }
  if (cardHasEff(c, 'liftAllies') || cardHasEff(c, 'waterAll')) {
    const tmp = JSON.parse(JSON.stringify(target));
    if (cardHasEff(c, 'waterAll')) tmp.waterUntil = st.turn; else if (o.mon !== tgt.m) tmp.airUntil = st.turn + 1;
    const ar = cardEff(main, 'area');
    after = !cardCanTarget(main, tmp, st.turn) || (ar && ar.only && cardMonType(tmp, st.turn) !== ar.only) ? 0 : dmg;
  }
  const back = fin ? fin.back : 0;
  return { after, extra, back, cost: cardGuardCost(st, c), c };
};
// みんな下がれで、このあと狙われる子のうち一緒に回避できる子の数(純血のプライド・純血のスピードのとき、派生の子は外す)
const cardAiEvadeAllCovers = (st, pd) => {
  const atk = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  const noHybrid = (!!cardFieldEff(st, 'fieldPurePride') && atk && cardIsPureMon(atk)) || !!(pd.flags || {}).attachNoEvadeHybrid;
  return pd.targets.slice(pd.ti + 1).filter((t) => t.p !== pd.attacker && !(noHybrid && !cardIsPureMon(st.players[t.p].mons[t.m]))).length;
};
// 守りの1枚に点を付ける(出さないなら pass)
// gopt … 戦術カード(82-card-tactics-core)から: only(守りの候補を絞る)・force(守れるなら、しきい値を見ずに守る)。無ければ今のまま
const cardAiChooseGuard = (db, st, policy, rand, gopt = null) => {
  const pd = st.pending;
  const q = pd.defender;
  const me = st.players[q];
  const habit = cardAiHabitNow(db, st, q, policy);
  // 生き残りが2体以下のときは、守りをためしに当てて「守らなければ負けないのに、守ると負ける」守り(肉を切らせて・かばう など)を外す
  const loseAfter = (a) => { try { const s = cardAiSettle(db, cardApplyAction(db, st, a)); return !!s && s.winner !== null && s.winner !== undefined && s.winner !== q; } catch (_) { return false; } };
  const few = me.mons.filter((m) => !m.ko).length <= 2;
  const passLoses = few && loseAfter({ type: 'pass' });
  const opts = cardGuardOptions(db, st).filter((o) => (!few || passLoses || !loseAfter(o)) && (!gopt || !gopt.only || gopt.only(o)));
  if (!opts.length) return { type: 'pass' };
  const main = cardOf(db, pd.main);
  const tgt = pd.targets[pd.ti];
  const target = st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m];
  // もう全部はね返した攻撃・とどめにならない技(加勢)も cardAiFinalDamage が見込む(前カード部長の見回り 2026-10-27 の2行を取り込んだ)
  const dmg = cardAiIncomingDamage(db, st);
  if (dmg <= 0) return { type: 'pass' };
  // 守らないを選ぶこともある(2026-10-29 社長「場合によっては、ガードを残さない選択もあってよい」)。倒れる攻撃はいつもどおり守る
  const dies = target.life <= dmg;
  const guardsInHand = me.hand.filter((n) => cardIsGuardKind((cardOf(db, n) || {}).kind)).length;
  // とどめ向きの子: 次の自分の番に倒せる相手がいて、守るとそのガッツが足りなくなるなら、倒れない攻撃は受ける
  const opp = st.players[cardOther(q)];
  const finisher = me.hand.map((n) => cardOf(db, n)).filter((c) => c && cardIsAttackKind(c.kind) && c.kind !== 'spe' && me.mons.some((m) => !m.ko && cardUsableBy(c, m)) && opp.mons.some((t) => !t.ko && (c.damage || 0) >= t.life));
  const finishCost = finisher.length ? Math.min(...finisher.map((c) => cardFieldCostOf(st, c.guts || 0))) : null;
  let best = null;
  opts.forEach((o) => {
    const { after, extra, back, cost, c } = cardAiGuardEstimate(db, st, o, dmg);
    const saved = Math.min(dmg, target.life) - Math.min(after, target.life);
    const ko = target.life <= dmg && target.life > after ? 5 : 0;
    const lostAll = cardHasEff(c, 'selfGutsAll') ? me.guts.length - cost : 0; // 緊急回避: 残りのガッツも全部なくなる
    let v = extra + saved * (0.6 + 0.4 * habit.keepGuard) + ko - (cost + lostAll) * 0.35 * habit.saveGuts + back * 0.6 + (cardAiAceHit(policy, me.hand, o.hand) ? 1.5 : 0);
    // ガッツをためる子でも、ライフの半分以上を減らす攻撃は守る(2026-10-29 社長 案B: ききが払うガッツ2の守りを見送っていた)
    if (!dies && habit.saveGuts >= 1.3 && Math.min(dmg, target.life) * 2 >= target.life && saved > 0) v += (cost + lostAll) * 0.35 * habit.saveGuts + 1;
    if (!dies && finishCost !== null && habit.finish >= 1.3 && me.guts.length - cost - lostAll < finishCost && me.guts.length >= finishCost) v -= 2;
    // 守りの札が最後の1枚の子(守り ふつう)は、倒れない小さい攻撃には取っておく
    if (!dies && guardsInHand <= 1 && habit.keepGuard >= 0.55 && habit.keepGuard < 1.3 && Math.min(dmg, target.life) * 2 < target.life) v -= 0.8;
    if (!best || v > best.v) best = { v, o };
  });
  if (!best || (!(gopt && gopt.force) && best.v < 0.8 + rand() * 0.3)) return { type: 'pass' };
  return best.o;
};

// 手札をガッツへ: 使えない札(持ち主が KO)・使えそうにない重い札から。くせ「ガッツをためる」でためる量が増える
// gopt … 戦術カードから: count(この枚数だけ置く)・keepGuards(回避・防御の札はガッツにしない)。無ければ今のまま
const cardAiChooseGuts = (db, st, policy, gopt = null) => {
  const p = st.active;
  const me = st.players[p];
  const habit = cardAiHabitNow(db, st, p, policy);
  const target = Math.round(3 + 1.6 * habit.saveGuts);
  const need = Math.max(0, target - me.guts.length);
  const keep = (no) => {
    const c = cardOf(db, no);
    if (!c) return -9;
    const usable = c.user === 'breeder' || me.mons.some((m) => !m.ko && cardUsableBy(c, m)); // 倒れた子しか使えない札は使えない
    if (!usable) return -10;
    if (cardIsGuardKind(c.kind)) return 2 * habit.keepGuard - c.guts * 0.2;
    return (c.damage || 1) * 0.5 - Math.max(0, c.guts - (me.guts.length + 2)) * 0.8;
  };
  // 切り札(policy.aces・みんなのデッキ)はガッツにしない(手札に残す)。aces が無ければ今と同じ
  const aceKeep = (no) => (policy && Array.isArray(policy.aces) && policy.aces.includes(no) ? 10 : 0);
  const ks = me.hand.map((no, i) => ({ i, k: keep(no) + aceKeep(no), g: cardIsGuardKind((cardOf(db, no) || {}).kind) }));
  // 守りの札を1枚は手元に残す(2026-10-29 社長「ガード軽視が目立つ」: 守りの札を全部ガッツにして、次の相手の番に守れない)
  //   いちばん残したい守りの札を、攻めの札より後(ガッツにしない側)へ回す
  //   守りを残すくせが低い子(みゅあ)も1枚は残す。残さないと NORMAL 62→50%・MASTER 48→35% に落ちた(2026-10-29 小さく測った)。
  //   みゅあの「守らない」は、攻撃を受けたときの選び方(cardAiChooseGuard・守りを残すくせ 0.2)で出る
  const guardKeep = ks.filter((x) => x.g && x.k > -9).sort((a, b) => b.k - a.k)[0];
  if (guardKeep) guardKeep.k += 3 + habit.keepGuard;
  const order = ks.sort((a, b) => a.k - b.k);
  const pick = [];
  order.forEach((o) => { if (o.k <= -9) pick.push(o.i); });
  for (const o of order) { if (pick.length >= Math.max(need, pick.length) || me.hand.length - pick.length <= 1) break; if (!pick.includes(o.i)) pick.push(o.i); }
  if (gopt && Number.isInteger(gopt.count)) {
    pick.splice(0, pick.length, ...order.map((o) => o.i).slice(0, gopt.count));
  }
  if (gopt && gopt.keepGuards) { for (let k = pick.length - 1; k >= 0; k--) if (cardIsGuardKind((cardOf(db, me.hand[pick[k]]) || {}).kind)) pick.splice(k, 1); }
  const gm = cardFieldEff(st, 'fieldGutsMax'); // 長期戦の予感
  // 山札切れを自分から呼ばない(2026-10-27 あつさん「山札を気にせず負ける」):
  //   次の自分の番に引く枚数(手札が5枚なら1枚・それ未満なら5枚まで)が山札より多くなるほど、手札をガッツにしない
  return { type: 'guts', hand: (gm ? pick.slice(0, gm.n) : pick).slice(0, policy.playerRole ? 99 : cardAiGutsCap(me)) };
};
// ガッツにしてよい枚数の上限(次の番に引く枚数が山札を超えないように)。山札が5枚以上あれば上限なし
const cardAiGutsCap = (me) => (me.deck.length >= CARD_BATTLE_HAND_MAX ? 99 : Math.max(0, me.hand.length - (CARD_BATTLE_HAND_MAX - me.deck.length)));

// ---- 自分で負けにいく手を選ばない(2026-10-27 遊ぶ人の声。カード部の割り当て) ----
// ソラシドさん「最後の1体しかいないのに自爆して負ける」・あつさん「山札を気にせず負ける」。
// 危ない部品を持つ手だけ、ためしに打って(相手は守らない・選ぶ段は先頭)、次のどれかになる手は選ばない(どの強さでも。雑な手のときも)
//   ・その手で自分のモンスターが全員倒れて負ける(相手も同時に全滅して勝てるなら選んでよい。攻撃した側の勝ち・ルール⑧)
//   ・その手で山札が減り、次の自分の番に引く枚数より山札が少なくなる(もともと足りないときは、その手のせいではないので数えない)
const CARD_AI_RISKY_EFFS = ['selfDamage', 'selfDamageIfHit', 'selfDamageIfEvaded', 'attachSelfIfHit', 'lastWish', 'selfHurt', 'fuse',
  'draw', 'deckToGuts', 'rush', 'refresh', 'choose', 'fieldMill', 'fieldDrawOnPlay', 'fieldBurn'];
const cardAiDrawNeed = (pl) => (pl.hand.length >= CARD_BATTLE_HAND_MAX ? 1 : CARD_BATTLE_HAND_MAX - pl.hand.length);
const cardAiSettle = (db, st) => {
  let s = st;
  for (let i = 0; i < 40 && s && s.winner === null; i++) {
    let a = null;
    if (s.pendingPray) a = { type: 'pray' };
    else if (s.pendingReveal) a = { type: 'reveal' };
    else if (s.pendingChoice) a = { type: 'choose', pick: s.pendingChoice.cands[0] };
    else if (s.pendingDiscard) a = { type: 'discard', hand: s.players[s.pendingDiscard.p].hand.map((_, k) => k).slice(0, s.pendingDiscard.n) };
    else if (s.pending) a = { type: 'pass' };
    if (!a) break;
    s = cardApplyAction(db, s, a) || null;
  }
  return s;
};
// その手で自分から負けるか(true なら選ばない)。p … 手を出す人
const cardAiLosesBy = (db, st, opt, p = st.active, policy = null) => {
  if (!opt || !Array.isArray(opt.hand) || (opt.type !== 'attack' && opt.type !== 'breeder')) return false;
  const me = st.players[p];
  const risky = opt.hand.some((i) => { const c = cardOf(db, me.hand[i]); return c && (c.effects || []).some((e) => CARD_AI_RISKY_EFFS.includes(e.t)); });
  if (!risky) return false;
  let s;
  try { s = cardAiSettle(db, cardApplyAction(db, st, opt)); } catch (_) { return false; }
  if (!s) return false;
  if (s.winner !== null && s.winner !== undefined) return s.winner !== p;
  const after = s.players[p];
  if (!(policy && policy.playerRole) && after.deck.length < me.deck.length && after.deck.length < cardAiDrawNeed(after) && me.deck.length >= cardAiDrawNeed(me)) return true;
  return false;
};

// 影縛りを付けた手に、名指しする守りの名前を入れる。手札を読む難易度は相手の手札の守り、
//   ほかは相手の捨て札でいちばん多い守り(見えている札だけ)、無ければ狙う子が使える回避の札
const cardAiFillBind = (db, st, o, policy) => {
  if (!o || !Array.isArray(o.hand)) return o;
  const me = st.players[st.active];
  if (!o.hand.some((i) => cardHasEff(cardOf(db, me.hand[i]), 'attachBind'))) return o;
  const opp = st.players[cardOther(st.active)];
  const tmon = o.target && o.target.p !== st.active ? opp.mons[o.target.m] : opp.mons.find((m) => !m.ko);
  const guardName = (no) => { const c = cardOf(db, no); return c && c.ready && cardIsGuardKind(c.kind) && (!tmon || c.user === 'any' || cardUsableBy(c, tmon)) ? c.name : null; };
  const seen = (policy.level.readHand ? opp.hand : opp.discard).map(guardName).filter(Boolean);
  const count = {}; seen.forEach((n) => { count[n] = (count[n] || 0) + 1; });
  let name = Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1))[0];
  if (!name) name = Object.values(db.cards).filter((c) => c.ready && cardHasEff(c, 'evade') && (!tmon || cardUsableBy(c, tmon))).map((c) => c.name).sort()[0] || cardBindNames(db)[0];
  return { ...o, bind: name };
};

// 次の1手を選ぶ(★差し替えられる口。別の考え方を差すときは、同じ形 (db, st, policy, rand) → 操作 で渡す)
// 付ける札が何も変えない手か(2026-10-27 観戦の記録: ドラがカララギマンゴーにジョイのサポートを付けて2枚出していた。社長が案A＋Bを選んだ)
//   助手(cardAiChooseAction)は選ばない・画面(84)は組み合わせのボタンに出さない。どちらもこの関数で決める(ルールでは出してよい手のまま)
//   o … cardAttackOptions の手1つ(st.active の手札で見る)。むだと見るのは次の2つ
//   ・払うガッツを減らすだけの札(ジョイのサポート・光合成・団結・急襲)で、外しても払うガッツが同じか少ない
//   ・純血のスピードを、狙う相手に純血でない子がいない技に付ける
const CARD_COST_ONLY_EFFS = ['attach', 'attachFree', 'attachCost', 'attachCostHalf'];
const cardAttachUseless = (db, st, o) => {
  const p = st.active;
  const me = st.players[p];
  if (!o || (o.type !== 'attack' && o.type !== 'breeder') || !Array.isArray(o.hand) || o.hand.length < 2) return false;
  const main = cardOf(db, me.hand[o.hand[0]]);
  if (!main) return false;
  const targets = (cardHasEff(main, 'area') ? cardAreaTargets(st, p, o.mon, main) : o.target ? [o.target] : []).filter((t) => t.p !== p);
  const cost = cardActionCost(db, st, p, me.hand, o.hand);
  return o.hand.slice(1).some((i) => {
    const c = cardOf(db, me.hand[i]);
    if (!c) return false;
    const effs = (c.effects || []).map((e) => e.t);
    if (effs.length && effs.every((t) => CARD_COST_ONLY_EFFS.includes(t))) return cardActionCost(db, st, p, me.hand, o.hand.filter((x) => x !== i)) <= cost;
    if (cardHasEff(c, 'attachNoEvadeHybrid') && targets.length && !targets.some((t) => !cardIsPureMon(st.players[t.p].mons[t.m]))) return true;
    return false;
  });
};
// 攻撃の候補(自分で負けにいく手は、どの強さでも選ばない。付けても何も変わらない札は付けない。外すと手が無くなるときは元のまま)
const cardAiAttackChoices = (db, st, policy) => {
  const opts0 = cardAttackOptions(db, st).filter((o) => !cardAiLosesBy(db, st, o, st.active, policy));
  const useful = opts0.filter((o) => !cardAttachUseless(db, st, o));
  return useful.length ? useful : opts0;
};
const cardAiAttackScored = (db, st, opts, policy) => opts.map((o) => ({ o, s: cardAiScoreAttack(db, st, o, policy) + (cardAiAceHit(policy, st.players[st.active].hand, o.hand) ? 2 : 0) })).sort((a, b) => b.s - a.s);
const cardAiChooseAction = (db, st, policy, rand = Math.random) => {
  // おいのり: 相手が出した全体カードは、相手に都合のよいものとみて、持っていれば無くす(雑な手のときは出し忘れる)
  if (st.pendingPray) { const use = cardPrayOptions(db, st).find((o) => o.hand); return use && rand() >= (policy.level.sloppy || 0) ? use : { type: 'pray' }; }
  if (st.pendingReveal) return { type: 'reveal' };
  if (st.pendingChoice) {
    // 選ぶ段: 手に入れる・山札へ戻すなら強い札、手札から出すなら要らない札、相手に捨てさせるなら相手の強い札
    const ch = st.pendingChoice;
    const me = st.players[ch.p];
    const list = ch.then === 'oppDiscard' ? st.players[cardOther(ch.p)].hand : ch.src === 'hand' ? me.hand : me.discard;
    const worth = (no) => { const c = cardOf(db, no); if (!c) return -9; const usable = c.user === 'breeder' || c.user === 'any' || me.mons.some((m) => !m.ko && cardUsableBy(c, m)); return (usable ? 1 : -3) + (c.damage || 0) * 0.5 + (cardIsGuardKind(c.kind) ? 1.5 : 0) - Math.max(0, c.guts - me.guts.length) * 0.3; };
    const best = ch.cands.slice().sort((a, b) => (ch.then === 'toDeckShuffleDraw' || ch.then === 'discardDraw2' ? worth(list[a]) - worth(list[b]) : worth(list[b]) - worth(list[a])) || a - b)[0];
    return { type: 'choose', pick: best };
  }
  if (st.pendingDiscard) {
    const q = st.pendingDiscard.p;
    const hand = st.players[q].hand;
    // 捨てる側が選ぶ: いちばん要らない札から
    const order = hand.map((no, i) => ({ i, g: (cardOf(db, no) || {}).guts || 0 })).sort((a, b) => b.g - a.g).map((o) => o.i);
    return { type: 'discard', hand: order.slice(0, st.pendingDiscard.n) };
  }
  if (st.phase === 'setup') {
    const q = cardOther(st.first);
    const hand = st.players[q].hand;
    const order = hand.map((no, i) => ({ i, g: (cardOf(db, no) || {}).guts || 0 })).sort((a, b) => b.g - a.g).map((o) => o.i);
    return { type: 'setupGuts', hand: order.slice(0, CARD_BATTLE_SETUP_GUTS_MAX) };
  }
  const sloppy = rand() < (policy.level.sloppy || 0);
  // 戦術カード(みんなのデッキ・82-card-tactics-core)。並びが無い・雑な手のときは今のまま
  if (!sloppy && policy.gambit && typeof cardTacticDecide === 'function') {
    const tac = cardTacticDecide(db, st, policy);
    if (tac && tac.act) return tac.act;
    if (tac && tac.policy) policy = tac.policy;
  }
  if (st.pending) return sloppy ? { type: 'pass' } : cardAiChooseGuard(db, st, policy, rand);
  if (st.phase === 'guts') {
    if (!sloppy) return cardAiChooseGuts(db, st, policy);
    const hand = st.players[st.active].hand;
    const gm = cardFieldEff(st, 'fieldGutsMax');
    return { type: 'guts', hand: hand.map((_, i) => i).filter(() => rand() < 0.4).slice(0, Math.min(gm ? gm.n : 99, policy.playerRole ? 99 : cardAiGutsCap(st.players[st.active]))) };
  }
  const opts = cardAiAttackChoices(db, st, policy);
  if (!opts.length) return { type: 'endAttacks' };
  if (sloppy) return rand() < 0.25 ? { type: 'endAttacks' } : cardAiFillBind(db, st, opts[Math.floor(rand() * opts.length)], policy);
  const scored = cardAiAttackScored(db, st, opts, policy);
  if (scored[0].s <= 0.3) return { type: 'endAttacks' };
  if (rand() < policy.level.whim) {
    const pool = scored.filter((x) => x.s > 0.3).slice(0, 3);
    return cardAiFillBind(db, st, pool[Math.floor(rand() * pool.length)].o, policy);
  }
  return cardAiFillBind(db, st, scored[0].o, policy);
};

// ---- 助手のデッキ(5-5) ----
// kit … 元のスターターをそのまま使う / build … 3体を決めて、くせに合わせてカードを選ぶ
// HARD より上は、同じ3体で組み直す(HARD は第1弾のカードだけ・EXPERT と MASTER は全部の弾)
// field … 助手ごとの全体カード(HARD から2枚ずつ入れる。第2弾より後の札は、弾の制限が外れる EXPERT から)。
//   入れたい度の点だけで組むと全体カードは入らなかった(2026-10-30 社長「助手ごとに入れる」)
const CARD_AI_DECKS = Object.freeze({
  mua:      { kit: 'speed', field: ['ホリィの声援', '飛び散る火花'] },     // 速攻。技を安く・特殊攻撃を強く
  momosuke: { kit: 'miracle', field: ['冷静な判断', 'がんじがらめ'] },     // 手札を整え、相手の特殊技を封じる
  kiki:     { kit: 'powerful', field: ['必殺技の応酬', '長期戦の予感'] },  // 小技を封じ、ガッツをためて大技
  dra:      { kit: 'powerful', field: ['興奮のるつぼ', '必殺技の封印'] },  // 守り。受けるダメージを減らす場
  kyuko:    { monsters: ['C-007', 'C-005', 'C-009'], field: ['必殺技の応酬'] },  // 小技を封じる。2種入れると MASTER で7点下がったので1種(2026-10-30)。ナーガ・ピクシー・モッチー
  atsu:     { monsters: ['C-003', 'C-001', 'C-002'], prefer: ['竜巻アタック', '地震', '炎のカベ', 'ブリザード'], field: ['必殺技の応酬', '灼熱の地'] },  // 全体カードは大技で押す場と焼ける場。ゴーレム・ライガー・ガリ。全体攻撃を集める
  sorashido: { monsters: ['C-008', 'C-001', 'C-003'], prefer: ['大混乱', '時間稼ぎ', '大鎌', 'ハテナマーク', 'ニャーにゃー'] },  // 山札とガッツを削る札(その3体で使えるものだけ入る)  // ハム・ライガー・ゴーレム(ルールくんが測った試合でいちばん多かった3体。3体は好きな子ハムから毎試合選ぶ)。prefer はまだ無い
});
// 助手の好きなモンスター(1体。2026-10-25 社長「1体だけ好きなモンスターを決めて、あとは好みのバランスでデッキ組む」)。
// 名前ではなく主血統(種族)で決める(「モッチーだけどジェントル使うとかはあり」)。その種族の通常・キラ・別絵キラと、
// その種族を主血統に持つ混血・派生がみな候補になり、カードが増えれば自動で候補に入る。どの強さでも必ず1体入れる
const CARD_AI_FAVORITE = Object.freeze({ mua: 'mocchi', momosuke: 'metalner', kiki: 'golem', kyuko: 'mew', dra: 'zilla', atsu: 'dragon', sorashido: 'hare' });   // ソラシドはハム(2026-10-27 社長の決め)
// 強さごとの組み方(社長の決め)。maxWave … 技などのカードの弾(好きな子の技は、その子の弾まで使える) / noise … カードの選び方の雑さ /
// temp … 残り2体の選び方のゆらぎ(大きいほど型に合わない子も入る) / stray … 気まぐれな子(型と関係なく)が1体混ざる割合 /
// best … いちばん強い組み合わせ(相手のデッキも見る)
// 同じ血統の2体・3体(2026-10-26 社長「3体編成も実際あるから組まれるようにして」)。
//   2体目・3体目をえらぶたびに、この割合で好きな子の血統の仲間(派生・混血を含む)からえらぶ。
//   割合は強さごとの値 × 仲間の多さ(仲間が5体以上で1、4体で0.75、3体で0.5、2体で0.25、1体だけなら0)。MASTER は入れない(下の cardAiPickTrio)
const CARD_AI_SAME_BLOOD = Object.freeze({ easy: 0.3, normal: 0.28 });
// HARD から上でも、1試合ごとにこの割合 × 仲間の多さで、同じ血統で組む試合にする(2026-10-26 社長「マスターでもたまに同じ血統や3体全部同じが出るでいい」)。
//   その試合では、2体目を仲間の中でいちばん強い子(数え直した点数 cardAiTeamValue)にし、3体目も半分は仲間から(3体とも同じ血統)
const CARD_AI_SAME_BLOOD_HI = Object.freeze({ hard: 0.2, expert: 0.12, master: 0.1 });
// HARD から上は割合でなく点数でえらぶ(2026-10-26 社長「同じメインのメリットは同じ攻撃カードを入れられること、同じサブのメリットは同じ防御カードを使えること。
//   だからといってその組み方が強いわけではないと思う」)。仲間(同じ血統の子)の点数は、チームとして数え直す(cardAiTeamValue)
//   ・ふつうの点数(cardAiMonScore)は子ごとに「使える良い技の上位10枚」を数えるので、同じ血統の子どうしでは同じ技を2回・3回数えてしまう。
//     デッキに入る同じ技は3枚までなので、同じ技を使える子が増えても技の種類は増えない(これが損)。仲間の点数は「チームにまだ無い技」だけで数える
//   ・得: すでにえらんだ子と同じ攻撃の技を使える枚数 × atk、同じ回避・防御を使える枚数 × guard(手札で使えずに残るカードが減る)
//   ・損: 3体の特徴(地上・空中・水中)がそろう … type、同じ血統の子がいる(同じ種族に効く技にまとめてやられやすい)… blood
const CARD_AI_TEAM = Object.freeze({ atk: 0.04, guard: 0.06, type: 0.8, blood: 0.5 });
const cardAiSameBloodScale = (familySize) => Math.max(0, Math.min(1, (familySize - 1) / 4));
const cardAiBloodOf = (m) => (String(m.wave) === 'hybrid' ? m.main : m.species);
// すでにえらんだ子(team)に仲間 m を足したときの、チームとして数え直した点数(cardAiMonScore と同じ目盛り)
const cardAiTeamValue = (db, who, team, m, maxWave, levelId = null) => {
  const habit = cardAiDeckHabit(who, levelId);
  const mine = Object.values(db.cards).filter((c) => c.ready && c.user !== 'any' && c.user !== 'breeder' && c.wave <= Math.max(maxWave, cardAiMonWave(db, m, c)) && cardUsableBy(c, { ...m, ko: false }));
  const sharedBy = (c) => team.some((t) => cardUsableBy(c, { ...t, ko: false }));
  const fresh = mine.filter((c) => !sharedBy(c)).map((c) => cardAiCardValue(c, habit)).sort((x, y) => y - x).slice(0, 10).reduce((x, v) => x + v, 0);
  const atk = mine.filter((c) => !cardIsGuardKind(c.kind) && sharedBy(c)).length;
  const guard = mine.filter((c) => cardIsGuardKind(c.kind) && sharedBy(c)).length;
  const sameType = team.length >= 2 && team.every((t) => t.type === m.type) ? 1 : 0;
  const sameBlood = team.filter((t) => cardAiBloodOf(t) === cardAiBloodOf(m)).length;
  return fresh + (m.life || 0) * 0.3 + cardAiMillMonBonus(habit, m) + CARD_AI_TEAM.atk * atk + CARD_AI_TEAM.guard * guard - CARD_AI_TEAM.type * sameType - CARD_AI_TEAM.blood * sameBlood;
};
const CARD_AI_BUILD = Object.freeze({
  easy:   { maxWave: 1, noise: 1.6, temp: 3.0, stray: 0.3 },              // 好きな子優先の気分屋・組み方は雑
  normal: { maxWave: 1, noise: 0.8, temp: 1.5, stray: 0 },                // 型に合う子が中心・カードは適当に
  hard:   { maxWave: 1, noise: 0.3, temp: 0.8, stray: 0 },                // 好きな子と相性のいい子・癖どおりにしっかり
  expert: { maxWave: 99, noise: 0.15, temp: 0.5, stray: 0 },              // 全部の弾から・強いカードを優先
  // lastTop … 3体目を、点の高い上位◯体から毎試合えらぶ(2026-10-26 社長「MASTER も少しだけ揺らす」)。いちばんの子は2倍えらばれやすい。
  //   2体目はいちばん強い子のまま。上位4組からえらぶ形や3体目を上位3体からにすると、点は近くても勝率が9〜17点下がる助手が出た(card-ai-balance で測った)
  master: { maxWave: 99, noise: 0.05, temp: 0.2, stray: 0, best: true, lastTop: 2 },  // いちばん強い組み合わせで本気・相手のデッキを見て選び直す
});
// 助手ごとの強さのそろえ(カードの選び方の雑さに足す値。+ で弱く・- で強く。0 より下にはならない)。
// tools/card/card-ai-balance.js で、プレイヤー役(スターター)への勝率が強さごとにそろうように決めた(2026-10-25)
const CARD_AI_DECK_TUNE = Object.freeze({
  mua: { easy: -0.7, normal: -2.1, hard: -2.2 },
  momosuke: {  },
  kiki: { easy: -0.9 },
  kyuko: { easy: -1.5, normal: -1.5, hard: -1.5, expert: 0, master: -0.05 },   // MASTER は派生25枚(ママニャーなど)で好きな子の幅が広がり強くなったので 0.1 → 1(2026-10-25)
  dra: { easy: -1.5, normal: -1.5, expert: 0.5, master: 0.5 },   // EXPERT はカウンターの直し(半分返して残りを受ける・2026-10-27)で 38% を下回ったので揺らぎを足した(57%)。MASTER は混血のメイン・サブの直し(2026-10-27)のあと、card-rules-check の強さの範囲に入るように 0.5
  atsu: { easy: -1.5, normal: -3, hard: -2.1 },
  sorashido: { easy: -1.5, normal: -1.5, hard: -1.5, master: -0.05 },   // 2026-10-27 ルールくん(プレイヤー役への勝率 EASY 42.7・NORMAL 48.7・HARD 50.2・EXPERT 47.6・MASTER 47.8%)
});
// 組み直すデッキで、順番の枠に入れてよい「入れたい度」の下限(cardAiCardValue の値)。助手ごとの違いは、
//   EXPERT・MASTER でプレイヤー役との勝率がそろうように tools/card/card-ai-balance.js で決めた
const CARD_AI_LANE_MIN_DEFAULT = 0.8;
const CARD_AI_LANE_MIN = Object.freeze({ momosuke: 1.5, dra: 0.8, kyuko: 2.0, atsu: 1.5, sorashido: 1.5 });   // きゅうこは混血のメイン・サブの直し(2026-10-27)で弱くなったぶん 1.5。ドラは不自然な手の直し(2026-10-27)で MASTER が 38% を割ったので 0.3 → 0.8(1 より上だと好きな子の技が入らないことがある)
const CARD_DECK_COPY_MAX = 3; // 同じ名前の技・全体・ブリーダーカードは3枚まで
const CARD_AI_ATTACH_MAX = 6;
const CARD_AI_FIELD_LIKE = 1; // 得意な全体カードを出すときに足す点(cardAiScoreAttack)
const CARD_AI_FIELD_COPIES = 2; // 助手の全体カード(CARD_AI_DECKS の field)は1種2枚。場には1枚しか残らないので多く入れても腐る

// カード1枚の「入れたい度」(くせの重みを掛ける)
const cardAiCardValue = (card, habit) => {
  const eff = (t) => cardHasEff(card, t);
  // 技に付ける札(区切り2): 1枚では何もしないので控えめ。条件つきのものはさらに下げる
  if (eff('attach')) {
    let v = 0.3;
    (card.effects || []).forEach((e) => {
      if (e.t === 'attachAdd') v += e.n * 0.35;
      if (e.t === 'attachMult') v += (e.n - 1) * 0.7;
      if (e.t === 'attachCost') v += e.n * 0.3;
      if (e.t === 'attachCostHalf' || e.t === 'attachFree') v += 0.6;
      if (e.t === 'attachNoEvade' || e.t === 'attachNoGuard') v += 0.7;
      if (e.t === 'mimic') v += 0.4;
      if (e.t === 'attachBind' || e.t === 'attachNoEvadeHybrid' || e.t === 'attachNoBlockReduce' || e.t === 'attachNoZeroGuard' || e.t === 'attachNoGuardIfGuarded') v += 0.35;
      if (e.t === 'attachSelfIfHit') v -= e.n * 0.3;
    });
    const w = cardEff(card, 'attach').when || {};
    if (w.deckEmpty) v *= 0.2;
    if (w.lifeMax !== undefined) v *= 0.5;
    if (w.area) v *= 0.6 * habit.area;
    return v - card.guts * 0.3;
  }
  if (cardIsGuardKind(card.kind)) {
    let v = eff('evade') ? 2.2 : eff('reduceAll') ? 2.4 : eff('reflect') ? 2.3 : eff('cover') ? 1.4 : eff('endure') ? 1.1 : eff('redirect') ? 1.0 : eff('shield') ? 1.0
      : eff('evadeAll') ? 1.2 : eff('noGutsLoss') ? 0.8 : eff('takeMult') ? 0.5 : (eff('liftAllies') || eff('waterAll')) ? 0.6 : 1.6;
    const re = cardEff(card, 'reduce'); if (re) v = 1 + re.n * 0.4;
    if (eff('selfGutsAll')) v -= 1.4; // 緊急回避: 守れても、ためたガッツを全部なくす
    return (v - card.guts * 0.35) * habit.keepGuard;
  }
  if (card.kind === 'spe') {
    let v = 0.6;
    (card.effects || []).forEach((e) => {
      if (e.t === 'draw') v += e.n * 0.5;
      if (e.t === 'heal') v += e.n * 0.35;
      if (e.t === 'discardOpp') v += e.n * 0.8 * habit.disrupt;
      if (e.t === 'peekHand') v += 0.2 * habit.disrupt;
      if (e.t === 'forbidThisTurn') v += 0.8 * habit.disrupt;
      if (e.t === 'gutsGuard') v += 0.3;
      if (e.t === 'charge') v += 1.2;
      if (e.t === 'extraAttack') v += 0.8;
      if (e.t === 'extraAttackTarget') v += 0.6;
      if (e.t === 'unstunTarget') v += 0.2;
      if (e.t === 'liftTarget') v += 0.2;
      if (e.t === 'unlimitedAttacks') v += 1.0;
      if (e.t === 'breederUnlimited') v += 0.4;
      if (e.t === 'taunt') v += 0.6 * habit.disrupt;
      if (e.t === 'stunAllEnemies') v += 1.2;
      if (e.t === 'stunTarget') v += 0.8;
      if (e.t === 'skipTurn') v += 1.5;
      if (e.t === 'rage') v += 0.6;
      if (e.t === 'choose') v += e.then === 'toHand' ? 0.8 : 0.3;
      if (e.t === 'safe') v += 0.8;
      if (e.t === 'revive') v += 0.3;
      if (e.t === 'possess') v += 0.2;
      if (e.t === 'cocoon') v -= 1;
      if (e.t === 'emerge') v += 0.3;
      if (e.t === 'fuse') v -= 0.3;
      if (e.t === 'form') v += 0.1;
      if (e.t === 'peekPick') v += 0.8 * habit.disrupt;
      if (e.t === 'rush' || e.t === 'gutsZeroBoth' || e.t === 'oppHandToDeckBottom' || e.t === 'oppGutsLoss' || e.t === 'millOpp' || e.t === 'discardBothHands' || e.t === 'refresh') v += 0.3;
      // 山札切れを狙う子(mill): 相手の山札を削る・引かせる・ガッツを削る・自分の山札を長持ちさせる札を高く見る(その札を使える子も3体に選ばれやすくなる)
      if (habit.mill) {
        if (e.t === 'millOpp') v += e.n * 0.6 * habit.mill;
        if (e.t === 'oppDraw') v += e.n * 0.4 * habit.mill;
        if (e.t === 'oppGutsLoss') v += e.n * 0.6 * habit.mill;
        if (e.t === 'gutsToDeckShuffle') v += 1.6 * habit.mill;
      }
      if (e.t === 'lastWish' || e.t === 'deckToGuts' || e.t === 'gutsToDeckShuffle' || e.t === 'selfHurt') v -= 0.3;
    });
    if (cardHasEff(card, 'useWhenAllies')) v *= 0.4;
    return v - card.guts * 0.3;
  }
  let dmg = card.damage || 0;
  if (eff('combo')) dmg = 3;
  const pr = cardEff(card, 'pair'); if (pr) dmg = pr.dmg * 0.45; // 2枚そろったときだけ
  if (eff('requires')) dmg *= 0.3; // 決まった札がそろわないと出せない
  if (eff('bonusDiscard') || eff('bonusLost')) dmg += 3;
  if (eff('tossBonus')) dmg += 1.5; // カード投げ: ふつうは手札を1〜2枚捨てて使う
  if (eff('returnOnHit')) dmg += 0.8;
  if (eff('halfOnEvade') || eff('noEvade')) dmg *= 1.3;
  if (eff('area')) dmg *= 1.6 * habit.area;
  const gl = cardEff(card, 'gutsLossOnHit'); if (gl) dmg += (gl.n === 'all' ? 2 : gl.n) * 0.7 * habit.disrupt * (1 + (habit.mill || 0));
  if (eff('stunOnHit')) dmg += 1;
  const sh = cardEff(card, 'selfDamageIfHit') || cardEff(card, 'selfDamage'); if (sh) dmg -= sh.n * 0.8;
  const cost = card.guts + 1.5;
  const big = card.guts >= 4 ? habit.big : 1;
  return (dmg / cost) * 2 * habit.attack * big;
};

// ★デッキを組む口(差し替えられる。形は (db, 助手id, 難易度id) → { monsters:[3], cards:[50] })
// 決まった並びの乱数(rand を渡さないとき。検査・試算で同じデッキを作れるように、助手と強さから決める)
const cardAiSeededRand = (key) => {
  let h = 2166136261;
  for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let t = h >>> 0;
  return () => { t = (t + 0x6D2B79F5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
};
const cardAiPickIndex = (weights, rand) => {
  const total = weights.reduce((x, w) => x + Math.max(0, w), 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) { r -= Math.max(0, weights[i]); if (r < 0) return i; }
  return weights.length - 1;
};
// 好きなモンスターの候補(主血統がその種族のもの。通常・キラ・別絵キラ・混血/派生)
const cardAiFavoriteCandidates = (db, who) => {
  const fav = CARD_AI_FAVORITE[who] || CARD_AI_FAVORITE.mua;
  return Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && (String(m.wave) === 'hybrid' ? m.main === fav : m.species === fav)).map((m) => m.no).sort();
};
// モンスターの弾(混血・派生は主の種族の弾)。好きな子の技は、この弾まで使える
//   card を渡すと、そのカードを見る弾: 混血の防御・回避はサブの種族の弾(サブが？？？の子はメインのまま)
const cardAiMonWave = (db, m, card) => {
  if (String(m.wave) !== 'hybrid') return Number(m.wave) || 1;
  const sp = card && cardIsGuardKind(card.kind) && m.sub && m.sub !== 'unknown' ? m.sub : m.main;
  const base = Object.values(db.monsters).find((x) => !x.variant && x.species === sp && String(x.wave) !== 'hybrid');
  return base ? Number(base.wave) || 1 : 4;
};
// そのモンスターが、癖に合う技をどれだけ持っているか(入れたい度の上位10の合計+ライフ)。2体を選ぶときの「型に合う」の目安
const cardAiMonScore = (db, who, m, maxWave, levelId = null) => {
  const habit = cardAiDeckHabit(who, levelId);
  const vals = Object.values(db.cards).filter((c) => c.ready && c.user !== 'any' && c.user !== 'breeder' && c.wave <= Math.max(maxWave, cardAiMonWave(db, m, c)) && cardUsableBy(c, { ...m, ko: false })).map((c) => cardAiCardValue(c, habit));
  return vals.sort((x, y) => y - x).slice(0, 10).reduce((x, v) => x + v, 0) + (m.life || 0) * 0.3 + cardAiMillMonBonus(habit, m);
};
// 山札切れを狙う子(ソラシド)は、山札やガッツを削れる種族(ジョーカー・ゲル・ニャー)を3体に選びやすくする(2026-10-29 社長「ランダム性はあれど、選ばれやすい重み」)
const CARD_AI_MILL_BLOODS = Object.freeze(['joker', 'jell', 'mew']);
const CARD_AI_MILL_MON_BONUS = 6;
const cardAiMillMonBonus = (habit, m) => (habit && habit.mill && m && CARD_AI_MILL_BLOODS.includes(cardAiBloodOf(m)) ? CARD_AI_MILL_MON_BONUS * habit.mill : 0);
// 毎試合の3体: 好きな子1体(候補から少しずつ変える)+ 型に合うバランスで2体。強さごとの決めは CARD_AI_BUILD
//   MASTER は、相手(プレイヤー)のデッキに全体攻撃が多ければライフの多い子、回避が多ければ回避されない技を持つ子を選ぶ
const cardAiPickTrio = (db, who, levelId, rand, playerDeck) => {
  const cfg = CARD_AI_BUILD[levelId] || CARD_AI_BUILD.normal;
  const favs = cardAiFavoriteCandidates(db, who).map((no) => cardMonsterOf(db, no));
  if (!favs.length) return [];
  // 好きな子: 通常を多めに、キラ・別絵キラ・混血もときどき。MASTER はいちばん型に合う子
  // 混血は守りがサブの種族だけなので、いちばん強い子を選ぶとき(MASTER)は少し低く見る(2026-10-27 混血のメイン・サブの直し)
  const favScore = favs.map((m) => cardAiMonScore(db, who, m, cfg.maxWave, levelId) * (cardIsHybridMon(m) ? 0.9 : 1));
  const favW = favs.map((m) => (String(m.wave) === 'hybrid' ? 1.5 : !m.variant ? 3 : /別絵/.test(m.variant) ? 1 : 2));
  const fav = cfg.best ? favs[favScore.indexOf(Math.max(...favScore))] : favs[cardAiPickIndex(favW, rand)];
  // 残り2体の候補: 通常のモンスター(別々の種族・好きな子と違う種族)。弾は技などのカードと同じ決め(全部の弾の強さでは混血・派生も)
  const cands = Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && !m.variant && m.species !== fav.species && m.species !== CARD_AI_FAVORITE[who]
    && (String(m.wave) === 'hybrid' ? cfg.maxWave >= 99 && m.main !== CARD_AI_FAVORITE[who] : Number(m.wave) <= cfg.maxWave));
  let counter = () => 0;
  if (cfg.best && playerDeck && Array.isArray(playerDeck.cards) && playerDeck.cards.length) {
    const pc = playerDeck.cards.map((no) => cardOf(db, no)).filter(Boolean);
    const areaRate = pc.filter((c) => cardHasEff(c, 'area')).length / pc.length;
    const evadeRate = pc.filter((c) => cardHasEff(c, 'evade')).length / pc.length;
    counter = (m) => areaRate * (m.life || 0) * 1.5 + evadeRate * Object.values(db.cards).filter((c) => c.ready && cardHasEff(c, 'noEvade') && cardUsableBy(c, { ...m, ko: false })).length * 1.2;
  }
  // 好きな子の血統の仲間(好きな子とは別の子。キラ・別絵キラは同じ子として1つに数える)
  const family = favs.filter((m) => m.species !== fav.species);
  const familySize = new Set(favs.map((m) => m.species)).size;
  // EASY・NORMAL は割合(くせとしてときどき)。HARD から上は、仲間も候補に入れて、チームとして数え直した点数(cardAiTeamValue)でくらべる
  //   ★数え直すのは仲間だけ(ほかの子の点数は今のまま。強さのそろえを動かさないため)。
  //    数え直さずに仲間をくらべると、あつがドラゴンの仲間ばかりえらび、MASTER の勝率が 44%→19%・EXPERT の同じ血統の組みは 21% に下がった(2026-10-26 測定)
  const byScore = !CARD_AI_SAME_BLOOD[levelId];
  const sameRate = byScore ? 0 : (CARD_AI_SAME_BLOOD[levelId] || 0) * cardAiSameBloodScale(familySize);
  const isFamily = new Set(family.map((m) => m.no));
  const pool = byScore ? [...cands, ...family.filter((m) => !m.variant)] : cands;
  const scored = pool.map((m) => ({ m, v: cardAiMonScore(db, who, m, cfg.maxWave, levelId) + counter(m) }));
  const out = [fav.no];
  const usedSpecies = new Set([fav.species, String(fav.wave) === 'hybrid' ? fav.main : fav.species]);
  const usedNos = new Set([fav.species]);   // 同じ子(キラ・別絵キラ)を2体入れない
  const hiRate = byScore ? (CARD_AI_SAME_BLOOD_HI[levelId] || 0) * cardAiSameBloodScale(familySize) : 0;
  const sameGame = hiRate > 0 && family.length > 0 && rand() < hiRate;
  const sameThree = sameGame && rand() < 0.5;
  for (let k = 0; k < 2; k++) {
    // HARD から上の「同じ血統で組む試合」: 仲間の中でいちばん強い子(数え直した点数)
    if (sameGame && (k === 0 || sameThree)) {
      const team = out.map((no) => cardMonsterOf(db, no));
      const famLeft = family.filter((m) => !m.variant && !usedNos.has(m.species));
      if (famLeft.length) {
        const m = famLeft.map((x) => ({ x, v: cardAiTeamValue(db, who, team, x, cfg.maxWave, levelId) + counter(x) })).reduce((a2, b2) => (b2.v > a2.v ? b2 : a2)).x;
        out.push(m.no);
        usedNos.add(m.species);
        continue;
      }
    }
    // 同じ血統の仲間からえらぶ(割合は sameRate)
    const famLeft = family.filter((m) => !usedNos.has(m.species));
    if (sameRate > 0 && famLeft.length && rand() < sameRate) {
      const w = famLeft.map((m) => (String(m.wave) === 'hybrid' ? 1.5 : !m.variant ? 3 : /別絵/.test(m.variant) ? 1 : 2));
      const m = famLeft[cardAiPickIndex(w, rand)];
      out.push(m.no);
      usedNos.add(m.species);
      continue;
    }
    const team = out.map((no) => cardMonsterOf(db, no));
    const left = scored.filter((x) => !usedNos.has(x.m.species) && (isFamily.has(x.m.no) || (!usedSpecies.has(x.m.species) && !(String(x.m.wave) === 'hybrid' && usedSpecies.has(x.m.main)))))
      .map((x) => (isFamily.has(x.m.no) ? { ...x, v: cardAiTeamValue(db, who, team, x.m, cfg.maxWave, levelId) + counter(x.m) } : x));
    if (!left.length) break;
    let pick;
    if (cfg.stray > 0 && rand() < cfg.stray) pick = left[Math.floor(rand() * left.length) % left.length];   // 気まぐれ
    else if (cfg.best && k === 1 && cfg.lastTop > 1) { const top = left.slice().sort((x, y) => y.v - x.v || (x.m.no < y.m.no ? -1 : 1)).slice(0, cfg.lastTop); pick = top[cardAiPickIndex(top.map((_, i) => (i === 0 ? 2 : 1)), rand)]; }
    else if (cfg.best) pick = left.reduce((x, y) => (y.v > x.v ? y : x));
    else { const top = Math.max(...left.map((x) => x.v)); pick = left[cardAiPickIndex(left.map((x) => Math.exp((x.v - top) / cfg.temp)), rand)]; }
    out.push(pick.m.no);
    usedSpecies.add(pick.m.species);
    usedNos.add(pick.m.species);
  }
  return out;
};
// 助手のデッキを組む。rand … 0〜1 を返す関数(渡さないと、助手と強さで決まった並び)/ opts.playerDeck … MASTER が見る相手のデッキ
//   スターターの id(speed など)を渡したときは、スターターのデッキをそのまま返す
const cardAiBuildDeck = (db, who, levelId = 'normal', rand = null, opts = {}) => {
  if (db.starters[who]) return { monsters: db.starters[who].monsters.slice(), cards: db.starters[who].cards.slice() }; // スターターの id をそのまま渡したとき
  const recipe = CARD_AI_DECKS[who] || CARD_AI_DECKS.mua;
  const cfg = CARD_AI_BUILD[levelId] || CARD_AI_BUILD.normal;
  const rnd = typeof rand === 'function' ? rand : cardAiSeededRand(`${who}:${levelId}`);
  const monsters = cardAiPickTrio(db, who, levelId, rnd, opts && opts.playerDeck);
  const maxWave = cfg.maxWave;
  const habit = cardAiDeckHabit(who, levelId);
  const mons = monsters.map((no) => cardMonsterOf(db, no));
  // 弾の制限は技などのカードにかける。ただし、その子が使う技は、その子の弾まで使える(後の弾の好きな子も EASY から戦えるように)
  const pool = Object.values(db.cards).filter((c) => c.ready && ((c.user === 'any' || c.user === 'breeder') ? c.wave <= maxWave
    : mons.some((m) => cardUsableBy(c, { ...m, ko: false }) && c.wave <= Math.max(maxWave, cardAiMonWave(db, m, c)))));
  // 名前ごとに1つ(同じ名前の別番号は、入れたい度の高いほう)。強さごとの雑さ(noise)で、毎回少しずつ違うカードが入る
  const byName = {};
  const noise = Math.max(0, cfg.noise + (((CARD_AI_DECK_TUNE[who] || {})[levelId]) || 0));
  pool.forEach((c) => { const v = cardAiCardValue(c, habit) + noise * (rnd() * 2 - 1); if (!byName[c.name] || byName[c.name].v < v) byName[c.name] = { c, v }; });
  const ranked = Object.values(byName).sort((a, b) => b.v - a.v || (a.c.no < b.c.no ? -1 : 1));
  const preferOn = levelId === 'hard' || levelId === 'expert' || levelId === 'master';   // 助手らしさの札(あつの全体攻撃など)は、しっかり組む強さ(HARD から)だけ
  // 守りの枚数の目安(くせ「守りを残す」で増える)。3体それぞれの攻撃が入るよう、攻撃は子ごとに順番に足す
  const guardTarget = Math.round(12 + 6 * Math.min(1.5, habit.keepGuard));
  const cards = [];
  // 重い技(ガッツ5以上)は、くせ「大技」に合わせて枚数を絞る(重い技ばかりだと、ガッツが足りず手札が腐る)
  const heavyMax = Math.round(8 * habit.big);
  let heavy = 0;
  // 技に付ける札は、1枚では何もしないので6枚まで(多いと手札が腐る。区切り2で足した)
  let attached = 0;
  const add = (c, n) => {
    for (let i = 0; i < n && cards.length < CARD_BATTLE_DECK_SIZE; i++) {
      const isHeavy = !cardIsGuardKind(c.kind) && c.guts >= 5;
      if (isHeavy && heavy >= heavyMax) return;
      if (cardHasEff(c, 'attach') && attached >= CARD_AI_ATTACH_MAX) return;
      if (cardHasEff(c, 'attach')) attached += 1;
      if (isHeavy) heavy += 1;
      cards.push(c.no);
    }
  };
  const guards = ranked.filter((x) => cardIsGuardKind(x.c.kind));
  // 守りは3体に順番に配る(その子が使える札から入れたい度の高い順)。混血はサブの種族の守りしか使えないので、
  //   点の高い順に選ぶだけだと1体の札に偏り、守れない子が出ていた(2026-10-27 混血のメイン・サブの直し)
  const guardLanes = mons.map((m) => guards.filter((x) => x.c.user === 'any' || cardUsableBy(x.c, { ...m, ko: false })));
  const guardUsed = new Set();
  let g = 0;
  for (let gi = 0, miss = 0; g < guardTarget && miss < guardLanes.length; gi = (gi + 1) % guardLanes.length) {
    const x = guardLanes[gi].find((y) => !guardUsed.has(y.c.name));
    if (!x) { miss += 1; continue; }
    miss = 0;
    guardUsed.add(x.c.name);
    const n = Math.min(CARD_DECK_COPY_MAX, guardTarget - g); add(x.c, n); g += n;
  }
  const attacks = ranked.filter((x) => !cardIsGuardKind(x.c.kind));
  const lanes = mons.map((m) => attacks.filter((x) => x.c.user !== 'any' && x.c.user !== 'breeder' && cardUsableBy(x.c, { ...m, ko: false })));
  const shared = attacks.filter((x) => x.c.user === 'any' || x.c.user === 'breeder');
  const used = new Set();
  // 助手らしさの札(あつの全体攻撃など)を先に入れる
  (preferOn ? recipe.prefer || [] : []).forEach((name) => { const x = byName[name]; if (x && !used.has(name)) { used.add(name); add(x.c, CARD_DECK_COPY_MAX); } });
  (preferOn ? recipe.field || [] : []).forEach((name) => { const x = byName[name]; if (x && !used.has(name)) { used.add(name); add(x.c, CARD_AI_FIELD_COPIES); } });
  let li = 0, guard = 0;
  while (cards.length < CARD_BATTLE_DECK_SIZE && guard++ < 400) {
    const lane = li < lanes.length ? lanes[li] : shared;
    li = (li + 1) % (lanes.length + 1);
    // ★入れたい度が低い札は、順番の枠では入れない(足りないときだけ最後に入れる)。
    //   第3弾のブリーダー「意味不明」(ダメージの無い特殊技)が全モンスター・ブリーダーの枠で3枚入り、
    //   みゅあの EXPERT の勝率を17点下げていた。しきい値は助手ごとに試算で決めた(CARD_AI_LANE_MIN)
    const x = lane.find((y) => !used.has(y.c.name) && y.v >= (CARD_AI_LANE_MIN[who] ?? CARD_AI_LANE_MIN_DEFAULT));
    if (!x) continue;
    used.add(x.c.name);
    add(x.c, CARD_DECK_COPY_MAX);
  }
  // 足りなければ、残りの候補から入れる(どの子も使える札が少ないとき)
  for (const x of ranked) { if (cards.length >= CARD_BATTLE_DECK_SIZE) break; const have = cards.filter((n) => cardOf(db, n).name === x.c.name).length; add(x.c, CARD_DECK_COPY_MAX - have); }
  heavy = -99; // それでも50枚に届かなければ、重い技の上限を外して埋める
  for (const x of ranked) { if (cards.length >= CARD_BATTLE_DECK_SIZE) break; const have = cards.filter((n) => cardOf(db, n).name === x.c.name).length; add(x.c, CARD_DECK_COPY_MAX - have); }
  // sameBlood … 好きな子と同じ血統の子が2体以上(相手の考え方 cardAiPolicy の opts.sameBlood に渡す)
  const sameBlood = mons.filter((m) => cardAiBloodOf(m) === cardAiBloodOf(mons[0])).length >= 2;
  return { monsters: monsters.slice(), cards, sameBlood };
};

// デッキが決まりどおりか(3体・別々のモンスター・50枚・同じ名前は3枚まで・使えないカードが無い)。だめなら理由の文の配列
const cardDeckProblems = (db, deck) => {
  const out = [];
  if (!deck || !Array.isArray(deck.monsters) || !Array.isArray(deck.cards)) return ['デッキがありません'];
  if (deck.monsters.length !== 3) out.push(`モンスターが${deck.monsters.length}体です(3体にしてください)`);
  const ms = deck.monsters.map((no) => cardMonsterOf(db, no));
  if (ms.some((m) => !m)) out.push('知らないモンスターカードが入っています');
  const species = ms.filter(Boolean).map((m) => m.species);
  if (new Set(species).size !== species.length) out.push('同じモンスターが2体入っています');
  if (deck.cards.length !== CARD_BATTLE_DECK_SIZE) out.push(`カードが${deck.cards.length}枚です(あと${CARD_BATTLE_DECK_SIZE - deck.cards.length}枚)`);
  const names = {};
  deck.cards.forEach((no) => { const c = cardOf(db, no); if (!c) { out.push(`知らないカード(${no})が入っています`); return; } names[c.name] = (names[c.name] || 0) + 1; });
  Object.entries(names).forEach(([n, k]) => { if (k > CARD_DECK_COPY_MAX) out.push(`「${n}」が${k}枚です(3枚まで)`); });
  return [...new Set(out)];
};

// ===== デッキ編成(区切り2) =====
// 持っている枚数を超えていないか・準備中のカードが入っていないか(デッキの決まり cardDeckProblems とは別に、編成の画面で出す)
const cardDeckOwnProblems = (db, deck, collection) => {
  const out = [];
  if (!deck) return out;
  const col = collection || {};
  const n = {};
  [...(deck.monsters || []), ...(deck.cards || [])].forEach((no) => { n[no] = (n[no] || 0) + 1; });
  Object.entries(n).forEach(([no, k]) => {
    const c = cardOf(db, no); const m = cardMonsterOf(db, no);
    const name = c ? c.name : m ? m.name : no;
    if ((col[no] || 0) < k) out.push(`「${name}」が足りません(持っているのは${col[no] || 0}枚)`);
    if (c && !c.ready) out.push(`「${name}」は準備中です`);
  });
  return out;
};
// デッキの対戦に使えるか(決まり・持っている枚数・準備中)
const cardDeckReady = (db, deck, collection) => cardDeckProblems(db, deck).length === 0 && cardDeckOwnProblems(db, deck, collection).length === 0;
// そのカードを1枚足せるか。足せないときはその理由(画面に出す)。足せるときは ''
const cardDeckAddReason = (db, deck, no, collection) => {
  const col = collection || {};
  const m = cardMonsterOf(db, no);
  if (m) {
    if (deck.monsters.includes(no)) return 'もう入っています';
    if (deck.monsters.length >= 3) return 'モンスターは3体までです';
    if (deck.monsters.some((x) => (cardMonsterOf(db, x) || {}).species === m.species)) return '同じモンスターは1体までです(キラも同じモンスター)';
    if ((col[no] || 0) < 1) return '持っていません';
    return '';
  }
  const c = cardOf(db, no);
  if (!c) return '知らないカードです';
  if (!c.ready) return '準備中のカードです';
  if (deck.cards.length >= CARD_BATTLE_DECK_SIZE) return `カードは${CARD_BATTLE_DECK_SIZE}枚までです`;
  const same = deck.cards.filter((x) => (cardOf(db, x) || {}).name === c.name).length;
  if (same >= CARD_DECK_COPY_MAX) return `同じ名前のカードは${CARD_DECK_COPY_MAX}枚までです`;
  const mine = deck.cards.filter((x) => x === no).length;
  if (mine >= (col[no] || 0)) return `持っているのは${col[no] || 0}枚です`;
  return '';
};
// 新しいデッキの id(いまのデッキと重ならないもの)
const cardNewDeckId = (decks, now) => {
  let id = `deck_${Math.floor(Number(now) || 0).toString(36)}`;
  let k = 1;
  while (decks.some((d) => d.id === id)) { id = `deck_${Math.floor(Number(now) || 0).toString(36)}_${k}`; k += 1; }
  return id;
};
// デッキを1つ入れかえ(無ければ足す・5つまで)。active はそのまま(無いときは最初のデッキ)
const cardDecksPut = (decks, deck) => {
  const list = decks.decks.some((d) => d.id === deck.id) ? decks.decks.map((d) => (d.id === deck.id ? deck : d)) : [...decks.decks, deck].slice(0, CARD_DECK_MAX);
  return { active: list.some((d) => d.id === decks.active) ? decks.active : (list[0] ? list[0].id : null), decks: list };
};
const cardDecksRemove = (decks, id) => {
  const list = decks.decks.filter((d) => d.id !== id);
  return { active: list.some((d) => d.id === decks.active) ? decks.active : (list[0] ? list[0].id : null), decks: list };
};
// 並べる順(モンスター → 種類 → 番号)
const CARD_KIND_ORDER = Object.freeze({ pow: 0, int: 1, spe: 2, dge: 3, blk: 4, fld: 5 });
const cardSortKey = (db, no) => {
  const c = cardOf(db, no);
  if (!c) return `0-${no}`;
  return `1-${c.user === 'any' ? 'y' : c.user === 'breeder' ? 'z' : 'a'}-${CARD_KIND_ORDER[c.kind] ?? 9}-${no}`;
};

// ===== 保存の形(6-1)。読むときは必ずここを通す(無い・壊れているときは既定値) =====
const CARD_SAVE_KEYS = Object.freeze({
  // point(mh_card_point_v1)は、ビートPをやめてビートPにした(2026-10-26 社長)ので、もう読まない。消さずに残す(⑦)
  collection: 'mh_card_collection_v1', decks: 'mh_card_decks_v1', point: 'mh_card_point_v1', starter: 'mh_card_starter_v1',
  daily: 'mh_card_daily_v1', record: 'mh_card_record_v1', cpuUnlocked: 'mh_card_cpu_unlocked_v1',
  tutorial: 'mh_card_tutorial_v1', // 練習試合(チュートリアル)を終えた・飛ばした・100 を渡した印(86-card-tutorial.jsx)
  pity: 'mh_card_pack_pity_v1', // パックの天井(弾ごとに、キラなしで開けた数。89-card-pack.jsx)
  pitySplit: 'mh_card_pack_pity_split_v1', // 以前の4弾の天井の数を新しい8弾へ写した印(1回だけ。89 の cardSplitPity)
  shop: 'mh_card_shop_v1',       // マーケットで買ったスターターキットの印(89-card-pack.jsx)
  topAssist: 'mh_card_top_assist_v1', // トップの助手の「立ち絵/コメント」の出し入れ(84。無ければ両方ON)
  rankSync: 'mh_card_rank_sync_v1',   // ランキングへ最後に送った行の中身(同じなら送り直さない。90-card-rank.jsx)
  bgm: 'mh_card_bgm_v1',              // 対戦の BGM { cpu: 'auto' か 曲id, pvp: 曲id }(設計書 5-3。いまの mh_bgm_arrangement は触らない)
  cpuPlaylist: 'mh_card_cpu_playlist_v1', // 助手と対戦の曲の並び { v:1, assistants:{ 助手id: [曲id 1〜5] } }(2026-10-26。cardNormalizeCpuPlaylist)
  settings: 'mh_card_settings_v1',    // 演出の速さ・守れないときの自動パス(normalizeCardSettings)
  gacha: 'mh_card_gacha_points_v1',   // ガチャポイント(ブースターパック1つで +10・上限なし。89 の cardNormalizeGacha。2026-10-27 社長)
  catalogs: 'mh_card_catalogs_v1',    // 持っているバトルカードカタログの冊数(ガチャポイント500で1冊。89 の cardExchangeCatalog / cardUseCatalog)
  weeklyReward: 'mh_card_weekly_reward_v1', // 受け取った週間報酬の週の一覧 ['card_weekly_2026-11-02', …](90 の cardWeeksAwaitingReward。壊れているときは何も配らない)
  aiTalk: 'mh_card_ai_talk_v1',       // 助手のおしゃべり(AI)の入/切 { on }(無ければ入。83-card-battle-talk-ai.jsx の cardNormalizeAiTalk)
});
// カードで使う・もらうポイントはビートP(2026-10-26 社長「ビートPを廃止してビートポイントにして」)。
//   保存先はビートPのもの(25-storage.jsx の RHYTHM_EVENT_POINTS_KEY・mh_rhythm_event_points_v1)。数はビートPのときのまま
//   ★CARD_SAVE_KEYS には入れない。デバッグの「カードバトルの記録を消す」が CARD_SAVE_KEYS を全部消すので、入れるとビートPまで消える
//   ★検査(node で 82 だけ読む)では 25-storage が無いので、同じ名前を書いておく
const CARD_POINT_STORE_KEY = typeof RHYTHM_EVENT_POINTS_KEY !== 'undefined' ? RHYTHM_EVENT_POINTS_KEY : 'mh_rhythm_event_points_v1';
// 前のカードポイントの残りを、ビートPへ1回だけ移す(2026-10-26 社長「ビートPに1回だけ移す」。未公開なので社長とデバッグ端末の分だけ)
//   ・前のキー(mh_card_point_v1)は読むだけ。消さない・書き換えない(⑦)
//   ・印(mh_card_points_to_beatp_migrated_v1)とビートPを1つの取引で書く。途中で失敗したら両方戻るので、二重に足されることも、印だけ立つこともない
//   ・壊れた値・0以下は足さない(印は立てる)
const CARD_POINT_MIGRATED_KEY = 'mh_card_points_to_beatp_migrated_v1';
const cardPointMigrationAmount = (legacyRaw, migrated) => {
  if (migrated === true) return 0;
  if (typeof legacyRaw !== 'number' && typeof legacyRaw !== 'string') return 0;
  const n = Number(legacyRaw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
// getValue / setValue / saveAll は storeGet / storeSet / saveStoredValuesOrRollback(検査から差し替えて呼べるように引数で受け取る)
const cardMigratePointsOnce = async (getValue, setValue, saveAll) => {
  const migrated = await getValue(CARD_POINT_MIGRATED_KEY, null, false);
  if (migrated === true) return { added: 0, saved: false };
  const legacy = await getValue(CARD_SAVE_KEYS.point, null, false);
  const add = cardPointMigrationAmount(legacy, migrated);
  const entries = [{ key: CARD_POINT_MIGRATED_KEY, before: migrated, next: true }];
  if (add > 0) {
    const beatBefore = await getValue(CARD_POINT_STORE_KEY, null, false);
    entries.push({ key: CARD_POINT_STORE_KEY, before: beatBefore, next: Math.min(Number.MAX_SAFE_INTEGER, cardNormalizePoint(beatBefore) + add) });
  }
  const saved = await saveAll(entries, getValue, setValue);
  return { added: saved ? add : 0, saved };
};
const cardIsPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cardNormalizeCollection = (v) => {
  const out = {};
  if (!cardIsPlainObject(v)) return out;
  // 知らない番号も残す(あとから届くカード・弾のため。消さない)
  Object.entries(v).forEach(([k, n]) => { const x = Number(n); if (Number.isFinite(x) && x > 0) out[k] = Math.min(99, Math.floor(x)); });
  return out;
};
const cardNormalizePoint = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0; };
const cardNormalizeStarter = (v) => (cardIsPlainObject(v) && typeof v.kit === 'string' && v.kit ? { kit: v.kit, at: Number.isFinite(Number(v.at)) ? Number(v.at) : 0 } : null);
// 組めるデッキの数(2026-10-30 社長「5セットまでしか組めないけど20ぐらいまで増やせない?」→ 20。上げるだけなので今の保存はそのまま読める)
const CARD_DECK_MAX = 20;
const cardNormalizeDecks = (v) => {
  const decks = (cardIsPlainObject(v) && Array.isArray(v.decks) ? v.decks : []).filter(cardIsPlainObject).slice(0, CARD_DECK_MAX).map((d, i) => ({
    id: typeof d.id === 'string' && d.id ? d.id : `deck${i + 1}`,
    name: typeof d.name === 'string' && d.name ? d.name.slice(0, 20) : `デッキ${i + 1}`,
    monsters: Array.isArray(d.monsters) ? d.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [],
    cards: Array.isArray(d.cards) ? d.cards.filter((x) => typeof x === 'string').slice(0, CARD_BATTLE_DECK_SIZE) : [],
  }));
  const active = cardIsPlainObject(v) && decks.some((d) => d.id === v.active) ? v.active : (decks[0] ? decks[0].id : null);
  return { active, decks };
};
// quickLoops … その日にバトルカードの対戦でクイック周回へ足した周の数(2026-10-26 で足した項目。トップの周回の札の詳細に出す。無い人は0)
const cardNormalizeDaily = (v, today) => {
  const base = { day: today, cpuPoint: 0, pvpPoint: 0, firstWin: false, foes: {}, quickLoops: 0 };
  if (!cardIsPlainObject(v) || v.day !== today) return base;
  return { day: today, cpuPoint: cardNormalizePoint(v.cpuPoint), pvpPoint: cardNormalizePoint(v.pvpPoint), firstWin: v.firstWin === true, foes: cardIsPlainObject(v.foes) ? { ...v.foes } : {}, quickLoops: cardNormalizePoint(v.quickLoops) };
};
const CARD_LEVEL_ORDER = Object.freeze(['easy', 'normal', 'hard', 'expert', 'master']);
// MFバトルカードの BGM。top … トップ画面(練習試合の外)/ cpu … 'auto'(相手の助手に合わせる)か曲id / pvp … 曲id。無い・知らない曲idは既定へ戻す(isTrack: 曲idか確かめる関数)
// 既定: トップ画面は「MF × ICHIKA MIX」(atsu_cup_theme。2026-10-26 社長「入ったときのBGMをMFいちかみっくすに」)。対戦は前のとおり
//   助手と対戦は 'auto'(助手ごとの曲)・マルチは ichika_battle(#3634 で一度対戦まで ICHIKA にしたのを戻した)
//   ★mh_card_bgm_v1 は、オプションで曲を選んだときにだけ書く。選んだ人の値はそのまま読む(書き換えない)。top は足した項目なので、前からの人も既定で補う
const CARD_BGM_DEFAULT = Object.freeze({ top: 'atsu_cup_theme', cpu: 'auto', pvp: 'ichika_battle' });
const normalizeCardBgm = (v, isTrack = () => true) => {
  const r = cardIsPlainObject(v) ? v : {};
  return {
    top: typeof r.top === 'string' && isTrack(r.top) ? r.top : CARD_BGM_DEFAULT.top,
    cpu: r.cpu === 'auto' || (typeof r.cpu === 'string' && isTrack(r.cpu)) ? r.cpu : CARD_BGM_DEFAULT.cpu,
    pvp: typeof r.pvp === 'string' && isTrack(r.pvp) ? r.pvp : CARD_BGM_DEFAULT.pvp,
  };
};
// 助手と対戦の曲の並び(2026-10-26 社長の依頼)。助手ごとに1〜5曲を選び、対戦中は全部を1回ずつシャッフルで流す
//   既定は助手ごとの曲1つ(台帳 #3438 の助手の曲。84 の CARD_AI_BGM はここから作る)。この並びがあれば、助手と対戦では
//   mh_card_bgm_v1 の cpu(前の1曲えらび)は使わない。前の値は消さない・書き換えない(⑦)
//   ★知らない助手・知らない曲id・同じ曲の2つ目・6曲目からは落とす。0曲になった助手は既定の1曲に戻す。読むだけでは保存しない
const CARD_PLAYLIST_MAX = 5;
const CARD_CPU_PLAYLIST_DEFAULT = Object.freeze({
  mua: Object.freeze(['melo_toriko']), kiki: Object.freeze(['eiki_boss']), momosuke: Object.freeze(['melo_crossing_field']),
  kyuko: Object.freeze(['melo_toward_the_stars_short']), dra: Object.freeze(['melo_mou_hitotsu_no_sekai_e']), atsu: Object.freeze(['melo_against_my_own_shadow']),
  sorashido: Object.freeze(['monster_hero_theme']),   // Monster Hero(2026-10-27 社長の答え)
});
const cardNormalizePlaylistList = (v, isTrack = () => true) => {
  const out = [];
  for (const id of Array.isArray(v) ? v : []) {
    if (out.length >= CARD_PLAYLIST_MAX) break;
    if (typeof id === 'string' && isTrack(id) && !out.includes(id)) out.push(id);
  }
  return out;
};
const cardNormalizeCpuPlaylist = (v, isTrack = () => true) => {
  const src = cardIsPlainObject(v) && cardIsPlainObject(v.assistants) ? v.assistants : {};
  const assistants = {};
  for (const who of Object.keys(CARD_CPU_PLAYLIST_DEFAULT)) {
    const list = cardNormalizePlaylistList(src[who], isTrack);
    // 公開前の助手は既定を足さない(保存の形を変えない)。前に保存した並びがあれば消さずに残す(⑦)
    if (!cardFoeReleased(who)) { if (list.length) assistants[who] = list; continue; }
    assistants[who] = list.length ? list : [...CARD_CPU_PLAYLIST_DEFAULT[who]];
  }
  return { v: 1, assistants };
};
// 1周ぶんの順を作る(全部を1回ずつ)。avoid … 直前に流れた曲。2曲以上なら、その曲を1曲目にしない(周の境目で同じ曲が続かない)
const cardShufflePlaylist = (list, avoid = null, rnd = Math.random) => {
  const order = [...list];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  if (order.length >= 2 && avoid != null && order[0] === avoid) { const j = 1 + Math.floor(rnd() * (order.length - 1)); [order[0], order[j]] = [order[j], order[0]]; }
  return order;
};
// 並びを流す係(60-app が使う)。音の出し方は io で受け取る(検査が node で動かせるように)
//   io … { setOnce(曲id か null, { onEnd, onFail }) 1回だけ流す曲を決める / play(曲id) 鳴らす / preload(曲id) 先に読む / silence() BGMを止める }
//   start(並び, いま鳴っている曲) … 2曲以上なら、全部を1回ずつシャッフルで流す(対戦を始めるたびに呼ぶ=順を作り直す)。1曲以下はふつうに鳴らす
//   ・流れ終わった(onEnd)ときだけ次へ。1周が終わったら、直前の曲が1曲目にならないよう並べ直す
//   ・読み込めない曲(onFail)は飛ばす。並びの曲が続けて全部だめなら、並びをやめて止める(何度も読み直さない)
//   ・stop() のあと、または新しい start() のあとは、前の並びの onEnd・onFail が遅れて来ても何もしない
const cardPlaylistPlayer = (io, rnd = Math.random) => {
  let run = null;
  const stop = () => { if (run) { run = null; io.setOnce(null); } };
  const start = (list, playing = null) => {
    const ids = (Array.isArray(list) ? list : []).filter((id, i, a) => typeof id === 'string' && id && a.indexOf(id) === i);
    stop();
    if (ids.length < 2) { if (ids[0]) io.play(ids[0]); return; }
    const me = { list: ids, order: cardShufflePlaylist(ids, playing, rnd), at: 0, fails: 0 };
    run = me;
    const next = () => {
      const last = me.order[me.at];
      me.at += 1;
      if (me.at >= me.order.length) { me.order = cardShufflePlaylist(me.list, last, rnd); me.at = 0; }
      playAt();
    };
    const playAt = () => {
      if (run !== me) return;
      const key = me.order[me.at];
      io.setOnce(key, {
        onEnd: () => { if (run !== me) return; me.fails = 0; next(); },
        onFail: () => {
          if (run !== me) return;
          me.fails += 1;
          if (me.fails >= me.list.length) { stop(); io.silence(); return; }
          next();
        },
      });
      io.play(key);
      // 次の1曲だけ先に読んでおく(並びの曲を全部いっぺんには読まない)
      const after = me.order[me.at + 1];
      if (after && io.preload) io.preload(after);
    };
    playAt();
  };
  return { start, stop, active: () => !!run };
};
// 演出の設定。speed … 'normal' / 'fast'(相手の考える間と、決着から結果までを短くする)
//   autoPass … 守れるカードが1枚も無いとき、自動で「守らない」にする(既定は ON。理由の一言は少し見せてから進む)
const CARD_SETTINGS_DEFAULT = Object.freeze({ speed: 'normal', autoPass: true });
const normalizeCardSettings = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const pick = (val, list, def) => (list.includes(val) ? val : def);
  const onOff = (val, def) => (val === 'ON' || val === 'OFF' ? val : def);
  // 前の「対戦の進む速さ」(speed: 'fast')は、相手が考える時間「はやい」と結果までの間「短め」の2つに分けた。前の値はここで引き継ぐ
  const oldFast = r.speed === 'fast';
  const think = pick(r.think, CARD_THINK_IDS, oldFast ? 'FAST' : 'NORMAL');
  return {
    speed: think === 'FAST' || think === 'FAST2' ? 'fast' : 'normal', // 前の作りが読む名前(残しておく)
    autoPass: r.autoPass !== false,
    // quickAutoStart … MFバトルカードを開いたら裏のクイック∞周回を自動で始める・負けたら数秒おいて始め直す(社長 2026-10-25。モンヒロビートの「開いたら自動で始める」と同じ中身。最初は OFF)
    quickAutoStart: r.quickAutoStart === true,
    // ここから下は、対戦中の設定(社長 2026-10-25「オプションでバトル中の設定関係を各種作って」)。既定はどれも、足す前の動きと同じ
    think,
    resultWait: pick(r.resultWait, ['NORMAL', 'SHORT', 'QUICK'], oldFast ? 'SHORT' : 'NORMAL'),
    motion: pick(r.motion, ['FULL', 'SHORT', 'OFF'], 'FULL'),
    shake: onOff(r.shake, 'ON'),
    damageNum: onOff(r.damageNum, 'ON'),
    bubble: pick(r.bubble, ['MANY', 'NORMAL', 'FEW', 'OFF'], 'NORMAL'),
    confirmUse: onOff(r.confirmUse, 'OFF'),
    confirmEnd: onOff(r.confirmEnd, 'OFF'),
    press: pick(r.press, ['SHORT', 'NORMAL', 'LONG'], 'NORMAL'),
    drag: onOff(r.drag, 'ON'),
    gutsPick: onOff(r.gutsPick, 'OFF'),
    handText: pick(r.handText, ['NORMAL', 'LARGE'], 'NORMAL'),
    handSort: pick(r.handSort, ['DRAW', 'KIND'], 'DRAW'),
  };
};
// 相手が考える時間の倍率(1 が足す前の「ふつう」、0.5 が前の「はやい」)
const CARD_THINK_IDS = ['SLOW2', 'SLOW', 'NORMAL', 'FAST', 'FAST2'];
const CARD_THINK_PACE = Object.freeze({ SLOW2: 2, SLOW: 1.5, NORMAL: 1, FAST: 0.5, FAST2: 0.25 });
// 勝ち負けが決まってから結果の画面までの間(ms)。NORMAL・SHORT は足す前の「ふつう」「はやい」と同じ
const CARD_RESULT_WAIT_MS = Object.freeze({ NORMAL: 2200, SHORT: 1200, QUICK: 500 });
// 長押しで詳しい画面が出るまで(ms)。NORMAL は足す前と同じ
const CARD_PRESS_MS = Object.freeze({ SHORT: 300, NORMAL: 450, LONG: 700 });
// 助手のひとこと: 1ターンにしゃべる数(NORMAL は足す前の CARD_LINE_PER_TURN と同じ 2)。OFF は勝ち負けも含めて出さない
const CARD_BUBBLE_PER_TURN = Object.freeze({ MANY: 3, NORMAL: 2, FEW: 1, OFF: 0 });
// オプションに並べる対戦中の設定(モンヒロバトルの BATTLE_FX_SETTING_ITEMS と同じ形: 題・説明・選択肢の名前と一言)。
// bool … 保存は true/false(自動パス)。only … 'cpu' は助手と対戦だけに効く(マルチ対戦では相手が人なので効かない)
const CARD_SETTING_GROUPS = Object.freeze([
  { title: '演出', items: [
    { key: 'motion', title: '技の動き', desc: '技を出したときに、モンスターが相手へ向かって動く演出です。「短め」は攻める側の動きを省き、受けた・よけた・防いだ動きだけ出します。',
      options: [{ id: 'FULL', label: 'ふつう', note: '全部の動き' }, { id: 'SHORT', label: '短め', note: '受ける側だけ' }, { id: 'OFF', label: '出さない', note: 'すぐ次へ' }] },
    { key: 'shake', title: '画面の揺れ', desc: '攻撃を受けたモンスターが揺れる演出です。止めても光や数字は出ます。',
      options: [{ id: 'ON', label: '揺らす', note: 'いつもの見た目' }, { id: 'OFF', label: '揺らさない', note: '酔いやすい人向け' }] },
    { key: 'damageNum', title: 'ダメージの数字', desc: '攻撃を受けたモンスターの上に出る「−3」などの大きな数字です。出さなくても、ライフの数字とバーは減ります。',
      options: [{ id: 'ON', label: '出す', note: '大きな数字' }, { id: 'OFF', label: '出さない', note: 'ライフだけ' }] },
  ] },
  { title: '速さ', items: [
    { key: 'think', title: '相手が考える時間', only: 'cpu', desc: 'フリー対戦で、相手の助手が技や守りを決めるまでの間です。マルチ対戦では相手が人なので変わりません。',
      options: [{ id: 'SLOW2', label: 'とても\nゆっくり', note: '×2' }, { id: 'SLOW', label: 'ゆっくり', note: '×1.5' }, { id: 'NORMAL', label: 'ふつう', note: '×1' }, { id: 'FAST', label: 'はやい', note: '×0.5' }, { id: 'FAST2', label: 'とても\nはやい', note: '×0.25' }] },
    { key: 'resultWait', title: '結果までの間', only: 'cpu', desc: 'フリー対戦で、勝ち負けが決まってから結果の画面に移るまでの間です。',
      options: [{ id: 'NORMAL', label: 'ふつう', note: '約2秒' }, { id: 'SHORT', label: '短め', note: '約1秒' }, { id: 'QUICK', label: 'すぐ', note: '約0.5秒' }] },
  ] },
  { title: '助手', items: [
    { key: 'bubble', title: '対戦中のひとこと', only: 'cpu', desc: 'フリー対戦で、相手の助手がしゃべる吹き出しの多さです。「出さない」は、勝ち負けのときも出しません。',
      options: [{ id: 'MANY', label: '多め', note: '1ターン3回まで' }, { id: 'NORMAL', label: 'ふつう', note: '1ターン2回まで' }, { id: 'FEW', label: '少なめ', note: '1ターン1回まで' }, { id: 'OFF', label: '出さない', note: 'しゃべらない' }] },
  ] },
  { title: '操作', items: [
    { key: 'confirmUse', title: '技を使う前の確認', desc: '技を選んで相手をタップ(か運んで置く)したときに、「使いますか？」と1回確かめます。押しまちがいを防げます。',
      options: [{ id: 'OFF', label: '確かめない', note: 'すぐ使う' }, { id: 'ON', label: '確かめる', note: '「使う」で決める' }] },
    { key: 'confirmEnd', title: 'ターン終了の確認', desc: 'ガッツの番に「ターン終了」を押したときに、1回確かめます。',
      options: [{ id: 'OFF', label: '確かめない', note: 'すぐ終わる' }, { id: 'ON', label: '確かめる', note: '「終わる」で決める' }] },
    { key: 'press', title: '長押しで詳しく出るまで', desc: 'カードを長押ししたときに、大きな絵と文の画面が出るまでの時間です。',
      options: [{ id: 'SHORT', label: '短め', note: '約0.3秒' }, { id: 'NORMAL', label: 'ふつう', note: '約0.45秒' }, { id: 'LONG', label: '長め', note: '約0.7秒' }] },
    { key: 'drag', title: '手札を運ぶ操作', desc: '手札を指で持って、狙うモンスターやガッツの置き場へ運ぶ操作です。使わないときは、タップだけで遊びます。',
      options: [{ id: 'ON', label: '使う', note: '運んでもタップでも' }, { id: 'OFF', label: '使わない', note: 'タップだけ' }] },
  ] },
  { title: '自動', items: [
    { key: 'autoPass', bool: true, title: '守れないときは自動で「守らない」', desc: '攻撃されたときに、使える回避・防御のカードが1枚も無ければ、理由を少し見せてから自動で「守らない」にします。',
      options: [{ id: 'ON', label: 'する', note: '自動で進む' }, { id: 'OFF', label: 'しない', note: '自分で押す' }] },
    { key: 'gutsPick', title: 'ガッツにするカードのおすすめ', desc: 'ガッツの番になったときに、おすすめのカードを先に選んでおきます。選び直してから「ターン終了」を押せます。',
      options: [{ id: 'OFF', label: '選ばない', note: '自分で選ぶ' }, { id: 'ON', label: '選んでおく', note: '直してもOK' }] },
  ] },
  { title: '表示', items: [
    { key: 'handText', title: '手札の下の字', desc: '手札の下に出す名前・ガッツ・ダメージの字の大きさです。狭い画面では、ふつうのままになります。',
      options: [{ id: 'NORMAL', label: 'ふつう', note: 'いつもの大きさ' }, { id: 'LARGE', label: '大きめ', note: '読みやすく' }] },
    { key: 'handSort', title: '手札の並べ方', desc: '手札を並べる順番です。並べ方を変えても、出すカードは変わりません。',
      options: [{ id: 'DRAW', label: '引いた順', note: 'いつもの並び' }, { id: 'KIND', label: '種類順', note: 'ちから→かしこさ→特殊→回避→防御' }] },
  ] },
]);
// 難易度ごとの数 { easy: n, … }。知らない難易度は捨てる
const cardNormalizeLevelCounts = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return Object.fromEntries(CARD_LEVEL_ORDER.map((lv) => [lv, cardNormalizePoint(r[lv])]));
};
// 週の区切り: モンヒロビートの週間ランキングと同じ、日本時間の月曜 5:00 から(カゲあつくん)。週の鍵はその月曜の日付(YYYY-MM-DD)
//   日本時間から5時間戻した日付で数える(月曜 4:59 は前の週・5:00 から新しい週)
const CARD_WEEK_START_HOUR_JST = 5;
const cardWeekKeyJst = (now) => {
  const d = new Date(Number(now) + (9 - CARD_WEEK_START_HOUR_JST) * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
// ランキングの元にする数(台帳 #3513)。本当に対戦した勝ちだけを数える(デバッグから・公開前は数えない)。
//   total … 難易度ごとの勝ち数(通算) / week … その週の難易度ごとの勝ち数 / streak … いまの連勝と、いちばん長い連勝
const cardNormalizeRank = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const week = cardIsPlainObject(r.week) ? r.week : {};
  const streak = cardIsPlainObject(r.streak) ? r.streak : {};
  const now = cardNormalizePoint(streak.now);
  return {
    total: cardNormalizeLevelCounts(r.total),
    week: { key: typeof week.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.key) ? week.key : '', wins: cardNormalizeLevelCounts(week.wins) },
    streak: { now, best: Math.max(now, cardNormalizePoint(streak.best)) },
  };
};
const cardNormalizeRecord = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const cpu = cardIsPlainObject(r.cpu) ? r.cpu : {};
  const pvp = cardIsPlainObject(r.pvp) ? r.pvp : {};
  const beaten = cardIsPlainObject(r.beaten) ? r.beaten : {};
  const byLevel = cardIsPlainObject(r.byLevel) ? r.byLevel : {};
  return {
    cpu: { win: cardNormalizePoint(cpu.win), lose: cardNormalizePoint(cpu.lose), surrender: cardNormalizePoint(cpu.surrender) },
    pvp: { win: cardNormalizePoint(pvp.win), lose: cardNormalizePoint(pvp.lose) },
    beaten: Object.fromEntries(Object.entries(beaten).filter(([, x]) => x === true)), // 1回でも勝った助手(印だけ)
    recent: Array.isArray(r.recent) ? r.recent.filter(cardIsPlainObject).slice(0, 30) : [],
    // 2026-10-24 足した項目(前からの人は 0 で補う)。難易度ごとの勝ち・負け(投了も負け)。記録の画面に出す
    byLevel: { win: cardNormalizeLevelCounts(byLevel.win), lose: cardNormalizeLevelCounts(byLevel.lose) },
    rank: cardNormalizeRank(r.rank),
  };
};
// 1戦の結果を記録へ足す。rankable … ランキングに数えてよい対戦か(公開後・デバッグでない人・デバッグの入口でない)
const cardRecordAfter = (record, { who, level, outcome, at, rankable }) => {
  const rec = cardNormalizeRecord(record);
  const win = outcome === 'win';
  const lv = CARD_LEVEL_ORDER.includes(level) ? level : null;
  const side = win ? 'win' : 'lose';
  const next = {
    ...rec,
    cpu: { ...rec.cpu, [outcome]: (rec.cpu[outcome] || 0) + 1 },
    beaten: win ? { ...rec.beaten, [who]: true } : rec.beaten,
    recent: [{ at, who, level, outcome }, ...rec.recent].slice(0, 30),
    byLevel: lv ? { ...rec.byLevel, [side]: { ...rec.byLevel[side], [lv]: rec.byLevel[side][lv] + 1 } } : rec.byLevel,
  };
  if (!rankable || !lv) return next;
  const key = cardWeekKeyJst(at);
  const weekWins = rec.rank.week.key === key ? rec.rank.week.wins : cardNormalizeLevelCounts(null);
  const streakNow = win ? rec.rank.streak.now + 1 : 0;
  next.rank = {
    total: win ? { ...rec.rank.total, [lv]: rec.rank.total[lv] + 1 } : rec.rank.total,
    week: { key, wins: win ? { ...weekWins, [lv]: weekWins[lv] + 1 } : weekWins },
    streak: { now: streakNow, best: Math.max(rec.rank.streak.best, streakNow) },
  };
  return next;
};
// ランキングの表 card_battle_ranks へ送る1行(1人1行・上書き)。週が変わっていたら、その週の数は 0 にして送る
const cardRankRow = (record, { dexCount, dexTotal, userName, icon, profileFrame, breederId, now }) => {
  const rank = cardNormalizeRecord(record).rank;
  const key = cardWeekKeyJst(now);
  const weekWins = rank.week.key === key ? rank.week.wins : cardNormalizeLevelCounts(null);
  const row = {
    user_name: String(userName || '名無しのブリーダー').slice(0, 40),
    ...(typeof breederId === 'string' && breederId ? { breeder_id: breederId } : {}),
    icon: icon ?? null,
    ...(profileFrame ? { profile_frame: profileFrame } : {}),
    week_key: key,
    best_streak: rank.streak.best,
    current_streak: rank.streak.now,
    dex_count: cardNormalizePoint(dexCount),
    dex_total: cardNormalizePoint(dexTotal),
  };
  CARD_LEVEL_ORDER.forEach((lv) => { row[`wins_${lv}`] = rank.total[lv]; row[`week_wins_${lv}`] = weekWins[lv]; });
  return row;
};
const cardNormalizeCpuUnlocked = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return { hard: r.hard === true, expert: r.expert === true, master: r.master === true };
};
// 記録から、開いているはずの強さを足す(2026-10-26 社長「ハード解放したのにできてない」)。
//   1つ下の強さで勝ったことがあれば開いている扱い(NORMAL→HARD・HARD→EXPERT・EXPERT→MASTER)。勝ち数(byLevel)と最近の対戦(recent)の両方を見る。
//   読み込みのときに足すだけで、保存へは書き戻さない(次に勝ったとき、ふだんどおり一緒に保存される)。数を配る処理ではないので、何度通っても増えない
const cardUnlockedWithRecord = (unlocked, record) => {
  const u = cardNormalizeCpuUnlocked(unlocked);
  const rec = cardNormalizeRecord(record);
  const wonAt = (lv) => rec.byLevel.win[lv] > 0 || rec.recent.some((x) => x.level === lv && x.outcome === 'win');
  const out = { ...u };
  for (let i = 1; i < CARD_LEVEL_ORDER.length - 1; i++) {
    const next = CARD_LEVEL_ORDER[i + 1];
    if (!out[next] && wonAt(CARD_LEVEL_ORDER[i])) out[next] = true;
  }
  return out;
};
const cardLevelOpen = (unlocked, levelId) => levelId === 'easy' || levelId === 'normal' || (unlocked && unlocked[levelId] === true);

// スターターを配る(一度きり。印がある人には二度と配らない)。300 ビートPもいっしょに
const CARD_STARTER_POINT = 300;
const cardGrantStarter = (db, { collection, decks, point, starter }, kitId, now) => {
  if (starter) return null;
  const kit = db.starters[kitId];
  if (!kit) return null;
  const nextCol = { ...collection };
  [...kit.monsters, ...kit.cards].forEach((no) => { nextCol[no] = Math.min(99, (nextCol[no] || 0) + 1); });
  const deck = { id: `starter_${kitId}`, name: kit.name, monsters: kit.monsters.slice(), cards: kit.cards.slice() };
  const nextDecks = { active: deck.id, decks: [deck, ...decks.decks.filter((d) => d.id !== deck.id)].slice(0, CARD_DECK_MAX) };
  return { collection: nextCol, decks: nextDecks, point: point + CARD_STARTER_POINT, starter: { kit: kitId, at: now } };
};

// コンピューター戦の結果(4-1・社長が案Aに決めた 台帳 #3484)
//   ビートP: 勝ち … 難易度の点 / 負け(最後まで)… 勝ちの 3/4(切り捨て)× (自分の番の数 ÷ 10。10回で満額)/ 降参 … 倒した相手のモンスター × 10(減ったあとの負けの数まで。0体なら0)
//   ★負けのビートPも自分の番の数で減らす(2026-10-26 社長。すぐ負けて回しても得にならないように)
//   クイック周回: 勝ち … 難易度の周 / 負け … 勝ちの 3/4 × (自分の番の数 ÷ 10。10回で満額)/ 降参 … 倒した数 × 負けの3分の1(0体なら0)
//   ★負けを勝ちの 3/4 にしたのは 2026-10-26 社長「助手とのバトルも負けても報酬もっとあげよう」(前はビートP 25・周回は勝ちの半分)
//   ★かかった時間は見ない(止めて放っておいても増えない)。自分の番を3回やる前に終わった試合は、どちらも0(すぐ降参・すぐ負けで回せないように)
//   1日の上限は設けない(社長 2026-10-24。#3531 で取り消し)。その日はじめての勝ちの +50 だけは1日1回
// 負けでもらえる割合(勝ちの 3/4)。ビートPもクイック周回も、勝ちの数にこれを掛けて切り捨てる
const CARD_LOSE_SHARE = 3 / 4;
const cardLosePoint = (level) => Math.floor(level.point * CARD_LOSE_SHARE);
const cardLoseLoops = (level) => Math.floor(level.loops * CARD_LOSE_SHARE);
// 負けの数を、自分の番の数で減らす(10回で満額。切り捨て)。助手と対戦・マルチ対戦の負けと投了で使う
const cardLoseScaled = (n, ownTurns) => Math.floor(n * Math.min(1, Math.max(0, Number(ownTurns) || 0) / CARD_LOSE_FULL_TURNS));
const CARD_SURRENDER_POINT_PER_KO = 10;
const CARD_FIRST_WIN_BONUS = 50;
const CARD_MIN_OWN_TURNS = 3;
const CARD_LOSE_FULL_TURNS = 10;
// マルチ対戦: 勝ち・負け(最後まで)・途中で抜けた で分かれる。
//   2026-10-26 社長: 勝ちは MASTER の2倍(ビートP 400・44周)、負けは MASTER と同じ(150・自分の番10回で16周。投了も MASTER と同じ)、抜けたら0。
//   1日の上限(dailyMax)も、同じ相手と1日3戦まで(sameFoePerDay)もなくした(社長「同じ相手の縛りもいらないよ」)
//   2026-10-27 社長「バトルカードのマルチの報酬はさらに2倍していい」: x … 勝ち・負け・投了の数を、下の数で出したあと x 倍する(端数の出方も今の比率のまま)
const CARD_PVP_REWARD = Object.freeze({ x: 2, win: { point: CARD_AI_LEVELS.master.point * 2, loops: CARD_AI_LEVELS.master.loops * 2 }, lose: { point: cardLosePoint(CARD_AI_LEVELS.master), loops: cardLoseLoops(CARD_AI_LEVELS.master) }, left: { point: 0, loops: 0 } });
// その人が自分の番を何回やったか(1ターン目は先攻の番)
const cardOwnTurns = (st, p) => {
  const t = Math.max(0, Number(st && st.turn) || 0);
  return st && st.first === p ? Math.ceil(t / 2) : Math.floor(t / 2);
};
// 倒した相手のモンスターの数
const cardKoCount = (st, p) => ((st && st.players && st.players[cardOther(p)]) ? st.players[cardOther(p)].mons.filter((m) => m.ko).length : 0);
// 1戦の結果のもと(自分の番の数・倒した数)。st が無いとき(古い呼び方)は満額あつかい
const cardResultFacts = (st, p = CARD_ME) => (st ? { ownTurns: cardOwnTurns(st, p), kos: cardKoCount(st, p) } : { ownTurns: CARD_LOSE_FULL_TURNS, kos: 0 });
const cardCpuBasePoint = (levelId, outcome, facts) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  if (facts.ownTurns < CARD_MIN_OWN_TURNS) return 0;
  if (outcome === 'win') return level.point;
  if (outcome === 'lose') return cardLoseScaled(cardLosePoint(level), facts.ownTurns);
  if (outcome === 'surrender') return Math.min(cardLoseScaled(cardLosePoint(level), facts.ownTurns), facts.kos * CARD_SURRENDER_POINT_PER_KO);
  return 0;
};
// コンピューター戦のクイック周回(◯周ぶん)。周回クリア扱いにするかどうか(クイックで通したことがあるか)は、配る側(60-app)が決める
const cardCpuLoops = (levelId, outcome, facts = cardResultFacts(null)) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  if (facts.ownTurns < CARD_MIN_OWN_TURNS) return 0;
  const loseFull = cardLoseLoops(level);
  if (outcome === 'win') return level.loops;
  if (outcome === 'lose') return Math.floor(loseFull * Math.min(1, facts.ownTurns / CARD_LOSE_FULL_TURNS));
  if (outcome === 'surrender') return Math.min(loseFull, Math.round((facts.kos * loseFull) / 3));
  return 0;
};
const cardCpuReward = (daily, levelId, outcome, facts = cardResultFacts(null)) => {
  const base = cardCpuBasePoint(levelId, outcome, facts);
  // 上限なし(何戦してももらえる)。daily.cpuPoint は前のまま数えるだけで、もらえる数には使わない(保存の形は変えない・決まり⑦)
  const got = base;
  const bonus = outcome === 'win' && base > 0 && !daily.firstWin ? CARD_FIRST_WIN_BONUS : 0;
  // full・ownTurns・kos は結果の画面で「減った理由」を出すためだけ(2026-10-26 カゲあつくんの通しの点検「負けの 42 に理由が無い」)
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  const full = outcome === 'win' ? level.point : cardLosePoint(level);
  return { base, got, capped: false, bonus, total: got + bonus, short: facts.ownTurns < CARD_MIN_OWN_TURNS, full, ownTurns: facts.ownTurns, kos: facts.kos, daily: { ...daily, cpuPoint: daily.cpuPoint + got, firstWin: daily.firstWin || bonus > 0 } };
};
// 勝ったら次の難易度を開く(NORMAL→HARD→EXPERT→MASTER)
const cardUnlockAfterWin = (unlocked, levelId) => {
  const i = CARD_LEVEL_ORDER.indexOf(levelId);
  const next = CARD_LEVEL_ORDER[i + 1];
  if (i < 1 || !next || unlocked[next]) return unlocked;
  return { ...unlocked, [next]: true };
};

// コンピューターどうしを最後まで戦わせる(検査と勝率の試算用)
const cardSimulate = (db, { decks, policies, seed = 1, first = 0, maxSteps = 4000 }) => {
  let st = cardCreateGame(db, { decks, seed, first });
  let s = (seed * 7919) >>> 0;
  const rand = () => { const n = cardRngNext(s); s = n.s; return n.v; };
  for (let i = 0; i < maxSteps && st.winner === null; i++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
    const act = cardAiChooseAction(db, st, policies[who], rand);
    const next = cardApplyAction(db, st, act);
    if (!next) { const fb = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; st = cardApplyAction(db, st, fb) || st; if (!fb) break; }
    else st = next;
  }
  return st;
};

;
// ---- 82-card-tactics-core.jsx ----
// ===== MFバトルカード: 戦術カード(ガンビット型)の中身(純粋な計算) =====
// 2026-10-29 社長: 戦術カードは FF12 のガンビットの形。1行 = 「条件カード ▶ 行動カード」。上の行から順に見て、
//   条件に当たった行の行動をする(当たらなければ次の行)。どれにも当たらなければ基本カードの型で打つ。
//   カードは4つの山(246枚): 条件132(どの枠でも使う)・基本20(大まかな型。中身は docs/progress/card-deck-share/base-cards-20.md)・ブリーダー38・モンスター56。
//   N146・R86・SR14・はじめに配る10枚。段ごとに1枚(ライフ90%〜10%・ガッツ1〜7 など)
//   枠: 基本(メイン1+サブ2)・ブリーダーの枠・モンスター1体ごとの枠(同じカードをどの子の枠にも入れられる)
//   案と表: docs/progress/card-deck-share/(ブランチ card-tactics-mock)
// ★この部品は pure(画面・保存を触らない)。82 の cardAiChooseAction が policy.gambit(枠)を持つときだけ cardTacticDecide を呼ぶ。
//   policy.gambit が無ければ何もしない(助手と対戦・マルチの助手の強さは変わらない)。
//   何も入れていないとき(0行・基本カードなし)の強さは社長の別案待ち(2026-10-29)。いまは今の打ち方のまま
//
// 行動の「いつ見るか」: attack(自分の攻撃を選ぶとき)/ guard(攻撃を受けたとき)/ guts(ガッツの番)
//   いまの場面に合わない行と、行動で出せる手が無い行は飛ばす。損しかない攻撃(点数0以下)も「出せる手が無い」として飛ばす
// 条件の「標的」: 当たった子を、そのまま行動の相手にする。foes … 相手の子の番号の組 / mine … 自分の子の番号の組(守るとき、狙われた子がこの中にいるか)

// ---- カードの表 ----
// sec … 表の区分 / g … 種類(段をまとめた物。画面の表の1行) / v … 段 / r … レア / start … はじめに配る
const CARD_TACTIC_LIFE = [90, 80, 70, 60, 50, 40, 30, 20, 10];
const cardTacticFine = (fine) => (v) => (fine.includes(v) ? 'R' : 'N'); // 粗い段はN・間の細かい段はR
const CARD_TACTIC_GROUPS = Object.freeze([
  // ---------- 条件 ----------
  { id: 'any', cat: 'cond', sec: '標的', name: 'いつでも', tiers: [['', 'N']], start: [''], desc: 'いつも当たる' },
  { id: 'ko', cat: 'cond', sec: '標的', name: '倒せる相手', tiers: [['', 'N']], start: [''], desc: '出せる技で倒せる相手を標的にする' },
  { id: 'lowest', cat: 'cond', sec: '標的', name: 'いちばんライフの低い相手', tiers: [['', 'N']], desc: '残りライフがいちばん少ない子' },
  { id: 'highest', cat: 'cond', sec: '標的', name: 'いちばんライフの高い相手', tiers: [['', 'N']], desc: '残りライフがいちばん多い子' },
  { id: 'strongest', cat: 'cond', sec: '標的', name: 'いちばん攻撃の強い相手', tiers: [['', 'R']], desc: 'その子が使える技の最大ダメージで見積もる(手札は見ない)' },
  { id: 'attacker', cat: 'cond', sec: '標的', name: '前の番に攻撃してきた相手', tiers: [['', 'R']], desc: '直前の相手の番に攻撃してきた子' },
  { id: 'leader', cat: 'cond', sec: '標的', name: '相手のリーダー', tiers: [['', 'R']], desc: '相手が1体目に置いた子' },
  { id: 'type', cat: 'cond', sec: '標的', name: '◯の相手', tiers: [['地上', 'N'], ['空中', 'N'], ['水中', 'N']], desc: 'その特徴の子' },
  { id: 'blood', cat: 'cond', sec: '標的', name: '◯の相手', tiers: [['純血', 'N'], ['混血', 'N']], desc: 'その血の子' },
  { id: 'species', cat: 'cond', sec: '標的', name: '種族を決めた相手', tiers: [['', 'R']], desc: '組むときに種族を1つ選ぶ(1枚で全種族)' },
  { id: 'foeLife', cat: 'cond', sec: 'ライフ', name: '相手のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), start: [50], desc: 'その割合以下の相手の子を標的にする' },
  { id: 'myLife', cat: 'cond', sec: 'ライフ', name: '自分のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), desc: 'その割合以下の自分の子がいる(守る相手にする)' },
  { id: 'myGuts', cat: 'cond', sec: 'ガッツ', name: '自分のガッツ◯以上', tiers: [1, 2, 3, 4, 5, 6, 7].map((v) => [v, cardTacticFine([2, 4, 6])(v)]), start: [3], desc: '自分のガッツがその数以上' },
  { id: 'foeGutsLe', cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以下', tiers: [0, 1, 2, 3, 4].map((v) => [v, cardTacticFine([1, 3])(v)]), desc: '相手のガッツがその数以下' },
  { id: 'foeGutsGe', cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以上', tiers: [3, 4, 5, 6, 7].map((v) => [v, cardTacticFine([4, 6])(v)]), desc: '相手のガッツがその数以上(大技に備える)' },
  { id: 'myHand', cat: 'cond', sec: '手札・山札', name: '自分の手札◯枚以上', tiers: [2, 3, 4, 5].map((v) => [v, cardTacticFine([2, 4])(v)]), desc: '自分の手札がその数以上' },
  { id: 'foeHandGe', cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以上', tiers: [2, 3, 4, 5].map((v) => [v, cardTacticFine([2, 4])(v)]), desc: '相手の手札がその数以上' },
  { id: 'foeHandLe', cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以下', tiers: [0, 1, 2].map((v) => [v, cardTacticFine([1])(v)]), desc: '相手の手札がその数以下' },
  { id: 'myDeck', cat: 'cond', sec: '手札・山札', name: '自分の山札◯枚以下', tiers: [30, 20, 10, 5].map((v) => [v, cardTacticFine([20, 5])(v)]), desc: '自分の山札がその数以下' },
  { id: 'foeDeck', cat: 'cond', sec: '手札・山札', name: '相手の山札◯枚以下', tiers: [30, 20, 10, 5].map((v) => [v, cardTacticFine([20, 5])(v)]), desc: '相手の山札がその数以下' },
  { id: 'guardN', cat: 'cond', sec: '手札の中身', name: '手札に守り札◯枚以上', tiers: [1, 2, 3].map((v) => [v, cardTacticFine([3])(v)]), desc: '回避・防御の札がその数以上' },
  { id: 'guardKind', cat: 'cond', sec: '手札の中身', name: '手札に◯がある', tiers: [['回避', 'N'], ['防御', 'N']], desc: 'その種類の守り札がある' },
  { id: 'bigInHand', cat: 'cond', sec: '手札の中身', name: '手札に大技がある', tiers: [['', 'N']], desc: 'ガッツ4以上の攻撃の札がある' },
  { id: 'areaInHand', cat: 'cond', sec: '手札の中身', name: '手札に全体攻撃がある', tiers: [['', 'R']], desc: '全員に当たる技がある' },
  { id: 'breederInHand', cat: 'cond', sec: '手札の中身', name: '手札にブリーダーのカードがある', tiers: [['', 'N']], desc: 'ブリーダーのカードがある' },
  { id: 'turnLe', cat: 'cond', sec: '番', name: '◯番目まで', tiers: [1, 2, 3, 5].map((v) => [v, cardTacticFine([2])(v)]), desc: '自分の番がその回数まで' },
  { id: 'turnGe', cat: 'cond', sec: '番', name: '◯番目から', tiers: [5, 8, 10, 15].map((v) => [v, cardTacticFine([10])(v)]), desc: '自分の番がその回数から' },
  { id: 'myAlive', cat: 'cond', sec: '場', name: '自分の場が◯体', tiers: [[1, 'R'], [2, 'N'], [3, 'N']], desc: '自分の場に残っている数' },
  { id: 'foeAlive', cat: 'cond', sec: '場', name: '相手の場が◯体', tiers: [[1, 'R'], [2, 'N'], [3, 'N']], desc: '相手の場に残っている数' },
  { id: 'koDiff', cat: 'cond', sec: '場', name: '倒した数で◯ている', tiers: [['勝っ', 'N'], ['負け', 'N']], desc: '倒した数と倒された数をくらべる' },
  { id: 'foeStun', cat: 'cond', sec: '状態', name: '攻撃できない相手', tiers: [['', 'R']], desc: '封じられて次の番に攻撃できない相手の子' },
  { id: 'myStun', cat: 'cond', sec: '状態', name: '攻撃できない味方', tiers: [['', 'N']], desc: '封じられている自分の子がいる' },
  { id: 'foeCharge', cat: 'cond', sec: '状態', name: '溜めている相手', tiers: [['', 'R']], desc: '次の技が何倍にもなる相手の子' },
  { id: 'foeAir', cat: 'cond', sec: '状態', name: '空中に上がった相手', tiers: [['', 'N']], desc: 'いま空中になっている子(もとは地上・水中)' },
  { id: 'field', cat: 'cond', sec: '状態', name: '場に◯全体カードがある', tiers: [['自分の', 'N'], ['相手の', 'N']], desc: 'だれが出した全体カードが場にあるか' },
  { id: 'foeBig', cat: 'cond', sec: '状態', name: '相手が大技を構えている', tiers: [['', 'SR']], desc: '相手のガッツと使える技から、大技を撃てそうと見積もる' },
  { id: 'myHandLe', cat: 'cond', sec: 'ブリーダー向き', name: '自分の手札◯枚以下', tiers: [0, 1, 2].map((v) => [v, 'N']), desc: '自分の手札がその数以下' },
  { id: 'breederN', cat: 'cond', sec: 'ブリーダー向き', name: '手札にブリーダーのカード2枚以上', tiers: [['', 'R']], desc: 'ブリーダーのカードが2枚以上ある' },
  { id: 'breederUnused', cat: 'cond', sec: 'ブリーダー向き', name: 'この番まだブリーダーのカードを使っていない', tiers: [['', 'N']], desc: 'この番に、まだブリーダーのカードを出していない' },
  { id: 'myGutsLe', cat: 'cond', sec: 'ブリーダー向き', name: '自分のガッツ◯以下', tiers: [0, 1, 2, 3].map((v) => [v, 'N']), desc: '自分のガッツがその数以下' },
  { id: 'myDiscard', cat: 'cond', sec: 'ブリーダー向き', name: '捨て札◯枚以上', tiers: [[10, 'N'], [20, 'R']], desc: '自分の捨て札がその数以上' },
  { id: 'myKo', cat: 'cond', sec: 'ブリーダー向き', name: '倒れた味方がいる', tiers: [['', 'N']], desc: '自分の子が1体でも倒れている' },
  { id: 'noField', cat: 'cond', sec: 'ブリーダー向き', name: '場に全体カードが無い', tiers: [['', 'N']], desc: 'どちらの全体カードも場に無い' },
  { id: 'selfLife', cat: 'cond', sec: 'このモンスター', name: 'この子のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), desc: 'その枠の子のライフがその割合以下(モンスターの枠だけ)' },
  { id: 'selfFresh', cat: 'cond', sec: 'このモンスター', name: 'この子がまだ攻撃していない', tiers: [['', 'N']], desc: 'この番に、その枠の子がまだ攻撃していない' },
  { id: 'selfType', cat: 'cond', sec: 'このモンスター', name: 'この子が◯', tiers: [['地上', 'N'], ['空中', 'N'], ['水中', 'N']], desc: 'その枠の子のいまの特徴' },
  { id: 'selfStun', cat: 'cond', sec: 'このモンスター', name: 'この子が攻撃できない', tiers: [['', 'N']], desc: 'その枠の子が封じられている' },
  { id: 'selfAdv', cat: 'cond', sec: 'このモンスター', name: 'この子が有利な相手がいる', tiers: [['', 'R']], desc: 'その枠の子の手札の技が倍になる相手がいる(その相手を標的にする)' },
  { id: 'incoming', cat: 'cond', sec: '守るとき', name: '受けるダメージ◯以上', tiers: [[3, 'N'], [5, 'N'], [7, 'N'], [10, 'R']], desc: '受ける攻撃の見込みがその数以上(守るときだけ)' },
  { id: 'incomingKo', cat: 'cond', sec: '守るとき', name: '受けると倒れる', tiers: [['', 'N']], desc: '守らないと倒れる攻撃(守るときだけ)' },
  { id: 'incomingArea', cat: 'cond', sec: '守るとき', name: '全体攻撃を受けた', tiers: [['', 'R']], desc: '全員に当たる攻撃を受けている(守るときだけ)' },
  // ---------- 基本カード(大まかな型。基本の枠: メイン1・サブ2) ----------
  { id: 'tBalance', cat: 'base', sec: '基本', name: 'バランス型', tiers: [['', 'N']], start: [''], habit: 'kyuko', desc: 'くせの少ない打ち方(きゅこの型)' },
  { id: 'tAttack', cat: 'base', sec: '基本', name: '攻め型', tiers: [['', 'N']], habit: 'mua', knob: { guardDieOnly: true }, desc: 'ためずに攻める(みゅあの型)' },
  { id: 'tGuard', cat: 'base', sec: '基本', name: '守り型', tiers: [['', 'N']], habit: 'dra', knob: { guardAll: true }, desc: '守り札を残して堅く守る(ドラの型)' },
  { id: 'tSave', cat: 'base', sec: '基本', name: '溜め型', tiers: [['', 'N']], habit: 'kiki', desc: 'ガッツをためて大技(ききの型)' },
  { id: 'tDisrupt', cat: 'base', sec: '基本', name: '崩し型', tiers: [['', 'N']], habit: 'momosuke', desc: '相手の手を崩す(ももすけの型)' },
  { id: 'tBig', cat: 'base', sec: '基本', name: '大技型', tiers: [['', 'R']], mul: { big: 1.6 }, desc: 'ダメージの大きい技を選ぶ' },
  { id: 'tArea', cat: 'base', sec: '基本', name: '全体型', tiers: [['', 'R']], mul: { area: 1.6 }, knob: { areaMin2: true }, desc: '全体攻撃・全体カードを選ぶ' },
  { id: 'tFinish', cat: 'base', sec: '基本', name: '仕留め型', tiers: [['', 'R']], mul: { finish: 1.6 }, desc: 'あと少しで倒せる子を先に狙う' },
  { id: 'tRush', cat: 'base', sec: '基本', name: '速攻型', tiers: [['', 'R']], mul: { attack: 1.6, big: 0.7 }, knob: { light: true }, desc: '軽い技で手数を出す' },
  { id: 'tSteady', cat: 'base', sec: '基本', name: '堅実型', tiers: [['', 'R']], mul: { keepGuard: 1.3, saveGuts: 1.3, attack: 0.8 }, knob: { safe: true }, desc: '守りとガッツを残して、無理をしない' },
  { id: 'tJam', cat: 'base', sec: '基本', name: 'かく乱守り型', tiers: [['', 'R']], mul: { disrupt: 1.3, keepGuard: 1.3 }, desc: '崩しながら守る' },
  { id: 'tCalm', cat: 'base', sec: '基本', name: '慎重型', tiers: [['', 'R']], calm: true, desc: '極端な打ち方をせず、損得で冷静に打つ(ほかの型の効きを半分に)' },
  { id: 'tFlex', cat: 'base', sec: '基本', name: '臨機応変型', tiers: [['', 'SR']], habit: 'atsu', desc: '場を見て、とどめ・全体・守り・攻めを切り替える(あつの型)' },
  { id: 'tMill', cat: 'base', sec: '基本', name: '持久型', tiers: [['', 'SR']], habit: 'sorashido', desc: '長引かせて、相手の山札切れで勝つ(ソラシドの型)' },
  { id: 'tReckless', cat: 'base', sec: '基本', name: '捨て身型', tiers: [['', 'SR']], mul: { keepGuard: 0.5, finish: 1.3 }, knob: { noGuardUnlessFinish: true }, desc: '守らずに受けて、そのぶん倒しに行く' },
  { id: 'tHand', cat: 'base', sec: '基本', name: '手札温存型', tiers: [['', 'R']], knob: { keepHand: 2 }, desc: '手札を2枚以上残して、次の番に備える' },
  { id: 'tDeck', cat: 'base', sec: '基本', name: '山札節約型', tiers: [['', 'R']], knob: { noDraw: true }, desc: '引く札・山札を減らす札を控え、山札を切らさない' },
  { id: 'tFocus', cat: 'base', sec: '基本', name: '一点集中型', tiers: [['', 'R']], knob: { focus: true }, desc: '同じ相手を倒れるまで狙い続ける' },
  { id: 'tSpread', cat: 'base', sec: '基本', name: '分散型', tiers: [['', 'SR']], mul: { area: 1.4 }, knob: { spread: true }, desc: '全員を少しずつ削り、最後にまとめて倒す' },
  { id: 'tComeback', cat: 'base', sec: '基本', name: '逆転型', tiers: [['', 'SR']], knob: { comeback: true }, desc: '勝っているあいだは堅く、負けたら捨て身で攻める' },
  // ---------- 行動(ブリーダーカード・モンスターカード) ----------
  { id: 'atk', cat: 'monster', sec: '攻撃', phase: 'attack', name: '攻める', tiers: [['', 'N']], start: [''], desc: '点数がいちばん高い攻撃' },
  { id: 'kind', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯の技を出す', tiers: [['ちから', 'N'], ['かしこさ', 'N'], ['特殊', 'N']], desc: 'その種類の技を出す' },
  { id: 'cost', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['軽い技(ガッツ0〜1)', 'N'], ['中くらいの技(2〜3)', 'N'], ['大技(4以上)', 'N']], start: ['大技(4以上)'], desc: '払うガッツで選ぶ' },
  { id: 'reach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['全体攻撃', 'R'], ['単体攻撃', 'N']], desc: '全員に当たる技か、1体に当てる技か' },
  { id: 'eff', cat: 'monster', sec: '攻撃', phase: 'attack', name: '「◯」の技を出す', tiers: [['回避されない', 'N'], ['攻撃できなくする', 'R'], ['ガッツを減らす', 'N'], ['吸い取る', 'N'], ['2回攻撃', 'R'], ['防御で減らない', 'N'], ['回避されても半分', 'N'], ['種族に強い', 'N'], ['ダメージを割り振る', 'R'], ['2枚同時', 'N'], ['手札に戻る', 'N'], ['カード投げ', 'SR']], desc: 'その効き目のついた技を出す' },
  { id: 'attach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '付ける札を使う', tiers: [['', 'R']], desc: '技に付ける札をいっしょに出す' },
  { id: 'attachKind', cat: 'monster', sec: '攻撃', phase: 'attack', name: '付ける札: ◯', tiers: [['ダメージを上げる', 'N'], ['回避させない', 'R'], ['ガッツを軽くする', 'N']], desc: 'その効き目の付ける札を、技にいっしょに出す' },
  { id: 'spe', cat: 'monster', sec: '特殊技', phase: 'attack', name: '特殊技: ◯', tiers: [['味方を回復', 'N'], ['引く', 'N'], ['空中になる', 'N'], ['安全になる', 'R'], ['まゆと羽化', 'R'], ['のりうつる', 'SR']], desc: 'その効き目の特殊技を出す' },
  { id: 'stance', cat: 'monster', sec: '立ち回り', phase: 'attack', name: '立ち回り: ◯', tiers: [['この子から攻める', 'N'], ['この子は攻撃しない', 'N'], ['ライフの多い子が先に', 'R'], ['ライフの少ない子は温存', 'R'], ['攻撃は1回だけ', 'N'], ['何回でも攻める', 'SR']], desc: 'その子の前に出る・下がるを決める' },
  { id: 'bEff', cat: 'breeder', sec: 'ブリーダーのカード', phase: 'attack', name: 'ブリーダー: ◯', tiers: [['回復する', 'N'], ['倒れた子を戻す', 'R'], ['攻撃できないを消す', 'N'], ['相手を攻撃できなくする', 'R'], ['相手のガッツを減らす', 'N'], ['両方のガッツを0にする', 'SR'],
    ['山札からガッツへ', 'N'], ['カードを引く', 'N'], ['捨て札から拾う', 'N'], ['手札を引き直す', 'N'], ['もう1回攻撃させる', 'R'], ['合体する', 'SR'], ['付ける札をただにする', 'N'], ['守りを名指しで封じる', 'R'], ['捨て札を山札に戻す', 'N'], ['小さく攻撃する', 'N']], desc: 'その効き目のブリーダーのカードを出す' },
  { id: 'fieldCard', cat: 'breeder', sec: 'ブリーダー', phase: 'attack', name: '全体カードを出す', tiers: [['', 'R']], desc: '場に残る全体カードを出す' },
  { id: 'fieldKind', cat: 'breeder', sec: '全体カード', phase: 'attack', name: '全体カード: ◯', tiers: [['ダメージを足す', 'N'], ['払うガッツを変える', 'N'], ['大きいダメージを封じる', 'R'], ['山札を削る', 'N'], ['純血のプライド', 'N'], ['技の種類を封じる', 'SR'],
    ['持ちょうを変える', 'R'], ['じわじわ減らす', 'N'], ['ガッツの上限', 'N'], ['出すと引く', 'N']], desc: 'その種類の全体カードを場に出す' },
  { id: 'disrupt', cat: 'monster', sec: '崩す', phase: 'attack', name: '崩し: ◯', tiers: [['手札を捨てさせる', 'R'], ['山札を削る', 'R'], ['ガッツを減らす', 'R'], ['番を飛ばす', 'SR']], desc: '相手の手を崩す札を出す' },
  { id: 'guard', cat: 'monster', sec: '守り', phase: 'guard', name: '守る', tiers: [['', 'N']], start: [''], desc: '攻撃を受けたら守り札で守る' },
  { id: 'guardFirst', cat: 'monster', sec: '守り', phase: 'guard', name: '◯を先に使う', tiers: [['回避', 'N'], ['防御', 'N'], ['はね返す守り', 'R'], ['半分にする守り', 'R']], desc: '守るとき、その種類の札で守る' },
  { id: 'guardOver', cat: 'monster', sec: '守り', phase: 'guard', name: 'ダメージ◯以上だけ守る', tiers: [[3, 'N'], [5, 'N'], [7, 'R'], [10, 'R']], desc: 'その数より小さい攻撃は守らない' },
  { id: 'guardDie', cat: 'monster', sec: '守り', phase: 'guard', name: '倒されるときだけ守る', tiers: [['', 'R']], desc: '受けたら倒れるときだけ守る' },
  { id: 'cover', cat: 'monster', sec: '守り', phase: 'guard', name: '味方をかばう', tiers: [['', 'R']], desc: 'かばう札で、味方への攻撃を受ける' },
  { id: 'noGuard', cat: 'monster', sec: '守り', phase: 'guard', name: '守らない', tiers: [['', 'R']], desc: '守り札を使わず受ける(札を残す)' },
  { id: 'save', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツをためる', tiers: [['', 'N']], start: [''], desc: '手札を多めにガッツへ回す' },
  { id: 'gutsN', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツを◯枚だけ置く', tiers: [[0, 'N'], [1, 'N'], [2, 'N'], [3, 'N']], desc: 'ガッツの番に置く数を決める' },
  { id: 'keepGuard', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: '守り札を残して置く', tiers: [['', 'R']], desc: '回避・防御はガッツにしない' },
  { id: 'gutsOrder', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: '◯から置く', tiers: [['重い札', 'N'], ['使えない札', 'N']], desc: 'ガッツにする札の順を決める' },
  { id: 'stop', cat: 'breeder', sec: '流れ', phase: 'attack', name: '攻撃を止める', tiers: [['', 'N']], start: [''], desc: 'この番の攻撃をここで終える' },
  { id: 'charge', cat: 'monster', sec: '流れ', phase: 'attack', name: '溜め技を使う', tiers: [['', 'R']], desc: '次の技を何倍にする札を先に使う' },
  { id: 'chargeKind', cat: 'monster', sec: '流れ', phase: 'attack', name: '溜め: ◯', tiers: [['怒り', 'R'], ['次の番の技を倍', 'R']], desc: 'その溜めの札を先に使う' },
  { id: 'ace', cat: 'breeder', sec: '特別', phase: 'attack', name: '切り札を出す', tiers: [['', 'SR']], desc: '登録した切り札を、手にあれば先に出す' },
  { id: 'holdBreeder', cat: 'breeder', sec: '流れ', phase: 'attack', name: 'ブリーダーのカードを温存する', tiers: [['', 'N']], desc: 'この番はブリーダーのカードを出さない(当たればそれ以外で打つ)' },
]);
// 名前と効果の文(2026-10-30 社長「そもそも戦術カードの効果がわからない。カード名と効果を明確化して」→ 246枚の一覧に「この形で」)。
//   効果は、このファイルの判定(cardTacticCond・cardTacticAttackFits・cardTacticRowAct・cardTacticHabitOf/KnobsOf)の動きどおりに書く。
//   判定を変えたら、ここの文も必ず合わせる。カードの id(保存に書く)は変えない。種類ごとに (段) => [名前, 効果]
const CARD_TACTIC_TEXT = Object.freeze({
// ---- 条件(〜なら) ----
any:()=>['いつでも','いつでも当てはまる。組み合わせた手を、出せるときはいつも出す'],
ko:()=>['倒せる相手がいる','手札の攻撃の技(特殊技は除く)で、いまのガッツで出せて、ダメージが残りライフ以上になる相手のモンスターがいるとき。その相手を狙う'],
lowest:()=>['ライフがいちばん少ない相手','相手の場で、残りライフ(数)がいちばん少ない相手を狙う'],
highest:()=>['ライフがいちばん多い相手','相手の場で、残りライフ(数)がいちばん多い相手を狙う'],
strongest:()=>['攻撃がいちばん強い相手','相手のモンスターのうち、使える技の最大ダメージがいちばん大きい相手を狙う(手札は見ない)'],
attacker:()=>['前のターンに攻撃してきた相手','直前の相手のターンに攻撃してきた相手のモンスターを狙う'],
leader:()=>['相手のリーダー','相手が1体目(左)に置いたモンスターが残っていれば、それを狙う'],
type:(v)=>[`${v}の相手`,`いま${v}にいる相手のモンスターを狙う`],
blood:(v)=>[`${v}の相手`,`${v}のモンスターの相手を狙う`],
species:()=>['決めた種族の相手','組むときに選んだ種族の相手のモンスター(混血はもとの種族でも当たる)を狙う'],
foeLife:(v)=>[`相手のライフ${v}%以下`,`残りライフが最大の${v}%以下になっている相手のモンスターがいるとき。その相手を狙う`],
myLife:(v)=>[`味方のライフ${v}%以下`,`残りライフが最大の${v}%以下の自分のモンスターがいるとき。守る手と組むと、そのモンスターが狙われたときだけ守る`],
myGuts:(v)=>[`自分のガッツ${v}以上`,`自分のガッツが${v}以上のとき`],
foeGutsLe:(v)=>[`相手のガッツ${v}以下`,`相手のガッツが${v}以下のとき`],
foeGutsGe:(v)=>[`相手のガッツ${v}以上`,`相手のガッツが${v}以上のとき(大技に備える)`],
myHand:(v)=>[`自分の手札${v}枚以上`,`自分の手札が${v}枚以上のとき`],
foeHandGe:(v)=>[`相手の手札${v}枚以上`,`相手の手札が${v}枚以上のとき`],
foeHandLe:(v)=>[`相手の手札${v}枚以下`,`相手の手札が${v}枚以下のとき`],
myDeck:(v)=>[`自分の山札${v}枚以下`,`自分の山札の残りが${v}枚以下のとき`],
foeDeck:(v)=>[`相手の山札${v}枚以下`,`相手の山札の残りが${v}枚以下のとき`],
guardN:(v)=>[`手札に守り札${v}枚以上`,`手札に回避・防御の札が合わせて${v}枚以上あるとき`],
guardKind:(v)=>[`手札に${v}の札がある`,`手札に${v}の札が1枚以上あるとき`],
bigInHand:()=>['手札に大技がある','手札に、払うガッツが4以上の攻撃の札があるとき'],
areaInHand:()=>['手札に全体攻撃がある','手札に、相手の全員に当たる攻撃の札があるとき'],
breederInHand:()=>['手札にブリーダーのカードがある','手札にブリーダーのカードが1枚以上あるとき'],
turnLe:(v)=>[`自分の${v}ターン目まで`,`自分のターンが${v}回目までのとき(自分のはじめのターンが1回目)`],
turnGe:(v)=>[`自分の${v}ターン目から`,`自分のターンが${v}回目以降のとき`],
myAlive:(v)=>[`味方が残り${v}体`,`倒れていない自分のモンスターがちょうど${v}体のとき`],
foeAlive:(v)=>[`相手が残り${v}体`,`倒れていない相手のモンスターがちょうど${v}体のとき`],
koDiff:(v)=>[v==='勝っ'?'倒した数で勝っている':'倒した数で負けている',v==='勝っ'?'倒した相手の数が、倒された味方の数より多いとき':'倒された味方の数が、倒した相手の数より多いとき'],
foeStun:()=>['攻撃できない相手','封じられていて、相手の次のターンに攻撃できない相手のモンスターを狙う'],
myStun:()=>['攻撃できない味方がいる','封じられて攻撃できない自分のモンスターがいるとき'],
foeCharge:()=>['溜めている相手','溜め技を使って、次の技のダメージが何倍にもなる相手のモンスターを狙う'],
foeAir:()=>['空中に上がった相手','もとは地上・水中なのに、いま空中になっている相手のモンスターを狙う'],
field:(v)=>[`場に${v}全体カードがある`,`場に、${v==='自分の'?'自分':'相手'}が出した全体カードが残っているとき`],
foeBig:()=>['相手が大技を撃てそう','相手のガッツが4以上で手札があり、相手のモンスターが使える大技(払うガッツ4以上)をいまのガッツ+1で払えるとき'],
myHandLe:(v)=>[`自分の手札${v}枚以下`,`自分の手札が${v}枚以下のとき`],
breederN:()=>['手札にブリーダーのカード2枚以上','手札にブリーダーのカードが2枚以上あるとき'],
breederUnused:()=>['このターンまだブリーダーのカードを出していない','このターンに、まだブリーダーのカードを出していないとき'],
myGutsLe:(v)=>[`自分のガッツ${v}以下`,`自分のガッツが${v}以下のとき`],
myDiscard:(v)=>[`自分の捨て札${v}枚以上`,`自分の捨て札が${v}枚以上のとき`],
myKo:()=>['倒れた味方がいる','自分のモンスターが1体でも倒れているとき'],
noField:()=>['場に全体カードが無い','どちらの全体カードも場に無いとき'],
selfLife:(v)=>[`このモンスターのライフ${v}%以下`,`このカードを入れたモンスターの残りライフが最大の${v}%以下のとき(モンスターの手に入れたときだけ当たる)`],
selfFresh:()=>['このモンスターがこのターンまだ攻撃していない','このカードを入れたモンスターが、このターンにまだ攻撃していないとき(モンスターの手だけ)'],
selfType:(v)=>[`このモンスターがいま${v}`,`このカードを入れたモンスターが、いま${v}にいるとき(モンスターの手だけ)`],
selfStun:()=>['このモンスターが攻撃できない','このカードを入れたモンスターが封じられて攻撃できないとき(モンスターの手だけ)'],
selfAdv:()=>['このモンスターが得意な相手','このカードを入れたモンスターが出せる手札の技に、相手の特徴(地上・空中・水中)でダメージが倍になるものがあるとき。その相手を狙う(モンスターの手だけ)'],
incoming:(v)=>[`受けるダメージ${v}以上`,`攻撃を受けたとき、受けるダメージの見込みが${v}以上なら(守るときだけ見る)`],
incomingKo:()=>['受けると倒れる','攻撃を受けたとき、守らないと倒れるなら(守るときだけ見る)'],
incomingArea:()=>['全体攻撃を受けた','受けた攻撃が、全員に当たる攻撃なら(守るときだけ見る)'],
// ---- 基本カード(どの手にも当てはまらないときの打ち方) ----
tBalance:()=>['バランス型','攻め・守り・ガッツ・大技・崩し・全体を同じくらいに見て、損得のいちばん良い手を打つ。とどめだけ少し優先'],
tAttack:()=>['攻め型','攻撃を多めに出し(1.5倍重く)、ガッツはためず守り札も残さない。守るのは、受けると倒れるときだけ'],
tGuard:()=>['守り型','守り札を残す(1.5倍重く)・攻撃は控えめ(0.7倍)。攻撃を受けたら、守れるときはいつも守る'],
tSave:()=>['溜め型','ガッツを多めにためて(1.6倍)、大技を優先する(1.8倍)'],
tDisrupt:()=>['崩し型','相手の手札・山札・ガッツを減らす札を優先する(1.8倍)'],
tBig:()=>['大技型','ダメージの大きい技を優先する(1.6倍)'],
tArea:()=>['全体型','全員に当たる攻撃・全体カードを優先する(1.6倍)。相手が1体だけのときは全体攻撃を出さない'],
tFinish:()=>['仕留め型','あと少しで倒せる相手への攻撃を優先する(1.6倍)'],
tRush:()=>['速攻型','攻撃を多めに(1.6倍)・大技は控えめ(0.7倍)。払うガッツが2以上の技は出さない。守るときもガッツ1以下の守り札だけ使う'],
tSteady:()=>['堅実型','守り札とガッツを残し(1.3倍)、攻撃は控えめ(0.8倍)。自分も傷つく技は出さない'],
tJam:()=>['かく乱守り型','崩す札(1.3倍)と、守り札を残すこと(1.3倍)を両方重くする'],
tCalm:()=>['慎重型','いっしょに入れた基本カードの重みを半分に弱めて、極端な打ち方をしない'],
tFlex:()=>['臨機応変型','ターンごとに場を見て、とどめ・全体攻撃・守り・攻めのどれか1つを強くする'],
tMill:()=>['持久型','相手の山札を削る・相手に引かせる・ガッツを山札へ戻す札を重くして、相手の山札切れで勝ちを狙う'],
tReckless:()=>['捨て身型','守り札を残さず(0.5倍)、とどめを優先(1.3倍)。受けると倒れるとき以外は守らない'],
tHand:()=>['手札温存型','出したあとに手札が2枚以上残る手だけを出す。ガッツを置くときも手札を2枚残して置く'],
tDeck:()=>['山札節約型','カードを引く・山札からガッツへ・手札を引き直す・相手に引かせる札は出さない'],
tFocus:()=>['一点集中型','ライフの割合がいちばん低い相手への攻撃を優先して、倒れるまで同じ相手を狙う'],
tSpread:()=>['分散型','全体攻撃を重くし(1.4倍)、ライフがいちばん多い相手への攻撃を優先する'],
tComeback:()=>['逆転型','倒された数で負けている、または味方のライフの合計が半分以下なら捨て身(守り0.5倍・とどめ・大技・全体1.3倍)。それ以外は堅く(守り・ガッツ1.2倍)'],
// ---- モンスターカード(この子の手) ----
atk:()=>['いちばん得な攻撃','このモンスターが出せる攻撃のうち、点数(ダメージ・とどめ・ガッツの損得)がいちばん高い手を出す'],
kind:(v)=>[`${v}の技で攻撃`,`このモンスターの${v}の技のうち、点数がいちばん高い手を出す`],
cost:(v)=>{const n=v.startsWith('軽い')?'0〜1':v.startsWith('中')?'2〜3':'4以上';const nm=v.startsWith('軽い')?'軽い技':v.startsWith('中')?'中くらいの技':'大技';return [`${nm}で攻撃`,`このモンスターの技のうち、払うガッツが${n}の技で、点数がいちばん高い手を出す`];},
reach:(v)=>[v==='全体攻撃'?'全体攻撃で攻撃':'1体だけに攻撃',v==='全体攻撃'?'このモンスターの、相手の全員に当たる技のうち、点数がいちばん高い手を出す':'このモンスターの、1体だけに当てる技のうち、点数がいちばん高い手を出す'],
eff:(v)=>{const d={回避されない:'相手が回避できない技',攻撃できなくする:'当たると相手を攻撃できなくする技',ガッツを減らす:'当たると相手のガッツを減らす技',吸い取る:'相手のライフを吸い取って回復する技','2回攻撃':'もう1回攻撃できるようになる技',防御で減らない:'防御されてもダメージが減らない技',回避されても半分:'回避されても半分のダメージが入る技',種族に強い:'特定の特徴の相手に倍のダメージの技',ダメージを割り振る:'ダメージを相手の何体かに割り振る技','2枚同時':'2枚組でいっしょに出す技',手札に戻る:'当たると手札に戻ってくる技',カード投げ:'カードを投げてダメージを足す技'}[v];return [`「${v}」の技で攻撃`,`このモンスターの、${d}のうち、点数がいちばん高い手を出す`];},
attach:()=>['付ける札といっしょに攻撃','技に付ける札をいっしょに出す手のうち、点数がいちばん高い手を出す'],
attachKind:(v)=>[`付ける札(${v})といっしょに攻撃`,`「${v}」付ける札をいっしょに出す手のうち、点数がいちばん高い手を出す`],
spe:(v)=>{const d={味方を回復:'味方のライフを回復する',引く:'カードを引く',空中になる:'空中に上がる',安全になる:'次の攻撃を受けなくなる',まゆと羽化:'まゆになる・羽化する',のりうつる:'相手にのりうつる'}[v];return [`特殊技で${d}`,`このモンスターの特殊技のうち、${d}技を出す`];},
stance:(v)=>({この子から攻める:['このモンスターが攻める','当てはまったら、このモンスターの攻撃で点数がいちばん高い手を出す'],この子は攻撃しない:['このモンスターは攻撃しない','当てはまったら、このターンはこのモンスターに攻撃させない(このあとの手・基本カードの打ち方でも出さない)'],ライフの多い子が先に:['いちばん元気なら攻める','このモンスターが味方でいちばんライフが多いときだけ、このモンスターの攻撃で点数がいちばん高い手を出す'],ライフの少ない子は温存:['いちばん弱っていたら休む','味方が2体以上いて、このモンスターのライフがいちばん少ないとき、このターンは攻撃させない'],攻撃は1回だけ:['攻撃は1回だけ','このターンにまだ攻撃していなければ攻撃する。1回攻撃したら、このターンはもう攻撃させない'],何回でも攻める:['何回でも攻める','点数が少し低い手でも攻撃を出して、このモンスターの攻撃を続ける']})[v],
disrupt:(v)=>({手札を捨てさせる:['相手の手札を捨てさせる','相手の手札を捨てさせる・山札の下へ戻す札を含む手を出す'],山札を削る:['相手の山札を削る','相手の山札を削る札を含む手を出す'],ガッツを減らす:['相手のガッツを減らす','相手のガッツを減らす・0にする札を含む手を出す'],番を飛ばす:['相手のターンを飛ばす','相手の次のターンを飛ばす札を含む手を出す']})[v],
guard:()=>['守る','このモンスターが攻撃を受けたら、手札の守り札でいちばん良い守り方をする'],
guardFirst:(v)=>[`${v}で守る`,`このモンスターが攻撃を受けたら、${v==='回避'||v==='防御'?v+'の札':'「'+v+'」の札'}だけで守る(無ければ次の手を見る)`],
guardOver:(v)=>[`ダメージ${v}以上だけ守る`,`このモンスターが攻撃を受けたとき、受けるダメージの見込みが${v}より小さければ守らずに受ける。${v}以上なら守る`],
guardDie:()=>['倒れるときだけ守る','このモンスターが攻撃を受けたとき、受けても倒れなければ守らずに受ける。倒れるときだけ守る'],
cover:()=>['かばう札で守る','このモンスターが攻撃を受けたら、かばう・身代わりの札で守る'],
noGuard:()=>['守らない','このモンスターが攻撃を受けても、守り札を使わずに受ける(札を残す)'],
charge:()=>['溜め技を使う','次の技のダメージを何倍にする札(溜め・怒り・次のターンの技を倍)を含む手を出す'],
chargeKind:(v)=>((w)=>[`溜め(${w})を使う`,`「${w}」の溜めの札を含む手を出す`])(v==='次の番の技を倍'?'次のターンの技を倍':v), // 段の値(保存に書く)は「次の番の技を倍」のまま。見せる言葉だけ「ターン」(2026-10-30 社長)
// ---- ブリーダーカード ----
bEff:(v)=>{const d={回復する:'味方を回復する',倒れた子を戻す:'倒れたモンスターを場に戻す',攻撃できないを消す:'味方の「攻撃できない」を消す',相手を攻撃できなくする:'相手のモンスターを攻撃できなくする',相手のガッツを減らす:'相手のガッツを減らす',両方のガッツを0にする:'両方のガッツを0にする',山札からガッツへ:'山札からガッツを増やす',カードを引く:'カードを引く',捨て札から拾う:'捨て札からカードを拾う',手札を引き直す:'手札を引き直す',もう1回攻撃させる:'味方にもう1回攻撃させる',合体する:'モンスターを合体させる',付ける札をただにする:'付ける札の払うガッツを0にする',守りを名指しで封じる:'相手の守りを名指しで封じる',捨て札を山札に戻す:'ガッツを山札に戻して切り直す',小さく攻撃する:'ダメージのあるブリーダーのカードで攻撃する'}[v];return [`ブリーダー: ${d}`,`手札のブリーダーのカードのうち、${d}カードを出す`];},
fieldCard:()=>['全体カードを出す','手札の全体カード(場に残るカード)を出す'],
fieldKind:(v)=>[`全体カード: ${v}`,`手札の全体カードのうち、「${v}」の全体カードを場に出す`],
save:()=>['ガッツを多めにためる','ガッツを置くときに、ふだんより多くの手札をガッツに置く'],
gutsN:(v)=>[`ガッツを${v}枚置く`,`ガッツを置くときに、手札から${v}枚だけガッツに置く`],
keepGuard:()=>['守り札は置かない','ガッツを置くときに、回避・防御の札はガッツに置かない'],
gutsOrder:(v)=>[v==='重い札'?'重い札からガッツに置く':'使えない札からガッツに置く',v==='重い札'?'ガッツに置く枚数はふだんどおり。払うガッツの大きい札から先に置く':'ガッツに置く枚数はふだんどおり。場のモンスターが使えない札から先に置く'],
stop:()=>['このターンの攻撃をやめる','当てはまったら、このターンの攻撃をここで終える'],
ace:()=>['切り札を出す','登録で選んだ切り札が手札にあれば、それを含む手を先に出す'],
holdBreeder:()=>['ブリーダーのカードを温存','当てはまったら、このターンはブリーダーのカード(全体カードも)を出さない。ほかの手はそのまま'],
});
const cardTacticTextOf = (g, v) => {
  const t = CARD_TACTIC_TEXT[g.id] ? CARD_TACTIC_TEXT[g.id](v) : null;
  return t ? { name: t[0], desc: t[1] } : { name: v === '' ? g.name : g.name.replace('◯', String(v)), desc: g.desc };
};
// カードのid は「種類.段」(段の無いカードは種類だけ)。保存(mh_card_tactics_v1)にこのまま書くので、変えない
const cardTacticCardId = (g, v) => (v === '' ? g.id : `${g.id}.${v}`);
const CARD_TACTIC_CARDS = Object.freeze(CARD_TACTIC_GROUPS.flatMap((g) => g.tiers.map(([v, r]) => Object.freeze({
  id: cardTacticCardId(g, v), g: g.id, cat: g.cat, sec: g.sec, phase: g.phase || null, v,
  ...cardTacticTextOf(g, v), r, start: (g.start || []).includes(v),
}))));
const CARD_TACTIC_BY_ID = Object.freeze(Object.fromEntries(CARD_TACTIC_CARDS.map((c) => [c.id, c])));
const CARD_TACTIC_START = Object.freeze(CARD_TACTIC_CARDS.filter((c) => c.start).map((c) => c.id));
const cardTacticOf = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(CARD_TACTIC_BY_ID, id) ? CARD_TACTIC_BY_ID[id] : null);

// 枠の形(2026-10-29 社長: 基本カードはメイン1+サブ2・ブリーダーの枠・モンスター1体ごとの枠)
//   { base:[メイン, サブ1, サブ2](カードidか null), breeder:[行], mons:[[行],[行],[行]] }(mons は場の左・真ん中・右の子)
//   行 … { c: 条件カード, a: 行動カード, on, sp(「種族を決めた相手」のときの種族) }。ブリーダーの枠にはブリーダーカード、モンスターの枠にはモンスターカードだけ
//   数の上限: 基本3・ブリーダー3行・モンスター5行(開いている数はレベルで決まる。96 の cardLevelFrames)
const CARD_TACTIC_FRAME_MAX = Object.freeze({ base: 3, breeder: 3, mon: 5 });
const cardTacticNormalizeRows = (raw, cat, max) => (Array.isArray(raw) ? raw : []).map((r) => {
  if (!r || typeof r !== 'object') return null;
  const c = cardTacticOf(r.c), a = cardTacticOf(r.a);
  if (!c || !a || c.cat !== 'cond' || a.cat !== cat) return null;
  const row = { c: c.id, a: a.id, on: r.on !== false };
  if (c.g === 'species') { if (typeof r.sp !== 'string' || !r.sp) return null; row.sp = r.sp.slice(0, 32); }
  return row;
}).filter(Boolean).slice(0, max);
const cardTacticNormalizeFrames = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const base = [0, 1, 2].map((i) => { const c = cardTacticOf(Array.isArray(r.base) ? r.base[i] : null); return c && c.cat === 'base' ? c.id : null; });
  const mons = [0, 1, 2].map((i) => cardTacticNormalizeRows(Array.isArray(r.mons) ? r.mons[i] : null, 'monster', CARD_TACTIC_FRAME_MAX.mon));
  return { base, breeder: cardTacticNormalizeRows(r.breeder, 'breeder', CARD_TACTIC_FRAME_MAX.breeder), mons };
};
// 入れたカードの数(基本カード+ON の行)。賢さに数える
const cardTacticFilled = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  return f.base.filter(Boolean).length + f.breeder.filter((x) => x.on).length + f.mons.reduce((a, rows) => a + rows.filter((x) => x.on).length, 0);
};

// ---- 賢さ(2026-10-29 社長の物差し)----
// 基本カードの枚数が上限、ON の行の数でそこまで上がる。1枚 … EASY/NORMAL/HARD、2枚 … NORMAL/HARD/EXPERT、3枚 … HARD/EXPERT/MASTER
//   行 0〜3 / 4〜9 / 10以上。基本カードも行も無ければ 'random'(出せる手からランダム)。基本カード無しで行だけなら EASY
const CARD_TACTIC_SMART = Object.freeze(['easy', 'normal', 'hard', 'expert', 'master']);
// ---- 賢さに数えないセット(2026-10-29 社長 案A「ちゃんと効くカードだけ数える」) ----
//   ・場面が合わない … 守るときだけの条件(受けるダメージ・受けると倒れる・全体攻撃を受けた)を守り以外の手と組んだ /
//                    「この子の◯◯」の条件をブリーダーの枠に入れた(その子がいないので当たらない)
//   ・同じもの … 同じ条件と手(と種族)の組み合わせは、いくつセットしても1つと数える(3体の枠へのコピーも)
//   ・ほとんど当たらない … 試合で当たる割合が2%に届かない条件(助手どうし42試合で測った。2026-10-29 ルールくん)。
//                        全体カード・有利な相手のように、自分のデッキ次第で当たり方が変わる条件は入れない
const CARD_TACTIC_GUARD_ONLY_CONDS = Object.freeze(['incoming', 'incomingKo', 'incomingArea']);
const CARD_TACTIC_SELF_CONDS = Object.freeze(['selfLife', 'selfFresh', 'selfType', 'selfStun', 'selfAdv']);
const CARD_TACTIC_RARE_CONDS = Object.freeze(['turnGe.15', 'myLife.10', 'foeLife.10', 'selfLife.10', 'selfStun', 'myStun', 'foeStun', 'foeCharge', 'foeAir', 'incomingArea']);
// 枠ごとのセットに、数えない理由を付ける(数えるものは null)。{ breeder:[理由|null], mons:[[理由|null]×行]×3 }。組む画面の小さい文字にも使う
const cardTacticUncounted = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const seen = new Set();
  const why = (row, where) => {
    if (!row.on) return null;
    const c = cardTacticOf(row.c), a = cardTacticOf(row.a);
    if (!c || !a) return '場面が合わない';
    if (CARD_TACTIC_GUARD_ONLY_CONDS.includes(c.g) && a.phase !== 'guard') return '場面が合わない';
    if (where === 'breeder' && CARD_TACTIC_SELF_CONDS.includes(c.g)) return '場面が合わない';
    if (CARD_TACTIC_RARE_CONDS.includes(c.id)) return 'ほとんど当たらない';
    const key = `${row.c}|${row.a}|${row.sp || ''}`;
    if (seen.has(key)) return '同じものが入っている';
    seen.add(key);
    return null;
  };
  return { breeder: f.breeder.map((r) => why(r, 'breeder')), mons: f.mons.map((rows) => rows.map((r) => why(r, 'mon'))) };
};
// 賢さに数えるセットの数(ON で、数えない理由が無いもの)
const cardTacticCountedRows = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const u = cardTacticUncounted(f);
  return f.breeder.filter((r, i) => r.on && !u.breeder[i]).length + f.mons.reduce((a, rows, mi) => a + rows.filter((r, i) => r.on && !u.mons[mi][i]).length, 0);
};
const cardTacticSmartLevel = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const base = f.base.filter(Boolean).length;
  const rows = cardTacticCountedRows(f);
  // でたらめ(出せる手からランダム)は、何もセットしていないときだけ(数えないセットだけでも、でたらめにはしない)
  const any = f.breeder.some((x) => x.on) || f.mons.some((r) => r.some((x) => x.on));
  if (!base && !any) return 'random';
  if (!base) return 'easy';
  return CARD_TACTIC_SMART[(base - 1) + (rows >= 10 ? 2 : rows >= 4 ? 1 : 0)];
};
// みんなのデッキの登録に載せる短い形(表の tactics は 2000 バイトまで)。{ b:[基本], r:[[c,a,on,sp?]], m:[[[…]]×3] }
const cardTacticPackFrames = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const row = (x) => (x.sp ? [x.c, x.a, x.on ? 1 : 0, x.sp] : [x.c, x.a, x.on ? 1 : 0]);
  return { b: f.base, r: f.breeder.map(row), m: f.mons.map((rows) => rows.map(row)) };
};
const cardTacticUnpackFrames = (v) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const row = (x) => (Array.isArray(x) ? { c: x[0], a: x[1], on: x[2] !== 0, ...(typeof x[3] === 'string' ? { sp: x[3] } : {}) } : null);
  return cardTacticNormalizeFrames({ base: r.b, breeder: (Array.isArray(r.r) ? r.r : []).map(row), mons: (Array.isArray(r.m) ? r.m : []).map((rows) => (Array.isArray(rows) ? rows.map(row) : [])) });
};
// 何も入れていないデッキ(賢さ 'random'): 出せる手からランダム(社長「設定しないとめちゃくちゃ弱い」)
const cardTacticRandomAct = (db, st, policy, rand = Math.random) => {
  if (st.pending) return rand() < 0.5 ? { type: 'pass' } : cardAiChooseGuard(db, st, policy, rand, { force: true, only: () => rand() < 0.5 });
  if (st.phase === 'guts') { const hand = st.players[st.active].hand; return { type: 'guts', hand: hand.map((_, i) => i).filter(() => rand() < 0.4).slice(0, cardAiGutsCap(st.players[st.active])) }; }
  const opts = cardAiAttackChoices(db, st, policy);
  if (!opts.length || rand() < 0.2) return { type: 'endAttacks' };
  return cardAiFillBind(db, st, opts[Math.floor(rand() * opts.length)], policy);
};

// ---- 基本カードの型 → くせ ----
// メインはそのまま、サブは倍率の上げ下げを3分の1ずつ効かせる(2026-10-29 社長「メイン1+サブ2」・ツナグ案)。上限は ×2・下限は ×0.3
//   慎重型 … ほかの型の効きを半分に(サブなら6分の1減らす)/ 臨機応変型・持久型 … メインならいつも、サブなら3回に1回の番
const CARD_TACTIC_DIMS = Object.freeze(['attack', 'keepGuard', 'saveGuts', 'big', 'disrupt', 'area', 'finish']);
const CARD_TACTIC_SUB_W = 1 / 3;
const cardTacticPresetOf = (card) => {
  const g = CARD_TACTIC_GROUPS.find((x) => x.id === card.g) || {};
  if (g.habit) return { ...(CARD_AI_HABITS[g.habit] || {}) };
  if (g.mul) return { ...g.mul };
  return {};
};
// mainHabit … 助手の EXPERT・MASTER(cardAiPolicy の gambitKeepMain): メインの型は今のくせ(強さごとの調整ずみ)をそのまま使い、サブだけを足す
//   when … 助手の EXPERT・MASTER: サブごとの「効く場面」(CARD_AI_TACTIC_WHEN の名前)。その場面では、サブを3分の1でなく丸ごと効かせる
const cardTacticHabitOf = (base, st = null, p = 0, mainHabit = null, when = null) => {
  const subW = (i) => (st && Array.isArray(when) && typeof when[i] === 'string' && typeof cardAiTacticWhenHit === 'function' && cardAiTacticWhenHit(when[i], st, p) ? 1 : CARD_TACTIC_SUB_W);
  const list = (Array.isArray(base) ? base : []).map((id, i) => ({ c: cardTacticOf(id), w: i === 0 ? 1 : subW(i), main: i === 0 })).filter((x) => x.c && x.c.cat === 'base');
  if (!list.length) return null;
  const h = Object.fromEntries(CARD_TACTIC_DIMS.map((d) => [d, mainHabit && Number.isFinite(mainHabit[d]) ? mainHabit[d] : 1]));
  if (mainHabit && mainHabit.flex) h.flex = true;
  if (mainHabit && mainHabit.mill) h.mill = mainHabit.mill;
  list.forEach(({ c, w, main }) => { if (mainHabit && main) return; const pre = cardTacticPresetOf(c); CARD_TACTIC_DIMS.forEach((d) => { if (Number.isFinite(pre[d])) h[d] *= 1 + (pre[d] - 1) * w; }); });
  const calm = list.filter((x) => x.c.g === 'tCalm').reduce((a, x) => a * (1 - 0.5 * x.w), 1);
  CARD_TACTIC_DIMS.forEach((d) => { h[d] = Math.min(2, Math.max(0.3, 1 + (h[d] - 1) * calm)); });
  const turn = st ? cardTacticOwnTurn(st, p) : 0;
  const some = (g) => list.some((x) => x.c.g === g && (x.w === 1 || turn % 3 === 0));
  if (some('tFlex')) h.flex = true;
  const mill = list.filter((x) => x.c.g === 'tMill').reduce((a, x) => a + x.w, 0);
  if (mill) h.mill = Math.min(1, Math.max(h.mill || 0, mill));
  // 逆転型: 倒された数で負けている・ライフの合計が半分以下なら捨て身(守り×0.5・とどめ・大技・全体×1.3)、それまでは堅く(守り・ガッツ×1.2)
  const back = list.find((x) => x.c.g === 'tComeback');
  if (back && st) {
    const me = st.players[p], op = st.players[cardOther(p)];
    const life = me.mons.reduce((a, m) => a + Math.max(0, m.life), 0), max = me.mons.reduce((a, m) => a + m.max, 0);
    const losing = me.mons.filter((m) => m.ko).length > op.mons.filter((m) => m.ko).length || life * 2 <= max;
    const k = (x) => 1 + (x - 1) * back.w;
    if (losing) { h.keepGuard *= k(0.5); h.finish *= k(1.3); h.big *= k(1.3); h.area *= k(1.3); } else { h.keepGuard *= k(1.2); h.saveGuts *= k(1.2); }
  }
  return h;
};
// 基本カードの細かいくせ(knob)。メインはいつも、サブは3回に1回の番(臨機応変型・持久型と同じ)
//   skipMain … 助手の EXPERT・MASTER: メインの型は今の打ち方のままなので、メインの細かいくせは足さない
//   (足すと、みゅあ(攻め型: 倒れるときだけ守る)が MASTER 50→28%・ドラ(守り型: いつも守る)が EXPERT 53→39% に落ちた。2026-10-29 60戦で測った)
const cardTacticKnobsOf = (base, st = null, p = 0, skipMain = false) => {
  const turn = st ? cardTacticOwnTurn(st, p) : 0;
  const out = {};
  (Array.isArray(base) ? base : []).forEach((id, i) => {
    const c = cardTacticOf(id);
    if (!c || c.cat !== 'base' || (i > 0 && turn % 3 !== 0) || (i === 0 && skipMain)) return;
    const g = CARD_TACTIC_GROUPS.find((x) => x.id === c.g) || {};
    Object.assign(out, g.knob || {});
  });
  return out;
};

// ---- 場を見る ----
const cardTacticOwnTurn = (st, p) => Math.max(0, Math.floor((st.turn + (p === st.first ? 1 : 0)) / 2));
const cardTacticAlive = (pl) => pl.mons.map((m, i) => (m.ko ? -1 : i)).filter((i) => i >= 0);
// その子が使える攻撃の札の最大ダメージ(カードの表から。手札は見ない)
const cardTacticMaxDamage = (db, mon) => {
  let best = 0;
  Object.values((db && db.cards) || {}).forEach((c) => { if (c && cardIsAttackKind(c.kind) && cardUsableBy(c, mon)) best = Math.max(best, c.damage || 0); });
  return best;
};
const cardTacticBigCost = 4;
const cardTacticIsBig = (st, c) => !!c && cardIsAttackKind(c.kind) && cardFieldCostOf(st, c.guts || 0) >= cardTacticBigCost;

// 条件を見る。当たらなければ null、当たれば { foes, mine }(標的が無い条件は両方 null)
// fctx … { mi(その枠の子の番号。ブリーダーの枠は null), phase }
const cardTacticCond = (db, st, p, card, row, fctx = {}) => {
  const me = st.players[p], opp = st.players[cardOther(p)];
  const foesAlive = cardTacticAlive(opp), mineAlive = cardTacticAlive(me);
  const hit = (ok) => (ok ? { foes: null, mine: null } : null);
  const foes = (list) => (list.length ? { foes: list, mine: null } : null);
  const mine = (list) => (list.length ? { foes: null, mine: list } : null);
  const v = card.v;
  const hand = me.hand.map((n) => cardOf(db, n)).filter(Boolean);
  const guts = me.guts.length;
  switch (card.g) {
    case 'any': return hit(true);
    case 'ko': {
      const ready = hand.filter((c) => cardIsAttackKind(c.kind) && c.kind !== 'spe' && cardFieldCostOf(st, c.guts || 0) <= guts && me.mons.some((m) => !m.ko && cardUsableBy(c, m)));
      return foes(foesAlive.filter((j) => ready.some((c) => (c.damage || 0) >= opp.mons[j].life)));
    }
    case 'lowest': case 'highest': {
      if (!foesAlive.length) return null;
      const pickV = card.g === 'lowest' ? Math.min(...foesAlive.map((j) => opp.mons[j].life)) : Math.max(...foesAlive.map((j) => opp.mons[j].life));
      return foes(foesAlive.filter((j) => opp.mons[j].life === pickV));
    }
    case 'strongest': {
      if (!foesAlive.length) return null;
      const dm = foesAlive.map((j) => ({ j, d: cardTacticMaxDamage(db, opp.mons[j]) }));
      const top = Math.max(...dm.map((x) => x.d));
      return foes(dm.filter((x) => x.d === top).map((x) => x.j));
    }
    case 'attacker': return foes(foesAlive.filter((j) => (opp.mons[j].attacks || 0) > 0)); // 相手の子の攻撃の数は、相手の番のはじめに 0 に戻る(自分の番の間は前の番の数)
    case 'leader': return foes(foesAlive.filter((j) => j === 0));
    case 'type': { const t = { 地上: 'ground', 空中: 'air', 水中: 'water' }[v]; return foes(foesAlive.filter((j) => cardMonType(opp.mons[j], st.turn) === t)); }
    case 'blood': return foes(foesAlive.filter((j) => (v === '純血' ? cardIsPureMon(opp.mons[j]) : !cardIsPureMon(opp.mons[j]))));
    case 'species': return foes(foesAlive.filter((j) => row && row.sp && (opp.mons[j].species === row.sp || opp.mons[j].main === row.sp)));
    case 'foeLife': return foes(foesAlive.filter((j) => opp.mons[j].life * 100 <= opp.mons[j].max * v));
    case 'myLife': return mine(mineAlive.filter((i) => me.mons[i].life * 100 <= me.mons[i].max * v));
    case 'myGuts': return hit(guts >= v);
    case 'foeGutsLe': return hit(opp.guts.length <= v);
    case 'foeGutsGe': return hit(opp.guts.length >= v);
    case 'myHand': return hit(me.hand.length >= v);
    case 'foeHandGe': return hit(opp.hand.length >= v);
    case 'foeHandLe': return hit(opp.hand.length <= v);
    case 'myDeck': return hit(me.deck.length <= v);
    case 'foeDeck': return hit(opp.deck.length <= v);
    case 'guardN': return hit(hand.filter((c) => cardIsGuardKind(c.kind)).length >= v);
    case 'guardKind': return hit(hand.some((c) => c.kind === (v === '回避' ? 'dge' : 'blk')));
    case 'bigInHand': return hit(hand.some((c) => cardTacticIsBig(st, c)));
    case 'areaInHand': return hit(hand.some((c) => cardIsAttackKind(c.kind) && cardHasEff(c, 'area')));
    case 'breederInHand': return hit(hand.some((c) => c.user === 'breeder'));
    case 'turnLe': return hit(cardTacticOwnTurn(st, p) <= v);
    case 'turnGe': return hit(cardTacticOwnTurn(st, p) >= v);
    case 'myAlive': return hit(mineAlive.length === v);
    case 'foeAlive': return hit(foesAlive.length === v);
    case 'koDiff': { const took = opp.mons.filter((m) => m.ko).length, lost = me.mons.filter((m) => m.ko).length; return hit(v === '勝っ' ? took > lost : lost > took); }
    case 'foeStun': return foes(foesAlive.filter((j) => opp.mons[j].stunTurn > st.turn));
    case 'myStun': return mine(mineAlive.filter((i) => me.mons[i].stunTurn >= st.turn));
    case 'foeCharge': return foes(foesAlive.filter((j) => { const m = opp.mons[j]; return !!m.charge || !!(m.mult && m.mult.turn > st.turn); }));
    case 'foeAir': return foes(foesAlive.filter((j) => { const m = opp.mons[j]; return m.type !== 'air' && cardMonType(m, st.turn) === 'air'; }));
    case 'field': return hit(!!st.field && (v === '自分の' ? st.field.p === p : st.field.p !== p));
    case 'foeBig': {
      // 相手の場の子が使える大技(ガッツ4以上)のうち、いまの相手のガッツで払えるものがある
      const g = opp.guts.length;
      if (g < cardTacticBigCost || !opp.hand.length) return null;
      return hit(Object.values(db.cards || {}).some((c) => cardTacticIsBig(st, c) && cardFieldCostOf(st, c.guts || 0) <= g + 1 && foesAlive.some((j) => cardUsableBy(c, opp.mons[j]))));
    }
    case 'myHandLe': return hit(me.hand.length <= v);
    case 'breederN': return hit(hand.filter((c) => c.user === 'breeder').length >= 2);
    case 'breederUnused': return hit(!me.breederUsed);
    case 'myGutsLe': return hit(guts <= v);
    case 'myDiscard': return hit(me.discard.length >= v);
    case 'myKo': return hit(me.mons.some((m) => m.ko));
    case 'noField': return hit(!st.field);
    case 'selfLife': case 'selfFresh': case 'selfType': case 'selfStun': case 'selfAdv': {
      const mi = fctx.mi;
      const m = Number.isInteger(mi) ? me.mons[mi] : null;
      if (!m || m.ko) return null;
      if (card.g === 'selfLife') return hit(m.life * 100 <= m.max * v);
      if (card.g === 'selfFresh') return hit(!(m.attacks > 0));
      if (card.g === 'selfType') return hit(cardMonType(m, st.turn) === { 地上: 'ground', 空中: 'air', 水中: 'water' }[v]);
      if (card.g === 'selfStun') return hit(m.stunTurn >= st.turn);
      // 有利な相手: この子が使える手札の技に、その相手の特徴で倍になるもの(multVs)がある
      return foes(foesAlive.filter((j) => hand.some((c) => cardUsableBy(c, m) && (c.effects || []).some((e) => e && e.t === 'multVs' && e.type === cardMonType(opp.mons[j], st.turn)))));
    }
    case 'incoming': case 'incomingKo': case 'incomingArea': {
      if (!st.pending || st.pending.defender !== p) return null;
      const dmg = cardAiIncomingDamage(db, st);
      const pd = st.pending, tgt = pd.targets[pd.ti];
      const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
      if (card.g === 'incoming') return hit(dmg >= v);
      if (card.g === 'incomingKo') return hit(!!target && target.life <= dmg);
      return hit(cardHasEff(cardOf(db, pd.main), 'area'));
    }
    default: return null;
  }
};

// ---- 行動 ----
// 攻撃の手が、その行動に合うか(o … 攻撃の候補。main … 主の札)
const CARD_TACTIC_EFF = Object.freeze({
  回避されない: ['noEvade'], 攻撃できなくする: ['stunOnHit', 'stunTarget', 'stunAllEnemies'], ガッツを減らす: ['gutsLossOnHit', 'oppGutsLoss'],
  吸い取る: ['drain'], '2回攻撃': ['extraAttack', 'extraAttackTarget', 'unlimitedAttacks'], 防御で減らない: ['noBlockReduce'], 回避されても半分: ['halfOnEvade'],
  種族に強い: ['multVs'], ダメージを割り振る: ['split'], '2枚同時': ['pair', 'combo', 'requires'], 手札に戻る: ['returnOnHit'], カード投げ: ['tossBonus'],
});
// ブリーダーのカードの効き目ごと(小さく攻撃する はダメージのある札)
const CARD_TACTIC_BEFF = Object.freeze({
  回復する: ['heal'], 倒れた子を戻す: ['revive'], 攻撃できないを消す: ['unstunTarget'], 相手を攻撃できなくする: ['stunTarget'], 相手のガッツを減らす: ['oppGutsLoss'],
  両方のガッツを0にする: ['gutsZeroBoth'], 山札からガッツへ: ['rush', 'deckToGuts'], カードを引く: ['draw'], 捨て札から拾う: ['choose'], 手札を引き直す: ['refresh'],
  もう1回攻撃させる: ['extraAttackTarget'], 合体する: ['fuse'], 付ける札をただにする: ['attachFree'], 守りを名指しで封じる: ['attachBind'], 捨て札を山札に戻す: ['gutsToDeckShuffle'],
});
const CARD_TACTIC_FIELD = Object.freeze({
  ダメージを足す: 'fieldDmg', 払うガッツを変える: 'fieldCost', 大きいダメージを封じる: 'fieldBanDmg', 山札を削る: 'fieldMill', 純血のプライド: 'fieldPurePride',
  技の種類を封じる: 'fieldBanKind', 持ちょうを変える: 'fieldType', じわじわ減らす: 'fieldBurn', ガッツの上限: 'fieldGutsMax', 出すと引く: 'fieldDrawOnPlay',
});
const CARD_TACTIC_ATTACH = Object.freeze({ ダメージを上げる: ['attachMult', 'attachAdd'], 回避させない: ['attachNoEvade', 'attachNoGuard', 'attachNoBlockReduce'], ガッツを軽くする: ['attachCost', 'attachCostHalf', 'attachFree'] });
const CARD_TACTIC_SPE = Object.freeze({ 味方を回復: ['heal'], 引く: ['draw'], 空中になる: ['form', 'becomeAir'], 安全になる: ['safe'], まゆと羽化: ['cocoon', 'emerge'], のりうつる: ['possess'] });
const CARD_TACTIC_CHARGE = Object.freeze({ 怒り: ['rage'], 次の番の技を倍: ['nextTurnMult'] });
const CARD_TACTIC_GUARD_EFF = Object.freeze({ はね返す守り: ['reflect'], 半分にする守り: ['reduceHalf'] });
const CARD_TACTIC_DISRUPT = Object.freeze({
  手札を捨てさせる: ['discardOpp', 'peekPick', 'discardBothHands', 'oppHandToDeckBottom'], 山札を削る: ['millOpp', 'fieldMill'],
  ガッツを減らす: ['oppGutsLoss', 'gutsLossOnHit', 'gutsZeroBoth'], 番を飛ばす: ['skipTurn'],
});
const cardTacticAttackFits = (db, st, act, o) => {
  const me = st.players[st.active];
  const main = cardOf(db, me.hand[o.hand[0]]);
  if (!main) return false;
  const cards = o.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean);
  const v = act.v;
  switch (act.g) {
    case 'atk': return o.type === 'attack' || (o.type === 'breeder' && (main.damage || 0) > 0);
    case 'kind': return o.type === 'attack' && main.kind === { ちから: 'pow', かしこさ: 'int', 特殊: 'spe' }[v];
    case 'cost': { if (o.type !== 'attack') return false; const g = cardActionCost(db, st, st.active, me.hand, o.hand); return v.startsWith('軽い') ? g <= 1 : v.startsWith('中') ? g >= 2 && g <= 3 : g >= cardTacticBigCost; }
    case 'reach': return o.type === 'attack' && (v === '全体攻撃' ? cardHasEff(main, 'area') : !cardHasEff(main, 'area'));
    case 'eff': return cards.some((c) => (CARD_TACTIC_EFF[v] || []).some((t) => cardHasEff(c, t)));
    case 'attach': return o.hand.length > 1 && cards.slice(1).some((c) => cardHasEff(c, 'attach'));
    case 'bEff': {
      const br = cards.filter((c) => c.user === 'breeder' && c.kind !== 'fld');
      if (v === '小さく攻撃する') return o.type === 'breeder' && (main.damage || 0) > 0;
      return br.some((c) => (CARD_TACTIC_BEFF[v] || []).some((t) => cardHasEff(c, t)));
    }
    case 'fieldCard': return main.kind === 'fld';
    case 'fieldKind': return main.kind === 'fld' && cardHasEff(main, CARD_TACTIC_FIELD[v]);
    case 'attachKind': return o.hand.length > 1 && cards.slice(1).some((c) => (CARD_TACTIC_ATTACH[v] || []).some((t) => cardHasEff(c, t)));
    case 'spe': return o.type === 'attack' && main.kind === 'spe' && (CARD_TACTIC_SPE[v] || []).some((t) => cardHasEff(main, t));
    case 'chargeKind': return cards.some((c) => (CARD_TACTIC_CHARGE[v] || []).some((t) => cardHasEff(c, t)));
    case 'disrupt': return cards.some((c) => (CARD_TACTIC_DISRUPT[v] || []).some((t) => cardHasEff(c, t)));
    case 'charge': return cards.some((c) => ['charge', 'rage', 'nextTurnMult'].some((t) => cardHasEff(c, t)));
    default: return false;
  }
};
// 標的が決まっているとき、その手がその子に向いているか(全体攻撃・狙いの無い手は、標的の子が相手の場にいれば向いているとみる)
const cardTacticAimsAt = (st, o, foes) => {
  if (!foes) return true;
  const op = cardOther(st.active);
  if (o.target && o.target.p === op) return foes.includes(o.target.m);
  if (Array.isArray(o.split)) return foes.some((j) => (o.split[j] || 0) > 0);
  return !o.target;
};
// 行の行動を1つ見る。{ act } … その手 / null … この行は出せる手が無い(次の行へ)
//   ctx.mi … 数ならその子の手だけ(モンスターの枠)。null ならブリーダーの手(ブリーダーの枠)
//   ctx.skip … 攻撃させない子(立ち回り)/ ctx.noBreeder … この番はブリーダーのカードを出さない。どちらも、このあとの行と基本カードの型にも効く
const cardTacticRowAct = (db, st, policy, phase, row, aim, ctx) => {
  const act = cardTacticOf(row.a);
  const p = phase === 'guard' ? st.pending.defender : st.active;
  if (act.phase !== 'all' && act.phase !== phase) return null;
  const me = st.players[p];
  const usable = (o) => !(o.type === 'attack' && ctx.skip.has(o.mon)) && !(ctx.noBreeder && (o.type === 'breeder' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder')));
  const pickBest = (fits, floor = 0) => {
    const best = ctx.scored().find((x) => x.s > floor && usable(x.o) && fits(x.o) && cardTacticAimsAt(st, x.o, aim.foes));
    return best ? { act: cardAiFillBind(db, st, best.o, policy) } : null;
  };
  if (act.g === 'ace') {
    const aces = Array.isArray(policy.aces) ? policy.aces : [];
    if (!aces.length || phase !== 'attack') return null;
    return pickBest((o) => o.hand.some((i) => aces.includes(me.hand[i])));
  }
  if (phase === 'attack') {
    if (act.g === 'stop') return { act: { type: 'endAttacks' } };
    if (act.g === 'holdBreeder') { ctx.noBreeder = true; return null; }
    const mine = (o) => (ctx.mi === null ? o.type === 'breeder' || (cardOf(db, me.hand[o.hand[0]]) || {}).kind === 'fld' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder') : o.type === 'attack' && o.mon === ctx.mi);
    if (act.g === 'stance') {
      const mi = ctx.mi;
      const m = Number.isInteger(mi) ? me.mons[mi] : null;
      if (!m) return null;
      const alive = me.mons.filter((x) => !x.ko);
      const v = act.v;
      if (v === 'この子は攻撃しない') { ctx.skip.add(mi); return null; }
      if (v === 'ライフの少ない子は温存') { if (alive.length > 1 && m.life === Math.min(...alive.map((x) => x.life))) ctx.skip.add(mi); return null; }
      if (v === '攻撃は1回だけ') { if (m.attacks > 0) { ctx.skip.add(mi); return null; } return pickBest(mine); }
      if (v === 'ライフの多い子が先に') return m.life === Math.max(...alive.map((x) => x.life)) ? pickBest(mine) : null;
      if (v === '何回でも攻める') return pickBest(mine, -1); // 点数が少し低い手でも出す
      return pickBest(mine); // この子から攻める
    }
    return pickBest((o) => mine(o) && cardTacticAttackFits(db, st, act, o));
  }
  if (phase === 'guard') {
    const pd = st.pending;
    const tgt = pd.targets[pd.ti];
    if (aim.mine && !(tgt && tgt.p === p && aim.mine.includes(tgt.m))) return null; // 守る相手が決まっていて、狙われたのがその子でない
    const dmg = cardAiIncomingDamage(db, st);
    const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
    const cardOfOpt = (o) => cardOf(db, me.hand[o.hand]) || {};
    if (act.g === 'noGuard') return { act: { type: 'pass' } };
    if (act.g === 'guardOver' && dmg < act.v) return { act: { type: 'pass' } };
    if (act.g === 'guardDie' && !(target && target.life <= dmg)) return { act: { type: 'pass' } };
    const only = act.g === 'guardFirst' ? (o) => (act.v === '回避' ? cardOfOpt(o).kind === 'dge' : act.v === '防御' ? cardOfOpt(o).kind === 'blk' : (CARD_TACTIC_GUARD_EFF[act.v] || []).some((t) => cardHasEff(cardOfOpt(o), t)))
      : act.g === 'cover' ? (o) => ['cover', 'shield', 'redirect'].some((t) => cardHasEff(cardOfOpt(o), t))
        : null;
    const g = cardAiChooseGuard(db, st, policy, () => 0, { force: true, only });
    return g.type !== 'pass' ? { act: g } : null;
  }
  if (phase === 'guts') {
    if (act.g === 'save') return { act: cardAiChooseGuts(db, st, { ...policy, habit: { ...(policy.habit || {}), saveGuts: Math.max(1.6, (policy.habit || {}).saveGuts || 1) } }) };
    if (act.g === 'gutsN') return { act: cardAiChooseGuts(db, st, policy, { count: act.v }) };
    if (act.g === 'keepGuard') return { act: cardAiChooseGuts(db, st, policy, { keepGuards: true }) };
    if (act.g === 'gutsOrder') {
      // 置く枚数はふつうのとおり。どの札から置くかだけを変える(重い札/使えない札から)
      const n = cardAiChooseGuts(db, st, policy).hand.length;
      const dead = (c) => !c || (c.user !== 'breeder' && !me.mons.some((m) => !m.ko && cardUsableBy(c, m)));
      const order = me.hand.map((no, i) => ({ i, c: cardOf(db, no) })).sort((x, y) => (act.v === '重い札' ? ((y.c || {}).guts || 0) - ((x.c || {}).guts || 0) : (dead(y.c) ? 1 : 0) - (dead(x.c) ? 1 : 0)) || x.i - y.i);
      return { act: { type: 'guts', hand: order.slice(0, n).map((x) => x.i) } };
    }
  }
  return null;
};

// 基本カードの細かいくせで、攻撃の手を選び直す(どの行にも当たらないとき)。くせが無ければ null(ふつうに打つ)
const cardTacticBaseAttack = (db, st, policy, knobs, ctx) => {
  const p = st.active, me = st.players[p], opp = st.players[cardOther(p)];
  const effs = (o) => o.hand.flatMap((i) => ((cardOf(db, me.hand[i]) || {}).effects || []).map((e) => e && e.t));
  const foes = opp.mons.map((m, j) => ({ m, j })).filter((x) => !x.m.ko);
  const lowest = foes.length ? foes.slice().sort((a, b) => a.m.life / a.m.max - b.m.life / b.m.max)[0].j : -1;
  const highest = foes.length ? foes.slice().sort((a, b) => b.m.life - a.m.life)[0].j : -1;
  const list = ctx.scored().filter((x) => {
    const o = x.o;
    if (o.type === 'attack' && ctx.skip.has(o.mon)) return false;
    if (ctx.noBreeder && (o.type === 'breeder' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder'))) return false;
    const e = effs(o);
    if (knobs.light && o.type === 'attack' && cardActionCost(db, st, p, me.hand, o.hand) > 1) return false;
    if (knobs.safe && e.some((t) => /^selfDamage|^attachSelfIfHit$|^selfHurt$/.test(t))) return false;
    if (knobs.noDraw && e.some((t) => ['draw', 'rush', 'deckToGuts', 'refresh', 'oppDraw'].includes(t))) return false;
    if (knobs.keepHand && me.hand.length - o.hand.length < knobs.keepHand) return false;
    if (knobs.areaMin2 && foes.length < 2 && e.includes('area')) return false;
    return true;
  }).map((x) => {
    const t = x.o.target && x.o.target.p !== p ? x.o.target.m : -1;
    return { ...x, s: x.s + (knobs.focus && t === lowest ? 1.5 : 0) + (knobs.spread && t === highest ? 1 : 0) };
  }).sort((a, b) => b.s - a.s);
  if (!list.length || list[0].s <= 0.3) return { act: { type: 'endAttacks' } };
  return { act: cardAiFillBind(db, st, list[0].o, policy) };
};

// 枠を順に見て、最初に当たった行の手を返す。{ act } … その手 / { policy } … 基本カードの型で、ふつうに打つ / null … 今のまま
//   攻撃の番: 左の子の枠 → 真ん中 → 右 → ブリーダーの枠 / 守るとき: 狙われた子の枠 / ガッツの番: ブリーダーの枠。どれにも当たらなければ基本カードの型
const cardTacticDecide = (db, st, policy) => {
  const frames = cardTacticNormalizeFrames(policy && policy.gambit);
  if (st.winner !== null) return null;
  const phase = st.pending ? 'guard' : st.phase === 'guts' ? 'guts' : st.phase === 'main' ? 'attack' : null;
  if (!phase) return null;
  if (policy.gambitRandom && cardTacticSmartLevel(frames) === 'random') return { act: cardTacticRandomAct(db, st, policy) };
  const p = phase === 'guard' ? st.pending.defender : st.active;
  const habit = cardTacticHabitOf(frames.base, st, p, policy.gambitKeepMain ? policy.habit : null, policy.gambitWhen || null);
  const knobs = cardTacticKnobsOf(frames.base, st, p, !!policy.gambitKeepMain);
  const pol = habit ? { ...policy, habit } : policy;
  let scored = null;
  const ctx = { mi: null, skip: new Set(), noBreeder: false, scored: () => { if (!scored) scored = cardAiAttackScored(db, st, cardAiAttackChoices(db, st, pol), pol); return scored; } };
  const order = [];
  if (phase === 'attack') { [0, 1, 2].forEach((mi) => order.push({ rows: frames.mons[mi], mi })); order.push({ rows: frames.breeder, mi: null }); }
  if (phase === 'guard') { const t = st.pending.targets[st.pending.ti]; if (t && t.p === p) order.push({ rows: frames.mons[t.m] || [], mi: t.m }); }
  if (phase === 'guts') order.push({ rows: frames.breeder, mi: null });
  for (const fr of order) {
    if (phase === 'attack' && fr.mi !== null && st.players[p].mons[fr.mi] && st.players[p].mons[fr.mi].ko) continue;
    for (const row of fr.rows) {
      if (!row.on) continue;
      const aim = cardTacticCond(db, st, p, cardTacticOf(row.c), row, { mi: fr.mi, phase });
      if (!aim) continue;
      ctx.mi = fr.mi;
      const got = cardTacticRowAct(db, st, pol, phase, row, aim, ctx);
      if (got) return got;
    }
  }
  // どの行にも当たらない: 基本カードの型で打つ(細かいくせ・立ち回りで外した子・温存したブリーダーのカードも守る)
  if (phase === 'attack' && (ctx.skip.size || ctx.noBreeder || ['light', 'safe', 'noDraw', 'keepHand', 'focus', 'spread', 'areaMin2'].some((k) => knobs[k]))) return cardTacticBaseAttack(db, st, pol, knobs, ctx);
  if (phase === 'guard') {
    const pd = st.pending, tgt = pd.targets[pd.ti];
    const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
    const dies = !!target && target.life <= cardAiIncomingDamage(db, st);
    if (knobs.noGuardUnlessFinish && !dies) return { act: { type: 'pass' } };
    if (knobs.guardDieOnly) { if (!dies) return { act: { type: 'pass' } }; const g = cardAiChooseGuard(db, st, pol, () => 0, { force: true }); return { act: g }; }
    if (knobs.guardAll) { const g = cardAiChooseGuard(db, st, pol, () => 0, { force: true, only: knobs.light ? (o) => ((cardOf(db, st.players[p].hand[o.hand]) || {}).guts || 0) <= 1 : null }); if (g.type !== 'pass') return { act: g }; }
    if (knobs.light) { const g = cardAiChooseGuard(db, st, pol, () => 0.5, { only: (o) => ((cardOf(db, st.players[p].hand[o.hand]) || {}).guts || 0) <= 1 }); return { act: g }; }
  }
  if (phase === 'guts' && knobs.keepHand) {
    const g = cardAiChooseGuts(db, st, pol);
    const room = Math.max(0, st.players[p].hand.length - knobs.keepHand);
    return { act: { ...g, hand: g.hand.slice(0, room) } };
  }
  return habit ? { policy: pol } : null;
};

// ---- 助手と対戦の基本カード(2026-10-29 社長: EASY〜HARD は1枚・EXPERT は2枚・MASTER は3枚。枚数が増えるほど型が混ざって賢くなる) ----
//   メインはその助手の今の型(くせは今の値と強さごとの調整のまま。cardAiPolicy の gambitKeepMain)。2枚目・3枚目はツナグ案を、勝率を測って決めた
//   EASY〜HARD は1枚(=今の型だけ)なので、今の打ち方のまま(gambit を持たせない)
const CARD_AI_TACTIC_BASE = Object.freeze({
  mua: ['tAttack', 'tFinish', 'tBig'],
  momosuke: ['tDisrupt', 'tJam', 'tCalm'],
  kiki: ['tSave', 'tBig', 'tSteady'],
  kyuko: ['tBalance', 'tCalm', 'tFinish'],
  dra: ['tGuard', 'tSteady', 'tMill'],
  atsu: ['tFlex', 'tArea', 'tSteady'],
  sorashido: ['tMill', 'tDisrupt', 'tGuard'],
});
const CARD_AI_TACTIC_COUNT = Object.freeze({ expert: 2, master: 3 });
// 2枚目・3枚目が丸ごと効く場面(2026-10-29 社長 案B「型が混ざったことが、遊ぶ人に分かる程度に」)。ほかの場面では3分の1
const CARD_AI_TACTIC_WHEN = Object.freeze({
  mua: [null, 'foeLow', 'gutsFull'],         // 弱った子がいれば仕留め・ガッツが多ければ大技
  momosuke: [null, 'lowLife', 'ahead'],      // 押されたら崩しながら守る・勝っていたら慎重に
  kiki: [null, 'gutsFull', null],            // ガッツが多ければ大技(堅実型は3分の1のまま。押されたときに丸ごと効かせると MASTER 42→39%)
  kyuko: [null, 'behind', 'foeLow'],         // 負けていたら慎重に・弱った子がいれば仕留め
  dra: [null, 'lowLife', 'foeDeckLow'],      // 押されたら堅く・相手の山札が減ったら持久戦
  atsu: [null, 'foeFull', 'lowLife'],        // 相手が3体そろっていれば全体・押されたら堅く
  sorashido: [null, 'foeHandFull', 'lowLife'], // 相手の手札が多ければ崩す・押されたら守る
});
const cardAiTacticWhenHit = (name, st, p) => {
  const me = st.players[p], op = st.players[cardOther(p)];
  const alive = (pl) => pl.mons.filter((m) => !m.ko);
  const life = (pl) => alive(pl).reduce((a, m) => a + Math.max(0, m.life), 0), max = (pl) => pl.mons.reduce((a, m) => a + m.max, 0);
  const kos = (pl) => pl.mons.filter((m) => m.ko).length;
  if (name === 'foeLow') return alive(op).some((m) => m.life * 10 <= m.max * 3);
  if (name === 'gutsFull') return me.guts.length >= 5;
  if (name === 'lowLife') return life(me) * 2 <= max(me);
  if (name === 'ahead') return kos(op) > kos(me);
  if (name === 'behind') return kos(me) > kos(op);
  if (name === 'foeDeckLow') return op.deck.length <= 15;
  if (name === 'foeFull') return alive(op).length >= 3;
  if (name === 'foeHandFull') return op.hand.length >= 4;
  return false;
};
// 2枚目・3枚目の型を、はっきり見える手にする行(3体の枠どれにも入れる。EXPERT は2枚目の行・MASTER は3枚目の行も)。
//   行は上から見て、当たったら(その手が出せれば)その手を出す。出せなければ、ふだんの打ち方
const CARD_AI_TACTIC_ROWS = Object.freeze({
  mua: [[{ c: 'myGuts.5', a: 'cost.大技(4以上)' }], [{ c: 'foeAlive.1', a: 'cost.大技(4以上)' }]],
  momosuke: [[{ c: 'foeHandGe.4', a: 'disrupt.手札を捨てさせる' }], [{ c: 'incomingKo', a: 'guard' }]],
  kiki: [[{ c: 'myGuts.7', a: 'cost.大技(4以上)' }], [{ c: 'incomingKo', a: 'guard' }]],
  kyuko: [[{ c: 'koDiff.負け', a: 'guard' }], [{ c: 'ko', a: 'atk' }]],
  dra: [[{ c: 'incoming.3', a: 'guard' }], [{ c: 'foeDeck.5', a: 'disrupt.山札を削る' }]],
  atsu: [[{ c: 'foeAlive.3', a: 'reach.全体攻撃' }], [{ c: 'myLife.50', a: 'guard' }]],
  sorashido: [[{ c: 'foeDeck.20', a: 'disrupt.山札を削る' }], [{ c: 'incoming.5', a: 'guard' }]],
});
const cardAiTacticGambit = (who, levelId) => {
  const n = CARD_AI_TACTIC_COUNT[levelId];
  const list = CARD_AI_TACTIC_BASE[who];
  if (!n || !list) return null;
  const rows = (CARD_AI_TACTIC_ROWS[who] || []).slice(0, n - 1).flat().map((r) => ({ ...r, on: true }));
  return { base: [0, 1, 2].map((i) => (i < n ? list[i] || null : null)), breeder: [], mons: [rows, rows, rows] };
};


;
// ---- 82-card-share-core.jsx ----
// ===== MFバトルカード: 登録デッキの戦い方(画面と保存を触らない部分) =====
// 95-card-deck-share から移した(2026-10-30 ルールくん。中身は変えていない)。大会の試合をサーバ(Edge Function)でも
// 同じ打ち方で回すため、画面(JSX)と保存を触らない部品に分けた。みんなのデッキ(95)・大会(82-card-tournament-core)が使う

// 戦い方の7つの向き(82 の CARD_AI_HABITS の項目と同じ名前)。-1 控えめ / 0 ふつう / 1 強め
const CARD_SHARE_TILTS = Object.freeze([
  { id: 'attack', label: '攻める' }, { id: 'keepGuard', label: '守りを残す' }, { id: 'saveGuts', label: 'ガッツをためる' },
  { id: 'big', label: '大技' }, { id: 'disrupt', label: '相手を崩す' }, { id: 'area', label: '全体技' }, { id: 'finish', label: 'とどめ' },
]);
const CARD_SHARE_TILT_MUL = Object.freeze({ '-1': 0.6, 0: 1, 1: 1.6 });
const CARD_SHARE_ACES_MAX = 3;

// 戦い方をきれいにする(知らない項目は捨てる・無い人は既定で補う)。deck を渡すと、切り札はそのデッキに入っている札だけ残す
const cardShareNormalizeTactics = (v, deck = null) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const habit = typeof r.habit === 'string' && Object.prototype.hasOwnProperty.call(CARD_AI_HABITS, r.habit) ? r.habit : 'kyuko';
  const tilt = {};
  CARD_SHARE_TILTS.forEach((t) => { const n = r.tilt && r.tilt[t.id]; tilt[t.id] = n === -1 || n === 1 ? n : 0; });
  const inDeck = deck && Array.isArray(deck.cards) ? new Set(deck.cards) : null;
  const aces = [...new Set((Array.isArray(r.aces) ? r.aces : []).filter((x) => typeof x === 'string' && /^[A-Z]?[0-9]{3}$/.test(x) && (!inDeck || inDeck.has(x))))].slice(0, CARD_SHARE_ACES_MAX);
  const name = typeof r.name === 'string' ? r.name.slice(0, 20) : '';
  // f … 戦術カードの枠(82-card-tactics-core の短い形。2026-10-29 社長)。無い登録(前の形)は、くせと傾きで打つ
  const f = r.f && typeof r.f === 'object' && !Array.isArray(r.f) && typeof cardTacticPackFrames === 'function' ? cardTacticPackFrames(cardTacticUnpackFrames(r.f)) : null;
  return { habit, tilt, aces, name, ...(f ? { f } : {}) };
};
// 登録デッキの賢さ(戦術カードの枠から。2026-10-29 社長「デッキ側で決まる・戦う人は選ばない」)。前の形の登録は NORMAL
//   'random' … 何も入れていない(出せる手からランダム)。報酬と経験値は EASY で数える
const cardShareSmartLevel = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  return t.f && typeof cardTacticSmartLevel === 'function' ? cardTacticSmartLevel(cardTacticUnpackFrames(t.f)) : 'normal';
};
// 土台のくせ(メインの基本カードが助手の型ならその助手。前の形の登録や画面の名前に使う)
const cardShareMainHabit = (frames, fallback = 'kyuko') => {
  const c = frames && typeof cardTacticOf === 'function' ? cardTacticOf(frames.base[0]) : null;
  const g = c && typeof CARD_TACTIC_GROUPS !== 'undefined' ? CARD_TACTIC_GROUPS.find((x) => x.id === c.g) : null;
  return (g && g.habit) || fallback || 'kyuko';
};
const cardShareFightLevel = (tactics) => { const lv = cardShareSmartLevel(tactics); return lv === 'random' ? 'easy' : lv; };
// 戦い方から、助手の打ち方(cardAiPolicy の形)を作る。戦術カードの枠があれば、その枠で打つ(強さは枠の賢さ)
const cardSharePolicy = (tactics, levelId, opts = {}) => {
  const t = cardShareNormalizeTactics(tactics);
  if (t.f) {
    const frames = cardTacticUnpackFrames(t.f);
    const base = cardAiPolicy(t.habit, cardShareFightLevel(t), { ...opts, noTactics: true });
    return { ...base, gambit: frames, gambitRandom: true, aces: t.aces.slice() };
  }
  const base = cardAiPolicy(t.habit, levelId, { ...opts, noTactics: true });
  const habit = { ...base.habit };
  CARD_SHARE_TILTS.forEach((x) => { if (Number.isFinite(habit[x.id])) habit[x.id] = habit[x.id] * CARD_SHARE_TILT_MUL[t.tilt[x.id]]; });
  return { ...base, habit, aces: t.aces.slice() };
};

;
// ---- 82-card-tournament-core.jsx ----
// ===== MFバトルカード: 大会の計算(画面と保存を触らない) =====
// 2026-10-30 社長「作り始めて」。仕様は docs/progress/card-tournament/plan/README.md
//   ・組分け … 9人まで全員で1つの総当たり(4人に足りなければ助手)。10人以上は4〜5人の組 → 各組の優勝・準優勝で頂上決戦
//   ・総当たりの日程 … 輪の回し方(奇数は毎日1人お休み)。1日1試合
//   ・1試合 … 同じデッキ・戦術カード・種なら、どこで回しても同じ結果。手の並びを残す(見返しは手を当て直すだけ)
//   ・順位 … 勝ち数 → 倒したモンスターの数 → 2人の対戦の勝ち負け → エントリーが早い人
//   ・ごほうび … 大会ごとの表(順位ごと・参加賞・1勝ごと)
// サーバの上の関数(Edge Function card-tournament-run)も、この部品をそのまま使う(ビルドで写す)。だから画面・保存・時計(Date.now)を使わない

const CARD_TOUR_SINGLE_MAX = 9;   // 9人までは全員で1つの総当たり
const CARD_TOUR_GROUP_SIZE = 5;   // 10人以上は5人ずつを目安に組を作る
const CARD_TOUR_MIN_SEATS = 4;    // 総当たりは4人から(足りない席は助手)
const CARD_TOUR_FINAL_TOP = 2;    // 各組から頂上決戦へ進む人数(優勝・準優勝)
const CARD_TOUR_ASSIST_LEVEL = 'expert'; // 助手の席の強さ
const CARD_TOUR_MAX_STEPS = 4000;

// 文字から32ビットの数(FNV-1a)。種と、組への振り分けの混ぜ方に使う
const cardTourHash = (text) => {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const cardTourRand = (key) => { let s = cardTourHash(key) || 1; return () => { const n = cardRngNext(s); s = n.s; return n.v; }; };
// 試合の種(大会の番号・段・組・日・2人の席から)。0 にはしない
const cardTourMatchSeed = (tourId, stage, group, day, a, b) => (cardTourHash(`${tourId}|${stage}|${group}|${day}|${a}|${b}`) % 2147483646) + 1;

// ---- 組分け ----
// ids … エントリーの番号(エントリーが早い順)。key … 締め切りで決める混ぜ方の種(大会の番号など)
// 返り値: [[席の番号…]…](組ごと)。助手の席は { assist: 何番目の助手 } で入る
const cardTourGroups = (ids, key) => {
  const list = Array.isArray(ids) ? ids.slice() : [];
  const fill = (g) => { const out = g.slice(); let k = 0; while (out.length < CARD_TOUR_MIN_SEATS) out.push({ assist: k++ }); return out; };
  if (list.length <= CARD_TOUR_SINGLE_MAX) return [fill(list)];
  // 10人以上: 締め切りの種で混ぜて、組へ順に配る(組の数 = 人数 ÷ 5 の切り上げ。4〜5人ずつになる)
  const rand = cardTourRand(`groups|${key}`);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const n = Math.ceil(list.length / CARD_TOUR_GROUP_SIZE);
  const groups = Array.from({ length: n }, () => []);
  list.forEach((id, i) => groups[i % n].push(id));
  return groups.map(fill);
};

// ---- 総当たりの日程(輪の回し方) ----
// size 人の総当たりを、1日1試合ずつの日に分ける。[[[a, b]…](その日の試合)…]。奇数は毎日1人お休み
const cardTourRoundRobin = (size) => {
  const n = Math.max(0, Math.floor(size));
  if (n < 2) return [];
  const seats = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i); // 奇数は「お休み」の席を1つ足す
  const m = seats.length;
  const days = [];
  for (let d = 0; d < m - 1; d++) {
    const day = [];
    for (let i = 0; i < m / 2; i++) {
      const a = seats[i], b = seats[m - 1 - i];
      if (a < n && b < n) day.push(d % 2 ? [b, a] : [a, b]);
    }
    days.push(day);
    seats.splice(1, 0, seats.pop()); // 0 番は動かさず、残りを1つずつ回す
  }
  return days;
};

// 組の試合を並べる。stage … 'group' | 'final'。dayFrom … その段の1日目が大会の何日目か(0 から)
// 返り値: [{ stage, group, day, a, b, seed, first }](a・b は組の中の席の番号)
const cardTourSchedule = (tourId, groups, stage = 'group', dayFrom = 0) => {
  const out = [];
  (groups || []).forEach((g, gi) => {
    cardTourRoundRobin(g.length).forEach((pairs, d) => pairs.forEach(([a, b]) => {
      const day = dayFrom + d;
      const seed = cardTourMatchSeed(tourId, stage, gi, day, a, b);
      out.push({ stage, group: gi, day, a, b, seed, first: seed % 2 });
    }));
  });
  return out;
};
// その段の日数(いちばん人数の多い組で決まる)
const cardTourStageDays = (groups) => Math.max(0, ...(groups || []).map((g) => cardTourRoundRobin(g.length).length));

// ---- 順位 ----
// seats … 組の席の数。matches … その組の試合({ a, b, winner: 0=a・1=b・null=まだ, kos: [aが倒した数, bが倒した数] })。order … 席ごとのエントリーの早さ(小さいほど早い)
// 返り値: 席の番号を順位の順に並べたもの、と席ごとの成績
const cardTourStandings = (seats, matches, order = null) => {
  const rec = Array.from({ length: seats }, (_, i) => ({ seat: i, wins: 0, losses: 0, kos: 0 }));
  const beat = new Set();
  (matches || []).forEach((m) => {
    if (m.winner !== 0 && m.winner !== 1) return;
    const w = m.winner === 0 ? m.a : m.b, l = m.winner === 0 ? m.b : m.a;
    if (!rec[w] || !rec[l]) return;
    rec[w].wins += 1; rec[l].losses += 1;
    const k = Array.isArray(m.kos) ? m.kos : [0, 0];
    if (rec[m.a]) rec[m.a].kos += Number(k[0]) || 0;
    if (rec[m.b]) rec[m.b].kos += Number(k[1]) || 0;
    beat.add(`${w}>${l}`);
  });
  const early = (i) => (Array.isArray(order) && Number.isFinite(order[i]) ? order[i] : i);
  // 2人の対戦の勝ち負けは、勝ち数と倒した数がちょうど2人だけ並んだときに使う(3人以上が並ぶと勝ち負けが回って決まらないので、エントリーの早さ)
  const tie = (r) => `${r.wins}|${r.kos}`;
  const tied = {};
  rec.forEach((r) => { tied[tie(r)] = (tied[tie(r)] || 0) + 1; });
  const rank = rec.slice().sort((x, y) => (y.wins - x.wins) || (y.kos - x.kos)
    || (tied[tie(x)] === 2 ? (beat.has(`${x.seat}>${y.seat}`) ? -1 : beat.has(`${y.seat}>${x.seat}`) ? 1 : 0) : 0)
    || (early(x.seat) - early(y.seat))).map((r) => r.seat);
  return { rank, rec };
};
// 頂上決戦に進む席(組ごとの順位から、上から CARD_TOUR_FINAL_TOP 人)。組が1つなら頂上決戦は無い(null)
const cardTourFinalists = (groupRanks) => (Array.isArray(groupRanks) && groupRanks.length > 1
  ? groupRanks.flatMap((rank, gi) => rank.slice(0, CARD_TOUR_FINAL_TOP).map((seat) => ({ group: gi, seat })))
  : null);

// ---- 1試合 ----
// side … { deck, tactics }(エントリーの写し)か { assist: 助手の id }(助手の席)。key … 助手のデッキを決める種の名前
// 返り値: { winner: 0|1, kos: [0側が倒した数, 1側が倒した数], acts: [[打った人, 手]…], steps, decided: 'ko'|'deck'|'limit', rules, decks: [0側, 1側] }
//   decks … 使ったデッキ(助手の席は種から作るので、見返しのために返す)
const cardTourSidePolicy = (db, side, key) => {
  if (side && side.assist) {
    const deck = cardAiBuildDeck(db, side.assist, CARD_TOUR_ASSIST_LEVEL, cardAiSeededRand(`tour|${key}|${side.assist}`));
    return { deck, policy: cardAiPolicy(side.assist, CARD_TOUR_ASSIST_LEVEL, { sameBlood: !!deck.sameBlood }) };
  }
  return { deck: side.deck, policy: cardSharePolicy(side.tactics, 'normal') };
};
const cardTourPlay = (db, sideA, sideB, { seed, first = 0, key = '' }) => {
  const A = cardTourSidePolicy(db, sideA, `${key}|a`), B = cardTourSidePolicy(db, sideB, `${key}|b`);
  let st = cardCreateGame(db, { decks: [A.deck, B.deck], names: ['A', 'B'], seed, first });
  // 打ち方の気まぐれも種から決める(サーバで何度回しても同じ手になる)
  let r = (seed * 7919) >>> 0 || 1;
  const rand = () => { const n = cardRngNext(r); r = n.s; return n.v; };
  const pol = [A.policy, B.policy];
  const acts = [];
  let steps = 0;
  for (; steps < CARD_TOUR_MAX_STEPS && st.winner === null; steps++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
    let act = cardAiChooseAction(db, st, pol[who], rand);
    let next = act && cardApplyAction(db, st, act);
    if (!next) {
      // 出せない手を選んだときは、どの端末でも通る手に替える(見返しでも同じ手を当てるので、替えた手を残す)
      act = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null;
      next = act && cardApplyAction(db, st, act);
      if (!next) break;
    }
    acts.push([who, act]);
    st = next;
  }
  const kos = [cardKoCount(st, 0), cardKoCount(st, 1)];
  const decks = [A.deck, B.deck];
  if (st.winner === 0 || st.winner === 1) return { winner: st.winner, kos, acts, steps, decided: /山札/.test(String(st.reason || '')) ? 'deck' : 'ko', rules: typeof CARD_REPLAY_RULES !== 'undefined' ? CARD_REPLAY_RULES : null, decks };
  // 手の数の上限まで決着しなかった(まず起きない): 倒した数 → 残りのライフの合計 → 後攻の勝ち
  const life = (p) => st.players[p].mons.reduce((a, m) => a + Math.max(0, m.ko ? 0 : m.life), 0);
  const winner = kos[0] !== kos[1] ? (kos[0] > kos[1] ? 0 : 1) : life(0) !== life(1) ? (life(0) > life(1) ? 0 : 1) : cardOther(first);
  return { winner, kos, acts, steps, decided: 'limit', rules: typeof CARD_REPLAY_RULES !== 'undefined' ? CARD_REPLAY_RULES : null, decks };
};

// ---- ごほうびの表(大会ごと。表の1行に持たせる) ----
// { ranks: [{ point, title, frame }…](1位から), participation: { point }, perWin: 1勝ごとのビートP }
const cardTourNormalizeRewards = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100000, Math.floor(Number(v)))) : 0);
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const ranks = (Array.isArray(r.ranks) ? r.ranks : []).slice(0, 16).map((x) => ({ point: num(x && x.point), title: str(x && x.title, 30), frame: str(x && x.frame, 40) }));
  return { ranks, participation: { point: num(r.participation && r.participation.point) }, perWin: num(r.perWin) };
};
// その人のごほうび。place … 大会の順位(1 から。頂上決戦に出なかった人は null)・wins … 全部の試合で勝った数
const cardTourRewardOf = (rewards, place, wins) => {
  const t = cardTourNormalizeRewards(rewards);
  const r = Number.isInteger(place) && place >= 1 ? t.ranks[place - 1] : null;
  const base = r ? r.point : t.participation.point;
  return { point: base + t.perWin * (Math.max(0, Math.floor(Number(wins) || 0))), title: r ? r.title : '', frame: r ? r.frame : '' };
};

;
export { CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_REPLAY_RULES, cardTourGroups, cardTourSchedule, cardTourStageDays, cardTourStandings, cardTourFinalists, cardTourPlay, cardTourNormalizeRewards, cardTourRewardOf, cardTourHash, cardDeckProblems, cardCreateGame, cardApplyAction };
;
