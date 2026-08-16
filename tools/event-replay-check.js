// イベント回想(プロフィールから、見たことのある会話イベントを何度でも見返す機能)を確認する。
//
//   node tools/event-replay-check.js
//
// とくに気をつけている点:
//   ・共通のデータ構造(EVENT_REPLAYS)になっていて、きき専用の再生ボタンを直接増やしただけになっていないか
//   ・台本(script)が既存のASSISTANT_KIKI_INTROをそのまま参照していて、二重定義していないか
//   ・未閲覧のイベントはロック表示になり、再生できないか
//   ・再生(何度でも)しても、初回閲覧フラグ・助手選択・仲良し度のどれも変えないか
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(__dirname, '..');
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

// --- データ構造 ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__e={EVENT_REPLAYS,ASSISTANT_KIKI_INTRO,ASSISTANT_KIKI_INTRO_CALLS,ASSISTANTS,ASSISTANT_EXPRESSIONS,assistantFaceImage};`, ctx);
const { EVENT_REPLAYS: list, ASSISTANT_KIKI_INTRO: kikiScript, ASSISTANT_KIKI_INTRO_CALLS: kikiCalls, ASSISTANTS, ASSISTANT_EXPRESSIONS, assistantFaceImage } = ctx.__e;

check('共通のイベント回想一覧がデータで持たれている', Array.isArray(list) && list.length >= 1, `${list ? list.length : 0}件`);
check('各イベントがid・タイトル・台本・解放判定の呼び名を持つ',
  Array.isArray(list) && list.every(ev => ev.id && ev.title && Array.isArray(ev.script) && ev.script.length > 0 && ev.unlockedKey));

const kikiEvent = Array.isArray(list) ? list.find(ev => ev.id === 'kiki_intro') : null;
check('最初の登録イベントがきき加入イベント', !!kikiEvent);
check('タイトルが指定どおり', kikiEvent && kikiEvent.title === 'きき加入 ～ふたりの助手～', kikiEvent && kikiEvent.title);
// ★台本を二重に持たない。ASSISTANT_KIKI_INTROと同じ配列(参照)を使っていること
check('台本はASSISTANT_KIKI_INTROをそのまま参照している(二重定義していない)',
  kikiEvent && kikiEvent.script === kikiScript);
check('呼び名(calls)もASSISTANT_KIKI_INTRO_CALLSをそのまま参照している',
  kikiEvent && kikiEvent.calls === kikiCalls);
check('解放判定の呼び名がkikiIntroSeen(既存の既読フラグ)を指している',
  kikiEvent && kikiEvent.unlockedKey === 'kikiIntroSeen');

// --- 解放判定(画面側) ---
check('きき加入の既読フラグを読み取り専用ミラーで持っている',
  has('const [kikiIntroSeenFlag, setKikiIntroSeenFlag] = useState(false);'));
check('会話を見た瞬間にミラーも更新する',
  has('setKikiIntroSeenFlag(kikiIntroSeen === true);')
    && has('storeSet(KIKI_INTRO_SEEN_KEY, true, false); setKikiIntroSeenFlag(true);')
    && has('const markKikiIntroSeen = useCallback(() => {\n    setKikiIntroStep(null);\n    setKikiIntroSeenFlag(true);'));
check('解放判定は呼び名→state の対応表を通す(今後のイベントも1行足すだけでよい形)',
  has('const EVENT_REPLAY_UNLOCK_FLAGS = { kikiIntroSeen: kikiIntroSeenFlag };')
    && has('const isEventReplayUnlocked = (event) => !!EVENT_REPLAY_UNLOCK_FLAGS[event && event.unlockedKey];'));

// --- プロフィール画面の入口 ---
check('プロフィールに「イベント回想」の入口がある',
  has("<b className=\"block text-[11px] font-black text-fuchsia-100\">イベント回想</b>")
    && has('onClick={()=>setShowEventReplayList(true)}'));

// --- 一覧(ロック表示) ---
check('未閲覧は「？？？」でロック表示になる(タップできない)', (() => {
  const at = source.indexOf('{showEventReplayList&&(');
  if (at < 0) return false;
  const end = source.indexOf('{showIconPicker&&(', at);
  const block = source.slice(at, end);
  if (!(block.includes('？？？') && block.includes('まだ見ていません') && block.includes('if(!eventUnlocked){'))) return false;
  // ロック表示のdivブロックだけを取り出し、そこにonClick(=再生できてしまう)が無いことを確かめる
  const lockAt = block.indexOf('if(!eventUnlocked){');
  const lockEnd = block.indexOf('return (', lockAt) >= 0 ? block.indexOf('}\n', block.indexOf('まだ見ていません', lockAt)) : -1;
  const lockBlock = lockEnd > lockAt ? block.slice(lockAt, lockEnd) : block.slice(lockAt, lockAt + 400);
  return !lockBlock.includes('onClick');
})());

