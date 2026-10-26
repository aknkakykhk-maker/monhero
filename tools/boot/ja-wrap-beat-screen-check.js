#!/usr/bin/env node
// モンヒロビートの画面の文(説明・助手の吹き出し・札)が、言葉の途中で折れていないかを数える(2026-10-26)。
// ダメダシの見回り(docs/progress/damedashi-2026-10-26/beat)「金色のノー／ツに」「(モンヒロ／ビート)」「「更／新」」「おす／すめ」。
//
//   node tools/boot/ja-wrap-beat-screen-check.js          # 320×568・375×667・390×844・844×390 で画面を巡って数える
//   node tools/boot/ja-wrap-beat-screen-check.js --list   # 折れた所を全部出す
//
// ja-wrap-check.js は短い札(16字まで・題名・タブ)だけを数え、長い文は数えない。ここではモンヒロビートの画面に限って、長い文も数える。
// 画面の字を1文字ずつの位置で見て行の変わり目を出し、その変わり目が Intl.Segmenter の1語の中か、句読点・閉じかっこ・長音が行の頭に落ちたら数える。
//   ・空白・<wbr> で折れたのは数えない(作り手が決めた折り目)。英数字だけの語・10字以上の語(1行に入らない)も数えない
//   ・見る画面: モードえらび・曲えらび・マスモン設定・遊びかた・ビートLv・オプションの4つのタブ・ランキング・記録
// 直し方: その文を jaWrap(…) で包み、style に JA_WRAP_STYLE を付ける(41-screen-ui.jsx)。字が決まっている札は <wbr> と break-keep でもよい
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8971;
const LIST = process.argv.includes('--list');
// 言葉の途中で折れてよい数。2026-10-26 に0まで直した
const BEAT_SCREEN_WRAP_LIMIT = 0;
let failed = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

// モードえらびから押していく道筋(「!」で始まる字は、見えているボタンの字)
const SCREENS = [
  ['モードえらび', []],
  ['曲えらび', ['!ソロライブ']],
  ['マスモン設定', ['!👾']],
  ['遊びかた', ['!遊びかた']],
  ['ビートLv', ['!ビートLv']],
  ['オプション・演奏', ['!オプション']],
  ['オプション・表示', ['!オプション', '!表示']],
  ['オプション・音', ['!オプション', '=音']],
  ['オプション・軽さ', ['!オプション', '!軽さ']],
  ['ランキング', ['!ランキング']],
  ['記録', ['!記録']],
];
const SIZES = [[320, 568], [375, 667], [390, 844], [844, 390]];

const SCAN = () => {
  const seg = new Intl.Segmenter('ja', { granularity: 'word' }); const out = []; const range = document.createRange();
  const blocks = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!/[ぁ-んァ-ヶ一-龯]/.test(n.data)) continue;
    let p = n.parentElement; while (p && getComputedStyle(p).display.startsWith('inline')) p = p.parentElement;
    if (p) blocks.add(p);
  }
  const blockOf = (n) => { let p = n.parentElement; while (p && getComputedStyle(p).display.startsWith('inline')) p = p.parentElement; return p; };
  for (const b of blocks) {
    const st = getComputedStyle(b); if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
    const r0 = b.getBoundingClientRect(); if (!r0.width || r0.bottom < 0 || r0.top > innerHeight) continue;
    // 字を1つずつ、その字の上端と「手前が <wbr> か」で並べる
    const chars = []; const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      // 中の別の箱(閉じた「▸ 詳しく」の中の文など)の字は、その箱のほうで数える
      if (blockOf(n) !== b) continue;
      let prev = n.previousSibling; if (!prev && n.parentElement !== b) prev = n.parentElement.previousSibling;
      const afterWbr = !!prev && prev.nodeName === 'WBR';
      for (let i = 0; i < n.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); const r = range.getClientRects()[0]; chars.push([n.data[i], r ? r.top : null, i === 0 && afterWbr]); }
    }
    for (let i = 0; i < chars.length; i++) if (chars[i][1] == null) chars[i][1] = i ? chars[i - 1][1] : 0;
    const full = chars.map((c) => c[0]).join('');
    for (let i = 1; i < chars.length; i++) {
      if (!(chars[i][1] > chars[i - 1][1] + 3) || chars[i][2]) continue;
      if (/\s/.test(full[i - 1]) || /\s/.test(full[i])) continue;
      let p = 0, word = '';
      for (const { segment } of seg.segment(full)) { if (i > p && i < p + segment.length) { word = segment; break; } p += segment.length; if (p >= i) break; }
      const mid = !!word && /[ぁ-んァ-ヶ一-龯]/.test(word) && word.length < 10;
      const head = /^[、。，．！？!?」』）)】…ー]/.test(full.slice(i));
      if (mid || head) out.push(`${full.slice(Math.max(0, i - 8), i)}／${full.slice(i, i + 8)}`);
    }
  }
  return [...new Set(out)];
};

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const found = [];
  try {
    for (const [W, H] of SIZES) {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      // ランキングは本番へ読みに行かない(読み込めないときの文を見る)
      await page.route(/supabase\.co/, (r) => r.abort());
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
      });
      const closeAll = async () => { for (let i = 0; i < 10; i++) { const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(受け取る|閉じる|OK|確認|スキップ|あとで読む)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }); if (!ok) break; await page.waitForTimeout(300); } };
      const toModeSelect = async () => {
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), null, { timeout: 40000 });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
        await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
        await page.waitForTimeout(1200); await closeAll();
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '').includes('モンヒロビート')); b && b.click(); });
        await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 }); await page.waitForTimeout(1000); await closeAll();
      };
      for (const [name, steps] of SCREENS) {
        try {
          await toModeSelect();
          for (const s of steps) {
            const loc = s.startsWith('=') ? page.locator('button:visible').filter({ hasText: new RegExp(`^\\s*${s.slice(1)}\\s*$`) }) : page.locator('button:visible', { hasText: s.slice(1) });
            await loc.first().click({ timeout: 8000 }); await page.waitForTimeout(1200);
          }
          await page.waitForTimeout(800);
          for (const x of await page.evaluate(SCAN)) found.push(`${name} ${W}×${H}: ${x}`);
        } catch (e) { check(`${name} ${W}×${H} を開けた`, false, e.message.split('\n')[0].slice(0, 120)); }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  const uniq = [...new Set(found)];
  if (LIST) for (const x of uniq) console.log('  ', x);
  check('モンヒロビートの画面で、言葉の途中で折れた所が上限(BEAT_SCREEN_WRAP_LIMIT)以下', uniq.length <= BEAT_SCREEN_WRAP_LIMIT,
    `${uniq.length}件(上限 ${BEAT_SCREEN_WRAP_LIMIT})${uniq.length ? ' — ' + uniq.slice(0, 6).join(' / ') : ''}`);
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
