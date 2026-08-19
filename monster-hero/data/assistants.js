// ==================== 助手(ナビゲーター) ====================
// 助手は「いまこの画面で何ができるか」を短いセリフで教えてくれるキャラクター。
// 吹き出しをタップすると詳しい説明(ヘルプ本文)が開く。
//
// 【設計の方針】
// 名前・画像・表情・セリフをすべてこのファイルのデータにまとめ、画面側は
// <AssistantBubble scene="キー"/> を1つ置くだけで済むようにしている。
// 助手を増やす・画像を差し替える・セリフを直す、のどれもこのファイルだけで完結する。
// セリフや画像のパスを各画面のJSXへ直接書かないこと(直すときに探し回ることになる)。
//
// 【セリフは1画面につき複数持つ】★重要
// 同じ画面でいつも同じことを言うと、遊ぶほどキャラクターが死んでいく。
// 場面ごとに lines を5つ以上持たせ、画面を開くたびにランダムで1つ選ぶ。
// 直前に出したものは続けて出さない(pickAssistantLine が覚えている)。
//
// 【助手を増やすとき】
//   ASSISTANTS に1件足す。表情画像は images/assistant/<prefix>_<表情>.PNG の形で置き、
//   imagePrefix にその接頭辞を書く。画面側の変更は要らない。
//
// 【場面を増やすとき】
//   ① ASSISTANT_SCENES に場面を1つ足す(lines は5つ以上)
//        home: { help:'home/roster', lines:[ { e:'happy', t:'…' }, ... ] }
//   ② その画面のJSXに1行置く
//        <AssistantBubble scene="home"/>
//   これだけで、吹き出し・表情・ランダム表示・タップで開く詳細がすべて同じ見た目で動く。

// ---------- みゅあの話し方(セリフを足すときの決まりごと) ----------
// ・一人称は「あたし」。役割は「助手」
// ・明るく元気で、少しギャルっぽい。ゲーム好きで面倒見がよく、一緒に遊んでいる感じ
// ・上から目線にしない。説明書のような言い回し(「〜してください」「〜しましょう」)にしない
// ・語尾は「〜だよ♪」「〜しよ！」「〜じゃん♪」「〜かも！」「〜だね！」「〜いこ！」などを
//   場面ごとに散らす。同じ場面のセリフで語尾がそろわないようにする
// ・1〜2文で、スマホでも一目で読める長さにする
// ・ギャル語を使いすぎない。子供っぽくしすぎない

// ---------- 表情 ----------
// 画像は monster-hero/images/assistant/ に <prefix>_<表情>.PNG の名前で置く。
// 元画像は1536x1024の全身絵で1枚1.5MBあるため、吹き出しの丸い顔には
// tools/make-assistant-faces.js が作る face/ の顔アイコン(256px・約100KB)を使う。
// 表情画像を差し替えたら `node tools/make-assistant-faces.js` を流し直すこと。
const ASSISTANT_EXPRESSIONS = ['normal','happy','wink','surprise','troubled','angry','crying','excited'];
const ASSISTANT_DEFAULT_EXPRESSION = 'normal';

// 画像が用意できていない助手はこれを使う(絵文字で代用される)
const ASSISTANT_NO_IMAGE = null;

const ASSISTANTS = [
  {
    id: 'mua',
    name: 'みゅあ',
    role: '助手',
    imageDir: 'images/assistant',
    imagePrefix: 'myua',
    expressions: ASSISTANT_EXPRESSIONS,
    defaultExpression: ASSISTANT_DEFAULT_EXPRESSION,
    emoji: '💖',        // 画像が無いときの代わり
    accent: '#f472b6',  // 吹き出しの縁・名前・ボタンの色
    greeting: '困ったことがあったら、あたしに聞いてね♪',
    // 助手選択の画面に出す一言紹介(短く、性格の違いが分かるように)
    tagline: '明るく元気なムードメーカー',
    intro: '一緒に盛り上がりながら遊びたい人向け。テンション高めで背中を押してくれる。',
  },
  {
    id: 'kiki',
    name: 'きき',
    role: '助手',
    imageDir: 'images/assistant',
    imagePrefix: 'kiki',
    expressions: ASSISTANT_EXPRESSIONS,
    defaultExpression: ASSISTANT_DEFAULT_EXPRESSION,
    emoji: '🌹',
    accent: '#f43f5e',
    greeting: '困ったことがあったら、いつでも私に聞いてくださいね。',
    tagline: '落ち着いた気配り上手なお姉さん',
    intro: 'じっくり考えて遊びたい人向け。冷静に、そっと支えてくれる。',
  },
];
const DEFAULT_ASSISTANT_ID = 'mua';
const assistantIdOrDefault = (id) => (ASSISTANTS.some(a => a.id === id) ? id : DEFAULT_ASSISTANT_ID);

// ---------- 正式アップデートの初回案内 ----------
// 通常通知の本文は更新履歴を正本とし、assistantNotice を付けた主要更新だけを案内する。
// debugOnly の検証通知だけは更新履歴と切り離し、通常ログインへ混ざらないようにする。
const ASSISTANT_UPDATE_NOTICE_TYPES = new Set(['market', 'mode', 'feature']);
const assistantUpdateNoticeFromChangelog = entry => {
  const meta = entry && entry.assistantNotice;
  if (!meta || !ASSISTANT_UPDATE_NOTICE_TYPES.has(meta.type) || typeof meta.id !== 'string' || !meta.id.trim()) return null;
  const items = Array.isArray(entry.items) ? entry.items.filter(item => typeof item === 'string' && item.trim()) : [];
  if (!entry.title || !items.length) return null;
  const destination = meta.type === 'market' ? 'market' : meta.type === 'mode' ? 'battle' : meta.destination;
  return {
    id: meta.id.trim(), enabled: true, title: entry.title, expression: meta.expression || 'excited',
    pages: items.slice(), destination,
    buttonLabel: meta.buttonLabel || (meta.type === 'market' ? 'マーケットを見る' : meta.type === 'mode' ? 'バトルへ行く' : undefined),
  };
};
const ASSISTANT_CHANGELOG_UPDATE_NOTICES =
  ((typeof CHANGELOG !== 'undefined' && Array.isArray(CHANGELOG)) ? CHANGELOG : [])
    .map(assistantUpdateNoticeFromChangelog).filter(Boolean);
const ASSISTANT_UPDATE_NOTICES = [
  ...ASSISTANT_CHANGELOG_UPDATE_NOTICES,
  {
    id: 'update_notice_debug_v1', enabled: true, debugOnly: true,
    title: 'アップデート通知テスト', expression: 'excited',
    pages: [
      '新しい遊びが増えたときは、こんな感じであたしが一度だけ知らせるよ♪',
      'まとめて追加された内容も、この中でサクッと確認できるから安心してね！',
    ],
    destination: 'market', buttonLabel: 'マーケットを見る',
  },
];

// 指定された表情が用意されていなければ既定の表情へ落とす(画像切れを起こさないため)
const assistantExpressionName = (who, expression) => {
  const list = (who && Array.isArray(who.expressions)) ? who.expressions : ASSISTANT_EXPRESSIONS;
  const fallback = (who && who.defaultExpression) || ASSISTANT_DEFAULT_EXPRESSION;
  return list.includes(expression) ? expression : fallback;
};
// 吹き出しの丸い顔に使う軽い画像
const assistantFaceImage = (who, expression) => (who && who.imagePrefix)
  ? `${who.imageDir}/face/${who.imagePrefix}_${assistantExpressionName(who, expression)}.PNG`
  : ASSISTANT_NO_IMAGE;
// 元の大きい立ち絵(今後、全身で出したい場面ができたときに使う)
const assistantFullImage = (who, expression) => (who && who.imagePrefix)
  ? `${who.imageDir}/${who.imagePrefix}_${assistantExpressionName(who, expression)}.PNG`
  : ASSISTANT_NO_IMAGE;

// ---------- 親密度(みゅあとの仲良し度) ----------
// 遊ぶほどみゅあと打ち解けていく。呼び方・話し方・出るセリフが少しずつ変わる。
// 恋愛ものではなく「一緒にモンスターヒーローを遊ぶ相棒」の距離感にする。
//
// 【Lvを増やしたいとき】
//   ASSISTANT_BOND_LEVELS に1件足すだけ。必要な仲良し度(need)は昇順に並べること。
//   呼び方(call)は '{name}' がプレイヤー名に置き換わる。話し方(tone)はセリフを
//   書くときの目安で、画面には出さない。
//
// 【セリフをLvで出し分けたいとき】
//   セリフに bond を書く。書かなければどのLvでも出る。
//     bond:3      … Lv3以上で出る
//     bond:[1,2]  … Lv1〜Lv2のあいだだけ出る
const ASSISTANT_BOND_LEVELS = [
  { level:1,  need:0,     title:'はじめまして',       call:'{name}さん', tone:'少していねい。初対面の距離感' },
  { level:2,  need:60,    title:'顔なじみ',           call:'{name}さん', tone:'笑顔が増えて、少しフレンドリー' },
  { level:3,  need:180,   title:'なかよし',           call:'{name}',     tone:'呼び捨てになって、雑談も増える' },
  { level:4,  need:400,   title:'相棒',               call:'{name}',     tone:'かなり打ち解けた話し方' },
  { level:5,  need:800,   title:'ベストバディ',       call:'{name}ちん', tone:'特別な距離感。ただし馴れ馴れしくはしない' },
  // Lv6以降は呼び方(call)を上書きせず据え置き。ここから先はASSISTANT_CALL_STYLESを
  // プレイヤーが自分で選べるようになるため、call はあくまで「選ばなかったときの既定」
  { level:6,  need:1250,  title:'あうんの仲',         call:'{name}ちん', tone:'あうんの仲。呼び方を自分で選べるようになる' },
  { level:7,  need:1750,  title:'頼れる相方',         call:'{name}ちん', tone:'頼れる相方として、軽い冗談も増える' },
  { level:8,  need:2300,  title:'いつメン',           call:'{name}ちん', tone:'気心の知れた友達みたいな距離感' },
  { level:9,  need:2900,  title:'戦友',               call:'{name}ちん', tone:'戦友っぽい、頼れる掛け合い' },
  { level:10, need:3550,  title:'腐れ縁',             call:'{name}ちん', tone:'軽口を言い合えるくらいの仲' },
  { level:11, need:4250,  title:'阿吽の呼吸',         call:'{name}ちん', tone:'言葉にしなくても伝わる感じ' },
  { level:12, need:5000,  title:'唯一無二',           call:'{name}ちん', tone:'他の誰とも違う、特別な相手として話す' },
  { level:13, need:5800,  title:'一心同体',           call:'{name}ちん', tone:'一心同体みたいに息が合う' },
  { level:14, need:6650,  title:'最高の相方',         call:'{name}ちん', tone:'掛け合いに迷いがなくなってくる' },
  { level:15, need:7550,  title:'伝説のコンビ',       call:'{name}ちん', tone:'伝説のコンビと呼べるくらいの掛け合い' },
  { level:16, need:8500,  title:'運命共同体',         call:'{name}ちん', tone:'運命共同体みたいな頼もしさ' },
  { level:17, need:9500,  title:'生涯のパートナー',   call:'{name}ちん', tone:'ずっと隣にいる相棒という感じ' },
  { level:18, need:10550, title:'かけがえのない存在', call:'{name}ちん', tone:'かけがえのない相手として大切に話す' },
  { level:19, need:11650, title:'唯一の理解者',       call:'{name}ちん', tone:'いちばんの理解者として接する' },
  { level:20, need:12800, title:'永遠の相棒',         call:'{name}ちん', tone:'永遠の相棒。いちばん自然体な話し方' },
];
const ASSISTANT_BOND_MIN_LEVEL = ASSISTANT_BOND_LEVELS[0].level;
const ASSISTANT_BOND_MAX_LEVEL = ASSISTANT_BOND_LEVELS[ASSISTANT_BOND_LEVELS.length - 1].level;

// ---------- 助手ごとの段階(タイトル・呼び方・話し方) ----------
// 必要な仲良し度(need)はどの助手も同じにして、貯まり方の感覚をそろえる。
// 変わるのは「その段階をなんと呼ぶか」「プレイヤーをどう呼ぶか」「どんな話し方か」。
//
// 【助手を増やすとき】
//   ASSISTANT_BOND_STYLES に1件足す。titles は20段階ぶん、call は level を受け取って
//   呼び方のひな形を返す関数。書かなければ、みゅあと同じ段階がそのまま使われる。
const ASSISTANT_BOND_STYLES = {
  // きき: Lv1〜3は「さん」付けのまま少し距離があり、Lv4から「ちー」付けで打ち解ける。
  // Lv6からは、みゅあと同じようにプレイヤーが呼び方を自由に決められる(既定は「ちー」)
  kiki: {
    titles: [
      'はじめまして', '顔なじみ', '気になる存在', 'なかよし', 'お気に入り',
      '心を許せる仲', '頼れる相方', '気の合うふたり', 'いつもの相棒', '腐れ縁',
      '阿吽の呼吸', '特別な存在', '一心同体', '最高の相方', '伝説のコンビ',
      '運命共同体', '生涯のパートナー', 'かけがえのない存在', '唯一の理解者', '永遠の相棒',
    ],
    call: (level) => (level <= 3 ? '{name}さん' : '{name}ちー'),
    tones: [
      'ていねいで、少し遠慮がある。初対面の距離感',
      'ていねいなまま、やわらかさが出てくる',
      '少し打ち解けて、雑談も混ざりはじめる',
      '「ちー」付けになって、ぐっと親しくなる',
      'お気に入りとして、気にかけてくれる',
      '心を許した相手として、素の顔も見せる',
      '頼れる相方。軽い冗談も言うようになる',
      '気の合うふたり。会話のテンポが合ってくる',
      'いつもの相棒として、安心して任せてくれる',
      '腐れ縁。遠慮のない軽口も出る',
      '言葉にしなくても伝わる感じ',
      '他の誰とも違う、特別な相手として話す',
      '一心同体みたいに息が合う',
      '最高の相方。掛け合いに迷いがない',
      '伝説のコンビと呼べるくらいの掛け合い',
      '運命共同体みたいな頼もしさ',
      'ずっと隣にいるパートナーという感じ',
      'かけがえのない相手として大切に話す',
      'いちばんの理解者として寄り添う',
      '永遠の相棒。いちばん自然体な話し方',
    ],
  },
};
// その助手の20段階を作る。need はみゅあと共通、タイトル・呼び方・話し方だけ差し替える
const buildAssistantBondLevels = (style) => ASSISTANT_BOND_LEVELS.map((base, i) => ({
  ...base,
  title: (style.titles && style.titles[i]) || base.title,
  call: (typeof style.call === 'function' ? style.call(base.level) : null) || base.call,
  tone: (style.tones && style.tones[i]) || base.tone,
}));
const ASSISTANT_BOND_LEVEL_SETS = Object.fromEntries(
  Object.entries(ASSISTANT_BOND_STYLES).map(([id, style]) => [id, buildAssistantBondLevels(style)]));
// 助手idから段階の一覧を引く。知らないidや未指定は、これまでどおりみゅあの段階になる
const assistantBondLevelsOf = (assistantId) => ASSISTANT_BOND_LEVEL_SETS[assistantId] || ASSISTANT_BOND_LEVELS;

// ---------- 呼び方の設定(絆Lv6から) ----------
// Lv6になると、それまで絆Lvが自動で決めていた呼び方(さん付け→呼び捨て→ちん付け)を、
// プレイヤーが自由な文字で決められるようになる。「{name}」と書くとそこがプレイヤー名に
// 置き換わる(書かなければ、入力した文字がそのままみゅあの呼び方になる)。
// 決めなければ(空のままなら)、これまでどおり ASSISTANT_BOND_LEVELS の call がそのまま使われる。
// クイック入力用のよくある例。あくまで下書きを差し込むだけで、選択肢を制限するものではない
const ASSISTANT_CALL_STYLES = [
  { id:'san',   label:'さん付け', template:'{name}さん' },
  { id:'plain', label:'呼び捨て', template:'{name}' },
  { id:'chin',  label:'ちん付け', template:'{name}ちん' },
];
// 助手ごとのクイック入力。書かなければ上の既定(みゅあ用)を使う
const ASSISTANT_CALL_STYLE_SETS = {
  kiki: [
    { id:'san',   label:'さん付け', template:'{name}さん' },
    { id:'plain', label:'呼び捨て', template:'{name}' },
    { id:'chi',   label:'ちー付け', template:'{name}ちー' },
  ],
};
const assistantCallStylesOf = (assistantId) => ASSISTANT_CALL_STYLE_SETS[assistantId] || ASSISTANT_CALL_STYLES;
const ASSISTANT_CALL_STYLE_UNLOCK_LEVEL = 6;
const ASSISTANT_CALL_STYLE_MAX_LEN = 16;

// 仲良し度(数値) → その段階の定義。壊れた値でも必ず最初の段階へ落ちる
const assistantBondStage = (points) => {
  const p = Number.isFinite(points) ? points : 0;
  let stage = ASSISTANT_BOND_LEVELS[0];
  for (const s of ASSISTANT_BOND_LEVELS) { if (p >= s.need) stage = s; }
  return stage;
};
const assistantBondLevel = (points) => assistantBondStage(points).level;
// 次の段階までの残り。最大なら null
const assistantBondNext = (points) => {
  const p = Number.isFinite(points) ? points : 0;
  const next = ASSISTANT_BOND_LEVELS.find(s => p < s.need);
  return next ? { level: next.level, need: next.need, remain: next.need - p } : null;
};
// 段階(タイトル・呼び方・話し方)は助手ごとに違う。assistantId を省くとみゅあ扱い
const assistantBondStageByLevel = (level, assistantId) => {
  const levels = assistantBondLevelsOf(assistantId);
  return levels.find(s => s.level === level) || levels[0];
};

// プレイヤーをなんと呼ぶか。名前が無いときは呼びかけを省いても文が成り立つ言葉にする
// customCall … Lv6から自由に決められる呼び方の上書き。「{name}」を含めればプレイヤー名に
//              置き換わり、含めなければ入力した文字がそのまま呼び方になる。
//              未入力・Lv6未満なら絆Lvの既定(stage.call)のまま
// assistantId … 助手ごとに既定の呼び方が違う(みゅあは「ちん」、ききは「ちー」)
const ASSISTANT_NO_NAME = 'キミ';
const assistantCallName = (name, level, customCall, assistantId) => {
  const raw = String(name || '').trim();
  if (!raw) return ASSISTANT_NO_NAME;
  const lv = Number.isFinite(level) ? level : ASSISTANT_BOND_MIN_LEVEL;
  const custom = (lv >= ASSISTANT_CALL_STYLE_UNLOCK_LEVEL && typeof customCall === 'string') ? customCall.trim() : '';
  if (custom) return custom.includes('{name}') ? custom.replace('{name}', raw) : custom;
  const stage = assistantBondStageByLevel(lv, assistantId);
  return String(stage.call || '{name}').replace('{name}', raw);
};
// セリフの中の {name} を、そのときの呼び方へ置き換える
const assistantSpeak = (text, name, level, customCall, assistantId) =>
  String(text == null ? '' : text).replace(/\{name\}/g, assistantCallName(name, level, customCall, assistantId));

// 仲良し度が増える行動。1日に増える量は行動ごとと合計の両方で頭打ちにする。
// 放置しても減らない(久しぶりに開いた人が冷たくされないため)。
//   amount   … 1回で増える量
//   dailyMax … その行動で1日に増やせる上限
const ASSISTANT_BOND_ACTIONS = {
  login:     { amount:10, dailyMax:10, label:'ログイン' },
  battle:    { amount:6, dailyMax:30, label:'バトルを遊ぶ' },
  challenge: { amount:4, dailyMax:20, label:'チャレンジモード' },
  quick:     { amount:2, dailyMax:12, label:'クイックモード' },
  pro:       { amount:4, dailyMax:20, label:'プロモード' },
  ranking:   { amount:2, dailyMax:6,  label:'ランキングを見る' },
  temple:    { amount:2, dailyMax:8,  label:'神殿を使う' },
  mission:   { amount:4, dailyMax:16, label:'ミッション達成' },
  gift:      { amount:2, dailyMax:8,  label:'ギフトを受け取る' },
  market:    { amount:2, dailyMax:6,  label:'マーケットを見る' },
  talk:      { amount:2, dailyMax:10, label:'みゅあと話す' },
  management:  { amount:2, dailyMax:8,  label:'M/B管理を見る' },
  fusion:      { amount:4, dailyMax:12, label:'合体する' },
  breakthrough:{ amount:4, dailyMax:12, label:'限界突破する' },
  reincarnate: { amount:4, dailyMax:12, label:'転生する' },
  regenerate:  { amount:2, dailyMax:6,  label:'再生する' },
  donate:      { amount:4, dailyMax:12, label:'寄付する' },
  enhance:     { amount:2, dailyMax:12, label:'マスモンを強化する' },
  dye:         { amount:2, dailyMax:6,  label:'染色する' },
  partySet:    { amount:2, dailyMax:6,  label:'編成を保存する' },
  extreme:      { amount:6, dailyMax:18, label:'極限チャレンジに挑む' },
  clear:        { amount:4, dailyMax:16, label:'チャレンジモードをクリア' },
  quickClear:   { amount:2, dailyMax:12, label:'クイックモードをクリア' },
  proClear:     { amount:4, dailyMax:16, label:'プロモードをクリア' },
  extremeClear: { amount:8, dailyMax:24, label:'極限チャレンジをクリア' },
  // 助手のブリーダーカード(みゅあ・きき)だけの行動。
  // ここだけは「いま選んでいる助手」ではなく、そのカード本人の仲良し度が増える。
  // 編成を保存しただけでは増えない(付け外しでは稼げず、実際にバトルを始めた時だけ数える)
  assistantCardEquip: { amount:4, dailyMax:20, label:'助手のカードを編成して挑む' },
  assistantCardUse:   { amount:6, dailyMax:24, label:'助手のカードをバトルで使う' },
};
// 1日に増やせる合計。行動の種類が増えるほど「1日でどれだけ遊んでも上限40で頭打ち」が
// きつくなりすぎたため、行動ごとの上限をすべて合わせた理論上の最大値まで引き上げた。
// 「1日で一気に仲良くなる」ことを防ぐ役目は、行動ごとの1日上限(dailyMax)がすでに
// 担っているので、全体の頭打ちは「これ以上は増えない」という安全弁としてだけ残す。
// ASSISTANT_BOND_ACTIONSへ行動を足し引きしても、ここは自動で追随する
const ASSISTANT_BOND_DAILY_MAX = Object.values(ASSISTANT_BOND_ACTIONS).reduce((sum, a) => sum + (Number(a.dailyMax) || 0), 0);

