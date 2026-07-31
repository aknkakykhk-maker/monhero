// 助手(ナビゲーター)システムを検証する。
//
// 助手は今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
// ギフト・ミッション・チュートリアルへ広げる想定なので、
// 「data/assistants.js を足すだけでどの画面でも同じ見た目で使える」形を保てているかを見る。
//
//   ① 助手の定義(名前・画像・色)がデータとして揃っている
//   ② 表情の画像が差し替え前提の書き方で、用意が無ければ既定の表情や絵文字へ落ちる
//   ③ 場面(scene)を足すだけでセリフ・表情・詳細を出せる
//   ③' 1画面につき5種類以上のセリフを持ち、毎回ランダムで、直前と同じものは出さない
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
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,DEFAULT_ASSISTANT_ID,ASSISTANT_SCENES,ASSISTANT_EXPRESSIONS,findAssistant,findAssistantScene,assistantFaceImage,assistantFullImage,assistantExpressionName,assistantSceneLines,pickAssistantLine};`, ctx);
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
// 表情が分かるよう、顔は以前(72px)より2割ほど大きくしている
check('助手の顔は大きさと表情を指定して使い回せる', has('const AssistantFace = ({ who, size = 88, accent, expression = null })'));
check('顔は以前より大きい(既定88px・コンパクト48px)',
  has('const size = faceSize != null ? faceSize : (compact ? 48 : 88);'));
check('場面が変わったら表情を読み直す', has('useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);'));
check('index.htmlがdata/assistants.jsを読み込んでいる', /<script src="data\/assistants\.js\?v=[0-9a-f]{12}"><\/script>/.test(indexHtml));
check('助手は画像を持つbreeder.jsより後に読み込む',
  indexHtml.indexOf('data/breeder.js') < indexHtml.indexOf('data/assistants.js'));

// --- ③ 場面(scene) ---
check('場面がデータで管理されている', a.ASSISTANT_SCENES && typeof a.ASSISTANT_SCENES === 'object');
check('ヘルプのカテゴリ一覧の場面がある', !!a.findAssistantScene('helpTop'));
const SCENES = Object.entries(a.ASSISTANT_SCENES);
const allLines = (def) => [...(def.lines || []), ...Object.values(def.when || {}).flat()];
check('場面はセリフ・詳細を持てる',
  SCENES.every(([, s]) => Array.isArray(s.lines) && (!s.detail || Array.isArray(s.detail)) && (!s.help || s.help.includes('/'))));

// --- ③' 同じ画面で毎回ちがうことを話す ---
check('どの場面も5種類以上のセリフを持つ', (() => {
  const few = SCENES.filter(([, s]) => (s.lines || []).length < 5).map(([k, s]) => `${k}(${(s.lines || []).length})`);
  return few.length === 0;
})(), SCENES.filter(([, s]) => (s.lines || []).length < 5).map(([k, s]) => `${k}(${(s.lines || []).length})`).join(', '));
check('条件つきのセリフも5種類以上', (() => {
  const few = SCENES.flatMap(([k, s]) => Object.entries(s.when || {}).filter(([, l]) => l.length < 5).map(([c]) => `${k}/${c}`));
  return few.length === 0;
})());
check('セリフは { 表情, 本文 } の組で持つ',
  SCENES.every(([, s]) => allLines(s).every(l => l && typeof l.t === 'string' && l.t && typeof l.e === 'string')));
check('セリフの表情はすべて用意されている',
  SCENES.every(([, s]) => allLines(s).every(l => a.ASSISTANT_EXPRESSIONS.includes(l.e))));
check('同じ場面でセリフが重複していない',
  SCENES.every(([, s]) => new Set((s.lines || []).map(l => l.t)).size === (s.lines || []).length));
check('セリフは短く保つ(スマホで読める長さ)', (() => {
  const long = SCENES.flatMap(([k, s]) => allLines(s).filter(l => l.t.length > 45).map(l => `${k}:${l.t.length}字`));
  return long.length === 0;
})(), SCENES.flatMap(([k, s]) => allLines(s).filter(l => l.t.length > 45).map(l => `${k}:${l.t.length}字`)).join(', '));
// 実際に何度も引いて、直前と同じものが出ないこと・全種類がいつか出ることを確かめる
check('引くたびに変わり、直前と同じものは出ない', (() => {
  for (const [key, def] of SCENES) {
    const seen = new Set(); let prev = null;
    for (let i = 0; i < 300; i++) {
      const l = a.pickAssistantLine(key, null);
      if (prev && l.t === prev) return false;
      prev = l.t; seen.add(l.t);
    }
    if (seen.size !== (def.lines || []).length) return false;
  }
  return true;
})());
// 条件つきのセリフ(初回・記録更新・受取可能など)は通常のセリフより優先する
check('条件つきのセリフは通常より優先される', (() => {
  for (const [key, def] of SCENES) {
    for (const cond of Object.keys(def.when || {})) {
      const normal = new Set((def.lines || []).map(l => l.t));
      for (let i = 0; i < 60; i++) if (normal.has(a.pickAssistantLine(key, cond).t)) return false;
    }
  }
  return true;
})());
check('知らない条件では通常のセリフに戻る',
  new Set((a.ASSISTANT_SCENES.home.lines || []).map(l => l.t)).has(a.pickAssistantLine('home', 'nope').t));
// 説明書のような言い回しにしない / 語尾がワンパターンにならない
check('説明書のような言い回しを使っていない', (() => {
  const bad = SCENES.flatMap(([k, s]) => allLines(s).filter(l => /してください|しましょう|できます。|します。/.test(l.t)).map(l => `${k}:${l.t}`));
  return bad.length === 0;
})(), SCENES.flatMap(([k, s]) => allLines(s).filter(l => /してください|しましょう|できます。|します。/.test(l.t)).map(l => `${k}`)).join(', '));
check('同じ場面で語尾が偏っていない', (() => {
  for (const [, def] of SCENES) {
    const ends = (def.lines || []).map(l => l.t.slice(-4));
    const counts = {};
    ends.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    if (Math.max(...Object.values(counts)) > Math.ceil(ends.length / 2)) return false;
  }
  return true;
})());
check('直近に出したセリフは候補から外す',
  assistantsSrc.includes('const ASSISTANT_RECENT = {}') && assistantsSrc.includes('const assistantRecentLimit ='));
check('直近3件が続けて出ない', (() => {
  for (const [key, def] of SCENES) {
    if ((def.lines || []).length < 5) continue;
    const history = [];
    for (let i = 0; i < 200; i++) {
      const t = a.pickAssistantLine(key, null).t;
      if (history.slice(0, 3).includes(t)) return false;
      history.unshift(t);
    }
  }
  return true;
})());
check('一人称は「あたし」でそろえる', !/わたし|私は/.test(assistantsSrc));

// --- ⑦ 初回チュートリアルとデバッグ ---
check('チュートリアルの台本はデータで持つ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  const t = c.__t;
  return Array.isArray(t) && t.length >= 6 && t.every(p => p.t && p.e)
    && /困ったらいつでもあたしをタップしてね/.test(t[t.length - 1].t);
})());
check('チュートリアルの本文をJSXへ直接書いていない', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  return c.__t.every(p => !source.includes(p.t));
})());
check('初回だけ出し、スキップもできる',
  has("const seen = await storeGet(TUTORIAL_SEEN_KEY, false, false);") && has('スキップ</button>')
    && has('const finishTutorial = async (remember = true)'));
check('チュートリアルの既読は新しい保存キーへ分ける',
  has("const TUTORIAL_SEEN_KEY = 'mh_tutorial_seen_v1';") && !/mh_onboarded[^\n]*tutorial/.test(source));
check('デバッグはデバッグ設定からだけ開ける',
  has('💖 みゅあデバッグ') && source.indexOf('💖 みゅあデバッグ') > source.indexOf("gameState==='DEBUG_SETTINGS'"));
check('デバッグに必要な項目がそろっている',
  ['初回チュートリアル再生','チュートリアルだけ再生','全助手コメント確認','全表情確認','条件コメント確認','連打リアクション確認','初回状態へ戻す']
    .every(label => source.includes(label)));
check('初回状態へ戻してもセーブデータは消さない',
  has('モンスターやダイヤなどのセーブデータは消えません') && has('await storeSet(TUTORIAL_SEEN_KEY,false,false);'));
check('話し方の決まりごとが書いてある',
  assistantsSrc.includes('一人称は「あたし」') && assistantsSrc.includes('語尾は'));
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
check('吹き出しは1つの共通コンポーネント', has('const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, condition=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false })'));
check('選んだセリフの表情がそのまま顔に渡る', has('const face = expression || shown?.e || null;') && has('<AssistantFace who={who} size={size} accent={color} expression={face}/>'));
// 場面や条件が変わったときだけ選び直す。ほかの再描画でセリフが入れ替わると読めない
check('セリフは場面と条件が変わったときだけ選び直す',
  has('const pickKey = `${scene || \'\'}|${condition || \'\'}`;') && has("if (pickedRef.current?.key !== pickKey) {"));
