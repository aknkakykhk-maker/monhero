// モンヒロバトルにいる助手の入口(👀 修行を見る・📣 応援する)が、どこから来ても押せて開くかを確かめる
// (2026-11-12 社長「モンバトに助手いるけどなにもないよ?」「タップ押しても何も起きない」)。
//   node tools/assistant/life-battle-entry-check.js           本文の確かめ + 本物の画面(iPhone の大きさ・タップ)
//   node tools/assistant/life-battle-entry-check.js --static  本文の確かめだけ(ブラウザを使わない)
// 前の不具合:
//   ・「✨ いま行くと得」のモンヒロバトルの行(家の帯・部屋・地図の窓)が、ふつうのモンヒロバトルの画面へ飛ぶだけ。そこには助手が何も出ない
//   ・助手の部屋には 👀 修行を見る・📣 応援するが無く、地図の窓にしか無かった(HOME の顔から来ると部屋が開くので見つからない)
//   ・HOME の顔はいつも札の下。モンヒロバトルの札は画面のいちばん下なので、顔が 12px で下の帯にかかり、見えない・押せなかった
// 見るもの:
//   ① 得の行のモンヒロバトルは、地図のモンヒロバトルの窓を開く(assistantLifeOpenMapAt)。画面は mapFocus を受けて地図の窓を出す
//   ② 部屋(place === 'battle')に 👀 修行を見る・📣 応援するの行。見る画面の入れ物は、地図が出ていないときだけ家の画面にも1つ
//   ③ HOME の顔は、下のすき間が狭い札では札の上に出す
//   ④ 本物の画面: HOME の顔が画面の中に 18px 以上で出て押せる → 部屋に2行 → 修行を見るが開く → 応援できる → 「行く ›」で地図の窓(その助手を選んだ状態)
//   ⑤ 練習試合(👀 修行を見る)を開いたまま助手ライフが閉じても、次に地図を開いたとき勝手に始まらない(社長「助手のオート対戦が気付いたらはじまってた」)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9293;
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

{ // 本文
  const life = read('monster-hero/src/parts/56-assistant-life.jsx');
  const ux = read('monster-hero/src/parts/56-assistant-life-ux.jsx');
  const house = read('monster-hero/src/parts/56-assistant-life-house.jsx');
  const map = read('monster-hero/src/parts/56-assistant-life-map.jsx');
  check('① 口 assistantLifeOpenMapAt(open と mapFocus を入れるだけ・保存しない)', /const assistantLifeOpenMapAt = \(place, id = null\) => \{ if \(assistantLifeEnabled\(\)\) ASSISTANT_LIFE_STORE\.set\(\{ open: true, mapFocus:/.test(life));
  const bt = ux.slice(ux.indexOf("rows.push({ k: 'battle'"), ux.indexOf("rows.push({ k: 'battle'") + 400);
  check('① 得の行のモンヒロバトルは地図の窓へ(ふつうのモンヒロバトルへ飛ぶのは口が無いときだけ)', /go: typeof assistantLifeOpenMapAt === 'function' \? \(\) => assistantLifeOpenMapAt\('battle', bt\[0\]\)/.test(bt));
  check('① 画面は mapFocus を受けて地図のタブ・窓へ(受けたら消す)', /const f = st\.mapFocus;[^\n]*setTab\('where'\);[^\n]*ASSISTANT_LIFE_STORE\.set\(\{ mapFocus: null \}\)/.test(house) && /initialKey=\{mapFocusKey\}/.test(house));
  check('① 開いたままの地図も、initialKey が変われば窓を出し直す', /initialKey = 0 \}\) \{/.test(map) && /setSheet\(initialPlace\); \}, \[initialKey\]\)/.test(map));
  const room = house.slice(house.indexOf('data-assistant-life-room-train'), house.indexOf('data-assistant-life-room-cheer-msg'));
  check('② 部屋に 👀 修行を見る・📣 応援する(battle のときだけ・口は typeof で)', /if \(!w \|\| w\.place !== 'battle'\) return null;/.test(house) && /k="train-watch"/.test(room) && /k="cheer"/.test(room) && /disabled=\{!ti\.canCheer\}/.test(room) && /typeof assistantMasmonTrainRowInfo === 'function'/.test(house));
  check('② 見る画面の入れ物は、地図が出ていないときだけ家の画面にも(2つ重ねない)', /\{roomId && tab !== 'where' && typeof AssistantMasmonTrainWatchHost === 'function' && <AssistantMasmonTrainWatchHost\/>\}/.test(house) && (map.match(/<AssistantMasmonTrainWatchHost\/>/g) || []).length === 2); // 地図の根元に1つ+モンヒロバトルの選択画面の枠(AssistantLifeBattleHall)に1つ。選択画面では家も地図も出ない
  const cheer = read('monster-hero/src/parts/56-assistant-life-masmon-cheer.jsx');
  check('⑤ 練習試合の入れ物が消えるときは「開いている」も消す(残ると次に地図を開いたとき勝手に始まる)', /AMGC_HOST\.subs\.delete\(f\); if \(!AMGC_HOST\.subs\.size\) AMGC_HOST\.open = null;/.test(cheer));
  check('③ HOME の顔: 下のすき間が狭い札では上へ', /const above = r\.gap < 16 && Number\.isFinite\(r\.up\) && r\.up >= 19;/.test(house) && /above \? r\.y - size - 1 : r\.y \+ r\.h \+ 1/.test(house));
}

