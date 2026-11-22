#!/usr/bin/env node
// 撮り比べ: 公開の前に、主な画面を main と直した枝の両方で撮り、違いが出た画面を止めて見せる(r1119-093・追跡表 r1122-009)。
//
// 社長「点検して表示とか見てるのに逆に壊してまわってるの？」: 直した画面だけを撮って確かめていたので、直していない画面が崩れても気づけなかった。
// この道具は「直していない画面が変わっていないか」を見る。画面の組は tools/browser/compare-scenes.js(固定の一覧)。
//
//   node tools/browser/visual-compare-check.js                    main(origin/main との分かれ目)と今の作業ツリーを撮り比べる
//   node tools/browser/visual-compare-check.js --base <版>        比べる相手の版を名指しする
//   node tools/browser/visual-compare-check.js --only home,beat-result --sizes tate,rot   画面・大きさを絞る
//   node tools/browser/visual-compare-check.js --list             画面の組を出す
//   node tools/browser/visual-compare-check.js --self             両方とも今の作業ツリーで撮る(何も変えないとき違い0件になるかの確かめ)
//   node tools/browser/visual-compare-check.js --head-only        今の作業ツリーだけ撮る(比べない。画面の組が撮れるかの確かめ)
//   node tools/browser/visual-compare-check.js --intended "<理由>" いま出ている違いを「意図した違い」として控える(止め絵を見てから)
//   node tools/browser/visual-compare-check.js --status           前に撮った結果を1行で出す(撮らない。node tools/ctx.js gate が使う)
//
// 結果: tools/out/visual-compare/(git に入らない)
//   result.json … 違いのある画面・絵のパス・かかった時間 / diff/<大きさ>-<画面>.png … 左 main・右 枝(違う所を赤い枠で囲む)
// 終わり方: 違いが0、または全部「意図した違い」として控えてあれば 0。控えていない違い・撮れなかった画面があれば 1
//
// 【毎回変わる所の止め方】(何も変えていない枝で違いが出ると、誤って止める道具になる)
//   ・日付と時刻は「今日の15時」から始める(両方の版で同じ) / 乱数は種を固定し、画面ごとに種を入れ直す
//   ・CSS の動き(animation・transition)は止める / 動画は隠す
//   ・それでも動く所(JS で動かす粒・歩く絵など)は、同じ画面を間をあけて3回撮り、変わった画素を「動く所」として比べる範囲から外す
//   ・モンヒロビートの演奏中は、曲の時計を決まった秒で止めて撮る
// 【守ること】デバッグの合言葉・DEBUG MENU は使わない。通信はにせの Supabase が受け止める(本番へは送らない)。写る名前はボットの名前だけ
// run-checks-timeout: 1200
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const { SCENES, SIZES, DEFAULT_SIZES, BEAT_STATES, BEAT_HOLD_SEC } = require('./compare-scenes');
const { FREEZE, stableInit, toRaw, diffMask, stableShot } = require('./stable-shot');

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] || '') : ''; };
const has = (name) => argv.includes(name);
const OUT = path.join(ROOT, 'tools', 'out', 'visual-compare');
const RESULT = path.join(OUT, 'result.json');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---- 比べ方の物差し ----
const MIN_PIXELS = 40;        // 違う画素がこれ以下なら数えない(字のふちのにじみ)
const MIN_RATE = 0.0002;      // 違う画素の割合がこれ以下なら数えない(0.02%)
const PORT_BASE = Number(process.env.VC_PORT) || 9461; // 9461=main・9462=枝・9463/9464=モンサクの道具
const POOL = Number(process.env.VC_POOL) || 4;

