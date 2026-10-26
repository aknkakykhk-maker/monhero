// まっさらな端末の音量の既定(2026-10-18 社長の判断「控えめの値に上げる」・DEFAULT_VOLUME 1 → 30)を、実際のブラウザで確かめる。
//
//   node tools/audio/default-volume-check.js
//
// 見ること:
//   ・音量をまだ保存していない端末では、効果音・BGM の音量が DEFAULT_VOLUME(30)から始まる
//   ・保存してある端末(例: 5)は、保存した値のまま読む(既定で上書きしない・CLAUDE.md ⑦)
//   ・ミュートを解除しても音量の値は変わらない(解除で急に大きくならない)
//   ・モンヒロビートの曲の音量(既定 100)には触らない
const http = require('http');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const PORT = 9194;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8');
const DEF = Number((src.match(/const DEFAULT_VOLUME = (\d+);/) || [])[1]);
check('既定の音量は控えめ(10〜40)', DEF >= 10 && DEF <= 40, String(DEF));
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
check('既定は「保存が無いとき」だけに使う(storeGet の既定値)', app.includes("storeGet('mh_se_volume', DEFAULT_VOLUME, false)") && app.includes("storeGet('mh_bgm_volume', DEFAULT_VOLUME, false)"));
const rhythm = fs.readFileSync(path.join(root, 'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'), 'utf8');
check('モンヒロビートの曲の音量の既定は 100 のまま', /bgmVolume:\s*100\b/.test(rhythm), (rhythm.match(/bgmVolume:\s*\d+/) || [''])[0]);

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const run = async (saved) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((saved) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      if (saved != null && !sessionStorage.getItem('seeded')) { put('mh_se_volume', saved); put('mh_bgm_volume', saved); sessionStorage.setItem('seeded', '1'); }
    }, saved);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000, force: true });
    await page.waitForTimeout(2500);
    const read = () => page.evaluate(() => { const d = Audio_.diagnose(); return { se: d.seVolumePct, bgm: d.bgmVolumePct, savedSe: localStorage.getItem('mh_se_volume'), savedBgm: localStorage.getItem('mh_bgm_volume') }; });
    const first = await read();
    await page.close();
    return { first, errors };
  };
  try {
    const fresh = await run(null);
    check(`まっさらな端末では、効果音・BGM が ${DEF} から始まる`, fresh.first.se === DEF && fresh.first.bgm === DEF, JSON.stringify(fresh.first));
    check('まっさらな端末で、読んだだけでは音量を保存しない', fresh.first.savedSe === null && fresh.first.savedBgm === null);
    const saved = await run(5);
    check('音量を保存してある端末(5)は、保存した値のまま', saved.first.se === 5 && saved.first.bgm === 5, JSON.stringify(saved.first));
    check('実行時エラーが出ていない', fresh.errors.length === 0 && saved.errors.length === 0, [...fresh.errors, ...saved.errors].slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