// --- 再生画面のJSXを取り出して確認 ---
const START = '      {eventReplay!=null&&(()=>{';
const END = '      {dailyMasuAdvice&&(()=>{';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
check('再生画面のJSXを切り出せる', from >= 0 && to > from);

let replayBlock = '';
if (from >= 0 && to > from) {
  replayBlock = source.slice(from, to);

  // ★見るだけ。保存に触れる関数を一切呼んでいないこと
  check('再生しても初回閲覧フラグを書き換えない(markKikiIntroSeen等を呼ばない)',
    !/markKikiIntroSeen|storeSet\s*\(/.test(replayBlock));
  check('再生しても助手選択を変えない',
    !/chooseAssistant|setSelectedAssistantId|ASSISTANT_SELECTED_KEY/.test(replayBlock));
  check('再生しても仲良し度を動かさない',
    !/addAssistantBond|setAssistantBonds|assistantBondKeyFor/.test(replayBlock));
  check('再生しても通常のアップデート通知(updateGuideQueue等)に触れない',
    !/updateGuideQueue|finishUpdateGuide/.test(replayBlock));
  check('閉じる操作はeventReplayをnullに戻すだけ',
    replayBlock.includes('setEventReplay(null)'));

  const AssistantFace = ({ who, size, expression }) => React.createElement('img', {
    'data-face': who && who.id, 'data-size': size, 'data-expression': expression,
    alt: who && who.name, src: assistantFaceImage(who, expression),
  });
  const transformed = babel.transformSync(
    'const Screen = ({ eventReplay, setEventReplay, EVENT_REPLAYS, ASSISTANT_LIST, assistantById, AssistantFace }) => (<>\n'
    + replayBlock + '\n</>);\nmodule.exports = { Screen };',
    { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'event-replay-check.jsx' });
  const moduleScope = { exports: {} };
  new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
  const render = (step) => ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.Screen, {
    eventReplay: { id: 'kiki_intro', step },
    setEventReplay: () => {},
    EVENT_REPLAYS: list,
    ASSISTANT_LIST: ASSISTANTS,
    assistantById: (id) => ASSISTANTS.find(x => x.id === id) || ASSISTANTS[0],
    AssistantFace,
  }));
  const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const first = render(0);
  check('再生画面が落ちずに描ける', first.length > 0);
  check('タイトルが表示される', text(first).includes(kikiEvent.title));
  check('発言者の名前が出る', text(first).includes(ASSISTANTS.find(a => a.id === kikiScript[0].who).name));
  check('発言者に合わせた顔と表情が出る',
    first.includes(`data-face="${kikiScript[0].who}"`) && first.includes(`data-expression="${kikiScript[0].e}"`));
  check('話していないほうの助手も並ぶ', ASSISTANTS.every(w => first.includes(`data-face="${w.id}"`)));
  check('タップで次へ進める', /aria-label="次へ"/.test(first) && /つぎへ/.test(text(first)));
  check('どのセリフでも発言者と顔が一致する(何度描画しても同じ)', kikiScript.every((l, i) => {
    const html = render(i);
    return html.includes(`data-face="${l.who}"`) && html.includes(`data-expression="${l.e}"`)
      && text(html).includes(l.t.replace(/\s+/g, ' '));
  }));
  const lastHtml = render(kikiScript.length - 1);
  check('最後は「とじる」で終わる', /とじる/.test(text(lastHtml)));
  check('進み具合が分かる', /1 \/ /.test(text(first)));
  check('縦画面で見切れない作りになっている',
    /max-h-\[calc\(100dvh-env\(safe-area-inset-top\)\)\]/.test(first)
      && /overflow-y-auto/.test(first)
      && /env\(safe-area-inset-bottom\)/.test(first));
  // 何度でも同じ内容で再生できる(状態が壊れて変な表示にならない)
  check('同じstepなら何度描画しても同じ内容になる(回数で状態が変わらない)',
    render(1) === render(1) && render(1) === render(1));
}

// --- 更新履歴とヘルプ ---
check('更新履歴に書いてある', /イベント回想/.test(changelogSrc));
check('ヘルプに書いてある', /イベント回想/.test(helpSrc));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
