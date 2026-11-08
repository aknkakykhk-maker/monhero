// 作った呼び方の画面を本物で撮る(公開の印はページの中だけ真にする・中継役は偽物の Claude)
const path = require('path'), fs = require('fs'), http = require('http');
const root = '/home/user/monhero';
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(root, 'tools/boot/quiet-boot-seed'));
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/data/assistant-chat-digest.json'), 'utf8'));
const OUT = path.join(root, 'docs/progress/assistant-peer/shots');
const PORT = 8932;
const MEMO = { likes: '', goals: '', events: '', topics: '', summary: '', secret: '' };
(async () => {
  const core = await import(path.join(root, 'supabase/functions/assistant-chat/core.js'));
  const client = { messages: { create: async (p) => {
    const last = [...p.messages].reverse().find(m => m.role === 'user');
    const said = Array.isArray(last.content) ? last.content.map(c => c.text || '').join('') : String(last.content);
    const call = /あっちゃん/.test(said) ? { action: 'confirm', value: 'あっちゃん', from: 'player' } : { action: 'none', value: '', from: 'player' };
    const reply = /あっちゃん/.test(said) ? 'えっ、いいの!? 「あっちゃん」かぁ……なんか照れるけど、呼んでみたいかも♪' : 'うんうん、今日もいっしょにがんばろ♪';
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply, expression: 'happy', memo: MEMO, call, nick: { action: 'none', value: '' }, taste: { monster: '', feeling: 'none' } }) }], usage: {} };
  } } };
  const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(root, rel); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(PORT, r));
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async ({ name, w, h, bond, mode }) => {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.addInitScript((bond) => {
      if (!localStorage.getItem('cn_real')) { localStorage.setItem('cn_real', '1'); localStorage.setItem('mh_assistant_bond_v1', JSON.stringify({ points: bond })); localStorage.setItem('mh_story_assistant_chat_seen_v1', 'true');
        localStorage.setItem('mh_assistant_chat_log_v1', JSON.stringify({ mua: [{ role: 'user', text: 'みゅあ、今日もHELLがんばったよ' }, { role: 'assistant', text: 'すごっ！ まぢ毎日えらいぢゃん♪', e: 'excited' }] })); }
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantCallname = true; clearInterval(t); } } catch {} }, 2);
    }, bond);
    await page.route(/rest\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/functions/v1/assistant-chat', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.kind) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, kind: 'tired' }) }); return; }
      const r = await core.handleRequest({ body, digest: DIGEST, client, take: async () => ({ ok: true, remaining: 42 }), refund: async () => {} });
      await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.json) });
    });
    await page.route(/functions\/v1\/(?!assistant-chat)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await page.waitForTimeout(1500); await finishTalk(page);
    if (mode === 'rot') {
      // モンヒロビートで🔄横にしてから HOME へ戻る(設定は残る)
      await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
      await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
      await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(800);
      await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
      await page.locator('.mh-home-player').waitFor({ timeout: 15000 }); await page.waitForTimeout(800); await finishTalk(page);
    }
    await page.locator('[data-home-assistant-chat]').dispatchEvent('click');
    await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 }); await page.waitForTimeout(600);
    if (mode === 'confirm' || mode === 'rot') {
      await page.locator('[data-assistant-chat-input]').fill('ありがと！ これからは「あっちゃん」って呼んでほしいな');
      await page.locator('[data-assistant-chat-send]').dispatchEvent('click'); await page.waitForTimeout(1200);
    }
    if (mode === 'rot') {
      await page.locator('[data-assistant-callname-yes]').dispatchEvent('click'); await page.waitForTimeout(500);
      await page.locator('[data-assistant-chat-close]').dispatchEvent('click'); await page.waitForTimeout(400);
      await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
      await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 }); await page.waitForTimeout(500);
      await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(900);
      console.log(name, 'rotated', await page.evaluate(() => RHYTHM_VIEW_ROTATION.active()), 'toast', await page.locator('[data-assistant-callname-toast]').count());
    }
    if (mode === 'profile') {
      await page.locator('[data-assistant-callname-choice]').first().dispatchEvent('click'); await page.waitForTimeout(400);
      await page.locator('[data-assistant-chat-close]').dispatchEvent('click'); await page.waitForTimeout(300);
      await page.locator('.mh-home-player').click({ timeout: 5000 }).catch(() => {});
      await page.locator('[data-profile-call-style]').first().waitFor({ timeout: 8000 });
      for (let i = 0; i < 12; i++) { const n = page.getByRole('button', { name: /^(次へ|閉じる|OK|わかった！?)$/ }).first(); if (!(await n.count()) || !(await n.isVisible().catch(() => false))) break; await n.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); }
      await page.locator('[data-profile-call-style]').first().click(); await page.waitForTimeout(500);
    }
    const ng = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-assistant-callname-card] *, [data-assistant-callname-toast] *, [data-callname-profile] *').forEach(el => { if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push(el.tagName + ':' + el.textContent.slice(0, 12)); });
      document.querySelectorAll('[data-assistant-callname-card] button,[data-callname-profile] button').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) out.push('btn:' + el.textContent); });
      return out;
    });
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), quality: 82 });
    console.log(name, ng.length ? 'NG ' + ng.join(' / ') : 'OK', errors.length ? 'エラー ' + errors[0] : '');
    await page.close();
  };
  try {
    if (process.env.ONLY_ROT) { await shot({ name: 'callname-real-6-rot-toast', w: 390, h: 844, bond: 420, mode: 'rot' }); return; }
    await shot({ name: 'callname-real-1-confirm-portrait', w: 390, h: 844, bond: 420, mode: 'confirm' });
    await shot({ name: 'callname-real-2-confirm-landscape', w: 844, h: 390, bond: 420, mode: 'confirm' });
    await shot({ name: 'callname-real-3-ask-portrait-small', w: 320, h: 568, bond: 1300, mode: 'ask' });
    await shot({ name: 'callname-real-4-ask-landscape', w: 667, h: 375, bond: 1300, mode: 'ask' });
    await shot({ name: 'callname-real-5-profile-portrait', w: 390, h: 844, bond: 1300, mode: 'profile' });
    await shot({ name: 'callname-real-6-rot-toast', w: 390, h: 844, bond: 420, mode: 'rot' });
  } finally { await b.close(); server.close(); }
})();
