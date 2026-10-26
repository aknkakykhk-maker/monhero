// MFバトルカードの「助手と対戦」で、選んだ助手の戦い方の型・使うモンスター・よく使うカード・強さによるデッキの違いが、
// 切れずに出るかを実際のブラウザで確かめる(2026-10-25 社長「攻撃型とかピクシーとかなになにを編成しやすいとか出して」)。
//
//   node tools/card/card-foe-style-browser-check.js
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-foe-style-browser-check.js   390×844 の写真も撮る
//
// 見ているもの(390×664・844×390・1280×800。合言葉の端末なので、助手は全員選べる)
//   ① どの助手を選んでも、型の札(〜型)・説明・好きなモンスター(1体・顔付き)が出る。型は CARD_AI_HABITS から決まる(みゅあ=攻撃型 など)
//   ② 好んで入れるカードがある助手(あつ)だけ、しっかり組む強さ(HARD から)で「よく使うカード」が出る
//   ③ 強さで組み方の説明が変わる(EASY は気分屋・HARD は相性のいい3体 など。82 の CARD_AI_BUILD と同じ決め)
//   ⑤ どの助手を選んでも、強さのボタンが送らずに全部見える(「対戦する」の帯に潜らない)
//   ④ 字が切れていない(1行のままの字が箱からはみ出さない)・数字(重みや勝率)を出していない(「1体」〜「4体」「第1弾」だけは数として出す)
//   ⑥ 紹介欄の立ち絵が、透明な余白を除いて欄の高さに合う(2026-10-26 社長「みゅあの立ち絵だけ小さい」)。
//      助手の標準の服は測ってある輪郭を使う(canvas の getImageData が失敗しても小さくならない)・きき→みゅあの切り替え・
//      狭い縦画面・大きさの変更・横向き→縦向きに戻したあとも合う・着替えの服には標準の服の輪郭を当てない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9018;
const SHOT = process.env.CARD_SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// withAuto … AUTO設定の「モンヒロビート中に回すクイック周回」の編成を入れておくか
const seed = (withAuto) => `(() => {
  if (sessionStorage.getItem('__cardAutoSeeded')) return;
  sessionStorage.setItem('__cardAutoSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true);
  put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
  ${withAuto ? `put('mh_auto_settings_v1', {
    strategy: 'random',
    allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 },
    quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: false },
  });` : ''}
  localStorage.setItem('mh_debug_unlocked_v1', '1');
  put('mh_card_cpu_unlocked_v1', { hard: true, expert: true, master: true }); // 強さ HARD まで選べるように(検査の準備)
})()`;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  let VIEW = { width: 844, height: 390 };
  const SHOT = process.env.CARD_SHOT_DIR || '';
  // mode … 'canvasFail'(canvas の画素の読み取りを失敗させる)・'costume'(みゅあにハロウィンの服を着せる)
  const open = async (withAuto, mode = '') => {
    const context = await browser.newContext({ viewport: VIEW });
    const page = await context.newPage();
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.addInitScript(seed(withAuto));
    if (mode === 'canvasFail') await page.addInitScript(() => { CanvasRenderingContext2D.prototype.getImageData = function () { throw new Error('検査: 画素を読めない端末のまね'); }; });
    if (mode === 'costume') await page.addInitScript(() => {
      localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify(['mua_halloween_2026']));
      localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify({ mua: 'mua_halloween_2026' }));
    });
    await page.addInitScript(quiet.eventStorySeed());
    await page.addInitScript(quiet.updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('TAP TO START'))?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    return { context, page };
  };
  const dismiss = async (page) => {
    // ログインボーナスや助手たちの会話が HOME を覆うことがある。閉じるボタンが無くなり、入口が見えるまで閉じる
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
      if (!clicked && await page.evaluate(() => !!document.querySelector('[data-home-card-battle]') && !document.querySelector('[role="dialog"]'))) break;
      await page.waitForTimeout(600);
    }
  };
  // HOME の入口からカードを開き、はじめてならスターター → 練習試合を飛ばしてトップへ
  const enterCard = async (page) => {
    await dismiss(page);
    await page.evaluate(() => document.querySelector('[data-home-card-battle]')?.click());
    await page.waitForSelector('[data-card-top]', { timeout: 20000 }).catch(() => {});
    if (await page.evaluate(() => !!document.querySelector('[data-card-top="starter"]'))) {
      await page.click('[data-card-kit="powerful"]');
      await page.getByRole('button', { name: /にする$/ }).click();
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 }).catch(() => {});
      await page.click('[data-card-quit]');
      await page.waitForTimeout(300);
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit'))?.click(); });
      await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 }).catch(() => {});
      await page.getByRole('button', { name: 'トップへ' }).click();
    }
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 }).catch(() => {});
  };
  const backHome = async (page) => {
    await page.evaluate(() => document.querySelector('[data-card-top="top"] header button')?.click());
    await page.waitForFunction(() => !document.querySelector('[data-card-top]'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
  };
  try {
    const WANT = { mua: '攻撃型', momosuke: '邪魔型', kiki: '大技型', kyuko: 'バランス型', dra: '守り型', atsu: '全体攻撃型' };
    for (const [w, h] of [[390, 664], [844, 390], [1280, 800], [390, 844]]) {
      VIEW = { width: w, height: h };
      const { context, page } = await open(true);
      await enterCard(page);
      await page.click('[data-card-cpu]');
      await page.click('[data-card-mode-assistant]');
      await page.waitForSelector('[data-card-top="foe"]', { timeout: 8000 });
      const foes = await page.evaluate(() => [...document.querySelectorAll('[data-card-foe]')].map((b) => b.getAttribute('data-card-foe')));
      const bad = [];
      for (const who of foes) {
        await page.click(`[data-card-foe="${who}"]`);
        for (const lv of ['easy', 'hard']) {
          await page.click(`[data-card-level="${lv}"]`);
          await page.waitForTimeout(150);
          const r = await page.evaluate(() => {
            const el = document.querySelector('[data-card-foe-style]');
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            const clipped = [...el.querySelectorAll('.whitespace-nowrap, [data-card-foe-style-label]')].filter((x) => x.scrollWidth > x.clientWidth + 0.5 || x.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5).map((x) => x.textContent);
            return { label: el.querySelector('[data-card-foe-style-label]').textContent, mons: el.querySelectorAll('[data-card-foe-mon]').length, prefer: !!el.querySelector('[data-card-foe-prefer]'), note: el.querySelector('[data-card-foe-deck-note]').textContent, text: el.innerText, clipped };
          });
          if (!r) { bad.push(`${who}: 型の欄が出ない`); continue; }
          if (WANT[who] && r.label !== WANT[who]) bad.push(`${who}: 型が ${r.label}(${WANT[who]} のはず)`);
          if (r.mons !== 1) bad.push(`${who}: 好きなモンスターが ${r.mons}体`);
          if (r.prefer !== (who === 'atsu' && lv === 'hard')) bad.push(`${who} ${lv}: よく使うカードの出かたが違う`);
          if (lv === 'easy' && !/^EASY: .*気分/.test(r.note)) bad.push(`${who} EASY: ${r.note}`);
          if (lv === 'hard' && !/^HARD: 残りの2体は、型に合う子/.test(r.note)) bad.push(`${who} HARD: ${r.note}`);
          if (r.clipped.length) bad.push(`${who}: 字が切れている(${r.clipped.join('・')})`);
          if (/[0-9０-９]/.test(r.text.replace(/[1-4]体|第[0-9]弾/g, ''))) bad.push(`${who}: 数字を出している(${(r.text.replace(/[1-4]体|第[0-9]弾/g, '').match(/.{0,8}[0-9０-９].{0,8}/) || [''])[0]})`);
        }
      }
      // ⑤ 強さのボタン(EASY〜MASTER)が、送らなくても全部見える(下の「対戦する」の帯に潜らない。2026-10-25 社長の実機で下半分が切れていた)
      const lv = await page.evaluate(async () => {
        const out = [];
        for (const who of [...document.querySelectorAll('[data-card-foe]')].map((b) => b.getAttribute('data-card-foe'))) {
          document.querySelector(`[data-card-foe="${who}"]`).click();
          await new Promise((r) => setTimeout(r, 120));
          document.querySelectorAll('[data-card-top="foe"] .mh-scroll, [data-card-top="foe"] [class*="overflow-y-auto"]').forEach((el) => { el.scrollTop = 0; });
          await new Promise((r) => setTimeout(r, 80));
          // 画面の外に出ていない・「対戦する」の帯と重なっていない(横の画面は帯が左の列にあるので、重なりで見る)
          const start = document.querySelector('[data-card-start]');
          const f = start ? start.closest('div').getBoundingClientRect() : null;
          const over = (r) => f && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top + 0.5;
          const hidden = [...document.querySelectorAll('[data-card-level]')].filter((b) => { const r = b.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight + 0.5 || over(r); }).map((b) => b.getAttribute('data-card-level'));
          if (hidden.length) out.push(`${who}: ${hidden.join('・')}`);
        }
        return out;
      });
      check(`⑤ ${w}×${h}: どの助手を選んでも、強さのボタンが送らずに全部見える(「対戦する」の帯に潜らない)`, lv.length === 0, lv.slice(0, 3).join(' / '));
      check(`①〜④ ${w}×${h}: 助手${foes.length}人の型・好きなモンスター・よく使うカード・強さの組み方が切れずに出る`, foes.length >= 6 && bad.length === 0, bad.slice(0, 4).join(' / '));
      if (SHOT && w === 390 && h === 844) {
        await page.click('[data-card-foe="atsu"]'); await page.click('[data-card-level="easy"]'); await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelector('[data-card-foe-style]').scrollIntoView({ block: 'end' }));
        fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'foe-style-390.png') });
        await page.click('[data-card-foe="dra"]'); await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOT, 'foe-style-390-dra.png') });
      }
      await context.close();
    }
    // ⑥ 紹介欄の立ち絵の大きさ。data-card-art-h(絵の透明でない所の高さ)が、欄の高さと合うか
    const art = (page) => page.evaluate(() => {
      const el = document.querySelector('[data-card-top="foe"] [data-card-assistant-art]');
      if (!el) return null;
      const img = el.querySelector('img');
      return { boxH: el.clientHeight, artH: Number(el.getAttribute('data-card-art-h') || 0), known: el.getAttribute('data-card-art-known') === '1', src: img ? img.getAttribute('src') : '' };
    });
    const waitArt = async (page) => {
      await page.waitForFunction(() => { const el = document.querySelector('[data-card-top="foe"] [data-card-assistant-art]'); return el && el.clientHeight > 0 && el.getAttribute('data-card-art-h') && Math.abs(Number(el.getAttribute('data-card-art-h')) - el.clientHeight) <= 2; }, null, { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(120);
      return art(page);
    };
    const fits = (a) => !!a && a.boxH > 0 && Math.abs(a.artH - a.boxH) <= 2;
    const show = (a) => (a ? `欄${a.boxH}px・絵${a.artH}px${a.known ? '・測った輪郭' : ''}` : 'なし');
    for (const mode of ['', 'canvasFail', 'costume']) {
      VIEW = { width: 390, height: 664 };
      const { context, page } = await open(false, mode);
      await enterCard(page);
      await page.click('[data-card-cpu]');
      await page.click('[data-card-mode-assistant]');
      await page.waitForSelector('[data-card-top="foe"]', { timeout: 8000 });
      await page.click('[data-card-foe="kiki"]');
      const kiki = await waitArt(page);
      await page.click('[data-card-foe="mua"]');
      const mua = await waitArt(page);
      const name = mode === 'canvasFail' ? '画素を読めない端末' : mode === 'costume' ? 'ハロウィンの服' : 'ふつう';
      if (mode === 'costume') {
        check(`⑥ ${name}: 着替えの服には標準の服の輪郭を当てず、絵の高さが欄に合う`, /halloween/.test(mua && mua.src) && !mua.known && fits(mua), show(mua));
      } else {
        check(`⑥ ${name}: きき→みゅあに替えても、みゅあの標準の服の立ち絵が欄の高さに合う(測った輪郭を使う)`, fits(mua) && mua.known, `きき ${show(kiki)} / みゅあ ${show(mua)}`);
        // ききも標準の服の絵なので、画素を読めない端末でも測った輪郭で合う(2026-10-26 助手全員の表 card-art-box-build)
        check(`⑥ ${name}: ききの立ち絵も欄の高さに合う${mode ? '(測った輪郭を使う)' : ''}`, fits(kiki) && (!mode || kiki.known), show(kiki));
        if (mode === 'canvasFail') {
          const all = [];
          for (const who of await page.evaluate(() => [...document.querySelectorAll('[data-card-foe]')].map((b) => b.getAttribute('data-card-foe')))) {
            await page.click(`[data-card-foe="${who}"]`);
            const r = await waitArt(page);
            if (!fits(r) || !r.known) all.push(`${who} ${show(r)}`);
          }
          check(`⑥ ${name}: どの助手を選んでも、標準の服の立ち絵が欄の高さに合う`, all.length === 0, all.join(' / '));
          await page.click('[data-card-foe="mua"]');
          await waitArt(page);
        }
        await page.setViewportSize({ width: 340, height: 600 });
        const narrow = await waitArt(page);
        check(`⑥ ${name}: 狭い縦画面(340×600)に変えても合う`, fits(narrow), show(narrow));
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(500);
        await page.setViewportSize({ width: 390, height: 664 });
        const back = await waitArt(page);
        check(`⑥ ${name}: 横向き→縦向きに戻したあとも合う`, fits(back), show(back));
      }
      if (SHOT && !mode) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'foe-art-mua-390.png') }); }
      await context.close();
    }
    check('どこでも実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
