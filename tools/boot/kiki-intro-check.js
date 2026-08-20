const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// きき加入の会話(既存プレイヤーへ1回だけ)を確認する。
//
// これは「ききが増える前から遊んでいた人」だけに、追加後の初回ログインで
// 一度だけ見せる会話。新しく始めた人は最初に助手を選ぶので出さない。
//
//   node tools/boot/kiki-intro-check.js
//
// とくに気をつけている点:
//   ・未閲覧フラグだけで判定しない(新しく始めた人も持っていないため)
//   ・会話を見ても、選んでいる助手・仲良し度を勝手に変えない
//   ・2人はもともと知り合い。呼び方は固定(みゅあ→ひめちん / きき→みゅあちん)で、
//     プレイヤー向けの親密度による呼び方は使わない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 台本 ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__k={ASSISTANT_KIKI_INTRO,ASSISTANT_KIKI_INTRO_CALLS,ASSISTANTS,ASSISTANT_EXPRESSIONS,assistantFaceImage};`, ctx);
const { ASSISTANT_KIKI_INTRO: script, ASSISTANT_KIKI_INTRO_CALLS: calls, ASSISTANTS, ASSISTANT_EXPRESSIONS, assistantFaceImage } = ctx.__k;

check('会話の台本がデータで持たれている', Array.isArray(script) && script.length >= 6, `${script ? script.length : 0}件`);
check('発言者と表情と本文がそろっている',
  script.every(l => l.who && l.t && l.e && ASSISTANTS.some(a => a.id === l.who) && ASSISTANT_EXPRESSIONS.includes(l.e)));
check('みゅあとききの両方が話す',
  script.some(l => l.who === 'mua') && script.some(l => l.who === 'kiki'));
check('掛け合いになっている(同じ人が続けて話し続けない)', (() => {
  let run = 1, max = 1;
  for (let i = 1; i < script.length; i++) { run = script[i].who === script[i - 1].who ? run + 1 : 1; if (run > max) max = run; }
  return max <= 2;
})());
// ★呼び方は固定。ここが崩れると2人の関係性が変わってしまう
check('みゅあはききを「ひめちん」と呼ぶ',
  calls && calls.mua === 'ひめちん' && script.some(l => l.who === 'mua' && l.t.includes('ひめちん')));
check('ききはみゅあを「みゅあちん」と呼ぶ',
  calls && calls.kiki === 'みゅあちん' && script.some(l => l.who === 'kiki' && l.t.includes('みゅあちん')));
check('プレイヤーへの呼び方({name})は使わない', !script.some(l => l.t.includes('{name}')));
check('画面側も呼び方の置き換えを通さない', (() => {
  const from = source.indexOf('const script=(typeof ASSISTANT_KIKI_INTRO');
  const to = source.indexOf('{/* 助手(みゅあ)のデバッグ表示', from);
  const block = source.slice(from, to);
  return from >= 0 && to > from && !block.includes('assistantSpeakText');
})());
check('初対面ではなく再会の空気になっている',
  script.some(l => /久しぶり|なんでここに|また|再会/.test(l.t)));
// ききらしさは出しつつ、毎文を「でつ/まつ」にはしない(幼児語キャラにしないため)
check('ききの話し方が崩しすぎになっていない', (() => {
  const k = script.filter(l => l.who === 'kiki');
  const soft = k.filter(l => /でつ|まつ|おはゆ/.test(l.t)).length;
  return soft >= 2 && soft < k.length;
})(), (() => { const k = script.filter(l => l.who === 'kiki'); return `崩しあり ${k.filter(l => /でつ|まつ|おはゆ/.test(l.t)).length} / ${k.length}件`; })());
check('助手の変え方を会話の中で案内している',
  script.some(l => /プロフィール/.test(l.t)));
check('スマホで読める長さに収まっている',
  script.every(l => l.t.length <= 40), script.filter(l => l.t.length > 40).map(l => `${l.t.length}字`).join(', '));

// --- 発生条件 ---
check('専用の新しい保存キーで覚える',
  has("const KIKI_INTRO_SEEN_KEY = 'mh_kiki_intro_seen_v1';"));
// ★「フラグが無い＝既存プレイヤー」ではない。新しく始めた人も持っていない
check('未閲覧フラグだけでは判定しない(オンボーディング完了と合わせて見る)',
  has('if (wasOnboarded && kikiIntroSeen !== true) setKikiIntroStep(0);'));
check('新しく始めた人は見たことにして、あとから流れないようにする',
  has("else if (!wasOnboarded && kikiIntroSeen !== true) { try { await storeSet(KIKI_INTRO_SEEN_KEY, true, false); setKikiIntroSeenFlag(true); } catch {} }"));
check('助手選択を通ったら見たことにする',
  has('chooseAssistant(who.id);markKikiIntroSeen();'));
check('見終わったら保存して、二度と自動再生しない',
  has('const markKikiIntroSeen = useCallback(() => {')
    && has('try { storeSet(KIKI_INTRO_SEEN_KEY, true, false); } catch {}'));
