// BGMアレンジのタブが、いちばん狭い端末でも1行に収まるかを実際に測る。
//
//   node tools/audio/bgm-arrangement-layout-check.js
//
// 【なぜ要るか】
// バトルモードのタブは、モードを足すたびに1列ずつ増える(チャレンジ・クイック・プロ・極限・種族)。
// 列を増やしたときに「チャレンジ」のような長いラベルが枠からはみ出したり、
// 折り返して2行になったりしても、コードを読むだけでは分からない。
// 配信している monster-hero/tailwind.css(プレイヤーへ届くものと同じCSS)を読み込み、
// ブラウザで位置と大きさを測る。
const fs = require('fs');
const path = require('path');

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
// ★列数の決め方は**本体の式をそのまま読む**。検査へ書き写すと、本体だけ変えたときに
//   「検査だけが古い列数で測る」ことになる(2026-09-21、タブが6つになったのに検査は5列のままだった)
const modeColsSource = (dialog.match(/(battleModes\.length>=\d+\?'grid-cols-\d+'(?::battleModes\.length>=\d+\?'grid-cols-\d+')*:'grid-cols-\d+')/) || [])[1] || '';
check('モードのタブの列数の決め方を本体から読めた', !!modeColsSource, modeColsSource);
const modeColsFor = (labels) => {
  if (!modeColsSource) return 4;
  const cls = Function('battleModes', `return ${modeColsSource}`)(labels);
  return Number(String(cls).replace('grid-cols-', '')) || 4;
};
// タブの数と列数から決まる行数。1行に押し込めない数になったら、素直に折り返す
const expectedRows = (labels) => Math.max(1, Math.ceil(labels.length / modeColsFor(labels)));

// 配信しているCSSをそのまま使う(2026-09-12にTailwindを静的CSSへ切り替えた)。
// 以前はここで毎回 tailwindcss を走らせて作り直していたが、
// 「検査だけが本物と違うCSSで測っている」状態になりうるうえ、1回7秒かかっていた
const shippedTailwindCss = () => {
  const file = path.join(root, 'monster-hero', 'tailwind.css');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
};

// 画面と同じダイアログ幅・同じクラスでタブだけを組み立てて測る。
// (BGMアレンジはタイトル画面のモーダルの中なので、本体を丸ごと起動しなくても幅は再現できる)
const tabsHtml = (labels, active) => labels.map((label, i) => `<button type="button" class="min-h-[44px] rounded-xl border px-1 text-[10px] font-black ${i === active ? 'bg-indigo-600 border-indigo-300 text-white' : 'bg-slate-900 border-white/15 text-slate-300'}">${label}</button>`).join('');

(async () => {
  let browser;
  try {
    const playwright = require(path.join(root, 'tools', 'node_modules', 'playwright'));
    const css = shippedTailwindCss();
    check('配信しているCSSを読める(本物と同じもので測る)', !!css && css.length > 10000, `${css ? Math.round(css.length / 1024) : 0}KB`);
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
        // ★文字が折り返されていないか。はみ出さなくても「タクティ/クス」と割れると読めない
        //   (2026-09-21、6列に押し込んだときがそうだった。はみ出しの検査だけでは拾えなかった)
        const wrapped = buttons.filter(b => {
          const range = document.createRange();
          range.selectNodeContents(b);
          return range.getClientRects().length > 1;
        }).map(b => b.textContent);
        return {
          rowCount: rows.size,
          wrapped,
          overflow: buttons.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent),
          minHeight: Math.min(...buttons.map(b => b.getBoundingClientRect().height)),
          rowWidth: row.scrollWidth,
          clientWidth: row.clientWidth,
        };
      }, id);
      for (const [id, label, labels] of [
        ['cat', 'カテゴリ', categoryLabels],
        ['mode', 'バトルモード(公開前)', beforeRelease],
        ['modeOpen', 'バトルモード(公開後)', allModeLabels],
      ]) {
        const m = await measure(id);
        const want = id === 'cat' ? 1 : expectedRows(labels);
        check(`${width}px: ${label}のタブが${want}行に収まる`, m.rowCount === want, `${m.rowCount}行`);
        // ★2行までにする。3行になるとダイアログの中でタブだけが場所を取りすぎる
        check(`${width}px: ${label}のタブが2行を超えない`, m.rowCount <= 2, `${m.rowCount}行`);
        check(`${width}px: ${label}のタブの文字がはみ出さない`, m.overflow.length === 0, m.overflow.join(' / '));
        check(`${width}px: ${label}のタブの文字が折り返されない`, m.wrapped.length === 0, m.wrapped.join(' / '));
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
