#!/usr/bin/env node
// 窓口の止め絵の点検: 部から届いた止め絵(PNG・JPG)を、社長に見せる前に決まりに照らして見るための道具。
//
//   node tools/ctx.js still <絵…>                … 空きの帯を測り、拡大した切り出しを作る(それを Read で開いて目で見る)
//   node tools/ctx.js still <絵…> --screen 修行   … あわせて、その画面の参考(REF-MAP の行)と台帳の決めごとを引く
//   node tools/ctx.js still --list               … 見る所の一覧だけ出す
//   (--out <フォルダ> で切り出しの置き場所を変える。既定は一時フォルダ)
//
// 【なぜあるか】(2026-11-14 社長「なんかお願いしたのに漏れてるの多いのは何で?」)
// 窓口が止め絵を小さいまま眺めて通し、言葉の途中の折れ・下の大きな空きを見落として社長に出した。
// 機械で測れる物(空きの帯)は測り、目で見るしかない物(折れ・数字のそろえ・参考との違い)は、
// 拡大した切り出しと「比べる相手(参考の行・台帳の行)」を道具が並べて、見ずに通せないようにする。
// 手順: docs/rules/REQUEST_TRACKING.md「窓口の止め絵の点検」・画面の決まり: docs/spec/MONSUC_UI.md
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, cut } = require('./lib');

// 見る所(手引き docs/depts/hq.md と同じ5つ。ことばを変えるときは depts.json の hq の決まりも直す)
const POINTS = [
  '言葉の途中の折れ: 拡大した切り出しを1枚ずつ開き、行の終わりが言葉の途中(「トレーニ/ング」「+1/2」)・1〜2字だけ落ちた行が無いか',
  '下の空き: 中身のいちばん下とボタンの列のあいだは 48px まで(下の「空きの帯」が出たら、場面を伸ばして埋めるよう部へ返す)',
  '数字のそろえ方: 見せ場の数字は真ん中・右寄せの数字は無し・3けたごとの「,」・差は +12 / −12(docs/spec/MONSUC_UI.md 2)',
  '参考との比べ: REF-MAP のその画面の行を引き、参考の実物(画像・動画のコマ)を開いて、組み立て・流れが合っているか',
  '台帳の決めごとと突き合わせ: その画面の決めごと(node tools/ctx.js decisions --grep <語>・todo find <語>)を1行ずつ絵に当てる',
];

const GAP_PX = 48; // docs/spec/MONSUC_UI.md 1「下に大きな空きを残さない(48px まで)」

// ページの中で: 絵を読み、横1行がほぼ1色の行の続き(空きの帯)と、拡大した切り出しを返す
const MEASURE = async ({ url, gapPx, tiles }) => {
  const img = new Image();
  await new Promise((ok, ng) => { img.onload = ok; img.onerror = () => ng(new Error('絵が読めない')); img.src = url; });
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  const scale = Math.min(w, h) / 390; // 縦 390×844・横 844×390 を何倍で撮ったか
  const flat = [];
  for (let y = 0; y < h; y++) {
    const o = y * w * 4, m = o + Math.floor(w / 2) * 4;
    let same = 0;
    for (let x = 0; x < w; x++) { const p = o + x * 4; if (Math.abs(d[p] - d[m]) + Math.abs(d[p + 1] - d[m + 1]) + Math.abs(d[p + 2] - d[m + 2]) <= 14) same++; }
    flat.push(same >= w * 0.97);
  }
  const bands = [];
  for (let y = 0; y < h;) {
    if (!flat[y]) { y++; continue; }
    let e = y; while (e < h && flat[e]) e++;
    if (e - y > gapPx * scale) bands.push({ top: y, bottom: e, px: Math.round((e - y) / scale) });
    y = e;
  }
  // 拡大した切り出し(縦に tiles 枚・少し重ねる・短い辺が 900px くらいになる倍率)
  const out = [];
  const th = Math.ceil(h / tiles), lap = Math.round(th * 0.08);
  const zoom = Math.max(1, Math.min(3, 1100 / w));
  for (let i = 0; i < tiles; i++) {
    const y0 = Math.max(0, i * th - lap), y1 = Math.min(h, (i + 1) * th + lap);
    const t = document.createElement('canvas'); t.width = Math.round(w * zoom); t.height = Math.round((y1 - y0) * zoom);
    const tg = t.getContext('2d'); tg.imageSmoothingEnabled = zoom < 2; tg.drawImage(c, 0, y0, w, y1 - y0, 0, 0, t.width, t.height);
    out.push(t.toDataURL('image/png'));
  }
  return { w, h, scale, bands, tiles: out };
};

