// 引き直し+染め方 v2 の止め絵: ゲーム本体の関数(assistantMasmonDrawFor・assistantMasmonDyeEnsure)と染色の部品(DyedMonsterImage)で描く。
//   node docs/progress/assistant-peer/masmon-life/dye2-shoot.js [seed]
//   → dye2/sheet.png(8人×5体を 元の色・今の型・作り込んだ設定 で並べた1枚)/ players.png(同じ助手・3人のプレイヤー)/ season.png(冬の染め直し)/ zoom-*.png(原寸の拡大)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..', '..', '..'), PORT = 9293;
const { MIME } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const out = path.join(__dirname, 'dye2');
const SEED = process.argv[2] || 'player-sample-a1';
(async () => {
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => { const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')); if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res); });
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1000 }, deviceScaleFactor: 1 });
  await p.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.goto(`http://localhost:${PORT}/monster-hero/index.html`);
  await p.waitForFunction(() => typeof DyedMonsterImage === 'function' && typeof assistantMasmonDyeEnsure === 'function', null, { timeout: 90000 });
  const render = async (name, spec, width) => {
    await p.setViewportSize({ width, height: 1000 });
    await p.evaluate((spec) => {
      const h = React.createElement;
      let host = document.getElementById('__sheet');
      if (!host) { host = document.createElement('div'); host.id = '__sheet'; document.body.appendChild(host); }
      for (const el of document.querySelectorAll('body > *')) if (el !== host) el.style.display = 'none';
      document.body.style.overflow = 'visible'; document.documentElement.style.overflow = 'visible';
      host.style.cssText = 'position:absolute;left:0;top:0;z-index:2147483647;background:#0f172a;color:#e2e8f0;font-family:sans-serif;padding:14px';
      const who = (id) => (typeof ASSISTANT_PEERS !== 'undefined' && ASSISTANT_PEERS.find ? (ASSISTANT_PEERS.find(a => a.id === id) || {}).name : '') || ({ mua: 'みゅあ', kiki: 'きき', momosuke: 'ももすけ', dra: 'ドラ', atsu: 'あつ', kyuko: 'きゅうこ', sorashido: 'ソラシド', erubin: 'えるびん' })[id] || id;
      const pic = (mid, colors, px) => h('div', { style: { width: px, height: px, borderRadius: 8, background: 'radial-gradient(circle at 50% 40%,#94a3b8,#475569)', overflow: 'hidden' } },
        h(DyedMonsterImage, { baseId: mid, src: ALL_PLAYER_MONSTERS[mid].imgUrl, masuColors: (colors || []).slice(0, (MASU_COLOR_REGION_HUES[mid] || []).length || 5), alt: '', style: { width: px, height: px, objectFit: 'contain' } }));
      const chip = (cs, mid) => h('div', { style: { fontSize: 10, color: '#94a3b8', lineHeight: 1.35 } }, (cs || []).map((c, i) => h('div', { key: i }, `${assistantMasmonPartRule(mid, i).name}: ${c ? assistantMasmonToneName(c) + (String(c).includes('@') ? ' ' + String(c).split('@')[1] + '%' : '') : '元'}`)));
      const rows = [];
      const drawState = (aid, seed, at) => { const made = assistantMasmonDrawFor(aid, seed); const w = {}; for (const t of made) w[t.monster] = at; return { seed, draw: { v: 2, at, made: { [aid]: made }, welcomed: { [aid]: w }, named: false, fav: { [aid]: assistantMasmonFavSig(assistantMasmonBasePlanOf(aid)) } }, dyes: {} }; };
      if (spec.kind === 'sheet' || spec.kind === 'players') {
        const seeds = spec.kind === 'players' ? spec.seeds : [spec.seed];
        for (const aid of spec.aids) for (const seed of seeds) {
          const made = drawState(aid, seed, spec.day).draw.made[aid];
          const H = ASSISTANT_MASMON_DYE_HABIT[aid];
          const big = spec.kind === 'players' ? 104 : 96;
          rows.push(h('div', { key: aid + seed, style: { display: 'flex', gap: 8, alignItems: 'flex-start', borderTop: '1px solid #334155', padding: '8px 0' } },
            h('div', { style: { width: 140, flexShrink: 0 } }, h('div', { style: { fontSize: 22, fontWeight: 900 } }, who(aid)), spec.kind === 'players' ? h('div', { style: { fontSize: 11, color: '#fbbf24' } }, `プレイヤー ${seeds.indexOf(seed) + 1}`) : null, h('div', { style: { fontSize: 11, color: '#cbd5e1', marginTop: 4 } }, H.say), H.ref && spec.kind !== 'players' ? h('div', { style: { fontSize: 10, color: '#86efac', marginTop: 4 } }, '参考: ' + H.ref) : null),
            ...made.map(t => h('div', { key: t.slot, style: { width: spec.kind === 'players' ? 108 : 204 } },
              h('div', { style: { fontSize: 11, fontWeight: 800, color: '#fde68a', whiteSpace: 'nowrap', overflow: 'hidden' } }, `${t.slot}. ${t.nick}`, h('span', { style: { color: '#94a3b8', fontWeight: 600 } }, ` Lv${t.welcome}〜`)),
              h('div', { style: { fontSize: 10, color: '#7dd3fc' } }, (t.slot === 1 ? '勇者モン・' : '') + (ASSISTANT_MASMON_ROLE_NAME[t.role] || '')),
              h('div', { style: { display: 'flex', gap: 4, marginTop: 3, alignItems: 'flex-end' } }, spec.kind === 'players' ? null : pic(t.monster, [], 72), pic(t.monster, t.colors, big)),
              spec.kind === 'players' ? null : chip(t.colors, t.monster)))));
        }
        const head = spec.kind === 'players' ? '同じ助手でも、プレイヤーごとに顔ぶれ・並び・染め方が変わる(引き直しのあと)' : '引き直しのあとの8体(左の小さい絵=元の色・右=助手の染め方)。黄色い字=名前と迎える仲良し度・青い字=染め方';
        window.__sr = window.__sr || ReactDOM.createRoot(host);
        window.__sr.render(h('div', null, h('div', { style: { fontSize: 15, fontWeight: 800, marginBottom: 6 } }, head), ...rows));
      } else if (spec.kind === 'season') {
        for (const aid of spec.aids) {
          let st = drawState(aid, spec.seed, '2026-11-08');
          const made = st.draw.made[aid];
          const cells = [];
          for (const day of ['2026-12-20', '2027-03-20', '2027-07-20']) {
            const s2 = assistantMasmonDyeEnsure(st, day); const e = s2.dyes[aid][s2.dyes[aid].length - 1]; const slot = Number(Object.keys(e.slots)[0]);
            const t = made.find(x => x.slot === slot);
            const prev = assistantMasmonDyeNowOf(st, aid, slot, t.colors);
            cells.push(h('div', { key: day, style: { width: 300 } }, h('div', { style: { fontSize: 12, fontWeight: 800, color: '#fde68a' } }, `${day.slice(0, 7)} ${ASSISTANT_MASMON_SEASON_NAME[e.season.split('-')[1]]}: ${t.nick}`),
              h('div', { style: { display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' } }, pic(t.monster, prev, 120), h('span', { style: { fontSize: 20 } }, '→'), pic(t.monster, e.slots[slot], 120))));
            st = s2;
          }
          rows.push(h('div', { key: aid, style: { display: 'flex', gap: 14, borderTop: '1px solid #334155', padding: '8px 0' } }, h('div', { style: { width: 110, fontSize: 22, fontWeight: 900 } }, who(aid)), ...cells));
        }
        window.__sr = window.__sr || ReactDOM.createRoot(host);
        window.__sr.render(h('div', null, h('div', { style: { fontSize: 15, fontWeight: 800, marginBottom: 6 } }, '季節が変わると1体だけ季節の色を差す(左=前の色・右=染め直し。前の色は記録に残る)'), ...rows));
      } else if (spec.kind === 'zoom') {
        const t = drawState(spec.aid, spec.seed, spec.day).draw.made[spec.aid][spec.i];
        window.__sr = window.__sr || ReactDOM.createRoot(host);
        window.__sr.render(h('div', null, h('div', { style: { fontSize: 16, fontWeight: 800, marginBottom: 6 } }, `${who(spec.aid)}の ${t.nick}(${ASSISTANT_MASMON_ROLE_NAME[t.role]}) 左=元の色 / 右=助手の染め方`),
          h('div', { style: { display: 'flex', gap: 8 } }, pic(t.monster, [], 420), pic(t.monster, t.colors, 420)), chip(t.colors, t.monster)));
      }
    }, spec);
    await p.waitForTimeout(spec.wait || 25000);
    await p.locator('#__sheet').screenshot({ path: path.join(out, name) });
    console.log('撮影', name);
  };
  const AIDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
  const day = '2026-11-08';
  const only = process.env.DYE2_ONLY || '';
  if (!only || only === 'sheet') { await render('sheet-1.png', { kind: 'sheet', seed: SEED, aids: AIDS.slice(0, 4), day, wait: 45000 }, 1830); await render('sheet-2.png', { kind: 'sheet', seed: SEED, aids: AIDS.slice(4), day, wait: 45000 }, 1830); }
  if (!only || only === 'players') await render('players.png', { kind: 'players', seeds: [SEED, 'player-sample-b2', 'player-sample-c3'], aids: ['mua', 'dra', 'atsu'], day, wait: 45000 }, 1060);
  if (!only || only === 'season') await render('season.png', { kind: 'season', seed: SEED, aids: ['mua', 'kyuko', 'atsu'], wait: 30000 }, 1100);
  if (!only || only === 'zoom') for (const [aid, i] of [['dra', 1], ['atsu', 0], ['momosuke', 0], ['kyuko', 2]]) await render(`zoom-${aid}-${i + 1}.png`, { kind: 'zoom', seed: SEED, aid, i, day, wait: 12000 }, 1300);
  await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
