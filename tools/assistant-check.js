// 助手(ナビゲーター)システムを検証する。
//
// 助手は今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
// ギフト・ミッション・チュートリアルへ広げる想定なので、
// 「data/assistants.js を足すだけでどの画面でも同じ見た目で使える」形を保てているかを見る。
//
//   ① 助手の定義(名前・画像・色)がデータとして揃っている
//   ② 表情の画像が差し替え前提の書き方で、用意が無ければ既定の表情や絵文字へ落ちる
//   ③ 場面(scene)を足すだけでセリフ・表情・詳細を出せる
//   ④ 吹き出しの共通コンポーネントが、どの画面からも同じ呼び出しで使える
//   ⑤ セリフや画像のパスを各画面のJSXへ直接書いていない
//   ⑥ data/assistants.js が読めなかったときも画面が落ちない
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- ① 助手の定義 ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,DEFAULT_ASSISTANT_ID,ASSISTANT_SCENES,ASSISTANT_EXPRESSIONS,findAssistant,findAssistantScene,assistantFaceImage,assistantFullImage,assistantExpressionName};`, ctx);
const a = ctx.__a;

check('助手が1人以上いる', Array.isArray(a.ASSISTANTS) && a.ASSISTANTS.length >= 1, `${a.ASSISTANTS.length}人`);
check('最初の助手は「みゅあ」', a.ASSISTANTS.some(x => x.id === 'mua' && x.name === 'みゅあ'));
check('既定の助手が実在する', !!a.ASSISTANTS.find(x => x.id === a.DEFAULT_ASSISTANT_ID));
check('idが重複していない', new Set(a.ASSISTANTS.map(x => x.id)).size === a.ASSISTANTS.length);
check('助手ごとに名前・役割・絵文字・色がそろっている',
  a.ASSISTANTS.every(x => x.id && x.name && x.role && x.emoji && /^#[0-9a-f]{6}$/i.test(x.accent)));
check('みゅあの役割表示は「助手」', a.findAssistant('mua').role === '助手', a.findAssistant('mua').role);
check('idから引ける', a.findAssistant('mua')?.name === 'みゅあ');
check('知らないidでも既定の助手に落ちる', a.findAssistant('nobody')?.id === a.DEFAULT_ASSISTANT_ID);

// --- ② 表情の画像 ---
const EXPECTED_EXPRESSIONS = ['normal','happy','wink','surprise','troubled','angry','crying','excited'];
check('表情が8種そろっている',
  EXPECTED_EXPRESSIONS.every(e => a.ASSISTANT_EXPRESSIONS.includes(e)), a.ASSISTANT_EXPRESSIONS.join(', '));
const mua = a.findAssistant('mua');
check('表情ごとの画像ファイルが実在する', EXPECTED_EXPRESSIONS.every(e => {
  const full = path.join(root, 'monster-hero', a.assistantFullImage(mua, e));
  const face = path.join(root, 'monster-hero', a.assistantFaceImage(mua, e));
  return fs.existsSync(full) && fs.existsSync(face);
}));
check('吹き出しには軽い顔アイコンを使う(元絵は重いため)', (() => {
  const full = fs.statSync(path.join(root, 'monster-hero', a.assistantFullImage(mua, 'normal'))).size;
  const face = fs.statSync(path.join(root, 'monster-hero', a.assistantFaceImage(mua, 'normal'))).size;
  return face * 4 < full;
})(), `顔 ${Math.round(fs.statSync(path.join(root, 'monster-hero', a.assistantFaceImage(mua, 'normal'))).size/1024)}KB`);
check('顔アイコンを作り直す手順がある', fs.existsSync(path.join(root, 'tools/make-assistant-faces.js'))
  && assistantsSrc.includes('tools/make-assistant-faces.js'));
check('知らない表情は既定(normal)へ落ちる',
  a.assistantExpressionName(mua, 'nope') === 'normal' && a.assistantExpressionName(mua, null) === 'normal'
    && a.assistantFaceImage(mua, 'nope').endsWith('myua_normal.PNG'));
check('画像が読めなかったときも既定の表情へ落とす',
  has('onError={()=>setSrc(src === fallback ? null : fallback)}'));
check('それでも駄目なら絵文字で出る', has('{who.emoji}</span>}'));
check('助手の顔は大きさと表情を指定して使い回せる', has('const AssistantFace = ({ who, size = 72, accent, expression = null })'));
check('場面が変わったら表情を読み直す', has('useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);'));
check('index.htmlがdata/assistants.jsを読み込んでいる', /<script src="data\/assistants\.js\?v=[0-9a-f]{12}"><\/script>/.test(indexHtml));
check('助手は画像を持つbreeder.jsより後に読み込む',
  indexHtml.indexOf('data/breeder.js') < indexHtml.indexOf('data/assistants.js'));

// --- ③ 場面(scene) ---
check('場面がデータで管理されている', a.ASSISTANT_SCENES && typeof a.ASSISTANT_SCENES === 'object');
check('ヘルプのカテゴリ一覧の場面がある', !!a.findAssistantScene('helpTop'));
check('場面はセリフ・表情・詳細を持てる',
  Object.values(a.ASSISTANT_SCENES).every(s => !!s.short && (!s.detail || Array.isArray(s.detail)) && (!s.help || s.help.includes('/'))));
check('場面の表情はすべて用意されている', (() => {
  const bad = Object.entries(a.ASSISTANT_SCENES).filter(([, s]) => s.expression && !a.ASSISTANT_EXPRESSIONS.includes(s.expression));
  return bad.length === 0;
})());
check('セリフは短く保つ(スマホで読める長さ)', (() => {
  const long = Object.entries(a.ASSISTANT_SCENES).filter(([, s]) => s.short.length > 60).map(([k]) => k);
  return long.length === 0;
})(), Object.entries(a.ASSISTANT_SCENES).filter(([, s]) => s.short.length > 60).map(([k]) => k).join(', '));
check('一人称は「あたし」でそろえる', !/わたし|私は/.test(assistantsSrc));
check('場面が指すヘルプ項目は実在する', (() => {
  const helpCtx = {};
  vm.createContext(helpCtx);
  vm.runInContext(`${helpSrc}\nglobalThis.__h={helpFindTopic};`, helpCtx);
  return Object.values(a.ASSISTANT_SCENES).every(s => !s.help || !!helpCtx.__h.helpFindTopic(...s.help.split('/')));
})());
check('知らない場面キーではnullを返す', a.findAssistantScene('nope') === null);
check('場面の足しかたが手順として書いてある',
  assistantsSrc.includes('<AssistantBubble scene="home"/>') && assistantsSrc.includes('ASSISTANT_SCENES に場面を1つ足す'));

// --- ④ 共通コンポーネント ---
check('吹き出しは1つの共通コンポーネント', has('const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false })'));
check('場面の表情がそのまま顔に渡る', has('const face = expression || sceneDef?.expression || null;') && has('<AssistantFace who={who} size={size} accent={color} expression={face}/>'));
check('縦の場所が取れない画面向けの小さい表示がある', has('const size = faceSize != null ? faceSize : (compact ? 40 : 72);'));
check('場面キーだけでも、直接指定でも呼べる',
  has('const sceneDef = assistantSceneById(scene);') && has('const text = line || sceneDef?.short || who.greeting') && has('const paragraphs = detail || sceneDef?.detail || null;'));
check('詳細はヘルプ本文をそのまま出せる', has('const ref = helpRef || sceneDef?.help || null;') && has('renderHelpBlocks(topic.blocks, color)'));
check('吹き出し風の見た目(しっぽ付き)', has('{/* 吹き出しのしっぽ(左向き) */}') && has("borderRight:`9px solid ${color}`"));
check('タップで詳細が開く', has('onClick:()=>setOpen(true)') && has('タップで詳しく'));
check('詳細が無いときはボタンにしない', has("const Wrapper = hasDetail ? 'button' : 'div';"));
check('チュートリアル用に最初から開いた状態にもできる', has('defaultOpen=false') && has('useState(defaultOpen)'));
check('画面のテーマ色に合わせられる', has('const color = accent || who.accent || ASSISTANT_FALLBACK.accent;'));
check('ヘルプ画面で実際に使っている', has('<AssistantBubble key={`${helpCatId||\'\'}/${helpTopicId||\'\'}`}'));
// ヘルプ以外の画面へ広げるときに1行で済むこと(この形が崩れていないか)
check('ほかの画面は scene を渡すだけで使える', /const sceneDef = assistantSceneById\(scene\);/.test(source) && assistantsSrc.includes('その画面のJSXに1行置く'));

