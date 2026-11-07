#!/usr/bin/env node
// クイック・AUTO設定・裏周回の案内(2026-11-07 社長。monster-hero/src/parts/56-quick-guide.jsx)を確かめる。
//   ① どの画面で・だれに・どの案内を出すか(quickGuidePick)。お話・おしゃべり・ほかの案内・演奏中・れんしゅう中は出さない
//   ② 一度きり(最後まで見たら出ない)・途中で「あとで」なら次に出る・誘導は1日1回・合計3回・クイックを一度クリアしたら出ない
//   ③ 台詞: 全ページに みゅあ の文がある・助手のページidに知らない物が無い・モンスターを「子」と呼ばない・口調の言葉
//   ④ 村の案内に1ページ足す(バトルのページのすぐあと)・れんしゅうの終わりの文を直した・ヘルプから見返せる・画面を切り替えない
//   ⑤ 実ブラウザ(縦 390×844・横 844×390): HOME の誘導 → バトルの選び方の案内(あとで → 読み込み直すとまた出る → OK で出ない)
//      → クイックの難易度えらびの案内 →「AUTO設定を見に行く」で AUTO設定 の案内。光らせた所が窓で隠れない
// 使い方: node tools/build.js のあと、:8899 でリポジトリを配信して node tools/assistant/quick-guide-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const guideSrc = read('monster-hero/src/parts/56-quick-guide.jsx');
const assistantsSrc = read('monster-hero/data/assistants.js');
const app = read('monster-hero/src/parts/60-app.jsx');
const help = read('monster-hero/data/help.js');

