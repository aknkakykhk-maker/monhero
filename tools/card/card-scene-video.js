// MFバトルカードの紹介動画 第3弾(2026-11-06・ソランド部長の依頼。社長の「この案で撮る」済み)の場面を、実際のブラウザで撮って mp4 にする。
//
//   node tools/card/card-scene-video.js              (d)(e)(f) を全部撮る
//   node tools/card/card-scene-video.js d f          撮る場面をえらぶ
//   CARD_VIDEO_DIR=<フォルダ> を付けると出し先を変える(既定は docs/progress/card-intro-video-3/)
//
// 形(第3弾の全員共通): 縦 390×844 を deviceScaleFactor 2(= 780×1688)で、場面ごとに mp4(音なし)。8〜14秒。
//   main の公開済みの画面だけ。デバッグのボタンや合言葉の欄は映さない(入口は HOME の「MFバトルカード」)。
//   偽のデータで撮る: 自分は「モンヒロ太郎」。ほかのブリーダーの本名・デッキ名は出さない(観戦の2人も作った名前)。
//   本物の保存・ランキングには触れない(撮影用のブラウザの中だけ。Supabase への通信は空の答えを返す)
//
// 場面(ファイル名は場面の記号を先頭に。(a)(b)(c)はほかの人が同じフォルダへ入れる)
//   d-vs.mp4             助手と対戦: 「対戦へ」を押す → VS の画面(えるびんの一言)→ 3体ずつ飛び込む → 盤面
//   e-watch.mp4          マルチ観戦: 上の帯「◯◯の攻撃」と、全体カードの札「(◯◯が出した)」が見える数秒(#4558 で直した所)。
//                        観戦の盤面(CardBattleBoard の watch の形。card-watch-board-browser-check.js と同じ作り)へ、
//                        コンピューターどうしの試合を1手ずつ流す
//   f-dex-deck.mp4       図鑑 → デッキ編成: 図鑑を送る → 戻る → デッキ編成 → 組む
//
// 撮り方: 場面の所だけ、ブラウザの画面配信(CDP の Page.startScreencast)でコマを時刻つきで集め、ffmpeg で 30コマ/秒の mp4 に組む。
//   Playwright の recordVideo は deviceScaleFactor 2 でも 390幅のまま描く(780幅の枠の左半分に入るだけ)ので使わない。
//   起動・スターター選びなどの準備の所は集めないので、動画に残らない
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const starterOpenPass = require(path.join(__dirname, 'lib/starter-open-pass.js'));

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8961;
const OUT = path.resolve(process.env.CARD_VIDEO_DIR || path.join(ROOT, 'docs/progress/card-intro-video-3'));
const W = 390, H = 844, DPR = 2;
const ME = 'モンヒロ太郎';
// 観戦の2人(作った名前。6文字以内なので、上の帯は「◯◯の攻撃」になる)
const WATCH_TOP = { name: 'ソラマメ', icon: '🫛' };
const WATCH_BOTTOM = { name: 'ヒナタ', icon: '🌻' };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 起動 → HOME → HOME の「MFバトルカード」→ スターター(一撃必殺パワフルチーム)→ 練習試合を飛ばす → カードのトップ
const bootToCardTop = async (page) => {
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 120000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.locator('[data-home-card-battle]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(受け取る|閉じる|OK|(?:分|わ)かった！?|あとで)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
    if (!closed) break;
    await page.waitForTimeout(400);
  }
  await page.locator('[data-home-card-battle]').dispatchEvent('click');
  const top = page.locator('[data-card-top="top"]'), starter = page.locator('[data-card-top="starter"]');
  await Promise.race([top.waitFor({ timeout: 30000 }), starter.waitFor({ timeout: 30000 })]);
  if (await starter.count()) {
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await starterOpenPass(page);
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
  }
  await top.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
};

// 撮影用のブラウザの中だけで、持っている札を増やす(図鑑が「まだ」ばかりにならないように)。決まった並びで、ほぼ3枚に2枚
const fillCollection = (page) => page.evaluate(() => {
  const db = CARD_BATTLE_DATA;
  const nos = [...Object.keys(db.cards || {}), ...Object.keys(db.monsters || {})];
  const col = JSON.parse(localStorage.getItem('mh_card_collection_v1') || '{}');
  nos.forEach((no, i) => { if (i % 3 !== 2 && !col[no]) col[no] = 1 + (i % 2); });
  localStorage.setItem('mh_card_collection_v1', JSON.stringify(col));
  return Object.keys(col).length;
});

