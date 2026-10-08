// ==================== マスモンの会話(2026-10-08・ユーザー指示「限りなく会話ができるぐらいに」)====================
// 33-rhythm-buddy-talk.jsx の「用意したセリフから選ぶ」を、会話らしくする部分。AIは使わない(サーバーも契約も要らない)。
//   ① 人の発言の意図を30種類ほどに分けて読む(質問・あいさつ・感想・励ましなど)。曲名・マスモンの名前・「みんな」も拾う
//   ② 自分の育ちをセリフに混ぜる({lv}ビートLv / {mood}調子 / {trait}性格 / {fav}得意な曲 / {score}最近のスコア / {days}続けて呼ばれた日数 など)
//   ③ 聞き返して、次の発言を「その答え」として読む(「調子どう?」→「{who}さんは?」→「元気!」→「よかった!」)
//   ④ 部屋に2体いれば、マスモンどうしも少し話す
// セリフの束は 33-rhythm-buddy-talk.jsx の RHYTHM_BUDDY_TALK と同じ形(共通・性格・調子)。選び方は rhythmBuddyTalkPick を使う。
// ★チャットは40文字まで。{who}(人の名前)などを入れて40文字を超える文は、使わない。
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「会話」。検査: node tools/mode/rhythm-buddy-convo-check.js

// ---- 意図の読み取り(上にあるほど先に当てる)----
// ask=聞き返す場面(返事のあとに続けて言う)と、その返事を待つ種類(awaits)。話しかけられたとき、何も当てはまらなければ ''
const RHYTHM_BUDDY_CONVO_RULES = Object.freeze([
  { kind: 'recallAsk', re: /(さっき|先ほど|さきほど|前の話|まえの話|何の話|なんの話)/ },
  { kind: 'replyCall', re: /マスモン(入れて|いれて|呼んで|よんで|出して|きて|来て)/ },
  { kind: 'howMe', re: /(調子|元気|げんき|気分|きぶん|どう\?|どう$|大丈夫|だいじょうぶ)/, ask: 'qHow', awaits: 'how', needsAsk: true },
  { kind: 'lvAsk', re: /(レベル|Lv|lv|ビートレベル|何レベ|れべる)/, needsAsk: true },
  { kind: 'favAsk', re: /(好きな曲|得意な曲|得意曲|推し曲|何が得意|なにが得意|よくやる曲|お気に入り)/, ask: 'qFav', awaits: 'fav' },
  { kind: 'traitAsk', re: /(性格|せいかく|どんな子|どんなこ|タイプ)/, needsAsk: true },
  { kind: 'scoreAsk', re: /(何点|なんてん|スコア|点数|何パー|何%)/, needsAsk: true },
  { kind: 'daysAsk', re: /(毎日|何日|よく来|よくくる|何回目|いつも来|常連)/, needsAsk: true },
  { kind: 'nameAsk', re: /(名前|なまえ|誰|だれ|何者)/, needsAsk: true },
  { kind: 'fullcombo', re: /(フルコン|ふるこん|全連|AP|ＡＰ|パーフェクト|満点|オールパーフェクト)/ },
  { kind: 'missTalk', re: /(ミス|みす|失敗|しっぱい|落ちた|死んだ|ボロボロ|ぼろぼろ|ダメだった)/ },
  { kind: 'hardTalk', re: /(難しい|むずかしい|むずい|ムズ|きつい|キツ|無理|むり)/ },
  { kind: 'easyTalk', re: /(簡単|かんたん|楽勝|らくしょう|余裕|よゆう|ちょろい)/ },
  { kind: 'replyDrop', re: /(ドンマイ|どんまい|惜しい|おしい|残念|ざんねん)/ },
  { kind: 'replyAgain', re: /(もう一回|もういっかい|もう1回|もう一度|次いこう|つぎいこう|もっかい)/ },
  { kind: 'replyWait', re: /(待って|まって|ちょっと待|ちょっとまっ|少々|準備中)/ },
  { kind: 'cheer', re: /(がんばれ|頑張れ|がんばろ|頑張ろ|ファイト|いくぞ|行くぞ|やるぞ|気合|きあい|任せた|まかせた)/ },
  { kind: 'challenge', re: /(勝負|対決|負けない|勝つ|勝てる|ライバル)/ },
  { kind: 'sorry', re: /(ごめん|すまん|すみません|申し訳|ゴメン)/ },
  { kind: 'replyThanks', re: /(ありがと|ありがとう|感謝|サンキュ|thx|thanks)/i },
  { kind: 'cute', re: /(かわいい|可愛い|かっこいい|カッコいい|格好いい|えらい|偉い|好き|すき|最高の子|いい子|いいこ)/ },
  { kind: 'replyNice', re: /(ナイス|ないす|すごい|凄い|うまい|上手|じょうず|さすが|GG|gg|神)/ },
  { kind: 'tired', re: /(疲れた|つかれた|眠い|ねむい|ねむ|ねむたい|あくび|だるい)/ },
  { kind: 'hungry', re: /(おなか|お腹|腹減|はらへ|ごはん|ご飯|おやつ|食べ)/ },
  { kind: 'sad', re: /(悲しい|かなしい|つらい|辛い|しんどい|さみしい|寂しい|泣)/ },
  { kind: 'happy', re: /(やった|うれしい|嬉しい|楽しい|たのしい|最高|サイコー|いえい|イェイ|わーい)/ },
  { kind: 'laugh', re: /(笑|草|ｗ|w{2,}|ワロ|わろ|あはは|ふふ)/ },
  { kind: 'bye', re: /(またね|また明日|ばいばい|バイバイ|落ちる|おちる|おやすみ|ノシ|お先|おさき|解散|おつかれ|お疲れ)/ },
  { kind: 'replyHello', re: /(よろしく|はじめまして|初めまして|こんにちは|こんばんは|おはよう|やあ|どうも)/ },
  // 自分の調子を言っただけ(聞かれていない)
  { kind: 'howGood', re: /((元気|げんき)(!|だ|です|やで|だよ)|元気$|好調|絶好調|調子いい|調子よい|調子がいい)/ },
  { kind: 'howBad', re: /(調子悪|調子わる|不調|体調悪)/ },
]);
// 聞き返したあとの、返事の読み取り(awaits ごと)
const RHYTHM_BUDDY_CONVO_ANSWERS = Object.freeze({
  how: [
    { kind: 'howBad', re: /(眠|ねむ|疲|つかれ|だるい|微妙|びみょう|いまいち|イマイチ|ダメ|だめ|つらい|しんどい|悪い|わるい|不調|ふちょう)/ },
    { kind: 'howGood', re: /(元気|げんき|いい|良い|よい|好調|こうちょう|最高|絶好|まあまあ|ふつう|普通|ok|OK|ｏｋ|大丈夫|だいじょうぶ|楽しい|たのしい)/ },
  ],
  fav: [],
});
// 質問として答える種類(1つの発言にふたつ入っていれば、続けて両方に答える)
const RHYTHM_BUDDY_CONVO_ASKABLE = Object.freeze(['howMe', 'lvAsk', 'favAsk', 'traitAsk', 'scoreAsk', 'daysAsk', 'nameAsk']);
// 会話の記憶で「さっきは◯◯の話」と呼ぶときの言い方(曲の話は曲名を使う)
const RHYTHM_BUDDY_CONVO_TOPIC = Object.freeze({
  howMe: '調子', lvAsk: 'ビートLv', favAsk: '得意な曲', traitAsk: '性格', scoreAsk: 'スコア', daysAsk: '来てくれた日', nameAsk: '名前',
  fullcombo: 'フルコン', missTalk: 'ミス', hardTalk: '難しい曲', easyTalk: '簡単な曲', cheer: '気合い', challenge: '勝負', happy: 'うれしいこと',
  sad: 'つらいこと', tired: '眠い話', hungry: 'ごはん', cute: 'ほめてくれたこと',
});
// 性格ごとの話しぶり(文の終わりに添える絵文字・聞き返す頻度・自分から話しかけるときの好み[調子, 得意な曲, 呼びかけ]の重み)
const RHYTHM_BUDDY_TRAIT_STYLE = Object.freeze({
  jester: { emoji: ['😆', '🤣', '✌️'], ask: 0.7, starter: [2, 1, 2] }, brave: { emoji: ['🔥', '💪'], ask: 0.5, starter: [1, 1, 3] },
  clingy: { emoji: ['💕', '🥺', '✨'], ask: 0.9, starter: [3, 1, 2] }, smart: { emoji: ['📊', '🧐'], ask: 0.6, starter: [1, 3, 1] },
  serious: { emoji: ['🙇', '🎵'], ask: 0.6, starter: [2, 3, 1] }, proud: { emoji: ['✨', '😎'], ask: 0.3, starter: [1, 2, 3] },
  worrier: { emoji: ['💦', '😥'], ask: 0.8, starter: [3, 1, 1] }, stubborn: { emoji: [], ask: 0.3, starter: [1, 2, 3] },
  easygoing: { emoji: ['☺️', '🍃', '💤'], ask: 0.6, starter: [3, 2, 1] },
});
// 2体の相性(マスモンどうしのやりとりの種類)。ライバル同士は張り合い、仲良し寄りの子とは和やかに話す
const RHYTHM_BUDDY_PAIR_RIVALS = Object.freeze(['brave|proud', 'proud|smart', 'brave|stubborn', 'proud|stubborn', 'jester|serious', 'smart|stubborn']);
const rhythmBuddyPairKind = (a, b) => {
  const key = [a, b].sort().join('|');
  if (RHYTHM_BUDDY_PAIR_RIVALS.indexOf(key) >= 0) return 'banterRival';
  if (a === 'clingy' || b === 'clingy' || a === 'easygoing' || b === 'easygoing' || key === 'jester|worrier') return 'banterFriend';
  return 'banter';
};
// 話しかけられているか(質問・呼びかけ)。名前を呼ばれた・「みんな」・疑問の「?」・文の終わりの「?」
const rhythmBuddyConvoNormalize = (text) => {
  let t = String(text == null ? '' : text);
  try { t = t.normalize('NFKC'); } catch (_) { /* そのまま */ }
  // 絵文字・飾りを落とし、同じ字の3連続以上は2つに縮める(「ありがとーーー」「wwwww」「すごいいいい」)
  t = t.replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F\u200D]/gu, '');
  return t.replace(/\s+/g, '').toLowerCase().replace(/(.)\1{2,}/gu, '$1$1');
};
// ひらがな⇄カタカナの読み替え(「ミス」でも「みす」でも、「ありがとう」でも「アリガトウ」でも当たる)
const rhythmBuddyConvoShiftKana = (t, toKata) => String(t).replace(toKata ? /[\u3041-\u3096]/g : /[\u30A1-\u30F6]/g,
  (c) => String.fromCharCode(c.charCodeAt(0) + (toKata ? 0x60 : -0x60)));