// そのセリフが、いまの仲良し度で出せるか。bond を書いていなければどのLvでも出る
const assistantLineMatchesBond = (line, level) => {
  const b = line && line.bond;
  if (b == null) return true;
  const lv = Number.isFinite(level) ? level : ASSISTANT_BOND_MIN_LEVEL;
  if (Array.isArray(b)) {
    const lo = Number.isFinite(b[0]) ? b[0] : ASSISTANT_BOND_MIN_LEVEL;
    const hi = Number.isFinite(b[1]) ? b[1] : ASSISTANT_BOND_MAX_LEVEL;
    return lv >= lo && lv <= hi;
  }
  return Number.isFinite(b) ? lv >= b : true;
};

// ---------- 場面(scene) → 助手のセリフ ----------
// 画面側は <AssistantBubble scene="キー"/> で呼ぶ。
//   assistantId … だれが話すか(省略すると DEFAULT_ASSISTANT_ID)
//   lines       … セリフの候補。{ e:表情, t:セリフ } を5つ以上。開くたびに1つ選ぶ
//   when        … 条件つきのセリフ。画面から condition を渡したときは lines より優先する
//   detail      … タップで開く詳しい説明(文字列の配列)
//   help        … 'カテゴリid/項目id'。detail の代わりに、ヘルプ本文をそのまま詳細として開く
//
// バトル中・クイックの成長演出・供モンの加入演出には常設しない(テンポを止めないため)。
// バトル中の案内は「ステータス」やヘルプを開いたときだけ出す。
const ASSISTANT_SCENES = {
  // 日次案内は通常ログインとデバッグ再生で同じ scene を参照する。
  // 本文は下の addAssistantLinePack から合流するため、ここでは受け皿だけを定義する。
  dailyMasuAdvice: {
    help: 'basics/battle-modes',
    lines: [],
  },
  // セリフ本体は extremeChallengeGuide の束から合流する。
  extremeChallenge: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  extremeDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  nightmareDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  chaosDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  ultimateDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  infinityDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },

  // ---- はじめて ----
  onboarding: {
    help: 'basics/onboarding',
    lines: [
      { e:'happy',   t:'はじめまして、あたしはみゅあ！ これから一緒にモンスター育てていこ♪' },
      { e:'normal',  t:'まずは名前とアイコンを決めよ！ あとから変えられるから気楽でOK。' },
      { e:'excited', t:'どんな名前にする？ ランキングにも出るから、気に入ったやつがいいよ！' },
      { e:'wink',    t:'分かんないことがあったら、いつでもあたしに聞いてね♪' },
      { e:'happy',   t:'準備できたら冒険スタート！ あたしがちゃんと案内するから安心して。' },
    ],
  },

  // ---- ホーム ----
  home: {
    help: 'home/roster',
    lines: [
      { e:'happy',   t:'今日も育成いこー♪' },
      { e:'wink',    t:'何から始める？ あたしは神殿がおすすめかな！' },
      { e:'normal',  t:'マスモンのチェックも忘れずにね！' },
      { e:'happy',   t:'今日はどんな勇者モンが育つかな〜♪' },
      { e:'excited', t:'自己ベスト更新しちゃお！' },
      { e:'normal',  t:'編成を見直すだけでも、けっこう変わるよ。' },
      { e:'happy',   t:'ミッションとギフトも覗いてみよ！' },
    ],
    when: {
      // 始めたばかりの人へ。マスモンがまだ1体もいないとき
      firstRun: [
        { e:'excited', t:'いよいよ冒険スタート！ まずはバトルに挑んでみよ♪' },
        { e:'happy',   t:'最初は難易度Beginnerでじゅうぶん！ 気楽にいこ〜。' },
        { e:'wink',    t:'1回遊ぶとマスモンを登録できるよ。そこからが本番だね！' },
        { e:'normal',  t:'迷ったらバトル！ やってみるのが一番わかるよ。' },
        { e:'happy',   t:'あたしがついてるから大丈夫♪ いってらっしゃい！' },
      ],
      // 親密度Lvが上がった直後。次にHOMEを開いたときに1回だけ出る。
      // 呼び方が変わったことに、みゅあ自身が触れる
      bondUp: [
        { e:'excited', t:'ねえ、なんか前より話しやすくなったと思わない？ …これからは{name}って呼ぶね！', bond:3 },
        { e:'happy',   t:'{name}、これからもよろしくね♪ ちょっと距離が縮まった気がする！', bond:2 },
        { e:'wink',    t:'{name}、いっぱい遊んでくれてありがとう。あたし嬉しいよ〜♪' },
        { e:'excited', t:'{name}！ …うん、この呼び方しっくりくる♪', bond:5 },
        { e:'happy',   t:'{name}とだいぶ仲良くなれた気がする！ これからもよろしく♪', bond:4 },
        { e:'normal',  t:'{name}、いつもありがとう。あたし、ちゃんと見てるからね。' },
      ],
    },
  },

  // ---- バトルメニュー ----
  battleChallenge: {
    help: 'basics/battle-modes',
    lines: [
      { e:'happy',   t:'スコアを競うならチャレンジ！ 上のランキングタブも見てみて♪' },
      { e:'wink',    t:'強化の選び方でかなり変わるよ♪' },
      { e:'happy',   t:'終盤まで考えて強化しよ！' },
      { e:'excited', t:'自己ベスト更新いけそう！' },
      { e:'normal',  t:'難易度カードで虹のプシュケー報酬も見られるよ。' },
      { e:'wink',    t:'迷ったら弱いところを埋めるのがおすすめかな！' },
    ],
  },
  battleQuick: {
    help: 'basics/battle-modes',
    lines: [
      { e:'wink',    t:'テンポ重視ならこれ！' },
      { e:'happy',   t:'サクサク育成しちゃお♪' },
      { e:'normal',  t:'自動成長をうまく活かそう！' },
      { e:'wink',    t:'強化は選べないから、編成で勝負だね！' },
      { e:'happy',   t:'難易度カードで虹のプシュケー報酬もチェックできるよ♪' },
      { e:'excited', t:'経験値もダイヤも1.5倍！ おいしいじゃん♪' },
    ],
  },
  // プロモード。ベースモンだけで挑む上級者向けのモード
  battlePro: {
    help: 'basics/battle-modes',
    lines: [
      { e:'excited', t:'ここはベースモンだけの世界！ 腕の見せどころだよ♪' },
      { e:'wink',    t:'絆経験値3倍！ 新しい子を育てるなら断然ここ！' },
      { e:'happy',   t:'ブリーダー経験値も1.5倍だからね♪' },
      { e:'normal',  t:'育てたマスモンは連れていけないよ。素の力で勝負！' },
      { e:'wink',    t:'供モンは5体選んで、その中から3体が来てくれるの。誰が来るかはお楽しみ♪' },
      { e:'happy',   t:'上のランキングタブから、プロだけの記録を見られるよ♪' },
      { e:'excited', t:'勝てたら、その勇者モンはマスモンにできるよ！' },
      { e:'normal',  t:'きびしいけど、そのぶん伸びるモードだからね。' },
    ],
  },
  ranking: {
    help: 'basics/ranking',
    lines: [
      { e:'excited', t:'上位目指しちゃお！' },
      { e:'happy',   t:'みんな強いなぁ〜！' },
      { e:'wink',    t:'編成を見るだけでも勉強になるよ！' },
      { e:'normal',  t:'次はこの人を超えよう！' },
      { e:'happy',   t:'あと少しで順位アップかも！' },
      { e:'normal',  t:'難易度を切り替えると、狙い目が見えてくるよ。' },
    ],
  },

  // ランキングの行をタップして開く、編成の詳細
  rankingParty: {
    help: 'basics/ranking',
    lines: [
      { e:'happy',   t:'この人が使ってた編成だよ。色も染めたとおりに出てるの♪' },
      { e:'excited', t:'どの距離に置いてたかも分かるよ。真似してみる？' },
      { e:'normal',  t:'王冠が付いてるのが勇者モン。主役になった子だね。' },
      { e:'wink',    t:'絆レベルが高い子ほど、その人が大事に育ててる子だよ♪' },
      { e:'normal',  t:'染めた色が残るのは、この画面ができたあとの記録からだよ。' },
      { e:'surprise', t:'強い人の編成、けっこう参考になるでしょ？' },
    ],
  },

  // ---- ランの準備・進行(選択画面はコンパクト表示で使う) ----
  pickHero: {
    help: 'battle/hero-trait',
    lines: [
      { e:'normal',  t:'最初の1体は超大事！ 勇者特性を見て決めよ♪' },
      { e:'happy',   t:'今日はどの子でいく？ あたしはワクワクしてる！' },
      { e:'wink',    t:'固有技もチェックしてね。戦い方がガラッと変わるよ！' },
      { e:'excited', t:'育ってる子で挑むと、けっこう楽しいよ♪' },
      { e:'normal',  t:'迷ったら詳細を開いてみて。特性が決め手だね！' },
    ],
  },
  pickSlot: {
    help: 'battle/distance',
    lines: [
      { e:'wink',    t:'敵と同じ距離から殴ると強いよ！' },
      { e:'normal',  t:'得意な距離と、今の補正を見て置いてね。' },
      { e:'happy',   t:'ここ、地味に勝敗を分けるとこ！' },
      { e:'excited', t:'補正が高い距離に寄せると気持ちいいよ♪' },
      { e:'normal',  t:'置いた距離以外にも補正はかかるから、安心して選ぼ！' },
    ],
  },
  pickAlly: {
    help: 'battle/join-bonus',
    lines: [
      { e:'happy',   t:'仲間が増えるよ♪ どの子にする？' },
      { e:'wink',    t:'ステータスだけじゃなく、距離の補正も見てみて！' },
      { e:'excited', t:'ここで一気に強くなるチャンス！' },
      { e:'normal',  t:'足りない距離を埋めると安定するよ。' },
      { e:'happy',   t:'心強い仲間がきたら、あと半分いけそうじゃん♪' },
    ],
  },
  // プロモードだけの画面。始める前に供モンの候補を5体えらぶ
  pickProAllies: {
    help: 'basics/battle-modes',
    lines: [
      { e:'excited', t:'ここで選んだ子の中からしか来ないよ！ よく考えてね♪' },
      { e:'wink',    t:'合流のときに出るのは、この中からランダムで3体だけ！' },
      { e:'normal',  t:'誰が来てもいいように組むのがコツかな。' },
      { e:'happy',   t:'間合いをばらけさせておくと安心だよ♪' },
      { e:'troubled', t:'ぜんぶ同じ距離の子にすると、届かない相手が出ちゃうかも…。' },
      { e:'wink',    t:'ステータスの合流ボーナスも見ておいてね！' },
      { e:'happy',   t:'ベースモンだけだから、素の相性がそのまま出るよ。' },
    ],
  },
  pickTeaching: {
    help: 'growth/teaching',
    lines: [
      { e:'wink',    t:'同じ教えを重ねるとLv2に進化するよ！' },
      { e:'normal',  t:'今の強さを取るか、完成形を狙うか…作戦しだいだね。' },
      { e:'happy',   t:'あたしはとりあえず重ねる派♪' },
      { e:'excited', t:'進化するとけっこう跳ね上がるよ！' },
      { e:'normal',  t:'ブリーダーカードは効果が半減しないのが強いとこ！' },
    ],
  },
  rewardPick: {
    help: 'growth/awaken',
    lines: [
      { e:'happy',   t:'WAVEクリアおつかれ♪ トレーニングを2つえらぼ！' },
      { e:'wink',    t:'弱点を埋めるか、強みを伸ばすか…悩むとこだね！' },
      { e:'excited', t:'いい感じじゃーん♪ この調子でいこ！' },
      { e:'normal',  t:'同じトレーニングを2回えらんで、一気に伸ばすのもアリだよ♪' },
      { e:'happy',   t:'ここの積み重ねで終盤がラクになるよ！' },
    ],
  },
  // バトル中の案内。「ステータス」を開いたときだけ出す
  battleHelp: {
    help: 'battle/cards',
    lines: [
      { e:'wink',    t:'迷ったらまず解析！ 敵の必殺技が読めるよ。' },
      { e:'normal',  t:'いちばん効かせたいカードは、最初に置くのがコツ！' },
      { e:'happy',   t:'落ち着いていこ♪ ガードも立派な一手だよ。' },
      { e:'excited', t:'あと少しで勝てそう！ ここ踏ん張って！' },
      { e:'normal',  t:'ガッツが足りないときは、無理せず1枚だけでもOK。' },
    ],
  },

  // ---- リザルト(優勝・敗北・リタイアで切り替える) ----
  resultWin: {
    help: 'home/result',
    lines: [
      { e:'excited', t:'優勝おめでとー！ マジで最高♪' },
      { e:'happy',   t:'ナイス！ 育った勇者モンはマスモン登録しとこ！' },
      { e:'excited', t:'完璧じゃん♪ このまま上の難易度いっちゃう？' },
      { e:'happy',   t:'お疲れさま！ 報酬もしっかりもらっといてね。' },
      { e:'wink',    t:'今の編成、けっこう強かったね！ 覚えとこ♪' },
    ],
    when: {
      newRecord: [
        { e:'excited', t:'自己ベスト更新おめでとー！ やるじゃん♪' },
        { e:'excited', t:'記録更新きた〜！ ランキングもチェックしてみて！' },
        { e:'happy',   t:'新記録だよ！ この編成、当たりだったね♪' },
        { e:'excited', t:'すごっ！ 次はどこまで伸びるかな〜。' },
        { e:'happy',   t:'ベスト更新おめでと！ あたしも嬉しい♪' },
      ],
      // 通算ではじめての優勝
      firstWin: [
        { e:'excited', t:'はじめての優勝おめでとー！！ めちゃくちゃ嬉しい♪' },
        { e:'excited', t:'やった〜！ 記念すべき1勝目だね！' },
        { e:'happy',   t:'ついにクリアだね！ ここまでよく頑張ったよ♪' },
        { e:'surprise', t:'えっ、もう勝っちゃった！？ すごいじゃん！' },
        { e:'excited', t:'初優勝！ この子のこと、ちゃんと登録しとこ♪' },
      ],
      firstClear: [
        { e:'excited', t:'この難易度、初クリアだね！ おめでとー♪' },
        { e:'happy',   t:'初制覇きた〜！ 大きな一歩じゃん！' },
        { e:'excited', t:'やったね！ 次の難易度も見えてきたかも♪' },
        { e:'happy',   t:'はじめてのクリアおめでと！ ちゃんと強くなってるよ。' },
        { e:'wink',    t:'初クリア記念だね！ この勇者モン、大事にしよ♪' },
      ],
    },
  },
  resultLose: {
    help: 'home/result',
    when: {
      // 通算ではじめての敗北。落ち込ませないように
      firstLose: [
        { e:'troubled', t:'はじめての負けだね…。でも大丈夫、みんな通る道だよ！' },
        { e:'happy',    t:'負けても経験値は入るよ♪ ここからが本番！' },
        { e:'crying',   t:'くやしいね…。でもあたし、けっこう惜しかったと思う！' },
        { e:'normal',   t:'次はどこを直そっか？ 一緒に考えよ！' },
        { e:'wink',     t:'一回負けたくらいで終わらないよね？ リベンジいこ！' },
      ],
    },
    lines: [
      { e:'crying',   t:'今回はここまで…でも報酬はちゃんともらえるよ。' },
      { e:'troubled', t:'惜しかったね〜。次はいけそうな気がする！' },
      { e:'normal',   t:'負けても経験値は入るから、育て直してリベンジしよ！' },
      { e:'crying',   t:'うぅ、悔しい…！ でもここまで来たのはすごいよ。' },
      { e:'happy',    t:'切り替えていこ♪ 編成を変えると景色が変わるかも！' },
    ],
  },
  resultRetire: {
    help: 'home/result',
    lines: [
      { e:'troubled', t:'おつかれさま！ クリア済みWAVEぶんの報酬は入るよ。' },
      { e:'normal',   t:'休憩も大事だね。結果だけ確認しとこ！' },
      { e:'happy',    t:'また遊ぼ♪ 続きはいつでも待ってるよ。' },
      { e:'troubled', t:'今回はここまでだね。もらえるものはもらっとこ！' },
      { e:'wink',     t:'仕切り直しもアリだよ。次いってみよ！' },
    ],
  },

  // ---- スキップチケット ----
  skipPick: {
    help: 'items/skip-ticket',
    lines: [
      { e:'wink',    t:'スキップで一気に育成♪ 使う枚数も選べるよ！' },
      { e:'happy',   t:'時間ないときの味方だね！' },
      { e:'normal',  t:'勇者モンと供モンを決めたら、あとはおまかせ！' },
      { e:'excited', t:'まとめて使うと、もらえる量もどーんと増えるよ♪' },
      { e:'normal',  t:'ランキングには残らないから、そこだけ覚えといてね。' },
    ],
  },
  skipResult: {
    help: 'items/skip-ticket',
    lines: [
      { e:'happy',   t:'受け取り完了♪ 一気に育ったね！' },
      { e:'excited', t:'おおっ、ごっそり入ったじゃん！' },
      { e:'normal',  t:'スキップ分はランキングとクリア回数には入らないよ。' },
      { e:'wink',    t:'育成が進んだね！ 次のバトルが楽しみ♪' },
      { e:'happy',   t:'お疲れさま！ 増えたぶん、確認してみて。' },
    ],
  },

  // ---- M/B管理・モンスター一覧 ----
  mbManagement: {
    help: 'home/roster',
    lines: [
      { e:'normal',  t:'編成もベースモンもマスモンも、ここから見られるよ。' },
      { e:'wink',    t:'解放しただけじゃ出てこないから、編成に入れてね！' },
      { e:'happy',   t:'最後に「決定」まで押すのを忘れずに♪' },
      { e:'normal',  t:'ブリーダーカードの編成もここからだよ。' },
      { e:'excited', t:'マスモン詳細から強化・トレーニング・染色へ直行できるよ！' },
    ],
  },
  // 編成(モンスター編成・ブリーダーカード編成)
  roster: {
    help: 'home/roster',
    lines: [
      { e:'happy',   t:'編成タイム♪ 誰を連れていく？' },
      { e:'wink',    t:'最後に「決定」まで押さないと反映されないよ！' },
      { e:'normal',  t:'距離のバランスを見ると、けっこう安定するよ。' },
      { e:'excited', t:'この編成、いい感じじゃーん♪' },
      { e:'normal',  t:'ブリーダーカードのほうも忘れずにね！' },
    ],
  },
  monsterList: {
    help: 'home/roster',
    lines: [
      { e:'normal',  t:'ベースモンは種類の基本、マスモンは育てた個体だよ。' },
      { e:'happy',   t:'見たい方を選んでね♪' },
      { e:'wink',    t:'気になる子は詳細を開いてみて。特性が面白いよ！' },
      { e:'normal',  t:'間合い適性は、ここからでも確認できるよ。' },
      { e:'excited', t:'新しい子が増えると、編成の幅が広がるね！' },
    ],
  },
  masuList: {
    help: 'masu/masumon',
    lines: [
      { e:'happy',   t:'育てたマスモンが並んでるよ♪' },
      { e:'wink',    t:'詳細を開くと、強化・トレーニング・染色へすぐ進めるよ♪' },
      { e:'excited', t:'その勇者モン、結構育ってきたね！' },
      { e:'normal',  t:'固有技ポイントが残ってたら、詳細から好きな技に使えるよ。' },
      { e:'happy',   t:'重トレーニングチケットがあるなら、育成を一気に進めるのもアリ！' },
    ],
  },
  masuEnhance: {
    help: 'masu/enhance',
    lines: [
      { e:'wink',    t:'ポイントは適性か能力値に使えるよ♪' },
      { e:'normal',  t:'得意な戦い方に合わせて伸ばそ！' },
      { e:'happy',   t:'まとめて強化もできるから、ラクだよ〜。' },
      { e:'excited', t:'一気に振ると強くなった感すごいよ♪' },
      { e:'normal',  t:'迷ったら、よく使う距離の適性から上げるのがおすすめかな！' },
    ],
  },

  // ---- 神殿 ----
  temple: {
    lines: [
      { e:'normal',  t:'再生・合体・寄付、今日はどれにする？' },
      { e:'happy',   t:'再生なら、ベースモンの性能を見てから選べるよ♪' },
      { e:'wink',    t:'取り返せない操作もあるから、よく確認してね♪' },
      { e:'normal',  t:'じっくり考えて決めよ！' },
      { e:'happy',   t:'合体で育てるか、寄付で整理するか…迷うね！' },
    ],
  },
  fusion: {
    help: 'masu/fusion',
    lines: [
      { e:'troubled', t:'「主」が残って「副」は消えるよ。確認してね！' },
      { e:'normal',   t:'副の絆経験値が、まるごと主に足されるよ。' },
      { e:'wink',     t:'固有技を引き継ぐなら、副を絆Lv.30まで育ててね！' },
      { e:'troubled', t:'消える子は戻せないから、ゆっくり選ぼ。' },
      { e:'happy',    t:'うまくいくと一気に育つよ♪ でも確認は大事！' },
    ],
  },
  rebirth: {
    help: 'masu/rebirth',
    lines: [
      { e:'excited', t:'上限まで育てたごほうびだね♪' },
      { e:'happy',   t:'レベルはそのまま、上限だけ＋5だよ！' },
      { e:'wink',    t:'固有技も1つ上がるから、迷わずいこ！' },
      { e:'excited', t:'星が増えるのもテンション上がるじゃん♪' },
      { e:'normal',  t:'コストを確認したら、いってみよ！' },
    ],
  },
  reincarnate: {
    help: 'masu/reincarnate',
    lines: [
      { e:'excited',  t:'Lv.100まで育てた子だけの特別なやつ！' },
      { e:'happy',    t:'レベルは99ぶん返すけど、強化を全部振り直せるよ♪' },
      { e:'normal',   t:'上限はそのままだから、また同じところまで登れるよ。' },
      { e:'wink',     t:'強化ポイントが＋10されるのがおいしいとこ！' },
      { e:'troubled', t:'いま振ってる強化は白紙に戻るから、そこだけ覚えといてね。' },
    ],
  },
  donation: {
    help: 'masu/donation',
    lines: [
      { e:'troubled', t:'寄付したマスモンは戻せないよ…。' },
      { e:'happy',    t:'まとめて選べるよ♪ 総合力順に並べると整理しやすいかも！' },
      { e:'normal',   t:'選んだ数と合計報酬を見てから寄付できるよ。' },
      { e:'wink',     t:'総合力の高い順・低い順は、ボタンひとつで切り替えられるよ♪' },
      { e:'troubled', t:'編成を維持できなくなる子は選べないからね。' },
    ],
  },

  // ---- ホームの各機能 ----
  pasture: {
    help: 'home/pasture',
    lines: [
      { e:'happy',   t:'お気に入りを最大5体までHOMEに出せるよ♪' },
      { e:'wink',    t:'強さには影響しないから、見た目で選んでOK！' },
      { e:'excited', t:'みんな歩いてるとこ見るの、かわいくない？' },
      { e:'normal',  t:'気分で入れ替えても大丈夫だよ。' },
      { e:'happy',   t:'今日の推しメン、誰にする？' },
    ],
  },
  market: {
    help: 'home/market',
    lines: [
      { e:'excited', t:'お買い物タイム♪ 何にする？' },
      { e:'normal',  t:'アイコンはpt、ほかはダイヤだよ。' },
      { e:'wink',    t:'買ったモンやカードは、編成に入れるのも忘れずに！' },
      { e:'happy',   t:'ダイヤは大事に使ってね♪' },
      { e:'excited', t:'新しい仲間、増やしちゃう？' },
    ],
    when: {
      // 一番安い商品にも手が届かないとき
      lowGold: [
        { e:'troubled', t:'ダイヤがちょっと心もとないかも…！' },
        { e:'normal',   t:'バトルで稼いでからまた来よ！ 逃げないから大丈夫。' },
        { e:'troubled', t:'今日は見るだけにしとく？ next timeってことで♪' },
        { e:'wink',     t:'寄付でもダイヤになるよ。無理はしないでね！' },
        { e:'happy',    t:'欲しいものメモっといて、貯まったら来よ〜。' },
      ],
    },
  },
  inventory: {
    help: 'items/items',
    lines: [
      { e:'normal',  t:'持ってるアイテムはここ！' },
      { e:'wink',    t:'効果と使う相手を見て、ベストなタイミングで使ってね♪' },
      { e:'happy',   t:'貯めすぎても意味ないから、使っちゃお！' },
      { e:'normal',  t:'絆ポイントリセットの書は、振り直したいときに便利だよ。' },
      { e:'excited', t:'使いどころがハマると気持ちいいよね♪' },
    ],
  },

  // ---- ギフト(未受取の有無で切り替える) ----
  giftClaimable: {
    help: 'items/gift',
    lines: [
      { e:'surprise', t:'ギフト届いてるよ！ 受け取っちゃお♪' },
      { e:'excited',  t:'おっ、なんか来てる！ 中身みてみて！' },
      { e:'happy',    t:'30日で期限切れになるから、今のうちにね！' },
      { e:'surprise', t:'未受取があるよ〜！ もったいないよ！' },
      { e:'wink',     t:'まとめて受け取っちゃお♪' },
    ],
  },
  giftEmpty: {
    help: 'items/gift',
    lines: [
      { e:'normal',  t:'今は未受取なし！ きれいさっぱりだね。' },
      { e:'happy',   t:'ログボやミッション報酬が届いたら、ここに入るよ♪' },
      { e:'normal',  t:'受け取り済みの履歴もここで見られるよ。' },
      { e:'wink',    t:'明日また覗いてみて！ 何か届いてるかも♪' },
      { e:'happy',   t:'からっぽってことは、ちゃんと受け取れてる証拠だね！' },
    ],
  },

  // ---- ミッション(受取可能な報酬の有無で切り替える) ----
  missionsClaimable: {
    help: 'items/missions',
    lines: [
      { e:'excited', t:'達成報酬あるよ〜！ 受け取っちゃお♪' },
      { e:'happy',   t:'ナイス達成！ まとめて受け取れるよ。' },
      { e:'surprise', t:'受け取り忘れてない？ ここにあるよ！' },
      { e:'excited', t:'いい感じじゃーん♪ ギフトボックスもチェックしてね！' },
      { e:'wink',    t:'受け取ったらギフトに届くよ。忘れずにね！' },
    ],
    when: {
      allDone: [
        { e:'excited', t:'ぜんぶ達成！ コンプリート報酬もゲットしちゃお♪' },
        { e:'excited', t:'パーフェクトじゃん！ すごすぎ！' },
        { e:'happy',   t:'全達成おめでと〜！ 今日はよく頑張ったね♪' },
        { e:'wink',    t:'コンプリート報酬、忘れずに受け取ってね！' },
        { e:'excited', t:'完璧！ あたしも鼻が高いよ〜♪' },
      ],
    },
  },
  missionsNormal: {
    help: 'items/missions',
    lines: [
      { e:'happy',   t:'デイリーとウィークリーを進めよ♪' },
      { e:'normal',  t:'全部達成でコンプリート報酬もあるよ！' },
      { e:'wink',    t:'バトルするだけで進むやつも多いよ。気楽にね！' },
      { e:'excited', t:'あと少しで達成のやつ、ない？' },
      { e:'normal',  t:'デイリーは毎日、ウィークリーは毎週リセットだよ。' },
    ],
  },

  // ---- プロフィール・設定・ヘルプ ----
  profile: {
    help: 'home/profile',
    lines: [
      { e:'normal',  t:'名前・アイコン・これまでの記録はここ！' },
      { e:'happy',   t:'自分らしいプロフィールにしよ♪' },
      { e:'wink',    t:'アイコンはptで買えるよ。集めるの楽しいよね！' },
      { e:'excited', t:'記録を見返すと、成長がわかって面白いよ♪' },
      { e:'normal',  t:'名前はいつでも変えられるから安心して。' },
    ],
  },
  settings: {
    help: 'tips/settings',
    lines: [
      { e:'normal',  t:'音量やBGMはここで調整できるよ。' },
      { e:'wink',    t:'BGMアレンジで曲の雰囲気も変えられるよ♪' },
      { e:'troubled', t:'引き継ぎコード、ときどき控えておくと安心だよ！' },
      { e:'happy',   t:'好みの音量にして、快適に遊ぼ♪' },
      { e:'normal',  t:'バックアップは大事。取っておいて損はないよ。' },
    ],
  },
  helpTop: {
    lines: [
      { e:'happy',   t:'分からないことはあたしに任せて♪' },
      { e:'wink',    t:'気になるカテゴリを選んで、吹き出しもタップしてみて！' },
      { e:'normal',  t:'困ったらここ！ だいたいのことは書いてあるよ。' },
      { e:'excited', t:'攻略のコツもまとめてあるよ〜♪' },
      { e:'happy',   t:'一緒に強くなろ！ 分からないとこ、つぶしていこ！' },
    ],
    detail: [
      'このヘルプは「カテゴリ → 項目 → 説明」の3段階になってるよ。',
      'まずは下のカテゴリから、気になるものをタップしてね。次に項目を選ぶと、詳しい説明が出るよ。',
      'あたしの吹き出しは、開いてるページごとに内容が変わるんだ。タップすると、そのページの詳しい説明をここに出せるよ♪',
      '右上のあたしのボタンで、吹き出しを閉じたり出したりできるよ。',
    ],
  },
};

