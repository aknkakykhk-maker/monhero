// 助手マスモンの対戦 β その2(フレンド対戦+ランキング・56-assistant-masmon-battle-beta.jsx)を、本物の画面で確かめる。
//   サーバ(masmon-pvp の関数・表)は差し替えて返す。勝ち負けは本物の計算(tools/masmon-battle/load.js)で回す
//   node tools/assistant/assistant-masmon-battle-pvp-view-check.js          検査(縦 390×844)
//   node tools/assistant/assistant-masmon-battle-pvp-view-check.js --shots  止め絵(docs/progress/assistant-peer/masmon-battle/beta/pvp-*.png)
// 見るもの:
//   ① 印 assistantMasmonBattlePvp が偽のあいだ、画面からサーバを呼ばない(表を読む口も呼ばない)
//   ② 印が真: じゅんびに「この端末/フレンド」・フレンドの助手が並ぶ・区分2つ・挑むと登録してから挑む・観戦と振り返りにポイントの増減
//   ③ 見返しがサーバの結果と合う(版がちがう、が出ない)・この端末の戦績は増えない
//   ④ ランキング: 区分2つ×ポイント/今週・自分の行が分かる・locked のときサポートへの案内
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { load } = require(path.resolve(__dirname, '..', 'masmon-battle/load.js'));

const TOOLS_DIR = path.join(__dirname, '..');
const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8902;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/masmon-battle/beta');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const seed = () => {
  if (localStorage.getItem('mh_breeder_name') !== null) return;
  for (const [k, v] of [['mh_breeder_name', 'テスト'], ['mh_breeder_icon', 'Mocchi'], ['mh_onboarded', true], ['mh_tutorial_seen_v1', true],
    ['mh_battle_tutorial_seen_v1', true], ['mh_battle_tutorial_guide_shown_v1', true], ['mh_masu_migrated', true]]) localStorage.setItem(k, JSON.stringify(v));
};

