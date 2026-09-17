const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// イベント会話(回想・本編)の「スキップ」が、実際のブラウザで押せるかを確かめる。
//
//   node tools/boot/event-replay-tap-check.js
//
// 2026-09-17・ユーザー報告「イベント中のスキップを押してもスキップ出来ない/次のセリフへ進むだけ」。
// 原因は当たり判定だった。会話の紙(パネル)を pointerEvents:'none' にして、
// ボタン列だけ 'auto' で切り抜いていたため、「スキップ」を押しても背面の
// “画面全体＝次へ”ボタンへ抜けてしまう端末があった。見た目は正しく、
// ソースを読んでも気づけない類なので、**実際に押して確かめる**検査を置く。
//
// 見るのは3つだけ。
//   ① スキップの位置の当たり判定が、スキップ自身であること(背面へ抜けていない)
//   ② 押したら会話が閉じること(1枚進むだけになっていない)
//   ③ 紙の本文をタップしたときは、これまでどおり1枚進むこと
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const OUT = path.join(root, '.tmp-event-replay-tap');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const START = '      {eventReplay!=null&&(()=>{';
const END = '      {dailyMasuAdvice&&(()=>{';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (!(from >= 0 && to > from)) { console.log('NG: 再生画面のJSXを切り出せない'); process.exit(1); }
const replayBlock = source.slice(from, to);
// 説明のコメントにも同じ言葉が出るので、見るのは中身だけにする
const replayCode = replayBlock.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

// --- ソースの決まりごと(実ブラウザが無い環境でもここまでは見る) ---
check('会話の紙はタップを受け取る側にしてある(pointerEvents:none で切り抜かない)',
  !/pointerEvents:'none'/.test(replayCode));
check('重なり順を z-index で明示している(描画順まかせにしない)',
  /pointerEvents:'auto',zIndex:1/.test(replayCode) && /pointerEvents:'auto',zIndex:2/.test(replayCode));
check('ボタンは紙の「どこでも次へ」を止めてから動く(stopPropagation)',
  /onClick=\{\(e\)=>\{e\.stopPropagation\(\);skip\(\);\}\}/.test(replayCode)
    && /onClick=\{\(e\)=>\{e\.stopPropagation\(\);next\(\);\}\}/.test(replayCode));

let playwright;
try { playwright = require('playwright'); }
catch { console.log('SKIP: playwright が入っていないので、実際に押す確認はできません'); process.exit(failed ? 1 : 0); }

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__e={EVENT_REPLAYS};`, ctx);
const list = ctx.__e.EVENT_REPLAYS;
// いちばん長い会話(＝スキップを押したくなる会話)で見る
const target = list.slice().sort((a, b) => b.script.length - a.script.length)[0];

const app = `
const {useState}=React;
const FACE='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const AssistantFace=({who,size})=>React.createElement('img',{src:FACE,style:{width:size,height:size,borderRadius:8,background:'#334155'}});
const ASSISTANT_LIST=ASSISTANTS;
const assistantById=(id)=>ASSISTANTS.find(x=>x.id===id)||ASSISTANTS[0];
const normalizeAssistantBond=()=>({points:0});
const assistantBonds={},assistantCallStyles={};
const assistantSpeakText=(t)=>t; const assistantBondLevelOf=()=>1; const breederName='ブリーダー';
const RHYTHM_EVENT_STORY_IDS=[${JSON.stringify(target.id)}];
window.__seen=[]; const markRhythmEventStorySeen=(id)=>{window.__seen.push(id);};
const markMomosukeIntroSeen=()=>{};
function Screen(){
  const [eventReplay,setEventReplay]=useState({id:${JSON.stringify(target.id)},step:0,live:true});
  window.__state=eventReplay;
  return (<>
${replayBlock}
</>);
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Screen));
`;
const code = babel.transformSync(app, { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'tap.jsx' }).code;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'app.js'), code);
fs.writeFileSync(path.join(OUT, 'assistants.js'), `${assistantsSrc}\n;window.EVENT_REPLAYS=EVENT_REPLAYS;window.ASSISTANTS=ASSISTANTS;`);
fs.writeFileSync(path.join(OUT, 'style.css'), `${fs.readFileSync(path.join(root, 'monster-hero/tailwind.css'), 'utf8')}\nhtml,body{margin:0;background:#020617}`);
fs.copyFileSync(path.join(root, 'monster-hero/vendor/react.production.min.js'), path.join(OUT, 'react.js'));
fs.copyFileSync(path.join(root, 'monster-hero/vendor/react-dom.production.min.js'), path.join(OUT, 'react-dom.js'));
fs.writeFileSync(path.join(OUT, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div>
<script src="react.js"></script><script src="react-dom.js"></script><script src="assistants.js"></script><script src="app.js"></script></body></html>`);

const skipBox = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'スキップ');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  const hit = document.elementFromPoint(x, y);
  return { x, y, isSelf: hit === b || b.contains(hit), hitText: hit ? (hit.getAttribute('aria-label') || (hit.textContent || '').trim().slice(0, 12)) : 'なし' };
});

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // 実機に近い形(タッチのある小さめの画面)で見る
    for (const [w, h] of [[360, 640], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      await page.goto(`file://${path.join(OUT, 'index.html')}`);
      await page.evaluate(() => document.documentElement.style.setProperty('--mh-vh', `${window.innerHeight}px`));
      await page.waitForTimeout(300);

      const box = await skipBox(page);
      check(`${w}x${h}: スキップの当たり判定がスキップ自身になっている`,
        !!box && box.isSelf, box ? `いちばん上にあるのは「${box.hitText}」` : 'スキップが無い');

      // ③ 紙の本文をタップ → 1枚進む(これまでどおり)
      const body = await page.evaluate(() => {
        const p = [...document.querySelectorAll('[role="dialog"] p')].find(x => /\d+ \/ \d+/.test(x.textContent || ''));
        const r = (p || document.querySelector('[role="dialog"] > div:last-child')).getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      });
      await page.touchscreen.tap(body.x, body.y);
      await page.waitForTimeout(200);
      const afterBody = await page.evaluate(() => window.__state && window.__state.step);
      check(`${w}x${h}: 本文をタップすると1枚進む`, afterBody === 1, `step=${afterBody}`);

      // ② スキップを押す → 会話が閉じる(進むだけになっていない)
      const box2 = await skipBox(page);
      if (box2) await page.touchscreen.tap(box2.x, box2.y);
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => ({ state: window.__state, seen: window.__seen, dialogs: document.querySelectorAll('[role="dialog"]').length }));
      check(`${w}x${h}: スキップを押すと会話が閉じる`, after.state === null && after.dialogs === 0,
        after.state ? `${after.state.step + 1}枚目のまま` : `残り${after.dialogs}枚`);
      check(`${w}x${h}: 本編で飛ばしたぶんは「見た」として残る`,
        Array.isArray(after.seen) && after.seen.includes(target.id), JSON.stringify(after.seen));
      await page.close();
    }
  } finally {
    await browser.close();
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
