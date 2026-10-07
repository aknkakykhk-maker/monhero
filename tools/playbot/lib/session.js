// プレイボットの「1人ぶんのプレイ」。まっさらなブラウザを1つ開き、見張り・画面の読み取り・
// ボタンを押す道具をまとめて渡す。シナリオ(scenarios/*.js)はこの道具だけを使って遊ぶ。
const fs = require('fs');
const path = require('path');
const { createFakeSupabase } = require('./fake-supabase');

const BOT_NAME = 'モンヒロくん';

// 押さないボタン。まっさらなブラウザなので消えて困るデータは無いが、押すと探索が進まなくなるもの・
// 外へ出ていくもの・デバッグ専用のもの(プレイヤーには見えない)は避ける
const AVOID = /削除|初期化|リセット|引き継ぎ|データ移行|ログアウト|デバッグ|DEBUG|Debug|検証用|外部|公式サイト|X\(|Twitter|共有|シェア|コピー|ダウンロード|書き出し|読み込む|復元|あきらめる|ギブアップ|リタイア|フルスクリーン|全画面/;

// 見つけたものの分け方。「不具合候補」はまず直す対象、「改善のヒント」は遊びやすさの話
const HINT_KINDS = new Set(['反応なし', '小さいボタン', '読み込みが遅い', 'たどり着けない', '長い会話', '守りが足りない', '戻るでゲームの外へ出る', '下書きが黙って消える']);
// 調べた結果、意図どおりだと分かっている挙動。消さずに「既知」として報告の下のほうへ回す
// (同じものを毎回調べ直さないため)。足すときは、どこにそう書いてあるかを note に残す
const KNOWN = [
  { kind: '反応なし', screen: /^rhythm/, detail: /「ポーズ」/,
    note: 'カウントダウン中は止めない作り(30-rhythm-play.jsx の pause)。2026-10-07 からその間はボタンを薄く見せている' },
  { kind: '小さいボタン', screen: /./, detail: /^「1ページ目」/,
    note: 'ページ送りの点。すぐ下に助手の吹き出しがあり、下へは広げられない。押せる範囲は 22×18px(index.html の mh-hit-expand-dot)。左右の矢印とスワイプでも送れる' },
];

// 通信が止まっていることで出るだけのエラー(本物の不具合ではない)
const IGNORE_CONSOLE = /ERR_FAILED|ERR_BLOCKED|net::|Failed to load resource|AudioContext|play\(\) failed|NotAllowedError|autoplay|The play\(\) request/i;

async function openSession({ playwright, pageUrl, port, out, rand, persona, report }) {
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: !report.headed,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const page = await context.newPage();
  const supabase = createFakeSupabase();

  // ---- 通信: 手元以外は止める。Supabase だけは「にせの Supabase」が受け止める ----
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://localhost:${port}/`)) return route.continue();
    if (/supabase\.co/.test(url)) return supabase.handle(route);
    return route.abort();
  });
  // ゲームは自動操作のブラウザだと Supabase への書き込みを自分で止める(26-supabase.jsx)。
  // ここではにせの Supabase が受け止めるので、止めを外して書き込みを「にせ」へ届かせる
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });

  const state = { step: 0, scenario: '', errorsRead: 0 };
  const errorLog = [];
  // ゲームの外のページ(ブラウザの戻るで出た about:blank など)で出たエラーは数えない
  page.on('pageerror', (e) => !page.url().startsWith(`http://localhost:${port}/`) ? null : errorLog.push({ step: state.step, kind: 'pageerror', text: String((e && e.message) || e) }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORE_CONSOLE.test(text)) return;
    errorLog.push({ step: state.step, kind: 'console', text });
  });

  const s = {
    browser, context, page, supabase, rand, persona, state, BOT_NAME,
    wait: (ms) => page.waitForTimeout(ms),
    // 人が画面を読む間。毎回少しずつ違う
    think: (base = 450) => page.waitForTimeout(base + Math.floor(rand() * base * 0.7)),
  };

  s.shot = async (label) => {
    report.shotNo += 1;
    const name = `${String(report.shotNo).padStart(3, '0')}-${persona}-${label.replace(/[^\w぀-ヿ一-鿿-]+/g, '_').slice(0, 40)}.png`;
    await page.screenshot({ path: path.join(out, name) }).catch(() => {});
    return name;
  };

  // gameState はページの外から見えないので、テーマの分類と、いちばん上に見えている見出しで画面を呼び分ける
  s.screenName = () => page.evaluate(() => {
    const app = document.querySelector('.mh-app');
    const cat = app ? app.getAttribute('data-mh-theme-category') || '' : '';
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const dialog = [...document.querySelectorAll('[role="dialog"]')].filter(vis).pop();
    const scope = dialog || document;
    const head = [...scope.querySelectorAll('h1,h2,h3')].filter(vis)
      .map((h) => (h.innerText || '').replace(/\s+/g, ' ').trim()).find((t) => t && t.length <= 30);
    if (document.querySelector('[data-rhythm-play-area]')) return 'rhythm:演奏中';
    if (document.querySelector('.mh-home-scene') && !dialog) return 'HOME';
    return `${cat || '-'}${dialog ? '/dialog' : ''}:${head || '(見出しなし)'}`;
  }).catch(() => '?');

  const issueKeys = report.issueKeys;
  s.addIssue = async (kind, detail, extra = {}) => {
    // 同じ種類・同じ中身は1回だけ記録する(画像も1枚だけ)
    const key = `${kind}|${String(detail).slice(0, 120)}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    const screen = await s.screenName();
    const image = await s.shot(kind);
    const known = KNOWN.find((k) => k.kind === kind && k.screen.test(screen) && k.detail.test(String(detail)));
    const level = known ? '既知' : HINT_KINDS.has(kind) ? '改善のヒント' : '不具合候補';
    report.issues.push({ kind, level, known: known ? known.note : null, detail: String(detail), persona, scenario: state.scenario,
      step: state.step, screen, image, recentSteps: report.steps.filter((x) => x.persona === persona).slice(-6), ...extra });
    console.log(`  ${level === '不具合候補' ? '⚠' : '・'} [${level}] ${kind}: ${String(detail).slice(0, 100)} (${persona}/${screen})`);
  };

  // 押せるもの(見えていて、無効でなく、上に何も重なっていないもの)
  s.listButtons = () => page.evaluate((avoidSrc) => {
    const avoid = new RegExp(avoidSrc);
    const out = [];
    const els = [...document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"], input[type="radio"], select')];
    els.forEach((el) => {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.tagName === 'A' && (el.target === '_blank' || /^https?:/.test(el.getAttribute('href') || ''))) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
      const top = document.elementFromPoint(cx, cy);
      if (!top || !(top === el || el.contains(top) || top.contains(el))) return;
      const label = (el.getAttribute('aria-label') || el.innerText || el.title || el.tagName)
        .replace(/\s+/g, ' ').trim().slice(0, 40) || `(無名の${el.tagName.toLowerCase()})`;
      if (avoid.test(label)) return;
      // 画面に重なった窓(会話・お知らせ)の中か。HOME のセリフ欄の「次へ」などと見分ける
      let overlay = false;
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (e.getAttribute && e.getAttribute('role') === 'dialog') { overlay = true; break; }
        const st = getComputedStyle(e);
        if (st.position === 'fixed' && (Number(st.zIndex) || 0) >= 50) { overlay = true; break; }
      }
      // 押せる大きさは、見た目の箱に ::before で広げた分(index.html の mh-hit-expand)を足したもの
      let hw = r.width, hh = r.height;
      const bf = getComputedStyle(el, '::before');
      if (bf.content && bf.content !== 'none' && bf.position === 'absolute') {
        const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
        hw += Math.max(0, -px(bf.left)) + Math.max(0, -px(bf.right));
        hh += Math.max(0, -px(bf.top)) + Math.max(0, -px(bf.bottom));
      }
      out.push({ label, x: cx, y: cy, w: hw, h: hh, tag: el.tagName, overlay });
    });
    return out;
  }, AVOID.source).catch(() => []);

  s.health = () => page.evaluate(() => {
    const root = document.getElementById('root');
    const text = ((document.body && document.body.innerText) || '').trim();
    const doc = document.documentElement;
    return {
      // タイトル画面のように文字が無く絵だけの画面もあるので、絵(img / canvas / 背景画像)があれば描けている
      blank: !root || root.childElementCount === 0 || (text.length === 0 && ![...document.querySelectorAll('img,canvas,video')].some((el) => { const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40; })
        && ![...root.querySelectorAll('*')].slice(0, 400).some((el) => (getComputedStyle(el).backgroundImage || 'none') !== 'none')),
      overflowX: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0) - innerWidth,
      text: text.slice(0, 2000),
    };
  }).catch(() => null);

  // 押したあとの確認をまとめて行う
  s.inspect = async () => {
    const h = await s.health();
    if (h) {
      if (h.blank) await s.addIssue('真っ白', '画面に何も描かれていない');
      if (h.overflowX > 2) await s.addIssue('横はみ出し', `ページが画面幅より ${Math.round(h.overflowX)}px 広い`);
    }
    while (state.errorsRead < errorLog.length) {
      const e = errorLog[state.errorsRead++];
      await s.addIssue(e.kind === 'pageerror' ? 'JSエラー' : 'コンソールエラー', e.text);
    }
    const name = await s.screenName();
    if (!report.screens.has(name)) {
      report.screens.set(name, { persona, scenario: state.scenario, step: state.step, image: await s.shot(`screen-${name}`) });
      // 指で押しにくい小さなボタン(32px未満)。画面を初めて見たときだけ数える
      const small = (await s.listButtons()).filter((b) => (b.w < 32 || b.h < 32) && !/^\(無名/.test(b.label));
      if (small.length >= 3) await s.addIssue('小さいボタン', `「${small.slice(0, 4).map((b) => b.label).join('」「')}」など${small.length}個が32px未満`);
    }
    return { name, h };
  };

  s.tap = async (b, why = '') => {
    report.steps.push({ persona, scenario: state.scenario, step: state.step, screen: await s.screenName(), label: b.label, why });
    await page.mouse.click(b.x, b.y);
    await s.think();
  };

  s.tapLabel = async (pattern, wait = 900) => {
    const b = (await s.listButtons()).find((x) => pattern.test(x.label));
    if (!b) return false;
    report.steps.push({ persona, scenario: state.scenario, step: state.step, screen: await s.screenName(), label: b.label, why: 'シナリオ' });
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(wait);
    return true;
  };

  // 名前の入力欄が空なら、人と同じように名前を打ち込む
  s.fillEmptyInputs = async () => {
    const boxes = await page.$$('input[type="text"]:not([readonly]), input:not([type]):not([readonly]), textarea:not([readonly])');
    let filled = 0;
    for (const box of boxes) {
      const ok = await box.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && !el.value;
      }).catch(() => false);
      if (!ok) continue;
      await box.click().catch(() => {});
      await box.type(BOT_NAME, { delay: 60 }).catch(() => {});
      filled += 1;
    }
    return filled;
  };

  // 重なった案内・会話・ログインボーナスを閉じる。
  // ★会話(イベントのお話など)は「次へ」を何十回も押すことになるので、「スキップ」を先に押す
  s.dismissOverlays = async (max = 40) => {
    let first = '', firstShot = '', pressed = 0;
    for (let i = 0; i < max; i++) {
      const list = await s.listButtons();
      const b = list.find((x) => x.overlay && /^スキップ$/.test(x.label))
        || list.find((x) => x.overlay && /^(確認|閉じる|OK|受け取る|次へ|わかった！?|はい|とじる|×|今は見ない)$/.test(x.label));
      if (!b) break;
      if (!first) {
        first = await page.evaluate(({ x, y }) => {
          for (let e = document.elementFromPoint(x, y); e && e !== document.body; e = e.parentElement) {
            const st = getComputedStyle(e);
            if (e.getAttribute('role') === 'dialog' || (st.position === 'fixed' && (Number(st.zIndex) || 0) >= 50)) return e.innerText || '';
          }
          return '';
        }, { x: b.x, y: b.y }).catch(() => '');
        firstShot = await s.shot('long-talk');
      }
      await s.tap(b, '重なりを閉じる');
      pressed += 1;
    }
    // スキップの無い長い会話は、遊ぶ人にとっても長い。何の会話かを残す
    if (pressed >= 12) await s.addIssue('長い会話', `スキップできない会話で${pressed}回押した: ${first.replace(/\s+/g, ' ').slice(0, 160)}`, { firstImage: firstShot });
  };

  s.boot = async ({ toHome = true } = {}) => {
    const t0 = Date.now();
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    await s.tapLabel(/TAP TO START/, 2200);
    if (!toHome) return { loadMs };
    await s.tapLabel(/トップ画面へ進む/, 2200);
    await s.dismissOverlays();
    await page.waitForFunction(() => !!document.querySelector('.mh-home-scene'), { timeout: 20000 });
    return { loadMs, homeMs: Date.now() - t0 };
  };

  // HOME に着いているか。★HOME の上に窓(更新履歴など)が開いたままでも .mh-home-scene はあるので、
  //   重なった窓が無いことまで見る(見ないと、窓の下の HOME を「着いた」と取り違える)
  //   更新履歴の窓は role="dialog" を持たないので、HOME の「モンヒロバトル」が上に何も重ならず押せるかで見る
  const atHome = () => page.evaluate(() => {
    if (!document.querySelector('.mh-home-scene')) return false;
    const b = document.querySelector('button[aria-label="モンヒロバトル"]');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === b || b.contains(top));
  }).catch(() => false);
  s.backHome = async () => {
    for (let i = 0; i < 6; i++) {
      if (await atHome()) return true;
      await s.dismissOverlays(6);
      if (await atHome()) return true;
      // 窓の閉じるボタンは「更新履歴を閉じる」「×」のように名前がまちまち
      const close = (await s.listButtons()).find((b) => b.overlay && /閉じる|とじる|^×$|^✕$/.test(b.label));
      if (close) { await s.tap(close, 'HOME へ戻る(窓を閉じる)'); continue; }
      if (!(await s.tapLabel(/^(戻る|もどる|HOMEへ|ホームへ|HOME|←|トップへ戻る)$/, 900))) break;
    }
    if (await atHome()) return true;
    await s.boot().catch(async (e) => { await s.addIssue('進めない', `HOMEへ戻れない: ${e.message}`); });
    return true;
  };

  s.close = async () => { await browser.close().catch(() => {}); };
  return s;
}

module.exports = { openSession, BOT_NAME };
