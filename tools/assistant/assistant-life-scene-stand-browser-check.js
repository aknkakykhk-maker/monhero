// 助手ライフの場面(見守る・ようすを見る・贈る)の立ち絵の大きさと置き方を、実際に見えている体で確かめる
//   (2026-11-08 社長「助手の立ち絵サイズのバランスや配置の仕方があんまりよくない」「絵の余白の違いだと絵のサイズで変わるから実際の見た目ではかって」)
//   node tools/assistant/assistant-life-scene-stand-browser-check.js           検査
//   node tools/assistant/assistant-life-scene-stand-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/stagec/stand/)
//   大きさは、絵の寸法ではなく透けていない画素の範囲(見えている体)と、その中の目・顎の高さ(ASSISTANT_LIFE_STAND_FACE)で測る
//   ① 2人の顔の大きさが同じ(差 5% まで。顔の大きさ m は「目の線から顎の先」と「頬の幅」の平均・手で測った表。2026-11-08 社長「顔のサイズで合わせて頭のてっぺんをあわせた縮尺と位置に」)
//   ② 2人の見えている体が左右に分かれる(重なりは細いほうの幅の 2割まで)・画面からはみ出さない
//   ③ 顔(見えている体の上から顎まで)が、上の見出し・下の台詞の箱に隠れない
//   ④ 頭のてっぺん(髪の上端・飾りは除く)の高さがそろい、目が場面の上から2割5分〜5割5分に来る(社長「画面の下に小さく固まり、上半分が空いている」)
//   縦 390・横 844・🔄横 667・小さい縦 375×667 で、4組(みゅあ・ももすけ/きき・ドラ/あつ・ソラシド/きゅうこ・えるびん)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9259;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/stagec/stand');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const PAIRS = [['mua', 'momosuke'], ['kiki', 'dra'], ['atsu', 'sorashido'], ['kyuko', 'erubin']];

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
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript((pairs) => {
      if (localStorage.getItem('mh_check_stand') !== null) return;
      localStorage.setItem('mh_check_stand', '1');
      const v = JSON.parse(localStorage.getItem('mh_assistant_life_v1') || 'null');
      if (!v) return;
      localStorage.setItem('mh_assistant_life_v1', JSON.stringify({ ...v, groups: pairs.map(ids => ({ ids, doing: 'snack', place: 'home' })), solo: {} }));
    }, PAIRS);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } }
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(600);
    return page;
  };
  // 場面の立ち絵を測る(見えている体・目・顎は表から)
  const measure = (page) => page.evaluate(() => {
    const sc = document.querySelector('[data-assistant-life-scene]'); if (!sc) return null;
    const S = sc.getBoundingClientRect();
    const stands = [...sc.querySelectorAll('[data-assistant-life-scene-stand]')].map(img => {
      const id = img.getAttribute('data-assistant-life-scene-stand'), r = img.getBoundingClientRect(), box = ASSISTANT_LIFE_STAND_BOX.get(img.getAttribute('src'));
      const f = assistantLifeStandFace(id, img.getAttribute('src'));
      if (!box) return { id, missing: true };
      const vt = r.top + box.t * r.height, vb = r.top + box.b * r.height, vl = r.left + box.l * r.width, vr = r.left + box.r * r.width;
      const vh = vb - vt;
      return { id, head: !!f.head, vt, vb, vl, vr, face: vh * ASSISTANT_LIFE_STAND_EC * (f.m || 1), topY: vt + (f.top || 0) * vh, eyeY: vt + (f.eye || 0.4) * vh, chinY: f.head ? vb : vt + f.chin * vh };
    });
    const title = sc.querySelector('[data-assistant-life-scene-title]'), talk = document.querySelector('[data-assistant-peer-talk] > div, [data-assistant-peer-talk]');
    const tb = title ? title.getBoundingClientRect().bottom : S.top;
    const talkBox = [...document.querySelectorAll('[data-assistant-peer-talk] *')].filter(e => e.getClientRects().length && getComputedStyle(e).borderTopWidth !== '0px' && e.getBoundingClientRect().width > S.width * 0.6).map(e => e.getBoundingClientRect().top);
    return { S: { l: S.left, r: S.right, t: S.top, b: S.bottom }, stands, titleBottom: tb, talkTop: talkBox.length ? Math.min(...talkBox) : S.bottom };
  });
  const views = [[390, 844, '縦 390', 'tate'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667'], [375, 667, '小さい縦 375', 'small']];
  try {
    for (const [w, h, tag, file] of views) {
      const page = await open(w, h);
      for (const pair of PAIRS) {
        const host = await page.evaluate((ids) => assistantLifeHostOf(ids), pair);
        await page.locator(`[data-assistant-life-room="${host}"]`).click(); await page.waitForTimeout(350);
        const watch = page.locator('[data-assistant-life-room-act="watch"]');
        if (!(await watch.count()) || await watch.isDisabled()) { check(`${tag} ${pair.join('・')}: 見守るで場面を開ける`, false); await page.mouse.click(20, 60); continue; }
        await watch.click(); await page.waitForTimeout(1200);
        const m = await measure(page);
        if (!m || m.stands.length !== 2 || m.stands.some(x => x.missing)) { check(`${tag} ${pair.join('・')}: 場面に2人の立ち絵`, false, JSON.stringify(m && m.stands)); }
        else {
          const [a, b] = m.stands, label = `${tag} ${a.id}・${b.id}`;
          const faces = m.stands.filter(x => x.face != null).map(x => x.face);
          if (faces.length === 2) check(`① ${label}: 顔の大きさ(目から顎・頬の幅)が同じ`, Math.abs(faces[0] - faces[1]) <= Math.max(faces[0], faces[1]) * 0.05, faces.map(Math.round).join(' / '));
          const ov = Math.max(0, Math.min(a.vr, b.vr) - Math.max(a.vl, b.vl)), narrow = Math.min(a.vr - a.vl, b.vr - b.vl);
          check(`② ${label}: 左右に分かれる(重なり ${Math.round(ov / narrow * 100)}%)・はみ出さない`, ov <= narrow * 0.2 && m.stands.every(x => x.vl >= m.S.l - 2 && x.vr <= m.S.r + 2));
          const eyeOf = (x) => x.eyeY;
          const hidden = m.stands.filter(x => eyeOf(x) < m.titleBottom + 2 || x.chinY > m.talkTop + 2);
          check(`③ ${label}: 顔が見出し・台詞の箱に隠れない`, hidden.length === 0, hidden.map(x => `${x.id} 目 ${Math.round(eyeOf(x))}・顎 ${Math.round(x.chinY)}・上 ${Math.round(x.vt)}〜${Math.round(x.chinY)} 見出し下 ${Math.round(m.titleBottom)} 台詞上 ${Math.round(m.talkTop)}`).join(' / '));
          const hh = m.S.b - m.S.t, rel = m.stands.map(x => (x.eyeY - m.S.t) / hh);
          check(`④ ${label}: 頭のてっぺんがそろい、目が上から2割5分〜5割5分`, Math.abs(m.stands[0].topY - m.stands[1].topY) <= 3 && rel.every(r => r >= 0.25 && r <= 0.55), `てっぺん ${m.stands.map(x => Math.round(x.topY)).join(' / ')}・目 ${rel.map(r => `${Math.round(r * 100)}%`).join(' / ')}`);
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${file}-${a.id}-${b.id}.png`) });
        }
        await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(350);
      }
      await page.close();
    }
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
