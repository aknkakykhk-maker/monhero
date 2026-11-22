#!/usr/bin/env node
// 曲鑑賞(オートプレイ)の案の止め絵を撮る(r1119-112・2026-11-22 ビート)。ゲームには何も入れていない。
//   node docs/progress/beat/auto-listen-plan/shoot.js
// 本物の画面(main)を開き、見本の部品を DOM に差し込んで撮る。偽の Supabase・手元以外の通信は止める。
// iPhone の切り欠きの余白(縦 上47・下34 / 横 左右47・下21)を --mh-safe-* から入れる(visual-shoot.js の SHOT_NOTCH と同じ)。
// 曲は「MF × ICHIKA MIX」の HARD(イベントの曲は使わない)。演奏はボット(ずれ0)に叩かせて、途中で撮る。
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const OUT = __dirname;
const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT, 'tools/playbot/lib/touch-input.js'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const SONG = 'MF × ICHIKA MIX';
const SIZES = [{ tag: 'tate', w: 390, h: 844 }, { tag: 'yoko', w: 844, h: 390 }];
const PLANS = ['now', 'A', 'B', 'C'];

// ---- 見本の部品(案ごと)。どれも position:fixed の差し込みと、今ある部品の文字・見え方の上書きだけ ----
const MOCK = {
  select: {
    A: () => {
      const go = [...document.querySelectorAll('button')].find((b) => /^(▶\s*)?決定$/.test(b.textContent.trim()));
      const btn = document.createElement('button');
      btn.className = 'mock-a-listen';
      btn.innerHTML = '<span style="font-size:20px;line-height:1">🎧</span><span style="font-size:11px;font-weight:900;line-height:1.1">鑑賞</span>';
      btn.style.cssText = `flex:0 0 auto;width:62px;align-self:stretch;min-height:${go.getBoundingClientRect().height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:14px;border:2px solid #5eead4;background:linear-gradient(180deg,#134e4a,#0f3d3a);color:#ccfbf1;box-shadow:0 0 0 3px rgba(250,204,21,.9),0 0 18px rgba(45,212,191,.45)`;
      go.after(btn);
      go.style.minWidth = '0';
    },
    B: () => {
      const jacket = [...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width >= 80).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      const src = jacket ? jacket.src : '';
      // 入口: 選んでいる曲の行に「ⓘ 詳細」(押すと曲の詳細の窓)
      const row = [...document.querySelectorAll('[data-rhythm-song-row]')].find((e) => e.textContent.includes('MF × ICHIKA MIX') && e.getBoundingClientRect().top > 0);
      if (row) {
        const r = row.getBoundingClientRect();
        const badge = document.createElement('div');
        badge.style.cssText = `position:fixed;left:${r.right - 70}px;top:${r.top + r.height / 2 - 15}px;width:60px;height:30px;border-radius:10px;background:#0f3d3a;border:2px solid #5eead4;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#ccfbf1;z-index:100000;box-shadow:0 0 0 3px rgba(250,204,21,.9)`;
        badge.textContent = 'ⓘ 詳細';
        document.body.appendChild(badge);
      }
      const land = innerWidth > innerHeight;
      const chip = (n, d, on, lock) => `<div style="flex:1;min-width:0;border-radius:10px;padding:4px 0;text-align:center;border:2px solid ${on ? '#facc15' : lock ? '#334155' : '#475569'};background:${on ? '#422006' : '#0f172a'};color:${lock ? '#64748b' : '#f8fafc'}"><div style="font-size:15px;font-weight:900">${n}</div><div style="font-size:8px;font-weight:800">${d}${lock ? ' 🔒' : ''}</div></div>`;
      const chips = `<div style="display:flex;gap:4px">${chip(7, 'EASY')}${chip(9, 'NORMAL')}${chip(13, 'HARD', true)}${chip(20, 'EXPERT', 0, 1)}${chip(25, 'MASTER', 0, 1)}</div>`;
      const head = `<div style="display:flex;gap:10px;align-items:center"><img src="${src}" style="width:${land ? 64 : 76}px;height:${land ? 64 : 76}px;border-radius:12px;object-fit:cover;flex:0 0 auto"><div style="min-width:0">
        <div style="font-size:11px;font-weight:900;color:#5eead4;letter-spacing:.08em">曲の詳細</div>
        <div style="font-size:18px;font-weight:900;color:#fff;margin:1px 0">MF × ICHIKA MIX</div>
        <div style="font-size:11px;color:#cbd5e1">BPM 169 ・ 2分25秒 ・ 316ノーツ</div></div></div>`;
      const body = `${head}
        <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px">鑑賞する譜面</div>${chips}
        <button style="margin-top:9px;width:100%;height:48px;border-radius:14px;border:0;background:linear-gradient(90deg,#14b8a6,#0ea5e9);color:#fff;font-size:16px;font-weight:900;box-shadow:0 0 0 3px rgba(250,204,21,.9)">🎧 この譜面を鑑賞する</button>
        <div style="font-size:9.5px;color:#94a3b8;margin-top:5px;text-align:center">鑑賞はスコア・ランキング・ビートPに載りません</div>
        <button style="margin-top:7px;width:100%;height:36px;border-radius:12px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font-size:13px;font-weight:800">閉じる</button>`;
      const dim = document.createElement('div');
      dim.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(2,6,23,.55)';
      document.body.appendChild(dim);
      const sheet = document.createElement('div');
      sheet.style.cssText = land
        ? 'position:fixed;z-index:99999;top:8px;bottom:calc(var(--mh-safe-bottom,0px) + 8px);right:calc(var(--mh-safe-right,0px) + 8px);width:46%;box-sizing:border-box;background:#111827;border:1px solid #334155;border-radius:18px;padding:12px 14px;overflow:hidden'
        : 'position:fixed;z-index:99999;left:0;right:0;bottom:0;box-sizing:border-box;background:#111827;border-top:1px solid #334155;border-radius:20px 20px 0 0;padding:14px 16px calc(var(--mh-safe-bottom,0px) + 12px)';
      sheet.innerHTML = body;
      document.body.appendChild(sheet);
    },
    C: () => {
      // 上に「🎵 ライブ / 🎧 鑑賞」の切り替え。鑑賞の側を開いた形
      const genre = [...document.querySelectorAll('button')].find((b) => /^ジャンル/.test(b.textContent.trim()));
      const row = genre && genre.parentElement;
      const tab = document.createElement('div');
      tab.style.cssText = 'display:flex;gap:6px;margin:0 0 6px;padding:3px;border-radius:14px;background:#0f172a;border:1px solid #334155;flex:0 0 auto;box-shadow:0 0 0 3px rgba(250,204,21,.9)';
      tab.innerHTML = '<div style="flex:1;text-align:center;padding:7px 0;border-radius:11px;color:#94a3b8;font-weight:900;font-size:13px">🎵 ライブ</div><div style="flex:1;text-align:center;padding:7px 0;border-radius:11px;background:linear-gradient(90deg,#14b8a6,#0ea5e9);color:#fff;font-weight:900;font-size:13px">🎧 鑑賞</div>';
      const quick = [...document.querySelectorAll('*')].filter((e) => (e.textContent || '').includes('裏でクイック') && e.getBoundingClientRect().width > 150 && e.getBoundingClientRect().height < 60).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      if (innerWidth > innerHeight && quick) {
        // 横: 細い列には入らないので、上の帯(裏でクイック…)の場所に重ねる
        const q = quick.getBoundingClientRect();
        tab.style.cssText += `;position:fixed;z-index:99999;left:${q.left}px;top:${q.top}px;width:${q.width}px;height:${Math.max(34, q.height)}px;box-sizing:border-box;margin:0`;
        document.body.appendChild(tab);
      } else if (row) row.before(tab);
      const go = [...document.querySelectorAll('button')].find((b) => /^(▶\s*)?決定$/.test(b.textContent.trim()));
      if (go) { go.innerHTML = '<span style="font-weight:900">🎧 鑑賞スタート</span>'; go.style.background = 'linear-gradient(90deg,#14b8a6,#0ea5e9)'; go.style.boxShadow = '0 0 0 3px rgba(250,204,21,.9)'; }
      const rnd = [...document.querySelectorAll('button')].filter((b) => /^🎲?\s*ランダム$/.test(b.textContent.trim()) || /ランダム/.test(b.textContent) && b.textContent.trim().length < 8).pop();
      if (rnd) rnd.innerHTML = '<div style="font-size:16px;line-height:1">🔁</div><div style="font-size:10px;font-weight:900">連続 ON</div>';
      // HIGH SCORE の箱の中身を鑑賞の説明へ
      const hs = [...document.querySelectorAll('*')].find((e) => e.children.length > 0 && /^HIGH SCORE/.test((e.textContent || '').trim()) && e.getBoundingClientRect().height < 120);
      if (hs) hs.innerHTML = '<div style="font-size:10px;font-weight:900;color:#5eead4;letter-spacing:.06em">🎧 鑑賞モード</div><div style="font-size:11px;color:#e2e8f0;margin-top:3px;line-height:1.35">ノーツが自動で叩かれます。<br>スコア・ランキングには載りません</div>';
      // 一覧の行の「未プレイ」を鑑賞の言い方へ
      document.querySelectorAll('[data-rhythm-song-row-rank]').forEach((e) => { e.textContent = '🎧 鑑賞できる'; e.style.color = '#5eead4'; });
    },
  },
  play: {
    A: () => {
      // スコアの欄を「🎧 鑑賞中」に置き換え。判定の文字はそのまま出す。ライフ・運のポイントは隠す
      const css = document.createElement('style');
      css.textContent = '[data-rhythm-life],[data-rhythm-luck],[data-rhythm-rank-gauge],[data-rhythm-rank-next]{visibility:hidden!important}';
      document.head.appendChild(css);
      const sc = document.querySelector('[data-rhythm-score]');
      if (sc) { sc.textContent = '🎧 鑑賞中'; sc.style.color = '#5eead4'; sc.style.fontSize = '15px'; sc.style.whiteSpace = 'nowrap'; }
      const rk = document.querySelector('[data-rhythm-rank]'); if (rk) rk.textContent = '♪';
      document.querySelectorAll('[data-rhythm-hud-left] *').forEach((e) => { if (/^BEST/.test((e.textContent || '').trim()) && !e.children.length) e.textContent = 'HARD の譜面'; });
      const note = document.createElement('div');
      note.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--mh-safe-bottom,0px) + 10px);z-index:99999;font-size:10.5px;font-weight:800;color:#e2e8f0;background:rgba(15,23,42,.82);border:1px solid #334155;border-radius:999px;padding:5px 12px;white-space:nowrap;box-shadow:0 0 0 2px rgba(250,204,21,.9)';
      note.textContent = '🎧 鑑賞中 — スコア・ランキング・ビートPには載りません';
      document.body.appendChild(note);
    },
    B: () => {
      // 判定の文字・スコア・ライフを消し、下に再生の操作の帯(10秒戻す/止める/10秒送る・どこまで流れたか)
      const css = document.createElement('style');
      css.textContent = '[data-rhythm-judgment-display],[data-rhythm-life],[data-rhythm-luck],[data-rhythm-score],[data-rhythm-rank-ring],[data-rhythm-rank],[data-rhythm-rank-gauge],[data-rhythm-rank-next],[data-rhythm-mode-label],[data-rhythm-song-clock],[data-rhythm-pause]{visibility:hidden!important}[data-rhythm-hud-left] small{visibility:hidden!important}';
      document.head.appendChild(css);
      hideCombo();
      document.querySelector('[data-rhythm-hud]').style.visibility = 'hidden';
      const land = innerWidth > innerHeight;
      const top = document.createElement('div');
      top.style.cssText = 'position:fixed;top:calc(var(--mh-safe-top,0px) + 8px);right:calc(var(--mh-safe-right,0px) + 10px);z-index:99999;display:flex;gap:6px;align-items:center';
      top.innerHTML = '<span style="font-size:11px;font-weight:900;color:#5eead4;background:rgba(15,23,42,.85);border:1px solid #134e4a;border-radius:999px;padding:5px 10px">🎧 MF × ICHIKA MIX・HARD</span><span style="width:38px;height:38px;border-radius:50%;background:rgba(15,23,42,.85);border:1px solid #475569;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900">✕</span>';
      document.body.appendChild(top);
      const bar = document.createElement('div');
      bar.style.cssText = `position:fixed;z-index:99999;left:calc(var(--mh-safe-left,0px) + ${land ? 120 : 10}px);right:calc(var(--mh-safe-right,0px) + ${land ? 120 : 10}px);bottom:calc(var(--mh-safe-bottom,0px) + 8px);background:rgba(15,23,42,.9);border:1px solid #334155;border-radius:16px;padding:8px 12px;box-shadow:0 0 0 3px rgba(250,204,21,.9)`;
      const b = (t, big) => `<span style="flex:0 0 auto;width:${big ? 48 : 44}px;height:${big ? 48 : 40}px;border-radius:${big ? '50%' : '12px'};display:flex;align-items:center;justify-content:center;background:${big ? 'linear-gradient(180deg,#14b8a6,#0e7490)' : '#1e293b'};border:1px solid #475569;color:#fff;font-size:${big ? 20 : 12}px;font-weight:900">${t}</span>`;
      bar.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:#cbd5e1;font-weight:800"><span>1:38</span><div style="flex:1;height:6px;border-radius:3px;background:#334155;position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:68%;border-radius:3px;background:#2dd4bf"></div><div style="position:absolute;left:68%;top:50%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#fff"></div></div><span>2:25</span></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:6px">${b('-10秒')}${b('⏸', 1)}${b('+10秒')}</div>`;
      document.body.appendChild(bar);
    },
    C: () => {
      // ノーツを見る形: 上の欄をたたんで難易度を途中で切り替え。下に「次の曲」(連続で流す)
      const css = document.createElement('style');
      css.textContent = '[data-rhythm-hud]{visibility:hidden!important}[data-rhythm-song-clock]{visibility:hidden!important}[data-rhythm-judgment-text]{font-size:13px!important;opacity:.55!important}';
      document.head.appendChild(css);
      hideCombo();
      const land = innerWidth > innerHeight;
      const top = document.createElement('div');
      top.style.cssText = `position:fixed;z-index:99999;top:calc(var(--mh-safe-top,0px) + 8px);left:calc(var(--mh-safe-left,0px) + 8px);right:calc(var(--mh-safe-right,0px) + 8px);display:flex;gap:6px;align-items:center;${land ? 'justify-content:center' : ''}`;
      const d = (t, on, lock) => `<span style="flex:${land ? '0 0 64px' : 1};text-align:center;padding:6px 0;border-radius:10px;font-size:10.5px;font-weight:900;background:${on ? 'linear-gradient(90deg,#14b8a6,#0ea5e9)' : 'rgba(15,23,42,.85)'};color:${lock ? '#64748b' : '#fff'};border:1px solid ${on ? '#5eead4' : '#334155'}">${t}${lock ? '🔒' : ''}</span>`;
      top.innerHTML = `<span style="flex:0 0 auto;width:34px;height:30px;border-radius:10px;background:rgba(15,23,42,.85);border:1px solid #475569;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900">Ⅱ</span>${d('EASY')}${d('NORMAL')}${d('HARD', 1)}${d('EXPERT', 0, 1)}${d('MASTER', 0, 1)}`;
      top.style.boxShadow = 'none';
      document.body.appendChild(top);
      const song = document.createElement('div');
      song.style.cssText = `position:fixed;z-index:99999;top:calc(var(--mh-safe-top,0px) + 46px);left:calc(var(--mh-safe-left,0px) + 10px);font-size:12px;font-weight:900;color:#fff;text-shadow:0 1px 3px #000`;
      song.innerHTML = '🎧 MF × ICHIKA MIX<br><span style="font-size:10px;color:#cbd5e1;font-weight:700">1:38 / 2:25</span>';
      document.body.appendChild(song);
      const next = document.createElement('div');
      next.style.cssText = `position:fixed;z-index:99999;right:calc(var(--mh-safe-right,0px) + 10px);bottom:calc(var(--mh-safe-bottom,0px) + 10px);display:flex;align-items:center;gap:8px;background:rgba(15,23,42,.9);border:1px solid #334155;border-radius:14px;padding:6px 8px 6px 12px;box-shadow:0 0 0 3px rgba(250,204,21,.9)`;
      next.innerHTML = '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;line-height:1.3">🔁 次の曲<br><b style="color:#fff;font-size:11.5px">Monster Hero</b></div><span style="width:38px;height:38px;border-radius:10px;background:#1e293b;border:1px solid #475569;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px">⏭</span>';
      document.body.appendChild(next);
    },
  },
};

