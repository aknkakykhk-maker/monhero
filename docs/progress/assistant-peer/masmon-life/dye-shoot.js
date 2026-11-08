// 案の止め絵: 助手のマスモンの染め方(今・案A・案B)を、ゲーム本体の染色の部品(DyedMonsterImage)で描いて並べる。
//   node docs/progress/assistant-peer/masmon-life/dye-shoot.js → masmon-life/dye/<助手>-<now|A|B>.png・<助手>-zoom-<now|A>.png
// 案のデータ: masmon-life/dye-plan.json。今の色: masmon-plan.json の先頭(当番の先頭)のマスモン
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..', '..', '..'), PORT = 9285;
const { MIME } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const out = path.join(__dirname, 'dye');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'masmon-plan.json'), 'utf8')).assistants;
const dye = JSON.parse(fs.readFileSync(path.join(__dirname, 'dye-plan.json'), 'utf8')).assistants;

(async () => {
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
  await p.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.goto(`http://localhost:${PORT}/monster-hero/index.html`);
  await p.waitForFunction(() => typeof DyedMonsterImage === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
  const jobs = [];
  for (const a of plan) {
    const lead = a.team.find(t => t.lead) || a.team[0];
    const d = dye[a.id];
    jobs.push({ key: `${a.id}-now`, id: lead.monster, colors: lead.dye.colors, px: 240 });
    jobs.push({ key: `${a.id}-A`, id: lead.monster, colors: d.A, px: 240 });
    jobs.push({ key: `${a.id}-B`, id: lead.monster, colors: d.B, px: 240 });
    jobs.push({ key: `${a.id}-orig`, id: lead.monster, colors: [], px: 240 });
  }
  // 原寸の拡大: ドラ(大胆)ときき(控えめ)の今と案A
  for (const id of ['dra', 'kiki']) {
    const a = plan.find(x => x.id === id), lead = a.team.find(t => t.lead) || a.team[0];
    jobs.push({ key: `${id}-zoom-now`, id: lead.monster, colors: lead.dye.colors, px: 560 });
    jobs.push({ key: `${id}-zoom-A`, id: lead.monster, colors: dye[id].A, px: 560 });
  }
  for (const j of jobs) {
    await p.evaluate(({ id, colors, px }) => {
      let host = document.getElementById('__dye');
      if (!host) { host = document.createElement('div'); host.id = '__dye'; document.body.appendChild(host); }
      host.style.cssText = `position:fixed;left:0;top:0;width:${px}px;height:${px}px;z-index:2147483647;background:radial-gradient(circle at 50% 40%,#94a3b8,#475569)`;
      for (const el of document.querySelectorAll('body > *')) if (el !== host) el.style.display = 'none';
      if (!window.__dyeRoot) window.__dyeRoot = ReactDOM.createRoot(host);
      const mon = ALL_PLAYER_MONSTERS[id];
      const n = (MASU_COLOR_REGION_HUES[id] || []).length;
      window.__dyeRoot.render(React.createElement(DyedMonsterImage, { key: id + JSON.stringify(colors) + px, baseId: id, src: mon.imgUrl, masuColors: (colors || []).slice(0, n || 5), alt: '', style: { width: `${px}px`, height: `${px}px`, objectFit: 'contain' } }));
    }, j);
    await p.waitForTimeout(j.colors && j.colors.some(Boolean) ? 5500 : 900);
    await p.locator('#__dye').screenshot({ path: path.join(out, `${j.key}.png`) });
  }
  await b.close(); server.close();
  console.log(`書き出しました: ${jobs.length}枚`);
})().catch(e => { console.error(e); process.exit(1); });
