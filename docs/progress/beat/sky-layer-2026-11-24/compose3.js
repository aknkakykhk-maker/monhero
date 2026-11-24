#!/usr/bin/env node
// r1119-165 3回目: 今・案G・案H の全体と、地上の HOLD が空中の判定線を通る所の拡大を並べる(資料用)
//   node docs/progress/beat/sky-layer-2026-11-24/compose3.js   → compare3-{yoko,tate,rot}[-max].jpg
//   node docs/progress/beat/sky-layer-2026-11-24/compose3.js I,J → compare4-…(4回目: 今・案I・案J)
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const SET = (process.argv[2] || 'G,H').split(','), OUTP = SET[0] === 'G' ? 'compare3' : 'compare4';
const LABEL = { I: '案I 空中の見た目は今のまま・描く順だけ(空中を地上の手前に)', J: '案J 案I + 重なる所の地上を1割5分だけ暗く', now: '今', G: '案G 面3分の1・地上3割暗く・判定線とふちを地上の上へ', H: '案H 面5分の1・地上2割暗く・判定線とふちを地上の上へ' };
const FILE = (k, s) => path.join(__dirname, `${k === 'now' ? 'now3' : 'an-' + k}-${s}.jpg`);
// 拡大する所(撮った絵の px・2倍の大きさ): 地上の HOLD が空中の判定線を通る所
const CROP = { yoko: [450, 160, 600, 300], tate: [100, 880, 400, 400], rot: [280, 440, 400, 400] };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  for (const s of ['yoko', 'tate', 'rot', 'yoko-max', 'tate-max', 'rot-max']) {
    const base = s.replace('-max', ''), [cx, cy, cw, ch] = CROP[base], fw = base === 'yoko' ? 560 : 300, zw = 440;
    const cells = ['now', ...SET].map(k => { const src = `data:image/jpeg;base64,${fs.readFileSync(FILE(k, s)).toString('base64')}`;
      return `<figure><figcaption>${LABEL[k]}</figcaption><img class="full" src="${src}">
        <div class="zoom" style="width:${zw}px;height:${zw * ch / cw}px"><img src="${src}" style="position:absolute;left:${-cx * zw / cw}px;top:${-cy * zw / cw}px;width:${(base === 'yoko' ? 1688 : 780) * zw / cw}px"></div><p>拡大(空中の判定線を地上の HOLD が通る所)</p></figure>`; }).join('');
    await page.setContent(`<style>body{margin:0;background:#0b0820;font:bold 16px sans-serif;color:#f5f3ff}main{display:grid;grid-template-columns:repeat(3,${Math.max(fw, zw)}px);gap:16px;padding:14px;width:max-content}figure{margin:0}figcaption{padding:4px 2px 8px;line-height:1.3;min-height:42px}.full{width:${fw}px;display:block;border:1px solid #4c1d95}.zoom{position:relative;overflow:hidden;margin-top:10px;border:2px solid #f0abfc}p{margin:4px 0 0;font-size:13px;color:#c4b5fd}h1{font-size:18px;margin:14px 14px 0}</style><h1>Rebellion HELL 3:44.4 ${s.endsWith('-max') ? '演出量「最大」(全部のせ)' : '初期設定(演出量「標準」)'}・${{ yoko: '横', tate: '縦', rot: '🔄横' }[base]}</h1><main>${cells}</main>`);
    await page.screenshot({ path: path.join(__dirname, `${OUTP}-${s}.jpg`), type: 'jpeg', quality: 82, fullPage: true });
    console.log(`${OUTP}-${s}.jpg`);
  }
  await browser.close();
})();
