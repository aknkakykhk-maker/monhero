// スコアランキングの「◯◯ターンでクリア」「WAVE ◯ で終了」まわりを、
// Supabaseをスタブした実ブラウザで確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/ranking-run-stats-check.js
//
// 見たいのは次の2つ。
//   ① 列がある場合  … クリアの記録は「◯◯ターンでクリア」、途中で終わった記録は
//                      「WAVE ◯ で終了」、どちらも無い古い記録は何も出ない
//   ② 列が無い場合  … turns / reached_wave を選ぶと400になるが、一覧は今までどおり出る。
//                      さらに**スコアの保存が落ちない**(列を外して必ず送り直す)。
//                      ここが崩れると、SQLを適用するまで新しい記録が1件も残らなくなる
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// クリアした人・途中で終わった人・列を足す前の古い記録の3種類
const RANKING_ROWS = [
  { user_name: 'クリア太郎', hero: 'モッチー', score: 50000, level: 30, icon: null, party: [], turns: 87, reached_wave: 10 },
  { user_name: '途中花子', hero: 'スエゾー', score: 20000, level: 12, icon: null, party: [], turns: null, reached_wave: 4 },
  { user_name: '昔の三郎', hero: 'ゴーレム', score: 10000, level: 8, icon: null, party: [] },
];

const seed = () => {
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true);
};

// 列が無いときにPostgRESTが返すもの
const MISSING_COLUMN_SELECT = { code: '42703', message: 'column rankings.turns does not exist' };
const MISSING_COLUMN_INSERT = { code: 'PGRST204', message: "Could not find the 'turns' column of 'rankings' in the schema cache" };

async function openScoreRanking(page, { columnsExist }) {
  const calls = [];
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const select = url.searchParams.get('select') || '';
    const wantsRunStats = /turns|reached_wave/.test(select);
    let postBody = null;
    if (req.method() === 'POST') { try { postBody = JSON.parse(req.postData() || 'null'); } catch {} }
    calls.push({ path: url.pathname, method: req.method(), select, wantsRunStats, postBody });

    if (url.pathname.endsWith('/rankings')) {
      if (req.method() === 'POST') {
        const sent = postBody && !Array.isArray(postBody) ? postBody : (Array.isArray(postBody) ? postBody[0] : null);
        const sentRunStats = !!sent && ('turns' in sent || 'reached_wave' in sent);
        if (!columnsExist && sentRunStats) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify(MISSING_COLUMN_INSERT) });
          return;
        }
        await route.fulfill({ status: 201, body: '' });
        return;
      }
      if (!columnsExist && wantsRunStats) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify(MISSING_COLUMN_SELECT) });
        return;
      }
      // 列が無い環境では、行からもその2つを落として返す
      const rows = RANKING_ROWS.map(r => {
        if (columnsExist) return r;
        const { turns, reached_wave, ...rest } = r;
        return rest;
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      return;
    }
    if (url.pathname.endsWith('/bond_levels')) {
      await route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.bond_levels'" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, f);
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await down({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ|^確認$/.test(x.textContent.trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="バトル"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  // スコアランキングはモードのカードにある「🏆 …のランキング」から開く
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /チャレンジモードのランキング/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(4500);
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="score"]')].map(el => {
    const stat = el.querySelector('[data-ranking-run-stat]');
    return { text: el.innerText.replace(/\s+/g, ' '), stat: stat ? stat.innerText.replace(/\s+/g, ' ') : null, kind: stat ? stat.dataset.rankingRunStat : null };
  }));
  return { cards, calls };
}

