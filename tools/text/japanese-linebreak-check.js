// 日本語の行の折り返し(禁則処理)が効いているかを、実ブラウザで測る。
//
//   node tools/text/japanese-linebreak-check.js
//
// 【なぜ要るか】
// ブラウザの既定は日本語の禁則がゆるく、長音「ー」や小書き仮名「っ」が行頭へ出る。
// 実機(iPhone)の図鑑で「恐ろしいモンスタ / ー。」「通常攻撃のダメ / ージが」のように
// 折り返しているのをユーザーに指摘された(2026-09-08「図鑑説明の文字の並びが悪い /
// よくよくみたらほとんどのモンスターが悪い」)。
// 直し方は共通CSSの `body { line-break: strict; }` 1行だけだが、これは
// 見た目にしか出ないので、消えても検査が無いと誰も気づけない。
//
// 【測り方】
// 文章は実データ(図鑑説明・勇者特性・固有効果)からそのまま集める。検査側へ書き写さない
// ので、モンスターを足せば自動で対象になる。幅を1pxずつ振って流し込み、
// 行頭に来てはいけない文字で始まる行が1つでも出たらNGにする。
// 文字の位置は Range API で測る(spanで包むと折り返しの判定そのものが変わるため)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 共通CSSに禁則の指定があること ---
check('共通CSSで日本語の禁則を厳しくしている(line-break: strict)',
  /body \{ line-break: strict; \}/.test(source));
// index.html の lang。ここが ja でないと、ブラウザは日本語の禁則ルールを使わない
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');
check('ページの言語が日本語(lang="ja")', /<html lang="ja">/.test(indexHtml));

