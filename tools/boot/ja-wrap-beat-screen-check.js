#!/usr/bin/env node
// モンヒロビートの画面の文(説明・助手の吹き出し・札)が、言葉の途中で折れていないかを数える(2026-10-26)。
// ダメダシの見回り(docs/progress/damedashi-2026-10-26/beat)「金色のノー／ツに」「(モンヒロ／ビート)」「「更／新」」「おす／すめ」。
//
//   node tools/boot/ja-wrap-beat-screen-check.js          # 320×568・375×667・390×844・844×390 で画面を巡って数える
//   node tools/boot/ja-wrap-beat-screen-check.js --list   # 折れた所を全部出す
//   node tools/boot/ja-wrap-beat-screen-check.js --multi-only --list   # マルチの画面だけ
//
// ja-wrap-check.js は短い札(16字まで・題名・タブ)だけを数え、長い文は数えない。ここではモンヒロビートの画面に限って、長い文も数える。
// 画面の字を1文字ずつの位置で見て行の変わり目を出し、その変わり目が Intl.Segmenter の1語の中か、句読点・閉じかっこ・長音が行の頭に落ちたら数える。
//   ・空白・<wbr> で折れたのは数えない(作り手が決めた折り目)。英数字だけの語・10字以上の語(1行に入らない)も数えない
//   ・見る画面: モードえらび・曲えらび・マスモン設定・遊びかた・ビートLv・オプションの4つのタブ・ランキング・記録、
//     マルチ(フリーマッチの待ち・プライベートのシート/つくった待ち/入った・選曲・マスモンを呼ぶ・結果。偽の通信で、本番の部屋は作らない)
// 直し方: その文を jaWrap(…) で包み、style に JA_WRAP_STYLE を付ける(41-screen-ui.jsx)。字が決まっている札は <wbr> と break-keep でもよい
//
// 同じ巡りで、字の「切れ」も数える(2026-10-26 ビート部・部長テンポくんの依頼。フリーマッチの待ち人数が札の下の端で切れていた):
//   ・「…」切れ: text-overflow: ellipsis で、中身が箱より広い
//   ・横切れ・下の端で切れ: 字の位置が、外側の overflow hidden/clip の箱の左右・下の端の外へ出ている(動かせる箱の中は数えない)
//   ※箱の幅(scrollWidth)では見ない。札の後ろの飾りの大きな英字がはみ出していても、字そのものは切れていないため
//   ・画面の外: 字が画面の左右の外へ出ている
//   わざと「…」にしている所(長い曲名など)は CLIP_ALLOW に書く。切れの数は BEAT_SCREEN_CLIP_LIMIT 以下
//   node tools/boot/ja-wrap-beat-screen-check.js --list   # 切れた所も全部出す
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8971;
const LIST = process.argv.includes('--list');
// マルチの画面だけを巡る(直すときに早く回すため)
const MULTI_ONLY = process.argv.includes('--multi-only');
// 言葉の途中で折れてよい数。2026-10-26 に0まで直した
const BEAT_SCREEN_WRAP_LIMIT = 0;
// 字の切れてよい数(わざと切っている所は CLIP_ALLOW で外す)
const BEAT_SCREEN_CLIP_LIMIT = 0;
// わざと「…」で切っている所。[種類, 場所(要素の印), 理由]。字は回ごとに変わる(イベント名など)ので、場所で書く
const CLIP_ALLOW = [
  ['「…」切れ', '[data-rhythm-beat-point-campaign]', 'ビートPキャンペーンの帯。倍率(「周回 5倍」)を必ず見せるため、イベント名のほうだけ縮める(58-screen-rhythm.jsx・2026-10-26)'],
];
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