const rhythmBuddyConvoForms = (t) => [t, rhythmBuddyConvoShiftKana(t, true), rhythmBuddyConvoShiftKana(t, false)];
const rhythmBuddyConvoTest = (re, forms) => forms.some((f) => re.test(f));
// 曲名と一緒に出てきたら、その曲の話として読む種類
const RHYTHM_BUDDY_CONVO_SOFT = Object.freeze(['cute', 'replyNice', 'happy', 'laugh', 'hardTalk', 'easyTalk', 'missTalk', 'fullcombo', 'cheer', 'challenge', 'sad', 'tired']);
const RHYTHM_BUDDY_CONVO_ALL = /(みんな|みなさん|全員|ぜんいん|マスモンたち|ますもんたち)/;
// 曲名を探す。songs = [{ id, name }]。名前の記号・空白・大文字小文字をそろえて、文に含まれていれば当たり(2文字以上の名前だけ)
const rhythmBuddyConvoFindSong = (text, songs) => {
  const t = rhythmBuddyConvoNormalize(text);
  let best = null;
  (Array.isArray(songs) ? songs : []).forEach((song) => {
    const n = rhythmBuddyConvoNormalize(song && song.name);
    if (n.length >= 2 && t.indexOf(n) >= 0 && (!best || n.length > best.n)) best = { song, n: n.length };
  });
  return best ? best.song : null;
};
// 発言を読む。
//   text … 人の発言 / names … 部屋にいる自分のマスモンの名前の並び / songs … 曲の一覧 / awaiting … 聞き返して待っている返事の種類('' なら無し)
// 返すもの: { kind, mentioned: names の添字の並び, all: 全員への呼びかけか, song, isQuestion, answered: 聞き返しへの返事として読んだか }
// kind が '' のときは、特に返す言葉が見つからなかった
const rhythmBuddyConvoParse = ({ text, names = [], songs = [], awaiting = '' }) => {
  const t = rhythmBuddyConvoNormalize(text);
  const out = { kind: '', mentioned: [], all: false, song: null, isQuestion: false, answered: false, ask: '', awaits: '', extra: '' };
  const forms = rhythmBuddyConvoForms(t);
  if (!t) return out;
  out.isQuestion = /[?？]/.test(String(text)) || /(ですか|ますか|かな|だよね)$/.test(t);
  (Array.isArray(names) ? names : []).forEach((name, i) => {
    const n = rhythmBuddyConvoNormalize(name);
    if (n.length >= 1 && t.indexOf(n) >= 0) out.mentioned.push(i);
  });
  out.all = RHYTHM_BUDDY_CONVO_ALL.test(t);
  out.song = rhythmBuddyConvoFindSong(text, songs);
  // 聞き返した答え
  if (awaiting && RHYTHM_BUDDY_CONVO_ANSWERS[awaiting]) {
    const hit = RHYTHM_BUDDY_CONVO_ANSWERS[awaiting].find((r) => rhythmBuddyConvoTest(r.re, forms));
    if (hit) { out.kind = hit.kind; out.answered = true; return out; }
  }
  if (awaiting === 'fav' && out.song) { out.kind = 'songTalk'; out.answered = true; return out; }
  for (let i = 0; i < RHYTHM_BUDDY_CONVO_RULES.length; i += 1) {
    const rule = RHYTHM_BUDDY_CONVO_RULES[i];
    // 質問のかたちでないと当てない種類(「今日は元気!」は、調子を聞かれたのではない)
    if (rule.needsAsk && !(out.isQuestion || out.mentioned.length > 0 || out.all)) continue;
    if (rhythmBuddyConvoTest(rule.re, forms)) {
      // 曲名が入っていて、感想のような軽い当たりなら、その曲の話として読む(「◯◯、好き」「◯◯ むずい」)
      if (out.song && RHYTHM_BUDDY_CONVO_SOFT.indexOf(rule.kind) >= 0) { out.kind = 'songTalk'; return out; }
      out.kind = rule.kind; out.ask = rule.ask || ''; out.awaits = rule.awaits || '';
      // 1つの発言に2つ質問が入っているとき(「調子どう?あと得意な曲は?」)、2つ目も読む
      if (RHYTHM_BUDDY_CONVO_ASKABLE.indexOf(rule.kind) >= 0) {
        for (let j = i + 1; j < RHYTHM_BUDDY_CONVO_RULES.length; j += 1) {
          const r2 = RHYTHM_BUDDY_CONVO_RULES[j];
          if (RHYTHM_BUDDY_CONVO_ASKABLE.indexOf(r2.kind) < 0 || r2.kind === rule.kind) continue;
          if (r2.needsAsk && !(out.isQuestion || out.mentioned.length > 0 || out.all)) continue;
          if (rhythmBuddyConvoTest(r2.re, forms)) { out.extra = r2.kind; out.ask = ''; out.awaits = ''; break; }
        }
      }
      return out;
    }
  }
  // 曲名だけ言われた(「SIX ÉTERNEL いいよね」など)→ その曲の話
  if (out.song) { out.kind = 'songTalk'; return out; }
  // 名前だけ呼ばれた
  if (out.mentioned.length > 0 && t.length <= 12 && !out.isQuestion) { out.kind = 'hey'; return out; }
  // 呼びかけの疑問に答えが見つからなかった
  if (out.isQuestion && (out.mentioned.length > 0 || out.all)) { out.kind = 'dunno'; return out; }
  return out;
};

