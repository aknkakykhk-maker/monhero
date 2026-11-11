#!/usr/bin/env node
// 助手のマスモンの修行(第②段階)の札を、本物の部品(56-assistant-life-masmon-train.jsx)で描いて止め絵にする。公開の印を真にした見本。
//   出力: docs/progress/assistant-peer/masmon-train/mock.html と mock.jpg(社長に見てもらう用)
const fs = require('fs');
const path = require('path');
const babel = require(require.resolve('@babel/core', { paths: [path.join(__dirname, '..')] }));
const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'docs/progress/assistant-peer/masmon-train');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon-train.jsx'), 'utf8');
const code = babel.transformSync(src, { presets: [require.resolve('@babel/preset-react', { paths: [path.join(__dirname, '..')] })], babelrc: false, configFile: false }).code;
const css = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon.jsx'), 'utf8').match(/^\.mhm-card\{.*$|^\.mhm-bar.*$/gm).join('\n');
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="../../../../monster-hero/tailwind.css">
<style>body{margin:0;background:#0b1220;font-family:system-ui,sans-serif}${css}
.mhl-btn{min-height:44px;border-radius:12px;font-size:12px;font-weight:900;color:#fff;background:linear-gradient(90deg,#f472b6,#fb923c)}
.cols{display:flex;gap:14px;padding:14px;align-items:flex-start}.col{width:360px}.cap{color:#fde68a;font:900 13px system-ui;margin:0 0 6px}</style>
<script src="../../../../monster-hero/vendor/react.production.min.js"></script>
<script src="../../../../monster-hero/vendor/react-dom.production.min.js"></script>
<script src="../../../../monster-hero/data/images/images-ally.js"></script>
<script src="../../../../monster-hero/data/ally-monsters.js"></script>
<script src="../../../../monster-hero/data/skills.js"></script>
<script src="../../../../monster-hero/data/assistant-masmon-techs.js"></script>
</head><body><div class="cols" id="app"></div><script>
var RELEASE_FLAGS = { assistantMasmonTrain: true };
var ASSISTANT_MASMON_STORE = { state: { seed: 'mock' } };
var assistantMasmonRowsOf = function () { return ROWS; };
var ROWS = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25 }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12 }];
${code}
var NOW = amgtSlotOf();
AMGT_STORE.loaded = true;
// 見本の中身: 40日ほど育てたようす(本物の受け口で回す)
(function () {
  var E = {}; ROWS.forEach(function (r) { E[r.slot] = { st: { life: 150, pow: r.monster === 'Golem' ? 260 : 90, wise: r.monster === 'Pixie' ? 200 : 110, hit: 160, eva: 120, tough: 120 }, fat: 0, str: 0, lv: r.lv }; });
  var KS = ['life','pow','wise','hit','eva','tough'];
  for (var s = NOW - 120; s < NOW; s++) { if (s % 2 === 0) AMGT_STORE.state = Object.assign({}, AMGT_STORE.state, { at: { kiki: (AMGT_STORE.state.at.kiki || []).concat([s]).slice(-12) } }); ROWS.forEach(function (r) {
    var e = E[r.slot]; var act = e.fat >= 60 ? { a: 'rest' } : (amgtChoose('kiki', e, r, null, s) || { a: 'light', k: 'pow' });
    if (act.a === 'shugyo') amgtDo('kiki', e, r, null, s, act, function (k, lo) { e.st[k] += lo; }, function (x) { return 0.05 + x; });
    else { e.fat = act.a === 'rest' ? Math.max(0, e.fat - 30) : e.fat + 5; if (act.a === 'light') e.st[KS[s % 6]] += 6; amgtAfterAct('kiki', act, false, s); }
  }); }
  window.E = E;
})();
var amgEntryOf = function (aid, t) { return E[t.slot]; };
var who = { id: 'kiki', name: 'きき' };
var h = React.createElement;
function Col(p) { return h('div', { className: 'col' }, h('p', { className: 'cap' }, p.cap), p.children); }
ReactDOM.render(h(React.Fragment, null,
  h(Col, { cap: '① ごろべえ(ゴーレム・Lv25)・助手からの相談' }, h(AmgtCard, { who: who, t: ROWS[0], e: E[1] })),
  h(Col, { cap: '② ぴく(ピクシー・Lv12)' }, h(AmgtCard, { who: who, t: ROWS[1], e: E[2] }))
), document.getElementById('app'));
</script></body></html>`;
fs.writeFileSync(path.join(out, 'mock.html'), html);
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 780, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(out, 'mock.html')); await p.waitForTimeout(500);
  // 相談の札が出ていない側があれば、相談の札が見える日まで送る
  const h2 = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 780, height: Math.max(400, h2) });
  await p.screenshot({ path: path.join(out, 'mock.jpg'), type: 'jpeg', quality: 85, fullPage: true });
  await b.close();
  console.log(errs.length ? `NG: ${errs.join(' / ')}` : 'OK: mock.jpg を書いた');
})();
