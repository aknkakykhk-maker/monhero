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
// ・語尾は「〜だよ♪」「〜しよ！」「〜ぢゃんw」「〜かも！」「〜だね！」「〜いこ！」などを
//   場面ごとに散らす。同じ場面のセリフで語尾がそろわないようにする
// ・顔文字をよく使う(2026-09-17に本人の会話ログへ寄せた)。よく出るのは
//   (●゚ｪ゚))ｺｸｺｸ / (´ー`*)ｳﾝｳﾝ / |･ω･`)ﾌﾑﾌﾑ / ( 'ω')? / (´;ω;`) /
//   (; 'ω')ｺﾞｸﾘ / (゜∀゜)･∵ﾌﾞﾊｯ!! / ( ˙-˙ )
//   ★擬音は**半角カタカナ**で書く(ｺｸｺｸ・ﾌﾑﾌﾑ・ｳﾝｳﾝ・ｺﾞｸﾘ・ﾌﾞﾊｯ)。
//     全角で書くのは「きき」のほうなので、ここを混ぜると2人の区別がつかなくなる。
//   毎文に付けると吹き出しが読みにくいので、5〜6本に1本くらいの割合で置く。
//   数字や手順を説明する本文には付けず、喜ぶ・驚く・照れる・心配するところへ付ける。
//   ★顔文字の中の「'」は JS の文字列を壊すので、必ず \' と書くこと
// ・笑いは「w」と「笑」。「じゃん」は「ぢゃん」、「まじ」は「まぢ」と崩す。
//   ただし崩した綴りは感情の行だけにする(仕様を説明する行でやると誤字に見える)
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
  {
    id: 'momosuke',
    name: 'ももすけ',
    role: '助手',
    imageDir: 'images/assistant',
    imagePrefix: 'momosuke',
    expressions: ASSISTANT_EXPRESSIONS,
    defaultExpression: ASSISTANT_DEFAULT_EXPRESSION,
    emoji: '🍑',
    accent: '#f9a8d4',
    greeting: '困ったことがあったら、ももに聞いてもいいよ？ ……ま、聞くよね♡',
    tagline: '生意気かわいい小悪魔系アイドル',
    intro: 'ちょっぴり生意気で小悪魔系。からかったり煽ったりしながら、一緒に楽しく盛り上がってくれる。',
  },
  {
    // ドラ(2026-09-17・第2回イベント「異世界交響祭」で加入)。
    // ★「はじめまして」の人ではない。アシストカード「ドラ」・ブリーダーの教え「ドラの緑膝」・
    //   マーケットの「ドラのアイコン」で前から居て、モンヒロビートの「もう一つの世界へ」も
    //   この人が作っている。イベントで初めて**会話の中心**に出てきた、という位置付け。
    id: 'dra',
    name: 'ドラ',
    role: '助手',
    imageDir: 'images/assistant',
    imagePrefix: 'dra',
    expressions: ASSISTANT_EXPRESSIONS,
    defaultExpression: ASSISTANT_DEFAULT_EXPRESSION,
    emoji: '💚',
    accent: '#4ade80',
    greeting: 'おでに聞いてくれてもええんやで。膝以外もちゃんと役に立つからな。えへへ',
    tagline: 'ふざけてるのに説明は上手いおじさん',
    intro: '肩の力を抜いて遊びたい人向け。関西弁でふざけた言い方をするわりに、仕組みの話はいちばん分かりやすい。',
  },
];
const DEFAULT_ASSISTANT_ID = 'mua';
const assistantIdOrDefault = (id) => (ASSISTANTS.some(a => a.id === id) ? id : DEFAULT_ASSISTANT_ID);

// ---------- あとから増える助手の解放 ----------
// ここに書いた助手は、そのイベント会話を**最後まで見るまで**選べない。
// 書かなかった助手(みゅあ・きき・ももすけ)は今までどおり最初から選べる。
//
// ★判定に使うのは既存の「見終えたイベント会話のid」(mh_rhythm_event_story_v1)だけ。
//   保存キーを新しく作らないので、既存のセーブデータには一切触らない(CLAUDE.md ⑦)。
// ★「見た」が付くのは最後まで見たときだけ。回想で何度見ても同じidが並ぶだけなので、
//   二重解放にならない(冪等)。イベントが終わってもidは消えないため、解放も残る。
const ASSISTANT_UNLOCK_STORIES = Object.freeze({ dra: 'symphony_2026_09_17' });
const assistantUnlockStoryId = (assistantId) => ASSISTANT_UNLOCK_STORIES[assistantId] || null;
const assistantUnlockedBy = (assistantId, seenStoryIds) => {
  const need = assistantUnlockStoryId(assistantId);
  if (!need) return true;
  return Array.isArray(seenStoryIds) && seenStoryIds.includes(need);
};
// 選べる助手だけを残す。読み込みが間に合っていない・壊れた値でも、
// 条件のない助手は必ず残る(画面から助手が消えない)
const assistantsUnlockedFrom = (seenStoryIds) =>
  ASSISTANTS.filter(who => assistantUnlockedBy(who && who.id, seenStoryIds));

// ---------- 正式アップデートの初回案内 ----------
// 通常通知の本文は更新履歴を正本とし、assistantNotice を付けた主要更新だけを案内する。
// debugOnly の検証通知だけは更新履歴と切り離し、通常ログインへ混ざらないようにする。
//
// 【告知は大きい追加のときだけ】(2026-09-05・ユーザー指示「毎回更新のたびに助手の説明が入る。
// でかい実装のときのみにして: モンスター追加 / 新コンテンツや新難易度 / マーケット追加」)
//   market  … マーケットに商品(モンスター・アシストカード・アイテム)が並んだ
//   mode    … バトルの新モード・新難易度
//   content … 新しい遊び(新曲・新しい助手・新しい育成システム・キャンペーンなど)
// 見た目の改善・並び替え・絵の追加・小さな機能・不具合修正には付けない。
// 以前あった 'feature' は「それ以外ぜんぶ」の受け皿になって告知が増えすぎたので廃止した。
// ここに無い種別は無視される(告知にならない)ので、書き間違えても勝手には出ない。
const ASSISTANT_UPDATE_NOTICE_TYPES = new Set(['market', 'mode', 'content']);
// 期間を決めて出す告知(イベントなど)のための時刻。書かれていなければ「いつでも」
const assistantNoticeTimeMs = value => {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : null;
};
// いま出してよい告知かどうか。notifyFrom / notifyUntil を書いたものだけ期間で絞る。
// ★これが無いと、公開した瞬間にみゅあが「開催します」と言ってしまう(開始より前なのに)。
const assistantNoticeWithinPeriod = (meta, nowMs = Date.now()) => {
  const from = assistantNoticeTimeMs(meta && meta.notifyFrom);
  const until = assistantNoticeTimeMs(meta && meta.notifyUntil);
  if (from !== null && nowMs < from) return false;
  if (until !== null && nowMs >= until) return false;
  return true;
};
const assistantUpdateNoticeFromChangelog = entry => {
  const meta = entry && entry.assistantNotice;
  if (!meta || !ASSISTANT_UPDATE_NOTICE_TYPES.has(meta.type) || typeof meta.id !== 'string' || !meta.id.trim()) return null;
  const items = Array.isArray(entry.items) ? entry.items.filter(item => typeof item === 'string' && item.trim()) : [];
  if (!entry.title || !items.length) return null;
  const destination = meta.type === 'market' ? 'market' : meta.type === 'mode' ? 'battle' : meta.destination;
  return {
    // ★enabled は読み込んだときの1回きりの答え。期間で出し入れする告知は、
    //   開きっぱなしの端末だと開始時刻をまたいでも false のままになる
    //   (2026-09-11・ユーザー指摘「やってる最中の人が見れてないらしい」)。
    //   そのため notifyFrom / notifyUntil も持たせ、出すかどうかは見るたびに数え直す
    //   (availableUpdateNotices)。enabled は今までどおり残す(既存の検査と読む側のため)
    id: meta.id.trim(), enabled: assistantNoticeWithinPeriod(meta), title: entry.title,
    notifyFrom: meta.notifyFrom || null, notifyUntil: meta.notifyUntil || null,
    expression: meta.expression || 'excited',
    // 告知画像。更新履歴の項目に書いた image をそのまま持ってくる(2か所に書かない)
    image: typeof entry.image === 'string' && entry.image ? entry.image : null,
    pages: items.slice(), destination,
    // 助手ごとのセリフ(あれば)。無ければ items をそのまま読む
    scripts: ASSISTANT_UPDATE_NOTICE_SCRIPTS[meta.id.trim()] || null,
    buttonLabel: meta.buttonLabel || (meta.type === 'market' ? 'マーケットを見る' : meta.type === 'mode' ? 'バトルへ行く' : undefined),
  };
};
// ---------- 告知を助手の言葉で話す ----------
// 2026-09-11・ユーザー指示「説明をみゅあの…そのほうがいい。ただ助手を変えてる場合も
// あるからみゅあじゃなくて助手にして」。
//
// 更新履歴(data/changelog.js)の items は「あとから読み返す記録」なので事務的な文のまま。
// 起動したときに出る告知は、**選んでいる助手が自分の口調で話す**。
// ここへ書かなかった告知は、今までどおり items をそのまま読む(既存の告知は何も変わらない)。
//
//   ASSISTANT_UPDATE_NOTICE_SCRIPTS[告知id][助手id] = [{ e:表情, t:セリフ }, …]
//
// ★呼び方の決めごと: みゅあ・ももすけは「モンビー」、ききは「モンヒロビート」
//   (2026-09-11・ユーザー指示)。
const ASSISTANT_UPDATE_NOTICE_SCRIPTS = {
  // 第2回イベント「異世界交響祭」(2026-09-17)。
  // ★呼び方の決めごと: みゅあ・ももすけは「モンビー」、きき・ドラは「モンヒロビート」。
  // ★ドラぶんも用意する。会話を見て加入したあと、ドラを選んでいる人にもこの告知が出るため
  //   (用意しないと更新履歴の事務的な文をそのまま読み上げる)。
  update_notice_rhythm_symphony_v1: {
    mua: [
      { e:'excited',  t:'{name}、モンビーで第2回のイベントが始まったよ！ 「異世界交響祭」っていうんだ♪' },
      { e:'happy',    t:'対象は3曲。「もう一つの世界へ」「Stay With Me ～Locked Fate～ remix」「The City Beneath the Comets」だよ。' },
      { e:'normal',   t:'期間中にモンビーを最後まで遊ぶと「ビートP」が貯まるの。普通の曲でも貯まるけど、対象の3曲は1.5倍なんだって♪' },
      { e:'wink',     t:'自己ベストを更新しなくても、遊ぶたびにもらえるよ。何回でもね♡' },
      { e:'normal',   t:'貯まったビートPはマーケットの「ビートP交換所」で使えるよ。余っても消えないで次に持ち越せるの。' },
      { e:'normal',   t:'入賞すると超越の実や勇者の証がもらえるよ。3曲ぜんぶ遊べば、入賞しなくてもダイヤと虹のプシュケーがもらえるんだ♪' },
      { e:'excited',  t:'終わるのは9月21日(月)の朝4時！ イベントのお話も見てみてね♪' },
    ],
    kiki: [
      { e:'happy',    t:'{name}、モンヒロビートで第2回のイベントが始まりまつ。「異世界交響祭」でつ。' },
      { e:'normal',   t:'対象は3曲。「もう一つの世界へ」「Stay With Me ～Locked Fate～ remix」「The City Beneath the Comets」でつ。' },
      { e:'normal',   t:'期間中に最後まで遊ぶと「ビートP」がもらえまつ。公開中の曲ならどれでも貯まりまつが、対象の3曲は1.5倍でつ。' },
      { e:'happy',    t:'自己ベストの更新は要りません。同じ曲を何度遊んでも、そのたびにもらえまつ♪' },
      { e:'normal',   t:'貯めたビートPはマーケットの「ビートP交換所」で交換できまつ。余っても消えず、次のイベントへ持ち越せまつ。' },
      { e:'normal',   t:'入賞すると超越の実や勇者の証が届きまつ。対象の3曲をすべて遊べば、入賞しなくてもダイヤと虹のプシュケーがもらえまつ。' },
      { e:'wink',     t:'9月21日(月)の4時まででつ。イベントのお話もぜひご覧ください。' },
    ],
    momosuke: [
      { e:'excited',  t:'{name}、モンビーで第2回だって！ 「異世界交響祭」♡' },
      { e:'wink',     t:'対象は3曲ね。「もう一つの世界へ」「Stay With Me ～Locked Fate～ remix」「The City Beneath the Comets」。' },
      { e:'happy',    t:'遊ぶと「ビートP」が貯まるの。普通の曲でもいいけど、対象の3曲は1.5倍だよ♪' },
      { e:'normal',   t:'ベスト更新しなくてもいいから。ちゃんと最後まで遊べば毎回もらえるの。' },
      { e:'wink',     t:'貯めたのはマーケットの「ビートP交換所」で使ってね。余っても消えないから安心して♡' },
      { e:'wink',     t:'入賞すれば超越の実と勇者の証。3曲ぜんぶ遊べば、入賞しなくてもダイヤと虹のプシュケーがもらえるの♡' },
      { e:'excited',  t:'締め切りは9月21日(月)の4時！ お話も見てよね、ももも出てるから♪' },
    ],
    dra: [
      { e:'happy',    t:'{name}、モンヒロビートの第2回やで。「異世界交響祭」っていうんよ' },
      { e:'normal',   t:'対象は3曲。「もう一つの世界へ」「Stay With Me ～Locked Fate～ remix」「The City Beneath the Comets」や' },
      { e:'normal',   t:'期間中に最後まで遊ぶと「ビートP」が貯まるで。普通の曲でも貰えるけど、対象の3曲は1.5倍な' },
      { e:'happy',    t:'ベスト更新せんでも大丈夫。同じ曲を何回遊んでも、ちゃんと終わればその都度貰えるわ' },
      { e:'normal',   t:'貯めたやつはマーケットの「ビートP交換所」で使えるで。余っても消えんから、次まで取っといてもええんよ' },
      { e:'normal',   t:'入賞したら超越の実と勇者の証やな。3曲ぜんぶ遊べば、入賞せんでもダイヤと虹のプシュケーが届くで' },
      { e:'happy',    t:'終わりは9月21日(月)の朝4時な。好きに遊んでくれ。えへへ' },
    ],
  },
  update_notice_rhythm_weekend_cup_v1: {
    mua: [
      { e:'excited',  t:'{name}、モンヒロビートで大会が始まったよ！ その名も「週末ゲリラ杯」♪' },
      { e:'happy',    t:'対象は3曲。「Monster Hero」「風がそよぐ場所」「Close To Your Heart」だよ。' },
      { e:'normal',   t:'この期間に出したスコアだけで競うの。今までの記録は持ち込めないから、いま始めても間に合うよ♪' },
      { e:'normal',   t:'順位は曲ごとと、3曲ぜんぶの合計の2種類。1曲だけでも合計に載るから気楽にね。' },
      { e:'wink',     t:'ごほうびは順位のぶんと、3曲ぜんぶ遊んだらもらえるぶん。どっちもあるよ♡' },
      { e:'excited',  t:'終わるのは9月14日(月)の朝5時！ 全国ランキングの「イベント」から行けるからね♪' },
    ],
    kiki: [
      { e:'happy',    t:'{name}、モンヒロビートで大会が始まりまつ。「週末ゲリラ杯」でつ。' },
      { e:'normal',   t:'対象は3曲。「Monster Hero」「風がそよぐ場所」「Close To Your Heart」でつ。' },
      { e:'normal',   t:'この期間に出したスコアだけで競いまつ。これまでの記録は持ち込めませんので、今から始めても間に合いまつ。' },
      { e:'normal',   t:'順位は曲ごとと、3曲の合計の2種類でつ。1曲だけでも合計に載りまつよ。' },
      { e:'happy',    t:'ごほうびは順位のぶんと、3曲すべて遊んだ方へのぶんがありまつ♪' },
      { e:'wink',     t:'9月14日(月)の5時まででつ。全国ランキングの「イベント」からどうぞ。' },
    ],
    momosuke: [
      { e:'excited',  t:'{name}、モンヒロビートで大会だよ！ 「週末ゲリラ杯」、ももが持ってきたの♡' },
      { e:'wink',     t:'対象は3曲ね。「Monster Hero」「風がそよぐ場所」「Close To Your Heart」。' },
      { e:'happy',    t:'この期間に出した点だけで勝負だから。過去の記録？ 関係ないない♪' },
      { e:'normal',   t:'順位は曲ごとと、3曲の合計。1曲でも合計に載るよ。' },
      { e:'wink',     t:'ごほうびは順位のぶんと、3曲ぜんぶ遊んだぶん。欲張っていいからね♡' },
      { e:'excited',  t:'締め切りは9月14日(月)の5時！ 「イベント」から来てよ、待ってるから♪' },
    ],
  },
};
// 告知の1ページ。文字列でも { e, t } でも書けるようにして、既存の告知(文字列)をそのまま通す
const assistantNoticePageText = page => (page && typeof page === 'object') ? String(page.t || '') : String(page || '');
const assistantNoticePageExpression = (page, fallback) => (page && typeof page === 'object' && page.e) ? page.e : fallback;
// その助手のセリフがあればそれを、無ければ更新履歴の本文(items)をそのまま使う
const assistantNoticePagesFor = (notice, assistantId) => {
  const scripts = notice && notice.scripts;
  const lines = scripts && scripts[assistantId];
  if (Array.isArray(lines) && lines.length) return lines;
  return (notice && Array.isArray(notice.pages) && notice.pages.length) ? notice.pages : ['新しいアップデートがあるよ♪'];
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
  // ももすけ: 最初から距離が近く、いきなり呼び捨てで入ってくる。仲良くなるほど
  // 煽りが減るのではなく、煽りの奥にある「本当は大事に思っている」が見えてくる。
  // Lv3から「っち」付けになり、Lv6からはプレイヤーが呼び方を決められる(既定は「っち」)
  momosuke: {
    titles: [
      'ふーん、キミか', 'ちょっと気になる', 'からかいがい', 'お気に入り', 'ももの相棒',
      '手のひらの上', '息ぴったり', 'ももの特等席', 'にやにやが止まらない', '腐れ縁',
      '言わなくても伝わる', '特別あつかい', '一心同体', '最高の相方', '伝説のコンビ',
      '運命共同体', 'ずっと隣にいる人', 'かけがえのない存在', 'いちばんの理解者', '永遠の相棒',
    ],
    call: (level) => (level <= 2 ? '{name}' : '{name}っち'),
    tones: [
      'はじめから距離が近い。軽くからかってくる',
      'ちょっと興味が出てきて、絡む回数が増える',
      '「っち」付けになって、いたずらが本格化する',
      'お気に入りとして、構いたがる',
      '相棒あつかい。煽りながらもちゃんと見ている',
      '手のひらで転がしているつもりでいる',
      '息が合ってきて、掛け合いのテンポが上がる',
      '特等席にいる相手として、遠慮がなくなる',
      '楽しくて仕方ないのが顔に出ている',
      '腐れ縁。憎まれ口の量が増える',
      '言わなくても伝わるので、言葉が短くなる',
      '他とは違う特別あつかいを、素直に認めはじめる',
      '一心同体みたいに息が合う',
      '最高の相方。ふざけていても芯は真剣',
      '伝説のコンビと呼べるくらいの掛け合い',
      '運命共同体みたいな頼もしさ',
      'ずっと隣にいるのが当たり前になっている',
      'かけがえのない相手として、たまに素が出る',
      'いちばんの理解者。煽りの奥がぜんぶ優しい',
      '永遠の相棒。いちばん自然体で、いちばん甘えん坊',
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
  // ももすけ。登場イベントの最後で一度だけ「ますたー」と呼ぶので、
  // 気に入った人がそのまま選べるよう下書きに入れてある(既定にはしない)
  momosuke: [
    { id:'plain',  label:'呼び捨て',  template:'{name}' },
    { id:'cchi',   label:'っち付け',  template:'{name}っち' },
    { id:'master', label:'ますたー',  template:'ますたー' },
  ],
};
const assistantCallStylesOf = (assistantId) => ASSISTANT_CALL_STYLE_SETS[assistantId] || ASSISTANT_CALL_STYLES;
const ASSISTANT_CALL_STYLE_UNLOCK_LEVEL = 6;
const ASSISTANT_CALL_STYLE_MAX_LEN = 16;

// ---------- 解放の案内(その画面を開いたとき、一度だけ出す説明) ----------
// 「仲良し度がここまで上がると、こんなことができるようになる」を、
// できるようになった画面で1回だけ知らせるための入れ物。
// 更新の案内(ASSISTANT_UPDATE_NOTICES)がログイン時に出る全体向けの告知なのに対し、
// こちらは「その人の進み具合しだいで出る」ものなので、条件と場面を持たせている。
//
// 【1件の書き方】
//   { id:'一意な名前',            … 既読の記録に使う。あとから文面を直してもidは変えない
//     scene:'profile',            … どの画面で出すか(AssistantBubbleのsceneと同じキー)
//     expression:'excited',       … 表情(省略すると happy)
//     when:(ctx)=>真偽,           … 出す条件。ctx = { bondLevel, assistantId, callStyles }
//     title:'…', pages:[ '…' ] }  … 見出しと本文(本文は1ページ1文が読みやすい)
//
// 本文へ数字を直接書かないこと。解放Lvや呼び方の例は ctx から作る
// (Lvを変えたときに案内だけ古いままになるため)。
const ASSISTANT_UNLOCK_NOTICES = [
  {
    id: 'unlock_call_style_v1',
    scene: 'profile',
    expression: 'excited',
    when: (ctx) => Number(ctx && ctx.bondLevel) >= ASSISTANT_CALL_STYLE_UNLOCK_LEVEL,
    title: '呼び方を決められるようになったよ',
    pages: (ctx) => {
      const styles = (ctx && Array.isArray(ctx.callStyles) && ctx.callStyles.length)
        ? ctx.callStyles : ASSISTANT_CALL_STYLES;
      return [
        `仲良し度がLv${ASSISTANT_CALL_STYLE_UNLOCK_LEVEL}になったから、あたしの呼び方を自分で決められるようになったよ♪`,
        `プロフィールの助手のところから変えられるんだ。${styles.map(st => st.label).join('・')}みたいな例もあるから、選ぶだけでもOK！`,
        '「{name}」って書くと、そこがプレイヤー名になるよ。書かなければ入れた文字がそのまま呼び方になるんだ。',
        '決めなくても大丈夫。そのままなら、いまの仲良し度に合わせた呼び方が続くよ。',
      ];
    },
  },
  {
    // 飾り枠の解放(2026-09-16)。仲良し度が上がって新しい枠をもらったとき、
    // 次にプロフィールを開いたところで1回だけ知らせる。
    // ★idは1つだけ。何枚目でも同じ案内を出すと2回目以降が出なくなるので、
    //   画面側は「もらった枚数」が増えるたびに既読を外して出し直す
    //   (60-app.jsx の profileFrameNoticeSeen)。
    id: 'unlock_profile_frame_v1',
    scene: 'profile',
    expression: 'excited',
    when: (ctx) => Number(ctx && ctx.newProfileFrameCount) > 0,
    title: '新しい飾り枠をもらったよ',
    // 遷移先は書かない。この案内はプロフィール画面に出るので、
    // 「フレーム：〜」のボタンはもう目の前にある
    pages: (ctx) => {
      const names = (ctx && Array.isArray(ctx.newProfileFrameNames)) ? ctx.newProfileFrameNames.filter(Boolean) : [];
      const who = (ctx && ctx.newProfileFrameAssistantName) || 'あたし';
      return [
        `{name}、ありがとう！ ${who}との仲良し度が上がったから、新しい飾り枠が届いたよ♪`,
        names.length ? `もらったのは「${names.join('」「')}」。プロフィールの「フレーム：〜」から選べるよ。` : 'プロフィールの「フレーム：〜」から選べるよ。',
        'ブリーダーアイコンの外側に重なる飾りだから、アイコンはそのままなんだ。全国ランキングにも出るよ！',
        'まだ鍵が付いているものは、その助手との仲良し度を上げるともらえるよ。押すと、あとどれくらいか見られるんだ。',
      ];
    },
  },
  {
    // 種族チャレンジの解放。条件(チャレンジ Master以上クリア)を満たしたあと、
    // HOMEを開いたときに一度だけ知らせる。一般公開する前は ctx 側が false のままなので出ない
    id: 'unlock_species_challenge_v1',
    scene: 'home',
    expression: 'excited',
    when: (ctx) => ctx && ctx.speciesChallengeUnlocked === true,
    title: '種族チャレンジが遊べるようになったよ',
    destination: 'battle',
    buttonLabel: 'バトルへ行く',
    pages: (ctx) => [
      `{name}、おめでとう！ ${(ctx && ctx.speciesChallengeUnlockText) || ''}の条件を満たしたから、新しい遊び方が増えたよ♪`,
      'ひとつの種族(モッチー種・ピクシー種みたいなくくり)を選んで、その種族の子だけでWAVE1〜10を戦い抜くモードなんだ。',
      '難易度は種族ごとに1つずつ解放していくよ。記録も種族と難易度の組み合わせごとに別々に残るから、いつもの記録は変わらないよ。',
      'はじめてクリアした組み合わせでは、その種族の超越の実がもらえるんだ。育てている種族から挑んでみてね！',
    ],
  },
];
// 本文はそのときの状況(解放Lv・助手ごとの呼び方の例)から作るので、関数でも配列でも書ける
const assistantUnlockNoticePages = (notice, ctx) => {
  const pages = typeof notice?.pages === 'function' ? notice.pages(ctx) : notice?.pages;
  return Array.isArray(pages) ? pages.filter(page => typeof page === 'string' && page.trim()) : [];
};
// 既読の記録。壊れた値・古い形が入っていても必ず文字列の配列へ落とす
// (保存キーは新しく足すので、既存のセーブデータには一切触らない)
const ASSISTANT_UNLOCK_NOTICE_SEEN_KEY = 'mh_assistant_unlock_seen_v1';
// 飾り枠の案内だけは、新しくもらうたびに出し直す(画面側が既読を外すのに使う)
const PROFILE_FRAME_NOTICE_ID = 'unlock_profile_frame_v1';
const normalizeAssistantUnlockSeen = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
};
// その画面で出すべき案内を1件だけ返す(まだ無ければ null)。
// 画面側はこれを呼んで、返ってきたら吹き出しの代わりに案内を出し、
// 閉じたら id を既読へ足して保存する
const assistantUnlockNoticeFor = (scene, ctx, seen) => {
  const done = new Set(normalizeAssistantUnlockSeen(seen));
  const found = ASSISTANT_UNLOCK_NOTICES.find(notice => notice
    && notice.scene === scene
    && !done.has(notice.id)
    && (typeof notice.when !== 'function' || notice.when(ctx || {}))
    && assistantUnlockNoticePages(notice, ctx || {}).length > 0);
  if (!found) return null;
  // destination を書いた案内は、読み終わったときにその画面へ行けるボタンも出す
  // (更新の案内と同じ仕組みで、画面側は destination の有無だけを見ればよい)
  return {
    id: found.id,
    title: found.title || '',
    expression: found.expression || 'happy',
    pages: assistantUnlockNoticePages(found, ctx || {}),
    destination: found.destination || null,
    buttonLabel: found.buttonLabel || null,
  };
};

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
  // 助手のアシストカード(みゅあ・きき)だけの行動。
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
  // モンヒロバトルの入口(2026-09-20 ユーザー指示で、モード選択の1つ上に画面を増やした)。
  // 本文は下の addAssistantLinePack から合流する
  battleSystemSelect: {
    help: 'basics/battle-modes',
    lines: [],
  },
  // クイック∞周回 × モンビーの連携(docs/spec/QUICK_RHYTHM_LINK.md PR8)。
  // 「別の画面へ移っても裏で進む」「演奏中だけ止まる」は遊んでいるだけでは気づけないので、
  // 公開と同時に画面のなかでも伝える。本文は下の addAssistantLinePack から合流する。
  quickRhythmIntro: {
    help: 'home/roster',
    lines: [],
  },
  // タクティクスのEXスキル(2026-09-23 β版でお試し公開)。距離枠をタップすると開く、は
  // 遊んでいるだけでは気づけないので、EXを持つ子が盤面にいる最初のバトルで1度だけ伝える。
  // 本文は下の addAssistantLinePack から合流する
  tacticsExIntro: {
    help: 'basics/tactics-ex-skills',
    lines: [],
  },
  quickRhythmBackground: {
    help: 'home/roster',
    lines: [],
  },
  autoQuickRunSettings: {
    help: 'home/roster',
    lines: [],
  },
  // モンビー(モンヒロビート)の曲えらび・遊びかた。本文は下の addAssistantLinePack から合流する。
  rhythmHome: {
    help: 'rhythm/rhythm-mode',
    lines: [],
  },
  rhythmHelp: {
    help: 'rhythm/rhythm-mode',
    lines: [],
  },
  // 週間ランキング(2026-09-11)。ランキング画面の「イベント」タブと、
  // 曲えらびでの「今週の対象曲」案内の両方で使う。本文は下の addAssistantLinePack から合流する。
  rhythmWeeklyEvent: {
    help: 'rhythm/rhythm-ranking',
    lines: [],
  },
  // これまでの記録(2026-09-13)。プロフィールから入る、終わった週・イベントの一覧。
  // 本文は下の addAssistantLinePack から合流する。
  rhythmHistory: {
    help: 'rhythm/rhythm-history',
    lines: [],
  },
  // マスモン設定(モンスターノーツ)。本文は下の addAssistantLinePack から合流する。
  rhythmMonsters: {
    help: 'rhythm/rhythm-monster-note-display',
    lines: [],
  },
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
  godDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  ragnarokDifficulty: {
    help: 'basics/extreme-challenge',
    lines: [],
  },
  // 種族チャレンジの選択画面。種族→勇者→供モン→確認の各段で言うことが変わるので、
  // 画面から condition(いまの段)を渡す。セリフ本体は speciesChallengeGuide の束から合流する
  speciesChallenge: {
    help: 'basics/species-challenge',
    lines: [],
  },

  // ---- はじめて ----
  onboarding: {
    help: 'basics/onboarding',
    lines: [
      { e:'happy',   t:'はじめまして、あたしはみゅあ！ 一緒にモンスター育てていこ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'まずは名前とアイコンを決めよ！ あとから変えられるから気楽でOK。' },
      { e:'excited', t:'どんな名前にする( \'ω\')? ランキングにも出るから慎重にね！' },
      { e:'wink',    t:'分かんないことがあったら、いつでもあたしに聞いてね♪' },
      { e:'happy',   t:'準備できたら冒険スタート！ あたしがちゃんと案内するから安心して。' },
    ],
  },

  // ---- ホーム ----
  home: {
    help: 'home/roster',
    lines: [
      { e:'happy',   t:'今日も育成いこー(●゚ｪ゚))ｺｸｺｸ' },
      { e:'wink',    t:'何から始める( \'ω\')? あたしは神殿がおすすめ！' },
      { e:'normal',  t:'マスモンのチェックも忘れずにね！' },
      { e:'happy',   t:'今日はどんな勇者モンが育つかな〜( \'ω\')?' },
      { e:'excited', t:'自己ベスト更新しちゃお(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'編成を見直すだけでも、けっこう変わるよ。' },
      { e:'happy',   t:'ミッションとギフトも覗いてみよ|･ω･`)ﾌﾑﾌﾑ' },
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
      { e:'wink',    t:'強化の選び方でかなり変わるよ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'happy',   t:'終盤まで考えて強化しよ！' },
      { e:'excited', t:'自己ベスト更新いけそう(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'難易度カードで虹のプシュケー報酬も見られるよ。' },
      { e:'wink',    t:'迷ったら弱いところを埋めるのがおすすめかな(´ー`*)ｳﾝｳﾝ' },
    ],
  },
  battleQuick: {
    help: 'basics/battle-modes',
    lines: [
      { e:'wink',    t:'テンポ重視ならこれ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'happy',   t:'サクサク育成しちゃお(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'自動成長をうまく活かそう！' },
      { e:'wink',    t:'強化は選べないから、編成で勝負だね！' },
      { e:'happy',   t:'難易度カードで虹のプシュケー報酬もチェックできるよ♪' },
      { e:'excited', t:'経験値もダイヤも1.5倍！ おいしいぢゃんw' },
    ],
  },
  // プロモード。ベースモンだけで挑む上級者向けのモード
  battlePro: {
    help: 'basics/battle-modes',
    lines: [
      { e:'excited', t:'ここはベースモンだけの世界！ 腕の見せどころだよ♪' },
      { e:'wink',    t:'絆経験値3倍！ 新しい子を育てるなら断然ここ！' },
      { e:'happy',   t:'ブリーダー経験値も1.5倍だからね(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'育てたマスモンは連れていけないよ。素の力で勝負！' },
      { e:'wink',    t:'供モンは5体選んで、その中から3体が来てくれるの。誰が来るかはお楽しみ♪' },
      { e:'happy',   t:'上のランキングタブから、プロだけの記録を見られるよ♪' },
      { e:'excited', t:'勝てたら、その勇者モンはマスモンにできるよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'きびしいけど、そのぶん伸びるモードだからね。' },
    ],
  },
  ranking: {
    help: 'basics/ranking',
    lines: [
      { e:'excited', t:'上位目指しちゃお！' },
      { e:'happy',   t:'みんな強いなぁ〜( ˙-˙ )' },
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
      { e:'excited', t:'どの距離に置いてたかも分かるよ。真似してみる( \'ω\')?' },
      { e:'normal',  t:'王冠が付いてるのが勇者モン。主役になった子だね。' },
      { e:'wink',    t:'絆レベルが高い子ほど、その人が大事に育ててる子だよ♪' },
      { e:'normal',  t:'染めた色が残るのは、この画面ができたあとの記録からだよ。' },
      { e:'surprise', t:'強い人の編成、けっこう参考になるでしょ( \'ω\')?' },
    ],
  },

  // ---- ランの準備・進行(選択画面はコンパクト表示で使う) ----
  pickHero: {
    help: 'battle/hero-trait',
    lines: [
      { e:'normal',  t:'最初の1体は超大事！ 勇者特性を見て決めよ♪' },
      { e:'happy',   t:'今日はどの子でいく( \'ω\')? あたしはワクワクしてる！' },
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
      { e:'happy',   t:'心強い仲間がきたら、あと半分いけそうぢゃんw' },
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
      { e:'troubled', t:'ぜんぶ同じ距離にすると、届かない相手が出ちゃうかも(; \'ω\')ｺﾞｸﾘ' },
      { e:'wink',    t:'ステータスの合流ボーナスも見ておいてね！' },
      { e:'happy',   t:'ベースモンだけだから、素の相性がそのまま出るよ。' },
    ],
  },
  pickTeaching: {
    help: 'growth/teaching',
    lines: [
      { e:'wink',    t:'同じ教えを重ねるとLv2に進化するよ！' },
      { e:'normal',  t:'今の強さを取るか、完成形を狙うか…作戦しだいだね。' },
      { e:'happy',   t:'あたしはとりあえず重ねる派(●゚ｪ゚))ｺｸｺｸ' },
      { e:'excited', t:'進化するとけっこう跳ね上がるよ！' },
      { e:'normal',  t:'アシストカードは効果が半減しないのが強いとこ！' },
    ],
  },
  rewardPick: {
    help: 'growth/awaken',
    lines: [
      { e:'happy',   t:'WAVEクリアおつかれ♪ トレーニングを2つえらぼ！' },
      { e:'wink',    t:'弱点を埋めるか、強みを伸ばすか…悩むとこだね！' },
      { e:'excited', t:'いい感じぢゃーんw この調子でいこ！' },
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
      { e:'excited', t:'あと少しで勝てそう！ ここ踏ん張って(; \'ω\')ｺﾞｸﾘ' },
      { e:'normal',  t:'ガッツが足りないときは、無理せず1枚だけでもOK。' },
    ],
  },

  // ---- リザルト(優勝・敗北・リタイアで切り替える) ----
  resultWin: {
    help: 'home/result',
    lines: [
      { e:'excited', t:'優勝おめでとー！ まぢで最高(●゚ｪ゚))ｺｸｺｸ' },
      { e:'happy',   t:'ナイス！ 育った勇者モンはマスモン登録しとこ！' },
      { e:'excited', t:'完璧ぢゃんw このまま上の難易度いっちゃう( \'ω\')?' },
      { e:'happy',   t:'お疲れさま！ 報酬もしっかりもらっといてね。' },
      { e:'wink',    t:'今の編成、けっこう強かったね！ 覚えとこ♪' },
    ],
    when: {
      newRecord: [
        { e:'excited', t:'自己ベスト更新おめでとー！ やるぢゃんw' },
        { e:'excited', t:'記録更新きた〜！ ランキングもチェックしてみて！' },
        { e:'happy',   t:'新記録だよ！ この編成、当たりだったね♪' },
        { e:'excited', t:'すごっ(゜∀゜)･∵ﾌﾞﾊｯ!! 次はどこまで伸びるかな〜。' },
        { e:'happy',   t:'ベスト更新おめでと！ あたしも嬉しい♪' },
      ],
      // 通算ではじめての優勝
      firstWin: [
        { e:'excited', t:'はじめての優勝おめでとー！！ めちゃくちゃ嬉しい♪' },
        { e:'excited', t:'やった〜！ 記念すべき1勝目だね！' },
        { e:'happy',   t:'ついにクリアだね！ ここまでよく頑張ったよ♪' },
        { e:'surprise', t:'えっ、もう勝っちゃった！？ すごいぢゃんw' },
        { e:'excited', t:'初優勝！ この子のこと、ちゃんと登録しとこ♪' },
      ],
      firstClear: [
        { e:'excited', t:'この難易度、初クリアだね！ おめでとー♪' },
        { e:'happy',   t:'初制覇きた〜！ 大きな一歩ぢゃんw' },
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
        { e:'crying',   t:'くやしいね…(´;ω;`) でもけっこう惜しかったと思う！' },
        { e:'normal',   t:'次はどこを直そっか？ 一緒に考えよ！' },
        { e:'wink',     t:'一回負けたくらいで終わらないよね？ リベンジいこ！' },
      ],
    },
    lines: [
      { e:'crying',   t:'今回はここまで…でも報酬はちゃんともらえるよ。' },
      { e:'troubled', t:'惜しかったね〜。次はいけそうな気がする(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',   t:'負けても経験値は入るから、育て直してリベンジしよ！' },
      { e:'crying',   t:'うぅ、悔しい…(´;ω;`) でもここまで来たのはすごいよ。' },
      { e:'happy',    t:'切り替えていこ♪ 編成を変えると景色が変わるかも！' },
    ],
  },
  resultRetire: {
    help: 'home/result',
    lines: [
      { e:'troubled', t:'おつかれさま！ クリア済みWAVEぶんの報酬は入るよ。' },
      { e:'normal',   t:'休憩も大事だね。結果だけ確認しとこ！' },
      { e:'happy',    t:'また遊ぼ！ 続きはいつでも待ってるよ(●゚ｪ゚))ｺｸｺｸ' },
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
      { e:'excited', t:'おおっ、ごっそり入ったぢゃん(゜∀゜)･∵ﾌﾞﾊｯ!!' },
      { e:'normal',  t:'スキップ分はランキングとクリア回数には入らないよ。' },
      { e:'wink',    t:'育成が進んだね！ 次のバトルが楽しみ♪' },
      { e:'happy',   t:'お疲れさま！ 増えたぶん、確認してみて。' },
    ],
  },

  // ---- モンスター図鑑 ----
  monsterDex: {
    help: 'home/monster-dex',
    lines: [
      { e:'excited', t:'モンスター図鑑だよ！ 血統もぜんぶ載ってるの♪' },
      { e:'normal',  t:'主血統でしぼりこめるよ。同じ血統の子を並べて見てみて。' },
      { e:'wink',    t:'まだ出会ってない子はシルエット。集めがいあるよね|･ω･`)ﾌﾑﾌﾑ' },
      { e:'happy',   t:'詳細の左右ボタンか、横になぞると次の子へ行けるよ。' },
      { e:'normal',  t:'「能力」に出るのは種そのものの基礎値。育てた子の値じゃないよ。' },
    ],
  },

  // ---- M/B管理・モンスター一覧 ----
  mbManagement: {
    help: 'home/roster',
    lines: [
      { e:'normal',  t:'編成もベースモンもマスモンも、ここから見られるよ。' },
      { e:'wink',    t:'解放しただけじゃ出てこないから、編成に入れてね！' },
      { e:'happy',   t:'最後に「決定」まで押すのを忘れずに♪' },
      { e:'normal',  t:'アシストカードの編成もここからだよ。' },
      { e:'excited', t:'マスモン詳細から強化・トレーニング・染色へ直行できるよ！' },
    ],
  },
  // 編成(モンスター編成・アシストカード編成)
  roster: {
    help: 'home/roster',
    lines: [
      { e:'happy',   t:'編成タイム♪ 誰を連れていく？' },
      { e:'wink',    t:'最後に「決定」まで押さないと反映されないよ！' },
      { e:'normal',  t:'距離のバランスを見ると、けっこう安定するよ。' },
      { e:'excited', t:'この編成、いい感じぢゃーんw' },
      { e:'normal',  t:'アシストカードのほうも忘れずにね！' },
    ],
  },
  monsterList: {
    help: 'home/roster',
    lines: [
      { e:'normal',  t:'ベースモンは種類の基本、マスモンは育てた個体だよ。' },
      { e:'happy',   t:'見たい方を選んでね♪' },
      { e:'wink',    t:'気になる子は詳細を開いてみて。特性が面白いよ！' },
      { e:'normal',  t:'間合い適性は、ここからでも確認できるよ。' },
      { e:'excited', t:'新しい子が増えると、編成の幅が広がるね(´ー`*)ｳﾝｳﾝ' },
    ],
  },
  masuList: {
    help: 'masu/masumon',
    lines: [
      { e:'happy',   t:'育てたマスモンが並んでるよ♪' },
      { e:'wink',    t:'詳細を開くと、強化・トレーニング・染色へすぐ進めるよ♪' },
      { e:'excited', t:'その勇者モン、結構育ってきたぢゃん(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'固有技ポイントが残ってたら、詳細から好きな技に使えるよ。' },
      { e:'happy',   t:'重トレーニングチケットがあるなら、育成を一気に進めるのもアリ！' },
    ],
  },
  // オート強化(個体ごとの自動強化設定)。強化ポイントが入るたび裏で振られる仕組みなので、
  // 画面のなかでも伝える(CLAUDE.md ⑤)。本文は下の addAssistantLinePack から合流する。
  masuAutoEnhance: {
    help: 'masu/auto-enhance',
    lines: [],
  },
  masuEnhance: {
    help: 'masu/enhance',
    lines: [
      { e:'wink',    t:'ポイントは適性か能力値に使えるよ♪' },
      { e:'normal',  t:'得意な戦い方に合わせて伸ばそ！' },
      { e:'happy',   t:'まとめて強化もできるから、ラクだよ〜。' },
      { e:'excited', t:'一気に振ると強くなった感すごいよ(´ー`*)ｳﾝｳﾝ' },
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
      { e:'happy',    t:'うまくいくと一気に育つよ！ でも確認は大事(●゚ｪ゚))ｺｸｺｸ' },
    ],
  },
  rebirth: {
    help: 'masu/rebirth',
    lines: [
      { e:'excited', t:'上限まで育てたごほうびだね♪' },
      { e:'happy',   t:'レベルはそのまま、上限だけ＋5だよ！' },
      { e:'wink',    t:'固有技も1つ上がるから、迷わずいこ！' },
      { e:'excited', t:'星が増えるのもテンション上がるぢゃんw' },
      { e:'normal',  t:'コストを確認したら、いってみよ！' },
    ],
  },
  transcendence: {
    help: 'masu/transcendence',
    lines: [
      { e:'excited', t:'Lv400まで育てた子だけが挑める、限界の先の育成だよ！' },
      { e:'normal',  t:'超越するとLv401以上が解放されて、上限がLv500になるんだ。' },
      { e:'happy',   t:'ここからは普通の強化Pじゃなくて、基礎そのものを伸ばす超越Pが手に入るよ♪' },
      { e:'wink',    t:'虹のプシュケー100個で超越P1にも替えられるから、余ってたら使い道になるね！' },
      { e:'troubled', t:'一度超越したら取り消せないよ。コストもすごいから、よく考えてね。' },
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
      { e:'troubled', t:'寄付したマスモンは戻せないよ…(´;ω;`)' },
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
      { e:'excited', t:'みんな歩いてるとこ見るの、かわいくない( \'ω\')?' },
      { e:'normal',  t:'気分で入れ替えても大丈夫だよ。' },
      { e:'happy',   t:'今日の推しメン、誰にする( \'ω\')?' },
    ],
  },
  market: {
    help: 'home/market',
    lines: [
      { e:'excited', t:'お買い物タイム！ 何にする( \'ω\')?' },
      { e:'normal',  t:'アイコンはpt、ほかはダイヤだよ。' },
      { e:'wink',    t:'買ったモンやカードは、編成に入れるのも忘れずに！' },
      { e:'happy',   t:'ダイヤは大事に使ってね♪' },
      { e:'excited', t:'新しい仲間、増やしちゃう( \'ω\')?' },
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
      { e:'excited', t:'使いどころがハマると気持ちいいよね(´ー`*)ｳﾝｳﾝ' },
    ],
  },

  // ---- ギフト(未受取の有無で切り替える) ----
  giftClaimable: {
    help: 'items/gift',
    lines: [
      { e:'surprise', t:'ギフト届いてるよ！ 受け取っちゃお♪' },
      { e:'excited',  t:'おっ、なんか来てる(●゚ｪ゚))ｺｸｺｸ 中身みてみて！' },
      { e:'happy',    t:'30日で期限切れになるから、今のうちにね！' },
      { e:'surprise', t:'未受取があるよ〜！ もったいない(´;ω;`)' },
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
      { e:'happy',   t:'からっぽってことは、ちゃんと受け取れてる証拠(●゚ｪ゚))ｺｸｺｸ' },
    ],
  },

  // ---- ミッション(受取可能な報酬の有無で切り替える) ----
  missionsClaimable: {
    help: 'items/missions',
    lines: [
      { e:'excited', t:'達成報酬あるよ〜！ 受け取っちゃお♪' },
      { e:'happy',   t:'ナイス達成！ まとめて受け取れるよ。' },
      { e:'surprise', t:'受け取り忘れてない( \'ω\')? ここにあるよ！' },
      { e:'excited', t:'いい感じぢゃーんw ギフトボックスもチェックしてね！' },
      { e:'wink',    t:'受け取ったらギフトに届くよ。忘れずにね！' },
    ],
    when: {
      allDone: [
        { e:'excited', t:'ぜんぶ達成！ コンプリート報酬もゲットしちゃお♪' },
        { e:'excited', t:'パーフェクトぢゃん(゜∀゜)･∵ﾌﾞﾊｯ!! すごすぎ！' },
        { e:'happy',   t:'全達成おめでと〜！ 今日はよく頑張ったね♪' },
        { e:'wink',    t:'コンプリート報酬、忘れずに受け取ってね！' },
        { e:'excited', t:'完璧！ あたしも鼻が高いよ〜(´ー`*)ｳﾝｳﾝ' },
      ],
    },
  },
  missionsNormal: {
    help: 'items/missions',
    lines: [
      { e:'happy',   t:'デイリーとウィークリーを進めよ♪' },
      { e:'normal',  t:'全部達成でコンプリート報酬もあるよ！' },
      { e:'wink',    t:'バトルするだけで進むやつも多いよ。気楽にね！' },
      { e:'excited', t:'あと少しで達成のやつ、ない( \'ω\')?' },
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
      { e:'happy',   t:'分からないことはあたしに任せて(●゚ｪ゚))ｺｸｺｸ' },
      { e:'wink',    t:'気になるカテゴリを選んで、吹き出しもタップしてみて！' },
      { e:'normal',  t:'困ったらここ！ だいたいのことは書いてあるよ。' },
      { e:'excited', t:'攻略のコツもまとめてあるよ〜|･ω･`)ﾌﾑﾌﾑ' },
      { e:'happy',   t:'一緒に強くなろ！ 分からないとこ、つぶしていこ(●゚ｪ゚))ｺｸｺｸ' },
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

// クイック∞周回とモンビーの行き来(docs/spec/QUICK_RHYTHM_LINK.md PR8)。
// 「バトル画面から移れる」「移っても裏で進む」「演奏中だけ止まる」の3つだけを、
// 出るべき場面で1つずつ伝える。詳しい話はヘルプに任せる。
// タクティクスのEXスキルの入口(2026-09-23)。「距離枠をタップ」「タップだけでは使わない」だけを伝える。
// 回数や効き目の細かい話はヘルプに任せる
addAssistantLinePack({
  id: 'tacticsExGuide',
  label: 'タクティクスEXスキル案内',
  lines: {
    tacticsExIntro: [
      { e:'excited', t:'「EX」の印がある子は、距離枠をタップするとEXスキルが見られるよ！' },
      { e:'normal', t:'タップしただけでは使わないよ。「EXスキルを使用」で発動なんだ♪' },
      { e:'wink', t:'EXスキルはカードとは別枠！ カードの枚数は減らないよ。' },
      { e:'normal', t:'子によっては、使ったターンはその子だけカードが使えなくなるよ。' },
      { e:'happy', t:'{name}、EXスキルはβ版のお試しなんだ。感想待ってるね( \'ω\')' },
    ],
  },
});
addAssistantLinePack({
  id: 'tacticsExGuideKiki',
  assistantId: 'kiki',
  label: 'きき・タクティクスEXスキル案内',
  lines: {
    tacticsExIntro: [
      { e:'normal',  t:'「EX」の印がある子は、距離枠をタップするとEXスキルが見られまつ。' },
      { e:'normal',  t:'タップしただけでは使わないでつ。「EXスキルを使用」で発動。' },
      { e:'happy',   t:'EXスキルはカードとは別枠。カードの枚数は減らないの。' },
      { e:'normal',  t:'子によっては、使ったターンはその子だけカードが使えなくなりまつ。' },
      { e:'wink',    t:'{name}、EXスキルはβ版のお試し。気づいたこと教えてね♪' },
    ],
  },
});
addAssistantLinePack({
  id: 'tacticsExGuideMomosuke',
  assistantId: 'momosuke',
  label: 'ももすけ・タクティクスEXスキル案内',
  lines: {
    tacticsExIntro: [
      { e:'excited', t:'「EX」の印、見えた？ 距離枠をタップするとEXスキルが見られるよ！' },
      { e:'normal',  t:'タップだけじゃ発動しないから安心して。「EXスキルを使用」で使うんだ。' },
      { e:'wink',    t:'EXはカードと別枠！ カードの枚数は減らないんだよね。' },
      { e:'normal',  t:'使ったターンは、その子だけカードが使えなくなることもあるよ。' },
      { e:'happy',   t:'{name}、β版のお試しだってさ。いろいろ試してみようよw' },
    ],
  },
});
addAssistantLinePack({
  id: 'tacticsExGuideDra',
  assistantId: 'dra',
  label: 'ドラ・タクティクスEXスキル案内',
  lines: {
    tacticsExIntro: [
      { e:'happy',   t:'「EX」の印がある子は、距離枠をタップしたらEXスキルが見られるで' },
      { e:'normal',  t:'タップしただけでは使わへん。「EXスキルを使用」で発動や' },
      { e:'normal',  t:'EXはカードとは別枠や。カードの枚数は減らんで' },
      { e:'wink',    t:'使ったターンはその子だけカード使えんこともあるから気ぃつけや' },
      { e:'happy',   t:'{name}、β版のお試しらしいわ。遠慮なく試してみ' },
    ],
  },
});

addAssistantLinePack({
  id: 'quickRhythmLinkGuide',
  label: '∞周回×モンヒロビート案内',
  lines: {
    quickRhythmIntro: [
      { e:'excited', t:'∞周回にしたね！ このまま「🎵 モンヒロビート」から音ゲーで遊べるよ♪' },
      { e:'happy', t:'{name}、周回は裏で続くから、待ってるあいだに1曲どう( \'ω\')?' },
      { e:'normal', t:'バトルへ戻りたくなったら、モンヒロビートの左上の「⚔ 戻る」でいつでも戻れるよ。' },
      { e:'wink', t:'「🎵 BGM」のすぐ下が入口だよ。省エネ「超」のときも同じ場所にあるからね。' },
      { e:'happy', t:'裏で回せるのはクイックの∞周回だけなんだ。ほかのモードは記録が絡むからね。' },
      { e:'normal', t:'アプリを閉じたり別のアプリへ移ると、そこで周回は止まるよ(´;ω;`)' },
    ],
    quickRhythmBackground: [
      { e:'excited', t:'ここにいるあいだも周回は進んでるよ！ 経験値もダイヤも貯まってる(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal', t:'演奏してるあいだは止まるけど、最後まで叩けば曲の長さぶんの周回が入るよ♪' },
      { e:'happy', t:'上の帯をタップすると、何周めか・どれだけ貯まったかを見られるよ。' },
      { e:'wink', t:'{name}、遊んでるあいだに強くなってるの、得した気分でしょw' },
      { e:'normal', t:'バトルへ戻るときは、左上の「⚔ 戻る」か、帯の中の「⚔ バトルへ戻る」からどうぞ。' },
    ],
    autoQuickRunSettings: [
      { e:'normal', t:'ここを決めておくと、モンヒロビートからそのまま∞周回を始められるよ。' },
      { e:'happy', t:'勇者モンと配置と難易度の3つ。決めてなければ、直前に組んだ編成をそのまま使うね。' },
      { e:'wink', t:'まだ解放してない難易度は選べないよ。並んではいるけどね。' },
      { e:'normal', t:'3つそろうと、下の一言が「始められます」に変わるから目印にしてね。' },
      { e:'happy', t:'{name}が育ててる子を選んどくと、放っとくだけで絆も伸びるよ(●゚ｪ゚))ｺｸｺｸ' },
    ],
  },
});

// オート強化(2026-09-12)。「決めておけば、あとは放っておくだけ」が伝わるようにする。
addAssistantLinePack({
  id: 'masuAutoEnhanceGuide',
  label: 'オート強化案内',
  lines: {
    masuAutoEnhance: [
      { e:'excited', t:'ここで決めとけば、強化ポイントが入るたびあたしが振っとくよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'上から順に、上限まで振っていくよ。並べ替えて優先順位を決めてね。' },
      { e:'happy',   t:'{name}、転生する前に「いまの配分を上限として取り込む」を押しておくのがコツ！' },
      { e:'wink',    t:'転生しても、この設定だけは消えないよ。だから周回してるだけで元の形まで戻るんだ♪' },
      { e:'normal',  t:'上限まで振り終わったぶんは、ちゃんと手元に残しておくからね。' },
      { e:'happy',   t:'ぜんぶ任せるのが不安なら、大事な子だけONにしてもいいんだよ。' },
      { e:'troubled', t:'振る先を1つも決めてないと、ONでも何も起きないよ(; \'ω\')ｺﾞｸﾘ' },
      { e:'excited', t:'{name}が見てないあいだも働いてるからね！ えらいでしょ( \'ω\')?', bond:4 },
    ],
  },
});

// モンビー(モンヒロビート)。曲えらびでは「まず何をするか」、遊びかたでは
// 「困ったらここを見れば分かる」を伝える(2026-09-05・ユーザー指示で追加)。
addAssistantLinePack({
  id: 'rhythmModeGuide',
  label: 'モンヒロビート案内',
  lines: {
    rhythmHome: [
      { e:'excited', t:'曲をえらんで、難易度をえらんで、決定！ それだけで始まるよ♪' },
      { e:'happy', t:'{name}、どの曲にする( \'ω\')? 迷ったら「ランダム」も楽しいよ。' },
      { e:'normal', t:'えらんでる曲は流れてるから、聴いてから決めていいんだよ。' },
      { e:'wink', t:'難しいと感じたら、オプションでノーツ速度を下げてみて！' },
      { e:'normal', t:'EXPERTとMASTERは、1つ下の難易度をクリアすると開くよ。' },
      { e:'happy', t:'横画面にすると、曲の一覧と選んだ曲を並べて見られるよ(´ー`*)ｳﾝｳﾝ' },
    ],
    rhythmWeeklyEvent: [
      { e:'excited', t:'期間限定イベント開催中だよ！ この期間に出したスコアだけで勝負なの♪' },
      { e:'happy', t:'部門ごとに報酬があるよ。何位で何がもらえるかは、部門を開くと出るからね。' },
      { e:'normal', t:'報酬はイベントが終わったあとに受け取れるよ。あわてなくて大丈夫(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal', t:'イベントは「イベント」タブだよ。いつもの週間ランキングも別のタブでそのまま動いてるからね♪' },
      { e:'wink', t:'{name}、終わるまでに1曲置いていこ( \'ω\')? 総合にも載るからね！' },
    ],
    rhythmMonsters: [
      { e:'excited', t:'ここで決めた子は、曲の途中で金色のノーツになって出てくるよ♪' },
      { e:'normal', t:'上から順に登場するよ。1体につき1回、多くて4回ね。' },
      { e:'happy', t:'GREATより良い判定で取れたら、その子の能力が出るよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal', t:'能力は主血統で決まるの。育てても染めても変わらないよ。' },
      { e:'wink', t:'ライフがきついなって思ったら、元気の子や無敵の子を入れてみて！' },
      { e:'happy', t:'{name}のいちばん好きな子でもいいんだよ。かわいいぢゃんw' },
    ],
    rhythmHelp: [
      { e:'happy', t:'遊びかたはここにぜんぶ書いてあるよ。困ったらいつでも見にきてね♪' },
      { e:'normal', t:'ノーツの種類も、判定も、スコアの決まり方も、ここで確かめられるよ。' },
      { e:'wink', t:'説明を読むより体で覚える派なら、上の「もう一度チュートリアル」からどうぞ！' },
      { e:'excited', t:'{name}が知りたいことは、たぶんこの中にあるよ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'normal', t:'ここに書いてあることは、設定のヘルプにあるものと同じだよ。' },
      { e:'happy', t:'読んでも分からなかったら、1回遊んでみるのがいちばん早いかもw' },
    ],
  },
});

// 極限チャレンジ。モード選択(extremeChallenge)ではモード全体に共通する特徴を案内し、
// EXTREME固有の倍率やアシストカード50%は難易度側(extremeDifficulty)でだけ触れる。
addAssistantLinePack({
  id: 'extremeChallengeGuide',
  label: '極限チャレンジ案内',
  lines: {
    extremeChallenge: [
      { e:'excited', t:'ここから先は極限チャレンジ！ チャレンジよりずっと手強いよ♪' },
      { e:'happy', t:'育てたモンスターの本気を試すなら、極限チャレンジ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'troubled', t:'名前どおり極限！ 生半可な育成ぢゃ厳しいかも(; \'ω\')ｺﾞｸﾘ' },
      { e:'wink', t:'上位プレイヤー向けの腕試しだよ。強敵との勝負、燃えるぢゃんw' },
      { e:'normal', t:'チャレンジモードのさらに上！ 無理そうなら育成して出直すのも作戦だよ。' },
      { e:'excited', t:'専用ランキングもあるよ！ 育てた子の本気を記録に残そ♪' },
      { e:'surprise', t:'EXTREMEの先にも、さらに上の難易度が待ってるんだって( ˙-˙ )' },
      { e:'happy', t:'手強くなるほど高い報酬も狙えるよ。育てた子と一緒に限界へ挑も♪' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'EXTREMEはアシストカードの効果が半分！ いつもの感覚だと危ない(; \'ω\')ｺﾞｸﾘ' },
      { e:'surprise', t:'敵強度はなんと×13！ 育てた子の本気を見せるとき(●゚ｪ゚))ｺｸｺｸ' },
      { e:'excited', t:'虹のプシュケー報酬と全WAVE詳細、挑む前に見ておこ♪' },
      { e:'wink', t:'ここはEXTREME！ 準備できてるなら、思いっきりいこ！' },
      { e:'normal', t:'厳しそうなら無理しなくてOK。もうひと育成してから挑むのもアリだよ。' },
      { e:'happy', t:'EXTREMEへの挑戦、あたしも応援してる(●゚ｪ゚))ｺｸｺｸ' },
    ],
  },
});

// モンヒロバトルの入口(2026-09-20 ユーザー指示で、モード選択の1つ上に画面を増やした)。
// どのバトルで遊ぶかをここで選ぶので、選び方の手がかりをひとこと出す。
// ★助手は4人いるので、4人ぶん束を足す(1人でも欠けると assistant-check が落ちる)
addAssistantLinePack({
  id: 'battleSystemSelectGuideKiki',
  assistantId: 'kiki',
  label: 'モンヒロバトルの入口案内(きき)',
  lines: {
    battleSystemSelect: [
      { e:'normal', t:'ここで、どのバトルで遊ぶか決めるよ。' },
      { e:'happy',  t:'選んだバトルの中に、チャレンジや種族チャレンジが入ってる。' },
      { e:'wink',   t:'クイックはそのまま難易度えらびに行くよ ( ˘ω˘)9グッ!' },
      { e:'normal', t:'記録はバトルごとに別。好きなほうを伸ばしていいよ。' },
      { e:'happy',  t:'{name}、迷ったら「これまでのバトル」でいいと思う。' },
    ],
  },
});
addAssistantLinePack({
  id: 'battleSystemSelectGuideMomosuke',
  assistantId: 'momosuke',
  label: 'モンヒロバトルの入口案内(ももすけ)',
  lines: {
    battleSystemSelect: [
      { e:'wink',    t:'まずはどのバトルで遊ぶか選んでw' },
      { e:'happy',   t:'中にチャレンジとか種族チャレンジが入ってるからね。' },
      { e:'excited', t:'クイックはそのまま難易度えらび！ さくっと行きたいときはこれ♪' },
      { e:'normal',  t:'記録もランキングもバトルごとに別々だよ。' },
      { e:'wink',    t:'{name}、迷ったら「これまでのバトル」でいいんじゃない？w' },
    ],
  },
});
addAssistantLinePack({
  id: 'battleSystemSelectGuideDra',
  assistantId: 'dra',
  label: 'モンヒロバトルの入口案内(どらごん)',
  lines: {
    battleSystemSelect: [
      { e:'normal', t:'まずはどのバトルでやるか決めるとこだな' },
      { e:'happy',  t:'選んだやつの中に、チャレンジとか種族チャレンジが入っとるわ' },
      { e:'normal', t:'クイックはそのまま難易度えらびや。さっと遊びたいときにええで' },
      { e:'normal', t:'記録はバトルごとに別々やから、好きなほうやったらええ' },
      { e:'happy',  t:'{name}、迷ったら「これまでのバトル」からでええと思うで' },
    ],
  },
});
addAssistantLinePack({
  id: 'battleSystemSelectGuide',
  label: 'モンヒロバトルの入口案内',
  lines: {
    battleSystemSelect: [
      { e:'happy', t:'モンヒロバトルへようこそ♪ まずはどのバトルで遊ぶか選んでね(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal', t:'選んだバトルの中に、チャレンジや種族チャレンジが並んでるよ。' },
      { e:'wink', t:'クイックモードは選んだらすぐ難易度えらびだよ。さくっと遊びたいときにどうぞ♪' },
      { e:'excited', t:'記録もランキングもバトルごとに別々だから、好きなほうを伸ばしていいよ！' },
      { e:'normal', t:'{name}、迷ったら「これまでのバトル」からで大丈夫だよ( \'ω\')' },
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
      { e:'excited', t:'有利と不利で補正のかかり方が違うよ。作戦を練って挑も(●゚ｪ゚))ｺｸｺｸ' },
    ],
    chaosDifficulty: [
      { e:'surprise', t:'CHAOSは敵の強さが一気に×20！ 本当に極限の戦い(; \'ω\')ｺﾞｸﾘ' },
      { e:'normal', t:'NIGHTMAREを1回クリアするとCHAOSへ挑めるよ。' },
      { e:'excited', t:'CHAOSはスコア×20、経験値×35、ダイヤ×15！ 報酬もすごいよ！' },
      { e:'troubled', t:'与ダメージと加入ボーナスは半分、消費ガッツは1.5倍。慎重にいこ！' },
      { e:'wink', t:'CHAOSクリアで虹のプシュケー50個！ 全力で応援する(●゚ｪ゚))ｺｸｺｸ' },
    ],
    ultimateDifficulty: [
      { e:'surprise', t:'ULTIMATEは敵強度×35！ CHAOSをクリアした猛者だけの究極戦だよ！' },
      { e:'normal', t:'累計ターンが増えるほど、次WAVEの敵は強く、加入ボーナスは低くなるよ。' },
      { e:'excited', t:'スコア×20、経験値×40、ダイヤ×20！ 虹のプシュケーは60個だよ♪' },
      { e:'troubled', t:'トレーニングもWAVEのターン数で低下するから、素早い勝利が大切だね。' },
      { e:'wink', t:'35ターンごとの段階的なDISTANCE BREAKに備えて、いろんな距離で戦お♪' },
    ],
    infinityDifficulty: [
      { e:'excited', t:'INFINITYは極限のルールが全部のっかってるよ。' },
      { e:'surprise', t:'敵は50倍…！ ルール詳細をぜんぶ読んでから行こうね。' },
      { e:'normal', t:'25ターンごとにDISTANCE BREAK。長引くほど苦しくなるよ。' },
      { e:'troubled', t:'与ダメは1ターンごとに1pt落ちるの。速さがそのまま強さだね。' },
      { e:'wink', t:'ULTIMATEをクリアしたあなたなら、きっと戦えるはず(●゚ｪ゚))ｺｸｺｸ' },
    ],
    godDifficulty: [
      { e:'surprise', t:'GODは敵強度100倍！ INFINITYを越えた最上位の極限だよ！' },
      { e:'normal', t:'2WAVEごとに神威が上がって、ルールの実効値も厳しくなるよ。' },
      { e:'troubled', t:'20ターンごとのDISTANCE BREAKと累計ターン低下に気をつけて。' },
      { e:'surprise', t:'WAVE9からは神域封鎖で安全距離がなくなるよ…(; \'ω\')ｺﾞｸﾘ' },
      { e:'wink', t:'INFINITYをクリアしたあなたの総力戦。ルール詳細を読んで挑も♪' },
    ],
    ragnarokDifficulty: [
      { e:'surprise', t:'RAGNAROKは敵強度200倍…！ GODを越えた、いちばん奥の難易度だよ。' },
      { e:'normal', t:'2WAVEごとに黄昏が深まって、最後は敵が2倍まで上がるの。' },
      { e:'troubled', t:'DISTANCE BREAKは15ターンごと。安全な距離はひとつも無いよ…！' },
      { e:'surprise', t:'WAVE5とWAVE10のボスは、倒しても起き上がるからね。油断しないで！' },
      { e:'wink', t:'長引くほど苦しくなるから、短く決めるのがコツ。がんばって(●゚ｪ゚))ｺｸｺｸ' },
    ],
  },
});

// 種族チャレンジ。選択画面の各段(種族→勇者→供モン→確認)で言うことを変える。
// 段を渡さない場合は lines のほうが使われる
addAssistantLinePack({
  id: 'speciesChallengeGuide',
  label: '種族チャレンジ案内',
  lines: {
    speciesChallenge: [
      { e:'excited', t:'ひとつの種族だけで10WAVE！ しばりプレイだよ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'happy', t:'育てている種族から挑むのがいちばん近道(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal', t:'記録は種族と難易度の組み合わせごとに別々に残るよ。' },
      { e:'wink', t:'はじめてクリアした組み合わせでは、その種族の超越の実がもらえるよ♪' },
      { e:'surprise', t:'いつもの記録は変わらないから、気軽に挑戦してみて！' },
      { e:'happy', t:'難易度は種族ごとに1つずつ解放していくんだ。焦らずいこ(´ー`*)ｳﾝｳﾝ' },
    ],
  },
  conditions: {
    // 期間限定イベントのあいだ。週間の「毎週月曜5:00」の話をそのまま出すと、
    // 週間が動いていると誤解される(画面側から condition='limited' で切り替える)
    speciesChallenge: {
      species: [
        { e:'excited', t:'まずはどの種族で挑むか決めよ！ 育てている子がいる種族がおすすめ♪' },
        { e:'normal', t:'種族ごとに難易度の解放は別々だよ。得意な種族から進めるのもアリ！' },
        { e:'happy', t:'モンスターが何種類いるかで、連れていける供モンの数も変わるよ。' },
        { e:'wink', t:'迷ったら、いちばん育っている子のいる種族から行こ♪' },
        { e:'normal', t:'あとから別の種族へ挑んでも、こっちの記録は消えないよ。' },
      ],
      hero: [
        { e:'excited', t:'勇者モンを決めよ！ この子が最後まで戦い抜くよ。' },
        { e:'normal', t:'勇者モンにした子が、いちばん絆経験値をもらえるよ。' },
        { e:'happy', t:'いちばん育っている子を勇者モンにするのが安全だね♪' },
        { e:'wink', t:'勇者モンにした種は、供モンには選べなくなるよ。' },
        { e:'normal', t:'置く距離もあとで決めるから、間合い適性も見ておこ！' },
      ],
      allies: [
        { e:'happy', t:'供モンは最大3体。WAVE2・4・6で1体ずつ合流するよ♪' },
        { e:'normal', t:'同じモンスターは勇者モンと合わせて1体まで。別の種なら一緒に行けるよ。' },
        { e:'wink', t:'選べる子がいなければ、供モンなしのまま挑んでも大丈夫！' },
        { e:'excited', t:'誰をいつ合流させるかは、その場で選べるよ♪' },
        { e:'normal', t:'間合いが散らばるように選ぶと、どの距離でも戦いやすいよ。' },
      ],
      confirm: [
        { e:'excited', t:'準備はいい？ この編成で行こう！' },
        { e:'happy', t:'はじめてのクリアなら、超越の実がもらえるよ♪' },
        { e:'wink', t:'クリアできたら、同じ種族の次の難易度が開くよ！' },
        { e:'normal', t:'途中で厳しくなったら、あきらめても進んだぶんの報酬はもらえるよ。' },
        { e:'happy', t:'いってらっしゃい！ あたしはここで応援してるね♪' },
      ],
    },
  },
});

// ===== 親密度ぶんのセリフ(HOME) =====
addAssistantLinePack({
  id: 'dailyMasuAdvice',
  label: '日次・マスモン登録アドバイス',
  lines: {
    dailyMasuAdvice: [
      { e:'wink', t:'マスモンを早く増やしたいなら、いい方法あるよ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'happy', t:'クイックのBeginnerでWAVE2まで進んだら、\n「あきらめる」を選んでみて！' },
      { e:'excited', t:'これが今のところ、マスモンを一番早く登録できる方法(●゚ｪ゚))ｺｸｺｸ' },
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
      { e:'wink',     t:'{name}、いい感じぢゃんw その調子！', bond:2 },
      // Lv3〜4: 呼び捨て。雑談が増える
      { e:'happy',    t:'{name}、今日はどこ行く？', bond:[3,4] },
      { e:'excited',  t:'{name}、その育成いい感じ！ センスあるぢゃんw', bond:[3,4] },
      { e:'normal',   t:'なんか今日、いつもより調子よさそう。気のせい( \'ω\')?', bond:[3,4] },
      { e:'normal',   t:'ねえ{name}、そろそろ編成いじってみない？', bond:[3,4] },
      { e:'happy',    t:'おかえり！ 今日は何する( \'ω\')?', bond:[3,4] },
      { e:'happy',    t:'{name}なら大丈夫だって！ いってらっしゃい♪', bond:4 },
      { e:'wink',     t:'今日も楽しもう！ 難しく考えなくていいよ。', bond:4 },
      { e:'excited',  t:'あたし、{name}の作るチーム好きなんだよね(´ー`*)ｳﾝｳﾝ', bond:4 },
      // Lv5: 特別感。ただし馴れ馴れしくはしない
      { e:'excited',  t:'{name}、おかえり〜！ 待ってた(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'happy',    t:'{name}、今日も一緒に頑張ろ！', bond:5 },
      { e:'wink',     t:'{name}が来ると、なんか安心するんだよね(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'happy',    t:'今日はどうする( \'ω\')? {name}が決めていいよ！', bond:5 },
      { e:'excited',  t:'{name}とここまで来たんだなぁって、たまに思う(´ー`*)ｳﾝｳﾝ', bond:5, w:0.4 },
      { e:'normal',   t:'{name}、無理はしないでね。あたしはずっとここにいるから。', bond:5, w:0.4 },
      // どのLvでも出る、村のようすや案内
      { e:'normal',   t:'マスモンの絆レベル、こまめに見てあげてね。' },
      { e:'happy',    t:'ギフト届いてないかな( \'ω\')? たまに覗いてみて！' },
      { e:'wink',     t:'ミッションの達成状況もチェックしとこ♪' },
      { e:'excited',  t:'新しい円盤石、マーケットに来てるかも！' },
      { e:'normal',   t:'放牧に出したマスモン、村を歩いてるよ。見た？' },
      { e:'happy',    t:'更新履歴、たまに読むと新しい発見があるかも！' },
      { e:'normal',   t:'今日のぶんのログインボーナス、受け取った( \'ω\')?' },
      { e:'troubled', t:'ダイヤ、使いどころ迷うよね〜。あたしも迷う( ˙-˙ )', w:0.5 },
      { e:'happy',    t:'ちょっと休憩するのも大事だよ。ゲームは逃げないからねw', w:0.5 },
      // たまにしか出ない、ひとりごとみたいなセリフ
      { e:'surprise', t:'あ、いま向こうでマスモンが転んだ気がする…気のせい( \'ω\')?', w:0.25 },
      { e:'wink',     t:'ひみつだけど、あたし雨の日の村がいちばん好き(●゚ｪ゚))ｺｸｺｸ', w:0.25 },
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
      { e:'wink',    t:'{name}になら、なんでも話せる気がする(´ー`*)ｳﾝｳﾝ', bond:8 },
      { e:'excited', t:'{name}とはもう戦友だね！ 一緒に乗り越えよ♪', bond:9 },
      { e:'happy',   t:'{name}とはいい腐れ縁になってきたかもw', bond:10 },
      { e:'wink',    t:'{name}の次の一手、なんとなく分かってきた(´ー`*)ｳﾝｳﾝ', bond:11 },
      { e:'excited', t:'{name}みたいな人、あたしには他にいないよ(●゚ｪ゚))ｺｸｺｸ', bond:12 },
      { e:'happy',   t:'{name}と一緒だと、なんか一心同体って感じ(´ー`*)ｳﾝｳﾝ', bond:13 },
      { e:'excited', t:'{name}とあたし、伝説のコンビになれそうぢゃんw', bond:14 },
      { e:'wink',    t:'{name}とは運命共同体だと思ってる(●゚ｪ゚))ｺｸｺｸ', bond:15 },
      { e:'happy',   t:'{name}が困ってたら、あたし絶対気づくからね！', bond:16 },
      { e:'excited', t:'{name}は、あたしの生涯のパートナーって感じ♪', bond:17 },
      { e:'happy',   t:'{name}は、あたしのかけがえのない存在だよ♪', bond:18 },
      { e:'wink',    t:'{name}のことなら、あたしがいちばん分かってる(●゚ｪ゚))ｺｸｺｸ', bond:19 },
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
      { e:'happy',    t:'{name}、いい編成できてるぢゃんw いけると思う！', bond:2 },
      { e:'excited',  t:'{name}、今日は上の難易度いってみない？', bond:[3,4] },
      { e:'happy',    t:'{name}のスコア、そろそろ伸びどきだと思う(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'normal',   t:'距離の合わせ方さえハマれば、一気に伸びるよ。', bond:[3,4] },
      { e:'wink',     t:'あたし、{name}が本気出すとこ見たいんだよね(´ー`*)ｳﾝｳﾝ', bond:4 },
      { e:'happy',    t:'{name}なら大丈夫。いつもどおりでいこ！', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ ここで見てるからね(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'happy',    t:'{name}、今日も一緒に記録更新しよ！', bond:5 },
      { e:'wink',     t:'{name}のスコア、あたしが誰よりも覚えてる(´ー`*)ｳﾝｳﾝ', bond:5, w:0.5 },
      { e:'normal',   t:'難易度が上がるほど、敵もスコアも大きくなるよ。' },
      { e:'happy',    t:'自己ベストは難易度ごとに別々に記録されるんだ。' },
      { e:'normal',   t:'倒しきれなくても、進んだWAVEぶんの報酬はもらえるよ。' },
      { e:'wink',     t:'ガッツの残しかたで、終盤の粘りが変わるからね！' },
      { e:'excited',  t:'ブリーダーの教え、拾いどきを間違えないようにね♪' },
      { e:'normal',   t:'勇者モンの固有技、レベル上げると化けるよ。' },
      { e:'troubled', t:'ムーは強いよ…(; \'ω\')ｺﾞｸﾘ でも倒せない相手ぢゃないよ！' },
      { e:'happy',    t:'編成が決まらないときは、間合いのバランスから見てみて。' },
      { e:'surprise', t:'会心が続くときって、なんか気持ちいいよね〜(´ー`*)ｳﾝｳﾝ', w:0.3 },
      { e:'normal',   t:'負けたときこそ、次に何を変えるかが大事だと思うんだ。', w:0.5 },
    ],
    battleQuick: [
      { e:'happy',    t:'{name}、サクッと回したいときはこっちですね♪', bond:[1,2] },
      { e:'normal',   t:'クイックはランキングに乗らないので、気楽にどうぞ！', bond:[1,2] },
      { e:'wink',     t:'{name}、育成したい子を連れていきましょ♪', bond:[1,2] },
      { e:'excited',  t:'{name}、今日はどの子を育てる？', bond:[3,4] },
      { e:'happy',    t:'{name}、周回はほどほどにね。疲れちゃうから！', bond:[3,4] },
      { e:'wink',     t:'{name}、あたしも一緒に数えててあげる笑', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ 何周でも付き合うよ(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'happy',    t:'{name}、無理して回さなくていいからね。', bond:5, w:0.5 },
      { e:'normal',   t:'クイックはWAVEごとに味方が自動で強くなるよ。' },
      { e:'happy',    t:'経験値とダイヤは1.5倍！ 育成にはぴったりだね♪' },
      { e:'normal',   t:'スキップチケットはこっちのモードでだけ使えるよ。' },
      { e:'wink',     t:'固有技もひとりでに伸びるから、放っといても育つよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',   t:'チャレンジの自己ベストは、こっちでは動かないから安心して。' },
      { e:'happy',    t:'まとめて育てたいときは、絆を伸ばしたい子を勇者モンに！' },
    ],
    battlePro: [
      { e:'normal',   t:'{name}、プロはベースモンだけです。慣れてからでも遅くないですよ！', bond:[1,2] },
      { e:'happy',    t:'{name}、育てたい子を勇者モンにすると伸びが早いですよ♪', bond:[1,2] },
      { e:'wink',     t:'{name}、供モンは5体選んでくださいね。3体が加わります♪', bond:[1,2] },
      { e:'excited',  t:'{name}、そろそろプロに挑んでみない( \'ω\')?', bond:[3,4] },
      { e:'happy',    t:'{name}、素の力だけで勝つのかっこいいよね(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'wink',     t:'{name}のプロの記録、あたしが見届けてあげる(●゚ｪ゚))ｺｸｺｸ', bond:4 },
      { e:'excited',  t:'{name}、いってらっしゃい！ ここが一番燃えるところだよ！', bond:5 },
      { e:'happy',    t:'{name}なら、この難しさも楽しめると思うんだ。', bond:5, w:0.5 },
      { e:'normal',   t:'マスモンは連れていけないよ。全員ベースモンからのスタート！' },
      { e:'excited',  t:'絆経験値は3倍！ 新しい子を一気に育てられるよ♪' },
      { e:'happy',    t:'ブリーダー経験値も1.5倍。ちょっとお得だね！' },
      { e:'normal',   t:'ダイヤとスコアの倍率は、難易度どおりだよ。' },
      { e:'wink',     t:'ランキングはチャレンジと別枠。プロの人たちと勝負だね！' },
      { e:'normal',   t:'勇者モンにした子は、勝ったあとマスモンに登録できるよ。' },
      { e:'troubled', t:'強化の拾いかたを間違えると、一気に押されちゃう(; \'ω\')ｺﾞｸﾘ' },
      { e:'happy',    t:'供モンの候補は、間合いをばらけさせておくと安心かな♪' },
      { e:'normal',   t:'誰が加わるかはランダム。5体ぜんぶ使える子にしておこう。' },
      { e:'surprise', t:'ベースモンだけでムーを倒す人、ほんとにいるんだよ笑', w:0.3 },
    ],
    ranking: [
      { e:'happy',    t:'{name}、まずは上位の編成を見てみましょ♪', bond:[1,2] },
      { e:'normal',   t:'順位は気にしすぎなくて大丈夫ですよ！', bond:[1,2] },
      { e:'excited',  t:'{name}の名前、そのうちここに載りますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、上の人の編成けっこう参考になるよ！', bond:[3,4] },
      { e:'wink',     t:'{name}なら、あの辺までいけると思う(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'excited',  t:'{name}の名前、探しちゃったw', bond:4 },
      { e:'happy',    t:'{name}が上に行くの、あたしが一番楽しみにしてるからね！', bond:5 },
      { e:'wink',     t:'{name}の記録、ぜんぶ覚えてるよ♪', bond:5, w:0.5 },
      { e:'normal',   t:'スコアは難易度ごとに分かれてるよ。' },
      { e:'happy',    t:'ブリーダーLvは、同じ名前でいちばん高い記録がまとまって出るよ。' },
      { e:'normal',   t:'絆Lvはモンスターの種類ごとに切り替えられるんだ。' },
      { e:'wink',     t:'上位の人の編成、タップすると詳しく見られるよ♪' },
      { e:'normal',   t:'ランキングはチャレンジ・プロ・極限チャレンジで別々だよ。' },
      { e:'surprise', t:'このスコア、どうやって出したんだろ…気になる( \'ω\')?', w:0.3 },
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
      { e:'happy',    t:'{name}、今日は誰を合体させる( \'ω\')?', bond:[3,4] },
      { e:'normal',   t:'{name}のこだわり編成、けっこう好き(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'excited',  t:'{name}、思いきって転生しちゃお！ あたしが見ててあげる♪', bond:[3,4] },
      { e:'wink',     t:'{name}、そのマスモン大事にしてるでしょ。分かる(´ー`*)ｳﾝｳﾝ', bond:4 },
      { e:'happy',    t:'{name}、この子とはずいぶん長いよね(´ー`*)ｳﾝｳﾝ', bond:5, w:0.5 },
      { e:'excited',  t:'{name}、今日はどんな子ができるかな( \'ω\')? わくわくする！', bond:5 },
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
      { e:'normal',   t:'ここの空気、なんだか落ち着くと思わない( \'ω\')?' },
      { e:'surprise', t:'この神殿、誰が建てたか知らないんだよね…気になる( ˙-˙ )', w:0.3 },
      { e:'troubled', t:'手放す判断ってむずかしいよね。あたしも苦手(´;ω;`)', w:0.4 },
      { e:'happy',    t:'ダイヤに余裕があるときは、合体を試してみるのもアリだよ♪' },
    ],
    roster: [
      { e:'happy',    t:'{name}、編成は4体まで入れられますよ♪', bond:[1,2] },
      { e:'normal',   t:'勇者モンと供モンで役割が変わりますからね。', bond:[1,2] },
      { e:'wink',     t:'{name}、迷ったら間合いのバランスを見てみましょ！', bond:[1,2] },
      { e:'excited',  t:'{name}、いい並びになってきましたね♪', bond:[1,2] },
      { e:'happy',    t:'{name}、その編成いいぢゃん！ バランス取れてるw', bond:[3,4] },
      { e:'normal',   t:'{name}って、けっこう近距離が好きだよね( \'ω\')?', bond:[3,4] },
      { e:'excited',  t:'{name}の編成、見てるだけで楽しい♪', bond:4 },
      { e:'wink',     t:'{name}ちの主力、そろそろ入れ替えどきかも( \'ω\')?', bond:4 },
      { e:'excited',  t:'{name}、その編成めちゃ好き！ あたし好みだ〜(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'happy',    t:'{name}が選ぶ子って、なんか味があるんだよね(´ー`*)ｳﾝｳﾝ', bond:5, w:0.5 },
      { e:'normal',   t:'間合い適性は4つの距離ぜんぶにかかるよ。' },
      { e:'happy',    t:'合流ボーナスは供モンの絆レベルで決まるんだ♪' },
      { e:'normal',   t:'ベースモンからも勇者モンを選べるよ。' },
      { e:'wink',     t:'同じ種類ばかりだと、間合いが偏っちゃうから注意ね！' },
      { e:'excited',  t:'育てたい子を勇者モンにすると、絆経験値がいっぱい入るよ♪' },
      { e:'normal',   t:'編成を変えても、マスモンの記録は消えないから安心して。' },
      { e:'happy',    t:'アシストカードも忘れずに入れてね！' },
      { e:'normal',   t:'カードの枚数は勇者モンの特性で増えることがあるよ。' },
      { e:'surprise', t:'この並び、なんか強そうな気がする…(●゚ｪ゚))ｺｸｺｸ', w:0.3 },
      { e:'wink',     t:'正解はひとつじゃないから、好きな子を入れていいと思うよ♪' },
    ],
    masuList: [
      { e:'happy',    t:'{name}、育てた子はここに並びますよ♪', bond:[1,2] },
      { e:'normal',   t:'絆レベルが上がると、強化ポイントがもらえます。', bond:[1,2] },
      { e:'excited',  t:'{name}、ずいぶん増えましたね♪', bond:[1,2] },
      { e:'happy',    t:'{name}、この子たちみんな{name}が育てたんだよねw', bond:[3,4] },
      { e:'wink',     t:'{name}、名前つけるセンスあると思う(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'excited',  t:'{name}のマスモン、見てるだけで時間溶けるw', bond:4 },
      { e:'happy',    t:'{name}、この子たちと一緒にここまで来たんだね(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'normal',   t:'{name}のお気に入り、あたし当てられる気がするw', bond:5, w:0.4 },
      { e:'normal',   t:'強化ポイントは間合い適性とステータスに振れるよ。' },
      { e:'happy',    t:'振り直したいときは、絆ポイントリセットの書を使ってね♪' },
      { e:'normal',   t:'名前は何度でも変えられるよ。' },
      { e:'wink',     t:'染色で見た目を変えると、愛着わくよ〜(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',   t:'並び順は絞り込みと並べ替えで変えられるよ。' },
      { e:'excited',  t:'星の数は転生した回数だよ。増やすと上限も上がる！' },
      { e:'happy',    t:'まとめて強化すると、一気に振れて楽だよ♪' },
    ],
    market: [
      { e:'happy',    t:'{name}、アイコンはpt、ほかはダイヤで買えますよ♪', bond:[1,2] },
      { e:'normal',   t:'買ったものは次の周回から使えます。', bond:[1,2] },
      { e:'wink',     t:'{name}、ダイヤは大事に使いましょうね♪', bond:[1,2] },
      { e:'excited',  t:'{name}、気になるものありました？', bond:[1,2] },
      { e:'happy',    t:'{name}、なに買うか決めた( \'ω\')?', bond:[3,4] },
      { e:'wink',     t:'{name}って、こういうとき悩むタイプでしょw', bond:[3,4] },
      { e:'excited',  t:'{name}、あたしのアイコンも売ってるよ！ …どう( \'ω\')?', bond:4 },
      { e:'happy',    t:'{name}、あたしのアイコン使ってくれてたら嬉しい(´ー`*)ｳﾝｳﾝ', bond:5, w:0.6 },
      { e:'excited',  t:'{name}、たまには自分にご褒美あげよw', bond:5 },
      { e:'normal',   t:'円盤石を買うと新しいモンスターが解放されるよ。' },
      { e:'happy',    t:'アシストカードはバトル中に使える強い味方だよ♪' },
      { e:'normal',   t:'アイテムの効果は「詳細」から見られるよ。' },
      { e:'wink',     t:'ptはブリーダーレベルが上がるともらえるよ！' },
      { e:'normal',   t:'買っただけだと使えないよ。M/B管理から編成に入れてね。' },
      { e:'surprise', t:'この値段…ちょっとだけ強気だと思わないw', w:0.3 },
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
      { e:'excited',  t:'{name}、報酬たまってるよ！ もらっちゃお(●゚ｪ゚))ｺｸｺｸ', bond:[3,4] },
      { e:'wink',     t:'{name}、受け取り忘れないでよ〜( \'ω\')?', bond:4 },
      { e:'happy',    t:'{name}、こういうのマメだよね(´ー`*)ｳﾝｳﾝ 尊敬する！', bond:5 },
    ],
    missionsNormal: [
      { e:'normal',   t:'{name}、デイリーは毎日リセットされますよ。', bond:[1,2] },
      { e:'happy',    t:'{name}、ちょっとずつでいいと思いますよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、今日のぶんもう少しで終わりそう( \'ω\')?', bond:[3,4] },
      { e:'wink',     t:'{name}、全部やらなくても大丈夫だからね(●゚ｪ゚))ｺｸｺｸ', bond:4 },
      { e:'happy',    t:'{name}のペースでいいよ。あたしが急かすことぢゃないし！', bond:5 },
    ],
    giftClaimable: [
      { e:'excited',  t:'{name}、ギフトが届いてますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、なにが入ってるか楽しみですね！', bond:[1,2] },
      { e:'excited',  t:'{name}、ギフト来てる！ 開けてみよ(●゚ｪ゚))ｺｸｺｸ', bond:[3,4] },
      { e:'wink',     t:'{name}、期限あるからね。忘れないうちに！', bond:4 },
      { e:'happy',    t:'{name}、いいもの入ってるといいね(´ー`*)ｳﾝｳﾝ', bond:5 },
    ],
    giftEmpty: [
      { e:'normal',   t:'{name}、いまは届いていないみたいです。', bond:[1,2] },
      { e:'happy',    t:'{name}、また届いたらお知らせしますね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、いまは空っぽだね。またあとで覗こ( ˙-˙ )', bond:[3,4] },
      { e:'wink',     t:'{name}、ここが空だとちょっと寂しいよね(´;ω;`)', bond:4 },
      { e:'happy',    t:'{name}、そのうち何か来るよ。気長にいこ(●゚ｪ゚))ｺｸｺｸ', bond:5 },
    ],
    profile: [
      { e:'happy',    t:'{name}、名前もアイコンもいつでも変えられますよ♪', bond:[1,2] },
      { e:'normal',   t:'ここで決めた名前がランキングに出ます。', bond:[1,2] },
      { e:'excited',  t:'{name}、そのアイコン似合ってますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、そのアイコン気に入ってる( \'ω\')?', bond:[3,4] },
      { e:'wink',     t:'{name}って名前、呼びやすくて好きだな(´ー`*)ｳﾝｳﾝ', bond:[3,4] },
      { e:'excited',  t:'{name}、たまには気分でアイコン変えてみたら( \'ω\')?', bond:4 },
      { e:'happy',    t:'{name}って呼ぶの、けっこう気に入ってるんだよね(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'wink',     t:'{name}、あたしのアイコンにしてくれてもいいんだよw', bond:5, w:0.6 },
      { e:'normal',   t:'ブリーダーレベルはここで確認できるよ。' },
      { e:'happy',    t:'持ってるアイテムもここから見られるよ♪' },
    ],
    settings: [
      { e:'happy',    t:'{name}、音量はここで調整できますよ♪', bond:[1,2] },
      { e:'normal',   t:'データ引き継ぎは、たまに控えておくと安心です。', bond:[1,2] },
      { e:'wink',     t:'{name}、BGMアレンジも試してみてくださいね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、音まわりは好みでいじっていいと思うよ。', bond:[3,4] },
      { e:'happy',    t:'{name}、バックアップだけは取っておこ( \'ω\')? 心配だから。', bond:[3,4] },
      { e:'troubled', t:'{name}、データ消えたらあたし泣いちゃう(´;ω;`)', bond:4 },
      { e:'happy',    t:'{name}、引き継ぎコード控えた( \'ω\')? しつこくてごめんw', bond:5 },
      { e:'wink',     t:'{name}が快適に遊べるのがいちばんだからね(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'normal',   t:'ヘルプもここから開けるよ。' },
      { e:'happy',    t:'BGMアレンジは、バトルモード別に曲を選べるよ♪' },
    ],
    helpTop: [
      { e:'happy',    t:'{name}、気になるところから読んでくださいね♪', bond:[1,2] },
      { e:'normal',   t:'分からないことは、たいていここに書いてありますよ。', bond:[1,2] },
      { e:'wink',     t:'{name}、読むのが面倒なら聞いてくれてもいいですよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、どこが気になる( \'ω\')?', bond:[3,4] },
      { e:'happy',    t:'{name}、距離のところは一回読んどくと強いよ|･ω･`)ﾌﾑﾌﾑ', bond:[3,4] },
      { e:'excited',  t:'{name}、ここ書いたのあたしなんだよ( \'ω\')? …ってことにしてw', bond:4, w:0.6 },
      { e:'happy',    t:'{name}、分かんないとこあったら遠慮なく言ってね(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'wink',     t:'{name}のためなら、何回でも説明するよ(●゚ｪ゚))ｺｸｺｸ', bond:5, w:0.6 },
      { e:'normal',   t:'距離と間合い適性は、いちばん大事なところだよ。' },
      { e:'happy',    t:'カードの半減ルール、意外と見落としがちだよ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'normal',   t:'難易度の倍率は実際の値をそのまま出してるよ。' },
      { e:'wink',     t:'アイテムやログインボーナスの一覧も載ってるよ！' },
      { e:'normal',   t:'項目の下に「次：」って出てるところから読み進められるよ。' },
      { e:'excited',  t:'攻略のヒントのページ、けっこう自信あるんだ(●゚ｪ゚))ｺｸｺｸ' },
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
      { e:'excited',  t:'{name}、今日の主役は誰にする( \'ω\')?', bond:5 },
      { e:'normal',   t:'勇者モンだけが固有技と勇者特性を使えるよ。' },
      { e:'wink',     t:'編成タブとベースモンタブ、どっちからでも選べるよ♪' },
    ],
    monsterDex: [
      { e:'excited',  t:'{name}、図鑑ができたよ！ いっしょに見よ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、血統がわかると合体の見通しも立つよ。', bond:[3,4] },
      { e:'wink',     t:'{name}のいちばん好きな子、あとで教えてね♪', bond:5 },
      { e:'normal',   t:'「？？？」の血統は、まだ誰も正体を知らないんだって( ˙-˙ )' },
    ],
    mbManagement: [
      { e:'happy',    t:'{name}、ここから編成もマスモンも見られますよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、整理しておくとバトル前が楽だよ。', bond:[3,4] },
      { e:'wink',     t:'{name}、あたしも一緒に見てあげる(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'normal',   t:'ベースモンは種の基本データ、マスモンは育てた個体だよ。' },
    ],
    masuEnhance: [
      { e:'happy',    t:'{name}、強化ポイントの振り先を選びましょ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、迷ったら得意な距離を伸ばすのが無難だよ。', bond:[3,4] },
      { e:'excited',  t:'{name}、その振り方、攻めてていいぢゃんw', bond:5 },
      { e:'normal',   t:'振り直したいときはリセットの書が使えるよ。' },
      { e:'wink',     t:'まとめて振ると一気に強くなるよ♪' },
    ],
    fusion: [
      { e:'happy',    t:'{name}、主に残したい子を選んでくださいね♪', bond:[1,2] },
      { e:'normal',   t:'{name}、副の子の絆は経験値になって引き継がれるよ。', bond:[3,4] },
      { e:'troubled', t:'{name}、決める前にもう一回だけ確認しよ( \'ω\')?', bond:5 },
      { e:'normal',   t:'合体後のレベル変化は、確認画面で見られるよ。' },
      { e:'wink',     t:'固有技を引き継げるのは、副が絆Lv.30以上のときだよ！' },
    ],
    rebirth: [
      { e:'excited',  t:'{name}、限界突破すると星が増えますよ♪', bond:[1,2] },
      { e:'happy',    t:'{name}、思いきっていこ！ レベルは戻らないから。', bond:[3,4] },
      { e:'excited',  t:'{name}、この瞬間いつ見てもいいよね〜(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'normal',   t:'レベルはそのまま、上限だけ上がるよ。' },
    ],
    transcendence: [
      { e:'excited',  t:'{name}、Lv400の子がいるなんて…！ ここが最後の扉だよ。', bond:[1,2] },
      { e:'happy',    t:'{name}、超越したら基礎から強くできるよ♪', bond:[3,4] },
      { e:'wink',     t:'{name}、あたしも見届けるからね！', bond:5 },
      { e:'normal',   t:'Lv401からは超越Pだよ。通常の強化Pとは別枠なんだ。' },
      { e:'troubled', t:'コストは虹のプシュケー5000とダイヤ100万(; \'ω\')ｺﾞｸﾘ' },
    ],
    reincarnate: [
      { e:'excited',  t:'{name}、ここまで育てたんですね…！', bond:[1,2] },
      { e:'happy',    t:'{name}、振り直しのチャンスだよ♪', bond:[3,4] },
      { e:'wink',     t:'{name}となら、もう一度てっぺんまでいけるよね(●゚ｪ゚))ｺｸｺｸ', bond:5 },
      { e:'normal',   t:'レベルは99ぶん戻るけど、上限はそのままだよ。' },
    ],
    donation: [
      { e:'troubled', t:'{name}、寄付は取り消せないので慎重に…！', bond:[1,2] },
      { e:'troubled', t:'{name}、ほんとにこの子でいい( \'ω\')?', bond:[3,4] },
      { e:'crying',   t:'あたしはちょっと寂しいけど(´;ω;`) {name}が決めていいよ。', bond:5 },
    ],
    pasture: [
      { e:'happy',    t:'{name}、村に出す子を選べますよ♪', bond:[1,2] },
      { e:'excited',  t:'{name}、みんな楽しそうに歩いてるよ〜♪', bond:[3,4] },
      { e:'happy',    t:'{name}、この景色見てると和むよね(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'normal',   t:'放牧しても強さには影響しないよ。見た目だけ！' },
    ],
    inventory: [
      { e:'happy',    t:'{name}、持ってるアイテムはここですよ♪', bond:[1,2] },
      { e:'normal',   t:'{name}、使いどきを逃さないようにね。', bond:[3,4] },
      { e:'wink',     t:'{name}、ためこむタイプでしょw 分かるけど！', bond:5 },
      { e:'normal',   t:'絆経験値のアイテムは、まとめて使えるよ。' },
    ],
    resultWin: [
      { e:'excited',  t:'{name}、おめでとうございます♪ すごいです！', bond:[1,2] },
      { e:'happy',    t:'{name}、やったね！ ナイスバトル♪', bond:[3,4] },
      { e:'excited',  t:'{name}、さすが！ あたしの相棒は違うね〜(´ー`*)ｳﾝｳﾝ', bond:5 },
      { e:'happy',    t:'活躍した子はマスモンに登録できるよ！' },
      { e:'wink',     t:'この勢いでもう1回いっちゃう( \'ω\')?' },
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
      { e:'excited',  t:'{name}、コンプリート目指しちゃう( \'ω\')?', bond:5 },
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
// ・顔文字をよく使う(2026-09-17に本人の会話ログへ寄せた)。
//   よく出るのは (´ω`) / (・∀・) / ( ˘ω˘)9グッ! / (´ー`*)ウンウン /
//   ٩(´ᵕ`)۶ワクワク / (>人<;) / (￣▽￣;) / (゜∀゜) / (o^o^)o
//   毎文に付けると吹き出しが読みにくいので、5〜6本に1本くらいの割合で置く。
//   説明の本文へは付けず、喜ぶ・驚く・励ますところへ付けるのがコツ
// ・「♪」はよく2つ重ねて「♪♪」にする。「笑」もたまに使う
// ・語尾や相槌はやわらかく崩す(「〜しよ」「〜しとこ」「そなのか」「あれま」)。
//   「〜しましょう」「〜ですね」で固めない
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
      { e:'normal',  t:'マスモンを早く増やしたいなら、いい方法あるよ。' },
      { e:'happy',   t:'クイックのBeginnerでWAVE2まで進んで、\n「あきらめる」を押す。' },
      { e:'wink',    t:'これが今のところいちばん早いやつ ( ˘ω˘)9グッ!' },
      { e:'normal',  t:'WAVE2まで進むのが大事。そこから登録できまつ。' },
      { e:'happy',   t:'時間がないときにどうぞ♪♪' },
    ],
    // ---- モンビー(モンヒロビート) ----
    rhythmHome: [
      { e:'normal',  t:'曲えらんで、難易度えらんで、決定。それだけ。' },
      { e:'happy',   t:'{name}、どの曲にする？ ランダムも楽しいよ♪♪' },
      { e:'normal',  t:'えらんでる曲は流れてまつ。聴いてから決めていいよ。' },
      { e:'wink',    t:'難しかったら、オプションでノーツ速度を下げてみて。' },
      { e:'normal',  t:'EXPERTとMASTERは、1つ下をクリアすると開きまつ。' },
      { e:'happy',   t:'横画面にすると一覧と曲を並べて見られるよ (・∀・)ノ' },
    ],
    rhythmWeeklyEvent: [
      { e:'normal',  t:'期間限定イベント中。この期間の点だけで競いまつ。' },
      { e:'happy',   t:'部門ごとに報酬あるよ。部門を開くと出まつ♪♪' },
      { e:'normal',  t:'報酬はイベントが終わったあと。あわてなくて大丈夫。' },
      { e:'normal',  t:'いつもの週間ランキングも別タブで動いてまつよ。' },
      { e:'happy',   t:'{name}、終わるまでに1曲どう？ 総合にも載るよ♪♪' },
    ],
    rhythmMonsters: [
      { e:'normal',  t:'ここで決めた子が、曲の途中で金色のノーツになるの。' },
      { e:'normal',  t:'上から順に登場でつ。1体につき1回、多くて4回まで。' },
      { e:'happy',   t:'GREATより良い判定で取れたら能力が出るよ ( ˘ω˘)9' },
      { e:'normal',  t:'能力は主血統で決まりまつ。育てても染めても同じ。' },
      { e:'wink',    t:'ライフが厳しいときは、元気の子か無敵の子をどうぞ。' },
      { e:'happy',   t:'{name}のお気に入りでも、もちろんいいよ♪♪' },
    ],
    rhythmHelp: [
      { e:'happy',   t:'遊びかたはここに全部。困ったらいつでもどうぞ♪♪' },
      { e:'normal',  t:'ノーツの種類も判定もスコアの決まり方も、ぜんぶここ。' },
      { e:'wink',    t:'体で覚える派なら、上の「もう一度チュートリアル」へ。' },
      { e:'excited', t:'{name}が知りたいこと、たぶんこの中にあるよ (・∀・)' },
      { e:'normal',  t:'書いてあることは、設定のヘルプと同じでつ。' },
      { e:'happy',   t:'読んで分からなかったら、1回遊ぶほうが早いかも 笑' },
    ],
    // ---- 種族チャレンジ ----
    speciesChallenge: [
      { e:'normal',   t:'ひとつの種族だけで10WAVE。しばりプレイでつね。' },
      { e:'happy',    t:'育ててる種族から挑むのがいちばん確実 ( ˘ω˘)9グッ!' },
      { e:'normal',   t:'記録は種族と難易度の組み合わせごとに分かれてまつ。' },
      { e:'wink',     t:'はじめてクリアすると、その種族の超越の実がもらえるよ♪' },
      { e:'happy',    t:'いつもの記録は変わらないから、気軽に試せまつ。' },
      { e:'normal',   t:'難易度は種族ごとに1つずつ。焦らず進も♪' },
    ],
    // ---- 極限チャレンジ ----
    extremeChallenge: [
      { e:'surprise', t:'ここから先は極限チャレンジ。かなり手強いよ (￣▽￣;)' },
      { e:'normal',   t:'育てた子の本気を試すなら、ここが舞台ですね。' },
      { e:'troubled', t:'正直、生半可な育成だと厳しいと思いまつ…。' },
      { e:'happy',    t:'専用ランキングもあるから、記録に残せるよ♪♪' },
      { e:'normal',   t:'無理そうなら育ててから出直すのも、立派な作戦。' },
      { e:'wink',     t:'準備できてるなら、思いきって挑んじゃお。' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'EXTREMEはアシストカードの効果が半分。注意でつ。' },
      { e:'surprise', t:'敵の強さは×13。いつもの感覚だと危ないよ (￣▽￣;)' },
      { e:'normal',   t:'虹のプシュケー報酬と全WAVE詳細、先に見ると安心。' },
      { e:'happy',    t:'準備が整ってるなら、いってらっしゃい♪♪' },
      { e:'normal',   t:'厳しそうなら、もうひと育成してからでも遅くないよ。' },
      { e:'wink',     t:'私も見てまつから、落ち着いていこ (´ー`*)ウンウン' },
    ],
    nightmareDifficulty: [
      { e:'surprise', t:'NIGHTMAREはEXTREMEの次。もっと手強い悪夢でつ。' },
      { e:'troubled', t:'有利な補正が弱くなって、不利な補正は重くなるの…。' },
      { e:'normal',   t:'距離適性が、いつも以上に大事になりまつ。' },
      { e:'normal',   t:'全WAVE詳細で敵の順番を見ると、作戦を立てやすいよ。' },
      { e:'wink',     t:'補正のかかり方が変わるから、編成はじっくりね。' },
    ],
    chaosDifficulty: [
      { e:'surprise', t:'CHAOSは敵の強さが×20。本当に極限…！ (>人<;)' },
      { e:'normal',   t:'NIGHTMAREを1回クリアすると挑めるようになりまつ。' },
      { e:'excited',  t:'スコア×20、経験値×35、ダイヤ×15。報酬も破格♪♪' },
      { e:'troubled', t:'与ダメージと加入ボーナスは半分、ガッツは1.5倍でつ。' },
      { e:'happy',    t:'クリアで虹のプシュケー50個。応援してるよ♪' },
    ],
    ultimateDifficulty: [
      { e:'surprise', t:'ULTIMATEは敵強度×35。CHAOSを越えた人だけの舞台。' },
      { e:'normal',   t:'累計ターンが増えるほど、次の敵が強くなりまつ。' },
      { e:'excited',  t:'スコア×20、経験値×40、ダイヤ×20、プシュケー60個♪♪' },
      { e:'troubled', t:'トレーニングもターン数で下がるの。速い勝利が大事。' },
      { e:'wink',     t:'35ターンごとのDISTANCE BREAKにも備えとこ。' },
    ],
    infinityDifficulty: [
      { e:'normal',   t:'最後に控えてるのがINFINITY。極限の総決算でつ。' },
      { e:'surprise', t:'加入ボーナスは最低10%まで下がるの。早めの合流が肝心。' },
      { e:'happy',    t:'アシストカードは50%、ガッツは150%。編成から見直そ。' },
      { e:'troubled', t:'BREAKは25ターンごと…3距離まで弱っていきまつ (>人<;)' },
      { e:'normal',   t:'詳しい数字はルール詳細に全部載ってまつよ。' },
    ],
    // GODは INFINITY クリア後に解放される最上位。みゅあ側にだけセリフがあり、
    // ききを選んでいるとみゅあのセリフが出てしまっていたため足した(2026-09-03)。
    godDifficulty: [
      { e:'surprise', t:'GODは敵強度×100。INFINITYのさらに上…！' },
      { e:'normal',   t:'2WAVEごとに神威Lvが1から5まで上がっていきまつ。' },
      { e:'troubled', t:'与ダメは累計ターンで下がり、BREAKは20ターンごと。' },
      { e:'surprise', t:'WAVE9からは神域封鎖…安全距離も候補になるの (>人<;)' },
      { e:'wink',     t:'報酬は虹のプシュケー100個。ルール詳細を読んでから♪' },
    ],
    // RAGNAROKはGODクリア後に解放される最終難易度。GODと同じ理由でききの側にも用意する
    ragnarokDifficulty: [
      { e:'surprise', t:'RAGNAROKは敵強度×200。GODのさらに上…！ (￣▽￣;)' },
      { e:'normal',   t:'2WAVEごとに黄昏Lvが上がって、最後は敵が2倍になるの。' },
      { e:'troubled', t:'BREAKは15ターンごと。安全な距離はありませんでつ。' },
      { e:'surprise', t:'WAVE5とWAVE10のボスは、倒しても起き上がりまつ…！' },
      { e:'wink',     t:'報酬は虹のプシュケー130個。短期決着を狙お♪' },
    ],
    // ---- はじめて ----
    onboarding: [
      { e:'happy',   t:'はじめまして。私はきき、このゲームの助手でつ (´ω`)' },
      { e:'normal',  t:'まずはお名前とアイコンを決めよ。あとから変えられるよ。' },
      { e:'wink',    t:'お名前はランキングにも出るから、気に入ったものを♪' },
      { e:'happy',   t:'困ったら、いつでも私に声をかけてね。' },
      { e:'normal',  t:'準備ができたら、いよいよ冒険のはじまり♪♪' },
    ],
    // ---- ホーム ----
    home: [
      // どのLvでも出る、村のようすや案内
      { e:'happy',    t:'今日も一緒に育てていこ♪♪' },
      { e:'normal',   t:'マスモンの絆レベル、ときどき見てあげたいですね。' },
      { e:'wink',     t:'ミッションとギフト、覗くと何かあるかも (・∀・)ノ' },
      { e:'normal',   t:'放牧に出した子が村を歩いてまつよ。見えまつか？' },
      { e:'happy',    t:'今日はどこから回る？ 私は神殿がおすすめ♪' },
      { e:'normal',   t:'編成を見直すだけでも、けっこう変わりまつよ。' },
      { e:'happy',    t:'更新履歴、たまに読むと発見があるよ♪♪' },
      { e:'normal',   t:'今日のログインボーナス、もう受け取りまつたか？' },
      { e:'troubled', t:'ダイヤの使いどころ、悩むよね…私も悩みまつ。', w:0.5 },
      { e:'happy',    t:'少し休むのも大事。ゲームは逃げませんから。', w:0.5 },
      { e:'surprise', t:'あ、いま向こうでマスモンが転んだような…気のせい？', w:0.25 },
      { e:'wink',     t:'内緒だけど、私は夕方の村がいちばん好き♪♪', w:0.25 },
      // Lv1〜3: ていねいで、少し距離がある
      { e:'happy',    t:'{name}、今日もよろしくお願いしまつ。', bond:[1,3] },
      { e:'normal',   t:'{name}、まずは編成の確認からいきまつか？', bond:[1,3] },
      { e:'normal',   t:'{name}、無理のない範囲で楽しんでいきましょ。', bond:[1,3] },
      { e:'happy',    t:'{name}のペースで大丈夫ですよ (´ω`)', bond:[1,3] },
      { e:'wink',     t:'{name}、育成がいい感じに進んでまつね。', bond:[1,3] },
      // Lv4〜5: 「ちー」付けになって、ぐっと打ち解ける
      { e:'happy',    t:'{name}、おかえり♪♪ 待ってたよ。', bond:[4,5] },
      { e:'excited',  t:'{name}、その育成いい感じ！ センスあるね (・∀・)', bond:[4,5] },
      { e:'normal',   t:'なんだか今日は調子よさそう。気のせい？ 笑', bond:[4,5] },
      { e:'happy',    t:'{name}、今日は何する？ お付き合いしまつよ♪', bond:[4,5] },
      // Lv6以降: 呼び方を自分で決められる。距離はさらに近づく
      { e:'happy',    t:'{name}、呼び方を自分で決められるようになるよ♪♪', bond:6 },
      { e:'wink',     t:'{name}とは、もう気を使わずに話せまつね。', bond:7 },
      { e:'excited',  t:'{name}となら、どんな難易度でも越えられそう♪♪', bond:9 },
      { e:'happy',    t:'{name}が来ると、なんだか安心する (´ー`*)ウンウン', bond:11 },
      { e:'normal',   t:'{name}、私はずっとここにいまつからね。', bond:13, w:0.5 },
      { e:'excited',  t:'{name}とは、もう阿吽の呼吸だね (・∀・)ノ', bond:15 },
      { e:'happy',    t:'{name}とここまで来られて、私は幸せでつ♪♪', bond:18, w:0.5 },
      { e:'excited',  t:'{name}とは永遠の相棒。これからもよろしくね♪♪', bond:20 },
    ],
    // ---- バトルメニュー ----
    battleChallenge: [
      { e:'normal',   t:'スコアを競うならチャレンジ。上のタブも見てみて♪' },
      { e:'wink',     t:'強化の選び方で、かなり変わりまつよ。' },
      { e:'normal',   t:'終盤まで見据えて強化するのがコツですね。' },
      { e:'excited',  t:'自己ベスト、更新できそうな気がする ٩(´ᵕ`)۶' },
      { e:'normal',   t:'難易度カードから、虹のプシュケー報酬も見られまつ。' },
      { e:'happy',    t:'迷ったら、弱いところを埋めるのがおすすめ♪' },
    ],
    battleQuick: [
      { e:'wink',     t:'テンポ重視ならクイックでつね。' },
      { e:'happy',    t:'サクサク育成していこ♪♪' },
      { e:'normal',   t:'自動成長をうまく活かすのがコツでつ。' },
      { e:'normal',   t:'強化は選べないから、編成で勝負ですね。' },
      { e:'excited',  t:'経験値もダイヤも1.5倍。おいしい (・∀・)ノ' },
      { e:'happy',    t:'難易度カードから、報酬も確認できまつよ。' },
    ],
    battlePro: [
      { e:'excited',  t:'ここはベースモンだけの世界。腕の見せどころ♪♪' },
      { e:'wink',     t:'絆経験値3倍。新しい子を育てるなら、ここですね。' },
      { e:'happy',    t:'ブリーダー経験値も1.5倍だよ ( ˘ω˘)9グッ!' },
      { e:'normal',   t:'育てたマスモンは連れていけません。素の力で勝負。' },
      { e:'normal',   t:'供モンは5体選んで、その中から3体が来まつ。' },
      { e:'happy',    t:'上のタブから、プロだけの記録も見られるよ♪' },
      { e:'troubled', t:'きびしいモードだけど、そのぶん伸びまつよ。' },
    ],
    ranking: [
      { e:'excited',  t:'上位、目指してみる？ ٩(´ᵕ`)۶ワクワク' },
      { e:'happy',    t:'みなさん強いでつね…！' },
      { e:'wink',     t:'編成を見るだけでも、勉強になりまつよ。' },
      { e:'normal',   t:'次はこの方を超えるのが目標ですね。' },
      { e:'happy',    t:'あと少しで順位が上がりそう♪♪' },
      { e:'normal',   t:'難易度を切り替えると、狙い目が見えてきまつ。' },
    ],
    rankingParty: [
      { e:'happy',    t:'この方が使ってた編成でつ。染めた色もそのまま♪' },
      { e:'excited',  t:'どの距離に置いてたかも分かるの。真似してみまつか？' },
      { e:'normal',   t:'王冠が付いてるのが勇者モン。主役になった子ですね。' },
      { e:'wink',     t:'絆レベルが高い子ほど、大事に育てられた子♪' },
      { e:'normal',   t:'染めた色が残るのは、この画面ができたあとの記録から。' },
      { e:'surprise', t:'強い方の編成、けっこう参考になるよね (・∀・)' },
    ],
    // ---- ランの準備・進行 ----
    pickHero: [
      { e:'normal',   t:'最初の1体はとても大事。勇者特性を見て決めよ。' },
      { e:'happy',    t:'今日はどの子でいく？ 私も楽しみ ٩(´ᵕ`)۶ワクワク' },
      { e:'wink',     t:'固有技も見ておくと、戦い方がガラッと変わりまつよ。' },
      { e:'excited',  t:'育ってる子で挑むと、けっこう気持ちいい♪♪' },
      { e:'normal',   t:'迷ったら詳細を開いてみて。特性が決め手ですね。' },
    ],
    pickSlot: [
      { e:'wink',     t:'敵と同じ距離から殴ると強いよ ( ˘ω˘)9グッ!' },
      { e:'normal',   t:'得意な距離と、いまの補正を見て置きましょ。' },
      { e:'happy',    t:'ここ、地味に勝敗を分けるところでつ。' },
      { e:'excited',  t:'補正が高い距離に寄せると、気持ちいいよ♪♪' },
      { e:'normal',   t:'置いた距離以外にも補正はかかるから、安心して選べまつ。' },
    ],
    pickAlly: [
      { e:'happy',    t:'仲間が増えるよ♪♪ どの子にする？' },
      { e:'wink',     t:'ステータスだけでなく、距離の補正も見てみて。' },
      { e:'excited',  t:'ここで一気に強くなるチャンス (・∀・)ノ' },
      { e:'normal',   t:'足りない距離を埋めると、安定しまつよ。' },
      { e:'happy',    t:'心強い仲間が来たら、あと半分いけそう♪' },
    ],
    pickProAllies: [
      { e:'excited',  t:'ここで選んだ子の中からしか来ません。よく考えて♪' },
      { e:'wink',     t:'合流で出るのは、この中からランダムで3体だけ。' },
      { e:'normal',   t:'誰が来てもいいように組むのが、コツですね。' },
      { e:'happy',    t:'間合いをばらけさせておくと安心 (´ー`*)ウンウン' },
      { e:'troubled', t:'全員同じ距離だと、届かない相手が出ちゃうかも…。' },
      { e:'normal',   t:'ステータスの合流ボーナスも、見ておきましょ。' },
    ],
    pickTeaching: [
      { e:'wink',     t:'同じ教えを重ねると、Lv2に進化しまつよ。' },
      { e:'normal',   t:'今の強さを取るか、完成形を狙うか…作戦しだいですね。' },
      { e:'happy',    t:'私は、とりあえず重ねる派 (・∀・)' },
      { e:'excited',  t:'進化すると、けっこう跳ね上がるよ♪♪' },
      { e:'normal',   t:'アシストカードは効果が半減しないのが強みでつ。' },
    ],
    rewardPick: [
      { e:'happy',    t:'WAVEクリアお疲れさま♪♪ トレーニングを2つえらぼ。' },
      { e:'wink',     t:'弱点を埋めるか、強みを伸ばすか…悩むよね。' },
      { e:'excited',  t:'いい感じ♪♪ この調子でいこ。' },
      { e:'normal',   t:'同じトレーニングを2回えらぶと、その分ぐっと伸びまつ。' },
      { e:'happy',    t:'ここの積み重ねで、終盤がラクになるよ (・∀・)' },
    ],
    battleHelp: [
      { e:'wink',     t:'迷ったら、まず解析。敵の必殺技が読めまつよ。' },
      { e:'normal',   t:'いちばん効かせたいカードは、最初に置くのがコツ。' },
      { e:'happy',    t:'落ち着いていこ。ガードも立派な一手でつ。' },
      { e:'excited',  t:'あと少しで勝てそう…！ 踏ん張りどころ (>人<;)' },
      { e:'normal',   t:'ガッツが足りないときは、1枚だけでも大丈夫。' },
    ],
    // ---- リザルト ----
    resultWin: [
      { e:'excited',  t:'優勝おめでとう♪♪ ٩(´ᵕ`)۶' },
      { e:'happy',    t:'お見事でつ。育った勇者モンは登録しておこ。' },
      { e:'excited',  t:'完璧♪♪ このまま上の難易度も狙えまつ。' },
      { e:'happy',    t:'お疲れさま。報酬も受け取っておきましょ。' },
      { e:'wink',     t:'今の編成、けっこう強かったね。覚えておこ♪' },
    ],
    resultLose: [
      { e:'crying',   t:'今回はここまで…。報酬はちゃんと入りまつよ。' },
      { e:'troubled', t:'惜しかったね…次はいけそうな気がしまつ。' },
      { e:'normal',   t:'負けても経験値は入るよ。育て直して、また挑も。' },
      { e:'crying',   t:'悔しい…でも、ここまで来たのはすごいよ (>人<;)' },
      { e:'happy',    t:'切り替えていこ♪ 編成を変えると景色が変わるよ。' },
    ],
    resultRetire: [
      { e:'troubled', t:'お疲れさま。クリア済みWAVE分の報酬は入りまつ。' },
      { e:'normal',   t:'休憩も大事だね。結果だけ確認しておきましょ。' },
      { e:'happy',    t:'また遊ぼ♪♪ いつでも待ってまつよ。' },
      { e:'troubled', t:'今回はここまでかー。もらえるものは受け取っとこ。' },
      { e:'wink',     t:'仕切り直しもアリ。次にいこ♪' },
    ],
    // ---- スキップチケット ----
    skipPick: [
      { e:'happy',    t:'スキップで一気に育成♪♪ 使う枚数も選べまつ。' },
      { e:'normal',   t:'時間がないときの味方でつね。' },
      { e:'wink',     t:'勇者モンと供モンを決めたら、あとはおまかせ。' },
      { e:'excited',  t:'まとめて使うと、もらえる量もぐっと増えるよ♪♪' },
      { e:'normal',   t:'ランキングには入らないから、そこだけ覚えておこ。' },
    ],
    skipResult: [
      { e:'happy',    t:'受け取り完了♪♪ 一気に育ったね。' },
      { e:'surprise', t:'おおっ、ごっそり入りまつね…！ (゜∀゜)･∵ﾌﾞﾊｯ' },
      { e:'normal',   t:'スキップ分はランキングとクリア回数には入りません。' },
      { e:'excited',  t:'育成が進むね。次のバトルが楽しみ♪♪' },
      { e:'wink',     t:'浮いた時間で、別のことをするのもいいね。' },
    ],
    // ---- モンスター図鑑 ----
    monsterDex: [
      { e:'normal',   t:'モンスター図鑑。血統と区分がひと目でわかりまつ。' },
      { e:'happy',    t:'主血統でしぼりこむと、同じ系統の子が並ぶよ♪♪' },
      { e:'wink',     t:'未解放の子はシルエット。マーケットの円盤石で会えまつ。' },
      { e:'excited',  t:'技のタブでは、進化していく技名まで確認できるよ♪' },
      { e:'normal',   t:'「能力」に出るのは種そのものの数値。育てた子の値ではないよ。' },
    ],
    // ---- M/B管理 ----
    mbManagement: [
      { e:'normal',   t:'編成もベースモンもマスモンも、ここから見られまつ。' },
      { e:'wink',     t:'解放しただけでは出てこないから、編成に入れよ。' },
      { e:'happy',    t:'最後に「決定」を押すのだけ、お忘れなく♪' },
      { e:'normal',   t:'アシストカードの編成も、ここからでつ。' },
      { e:'excited',  t:'編成を整えると、戦いがぐっとラクになるよ♪♪' },
    ],
    roster: [
      { e:'normal',   t:'ここで使う子を選びまつ。' },
      { e:'wink',     t:'間合いをばらけさせておくと、どんな敵にも届くよ♪' },
      { e:'happy',    t:'お気に入りの子を入れると、気分が上がるよね。' },
      { e:'normal',   t:'「決定」を押すまで反映されないから、注意でつ。' },
      { e:'excited',  t:'編成を変えると、戦い方もガラッと変わる (・∀・)' },
      { e:'normal',   t:'アシストカードの編成も、同じように選べまつよ。' },
    ],
    monsterList: [
      { e:'normal',   t:'ベースモンは種類の基本、マスモンは育てた個体でつ。' },
      { e:'happy',    t:'見たい方を選んでみよ♪' },
      { e:'wink',     t:'気になる子は詳細を開いてみて。特性が面白いよ。' },
      { e:'normal',   t:'間合い適性も、ここから確認できまつ。' },
      { e:'excited',  t:'集めた子が並ぶと、なんだか嬉しくなるよね♪♪' },
    ],
    masuList: [
      { e:'normal',   t:'育てたマスモンの一覧。絞り込みも使えまつよ。' },
      { e:'happy',    t:'お気に入りの子、増えてきたね (´ー`*)ウンウン' },
      { e:'wink',     t:'総合力の順に並べると、育ち具合が分かりやすいでつ。' },
      { e:'normal',   t:'名前は変えられるよ。愛着がわくよね。' },
      { e:'excited',  t:'コンプリート、目指してみる？ ٩(´ᵕ`)۶' },
      { e:'normal',   t:'絞り込みと並べ替えで、探しやすくなりまつ。' },
    ],
    masuAutoEnhance: [
      { e:'normal',   t:'どこまで上げてよいか決めておけば、あとは自動で振るよ。' },
      { e:'wink',     t:'上から順番に、上限まで振っていきまつ。' },
      { e:'happy',    t:'{name}、転生前に「いまの配分を取り込む」が便利♪' },
      { e:'normal',   t:'この設定は転生しても消えないから、一度決めれば十分。' },
      { e:'excited',  t:'周回してるだけで元の形に戻るの、気持ちいいよね♪♪' },
      { e:'troubled', t:'振る先を決めてないと、ONでも何も起きないの…注意でつ。' },
    ],
    masuEnhance: [
      { e:'normal',   t:'ポイントは適性か能力値に使えまつ♪' },
      { e:'wink',     t:'得意な戦い方に合わせて伸ばそ。' },
      { e:'happy',    t:'まとめて強化もできるから、ラクだよ (・∀・)ノ' },
      { e:'excited',  t:'一気に振ると、強くなった感じがする♪♪' },
      { e:'normal',   t:'迷ったら、足りないところから埋めるのが無難でつ。' },
    ],
    // ---- 神殿 ----
    temple: [
      { e:'normal',   t:'神殿では合体・転生・寄付ができまつ。' },
      { e:'wink',     t:'育成の土台になる場所ですね。' },
      { e:'happy',    t:'どれも取り返しがつかないから、落ち着いて選ぼ。' },
      { e:'normal',   t:'限界突破と転生は、絆Lvぶんのダイヤがかかりまつ。' },
      { e:'excited',  t:'合体は、ここのいちばんの楽しみ ٩(´ᵕ`)۶ワクワク' },
      { e:'normal',   t:'再生は初回無料でつよ。試してみるのもいいね。' },
    ],
    fusion: [
      { e:'excited',  t:'合体♪♪ どの子とどの子を組み合わせる？' },
      { e:'normal',   t:'技を継承するかどうかで、かかるダイヤが変わりまつ。' },
      { e:'wink',     t:'合体後の経験値とレベルも、先に確認できるよ。' },
      { e:'troubled', t:'素材にした子は戻ってきません。よく確かめてから…。' },
      { e:'happy',    t:'思わぬ組み合わせが、当たりだったりするよ (・∀・)' },
    ],
    rebirth: [
      { e:'normal',   t:'限界突破でつ。絆Lvの上限を超えられまつよ。' },
      { e:'wink',     t:'かかるダイヤは絆Lvぶん。育った子ほど高くなるの。' },
      { e:'happy',    t:'お気に入りの子を、さらに先へ連れていけるね♪♪' },
      { e:'normal',   t:'継承する技も、ここで選べまつよ。' },
      { e:'excited',  t:'星が増えると、見た目にも育ちが分かる (・∀・)ノ' },
    ],
    transcendence: [
      { e:'normal',   t:'超越。Lv400の子だけが進める、限界の先の道でつ。' },
      { e:'surprise', t:'Lv上限が500に。必要な経験値もぐっと重くなりまつ。' },
      { e:'happy',    t:'Lv401からのレベルアップで、超越ptが1ずつ貯まるよ♪' },
      { e:'normal',   t:'超越ptは基礎値を上げまつ。リセットも転生もしても消えない。' },
      { e:'wink',     t:'虹のプシュケー100個で1pt。余りの使い道にもなるね。' },
    ],
    reincarnate: [
      { e:'normal',   t:'転生でつ。別の姿へ生まれ変わらせられまつ。' },
      { e:'troubled', t:'元の姿には戻せません。よく考えてから決めよ…。' },
      { e:'wink',     t:'継承する技を選べるから、強みは引き継げまつよ。' },
      { e:'happy',    t:'新しい姿になる瞬間、私はいつもドキドキする ٩(´ᵕ`)۶' },
      { e:'normal',   t:'かかるダイヤは、絆Lvぶんでつ。' },
    ],
    donation: [
      { e:'normal',   t:'寄付。累計絆経験値と同じ数のダイヤを受け取れまつ。' },
      { e:'troubled', t:'寄付した子は戻ってきません。本当にいいでつか？' },
      { e:'wink',     t:'まとめて選べまつが、編成が崩れないかだけ確認を。' },
      { e:'happy',    t:'虹のプシュケーも、もらえるよ♪♪' },
      { e:'normal',   t:'迷ってるなら、今日は見送るのも手でつ。' },
    ],
    pasture: [
      { e:'happy',    t:'お気に入りを最大5体まで、HOMEに出せるよ♪♪' },
      { e:'normal',   t:'強さには影響しないから、見た目で選んで大丈夫。' },
      { e:'excited',  t:'みんなが歩いてるところ、かわいいよね (o^o^)o' },
      { e:'wink',     t:'気分で入れ替えても大丈夫でつ。' },
      { e:'happy',    t:'村がにぎやかになると、私も嬉しい (´ー`*)ウンウン' },
    ],
    // ---- マーケット・アイテム ----
    market: [
      { e:'normal',   t:'マーケット。円盤石もカードもアイコンも並んでまつ。' },
      { e:'wink',     t:'ダイヤは大事に使お。……私が言えた口じゃないけど 笑' },
      { e:'happy',    t:'新しい商品、来てるかもしれないよ♪♪' },
      { e:'excited',  t:'アイコンを集めるのも、楽しいよね (・∀・)' },
      { e:'normal',   t:'虹のプシュケーはここでは買えません。クリア報酬でつ。' },
      { e:'happy',    t:'欲しいものがあるなら、少し貯めてからでも♪' },
    ],
    inventory: [
      { e:'normal',   t:'持ってるアイテムは、ここでつ。' },
      { e:'wink',     t:'効果と使う相手を見て、いいタイミングで使お♪' },
      { e:'happy',    t:'貯めすぎても意味がないから、使っちゃお 笑' },
      { e:'normal',   t:'絆ポイントリセットの書は、振り直したいときに便利。' },
      { e:'excited',  t:'虹のプシュケーは、限界突破に使えまつよ♪♪' },
    ],
    giftClaimable: [
      { e:'excited',  t:'ギフトが届いてるよ♪♪ 受け取っておこ。' },
      { e:'happy',    t:'まとめて受け取れまつよ。' },
      { e:'wink',     t:'受け取り忘れがないか、たまに覗いてみて (・∀・)ノ' },
      { e:'normal',   t:'ログインボーナスも、ここに届きまつ。' },
      { e:'happy',    t:'嬉しい知らせだね ٩(´ᵕ`)۶' },
    ],
    giftEmpty: [
      { e:'normal',   t:'いまは届いてるギフト、ないみたい。' },
      { e:'happy',    t:'また明日、覗いてみよ♪♪' },
      { e:'wink',     t:'ミッションを達成すると、ここに届きまつよ。' },
      { e:'troubled', t:'空っぽかー…。少し寂しいでつ (>人<;)' },
      { e:'normal',   t:'ログインを続けると、順番にもらえまつ。' },
    ],
    missionsClaimable: [
      { e:'excited',  t:'達成したミッションがあるよ♪♪ 受け取ろ。' },
      { e:'happy',    t:'まとめて受け取れまつよ。' },
      { e:'wink',     t:'受け取ると、仲良し度も少し増えるよ♪' },
      { e:'normal',   t:'デイリーは毎日、ウィークリーは毎週でつ。' },
      { e:'happy',    t:'こつこつ進んでるね (´ー`*)ウンウン' },
    ],
    missionsNormal: [
      { e:'normal',   t:'ミッションの進み具合は、ここで見られまつ。' },
      { e:'wink',     t:'ふつうに遊んでれば、自然と進むよ♪♪' },
      { e:'happy',    t:'デイリーは毎日リセットされまつ。' },
      { e:'normal',   t:'ウィークリーは、少し大きめの報酬でつ。' },
      { e:'excited',  t:'あと少しで達成できそうなものも、あるね (・∀・)' },
    ],
    // ---- プロフィール・設定・ヘルプ ----
    profile: [
      { e:'normal',   t:'名前・アイコン・これまでの記録は、ここでつ。' },
      { e:'happy',    t:'自分らしいプロフィールにしよ♪♪' },
      { e:'wink',     t:'アイコンはptで買えまつよ。集めるの、楽しいよね。' },
      { e:'excited',  t:'記録を見返すと、成長がわかって面白いよ (・∀・)' },
      { e:'normal',   t:'助手の変更も、この画面からできまつよ。' },
      { e:'happy',    t:'私との仲良し度も、ここで見られまつ♪♪' },
    ],
    settings: [
      { e:'normal',   t:'音量やBGMは、ここで調整できまつ。' },
      { e:'wink',     t:'BGMアレンジで、曲の雰囲気も変えられるよ♪♪' },
      { e:'happy',    t:'引き継ぎコード、ときどき控えておくと安心でつ。' },
      { e:'normal',   t:'好みの音量にしておくと、長く遊んでも疲れないよ♪' },
      { e:'excited',  t:'ヘルプも、ここから開けまつよ。' },
    ],
    helpTop: [
      { e:'normal',   t:'ヘルプでつ。気になるカテゴリから開いてみよ。' },
      { e:'wink',     t:'私の吹き出しをタップすると、詳しい説明が出るよ♪' },
      { e:'happy',    t:'分からないことがあったら、まずはここ (・∀・)ノ' },
      { e:'normal',   t:'カテゴリ → 項目 → 説明の、3段階になってまつ。' },
      { e:'excited',  t:'読んでると、新しい発見があるかも♪♪' },
      { e:'happy',    t:'右上のボタンで、私の吹き出しを閉じられまつ。' },
    ],
    // ---- ∞周回×モンヒロビートの案内 ----
    // みゅあ側(quickRhythmLinkGuide)と同じ場面。ここが無いと、ききを選んでいる人にも
    // みゅあのセリフが出てしまう(filterAssistantLines が、その助手のぶんが無ければ
    // みゅあのぶんへ落とすため)。2026-09-07に assistant-bond-check が拾った
    quickRhythmIntro: [
      { e:'normal',   t:'∞周回にするね。ここから「🎵 モンヒロビート」へ行けまつ。' },
      { e:'happy',    t:'{name}、周回は裏で続いてまつ。待つあいだに1曲♪♪' },
      { e:'normal',   t:'入口は「🎵 BGM」のすぐ下。省エネ「超」でも同じ場所でつ。' },
      { e:'wink',     t:'戻りたくなったら、左上の「⚔ 戻る」でいつでも戻れるよ。' },
      { e:'normal',   t:'裏で回せるのはクイックの∞周回だけ。ほかは記録が絡むの。' },
      { e:'normal',   t:'アプリを閉じると、そこで周回は止まりまつ。気をつけてね。' },
    ],
    quickRhythmBackground: [
      { e:'happy',    t:'ここにいるあいだも周回は進んでまつ。ちゃんと貯まってるよ♪' },
      { e:'normal',   t:'演奏中は止まりまつが、最後まで叩けば曲の長さぶん入りまつ。' },
      { e:'normal',   t:'上の帯をタップすると、何周めか・どれだけ貯まったか見られるよ。' },
      { e:'wink',     t:'{name}、遊んでるあいだに強くなるの、ちょっと嬉しいよね♪♪' },
      { e:'normal',   t:'戻るときは左上の「⚔ 戻る」か、帯の中のボタンからどうぞ。' },
    ],
    autoQuickRunSettings: [
      { e:'normal',   t:'ここを決めておくと、モンヒロビートから直接∞周回を始められるよ。' },
      { e:'happy',    t:'勇者モン・配置・難易度の3つ。決めてなければ直前の編成を使いまつ。' },
      { e:'normal',   t:'まだ解放してない難易度は、並んでまつが選べません。' },
      { e:'wink',     t:'3つそろうと下の一言が変わるよ。そこが目印 ( ˘ω˘)9' },
      { e:'happy',    t:'{name}が育ててる子を選ぶと、放っておくだけで絆も伸びまつ。' },
    ],
  },
  // 条件つきのセリフ(初回・記録更新・受け取り可能など)
  conditions: {
    // 期間限定イベントのあいだ(画面側から condition='limited' で切り替える)
    // ---- 種族チャレンジの選択画面(種族→勇者→供モン→確認) ----
    speciesChallenge: {
      species: [
        { e:'normal',   t:'まずは挑む種族を決めよ。育ててる子がいる種族が安心でつ。' },
        { e:'happy',    t:'種族ごとに難易度の解放は別々。得意な種族からでも大丈夫♪' },
        { e:'normal',   t:'モンスターが何種類いるかで、連れていける供モンの数も変わるの。' },
        { e:'wink',     t:'迷ったら、いちばん育ってる子のいる種族からどうぞ♪♪' },
        { e:'happy',    t:'あとから別の種族へ挑んでも、こちらの記録は消えませんよ。' },
      ],
      hero: [
        { e:'normal',   t:'勇者モンを決めよ。この子が最後まで戦い抜きまつ。' },
        { e:'happy',    t:'勇者モンにした子が、いちばん絆経験値をもらえるよ♪' },
        { e:'normal',   t:'いちばん育ってる子を勇者モンにするのが安全でつ。' },
        { e:'wink',     t:'勇者モンにした種は、供モンには選べなくなりまつ。' },
        { e:'normal',   t:'置く距離もあとで決めるから、間合い適性も見ておこ。' },
      ],
      allies: [
        { e:'normal',   t:'供モンは最大3体。WAVE2・4・6で1体ずつ合流しまつ。' },
        { e:'happy',    t:'同じモンスターは勇者モンと合わせて1体まで。別の種ならOK。' },
        { e:'wink',     t:'選べる子がいなければ、供モンなしのままでも大丈夫でつ。' },
        { e:'normal',   t:'誰をいつ合流させるかは、その場で選べまつよ。' },
        { e:'happy',    t:'間合いが散らばるように選ぶと、どの距離でも戦いやすいよ♪' },
      ],
      confirm: [
        { e:'normal',   t:'準備はいい？ この編成でいこ。' },
        { e:'happy',    t:'はじめてのクリアなら、超越の実がもらえるよ♪♪' },
        { e:'wink',     t:'クリアできたら、同じ種族の次の難易度が開きまつ。' },
        { e:'normal',   t:'途中で厳しくなっても、進んだぶんの報酬は受け取れまつ。' },
        { e:'happy',    t:'いってらっしゃい。私はここで見てるね (・∀・)ノ' },
      ],
    },
    home: {
      firstRun: [
        { e:'excited',  t:'いよいよ冒険のはじまり。まずはバトルへ行ってみよ♪♪' },
        { e:'happy',    t:'最初は難易度Beginnerで、じゅうぶんでつよ。' },
        { e:'wink',     t:'1回遊ぶとマスモンを登録できまつ。そこからが本番ですね。' },
        { e:'normal',   t:'迷ったらバトルへ。やってみるのが一番わかるよ。' },
        { e:'happy',    t:'私がついてまつから、安心して行ってらっしゃい♪♪' },
      ],
      bondUp: [
        { e:'happy',    t:'{name}、なんだか前より話しやすくなったね♪♪' },
        { e:'excited',  t:'{name}、これからもよろしくお願いしまつ！' },
        { e:'wink',     t:'{name}、たくさん遊んでくれてありがと ٩(´ᵕ`)۶' },
        { e:'happy',    t:'{name}…うん、この呼び方がしっくりくる♪', bond:4 },
        { e:'normal',   t:'{name}、私はちゃんと見てまつからね。' },
      ],
    },
    resultWin: {
      newRecord: [
        { e:'excited',  t:'自己ベスト更新、おめでとう♪♪ ٩(´ᵕ`)۶' },
        { e:'excited',  t:'記録更新でつ！ ランキングも見てみよ。' },
        { e:'happy',    t:'新記録だね。この編成、当たり ( ˘ω˘)9グッ!' },
        { e:'surprise', t:'すごい…！ 次はどこまで伸びるんだろ。' },
        { e:'happy',    t:'ベスト更新、私も嬉しい♪♪' },
      ],
      firstWin: [
        { e:'excited',  t:'はじめての優勝、おめでとう♪♪ ٩(´ᵕ`)۶' },
        { e:'excited',  t:'やったね…！ 記念すべき1勝目でつ。' },
        { e:'happy',    t:'ついにクリアだね。ここまでよく頑張りました♪' },
        { e:'surprise', t:'えっ、もう勝っちゃう？ すごいでつ…！ (゜∀゜)' },
        { e:'happy',    t:'初優勝。この子は登録しておこ♪♪' },
      ],
      firstClear: [
        { e:'excited',  t:'この難易度、初クリアだね。おめでとう♪♪' },
        { e:'happy',    t:'初制覇でつ。大きな一歩だね (・∀・)ノ' },
        { e:'excited',  t:'やったね！ 次の難易度も見えてきまつ。' },
        { e:'happy',    t:'はじめてのクリア。ちゃんと強くなってまつよ。' },
        { e:'wink',     t:'初クリア記念。この勇者モン、大事にしよ♪' },
      ],
    },
    resultLose: {
      firstLose: [
        { e:'troubled', t:'はじめての負けだね。でも大丈夫、みんな通る道でつ。' },
        { e:'happy',    t:'負けても経験値は入るよ。ここからが本番♪♪' },
        { e:'crying',   t:'悔しいよね…。でも、けっこう惜しかったと思う (>人<;)' },
        { e:'normal',   t:'次はどこを直す？ 一緒に考えよ。' },
        { e:'wink',     t:'一回負けたくらいで終わらないよね。リベンジ♪' },
      ],
    },
    market: {
      lowGold: [
        { e:'troubled', t:'ダイヤが心もとないね…。' },
        { e:'normal',   t:'ミッションとログインボーナスで、少しずつ貯まりまつよ。' },
        { e:'happy',    t:'寄付でも、ダイヤは手に入るよ♪' },
        { e:'wink',     t:'今日は見るだけにしとく？' },
        { e:'normal',   t:'焦らなくて大丈夫。少しずつでいこ。' },
      ],
    },
    missionsClaimable: {
      allDone: [
        { e:'excited',  t:'ぜんぶ達成…！ お見事♪♪ ٩(´ᵕ`)۶' },
        { e:'happy',    t:'完璧でつ。今日はよく遊んだね♪' },
        { e:'surprise', t:'全部…！ すごい (゜∀゜)' },
        { e:'wink',     t:'また明日、新しいミッションが来まつよ♪♪' },
        { e:'happy',    t:'お疲れさま。ゆっくり休も (´ー`*)ウンウン' },
      ],
    },
  },
});

// ---------- ももすけ・全画面の基本セリフ ----------
// 2026-09-17・ユーザーから本人の会話ログを受け取って口調を寄せ直した。
//
// 【それまでとの違い】
//   書き直す前は「♡」70本・「♪」120本に対して「w」が3本しかなく、
//   煽る・からかうのが芯になっていた。実物はそこがまるで違う。
//
// 【実物から拾った特徴】
//   ・**素直に驚いて、素直に褒める**のが芯。「なにこれかわいい！！w」「良さげなかんじ！」
//     「ちゃんとジャケットはオリジナルなのえらいw」「さすがだ！」
//   ・笑いは「w」「ww」「wwww」。感嘆符も重ねる(「！！」「！！！」)
//   ・**細かいところによく気づく**。そこがそのままツッコミになる(悪意は無い)。
//     「まって、よく見たら〜になってる！！！wwww」「ちょっとあざとさが混じってるねw」
//   ・確認はやわらかく聞く。「あんまり拡散はしちゃいけない感じ？」「誰かが作ってるの？」
//   ・崩して伸ばす。「すごお笑」「オォォォォ！」「ちまちま」「わらうww」
//   ・愛称で呼ぶ(「みゅあねぇ」「キリッチー」「もっちー」)
//
// 【残したもの】
//   小悪魔成分(「♡」でからかう)は**残すが割合を下げる**。ももすけの紹介文と、
//   イベント会話でドラを弄ぶ役がこれで成り立っているため、消すと別人になる。
//   目安は「w・！！」が主、「♡」はたまに、「♪」は控えめ。
addAssistantLinePack({
  id: 'momosukeCore',
  assistantId: 'momosuke',
  label: 'ももすけ・全画面の基本セリフ',
  lines: {
    // ---- 日次アドバイス ----
    dailyMasuAdvice: [
      { e:'wink',     t:'マスモンを早く増やしたいんでしょ？ いい方法おしえたげるw' },
      { e:'happy',    t:'クイックのBeginnerでWAVE2まで行って、\n「あきらめる」を押すの。' },
      { e:'excited',  t:'これがいまのところ最速！ ももが見つけたわけじゃないけどねw' },
      { e:'normal',   t:'WAVE2まで行くのが条件だから。そこ間違えないでよ？' },
      { e:'happy',    t:'時間ないときはこれ。かしこく増やしちゃお♪' },
    ],
    // ---- モンビー(モンヒロビート) ----
    rhythmHome: [
      { e:'excited',  t:'曲えらんで、難易度えらんで、決定！ それだけだよw' },
      { e:'happy',    t:'{name}、どれにする〜？ 迷うならランダムに決めてもらっちゃえば？' },
      { e:'normal',   t:'えらんでる曲は流れてるから、聴いてから決めていいよ。' },
      { e:'wink',     t:'ムズいと思ったら、オプションでノーツ速度を下げていいからね？ ……下げるんだ♡' },
      { e:'normal',   t:'EXPERTとMASTERは、ひとつ下をクリアすれば開くよ。' },
      { e:'happy',    t:'横画面にすると一覧と選んだ曲が並ぶよ。見やすいほうでどうぞ！' },
    ],
    rhythmWeeklyEvent: [
      { e:'excited',  t:'期間限定だよ、これ！ この期間に出した点だけで勝負ねw' },
      { e:'normal',   t:'部門ごとに報酬あるよ。何位で何もらえるかは、部門開けば出てる。' },
      { e:'happy',    t:'報酬は終わったあとね。いま慌てなくていいよ。' },
      { e:'normal',   t:'イベントは「イベント」タブね。週間はいつもどおり別のタブで動いてるよ。' },
      { e:'wink',     t:'{name}、終わる前に1曲くらい置いていきなよ♡' },
    ],
    rhythmMonsters: [
      { e:'excited',  t:'ここで決めた子、曲の途中で金色になって飛んでくるよ！！' },
      { e:'normal',   t:'上から順に出るからね。1体1回、最大4回。' },
      { e:'happy',    t:'GREATより上で取れたら能力が出るよ。……ちゃんと取れる？w' },
      { e:'normal',   t:'能力は主血統で決まってるの。育てても染めても変わんないよ。' },
      { e:'wink',     t:'ライフ持たないなら元気か無敵ね。ま、{name}なら要らないかもだけど♡' },
      { e:'happy',    t:'好きな子入れときなよ。強さより気分でしょ、こういうのはw' },
    ],
    rhythmHelp: [
      { e:'happy',    t:'遊びかたはぜんぶここ。わかんなくなったら見にきていいよ！' },
      { e:'normal',   t:'ノーツの種類も判定もスコアの決まり方も、ここで確かめられるから。' },
      { e:'wink',     t:'読むより体で覚える派？ なら上の「もう一度チュートリアル」からどうぞ♡' },
      { e:'excited',  t:'{name}が知りたいことは、たぶんこの中にあるよw' },
      { e:'normal',   t:'ここに書いてあるのは、設定のヘルプと同じ内容だよ。' },
      { e:'happy',    t:'読んでも分かんなかったら、1回やってみたほうが早いってw' },
    ],
    // ---- 種族チャレンジ ----
    speciesChallenge: [
      { e:'excited',  t:'種族チャレンジ！ 決まった種族だけで挑むやつだよ！' },
      { e:'normal',   t:'種族をえらんで、その子たちだけで勝ちにいくの。しばりプレイってやつね。' },
      { e:'wink',     t:'いつもの編成が使えないんだから、腕が出るよ〜♡' },
      { e:'happy',    t:'クリアすると、その種族の解放が進むよ。集めがいあるでしょw' },
      { e:'normal',   t:'手持ちが足りない種族は、育ててから出直すのもアリだよ。' },
      { e:'excited',  t:'ぜんぶ埋めたら気持ちよさそうじゃない？ やろやろ！' },
    ],
    // ---- 極限チャレンジ ----
    extremeChallenge: [
      { e:'excited',  t:'ここから先は極限チャレンジ！ ぜんぜん別モノだから覚悟してねw' },
      { e:'happy',    t:'育てた子の本気を見せるとこだよ。楽しみ〜！' },
      { e:'troubled', t:'名前どおり極限。なまはんかな育成だと普通に無理だからね？' },
      { e:'wink',     t:'腕試しの場所ってこと。……ま、{name}なら大丈夫でしょ♡' },
      { e:'normal',   t:'チャレンジのさらに上。厳しかったら育ててから出直していいんだよ。' },
      { e:'excited',  t:'専用ランキングもあるよ！ 記録、残しにいこ！' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'EXTREMEはアシストカードの効果が半分だよ。いつもの感覚だと事故るからね。' },
      { e:'surprise', t:'敵の強さ×13！！ ……うわ、書いてて引いたw' },
      { e:'excited',  t:'虹のプシュケーがもらえるよ。挑む前にWAVEの中身も見ときな？' },
      { e:'wink',     t:'ここがEXTREME。準備できてるなら、いっちゃお♡' },
      { e:'normal',   t:'キツそうなら無理しないで。もうひと育成してから来ればいいの。' },
      { e:'happy',    t:'ももは見てるから。いっといでよw' },
    ],
    nightmareDifficulty: [
      { e:'surprise', t:'NIGHTMAREはEXTREMEの上！！ もっとひどい悪夢だよw' },
      { e:'troubled', t:'有利な補正がちっちゃくなるの。効いてる気がしなくなるやつ。' },
      { e:'surprise', t:'そのくせ不利な補正は重くなるんだって。特殊ルール3つ、見ときなよ？' },
      { e:'normal',   t:'距離適性がいつも以上に効いてくるよ。編成、ちゃんと考えて。' },
      { e:'excited',  t:'ここを越えられたら、けっこう自慢していいと思う！' },
    ],
    chaosDifficulty: [
      { e:'surprise', t:'CHAOSはNIGHTMAREのさらに上。名前からしてもう無茶苦茶じゃんwww' },
      { e:'troubled', t:'補正の偏りがもっと激しくなるよ。かみ合わないと一瞬で終わる。' },
      { e:'normal',   t:'特殊ルールを読んでから挑んだほうがいいよ。ほんとに。' },
      { e:'wink',     t:'ここまで来る人、そんなにいないんだからね？ えらいえらいw' },
      { e:'excited',  t:'混沌、越えちゃお！ ももが見ててあげる♡' },
    ],
    ultimateDifficulty: [
      { e:'surprise', t:'ULTIMATE。もう最終試験みたいなものだよ。' },
      { e:'troubled', t:'ここは育成の詰めが甘いと通らないの。ごまかしが効かないやつ。' },
      { e:'normal',   t:'アシストも編成も、ぜんぶ噛み合わせてね。' },
      { e:'wink',     t:'ここまで来といて、いまさら引き返さないよね？♡' },
      { e:'excited',  t:'究極って言われると、なんかワクワクしない？ ももはするw' },
    ],
    infinityDifficulty: [
      { e:'surprise', t:'INFINITY。……もう名前で殴ってきてるじゃんwww' },
      { e:'troubled', t:'補正も敵の強さも、ここまでとは桁が違うからね。' },
      { e:'normal',   t:'限界まで育てた子と、いちばん噛み合う編成でどうぞ。' },
      { e:'excited',  t:'無限って言われて燃えないわけないでしょ！' },
      { e:'happy',    t:'届いたらすごいことだよ。もももちょっと本気で応援する♡' },
    ],
    godDifficulty: [
      { e:'surprise', t:'GOD。いちばん上。ここまで来たんだ……！' },
      { e:'troubled', t:'言っとくけど、生半可だと何もできずに終わるからね。' },
      { e:'normal',   t:'ここは運じゃなくて、積み上げたものが出るところだよ。' },
      { e:'excited',  t:'届いたら、ももが世界一ちやほやしてあげるw' },
      { e:'happy',    t:'……ここまで付き合ってくれてありがと。あとは行ってきなよ。' },
    ],
    // RAGNAROKはGODの上の最終難易度。ももすけ側にも用意しないとみゅあのセリフへ落ちる
    ragnarokDifficulty: [
      { e:'surprise', t:'RAGNAROK……GODの上にまだあったんだ。敵の強さ200倍だよ！？' },
      { e:'normal',   t:'2WAVEごとに黄昏Lvが上がって、最後は敵が2倍になるよ。' },
      { e:'troubled', t:'DISTANCE BREAKは15ターンごと。安全な距離なんてないから。' },
      { e:'surprise', t:'まって、WAVE5と10のボス、倒しても起き上がってくるんだってwww' },
      { e:'excited',  t:'報酬は虹のプシュケー130個。……行くんでしょ？♡' },
      { e:'happy',    t:'ここまで来たキミなら、ももは止めないよ！' },
    ],
    // ---- はじめての設定 ----
    onboarding: [
      { e:'wink',     t:'はいはーい、ももだよw これから一緒にモンスター育てよ♡' },
      { e:'happy',    t:'まずは名前とアイコン！ あとから変えられるから気楽でいいよ。' },
      { e:'excited',  t:'決めたらすぐ始められるよ。はやくはやく〜！' },
      { e:'normal',   t:'名前もアイコンも、あとで気が変わったら直せるからね。' },
      { e:'happy',    t:'キミのこと、ちゃんと覚えたいんだから。教えてよw' },
    ],
    // ---- HOME ----
    home: [
      { e:'happy',    t:'なにする〜？ ももはなんでも付き合ってあげるよ♡' },
      { e:'wink',     t:'まだ迷ってるの？ も〜、しょうがないなぁw' },
      { e:'excited',  t:'今日もいっぱい遊ぼ！ 途中でへばったら笑っちゃうけどw' },
      { e:'normal',   t:'マスモンの絆レベル、たまには見てあげたら？' },
      { e:'wink',     t:'ミッションとギフト、覗いてみなよ。なんか入ってるかも！' },
      { e:'normal',   t:'放牧に出した子が村を歩いてるよ。見つけられる？' },
      { e:'happy',    t:'今日はどこ行く？ ももは神殿がいいと思うなw' },
      { e:'normal',   t:'編成いじるだけでも、けっこう変わるんだからね。' },
      { e:'happy',    t:'更新履歴、読んでる？ たまに面白いこと書いてあるよw' },
      { e:'normal',   t:'今日のログインボーナス、もう取った？' },
      { e:'troubled', t:'ダイヤの使いどころ……ももも毎回まよう。', w:0.5 },
      { e:'happy',    t:'つかれたら休みなよ。ゲームは逃げないからw', w:0.5 },
      { e:'surprise', t:'まって、いま向こうでマスモンがコケた！！ ……見てない？', w:0.25 },
      { e:'wink',     t:'ないしょだけど、ももは夕方の村がいちばん好き♡', w:0.25 },
      { e:'excited',  t:'ねえねえ、ももの話きいてよ。……別にないけどw', w:0.25 },
      // Lv1〜2: 出会ったばかり。距離は近いけど、まだ様子を見ている
      { e:'wink',     t:'{name}、今日はなにして遊ぶの？', bond:[1,2] },
      { e:'normal',   t:'{name}って、意外とまじめに育てるタイプ？', bond:[1,2] },
      { e:'happy',    t:'{name}のペースでいいよ。ももは合わせるからw', bond:[1,2] },
      { e:'wink',     t:'{name}、ももがいれば退屈しないでしょ？♡', bond:[1,2] },
      // Lv3〜5: 「っち」付けになって、いたずらが本格化する
      { e:'excited',  t:'{name}、おかえり〜！ 待ってたなんて言わないけどね♡', bond:[3,5] },
      { e:'happy',    t:'{name}のその育成、けっこうセンスあるじゃんw', bond:[3,5] },
      { e:'wink',     t:'{name}がいないあいだ、ちょっとヒマだったんだけど？', bond:[3,5] },
      { e:'normal',   t:'{name}、今日はなんか調子よさそうだね。気のせい？', bond:[3,5] },
      // Lv6以降: 呼び方を自分で決められる。煽りの奥がだんだん見えてくる
      { e:'happy',    t:'{name}、呼び方じぶんで決められるようになったよ！ 好きに呼ばせてあげる♡', bond:6 },
      { e:'wink',     t:'{name}とはもう気ぃ使わなくていいよね。楽ちんw', bond:7 },
      { e:'excited',  t:'{name}となら、どの難易度でも行けそうじゃない？', bond:9 },
      { e:'happy',    t:'{name}が来ると、なんか調子出るんだよね。……なんでw', bond:11 },
      { e:'normal',   t:'{name}、ももはずっとここにいるから。いなくならないよ。', bond:13, w:0.5 },
      { e:'excited',  t:'{name}とはもう、言わなくても分かるでしょw', bond:15 },
      { e:'happy',    t:'{name}とここまで来られて、ももはけっこう嬉しい。……けっこうね♡', bond:18, w:0.5 },
      { e:'happy',    t:'{name}、これからもよろしくね。ずっと一緒だから♡', bond:20 },
    ],
    // ---- バトル ----
    battleChallenge: [
      { e:'excited',  t:'チャレンジモード！ 記録が残るやつだよ！' },
      { e:'normal',   t:'ここのスコアはランキングに載るからね。本気でどうぞ。' },
      { e:'wink',     t:'ほらほら、負けないでよ〜？ ももが見てるんだから♡' },
      { e:'happy',    t:'難易度は自分で選べるよ。届きそうなとこからでいいからね。' },
      { e:'normal',   t:'編成を見直してから挑むと、ぜんぜん違うよ。' },
      { e:'excited',  t:'いい記録出たら、ちゃんとほめてあげるw' },
    ],
    battleQuick: [
      { e:'happy',    t:'クイックはサクッと遊べるやつ！ 時間ないときはこれ。' },
      { e:'normal',   t:'クイックの記録はランキングには載らないよ。気楽にどうぞ。' },
      { e:'wink',     t:'マスモン増やしたいなら、ここが早いんだよね〜♡' },
      { e:'excited',  t:'ちょっとだけ遊ぶつもりが長引くやつ。ももは知ってるww' },
      { e:'normal',   t:'難易度は好きに選んでいいよ。無理しなくていいからね。' },
      { e:'happy',    t:'テンポよくいこ！ 待たされるのキライでしょ？' },
    ],
    battlePro: [
      { e:'excited',  t:'プロモード！ 合流する仲間を自分で仕込むやつだよ！' },
      { e:'normal',   t:'ここで選んだ子の中からしか来ないから、選び方が大事。' },
      { e:'wink',     t:'考えて組むほど強くなるモード。{name}、得意でしょ？♡' },
      { e:'normal',   t:'距離のバランス、ちゃんと散らしたほうがいいよ。' },
      { e:'happy',    t:'うまくハマったときの気持ちよさ、クセになるからw' },
      { e:'troubled', t:'偏らせると、来てほしい距離の子が来なくて泣くよ？' },
      { e:'excited',  t:'ここもランキング対象！ 記録、狙っちゃお！' },
    ],
    ranking: [
      { e:'excited',  t:'ランキング！ みんなの記録が並んでるよ！' },
      { e:'wink',     t:'上の人たち、えぐいでしょ？ ……追いつけそう？♡' },
      { e:'normal',   t:'名前をタップすると、その人の編成まで見られるよ。' },
      { e:'happy',    t:'強い人の編成、まねするのが上達の近道だからねw' },
      { e:'normal',   t:'難易度ごとに分かれてるよ。自分の得意なとこから見なよ。' },
      { e:'excited',  t:'{name}の名前がここに並んだら、ももが自慢してあげる♡' },
    ],
    rankingParty: [
      { e:'happy',    t:'この人が使ってた編成だよ。染めた色までそのまま出てるのw' },
      { e:'normal',   t:'どの距離に置いてたかも分かるよ。まねしちゃえば？' },
      { e:'wink',     t:'ぬすめるところは、ぜんぶぬすんでいいんだよ♡' },
      { e:'surprise', t:'まって、こういう組み方するんだ！？ ……ちょっと悔しいかもw' },
      { e:'normal',   t:'同じ編成にしても、育て方が違えば結果は変わるからね。' },
      { e:'happy',    t:'いいと思ったら取り入れよ！ 遠慮いらないって。' },
    ],
    pickHero: [
      { e:'excited',  t:'主役をえらぶとこ！ この子を中心に戦うんだよ！' },
      { e:'normal',   t:'能力と距離適性、ちゃんと見てからにしてね。' },
      { e:'wink',     t:'迷ってるなら、いちばん育ってる子でいいんじゃない？♡' },
      { e:'happy',    t:'お気に入りで挑むのもアリだよ。楽しいのがいちばんw' },
      { e:'normal',   t:'あとの編成もこの子に合わせて組むといいよ。' },
    ],
    pickSlot: [
      { e:'normal',   t:'敵と同じ距離から殴ると強いよ。そこ大事。' },
      { e:'wink',     t:'得意な距離と、いまの補正を見て置いてね。……できる？♡' },
      { e:'happy',    t:'置き方だけで勝てちゃうこともあるんだからw' },
      { e:'normal',   t:'苦手な距離に置くと、しっかり弱くなるからね。気をつけて。' },
      { e:'excited',  t:'かみ合ったときの気持ちよさ、味わってみてよ！' },
    ],
    pickAlly: [
      { e:'happy',    t:'一緒に戦う仲間をえらぼ！ 主役だけじゃ勝てないからね。' },
      { e:'normal',   t:'距離をばらけさせておくと、どんな相手でも戦えるよ。' },
      { e:'wink',     t:'全員おなじ距離とかにしないでよ？ ……しないよね♡' },
      { e:'excited',  t:'お気に入りを連れていくの、いいと思うw' },
      { e:'normal',   t:'育ってる子を優先するのが無難だよ。まあ好きにどうぞ。' },
    ],
    pickProAllies: [
      { e:'normal',   t:'ここで選んだ子の中からしか来ないよ。よく考えてね。' },
      { e:'wink',     t:'合流で出るのは、この中からランダムで3体だけ。運ゲーにするか、確実にするかだよ♡' },
      { e:'troubled', t:'距離を偏らせると、来てほしい子が来なくて泣くからね？' },
      { e:'happy',    t:'ぜんぶ強い子で埋めれば、なにが来ても困らないでしょw' },
      { e:'excited',  t:'ここの仕込みが上手い人、ほんとに強いんだよね〜。' },
      { e:'normal',   t:'枠が余るくらいなら、育ってる子を足しておきなよ。' },
    ],
    pickTeaching: [
      { e:'happy',    t:'アシストカードは6枚まで。持ち込む子をえらぼ！' },
      { e:'normal',   t:'効果が噛み合う組み合わせにすると、ぐっと楽になるよ。' },
      { e:'wink',     t:'ぜんぶ攻撃系とかにしないでよ？ 崩れたとき困るから♡' },
      { e:'excited',  t:'ここの選び方で勝ち負けが変わることもあるんだからねw' },
      { e:'normal',   t:'迷ったら、いつも使ってる組み合わせでいいよ。' },
    ],
    rewardPick: [
      { e:'excited',  t:'WAVEクリアおつかれ！ トレーニングを2つえらんで！' },
      { e:'normal',   t:'弱点をうめるか、強みを伸ばすか。悩ましいとこだよね。' },
      { e:'wink',     t:'ここで欲張ると、あとで泣くよ〜？♡' },
      { e:'happy',    t:'この先の相手を思い浮かべて選ぶといいよw' },
      { e:'normal',   t:'迷ったら、いま足りてないほうを取るのが無難だよ。' },
    ],
    battleHelp: [
      { e:'happy',    t:'バトルの仕組みはここで確かめられるよ！' },
      { e:'normal',   t:'距離・カード・ガッツ。だいたいこの3つが分かれば戦えるよ。' },
      { e:'wink',     t:'読むのめんどい？ ……まあ、やりながら覚えてもいいけどね♡' },
      { e:'normal',   t:'つまずいたところだけ読めばいいよ。ぜんぶ読まなくていいって。' },
      { e:'excited',  t:'わかると一気に楽しくなるから。がんばってw' },
    ],
    resultWin: [
      { e:'excited',  t:'勝ったじゃん！！ やるね〜w' },
      { e:'happy',    t:'いい戦いだった！ ……ちょっと見直しちゃった♡' },
      { e:'wink',     t:'ま、ももが見てたからでしょ？ 感謝してw' },
      { e:'normal',   t:'この調子で次いこ。勢いって大事なんだから。' },
      { e:'excited',  t:'つぎはもっと上、狙えるんじゃない？！' },
    ],
    resultLose: [
      { e:'troubled', t:'あ〜あ、負けちゃった。……ドンマイ。' },
      { e:'normal',   t:'編成か育成、どっちか足りなかっただけ。次いこ次！' },
      { e:'happy',    t:'一回負けたくらいで落ち込まないでよ。似合わないから。' },
      { e:'normal',   t:'距離のかみ合わせ、見直してみたら？ たぶんそこだよ。' },
      { e:'wink',     t:'ももはまだ見限ってないから。もっかいやろ♡' },
    ],
    resultRetire: [
      { e:'normal',   t:'やめちゃうんだ。まあ、それも判断だよね。' },
      { e:'happy',    t:'無理して続けるより、ぜんぜんいいと思うw' },
      { e:'wink',     t:'にげたわけじゃないもんね？ ……うんうん♡' },
      { e:'normal',   t:'育ててから出直せばいいだけだよ。' },
      { e:'happy',    t:'また気が向いたら誘って。付き合うからさw' },
    ],
    skipPick: [
      { e:'excited',  t:'スキップで一気に育成！ 使う枚数もえらべるよ。' },
      { e:'happy',    t:'時間ないときの味方だよね〜w' },
      { e:'normal',   t:'スキップぶんはランキングには載らないから、そこだけ覚えといて。' },
      { e:'wink',     t:'ラクしたいときは、ラクしていいんだよ♡' },
      { e:'normal',   t:'枚数が多いほど、まとめて入るよ。' },
    ],
    skipResult: [
      { e:'excited',  t:'受け取り完了！ 一気に育ったじゃん！！' },
      { e:'surprise', t:'うわ、ごっそり入った……ww' },
      { e:'happy',    t:'ラクして強くなるの、気持ちいいでしょw' },
      { e:'normal',   t:'この子、けっこう変わったんじゃない？ 見てあげなよ。' },
      { e:'wink',     t:'また溜まったら使お！ ももが教えてあげる♡' },
    ],
    // ---- モンスター・マスモン ----
    monsterDex: [
      { e:'excited',  t:'図鑑！ 会った子がここに並んでいくよ！' },
      { e:'happy',    t:'埋まっていくの、気持ちいいよね〜w' },
      { e:'normal',   t:'まだ会ってない子は影のままだよ。探しにいこ。' },
      { e:'wink',     t:'コンプリート、できると思う？ ……できたらすごいけど♡' },
      { e:'normal',   t:'種族や血統のことも、ここで確かめられるよ。' },
    ],
    mbManagement: [
      { e:'happy',    t:'M/B管理。マスモンとブリーダーのことはここ！' },
      { e:'normal',   t:'登録・強化・入れ替え、ぜんぶここでできるよ。' },
      { e:'wink',     t:'ほったらかしにしてない？ たまには見てあげてよ〜♡' },
      { e:'excited',  t:'育てた子が並んでるの、眺めてるだけで楽しくない？' },
      { e:'normal',   t:'絆レベルが上がると、できることが増えるよ。' },
    ],
    roster: [
      { e:'happy',    t:'手持ちの一覧だよ。ずいぶん増えたね！' },
      { e:'normal',   t:'並べ替えると、育ってる子がすぐ分かるよ。' },
      { e:'wink',     t:'使ってない子、そろそろ日の目を見せてあげたら？♡' },
      { e:'excited',  t:'お気に入りが増えていくの、いいことだと思うw' },
      { e:'normal',   t:'枠がきつくなったら、合体や寄付を考えてみて。' },
      { e:'happy',    t:'{name}の趣味、ちょっと分かってきたかもw' },
    ],
    monsterList: [
      { e:'normal',   t:'モンスターの一覧だよ。えらんで詳しく見られる。' },
      { e:'happy',    t:'ステータスも適性も、ここで確かめられるよ！' },
      { e:'wink',     t:'見た目で選んでもいいと思うよ。ももはそっち派♡' },
      { e:'normal',   t:'育てる子を決めたら、そこに集中したほうが早いよ。' },
      { e:'excited',  t:'掘り出しものがいるかもよ。ちゃんと見た？' },
    ],
    masuList: [
      { e:'happy',    t:'マスモンの一覧！ 登録した子はここに並ぶよ。' },
      { e:'normal',   t:'絆レベルを上げると、能力もいっしょに伸びるよ。' },
      { e:'wink',     t:'えこひいきしてるでしょ〜？ ……ももは知ってるよ♡' },
      { e:'excited',  t:'枠は限られてるから、だれを残すか考えどころだね。' },
      { e:'normal',   t:'モンヒロビートのモンスターノーツにも、この子たちが出るよ。' },
      { e:'happy',    t:'みんな{name}に育てられて幸せそうじゃんw' },
    ],
    masuAutoEnhance: [
      { e:'wink',     t:'決めとけば勝手に振ってあげる。ラクでしょ♡' },
      { e:'normal',   t:'上から順に上限まで。並べ替えたら優先順位が変わるよ。' },
      { e:'happy',    t:'{name}、転生前に「いまの配分を取り込む」押しときなよ？' },
      { e:'excited',  t:'転生してもこの設定は残るの。ももに感謝していいよw' },
      { e:'normal',   t:'上限まで行ったら止まるから、余ったぶんは自分で使ってね。' },
      { e:'troubled', t:'振る先を決めてないとONでも動かないよ。そこだけ気をつけて。' },
    ],
    masuEnhance: [
      { e:'normal',   t:'ポイントは適性か能力値に使えるよ。' },
      { e:'happy',    t:'得意な戦い方に合わせて伸ばすのがコツ！' },
      { e:'wink',     t:'まんべんなく振ると、器用貧乏になるからね？♡' },
      { e:'excited',  t:'尖らせたほうが強いよ。ももはそう思うw' },
      { e:'normal',   t:'振り直したくなったら、専用のアイテムがあるからね。' },
    ],
    // ---- 神殿まわり ----
    temple: [
      { e:'excited',  t:'神殿！ 合体も転生も寄付もここでできるよ！' },
      { e:'happy',    t:'どんな子が来るかな〜w 変なの来ても泣かないでよ？' },
      { e:'normal',   t:'育成の土台になる場所だからね。ちゃんと使いなよ。' },
      { e:'wink',     t:'いい子が出てきたら、ももにも見せてね♡' },
      { e:'normal',   t:'素材が足りないときは、先に集めてから来るといいよ。' },
      { e:'excited',  t:'ここでの一手で、育成がぜんぜん変わるんだからw' },
    ],
    fusion: [
      { e:'excited',  t:'合体！ なにが出るか分かんないの、たまんないよねw' },
      { e:'normal',   t:'素材の組み合わせで結果が変わるよ。よく見てね。' },
      { e:'wink',     t:'大事な子を素材にして、あとで後悔しないでよ〜？♡' },
      { e:'happy',    t:'当たり引いたら、ちゃんと自慢してね！' },
      { e:'normal',   t:'ねらってる子がいるなら、先に条件を確かめて。' },
    ],
    rebirth: [
      { e:'normal',   t:'転生。育てた子を作り直して、さらに上を目指すやつ。' },
      { e:'happy',    t:'手間はかかるけど、そのぶん強くなるよ！' },
      { e:'wink',     t:'ここまで来る人、なかなかいないんだからね？ えらいw' },
      { e:'excited',  t:'生まれ変わったあとが本番だよ。楽しみでしょ？' },
      { e:'normal',   t:'条件を満たしてるか、先に確かめてからにしてね。' },
    ],
    transcendence: [
      { e:'surprise', t:'超越！！ ここまで育てたんだ……ちょっと感心しちゃったw' },
      { e:'normal',   t:'必要な経験値も素材も、けっこうな量が要るよ。' },
      { e:'excited',  t:'超えた子は、見た目もマークも変わるんだよ！' },
      { e:'happy',    t:'ここまで育てた{name}、ちゃんとすごいと思う。さすがだよ。' },
      { e:'normal',   t:'虹の超越の実があると、うんと楽になるよ。' },
    ],
    reincarnate: [
      { e:'normal',   t:'転生の回数を重ねるほど、伸びしろが増えるよ。' },
      { e:'happy',    t:'何回もやり直すの、地味だけど効くんだよねw' },
      { e:'wink',     t:'そこまでやる？ ……やるんだ。好きだね〜♡' },
      { e:'excited',  t:'完了したときの演出、ちゃんと見てあげてよ！' },
      { e:'normal',   t:'回数ごとに変わるところがあるから、見比べてみて。' },
    ],
    donation: [
      { e:'normal',   t:'寄付すると、使わない子をブリーダー経験値に変えられるよ。' },
      { e:'troubled', t:'手放すのは寂しいけどね。……ちょっとだけ。' },
      { e:'happy',    t:'枠が苦しくなったら、ここで整理するのがいいよw' },
      { e:'wink',     t:'大事な子まで出さないでよ？ もどってこないんだから♡' },
      { e:'normal',   t:'ブリーダーLvが上がると、できることが増えるからね。' },
    ],
    pasture: [
      { e:'happy',    t:'お気に入りを5体までHOMEに出せるよ！' },
      { e:'normal',   t:'強さには関係ないから、見た目で選んでOK。' },
      { e:'excited',  t:'村を歩いてるの、見てるだけでかわいくない？！' },
      { e:'wink',     t:'{name}の趣味が出るとこだよね〜。見せて見せてw' },
      { e:'normal',   t:'気分で入れ替えていいからね。いつでも変えられるよ。' },
    ],
    // ---- マーケット・アイテム ----
    market: [
      { e:'wink',     t:'お買い物？ 無駄づかいしすぎたら、ももが笑ってあげる♡' },
      { e:'normal',   t:'ちゃんと欲しいもの決めてきた〜？' },
      { e:'happy',    t:'それ買うんだ？ ふ〜ん、見る目あるじゃんw' },
      { e:'excited',  t:'アイコンも売ってるよ。ももの顔もあるからね♡' },
      { e:'normal',   t:'円盤石を買うと、新しい子が使えるようになるよ。' },
      { e:'troubled', t:'まとめ買いすると、あとでダイヤ足りなくなるやつ。……気をつけて。' },
    ],
    inventory: [
      { e:'normal',   t:'持ってるアイテムはここ。しまいっぱなしにしてない？' },
      { e:'happy',    t:'効果と使う相手を見て、いいタイミングで使ってねw' },
      { e:'wink',     t:'もったいなくて使えないやつ、いちばんもったいないんだからね？♡' },
      { e:'excited',  t:'いいアイテム持ってるじゃん！ 使いなよw' },
      { e:'normal',   t:'足りないものはマーケットで買えるよ。' },
    ],
    giftClaimable: [
      { e:'excited',  t:'ギフト届いてるよ！！ はやく受け取りなよw' },
      { e:'happy',    t:'なにが入ってるかな〜！ 開けて開けて！' },
      { e:'wink',     t:'受け取り忘れてたら、さすがに笑うからね？w' },
      { e:'normal',   t:'「すべて受け取る」でまとめて取れるよ。' },
      { e:'excited',  t:'タダでもらえるものは、ぜんぶもらっとこ！' },
    ],
    giftEmpty: [
      { e:'normal',   t:'いまは空っぽ。ぜんぶ受け取り済みだね。' },
      { e:'happy',    t:'ちゃんとしてるじゃんw えらいえらい。' },
      { e:'wink',     t:'また届いたら教えてあげる。……たぶんね♡' },
      { e:'normal',   t:'ログインボーナスやミッションの報酬がここに来るよ。' },
      { e:'happy',    t:'空っぽなのは、ちゃんと取ってる証拠だからw' },
    ],
    missionsClaimable: [
      { e:'excited',  t:'ミッション達成してるよ！！ 受け取っちゃお！' },
      { e:'happy',    t:'がんばったごほうび、もらっとこ♡' },
      { e:'wink',     t:'ほったらかしにしてると、ももが代わりに……もらえないかw' },
      { e:'normal',   t:'デイリーもウィークリーも、こまめに見ると得だよ。' },
      { e:'excited',  t:'ぜんぶ埋まってると気持ちいいよね〜w' },
    ],
    missionsNormal: [
      { e:'normal',   t:'ミッションの一覧だよ。遊んでれば自然に進むやつ。' },
      { e:'happy',    t:'今日のぶん、あとちょっとじゃない？ いっちゃお！' },
      { e:'wink',     t:'狙って進めるとはやいよ。……知ってた？♡' },
      { e:'normal',   t:'ウィークリーは期限があるから、早めにね。' },
      { e:'excited',  t:'報酬いいやつあるから、見逃さないでよw' },
    ],
    // ---- プロフィール・設定・ヘルプ ----
    profile: [
      { e:'happy',    t:'{name}のプロフィール！ 名前もアイコンもここで変えられるよ。' },
      { e:'normal',   t:'遊んだ時間もここで見られるよ。……見る勇気ある？w' },
      { e:'wink',     t:'アイコン、ももの顔にしてくれてもいいんだよ？♡' },
      { e:'excited',  t:'イベントの回想もここから見られるよ！' },
      { e:'normal',   t:'助手をだれにするかも、ここで選べるからね。' },
      { e:'happy',    t:'記録が増えていくの、見てて楽しいよねw' },
    ],
    settings: [
      { e:'normal',   t:'設定。音とか表示とか、好きに変えていいよ。' },
      { e:'happy',    t:'BGMの割り当ても変えられるよ。こだわりある？w' },
      { e:'wink',     t:'ヘルプもこの中。迷子になったら開きなよ♡' },
      { e:'normal',   t:'データのバックアップも、ここから取れるからね。' },
      { e:'excited',  t:'自分好みにしたほうが、ぜったい楽しいから！' },
    ],
    helpTop: [
      { e:'happy',    t:'ヘルプ！ わかんないことは、だいたいここに書いてあるw' },
      { e:'normal',   t:'項目でわかれてるから、気になるとこだけ読めばいいよ。' },
      { e:'wink',     t:'ぜんぶ読む気？ ……まじめだね〜♡' },
      { e:'excited',  t:'新しい遊びが増えたときも、ここが更新されるからね。' },
      { e:'normal',   t:'読んでも分かんなかったら、ももに聞いてもいいよ。' },
      { e:'happy',    t:'困ったらここ。それだけ覚えといてw' },
    ],
    // ---- ∞周回×モンヒロビートの案内 ----
    // みゅあ(quickRhythmLinkGuide)・きき(kikiCore)と同じ場面。ここが無いと
    // ももすけを選んでいる人にもみゅあのセリフが出てしまう
    quickRhythmIntro: [
      { e:'excited',  t:'∞周回にしたんだ？ このままモンヒロビートで遊べるよ！' },
      { e:'happy',    t:'{name}、周回は裏で続くから。待ってる時間もったいないじゃんw' },
      { e:'wink',     t:'入口は「🎵 BGM」のすぐ下。省エネ「超」でも同じ場所だよ。' },
      { e:'normal',   t:'戻りたくなったら左上の「⚔ 戻る」でいつでも戻れるからね。' },
      { e:'normal',   t:'裏で回せるのはクイックの∞周回だけ。ほかは記録が絡むからね。' },
      { e:'troubled', t:'アプリを閉じたら、そこで周回は止まっちゃうよ。' },
    ],
    quickRhythmBackground: [
      { e:'excited',  t:'いま遊んでるあいだも、ちゃんと周回は進んでるよ！' },
      { e:'normal',   t:'演奏中だけは止まるけど、叩き切れば曲のぶんだけ入るよ。' },
      { e:'happy',    t:'上の帯をタップすれば、何周めか貯まったぶんも見られる。' },
      { e:'wink',     t:'{name}、遊んでるうちに強くなるって、ずるくない？♡' },
      { e:'normal',   t:'バトルへは左上の「⚔ 戻る」か、帯の中のボタンからね。' },
    ],
    autoQuickRunSettings: [
      { e:'normal',   t:'ここを決めておけば、モンヒロビートから∞周回を始められるよ。' },
      { e:'happy',    t:'勇者モンと配置と難易度の3つ。決めてないと直前の編成を使うよ。' },
      { e:'wink',     t:'まだ解放してない難易度は選べないよ。並んではいるけどね♡' },
      { e:'excited',  t:'3つそろうと下の一言が変わるから、そこが目印！' },
      { e:'happy',    t:'育ててる子を入れときなよ。放っといても絆が伸びるからw' },
    ],
  },
  conditions: {
    // 期間限定イベントのあいだ(画面側から condition='limited' で切り替える)
    speciesChallenge: {
      species: [
        { e:'excited',  t:'種族をえらんで！ この子たちだけで戦うんだからね！' },
        { e:'normal',   t:'手持ちが多い種族のほうが、たぶん楽だよ。' },
        { e:'wink',     t:'あえて少ないほうを選ぶ? ……いい度胸じゃん♡' },
      ],
      hero: [
        { e:'happy',    t:'主役をえらぼ！ この種族のエースはだれ？' },
        { e:'normal',   t:'いちばん育ってる子にしとくのが無難だよ。' },
        { e:'excited',  t:'この子で行くんだ？ いいじゃん、期待してるw' },
      ],
      allies: [
        { e:'normal',   t:'仲間もこの種族から。距離、ちゃんと散らしてね。' },
        { e:'wink',     t:'えらべる子が少ないと悩むよね〜。ふふ♡' },
        { e:'happy',    t:'そろったじゃん！ いい編成だと思うよ。' },
      ],
      confirm: [
        { e:'excited',  t:'これで行く？ もう変えられないよ〜！' },
        { e:'wink',     t:'覚悟はいい？ ……ま、ももは見てるだけだけど♡' },
        { e:'happy',    t:'いってらっしゃい！ 勝ってきてね。' },
      ],
    },
    home: {
      firstRun: [
        { e:'excited',  t:'まずはバトルに行こ！ 仲間はそこで増えるんだから！' },
        { e:'happy',    t:'なんにも持ってないところから始まるの、楽しいでしょ？' },
        { e:'wink',     t:'ももがついてるんだから、心配いらないって♡' },
      ],
      bondUp: [
        { e:'happy',    t:'あ、ももと仲良し度あがったw ……べつに嬉しくないけど♡' },
        { e:'excited',  t:'仲良し度あがったじゃん！！ もっと一緒にいてもいいよw' },
        { e:'wink',     t:'ふふ、ちょっとずつ距離つめてきてるね〜？' },
      ],
    },
    resultWin: {
      newRecord: [
        { e:'surprise', t:'まって、自己ベスト更新じゃん！！ ……ちょっとびっくりしたw' },
        { e:'excited',  t:'記録更新！！ やるじゃん、見直しちゃったw' },
      ],
      firstWin: [
        { e:'excited',  t:'はじめての勝利！ おめでと〜！！' },
        { e:'happy',    t:'いい滑り出しじゃん。この調子でいこw' },
      ],
      firstClear: [
        { e:'excited',  t:'クリアおめでと！ ちゃんとやりきったね。さすがだよ！' },
        { e:'happy',    t:'……正直、ちょっと感動した。ないしょね♡' },
      ],
    },
    resultLose: {
      firstLose: [
        { e:'troubled', t:'はじめての負けかぁ。……まあ、みんな通る道だよ。' },
        { e:'happy',    t:'ここからだよ。ももは全然見限ってないからw' },
      ],
    },
    market: {
      lowGold: [
        { e:'troubled', t:'ダイヤ、けっこう減ってきてない？ だいじょうぶ？' },
        { e:'wink',     t:'買いすぎ♡ ……って言うと思った？ ま、好きにしなよw' },
      ],
    },
    missionsClaimable: {
      allDone: [
        { e:'excited',  t:'ぜんぶ達成じゃん！！ かんぺきw' },
        { e:'happy',    t:'ここまでやるんだ。……えらいと思うよ、ほんとに♡' },
      ],
    },
  },
});

// ---------- セリフを増やすとき、ここへ足す ----------
// 場面ごとのセリフは「多いほど、遊んでいて飽きない」ので、思いついたら
// この束へ足していく。ASSISTANT_SCENES の定義そのものを触らずに増やせるので、
// 元の場面がどう作られているかを気にしなくてよい。
//
// 【足し方】
//   下の lines へ、場面キーごとに配列で足すだけ。
//     home: [ { e:'happy', t:'…' }, { e:'wink', t:'…', bond:6 } ],
//   ・e … 表情(normal / happy / wink / excited / troubled …)
//   ・t … セリフ。{name} はそのときの呼び方(さん付け・呼び捨て・ちん付け)に置き換わる
//   ・bond … その仲良し度以上のときだけ出す(省略すると、いつでも出る)
//   ・w … 出やすさ(省略すると1)
//   ・who … きき用にするなら 'kiki'(省略するとみゅあ)
//
// どの場面がいま何本あるかは `node tools/assistant/assistant-line-report.js` で見られる。
// 少ない場面から足していくと、体感が変わりやすい。
// 総合力ランキング(バトルモード選択画面の「総合力」タブ)。
// ヘルプは探しに行った人しか読まないので、タブを開いたその場でも
// 「何の順なのか」「なぜ載らない記録があるのか」を伝える(CLAUDE.md ⑤)。
addAssistantLinePack({
  id: 'powerRankingGuide',
  label: '総合力ランキング案内',
  lines: {
    ranking: [
      { e:'excited', t:'「総合力」タブができたよ！ 育てた子の強さそのもので競うランキング♪' },
      { e:'happy', t:'総合力も絆Lvと同じで、「すべて」と種族別を切り替えられるよ。' },
      { e:'normal', t:'総合力は、その記録を出したときの数字をそのまま並べてるんだ。' },
      { e:'wink', t:'{name}、強化も限界突破も超越も、ぜんぶ総合力に効いてくるからね♪' },
      { e:'normal', t:'育て方が記録に残る前の古い記録は、総合力が分からないから載らないんだ。' },
      { e:'happy', t:'気になる子がいたら「詳細 ›」を押してみて。育て方が丸ごと見られるよ！' },
    ],
  },
});

addAssistantLinePack({
  id: 'linesExtra',
  label: 'あとから足したセリフ(ここへどんどん足す)',
  lines: {
    // ---- 本数が5本しかなかった場面を10本ずつへ ----
    battleHelp: [
      { e:'normal',  t:'手札が渋いときは、削りに徹するのも手だよ。' },
      { e:'wink',    t:'距離を合わせるだけで、ダメージがぜんぜん違うんだ！' },
      { e:'troubled', t:'危ないと思ったら、無理せず守りに寄せよ！' },
      { e:'excited', t:'連撃が乗ったときの気持ちよさ、たまんないよね(´ー`*)ｳﾝｳﾝ' },
      { e:'happy',   t:'焦らなくて大丈夫。1ターンずつ積み上げていこ！' },
    ],
    chaosDifficulty: [
      { e:'troubled', t:'ここまで来たら、装備も編成も全部見直したいとこ|･ω･`)ﾌﾑﾌﾑ' },
      { e:'normal',  t:'消費ガッツが重いから、撃つ手を1つ減らす勇気も要るよ。' },
      { e:'excited', t:'CHAOSを抜けた人だけがULTIMATEへ行けるんだ！' },
      { e:'wink',    t:'半減されるぶん、素の火力を上げておくと戦いやすいよ♪' },
      { e:'surprise', t:'×20の敵って、想像するだけで震えちゃう(; \'ω\')ｺﾞｸﾘ' },
    ],
    dailyMasuAdvice: [
      { e:'normal',  t:'登録したい子を勇者モンにするのを忘れずにね。' },
      { e:'happy',   t:'絆経験値が入ってないと登録できないから、WAVE2までは進も！' },
      { e:'excited', t:'マスモンが増えると、編成の幅がぐっと広がるよ(´ー`*)ｳﾝｳﾝ' },
      { e:'wink',    t:'難易度は低くていいんだ。回数がものを言うやつだね笑' },
      { e:'normal',  t:'8体そろうまでは、この方法がいちばん早いと思うよ。' },
    ],
    infinityDifficulty: [
      { e:'normal',  t:'INFINITYまでの道のりは長かったね。育てた分はぜんぶ残ってるよ。' },
      { e:'happy',   t:'虹のプシュケーは80個！ 一度クリアできれば大きいよ♪' },
      { e:'excited', t:'経験値45倍・ダイヤ30倍だから、通っただけでも実りは大きいね！' },
      { e:'wink',    t:'安全距離は1つだけ残るよ。そこを軸に立ち回ろ(´ー`*)ｳﾝｳﾝ' },
      { e:'surprise', t:'ここはクイックには無いの。じっくり腰を据えて挑もうね。' },
    ],
    onboarding: [
      { e:'wink',    t:'アイコンもあとで増やせるから、今は好きなのでいこ♪' },
      { e:'excited', t:'モンスターを育てて、バトルして、また育てて…楽しいよ(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',  t:'難しそうに見えても、やってるうちに手が覚えるやつだよ。' },
      { e:'happy',   t:'最初の1体を決めるとこから始めよ！ ワクワクするね(´ー`*)ｳﾝｳﾝ' },
      { e:'wink',    t:'困ったら画面の中のあたしをタップ！ そこに答えがあるよ。' },
    ],
    pickAlly: [
      { e:'normal',  t:'手薄な距離を埋める子がいたら、その子が本命かも。' },
      { e:'wink',    t:'固有技の相性も見ておくと、あとで効いてくるよ♪' },
      { e:'happy',   t:'迷ったら、育ってる子を素直に選ぶのもアリ！' },
      { e:'excited', t:'いい仲間が来ると、一気に景色が変わるんだよね(´ー`*)ｳﾝｳﾝ' },
      { e:'troubled', t:'ここで悩む時間、あたしはけっこう好き(´ー`*)ｳﾝｳﾝ' },
    ],
    pickSlot: [
      { e:'wink',    t:'零・近・中・遠、それぞれ得意な子がいるんだ♪' },
      { e:'happy',   t:'前に出るか、後ろで支えるか。性格が出るよね|･ω･`)ﾌﾑﾌﾑ' },
      { e:'normal',  t:'敵の間合いを見てから決めても遅くないよ。' },
      { e:'excited', t:'ぴったりハマったときの火力、まぢ気持ちいい(´ー`*)ｳﾝｳﾝ' },
      { e:'troubled', t:'苦手な距離に置くと伸び悩むから、そこだけ気をつけて。' },
    ],
    pickTeaching: [
      { e:'happy',   t:'今のバトルを乗り切るなら、効果の広いやつが安心だよ♪' },
      { e:'normal',  t:'先を見るなら、同じ教えを重ねる形が伸びるね。' },
      { e:'wink',    t:'ガッツと相談しながら選ぶと、失敗しにくいよ！' },
      { e:'excited' , t:'噛み合ったときのコンボ、見てて楽しいんだよね(´ー`*)ｳﾝｳﾝ' },
      { e:'troubled', t:'欲張りすぎると持て余すから、ほどほどが吉かも。' },
    ],
    rewardPick: [
      { e:'wink',    t:'ライフを厚くしておくと、後半がぐっとラクになるよ♪' },
      { e:'normal',  t:'ちからに寄せると、短いターンで倒しきれるようになるね。' },
      { e:'happy',   t:'その時いちばん困ってるところを埋めるのが正解だと思う！' },
      { e:'excited', t:'ここで伸ばしたぶんは、このプレイ中ずっと効いてくるよ！' },
      { e:'troubled', t:'2つとも同じにするか散らすか…毎回まよっちゃうよね( ˙-˙ )' },
    ],
    skipPick: [
      { e:'happy',   t:'育てたい子を勇者モンにすると、絆経験値がしっかり入るよ♪' },
      { e:'normal',  t:'供モンにもちゃんと分けて入るから、3枠とも埋めておこ。' },
      { e:'wink',    t:'報酬方針が「育成」のときだけ使えるやつだよ！' },
      { e:'excited', t:'まとめ使いで一気にレベル上げるの、けっこう快感(´ー`*)ｳﾝｳﾝ' },
      { e:'troubled', t:'マスモン登録はできないから、そこだけ覚えといてね。' },
    ],
    skipResult: [
      { e:'wink',    t:'絆レベルの伸びも見てみて♪ 強化ポイントが増えてるかも！' },
      { e:'excited', t:'この勢いで、次の難易度に手が届きそうぢゃんw' },
      { e:'normal',  t:'チケットの残りも見ておくと、使いどころを決めやすいよ。' },
      { e:'happy',   t:'コツコツ育てた子が伸びると、うれしくなっちゃうね(´ー`*)ｳﾝｳﾝ' },
      { e:'troubled', t:'スコアは出ないから、記録を狙うときは普通に戦お！' },
    ],
    ultimateDifficulty: [
      { e:'normal',  t:'長引くほど不利になるから、短期決戦の組み方が要るよ。' },
      { e:'wink',    t:'距離を散らしておくと、DISTANCE BREAKで慌てずに済むよ♪' },
      { e:'excited', t:'ここを越えた人だけが、その先を見られるんだ( ˙-˙ )' },
      { e:'troubled', t:'加入ボーナスも下がるから、序盤のWAVEが勝負どころかも。' },
      { e:'surprise', t:'×35って…もう数字の意味がわかんなくなってきた笑' },
    ],
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

// ---------- ドラ・全画面の基本セリフ(2026-09-17) ----------
// 2026-09-17・ユーザーから本人の会話ログを受け取って口調を寄せた。
// 一度まるごと関西弁で書いたら「こんなに関西弁じゃない / ある部分だけ関西弁まじり」と
// 指摘されたので、**標準語を土台にして、要所だけ関西弁が混じる**形へ直した。
//
// 【土台は標準語のくだけた男性口調】
//   「〜だよ」「〜だな」「〜と思う」「〜かな」「〜てほしい」
//   ログでも地の文はこちらが多い(「あれはただ褒めて欲しいんだよ」「まともじゃない人のが多いよ」)
//
// 【関西弁が出るのは、この3つのとき】
//   ① 納得・断定   「〜やな」「〜やなぁ」「〜や」「せやなぁ」「たしかに」
//   ② ツッコミ     「なんでや！？」「なにがやねん」「は？」
//   ③ 感情が乗る   「むかつくわぁ」「しゃーない」「〜やで」
//
// 【どの文にも出る癖】
//   ・語尾の「〜わ」「〜わぁ」「〜な」「〜からな」「〜よな」「〜しな」
//   ・短い相槌。「ふむ」「なるほど」「たしかに」「はい！」
//   ・笑いは「くさ」、照れ隠しと語尾は「えへへ」
//   ・自虐とかまってほしさが同居する
//   ・茶化すが、相手が本当に困っている場面では急にまっすぐ気遣う
//   ・一人称は「おで」(2026-09-17のユーザー指示で固定。実物は「ワイ」「俺」)
//
// 【入れないもの】
//   ・下ネタ・性的な話題。実物の会話にはあるが、このゲームは全年齢向け
//   ・実在の第三者への批評、実在の人名
addAssistantLinePack({
  id: 'draCore',
  assistantId: 'dra',
  label: 'ドラ・全画面の基本セリフ',
  lines: {
    // ---- HOME・日次 ----
    home: [
      { e:'normal',   t:'今日もぼちぼちやるか。無理してもしゃーないからな' },
      { e:'happy',    t:'{name}、来たな。おではだいたいここにいるわ' },
      { e:'normal',   t:'やることに迷ったら、ミッションでも見てみ。だいたい道しるべになるよ' },
      { e:'wink',     t:'何から始める？ おでに聞いてくれてもいいからな。膝以外も役に立つで' },
      { e:'happy',    t:'毎日ちょっとずつでいいんだよ。おでもそうやってゲーム作ってる' },
      { e:'troubled', t:'……なんか今日、膝が重いわぁ。気のせいかな' },
    ],
    dailyMasuAdvice: [
      { e:'happy',    t:'マスモンを早く増やしたいんだろ？ いい方法があるわ' },
      { e:'normal',   t:'クイックのBeginnerでWAVE2まで行って、そこで「あきらめる」を押す' },
      { e:'wink',     t:'WAVE2まで行くのが条件な。そこだけ間違えるなよ' },
      { e:'happy',    t:'{name}、時間ないときはこれでいいよ。効率って大事やからな' },
      { e:'normal',   t:'おでが見つけたわけじゃないけどな。えへへ' },
    ],
    onboarding: [
      { e:'happy',    t:'おではドラ。助手ってことになってるけど、まあ気楽にやってくれ' },
      { e:'normal',   t:'{name}、まずは名前とアイコンからだな。あとで変えられるから悩まんでいいよ' },
      { e:'wink',     t:'分からんことがあったら、おでの吹き出しを押してくれ' },
      { e:'happy',    t:'一緒にモンスター育てていこうな。えへへ' },
      { e:'normal',   t:'焦らんでいいんだよ。おでもゲーム作るとき、そんな感じやからな' },
    ],
    // ---- バトル ----
    battleChallenge: [
      { e:'normal',   t:'スコアで競うならチャレンジだな。上のランキングも見てみ' },
      { e:'happy',    t:'{name}、記録に残るのはここのぶんだからな' },
      { e:'wink',     t:'難易度を上げると点も伸びるわ。届きそうなとこから上げてけ' },
      { e:'normal',   t:'編成を変えるだけで急に通ることもあるよな' },
      { e:'happy',    t:'気負わんでいい。負けても減るもんはないからな' },
    ],
    battleQuick: [
      { e:'happy',    t:'サクッとやるならこれだな。テンポが早いわ' },
      { e:'normal',   t:'{name}、育成の回転はこっちが速い。数をこなしたいときに使え' },
      { e:'wink',     t:'∞周回にすると裏で回り続けるで。待ってるあいだモンビーでもやっとけ' },
      { e:'normal',   t:'記録はチャレンジと別枠だから、気楽にやっていいよ' },
      { e:'happy',    t:'おでもこういう、ながらでできるやつ好きやな' },
    ],
    battlePro: [
      { e:'normal',   t:'ここはベースモンだけの世界な。育てた子は連れていけない' },
      { e:'happy',    t:'{name}、腕の見せどころだな' },
      { e:'wink',     t:'素の性能だけで組むから、いつもの感覚だと足元すくわれるわ' },
      { e:'normal',   t:'距離と相性はちゃんと見ろよ。ここはごまかしが効かん' },
      { e:'troubled', t:'おでは何回かここで心を折られてる。えへへ……' },
    ],
    battleHelp: [
      { e:'normal',   t:'迷ったらまず解析な。敵の必殺技が読めるんだよ' },
      { e:'happy',    t:'{name}、読めてから動くだけでだいぶ変わるわ' },
      { e:'wink',     t:'カードの色で役割が分かる。赤が攻撃、緑が守り、みたいにな' },
      { e:'normal',   t:'距離が合ってないと威力が落ちるで。そこだけは覚えとけ' },
      { e:'happy',    t:'説明を読むのは遠回りに見えて近道やな' },
    ],
    pickHero: [
      { e:'normal',   t:'最初の1体は効いてくるわ。勇者特性をちゃんと見ろ' },
      { e:'happy',    t:'{name}、好きな子でいいんだよ。愛着って地味に強いからな' },
      { e:'wink',     t:'迷ったら守りが堅いやつにしとくと事故りにくいわ' },
      { e:'normal',   t:'特性は全部のWAVEに効くからな。ここだけは適当に選ぶなよ' },
      { e:'happy',    t:'おでなら見た目で選ぶけどな。えへへ' },
    ],
    pickSlot: [
      { e:'normal',   t:'敵と同じ距離から殴ると強いんだよ。そこ合わせろ' },
      { e:'happy',    t:'{name}、並びで戦いやすさが変わるからな' },
      { e:'wink',     t:'前が薄いと一気に崩れるわ。おでの膝みたいにな' },
      { e:'normal',   t:'あとから入れ替えるのは大変だから、ここでちゃんと考えとけ' },
      { e:'happy',    t:'悩むのが楽しいとこでもあるよな' },
    ],
    pickAlly: [
      { e:'happy',    t:'仲間が増えるな。どの子にする？' },
      { e:'normal',   t:'{name}、手薄な距離を埋めるやつを取ると安定するわ' },
      { e:'wink',     t:'同じ役割ばっかり集めると、そこ以外で詰むからな' },
      { e:'normal',   t:'あとのWAVEを見越して選ぶと楽になるで' },
      { e:'happy',    t:'好きな子を取るのもアリだけどな。えへへ' },
    ],
    pickProAllies: [
      { e:'normal',   t:'ここで組んだ面子で最後まで行くんだよ。慎重にな' },
      { e:'happy',    t:'{name}、距離のばらけ方を見とけ' },
      { e:'wink',     t:'尖った編成は気持ちいいけど、こけると早いわ' },
      { e:'normal',   t:'補い合える組み合わせのほうが、結局遠くまで行けるよな' },
      { e:'troubled', t:'おでは毎回ここで20分くらい唸ってる' },
    ],
    pickTeaching: [
      { e:'normal',   t:'教えは後半に効いてくるやつが多いわ' },
      { e:'happy',    t:'{name}、いま困ってることを埋めるやつを取るといいよ' },
      { e:'wink',     t:'欲張って全部は取れないからな。優先順位やな' },
      { e:'normal',   t:'重ねて取ると強くなるやつもあるで' },
      { e:'happy',    t:'おでの緑膝もそこに混じってるらしい。なんでやろな' },
    ],
    rewardPick: [
      { e:'happy',    t:'WAVEクリアおつかれ。トレーニングを2つえらべ' },
      { e:'normal',   t:'{name}、いま足りてないところを伸ばすのが基本だな' },
      { e:'wink',     t:'攻撃ばっかり上げると、殴られて終わるわ' },
      { e:'normal',   t:'あとのWAVEで何が来るか考えて選ぶといいよ' },
      { e:'happy',    t:'ここの積み重ねが最後に効くからな' },
    ],
    skipPick: [
      { e:'normal',   t:'チケットで一気に育てられるんだよ。枚数も選べる' },
      { e:'happy',    t:'{name}、時間ないときはこれでいい' },
      { e:'wink',     t:'ただしランキングには載らんからな。そこだけ承知で' },
      { e:'normal',   t:'難易度の高いチケットのほうが実入りはいいわ' },
      { e:'happy',    t:'遊び方は自由やからな。えへへ' },
    ],
    skipResult: [
      { e:'excited',  t:'受け取り完了な。一気に育ったやん' },
      { e:'happy',    t:'{name}、楽して伸ばすのも立派な戦略だよ' },
      { e:'normal',   t:'この記録はランキングには送られてない。自己ベストもそのままだな' },
      { e:'wink',     t:'貯め込んだチケットは使ってこそやで' },
      { e:'happy',    t:'おでも今度やってみるわ' },
    ],
    // ---- 極限・種族チャレンジ ----
    extremeChallenge: [
      { e:'normal',   t:'ここから先は極限な。チャレンジよりだいぶ手強いわ' },
      { e:'happy',    t:'{name}、いけると思ったら行ってみ' },
      { e:'wink',     t:'一段ずつ開いていくから、焦らんでいいよ' },
      { e:'normal',   t:'記録は難易度ごとに別々に残るからな' },
      { e:'troubled', t:'おでは上のほうで毎回すり潰されてる。えへへ' },
    ],
    extremeDifficulty: [
      { e:'normal',   t:'難易度えらびだな。届きそうなとこから上げてけ' },
      { e:'happy',    t:'{name}、無理そうなら下げていい。恥ずかしくないからな' },
      { e:'wink',     t:'上に行くほど敵が硬くなるわ。準備してから来い' },
      { e:'normal',   t:'クリアした組み合わせごとに記録が残るで' },
      { e:'happy',    t:'ひとつ上がるたびに世界が変わるよな' },
    ],
    nightmareDifficulty: [
      { e:'normal',   t:'ナイトメアな。ここから本気で組まんと通らんわ' },
      { e:'happy',    t:'{name}、編成を見直してから来るといいよ' },
      { e:'wink',     t:'なんとなくで行くと、なんとなく負けるからな' },
      { e:'normal',   t:'教えの取り方で通り方が変わるで' },
      { e:'troubled', t:'おでは初見で溶けた。えへへ……' },
    ],
    chaosDifficulty: [
      { e:'normal',   t:'カオスな。敵の圧が一段違うわ' },
      { e:'happy',    t:'{name}、守りを厚くしとくと粘れるで' },
      { e:'wink',     t:'一撃で持っていかれる場面があるから、解析はサボるなよ' },
      { e:'normal',   t:'ここは事故を減らすのが勝ち筋やな' },
      { e:'happy',    t:'通ったときは気持ちいいわ' },
    ],
    ultimateDifficulty: [
      { e:'normal',   t:'アルティメットか。ここまで来たらもう相当なもんだな' },
      { e:'happy',    t:'{name}、おで普通に尊敬するわ' },
      { e:'wink',     t:'細かい積み重ねが全部効いてくる。手を抜くとこが無いんだよ' },
      { e:'normal',   t:'負けても学べるからな。次に持っていけ' },
      { e:'troubled', t:'おでは見てるだけにしとくわ。膝が笑ってる' },
    ],
    infinityDifficulty: [
      { e:'normal',   t:'インフィニティな。もう終わりが無い世界やな' },
      { e:'happy',    t:'{name}、どこまで行けるか試してみ' },
      { e:'wink',     t:'長丁場になるから、無理せんとこで切り上げてもいいよ' },
      { e:'normal',   t:'到達したところまでがちゃんと記録に残るで' },
      { e:'happy',    t:'おでは3分で音を上げたわ。えへへ' },
    ],
    godDifficulty: [
      { e:'normal',   t:'ゴッドか。名前のとおりだな' },
      { e:'happy',    t:'{name}、ここに挑む時点でおでより上やで' },
      { e:'wink',     t:'運も絡むから、駄目な日は駄目なんだよ。気にするな' },
      { e:'normal',   t:'準備を全部そろえてから来い。行き当たりばったりは通らんわ' },
      { e:'troubled', t:'おでは名前を見た時点で帰った' },
    ],
    ragnarokDifficulty: [
      { e:'normal',   t:'ラグナロクか。ここまで来る人、そうそういないよな' },
      { e:'happy',    t:'{name}、もう説明することないわ。好きにやってくれ' },
      { e:'wink',     t:'おでが言えるのは「無理はするな」くらいだな' },
      { e:'normal',   t:'届かなくても、そこまで積んだもんは消えんからな' },
      { e:'excited',  t:'通ったら教えてくれ。おで本気で祝うわ' },
    ],
    speciesChallenge: [
      { e:'normal',   t:'ひとつの種族だけで10WAVEな。しばりプレイだよ' },
      { e:'happy',    t:'{name}、育ててる種族から挑むと入りやすいわ' },
      { e:'wink',     t:'普段の編成が使えんから、そこが面白いとこやな' },
      { e:'normal',   t:'はじめてクリアした組み合わせでは、その種族の超越の実がもらえるで' },
      { e:'happy',    t:'記録は種族ごとに別々だから、いつものぶんは変わらんよ' },
    ],
    // ---- モンビー(モンヒロビート) ----
    rhythmHome: [
      { e:'happy',    t:'お、モンビーやる？ 「もう一つの世界へ」もよろしくな。えへへ' },
      { e:'normal',   t:'曲えらんで、難易度えらんで、決定。それだけだよ' },
      { e:'wink',     t:'{name}、どれにする？ 迷ったら聴きながら決めればいいわ' },
      { e:'normal',   t:'難しいと思ったら、オプションでノーツ速度いじっていいからな。恥ずかしいことちゃう' },
      { e:'happy',    t:'おでは作るほうが専門だけど、叩くのも普通に楽しいわ' },
    ],
    rhythmWeeklyEvent: [
      { e:'happy',    t:'イベントだな。対象の曲で、その期間に出した点だけで競うんだよ' },
      { e:'normal',   t:'部門は曲ごとと、ぜんぶの合計。1曲しか遊んでなくても合計には載るで' },
      { e:'normal',   t:'難易度はどれでもいい。得意なやつで出した点がそのまま載るわ' },
      { e:'wink',     t:'{name}、気楽にやりゃいいんだよ。ビートPは順位と関係なく貯まるからな' },
      { e:'happy',    t:'残り時間は上に出てる。終わったらそこで締め切りやな' },
    ],
    rhythmHelp: [
      { e:'normal',   t:'遊びかたはここに全部書いてあるで' },
      { e:'happy',    t:'{name}、困ったらいつでも見にこい' },
      { e:'wink',     t:'判定とかノーツの種類とか、知っとくと急に楽になるんだよ' },
      { e:'normal',   t:'設定の話もここな。速度と音のずれは早めに合わせとけ' },
      { e:'happy',    t:'おでも作るとき、こういうの読み込んだからな' },
    ],
    rhythmHistory: [
      { e:'normal',   t:'終わった週間ランキングとイベントの順位を、あとから見られるわ' },
      { e:'happy',    t:'{name}、自分がどのへんにいたか残るのは嬉しいもんだよな' },
      { e:'wink',     t:'前回より上がってたら、それはちゃんと成長やで' },
      { e:'normal',   t:'終わった回の記録は変わらんから、落ち着いて見ていい' },
      { e:'happy',    t:'積み上がってくのを見るの、おで好きやな' },
    ],
    rhythmMonsters: [
      { e:'normal',   t:'ここで決めた子が、曲の途中で金のノーツになって出てくるわ' },
      { e:'happy',    t:'{name}、お気に入りを入れとくと楽しいで' },
      { e:'wink',     t:'叩けると気持ちいいから、見やすい子にするのもアリだな' },
      { e:'normal',   t:'スコアには影響せん。完全に趣味の枠な' },
      { e:'happy',    t:'おでの顔は出せんのかな。えへへ' },
    ],
    quickRhythmIntro: [
      { e:'happy',    t:'∞周回にしたな。このままモンビーで遊べるで' },
      { e:'normal',   t:'{name}、周回は裏で続くから、待ってるあいだに1曲どうだ' },
      { e:'wink',     t:'戻りたくなったら左上の「戻る」でいつでも戻れるわ' },
      { e:'normal',   t:'裏で回せるのはクイックの∞周回だけな。ほかは記録が絡むからな' },
      { e:'happy',    t:'ながらで進むの、効率よくて好きやな' },
    ],
    quickRhythmBackground: [
      { e:'happy',    t:'ここにいるあいだも周回は進んでるで' },
      { e:'normal',   t:'{name}、演奏中だけは止まるわ。叩き終わればその曲のぶんが入る' },
      { e:'wink',     t:'上の帯を押すと、何周めか見られるで' },
      { e:'normal',   t:'アプリを閉じるとそこで止まるからな。そこだけ注意な' },
      { e:'happy',    t:'二度おいしいってやつやな。えへへ' },
    ],
    autoQuickRunSettings: [
      { e:'normal',   t:'自動で回す設定な。自分のやりやすい形にしとけ' },
      { e:'happy',    t:'{name}、演出を切ると速く回るで' },
      { e:'wink',     t:'見たいとこだけ残すのがちょうどいいわ' },
      { e:'normal',   t:'重いと思ったら軽くしろ。端末にやさしくな' },
      { e:'happy',    t:'おではだいたい全部切ってる' },
    ],
    // ---- 育成・管理 ----
    mbManagement: [
      { e:'normal',   t:'編成もベースモンもマスモンも、ここから見られるわ' },
      { e:'happy',    t:'{name}、迷ったらここに戻ってくればいいよ' },
      { e:'wink',     t:'育てた子の確認はこまめにな。伸びしろに気づくで' },
      { e:'normal',   t:'種類の基本がベースモン、育てた個体がマスモンな' },
      { e:'happy',    t:'整理されてると気持ちいいよな' },
    ],
    roster: [
      { e:'happy',    t:'編成だな。誰を連れていく？' },
      { e:'normal',   t:'{name}、距離のばらけ方だけは見とけ' },
      { e:'wink',     t:'同じ役割で固めると、そこ以外で詰むからな' },
      { e:'normal',   t:'絆が高い子は素の強さ以上に働くわ' },
      { e:'happy',    t:'好きな子を入れるのも、ちゃんとした理由やで' },
    ],
    monsterList: [
      { e:'normal',   t:'ベースモンが種類の基本、マスモンが育てた個体な' },
      { e:'happy',    t:'{name}、集まってくると眺めるだけで楽しいわ' },
      { e:'wink',     t:'血統を見ると、伸びる方向が分かるんだよ' },
      { e:'normal',   t:'並べ替えると探しやすいで' },
      { e:'happy',    t:'おでもコレクション癖あるからな。分かるわ' },
    ],
    masuList: [
      { e:'happy',    t:'育てた子が並んでるな。いい眺めだわ' },
      { e:'normal',   t:'{name}、育ってない子も腐らせるなよ' },
      { e:'wink',     t:'絆Lvが上がると、できることが増えるんだよ' },
      { e:'normal',   t:'お気に入りは牧場に出しとくといいで' },
      { e:'happy',    t:'手をかけたぶんはちゃんと返ってくるからな' },
    ],
    masuEnhance: [
      { e:'normal',   t:'ポイントは適性か能力値に使えるわ' },
      { e:'happy',    t:'{name}、伸ばしたい方向を決めてから振れよ' },
      { e:'wink',     t:'器用貧乏になると、どこでも中途半端になるからな' },
      { e:'normal',   t:'振り直しは簡単じゃないから、落ち着いて決めろ' },
      { e:'troubled', t:'おでは勢いで振って後悔するタイプや。真似すんなよ' },
    ],
    masuAutoEnhance: [
      { e:'normal',   t:'決めとけば、ポイントが入るたびにおでが振っといてやるわ' },
      { e:'happy',    t:'{name}、いちいち画面を開かんで済むんだよ' },
      { e:'wink',     t:'方針だけ決めときゃいい。あとは任せろ' },
      { e:'normal',   t:'途中で気が変わったら、いつでも変えていいで' },
      { e:'happy',    t:'楽できるとこは楽していいんだよ。えへへ' },
    ],
    monsterDex: [
      { e:'happy',    t:'図鑑だな。血統まで全部載ってるで' },
      { e:'normal',   t:'{name}、埋まってくると嬉しいもんだろ' },
      { e:'wink',     t:'見たことない子を探すのも楽しいわ' },
      { e:'normal',   t:'血統をたどると、育て方の見当がつくで' },
      { e:'happy',    t:'おでもこういうの全部埋めたくなるわ' },
    ],
    temple: [
      { e:'normal',   t:'再生・合体・寄付な。今日はどれだ' },
      { e:'happy',    t:'{name}、どれも戻せないやつがあるから、確認してから押せよ' },
      { e:'wink',     t:'迷ったら今日はやらん、でいいんだよ' },
      { e:'normal',   t:'合体は「主」が残って「副」が消える。そこ間違えるなよ' },
      { e:'troubled', t:'おでは一回、間違えて大事な子を溶かしてる……' },
    ],
    fusion: [
      { e:'normal',   t:'「主」が残って「副」は消えるからな。ちゃんと確認しろ' },
      { e:'happy',    t:'{name}、落ち着いて、もう一回見てからな' },
      { e:'wink',     t:'消えるほうを間違えると戻せんからな。マジで' },
      { e:'normal',   t:'受け継ぐものを見てから決めるといいで' },
      { e:'troubled', t:'おでの失敗談、さっきしたっけ。えへへ……' },
    ],
    rebirth: [
      { e:'happy',    t:'上限まで育てたごほうびだな' },
      { e:'normal',   t:'{name}、ここからさらに伸びるで' },
      { e:'wink',     t:'積み上げた時間がちゃんと形になるんだよ' },
      { e:'normal',   t:'条件を満たした子だけができるやつな' },
      { e:'happy',    t:'こういう区切り、おで好きやな' },
    ],
    transcendence: [
      { e:'normal',   t:'Lv400まで育てた子だけが行ける、限界の先な' },
      { e:'happy',    t:'{name}、そこまで育てたのがもう偉いわ' },
      { e:'wink',     t:'超越の実が要るからな。集めてから来い' },
      { e:'normal',   t:'ここまで来ると、もう別の生きものやで' },
      { e:'excited',  t:'おで、こういうの見るの好きなんだよ' },
    ],
    reincarnate: [
      { e:'normal',   t:'Lv.100まで育てた子だけの特別なやつな' },
      { e:'happy',    t:'{name}、育て直すぶん強くなるで' },
      { e:'wink',     t:'一度リセットされるから、覚悟してから押せよ' },
      { e:'normal',   t:'受け継ぐものと失うものを見てから決めろ' },
      { e:'happy',    t:'長く付き合う子ほど効いてくるわ' },
    ],
    donation: [
      { e:'troubled', t:'寄付したマスモンは戻ってこんぞ。ほんまに戻せん' },
      { e:'normal',   t:'{name}、もう一回だけ考えてくれ' },
      { e:'wink',     t:'迷ってるなら今日はやめとけ。明日でもできるからな' },
      { e:'normal',   t:'決めたなら止めはせん。ちゃんと見返りはあるわ' },
      { e:'troubled', t:'おでは押す前に必ず一回閉じる。えへへ' },
    ],
    pasture: [
      { e:'happy',    t:'お気に入りを5体までHOMEに出せるで' },
      { e:'normal',   t:'{name}、見てると和むんだよ' },
      { e:'wink',     t:'強さと関係ないとこだからこそ、好みで選べばいいわ' },
      { e:'normal',   t:'いつでも入れ替えられるからな' },
      { e:'happy',    t:'おでも並びたいけど、おでは助手やからな' },
    ],
    // ---- マーケット・所持品 ----
    market: [
      { e:'normal',   t:'使いすぎるなよ。おでみたいに後で泣くで' },
      { e:'happy',    t:'{name}、何か狙ってるのあるん？ 先に値段だけ見とくのもアリだな' },
      { e:'normal',   t:'ダイヤは戻ってこんからな。迷ったら一回離れて考えていいよ' },
      { e:'wink',     t:'ビートPの交換所もここな。イベントで貯めたやつ、寝かせとくと忘れるわ' },
      { e:'happy',    t:'必要なもんから買え。かっこいいから買う、はおでの悪い癖' },
    ],
    inventory: [
      { e:'normal',   t:'持ちもんの確認な。使わないまま溜め込むやつ、けっこういるんだよ' },
      { e:'happy',    t:'{name}、いいの持ってるやん。使ってこそだからな' },
      { e:'wink',     t:'とっておきは、とっておきすぎると出番が来ないまま終わるわ' },
      { e:'normal',   t:'どれが何に効くか分からんくなったら、押して説明を読めばいい' },
      { e:'troubled', t:'おでも昔、いい実を3年くらい寝かせたことある。えへへ……' },
    ],
    // ---- リザルト ----
    resultWin: [
      { e:'excited',  t:'おお、やるな。おで普通に感心したわ' },
      { e:'happy',    t:'{name}、いい流れだな。この調子でいけ' },
      { e:'normal',   t:'勝ったときこそ、何が効いたか覚えとくといいで' },
      { e:'wink',     t:'おでの出番、なかったな。まあいいか。えへへ' },
      { e:'happy',    t:'ちゃんと強くなってるわ。前より動きがいいよな' },
    ],
    resultLose: [
      { e:'normal',   t:'まあまあ。次やりゃいいんだよ' },
      { e:'troubled', t:'{name}、落ち込むなって。おでなんか膝で負けてるからな' },
      { e:'normal',   t:'どこで崩れたかだけ覚えとけ。それだけで次は変わるわ' },
      { e:'happy',    t:'一回休んでもいい。焦ってやると同じとこでコケるからな' },
      { e:'normal',   t:'編成をちょっと変えるだけで急に通ることもあるで。試してみ' },
    ],
    resultRetire: [
      { e:'normal',   t:'やめどきを決められるのは強さやで。おでは真面目にそう思う' },
      { e:'happy',    t:'{name}、引き際うまいやん' },
      { e:'wink',     t:'また来りゃいい。逃げてない、切り上げただけだからな' },
      { e:'normal',   t:'途中までのぶんはちゃんと残るわ。無駄にはならん' },
      { e:'troubled', t:'おでも昔、粘りすぎて全部溶かしたことある……' },
    ],
    // ---- ランキング・記録 ----
    ranking: [
      { e:'normal',   t:'全国のやつな。上を見ると果てしないけど、参考にはなるわ' },
      { e:'happy',    t:'{name}、自分の記録が載ってるか見てみ。けっこう嬉しいで' },
      { e:'wink',     t:'順位は気にしすぎるなよ。おでなんか膝の順位なら1位やけどな' },
      { e:'normal',   t:'イベントのタブは、その期間に出した記録だけで別に並ぶんだよ' },
      { e:'happy',    t:'上のやつの編成を見ると、だいたい何が強いか分かるよな' },
    ],
    rankingParty: [
      { e:'normal',   t:'この人が使ってた編成な。染めた色もそのまま出てるわ' },
      { e:'happy',    t:'{name}、強い人の組み方は素直に参考になるんだよ' },
      { e:'wink',     t:'真似から入るの、恥ずかしいことちゃうからな' },
      { e:'normal',   t:'距離の埋め方を見るといいで' },
      { e:'happy',    t:'おでもよそのゲーム見て勉強してるわ' },
    ],
    profile: [
      { e:'normal',   t:'{name}の記録な。ここ見てると伸びてるのが分かるわ' },
      { e:'happy',    t:'名前もアイコンも、あとからいくらでも変えられるからな' },
      { e:'wink',     t:'助手もここで変えられる。おでを選ぶかはまあ、好みやな。えへへ' },
      { e:'normal',   t:'イベントの話も、ここの回想からいつでも見返せるで' },
      { e:'happy',    t:'仲良し度は助手ごとに別々に貯まる。切り替えても消えんから安心しろ' },
    ],
    // ---- ミッション・ギフト ----
    missionsNormal: [
      { e:'normal',   t:'ミッションな。やることに迷ったら、ここから拾えばいいんだよ' },
      { e:'happy',    t:'{name}、ついでに終わるやつが混じってるからな。見とくと得やで' },
      { e:'wink',     t:'受け取り忘れがいちばんもったいないわ。おでがよくやるやつ' },
      { e:'normal',   t:'週のぶんは月曜に切り替わる。終わりそうなやつから片づけろ' },
      { e:'happy',    t:'焦らんでいい。溜めといて一気に受け取るのも気持ちいいよな' },
    ],
    missionsClaimable: [
      { e:'excited',  t:'お、受け取れるやつ溜まってるで！ 早く押せ押せ' },
      { e:'happy',    t:'{name}、これ全部もらえるからな。えへへ' },
      { e:'wink',     t:'こういうの放っとくと忘れるんだよ。おでみたいにな' },
      { e:'normal',   t:'受け取ってから次のやつを狙うと効率いいわ' },
      { e:'happy',    t:'いい仕事したやん。ちゃんと貰っとけ' },
    ],
    giftClaimable: [
      { e:'excited',  t:'ギフト届いてるで。開けてみ' },
      { e:'happy',    t:'{name}、中身なんだろな。おでもちょっと気になるわ' },
      { e:'normal',   t:'受け取るとアイテム欄へ入る。期限は無いけど、忘れんうちにな' },
      { e:'wink',     t:'イベントの報酬もここへ届くんだよ' },
      { e:'happy',    t:'もらえるもんはもらっとけ。えへへ' },
    ],
    giftEmpty: [
      { e:'normal',   t:'いまは未受取なしだな。きれいなもんやで' },
      { e:'happy',    t:'{name}、ちゃんと受け取ってて偉いわ' },
      { e:'wink',     t:'おでみたいに溜め込まんのが一番なんだよ' },
      { e:'normal',   t:'イベントの報酬もここに届くからな' },
      { e:'happy',    t:'また何か来たら教えるわ' },
    ],
    // ---- ヘルプ・設定 ----
    helpTop: [
      { e:'normal',   t:'分からんことがあったら、だいたいここに書いてあるわ' },
      { e:'happy',    t:'{name}、遠慮せず読め。読んだほうが早いことって多いんだよ' },
      { e:'wink',     t:'おでも自分のゲーム作るとき、説明書いてて気づくこと多いからな' },
      { e:'normal',   t:'カテゴリから項目を選ぶと、細かい話まで出てくるで' },
      { e:'happy',    t:'それでも分からんかったら、おでの吹き出しを押してくれ' },
    ],
    settings: [
      { e:'normal',   t:'設定な。音とか表示とか、自分がやりやすいようにしろ' },
      { e:'happy',    t:'{name}、BGMは曲ごとに選べるで。好きなやつに変えていい' },
      { e:'wink',     t:'重いと思ったら軽くする設定もあるわ。無理して飾らんでいいんだよ' },
      { e:'normal',   t:'データの引き継ぎもここな。機種変える前にやっとけよ' },
      { e:'troubled', t:'おでは設定をいじりすぎて元に戻せなくなるタイプ。気をつけろ' },
    ],
  },
});

// これまでの記録(2026-09-13・ユーザー依頼「モンビーのイベントや週間ランキングの
// 終わったものをヒストリー的に見れる機能」)。プロフィールから入る一覧の案内。
addAssistantLinePack({
  id: 'rhythmHistory',
  label: 'モンヒロビート・これまでの記録',
  lines: {
    rhythmHistory: [
      { e:'normal',  t:'終わった週間ランキングとイベントの順位を、あとから見られるよ。' },
      { e:'happy',   t:'見たい回をえらぶと、そのときの順位を数え直して出すね♪' },
      { e:'normal',  t:'ここは見るだけの場所だよ。報酬の受け取りはここではできないの。' },
      { e:'wink',    t:'先週どれくらいだったっけ( \'ω\')? っていうときに覗いてみて。' },
      { e:'excited', t:'自分の記録が残ってると、続けてきたんだなーって思うよね(´ー`*)ｳﾝｳﾝ' },
    ],
  },
});

// 同じ場面の「きき」のぶん。場面を足したときに片方だけになっていると、
// ききを選んでいる人にみゅあのセリフが出てしまう(2026-09-14・assistant-bond-check が検出)。
addAssistantLinePack({
  id: 'kikiRhythmHistory',
  assistantId: 'kiki',
  label: 'きき・モンヒロビート・これまでの記録',
  lines: {
    rhythmHistory: [
      { e:'normal',  t:'終わった週間ランキングとイベントの順位を、あとから見られまつ。' },
      { e:'normal',  t:'見たい回をえらぶと、そのときの順位を数え直して出しまつ。' },
      { e:'normal',  t:'ここは見るだけの場所でつ。報酬の受け取りは、ここではできません。' },
      { e:'wink',    t:'「先週はどれくらいだったかな」と思ったときに、開いてみるといいでつよ♪' },
      { e:'happy',   t:'記録が並んでいると、続けてきたことがそのまま見えまつね。' },
      { e:'happy',   t:'{name}の積み重ねが残る場所でつ。たまに眺めるのも、いいものでつよ。' },
    ],
  },
});

// ===== ドラ・バリエーション追加(2026-09-18) =====
// みゅあ・きき・ももすけを増やしたときは「ドラはそのまま」との指示だったが、
// あらためて「ドラも増やすのは進めていい」と言われたので同じ形で足す。全場面へ3本ずつ。
// 口調は上の draCore と同じ決まりごと(標準語が土台／関西弁は納得・ツッコミ・感情のときだけ／
// 語尾の「〜わ」「〜な」「〜からな」／一人称は「おで」)。関西弁は180本中12本にとどめた。
addAssistantLinePack({
  id: 'draVariety',
  assistantId: 'dra',
  label: 'ドラ・バリエーション追加',
  lines: {
    quickRhythmIntro: [
      { e:'normal',  t:'周回は裏で続くから、ここで遊んでていいよ' },
      { e:'normal',  t:'戻るのは左上な。いつでも帰ってこれる' },
      { e:'normal',  t:'アプリ閉じたら止まるからな。そこだけ覚えといて' },
    ],
    quickRhythmBackground: [
      { e:'happy',   t:'いま叩いてるあいだも、ちゃんと数は増えてるよ' },
      { e:'normal',  t:'演奏中だけは止まるけどな。誤差みたいなもんや' },
      { e:'normal',  t:'上の帯を押すと、何周めか見られるわ' },
    ],
    autoQuickRunSettings: [
      { e:'normal',  t:'一回決めときゃ、次からは押すだけだよ' },
      { e:'normal',  t:'決めてなかったら直前の編成をそのまま使うからな' },
      { e:'normal',  t:'まだ開いてない難易度は選べん。そこだけ注意な' },
    ],
    rhythmHome: [
      { e:'normal',  t:'同じ曲でも難易度が変わると別モノに感じるよな' },
      { e:'happy',   t:'知らん曲から入るのもいいと思う。おでもそうだった' },
      { e:'normal',  t:'ノーツ速度は慣れてから上げりゃいい' },
    ],
    rhythmHelp: [
      { e:'normal',  t:'判定の幅まで数字で書いてあるよ' },
      { e:'normal',  t:'分からん言葉が出たら、まずここを見たほうが早いな' },
      { e:'happy',   t:'読んでも分からんかったら1回やってみ。そのほうが早いわ' },
    ],
    rhythmWeeklyEvent: [
      { e:'normal',  t:'イベントの記録は、いつもの週間とは別に数えるからな' },
      { e:'happy',   t:'対象曲はビートPが多めに入るで' },
      { e:'normal',  t:'順位が出るのは終わったあと。急がんでいい' },
    ],
    rhythmHistory: [
      { e:'normal',  t:'終わった週とイベント、ここで見返せるよ' },
      { e:'happy',   t:'続けてきた形が残るのは、悪くないと思う' },
      { e:'normal',  t:'ここは見るだけな。報酬はもらえんよ' },
    ],
    rhythmMonsters: [
      { e:'normal',  t:'入れた順が、そのまま出てくる順になるよ' },
      { e:'normal',  t:'取れんでも能力が出んだけ。ライフは減らんからな' },
      { e:'happy',   t:'好きな子が飛んでくるだけで嬉しいもんやな' },
    ],
    dailyMasuAdvice: [
      { e:'wink',    t:'WAVE2まで行って諦める。ずるいけど正攻法だよ' },
      { e:'normal',  t:'勇者モンにした子しか登録できんからな' },
      { e:'happy',   t:'8体そろうまでは、これがいちばん早いと思う' },
    ],
    extremeChallenge: [
      { e:'normal',  t:'普通のチャレンジで物足りんくなったら来ればいい' },
      { e:'normal',  t:'負けても減るもんはない。一回見てみ' },
      { e:'happy',   t:'記録が別枠なのも、挑みやすいとこだな' },
    ],
    extremeDifficulty: [
      { e:'troubled', t:'カードが半分になるからな。いつもの感覚だと危ない' },
      { e:'normal',   t:'ルール詳細は先に開いとけよ。数字がぜんぶ出てる' },
      { e:'happy',    t:'一回で決めんでいい。何度でも来られるからな' },
    ],
    nightmareDifficulty: [
      { e:'troubled', t:'補正の効き方が変わる。編成もそのままだと噛み合わんよ' },
      { e:'normal',   t:'不利な距離を減らすとこから考えると、まとまるわ' },
      { e:'happy',    t:'名前ほどじゃない。順番が読めりゃ戦えるよ' },
    ],
    chaosDifficulty: [
      { e:'normal',   t:'ガッツが重いから、撃つ手を選ぶ戦いになるな' },
      { e:'excited',  t:'報酬はでかい。1回抜けりゃ一気に進むよ' },
      { e:'normal',   t:'ここから先は、育ててきた時間がそのまま出るわ' },
    ],
    ultimateDifficulty: [
      { e:'normal',   t:'長引くほど不利だからな。短く決めろ' },
      { e:'troubled', t:'加入ボーナスも下がる。序盤が勝負だよ' },
      { e:'surprise', t:'×35って数字、見なかったことにしたいわ' },
    ],
    infinityDifficulty: [
      { e:'surprise', t:'極限のルールが全部重なる。腹くくっていけ' },
      { e:'normal',   t:'安全な距離はひとつだけ。そこを軸に組め' },
      { e:'happy',    t:'ここまで積んだもんは、ぜんぶ残ってるからな' },
    ],
    godDifficulty: [
      { e:'normal',   t:'神威が上がるたび、同じルールでも重くなるよ' },
      { e:'troubled', t:'後半は安全な距離が消える。前半で削っとけ' },
      { e:'surprise', t:'100倍な。声出して笑ったわ、おで' },
    ],
    ragnarokDifficulty: [
      { e:'normal',   t:'最後の難易度だよ。ここまで来る人はほとんどおらん' },
      { e:'troubled', t:'起き上がるボスは、倒し方より削る順番だな' },
      { e:'happy',    t:'無理だと思ったら引いていい。恥ずかしいことちゃうよ' },
    ],
    speciesChallenge: [
      { e:'normal',   t:'同じ種族だけで組むと、弱いとこがはっきり出るな' },
      { e:'happy',    t:'初クリアで超越の実。その種族のやつがもらえるよ' },
      { e:'normal',   t:'ほかの記録には響かん。気楽に試してみ' },
    ],
    onboarding: [
      { e:'happy',   t:'おではドラ。よろしくな' },
      { e:'normal',  t:'名前は後からでも変えられるよ。適当でいい' },
      { e:'happy',   t:'難しく考えんでいい。やってりゃ手が覚えるわ' },
    ],
    home: [
      { e:'happy',   t:'今日はどこから回る？ おではどこでも付き合うよ' },
      { e:'normal',  t:'村の子ら、よく見ると動きが違うんだよな' },
      { e:'happy',   t:'休むのも大事だよ。逃げやしないからな' },
    ],
    battleChallenge: [
      { e:'normal',  t:'記録が残るやつだな。難易度ごとに分かれてるよ' },
      { e:'normal',  t:'強化の取り方ひとつで、終盤の粘りが変わるからな' },
      { e:'happy',   t:'負けても減らん。気楽にいけばいいわ' },
    ],
    battleQuick: [
      { e:'normal',  t:'結果だけ見たいならこっちがいちばん早いよ' },
      { e:'normal',  t:'編成がそのまま出るから、組み方の練習にもなるな' },
      { e:'happy',   t:'回しすぎて疲れんようにな。ほどほどでいい' },
    ],
    battlePro: [
      { e:'normal',  t:'育てた子を置いていくぶん、素の相性がよく見えるよ' },
      { e:'happy',   t:'絆が3倍だからな。新しい子を育てるならここだわ' },
      { e:'normal',  t:'3体が誰になるかは運や。5体とも使える子にしとけ' },
    ],
    ranking: [
      { e:'normal',  t:'上の人の組み方、素直に真似するとこから始めりゃいい' },
      { e:'happy',   t:'順位より、前の自分より伸びてるかだと思うよ' },
      { e:'normal',  t:'難易度を切り替えると、狙いやすいとこが見つかるわ' },
    ],
    rankingParty: [
      { e:'happy',   t:'染めた色まで残ってるの、ちょっと面白いよな' },
      { e:'normal',  t:'置いた距離を見ると、その人の考え方が分かるよ' },
      { e:'normal',  t:'真似して合わんかったら戻しゃいい。それだけや' },
    ],
    pickHero: [
      { e:'normal',  t:'この子が最後まで戦うからな。相性で選んでいい' },
      { e:'normal',  t:'固有技は絆Lvで伸びる。育ってる子ほど心強いよ' },
      { e:'happy',   t:'好きな子で行くのがいちばん続くと思う' },
    ],
    pickSlot: [
      { e:'normal',  t:'置いた距離の適性が、そのまま火力に効くからな' },
      { e:'normal',  t:'前に出るか下がるか、迷ったら敵の間合いを見ろ' },
      { e:'happy',   t:'ここだけで勝ち負けが変わること、普通にあるわ' },
    ],
    pickAlly: [
      { e:'normal',  t:'空いてる距離を埋めると、崩れにくくなるよ' },
      { e:'normal',  t:'合流のボーナスは絆Lvで決まるからな' },
      { e:'happy',   t:'育ってる子を素直に取るのも、ちゃんとした選び方だよ' },
    ],
    pickProAllies: [
      { e:'normal',  t:'5体のうち3体しか来ん。誰が来ても困らん形にしとけ' },
      { e:'normal',  t:'固有技の噛み合わせも見とくと安心だな' },
      { e:'happy',   t:'外れが無い5体。それだけ守りゃ大丈夫やで' },
    ],
    pickTeaching: [
      { e:'normal',  t:'重ねるとLv2。1回で強くしたいなら広いやつだな' },
      { e:'wink',    t:'アシストカードは半分にならん。そこが強いとこだよ' },
      { e:'normal',  t:'迷ったら、いま足りてないもんを選べば外さんわ' },
    ],
    rewardPick: [
      { e:'normal',  t:'ここで伸ばしたぶんは、この戦いのあいだずっと効くよ' },
      { e:'happy',   t:'同じもんを2つ取ると、伸びがはっきり出るな' },
      { e:'normal',  t:'弱いとこを埋めるか、強いとこを尖らせるか…やなぁ' },
    ],
    battleHelp: [
      { e:'wink',    t:'解析は先にやれ。相手の手が読めるだけで違うよ' },
      { e:'normal',  t:'ガッツは残しとくと、終盤で助かるからな' },
      { e:'happy',   t:'焦らんでいい。1ターンずつでいいんだよ' },
    ],
    resultWin: [
      { e:'happy',   t:'勝った編成は覚えとけよ。次が楽になるわ' },
      { e:'normal',  t:'この子、マスモンに登録しとけ' },
      { e:'excited', t:'よく粘ったな。おでは見てたよ' },
    ],
    resultLose: [
      { e:'normal',   t:'負けた形のほうが、直すとこは見えるもんだよ' },
      { e:'normal',   t:'進んだWAVEぶんは、ちゃんと残るからな' },
      { e:'troubled', t:'今日は休んで、また明日でいいと思う' },
    ],
    resultRetire: [
      { e:'happy',   t:'ここで止めるのも判断だよ。えらいと思う' },
      { e:'normal',  t:'もらえるもんは受け取ってから戻れよ' },
      { e:'normal',  t:'仕切り直したほうが、結果はよくなること多いわ' },
    ],
    skipPick: [
      { e:'normal',  t:'まとめるほど、一度に入る量が増えるからな' },
      { e:'happy',   t:'登録はできんけど、育てるだけなら十分やで' },
      { e:'normal',  t:'時間が無い日のための道具だよ。使えばいい' },
    ],
    skipResult: [
      { e:'normal',  t:'絆レベルの伸びも見とけ。強化ポイントが増えてるよ' },
      { e:'normal',  t:'チケットの残り、確認しとくといいな' },
      { e:'happy',   t:'一気に育つの、見てて気持ちいいもんだよな' },
    ],
    monsterDex: [
      { e:'normal',  t:'血統でしぼると、似た顔が並んで面白いよ' },
      { e:'normal',  t:'技の並びを見ると、その子の育ち方が分かるな' },
      { e:'happy',   t:'埋まってくのを眺めるの、おでは好きだわ' },
    ],
    mbManagement: [
      { e:'normal',  t:'ここが育成の入口だよ。迷ったら戻ってこい' },
      { e:'normal',  t:'編成に入れんと、せっかくの子が出てこんからな' },
      { e:'happy',   t:'整えとくと、遊ぶときに迷わんで済むわ' },
    ],
    roster: [
      { e:'normal',   t:'4体の間合いがばらけてりゃ、どんな相手にも届くよ' },
      { e:'troubled', t:'「決定」を押すまでは反映されんからな' },
      { e:'happy',    t:'好きな子で組むのがいちばん長続きすると思う' },
    ],
    monsterList: [
      { e:'normal',  t:'ベースモンは種そのもの、マスモンは育てた子な' },
      { e:'normal',  t:'詳細を開くと、間合い適性まで見られるよ' },
      { e:'happy',   t:'増えてくると眺めるだけで楽しくなるわ' },
    ],
    masuList: [
      { e:'normal',  t:'総合力で並べると、育ち具合がひと目で分かるよ' },
      { e:'normal',  t:'名前は何度でも変えられるからな' },
      { e:'happy',   t:'この子ら、ぜんぶ{name}が育てたんだよな。すごいわ' },
    ],
    masuAutoEnhance: [
      { e:'normal',   t:'決めときゃ、あとは順番に振ってくれるよ' },
      { e:'normal',   t:'転生しても消えん。一回決めりゃ長く使えるわ' },
      { e:'troubled', t:'振る先を決めてないと、ONでも何も起きんからな' },
    ],
    masuEnhance: [
      { e:'normal',  t:'適性と能力値、どっちにも振れるよ' },
      { e:'normal',  t:'よく使う距離から上げると実感しやすいな' },
      { e:'happy',   t:'振り直しはリセットの書でできる。気楽にやれ' },
    ],
    temple: [
      { e:'troubled', t:'合体・限界突破・転生・寄付。どれも戻せんからな' },
      { e:'normal',   t:'再生は初回タダだよ。試すならそこからだな' },
      { e:'happy',    t:'ここ来ると、ちょっと背筋が伸びるわ' },
    ],
    fusion: [
      { e:'normal',  t:'主に残したい子を先に決めると迷わんよ' },
      { e:'normal',  t:'副の絆経験値は、まるごと主に移るからな' },
      { e:'happy',   t:'思いがけん組み合わせが当たりのこと、あるで' },
    ],
    rebirth: [
      { e:'normal',  t:'上限が伸びるからな。育てきった子ほど効くよ' },
      { e:'normal',  t:'かかるダイヤは絆Lvぶん。育つほど高いわ' },
      { e:'excited', t:'星が増える瞬間、おでもちょっと嬉しい' },
    ],
    transcendence: [
      { e:'normal',  t:'Lv400まで育てた子だけが進める道だよ' },
      { e:'normal',  t:'超越ポイントは基礎値を上げる。転生しても消えん' },
      { e:'happy',   t:'ここまで来る人、そんなにおらんよ。すごいと思う' },
    ],
    reincarnate: [
      { e:'normal',   t:'別の姿に生まれ変わるよ。技は選んで引き継げる' },
      { e:'troubled', t:'元には戻せんからな。ゆっくり決めろ' },
      { e:'excited',  t:'新しい姿になる瞬間、おでは毎回わくわくするわ' },
    ],
    donation: [
      { e:'normal',   t:'累計絆経験値と同じ数のダイヤになるよ' },
      { e:'normal',   t:'編成が崩れる子は選べんようになってるからな' },
      { e:'troubled', t:'迷ってんなら、今日はやめとくのも手やで' },
    ],
    pasture: [
      { e:'normal',  t:'5体まで村に出せるよ。強さには関わらん' },
      { e:'normal',  t:'見た目で選んで大丈夫だよ' },
      { e:'happy',   t:'にぎやかなの、おでは好きだわ' },
    ],
    market: [
      { e:'normal',  t:'アイコンはpt、そのほかはダイヤだな' },
      { e:'wink',    t:'買っただけじゃ使えん。編成に入れとけよ' },
      { e:'normal',  t:'欲しいもんがあるなら、少し貯めてからでも遅くない' },
    ],
    inventory: [
      { e:'normal',  t:'使いどきを選べるのが、アイテムのいいとこだな' },
      { e:'normal',  t:'絆ポイントリセットの書は、振り直したい日のために' },
      { e:'happy',   t:'貯めこむより、使ったほうが得やで' },
    ],
    giftClaimable: [
      { e:'normal',  t:'30日で期限が切れるからな。早めに受け取れよ' },
      { e:'normal',  t:'まとめて受け取れるよ' },
      { e:'happy',   t:'こういうの届いてると、ちょっと嬉しいよな' },
    ],
    giftEmpty: [
      { e:'normal',  t:'ここが空なのは、ちゃんと受け取れてる証だよ' },
      { e:'normal',  t:'ミッションを進めりゃ、また届くからな' },
      { e:'happy',   t:'また明日覗いてみ。急ぐもんでもないわ' },
    ],
    missionsClaimable: [
      { e:'normal',  t:'受け取ると仲良し度も少し増えるよ' },
      { e:'normal',  t:'ギフトに届くからな。そっちも見とけ' },
      { e:'happy',   t:'こつこつ進めてるの、えらいと思うわ' },
    ],
    missionsNormal: [
      { e:'normal',  t:'デイリーは毎日、ウィークリーは毎週だな' },
      { e:'happy',   t:'遊んでりゃ自然と進むもんが多いよ' },
      { e:'normal',  t:'全部やらんでいい。届くぶんだけで十分だよ' },
    ],
    profile: [
      { e:'normal',  t:'ここの名前が、そのままランキングに出るからな' },
      { e:'normal',  t:'アイコンはptで増やせるよ' },
      { e:'happy',   t:'記録を見返すと、進んできた形が分かるわ' },
    ],
    settings: [
      { e:'normal',   t:'音量は好みでいい。長く遊ぶなら小さめもアリだな' },
      { e:'normal',   t:'BGMアレンジは、モードごとに選べるよ' },
      { e:'troubled', t:'引き継ぎコードだけは控えとけ。消えたら戻らんからな' },
    ],
    helpTop: [
      { e:'normal',  t:'カテゴリ → 項目 → 説明の3段だよ' },
      { e:'normal',  t:'数字の表は実データから作ってるから、古くならん' },
      { e:'happy',   t:'読んでも分からんかったら遊んでみ。そのほうが早いわ' },
    ],
  },
});
// ===== みゅあ・バリエーション追加(2026-09-18) =====
// みゅあは場面によって10〜55本あるが、モンヒロビート関係と一部の難易度だけ
// 5〜6本しかなく、そこだけ同じセリフの再会が早かった。薄い14場面へ3本ずつ足す。
// 口調はファイル先頭の「みゅあの話し方」に従う(顔文字の擬音は半角カタカナ)。
addAssistantLinePack({
  id: 'muaVariety',
  label: 'みゅあ・バリエーション追加',
  lines: {
    quickRhythmIntro: [
      { e:'happy',   t:'周回は裏で回ってるから、好きなだけ遊んでいいよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'戻るのは左上の「⚔ 戻る」。いつでも帰ってこれるよ。' },
      { e:'normal',  t:'アプリを閉じると止まっちゃうから、そこだけ気をつけてね。' },
    ],
    quickRhythmBackground: [
      { e:'happy',   t:'叩いてるあいだも、ちゃんと数は増えてるよ♪' },
      { e:'wink',    t:'長い曲ほど、戻ったときのぶんが多いの(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',  t:'帯をタップすると、いま何周めか見られるよ。' },
    ],
    autoQuickRunSettings: [
      { e:'happy',   t:'一度決めたら、次からは押すだけで始まるよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'決めてないときは、直前に組んだ編成をそのまま使うね。' },
      { e:'normal',  t:'まだ開いてない難易度は、並んでても選べないよ。' },
    ],
    rhythmHome: [
      { e:'happy',   t:'同じ曲でも難易度が変わると、別モノに感じる(´ー`*)ｳﾝｳﾝ' },
      { e:'excited', t:'知らない曲から入るのもアリ！ 出会いってやつw' },
      { e:'normal',  t:'ノーツ速度は、慣れてきたら上げてみて。' },
    ],
    rhythmHelp: [
      { e:'normal',  t:'判定の幅まで数字で書いてあるよ。細かいでしょ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'分からない言葉が出たら、まずここを探すのが早いよ。' },
      { e:'happy',   t:'一回読んでおくと、あとがラクになるよ〜' },
    ],
    rhythmWeeklyEvent: [
      { e:'normal',  t:'イベントの記録は、いつもの週間とは別に数えるからね。' },
      { e:'happy',   t:'対象曲はビートPが多めに入るよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'順位が出るのは終わったあと。それまでのんびりいこ。' },
    ],
    rhythmHistory: [
      { e:'normal',  t:'終わった週とイベントの順位、ここから追えるよ。' },
      { e:'happy',   t:'続けてきた形が残るの、いいよね(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',  t:'ここは見るだけ。報酬の受け取りは別のとこだよ。' },
    ],
    rhythmMonsters: [
      { e:'normal',  t:'入れた順番が、そのまま出てくる順番になるよ。' },
      { e:'normal',  t:'取れなくても能力が出ないだけ。ライフは減らないよ。' },
      { e:'happy',   t:'好きな子が飛んでくると、それだけで嬉しい(´ー`*)ｳﾝｳﾝ' },
    ],
    extremeDifficulty: [
      { e:'normal',  t:'カードが半分になるぶん、素の強さがそのまま出るよ。' },
      { e:'wink',    t:'ルール詳細、先に開いておくと安心(●゚ｪ゚))ｺｸｺｸ' },
      { e:'happy',   t:'一回で決めなくていいよ。何度でも挑めるんだから。' },
    ],
    nightmareDifficulty: [
      { e:'troubled', t:'補正の効き方が変わるから、いつもの編成だと噛み合わないかも。' },
      { e:'normal',   t:'不利な距離を減らすところから考えると、まとまるよ。' },
      { e:'happy',    t:'順番さえ読めれば、意外と戦えるよ(●゚ｪ゚))ｺｸｺｸ' },
    ],
    godDifficulty: [
      { e:'normal',   t:'神威が上がるたび、同じルールでも重みが変わるの。' },
      { e:'troubled', t:'後半は安全な距離が消えるから、前半で削っておこ。' },
      { e:'surprise', t:'100倍って…考えるのやめたくなるよねw' },
    ],
    ragnarokDifficulty: [
      { e:'normal',   t:'いちばん奥の難易度。ここを越える人、ほんの一握りだよ。' },
      { e:'troubled', t:'起き上がるボスは、倒し方より削る順番が大事。' },
      { e:'happy',    t:'無理だと思ったら引いていいからね(●゚ｪ゚))ｺｸｺｸ' },
    ],
    speciesChallenge: [
      { e:'normal',  t:'同じ種族だけで組むと、弱点がはっきり出るよ。' },
      { e:'happy',   t:'超越の実は、その種族のぶんがもらえるよ(●゚ｪ゚))ｺｸｺｸ' },
      { e:'normal',  t:'ほかの種族の記録には響かないから、気軽に試せるよ。' },
    ],
    rankingParty: [
      { e:'happy',   t:'染めた色まで残ってるの、ちょっと面白いよね(´ー`*)ｳﾝｳﾝ' },
      { e:'normal',  t:'置いた距離を見ると、その人の考え方が見えるよ。' },
      { e:'wink',    t:'真似してみて、合わなかったら戻せばいいんだからw' },
    ],
  },
});
// ===== ももすけ・バリエーション追加(2026-09-18) =====
// ききと同じ理由(全場面が5〜6本しかなく、同じセリフの再会が早い)。全場面へ3本ずつ足す。
// rhythmHistory はももすけのぶんが1本も無く、みゅあのセリフへ落ちていたので5本にする。
// 口調はファイル先頭の「ももすけの話し方」に従う(素直に驚く・褒める／「w」／「♡」／
// 細かいところに気づいてツッコむ／一人称は「もも」)。
addAssistantLinePack({
  id: 'momosukeVariety',
  assistantId: 'momosuke',
  label: 'ももすけ・バリエーション追加',
  lines: {
    quickRhythmIntro: [
      { e:'happy',   t:'周回は裏で回ってるから。ここで遊んでていいよw' },
      { e:'normal',  t:'戻るボタンは左上ね。迷子にならないでよ？' },
      { e:'normal',  t:'アプリ閉じたら止まるからね。そこだけ覚えといて。' },
    ],
    quickRhythmBackground: [
      { e:'happy',   t:'{name}が叩いてるあいだも、ちゃんと増えてるよ。' },
      { e:'wink',    t:'演奏中は止まるけどね。まあ誤差だよ誤差w' },
      { e:'normal',  t:'上の帯、押すと何周めか出るよ。見てみ？' },
    ],
    autoQuickRunSettings: [
      { e:'wink',    t:'3つ決めるだけ。むずかしくないでしょ？w' },
      { e:'normal',  t:'決めてないと、直前の編成のまま行くからね。' },
      { e:'happy',   t:'育てたい子にしときなよ。あとで文句言わないでね♡' },
    ],
    rhythmHome: [
      { e:'wink',    t:'曲は好きに選んでいいよ。ももは口出さない…たぶんw' },
      { e:'normal',  t:'速度いじれるの、知ってた？ 無理しなくていいって。' },
      { e:'normal',  t:'ひとつ下をクリアしないとMASTERは開かないよ。' },
    ],
    rhythmHelp: [
      { e:'wink',    t:'ぜんぶ書いてあるよ。読むかどうかは{name}しだいw' },
      { e:'normal',  t:'判定の幅も数字で出てる。けっこう細かいでしょ。' },
      { e:'happy',   t:'読んで分かんなかったら、1回やったほうが早いって。' },
    ],
    rhythmWeeklyEvent: [
      { e:'excited', t:'この期間の点だけ。あとから出しても遅いからねw' },
      { e:'happy',   t:'部門ごとに報酬あるよ。全部狙う？ 欲張りだなあ♡' },
      { e:'normal',  t:'順位が出るのは終わったあと。それまで気にしない。' },
    ],
    rhythmHistory: [
      { e:'normal',  t:'終わった週とイベント、ここで見返せるよ。' },
      { e:'happy',   t:'先週の{name}、けっこう頑張ってたよねw' },
      { e:'normal',  t:'ここは見るだけ。報酬はもらえないからね？' },
      { e:'normal',  t:'数え直して出すから、あのときのまんまだよ。' },
      { e:'happy',   t:'記録が並んでると、続けてきた感じするでしょ♡' },
    ],
    rhythmMonsters: [
      { e:'wink',    t:'金色で飛んでくるやつね。取れなかったら能力なしw' },
      { e:'normal',  t:'上から順に出るよ。並べ方も作戦のうち。' },
      { e:'happy',   t:'ライフきついなら元気か無敵。ま、{name}なら平気か♡' },
    ],
    dailyMasuAdvice: [
      { e:'wink',    t:'WAVE2まで行って諦める。ずるいけど正攻法だよw' },
      { e:'normal',  t:'勇者モンにした子しか登録できないからね。' },
      { e:'happy',   t:'8体そろうまでは、これがいちばん早いって。' },
    ],
    extremeChallenge: [
      { e:'wink',    t:'ここから先は本気の人の場所。{name}、来るの？w' },
      { e:'normal',  t:'負けても減らないよ。1回見てみたら？' },
      { e:'happy',   t:'記録も別枠だから、汚れないって意味では気楽だよ♡' },
    ],
    extremeDifficulty: [
      { e:'wink',    t:'カード半分だからね。いつもの感覚だと死ぬよw' },
      { e:'happy',   t:'ルール詳細、読んでから来た？ ……読んでないでしょ♡' },
      { e:'normal',  t:'厳しかったら戻っていいよ。ももは笑わないし。' },
    ],
    nightmareDifficulty: [
      { e:'wink',    t:'有利は弱く、不利は重く。ひどい話でしょw' },
      { e:'normal',  t:'距離の詰め方でだいぶ変わるよ。考えて。' },
      { e:'normal',  t:'全WAVE詳細、見てから組むと楽だって。' },
    ],
    chaosDifficulty: [
      { e:'excited', t:'×20。数字だけで笑えてくるよねw' },
      { e:'normal',  t:'ガッツ1.5倍だから、撃つ手は選んでね。' },
      { e:'happy',   t:'ここ抜けたら、もももちょっとは見直すかも♡' },
    ],
    ultimateDifficulty: [
      { e:'normal',  t:'長引くほど不利。さっさと決めるが勝ちだよ。' },
      { e:'excited', t:'×35って、もう何言ってるか分かんないよねww' },
      { e:'normal',  t:'35ターンごとに距離が壊れるから、散らしときな。' },
    ],
    infinityDifficulty: [
      { e:'wink',    t:'ルール全部乗せ。ここまで来た{name}、しつこいねw' },
      { e:'troubled', t:'安全な距離、1つしか残らないよ。' },
      { e:'happy',   t:'……まあ、ここまで来たのは素直にすごいと思う♡' },
    ],
    godDifficulty: [
      { e:'excited', t:'100倍。もう数字じゃないよねww' },
      { e:'troubled', t:'WAVE9から安全な場所なくなるよ。覚悟しといて。' },
      { e:'normal',  t:'神威が上がるたび重くなるの。えげつないでしょ。' },
    ],
    ragnarokDifficulty: [
      { e:'excited', t:'200倍。作った人、正気じゃないよねw' },
      { e:'troubled', t:'ボスが起き上がるからね。1回で終わると思わないで。' },
      { e:'happy',   t:'ここまで来る人、ほんとに一握りだよ。すごいじゃん♡' },
    ],
    speciesChallenge: [
      { e:'wink',    t:'1種族しばり。縛るの好きだねえw' },
      { e:'normal',  t:'育ててる種族から行きなよ。無茶しないで。' },
      { e:'happy',   t:'初クリアで超越の実。おいしいじゃん♡' },
    ],
    onboarding: [
      { e:'wink',    t:'ももすけだよ。よろしくね……って、まだ選んでないかw' },
      { e:'normal',  t:'名前は後で変えられるから、適当でいいよ。' },
      { e:'happy',   t:'難しく考えないで。やってりゃ覚えるって♡' },
    ],
    home: [
      { e:'wink',    t:'今日は何する？ ももは付き合うけどさw' },
      { e:'normal',  t:'村の子たち歩いてるよ。見てあげたら？' },
      { e:'happy',   t:'ギフトとミッション、溜まってない？ 確認しなよ♡' },
    ],
    battleChallenge: [
      { e:'wink',    t:'記録が残るやつ。緊張する？ しないかw' },
      { e:'normal',  t:'強化の取り方で終盤変わるよ。適当に取らないでね。' },
      { e:'happy',   t:'負けても減らないんだから、気楽に行きなって♡' },
    ],
    battleQuick: [
      { e:'wink',    t:'速いのがほしいならこっち。{name}せっかちだもんねw' },
      { e:'normal',  t:'強化は選べないよ。編成で勝負ね。' },
      { e:'happy',   t:'回しすぎて寝落ちしないでよ？♡' },
    ],
    battlePro: [
      { e:'wink',    t:'ベースモンだけ。ごまかしが効かないやつだよw' },
      { e:'normal',  t:'絆3倍だから、新入りを育てるならここ。' },
      { e:'happy',   t:'5体から3体。誰が来ても困らない並びにしなよ♡' },
    ],
    ranking: [
      { e:'surprise', t:'上の人たち、えぐいでしょw' },
      { e:'normal',   t:'編成見るだけでも勉強になるよ。盗んじゃえ。' },
      { e:'happy',    t:'{name}の名前、そのうち上に出ると思うけどね♡' },
    ],
    rankingParty: [
      { e:'wink',    t:'染めた色まで残ってるの、ちょっと怖くない？w' },
      { e:'normal',  t:'置いた距離で考え方が分かるよね。' },
      { e:'happy',   t:'真似していいよ。誰も怒らないって♡' },
    ],
    pickHero: [
      { e:'wink',    t:'この子が最後まで戦うからね。慎重にどうぞw' },
      { e:'happy',   t:'固有技、見た？ ……見てないでしょ♡' },
      { e:'normal',  t:'好きな子でいいって。強さだけじゃないでしょ。' },
    ],
    pickSlot: [
      { e:'wink',    t:'敵と同じ距離が強いよ。基本中の基本w' },
      { e:'normal',  t:'置いた場所以外にも補正は乗るから、悩まないで。' },
      { e:'happy',   t:'ここ地味だけど、いちばん差が出るとこ♡' },
    ],
    pickAlly: [
      { e:'wink',    t:'空いてる距離を埋めなよ。偏ってるよ？w' },
      { e:'normal',  t:'合流ボーナスは絆Lvで決まるからね。' },
      { e:'happy',   t:'いい子が来ると、急に勝てる気がしてくるよね♡' },
    ],
    pickProAllies: [
      { e:'normal',  t:'3体しか来ないよ。外れ作らないでね。' },
      { e:'wink',    t:'間合いばらけさせな。同じのばっかだと届かないよw' },
      { e:'happy',   t:'……その5体、ちょっと偏ってない？♡' },
    ],
    pickTeaching: [
      { e:'wink',    t:'重ねるとLv2。ももは重ねる派だけどw' },
      { e:'normal',  t:'アシストカードは半減しないよ。そこ大事。' },
      { e:'happy',   t:'欲張ると持て余すからね。ほどほどに♡' },
    ],
    rewardPick: [
      { e:'wink',    t:'2つ選ぶだけ。悩みすぎだってw' },
      { e:'normal',  t:'同じの2回でもいいよ。ちゃんと伸びるし。' },
      { e:'happy',   t:'ここの積み重ねで後半変わるよ。真面目に選んで♡' },
    ],
    battleHelp: [
      { e:'normal',  t:'まず解析。相手の手が見えるだけで全然違うよ。' },
      { e:'wink',    t:'ガード？ 逃げじゃないよ。立派な一手w' },
      { e:'happy',   t:'ガッツないなら1枚でいいって。無理しないで♡' },
    ],
    resultWin: [
      { e:'happy',   t:'やるじゃん。……ちょっとだけ見直した♡' },
      { e:'wink',    t:'この編成、覚えときなよ。忘れるでしょ{name}はw' },
      { e:'normal',  t:'報酬もらった？ 取りこぼすなよ〜' },
    ],
    resultLose: [
      { e:'troubled', t:'負けたね。……まあ、そういう日もあるよ。' },
      { e:'happy',    t:'経験値は入ってるからね。無駄じゃないって♡' },
      { e:'wink',     t:'次どこ直す？ ももが聞いてあげるよw' },
    ],
    resultRetire: [
      { e:'happy',   t:'引き際うまいじゃん。嫌いじゃないよ♡' },
      { e:'normal',  t:'進んだぶんはもらえるからね。忘れないで。' },
      { e:'wink',    t:'また来なよ。待ってないけど待ってるからw' },
    ],
    skipPick: [
      { e:'wink',    t:'ズルじゃないよ、時短だよ時短w' },
      { e:'normal',  t:'まとめて使うと一気に入るからね。' },
      { e:'happy',   t:'記録には残らないから、そこだけ覚えといて♡' },
    ],
    skipResult: [
      { e:'happy',   t:'いっぱい入ったじゃん。よかったねw' },
      { e:'normal',  t:'チケットの残り、見といたほうがいいよ。' },
      { e:'excited', t:'絆も伸びてるよ。強化ポイント確認しな♡' },
    ],
    monsterDex: [
      { e:'wink',    t:'血統でしぼれるよ。並べると似てて笑えるw' },
      { e:'normal',  t:'シルエットの子はまだ会ってないやつね。' },
      { e:'happy',   t:'埋まってくと嬉しいでしょ？ 分かるよ♡' },
    ],
    mbManagement: [
      { e:'wink',    t:'ここが入口。迷ったら戻っておいでw' },
      { e:'normal',  t:'編成に入れないと出てこないからね。' },
      { e:'happy',   t:'「決定」押し忘れるの、{name}よくやるでしょ♡' },
    ],
    roster: [
      { e:'wink',    t:'4体。間合いばらけさせなって言ったでしょw' },
      { e:'normal',  t:'決定を押すまで反映されないからね。' },
      { e:'happy',   t:'その並び、ちょっと好きかも♡' },
    ],
    monsterList: [
      { e:'normal',  t:'ベースモンは素、マスモンは育てた子ね。' },
      { e:'wink',    t:'詳細開くと適性まで見れるよ。見なよw' },
      { e:'happy',   t:'増えてくと選ぶの楽しくなるよね♡' },
    ],
    masuList: [
      { e:'surprise', t:'育てた子が並んでるよ。……多くない？w' },
      { e:'normal',   t:'総合力で並べると、育ち具合すぐ分かるよ。' },
      { e:'happy',    t:'名前つけるの、{name}センスあると思う♡' },
    ],
    masuAutoEnhance: [
      { e:'wink',    t:'決めとけば勝手に振るよ。楽でしょw' },
      { e:'normal',  t:'転生しても消えないからね。1回決めれば十分。' },
      { e:'troubled', t:'振り先決めてないと何も起きないよ。そこ注意♡' },
    ],
    masuEnhance: [
      { e:'normal',  t:'適性か能力値。好きなほうに振りなよ。' },
      { e:'wink',    t:'よく使う距離から上げると実感あるよw' },
      { e:'happy',   t:'振り直しはリセットの書。気楽にどうぞ♡' },
    ],
    temple: [
      { e:'wink',    t:'合体・限界突破・転生・寄付。全部戻せないよ？w' },
      { e:'normal',  t:'再生は初回タダ。試すならそこから。' },
      { e:'happy',   t:'ここ来ると、ちょっと緊張するよね♡' },
    ],
    fusion: [
      { e:'wink',    t:'主が残って副が消える。分かってる？w' },
      { e:'normal',  t:'副の絆はまるごと主に移るからね。' },
      { e:'happy',   t:'変な組み合わせが当たりだったりするよ♡' },
    ],
    rebirth: [
      { e:'normal',  t:'上限が伸びるよ。育てきった子ほど効く。' },
      { e:'wink',    t:'ダイヤは絆Lvぶん。育つほど高いんだよねw' },
      { e:'happy',   t:'星が増えるの、見ててちょっと嬉しい♡' },
    ],
    transcendence: [
      { e:'surprise', t:'Lv400までいった子だけ。……{name}、よくやったねw' },
      { e:'normal',   t:'超越Pは基礎そのものを上げるよ。別枠ね。' },
      { e:'happy',    t:'ここまで来る人、そんなにいないよ。すごいと思う♡' },
    ],
    reincarnate: [
      { e:'wink',    t:'別の姿になるよ。戻せないからね？w' },
      { e:'normal',  t:'技は選んで引き継げるから、強みは残るよ。' },
      { e:'excited', t:'新しい姿になる瞬間、ももも見たい♡' },
    ],
    donation: [
      { e:'troubled', t:'寄付したら戻ってこないよ。ほんとにいいの？' },
      { e:'normal',   t:'累計絆経験値ぶんのダイヤになるよ。' },
      { e:'happy',    t:'……ちょっと寂しいけど、{name}が決めていいよ♡' },
    ],
    pasture: [
      { e:'wink',    t:'5体まで出せるよ。強さは変わらないけどねw' },
      { e:'normal',  t:'見た目で選びなよ。そういうものでしょ。' },
      { e:'happy',   t:'みんな歩いてるの、かわいいじゃん♡' },
    ],
    market: [
      { e:'wink',    t:'何買うの？ もものアイコンもあるけどw' },
      { e:'normal',  t:'買っただけじゃ使えないよ。編成に入れて。' },
      { e:'happy',   t:'ダイヤ溶かしすぎないようにね♡' },
    ],
    inventory: [
      { e:'normal',  t:'溜めてても意味ないよ。使いなって。' },
      { e:'wink',    t:'効果は詳細から見れるよ。読まないでしょ？w' },
      { e:'happy',   t:'ハマったときの気持ちよさ、分かる♡' },
    ],
    giftClaimable: [
      { e:'wink',    t:'届いてるよ。放置するタイプでしょ{name}はw' },
      { e:'normal',  t:'30日で消えるからね。急ぎなよ。' },
      { e:'happy',   t:'まとめて受け取れるよ。楽でいいね♡' },
    ],
    giftEmpty: [
      { e:'wink',    t:'からっぽ。ちゃんと受け取ってるじゃんw' },
      { e:'normal',  t:'ミッション進めればまた届くよ。' },
      { e:'happy',   t:'また明日おいでよ。……別に待ってないけど♡' },
    ],
    missionsClaimable: [
      { e:'normal',  t:'溜まってるよ。もらっときな。' },
      { e:'wink',    t:'受け取ると仲良し度もちょっと増えるよw' },
      { e:'happy',   t:'こういうのマメだよね。えらいと思う♡' },
    ],
    missionsNormal: [
      { e:'normal',  t:'デイリーとウィークリー。毎回リセットされるよ。' },
      { e:'wink',    t:'遊んでれば勝手に進むやつが多いよw' },
      { e:'happy',   t:'全部やらなくていいって。無理しないで♡' },
    ],
    profile: [
      { e:'normal',  t:'ここの名前がランキングに出るからね。' },
      { e:'wink',    t:'アイコンはptで買えるよ。もものもあるけどw' },
      { e:'happy',   t:'記録見返すと、伸びてるのわかるでしょ♡' },
    ],
    settings: [
      { e:'normal',  t:'音量いじれるよ。うるさかったら下げな。' },
      { e:'wink',    t:'BGMアレンジ、試した？ 雰囲気変わるよw' },
      { e:'troubled', t:'引き継ぎコードだけは控えときな。消えたら知らないよ♡' },
    ],
    helpTop: [
      { e:'wink',    t:'全部書いてあるよ。読む気ある？w' },
      { e:'normal',  t:'距離のとこだけは読んどいたほうがいい。' },
      { e:'happy',   t:'分かんなかったら聞きなよ。教えてあげる♡' },
    ],
  },
});
// ===== きき・バリエーション追加(2026-09-18) =====
// ユーザー依頼「またバリエーションを増やして」。ききは全60場面が5〜6本しかなく、
// みゅあ(10〜55本)と比べて同じセリフの再会が早かった。全場面へ3本ずつ足す。
// 口調の決まりごとはファイル先頭の「ききの話し方」に従う
// (顔文字は全角の擬音・「♪♪」・「でつ/まつ」は混ぜる程度・崩した相槌)。
addAssistantLinePack({
  id: 'kikiVariety',
  assistantId: 'kiki',
  label: 'きき・バリエーション追加',
  lines: {
    quickRhythmIntro: [
      { e:'normal',  t:'ここから音ゲーへ行っても、周回はちゃんと続いてまつよ。' },
      { e:'happy',   t:'待ち時間が遊びに変わるの、お得ですよね (´ー`*)ウンウン' },
      { e:'normal',  t:'戻ってきたら、その場から周回が続きまつ。' },
    ],
    quickRhythmBackground: [
      { e:'happy',   t:'演奏に集中して大丈夫。数えるのは私がやりまつ♪♪' },
      { e:'normal',  t:'周回の数は上の帯に出てまつ。気になったら覗いてみて。' },
      { e:'wink',    t:'長い曲ほど、戻ったときの実りが大きいでつよ。' },
    ],
    autoQuickRunSettings: [
      { e:'normal',  t:'一度決めておけば、次からは押すだけで始まりまつ。' },
      { e:'happy',   t:'編成を変えたくなったら、ここへ戻ってくればいいよ (・∀・)' },
      { e:'normal',  t:'難易度は、いま開いているものだけが選べまつ。' },
    ],
    rhythmHome: [
      { e:'normal',  t:'同じ曲でも難易度が変わると、別の曲みたいに感じまつよ。' },
      { e:'happy',   t:'知らない曲から始めるのも楽しいよ♪♪' },
      { e:'wink',    t:'ノーツ速度は、目が慣れてきたら上げてみて ( ˘ω˘)9' },
    ],
    rhythmHelp: [
      { e:'normal',  t:'判定の幅も、ここに数字で書いてありまつ。' },
      { e:'normal',  t:'分からない言葉が出てきたら、まずここを探すのが早いよ。' },
      { e:'happy',   t:'一度読んでおくと、あとがぐっと楽になりまつ (・∀・)' },
    ],
    rhythmWeeklyEvent: [
      { e:'normal',  t:'イベントの記録は、いつもの週間とは別に数えまつ。' },
      { e:'happy',   t:'対象曲はビートPが多めに入るよ♪♪' },
      { e:'normal',  t:'順位が出るのは終わったあと。それまではのんびりどうぞ。' },
    ],
    rhythmHistory: [
      { e:'normal',  t:'終わった週とイベントの順位を、ここで見返せまつ。' },
      { e:'happy',   t:'続けてきた形が残るの、いいものでつよね (´ー`*)ウンウン' },
      { e:'normal',  t:'ここは見るだけの場所。報酬の受け取りは別でつ。' },
    ],
    rhythmMonsters: [
      { e:'normal',  t:'入れる順番が、そのまま出てくる順番になりまつ。' },
      { e:'normal',  t:'取れなくても能力が出ないだけ。ライフは減りません。' },
      { e:'happy',   t:'好きな子が飛んでくると、それだけで嬉しいよね♪♪' },
    ],
    dailyMasuAdvice: [
      { e:'normal',  t:'マスモンが増えると、できることが一気に広がりまつ。' },
      { e:'wink',    t:'勇者モンにした子だけが登録できまつ。そこだけ注意でつ。' },
      { e:'happy',   t:'無理に続けなくて大丈夫。思い出したときで十分 (´ー`*)' },
    ],
    extremeChallenge: [
      { e:'normal',  t:'普通のチャレンジで手応えが無くなったら、こちらへどうぞ。' },
      { e:'normal',  t:'負けても失うものはありませんから、一度覗いてみて。' },
      { e:'happy',   t:'記録が別なのも、挑みやすいところでつね (・∀・)' },
    ],
    extremeDifficulty: [
      { e:'normal',  t:'カードが半分になるぶん、素の強さが効いてきまつ。' },
      { e:'normal',  t:'まずはルール詳細を開いて、数字を見てからにしましょ。' },
      { e:'happy',   t:'一回で決めなくていいでつ。何度でも挑めまつから♪♪' },
    ],
    nightmareDifficulty: [
      { e:'troubled', t:'補正の効きが変わるので、いつもの編成だと噛み合わないかも。' },
      { e:'normal',   t:'不利な距離を減らすところから考えると、まとまりまつよ。' },
      { e:'wink',     t:'名前のわりに、順番が読めれば戦えまつ ( ˘ω˘)9' },
    ],
    chaosDifficulty: [
      { e:'normal',   t:'ガッツが重いので、撃つ手を選ぶ戦いになりまつ。' },
      { e:'excited',  t:'報酬が大きいぶん、1回のクリアで一気に進みまつよ♪♪' },
      { e:'normal',   t:'ここから先は、育てた年月がそのまま出まつね。' },
    ],
    ultimateDifficulty: [
      { e:'normal',   t:'長引くほど不利でつ。短く決める形に寄せましょ。' },
      { e:'troubled', t:'加入ボーナスも下がるので、序盤が勝負でつ。' },
      { e:'happy',    t:'ここまで来た{name}なら大丈夫 (´ー`*)ウンウン' },
    ],
    infinityDifficulty: [
      { e:'surprise', t:'極限のルールが全部重なりまつ。覚悟していきましょ。' },
      { e:'normal',   t:'安全な距離はひとつだけ。そこを軸に組み立てて。' },
      { e:'happy',    t:'ここまで積み上げたものは、ぜんぶ残ってまつからね♪♪' },
    ],
    godDifficulty: [
      { e:'normal',   t:'神威が上がるたび、同じルールでも重みが変わりまつ。' },
      { e:'troubled', t:'後半は安全な距離が消えまつ。前半で削り切りましょ。' },
      { e:'surprise', t:'100倍…数字を見るだけで少し震えまつ (>人<;)' },
    ],
    ragnarokDifficulty: [
      { e:'normal',   t:'最後の難易度でつ。ここを越える人は、ほんの一握り。' },
      { e:'troubled', t:'起き上がるボスは、倒し方より削る順番が大事でつ。' },
      { e:'happy',    t:'無理だと思ったら引いていいんでつよ。逃げではありません。' },
    ],
    speciesChallenge: [
      { e:'normal',   t:'同じ種族だけで組むと、弱点がはっきり出まつね。' },
      { e:'happy',    t:'超越の実は、その種族のものがもらえまつ♪♪' },
      { e:'normal',   t:'他の種族の記録には響かないので、安心して試せまつ。' },
    ],
    onboarding: [
      { e:'happy',   t:'ゆっくりで大丈夫。急ぐ遊びではありませんから。' },
      { e:'normal',  t:'名前は後からでも変えられまつよ (´ー`*)ウンウン' },
      { e:'wink',    t:'最初のうちは、押せるところを押してみるのが近道でつ。' },
    ],
    home: [
      { e:'happy',   t:'今日はどこから回りまつか？ 私はどこでもお供しまつ。' },
      { e:'normal',  t:'村の子たち、よく見ると動きが違うんでつよ (・∀・)' },
      { e:'happy',   t:'ひと休みするのも立派な遊び方でつ♪♪' },
    ],
    battleChallenge: [
      { e:'normal',  t:'記録は難易度ごとに分かれてまつ。どこからでもどうぞ。' },
      { e:'wink',    t:'強化の取り方ひとつで、終盤の粘りが変わりまつよ。' },
      { e:'happy',   t:'負けても減るものはありません。気軽にいきましょ♪♪' },
    ],
    battleQuick: [
      { e:'normal',  t:'結果だけ見たいときは、こちらがいちばん早いでつ。' },
      { e:'normal',  t:'編成がそのまま出るので、組み方の練習にもなりまつ。' },
      { e:'wink',    t:'回しすぎて疲れないようにね ( ˘ω˘)9' },
    ],
    battlePro: [
      { e:'normal',  t:'育てた子を置いていくぶん、素の相性がよく見えまつ。' },
      { e:'happy',   t:'絆を伸ばしたい子を勇者モンにすると近道でつ♪♪' },
      { e:'normal',  t:'3体が誰になるかは運でつから、5体とも使える子に。' },
    ],
    ranking: [
      { e:'normal',  t:'上の人の編成を真似するところから始めていいんでつよ。' },
      { e:'happy',   t:'順位より、前の自分より伸びているか (´ー`*)ウンウン' },
      { e:'normal',  t:'難易度を切り替えると、狙いやすい場所が見つかりまつ。' },
    ],
    rankingParty: [
      { e:'happy',   t:'染めた色まで残っているの、面白いでつよね♪♪' },
      { e:'normal',  t:'置いた距離を見ると、その人の考え方が分かりまつ。' },
      { e:'wink',    t:'真似してみて、合わなければ戻せばいいんでつ。' },
    ],
    pickHero: [
      { e:'normal',  t:'この子が最後まで戦いまつ。相性で選んで大丈夫でつよ。' },
      { e:'normal',  t:'固有技は絆Lvで伸びまつ。育っている子ほど心強いでつ。' },
      { e:'happy',   t:'好きな子で行くのがいちばん続きまつ (´ー`*)ウンウン' },
    ],
    pickSlot: [
      { e:'normal',  t:'置いた距離の適性が、そのまま火力に効いてきまつ。' },
      { e:'normal',  t:'前へ出るか下がるか、迷ったら敵の間合いを見て。' },
      { e:'wink',    t:'ここだけで勝ち負けが変わること、ありまつ ( ˘ω˘)9' },
    ],
    pickAlly: [
      { e:'normal',  t:'空いている距離を埋めると、崩れにくくなりまつ。' },
      { e:'happy',   t:'合流のボーナスは絆Lvで決まりまつよ♪♪' },
      { e:'normal',  t:'育っている子を素直に取るのも、立派な選び方でつ。' },
    ],
    pickProAllies: [
      { e:'normal',  t:'5体のうち3体しか来ません。誰が来ても困らない形に。' },
      { e:'normal',  t:'固有技の噛み合わせも見ておくと安心でつ。' },
      { e:'happy',   t:'外れが無い5体にしておくのがコツでつね (・∀・)' },
    ],
    pickTeaching: [
      { e:'normal',  t:'重ねるとLv2。1回で強くしたいなら広い効果を。' },
      { e:'wink',    t:'アシストカードは半分になりません。そこが強みでつ。' },
      { e:'normal',  t:'迷ったら、いま足りていないものを選ぶと外しません。' },
    ],
    rewardPick: [
      { e:'normal',  t:'ここで伸ばしたぶんは、この戦いのあいだずっと効きまつ。' },
      { e:'happy',   t:'同じものを2つ取ると、その伸びがはっきり出まつよ♪♪' },
      { e:'normal',  t:'弱いところを埋めるか、強いところを尖らせるか…でつね。' },
    ],
    battleHelp: [
      { e:'wink',    t:'解析は先に。相手の手が読めるだけで、だいぶ違いまつ。' },
      { e:'normal',  t:'ガッツは残しておくと、終盤で助かりまつよ。' },
      { e:'happy',   t:'焦らなくて大丈夫。1ターンずつでいいんでつ (´ー`*)ウンウン' },
    ],
    resultWin: [
      { e:'normal',  t:'勝った編成は覚えておくと、次がぐっと楽になりまつ。' },
      { e:'excited', t:'この子、マスモンに登録しておきましょ♪♪' },
      { e:'happy',   t:'よく粘りましたね。私、ちゃんと見てまつよ (・∀・)' },
    ],
    resultLose: [
      { e:'normal',   t:'負けた形のほうが、直すところが見えまつ。' },
      { e:'normal',   t:'進んだWAVEぶんは、ちゃんと手元に残りまつよ。' },
      { e:'troubled', t:'今日は休んで、また明日でもいいんでつ (´ー`*)' },
    ],
    resultRetire: [
      { e:'normal',  t:'ここで止めるのも判断でつ。えらいと思いまつよ。' },
      { e:'happy',   t:'もらえるものは受け取ってから戻りましょ♪♪' },
      { e:'normal',  t:'仕切り直したほうが、結果はよくなることが多いでつ。' },
    ],
    skipPick: [
      { e:'normal',  t:'枚数をまとめるほど、一度に入る量が増えまつ。' },
      { e:'normal',  t:'登録はできませんが、育てるだけなら十分でつよ。' },
      { e:'wink',    t:'時間が無い日のための道具でつね (・∀・)' },
    ],
    skipResult: [
      { e:'normal',  t:'絆レベルの伸びも見ておくと、強化ポイントが増えてまつ。' },
      { e:'normal',  t:'チケットの残り、確認しておきましょ。' },
      { e:'excited', t:'一気に育つの、見ていて気持ちいいでつね♪♪' },
    ],
    monsterDex: [
      { e:'normal',  t:'血統でしぼると、似た顔の子が並んで楽しいでつよ。' },
      { e:'normal',  t:'技の並びを見ると、その子の育ち方が分かりまつ。' },
      { e:'happy',   t:'埋まっていくのを眺めるの、好きなんでつ (´ー`*)ウンウン' },
    ],
    mbManagement: [
      { e:'normal',  t:'ここが育成の入口でつ。迷ったら戻ってきて。' },
      { e:'wink',    t:'編成に入れないと、せっかくの子が出てきませんよ。' },
      { e:'happy',   t:'整えておくと、遊ぶときに迷わなくて済みまつ♪♪' },
    ],
    roster: [
      { e:'normal',  t:'4体の間合いがばらけていると、どんな相手にも届きまつ。' },
      { e:'troubled', t:'「決定」を押すまでは、まだ反映されていませんからね。' },
      { e:'happy',   t:'好きな子で組むのがいちばん長続きしまつ (・∀・)' },
    ],
    monsterList: [
      { e:'normal',  t:'ベースモンは種そのもの、マスモンは育てた子でつ。' },
      { e:'normal',  t:'詳細を開くと、間合い適性まで見られまつよ。' },
      { e:'happy',   t:'増えてくると、眺めるだけで楽しくなりまつね♪♪' },
    ],
    masuList: [
      { e:'normal',  t:'総合力で並べると、育ち具合がひと目で分かりまつ。' },
      { e:'normal',  t:'名前は何度でも変えられまつよ。' },
      { e:'happy',   t:'この子たち、ぜんぶ{name}が育てた子 (´ー`*)ウンウン' },
    ],
    masuAutoEnhance: [
      { e:'normal',  t:'決めておけば、あとは私が順番に振っておきまつ。' },
      { e:'normal',  t:'転生しても消えないので、一度決めれば長く使えまつ。' },
      { e:'happy',   t:'不安なら、大事な子だけONにしても大丈夫でつ♪♪' },
    ],
    masuEnhance: [
      { e:'normal',  t:'適性と能力値、どちらにも振れまつ。' },
      { e:'normal',  t:'よく使う距離から上げると、実感しやすいでつよ。' },
      { e:'wink',    t:'振り直しはリセットの書でできまつから、気楽に (・∀・)' },
    ],
    temple: [
      { e:'troubled', t:'合体・限界突破・転生・寄付。どれも戻せませんからね。' },
      { e:'happy',    t:'再生は初回無料でつ。試すならそこからどうぞ♪♪' },
      { e:'normal',   t:'ここに来ると、少し背筋が伸びまつ (´ー`*)' },
    ],
    fusion: [
      { e:'normal',  t:'主に残したい子を先に決めると、迷いません。' },
      { e:'normal',  t:'副の絆経験値は、まるごと主へ移りまつ。' },
      { e:'happy',   t:'思いがけない組み合わせが当たりのこと、ありまつ (・∀・)' },
    ],
    rebirth: [
      { e:'normal',  t:'上限が伸びるので、育てきった子ほど効きまつ。' },
      { e:'normal',  t:'かかるダイヤは絆Lvぶん。育つほど高くなりまつ。' },
      { e:'excited', t:'星が増える瞬間、私も少し嬉しくなりまつ♪♪' },
    ],
    transcendence: [
      { e:'normal',  t:'Lv400まで育てた子だけが進める道でつ。' },
      { e:'normal',  t:'超越ポイントは基礎値を上げまつ。転生しても消えません。' },
      { e:'happy',   t:'ここまで来る人、そんなに多くないんでつよ (´ー`*)ウンウン' },
    ],
    reincarnate: [
      { e:'normal',   t:'別の姿へ生まれ変わりまつ。技は選んで引き継げまつよ。' },
      { e:'troubled', t:'元へは戻せませんから、ゆっくり決めましょ。' },
      { e:'excited',  t:'新しい姿を見る瞬間、毎回どきどきしまつ (・∀・)' },
    ],
    donation: [
      { e:'normal',   t:'累計絆経験値と同じ数のダイヤになりまつ。' },
      { e:'normal',   t:'編成が崩れる子は選べないようになってまつよ。' },
      { e:'troubled', t:'迷っているなら、今日はやめておくのも手でつ (´ー`*)' },
    ],
    pasture: [
      { e:'normal',  t:'5体まで村に出せまつ。強さには関わりません。' },
      { e:'happy',   t:'見た目で選んで大丈夫でつよ♪♪' },
      { e:'happy',   t:'にぎやかになると、私も嬉しいんでつ (´ー`*)ウンウン' },
    ],
    market: [
      { e:'normal',  t:'アイコンはpt、そのほかはダイヤでつ。' },
      { e:'wink',    t:'買っただけでは使えません。編成に入れてくださいね。' },
      { e:'normal',  t:'欲しいものがあるなら、少し貯めてからでも遅くないでつ。' },
    ],
    inventory: [
      { e:'normal',  t:'使いどきを選べるのが、アイテムのいいところでつ。' },
      { e:'normal',  t:'絆ポイントリセットの書は、振り直したい日のために。' },
      { e:'wink',    t:'貯めこむより、使ってしまったほうが得でつよ (・∀・)' },
    ],
    giftClaimable: [
      { e:'normal',  t:'30日で期限が切れまつ。早めに受け取りましょ。' },
      { e:'happy',   t:'まとめて受け取れまつよ♪♪' },
      { e:'excited', t:'何が入っているか、私もちょっと気になりまつ (´ー`*)' },
    ],
    giftEmpty: [
      { e:'normal',  t:'ここが空なのは、ちゃんと受け取れている証でつ。' },
      { e:'normal',  t:'ミッションを進めると、また届きまつよ。' },
      { e:'happy',   t:'また明日、覗いてみましょ♪♪' },
    ],
    missionsClaimable: [
      { e:'normal',  t:'受け取ると仲良し度も少し増えまつ。' },
      { e:'normal',  t:'ギフトへ届きまつから、そちらも見てくださいね。' },
      { e:'happy',   t:'こつこつ進んでいるの、えらいと思いまつ (´ー`*)ウンウン' },
    ],
    missionsNormal: [
      { e:'normal',  t:'デイリーは毎日、ウィークリーは毎週でつ。' },
      { e:'happy',   t:'遊んでいれば自然と進むものが多いでつよ♪♪' },
      { e:'normal',  t:'全部やらなくても大丈夫。届くぶんだけで十分でつ。' },
    ],
    profile: [
      { e:'normal',  t:'ここの名前が、そのままランキングに出まつ。' },
      { e:'normal',  t:'アイコンはptで増やせまつよ。' },
      { e:'happy',   t:'記録を見返すと、進んできた形が分かりまつ (´ー`*)ウンウン' },
    ],
    settings: [
      { e:'normal',  t:'音量は好みで大丈夫でつ。長く遊ぶなら小さめも。' },
      { e:'happy',   t:'BGMアレンジは、モードごとに選べまつよ♪♪' },
      { e:'troubled', t:'引き継ぎコードだけは、控えておいてくださいね。' },
    ],
    helpTop: [
      { e:'normal',  t:'カテゴリ → 項目 → 説明の3段でつ。' },
      { e:'normal',  t:'数字の表は実データから作ってまつから、古くなりません。' },
      { e:'happy',   t:'読んでも分からなければ、遊んでみるのが早いでつ (・∀・)' },
    ],
  },
});

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
  momosuke: {
    intro: { e:'wink',    t:'はいはーい、ももだよ♪ キミの助手、やってあげる。……で、名前は？' },
    name:  { e:'happy',   t:'ふーん、いい名前じゃん♪ つぎはアイコンね、はやくはやく〜！' },
    icon:  { e:'normal',  t:'アイコンはそれでいいんだ？ ……ま、悪くないけど♡ あとは名前だけだよ。' },
    ready: { e:'excited', t:'そろったじゃん♪ 「けってい」押して押して〜！' },
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

// ---------- ももすけ登場の会話(モンヒロビート プレオープン) ----------
// モンヒロビートが遊べるようになったのをきっかけに、ももすけが現れて、そのまま居着く。
//
// 【3人の関係】★重要
// みゅあ・きき・ももすけは、もともとの知り合い。初対面ではないので
// 「はじめまして」を言わせないこと。久しぶりに会った空気にする。
//
// 【呼び方は固定】★重要
//   もも → みゅあ … 「みゅあねぇ」
//   もも → きき   … 「ききちゃん」
//   きき → もも   … 「ももさん」
//   みゅあ → もも … 「もも」
// 3人同士の会話なので、プレイヤーへの呼び方(親密度で変わるもの)は使わない。
// そのため本文に {name} を書かない。最後の1行だけ、ももがプレイヤーへ
// 「ますたー」と呼びかけるが、これはこの場面かぎりで、ふだんの呼び方には使わない。
//
// 【音ゲーの得手不得手】★重要
//   きき  … 得意 ／ みゅあ … 苦手 ／ もも … ふつうに楽しんでいる
// ももは煽るけれど、本当に上手い相手(きき)はきちんと認める。そこが憎めない所。
//
// 【名前の出し方】
// 最初に正式名称「モンヒロビート」を出し、そのあとは略称「モンビー」で通す。
const ASSISTANT_MOMOSUKE_INTRO = [
  // STEP1: ももが音楽に乗ってモンビーを遊んでいる
  { who:'momosuke', e:'excited',  t:'はいっ♪ そこっ！ ……ふふーん、余裕すぎ♡' },
  { who:'momosuke', e:'wink',     t:'こんなのミスる人いるの〜？' },
  // STEP2: みゅあ・ききが来る
  { who:'mua',      e:'surprise', t:'……ん？ この曲……' },
  { who:'mua',      e:'surprise', t:'え、もも！？' },
  { who:'kiki',     e:'surprise', t:'ももさん！？' },
  // STEP3: 3人は元々の知り合い
  { who:'momosuke', e:'happy',    t:'ん？ あ、みゅあねぇ。ききちゃんもいるじゃん♪' },
  { who:'momosuke', e:'wink',     t:'ひさしぶり〜。ふたりとも元気してた？' },
  // STEP4
  { who:'mua',      e:'troubled', t:'いや、なんでここにいるの？' },
  { who:'kiki',     e:'normal',   t:'ももさん、何をしているんですか？' },
  // STEP5: モンビー紹介(ここで正式名称。以降は略称)
  { who:'momosuke', e:'excited',  t:'え〜、知らないの？ 『モンヒロビート』っていうのが始まったんだよ♡' },
  { who:'momosuke', e:'happy',    t:'音楽に合わせて、流れてくるノーツを取るの。タイミングが命ってやつ♪' },
  { who:'momosuke', e:'normal',   t:'曲も難易度もいろいろあってさ。マスモンがノーツになって出てきたりもするんだよ。' },
  { who:'momosuke', e:'wink',     t:'モンビーって呼んでる。かわいいでしょ♡' },
  // STEP6: みゅあは苦手
  { who:'mua',      e:'troubled', t:'……これ、押すところ多くない？' },
  { who:'momosuke', e:'wink',     t:'え〜？ みゅあねぇ、まさかできないの〜？♡' },
  { who:'mua',      e:'angry',    t:'できるし！' },
  { who:'mua',      e:'crying',   t:'……あれ？ あれっ！？ ちょ、待って、速い速い速い！' },
  { who:'momosuke', e:'excited',  t:'あははっ、みゅあねぇざ〜こ♡ ざ〜こ♪' },
  { who:'mua',      e:'angry',    t:'うるさ〜い！ もう一回！ もう一回やらせて！' },
  // STEP7: ききは普通に上手い
  { who:'momosuke', e:'wink',     t:'じゃあ次。ききちゃんは……ちゃんとついてこれるかな〜♡' },
  { who:'kiki',     e:'normal',   t:'では、失礼して。' },
  { who:'kiki',     e:'happy',    t:'……こう、ですか？' },
  { who:'momosuke', e:'surprise', t:'え、ききちゃん普通にうまくない？' },
  { who:'kiki',     e:'wink',     t:'リズムを取るのは得意なんでつ♪' },
  { who:'momosuke', e:'excited',  t:'すご……ちょっと悔しいけど、それは素直にすごい！ 認める♪' },
  { who:'mua',      e:'troubled', t:'……あたしだけ？ あたしだけなの？' },
  // STEP8-9: 「で、モンビーは分かったけど……」→「え？」「え？」
  { who:'mua',      e:'normal',   t:'で、モンビーは分かったけど……' },
  { who:'mua',      e:'normal',   t:'ももはいつ帰るの？' },
  { who:'momosuke', e:'surprise', t:'え？' },
  { who:'mua',      e:'surprise', t:'え？' },
  // STEP10
  { who:'momosuke', e:'normal',   t:'別にここにいてもよくない？' },
  { who:'kiki',     e:'surprise', t:'ももさん、もう居着くつもりなんですか……？' },
  // STEP11
  { who:'momosuke', e:'excited',  t:'いいじゃんいいじゃん♪ もももここ気に入ったし♡' },
  { who:'mua',      e:'happy',    t:'まあ、ももならいいけど……' },
  { who:'momosuke', e:'excited',  t:'決まり〜♪' },
  { who:'kiki',     e:'happy',    t:'……にぎやかになりまつね。よろしくお願いしまつ、ももさん。' },
  { who:'momosuke', e:'wink',     t:'こちらこそ♪ ききちゃん、またモンビー付き合ってね♡' },
  // 加入。ここだけプレイヤーへ呼びかける
  { who:'momosuke', e:'happy',    t:'今日からもももここにいるから♡ よろしくね、ますたー♪' },
  { who:'mua',      e:'wink',     t:'案内してもらう子は、プロフィールからいつでも選べるからね！' },
];
// この会話の中だけで使う、3人がお互いを呼ぶ名前。画面の見出しにも使う
const ASSISTANT_MOMOSUKE_INTRO_CALLS = { mua: 'もも', kiki: 'ももさん', momosuke: 'みゅあねぇ／ききちゃん' };

// ---------- モンヒロビート 週末ゲリラ杯(2026-09-11) ----------
// 2026-09-11・ユーザー指示「みゅあの前にイベント発生で、助手たちの会話ストーリーも入れてほしい。
// そのあとに助手からの説明みたいな」。
//
// 流れ: この会話 → みゅあ(設定している助手)の告知でルールを説明 → 遊びに行く。
// 会話では「何が始まったか」の空気だけを作り、細かいルール(報酬の個数・順位)は
// 告知とヘルプに任せる。ここへ数字を書くと、次のイベントで必ず古くなる。
//
// ★曲は「風がそよぐ場所」(ユーザー指示)。EVENT_BGM_SCENES 経由で鳴らす。
// ★正式名称は「モンヒロビート」。略称「モンビー」を使うのは、ももすけが愛称として
//   呼ぶところだけ(CLAUDE.md の名前の決めごと)。
const ASSISTANT_MONBEAT_CUP_EVENT = [
  // 導入: ももすけが騒いでいる
  { who:'momosuke', e:'excited',  t:'ねぇねぇ、聞いて聞いて〜！ 大ニュース♪' },
  { who:'mua',      e:'surprise', t:'わ、びっくりした。どうしたの、もも？' },
  { who:'kiki',     e:'normal',   t:'そんなに慌てて、何かありまつか？' },
  { who:'momosuke', e:'wink',     t:'モンビーでね、はじめての大会やることになったの♡' },
  // ★ききだけは正式名称で言い直す。これが「モンビー＝モンヒロビート」の説明にもなっている
  { who:'kiki',     e:'normal',   t:'モンビー……モンヒロビートのことでつね。' },
  { who:'momosuke', e:'happy',    t:'そーそー。ききちゃん、いちいち言い直すよね〜♪' },
  { who:'kiki',     e:'wink',     t:'正しい名前で呼んであげたいだけでつ。' },
  // 大会の名前
  { who:'momosuke', e:'excited',  t:'その名も「週末ゲリラ杯」！ ……ふふ、ゲリラだから急なのは許してね♪' },
  { who:'kiki',     e:'surprise', t:'ゲリラ……。準備の時間はどこへ行ったんでつか。' },
  { who:'mua',      e:'happy',    t:'まあまあ。急だからこそ、みんな横一線ってことでしょ？' },
  { who:'momosuke', e:'wink',     t:'みゅあねぇはいつも前向きだね〜。そういうとこ好き♡' },
  // ルール: 対象曲と期間
  { who:'momosuke', e:'happy',    t:'対象は3曲だけ。しかも、その期間に出したスコアだけで競うの。' },
  { who:'mua',      e:'surprise', t:'えっ、今までの記録は持ち込めないってこと？' },
  { who:'momosuke', e:'excited',  t:'そういうこと！ だから今からでも間に合うんだよ〜♪' },
  { who:'mua',      e:'excited',  t:'それいいね！ モンビー始めたばっかりの子でも、ちゃんと戦えるってことでしょ？' },
  // ★2回目の言い直し。ききだけが正式名称で受け直す
  { who:'kiki',     e:'normal',   t:'……モンヒロビート、でつね。はい、始めたばかりの方にも出番がありまつ。' },
  { who:'mua',      e:'troubled', t:'あっ、ごめん。あたしもつい短いほうで呼んじゃう。' },
  { who:'momosuke', e:'happy',    t:'ききちゃん、そこ絶対ゆずらないよね〜♪' },
  // 部門
  { who:'mua',      e:'normal',   t:'3曲って、1曲ずつ順位が出るの？' },
  { who:'momosuke', e:'wink',     t:'曲ごとの順位と、3曲ぜんぶの合計の順位。どっちもあるよ♡' },
  { who:'kiki',     e:'happy',    t:'1曲だけでも合計に載るのでつね。それなら気楽でつ。' },
  // 報酬
  { who:'mua',      e:'normal',   t:'……で、ごほうびは？' },
  { who:'momosuke', e:'excited',  t:'みゅあねぇ、そこ食いつくの早くない？' },
  { who:'mua',      e:'troubled', t:'だ、だって大事じゃない！' },
  { who:'momosuke', e:'happy',    t:'順位のごほうびと、遊んだだけでもらえるぶん。どっちもあるよ。' },
  { who:'kiki',     e:'surprise', t:'入賞しなくてももらえるんでつか。' },
  { who:'momosuke', e:'wink',     t:'3曲ぜんぶ遊べばね♪ 中身は……あとで出るから見てて♡' },
  { who:'mua',      e:'excited',  t:'えっ、じゃあ遊ばないと損じゃない！' },
  // ももの自慢 → 3人のやりとり
  { who:'momosuke', e:'happy',    t:'ちなみに、ももはもう3曲ぜんぶ叩いてきたけど？' },
  { who:'kiki',     e:'surprise', t:'……告知より先に遊んでたんでつか。' },
  { who:'mua',      e:'troubled', t:'もも、それはさすがにズルくない？' },
  { who:'momosuke', e:'wink',     t:'えー？ 早い者勝ちでしょ〜♪' },
  { who:'mua',      e:'angry',    t:'むー。じゃああたし、もものスコア抜くから。' },
  { who:'momosuke', e:'excited',  t:'言ったね？ ……ふふ、やってみてよ♡' },
  { who:'kiki',     e:'troubled', t:'あの、助手が本気になってどうするんでつか……。' },
  // 締め。このあと助手の告知でルールの説明へ続く
  { who:'mua',      e:'excited',  t:'よーし、{name}！ あたしたちも行こ？' },
  { who:'kiki',     e:'happy',    t:'{name}、モンヒロビートでお待ちしてまつ。記録、楽しみにしてまつね♪' },
  { who:'momosuke', e:'excited',  t:'それじゃ、週末ゲリラ杯……スタート！♡' },
];
// 会話の中だけの呼び名(回想の一覧にも使う)
const ASSISTANT_MONBEAT_CUP_EVENT_CALLS = { mua: 'もも', kiki: 'ももさん', momosuke: 'みゅあねぇ／ききちゃん' };

// 週末ゲリラ杯の閉幕(2026-09-13・ユーザー指示「初のイベントで結構な数が参加してくれて
// 感謝の気持ちとして参加賞に勇者の証を10個追加でプレゼント。そんな感じのやつを助手の
// ストーリーで作って」)。**イベントが終わった時刻に自動で流れる**。
//
// ★数字(勇者の証10個)はこの台本に書いてある1か所だけ。実際に配るのは
//   data/rhythm-event.js の participationReward。食い違うと嘘になるので、
//   tools/mode/rhythm-event-thanks-check.js が突き合わせる。
const ASSISTANT_MONBEAT_CUP_THANKS = [
  // 導入: 終わった直後の3人
  { who:'momosuke', e:'happy',    t:'……ふぅ。週末ゲリラ杯、これにて閉幕♡' },
  { who:'kiki',     e:'normal',   t:'おつかれさまでつ、ももさん。' },
  { who:'mua',      e:'excited',  t:'ねえねえ、集計見た!? あたしびっくりしたんだけど。' },
  { who:'momosuke', e:'surprise', t:'見た見た〜。……正直ね、ももは「数人来てくれたらいいな」くらいに思ってたの。' },
  { who:'kiki',     e:'surprise', t:'ゲリラ告知でつからね。準備期間ゼロでつし。' },
  { who:'momosuke', e:'excited',  t:'それなのに、あんなにいっぱい叩きに来てくれてさ〜。' },
  // 感謝
  { who:'mua',      e:'happy',    t:'しかも1回だけじゃなくて、何回も来てくれてた人が多かったよね。' },
  { who:'kiki',     e:'happy',    t:'記録が伸びていく様子が、そのまま残っていまつ。見ていて嬉しかったでつ。' },
  { who:'momosuke', e:'troubled', t:'……なんかね、もものほうが元気もらっちゃった。' },
  { who:'mua',      e:'surprise', t:'めずらしい。もも、しおらしくなってる。' },
  { who:'momosuke', e:'angry',    t:'うるさいなー！ ……たまには素直にもなるの！' },
  // 追加報酬
  { who:'momosuke', e:'wink',     t:'でね。お礼にひとつ、勝手に決めてきた♡' },
  { who:'kiki',     e:'troubled', t:'……また相談なしでつか。' },
  { who:'momosuke', e:'happy',    t:'参加賞にね、勇者の証を10個おまけすることにしたの。' },
  { who:'mua',      e:'surprise', t:'じゅっ……10個!? もも、それ気前よすぎない!?' },
  { who:'kiki',     e:'surprise', t:'魂格進化に使うものでつよ。ひとつでも貴重でつ。' },
  { who:'momosuke', e:'excited',  t:'いいの！ はじめての大会に付き合ってくれたお礼なんだから♪' },
  { who:'mua',      e:'happy',    t:'……まあ、それだけの人が来てくれたってことだもんね。' },
  { who:'kiki',     e:'normal',   t:'では、受け取りの案内も直しておきまつね。' },
  // 受け取り方
  { who:'momosuke', e:'wink',     t:'対象曲を3曲ぜんぶ遊んだ人が参加賞。そこに証10個が乗るよ♡' },
  { who:'mua',      e:'normal',   t:'入賞したぶんとは別ってこと？' },
  { who:'momosuke', e:'happy',    t:'別々♪ どっちも当てはまるなら、両方もらえる。' },
  { who:'kiki',     e:'happy',    t:'受け取りは、このあと出る画面の「受け取る」からでつ。' },
  { who:'mua',      e:'troubled', t:'あ、もし出なかったら……？' },
  { who:'kiki',     e:'normal',   t:'条件に届かなかったときは何も出ません。順位は終わった時点で決まっていまつ。' },
  { who:'momosuke', e:'normal',   t:'受け取れるのは2週間だから、そこだけ忘れないでね〜。' },
  // 次回へ
  { who:'mua',      e:'excited',  t:'ねえもも、次もやるの？' },
  { who:'momosuke', e:'wink',     t:'ふふ。……どうしよっかな♡' },
  { who:'kiki',     e:'troubled', t:'その言い方、だいたいやる気でつよね。' },
  { who:'momosuke', e:'excited',  t:'バレた？ ……まあ、様子を見ながらね♪' },
  // 締め
  { who:'momosuke', e:'happy',    t:'{name}、来てくれてほんとにありがとう。' },
  { who:'kiki',     e:'happy',    t:'{name}、おつかれさまでつ。記録はぜんぶ残っていまつよ。' },
  { who:'mua',      e:'excited',  t:'また next の大会でも、いっしょに叩こうね！' },
  { who:'mua',      e:'troubled', t:'……あっ、いま「next」って言っちゃった。次ね、次！' },
  { who:'momosuke', e:'happy',    t:'みゅあねぇ、そういうとこだよ〜♡' },
];
const ASSISTANT_MONBEAT_CUP_THANKS_CALLS = { mua: 'もも', kiki: 'ももさん', momosuke: 'みゅあねぇ／ききちゃん' };

// ---------- 第2回イベント「異世界交響祭」(2026-09-17) ----------
// ドラが会話の中心に出てくる回。台本はユーザーが書いたものをそのまま入れている。
//
// ★ドラは「はじめまして」の人ではない。アシストカード・ブリーダーの教え「ドラの緑膝」・
//   マーケットのアイコンで前から居る。みゅあ達も存在は知っている、という前提で書かれている。
// ★呼び方: みゅあ→ドラケン / きき→ドラさん / ももすけ→ドラちゃん /
//   ドラ→きき は「靴下さん」、ドラ→ももすけ は「もも」(好意が暴走すると「ももぉ〜」)。
//   ドラの一人称は必ず「おで」。
// ★最後まで見ると markRhythmEventStorySeen(id) が走り、助手ドラが解放される
//   (ASSISTANT_UNLOCK_STORIES)。回想で見直しても同じidが並ぶだけなので二重解放にならない。
const ASSISTANT_SYMPHONY_EVENT = [
  // SCENE 1 ドラ登場
  { who:'mua',      e:'surprise', t:'あれっ！？ ドラケンじゃん！' },
  { who:'dra',      e:'normal',   t:'おいおい、その反応なんなんだよ。おでは前からいるだろ。アシストカードに' },
  { who:'mua',      e:'happy',    t:'いや、それはそうなんだけど！ こうやって普通に出てくるのなんか新鮮なんだって！' },
  { who:'kiki',     e:'happy',    t:'ドラさん、ちゃんとお話しするのはほとんど初めてでつね！' },
  { who:'dra',      e:'happy',    t:'そうなんよ、靴下さん。今までは膝ばっか働かされてたからな' },
  { who:'kiki',     e:'angry',    t:'誰が靴下さんでつか！' },
  { who:'dra',      e:'normal',   t:'何言ってんだよ。おでら同じニオイを背負ってる仲だろ？' },
  { who:'kiki',     e:'angry',    t:'そんな仲になった覚えありません！' },
  { who:'mua',      e:'happy',    t:'出た、足臭い仲間' },
  { who:'kiki',     e:'troubled', t:'仲間じゃありません！' },
  // SCENE 2 もも登場
  { who:'momosuke', e:'happy',    t:'あっ、ドラちゃんだ〜♡' },
  { who:'dra',      e:'excited',  t:'ももぉ〜！' },
  { who:'momosuke', e:'normal',   t:'今日も膝くさいの？' },
  { who:'dra',      e:'troubled', t:'ももぉ……会って一発目に聞くことそれかよ……' },
  { who:'momosuke', e:'wink',     t:'じゃあ今日はいい匂いだったら、ちょっと好きになってあげる♡' },
  { who:'dra',      e:'surprise', t:'マジ！？ もも、おで今日けっこう――' },
  { who:'momosuke', e:'happy',    t:'うそ♡' },
  { who:'dra',      e:'troubled', t:'ももぉぉ……！' },
  { who:'mua',      e:'happy',    t:'ドラケン、今日も簡単だね' },
  { who:'dra',      e:'angry',    t:'おい、みゅあ。おでをチョロいみたいに言うなよ' },
  { who:'momosuke', e:'wink',     t:'チョロいよ♡' },
  { who:'dra',      e:'troubled', t:'ももが言うと否定できねぇんよ……' },
  // SCENE 3 ドラが持ってきたもの
  { who:'dra',      e:'normal',   t:'まあ今日は、みんなに会いに来ただけじゃないんよ' },
  { who:'kiki',     e:'normal',   t:'何かあるんでつか？' },
  { who:'dra',      e:'happy',    t:'モンヒロビートの第2回イベントな' },
  { who:'mua',      e:'surprise', t:'もう第2回やるの！？' },
  { who:'dra',      e:'happy',    t:'やるよ。しかも今回は3曲ある' },
  { who:'kiki',     e:'excited',  t:'3曲！' },
  { who:'dra',      e:'normal',   t:'まず一つ目が――「もう一つの世界へ」' },
  { who:'mua',      e:'normal',   t:'あ、この曲もうモンビーに入ってるよね？' },
  { who:'dra',      e:'happy',    t:'そうそう。これ、おでが作ってるゲーム「CREATE MONSTERS」で使ってる曲なんよ' },
  { who:'kiki',     e:'surprise', t:'ドラさん、ゲームも作ってるんでつか？' },
  { who:'dra',      e:'happy',    t:'作ってるよ。おで、こういうのちまちま作るの好きなんよ' },
  { who:'momosuke', e:'wink',     t:'ドラちゃん意外とそういうことできるんだ〜♡' },
  { who:'dra',      e:'angry',    t:'おい、もも。“意外と”はいらんだろ' },
  { who:'momosuke', e:'happy',    t:'じゃあ……ドラちゃん、かっこいい♡' },
  { who:'dra',      e:'surprise', t:'……えっ' },
  { who:'momosuke', e:'wink',     t:'今、本気にした？' },
  { who:'dra',      e:'troubled', t:'ももぉ〜……おでの心で遊ぶなよぉ……' },
  // SCENE 4 残り2曲
  { who:'kiki',     e:'excited',  t:'残りの2曲も教えてください！' },
  { who:'dra',      e:'normal',   t:'二つ目は、いちかさんの「Stay With Me ～Locked Fate～ remix」' },
  { who:'mua',      e:'excited',  t:'おおー！' },
  { who:'dra',      e:'normal',   t:'で、三つ目が仙夜玖子さんの「The City Beneath the Comets」' },
  { who:'kiki',     e:'happy',    t:'この3曲が今回のイベント対象曲なんでつね！' },
  { who:'dra',      e:'happy',    t:'そういうこと。3曲とも雰囲気違うし、好きなのから遊んでくれればいいよ' },
  { who:'momosuke', e:'wink',     t:'私はドラちゃんの曲からやってあげよっかな〜♡' },
  { who:'dra',      e:'excited',  t:'ももぉ！ マジ！？' },
  { who:'momosuke', e:'normal',   t:'どうしよっかな〜♡' },
  { who:'dra',      e:'troubled', t:'頼むから一回くらい素直に喜ばせてくれよ……' },
  // SCENE 5 異世界交響祭
  { who:'mua',      e:'normal',   t:'で、今回のイベント名は？' },
  { who:'dra',      e:'happy',    t:'第2回 モンヒロビート――「異世界交響祭」' },
  { who:'kiki',     e:'excited',  t:'異世界交響祭！' },
  { who:'dra',      e:'normal',   t:'音でいろんな世界がつながる、みたいな感じだな' },
  { who:'mua',      e:'happy',    t:'「もう一つの世界へ」にもぴったりじゃん！' },
  { who:'dra',      e:'happy',    t:'だろ？ えへへ' },
  // SCENE 6 ビートP
  { who:'dra',      e:'normal',   t:'で、今回もう一個ちゃんと覚えてほしいのがある' },
  { who:'mua',      e:'normal',   t:'なに？' },
  { who:'dra',      e:'happy',    t:'ビートP' },
  { who:'kiki',     e:'surprise', t:'ビートP？' },
  { who:'dra',      e:'normal',   t:'イベント期間中にモンヒロビートを遊ぶと貯まっていくポイントなんよ' },
  { who:'kiki',     e:'normal',   t:'イベント対象曲だけでつか？' },
  { who:'dra',      e:'normal',   t:'いや。そこは違うんよ、靴下さん' },
  { who:'kiki',     e:'angry',    t:'だから靴下さんじゃないでつ！' },
  { who:'dra',      e:'happy',    t:'イベント開催中なら、公開されてる普通の曲でもビートPは貰える' },
  { who:'mua',      e:'surprise', t:'じゃあ好きな曲やってもいいんだ！' },
  { who:'dra',      e:'normal',   t:'そうそう。ただし――今回のイベント対象3曲はビートPが1.5倍' },
  { who:'kiki',     e:'excited',  t:'対象曲のほうが貯まりやすいんでつね！' },
  { who:'dra',      e:'happy',    t:'そういうこと' },
  // SCENE 7 スコアとビートP
  { who:'mua',      e:'normal',   t:'どれくらい貰えるの？' },
  { who:'dra',      e:'normal',   t:'スコアで変わる。たとえば普通の曲なら、80万点で80P、95万点で95P' },
  { who:'kiki',     e:'normal',   t:'そこまでは比較的ゆっくり増えるんでつね' },
  { who:'dra',      e:'happy',    t:'そう。でも95万点を超えてから伸びが大きくなる' },
  { who:'dra',      e:'normal',   t:'100万点なら基本200P' },
  { who:'kiki',     e:'surprise', t:'じゃあ今回のイベント曲で100万点なら……' },
  { who:'dra',      e:'excited',  t:'1.5倍で300P' },
  { who:'mua',      e:'excited',  t:'結構変わる！' },
  { who:'dra',      e:'normal',   t:'だから回数だけじゃなくて、いいスコア出す意味もあるんよ' },
  // SCENE 8 何度でも獲得
  { who:'mua',      e:'normal',   t:'でもさ、一回ベスト出したらもう貰えないとか？' },
  { who:'dra',      e:'normal',   t:'いや。ビートPはランキングとは別' },
  { who:'dra',      e:'happy',    t:'最後までちゃんと遊べば毎回貰える' },
  { who:'kiki',     e:'surprise', t:'自己ベストを更新しなくても？' },
  { who:'dra',      e:'normal',   t:'大丈夫。同じ曲を何回遊んでも、ちゃんと終わればその都度貰える' },
  { who:'mua',      e:'happy',    t:'それならランキング上位を狙わない人でも遊びやすいね！' },
  { who:'dra',      e:'happy',    t:'そういうこと。競いたい奴はランキングやればいいし、のんびりビートP集めてもいい。好きな遊び方すりゃいいんよ' },
  { who:'mua',      e:'happy',    t:'ドラケン、意外とちゃんと考えてるじゃん' },
  { who:'dra',      e:'angry',    t:'おい。おでをなんだと思ってんだよ' },
  { who:'momosuke', e:'normal',   t:'膝？' },
  { who:'dra',      e:'troubled', t:'ももぉ……人間として見てくれよぉ……' },
  // SCENE 9 ビートP交換所
  { who:'kiki',     e:'normal',   t:'貯めたビートPはどうするんでつか？' },
  { who:'dra',      e:'normal',   t:'マーケットにある「ビートP交換所」で使える' },
  { who:'dra',      e:'happy',    t:'貯めたビートPを使って、好きなアイテムと交換するんよ' },
  { who:'momosuke', e:'normal',   t:'イベントが終わったら余ったポイント消えちゃう？' },
  { who:'dra',      e:'happy',    t:'消えない' },
  { who:'dra',      e:'normal',   t:'次のイベントまでそのまま持ち越せる' },
  { who:'mua',      e:'surprise', t:'じゃあ無理に全部使わなくてもいいんだ！' },
  { who:'dra',      e:'normal',   t:'そう。交換所自体はイベント終わっても開いてるからな' },
  { who:'kiki',     e:'normal',   t:'でもイベントが終わったら、新しいビートPは増えない？' },
  { who:'dra',      e:'happy',    t:'正解、靴下さん' },
  { who:'kiki',     e:'angry',    t:'その呼び方で褒めないでください！' },
  { who:'dra',      e:'normal',   t:'照れんなって。同じ足臭仲間なんだから' },
  { who:'kiki',     e:'angry',    t:'違いまつ！！' },
  // SCENE 10 イベント開始
  { who:'dra',      e:'happy',    t:'まあ説明はこんなもんだな' },
  { who:'dra',      e:'normal',   t:'今回は3曲。ランキング狙うのもよし、ビートP集めるのもよし。好きに遊んでくれ' },
  { who:'momosuke', e:'wink',     t:'じゃあ私、「もう一つの世界へ」から遊ぼっかな〜♡' },
  { who:'dra',      e:'excited',  t:'ももぉ！！ おで今のは信じていい！？' },
  { who:'momosuke', e:'happy',    t:'ドラちゃんがお願いしてくれたらね♡' },
  { who:'dra',      e:'surprise', t:'お願いする！ めちゃくちゃお願いする！' },
  { who:'momosuke', e:'wink',     t:'じゃあ考えとく♡' },
  { who:'dra',      e:'troubled', t:'ももぉぉ……！' },
  { who:'mua',      e:'happy',    t:'はいはい。そろそろ始めるよ、ドラケン！' },
  { who:'kiki',     e:'excited',  t:'私もやりまつ！ ドラさん！' },
  { who:'dra',      e:'happy',    t:'おう、靴下さん。足でリズム取るなよ' },
  { who:'kiki',     e:'angry',    t:'ドラさん！！' },
  // SCENE 11 ドラ助手加入
  { who:'mua',      e:'happy',    t:'そうだドラケン。せっかくこうやって出てきたんだしさ' },
  { who:'dra',      e:'normal',   t:'ん？' },
  { who:'mua',      e:'happy',    t:'これから助手もやれば？' },
  { who:'dra',      e:'surprise', t:'おでが？' },
  { who:'kiki',     e:'happy',    t:'いいじゃないでつか！ ドラさん、説明も分かりやすかったでつし' },
  { who:'dra',      e:'troubled', t:'靴下さんにまともに褒められると、なんか調子狂うな……' },
  { who:'kiki',     e:'angry',    t:'余計な一言でつ！' },
  { who:'momosuke', e:'wink',     t:'ドラちゃん助手になるの？' },
  { who:'dra',      e:'normal',   t:'まあ……ももがいてほしいって言うなら' },
  { who:'momosuke', e:'happy',    t:'いてほしい♡' },
  { who:'dra',      e:'surprise', t:'えっ' },
  { who:'momosuke', e:'wink',     t:'助手としてね♡' },
  { who:'dra',      e:'troubled', t:'ももぉ〜……一瞬だけ夢見たじゃん……' },
  { who:'mua',      e:'happy',    t:'決まりだね！' },
  { who:'dra',      e:'happy',    t:'まあいいか。じゃあおでも助手やってみるわ' },
  { who:'dra',      e:'happy',    t:'困ったら呼んでくれ。膝以外もちゃんと役に立つからな。えへへ' },
];
const ASSISTANT_SYMPHONY_EVENT_CALLS = { mua: 'ドラケン', kiki: 'ドラさん', momosuke: 'ドラちゃん', dra: 'みゅあ／靴下さん／もも' };

// 第2回「異世界交響祭」の閉幕の会話(2026-09-20)。**イベントが終わった時刻に自動で流れる**。
// ★週末ゲリラ杯のときのような報酬の上乗せは無い。あれは「初開催のお礼」として
//   その回かぎりで決めたもので、毎回やると付いていない回が不満になる。
//   ここで知らせるのは「終わったこと」と「受け取りのしかた」の2つだけ。
// ★開幕(ASSISTANT_SYMPHONY_EVENT)で助手になったばかりのドラが、はじめて締めをやる。
// ★ききは「〜でつ」「〜まつ」で話す(2026-09-24・ユーザー指摘で開幕・閉幕とも直した)。
const ASSISTANT_SYMPHONY_THANKS = [
  // 閉幕
  { who:'dra',      e:'normal',   t:'……よし。異世界交響祭、これにて閉幕だ' },
  { who:'mua',      e:'happy',    t:'おつかれー、ドラケン。ちゃんと締まってたじゃん' },
  { who:'dra',      e:'happy',    t:'おでだって助手だからな。締めるとこは締めるわ' },
  { who:'kiki',     e:'normal',   t:'はじめてのお仕事にしては、上出来だと思いまつ' },
  { who:'dra',      e:'troubled', t:'靴下さん、それ褒めてるのか？' },
  { who:'kiki',     e:'angry',    t:'褒めてまつ！' },
  // 振り返り
  { who:'momosuke', e:'happy',    t:'3曲とも、ずいぶん賑やかだったねぇ♡' },
  { who:'mua',      e:'excited',  t:'ランキング、最後の日にめちゃくちゃ動いてたよね！' },
  { who:'kiki',     e:'happy',    t:'終わりぎわに記録を伸ばした方が、たくさんいたでつね' },
  { who:'dra',      e:'excited',  t:'そうそう！ おで、ずっと見てたんだけど最後の追い上げがすごくてな' },
  { who:'dra',      e:'happy',    t:'何回も何回も叩き直してる人がいてさ。ああいうの、見てて胸が熱くなるわ' },
  { who:'momosuke', e:'wink',     t:'ドラちゃん、すっかり主催者の顔してる♡' },
  { who:'dra',      e:'surprise', t:'えっ。そ、そうか？ ……えへへ' },
  { who:'mua',      e:'normal',   t:'チョロい' },
  { who:'dra',      e:'angry',    t:'うるさいぞみゅあ！' },
  // 受け取り
  { who:'kiki',     e:'normal',   t:'では、受け取りのご案内をしまつね' },
  { who:'dra',      e:'normal',   t:'おう。対象の3曲ぜんぶを遊んだ人には参加賞だ。順位に関係なくもらえる' },
  { who:'mua',      e:'normal',   t:'入賞したぶんは別だよね？' },
  { who:'dra',      e:'happy',    t:'別だな。どっちも当てはまるなら両方もらえる' },
  { who:'kiki',     e:'happy',    t:'受け取りは、このあと出る画面の「受け取る」からでつ' },
  { who:'momosuke', e:'normal',   t:'受け取れるのは2週間だからね。そこだけ忘れないで〜' },
  { who:'mua',      e:'troubled', t:'……もし何も出なかったら？' },
  { who:'kiki',     e:'normal',   t:'条件に届かなかったときは出ません。順位は終わった時点で決まっていまつ' },
  { who:'dra',      e:'normal',   t:'記録のほうは消えないから、あとから見返せるぞ' },
  // 次回へ
  { who:'mua',      e:'excited',  t:'ねえドラケン、次もやるの？' },
  { who:'dra',      e:'troubled', t:'おでに聞かれてもな……そこはももの管轄だろ' },
  { who:'momosuke', e:'wink',     t:'ふふ。ドラちゃんが手伝ってくれるなら、考えてもいいかも♡' },
  { who:'dra',      e:'excited',  t:'やる！ おでやる！ なんでもやる！' },
  { who:'kiki',     e:'troubled', t:'……即答でつね' },
  { who:'mua',      e:'happy',    t:'ドラケンって分かりやすくていいよね' },
  // 締め
  { who:'dra',      e:'happy',    t:'{name}、遊んでくれてありがとうな。おでの初仕事、付き合ってくれて助かった' },
  { who:'kiki',     e:'happy',    t:'{name}、おつかれさまでつ。記録はぜんぶ残っていまつよ' },
  { who:'momosuke', e:'happy',    t:'{name}、またモンヒロビートで会おうね♡' },
  { who:'mua',      e:'excited',  t:'次もぜったい叩きに来てよ！ 待ってるからね！' },
];
const ASSISTANT_SYMPHONY_THANKS_CALLS = { mua: 'ドラケン', kiki: 'ドラさん', momosuke: 'ドラちゃん', dra: 'みゅあ／靴下さん／もも' };

// ---------- ビートPがいつでも貯まるように(2026-09-24) ----------
// 2026-09-24・ユーザー指示「イベント限定でもらえるポイントをいつでももらえるように変更。
// ただしイベント時の1/5。今後ビートポイントで円盤石やアシカみたいなレアアイテムも実装予定。
// ストーリー含めて作って」。
//
// HOMEで1度だけ流す(開催中のイベントとは関係なく)。伝えるのは3つだけ。
//   ① イベントが無い日もビートPが貯まる
//   ② ただしイベント中の5分の1(イベント中の貯まり方は変わらない)
//   ③ ビートP交換所に、円盤石やアシストカードのような珍しい品を並べる準備をしている
// ★③は「準備中」までしか言わない。いつ・何Pで並ぶかは決まっていないので約束しない。
// ★「アシカ」はアシストカードの略。みゅあが海のアシカと取り違えるのは、略称の説明を兼ねている。
// ★正式名称は「モンヒロビート」。「モンビー」はももすけ・みゅあが愛称として呼ぶところだけ。
// ★ききは「〜でつ」「〜まつ」で話し、みゅあを「みゅあちん」と呼ぶ(2026-09-24・ユーザー指摘)。
const ASSISTANT_BEAT_POINT_ALWAYS = [
  // 導入: ドラが交換所の前でうろうろしている
  { who:'dra',      e:'troubled', t:'うーん……うーん……' },
  { who:'mua',      e:'surprise', t:'ドラケン、交換所の前で何うなってるの？' },
  { who:'dra',      e:'troubled', t:'いやな、ビートPがな。イベントが終わると、ぜんぜん増えなくなるだろ' },
  { who:'dra',      e:'normal',   t:'交換所はずっと開いてるのに、貯める手段がイベントの間だけってのは、なんか寂しくてな' },
  { who:'kiki',     e:'normal',   t:'たしかに、イベントのない週は交換所を眺めるだけでつね。' },
  // 知らせ: ももすけから
  { who:'momosuke', e:'wink',     t:'ふふ〜。そんなドラちゃんに、いいお知らせがあります♡' },
  { who:'dra',      e:'surprise', t:'えっ、なんだ？' },
  { who:'momosuke', e:'excited',  t:'今日から、イベントがない日もモンビーを遊べばビートPが貯まるようになりました〜♪' },
  { who:'kiki',     e:'normal',   t:'モンヒロビート、でつね。最後まで遊べば、どの公開曲でも貯まるんでつか？' },
  { who:'momosuke', e:'happy',    t:'そう！ いつもの曲なら、どれでもOKだよ♡' },
  { who:'dra',      e:'excited',  t:'ほんとか！ もも、それ最高じゃないか！' },
  // 条件: 5分の1
  { who:'momosuke', e:'normal',   t:'ただし〜、イベントのない日はイベント中の5分の1だけね' },
  { who:'mua',      e:'troubled', t:'えー、5分の1かぁ……' },
  { who:'momosuke', e:'wink',     t:'だって、いつでも同じだけ貯まったら、イベントの楽しみが減っちゃうでしょ？' },
  { who:'kiki',     e:'happy',    t:'イベント中の貯まり方はこれまでと同じなんでつね。対象曲の1.5倍もそのままでつ。' },
  { who:'mua',      e:'normal',   t:'そっか。ふだんはコツコツ、イベントのときはガッツリってことね' },
  { who:'dra',      e:'happy',    t:'コツコツでも、ゼロよりずっといいぞ。おで、毎日叩く' },
  { who:'kiki',     e:'normal',   t:'スコアが高いほど多くもらえるのも、イベント中と同じでつ。' },
  // 予告: 交換所のこれから
  { who:'momosuke', e:'excited',  t:'それとね……ここからは内緒の話なんだけど♡' },
  { who:'mua',      e:'surprise', t:'ん？ なになに？' },
  { who:'momosuke', e:'wink',     t:'ビートP交換所に、そのうち円盤石とか、アシカとか……珍しいものも並べようと思ってるの♪' },
  { who:'mua',      e:'surprise', t:'アシカ！？ 交換所で海の生き物もらえるの！？' },
  { who:'kiki',     e:'troubled', t:'みゅあちん……アシストカードの略でつ。' },
  { who:'mua',      e:'troubled', t:'あ、そっちか……ちょっと飼う気になってた' },
  { who:'dra',      e:'excited',  t:'円盤石もか！ それ、ビートPを貯めとく理由になるじゃないか' },
  { who:'momosuke', e:'normal',   t:'まだ準備中だから、いつ並ぶかはお楽しみね〜' },
  { who:'kiki',     e:'normal',   t:'それまでに貯めておいたぶんは、そのまま使えまつ。消えたりしないでつよ。' },
  // 締め
  { who:'dra',      e:'happy',    t:'よし決めた。おで、並んだ日に一番乗りできるように、今から貯めとく' },
  { who:'mua',      e:'angry',    t:'あたしだって負けないからね！' },
  { who:'momosuke', e:'happy',    t:'{name}も、ふだんのモンビーでコツコツ貯めておいてね♡' },
  { who:'kiki',     e:'happy',    t:'{name}、交換所に何が並ぶか、一緒に楽しみに待ちましょ♪' },
  { who:'dra',      e:'happy',    t:'{name}、並んだらちゃんと知らせるからな。えへへ' },
];
const ASSISTANT_BEAT_POINT_ALWAYS_CALLS = { mua: 'もも／ドラケン', kiki: 'みゅあちん／ももさん／ドラさん', momosuke: 'ドラちゃん', dra: 'みゅあ／もも' };

// ---------- タクティクスバトル登場(2026-09-21) ----------
// β公開に合わせて1度だけ流す導入。「今までのバトルと何が違うか」を4つだけ伝える。
//   ① ステータスを1体ずつ持つ(クラシックはパーティ全員の合計)
//   ② 勇者特性が供モンにも効く(持っている子ご本人に。クラシックは勇者モンのものを全体へ)
//   ③ 敵の顔ぶれがまるごと入れ替わった
//   ④ 敵の技の種類が増えた
//
// ★**助手はモンスターではない**。「ももの特性」のような言い方をしない
//   (2026-09-21、ももすけに「ももの特性も使えるんだ」と言わせてユーザーに指摘された)。
// ★**種別の呼び名をそのまま会話へ出さない**。「薙ぎ払い」と言われても何のことか分からない
//   (同日の指摘「せめて貫通攻撃や連撃とかにしたほうがいい」)。
//   画面に出る技名は敵ごとのもの(羅刹・不動明王…)で、薙ぎ払い等はその種別名。
// ★**特性だけが大事なのではない**。ステータスの高さも効く(同日の指摘)
//
// ★**間合いと攻撃予告はクラシックにもある。違いとして挙げない**
//   (2026-09-21、最初の台本でこの2つを「新しいところ」として書いてしまい、ユーザーに
//    「間合いはクラシックにもあった / 攻撃予告もクラシックにはあった」と指摘された)。
// ★数字(倍率・確率)を書かない。調整のたびに会話が嘘になる。
//   数字はヘルプとSCAN画面が実データから出す
const ASSISTANT_TACTICS_INTRO = [
  { who:'mua',      e:'excited',  t:'ねぇ聞いて！ バトルに新しい仕組みが来たんだって！' },
  { who:'kiki',     e:'happy',    t:'タクティクスバトル、でつね。編成の考え方がまるで変わりまつ♪' },
  { who:'momosuke', e:'normal',   t:'ふーん？ メンバーを選ぶだけじゃないの〜。' },
  { who:'dra',      e:'wink',     t:'それが違うんだよ。まず、ステータスを1体ずつ持ってる' },
  { who:'mua',      e:'surprise', t:'えっ、ライフもちからも、パーティ全員の合計じゃないの！？' },
  { who:'dra',      e:'normal',   t:'そう。だから誰が狙われてるかで、守る子も変わってくるんよ' },
  { who:'kiki',     e:'normal',   t:'それに、勇者特性が供モンにも効きまつ。持っている子ご本人に、でつね。' },
  { who:'momosuke', e:'surprise', t:'えっ、連れてく子の特性も、ぜんぶ使えるってこと？ ……それ、けっこう大きくない？' },
  { who:'dra',      e:'happy',    t:'そうなんよ。ステータスの高さも大事だし、どの特性を連れてくかも効いてくる' },
  { who:'mua',      e:'excited',  t:'誰を連れてくか、めっちゃ悩むやつじゃん！' },
  { who:'kiki',     e:'normal',   t:'敵の顔ぶれも、まるごと入れ替わっていまつ。' },
  { who:'momosuke', e:'troubled', t:'えっ、見たことない子ばっかりなんだけど。強さも分かんないし……。' },
  { who:'dra',      e:'troubled', t:'しかも技の種類が増えてるんだよ。連撃とか、ガードが効かない貫通攻撃とかな' },
  { who:'kiki',     e:'happy',    t:'どの技が来るかを見て、受け方を選ぶ。そこがいちばん楽しいところでつ♪' },
  { who:'momosuke', e:'excited',  t:'ふふん、ももなら全部読めちゃうし♡ ……たぶん。' },
  { who:'kiki',     e:'wink',     t:'いまはプロモードだけお試しで開いていまつ。残りは順番に増やしていきますね。' },
  { who:'mua',      e:'excited',  t:'よーし、さっそく行ってみよ♪ まずは誰を連れてくか決めよ！' },
];

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
//   alwaysUnlocked … true にすると、本編でまだ見ていなくても回想一覧に出す。
//                 「本編で流れるのを待たずに、ここから見てもいい」イベント用。
//                 最後まで見たら、本編で見たときと同じ扱い(解放・以後は自動で流さない)になる
const EVENT_REPLAYS = [
  // タクティクスバトルの導入(2026-09-21)。**公開するまでは回想にも出さない**
  // (releaseFlag。モードが見えていないのに会話だけあると、何の話か分からない)。
  // いまは alwaysUnlocked で「公開したら回想からいつでも見られる」形。
  // 本編で1度だけ流す導線は、β版を出すときに告知とセットで足す
  { id: 'tactics_intro', title: 'タクティクスバトル ～誰を連れていくか～', script: ASSISTANT_TACTICS_INTRO, unlockedKey: 'tacticsIntroSeen', releaseFlag: 'tacticsBattle', alwaysUnlocked: true },
  { id: 'kiki_intro', title: 'きき加入 ～ふたりの助手～', script: ASSISTANT_KIKI_INTRO, calls: ASSISTANT_KIKI_INTRO_CALLS, unlockedKey: 'kikiIntroSeen' },
  // ももすけ登場は、本編を待たずに回想からも見られる(2026-09-05・ユーザー指示)。
  // 新しく始めた人は最初の助手選択でももすけを選べるので、そもそも本編では流れない。
  // その人たちも、あとから「どういう経緯で来たのか」を見られるようにするため。
  { id: 'momosuke_intro', title: 'ももすけ登場 ～モンヒロビート～', script: ASSISTANT_MOMOSUKE_INTRO, calls: ASSISTANT_MOMOSUKE_INTRO_CALLS, unlockedKey: 'momosukeIntroSeen', alwaysUnlocked: true },
  // イベント開催の会話(2026-09-11)。開催中に1度だけ本編で流れ、そのあとは回想からいつでも見られる。
  // 期間が終わっても回想には残る(そのときどういう会話だったかを見返せるように)
  { id: 'monbeat_cup_2026_09', title: '週末ゲリラ杯 ～はじめての大会～', script: ASSISTANT_MONBEAT_CUP_EVENT, calls: ASSISTANT_MONBEAT_CUP_EVENT_CALLS, unlockedKey: 'monbeatCupEventSeen' },
  // 閉幕の会話(2026-09-13)。**イベントが終わった時刻に自動で流れる**。
  // 参加賞へ勇者の証10個を足したことを、ここで知らせる
  { id: 'monbeat_cup_2026_09_thanks', title: '週末ゲリラ杯 ～閉幕とお礼～', script: ASSISTANT_MONBEAT_CUP_THANKS, calls: ASSISTANT_MONBEAT_CUP_THANKS_CALLS, unlockedKey: 'monbeatCupThanksSeen' },
  // 第2回イベントの開催会話(2026-09-17)。最後まで見ると助手ドラが解放される
  // (ASSISTANT_UNLOCK_STORIES)。期間が終わっても回想からいつでも見返せる
  { id: 'symphony_2026_09_17', title: '異世界交響祭 ～ドラ登場～', script: ASSISTANT_SYMPHONY_EVENT, calls: ASSISTANT_SYMPHONY_EVENT_CALLS, unlockedKey: 'symphonyEventSeen' },
  // 第2回の閉幕の会話(2026-09-20)。**イベントが終わった時刻に自動で流れる**。
  // 報酬の上乗せは無いので、知らせるのは終わったことと受け取りのしかただけ
  { id: 'symphony_2026_09_17_thanks', title: '異世界交響祭 ～閉幕とお礼～', script: ASSISTANT_SYMPHONY_THANKS, calls: ASSISTANT_SYMPHONY_THANKS_CALLS, unlockedKey: 'symphonyThanksSeen' },
  // ビートPがいつでも貯まるようになった知らせ(2026-09-24)。HOMEで1度だけ流れ、そのあとは回想から見返せる
  { id: 'beat_point_always_2026_09_24', title: 'いつでもビートP ～交換所のこれから～', script: ASSISTANT_BEAT_POINT_ALWAYS, calls: ASSISTANT_BEAT_POINT_ALWAYS_CALLS, unlockedKey: 'beatPointAlwaysSeen' },
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
  momosuke: [
    { e:'wink',    t:'はじめまして〜♪ ももはももすけ。このゲームの助手だよ♡', title:'はじめまして' },
    { e:'happy',   t:'モンスター育てて、強いチーム作って……ま、ももがついてるんだから余裕でしょ？', title:'よろしくね♪' },
    { e:'excited', t:'それより、キミのこと教えてよ！ 名前とアイコン、決めちゃお♪', title:'まずは自己紹介から' },
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
  momosuke: [
    { e:'excited', t:'{name}、あらためてよろしく♪ とりあえず村、案内してあげる。', title:'あらためて、よろしく' },
    { e:'normal',  t:'目標はWAVE10のラスボス「ムー」を倒すこと。カードで戦うんだよ。', title:'このゲームの目的', help:'basics/goal' },
    { e:'normal',  t:'ここがHOME。建物をタップすればだいたい何とかなるから♪', title:'HOMEのこと', help:'home/roster' },
    { e:'wink',    t:'神殿では合体・転生・寄付。育成の土台だから、ちゃんと使ってよね？', title:'神殿', help:'masu/fusion', spot:'temple' },
    { e:'excited', t:'バトルで活躍した子は「マスモン」に登録できるの。育てるほど強くなるよ♪', title:'勇者モンを育てる', help:'masu/masumon', spot:'management' },
    { e:'happy',   t:'バトルは勇者モンを選んでカードで戦うよ。距離、めっちゃ大事だから覚えて。', title:'バトル', help:'battle/distance', spot:'battle' },
    { e:'normal',  t:'ランキングは「バトル」の中ね。モード切替のすぐ下のボタン。', title:'ランキングはバトルの中', help:'basics/ranking', spot:'battle' },
    { e:'happy',   t:'マーケットではモンスターやカードが買えるよ。ダイヤ、溶かしすぎないでね♡', title:'マーケット', help:'home/market', spot:'market' },
    { e:'surprise', t:'ミッションとギフトはこのへん。受け取り忘れてたら笑っちゃうよ？', title:'ミッションとギフト', help:'items/missions', spot:'reward' },
    { e:'normal',  t:'ヘルプは右上の「設定」の中。迷子になったら開けばいいから。', title:'ヘルプは設定の中', help:'tips/assistant', spot:'settings' },
    { e:'wink',    t:'ももはここにいるよ。呼びたくなったらタップして♡ ……ぜったい呼ぶでしょ♪', title:'それじゃ、いってらっしゃい', spot:'assistant' },
  ],
};
// ---------- モンビー(モンヒロビート)のチュートリアル ----------
// 初めてモンビーの曲えらびへ入ったときに、設定している助手が説明する(2026-09-05・ユーザー指示)。
// 村の案内(ASSISTANT_TUTORIAL)と同じ形なので、画面側は tutorialKind を 'rhythm' にするだけで動く。
//
//   e,t   … 表情とセリフ。t の {name} はそのときの呼び方に置き換わる
//   title … 吹き出しの小見出し
//   spot  … 光らせる場所のキー(曲えらび画面の rhythmTutorialSpotClass と対応)
//   help  … 'カテゴリid/項目id'。「この話をヘルプで詳しく見る」が出る
//
// 【並べ方】曲をえらぶ → 難易度をえらぶ → 遊び方 → まわりの機能、の順。
// 画面に無いものを光らせないよう、spot は曲えらび画面にある場所だけにする。
const ASSISTANT_RHYTHM_TUTORIAL = [
  { e:'excited', t:'{name}、ここが「モンヒロビート」だよ！ 曲に合わせてノーツを取る音ゲーだよ♪', title:'モンヒロビートへようこそ', help:'rhythm/rhythm-mode' },
  // 曲えらびに出していた「これは体験版です…」の断り書きは、場所を取りすぎるので
  // 画面から外して、代わりにここで話す(2026-09-05・ユーザー指示)。
  { e:'normal',  t:'いまは体験版で、公開している曲をEASY〜MASTERで遊べるよ。譜面は調整中だから、これから変わることもあるんだ。', title:'いまは体験版だよ', help:'rhythm/rhythm-demo-song' },
  { e:'normal',  t:'まずは曲えらび。ここに並んでるのが、いま遊べる曲だよ。', title:'曲をえらぶ', spot:'songList', help:'rhythm/rhythm-demo-song' },
  { e:'happy',   t:'曲の左の数字は「楽曲Lv.」。大きいほど難しい譜面ってこと。', title:'楽曲Lv.', spot:'songLevel' },
  { e:'normal',  t:'曲名の下のひし形は、その難易度をどこまで達成したかの印。クリア→フルコンボ→オールエクセレント→オールマーベラスの順に、どんどん派手な色になるよ♪', title:'ひし形は達成の印', spot:'achievement' },
  { e:'normal',  t:'曲をえらんだら、下(横画面だと右)で難易度をえらんでね。', title:'難易度をえらぶ', spot:'difficulty' },
  { e:'surprise', t:'EXPERTとMASTERは最初は鍵つき。その曲の1つ下の難易度をクリアすると挑めるようになるよ。', title:'EXPERT以上は解放式', spot:'difficulty', help:'rhythm/rhythm-unlock' },
  { e:'normal',  t:'ノーツは4種類。TAPは押す、HOLDは押さえ続ける、FLICKは払う、SLIDEはなぞる。', title:'ノーツは4種類', help:'rhythm/rhythm-note-types' },
  { e:'happy',   t:'タイミングが合うほど良い判定になるよ。MARVELOUS→EXCELLENT→GREAT→GOOD→BADの順ね。', title:'判定は5段階', help:'rhythm/rhythm-judgment' },
  { e:'excited', t:'続けて取るとコンボがのびて、全部つなぐと「フルコンボ」！ そこからさらに上の称号もあるんだ♪', title:'コンボをつなごう', help:'rhythm/rhythm-notes-and-effects' },
  { e:'normal',  t:'設定したマスモンは、曲の途中で「モンスターノーツ」になって流れてくるよ。取ると血統ごとの力が働くの。', title:'マスモンも一緒に', spot:'monsters', help:'rhythm/rhythm-monster-note-display' },
  { e:'happy',   t:'ノーツの速さや音量、判定のタイミング補正はオプションで変えられるよ。合わないと感じたらここ！', title:'オプション', spot:'options', help:'rhythm/rhythm-options' },
  { e:'excited', t:'スコアは全国ランキングに載るよ。難易度をまたいだ合算だから、上の難易度で挑むほど有利なんだ♪', title:'全国ランキング', help:'rhythm/rhythm-ranking' },
  { e:'wink',    t:'説明はいつでも「📖 遊びかた」から見られるよ。それじゃ、いってみよ〜！', title:'それでは、はじめよう', spot:'help' },
];
// 助手ごとの言い回し。骨組み(spot・help・順番)は変えない。
const ASSISTANT_RHYTHM_TUTORIAL_SETS = {
  kiki: [
    { e:'excited', t:'{name}、ここが「モンヒロビート」でつ！ 曲に合わせてノーツを取る音ゲーですね♪', title:'モンヒロビートへようこそ', help:'rhythm/rhythm-mode' },
    { e:'normal',  t:'いまは体験版で、公開している曲をEASY〜MASTERで遊べまつ。譜面は調整中なので、これから変わることもありまつ。', title:'いまは体験版でつ', help:'rhythm/rhythm-demo-song' },
    { e:'normal',  t:'まずは曲えらび。ここに並んでいるのが、いま遊べる曲でつ。', title:'曲をえらぶ', spot:'songList', help:'rhythm/rhythm-demo-song' },
    { e:'happy',   t:'曲の左の数字は「楽曲Lv.」でつ。大きいほど難しい譜面ということですね。', title:'楽曲Lv.', spot:'songLevel' },
    { e:'normal',  t:'曲名の下のひし形は、その難易度をどこまで達成したかの印でつ。クリア→フルコンボ→オールエクセレント→オールマーベラスの順に、どんどん派手になりまつ♪', title:'ひし形は達成の印', spot:'achievement' },
    { e:'normal',  t:'曲をえらんだら、下(横画面なら右)で難易度をえらんでほしいでつ。', title:'難易度をえらぶ', spot:'difficulty' },
    { e:'surprise', t:'EXPERTとMASTERは最初は鍵つきでつ。その曲の1つ下の難易度をクリアすると挑めまつ。', title:'EXPERT以上は解放式', spot:'difficulty', help:'rhythm/rhythm-unlock' },
    { e:'normal',  t:'ノーツは4種類。TAPは押す、HOLDは押さえ続ける、FLICKは払う、SLIDEはなぞる、でつ。', title:'ノーツは4種類', help:'rhythm/rhythm-note-types' },
    { e:'happy',   t:'タイミングが合うほど良い判定になりまつ。MARVELOUS→EXCELLENT→GREAT→GOOD→BADの順ですね。', title:'判定は5段階', help:'rhythm/rhythm-judgment' },
    { e:'excited', t:'続けて取るとコンボがのびて、全部つなぐと「フルコンボ」でつ！ さらに上の称号もありまつよ♪', title:'コンボをつなごう', help:'rhythm/rhythm-notes-and-effects' },
    { e:'normal',  t:'設定したマスモンは、曲の途中で「モンスターノーツ」になって流れてきまつ。取ると血統ごとの力が働きまつ。', title:'マスモンも一緒に', spot:'monsters', help:'rhythm/rhythm-monster-note-display' },
    { e:'happy',   t:'ノーツの速さや音量、判定のタイミング補正はオプションで変えられまつ。合わないと感じたらこちらへ。', title:'オプション', spot:'options', help:'rhythm/rhythm-options' },
    { e:'excited', t:'スコアは全国ランキングに載りまつ。難易度をまたいだ合算なので、上の難易度ほど有利でつ♪', title:'全国ランキング', help:'rhythm/rhythm-ranking' },
    { e:'wink',    t:'説明はいつでも「📖 遊びかた」から見られまつ。それでは、いってらっしゃい♪', title:'それでは、はじめましょ', spot:'help' },
  ],
  momosuke: [
    { e:'excited', t:'{name}、ここが「モンヒロビート」！ 曲に合わせて叩けばいいの♪ ちゃんとできるよね〜？♡', title:'モンヒロビートへようこそ', help:'rhythm/rhythm-mode' },
    { e:'normal',  t:'いまは体験版で、公開している曲をEASY〜MASTERで遊べるよ。譜面はまだ調整中だから変わるかも。', title:'いまは体験版だよ', help:'rhythm/rhythm-demo-song' },
    { e:'normal',  t:'まずは曲えらび。ここに並んでるのが遊べる曲ね。', title:'曲をえらぶ', spot:'songList', help:'rhythm/rhythm-demo-song' },
    { e:'happy',   t:'曲の左の数字は「楽曲Lv.」。大きいほど難しいってこと♪', title:'楽曲Lv.', spot:'songLevel' },
    { e:'normal',  t:'曲名の下のひし形は達成の印。クリア→フルコンボ→オールエクセレント→オールマーベラスの順に派手になるよ。全部そろえてみせてよ♡', title:'ひし形は達成の印', spot:'achievement' },
    { e:'normal',  t:'曲をえらんだら、下(横画面なら右)で難易度をえらんでね。', title:'難易度をえらぶ', spot:'difficulty' },
    { e:'surprise', t:'EXPERTとMASTERは最初は鍵つき。1つ下の難易度をクリアすれば開くよ。……開けられる？', title:'EXPERT以上は解放式', spot:'difficulty', help:'rhythm/rhythm-unlock' },
    { e:'normal',  t:'ノーツは4種類。TAPは押す、HOLDは押さえ続ける、FLICKは払う、SLIDEはなぞる。かんたんでしょ？', title:'ノーツは4種類', help:'rhythm/rhythm-note-types' },
    { e:'happy',   t:'タイミングが合うほどいい判定になるよ。MARVELOUS→EXCELLENT→GREAT→GOOD→BADの順ね。', title:'判定は5段階', help:'rhythm/rhythm-judgment' },
    { e:'excited', t:'続けて取るとコンボ！ 全部つなげば「フルコンボ」だよ♪ そこから上の称号もあるんだから♡', title:'コンボをつなごう', help:'rhythm/rhythm-notes-and-effects' },
    { e:'normal',  t:'設定したマスモンは「モンスターノーツ」になって流れてくるの。取ると血統ごとの力が働くよ。', title:'マスモンも一緒に', spot:'monsters', help:'rhythm/rhythm-monster-note-display' },
    { e:'happy',   t:'ノーツの速さや音量、判定のタイミング補正はオプションでいじれるよ。合わないなら早めにね。', title:'オプション', spot:'options', help:'rhythm/rhythm-options' },
    { e:'excited', t:'スコアは全国ランキングに載るよ！ 難易度をまたいだ合算だから、上でやるほど有利♪', title:'全国ランキング', help:'rhythm/rhythm-ranking' },
    { e:'wink',    t:'説明はいつでも「📖 遊びかた」から見られるから。それじゃ……見せてもらうね♡', title:'それじゃ、はじめよっか', spot:'help' },
  ],
};
const assistantRhythmTutorialPages = (assistantId) =>
  ASSISTANT_RHYTHM_TUTORIAL_SETS[assistantId] || ASSISTANT_RHYTHM_TUTORIAL;

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
  momosuke: [
    { e:'excited', t:'ねえねえ、バトルチュートリアルってのが増えたんだって♪', title:'新しいれんしゅう、あるよ' },
    { e:'normal', t:'Monster Heroのバトルってちょっと特殊だからさ。先にやっとくと迷わないと思うよ。', title:'動かして覚えちゃお' },
    { e:'wink', t:'いまから一緒にやる？ ……やるよね？♡', title:'どうする？', offer:'battleGuide' },
    { e:'happy', t:'はいはい、わかった♪ 「設定 → ヘルプ」からいつでも見られるから、詰まったら来なよ。', title:'いつでも待ってるから', declined:true },
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
// 新しい入口の導入。ふだん HOME の「モンヒロバトル」を押すと最初に出るのは
// バトルの仕組みえらび(BATTLE_SYSTEM_SELECT)なので、そこから順に見せる。
//
//   仕組みえらび(クラシック/タクティクス/クイック)
//     → クラシックの中のモードえらび(チャレンジ/種族チャレンジ/プロ)
//     → 難易度えらび(ビギナー)
//
// ★ここを飛ばしてモードえらびから始めていた頃は、練習を終えた人が自分でバトルを
//   押したときに、習っていない画面が最初に出ていた(2026-09-21 ユーザー指摘)。
//   同じ指摘で「となりはクイック」も直している。クイックはモードではなく
//   仕組みの側へ移っていて、クラシックのとなりに並ぶのは種族チャレンジ
const ASSISTANT_BATTLE_TUTORIAL_INTRO_V2 = [
  { id:'intro',        at:'BATTLE_SYSTEM_SELECT',     e:'excited', title:'バトルのれんしゅう', t:'{name}、ここからは実際に動かして覚えよ！ あたしが横で見てるからね♪', wait:'next' },
  { id:'systemTalk',   at:'BATTLE_SYSTEM_SELECT',     e:'normal',  title:'まずはバトル選び', t:'モンヒロバトルは、ルールのちがうバトルから1つ選んで始めるよ。', spot:'systemCards', wait:'next' },
  { id:'systemClassic',at:'BATTLE_SYSTEM_SELECT',     e:'happy',   title:'クラシックバトル', t:'いちばん上がクラシック。連れていった子の力を合わせて10WAVEに挑む、基本のバトルだよ。', spot:'systemClassic', wait:'next' },
  { id:'systemTactics',at:'BATTLE_SYSTEM_SELECT',     e:'surprise',title:'タクティクスバトル', t:'まん中はタクティクス。1体ずつライフを持って、誰を守るかを読み合うバトルなんだ。', spot:'systemTactics', wait:'next' },
  { id:'systemQuick',  at:'BATTLE_SYSTEM_SELECT',     e:'wink',    title:'クイックモード', t:'いちばん下はクイック。1周が速くて経験値が1.5倍もらえる、育成むけのバトルだよ♪', spot:'systemQuick', wait:'next' },
  { id:'systemInfo',   at:'BATTLE_SYSTEM_SELECT',     e:'normal',  title:'くわしく知りたいとき', t:'どのカードも「詳しいルール」を押すと、同じ並びで細かく読めるよ。', spot:'systemCards', wait:'next' },
  { id:'systemReady',  at:'BATTLE_SYSTEM_SELECT',     e:'happy',   title:'今日はクラシックで', t:'最初はクラシックがおすすめ！ 基本の遊びかたはここで全部おぼえられるよ。', spot:'systemClassic', wait:'next' },
  { id:'systemPick',   at:'BATTLE_SYSTEM_SELECT',     e:'wink',    title:'押してみて！', t:'いちばん上のクラシックバトルのカードを押してね♪', spot:'systemClassic', wait:'act' },
  { id:'modeTalk',     at:'BATTLE_MODE_SELECT',       e:'normal',  title:'クラシックの中身', t:'クラシックの中は3つ。左右にスワイプすると、ぐるぐる回せるんだ♪', spot:'modeCards', wait:'next' },
  { id:'modeChallenge',at:'BATTLE_MODE_SELECT',       e:'happy',   title:'チャレンジモード', t:'いま出てるのがチャレンジ。強化を自分で選んでスコアを伸ばす、いちばん基本のモードだよ。', spot:'modeCards', wait:'next' },
  { id:'modeSpecies',  at:'BATTLE_MODE_SELECT',       e:'wink',    title:'種族チャレンジ', t:'となりは種族チャレンジ。ひとつの種族の子だけを連れて挑む、腕だめし用のモードなんだ。', spot:'modeCards', wait:'next' },
  { id:'modePro',      at:'BATTLE_MODE_SELECT',       e:'surprise',title:'プロモード', t:'その先はプロ。育てた子に頼らず、ベースモンだけで挑む特殊モードだよ…！', spot:'modeCards', wait:'next' },
  { id:'modeDetail',   at:'BATTLE_MODE_SELECT',       e:'normal',  title:'くわしく知りたいとき', t:'カードの「このモードの説明」を押すと、どのモードも同じ並びで細かく読めるよ。', spot:'modeCards', wait:'next' },
  { id:'rankTalk',     at:'BATTLE_MODE_SELECT',       e:'happy',   title:'ランキング', t:'上のタブでブリーダーLvと絆Lvのランキング、カードのボタンでモードごとのスコアランキングが見られるよ♪', spot:'modeRankTabs', wait:'next' },
  { id:'modeReady',    at:'BATTLE_MODE_SELECT',       e:'normal',  title:'今日はチャレンジで', t:'最初はチャレンジがおすすめ！ ここから難易度をえらんで始めるよ。', spot:'modeStart', wait:'next' },
  { id:'modePick',     at:'BATTLE_MODE_SELECT',       e:'wink',    title:'押してみて！', t:'チャレンジの「難易度を選ぶ」を押してみて♪', spot:'modeStart', wait:'act' },
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
  // ガード → 必殺技 → アシストカード → 緊急回復と敵の移動 → 距離技 → 攻撃 →
  // 技変更 → 固有技、を1つずつ操作してもらう
  { id:'battle',       at:'BATTLE',        e:'excited', title:'バトル開始！', t:'いよいよ本番！ 画面の見かたから順番に教えるね♪', wait:'next' },
  { id:'waveTalk',     at:'BATTLE',        e:'normal',  title:'上のバー', t:'今のWAVEとターン数だよ。20ターン以内に敵を倒せないと負けちゃう。', spot:'waveInfo', wait:'next' },
  { id:'enemyTalk',    at:'BATTLE',        e:'normal',  title:'相手の情報', t:'敵の名前・いる距離・HPバー。距離はこまめに変わるから要チェック！', spot:'enemyBar', wait:'next' },
  { id:'scanTalk',     at:'BATTLE',        e:'happy',   title:'敵をくわしく', t:'右上の「解析」を押すと、敵の技や次に何をしてくるかまで見られるよ。', spot:'enemyBar', wait:'next' },
  { id:'heroTalk2',    at:'BATTLE',        e:'normal',  title:'自分の情報', t:'左上の「ステータス」で、自分のHP・力・丈夫さ・ガッツを確認できるよ。', spot:'heroStatus', wait:'next' },
  { id:'slotTalk2',    at:'BATTLE',        e:'wink',    title:'4つの距離枠', t:'仲間が並んでる枠が距離。敵と同じ距離の子ほど大ダメージを出せるよ！', spot:'battleSlots', wait:'next' },
  { id:'cards',        at:'BATTLE',        e:'normal',  title:'手札のカード', t:'下にあるのが今つかえるカード。ガッツが足りる子だけ光ってるよ。', spot:'cards', wait:'next' },
  { id:'cardKinds',    at:'BATTLE',        e:'normal',  title:'カードの種類', t:'攻めの攻撃カード、ダメージを減らすガードカード、力を底上げするアシストカードがあるよ。', spot:'cards', wait:'next' },
  { id:'cardDetail',   at:'BATTLE',        e:'wink',    title:'カードの説明', t:'カードを2回つづけてトントンって押すと、そのカードの説明が出るよ。1回だけのときは選ぶだけなんだ♪', spot:'cards', wait:'next' },
  { id:'actionTalk',   at:'BATTLE',        e:'happy',   title:'ACTIONで実行', t:'カードを選んだら、右下の「ACTION」を押すとその1ターンぶんが実行されるよ♪', spot:'action', wait:'next' },
  { id:'limitTalk',    at:'BATTLE',        e:'normal',  title:'使える枚数', t:'1ターンに出せる枚数はここ。勇者モンの特性で増えることもあるんだ♪', spot:'cardCount', wait:'next' },
  { id:'cardOrder',    at:'BATTLE',        e:'surprise',title:'2枚目からは半減', t:'同じターンに攻撃やガードを重ねると2枚目から効果が半分。アシストカードは半減しないよ。', spot:'cards', wait:'next' },
  { id:'deckTalk',     at:'BATTLE',        e:'happy',   title:'山札のこと', t:'「VIEW」で山札と使い終わったカードを確認できるよ。無くなったら混ぜ直すの。', spot:'deckView', wait:'next' },
  // ① 敵の攻撃予告 → ガードで受ける
  { id:'intentTalk',   at:'BATTLE',        e:'surprise',title:'敵の攻撃予告！', t:'敵の下に次の行動と予測ダメージが出てるよ。今ターンは殴ってくる！', spot:'enemyIntent', wait:'next' },
  { id:'guardTalk',    at:'BATTLE',        e:'normal',  title:'ガードで受けよう', t:'ガードカードを選んで、ACTIONを押してみて。ダメージがぐっと減るよ！', spot:['cards','action'], wait:'next' },
  { id:'guardDo',      at:'BATTLE',        e:'wink',    title:'ガードを使ってみて', t:'ガードカード → ACTION の順だよ♪', spot:['cards','action'], wait:'do', need:'guard' },
  { id:'guardSeen',    at:'BATTLE',        e:'happy',   title:'ほぼ無傷！', t:'見て、ライフがほとんど減ってないでしょ？ これがガードの力だよ♪', wait:'next' },
  // ② 必殺技を魅せる
  { id:'chargeTalk',   at:'BATTLE',        e:'surprise',title:'必殺技が来る！', t:'敵の下の予告を見て！ 必殺技はふつうの攻撃よりずっと痛いよ。', spot:'enemyIntent', wait:'next' },
  { id:'chargeReady',  at:'BATTLE',        e:'normal',  title:'もう一度ガード', t:'必殺技もガードで受け止められるよ。手札のガードを見て！', spot:['cards','action'], wait:'next' },
  { id:'chargeDo',     at:'BATTLE',        e:'excited', title:'受け止めよう！', t:'ガードカードを選んでACTIONだよ♪', spot:['cards','action'], wait:'do', need:'guard' },
  { id:'chargeSeen',   at:'BATTLE',        e:'surprise',title:'さすがに痛い！', t:'ガードしてもこれだけ減るんだ。必殺技の予告が出たら気をつけてね。', wait:'next' },
  // ③ アシストカードでバフ
  { id:'breederTalk',  at:'BATTLE',        e:'happy',   title:'アシストカード', t:'次はアシストカード。ニコラオの力で、こっちの攻撃力が上がるよ！', spot:['cards','action'], wait:'next' },
  { id:'breederDo',    at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'アシストカードを選んでACTION！ 攻撃UPの表示が出るよ♪', spot:['cards','action'], wait:'do', need:'teaching' },
  { id:'breederSeen',  at:'BATTLE',        e:'happy',   title:'攻撃アップ！', t:'「攻撃UP!」って出たでしょ？ この効果はバトルの最後まで続くよ♪', wait:'next' },
  // ④ 緊急回復と敵の移動
  { id:'emergTalk',    at:'BATTLE',        e:'normal',  title:'緊急回復', t:'下の「緊急」はライフとガッツが3割もどるよ。そのターンは攻撃できないの。', spot:'emergency', wait:'next' },
  { id:'emergDo',      at:'BATTLE',        e:'wink',    title:'押してみて', t:'「緊急」を押してみて！ 敵も動くから、そこも見ててね♪', spot:'emergency', wait:'do', need:'emergency' },
  { id:'moveTalk',     at:'BATTLE',        e:'surprise',title:'敵が動いた！', t:'敵は距離を変えてくるよ。離れられると攻撃が当たりにくくなるの。', spot:'enemyBar', wait:'next' },
  // ⑤ 距離技で引き戻す
  { id:'rangeTalk',    at:'BATTLE',        e:'excited', title:'距離技で引き戻す', t:'距離技は、当てたあと敵をその距離まで引っぱってこられるんだ！', spot:['cards','action'], wait:'next' },
  { id:'rangeDo',      at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'距離技を選んで、モッチーの枠をタップ → ACTION だよ♪', spot:['cards','action'], wait:'do', need:'range_atk' },
  { id:'rangeSeen',    at:'BATTLE',        e:'excited', title:'引き戻せた！', t:'敵の距離が変わったでしょ？ 離されても距離技で連れ戻せるんだ♪', spot:'enemyBar', wait:'next' },
  // ⑥ 通常攻撃
  { id:'atkTalk',      at:'BATTLE',        e:'happy',   title:'距離がそろった！', t:'敵と同じ距離になったね。この状態の攻撃がいちばん強いよ！', spot:'battleSlots', wait:'next' },
  { id:'atkReady',     at:'BATTLE',        e:'normal',  title:'攻撃カード', t:'手札の攻撃カードを使ってみよう。距離が合ってるとよく効くよ！', spot:['cards','action'], wait:'next' },
  { id:'atkDo',        at:'BATTLE',        e:'wink',    title:'攻撃してみて', t:'攻撃カード → 枠をタップ → ACTION！', spot:['cards','action'], wait:'do', need:'atk' },
  { id:'atkSeen',      at:'BATTLE',        e:'happy',   title:'よく入った！', t:'敵のHPがぐっと減ったね。距離がそろってると威力が全然ちがうんだ♪', spot:'enemyBar', wait:'next' },
  // ⑦ 技変更
  { id:'skillTalk',    at:'BATTLE',        e:'normal',  title:'技は変えられる', t:'攻撃カードの下のほうに「⇄技変更」の枠があるでしょ？ 枠の中なら、どこを押しても技を選び直せるの。', spot:'cards', wait:'next' },
  { id:'skillPoint',   at:'BATTLE',        e:'wink',    title:'ここが技変更', t:'光ってる攻撃カードの、ガッツまでいっしょに囲んである枠だよ♪', spot:'cards', wait:'next', needCard:'atk' },
  { id:'skillTwice',   at:'BATTLE',        e:'normal',  title:'名前は押しても大丈夫', t:'絵や技の名前を押したときは、カードを選ぶだけ。一覧は枠を押したときだけ開くよ。', spot:'cards', wait:'next', needCard:'atk' },
  { id:'skillDo',      at:'BATTLE',        e:'excited', title:'技変更を押す', t:'光ってる「⇄技変更」を押してみて！ 技の一覧が出てくるよ。', spot:'cards', wait:'do', need:'skillPicker', needCard:'atk' },
  { id:'skillSeen',    at:'BATTLE',        e:'happy',   title:'これが技の一覧', t:'威力・消費ガッツ・会心率が並んでたでしょ？ 使う技はここで選び直せるよ♪', wait:'next' },
  { id:'skillLock',    at:'BATTLE',        e:'normal',  title:'暗い技があったよね', t:'通常技と距離技は、その距離の補正値が高いほど強いものまで使えるようになるの。', wait:'next' },
  { id:'skillNow',     at:'BATTLE',        e:'surprise',title:'今は補正が0%', t:'だから今は下のほうの技しか選べないんだ。育てて補正を上げると解放されるよ！', spot:'battleSlots', wait:'next' },
  // ⑧ 固有技でトドメ
  { id:'uniqueTalk',   at:'BATTLE',        e:'excited', title:'最後は固有技！', t:'固有技はその子だけの必殺技。ガッツは重いけど、とにかく強いよ！', spot:'cards', wait:'next' },
  { id:'uniqueLevel',  at:'BATTLE',        e:'happy',   title:'固有技は育つ', t:'バトルを進めて供モンが合流するとき、固有技のレベルを上げられるんだ♪', spot:['cards','action'], wait:'next' },
  { id:'act',          at:'BATTLE',        e:'excited', title:'トドメだ！', t:'固有技を選んで枠をタップ → ACTIONで倒しちゃお♪', spot:['cards','action'], wait:'act', need:'unique' },
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
  { id:'modeAfter',    at:'*',             e:'normal',  title:'モードの使い分け', t:'クラシックの中は、スコアに挑むチャレンジ、腕だめしの種族チャレンジ、しばりのプロだよ。', wait:'next' },
  { id:'modeLater',    at:'*',             e:'wink',    title:'早く育てたいときは', t:'入口でクイックを選ぶと、さくさく回せて経験値も1.5倍。いつでも選べるからね♪', wait:'next' },
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

// ---------- タクティクスバトルのれんしゅう(2026-09-21 ユーザー依頼・デバッグからだけ) ----------
// タクティクスは公開前なので、この台本はデバッグ設定からしか開けない。
// クラシックの本体(BODY)は使い回さず、専用に書いてある。盤面の持ち方が違うので、
// 「ライフは1本」「ガッツは全員ぶん」を前提にした言い回しがそのままでは嘘になるため。
//
// 教える順(クラシックの練習と同じ骨格に、このモードならではのものを足した):
//   1体ずつのライフとガッツ → 画面の見かた → 敵の狙いの予告 → ガード →
//   連撃(ガードは1ヒットぶん) → アシストカード → 緊急回復と敵の移動 →
//   距離技 → 攻撃 → 技変更 → 固有技
const ASSISTANT_BATTLE_TUTORIAL_TACTICS_INTRO = [
  { id:'tIntro',       at:'BATTLE_SYSTEM_SELECT',     e:'excited', title:'タクティクスのれんしゅう', t:'{name}、今日はタクティクスバトルを動かして覚えよ！ 横で見てるからね♪', wait:'next' },
  { id:'tSystemTalk',  at:'BATTLE_SYSTEM_SELECT',     e:'normal',  title:'ここから選ぶよ', t:'モンヒロバトルは、ルールのちがうバトルから1つ選んで始めるよ。', spot:'systemCards', wait:'next' },
  { id:'tSystemDiff',  at:'BATTLE_SYSTEM_SELECT',     e:'surprise',title:'どこがちがうの？', t:'クラシックは全員の力を合わせて1本のライフで戦うけど、タクティクスは1体ずつライフを持つんだ。', spot:'systemTactics', wait:'next' },
  { id:'tSystemAim',   at:'BATTLE_SYSTEM_SELECT',     e:'normal',  title:'狙いが出る', t:'だから敵の予告に「誰を狙うか」まで出るよ。誰に受けさせるかを決めるバトルなの。', spot:'systemTactics', wait:'next' },
  { id:'tSystemReady', at:'BATTLE_SYSTEM_SELECT',     e:'happy',   title:'今日はこっちで', t:'カードと間合い、育てた強さの効きかたはクラシックと同じ。そこに読み合いが足されるんだ♪', spot:'systemTactics', wait:'next' },
  { id:'tSystemPick',  at:'BATTLE_SYSTEM_SELECT',     e:'wink',    title:'押してみて！', t:'タクティクスバトルのカードを押してね♪', spot:'systemTactics', wait:'act' },
  { id:'tModeTalk',    at:'BATTLE_MODE_SELECT',       e:'normal',  title:'タクティクスの中身', t:'中は3つ。タクティクスチャレンジ・種族チャレンジ・プロだよ。', spot:'modeCards', wait:'next' },
  { id:'tModeReady',   at:'BATTLE_MODE_SELECT',       e:'happy',   title:'今日はチャレンジで', t:'いちばん基本のタクティクスチャレンジで練習しよ！', spot:'modeStart', wait:'next' },
  { id:'tModePick',    at:'BATTLE_MODE_SELECT',       e:'wink',    title:'押してみて！', t:'タクティクスチャレンジの「難易度を選ぶ」を押してね♪', spot:'modeStart', wait:'act' },
  { id:'tDiffTalk',    at:'BATTLE_DIFFICULTY_SELECT', e:'normal',  title:'難易度を選ぶ', t:'左右にスワイプして選ぶよ。難しいほど、敵が使ってくる技の数も増えるんだ。', spot:'difficulty', wait:'next' },
  { id:'tStartTalk',   at:'BATTLE_DIFFICULTY_SELECT', e:'wink',    title:'ビギナーで挑戦', t:'今回は練習だから、いちばんやさしいビギナーをやってみよ！', spot:'battleStart', wait:'next' },
  { id:'tStart',       at:'BATTLE_DIFFICULTY_SELECT', e:'excited', title:'押してみて！', t:'「この難易度で挑戦」を押すとバトルが始まるよ♪', spot:'battleStart', wait:'act' },
];
const ASSISTANT_BATTLE_TUTORIAL_TACTICS_BODY = [
  // 勇者モンを選ぶ
  { id:'tHeroTalk',    at:'PICK_HERO',     e:'happy',   title:'まずは勇者モン', t:'主役になる子が勇者モン。この中から1体えらぶよ！', spot:['monCards','monDecide'], wait:'next' },
  { id:'tHero',        at:'PICK_HERO',     e:'wink',    title:'えらんでみよう', t:'好きな子を押して、出てきた画面で「決定」だよ♪', spot:['monCards','monDecide'], wait:'act' },
  // 置く距離を決める
  { id:'tSlotTalk',    at:'PICK_SLOT',     e:'normal',  title:'置く距離を決めよう', t:'次は立ち位置。敵と同じ距離だと大ダメージなんだ！', spot:'slots', wait:'next' },
  { id:'tSlot',        at:'PICK_SLOT',     e:'wink',    title:'枠を押してね', t:'好きな距離の枠をタップしてみて♪', spot:'slots', wait:'act' },
  // ブリーダーの教えを持ち込む
  { id:'tTeachTalk',   at:'PICK_TEACHING', e:'normal',  title:'ブリーダーの教え', t:'バトル中に使える助っ人カードだよ。ここで持ち込むの。', spot:'teachings', wait:'next' },
  { id:'tTeach',       at:'PICK_TEACHING', e:'happy',   title:'1つ選ぼう', t:'好きな教えを1つ押してね♪', spot:'teachings', wait:'act' },
  // バトル。まずこのモードならではの「1体ずつ」から見せる
  { id:'tBattle',      at:'BATTLE',        e:'excited', title:'バトル開始！', t:'いよいよ本番！ まずタクティクスならではのところから教えるね♪', wait:'next' },
  { id:'tParty',       at:'BATTLE',        e:'surprise',title:'1体ずつのライフ', t:'ここが仲間ひとりずつのライフとガッツ。合計じゃなくて、1体ごとに別々に持つんだ！', spot:'tacticsParty', wait:'next' },
  { id:'tPartyDown',   at:'BATTLE',        e:'normal',  title:'倒れても負けじゃない', t:'ライフが0になった子はお休みになるよ。全員が倒れたときだけ負けなの。', spot:'tacticsParty', wait:'next' },
  { id:'tPartyAbility',at:'BATTLE',        e:'happy',   title:'勇者特性は全員ぶん', t:'クラシックは勇者モンの特性だけだけど、こっちは連れてきた子の特性もそれぞれに効くよ♪', spot:'tacticsParty', wait:'next' },
  { id:'tWaveTalk',    at:'BATTLE',        e:'normal',  title:'上のバー', t:'今のWAVEとターン数だよ。20ターン以内に敵を倒せないと負けちゃう。', spot:'waveInfo', wait:'next' },
  { id:'tEnemyTalk',   at:'BATTLE',        e:'normal',  title:'相手の情報', t:'敵の名前・いる距離・HPバー。距離はこまめに変わるから要チェック！', spot:'enemyBar', wait:'next' },
  { id:'tScanTalk',    at:'BATTLE',        e:'happy',   title:'敵をくわしく', t:'右上の「解析」を押すと、敵の技や次に何をしてくるかまで見られるよ。', spot:'enemyBar', wait:'next' },
  { id:'tSkillsMore',  at:'BATTLE',        e:'surprise',title:'技が多いよ', t:'タクティクスの敵は、連撃や貫通撃みたいな技も使ってくるの。解析で確かめる癖をつけてね。', spot:'enemyBar', wait:'next' },
  { id:'tSlotTalk2',   at:'BATTLE',        e:'wink',    title:'4つの距離枠', t:'仲間が並んでる枠が距離。敵と同じ距離の子ほど大ダメージを出せるよ！', spot:'battleSlots', wait:'next' },
  { id:'tCards',       at:'BATTLE',        e:'normal',  title:'手札のカード', t:'下にあるのが今つかえるカード。攻めの攻撃、ダメージを減らすガード、力を上げるアシストがあるよ。', spot:'cards', wait:'next' },
  { id:'tCardDetail',  at:'BATTLE',        e:'wink',    title:'カードの説明', t:'カードを2回つづけてトントンって押すと、そのカードの説明が出るよ。1回だけのときは選ぶだけなんだ♪', spot:'cards', wait:'next' },
  { id:'tCardWho',     at:'BATTLE',        e:'surprise',title:'使う子を選ぶ', t:'タクティクスはカードを選んだあと、使う子の枠もタップするよ。ガッツはその子のぶんから払うの。', spot:['cards','battleSlots'], wait:'next' },
  { id:'tActionTalk',  at:'BATTLE',        e:'happy',   title:'ACTIONで実行', t:'カードと使う子が決まったら、右下の「ACTION」でその1ターンぶんが進むよ♪', spot:'action', wait:'next' },
  { id:'tLimitTalk',   at:'BATTLE',        e:'normal',  title:'使える枚数', t:'1ターンに出せる枚数はここ。勇者モンの特性で増えることもあるんだ♪', spot:'cardCount', wait:'next' },
  { id:'tCardOrder',   at:'BATTLE',        e:'surprise',title:'2枚目からは半減', t:'同じターンに攻撃やガードを重ねると2枚目から効果が半分。アシストカードは半減しないよ。', spot:'cards', wait:'next' },
  { id:'tDeckTalk',    at:'BATTLE',        e:'happy',   title:'山札のこと', t:'「VIEW」で山札と使い終わったカードを確認できるよ。無くなったら混ぜ直すの。', spot:'deckView', wait:'next' },
  // ① 敵の攻撃予告(狙い付き) → ガードで受ける
  { id:'tIntentTalk',  at:'BATTLE',        e:'surprise',title:'敵の攻撃予告！', t:'敵の下に次の行動と予測ダメージ、それに狙われている子まで出てるよ！', spot:'enemyIntent', wait:'next' },
  { id:'tGuardTalk',   at:'BATTLE',        e:'normal',  title:'ガードで受けよう', t:'ガードカードを選んで、受ける子の枠をタップ → ACTION。ダメージがぐっと減るよ！', spot:['cards','action'], wait:'next' },
  { id:'tGuardDo',     at:'BATTLE',        e:'wink',    title:'ガードを使ってみて', t:'ガードカード → 枠をタップ → ACTION の順だよ♪', spot:['cards','action'], wait:'do', need:'guard' },
  { id:'tGuardSeen',   at:'BATTLE',        e:'happy',   title:'ほぼ無傷！', t:'狙われた子のライフがほとんど減ってないでしょ？ これがガードの力だよ♪', spot:'tacticsParty', wait:'next' },
  // ② 連撃(ガードは1ヒットぶんしか効かない)
  { id:'tRushTalk',    at:'BATTLE',        e:'surprise',title:'連撃が来る！', t:'次の技は3回に分かれて当たる連撃だよ！ ガードで減らせるのは1回ぶんだけなの。', spot:'enemyIntent', wait:'next' },
  { id:'tRushReady',   at:'BATTLE',        e:'normal',  title:'それでも受ける', t:'1回ぶんでも減らしたほうがいいよ。もう一度ガードを使ってみて！', spot:['cards','action'], wait:'next' },
  { id:'tRushDo',      at:'BATTLE',        e:'excited', title:'受け止めよう！', t:'ガードカード → 枠をタップ → ACTION だよ♪', spot:['cards','action'], wait:'do', need:'guard' },
  { id:'tRushSeen',    at:'BATTLE',        e:'surprise',title:'けっこう痛い！', t:'ガードしてもこれだけ減るんだ。技によって受け方を変えるのがこのモードのコツだよ。', spot:'tacticsParty', wait:'next' },
  // ③ アシストカードでバフ
  { id:'tBreederTalk', at:'BATTLE',        e:'happy',   title:'アシストカード', t:'次はアシストカード。ニコラオの力で、こっちの攻撃力が上がるよ！', spot:['cards','action'], wait:'next' },
  { id:'tBreederDo',   at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'アシストカードを選んで枠をタップ → ACTION！ 攻撃UPの表示が出るよ♪', spot:['cards','action'], wait:'do', need:'teaching' },
  { id:'tBreederSeen', at:'BATTLE',        e:'happy',   title:'攻撃アップ！', t:'「攻撃UP!」って出たでしょ？ この効果はバトルの最後まで続くよ♪', wait:'next' },
  // ④ 緊急回復と敵の移動
  { id:'tEmergTalk',   at:'BATTLE',        e:'normal',  title:'緊急回復', t:'下の「緊急」は、みんなのライフとガッツが1体ずつ3割もどるよ。そのターンは攻撃できないの。', spot:'emergency', wait:'next' },
  { id:'tEmergDo',     at:'BATTLE',        e:'wink',    title:'押してみて', t:'「緊急」を押してみて！ 敵も動くから、そこも見ててね♪', spot:'emergency', wait:'do', need:'emergency' },
  { id:'tMoveTalk',    at:'BATTLE',        e:'surprise',title:'敵が動いた！', t:'敵は距離を変えてくるよ。離れられると攻撃が当たりにくくなるの。', spot:'enemyBar', wait:'next' },
  // ⑤ 距離技で引き戻す
  { id:'tRangeTalk',   at:'BATTLE',        e:'excited', title:'距離技で引き戻す', t:'距離技は、当てたあと敵をその距離まで引っぱってこられるんだ！', spot:['cards','action'], wait:'next' },
  { id:'tRangeDo',     at:'BATTLE',        e:'wink',    title:'使ってみよう', t:'距離技を選んで、モッチーの枠をタップ → ACTION だよ♪', spot:['cards','action'], wait:'do', need:'range_atk' },
  { id:'tRangeSeen',   at:'BATTLE',        e:'excited', title:'引き戻せた！', t:'敵の距離が変わったでしょ？ 離されても距離技で連れ戻せるんだ♪', spot:'enemyBar', wait:'next' },
  // ⑥ 通常攻撃
  { id:'tAtkTalk',     at:'BATTLE',        e:'happy',   title:'距離がそろった！', t:'敵と同じ距離になったね。この状態の攻撃がいちばん強いよ！', spot:'battleSlots', wait:'next' },
  { id:'tAtkReady',    at:'BATTLE',        e:'normal',  title:'攻撃カード', t:'手札の攻撃カードを使ってみよう。距離が合ってるとよく効くよ！', spot:['cards','action'], wait:'next' },
  { id:'tAtkDo',       at:'BATTLE',        e:'wink',    title:'攻撃してみて', t:'攻撃カード → 枠をタップ → ACTION！', spot:['cards','action'], wait:'do', need:'atk' },
  { id:'tAtkSeen',     at:'BATTLE',        e:'happy',   title:'よく入った！', t:'敵のHPがぐっと減ったね。距離がそろってると威力が全然ちがうんだ♪', spot:'enemyBar', wait:'next' },
  // ⑦ 技変更
  { id:'tSkillTalk',   at:'BATTLE',        e:'normal',  title:'技は変えられる', t:'攻撃カードの下のほうに「⇄技変更」の枠があるでしょ？ 枠の中なら、どこを押しても技を選び直せるの。', spot:'cards', wait:'next' },
  { id:'tSkillPoint',  at:'BATTLE',        e:'wink',    title:'ここが技変更', t:'光ってる攻撃カードの、ガッツまでいっしょに囲んである枠だよ♪', spot:'cards', wait:'next', needCard:'atk' },
  { id:'tSkillTwice',  at:'BATTLE',        e:'normal',  title:'名前は押しても大丈夫', t:'絵や技の名前を押したときは、カードを選ぶだけ。一覧は枠を押したときだけ開くよ。', spot:'cards', wait:'next', needCard:'atk' },
  { id:'tSkillDo',     at:'BATTLE',        e:'excited', title:'技変更を押す', t:'光ってる「⇄技変更」を押してみて！ 技の一覧が出てくるよ。', spot:'cards', wait:'do', need:'skillPicker', needCard:'atk' },
  { id:'tSkillSeen',   at:'BATTLE',        e:'happy',   title:'これが技の一覧', t:'威力・消費ガッツ・会心率が並んでたでしょ？ 使う技はここで選び直せるよ♪', wait:'next' },
  { id:'tSkillLock',   at:'BATTLE',        e:'normal',  title:'暗い技があったよね', t:'通常技と距離技は、その距離の補正値が高いほど強いものまで使えるようになるの。', wait:'next' },
  // ⑧ 固有技でトドメ
  { id:'tUniqueTalk',  at:'BATTLE',        e:'excited', title:'最後は固有技！', t:'固有技はその子だけの必殺技。ガッツは重いけど、とにかく強いよ！', spot:'cards', wait:'next' },
  { id:'tUniqueGuts',  at:'BATTLE',        e:'normal',  title:'ガッツはその子のぶん', t:'重い技ほど、使う子のガッツが足りてるかが大事。足りない子には出せないんだ。', spot:['cards','tacticsParty'], wait:'next' },
  { id:'tActReady',    at:'BATTLE',        e:'happy',   title:'モッチーなら出せるよ', t:'いまのモッチーはガッツが足りてるから、固有技をそのまま撃てるよ！', spot:['cards','action'], wait:'next' },
  { id:'tAct',         at:'BATTLE',        e:'excited', title:'トドメだ！', t:'固有技を選んで枠をタップ → ACTIONで倒しちゃお♪', spot:['cards','action'], wait:'act', need:'unique' },
  // WAVEクリア
  { id:'tClear',       at:'WAVE_RESULT',   e:'excited', title:'WAVEクリア！', t:'ナイス{name}！ 敵を倒しきるとWAVEクリアだよ♪', spot:'waveNext', wait:'next' },
  { id:'tClearNext',   at:'WAVE_RESULT',   e:'happy',   title:'次へ進もう', t:'「次へ進む」を押すと強化フェーズだよ！', spot:'waveNext', wait:'act' },
  // 強化フェーズ
  { id:'tRewardTalk',  at:'REWARD_PICK',   e:'happy',   title:'能力アップ', t:'クリアのたびに強くなれる！ 3つから1つ選べるんだ。', spot:'rewards', wait:'next' },
  { id:'tReward',      at:'REWARD_PICK',   e:'wink',    title:'選んでみて', t:'好きな強化を1つ押してね♪', spot:'rewards', wait:'act' },
];
const ASSISTANT_BATTLE_TUTORIAL_TACTICS_OUTRO = [
  { id:'tAlly',        at:'*',             e:'normal',  title:'このあとは', t:'WAVE2・4・6では供モンが合流するよ。ライフもガッツも、その子のぶんが増えるんだ。', wait:'next' },
  { id:'tAllyAim',     at:'*',             e:'surprise',title:'仲間が増えると', t:'狙われる子も選ばれるようになるよ。誰に受けさせて、誰で殴るかを考えるのが楽しいの♪', wait:'next' },
  { id:'tAllyStrong',  at:'*',             e:'normal',  title:'強い子ほど手ごわい', t:'供モンが加わると、そのぶん敵も強くなるよ。少ない人数のまま進む選び方もあるんだ。', wait:'next' },
  { id:'tRecord',      at:'*',             e:'happy',   title:'記録は別々', t:'タクティクスのスコアはクラシックとは別のランキングに載るよ。記録を奪い合わないから安心してね♪', wait:'next' },
  { id:'tWrapUp',      at:'*',             e:'excited', title:'おつかれさま！', t:'これでタクティクスのれんしゅうは終わり！ 一連の流れはバッチリだね♪', wait:'next' },
  { id:'tEnd',         at:'*',             e:'happy',   title:'いってらっしゃい！', t:'困ったらヘルプからいつでもこの練習をやり直せるよ。がんばってね{name}！', wait:'end' },
];
const ASSISTANT_BATTLE_TUTORIAL_TACTICS = [
  ...ASSISTANT_BATTLE_TUTORIAL_TACTICS_INTRO,
  ...ASSISTANT_BATTLE_TUTORIAL_TACTICS_BODY,
  ...ASSISTANT_BATTLE_TUTORIAL_TACTICS_OUTRO,
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
// ガード → 必殺技 → アシストカード → 緊急回復と敵の移動 → 距離技 → 攻撃 →
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
  teachingId: 'oryo',    // ニコラオの力(攻撃アップ)。バフの変化が数値で見える
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
    { type:'WAIT' },                // 4ターン目 … アシストカードでバフ
    { type:'MOVE', targetDist:3 },  // 5ターン目 … 緊急回復のあいだに遠距離へ移動
    { type:'WAIT' },                // 6ターン目 … 距離技で引き戻す
    { type:'WAIT' },                // 7ターン目 … 通常攻撃
    { type:'WAIT' },                // 8ターン目以降 … 技変更 → 固有技でトドメ
  ],
};
// タクティクスバトルのれんしゅう用の台本(2026-09-21・デバッグからだけ)。
// 敵はモードとWAVEで決まるので enemyKey は持たない(タクティクスのWAVE1はカワズモー)。
// 連撃を1回見せるので、そのぶん必殺技の「ためる → 撃つ」は入れていない
// (1回の練習が長くなりすぎる。必殺技は解析の説明で触れている)
const BATTLE_TUTORIAL_SCENARIO_TACTICS = {
  mode: 'tactics',
  heroId: 'Mocchi',
  slotIndex: 1,          // 近距離。敵の初期位置と同じにして距離補正の効きを見せる
  teachingId: 'oryo',    // ニコラオの力(攻撃アップ)。バフの変化が数値で見える
  enemyDist: 1,
  enemyHp: 500,          // 距離技＋攻撃では落ちず、固有技で必ず落ちる量
  enemyAtk: 260,         // 1体ぶんのライフで受けるので、クラシックの台本より控えめ
  hand: ['guard', 'guard', 'teaching', 'range_atk', 'atk'],
  draw: ['unique', 'guard', 'atk'],
  intents: [
    { type:'ATTACK' },                     // 1ターン目 … 狙いつきの攻撃予告 → ガードで受ける
    { type:'ATTACK', actionId:'rush' },    // 2ターン目 … 連撃(ガードは1ヒットぶんしか効かない)
    { type:'WAIT' },                       // 3ターン目 … アシストカードでバフ
    { type:'MOVE', targetDist:3 },         // 4ターン目 … 緊急回復のあいだに遠距離へ移動
    { type:'WAIT' },                       // 5ターン目 … 距離技で引き戻す
    { type:'WAIT' },                       // 6ターン目 … 通常攻撃
    { type:'WAIT' },                       // 7ターン目以降 … 技変更 → 固有技でトドメ
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
  // ★タクティクスの台本は、技のid(連撃=rush・間合い攻撃=sweep など)で1手を書ける。
  //   倍率・見出し・アイコン・ヒット数は本番の抽選(chooseEnemyAction)と同じ定義から作るので、
  //   台本だけ古い表記や違う威力になることがない
  const tacticsDef = step.actionId && typeof TACTICS_ACTION_DEFINITIONS !== 'undefined'
    ? TACTICS_ACTION_DEFINITIONS.find(d => d.id === step.actionId) : null;
  if (tacticsDef) {
    const tacticsLabel = typeof enemyActionDisplayName === 'function'
      ? enemyActionDisplayName(enemy, tacticsDef) : (tacticsDef.category || '');
    const tacticsIcon = (typeof TACTICS_VARIANT_ICONS !== 'undefined' && TACTICS_VARIANT_ICONS[tacticsDef.variant])
      || (typeof ENEMY_ACTION_ICONS !== 'undefined' && ENEMY_ACTION_ICONS[tacticsDef.type]) || '⏳';
    // 間合い攻撃だけは「どの間合いを薙ぐか」を予告に持たせる(本番と同じく、いまいる間合い)
    if (tacticsDef.variant === 'sweep') {
      return { type:tacticsDef.type, variant:'sweep', sweepDist:currentDist,
        value:Math.floor(enemy.atk * tacticsDef.multiplier),
        missValue:Math.floor(enemy.atk * (tacticsDef.missMultiplier ?? 1)),
        label:`${tacticsLabel}: ${labels[currentDist]}`, icon:tacticsIcon, actionId:tacticsDef.id };
    }
    return { type:tacticsDef.type,
      ...(tacticsDef.variant ? { variant:tacticsDef.variant, hits:Math.max(1, Math.floor(Number(tacticsDef.hits) || 1)) } : {}),
      ...(tacticsDef.targetsAll ? { targetsAll:true } : {}),
      value:Math.floor(enemy.atk * tacticsDef.multiplier), label:tacticsLabel, icon:tacticsIcon, actionId:tacticsDef.id };
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
