const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトル画面で「文字が文字の上に乗っていないか」を、実際のブラウザで測る。
//
//   node tools/battle/battle-text-cover-check.js
//
// 【なぜ道具にするか】
// 重なっても例外は出ない。実機で遊んで目で見つけるまで分からないのに、同じ形で何度も起きている。
//   2026-09-22 ユーザー指摘「1番の枠だけ名前が予想ダメージのバッジに隠れる」
//   2026-09-22 ユーザー指摘「表示が被ってて見えない」「こういうとこが多い」
// どちらも原因は同じで、**別々の札を「上からの距離」で避けていた**こと。
//   ・合計DMG は舞台の下から78%の位置へ浮かせていた → 枠の高さが変わると枠の名前へ乗る
//     (タクティクスはパーティのライフ帯が無いぶん枠が上がるので、必ず乗る)
//   ・枠の中の札は top-0 / top-[18px] / top-[21px] で避けていた → 札が2枚になる、
//     連撃で内訳が2行になる、といった「増える」場面で必ず重なる
// 決まった位置で避けるのをやめ、**縦積み・横並びで場所を分ける**形へ直した。
// この道具は、その形が崩れていないかを座標で見張る。
//
// 【測り方】
// ① タクティクスプロのバトルを実際に立ち上げる(既存モードと同じ経路を通る)
// ② 「自分で文字を持っている要素」だけを集め、総当たりで矩形の重なりを見る
//    入れ物どうしの重なりは数えない(親子・祖先は除く)。重なりが小さいほうの面積の
//    20%を超えたら「読めない」とみなす
// ③ カードを置く前・置いたあと・2枚目を置いたあと、と場面を変えて測る
//    (重なりは「増えたとき」に出るので、1場面だけ見ても意味がない)
//
// 【わざと重ねているもの】
// ・使えないカードの赤い札(枚数上限など)は、カードの絵の上に出す。絵は絵なので読めなくてよい。
//   文字の上には出ないことだけを見たいので、絵(data-decoration)との組は数えない。
// ・固有技セットのオーラの⚡も飾り。重ね順は文字より下にしてあり、同じく数えない。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8993;
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

// ページの中で走らせる「重なり探し」。ここだけは本体の都合を知らない汎用の測り方にしてある
const OVERLAP_FN = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none'
      && Number(st.opacity) > 0.05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const leaves = [...document.querySelectorAll('*')].filter((el) => {
    if (!visible(el)) return false;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    return own.length > 0;
  }).map((el) => ({ el, r: el.getBoundingClientRect(), t: el.textContent.trim().slice(0, 16),
    icon: !!el.closest('[data-decoration]') }));
  const out = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const A = leaves[i]; const B = leaves[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      // わざと絵の上へ出している札は数えない(絵は読むものではない)
      if (A.icon || B.icon) continue;
      const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (w <= 1 || h <= 1) continue;
      const area = w * h;
      const small = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      if (area / small < 0.2) continue;
      out.push(`「${A.t}」と「${B.t}」が ${Math.round((area / small) * 100)}% 重なる`);
    }
  }
  return out;
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i += 1) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      const b = [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ'));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled);
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    // 勇者モン → 配置 → 供モン候補5体 → アシストカード、とたどってバトルまで進める。
    // ★押すものは「その画面にしか無いもの」で選ぶ。とりあえず押せるものを押すと、
    //   戻るボタンを踏んで難易度選択まで戻ってしまう
    await page.evaluate(() => { window.__pick = 0; window.__change = 1; });
    for (let i = 0; i < 40; i += 1) {
      const state = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      if (/WAVE 1\/10/.test(state)) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|はじめる|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力/.test(x.textContent) && x.textContent.trim() !== '詳細を見る');
        if (mons.length) { const m = mons[Math.min(window.__pick, mons.length - 1)]; window.__pick += 1; m.click(); return 'mon'; }
        const changes = live.filter((x) => x.textContent.trim() === '変更');
        if (changes.length) { const c = changes[Math.min(window.__change, changes.length - 1)]; window.__change += 1; c.click(); return 'change'; }
        return null;
      });
      if (!step) break;
      await page.waitForTimeout(1000);
    }
    const inBattle = await page.evaluate(() => /WAVE 1\/10/.test(document.body.innerText));
    check('タクティクスのバトルが立ち上がる', inBattle);
    if (!inBattle) { console.log(`\n${failed}件のNGがあります`); await browser.close(); server.close(); process.exit(1); }

    // カードの詳細パネルは開いたままだと舞台を覆うので、測る前に必ず閉じる
    const closeDetail = async () => {
      for (let k = 0; k < 3; k += 1) {
        const open = await page.evaluate(() => /技威力:/.test(document.body.innerText));
        if (!open) return;
        await page.evaluate(() => {
          const panel = [...document.querySelectorAll('div')].find((d) => /技威力:/.test(d.textContent || '')
            && d.getBoundingClientRect().height > 60 && d.getBoundingClientRect().height < 200);
          if (panel) panel.click();
        });
        await page.waitForTimeout(400);
      }
    };
    // カードを1枚選んで、いちばん手前の枠へ置く
    const playCard = async (want) => {
      const idx = await page.evaluate((re) => [...document.querySelectorAll('[data-hand-card]')]
        .findIndex((c) => new RegExp(re).test(c.textContent)), want);
      if (idx < 0) return false;
      await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(700);
      // 通常技のえらび直しが開いたら、いま使っている技をそのまま選んで閉じる
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => !x.disabled && x.offsetParent && /\(使用中\)/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      await page.locator('[data-tactics-party-slot]').first().click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await closeDetail();
      return true;
    };

    const measure = async (label) => {
      const hits = await page.evaluate(OVERLAP_FN);
      check(`${label}：文字の上に文字が乗っていない`, hits.length === 0, hits.slice(0, 4).join(' / '));
    };

    await closeDetail();
    await measure('カードを置く前');
    check('カードを1枚置けた', await playCard('攻撃'));
    await measure('攻撃カードを1枚置いたあと');
    // 2枚目(守り)。上限1枚のときは置けないので、置けたときだけ測る
    if (await playCard('守り')) await measure('守りのカードも置いたあと');

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで測れた', false, String(e).slice(0, 160));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