check('HOMEでだけ出す(案内やバトルに割り込まない)',
  has("{bootPhase==='GAME'&&gameState==='HOME'&&onboarded&&tutorialStep==null&&kikiIntroStep!=null&&(()=>{"));
check('アップデート通知と重ならない',
  has("tutorialStep==null&&kikiIntroStep==null&&updateGuideQueue.length>0"));
// ★会話を見ただけで助手が変わったり、仲良し度が動いたりしてはいけない
// 「見たことにする」処理の中身だけを取り出す(次の関数まで含めて見ないようにする)
const markSeenBody = (() => {
  const head = 'const markKikiIntroSeen = useCallback(() => {';
  const at = source.indexOf(head);
  if (at < 0) return null;
  const end = source.indexOf('}, []);', at);
  return end > at ? source.slice(at, end) : null;
})();
check('「見たことにする」処理を取り出せる', !!markSeenBody);
check('会話を見ても助手を切り替えない',
  !!markSeenBody && !/chooseAssistant|setSelectedAssistantId|ASSISTANT_SELECTED_KEY/.test(markSeenBody));
check('会話を見ても仲良し度を動かさない',
  !!markSeenBody && !/addAssistantBond|setAssistantBonds|assistantBondKeyFor/.test(markSeenBody));

// --- 画面 ---
const START = '      {bootPhase===\'GAME\'&&gameState===\'HOME\'&&onboarded&&tutorialStep==null&&kikiIntroStep!=null&&(()=>{';
const END = '      {/* 助手(みゅあ)のデバッグ表示';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
check('会話画面のJSXを切り出せる', from >= 0 && to > from);
if (from >= 0 && to > from) {
  const jsx = source.slice(from, to);
  const AssistantFace = ({ who, size, expression }) => React.createElement('img', {
    'data-face': who && who.id, 'data-size': size, 'data-expression': expression,
    alt: who && who.name, src: assistantFaceImage(who, expression),
  });
  const transformed = babel.transformSync(
    'const Screen = ({ bootPhase, gameState, onboarded, tutorialStep, kikiIntroStep, setKikiIntroStep,\n'
    + '  ASSISTANT_KIKI_INTRO, ASSISTANT_KIKI_INTRO_CALLS, ASSISTANT_LIST, assistantById, markKikiIntroSeen, AssistantFace }) => (<>\n'
    + jsx + '\n</>);\nmodule.exports = { Screen };',
    { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'kiki-intro-check.jsx' });
  const moduleScope = { exports: {} };
  new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
  const seen = [];
  const render = (stepAt) => ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.Screen, {
    bootPhase: 'GAME', gameState: 'HOME', onboarded: true, tutorialStep: null,
    kikiIntroStep: stepAt, setKikiIntroStep: (v) => seen.push(v),
    ASSISTANT_KIKI_INTRO: script, ASSISTANT_KIKI_INTRO_CALLS: calls,
    ASSISTANT_LIST: ASSISTANTS, assistantById: (id) => ASSISTANTS.find(x => x.id === id) || ASSISTANTS[0],
    markKikiIntroSeen: () => {}, AssistantFace,
  }));
  const first = render(0);
  const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  check('会話画面が落ちずに描ける', first.length > 0);
  check('発言者の名前が出る', text(first).includes(ASSISTANTS.find(a => a.id === script[0].who).name));
  check('発言者に合わせた顔と表情が出る',
    first.includes(`data-face="${script[0].who}"`) && first.includes(`data-expression="${script[0].e}"`));
  check('話していないほうの助手も並ぶ(2人の会話だと分かる)',
    ASSISTANTS.every(w => first.includes(`data-face="${w.id}"`)));
  check('タップで次へ進める', /aria-label="次へ"/.test(first) && /つぎへ/.test(text(first)));
  // 全ステップで、発言者の顔と本文が食い違わないこと
  check('どのセリフでも発言者と顔が一致する', script.every((l, i) => {
    const html = render(i);
    return html.includes(`data-face="${l.who}"`) && html.includes(`data-expression="${l.e}"`)
      && text(html).includes(l.t.replace(/\s+/g, ' '));
  }));
  const lastHtml = render(script.length - 1);
  check('最後は「とじる」で終わる', /とじる/.test(text(lastHtml)));
  check('進み具合が分かる', /1 \/ /.test(text(first)));
  // iPhone縦画面で見切れないための作り
  check('縦画面で見切れない作りになっている',
    /max-h-\[calc\(100dvh-env\(safe-area-inset-top\)\)\]/.test(first)
      && /overflow-y-auto/.test(first)
      && /env\(safe-area-inset-bottom\)/.test(first));
}

// --- 更新履歴とヘルプ ---
check('更新履歴に書いてある', /加入会話|加入イベント/.test(changelogSrc));
check('ヘルプに書いてある', /ききが加わったときの会話/.test(helpSrc));
check('デバッグから再生できる', has('きき加入の会話を再生'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
