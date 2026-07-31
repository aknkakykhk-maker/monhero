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
//   lines       … セリフの候補。{ e:表情, t:セリフ } を5つ以上。開くたびに1つ選ぶ
//   when        … 条件つきのセリフ。画面から condition を渡したときは lines より優先する
//   detail      … タップで開く詳しい説明(文字列の配列)
//   help        … 'カテゴリid/項目id'。detail の代わりに、ヘルプ本文をそのまま詳細として開く
//
// バトル中・クイックの成長演出・供モンの加入演出には常設しない(テンポを止めないため)。
// バトル中の案内は「ステータス」やヘルプを開いたときだけ出す。
const ASSISTANT_SCENES = {
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
    },
  },

  // ---- バトルメニュー ----
  battleChallenge: {
    help: 'basics/battle-modes',
    lines: [
      { e:'happy',   t:'ランキング狙うならここ！' },
      { e:'wink',    t:'強化の選び方でかなり変わるよ♪' },
      { e:'happy',   t:'終盤まで考えて強化しよ！' },
      { e:'excited', t:'自己ベスト更新いけそう！' },
      { e:'normal',  t:'焦らずじっくり育てよ♪' },
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
      { e:'happy',   t:'短時間でも結構強くなるよ♪' },
      { e:'excited', t:'経験値もダイヤも1.5倍！ おいしいじゃん♪' },
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
      { e:'happy',   t:'WAVEクリアおつかれ♪ どれ伸ばす？' },
      { e:'wink',    t:'弱点を埋めるか、強みを伸ばすか…悩むとこだね！' },
      { e:'excited', t:'いい感じじゃーん♪ この調子でいこ！' },
      { e:'normal',  t:'ライフが心もとないなら、先に固くするのもアリかも。' },
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
      { e:'normal',  t:'編成を整えるとこだよ。どこ見る？' },
      { e:'wink',    t:'解放しただけじゃ出てこないから、編成に入れてね！' },
      { e:'happy',   t:'最後に「決定」まで押すのを忘れずに♪' },
      { e:'normal',  t:'ブリーダーカードの編成もここからだよ。' },
      { e:'excited', t:'編成を変えるだけで戦い方がガラッと変わるよ！' },
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
      { e:'wink',    t:'未使用の強化ポイント、余ってない？' },
      { e:'excited', t:'その勇者モン、結構育ってきたね！' },
      { e:'normal',  t:'絆Lvが上がるとポイントがもらえるよ。' },
      { e:'happy',   t:'お気に入りの子、見つかった？' },
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
      { e:'normal',  t:'今日は何する？' },
      { e:'happy',   t:'合体かな？ 転生かな？' },
      { e:'wink',    t:'取り返せない操作もあるから、よく確認してね♪' },
      { e:'normal',  t:'じっくり考えて決めよ！' },
      { e:'happy',   t:'育成の土台づくりだね！' },
    ],
  },
  fusion: {
    help: 'masu/fusion',
    lines: [
      { e:'troubled', t:'「主」が残って「副」は消えるよ。確認してね！' },
      { e:'normal',   t:'副の絆経験値が、まるごと主に足されるよ。' },
      { e:'wink',     t:'固有技を引き継げるのは、両方Lv.10以上のときだけ！' },
      { e:'troubled', t:'消える子は戻せないから、ゆっくり選ぼ。' },
      { e:'happy',    t:'うまくいくと一気に育つよ♪ でも確認は大事！' },
    ],
  },
  rebirth: {
    help: 'masu/rebirth',
    lines: [
      { e:'excited', t:'上限まで育てたごほうびだね♪' },
      { e:'happy',   t:'Lvは戻るけど、上限＋5と固有技アップが狙えるよ！' },
      { e:'wink',    t:'長い目で見ると、転生したほうが断然強いよ！' },
      { e:'excited', t:'星が増えるのもテンション上がるじゃん♪' },
      { e:'normal',  t:'コストを確認したら、いってみよ！' },
    ],
  },
  donation: {
    help: 'masu/donation',
    lines: [
      { e:'troubled', t:'寄付したマスモンは戻せないよ…。' },
      { e:'troubled', t:'ほんとに手放していい子か、もう一回だけ確認してね。' },
      { e:'normal',   t:'累計絆経験値と同じ数のダイヤになるよ。' },
      { e:'troubled', t:'編成に入ってる子だと外れちゃうから気をつけて！' },
      { e:'normal',   t:'迷ったら、今日は見送るのもアリだと思うな。' },
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

// ---------- 初回チュートリアル ----------
// 初めて遊ぶ人だけに出す短い案内。1〜2分で終わる分量にする。
// 各ページは { e:表情, t:本文, help?:'カテゴリid/項目id' }。helpがあれば「詳しく見る」を出せる。
const ASSISTANT_TUTORIAL = [
  { e:'happy',   t:'あらためて、はじめまして！ あたしはみゅあ。この村の助手だよ♪', title:'はじめまして' },
  { e:'normal',  t:'ここがHOME。建物をタップするといろんなことができるよ！', title:'HOMEのこと', help:'home/roster' },
  { e:'wink',    t:'神殿では合体・転生・寄付ができるんだ。育成の土台になるとこだね！', title:'神殿', help:'masu/fusion' },
  { e:'excited', t:'バトルで活躍した子は「マスモン」として登録できるよ。育てるほど強くなる♪', title:'勇者モンを育てる', help:'masu/masumon' },
  { e:'happy',   t:'バトルは勇者モンを選んで、カードで戦うよ。距離がすっごく大事！', title:'バトル', help:'battle/distance' },
  { e:'excited', t:'スコアはランキングに載るよ。上位、狙っちゃう？', title:'ランキング', help:'basics/ranking' },
  { e:'normal',  t:'細かいことはヘルプにぜんぶ書いてあるから、迷ったら覗いてみてね。', title:'ヘルプ', help:'tips/assistant' },
  { e:'happy',   t:'困ったらいつでもあたしをタップしてね♪', title:'それじゃあ、いってらっしゃい！' },
];

// ---------- セリフの抽選 ----------
// 場面(と条件)ごとに、直近に出したセリフを覚えておく。
// 直前の1件だけを避けると3〜4回で一巡した感じになってしまうので、
// 候補数に応じて直近数件をまとめて外す。端末には保存しない(見た目だけの話なので
// セーブデータには触らない)。
const ASSISTANT_RECENT = {};
// 直近いくつを候補から外すか。候補が少ないときに全部外れてしまわないよう上限を決める
const assistantRecentLimit = (total) => Math.max(1, Math.min(3, total - 2));

// その場面で使うセリフの候補を返す。条件つきのセリフがあればそちらを優先する
const assistantSceneLines = (scene, condition) => {
  const def = (scene && ASSISTANT_SCENES[scene]) || null;
  if (!def) return [];
  const conditional = (condition && def.when && Array.isArray(def.when[condition])) ? def.when[condition] : null;
  const list = (conditional && conditional.length) ? conditional : def.lines;
  return Array.isArray(list) ? list : [];
};

// 候補から1つ選ぶ。直近に出したものは候補から外す(候補が少ないときは可能な範囲で)
const pickAssistantLine = (scene, condition) => {
  const list = assistantSceneLines(scene, condition);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const key = `${scene || ''}|${condition || ''}`;
  const recent = ASSISTANT_RECENT[key] || [];
  const fresh = list.filter((_, i) => !recent.includes(i));
  const pool = fresh.length > 0 ? fresh : list;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const index = list.indexOf(picked);
  ASSISTANT_RECENT[key] = [index, ...recent].slice(0, assistantRecentLimit(list.length));
  return picked;
};

const findAssistant = (id) => ASSISTANTS.find(a => a.id === id)
  || ASSISTANTS.find(a => a.id === DEFAULT_ASSISTANT_ID)
  || ASSISTANTS[0]
  || null;
const findAssistantScene = (key) => (key && ASSISTANT_SCENES[key]) || null;
