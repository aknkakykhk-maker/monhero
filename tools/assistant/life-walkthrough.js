// 助手ライフ(新しいUI)を「初めて遊ぶ人」と「毎日来る人」の目で通しで歩き、画面ごとに止め絵を撮って数字で点検する
// (2026-11-11 社長「助手ライフのやる意味と見やすさ。もっとわかりやすく楽しさをだして」・ナカヨシ12)。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-walkthrough.js                 点検(要約・問題の大きい順の上位10・最後の1行に OK/NG)
//   node tools/assistant/life-walkthrough.js --shots [置き場] 止め絵も撮る(既定 docs/progress/assistant-life/walkthrough/)
//   node tools/assistant/life-walkthrough.js --save-baseline  いまの数字を控え(life-walkthrough-baseline.json)にする
//   --2x 止め絵を2倍の細かさで(人に見せる用。既定は等倍で軽く) / --top 20 上位の数 / --full 画面ごとの全部の行 / --json <ファイル> 全部の数字 / --slot morning|afternoon|night 時間帯(既定 afternoon)
//   --who first|daily 片方の人だけ / --view tate|yoko 片方の向きだけ / LIFE_BASE=<URL> で本番の版を見る
// 見るもの(機械で見られる所だけ。画面に見えている物=その点をさわると当たる物だけを数える):
//   わかる   … 最初の1画面で押せる所の数(多いと迷う・0は行き止まり)・押せない所の割合
//   得       … 押せる所のうち「何が上がるか・もらえるか」が自分の字に出ている割合
//   また来る … 「次は◯時・あと◯回・朝4時に戻る」など、次に来る理由になる言葉があるか
//   字       … 10px 未満(とても小さい)・11px 未満(小さい)の字数、1画面の字数、切れている字(…)
//   詰まり   … 縦の長さ(何画面ぶん)・字どうしの重なり・押せる所どうしの重なり・画面の外へ出た物
//   タップ   … 44px 未満・32px 未満の押せる所
// NG にするのは、壊れている物(たどり着けない・エラー・画面の外・押せる所の重なり)と、控えより点が1割より多く悪くなったときだけ。
// ほかは「気になる所」として点の大きい順に出す(直すかは人が決める)。
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os');
const root = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = 9271;
const SHOTS = flag('--shots'), FULL = flag('--full'), SAVE = flag('--save-baseline');
const shotDir = path.resolve(root, opt('--shots', 'docs/progress/assistant-life/walkthrough'));
const TOP = Number(opt('--top', 10)) || 10;
const SLOT = opt('--slot', 'afternoon');
const HOURS = { morning: 7, noon: 11, afternoon: 15, evening: 19, night: 22, late: 2 };
const basePath = path.join(__dirname, 'life-walkthrough-baseline.json');
const VIEWS = [{ id: 'tate', name: '縦', w: 390, h: 844 }, { id: 'yoko', name: '横', w: 844, h: 390 }].filter(v => !opt('--view') || v.id === opt('--view'));
const WHOS = [{ id: 'first', name: '初めて' }, { id: 'daily', name: '毎日' }].filter(v => !opt('--who') || v.id === opt('--who'));
// 顔ぶれ(検査 assistant-life-ux-check.js と同じ): みゅあ・きき=おやつ屋さん/ドラ・ソラシド・えるびん=カード部屋/ももすけ=ビート/あつ=家/きゅーこ=図書館
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

