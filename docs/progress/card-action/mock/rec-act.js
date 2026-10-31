// 技カードの動きを1つずつ流して録る: node rec-act.js <port> <now|A> <出力.mp4>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const [port, ver, out] = process.argv.slice(2);
const CARDS = ['261', '018', '131', '147', '357', '311', '264', '242', '232'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const dir = fs.mkdtempSync(path.join(path.dirname(out), 'raw-'));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof SkillFxMotion === 'function' && typeof cardMotionKindOf === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
  const t0 = Date.now();
  await page.evaluate((ver) => {
    window.__cardMotionV = ver === 'now' ? 'now' : 'A';
    const h = document.createElement('div'); h.id = 'h';
    h.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 40%,#3b2a6b,#120d2a);color:#fff;overflow:hidden';
    document.body.appendChild(h);
    window.__root = ReactDOM.createRoot(h);
  }, ver);
  for (const no of CARDS) {
    const ms = await page.evaluate(([no, ver]) => {
      const db = CARD_BATTLE_DATA; const c = cardOf(db, no);
      const m = Object.values(db.monsters).find((x) => x.species === c.user && !x.main && !/キラ/.test(x.variant || ''));
      const art = cardMonArt(m);
      const target = cardMonArt(db.monsters['C-007']);
      const kind = cardMotionKindOf(db, no, null);
      const E = React.createElement;
      const tier = c.damage >= 6 ? '大技' : c.damage >= 3 || cardHasEff(c, 'area') ? 'ふつう' : '軽い';
      window.__root.render(E('div', { key: no, style: { position: 'absolute', inset: 0 } },
        E('div', { style: { position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', fontWeight: 900, fontSize: 22, textShadow: '0 2px 4px #000' } }, `${ver === 'now' ? '今' : '案A'}: ${m.name}の「${c.name}」`),
        E('div', { style: { position: 'absolute', top: 52, left: 0, right: 0, textAlign: 'center', fontSize: 14, color: '#cbd5e1' } }, `${c.kind === 'pow' ? 'ちから' : 'かしこさ'}・ダメージ${c.damage}${cardHasEff(c, 'area') ? '・全員' : ''}(${tier})`),
        E('div', { id: 'tg', className: 'flex items-end justify-center', style: { position: 'absolute', top: 150, left: 0, right: 0, height: 150 } }, E('img', { src: target, style: { height: 150, transform: 'scaleX(-1)' } })),
        E('div', { className: 'relative flex items-end justify-center', style: { position: 'absolute', top: 520, left: 0, right: 0, height: 160, isolation: 'isolate', zIndex: 40, '--atk-dx': '0px', '--atk-dy': '-370px' } },
          E(SkillFxMotion, { key: `${no}-${Date.now()}`, kind, image: E('img', { src: art, style: { height: 160 } }) }))));
      const sp = skillFxSpecOf(kind);
      setTimeout(() => { const t = document.getElementById('tg'); if (t) { t.classList.add('mh-card-hit'); } }, sp ? sp.hit : 400);
      return cardMotionMs(kind);
    }, [no, ver]);
    await page.waitForTimeout(ms + 1100);
  }
  const total = Date.now() - t0;
  await ctx.close(); await b.close();
  const webm = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  const d = Number(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dir, webm)]).toString());
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, d - total / 1000)), '-i', path.join(dir, webm), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '24', '-an', out]);
  console.log(out, errors.slice(0, 2));
})();
