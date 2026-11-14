// モンヒロサクセスのお話(第1話・第2話)の台詞が、スマホの幅で言葉の途中で折れていないかを、実際のお話の画面で測る(2026-11-14 ココロ)。
//
//   node tools/boot/monsuc-story-wrap-check.js            # 390 と 320 の幅で、第1話と第2話の全ページ
//   node tools/boot/monsuc-story-wrap-check.js --list     # 折れ目を全部書き出す(目で見るとき)
//
// 社長「トレーニングごとに1／列ずつ」(r1114-080)。台詞の欄・吹き出し・真ん中の場面の説明の字を1字ずつ測って、行の折れ目を出す。
//   ・数とそのあとの助数詞(1列・3回)が離れていない
//   ・ひらがなの短い続き(「すっかりは／まってる」)の途中で折れていない(1行に入る長さのとき)
//   ・カタカナの言葉(「トレーニ／ング」)の途中で折れていない
//   ・1〜2字だけの行が無い(顔文字・記号だけの行は数えない)
// 第2話はまだゲームに入っていない(β の日に入れる)。台本 docs/progress/monsuc-beta-story/script.md の第2話を、
//   検査の中だけ第1話の台本と入れ替えて、同じお話の画面で描く(本体は触らない)。
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8943;
const ID = 'monsuc_beta_ep1';
const LIST = process.argv.includes('--list');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.PNG': 'image/png', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

