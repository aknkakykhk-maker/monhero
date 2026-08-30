// エイキ(正式実装前・debugOnly)が「デバッグからどこを通れば実際に触れるか」を、
// 実ブラウザで最後まで歩いて確かめる。
//
//   python3 tools/serve.py は要らない(このツールが自前でポートを開く)
//   node tools/battle/eiki-debug-entry-check.js
//
// 【なぜ要るか】
// debugOnly のモンスターは PICK_HERO(勇者モン選択)の一覧へ差し込む作りなので、
//   ・PICK_HERO を通らない入口(BATTLE TEST の「4. デバッグ戦開始」は
//     保存済みの編成をそのまま使って戦闘へ飛ぶ)からは絶対に出ない
//   ・debugBattleRef が立っていない通常プレイからも出ない
// という2つの条件がある。定義もモーションも正しいのに「デバッグから見つからない」
// という形で詰まるのはここなので、案内する道順そのものを機械的に確かめる。
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動する。分かるのは「並ぶか」「押せるか」「実行時エラーが出ないか」まで。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 8987;
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

// 「4. デバッグ戦開始」は勇者モン選択を通らない、という前提を実装側でも確かめておく。
// ここが変わったら道順の案内も変える必要がある
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const startDebugBattle = source.slice(source.indexOf('const startDebugBattle = (extreme=false) => {'),
  source.indexOf('const startDebugBattle = (extreme=false) => {') + 3000);
check('「4. デバッグ戦開始」は保存済みの編成をそのまま使う(勇者モン選択を通らない)',
  startDebugBattle.includes('getActiveMonsterList()') && !/setGameState\('PICK_HERO'\)/.test(startDebugBattle));
check('「⚔️ バトルモード」は debugBattleRef を立ててモード選択へ入る',
  /data-debug-battle-mode[^>]*onClick=\{\(\)=>\{debugBattleRef\.current=true;[\s\S]{0,200}?setGameState\('BATTLE_MODE_SELECT'\)/.test(source));

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
    await page.route('**cdn.tailwindcss.com**', (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Zan']));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // 難易度 → 「この難易度で挑戦」で勇者モン選択まで進む共通処理
    const goToPickHero = async () => {
      const card = page.locator('article').filter({ hasText: 'チャレンジ' }).first();
      await card.scrollIntoViewIfNeeded();
      await card.getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
      await page.waitForTimeout(800);
      // 配布などの案内が重なっていたら閉じる
      const notice = page.getByRole('button', { name: '確認' }).first();
      if (await notice.count() > 0 && await notice.isVisible().catch(() => false)) {
        await notice.dispatchEvent('click');
        await page.waitForTimeout(400);
      }
      // いちばん左(Beginner)の「この難易度で挑戦」。
      // 「🏆 Beginnerのランキング」と紛らわしいので、名前を完全一致で指定する
      await page.getByRole('button', { name: 'この難易度で挑戦', exact: true }).first().dispatchEvent('click');
      await page.waitForTimeout(1200);
      return page.locator('body').innerText();
    };

    // --- ① 通常プレイ(HOMEのバトル)の勇者モン選択には出ないこと ---
    await page.getByRole('button', { name: 'バトル' }).first().dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 20000 });
    const normalBody = await goToPickHero();
    check('通常プレイでも勇者モン選択まで進む', normalBody.includes('勇者モンを選択'));
    check('通常プレイの勇者モン選択にエイキは出ない', !normalBody.includes('エイキ'));
    check('通常プレイの勇者モン選択に最強デバッグモンも出ない', !normalBody.includes('DEBUG専用'));

    // HOMEへ戻す
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });

    // --- ② デバッグ設定 → BATTLE TEST → ⚔️ バトルモード ---
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('BATTLE TEST').first().waitFor({ timeout: 20000 });
    check('デバッグ設定を開ける', true);
    await page.getByRole('button', { name: '⚔️ バトルモード' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 20000 });
    check('⚔️ バトルモードから本番と同じモード選択へ入る', true);

    // --- ③ チャレンジ → 難易度 → 勇者モン選択 ---
    const heading = await goToPickHero();
    check('デバッグからも勇者モン選択まで進む', heading.includes('勇者モンを選択'));

    // --- ④ 勇者モン選択にエイキが並ぶ ---
    const eiki = page.getByText('エイキ').first();
    const found = await page.getByText('エイキ').count();
    check('デバッグの勇者モン選択にエイキが並ぶ', found > 0, `${found}件`);
    if (found > 0) {
      await eiki.scrollIntoViewIfNeeded();
      const body = await page.locator('body').innerText();
      const card = body.slice(Math.max(0, body.indexOf('エイキ') - 40), body.indexOf('エイキ') + 200).replace(/\s+/g, ' ');
      check('「DEBUG専用」と分かる印が付いている', body.includes('DEBUG専用'), card.slice(0, 80));
      check('固有技「華影緋閃」が読める', card.includes('華影緋閃'), card.slice(0, 120));
      check('丈夫さ20が出ている', /防20/.test(card), card.slice(0, 120));
    }
    // 横幅は測らない。このサンドボックスはTailwindを読めず grid-cols-2 が効かないため、
    // 通常プレイの勇者モン選択でも同じだけはみ出す(実測 1040/390)。エイキとは関係がない
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
