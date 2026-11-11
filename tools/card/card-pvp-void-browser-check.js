#!/usr/bin/env node
// MFバトルカードのマルチ対戦の無効試合(91 の goVoid・2026-11-08 ソランド)を、実際のブラウザの2つのページで確かめる。
//
//   node tools/card/card-pvp-void-browser-check.js
//   run-checks-timeout: 600
//   SHOT_DIR=<フォルダ> を付けると、窓の写真(縦・横)を残す
//
// ★外へはつながない(偽の WebSocket を Node が中継する。card-pvp-browser-check.js と同じ作り)。場の食い違いは、検査だけの口で起こす
//   (window.__mhCardPvpDesyncTest … 届いた手をはねる / window.__mhCardPvpOldTest … void を知らない古い版のふり)
//   ① 2台とも新しい版: はねた側にも受けた側にも「この試合は続けられません」の窓が出る・文が決めたとおり
//   ② 窓の文が、縦にも横にも切れない(窓が画面に収まる)
//   ③ 「試合を終える」で、2台ともマルチの入口へ戻る・抜けた罰(mh_card_pvp_penalty_v1)が付かない
//   ④ ビートP・強さの点数・マルチの履歴・見返し・ミッションが、どれも増えも減りもしない(端末の保存が変わらない・点数へ何も送らない)
//   ⑤ 古い版の相手(void を知らない): はねた側には窓が出て、窓のあいだは場が動かない・入口へ戻れる・罰は付かない
//   ⑥ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8947;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const FAKE_WS = () => {
  // __fakeWsDrop(ms) … いまのつながりを切り、ms のあいだは新しくつながらない(電波が切れたふり)
  const all = new Set();
  const subs = {}; // topic → その topic につないでいる偽の WebSocket
  const pageId = `${Date.now()}-${Math.random()}`;
  let nextId = 1;
  // 中継から届いた知らせ。送った本人(同じページの同じつながり)には返さない(自分への返しは send の中で別に出す)
  window.__fakeWsRecv = (topic, payload, fromId, fromPage) => {
    (subs[topic] || []).forEach((w) => { if (!(fromPage === pageId && w.id === fromId)) w.deliver({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } }); });
  };
  window.__fakeWsBlockUntil = 0;
  window.__fakeWsDrop = (ms) => { window.__fakeWsBlockUntil = Date.now() + ms; [...all].forEach((w) => w.close()); };
  class FakeWS {
    constructor() {
      this.readyState = 0; this.topic = null; this.id = nextId++; all.add(this);
      if (Date.now() < window.__fakeWsBlockUntil) { setTimeout(() => { this.readyState = 3; all.delete(this); if (this.onclose) this.onclose({}); }, 50); return; }
      setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0);
    }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic;
        (subs[m.topic] = subs[m.topic] || []).push(this);
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (this.topic && window.__fakeWsRelay) window.__fakeWsRelay(this.topic, payload, this.id, pageId);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { if (this.readyState === 3) return; this.readyState = 3; all.delete(this); if (this.topic && subs[this.topic]) subs[this.topic] = subs[this.topic].filter((w) => w !== this); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
  window.__mhCardPvpAuto = true;
  window.__mhCardPvpAutoMs = 700;
  window.__mhCardPvpRankTest = true;
  window.__mhCardPvpLineSeed = 1; // 写真に、顔文字の入った負けの台詞(みゅあ)が出るように
  // ★自動操作のブラウザでは、本物の Supabase へ書き込まない仕組みがある(26-supabase.jsx)。この検査は Supabase を偽物に差し替えているので、書き込みも通す
  window.__mhSupabaseStubbed = true;
  window.__mhCardPvpRosterTest = [{ otherId: 'friend-x', userName: 'フレンドX' }];
};
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
const pvpGo = async (page, sel) => { await page.locator(sel).first().click(); await page.locator('[data-card-deck-pick-go]').click({ timeout: 10000 }); };
const TITLE = 'この試合は続けられません';
const BODY = '通信のずれで、相手と場が合わなくなりました。この試合は記録に残さずに終わります。ビートPと強さの点数は、増えも減りもしません。';
// 試合で変わってよい保存(時刻・画面の位置など)。これ以外の mh_* が変わったら NG
// 助手どうしの掛け合い(56-assistant-peer)は、画面に入ったときに(90秒あけて)流れ、記録とミッションの「助手とふれあう」を書く。試合とは関係ないので見ない。
//   ミッション(mh_missions)は、カードの1戦・勝ち(cardPlays・cardWins)が動いていないかだけを別に見る(2026-11-08: 入口へ戻ったときに掛け合いが流れて NG になっていた)
const LOOSE = /^mh_(last_|session|bgm|screen|seen_at|app_|boot|play_time|login|card_last_view|card_pvp_last|card_top_view|card_chat|assistant_peer_|assistant_life_play_v1$|missions$)/;
const cardMission = (raw) => { let n = 0; const walk = (v) => { if (!v || typeof v !== 'object') return; for (const [k, x] of Object.entries(v)) { if ((k === 'cardPlays' || k === 'cardWins') && Number.isFinite(x)) n += x; else walk(x); } }; try { walk(JSON.parse(raw || 'null')); } catch (_) { /* 読めない */ } return n; };

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const reports = [];
    const livePages = [];
    let relayQueue = Promise.resolve();
    const makeCtx = async (icon) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      await ctx.exposeBinding('__fakeWsRelay', (_src, topic, payload, id, pid) => {
        relayQueue = relayQueue.then(() => Promise.all(livePages.filter((pg) => !pg.isClosed()).map((pg) => pg.evaluate(([t, pl, i, pi]) => { if (window.__fakeWsRecv) window.__fakeWsRecv(t, pl, i, pi); }, [topic, payload, id, pid]).catch(() => {}))));
        return relayQueue;
      });
      await ctx.route(/supabase\.co/, (route) => {
        const req = route.request();
        if (/\/rpc\/card_battle_pvp_report/.test(req.url())) { try { reports.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* 読めない */ } return route.fulfill({ status: 200, contentType: 'application/json', body: '"wait"' }); }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
      await ctx.addInitScript((ic) => {
        if (localStorage.getItem('mh_onboarded')) return;
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', ic); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      }, icon);
      await ctx.addInitScript(eventStorySeed()); await ctx.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await ctx.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
      await ctx.addInitScript(FAKE_WS);
      return ctx;
    };
    const boot = async (page) => {
      livePages.push(page);
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 6; i++) {
        const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
    };
    const openCard = async (page) => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      for (let i = 0; i < 8 && await page.locator('[role="dialog"][aria-label="ログインボーナス"]').count(); i++) {
        await page.locator('[role="dialog"][aria-label="ログインボーナス"]').getByRole('button', { name: '閉じる' }).first().dispatchEvent('click').catch(() => {}); await page.waitForTimeout(400);
      }
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().dispatchEvent('click');
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    const starter = async (page, kit) => {
      await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
      await page.locator(`[data-card-kit="${kit}"]`).click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: '飛ばす' }).last().click();
      await page.waitForTimeout(800);
      if (await page.locator('[data-card-top="result"]').count()) await page.getByRole('button').filter({ hasText: /トップ/ }).first().click().catch(() => {});
    };
    const toLobby = async (page) => {
      await page.locator('[data-card-cpu]').first().click({ timeout: 20000 });
      await page.locator('[data-card-mode-multi]').click({ timeout: 10000 });
      await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    };
    const store = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const changed = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k] && !LOOSE.test(k));
    const penalty = (page) => page.evaluate(() => { try { return Number(JSON.parse(localStorage.getItem('mh_card_pvp_penalty_v1') || '0')) || 0; } catch (_) { return 0; } });
    const play = async (A, B) => {
      await pvpGo(A, '[data-card-pvp-create]');
      await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
      const code = (await A.locator('[data-card-pvp-room]').innerText()).trim();
      await B.locator('[data-card-pvp-code]').fill(code);
      await pvpGo(B, '[data-card-pvp-join]');
      await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 20000 }), B.locator('[data-card-battle]').waitFor({ timeout: 20000 })]);
    };
    // 窓が画面に収まっているか(文が切れない)
    const fits = (page) => page.evaluate(() => {
      const d = document.querySelector('[data-card-pvp-void] > div');
      if (!d) return { ok: false, why: '窓が無い' };
      const r = d.getBoundingClientRect();
      const ps = [...d.querySelectorAll('p, button')];
      const clip = ps.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).length;
      return { ok: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5 && clip === 0, why: `${Math.round(r.top)},${Math.round(r.bottom)}/${window.innerHeight} 切れ${clip}` };
    });

    const ctxA = await makeCtx('snegurochka_icon'), ctxB = await makeCtx('🐣');
    const A = await ctxA.newPage(), B = await ctxB.newPage();
    await boot(A); await openCard(A); await starter(A, 'speed'); await toLobby(A);
    await boot(B); await openCard(B); await starter(B, 'powerful'); await toLobby(B);
    for (const p of [A, B]) await p.evaluate(() => { window.__mhCardPvpAuto = true; window.__mhCardPvpAutoMs = 700; window.__mhCardPvpRankTest = true; });

    // ---- ① 2台とも新しい版 ----
    const saveBefore = [await store(A), await store(B)];
    await play(A, B);
    await A.evaluate(() => { window.__mhCardPvpDesyncTest = true; });
    const seenA = await A.locator('[data-card-pvp-void]').waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
    const seenB = await B.locator('[data-card-pvp-void]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check('① はねた側に窓が出る', seenA);
    check('① 受けた側にも同じ窓が出る', seenB);
    for (const [p, n] of [[A, 'A'], [B, 'B']]) {
      const t = await p.locator('[data-card-pvp-void]').innerText().catch(() => '');
      check(`① ${n} の窓の見出し・本文・ボタンが決めたとおり`, t.includes(TITLE) && t.replace(/\s/g, '').includes(BODY) && t.includes('試合を終える'), t.replace(/\n/g, ' / '));
    }
    await A.waitForTimeout(500);
    await shot(A, 'void-A-portrait'); await shot(B, 'void-B-portrait');
    const fitP = [await fits(A), await fits(B)];
    await A.setViewportSize({ width: 844, height: 390 }); await B.setViewportSize({ width: 844, height: 390 });
    await A.waitForTimeout(600);
    await shot(A, 'void-A-landscape'); await shot(B, 'void-B-landscape');
    const fitL = [await fits(A), await fits(B)];
    check('② 縦で窓が画面に収まり、文が切れない', fitP.every((x) => x.ok), JSON.stringify(fitP));
    check('② 横で窓が画面に収まり、文が切れない', fitL.every((x) => x.ok), JSON.stringify(fitL));
    await A.setViewportSize({ width: 390, height: 844 }); await B.setViewportSize({ width: 390, height: 844 });
    // 窓が出ているあいだに、勝ち負けが付いていない(結果の画面にならない)
    await A.waitForTimeout(3000);
    check('① 窓のあいだに結果の画面へ進まない', (await A.locator('[data-card-pvp-result]').count()) === 0 && (await B.locator('[data-card-pvp-result]').count()) === 0);
    await A.locator('[data-card-pvp-void-exit]').click();
    await B.locator('[data-card-pvp-void-exit]').click();
    const idleA = await A.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const idleB = await B.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check('③ 「試合を終える」で、2台ともマルチの入口へ戻る', idleA && idleB, `${idleA} / ${idleB}`);
    check('③ 抜けた罰が付かない(2台とも)', (await penalty(A)) <= Date.now() && (await penalty(B)) <= Date.now());
    await A.waitForTimeout(2500);
    const saveAfter = [await store(A), await store(B)];
    const diff = [changed(saveBefore[0], saveAfter[0]), changed(saveBefore[1], saveAfter[1])];
    check('④ ビートP・履歴・見返しなど、端末の保存が変わらない', diff.every((x) => x.length === 0), JSON.stringify(diff));
    check('④ ミッションのカードの1戦・勝ちが増えない', [0, 1].every((i) => cardMission(saveBefore[i].mh_missions) === cardMission(saveAfter[i].mh_missions)),
      [0, 1].map((i) => `${cardMission(saveBefore[i].mh_missions)}→${cardMission(saveAfter[i].mh_missions)}`).join(' / '));
    check('④ 強さの点数へ何も送らない', reports.length === 0, `${reports.length}件`);
    await A.evaluate(() => { window.__mhCardPvpDesyncTest = false; });

    // ---- ⑤ 古い版の相手 ----
    await B.evaluate(() => { window.__mhCardPvpOldTest = true; });
    const saveBefore2 = await store(A);
    await play(A, B);
    await A.evaluate(() => { window.__mhCardPvpDesyncTest = true; });
    const seenA2 = await A.locator('[data-card-pvp-void]').waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
    // 窓のあいだは場が動かない(検査の自動の手も止まる。2026-11-08: 自動の手が窓の後ろで打ち続けて決着し、ふつうの終わりの処理でミッションが数えられることがあった)
    const board = () => A.evaluate(() => { const b = document.querySelector('[data-card-battle]'); return b ? b.innerText.replace(/\d+秒/g, '') : ''; });
    const boardBefore = await board();
    await A.waitForTimeout(6000);
    check('⑤ 窓のあいだは、はねた側の場が動かない', boardBefore && boardBefore === await board());
    const seenB2 = await B.locator('[data-card-pvp-void]').count();
    check('⑤ 古い版の相手でも、はねた側には窓が出る(相手は void を捨てるので窓は出ない)', seenA2 && seenB2 === 0, `${seenA2} / ${seenB2}`);
    await A.locator('[data-card-pvp-void-exit]').click().catch(() => {});
    const idleA2 = await A.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check('⑤ 「試合を終える」で入口へ戻れる・罰が付かない', idleA2 && (await penalty(A)) <= Date.now());
    const saveAfter2 = await store(A);
    const diff2 = changed(saveBefore2, saveAfter2);
    check('⑤ はねた側の端末の保存が変わらない・ミッションのカードの数も増えない', diff2.length === 0 && cardMission(saveBefore2.mh_missions) === cardMission(saveAfter2.mh_missions), JSON.stringify(diff2));
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('検査が最後まで動く', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `NG: ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
