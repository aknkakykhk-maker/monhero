// ヘルプ画面を実際にReactでレンダリングして、3階層それぞれが描けることを確認する。
//
// このサンドボックスは外部CDN(Tailwind)へ出られず、アプリを起動して目で見る確認ができない。
// そこで game-system.jsx からヘルプ部分のJSXだけを切り出し、状態と外部の関数を差し替えて
// react-dom/server で文字列に描き、期待する内容が出ているかを見る。
// 未定義の変数を参照していればここで例外になるため、開いた瞬間に落ちる不具合を防げる。
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
// どこから実行してもプリセットを見つけられるよう、絶対パスで解決する
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpData = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');
const assistantsData = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));
// t:'data' の表は本番の helpDataRows() が実データから作るので、その定義と材料もそのまま持ち込む
const dataTablePrelude = [
  breeder.slice(breeder.indexOf('const TEACHING_CARDS = [')).replace(/\b[A-Z_]+_ICON\b|\bDISC_STONE_BASE\b/g, "''"),
  grab(source, 'const LOGIN_BONUS_REWARDS = [', 'const LOGIN_BONUS_DEFAULT'),
  grab(source, 'const giftRewardText = ', 'const giftTitleDisplay'),
  grab(source, 'const MISSION_DEFS = {', 'const missionDailyPeriod'),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  'const SKIP_TICKETS = SKIP_TICKET_BY_DIFFICULTY;',
  grab(source, 'const helpDataRows = (id)', '// ===== 助手(ナビゲーター) ここから ====='),
  // 助手(吹き出し・顔・詳細モーダル)も本番の実装をそのまま持ち込む
  "const { useState, useEffect, useRef } = React;\nconst MUA_FACE_ICON = 'data:image/png;base64,TEST';\n"
  + "const ChevronRight = ({size}) => React.createElement('i', { 'data-size': size });\nconst X = ChevronRight;",
  assistantsData,
  grab(source, '// ===== 助手(ナビゲーター) ここから =====', '// ===== 助手(ナビゲーター) ここまで ====='),
].join('\n');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ヘルプのJSXを切り出す ---
const START = '      {showHelp&&(()=>{';
const END = '      })()}';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (from < 0 || to < 0) {
  console.log('NG: ヘルプのJSXを切り出せませんでした');
  process.exit(1);
}
const helpJsx = source.slice(from, to + END.length);

// 画面のアイコンは中身を見ないので、同じ形の差し替えで足りる
const stubIcon = ({ size }) => React.createElement('i', { 'data-size': size });
const transformed = babel.transformSync(
  `${helpData}\n${dataTablePrelude}\n` +
  // 本体側の「読み込めなかったときの守り」も同じ形で用意する
  "const HELP_GUIDE = (typeof HELP_CATEGORIES !== 'undefined' && Array.isArray(HELP_CATEGORIES)) ? HELP_CATEGORIES : [];\n" +
  "const HELP_GUIDE_INTRO = (typeof HELP_INTRO !== 'undefined' && HELP_INTRO) || '';\n" +
  'const helpCategoryById = (id) => HELP_GUIDE.find(c => c.id === id) || null;\n' +
  'const helpTopicById = (categoryId, topicId) => ((helpCategoryById(categoryId) || {}).topics || []).find(t => t.id === topicId) || null;\n' +
  'const HelpScreen = ({ showHelp, helpCatId, helpTopicId, helpAssistantOpen, setShowHelp, setHelpCatId, setHelpTopicId, setHelpAssistantOpen,\n' +
  '  ArrowLeft, ChevronRight, getDebugEnemyOptions, difficulty, setDebugEnemyKey, debugBattleRef, setDebugBattle, setDebugOutcome, setGameState }) => (<>\n' +
  helpJsx + '\n</>);\nmodule.exports = { HelpScreen, HELP_GUIDE, dataRows: helpDataRows, helpTopicById, AssistantBubble };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'help-render-check.jsx' }
);

const moduleScope = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
const { HelpScreen, HELP_GUIDE, dataRows, helpTopicById } = moduleScope.exports;

