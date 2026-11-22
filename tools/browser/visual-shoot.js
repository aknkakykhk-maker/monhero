#!/usr/bin/env node
// 見た目の点検(r1119-014 PR3): モンヒロ全体の場面を4つの大きさで撮り、機械の見つけ方をかける入り口。
//
//   node tools/browser/visual-shoot.js                       全場面(モンサク以外) × 4つの大きさ(縦・横・小さい横・PC)
//   node tools/browser/visual-shoot.js --list                場面の一覧だけ出す
//   node tools/browser/visual-shoot.js --only home,market    場面を絞る(id。--list で見る)
//   node tools/browser/visual-shoot.js --sizes tate,pc       大きさを絞る(tate / yoko / yoko-s / pc)
//   node tools/browser/visual-shoot.js --with-monsuc         モンサクの入口の場面も撮る(直しの公開のあと)
//   node tools/browser/visual-shoot.js --monsuc-deep         モンサクの奥の画面を既存の撮影の道具で撮る(約200場面。時間がかかる)
//   node tools/browser/visual-shoot.js --prev <前の結果のフォルダ>  前の版の止め絵と比べる(既定は tools/out/visual/ の1つ前)
//
// 結果は tools/out/visual/<日時>/(git に入らない): shots/<大きさ>/<場面>.png・results.json・summary.md
// 止め絵を Claude API で見てもらうのは別の道具: node tools/browser/visual-api-send.js <結果のフォルダ>(費用の見込みを先に出す)
//
// 【守ること】(r1119-014 依頼文)
//   ・デバッグの合言葉・DEBUG MENU は使わない。HOME から人と同じボタンを押して開く
//   ・本番の保存・ランキングへは送らない(ボット用のまっさらなブラウザ・にせの Supabase・手元以外の通信は止める)
//   ・写る名前はボットの名前「モンヒロくん」だけ(社長の個人の情報は写らない)
//   ・会話(Claude Code)で止め絵を全部開かない。summary.md の上位だけ読む
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
// SHOT_REV=<コミット> … ゲームの画面だけその版から配る(社長の指摘の較正。tools/browser/serve-rev.js)
const serveRev = require('./serve-rev');
const FROM_REV = serveRev.make(ROOT);
// 大きさの釣り合いを測る(tools/browser/ui-measure.js)。指摘は results.json に「測る:」の種類で入る
const uiMeasure = require('./ui-measure');
const { SCENES, SIZES, MONSUC_DEEP } = require('./visual-scenes');
const { measurePage, contrastFromPixels, diffAgainst } = require('./visual-detect');
const { openSession } = require('../playbot/lib/session');
const { prepareVeteran } = require('../playbot/lib/seeds');
const { scanTextWrap } = require('../playbot/lib/text-wrap');

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : ''; };
const has = (name) => argv.includes(name);

