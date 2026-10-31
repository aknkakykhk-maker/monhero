// 技カードの動きを1つずつ流して録る: node rec-act.js <port> <now|A> <出力.mp4>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const [port, ver, out] = process.argv.slice(2);
const CUT = ver === 'cut';
const CARDS = process.env.CARDS ? process.env.CARDS.split(',') : ['261', '018', '131', '147', '357', '311', '264', '242', '232'];
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
    const st = document.createElement('style'); st.textContent = `
      .ci{position:absolute;left:0;right:0;top:300px;height:210px;z-index:90;pointer-events:none;overflow:hidden}
      .ci-flash{position:absolute;inset:-40px 0;background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.95),rgba(255,230,120,.6) 40%,transparent 70%);animation:ciFlash 1s ease-out both}
      .ci-band{position:absolute;left:-10px;right:-10px;top:24px;bottom:24px;background:linear-gradient(90deg,#f59e0b,#fde047 18%,#fff7cc 50%,#fde047 82%,#f59e0b);transform:skewY(-7deg);animation:ciBand 1s ease-out both;box-shadow:0 0 0 4px #fff,0 0 40px 10px rgba(253,224,71,.95)}
      .ci-lines{position:absolute;left:-10px;right:-10px;top:24px;bottom:24px;transform:skewY(-7deg);background:repeating-linear-gradient(90deg,rgba(255,255,255,.65) 0 3px,transparent 3px 30px);mix-blend-mode:overlay;animation:ciLines 1s linear both}
      .ci-card{position:absolute;top:8px;height:194px;aspect-ratio:5/7;border-radius:10px;box-shadow:0 0 0 4px #fff,0 0 30px 8px rgba(255,255,255,.95);animation:ciCard 1s cubic-bezier(.2,.9,.3,1) both}
      .ci-name{position:absolute;left:158px;right:6px;top:62px;font-size:44px;line-height:1.05;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:3px #b45309;paint-order:stroke fill;text-shadow:0 0 14px #fff,0 4px 0 #78350f;white-space:nowrap;animation:ciName 1s cubic-bezier(.2,1.4,.4,1) both}
      .ci-sub{position:absolute;left:162px;top:122px;font-size:17px;font-weight:900;color:#7c2d12;background:#fff;padding:1px 10px;border-radius:999px;animation:ciName 1s .05s cubic-bezier(.2,1.4,.4,1) both}
      @keyframes ciFlash{0%{opacity:0}10%{opacity:1}40%{opacity:0}100%{opacity:0}}
      @keyframes ciBand{0%{opacity:0;transform:skewY(-7deg) scaleY(0)}12%{opacity:1;transform:skewY(-7deg) scaleY(1.15)}20%{transform:skewY(-7deg) scaleY(1)}85%{opacity:1}100%{opacity:0;transform:skewY(-7deg) scaleY(.2)}}
      @keyframes ciLines{0%{background-position:0 0;opacity:0}15%{opacity:1}100%{background-position:-420px 0;opacity:0}}
      @keyframes ciCard{0%{left:420px;transform:rotate(10deg) scale(1.2)}22%{left:14px;transform:rotate(-5deg) scale(1)}85%{left:6px;opacity:1}100%{left:-200px;opacity:0}}
      @keyframes ciName{0%{opacity:0;transform:translateX(160px) scale(1.6)}22%{opacity:1;transform:none}85%{opacity:1;transform:none}100%{opacity:0;transform:translateX(-80px)}}`; document.head.appendChild(st);
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
        E('div', { style: { position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', fontWeight: 900, fontSize: 22, textShadow: '0 2px 4px #000' } }, `${ver === 'now' ? '今' : ver === 'cut' ? '案A+カットイン' : '案A'}: ${m.name}の「${c.name}」`),
        E('div', { style: { position: 'absolute', top: 52, left: 0, right: 0, textAlign: 'center', fontSize: 14, color: '#cbd5e1' } }, `${c.kind === 'pow' ? 'ちから' : 'かしこさ'}・ダメージ${c.damage}${cardHasEff(c, 'area') ? '・全員' : ''}(${tier})`),
        E('div', { id: 'tg', className: 'flex items-end justify-center', style: { position: 'absolute', top: 150, left: 0, right: 0, height: 150 } }, E('img', { src: target, style: { height: 150, transform: 'scaleX(-1)' } })),
        E('div', { className: 'relative flex items-end justify-center', style: { position: 'absolute', top: 520, left: 0, right: 0, height: 160, isolation: 'isolate', zIndex: 40, '--atk-dx': '0px', '--atk-dy': '-370px' } },
          E(SkillFxMotion, { key: `${no}-${Date.now()}`, kind, image: E('img', { src: art, style: { height: 160 } }) })),
        ver === 'cut' && c.damage >= 6 ? E('div', { className: 'ci', key: `ci-${no}` }, E('div', { className: 'ci-flash' }), E('div', { className: 'ci-band' }), E('div', { className: 'ci-lines' }),
          E('img', { className: 'ci-card', src: CARD_IMG(c.img) }), E('div', { className: 'ci-name', style: { fontSize: c.name.length <= 4 ? 46 : c.name.length <= 6 ? 36 : 28 } }, c.name), E('div', { className: 'ci-sub' }, `${m.name}の大技!`)) : null));
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