// REF-MAP の表から、その画面の行(語に当たる行)を引く
function refRows(word) {
  const f = path.join(ROOT, 'docs', 'reference', 'line-mf', 'REF-MAP.md');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(l => l.startsWith('|') && !/^\|\s*-/.test(l) && l.split('|')[1].includes(word));
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const files = argv.filter((a, i) => !a.startsWith('--') && !['--screen', '--out'].includes(argv[i - 1]));
  const list = () => { console.log('# 止め絵で見る所(社長に見せる前に・5つ全部)'); POINTS.forEach((p, i) => console.log(`${i + 1}. ${p}`)); };
  if (argv.includes('--list') || !files.length) { list(); if (!files.length && !argv.includes('--list')) console.log('\n使い方: node tools/ctx.js still <絵…> [--screen <画面の語>]'); return; }

  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.error('NG: playwright が無いので絵を測れない(見る所は --list)'); process.exit(1); }
  const outDir = opt('--out') || fs.mkdtempSync(path.join(os.tmpdir(), 'still-'));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let warn = 0;
  for (const f of files) {
    const full = path.resolve(f);
    if (!fs.existsSync(full)) { console.log(`NG: ${f} が無い`); warn++; continue; }
    const mime = /\.jpe?g$/i.test(full) ? 'image/jpeg' : /\.webp$/i.test(full) ? 'image/webp' : 'image/png';
    const url = `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
    let r;
    try { r = await page.evaluate(MEASURE, { url, gapPx: GAP_PX, tiles: 3 }); } catch (e) { console.log(`NG: ${f} が読めない`); warn++; continue; }
    console.log(`\n# ${path.relative(ROOT, full)}  ${r.w}×${r.h}(${r.w < r.h ? '縦' : '横'}・${r.scale.toFixed(1)}倍)`);
    if (r.bands.length) {
      warn += r.bands.length;
      for (const b of r.bands.sort((a, c) => c.px - a.px).slice(0, 4)) console.log(`  ★空きの帯: 上から ${Math.round(b.top / r.h * 100)}〜${Math.round(b.bottom / r.h * 100)}% の所に 高さ ${b.px}px(決まりは ${GAP_PX}px まで)`);
    } else console.log(`  空きの帯(${GAP_PX}px 超): なし`);
    const base = path.basename(full).replace(/\.[^.]+$/, '');
    const names = r.tiles.map((t, i) => { const p = path.join(outDir, `${base}-${['上', '中', '下'][i] || i}.png`); fs.writeFileSync(p, Buffer.from(t.split(',')[1], 'base64')); return p; });
    console.log('  拡大した切り出し(Read で1枚ずつ開いて目で見る):');
    for (const n of names) console.log(`    ${n}`);
  }
  await browser.close();

  const word = opt('--screen');
  if (word) {
    const rows = refRows(word);
    console.log(`\n# 参考(REF-MAP「${word}」の行 ${rows.length} 件。見る実物を開いて比べる)`);
    for (const l of rows.slice(0, 4)) { const c = l.split('|').map(s => s.trim()); console.log(`- ${cut(c[1], 40)} → 見る実物: ${cut(c[3] || '', 150)} / 見る物: ${cut(c[4] || '', 120)}`); }
    if (!rows.length) console.log('- (行が無い。docs/reference/line-mf/REF-MAP.md の見出しから探す: node tools/ctx.js toc docs/reference/line-mf/REF-MAP.md)');
    try {
      const { load } = require('./requests');
      const hit = load()['頼み'].filter(x => x['中身'].includes(word) && x['状態'] !== '上書き済み' && x['状態'] !== 'やめた').slice(-8);
      console.log(`\n# 台帳の決めごと(追跡表で「${word}」に当たる新しい ${hit.length} 件。1行ずつ絵に当てる)`);
      for (const x of hit) console.log(`- ${x.id} [${x['状態']}] ${cut(x['中身'], 120)}`);
    } catch (e) { /* 表が読めなくても絵の点検は出す */ }
  }
  console.log('');
  list();
  console.log(warn ? `\n★ 機械が ${warn} 件見つけた。直しを部へ返してから社長に見せる(思い当たる空き=場面の景色などなら、切り出しで確かめて通してよい)。` : '\n機械で測れる所は問題なし。残りの4つは、切り出しを開いて目で見る。');
}

if (require.main === module) main().catch(e => { console.error('NG: ' + e.message); process.exit(1); });
module.exports = { POINTS, GAP_PX, refRows };
