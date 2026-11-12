#!/usr/bin/env node
// 試合の画面(56-monhero-success-arena.jsx の MsaStage・MonsucArena)を確かめる。2026-11-12 バトル部
//   社長「音もないし音楽もホームの音楽だし味気なさすぎる。ちゃんとバトル部分作りこんで。命中も技打つ前の技コマンドに出してほしい」
//   node tools/battle/monsuc-arena-check.js
//   ① 場は1つの部品: モンサクの試合(MonsucArena)と助手マスモン対戦 β の観戦が、どちらも MsaStage を使う
//   ② 曲: 60-app の bgmKeyForState が「試合の画面の口」を見て BGMアレンジの「バトル」の曲を返す/画面を開くと口が立ち、閉じると下りる
//   ③ 効果音: 自分で数手打ってからオートで最後まで → 技(当たる・会心・はずれ・ガード)の音と、勝ち/負けの音が鳴る(Audio_.fgSe を数える)
//   ④ 技の名前の帯に命中%・帯の技ボタンに撃つ前の命中%
//   ⑤ 動きを減らす設定では、技の動き(SkillFxMotion)を出さない
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

const open = async (browser, reducedMotion) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof MonsucCupShow === 'function' && typeof MsaStage === 'function', null, { timeout: 60000 });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success-regulars.js' });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success.js' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    // 効果音を数える(鳴らさない)
    window.__se = {};
    Object.keys(Audio_.fgSe).forEach((k) => { Audio_.fgSe[k] = () => { window.__se[k] = (window.__se[k] || 0) + 1; }; });
    window.__fx = 0;
    new MutationObserver(() => { if (document.querySelector('[data-skill-fx]')) window.__fx++; }).observe(document.body, { subtree: true, childList: true });
    const SUC = MONHERO_SUCCESS.create({ calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT, techs: ASSISTANT_MASMON_TECHS, monsters: ALL_PLAYER_MONSTERS, regulars: MONSUC_REGULARS, cupNames: MONSUC_REGULAR_CUPS });
    const s = JSON.parse(JSON.stringify(SUC.newRun({ id: 'arena-check', species: 'Mocchi', aid: 'mua', rivals: [{ name: 'こんこ', species: 'Kyubi', stats: { life: 455, pow: 472, wise: 180, hit: 341, eva: 260, tough: 498 } }] })));
    s.stats = { life: 412, pow: 506, wise: 233, hit: 380, eva: 198, tough: 441 }; s.turn = 24;
    s.battle = { kind: 'cup', id: 'middle:4:spring:3', sys: 'spring', star: 3, rival: { name: 'こんこ' }, round: 0 };
    const d = document.createElement('div'); document.body.appendChild(d);
    window.__root = ReactDOM.createRoot(d);
    window.__root.render(React.createElement(MonsucCupShow, { suc: SUC, s, me: { name: 'もちまる' }, startAt: 'match', settle: () => ({}), onRematch() {}, onNext() {}, onClose() {} }));
  });
  return { page, errs };
};

(async () => {
  const { chromium } = require('playwright');
  await new Promise((r) => server.listen(PORT, r));
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  try {
    // ②〜④ ふつうの動き
    {
      const { page, errs } = await open(browser, 'no-preference');
      await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
      check('② 試合の画面を開くと、バトルの曲の口が立つ', await page.evaluate(() => MH_BATTLE_BGM.on === true));
      const pShown = await page.evaluate(() => [...document.querySelectorAll('[data-msxm-tech]')].every((b) => /命中 \d+%/.test(b.textContent) && /ガッツ \d+/.test(b.textContent) && /届く/.test(b.textContent)));
      check('④ 帯の技ボタンに撃つ前の命中%・ガッツ・届く距離', pShown);
      // 自分で3手(届く技があれば技・無ければ前へ)
      let cutP = false;
      for (let k = 0; k < 3; k++) {
        await page.waitForFunction(() => document.querySelector('[data-msxm="act"]'), null, { timeout: 30000 });
        await page.evaluate(() => { const t = document.querySelector('[data-msxm-tech]:not([disabled])'); const f = [...document.querySelectorAll('.msxm-btn:not([disabled])')].find((x) => /前へ/.test(x.textContent)); (t || f || document.querySelector('.msxm-btn:not([disabled])')).click(); });
        for (let w = 0; w < 30 && !cutP; w++) { await page.waitForTimeout(100); cutP = await page.evaluate(() => { const c = document.querySelector('[data-msa-cut]'); return !!c && /命中 \d+%/.test(c.textContent); }); }
      }
      check('④ 技の名前の帯に命中%', cutP);
      await page.waitForFunction(() => document.querySelector('.msxm-auto'), null, { timeout: 30000 });
      await page.evaluate(() => { const a = document.querySelector('.msxm-auto'); if (a) a.click(); });
      await page.evaluate(() => { const b = [...document.querySelectorAll('.msa-tools button')].find((x) => x.textContent === '×4'); if (b) b.click(); });
      await page.waitForFunction(() => document.querySelector('[data-msc-end]'), null, { timeout: 180000 }).catch(() => {});
      await page.waitForTimeout(600);
      const se = await page.evaluate(() => window.__se);
      const hitSe = (se.attack || 0) + (se.enemyAttack || 0) + (se.crit || 0) + (se.guard || 0) + (se.trainingMove || 0);
      check('③ 技の音(当たる・会心・ガード・はずれ)が鳴る', hitSe >= 3 && ((se.attack || 0) + (se.enemyAttack || 0) + (se.crit || 0)) > 0, JSON.stringify(se));
      check('③ 決着で勝ち/負けの音が1回', ((se.victory || 0) + (se.trainingFail || 0)) === 1, `${se.victory || 0}/${se.trainingFail || 0}`);
      check('⑤(対照) ふつうの設定では技の動きが出る', await page.evaluate(() => window.__fx > 0));
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
      check('実行時エラーなし(動きを減らす)', errs.length === 0, errs.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
  process.exit(ng ? 1 : 0);
})();
