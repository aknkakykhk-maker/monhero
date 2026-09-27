// 曲えらびの試聴と演奏で読んだ曲の音(解いた AudioBuffer)を、直近の数曲ぶんだけ持っているかを
// 実際のブラウザで確かめる(2026-09-27)。
//
//   node tools/audio/song-buffer-limit-check.js
//
// 【なぜ要るか】
// 解いた音は1曲で数十〜百MBあり、以前は一度読んだら二度と捨てなかった。試聴しながら何曲も
// 眺めるだけで数百MBに増え、iPhone ではメモリ不足で落ちる・発熱の原因になり得た。
// いまは 14-audio.jsx の SONG_BUFFER_KEEP 曲までにしている。数は画面に出ないので、
// Audio_.diagnose() の songBufferCount / bufferCount を見る。
//   ・6曲続けて試聴しても、曲の音は SONG_BUFFER_KEEP 曲までしか持たない
//   ・いちばん新しい曲は鳴っている(捨てたせいで鳴らない、が無い)
//   ・前に試聴した曲をもう一度試聴しても鳴る(捨てた曲は読み直せる)
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 9189;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/14-audio.jsx'), 'utf8');
const KEEP = Number((src.match(/const SONG_BUFFER_KEEP = (\d+);/) || [])[1]);
check('直近何曲まで持つかを実装から読めた', KEEP >= 1, String(KEEP));

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_update_notice_seen_v1', true);
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000, force: true });
    await page.waitForTimeout(1500);
    // 公開中の曲の音源(試聴と同じ入口 previewBGM で読む)
    const tracks = await page.evaluate(() => {
      const ids = [];
      for (const song of (typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [])) {
        if (song && song.bgmTrackId && !ids.includes(song.bgmTrackId)) ids.push(song.bgmTrackId);
      }
      return ids;
    });
    check('試聴できる曲が6曲以上ある', tracks.length >= 6, String(tracks.length));
    const before = await page.evaluate(() => Audio_.diagnose());
    const results = [];
    for (const id of tracks.slice(0, 6)) {
      results.push(await page.evaluate(async (key) => { const ok = await Audio_.previewBGM(key); return ok; }, id));
    }
    const after = await page.evaluate(() => Audio_.diagnose());
    check(`6曲続けて試聴しても、曲の音は ${KEEP} 曲までしか持たない`, after.songBufferCount <= KEEP,
      `試聴で読んだ曲 ${after.songBufferCount} / 解いた音 ${before.bufferCount}→${after.bufferCount}`);
    check('いちばん新しい曲は鳴っている', results[results.length - 1] === true, JSON.stringify(results));
    // 最初に試聴した(捨てた)曲をもう一度
    await page.evaluate(() => Audio_.stopPreview());
    const again = await page.evaluate(async (key) => Audio_.previewBGM(key), tracks[0]);
    check('前に試聴した曲をもう一度試聴しても鳴る', again === true);
    await page.evaluate(() => Audio_.stopPreview());
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
