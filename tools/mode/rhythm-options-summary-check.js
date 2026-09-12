const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンビーのオプション画面が「1画面に収まる・開かなくても設定が読める」かを見る。
//
//   node tools/mode/rhythm-options-summary-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-13)
//   「下にどんどん伸びていって使いづらい / 1画面に収まるようにして、いじりたいやつは
//     タップしたら詳細変えれるとかにしたほうがいい / ただし設定状態は見れる作りで」
//
// 折りたたみは、項目を足すときに**次の2つで静かに壊れる**。
//   ① 見出しの下の「いまの値」へ書き忘れる → 開かないと分からない設定ができる
//   ② 折りたたみを通さずに section を直書きする → また下へ伸びていく
// どちらも画面はふつうに動いてしまうので、ここで機械的に拾う。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
// 選択肢の値の正本は、画面側(game-system.jsx)とデータ側(data/rhythm-mode.js)に分かれている
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

// ---- 折りたたみの作り ----
check('オプションの本体が取り出せている', options.length > 0);
check('開くのは1つだけ(開閉は保存しない)',
  /const \[openSection,setOpenSection\]=useState\(''\);/.test(options)
  && /const next=current===id\?'':id;/.test(options)
  && !/openSection:/.test(game));
check('閉じているあいだは中身を作らない',
  /\{open&&<div data-rhythm-option-section-body=\{id\}/.test(options));
check('見出しがそのまま開くボタンになっている(aria-expanded付き)',
  /data-rhythm-option-section-head=\{id\} aria-expanded=\{open\}/.test(options)
  && /onClick=\{\(\)=>toggleSection\(id\)\}/.test(options));
check('開いたセクションの頭まで送る', /scrollIntoView\(\{block:'start'/.test(options));

// ---- 5つのセクションが、すべて折りたたみを通っている ----
const SECTION_IDS = ['volume', 'play', 'display', 'side', 'system'];
check('セクションは5つとも折りたたみを通している',
  SECTION_IDS.every(id => options.includes(`{section('${id}',<>`)),
  SECTION_IDS.join(' / '));
// 折りたたみを通さない <section className={card}> が残っていないこと(=また下へ伸びる)
check('折りたたみを通さない設定カードが残っていない',
  !options.includes('<section className={card}>'));

// ---- 開かなくても設定が読める ----
// 画面から変えられる設定のキーを、見出しの下の「いまの値」がすべて拾っているか。
// displayTimingOffsetMs は画面に出さない(常に0へ正規化される)ので対象外。
// 対象外。どれも**変える場所が画面に無い**設定で、出そうにも出せない。
//   displayTimingOffsetMs … 常に0へ正規化される(判定タイミング調整に一本化した)
//   judgmentTextPosition / holdSlideOpacity / livePartnerVisible
//                        … 値は持っているが、切り替えるUIがまだ無い
// 画面から変えられるようにしたら、ここから外して「いまの値」にも出すこと。
const SUMMARY_EXEMPT = new Set(['displayTimingOffsetMs', 'judgmentTextPosition', 'holdSlideOpacity', 'livePartnerVisible']);
const defaults = grab('const DEFAULT_RHYTHM_SETTINGS = Object.freeze({', '});');
const settingKeys = [...defaults.matchAll(/(?:^|[\s{,])([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map(m => m[1]);
const summaryBlock = grab('const RHYTHM_OPTION_SECTIONS=[', '\n  ];');
const missing = settingKeys.filter(key => !SUMMARY_EXEMPT.has(key) && !summaryBlock.includes(`d.${key}`));
check('画面から変えられる設定は、すべて「いまの値」に出ている',
  settingKeys.length > 0 && missing.length === 0,
  missing.length ? `出ていない: ${missing.join(', ')}` : `${settingKeys.length - SUMMARY_EXEMPT.size}件`);

// ---- 選択肢の名前は1か所だけ ----
// ボタンの名前と「いまの値」の名前が別々に書かれていると、片方だけ直して必ずずれる。
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
// 名前は定数を渡す(その場で書かない)
check('選択肢のボタンは名前の定数を渡している',
  LABEL_SETS.every(([labels]) => options.includes(`,${labels})`)));

// ---- 実際に開いて、閉じた状態が1画面に収まるか測る ----
// クラスはソースから取り出して組むので、見た目を詰め直したら測り直しになる。
const classOf = re => { const m = options.match(re); return m ? m[1] : ''; };
const cardClass = classOf(/const card='([^']+)'/);
const headClass = classOf(/const head='([^']+)'/);
const chipClass = classOf(/<span key=\{name\} className="([^"]+)"/);
const chevronClass = classOf(/<span aria-hidden="true" className="(min-h-\[44px\][^"]+)">\{open\?'▲':'▼'\}/);
const SAMPLE = [
  ['🔊 音量', [['BGM', '100'], ['タップ', '70'], ['タップ音', 'ON']]],
  ['🎯 プレイ', [['速度', '6.0'], ['サイズ', '100%'], ['出る位置', '0'], ['判定', '0ms']]],
  ['👁 表示', [['FAST/SLOW', 'ON'], ['判定文字', 'ON'], ['コンボ', '中央'], ['発光', '標準']]],
  ['🐾 両サイドのマスモン', [['濃さ', 'はっきり'], ['動き', '跳ねる'], ['光る', 'ON']]],
  ['✨ 演出・端末', [['演出量', '標準'], ['振動', 'OFF'], ['軽量', 'OFF'], ['試聴', 'ON'], ['通知', '出す']]],
];

(async () => {
  check('折りたたみのクラスをソースから取り出せている',
    !!(cardClass && headClass && chipClass && chevronClass));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const card = (title, chips, id) => `<section data-rhythm-option-section="${id}" data-open="false" class="${cardClass}">
      <button type="button" class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left">
        <span class="min-w-0"><span class="block ${headClass}">${title}</span>
        <span class="mt-1.5 flex flex-wrap gap-1">${chips.map(([n, v]) => `<span class="${chipClass}">${n} <b class="text-cyan-200">${v}</b></span>`).join('')}</span></span>
        <span class="${chevronClass}">▼</span></button></section>`;
    await page.setContent(`<!doctype html><html><head><style>${tailwind}</style></head>
      <body style="margin:0"><main class="flex min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style="height:844px">
      <header class="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2"><button class="min-h-[44px] min-w-[44px]">←</button><div><small class="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small><h2 class="text-base font-black">⚙️ オプション</h2></div></header>
      <div id="scroll" class="flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-3"><div id="stack" class="space-y-4">
      <p class="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[9px] font-bold leading-relaxed text-cyan-100">📱 横画面にも対応しています。端末を横にすると、曲の一覧と選んだ曲を左右に並べて見られます。曲えらびの「🔄 横」ボタンからも切り替えられます。</p>
      ${SAMPLE.map(([t, c], i) => card(t, c, 's' + i)).join('')}
      <section class="rounded-2xl border border-cyan-400/30 bg-cyan-950/25 p-4 text-[11px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</section>
      </div></div>
      <footer class="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 pt-2" style="padding-bottom:.5rem"><div class="grid grid-cols-[.9fr_1.1fr] gap-3"><button class="min-h-[52px] rounded-xl border border-white/20 bg-slate-800 px-2 text-[12px] font-black">デフォルトに戻す</button><button class="min-h-[52px] rounded-xl bg-amber-600 px-3 font-black">保存</button></div></footer>
      </main></body></html>`, { waitUntil: 'load' });
    const box = await page.evaluate(() => {
      const scroll = document.getElementById('scroll'), stack = document.getElementById('stack');
      return { view: scroll.clientHeight, content: stack.scrollHeight };
    });
    check('390×844の端末で、閉じた状態が1画面に収まる(縦スクロールが出ない)',
      box.content <= box.view, `中身 ${box.content}px / 画面 ${box.view}px`);
  } finally {
    await browser.close();
  }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
