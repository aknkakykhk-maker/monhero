const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスバトルのれんしゅう(2026-09-21・公開前なのでデバッグからだけ)を
// 実際のブラウザで通してみる。
//
//   ① デバッグ設定から「タクティクスのれんしゅうを見る」で始まる
//   ② 仕組みえらびから始まり、タクティクスの中身(1体ずつ・狙い)の説明が出る
//   ③ タクティクス以外の仕組みは押せない(台本から外れない)
//   ④ タクティクスチャレンジ以外の「難易度を選ぶ」は押せない
//   ⑤ 難易度はビギナーから始まり、ビギナー以外は押せない
//   ⑥ 勇者モン → 距離 → 教え → バトルまで進み、1体ずつのライフが出ている
//   ⑦ ガードを使う番はカードとACTIONが光り、実際に使うと敵の連撃が予告される
//   ⑧ 「やめる」で始めた場所(デバッグ設定)へ帰り、既読フラグを書き換えていない
//   ⑨ どこを通っても実行時エラー(真っ白)が出ない
//
// ★ここから先(アシストカード → 緊急回復 → 距離技 → 攻撃 → 技変更 → 固有技 → 強化フェーズ)は、
//   作ったときに手で通して動くことを確かめてある。自動でそこまで押し続ける検査にすると、
//   演出待ちと「技の一覧を開く2回タップ」で崩れやすいので、ここでは止めている。
//   仕組み(手札・敵・強化フェーズ)はクラシックの練習と同じものを通るので、
//   そちらは battle/battle-tutorial-v2-check.js が見ている。
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
const http = require('http');
const path = require('path');
const fs = require('fs');
// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8984;

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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      // わざと「まだ見ていない」状態にしておき、お試し再生で書き換わらないことを確かめる
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(false));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      // お詫びの配布は画面全体を覆う。配布済みの印を先に入れて出さない
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });

    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // --- ① デバッグ設定から始める(タクティクスは公開前なのでここだけ) ---
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('summary').filter({ hasText: '📖 チュートリアル' }).first().click();
    const startButton = page.getByRole('button', { name: 'タクティクスのれんしゅうを見る（公開前・記録は残りません）' });
    check('デバッグ設定にタクティクスの入口がある', await startButton.count() === 1);
    await startButton.dispatchEvent('click');
    await page.getByText('どのバトルで遊ぶかを選びます').first().waitFor({ timeout: 15000 });
    check('ふだんの入口(バトルの仕組みえらび)から始まる', true);

    const bubbleText = () => page.evaluate(() => {
      const box = document.querySelector('[aria-label="バトルチュートリアル"]');
      return box ? box.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    const tapNext = async () => {
      const next = page.locator('button').filter({ hasText: /^つぎへ$/ });
      if (await next.count() === 0) return false;
      await next.first().dispatchEvent('click');
      await page.waitForTimeout(220);
      return true;
    };
    const spots = () => page.evaluate(() => [...document.querySelectorAll('.is-battle-tutorial-spot')]
      .map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20),
        action: !!el.closest('[data-battle-action]') || !!el.querySelector('[data-battle-action]'),
        // ★1体ずつのライフ・ガッツは枠の中へ入れた(2026-09-22)。光る印もそちらに付く
        party: !!el.closest('[data-tactics-party-slot]') || el.hasAttribute('data-tactics-party-slot'),
      })));

    // --- ② タクティクスの中身を説明する ---
    check('チュートリアルの吹き出しが出ている', (await bubbleText() || '').includes('れんしゅう'),
      String(await bubbleText()).slice(0, 40));
    const saidSystem = [];
    for (let i = 0; i < 10; i++) {
      const t = await bubbleText();
      if (t) saidSystem.push(t);
      if (!(await tapNext())) break;
    }
    const allSystem = saidSystem.join(' | ');
    check('1体ずつのライフと狙いの説明が出る',
      allSystem.includes('1体ずつ') && allSystem.includes('狙う'), `${saidSystem.length}ステップぶん読んだ`);

    // --- ③ タクティクス以外の仕組みは押せない ---
    check('練習中は戻るが押せない(仕組みえらび)', await page.getByRole('button', { name: '戻る' }).isDisabled());
    check('タクティクス以外の仕組みは押せない',
      await page.locator('[data-battle-system="systemClassic"]').isDisabled()
        && await page.locator('[data-battle-system="systemQuick"]').isDisabled());
    // ★公開前の仕組みなので、この練習のあいだだけは「準備中」で止めずに選ばせる
    check('タクティクスのカードは押せる',
      await page.locator('[data-battle-system="systemTactics"]').isEnabled());

    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('タクティクスを選ぶとモード選択へ進む', true);
    const saidMode = [];
    for (let i = 0; i < 8; i++) {
      const t = await bubbleText();
      if (t) saidMode.push(t);
      if (!(await tapNext())) break;
    }
    check('タクティクスの中の3モードを説明する',
      ['タクティクスチャレンジ', '種族チャレンジ', 'プロ'].every(w => saidMode.join(' | ').includes(w)),
      `${saidMode.length}ステップぶん読んだ`);

    // --- ④ タクティクスチャレンジ以外は始められない ---
    // カードは横に回るので、見出しの文字ではなく data-battle-mode で選ぶ
    const startOf = (modeId, name = '難易度を選ぶ') => page.locator(`[data-battle-mode="${modeId}"]`).first().getByRole('button', { name });
    check('タクティクスチャレンジの「難易度を選ぶ」は押せる', await startOf('tactics').isEnabled());
    check('タクティクス種族チャレンジの「種族を選ぶ」は押せない', await startOf('tacticsSpecies', '種族を選ぶ').isDisabled());
    check('タクティクスプロの「難易度を選ぶ」は押せない', await startOf('tacticsPro').isDisabled());

    await startOf('tactics').dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    check('難易度選択へ進める', true);

    // --- ⑤ ビギナーから始まり、ビギナー以外は押せない ---
    const centered = () => page.evaluate(() => {
      const rootEl = document.querySelector('.snap-mandatory');
      const c = rootEl.scrollLeft + rootEl.clientWidth / 2;
      let best = null, d = Infinity;
      [...rootEl.children].forEach((card) => {
        const n = Math.abs(card.offsetLeft + card.offsetWidth / 2 - c);
        if (n < d) { d = n; best = card; }
      });
      return best ? best.querySelector('h3').textContent.trim() : null;
    });
    check('練習中の難易度はビギナーから始まる', await centered() === 'Beginner', String(await centered()));
    const startOfDiff = (label) => page.locator('.snap-mandatory > article').filter({ hasText: label }).first().getByRole('button', { name: 'この難易度で挑戦' });
    check('ビギナーは押せる', await startOfDiff('Beginner').isEnabled());
    check('ビギナー以外は押せない', await startOfDiff('Hard').isDisabled());

    // --- ⑥ 勇者モン → 距離 → 教え → バトル ---
    for (let i = 0; i < 4; i++) if (!(await tapNext())) break;
    await startOfDiff('Beginner').dispatchEvent('click');
    await page.getByRole('heading', { name: '勇者モンを選択' }).waitFor({ timeout: 15000 });
    check('練習のまま勇者モン選択まで進む', true);
    check('練習の勇者モン選択にデバッグ個体が並ばない',
      await page.getByText('デバッグ最強モン').count() === 0);
    await page.locator('button').filter({ hasText: 'モッチー' }).first().dispatchEvent('click');
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^勇者モンに選ぶ$/ }).first().dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /^近距離/ }).first().dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /^ニコラオの力/ }).first().dispatchEvent('click');
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^習得する$/ }).first().dispatchEvent('click');
    await page.waitForTimeout(1200);
    check('練習のままバトル画面まで進む', await page.locator('[data-battle-action]').count() >= 1);
    // ★このモードの盤面。1体ずつのライフとガッツを持つ枠が出ていること
    //   (2026-09-22 に上の段をやめ、枠そのものの中へ入れた)
    check('1体ずつのライフの枠が出ている',
      await page.locator('[data-tactics-party-slot="1"][data-tactics-hp]').count() === 1,
      String(await page.locator('[data-tactics-party-slot="1"]').getAttribute('data-tactics-hp')));

    // --- ⑦ 1体ずつのライフの説明でその枠が光り、ガードまで進める ---
    let partySpots = null, actionSpots = null;
    for (let i = 0; i < 40; i++) {
      const t = await bubbleText();
      if (t && t.includes('1体ずつのライフ') && partySpots === null) partySpots = await spots();
      if (t && t.includes('ACTIONで実行')) { actionSpots = await spots(); break; }
      if (!(await tapNext())) break;
    }
    // ★光るのは「立っている子の枠」ぶん。れんしゅうは1体だが、本番は最大4つ光る
    check('「1体ずつのライフ」の説明でその枠が光る',
      Array.isArray(partySpots) && partySpots.length >= 1 && partySpots.every(spot => spot.party === true),
      JSON.stringify(partySpots));
    check('ACTIONの説明でACTIONボタンが光る',
      Array.isArray(actionSpots) && actionSpots.length === 1 && actionSpots[0].action === true,
      JSON.stringify(actionSpots));
    // 敵の予告に「誰を狙うか」が出ている(1体でも狙いは付く)
    const intentText = () => page.evaluate(() => {
      const el = document.querySelector('[data-enemy-intent]') || document.body;
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    });
    // ガードを使う番(操作待ち)まで進める。吹き出しが消えて「つぎへ」も無くなる
    for (let i = 0; i < 12; i++) if (!(await tapNext())) break;
    const doSpots = await spots();
    check('ガードを使う番はカードとACTIONが光る',
      doSpots.some(s => s.action) && doSpots.some(s => /ガード/.test(s.text)),
      JSON.stringify(doSpots));
    // 実際に「カードを選ぶ → 使う子の枠をタップ → ACTION」で1ターン進める。
    // ★手札はドラッグにも対応しているので pointerdown → pointerup で押す(click では選べない)
    const tapCard = async (pattern) => {
      const pos = await page.evaluate((s) => {
        const rx = new RegExp(s);
        const btn = [...document.querySelectorAll('button')]
          .find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()) && x.closest('.flex-1.min-w-0'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, pointerType:'touch', isPrimary:true }));
        return { x, y };
      }, pattern);
      if (!pos) return false;
      await page.waitForTimeout(250);
      await page.evaluate((p) => {
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, clientX:p.x, clientY:p.y, pointerId:1, pointerType:'touch', isPrimary:true }));
      }, pos);
      await page.waitForTimeout(300);
      return true;
    };
    check('手札のガードカードを選べる', await tapCard('ガード'));
    // このモードは「誰が使うか」を決めてから出す。勇者モンの枠へ置く
    await page.evaluate(() => { const el = document.querySelector('[data-slot-index="1"]'); if (el) el.click(); });
    await page.waitForTimeout(400);
    const acted = await page.evaluate(() => {
      const b = document.querySelector('[data-battle-action]');
      if (!b || b.disabled) return false;
      b.click(); return true;
    });
    check('使う子を決めるとACTIONが押せる', acted);
    await page.waitForTimeout(4000);
    const afterGuard = await bubbleText();
    check('ガードを使うと次の説明へ進む', !!afterGuard && /ほぼ無傷|連撃/.test(afterGuard),
      String(afterGuard).slice(0, 50));
    // ★台本の2手目は連撃。このモードだけの技が予告に出ることまで確かめる
    //   (クラシックの定義しか見ていないと「様子を見ている」になってしまう)
    // 予告に出るのは敵ごとの技名(カワズモーなら「連続はり手」)。種別名の「連撃」は解析で見える
    const rushShown = (text) => /連撃|連続/.test(text);
    let intentNow = await intentText();
    for (let i = 0; i < 4 && !rushShown(intentNow); i++) {
      if (!(await tapNext())) await page.waitForTimeout(600);
      intentNow = await intentText();
    }
    check('連撃(敵ごとの技名)が予告に出る', rushShown(intentNow), intentNow.slice(0, 60));
    // 狙われている子も予告に出る(このモードだけ)
    check('予告に狙われている子が出る', /🎯/.test(intentNow), intentNow.slice(0, 60));

    // --- ⑧ やめると始めた場所へ帰り、既読は書き換わらない ---
    await page.locator('button').filter({ hasText: /^やめる$/ }).first().dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 15000 });
    check('やめると始めた場所(デバッグ設定)へ帰る', true);
    const seen = await page.evaluate(() => localStorage.getItem('mh_battle_tutorial_seen_v1'));
    check('お試し再生で既読フラグを書き換えない', seen === 'false' || seen === JSON.stringify(false), String(seen));
    // タクティクスの記録も増えていないこと(練習は記録を残さない)
    const tacticsKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('mh_tactics_')));
    check('タクティクスの記録を書いていない', tacticsKeys.length === 0, tacticsKeys.join(', '));

    // --- ⑨ 実行時エラー ---
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');

    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (errors.length) console.log(`  実行時エラー: ${errors[0]}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
