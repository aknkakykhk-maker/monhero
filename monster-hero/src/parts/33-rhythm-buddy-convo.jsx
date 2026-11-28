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
  // 2026-11-06 の10個
  fiery: { emoji: ['🔥', '💥'], ask: 0.5, starter: [2, 1, 3] }, cool: { emoji: ['😎'], ask: 0.3, starter: [1, 3, 1] },
  fickle: { emoji: ['🎲', '🌀'], ask: 0.7, starter: [2, 2, 2] }, mellow: { emoji: ['🍵', '🌸'], ask: 0.7, starter: [3, 2, 2] },
  hasty: { emoji: ['⚡', '💨'], ask: 0.4, starter: [1, 2, 3] }, competitive: { emoji: ['🔥', '😤'], ask: 0.5, starter: [1, 2, 3] },
  showoff: { emoji: ['🎉', '😎', '✌️'], ask: 0.6, starter: [2, 1, 3] }, shy: { emoji: ['😳', '💦'], ask: 0.3, starter: [3, 1, 1] },
  hardworker: { emoji: ['💪', '📖'], ask: 0.6, starter: [2, 3, 1] }, romantic: { emoji: ['🌙', '✨', '🌹'], ask: 0.6, starter: [3, 2, 1] },
});
// 2体の相性(マスモンどうしのやりとりの種類)。ライバル同士は張り合い、仲良し寄りの子とは和やかに話す
const RHYTHM_BUDDY_PAIR_RIVALS = Object.freeze(['brave|proud', 'proud|smart', 'brave|stubborn', 'proud|stubborn', 'jester|serious', 'smart|stubborn',
  // 2026-11-06 の10個
  'competitive|fiery', 'brave|competitive', 'competitive|proud', 'cool|fiery', 'hasty|mellow', 'cool|showoff']);
