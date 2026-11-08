// 呼び方の案の止め絵。本物の起動 → おしゃべりの窓 → 案の部品を重ねて撮る
const path = require('path'), fs = require('fs'), http = require('http');
const root = '/home/user/monhero';
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(root, 'tools/boot/quiet-boot-seed'));
const OUT = path.join(root, 'docs/progress/assistant-peer/shots');
const PORT = 8931;
const LOG = { mua: [
  { role: 'user', text: 'みゅあ、今日もHELLがんばったよ', e: 'happy' },
  { role: 'assistant', text: 'テストさんすごっ！ まぢ毎日えらいぢゃん♪', e: 'excited' },
  { role: 'user', text: 'ありがと！ あとさ、これからは「あっちゃん」って呼んでほしいな' },
  { role: 'assistant', text: 'えっ、いいの!? じゃあ……あっちゃん！ なんか照れるけど、うれしいぢゃん♪', e: 'happy' },
] };
const ASK_LOG = { mua: [
  { role: 'user', text: 'ただいまー！' },
  { role: 'assistant', text: 'おかえり〜♪ ねえねえ、ずっと思ってたんだけど……テストさんのこと、なんて呼んだらいい？ もっと仲良しっぽく呼んでみたいなって♪', e: 'wink' },
] };
const CSS = `
.cn-card{margin:6px 0 2px;border:1.5px solid #f472b6;border-radius:14px;background:rgba(244,114,182,.12);padding:8px 10px;color:#fce7f3;font-size:11px;font-weight:800;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
.cn-card b{color:#fff;font-size:13px}
.cn-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.cn-btn{flex:1 1 auto;min-height:36px;border-radius:12px;font-size:11px;font-weight:900;padding:0 10px;border:1px solid #64748b;background:#1e293b;color:#e2e8f0}
.cn-btn.ok{background:#f472b6;border-color:#f472b6;color:#fff}
.cn-chip{min-height:32px;border-radius:999px;font-size:11px;font-weight:900;padding:0 12px;border:1px solid #f472b6;background:#0f172a;color:#fbcfe8}
.cn-note{margin:4px auto;text-align:center;font-size:10px;font-weight:800;color:#94a3b8;word-break:keep-all;overflow-wrap:anywhere}
.cn-note b{color:#f9a8d4}
.cn-pop{position:absolute;left:50%;top:20%;transform:translateX(-50%);width:min(320px,86%);z-index:99999;border:2px solid #f472b6;border-radius:18px;background:rgba(2,6,23,.94);padding:10px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.6)}
.cn-pop img{width:46px;height:46px;border-radius:999px;border:2px solid #f472b6;object-fit:cover;flex:none}
.cn-pop p{margin:0;color:#fce7f3;font-size:12px;font-weight:800;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
.cn-tag{display:inline-block;margin-top:3px;font-size:9px;font-weight:900;color:#0f172a;background:#f9a8d4;border-radius:6px;padding:1px 6px}
`;
const serve = () => new Promise(r => { const s = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(root, rel); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async ({ name, w, h, log, mode }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.addInitScript((lg) => { if (!localStorage.getItem('cn_seeded')) { localStorage.setItem('cn_seeded', '1'); localStorage.setItem('mh_assistant_bond_v1', JSON.stringify({ points: 420 })); localStorage.setItem('mh_assistant_chat_log_v1', JSON.stringify(lg)); localStorage.setItem('mh_story_assistant_chat_seen_v1', 'true'); } }, log);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await page.waitForTimeout(1500); await finishTalk(page);
    await page.addStyleTag({ content: CSS });
    if (mode === 'rot') {
      await page.evaluate(() => { const i = document.querySelector('.mh-home-assistant img'); window.__cnFace = i ? i.src : ''; });
      await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
      await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
      await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const host = document.querySelector('[data-mh-view-rotation="true"]') || document.body;
        const face = { src: window.__cnFace };
        const d = document.createElement('div'); d.className = 'cn-pop'; d.setAttribute('data-cn-mock', '');
        d.innerHTML = `<img src="${face ? face.src : ''}"><p>あっちゃん、おつかれ♪ 呼び方、ちゃんと覚えてるからね！<br><span class="cn-tag">みゅあの呼び方：あっちゃん</span></p>`;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(d);
      });
    } else {
      await page.locator('[data-home-assistant-chat]').dispatchEvent('click');
      await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(600);
      await page.evaluate((mode) => {
        const msgs = [...document.querySelectorAll('[data-assistant-chat-msg="assistant"]')];
        const last = msgs[msgs.length - 1];
        const box = document.createElement('div');
        if (mode === 'confirm') {
          box.innerHTML = `<div class="cn-card">これから「<b>あっちゃん</b>」って呼んでいい？<div class="cn-row"><button class="cn-btn ok">うん、そう呼んで</button><button class="cn-btn">いまのままで</button></div></div>
            <p class="cn-note">「うん」を押すと、<b>みゅあ</b>だけ呼び方が変わります。プロフィールで元に戻せます</p>`;
        } else {
          box.innerHTML = `<div class="cn-card">呼び方をえらぶか、送る欄に書いてね<div class="cn-row"><button class="cn-chip">テストちゃん</button><button class="cn-chip">テストっち</button><button class="cn-chip">テスト</button></div><div class="cn-row"><button class="cn-btn">いまのまま(テストさん)</button></div></div>`;
        }
        last.insertAdjacentElement('afterend', box);
        const list = box.parentElement; if (list) list.scrollTop = list.scrollHeight;
      }, mode);
      await page.waitForTimeout(300);
    }
    // 見た目の見張り: 重ねた部品のボタン・文字が箱からはみ出していないか
    const ng = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.cn-card,.cn-pop,.cn-note').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) out.push('横にはみ出し:' + el.className); });
      document.querySelectorAll('.cn-btn,.cn-chip').forEach(b => { if (b.scrollWidth > b.clientWidth + 1) out.push('ボタンの文字が切れる:' + b.textContent); });
      return out;
    });
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), quality: 82 });
    console.log(name, ng.length ? 'NG ' + ng.join(' / ') : 'OK', errors.length ? 'エラー ' + errors[0] : '');
    await page.close();
  };
  try {
    await shot({ name: 'callname-1-confirm-portrait', w: 390, h: 844, log: LOG, mode: 'confirm' });
    await shot({ name: 'callname-2-ask-landscape', w: 844, h: 390, log: ASK_LOG, mode: 'ask' });
    await shot({ name: 'callname-3-confirm-landscape', w: 667, h: 375, log: LOG, mode: 'confirm' });
    await shot({ name: 'callname-4-ask-portrait-small', w: 320, h: 568, log: ASK_LOG, mode: 'ask' });
    await shot({ name: 'callname-5-rot-beat', w: 390, h: 844, log: LOG, mode: 'rot' });
  } finally { await browser.close(); server.close(); }
})();
