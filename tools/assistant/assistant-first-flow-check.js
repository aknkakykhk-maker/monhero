// 初めて遊ぶ流れで、選んだ助手以外が話さないかを見る(2026-10-25)。
//
//   node tools/assistant/assistant-first-flow-check.js
//
// 【なぜ要るか】
// 社長「初めてプレイして助手を選ぶときにきゅうこを選んだら、みゅあって言ってた」。
// 選んだ助手のあいさつ・はじめての設定(プロフィール)・村の案内・モンヒロビートの案内・バトルの案内は、
// 助手ごとの台本(〜_SETS)が無いと、みゅあの台本がそのまま出る作り。ドラ・あつ・きゅうこの分が無く、
// きゅうこの顔で「あたしはみゅあ」と話していた。
//
// 【見るもの】
// ① 台本: 5つの台本を助手ごとに取り出し、みゅあ以外がみゅあの台本を使っていないこと・ほかの助手の名前が入っていないこと。
//    あつは最初の「助手を選ぶ」に出ない(加入のお話のあとで選べる)ので、最初だけの3つ(あいさつ・はじめての設定・村の案内)は見ない
// ② 本物の画面: 新しいデータで始め、最初に選べる助手を1人ずつ選んで、プロフィール画面の吹き出しの顔と文に、ほかの助手が出ないこと
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
const A = new Function(`${src}
return { ASSISTANTS, assistantIntroPages, assistantOnboardingOf, assistantTutorialPages, assistantRhythmTutorialPages, assistantBattleGuidePages,
  ASSISTANT_INTRO, ASSISTANT_ONBOARDING, ASSISTANT_TUTORIAL, ASSISTANT_RHYTHM_TUTORIAL, ASSISTANT_BATTLE_TUTORIAL_GUIDE };`)();
const NAMES = { mua: 'みゅあ', kiki: 'きき', momosuke: 'もも', dra: 'ドラ', atsu: 'あつ', kyuko: 'きゅうこ' };
const FIRST_ONLY = new Set(['atsu']); // 最初の「助手を選ぶ」に出ない助手
const SCRIPTS = [
  ['選んだ助手のあいさつ', A.assistantIntroPages, A.ASSISTANT_INTRO, true],
  ['はじめての設定', (id) => Object.values(A.assistantOnboardingOf(id)), Object.values(A.ASSISTANT_ONBOARDING), true],
  ['村の案内', A.assistantTutorialPages, A.ASSISTANT_TUTORIAL, true],
  ['モンヒロビートの案内', A.assistantRhythmTutorialPages, A.ASSISTANT_RHYTHM_TUTORIAL, false],
  ['バトルの案内', A.assistantBattleGuidePages, A.ASSISTANT_BATTLE_TUTORIAL_GUIDE, false],
];
const ids = A.ASSISTANTS.map((a) => a.id);
check('助手を6人以上読めた', ids.length >= 6, ids.join(','));
for (const [label, pagesOf, base, firstOnly] of SCRIPTS) {
  for (const id of ids) {
    if (firstOnly && FIRST_ONLY.has(id)) continue;
    const pages = pagesOf(id);
    const usesMua = id !== 'mua' && (pages === base || JSON.stringify(pages) === JSON.stringify(base));
    const others = Object.entries(NAMES).filter(([k]) => k !== id && !(id === 'momosuke' && k === 'momosuke'))
      .map(([, n]) => n).filter((n) => pages.some((p) => (p.t || '').includes(n) && !(n === 'もも' && id === 'momosuke')));
    check(`${label}: ${NAMES[id]}はみゅあの台本を使わず、ほかの助手の名前も出ない`, !usesMua && others.length === 0,
      usesMua ? 'みゅあの台本のまま' : others.join('・'));
  }
}

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので画面は確かめられません'); process.exit(failed ? 1 : 0); }
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const PORT = 9600 + Math.floor(Math.random() * 300);
  const server = await new Promise((r) => { const sv = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); sv.listen(PORT, () => r(sv)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const id of ids.filter((x) => !FIRST_ONLY.has(x))) {
    const name = NAMES[id];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => /助手を選ぶ/.test(document.body.innerText), { timeout: 30000 });
      // 選ぶ助手の札の「この子にする」を押す
      const picked = await page.evaluate((pick) => {
        const b = [...document.querySelectorAll('button')].filter((x) => /この子にする/.test(x.innerText)).find((x) => { let e = x; for (let k = 0; k < 6 && e; k++, e = e.parentElement) { const t = e.innerText || ''; if (t.startsWith(pick) || (t.includes(pick) && (t.match(/この子にする/g) || []).length === 1)) return true; } return false; });
        if (!b) return false; b.click(); return true;
      }, name);
      if (!picked) { check(`${name}を選べた`, false); await page.close(); continue; }
      // 選んだ助手のあいさつ(出るなら)を読み進め、プロフィール画面まで行く。途中の吹き出しの文と顔を全部集める
      const seen = [];
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(700);
        const st = await page.evaluate(() => {
          const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; };
          const faces = [...document.querySelectorAll('img')].filter(vis).map((im) => (im.getAttribute('src') || '').split('?')[0].split('/').pop()).filter((s) => /^(myua|mua|kiki|momosuke|dra|atsu|kyuko)_/i.test(s));
          const texts = [...document.querySelectorAll('[data-bubble-text], .text-white')].filter(vis).map((e) => (e.innerText || '').replace(/\s+/g, ' ')).filter(Boolean);
          const profile = /はじめての設定/.test(document.body.innerText);
          const next = [...document.querySelectorAll('button')].filter(vis).find((b) => /^(次へ|つぎへ|▶|よろしく|まずは)/.test((b.innerText || '').trim()));
          if (!profile && next) next.click();
          return { faces, texts, profile };
        });
        seen.push(st);
        if (st.profile) break;
      }
      const last = seen[seen.length - 1] || { faces: [], texts: [] };
      check(`${name}を選ぶと、プロフィール画面(はじめての設定)まで進める`, !!last.profile);
      const faceIds = [...new Set(seen.flatMap((s) => s.faces).map((f) => f.split('_')[0].replace(/^myua$/, 'mua')))];
      check(`${name}を選ぶと、最初の流れに出る顔は${name}だけ`, faceIds.every((f) => f === id), faceIds.join(','));
      const others = Object.entries(NAMES).filter(([k]) => k !== id).map(([, n]) => n)
        .filter((n) => seen.some((s) => s.texts.some((t) => new RegExp(`(あたし|私|俺|おで|もも)は${n}|${n}(だよ|でつ|です)`).test(t))));
      check(`${name}を選ぶと、ほかの助手が名乗らない`, others.length === 0, others.join('・'));
    } catch (e) {
      check(`${name}で最初の流れを通せた`, false, String(e.message || e).slice(0, 120));
    }
    await page.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
