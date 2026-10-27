#!/usr/bin/env node
// キュービ・オリヒメ(公開前・下書き)を、デバッグのバトルモードで勇者モンにして、実際のタクティクスプロで戦わせて確かめる。
//
//   node tools/monster/kyubi-orihime-browser-check.js        (OUT=<フォルダ> を付けると写真も撮る)
//
// 【なぜ道具にするか】2体の勇者特性・EX・固有技の効果は、本体の分岐へ足してある(#4065 #4075 #4090 #4099 #4102)。
// 下書きのあいだは通常プレイに出ないので、壊れても誰も気づかない。デバッグの「試す用の写し」で実際に戦わせて、
// 九尾幻灯・煉獄・星合の刻・霊魂が出て、実行時エラーが出ないことを見る。
// 進め方(難易度→勇者モン→配置→アシスト→バトル)は tools/mode/tactics-ex-skills-browser-check.js から借りた。
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const { pickProParty } = require('../battle/lib/pro-party-pick');
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8994;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_tactics_intro_seen_v1', JSON.stringify(true));
      // HELL の公開(#2931)で、HOME に来た人へ1回だけお話と遊び方の説明が出る。画面全体を覆う窓なので、ほかの紹介と同じく見たことにしてから始める
      //   (2026-10-13: 下準備に無く、説明が開いたままバトルへ進んで、説明の動画が枠を押す邪魔をしていた。プレイヤーは閉じないと進めないので起きない)
      localStorage.setItem('mh_rhythm_hell_story_seen_v1', JSON.stringify(true));
      // 剣士モッチー(円盤石で解放するレア)も勇者モンに選べるようにする。検査のまっさらなデータだけの話
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Plant']));
    });
    // ★ランキングへは何も送らない(本番の入口でも途中で読み込み直すだけで、降参しない)
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
    await page.route(/supabase\.co/, (route) => route.abort());
    const boot = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    };
    await boot();
    const closePopups = async () => {
      for (let i = 0; i < 8; i += 1) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(300);
      }
    };
    await closePopups();
    const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    // 難易度選択 → 勇者モン(名前で名指し) → 配置 → アシストカード → バトル
    // ★見つからなければその場で止める(押せるものを押して進めない。設計 11.2)
    // heroStyle … 配置の画面で選ぶ初期スタイル(剣士モッチーのとき)
    const startTacticsPro = async (heroName, heroStyle = null) => {
      await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
      const opened = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
        const card = cards[Math.floor(cards.length / 2)] || cards[0];
        const b = card && [...card.querySelectorAll('button')].find(x => x.textContent.includes('難易度を選ぶ'));
        if (!b || b.disabled) return false;
        b.click(); return true;
      });
      if (!opened) return 'タクティクスプロの「難易度を選ぶ」が押せない';
      await page.waitForTimeout(1500);
      const go = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('この難易度で挑戦') && !x.disabled);
        if (b) b.click(); return !!b;
      });
      if (!go) return '「この難易度で挑戦」が押せない';
      await page.waitForTimeout(1500);
      // プロモードの編成: 枠へ入れてから勇者モンを選ぶ(tools/battle/lib/pro-party-pick.js)
      const proPickError = await pickProParty(page, heroName);
      if (proPickError) return proPickError;
      await page.waitForTimeout(1200);
      if (heroStyle) {
        const b = page.locator(`[data-hero-style="${heroStyle}"]`);
        if (await b.count() === 0) return `配置の画面に初期スタイル(${heroStyle})が出ない`;
        await b.click();
        await page.waitForTimeout(300);
        if (await b.getAttribute('aria-pressed') !== 'true') return `初期スタイル(${heroStyle})を選べない`;
      }
      // 供モン候補5体は「変更」→ 一覧から1体ずつ選ぶ(勇者モンと同じ子は選ばない)
      await page.evaluate(() => { window.__change = 1; });
      for (let i = 0; i < 40; i += 1) {
        if (/WAVE 1\/10/.test(await text())) break;
        const step = await page.evaluate((heroName) => {
          const live = [...document.querySelectorAll('button')].filter(x => !x.disabled && x.offsetParent);
          const pick = (re) => live.find(x => re.test(x.textContent.trim()));
          const go = pick(/出撃|バトル開始|この編成で|この子で挑む|供モン\d*にする|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
          const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
          const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
          const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
          const mons = live.filter(x => /ライフ\s*\d+/.test(x.textContent) && !x.textContent.trim().startsWith(heroName)
            && x.textContent.trim() !== '詳細を見る' && !/DEBUG/.test(x.textContent));
          if (mons.length) { mons[0].click(); return 'mon'; }
          const changes = live.filter(x => x.textContent.trim() === '変更');
          if (changes.length && window.__change < changes.length) { changes[window.__change].click(); window.__change += 1; return 'change'; }
          const start = pick(/はじめる|この子で/); if (start) { start.click(); return 'start'; }
          return null;
        }, heroName);
        if (!step) break;
        await page.waitForTimeout(900);
      }
      return /WAVE 1\/10/.test(await text()) ? 'ok' : `バトルまで進めない: ${(await text()).slice(0, 600)} || ` + await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>(x.disabled?'[x]':'')+x.textContent.trim().slice(0,24)).join(' | ').slice(0,1200));
    };
    // 勇者モンが立っている枠(WAVE1は1体だけ)
    const heroSlot = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button[data-slot-index]')].find(x => /[^-\s]/.test((x.textContent || '').replace(/---/g, '')) && x.querySelector('img'));
      return b ? Number(b.getAttribute('data-slot-index')) : null;
    });
    // ★行動中(敵の番の演出中)は枠が押せない。押せるようになるまで待ってから押す
    const tapSlot = async (i) => {
      const slot = page.locator(`button[data-slot-index="${i}"]`);
      for (let k = 0; k < 40 && await slot.isDisabled().catch(() => false); k += 1) await page.waitForTimeout(500);
      await slot.click({ timeout: 10000 }).catch(async (e) => {
        const why = await page.evaluate((n) => { const el = document.querySelector(`button[data-slot-index="${n}"]`); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `disabled=${el.disabled} 上にあるもの=${top && (top.outerHTML || '').slice(0, 200)}`; }, i);
        throw new Error(`枠${i}を押せない: ${why} / ${(await text()).slice(0, 200)}`);
      });
      await page.waitForTimeout(500);
    };
    const panel = () => page.evaluate(() => {
      const p = document.querySelector('[data-tactics-ex-panel]');
      if (!p) return null;
      const t = (sel) => (p.querySelector(sel)?.textContent || '').trim();
      const useBtn = p.querySelector('[data-tactics-ex-use]');
      return {
        slot: Number(p.getAttribute('data-tactics-ex-panel')), mon: t('[data-tactics-ex-mon]'), name: t('[data-tactics-ex-name]'),
        uses: t('[data-tactics-ex-uses]'), withCards: p.querySelector('[data-tactics-ex-with-cards]')?.getAttribute('data-tactics-ex-with-cards'),
        dev: !!p.querySelector('[data-tactics-ex-dev]'), why: t('[data-tactics-ex-why]'),
        canUse: !!useBtn && !useBtn.disabled, text: p.innerText.replace(/\s+/g, ' '),
        // スマホ縦で、使用ボタンが画面の中(ホームインジケーターより上)にあるか
        useBottom: useBtn ? useBtn.getBoundingClientRect().bottom : null, vh: window.innerHeight,
      };
    });
    const closePanel = async () => {
      await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click());
      await page.waitForTimeout(400);
    };
    const partyOf = (slot) => page.evaluate((sl) => {
      const el = document.querySelector(`[data-tactics-party-slot="${sl}"]`);
      return el ? { hp: el.getAttribute('data-tactics-hp'), guts: el.getAttribute('data-tactics-guts') } : null;
    }, slot);
    const startDebug = async (name) => {
      await boot(); await closePopups();
      await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
      await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
      const r = await startTacticsPro(name);
      check(`${name}を勇者モンにしてデバッグのタクティクスプロを始められる`, r === 'ok', r);
      if (r !== 'ok') throw new Error(r);
      return heroSlot();
    };
    const log = () => page.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
    const pass = async (n) => {
      const before = (await text()).match(/TURN (\d+)\/20/); const t0 = before ? Number(before[1]) : 0;
      const b = page.locator('[data-tactics-ex-pass]');
      if (await b.count()) await b.click(); else return false;
      for (let k = 0; k < 40; k += 1) { const m = (await text()).match(/TURN (\d+)\/20/); if (m && Number(m[1]) > t0) break; await page.waitForTimeout(500); }
      await page.waitForTimeout(1200); return true;
    };
    // --- キュービ ---
    const kSlot = await startDebug('キュービ');
    console.log('キュービの枠', kSlot);
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/kyubi-1-start.png' });
    await tapSlot(kSlot);
    let p = await panel();
    check('キュービのEXは「九尾幻灯」3/3・カードと併用できる・3ターン', !!p && p.name === '九尾幻灯' && /3 \/ 3/.test(p.uses) && p.withCards === 'yes', p && p.text.slice(0, 200));
    await page.locator('[data-tactics-ex-use]').click();
    await page.waitForTimeout(1500);
    const afterUse = await log();
    check('使うと狐火5/5の吹き出し', /狐火 5\/5/.test(afterUse), afterUse.slice(0, 160));
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/kyubi-2-ex.png' });
    const before = await partyOf(kSlot);
    // オートに切り替えて、しばらく戦わせ、出た吹き出し・ログの文字を拾う
    const seen = new Set();
    await page.getByRole('button', { name: /AUTO/ }).first().click({ timeout: 10000 }).catch(() => {});
    const end = Date.now() + 70000;
    while (Date.now() < end) {
      const t = await text();
      (t.match(/煉獄 \d+\/10|狐火の盾[^0-9]*\d*|狐火 \d\/5|狐火が戻った|陽炎ノ相[^ ]*|霊魂[^ ]*|TURN \d+\/20|WAVE \d+\/10/g) || []).forEach(x => seen.add(x));
      await page.waitForTimeout(200);
    }
    console.log('出た文字:', [...seen].join(' / '));
    check('キュービ(零に置く=煉獄ノ相)はカードを使うたびに煉獄が増え、WAVEをまたいでも残る', [...seen].some(x => /煉獄 [2-9]\/10/.test(x)), [...seen].join(' / '));
    console.log('ライフ', JSON.stringify(before), '→', JSON.stringify(await partyOf(kSlot)));
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/kyubi-3-auto.png' });
    await page.getByRole('button', { name: /AUTO/ }).first().click({ timeout: 10000 }).catch(() => {});
    // --- オリヒメ: 勇者にして、合流のたびに配置の画面へ「この子を相方にする」が出るか・逢瀬が増えるか ---
    const oSlot = await startDebug('オリヒメ');
    console.log('オリヒメの枠', oSlot);
    await tapSlot(oSlot);
    p = await panel();
    check('勇者のオリヒメのEXは「星合の刻」3/3', !!p && p.name === '星合の刻' && /3 \/ 3/.test(p.uses), p && p.text.slice(0, 160));
    await closePanel();
    const oSeen = new Set(); let partnerShot = false;
    await page.getByRole('button', { name: /AUTO/ }).first().click({ timeout: 10000 }).catch(() => {});
    const oEnd = Date.now() + 80000;
    while (Date.now() < oEnd) {
      const t = await text();
      (t.match(/この子を相方にする|が相方になった|逢瀬 \d+\/\d+|霊魂[^ ]*|星合[^ ]*|WAVE \d+\/10/g) || []).forEach(x => oSeen.add(x));
      if (!partnerShot && await page.locator('[data-orihime-partner-pick]').count()) {
        partnerShot = true;
        if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/orihime-1-partner.png' });
        await page.locator('[data-orihime-partner-pick]').click().catch(() => {});
        await page.waitForTimeout(300);
        if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/orihime-2-partner-on.png' });
      }
      await page.waitForTimeout(200);
    }
    console.log('オリヒメで出た文字(逢瀬はオートの動き次第なので合否に入れない):', [...oSeen].join(' / '));
    await page.getByRole('button', { name: /AUTO/ }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'ログ' }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    const logText = await text();
    console.log('ログの中:', (logText.match(/[^。 ]*(相方|逢瀬|星合|霊魂)[^。 ]*/g) || []).slice(0, 12).join(' / '));
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/orihime-4-log.png' });
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT + '/orihime-3-auto.png' });
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
