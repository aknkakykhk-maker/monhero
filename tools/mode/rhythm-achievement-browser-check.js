// モンヒロビートの実績の台帳を、実際に開いたゲームの中で確かめる(2026-10-05)。
//
//   node tools/mode/rhythm-achievement-browser-check.js
//
// rhythm-achievement-check.js は実装を取り出して偽の保存で動かす。こちらは本物のゲームを開いて、
//   ・モンヒロビートを開いたとき、すでに取れていたBESTの実績が台帳(mh_rhythm_achievements_v1)へ時刻不明で取り込まれる
//   ・本物の曲の一覧と照らして、公開している曲・難易度だけが報酬の対象になる
//   ・BESTの保存値(mh_rhythm_best_v1)は、台帳を作っても書き換わらない
//   ・開いたあとで取れた実績には、時刻が付く
// を見る。曲を最後まで遊ぶ代わりに、保存直後に呼ぶ入口(recordRhythmAchievements)をそのまま呼ぶ。
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9199;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const SONG = 'mf_ichika_mix';
const seed = (song) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  // すでにフルコンボとオールマーベラスを取っているBEST(実績の仕組みより前に取ったもの)
  put('mh_rhythm_best_v1', { [song]: {
    EASY: { bestScore: 900000, maxCombo: 100, played: true, clear: true, fullCombo: true, allExcellent: false, allMarvelous: false },
    NORMAL: { bestScore: 990000, maxCombo: 100, played: true, clear: true, fullCombo: true, allExcellent: true, allMarvelous: true },
  } });
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(seed, SONG);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(250); }
    const before = await page.evaluate(() => localStorage.getItem('mh_rhythm_achievements_v1'));
    check('モンヒロビートを開く前は、台帳はまだ無い', before === null);
    await clickText('モンヒロビート');
    // 入るとまずモードえらび(2026-10-03)。台帳へのそろえは、この画面を開いた時点で走る
    await page.waitForFunction(() => document.body.innerText.includes('ソロライブ'), null, { timeout: 30000 });
    await page.waitForFunction(() => localStorage.getItem('mh_rhythm_achievements_v1') !== null, null, { timeout: 15000 }).catch(() => null);

    const opened = await page.evaluate((song) => {
      const ledger = JSON.parse(localStorage.getItem('mh_rhythm_achievements_v1') || 'null');
      return { ledger, best: localStorage.getItem('mh_rhythm_best_v1'), rewards: RHYTHM_ACHIEVEMENT_REWARDS.length,
        eligible: [rhythmAchievementEligible(song, 'EASY'), rhythmAchievementEligible(song, 'NORMAL'), rhythmAchievementEligible('no_such_song', 'EASY'), rhythmAchievementEligible(song, 'NO_SUCH')] };
    }, SONG);
    const ids = opened.ledger ? Object.keys(opened.ledger.items).sort() : [];
    check('開いたとき、すでに取れていた実績(EASY の FC / NORMAL の FC・AE・AM)が台帳へ入る',
      ids.join() === `${SONG}:EASY:fullCombo,${SONG}:NORMAL:allExcellent,${SONG}:NORMAL:allMarvelous,${SONG}:NORMAL:fullCombo`, ids.join());
    check('取り込んだぶんは、時刻不明(0)で入る', ids.length > 0 && ids.every((id) => opened.ledger.items[id].at === 0));
    check('BESTの保存値は、台帳を作っても書き換わらない', JSON.parse(opened.best)[SONG].EASY.bestScore === 900000 && !('items' in JSON.parse(opened.best)));
    check('公開している曲・難易度だけが報酬の対象(存在しない曲・難易度は対象外)', opened.eligible.join() === 'true,true,false,false', opened.eligible.join());
    check('報酬ルールの一覧を読める(ルールが無くても、報酬を渡す側は動かない)', Number.isInteger(opened.rewards));

    // 開いたあとに取れた実績(EASY のオールエクセレント)
    const after = await page.evaluate(async (song) => {
      const prev = { [song]: { EASY: { fullCombo: true } } };
      const next = { [song]: { EASY: { fullCombo: true, allExcellent: true }, HARD: { fullCombo: true } } };
      const result = await recordRhythmAchievements(next, { initialRecords: prev });
      return { added: result.added, ledger: JSON.parse(localStorage.getItem('mh_rhythm_achievements_v1')) };
    }, SONG);
    check('開いたあとに取れた実績だけが「いま取れた」になり、時刻が付く',
      after.added.sort().join() === `${SONG}:EASY:allExcellent,${SONG}:HARD:fullCombo`
      && after.ledger.items[`${SONG}:EASY:allExcellent`].at > 0 && after.ledger.items[`${SONG}:EASY:fullCombo`].at === 0, after.added.join());
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
