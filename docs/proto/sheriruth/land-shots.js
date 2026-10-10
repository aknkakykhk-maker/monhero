// Sheriruth 試作(MASTER 30秒)を、取りこぼしなしの自動演奏で録画する。本物のランキングへは送らない(偽の Supabase)
const path = require('path');
const ROOT = '/home/user/monhero';
const OUT = process.argv[2] || path.join(__dirname, 'rec');
const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT, 'tools/playbot/lib/touch-input.js'));
const W = Number(process.env.VW || 844), H = Number(process.env.VH || 390);
const STYLE = process.env.SKY_STYLE || 'gold';
const SHOTS = String(process.env.SHOTS || '').split(',').filter(Boolean).map(Number);
require('fs').mkdirSync(OUT, { recursive: true });
const seed = `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_rhythm_best_v1', { sheriruth_proto: { HARD: { bestScore: 1, maxCombo: 1, played: true, clear: true }, EXPERT: { bestScore: 1, maxCombo: 1, played: true, clear: true } } });
})()`;
const clickText = (page, re) => page.evaluate((src) => {
  const r = new RegExp(src);
  const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && r.test((x.getAttribute('aria-label') || x.innerText || '').replace(/\s+/g, ' ').trim()));
  if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return (b.innerText || '').replace(/\s+/g, ' ').slice(0, 60); }
  return null;
}, re.source);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, });
  const sb = createFakeSupabase();
  await context.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith('http://localhost:8899/')) return route.continue(); if (/supabase\.co/.test(u)) return sb.handle(route); return route.abort(); });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed);
  await context.addInitScript(`localStorage.setItem('mh_sky_tap_style_proto', ${JSON.stringify(STYLE)});`);
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto('http://localhost:8899/monster-hero/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('TAP TO START')); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b?.click(); });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(2200);
  for (let i = 0; i < 12; i++) { const c = await clickText(page, /^(確認|受け取る|閉じる|OK|スキップ)$/); if (!c) break; await page.waitForTimeout(500); }
  await clickText(page, /^モンヒロビート$/);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { const c = await clickText(page, /^(確認|閉じる|OK|スキップ)$/); if (!c) break; await page.waitForTimeout(400); }
  console.log('ソロ', await clickText(page, /ソロライブ/));
  await page.waitForTimeout(2500);
  for (let k = 0; k < 3; k++) { if (!(await clickText(page, /^この案内を閉じる$/))) break; await page.waitForTimeout(300); }
  console.log('曲', await clickText(page, /^Sheriruth.*試作.*Lv/));
  await page.waitForTimeout(1200);
  console.log('難易度', await clickText(page, /MASTER/));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'select.png') });
  console.log('開始', await clickText(page, /^(▶\s*)?決定$/));
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && window.__mhTestHooks.rhythmNotes, null, { timeout: 30000 });
  const startAt = (Date.now() - t0) / 1000;
  // 空中の段(試作): 空中のノーツ(skyHeight>0)は、空中の判定ラインの高さを押す。ボットの本体は変えず、写しの1行だけ差し替える
  const target = 'const p = fingerAt(c, hab, null, now);';
  const src = installPlayer.toString();
  if (!src.includes(target)) throw new Error('ボットの指の置き方の行が見つからない');
  const patched = src.replace(target, 'const p = (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : 0; if (!sh) return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();');
  const args = { sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
  const inst = await page.evaluate(`(${patched})(${JSON.stringify(args)})`);
  console.log('演奏係', JSON.stringify(inst).slice(0, 200), '演奏開始(録画の秒)', startAt.toFixed(1));
  for (const at of SHOTS) {
    await page.waitForFunction((t) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= t, at, { timeout: 60000, polling: 'raf' });
    await page.screenshot({ path: require('path').join(OUT, `${STYLE}-${at}.png`) });
    console.log('撮った', STYLE, at);
  }
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
