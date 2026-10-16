// 場面のBGMを軽く持つ(デバッグ設定 mh_bgm_light_v1・2026-10-16 社長の決定「案1＋案2」)を、実際のブラウザで確かめる。
//
//   node tools/audio/bgm-light-check.js
//
// 【なぜ要るか】
// クイックのオート無限を1時間ほど回すと、iPhone がメモリ不足でタブを読み込み直し、ホームへ戻っていた。
// 場面のBGMは1本を解くと約45〜60MB あり、4本まで持っていた。入にすると:
//   ・案1 場面のBGMは、解いたあと 24kHz に落として持つ(1本あたり約半分)
//   ・案2 場面のBGMは2本までしか持たない
// 鳴らし方(AudioBuffer を Web Audio で鳴らす)は変えない。モンヒロビートの曲(演奏)・効果音は対象外。
// 見ること:
//   ・切(既定)のときは、今までどおり(軽くしない・2本に絞らない)
//   ・入のときは、場面のBGMを8本続けて読んでも、持つのは2本まで・どれも 24kHz・持っている大きさが切のときより小さい
//   ・入のときも場面のBGMが鳴る(鳴らしている音の部品がある)・捨てた曲を読み直せる
//   ・入のときも、モンヒロビートの演奏の曲は軽くしない(別の鍵で、ふつうの音として持つ)
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 9192;
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
check('保存キーは新しい mh_bgm_light_v1(入/切だけ)', /const BGM_LIGHT_KEY = 'mh_bgm_light_v1';/.test(src));
check('鳴らし方は変えない(<audio> / MediaElementSource を使わない)', !/createMediaElementSource|new Audio\(/.test(src));
check('保存データの一覧に載っている', fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8').includes('`mh_bgm_light_v1`'));

const run = async (playwright, light) => {
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((on) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_update_notice_seen_v1', true);
      if (on) localStorage.setItem('mh_bgm_light_v1', 'on'); else localStorage.removeItem('mh_bgm_light_v1');
    }, light);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000, force: true });
    await page.waitForTimeout(1500);
    const songIds = await page.evaluate(() => [...new Set((typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : []).map((s) => s && s.bgmTrackId).filter(Boolean))]);
    const sceneIds = await page.evaluate((ids) => (typeof BGM_TRACKS !== 'undefined' ? BGM_TRACKS : [])
      .filter((t) => t && t.id && t.src && !ids.includes(t.id) && !/jingle|se[_-]/i.test(t.id)).map((t) => t.id), songIds);
    for (const id of sceneIds.slice(0, 8)) await page.evaluate(async (key) => Audio_.prepareBGM(key, 30000), id);
    const after = await page.evaluate(() => Audio_.diagnose());
    // 鳴らす: 最初の場面のBGM(捨てた曲)をもう一度鳴らす
    await page.evaluate(async (key) => { await Audio_.prepareBGM(key, 30000); Audio_.playBGM(key); }, sceneIds[0]);
    await page.waitForTimeout(800);
    const playing = await page.evaluate(() => Audio_.diagnose());
    // 演奏の曲を読む(startRhythmTrack と同じ入口)
    let rhythm = null;
    try {
      rhythm = await page.evaluate(async (id) => { const t = await Audio_.startRhythmTrack(id, 50, { autoStart: false }); const d = Audio_.diagnose(); try { t && t.stop && t.stop(); } catch (e) {} return { ok: !!t, names: d.songBufferNames, light: d.lightBufferCount }; }, songIds[0]);
    } catch (e) { rhythm = { ok: false, error: String(e) }; }
    return { after, playing, rhythm, errors, sceneCount: sceneIds.length };
  } finally { await browser.close(); }
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const server = await serve();
  try {
    const off = await run(playwright, false);
    const on = await run(playwright, true);
    check('場面のBGMが8本以上ある', on.sceneCount >= 8, String(on.sceneCount));
    check('切(既定)のときは軽くしない', off.after.bgmLight === false && off.after.lightBufferCount === 0, JSON.stringify({ light: off.after.bgmLight, n: off.after.lightBufferCount }));
    check('入のときは、場面のBGMを8本読んでも持つのは2本まで', on.after.bgmLight === true && on.after.lightBufferCount <= 2 && on.after.lightBufferCount >= 1, String(on.after.lightBufferCount));
    check('入のときは、持っている場面のBGMがどれも 24kHz', on.after.lightRates.length > 0 && on.after.lightRates.every((r) => r === 24000), on.after.lightRates.join(','));
    check('入のときは、持っている音の大きさが切のときより小さい', on.after.keptAudioMB < off.after.keptAudioMB, `切 ${off.after.keptAudioMB}MB / 入 ${on.after.keptAudioMB}MB`);
    check('入のときも場面のBGMが鳴る(捨てた曲も読み直して鳴らせる)', Array.isArray(on.playing.playing) ? on.playing.playing.length > 0 : !!on.playing.playing, JSON.stringify(on.playing.playing).slice(0, 120));
    check('入のときも、演奏の曲はふつうの音として持つ(軽くした鍵を使わない)', on.rhythm && on.rhythm.ok && (on.rhythm.names || []).length > 0 && !(on.rhythm.names || []).some((n) => /#light/.test(n)), JSON.stringify(on.rhythm).slice(0, 200));
    check('実行時エラーが出ていない', off.errors.length === 0 && on.errors.length === 0, [...off.errors, ...on.errors].slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