// ---------- あとから足すセリフ束 ----------
// ASSISTANT_SCENES の lines へ、読み込み時に合流させるセリフのまとまり。
// 場面の定義そのものを書き換えずにセリフだけ増やせるので、
// 親密度ぶんのセリフも、あとで足すイベント・季節限定のセリフも、ここへ1束足すだけで済む。
//
// 【束の書き方】
//   { id:'一意な名前', label:'画面には出ない説明', when:()=>真偽(省略可), lines:{ 場面キー:[ …セリフ… ] } }
//   when を書くと、その束は条件を満たすときだけ合流する(例: お正月・誕生日)。
//   when は読み込み時に1回だけ見るので、日付のような「起動中は変わらないもの」に使う。
//
// 【セリフの書き方】
//   { e:表情, t:'本文', bond:親密度条件, w:出やすさ }
//     bond … 3 なら Lv3以上、[1,2] なら Lv1〜2のあいだだけ。書かなければどのLvでも出る
//     w    … 省略すると1。0.25 のように小さくすると「たまにしか出ない」セリフになる
//     t の中の {name} は、そのときの呼び方(さん付け・呼び捨て・ちん付け)に置き換わる
const ASSISTANT_LINE_PACKS = [];

// 束を1つ足す。読み込み順は問わない(合流は下の applyAssistantLinePacks でまとめて行う)
const addAssistantLinePack = (pack) => { if (pack && pack.id && (pack.lines || pack.conditions)) ASSISTANT_LINE_PACKS.push(pack); };

// 極限チャレンジ。モード選択(extremeChallenge)ではモード全体に共通する特徴を案内し、
// EXTREME固有の倍率やブリーダーカード50%は難易度側(extremeDifficulty)でだけ触れる。
addAssistantLinePack({
  id: 'extremeChallengeGuide',
  label: '極限チャレンジ案内',
  lines: {
    extremeChallenge: [
      { e:'excited', t:'ここから先は極限チャレンジ！ チャレンジよりずっと手強いよ♪' },
      { e:'happy', t:'育てたモンスターの本気を試すなら、極限チャレンジだね！' },
      { e:'troubled', t:'名前どおり極限！ 生半可な育成じゃ厳しいかも！' },
      { e:'wink', t:'上位プレイヤー向けの腕試しだよ。強敵との勝負、燃えるじゃん♪' },
      { e:'normal', t:'チャレンジモードのさらに上！ 無理そうなら育成して出直すのも作戦だよ。' },
      { e:'excited', t:'専用ランキングもあるよ！ 育てた子の本気を記録に残そ♪' },
      { e:'surprise', t:'EXTREMEの先にも、さらに上の難易度が待ってるんだって！' },
      { e:'happy', t:'手強くなるほど高い報酬も狙えるよ。育てた子と一緒に限界へ挑も♪' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'EXTREMEはブリーダーカードの効果が半分！ いつもの感覚だと危ないよ！' },
      { e:'surprise', t:'敵強度はなんと×13！ 育てた子の本気を見せるときだね！' },
      { e:'excited', t:'虹のプシュケー報酬と全WAVE詳細、挑む前に見ておこ♪' },
      { e:'wink', t:'ここはEXTREME！ 準備できてるなら、思いっきりいこ！' },
      { e:'normal', t:'厳しそうなら無理しなくてOK。もうひと育成してから挑むのもアリだよ。' },
      { e:'happy', t:'EXTREMEへの挑戦、あたしも応援してる！ ベストを尽くそ♪' },
    ],
  },
});

// 極限チャレンジの難易度カードごとの案内。解放状態にかかわらず、中央のカードに合わせて使う。
addAssistantLinePack({
  id: 'extremeDifficultyGuides',
  label: '極限チャレンジ難易度別案内',
  lines: {
    nightmareDifficulty: [
      { e:'surprise', t:'NIGHTMAREはEXTREMEの次の高難易度！ さらに手強い悪夢が待ってるよ。' },
      { e:'troubled', t:'NIGHTMAREでは、有利な補正が弱くなるの。' },
      { e:'surprise', t:'不利な補正はもっと重くなるよ。特殊ルールの3項目を見ておこ！' },
      { e:'normal', t:'距離適性がいつも以上に大事になるよ。編成をじっくり考えよう。' },
      { e:'wink', t:'全WAVE詳細で敵の順番を見て、WAVEごとの戦い方を組み立てておこ♪' },
      { e:'excited', t:'有利と不利で補正のかかり方が違うよ。作戦を練って挑も！' },
    ],
    chaosDifficulty: [
      { e:'surprise', t:'CHAOSは敵の強さが一気に×20！ 本当に極限の戦いだね！' },
      { e:'normal', t:'NIGHTMAREを1回クリアするとCHAOSへ挑めるよ。' },
      { e:'excited', t:'CHAOSはスコア×20、経験値×35、ダイヤ×15！ 報酬もすごいよ！' },
      { e:'troubled', t:'与ダメージと加入ボーナスは半分、消費ガッツは1.5倍。慎重にいこ！' },
      { e:'wink', t:'CHAOSクリアで虹のプシュケー50個！ あたしも全力で応援するよ♪' },
    ],
    ultimateDifficulty: [
      { e:'surprise', t:'ULTIMATEは敵強度×35！ CHAOSをクリアした猛者だけの究極戦だよ！' },
      { e:'normal', t:'累計ターンが増えるほど、次WAVEの敵は強く、加入ボーナスは低くなるよ。' },
      { e:'excited', t:'スコア×20、経験値×40、ダイヤ×20！ 虹のプシュケーは60個だよ♪' },
      { e:'troubled', t:'トレーニングもWAVEのターン数で低下するから、素早い勝利が大切だね。' },
      { e:'wink', t:'35ターンごとの段階的なDISTANCE BREAKに備えて、いろんな距離で戦お♪' },
    ],
    infinityDifficulty: [
      { e:'excited', t:'最後に待ってるのはINFINITY…いつか挑める日が楽しみだね！' },
      { e:'surprise', t:'INFINITYって無限ってこと！？ どんな難易度になるんだろ。' },
      { e:'normal', t:'INFINITYの詳細はまだ秘密。いちばん奥で待ってるみたい。' },
      { e:'troubled', t:'極限の果てがINFINITYかぁ…想像するだけで緊張しちゃう！' },
      { e:'wink', t:'いつかこのカードで挑戦できる日まで、育成を楽しも♪' },
    ],
  },
});

// ===== 親密度ぶんのセリフ(HOME) =====
addAssistantLinePack({
  id: 'dailyMasuAdvice',
  label: '日次・マスモン登録アドバイス',
  lines: {
    dailyMasuAdvice: [
      { e:'wink', t:'マスモンを早く増やしたいなら、いい方法があるよ♪' },
      { e:'happy', t:'クイックのBeginnerでWAVE2まで進んだら、\n「あきらめる」を選んでみて！' },
      { e:'excited', t:'これが今のところ、マスモンを一番早く登録できる方法だよ♪' },
      { e:'normal', t:'WAVE2まで進むのがポイント！ そこから登録できるよ。' },
      { e:'wink', t:'短い時間で仲間を増やしたいときに試してみてね♪' },
    ],
  },
});

addAssistantLinePack({
  id: 'bondHome',
  label: '親密度・HOME',
  lines: {
    home: [
      // Lv1〜2: さん付け。少していねいで、初対面の距離感
      { e:'happy',    t:'{name}、今日もよろしくお願いします♪', bond:[1,2] },
      { e:'normal',   t:'{name}、まずは編成の確認からいきましょ！', bond:[1,2] },
      { e:'wink',     t:'分からないことがあったら、いつでも聞いてくださいね♪', bond:[1,2] },
      { e:'happy',    t:'{name}のペースで大丈夫だよ！ ゆっくりいこ。', bond:[1,2] },
      { e:'excited',  t:'今日はどこから行きます？ あたしは神殿がおすすめ！', bond:[1,2] },
      { e:'normal',   t:'HOMEの建物、ぜんぶ触ってみると発見があるかも。', bond:[1,2] },
      { e:'happy',    t:'{name}、いい感じに育ってきてますね♪', bond:[1,2] },
      { e:'wink',     t:'{name}、いい感じじゃん♪ その調子！', bond:2 },
      // Lv3〜4: 呼び捨て。雑談が増える
      { e:'happy',    t:'{name}、今日はどこ行く？', bond:[3,4] },
      { e:'excited',  t:'{name}、その育成いい感じ！ センスあるね〜', bond:[3,4] },
      { e:'normal',   t:'なんか今日、いつもより調子よさそう。気のせい？', bond:[3,4] },
      { e:'normal',   t:'ねえ{name}、そろそろ編成いじってみない？', bond:[3,4] },
      { e:'happy',    t:'おかえり！ 今日は何する？', bond:[3,4] },
      { e:'happy',    t:'{name}なら大丈夫だって！ いってらっしゃい♪', bond:4 },
      { e:'wink',     t:'今日も楽しもう！ 難しく考えなくていいよ。', bond:4 },
      { e:'excited',  t:'あたし、{name}の作るチーム見るの好きなんだよね〜', bond:4 },
      // Lv5: 特別感。ただし馴れ馴れしくはしない
      { e:'excited',  t:'{name}、おかえり〜♪ 待ってたよ！', bond:5 },
      { e:'happy',    t:'{name}、今日も一緒に頑張ろ！', bond:5 },
      { e:'wink',     t:'{name}が来ると、なんか安心するんだよね〜', bond:5 },
      { e:'happy',    t:'今日はどうする？ {name}が決めていいよ！', bond:5 },
      { e:'excited',  t:'{name}とここまで来たんだなぁって、たまに思う♪', bond:5, w:0.4 },
      { e:'normal',   t:'{name}、無理はしないでね。あたしはずっとここにいるから。', bond:5, w:0.4 },
      // どのLvでも出る、村のようすや案内
      { e:'normal',   t:'マスモンの絆レベル、こまめに見てあげてね。' },
      { e:'happy',    t:'ギフト届いてないかな？ たまに覗いてみて！' },
      { e:'wink',     t:'ミッションの達成状況もチェックしとこ♪' },
      { e:'excited',  t:'新しい円盤石、マーケットに来てるかも！' },
      { e:'normal',   t:'放牧に出したマスモン、村を歩いてるよ。見た？' },
      { e:'happy',    t:'更新履歴、たまに読むと新しい発見があるかも！' },
      { e:'normal',   t:'今日のぶんのログインボーナス、受け取った？' },
      { e:'troubled', t:'ダイヤ、使いどころ迷うよね〜。あたしも迷う。', w:0.5 },
      { e:'happy',    t:'ちょっと休憩するのも大事だよ。ゲームは逃げないからね！', w:0.5 },
      // たまにしか出ない、ひとりごとみたいなセリフ
      { e:'surprise', t:'あ、いま向こうでマスモンが転んだ気がする…気のせいかな？', w:0.25 },
      { e:'wink',     t:'ひみつだけど、あたし雨の日の村がいちばん好きなんだよね♪', w:0.25 },
    ],
  },
});

// ===== 親密度ぶんのセリフ(HOME・Lv6以降) =====
// Lv6からは呼び方が自動で変わらなくなる代わりに、プレイヤーが自分で選べるようになる。
// そのぶん、呼び方の変化に頼らず「どれだけ一緒にやってきたか」を話の中身で示す
addAssistantLinePack({
  id: 'bondHomeHighLevel',
  label: '親密度・HOME(Lv6以降)',
  lines: {
    home: [
      { e:'excited', t:'{name}、呼び方あたし任せじゃなく自分で選べるようになったよ♪', bond:6 },
      { e:'happy',   t:'{name}とは息ぴったり！ 言わなくても分かる気がする。', bond:7 },
      { e:'wink',    t:'{name}になら、なんでも話せる気がするよ♪', bond:8 },
      { e:'excited', t:'{name}とはもう戦友だね！ 一緒に乗り越えよ♪', bond:9 },
      { e:'happy',   t:'{name}とはいい腐れ縁になってきたかも(笑)', bond:10 },
      { e:'wink',    t:'{name}の次の一手、なんとなく分かるようになってきたよ♪', bond:11 },
      { e:'excited', t:'{name}みたいな人、あたしには他にいないよ♪', bond:12 },
      { e:'happy',   t:'{name}と一緒だと、なんか一心同体って感じ♪', bond:13 },
      { e:'excited', t:'{name}とあたし、伝説のコンビになれそう♪', bond:14 },
      { e:'wink',    t:'{name}とは運命共同体だと思ってる♪', bond:15 },
      { e:'happy',   t:'{name}が困ってたら、あたし絶対気づくからね！', bond:16 },
      { e:'excited', t:'{name}は、あたしの生涯のパートナーって感じ♪', bond:17 },
      { e:'happy',   t:'{name}は、あたしのかけがえのない存在だよ♪', bond:18 },
      { e:'wink',    t:'{name}のことなら、あたしがいちばん分かってるよ♪', bond:19 },
      { e:'excited', t:'{name}とはこれからもずっと一緒！ 永遠の相棒だよ♪', bond:20 },
    ],
  },
});