// --- ② 実データから、画面に出る日本語の長文を集める ---
const ctx = { console, Object, Array, Set, Map, String, Number };
vm.createContext(ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/lineages.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('globalThis.__d={ALL_PLAYER_MONSTERS,MONSTER_DEX_DESCRIPTIONS};', ctx);
const { ALL_PLAYER_MONSTERS, MONSTER_DEX_DESCRIPTIONS } = ctx.__d;

const texts = [];
for (const mon of Object.values(ALL_PLAYER_MONSTERS)) {
  if (!mon || mon.debugOnly) continue;
  const desc = MONSTER_DEX_DESCRIPTIONS[mon.id];
  if (desc) texts.push({ who: `${mon.name}の図鑑説明`, text: desc });
  if (mon.traitDesc) texts.push({ who: `${mon.name}の特性の効果`, text: mon.traitDesc });
  if (mon.unique?.effectDesc) texts.push({ who: `${mon.name}の固有効果`, text: mon.unique.effectDesc });
}
check('実データから日本語の長文を集められる', texts.length > 0, `${texts.length}件`);
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

// 行頭に来てはいけない文字(JIS X 4051 の行頭禁則の主なもの)
const BAD_HEAD = /[ー。、』」）】〉》〕｝ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ・：；！？]/;

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.log('SKIP: playwright が無いので実ブラウザでの測定は飛ばします'); process.exit(0); }

  // 既存の実ブラウザ検査と同じく、このサンドボックスに置いてある Chromium を直に指す
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  // 実ゲームと同じ言語設定。lang が無いと Chromium は日本語の禁則ルールを使わない
  await page.setContent('<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
  // 共通CSSから禁則の指定だけを取り出して当てる(検査側で書き直さない)
  const bodyRule = (source.match(/body \{ line-break: [^}]*\}/) || [''])[0];
  await page.addStyleTag({ content: bodyRule });

  const measure = (text, width) => page.evaluate(({ text, width }) => {
    const root = document.getElementById('root');
    root.innerHTML = '';
    const p = document.createElement('p');
    // 図鑑の説明文・特性の効果と同じ字の大きさ・太さ・行送り
    p.style.cssText = `width:${width}px; font-size:10px; line-height:1.625; font-weight:700; margin:0; overflow-wrap:break-word;`;
    p.textContent = text;
    root.appendChild(p);
    const node = p.firstChild, range = document.createRange();
    const out = []; let cur = '', top = null;
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const t = Math.round(range.getBoundingClientRect().top);
      if (top === null) top = t;
      if (t !== top) { out.push(cur); cur = ''; top = t; }
      cur += text[i];
    }
    if (cur) out.push(cur);
    return out;
  }, { text, width });

  // 図鑑の情報カードは、狭い端末(iPhone SE)から広い端末まで幅が変わる。
  // 実機で問題が出た360px前後を含む範囲を、1px刻みで全部見る
  const WIDTHS = [];
  for (let w = 240; w <= 400; w += 1) WIDTHS.push(w);

  const bad = [];
  for (const { who, text } of texts) {
    for (const w of WIDTHS) {
      const lines = await measure(text, w);
      const ng = lines.filter(l => BAD_HEAD.test(l[0]));
      if (ng.length) { bad.push({ who, w, heads: ng.map(l => l[0]), lines }); break; }
    }
  }
  check(`どの幅でも禁則を破らない(${texts.length}件 × 幅240〜400px)`, bad.length === 0,
    bad.length ? bad.slice(0, 3).map(b => `${b.who}(幅${b.w}px)で「${b.heads.join('')}」が行頭`).join(' / ') : `${texts.length}件すべてOK`);
  if (bad.length) {
    console.log('  例:');
    bad[0].lines.forEach(l => console.log(`    ${BAD_HEAD.test(l[0]) ? '⚠' : ' '} ${l}`));
  }

  // --- ③ 図鑑の「基本」タブ: 長い値は左揃えで、行頭がそろうこと ---
  // 右揃えのまま折り返すと、行頭が行ごとにずれて読みにくい
  // (実機のザンでは最終行が「撃」の1文字だけになっていた)
  check('図鑑の行は、長い値だけ見出しを上に置いて左揃えにしている',
    /const DEX_ROW_WRAP_LENGTH=\d+;/.test(source)
    && /typeof value==='string'&&value\.length>=DEX_ROW_WRAP_LENGTH/.test(source));
  const longValue = texts.find(t => t.who.endsWith('特性の効果') && t.text.length >= 60)?.text || texts[0].text;
  const rowSpread = (align) => page.evaluate(({ text, align }) => {
    const root = document.getElementById('root');
    root.innerHTML = '';
    const span = document.createElement('span');
    // 右揃えのときはラベルぶん狭く、左揃えのときは幅いっぱい(実装と同じ)
    span.style.cssText = `display:block; width:${align === 'right' ? 246 : 318}px; font-size:11px; line-height:1.625; font-weight:700; overflow-wrap:break-word; text-align:${align};`;
    span.textContent = text;
    root.appendChild(span);
    const node = span.firstChild, range = document.createRange();
    const lefts = []; let top = null, start = 0;
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const t = Math.round(range.getBoundingClientRect().top);
      if (top === null) { top = t; start = i; }
      if (t !== top) {
        range.setStart(node, start); range.setEnd(node, start + 1);
        lefts.push(Math.round(range.getBoundingClientRect().left));
        top = t; start = i;
      }
    }
    range.setStart(node, start); range.setEnd(node, start + 1);
    lefts.push(Math.round(range.getBoundingClientRect().left));
    return { spread: Math.max(...lefts) - Math.min(...lefts), lines: lefts.length };
  }, { text: longValue, align });
  const right = await rowSpread('right');
  const left = await rowSpread('left');
  check('長い値を左揃えにすると行頭がそろう', left.spread === 0 && right.spread > 0,
    `右揃え: ばらつき${right.spread}px(${right.lines}行) → 左揃え: ばらつき${left.spread}px(${left.lines}行)`);

  // 指定を外すと本当に破れることも確かめる(検査が素通りしていないことの確認)
  await page.setContent('<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
  let brokenFound = false;
  for (const { text } of texts) {
    for (const w of WIDTHS) {
      const lines = await measure(text, w);
      if (lines.some(l => BAD_HEAD.test(l[0]))) { brokenFound = true; break; }
    }
    if (brokenFound) break;
  }
  check('禁則の指定を外すと実際に破れる(この検査が素通りしていない)', brokenFound);

  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