const CLIP = (allow) => {
  // 箱の幅(scrollWidth)ではなく、その字の位置で見る(札の後ろの飾りの大きな英字がはみ出しても、字そのものは切れていない)
  const out = []; const W = innerWidth;
  const hidden = (v) => v === 'hidden' || v === 'clip';
  const shown = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false; } return true; };
  const range = document.createRange();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest('script,style,svg,[aria-hidden="true"],[data-rhythm-play-area]')) continue;
    range.selectNodeContents(n); const tr = range.getBoundingClientRect();
    if (!tr.width || !tr.height || tr.bottom < 0 || tr.top > innerHeight) continue;
    if (!shown(el)) continue;
    const t = n.data.replace(/\s+/g, ' ').trim().slice(0, 24);
    let cut = '';
    // 「…」で切っている(text-overflow: ellipsis で、中身が箱より広い)
    for (let e = el, k = 0; e && k < 3 && !cut; e = e.parentElement, k++) {
      const st = getComputedStyle(e);
      if (st.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) cut = '「…」切れ';
    }
    // 外側の切る箱(overflow hidden/clip)の外へ、字が出ている。動かせる箱(auto/scroll)の中は、動かせば見えるので数えない
    if (!cut) for (let e = el; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      const scrollX = st.overflowX === 'auto' || st.overflowX === 'scroll', scrollY = st.overflowY === 'auto' || st.overflowY === 'scroll';
      const br = e.getBoundingClientRect();
      if (hidden(st.overflowX) && !scrollX && (tr.right > br.right + 1 || tr.left < br.left - 1)) { cut = '横切れ'; break; }
      if (hidden(st.overflowY) && !scrollY && tr.bottom > br.bottom + 2 && tr.top < br.bottom) { cut = '下の端で切れ'; break; }
      if (scrollX || scrollY) break;
    }
    if (!cut && (tr.right > W + 1 || tr.left < -1)) cut = '画面の外';
    if (cut && !allow.some(([k, sel]) => k === cut && el.closest(sel))) out.push([cut, t]);
  }
  return out;
};

