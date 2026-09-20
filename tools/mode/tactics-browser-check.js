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
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // --- ① 公開前なので、ふだんの入口には出ない ---
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    const publicModes = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('公開フラグOFFのあいだは、ふだんの入口に出ない', !publicModes.includes(MODE_LABEL), MODE_LABEL);
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);
    // 入口そのものにも仕組みごと出ない(2026-09-20 に1画面増えた)
    const publicSystems = await page.evaluate(() =>
      [...document.querySelectorAll('[data-battle-system]')].map(b => b.getAttribute('data-battle-system')));
    check('公開フラグOFFのあいだは、入口にも新モードの仕組みが出ない',
      !publicSystems.includes('systemTactics'), publicSystems.join(','));
    // 入口からもう一度戻ってHOMEへ(画面が1段増えたぶん、戻るも1回多い)
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);

    // --- ② デバッグのバトルモード入口からは出る ---
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-systems]').first().waitFor({ timeout: 15000 });
    check('デバッグの入口には新モードの仕組みが出る',
      await page.locator('[data-battle-system="systemTactics"]').count() > 0);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
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

    // --- ⑤ AUTOで何ターンか戦わせ、ライフが盤面ごしに減ることを見る(段階5) ---
    // ★ここが繋がっていないと、敵の攻撃が当たってもライフが1も減らない、
    //   あるいは誰も倒れていないのに敗北画面が出る。どちらも例外は出ない
    // ★「読めなかった」を0と取り違えない。WAVEの結果やトレーニングの画面へ移ると
    //   この帯は消えるので、raw が読めたときだけ数える(取り違えて敗北扱いにしかけた)
    // ★ライフの合計は「1体ずつの帯」から数える(2026-09-19にユーザー依頼で合計の帯をやめた)。
    //   倒れた子は合計へ数えない。数えると全員倒れても0にならず、敗北の判定と食い違う
    await page.evaluate(() => {
      window.__mhParty = () => [...document.querySelectorAll('[data-tactics-party-slot]')].map(el => ({
        slot: Number(el.getAttribute('data-tactics-party-slot')),
        hp: el.getAttribute('data-tactics-hp') || '',
        guts: el.getAttribute('data-tactics-guts') || '',
        downed: el.getAttribute('data-tactics-downed') || '',
      })).filter(u => /^\d+\/\d+$/.test(u.hp));
      // ★「読めなかった」を0と取り違えない。WAVEの結果やトレーニングの画面へ移ると
      //   この帯ごと消えるので、1枠でも読めたときだけ数える(取り違えて敗北扱いにしかけた)
      window.__mhPartyLife = () => {
        const units = window.__mhParty();
        if (!units.length) return { raw: '', ok: false };
        const alive = units.filter(u => u.downed !== 'true');
        const hp = alive.reduce((sum, u) => sum + Number(u.hp.split('/')[0]), 0);
        const max = alive.reduce((sum, u) => sum + Number(u.hp.split('/')[1]), 0);
        return { hp, max, raw: `${hp}/${max}`, ok: true };
      };
    });
    const lifeOf = () => page.evaluate(() => window.__mhPartyLife());
    // --- 1体ずつのライフ・ガッツ(段階8 / 2026-09-19に距離枠の上へ移した) ---
    const unitBars = await page.evaluate(() => window.__mhParty());
    check('1体ずつのライフ・ガッツが出る',
      unitBars.length >= 1 && unitBars.every(u => /^\d+\/\d+$/.test(u.hp) && /^\d+\/\d+$/.test(u.guts)),
      JSON.stringify(unitBars));
    check('倒れていない子は「ダウン」にならない', unitBars.every(u => u.downed === 'false'),
      unitBars.map(u => `${u.slot}:${u.downed}`).join(' '));
    // ★合計のライフ・ガッツの帯は新モードでは出さない(2026-09-19)。
    //   合計だけでは「どの子が瀕死か」が分からず、個別と両方出すと読むものが増えるだけ
    const allyBars = await page.evaluate(() => ({
      life: !!document.querySelector('[data-ally-life]'),
      guts: !!document.querySelector('[data-ally-guts]'),
    }));
    check('合計のライフ・ガッツの帯は出さない', !allyBars.life && !allyBars.guts,
      `ライフ帯 ${allyBars.life} / ガッツ帯 ${allyBars.guts}`);

    // ★帯が動かないと、回復もダメージも瞬間で増減して見える(2026-09-20 ユーザー指摘)。
    //   クラス名だけでなく、実際に効いている時間をブラウザから読む
    const barAnim = await page.evaluate(() => {
      const sec = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return parseFloat(getComputedStyle(el).transitionDuration) || 0;
      };
      return { hp: sec('[data-tactics-hp-bar]'), guts: sec('[data-tactics-guts-bar]') };
    });
    check('ライフの帯がアニメーションする', barAnim.hp >= 0.9, `${barAnim.hp}秒`);
    check('ガッツの帯がアニメーションする', barAnim.guts >= 0.4, `${barAnim.guts}秒`);

    // --- 強化の札(2026-09-20 ユーザー指摘「バフ欄が増えると敵や緊急回復等が見えなくなる」) ---
    // ★この帯はどのモードでも同じものを使う。いくつ付いても高さが変わらないことを実寸で見る
    const buffBox = await page.evaluate(() => {
      const el = document.querySelector('[data-battle-buffs]');
      if (!el) return null;
      const icons = [...document.querySelectorAll('[data-battle-buff-icons] > div')];
      const rows = new Set(icons.map(x => Math.round(x.getBoundingClientRect().top))).size;
      return { mode: el.getAttribute('data-battle-buffs-mode'), n: Number(el.getAttribute('data-battle-buffs')),
        h: Math.round(el.getBoundingClientRect().height), icons: icons.length, rows };
    });
    check('強化の札はアイコン1行で始まる',
      !!buffBox && buffBox.mode === 'icon' && buffBox.icons === buffBox.n && buffBox.rows <= 1,
      JSON.stringify(buffBox));
    check('強化の札が画面を押し広げない', !!buffBox && buffBox.h <= 40, JSON.stringify(buffBox));
    // 「詳細」を押すと数値つきの一覧になり、開いても高さは頭打ちになる
    await page.evaluate(() => { document.querySelector('[data-battle-buff-toggle]')?.click(); });
    await page.waitForTimeout(400);
    const buffOpen = await page.evaluate(() => {
      const el = document.querySelector('[data-battle-buffs]');
      if (!el) return null;
      return { mode: el.getAttribute('data-battle-buffs-mode'), h: Math.round(el.getBoundingClientRect().height),
        list: document.querySelectorAll('[data-battle-buff-list] > div').length,
        text: (document.querySelector('[data-battle-buff-list]')?.textContent || '').slice(0, 40) };
    });
    check('詳細を開くと数値つきの一覧になる',
      !!buffOpen && buffOpen.mode === 'detail' && buffOpen.list === (buffBox ? buffBox.n : -1) && /%/.test(buffOpen.text),
      JSON.stringify(buffOpen));
    check('詳細を開いても高さは頭打ち', !!buffOpen && buffOpen.h <= 110, JSON.stringify(buffOpen));
    await page.evaluate(() => { document.querySelector('[data-battle-buff-toggle]')?.click(); });
    await page.waitForTimeout(300);

    const startLife = await lifeOf();
    check('盤面のライフを読める', startLife.ok && startLife.max > 0, startLife.raw || '見つからない');
    check('はじめは満タン(立っている子の合計＝上限)', startLife.hp === startLife.max, startLife.raw);
    // ★1秒ごとに読むと、自動再生ですぐ戻るぶんを取りこぼして「減っていない」に見える。
    //   実際に減っているのに落ちた(2026-09-19)。ページの中で見張って、取りこぼさないようにする
    await page.evaluate(() => {
      window.__mhLifeLog = { drops: 0, min: Infinity, max: 0, last: null, overflow: 0, guts: '',
        cards: 0, unusable: 0, badCards: 0, badSample: '', noReason: 0, noReasonSample: '', splitSeen: 0, splitSample: '' };
      // ★手札の灰色は「合計のガッツ」では決まらない(2026-09-19 ユーザー指摘)。
      //   ⚡242 を 125 と 117 で持っていても、⚡128 のカードは誰も払えない。
      //   ここでは「使えることになっているのに、払える子が1人もいない」場面を数える
      const readCards = () => {
        const log = window.__mhLifeLog;
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        if (!cards.length) return;
        const alive = window.__mhParty().filter(u => u.downed !== 'true')
          .map(u => Number(String(u.guts).split('/')[0]));
        if (!alive.length) return;
        const total = alive.reduce((sum, g) => sum + g, 0);
        cards.forEach(el => {
          const cost = Number(el.getAttribute('data-card-cost'));
          if (!Number.isFinite(cost)) return;
          log.cards++;
          const usable = el.getAttribute('data-card-usable') === 'true';
          const payer = alive.some(g => g >= cost);
          const info = `${el.getAttribute('data-card-type')} ⚡${cost} / 1体ずつ ${alive.join(',')}`;
          const kind = el.getAttribute('data-card-block') || '';
          if (!usable) log.unusable++;
          if (usable && !payer) { log.badCards++; log.badSample = info; }
          // 使えないカードには必ず理由を持たせる(「使えないだけで、なぜかが分からない」を防ぐ)。
          // 1ターンに選べる枚数の上限(limit)だけは、いままでの5モードと同じで灰色だけ。
          // それ以外は赤い帯でその場に出す
          const ribbon = !!(el.parentElement && el.parentElement.querySelector('[data-tactics-card-block]'));
          if (!usable && (!kind || (kind !== 'limit' && !ribbon) || (kind === 'limit' && ribbon))) {
            log.noReason++; log.noReasonSample = `${info} / 理由 ${kind || 'なし'} / 帯 ${ribbon}`;
          }
          // 合計では足りるのに1体ずつでは誰も払えない場面。この不具合そのものの形
          if (!payer && total >= cost) { log.splitSeen++; log.splitSample = info; }
        });
      };
      const read = () => {
        const units = window.__mhParty();
        // ガッツの帯もWAVEの結果やトレーニングの画面では消える。見えたときの値を覚えておく
        if (units.length) window.__mhLifeLog.guts = units.map(u => u.guts).join(' ');
        readCards();
        const life = window.__mhPartyLife();
        if (!life.ok) return;
        const log = window.__mhLifeLog;
        if (log.last !== null && life.hp < log.last) log.drops++;
        if (life.hp < 0 || life.hp > life.max) log.overflow++;
        log.last = life.hp; log.max = life.max;
        log.min = Math.min(log.min, life.hp);
      };
      new MutationObserver(read).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      setInterval(read, 50);
    });
    // ★AUTOに任せると、こちらが強い難易度では敵が殴る前に倒れてしまい、
    //   「ライフが減る」を一度も観測できないことがある(実際に落ちた)。
    //   「緊急」は攻撃せずに敵の番だけを進めるので、必ず殴られる。まずこれで被弾を見る
    // ★処理中(isBusy)は押せない。固定の待ち時間だと、ほかの検査と同時に動いて重いときに
    //   押し損ねて「一度も殴られなかった」に見える(実際に落ちた)。押せたかどうかで待ちを変える
    let gameOver = false, pressed = 0;
    for (let i = 0; i < 16 && pressed < 8; i++) {
      const hit = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && /緊急/.test(x.textContent));
        if (!b) return false;
        b.click();
        return true;
      });
      if (hit) pressed++;
      await page.waitForTimeout(hit ? 3000 : 1200);
      gameOver = gameOver || await page.evaluate(() => /GAME OVER/i.test(document.body.innerText));
      if (await page.evaluate(() => window.__mhLifeLog.drops) >= 1) break;
    }
    // そのあとAUTOへ切り替えて、続けて遊んでも壊れないことを見る
    await page.evaluate(() => { document.querySelector('button[aria-label^="AUTO"]')?.click(); });
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      gameOver = gameOver || await page.evaluate(() => /GAME OVER/i.test(document.body.innerText));
      const drops = await page.evaluate(() => window.__mhLifeLog.drops);
      if (drops >= 2) break;
    }
    const log = await page.evaluate(() => ({ ...window.__mhLifeLog }));
    check('敵の攻撃でライフが減る', log.drops >= 1,
      `減った回数 ${log.drops} / 最低 ${log.min} / 「緊急」を押せた回数 ${pressed}`);
    check('ライフが上限を超えたりマイナスにならない', log.overflow === 0,
      `はみ出した回数 ${log.overflow} / 最後 ${log.last}/${log.max}`);
    // ★立っている子のライフが残っているのに敗北画面が出ていたら、盤面と敗北の判定が食い違っている
    check('ライフが残っているのに敗北画面が出ない', !gameOver || log.last === 0,
      `${log.last}/${log.max} / GAME OVER ${gameOver}`);
    // 1体ずつのガッツも出ている(段階6 / 2026-09-19に個別へ)。上限が0のままなら盤面から拾えていない
    const gutsText = log.guts || '';
    const gutsList = gutsText ? gutsText.split(' ') : [];
    check('1体ずつのガッツが出ている',
      gutsList.length >= 1 && gutsList.every(g => /^\d+\/\d+$/.test(g) && Number(g.split('/')[1]) > 0),
      gutsText || '見つからない');
    // --- 手札の灰色と、その理由(2026-09-19 ユーザー指摘) ---
    check('手札のコストと使えるかを読めている', log.cards > 0, `見た回数 ${log.cards}`);
    // ★これが落ちるということは、合計のガッツで「使える」ことにしている
    check('使えるカードには必ず払える子がいる', log.badCards === 0,
      `ずれた回数 ${log.badCards}${log.badSample ? ` / 例: ${log.badSample}` : ''}`);
    // ★「使えない」カードに出会えるかは、その回の手札とガッツ次第(0回の回もある)。
    //   ここでNGにすると本体が正しくても落ちるので、素通りしていないかは数だけ出す
    console.log(`  -- 灰色のカードを見た回数: ${log.unusable}回`);
    check('使えないカードには理由が出ている', log.noReason === 0,
      `理由の無いカード ${log.noReason}${log.noReasonSample ? ` / 例: ${log.noReasonSample}` : ''}`);
    // 合計では足りるのに1体ずつでは誰も払えない場面に出会えたか(出会えなくても落とさない)
    console.log(`  -- 合計では足りるが1体ずつでは払えない場面: ${log.splitSeen}回${log.splitSample ? ` / 例: ${log.splitSample}` : ''}`);

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
