const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// EXの通し検査(2026-10-06): 全24体(2026-10-06 ゴースト・スプーキーを足した)で「EXを使う→カードを切る→ターンが進む(または敵を倒してWAVEクリア)」を実際のブラウザで通し、
// ページのエラーや進行の止まりが無いかを見る。時間がかかるので EX_SMOKE=1 を付けたときだけ回る。
// 設計の正本: docs/spec/TACTICS_EX_SKILLS.md
//
// EXの通し検査: 全モンスターで「EXを使う→カードを切る→ターンが進む」を通し、ページのエラーや止まりが無いかを見る
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
  // 全24体を順に通すので30分以上かかる。ふだんの検査(run-checks)では回さず、EXをいじったあとに手で回す: EX_SMOKE=1 node tools/mode/tactics-ex-turn-smoke-check.js
  if (!process.env.EX_SMOKE) { console.log('SKIP: 時間がかかるので EX_SMOKE=1 を付けたときだけ回します'); process.exit(0); }
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
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Plant','Ark','Iblis','Yggdrasil','MelWhip','Zan','Eiki','Mitarashi','Ghost','Spooky']));
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

    const startWith = async (name) => {
      await boot();
      await closePopups();
      await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.waitForTimeout(600);
      await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
      const r = await startTacticsPro(name);
      check(`${name}を勇者モンにしてタクティクスプロを始められる`, r === 'ok', r);
      if (r !== 'ok') throw new Error(r);
      return heroSlot();
    };
    const names = ['モノリス', 'モッチー', 'ミタラシ', 'エイキ', 'ザン', 'アーク', 'イブリース', 'ピクシー', 'ミーア', 'スネグーラチカ', 'ウンディーネ', 'ヤオビクニ', 'パンドラ', 'ゴーレム', '剣士モッチー', 'ユグドラシル', 'メルホイップ', 'ライガー', 'プラント', 'オボロゲソウ', 'スエゾー', 'ハム', 'ゴースト', 'スプーキー'];
    const turnOf = async () => { const m = (await text()).match(/TURN\s*(\d+)\s*\/\s*20/i); return m ? Number(m[1]) : null; };
    for (const nm of names) {
      const e0 = errors.length;
      let note = '';
      try {
        const sl = await startWith(nm);
        await page.waitForTimeout(1800);
        const t0 = await turnOf();
        await tapSlot(sl);
        const used = await page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-use]'); return !!b && !b.disabled; });
        if (used) {
          await page.locator('[data-tactics-ex-use]').click();
          await page.waitForTimeout(500);
          // 味方を選ぶ・スタイルを選ぶEXは、1つ目の選択肢を押す
          const pick = page.locator('[data-tactics-ex-target], [data-tactics-ex-choice]:not([disabled])').first();
          if (await pick.count()) { await pick.click().catch(() => {}); }
          await page.waitForTimeout(1500);
        } else note += ' EXボタンが押せない';
        await page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-panel] button:last-of-type'); });
        await closePanel().catch(() => {});
        // 攻撃カード(または使えるカード)を2枚まで選んで、ターンを進める
        const cards = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].map((c, i) => [i, c.getAttribute('data-card-type'), c.getAttribute('data-card-usable')]));
        const idx = cards.filter(c => /^atk$|range_atk/.test(c[1] || '') && c[2] === 'true').map(c => c[0]).slice(0, 2);
        for (const k of idx) { await page.locator('[data-hand-card]').nth(k).click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(450); }
        const sel = await selectedCount();
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Action|ターンを進める/i.test(x.textContent) && !x.disabled); if (b) b.click(); });
        let t1 = t0;
        for (let k = 0; k < 40; k += 1) { await page.waitForTimeout(500); t1 = await turnOf(); if (t1 != null && t0 != null && t1 > t0) break; }
        const advanced = t1 != null && t0 != null && t1 > t0;
        let tail = ''; if (!advanced) tail = (await text()).slice(0, 140);
        const gameOver = /ゲームオーバー|GAME OVER|クリア|CLEAR|リザルト|WAVE\s*2/i.test(await text());
        const errs = errors.slice(e0);
        check(`${nm}: EXを使って、カードを${sel}枚切って、ターンが進む`, errs.length === 0 && (advanced || gameOver), `使えた=${used} ターン ${t0}→${t1}${note}${tail ? ' 画面: ' + tail : ''}${errs.length ? ' エラー:' + errs[0].slice(0, 160) : ''}`);
      } catch (err) {
        check(`${nm}: EXを使って1ターン進める`, false, String(err).slice(0, 200));
      }
    }
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
