const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 「助手をえらぶ」画面が、実際に描画できて2人とも選べる形になっているかを見る。
//
// このサンドボックスはBGMの事前ロードを最後まで終えられないため、実ブラウザで
// タイトルから先へ進めない。そこで画面のJSXだけを取り出してReactで描き、
// 「開いた瞬間に落ちないか」「助手が全員並ぶか」「押せるボタンがあるか」を確かめる。
//
//   node tools/assistant/assistant-select-render-check.js
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
const START = "        {gameState==='ASSISTANT_SELECT'&&(";
const END = "        {/* PROFILE */}";
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (from < 0 || to < 0) {
  console.log('NG: 助手選択のJSXを切り出せませんでした');
  process.exit(1);
}
const jsx = source.slice(from, to);

// --- 助手データを読む ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,assistantFaceImage,assistantsUnlockedFrom,ASSISTANT_UNLOCK_STORIES};`, ctx);
const { ASSISTANTS, assistantFaceImage, assistantsUnlockedFrom, ASSISTANT_UNLOCK_STORIES } = ctx.__a;
// イベントで加入する助手(ドラ)は、その回の会話を見終えるまで並ばない(2026-09-17に足した)。
// 「見終えた会話のid」を渡し分けて、出す・出さないの両方を描いて確かめる
const UNLOCK_STORY_IDS = Object.values(ASSISTANT_UNLOCK_STORIES || {});
const EVENT_ASSISTANTS = ASSISTANTS.filter(w => (ASSISTANT_UNLOCK_STORIES || {})[w.id]);
const BASE_ASSISTANTS = ASSISTANTS.filter(w => !(ASSISTANT_UNLOCK_STORIES || {})[w.id]);

// 顔は中身を見ないので、同じ形の差し替えで足りる
const AssistantFace = ({ who, size }) => React.createElement('img', {
  'data-face': who && who.id, 'data-size': size, alt: who && who.name,
  src: assistantFaceImage(who, 'happy'),
});

const transformed = babel.transformSync(
  'const Screen = ({ gameState, ASSISTANT_LIST, selectedAssistantId, chooseAssistant, markKikiIntroSeen, setGameState, setTutorialKind, setTutorialStep, AssistantFace, onboardingPreview, assistantsUnlockedFrom, rhythmEventStorySeen }) => (<>\n'
  + jsx + '\n</>);\nmodule.exports = { Screen };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'assistant-select-render-check.jsx' },
);
const moduleScope = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
const { Screen } = moduleScope.exports;

const noop = () => {};
const picked = [];
const render = (seenStoryIds) => ReactDOMServer.renderToStaticMarkup(React.createElement(Screen, {
  gameState: 'ASSISTANT_SELECT',
  ASSISTANT_LIST: ASSISTANTS,
  selectedAssistantId: 'mua',
  chooseAssistant: (id) => picked.push(id),
  markKikiIntroSeen: noop,
  setGameState: noop, setTutorialKind: noop, setTutorialStep: noop,
  AssistantFace,
  // 通常のプレイと同じ状態で描く(デバッグの初回プレイ再生中だけ上に帯が出て、見出しが下がる)
  onboardingPreview: false,
  assistantsUnlockedFrom, rhythmEventStorySeen: seenStoryIds,
}));
// はじめて遊ぶ人(まだどのイベント会話も見ていない)の画面
const html = render([]);
// イベントの会話を見終えた人の画面
const htmlUnlocked = render(UNLOCK_STORY_IDS);
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const textUnlocked = htmlUnlocked.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

check('助手選択の画面が落ちずに描ける', html.length > 0);
check('見出しが出る', /助手をえらぶ/.test(text));
check('はじめから選べる助手が並ぶ', BASE_ASSISTANTS.every(w => text.includes(w.name)),
  BASE_ASSISTANTS.map(w => w.name).join(', '));
// ★イベントで加入する助手は、会話を見終えるまでここへ並べない。
//   並べてしまうと、まだ会っていない助手をいきなり選べてしまう
check('イベントで加入する助手は、見終えるまで並ばない',
  EVENT_ASSISTANTS.every(w => !text.includes(w.name)),
  EVENT_ASSISTANTS.map(w => w.name).join(', ') || '(いない)');
check('会話を見終えると並ぶ', ASSISTANTS.every(w => textUnlocked.includes(w.name)),
  ASSISTANTS.map(w => w.name).join(', '));
check('助手ごとの紹介文が出る',
  ASSISTANTS.every(w => !w.tagline || textUnlocked.includes(w.tagline)));
check('助手ごとの顔アイコンが出る',
  ASSISTANTS.every(w => htmlUnlocked.includes(`data-face="${w.id}"`)));
check('全員ぶんの選ぶボタンがある',
  ASSISTANTS.every(w => htmlUnlocked.includes(`aria-label="${w.name}をえらぶ"`)));
check('あとから変えられることが書いてある', /あとからプロフィールでいつでも変えられます/.test(text));
check('仲良し度が別々なことが書いてある', /助手ごとに別々/.test(text));
// 縦画面で見切れないよう、カードは2列に並べてスクロールできること
check('スマホの縦画面向けに2列で並べる', /grid-cols-2/.test(html));
check('はみ出す場合はスクロールできる', /overflow-y-auto/.test(html));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