const noop = () => {};
const render = (state) => ReactDOMServer.renderToStaticMarkup(React.createElement(HelpScreen, {
  showHelp: true, helpCatId: null, helpTopicId: null, helpAssistantOpen: true,
  setShowHelp: noop, setHelpCatId: noop, setHelpTopicId: noop, setHelpAssistantOpen: noop,
  ArrowLeft: stubIcon, ChevronRight: stubIcon,
  getDebugEnemyOptions: () => [], difficulty: 'Normal',
  setDebugEnemyKey: noop, debugBattleRef: { current:false }, setDebugBattle: noop, setDebugOutcome: noop, setGameState: noop,
  ...state,
}));
const text = (html) => html.replace(/<[^>]*>/g, '');

// --- ① カテゴリ一覧 ---
const hub = render({});
check('カテゴリ一覧が描ける', hub.length > 0);
check('カテゴリ一覧に全カテゴリが出る', HELP_GUIDE.every(c => text(hub).includes(c.title)), `${HELP_GUIDE.length}件`);
// 助手のセリフは毎回ランダムなので、helpTopの候補のどれかが出ていればよい
const HELP_TOP_LINES = (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsData + ';globalThis.__t=ASSISTANT_SCENES.helpTop.lines.map(l=>l.t);', c);
  return c.__t;
})();
check('カテゴリ一覧に導入文と助手のひとことが出る',
  text(hub).includes('まずはここをチェック') && HELP_TOP_LINES.some(t => text(hub).includes(t)));
check('カテゴリの色がそのまま使われる', HELP_GUIDE.every(c => hub.includes(c.color)));

// --- ② 項目一覧 ---
for (const cat of HELP_GUIDE) {
  const list = render({ helpCatId: cat.id });
  const t = text(list);
  check(`「${cat.title}」の項目一覧が描ける`, cat.topics.every(x => t.includes(x.title)) && t.includes(cat.assistant), `${cat.topics.length}項目`);
}

// --- ③ 本文(全項目) ---
let bodyNg = [];
for (const cat of HELP_GUIDE) {
  for (const topic of cat.topics) {
    const body = text(render({ helpCatId: cat.id, helpTopicId: topic.id }));
    const missing = topic.blocks.some(b => {
      if (b.t === 'kv') return b.rows.some(r => !body.includes(r[0]) || !body.includes(r[1]));
      if (b.t === 'list' || b.t === 'steps') return b.items.some(x => !body.includes(x));
      if (b.t === 'note') return (b.title && !body.includes(b.title)) || !body.includes(b.text);
      // 実データから作る表は、行が1つ残らず出ているかを見る
      if (b.t === 'data') {
        const rows = dataRows(b.id);
        return rows.length === 0 || rows.some(r => !body.includes(r[0]) || !body.includes(r[1]));
      }
      return !body.includes(b.text);
    });
    if (missing || !body.includes(topic.assistant)) bodyNg.push(`${cat.id}/${topic.id}`);
  }
}
const topicCount = HELP_GUIDE.reduce((s, c) => s + c.topics.length, 0);
check('全項目の本文が最後まで描ける', bodyNg.length === 0, bodyNg.length ? bodyNg.join(', ') : `${topicCount}項目`);

// 以前「難易度が3つしか載っていない」状態だったので、実データの全件が描かれることを名指しで見る
const diffBody = text(render({ helpCatId: 'basics', helpTopicId: 'difficulty' }));
check('難易度は実データの全段階が本文に出る', dataRows('difficulties').every(r => diffBody.includes(r[0]) && diffBody.includes(r[1])), `${dataRows('difficulties').length}段階`);

// --- 助手(ナビゲーター) ---
const withBubble = render({ helpCatId: 'battle', helpTopicId: 'distance' });
check('助手の名前が吹き出しに出る', text(withBubble).includes('みゅあ'));
check('助手のセリフが出る', text(withBubble).includes(helpTopicById('battle','distance').assistant));
// 表情ごとの顔アイコン(images/assistant/face/myua_<表情>.PNG)が使われる
check('助手の画像が表情つきで出る', /images\/assistant\/face\/myua_[a-z]+\.PNG/.test(withBubble), (withBubble.match(/images\/assistant\/face\/myua_[a-z]+\.PNG/)||['見つからず'])[0]);
check('吹き出しは詳細を開けることが分かる', text(withBubble).includes('タップで詳しく') && withBubble.includes('aria-label="みゅあの説明を開く"'));
const hubBubble = text(render({}));
check('カテゴリ一覧では場面(helpTop)のセリフを話す', HELP_TOP_LINES.some(t => hubBubble.includes(t)));
const catBubble = text(render({ helpCatId: 'battle' }));
check('カテゴリでは中身の案内を詳細に出せる', catBubble.includes('タップで詳しく'));