// ---- ページの中で測る(見えている字・押せる所) ----
const measure = () => {
  const W = innerWidth, H = innerHeight;
  const rootEl = document.querySelector('[data-assistant-life-screen]') || document.body;
  const seen = (el, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el)); };
  const short = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  // 字: 文字の節ごと
  const texts = [];
  const tw = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.replace(/\s+/g, ''); if (!s) continue;
    const p = n.parentElement; if (!p || p.closest('[aria-hidden="true"],style,script')) continue;
    const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const inView = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    texts.push({ el: p, s, n: [...s].length, px: parseFloat(cs.fontSize) || 0, r, inView, vis: inView && seen(p, Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2))) });
  }
  const vis = texts.filter(t => t.vis);
  const sum = (a, f) => a.reduce((x, t) => x + f(t), 0);
  const pick = (a) => [...new Set(a.map(t => short(t.s)))].slice(0, 3);
  const tiny = vis.filter(t => t.px < 10), small = vis.filter(t => t.px >= 10 && t.px < 11);
  // 切れている字(…で省略・はみ出して隠れる)
  const cut = [...new Set(vis.map(t => t.el))].filter(el => { const cs = getComputedStyle(el); return (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1; });
  // 字どうしの重なり(親子でない2つの字の箱が、小さい方の3割より多く重なる)
  const overlaps = [];
  for (let i = 0; i < vis.length && overlaps.length < 6; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w <= 2 || h <= 2) continue;
    if (w * h > 0.3 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) { overlaps.push(`${short(a.s)}×${short(b.s)}`); break; }
  }
  // 押せる所
  const NAV = /^(←|✕|×|閉じる|とじる|もどる|戻る|閉じる ✕)$/;
  const GAIN = /💗|🤝|仲良し|友情|×\s?\d|\d(\.\d)?倍|券なし|[+＋]\s?\d|ダイヤ|💎|経験値|ごほうび|もらえ|上が|割引|アップ|1割/;
  const taps = [...rootEl.querySelectorAll('button,a[href],[role="button"],[role="tab"],input,select')].map(el => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' && !el.disabled) return null;
    const cx = (Math.max(0, r.left) + Math.min(W, r.right)) / 2, cy = (Math.max(0, r.top) + Math.min(H, r.bottom)) / 2;
    if (!(r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) || !seen(el, cx, cy)) return null;
    const label = short(el.innerText || el.getAttribute('aria-label') || '');
    // 画面いっぱいの「外を押すと閉じる」幕は押せる所に数えない
    if (r.width >= W * 0.9 && r.height >= H * 0.6 && !(el.innerText || '').trim()) return null;
    return { el, r, label, off: !!el.disabled || el.getAttribute('aria-disabled') === 'true', nav: NAV.test((el.innerText || '').trim()) || el.getAttribute('role') === 'tab' || el.hasAttribute('data-mhl-sheet-close') || el.hasAttribute('data-assistant-life-close') || el.hasAttribute('data-assistant-life-ui-switch'),
      gain: GAIN.test(el.innerText || '') };
  }).filter(Boolean);
  const live = taps.filter(t => !t.off), acts = live.filter(t => !t.nav);
  const under = (px) => live.filter(t => Math.min(t.r.width, t.r.height) < px);
  const tapHit = [];
  for (let i = 0; i < live.length && tapHit.length < 6; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 6 && h > 6) { tapHit.push(`${a.label}×${b.label}`); break; }
  }
  // 画面の外(横へはみ出した押せる所。横に送れる入れ物の中は数えない)
  const scrollsX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const out = live.filter(t => (t.r.left < -2 || t.r.right > W + 2) && !scrollsX(t.el));
  // 縦の長さ(いちばん前にある、縦に送れる入れ物)
  let pages = 1;
  for (const el of rootEl.querySelectorAll('*')) { const o = getComputedStyle(el).overflowY; if ((o !== 'auto' && o !== 'scroll') || el.clientHeight < H * 0.25 || el.scrollHeight <= el.clientHeight + 4) continue; const r = el.getBoundingClientRect(); if (!seen(el, Math.min(W - 1, r.left + r.width / 2), Math.min(H - 1, Math.max(0, r.top) + 30))) continue; pages = Math.max(pages, el.scrollHeight / el.clientHeight); }
  const all = vis.map(t => t.s).join(' ');
  const BACK = /あと\s?\d+\s?(時間|分|回|日)|次は|\d+時(から|に|ごろ|まで)?|朝4時|明日|今日あと|連続|日目|まで\s?\d|時間帯/g;
  const back = [...new Set(all.match(BACK) || [])];
  return { chars: sum(vis, t => t.n), allChars: sum(texts, t => t.n), tiny: sum(tiny, t => t.n), tinyEx: pick(tiny), small: sum(small, t => t.n), minPx: vis.length ? Math.min(...vis.map(t => t.px)) : 0,
    cut: cut.length, cutEx: cut.slice(0, 3).map(el => short(el.innerText)), overlap: overlaps.length, overlapEx: overlaps.slice(0, 3),
    taps: live.length, acts: acts.length, off: taps.length - live.length, offEx: taps.filter(t => t.off).slice(0, 3).map(t => t.label), gain: acts.filter(t => t.gain).length,
    t44: under(44).length, t44Ex: under(44).slice(0, 4).map(t => `${t.label}(${Math.round(t.r.width)}×${Math.round(t.r.height)})`), t32: under(32).length, t32Ex: under(32).slice(0, 4).map(t => `${t.label}(${Math.round(t.r.width)}×${Math.round(t.r.height)})`), guide: (all.match(/とは|はじめて|ようこそ|押すと|してみよう|できます|できること|やれること/g) || []).length,
    tapHit: tapHit.length, tapHitEx: tapHit.slice(0, 3), out: out.length, outEx: out.slice(0, 3).map(t => t.label), pages: Math.round(pages * 10) / 10, back: back.length, backEx: back.slice(0, 3) };
};

