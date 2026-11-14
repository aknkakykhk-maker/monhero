// モンヒロサクセスの大会の「見せる」部品(56-monhero-success-cup.jsx)と試合の画面(56-monhero-success-arena.jsx)の止め絵を撮る(2026-11-12 バトル部)
// 使い方: node tools/battle/monsuc-cup-shoot.js [--dsf=1]
// 出す物: docs/progress/player-raise/cup-show/png/<向き>-<場面>.png(縦 390×844・横 844×390・幅 320×640)と一覧 sheet.png
// ゲーム本体(index.html)を開き、計算の芯(data/monhero-success.js)を足して本物の育成の状態を作り、部品だけを描く。何も保存しない。
// 撮る前に見張る: 絵が読めない/字が横にはみ出す/実行時エラー
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'progress', 'player-raise', 'cup-show', 'png');
const PORT = 8981;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const dsfArg = process.argv.find(a => a.startsWith('--dsf='));
const DSF = dsfArg ? Number(dsfArg.slice(6)) || 2 : 2;

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

const VIEWS = [
  { id: 'tate', w: 390, h: 844 },
  { id: 'yoko', w: 844, h: 390 },
  { id: 'w320', w: 320, h: 640 },
];
// 場面: どの状態を作り、どこから始め、何ミリ秒待って撮るか
const SCENES = [
  { id: 'B1-bracket', state: 'rival', startAt: 'bracket', wait: 2600 },
  { id: 'C2-card', state: 'rival', startAt: 'card', wait: 1500 },
  { id: 'Y2-cutin', state: 'summit', startAt: 'cutin', wait: 900 },
  // 試合(MonsucArena・自分操作): 手を選ぶ帯が出たところ / 技を押して動きの途中(click … 押すボタン・after … 押してから撮るまで)
  { id: 'M1-pick', state: 'rival', startAt: 'match', wait: 4200 },
  { id: 'M2-attack', state: 'rival', startAt: 'match', wait: 4200, click: '[data-msxm-tech]:not([disabled])', after: 520 },
  { id: 'B2-win', state: 'rival', startAt: 'win', wait: 1400 },
  { id: 'C4-lose', state: 'champ', startAt: 'lose', wait: 900 },
];

