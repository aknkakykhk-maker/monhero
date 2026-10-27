// MFバトルカードの「助手と対戦の曲の並び」(2026-10-26 社長の依頼)を、実際のブラウザで確かめる。
//
//   node tools/card/card-cpu-playlist-browser-check.js
//   CARD_VIEWPORT=320x568 … 画面の大きさ(既定 390x844)
//   CARD_SHOT_DIR=<フォルダ> … オプションの欄の写真も撮る
//
// 【なぜ要るか】
// 流す順の決まりは card-cpu-playlist-check.js が node で見ている。ここは、画面の操作と保存、
// 本物の音の出口(14-audio)で「流れ終わったら次の曲」「止めたら進まない」「読めない曲は飛ばす」を見る。
// 本物の曲は数分あるので、検査のあいだだけ短い音(7秒ほど)を曲の一覧へ足して使う(ゲームのデータは変えない)。
//
// 【見るもの】
// ① 音の出口: 1回だけの曲は流れ終わると知らせる / 途中でほかの曲にしたら知らせない / 読めない曲は知らせる・古い呼び出しは知らせない
// ② オプション: 助手と対戦の1曲えらびの欄が無く、助手ごとの曲の並びの欄がある。開いただけでは保存しない
// ③ 足す・変える・外す・はじめの曲に戻す。同じ曲は選べない・5曲まで・1曲は外せない。ほかの助手と前の保存(mh_card_bgm_v1)は変わらない
// ④ 全員に同じ曲を入れる: やめると何も変わらない・確かめてから全員へ入る・そのあと助手ごとに直せる
// ⑤ 試聴は、オプションを閉じたら止まる
// ⑥ 画面が横にはみ出さない(320 幅でも)
// ⑦ 対戦: 2曲の並びが交互に流れ、投了したら並びが止まる(トップの曲に戻り、そのあと並びの曲へ戻らない)
// ⑧ 対戦: 並びの曲が全部読めなくても対戦は続き、BGM は止まる
// ⑨ どこでも実行時エラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9193;
const SHOT = process.env.CARD_SHOT_DIR || '';
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SHORT = 'audio/se-awakened-moo-apocalypse.mp3'; // 7秒ほどの音(検査のあいだだけ曲として使う)

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__cardPlSeeded')) return;
    sessionStorage.setItem('__cardPlSeeded', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    localStorage.setItem('mh_debug_unlocked_v1', '1');
  });
  await page.addInitScript(quiet.eventStorySeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const stored = () => page.evaluate(() => ({ pl: JSON.parse(localStorage.getItem('mh_card_cpu_playlist_v1') || 'null'), bgm: localStorage.getItem('mh_card_bgm_v1') }));
  const bgmNow = () => page.evaluate(() => { const p = (Audio_.diagnose().playing || []); const b = p.find((x) => x.kind === 'bgm'); const v = p.find((x) => x.kind === 'preview'); return { bgm: b ? b.key : null, preview: v ? v.key : null }; });
  const shot = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
  const waitBgm = async (pred, ms) => { const end = Date.now() + ms; let last = null; while (Date.now() < end) { last = await bgmNow(); if (pred(last.bgm)) return last.bgm; await page.waitForTimeout(250); } return null; };
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('TAP TO START'))?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
      if (!clicked && await page.evaluate(() => !!document.querySelector('[data-home-card-battle]') && !document.querySelector('[role="dialog"]'))) break;
      await page.waitForTimeout(600);
    }
    // 検査のあいだだけ、短い音を曲の一覧へ足す(__pl_bad・__pl_bad2 は無いファイル)
    await page.evaluate((short) => {
      const add = (t) => { BGM_TRACKS.push(t); BGM_TRACK_BY_ID[t.id] = t; };
      add({ id: '__pl_a', name: '検査の曲A', creator: '検査', src: short, gain: 1, loop: true });
      add({ id: '__pl_b', name: '検査の曲B', creator: '検査', src: short, gain: 1, loop: true });
      add({ id: '__pl_bad', name: '検査の曲(無い)', creator: '検査', src: 'audio/__no_such_file__.mp3', gain: 1, loop: true });
      add({ id: '__pl_bad2', name: '検査の曲(無い2)', creator: '検査', src: 'audio/__no_such_file_2__.mp3', gain: 1, loop: true });
      window.__plLog = [];
      Audio_.unlock && Audio_.unlock();
    }, SHORT);
    await page.waitForTimeout(500);
    const audioReady = await page.evaluate(() => { const d = Audio_.diagnose(); return d.enabled && d.bgmVolumePct > 0; });

    // ① 音の出口
    if (audioReady) {
      const ended = await page.evaluate(async () => {
        const log = [];
        Audio_.setBgmOnce('__pl_a', { onEnd: () => log.push('end'), onFail: () => log.push('fail') });
        Audio_.playBGM('__pl_a');
        const t0 = Date.now();
        while (Date.now() - t0 < 15000 && !log.length) await new Promise((r) => setTimeout(r, 200));
        return { log, sec: Math.round((Date.now() - t0) / 1000) };
      });
      check('① 1回だけの曲は、最後まで流れると「流れ終わった」と知らせる(繰り返さない)', ended.log.join() === 'end', JSON.stringify(ended));
      const cut = await page.evaluate(async () => {
        const log = [];
        Audio_.setBgmOnce('__pl_b', { onEnd: () => log.push('end'), onFail: () => log.push('fail') });
        Audio_.playBGM('__pl_b');
        await new Promise((r) => setTimeout(r, 1500));
        Audio_.playBGM('original_title');
        await new Promise((r) => setTimeout(r, 9000));
        return log;
      });
      check('① 途中でほかの曲にしたら、前の曲の「流れ終わった」は来ない', cut.length === 0, JSON.stringify(cut));
      const bad = await page.evaluate(async () => {
        const log = [];
        Audio_.setBgmOnce('__pl_bad', { onEnd: () => log.push('end'), onFail: () => log.push('fail') });
        Audio_.playBGM('__pl_bad');
        await new Promise((r) => setTimeout(r, 3000));
        const stale = [];
        Audio_.setBgmOnce('__pl_bad2', { onEnd: () => stale.push('end'), onFail: () => stale.push('fail') });
        Audio_.playBGM('__pl_bad2');
        Audio_.playBGM('original_title');
        await new Promise((r) => setTimeout(r, 3000));
        Audio_.stopBGM();
        return { log, stale };
      });
      check('① 読めない曲は「読めなかった」と知らせる', bad.log.join() === 'fail', JSON.stringify(bad.log));
      check('① 読み込み中にほかの曲にしたら、古い呼び出しは知らせない', bad.stale.length === 0, JSON.stringify(bad.stale));
    } else {
      check('① 音が出せる状態で確かめる(音量・音の入)', false, 'Audio_ が鳴らせない状態でした');
    }

    // カードのトップへ
    await page.evaluate(() => document.querySelector('[data-home-card-battle]')?.click());
    await page.waitForSelector('[data-card-top]', { timeout: 20000 });
    if (await has('[data-card-top="starter"]')) {
      await page.click('[data-card-kit="powerful"]');
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
      await page.click('[data-card-quit]');
      await page.waitForTimeout(300);
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit'))?.click(); });
      await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 });
      await page.getByRole('button', { name: 'トップへ' }).click();
    }
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 });

    // ② オプション
    const before0 = await stored();
    await page.click('[data-card-options-open]');
    await page.waitForSelector('[data-card-options]', { timeout: 8000 });
    await page.locator('[data-card-playlist]').scrollIntoViewIfNeeded();
    // 助手の数は、ゲームの中の公開済みの助手から数える(ソラシドの公開で7人になった。2026-10-27)
    const OPEN = await page.evaluate(() => Object.keys(CARD_CPU_PLAYLIST_DEFAULT).filter((w) => cardFoeReleased(w)));
    const ui = await page.evaluate(() => ({
      cpuSelect: !!document.querySelector('[data-card-bgm-select="cpu"]'),
      top: !!document.querySelector('[data-card-bgm-select="top"]'), pvp: !!document.querySelector('[data-card-bgm-select="pvp"]'),
      who: [...document.querySelectorAll('[data-card-playlist-who]')].map((b) => b.getAttribute('data-card-playlist-who')),
      rows: [...document.querySelectorAll('[data-card-playlist-rows="who"] [data-card-playlist-row]')].map((r) => r.getAttribute('data-card-playlist-row')),
    }));
    check('② 助手と対戦の1曲えらびの欄が無く、トップ画面・マルチ対戦の欄は残る', !ui.cpuSelect && ui.top && ui.pvp);
    check(`② 公開済みの助手${OPEN.length}人を選べ、はじめはその助手の曲1つ`, OPEN.length >= 6 && JSON.stringify([...ui.who].sort()) === JSON.stringify([...OPEN].sort()) && ui.rows.join() === 'melo_toriko', JSON.stringify({ ...ui, OPEN }));
    const opened = await stored();
    check('② 開いただけでは保存しない', opened.pl === null && before0.pl === null && opened.bgm === before0.bgm, JSON.stringify(opened));
    if (SHOT) await shot('options-playlist-1');

    // ③ 足す・変える・外す・戻す(きき)
    await page.click('[data-card-playlist-who="kiki"]');
    await page.waitForTimeout(150);
    const addChoices = await page.evaluate(() => [...document.querySelectorAll('[data-card-playlist-add] option')].map((o) => o.value));
    check('③ 足す一覧に、もう入れた曲は出ない', !addChoices.includes('eiki_boss') && addChoices.includes('melo_toriko'), `${addChoices.length}件`);
    await page.selectOption('[data-card-playlist-add]', 'melo_toriko');
    await page.waitForTimeout(250);
    let s1 = await stored();
    check('③ 曲を足すとその場で新しいキーに残り、ほかの助手と前の保存は変わらない', s1.pl && JSON.stringify(s1.pl.assistants.kiki) === '["eiki_boss","melo_toriko"]' && JSON.stringify(s1.pl.assistants.mua) === '["melo_toriko"]' && s1.bgm === before0.bgm, JSON.stringify(s1));
    const changeChoices = await page.evaluate(() => [...document.querySelectorAll('[data-card-playlist-change="1"] option')].map((o) => o.value));
    check('③ 変える一覧に、ほかの行の曲は出ない(同じ曲を2つ入れられない)', !changeChoices.includes('eiki_boss') && changeChoices.includes('melo_toriko'));
    await page.selectOption('[data-card-playlist-change="1"]', 'ichika_battle');
    await page.waitForTimeout(250);
    s1 = await stored();
    check('③ 曲を変えられる', JSON.stringify(s1.pl.assistants.kiki) === '["eiki_boss","ichika_battle"]', JSON.stringify(s1.pl.assistants.kiki));
    await page.click('[data-card-playlist-rows="who"] [data-card-playlist-remove="0"]');
    await page.waitForTimeout(250);
    s1 = await stored();
    const oneLeft = await page.evaluate(() => document.querySelector('[data-card-playlist-rows="who"] [data-card-playlist-remove="0"]').disabled);
    check('③ 外せる。1曲だけになったら外せない(0曲にしない)', JSON.stringify(s1.pl.assistants.kiki) === '["ichika_battle"]' && oneLeft);
    for (const id of ['melo_toriko', 'eiki_boss', 'atsu_cup_theme', 'melo_crossing_field']) { await page.selectOption('[data-card-playlist-add]', id); await page.waitForTimeout(200); }
    s1 = await stored();
    const full = await page.evaluate(() => ({ add: !!document.querySelector('[data-card-playlist-rows="who"] [data-card-playlist-add]'), msg: !!document.querySelector('[data-card-playlist-rows="who"] [data-card-playlist-full]') }));
    check('③ 5曲まで入り、5曲になったら足す欄が「5曲まで」の案内に替わる', s1.pl.assistants.kiki.length === 5 && !full.add && full.msg, JSON.stringify(s1.pl.assistants.kiki));
    if (SHOT) { await page.locator('[data-card-playlist]').scrollIntoViewIfNeeded(); await shot('options-playlist-5'); }
    // ⑥ はみ出し
    const overflow = await page.evaluate(() => {
      const vw = window.innerWidth;
      const bad = [...document.querySelectorAll('[data-card-playlist] *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).map((e) => e.outerHTML.slice(0, 60));
      return { page: document.documentElement.scrollWidth > vw + 1, bad };
    });
    check(`⑥ ${VW}x${VH} で曲の並びの欄が横にはみ出さない`, !overflow.page && overflow.bad.length === 0, overflow.bad.slice(0, 2).join(' / '));
    const small = await page.evaluate(() => [...document.querySelectorAll('[data-card-playlist] button, [data-card-playlist] select')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 39; }).length);
    check('⑥ ボタンと選ぶ欄は押しやすい高さ(40px 前後以上)', small === 0, `${small}個`);
    await page.click('[data-card-playlist-reset]');
    await page.waitForTimeout(250);
    s1 = await stored();
    check('③ はじめの曲に戻せる', JSON.stringify(s1.pl.assistants.kiki) === '["eiki_boss"]');

    // ④ 全員に同じ曲を入れる
    const beforeCopy = JSON.stringify((await stored()).pl);
    await page.click('[data-card-playlist-copy-open]');
    await page.selectOption('[data-card-playlist-rows="copy"] [data-card-playlist-add]', '__pl_a');
    await page.waitForTimeout(150);
    await page.click('[data-card-playlist-copy] [data-card-playlist-copy-cancel]');
    await page.waitForTimeout(200);
    check('④ 「やめる」なら何も変わらない', JSON.stringify((await stored()).pl) === beforeCopy && !(await has('[data-card-playlist-copy]')));
    await page.click('[data-card-playlist-copy-open]');
    await page.selectOption('[data-card-playlist-rows="copy"] [data-card-playlist-add]', '__pl_a');
    await page.waitForTimeout(150);
    await page.click('[data-card-playlist-copy-go]');
    const confirmText = await page.locator('[data-card-playlist-copy-confirm]').innerText().catch(() => '');
    check('④ 入れる前に、助手ごとの曲が置き換わると確かめる', /置き換わります/.test(confirmText), confirmText);
    if (SHOT) { await page.locator('[data-card-playlist-copy]').scrollIntoViewIfNeeded(); await shot('options-playlist-copy'); }
    await page.click('[data-card-playlist-copy-confirm] [data-card-playlist-copy-cancel]');
    await page.waitForTimeout(200);
    check('④ 確かめの「やめる」でも何も変わらない', JSON.stringify((await stored()).pl) === beforeCopy);
    await page.click('[data-card-playlist-copy-open]');
    await page.selectOption('[data-card-playlist-rows="copy"] [data-card-playlist-add]', '__pl_a');
    await page.selectOption('[data-card-playlist-rows="copy"] [data-card-playlist-add]', '__pl_b');
    await page.click('[data-card-playlist-rows="copy"] [data-card-playlist-remove="0"]');
    await page.waitForTimeout(150);
    await page.click('[data-card-playlist-copy-go]');
    await page.click('[data-card-playlist-copy-ok]');
    await page.waitForTimeout(300);
    const copied = (await stored()).pl;
    check('④ 「置き換える」で助手みんなが同じ曲になる', copied && JSON.stringify(Object.keys(copied.assistants).sort()) === JSON.stringify([...OPEN].sort()) && Object.values(copied.assistants).every((l) => JSON.stringify(l) === '["__pl_a","__pl_b"]'), JSON.stringify(copied));
    await page.click('[data-card-playlist-who="kiki"]');
    await page.selectOption('[data-card-playlist-change="0"]', '__pl_bad');
    await page.selectOption('[data-card-playlist-change="1"]', '__pl_bad2');
    await page.waitForTimeout(250);
    const after = (await stored()).pl;
    check('④ 入れたあとも助手ごとに直せる(ききだけ変わる)', JSON.stringify(after.assistants.kiki) === '["__pl_bad","__pl_bad2"]' && JSON.stringify(after.assistants.mua) === '["__pl_a","__pl_b"]');
    check('③④ 前の保存(mh_card_bgm_v1)は一度も書き換えていない', (await stored()).bgm === before0.bgm, String((await stored()).bgm));

    // ⑤ 試聴
    if (audioReady) {
      await page.click('[data-card-playlist-who="mua"]');
      await page.click('[data-card-playlist-rows="who"] [data-card-playlist-preview="__pl_a"]');
      await page.waitForTimeout(1500);
      const pv = await bgmNow();
      await page.locator('[data-card-options] header button').first().click();
      await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 });
      await page.waitForTimeout(800);
      const pv2 = await bgmNow();
      check('⑤ 試聴は鳴り、オプションを閉じたら止まってトップの曲に戻る', pv.preview === '__pl_a' && !pv2.preview && pv2.bgm !== '__pl_a', JSON.stringify({ pv, pv2 }));
    } else {
      await page.locator('[data-card-options] header button').first().click();
      await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 });
    }

    // ⑦ 対戦(みゅあ: 2曲が交互)
    const startFoe = async (who) => {
      await page.click('[data-card-cpu]');
      await page.click('[data-card-mode-assistant]');
      await page.waitForSelector(`[data-card-foe="${who}"]`, { timeout: 8000 });
      await page.click(`[data-card-foe="${who}"]`);
      await page.click('[data-card-start]');
      await page.waitForSelector('[data-card-vs], [data-card-battle]', { timeout: 20000 });
    };
    const quitBattle = async () => {
      if (await has('[data-card-vs]')) { await page.click('[data-card-vs]'); }
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
      await page.click('[data-card-quit]');
      await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '投了する' }).click();
      await page.waitForSelector('[data-card-top="result"]', { timeout: 20000 });
    };
    if (audioReady) {
      await startFoe('mua');
      const seq = [];
      const first = await waitBgm((k) => k === '__pl_a' || k === '__pl_b', 8000);
      if (first) seq.push(first);
      for (let i = 0; i < 2 && seq.length; i++) {
        const nx = await waitBgm((k) => (k === '__pl_a' || k === '__pl_b') && k !== seq[seq.length - 1], 14000);
        if (!nx) break;
        seq.push(nx);
      }
      check('⑦ 2曲の並びが、流れ終わるたびに交互に流れる', seq.length === 3 && seq[0] !== seq[1] && seq[1] !== seq[2], seq.join(' → '));
      await quitBattle();
      await page.waitForTimeout(1000);
      const afterQuit = await bgmNow();
      await page.waitForTimeout(9000);
      const later = await bgmNow();
      check('⑦ 投了したら並びは止まり、そのあと並びの曲へ戻らない', !['__pl_a', '__pl_b'].includes(afterQuit.bgm) && !['__pl_a', '__pl_b'].includes(later.bgm), JSON.stringify({ afterQuit, later }));
      // もう一度: 並びをまた始める
      await page.getByRole('button', { name: 'もう一度' }).click();
      await page.waitForSelector('[data-card-vs], [data-card-battle]', { timeout: 20000 });
      const again = await waitBgm((k) => k === '__pl_a' || k === '__pl_b', 8000);
      check('⑦ 「もう一度」で並びをまた始める', !!again, String(again));
      await quitBattle();

      // ⑧ ききは全部読めない曲
      await page.getByRole('button', { name: '相手をえらぶ' }).click();
      await page.waitForSelector('[data-card-foe="kiki"]', { timeout: 8000 });
      await page.click('[data-card-foe="kiki"]');
      await page.click('[data-card-start]');
      await page.waitForSelector('[data-card-vs], [data-card-battle]', { timeout: 20000 });
      if (await has('[data-card-vs]')) await page.click('[data-card-vs]');
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
      await page.waitForTimeout(5000);
      const silent = await bgmNow();
      const alive = await has('[data-card-battle]');
      check('⑧ 並びの曲が全部読めなくても対戦は続き、BGM は止まる', alive && !silent.bgm, JSON.stringify(silent));
      await quitBattle();
    }
    check('⑨ 実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査を最後まで進められた', false, String(e && e.message || e).slice(0, 300));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