const git = (args, o = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'], ...o });
const gitText = (args) => { try { return git(args).toString().trim(); } catch (e) { return ''; } };

if (has('--list')) {
  for (const sc of SCENES) console.log(`${sc.id.padEnd(20)} ${sc.area} / ${sc.name}  [${(sc.sizes || DEFAULT_SIZES).join('・')}]`);
  console.log(`\n大きさ: ${SIZES.map((z) => `${z.tag}=${z.name} ${z.w}×${z.h}`).join(' / ')}`);
  process.exit(0);
}

// ---- 比べる相手の版と、いまの変更の指紋 ----
const baseRev = () => opt('--base') || gitText(['merge-base', 'origin/main', 'HEAD']) || gitText(['rev-parse', 'origin/main']) || 'HEAD';
// 画面に出る物(配るファイル)だけを見る。src/ は配らない(配るのは build.js が作った game-system.compiled.js)
const servedDiff = (base) => gitText(['diff', '--name-only', '--no-renames', base, '--', 'monster-hero']).split('\n').filter(Boolean)
  .filter((f) => !/^monster-hero\/(src|audio|debug)\//.test(f));
const fingerprint = (base, files) => {
  const h = crypto.createHash('sha1').update(gitText(['rev-parse', base]));
  for (const f of files) { h.update(f); try { h.update(fs.readFileSync(path.join(ROOT, f))); } catch (e) { h.update('gone'); } }
  return h.digest('hex').slice(0, 16);
};
const readResult = () => { try { return JSON.parse(fs.readFileSync(RESULT, 'utf8')); } catch (e) { return null; } };
const statusLine = (r, fresh) => {
  if (!r) return '撮り比べ: まだ撮っていない → node tools/browser/visual-compare-check.js';
  if (!fresh) return '撮り比べ: 前に撮ったあとで画面のファイルが変わった(撮り直す) → node tools/browser/visual-compare-check.js';
  const open = r.diffs.filter((d) => !d.intended).length;
  const miss = (r.missed || []).length;
  return `撮り比べ: 違い ${r.diffs.length} 画面${r.diffs.length ? `(うち意図した違い ${r.diffs.length - open})` : ''}${miss ? `・撮れなかった ${miss}` : ''}${r.skipped ? '(画面のファイルに差なし)' : ''}`
    + (open ? ` → 止め絵 ${rel(path.join(OUT, 'diff'))}/ を見る` : '');
};
const isFresh = (r) => { if (!r) return false; const base = baseRev(); return r.fingerprint === fingerprint(base, servedDiff(base)); };

if (has('--status')) {
  if (!servedDiff(baseRev()).length) { console.log('撮り比べ: 違い 0 画面(画面に出るファイルが main と同じ)'); process.exit(0); }
  const r = readResult(); console.log(statusLine(r, isFresh(r))); process.exit(0);
}

if (has('--intended')) {
  const why = opt('--intended');
  const r = readResult();
  if (!why || why.startsWith('--')) { console.log('NG: 理由を書く → --intended "<何を変えたので、どの画面がどう変わるか>"'); process.exit(1); }
  if (!r || !isFresh(r)) { console.log('NG: 先に撮り比べを回す(前の結果が無い・古い) → node tools/browser/visual-compare-check.js'); process.exit(1); }
  for (const d of r.diffs) if (!d.intended) {
    d.intended = why;
    // 控えたときの枝の止め絵を残す。次に撮った絵がこれと同じあいだだけ「意図した違い」として通す
    const from = path.join(OUT, 'head', d.size, `${d.id}.png`), to = path.join(OUT, 'intended', `${d.size}-${d.id}.png`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(from)) fs.copyFileSync(from, to);
    fs.rmSync(to.replace(/\.png$/, '.move'), { force: true });
    if (fs.existsSync(from.replace(/\.png$/, '.move'))) fs.copyFileSync(from.replace(/\.png$/, '.move'), to.replace(/\.png$/, '.move'));
  }
  fs.writeFileSync(RESULT, JSON.stringify(r, null, 1));
  console.log(`控えた: 意図した違い ${r.diffs.length} 画面(${why})`);
  console.log('PR の本文に書く1行:');
  console.log(`  撮り比べ: 違い ${r.diffs.length} 画面(意図した違い: ${why}) — ${r.diffs.map((d) => `${d.name}(${d.sizeName})`).join('・')}`);
  process.exit(0);
}

let playwright, sharp;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (e) { try { playwright = require('playwright'); } catch (e2) { console.log('SKIP: playwright が無い'); process.exit(0); } }
try { sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (e) { console.log('SKIP: sharp が無い(cd tools && npm install)'); process.exit(0); }
const { SCENES: WALK_SCENES } = require('./visual-scenes');
const { openSession } = require('../playbot/lib/session');
const { prepareVeteran } = require('../playbot/lib/seeds');

// ---- 2つの版を配る(作業ツリーのコピーは作らない。古い版は git から読む。tools/browser/serve-rev.js) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
// 叩かないので全部 MISS になる。ライフが0になると「失敗」の結果になるので、配る rhythm-mode.js のライフの減りだけ0にする(ja-wrap-beat-result-check.js と同じ)
const LIFE_FROM = 'BAD:-20, MISS:-50';
const lifePatched = { base: false, head: false };
const makeServer = (side, rev, port) => new Promise((resolve) => {
  let fromRev = null;
  if (rev) { const keep = process.env.SHOT_REV; process.env.SHOT_REV = rev; fromRev = require('./serve-rev').make(ROOT); if (keep === undefined) delete process.env.SHOT_REV; else process.env.SHOT_REV = keep; }
  const server = http.createServer((req, res) => {
    const r = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const f = path.join(ROOT, r);
    if (!f.startsWith(ROOT)) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    let buf = fromRev ? fromRev(r) : null;
    if (buf === false) { res.writeHead(404); res.end(); return; }
    if (buf === null && (!fs.existsSync(f) || fs.statSync(f).isDirectory())) { res.writeHead(404); res.end(); return; }
    if (r === 'monster-hero/data/rhythm-mode.js') {
      const t = (buf || fs.readFileSync(f)).toString('utf8');
      lifePatched[side] = t.includes(LIFE_FROM);
      res.writeHead(200, { 'Content-Type': type }); res.end(t.replace(LIFE_FROM, 'BAD:0, MISS:0')); return;
    }
    res.writeHead(200, { 'Content-Type': type });
    if (buf) res.end(buf); else fs.createReadStream(f).pipe(res);
  });
  server.listen(port, () => resolve(server));
});

// ---- 毎回変わる所を止める(tools/browser/stable-shot.js) ----
// 今日の15時(日本時間)から時計を始める。両方の版で同じ値を使う
const FIXED_NOW = (() => { const jst = new Date(Date.now() + 9 * 3600e3); return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 15 - 9, 0, 0); })();
// 曲の時計(AudioContext の currentTime)を速め、曲の頭から決まった秒で止められるようにする
const clockInit = () => {
  const C = window.__vcClock = { speed: 1, hold: null, songWhen: null, reached: false, watch: false };
  const P = (window.BaseAudioContext || window.AudioContext).prototype, d = Object.getOwnPropertyDescriptor(P, 'currentTime');
  if (d && d.get) Object.defineProperty(P, 'currentTime', { configurable: true, get() {
    const t = d.get.call(this) * C.speed;
    if (C.hold != null && C.songWhen != null) { const cap = C.songWhen + C.hold; if (t >= cap) { C.reached = true; return cap; } }
    return t;
  } });
  const S = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype;
  if (S) { const start = S.start; S.start = function (when, ...r) { try { if (C.watch && C.songWhen == null && this.buffer && this.buffer.duration > 20) C.songWhen = Number(when) || 0; } catch (e) {} return start.call(this, when, ...r); }; }
};

const sizeOf = (tag) => SIZES.find((z) => z.tag === tag);
const shotFile = (side, tag, id) => path.join(OUT, side, tag, `${id}.png`);
const missed = [];
const miss = (side, sc, tag, why) => missed.push({ side, id: sc.id, name: sc.name, size: tag, why: String(why).split('\n')[0].slice(0, 140) });

const newSession = async (side, port, size, persona) => {
  const report = { headed: false, shotNo: 0, issues: [], issueKeys: new Set(), steps: [], screens: new Map() };
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
  const botOut = path.join(OUT, '_bot', `${side}-${persona}`);
  fs.mkdirSync(botOut, { recursive: true });
  const s = await openSession({ playwright, pageUrl: `http://localhost:${port}/monster-hero/index.html`, port, out: botOut, rand, persona, report, viewport: { width: size.w, height: size.h } });
  await s.context.addInitScript(stableInit, FIXED_NOW);
  return s;
};
const settle = async (s, sc) => {
  if (sc && sc.hide) await s.page.addStyleTag({ content: `${sc.hide}{visibility:hidden!important}` }).catch(() => {});
  await s.page.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; if (e.scrollLeft) e.scrollLeft = 0; }); }).catch(() => {});
  await s.wait(1200);
};

