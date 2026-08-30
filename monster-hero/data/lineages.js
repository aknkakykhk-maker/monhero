// ==================== 血統と図鑑 ====================
// モンスターは「主血統 × 副血統 = モンスター」で表される。
// ここはその正式データで、モンスター図鑑の表示だけでなく、
// 将来の「○○血統限定モード」の参加判定にもそのまま使えるようにしてある。
//
// 【マスモンには血統を保存しない】
// 個体(マスモン)は baseId でベースモンを指しているので、血統は baseId から引く。
// 個体側へ写して持つと、あとで血統の定義を直したときに古い値が残って食い違う。
// 保存キー(mh_*)は一切増やしていない。
//
// 【新しいモンスターを足すとき】
// ALL_PLAYER_MONSTERS へ足したら、MONSTER_LINEAGE_MAP にも1行足す。
// 足し忘れは tools/monster/lineage-dex-check.js が見つける。

// ---------- 血統カタログ ----------
//   id     … 血統の識別子
//   name   … 表示名
//   monId  … その血統を代表するプレイアブルモンスター(あればアイコンに使う)。
//            「ドラゴン」「ジョーカー」等、現在プレイアブルなモンスターがいない血統は持たない。
//            画像を勝手に作らず、文字で表示する。
//   rare   … 正体不明のレア血統。この血統が混ざるモンスターは区分「レア」になる
const MONSTER_LINEAGES = {
  mocchi:  { id:'mocchi',  name:'モッチー',     monId:'Mocchi' },
  suezo:   { id:'suezo',   name:'スエゾー',     monId:'Suezo' },
  golem:   { id:'golem',   name:'ゴーレム',     monId:'Golem' },
  tiger:   { id:'tiger',   name:'ライガー',     monId:'Tiger' },
  ham:     { id:'ham',     name:'ハム',         monId:'Ham' },
  pixie:   { id:'pixie',   name:'ピクシー',     monId:'Pixie' },
  monol:   { id:'monol',   name:'モノリス',     monId:'Monol' },
  zan:     { id:'zan',     name:'ザン',         monId:'Zan' },
  ark:     { id:'ark',     name:'アーク',       monId:'Ark' },
  undine:  { id:'undine',  name:'ウンディーネ', monId:'Undine' },
  // プレイアブル代表を持たない血統もここに定義する
  dragon:  { id:'dragon',  name:'ドラゴン' },
  joker:   { id:'joker',   name:'ジョーカー' },
  plant:   { id:'plant',   name:'プラント',     monId:'Plant' },
  gel:     { id:'gel',     name:'ゲル' },
  // 正体不明のレア血統
  unknown: { id:'unknown', name:'？？？', rare:true },
};

// ---------- モンスターごとの血統 ----------
// キーは ALL_PLAYER_MONSTERS のid。main が主血統、sub が副血統。
const MONSTER_LINEAGE_MAP = {
  Mocchi:      { main:'mocchi', sub:'mocchi' },
  Suezo:       { main:'suezo',  sub:'suezo' },
  Golem:       { main:'golem',  sub:'golem' },
  Tiger:       { main:'tiger',  sub:'tiger' },
  Ham:         { main:'ham',    sub:'ham' },
  Pixie:       { main:'pixie',  sub:'pixie' },
  Mia:         { main:'pixie',  sub:'unknown' },
  Pandora:     { main:'pixie',  sub:'unknown' },
  Monol:       { main:'monol',  sub:'monol' },
  Oboro:       { main:'plant',  sub:'gel' },
  Plant:       { main:'plant',  sub:'plant' },
  Zan:         { main:'zan',    sub:'zan' },
  // エイキ: ザンの純血に「？？？」が混ざったレア。正式実装まではデバッグ専用(debugOnly)
  Eiki:        { main:'zan',    sub:'unknown' },
  Mitarashi:   { main:'mocchi', sub:'dragon' },
  Ark:         { main:'ark',    sub:'ark' },
  Iblis:       { main:'ark',    sub:'joker' },
  Undine:      { main:'undine', sub:'undine' },
  Yaobikuni:   { main:'undine', sub:'mocchi' },
  Snegurochka: { main:'undine', sub:'unknown' },
};