// 列が無い環境でスコアの保存が落ちないことを、送信処理そのものを呼んで確かめる。
// 画面から1周遊ばせるのは時間がかかるので、アプリと同じ形の行を同じ関数へ通す
async function trySubmit(page) {
  return page.evaluate(async () => {
    const insert = window.__mhTestHooks && window.__mhTestHooks.sbInsertScore;
    if (!insert) return { available: false };
    try {
      const res = await insert({ difficulty: 'Normal', user_name: '送信太郎', hero: 'モッチー', party: [],
        score: 1234, level: 5, icon: null, clear_id: 'test-clear-1', turns: 87, reached_wave: 10 });
      return { available: true, saved: res && res.saved === true, row: res && res.row };
    } catch (e) {
      return { available: true, saved: false, error: String(e && e.message || e) };
    }
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  await run(browser, true);
  await run(browser, false);
  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);

  async function run(browser, columnsExist) {
    const label = columnsExist ? '列あり' : '列が無い(適用前)';
    console.log(`\n== ${label} ==`);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const fatal = [];
    page.on('pageerror', e => fatal.push(e.message));
    await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
    await page.addInitScript(seed);
    const { cards, calls } = await openScoreRanking(page, { columnsExist });
    const cardOf = (n) => cards.find(c => c.text.includes(n)) || {};
    const askedRunStats = calls.some(c => c.path.endsWith('/rankings') && c.method === 'GET' && c.wantsRunStats);

    check(`${label}: 一覧が出る`, cards.length >= 3, `${cards.length}件`);
    check(`${label}: turns / reached_wave を選びにいく`, askedRunStats);

    if (columnsExist) {
      check(`${label}: クリアの記録は「◯◯ターンでクリア」`,
        cardOf('クリア太郎').kind === 'turns' && /87ターンでクリア/.test(cardOf('クリア太郎').stat || ''),
        cardOf('クリア太郎').stat || '(出ていない)');
      check(`${label}: 途中で終わった記録は「WAVE ◯ で終了」`,
        cardOf('途中花子').kind === 'wave' && /WAVE 4 で終了/.test(cardOf('途中花子').stat || ''),
        cardOf('途中花子').stat || '(出ていない)');
      check(`${label}: 途中で終わった記録にターン数を出さない`,
        !/ターン/.test(cardOf('途中花子').stat || ''), cardOf('途中花子').stat || '');
      check(`${label}: 古い記録には何も出さない`, cardOf('昔の三郎').stat === null, cardOf('昔の三郎').stat || '(出ていない)');
    } else {
      // 400を受けたあと、列を外して取り直しているか
      const retried = calls.filter(c => c.path.endsWith('/rankings') && c.method === 'GET' && !c.wantsRunStats).length > 0;
      check(`${label}: 400を受けたら列を外して取り直す`, retried);
      check(`${label}: 一覧は今までどおり出る`,
        !!cardOf('クリア太郎').text && !!cardOf('途中花子').text, cards.map(c => c.text).join(' / ').slice(0, 60));
      check(`${label}: どの記録にもターン数・WAVEを出さない`, cards.every(c => c.stat === null));
    }

    // 送信は列の有無にかかわらず必ず成功しなければならない
    const submit = await trySubmit(page);
    if (submit.available) {
      check(`${label}: スコアの保存が成功する`, submit.saved === true, submit.error || '');
      const sentRows = calls.filter(c => c.path.endsWith('/rankings') && c.method === 'POST');
      if (!columnsExist) {
        // 保存された行に列が残っていないことが要点。一覧の取得で先に列が無いと分かっていれば
        // 送り直し無し(POST1回)で済み、分かっていなければ400を受けてから外して送り直す。
        // どちらも正しい結果なので、最後に送った内容だけを見る
        const lastSent = sentRows[sentRows.length - 1]?.postBody || {};
        check(`${label}: 保存する行に列を含めない`,
          sentRows.length >= 1 && !('turns' in lastSent) && !('reached_wave' in lastSent),
          `POST${sentRows.length}回 / 最後のキー: ${Object.keys(lastSent).join(',')}`);
      } else {
        const sent = sentRows[0]?.postBody || {};
        check(`${label}: ターン数と到達WAVEを送っている`,
          sent.turns === 87 && sent.reached_wave === 10, `turns=${sent.turns} / reached_wave=${sent.reached_wave}`);
      }
    } else {
      check(`${label}: 送信処理を検査から呼べる`, false, '__mhTestHooks.sbInsertScore が無い');
    }

    check(`${label}: 致命的なJSエラーが出ない`, fatal.length === 0, fatal.slice(0, 2).join(' / '));
    await page.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
