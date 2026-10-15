#!/usr/bin/env node
// 行動カードの絵の「文字の置き場」(2026-10-15 社長「位置も枠にかぶってるやつもある」)を、手札に出る名前を全部置いて確かめる。
//
//   node tools/battle/card-name-fit-browser-check.js
//
// 本物の CSS(index.html の <style> と tailwind.css)と、本物の折り方・字の大きさ(battleCardNameLines / battleCardNameFit)で、
// 手札と同じ大きさのカード(縦持ち 72×133・横持ち 72×111)を作り、名前を1つずつ置いて測る。
//   ① 置き場はカード幅の16.5%より内側(中の面の宝石はカード幅の約14%まで来る)・上は段階の札の下・下は下段の札の上
//      金の枠(固有技)は、大きい丸の下の宝石の飾り(カードの高さの約42.5%)より下(2026-10-15 社長「固有技だけカードの柄に被ってる」)
//   ② 名前は置き場からはみ出さない(下の飾り線の場所 6px も残す。横持ちの金の枠は名前の欄が狭いので線を出さない)。赤・金の両方、縦持ち・横持ちの両方
//   ③ 字は 6px 以上。7px を下回る名前は、語を割れない少しだけの名前(一覧を出す)
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 手札に出る名前(card-art-check.js ⑥ と同じ集め方)
const collectNames = () => {
  const ally = read('monster-hero/data/ally-monsters.js'), skills = read('monster-hero/data/skills.js'), breederSrc = read('monster-hero/data/breeder.js');
  const strs = (t) => [...t.matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] || m[2]);
  const names = new Set();
  const atkSrc = ally.slice(0, ally.indexOf('};', ally.indexOf('const HERO_ATK_NAMES')));
  for (const m of atkSrc.matchAll(/\[([^\]]*)\]/g)) strs(m[1]).forEach((x) => names.add(x));
  for (const m of ally.matchAll(/names:\s*\[([^\]]*)\]/g)) strs(m[1]).forEach((x) => names.add(x));
  const ge = skills.slice(skills.indexOf('const GUARD_EVOLUTION'), skills.indexOf('const RANGE_EVOLUTION'));
  for (const m of ge.matchAll(/name:"([^"]+)"/g)) names.add(m[1]);
  const re = skills.slice(skills.indexOf('const RANGE_EVOLUTION'), skills.indexOf('const TYPE_COLORS'));
  for (const m of re.matchAll(/name:"([^"]+)"/g)) ['零', '近', '中', '遠'].forEach((l) => names.add(l + m[1]));
  const be = breederSrc.slice(breederSrc.indexOf('const BREEDER_EVO_NAMES'), breederSrc.indexOf('};', breederSrc.indexOf('const BREEDER_EVO_NAMES')));
  for (const m of be.matchAll(/"([^"]+)"/g)) names.add(m[1]);
  return [...names];
};

const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const nameCtx = {};
vm.createContext(nameCtx);
vm.runInContext(battle.slice(battle.indexOf('const BATTLE_CARD_NAME_PER_LINE'), battle.indexOf('const BATTLE_CARD_ROMAN = Object.freeze(')).replace(/^const /gm, 'var '), nameCtx);
const names = collectNames();
const cards = names.map((n) => ({ name: n, lines: nameCtx.battleCardNameLines(n), style: nameCtx.battleCardNameFit(n) }));