async function openGame(browser, size) {
  const land = size.w > size.h;
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await ctx.route('**/*', async (r) => {
    const req = r.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' } });
    }
    if (/supabase\.co/.test(u)) {
      if (req.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return r.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(r);
    }
    return r.abort();
  });
  await ctx.addInitScript(() => {
    window.__mhSupabaseStubbed = true;
    const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
    put('mh_breeder_name', 'モンヒロくん'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  });
  await ctx.addInitScript((l) => { document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style;
    const v = l ? { top: '0px', bottom: '21px', left: '47px', right: '47px' } : { top: '47px', bottom: '34px', left: '0px', right: '0px' };
    Object.entries(v).forEach(([k, x]) => r.setProperty(`--mh-safe-${k}`, x)); }); }, land);
  const p = await ctx.newPage();
  await p.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  return { ctx, p };
}

async function toSongSelect(p) {
  const click = (re) => p.evaluate((s) => { const x = [...document.querySelectorAll('button,summary')].find((e) => new RegExp(s).test(e.textContent.trim())); if (x) x.click(); return !!x; }, re);
  const pd = (s) => p.evaluate((s) => { const x = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find((e) => e.textContent.includes(s.text)); if (x) x.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!x; }, s);
  const close = async (n) => { for (let i = 0; i < n; i++) { if (!(await click('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await p.waitForTimeout(500); } };
  await p.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 });
  await pd({ text: 'TAP TO START' }); await p.waitForTimeout(2500);
  await p.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pd({ aria: 'トップ画面へ進む' }); await p.waitForTimeout(2500); await close(12);
  await p.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await p.waitForTimeout(2500); await close(6);
  await click('ソロライブ\\s*ひとり'); await p.waitForFunction(() => !!document.querySelector('[data-rhythm-song-row]'), null, { timeout: 20000 }); await p.waitForTimeout(1500); await close(3);
  await p.evaluate((name) => { const r = [...document.querySelectorAll('[data-rhythm-song-row]')].find((e) => e.textContent.includes(name)); if (r) r.click(); }, SONG);
  await p.waitForTimeout(800);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => /^\d+\s*HARD/.test(e.textContent.trim())); if (b) b.click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { scrollTo(0, 0); });
  return click;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const shots = {};
  try {
    for (const size of SIZES) {
      // 曲えらび: 案ごとに開き直して撮る(差し込みが混ざらないように)
      for (const plan of PLANS) {
        const { ctx, p } = await openGame(browser, size);
        await toSongSelect(p);
        await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
        if (MOCK.select[plan]) await p.evaluate(`(${MOCK.select[plan]})()`);
        await p.waitForTimeout(600);
        const f = path.join(OUT, `${size.tag}-select-${plan}.png`);
        await p.screenshot({ path: f }); shots[`${size.tag}-select-${plan}`] = f;
        console.log('撮った', path.basename(f));
        await ctx.close();
      }
      // 演奏中: 1回だけ演奏させ、同じ瞬間を止めて案ごとに差し込みを付け外しして撮る
      const { ctx, p } = await openGame(browser, size);
      const click = await toSongSelect(p);
      if (!(await click('^(▶\\s*)?決定$'))) throw new Error('決定が押せない');
      await p.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
      const target = 'const p = fingerAt(c, hab, null, now);';
      const src = installPlayer.toString();
      const player = src.includes(target) ? src.replace(target, 'const p = (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : 0; if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();') : src;
      await p.evaluate(`(${player})(${JSON.stringify({ sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource })})`);
      await p.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= 40000, null, { timeout: 120000, polling: 100 });
      // 画面に見えるノーツが多い瞬間(1.3秒先までに7個以上)を待つ
      await p.waitForFunction(() => { const h = window.__mhTestHooks; const ms = h.rhythmSongMs(); return (h.rhythmNotes() || []).filter((n) => n.timeMs > ms + 150 && n.timeMs < ms + 1300).length >= 7; }, null, { timeout: 60000, polling: 50 }).catch(() => console.log('混んだ瞬間が来なかった'));
      // 判定の文字が出ている瞬間を待って止める(画面を写すだけ。ゲームの時計は CDP で止める)
      await p.waitForFunction(() => /PERFECT|GREAT/.test(document.querySelector('[data-rhythm-judgment-text]')?.textContent || ''), null, { timeout: 10000, polling: 30 }).catch(() => {});
      await p.evaluate(() => { window.__mhFreezeRaf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; document.querySelectorAll('audio').forEach((a) => a.pause()); });
      await p.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });
      await p.waitForTimeout(400);
      // A は今ある文字を上書きするので最後に撮る
      for (const plan of ['now', 'B', 'C', 'A']) {
        await p.evaluate(() => { document.querySelectorAll('[data-mock-plan]').forEach((e) => e.remove()); document.querySelectorAll('[data-mock-hid]').forEach((e) => { e.style.visibility = ''; }); const h = document.querySelector('[data-rhythm-hud]'); if (h) h.style.visibility = ''; });
        if (MOCK.play[plan]) {
          await p.evaluate(`(() => { window.hideCombo = () => { [...document.querySelectorAll('[data-rhythm-play-area] *, main *')].filter((e) => /COMBO/.test(e.textContent || '') && e.getBoundingClientRect().width < 200 && e.getBoundingClientRect().height < 120).forEach((e) => { e.style.visibility = 'hidden'; e.setAttribute('data-mock-hid', '1'); }); }; const before = new Set([...document.body.children, ...document.head.children]); (${MOCK.play[plan]})(); [...document.body.children, ...document.head.children].forEach((e) => { if (!before.has(e)) e.setAttribute('data-mock-plan', '1'); }); })()`);
        }
        await p.waitForTimeout(300);
        const f = path.join(OUT, `${size.tag}-play-${plan}.png`);
        await p.screenshot({ path: f }); shots[`${size.tag}-play-${plan}`] = f;
        console.log('撮った', path.basename(f));
      }
      await ctx.close();
    }
    // 並べた1枚(大きさごと): 行 = 曲えらび / 鑑賞中、列 = いま・案A・案B・案C
    const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
    const label = { now: 'いま', A: '案A 難易度の横に🎧', B: '案B 曲の詳細から', C: '案C 鑑賞の一覧' };
    for (const size of SIZES) {
      const img = (k) => `data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}`;
      const cell = (k) => `<div><img src="${img(k)}" style="width:${size.w}px;height:${size.h}px;display:block;border-radius:10px;border:1px solid #444"></div>`;
      const html = `<body style="margin:0;background:#0b0f19;color:#fff;font-family:sans-serif;padding:16px;width:max-content">
        <div style="font-size:22px;font-weight:900;margin-bottom:4px">曲鑑賞(オートプレイ)の案 — ${size.tag === 'tate' ? '縦 390×844' : '横 844×390'}・iPhone の切り欠きの余白あり</div>
        <div style="font-size:14px;color:#94a3b8;margin-bottom:12px">黄色の縁 = 案で足す所(見本)。まだゲームには入れていない</div>
        <div style="display:grid;grid-template-columns:120px repeat(4,${size.w}px);gap:12px;align-items:start">
          <div></div>${PLANS.map((pl) => `<div style="font-size:18px;font-weight:900;color:${pl === 'now' ? '#cbd5e1' : '#facc15'}">${label[pl]}</div>`).join('')}
          <div style="font-size:18px;font-weight:900">曲えらび<br>の入口</div>${PLANS.map((pl) => cell(`${size.tag}-select-${pl}`)).join('')}
          <div style="font-size:18px;font-weight:900">鑑賞中</div>${PLANS.map((pl) => cell(`${size.tag}-play-${pl}`)).join('')}
        </div></body>`;
      await page.setContent(html);
      await page.waitForTimeout(500);
      const f = path.join(OUT, `sheet-${size.tag}.png`);
      await page.screenshot({ path: f, fullPage: true });
      console.log('並べた', path.basename(f));
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
