#!/usr/bin/env node
// モンヒロサクセス 回3(大会・修行・引退・ゲームオーバー・保存枠)を本物のブラウザで開き、画面ごとに
// 「真っ白にならない・字が枠からはみ出さない・ページのエラーが出ない・保存枠に1回だけ入る」を見る。
//
//   node tools/success/success-r3-shoot.js                  … 縦390×844 で全部の画面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-r3-shoot.js … 縦390×844 と 幅320×568 で撮る
//
// 入口はデバッグ設定だけなので、回2の撮影(success-shoot.js)と同じく MonheroSuccessScreen を直接置いて開く。
// 途中の育成は芯で決まった手を打って作り、場面に合わせて形を整えてから mh_monsuc_run_v1 へ入れる。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const { scanTextWrap } = require(path.resolve(__dirname, '..', 'playbot', 'lib', 'text-wrap')); // 言葉・値の途中の折れ(r1114-077)
const { msxUiRulesMeasure, msxScrollStripTexts, BLANK_MAX } = require('./msx-ui-rules'); // 画面の決まり(docs/spec/MONSUC_UI.md)の見張り
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で: 芯で途中の育成を作り、場面に合わせて形を整える
const makeRun = async (kind) => {
  /* global msxLoad, msxSuc */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'r3-shot-1', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4, items: { sand: 2, rainbow: 1 } });
  const goal = window.__SHOT_GOAL || (kind === 'debut' ? 5 : 22); // SHOT_GOAL=<ターン> で、大会の名前の見え方を月ごとに撮れる
  let guard = 0;
  while (s.turn < goal && !s.over && guard++ < 200) {
    const v = SUC.peek(s);
    let a;
    if (v.can.includes('cond')) a = { kind: 'cond' };
    else if (v.can.includes('retry')) a = { kind: 'retry' };
    else if (s.hp < s.hpMax * 0.45) a = { kind: 'rest' };
    else { const keys = Object.keys(v.cards).filter((k) => k.startsWith('light:') || k.startsWith('train:')); keys.sort((x, y) => (v.cards[y].mult - v.cards[x].mult)); a = { kind: v.cards[keys[0]].kind, stat: v.cards[keys[0]].stat }; }
    s = SUC.act(s, a).state;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
    let g2 = 0; while (s.battle && g2++ < 5) s = SUC.settle(s, true).state;
  }
  s = { ...s, acted: false, battle: null, over: null, tickets: 3, items: { sand: 2, rainbow: 1 } };
  let phase = 'main';
  const stats = (n) => ({ life: n, pow: n, wise: n, hit: n, eva: n, tough: n });
  if (kind === 'win' || kind === 'lose') { s = { ...s, stats: stats(kind === 'win' ? 700 : 40), battle: { kind: 'cup', id: 'x', sys: 'str', star: 2, rival: null, round: 0 } }; phase = 'battle'; }
  if (kind === 'debutlose') { s = { ...s, turn: 5, wonNow: [], wonBefore: [], stats: stats(30), debutLoss: 2, debutWon: false, rematchUsed: 3, battle: { kind: 'debut', round: 0, retry: 2 } }; phase = 'battle'; }
  if (kind === 'kimatsu' || kind === 'summit') { // 期末の大会・最後の大会の当日(芯が battle を立てた直後。まだ「はい」を押していない)
    const want = kind === 'kimatsu' ? 'junior' : 'final';
    let t = 1; while (t < (SUC.TOTAL_TURNS || 46) && !(SUC.periodOf(t).key === want && (kind === 'summit' ? SUC.periodOf(t).at >= 3 : SUC.periodOf(t + 1).key !== want))) t++;
    s = { ...s, turn: t, battle: kind === 'kimatsu' ? { kind: 'junior', round: 0 } : { kind: 'summit', round: 0 } }; phase = 'battle';
  }
  if (kind === 'gameover') { s = { ...s, turn: 7, debutLoss: 3, over: 'gameover' }; phase = 'over'; }
  if (kind === 'retire') { s = { ...s, turn: 46, pts: 34, over: 'done' }; phase = 'over'; }
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase, out: null, log: [{ turn: 3, t: '休んだ' }], startAt: 1 };
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [320, 568, 's320']] : [[390, 844, '']];
  // [名前, 作る育成, 操作(data 属性 か テキストの正規表現)]。'@x' は [data-msx-r3-x] を押す
  const SHOTS = [
    ['C1', 'mid', ['cont', /^🏆大会/]],
    ['C1w', 'mid', ['cont', /^🏆大会/, '@cup']], ['C1p', 'mid', ['cont', /^🏆大会/, '@cup', '@prize=g']], ['C1m', 'mid', ['cont', /^🏆大会/, '@next-month']], // 受付の作り直し(確認の窓・賞品の詳細・次の月)
    // 大会の1戦はバトル部の見せる部品 MonsucCupShow('%x' は [data-msc-x])。賞品のあとのごはんは回3
    ['B1', 'win', ['cont', '@cupintro-go']], ['C2', 'win', ['cont', '@cupintro-go', '%go']], ['W1', 'win', ['cont', '@cupintro-go', '%go', '%ready']],
    ['B2', 'win', ['cont', '@cupintro-go', '%quick']], ['R1', 'win', ['cont', '@cupintro-go', '%quick', '%next']], ['C3', 'win', ['cont', '@cupintro-go', '%quick', '%next', '@next']], ['C3b', 'win', ['cont', '@cupintro-go', '%quick', '%next', '@next', '@meal=f_pow']], // R1: 賞金ランク UP!(段が上がったときだけ)
    ['C4', 'lose', ['cont', '@cupintro-go', '%quick']], ['C4r', 'lose', ['cont', '@cupintro-go', '%quick', '%rematch=sand']], ['C4g', 'lose', ['cont', '@cupintro-go', '%quick', '%giveup']],
    ['C4d', 'debutlose', ['cont', '@cupintro-go', '%quick']],
    ['Q1', 'mid', ['cont', /^⚔修行/]], ['Q2', 'mid', ['cont', /^⚔修行/, '@shugyo']], ['Q3', 'mid', ['cont', /^⚔修行/, '@shugyo', '@qskip', '@qnext']],
    // 期末の大会の当日(参考 te-30〜34): 当日のメイン(能力と大会だけ)→ 受付に1つ → 参加の確認 → 紋章の入り → 表
    ['K0', 'kimatsu', ['cont']], ['K1', 'kimatsu', ['cont', '@precup']], ['K2', 'kimatsu', ['cont', '@precup', '@enter']], ['K2c', 'kimatsu', ['cont', '@precup', '@enter', '@pre-cancel']],
    ['K3', 'kimatsu', ['cont', '@precup', '@enter', '@yes']], ['K4', 'kimatsu', ['cont', '@precup', '@enter', '@yes', '@cupintro-go']],
    ['S0', 'summit', ['cont']], ['S2', 'summit', ['cont', '@precup', '@enter']],
    ['G1', 'gameover', ['cont']],
    // マスモン一覧(モンサク)の画面(2026-11-14 作り直し): X0 入口・X3 一覧・X4 詳細(基礎・技)・X5 特徴と育成情報・X6 適性とアシスト・X7 お別れのタブ・X8 表示の切り替えの小窓
    ['X0', 'box', ['@openbox']], ['X3', 'box', ['@openbox', '@mmlist']], ['X4', 'box', ['@openbox', '@mmlist', '@boxmon=b1']],
    ['X5', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-tab=feat']], ['X6', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-tab=apt']],
    ['X9', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#tech=sk-0405']],
    ['X10', 'box', ['@openbox', '@mmlist', '@boxmon=bx0']], // 同じ間合い・同じランクに技が2つある種族(スネグーラチカ): そのランクの段が2行になる // 詳細の技の升目で、覚えていない技を押した所(右の詳細に覚え方の条件)
    ['X7', 'box', ['@openbox', '@mmlist', '@mmbye']], ['X8', 'box', ['@openbox', '@mmlist', '@mmlabel']],
    ['X1', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '@edit']], ['X2', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '@edit', '@editsave']],
    // 引退: 能力ポイントが残っていれば E3(使う)→ E0(最終の評価)→ E1(振り返り)→ E2(アシスト)→ マスモンボックス(2026-11-14 参考 v4 の順)
    ['E3', 'retire', ['cont']], ['E3b', 'retire', ['cont', '@bal']], ['E0', 'retire', ['cont', '@bal', '@e3']], ['E1', 'retire', ['cont', '@bal', '@e3', '@e0']],
    ['E2', 'retire', ['cont', '@bal', '@e3', '@e0', '@e1', '@auto']], ['E9', 'retire', ['cont', '@bal', '@e3', '@e0', '@e1', '@auto', '@decide', '@decide']],
  ];
  try {
    for (const [w, h, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript((g) => { window.__SHOT_GOAL = g; }, Number(process.env.SHOT_GOAL) || 0);
      await page.addInitScript((r) => { if (r) window.__MSC_BK_RESULT = r; }, process.env.SHOT_BK_RESULT || ''); // win / lose: 決勝のあとの表(勝った側の線が優勝の札へ)
      await page.addInitScript((k) => { if (k) window.__MSC_BK_T = k; }, Number(process.env.SHOT_BK) || 0); // SHOT_BK=<倍率> で、組み合わせ表の演出をゆっくりにして段ごとに撮る
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); /* β版の説明は monsuc-beta-browser-check.js が見る */ localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'])); } catch (e) {} });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof MsxR3 === 'function' && typeof msxLoad === 'function' && typeof MASMON_CALC !== 'undefined', undefined, { timeout: 90000 });
      for (const [name, kind, steps] of SHOTS) {
        if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue; // ONLY=C1,C1w で撮る画面だけにする
        const label = `${name}${tag ? `(${tag})` : ''}`;
        await page.evaluate(async ({ kind, mk }) => {
          // eslint-disable-next-line no-new-func
          const make = new Function(`return (${mk})`)();
          if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; }
          localStorage.removeItem('mh_monsuc_box_v1');
          if (kind === 'box') { // 保存枠に2体(名前と染色を変える画面を見る)
            const st = { life: 600, pow: 700, wise: 400, hit: 500, eva: 450, tough: 650 };
            localStorage.setItem('mh_monsuc_box_v1', JSON.stringify({ v: 1, cap: 30, memory: [], mons: [
              { id: 'b1', species: 'Mocchi', nick: 'もちまる', colors: [], gen: 1, st, techs: ['sk-0402', 'sk-0400', 'sk-0401'], mast: [40, 12, 0], fav: ['pow', 'tough'], coach: 'mua', endAt: Date.parse('2026-11-14T12:00:00+09:00'), ending: 'good', loy: 80, pop: 60, lv: 8, rank: 'A', grade: 'A2', score: 11800, raised: true, assists: [], titles: [], keepMe: 'x' },
              { id: 'b2', species: 'Golem', nick: 'いわお', colors: [], gen: 1, st, techs: [], mast: [], loy: 70, pop: 40, lv: 6, rank: 'B', grade: 'B3', score: 9200, raised: true, assists: [], titles: [] },
              ...['Snegurochka', 'Golem', 'Mocchi', 'Golem', 'Mocchi', 'Golem'].map((sp, i) => ({ id: `bx${i}`, species: sp, nick: '', colors: [], gen: 1 + (i % 3), st, techs: [], mast: [], loy: 50, pop: 30, lv: 3 + i, rank: 'C', grade: `C${i + 1}`, score: 6000 + i * 350, raised: true, assists: [], titles: [] }))] }));
            localStorage.removeItem('mh_monsuc_run_v1');
          } else { const run = await make(kind); localStorage.setItem('mh_monsuc_run_v1', JSON.stringify(run)); }
          const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' });
          document.body.appendChild(el);
          window.__msxRoot = ReactDOM.createRoot(el);
          window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
        }, { kind, mk: makeRun.toString() });
        await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
        const beat0 = name === 'R1' || name === 'E9' ? await page.evaluate(() => loadRhythmEventPoints()) : 0;
        const pend0 = name === 'E9' ? await page.evaluate(async () => { const r = await storeGet(MSX_KEYS.run, null); return r && r.s ? (r.s.beatEarned || 0) - (r.beatSent || 0) : 0; }) : 0; // まだ本編へ渡していない大会の分
        for (const st of steps) {
          const done = await page.evaluate(async (st) => {
            if (st.re) { const re = new RegExp(st.re); const b = [...document.querySelectorAll('.msx button')].find((x) => re.test((x.innerText || '').replace(/\s+/g, '')) && !x.disabled); if (b) b.click(); return !!b; }
            if (st === 'cont') { const b = [...document.querySelectorAll('.msx button')].find((x) => /続きから|結果を見る/.test(x.innerText || '')); if (b) b.click(); return !!b; }
            const [k, val] = st.slice(1).split('=');
            const pre = st[0] === '%' ? 'data-msc-' : st[0] === '#' ? 'data-msx-' : 'data-msx-r3-'; // '#x' は [data-msx-x](詳細の窓 MsxMonDetail のタブなど)
            const b = document.querySelector(`[${pre}${k}${val ? `="${val}"` : ''}]`);
            if (b && !b.disabled) b.click(); return !!(b && !b.disabled);
          }, st instanceof RegExp ? { re: st.source } : st);
          if (!done) check(`${label}: 「${st}」が押せる`, false);
          await page.waitForTimeout(st === '%ready' ? 2500 : 700);
        }
        await page.waitForTimeout(500 + (Number(process.env.SHOT_WAIT) || 0)); // SHOT_WAIT=<ms> で、動く演出の途中を撮る
        const m = await page.evaluate(() => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          const R = root.getBoundingClientRect();
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map((e) => (e.innerText || e.className).slice(0, 20));
          const box = JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null');
          return { ok: true, text: root.innerText.length, over, head: root.innerText.slice(0, 160).replace(/\s+/g, ' '), boxN: box && Array.isArray(box.mons) ? box.mons.length : 0, run: localStorage.getItem('mh_monsuc_run_v1') };
        });
        const u = await page.evaluate(msxUiRulesMeasure);
        // 演出の飾り(舞う葉っぱ・炎など、絵文字だけの粒)が画面の外へ出るのは見ない
        const strip = await page.evaluate(msxScrollStripTexts);
        const wr = (await scanTextWrap(page)).filter((x) => !(x.kind === '画面の外へはみ出した文字' && (!/[0-9A-Za-zぁ-んァ-ヶ一-龠]/.test(x.text) || strip.some((t) => t.startsWith(x.text.slice(0, 12))))));
        // 基準の大きさ(縦390・横844)では止める。小さい画面・大きい文字は、直す順番待ちの一覧として知らせるだけ(2026-11-14)
        if (!tag) check(`${label}: 文字が値・札の途中で折れない(scanTextWrap)`, wr.length === 0, wr.slice(0, 3).map((x) => `${x.kind}「${x.text}」`).join(' / '));
        else if (wr.length) console.log(`  見張り ${label}: 文字の折れ ${wr.length}件 ${wr.slice(0, 2).map((x) => `${x.kind}「${x.text}」`).join(' / ')}`);
        // 保存枠(マスモンの画面)はクラフト12が参考 mm-01〜04 の形へ作り直し中。それまでは知らせるだけ(作り直したら外す)
        // 大会の1戦の画面(B・C2〜C4・W・R)はバトル部の受け持ち(MonsucCupShow)。決まりは渡してあるので、直るまでは知らせるだけ
        const blankLater = ['X1', 'X2'].includes(name) || /^(B\d|C[2-4]|W\d|R\d)/.test(name);
        if (u && u.blank != null && blankLater && u.blank > BLANK_MAX) console.log(`  見張り ${label}: 下の空き ${u.blank}px(作り直し待ち)`);
        else if (u && u.blank != null) check(`${label}: 下に大きな空きが無い(${BLANK_MAX}px まで)`, u.blank <= BLANK_MAX, `${u.blank}px`);
        if (u) check(`${label}: 見せ場の数字(.v-num)が真ん中`, u.offNum.length === 0, u.offNum.slice(0, 3).join(' / '));
        check(`${label}: 画面が出る`, m.ok && m.text > 20, m.head);
        check(`${label}: 枠からはみ出さない`, m.ok && m.over.length === 0, m.over && m.over.slice(0, 3).join(' / '));
        if (name === 'X2') { const b = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null')); const m = b && b.mons.find((x) => x.id === 'b1');
          check(`${label}: 名前と染色を決めても、ほかの項目と子は残る`, !!m && m.nick === 'もちまる' && m.keepMe === 'x' && Array.isArray(m.colors) && b.mons.length === 8); }
        if (name === 'K0' || name === 'S0') { const k = await page.evaluate(() => ({ n: document.querySelectorAll('[data-msx-pre-main] button').length, train: [...document.querySelectorAll('.msx .v-act button')].some((b) => /トレーニング|修行/.test(b.innerText || '')), bracket: !!document.querySelector('[data-msc-go], [data-msx-r3-cupintro]') }));
          check(`${label}: 当日のメインのボタンは「能力」と「大会」の2つだけ・まだ表へ飛ばない`, k.n === 2 && !k.train && !k.bracket, JSON.stringify(k)); }
        if (/^(K[0-3]|S[02]|Q1)$/.test(name) && !tag) { // 画面の決まり(MONSUC_UI): 中身のいちばん下とボタンの列のあいだは 48px まで(縦)
          const gap = await page.evaluate(() => { const ft = document.querySelector('.msx .v-ft'); const kids = [...document.querySelectorAll('.msx .v-body > *')].filter((e) => getComputedStyle(e).position !== 'absolute' && e.getBoundingClientRect().height > 0); if (!ft || !kids.length) return -1; const rs = kids.map((e) => e.getBoundingClientRect()).sort((x, y) => x.top - y.top); let mid = 0; for (let i = 1; i < rs.length; i++) mid = Math.max(mid, rs[i].top - Math.max(...rs.slice(0, i).map((r) => r.bottom))); return Math.round(Math.max(mid, ft.getBoundingClientRect().top - Math.max(...rs.map((r) => r.bottom)))); });
          check(`${label}: 下の空き・札のあいだの空きが 48px まで`, gap >= 0 && gap <= 48, `${gap}px`); }
        if (name === 'K2') { const pz = await page.evaluate(() => { const box = document.querySelector('[data-msx-r3-cupwin] .in'); if (!box) return { ok: false }; const R = box.getBoundingClientRect(); const bs = [...box.querySelectorAll('[data-msx-r3-prize]')]; return { ok: bs.length > 0 && bs.every((b) => { const r = b.getBoundingClientRect(); return r.left >= R.left - 1 && r.right <= R.right + 1; }), n: bs.length }; });
          check(`${label}: 獲得物の札が全部 枠の中に見える`, pz.ok, `${pz.n}枚`); }
        if (name === 'R1') { // ビートP: 優勝の分が本編のビートPに1回だけ足される(同じ育成をもう一度保存しても増えない)
          const bp = await page.evaluate(async (w0) => { const run = await storeGet(MSX_KEYS.run, null); const w1 = await loadRhythmEventPoints(); if (run) await msxSaveRun(run); if (run) await msxSaveRun({ ...run }); const w2 = await loadRhythmEventPoints();
            // デバッグの入口からの育成: 渡した量の印は進むが、財布は増えない
            const more = { ...run, s: { ...run.s, beatEarned: (run.s.beatEarned || 0) + 100 } }; more.beatSent = more.s.beatEarned; await msxSaveRun(more, true);
            const w3 = await loadRhythmEventPoints(); const st = await storeGet(MSX_KEYS.run, null); if (run) await msxSaveRun(run, true);
            // ほかのタブで引退・やめたあとの古い画面: 途中の育成を消してから古い run で保存 → 財布は増えず、育成も戻らない
            await msxClearRun(); const stale = { ...run, s: { ...run.s, beatEarned: (run.s.beatEarned || 0) + 50 } }; stale.beatSent = stale.s.beatEarned; await msxSaveRun(stale); const w4 = await loadRhythmEventPoints(); const back = await storeGet(MSX_KEYS.run, null); if (run) await storeSet(MSX_KEYS.run, run);
            return { sent: run && run.beatSent, earned: run && run.s && run.s.beatEarned, d1: w1 - w0, d2: w2 - w1, dbg: w3 - w2, dbgSent: st && st.beatSent === more.beatSent, stale: w4 - w3, staleBack: !!back }; }, beat0);
          check(`${label}: 優勝のビートPが本編へ1回だけ足される`, bp.sent > 0 && bp.sent === bp.earned && bp.d1 === bp.sent && bp.d2 === 0, JSON.stringify(bp));
          check(`${label}: デバッグの入口からの育成では、本編のビートPに足さない`, bp.dbg === 0 && bp.dbgSent, JSON.stringify(bp));
          check(`${label}: 途中の育成を消したあとの古い画面の保存では、財布が増えず育成も戻らない`, bp.stale === 0 && !bp.staleBack, JSON.stringify(bp)); }
        if (name === 'K2c') check(`${label}: キャンセルで受付へ戻る`, await page.evaluate(() => !document.querySelector('[data-msx-r3-cupwin]') && !!document.querySelector('[data-msx-r3-pre-card]')));
        if (name === 'K3') check(`${label}: 「はい」で紋章の入り`, await page.evaluate(() => !!document.querySelector('[data-msx-r3-cupintro="junior"]')));
        if (name === 'E9') { const e = await page.evaluate(async (w0) => { const b = await storeGet(MSX_KEYS.box, null); const m = b && b.mons && b.mons[0]; const w1 = await loadRhythmEventPoints(); return { rank: m && m.rank, d: w1 - w0, end: msxSuc.SUC.beatOfEnd(m && m.rank) }; }, beat0); e.want = e.end + pend0;
          check(`${label}: 引退したら、総合力のランクのビートPが1回だけ足される`, e.d === e.want, JSON.stringify(e)); }
        if (name === 'E9') check(`${label}: 保存枠に1体入り、途中の育成が消える`, m.boxN === 1 && (m.run === null || m.run === 'null'), `保存枠 ${m.boxN}体`);
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `r3-${name}${tag ? `-${tag}` : ''}.png`) }); }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();
