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
//   ④ 字が切れていない(1行のままの字が箱からはみ出さない)・数字(重みや勝率)を出していない(「1体」〜「4体」「第1弾」だけは数として出す)
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
  const open = async (withAuto) => {
    const context = await browser.newContext({ viewport: VIEW });
    const page = await context.newPage();
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.addInitScript(seed(withAuto));
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