// --- ⑤ セリフや画像のパスを画面へ直接書いていない ---
// 直に書くと、直すときに全画面を探し回ることになる。data/assistants.js に集約しておく
check('セリフをJSXへ直接書いていない', (() => {
  const lines = Object.values(a.ASSISTANT_SCENES).map(s => s.short);
  return lines.every(line => !source.includes(line));
})());
check('画像のパスをJSXへ直接書いていない', !/images\/assistant\//.test(source));
check('画面側は scene を渡すだけ', (() => {
  const calls = source.match(/<AssistantBubble[^/]*\/>/g) || [];
  // ヘルプ画面だけは項目ごとの文面を渡すので line/detail を使う
  const written = calls.filter(c => /line="|detail="/.test(c));
  return calls.length >= 20 && written.length === 0;
})(), `${(source.match(/<AssistantBubble[^/]*\/>/g) || []).length}か所`);

// --- ⑥ 読めなかったときの守り ---
check('data/assistants.jsが読めなくても落ちない',
  has("const ASSISTANT_LIST = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];")
    && has("const ASSISTANT_SCENE_MAP = (typeof ASSISTANT_SCENES !== 'undefined' && ASSISTANT_SCENES) || {};")
    && has("const ASSISTANT_FALLBACK = { id:'', name:'助手', image:null, emoji:'💬'"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
