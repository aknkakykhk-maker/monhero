require('../shared-serve'); // :8899 が無ければ立てる
// 結果画面の大きなスコアが、枠の右からはみ出さないことを実ブラウザで確かめる(2026-11-14 追跡表 r1114-090)。
//
//   node tools/ui/result-score-fit-check.js            ... 確かめる
//   node tools/ui/result-score-fit-check.js --shots <フォルダ>  ... 止め絵も書き出す
//
// 【背景】Android の縦画面で、優勝の結果画面のスコア「23,365,084,358,63…」(17桁)が枠の右から画面の外まで出ていた。
// 直し方: 数字の入れ物 FitNumber(41-screen-ui.jsx)が、最後に出る文字の幅から字の大きさを枠に合わせて縮める。
// 【確かめ方】本物の部品(FitNumber・TrainingCountUp)と、本物の結果画面の枠のJSX(68-screen-run-result.jsx)を
// そのまま取り出し、本物のCSS(monster-hero/tailwind.css)で、いろいろな桁数・幅で組んで測る。
const fs = require('fs');
const os = require('os');
const path = require('path');
const babel = require(path.join(__dirname, '../node_modules/@babel/core'));
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const parts = path.join(root, 'monster-hero/src/parts');
const ui = fs.readFileSync(path.join(parts, '41-screen-ui.jsx'), 'utf8');
const run = fs.readFileSync(path.join(parts, '68-screen-run-result.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- 本物のソースから取り出す ----
const cut = (src, from, to) => { const a = src.indexOf(from); if (a < 0) return ''; const b = src.indexOf(to, a); return b < 0 ? '' : src.slice(a, b); };
const fitSrc = cut(ui, 'const FitNumber =', '// 「いくつから いくつへ」の1項目。');
const countSrc = cut(ui, 'const TrainingCountUp =', '// 「いくつから いくつへ」の1項目。').split('const FitNumber =')[0];
check('FitNumber の本体を取り出せた', fitSrc.length > 200);
check('TrainingCountUp の本体を取り出せた', countSrc.length > 200);

// 最終リザルト3画面(優勝・敗北・リタイア)のスコア枠のJSX
const boxes = [...run.matchAll(/\{!isQuickMode\(runMode\)&&(<div className="mh-end-score.*?<\/FitNumber><\/div><\/div>)\}/g)].map(m => m[1]);
check('最終リザルトのスコア枠(優勝・敗北・リタイア)の3つとも FitNumber で包んである', boxes.length === 3, `${boxes.length}か所`);
// WAVE結果の獲得スコア・累計スコアの行
const rows = [...run.matchAll(/(<span className="[^"]*min-w-0 flex-1[^"]*"><FitNumber finalText=\{Number\(waveResult\.\w+\)\.toLocaleString\(\)\}.*?<\/FitNumber><\/span>)/g)].map(m => m[1]);
check('WAVE結果の獲得スコア・累計スコアの2行も FitNumber で包んである', rows.length === 2, `${rows.length}か所`);
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const names = ['優勝(CHAMPION)', '敗北', 'リタイア'];
const heads = [
  '<h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1>',
  '<h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2>',
  '<h2 className="text-2xl font-black italic text-white uppercase">リタイア</h2>',
];
const shell = [
  'p-6 text-center', // 優勝は画面の余白 p-6 の中
  'p-0 text-center',
  'p-0 text-center',
];
const jsx = `
const isQuickMode = () => false;
const runMode = 'normal';
${countSrc}
${process.env.FIT_OFF ? 'const FitNumber = ({children, style}) => <div data-fit-number style={style||undefined}><div data-fit-number-inner>{children}</div></div>;' : fitSrc}
const Page = ({ score, which }) => {
  const V = [
${boxes.map((b, i) => `    <div className="flex flex-col items-center ${shell[i]}" style={{background:'#111'}}>${heads[i]}${b}</div>`).join(',\n')}
  ];
  const waveResult = { roundScore: Math.floor(score / 3), totalScore: score };
  return <div id="stage" style={{width:'100%'}}>
    {V[which]}
    {which === 0 && <div id="waveRows" className="w-full max-w-xs mx-auto mt-3 p-3 bg-black/60 rounded-2xl"><div className="pt-1 flex flex-col gap-0.5 text-right"><div className="flex justify-between items-end"><span className="text-indigo-400 text-xs font-black uppercase">獲得スコア</span>${rows[0]}</div></div><div className="pt-1 flex justify-between items-end border-t border-white/20"><span className="text-amber-500 text-[11px] font-black uppercase">累計スコア</span>${rows[1]}</div></div>}
  </div>;
};
window.__mount = (score, which) => {
  const el = document.getElementById('root');
  ReactDOM.unmountComponentAtNode(el);
  ReactDOM.render(<Page score={score} which={which}/>, el);
};
`;
const out = babel.transformSync(jsx, { presets: [], plugins: [[path.join(__dirname, '../node_modules/@babel/plugin-transform-react-jsx'), { runtime: 'classic' }]], configFile: false, babelrc: false }).code;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitcheck-'));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="file://${root}/monster-hero/tailwind.css">
<style>html,body{margin:0;background:#78350f;color:#fff}</style></head><body><div id="root"></div>
<script src="file://${root}/monster-hero/vendor/react.production.min.js"></script>
<script src="file://${root}/monster-hero/vendor/react-dom.production.min.js"></script>
<script>${out}</script></body></html>`;
const htmlPath = path.join(dir, 'index.html');
fs.writeFileSync(htmlPath, html);


// ---- 結果画面まるごと(背景・王冠・CHAMPION・枠・下のボタンまで)。本物の ChampionScreen / GameOverScreen / GaveUpScreen を置く ----
const boot = fs.readFileSync(path.join(parts, '70-bootstrap.jsx'), 'utf8');
const core = fs.readFileSync(path.join(parts, '10-core.jsx'), 'utf8');
const screensSrc = cut(run, 'function ChampionScreen({', 'function MasuRegisterModal({');
check('本物の結果画面3つ(優勝・敗北・リタイア)を取り出せた', /function GameOverScreen/.test(screensSrc) && /function GaveUpScreen/.test(screensSrc));
const iconSrc = cut(core, 'const _ICON_PATHS = {', 'const Heart=_icon');
const confettiSrc = cut(ui, 'const EndConfetti =', '// ==== クイックの成長・合流の1行');
const cssLines = boot.split('\n').slice(4699, 5110).filter(l => /mh-end-|mh-game-over|mh-confetti|mhEnd|mhConf|mhPhasePop/.test(l)).join('\n');
const fullJsx = `
const isQuickMode = () => false;
${iconSrc}
const Crown=_icon('Crown'), Skull=_icon('Skull'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw');
const AssistantBubble = () => <div className="w-full max-w-xs mx-auto rounded-xl bg-black/40 text-white text-xs p-2">みゅあの吹き出し(仮の枠)</div>;
const RewardSummaryCard = () => <div className="w-full max-w-xs rounded-2xl bg-black/30 text-white text-xs p-3 mt-2">もらった物の一覧(仮の枠)</div>;
const RankingFailedNote = () => null;
${countSrc}
${fitSrc}
${confettiSrc}
${screensSrc}
const noop = () => {};
window.__mountFull = (score, which) => {
  const el = document.getElementById('root');
  ReactDOM.unmountComponentAtNode(el);
  const common = { finalRewardSummary: {}, masuRegisterButtonNode: () => null, resultActionPending: false, returnToHome: noop, runMode: 'normal', runResultActionOnce: (f) => f && f(), score, handleRetry: noop, runHighlights: {}, autoRepeat: false, resultProcessing: false };
  const C = [ChampionScreen, GameOverScreen, GaveUpScreen][which];
  ReactDOM.render(<C {...common} setChampionPresentationComplete={noop} setAutoRepeatEnabled={noop} setAutoBattleEnabled={noop} openSpeciesChallengeSelection={noop} speciesChallengeBattleRun={null} speciesChallengeClearCardNode={() => null} speciesChallengeFromDebugRef={{current:false}} speciesChallengeSaveRunRef={{current:null}} speciesChallengeBattleRunRef={{current:null}}/>, el);
};
`;
let fullOut = '';
try { fullOut = babel.transformSync(fullJsx, { presets: [], plugins: [[path.join(__dirname, '../node_modules/@babel/plugin-transform-react-jsx'), { runtime: 'classic' }]], configFile: false, babelrc: false }).code; }
catch (e) { check('結果画面まるごとの組み立て', false, String(e.message).slice(0, 200)); }
const fullDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitfull-'));
const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="file://${root}/monster-hero/tailwind.css">
<style>html,body{margin:0;background:#000;color:#fff}${cssLines}</style></head><body><div id="root"></div>
<script src="file://${root}/monster-hero/vendor/react.production.min.js"></script>
<script src="file://${root}/monster-hero/vendor/react-dom.production.min.js"></script>
<script>${fullOut}</script></body></html>`;
const fullPath = path.join(fullDir, 'index.html');
fs.writeFileSync(fullPath, fullHtml);

const shotsAt = process.argv.indexOf('--shots');
const shotsDir = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const SCORES = [0, 1234, 9876543, 23365084358631234, 123456789012345678901234567890];
const VIEWS = [['幅320', 320, 640], ['幅360', 360, 780], ['幅390', 390, 844], ['幅768', 768, 1024], ['横844', 844, 390]];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [vname, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shotsDir ? 2 : 1 });
    await page.goto('file://' + htmlPath);
    for (const score of SCORES) {
      for (let which = 0; which < 3; which++) {
        await page.evaluate(([s, k]) => window.__mount(Number(s), k), [String(score), which]);
        // 数え上げの途中(400ms 後)と、終わったあと(2.5秒後)の両方で測る
        for (const phase of [['途中', 700], ['最後', 2500]]) {
          await page.waitForTimeout(phase[0] === '途中' ? 700 : 1800);
          const r = await page.evaluate(() => {
            const bad = [];
            const vw = document.documentElement.clientWidth;
            for (const o of document.querySelectorAll('[data-fit-number]')) {
              const inner = o.querySelector('[data-fit-number-inner]');
              const ob = o.getBoundingClientRect();
              // 中の文字の右端(inner の中身の実寸)
              const rng = document.createRange(); rng.selectNodeContents(inner);
              const tb = rng.getBoundingClientRect();
              const box = o.closest('.mh-end-score') || o.parentElement;
              const bb = box.getBoundingClientRect();
              if (tb.right > ob.right + 0.5 || tb.left < ob.left - 0.5) bad.push(`文字が入れ物の外 ${Math.round(tb.right - ob.right)}px`);
              if (tb.right > bb.right + 0.5) bad.push(`文字が枠の外 ${Math.round(tb.right - bb.right)}px`);
              if (tb.right > vw + 0.5) bad.push(`文字が画面の外 ${Math.round(tb.right - vw)}px`);
            }
            const docOver = document.documentElement.scrollWidth - vw;
            if (docOver > 1) bad.push(`ページが横に ${docOver}px はみ出し`);
            const fs = [...document.querySelectorAll('[data-fit-number-inner]')].map(e => Math.round(parseFloat(getComputedStyle(e).fontSize)));
            return { bad, fs };
          });
          check(`${vname} ${names[which]} スコア${String(score).length}桁 ${phase[0]}`, r.bad.length === 0, r.bad.join(' / ') || `字 ${r.fs.join('・')}px`);
        }
        if (shotsDir && score === 23365084358631234) {
          await page.screenshot({ path: path.join(shotsDir, `${vname}-${['champion', 'defeat', 'retire'][which]}.png`) });
        }
      }
    }
    await page.close();
  }
  // ---- まるごと ----
  const FULL_NAMES = ['優勝(まるごと)', '敗北(まるごと)', 'リタイア(まるごと)'];
  for (const [vname, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shotsDir ? 2 : 1 });
    await page.goto('file://' + fullPath);
    for (const score of [1234, 23365084358631234]) {
      for (let which = 0; which < 3; which++) {
        await page.evaluate(([s, k]) => window.__mountFull(Number(s), k), [String(score), which]);
        await page.waitForTimeout(2300);
        const r = await page.evaluate(() => {
          const bad = [];
          const vw = document.documentElement.clientWidth;
          const sc = document.querySelector('.mh-end-score');
          if (!sc) return { bad: ['スコア枠が無い'] };
          const bb = sc.getBoundingClientRect();
          if (bb.left < 8 || bb.right > vw - 8) bad.push(`枠が画面の端に近い(左${Math.round(bb.left)}・右${Math.round(vw - bb.right)}px)`);
          const t = document.querySelector('h1,h2');
          if (t) { const tb = t.getBoundingClientRect(); if (tb.top < 0) bad.push('見出しの上が切れている'); }
          for (const o of document.querySelectorAll('[data-fit-number]')) {
            const rng = document.createRange(); rng.selectNodeContents(o.querySelector('[data-fit-number-inner]'));
            const tb = rng.getBoundingClientRect();
            if (tb.right > bb.right + 0.5 || tb.left < bb.left - 0.5) bad.push('文字が枠の外');
          }
          if (document.documentElement.scrollWidth - vw > 1) bad.push('ページが横にはみ出し');
          return { bad };
        });
        check(`${vname} ${FULL_NAMES[which]} スコア${String(score).length}桁`, r.bad.length === 0, r.bad.join(' / '));
        if (shotsDir && score === 23365084358631234) await page.screenshot({ path: path.join(shotsDir, `全体-${vname}-${['優勝', '敗北', 'リタイア'][which]}.png`) });
      }
    }
    await page.close();
  }
  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
