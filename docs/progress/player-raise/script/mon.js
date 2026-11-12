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

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_MON };