check('画面から条件を渡せる', has('condition=null') && /condition=\{[^}]+\}/.test(source));
// 顔をタップすると次のセリフへ。詳細は吹き出し側なので、操作が分かれている
check('顔をタップすると次のセリフへ送れる',
  has('const onFaceTap = () => {') && has("aria-label={`${who.name}にはなしかける`}") && has('if (typeof pickAssistantLine === \'function\') setTapped(pickAssistantLine(scene, condition));'));
check('詳細は吹き出し側の操作のまま', has("onClick:()=>setOpen(true), 'aria-label':`${who.name}の説明を開く`"));
check('連打には専用のリアクションを出す',
  has('const spamLine = spam ? (spam.recovering ? spamRecover : spamLines[spam.step]) : null;')
    && assistantsSrc.includes('ASSISTANT_SPAM_LINES') && assistantsSrc.includes('ASSISTANT_SPAM_RECOVER'));
check('連打のあとは笑って元に戻す',
  (() => { const c = {}; require('vm').createContext(c);
    require('vm').runInContext(assistantsSrc + ';globalThis.__s={ASSISTANT_SPAM_LINES,ASSISTANT_SPAM_RECOVER};', c);
    const last = c.__s.ASSISTANT_SPAM_LINES[c.__s.ASSISTANT_SPAM_LINES.length - 1];
    return c.__s.ASSISTANT_SPAM_LINES.length >= 5 && last.last === true && /うそだよ/.test(c.__s.ASSISTANT_SPAM_RECOVER.t);
  })());