// ===== マルチの画面(2026-10-26 ビート部・部長テンポくんの依頼) =====
// フリーマッチの待ち・プライベートの部屋(作る/入る)・選曲・マスモンを呼ぶ・結果も、同じ数え方で巡る。
// ★外へはつながない。WebSocket を偽物に差し替え、同じブラウザの2つのページのあいだを BroadcastChannel で中継する
//   (tools/mode/rhythm-multi-layout-check.js と同じ考え方)。本番の部屋は作らない。Supabase への通信は止める
const FAKE_WS = () => {
  class FakeWS {
    constructor() { this.readyState = 0; this.topic = null; this.ch = null; setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0); }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic; this.ch = new BroadcastChannel(`fake-ws:${m.topic}`);
        this.ch.onmessage = (e) => this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: e.data } });
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (this.ch) this.ch.postMessage(payload);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { this.readyState = 3; if (this.ch) this.ch.close(); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
};
// マルチの画面を巡って数える。戻り値 [名前, 折れ, 切れ] の並び
const runMulti = async (browser, W, H) => {
  const out = [];
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  await context.addInitScript(FAKE_WS);
  await context.route(/supabase\.co/, (r) => r.abort());
  const open = async (name, masu) => {
    const page = await context.newPage();
    await page.addInitScript(([nm, withMasu]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', nm); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_hell_story_seen_v1', true);
      // 起動したときのお詫び・補償のお知らせは配り済みにしておく(画面を覆って止まるため)
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
      if (withMasu) put('mh_masu_mons', [{ id: 'm1', baseId: 'Mocchi', name: 'もちまる', bondXp: 5000, createdAt: 1 }]);
    }, [name, !!masu]);
    await page.addInitScript(require('./quiet-boot-seed').eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), null, { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d || d.closest('[data-rhythm-multi],[data-rhythm-mode-private-sheet],[data-rhythm-buddy-picker],[data-rhythm-buddy-sheet],[data-rhythm-buddy-list-sheet]')) return; const b = [...d.querySelectorAll('button')].find((x) => /^(受け取る|OK|確認|スキップ|あとで読む)$/.test((x.innerText || x.getAttribute('aria-label') || '').trim())); if (b) b.click(); }, 400); });
    await page.waitForTimeout(1500);
    // HOME に着いたら、ログインボーナスなどのお知らせを一通り閉じる(ここでは「閉じる」も押してよい)
    for (let i = 0; i < 10; i++) { const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(受け取る|閉じる|OK|確認|スキップ|あとで読む)$/.test((x.innerText || '').trim()) && x.getClientRects().length); if (b) b.click(); return !!b; }); if (!ok) break; await page.waitForTimeout(500); }
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '').includes('モンヒロビート')); b && b.click(); });
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 }); await page.waitForTimeout(800);
    return page;
  };
  const scan = async (name, page) => { await page.waitForTimeout(900); out.push([name, await page.evaluate(SCAN), await page.evaluate(CLIP, CLIP_ALLOW.map(([k, sel]) => [k, sel]))]); };
  const step = (p) => p.evaluate(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') || '');
  try {
    // フリーマッチの待ち(ほかの部屋が見つからないので、自分で部屋を作って待つ)
    { const P = await open('は');
      await P.locator('[data-rhythm-multi-free]').click();
      await P.waitForFunction(() => !!document.querySelector('[data-rhythm-multi]'), null, { timeout: 20000 });
      await scan('フリーマッチの待ち', P); await P.close(); }
    const A = await open('あ', true), B = await open('い');
    // プライベートの部屋をつくる → 待ち
    await A.locator('[data-rhythm-mode-private-open]').click();
    await A.waitForSelector('[data-rhythm-mode-private-sheet]', { timeout: 5000 });
    await scan('プライベート(シート)', A);
    await A.locator('[data-rhythm-multi-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    await scan('プライベート(つくった・待ち)', A);
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    // 入る側: 合言葉を入れて入る
    await B.locator('[data-rhythm-mode-private-open]').click();
    await B.locator('[data-rhythm-multi-code-input]').fill(code);
    await B.locator('[data-rhythm-multi-join]').click();
    await A.waitForFunction(() => typeof RHYTHM_MULTI !== 'undefined' && RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2, null, { timeout: 20000 });
    await scan('プライベート(入った)', B);
    await scan('プライベート(2人そろった・部屋主)', A);
    await A.locator('[data-rhythm-multi-confirm]').click();
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 15000 });
    await scan('マルチの選曲', A);
    // マスモンを呼ぶ画面(マスモンを持たせた部屋主で開いて、閉じる)
    if (await A.evaluate(() => { const b = [...document.querySelectorAll('[data-rhythm-buddy-open]')].find((x) => x.getClientRects().length); if (b) b.click(); return !!b; })) {
      await A.waitForSelector('[data-rhythm-buddy-picker],[data-rhythm-buddy-sheet],[data-rhythm-buddy-list-sheet]', { timeout: 8000 }).catch(() => {});
      await scan('マスモンを呼ぶ', A);
      await A.keyboard.press('Escape').catch(() => {});
      await A.evaluate(() => { const s = document.querySelector('[data-rhythm-buddy-picker],[data-rhythm-buddy-sheet],[data-rhythm-buddy-list-sheet]'); const b = s && [...s.querySelectorAll('button')].find((x) => /閉じる|もどる|戻る|✕/.test(x.innerText || x.getAttribute('aria-label') || '')); if (b) b.click(); });
      await A.waitForTimeout(600);
    } else out.push(['マスモンを呼ぶ', ['(呼ぶボタンが見つからない)'], []]);
    // 2人でライブを始めて、結果を届けて、抜ける → 結果
    await A.locator('[data-rhythm-demo-start]').click();
    await B.waitForSelector('[data-rhythm-multi-omakase]', { timeout: 15000 }); await B.locator('[data-rhythm-multi-omakase]').click();
    await A.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 }); await B.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 });
    await A.locator('[data-rhythm-multi-ready]').click(); await B.locator('[data-rhythm-multi-ready]').click();
    await A.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 }); await B.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    const round = await A.evaluate(() => RHYTHM_MULTI.view().room.round);
    await A.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 912345, cleared: true, fullCombo: true, maxCombo: 231, judgments: { MARVELOUS: 180, EXCELLENT: 40, GREAT: 11, GOOD: 0, BAD: 0, MISS: 0 }, fast: 12, slow: 7 }, false, { diffId: 'MASTER' }), round);
    await B.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 640000, cleared: true, maxCombo: 120, judgments: { MARVELOUS: 90, EXCELLENT: 80, GREAT: 30, GOOD: 10, BAD: 5, MISS: 16 }, fast: 30, slow: 25 }, false, { diffId: 'EXPERT' }), round);
    for (const p of [A, B]) for (let i = 0; i < 6; i += 1) {
      if (!(await p.evaluate(() => !!document.querySelector('[data-rhythm-play-area]')))) break;
      await p.evaluate(() => document.querySelector('[data-rhythm-pause]')?.click()); await p.waitForTimeout(700);
      await p.locator('[data-rhythm-pause-exit]').click({ force: true, timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
    }
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'result', null, { timeout: 30000 });
    await scan('マルチの結果', A);
  } catch (e) {
    out.push([`マルチ(途中で止まった)`, [`(${e.message.split('\n')[0].slice(0, 100)})`], []]);
    if (process.env.MULTI_SHOT) for (const [i, p] of context.pages().entries()) await p.screenshot({ path: `${process.env.MULTI_SHOT}/multi-${W}x${H}-${i}.png` }).catch(() => {});
  }
  await context.close();
  return out;
};

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const found = [];
  const clipped = [];
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
      for (const [name, steps] of (MULTI_ONLY ? [] : SCREENS)) {
        try {
          await toModeSelect();
          for (const s of steps) {
            const loc = s.startsWith('=') ? page.locator('button:visible').filter({ hasText: new RegExp(`^\\s*${s.slice(1)}\\s*$`) }) : page.locator('button:visible', { hasText: s.slice(1) });
            await loc.first().click({ timeout: 8000 }); await page.waitForTimeout(1200);
          }
          await page.waitForTimeout(800);
          for (const x of await page.evaluate(SCAN)) found.push(`${name} ${W}×${H}: ${x}`);
          for (const [kind, t] of await page.evaluate(CLIP, CLIP_ALLOW.map(([k, sel]) => [k, sel]))) clipped.push(`${name} ${W}×${H}: ${kind}「${t}」`);
        } catch (e) { check(`${name} ${W}×${H} を開けた`, false, e.message.split('\n')[0].slice(0, 120)); }
      }
      await page.close();
      // マルチの画面
      for (const [name, wraps, clips] of await runMulti(browser, W, H)) {
        if (name.startsWith('マルチ(途中で止まった)') || (wraps[0] || '').startsWith('(')) { check(`${name} ${W}×${H} を開けた`, false, wraps[0] || ''); continue; }
        for (const x of wraps) found.push(`${name} ${W}×${H}: ${x}`);
        for (const [kind, t] of clips) clipped.push(`${name} ${W}×${H}: ${kind}「${t}」`);
      }
    }
  } finally { await browser.close(); server.close(); }
  const uniq = [...new Set(found)];
  if (LIST) for (const x of uniq) console.log('  ', x);
  check('モンヒロビートの画面で、言葉の途中で折れた所が上限(BEAT_SCREEN_WRAP_LIMIT)以下', uniq.length <= BEAT_SCREEN_WRAP_LIMIT,
    `${uniq.length}件(上限 ${BEAT_SCREEN_WRAP_LIMIT})${uniq.length ? ' — ' + uniq.slice(0, 6).join(' / ') : ''}`);
  const clipUniq = [...new Set(clipped)];
  if (LIST) for (const x of clipUniq) console.log('  ', x);
  check('モンヒロビートの画面で、字が切れた・はみ出した所が上限(BEAT_SCREEN_CLIP_LIMIT)以下', clipUniq.length <= BEAT_SCREEN_CLIP_LIMIT,
    `${clipUniq.length}件(上限 ${BEAT_SCREEN_CLIP_LIMIT})${clipUniq.length ? ' — ' + clipUniq.slice(0, 6).join(' / ') : ''}`);
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