let playwright, sharp;
try { playwright = require('playwright'); } catch (e) { try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (e2) { console.log('SKIP: playwright が無い'); process.exit(0); } }
try { sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (e) { sharp = null; }

if (has('--list')) {
  for (const sc of SCENES) console.log(`${sc.id.padEnd(20)} ${sc.area} / ${sc.name}${sc.group ? `(${sc.group}・既定では撮らない)` : ''}`);
  console.log(`\n大きさ: ${SIZES.map((z) => `${z.tag}=${z.w}×${z.h}(${z.name})`).join(' / ')}`);
  console.log(`モンサクの奥(--monsuc-deep): ${MONSUC_DEEP.map((d) => `${d.tool}(${d.note})`).join(' / ')}`);
  process.exit(0);
}

const only = opt('--only').split(',').filter(Boolean);
const sizeTags = opt('--sizes').split(',').filter(Boolean);
const scenes = SCENES.filter((sc) => (only.length ? only.includes(sc.id) : (!sc.group || (sc.group === 'monsuc' && has('--with-monsuc')))));
const sizes = SIZES.filter((z) => !sizeTags.length || sizeTags.includes(z.tag));

const OUT_BASE = path.join(ROOT, 'tools', 'out', 'visual');
const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
const OUT = opt('--out') || path.join(OUT_BASE, stamp);
const PREV = opt('--prev') || (() => {
  if (!fs.existsSync(OUT_BASE)) return '';
  const dirs = fs.readdirSync(OUT_BASE).filter((d) => d !== path.basename(OUT) && fs.existsSync(path.join(OUT_BASE, d, 'results.json'))).sort();
  return dirs.length ? path.join(OUT_BASE, dirs[dirs.length - 1]) : '';
})();
const PORT = Number(process.env.VISUAL_PORT) || 8993;

// 通信が止まっていることで出るだけのエラー(session.js と同じ)
const IGNORE_CONSOLE = /ERR_FAILED|ERR_BLOCKED|net::|Failed to load resource|AudioContext|play\(\) failed|NotAllowedError|autoplay|The play\(\) request/i;
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (f.startsWith(ROOT) && serveRev.serve(FROM_REV, ROOT, f, res, MIME[path.extname(f)])) return;
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 優先度: 高 = 遊べない・明らかに壊れて見える / 中 = 読めない・隠れる / 低 = 気になる・確かめたい
const PRIORITY = { 開けなかった: '高', 真っ白: '高', JSエラー: '高', 変な字: '高', 横はみ出し: '高', コンソールエラー: '中', 字と字の重なり: '中', 字と絵の重なり: '中',
  文字の折れ: '低', 読みにくい色: '中', 前の版と差: '低' };
const findings = [];
const add = (scene, size, kind, detail, shot, extra = {}) => findings.push({ scene: scene.id, name: scene.name, area: scene.area, size: size.tag, kind,
  priority: extra.priority || PRIORITY[kind] || '低', by: '機械', detail: String(detail).slice(0, 240), shot });

async function shootSize(size, server) {
  const botOut = path.join(OUT, '_bot', size.tag);
  const shotDir = path.join(OUT, 'shots', size.tag);
  fs.mkdirSync(botOut, { recursive: true });
  fs.mkdirSync(shotDir, { recursive: true });
  const report = { headed: false, shotNo: 0, issues: [], issueKeys: new Set(), steps: [], screens: new Map() };
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
  const s = await openSession({ playwright, pageUrl: `http://localhost:${PORT}/monster-hero/index.html`, port: PORT, out: botOut, rand, persona: `visual-${size.tag}`, report, viewport: { width: size.w, height: size.h } });
  // SHOT_NOTCH=1 … iPhone の切り欠きの余白を入れて撮る(2026-11-22 窓口の決まり: 縦 上47・下34 / 横 左右47・下21)。
  //   画面の余白は var(--mh-safe-*) から入る(index.html の --mh-sa-*)。env() を直に書いた部品には効かない
  if (process.env.SHOT_NOTCH === '1') {
    await s.page.addInitScript((land) => { document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style;
      const v = land ? { top: '0px', bottom: '21px', left: '47px', right: '47px' } : { top: '47px', bottom: '34px', left: '0px', right: '0px' };
      Object.entries(v).forEach(([k, x]) => r.setProperty(`--mh-safe-${k}`, x)); }); }, size.w > size.h);
  }
  const errs = [];
  s.page.on('pageerror', (e) => errs.push({ kind: 'JSエラー', text: String((e && e.message) || e) }));
  s.page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.test(m.text())) errs.push({ kind: 'コンソールエラー', text: m.text() }); });
  const done = [];
  try {
    await prepareVeteran(s);
    await s.boot();
    for (const sc of scenes) {
      const t0 = Date.now();
      errs.length = 0;
      let ok = false;
      try { await s.backHome(); await s.dismissOverlays(10); ok = await sc.go(s); } catch (e) { ok = false; }
      const rel = path.join('shots', size.tag, `${sc.id}.png`);
      if (!ok) { add(sc, size, '開けなかった', 'HOME から押す手順の途中のボタンが見つからない(場面の手順を直すか、画面が変わった)', ''); done.push({ id: sc.id, ok: false }); continue; }
      await s.page.addStyleTag({ content: FREEZE }).catch(() => {});
      // 押すためにスクロールした所を戻し、画面の頭から撮る(場面ごとに同じ絵になるように)
      await s.page.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; if (e.scrollLeft) e.scrollLeft = 0; }); }).catch(() => {});
      await s.wait(1200);
      const png = await s.page.screenshot().catch(() => null);
      if (!png) { add(sc, size, '開けなかった', '止め絵が撮れない', ''); continue; }
      fs.writeFileSync(path.join(OUT, rel), png);
      const m = await measurePage(s.page).catch(() => null);
      for (const x of await uiMeasure.record(s.page, path.join(OUT, rel), { scene: sc.id, size: size.tag })) add(sc, size, `測る:${x.kind}`, x.detail, rel, { priority: x.pri });
      if (m) {
        if (m.textLen === 0) add(sc, size, '真っ白', '画面に文字が1つも無い', rel);
        m.badText.slice(0, 5).forEach((b) => add(sc, size, '変な字', `「${b.text}」(${b.where})`, rel));
        if (m.overflowX > 8) add(sc, size, '横はみ出し', `ページが画面幅より ${Math.round(m.overflowX)}px 広い`, rel);
        m.textOverlap.slice(0, 4).forEach((o) => add(sc, size, '字と字の重なり', `「${o.a}」と「${o.b}」が ${o.rate}% かぶる(${o.where})`, rel));
        m.textImage.slice(0, 4).forEach((o) => add(sc, size, '字と絵の重なり', `「${o.text}」の上に ${o.pic} が描かれて字が隠れる(${o.where})`, rel));
        if (sharp && m.forContrast.length) {
          const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const low = contrastFromPixels(data, info, info.width / m.view.w, m.forContrast);
          low.sort((a, b) => a.ratio - b.ratio).slice(0, 4).forEach((c) => add(sc, size, '読みにくい色', `「${c.text}」文字 ${c.fg} / 地 ${c.bg} で比 ${c.ratio}(${c.size}px・${c.where})`, rel, { priority: c.ratio < 1.6 ? '中' : '低' }));
        }
      }
      // 「画面の外へはみ出した文字」は、ページ自体がはみ出していないとき(横に流れる列・スクロールの中)は数えない
      (await scanTextWrap(s.page)).filter((w) => !(m && m.overflowX <= 8 && /画面の外/.test(w.kind))).slice(0, 4).forEach((w) => add(sc, size, '文字の折れ', `${w.kind}: ${String(w.text).replace(/\n/g, ' ')}(${w.detail})`, rel));
      [...new Map(errs.map((e) => [e.kind + e.text.slice(0, 100), e])).values()].slice(0, 4).forEach((e) => add(sc, size, e.kind, e.text, rel));
      if (PREV && sharp) {
        const prevPng = path.join(PREV, rel);
        if (fs.existsSync(prevPng)) {
          const rate = await diffAgainst(sharp, png, prevPng).catch(() => 0);
          if (rate > 0.25) add(sc, size, '前の版と差', `前の版(${path.basename(PREV)})から ${Math.round(rate * 100)}% 変わった。わざとか崩れかを見る(前: ${path.relative(ROOT, prevPng)})`, rel);
        }
      }
      done.push({ id: sc.id, ok: true, ms: Date.now() - t0 });
      process.stdout.write(`  ${size.tag} ${sc.id} ${((Date.now() - t0) / 1000).toFixed(1)}秒\n`);
    }
  } finally {
    await s.close();
  }
  return { size: size.tag, done };
}