// ---- 数字 → 気になる所(点が大きいほど先に直したい) ----
const MAIN = new Set(['first-view', 'room-pair', 'room-solo', 'room-away', 'where', 'friends']);
const problemsOf = (key, label, m, view, who) => {
  const P = [], add = (kind, score, text, hard = false) => P.push({ key, label, kind, score: Math.round(score), text, hard });
  const firstChars = view.id === 'tate' ? 420 : 380;
  if (m.out) add('画面の外', 60 + 10 * m.out, `押せる所が画面の横へはみ出す ${m.out}か所(${m.outEx.join('・')})`, true);
  if (m.tapHit) add('タップの重なり', 60 + 10 * m.tapHit, `押せる所どうしが重なる ${m.tapHit}組(${m.tapHitEx.join(' / ')})`, true);
  if (m.overlap) add('字の重なり', 30 + 8 * m.overlap, `字どうしが重なっていそう ${m.overlap}組(${m.overlapEx.join(' / ')})`);
  if (m.tiny) add('字が小さい', Math.min(50, 8 + m.tiny / 4), `10px 未満の字が ${m.tiny}字(いちばん小さい ${m.minPx}px。例: ${m.tinyEx.join('・')})`);
  if (m.small > 30) add('字が小さめ', Math.min(20, m.small / 12), `10〜11px の字が ${m.small}字`);
  if (m.t32) add('タップが小さい', Math.min(60, 12 * m.t32), `32px 未満の押せる所 ${m.t32}か所(${m.t32Ex.join('・')})`);
  else if (m.t44) add('タップが小さめ', Math.min(40, 6 * m.t44), `44px 未満の押せる所 ${m.t44}か所(${m.t44Ex.join('・')})`);
  if (key === 'first-view' && who.id === 'first' && m.guide === 0) add('わかる', 45, '初めて開いた人に「ここは何をする所か・まず何を押すか」の言葉が1つも見えない');
  if (m.taps === 0) add('わかる', 40, '押せる所が1つも見えない(行き止まりに見える)');
  if (m.acts > 12) add('わかる', Math.min(30, (m.acts - 12) * 2), `最初の1画面に押せる所が ${m.acts}個(迷う。12個までが目安)`);
  if (m.off >= 3 && m.off / (m.taps + m.off) > 0.3) add('わかる', 15, `押せない所が ${m.off}個(${m.offEx.join('・')})。押せないわけが近くに要る`);
  if (m.acts >= 2 && m.gain / m.acts < 0.34) add('得が見えない', 35 - 30 * (m.gain / m.acts), `押せる所 ${m.acts}個のうち、何が上がる・もらえるかが字に出ているのは ${m.gain}個`);
  if (MAIN.has(key) && m.back === 0) add('また来る理由', 25, '「次は◯時・あと◯回・朝4時に戻る」のような、次に来る理由の言葉が見えない');
  if (m.chars > firstChars) add('詰まり', Math.min(30, (m.chars - firstChars) / 12), `1画面に ${m.chars}字(${firstChars}字までが目安)`);
  if (m.pages > 2.5) add('長い', Math.min(30, (m.pages - 1) * 8), `縦に ${m.pages}画面ぶん(全部で ${m.allChars}字)`);
  if (m.cut) add('字が切れる', Math.min(25, 5 * m.cut), `字が途中で切れる ${m.cut}か所(${m.cutEx.join('・')})`);
  return P;
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので点検できません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  // 時刻は固定する(時間帯で顔ぶれ・寝ている助手が変わり、数字がぶれるため)。JST の今日の SLOT の時刻
  const now = new Date(Date.now() + 9 * 3600000); now.setUTCHours(HOURS[SLOT] != null ? HOURS[SLOT] : 15, 0, 0, 0);
  const fixed = new Date(now.getTime() - 9 * 3600000);
  const errors = [], rows = [], problems = [];
  const sel = {
    room: (id) => `[data-assistant-life-room="${id}"]`, roomClose: '[data-assistant-life-roomview-close]', icon: (k) => `[data-assistant-life-icon="${k}"]`,
    sheetClose: '[data-mhl-sheet-close]',
  };
  for (const who of WHOS) for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: flag('--2x') ? 2 : 1 });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(fixed);
    page.on('pageerror', e => errors.push(`${who.name}/${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: who.id === 'first', bondAll: null });
    // 初めての人: 友情も道具もにぎわいも、まだ何もない所から
    if (who.id === 'first') await page.addInitScript(() => { if (localStorage.getItem('mh_walk_first') !== null) return; localStorage.setItem('mh_walk_first', '1'); localStorage.setItem('mh_assistant_peer_bond_v1', '{}'); localStorage.removeItem('mh_assistant_life_play_v1'); try { const o = JSON.parse(localStorage.getItem('mh_owned_items')) || {}; delete o.peer_gift; delete o.peer_token; localStorage.setItem('mh_owned_items', JSON.stringify(o)); } catch {} });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const T = `${who.name}/${v.name}`;
    const snap = async (key, label) => {
      await page.waitForTimeout(500);
      const m = await page.evaluate(measure);
      const file = `${who.id}-${v.id}-${key}.png`;
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, file) });
      rows.push({ who: who.id, view: v.id, key, label: `${T} ${label}`, m, file });
      for (const p of problemsOf(key, `${T} ${label}`, m, v, who)) problems.push({ ...p, who: who.id, view: v.id, file });
    };
    const step = async (key, label, go, back) => {
      try { await go(); await snap(key, label); }
      catch (e) { problems.push({ key, label: `${T} ${label}`, kind: 'たどり着けない', score: 100, hard: true, who: who.id, view: v.id, text: `開けなかった(${String(e.message || e).split('\n')[0].slice(0, 70)})` }); }
      try { if (back) await back(); } catch {}
      await page.waitForTimeout(350);
    };
    const click = (s, o = {}) => page.locator(s).first().click({ timeout: 4000, ...o });
    const closeRoom = async () => { for (let i = 0; i < 3 && await page.locator(sel.roomClose).count(); i++) { await click(sel.roomClose).catch(() => {}); await page.waitForTimeout(350); } };
    const closeSheets = async () => { for (let i = 0; i < 3; i++) { const b = page.locator(`${sel.sheetClose}:visible`).last(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); } };
    try {
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, moods: { atsu: 'lonely' }, watched: [] } }); }, MIX);
      await page.waitForTimeout(800); await finishTalk(page);
      await click('[data-home-assistant-life]', { timeout: 20000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
      // 開いてすぐ(はじめての案内などが出ていれば、それも込みで「最初に見える物」)
      await snap('first-view', '開いてすぐ(家)');
      for (let i = 0; i < 4; i++) { const b = page.locator('[data-assistant-life-item-intro-close]:visible, [data-assistant-life-screen] button:visible:text-matches("^(わかった！?|OK|はじめる|とじる)$")').first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
      await step('house-list', '家(みんなの今を開く)', () => click('[data-assistant-life-v2-status] button'), () => click('[data-assistant-life-v2-status] button'));
      await step('diary', '今日あったこと', () => click('[data-assistant-life-board]'), closeSheets);
      await step('call', '声をかける(えらぶ)', () => click('[data-assistant-life-today-act="call"]'), () => click('[data-assistant-life-call-picker] button:has-text("閉じる")'));
      await step('give', '贈る(えらぶ)', () => click('[data-assistant-life-today-act="give"]'), closeSheets);
      await step('room-pair', '部屋(だれかと一緒・みゅあ)', () => click(sel.room('mua')), closeRoom);
      await step('room-solo', '部屋(家にひとり・あつ)', () => click(sel.room('atsu')), closeRoom);
      await step('room-away', '部屋(出かけている・ドラ)', () => click(sel.room('dra')), async () => {});
      await step('masmon', '部屋 → マスモン', async () => { if (!(await page.locator(sel.roomClose).count())) await click(sel.room('dra')); await click('[data-assistant-life-room-do="masmon"]'); await page.locator('[data-assistant-masmon-sheet]').waitFor({ timeout: 4000 }); },
        async () => { await closeSheets(); await page.evaluate(() => { const s = document.querySelector('[data-assistant-masmon-sheet]'); const b = s && [...s.querySelectorAll('button')].find(x => /閉じる|✕|←/.test(x.innerText || x.getAttribute('aria-label') || '')); if (b) b.click(); }); await page.waitForTimeout(300); await closeRoom(); });
      await closeRoom();
      await step('where', '居場所(地図)', () => click(sel.icon('where')));
      await step('where-place', '居場所 → 場所を押す(カード部屋)', () => click('[data-assistant-life-map-place="cardroom"]'), closeSheets);
      await step('friends', '友情', async () => { if (!(await page.locator(`${sel.icon('friends')}:visible`).count())) await click('[data-assistant-life-map-back], [data-assistant-life-close]'); await click(sel.icon('friends')); });
      await step('items', '道具', () => click(sel.icon('items')));
      if (await page.locator(sel.icon('visit')).count()) await step('visit', 'フレンド', () => click(sel.icon('visit')));
    } catch (e) {
      problems.push({ key: 'open', label: `${T} 助手ライフを開く`, kind: 'たどり着けない', score: 100, hard: true, who: who.id, view: v.id, text: String(e.message || e).split('\n')[0].slice(0, 90) });
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  for (const e of [...new Set(errors)].slice(0, 5)) problems.push({ key: 'error', label: 'ページのエラー', kind: 'エラー', score: 100, hard: true, text: e.slice(0, 110) });

  // ---- まとめ ----
  problems.sort((a, b) => b.score - a.score);
  const total = problems.reduce((s, p) => s + p.score, 0), hard = problems.filter(p => p.hard);
  // 同じ画面・同じ種類の指摘は1行にまとめる(いちばん重い1枚の文+当てはまる枚数)
  const merged = [];
  for (const p of problems) { const g = merged.find(x => x.key === p.key && x.kind === p.kind); if (g) { g.sum += p.score; g.where.push(`${p.who || ''}/${p.view || ''}`); } else merged.push({ ...p, sum: p.score, where: [`${p.who || ''}/${p.view || ''}`] }); }
  merged.sort((a, b) => b.sum - a.sum);
  const byScreen = {};
  for (const r of rows) { const s = byScreen[r.key] = byScreen[r.key] || { label: r.label.split(' ').slice(1).join(' '), n: 0, score: 0, tiny: 0, t44: 0, acts: 0, gain: 0, back: 0, pages: 0, chars: 0 }; s.n++; s.tiny += r.m.tiny; s.t44 += r.m.t44; s.acts += r.m.acts; s.gain += r.m.gain; s.back += r.m.back ? 1 : 0; s.pages = Math.max(s.pages, r.m.pages); s.chars = Math.max(s.chars, r.m.chars); }
  for (const p of problems) if (byScreen[p.key]) byScreen[p.key].score += p.score;
  const summary = { slot: SLOT, total, hard: hard.length, screens: Object.fromEntries(Object.entries(byScreen).map(([k, s]) => [k, s.score])) };
  if (opt('--json')) fs.writeFileSync(path.resolve(opt('--json')), JSON.stringify({ summary, rows, problems }, null, 1));
  console.log(`助手ライフ(新しいUI)の通し点検 — ${WHOS.map(w => w.name).join('・')} × ${VIEWS.map(x => `${x.name}${x.w}×${x.h}`).join('・')} / 時間帯 ${SLOT} / 画面 ${rows.length}枚`);
  console.log('\n■ 画面ごと(点の大きい順。点=気になる所の重さの合計/得=何が上がるかが出ている押せる所/また来る=次に来る理由の言葉がある枚数)');
  const pad = (s, n) => { s = String(s); let w = 0; for (const c of s) w += c.charCodeAt(0) > 255 ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
  for (const [, s] of Object.entries(byScreen).sort((a, b) => b[1].score - a[1].score))
    console.log(`  ${pad(s.label, 34)} 点${pad(s.score, 5)} 得 ${pad(`${s.gain}/${s.acts}`, 7)} また来る ${s.back}/${s.n}  小さい字 ${pad(s.tiny, 5)} 小さいタップ ${pad(s.t44, 4)} 縦 ${s.pages}画面`);
  if (FULL) { console.log('\n■ 全部の行'); for (const r of rows) console.log(`  ${r.label}: ${JSON.stringify({ 字: r.m.chars, 小: r.m.tiny, 最小px: r.m.minPx, 押せる: r.m.acts, 得: r.m.gain, 押せない: r.m.off, 'タップ<44': r.m.t44, 縦: r.m.pages, また来る: r.m.backEx })}`); }
  console.log(`\n■ 気になる所(大きい順の上位 ${Math.min(TOP, merged.length)} / 全 ${merged.length}種類。[ ]は点の合計・( )は当てはまった枚数)`);
  for (const p of merged.slice(0, TOP)) console.log(`  ${p.hard ? 'NG' : '・'} [${p.sum}] ${p.label.split(' ').slice(1).join(' ') || p.label}(${p.where.length}枚) — ${p.kind}: ${p.text}`);
  if (SHOTS) console.log(`\n止め絵: ${path.relative(root, shotDir)}/<人>-<向き>-<画面>.png(${rows.length}枚)`);
  if (SAVE) { fs.writeFileSync(basePath, JSON.stringify(summary, null, 1) + '\n'); console.log(`控えを書きました: ${path.relative(root, basePath)}`); }
  let base = null; try { base = JSON.parse(fs.readFileSync(basePath, 'utf8')); } catch {}
  const partial = WHOS.length < 2 || VIEWS.length < 2;
  const worse = base && !partial && base.slot === SLOT && total > base.total * 1.1 + 20;
  const diff = base && !partial && base.slot === SLOT ? `控えとの差 ${total - base.total >= 0 ? '+' : ''}${total - base.total}点` : '控えとは比べていません';
  if (base && !partial && base.slot === SLOT && total !== base.total) { const d = Object.keys(byScreen).map(k => [byScreen[k].label, byScreen[k].score - (base.screens[k] || 0)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3); if (d.length) console.log(`控えから動いた画面: ${d.map(x => `${x[0]} ${x[1] > 0 ? '+' : ''}${x[1]}`).join(' / ')}`); }
  const ng = hard.length > 0 || worse;
  console.log(`\n${ng ? 'NG' : 'OK'}: 合計 ${total}点・気になる所 ${merged.length}種類・壊れている所 ${hard.length}件・${diff}${worse ? '(1割より多く悪くなった)' : ''}`);
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); console.log('NG: 点検の道具が途中で止まりました'); process.exit(1); });
