#!/usr/bin/env node
// クリスマス関係の画面の文字の崩れを、本物の画面をブラウザで開いて全部数える(台帳 r1126-078。社長「文字の崩れが永遠に直らないけど人の目で見ないと無理なの？」)。
//
//   node tools/novel/xmas-text-wrap-browser-check.js            縦(390×844)・横(844×390)・タブレット(820×1180)で見る
//   NV_ONLY=tate など で幅をしぼる / NV_WRAP_VERBOSE=1 で崩れを全部出す
//
// 見る画面(時計を開幕 11/28 10:05 にずらす。Supabase には触らず空の返事にする):
//   HOME のイベントの帯 / イベントページの3タブ(物語・レイド・ボーナス) / レイドのお話(導入。HOME に着くと流れる) / 序章のお話 /
//   事件簿の起動画面・章から・エンドヒストリー / 更新履歴(11/27 以降の項目を開いて) / ヘルプ(クリスマスに触れる項目)
//   事件簿の本文の全行(選択肢・手がかりの窓・名前の札・おまけ)は、同じ見た目で全部描く tools/novel/xmas-novel-wrap-check.js が見る
// 行ごとの区切りは、字ごとの Range の矩形で取る。見つけるもの:
//   ・文節の途中での改行(道具 Intl.Segmenter の言葉の切れ目でない・ひらがなの言葉の途中・漢字/カタカナのあと助詞の手前・名前/日時/かっこの中・行頭に来てはいけない字)
//   ・1文字だけの行 ・はみ出し/切れ(字が画面や枠の外) ・「{」「}」「〔」「〕」がそのまま出ている
// 出力は小さく: 画面ごとの崩れの件数と、上から数件だけ
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8979;
const VERBOSE = !!process.env.NV_WRAP_VERBOSE;
const ONLY = process.env.NV_ONLY || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const VPS = [
  { label: '縦', key: 'tate', viewport: { width: 390, height: 844 } },
  { label: '横', key: 'yoko', viewport: { width: 844, height: 390 } },
  { label: 'タブレット', key: 'tablet', viewport: { width: 820, height: 1180 } },
].filter((v) => !ONLY || v.key === ONLY);
const OPEN = '2026-11-28T10:05:00+09:00';
const RAID_IDS = ['raid_xmas_story_1b'];