function runMonsucDeep() {
  const res = [];
  for (const d of MONSUC_DEEP) {
    const dir = path.join(OUT, 'shots', 'monsuc-deep', path.basename(d.tool, '.js'));
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(ROOT, d.tool)], { env: { ...process.env, ...d.env, SHOT_DIR: dir }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ng = String(r.stdout || '').split('\n').filter((l) => l.startsWith('NG'));
    ng.slice(0, 30).forEach((l) => findings.push({ scene: path.basename(d.tool, '.js'), name: 'モンサクの奥', area: 'モンサク', size: '-', kind: '既存の道具のNG', priority: '中', by: '機械', detail: l.slice(0, 240), shot: path.relative(OUT, dir) }));
    res.push({ tool: d.tool, ng: ng.length, sec: Math.round((Date.now() - t0) / 1000) });
  }
  return res;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  console.log(`見た目の点検: ${scenes.length}場面 × ${sizes.length}つの大きさ → ${path.relative(ROOT, OUT)}${PREV ? `(比べる相手: ${path.basename(PREV)})` : '(比べる相手なし)'}`);
  const server = await serve();
  let perSize = [];
  try {
    perSize = await Promise.all(sizes.map((z) => shootSize(z, server).catch((e) => { console.log(`  ${z.tag}: 途中で止まった ${e.message}`); return { size: z.tag, done: [], error: e.message }; })));
  } finally { server.close(); }
  const deep = has('--monsuc-deep') ? runMonsucDeep() : [];
  fs.rmSync(path.join(OUT, '_bot'), { recursive: true, force: true });
  const order = { 高: 0, 中: 1, 低: 2 };
  findings.sort((a, b) => order[a.priority] - order[b.priority] || a.scene.localeCompare(b.scene) || a.size.localeCompare(b.size));
  const shots = perSize.reduce((n, p) => n + p.done.filter((d) => d.ok).length, 0);
  const count = (p) => findings.filter((f) => f.priority === p).length;
  const result = { at: stamp, minutes: Math.round((Date.now() - t0) / 6000) / 10, scenes: scenes.map((s) => ({ id: s.id, area: s.area, name: s.name })),
    sizes: sizes.map((z) => ({ tag: z.tag, w: z.w, h: z.h, name: z.name })), shots, prev: PREV ? path.basename(PREV) : '', perSize, monsucDeep: deep, findings };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(result, null, 2));
  const lines = [
    `# 見た目の点検 ${stamp}`, '',
    `- 場面 ${scenes.length} × 大きさ ${sizes.length}(${sizes.map((z) => `${z.w}×${z.h}`).join('・')}) / 撮れた止め絵 ${shots}枚 / ${result.minutes}分`,
    `- 見つけた物: 高 ${count('高')}・中 ${count('中')}・低 ${count('低')}(機械の見つけ方だけ。Claude API の目はまだ)`, '',
    '| 優先度 | 画面 | 大きさ | 起きること | 中身 | 止め絵 |', '|---|---|---|---|---|---|',
    ...findings.map((f) => `| ${f.priority} | ${f.name} | ${f.size} | ${f.kind} | ${f.detail.replace(/\|/g, '／')} | ${f.shot} |`),
  ];
  fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
  console.log(`\n撮れた止め絵 ${shots}枚 / 見つけた物 高 ${count('高')}・中 ${count('中')}・低 ${count('低')} / ${result.minutes}分`);
  findings.slice(0, 8).forEach((f) => console.log(`  [${f.priority}] ${f.name}(${f.size}) ${f.kind}: ${f.detail.slice(0, 90)}`));
  console.log(`→ ${path.relative(ROOT, path.join(OUT, 'summary.md'))}`);
})();
