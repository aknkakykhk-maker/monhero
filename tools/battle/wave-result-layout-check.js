// WAVEリザルト画面が、背の低い端末でも「次のWAVEへ」に必ず届くかを実ブラウザで測る。
//
// 【なぜ道具にするか】
// この画面は外枠が justify-center + overflow-hidden で、中身は全部 shrink-0 だった。
// flexの中央そろえは、あふれたぶんを上下へ均等にはみ出させる。下へはみ出したボタンは
// スクロールもできない(overflow-hidden)ため、内訳が長くなるWAVE後半では
// 「次のWAVEへ」が押せず周回を続けられなくなる。320x568(iPhone SE 第1世代/5s)で
// ボタン下端が画面より24px下に出ることを実測して確認した不具合。
//
// 同じ形の不具合はリザルト画面(masu-register-check.js)と供モン合流画面でも出しており、
// 「あふれる可能性のある領域を justify-center で中央そろえする」のが共通の原因。
// ここでは本体のJSXをそのまま切り出して実際に描き、
//   ・内訳がいちばん多い状態でもボタンが画面内に収まるか
//   ・あふれたぶんをスクロールで追えるか
//   ・収まっているときは今までどおり中央に寄るか
// を数値で見る。
//
//   node tools/battle/wave-result-layout-check.js
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const { chromium } = require('playwright');
const { REPO_ROOT, GAME_SYSTEM } = require('../harness');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const whole = fs.readFileSync(GAME_SYSTEM, 'utf8');

// --- ① 静的な確認: あふれる領域を中央そろえのまま放置していないか ---
const marker = whole.indexOf("gameState==='WAVE_RESULT'");
if (marker < 0) { console.error('NG: WAVE_RESULT の画面が見つかりませんでした'); process.exit(1); }
const from = whole.indexOf('<div style={{position:"absolute"', marker);
const to = whole.indexOf('\n', whole.indexOf('{handleNextWave', from)) + 1;
const block = whole.slice(from, to) + '        </div>';
check('見出しと内訳をスクロールできる入れ物にまとめている',
  block.includes('min-h-0 flex flex-col items-center overflow-y-auto mh-scroll'));