// ページの中で動く測り方。root の中の字を全部、ふだんの塊(ブロック)ごとに集め、行の切れ目を調べる
const SCAN = () => {
  window.__nvScan = (rootSel, label) => {
    const roots = [...document.querySelectorAll(rootSel)];
    const out = { texts: 0, issues: [] };
    if (!roots.length) return out;
    const seg = new Intl.Segmenter('ja', { granularity: 'word' });
    const gram = typeof xmasNovelGramBreak === 'function' ? xmasNovelGramBreak : () => false;
    let keepWords = [];
    try { keepWords = typeof xmasNovelKeepWords === 'function' ? xmasNovelKeepWords() : []; } catch (e) { keepWords = []; }
    const keepRes = typeof XMAS_NOVEL_KEEP_RES !== 'undefined' ? XMAS_NOVEL_KEEP_RES : [];
    const isKana = (s, i) => /[ぁ-ゖゝゞ]/.test(s[i] || '') || (s[i] === 'ー' && i > 0 && /[ぁ-ゖ]/.test(s[i - 1]));
    const vw = window.innerWidth;
    const blockOf = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'inline-block' && d !== 'contents') return e; } return document.body; };
    const groups = new Map();
    for (const root of roots) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const p = n.parentElement; if (!p) continue;
        const cs = getComputedStyle(p);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const b = blockOf(p);
        if (!groups.has(b)) groups.set(b, []);
        groups.get(b).push(n);
      }
    }
    const range = document.createRange();
    for (const [blk, nodes] of groups) {
      const bcs = getComputedStyle(blk);
      // わざと1行で切って「…」にしている所(題の帯など)は、行の折れ方では見ない
      const ellipsis = bcs.textOverflow === 'ellipsis' && bcs.whiteSpace === 'nowrap';
      let txt = ''; const rects = [];
      for (const n of nodes) {
        const pv = getComputedStyle(n.parentElement).visibility === 'hidden';
        for (let i = 0; i < n.textContent.length; i++) {
          range.setStart(n, i); range.setEnd(n, i + 1);
          const r = range.getClientRects()[0];
          rects.push(pv || !r || (!r.width && !r.height) ? null : { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height });
          txt += n.textContent[i];
        }
      }
      if (!rects.some(Boolean)) continue;
      out.texts++;
      const say = (why, at) => out.issues.push(`${label}: ${why}「${at}」`);
      if (/[{}〔〕]/.test(txt)) say('印がそのまま', txt.slice(Math.max(0, txt.search(/[{}〔〕]/) - 6), txt.search(/[{}〔〕]/) + 6));
      // はみ出し: 字が画面の外へ出ている
      const clip = blk.getBoundingClientRect();
      const out1 = rects.findIndex((r) => r && (r.r > vw + 1 || r.l < -1));
      if (out1 >= 0 && !ellipsis) say('画面の外にはみ出し', txt.slice(Math.max(0, out1 - 6), out1 + 4));
      const cut = (bcs.overflowX === 'hidden' || bcs.overflow === 'hidden') && rects.findIndex((r) => r && r.r > clip.right + 2 && !ellipsis);
      if (cut && cut > 0) say('枠で切れている', txt.slice(Math.max(0, cut - 6), cut + 4));
      if (ellipsis) continue;
      // 行の切れ目
      const edges = new Set([0, txt.length]); const segAt = new Map();
      for (const x of seg.segment(txt)) { edges.add(x.index); edges.add(x.index + x.segment.length); segAt.set(x.index, x.segment); }
      const spans = [];
      for (const re of keepRes) for (const m of txt.matchAll(new RegExp(re.source, re.flags))) if (!/^[「『【]/.test(m[0]) || [...m[0]].length <= 12) spans.push([m.index, m.index + m[0].length]);
      for (const w of keepWords) for (let i = txt.indexOf(w); i >= 0; i = txt.indexOf(w, i + 1)) spans.push([i, i + w.length]);
      // 1行に入る字数の見込み。名前・言葉がそれより長いときは、どこで折っても入らないので数えない(ヘルプの表の狭い欄など)
      const cap = Math.max(1, Math.floor(blk.clientWidth / (parseFloat(bcs.fontSize) || 14)));
      // 言葉の前の開きかっこ・あとの閉じかっこと句読点は離せないので、合わせて数える
      const fits = (x, y) => { while (x > 0 && /[「『（(【]/.test(txt[x - 1])) x--; while (y < txt.length && /[」』）)】、。！？!?]/.test(txt[y])) y++; return [...txt.slice(x, y)].length <= cap; };
      const segOf = (i) => { let a = 0; for (const x of seg.segment(txt)) { if (x.index < i && x.index + x.segment.length > i) return [x.index, x.index + x.segment.length]; if (x.index >= i) break; a = x.index; } return [i, i]; };
      let prev = null, lineStart = 0;
      const lines = [];
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]; if (!r) continue;
        if (prev && r.t > prev.t + Math.min(r.h, prev.h) * 0.6) {
          lines.push([lineStart, i]);
          const b = txt.slice(0, i), a = txt.slice(i), why = [];
          if (!/\s$/.test(b) && !/^\s/.test(a) && !/\n$/.test(b)) {
            if (!edges.has(i)) { const [x, y] = segOf(i); if (fits(x, y)) why.push('言葉の途中'); }
            else if (isKana(txt, i - 1) && isKana(txt, i) && !gram(txt, i)) why.push('ひらがなの言葉の途中');
            if (spans.some(([x, y]) => i > x && i < y && fits(x, y))) why.push('名前・日時・かっこの中');
            // 文の終わり(。！？」)のあとの「……」は、新しい文の頭なのでよい
            if (/^[、。，．,.」』）)】〕〉》…‥ー〜～・：；ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?]/.test(a) && !(/^[…‥]/.test(a) && /[。！？!?」』]$/.test(b))) why.push('行頭に来てはいけない字');
            if (/[「『（(【〔〈《]$/.test(b)) why.push('開きかっこで終わる行');
            const w = segAt.get(i);
            if (/[一-龯々ァ-ヶー」』）)A-Za-z0-9０-９]$/.test(b) && w && /^(?:の|は|が|を|に|へ|と|で|も|や|から|まで|より)$/.test(w)) why.push('助詞の手前');
          }
          if (why.length) say(why.join('・'), `${txt.slice(Math.max(lineStart, i - 8), i)}／${txt.slice(i, i + 6)}`);
          lineStart = i;
        }
        prev = r;
      }
      lines.push([lineStart, txt.length]);
      // 1文字だけの行(字が1つだけ。記号・顔文字・空白は数えない)
      if (lines.length > 1) for (const [x, y] of lines) {
        const line = txt.slice(x, y);
        const [sx, sy] = segOf(x);
        if ((line.match(/[ぁ-ゖァ-ヶ一-龯A-Za-z0-9０-９]/g) || []).length === 1 && !/^\s*[0-9０-９A-Za-z]\s*$/.test(line) && fits(Math.min(sx, x), Math.max(sy, x + 1))) say('1文字だけの行', `${txt.slice(Math.max(0, x - 8), x)}／${line}`);
      }
    }
    out.issues = [...new Set(out.issues)];
    return out;
  };
};

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const total = { texts: 0, issues: [] };
  const byScreen = {};
  try {
    for (const vp of VPS) {
      const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(shiftClock(OPEN));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed({ except: RAID_IDS })); await page.addInitScript(seeds.updateNoticeSeed());
      await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.addInitScript(SCAN);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const scan = async (sel, screen) => {
        await page.waitForTimeout(250);
        const r = await page.evaluate(([s, l]) => window.__nvScan(s, l), [sel, `${vp.label} ${screen}`]);
        total.texts += r.texts; total.issues.push(...r.issues);
        byScreen[screen] = byScreen[screen] || { texts: 0, issues: 0 };
        byScreen[screen].texts += r.texts; byScreen[screen].issues += r.issues.length;
        return r;
      };
      // お話(HOME で流れる・序章)を最後までめくる。文が変わったときだけ測る
      const flip = async (screen) => {
        let last = '';
        for (let k = 0; k < 250; k++) {
          const t = await page.evaluate(() => { const r = document.querySelector('[data-event-story]'); return r ? r.textContent : null; });
          if (t == null) break;
          if (t !== last) { await scan('[data-event-story]', screen); last = t; }
          const next = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-story] button')].find((x) => /^(次へ|閉じる|とじる|おわる|終わる)$/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; });
          if (!next) await page.mouse.click(Math.round(vp.viewport.width / 2), Math.round(vp.viewport.height * 0.72));
          await page.waitForTimeout(160);
        }
      };
      // ① レイドのお話(導入): HOME に着くと流れる。最後までめくりながら、出た文を全部見る
      await flip('レイドのお話');
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
      // ② HOME のイベントの帯
      await scan('[data-home-xmas-entry]', 'HOMEの帯');
      // ③ イベントページの3タブ
      await page.locator('[data-home-xmas-entry]').first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      if (!(await page.locator('[data-xmas-event]').count())) console.log(`… ${vp.label}: イベントページを開けなかった(帯 ${await page.locator('[data-home-xmas-entry]').count()}個・お話 ${await page.locator('[data-event-story]').count()})`);
      const tabs = await page.getByRole('tab').allInnerTexts().catch(() => []);
      for (const t of tabs) {
        await page.getByRole('tab', { name: t.trim() }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(900);
        await scan('.mh-xmas-shell', `イベントページ(${t.trim()})`);
      }
      // ④ 序章のお話(物語のタブから読む)
      await page.getByRole('tab', { name: /物語/ }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
      if (await page.locator('[data-xmas-story-chapter="xs00"]').count()) {
        await page.locator('[data-xmas-story-chapter="xs00"]').click().catch(() => {});
        await page.waitForTimeout(500);
        await scan('[data-xmas-story-sheet]', 'イベントページ(物語の窓)');
        await page.locator('[data-xmas-story-read]').click().catch(() => {});
        await page.waitForTimeout(1500);
        await flip('序章のお話');
        await page.waitForTimeout(800);
      }
      // ⑤ 事件簿の起動画面・章から・エンドヒストリー(全部見たことにして題を出す)
      await page.evaluate(() => { try { openXmasNovel({ force: true, playerName: '検査' }); } catch (e) { /* 無ければ飛ばす */ } });
      await page.waitForTimeout(2500);
      if (await page.locator('[data-xmas-novel]').count()) {
        await scan('[data-xmas-novel]', '事件簿の起動画面');
        for (const [btn, name] of [['[data-xmas-novel-endings]', 'エンドヒストリー'], ['[data-xmas-novel-chapters]', '事件簿の章から']]) {
          if (await page.locator(btn).count()) {
            await page.locator(btn).first().click().catch(() => {}); await page.waitForTimeout(900);
            await scan('[data-xmas-novel]', name);
            await page.getByRole('button', { name: '戻る' }).first().click().catch(() => {}); await page.waitForTimeout(600);
          }
        }
        await page.evaluate(() => { const b = document.querySelector('[data-xmas-novel-close]') || [...document.querySelectorAll('[data-xmas-novel] button')].find((x) => /閉じる|とじる|もどる|戻る/.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(1200);
      }
      // ⑥ 更新履歴(11/27 以降の項目を開いて)
      for (let i = 0; i < 4; i++) { await page.evaluate(() => { document.querySelector('[data-xmas-event-close], button[aria-label="戻る"]')?.click(); }); await page.waitForTimeout(600); if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break; }
      const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /お知らせ|更新情報|更新履歴/.test(x.innerText || x.getAttribute('aria-label') || '')); if (!b) return false; b.click(); return true; });
      await page.waitForTimeout(1500);
      if (opened && await page.locator('[data-changelog-list]').count()) {
        const n = await page.evaluate(() => {
          let k = 0;
          for (const a of document.querySelectorAll('[data-changelog-list] article')) {
            if (!/2026[-/.]11[-/.](2[7-9]|30)|2026[-/.]12|11\/(2[7-9]|30)|11月(2[7-9]|30)日/.test(a.innerText)) continue;
            a.setAttribute('data-nv-scan', ''); k++;
            const t = a.querySelector('[data-changelog-toggle]'); if (t && a.dataset.changelogOpen !== 'true' && a.dataset.changelogOpen !== '1') t.click();
          }
          return k;
        });
        await page.waitForTimeout(1200);
        const r = await scan('[data-changelog-list] article[data-nv-scan]', '更新履歴');
        if (!n) console.log(`… ${vp.label}: 更新履歴に 11/27 以降の項目が見つからない`);
        void r;
        await page.evaluate(() => { document.querySelector('button[aria-label="閉じる"], button[aria-label="戻る"]')?.click(); });
        await page.waitForTimeout(800);
      } else console.log(`… ${vp.label}: 更新履歴を開けなかった`);
      // ⑦ ヘルプ(クリスマスに触れる項目)
      for (let i = 0; i < 4; i++) { if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break; await page.evaluate(() => { document.querySelector('button[aria-label="戻る"], button[aria-label="閉じる"]')?.click(); }); await page.waitForTimeout(600); }
      const topics = await page.evaluate(() => {
        const out = [];
        try { for (const c of HELP_CATEGORIES) for (const t of c.topics || []) if (/クリスマス|聖夜|事件簿|黒いサンタ|スネグーラチカ/.test(JSON.stringify(t))) out.push([c.title, t.title]); } catch (e) { /* 無ければ空 */ }
        return out;
      });
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click').catch(() => {});
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click', {}, { timeout: 15000 }).catch(() => {});
      await page.locator('[data-mh-help]').waitFor({ timeout: 15000 }).catch(() => {});
      let helpSeen = 0;
      for (const [cat, title] of topics) {
        const ok = await page.evaluate(([c, t]) => {
          const click = (re) => { const b = [...document.querySelectorAll('[data-mh-help] button')].find((x) => (x.innerText || '').includes(re)); if (b) { b.click(); return true; } return false; };
          if (click(t)) return true;
          return click(c) ? 'cat' : false;
        }, [cat, title]);
        if (ok === 'cat') { await page.waitForTimeout(600); await page.evaluate((t) => { const b = [...document.querySelectorAll('[data-mh-help] button')].find((x) => (x.innerText || '').includes(t)); if (b) b.click(); }, title); }
        await page.waitForTimeout(900);
        if (ok) { await scan('[data-mh-help]', 'ヘルプ'); helpSeen++; }
        // 一覧へ戻る
        for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelector('[data-mh-help-back]')?.click()); await page.waitForTimeout(400); }
      }
      if (topics.length && !helpSeen) console.log(`… ${vp.label}: ヘルプの項目を開けなかった`);
      check(`${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  const scr = Object.entries(byScreen).map(([k, v]) => `${k} ${v.texts}文/${v.issues}件`).join('・');
  console.log(`… 見た文: ${total.texts}(${scr})`);
  check(`クリスマス関係の画面の文字が崩れていない(${VPS.map((v) => v.label).join('・')})`, total.issues.length === 0, total.issues.length ? `${total.issues.length}件 例: ${total.issues.slice(0, 5).join(' | ')}` : '');
  if (VERBOSE) total.issues.forEach((m) => console.log(`   ${m}`));
  if (failed) { console.log(`NG ${failed}件`); process.exit(1); }
  console.log('OK: クリスマス関係の画面の文字の崩れ 0件');
})().catch((e) => { console.error(e); process.exit(1); });
