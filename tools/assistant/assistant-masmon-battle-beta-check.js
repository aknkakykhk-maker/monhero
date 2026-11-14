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
check('公開の印 assistantMasmonBattleBeta・assistantMasmonBattlePvp がある', /assistantMasmonBattleBeta: (true|false)/.test(flags) && /assistantMasmonBattlePvp: (true|false)/.test(flags));
const code = part.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const keys = [...code.matchAll(/'(mh_[a-z0-9_]+)'/g)].map(m => m[1]);
const writes = [...code.matchAll(/storeSet\(\s*([A-Za-z_'"0-9]+)/g)].map(m => m[1]);
check('書く保存のキーは mh_assistant_masmon_battle_v1 だけ(ブリーダーの名前・アイコンは読むだけ)', writes.length > 0 && writes.every(k => k === 'ASSISTANT_MASMON_BATTLE_KEY') && keys.every(k => ['mh_assistant_masmon_battle_v1', 'mh_breeder_name', 'mh_breeder_icon'].includes(k)), writes.join(',') + ' / ' + keys.join(','));
check('育成・修行・マスモンの保存に書かない(set を呼ばない)', !/(AMG_STORE|AMGT_STORE|ASSISTANT_MASMON_STORE)\.set\(|amgSave\(|amgtSave\(/.test(code));
check('通信を直に書かない(サーバはタイセンの口だけ)', !/supabase|fetch\(/.test(code));
const pvpCalls = (t) => t.split(/masmonPvp(?:Register|Challenge|Friends|Ratings|Unregister)\(/).length - 1;
check('サーバの口を呼ぶのは、印 assistantMasmonBattlePvp の後ろ(フレンドの欄・ランキング)か、デバッグの「フレンド対戦を試す」だけ',
  /const ambbPvpOn = \(\) => ambbOn\(\) && [^\n]*assistantMasmonBattlePvp === true/.test(code) && /const pvp = \(ambbPvpOn\(\) && !preview\) \|\| \(!!tryPvp && /.test(code) && /const tryPvp = o\.from === 'debug' && o\.tryPvp === true/.test(code)
  && /const srcNow = pvp \?/.test(code) && /srcNow === 'friend' && <AmbbFriendPanel/.test(code) && /phase === 'rank' && pvp\)/.test(code)
  && pvpCalls(code) > 0 && pvpCalls(code) === pvpCalls(code.slice(code.indexOf('function AmbbFriendPanel'))));
check('計算に手を入れていない', !/_internal/.test(code));
check('作戦は名前で渡す(team.plan・team.swapPace)・style の数値の上書きはしない', /plan: ambbPlanOf\(engine, plan\), swapPace: ambbSwapOf\(engine, swap\)/.test(code) && !/[{,]\s*style:/.test(code));
const engineSrc = read('monster-hero/data/assistant-masmon-battle.js');
check('画面の作戦の名前は、計算の表にあるものだけ', ['attack', 'guard', 'range', 'big'].every(k => new RegExp(`\\b${k}:\\s*Object\\.freeze`).test(engineSrc)) && ['early', 'late'].every(k => new RegExp(`\\b${k}:\\s*Object\\.freeze`).test(engineSrc)));
check('入れ物は 60-app に1つ・デバッグの入口は1つ', app.split('<AssistantMasmonBattleHost/>').length === 2 && app.split('data-debug-masmon-battle-beta').length === 2);
const clog = read('monster-hero/data/changelog.js'), help = read('monster-hero/data/help.js');
check('公開の印が真なら、更新履歴とヘルプが同じ印で載っている(偽なら載せない)', /assistantMasmonBattleBeta: true/.test(flags)
  ? /releaseFlag:'assistantMasmonBattleBeta'/.test(clog) && /releaseFlag:'assistantMasmonBattleBeta', title:'⚔ マスモンで対戦\(β\)'/.test(help) && (!/assistantMasmonBattlePvp: true/.test(flags) || /releaseFlag:'assistantMasmonBattlePvp'/.test(help))
  : !/マスモンで対戦/.test(clog) && !/マスモンで対戦/.test(help));

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
      RELEASE_FLAGS.assistantMasmonBattleBeta = false; RELEASE_FLAGS.assistantMasmonBattlePvp = false; // 公開後も「印が偽のとき」から確かめる
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
    // iPhone の時計・電波の帯(2026-11-14 えるびんさん「もどるが押せない」): 上の帯は safe-area-inset-top の下に置く。
    //   ブラウザでは env() の値を変えられないので、CSS の env(safe-area-inset-top) を 47px に差し替えた見え方で、もどるが帯の下にあり押せるかを見る
    {
      const safe = await page.evaluate(() => {
        const css = [...document.querySelectorAll('style')].map(x => x.textContent).find(t => t.includes('.ambw-in{max-width:460px')) || '';
        const has = /\.ambw-in\{[^}]*padding:max\(10px,env\(safe-area-inset-top\)\)/.test(css);
        const st = document.createElement('style'); st.setAttribute('data-safe-sim', '');
        st.textContent = '.ambw-in{padding-top:max(10px,47px)!important}'; document.head.appendChild(st);
        const b = document.querySelector('[data-ambb-close]').getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { has, top: Math.round(b.top), ok: !!hit && !!hit.closest('[data-ambb-close]') };
      });
      check('上の帯は時計の帯(safe-area-inset-top)の下: 47px のつもりでも、もどるが帯の下にあって押せる', safe.has && safe.top >= 47 && safe.ok, JSON.stringify(safe));
      await shot('1-prep-safe-top');
      await page.evaluate(() => { const st = document.querySelector('[data-safe-sim]'); if (st) st.remove(); });
    }
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
    await page.waitForFunction(() => !!document.querySelector('.ambw-dmg, .msa-dmg'), { timeout: 30000 }).catch(() => {});
    await clickSel('[data-ambb-pause]');
    check('観戦が始まり、手前は2体', await page.evaluate(() => !!document.querySelector('[data-ambb-watch]') && document.querySelectorAll('[data-ambw-panel="A"] .ambw-bn').length === 1));
    await shot('3-watch');
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]') && !!document.querySelector('[data-ambb-if] .ambb-if'), { timeout: 30000 }).catch(() => {});
    // 決着の印(.msa-end b)は大きく出てから縮むアニメ(0.55秒)。動いている最中を測るとはみ出して見えるので、止まってから測る(ミハリ6 #5878)
    await page.waitForTimeout(700);
    const rv = await page.evaluate(() => ({
      gains: document.querySelectorAll('[data-ambb-gain] .ambb-gain').length, ifs: !!document.querySelector('[data-ambb-if] .ambb-if'), ask: !!document.querySelector('[data-ambb-ask]'),
      wide: document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll('.ambw-in *')].some(x => x.getBoundingClientRect().right > window.innerWidth + 1),
      noImg: [...document.querySelectorAll('.ambw img')].filter(i => i.complete && i.naturalWidth === 0).length,
      who: [...document.querySelectorAll('.ambw-in *')].filter(x => x.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map(x => `${x.tagName}.${String(x.className).slice(0, 30)}:${Math.round(x.getBoundingClientRect().right)}`),
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
    // 段2(バトル部 2026-11-13): 試合前の比べっこ・試合の設定(この端末の練習だけ)・観戦は場が画面いっぱい
    await page.evaluate((a) => assistantMasmonBattleOpen({ assistantId: a, from: 'room' }), aid);
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 }).catch(() => {});
    const cmp = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-ambb-compare] [data-ambb-cmp-row]').length, set: !!document.querySelector('[data-ambb-settings]'), crash: /画面の表示でエラーが起きました/.test(document.body.innerText) }));
    check('段2: 比べっこ(能力6・等級3・間合い4)と試合の設定が出る', cmp.rows === 13 && cmp.set && !cmp.crash, JSON.stringify(cmp));
    for (const sel of ['[data-ambb-set="team:ko"]', '[data-ambb-set="rounds:30"]', '[data-ambb-set="dist:3"]', '[data-ambb-set="guts:99"]', '[data-ambb-set="fx:lite"]']) await clickSel(sel);
    await page.waitForTimeout(200);
    const savedSet = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1')).set);
    check('段2: 設定はこの画面のキーに覚える', savedSet && savedSet.team === 'ko' && savedSet.rounds === 30 && savedSet.dist === 3 && savedSet.guts === 99 && savedSet.fx === 'lite', JSON.stringify(savedSet));
    await clickSel('[data-ambb-start]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-watch] [data-msa-stage]'), { timeout: 10000 }).catch(() => {});
    // 場が画面いっぱいに広がり終わるまで待つ(決まった時間では入場の重ねや描き直しの途中を測ることがあった・窓口 2026-11-14)。測る条件は下のまま
    await page.waitForFunction(() => { const st = document.querySelector('[data-msa-stage]'); const r = document.querySelector('[data-ambb-root]'); return !!(st && r && r.classList.contains('ambb-full') && st.getBoundingClientRect().height >= 380 && r.scrollHeight - r.clientHeight <= 0); }, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
    const full = await page.evaluate(() => { const st = document.querySelector('[data-msa-stage]').getBoundingClientRect(); const r = document.querySelector('[data-ambb-root]'); return { h: Math.round(st.height), scroll: r.scrollHeight - r.clientHeight, full: r.classList.contains('ambb-full') }; });
    check('段2: 観戦は場が画面いっぱい(縦にはみ出さない)', full.full && full.h >= 380 && full.scroll <= 0, JSON.stringify(full));
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]'), { timeout: 10000 }).catch(() => {});
    const rounds = await page.evaluate(() => Number((/(\d+) ラウンド/.exec(document.querySelector('.ambw-res').textContent) || [])[1]));
    check('段2: ラウンド上限が試合に効く(30 まで)', rounds >= 1 && rounds <= 30, String(rounds));
    await clickSel('[data-ambb-again]');
    await page.waitForTimeout(300);
    await clickSel('[data-ambb-set-reset]');
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1')).set);
    check('段2: 「いつもの決まりに戻す」(演出の量は残す)', back.team === 'team' && back.rounds === 150 && back.dist === 'auto' && back.guts === 50 && back.fx === 'lite', JSON.stringify(back));
    // 段3(バトル部 2026-11-13): 手動(自分の手番で選ぶ)・技の札は届く技だけ+全部の技の一覧・「結果へ」は残りをオートで
    // 技の札の一覧に何技も並ぶように、この検査のブラウザの中だけ(保存はしない)全部の技を覚えた形にして開き直す
    await page.evaluate(async () => {
      const eng = window.ASSISTANT_MASMON_BATTLE, cat = eng.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() });
      if (typeof AMGT_STORE.load === 'function') await AMGT_STORE.load();
      const st = AMGT_STORE.state;
      for (const a of ambbAssistantsWithRows()) for (const t of ambbRowsOf(a.id)) {
        const sp = cat.species[t.monster]; if (!sp) continue;
        st.mons[a.id] = st.mons[a.id] || {};
        const k = amgtKeyOf(t), cur = st.mons[a.id][k] || amgtInitMon(t.monster, 1, null);
        st.mons[a.id][k] = { ...cur, learn: sp.techs.map((x) => x.id) };
      }
      AMBB_HOST.set(null);
    });
    await page.waitForTimeout(200);
    await page.evaluate((a) => assistantMasmonBattleOpen({ assistantId: a, from: 'room' }), aid);
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 }).catch(() => {});
    await clickSel('[data-ambb-set="ctl:manual"]');
    await page.waitForTimeout(150);
    await clickSel('[data-ambb-start]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] [data-msxm="act"]'), { timeout: 30000 }).catch(() => {});
    // 帯が出た直後は札がまだ描き直しの途中(0枚)のことがある(main でも 1/5〜1/6 で落ちた)。帯と上の欄の札がそろうまで待ってから測る。測る条件は下のまま
    await page.waitForFunction(() => document.querySelectorAll('[data-msa-dc="manual"] [data-msa-dc-card]').length === 4 && document.querySelectorAll('[data-ambw-cards="B"] [data-msa-dc-card]').length === 4 && !!document.querySelector('[data-msa-dc="manual"] [data-msa-dc-card].now'), { timeout: 5000 }).catch(() => {});
    // 段3の作り直し(2026-11-13 社長): 技の札は間合いごとの4枚・押したら必ずその間合いの一覧(いちばん上が代表)・「☆ 代表にする」
    const man = await page.evaluate(() => {
      const cards = (sel) => [...document.querySelectorAll(`${sel} [data-msa-dc-card]`)];
      const bar = cards('[data-msa-dc="manual"]'), top = cards('[data-ambw-cards="B"]');
      const now = bar.filter((x) => x.classList.contains('now'));
      return { bar: !!document.querySelector('[data-ambb-manual]'), barCards: bar.length, topCards: top.length, now: now.length === 1 && /いま/.test(now[0].textContent),
        techBtns: document.querySelectorAll('[data-msxm-tech]').length, pos: Number(document.querySelector('[data-ambb-watch]').dataset.ambwPos) };
    });
    check('段3: 手動では自分の手番で帯が出る・技の札は間合いごとの4枚(帯も上の欄も)・いまの間合いの札に「いま」', man.bar && man.barCards === 4 && man.topCards === 4 && man.now && man.techBtns === 0, JSON.stringify(man));
    // いまの間合いの札を押すと一覧。代表でない技に「☆ 代表にする」→ 札の代表が変わり、保存の rep に入る
    const nowCard = '[data-msa-dc="manual"] [data-msa-dc-card].now';
    const hasNow = await page.evaluate((sel) => { const c = document.querySelector(sel); return !!(c && !c.disabled); }, nowCard);
    if (hasNow) {
      await clickSel(nowCard);
      await page.waitForTimeout(200);
      const sh = await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-msa-sheet] [data-msa-sheet-row]')]; return { rows: rows.length, topStar: rows[0] ? /★/.test(rows[0].textContent) : false, rep: (document.querySelector('[data-msa-sheet] [data-msa-rep]') || {}).dataset || null }; });
      check('段3: いまの間合いの札を押すと、その間合いの一覧(いちばん上が ★ 代表)', sh.rows > 0 && sh.topStar, JSON.stringify(sh));
      if (sh.rep && sh.rep.msaRep) {
        const id = sh.rep.msaRep;
        await clickSel(`[data-msa-sheet] [data-msa-rep="${id}"]`);
        await page.waitForTimeout(200);
        const after = await page.evaluate((x) => {
          const card = document.querySelector('[data-msa-dc="manual"] [data-msa-dc-card].now');
          const rows = [...document.querySelectorAll('[data-msa-sheet] [data-msa-sheet-row]')];
          const sv = JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1') || '{}').rep || {};
          const saved = Object.values(sv).some((m) => Object.values(m || {}).some((ids) => Array.isArray(ids) && ids.includes(x)));
          return { card: card ? card.dataset.msaDcRep : '', top: rows[0] ? rows[0].dataset.msaSheetRow : '', saved };
        }, id);
        check('段3: 「☆ 代表にする」で札と一覧のいちばん上が変わり、保存される(rep)', after.card === id && after.top === id && after.saved, JSON.stringify(after));
      }
    }
    // 一覧の技を押して使う(押せる技が無ければ一覧を閉じてガード)
    const picked = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[data-msa-sheet] [data-msxm-tech]')].find((x) => !x.disabled);
      if (t) { t.click(); return 'tech'; }
      const x = document.querySelector('[data-msa-sheet-close]'); if (x) x.click();
      const g = [...document.querySelectorAll('[data-msxm] .msxm-btn')].find((b) => !b.disabled); if (g) { g.click(); return 'etc'; }
      return '';
    });
    await page.waitForTimeout(1500);
    const pos2 = await page.evaluate(() => Number(document.querySelector('[data-ambb-watch]').dataset.ambwPos));
    check('段3: 一覧の技(か帯の手)を選ぶと試合が進み、一覧は閉じる', !!picked && pos2 > man.pos && !(await page.evaluate(() => !!document.querySelector('[data-ambb-manual] [data-msa-sheet]'))), `${picked} ${man.pos}→${pos2}`);
    // 相手の札: 押すと一覧(見るだけ・☆ なし)
    await page.evaluate(() => { const c = [...document.querySelectorAll('[data-ambw-cards="B"] [data-msa-dc-card]')].find((x) => !x.disabled); if (c) c.click(); });
    await page.waitForTimeout(300);
    const foeSheet = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-ambb-techlist="B"] [data-msa-sheet-row]').length, use: document.querySelectorAll('[data-ambb-techlist="B"] [data-msxm-tech]').length, star: document.querySelectorAll('[data-ambb-techlist="B"] [data-msa-rep]').length }));
    check('段3: 相手の札を押すと、その間合いの一覧(見るだけ・代表は決められない)', foeSheet.rows > 0 && foeSheet.use === 0 && foeSheet.star === 0, JSON.stringify(foeSheet));
    await page.evaluate(() => { const b = document.querySelector('[data-ambb-techlist] [data-msa-sheet-close]'); if (b) b.click(); });
    // 全部の技(帯のボタン)。相手の手を見せている間は帯が出ないので、帯が出るまで待つ
    //   試合の種は時刻から作るので、先に決着して振り返りになっていたら、手動の試合をやり直して帯を待つ(ミハリ6: 5回中2回落ちた)。
    //   帯が出ても相手の手を見せている間に描き直されて押せないことがある(ミハリ6: 6回中2回)ので、押して一覧が出たかを確かめ、出なければ帯を待って押し直す
    let allOpened = false;
    for (let k = 0; k < 12 && !allOpened; k++) {
      await page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] [data-msxm-all]') || !!document.querySelector('[data-ambb-manual] [data-msxm="enter"]') || !!document.querySelector('[data-ambb-review]'), { timeout: 30000 }).catch(() => {});
      // 自分の子が倒れたあとは「次に出すモンスター」の帯(全部の技のボタンは無い)。次の子を選んで進める
      if (await page.evaluate(() => { const b = [...document.querySelectorAll('[data-ambb-manual] [data-msxm="enter"] button')].find((x) => !x.disabled); if (b) { b.click(); return true; } return false; })) { await page.waitForTimeout(300); continue; }
      if (!(await page.evaluate(() => !!document.querySelector('[data-ambb-manual] [data-msxm-all]')))) {
        await clickSel('[data-ambb-again]'); await page.waitForTimeout(300);
        await clickSel('[data-ambb-start]');
        continue;
      }
      await page.waitForTimeout(250);   // 帯が出た直後の描き直しを待つ
      await clickSel('[data-ambb-manual] [data-msxm-all]');
      allOpened = await page.waitForFunction(() => document.querySelectorAll('[data-msa-sheet="all"] [data-msa-sheet-row]').length > 0, { timeout: 1500 }).then(() => true).catch(() => false);
    }
    check('段3: 帯の「全部の技」で全部の技の一覧が開く', await page.evaluate(() => document.querySelectorAll('[data-msa-sheet="all"] [data-msa-sheet-row]').length > 0));
    await page.evaluate(() => { const b = document.querySelector('[data-msa-sheet="all"] [data-msa-sheet-close]'); if (b) b.click(); });
    await clickSel('[data-ambb-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]'), { timeout: 15000 }).catch(() => {});
    check('段3: 「結果へ」で残りをオートで進めて振り返りへ', await page.evaluate(() => !!document.querySelector('[data-ambb-review] .ambw-res') && !/画面の表示でエラー/.test(document.body.innerText)));
    await clickSel('[data-ambb-again]');
    await page.waitForTimeout(300);
    // 準備画面の「🃏 技の札を決める」: 4枚の札 → 押すと一覧 →「☆ 代表にする」で保存
    await clickSel('[data-ambb-rep-open]');
    await page.waitForTimeout(200);
    const pc = await page.evaluate(() => document.querySelectorAll('[data-ambb-rep-edit] [data-msa-dc-card]').length);
    let prepSaved = null;
    for (let d = 0; d < 4 && !prepSaved; d++) {
      await page.evaluate((k) => { const c = document.querySelector(`[data-ambb-rep-edit] [data-msa-dc-card="${k}"]`); if (c && !c.disabled) c.click(); }, d);
      await page.waitForTimeout(150);
      const id = await page.evaluate(() => { const b = document.querySelector('[data-msa-sheet] [data-msa-rep]'); window.__repRows = Math.max(window.__repRows || 0, document.querySelectorAll('[data-msa-sheet] [data-msa-sheet-row]').length); if (!b) { const x = document.querySelector('[data-msa-sheet] [data-msa-sheet-close]'); if (x) x.click(); return ''; } b.click(); return b.dataset.msaRep; });
      await page.waitForTimeout(150);
      if (id) prepSaved = await page.evaluate((x) => ({ id: x, card: [...document.querySelectorAll('[data-ambb-rep-edit] [data-msa-dc-card]')].some((c) => c.dataset.msaDcRep === x),
        saved: Object.values(JSON.parse(localStorage.getItem('mh_assistant_masmon_battle_v1') || '{}').rep || {}).some((m) => Object.values(m || {}).some((ids) => Array.isArray(ids) && ids.includes(x))) }), id);
    }
    const repRows = await page.evaluate(() => window.__repRows || 0);
    check('段3: 準備画面の「技の札を決める」で4枚の札・一覧の「☆ 代表にする」で決めて保存', pc === 4 && !!prepSaved && prepSaved.card && prepSaved.saved, JSON.stringify({ pc, prepSaved, repRows }));
    await page.evaluate(() => { const x = document.querySelector('[data-msa-sheet] [data-msa-sheet-close]'); if (x) x.click(); });
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-ambb-rep-edit] button')].find((x) => /閉じる/.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(150);
    // 背の低い画面でも、場が手番の帯に重ならず技のボタンを押せる(ミハリ6 #5891)。幅320では下のボタンが切れない
    for (const [w, h] of [[375, 667], [320, 568]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(200);
      await clickSel('[data-ambb-start]');
      await page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] [data-msxm="act"]'), { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const lay = await page.evaluate(() => {
        const st = document.querySelector('[data-msa-stage]'), bar = document.querySelector('[data-ambb-manual]');
        if (!st || !bar) return { ok: false, why: 'なし' };
        const b = [...bar.querySelectorAll('[data-msa-dc-card]')].find((x) => !x.disabled) || [...bar.querySelectorAll('.msxm-btn')].find((x) => !x.disabled);
        if (b) b.scrollIntoView({ block: 'center' });
        const sr = st.getBoundingClientRect(), br = bar.getBoundingClientRect();
        const r = b ? b.getBoundingClientRect() : null;
        const hitEl = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        const skip = document.querySelector('[data-ambb-skip]'), kr = skip ? skip.getBoundingClientRect() : null;
        return { ok: true, stageBottom: Math.round(sr.bottom), barTop: Math.round(br.top), btnOwn: !!(hitEl && b && (hitEl === b || b.contains(hitEl))), skipIn: !kr || kr.right <= innerWidth + 1 };
      });
      check(`段3: ${w}×${h} で場が手番の帯に重ならず、技の札を押せる・「結果へ」が切れない`, lay.ok && lay.stageBottom <= lay.barTop + 1 && lay.btnOwn && lay.skipIn, JSON.stringify(lay));
      await clickSel('[data-ambb-skip]');
      await page.waitForFunction(() => !!document.querySelector('[data-ambb-review]'), { timeout: 15000 }).catch(() => {});
      await clickSel('[data-ambb-again]');
      await page.waitForTimeout(300);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await clickSel('[data-ambb-set="ctl:auto"]');
    await clickSel('[data-ambb-set="fx:full"]');
    await clickSel('[data-ambb-close]');
    await page.waitForTimeout(300);
    // 相手がいない(マスモンを持つ助手が1人だけ)ときは、練習相手を出さず案内だけ(社長 2026-11-11 B)
    const solo = await page.evaluate(async (a) => {
      const st = ASSISTANT_MASMON_STORE.state;
      ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, made: { [a]: st.draw.made[a] } } });
      const info = assistantMasmonBattleRowInfo(a);
      assistantMasmonBattleOpen({ assistantId: a, from: 'room' });
      await new Promise(r => setTimeout(r, 1500));
      const b = document.querySelector('[data-ambb-start]');
      return { info, disabled: !!(b && b.disabled), text: (document.querySelector('[data-ambb-prep]') || {}).textContent || '', practice: /練習/.test(document.body.innerText) };
    }, aid);
    check('相手がいないとき: 入口は押せず、案内だけ・練習相手は出ない', solo.info && solo.info.disabled === true && /ほかの助手がマスモンを迎えたら対戦できます/.test(solo.info.why) && solo.disabled && /ほかの助手がマスモンを迎えたら対戦できます/.test(solo.text) && !solo.practice, JSON.stringify({ ...solo, text: solo.text.slice(0, 60) }));
    await shot('7-no-foe');
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