(async () => {
  if (process.argv.includes('--static')) return done();
  let chromium, devices;
  try { ({ chromium, devices } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので画面は確かめません'); return done(); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.clock.setFixedTime(new Date('2026-11-12T13:40:00Z'));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; window.__mhLifeUiNoSeed = true; }); // 本番と同じ新UI(既定)で
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await finishTalk(page);
    // iPhone の Safari に出る「ホーム画面に追加」の案内が出ていたら閉じる
    for (let k = 0; k < 3 && await page.locator('[data-home-screen-guide]').count(); k++) { await page.locator('[data-home-screen-guide] button').first().tap({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
    // あつをモンヒロバトルに(ページの中だけ)
    const WHO = 'atsu';
    await page.evaluate((who) => { const st = ASSISTANT_LIFE_STORE.state, l = st.life; const groups = (l.groups || []).map(g => ({ ...g, ids: g.ids.filter(x => x !== who) })).filter(g => g.ids.length > 1); const solo = { ...(l.solo || {}) }; solo[who] = { doing: 'battle', place: 'battle' }; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups, solo } }); }, WHO);
    await page.waitForTimeout(1600);
    const face = page.locator(`[data-assistant-life-home-faces="battle"] [data-assistant-life-home-face="${WHO}"]`);
    const f = await face.evaluate(el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), H: innerHeight, hit: t === el || el.contains(t) }; }).catch(() => null);
    check('④ HOME: モンヒロバトルの助手の顔が画面の中に 18px 以上で出て、押せる(前は 12px で下の帯にかかっていた)', !!f && f.w >= 18 && f.bottom <= f.H - 4 && f.top >= 0 && f.hit, JSON.stringify(f));
    await face.tap({ timeout: 3000 }).catch(() => {});
    await page.locator(`[data-assistant-life-room-sheet="${WHO}"]`).waitFor({ timeout: 6000 }).catch(() => {});
    check('④ 顔を押すと、その助手の部屋が開く', (await page.locator(`[data-assistant-life-room-sheet="${WHO}"]`).count()) === 1);
    check('④ 部屋に 👀 修行を見る・📣 応援する', (await page.locator('[data-assistant-life-room-do="train-watch"]').count()) === 1 && (await page.locator('[data-assistant-life-room-do="cheer"]').count()) === 1);
    await page.locator('[data-assistant-life-room-do="train-watch"]').tap({ timeout: 3000 }).catch(() => {});
    await page.locator('.ambw-root').waitFor({ timeout: 4000 }).catch(() => {});
    check('④ 部屋の「修行を見る」で練習試合の画面が開く', (await page.locator('.ambw-root').count()) === 1);
    await page.locator('.ambw-root button').first().tap({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    check('④ 練習試合の画面は「戻る」で閉じる', (await page.locator('.ambw-root').count()) === 0);
    await page.locator('[data-assistant-life-room-do="cheer"]').tap({ timeout: 3000 }).catch(() => {});
    const msg = await page.locator(`[data-assistant-life-room-cheer-msg="${WHO}"]`).innerText({ timeout: 3000 }).catch(() => '');
    check('④ 部屋の「応援する」で、熟練と 💗 が上がった知らせが出る(または、できない理由)', /熟練 \+1|応援/.test(msg), msg);
    await page.locator('[data-assistant-life-place-perk-go="battle"]').tap({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const sel = await page.locator('[data-assistant-life-map-sheet-who]').evaluateAll(a => a.map(b => `${b.getAttribute('data-assistant-life-map-sheet-who')}:${b.getAttribute('data-assistant-life-map-sheet-at')}:${b.getAttribute('data-assistant-life-map-sheet-selected') || ''}`)).catch(() => []);
    check('④ 「いま行くと得」の 行く › は、ふつうのモンヒロバトルではなく地図のモンヒロバトルの窓(その助手を選んで)', (await page.locator('[data-assistant-life-screen]').count()) === 1 && sel.includes(`${WHO}:battle:1`), sel.join(' '));
    { // ⑤ 練習試合を開いたまま助手ライフが閉じても、次に地図を開いたとき勝手に始まらない
      await page.locator(`[data-assistant-life-map-act="train-watch"]`).first().tap({ timeout: 3000 }).catch(() => {});
      await page.locator('.ambw-root').waitFor({ timeout: 4000 }).catch(() => {});
      const opened = await page.locator('.ambw-root').count();
      await page.evaluate(() => assistantLifeCloseScreen()); await page.waitForTimeout(600);
      await page.evaluate(() => assistantLifeOpenScreen()); await page.waitForTimeout(800);
      await page.locator('[data-assistant-life-icon="where"]').first().tap({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1000);
      check('⑤ 練習試合を開いたまま助手ライフが閉じても、次に地図を開いたとき勝手に始まらない', opened === 1 && (await page.locator('.ambw-root').count()) === 0, `開いた ${opened}`);
      await page.locator('[data-assistant-life-map-place="battle"]').first().tap({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    check('④ 地図の窓に 👀 修行を見る・📣 応援する', (await page.locator(`[data-assistant-life-map-train-acts="${WHO}"]`).count()) === 1);
    check('④ 画面のエラーが無い', !errors.length, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  done();
})().catch(e => { console.log('NG: 例外', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); failed++; done(); });

function done() { console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK'); process.exit(failed ? 1 : 0); }
