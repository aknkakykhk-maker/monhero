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
// 【助手を増やすとき】
//   ASSISTANTS に1件足す。表情画像は images/assistant/<prefix>_<表情>.PNG の形で置き、
//   imagePrefix にその接頭辞を書く。画面側の変更は要らない。
//
// 【場面を増やすとき】
//   ① ASSISTANT_SCENES に場面を1つ足す
//        home: { short:'…', expression:'happy', help:'home/roster' }
//   ② その画面のJSXに1行置く
//        <AssistantBubble scene="home"/>
//   これだけで、吹き出し・表情・タップで開く詳細がすべて同じ見た目で動く。
//   詳細は help(ヘルプの項目をそのまま出す)か detail(自前の文章)のどちらでも書ける。

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
  },
];
const DEFAULT_ASSISTANT_ID = 'mua';

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

// ---------- 場面(scene) → 助手のセリフ ----------
// 画面側は <AssistantBubble scene="キー"/> で呼ぶ。
//   assistantId … だれが話すか(省略すると DEFAULT_ASSISTANT_ID)
//   short       … 吹き出しに出す短いひとこと(スマホで読みやすいよう1〜2文)
//   expression  … 表情。省略すると normal
//   detail      … タップで開く詳しい説明(文字列の配列)
//   help        … 'カテゴリid/項目id'。detail の代わりに、ヘルプ本文をそのまま詳細として開く
//
// バトル中・クイックの成長演出・供モンの加入演出には常設しない(テンポを止めないため)。
// バトル中の案内は「ステータス」やヘルプを開いたときだけ出す。
const ASSISTANT_SCENES = {
  // ---- はじめて／ホーム ----
  onboarding: {
    short: 'はじめまして、あたしはみゅあ！ まずは名前とアイコンを決めよ♪ あとから変えられるから気楽でOK！',
    expression: 'normal',
    help: 'basics/onboarding',
  },
  home: {
    short: '今日も育成いこ〜♪ 編成を整えるか、神殿で育てるか、バトルに挑むか決めよ！',
    expression: 'happy',
    help: 'home/roster',
  },

  // ---- バトルメニュー ----
  // battleChallenge と battleQuick は同じ場所で入れ替わるので、行数が変わって
  // 吹き出しの大きさがモードごとに違って見えないよう、文字数をおおよそそろえておく
  battleChallenge: {
    short: 'ランキング狙いならチャレンジ！ 強化の選び方で差がつくから、自己ベスト更新いこ♪',
    expression: 'happy',
    help: 'basics/battle-modes',
  },
  battleQuick: {
    short: 'サクッと育てるならクイック！ 自動成長はあるけど強化を選べないから、油断禁物ね♪',
    expression: 'wink',
    help: 'basics/battle-modes',
  },
  ranking: {
    short: '上位の編成はマジで参考になるよ！ 難易度や種類を切り替えて、次の目標を決めよ♪',
    expression: 'excited',
    help: 'basics/ranking',
  },

  // ---- ランの準備・進行(選択画面はコンパクト表示で使う) ----
  pickHero: {
    short: '最初の1体は超大事！ 勇者特性と固有技を見て、今回の戦い方を決めよ♪',
    expression: 'normal',
    help: 'battle/hero-trait',
  },
  pickSlot: {
    short: '敵と同じ距離から攻撃すると強いよ！ 得意距離と今の補正を見て置いてね♪',
    expression: 'wink',
    help: 'battle/distance',
  },
  pickAlly: {
    short: '仲間が増えるよ♪ ステータスだけじゃなく、4距離の補正変化も見て選ぼ！',
    expression: 'happy',
    help: 'battle/join-bonus',
  },
  pickTeaching: {
    short: '同じ教えを重ねるとLv2に進化！ 今の強さか完成形か、作戦に合わせて選んでね♪',
    expression: 'wink',
    help: 'growth/teaching',
  },
  rewardPick: {
    short: 'WAVEクリアおつかれ♪ 弱点を埋めるか、強みを伸ばすかで選ぼ！',
    expression: 'happy',
    help: 'growth/awaken',
  },
  // バトル中の案内。「ステータス」を開いたときだけ出す
  battleHelp: {
    short: '迷ったらまず解析！ いちばん効かせたいカードは、最初に置くのがコツだよ♪',
    expression: 'wink',
    help: 'battle/cards',
  },

  // ---- リザルト(優勝・敗北・リタイアで切り替える) ----
  resultWin: {
    short: '優勝おめでとー！ マジで最高♪ 育った勇者モンは、マスモン登録も忘れずにね！',
    expression: 'excited',
    help: 'home/result',
  },
  resultLose: {
    short: '今回はここまで…でも報酬はちゃんともらえるよ。育て直してリベンジしよ！',
    expression: 'crying',
    help: 'home/result',
  },
  resultRetire: {
    short: 'おつかれさま！ クリア済みWAVEぶんの報酬は入るから、結果を確認してね。',
    expression: 'troubled',
    help: 'home/result',
  },

  // ---- スキップチケット ----
  skipPick: {
    short: 'スキップで一気に育成♪ 勇者モン・供モン・使う枚数を確認してから決定してね！',
    expression: 'wink',
    help: 'items/skip-ticket',
  },
  skipResult: {
    short: '受け取り完了♪ スキップ分はランキングやクリア回数には入らないから、そこだけ注意ね。',
    expression: 'happy',
    help: 'items/skip-ticket',
  },

  // ---- M/B管理・モンスター一覧 ----
  mbManagement: {
    short: '解放しただけじゃバトル候補には出ないよ！ 編成に入れて、最後に「決定」まで押してね♪',
    expression: 'normal',
    help: 'home/roster',
  },
  monsterList: {
    short: 'ベースモンは種類の基本、マスモンは育てた個体だよ。見たい方を選んでね♪',
    expression: 'normal',
    help: 'home/roster',
  },
  masuList: {
    short: '育てたマスモンが並んでるよ♪ 絆Lvと未使用ポイントもチェックしてみてね！',
    expression: 'happy',
    help: 'masu/masumon',
  },
  masuEnhance: {
    short: '強化ポイントは適性か能力値に使えるよ。得意な戦い方に合わせて伸ばそ♪',
    expression: 'wink',
    help: 'masu/enhance',
  },

  // ---- 神殿 ----
  temple: {
    short: '神殿では合体・転生・寄付ができるよ。消えるマスモンがいる操作は、確認してから進めてね！',
    expression: 'normal',
  },
  fusion: {
    short: '「主」が残って「副」は消えるよ。絆経験値と固有技の条件をちゃんと確認してね！',
    expression: 'troubled',
    help: 'masu/fusion',
  },
  rebirth: {
    short: '上限まで育てたごほうび♪ Lvは戻るけど、上限＋5と固有技アップが狙えるよ！',
    expression: 'excited',
    help: 'masu/rebirth',
  },
  donation: {
    short: '寄付したマスモンは戻せないよ。ほんとに手放していい子か、もう一回だけ確認してね。',
    expression: 'troubled',
    help: 'masu/donation',
  },

  // ---- ホームの各機能 ----
  pasture: {
    short: 'お気に入りを最大5体までHOMEに出せるよ♪ 強さには影響しないから、見た目で選んでOK！',
    expression: 'happy',
    help: 'home/pasture',
  },
  market: {
    short: 'お買い物タイム♪ アイコンはpt、ほかはダイヤ。買ったモンやカードは編成も忘れずにね！',
    expression: 'excited',
    help: 'home/market',
  },
  inventory: {
    short: '持ってるアイテムはここ！ 効果と使う相手を見て、ベストなタイミングで使ってね♪',
    expression: 'normal',
    help: 'items/items',
  },

  // ---- ギフト(未受取の有無で切り替える) ----
  giftClaimable: {
    short: 'ギフト届いてるよ！ 30日で期限切れになるから、今のうちに受け取っちゃお♪',
    expression: 'surprise',
    help: 'items/gift',
  },
  giftEmpty: {
    short: '今は未受取なし！ ログボやミッション報酬が届いたら、ここに入るよ。',
    expression: 'normal',
    help: 'items/gift',
  },

  // ---- ミッション(受取可能な報酬の有無で切り替える) ----
  missionsClaimable: {
    short: '達成報酬あるよ〜！ まとめて受け取って、ギフトボックスもチェックしてね♪',
    expression: 'excited',
    help: 'items/missions',
  },
  missionsNormal: {
    short: 'デイリーとウィークリーを進めよ♪ 全部達成でコンプリート報酬もあるよ！',
    expression: 'happy',
    help: 'items/missions',
  },

  // ---- プロフィール・設定・ヘルプ ----
  profile: {
    short: '名前・アイコン・これまでの記録はここ！ 自分らしいプロフィールにしよ♪',
    expression: 'normal',
    help: 'home/profile',
  },
  settings: {
    short: '音量やBGMはここで調整できるよ。引き継ぎコードも、ときどき控えておくと安心！',
    expression: 'normal',
    help: 'tips/settings',
  },
  helpTop: {
    short: '分からないことはあたしに任せて♪ 気になるカテゴリを選んで、吹き出しもタップしてね！',
    expression: 'happy',
    detail: [
      'このヘルプは「カテゴリ → 項目 → 説明」の3段階になってるよ。',
      'まずは下のカテゴリから、気になるものをタップしてね。次に項目を選ぶと、詳しい説明が出るよ。',
      'あたしの吹き出しは、開いてるページごとに内容が変わるんだ。タップすると、そのページの詳しい説明をここに出せるよ♪',
      '右上のあたしのボタンで、吹き出しを閉じたり出したりできるよ。',
    ],
  },
};

const findAssistant = (id) => ASSISTANTS.find(a => a.id === id)
  || ASSISTANTS.find(a => a.id === DEFAULT_ASSISTANT_ID)
  || ASSISTANTS[0]
  || null;
const findAssistantScene = (key) => (key && ASSISTANT_SCENES[key]) || null;