// ---- HOME から押して開く画面 ----
async function walk(side, port, tag, scenes) {
  const size = sizeOf(tag);
  const s = await newSession(side, port, size, `walk-${tag}`);
  try {
    await prepareVeteran(s);
    await s.boot();
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const go = sc.go || (WALK_SCENES.find((w) => w.id === sc.id) || {}).go;
      let ok = false;
      try {
        await s.backHome(); await s.dismissOverlays(10);
        await s.page.evaluate((n) => window.__vcReseed && window.__vcReseed(n), i + 1);
        ok = go ? await go(s) : false;
      } catch (e) { ok = false; }
      if (!ok) { miss(side, sc, tag, go ? 'HOME から押す手順の途中のボタンが見つからない' : '手順が無い(visual-scenes.js に同じ id の場面が無い)'); continue; }
      await settle(s, sc);
      await stableShot(s.page, shotFile(side, tag, sc.id), i + 1).catch((e) => miss(side, sc, tag, e.message));
    }
  } finally { await s.close(); }
}

// ---- モンヒロビート: 1曲流して、演奏中と結果を撮る ----
// 結果の画面の持ち物(React の状態)を差し替える。画面の部品の根までたどり、status が 'result' の状態を探して書き換える
const setResultState = (over) => {
  const el = document.querySelector('[data-rhythm-result-scroll]');
  if (!el) return false;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  for (let f = key && el[key]; f; f = f.return) {
    let h = f.memoizedState, n = 0;
    while (h && typeof h === 'object' && 'memoizedState' in h && n++ < 600) {
      const v = h.memoizedState;
      if (v && typeof v === 'object' && v.status === 'result' && v.result && h.queue && typeof h.queue.dispatch === 'function') {
        const base = window.__vcResult0 || (window.__vcResult0 = v);
        const next = over ? { ...base, score: over.score, maxCombo: over.maxCombo, counts: { ...base.counts, ...over.judgments }, fast: over.fast, slow: over.slow, precise: over.precise,
          result: { ...base.result, ...over, judgments: { ...base.result.judgments, ...over.judgments }, recordFx: null } } : base;
        h.queue.dispatch(next);
        return true;
      }
      h = h.next;
    }
  }
  return false;
};
async function beat(side, port, scenes, tags) {
  const s = await newSession(side, port, sizeOf('tate'), 'beat');
  const page = s.page;
  const all = (step) => scenes.filter((sc) => sc.step === step);
  const missAll = (list, why) => { for (const sc of list) for (const t of (sc.sizes || DEFAULT_SIZES).filter((x) => tags.includes(x))) miss(side, sc, t, why); };
  const clickText = (p) => page.evaluate((src) => { const rx = new RegExp(src); const b = [...document.querySelectorAll('button')].find((x) => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (!b) return false; b.click(); return true; }, p);
  const closeAll = async () => { for (let i = 0; i < 10; i++) { if (!(await clickText('^(受け取る|閉じる|OK|確認|スキップ|あとで読む|とじる)$'))) break; await page.waitForTimeout(300); } };
  // 大きさを替える。'rot' は縦のまま、ゲームに画面を回させる(🔄横)
  const resize = async (tag) => {
    const z = sizeOf(tag);
    await page.setViewportSize({ width: z.w, height: z.h });
    const ok = await page.evaluate((deg) => { try { RHYTHM_VIEW_ROTATION.set(deg); return true; } catch (e) { return false; } }, z.rot ? 90 : 0); // eslint-disable-line no-undef
    await page.waitForTimeout(600);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(900);
    return ok || !z.rot;
  };
  try {
    await s.context.addInitScript(clockInit);
    await prepareVeteran(s);
    await s.boot();
    await s.backHome(); await s.dismissOverlays(10);
    await page.evaluate(() => window.__vcReseed && window.__vcReseed(77));
    await page.evaluate(() => { const b = document.querySelector('[data-home-fac="rhythm"]'); if (b) b.click(); });
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 }); await page.waitForTimeout(800); await closeAll(); await s.dismissOverlays(6);
    await clickText('ソロライブ');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 }); await page.waitForTimeout(600); await closeAll(); await s.dismissOverlays(6);
    for (let k = 0; k < 3 && (await s.tapLabel(/^この案内を閉じる$/, 500)); k++);
    await page.evaluate((hold) => { const C = window.__vcClock; C.songWhen = null; C.reached = false; C.watch = true; C.hold = hold; C.speed = 12; }, BEAT_HOLD_SEC);
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    // 演奏中: 曲の時計が決まった秒で止まるのを待って撮る
    const held = await page.waitForFunction(() => window.__vcClock.reached, null, { timeout: 60000 }).then(() => true).catch(() => false);
    if (!held) missAll(all('play'), '曲の時計を止められない(曲の鳴らし方が変わった。visual-compare-check.js の clockInit を直す)');
    else for (const sc of all('play')) for (const tag of (sc.sizes || DEFAULT_SIZES).filter((x) => tags.includes(x))) {
      if (!(await resize(tag))) { miss(side, sc, tag, '🔄横に回せない(RHYTHM_VIEW_ROTATION が無い)'); continue; }
      await page.addStyleTag({ content: FREEZE }).catch(() => {});
      await page.waitForTimeout(1500);
      await stableShot(page, shotFile(side, tag, sc.id)).catch((e) => miss(side, sc, tag, e.message));
    }
    await resize('tate');
    if (!all('result').length) return;
    // 曲の終わりまで早送りして結果へ
    await page.evaluate(() => { const C = window.__vcClock; C.hold = null; C.speed = 30; });
    const reached = await page.waitForSelector('[data-rhythm-result-scroll]', { timeout: 120000 }).then(() => true).catch(() => false);
    if (!reached) { missAll(all('result'), '結果の画面まで来ない'); return; }
    if (!lifePatched[side]) { missAll(all('result'), `配る rhythm-mode.js のライフの減り(${LIFE_FROM})が見つからない。書き方が変わったら LIFE_FROM を直す`); return; }
    await page.waitForTimeout(3500); await closeAll();
    for (let k = 0; k < 4; k++) { await page.mouse.click(195, 280); await page.waitForTimeout(500); } // ランクアップの大きな演出(押すと閉じる)を閉じる
    await page.addStyleTag({ content: FREEZE }).catch(() => {});
    for (const sc of all('result')) {
      const okState = await page.evaluate(setResultState, BEAT_STATES[sc.state] || null).catch(() => false);
      if (!okState) { missAll([sc], '結果の画面の状態を差し替えられない(持ち方が変わった。visual-compare-check.js の setResultState を直す)'); continue; }
      for (const tag of (sc.sizes || DEFAULT_SIZES).filter((x) => tags.includes(x))) {
        if (!(await resize(tag))) { miss(side, sc, tag, '🔄横に回せない(RHYTHM_VIEW_ROTATION が無い)'); continue; }
        // 頭へ戻す。「▼ 続きがある」の印はスクロールの知らせで出し入れするので、知らせも送る
        await page.evaluate(() => { const b = document.querySelector('[data-rhythm-result-scroll]'); if (b) { b.scrollTop = 1; b.scrollTop = 0; b.dispatchEvent(new Event('scroll')); } window.dispatchEvent(new Event('resize')); });
        await page.waitForTimeout(1500);
        await stableShot(page, shotFile(side, tag, sc.id)).catch((e) => miss(side, sc, tag, e.message));
      }
    }
  } catch (e) {
    for (const sc of scenes) for (const t of (sc.sizes || DEFAULT_SIZES).filter((x) => tags.includes(x))) if (!fs.existsSync(shotFile(side, t, sc.id))) miss(side, sc, t, `途中で止まった: ${e.message}`);
  } finally { await s.close(); }
}