// ---- ① ② 決まりごと(画面の部品より前の、ふつうの JS の部分だけを動かす) ----
const pure = guideSrc.slice(0, guideSrc.indexOf('// 光らせる所。'));
const linesStart = assistantsSrc.indexOf('const ASSISTANT_QUICK_GUIDE_LINES = {');
const linesEnd = assistantsSrc.indexOf('\n};', linesStart);
check('台詞のまとまり ASSISTANT_QUICK_GUIDE_LINES がある', linesStart > 0 && linesEnd > linesStart);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc.slice(linesStart, linesEnd + 3)}\n${pure}\nthis.E = { ASSISTANT_QUICK_GUIDE_LINES, QUICK_GUIDE_IDS, QUICK_GUIDE_PAGES, QUICK_GUIDE_REPLAYS, QUICK_GUIDE_SEEN_KEY, QUICK_GUIDE_NUDGE_KEY, CARD_AUTO_INTRO_SEEN_KEY, quickGuideReplayPages, quickGuideLine, normalizeQuickGuideSeen, quickGuideSeenAfter, normalizeQuickNudge, quickNudgeAllowed, quickNudgeAfter, quickGuidePick };`, ctx);
const E = ctx.E;
check('保存は新しいキーだけ', E.QUICK_GUIDE_SEEN_KEY === 'mh_quick_guide_seen_v1' && E.QUICK_GUIDE_NUDGE_KEY === 'mh_quick_nudge_v1' && E.CARD_AUTO_INTRO_SEEN_KEY === 'mh_card_auto_intro_seen_v1');
const base = { busy: false, seen: [], quickUnlocked: true, quickEverCleared: false, nudgeOk: true };
const pick = (o) => E.quickGuidePick({ ...base, ...o });
check('バトルの選び方: クイックが開いた人に g1a', pick({ gameState: 'BATTLE_SYSTEM_SELECT' }) === 'g1a');
check('バトルの選び方: クイックがまだ開いていない人には出さない', pick({ gameState: 'BATTLE_SYSTEM_SELECT', quickUnlocked: false }) === null);
check('バトルの選び方: g1a を見たあとは誘導(クイック未クリア・今日まだ)', pick({ gameState: 'BATTLE_SYSTEM_SELECT', seen: ['g1a'] }) === 'nudgeBattle');
check('クイックの難易度えらびで g1b(チャレンジの難易度えらびでは出さない)', pick({ gameState: 'BATTLE_DIFFICULTY_SELECT', quickSelect: true }) === 'g1b' && pick({ gameState: 'BATTLE_DIFFICULTY_SELECT', quickSelect: false }) === null);
check('AUTO設定は全員に g2(クイックが開く前でも)', pick({ gameState: 'AUTO_SETTINGS', quickUnlocked: false }) === 'g2');
check('クイックで∞にしたバトルで g3a', pick({ gameState: 'BATTLE', quickRun: true, autoRepeat: true }) === 'g3a');
check('ふつうのバトルの1戦目は AUTO の案内', pick({ gameState: 'BATTLE', quickRun: false, autoRepeat: false }) === 'auto');
check('れんしゅう・台本のバトルでは出さない', pick({ gameState: 'BATTLE', battleTutorial: true }) === null);
check('裏周回のままの曲えらびで g3b・モードえらびで g3c(裏周回でなければ出さない)',
  pick({ gameState: 'RHYTHM_DEMO_HOME', backgroundRun: true }) === 'g3b' && pick({ gameState: 'RHYTHM_MODE_SELECT', backgroundRun: true }) === 'g3c'
  && pick({ gameState: 'RHYTHM_DEMO_HOME', backgroundRun: false }) === null && pick({ gameState: 'RHYTHM_MODE_SELECT', backgroundRun: false }) === null);
check('演奏中(RHYTHM_PLAY)・マルチの部屋(RHYTHM_MULTI)では出さない', pick({ gameState: 'RHYTHM_PLAY', backgroundRun: true }) === null && pick({ gameState: 'RHYTHM_MULTI', backgroundRun: true }) === null);
check('お話・おしゃべりなど(busy)のあいだはどこでも出さない', ['BATTLE_SYSTEM_SELECT', 'AUTO_SETTINGS', 'BATTLE', 'RHYTHM_DEMO_HOME', 'HOME'].every((g) => pick({ gameState: g, busy: true, backgroundRun: true, quickRun: true, autoRepeat: true }) === null));
check('保存の読み込み前(seen が null)は出さない', E.quickGuidePick({ ...base, gameState: 'AUTO_SETTINGS', seen: null }) === null);
check('一度見た案内は出さない', pick({ gameState: 'AUTO_SETTINGS', seen: ['g2'] }) === null && pick({ gameState: 'BATTLE', seen: ['auto'] }) === null);
check('HOME の誘導: クイックが開いて未クリアの人だけ', pick({ gameState: 'HOME' }) === 'nudgeHome' && pick({ gameState: 'HOME', quickEverCleared: true }) === null && pick({ gameState: 'HOME', quickUnlocked: false }) === null && pick({ gameState: 'HOME', nudgeOk: false }) === null);
const today = '2026-11-07';
let n = E.normalizeQuickNudge(null);
const shown = [];
for (const d of ['2026-11-07', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) {
  if (E.quickNudgeAllowed(n, d)) { n = E.quickNudgeAfter(n, d); shown.push(d); }
}
check('誘導は1日1回・合計3回まで', shown.join(',') === '2026-11-07,2026-11-08,2026-11-09', shown.join(','));
check('誘導の保存が壊れていても0回から', E.normalizeQuickNudge('x').n === 0 && E.normalizeQuickNudge({ n: -3, day: 5 }).n === 0 && E.quickNudgeAllowed({ n: 'a' }, today));
check('見た印の保存: 知らないid・壊れた値ははぶく', E.normalizeQuickGuideSeen({ seen: ['g1a', 'zz', 3] }).join() === 'g1a' && E.normalizeQuickGuideSeen('x').length === 0
  && JSON.stringify(E.quickGuideSeenAfter(['g1a'], 'g2')) === JSON.stringify({ v: 1, seen: ['g1a', 'g2'] }));
check('ヘルプから見返すまとまりは3つ(g1・g2・g3)', Object.keys(E.QUICK_GUIDE_REPLAYS).join() === 'g1,g2,g3' && E.quickGuideReplayPages('g3').length === 6);

// ---- ③ 台詞 ----
const L = E.ASSISTANT_QUICK_GUIDE_LINES;
const pageIds = [...new Set([...Object.values(E.QUICK_GUIDE_PAGES).flat().map((p) => p.id), 'tour.autoQuick', 'card.auto'])];
const ASSISTANT_IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
check('台詞の助手は8人(mua kiki momosuke dra atsu kyuko sorashido erubin)', ASSISTANT_IDS.every((id) => L[id] && typeof L[id] === 'object') && Object.keys(L).length === 8, Object.keys(L).join(' '));
const muaMissing = pageIds.filter((id) => !(L.mua[id] && L.mua[id].t));
check('全ページに みゅあ の文がある', muaMissing.length === 0, muaMissing.join(' '));
const unknown = ASSISTANT_IDS.flatMap((a) => Object.keys(L[a] || {}).filter((id) => !pageIds.includes(id)).map((id) => `${a}:${id}`));
check('助手のページidに知らない物が無い', unknown.length === 0, unknown.join(' '));
const EXPR = ['normal', 'happy', 'wink', 'excited', 'surprise', 'troubled', 'angry', 'crying'];
const badExpr = ASSISTANT_IDS.flatMap((a) => Object.entries(L[a] || {}).filter(([, v]) => !EXPR.includes(v.e) || typeof v.t !== 'string' || !v.t).map(([id]) => `${a}:${id}`));
check('表情は既存の名前・本文がある', badExpr.length === 0, badExpr.join(' '));
const allText = ASSISTANT_IDS.flatMap((a) => Object.entries(L[a] || {}).map(([id, v]) => ({ a, id, t: `${v.title || ''} ${v.t}` })));
const ko = allText.filter((x) => /[のなたい]子(?!供|ども)/.test(x.t));
check('モンスターを「子」と呼ばない', ko.length === 0, ko.map((x) => `${x.a}:${x.id}`).join(' '));
// 口調(docs/progress/assistant-peer/VOICE.md)。書いた助手だけ見る
const tone = {
  mua: (t) => !/じゃん|まじ(?!め)/.test(t),
  momosuke: (t) => !/(^|[^わ])私|あたし/.test(t),
  dra: (t) => !/ほんま|やで|とる(?![けか])|とんだ/.test(t),
  kiki: (t) => !/(だよ|だね|してよ)(?![う])/.test(t),
  atsu: (t) => /(笑|[！？!?…]|[)）]|ｗ|w)\s*$/.test(t.trim()),
};
const toneBad = allText.filter((x) => tone[x.a] && !tone[x.a](x.t.replace(/^.*? /, '')));
check('口調の言葉(みゅあ「ぢゃん・まぢ」/もも「私・あたし」なし/ドラ 関西弁なし/きき タメ口なし/あつ 文末)', toneBad.length === 0, toneBad.map((x) => `${x.a}:${x.id}`).join(' '));
const filled = ASSISTANT_IDS.filter((a) => pageIds.every((id) => L[a] && L[a][id]));
console.log(`   (台詞がそろっている助手: ${filled.join(' ') || 'なし'} / ほかはみゅあの文で出る)`);
check('台詞の無いページは みゅあ の文で出る', E.quickGuideLine('erubin', 'g2.4') && E.quickGuideLine('erubin', 'g2.4').t === (L.erubin['g2.4'] || L.mua['g2.4']).t && E.quickGuideLine('nobody', 'g1.1').t === L.mua['g1.1'].t);
check('数字の言い方(1.5倍・1日3回・WAVE2・4・6)を みゅあ の文と同じにする',
  ASSISTANT_IDS.every((a) => !L[a]['g1.1'] || /1\.5倍/.test(L[a]['g1.1'].t)) && ASSISTANT_IDS.every((a) => !L[a]['card.auto'] || /3回/.test(L[a]['card.auto'].t)) && ASSISTANT_IDS.every((a) => !L[a]['g2.3'] || /2・4・6/.test(L[a]['g2.3'].t)));

// ---- ④ つなぎ ----
const tourFn = assistantsSrc.slice(assistantsSrc.indexOf('const assistantTutorialWithAutoQuick'), assistantsSrc.indexOf('const assistantTutorialPages'));
const tctx = { ASSISTANT_QUICK_GUIDE_LINES: L };
vm.createContext(tctx);
vm.runInContext(`${tourFn}\nthis.f = assistantTutorialWithAutoQuick;`, tctx);
const tourIn = [{ spot: null }, { spot: 'battle', t: 'a' }, { spot: 'battle', t: 'b' }, { spot: 'market' }];
const tourOut = tctx.f(tourIn, 'kiki');
check('村の案内: 建物「バトル」の最後のページのすぐあとに1ページ足す', tourOut.length === 5 && tourOut[3].autoQuick === true && tourOut[3].spot === 'battle' && tourOut[4].spot === 'market' && tourOut[2].t === 'b');
check('村の案内: 台詞の無い助手はみゅあの文', tourOut[3].t === (L.kiki['tour.autoQuick'] || L.mua['tour.autoQuick']).t);
check('れんしゅうの終わり: 「いつでも選べる」を直した', !assistantsSrc.includes('いつでも選べるからね♪') && assistantsSrc.includes('チャレンジでクリアした難易度から、クイックでも遊べるようになるよ♪'));
check('ヘルプに「クイックのAUTO設定と裏周回」と見返すボタン', /id: 'quick-auto-guide'[^\n]*launch: 'quickGuides'/.test(help) && /topic\.launch==='quickGuides'/.test(app) && /setQuickGuideReplay\(id\)/.test(app) && /data-quick-guide-replay=\{id\}/.test(app));
check('ヘルプの「⏹ 終了」の場所を直した(曲えらびではなくモードえらびの左上)', !help.includes('曲えらびの左上の「⏹ 終了」') && help.includes('モードえらび(モンヒロビートの入口)の左上の「⏹ 終了」'));
check('案内は画面を切り替えない(setGameState を使わない。AUTO設定へは押したときだけ)', !/setGameState|openAutoSettings\(/.test(guideSrc) && /onClick=\{\(\) => \{ onDone\(true\); onGoAutoSettings\(\); \}\}/.test(guideSrc));
const busy = (app.match(/const quickGuideBusy = ([\s\S]*?);\n/) || [])[1] || '';
const needBusy = ['tutorialStep != null', 'battleTutorialStep != null', '!!eventReplay', 'assistantChatOpen', 'kikiIntroStep != null', 'momosukeIntroStep != null', '!!rhythmPlay', 'updateNoticeVisible', '!!loginBonusPopup', '!!dailyMasuAdvice', '!!peerReplay'];
const missingBusy = needBusy.filter((x) => !busy.includes(x));
check('割り込まない場面(お話・おしゃべり・ほかの案内・演奏中・れんしゅう中)を busy に入れている', missingBusy.length === 0, missingBusy.join(' '));
check('前の吹き出し(∞周回×モンヒロビート)は、案内の部品があるあいだ出さない', /quickRhythmIntroVisible = [^\n]*!quickGuideAvailable/.test(app) && /quickRhythmBackgroundVisible = [^\n]*!quickGuideAvailable/.test(app));
check('MFバトルカード: 🤖オートを選んだときだけ吹き出し(OKで二度と出さない)', /\{auto\.on && <CardAutoIntro\/>\}/.test(read('monster-hero/src/parts/87-card-deck-pick.jsx')) && /storeSet\(CARD_AUTO_INTRO_SEEN_KEY, true, false\)/.test(read('monster-hero/src/parts/87-card-deck-pick.jsx')));
check('光らせる目印が画面にある', ['data-auto-settings-section="policy"', 'data-auto-settings-section="ally"', 'data-auto-settings-section="quickRun"', 'data-auto-settings-section="breakthrough"', 'data-quick-reward-policy', 'data-battle-system-card={sys.id}', 'data-difficulty-carousel', 'aria-label="周回を続けたままモンヒロビートへ"'].every((m) => app.includes(m))
  && read('monster-hero/src/parts/71-screen-battle.jsx').includes('data-battle-auto-button') && read('monster-hero/src/parts/58-screen-rhythm.jsx').includes('data-quick-run-band') && read('monster-hero/src/parts/77-screen-rhythm-multi.jsx').includes('data-rhythm-back'));

// ---- ⑤ 実ブラウザ ----
const browser = async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { check('playwright を読み込める', false); return; }
  const http = require('http');
  const up = await new Promise((res) => { const r = http.get('http://localhost:8899/monster-hero/index.html', (x) => { x.resume(); res(x.statusCode === 200); }); r.on('error', () => res(false)); r.setTimeout(3000, () => { r.destroy(); res(false); }); });
  if (!up) { check('実ブラウザの確認(:8899 の配信が要る。node tools/run-checks.js から回すと立ち上がる)', false, 'localhost:8899 に届きません'); return; }
  const { quietBootSeed, updateNoticeSeed } = require('../boot/quiet-boot-seed');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const vp of [{ name: '縦', width: 390, height: 844 }, { name: '横', width: 844, height: 390 }]) {
    const page = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_clears_Beginner', 1);
      // 案内はまだ見ていない・誘導は0回(quiet-boot-seed は「無いときだけ」入れるので、先にこちらを入れる)
      put('mh_quick_guide_seen_v1', { v: 1, seen: [] }); put('mh_quick_nudge_v1', { v: 1, n: 0, day: '' });
      window.__mhSupabaseStubbed = true;
    });
    await page.addInitScript(quietBootSeed());
    // 助手の告知(更新履歴の assistantNotice)が残っていると、案内はそれが済むまで出ない決まり。ここでは見たことにする
    await page.addInitScript(updateNoticeSeed());
    await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: r.request().method() === 'GET' ? '[]' : '' }));
    const down = (sel) => page.evaluate((s) => { const el = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(s.text)); if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!el; }, sel);
    const boot = async () => {
      await page.goto('http://localhost:8899/monster-hero/index.html', { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
      await down({ text: 'TAP TO START' });
      await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 }).catch(() => {});
      await down({ aria: 'トップ画面へ進む' });
      await page.waitForTimeout(3500);
      // ログインボーナスなど、起動直後の窓を閉じる(案内の窓のボタンは押さない。案内はそれらが閉じるまで出ない決まり)
      for (let i = 0; i < 8; i++) {
        const hit = await page.evaluate(() => {
          const el = [...document.querySelectorAll('button')].find((x) => !x.closest('[data-quick-guide]') && /^(確認|受け取る|閉じる|スキップ|OK|とじる)$/.test(x.textContent.trim()));
          if (el) el.click();
          return !!el;
        });
        await page.waitForTimeout(700);
        if (!hit) break;
      }
      await page.waitForTimeout(800);
    };
    const guide = () => page.evaluate(() => { const g = document.querySelector('[data-quick-guide]'); return g ? { id: g.getAttribute('data-quick-guide'), page: g.getAttribute('data-quick-guide-page') } : null; });
    const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
    const store = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }, k);
    // 光らせた所と窓が重ならない
    const overlap = () => page.evaluate(() => {
      const s = document.querySelector('[data-quick-guide-spot]'), p = document.querySelector('[data-quick-guide-panel]');
      if (!s || !p) return null;
      const a = s.getBoundingClientRect(), c = p.getBoundingClientRect();
      const h = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)), w = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
      return { area: h * w, spot: Math.round(a.height * a.width) };
    });
    const T = `[${vp.name}] `;
    await boot();
    let g = await guide();
    check(`${T}HOME: クイックが開いて未クリアの人に誘導が出る`, g && g.id === 'nudgeHome', JSON.stringify(g));
    const nudge1 = await store('mh_quick_nudge_v1');
    check(`${T}誘導を出したときに1回と数える`, nudge1 && nudge1.n === 1 && /^\d{4}-\d{2}-\d{2}$/.test(nudge1.day), JSON.stringify(nudge1));
    await click('[data-quick-guide-next]');
    await page.waitForTimeout(400);
    check(`${T}OK で誘導が消える`, !(await guide()));
    await boot();
    check(`${T}同じ日に読み込み直しても誘導は出ない`, !(await guide()));
    await click('button[aria-label="モンヒロバトル"]');
    await page.waitForTimeout(1500);
    g = await guide();
    check(`${T}バトルの選び方: クイックの案内(g1a)が出て、クイックの札を光らせる`, g && g.id === 'g1a' && !!(await page.$('[data-quick-guide-spot]')), JSON.stringify(g));
    let ov = await overlap();
    check(`${T}g1a: 光らせた所が窓で隠れない`, ov && ov.area < ov.spot * 0.05, JSON.stringify(ov));
    if (vp.name === '縦' && process.env.QUICK_GUIDE_SHOT_DIR) await page.screenshot({ path: path.join(process.env.QUICK_GUIDE_SHOT_DIR, 'quick-guide-g1a.png') }).catch(() => {});
    // ページが1つなので「あとで」は無い。読み込み直して、閉じずに出ていった扱いを見る
    await boot();
    await click('button[aria-label="モンヒロバトル"]');
    await page.waitForTimeout(1500);
    g = await guide();
    check(`${T}OK を押す前に出ていったら、次に開いたときまた出る`, g && g.id === 'g1a', JSON.stringify(g));
    await click('[data-quick-guide-next]');
    await page.waitForTimeout(400);
    const seen1 = await store('mh_quick_guide_seen_v1');
    check(`${T}OK で見た印が付く`, seen1 && Array.isArray(seen1.seen) && seen1.seen.includes('g1a'), JSON.stringify(seen1));
    check(`${T}g1a のあとに同じ日の誘導は出ない`, !(await guide()));
    await click('[data-battle-system="systemQuick"]');
    await page.waitForTimeout(1500);
    g = await guide();
    check(`${T}クイックの難易度えらび: g1b が出る`, g && g.id === 'g1b' && g.page === 'g1.2', JSON.stringify(g));
    ov = await overlap();
    check(`${T}g1.2: 光らせた所が窓で隠れない`, ov && ov.area < ov.spot * 0.05, JSON.stringify(ov));
    await click('[data-quick-guide-next]'); await page.waitForTimeout(500);
    ov = await overlap();
    g = await guide();
    check(`${T}g1.3: 報酬方針を光らせ、窓で隠れない`, g && g.page === 'g1.3' && ov && ov.area < ov.spot * 0.05, JSON.stringify({ g, ov }));
    await click('[data-quick-guide-later]'); await page.waitForTimeout(400);
    check(`${T}「あとで」で消え、見た印は付かない`, !(await guide()) && !((await store('mh_quick_guide_seen_v1')).seen || []).includes('g1b'));
    // いったん出て、もう一度クイックの難易度えらびへ
    await boot();
    await click('button[aria-label="モンヒロバトル"]'); await page.waitForTimeout(1200);
    await click('[data-battle-system="systemQuick"]'); await page.waitForTimeout(1500);
    g = await guide();
    check(`${T}途中でやめた案内は、次に開いたとき最初から`, g && g.id === 'g1b' && g.page === 'g1.2', JSON.stringify(g));
    for (let i = 0; i < 3; i++) { await click('[data-quick-guide-next]'); await page.waitForTimeout(350); }
    g = await guide();
    check(`${T}最後のページに「AUTO設定を見に行く」`, g && g.page === 'g1.5' && !!(await page.$('[data-quick-guide-go-auto]')), JSON.stringify(g));
    await click('[data-quick-guide-go-auto]');
    await page.waitForTimeout(1500);
    g = await guide();
    const seen2 = await store('mh_quick_guide_seen_v1');
    check(`${T}押したときだけ AUTO設定へ移り、AUTO設定の案内(g2)が出る`, g && g.id === 'g2' && seen2.seen.includes('g1b'), JSON.stringify({ g, seen2 }));
    const g2Bad = [];
    for (let i = 0; i < 4; i++) {
      await click('[data-quick-guide-next]'); await page.waitForTimeout(700);
      const o = await overlap(); const gg = await guide();
      if (!o || o.area > o.spot * 0.05) g2Bad.push(`${gg && gg.page}:${JSON.stringify(o)}`);
      if (vp.name === '縦' && i === 2 && process.env.QUICK_GUIDE_SHOT_DIR) await page.screenshot({ path: path.join(process.env.QUICK_GUIDE_SHOT_DIR, 'quick-guide-g2-4.png') }).catch(() => {});
    }
    check(`${T}AUTO設定の各欄を光らせ、窓で隠れない`, g2Bad.length === 0, g2Bad.join(' / '));
    await click('[data-quick-guide-next]'); await page.waitForTimeout(400);
    check(`${T}AUTO設定の案内を最後まで見たら出ない`, !(await guide()) && (await store('mh_quick_guide_seen_v1')).seen.includes('g2'));
    check(`${T}画面のエラーが無い`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await page.close();
  }
  await b.close();
};

(async () => {
  try { await browser(); } catch (e) { check('実ブラウザの確認が最後まで動く', false, e.message); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
