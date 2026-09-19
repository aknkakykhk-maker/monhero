const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新モード(id: tactics)を実際のブラウザで開き、バトルが最後まで立ち上がることを確かめる。
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
//   ① 公開フラグがOFFのあいだは、デバッグのバトルモード入口からだけカードが出る
//   ② 難易度を選んでバトルを始められる(既存モードと同じ経路を通る)
//   ③ 解析(SCAN)にそのモードの技が並び、通常攻撃と別の名前で読める
//   ④ どこを通っても実行時エラー(真っ白)が出ない
//
// 定義と実装の対応は tactics-enemy-actions-check.js が見る。こちらは「実際に遊べるか」だけ。
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
// 見た目は確かめられないが、押せるか・進めるか・実行時エラーが出ないかは観測できる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8987;
const src = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
// 画面に出す名前はあとから変わる可能性があるので、定義から読む(idと表示名は一致していなくてよい)
const MODE_LABEL = (src.match(/id:BATTLE_MODE_TACTICS, label:'([^']+)'/) || [])[1] || '';

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
  check('モードの表示名を定義から読めた', !!MODE_LABEL, MODE_LABEL);
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
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });

    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // --- ① 公開前なので、ふだんの入口には出ない ---
    await page.getByRole('button', { name: 'バトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    const publicModes = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('公開フラグOFFのあいだは、ふだんの入口に出ない', !publicModes.includes(MODE_LABEL), MODE_LABEL);
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);

    // --- ② デバッグのバトルモード入口からは出る ---
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    const cardCount = await page.evaluate((label) =>
      [...document.querySelectorAll('article')].filter(a => a.textContent.includes(label)).length, MODE_LABEL);
    // ぐるぐる回すため同じ並びを3回置いているので、1モードにつき3枚出る
    check('デバッグの入口には新モードのカードが出る', cardCount === 3, `${cardCount}枚`);

    // --- ③ 難易度を選んでバトルを始める ---
    const opened = await page.evaluate((label) => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes(label));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      const b = [...card.querySelectorAll('button')].find(x => x.textContent.includes('難易度を選ぶ'));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    }, MODE_LABEL);
    await page.waitForTimeout(1500);
    const diffText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('難易度を選ぶ画面へ進める', opened && /Normal|ノーマル/.test(diffText), diffText.slice(0, 70));

    const started = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('この難易度で挑戦') && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    });
    await page.waitForTimeout(1500);
    const heroText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('「この難易度で挑戦」から勇者モン選択へ進む', started && heroText.includes('勇者モン'), heroText.slice(0, 70));

    // 勇者モン → 配置 → アシストカード とたどってバトルまで進める。
    // ★押すものが見つからないときは、その場で止めて画面を報告する。
    //   「とりあえず押せるものを押す」で進めると、戻るボタンや全WAVE詳細を踏んで
    //   難易度選択まで戻ってしまい、何が起きたのか分からないまま落ちる(実際にそうなった)。
    // ★編成にモッチーがいるとは限らないので、種名ではなく「総合力」の並びから選ぶ。
    //   デバッグ専用個体は正式プレイの経路から外れるため避ける
    const picked = await page.evaluate(() => {
      const mon = [...document.querySelectorAll('button')]
        .find(b => !b.disabled && b.offsetParent && /総合力/.test(b.textContent) && !/DEBUG/.test(b.textContent));
      if (!mon) return null;
      mon.click();
      return mon.textContent.trim().slice(0, 12);
    });
    check('編成から勇者モンを選べる', !!picked, picked || '総合力つきのボタンが見つからない');
    await page.waitForTimeout(1200);
    let lastStep = '';
    for (let i = 0; i < 18; i++) {
      const state = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      if (/WAVE 1\/10/.test(state)) break;
      const step = await page.evaluate(() => {
        const pick = (re) => [...document.querySelectorAll('button')]
          .find(x => !x.disabled && x.offsetParent && re.test(x.textContent.trim()));
        const slot = pick(/(零|近|中|遠)距離/);
        if (slot) { slot.click(); return `距離:${slot.textContent.trim().slice(0, 8)}`; }
        const confirm = pick(/^(習得する|強化する)$/);
        if (confirm) { confirm.click(); return '確定'; }
        const teaching = pick(/新規習得|強化後/);
        if (teaching) { teaching.click(); return 'アシストカード'; }
        const decide = pick(/この子を|この子で|決定|えらぶ|選ぶ|はじめる/);
        if (decide) { decide.click(); return decide.textContent.trim().slice(0, 10); }
        return null;
      });
      if (!step) { lastStep = state.slice(0, 90); break; }
      lastStep = step;
      await page.waitForTimeout(1100);
    }
    const battleText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('新モードのバトルが始まる', /WAVE 1\/10/.test(battleText),
      /WAVE 1\/10/.test(battleText) ? '' : `最後に進めたところ: ${lastStep} / 画面: ${battleText.slice(0, 90)}`);

    // --- ④ バトル画面がそのモードのものとして立ち上がっている ---
    check('バトル画面にモード名が出る', battleText.includes(`${MODE_LABEL.replace('モード', '')} / `), battleText.slice(0, 80));
    check('ターン制限は既存モードと同じ20ターン', /TURN 1\/20/.test(battleText), battleText.slice(0, 80));
    // ★予告の中身は抽選なので、画面の文字から「予定:」を探すと
    //   「今回はためるだった」ターンで落ちる。吹き出しそのものを見る
    const intentText = await page.evaluate(() =>
      (document.querySelector('[data-enemy-intent]')?.textContent || '').trim());
    check('敵の行動が予告されている', intentText.length > 0, intentText || '吹き出しが見つからない');
    // 狙いの予告(2026-09-19・設計 §5.1)。ダメージのある行動には「誰を狙うか」が出る。
    // ためる・移動には狙いが無いので、予定ダメージが出ているときだけ見る
    check('攻撃の予告には狙いが出る', !/予定:/.test(intentText) || /🎯/.test(intentText), intentText);
    // ★解析(SCAN)の中身はここでは見ない。
    //   このサンドボックスはTailwindへ出られず、解析ボタンを押しても画面が開かない。
    //   既存のチャレンジモードでも同じく開かないことを確かめてあるので、実装ではなく検査環境の都合。
    //   行動表が解析へ渡っていることは tactics-enemy-actions-check.js がソースで見る。

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確認できた', false, String(e && e.message ? e.message : e).slice(0, 160));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