// ---------- 区分 ----------
// 主血統と副血統が同じ → 純血 ／ どちらかがレア血統 → レア ／ それ以外 → 派生種
const MONSTER_CATEGORIES = {
  pure:      { id:'pure',      name:'純血' },
  derived:   { id:'derived',   name:'派生種' },
  rare:      { id:'rare',      name:'レア' },
};

// ---------- 図鑑の説明文 ----------
// モンスターidをキーにした本文。1体ぶん足すたびに1行増やせばよい。
// まだ書いていないモンスターは、図鑑側で「調査中」の案内を出す(空欄にはしない)。
const MONSTER_DEX_DESCRIPTIONS = {
  Mocchi: 'モッチー種を代表する人気モンスター。育てやすく扱いやすいため、初心者から上級者まで幅広く親しまれている。やわらかな体と愛らしい動きが魅力。',
  Mitarashi: 'モッチー種らしい愛嬌を残しつつ、ドラゴンの荒々しさをあわせ持つ派生モンスター。見た目のかわいさとは裏腹に気性は激しく、独特な存在感で人気が高い。',
  Snegurochka: '氷の孫娘の異名を持つレアモンスター。高い知性と強い意志を備え、冷気をまとった華麗な戦いぶりで敵を圧倒する。神秘的で気高い雰囲気を持つ特別な存在。',
  Undine: '深海に棲むと伝えられている神秘的なモンスター。温和で争いを好まない性格だが、秘めている能力そのものは非常に高いとされている。',
  Yaobikuni: '遠い昔から存在するとされ、数多くの伝説に語り継がれてきたモンスター。大切な存在との別れを繰り返す、どこか物悲しい逸話を多く持つ。',
  Oboro: '青く透き通った姿を持つ、儚げで美しいモンスター。その幻想的な印象から、悲しい歌や物語の題材として語られることも多い。',
  Plant: '非力だが多彩な攻撃手段を持っている\nほかの地域と比べると、IMa地方のプラントは弱いと言われているようだ',
  Suezo: '見た目も行動もどこか奇妙なモンスターだが、頭がよく人間らしい一面も持っている。付き合いが長くなるほど、不思議と愛着の湧く存在。',
  Ham: '祖先によって格闘スタイルが異なるとされるモンスター。しなやかな動きと巧みな力の使い方で、相手の急所を正確に突く戦いを得意とする。',
  Tiger: '主人への忠誠心が高く、とてもよく懐くモンスター。古くから人間のよきパートナーとして親しまれ、強さと親しみやすさをあわせ持つ。',
  Golem: '圧倒的な一撃の破壊力を誇る大型モンスター。普段は穏やかでむやみに力を振るうことはないが、敵と認めた相手には容赦しない。',
  Pixie: '愛らしい姿と仕草を持つモンスター。少しわがままな性格だが、ときおり見せる素直な一面とのギャップも大きな魅力となっている。',
  Mia: '明るくさわやかな性格で、アイドル性が高く\n多くのブリーダーが憧れるモンスター\n着ている服は自らデザインしたとか',
  Pandora: '一つの体に光と闇、相反する二つの魔力を宿した珍しいピクシー\n絶えずぶつかり合う魔力のせいで情緒は少し不安定だが、\nどちらの力も欠かせない不思議な均衡で成り立っている\n本当はオシャレが好きで、争いもあまり好まない',
  Monol: '石のような姿をしているが、石そのものではない不思議なモンスター。その素材の正体はいまだ解明されておらず、姿を見ると思わず拝んでしまう者もいるという。',
  Zan: '人の目では追えないほどの素早さと高い攻撃力をあわせ持つ、恐ろしいモンスター。その強さを恐れられ、かつてトチカ人によって封印されていたと伝えられている。',
  Eiki: 'ザンの純血を色濃く継ぎ、一つの体に桜と氷、相反する二つの力を宿す。人の目では追えない速さで舞い、花吹雪とともに敵を斬る。意外にも穏やかで、争いより美しいものを愛でる性質がある。',
  Iblis: 'アーク種が別の姿へ変身できる時間は非常に短い。その不自由さから行き場のない恨みを募らせ、自らを生み出したジョーカーへの復讐を狙っている。',
  Ark: 'アーク種はバトルになると別の姿へ変身し、その姿は血統によってさまざまに変化する。純血のアークは、美しい天使のような姿に憧れているという。',
};
