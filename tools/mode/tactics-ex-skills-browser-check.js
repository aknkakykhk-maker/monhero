const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクス専用 EXスキル(STEP1: 共通基盤)を、実際のブラウザで操作して確かめる。
// 設計の正本: docs/spec/TACTICS_EX_SKILLS.md
//
//   node tools/mode/tactics-ex-skills-browser-check.js
//
// 公開前(TACTICS_EX_SKILLS_RELEASE=false)は、デバッグのバトルモード入口からだけ出る。
// ① ゴーレムを勇者モンにしてタクティクスプロを始める
//    距離枠をタップ → 詳細が開く(発動はしない) → 使用 → 残り 3→2 → カードを選べない
//    → 「ターンを進める」で敵の番へ → 次のターンはカードを選べる
// ② あきらめて、モノリスで新しいランを始める
//    残りが 3/3 から始まる(前のランの回数を持ち越さない) → 使っても同じターンにカードを選べる
// ③ 本番の入口(デバッグでない)のタクティクスプロでは、距離枠をタップしても何も開かない
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
const released = /const TACTICS_EX_SKILLS_RELEASE = true/.test(
  fs.readFileSync(path.join(root, 'monster-hero/src/parts/10-core.jsx'), 'utf8'));

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
    });
    // ★ランキングへは何も送らない(本番の入口でも途中で読み込み直すだけで、降参しない)
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

    // 難易度えらび → 勇者モン(名前で名指し) → 配置 → アシストカード → バトル
    // ★見つからなければその場で止める(押せるものを押して進めない。設計 11.2)
    const startTacticsPro = async (heroName) => {
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
      const hero = await page.evaluate((name) => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent
          && /HP\s*\d+/.test(x.textContent) && x.textContent.trim().startsWith(name) && !/DEBUG/.test(x.textContent));
        if (b) b.click(); return !!b;
      }, heroName);
      if (!hero) return `勇者モンに ${heroName} が並んでいない: ` + await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>x.textContent.trim().slice(0,30)).join(' | ').slice(0,1500));
      await page.waitForTimeout(1200);
      // 供モン候補5体は「変更」→ 一覧から1体ずつ選ぶ(勇者モンと同じ子は選ばない)
      await page.evaluate(() => { window.__change = 1; });
      for (let i = 0; i < 40; i += 1) {
        if (/WAVE 1\/10/.test(await text())) break;
        const step = await page.evaluate((heroName) => {
          const live = [...document.querySelectorAll('button')].filter(x => !x.disabled && x.offsetParent);
          const pick = (re) => live.find(x => re.test(x.textContent.trim()));
          const go = pick(/出撃|バトル開始|この編成で|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
          const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
          const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
          const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
          const mons = live.filter(x => /HP\s*\d+/.test(x.textContent) && !x.textContent.trim().startsWith(heroName)
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
    // 手札のカードを1枚タップして、選べたか(選択中の枚数が増えたか)
    const selectedCount = () => page.evaluate(() => {
      const m = document.body.innerText.match(/Action Cards\s*(\d+)\/(\d+)/i);
      return m ? Number(m[1]) : null;
    });
    // ★手札は抽選なので、先頭のカードがガッツ不足のこともある。「いま使えるカード」を選ぶ
    //   (併用できないEXのターンは全部使えなくなるので、そのときは先頭を押して選べないことを見る)
    let tappedCard = 0;
    const tapFirstCard = async () => {
      const idx = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        // 攻撃カードは「通常技のえらび直し」が開いて枠を覆うことがあるので、守り・支援を先に選ぶ
        const usable = (c) => c.getAttribute('data-card-usable') === 'true';
        let i = cards.findIndex(c => usable(c) && !/atk|unique/.test(c.getAttribute('data-card-type') || ''));
        if (i < 0) i = cards.findIndex(usable);
        return i < 0 ? 0 : i;
      });
      tappedCard = idx;
      await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(700);
      // 通常技のえらび直しが開いたら、いま使っている技をそのまま選んで閉じる
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /\(使用中\)/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(500);
    };
    const unselectAll = async () => {
      for (let k = 0; k < 4; k += 1) {
        const n = await selectedCount();
        if (!n) return;
        // tapFirstCard で選んだ1枚をもう一度押すと外れる
        await page.locator('[data-hand-card]').nth(tappedCard).click({ timeout: 10000, force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    };

    // --- ③ 本番の入口では出ない(公開前だけ見る) ---
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const pub = await startTacticsPro('ゴーレム');
    check('本番の入口からタクティクスプロ(ゴーレム)を始められる', pub === 'ok', pub);
    if (pub === 'ok') {
      const s = await heroSlot();
      const marks = await page.locator('[data-tactics-ex-mark]').count();
      const intro = await page.locator('[data-tactics-ex-intro]').count();
      if (released) check('公開後は、EXを持つ子がいる最初のバトルで使い方案内が出る', intro === 1);
      else check('公開前は使い方案内も出さない', intro === 0);
      await tapSlot(s);
      const p = await panel();
      if (released) {
        check('公開後は本番でも距離枠からEXを開ける', !!p && marks > 0);
        check('距離枠から自分で開けたら、使い方案内は閉じる', await page.locator('[data-tactics-ex-intro]').count() === 0);
      }
      else check('公開前は、本番のタクティクスで距離枠をタップしてもEXが開かず、EXの印も出ない', !p && marks === 0, `枠${s}`);
      await closePanel();
    }
    // デバッグ戦を降参してHOMEへ戻る(デバッグ戦は記録もランキングも残らない)
    const giveUp = async () => {
      await page.locator('[data-battle-menu-button]').dispatchEvent('click');
      await page.waitForTimeout(400);
      await page.locator('[data-battle-quit]').dispatchEvent('click');
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.trim() === '降参する');
        if (b) b.click();
      });
      await page.waitForTimeout(1500);
      for (let k = 0; k < 8; k += 1) {
        if (await page.getByRole('button', { name: 'モンヒロバトル' }).count() > 0
          && await page.getByRole('button', { name: 'モンヒロバトル' }).first().isVisible().catch(() => false)) return true;
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /^トップへ$|HOME|ホーム|閉じる|OK|次へ/.test(x.textContent.trim()));
          if (b) b.click();
        });
        await page.waitForTimeout(1000);
      }
      console.log('  (HOMEへ戻れなかった画面) ' + (await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>(x.disabled?'[x]':'')+x.textContent.trim().slice(0,24)).join(' | '))).slice(0, 800));
      return false;
    };
    // 本番のランは降参せず(記録が残るため)、読み込み直して捨てる
    await boot();
    await closePopups();

    // --- ① デバッグのバトルモード入口から、ゴーレムで始める ---
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const dbg = await startTacticsPro('ゴーレム');
    check('デバッグのバトルモードからタクティクスプロ(ゴーレム)を始められる', dbg === 'ok', dbg);
    if (dbg !== 'ok') throw new Error(dbg);
    const gSlot = await heroSlot();
    check('ゴーレムの枠にEXの印が出る', await page.locator(`[data-tactics-ex-mark="${gSlot}"]`).count() === 1, `枠${gSlot}`);
    // ★名前の行へ札を入れると名前が切れる(2026-09-23 ユーザー指摘「名前が切れてる」)。
    //   EXの札は枠の中の縦積みへ入れ、名前の行は今までどおり名前だけにする
    const nameCut = await page.evaluate((slot) => {
      const b = document.querySelector(`button[data-slot-index="${slot}"]`);
      const row = b && b.querySelector('.truncate');
      return row ? { text: row.textContent, cut: row.scrollWidth > row.clientWidth + 1, exInRow: !!row.parentElement.querySelector('[data-tactics-ex-mark]') } : null;
    }, gSlot);
    check('EXの札は名前の行に入らない(名前を押し出さない)', !!nameCut && !nameCut.exInRow, JSON.stringify(nameCut));
    check('使う前の札は「EX」', await page.locator(`[data-tactics-ex-mark="${gSlot}"]`).getAttribute('data-tactics-ex-state') === 'EX');
    // 空いている枠(EXを持つ子がいない)をタップしても何も開かない
    const empty = [0, 1, 2, 3].find(i => i !== gSlot);
    await tapSlot(empty);
    check('子のいない枠をタップしてもEXは開かない', (await panel()) === null);
    await tapSlot(gSlot);
    let p = await panel();
    check('距離枠をタップすると、その子のEX詳細が開く', !!p && p.slot === gSlot && p.mon.includes('ゴーレム') && p.name === '捨て身',
      JSON.stringify(p));
    check('詳細に 残り回数/最大・併用可否・効果時間・力と丈夫さ が出る', !!p && /3 \/ 3/.test(p.uses) && p.withCards === 'no'
      && /WAVE/.test(p.text) && p.dev === !released && /220／150/.test(p.text), p && p.text.slice(0, 200));
    check('使用ボタンが狭いiPhoneの画面の中に収まる', !!p && p.useBottom != null && p.useBottom <= p.vh, p && `${p.useBottom}/${p.vh}`);
    // ★詳細は画面の真ん中に出すカード(2026-09-23 ユーザー指摘「枠のサイズ感おかしくない？」)。
    //   横幅いっぱいだと枠線が画面の端で切れ、下の余白が二重になってボタンの下が大きく空いていた
    const card = await page.evaluate(() => {
      const c = document.querySelector('[data-tactics-ex-card]');
      const u = document.querySelector('[data-tactics-ex-use]');
      if (!c || !u) return null;
      const r = c.getBoundingClientRect(), b = u.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), gapBelowButton: Math.round(r.bottom - b.bottom) };
    });
    check('詳細のカードは左右に余白があり、ボタンの下が空きすぎない', !!card && card.left >= 12 && card.right >= 12 && card.gapBelowButton <= 24,
      JSON.stringify(card));
    if (process.env.EX_SHOT) await page.screenshot({ path: process.env.EX_SHOT });
    await closePanel();
    check('タップしただけでは発動しない(閉じても回数は減らず、カードも選べる)', await (async () => {
      await tapSlot(gSlot);
      const q = await panel(); await closePanel();
      return !!q && /3 \/ 3/.test(q.uses);
    })());
    // カードを選んでいると、併用できないEXは使えない
    await tapFirstCard();
    const picked = await selectedCount();
    await tapSlot(gSlot);
    p = await panel();
    // カードの置き先を選んでいる途中なら枠のタップはカードの操作になるので、そのときは詳細が開かない
    check('カードを選んでいると、併用できないEXの使用ボタンは押せない(または置き先の操作が優先)',
      picked > 0 && (p === null || (!p.canUse && /カード/.test(p.why))), p ? p.why : `選択${picked}枚・パネルなし`);
    await closePanel();
    await unselectAll();
    check('カードの選択を外せた', (await selectedCount()) === 0);
    const cardLimitBefore = await page.evaluate(() => (document.body.innerText.match(/Action Cards\s*\d+\/(\d+)/i) || [])[1]);
    await tapSlot(gSlot);
    p = await panel();
    check('カードを選んでいなければ使用ボタンが押せる', !!p && p.canUse, p && p.why);
    await page.locator('[data-tactics-ex-use]').click();
    await page.waitForTimeout(600);
    check('使用するとパネルが閉じる', (await panel()) === null);
    await tapSlot(gSlot);
    p = await panel();
    check('使うと残りが 3→2 に減る', !!p && /2 \/ 3/.test(p.uses), p && p.uses);
    if (released) check('捨て身: 力220/丈夫さ150 → 力295/丈夫さ0 になる', !!p && /295／0/.test(p.text), p && p.text.slice(0, 220));
    await closePanel();
    check('効いているあいだは枠の札が「捨て身中」になる', await page.locator(`[data-tactics-ex-mark="${gSlot}"]`).getAttribute('data-tactics-ex-state') === '捨て身中');
    // ステータス画面(HERO SCAN)にも、戦闘で使う値で出る(2026-09-23 ユーザー指示)
    await page.locator('button[aria-label="勇者モンのステータス"]').dispatchEvent('click');
    await page.waitForTimeout(600);
    const scan = await page.evaluate((slot) => {
      const row = document.querySelector(`[data-tactics-status-slot="${slot}"]`);
      if (!row) return null;
      const t = (k) => (row.querySelector(`[data-tactics-status-stat="${k}"]`)?.textContent || '').trim();
      return { atk: t('atk'), def: t('def'), ex: (row.querySelector('[data-tactics-status-ex]')?.textContent || '').trim() };
    }, gSlot);
    check('ステータス画面にも 力295(元220)・丈夫さ0(元150)・EXの状態が出る', !!scan && /^295/.test(scan.atk) && /元220/.test(scan.atk)
      && /^0/.test(scan.def) && /元150/.test(scan.def) && /捨て身/.test(scan.ex) && /効果中/.test(scan.ex), JSON.stringify(scan));
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '戻る' && x.offsetParent); if (b) b.click(); });
    await page.waitForTimeout(500);
    await tapSlot(gSlot);
    p = await panel();
    check('同じターンにもう一度は使えない', !!p && !p.canUse, p && p.why);
    await closePanel();
    const cardLimitAfter = await page.evaluate(() => (document.body.innerText.match(/Action Cards\s*\d+\/(\d+)/i) || [])[1]);
    check('EXは通常カードの使用枚数を消費しない(上限の数が変わらない)', cardLimitBefore === cardLimitAfter, `${cardLimitBefore}→${cardLimitAfter}`);
    const usableAfterLock = await page.evaluate(() => document.querySelectorAll('[data-hand-card][data-card-usable="true"]').length);
    await tapFirstCard();
    // WAVE1 は盤面がゴーレム1体だけなので、使った子が止まる＝カードを出せる子がいない
    check('併用できないEXを使った子(ゴーレム1体だけの盤面)はカードを選べない', (await selectedCount()) === 0 && usableAfterLock === 0, `使えるカード${usableAfterLock}枚`);
    const blockBand = await page.evaluate(() => [...document.querySelectorAll('[data-tactics-card-block]')].some(x => /EX/.test(x.textContent)));
    check('使えない理由(EX使用)がカードに出る', blockBand);
    // ★止まるのはEXを使った子のカードだけ(2026-09-23 ユーザー指示)。緊急回復は止めない
    check('緊急回復は押せる(止まるのは使った子のカードだけ)', !(await page.locator('button[aria-label="緊急回復"]').isDisabled()));
    const pass = page.locator('[data-tactics-ex-pass]');
    check('「ターンを進める」が出る', await pass.count() === 1);
    await pass.click();
    for (let k = 0; k < 30; k += 1) {
      if (/TURN 2\/20/.test(await text())) break;
      await page.waitForTimeout(500);
    }
    check('「ターンを進める」で敵の番が進み、2ターン目になる', /TURN 2\/20/.test(await text()), (await text()).slice(0, 80));
    await tapFirstCard();
    check('次のターンはカードを選べる', (await selectedCount()) > 0);
    await unselectAll();
    await tapSlot(gSlot);
    p = await panel();
    // ★捨て身は「効果が続いているあいだは使えない」(同じWAVEのあいだは丈夫さがもう0なので、回数だけ減るのを防ぐ)
    check('次のターンも同じWAVEなら、捨て身は効果中なので使えない(2/3のまま減らない)', !!p && !p.canUse && /2 \/ 3/.test(p.uses) && /効果/.test(p.why), p && `${p.uses} ${p.why}`);
    await closePanel();

    // --- ② あきらめて、モノリスで新しいランを始める ---
    check('デバッグのバトルからHOMEへ戻れる', await giveUp());
    await closePopups();
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const dbg2 = await startTacticsPro('モノリス');
    check('新しいラン(モノリス)を始められる', dbg2 === 'ok', dbg2);
    if (dbg2 !== 'ok') throw new Error(dbg2);
    const mSlot = await heroSlot();
    await tapSlot(mSlot);
    p = await panel();
    check('モノリスのEX「みんなをかばう」: 3/3・通常カードと併用できる', !!p && p.name === 'みんなをかばう' && /3 \/ 3/.test(p.uses) && p.withCards === 'yes',
      p && p.text.slice(0, 120));
    await page.locator('[data-tactics-ex-use]').click();
    await page.waitForTimeout(600);
    await tapSlot(mSlot);
    p = await panel();
    check('モノリスも使うと 3→2', !!p && /2 \/ 3/.test(p.uses), p && p.uses);
    await closePanel();
    await tapFirstCard();
    check('併用できるEXを使ったターンでも、通常カードを選べる', (await selectedCount()) > 0);
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
