// 顔アイコン・アイコンを全部、丸に入れて十字を引いて並べた一覧の画像を出す(社長・窓口が目で見る用。2026-10-26)。
//
//   node tools/image/art-anchor-sheet.js                 … tools/out/art-anchor-sheet.png に書く
//   node tools/image/art-anchor-sheet.js <書き出す先.png>
//
// 並べるもの(赤い十字が丸のまんなか。顔のまんなかが十字に重なっていれば良い)
//   ・モンスター・混血の顔アイコン(ART_ANCHORS の子は、基準の点を黄色い点で打つ。点が十字に重なる)
//   ・マーケット・プロフィールのアイコン(MARKET_PROFILE_ICON_STYLES の寄せをかけた、実際の見え方)
//   ・アシストカードのアイコン(ASSIST_CARD_ICON_STYLES の寄せをかけた、実際の見え方)
// 検査は tools/image/art-anchor-check.js(数で見る)。こちらは目で見る用
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { loadEmbeddedImages, imageFilePath, REPO_ROOT } = require('../harness');
const face = require('./make-face-icons');

const out = process.argv[2] || path.join(__dirname, '..', 'out', 'art-anchor-sheet.png');
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const market = read('monster-hero/src/parts/20-market-notices-help.jsx');
const breeder = read('monster-hero/data/breeder.js');
const dyeArt = read('monster-hero/src/parts/15-dye-and-art.jsx');

// 寄せの表({ scale, x, y })。KIKI_FACE_ICON_ADJUSTMENT のような名前の値もたどる
const named = Object.fromEntries([...dyeArt.matchAll(/const ([A-Z_]+_ADJUSTMENT) = Object\.freeze\((\{[^}]*\})\)/g)].map((m) => [m[1], Function(`return ${m[2]}`)()]));
const tableOf = (block) => Object.fromEntries([...block.matchAll(/^\s+([A-Za-z_]+):\s*(\{[^}]*\}|[A-Z_]+_ADJUSTMENT)/gm)].map((m) => [m[1], m[2].startsWith('{') ? Function(`return ${m[2]}`)() : named[m[2]]]));
const marketStyles = tableOf((market.match(/const MARKET_PROFILE_ICON_STYLES = \{([\s\S]*?)\n\};/) || [])[1] || '');
const assistStyles = tableOf((dyeArt.match(/const ASSIST_CARD_ICON_STYLES = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '');

(async () => {
  const images = loadEmbeddedImages();
  const anchors = face.loadArtAnchors();
  const sections = [];
  // 1) 顔アイコン
  const faces = Object.keys(images).filter((k) => k.endsWith('_FACE_ICON') && /monster-icons\/face\//.test(images[k])).map((k) => ({ label: k.replace(/_FACE_ICON$/, ''), src: images[k], style: null, dot: anchors[k.replace(/_FACE_ICON$/, '')] ? [0.5, 0.5] : null }));
  sections.push(['モンスター・混血の顔アイコン(黄色い点 = 基準の顔のまんなか)', faces]);
  // 2) マーケット・プロフィールのアイコン(type:'icon' の商品)
  const iconItems = [...breeder.matchAll(/\{ id:'([a-z_0-9]+)',\s*name:"([^"]+)",\s*type:'icon',\s*icon:([A-Z0-9_]+)/g)].map((m) => ({ label: m[2].replace(/のアイコン$/, ''), src: images[m[3]], style: marketStyles[m[1]] || null }));
  sections.push(['マーケット・プロフィールのアイコン(寄せをかけた見え方)', iconItems.filter((x) => x.src)]);
  // 3) アシストカード(type:'assist' の商品)
  const assists = [...breeder.matchAll(/\{ id:'([a-z_0-9]+)',\s*name:"アシストカード「([^」]+)」",\s*type:'assist',\s*icon:([A-Z0-9_]+)/g)].map((m) => ({ label: m[2], src: images[m[3]], style: assistStyles[m[1]] || null }));
  sections.push(['アシストカードのアイコン(寄せをかけた見え方)', assists.filter((x) => x.src)]);

  const R = 40, cell = 2 * R + 16, cols = 12, W = cols * cell + 20;
  const heights = sections.map(([, list]) => 30 + Math.ceil(list.length / cols) * (cell + 14));
  const c = createCanvas(W, heights.reduce((a, b) => a + b, 10)), g = c.getContext('2d');
  g.fillStyle = '#1e1b2e'; g.fillRect(0, 0, c.width, c.height);
  let y0 = 10;
  for (const [si, [title, list]] of sections.entries()) {
    g.fillStyle = '#fbbf24'; g.font = 'bold 16px sans-serif'; g.textAlign = 'left'; g.fillText(title, 10, y0 + 18);
    for (let i = 0; i < list.length; i++) {
      const it = list[i]; const x = 10 + (i % cols) * cell, y = y0 + 30 + Math.floor(i / cols) * (cell + 14);
      let img; try { img = await loadImage(imageFilePath(it.src)); } catch { continue; }
      const cx = x + R, cy = y + R;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip();
      // 画面と同じ: object-contain で置いてから translate(x%, y%) scale(s)
      const s0 = Math.min(2 * R / img.width, 2 * R / img.height); const st = it.style || { scale: 1, x: 0, y: 0 };
      g.translate(cx + (st.x || 0) / 100 * 2 * R, cy + (st.y || 0) / 100 * 2 * R); g.scale(st.scale || 1, st.scale || 1);
      g.drawImage(img, -img.width * s0 / 2, -img.height * s0 / 2, img.width * s0, img.height * s0);
      g.restore();
      g.strokeStyle = '#f43f5ecc'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke();
      if (it.dot) { g.fillStyle = '#facc15'; g.beginPath(); g.arc(x + it.dot[0] * 2 * R, y + it.dot[1] * 2 * R, 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = it.style ? '#fda4af' : '#e2e8f0'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(String(it.label).slice(0, 12), cx, y + 2 * R + 11);
    }
    y0 += heights[si];
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, c.toBuffer('image/png'));
  console.log(`書き出しました: ${path.relative(process.cwd(), out)}(${sections.map(([t, l]) => `${l.length}`).join('・')}件。桃色の名前は寄せをかけている物)`);
})().catch((e) => { console.error(e); process.exit(1); });
