// 助手のマスモンの染めた絵を、ゲーム本体の染色の部品(DyedMonsterImage・15-dye-and-art.jsx)で作って PNG に書き出す(見本用)。
// プレイヤーの染色と同じ仕組み・同じ枠数で染まる。2026-11-08 助手部キズナ
//   (別の窓で) python3 -m http.server 9291   ← リポジトリの一番上で
//   node docs/progress/assistant-peer/ux/masmon-dye-shots.js   → ux/dyed/<助手>-<モンスター>.png・<モンスター>-base.png
'use strict';
const fs = require('fs'), path = require('path');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'masmon-plan.json'), 'utf8')).assistants;
const out = path.join(__dirname, 'dyed');
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
  await p.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.goto(`http://localhost:${process.env.PORT || 9291}/monster-hero/index.html`);
  await p.waitForFunction(() => typeof DyedMonsterImage === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 60000 });
  const jobs = [];
  for (const a of plan) for (const m of a.team) jobs.push({ key: `${a.id}-${m.monster}`, id: m.monster, colors: m.dye.colors });
  for (const id of [...new Set(jobs.map(j => j.id))]) jobs.push({ key: `${id}-base`, id, colors: [] });
  for (const j of jobs) {
    await p.evaluate(({ id, colors }) => {
      let host = document.getElementById('__dye');
      if (!host) { host = document.createElement('div'); host.id = '__dye'; host.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:360px;z-index:2147483647;background:transparent'; document.body.appendChild(host); }
      // 後ろのゲームの画面は隠し、地を透明にする(絵だけを撮る)
      for (const el of document.querySelectorAll('body > *')) if (el !== host) el.style.display = 'none';
      document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
      if (!window.__dyeRoot) window.__dyeRoot = ReactDOM.createRoot(host);
      const mon = ALL_PLAYER_MONSTERS[id];
      window.__dyeRoot.render(React.createElement(DyedMonsterImage, { key: id + colors.join('|'), baseId: id, src: mon.imgUrl, masuColors: colors, alt: '', style: { width: '360px', height: '360px', objectFit: 'contain' } }));
    }, j);
    await p.waitForTimeout(j.colors.length ? 2500 : 600); // 染め絵を作って1枚に焼くのを待つ
    await p.locator('#__dye').screenshot({ path: path.join(out, `${j.key}.png`), omitBackground: true });
  }
  await b.close();
  console.log(`書き出しました: ${jobs.length}枚`);
})().catch(e => { console.error(e); process.exit(1); });
