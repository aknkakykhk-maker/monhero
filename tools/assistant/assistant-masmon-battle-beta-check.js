// 助手マスモンの対戦 β(56-assistant-masmon-battle-beta.jsx)を、本物の画面で開いて確かめる。
//   node tools/assistant/assistant-masmon-battle-beta-check.js          検査(縦 390×844)
//   node tools/assistant/assistant-masmon-battle-beta-check.js --shots  止め絵も撮る(docs/progress/assistant-peer/masmon-battle/beta/beta-*.png)
// 見るもの:
//   ① 公開の印2つは偽・印が偽のあいだ口は何もしない・保存は新しいキーだけ・計算と育成の保存に書かない・ランキングへ送らない
//   ② デバッグ設定からの確かめ(印が偽)は開けて、何も保存しない
//   ③ 印を真にした画面: じゅんび(おまかせ/自分で決める・形・順番・作戦・交代)→ 観戦 → 振り返り(数字・関わって伸びた分・もしも)→ ランキング(準備中)
//   ④ 戦績は1戦に1回だけ・横にはみ出さない・絵が出ている・画面のエラーが無い
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const TOOLS_DIR = path.join(__dirname, '..');
const root = path.resolve(TOOLS_DIR, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const part = read('monster-hero/src/parts/56-assistant-masmon-battle-beta.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const flags = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const PORT = 8899;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/masmon-battle/beta');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

console.log('--- ① 作り ---');
check('公開の印 assistantMasmonBattleBeta・assistantMasmonBattlePvp がある(いまは偽)', /assistantMasmonBattleBeta: false/.test(flags) && /assistantMasmonBattlePvp: false/.test(flags));
const code = part.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const keys = [...code.matchAll(/'(mh_[a-z0-9_]+)'/g)].map(m => m[1]);
check('保存のキーは mh_assistant_masmon_battle_v1 だけ', keys.length > 0 && keys.every(k => k === 'mh_assistant_masmon_battle_v1'), keys.join(','));
check('育成・修行・マスモンの保存に書かない(set を呼ばない)', !/(AMG_STORE|AMGT_STORE|ASSISTANT_MASMON_STORE)\.set\(|amgSave\(|amgtSave\(/.test(code));
check('サーバ・ランキングへ送らない', !/supabase|fetch\(|masmonPvp/.test(code));
check('計算に手を入れていない', !/_internal/.test(code));
check('作戦は名前で渡す(team.plan・team.swapPace)・style の数値の上書きはしない', /plan: ambbPlanOf\(engine, plan\), swapPace: ambbSwapOf\(engine, swap\)/.test(code) && !/[{,]\s*style:/.test(code));
const engineSrc = read('monster-hero/data/assistant-masmon-battle.js');
check('画面の作戦の名前は、計算の表にあるものだけ', ['attack', 'guard', 'range', 'big'].every(k => new RegExp(`\\b${k}:\\s*Object\\.freeze`).test(engineSrc)) && ['early', 'late'].every(k => new RegExp(`\\b${k}:\\s*Object\\.freeze`).test(engineSrc)));
check('入れ物は 60-app に1つ・デバッグの入口は1つ', app.split('<AssistantMasmonBattleHost/>').length === 2 && app.split('data-debug-masmon-battle-beta').length === 2);
check('更新履歴・ヘルプにはまだ載せていない(公開前)', !/マスモンで対戦/.test(read('monster-hero/data/changelog.js')) && !/マスモンで対戦/.test(read('monster-hero/data/help.js')));

console.log('\n--- ② 実ブラウザ ---');
const seed = () => {
  if (localStorage.getItem('mh_breeder_name') !== null) return;
  for (const [k, v] of [['mh_breeder_name', 'テスト'], ['mh_breeder_icon', 'Mocchi'], ['mh_onboarded', true], ['mh_tutorial_seen_v1', true],
    ['mh_battle_tutorial_seen_v1', true], ['mh_battle_tutorial_guide_shown_v1', true], ['mh_masu_migrated', true]]) localStorage.setItem(k, JSON.stringify(v));
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
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((pattern) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `beta-${name}.png`), fullPage: false }); };

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
    // 助手のマスモンを用意する(この検査のブラウザの中だけ): 引き当てを作り、全員の控えを迎えた形にする
    const prepared = await page.evaluate(async () => {
      await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
      const st = ASSISTANT_MASMON_STORE.state, w = { ...st.draw.welcomed };
      for (const [aid, rows] of Object.entries(st.draw.made)) { w[aid] = { ...(w[aid] || {}) }; for (const t of rows) w[aid][t.monster] = w[aid][t.monster] || '2026-11-01'; }
      ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, welcomed: w } });
      return { holders: ambbAssistantsWithRows().length, rows: ambbRowsOf(ambbAssistantsWithRows()[0].id).length };
    });
    check('助手のマスモンを用意できた', prepared.holders >= 2 && prepared.rows >= 3, JSON.stringify(prepared));
    check('印が偽のあいだ、口は何もしない', await page.evaluate(() => assistantMasmonBattleRowInfo('mua') === null && assistantMasmonBattleOpen({ assistantId: 'mua', from: 'room' }) === false && !document.querySelector('[data-ambb-root]')));

    const snap = () => page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'mh_screen_trail_v1' && k !== 'mhdev_session_marker_v1').sort().map(k => [k, localStorage.getItem(k)]));
    const diffKeys = (a, b) => { const bm = new Map(a); return b.filter(([k, v]) => bm.get(k) !== v).map(([k]) => k).concat(a.filter(([k]) => !b.some(x => x[0] === k)).map(([k]) => k)); };
    // 確かめ(デバッグから・印は偽): 開けて、対戦まで進めても何も保存しない
    const before = await snap();
    await page.evaluate(() => assistantMasmonBattleOpen({ from: 'debug' }));
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 }).catch(() => {});
    check('デバッグからの確かめで、じゅんびの画面が出る', await page.evaluate(() => !!document.querySelector('[data-ambb-prep]')));
    await clickSel('[data-ambb-start]');
    await page.waitForTimeout(400);
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]'), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const ch0 = diffKeys(before, await snap());
    check('確かめでは保存(localStorage)が変わらない', ch0.length === 0, ch0.join(', '));
    await page.evaluate(() => AMBB_HOST.set(null));

    // 印を真にした画面
    await page.evaluate(async () => { RELEASE_FLAGS.assistantMasmonBattleBeta = true; await AMBB_STORE.load(); });
    const info = await page.evaluate(() => assistantMasmonBattleRowInfo(ambbAssistantsWithRows()[0].id));
    check('RowInfo が { label, sub, gain, disabled, why } を返す', info && info.label === '⚔ マスモンで対戦(β)' && info.disabled === false && Number.isFinite(info.gain), JSON.stringify(info));
    const aid = await page.evaluate(() => ambbAssistantsWithRows()[0].id);
    check('Open で開く', await page.evaluate((a) => assistantMasmonBattleOpen({ assistantId: a, from: 'room' }), aid));
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 }).catch(() => {});
    check('おまかせ: 3体が選ばれている', await page.evaluate(() => document.querySelectorAll('[data-ambb-prep] .ambb-mon.on').length === 3));
    await shot('1-prep-auto');
    await clickSel('[data-ambb-mode="self"]');
    await page.waitForTimeout(200);
    const self = await page.evaluate(() => ({ sizes: document.querySelectorAll('[data-ambb-size]').length, plans: document.querySelectorAll('[data-ambb-plan]').length, swaps: document.querySelectorAll('[data-ambb-swap]').length, mons: document.querySelectorAll('[data-ambb-mon]').length }));
    check('自分で決める: 形3つ・作戦5つ・交代3つ・マスモンが並ぶ', self.sizes === 3 && self.plans === 5 && self.swaps === 3 && self.mons >= 3, JSON.stringify(self));
    // 順番を選び直す: 全部外して、後ろの2体を逆順に
    await clickSel('[data-ambb-size="2"]');
    const ks = await page.evaluate(() => [...document.querySelectorAll('[data-ambb-mon]')].map(b => b.dataset.ambbMon));
    for (const k of await page.evaluate(() => [...document.querySelectorAll('[data-ambb-mon].on')].map(b => b.dataset.ambbMon))) await clickSel(`[data-ambb-mon="${k}"]`);
    await clickSel(`[data-ambb-mon="${ks[ks.length - 1]}"]`); await clickSel(`[data-ambb-mon="${ks[ks.length - 2]}"]`);
    await clickSel('[data-ambb-plan="attack"]'); await clickSel('[data-ambb-swap="early"]');
    await page.waitForTimeout(200);
    const order = await page.evaluate(() => [...document.querySelectorAll('[data-ambb-mon].on')].map(b => [b.dataset.ambbMon, b.querySelector('i').textContent]));
    const o1 = order.find(x => x[0] === ks[ks.length - 1]);
    check('押した順に1・2が付く(2 VS 2)', order.length === 2 && !!o1 && o1[1] === '1', JSON.stringify(order));
    await shot('2-prep-self');
    await clickSel('[data-ambb-start]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-watch]'), { timeout: 10000 }).catch(() => {});
    await page.waitForFunction(() => !!document.querySelector('.ambw-dmg'), { timeout: 30000 }).catch(() => {});
    await clickSel('[data-ambb-pause]');
    check('観戦が始まり、手前は2体', await page.evaluate(() => !!document.querySelector('[data-ambb-watch]') && document.querySelectorAll('[data-ambw-panel="A"] .ambw-bn').length === 1));
    await shot('3-watch');
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]') && !!document.querySelector('[data-ambb-if] .ambb-if'), { timeout: 30000 }).catch(() => {});
    const rv = await page.evaluate(() => ({
      gains: document.querySelectorAll('[data-ambb-gain] .ambb-gain').length, ifs: !!document.querySelector('[data-ambb-if] .ambb-if'), ask: !!document.querySelector('[data-ambb-ask]'),
      wide: document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll('.ambw-in *')].some(x => x.getBoundingClientRect().right > window.innerWidth + 1),
      noImg: [...document.querySelectorAll('.ambw img')].filter(i => i.complete && i.naturalWidth === 0).length,
    }));
    check('振り返り: 関わって伸びた分が2行・もしも・提案のボタン', rv.gains === 2 && rv.ifs && rv.ask, JSON.stringify(rv));
    check('横にはみ出さない・絵が出ている', !rv.wide && rv.noImg === 0, JSON.stringify(rv));
    await shot('4-review');
    await page.waitForTimeout(400);
    const saved = await page.evaluate((a) => { const s = JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1') || 'null'); return s && { rec: s.rec[a], last: s.last[a], mode: s.mode[a] }; }, aid);
    const n = saved && saved.rec ? saved.rec.w + saved.rec.l + saved.rec.d : 0;
    check('戦績が1つ増え、作戦と順番を覚える', n === 1 && saved.last.plan === 'attack' && saved.last.swap === 'early' && saved.last.size === 2 && saved.mode === 'self', JSON.stringify(saved));
    await clickSel('[data-ambb-ask]');
    await page.waitForTimeout(600);
    check('提案のシートが文を入れて開く', await page.evaluate(() => [...document.querySelectorAll('textarea,input')].some(x => /を鍛えて/.test(x.value))));
    await shot('5-ask');
    await clickText('^閉じる$|^とじる$|✕');
    await page.evaluate(() => { const ta = [...document.querySelectorAll('textarea')].find(x => /を鍛えて/.test(x.value)); if (ta) { const b = [...document.querySelectorAll('button')].find(x => /閉じる|とじる|もどる|✕|×/.test(x.textContent) && !x.closest('[data-ambb-review]')); b && b.click(); } });
    await page.waitForTimeout(400);
    await clickSel('[data-ambb-rank-open]');
    await page.waitForTimeout(300);
    check('ランキング: β中は準備中・段が5つ', await page.evaluate(() => /準備中/.test(document.querySelector('[data-ambb-rank]').textContent) && document.querySelectorAll('[data-ambb-rank] .ambb-tier').length === 5));
    await shot('6-rank');
    // 振り返りへ戻って、もう一度振り返りに来ても戦績は増えない
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-ambb-rank] button')].find(x => /もどる/.test(x.textContent)); b && b.click(); });
    await page.waitForTimeout(500);
    const n2 = await page.evaluate((a) => { const s = JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1')); return s.rec[a].w + s.rec[a].l + s.rec[a].d; }, aid);
    check('同じ1戦を二度数えない', n2 === 1, String(n2));
    await clickSel('[data-ambb-close]'); await page.waitForTimeout(200); await clickSel('[data-ambb-close]');
    await page.waitForTimeout(300);
    check('「もどる」で閉じる', await page.evaluate(() => !document.querySelector('[data-ambb-root]')));
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message || e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
  console.log(failed ? `\nNG: ${failed} 件` : '\nOK: 助手マスモンの対戦 β');
  process.exit(failed ? 1 : 0);
})();
