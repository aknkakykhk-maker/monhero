#!/usr/bin/env node
// 試合の画面(56-monhero-success-arena.jsx の MsaStage・MonsucArena)を確かめる。2026-11-12 バトル部
//   社長「音もないし音楽もホームの音楽だし味気なさすぎる。ちゃんとバトル部分作りこんで。命中も技打つ前の技コマンドに出してほしい」
//   node tools/battle/monsuc-arena-check.js
//   ① 場は1つの部品: モンサクの試合(MonsucArena)と助手マスモン対戦 β の観戦が、どちらも MsaStage を使う
//   ② 曲: 60-app の bgmKeyForState が「試合の画面の口」を見て BGMアレンジの「バトル」の曲を返す/画面を開くと口が立ち、閉じると下りる
//   ③ 効果音: 自分で数手打ってからオートで最後まで → 技(当たる・会心・はずれ・ガード)の音と、勝ち/負けの音が鳴る(Audio_.fgSe を数える)
//   ④ 技の名前の帯に命中%・帯の技ボタンに撃つ前の命中%
//   ⑤ 動きを減らす設定では、技の動き(SkillFxMotion)を出さない
//   ⑥ アクセント(社長「迫力とか見ごたえとか」): ふつうの設定では大技のため・数字の大きさ・KO の文字が出る/動きを減らす設定では、ため・閃光・会心の帯・土煙・とどめの光を出さない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };

// ①② 作り
const arena = fs.readFileSync(path.join(PARTS, '56-monhero-success-arena.jsx'), 'utf8');
const beta = fs.readFileSync(path.join(PARTS, '56-assistant-masmon-battle-beta.jsx'), 'utf8');
const app = fs.readFileSync(path.join(PARTS, '60-app.jsx'), 'utf8');
check('① MonsucArena と β の観戦が同じ場 MsaStage を使う', /<MsaStage /.test(arena.slice(arena.indexOf('function MonsucArena'))) && /<MsaStage /.test(beta));
check('② 60-app が試合の画面の口を見て、バトルの曲を返す', /useMhBattleBgmOverlay\(\)/.test(app) && /if \(battleBgmOverlay\) return bgmArrangement\.battle/.test(app) && /assistantLifeOpenNow, battleBgmOverlay\]\);/.test(app));

const PORT = 8984;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const open = async (browser, reducedMotion, width = 390, species = 'Mocchi', loy = null, seed = null) => {
  const page = await browser.newPage({ viewport: { width, height: width < 360 ? 700 : 844 }, reducedMotion });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof MonsucCupShow === 'function' && typeof MsaStage === 'function', null, { timeout: 60000 });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success-regulars.js' });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success.js' });
  await page.waitForTimeout(1000);
  await page.evaluate(([SPECIES, LOY, SEED]) => {
    // 効果音を数える(鳴らさない)
    window.__se = {};
    Object.keys(Audio_.fgSe).forEach((k) => { Audio_.fgSe[k] = () => { window.__se[k] = (window.__se[k] || 0) + 1; }; });
    window.__fx = 0;
    window.__acc = {};
    new MutationObserver(() => { if (document.querySelector('[data-skill-fx]')) window.__fx++; ['.msa-dim', '.msa-flash', '.msa-critcut', '.msa-dust', '.msa-fin', '.msa-burst', '[data-msa-tier]', '.msa-ko.big'].forEach((q) => { if (document.querySelector(q)) window.__acc[q] = (window.__acc[q] || 0) + 1; }); }).observe(document.body, { subtree: true, childList: true });
    const SUC = MONHERO_SUCCESS.create({ calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT, techs: ASSISTANT_MASMON_TECHS, monsters: ALL_PLAYER_MONSTERS, regulars: MONSUC_REGULARS, cupNames: MONSUC_REGULAR_CUPS });
    const s = JSON.parse(JSON.stringify(SUC.newRun({ id: 'arena-check', species: SPECIES, aid: 'mua', rivals: [{ name: 'こんこ', species: 'Kyubi', stats: { life: 455, pow: 472, wise: 180, hit: 341, eva: 260, tough: 498 } }] })));
    s.stats = { life: 412, pow: 506, wise: 233, hit: 380, eva: 198, tough: 441 }; s.turn = 24;
    if (LOY != null) { s.ama = 0; s.fear = LOY; }
    if (SEED) try { localStorage.setItem('mh_monsuc_arena_ctl_run_v1', JSON.stringify(SEED)); } catch (_) {}
    s.battle = { kind: 'cup', id: 'middle:4:spring:3', sys: 'spring', star: 3, rival: { name: 'こんこ' }, round: 0 };
    const d = document.createElement('div'); document.body.appendChild(d);
    window.__root = ReactDOM.createRoot(d);
    window.__root.render(React.createElement(MonsucCupShow, { suc: SUC, s, me: { name: 'もちまる' }, startAt: 'match', settle: () => ({}), onRematch() {}, onNext() {}, onClose() {} }));
  }, [species, loy, seed]);
  return { page, errs };
};