const smoothScroll = (page, sel, dy, ms) => page.evaluate(({ sel, dy, ms }) => new Promise((res) => {
  const root = document.querySelector(sel);
  const el = root && [root, ...root.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  if (!el) { res(false); return; }
  const from = el.scrollTop, t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / ms); el.scrollTop = from + dy * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); if (k < 1) requestAnimationFrame(tick); else res(true); };
  requestAnimationFrame(tick);
}), { sel, dy, ms });

const SCENES = {
  // (d) 助手と対戦: 相手えらびまでは準備(動画に残さない)。「対戦へ」を押した所から撮る
  d: {
    file: 'd-vs.mp4',
    prepare: async (page) => {
      await page.locator('[data-card-cpu]').click();
      await page.getByRole('button', { name: 'わかった' }).click({ timeout: 3000 }).catch(() => {});
      await page.locator('[data-card-top] button').filter({ hasText: 'フリー対戦' }).first().click();
      await page.locator('[data-card-foe="erubin"]').click();
      await page.locator('[data-card-level="normal"]').click().catch(() => {});
      await page.locator('[data-card-start]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(800);
    },
    // 相手えらび(えるびんをえらんだ所)→「対戦する」→「対戦へ」→ VS → 盤面
    run: async (page) => {
      await page.waitForTimeout(1200);
      await page.locator('[data-card-start]').click();
      await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1100);
      await page.locator('[data-card-deck-pick-go]').click();
      await page.locator('[data-card-vs-line]').waitFor({ timeout: 10000 });
      await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(3800); // 盤面に変わってから、相手の一言の吹き出しが出て消えるまで
    },
  },
  // (e) マルチ観戦: 全体カードが出る試合を先に探し、その少し手前まで静かに進めた盤面を出してから撮る
  e: {
    file: 'e-watch.mp4',
    prepare: async (page, names) => {
      const info = await page.evaluate(({ top, bottom }) => {
        const db = CARD_BATTLE_DATA;
        const pol = cardAiPolicy('kyuko', 'normal');
        const decksOf = (g) => [cardAiBuildDeck(db, 'momosuke', 'master', cardAiSeededRand(`v0:${g}`)), cardAiBuildDeck(db, 'kiki', 'master', cardAiSeededRand(`v1:${g}`))];
        const mk = (g) => cardCreateGame(db, { decks: decksOf(g), names: [bottom.name, top.name], seed: 11 + g, first: g % 2 });
        const stepOf = (st, rand) => {
          const a = cardAiChooseAction(db, st, pol, rand); const n = a && cardApplyAction(db, st, a);
          const fb = !n && (st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null);
          return n || (fb && cardApplyAction(db, st, fb)) || null;
        };
        const randOf = (sd) => { let x = sd; return () => { const n = cardRngNext(x); x = n.s; return n.v; }; };
        // 全体カードが出る手を探す(出る手の何手か前から撮る)
        let pick = -1, at = -1;
        for (let g = 0; g < 60 && pick < 0; g++) {
          let st = mk(g); const r = randOf(500 + g);
          for (let k = 0; k < 160 && st.winner === null; k++) {
            const n = stepOf(st, r); if (!n) break;
            if (!st.field && n.field) { pick = g; at = k; break; }
            st = n;
          }
        }
        if (pick < 0) return null;
        let st = mk(pick); const rand = randOf(500 + pick);
        const lead = Math.max(0, at - 6); // 全体カードの6手前から流す
        for (let k = 0; k < lead; k++) st = stepOf(st, rand) || st;
        const V = window.__video = { handler: null, st };
        V.push = () => { const n = stepOf(V.st, rand); if (!n) return false; V.st = n; if (V.handler) V.handler.onState(n, false); return true; };
        const game = { key: 'video-watch', st, watch: { top, bottom: { name: bottom.name }, attach: (h) => { V.handler = h; return () => { if (V.handler === h) V.handler = null; }; } } };
        const host = document.createElement('div');
        host.id = 'video-watch-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
        document.body.appendChild(host);
        const el = React.createElement(CardBattleBoard, { db, game, onFinish: () => {}, meProfile: { name: bottom.name } });
        (ReactDOM.createRoot ? ReactDOM.createRoot(host).render(el) : ReactDOM.render(el, host));
        return { pick, at, lead };
      }, names);
      if (!info) throw new Error('全体カードが出る試合が見つからない');
      await page.locator('#video-watch-host [data-card-head]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1500);
    },
    run: async (page) => {
      // 1手ずつ、動きが見える間を置いて流す。全体カードの札が出てから4秒は見せる
      let seenField = 0;
      for (let k = 0; k < 14; k++) {
        const ok = await page.evaluate(() => window.__video.push());
        await page.waitForTimeout(1100);
        if (await page.locator('#video-watch-host [data-card-env]').count()) seenField++;
        if (!ok || seenField >= 4) break;
      }
      await page.waitForTimeout(1200);
    },
  },
  // (f) 図鑑 → デッキ編成: 持っている札を増やしてから入り直す(準備)。トップから撮る
  f: {
    file: 'f-dex-deck.mp4',
    prepare: async (page) => {
      await fillCollection(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await bootToCardTop(page);
    },
    run: async (page) => {
      await page.waitForTimeout(700);
      await page.locator('[data-card-dex-open]').click();
      await page.locator('[data-card-dex]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(900);
      await smoothScroll(page, '[data-card-dex]', 900, 2600);
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: '戻る' }).first().click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(700);
      await page.locator('[data-card-decks]').click();
      await page.locator('[data-card-deck-open]').first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(1100);
      await page.locator('[data-card-deck-open]').first().click();
      await page.locator('[data-card-deck-edit]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1200);
      await smoothScroll(page, '[data-card-deck-edit]', 500, 1800);
      await page.waitForTimeout(900);
    },
  },
};

const shootScene = async (browser, key) => {
  const scene = SCENES[key];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-scene-'));
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, serviceWorkers: 'block' });
  const errors = [];
  try {
    // Supabase(ランキング・共有デッキなど)へは出さない。空の答えを返す
    await ctx.route(/supabase\.co\/|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript((me) => {
      if (sessionStorage.getItem('__cardVideoSeeded')) return;
      sessionStorage.setItem('__cardVideoSeeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', me); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    }, ME);
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await bootToCardTop(page);
    await scene.prepare(page, { top: WATCH_TOP, bottom: WATCH_BOTTOM });
    // ここから場面。画面配信のコマ(2倍の細かさ)を時刻つきで集める
    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', (f) => {
      const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, t: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
    await page.waitForTimeout(300);
    await scene.run(page);
    const t1 = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    if (frames.length < 2) throw new Error('コマが集まらない');
    // コマごとの長さ(次のコマまで)。最後のコマは場面の終わりまで
    const lines = [];
    // コマの時刻(metadata.timestamp)は秒。最後のコマは、場面の終わり(t1)まで見せる
    frames.forEach((fr, i) => {
      const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(fr.t + 0.1, t1);
      lines.push(`file '${fr.file}'`, `duration ${Math.max(0.001, next - fr.t).toFixed(4)}`);
    });
    lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    const out = path.join(OUT, scene.file);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an',
      '-vf', `fps=30,scale=${W * DPR}:${H * DPR}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out]);
    const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim()) || 0;
    console.log(`${key}: ${path.relative(ROOT, out)}(${sec.toFixed(1)}秒・${frames.length}コマ・${(fs.statSync(out).size / 1024).toFixed(0)}KB)${errors.length ? ` 実行時エラー: ${errors.slice(0, 2).join(' / ')}` : ''}`);
    return errors.length === 0;
  } finally {
    await ctx.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

(async () => {
  const keys = process.argv.slice(2).filter((k) => SCENES[k]);
  const list = keys.length ? keys : Object.keys(SCENES);
  fs.mkdirSync(OUT, { recursive: true });
  const playwright = require('playwright');
  const server = await serve();
  const browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  let ok = true;
  try {
    for (const k of list) ok = (await shootScene(browser, k)) && ok;
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
