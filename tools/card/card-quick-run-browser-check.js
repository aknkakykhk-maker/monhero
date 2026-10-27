// MFバトルカードを開いたまま、裏のクイック∞周回が続くこと(docs/spec/CARD_BATTLE.md 5-3)を実際のブラウザで確かめる。
//
//   node tools/card/card-quick-run-browser-check.js
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-quick-run-browser-check.js   帯と「⚔ ◯周目」の写真も撮る
//
// 【なぜ要るか】
// 周回の中心(advanceRunStage と「いま画面を切り替えてよいか」の判断)は、モンヒロビートで
// 画面がバトルへ飛ぶ事故を2回出している(一覧から漏れた画面・1描画ぶん古い判断)。
// 判断の式は battle/run-stage-check.js が静的に見るが、「本当に止まらない・飛ばない」は動かさないと分からない。
//
// 見ているもの(モンヒロビートの mode/rhythm-background-run-check.js と同じ組み立て)
//   ① ∞周回中のバトル画面に「🃏 バトルカード」の入口が出る(デバッグの人。公開前はふつうの人には出ない)
//   ② 入口から入ると、周回を止めずにカードのトップへ移れる。トップの上に周回の帯が出る
//   ③ トップ・デッキ編成・図鑑・ルール・カードから開いたマーケット・対戦中のどこにいても、
//      敵を倒したときの段階の切り替えで画面がバトルへ飛び戻らない
//   ④ 対戦中は帯を出さず、盤のヘッダーに「⚔ ◯周目」だけ出る
//   ⑤ 帯の「⚔ バトルへ」でバトルへ戻れ、そのあいだに周回が進んでいる。戻ったあとも進み続ける
//   ⑥ 「HOMEへ戻る」で周回を締めて HOME へ抜ける(バトルの段階が残らない)
//   ⑦ どこでも実行時エラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8997;
const SHOT = process.env.CARD_SHOT_DIR || '';
// 1か所で見張る時間。×1速でも敵を1体は倒す長さ(モンビーの検査と同じ)
const WATCH_MS = 12000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const seed = () => {
  if (sessionStorage.getItem('__cardRunSeeded')) return;
  sessionStorage.setItem('__cardRunSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true);
  put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
  // デバッグの人の印(合言葉が合ったときに立つもの)。MFバトルカードは公開前なので、これが無いと入口が出ない
  localStorage.setItem('mh_debug_unlocked_v1', '1');
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(quiet.eventStorySeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  const shot = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const click = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const clickText = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const pointerDown = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t) || x.getAttribute('aria-label') === t);
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, text);
  const dismissOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(450);
    }
  };
  const cycleLabelTo = async (prefix, target, tries) => {
    const sel = `button[aria-label^="${prefix}"]`;
    const label = () => page.evaluate((q) => document.querySelector(q)?.getAttribute('aria-label') || null, sel);
    const present = () => page.waitForFunction((q) => !!document.querySelector(q), sel, { timeout: 10000 }).catch(() => {});
    for (let i = 0; i < tries; i++) {
      await present();
      const before = await label();
      if (before === target) return true;
      await page.evaluate((q) => document.querySelector(q)?.click(), sel);
      await page.waitForFunction(([q, b]) => { const x = document.querySelector(q); return !x || x.getAttribute('aria-label') !== b; }, [sel, before], { timeout: 5000 }).catch(() => {});
    }
    await present();
    return (await label()) === target;
  };
  // ランがどこまで進んだか。バトル画面でだけ読める(WAVE と TURN)
  const readProgress = () => page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    return { turn: Number((text.match(/TURN\s*(\d+)/) || [])[1] || 0), wave: Number((text.match(/WAVE\s*(\d+)/) || [])[1] || 0) };
  });
  // 帯の「◯周目」と WAVE(カードの画面にいるあいだの進み具合はこれで読む)
  const readStrip = () => page.evaluate(() => {
    const t = (document.querySelector('[data-card-quick-run] [data-rhythm-multi-quick-run]')?.textContent || '').replace(/\s+/g, ' ');
    return { wave: Number((t.match(/WAVE\s*(\d+)/) || [])[1] || 0), loops: Number((t.match(/(\d+)周目/) || [])[1] || 0), text: t };
  });
  const moved = (a, b) => b.wave !== a.wave || b.turn !== a.turn || b.loops !== a.loops;
  // 見張っているあいだ、ずっとその画面にいたか(途中で一度でもバトルへ飛んだら false)
  const stayOn = async (sel, ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (!(await has(sel))) return false;
      if (await has('button[aria-label^="AUTO"]')) return false;
      await page.waitForTimeout(400);
    }
    return has(sel);
  };

  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await pointerDown('TAP TO START');
    await page.waitForTimeout(2200);
    await pointerDown('トップ画面へ進む');
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // クイックで1ラン始めて、AUTO を ∞ まで回す(モンビーの検査と同じ手順)
    await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
    await page.waitForTimeout(600);
    await click('[data-battle-system="systemQuick"]');
    await page.waitForTimeout(2500);
    await clickText('この難易度で挑戦');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickText('勇者モンに選ぶ');
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300);
    await dismissOverlays();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickText('^習得する$');
    await page.waitForTimeout(3500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 25000 }).catch(() => {});
    check('クイックで∞周回を始められる', await cycleLabelTo('AUTO', 'AUTO ∞', 3));

    // ① 入口
    const entry = await page.waitForSelector('[data-quick-to-card]', { timeout: 20000 }).then(() => true).catch(() => false);
    check('① ∞周回中のバトル画面に MFバトルカードへの入口が出る', entry);
    if (SHOT) await shot('q0-battle-entry');

    // ② 入る → はじめてはスターター選び → 練習試合(CARD_BATTLE)を飛ばす → トップ
    await click('[data-quick-to-card]');
    await page.waitForSelector('[data-card-top="starter"],[data-card-top="top"]', { timeout: 20000 }).catch(() => {});
    if (await has('[data-card-top="starter"]')) {
      await click('[data-card-kit="powerful"]');
      await page.waitForTimeout(300);
      await clickText('にする$');
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 }).catch(() => {});
      check('③ 練習試合(対戦の画面)にいるあいだも、画面がバトルへ飛ばない', await stayOn('[data-card-battle]', 4000));
      check('④ 対戦中は帯を出さず、盤のヘッダーに「⚔ ◯周目」だけ出る',
        (await has('[data-card-battle-quick-run="live"]')) && !(await has('[data-card-quick-run]')),
        await page.evaluate(() => document.querySelector('[data-card-battle-quick-run]')?.textContent || 'なし'));
      if (SHOT) await shot('q2-battle-badge');
      await click('[data-card-quit]');
      await page.waitForTimeout(300);
      await page.evaluate(() => { [...document.querySelectorAll('[role="dialog"] button, button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit'))?.click(); });
      await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 }).catch(() => {});
      await clickText('^トップへ$');
    }
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 }).catch(() => {});
    check('② 周回を止めずに MFバトルカードのトップへ移れる', await has('[data-card-top="top"]'));
    check('② トップの上に周回の帯が出る(動いている)', await has('[data-card-quick-run="live"]') && await has('[data-card-quick-run-back]'));
    const stripStart = await readStrip();
    if (SHOT) { await page.waitForTimeout(1500); await shot('q1-top-strip'); }
    check('③ トップにいるあいだ、画面がバトルへ飛ばない', await stayOn('[data-card-top="top"]', WATCH_MS));
    const stripTop = await readStrip();
    check('③ トップにいるあいだも周回が進む(帯の WAVE・周目が動く)', moved(stripStart, stripTop), `${stripStart.text} → ${stripTop.text}`);

    // ③ トップの中の画面(デッキ編成・図鑑・ルール)。進んだかどうかは3つを通して見る(WAVE10 のボスは1体に時間がかかり、1画面ぶんでは動かないことがある)
    const stripTrio = await readStrip();
    for (const [open, sel, name] of [['[data-card-decks]', '[data-card-deck-list]', 'デッキ編成'], ['[data-card-dex-open]', '[data-card-dex]', '図鑑'], ['[data-card-rules-open]', '[data-card-rules]', 'ルール']]) {
      await click(open);
      await page.waitForSelector(sel, { timeout: 8000 }).catch(() => {});
      const s0 = await readStrip();
      const stayed = await stayOn(sel, WATCH_MS / 2);
      const s1 = await readStrip();
      check(`③ ${name}にいるあいだ、画面がバトルへ飛ばず、帯が出たまま`, stayed && await has('[data-card-quick-run]'), `${s0.text} → ${s1.text}`);
      if (SHOT && name === 'デッキ編成') await shot('q3-decks-strip');
      await page.evaluate((s) => document.querySelector(`${s} button`)?.click(), sel);
      await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 }).catch(() => {});
    }

    const stripTrioEnd = await readStrip();
    check('③ デッキ編成・図鑑・ルールにいるあいだも周回が進む', moved(stripTrio, stripTrioEnd), `${stripTrio.text} → ${stripTrioEnd.text}`);
    // ③ カードから開いたマーケット
    await click('[data-card-market-open]');
    await page.waitForSelector('[data-card-shop]', { timeout: 10000 }).catch(() => {});
    check('③ カードから開いたマーケットにいるあいだ、画面がバトルへ飛ばない', await stayOn('[data-card-shop]', WATCH_MS));
    await page.locator('[data-mh-screen] button').first().click().catch(() => {});
    await page.waitForSelector('[data-card-top="top"]', { timeout: 10000 }).catch(() => {});
    check('③ マーケットから戻ると、カードのトップ(帯つき)へ戻る', await has('[data-card-top="top"]') && await has('[data-card-quick-run="live"]'));

    // ③④ 助手と対戦(CARD_BATTLE)
    await click('[data-card-cpu]');
    await page.waitForTimeout(300);
    await click('[data-card-mode-assistant]');
    await page.waitForSelector('[data-card-foe]', { timeout: 10000 }).catch(() => {});
    await click('[data-card-foe="mua"]');
    await page.waitForTimeout(300);
    await click('[data-card-start]');
    await page.waitForSelector('[data-card-battle]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await dismissOverlays();
    const badge0 = await page.evaluate(() => document.querySelector('[data-card-battle-quick-run]')?.textContent || '');
    check('④ 助手との対戦中も、盤のヘッダーに「⚔ ◯周目」が出る(帯は出ない)', /⚔ \d+周目/.test(badge0) && !(await has('[data-card-quick-run]')), badge0);
    if (SHOT) await shot('q4-cpu-battle-badge');
    check('③ 助手と対戦しているあいだ、画面がバトルへ飛ばない', await stayOn('[data-card-battle]', WATCH_MS));
    // 投了して結果へ(自分の番が3回より前なので、カードポイントも周回も入らない)
    await click('[data-card-quit]');
    await page.waitForTimeout(300);
    await clickText('^投了する$');
    await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 }).catch(() => {});
    check('③ 対戦の結果の画面にも帯が出る', await has('[data-card-top="result"]') && await has('[data-card-quick-run]'));
    await clickText('^トップへ$');
    await page.waitForSelector('[data-card-top="top"]', { timeout: 10000 }).catch(() => {});

    // ⑤ 帯の「⚔ バトルへ」。カードにいたあいだに進んだかは、入った直後の帯と比べる
    const stripLast = await readStrip();
    check('⑤ カードにいたあいだに周回が進んでいる(帯の周目)', stripLast.loops > stripStart.loops, `${stripStart.text} → ${stripLast.text}`);
    await click('[data-card-quick-run-back]');
    const back = await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 15000 }).then(() => true, () => false);
    check('⑤ 帯の「⚔ バトルへ」でクイックのバトルへ戻れる', back);
    await page.waitForTimeout(1500);
    const afterCard = await readProgress();
    await page.waitForTimeout(WATCH_MS);
    const afterBack = await readProgress();
    check('⑤ バトルへ戻ったあとも周回が進む(戻ると止まる不具合の再発を見張る)', moved({ ...afterCard, loops: 0 }, { ...afterBack, loops: 0 }), `W${afterCard.wave}/T${afterCard.turn} → W${afterBack.wave}/T${afterBack.turn}`);

    // ⑥ もう一度入って「HOMEへ戻る」→ 周回を締めて HOME
    await page.waitForSelector('[data-quick-to-card]', { timeout: 20000 }).catch(() => {});
    await click('[data-quick-to-card]');
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 }).catch(() => {});
    check('⑥ バトルからもう一度カードへ入れる', await has('[data-card-top="top"]') && await has('[data-card-quick-run="live"]'));
    await page.evaluate(() => document.querySelector('[data-card-top="top"] header button')?.click());
    await page.waitForFunction(() => !document.querySelector('[data-card-top]'), { timeout: 15000 }).catch(() => {});
    // HOME へ戻ると、助手たちの会話(ハロウィン・ナイトなど)が自動で始まることがある。飛ばしてから見る
    for (let i = 0; i < 15 && !(await has('[data-home-card-battle]')); i++) { await page.waitForTimeout(800); await dismissOverlays(); }
    if (process.env.CARD_DEBUG_DIR && !(await has('[data-home-card-battle]'))) await page.screenshot({ path: path.join(process.env.CARD_DEBUG_DIR, 'home-miss.png') }).catch(() => {});
    check('⑥ 「HOMEへ戻る」で周回を締めて HOME へ抜ける(バトルの段階が残らない)',
      await page.evaluate(() => !document.querySelector('[data-card-top]') && !document.querySelector('button[aria-label^="AUTO"]') && !!document.querySelector('[data-home-card-battle]')),
      await page.evaluate(() => `card:${!!document.querySelector('[data-card-top]')} auto:${!!document.querySelector('button[aria-label^="AUTO"]')} home:${!!document.querySelector('[data-home-card-battle]')} ${(document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80)}`));

    check('⑦ 操作中に実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
