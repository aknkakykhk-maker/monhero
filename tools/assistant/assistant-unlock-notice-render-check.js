const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// プロフィールで出す「解放の案内」が、実際に描画できて読み進められるかを見る。
//
// 仲良し度が解放Lvへ届いても画面のどこにも案内が出ず、呼び方を決められることに
// 気づけない、という状態を防ぐためのもの。
// assistant-bond-check.js はデータ側(いつ出すか・本文に何が入るか)を見ているので、
// ここは「その本文が本当に画面へ出るか」だけを、実際にReactで描いて確かめる。
//
// このサンドボックスはBGMの事前ロードを終えられず実ブラウザでタイトルから先へ
// 進めないため、assistant-select-render-check.js と同じやり方で画面のJSXだけを
// 取り出して描く。
//
//   node tools/assistant/assistant-unlock-notice-render-check.js
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

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- 画面のJSXを切り出す ---
const START = '      {/* 解放の案内。';
const END = '      {/* イベント回想の再生。';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (from < 0 || to < 0) {
  console.log('NG: 解放の案内のJSXを切り出せませんでした');
  process.exit(1);
}
const jsx = source.slice(from, to);

// --- 助手データを読む ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}
globalThis.__a={ASSISTANTS,assistantFaceImage,assistantSpeak,assistantCallStylesOf,
  assistantUnlockNoticeFor,ASSISTANT_CALL_STYLE_UNLOCK_LEVEL};`, ctx);
const A = ctx.__a;
// 本体と同じ引き当て(ASSISTANT_LIST は本体側の名前)
A.assistantById = (id) => A.ASSISTANTS.find(a => a.id === id) || A.ASSISTANTS[0];

const AssistantFace = ({ who, size, expression }) => React.createElement('img', {
  'data-face': who && who.id, 'data-size': size, 'data-expression': expression,
  alt: who && who.name, src: A.assistantFaceImage(who, expression),
});

const transformed = babel.transformSync(
  'const Screen = (P) => { const {bootPhase,gameState,onboarded,onboardingPreview,tutorialStep,kikiIntroStep,'
  + 'eventReplay,assistantUnlockNoticeOf,assistantUnlockPage,setAssistantUnlockPage,finishAssistantUnlockNotice,'
  + 'activeAssistant,assistantSpeakText,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId,'
  + 'AssistantFace}=P; return (<>\n' + jsx + '\n</>); };\nmodule.exports = { Screen };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'assistant-unlock-notice-render-check.jsx' },
);
const moduleScope = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
const { Screen } = moduleScope.exports;

const UNLOCK = A.ASSISTANT_CALL_STYLE_UNLOCK_LEVEL;
// 本体と同じ形で本文を組み立てる(呼び方の置き換えまで通す)
const assistantSpeakText = (text, name, level, callStyleId, assistantId) =>
  A.assistantSpeak(text, name, level, callStyleId, assistantId);

const render = (over = {}) => {
  const state = Object.assign({
    gameState: 'PROFILE', bondLevel: UNLOCK, seen: [], assistantId: 'mua', page: 0,
    onboarded: true, onboardingPreview: false, tutorialStep: null, kikiIntroStep: null, eventReplay: null,
  }, over);
  const closed = [];
  const paged = [];
  const props = {
    bootPhase: 'GAME', gameState: state.gameState, onboarded: state.onboarded,
    onboardingPreview: state.onboardingPreview, tutorialStep: state.tutorialStep,
    kikiIntroStep: state.kikiIntroStep, eventReplay: state.eventReplay,
    assistantUnlockNoticeOf: (scene) => A.assistantUnlockNoticeFor(scene, {
      bondLevel: state.bondLevel, assistantId: state.assistantId,
      callStyles: A.assistantCallStylesOf(state.assistantId),
    }, state.seen),
    assistantUnlockPage: state.page,
    setAssistantUnlockPage: (n) => paged.push(n),
    finishAssistantUnlockNotice: (id) => closed.push(id),
    activeAssistant: A.assistantById(state.assistantId),
    assistantSpeakText, breederName: 'テスト', assistantBondLevelNow: state.bondLevel,
    assistantCallStyle: '', selectedAssistantId: state.assistantId,
    AssistantFace,
  };
  const element = React.createElement(Screen, props);
  const html = ReactDOMServer.renderToStaticMarkup(element);
  return { html, element: Screen(props), text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), closed, paged };
};

const pagesOf = (assistantId) => A.assistantUnlockNoticeFor('profile', {
  bondLevel: UNLOCK, assistantId, callStyles: A.assistantCallStylesOf(assistantId),
}, []).pages;

const shown = render();
check('解放Lvに届いていれば案内が描ける', shown.html.length > 0);
check('見出しが出る', /呼び方を決められるようになった/.test(shown.text), shown.text.slice(0, 40));
check('1ページ目の本文がそのまま出る', shown.text.includes(pagesOf('mua')[0].replace(/\{name\}/g, 'テスト')));
check('助手の顔が出る', /data-face="mua"/.test(shown.html));
check('ページ番号が出る', new RegExp(`1 / ${pagesOf('mua').length}`).test(shown.text));
check('途中は「次へ」で読み進められる', /次へ/.test(shown.text) && !/閉じる/.test(shown.text));

const last = render({ page: pagesOf('mua').length - 1 });
check('最後のページには「閉じる」が出る', /閉じる/.test(last.text) && !/次へ/.test(last.text));
check('最後のページの本文が出る',
  last.text.includes(pagesOf('mua')[pagesOf('mua').length - 1].replace(/\{name\}/g, 'テスト')));

// ページ番号が本文の数を超えても、いちばん最後のページに収まって落ちない
const over = render({ page: 99 });
check('ページ番号が行きすぎても落ちない', /閉じる/.test(over.text));

check('解放Lvに届いていなければ何も出ない', render({ bondLevel: UNLOCK - 1 }).html === '');
check('一度読んだら何も出ない', render({ seen: ['unlock_call_style_v1'] }).html === '');
check('プロフィール以外では何も出ない', render({ gameState: 'HOME' }).html === '');
check('はじめての案内の途中では出さない', render({ tutorialStep: 0 }).html === ''
  && render({ kikiIntroStep: 0 }).html === '' && render({ onboarded: false }).html === '');
check('イベント回想の再生中は出さない', render({ eventReplay: { id: 'x', step: 0 } }).html === '');

// 呼び方の例は助手ごとに違う(みゅあは「ちん付け」、ききは「ちー付け」)。
// その違いが載っているページを描いて、選んでいる助手の本文が出ているかを見る
const differsAt = pagesOf('mua').findIndex((page, i) => page !== pagesOf('kiki')[i]);
const kiki = render({ assistantId: 'kiki', page: differsAt });
const mua = render({ page: differsAt });
check('助手を変えるとその助手の本文になる',
  differsAt >= 0
    && kiki.text.includes(pagesOf('kiki')[differsAt].replace(/\{name\}/g, 'テスト'))
    && /data-face="kiki"/.test(kiki.html)
    && kiki.text !== mua.text,
  differsAt >= 0 ? `${differsAt + 1}ページ目で違う` : '本文が助手ごとに変わらない');

// 押したときに次のページ・既読へつながっているか(押しても何も起きない状態を防ぐ)。
// 描いただけでは手は動かないので、要素の木からボタンを探して実際に呼ぶ
const buttonsOf = (element) => {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object' || !node.props) return;
    if (node.type === 'button' && typeof node.props.onClick === 'function') found.push(node.props.onClick);
    walk(node.props.children);
  };
  walk(element);
  return found;
};
check('「次へ」を押すと次のページへ進む', (() => {
  const r = render();
  const buttons = buttonsOf(r.element);
  if (buttons.length !== 1) return false;
  buttons[0]();
  return r.paged.length === 1 && r.paged[0] === 1 && r.closed.length === 0;
})());
check('「閉じる」を押すと既読として記録する', (() => {
  const r = render({ page: pagesOf('mua').length - 1 });
  const buttons = buttonsOf(r.element);
  if (buttons.length !== 1) return false;
  buttons[0]();
  return r.closed.length === 1 && r.closed[0] === 'unlock_call_style_v1';
})());
check('画面へ直接書いた本文が混ざっていない',
  !/[ぁ-んァ-ヶ一-龠]/.test(jsx.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/>次へ<|>閉じる</g, '><')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