// ---- モンサク: 既存の撮影の道具(tools/success/success-shoot.js)を借りる ----
const MONSUC_TAG = { tate: 'base', yoko: 'land', pc: 'pc' };
function monsuc(side, rev, port, scenes, tags) {
  const use = tags.filter((t) => MONSUC_TAG[t]);
  if (!use.length) return Promise.resolve();
  const dir = path.join(OUT, '_monsuc', side);
  fs.mkdirSync(dir, { recursive: true });
  const env = { ...process.env, SHOT_DIR: dir, SHOT_PORT: String(port), SHOT_ONLY: scenes.map((sc) => sc.shot).join(','), SHOT_SIZES: use.map((t) => MONSUC_TAG[t]).join(','), UI_MEASURE: '0', SHOT_STABLE: String(FIXED_NOW) };
  delete env.SHOT_REV; if (rev) env.SHOT_REV = rev;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'tools', 'success', 'success-shoot.js')], { env, stdio: 'ignore' });
    child.on('close', async () => {
      for (const sc of scenes) for (const t of use) {
        const from = path.join(dir, `msx-${sc.shot}${t === 'tate' ? '' : `-${MONSUC_TAG[t]}`}.png`);
        if (!fs.existsSync(from)) { miss(side, sc, t, 'success-shoot.js がこの場面を撮らなかった'); continue; }
        const to = shotFile(side, t, sc.id);
        fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
        if (fs.existsSync(from.replace(/\.png$/, '.move'))) fs.copyFileSync(from.replace(/\.png$/, '.move'), to.replace(/\.png$/, '.move'));
      }
      resolve();
    });
  });
}

