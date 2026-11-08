// 助手1人に贈る(2026-11-08 社長 docs/progress/assistant-peer/SOLO-GIFT-PLAN.md ❶B ❷A ❸A ❹A ❺A)を、実際に開いて確かめる。公開の印 assistantLifeSolo はページの中でだけ立てる
//   node tools/assistant/assistant-life-solo-browser-check.js           検査
//   node tools/assistant/assistant-life-solo-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/solo/built/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   ① 印が偽なら、部屋に「◯◯だけに贈る」も、交換所に1人用の道具も出ない
//   ② 印が真: 一緒にいる助手の部屋に「💬 声をかける」「🎁 2人に贈る」「🎁 ◯◯だけに贈る」(❺A)
//   ③ 1人に贈るシート: 題が「◯◯に贈る」・友情Lv の行が無い・道具は14種類・重みは1行。縦 390・横 844・🔄横 667 で切れない・「贈る」が押せる
//   ④ 1人に贈ると: 持ち物が1つ減る・1人の記録(mh_assistant_life_solo_gift_v1)・友情Lv(mh_assistant_peer_bond_v1)は動かない・お知らせの帯に量
//   ⑤ 1人には1日3回(2人に贈る3回とは別 ❶B)。同じ道具は、1人に贈ったら2人にも贈れない
//   ⑥ 思い出チェキを1人に贈ると、その助手の部屋にひとりのチェキ(❸A)。好きなものは「分かった ◯/14」(❹A)
//   ⑦ 道具タブに「💗 1人に贈る道具」・交換所の「アイテム」に1人用の4種類
//   ⑧ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9243;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/solo/built');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const cutProblems = (page, sel) => page.evaluate((s) => {
  const ng = [];
  const box = document.querySelector(s); if (!box) return ['見つからない'];
  for (const el of box.querySelectorAll('p, span, b, button')) {
    if (!el.getClientRects().length || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.left < -1 || r.right > innerWidth + 1) ng.push(`はみ出す「${el.textContent.trim().slice(0, 16)}」`);
    if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('truncate')) ng.push(`切れる「${el.textContent.trim().slice(0, 16)}」`);
  }
  return [...new Set(ng)];
}, sel);

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (w, h, on) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript((flag) => {
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeSolo = !!flag; clearInterval(t); } } catch {} }, 2);
      if (localStorage.getItem('mh_check_solo') === null) { localStorage.setItem('mh_check_solo', '1'); const o = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
        Object.assign(o, { solo_candy: 2, solo_letter: 1, solo_keyholder: 1, peer_cheki: 1, peer_cake: 1, peer_gift: 2 }); localStorage.setItem('mh_owned_items', JSON.stringify(o)); }
    }, on);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    return page;
  };
  const openHouse = async (page) => { for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } } await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); };
  // 一緒にいる組の1人の部屋
  //   (出かけていても、組の助手の部屋のシートには「2人に贈る」「◯◯だけに贈る」が出る。けんか中の組は避ける)
  const groupRoom = (page) => page.evaluate(() => { try { const gs = (ASSISTANT_LIFE_STORE.state.life.groups || []).filter(g => g.ids.length === 2); const g = gs.find(x => !document.querySelector(`[data-assistant-life-room="${x.ids[0]}"] [data-assistant-life-rel]`)) || gs[0]; return g ? g.ids[0] : null; } catch { return null; } });
  const openSoloSheet = async (page, id) => { await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
    // 1人に3回贈ったあとは、部屋の「◯◯だけに贈る」が押せない(正しい動き)
    if (await page.locator('[data-assistant-life-room-act="give-solo"]').isDisabled()) { await page.mouse.click(20, 60); await page.waitForTimeout(200); return false; }
    await page.locator('[data-assistant-life-room-act="give-solo"]').click(); await page.waitForTimeout(400); return true; };
  const giveSolo = async (page, id, kind) => {
    if (!(await openSoloSheet(page, id))) return { given: false, reason: '今日はもう1人に3回贈りました(部屋のボタンが押せない)' };
    await page.locator(`[data-assistant-life-give-kind="${kind}"]`).click(); await page.waitForTimeout(200);
    const dis = await page.locator('[data-assistant-life-give-go]').isDisabled();
    if (dis) { const r = await page.locator('[data-assistant-life-give-reason]').innerText().catch(() => ''); await page.locator('[data-assistant-life-give-cancel]').click(); await page.waitForTimeout(200); return { given: false, reason: r }; }
    await page.locator('[data-assistant-life-give-go]').click(); await page.waitForTimeout(700); await finishTalk(page);
    await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
    return { given: true, note: await page.locator('[data-assistant-life-note]').first().innerText().catch(() => '') };
  };
  const owned = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
  try {
    // ① 印が偽
    {
      const page = await open(390, 844, false);
      await openHouse(page);
      const id = await groupRoom(page);
      if (id) { await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300); }
      check('① 印が偽なら、部屋に「◯◯だけに贈る」が出ない', (await page.locator('[data-assistant-life-room-act="give-solo"]').count()) === 0);
      await page.close();
    }
    // ②〜⑦ 縦 390 で通しで
    {
      const page = await open(390, 844, true);
      await openHouse(page);
      const id = await groupRoom(page);
      check('② 一緒にいる組がいる', !!id);
      await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
      const acts = await page.locator('[data-assistant-life-room-acts]').innerText().catch(() => '');
      check('② 一緒にいる助手の部屋に「💬 声をかける」「🎁 2人に贈る」「🎁 ◯◯だけに贈る」', /声をかける/.test(acts) && /2人に贈る/.test(acts) && /だけに贈る/.test(acts), acts.replace(/\s+/g, ' ').slice(0, 80));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-1-room.png') });
      await page.locator('[data-assistant-life-room-act="give-solo"]').click(); await page.waitForTimeout(400);
      const sheet = await page.locator('[data-assistant-life-give-sheet]').innerText().catch(() => '');
      const tiles = await page.locator('[data-assistant-life-give-kind]').count();
      const weights = await page.locator('[data-assistant-life-give-sheet] [data-assistant-life-give-weight]').count();
      check('③ 1人に贈るシート: 題が「◯◯に贈る」・友情Lv の行が無い・道具14種類・重みは1行', /に贈る/.test(await page.locator('[data-assistant-life-give-title]').innerText()) && (await page.locator('[data-assistant-life-give-peer]').count()) === 0 && tiles === 14 && weights === 1, `${tiles}種類 重み${weights}`);
      check('③ 「2人に」「◯◯だけに」の切りかえが出る', (await page.locator('[data-assistant-life-give-pair]').count()) >= 1 && (await page.locator('[data-assistant-life-give-solo]').count()) >= 2);
      // 切りかえ: 2人に → 友情Lv の行が出る・1人用は並ばない
      await page.locator('[data-assistant-life-give-pair]').first().click(); await page.waitForTimeout(200);
      check('③ 「2人に」に切りかえると、友情Lv の行が出て道具は10種類', (await page.locator('[data-assistant-life-give-peer]').count()) === 1 && (await page.locator('[data-assistant-life-give-kind]').count()) === 10);
      await page.locator('[data-assistant-life-give-cancel]').click(); await page.waitForTimeout(200);
      // ④ 1人に贈る
      const bondBefore = await page.evaluate(() => localStorage.getItem('mh_assistant_peer_bond_v1'));
      const before = await owned(page);
      const r1 = await giveSolo(page, id, 'candy');
      const after = await owned(page);
      const soloSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_solo_gift_v1') || 'null'));
      check('④ 1人に贈ると持ち物が1つ減り、1人の記録に残る', r1.given && after.solo_candy === before.solo_candy - 1 && soloSave && soloSave.used && soloSave.used.candy === id, JSON.stringify(soloSave));
      check('④ お知らせの帯に、仲良し度の量が出る', /仲良し度 \+\d+/.test(r1.note || ''), r1.note);
      check('④ 1人に贈っても、友情Lv(助手どうし)は動かない', (await page.evaluate(() => localStorage.getItem('mh_assistant_peer_bond_v1'))) === bondBefore);
      // ⑤ 1日3回(別に数える)・同じ道具は1日1回
      const r2 = await giveSolo(page, id, 'candy');
      check('⑤ 同じ道具は、1人にでも1日1回', !r2.given && /今日はもうこの道具/.test(r2.reason), r2.reason);
      const r3 = await giveSolo(page, id, 'cheki');
      const r4 = await giveSolo(page, id, 'letter');
      const r5 = await giveSolo(page, id, 'keyholder');
      check('⑤ 1人には1日3回まで', r3.given && r4.given && !r5.given && /1人に3回/.test(r5.reason), `${r3.given} ${r4.given} ${r5.reason}`);
      // 2人に贈る回数は別(おやつバスケットは2人に贈れる)
      await page.locator('[data-assistant-life-today-act="give"]').click().catch(() => {}); await page.waitForTimeout(400);
      const pairLeft = await page.locator('[data-assistant-life-give-left]').getAttribute('data-assistant-life-give-left').catch(() => null);
      check('⑤ 2人に贈る回数は別に数える(1人に3回贈っても、2人にはあと3回)', pairLeft === '3', String(pairLeft));
      // 1人に贈ったチェキは2人にも贈れない
      if (await page.locator('[data-assistant-life-give-sheet]').count()) {
        if (await page.locator('[data-assistant-life-give-pair]').count()) await page.locator('[data-assistant-life-give-pair]').first().click();
        await page.locator('[data-assistant-life-give-kind="cheki"]').click(); await page.waitForTimeout(200);
        check('⑤ 1人に贈った道具は、その日は2人にも贈れない', /今日はもうこの道具/.test(await page.locator('[data-assistant-life-give-reason]').innerText().catch(() => '')));
        await page.locator('[data-assistant-life-give-cancel]').click(); await page.waitForTimeout(200);
      }
      // ⑥ ひとりのチェキ・好きなもの /14
      await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
      check('⑥ 1人に贈ったチェキが、その助手の部屋に出る(❸A)', (await page.locator(`[data-assistant-life-cheki="${id}"]`).count()) === 1);
      const likes = await page.locator(`[data-assistant-life-gift-likes="${id}"]`).innerText().catch(() => '');
      check('⑥ 好きなものは「分かった ◯/14」(❹A)', /分かった \d+\/14/.test(likes), likes.replace(/\s+/g, ' ').slice(0, 40));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-5-room-after.png') });
      await page.mouse.click(20, 60); await page.waitForTimeout(200);
      // ⑦ 道具タブ・交換所
      await page.locator('[data-assistant-life-icon="items"]').click(); await page.waitForTimeout(300);
      const items = await page.locator('[data-assistant-life-items]').innerText().catch(() => '');
      check('⑦ 道具タブに「💗 1人に贈る道具」と4種類・10種類の行に「1人に贈ると」', /1人に贈る道具/.test(items) && /手書きの手紙/.test(items) && /小さなおまもり/.test(items) && (await page.locator('[data-assistant-life-item-solo-amt]').count()) === 10);
      if (SHOTS) { await page.locator('[data-assistant-life-items-solo]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, 'tate-6-items.png') }); }
      await page.locator('[data-assistant-life-items] [data-assistant-life-shop="item"]').last().click(); await page.waitForTimeout(900);
      const shop = await page.locator('[data-event-point-shop]').innerText().catch(() => '');
      check('⑦ 交換所の「アイテム」に1人用の4種類', ['手書きの手紙', 'ひとつぶキャンディ', 'キーホルダー', '小さなおまもり'].every(n => shop.includes(n)));
      await page.close();
    }
    // ③ 見た目(縦 390・横 844・🔄横 667)
    for (const [w, h, tag, file] of [[390, 844, '縦 390', 'tate'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667']]) {
      const page = await open(w, h, true);
      await openHouse(page);
      const id = await groupRoom(page);
      if (!id) { check(`③ ${tag}: 一緒にいる組がいる`, false); await page.close(); continue; }
      await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
      const actsOk = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-room-acts] button')].every(b => { const r = b.getBoundingClientRect(); return b.scrollWidth <= b.clientWidth + 1 && r.right <= innerWidth + 1; }));
      check(`③ ${tag}: 部屋のシートのボタンの字が切れない`, actsOk);
      if (SHOTS && w !== 390) await page.screenshot({ path: path.join(shotDir, `${file}-1-room.png`) });
      await page.locator('[data-assistant-life-room-act="give-solo"]').click(); await page.waitForTimeout(400);
      const cut = await cutProblems(page, '[data-assistant-life-give-sheet] > div');
      check(`③ ${tag}: 1人に贈るシートの文字が切れない・はみ出さない`, cut.length === 0, cut.join(','));
      const goInView = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-give-go]'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 && b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
      check(`③ ${tag}: 「贈る」がシートを送らずに押せる`, goInView);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${file}-2-sheet.png`) });
      await page.close();
    }
    check('⑧ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
