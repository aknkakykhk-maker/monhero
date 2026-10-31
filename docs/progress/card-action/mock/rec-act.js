// 技カードの動きを1つずつ流して録る: node rec-act.js <port> <now|A> <出力.mp4>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const [port, ver, out] = process.argv.slice(2);
const CUT = ver === 'cut';
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
    const st = document.createElement('style'); st.textContent = `
      .ci{position:absolute;left:0;right:0;top:330px;height:150px;z-index:90;pointer-events:none;overflow:hidden}
      .ci-band{position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,10,40,.0),rgba(15,10,40,.92) 12%,rgba(60,20,90,.92) 50%,rgba(15,10,40,.92) 88%,rgba(15,10,40,0));transform:skewY(-6deg);animation:ciBand .6s ease-out both;border-top:3px solid #fde047;border-bottom:3px solid #fde047;box-shadow:0 0 30px rgba(253,224,71,.6)}
      .ci-lines{position:absolute;inset:0;transform:skewY(-6deg);background:repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 2px,transparent 2px 26px);animation:ciLines .6s linear both}
      .ci-card{position:absolute;top:10px;height:130px;aspect-ratio:5/7;border-radius:8px;box-shadow:0 0 0 3px #fff,0 0 24px 6px rgba(253,224,71,.9);animation:ciCard .6s cubic-bezier(.2,.9,.3,1) both}
      .ci-name{position:absolute;left:150px;right:8px;top:38px;font-size:34px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:1.5px #7c2d12;text-shadow:0 0 12px #f59e0b,0 3px 0 #7c2d12;white-space:nowrap;animation:ciName .6s cubic-bezier(.2,1.4,.4,1) both}
      .ci-sub{position:absolute;left:152px;top:88px;font-size:14px;font-weight:900;color:#fde047;animation:ciName .6s .05s cubic-bezier(.2,1.4,.4,1) both}
      @keyframes ciBand{0%{opacity:0;transform:skewY(-6deg) scaleY(0)}20%{opacity:1;transform:skewY(-6deg) scaleY(1)}80%{opacity:1}100%{opacity:0;transform:skewY(-6deg) scaleY(.2)}}
      @keyframes ciLines{0%{background-position:0 0;opacity:0}20%{opacity:1}100%{background-position:-260px 0;opacity:0}}
      @keyframes ciCard{0%{left:420px;transform:rotate(8deg)}30%{left:22px;transform:rotate(-4deg)}80%{left:12px;opacity:1}100%{left:-160px;opacity:0}}
      @keyframes ciName{0%{opacity:0;transform:translateX(120px) scale(1.4)}30%{opacity:1;transform:none}80%{opacity:1;transform:none}100%{opacity:0;transform:translateX(-60px)}}`; document.head.appendChild(st);
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
        ver === 'cut' && c.damage >= 6 ? E('div', { className: 'ci', key: `ci-${no}` }, E('div', { className: 'ci-band' }), E('div', { className: 'ci-lines' }),
          E('img', { className: 'ci-card', src: CARD_IMG(c.img) }), E('div', { className: 'ci-name' }, c.name), E('div', { className: 'ci-sub' }, `${m.name}の大技!`)) : null));
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