// ---- 比べる ----
const loadMove = (file, n) => { try { const b = fs.readFileSync(file.replace(/\.png$/, '.move')); return b.length === n ? b : null; } catch (e) { return null; } };
// 2枚の止め絵の違う画素を数える(それぞれの「動く所」は外す)
async function countDiff(fa, fb) {
  const [a, b] = await Promise.all([toRaw(fs.readFileSync(fa)), toRaw(fs.readFileSync(fb))]);
  const W = b.info.width, H = b.info.height;
  const m = diffMask(a, b);
  if (!m) return { a, b, m: null, count: W * H, rate: 1, sizeChanged: true, same: false };
  let count = 0;
  const mv1 = loadMove(fa, m.length), mv2 = loadMove(fb, m.length);
  // 動く所は、まわり2画素ぶん広げて外す
  const skip = new Uint8Array(m.length);
  for (const mv of [mv1, mv2]) if (mv) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mv[y * W + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) skip[yy * W + xx] = 1; }
  for (let i = 0; i < m.length; i++) { if (skip[i]) m[i] = 0; else if (m[i]) count++; }
  const rate = count / (W * H);
  return { a, b, m, count, rate, sizeChanged: false, same: count <= MIN_PIXELS || rate <= MIN_RATE };
}
async function compare(sc, tag) {
  const fa = shotFile('base', tag, sc.id), fb = shotFile('head', tag, sc.id);
  if (!fs.existsSync(fa) || !fs.existsSync(fb)) return null;
  const { a, b, m, count, rate, sizeChanged, same } = await countDiff(fa, fb);
  if (same) return null;
  const W = b.info.width, H = b.info.height;
  // 並べた絵: 左 main・右 枝。違う所を 24px の升目でまとめ、赤い枠で囲む
  const CELL = 24, rects = [];
  if (m) for (let cy = 0; cy < H; cy += CELL) for (let cx = 0; cx < W; cx += CELL) {
    let hit = false;
    for (let y = cy; y < Math.min(H, cy + CELL) && !hit; y++) for (let x = cx; x < Math.min(W, cx + CELL); x++) if (m[y * W + x]) { hit = true; break; }
    if (hit) rects.push(`<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="rgba(255,0,60,.05)" stroke="#ff003c" stroke-width="1"/>`);
  }
  const GAP = 16, HEAD = 30, AW = a.info.width, AH = a.info.height;
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${AW + GAP + W}" height="${HEAD}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="21" font-family="sans-serif" font-size="16" font-weight="bold" fill="#9cf">main</text><text x="${AW + GAP + 8}" y="21" font-family="sans-serif" font-size="16" font-weight="bold" fill="#fc6">branch</text></svg>`;
  const out = path.join(OUT, 'diff', `${tag}-${sc.id}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: AW + GAP + W, height: HEAD + Math.max(AH, H), channels: 3, background: '#333' } }).composite([
    { input: Buffer.from(label), left: 0, top: 0 },
    { input: fs.readFileSync(fa), left: 0, top: HEAD },
    { input: fs.readFileSync(fb), left: AW + GAP, top: HEAD },
    ...(rects.length ? [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects.join('')}</svg>`), left: AW + GAP, top: HEAD }] : []),
  ]).png().toFile(out);
  const z = sizeOf(tag);
  return { id: sc.id, name: sc.name, area: sc.area, size: tag, sizeName: z.name, rate: Math.round(rate * 10000) / 100, pixels: count, sizeChanged, shot: rel(out) };
}

const pool = async (jobs, n) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (i < jobs.length) { const j = jobs[i++]; await j().catch((e) => console.log(`  途中で止まった: ${e.message}`)); } })); };

(async () => {
  const t0 = Date.now();
  const self = has('--self'), headOnly = has('--head-only');
  const base = baseRev();
  const files = servedDiff(base);
  const fp = fingerprint(base, files);
  const only = opt('--only').split(',').filter(Boolean), sizeTags = opt('--sizes').split(',').filter(Boolean);
  const partial = only.length > 0 || sizeTags.length > 0 || self || headOnly;
  const scenes = SCENES.filter((sc) => !only.length || only.includes(sc.id));
  const tags = SIZES.map((z) => z.tag).filter((t) => !sizeTags.length || sizeTags.includes(t));
  const pairs = scenes.flatMap((sc) => (sc.sizes || DEFAULT_SIZES).filter((t) => tags.includes(t)).map((t) => [sc, t]));
  const prev = readResult();

  // 配るファイルに差が無ければ、撮らずに 0 件
  if (!files.length && !self && !headOnly) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(RESULT, JSON.stringify({ at: new Date().toISOString(), base: gitText(['rev-parse', '--short', base]), fingerprint: fp, skipped: true, seconds: 0, shots: 0, diffs: [], missed: [] }, null, 1));
    console.log('OK: 撮り比べ: 違い 0 画面(画面に出るファイルが main と同じなので撮らない)');
    process.exit(0);
  }

  for (const d of ['base', 'head', 'diff', '_bot', '_monsuc']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`撮り比べ: ${scenes.length}画面・${pairs.length}枚 × ${headOnly ? '枝だけ' : `2つの版(main ${gitText(['rev-parse', '--short', base])}${self ? '=今の作業ツリーで代用' : ''} / 枝)`}`);
  const sides = headOnly ? [['head', null]] : [['base', self ? null : base], ['head', null]];
  // 2つの版で、名指しした画面と大きさを撮る
  const shootAll = async (scs, tgs) => {
    const servers = [], jobs = [];
    for (const [side, rev] of sides) {
      const port = PORT_BASE + (side === 'base' ? 0 : 1);
      servers.push(await makeServer(side, rev, port));
      const beatScenes = scs.filter((sc) => sc.kind === 'beat');
      if (beatScenes.length) jobs.push(() => beat(side, port, beatScenes, tgs)); // 重い仕事(ビート)から始める
      for (const tag of tgs) {
        const list = scs.filter((sc) => sc.kind === 'walk' && (sc.sizes || DEFAULT_SIZES).includes(tag));
        if (list.length) jobs.push(() => walk(side, port, tag, list));
      }
      const ms = scs.filter((sc) => sc.kind === 'monsuc');
      if (ms.length) jobs.push(() => monsuc(side, rev, PORT_BASE + 2 + (side === 'base' ? 0 : 1), ms, tgs));
    }
    try { await pool(jobs, POOL); } finally { servers.forEach((sv) => sv.close()); }
    fs.rmSync(path.join(OUT, '_bot'), { recursive: true, force: true });
    fs.rmSync(path.join(OUT, '_monsuc'), { recursive: true, force: true });
  };
  const compareAll = async (list) => { const out = []; for (const [sc, tag] of list) { const d = await compare(sc, tag).catch((e) => { miss('比べる', sc, tag, e.message); return null; }); if (d) out.push(d); } return out; };
  await shootAll(scenes, tags);

  let diffs = headOnly ? [] : await compareAll(pairs);
  // 違いが出た画面は、もう一度撮り直して確かめる(機械が混んでいて画面が出そろう前に撮った、などの1回きりの違いで止めない)。2回とも違う画面だけ残す
  let recheck = 0;
  if (diffs.length && !has('--no-recheck')) {
    recheck = diffs.length;
    const again = pairs.filter(([sc, tag]) => diffs.some((d) => d.id === sc.id && d.size === tag));
    for (const d of diffs) fs.rmSync(path.join(ROOT, d.shot), { force: true });
    for (const [sc, tag] of again) for (const side of ['base', 'head']) { fs.rmSync(shotFile(side, tag, sc.id), { force: true }); fs.rmSync(shotFile(side, tag, sc.id).replace(/\.png$/, '.move'), { force: true }); }
    const ids = new Set(again.map(([sc]) => sc.id)), tg = new Set(again.map(([, tag]) => tag));
    for (let i = missed.length - 1; i >= 0; i--) if (again.some(([sc, tag]) => sc.id === missed[i].id && tag === missed[i].size)) missed.splice(i, 1);
    console.log(`  違い ${diffs.length} 画面 → 撮り直して確かめる`);
    await shootAll(scenes.filter((sc) => ids.has(sc.id)), tags.filter((t) => tg.has(t)));
    diffs = await compareAll(again);
  }
  diffs.sort((x, y) => y.rate - x.rate);
  // 前に「意図した違い」と控えた画面は、枝の止め絵が控えたときと同じなら引き継ぐ(絵がまた変わっていたら止める)
  for (const d of diffs) {
    const p = prev && (prev.diffs || []).find((x) => x.id === d.id && x.size === d.size && x.intended);
    const kept = path.join(OUT, 'intended', `${d.size}-${d.id}.png`);
    if (!p || !fs.existsSync(kept)) continue;
    const c = await countDiff(kept, shotFile('head', d.size, d.id)).catch(() => null);
    if (c && c.same) d.intended = p.intended;
  }
  const shots = pairs.filter(([sc, tag]) => fs.existsSync(shotFile('head', tag, sc.id))).length;
  const seconds = Math.round((Date.now() - t0) / 1000);
  // 片方でも撮れなかった画面(同じ画面・大きさは1件にまとめる)
  const missedUniq = [...new Map(missed.map((x) => [`${x.id}/${x.size}`, x])).values()];
  const result = { at: new Date().toISOString(), base: gitText(['rev-parse', '--short', base]), fingerprint: fp, partial, self, seconds, shots, recheck, diffs, missed: missedUniq };
  if (!partial) fs.writeFileSync(RESULT, JSON.stringify(result, null, 1));
  else fs.writeFileSync(path.join(OUT, 'result-partial.json'), JSON.stringify(result, null, 1));

  const open = diffs.filter((d) => !d.intended);
  console.log(`撮れた ${shots}/${pairs.length}枚・${seconds}秒`);
  missedUniq.slice(0, 6).forEach((x) => console.log(`  撮れなかった: ${x.name}(${sizeOf(x.size).name}・${x.side}) ${x.why}`));
  if (missedUniq.length > 6) console.log(`  …ほか ${missedUniq.length - 6} 件(${rel(partial ? path.join(OUT, 'result-partial.json') : RESULT)})`);
  open.slice(0, 8).forEach((d) => console.log(`  違い: ${d.name}(${d.sizeName}) ${d.sizeChanged ? '絵の大きさが違う' : `${d.rate}%`} → ${d.shot}`));
  if (open.length > 8) console.log(`  …ほか ${open.length - 8} 画面(${rel(RESULT)})`);
  if (headOnly) { console.log(`${missedUniq.length ? 'NG' : 'OK'}: 枝だけ撮った(比べていない) → ${rel(path.join(OUT, 'head'))}/`); process.exit(missedUniq.length ? 1 : 0); }
  const ok = !open.length && !missedUniq.length;
  console.log(`${ok ? 'OK' : 'NG'}: 撮り比べ: 違い ${diffs.length} 画面${diffs.length ? `(うち意図した違い ${diffs.length - open.length})` : ''}${missedUniq.length ? `・撮れなかった ${missedUniq.length}` : ''}`);
  if (open.length) console.log('  → 止め絵(左 main・右 枝・赤い枠が違う所)を見る。直した所のつもりの違いなら node tools/browser/visual-compare-check.js --intended "<理由>" で控え、出た1行を PR の本文に書く。つもりの無い違いは直す');
  process.exit(ok ? 0 : 1);
})();
