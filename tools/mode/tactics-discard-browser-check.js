const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスバトルの「手札を捨てる」(2026-10-05 ユーザー指示)を、実際のブラウザで確かめる。
//   node tools/mode/tactics-discard-browser-check.js
//
// カードをつかむと、敵側に「捨てる」エリア・味方側に「アクション」エリアが薄く出る。
// 敵側へ離すと捨てる札になり(行動回数を1つ使う)、捨てる札をタップすると取り消せる。
// Action で実行すると、捨てた枚数ぶん手札が引き直され、ターンが進む。
// ガッツ回復の式(捨てた枚数×各自の最大の5%)は tactics-discard-check.js が確かめる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8996;
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
      // 剣士モッチー(円盤石で解放するレア)も勇者モンに選べるようにする。検査のまっさらなデータだけの話
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora']));
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
      const hero = await page.evaluate((name) => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent
          && x.textContent.trim().replace(/^前回/, '') === name && !/DEBUG/.test(x.textContent)); // 勇者えらびは顔アイコンのグリッド。タイルの文字は名前だけ(上の絞り込みタブは名前+数、前回使った子には「前回」が付く)
        if (b) b.click(); return !!b;
      }, heroName);
      if (!hero) return `勇者モンに ${heroName} が並んでいない: ` + await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>x.textContent.trim().slice(0,30)).join(' | ').slice(0,1500));
      // 顔アイコンのグリッドは、タイルを押すと下の詳細パネルが開き、「この子で挑む」で確定する
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /^この子で挑む$/.test(x.textContent.trim()));
        if (b) b.click();
      });
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

    await boot();
    await closePopups();
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const started = await startTacticsPro('ゴーレム');
    check('デバッグのバトルモードからタクティクスプロを始められる', started === 'ok', started);
    if (started === 'ok') {
      await page.waitForTimeout(1500);
      const actionCards = () => page.evaluate(() => {
        const m = document.body.innerText.match(/Action Cards\s*(\d+)\/(\d+)/i);
        return m ? { used: Number(m[1]), limit: Number(m[2]) } : null;
      });
      const handCount = () => page.locator('[data-hand-card]').count();
      const before = await handCount();
      const limit0 = await actionCards();
      check('最初は捨てる札が無く、行動回数も使っていない', await page.locator('[data-card-discard]').count() === 0 && limit0 && limit0.used === 0, JSON.stringify(limit0));
      // 手札の1枚目をつかんで、敵側のエリアへ離す
      const dragTo = async (cardIdx, where) => {
        const card = page.locator('[data-hand-card]').nth(cardIdx);
        const cb = await card.boundingBox();
        const target = await page.evaluate((w) => {
          const slots = [...document.querySelectorAll('[data-slot-index]')].map(e => e.getBoundingClientRect());
          const top = Math.min(...slots.map(r => r.top));
          return w === 'enemy' ? { x: window.innerWidth / 2, y: Math.max(60, top - 60) } : { x: slots[0].left + slots[0].width / 2, y: slots[0].top + slots[0].height / 2 };
        }, where);
        await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
        await page.mouse.down();
        await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2 - 40, { steps: 4 });
        await page.mouse.move(target.x, target.y, { steps: 10 });
        await page.waitForTimeout(250);
        return target;
      };
      await dragTo(0, 'enemy');
      const zones = await page.evaluate(() => ({
        layer: !!document.querySelector('[data-discard-zones]'),
        text: (document.querySelector('[data-discard-zones]')?.textContent || '').replace(/\s+/g, ' '),
        hover: document.querySelector('[data-discard-zone]')?.getAttribute('data-hover'),
      }));
      check('カードをつかんでいるあいだ、捨てる・アクションの2つのエリアが出る', zones.layer && /捨てる/.test(zones.text) && /アクション/.test(zones.text), zones.text.slice(0, 80));
      check('敵側の上へ来たら捨てるエリアが濃くなる', zones.hover === 'true', String(zones.hover));
      await page.mouse.up();
      await page.waitForTimeout(400);
      check('離したらエリアの表示が消える', await page.locator('[data-discard-zones]').count() === 0);
      check('敵側へ離したカードに「捨てる」の印が付く', await page.locator('[data-card-discard]').count() === 1);
      const afterDrop = await actionCards();
      check('捨てる札も行動回数を1つ使う', afterDrop && afterDrop.used === 1, JSON.stringify(afterDrop));
      // 捨てる札をタップすると取り消せる
      await page.locator('[data-hand-card]').nth(0).click({ force: true });
      await page.waitForTimeout(300);
      check('捨てる札をタップすると取り消せる', await page.locator('[data-card-discard]').count() === 0 && (await actionCards()).used === 0);
      // 味方側へ離しても捨てない
      await dragTo(0, 'ally');
      await page.mouse.up();
      await page.waitForTimeout(400);
      check('味方側へ離したカードは捨てずに使う札になる', await page.locator('[data-card-discard]').count() === 0);
      // 選んだカードをそのまま敵側へ運ぶと、使う札から捨てる札へ替わる
      await page.evaluate(() => {});
      await dragTo(0, 'enemy');
      await page.mouse.up();
      await page.waitForTimeout(400);
      check('使う札にしたカードも、敵側へ運べば捨てる札に替わる', await page.locator('[data-card-discard]').count() === 1 && (await actionCards()).used === 1, JSON.stringify(await actionCards()));
      // Action で実行 → ターンが進み、手札が元の枚数へ引き直される
      // ドラッグを離した直後(500ms)のクリックは、画面が「引きずりの余波のクリック」として捨てる。その時間が過ぎてから押す
      await page.waitForTimeout(700);
      const act = page.locator('[data-battle-action]');
      check('捨てる札だけでも Action が押せる', await act.isEnabled());
      await act.click();
      let turn2 = false;
      // 敵の番の演出が長いので、進むまで見張って、上限だけ決める(60秒)
      for (let k = 0; k < 120; k += 1) {
        if (/TURN 2\/20/.test(await text())) { turn2 = true; break; }
        await page.waitForTimeout(500);
      }
      check('実行するとターンが進む', turn2);
      await page.waitForTimeout(1500);
      check('捨てたぶん手札が引き直されて、元の枚数に戻る', await handCount() === before, `${before} → ${await handCount()}`);
      check('次のターンは捨てる札も行動回数も持ち越さない', await page.locator('[data-card-discard]').count() === 0 && (await actionCards()).used === 0);
    }
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