// ---- 差し替えのサーバ ----
const { engine, catalog } = load();
const FOE = { owner: 'aoi-0001', name: 'あおい', assistant: 'kiki' };
const foeMembers = ['Golem', 'Eiki', 'Ghost'].map((sp, i) => ({ slot: i + 1, species: sp, name: `あおいの${i + 1}`, lv: 20, stats: { life: 300, pow: 280, wise: 260, hit: 270, eva: 250, tough: 260 } }));
const calls = { post: [], read: [] };
let registered = null, lockMode = false, selfId = '';
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const routeServer = async (page) => {
  await page.route(/\/functions\/v1\/masmon-pvp/, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': route.request().headers()['access-control-request-headers'] || '*' } });
    const b = JSON.parse(route.request().postData() || '{}');
    calls.post.push(b.action); selfId = b.owner || selfId;
    if (lockMode) return json(route, { ok: false, error: 'locked' }, 403);
    if (b.action === 'register') { registered = b; return json(route, { ok: true }); }
    if (b.action === 'challenge') {
      const teamA = { assistantId: b.assistant, tactics: registered.team.tactics, plan: registered.team.plan, swapPace: registered.team.swapPace, members: registered.team.members.slice(0, b.size) };
      const teamB = { assistantId: FOE.assistant, tactics: 30, members: foeMembers.slice(0, b.size) };
      const r = engine.simulate({ seed: 'pvp-test-1', catalog, teamA, teamB, balance: 'A' });
      const rated = b.size === 3;
      return json(route, { ok: true, match: { id: 77, division: b.division, size: b.size, rated, seed: 'pvp-test-1', version: engine.VERSION, teamA, teamB, balance: 'A', winner: r.winner, reason: r.reason, rounds: r.rounds, digest: r.digest,
        a: rated ? { delta: r.winner === 'A' ? 16 : -16, rating: r.winner === 'A' ? 1516 : 1484 } : null, b: null, remaining: 19 } });
    }
    return json(route, { ok: false, error: 'bad_request' }, 400);
  });
  await page.route(/\/rest\/v1\/(friend_links|breeder_profiles|masmon_pvp_[a-z]+)/, async (route) => {
    const u = decodeURIComponent(route.request().url());
    const t = /rest\/v1\/([a-z_]+)/.exec(u)[1];
    calls.read.push(t);
    const me = (/requester_id\.eq\.([\w-]+)/.exec(u) || [])[1] || selfId;
    if (t === 'friend_links') return json(route, [{ requester_id: me, target_id: FOE.owner, status: 'accepted', updated_at: '2026-11-10T00:00:00Z' }]);
    if (t === 'breeder_profiles') return json(route, [{ breeder_id: FOE.owner, user_name: FOE.name, icon: null, updated_at: '2026-11-11T00:00:00Z' }]);
    if (t === 'masmon_pvp_entries') return json(route, [{ owner_id: FOE.owner, assistant_id: FOE.assistant, user_name: FOE.name, icon: null, team: { members: foeMembers }, team_total: 4860, updated_at: '2026-11-11T00:00:00Z' }]);
    if (t === 'masmon_pvp_matches') return json(route, [{ id: 1 }]);
    if (t === 'masmon_pvp_ratings') return json(route, [
      { owner_id: FOE.owner, assistant_id: FOE.assistant, user_name: FOE.name, icon: null, rating: 1612, wins: 5, losses: 1, draws: 0 },
      { owner_id: me || 'self', assistant_id: 'mua', user_name: 'テスト', icon: null, rating: 1484, wins: 0, losses: 1, draws: 0 },
      { owner_id: 'riku-0001', assistant_id: 'dra', user_name: 'りく', icon: null, rating: 1430, wins: 1, losses: 4, draws: 0 }]);
    if (t === 'masmon_pvp_weekly') return json(route, [{ owner_id: FOE.owner, assistant_id: FOE.assistant, points: 48, wins: 3, losses: 0, draws: 0 }]);
    return json(route, []);
  });
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので実ブラウザでは確認できません'); process.exit(failed ? 1 : 0); }
  const server = process.env.SMOKE_URL ? null : spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
    // お話・お知らせは既読にして開く(まっさらなデータだと、お話が試作の上に重なる)
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await routeServer(page);
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((pattern) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `pvp-${name}.png`), fullPage: false }); };

    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 8; i++) {
      const closed = await clickText('受け取|閉じる|あとで|スキップ');
      await page.waitForTimeout(700);
      if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
    }
    // 助手のマスモンを用意する(この検査のブラウザの中だけ)
    await page.evaluate(async () => {
      await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
      const st = ASSISTANT_MASMON_STORE.state, w = { ...st.draw.welcomed };
      for (const [aid, rows] of Object.entries(st.draw.made)) { w[aid] = { ...(w[aid] || {}) }; for (const t of rows) w[aid][t.monster] = w[aid][t.monster] || '2026-11-01'; }
      // フレンド対戦だけを見るため、マスモンを持つ助手は1人(みゅあ)だけにする
      ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, welcomed: w, made: { mua: st.draw.made.mua } } });
      RELEASE_FLAGS.assistantMasmonBattleBeta = true; await AMBB_STORE.load();
      window.__mhSupabaseStubbed = ['masmon-pvp']; // 差し替えたサーバの関数へだけ書き込みを通す(本物へは届かない)
    });
    // ① 印 Pvp が偽: フレンドの欄もランキングの表も出ず、サーバを呼ばない
    await page.evaluate(() => assistantMasmonBattleOpen({ assistantId: 'mua', from: 'room' }));
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 }).catch(() => {});
    await clickSel('[data-ambb-rank-open]');
    await page.waitForTimeout(800);
    check('印が偽: フレンドの欄・本物のランキングが出ず、サーバを呼ばない', await page.evaluate(() => !document.querySelector('[data-ambb-src]') && !document.querySelector('[data-ambb-rank-live]')) && calls.post.length === 0 && !calls.read.some(t => /^masmon_pvp_/.test(t)), JSON.stringify(calls));
    await page.evaluate(() => AMBB_HOST.set(null));

    // ② 印が真
    await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonBattlePvp = true; });
    check('端末の中に相手がいなくても、入口は押せる(フレンド対戦がある)', await page.evaluate(() => assistantMasmonBattleRowInfo('mua').disabled === false));
    await page.evaluate(() => assistantMasmonBattleOpen({ assistantId: 'mua', from: 'room' }));
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-friend-opt]'), { timeout: 20000 }).catch(() => {});
    const prep = await page.evaluate(() => ({ src: document.querySelectorAll('[data-ambb-src]').length, friendOn: document.querySelector('[data-ambb-src="friend"]')?.classList.contains('on'), opts: [...document.querySelectorAll('[data-ambb-friend-opt]')].map(b => b.textContent), kinds: document.querySelectorAll('[data-ambb-kind]').length, text: document.querySelector('[data-ambb-friend]')?.textContent || '' }));
    check('じゅんび: この端末/フレンドの切り替え・相手がいないのでフレンドが選ばれている・フレンドの助手・区分2つ・残り回数', prep.src === 2 && prep.friendOn && prep.opts.length === 1 && /あおい/.test(prep.opts[0]) && prep.kinds === 2 && /今日あと 19 回/.test(prep.text), JSON.stringify(prep));
    await shot('1-friend');
    await clickSel('[data-ambb-challenge]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-watch]'), { timeout: 20000 }).catch(() => {});
    check('挑むと「登録 → 挑む」の順に呼び、観戦が始まる', calls.post.join(',') === 'register,challenge' && await page.evaluate(() => !!document.querySelector('[data-ambb-watch]')), calls.post.join(',') + ' ' + await page.evaluate(() => (document.querySelector('[data-ambb-friend]') || {}).textContent || '').then(t => t.slice(-60)));
    const reg = registered && registered.team;
    check('登録の1体は slot・species・name・lv・stats を持ち、熟練は覚えた技と guard・dist・swap だけ', !!reg && reg.members.length === 3 && reg.members.every(m => Number.isInteger(m.slot) && m.species && m.name && Number.isFinite(m.lv) && m.stats && Object.keys(m.mastery || {}).every(k => (m.techs || []).includes(k) || ['guard', 'dist', 'swap'].includes(k))), JSON.stringify(reg && reg.members[0]).slice(0, 200));
    await page.waitForFunction(() => !!document.querySelector('.ambw-dmg'), { timeout: 30000 }).catch(() => {});
    await clickSel('[data-ambb-pause]');
    await shot('2-watch');
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-pvp-result]'), { timeout: 20000 }).catch(() => {});
    const rv = await page.evaluate(() => ({ t: document.querySelector('[data-ambb-pvp-result]')?.textContent || '', head: document.querySelector('.ambw-res b')?.textContent || '' }));
    check('振り返り: ポイントの増減と段・残り回数・相手の名前', /(1516|1484) ポイント/.test(rv.t) && /今日あと 19 回/.test(rv.t) && (/あおい/.test(rv.head) || /みゅあ/.test(rv.head) || /引き分け/.test(rv.head)), JSON.stringify(rv));
    check('見返しがサーバの結果と合う(版がちがう、が出ない)', !/版がちがう/.test(rv.t));
    await shot('3-review');
    const rec = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1') || '{}'); return { rec: (s.rec || {}).mua || null, reg: (s.reg || {}).mua || null }; });
    check('この端末の戦績は増えない・登録の印は残る', !rec.rec && !!rec.reg, JSON.stringify(rec));
    // ④ ランキング
    await clickSel('[data-ambb-rank-open]');
    await page.waitForFunction(() => document.querySelectorAll('[data-ambb-rank-row]').length > 0, { timeout: 20000 }).catch(() => {});
    const rk = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-ambb-rank-row]').length, me: [...document.querySelectorAll('[data-ambb-rank-row]')].filter(r => r.style.background).length, kinds: document.querySelectorAll('[data-ambb-rank-kind]').length, text: document.querySelector('[data-ambb-rank]').textContent }));
    check('ランキング: 3行・自分の行に色・区分2つ・段', rk.rows === 3 && rk.me === 1 && rk.kinds === 2 && /💎|💠|🥇/.test(rk.text), JSON.stringify({ ...rk, text: rk.text.slice(0, 80) }));
    await shot('4-rank');
    await clickSel('[data-ambb-rank-period="week"]');
    await page.waitForTimeout(800);
    check('今週: 週の点の増減で並ぶ', await page.evaluate(() => /\+48/.test(document.querySelector('[data-ambb-rank]').textContent)) && calls.read.includes('masmon_pvp_weekly'));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll('.ambw-in *')].some(x => x.getBoundingClientRect().right > window.innerWidth + 1));
    check('横にはみ出さない', !wide);
    // locked: サポートへの案内
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-ambb-rank] button')].find(x => /もどる/.test(x.textContent)); b && b.click(); });
    await page.waitForTimeout(300);
    await clickSel('[data-ambb-close]');
    await page.waitForTimeout(800);
    lockMode = true;
    await clickSel('[data-ambb-register]');
    await page.waitForTimeout(1500);
    check('鍵が合わない(locked)とき、サポートへの案内が出る', await page.evaluate(() => /お問い合わせ\(サポート\)/.test(document.querySelector('[data-ambb-friend]')?.textContent || '')));
    await shot('5-locked');
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message || e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
  console.log(failed ? `\nNG: ${failed} 件` : '\nOK: 助手マスモンの対戦 β その2(フレンド対戦+ランキング)');
  process.exit(failed ? 1 : 0);
})();
