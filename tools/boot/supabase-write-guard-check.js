#!/usr/bin/env node
// 検査のブラウザ(自動操作)から、本物の Supabase へ書き込まない守り(26-supabase.jsx の sbAutomationWriteBlocked)を確かめる。
// 2026-10-27 カード部: HOME から MFバトルカードを遊ぶ検査の多くは Supabase を差し替えていない。本体の守りが頼り。
//
//   node tools/boot/supabase-write-guard-check.js
//
//   ① 自動操作(navigator.webdriver が true)なら、表への書き込み(POST・PATCH・DELETE)は止める。読む(GET)は通す
//   ② 集計を読む rpc(rhythm_week_score_totals など)は通す。表へ書く rpc(マルチの強さの点数 card_battle_pvp_report)は止める
//   ③ 差し替えた検査(window.__mhSupabaseStubbed = true)は全部通す。表の名前を並べたときは、並べた表・rpc だけ通す
//   ④ ふつうに遊ぶ人のブラウザ(webdriver が false)は何も止めない(本番の送信を止めない)
//   ⑤ 実際の Chromium(Playwright)で開くと webdriver が true になり、ランキングの表・強さの点数への書き込みが外へ出ない
//      (念のため、外へ出ようとした書き込みはこの検査が受け止めて捨てる。本物へは何も届かない)
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const body = (src.match(/const SB_WRITE_RPCS = [\s\S]*?\nconst sbAutomationWriteBlocked = [\s\S]*?\n};\n/) || [''])[0];
check('守りの関数が 26-supabase.jsx にある', !!body);
const URL0 = 'https://example.supabase.co';
const blocked = (webdriver, stubbed, url, method) => {
  const ctx = vm.createContext({ SUPABASE_URL: URL0, navigator: { webdriver }, window: { __mhSupabaseStubbed: stubbed }, String, Array, Object });
  vm.runInContext(`${body}\nthis.f = sbAutomationWriteBlocked;`, ctx);
  return ctx.f(url, method);
};
const T = (p) => `${URL0}/rest/v1/${p}`;
check('① 自動操作: ランキングの表への書き込みを止める', blocked(true, undefined, T('card_battle_ranks_v2?on_conflict=breeder_id'), 'POST') && blocked(true, undefined, T('card_battle_ranks?on_conflict=user_name'), 'POST'));
check('① 自動操作: 読む(GET・HEAD)は通す', !blocked(true, undefined, T('card_battle_ranks_v2?select=*'), 'GET') && !blocked(true, undefined, T('card_battle_ranks_v2'), 'HEAD'));
check('① 自動操作: PATCH・DELETE も止める', blocked(true, undefined, T('breeder_profiles?id=eq.1'), 'PATCH') && blocked(true, undefined, T('breeder_profiles?id=eq.1'), 'DELETE'));
check('② 集計を読む rpc は通す', !blocked(true, undefined, T('rpc/rhythm_week_score_totals?select=x'), 'POST') && !blocked(true, undefined, T('rpc/rhythm_event_totals'), 'POST'));
check('② 表へ書く rpc(マルチの強さの点数)は止める', blocked(true, undefined, T('rpc/card_battle_pvp_report'), 'POST'));
check('③ 差し替えた検査(true)は全部通す', !blocked(true, true, T('card_battle_ranks_v2'), 'POST') && !blocked(true, true, T('rpc/card_battle_pvp_report'), 'POST'));
check('③ 表の名前を並べたときは、並べた物だけ通す', !blocked(true, ['card_battle_ranks'], T('card_battle_ranks_v2'), 'POST') && blocked(true, ['card_battle_ranks'], T('breeder_profiles'), 'POST')
  && !blocked(true, ['card_battle_pvp_report'], T('rpc/card_battle_pvp_report'), 'POST') && blocked(true, ['bond_levels'], T('rpc/card_battle_pvp_report'), 'POST'));
check('④ ふつうのブラウザ(webdriver が false)は何も止めない', !blocked(false, undefined, T('card_battle_ranks_v2'), 'POST') && !blocked(false, undefined, T('rpc/card_battle_pvp_report'), 'POST') && !blocked(undefined, undefined, T('rankings'), 'POST'));
check('④ Supabase 以外への送信は止めない', !blocked(true, undefined, 'https://example.com/api', 'POST'));

// ⑤ 実際の Chromium
(async () => {
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { playwright = null; } }
  if (!playwright) { console.log('SKIP: ⑤ playwright が入っていない'); console.log(failed ? `\n${failed}件 NG` : '\nすべてOK'); process.exit(failed ? 1 : 0); }
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
  const PORT = Number(process.env.GUARD_PORT) || 8953;
  const server = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(''); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    s.listen(PORT, () => resolve(s));
  });
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const page = await browser.newPage();
    const leaked = [];
    // 守りが効かなかったときのための受け止め(本物へは出さない)。ここへ来た書き込みは「守りが止めなかった物」
    await page.route(/supabase\.co\//, (r) => {
      const m = r.request().method();
      if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') { leaked.push(`${m} ${r.request().url().replace(/^.*supabase\.co/, '').split('?')[0]}`); return r.fulfill({ status: 201, body: '[]' }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mhSupabaseWriteGuard === true && typeof SUPABASE_URL === 'string', null, { timeout: 90000 });
    const r = await page.evaluate(async () => {
      const post = async (p) => { try { const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return res.status; } catch (e) { return String(e); } };
      return { webdriver: navigator.webdriver, ranks: await post('card_battle_ranks_v2?on_conflict=breeder_id'), old: await post('card_battle_ranks?on_conflict=user_name'), pvp: await post('rpc/card_battle_pvp_report') };
    });
    await page.waitForTimeout(500);
    check('⑤ Playwright の Chromium は webdriver が true', r.webdriver === true, String(r.webdriver));
    const ours = leaked.filter((x) => /card_battle_ranks|card_battle_pvp_report/.test(x));
    check('⑤ ランキングの表・強さの点数への書き込みが、ブラウザの外へ出ない', ours.length === 0 && r.ranks === 201 && r.pvp === 201, `外へ出た: ${ours.join(', ') || 'なし'}`);
  } catch (e) {
    check('⑤ 実際の Chromium で確かめる', false, e.message.slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