check('場面が変わったら送ったセリフも連打もリセットする',
  has('useEffect(() => { setTapped(null); setSpam(null); tapTimesRef.current = []; }, [pickKey]);'));
check('場面キーだけでも、直接指定でも呼べる',
  has('const sceneDef = assistantSceneById(scene);') && has("const text = line || shown?.t || who.greeting || '';") && has('const paragraphs = detail || sceneDef?.detail || null;'));
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
  const texts = SCENES.flatMap(([, s]) => allLines(s).map(l => l.t));
  return texts.every(t => !source.includes(t));
})());
check('画像のパスをJSXへ直接書いていない', !/images\/assistant\//.test(source));
// HOMEは絶対配置なので、置き場所をCSSで決める。施設のボタンやマスモンに
// かぶらないよう、プレイヤー情報と更新履歴の下の空きへ置く
check('HOMEの吹き出しは施設の上に重ならない場所へ置く',
  has('.mh-home-assistant{position:absolute;z-index:5;left:3%;width:70%;top:calc(54px + env(safe-area-inset-top));pointer-events:auto}')
    && has('@media(max-width:350px){.mh-home-assistant{width:62%}}')
    && has('<div className="mh-home-assistant"><AssistantBubble scene="home" condition={masuMons.length===0?\'firstRun\':null} compact/></div>'));
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