(async () => {
  const { chromium } = require('playwright');
  await new Promise((r) => server.listen(PORT, r));
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  try {
    // 段C(2026-11-14 社長): 技の札の技名が札からはみ出さない(幅390・320)。「前へ」は右向き・「後ろへ」は左向きで、ボタンも左に後ろへ・右に前へ
    for (const [w, sp] of [[390, 'Mocchi'], [320, 'Mocchi'], [390, 'Pandora'], [320, 'Pandora']]) {
      const { page } = await open(browser, 'no-preference', w, sp);
      await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
      await page.waitForTimeout(500);
      const ov = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('.msa-dc-c').forEach((c) => { const r = c.getBoundingClientRect(); c.querySelectorAll('*').forEach((x) => { const q = x.getBoundingClientRect(); if (q.width && (q.right > r.right + 0.5 || q.left < r.left - 0.5)) bad.push((x.textContent || '').slice(0, 14)); }); const t = c.querySelector('[data-msa-tn]'); if (t && t.scrollWidth > t.clientWidth + 1) bad.push(`scroll:${t.textContent.slice(0, 14)}`); });
        const sw = document.querySelector('.msa-ctlsw'); if (sw && sw.scrollWidth > sw.clientWidth + 1) bad.push('ctlsw');
        return bad;
      });
      if (process.argv.includes('--shots') && sp === 'Pandora') await page.screenshot({ path: path.join(ROOT, 'docs', 'progress', 'masmon-battle', 'stage-c', `monsuc-manual-${w}.png`) });
      check(`段C: 技の札・手動/オートの札から字がはみ出さない(幅${w}・${sp})`, ov.length === 0, JSON.stringify(ov));
      if (w === 390) {
        const mv = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msxm-move]')]; return b.map((x) => ({ step: Number(x.dataset.msxmMove), left: x.getBoundingClientRect().left, text: x.textContent.slice(0, 5) })); });
        const back = mv.find((x) => x.step > 0), fwd = mv.find((x) => x.step < 0);
        check('段C: 左に「◀ 後ろへ」・右に「前へ ▶」(矢印は画面の向き)', !!back && !!fwd && back.left < fwd.left && /^◀ 後ろへ/.test(back.text) && /^前へ ▶/.test(fwd.text), JSON.stringify(mv));
      }
      await page.close();
    }
    // 段C(2026-11-14 社長「マニュアルなのに勝手にオートになる」): 手動で1試合を最後まで自分で打つ。途中で一度もオートにならない(画面の印は最後まで manual・「オートにする」は押さない)
    {
      const { page } = await open(browser, 'reduce', 390, 'Mocchi');
      let modes = new Set(), mine = 0, guard = 0, ended = false;
      while (guard++ < 2500) {
        const st = await page.evaluate(() => ({ end: !!document.querySelector('[data-msc-end]'), act: !!document.querySelector('[data-msxm="act"]'), mode: (document.querySelector('[data-msc-match]') || {}).dataset ? document.querySelector('[data-msc-match]').dataset.msaMode : null }));
        if (st.mode) modes.add(st.mode);
        if (st.end) { ended = true; break; }
        if (st.act) {
          const did = await page.evaluate(() => {
            const c = document.querySelector('[data-msa-dc="manual"] [data-msa-dc-card].now:not([disabled])');
            if (c) { c.click(); const t = document.querySelector('[data-msa-sheet] [data-msxm-tech]:not([disabled])'); if (t) { t.click(); return 'tech'; } const x = document.querySelector('[data-msa-sheet-close]'); if (x) x.click(); }
            const b = [...document.querySelectorAll('.msxm-btn:not([disabled])')].find((y) => /ためる|ガード|前へ|後ろへ/.test(y.textContent)); if (b) { b.click(); return 'other'; }
            return null;
          });
          if (did) mine++;
        }
        await page.waitForTimeout(120);
      }
      check('段C: 手動で最後まで打っても、一度もオートにならない', ended && mine >= 3 && modes.size === 1 && modes.has('manual'), JSON.stringify({ modes: [...modes], mine, guard, ended }));
      await page.close();
    }
    // 段C(2026-11-14 社長): 意味不明な行動の番は「意味不明!」とはっきり見せる(大きな判子・実況の行)。手動のまま
    {
      const { page } = await open(browser, 'reduce', 390, 'Mocchi', 0);
      let seen = false, callSeen = false, guard = 0;
      while (guard++ < 2500 && !seen) {
        const st = await page.evaluate(() => ({ end: !!document.querySelector('[data-msc-end]'), act: !!document.querySelector('[data-msxm="act"]'), sulk: !!document.querySelector('[data-msa-sulk="A"]'), call: !!document.querySelector('[data-msa-call="sulk"]') }));
        if (st.sulk) { seen = true; callSeen = st.call; break; }
        if (st.end) break;
        if (st.act) await page.evaluate(() => { const b = [...document.querySelectorAll('.msxm-btn:not([disabled])')].find((y) => /ためる/.test(y.textContent)); if (b) b.click(); });
        await page.waitForTimeout(80);
      }
      const bandOk = seen ? await page.evaluate(() => /意味不明/.test(document.querySelector('[data-msa-sulk]').textContent)) : false;
      check('段C: 意味不明な行動の番に「意味不明!」の判子が出る(手動のまま)', seen && bandOk, JSON.stringify({ seen, bandOk, callSeen, guard }));
      await page.close();
    }
    // 段C(2026-11-14 社長): 手動/オートの記憶は、その育成の中だけ。新しい育成は手動から。別の育成で選んだオートは引き継がない。前のキー(mh_monsuc_arena_ctl_v1)は読まない
    {
      const { page } = await open(browser, 'reduce', 390, 'Mocchi', null, { id: 'other-run', ctl: 'auto' });
      await page.evaluate(() => { try { localStorage.setItem('mh_monsuc_arena_ctl_v1', 'auto'); } catch (_) {} });
      await page.waitForFunction(() => document.querySelector('[data-msc-match]'), null, { timeout: 30000 });
      const m1 = await page.evaluate(() => document.querySelector('[data-msc-match]').dataset.msaMode);
      check('段C: 新しい育成の最初の試合は手動(別の育成のオートも前のキーも引き継がない)', m1 === 'manual', m1);
      await page.close();
      const { page: p2 } = await open(browser, 'reduce', 390, 'Mocchi', null, { id: 'arena-check', ctl: 'auto' });
      await p2.waitForFunction(() => document.querySelector('[data-msc-match]'), null, { timeout: 30000 });
      const m2 = await p2.evaluate(() => document.querySelector('[data-msc-match]').dataset.msaMode);
      check('段C: 同じ育成で選んだオートは、その育成の次の試合でも続く', m2 === 'auto', m2);
      await p2.close();
    }
    // ②〜④ ふつうの動き
    {
      const { page, errs } = await open(browser, 'no-preference');
      await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
      check('② 試合の画面を開くと、バトルの曲の口が立つ', await page.evaluate(() => MH_BATTLE_BGM.on === true));
      // 技の札は間合いごとの4枚(2026-11-13 社長)。札に命中%・ガッツ、押すと一覧(撃つ前の命中%・ガッツ・届く距離)
      const pShown = await page.evaluate(async () => {
        const cards = [...document.querySelectorAll('[data-msa-dc="manual"] [data-msa-dc-card]')];
        const cardOk = cards.length === 4 && cards.filter((c) => !c.disabled).every((c) => /命中 \d+%/.test(c.textContent) && /ガッツ \d+/.test(c.textContent));
        const now = cards.find((c) => c.classList.contains('now') && !c.disabled);
        if (!now) return cardOk;
        now.click(); await new Promise((r) => setTimeout(r, 150));
        const rows = [...document.querySelectorAll('[data-msa-sheet] [data-msxm-tech]')];
        const ok = cardOk && rows.length > 0 && rows.every((b) => /命中 \d+%/.test(b.textContent) && /ガッツ \d+/.test(b.textContent) && /届く/.test(b.textContent));
        const x = document.querySelector('[data-msa-sheet-close]'); if (x) x.click();
        return ok;
      });
      check('④ 技の札(4枚)と、押して開く一覧に撃つ前の命中%・ガッツ・届く距離', pShown);
      // 自分で3手(届く技があれば技・無ければ前へ)
      let cutP = false;
      for (let k = 0; k < 3; k++) {
        await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
        await page.evaluate(() => { const c = document.querySelector('[data-msa-dc="manual"] [data-msa-dc-card].now:not([disabled])'); if (c) c.click(); });
        await page.waitForTimeout(150);
        await page.evaluate(() => { const t = document.querySelector('[data-msxm-tech]:not([disabled])'); if (!t) { const x = document.querySelector('[data-msa-sheet-close]'); if (x) x.click(); } const f = [...document.querySelectorAll('.msxm-btn:not([disabled])')].find((x) => /前へ/.test(x.textContent)); (t || f || document.querySelector('.msxm-btn:not([disabled])')).click(); });
        for (let w = 0; w < 30 && !cutP; w++) { await page.waitForTimeout(100); cutP = await page.evaluate(() => { const c = document.querySelector('[data-msa-cut]'); return !!c && /命中 \d+%/.test(c.textContent); }); }
      }
      check('④ 技の名前の帯に命中%', cutP);
      await page.waitForFunction(() => document.querySelector('.msxm-auto'), null, { timeout: 30000 });
      await page.evaluate(() => { const a = document.querySelector('.msxm-auto'); if (a) a.click(); });
      // 段C(2026-11-14): オートでも、自分の側の技の札4枚・⏸・見せ場だけ・実況が付く(助手マスモン対戦と同じ操作)
      await page.waitForTimeout(700);
      const SHOT_DIR = path.join(ROOT, 'docs', 'progress', 'masmon-battle', 'stage-c');
      if (process.argv.includes('--shots')) await page.screenshot({ path: path.join(SHOT_DIR, 'monsuc-auto.png') });
      const stc = await page.evaluate(async () => {
        const cards = document.querySelectorAll('[data-msa-cards] [data-msa-dc-card]').length;
        const pause = document.querySelector('[data-msc-pause]'), hl = document.querySelector('[data-msc-hl]');
        if (!pause || !hl) return { cards, pause: !!pause, hl: !!hl };
        const posOf = () => Number(document.querySelector('[data-msc-match]').dataset.msaPos);
        pause.click(); await new Promise((r) => setTimeout(r, 200));
        const p0 = posOf(); await new Promise((r) => setTimeout(r, 2500)); const p1 = posOf();
        pause.click();
        return { cards, pause: true, hl: true, held: p0 === p1 };
      });
      check('段C: オートで、技の札4枚・⏸(押すと止まる)・★見せ場が出る', stc.cards === 4 && stc.pause && stc.hl && stc.held === true, JSON.stringify(stc));
      await page.evaluate(() => { const b = [...document.querySelectorAll('.msa-tools button')].find((x) => x.textContent === '×4'); if (b) b.click(); });
      await page.waitForFunction(() => document.querySelector('[data-msc-end]'), null, { timeout: 180000 }).catch(() => {});
      await page.waitForTimeout(600);
      const se = await page.evaluate(() => window.__se);
      const hitSe = (se.attack || 0) + (se.enemyAttack || 0) + (se.crit || 0) + (se.guard || 0) + (se.trainingMove || 0);
      check('③ 技の音(当たる・会心・ガード・はずれ)が鳴る', hitSe >= 3 && ((se.attack || 0) + (se.enemyAttack || 0) + (se.crit || 0)) > 0, JSON.stringify(se));
      check('③ 決着で勝ち/負けの音が1回', ((se.victory || 0) + (se.trainingFail || 0)) === 1, `${se.victory || 0}/${se.trainingFail || 0}`);
      check('⑤(対照) ふつうの設定では技の動きが出る', await page.evaluate(() => window.__fx > 0));
      const acc = await page.evaluate(() => window.__acc);
      check('⑥ ふつうの設定では、数字の大きさ・KO の文字・土煙が出る', acc['[data-msa-tier]'] > 0 && acc['.msa-ko.big'] > 0 && acc['.msa-dust'] > 0, JSON.stringify(acc));
      await page.evaluate(() => window.__root.unmount());
      check('② 閉じると、バトルの曲の口が下りる', await page.evaluate(() => MH_BATTLE_BGM.on === false && MH_BATTLE_BGM.n === 0));
      check('実行時エラーなし(ふつう)', errs.length === 0, errs.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑤ 動きを減らす
    {
      const { page, errs } = await open(browser, 'reduce');
      await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
      await page.evaluate(() => { const a = document.querySelector('.msxm-auto'); if (a) a.click(); });
      await page.waitForFunction(() => document.querySelector('[data-msc-end]'), null, { timeout: 180000 }).catch(() => {});
      check('⑤ 動きを減らす設定では、技の動き(SkillFxMotion)を出さない', await page.evaluate(() => window.__fx === 0 && !!document.querySelector('[data-msc-end]')));
      check('⑤ 動きを減らしても効果音は鳴る(音の設定は別)', await page.evaluate(() => Object.keys(window.__se).length > 0));
      const acc = await page.evaluate(() => window.__acc);
      check('⑥ 動きを減らす設定では、ため・閃光・会心の帯・土煙・とどめの光・KO の放射を出さない', !['.msa-dim', '.msa-flash', '.msa-critcut', '.msa-dust', '.msa-fin', '.msa-burst'].some((q) => acc[q]), JSON.stringify(acc));
      check('実行時エラーなし(動きを減らす)', errs.length === 0, errs.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
  process.exit(ng ? 1 : 0);
})();
