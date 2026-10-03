const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// スコアを 1/1000 にした(2026-10-03)ときの、端末に残った数字の一度きりの移行を、実際のブラウザで通して確かめる検査。
//
// 古い大きい数字(自己ベスト・種族チャレンジの自己ベスト・送信待ち)を仕込んだ状態で起動し、
//   ① 自己ベストと送信待ちが 1/1000 になり、タクティクスとモンヒロビートは変わらない
//   ② 完了フラグが立つ
//   ③ 画面に出る「自己ベスト」が縮んだあとの数字になっている(縮める前の値を一瞬も読み込まない)
//   ④ もう一度開いても二重に縮まない
// Supabaseへは出られないので、通信は page.route で偽って返す。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8993;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};


(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // 1回目だけ古い数字を仕込む(同じ context の localStorage は2回目の起動にも残る)
    let seeded = false;
    const open = async () => {
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route('**/rest/v1/**', (route) => {
        const method = route.request().method();
        return route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: '[]' });
      });
      if (!seeded) {
        seeded = true;
        await page.addInitScript(() => {
          if (localStorage.getItem('__seeded')) return;
          localStorage.setItem('__seeded', '1');
          const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
          set('mh_breeder_name', 'けんさ'); set('mh_breeder_icon', 'Mocchi'); set('mh_onboarded', true);
          set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
          set('mh_hs_Hard', 4500000); set('mh_quick_hs_Hard', 1200000); set('mh_pro_hs_Master', 90000000);
          set('mh_extreme_hs_EXTREME', 123456789);
          set('mh_tactics_hs_Hard', 4200);
          set('mh_species_challenge_progress_v1', { version: 1, species: { Mocchi: { cleared: {}, firstRewardClaimed: {},
            records: { Hard: { bestScore: 8000000, bestTurns: 40, clears: 2 } } } } });
          set('mh_rank_Legend', [{ userName: 'けんさ', hero: 'Mocchi', party: [], score: 3000000, diff: 'Legend', level: 10,
            icon: 'Mocchi', clearId: 'p1', at: Date.now(), nationalSaved: true }]);
          set('mh_rank_TacticsHard', [{ userName: 'けんさ', score: 4000, clearId: 't1', nationalSaved: true }]);
          set('mh_rank_Rhythm-song-EASY', [{ userName: 'けんさ', score: 987654, clearId: 'r1', nationalSaved: true }]);
        });
      }
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.addStyleTag({ content: `.snap-mandatory{display:flex;overflow-x:auto;width:100%;}` });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      const read = (key) => page.evaluate((k) => { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); }, key);
      const snapshot = {
        flag: await read('mh_battle_score_shrink_migrated_v1'),
        hard: await read('mh_hs_Hard'), quick: await read('mh_quick_hs_Hard'), pro: await read('mh_pro_hs_Master'),
        extreme: await read('mh_extreme_hs_EXTREME'), tactics: await read('mh_tactics_hs_Hard'),
        species: await read('mh_species_challenge_progress_v1'),
        pending: await read('mh_rank_Legend'), tacticsPending: await read('mh_rank_TacticsHard'),
        rhythmPending: await read('mh_rank_Rhythm-song-EASY'),
      };
      await page.close();
      return { snapshot, errors };
    };

    const first = await open();
    const s = first.snapshot;
    check('完了フラグが立つ', s.flag === true);
    check('チャレンジ・クイック・プロ・極限の自己ベストが 1/1000 になる',
      s.hard === 4500 && s.quick === 1200 && s.pro === 90000 && s.extreme === 123456,
      JSON.stringify([s.hard, s.quick, s.pro, s.extreme]));
    check('種族チャレンジの自己ベストが 1/1000 になる', s.species && s.species.species.Mocchi.records.Hard.bestScore === 8000
      && s.species.species.Mocchi.records.Hard.bestTurns === 40);
    check('送信待ちの score が 1/1000 になる', s.pending && s.pending[0].score === 3000, JSON.stringify(s.pending && s.pending[0].score));
    check('タクティクスの記録は変わらない', s.tactics === 4200 && s.tacticsPending[0].score === 4000);
    check('モンヒロビートの記録は変わらない', s.rhythmPending[0].score === 987654);
    check('実行時エラーが出ていない', first.errors.length === 0, first.errors[0] || '');

    const second = await open();
    const t = second.snapshot;
    check('二度目の起動では二重に縮まない',
      t.hard === 4500 && t.quick === 1200 && t.pro === 90000 && t.extreme === 123456
      && t.species.species.Mocchi.records.Hard.bestScore === 8000 && t.pending[0].score === 3000,
      JSON.stringify([t.hard, t.pending && t.pending[0].score]));
    check('二度目も実行時エラーが出ていない', second.errors.length === 0, second.errors[0] || '');

    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
