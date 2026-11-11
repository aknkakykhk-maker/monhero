// バトル画面(タクティクスプロ)をオートで流し、描き直された部品の数を出す計測道具。INIT_JS=tools/battle/render-count-hook.js を付けて動かす。
const { openTacticsBattle } = require('./lib/tactics-battle-page');
(async () => {
  const run = await openTacticsBattle({ root: '/home/user/monhero', port: 8991, storage: { mh_battle_fx_v1: { load: 'RICH', autoLoad: 'OFF' } } });
  const { page } = run; if (!run.inBattle) { console.log('入れず'); await run.close(); return; }
  await page.waitForTimeout(1500);
  const q = () => page.evaluate(() => (document.body.innerText.match(/TURN\s*(\d+)/)||[])[1]);
  await page.evaluate(() => { window.__rc.on = true; window.__rc.commits = 0; window.__rc.battle = 0; window.__rc.names = {}; });
  const auto = await page.evaluate(() => { const a = document.querySelector('button[aria-label^="AUTO"]') || [...document.querySelectorAll('button')].find(x=>/AUTO/.test(x.textContent)&&/OFF/.test(x.textContent)); if (a) a.click(); return !!a; });
  const t0 = await q(); const SEC = Number(process.env.SECONDS||40);
  await page.waitForTimeout(SEC*1000);
  const t1 = await q();
  const r = await page.evaluate(() => window.__rc);
  const turns = Number(t1)-Number(t0);
  console.log(JSON.stringify({ auto, SEC, t0, t1, turns, commits: r.commits, battle: r.battle, perTurnCommits: +(r.commits/turns).toFixed(1), perTurnBattle: +(r.battle/turns).toFixed(1) }));
  console.log(Object.entries(r.names).sort((a,b)=>b[1]-a[1]).slice(0,18).map(([k,v])=>`${k}:${v}`).join(' '));
  await run.close();
})();