const html = read('monster-hero/index.html');
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const mockPage = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="tailwind.css"><style>${style}</style></head><body style="margin:0;background:#111"><div id="root" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px"></div></body></html>`;

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  if (rel === 'monster-hero/__card-name-fit.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(mockPage); return; }
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': /\.css$/.test(file) ? 'text/css' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const small = [];
    for (const [label, vw, vh, cardH] of [['縦持ち', 390, 844, 133], ['横持ち', 844, 390, 111]]) {
      const page = await browser.newPage({ viewport: { width: vw, height: vh } });
      await page.goto(`http://localhost:${port}/monster-hero/__card-name-fit.html`);
      const res = await page.evaluate(({ cards, cardH }) => {
        const rootEl = document.getElementById('root');
        const out = { bad: [], room: [], small: [], fonts: [] };
        const mk = (c, kind) => {
          const card = document.createElement('div');
          card.setAttribute('data-card-art', kind === 'gold' ? 'gold' : 'std');
          card.setAttribute('data-card-plate', kind);
          card.style.cssText = `position:relative;width:72px;height:${cardH}px;isolation:isolate;flex:none`;
          card.innerHTML = '<div data-decoration></div><div><div data-card-name class="text-[11px] font-black leading-[13px] w-full whitespace-normal flex items-center justify-center overflow-hidden px-0.5"><span data-card-name-text></span></div>'
            // 下段の札は本物(71-screen-battle.jsx の技変更の段)と同じ作り。高さは CSS の min-height で決まる
            + '<div data-skill-change class="flex w-full shrink-0 flex-col items-stretch justify-between gap-px rounded-[7px] border border-white/60 p-[2px]"><span class="flex items-center justify-center gap-0.5 pt-px text-[9px] font-black leading-none"><span>⇄</span>技変更</span>'
            + '<div data-card-genre="攻撃" class="w-full truncate rounded-[5px] px-0.5 text-[8px] font-black leading-[11px]">攻撃</div></div></div>'
            + (kind === 'gold' ? '' : '<span class="mh-card-art-roman" data-card-art-roman>II</span>');
          const span = card.querySelector('[data-card-name-text]');
          Object.assign(span.style, c.style);
          c.lines.forEach((l, k) => { if (k > 0) span.appendChild(document.createElement('br')); span.appendChild(document.createTextNode(l)); });
          rootEl.appendChild(card);
          return card;
        };
        const placed = [];
        for (const c of cards) for (const kind of ['red', 'gold']) placed.push([c, kind, mk(c, kind)]);
        for (const [c, kind, card] of placed) {
          const cr = card.getBoundingClientRect();
          const nameEl = card.querySelector('[data-card-name]');
          const nr = nameEl.getBoundingClientRect(), cs = getComputedStyle(nameEl);
          const box = { l: nr.left + parseFloat(cs.paddingLeft), r: nr.right - parseFloat(cs.paddingRight), t: nr.top + parseFloat(cs.paddingTop), b: nr.bottom - parseFloat(cs.paddingBottom) };
          const sr = card.querySelector('[data-card-name-text]').getBoundingClientRect();
          const after = getComputedStyle(nameEl, '::after');
          const ruleH = parseFloat(after.height) || 0, gap = parseFloat(cs.rowGap) || 0;
          const font = parseFloat(getComputedStyle(card.querySelector('[data-card-name-text]')).fontSize);
          out.fonts.push(font);
          // ① 置き場そのもの(1つ目の名前でだけ見れば足りるが、全部見ても軽い)
          const roman = card.querySelector('[data-card-art-roman]');
          const plate = card.querySelector('[data-skill-change]').getBoundingClientRect();
          const roomOk = box.l - cr.left >= cr.width * 0.165 - 0.3 && cr.right - box.r >= cr.width * 0.165 - 0.3
            && (!roman || box.t >= roman.getBoundingClientRect().bottom - 0.3) && (kind !== 'gold' || box.t >= cr.top + cr.height * 0.425) && box.b <= plate.top + 0.3 && (ruleH >= 6 || (kind === 'gold' && innerWidth > innerHeight));
          if (!roomOk && out.room.length < 3) out.room.push(`${kind}: 左${(box.l - cr.left).toFixed(1)} 右${(cr.right - box.r).toFixed(1)} 上${box.t.toFixed(1)}/${roman ? roman.getBoundingClientRect().bottom.toFixed(1) : '-'} 下${box.b.toFixed(1)}/${plate.top.toFixed(1)} 線${ruleH}`);
          // ② はみ出し(字と飾り線をまとめて置き場に収める)
          const fits = sr.left >= box.l - 0.5 && sr.right <= box.r + 0.5 && sr.height + gap + ruleH <= box.b - box.t + 0.5;
          if (!fits) out.bad.push(`${c.lines.join('/')}(${kind} ${font.toFixed(1)}px 幅${sr.width.toFixed(1)}/${(box.r - box.l).toFixed(1)} 高さ${(sr.height + gap + ruleH).toFixed(1)}/${(box.b - box.t).toFixed(1)})`);
          if (font < 7 - 0.01 && kind === 'red') out.small.push(`${c.lines.join('/')} ${font.toFixed(1)}px`);
          if (font < 6 - 0.01) out.bad.push(`${c.name} ${font}px`);
        }
        return out;
      }, { cards, cardH });
      check(`① ${label}: 置き場は中の面の宝石より内側・段階の札(金は丸の下の飾り)の下〜下段の札の上・飾り線の場所 6px(横持ちの金は線なし)`, res.room.length === 0, res.room.join(' / '));
      check(`② ${label}: ${cards.length}件 × 赤・金 の名前が置き場からはみ出さない`, res.bad.length === 0, res.bad.slice(0, 6).join(' '));
      const f = res.fonts.sort((a, b) => a - b);
      console.log(`   ${label}: 字の大きさ 最小${f[0].toFixed(1)}px・真ん中${f[Math.floor(f.length / 2)].toFixed(1)}px・最大${f[f.length - 1].toFixed(1)}px`);
      small.push(...res.small.map((s) => `${label} ${s}`));
      await page.close();
    }
    // ③ 縦持ちで 7px を下回るのは、語を割れない数件だけ(横持ちは高さで決まるので3行の名前は小さくなってよい)
    const portraitSmall = small.filter((s) => s.startsWith('縦持ち'));
    check('③ 縦持ちで 7px を下回る名前は5件以下', portraitSmall.length <= 5, portraitSmall.join(' / '));
    if (small.length) console.log(`   7px 未満: ${small.join(' / ')}`);
  } catch (e) { check('ブラウザで確かめられた', false, String(e).slice(0, 300)); }
  finally { if (browser) await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