check('ボタンは縮まないので必ず画面内に残る', /shrink-0[^"`]*`}[^]{0,200}次へ進む|shrink-0/.test(block.slice(block.indexOf('{handleNextWave'))));

// --- ② 実ブラウザで測る ---
const app = `
const Trophy = ({className,size}) => <span className={className} style={{fontSize:size,display:'block'}}>T</span>;
const ChevronRight = ({className,size}) => <span className={className} style={{fontSize:size}}>></span>;
const Loader2 = ({className,size}) => <span className={className} style={{fontSize:size}}>o</span>;
const isQuickMode = () => QUICK;
const battleTutorialSpotClass = () => '';
const handleNextWave = () => {};
function Screen({ waveResult, slots, distAptPct, runMode, extremeRun, extremeDifficulty, difficulty, scoreMultiplier, runFinalizing }) {
  return (
${block}
  );
}
const SLOTS = [{emoji:'a'},{emoji:'b'},{emoji:'c'},{emoji:'d'}];
// 内訳がいちばん多くなる状態(距離別4種・ULTIMATE警告・自動回復補正・全WAVE累計・スコア内訳)
const FULL = { wave:9, turn:18, totalTurnCount:142, pendingUltimateDistanceBreak:true,
  totalDamage:1234567, totalAllDamage:98765432,
  distDamage:[123456,234567,345678,456789], totalDistDamage:[1234567,2345678,3456789,4567890],
  gainedDistBonus:[0.125,0.238,0.341,0.452], newDistBonus:[1.234,2.345,3.456,4.567],
  recoveryDelta:12.5, totalRecoveryDelta:45.5, waveMult:4.5, turnMult:2.25, remainingTurns:12,
  roundScore:12345678, totalScore:987654321 };
// 内訳がいちばん少ない状態(WAVE1)
const MIN = { wave:1, turn:5, totalTurnCount:5, totalDamage:1200, totalAllDamage:null, distDamage:null,
  recoveryDelta:null, totalRecoveryDelta:null, waveMult:1, turnMult:1, remainingTurns:3,
  roundScore:1200, totalScore:1200 };
const CASES = {
  full: { waveResult:FULL, slots:SLOTS, distAptPct:[0.15,0.25,0.35,0.45], runMode:'challenge', extremeRun:true,  extremeDifficulty:'ULTIMATE', difficulty:'Legend', scoreMultiplier:12, runFinalizing:false },
  min:  { waveResult:MIN,  slots:SLOTS, distAptPct:[0,0,0,0],             runMode:'challenge', extremeRun:false, extremeDifficulty:null,       difficulty:'Normal', scoreMultiplier:1,  runFinalizing:false },
};
const which = new URLSearchParams(location.search).get('c') || 'full';
var QUICK = false;
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Screen, CASES[which]));
`;

const out = babel.transformSync(app, {
  presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
  filename: 'wave-result.jsx', babelrc: false, configFile: false,
});

const dir = path.join(TOOLS_DIR, 'out', 'wave-result-layout');
fs.mkdirSync(dir, { recursive: true });
const vendor = path.join(REPO_ROOT, 'monster-hero', 'vendor');
fs.copyFileSync(path.join(vendor, 'react.production.min.js'), path.join(dir, 'react.js'));
fs.copyFileSync(path.join(vendor, 'react-dom.production.min.js'), path.join(dir, 'react-dom.js'));
fs.writeFileSync(path.join(dir, 'app.js'), out.code);

// Tailwind CDN はこのサンドボックスで読めないため、この画面が使う分だけ手で再現する。
// 高さに効くもの(flex・shrink・min-h-0・overflow・余白・文字サイズ)を漏らさないこと
fs.writeFileSync(path.join(dir, 'shim.css'), `*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;height:100%}
#root{position:relative;height:100vh}
.absolute{position:absolute}.inset-0{inset:0}.relative{position:relative}
.flex{display:flex}.flex-col{flex-direction:column}.grid{display:grid}
.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.items-center{align-items:center}.items-end{align-items:flex-end}.items-baseline{align-items:baseline}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}
.shrink-0{flex-shrink:0}.flex-1{flex:1 1 0%}.min-h-0{min-height:0}.m-auto{margin:auto}
.w-full{width:100%}.max-w-sm{max-width:24rem}.max-w-xs{max-width:20rem}.mx-auto{margin-left:auto;margin-right:auto}
.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}
.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}
.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-0\\.5{gap:.125rem}.space-y-1\\.5>*+*{margin-top:.375rem}
.p-3{padding:.75rem}.px-2{padding-left:.5rem;padding-right:.5rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}
.py-3{padding-top:.75rem;padding-bottom:.75rem}.pt-1{padding-top:.25rem}.pt-2{padding-top:.5rem}
.pb-0\\.5{padding-bottom:.125rem}.pb-1{padding-bottom:.25rem}.pb-1\\.5{padding-bottom:.375rem}
.mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mt-2{margin-top:.5rem}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border-width:1px;border-style:solid}.border-t{border-top-width:1px;border-top-style:solid}
.border-b{border-bottom-width:1px;border-bottom-style:solid}
.border-white\\/5{border-color:rgba(255,255,255,.05)}.border-white\\/10{border-color:rgba(255,255,255,.1)}
.border-white\\/20{border-color:rgba(255,255,255,.2)}.border-slate-800{border-color:#1e293b}
.border-indigo-400\\/20{border-color:rgba(129,140,248,.2)}.border-indigo-400\\/50{border-color:rgba(129,140,248,.5)}
.border-red-400\\/60{border-color:rgba(248,113,113,.6)}
.bg-slate-900{background:#0f172a}.bg-black\\/25{background:rgba(0,0,0,.25)}.bg-black\\/40{background:rgba(0,0,0,.4)}
.bg-indigo-950\\/60{background:rgba(30,27,75,.6)}.bg-indigo-600\\/40{background:rgba(79,70,229,.4)}
.bg-purple-950\\/80{background:rgba(59,7,100,.8)}
.leading-none{line-height:1}.font-mono{font-family:ui-monospace,monospace}
.font-bold{font-weight:700}.font-black{font-weight:900}.italic{font-style:italic}
.uppercase{text-transform:uppercase}.tracking-widest{letter-spacing:.1em}.tracking-tighter{letter-spacing:-.05em}
.text-\\[9px\\]{font-size:9px}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}
.text-sm{font-size:.875rem}.text-base{font-size:1rem}.text-lg{font-size:1.125rem}.text-xl{font-size:1.25rem}
.object-contain{object-fit:contain}button{border:0;background:#fff;color:#000}`);
fs.writeFileSync(path.join(dir, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="shim.css"></head><body><div id="root"></div>
<script src="react.js"></script><script src="react-dom.js"></script><script src="app.js"></script></body></html>`);

// 画面の大きさ。320x568 は iPhone SE(第1世代)/5s で、この不具合が実際に出ていた大きさ
const VIEWPORTS = [
  ['iPhone SE(第1世代)/5s 320x568', 320, 568],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 14 Pro 393x852', 393, 852],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [label, width, height] of VIEWPORTS) {
    for (const [key, caseLabel] of [['full', '内訳が最も多いとき'], ['min', '内訳が最も少ないとき']]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('file://' + path.join(dir, 'index.html') + '?c=' + key);
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const root = document.querySelector('#root > div');
        const btn = document.querySelector('button');
        const area = root && root.querySelector('.overflow-y-auto');
        if (!root || !btn) return null;
        const rb = btn.getBoundingClientRect();
        const first = root.children[0].getBoundingClientRect();
        return {
          viewport: window.innerHeight,
          btnTop: Math.round(rb.top), btnBottom: Math.round(rb.bottom), btnHeight: Math.round(rb.height),
          firstTop: Math.round(first.top),
          hasArea: !!area,
          areaScrolls: area ? area.scrollHeight > area.clientHeight + 1 : false,
          rootScrolls: root.scrollHeight > root.clientHeight + 1,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      const where = `${label} / ${caseLabel}`;
      if (!r) { check(`${where}: 画面を描ける`, false); await page.close(); continue; }
      check(`${where}: 「次へ進む」が画面内にある`, r.btnBottom <= r.viewport && r.btnTop >= 0,
        `ボタン ${r.btnTop}〜${r.btnBottom}px / 画面 ${r.viewport}px`);
      check(`${where}: 先頭が画面の上へはみ出していない`, r.firstTop >= 0, `先頭 ${r.firstTop}px`);
      check(`${where}: ボタンが指で押せる高さ`, r.btnHeight >= 44, `${r.btnHeight}px`);
      check(`${where}: 横へはみ出していない`, !r.overflowX);
      if (r.rootScrolls) check(`${where}: 外枠ごとあふれていない`, false, '外枠が縦にあふれている');
      if (errors.length) check(`${where}: JSエラーが出ない`, false, errors.join(' / '));
      // いちばん狭い端末で内訳が最も多いときは、あふれたぶんをスクロールで追えること
      if (width === 320 && key === 'full') {
        check(`${where}: あふれたぶんをスクロールで追える`, r.hasArea && r.areaScrolls,
          r.hasArea ? (r.areaScrolls ? 'スクロールできる' : 'そもそも収まっている') : 'スクロールできる場所が無い');
      }
      await page.close();
    }
  }
  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