(async () => {
  const { chromium } = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const problems = [];
  const shots = [];
  try {
    for (const v of VIEWS) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: DSF });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof MonsucCupShow === 'function' && typeof React !== 'undefined', null, { timeout: 60000 });
      await page.addScriptTag({ url: '/monster-hero/data/monhero-success-regulars.js' });
      await page.addScriptTag({ url: '/monster-hero/data/monhero-success.js' });
      await page.waitForTimeout(1500);
      for (const sc of SCENES) {
        const res = await page.evaluate(({ sc }) => {
          const SUC = MONHERO_SUCCESS.create({ calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT, techs: ASSISTANT_MASMON_TECHS, types: typeof MONSTER_TYPE_OF !== 'undefined' ? MONSTER_TYPE_OF : undefined,
            monsters: ALL_PLAYER_MONSTERS, regulars: MONSUC_REGULARS, cupNames: MONSUC_REGULAR_CUPS });
          const aid = sc.state === 'summit' ? 'kiki' : 'mua';
          let s = SUC.newRun({ id: 'shoot-' + sc.state, species: 'Mocchi', aid, items: { sand: 2, rainbow: 1 },
            rivals: [{ name: 'こんこ', species: 'Kyubi', breeder: 'あつ', stats: { life: 455, pow: 472, wise: 180, hit: 341, eva: 260, tough: 498 } }] });
          s = JSON.parse(JSON.stringify(s));
          s.stats = { life: 412, pow: 506, wise: 233, hit: 380, eva: 198, tough: 441 };
          s.pop = 45; s.lv = 12; s.ama = 40; s.fear = 32; s.turn = 24;
          if (sc.state === 'rival') s.battle = { kind: 'cup', id: 'middle:4:spring:3', sys: 'spring', star: 3, rival: { name: 'こんこ' }, round: 0 };
          if (sc.state === 'champ') { s.battle = { kind: 'cup', id: 'middle:4:str:2', sys: 'str', star: 2, rival: null, round: 0 }; s.rematchUsed = 1; }
          if (sc.state === 'summit') { s.turn = 44; s.special = true; s.battle = { kind: 'summit', round: 0 }; s.stats = { life: 812, pow: 906, wise: 433, hit: 780, eva: 598, tough: 841 }; }
          const old = document.getElementById('msc-shoot'); if (old && old.__root) old.__root.unmount(); if (old) old.remove();
          const div = document.createElement('div'); div.id = 'msc-shoot'; document.body.appendChild(div);
          const root = ReactDOM.createRoot(div); div.__root = root;
          root.render(React.createElement(MonsucCupShow, { suc: SUC, s, me: { name: 'もちまる' }, startAt: sc.startAt, opp: { loy: 60, pop: 38 }, title: sc.state === 'rival' ? '春の大会' : sc.state === 'champ' ? 'ちから自慢の大会' : undefined,
            previewOut: { prize: 750, tickets: 1, rows: [
              { i: '💪', k: '全能力', v: '+12(ライバルに勝った・主なごほうび)', big: true },
              { i: '🏅', k: '称号', v: '「春の覇者」「ライバルに勝った」' },
              { i: '🔷', k: '能力ポイント', v: '+10' },
              { i: '🎫', k: '修行チケット', v: '+1' },
              { i: '💰', k: '賞金', v: '+750(×1.5)' },
            ] },
            settle: () => ({}), onRematch: () => {}, onNext: () => {}, onClose: () => {} }));
          return true;
        }, { sc });
        if (!res) problems.push(`${v.id}/${sc.id}: 描けなかった`);
        await page.waitForTimeout(sc.wait);
        if (sc.click) {
          // 届く技が無ければ、前へ詰めて相手の番を見せ終わるのを待ち、もう一度(最大4回)
          let ok = false;
          for (let k = 0; k < 4 && !ok; k++) {
            const r = await page.evaluate((q) => {
              const card = document.querySelector('[data-msa-dc="manual"] [data-msa-dc-card].now:not([disabled])'); if (card) card.click();   // 技の札(間合いごと4枚): いまの間合いの札を押すと一覧
              const b = document.querySelector(q); if (b) { b.click(); return 'tech'; }
              const x = document.querySelector('[data-msa-sheet-close]'); if (x) x.click();
              const f = [...document.querySelectorAll('.msxm-btn:not([disabled])')].find(x => /前へ/.test(x.textContent)); if (f) { f.click(); return 'move'; }
              return '';
            }, sc.click);
            if (r === 'tech') ok = true;
            else await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 15000 }).catch(() => {});
          }
          if (!ok) problems.push(`${v.id}/${sc.id}: 押す技が無い`);
          await page.waitForTimeout(sc.after || 400);
        }
        const chk = await page.evaluate(() => {
          const out = []; const R = document.querySelector('[data-msc-root]');
          if (!R) return ['部品が出ていない'];
          const W = R.getBoundingClientRect().width;
          for (const im of R.querySelectorAll('img')) if (im.complete && !im.naturalWidth) out.push('読めない絵 ' + im.getAttribute('src'));
          for (const e of R.querySelectorAll('*')) {
            const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!txt) continue;
            const r = e.getBoundingClientRect(); if (!r.width) continue;
            if (r.right > W + 1 || r.left < -1) out.push('字が画面の外「' + e.textContent.trim().slice(0, 14) + '」');
          }
          if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('横にスクロールしてしまう');
          return [...new Set(out)];
        });
        chk.forEach(c => problems.push(`${v.id}/${sc.id}: ${c}`));
        const file = path.join(OUT, `${v.id}-${sc.id}.png`);
        await page.screenshot({ path: file });
        shots.push(path.relative(ROOT, file));
      }
      errs.forEach(e => problems.push(`${v.id}: 実行時エラー ${e.slice(0, 160)}`));
      await page.close();
    }
    // 一覧(縦だけを横に並べる)
    const sheet = await browser.newPage({ viewport: { width: SCENES.length * 400 + 20, height: 900 }, deviceScaleFactor: 1 });
    const imgs = SCENES.map(sc => `<figure style="margin:0;display:inline-block;width:390px;margin-right:10px;vertical-align:top"><img style="width:390px" src="data:image/png;base64,${fs.readFileSync(path.join(OUT, `tate-${sc.id}.png`)).toString('base64')}"><figcaption style="font:bold 14px sans-serif;color:#fff;text-align:center">${sc.id}</figcaption></figure>`).join('');
    await sheet.setContent(`<body style="margin:10px;background:#111">${imgs}</body>`);
    await sheet.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
    shots.push(path.relative(ROOT, path.join(OUT, 'sheet.png')));
  } finally {
    await browser.close(); server.close();
  }
  console.log(`撮った: ${shots.length} 枚 → ${path.relative(ROOT, OUT)}`);
  if (problems.length) { console.log(`見張りで見つかったこと ${problems.length} 件:`); problems.slice(0, 20).forEach(p => console.log('  - ' + p)); process.exitCode = 1; }
  else console.log('見張り: 問題なし');
})();