const rhythmBuddyPairKind = (a, b) => {
  const key = [a, b].sort().join('|');
  if (RHYTHM_BUDDY_PAIR_RIVALS.indexOf(key) >= 0) return 'banterRival';
  if (a === 'clingy' || b === 'clingy' || a === 'easygoing' || b === 'easygoing' || a === 'mellow' || b === 'mellow' || key === 'jester|worrier' || key === 'jester|showoff') return 'banterFriend';
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
      easygoing: ['{mood}〜、のんびり〜', 'ぼちぼちだよ〜'], fiery: ['{mood}!でも燃えてるぞ!', 'いつでも熱いぞ!'], cool: ['{mood}。問題ない', '…いつもどおりだよ'], fickle: ['{mood}…いや、どうかな', '今日の気分は{mood}かも'], mellow: ['{mood}ですよ、ふふ', 'おかげさまで、元気です'], hasty: ['{mood}!はやく遊ぼ!', '元気!だから次!'], competitive: ['{mood}!勝てる気がする!', '今日は負ける気がしない!'], showoff: ['天才的に{mood}〜!', '調子の波、いま上のほう〜!'], shy: ['…{mood}、だよ', '…うん、まあまあ'], hardworker: ['{mood}!今日も練習する!', '毎日続けてるから元気!'], romantic: ['{mood}…素敵な一日だから', '月がきれいで、心も軽いよ'],
    },
    mood: { great: ['最高にいい!!{who}さんは?'], good: ['いい感じ!'], normal: ['ふつうだよ'], bad: ['ちょっと不機嫌…'], awful: ['…聞かないで'] },
  },
  // 聞き返し(「{who}さんは調子どう?」)
  qHow: {
    common: ['{who}さんは調子どう?', '{who}さんは元気?', 'そっちはどう?{who}さん', '{who}さんは今日どんな感じ?'],
    trait: {
      jester: ['{who}さんの笑いのキレは?'], brave: ['{who}さんは戦えそう?'], clingy: ['{who}さんは?元気?ねぇねぇ'], smart: ['{who}さんの状態はいかがですか'],
      serious: ['{who}さんのご体調は?'], proud: ['{who}さんは?まあ聞いてあげる'], worrier: ['{who}さんは大丈夫…?'], stubborn: ['{who}さんはどうだ'],
      easygoing: ['{who}さんは〜?ねむくない〜?'], fiery: ['{who}さんは燃えてるか?'], cool: ['{who}さんも、問題ない?'], fickle: ['{who}さんは今日どんな気分?'], mellow: ['{who}さんは、お元気ですか?'], hasty: ['{who}さんは?はやく教えて!'], competitive: ['{who}さんは?負けてないか?'], showoff: ['{who}さんもノッてる〜?'], shy: ['…{who}さんは…?'], hardworker: ['{who}さんは?練習してる?'], romantic: ['{who}さんの心は、晴れてる?'],
    },
    mood: { great: ['{who}さんも元気?!'], good: ['{who}さんは?'], normal: [], bad: ['{who}さんは…元気?'], awful: [] },
  },
  // 聞き返しへの答え(いい)
  howGood: {
    common: ['よかった!ならいい感じだね!', 'いいね!いっしょにがんばろ!', '元気ならなにより!', 'うれしい!楽しもうね!'],
    trait: {
      jester: ['よし、じゃあ盛り上がろう!'], brave: ['いい!燃えてきた!'], clingy: ['うれしい〜!ぼくも元気になった!'], smart: ['良好ですね。何よりです'],
      serious: ['それは何よりです!'], proud: ['当然ね。私もよ'], worrier: ['よかった…ほっとした…'], stubborn: ['うむ、その調子だ'], easygoing: ['いいね〜、のんびりいこ〜'], fiery: ['よし!いっしょに燃えるぞ!'], cool: ['そう。よかった'], fickle: ['いいね、こっちも気分上がったかも'], mellow: ['あら、よかったですね'], hasty: ['よし!じゃあすぐ始めよ!'], competitive: ['よし、じゃあ勝負だ!'], showoff: ['いいね〜!いっしょにノろ〜!'], shy: ['…よかった'], hardworker: ['よし!いっしょにがんばろう!'], romantic: ['素敵、心が通じあったね'],
    },
    mood: { great: ['最高だね!!'], good: ['いいね!'], normal: ['それはよかった'], bad: ['…そっか、いいな'], awful: ['…よかったね'] },
  },
  // 聞き返しへの答え(わるい)
  howBad: {
    common: ['そっか…無理しないでね', 'だいじょうぶ?ゆっくりでいいよ', '調子わるいときもあるよね', '無理せず楽しもう!'],
    trait: {
      jester: ['元気出るネタ、あとで披露する!'], brave: ['気合で乗りきるぞ!ついてこい!'], clingy: ['ぎゅってしてあげたい…だいじょうぶ?'], smart: ['休養も大切です。無理は禁物です'],
      serious: ['お大事になさってください'], proud: ['しかたないわね、今日は私が引っぱるわ'], worrier: ['えっ、大丈夫…?心配…'], stubborn: ['休むのも勝負のうちだ'], easygoing: ['いっしょにのんびりしよ〜'], fiery: ['今日の分も、こっちが燃える!'], cool: ['無理しないで。合わせるよ'], fickle: ['そういう気分の日もあるよね'], mellow: ['あらあら、ゆっくり休んでくださいね'], hasty: ['じゃあサクッと短い曲にしよ!'], competitive: ['なら今日はかわりに勝ってくる!'], showoff: ['じゃ、元気わけてあげる〜!'], shy: ['…そ、そっか。むり、しないで'], hardworker: ['休むのも練習のうちだよ!'], romantic: ['月の光で、ゆっくり休んでね'],
    },
    mood: { great: ['ぼくが元気を分けてあげる!!'], good: ['ぼくが応援するよ!'], normal: ['のんびりいこう'], bad: ['…ぼくもだよ'], awful: ['…わかる'] },
  },
  // 「レベルいくつ?」
  lvAsk: {
    common: ['ビートLvは{lv}だよ!', 'いま{lv}!もっと上げたいな', 'Lv.{lv}だよ。{who}さんのおかげ!', 'ビートLv{lv}!まだまだ育つよ', 'まだ育ってる途中!'],
    trait: {
      jester: ['Lv.{lv}!ネタのレベルは別だけどね'], brave: ['Lv.{lv}!もっと強くなる!'], clingy: ['Lv.{lv}だよ〜、ほめて〜'], smart: ['現在ビートLv{lv}です'],
      serious: ['ビートLv{lv}です。精進します'], proud: ['Lv.{lv}。まだ序の口よ'], worrier: ['Lv.{lv}…低くないかな…'], stubborn: ['Lv.{lv}。満足はしとらん'], easygoing: ['Lv.{lv}〜、のんびり上げてる〜'], fiery: ['Lv.{lv}!まだまだ上がるぞ!'], cool: ['Lv.{lv}。悪くない'], fickle: ['Lv.{lv}…だったかな、たぶん'], mellow: ['Lv.{lv}になりました、ふふ'], hasty: ['Lv.{lv}!もっとはやく上げたい!'], competitive: ['Lv.{lv}!まだまだ上げるぞ!'], showoff: ['Lv.{lv}!けっこうすごくない〜?'], shy: ['…Lv.{lv}、だよ'], hardworker: ['Lv.{lv}!コツコツ上げてる!'], romantic: ['Lv.{lv}。星をひとつずつ集めてる'],
    },
    mood: { great: ['Lv.{lv}!!まだ伸びる!!'], good: ['Lv.{lv}!いい感じ'], normal: [], bad: ['Lv.{lv}…それがなに'], awful: [] },
  },
  // 「得意な曲は?」
  favAsk: {
    common: ['{fav}が得意!', '得意なのは{fav}かな', '{fav}はいっぱい遊んだよ!', 'まだ得意な曲はないかも', 'いろんな曲を遊びたいな!'],
    trait: {
      jester: ['{fav}で笑いを取れるよ!'], brave: ['{fav}なら負けない!'], clingy: ['{fav}がすき〜、いっしょにやろ?'], smart: ['統計では{fav}が最良です'],
      serious: ['{fav}を練習しています'], proud: ['{fav}は完璧よ'], worrier: ['{fav}ならなんとか…'], stubborn: ['{fav}以外は認めん'], easygoing: ['{fav}がおちつく〜'], fiery: ['{fav}なら一番燃える!'], cool: ['{fav}なら問題ない'], fickle: ['{fav}が好き…今日はね'], mellow: ['{fav}が、落ち着きますね'], hasty: ['{fav}がいい!サクッといける!'], competitive: ['{fav}なら誰にも負けたくない!'], showoff: ['{fav}なら天才だよ〜!'], shy: ['…{fav}、好き'], hardworker: ['{fav}、たくさん練習した!'], romantic: ['{fav}は夢みたいに素敵なの'],
    },
    mood: { great: ['{fav}!!なんど叩いても楽しい!!'], good: ['{fav}がいい感じ!'], normal: [], bad: ['{fav}ならできる…'], awful: [] },
  },
  // 聞き返し(「好きな曲は?」)
  qFav: {
    common: ['{who}さんの好きな曲は?', '{who}さんの得意な曲、教えて!', '{who}さんはどの曲が好き?', '{who}さんのおすすめは?'],
    trait: {
      jester: ['{who}さんの十八番は?'], brave: ['{who}さんの勝負曲は?'], clingy: ['{who}さんの好きな曲、知りたいな〜'], smart: ['{who}さんの得意曲を伺っても?'],
      serious: ['{who}さんの得意な曲は?'], proud: ['{who}さんの自慢の曲は?'], worrier: ['{who}さんの得意な曲…あるかな?'], stubborn: ['{who}さんの曲選びの基準は?'], easygoing: ['{who}さんは何がすき〜?'], fiery: ['{who}さんの一番燃える曲は?'], cool: ['{who}さんは、何が得意?'], fickle: ['{who}さんの好きな曲、今日はどれ?'], mellow: ['{who}さんのお好きな曲は?'], hasty: ['{who}さんの好きな曲!はやく!'], competitive: ['{who}さんの得意曲は?勝負しよう!'], showoff: ['{who}さんのノれる曲は〜?'], shy: ['…{who}さんは、どの曲が好き…?'], hardworker: ['{who}さんの得意曲、教えて!'], romantic: ['{who}さんの好きな旋律は?'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 曲の話(人が曲名を出した)
  songTalk: {
    common: ['{song}、いい曲だよね!', '{song}か〜!叩きたくなる!', '{song}、好きだな〜', '{song}はいつ叩いてもたのしい!', 'その曲、いいよね!'],
    trait: {
      jester: ['{song}で盛り上がろう!'], brave: ['{song}なら受けて立つ!'], clingy: ['{song}、いっしょにやりたい〜'], smart: ['{song}は構成が好きです'],
      serious: ['{song}は練習しがいがあります'], proud: ['{song}は得意よ。見てなさい'], worrier: ['{song}…むずかしいけど、がんばる…'], stubborn: ['{song}は譲れん曲だ'], easygoing: ['{song}、のんびり聴きたい〜'], fiery: ['{song}なら全力でいける!'], cool: ['{song}は落ち着いて叩ける'], fickle: ['{song}、今日はいい気分かも'], mellow: ['{song}、すてきな曲ですね'], hasty: ['{song}!すぐやろ!'], competitive: ['{song}、次こそ勝ちたい!'], showoff: ['{song}、ノリノリになれる〜!'], shy: ['…{song}、好きなんだ'], hardworker: ['{song}、できるまでやりたい!'], romantic: ['{song}…なんて素敵な旋律'],
    },
    mood: { great: ['{song}!!最高!!'], good: ['{song}いいね!'], normal: [], bad: ['{song}…まあ、いいけど'], awful: [] },
  },
  // 「どんな性格?」
  traitAsk: {
    common: ['性格は{trait}って言われるよ!', '{trait}かな!', 'まだ性格は決まってないんだ', 'ぼくの性格?これから決まるよ!', 'いっしょに遊ぶと決まるんだって'],
    trait: {
      jester: ['{trait}!見てのとおり!'], brave: ['{trait}だ!'], clingy: ['{trait}って言われる〜'], smart: ['{trait}と分析されました'],
      serious: ['{trait}だと思います'], proud: ['{trait}よ。当然でしょ'], worrier: ['{trait}…直したいな…'], stubborn: ['{trait}で何が悪い'], easygoing: ['{trait}〜'], fiery: ['{trait}だ!燃えてるぞ!'], cool: ['{trait}。それだけ'], fickle: ['{trait}…らしいよ、たぶん'], mellow: ['{trait}ですって、ふふ'], hasty: ['{trait}!はい次!'], competitive: ['{trait}!だから負けたくない!'], showoff: ['{trait}〜!ぴったりでしょ〜?'], shy: ['…{trait}、みたい'], hardworker: ['{trait}!練習大好き!'], romantic: ['{trait}。夢見がちなの'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「何点だった?」
  scoreAsk: {
    common: ['さっきは{score}だったよ!', '{score}!もっと上げたい', '{score}くらいかな', 'まだスコアは出してないよ', 'つぎのライブで見せるね!'],
    trait: {
      jester: ['{score}!ウケたでしょ!'], brave: ['{score}!次はもっと上だ!'], clingy: ['{score}だよ〜、ほめて〜'], smart: ['直近は{score}です'],
      serious: ['{score}でした。精進します'], proud: ['{score}。まあまあね'], worrier: ['{score}…低かったかな…'], stubborn: ['{score}。納得はしとらん'], easygoing: ['{score}くらい〜'], fiery: ['{score}!まだまだ上げる!'], cool: ['{score}。想定内'], fickle: ['{score}…だった気がする'], mellow: ['{score}でしたよ、ふふ'], hasty: ['{score}!次はもっとはやく上げる!'], competitive: ['{score}…次はもっと上!'], showoff: ['{score}!なかなかでしょ〜?'], shy: ['…{score}、だった'], hardworker: ['{score}!まだ伸ばせる!'], romantic: ['{score}…夢の途中だよ'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「毎日来てるね」「何回目?」
  daysAsk: {
    common: ['{days}日続けて呼ばれてるよ!', '{plays}回いっしょに遊んだよ!', 'いつも呼んでくれてありがとう!', 'まだ呼ばれはじめだよ!', 'また来るね!'],
    trait: {
      jester: ['{plays}回も!皆勤賞ほしい!'], brave: ['{plays}戦してきた!'], clingy: ['{days}日もそばにいる〜うれしい!'], smart: ['{plays}回の記録があります'],
      serious: ['{plays}回お世話になりました'], proud: ['{plays}回も私を選ぶなんて当然ね'], worrier: ['{plays}回…ご迷惑じゃない…?'], stubborn: ['{plays}回。まだ足りん'], easygoing: ['{plays}回〜、ゆるっとね〜'], fiery: ['{plays}回!全部全力だった!'], cool: ['{plays}回。まだ続ける'], fickle: ['{plays}回?数えてなかったかも'], mellow: ['{plays}回も、ありがたいですね'], hasty: ['{plays}回!もっといける!'], competitive: ['{plays}回!勝ち越したい!'], showoff: ['{plays}回も呼ばれちゃった〜!'], shy: ['…{plays}回、だよ。うれしい'], hardworker: ['{plays}回!積み重ねてきた!'], romantic: ['{plays}回の、素敵な思い出'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「名前は?」
  nameAsk: {
    common: ['{me}だよ!', '{me}っていうんだ!', '{me}です、よろしくね!', 'ぼくは{me}!', '{me}!おぼえてね!'],
    trait: {
      jester: ['{me}!覚えてね、テストに出るよ!'], brave: ['{me}だ!おぼえとけ!'], clingy: ['{me}だよ〜、呼んで呼んで!'], smart: ['{me}と申します'],
      serious: ['{me}と申します。よろしくお願いします'], proud: ['{me}よ。覚えておきなさい'], worrier: ['{me}…だよ。おぼえにくい…?'], stubborn: ['{me}だ。二度は言わん'], easygoing: ['{me}〜、よろしく〜'], fiery: ['{me}だ!熱いのが取りえ!'], cool: ['{me}。よろしく'], fickle: ['{me}だよ。今日の気分は上々'], mellow: ['{me}です。よろしくお願いしますね'], hasty: ['{me}!はい、覚えた?次!'], competitive: ['{me}だ!覚えとけよ!'], showoff: ['{me}だよ〜!覚えてね〜!'], shy: ['…{me}、です'], hardworker: ['{me}!練習大好き、よろしく!'], romantic: ['{me}。星の名前みたいでしょ'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 「かわいい」「かっこいい」「好き」
  cute: {
    common: ['えへへ、ありがとう!', 'うれしい!', 'そう言われると照れる!', 'ほんと?うれしいな!', '{who}さんも、すてきだよ!'],
    trait: {
      jester: ['もっと言って!ネタにする!'], brave: ['ふっ、当然だ!'], clingy: ['うれしい〜!もっとなでて〜!'], smart: ['光栄です。顔が赤くなりました'],
      serious: ['もったいないお言葉です…'], proud: ['当たり前よ。でも、ありがと'], worrier: ['えっ、ほんとに…?うれしい…'], stubborn: ['おだてても何も出んぞ…'], easygoing: ['えへへ〜、ありがと〜'], fiery: ['へへっ、もっと燃えてきた!'], cool: ['…悪い気はしないね'], fickle: ['ほんと?今日の気分、最高かも'], mellow: ['まあ、うれしいです'], hasty: ['ありがと!さ、次!'], competitive: ['へへ…てれるな、でも負けないぞ'], showoff: ['でしょでしょ〜!わかってる〜!'], shy: ['…か、顔が熱い'], hardworker: ['ありがとう!練習のはげみになる!'], romantic: ['心に花が咲いたよ'],
    },
    mood: { great: ['やったー!!うれしすぎる!!'], good: ['えへへ!'], normal: [], bad: ['…ふん、ありがと'], awful: ['…別に'] },
  },
  // 「ごめん」
  sorry: {
    common: ['だいじょうぶだよ!', 'きにしないで!', 'へいき!つぎがあるよ!', 'いいよいいよ!'],
    trait: {
      jester: ['許す!かわりに笑って!'], brave: ['気にするな!'], clingy: ['いいよ〜、なでてくれたら許す!'], smart: ['問題ありません。お気になさらず'],
      serious: ['お気になさらないでください'], proud: ['今回は特別に許すわ'], worrier: ['だ、だいじょうぶ…ぼくこそごめん…'], stubborn: ['謝るな。次で取り返せ'], easygoing: ['いいよ〜、きにしない〜'], fiery: ['いいって!燃えていこう!'], cool: ['大丈夫。気にしてない'], fickle: ['もう忘れちゃったかも'], mellow: ['ふふ、もう大丈夫ですよ'], hasty: ['いいよ!それより次!'], competitive: ['いいよ!次の勝負で返して!'], showoff: ['いいってことよ〜!'], shy: ['…う、ううん、平気'], hardworker: ['いいよ!気にしないで!'], romantic: ['気にしないで。月もときどき欠けるもの'],
    },
    mood: { great: ['ぜんぜんOK!!'], good: ['いいよ!'], normal: [], bad: ['…まあ、いいけど'], awful: ['…べつに'] },
  },
  // 笑い(w / 草)
  laugh: {
    common: ['あはは!', 'ふふっ、おもしろい!', 'わらっちゃった!', 'たのしいね!', 'ぼくもわらった!'],
    trait: {
      jester: ['でしょ?ウケると思った!'], brave: ['はっはっは!'], clingy: ['いっしょに笑えてうれしい〜'], smart: ['ふふ、愉快ですね'],
      serious: ['ふふ、失礼しました'], proud: ['ふふっ、悪くないわね'], worrier: ['わ、笑うところだったかな…?'], stubborn: ['ふっ…悪くない'], easygoing: ['ふふふ〜'], fiery: ['わっはっは!燃えるな!'], cool: ['…今のは、少し笑えた'], fickle: ['なんか笑えてきたかも'], mellow: ['ふふふ、おかしいですね'], hasty: ['あはは!で、次は?'], competitive: ['へへ、勝った気分!'], showoff: ['でしょ?センスあるでしょ〜?'], shy: ['…えへ'], hardworker: ['あはは!楽しいね!'], romantic: ['ふふ、素敵な笑顔'],
    },
    mood: { great: ['あははは!!最高!!'], good: ['あはは、おかしい!'], normal: [], bad: ['…ふふ'], awful: ['…ふっ'] },
  },
  // 疲れた・眠い
  tired: {
    common: ['おつかれさま!', 'ゆっくり休んでね', '無理しないでね', '少し休んでもいいよ', 'ねむいよね…'],
    trait: {
      jester: ['寝ながら叩いたらウケるよ!'], brave: ['根性で…いや、休め!'], clingy: ['そばにいるから休んでね〜'], smart: ['適度な休憩を推奨します'],
      serious: ['無理は禁物です'], proud: ['休むのも仕事のうちよ'], worrier: ['だ、大丈夫…?休んで…'], stubborn: ['休むのも勝負だ'], easygoing: ['いっしょに寝ようか〜'], fiery: ['休め!明日また燃えよう!'], cool: ['休んだほうがいい'], fickle: ['寝ちゃうのも、ありかも'], mellow: ['あらあら、少し休みましょうか'], hasty: ['じゃあ寝よ!すぐ寝よ!'], competitive: ['休んで、また勝負しよう!'], showoff: ['おやすみ〜!起きたらまたノろ〜!'], shy: ['…うん、休んでね'], hardworker: ['しっかり休むのも大事!'], romantic: ['星を見ながら、休もう'],
    },
    mood: { great: [], good: [], normal: [], bad: ['ぼくもねむい…'], awful: ['…ぼくも'] },
  },
  // おなか・ごはん
  hungry: {
    common: ['おなかすいたね!', 'ごはん、何たべる?', 'おやつたべたいな!', 'あまいものがいいな!', 'おなかすくよね〜'],
    trait: {
      jester: ['おなかが鳴ったらハモろう!'], brave: ['肉だ!肉を食うぞ!'], clingy: ['いっしょに食べたい〜'], smart: ['糖分補給は有効です'],
      serious: ['食事は大切ですね'], proud: ['私はデザートがいいわ'], worrier: ['食べすぎないようにね…'], stubborn: ['腹がへっては戦はできん'], easygoing: ['おやつタイムにしよ〜'], fiery: ['食べて力をつけるぞ!'], cool: ['何か食べてきなよ'], fickle: ['おやつの気分かも'], mellow: ['おやつにしましょうか'], hasty: ['はやく食べてこよ!'], competitive: ['早食いなら負けない!'], showoff: ['おやつ食べたらもっとノれる〜!'], shy: ['…おやつ、いっしょに…?'], hardworker: ['食べて、練習のつづき!'], romantic: ['月みたいなパンケーキがいいな'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // つらい・かなしい
  sad: {
    common: ['だいじょうぶ?そばにいるよ', 'つらいときは休んでいいよ', 'ぼくがついてるよ', 'はなしてくれてありがとう', 'きっとよくなるよ'],
    trait: {
      jester: ['元気出して。変な顔するから!'], brave: ['ついてこい!いっしょに立ちあがろう!'], clingy: ['ぎゅってするね…ぎゅっ'], smart: ['お話を伺います。無理せずどうぞ'],
      serious: ['お力になれれば幸いです'], proud: ['私がついてるのよ。大丈夫'], worrier: ['わ、わたしまで悲しくなる…'], stubborn: ['乗りこえられる。俺が保証する'], easygoing: ['ゆっくりいこ〜、ここにいるよ〜'], fiery: ['元気を分けるぞ!全力で!'], cool: ['…話、聞くよ'], fickle: ['気分は変わるものだよ'], mellow: ['大丈夫ですよ、ここにいますからね'], hasty: ['いっしょに一曲やろ!すぐ!'], competitive: ['悔しいなら、いっしょに巻き返そう!'], showoff: ['元気出して〜!ノリでなんとかなる〜!'], shy: ['…そばに、いるね'], hardworker: ['話してくれたら、力になる!'], romantic: ['夜が明けるまで、そばにいるよ'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // うれしい・楽しい・最高
  happy: {
    common: ['よかったね!', 'うれしいね!', 'いえーい!', 'たのしいね!', 'ぼくもうれしい!'],
    trait: {
      jester: ['祝いのダンス、いくよ!'], brave: ['勝利のたけびだ!うおー!'], clingy: ['いっしょでうれしい〜!'], smart: ['良い結果ですね'],
      serious: ['それは何よりです'], proud: ['当然の結果ね'], worrier: ['ほんとに?うれしい…!'], stubborn: ['うむ、よくやった'], easygoing: ['よかったね〜'], fiery: ['やったな!こっちまで燃える!'], cool: ['よかったね'], fickle: ['なんかうれしくなっちゃった'], mellow: ['まあ、よかったですね'], hasty: ['やった!じゃあ次!'], competitive: ['やったな!負けてられない!'], showoff: ['いいね〜!こっちまでノッてきた〜!'], shy: ['…よかったね。うれしい'], hardworker: ['やったね!がんばったかいがあった!'], romantic: ['素敵!星もお祝いしてるよ'],
    },
    mood: { great: ['最高だー!!'], good: ['やったね!'], normal: [], bad: ['…まあ、よかったね'], awful: ['…おめでとう'] },
  },
  // 励まし・気合
  cheer: {
    common: ['がんばろう!', 'おー!いこう!', 'いっしょにがんばる!', 'まかせて!', 'やるぞー!'],
    trait: {
      jester: ['気合いのモノマネ、いくよ!'], brave: ['うおー!突撃だ!'], clingy: ['うん!いっしょにやる〜!'], smart: ['承知しました。全力でいきます'],
      serious: ['全力を尽くします!'], proud: ['私に任せなさい'], worrier: ['が、がんばる…!'], stubborn: ['言われなくてもやる'], easygoing: ['おー、がんばる〜'], fiery: ['全力でいくぞー!'], cool: ['了解。いこう'], fickle: ['うん、気分がのってきた'], mellow: ['ええ、がんばりましょうね'], hasty: ['いく!今すぐ!'], competitive: ['おう!絶対勝つ!'], showoff: ['まかせて〜!天才におまかせ〜!'], shy: ['…うん、がんばる'], hardworker: ['おう!練習の成果、見せる!'], romantic: ['うん、夢をかなえにいこう'],
    },
    mood: { great: ['燃えてきたー!!'], good: ['よし、いける!'], normal: [], bad: ['…やるだけやるよ'], awful: ['…がんばる、たぶん'] },
  },
  // フルコン・満点
  fullcombo: {
    common: ['すごい!フルコン!', 'パーフェクトってすごいね!', 'ぼくもねらいたい!', 'かっこいい!', 'いつかぼくも!'],
    trait: {
      jester: ['拍手喝采だ!ぱちぱち!'], brave: ['次は俺も取る!'], clingy: ['すごいすごい〜!かっこいい〜!'], smart: ['極めて高い精度ですね'],
      serious: ['見習いたいです'], proud: ['私も取れるけど、今日は譲るわ'], worrier: ['わ、わたしにはむりだ…すごい…'], stubborn: ['次は俺が取る'], easygoing: ['わ〜すごい〜'], fiery: ['すごい!こっちも燃えてきた!'], cool: ['見事だね'], fickle: ['すごい。今日はその人の日かも'], mellow: ['まあ、おじょうずですね'], hasty: ['すごい!はやく次で取りたい!'], competitive: ['くっ…次は負けない!'], showoff: ['やるね〜!でも次はこっちの番〜!'], shy: ['…す、すごい'], hardworker: ['すごい!見習って練習する!'], romantic: ['なんて素敵な演奏…'],
    },
    mood: { great: ['最高だー!!天才!!'], good: ['すごい!'], normal: [], bad: ['…やるじゃん'], awful: ['…まあ、すごい'] },
  },
  // ミス・失敗
  missTalk: {
    common: ['ドンマイ!', 'だいじょうぶ!つぎがあるよ', 'ミスしても楽しもう!', 'わたしもよくミスるよ', 'きにしない!'],
    trait: {
      jester: ['ミスも芸のうち!'], brave: ['倒れてもまた立つ!'], clingy: ['なでなでしてあげる〜'], smart: ['失敗は学びの種です'],
      serious: ['次に生かしましょう'], proud: ['私でも、たまにはあるわ'], worrier: ['わかる…ぼくも怖い…'], stubborn: ['次で取り返せ!'], easygoing: ['まあまあ〜、きにしない〜'], fiery: ['まだまだ!次は燃えていけ!'], cool: ['気にしない。次がある'], fickle: ['気分、切りかえよっか'], mellow: ['あらあら、大丈夫ですよ'], hasty: ['切りかえ!次!'], competitive: ['ミスしても、取り返せばいい!'], showoff: ['だいじょぶ!ノリでいける〜!'], shy: ['…わかる。見られると、かたくなる'], hardworker: ['練習すれば、こわくなくなる!'], romantic: ['間違えた音も、旋律の一部だよ'],
    },
    mood: { great: ['つぎがんばろ!!'], good: ['ドンマイドンマイ!'], normal: [], bad: ['…あるよね'], awful: ['…ぼくもだよ'] },
  },
  // 難しい・きつい
  hardTalk: {
    common: ['むずかしいよね!', 'わかる、きついよね', 'ゆっくり練習しよう!', 'むずかしいほど楽しい!', 'ぼくもむずかしい…'],
    trait: {
      jester: ['むずかしさも味ってことで!'], brave: ['むずかしいほど燃える!'], clingy: ['いっしょにがんばろ〜'], smart: ['難所を分解して練習しましょう'],
      serious: ['地道に練習あるのみです'], proud: ['私は平気だけど?'], worrier: ['わたしも不安…'], stubborn: ['やればできる!あきらめるな!'], easygoing: ['ゆっくり慣れよ〜'], fiery: ['何度でも叩いて燃えよう!'], cool: ['落ち着いて見れば平気'], fickle: ['今日はむずかしい気分の日かも'], mellow: ['ゆっくり慣れていきましょうね'], hasty: ['サクッと何回もやろ!'], competitive: ['難しいなら、なおさら負けない!'], showoff: ['天才なら、なんとかなる〜!'], shy: ['…うん、むずかしいね'], hardworker: ['できるまで練習あるのみ!'], romantic: ['難しい旋律ほど、美しいんだ'],
    },
    mood: { great: ['がんばれば、いける!!'], good: ['やればできるよ!'], normal: [], bad: ['…ぼくも無理かも'], awful: ['…やだな'] },
  },
  // 簡単・楽勝
  easyTalk: {
    common: ['よゆうだね!', 'すごい自信!', 'いいね、そのいきおい!', 'ぼくも負けない!', '次は難しい曲もやろう!'],
    trait: {
      jester: ['よゆうなら笑いも取れるね!'], brave: ['ならもっと上の難易度に挑め!'], clingy: ['すごーい!ほめて〜'], smart: ['余裕があるなら上を目指しましょう'],
      serious: ['油断は禁物です'], proud: ['ふふ、私もよ'], worrier: ['すごい…うらやましい…'], stubborn: ['ならばもう一段上へだ'], easygoing: ['よゆうだね〜'], fiery: ['なら次は全力で上へ!'], cool: ['なら上の難易度だね'], fickle: ['よゆうの日もあるよね'], mellow: ['あら、たのもしいですね'], hasty: ['じゃあ次!もっと上!'], competitive: ['なら、もっと上で勝負だ!'], showoff: ['さっすが〜!こっちもノッてく〜!'], shy: ['…すごいね'], hardworker: ['なら一つ上の難易度で練習だ!'], romantic: ['軽やかで、素敵だね'],
    },
    mood: { great: ['ぼくも余裕!!'], good: ['いいね!'], normal: [], bad: ['…そうなんだ'], awful: ['…ふーん'] },
  },
  // お別れ
  bye: {
    common: ['またね!', 'ばいばい!', 'おつかれさま!', 'またいっしょに遊ぼうね!', '楽しかった!ありがとう!'],
    trait: {
      jester: ['それではまたの機会に〜!'], brave: ['また戦おう!'], clingy: ['もう行っちゃうの…?またね…!'], smart: ['お疲れさまでした。またお会いしましょう'],
      serious: ['お疲れさまでした!'], proud: ['また呼びなさい。待ってるわ'], worrier: ['き、気をつけてね…'], stubborn: ['また勝負だ'], easygoing: ['ばいばい〜、またね〜'], fiery: ['またな!次も燃えるぞ!'], cool: ['またね'], fickle: ['またね。気が向いたら'], mellow: ['お気をつけて、またね'], hasty: ['またね!すぐね!'], competitive: ['またな!次は負けないぞ!'], showoff: ['ばいば〜い!また呼んでね〜!'], shy: ['…ば、ばいばい'], hardworker: ['またね!練習しておく!'], romantic: ['またね。いい夢を'],
    },
    mood: { great: ['またすぐ遊ぼうね!!'], good: ['またねー!'], normal: [], bad: ['…じゃあね'], awful: ['…ばいばい'] },
  },
  // 勝負・対決
  challenge: {
    common: ['いいよ、勝負しよう!', '負けないよ!', 'のぞむところ!', 'よーし、本気だす!', 'たのしみ!'],
    trait: {
      jester: ['笑った方が勝ちね!'], brave: ['望むところだ!かかってこい!'], clingy: ['勝ったらほめてね〜'], smart: ['勝率を計算しておきます'],
      serious: ['正々堂々と勝負です!'], proud: ['私に勝てると思って?'], worrier: ['か、勝てるかな…'], stubborn: ['引く気はない。やるぞ'], easygoing: ['のんびり勝負しよ〜'], fiery: ['おう!全力でやるぞ!'], cool: ['いいよ。落ち着いてやる'], fickle: ['勝負?今日はのった'], mellow: ['ふふ、お手やわらかに'], hasty: ['やる!はやく始めよ!'], competitive: ['望むところだ!今度こそ勝つ!'], showoff: ['いいよ〜!天才に勝てるかな〜?'], shy: ['…う、うん。やってみる'], hardworker: ['いいよ!勝負も練習になる!'], romantic: ['素敵な勝負にしよう'],
    },
    mood: { great: ['やるぞ!!ぜったい勝つ!!'], good: ['よし、やろう!'], normal: [], bad: ['…手加減してね'], awful: ['…やだ'] },
  },
  // 名前を呼ばれただけ
  hey: {
    common: ['なあに?', 'よんだ?', 'はーい!', 'ここにいるよ!', 'どうしたの?'],
    trait: {
      jester: ['お呼びとあらば!なあに?'], brave: ['どうした!'], clingy: ['よんでくれた〜!なあに?'], smart: ['はい、なんでしょう'],
      serious: ['はい、何でしょうか'], proud: ['なにか用?'], worrier: ['な、なにかあった…?'], stubborn: ['なんだ'], easygoing: ['ふぁい〜?'], fiery: ['おう!どうした!'], cool: ['…なに?'], fickle: ['ん?呼んだ?'], mellow: ['はあい、どうしました?'], hasty: ['なに?はやく!'], competitive: ['ん?勝負か?'], showoff: ['な〜に〜?'], shy: ['…な、なに?'], hardworker: ['はい!なに?'], romantic: ['あら、呼ばれた気がしたの'],
    },
    mood: { great: ['なんでも聞いて!!'], good: ['はーい、なあに〜?'], normal: [], bad: ['…なに'], awful: ['…なんだよ'] },
  },
  // 聞かれたけれど、答えが見つからない
  dunno: {
    common: ['うーん、わかんないや', 'どうだろう?', 'それはひみつ!', 'うまく答えられないや', 'また今度おしえて!'],
    trait: {
      jester: ['それは次回のネタにしよう!'], brave: ['わからんが、なんとかなる!'], clingy: ['わかんないけど、聞いてくれてうれしい!'], smart: ['情報が足りません。詳しく教えてください'],
      serious: ['申し訳ありません、わかりません'], proud: ['私にもわからないことくらいあるわ'], worrier: ['ご、ごめん、わからない…'], stubborn: ['答えは自分で見つけろ'], easygoing: ['う〜ん、わかんな〜い'], fiery: ['わからん!でも全力だ!'], cool: ['…わからない'], fickle: ['うーん、気分で答えちゃおうかな'], mellow: ['あら、わかりませんね'], hasty: ['わかんない!次の話!'], competitive: ['くっ…わからない、悔しい!'], showoff: ['それ、むずかしすぎ〜!'], shy: ['…えっと…わからない'], hardworker: ['わからない!あとで勉強する!'], romantic: ['謎めいていて、素敵だね'],
    },
    mood: { great: ['でも楽しいね!!'], good: ['むずかしい質問だね'], normal: [], bad: ['…しらない'], awful: ['…知らん'] },
  },
  // マスモンどうしのやりとり({mate}=いっしょのマスモン)
  banter: {
    common: ['{mate}、いいね!', '{mate}、いっしょにがんばろ!', '{mate}は頼りになるなあ', '{mate}、次もよろしく!', '{mate}といると楽しい!'],
    trait: {
      jester: ['{mate}、ボケ担当はぼくね!'], brave: ['{mate}、背中は任せた!'], clingy: ['{mate}、なかよくしてね〜'], smart: ['{mate}の分析、勉強になります'],
      serious: ['{mate}さん、よろしくお願いします'], proud: ['{mate}、私についてきなさい'], worrier: ['{mate}、足を引っぱったらごめん…'], stubborn: ['{mate}、負けんぞ'], easygoing: ['{mate}〜、のんびりいこ〜'], fiery: ['{mate}、いっしょに燃えるぞ!'], cool: ['{mate}、よろしく'], fickle: ['{mate}、今日は気が合いそう'], mellow: ['{mate}さん、仲良くしましょうね'], hasty: ['{mate}、はやく始めよ!'], competitive: ['{mate}、負けないからな!'], showoff: ['{mate}、いっしょにノろ〜!'], shy: ['…{mate}、よろしく'], hardworker: ['{mate}、いっしょに練習しよう!'], romantic: ['{mate}、素敵な出会いだね'],
    },
    mood: { great: ['{mate}!!今日は最高だね!!'], good: ['{mate}、いい感じ!'], normal: [], bad: ['{mate}…ちょっと不機嫌'], awful: ['{mate}…ほっといて'] },
  },

  // ---- 部屋の人への反応(2026-10-08・ユーザー指示「自分以外のプレイヤーにも反応する」)。{who}さん は、性格ごとの呼び方に替わる ----
  // 人が入ってきた
  welcome: {
    common: ['{who}さん、いらっしゃい!', '{who}さん、よろしくね!', '{who}さんが来た!', 'わーい、{who}さんだ!', '{who}さん、いっしょに遊ぼう!'],
    trait: {
      jester: ['お、{who}さん登場!盛り上がるぞ!'], brave: ['{who}さん、よく来た!手合わせしよう!'], clingy: ['{who}さん〜!来てくれてうれしい〜!'], smart: ['{who}さん、参加を確認しました。ようこそ'],
      serious: ['{who}さん、ようこそ。よろしくお願いします'], proud: ['{who}さん、遅かったじゃない。待ってたわ'], worrier: ['{who}さん、き、来てくれたんだ…よかった…'], stubborn: ['{who}さんか。足は引っぱるなよ'], easygoing: ['{who}さん、いらっしゃ〜い'], fiery: ['{who}さん、来たか!燃えるぞ!'], cool: ['{who}さん、来たね'], fickle: ['{who}さん、いい時に来たかも'], mellow: ['{who}さん、いらっしゃいませ'], hasty: ['{who}さん、来た!すぐやろ!'], competitive: ['{who}さん、来たな!勝負だ!'], showoff: ['{who}さん、いらっしゃ〜い!見ててね〜!'], shy: ['…あ、{who}さん…こんにちは'], hardworker: ['{who}さん、ようこそ!いっしょにがんばろう!'], romantic: ['{who}さん、素敵な夜にようこそ'],
    },
    mood: { great: ['{who}さん!!待ってたよ!!'], good: ['{who}さん、よろしくお願いね!'], normal: [], bad: ['…{who}さん、どうも'], awful: ['…{who}さんか'] },
  },
  // 人が抜けた
  farewell: {
    common: ['{who}さん、またね!', '{who}さん、ばいばい!', '{who}さん、おつかれさま!', '{who}さん、また遊ぼうね!', 'あ、{who}さんが行っちゃった!'],
    trait: {
      jester: ['{who}さん、退場!またのご来場を!'], brave: ['{who}さん、また勝負しよう!'], clingy: ['{who}さん、行っちゃうの…?またね…'], smart: ['{who}さん、お疲れさまでした'],
      serious: ['{who}さん、お疲れさまでした!'], proud: ['{who}さん、また来なさいよ'], worrier: ['{who}さん、気をつけてね…'], stubborn: ['{who}さんか。また来い'], easygoing: ['{who}さん、ばいば〜い'], fiery: ['{who}さん、また燃えにこいよ!'], cool: ['{who}さん、またね'], fickle: ['{who}さん、行っちゃった。ま、いっか'], mellow: ['{who}さん、お気をつけて'], hasty: ['{who}さん、またすぐね!'], competitive: ['{who}さん、次は勝負しような!'], showoff: ['{who}さん、また来てね〜!'], shy: ['…{who}さん、また…ね'], hardworker: ['{who}さん、またいっしょに練習しよう!'], romantic: ['{who}さん、またどこかの星で'],
    },
    mood: { great: ['{who}さん、楽しかった!!また!!'], good: ['{who}さん、またねー!'], normal: [], bad: ['…{who}さん、じゃあね'], awful: ['…{who}さん、ばいばい'] },
  },
  // 人が曲を選んだ
  reactPick: {
    common: ['{who}さん、{song}にしたんだ!', '{who}さんは{song}か〜!', '{song}、いいね!{who}さん!', '{who}さんの{song}、たのしみ!', '{who}さん、いい選曲!'],
    trait: {
      jester: ['{who}さん、{song}で盛り上げる気だね!'], brave: ['{who}さん、{song}か!受けて立つ!'], clingy: ['{who}さん、{song}ぼくも好き〜!'], smart: ['{who}さんの{song}、分析しがいがあります'],
      serious: ['{who}さん、{song}ですね。承知しました'], proud: ['{who}さん、{song}とはやるじゃない'], worrier: ['{who}さん、{song}…むずかしくない…?'], stubborn: ['{who}さん、{song}か。いい度胸だ'], easygoing: ['{who}さん、{song}いいね〜'], fiery: ['{who}さん、{song}か!燃えるな!'], cool: ['{who}さん、{song}だね。問題ない'], fickle: ['{who}さん、{song}?いい気分かも'], mellow: ['{who}さん、{song}、すてきですね'], hasty: ['{who}さん、{song}!すぐいこ!'], competitive: ['{who}さん、{song}か!負けない!'], showoff: ['{who}さん、{song}とはノれるね〜!'], shy: ['…{who}さん、{song}…好き'], hardworker: ['{who}さん、{song}だね!練習の成果を見せる!'], romantic: ['{who}さん、{song}…素敵な選曲'],
    },
    mood: { great: ['{who}さん!{song}!最高!!'], good: ['{song}、いいね!'], normal: [], bad: ['{who}さん、{song}ね…'], awful: ['…{song}か'] },
  },
  // 人がおまかせにした
  reactOmakase: {
    common: ['{who}さんはおまかせなんだ!', '{who}さん、おまかせか〜', '{who}さんのおまかせ、たのしみ!', '何がくるかな、{who}さん!', 'おまかせもいいね、{who}さん!'],
    trait: {
      jester: ['{who}さん、おまかせとはお目が高い!'], brave: ['{who}さん、運まかせか!嫌いじゃない!'], clingy: ['{who}さんといっしょならなんでもいい〜'], smart: ['{who}さん、確率に任せるのも一手です'],
      serious: ['{who}さん、おまかせですね。了解です'], proud: ['{who}さん、私が選んであげてもいいわよ'], worrier: ['{who}さん、むずかしい曲がきたらどうしよう…'], stubborn: ['{who}さん、決めきれんのか'], easygoing: ['{who}さん、おまかせでいいよね〜'], fiery: ['{who}さん、おまかせか!なんでも全力だ!'], cool: ['{who}さん、おまかせか。いいよ'], fickle: ['{who}さん、おまかせ大好きかも'], mellow: ['{who}さん、おまかせ、楽しみですね'], hasty: ['{who}さん、おまかせ!はやい!いいね!'], competitive: ['{who}さん、おまかせ?何が来ても勝つ!'], showoff: ['{who}さん、おまかせ〜!何でもノれる〜!'], shy: ['…{who}さん、おまかせ…どきどき'], hardworker: ['{who}さん、おまかせ!どの曲も練習だ!'], romantic: ['{who}さん、運命の一曲だね'],
    },
    mood: { great: [], good: [], normal: [], bad: [], awful: [] },
  },
  // 人がMVPを取った
  hMvp: {
    common: ['{who}さん、MVPおめでとう!', '{who}さんがMVP!すごい!', 'やられた!{who}さんがMVPだ!', '{who}さん、かっこいい!MVP!', '{who}さんのMVP、おみごと!'],
    trait: {
      jester: ['{who}さんMVP!拍手喝采!ぱちぱち!'], brave: ['{who}さん、やるな!次は負けない!'], clingy: ['{who}さんすごい〜!ぼくもほめて〜!'], smart: ['{who}さんのスコア、見事な精度です'],
      serious: ['{who}さん、MVPおめでとうございます!'], proud: ['{who}さん、やるじゃない。次は私が上よ'], worrier: ['{who}さん、すごい…わたしにはむりだ…'], stubborn: ['{who}さん、見事だ。次は負けん'], easygoing: ['{who}さん、すごいね〜MVP〜'], fiery: ['{who}さん、MVPか!熱いな!'], cool: ['{who}さん、MVP。さすがだね'], fickle: ['{who}さん、今日はついてる日かも'], mellow: ['{who}さん、まあ、MVPですって'], hasty: ['{who}さん、MVP!次もすぐね!'], competitive: ['{who}さん、くっ…次はこっちが取る!'], showoff: ['{who}さん、やるね〜!次はこっちね〜!'], shy: ['…{who}さん、すごい'], hardworker: ['{who}さん、すごい!見習う!'], romantic: ['{who}さん、星みたいに輝いてた'],
    },
    mood: { great: ['{who}さん最高!!MVP!!'], good: ['{who}さん、さすが!'], normal: [], bad: ['…{who}さん、やるじゃん'], awful: ['…{who}さん、おめでと'] },
  },
  // 人が高いスコアを出した
  hHigh: {
    common: ['{who}さん、高得点!すごい!', '{who}さん、うまい!', '{who}さん、いい演奏だったね!', '{who}さん、さすが!', 'ナイス、{who}さん!'],
    trait: {
      jester: ['{who}さん、決めたね!拍手!'], brave: ['{who}さん、いい腕だ!'], clingy: ['{who}さんすごい〜!なでなでしてあげる〜'], smart: ['{who}さん、高い精度ですね'],
      serious: ['{who}さん、お見事でした'], proud: ['{who}さん、悪くないわね'], worrier: ['{who}さん、すごい…ミスしてなかった…'], stubborn: ['{who}さん、よくやった'], easygoing: ['{who}さん、うまいね〜'], fiery: ['{who}さん、熱い演奏だった!'], cool: ['{who}さん、正確だったね'], fickle: ['{who}さん、今日は気分のってたね'], mellow: ['{who}さん、おじょうずでした'], hasty: ['{who}さん、うまい!はやかった!'], competitive: ['{who}さん、やるな!負けてられない!'], showoff: ['{who}さん、ノッてたね〜!'], shy: ['…{who}さん、じょうず'], hardworker: ['{who}さん、いい演奏!練習のたまもの?'], romantic: ['{who}さん、素敵な音だった'],
    },
    mood: { great: ['{who}さん最高!!'], good: ['{who}さんいいね!'], normal: [], bad: ['…{who}さん、やるね'], awful: ['…{who}さん、まあまあ'] },
  },
  // 人が思ったより伸びなかった
  hLow: {
    common: ['{who}さん、どんまい!', '{who}さん、次があるよ!', '{who}さん、きにしないで!', '{who}さん、ひとやすみする?', '{who}さん、いっしょにがんばろう!'],
    trait: {
      jester: ['{who}さん、ズコーも芸のうち!'], brave: ['{who}さん、立ちあがれ!次だ!'], clingy: ['{who}さん、元気出して〜ぎゅっ'], smart: ['{who}さん、次は修正できます'],
      serious: ['{who}さん、次に生かしましょう'], proud: ['{who}さん、あなたならできるわ'], worrier: ['{who}さん、だ、だいじょうぶ…?'], stubborn: ['{who}さん、あきらめるな。次だ'], easygoing: ['{who}さん、どんまい〜'], fiery: ['{who}さん、まだまだこれからだ!'], cool: ['{who}さん、次は直せるよ'], fickle: ['{who}さん、気分の問題かもよ'], mellow: ['{who}さん、そういう日もありますよ'], hasty: ['{who}さん、すぐ次!次!'], competitive: ['{who}さん、次で巻き返そう!'], showoff: ['{who}さん、次はノれるって〜!'], shy: ['…{who}さん、げ、元気だして'], hardworker: ['{who}さん、いっしょに練習しよう!'], romantic: ['{who}さん、夜明けはきっと来るよ'],
    },
    mood: { great: ['{who}さん、次はいける!!'], good: ['{who}さん、次はいけるよ!'], normal: [], bad: ['…{who}さん、まあ、あるよ'], awful: ['…{who}さん、ドンマイ'] },
  },
  // 人がフルコンボをした
  hFull: {
    common: ['{who}さん、フルコン!すごい!', '{who}さん、ノーミス!?かっこいい!', '{who}さんのフルコン、見てたよ!', '{who}さん、パーフェクト!', '{who}さん、天才!'],
    trait: {
      jester: ['{who}さんフルコン!会場がわいた!'], brave: ['{who}さん、お見事!次は私も取る!'], clingy: ['{who}さんすごすぎる〜!!'], smart: ['{who}さん、驚異的な精度です'],
      serious: ['{who}さん、フルコンおめでとうございます!'], proud: ['{who}さん、やるわね。認めてあげる'], worrier: ['{who}さん、すごい…ほんとに人間…?'], stubborn: ['{who}さん、見事だ。脱帽だ'], easygoing: ['{who}さん、フルコンすごいね〜'], fiery: ['{who}さん、フルコン!燃えるな!'], cool: ['{who}さん、フルコンか。見事'], fickle: ['{who}さん、フルコン?明日もいけそうかも'], mellow: ['{who}さん、フルコンですって、まあ'], hasty: ['{who}さん、フルコン!はやっ!'], competitive: ['{who}さん、フルコンか…くっ、負けない!'], showoff: ['{who}さん、フルコン!天才じゃん〜!'], shy: ['…{who}さん、フルコン…すごい'], hardworker: ['{who}さん、フルコン!練習の成果だね!'], romantic: ['{who}さん、フルコン…夢みたい'],
    },
    mood: { great: ['{who}さん!!最高!!フルコン!!'], good: ['{who}さん、すごい!'], normal: [], bad: ['…{who}さん、やるね'], awful: ['…{who}さん、すごいね'] },
  },
  // 人が途中でやめた
  hQuit: {
    common: ['{who}さん、だいじょうぶ?', '{who}さん、途中でやめたの?', '{who}さん、無理しないでね', '{who}さん、またがんばろう!', '{who}さん、どうしたの?'],
    trait: {
      jester: ['{who}さん、途中退場とは粋だね!'], brave: ['{who}さん、次は最後まで行こう!'], clingy: ['{who}さん、どうしたの…?心配…'], smart: ['{who}さん、体調は大丈夫ですか?'],
      serious: ['{who}さん、お体を大切に'], proud: ['{who}さん、たまにはそんな日もあるわ'], worrier: ['{who}さん、だ、大丈夫…?なにかあった…?'], stubborn: ['{who}さん、次は最後までやれ'], easygoing: ['{who}さん、ゆっくりでいいよ〜'], fiery: ['{who}さん、次は最後まで燃えよう!'], cool: ['{who}さん、大丈夫?'], fickle: ['{who}さん、気分が変わったのかな'], mellow: ['{who}さん、ご無理なさらずに'], hasty: ['{who}さん、どうした?はやく戻って!'], competitive: ['{who}さん、勝負はおあずけだな'], showoff: ['{who}さん、また戻ってきてね〜!'], shy: ['…{who}さん、また、来てね'], hardworker: ['{who}さん、また今度いっしょに!'], romantic: ['{who}さん、また旋律の中で会おう'],
    },
    mood: { great: ['{who}さん、次は最後まで!!'], good: ['{who}さん、次はいけるよ!'], normal: [], bad: ['…{who}さん、どうしたの'], awful: ['…{who}さん'] },
  },
  // 人がふつうの点だった(高くも低くもない。2026-11-07 本オープンの目玉 B3「ひとりで遊ぶときも横で演奏し、結果で一言」で足した)
  hMid: {
    common: ['{who}さん、おつかれさま!', '{who}さん、いい感じだったね!', '{who}さん、もう1曲いこっか!', '{who}さん、となりで聞いてて楽しかった!'],
    trait: {
      jester: ['{who}さん、いいノリだったね!'], brave: ['{who}さん、次はもっと上を狙おう!'], clingy: ['{who}さん、となりで演奏できてうれしい〜'], smart: ['{who}さん、安定していましたね'],
      serious: ['{who}さん、おつかれさまでした'], proud: ['{who}さん、まあまあね。次はもっといけるわ'], worrier: ['{who}さん、最後までいけたね…よかった'], stubborn: ['{who}さん、悪くない。次だ'], easygoing: ['{who}さん、のんびり楽しかったね〜'],
      fiery: ['{who}さん、まだまだ燃えられるぞ!'], cool: ['{who}さん、悪くない。伸びしろはある'], fickle: ['{who}さん、次はどの曲にする?'], mellow: ['{who}さん、おだやかでいい演奏でした'],
      hasty: ['{who}さん、さあ次!すぐ次!'], competitive: ['{who}さん、次は自己ベスト更新だ!'], showoff: ['{who}さん、見てた見てた!いい感じ!'], shy: ['{who}さん…いっしょに演奏、楽しかった'],
      hardworker: ['{who}さん、くり返せばもっと伸びます'], romantic: ['{who}さん、いい音色だったね'],
    },
    mood: { great: ['{who}さん、いい感じ!!'], good: ['{who}さん、ナイス!'], normal: [], bad: ['…{who}さん、おつかれ'], awful: ['…{who}さん'] },
  },
  // 人に名前で呼びかける(静かなとき)
  callOut: {
    common: ['{who}さん、楽しんでる?', '{who}さん、調子はどう?', 'ねえ、{who}さん!', '{who}さん、いっしょにがんばろうね!', '{who}さん、次の曲たのしみだね!'],
    trait: {
      jester: ['{who}さん、ひとネタいく?'], brave: ['{who}さん、今日は勝負だ!'], clingy: ['{who}さ〜ん、そばにいてね〜'], smart: ['{who}さん、次の選曲は決まりましたか'],
      serious: ['{who}さん、本日もよろしくお願いします'], proud: ['{who}さん、私の演奏、期待してなさい'], worrier: ['{who}さん、ぼ、ぼく足を引っぱってない…?'], stubborn: ['{who}さん、手は抜くなよ'], easygoing: ['{who}さ〜ん、のんびりいこ〜'], fiery: ['{who}さん、今日も全力でいくぞ!'], cool: ['{who}さん、落ち着いていこう'], fickle: ['{who}さん、今日はなんかいけそう'], mellow: ['{who}さん、ゆっくり楽しみましょうね'], hasty: ['{who}さん、はやく次いこ!'], competitive: ['{who}さん、次の曲で勝負だ!'], showoff: ['{who}さん、見ててね〜!'], shy: ['…{who}さん、あの…'], hardworker: ['{who}さん、今日もコツコツいこう!'], romantic: ['{who}さん、いい夜だね'],
    },
    mood: { great: ['{who}さん!!今日は最高だね!!'], good: ['{who}さん、いい感じだね!'], normal: [], bad: ['…{who}さん'], awful: ['…{who}さん、なに'] },
  },

  // ---- 会話の記憶・つきあい・時間帯・ビートLv・性格の相性(2026-10-08・ユーザー指示「会話の改良」)----
  // 「さっきの話は?」→ 前の話題を言う({topic}=話題。曲の話なら曲名)
  recall: {
    common: ['さっきは{topic}の話をしてたよね!', 'えっと、{topic}の話だったよね?', 'さっきの話?{topic}だよ!', '{topic}の話、まだ覚えてるよ!'],
    trait: { jester: ['{topic}の話!ウケたよね!'], brave: ['{topic}の話だ!忘れてないぞ!'], clingy: ['{topic}の話、ちゃんと覚えてるよ〜!'], smart: ['直前の話題は{topic}です'], serious: ['{topic}のお話でしたね'], proud: ['{topic}の話でしょ。覚えてるわよ'], worrier: ['え、{topic}の話…だったよね?'], stubborn: ['{topic}の話だったな'], easygoing: ['{topic}の話だっけ〜?のんびり覚えてる〜'], fiery: ['{topic}の話だ!熱かったな!'], cool: ['{topic}の話だったね'], fickle: ['{topic}の話…だったかも'], mellow: ['{topic}のお話でしたね、ふふ'], hasty: ['{topic}の話!覚えてる!'], competitive: ['{topic}の話だろ?覚えてる!'], showoff: ['{topic}の話!記憶力も天才〜!'], shy: ['…{topic}の、話…だよね'], hardworker: ['{topic}の話!ちゃんと覚えてる!'], romantic: ['{topic}の話…素敵だったね'] },
    mood: { great: ['{topic}の話!!ちゃんと覚えてるよ!!'], good: [], normal: [], bad: ['…{topic}の話でしょ'], awful: [] },
  },
  // 「さっきの話は?」→ まだ話していないとき
  recallNone: {
    common: ['まだ何も話してないよ?', 'さっきの話?これからだよ!', 'あれ、まだ話してなかったっけ?', '話はこれから!なんでも聞いて!'],
    trait: { jester: ['話してないよ!今から盛り上がろう!'], brave: ['まだだ!何でも聞いてくれ!'], clingy: ['まだお話してない〜!なにか聞いて〜!'], smart: ['記録上、まだ会話はありません'], serious: ['まだお話はしておりません'], proud: ['まだ何も話してないわ。話しかけなさい'], worrier: ['え、ま、まだ何も話してない…よね?'], stubborn: ['まだ話していないな'], easygoing: ['まだ何も話してないよ〜'], fiery: ['まだだ!何でも熱く答えるぞ!'], cool: ['まだ何も話してないよ'], fickle: ['まだ話してない…よね、たぶん'], mellow: ['まだお話ししていませんよ'], hasty: ['まだ!はやく話そ!'], competitive: ['まだ何も話してないぞ!'], showoff: ['まだだよ〜!話そ話そ〜!'], shy: ['…ま、まだ、何も…'], hardworker: ['まだ話してないよ!今から話そう!'], romantic: ['まだ物語は始まってないよ'] },
    mood: { great: ['まだだよ!!今から話そう!!'], good: [], normal: [], bad: ['…まだ話してない'], awful: [] },
  },
  // 何度も来てくれた人へのあいさつ({plays}=遊んだ回数)
  bondHello: {
    common: ['もう{plays}回も遊んだね!', '{plays}回目のライブ、いっしょに楽しもう!', 'いつも呼んでくれてありがとう!', '何度もいっしょでうれしいな!'],
    trait: { jester: ['{plays}回も呼ばれるなんて、人気者だね!'], brave: ['{plays}回、戦ってきた戦友だな!'], clingy: ['{plays}回もいっしょ!うれしい〜!'], smart: ['累計{plays}回の演奏ですね'], serious: ['{plays}回もお声がけいただき光栄です'], proud: ['{plays}回も私を選ぶなんて、見る目があるわ'], worrier: ['{plays}回もいっしょ…ありがとう…'], stubborn: ['{plays}回目か。悪くない'], easygoing: ['{plays}回目〜、もう慣れっこだね〜'], fiery: ['{plays}回も!まだまだ燃えるぞ!'], cool: ['{plays}回。長い付き合いだね'], fickle: ['{plays}回?気づいたらそんなに'], mellow: ['{plays}回も、ありがとうございます'], hasty: ['{plays}回!あっという間!'], competitive: ['{plays}回か!まだまだ上をめざす!'], showoff: ['{plays}回も!ご指名ありがと〜!'], shy: ['…{plays}回も…うれしい'], hardworker: ['{plays}回!一回一回が積み重ね!'], romantic: ['{plays}回…夢みたいな日々だね'] },
    mood: { great: ['{plays}回目!!最高の仲間だね!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 部屋に入ったとき、遊んだ回数に触れる
  bondJoin: {
    common: ['また呼んでくれてありがとう!', '{plays}回目の登場だよ!', 'おなじみのメンバーだね!', '今日もよろしくね!{plays}回目!'],
    trait: { jester: ['{plays}回目のご来場!盛り上げるよ!'], brave: ['{plays}回目、今日も前線は任せろ!'], clingy: ['また呼んでくれた〜!{plays}回目!うれしい〜!'], smart: ['{plays}回目の演奏準備、完了です'], serious: ['{plays}回目、本日もよろしくお願いします'], proud: ['{plays}回目の私に、期待しなさい'], worrier: ['{plays}回目なのに、まだ緊張する…'], stubborn: ['{plays}回目か。今日もやるぞ'], easygoing: ['{plays}回目〜、今日ものんびり〜'], fiery: ['{plays}回目も全力だ!'], cool: ['{plays}回目。いつもどおりいく'], fickle: ['{plays}回目、今日の気分は上々'], mellow: ['{plays}回目ですね、うれしいです'], hasty: ['{plays}回目!はやく始めよ!'], competitive: ['{plays}回目!今日こそ一番だ!'], showoff: ['{plays}回目!今日もノッてくよ〜!'], shy: ['…{plays}回目。少し慣れた'], hardworker: ['{plays}回目!今日も練習あるのみ!'], romantic: ['{plays}回目の、素敵な時間'] },
    mood: { great: ['{plays}回目!!張り切っていくよ!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 朝(5〜10時)のあいさつ
  timeMorning: {
    common: ['おはよう!朝から元気にいこう!', '朝のライブ、気持ちいいね!', 'おはよう!早起きだね!', '朝イチの演奏、がんばるよ!'],
    trait: { jester: ['おはよう!朝からボケていくよ!'], brave: ['おはよう!朝から全力だ!'], clingy: ['おはよ〜!朝から会えてうれしい〜!'], smart: ['おはようございます。本日も良好です'], serious: ['おはようございます!今日もよろしく!'], proud: ['おはよう。朝から私と遊べるなんて幸運よ'], worrier: ['お、おはよう…早いね…'], stubborn: ['おはよう。朝は嫌いじゃない'], easygoing: ['おはよ〜…まだちょっとねむい〜'], fiery: ['おはよう!朝から燃えてるぞ!'], cool: ['おはよう。朝は静かでいい'], fickle: ['おはよ。朝の気分、悪くないかも'], mellow: ['おはようございます、いい朝ですね'], hasty: ['おはよ!朝からサクッといこ!'], competitive: ['おはよう!朝から勝ちにいく!'], showoff: ['おはよ〜!朝からノリノリ〜!'], shy: ['…お、おはよう'], hardworker: ['おはよう!朝練しよう!'], romantic: ['おはよう。朝日がきれいだね'] },
    mood: { great: ['おはよう!!最高の朝だね!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 昼(11〜16時)のあいさつ
  timeNoon: {
    common: ['こんにちは!お昼のライブだね!', '昼間のライブ、いいね!', 'こんにちは!ひと休みに一曲どう?', '昼でも夜でも、リズムはいっしょ!'],
    trait: { jester: ['こんにちは!昼から笑いをとるぞ!'], brave: ['こんにちは!昼間も全開だ!'], clingy: ['こんにちは〜!お昼もいっしょでうれしい〜!'], smart: ['こんにちは。昼の集中力は高めです'], serious: ['こんにちは、本日もよろしくお願いします'], proud: ['こんにちは。昼の私も輝いてるわよ'], worrier: ['こ、こんにちは…昼でも緊張する…'], stubborn: ['こんにちは。昼でもやるときはやる'], easygoing: ['こんにちは〜、お昼ごはんのあとは眠いね〜'], fiery: ['こんにちは!昼も熱いぞ!'], cool: ['こんにちは。調子は問題ない'], fickle: ['こんにちは。お昼はなんとなく好き'], mellow: ['こんにちは、ごはんは食べましたか?'], hasty: ['こんにちは!昼休み短いし、はやく!'], competitive: ['こんにちは!昼も負けないぞ!'], showoff: ['こんにちは〜!昼もノッてるよ〜!'], shy: ['…こ、こんにちは'], hardworker: ['こんにちは!昼も練習がんばろう!'], romantic: ['こんにちは。空がすみきってるね'] },
    mood: { great: ['こんにちは!!元気いっぱいだよ!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 夕方〜夜(17〜21時)のあいさつ
  timeEvening: {
    common: ['こんばんは!夜のライブ、わくわく!', 'こんばんは!今日もおつかれさま!', '夜になると気分が上がるね!', 'こんばんは!ゆっくり楽しもう!'],
    trait: { jester: ['こんばんは!夜のステージは任せて!'], brave: ['こんばんは!夜の部も全力だ!'], clingy: ['こんばんは〜!夜もいっしょ〜!'], smart: ['こんばんは。夜間の演奏も安定しています'], serious: ['こんばんは、今日もおつかれさまです'], proud: ['こんばんは。夜の舞台は私の出番ね'], worrier: ['こんばんは…夜はちょっと緊張するね…'], stubborn: ['こんばんは。夜こそ本番だ'], easygoing: ['こんばんは〜、まったり遊ぼ〜'], fiery: ['こんばんは!夜もまだまだ燃える!'], cool: ['こんばんは。落ち着く時間だね'], fickle: ['こんばんは。夜は気分が変わるかも'], mellow: ['こんばんは、今日もよくがんばりましたね'], hasty: ['こんばんは!寝る前にサクッと!'], competitive: ['こんばんは!夜も勝負だ!'], showoff: ['こんばんは〜!夜は天才タイム〜!'], shy: ['…こんばんは。夜は、静かでいいね'], hardworker: ['こんばんは!今日の練習、仕上げよう!'], romantic: ['こんばんは。星がきれいな夜だね'] },
    mood: { great: ['こんばんは!!夜も最高!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 深夜(22〜4時)のあいさつ
  timeNight: {
    common: ['こんな夜ふかしに、ありがとう!', '夜ふかしライブ、ひみつっぽいね!', '夜ふかしだね。ほどほどにね!', '静かな夜のライブも、いいね!'],
    trait: { jester: ['夜ふかしライブ、深夜テンションでいくよ!'], brave: ['夜ふかしか!つき合うぞ!'], clingy: ['こんな時間に呼んでくれてうれしい〜!でも寝てね〜'], smart: ['深夜帯です。睡眠も大切ですよ'], serious: ['夜遅くまでおつかれさまです。無理なさらず'], proud: ['こんな時間まで起きてるなんて、やるじゃない'], worrier: ['こんな時間…明日だいじょうぶ…?'], stubborn: ['夜ふかしか。ほどほどにな'], easygoing: ['ふぁ…もう夜おそいね〜'], fiery: ['こんな時間でも燃えてるぞ!'], cool: ['遅いね。ほどほどに'], fickle: ['夜ふかしの気分かも'], mellow: ['あらあら、夜ふかしさんですね'], hasty: ['夜おそい!はやく一曲やって寝よ!'], competitive: ['こんな時間でも負けないぞ!'], showoff: ['夜ふかし〜!テンション上がる〜!'], shy: ['…夜おそいと、人が少なくて落ち着く'], hardworker: ['夜おそいね!練習はほどほどに!'], romantic: ['月が高いね。夢の時間だ'] },
    mood: { great: ['夜ふかしライブ!!テンション上がる!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 結果で、自分のビートLvが上がった({lv}=新しいLv)
  lvUp: {
    common: ['ビートLvが上がった!', 'レベルアップ!やったー!', 'Lv.{lv}になったよ!', '成長した気がする!Lv.{lv}!'],
    trait: { jester: ['Lv.{lv}!ボケの腕も上がったかも!'], brave: ['Lv.{lv}!強くなったぞ!'], clingy: ['Lv.{lv}になったよ〜!ほめて〜!'], smart: ['Lv.{lv}に到達しました。想定どおりです'], serious: ['Lv.{lv}になりました!努力が実りました!'], proud: ['Lv.{lv}。当然の結果ね'], worrier: ['Lv.{lv}…ほんとに?うれしい…'], stubborn: ['Lv.{lv}か。まだまだこれからだ'], easygoing: ['Lv.{lv}だって〜、やったね〜'], fiery: ['Lv.{lv}!燃えた分だけ上がった!'], cool: ['Lv.{lv}。計算どおり'], fickle: ['Lv.{lv}?いつのまに'], mellow: ['Lv.{lv}ですって、うれしいですね'], hasty: ['Lv.{lv}!もう次のLv!'], competitive: ['Lv.{lv}!次はもっと上だ!'], showoff: ['Lv.{lv}!やっぱ天才かも〜!'], shy: ['…Lv.{lv}…ちょっと、うれしい'], hardworker: ['Lv.{lv}!練習が実った!'], romantic: ['Lv.{lv}…星に一歩近づいた'] },
    mood: { great: ['Lv.{lv}!!最高にうれしい!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // 結果で、性格が決まった({trait}=決まった性格)
  traitNew: {
    common: ['性格が決まったよ!', 'わたし、{trait}って言われた!', '{trait}…これがわたしの性格かあ', '性格が決まった!これからは{trait}でいくよ!'],
    trait: { jester: ['性格は{trait}!ウケるでしょ!'], brave: ['{trait}か!悪くない!'], clingy: ['{trait}になったよ〜!どうかな〜?'], smart: ['性格は{trait}と判定されました'], serious: ['{trait}になりました。精進します'], proud: ['{trait}…ふふ、私にぴったりね'], worrier: ['{trait}…ぼくで、いいのかな…'], stubborn: ['{trait}か。受け入れよう'], easygoing: ['{trait}らしいよ〜、のんびりいこ〜'], fiery: ['{trait}か!燃えてきた!'], cool: ['{trait}。問題ない'], fickle: ['{trait}…明日は変わるかもね'], mellow: ['{trait}だそうです。いいですね'], hasty: ['{trait}!わかった!次!'], competitive: ['{trait}だって!負けないぞ!'], showoff: ['{trait}!まさにそれ〜!'], shy: ['…{trait}、だって'], hardworker: ['{trait}!これからもコツコツ!'], romantic: ['{trait}…なんて素敵な響き'] },
    mood: { great: ['{trait}!!わたしの性格、気に入った!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // ビートLv.10 で、性格の芽が出た({sprout}=いまいちばん近い性格。2026-11-06 社長の決定 案A)。
  // 性格はまだ決まっていないので、ふだんは共通と調子の束から選ぶ(性格の束は、検査のそろえと、たねで先に決めた子のため)
  sproutNew: {
    common: ['最近、{sprout}っぽいって言われるんだ', 'なんだか{sprout}っぽくなってきたかも', '{sprout}っぽい?まだ分からないけどね', '性格の芽が出たみたい。{sprout}っぽいって!'],
    trait: { jester: ['{sprout}っぽい?ウケるね!'], brave: ['{sprout}っぽいか!悪くない!'], clingy: ['{sprout}っぽいって〜!どうかな〜?'], smart: ['{sprout}の傾向が見えてきました'],
      serious: ['{sprout}の兆しがあるそうです'], proud: ['{sprout}っぽい?当然ね'], worrier: ['{sprout}っぽい…のかな…'], stubborn: ['{sprout}っぽい、か。ふむ'],
      easygoing: ['{sprout}っぽいんだって〜'],
      fiery: ['{sprout}っぽいって!燃えてきた!'], cool: ['{sprout}っぽい…か。悪くない'], fickle: ['{sprout}っぽい?気分次第かも'], mellow: ['あらあら、{sprout}っぽいそうです'],
      hasty: ['{sprout}っぽい!はやく決まらないかな!'], competitive: ['{sprout}っぽい?負けないぞ!'], showoff: ['{sprout}っぽいって!天才かも!'], shy: ['…{sprout}っぽい、って…'],
      hardworker: ['{sprout}っぽいって!もっと練習しよう!'], romantic: ['{sprout}っぽい…なんて素敵な響き'] },
    mood: { great: ['{sprout}っぽいって!!うれしい!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // マスモンどうしの張り合い({mate}=いっしょのマスモン)
  banterRival: {
    common: ['{mate}には負けないよ!', '{mate}、今日こそ勝負だ!', '{mate}、スコアで勝負しよう!', '{mate}、手加減はなしだよ!'],
    trait: { jester: ['{mate}、笑いも演奏も負けないよ!'], brave: ['{mate}、勝負だ!全力でこい!'], clingy: ['{mate}、負けないもん!'], smart: ['{mate}の分析、上回ってみせます'], serious: ['{mate}、正々堂々と勝負です'], proud: ['{mate}、私に勝てると思ってるの?'], worrier: ['{mate}、強そう…でも負けない…'], stubborn: ['{mate}、勝つのはこっちだ'], easygoing: ['{mate}〜、ほどほどに勝負しよ〜'], fiery: ['{mate}、どっちが熱いか見せよう!'], cool: ['{mate}、落ち着いていくよ'], fickle: ['{mate}、今日は負ける気がしないかも'], mellow: ['{mate}さん、お手やわらかにね'], hasty: ['{mate}、先にいくよ!'], competitive: ['{mate}、今度こそ勝つ!'], showoff: ['{mate}、天才の本気、見せちゃう〜!'], shy: ['…{mate}、負けない、よ'], hardworker: ['{mate}、勝負!いい練習になる!'], romantic: ['{mate}と、素敵な勝負を'] },
    mood: { great: ['{mate}!!絶対負けないからね!!'], good: [], normal: [], bad: ['…{mate}には負けない'], awful: [] },
  },
  // マスモンどうしの和やかなやりとり({mate}=いっしょのマスモン)
  banterFriend: {
    common: ['{mate}といると落ち着くな〜', '{mate}、いっしょでうれしい!', '{mate}、仲良くしようね!', '{mate}とならうまくいきそう!'],
    trait: { jester: ['{mate}、二人で笑いをとろう!'], brave: ['{mate}、いい仲間だな!'], clingy: ['{mate}〜、ずっとなかよしでいてね〜'], smart: ['{mate}との連携は良好です'], serious: ['{mate}さんとご一緒できて光栄です'], proud: ['{mate}、あなたとなら悪くないわ'], worrier: ['{mate}がいてくれて、ほっとする…'], stubborn: ['{mate}か。頼りにしてるぞ'], easygoing: ['{mate}〜、いっしょにのんびりしよ〜'], fiery: ['{mate}といると力がわく!'], cool: ['{mate}となら問題ない'], fickle: ['{mate}といると気分がいい'], mellow: ['{mate}さんと一緒で、うれしいです'], hasty: ['{mate}、いっしょにサクッといこ!'], competitive: ['{mate}、組んでも負けないぞ!'], showoff: ['{mate}、二人でノリノリいこ〜!'], shy: ['…{mate}といると、落ち着く'], hardworker: ['{mate}、二人でコツコツいこう!'], romantic: ['{mate}と奏でる、二人の旋律'] },
    mood: { great: ['{mate}!!大好き!!いっしょに叩こう!!'], good: [], normal: [], bad: [], awful: [] },
  },
  // ほかの人の結果で、ミスが多め({who}=その人)
  hMiss: {
    common: ['{who}さん、次はきっと大丈夫!', '{who}さん、ミスは気にしない!', '{who}さん、そういう日もあるよ!', '{who}さん、ドンマイ!次いこう!'],
    trait: { jester: ['{who}さん、ミスもネタにしちゃえ!'], brave: ['{who}さん、次は取り返せる!'], clingy: ['{who}さん、元気出して〜!ぎゅー!'], smart: ['{who}さん、次は集中すれば大丈夫です'], serious: ['{who}さん、次に活かしましょう'], proud: ['{who}さん、私もたまにミスするわよ…たまにね'], worrier: ['{who}さん、ぼくもよくミスするから大丈夫…'], stubborn: ['{who}さん、次がある'], easygoing: ['{who}さん、気にしない気にしない〜'], fiery: ['{who}さん、取り返そう!全力で!'], cool: ['{who}さん、気にしなくていい'], fickle: ['{who}さん、明日は得意な日かもよ'], mellow: ['{who}さん、だいじょうぶですよ'], hasty: ['{who}さん、切りかえ!はやく!'], competitive: ['{who}さん、次で取り返そう!'], showoff: ['{who}さん、ドンマイ〜!次ノれる〜!'], shy: ['…{who}さん、き、気にしないで'], hardworker: ['{who}さん、練習あるのみだよ!'], romantic: ['{who}さん、ミスも素敵な音のうち'] },
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