// ===== 親密度ぶんのセリフ(バトル・ランキング) =====
addAssistantLinePack({
  id: 'bondBattle',
  label: '親密度・バトルとランキング',
  lines: {
    battleChallenge: [
      { e:'happy',    t:'{name}、無理のない難易度から行きましょ♪', bond:[1,2] },
      { e:'normal',   t:'チャレンジはスコアが残ります。落ち着いていきましょ！', bond:[1,2] },
      { e:'wink',     t:'負けても失うものは無いので、気楽にどうぞ♪', bond:[1,2] },
      { e:'excited',  t:'{name}の初めての記録、楽しみにしてますね！', bond:[1,2] },
      { e:'normal',   t:'{name}、まずは自己ベストの更新を狙いましょ！', bond:[1,2] },
      { e:'happy',    t:'{name}、いい編成できてるじゃん♪ いけると思う！', bond:2 },
      { e:'excited',  t:'{name}、今日は上の難易度いってみない？', bond:[3,4] },
      { e:'happy',    t:'{name}のスコア、そろそろ伸びどきだと思うんだよね〜', bond:[3,4] },
      { e:'normal',   t:'距離の合わせ方さえハマれば、一気に伸びるよ。', bond:[3,4] },
      { e:'wink',     t:'あたし、{name}が本気出すとこ見たいな♪', bond:4 },
      { e:'happy',    t:'{name}なら大丈夫。いつもどおりでいこ！', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ ここで見てるからね♪', bond:5 },
      { e:'happy',    t:'{name}、今日も一緒に記録更新しよ！', bond:5 },
      { e:'wink',     t:'{name}のスコア、あたしが誰よりも覚えてるからね♪', bond:5, w:0.5 },
      { e:'normal',   t:'難易度が上がるほど、敵もスコアも大きくなるよ。' },
      { e:'happy',    t:'自己ベストは難易度ごとに別々に記録されるんだ。' },
      { e:'normal',   t:'倒しきれなくても、進んだWAVEぶんの報酬はもらえるよ。' },
      { e:'wink',     t:'ガッツの残しかたで、終盤の粘りが変わるからね！' },
      { e:'excited',  t:'ブリーダーの教え、拾いどきを間違えないようにね♪' },
      { e:'normal',   t:'勇者モンの固有技、レベル上げると化けるよ。' },
      { e:'troubled', t:'ムーは強いよ…。でも倒せない相手じゃないから！' },
      { e:'happy',    t:'編成が決まらないときは、間合いのバランスから見てみて。' },
      { e:'surprise', t:'会心が続くときって、なんか気持ちいいよね〜', w:0.3 },
      { e:'normal',   t:'負けたときこそ、次に何を変えるかが大事だと思うんだ。', w:0.5 },
    ],
    battleQuick: [
      { e:'happy',    t:'{name}、サクッと回したいときはこっちですね♪', bond:[1,2] },
      { e:'normal',   t:'クイックはランキングに乗らないので、気楽にどうぞ！', bond:[1,2] },
      { e:'wink',     t:'{name}、育成したい子を連れていきましょ♪', bond:[1,2] },
      { e:'excited',  t:'{name}、今日はどの子を育てる？', bond:[3,4] },
      { e:'happy',    t:'{name}、周回はほどほどにね。疲れちゃうから！', bond:[3,4] },
      { e:'wink',     t:'{name}、あたしも一緒に数えててあげる♪', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ 何周でも付き合うよ〜', bond:5 },
      { e:'happy',    t:'{name}、無理して回さなくていいからね。', bond:5, w:0.5 },
      { e:'normal',   t:'クイックはWAVEごとに味方が自動で強くなるよ。' },
      { e:'happy',    t:'経験値とダイヤは1.5倍！ 育成にはぴったりだね♪' },
      { e:'normal',   t:'スキップチケットはこっちのモードでだけ使えるよ。' },
      { e:'wink',     t:'固有技もひとりでに伸びるから、放っておいても育つよ♪' },
      { e:'normal',   t:'チャレンジの自己ベストは、こっちでは動かないから安心して。' },
      { e:'happy',    t:'まとめて育てたいときは、絆を伸ばしたい子を勇者モンに！' },
    ],
    battlePro: [
      { e:'normal',   t:'{name}、プロはベースモンだけです。慣れてからでも遅くないですよ！', bond:[1,2] },
      { e:'happy',    t:'{name}、育てたい子を勇者モンにすると伸びが早いですよ♪', bond:[1,2] },
      { e:'wink',     t:'{name}、供モンは5体選んでくださいね。3体が加わります♪', bond:[1,2] },
      { e:'excited',  t:'{name}、そろそろプロに挑んでみない？', bond:[3,4] },
      { e:'happy',    t:'{name}、素の力だけで勝つの、かっこいいと思うんだよね〜', bond:[3,4] },
      { e:'wink',     t:'{name}のプロの記録、あたしが見届けてあげる♪', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ ここが一番燃えるところだよ！', bond:5 },
      { e:'happy',    t:'{name}なら、この難しさも楽しめると思うんだ。', bond:5, w:0.5 },
      { e:'normal',   t:'マスモンは連れていけないよ。全員ベースモンからのスタート！' },
      { e:'excited',  t:'絆経験値は3倍！ 新しい子を一気に育てられるよ♪' },
      { e:'happy',    t:'ブリーダー経験値も1.5倍。ちょっとお得だね！' },
      { e:'normal',   t:'ダイヤとスコアの倍率は、難易度どおりだよ。' },
      { e:'wink',     t:'ランキングはチャレンジと別枠。プロの人たちと勝負だね！' },
      { e:'normal',   t:'勇者モンにした子は、勝ったあとマスモンに登録できるよ。' },
      { e:'troubled', t:'強化の拾いかたを間違えると、あっという間に押されちゃうよ…。' },
      { e:'happy',    t:'供モンの候補は、間合いをばらけさせておくと安心かな♪' },
      { e:'normal',   t:'誰が加わるかはランダム。5体ぜんぶ使える子にしておこう。' },
      { e:'surprise', t:'ベースモンだけでムーを倒す人、ほんとにいるんだよ〜', w:0.3 },
    ],
    ranking: [
      { e:'happy',    t:'{name}、まずは上位の編成を見てみましょ♪', bond:[1,2] },
      { e:'normal',   t:'順位は気にしすぎなくて大丈夫ですよ！', bond:[1,2] },
      { e:'excited',  t:'{name}の名前、そのうちここに載りますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、上の人の編成けっこう参考になるよ！', bond:[3,4] },
      { e:'wink',     t:'{name}なら、あの辺までいけると思うけどな〜', bond:[3,4] },
      { e:'excited',  t:'{name}の名前、探しちゃった♪', bond:4 },
      { e:'happy',    t:'{name}が上に行くの、あたしが一番楽しみにしてるからね！', bond:5 },
      { e:'wink',     t:'{name}の記録、ぜんぶ覚えてるよ♪', bond:5, w:0.5 },
      { e:'normal',   t:'スコアは難易度ごとに分かれてるよ。' },
      { e:'happy',    t:'ブリーダーLvは、同じ名前でいちばん高い記録がまとまって出るよ。' },
      { e:'normal',   t:'絆Lvはモンスターの種類ごとに切り替えられるんだ。' },
      { e:'wink',     t:'上位の人の編成、タップすると詳しく見られるよ♪' },
      { e:'normal',   t:'ランキングはチャレンジ・プロ・極限チャレンジで別々だよ。' },
      { e:'surprise', t:'このスコア、どうやって出したんだろ…気になるね！', w:0.3 },
    ],
  },
});

// ===== 親密度ぶんのセリフ(神殿・育成・マーケット) =====
addAssistantLinePack({
  id: 'bondGrow',
  label: '親密度・神殿と育成',
  lines: {
    temple: [
      { e:'happy',    t:'{name}、神殿へようこそ♪ ここは育成の土台になる場所です。', bond:[1,2] },
      { e:'normal',   t:'合体・転生・寄付ができますよ。ゆっくり選んでくださいね。', bond:[1,2] },
      { e:'wink',     t:'{name}、迷ったら合体から試してみましょ♪', bond:[1,2] },
      { e:'troubled', t:'寄付だけは取り消せないので、そこだけ気をつけて…！', bond:[1,2] },
      { e:'excited',  t:'{name}、そろそろ転生も見えてきたんじゃない？', bond:2 },
      { e:'happy',    t:'{name}、今日は誰を合体させる？', bond:[3,4] },
      { e:'normal',   t:'{name}のこだわり編成、けっこう好きなんだよね〜', bond:[3,4] },
      { e:'excited',  t:'{name}、思いきって転生しちゃお！ あたしが見ててあげる♪', bond:[3,4] },
      { e:'wink',     t:'{name}、そのマスモン大事にしてるでしょ。分かるよ〜', bond:4 },
      { e:'happy',    t:'{name}、この子とはずいぶん長いよね。', bond:5, w:0.5 },
      { e:'excited',  t:'{name}、今日はどんな子ができるかな♪ わくわくする！', bond:5 },
      { e:'normal',   t:'{name}が悩んでるとき、あたしは黙って待ってるからね。', bond:5, w:0.4 },
      { e:'normal',   t:'合体は主と副を選ぶよ。主の見た目と名前が残るんだ。' },
      { e:'happy',    t:'副にした子の絆レベルは、経験値になって主へ引き継がれるよ。' },
      { e:'normal',   t:'固有技の引き継ぎは、両方が絆Lv.10以上のときだけできるよ。' },
      { e:'wink',     t:'転生すると星が1つ増えて、レベル上限も上がるんだ♪' },
      { e:'normal',   t:'転生してもマスモンの名前と見た目はそのまま残るよ。' },
      { e:'happy',    t:'寄付するとダイヤがもらえるけど、その子とはお別れになるよ。' },
      { e:'normal',   t:'染色は神殿じゃなくてM/B管理からだよ、念のため！' },
      { e:'excited',  t:'強い子を作るなら、まずは絆レベルを伸ばすのが近道♪' },
      { e:'wink',     t:'合体前に、消える技を確認しておくと後悔しないよ！' },
      { e:'normal',   t:'ここの空気、なんだか落ち着くと思わない？' },
      { e:'surprise', t:'この神殿、誰が建てたか知らないんだよね…気になる。', w:0.3 },
      { e:'troubled', t:'手放す判断ってむずかしいよね。あたしも苦手…', w:0.4 },
      { e:'happy',    t:'ダイヤに余裕があるときは、合体を試してみるのもアリだよ♪' },
    ],
    roster: [
      { e:'happy',    t:'{name}、編成は4体まで入れられますよ♪', bond:[1,2] },
      { e:'normal',   t:'勇者モンと供モンで役割が変わりますからね。', bond:[1,2] },
      { e:'wink',     t:'{name}、迷ったら間合いのバランスを見てみましょ！', bond:[1,2] },
      { e:'excited',  t:'{name}、いい並びになってきましたね♪', bond:[1,2] },
      { e:'happy',    t:'{name}、その編成いいじゃん！ バランス取れてる。', bond:[3,4] },
      { e:'normal',   t:'{name}って、けっこう近距離が好きだよね？', bond:[3,4] },
      { e:'excited',  t:'{name}の編成、見てるだけで楽しい♪', bond:4 },
      { e:'wink',     t:'{name}ちの主力、そろそろ入れ替えどきかも？', bond:4 },
      { e:'excited',  t:'{name}、その編成めっちゃ好き！ あたし好みだ〜♪', bond:5 },
      { e:'happy',    t:'{name}が選ぶ子って、なんか味があるんだよね。', bond:5, w:0.5 },
      { e:'normal',   t:'間合い適性は4つの距離ぜんぶにかかるよ。' },
      { e:'happy',    t:'合流ボーナスは供モンの絆レベルで決まるんだ♪' },
      { e:'normal',   t:'ベースモンからも勇者モンを選べるよ。' },
      { e:'wink',     t:'同じ種類ばかりだと、間合いが偏っちゃうから注意ね！' },
      { e:'excited',  t:'育てたい子を勇者モンにすると、絆経験値がいっぱい入るよ♪' },
      { e:'normal',   t:'編成を変えても、マスモンの記録は消えないから安心して。' },
      { e:'happy',    t:'ブリーダーカードも忘れずに入れてね！' },
      { e:'normal',   t:'カードの枚数は勇者モンの特性で増えることがあるよ。' },
      { e:'surprise', t:'この並び、なんか強そうな気がする…！', w:0.3 },
      { e:'wink',     t:'正解はひとつじゃないから、好きな子を入れていいと思うよ♪' },
    ],
    masuList: [
      { e:'happy',    t:'{name}、育てた子はここに並びますよ♪', bond:[1,2] },
      { e:'normal',   t:'絆レベルが上がると、強化ポイントがもらえます。', bond:[1,2] },
      { e:'excited',  t:'{name}、ずいぶん増えましたね♪', bond:[1,2] },
      { e:'happy',    t:'{name}、この子たちみんな{name}が育てたんだよね。', bond:[3,4] },
      { e:'wink',     t:'{name}、名前つけるセンスあると思う♪', bond:[3,4] },
      { e:'excited',  t:'{name}のマスモン、見てるだけで時間溶ける〜', bond:4 },
      { e:'happy',    t:'{name}、この子たちと一緒にここまで来たんだね♪', bond:5 },
      { e:'normal',   t:'{name}のいちばんのお気に入り、あたし当てられる気がする。', bond:5, w:0.4 },
      { e:'normal',   t:'強化ポイントは間合い適性とステータスに振れるよ。' },
      { e:'happy',    t:'振り直したいときは、絆ポイントリセットの書を使ってね♪' },
      { e:'normal',   t:'名前は何度でも変えられるよ。' },
      { e:'wink',     t:'染色で見た目を変えると、愛着わくよ〜♪' },
      { e:'normal',   t:'並び順は絞り込みと並べ替えで変えられるよ。' },
      { e:'excited',  t:'星の数は転生した回数だよ。増やすと上限も上がる！' },
      { e:'happy',    t:'まとめて強化すると、一気に振れて楽だよ♪' },
    ],
    market: [
      { e:'happy',    t:'{name}、アイコンはpt、ほかはダイヤで買えますよ♪', bond:[1,2] },
      { e:'normal',   t:'買ったものは次の周回から使えます。', bond:[1,2] },
      { e:'wink',     t:'{name}、ダイヤは大事に使いましょうね♪', bond:[1,2] },
      { e:'excited',  t:'{name}、気になるものありました？', bond:[1,2] },
      { e:'happy',    t:'{name}、なに買うか決めた？', bond:[3,4] },
      { e:'wink',     t:'{name}って、こういうとき悩むタイプでしょ〜', bond:[3,4] },
      { e:'excited',  t:'{name}、あたしのアイコンも売ってるよ！ …どう？', bond:4 },
      { e:'happy',    t:'{name}、あたしのアイコン使ってくれてたら嬉しいな♪', bond:5, w:0.6 },
      { e:'excited',  t:'{name}、たまには自分にご褒美あげよ！', bond:5 },
      { e:'normal',   t:'円盤石を買うと新しいモンスターが解放されるよ。' },
      { e:'happy',    t:'ブリーダーカードはバトル中に使える強い味方だよ♪' },
      { e:'normal',   t:'アイテムの効果は「詳細」から見られるよ。' },
      { e:'wink',     t:'ptはブリーダーレベルが上がるともらえるよ！' },
      { e:'normal',   t:'買っただけだと使えないよ。M/B管理から編成に入れてね。' },
      { e:'surprise', t:'この値段…ちょっとだけ強気だと思わない？笑', w:0.3 },
    ],
  },
});

// ===== 親密度ぶんのセリフ(報酬・プロフィール・設定・ヘルプ) =====
addAssistantLinePack({
  id: 'bondDaily',
  label: '親密度・ミッションとギフト、設定まわり',
  lines: {
    missionsClaimable: [
      { e:'excited',  t:'{name}、受け取れるものがありますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、ちゃんと進めてますね！ えらい♪', bond:[1,2] },
      { e:'excited',  t:'{name}、報酬たまってるよ！ もらっちゃお♪', bond:[3,4] },
      { e:'wink',     t:'{name}、受け取り忘れないでよ〜？', bond:4 },
      { e:'happy',    t:'{name}、こういうのマメだよね。あたし尊敬してる♪', bond:5 },
    ],
    missionsNormal: [
      { e:'normal',   t:'{name}、デイリーは毎日リセットされますよ。', bond:[1,2] },
      { e:'happy',    t:'{name}、ちょっとずつでいいと思いますよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、今日のぶんもう少しで終わりそう？', bond:[3,4] },
      { e:'wink',     t:'{name}、全部やらなくても大丈夫だからね！', bond:4 },
      { e:'happy',    t:'{name}のペースでいいよ。あたしが急かすことじゃないし♪', bond:5 },
    ],
    giftClaimable: [
      { e:'excited',  t:'{name}、ギフトが届いてますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、なにが入ってるか楽しみですね！', bond:[1,2] },
      { e:'excited',  t:'{name}、ギフト来てる！ 開けてみよ♪', bond:[3,4] },
      { e:'wink',     t:'{name}、期限あるからね。忘れないうちに！', bond:4 },
      { e:'happy',    t:'{name}、いいもの入ってるといいね♪', bond:5 },
    ],
    giftEmpty: [
      { e:'normal',   t:'{name}、いまは届いていないみたいです。', bond:[1,2] },
      { e:'happy',    t:'{name}、また届いたらお知らせしますね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、いまは空っぽだね。またあとで覗こ！', bond:[3,4] },
      { e:'wink',     t:'{name}、ここが空だとちょっと寂しいよね〜', bond:4 },
      { e:'happy',    t:'{name}、そのうち何か来るよ。気長にいこ♪', bond:5 },
    ],
    profile: [
      { e:'happy',    t:'{name}、名前もアイコンもいつでも変えられますよ♪', bond:[1,2] },
      { e:'normal',   t:'ここで決めた名前がランキングに出ます。', bond:[1,2] },
      { e:'excited',  t:'{name}、そのアイコン似合ってますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、そのアイコン気に入ってる？', bond:[3,4] },
      { e:'wink',     t:'{name}って名前、呼びやすくて好きだな〜', bond:[3,4] },
      { e:'excited',  t:'{name}、たまには気分でアイコン変えてみたら？', bond:4 },
      { e:'happy',    t:'{name}って呼ぶの、けっこう気に入ってるんだよね♪', bond:5 },
      { e:'wink',     t:'{name}、あたしのアイコンにしてくれてもいいんだよ？笑', bond:5, w:0.6 },
      { e:'normal',   t:'ブリーダーレベルはここで確認できるよ。' },
      { e:'happy',    t:'持ってるアイテムもここから見られるよ♪' },
    ],
    settings: [
      { e:'happy',    t:'{name}、音量はここで調整できますよ♪', bond:[1,2] },
      { e:'normal',   t:'データ引き継ぎは、たまに控えておくと安心です。', bond:[1,2] },
      { e:'wink',     t:'{name}、BGMアレンジも試してみてくださいね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、音まわりは好みでいじっていいと思うよ。', bond:[3,4] },
      { e:'happy',    t:'{name}、バックアップだけは取っておこ？ 心配だから。', bond:[3,4] },
      { e:'troubled', t:'{name}、データ消えたらあたし泣いちゃうからね…！', bond:4 },
      { e:'happy',    t:'{name}、引き継ぎコード控えた？ しつこくてごめんね♪', bond:5 },
      { e:'wink',     t:'{name}が快適に遊べるのがいちばんだからね！', bond:5 },
      { e:'normal',   t:'ヘルプもここから開けるよ。' },
      { e:'happy',    t:'BGMアレンジは、バトルモード別に曲を選べるよ♪' },
    ],
    helpTop: [
      { e:'happy',    t:'{name}、気になるところから読んでくださいね♪', bond:[1,2] },
      { e:'normal',   t:'分からないことは、たいていここに書いてありますよ。', bond:[1,2] },
      { e:'wink',     t:'{name}、読むのが面倒なら聞いてくれてもいいですよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、どこが気になる？', bond:[3,4] },
      { e:'happy',    t:'{name}、距離のところは一回読んどくと強いよ！', bond:[3,4] },
      { e:'excited',  t:'{name}、ここ書いたのあたしなんだよ？ …ってことにして！', bond:4, w:0.6 },
      { e:'happy',    t:'{name}、分かんないとこあったら遠慮なく言ってね♪', bond:5 },
      { e:'wink',     t:'{name}のためなら、何回でも説明するよ！', bond:5, w:0.6 },
      { e:'normal',   t:'距離と間合い適性は、いちばん大事なところだよ。' },
      { e:'happy',    t:'カードの半減ルール、意外と見落としがちだよ♪' },
      { e:'normal',   t:'難易度の倍率は実際の値をそのまま出してるよ。' },
      { e:'wink',     t:'アイテムやログインボーナスの一覧も載ってるよ！' },
      { e:'normal',   t:'項目の下に「次：」って出てるところから読み進められるよ。' },
      { e:'excited',  t:'攻略のヒントのページ、けっこう自信あるんだ♪' },
      { e:'normal',   t:'更新履歴とヘルプ、どっちも見ておくと迷わないよ。' },
    ],
  },
});

// ===== 親密度ぶんのセリフ(そのほかの画面) =====
addAssistantLinePack({
  id: 'bondMisc',
  label: '親密度・そのほかの画面',
  lines: {
    pickHero: [
      { e:'happy',    t:'{name}、主役になる子を選びましょ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、育てたい子を選ぶと絆がよく伸びるよ。', bond:[3,4] },
      { e:'excited',  t:'{name}、今日の主役は誰にする？', bond:5 },
      { e:'normal',   t:'勇者モンだけが固有技と勇者特性を使えるよ。' },
      { e:'wink',     t:'編成タブとベースモンタブ、どっちからでも選べるよ♪' },
    ],
    mbManagement: [
      { e:'happy',    t:'{name}、ここから編成もマスモンも見られますよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、整理しておくとバトル前が楽だよ。', bond:[3,4] },
      { e:'wink',     t:'{name}、あたしも一緒に見てあげる♪', bond:5 },
      { e:'normal',   t:'ベースモンは種の基本データ、マスモンは育てた個体だよ。' },
    ],
    masuEnhance: [
      { e:'happy',    t:'{name}、強化ポイントの振り先を選びましょ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、迷ったら得意な距離を伸ばすのが無難だよ。', bond:[3,4] },
      { e:'excited',  t:'{name}、その振り方、攻めてていいね♪', bond:5 },
      { e:'normal',   t:'振り直したいときはリセットの書が使えるよ。' },
      { e:'wink',     t:'まとめて振ると一気に強くなるよ♪' },
    ],
    fusion: [
      { e:'happy',    t:'{name}、主に残したい子を選んでくださいね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、副の子の絆は経験値になって引き継がれるよ。', bond:[3,4] },
      { e:'troubled', t:'{name}、決める前にもう一回だけ確認しよ？', bond:5 },
      { e:'normal',   t:'合体後のレベル変化は、確認画面で見られるよ。' },
      { e:'wink',     t:'固有技を引き継げるのは、副が絆Lv.30以上のときだよ！' },
    ],
    rebirth: [
      { e:'excited',  t:'{name}、限界突破すると星が増えますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、思いきっていこ！ レベルは戻らないから。', bond:[3,4] },
      { e:'excited',  t:'{name}、この瞬間いつ見てもいいよね〜♪', bond:5 },
      { e:'normal',   t:'レベルはそのまま、上限だけ上がるよ。' },
    ],
    reincarnate: [
      { e:'excited',  t:'{name}、ここまで育てたんですね…！', bond:[1,2] },
      { e:'happy',    t:'{name}、振り直しのチャンスだよ♪', bond:[3,4] },
      { e:'wink',     t:'{name}となら、もう一度てっぺんまでいけるよね！', bond:5 },
      { e:'normal',   t:'レベルは99ぶん戻るけど、上限はそのままだよ。' },
    ],
    donation: [
      { e:'troubled', t:'{name}、寄付は取り消せないので慎重に…！', bond:[1,2] },
      { e:'troubled', t:'{name}、ほんとにこの子でいい？', bond:[3,4] },
      { e:'crying',   t:'{name}、あたしはちょっと寂しいけど…{name}が決めていいよ。', bond:5 },
    ],
    pasture: [
      { e:'happy',    t:'{name}、村に出す子を選べますよ♪', bond:[1,2] },
      { e:'excited',  t:'{name}、みんな楽しそうに歩いてるよ〜♪', bond:[3,4] },
      { e:'happy',    t:'{name}、この景色見てると和むよね♪', bond:5 },
      { e:'normal',   t:'放牧しても強さには影響しないよ。見た目だけ！' },
    ],
    inventory: [
      { e:'happy',    t:'{name}、持ってるアイテムはここですよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、使いどきを逃さないようにね。', bond:[3,4] },
      { e:'wink',     t:'{name}、ためこむタイプでしょ〜？ 分かるけど♪', bond:5 },
      { e:'normal',   t:'絆経験値のアイテムは、まとめて使えるよ。' },
    ],
    resultWin: [
      { e:'excited',  t:'{name}、おめでとうございます♪ すごいです！', bond:[1,2] },
      { e:'happy',    t:'{name}、やったね！ ナイスバトル♪', bond:[3,4] },
      { e:'excited',  t:'{name}、さすが！ あたしの相棒は違うね〜♪', bond:5 },
      { e:'happy',    t:'活躍した子はマスモンに登録できるよ！' },
      { e:'wink',     t:'この勢いでもう1回いっちゃう？' },
    ],
    resultLose: [
      { e:'troubled', t:'{name}、惜しかったですね…次はいけますよ！', bond:[1,2] },
      { e:'normal',   t:'{name}、ドンマイ！ 次があるって。', bond:[3,4] },
      { e:'happy',    t:'{name}、気にしないで。あたしはずっと味方だからね♪', bond:5 },
      { e:'normal',   t:'負けても、進んだWAVEぶんの報酬はもらえるよ。' },
    ],
    resultRetire: [
      { e:'normal',   t:'{name}、休むのも大事ですよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、また気が向いたらいこ！', bond:[3,4] },
      { e:'wink',     t:'{name}、無理しないのがいちばん♪', bond:5 },
    ],
    monsterList: [
      { e:'happy',    t:'{name}、解放済みの種はここで見られますよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、まだ持ってない子はマーケットにいるかも。', bond:[3,4] },
      { e:'excited',  t:'{name}、コンプリート目指しちゃう？', bond:5 },
      { e:'normal',   t:'絞り込みと並べ替えで探しやすくなるよ。' },
    ],
  },
});

// ===== きき(第2助手)のセリフ =====
// ---------- ききの話し方(セリフを足すときの決まりごと) ----------
// ・一人称は「私」。役割は「助手」
// ・優しくて気配り上手。落ち着いたお姉さん寄りで、みゅあより冷静
// ・基本はていねい口調。ただし堅すぎず、ほんのりゆるくて可愛い
// ・ききらしい言葉の崩し方として「です」→「でつ」、「ます」→「まつ」、
//   「おはよ」→「おはゆ」を自然に混ぜる。★ただし全部を機械的に変換しないこと。
//   毎文「でつ」「まつ」にすると幼児語のキャラになってしまう。
//   ていねいで落ち着いた話し方の中に、ときどき混ざるのが「きき」
// ・たまに天然っぽさや軽いツッコミも入れる。上から目線にはしない
// ・みゅあのセリフを語尾だけ変えた文にしない。反応の中身から性格の違いを出す
//   (みゅあ=一緒に盛り上がる／きき=落ち着いて支える)
// ・説明書のような言い回し(「〜してください」「〜しましょう」)は使わない
// ・1〜2文で、スマホでも一目で読める長さにする
addAssistantLinePack({
  id: 'kikiCore',
  assistantId: 'kiki',
  label: 'きき・全画面の基本セリフ',
  lines: {
    // ---- 日次アドバイス ----
    dailyMasuAdvice: [
      { e:'normal',  t:'マスモンを早く増やしたいなら、いい方法がありますよ。' },
      { e:'happy',   t:'クイックのBeginnerでWAVE2まで進んで、\n「あきらめる」を選ぶんでつ。' },
      { e:'wink',    t:'これが今のところ、いちばん早い増やし方ですね。' },
      { e:'normal',  t:'WAVE2まで進むのが大事。そこから登録できまつ。' },
      { e:'happy',   t:'短い時間で仲間を増やしたいときに、どうぞ♪' },
    ],
    // ---- 極限チャレンジ ----
    extremeChallenge: [
      { e:'surprise', t:'ここから先は極限チャレンジ。かなり手強いですよ。' },
      { e:'normal',   t:'育てた子の本気を試すなら、ここが舞台ですね。' },
      { e:'troubled', t:'正直に言うと、生半可な育成だと厳しいと思いまつ。' },
      { e:'happy',    t:'専用ランキングもあるので、記録に残せまつよ♪' },
      { e:'normal',   t:'無理そうなら育ててから出直すのも、立派な作戦でつ。' },
      { e:'wink',     t:'準備が整っているなら、思いきって挑んでみましょ。' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'EXTREMEはブリーダーカードの効果が半分。ご注意を。' },
      { e:'surprise', t:'敵の強さは×13。いつもの感覚だと危ないでつ。' },
      { e:'normal',   t:'虹のプシュケー報酬と全WAVE詳細、先に見ると安心ですよ。' },
      { e:'happy',    t:'準備が整っているなら、いってらっしゃい♪' },
      { e:'normal',   t:'厳しそうなら、もうひと育成してからでも遅くないでつ。' },
      { e:'wink',     t:'私も見てまつから、落ち着いていきましょ。' },
    ],
    nightmareDifficulty: [
      { e:'surprise', t:'NIGHTMAREはEXTREMEの次。もっと手強い悪夢でつ。' },
      { e:'troubled', t:'有利な補正が弱くなって、不利な補正は重くなりまつ。' },
      { e:'normal',   t:'距離適性が、いつも以上に大事になりますね。' },
      { e:'normal',   t:'全WAVE詳細で敵の順番を見ると、作戦を立てやすいでつ。' },
      { e:'wink',     t:'補正のかかり方が変わるので、編成はじっくり考えましょ。' },
    ],
    chaosDifficulty: [
      { e:'surprise', t:'CHAOSは敵の強さが×20。本当に極限の戦いでつ…！' },
      { e:'normal',   t:'NIGHTMAREを1回クリアすると挑めるようになりまつ。' },
      { e:'excited',  t:'スコア×20、経験値×35、ダイヤ×15。報酬も破格ですね♪' },
      { e:'troubled', t:'与ダメージと加入ボーナスは半分、消費ガッツは1.5倍でつ。' },
      { e:'happy',    t:'クリアで虹のプシュケー50個。応援してまつ♪' },
    ],
    ultimateDifficulty: [
      { e:'surprise', t:'ULTIMATEは敵強度×35。CHAOSを越えた人だけの舞台でつ。' },
      { e:'normal',   t:'累計ターンが増えるほど、次の敵が強くなりまつ。' },
      { e:'excited',  t:'スコア×20、経験値×40、ダイヤ×20。プシュケーは60個でつ♪' },
      { e:'troubled', t:'トレーニングもターン数で下がるので、速い勝利が大切ですね。' },
      { e:'wink',     t:'35ターンごとのDISTANCE BREAKにも備えておきましょ。' },
    ],
    infinityDifficulty: [
      { e:'normal',   t:'最後に控えているのがINFINITY。まだ準備中でつ。' },
      { e:'surprise', t:'無限、ですか…。どんな難易度になるんでしょうね。' },
      { e:'happy',    t:'いつか挑める日が来るのが、今から楽しみでつ♪' },
      { e:'troubled', t:'極限の果て…想像するだけで、少し緊張しまつね。' },
      { e:'normal',   t:'その日まで、のんびり育成を楽しみましょ。' },
    ],
    // ---- はじめて ----
    onboarding: [
      { e:'happy',   t:'はじめまして。私はきき、このゲームの助手でつ。' },
      { e:'normal',  t:'まずはお名前とアイコンを決めましょ。あとから変えられまつ。' },
      { e:'wink',    t:'お名前はランキングにも出るので、気に入ったものを♪' },
      { e:'happy',   t:'困ったことがあったら、いつでも私に声をかけてほしいでつ。' },
      { e:'normal',  t:'準備が整ったら、いよいよ冒険のはじまりでつ。' },
    ],
    // ---- ホーム ----
    home: [
      // どのLvでも出る、村のようすや案内
      { e:'happy',    t:'今日も一緒に育てていきましょ♪' },
      { e:'normal',   t:'マスモンの絆レベル、ときどき見てあげたいですね。' },
      { e:'wink',     t:'ミッションとギフト、覗いてみると何かあるかも♪' },
      { e:'normal',   t:'放牧に出した子が、村を歩いてまつよ。見えまつか？' },
      { e:'happy',    t:'今日はどこから回りまつか？ 私は神殿がおすすめでつ。' },
      { e:'normal',   t:'編成を見直すだけでも、けっこう変わりまつよ。' },
      { e:'happy',    t:'更新履歴、たまに読むと発見がありまつ♪' },
      { e:'normal',   t:'今日のぶんのログインボーナス、受け取りましたか？' },
      { e:'troubled', t:'ダイヤの使いどころ、悩みまつよね。私も悩みまつ。', w:0.5 },
      { e:'happy',    t:'少し休むのも大事でつ。ゲームは逃げませんから。', w:0.5 },
      { e:'surprise', t:'あ、いま向こうでマスモンが転んだような…気のせい？', w:0.25 },
      { e:'wink',     t:'内緒ですけど、私は夕方の村がいちばん好きでつ♪', w:0.25 },
      // Lv1〜3: ていねいで、少し距離がある
      { e:'happy',    t:'{name}、今日もよろしくお願いしまつ。', bond:[1,3] },
      { e:'normal',   t:'{name}、まずは編成の確認からいきまつか？', bond:[1,3] },
      { e:'normal',   t:'{name}、無理のない範囲で楽しんでいきましょ。', bond:[1,3] },
      { e:'happy',    t:'{name}のペースで大丈夫でつよ。', bond:[1,3] },
      { e:'wink',     t:'{name}、育成がいい感じに進んでまつね。', bond:[1,3] },
      // Lv4〜5: 「ちー」付けになって、ぐっと打ち解ける
      { e:'happy',    t:'{name}、おかえりなさい♪ 待ってましたよ。', bond:[4,5] },
      { e:'excited',  t:'{name}、その育成いい感じ！ センスありまつね。', bond:[4,5] },
      { e:'normal',   t:'なんだか今日は調子よさそう。気のせいでつか？', bond:[4,5] },
      { e:'happy',    t:'{name}、今日は何をしまつ？ お付き合いしまつよ♪', bond:[4,5] },
      // Lv6以降: 呼び方を自分で決められる。距離はさらに近づく
      { e:'happy',    t:'{name}、呼び方を自分で決められるようになりまつよ♪', bond:6 },
      { e:'wink',     t:'{name}とは、もう気を使わずに話せまつね。', bond:7 },
      { e:'excited',  t:'{name}となら、どんな難易度でも越えられそうでつ♪', bond:9 },
      { e:'happy',    t:'{name}が来ると、なんだか安心しまつ。', bond:11 },
      { e:'normal',   t:'{name}、私はずっとここにいまつからね。', bond:13, w:0.5 },
      { e:'excited',  t:'{name}とは、もう阿吽の呼吸でつね♪', bond:15 },
      { e:'happy',    t:'{name}とここまで来られて、私は幸せでつ♪', bond:18, w:0.5 },
      { e:'excited',  t:'{name}とは永遠の相棒でつ。これからもよろしく♪', bond:20 },
    ],
    // ---- バトルメニュー ----
    battleChallenge: [
      { e:'normal',   t:'スコアを競うならチャレンジでつ。上のタブも見てみて♪' },
      { e:'wink',     t:'強化の選び方で、かなり変わりまつよ。' },
      { e:'normal',   t:'終盤まで見据えて強化するのがコツですね。' },
      { e:'excited',  t:'自己ベスト、更新できそうな気がしまつ♪' },
      { e:'normal',   t:'難易度カードから、虹のプシュケー報酬も見られまつ。' },
      { e:'happy',    t:'迷ったら、弱いところを埋めるのがおすすめでつ。' },
    ],
    battleQuick: [
      { e:'wink',     t:'テンポ重視ならクイックでつね。' },
      { e:'happy',    t:'サクサク育成していきましょ♪' },
      { e:'normal',   t:'自動成長をうまく活かすのがコツでつ。' },
      { e:'normal',   t:'強化は選べないので、編成で勝負ですね。' },
      { e:'excited',  t:'経験値もダイヤも1.5倍。おいしいでつ♪' },
      { e:'happy',    t:'難易度カードから、報酬も確認できまつよ。' },
    ],
    battlePro: [
      { e:'excited',  t:'ここはベースモンだけの世界。腕の見せどころでつ♪' },
      { e:'wink',     t:'絆経験値3倍。新しい子を育てるなら、ここですね。' },
      { e:'happy',    t:'ブリーダー経験値も1.5倍でつよ♪' },
      { e:'normal',   t:'育てたマスモンは連れていけません。素の力で勝負でつ。' },
      { e:'normal',   t:'供モンは5体選んで、その中から3体が来まつ。' },
      { e:'happy',    t:'上のタブから、プロだけの記録も見られまつ♪' },
      { e:'troubled', t:'きびしいモードですけど、そのぶん伸びまつよ。' },
    ],
    ranking: [
      { e:'excited',  t:'上位、目指してみまつか♪' },
      { e:'happy',    t:'みなさん強いでつね…！' },
      { e:'wink',     t:'編成を見るだけでも、勉強になりまつよ。' },
      { e:'normal',   t:'次はこの方を超えるのが目標ですね。' },
      { e:'happy',    t:'あと少しで順位が上がりそうでつ♪' },
      { e:'normal',   t:'難易度を切り替えると、狙い目が見えてきまつ。' },
    ],
    rankingParty: [
      { e:'happy',    t:'この方が使っていた編成でつ。染めた色もそのままですよ♪' },
      { e:'excited',  t:'どの距離に置いていたかも分かりまつ。真似してみまつか？' },
      { e:'normal',   t:'王冠が付いているのが勇者モン。主役になった子ですね。' },
      { e:'wink',     t:'絆レベルが高い子ほど、大事に育てられた子でつ♪' },
      { e:'normal',   t:'染めた色が残るのは、この画面ができたあとの記録からでつ。' },
      { e:'surprise', t:'強い方の編成、けっこう参考になりまつよね。' },
    ],
    // ---- ランの準備・進行 ----
    pickHero: [
      { e:'normal',   t:'最初の1体はとても大事。勇者特性を見て決めましょ。' },
      { e:'happy',    t:'今日はどの子でいきまつか？ 私も楽しみでつ♪' },
      { e:'wink',     t:'固有技も見ておくと、戦い方がガラッと変わりまつよ。' },
      { e:'excited',  t:'育っている子で挑むと、けっこう気持ちいいでつ♪' },
      { e:'normal',   t:'迷ったら詳細を開いてみて。特性が決め手ですね。' },
    ],
    pickSlot: [
      { e:'wink',     t:'敵と同じ距離から殴ると強いでつよ。' },
      { e:'normal',   t:'得意な距離と、いまの補正を見て置きましょ。' },
      { e:'happy',    t:'ここ、地味に勝敗を分けるところでつ。' },
      { e:'excited',  t:'補正が高い距離に寄せると、気持ちいいでつ♪' },
      { e:'normal',   t:'置いた距離以外にも補正はかかるので、安心して選べまつ。' },
    ],
    pickAlly: [
      { e:'happy',    t:'仲間が増えまつよ♪ どの子にしまつか？' },
      { e:'wink',     t:'ステータスだけでなく、距離の補正も見てみて。' },
      { e:'excited',  t:'ここで一気に強くなるチャンスでつ。' },
      { e:'normal',   t:'足りない距離を埋めると、安定しまつよ。' },
      { e:'happy',    t:'心強い仲間が来たら、あと半分いけそうですね♪' },
    ],
    pickProAllies: [
      { e:'excited',  t:'ここで選んだ子の中からしか来ません。よく考えて♪' },
      { e:'wink',     t:'合流で出るのは、この中からランダムで3体だけでつ。' },
      { e:'normal',   t:'誰が来てもいいように組むのが、コツですね。' },
      { e:'happy',    t:'間合いをばらけさせておくと安心でつ♪' },
      { e:'troubled', t:'全員同じ距離だと、届かない相手が出るかもしれません。' },
      { e:'normal',   t:'ステータスの合流ボーナスも、見ておきましょ。' },
    ],
    pickTeaching: [
      { e:'wink',     t:'同じ教えを重ねると、Lv2に進化しまつよ。' },
      { e:'normal',   t:'今の強さを取るか、完成形を狙うか…作戦しだいですね。' },
      { e:'happy',    t:'私は、とりあえず重ねる派でつ♪' },
      { e:'excited',  t:'進化すると、けっこう跳ね上がりまつ。' },
      { e:'normal',   t:'ブリーダーカードは効果が半減しないのが強みでつ。' },
    ],
    rewardPick: [
      { e:'happy',    t:'WAVEクリアお疲れさまでつ♪ トレーニングを2つえらびましょ。' },
      { e:'wink',     t:'弱点を埋めるか、強みを伸ばすか…悩みまつね。' },
      { e:'excited',  t:'いい感じでつ♪ この調子でいきましょ。' },
      { e:'normal',   t:'同じトレーニングを2回えらぶと、その分ぐっと伸びまつよ。' },
      { e:'happy',    t:'ここの積み重ねで、終盤がラクになりまつよ。' },
    ],
    battleHelp: [
      { e:'wink',     t:'迷ったら、まず解析。敵の必殺技が読めまつよ。' },
      { e:'normal',   t:'いちばん効かせたいカードは、最初に置くのがコツでつ。' },
      { e:'happy',    t:'落ち着いていきましょ。ガードも立派な一手でつ。' },
      { e:'excited',  t:'あと少しで勝てそう…！ ここ、踏ん張りどころでつ。' },
      { e:'normal',   t:'ガッツが足りないときは、1枚だけでも大丈夫でつ。' },
    ],
    // ---- リザルト ----
    resultWin: [
      { e:'excited',  t:'優勝おめでとうございまつ♪' },
      { e:'happy',    t:'お見事でつ。育った勇者モンは登録しておきましょ。' },
      { e:'excited',  t:'完璧でつね♪ このまま上の難易度も狙えまつ。' },
      { e:'happy',    t:'お疲れさまでつ。報酬も受け取っておきましょ。' },
      { e:'wink',     t:'今の編成、けっこう強かったでつね。覚えておきましょ♪' },
    ],
    resultLose: [
      { e:'crying',   t:'今回はここまででつ…。報酬はちゃんと入りまつよ。' },
      { e:'troubled', t:'惜しかったでつね。次はいけそうな気がしまつ。' },
      { e:'normal',   t:'負けても経験値は入りまつ。育て直して、また挑みましょ。' },
      { e:'crying',   t:'悔しいでつ…。でも、ここまで来たのはすごいでつよ。' },
      { e:'happy',    t:'切り替えていきましょ♪ 編成を変えると景色が変わりまつ。' },
    ],
    resultRetire: [
      { e:'troubled', t:'お疲れさまでつ。クリア済みWAVE分の報酬は入りまつ。' },
      { e:'normal',   t:'休憩も大事でつね。結果だけ確認しておきましょ。' },
      { e:'happy',    t:'また遊びましょ♪ いつでも待ってまつよ。' },
      { e:'troubled', t:'今回はここまででつね。もらえるものは受け取っておきましょ。' },
      { e:'wink',     t:'仕切り直しもアリでつ。次にいきましょ♪' },
    ],
    // ---- スキップチケット ----
    skipPick: [
      { e:'happy',    t:'スキップで一気に育成でつ♪ 使う枚数も選べまつよ。' },
      { e:'normal',   t:'時間がないときの味方でつね。' },
      { e:'wink',     t:'勇者モンと供モンを決めたら、あとはおまかせでつ。' },
      { e:'excited',  t:'まとめて使うと、もらえる量もぐっと増えまつ♪' },
      { e:'normal',   t:'ランキングには入らないので、そこだけ覚えておきましょ。' },
    ],
    skipResult: [
      { e:'happy',    t:'受け取り完了でつ♪ 一気に育ちましたね。' },
      { e:'surprise', t:'おおっ、ごっそり入りまつね…！' },
      { e:'normal',   t:'スキップ分はランキングとクリア回数には入りません。' },
      { e:'excited',  t:'育成が進みまつね。次のバトルが楽しみでつ♪' },
      { e:'wink',     t:'浮いた時間で、別のことをするのもいいですね。' },
    ],
    // ---- M/B管理 ----
    mbManagement: [
      { e:'normal',   t:'編成もベースモンもマスモンも、ここから見られまつ。' },
      { e:'wink',     t:'解放しただけでは出てこないので、編成に入れましょ。' },
      { e:'happy',    t:'最後に「決定」を押すのだけ、お忘れなく♪' },
      { e:'normal',   t:'ブリーダーカードの編成も、ここからでつ。' },
      { e:'excited',  t:'編成を整えると、戦いがぐっとラクになりまつよ♪' },
    ],
    roster: [
      { e:'normal',   t:'ここで使う子を選びまつ。' },
      { e:'wink',     t:'間合いをばらけさせておくと、どんな敵にも届きまつ♪' },
      { e:'happy',    t:'お気に入りの子を入れると、気分が上がりまつね。' },
      { e:'normal',   t:'「決定」を押すまで反映されないので、ご注意を。' },
      { e:'excited',  t:'編成を変えると、戦い方もガラッと変わりまつ♪' },
      { e:'normal',   t:'ブリーダーカードの編成も、同じように選べまつよ。' },
    ],
    monsterList: [
      { e:'normal',   t:'ベースモンは種類の基本、マスモンは育てた個体でつ。' },
      { e:'happy',    t:'見たい方を選んでみましょ♪' },
      { e:'wink',     t:'気になる子は詳細を開いてみて。特性が面白いでつよ。' },
      { e:'normal',   t:'間合い適性も、ここから確認できまつ。' },
      { e:'excited',  t:'集めた子が並ぶと、なんだか嬉しくなりまつね♪' },
    ],
    masuList: [
      { e:'normal',   t:'育てたマスモンの一覧でつ。絞り込みも使えまつよ。' },
      { e:'happy',    t:'お気に入りの子、増えてきましたね♪' },
      { e:'wink',     t:'総合力の順に並べると、育ち具合が分かりやすいでつ。' },
      { e:'normal',   t:'名前は変えられまつよ。愛着がわきまつね。' },
      { e:'excited',  t:'コンプリート、目指してみまつか♪' },
      { e:'normal',   t:'絞り込みと並べ替えで、探しやすくなりまつ。' },
    ],
    masuEnhance: [
      { e:'normal',   t:'ポイントは適性か能力値に使えまつ♪' },
      { e:'wink',     t:'得意な戦い方に合わせて伸ばしましょ。' },
      { e:'happy',    t:'まとめて強化もできるので、ラクでつよ。' },
      { e:'excited',  t:'一気に振ると、強くなった感じがしまつ♪' },
      { e:'normal',   t:'迷ったら、足りないところから埋めるのが無難でつ。' },
    ],
    // ---- 神殿 ----
    temple: [
      { e:'normal',   t:'神殿では合体・転生・寄付ができまつ。' },
      { e:'wink',     t:'育成の土台になる場所ですね。' },
      { e:'happy',    t:'どれも取り返しがつかないので、落ち着いて選びましょ。' },
      { e:'normal',   t:'限界突破と転生は、絆Lvぶんのダイヤがかかりまつ。' },
      { e:'excited',  t:'合体は、ここのいちばんの楽しみでつ♪' },
      { e:'normal',   t:'再生は初回無料でつよ。試してみるのもいいですね。' },
    ],
    fusion: [
      { e:'excited',  t:'合体でつ♪ どの子とどの子を組み合わせまつか？' },
      { e:'normal',   t:'技を継承するかどうかで、かかるダイヤが変わりまつ。' },
      { e:'wink',     t:'合体後の経験値とレベルも、先に確認できまつよ。' },
      { e:'troubled', t:'素材にした子は戻ってきません。よく確かめてから♪' },
      { e:'happy',    t:'思わぬ組み合わせが、当たりだったりしまつ。' },
    ],
    rebirth: [
      { e:'normal',   t:'限界突破でつ。絆Lvの上限を超えられまつよ。' },
      { e:'wink',     t:'かかるダイヤは絆Lvぶん。育った子ほど高くなりまつ。' },
      { e:'happy',    t:'お気に入りの子を、さらに先へ連れていけまつね♪' },
      { e:'normal',   t:'継承する技も、ここで選べまつよ。' },
      { e:'excited',  t:'星が増えると、見た目にも育ちが分かりまつ♪' },
    ],
    reincarnate: [
      { e:'normal',   t:'転生でつ。別の姿へ生まれ変わらせられまつ。' },
      { e:'troubled', t:'元の姿には戻せません。よく考えてから決めましょ。' },
      { e:'wink',     t:'継承する技を選べるので、強みは引き継げまつよ。' },
      { e:'happy',    t:'新しい姿になる瞬間、私はいつもドキドキしまつ♪' },
      { e:'normal',   t:'かかるダイヤは、絆Lvぶんでつ。' },
    ],
    donation: [
      { e:'normal',   t:'寄付でつ。累計絆経験値と同じ数のダイヤを受け取れまつ。' },
      { e:'troubled', t:'寄付した子は戻ってきません。本当によろしいでつか？' },
      { e:'wink',     t:'まとめて選べまつが、編成が崩れないかだけご確認を。' },
      { e:'happy',    t:'虹のプシュケーも、もらえまつよ♪' },
      { e:'normal',   t:'迷っているなら、今日は見送るのも手でつ。' },
    ],
    pasture: [
      { e:'happy',    t:'お気に入りを最大5体まで、HOMEに出せまつ♪' },
      { e:'normal',   t:'強さには影響しないので、見た目で選んで大丈夫でつ。' },
      { e:'excited',  t:'みんなが歩いているところ、かわいいでつよね♪' },
      { e:'wink',     t:'気分で入れ替えても大丈夫でつ。' },
      { e:'happy',    t:'村がにぎやかになると、私も嬉しいでつ。' },
    ],
    // ---- マーケット・アイテム ----
    market: [
      { e:'normal',   t:'マーケットでつ。円盤石もカードもアイコンも並んでまつ。' },
      { e:'wink',     t:'ダイヤは大事に使いましょ。' },
      { e:'happy',    t:'新しい商品、来ているかもしれませんよ♪' },
      { e:'excited',  t:'アイコンを集めるのも、楽しいでつよね。' },
      { e:'normal',   t:'虹のプシュケーはここでは買えません。クリア報酬でつ。' },
      { e:'happy',    t:'欲しいものがあるなら、少し貯めてからでも♪' },
    ],
    inventory: [
      { e:'normal',   t:'持っているアイテムは、ここでつ。' },
      { e:'wink',     t:'効果と使う相手を見て、いいタイミングで使いましょ♪' },
      { e:'happy',    t:'貯めすぎても意味がないので、使ってしまいましょ。' },
      { e:'normal',   t:'絆ポイントリセットの書は、振り直したいときに便利でつ。' },
      { e:'excited',  t:'虹のプシュケーは、限界突破に使えまつよ♪' },
    ],
    giftClaimable: [
      { e:'excited',  t:'ギフトが届いてまつ♪ 受け取っておきましょ。' },
      { e:'happy',    t:'まとめて受け取れまつよ。' },
      { e:'wink',     t:'受け取り忘れがないか、たまに覗いてみて♪' },
      { e:'normal',   t:'ログインボーナスも、ここに届きまつ。' },
      { e:'happy',    t:'嬉しい知らせでつね♪' },
    ],
    giftEmpty: [
      { e:'normal',   t:'いまは届いているギフトは、ないみたいでつ。' },
      { e:'happy',    t:'また明日、覗いてみましょ♪' },
      { e:'wink',     t:'ミッションを達成すると、ここに届きまつよ。' },
      { e:'troubled', t:'空っぽでつね…。少し寂しいでつ。' },
      { e:'normal',   t:'ログインを続けると、順番にもらえまつ。' },
    ],
    missionsClaimable: [
      { e:'excited',  t:'達成したミッションがありまつ♪ 受け取りましょ。' },
      { e:'happy',    t:'まとめて受け取れまつよ。' },
      { e:'wink',     t:'受け取ると、仲良し度も少し増えまつ♪' },
      { e:'normal',   t:'デイリーは毎日、ウィークリーは毎週でつ。' },
      { e:'happy',    t:'こつこつ進んでいまつね♪' },
    ],
    missionsNormal: [
      { e:'normal',   t:'ミッションの進み具合は、ここで見られまつ。' },
      { e:'wink',     t:'ふつうに遊んでいれば、自然と進みまつよ♪' },
      { e:'happy',    t:'デイリーは毎日リセットされまつ。' },
      { e:'normal',   t:'ウィークリーは、少し大きめの報酬でつ。' },
      { e:'excited',  t:'あと少しで達成できそうなものも、ありまつね♪' },
    ],
    // ---- プロフィール・設定・ヘルプ ----
    profile: [
      { e:'normal',   t:'名前・アイコン・これまでの記録は、ここでつ。' },
      { e:'happy',    t:'自分らしいプロフィールにしましょ♪' },
      { e:'wink',     t:'アイコンはptで買えまつよ。集めるの、楽しいでつよね。' },
      { e:'excited',  t:'記録を見返すと、成長がわかって面白いでつ♪' },
      { e:'normal',   t:'助手の変更も、この画面からできまつよ。' },
      { e:'happy',    t:'私との仲良し度も、ここで見られまつ♪' },
    ],
    settings: [
      { e:'normal',   t:'音量やBGMは、ここで調整できまつ。' },
      { e:'wink',     t:'BGMアレンジで、曲の雰囲気も変えられまつよ♪' },
      { e:'happy',    t:'引き継ぎコード、ときどき控えておくと安心でつ。' },
      { e:'normal',   t:'好みの音量にして、快適に遊びましょ♪' },
      { e:'excited',  t:'ヘルプも、ここから開けまつよ。' },
    ],
    helpTop: [
      { e:'normal',   t:'ヘルプでつ。気になるカテゴリから開いてみましょ。' },
      { e:'wink',     t:'私の吹き出しをタップすると、詳しい説明が出まつよ♪' },
      { e:'happy',    t:'分からないことがあったら、まずはここでつ。' },
      { e:'normal',   t:'カテゴリ → 項目 → 説明の、3段階になってまつ。' },
      { e:'excited',  t:'読んでいると、新しい発見があるかもしれません♪' },
      { e:'happy',    t:'右上のボタンで、私の吹き出しを閉じられまつ。' },
    ],
  },
  // 条件つきのセリフ(初回・記録更新・受け取り可能など)
  conditions: {
    home: {
      firstRun: [
        { e:'excited',  t:'いよいよ冒険のはじまり。まずはバトルへ行ってみましょ♪' },
        { e:'happy',    t:'最初は難易度Beginnerで、じゅうぶんでつよ。' },
        { e:'wink',     t:'1回遊ぶとマスモンを登録できまつ。そこからが本番ですね。' },
        { e:'normal',   t:'迷ったらバトルへ。やってみるのが一番わかりまつ。' },
        { e:'happy',    t:'私がついてまつから、安心して行ってらっしゃい♪' },
      ],
      bondUp: [
        { e:'happy',    t:'{name}、なんだか前より話しやすくなりまつね♪' },
        { e:'excited',  t:'{name}、これからもよろしくお願いしまつ！' },
        { e:'wink',     t:'{name}、たくさん遊んでくれてありがとうでつ♪' },
        { e:'happy',    t:'{name}…うん、この呼び方がしっくりきまつ。', bond:4 },
        { e:'normal',   t:'{name}、私はちゃんと見てまつからね。' },
      ],
    },
    resultWin: {
      newRecord: [
        { e:'excited',  t:'自己ベスト更新、おめでとうございまつ♪' },
        { e:'excited',  t:'記録更新でつ！ ランキングも見てみましょ。' },
        { e:'happy',    t:'新記録でつね。この編成、当たりでつ♪' },
        { e:'surprise', t:'すごい…！ 次はどこまで伸びるんでしょうね。' },
        { e:'happy',    t:'ベスト更新、私も嬉しいでつ♪' },
      ],
      firstWin: [
        { e:'excited',  t:'はじめての優勝、おめでとうございまつ♪' },
        { e:'excited',  t:'やりましたね…！ 記念すべき1勝目でつ。' },
        { e:'happy',    t:'ついにクリアでつね。ここまでよく頑張りました♪' },
        { e:'surprise', t:'えっ、もう勝ってしまいまつか。すごいでつ…！' },
        { e:'happy',    t:'初優勝でつ。この子は登録しておきましょ♪' },
      ],
      firstClear: [
        { e:'excited',  t:'この難易度、初クリアでつね。おめでとうございまつ♪' },
        { e:'happy',    t:'初制覇でつ。大きな一歩ですね♪' },
        { e:'excited',  t:'やりましたね！ 次の難易度も見えてきまつ。' },
        { e:'happy',    t:'はじめてのクリア。ちゃんと強くなってまつよ。' },
        { e:'wink',     t:'初クリア記念でつ。この勇者モン、大事にしましょ♪' },
      ],
    },
    resultLose: {
      firstLose: [
        { e:'troubled', t:'はじめての負けでつね。でも大丈夫、みんな通る道でつ。' },
        { e:'happy',    t:'負けても経験値は入りまつよ。ここからが本番でつ♪' },
        { e:'crying',   t:'悔しいでつね…。でも、けっこう惜しかったと思いまつ。' },
        { e:'normal',   t:'次はどこを直しまつか？ 一緒に考えましょ。' },
        { e:'wink',     t:'一回負けたくらいで終わりませんよね。リベンジでつ♪' },
      ],
    },
    market: {
      lowGold: [
        { e:'troubled', t:'ダイヤが心もとないでつね…。' },
        { e:'normal',   t:'ミッションとログインボーナスで、少しずつ貯まりまつよ。' },
        { e:'happy',    t:'寄付でも、ダイヤは手に入りまつ♪' },
        { e:'wink',     t:'今日は見るだけにしておきまつか？' },
        { e:'normal',   t:'焦らなくて大丈夫。少しずつでいきましょ。' },
      ],
    },
    missionsClaimable: {
      allDone: [
        { e:'excited',  t:'ぜんぶ達成でつ…！ お見事でつね♪' },
        { e:'happy',    t:'完璧でつ。今日はよく遊びましたね♪' },
        { e:'surprise', t:'全部…！ すごいでつ。' },
        { e:'wink',     t:'また明日、新しいミッションが来まつよ♪' },
        { e:'happy',    t:'お疲れさまでつ。ゆっくり休みましょ。' },
      ],
    },
  },
});

// ---------- セリフが「どの助手のものか」を決める ----------
// 助手が増えても画面側は何も変えなくて済むよう、セリフ1件ずつに who(助手id)を持たせ、
// 抽選するときに、いま選ばれている助手のものだけへ絞る。
//
//   ・ASSISTANT_SCENES へ直接書いたセリフ … みゅあのもの(これまでの資産をそのまま活かす)
//   ・束(line pack)で足したセリフ        … 束の assistantId のもの。書かなければみゅあ
//
// who を後から書き換えないこと。みゅあのセリフをききが話すと、性格が混ざって台無しになる。
const stampAssistantOnLines = (lines, assistantId) =>
  (Array.isArray(lines) ? lines : []).map(line => (line && line.who) ? line : { ...line, who: assistantId });
// ASSISTANT_SCENES へ直接書いてあるぶんへ、みゅあの印をつける(束より先に1回だけ)
const stampSceneAuthoredLines = () => {
  for (const def of Object.values(ASSISTANT_SCENES)) {
    if (!def) continue;
    if (Array.isArray(def.lines)) def.lines = stampAssistantOnLines(def.lines, DEFAULT_ASSISTANT_ID);
    if (def.when) {
      for (const [cond, list] of Object.entries(def.when)) {
        if (Array.isArray(list)) def.when[cond] = stampAssistantOnLines(list, DEFAULT_ASSISTANT_ID);
      }
    }
  }
};
stampSceneAuthoredLines();

// 束を ASSISTANT_SCENES へ合流させる。二重に合流しないよう、済んだ束は覚えておく
//   lines      … { 場面キー: [ …セリフ… ] } を通常のセリフへ足す
//   conditions … { 場面キー: { 条件キー: [ …セリフ… ] } } を条件つきのセリフへ足す
//   assistantId… その束が誰のセリフか(省略するとみゅあ)
const ASSISTANT_PACKS_APPLIED = {};
const applyAssistantLinePacks = () => {
  for (const pack of ASSISTANT_LINE_PACKS) {
    if (ASSISTANT_PACKS_APPLIED[pack.id]) continue;
    if (typeof pack.when === 'function') { try { if (!pack.when()) continue; } catch { continue; } }
    const who = pack.assistantId || DEFAULT_ASSISTANT_ID;
    for (const [sceneKey, lines] of Object.entries(pack.lines)) {
      const def = ASSISTANT_SCENES[sceneKey];
      if (!def || !Array.isArray(lines)) continue;
      if (!Array.isArray(def.lines)) def.lines = [];
      def.lines = def.lines.concat(stampAssistantOnLines(lines, who).map(line => ({ ...line, pack: pack.id })));
    }
    for (const [sceneKey, byCondition] of Object.entries(pack.conditions || {})) {
      const def = ASSISTANT_SCENES[sceneKey];
      if (!def || !byCondition) continue;
      if (!def.when) def.when = {};
      for (const [cond, lines] of Object.entries(byCondition)) {
        if (!Array.isArray(lines)) continue;
        if (!Array.isArray(def.when[cond])) def.when[cond] = [];
        def.when[cond] = def.when[cond].concat(stampAssistantOnLines(lines, who).map(line => ({ ...line, pack: pack.id })));
      }
    }
    ASSISTANT_PACKS_APPLIED[pack.id] = true;
  }
};
// 読み込み時に1回だけ合流させる(以降は ASSISTANT_SCENES を見るだけで済む)
applyAssistantLinePacks();

// ---------- タップの連打リアクション ----------
// みゅあをタップするたびに次のセリフへ切り替わるが、短い間に何度も押されたときは
// こちらへ切り替える。怒りっぱなしにはせず、最後は笑って元に戻す。
// last:true の行を出したあと ASSISTANT_SPAM_RECOVER_MS 待つと、下の RECOVER を話して通常へ戻る。
const ASSISTANT_SPAM_LINES = [
  { e:'happy',    t:'まだあるよ〜♪' },
  { e:'wink',     t:'そんなに押すの？笑' },
  { e:'surprise', t:'ちゃんと話聞いてる？笑' },
  { e:'angry',    t:'もう〜！押しすぎー！' },
  { e:'troubled', t:'少し休ませてよ〜' },
  { e:'normal',   t:'…………', last:true },
];
const ASSISTANT_SPAM_RECOVER = { e:'happy', t:'……うそだよ♪ いつでも呼んでね！' };
// これ以内に続けてタップされたら「連打」とみなす(ミリ秒)
const ASSISTANT_SPAM_WINDOW_MS = 1200;
// 連打を始めてから、この回数で専用のセリフへ入る
const ASSISTANT_SPAM_THRESHOLD = 3;
// 「…………」のあと、笑って戻るまでの待ち時間(ミリ秒)
const ASSISTANT_SPAM_RECOVER_MS = 2600;

// ---------- はじめての設定(プロフィール画面) ----------
// 初回はプロフィール画面へ入り、そこで名前とアイコンを決める。
// 決まっているものに応じて、みゅあが次にやることを教える。
// ここはランダムにせず話が前へ進む形にし、決定するとそのまま ASSISTANT_TUTORIAL へ続く。
const ASSISTANT_ONBOARDING = {
  // 名前もアイコンもまだ
  intro: { e:'happy',   t:'はじめまして！ あたしはみゅあ、このゲームの助手だよ♪ まずはあなたの名前を教えて！' },
  // 名前だけ決まった
  name:  { e:'excited', t:'いい名前じゃーん♪ 次はアイコンを選ぼ！' },
  // アイコンだけ決まった
  icon:  { e:'normal',  t:'アイコンいい感じ！ あとは名前を決めるだけだね。' },
  // 両方そろった
  ready: { e:'wink',    t:'バッチリ！ 「けってい」を押したら、村を案内するよ♪' },
};
// 助手ごとの台本。書かなければ上のみゅあのぶんがそのまま使われる
const ASSISTANT_ONBOARDING_SETS = {
  kiki: {
    intro: { e:'happy',   t:'はじめまして。私はきき、このゲームの助手でつ。まずはお名前を教えてもらえまつか？' },
    name:  { e:'excited', t:'すてきなお名前ですね♪ 次はアイコンを選びましょ。' },
    icon:  { e:'normal',  t:'アイコン、いい感じでつ。あとはお名前だけですね。' },
    ready: { e:'wink',    t:'ばっちりでつ♪ 「けってい」を押したら、村を案内しまつね。' },
  },
};
const assistantOnboardingOf = (assistantId) => ASSISTANT_ONBOARDING_SETS[assistantId] || ASSISTANT_ONBOARDING;
// 決まっているものから、いま話す内容を選ぶ
const findAssistantOnboarding = (hasName, hasIcon, assistantId) => {
  const set = assistantOnboardingOf(assistantId);
  if (hasName && hasIcon) return set.ready;
  if (hasName) return set.name;
  if (hasIcon) return set.icon;
  return set.intro;
};

// ---------- 最初のあいさつ ----------
// 名前を決めるより前に、みゅあが自己紹介する。読み終えるとプロフィール画面へ進む。
// 表示はチュートリアルと同じ吹き出しを使う(kind で台本を切り替える)。
const ASSISTANT_INTRO = [
  { e:'happy',   t:'はじめまして！ あたしはみゅあ。このゲームの助手だよ♪', title:'はじめまして' },
  { e:'excited', t:'これから一緒にモンスターを育てて、最強のチームを作っていこ！', title:'よろしくね' },
  { e:'wink',    t:'まずはあなたのことを教えて！ 名前とアイコンを決めるよ♪', title:'まずは自己紹介から' },
];

// ---------- 初回チュートリアル ----------
// 初めて遊ぶ人だけに出す短い案内。1〜2分で終わる分量にする。
// 各ページは { e:表情, t:本文, help?:'カテゴリid/項目id' }。helpがあれば「詳しく見る」を出せる。
const ASSISTANT_TUTORIAL = [
  { e:'excited', t:'{name}だね、よろしく！ さっそく村を案内するよ♪', title:'あらためて、よろしくね' },
  { e:'normal',  t:'目標はWAVE10のラスボス「ムー」を倒すこと！ カードで戦っていくよ。', title:'このゲームの目的', help:'basics/goal' },
  { e:'normal',  t:'ここがHOME。建物をタップするといろんなことができるよ！', title:'HOMEのこと', help:'home/roster' },
  { e:'wink',    t:'神殿では合体・転生・寄付ができるんだ。育成の土台になるとこだね！', title:'神殿', help:'masu/fusion', spot:'temple' },
  { e:'excited', t:'バトルで活躍した子は「マスモン」として登録できるよ。育てるほど強くなる♪', title:'勇者モンを育てる', help:'masu/masumon', spot:'management' },
  { e:'happy',   t:'バトルは勇者モンを選んで、カードで戦うよ。距離がすっごく大事！', title:'バトル', help:'battle/distance', spot:'battle' },
  { e:'excited', t:'ランキングは「バトル」の中！ モード切替のすぐ下のボタンから見られるよ♪', title:'ランキングはバトルの中', help:'basics/ranking', spot:'battle' },
  { e:'happy',   t:'マーケットではモンスターやカードを買えるよ。ダイヤは大事に使ってね♪', title:'マーケット', help:'home/market', spot:'market' },
  { e:'surprise', t:'ミッションとギフトはこの辺！ 報酬の受け取り忘れに気をつけてね♪', title:'ミッションとギフト', help:'items/missions', spot:'reward' },
  { e:'normal',  t:'ヘルプは右上の「設定」の中！ 遊び方に迷ったら、ここを開いてね。', title:'ヘルプは設定の中', help:'tips/assistant', spot:'settings' },
  { e:'happy',   t:'あたしはここにいるよ。困ったらいつでもタップしてね♪', title:'それじゃあ、いってらっしゃい！', spot:'assistant' },
];

// ---------- きき加入の会話(既存プレイヤーへ1回だけ) ----------
// ききが増える前から遊んでいた人に、アップデート後の初回ログインで一度だけ見せる。
// 新しく始めた人は最初に助手を選ぶので、この会話は出ない。
//
// 【2人の関係】★重要
// みゅあとききは初対面ではなく、もともとの知り合い。
// 「知り合いだった2人が、これから一緒に助手として働くことになった」という空気にする。
// 重い話にはせず、掛け合いと軽いツッコミで短くまとめる。
//
// 【呼び方は固定】★重要
// みゅあ → きき  … 「ひめちん」
// きき  → みゅあ … 「みゅあちん」
// この2人同士の会話なので、プレイヤーへの呼び方(親密度で変わるもの)は使わない。
// そのため本文に {name} を書かないこと。画面側も置き換えを通さずそのまま出す。
//
//   who … だれの発言か(助手id)。画面はこれを見て顔と名前を切り替える
//   e   … そのときの表情
const ASSISTANT_KIKI_INTRO = [
  { who:'mua',  e:'surprise', t:'えっ！？ ひめちんじゃん！ なんでここにいるの！？' },
  { who:'kiki', e:'happy',    t:'お久しぶりでつ、みゅあちん。今日から私も助手をすることになりました♪' },
  { who:'mua',  e:'excited',  t:'マジで！？ ひめちんと一緒に助手とか楽しそうじゃん♪' },
  { who:'kiki', e:'wink',     t:'ふふ、私もびっくりしました。みゅあちん、ちゃんとお仕事できてまつ？' },
  { who:'mua',  e:'angry',    t:'できてるし！ そこ疑うとこじゃないって〜！' },
  { who:'kiki', e:'happy',    t:'それなら安心でつ♪ これからは私も一緒にお手伝いしますね。' },
  { who:'mua',  e:'excited',  t:'よーし！ これからはあたしたち2人でサポートしてくよ♪' },
  { who:'kiki', e:'excited',  t:'改めまして、ききでつ。これからよろしくお願いしまつ♪' },
  // どちらに案内してもらうかは、あくまでプレイヤーが決める(勝手に切り替えない)
  { who:'mua',  e:'wink',     t:'どっちに案内してほしいかは、プロフィールからいつでも選べるよ！' },
  { who:'kiki', e:'normal',   t:'もちろん、このままみゅあちんにお任せでも大丈夫ですよ♪' },
];
// この会話の中だけで使う、2人がお互いを呼ぶ名前。画面の見出しにも使う
const ASSISTANT_KIKI_INTRO_CALLS = { mua: 'ひめちん', kiki: 'みゅあちん' };

// ---------- イベント回想 ----------
// 一度見た会話イベントを、プロフィール画面から何度でも見返せるようにするための一覧。
// 台本(script)は既存のシーン定義をそのまま参照し、ここで二重に持たない。
// 助手加入・特別会話などが増えたら、この配列へ1件足すだけで回想一覧に並ぶ(画面側は共通)。
//
//   id          … イベントの識別子
//   title       … 回想一覧・再生画面に出すタイトル
//   script      … 再生する台本({who,e,t}の配列)。既存のASSISTANT_KIKI_INTROなどをそのまま渡す
//   calls       … 会話の中だけで使う呼び名(あれば)。無いイベントは省略してよい
//   unlockedKey … 「見たことがあるか」を判定する保存キーの呼び名。実際の値はgame-system.jsx側で
//                 解決する(データファイルはgame-system.jsxの定数を参照できないため、ここでは
//                 文字列の名前だけを持つ)
const EVENT_REPLAYS = [
  { id: 'kiki_intro', title: 'きき加入 ～ふたりの助手～', script: ASSISTANT_KIKI_INTRO, calls: ASSISTANT_KIKI_INTRO_CALLS, unlockedKey: 'kikiIntroSeen' },
];

// ---------- 助手ごとのあいさつ・村の案内 ----------
// 光らせる場所(spot)とヘルプ参照(help)は案内の骨組みなので、どの助手でも同じにする。
// 変えるのは言い回しだけ。ここがずれると、説明している場所と光る場所が食い違う。
const ASSISTANT_INTRO_SETS = {
  kiki: [
    { e:'happy',   t:'はじめまして。私はきき、このゲームの助手でつ。', title:'はじめまして' },
    { e:'normal',  t:'これから一緒にモンスターを育てて、強いチームを作っていきましょ。', title:'よろしくお願いしまつ' },
    { e:'wink',    t:'まずはあなたのことを教えてほしいでつ。お名前とアイコンを決めましょ♪', title:'まずは自己紹介から' },
  ],
};
const ASSISTANT_TUTORIAL_SETS = {
  kiki: [
    { e:'happy',   t:'{name}、あらためてよろしくお願いしまつ。さっそく村を案内しまつね♪', title:'あらためて、よろしく' },
    { e:'normal',  t:'目標はWAVE10のラスボス「ムー」を倒すこと。カードで戦っていきまつ。', title:'このゲームの目的', help:'basics/goal' },
    { e:'normal',  t:'ここがHOMEでつ。建物をタップすると、いろんなことができまつよ。', title:'HOMEのこと', help:'home/roster' },
    { e:'wink',    t:'神殿では合体・転生・寄付ができまつ。育成の土台になる場所ですね。', title:'神殿', help:'masu/fusion', spot:'temple' },
    { e:'excited', t:'バトルで活躍した子は「マスモン」として登録できまつ。育つほど強くなりまつよ♪', title:'勇者モンを育てる', help:'masu/masumon', spot:'management' },
    { e:'happy',   t:'バトルは勇者モンを選んで、カードで戦いまつ。距離がとても大事でつ。', title:'バトル', help:'battle/distance', spot:'battle' },
    { e:'normal',  t:'ランキングは「バトル」の中。モード切替のすぐ下のボタンから見られまつ。', title:'ランキングはバトルの中', help:'basics/ranking', spot:'battle' },
    { e:'happy',   t:'マーケットではモンスターやカードを買えまつ。ダイヤは大事に使いましょ♪', title:'マーケット', help:'home/market', spot:'market' },
    { e:'surprise', t:'ミッションとギフトはこのあたりでつ。受け取り忘れにご注意を♪', title:'ミッションとギフト', help:'items/missions', spot:'reward' },
    { e:'normal',  t:'ヘルプは右上の「設定」の中でつ。遊び方に迷ったら、ここを開いてみて。', title:'ヘルプは設定の中', help:'tips/assistant', spot:'settings' },
    { e:'happy',   t:'私はここにいまつ。困ったら、いつでもタップしてほしいでつ♪', title:'それでは、いってらっしゃい', spot:'assistant' },
  ],
};
const assistantIntroPages = (assistantId) => ASSISTANT_INTRO_SETS[assistantId] || ASSISTANT_INTRO;
const assistantTutorialPages = (assistantId) => ASSISTANT_TUTORIAL_SETS[assistantId] || ASSISTANT_TUTORIAL;

// ---------- バトルチュートリアルの初回案内 ----------
// バトルの練習を未完了の人へ、ログイン後のHOMEで一度だけ見せる。
// 実際の練習台本とは分け、断った場合も「視聴済み」にはしない。
const ASSISTANT_BATTLE_TUTORIAL_GUIDE = [
  { e:'excited', t:'バトルチュートリアルが新しく追加されたよ♪', title:'新しいれんしゅうができたよ！' },
  { e:'normal', t:'Monster Heroのバトルはちょっと特殊だから、最初にやっておくと遊び方が分かりやすいと思うよ！', title:'バトルを動かして覚えよう' },
  { e:'wink', t:'今から一緒にやってみる？', title:'どうする？', offer:'battleGuide' },
  { e:'happy', t:'わかったよ♪ あとからでも「設定 → ヘルプ」からいつでも見られるから、分からなくなったら見てみてね！', title:'いつでも待ってるね', declined:true },
];
// 助手ごとの案内。offer / declined の役割は変えず、言い回しだけ差し替える
const ASSISTANT_BATTLE_TUTORIAL_GUIDE_SETS = {
  kiki: [
    { e:'excited', t:'バトルチュートリアルが新しく追加されまつた♪', title:'新しいれんしゅうがありまつ' },
    { e:'normal', t:'Monster Heroのバトルは少し特殊なので、先にやっておくと分かりやすいと思いまつ。', title:'動かして覚えましょ' },
    { e:'wink', t:'今から一緒に、やってみまつか？', title:'どうしまつか？', offer:'battleGuide' },
    { e:'happy', t:'わかりまつた♪ あとからでも「設定 → ヘルプ」からいつでも見られまつから、迷ったら覗いてみて。', title:'いつでも待ってまつ', declined:true },
  ],
};
const assistantBattleGuidePages = (assistantId) =>
  ASSISTANT_BATTLE_TUTORIAL_GUIDE_SETS[assistantId] || ASSISTANT_BATTLE_TUTORIAL_GUIDE;

// ---------- バトルチュートリアル(操作しながら覚える) ----------
// 専用の画面は作らず、ふだんのバトル画面の上にみゅあの吹き出しとハイライトを重ねて進める。
// 台本をここに置いてあるので、呼び出し口(いまはデバッグ設定)を変えるだけで
// 「初回起動で自動」「ヘルプからいつでも」へ移せる。
//
// 【1ステップの書き方】
//   at    … その画面(gameState)にいるときに出す。'*' はどの画面でも出す
//   spot  … 光らせる場所のキー。画面側が battleTutorialSpot と見比べて光らせる。
//            1つの操作で2か所を光らせたいときは配列で書ける(例: 一覧とその決定ボタン)
//   wait  … 'next' つぎへボタンで進む / 'act' プレイヤーが操作して画面が変わるのを待つ /
//            'end' ここで終わり
//   e,t   … 表情とセリフ。t の {name} はそのときの呼び方に置き換わる
//   title … 吹き出しの小見出し(省略可)
//
// 【ステップを足すとき】
//   この配列へ1件足すだけ。画面側は spot のキーに合わせて
//   battleTutorialSpotClass('キー') を付けておく。
//
// 【並べ方のきまり】
//   「説明(next) → 操作(act) → 画面が変わる → 説明(next) → …」の順に並べる。
//   いきなり act から始めるとその画面の説明が出ないまま操作モードになってしまうので、
//   操作させたい画面には必ずその手前に説明のステップ(同じ at・同じ spot)を置く。
//   説明のステップにも spot を書いておくと、読んでいる間から光って場所が分かる。
// バトルのれんしゅうは「導入 → 本体 → しめくくり」の3つに分けて持つ。
// 本体(勇者モン選択からの操作説明)は入口が変わっても中身が同じなので、
// 新旧どちらの導入からも同じ配列を使い回す。
//
//   V1 … いまの本番の入口(BATTLE_MENU のタブと難易度カード)から始める
//   V2 … 新しい入口(バトルモード選択 → 難易度選択)から始める。まだお試しのみ
const ASSISTANT_BATTLE_TUTORIAL_INTRO_V1 = [
  // バトルの入口。モード・ランキング・難易度をここで一度に説明する
  { id:'intro',        at:'BATTLE_MENU',   e:'excited', title:'バトルのれんしゅう', t:'{name}、ここからは実際に動かして覚えよ！ あたしが横で見てるからね♪', wait:'next' },
  { id:'modeTalk',     at:'BATTLE_MENU',   e:'normal',  title:'2つのモード', t:'チャレンジは記録が残る本番。クイックは気軽に遊ぶモードだよ。', spot:'modeTabs', wait:'next' },
  { id:'rankTalk',     at:'BATTLE_MENU',   e:'happy',   title:'ランキング', t:'チャレンジのスコアは、ここのランキングに載るんだ♪', spot:'rankingBtn', wait:'next' },
  { id:'diffTalk',     at:'BATTLE_MENU',   e:'normal',  title:'難易度を選ぶ', t:'左右にスワイプして選ぶよ。難しいほど報酬の倍率も上がるの。', spot:'difficulty', wait:'next' },
  { id:'startTalk',    at:'BATTLE_MENU',   e:'wink',    title:'ビギナーで挑戦', t:'今回は練習だから、ビギナーのチャレンジをやってみよ！', spot:'battleStart', wait:'next' },
  { id:'start',        at:'BATTLE_MENU',   e:'excited', title:'押してみて！', t:'「この難易度で挑戦」を押すとバトルが始まるよ♪', spot:'battleStart', wait:'act' },
];
// 新しい入口の導入。モード選択でチャレンジ・クイック・プロの3つを見せてから、
// チャレンジを選んで難易度選択へ進み、ビギナーで始める。
// クイックとプロは「こういうモードがあるよ」と見せるだけで、初回には遊ばせない
const ASSISTANT_BATTLE_TUTORIAL_INTRO_V2 = [
  { id:'intro',        at:'BATTLE_MODE_SELECT',       e:'excited', title:'バトルのれんしゅう', t:'{name}、ここからは実際に動かして覚えよ！ あたしが横で見てるからね♪', wait:'next' },
  { id:'modeTalk',     at:'BATTLE_MODE_SELECT',       e:'normal',  title:'まずはモード選び', t:'バトルは3つのモードから選ぶよ。左右にスワイプすると、ぐるぐる回せるんだ♪', spot:'modeCards', wait:'next' },
  { id:'modeChallenge',at:'BATTLE_MODE_SELECT',       e:'happy',   title:'チャレンジモード', t:'いま出てるのがチャレンジ。強化を自分で選んでスコアを伸ばす、いちばん基本のモードだよ。', spot:'modeCards', wait:'next' },
  { id:'modeQuick',    at:'BATTLE_MODE_SELECT',       e:'wink',    title:'クイックモード', t:'となりはクイック。育成用のモードで、短い時間で何周も回せて経験値が1.5倍もらえるの。', spot:'modeCards', wait:'next' },
  { id:'modePro',      at:'BATTLE_MODE_SELECT',       e:'surprise',title:'プロモード', t:'その先はプロ。育てた子に頼らず、ベースモンだけで挑む特殊モードだよ…！', spot:'modeCards', wait:'next' },
  { id:'modeDetail',   at:'BATTLE_MODE_SELECT',       e:'normal',  title:'くわしく知りたいとき', t:'カードの「このモードの説明」を押すと、どのモードも同じ並びで細かく読めるよ。', spot:'modeCards', wait:'next' },
  { id:'rankTalk',     at:'BATTLE_MODE_SELECT',       e:'happy',   title:'ランキング', t:'上のタブでブリーダーLvと絆Lvのランキング、カードのボタンでモードごとのスコアランキングが見られるよ♪', spot:'modeRankTabs', wait:'next' },
  { id:'modePick',     at:'BATTLE_MODE_SELECT',       e:'wink',    title:'今日はチャレンジで', t:'最初はチャレンジがおすすめ！ 「難易度を選ぶ」を押してみて♪', spot:'modeStart', wait:'act' },
  { id:'diffTalk',     at:'BATTLE_DIFFICULTY_SELECT', e:'normal',  title:'難易度を選ぶ', t:'左右にスワイプして選ぶよ。難しいほど報酬の倍率も上がるの。', spot:'difficulty', wait:'next' },
  { id:'diffDefault',  at:'BATTLE_DIFFICULTY_SELECT', e:'happy',   title:'まん中はノーマル', t:'開いたときはいつもノーマルから。今日は左へ寄せてビギナーにしてあるよ♪', spot:'difficulty', wait:'next' },
  { id:'startTalk',    at:'BATTLE_DIFFICULTY_SELECT', e:'wink',    title:'ビギナーで挑戦', t:'今回は練習だから、いちばんやさしいビギナーをやってみよ！', spot:'battleStart', wait:'next' },
  { id:'start',        at:'BATTLE_DIFFICULTY_SELECT', e:'excited', title:'押してみて！', t:'「この難易度で挑戦」を押すとバトルが始まるよ♪', spot:'battleStart', wait:'act' },
];
// ここから先は入口によらず同じ。勇者モン選択からWAVEクリア・強化フェーズまで
const ASSISTANT_BATTLE_TUTORIAL_BODY = [
  // 勇者モンを選ぶ
  { id:'heroTalk',     at:'PICK_HERO',     e:'happy',   title:'まずは勇者モン', t:'主役になる子が勇者モン。この中から1体えらぶよ！', spot:['monCards','monDecide'], wait:'next' },
  { id:'hero',         at:'PICK_HERO',     e:'wink',    title:'えらんでみよう', t:'好きな子を押して、出てきた画面で「決定」だよ♪', spot:['monCards','monDecide'], wait:'act' },
  // 置く距離を決める
  { id:'slotTalk',     at:'PICK_SLOT',     e:'normal',  title:'置く距離を決めよう', t:'次は立ち位置。敵と同じ距離だと大ダメージなんだ！', spot:'slots', wait:'next' },
  { id:'slot',         at:'PICK_SLOT',     e:'wink',    title:'枠を押してね', t:'好きな距離の枠をタップしてみて♪', spot:'slots', wait:'act' },
  // ブリーダーの教えを持ち込む
  { id:'teachingTalk', at:'PICK_TEACHING', e:'normal',  title:'ブリーダーの教え', t:'バトル中に使える助っ人カードだよ。ここで持ち込むの。', spot:'teachings', wait:'next' },
  { id:'teaching',     at:'PICK_TEACHING', e:'happy',   title:'1つ選ぼう', t:'好きな教えを1つ押してね♪', spot:'teachings', wait:'act' },
  // バトル。まず画面の見かたを上から順に、そのあとは台本どおりの敵と戦いながら
  // ガード → 必殺技 → ブリーダーカード → 緊急回復と敵の移動 → 距離技 → 攻撃 →
  // 技変更 → 固有技、を1つずつ操作してもらう
  { id:'battle',       at:'BATTLE',        e:'excited', title:'バトル開始！', t:'いよいよ本番！ 画面の見かたから順番に教えるね♪', wait:'next' },
  { id:'waveTalk',     at:'BATTLE',        e:'normal',  title:'上のバー', t:'今のWAVEとターン数だよ。20ターン以内に敵を倒せないと負けちゃう。', spot:'waveInfo', wait:'next' },
  { id:'enemyTalk',    at:'BATTLE',        e:'normal',  title:'相手の情報', t:'敵の名前・いる距離・HPバー。距離はこまめに変わるから要チェック！', spot:'enemyBar', wait:'next' },
  { id:'scanTalk',     at:'BATTLE',        e:'happy',   title:'敵をくわしく', t:'右上の「解析」を押すと、敵の技や次に何をしてくるかまで見られるよ。', spot:'enemyBar', wait:'next' },
  { id:'heroTalk2',    at:'BATTLE',        e:'normal',  title:'自分の情報', t:'左上の「ステータス」で、自分のHP・力・丈夫さ・ガッツを確認できるよ。', spot:'heroStatus', wait:'next' },
  { id:'slotTalk2',    at:'BATTLE',        e:'wink',    title:'4つの距離枠', t:'仲間が並んでる枠が距離。敵と同じ距離の子ほど大ダメージを出せるよ！', spot:'battleSlots', wait:'next' },
  { id:'cards',        at:'BATTLE',        e:'normal',  title:'手札のカード', t:'下にあるのが今つかえるカード。ガッツが足りる子だけ光ってるよ。', spot:'cards', wait:'next' },
  { id:'cardKinds',    at:'BATTLE',        e:'normal',  title:'カードの種類', t:'攻めの攻撃カード、ダメージを減らすガードカード、力を底上げするブリーダーカードがあるよ。', spot:'cards', wait:'next' },
  { id:'limitTalk',    at:'BATTLE',        e:'normal',  title:'使える枚数', t:'1ターンに出せる枚数はここ。勇者モンの特性で増えることもあるんだ♪', spot:'cardCount', wait:'next' },
  { id:'cardOrder',    at:'BATTLE',        e:'surprise',title:'2枚目からは半減', t:'同じターンに攻撃やガードを重ねると2枚目から効果が半分。ブリーダーカードは半減しないよ。', spot:'cards', wait:'next' },
  { id:'deckTalk',     at:'BATTLE',        e:'happy',   title:'山札のこと', t:'「VIEW」で山札と使い終わったカードを確認できるよ。無くなったら混ぜ直すの。', spot:'deckView', wait:'next' },
  // ① 敵の攻撃予告 → ガードで受ける
  { id:'intentTalk',   at:'BATTLE',        e:'surprise',title:'敵の攻撃予告！', t:'敵の下に次の行動と予測ダメージが出てるよ。今ターンは殴ってくる！', spot:'enemyIntent', wait:'next' },
  { id:'guardTalk',    at:'BATTLE',        e:'normal',  title:'ガードで受けよう', t:'ガードカードを選んで、ACTIONを押してみて。ダメージがぐっと減るよ！', spot:'cards', wait:'next' },
  { id:'guardDo',      at:'BATTLE',        e:'wink',    title:'ガードを使ってみて', t:'ガードカード → ACTION の順だよ♪', spot:'cards', wait:'do', need:'guard' },
  { id:'guardSeen',    at:'BATTLE',        e:'happy',   title:'ほぼ無傷！', t:'見て、ライフがほとんど減ってないでしょ？ これがガードの力だよ♪', wait:'next' },
  // ② 必殺技を魅せる
  { id:'chargeTalk',   at:'BATTLE',        e:'surprise',title:'必殺技が来る！', t:'敵の下の予告を見て！ 必殺技はふつうの攻撃よりずっと痛いよ。', spot:'enemyIntent', wait:'next' },
  { id:'chargeReady',  at:'BATTLE',        e:'normal',  title:'もう一度ガード', t:'必殺技もガードで受け止められるよ。手札のガードを見て！', spot:'cards', wait:'next' },
  { id:'chargeDo',     at:'BATTLE',        e:'excited', title:'受け止めよう！', t:'ガードカードを選んでACTIONだよ♪', spot:'cards', wait:'do', need:'guard' },
  { id:'chargeSeen',   at:'BATTLE',        e:'surprise',title:'さすがに痛い！', t:'ガードしてもこれだけ減るんだ。必殺技の予告が出たら気をつけてね。', wait:'next' },
  // ③ ブリーダーカードでバフ
  { id:'breederTalk',  at:'BATTLE',        e:'happy',   title:'ブリーダーカード', t:'次はブリーダーカード。おりょうの力で、こっちの攻撃力が上がるよ！', spot:'cards', wait:'next' },
  { id:'breederDo',    at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'ブリーダーカードを選んでACTION！ 攻撃UPの表示が出るよ♪', spot:'cards', wait:'do', need:'teaching' },
  { id:'breederSeen',  at:'BATTLE',        e:'happy',   title:'攻撃アップ！', t:'「攻撃UP!」って出たでしょ？ この効果はバトルの最後まで続くよ♪', wait:'next' },
  // ④ 緊急回復と敵の移動
  { id:'emergTalk',    at:'BATTLE',        e:'normal',  title:'緊急回復', t:'左の「緊急」はライフとガッツが3割もどるよ。そのターンは攻撃できないの。', spot:'emergency', wait:'next' },
  { id:'emergDo',      at:'BATTLE',        e:'wink',    title:'押してみて', t:'「緊急」を押してみて！ 敵も動くから、そこも見ててね♪', spot:'emergency', wait:'do', need:'emergency' },
  { id:'moveTalk',     at:'BATTLE',        e:'surprise',title:'敵が動いた！', t:'敵は距離を変えてくるよ。離れられると攻撃が当たりにくくなるの。', spot:'enemyBar', wait:'next' },
  // ⑤ 距離技で引き戻す
  { id:'rangeTalk',    at:'BATTLE',        e:'excited', title:'距離技で引き戻す', t:'距離技は、当てたあと敵をその距離まで引っぱってこられるんだ！', spot:'cards', wait:'next' },
  { id:'rangeDo',      at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'距離技を選んで、モッチーの枠をタップ → ACTION だよ♪', spot:'cards', wait:'do', need:'range_atk' },
  { id:'rangeSeen',    at:'BATTLE',        e:'excited', title:'引き戻せた！', t:'敵の距離が変わったでしょ？ 離されても距離技で連れ戻せるんだ♪', spot:'enemyBar', wait:'next' },
  // ⑥ 通常攻撃
  { id:'atkTalk',      at:'BATTLE',        e:'happy',   title:'距離がそろった！', t:'敵と同じ距離になったね。この状態の攻撃がいちばん強いよ！', spot:'battleSlots', wait:'next' },
  { id:'atkReady',     at:'BATTLE',        e:'normal',  title:'攻撃カード', t:'手札の攻撃カードを使ってみよう。距離が合ってるとよく効くよ！', spot:'cards', wait:'next' },
  { id:'atkDo',        at:'BATTLE',        e:'wink',    title:'攻撃してみて', t:'攻撃カード → 枠をタップ → ACTION！', spot:'cards', wait:'do', need:'atk' },
  { id:'atkSeen',      at:'BATTLE',        e:'happy',   title:'よく入った！', t:'敵のHPがぐっと減ったね。距離がそろってると威力が全然ちがうんだ♪', spot:'enemyBar', wait:'next' },
  // ⑦ 技変更
  { id:'skillTalk',    at:'BATTLE',        e:'normal',  title:'技は変えられる', t:'カードの名前は点線になってるでしょ？ そこをタップすると技を選び直せるの。', spot:'cards', wait:'next' },
  { id:'skillPoint',   at:'BATTLE',        e:'wink',    title:'ここが技の名前', t:'光ってる攻撃カードの、絵の下・ガッツの上にある文字のところだよ♪', spot:'cards', wait:'next', needCard:'atk' },
  { id:'skillTwice',   at:'BATTLE',        e:'normal',  title:'2回タップするよ', t:'1回目でカードを選んで、もう1回おなじ名前を押すと一覧が開くの。', spot:'cards', wait:'next', needCard:'atk' },
  { id:'skillDo',      at:'BATTLE',        e:'excited', title:'名前を2回タップ', t:'光ってる名前をトントンって押してみて！ 技の一覧が出てくるよ。', spot:'cards', wait:'do', need:'skillPicker', needCard:'atk' },
  { id:'skillSeen',    at:'BATTLE',        e:'happy',   title:'これが技の一覧', t:'威力・消費ガッツ・会心率が並んでたでしょ？ 使う技はここで選び直せるよ♪', wait:'next' },
  { id:'skillLock',    at:'BATTLE',        e:'normal',  title:'暗い技があったよね', t:'通常技と距離技は、その距離の補正値が高いほど強いものまで使えるようになるの。', wait:'next' },
  { id:'skillNow',     at:'BATTLE',        e:'surprise',title:'今は補正が0%', t:'だから今は下のほうの技しか選べないんだ。育てて補正を上げると解放されるよ！', spot:'battleSlots', wait:'next' },
  // ⑧ 固有技でトドメ
  { id:'uniqueTalk',   at:'BATTLE',        e:'excited', title:'最後は固有技！', t:'固有技はその子だけの必殺技。ガッツは重いけど、とにかく強いよ！', spot:'cards', wait:'next' },
  { id:'uniqueLevel',  at:'BATTLE',        e:'happy',   title:'固有技は育つ', t:'バトルを進めて供モンが合流するとき、固有技のレベルを上げられるんだ♪', spot:'cards', wait:'next' },
  { id:'act',          at:'BATTLE',        e:'excited', title:'トドメだ！', t:'固有技を選んで枠をタップ → ACTIONで倒しちゃお♪', spot:'cards', wait:'act', need:'unique' },
  // WAVEクリア
  { id:'clear',        at:'WAVE_RESULT',   e:'excited', title:'WAVEクリア！', t:'ナイス{name}！ 敵を倒しきるとWAVEクリアだよ♪', spot:'waveNext', wait:'next' },
  { id:'clearNext',    at:'WAVE_RESULT',   e:'happy',   title:'次へ進もう', t:'「次へ進む」を押すと強化フェーズだよ！', spot:'waveNext', wait:'act' },
  // 強化フェーズ
  { id:'rewardTalk',   at:'REWARD_PICK',   e:'happy',   title:'能力アップ', t:'クリアのたびに強くなれる！ 3つから1つ選べるんだ。', spot:'rewards', wait:'next' },
  { id:'reward',       at:'REWARD_PICK',   e:'wink',    title:'選んでみて', t:'好きな強化を1つ押してね♪', spot:'rewards', wait:'act' },
];
// しめくくり。ここだけは入口によって話す中身が変わる(モードの数がちがうため)
const ASSISTANT_BATTLE_TUTORIAL_OUTRO_V1 = [
  // 覚えておいてほしいこと
  { id:'ally',         at:'*',             e:'normal',  title:'このあとは', t:'WAVE2・4・6では供モンが合流するよ。ステータスがそのまま足されるんだ！', wait:'next' },
  { id:'unique',       at:'*',             e:'happy',   title:'固有技のこと', t:'勇者モンの固有技は、レベルが上がるほど強くなるよ。育てるほど頼りになる♪', wait:'next' },
  { id:'modeAfter',    at:'*',             e:'normal',  title:'モードの使い分け', t:'記録に挑むならチャレンジ、育成を回すならクイックだよ♪', wait:'next' },
  { id:'wrapUp',       at:'*',             e:'excited', title:'おつかれさま！', t:'これでバトルのれんしゅうは終わり！ 一連の流れはバッチリだね♪', wait:'next' },
  { id:'end',          at:'*',             e:'happy',   title:'いってらっしゃい！', t:'困ったらヘルプからいつでもこの練習をやり直せるよ。がんばってね{name}！', wait:'end' },
];
const ASSISTANT_BATTLE_TUTORIAL_OUTRO_V2 = [
  // 覚えておいてほしいこと
  { id:'ally',         at:'*',             e:'normal',  title:'このあとは', t:'WAVE2・4・6では供モンが合流するよ。ステータスがそのまま足されるんだ！', wait:'next' },
  { id:'unique',       at:'*',             e:'happy',   title:'固有技のこと', t:'勇者モンの固有技は、レベルが上がるほど強くなるよ。育てるほど頼りになる♪', wait:'next' },
  { id:'modeAfter',    at:'*',             e:'normal',  title:'モードの使い分け', t:'スコアに挑むならチャレンジ、育てたいならクイック。腕だめしがしたくなったらプロだよ♪', wait:'next' },
  { id:'modeLater',    at:'*',             e:'wink',    title:'あわてなくて大丈夫', t:'クイックもプロも、いつでも選べるからね。まずはチャレンジで慣れていこ！', wait:'next' },
  { id:'wrapUp',       at:'*',             e:'excited', title:'おつかれさま！', t:'これでバトルのれんしゅうは終わり！ 一連の流れはバッチリだね♪', wait:'next' },
  { id:'end',          at:'*',             e:'happy',   title:'いってらっしゃい！', t:'困ったらヘルプからいつでもこの練習をやり直せるよ。がんばってね{name}！', wait:'end' },
];
// いま使うほう。V1がこれまでどおりの本番、V2は新しい入口のお試し
const ASSISTANT_BATTLE_TUTORIAL = [
  ...ASSISTANT_BATTLE_TUTORIAL_INTRO_V1,
  ...ASSISTANT_BATTLE_TUTORIAL_BODY,
  ...ASSISTANT_BATTLE_TUTORIAL_OUTRO_V1,
];
const ASSISTANT_BATTLE_TUTORIAL_V2 = [
  ...ASSISTANT_BATTLE_TUTORIAL_INTRO_V2,
  ...ASSISTANT_BATTLE_TUTORIAL_BODY,
  ...ASSISTANT_BATTLE_TUTORIAL_OUTRO_V2,
];
// いまの画面に合うステップを探す(画面が変わったときに呼ぶ)。
// どちらの台本を使っているかは呼ぶ側が渡す
const findBattleTutorialStep = (fromIndex, screen, steps) => {
  const list = Array.isArray(steps) && steps.length ? steps : ASSISTANT_BATTLE_TUTORIAL;
  for (let i = Math.max(0, fromIndex); i < list.length; i++) {
    const step = list[i];
    if (step.at === '*' || step.at === screen) return i;
  }
  return -1;
};

// ---------- セリフの抽選 ----------
// 場面(と条件)ごとに、直近に出したセリフを覚えておく。
// 直前の1件だけを避けると3〜4回で一巡した感じになってしまうので、
// 候補数に応じて直近数件をまとめて外す。端末には保存しない(見た目だけの話なので
// セーブデータには触らない)。
const ASSISTANT_RECENT = {};
// 直近いくつを候補から外すか。候補が少ないときに全部外れてしまわないよう上限を決める
const assistantRecentLimit = (total) => Math.max(1, Math.min(3, total - 2));

// その場面で使うセリフの候補を返す。
//   ① 条件つきのセリフ(when)があればそちらを優先する
//   ② そこから、いまの仲良し度で出せるものだけに絞る
// 仲良し度で絞った結果が空になったときは、絞る前の一覧をそのまま使う
// (Lvを増やしたときに「話すことが無い」画面ができないようにするための安全弁)
// いま選ばれている助手のセリフだけに絞る。
// その助手のセリフが1つも無い場面では、みゅあのぶんへ落として黙り込まないようにする
// (助手を増やした直後に、まだセリフを書いていない場面があっても画面が止まらない)
const filterAssistantLines = (list, assistantId) => {
  if (!Array.isArray(list) || !list.length) return [];
  const id = assistantId || DEFAULT_ASSISTANT_ID;
  const mine = list.filter(line => (line.who || DEFAULT_ASSISTANT_ID) === id);
  if (mine.length > 0) return mine;
  return list.filter(line => (line.who || DEFAULT_ASSISTANT_ID) === DEFAULT_ASSISTANT_ID);
};

const assistantSceneLines = (scene, condition, bondLevel, assistantId) => {
  // line pack だけで追加されたデバッグ用の場面も取得できるようにする。
  // これが無いと pack のセリフは読み込み時に捨てられ、案内待ちのまま画面が止まる。
  const packedLines = scene ? ASSISTANT_LINE_PACKS.flatMap(pack => Array.isArray(pack.lines?.[scene])
    ? stampAssistantOnLines(pack.lines[scene], pack.assistantId || DEFAULT_ASSISTANT_ID) : []) : [];
  const def = (scene && ASSISTANT_SCENES[scene]) || (packedLines.length ? { lines:packedLines } : null);
  if (!def) return [];
  const conditionalAll = (condition && def.when && Array.isArray(def.when[condition])) ? def.when[condition] : null;
  // 条件つきのセリフは、その助手のものが無ければ通常のセリフへ落とす
  // (みゅあ用の条件セリフを、ききが代わりに話してしまわないようにするため)
  const conditional = conditionalAll ? filterAssistantLines(conditionalAll, assistantId) : null;
  const useConditional = conditional && conditional.length
    && conditional.some(line => (line.who || DEFAULT_ASSISTANT_ID) === (assistantId || DEFAULT_ASSISTANT_ID));
  const list = useConditional ? conditional : filterAssistantLines(def.lines, assistantId);
  if (!Array.isArray(list) || !list.length) return [];
  const lv = Number.isFinite(bondLevel) ? bondLevel : ASSISTANT_BOND_MIN_LEVEL;
  const matched = list.filter(line => assistantLineMatchesBond(line, lv));
  return matched.length > 0 ? matched : list;
};

// セリフの出やすさ。w を書かなければ 1。小さくすると「たまにしか出ないセリフ」になる
const assistantLineWeight = (line) => {
  const w = line && line.w;
  return (Number.isFinite(w) && w > 0) ? w : 1;
};
// 出やすさを考えて1つ選ぶ
const pickWeighted = (pool) => {
  const total = pool.reduce((a, x) => a + assistantLineWeight(x), 0);
  let r = Math.random() * total;
  for (const line of pool) { r -= assistantLineWeight(line); if (r <= 0) return line; }
  return pool[pool.length - 1];
};

// 候補から1つ選ぶ。直近に出したものは候補から外す(候補が少ないときは可能な範囲で)
const pickAssistantLine = (scene, condition, bondLevel, assistantId) => {
  const list = assistantSceneLines(scene, condition, bondLevel, assistantId);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  // 仲良し度で候補が変わるので、覚えておく履歴もLvごとに分ける。
  // 助手ごとにも候補が違うため、履歴も助手ごとに分ける
  const lv = Number.isFinite(bondLevel) ? bondLevel : ASSISTANT_BOND_MIN_LEVEL;
  const key = `${assistantId || DEFAULT_ASSISTANT_ID}|${scene || ''}|${condition || ''}|${lv}`;
  const recent = ASSISTANT_RECENT[key] || [];
  const fresh = list.filter((_, i) => !recent.includes(i));
  const pool = fresh.length > 0 ? fresh : list;
  const picked = pickWeighted(pool);
  const index = list.indexOf(picked);
  ASSISTANT_RECENT[key] = [index, ...recent].slice(0, assistantRecentLimit(list.length));
  return picked;
};

const findAssistant = (id) => ASSISTANTS.find(a => a.id === id)
  || ASSISTANTS.find(a => a.id === DEFAULT_ASSISTANT_ID)
  || ASSISTANTS[0]
  || null;
const findAssistantScene = (key) => (key && ASSISTANT_SCENES[key]) || null;

// ---------- バトルのれんしゅう: シナリオ(台本どおりに動くバトル) ----------
// ふだんのバトルは敵の行動も手札も抽選だが、練習のときだけこの台本どおりに固定して、
// ガード → 必殺技 → ブリーダーカード → 緊急回復と敵の移動 → 距離技 → 攻撃 →
// 技変更 → 固有技でトドメ、という一連の流れを必ず同じ順で見せられるようにする。
//
// 画面側は「台本があるときだけ」この値を使い、ふだんのバトルの抽選には一切触れない。
//
//   hero/slot/teaching … 選ばせるものを1つに絞る(他は押せなくする)
//   enemy…             … 敵・初期距離・ライフ・攻撃力を固定する
//   hand/draw          … 最初の5枚と、そのあと引く順を固定する
//   intents            … 敵の行動を上から順に消費する
//
// ライフと攻撃力の数値は tools/battle-scenario-check.js が実際の計算式で検算している。
// 「途中で倒れない」「固有技で必ず倒せる」「こちらは倒れない」を数値で満たすこと。
const BATTLE_TUTORIAL_SCENARIO = {
  heroId: 'Mocchi',
  slotIndex: 1,          // 近距離。敵の初期位置と同じにして距離補正の効きを見せる
  teachingId: 'oryo',    // おりょうの力(攻撃アップ)。バフの変化が数値で見える
  enemyKey: 'Dino',
  enemyDist: 1,
  enemyHp: 500,          // 距離技＋攻撃では落ちず、固有技で必ず落ちる量
  enemyAtk: 300,         // ガードの有り難みと必殺技の迫力が出る量(こちらは倒れない)
  hand: ['guard', 'guard', 'teaching', 'range_atk', 'atk'],
  draw: ['unique', 'guard', 'atk'],
  intents: [
    { type:'ATTACK' },              // 1ターン目 … 攻撃予告 → ガードで受ける
    { type:'CHARGE' },              // 2ターン目 … 必殺技のためを見せる(ダメージは無い)
    { type:'SPECIAL' },             // 3ターン目 … ためた必殺技が飛んでくる
    { type:'WAIT' },                // 4ターン目 … ブリーダーカードでバフ
    { type:'MOVE', targetDist:3 },  // 5ターン目 … 緊急回復のあいだに遠距離へ移動
    { type:'WAIT' },                // 6ターン目 … 距離技で引き戻す
    { type:'WAIT' },                // 7ターン目 … 通常攻撃
    { type:'WAIT' },                // 8ターン目以降 … 技変更 → 固有技でトドメ
  ],
};
// 台本の敵の行動を順に返す。呼ばれるたびに1つ進む(画面側がindexを持つ)
const battleScenarioIntent = (scenario, index, enemy, currentDist) => {
  if (!scenario || !Array.isArray(scenario.intents) || !enemy) return null;
  const list = scenario.intents;
  const step = list[Math.min(Math.max(0, index), list.length - 1)];
  if (!step) return null;
  const labels = (typeof RANGE_LABELS !== 'undefined' ? RANGE_LABELS : ['零','近','中','遠']);
  if (step.type === 'MOVE') {
    const target = Number.isInteger(step.targetDist) ? step.targetDist : currentDist;
    return { type:'MOVE', value:0, label:`移動: ${labels[target]}`, targetDist:target, icon:'🏃', actionId:'move' };
  }
  const def = (typeof ENEMY_ACTION_DEFINITIONS !== 'undefined' ? ENEMY_ACTION_DEFINITIONS : [])
    .find(d => d.type === step.type) || { multiplier: 0, id:'wait' };
  // 見出しとアイコンは本番の抽選と同じものを使う(台本だけ古い表記になるのを防ぐ)
  const label = typeof enemyActionLabel === 'function' ? enemyActionLabel(enemy, step.type)
    : (step.type === 'ATTACK' ? (enemy.normal || '通常攻撃') : '様子を見ている');
  const icon = (typeof ENEMY_ACTION_ICONS !== 'undefined' && ENEMY_ACTION_ICONS[step.type]) || '⏳';
  return { type:step.type, value:Math.floor(enemy.atk * def.multiplier), label, icon, actionId:def.id };
};
// 台本どおりの並びに手札を組み直す。引く順は山札の末尾から取り出されるので逆に並べる
const orderDeckForScenario = (scenario, pool) => {
  if (!scenario || !Array.isArray(pool) || pool.length === 0) return pool;
  const rest = [...pool];
  const take = (want) => {
    const at = rest.findIndex(c => (want === 'teaching' ? (c.type === 'buff' || c.type === 'heal' || c.type === 'debuff') : c.type === want));
    return at >= 0 ? rest.splice(at, 1)[0] : null;
  };
  const hand = (scenario.hand || []).map(take).filter(Boolean);
  const draw = (scenario.draw || []).map(take).filter(Boolean);
  // 山札は pop() で末尾から引かれるため、引かせたい順の逆に積む
  return [...hand, ...rest, ...draw.reverse()];
};
