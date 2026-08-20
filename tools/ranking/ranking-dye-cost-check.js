const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ランキングの編成に「実際に入れたマスモンの色」を出す場合の重さを実測する。
//
// 見積もりで話しても仕方がないので、game-system.jsx の染色処理をそのまま切り出して
// 実際のブラウザで動かし、スコアランキング1画面ぶん(50件 × 最大4体 = 200体)を
// 描いたときに何ミリ秒かかるかを測る。
//
//   ① マスク生成(モンスターの種類ごとに1回・グローバルにキャッシュされる)
//   ② 再着色(絵と色の組み合わせごとに1回・同じくキャッシュされる)
//   ③ 200体ぶんのDOMを組み立てて描くまで
//
// ①②はキャッシュが効くので「種類の数」ぶんしかかからない。効いているかどうかも
// 2回目の計測で確かめる。
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(TOOLS_DIR, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('monster-hero/src/game-system.jsx');

// game-system.jsx から染色に必要な部分だけを切り出す(先頭の定義から DyedMonsterImage の直前まで)
const from = source.indexOf('const MASU_COLOR_TARGET = {');
const to = source.indexOf('const DyedMonsterImage =');
if (from < 0 || to < 0) { console.log('NG: 染色処理を切り出せませんでした'); process.exit(1); }
const dyeSource = source.slice(from, to);

// 何体・どれだけの種類を想定するか(スコアランキングは50件、1件あたり勇者1体＋供モン3体)。
// 「全員を染める」と「勇者モンだけ染める」を別々に測って比べる
const ROWS = 50;
const CASES = [
  { label: '全員を染める(勇者＋供モン)', total: ROWS * 4 },
  { label: '勇者モンだけ染める', total: ROWS },
];

const page = `<!doctype html><meta charset="utf-8">
<!-- 画像はPNGファイルになったので、monster-hero/ を基準にパスを解決させる -->
<base href="/monster-hero/"><body style="margin:0;background:#020617">
<div id="list"></div>
<script src="/monster-hero/data/images/images-ally.js"></script>
<script src="/monster-hero/data/ally-monsters.js"></script>
<script>
${dyeSource}
const COLORS = Object.keys(MASU_COLOR_SWATCH);
const MONS = Object.keys(ALL_PLAYER_MONSTERS).filter(id => (MASU_COLOR_REGION_HUES[id]||[]).length > 0);
// いまの一覧の1行(順位・ブリーダーアイコン・名前・スコア・詳細ボタン)をN件並べて測る。
// 使っていたモンスターの絵は詳細へ移したので、一覧に残る絵はブリーダーアイコンだけ
window.__runRows = async (ROWS) => {
  const icons = MONS.slice(0, 8).map(id => ALL_PLAYER_MONSTERS[id].faceIconUrl || ALL_PLAYER_MONSTERS[id].iconUrl);
  const list = document.getElementById('list');
  list.innerHTML = '';
  const t = performance.now();
  const frag = document.createDocumentFragment();
  let nodes = 0;
  for (let i = 0; i < ROWS; i++) {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid #ffffff11;border-radius:12px;padding:6px 8px;margin-bottom:6px';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px';
    const rank = document.createElement('div');
    rank.textContent = String(i + 1);
    rank.style.cssText = 'width:28px;height:28px;border-radius:999px;background:#1e293b;color:#94a3b8;font-size:9px;display:flex;align-items:center;justify-content:center';
    head.appendChild(rank); nodes++;
    const icon = document.createElement('img');
    icon.src = icons[i % icons.length];
    icon.style.cssText = 'width:32px;height:32px;border-radius:999px;object-fit:cover';
    head.appendChild(icon); nodes++;
    const name = document.createElement('span');
    name.textContent = 'あつまろう  ブリーダーLv.34';
    name.style.cssText = 'flex:1;font-size:10px;color:#fff';
    head.appendChild(name); nodes++;
    const score = document.createElement('span');
    score.textContent = '928,996 pt';
    score.style.cssText = 'font-size:10px;color:#a5b4fc';
    head.appendChild(score); nodes++;
    card.appendChild(head);
    const btn = document.createElement('div');
    btn.textContent = 'パーティー詳細 >';
    btn.style.cssText = 'margin-top:4px;border:1px solid #818cf866;border-radius:8px;padding:4px;text-align:center;font-size:9px;color:#c7d2fe';
    card.appendChild(btn); nodes++;
    frag.appendChild(card);
  }
  list.appendChild(frag);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { ms: Math.round(performance.now() - t), nodes };
};
// 一覧の現状(素のアイコンを並べる)と、アイコンを外した場合を測る
window.__runPlain = async (TOTAL, withIcons) => {
  const kinds = MONS.slice(0, 12);
  const list = document.getElementById('list');
  list.innerHTML = '';
  const t = performance.now();
  const frag = document.createDocumentFragment();
  let nodes = 0;
  for (let i = 0; i < TOTAL; i++) {
    const baseId = kinds[i % kinds.length];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;height:18px';
    if (withIcons) {
      const img = document.createElement('img');
      img.src = ALL_PLAYER_MONSTERS[baseId].iconUrl;
      img.style.cssText = 'width:18px;height:18px;object-fit:contain';
      row.appendChild(img); nodes++;
    }
    const label = document.createElement('span');
    label.textContent = ALL_PLAYER_MONSTERS[baseId].name + ' Lv.10';
    label.style.cssText = 'font-size:8px;color:#cbd5e1';
    row.appendChild(label); nodes++;
    frag.appendChild(row);
  }
  list.appendChild(frag);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { ms: Math.round(performance.now() - t), nodes };
};
window.__run = async (TOTAL) => {
  const out = { monsters: MONS.length, total: TOTAL };
  // ランキング1画面ぶんの顔ぶれを作る。上位は同じ強いモンスターが並びやすいので
  // 種類は絞りめ(最大12種)、色はばらけさせる
  const kinds = MONS.slice(0, 12);
  const members = [];
  for (let i = 0; i < TOTAL; i++) {
    const baseId = kinds[i % kinds.length];
    const regions = MASU_COLOR_REGION_HUES[baseId].length;
    const colors = Array.from({length: regions}, (_, r) => COLORS[(i * 3 + r * 7) % COLORS.length]);
    members.push({ baseId, src: ALL_PLAYER_MONSTERS[baseId].iconUrl, colors });
  }
  out.kinds = kinds.length;
  out.combos = new Set(members.flatMap(m => m.colors.map(c => m.src + '::' + c))).size;

  // ① マスク生成(種類ぶん)
  let t = performance.now();
  const maskMap = {};
  await Promise.all(kinds.map(async id => {
    maskMap[id] = await Promise.resolve(getDyeRegionMasks(id, ALL_PLAYER_MONSTERS[id].iconUrl));
  }));
  out.maskMs = Math.round(performance.now() - t);

  // ② 再着色(絵と色の組み合わせぶん)
  t = performance.now();
  const recolorMap = {};
  await Promise.all([...new Set(members.flatMap(m => m.colors.map(c => m.src + '\\u0000' + c + '\\u0000' + m.baseId)))]
    .map(async key => {
      const [src, color, baseId] = key.split('\\u0000');
      recolorMap[src + '::' + color] = await Promise.resolve(getRecoloredImage(src, color, baseId));
    }));
  out.recolorMs = Math.round(performance.now() - t);

  // ③ 200体ぶんのDOMを組んで描くまで
  t = performance.now();
  const list = document.getElementById('list');
  const frag = document.createDocumentFragment();
  let nodes = 0;
  members.forEach(m => {
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;overflow:hidden;width:20px;height:20px;display:inline-block';
    const base = document.createElement('img');
    base.src = m.src; base.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
    box.appendChild(base); nodes++;
    const masks = maskMap[m.baseId] || [];
    m.colors.forEach((c, idx) => {
      const rec = recolorMap[m.src + '::' + c];
      if (!rec || !masks[idx]) return;
      const layer = document.createElement('img');
      layer.src = rec;
      layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;' +
        '-webkit-mask-image:url(' + masks[idx] + ');mask-image:url(' + masks[idx] + ');' +
        '-webkit-mask-size:100% 100%;mask-size:100% 100%';
      box.appendChild(layer); nodes++;
    });
    frag.appendChild(box);
  });
  list.appendChild(frag);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  out.renderMs = Math.round(performance.now() - t);
  out.nodes = nodes;

  // キャッシュが効いているか(2回目)
  t = performance.now();
  await Promise.all(kinds.map(id => Promise.resolve(getDyeRegionMasks(id, ALL_PLAYER_MONSTERS[id].iconUrl))));
  await Promise.all([...new Set(members.flatMap(m => m.colors.map(c => m.src + '\\u0000' + c + '\\u0000' + m.baseId)))]
    .map(key => { const [src, color, baseId] = key.split('\\u0000'); return Promise.resolve(getRecoloredImage(src, color, baseId)); }));
  out.cachedMs = Math.round(performance.now() - t);
  return out;
};
</script></body>`;

const MIME = { '.js':'text/javascript', '.html':'text/html' };
const server = http.createServer((req, res) => {
  if (req.url === '/harness.html') { res.writeHead(200, {'Content-Type':'text/html'}); res.end(page); return; }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(0); }
  await new Promise(r => server.listen(8978, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const c of CASES) {
      // 毎回まっさらなページで測る(キャッシュを持ち越さない＝はじめて他人の色を見る状態)
      const page_ = await browser.newPage();
      const errs = [];
      page_.on('pageerror', e => errs.push(String(e)));
      await page_.goto('http://localhost:8978/harness.html', { waitUntil: 'load' });
      const r = await page_.evaluate((n) => window.__run(n), c.total);
      if (errs.length) console.log(`NG: 実行時エラー — ${errs[0]}`);
      const first = r.maskMs + r.recolorMs + r.renderMs;
      console.log(`【${c.label}】`);
      console.log(`  ${r.total}体 / 顔ぶれ${r.kinds}種 / 絵と色の組み合わせ${r.combos}通り / DOM要素${r.nodes}個`);
      console.log(`  ① マスク生成   ${String(r.maskMs).padStart(5)} ms`);
      console.log(`  ② 再着色       ${String(r.recolorMs).padStart(5)} ms`);
      console.log(`  ③ 組み立て・描画 ${String(r.renderMs).padStart(3)} ms`);
      console.log(`  初回合計       ${String(first).padStart(5)} ms   /   2回目 ${r.cachedMs} ms`);
      console.log('');
      await page_.close();
    }
    // 一覧から使用モンスターの絵を外すとどれだけ軽くなるか
    {
      const page_ = await browser.newPage();
      await page_.goto('http://localhost:8978/harness.html', { waitUntil: 'load' });
      const withIcons = await page_.evaluate(() => window.__runPlain(200, true));
      const noIcons = await page_.evaluate(() => window.__runPlain(200, false));
      console.log('【一覧(染色なし・いまの見た目)】');
      console.log(`  素のアイコンを200個並べる : ${withIcons.ms} ms (DOM ${withIcons.nodes}個)`);
      console.log(`  アイコンを外して文字だけ  : ${noIcons.ms} ms (DOM ${noIcons.nodes}個)`);
      console.log(`  → 外したときの差         : ${withIcons.ms - noIcons.ms} ms`);
      console.log('');
      await page_.close();
    }
    // いまの一覧を20件と50件で比べる
    {
      const page_ = await browser.newPage();
      await page_.goto('http://localhost:8978/harness.html', { waitUntil: 'load' });
      console.log('【いまの一覧(使用モンスターは詳細へ移したあと)】');
      for (const rows of [20, 50]) {
        const r = await page_.evaluate((n) => window.__runRows(n), rows);
        console.log(`  ${String(rows).padStart(2)}件を並べる : ${String(r.ms).padStart(3)} ms (DOM ${r.nodes}個)`);
      }
      console.log('');
      await page_.close();
    }
    console.log('※ この端末はPC。スマホでは数倍かかる前提で見ること');
    await browser.close(); server.close();
  } catch (e) {
    console.log(`NG: 計測できませんでした — ${e.message}`);
    await browser.close(); server.close(); process.exit(1);
  }
})();
