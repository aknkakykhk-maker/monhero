const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンビーのオプション画面が「1画面に収まる・押す場所が小さくなっていない」かを見る。
//
//   node tools/mode/rhythm-options-tabs-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-13)
//   「下にどんどん伸びていって使いづらい / 1画面に収まるようにして、いじりたいやつは
//     タップしたら詳細変えれるとかにしたほうがいい」
//   そのあと実際の音ゲーの画面を示して「オプションはこういうのを参考にしたい」。
//
// 参考の形（上のタブで3つに分ける／1項目=1枠／数値は粗細4つのボタン）は、
// 項目を足すときに**次の3つで静かに崩れる**。
//   ① タブを通さず直に置く       → また1本の長い列に戻る
//   ② 説明を畳まずに出す         → 枠が伸びて、参考の形の「見渡せる」が消える
//   ③ 押す場所を小さくして詰める → 入る量は増えるが、押しにくくなる
// どれも画面はふつうに動いてしまうので、ここで機械的に拾う。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const data = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');
const tailwind = fs.readFileSync(path.join(web, 'tailwind.css'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (from, to) => {
  const i = game.indexOf(from);
  const j = game.indexOf(to, i);
  return i >= 0 && j > i ? game.slice(i, j) : '';
};
const options = grab('const RhythmOptions=({value,onSave,onBack})=>{', '\n// モンスターノーツ用のマスモン設定');

// ---- タブ ----
check('オプションの本体が取り出せている', options.length > 0);
check('上のタブで3つに分けている',
  /const RHYTHM_OPTION_TABS=Object\.freeze\(\[\['live','ライブ'\],\['volume','音量'\],\['system','システム'\]\]\)/.test(game)
  && /const \[tab,setTab\]=useState\('live'\);/.test(options));
check('タブは押せるボタンで、いま見ているものが分かる',
  /data-rhythm-options-tab=\{id\} aria-pressed=\{tab===id\}/.test(options)
  && options.includes('min-h-[44px] rounded-xl border text-[13px] font-black'));
check('見ていないタブの中身は作らない',
  ['live', 'volume', 'system'].every(id => options.includes(`{tab==='${id}'&&<section data-rhythm-options-panel="${id}"`)));
check('タブを変えたら先頭から見せる', /const changeTab=id=>\{setTab\(id\);[\s\S]{0,80}scrollTo\(\{top:0\}\)/.test(options));
check('タブは設定ではないので保存しない', !/\btab:/.test(grab('const DEFAULT_RHYTHM_SETTINGS = Object.freeze({', '});')));

// ---- 1項目=1枠、説明は畳む ----
check('項目は枠に入れ、頭に帯のラベルを置く',
  /const field=\(title,control,description=null,\{wide=false\}=\{\}\)=>/.test(options)
  && options.includes('data-rhythm-option-field')
  && options.includes('mb-2 rounded-lg bg-cyan-700/70 px-2 py-1 text-center'));
check('小さい項目は2列に並べる', /const grid='grid grid-cols-2 gap-2\.5'/.test(options));
check('説明は畳んでおく(消してはいない)',
  options.includes('<details data-rhythm-option-help')
  && options.includes('▸ くわしく')
  && /<summary[^>]*>▸ くわしく<\/summary>\s*\n\s*<p className=\{`mt-1 \$\{note\}`\}>\{description\}<\/p>/.test(options));

// ---- 数値は粗く/細かくの4つ ----
check('数値は粗く動かす／細かく動かすの4つのボタンで変えられる',
  /const stepper=\(key,min,max,step,\{fine=step,coarse=step\*10/.test(options)
  && options.includes('data-rhythm-option-nudge={`${key}${sign(amount)}`}')
  && options.includes('rhythmNudgeOptionValue(value,min,max,step,amount)'));
// 押す場所は44px以上。字を詰めて入る量を増やさない(2026-09-05の指示がここでも効く)
const withoutSummaries = options.split('\n').filter(line => !line.includes('<summary')).join('\n');
const smallTargets = [...withoutSummaries.matchAll(/min-h-\[(\d+)px\]/g)].map(m => Number(m[1])).filter(px => px < 44);
check('押す場所が44pxより小さくなっていない', smallTargets.length === 0,
  smallTargets.length ? `小さいもの: ${smallTargets.join(', ')}px` : '');

// ---- 選択肢の名前は1か所だけ ----
// ボタンの名前が2か所に書かれていると、片方だけ直して必ずずれる。
const LABEL_SETS = [
  ['RHYTHM_LANE_GLOW_LABELS', 'RHYTHM_LANE_GLOW_LEVELS'],
  ['RHYTHM_EFFECT_LABELS', 'RHYTHM_EFFECT_LEVELS'],
  ['RHYTHM_SIDE_MONSTER_OPACITY_LABELS', 'RHYTHM_SIDE_MONSTER_OPACITIES'],
  ['RHYTHM_SIDE_MONSTER_MOTION_LABELS', 'RHYTHM_SIDE_MONSTER_MOTIONS'],
  ['RHYTHM_COMBO_POSITION_LABELS', 'RHYTHM_COMBO_POSITIONS'],
];
const idsOf = name => {
  const re = new RegExp(`const ${name} *= *Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`);
  const m = game.match(re) || data.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/'([A-Z_]+)'/g)].map(x => x[1]);
};
for (const [labels, levels] of LABEL_SETS) {
  const a = idsOf(labels), b = idsOf(levels);
  const same = a && b && a.length === b.length && a.every(id => b.includes(id));
  check(`${labels} の中身が ${levels} と同じ`, !!same,
    same ? a.join('/') : `名前側 ${a ? a.join('/') : 'なし'} / 値側 ${b ? b.join('/') : 'なし'}`);
}
check('選択肢のボタンは名前の定数を渡している',
  LABEL_SETS.every(([labels]) => options.includes(`,${labels})`)));

// ---- 画面から変えられる設定が、どこかのタブに置いてあるか ----
// 置き忘れると「保存はされるのに変える場所が無い」設定ができる。
const SCREENLESS = new Set(['displayTimingOffsetMs', 'judgmentTextPosition', 'holdSlideOpacity', 'livePartnerVisible']);
const defaults = grab('const DEFAULT_RHYTHM_SETTINGS = Object.freeze({', '});');
const settingKeys = [...defaults.matchAll(/(?:^|[\s{,])([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map(m => m[1]);
const missing = settingKeys.filter(key => !SCREENLESS.has(key) && !options.includes(`'${key}'`));
check('画面から変えられる設定は、どれかのタブに置いてある', settingKeys.length > 0 && missing.length === 0,
  missing.length ? `置き場所が無い: ${missing.join(', ')}` : `${settingKeys.filter(k => !SCREENLESS.has(k)).length}件`);

// ---- 実際に開いて、1つのタブが1画面に収まるか測る ----
// クラスはソースから取り出して組むので、見た目を詰め直したら測り直しになる。
const classOf = re => { const m = options.match(re); return m ? m[1] : ''; };
const cardClass = classOf(/const card='([^']+)'/);
const headClass = classOf(/const head='([^']+)'/);
const labelClass = classOf(/const label='([^']+)'/);
const fieldClass = classOf(/data-rhythm-option-field className=\{`\$\{wide\?'col-span-2':''\} ([^`]+)`\}/);
const tabClass = 'min-h-[44px] rounded-xl border text-[13px] font-black';

(async () => {
  check('枠のクラスをソースから取り出せている', !!(cardClass && headClass && labelClass && fieldClass));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const field = (title, control, wide) => `<div class="${wide ? 'col-span-2' : ''} ${fieldClass}">
      <p class="mb-2 rounded-lg bg-cyan-700/70 px-2 py-1 text-center ${labelClass}">${title}</p>${control}
      <details class="mt-2"><summary class="min-h-[24px] list-none text-[10px] font-black leading-[24px] text-cyan-300/90">▸ くわしく</summary></details></div>`;
    const stepper = value => `<div class="space-y-1.5"><div class="grid grid-cols-[1fr_1fr_minmax(56px,1.3fr)_1fr_1fr] items-center gap-1">
      ${['-10', '-1', value, '+1', '+10'].map((t, i) => i === 2
        ? `<output class="min-h-[46px] rounded-lg border border-cyan-400/40 bg-slate-950 px-1 text-center text-[13px] font-black leading-[46px] tabular-nums">${t}</output>`
        : `<button class="min-h-[46px] rounded-xl border border-white/15 bg-slate-800 px-0.5 text-[11px] font-black tabular-nums text-slate-100">${t}</button>`).join('')}
      </div><input type="range" class="h-3 w-full appearance-none rounded-full border border-white/15 bg-slate-950"></div>`;
    const onoff = `<div class="grid grid-cols-2 gap-1">${['ON', 'OFF'].map(t => `<button class="min-h-[44px] rounded-xl border border-white/20 bg-slate-900 text-[12px] font-black">${t}</button>`).join('')}</div>`;
    // いちばん項目の多い「音量」タブで測る(ここが収まれば、数の少ないタブも収まる)
    const body = `<div class="grid grid-cols-2 gap-2.5">
      ${field('BGM音量', stepper('100'), true)}${field('タップ音量', stepper('70'), true)}
      ${field('タップ音', onoff)}<div class="grid gap-2"><button class="min-h-[44px] rounded-xl bg-indigo-700 text-[12px] font-black">♪ BGM試聴</button><button class="min-h-[44px] rounded-xl bg-fuchsia-700 text-[12px] font-black">タップ音試聴</button></div>
    </div>`;
    await page.setContent(`<!doctype html><html><head><style>${tailwind}</style></head>
      <body style="margin:0"><main class="flex min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style="height:844px">
      <header class="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2"><button class="min-h-[44px] min-w-[44px]">←</button><div><small class="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small><h2 class="text-base font-black">⚙️ オプション</h2></div></header>
      <nav class="z-10 grid shrink-0 grid-cols-3 gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 pb-2 pt-2">${['ライブ', '音量', 'システム'].map(t => `<button class="relative ${tabClass} border-white/15 bg-slate-800 text-slate-300">${t}</button>`).join('')}</nav>
      <div id="scroll" class="flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-3"><div id="stack" class="space-y-4">
      <section class="${cardClass}"><h3 class="${headClass}">🔊 音量</h3><div class="mt-3">${body}</div>
      <details class="mt-3"><summary class="min-h-[24px] list-none text-[10px] font-black leading-[24px] text-cyan-300/90">▸ 音量についてくわしく</summary></details></section>
      <p class="rounded-xl border border-cyan-400/25 bg-cyan-950/25 px-3 py-2 text-[10px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</p>
      </div></div>
      <footer class="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 pt-2" style="padding-bottom:.5rem"><div class="grid grid-cols-[.9fr_1.1fr] gap-3"><button class="min-h-[52px] rounded-xl border border-white/20 bg-slate-800 px-2 text-[12px] font-black">デフォルトに戻す</button><button class="min-h-[52px] rounded-xl bg-amber-600 px-3 font-black">保存</button></div></footer>
      </main></body></html>`, { waitUntil: 'load' });
    const box = await page.evaluate(() => {
      const scroll = document.getElementById('scroll'), stack = document.getElementById('stack');
      return { view: scroll.clientHeight, content: stack.scrollHeight };
    });
    check('390×844の端末で、音量タブが1画面に収まる(縦スクロールが出ない)',
      box.content <= box.view, `中身 ${box.content}px / 画面 ${box.view}px`);
  } finally {
    await browser.close();
  }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