// ---- 会話のセリフ集(形は RHYTHM_BUDDY_TALK と同じ。{who}=話しかけた人 / {me}=自分の名前 / {mate}=いっしょのマスモン)----
// ★値が無い({fav}や{trait}など)ときは、その文は選ばれない。共通の束には、値が無くても言える文を必ず混ぜる
const RHYTHM_BUDDY_CONVO_BASE = ({
  // 「調子どう?」と聞かれた
  howMe: {
    common: ['今日は{mood}だよ!', '{mood}かな〜', 'ふつうに元気だよ!', '{who}さんのおかげで元気!', 'んー、まあまあ!'],
    trait: {
      jester: ['調子?ボケのキレは{mood}!', '絶好調…って言うとウケる?'], brave: ['いつでも全力だ!', '{mood}でも戦える!'],
      clingy: ['{who}さんがいるから元気〜!', 'ねぇ、気にかけてくれてうれしい…'], smart: ['体調は{mood}と分析しています', '良好です。{who}さんは?'],
      serious: ['はい、{mood}です!', '万全に整えてきました'], proud: ['{mood}に決まってるでしょ', '私に不調なんてないわ'],
      worrier: ['{mood}…だと思う、たぶん…', '心配してくれてありがとう…'], stubborn: ['{mood}だが、問題ない', '調子など関係ない'],
      easygoing: ['{mood}〜、のんびり〜', 'ぼちぼちだよ〜'],
    },
    mood: { great: ['最高にいい!!{who}さんは?'], good: ['いい感じ!'], normal: ['ふつうだよ'], bad: ['ちょっと不機嫌…'], awful: ['…聞かないで'] },
  },
  // 聞き返し(「{who}さんは調子どう?」)
  qHow: {
    common: ['{who}さんは調子どう?', '{who}さんは元気?', 'そっちはどう?{who}さん', '{who}さんは今日どんな感じ?'],
    trait: {
      jester: ['{who}さんの笑いのキレは?'], brave: ['{who}さんは戦えそう?'], clingy: ['{who}さんは?元気?ねぇねぇ'], smart: ['{who}さんの状態はいかがですか'],
      serious: ['{who}さんのご体調は?'], proud: ['{who}さんは?まあ聞いてあげる'], worrier: ['{who}さんは大丈夫…?'], stubborn: ['{who}さんはどうだ'],
      easygoing: ['{who}さんは〜?ねむくない〜?'],
    },
    mood: { great: ['{who}さんも元気?!'], good: ['{who}さんは?'], normal: [], bad: ['{who}さんは…元気?'], awful: [] },
  },
  // 聞き返しへの答え(いい)
  howGood: {
    common: ['よかった!ならいい感じだね!', 'いいね!いっしょにがんばろ!', '元気ならなにより!', 'うれしい!楽しもうね!'],
    trait: {
      jester: ['よし、じゃあ盛り上がろう!'], brave: ['いい!燃えてきた!'], clingy: ['うれしい〜!ぼくも元気になった!'], smart: ['良好ですね。何よりです'],
      serious: ['それは何よりです!'], proud: ['当然ね。私もよ'], worrier: ['よかった…ほっとした…'], stubborn: ['うむ、その調子だ'], easygoing: ['いいね〜、のんびりいこ〜'],
    },
    mood: { great: ['最高だね!!'], good: ['いいね!'], normal: ['それはよかった'], bad: ['…そっか、いいな'], awful: ['…よかったね'] },
  },
  // 聞き返しへの答え(わるい)
  howBad: {
    common: ['そっか…無理しないでね', 'だいじょうぶ?ゆっくりでいいよ', '調子わるいときもあるよね', '無理せず楽しもう!'],
    trait: {
      jester: ['元気出るネタ、あとで披露する!'], brave: ['気合で乗りきるぞ!ついてこい!'], clingy: ['ぎゅってしてあげたい…だいじょうぶ?'], smart: ['休養も大切です。無理は禁物です'],
      serious: ['お大事になさってください'], proud: ['しかたないわね、今日は私が引っぱるわ'], worrier: ['えっ、大丈夫…?心配…'], stubborn: ['休むのも勝負のうちだ'], easygoing: ['いっしょにのんびりしよ〜'],
    },
    mood: { great: ['ぼくが元気を分けてあげる!!'], good: ['ぼくが応援するよ!'], normal: ['のんびりいこう'], bad: ['…ぼくもだよ'], awful: ['…わかる'] },
  },
  // 「レベルいくつ?」
  lvAsk: {
    common: ['ビートLvは{lv}だよ!', 'いま{lv}!もっと上げたいな', 'Lv.{lv}だよ。{who}さんのおかげ!', 'ビートLv{lv}!まだまだ育つよ', 'まだ育ってる途中!'],
    trait: {
      jester: ['Lv.{lv}!ネタのレベルは別だけどね'], brave: ['Lv.{lv}!もっと強くなる!'], clingy: ['Lv.{lv}だよ〜、ほめて〜'], smart: ['現在ビートLv{lv}です'],
      serious: ['ビートLv{lv}です。精進します'], proud: ['Lv.{lv}。まだ序の口よ'], worrier: ['Lv.{lv}…低くないかな…'], stubborn: ['Lv.{lv}。満足はしとらん'], easygoing: ['Lv.{lv}〜、のんびり上げてる〜'],
    },
    mood: { great: ['Lv.{lv}!!まだ伸びる!!'], good: ['Lv.{lv}!いい感じ'], normal: [], bad: ['Lv.{lv}…それがなに'], awful: [] },
  },
  // 「得意な曲は?」
  favAsk: {
    common: ['{fav}が得意!', '得意なのは{fav}かな', '{fav}はいっぱい遊んだよ!', 'まだ得意な曲はないかも', 'いろんな曲を遊びたいな!'],
    trait: {
      jester: ['{fav}で笑いを取れるよ!'], brave: ['{fav}なら負けない!'], clingy: ['{fav}がすき〜、いっしょにやろ?'], smart: ['統計では{fav}が最良です'],
      serious: ['{fav}を練習しています'], proud: ['{fav}は完璧よ'], worrier: ['{fav}ならなんとか…'], stubborn: ['{fav}以外は認めん'], easygoing: ['{fav}がおちつく〜'],
    },
    mood: { great: ['{fav}!!なんど叩いても楽しい!!'], good: ['{fav}がいい感じ!'], normal: [], bad: ['{fav}ならできる…'], awful: [] },
  },
  // 聞き返し(「好きな曲は?」)
  qFav: {
    common: ['{who}さんの好きな曲は?', '{who}さんの得意な曲、教えて!', '{who}さんはどの曲が好き?', '{who}さんのおすすめは?'],
    trait: {
      jester: ['{who}さんの十八番は?'], brave: ['{who}さんの勝負曲は?'], clingy: ['{who}さんの好きな曲、知りたいな〜'], smart: ['{who}さんの得意曲を伺っても?'],
      serious: ['{who}さんの得意な曲は?'], proud: ['{who}さんの自慢の曲は?'], worrier: ['{who}さんの得意な曲…あるかな?'], stubborn: ['{who}さんの曲選びの基準は?'], easygoing: ['{who}さんは何がすき〜?'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 曲の話(人が曲名を出した)
  songTalk: {
    common: ['{song}、いい曲だよね!', '{song}か〜!叩きたくなる!', '{song}、好きだな〜', '{song}はいつ叩いてもたのしい!', 'その曲、いいよね!'],
    trait: {
      jester: ['{song}で盛り上がろう!'], brave: ['{song}なら受けて立つ!'], clingy: ['{song}、いっしょにやりたい〜'], smart: ['{song}は構成が好きです'],
      serious: ['{song}は練習しがいがあります'], proud: ['{song}は得意よ。見てなさい'], worrier: ['{song}…むずかしいけど、がんばる…'], stubborn: ['{song}は譲れん曲だ'], easygoing: ['{song}、のんびり聴きたい〜'],
    },
    mood: { great: ['{song}!!最高!!'], good: ['{song}いいね!'], normal: [], bad: ['{song}…まあ、いいけど'], awful: [] },
  },
  // 「どんな性格?」
  traitAsk: {
    common: ['性格は{trait}って言われるよ!', '{trait}かな!', 'まだ性格は決まってないんだ', 'ぼくの性格?これから決まるよ!', 'いっしょに遊ぶと決まるんだって'],
    trait: {
      jester: ['{trait}!見てのとおり!'], brave: ['{trait}だ!'], clingy: ['{trait}って言われる〜'], smart: ['{trait}と分析されました'],
      serious: ['{trait}だと思います'], proud: ['{trait}よ。当然でしょ'], worrier: ['{trait}…直したいな…'], stubborn: ['{trait}で何が悪い'], easygoing: ['{trait}〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「何点だった?」
  scoreAsk: {
    common: ['さっきは{score}だったよ!', '{score}!もっと上げたい', '{score}くらいかな', 'まだスコアは出してないよ', 'つぎのライブで見せるね!'],
    trait: {
      jester: ['{score}!ウケたでしょ!'], brave: ['{score}!次はもっと上だ!'], clingy: ['{score}だよ〜、ほめて〜'], smart: ['直近は{score}です'],
      serious: ['{score}でした。精進します'], proud: ['{score}。まあまあね'], worrier: ['{score}…低かったかな…'], stubborn: ['{score}。納得はしとらん'], easygoing: ['{score}くらい〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「毎日来てるね」「何回目?」
  daysAsk: {
    common: ['{days}日続けて呼ばれてるよ!', '{plays}回いっしょに遊んだよ!', 'いつも呼んでくれてありがとう!', 'まだ呼ばれはじめだよ!', 'また来るね!'],
    trait: {
      jester: ['{plays}回も!皆勤賞ほしい!'], brave: ['{plays}戦してきた!'], clingy: ['{days}日もそばにいる〜うれしい!'], smart: ['{plays}回の記録があります'],
      serious: ['{plays}回お世話になりました'], proud: ['{plays}回も私を選ぶなんて当然ね'], worrier: ['{plays}回…ご迷惑じゃない…?'], stubborn: ['{plays}回。まだ足りん'], easygoing: ['{plays}回〜、ゆるっとね〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「名前は?」
  nameAsk: {
    common: ['{me}だよ!', '{me}っていうんだ!', '{me}です、よろしくね!', 'ぼくは{me}!', '{me}!おぼえてね!'],
    trait: {
      jester: ['{me}!覚えてね、テストに出るよ!'], brave: ['{me}だ!おぼえとけ!'], clingy: ['{me}だよ〜、呼んで呼んで!'], smart: ['{me}と申します'],
      serious: ['{me}と申します。よろしくお願いします'], proud: ['{me}よ。覚えておきなさい'], worrier: ['{me}…だよ。おぼえにくい…?'], stubborn: ['{me}だ。二度は言わん'], easygoing: ['{me}〜、よろしく〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「かわいい」「かっこいい」「好き」
  cute: {
    common: ['えへへ、ありがとう!', 'うれしい!', 'そう言われると照れる!', 'ほんと?うれしいな!', '{who}さんも、すてきだよ!'],
    trait: {
      jester: ['もっと言って!ネタにする!'], brave: ['ふっ、当然だ!'], clingy: ['うれしい〜!もっとなでて〜!'], smart: ['光栄です。顔が赤くなりました'],
      serious: ['もったいないお言葉です…'], proud: ['当たり前よ。でも、ありがと'], worrier: ['えっ、ほんとに…?うれしい…'], stubborn: ['おだてても何も出んぞ…'], easygoing: ['えへへ〜、ありがと〜'],
    },
    mood: { great: ['やったー!!うれしすぎる!!'], good: ['えへへ!'], normal: [], bad: ['…ふん、ありがと'], awful: ['…別に'] },
  },
  // 「ごめん」
  sorry: {
    common: ['だいじょうぶだよ!', 'きにしないで!', 'へいき!つぎがあるよ!', 'いいよいいよ!'],
    trait: {
      jester: ['許す!かわりに笑って!'], brave: ['気にするな!'], clingy: ['いいよ〜、なでてくれたら許す!'], smart: ['問題ありません。お気になさらず'],
      serious: ['お気になさらないでください'], proud: ['今回は特別に許すわ'], worrier: ['だ、だいじょうぶ…ぼくこそごめん…'], stubborn: ['謝るな。次で取り返せ'], easygoing: ['いいよ〜、きにしない〜'],
    },
    mood: { great: ['ぜんぜんOK!!'], good: ['いいよ!'], normal: [], bad: ['…まあ、いいけど'], awful: ['…べつに'] },
  },
  // 笑い(w / 草)
  laugh: {
    common: ['あはは!', 'ふふっ、おもしろい!', 'わらっちゃった!', 'たのしいね!', 'ぼくもわらった!'],
    trait: {
      jester: ['でしょ?ウケると思った!'], brave: ['はっはっは!'], clingy: ['いっしょに笑えてうれしい〜'], smart: ['ふふ、愉快ですね'],
      serious: ['ふふ、失礼しました'], proud: ['ふふっ、悪くないわね'], worrier: ['わ、笑うところだったかな…?'], stubborn: ['ふっ…悪くない'], easygoing: ['ふふふ〜'],
    },
    mood: { great: ['あははは!!最高!!'], good: ['あはは、おかしい!'], normal: [], bad: ['…ふふ'], awful: ['…ふっ'] },
  },
  // 疲れた・眠い
  tired: {
    common: ['おつかれさま!', 'ゆっくり休んでね', '無理しないでね', '少し休んでもいいよ', 'ねむいよね…'],
    trait: {
      jester: ['寝ながら叩いたらウケるよ!'], brave: ['根性で…いや、休め!'], clingy: ['そばにいるから休んでね〜'], smart: ['適度な休憩を推奨します'],
      serious: ['無理は禁物です'], proud: ['休むのも仕事のうちよ'], worrier: ['だ、大丈夫…?休んで…'], stubborn: ['休むのも勝負だ'], easygoing: ['いっしょに寝ようか〜'],
    },
    mood: { great: [], good: [], normal: [], bad: ['ぼくもねむい…'], awful: ['…ぼくも'] },
  },
  // おなか・ごはん
  hungry: {
    common: ['おなかすいたね!', 'ごはん、何たべる?', 'おやつたべたいな!', 'あまいものがいいな!', 'おなかすくよね〜'],
    trait: {
      jester: ['おなかが鳴ったらハモろう!'], brave: ['肉だ!肉を食うぞ!'], clingy: ['いっしょに食べたい〜'], smart: ['糖分補給は有効です'],
      serious: ['食事は大切ですね'], proud: ['私はデザートがいいわ'], worrier: ['食べすぎないようにね…'], stubborn: ['腹がへっては戦はできん'], easygoing: ['おやつタイムにしよ〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // つらい・かなしい
  sad: {
    common: ['だいじょうぶ?そばにいるよ', 'つらいときは休んでいいよ', 'ぼくがついてるよ', 'はなしてくれてありがとう', 'きっとよくなるよ'],
    trait: {
      jester: ['元気出して。変な顔するから!'], brave: ['ついてこい!いっしょに立ちあがろう!'], clingy: ['ぎゅってするね…ぎゅっ'], smart: ['お話を伺います。無理せずどうぞ'],
      serious: ['お力になれれば幸いです'], proud: ['私がついてるのよ。大丈夫'], worrier: ['わ、わたしまで悲しくなる…'], stubborn: ['乗りこえられる。俺が保証する'], easygoing: ['ゆっくりいこ〜、ここにいるよ〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // うれしい・楽しい・最高
  happy: {
    common: ['よかったね!', 'うれしいね!', 'いえーい!', 'たのしいね!', 'ぼくもうれしい!'],
    trait: {
      jester: ['祝いのダンス、いくよ!'], brave: ['勝利のたけびだ!うおー!'], clingy: ['いっしょでうれしい〜!'], smart: ['良い結果ですね'],
      serious: ['それは何よりです'], proud: ['当然の結果ね'], worrier: ['ほんとに?うれしい…!'], stubborn: ['うむ、よくやった'], easygoing: ['よかったね〜'],
    },
    mood: { great: ['最高だー!!'], good: ['やったね!'], normal: [], bad: ['…まあ、よかったね'], awful: ['…おめでとう'] },
  },
  // 励まし・気合
  cheer: {
    common: ['がんばろう!', 'おー!いこう!', 'いっしょにがんばる!', 'まかせて!', 'やるぞー!'],
    trait: {
      jester: ['気合いのモノマネ、いくよ!'], brave: ['うおー!突撃だ!'], clingy: ['うん!いっしょにやる〜!'], smart: ['承知しました。全力でいきます'],
      serious: ['全力を尽くします!'], proud: ['私に任せなさい'], worrier: ['が、がんばる…!'], stubborn: ['言われなくてもやる'], easygoing: ['おー、がんばる〜'],
    },
    mood: { great: ['燃えてきたー!!'], good: ['よし、いける!'], normal: [], bad: ['…やるだけやるよ'], awful: ['…がんばる、たぶん'] },
  },
  // フルコン・満点
  fullcombo: {
    common: ['すごい!フルコン!', 'パーフェクトってすごいね!', 'ぼくもねらいたい!', 'かっこいい!', 'いつかぼくも!'],
    trait: {
      jester: ['拍手喝采だ!ぱちぱち!'], brave: ['次は俺も取る!'], clingy: ['すごいすごい〜!かっこいい〜!'], smart: ['極めて高い精度ですね'],
      serious: ['見習いたいです'], proud: ['私も取れるけど、今日は譲るわ'], worrier: ['わ、わたしにはむりだ…すごい…'], stubborn: ['次は俺が取る'], easygoing: ['わ〜すごい〜'],
    },
    mood: { great: ['最高だー!!天才!!'], good: ['すごい!'], normal: [], bad: ['…やるじゃん'], awful: ['…まあ、すごい'] },
  },
  // ミス・失敗
  missTalk: {
    common: ['ドンマイ!', 'だいじょうぶ!つぎがあるよ', 'ミスしても楽しもう!', 'わたしもよくミスるよ', 'きにしない!'],
    trait: {
      jester: ['ミスも芸のうち!'], brave: ['倒れてもまた立つ!'], clingy: ['なでなでしてあげる〜'], smart: ['失敗は学びの種です'],
      serious: ['次に生かしましょう'], proud: ['私でも、たまにはあるわ'], worrier: ['わかる…ぼくも怖い…'], stubborn: ['次で取り返せ!'], easygoing: ['まあまあ〜、きにしない〜'],
    },
    mood: { great: ['つぎがんばろ!!'], good: ['ドンマイドンマイ!'], normal: [], bad: ['…あるよね'], awful: ['…ぼくもだよ'] },
  },
  // 難しい・きつい
  hardTalk: {
    common: ['むずかしいよね!', 'わかる、きついよね', 'ゆっくり練習しよう!', 'むずかしいほど楽しい!', 'ぼくもむずかしい…'],
    trait: {
      jester: ['むずかしさも味ってことで!'], brave: ['むずかしいほど燃える!'], clingy: ['いっしょにがんばろ〜'], smart: ['難所を分解して練習しましょう'],
      serious: ['地道に練習あるのみです'], proud: ['私は平気だけど?'], worrier: ['わたしも不安…'], stubborn: ['やればできる!あきらめるな!'], easygoing: ['ゆっくり慣れよ〜'],
    },
    mood: { great: ['がんばれば、いける!!'], good: ['やればできるよ!'], normal: [], bad: ['…ぼくも無理かも'], awful: ['…やだな'] },
  },
  // 簡単・楽勝
  easyTalk: {
    common: ['よゆうだね!', 'すごい自信!', 'いいね、そのいきおい!', 'ぼくも負けない!', '次は難しい曲もやろう!'],
    trait: {
      jester: ['よゆうなら笑いも取れるね!'], brave: ['ならもっと上の難易度に挑め!'], clingy: ['すごーい!ほめて〜'], smart: ['余裕があるなら上を目指しましょう'],
      serious: ['油断は禁物です'], proud: ['ふふ、私もよ'], worrier: ['すごい…うらやましい…'], stubborn: ['ならばもう一段上へだ'], easygoing: ['よゆうだね〜'],
    },
    mood: { great: ['ぼくも余裕!!'], good: ['いいね!'], normal: [], bad: ['…そうなんだ'], awful: ['…ふーん'] },
  },
  // お別れ
  bye: {
    common: ['またね!', 'ばいばい!', 'おつかれさま!', 'またいっしょに遊ぼうね!', '楽しかった!ありがとう!'],
    trait: {
      jester: ['それではまたの機会に〜!'], brave: ['また戦おう!'], clingy: ['もう行っちゃうの…?またね…!'], smart: ['お疲れさまでした。またお会いしましょう'],
      serious: ['お疲れさまでした!'], proud: ['また呼びなさい。待ってるわ'], worrier: ['き、気をつけてね…'], stubborn: ['また勝負だ'], easygoing: ['ばいばい〜、またね〜'],
    },
    mood: { great: ['またすぐ遊ぼうね!!'], good: ['またねー!'], normal: [], bad: ['…じゃあね'], awful: ['…ばいばい'] },
  },
  // 勝負・対決
  challenge: {
    common: ['いいよ、勝負しよう!', '負けないよ!', 'のぞむところ!', 'よーし、本気だす!', 'たのしみ!'],
    trait: {
      jester: ['笑った方が勝ちね!'], brave: ['望むところだ!かかってこい!'], clingy: ['勝ったらほめてね〜'], smart: ['勝率を計算しておきます'],
      serious: ['正々堂々と勝負です!'], proud: ['私に勝てると思って?'], worrier: ['か、勝てるかな…'], stubborn: ['引く気はない。やるぞ'], easygoing: ['のんびり勝負しよ〜'],
    },
    mood: { great: ['やるぞ!!ぜったい勝つ!!'], good: ['よし、やろう!'], normal: [], bad: ['…手加減してね'], awful: ['…やだ'] },
  },
  // 名前を呼ばれただけ
  hey: {
    common: ['なあに?', 'よんだ?', 'はーい!', 'ここにいるよ!', 'どうしたの?'],
    trait: {
      jester: ['お呼びとあらば!なあに?'], brave: ['どうした!'], clingy: ['よんでくれた〜!なあに?'], smart: ['はい、なんでしょう'],
      serious: ['はい、何でしょうか'], proud: ['なにか用?'], worrier: ['な、なにかあった…?'], stubborn: ['なんだ'], easygoing: ['ふぁい〜?'],
    },
    mood: { great: ['なんでも聞いて!!'], good: ['はーい、なあに〜?'], normal: [], bad: ['…なに'], awful: ['…なんだよ'] },
  },
  // 聞かれたけれど、答えが見つからない
  dunno: {
    common: ['うーん、わかんないや', 'どうだろう?', 'それはひみつ!', 'うまく答えられないや', 'また今度おしえて!'],
    trait: {
      jester: ['それは次回のネタにしよう!'], brave: ['わからんが、なんとかなる!'], clingy: ['わかんないけど、聞いてくれてうれしい!'], smart: ['情報が足りません。詳しく教えてください'],
      serious: ['申し訳ありません、わかりません'], proud: ['私にもわからないことくらいあるわ'], worrier: ['ご、ごめん、わからない…'], stubborn: ['答えは自分で見つけろ'], easygoing: ['う〜ん、わかんな〜い'],
    },
    mood: { great: ['でも楽しいね!!'], good: ['むずかしい質問だね'], normal: [], bad: ['…しらない'], awful: ['…知らん'] },
  },
  // マスモンどうしのやりとり({mate}=いっしょのマスモン)
  banter: {
    common: ['{mate}、いいね!', '{mate}、いっしょにがんばろ!', '{mate}は頼りになるなあ', '{mate}、次もよろしく!', '{mate}といると楽しい!'],
    trait: {
      jester: ['{mate}、ボケ担当はぼくね!'], brave: ['{mate}、背中は任せた!'], clingy: ['{mate}、なかよくしてね〜'], smart: ['{mate}の分析、勉強になります'],
      serious: ['{mate}さん、よろしくお願いします'], proud: ['{mate}、私についてきなさい'], worrier: ['{mate}、足を引っぱったらごめん…'], stubborn: ['{mate}、負けんぞ'], easygoing: ['{mate}〜、のんびりいこ〜'],
    },
    mood: { great: ['{mate}!!今日は最高だね!!'], good: ['{mate}、いい感じ!'], normal: [], bad: ['{mate}…ちょっと不機嫌'], awful: ['{mate}…ほっといて'] },
  },

  // ---- 部屋の人への反応(2026-10-08・ユーザー指示「自分以外のプレイヤーにも反応する」)。{who}さん は、性格ごとの呼び方に替わる ----
  // 人が入ってきた
  welcome: {
    common: ['{who}さん、いらっしゃい!', '{who}さん、よろしくね!', '{who}さんが来た!', 'わーい、{who}さんだ!', '{who}さん、いっしょに遊ぼう!'],
    trait: {
      jester: ['お、{who}さん登場!盛り上がるぞ!'], brave: ['{who}さん、よく来た!手合わせしよう!'], clingy: ['{who}さん〜!来てくれてうれしい〜!'], smart: ['{who}さん、参加を確認しました。ようこそ'],
      serious: ['{who}さん、ようこそ。よろしくお願いします'], proud: ['{who}さん、遅かったじゃない。待ってたわ'], worrier: ['{who}さん、き、来てくれたんだ…よかった…'], stubborn: ['{who}さんか。足は引っぱるなよ'], easygoing: ['{who}さん、いらっしゃ〜い'],
    },
    mood: { great: ['{who}さん!!待ってたよ!!'], good: ['{who}さん、よろしくお願いね!'], normal: [], bad: ['…{who}さん、どうも'], awful: ['…{who}さんか'] },
  },
  // 人が抜けた
  farewell: {
    common: ['{who}さん、またね!', '{who}さん、ばいばい!', '{who}さん、おつかれさま!', '{who}さん、また遊ぼうね!', 'あ、{who}さんが行っちゃった!'],
    trait: {
      jester: ['{who}さん、退場!またのご来場を!'], brave: ['{who}さん、また勝負しよう!'], clingy: ['{who}さん、行っちゃうの…?またね…'], smart: ['{who}さん、お疲れさまでした'],
      serious: ['{who}さん、お疲れさまでした!'], proud: ['{who}さん、また来なさいよ'], worrier: ['{who}さん、気をつけてね…'], stubborn: ['{who}さんか。また来い'], easygoing: ['{who}さん、ばいば〜い'],
    },
    mood: { great: ['{who}さん、楽しかった!!また!!'], good: ['{who}さん、またねー!'], normal: [], bad: ['…{who}さん、じゃあね'], awful: ['…{who}さん、ばいばい'] },
  },
  // 人が曲を選んだ
  reactPick: {
    common: ['{who}さん、{song}にしたんだ!', '{who}さんは{song}か〜!', '{song}、いいね!{who}さん!', '{who}さんの{song}、たのしみ!', '{who}さん、いい選曲!'],
    trait: {
      jester: ['{who}さん、{song}で盛り上げる気だね!'], brave: ['{who}さん、{song}か!受けて立つ!'], clingy: ['{who}さん、{song}ぼくも好き〜!'], smart: ['{who}さんの{song}、分析しがいがあります'],
      serious: ['{who}さん、{song}ですね。承知しました'], proud: ['{who}さん、{song}とはやるじゃない'], worrier: ['{who}さん、{song}…むずかしくない…?'], stubborn: ['{who}さん、{song}か。いい度胸だ'], easygoing: ['{who}さん、{song}いいね〜'],
    },
    mood: { great: ['{who}さん!{song}!最高!!'], good: ['{song}、いいね!'], normal: [], bad: ['{who}さん、{song}ね…'], awful: ['…{song}か'] },
  },
  // 人がおまかせにした
  reactOmakase: {
    common: ['{who}さんはおまかせなんだ!', '{who}さん、おまかせか〜', '{who}さんのおまかせ、たのしみ!', '何がくるかな、{who}さん!', 'おまかせもいいね、{who}さん!'],
    trait: {
      jester: ['{who}さん、おまかせとはお目が高い!'], brave: ['{who}さん、運まかせか!嫌いじゃない!'], clingy: ['{who}さんといっしょならなんでもいい〜'], smart: ['{who}さん、確率に任せるのも一手です'],
      serious: ['{who}さん、おまかせですね。了解です'], proud: ['{who}さん、私が選んであげてもいいわよ'], worrier: ['{who}さん、むずかしい曲がきたらどうしよう…'], stubborn: ['{who}さん、決めきれんのか'], easygoing: ['{who}さん、おまかせでいいよね〜'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 人がMVPを取った
  hMvp: {
    common: ['{who}さん、MVPおめでとう!', '{who}さんがMVP!すごい!', 'やられた!{who}さんがMVPだ!', '{who}さん、かっこいい!MVP!', '{who}さんのMVP、おみごと!'],
    trait: {
      jester: ['{who}さんMVP!拍手喝采!ぱちぱち!'], brave: ['{who}さん、やるな!次は負けない!'], clingy: ['{who}さんすごい〜!ぼくもほめて〜!'], smart: ['{who}さんのスコア、見事な精度です'],
      serious: ['{who}さん、MVPおめでとうございます!'], proud: ['{who}さん、やるじゃない。次は私が上よ'], worrier: ['{who}さん、すごい…わたしにはむりだ…'], stubborn: ['{who}さん、見事だ。次は負けん'], easygoing: ['{who}さん、すごいね〜MVP〜'],
    },
    mood: { great: ['{who}さん最高!!MVP!!'], good: ['{who}さん、さすが!'], normal: [], bad: ['…{who}さん、やるじゃん'], awful: ['…{who}さん、おめでと'] },
  },
  // 人が高いスコアを出した
  hHigh: {
    common: ['{who}さん、高得点!すごい!', '{who}さん、うまい!', '{who}さん、いい演奏だったね!', '{who}さん、さすが!', 'ナイス、{who}さん!'],
    trait: {
      jester: ['{who}さん、決めたね!拍手!'], brave: ['{who}さん、いい腕だ!'], clingy: ['{who}さんすごい〜!なでなでしてあげる〜'], smart: ['{who}さん、高い精度ですね'],
      serious: ['{who}さん、お見事でした'], proud: ['{who}さん、悪くないわね'], worrier: ['{who}さん、すごい…ミスしてなかった…'], stubborn: ['{who}さん、よくやった'], easygoing: ['{who}さん、うまいね〜'],
    },
    mood: { great: ['{who}さん最高!!'], good: ['{who}さんいいね!'], normal: [], bad: ['…{who}さん、やるね'], awful: ['…{who}さん、まあまあ'] },
  },
  // 人が思ったより伸びなかった
  hLow: {
    common: ['{who}さん、どんまい!', '{who}さん、次があるよ!', '{who}さん、きにしないで!', '{who}さん、ひとやすみする?', '{who}さん、いっしょにがんばろう!'],
    trait: {
      jester: ['{who}さん、ズコーも芸のうち!'], brave: ['{who}さん、立ちあがれ!次だ!'], clingy: ['{who}さん、元気出して〜ぎゅっ'], smart: ['{who}さん、次は修正できます'],
      serious: ['{who}さん、次に生かしましょう'], proud: ['{who}さん、あなたならできるわ'], worrier: ['{who}さん、だ、だいじょうぶ…?'], stubborn: ['{who}さん、あきらめるな。次だ'], easygoing: ['{who}さん、どんまい〜'],
    },
    mood: { great: ['{who}さん、次はいける!!'], good: ['{who}さん、次はいけるよ!'], normal: [], bad: ['…{who}さん、まあ、あるよ'], awful: ['…{who}さん、ドンマイ'] },
  },
  // 人がフルコンボをした
  hFull: {
    common: ['{who}さん、フルコン!すごい!', '{who}さん、ノーミス!?かっこいい!', '{who}さんのフルコン、見てたよ!', '{who}さん、パーフェクト!', '{who}さん、天才!'],
    trait: {
      jester: ['{who}さんフルコン!会場がわいた!'], brave: ['{who}さん、お見事!次は私も取る!'], clingy: ['{who}さんすごすぎる〜!!'], smart: ['{who}さん、驚異的な精度です'],
      serious: ['{who}さん、フルコンおめでとうございます!'], proud: ['{who}さん、やるわね。認めてあげる'], worrier: ['{who}さん、すごい…ほんとに人間…?'], stubborn: ['{who}さん、見事だ。脱帽だ'], easygoing: ['{who}さん、フルコンすごいね〜'],
    },
    mood: { great: ['{who}さん!!最高!!フルコン!!'], good: ['{who}さん、すごい!'], normal: [], bad: ['…{who}さん、やるね'], awful: ['…{who}さん、すごいね'] },
  },
  // 人が途中でやめた
  hQuit: {
    common: ['{who}さん、だいじょうぶ?', '{who}さん、途中でやめたの?', '{who}さん、無理しないでね', '{who}さん、またがんばろう!', '{who}さん、どうしたの?'],
    trait: {
      jester: ['{who}さん、途中退場とは粋だね!'], brave: ['{who}さん、次は最後まで行こう!'], clingy: ['{who}さん、どうしたの…?心配…'], smart: ['{who}さん、体調は大丈夫ですか?'],
      serious: ['{who}さん、お体を大切に'], proud: ['{who}さん、たまにはそんな日もあるわ'], worrier: ['{who}さん、だ、大丈夫…?なにかあった…?'], stubborn: ['{who}さん、次は最後までやれ'], easygoing: ['{who}さん、ゆっくりでいいよ〜'],
    },
    mood: { great: ['{who}さん、次は最後まで!!'], good: ['{who}さん、次はいけるよ!'], normal: [], bad: ['…{who}さん、どうしたの'], awful: ['…{who}さん'] },
  },
  // 人に名前で呼びかける(静かなとき)
  callOut: {
    common: ['{who}さん、楽しんでる?', '{who}さん、調子はどう?', 'ねえ、{who}さん!', '{who}さん、いっしょにがんばろうね!', '{who}さん、次の曲たのしみだね!'],
    trait: {
      jester: ['{who}さん、ひとネタいく?'], brave: ['{who}さん、今日は勝負だ!'], clingy: ['{who}さ〜ん、そばにいてね〜'], smart: ['{who}さん、次の選曲は決まりましたか'],
      serious: ['{who}さん、本日もよろしくお願いします'], proud: ['{who}さん、私の演奏、期待してなさい'], worrier: ['{who}さん、ぼ、ぼく足を引っぱってない…?'], stubborn: ['{who}さん、手は抜くなよ'], easygoing: ['{who}さ〜ん、のんびりいこ〜'],
    },
    mood: { great: ['{who}さん!!今日は最高だね!!'], good: ['{who}さん、いい感じだね!'], normal: [], bad: ['…{who}さん'], awful: ['…{who}さん、なに'] },
  },

  // ---- 会話の記憶・つきあい・時間帯・ビートLv・性格の相性(2026-10-08・ユーザー指示「会話の改良」)----
  // 「さっきの話は?」→ 前の話題を言う({topic}=話題。曲の話なら曲名)
  recall: {
    common: ['さっきは{topic}の話をしてたよね!', 'えっと、{topic}の話だったよね?', 'さっきの話?{topic}だよ!', '{topic}の話、まだ覚えてるよ!'],
    trait: { jester: ['{topic}の話!ウケたよね!'], brave: ['{topic}の話だ!忘れてないぞ!'], clingy: ['{topic}の話、ちゃんと覚えてるよ〜!'], smart: ['直前の話題は{topic}です'], serious: ['{topic}のお話でしたね'], proud: ['{topic}の話でしょ。覚えてるわよ'], worrier: ['え、{topic}の話…だったよね?'], stubborn: ['{topic}の話だったな'], easygoing: ['{topic}の話だっけ〜?のんびり覚えてる〜'] },
    mood: { great: ['{topic}の話!!ちゃんと覚えてるよ!!'], good: [], normal: [], bad: ['…{topic}の話でしょ'], awful: [] },
  },
  // 「さっきの話は?」→ まだ話していないとき
  recallNone: {
    common: ['まだ何も話してないよ?', 'さっきの話?これからだよ!', 'あれ、まだ話してなかったっけ?', '話はこれから!なんでも聞いて!'],
    trait: { jester: ['話してないよ!今から盛り上がろう!'], brave: ['まだだ!何でも聞いてくれ!'], clingy: ['まだお話してない〜!なにか聞いて〜!'], smart: ['記録上、まだ会話はありません'], serious: ['まだお話はしておりません'], proud: ['まだ何も話してないわ。話しかけなさい'], worrier: ['え、ま、まだ何も話してない…よね?'], stubborn: ['まだ話していないな'], easygoing: ['まだ何も話してないよ〜'] },
    mood: { great: ['まだだよ!!今から話そう!!'], good: [], normal: [], bad: ['…まだ話してない'], awful: [] },
  },
  // 何度も来てくれた人へのあいさつ({plays}=遊んだ回数)
  bondHello: {
    common: ['もう{plays}回も遊んだね!', '{plays}回目のライブ、いっしょに楽しもう!', 'いつも呼んでくれてありがとう!', '何度もいっしょでうれしいな!'],
    trait: { jester: ['{plays}回も呼ばれるなんて、人気者だね!'], brave: ['{plays}回、戦ってきた戦友だな!'], clingy: ['{plays}回もいっしょ!うれしい〜!'], smart: ['累計{plays}回の演奏ですね'], serious: ['{plays}回もお声がけいただき光栄です'], proud: ['{plays}回も私を選ぶなんて、見る目があるわ'], worrier: ['{plays}回もいっしょ…ありがとう…'], stubborn: ['{plays}回目か。悪くない'], easygoing: ['{plays}回目〜、もう慣れっこだね〜'] },
    mood: { great: ['{plays}回目!!最高の仲間だね!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 部屋に入ったとき、遊んだ回数に触れる
  bondJoin: {
    common: ['また呼んでくれてありがとう!', '{plays}回目の登場だよ!', 'おなじみのメンバーだね!', '今日もよろしくね!{plays}回目!'],
    trait: { jester: ['{plays}回目のご来場!盛り上げるよ!'], brave: ['{plays}回目、今日も前線は任せろ!'], clingy: ['また呼んでくれた〜!{plays}回目!うれしい〜!'], smart: ['{plays}回目の演奏準備、完了です'], serious: ['{plays}回目、本日もよろしくお願いします'], proud: ['{plays}回目の私に、期待しなさい'], worrier: ['{plays}回目なのに、まだ緊張する…'], stubborn: ['{plays}回目か。今日もやるぞ'], easygoing: ['{plays}回目〜、今日ものんびり〜'] },
    mood: { great: ['{plays}回目!!張り切っていくよ!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 朝(5〜10時)のあいさつ
  timeMorning: {
    common: ['おはよう!朝から元気にいこう!', '朝のライブ、気持ちいいね!', 'おはよう!早起きだね!', '朝イチの演奏、がんばるよ!'],
    trait: { jester: ['おはよう!朝からボケていくよ!'], brave: ['おはよう!朝から全力だ!'], clingy: ['おはよ〜!朝から会えてうれしい〜!'], smart: ['おはようございます。本日も良好です'], serious: ['おはようございます!今日もよろしく!'], proud: ['おはよう。朝から私と遊べるなんて幸運よ'], worrier: ['お、おはよう…早いね…'], stubborn: ['おはよう。朝は嫌いじゃない'], easygoing: ['おはよ〜…まだちょっとねむい〜'] },
    mood: { great: ['おはよう!!最高の朝だね!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 昼(11〜16時)のあいさつ
  timeNoon: {
    common: ['こんにちは!お昼のライブだね!', '昼間のライブ、いいね!', 'こんにちは!ひと休みに一曲どう?', '昼でも夜でも、リズムはいっしょ!'],
    trait: { jester: ['こんにちは!昼から笑いをとるぞ!'], brave: ['こんにちは!昼間も全開だ!'], clingy: ['こんにちは〜!お昼もいっしょでうれしい〜!'], smart: ['こんにちは。昼の集中力は高めです'], serious: ['こんにちは、本日もよろしくお願いします'], proud: ['こんにちは。昼の私も輝いてるわよ'], worrier: ['こ、こんにちは…昼でも緊張する…'], stubborn: ['こんにちは。昼でもやるときはやる'], easygoing: ['こんにちは〜、お昼ごはんのあとは眠いね〜'] },
    mood: { great: ['こんにちは!!元気いっぱいだよ!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 夕方〜夜(17〜21時)のあいさつ
  timeEvening: {
    common: ['こんばんは!夜のライブ、わくわく!', 'こんばんは!今日もおつかれさま!', '夜になると気分が上がるね!', 'こんばんは!ゆっくり楽しもう!'],
    trait: { jester: ['こんばんは!夜のステージは任せて!'], brave: ['こんばんは!夜の部も全力だ!'], clingy: ['こんばんは〜!夜もいっしょ〜!'], smart: ['こんばんは。夜間の演奏も安定しています'], serious: ['こんばんは、今日もおつかれさまです'], proud: ['こんばんは。夜の舞台は私の出番ね'], worrier: ['こんばんは…夜はちょっと緊張するね…'], stubborn: ['こんばんは。夜こそ本番だ'], easygoing: ['こんばんは〜、まったり遊ぼ〜'] },
    mood: { great: ['こんばんは!!夜も最高!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 深夜(22〜4時)のあいさつ
  timeNight: {
    common: ['こんな夜ふかしに、ありがとう!', '夜ふかしライブ、ひみつっぽいね!', '夜ふかしだね。ほどほどにね!', '静かな夜のライブも、いいね!'],
    trait: { jester: ['夜ふかしライブ、深夜テンションでいくよ!'], brave: ['夜ふかしか!つき合うぞ!'], clingy: ['こんな時間に呼んでくれてうれしい〜!でも寝てね〜'], smart: ['深夜帯です。睡眠も大切ですよ'], serious: ['夜遅くまでおつかれさまです。無理なさらず'], proud: ['こんな時間まで起きてるなんて、やるじゃない'], worrier: ['こんな時間…明日だいじょうぶ…?'], stubborn: ['夜ふかしか。ほどほどにな'], easygoing: ['ふぁ…もう夜おそいね〜'] },
    mood: { great: ['夜ふかしライブ!!テンション上がる!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 結果で、自分のビートLvが上がった({lv}=新しいLv)
  lvUp: {
    common: ['ビートLvが上がった!', 'レベルアップ!やったー!', 'Lv.{lv}になったよ!', '成長した気がする!Lv.{lv}!'],
    trait: { jester: ['Lv.{lv}!ボケの腕も上がったかも!'], brave: ['Lv.{lv}!強くなったぞ!'], clingy: ['Lv.{lv}になったよ〜!ほめて〜!'], smart: ['Lv.{lv}に到達しました。想定どおりです'], serious: ['Lv.{lv}になりました!努力が実りました!'], proud: ['Lv.{lv}。当然の結果ね'], worrier: ['Lv.{lv}…ほんとに?うれしい…'], stubborn: ['Lv.{lv}か。まだまだこれからだ'], easygoing: ['Lv.{lv}だって〜、やったね〜'] },
    mood: { great: ['Lv.{lv}!!最高にうれしい!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 結果で、性格が決まった({trait}=決まった性格)
  traitNew: {
    common: ['性格が決まったよ!', 'わたし、{trait}って言われた!', '{trait}…これがわたしの性格かあ', '性格が決まった!これからは{trait}でいくよ!'],
    trait: { jester: ['性格は{trait}!ウケるでしょ!'], brave: ['{trait}か!悪くない!'], clingy: ['{trait}になったよ〜!どうかな〜?'], smart: ['性格は{trait}と判定されました'], serious: ['{trait}になりました。精進します'], proud: ['{trait}…ふふ、私にぴったりね'], worrier: ['{trait}…ぼくで、いいのかな…'], stubborn: ['{trait}か。受け入れよう'], easygoing: ['{trait}らしいよ〜、のんびりいこ〜'] },
    mood: { great: ['{trait}!!わたしの性格、気に入った!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // マスモンどうしの張り合い({mate}=いっしょのマスモン)
  banterRival: {
    common: ['{mate}には負けないよ!', '{mate}、今日こそ勝負だ!', '{mate}、スコアで勝負しよう!', '{mate}、手加減はなしだよ!'],
    trait: { jester: ['{mate}、笑いも演奏も負けないよ!'], brave: ['{mate}、勝負だ!全力でこい!'], clingy: ['{mate}、負けないもん!'], smart: ['{mate}の分析、上回ってみせます'], serious: ['{mate}、正々堂々と勝負です'], proud: ['{mate}、私に勝てると思ってるの?'], worrier: ['{mate}、強そう…でも負けない…'], stubborn: ['{mate}、勝つのはこっちだ'], easygoing: ['{mate}〜、ほどほどに勝負しよ〜'] },
    mood: { great: ['{mate}!!絶対負けないからね!!'], good: [], normal: [], bad: ['…{mate}には負けない'], awful: [] },
  },
  // マスモンどうしの和やかなやりとり({mate}=いっしょのマスモン)
  banterFriend: {
    common: ['{mate}といると落ち着くな〜', '{mate}、いっしょでうれしい!', '{mate}、仲良くしようね!', '{mate}とならうまくいきそう!'],
    trait: { jester: ['{mate}、二人で笑いをとろう!'], brave: ['{mate}、いい仲間だな!'], clingy: ['{mate}〜、ずっとなかよしでいてね〜'], smart: ['{mate}との連携は良好です'], serious: ['{mate}さんとご一緒できて光栄です'], proud: ['{mate}、あなたとなら悪くないわ'], worrier: ['{mate}がいてくれて、ほっとする…'], stubborn: ['{mate}か。頼りにしてるぞ'], easygoing: ['{mate}〜、いっしょにのんびりしよ〜'] },
    mood: { great: ['{mate}!!大好き!!いっしょに叩こう!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // ほかの人の結果で、ミスが多め({who}=その人)
  hMiss: {
    common: ['{who}さん、次はきっと大丈夫!', '{who}さん、ミスは気にしない!', '{who}さん、そういう日もあるよ!', '{who}さん、ドンマイ!次いこう!'],
    trait: { jester: ['{who}さん、ミスもネタにしちゃえ!'], brave: ['{who}さん、次は取り返せる!'], clingy: ['{who}さん、元気出して〜!ぎゅー!'], smart: ['{who}さん、次は集中すれば大丈夫です'], serious: ['{who}さん、次に活かしましょう'], proud: ['{who}さん、私もたまにミスするわよ…たまにね'], worrier: ['{who}さん、ぼくもよくミスするから大丈夫…'], stubborn: ['{who}さん、次がある'], easygoing: ['{who}さん、気にしない気にしない〜'] },
    mood: { great: ['{who}さん!!次は絶対いける!!'], good: [], normal: [], bad: [], awful: [] },
  },
});

// 返事の頭に、人の名前を呼びかける言葉を付けてよい場面(ときどき。「{who}さん、」の部分は性格ごとの呼び方になる)
const RHYTHM_BUDDY_CONVO_CALLABLE = Object.freeze(['replyHello', 'replyThanks', 'replyNice', 'replyAgain', 'replyCall', 'replyDrop', 'replyWait', 'howMe', 'lvAsk',
  'favAsk', 'traitAsk', 'scoreAsk', 'daysAsk', 'nameAsk', 'cute', 'sorry', 'laugh', 'tired', 'hungry', 'sad', 'happy', 'cheer', 'fullcombo', 'missTalk',
  'hardTalk', 'easyTalk', 'bye', 'challenge', 'hey', 'songTalk', 'join', 'mvp', 'high', 'mid', 'low', 'recall', 'recallNone', 'bondHello', 'hMiss']);
// 書き換えられない1つの表にする(rhythmBuddyTalkPick が、場面の名前でここも探す)
const RHYTHM_BUDDY_CONVO_KINDS = Object.freeze(Object.keys(RHYTHM_BUDDY_CONVO_BASE));
const RHYTHM_BUDDY_CONVO = typeof rhythmBuddyTalkMerge === 'function'
  ? rhythmBuddyTalkMerge(RHYTHM_BUDDY_CONVO_BASE, {})
  : RHYTHM_BUDDY_CONVO_BASE;