// 第2話の台本(文書の2つ目の js の欄)
const ep2 = (() => {
  const md = fs.readFileSync(path.join(ROOT, 'docs/progress/monsuc-beta-story/script.md'), 'utf8');
  const blocks = [...md.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
  const body = (blocks[1] || '').replace(/\/\/.*$/gm, '');
  const src = body.slice(body.indexOf('[') + 1, body.lastIndexOf(']'));
  try { return eval(`[${src}]`).filter((l) => l && l.who); } catch (e) { return []; }
})();
check('⓪ 第2話の台本を文書から読める', ep2.length >= 30, `${ep2.length}行`);

// 折れ目の良し悪し(a=前の行の終わり・b=次の行のはじめ)
const HIRA = /[ぁ-ゖー]/, KATA = /[ァ-ヶー]/;
const runAround = (line, next, re) => { let l = 0; for (let i = line.length - 1; i >= 0 && re.test(line[i]); i--) l++; let r = 0; for (let i = 0; i < next.length && re.test(next[i]); i++) r++; return [l, r]; };
const judge = (line, next, cap) => {
  const a = line.slice(-1), b = next[0] || '';
  if (/[0-9０-９]/.test(a) && /[一-龯ァ-ヶぁ-ゖ]/.test(b)) return '数と助数詞が離れた';
  // カタカナは、片方が2字以下になる折れ(「トレーニ／ング」)だけ見る。長い名前の言葉の境目(「ヒーローズ／ファイナル」)は折ってよい
  if (KATA.test(a) && /[ァ-ヶ]/.test(b)) { const [l, r] = runAround(line, next, KATA); if (l + r <= cap && (l <= 2 || r <= 2)) return 'カタカナの言葉の途中'; }
  if (/[ぁ-ゖ]/.test(a) && /[ぁ-ゖ]/.test(b) && !/[ぁぃぅぇぉっゃゅょゎ]/.test(a)) {
    const [l, r] = runAround(line, next, HIRA);
    // 助詞のあと(「〜は／」「〜に／」)は文節の切れ目。漢字のあとの送りがなと続きが短いときだけ見る
    if (l <= 2 && r <= 3 && l + r <= cap && !/[はがをにでともへやの]/.test(a)) return 'ひらがなの続きの途中';
  }
  if (/[ぁぃぅぇぉっゃゅょゎ]/.test(a) && HIRA.test(b)) return '小さい字のあとで切れた';
  return '';
};
const letters = (t) => (t.match(/[ぁ-ゖァ-ヶ一-龯A-Za-z0-9０-９]/g) || []).length;

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const storyKey = (fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8').match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1];
  const seed = eventStorySeed({ except: [ID] });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const bad = [];
  try {
    for (const [ep, swap] of [['第1話', null], ['第2話', ep2]]) for (const [w, h] of [[390, 844], [320, 640]]) {
      const label = `${ep} ${w}px`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      });
      await page.addInitScript(seed);
      // あつにも会った扱い(あつの行も測る)
      await page.addInitScript(([key]) => { try { const l = JSON.parse(localStorage.getItem(key) || '[]'); localStorage.setItem(key, JSON.stringify([...new Set([...l, 'atsu_join_2026_10_22'])].filter((x) => x !== 'monsuc_beta_ep1'))); } catch (e) {} }, [storyKey]);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).waitFor({ timeout: 60000 });
      if (swap) {
        // 検査の中だけ、第1話の台本の中身を第2話に入れ替える(同じ画面・同じ折り方で描く)
        const n = await page.evaluate((lines) => { if (typeof ASSISTANT_MONSUC_BETA_EP1 === 'undefined') return -1; ASSISTANT_MONSUC_BETA_EP1.splice(0, ASSISTANT_MONSUC_BETA_EP1.length, ...lines); return ASSISTANT_MONSUC_BETA_EP1.length; }, swap);
        if (n !== swap.length) { check(`${label}: 台本を入れ替えられる`, false, String(n)); await ctx.close(); continue; }
      }
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      const story = page.locator(`[data-event-story="${ID}"]`);
      let appeared = false;
      for (let i = 0; i < 80 && !appeared; i++) {
        appeared = await story.count() > 0; if (appeared) break;
        const bs = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ });
        for (let k = 0, n = await bs.count(); k < n; k++) { const b = bs.nth(k); if (await b.isVisible().catch(() => false)) { await b.dispatchEvent('click').catch(() => {}); break; } }
        await page.waitForTimeout(500);
      }
      if (!appeared) { check(`${label}: お話が流れる`, false); await ctx.close(); continue; }
      await page.locator('[data-story-opening-card]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(700);
      let pages = 0; const seen = new Set();
      for (let i = 0; i < 400; i++) {
        if (await page.locator('[data-story-ending]').count() > 0 || await story.count() === 0) break;
        await page.waitForTimeout(80);
        // 台詞の欄・吹き出し・真ん中の説明。1字ずつの位置から行に分ける
        const got = await page.evaluate(() => {
          const els = [...document.querySelectorAll('[data-story-sheet] span.leading-relaxed, [data-story-banner]')];
          return els.map((el) => {
            const lines = []; let top = null, cur = '';
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const r = document.createRange();
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              for (let i = 0; i < n.length; i++) {
                r.setStart(n, i); r.setEnd(n, i + 1);
                const rect = [...r.getClientRects()].find((x) => x.width > 0);
                const ch = n.data[i];
                if (!rect) { cur += ch; continue; }
                if (top === null || Math.abs(rect.top - top) > rect.height * 0.5) { if (top !== null) lines.push(cur); cur = ''; top = rect.top; }
                cur += ch;
              }
            }
            if (cur) lines.push(cur);
            const fs = parseFloat(getComputedStyle(el).fontSize) || 14;
            return { lines: lines.map((l) => l.replace(/\s+$/, '')), cap: Math.floor(el.getBoundingClientRect().width / fs), banner: el.hasAttribute('data-story-banner') };
          });
        });
        for (const g of got) {
          const key = g.lines.join('|');
          if (!key || seen.has(key)) continue;
          seen.add(key); pages++;
          if (LIST) console.log(`  ${label}${g.banner ? ' 説明' : ''}: ${g.lines.join(' ／ ')}`);
          for (let k = 0; k < g.lines.length; k++) {
            const line = g.lines[k], next = g.lines[k + 1];
            if (next !== undefined) { const why = judge(line.trimEnd(), next.trimStart(), g.cap); if (why) bad.push(`${label} ${why}「${line.slice(-6)}／${next.slice(0, 6)}」`); }
            // 文の切れ目(「私は、」「……あれ？」)で終わる行は短くてよい。句読点で終わらないかけらだけ数える
            if (g.lines.length > 1 && line && letters(line) > 0 && letters(line) <= 2 && !/^[「『]/.test(line) && !/[、。！？!?…」』]$/.test(line.trimEnd())) bad.push(`${label} 1〜2字だけの行「${g.lines.slice(Math.max(0, k - 1), k + 1).join('／')}」`);
          }
        }
        await story.locator('button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {});
      }
      check(`${label}: 全ページを測れた`, pages >= (swap ? 30 : 40), `${pages}ページ`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  check('言葉の途中で折れた台詞が無い(数と助数詞・ひらがなの短い続き・カタカナの言葉・1〜2字の行)', bad.length === 0, bad.length ? `${bad.length}件\n  ${[...new Set(bad)].join('\n  ')}` : '');
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件 NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
