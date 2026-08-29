// BGMアレンジのタブが、いちばん狭い端末でも1行に収まるかを実際に測る。
//
//   node tools/audio/bgm-arrangement-layout-check.js
//
// 【なぜ要るか】
// バトルモードのタブは、モードを足すたびに1列ずつ増える(チャレンジ・クイック・プロ・極限・種族)。
// 列を増やしたときに「チャレンジ」のような長いラベルが枠からはみ出したり、
// 折り返して2行になったりしても、コードを読むだけでは分からない。
// このサンドボックスは外部CDN(Tailwind)へ出られないので、同梱の tailwindcss で
// game-system.jsx から実際のCSSを作り、ブラウザで位置と大きさを測る。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- 画面から実際のタブの並びを取り出す(check側へ書き写さない) ---
const dialogStart = source.indexOf('const categories=[');
const dialogEnd = source.indexOf('デフォルトに戻す', dialogStart);
const dialog = dialogStart >= 0 ? source.slice(dialogStart, dialogEnd) : '';
check('BGMアレンジの中身を取り出せる', dialog.length > 0);
const labelsOf = (block) => [...block.matchAll(/label:\s*'([^']+)'/g)].map(m => m[1]);
const categoryLabels = labelsOf(dialog.slice(0, dialog.indexOf('const battleModes=')));
// バトルモードのタブは公開フラグで数が変わるので、定義そのものから両方の並びを作る
const tabsStart = source.indexOf('const BGM_BATTLE_MODE_TABS = Object.freeze([');
const tabsEnd = source.indexOf(']);', tabsStart);
const tabsBlock = tabsStart >= 0 ? source.slice(tabsStart, tabsEnd) : '';
check('バトルモードのタブ定義が1か所にまとまっている', tabsBlock.length > 0 && dialog.includes('const battleModes=BGM_BATTLE_MODE_TABS;'));
const allModeLabels = labelsOf(tabsBlock);
const releasedOnly = labelsOf(tabsBlock.slice(tabsBlock.indexOf('SPECIES_CHALLENGE_PUBLIC_RELEASE')));
const beforeRelease = allModeLabels.filter(label => !releasedOnly.includes(label));
check('種族チャレンジのタブは公開フラグで出し分ける',
  releasedOnly.includes('種族') && !beforeRelease.includes('種族'),
  `公開前: ${beforeRelease.join('/')} → 公開後: ${allModeLabels.join('/')}`);
// 列数はタブの数に合わせて切り替わること(足したのに列を増やし忘れると2行になる)
const categoryCols = dialog.match(/aria-label="BGMカテゴリ" className="grid grid-cols-(\d+)/);
check('カテゴリの列数がタブの数と合っている',
  categoryCols && Number(categoryCols[1]) === categoryLabels.length, `${categoryCols?.[1]}列 / ${categoryLabels.length}個`);
check('バトルモードの列数はタブの数で切り替える',
  dialog.includes("battleModes.length>=5?'grid-cols-5':'grid-cols-4'"));
const modeColsFor = (labels) => (labels.length >= 5 ? 5 : 4);

const buildTailwindCss = () => {
  const bin = path.join(root, 'tools', 'node_modules', '.bin', 'tailwindcss');
  if (!fs.existsSync(bin)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-tw-'));
  const configPath = path.join(dir, 'tailwind.config.js');
  const inputPath = path.join(dir, 'in.css');
  const outputPath = path.join(dir, 'out.css');
  fs.writeFileSync(configPath, `module.exports={content:[${JSON.stringify(path.join(root, 'monster-hero/src/game-system.jsx'))}],theme:{extend:{}},plugins:[]};\n`);
  fs.writeFileSync(inputPath, '@tailwind base;@tailwind components;@tailwind utilities;\n');
  execFileSync(bin, ['-c', configPath, '-i', inputPath, '-o', outputPath, '--minify'], { stdio: 'ignore', timeout: 300000 });
  return fs.readFileSync(outputPath, 'utf8');
};

// 画面と同じダイアログ幅・同じクラスでタブだけを組み立てて測る。
// (BGMアレンジはタイトル画面のモーダルの中なので、本体を丸ごと起動しなくても幅は再現できる)
const tabsHtml = (labels, active) => labels.map((label, i) => `<button type="button" class="min-h-[44px] rounded-xl border px-1 text-[10px] font-black ${i === active ? 'bg-indigo-600 border-indigo-300 text-white' : 'bg-slate-900 border-white/15 text-slate-300'}">${label}</button>`).join('');

(async () => {
  let browser;
  try {
    const playwright = require(path.join(root, 'tools', 'node_modules', 'playwright'));
    const css = buildTailwindCss();
    check('本物と同じCSSを用意できる', !!css && css.length > 10000, `${css ? Math.round(css.length / 1024) : 0}KB`);
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    // iPhone SE(375)を下限に、よくある幅で見る
    for (const width of [390, 375, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      // mh-title-dialog は本体のCSSにある。BGMアレンジのモーダルと同じ幅の器を作る
      // 列数は画面と同じ決め方を使う。公開前(4タブ)と公開後(5タブ)の両方を測る
      await page.setContent(`<div id="dlg" style="max-width:400px;margin:0 auto;padding:16px;box-sizing:border-box">
        <div id="cat" class="grid grid-cols-${categoryCols[1]} gap-1 mb-3">${tabsHtml(categoryLabels, 0)}</div>
        <div id="mode" class="grid grid-cols-${modeColsFor(beforeRelease)} gap-1 mb-4">${tabsHtml(beforeRelease, 0)}</div>
        <div id="modeOpen" class="grid grid-cols-${modeColsFor(allModeLabels)} gap-1 mb-4">${tabsHtml(allModeLabels, allModeLabels.length - 1)}</div>
      </div>`);
      await page.addStyleTag({ content: css });
      const measure = async (id) => page.evaluate((rowId) => {
        const row = document.getElementById(rowId);
        const buttons = [...row.children];
        const rows = new Set(buttons.map(b => Math.round(b.getBoundingClientRect().top)));
        return {
          rowCount: rows.size,
          overflow: buttons.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent),
          minHeight: Math.min(...buttons.map(b => b.getBoundingClientRect().height)),
          rowWidth: row.scrollWidth,
          clientWidth: row.clientWidth,
        };
      }, id);
      for (const [id, label] of [['cat', 'カテゴリ'], ['mode', 'バトルモード(公開前)'], ['modeOpen', 'バトルモード(公開後)']]) {
        const m = await measure(id);
        check(`${width}px: ${label}のタブが1行に収まる`, m.rowCount === 1, `${m.rowCount}行`);
        check(`${width}px: ${label}のタブの文字がはみ出さない`, m.overflow.length === 0, m.overflow.join(' / '));
        check(`${width}px: ${label}のタブが指で押せる高さ(44px以上)`, m.minHeight >= 44, `${Math.round(m.minHeight)}px`);
        check(`${width}px: ${label}の行が横スクロールしない`, m.rowWidth <= m.clientWidth + 1, `${m.rowWidth} / ${m.clientWidth}`);
      }
      await page.close();
    }
  } catch (e) {
    check('確認できました', false, e && e.message ? e.message : String(e));
  } finally {
    if (browser) await browser.close();
  }
  console.log(failed === 0 ? '\nBGMアレンジのタブ配置: PASS' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