// タップで開く詳細。defaultOpen で開いた状態を作って中身を確かめる
const openedTopic = text(ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.AssistantBubble, { helpRef:'battle/distance', line:'テスト', defaultOpen:true })));
const distance = helpTopicById('battle','distance');
check('吹き出しをタップするとヘルプ本文が詳細として開く',
  distance.blocks.every(b => b.t !== 'p' || openedTopic.includes(b.text)) && openedTopic.includes('とじる'));
const openedDetail = text(ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.AssistantBubble, { line:'テスト', detail:['詳しい説明1','詳しい説明2'], defaultOpen:true })));
check('自前の文章も詳細として開ける', openedDetail.includes('詳しい説明1') && openedDetail.includes('詳しい説明2'));
const openedScene = text(ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.AssistantBubble, { scene:'helpTop', defaultOpen:true })));
check('場面キーだけで吹き出しと詳細が出せる', openedScene.includes('みゅあ') && openedScene.includes('3段階'));
const noDetail = ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.AssistantBubble, { line:'ひとことだけ' }));
// 顔は常にタップできる(次のセリフへ送るため)ので、見るのは吹き出し側だけ
check('詳細が無いときは吹き出しをタップできる見た目にしない',
  !text(noDetail).includes('タップで詳しく') && !noDetail.includes('の説明を開く'));
check('顔はいつでもタップして話しかけられる', noDetail.includes('にはなしかける'));

// --- 助手の開閉と、最後の項目 ---
const closed = text(render({ helpCatId: 'battle', helpAssistantOpen: false }));
check('助手を閉じるとひとことが消える', !closed.includes(HELP_GUIDE[1].assistant) && closed.includes(HELP_GUIDE[1].topics[0].title));
const lastCat = HELP_GUIDE[0];
const lastTopic = lastCat.topics[lastCat.topics.length - 1];
check('最後の項目では「次:」を出さない', !text(render({ helpCatId: lastCat.id, helpTopicId: lastTopic.id })).includes('次: '));
check('途中の項目では次の項目名を出す', text(render({ helpCatId: lastCat.id, helpTopicId: lastCat.topics[0].id })).includes(`次: ${lastCat.topics[1].title}`));

// --- 読み込めなかったときも落ちない ---
const emptyTransformed = babel.transformSync(
  `${dataTablePrelude}\n` +
  'const HELP_GUIDE = [];\nconst HELP_GUIDE_INTRO = "";\n' +
  'const helpCategoryById = () => null;\nconst helpTopicById = () => null;\n' +
  'const HelpScreen = ({ showHelp, helpCatId, helpTopicId, helpAssistantOpen, setShowHelp, setHelpCatId, setHelpTopicId, setHelpAssistantOpen,\n' +
  '  ArrowLeft, ChevronRight, getDebugEnemyOptions, difficulty, setDebugEnemyKey, debugBattleRef, setDebugBattle, setDebugOutcome, setGameState }) => (<>\n' +
  helpJsx + '\n</>);\nmodule.exports = { HelpScreen };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'help-empty-check.jsx' }
);
const emptyScope = { exports: {} };
new Function('module', 'exports', 'React', emptyTransformed.code)(emptyScope, emptyScope.exports, React);
const emptyHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(emptyScope.exports.HelpScreen, {
  showHelp: true, helpCatId: null, helpTopicId: null, helpAssistantOpen: true,
  setShowHelp: noop, setHelpCatId: noop, setHelpTopicId: noop, setHelpAssistantOpen: noop,
  ArrowLeft: stubIcon, ChevronRight: stubIcon,
  getDebugEnemyOptions: () => [], difficulty: 'Normal',
  setDebugEnemyKey: noop, debugBattleRef: { current:false }, setDebugBattle: noop, setDebugOutcome: noop, setGameState: noop,
}));
check('ヘルプの中身が読めなくても落ちず、案内を出す', text(emptyHtml).includes('ヘルプの内容を読み込めませんでした'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
