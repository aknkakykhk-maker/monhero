// 立ち絵の作り直しの「前(いまの本番 = origin/main)」と「後(手元)」を、立ち絵が出る画面で並べて撮る(助手部ナカヨシ・ゲームは変えない)
//   2026-11-23 r1119-153: えるびん(ふだんの服・石油王)の立ち絵を新しい全身画から切り出し直したとき、社長へ見せるために作った
//   node tools/assistant/life-stand-before-after-shots.js --who erubin --outfits ,erubin_sekiyuou_v1:sekiyuou --pair sorashido --out docs/progress/assistant-art/<名前>
//     --outfits … 「服id:短い名前」をカンマで(空はふだんの服)。--pair … 助手ライフの「見守る」でいっしょに出す助手(下ごしらえ life-browser-shared.js の組と同じにする)。--rev … 前とする版(既定 origin/main)
//   撮る画面: モンヒロバトルの入口(どのバトルで遊ぶか)・助手ライフの「見守る」の場面。縦 390×844
//   前は、手元と origin/main で違うファイル(git diff の名前)だけを git から配る(絵・本体のJS・顔の表がそろって本番の状態になる)
//   書き出し: <out>/<画面>-<服>-before.png・-after.png と、左右に並べた <画面>-<服>.png
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..', '..'), PORT = 9291;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const WHO = arg('--who', 'erubin'), PAIR = arg('--pair', 'sorashido'), REV = arg('--rev', 'origin/main');
const OUTFITS = arg('--outfits', '').split(',').map(s => { const [id, tag] = s.split(':'); return { id: id || '', tag: tag || 'normal' }; });
const OUT = path.resolve(root, arg('--out', 'docs/progress/assistant-art/stand-before-after'));

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので撮れません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const changed = new Set(execFileSync('git', ['diff', '--name-only', REV, '--', 'monster-hero'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean));
  let mode = 'after';
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (mode === 'before' && changed.has(rel)) {
      try { const buf = execFileSync('git', ['show', `${REV}:${rel}`], { cwd: root, maxBuffer: 1 << 30 }); res.writeHead(200, { 'Content-Type': type }); res.end(buf); }
      catch { res.writeHead(404); res.end(); }
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (outfit) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${mode} ${outfit.tag}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript(({ who, costume }) => {
      if (localStorage.getItem('mh_check_stand_ba') !== null) return;
      localStorage.setItem('mh_check_stand_ba', '1');
      localStorage.setItem('mh_assistant_selected_v1', JSON.stringify(who));
      if (costume) {
        const owned = JSON.parse(localStorage.getItem('mh_assistant_costume_owned_v1') || '[]');
        localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify([...new Set([...owned, costume])]));
        localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify({ [who]: costume }));
      }
    }, { who: WHO, costume: outfit.id });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); }
    await toHome(page); await finishTalk(page);
    return { ctx, page };
  };
  const shots = [];
  try {
    for (const outfit of OUTFITS) {
      for (mode of ['before', 'after']) {
        // 入口(どのバトルで遊ぶか)
        let { ctx, page } = await open(outfit);
        await page.locator('[data-home-fac="battle"]').first().click({ timeout: 8000 });
        await page.waitForTimeout(2200);
        const f1 = path.join(OUT, `battle-entry-${outfit.tag}-${mode}.png`);
        await page.screenshot({ path: f1 }); shots.push(f1);
        await ctx.close();
        // 助手ライフの「見守る」
        ({ ctx, page } = await open(outfit));
        for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } }
        await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(800);
        const host = await page.evaluate((ids) => assistantLifeHostOf(ids), [PAIR, WHO]);
        await page.locator(`[data-assistant-life-room="${host}"]`).click({ timeout: 8000 }); await page.waitForTimeout(400);
        await page.locator('[data-assistant-life-room-act="watch"]').click({ timeout: 8000 }); await page.waitForTimeout(1800);
        const f2 = path.join(OUT, `life-watch-${outfit.tag}-${mode}.png`);
        await page.screenshot({ path: f2 }); shots.push(f2);
        await ctx.close();
      }
    }
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); }
  await browser.close(); server.close();
  // 前・後を左右に並べる
  const pairs = shots.filter(f => f.endsWith('-before.png')).filter(f => fs.existsSync(f.replace('-before.png', '-after.png')));
  if (pairs.length) {
    execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image, ImageDraw
for b in sys.argv[1:]:
    a = b.replace('-before.png', '-after.png')
    ib, ia = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
    W, H = ib.width + ia.width + 24, max(ib.height, ia.height) + 70
    out = Image.new('RGB', (W, H), (30, 30, 40)); out.paste(ib, (0, 70)); out.paste(ia, (ib.width + 24, 70))
    d = ImageDraw.Draw(out)
    fnt = None
    from PIL import ImageFont
    for fp in ('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'):
        try:
            fnt = ImageFont.truetype(fp, 40); break
        except Exception:
            pass
    d.text((20, 12), '前(いまの本番)', fill=(255, 255, 255), font=fnt); d.text((ib.width + 44, 12), '後(作り直し)', fill=(255, 230, 120), font=fnt)
    s = 0.5; out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    out.save(b.replace('-before.png', '.png'), optimize=True)
`, ...pairs]);
    for (const f of shots) fs.unlinkSync(f);
  }
  console.log(`撮った: ${pairs.map(f => path.relative(root, f.replace('-before.png', '.png'))).join(' ')}`);
  if (errors.length) console.log('ページのエラー: ' + errors.slice(0, 3).join(' / '));
  console.log(errors.length || !pairs.length ? 'NG' : 'OK');
  process.exit(errors.length || !pairs.length ? 1 : 0);
})();
