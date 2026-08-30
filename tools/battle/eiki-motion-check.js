// エイキの攻撃モーション(桜の花びら)を、実際のブラウザで測って確かめる。
//
//   node tools/battle/eiki-motion-check.js
//
// 花びらは「攻撃したときだけ出す」約束で入れたので、次の3つを実測する。
//   ① 12枚のCSS花びらが斬撃方向へ流れて散るか(transform が時間で変わるか)
//   ② 高速斬撃のあとに短い余韻を残して終わるか(常時アニメーションになっていないか)
//   ③ 動きを減らす設定の端末では、流さず淡く出て消えるだけになっているか
// あわせて、実戦の小さい全身枠でも花びらが枠外へ流れて見えるかを見る。
//
// 花びらのCSSは自前のスタイル(Tailwindを使っていない)ので、CSSだけを取り出して
// 同じ形のDOMへ当てれば、Tailwindが読めないこのサンドボックスでも本物と同じ動きを測れる。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// createAnimationStyle の中から、桜に関する部分だけを取り出す。
// 「.eiki-sakura {」から「@keyframes zanComboDash」の直前まで(reduced-motion の塊まで含む)
const cssStart = source.indexOf('    .eiki-sakura {');
const cssEnd = source.indexOf('    @keyframes zanComboDash {', cssStart);
if (cssStart < 0 || cssEnd < 0) { console.error('NG: 桜のCSSを切り出せません'); process.exit(1); }
const css = source.slice(cssStart, cssEnd);
check('桜のCSSを本体から取り出せる', css.includes('eikiSakuraFall') && css.includes('eikiSakuraFade'));

// 実装の花びら定義(EIKI_SAKURA_PETALS)をそのまま読む。検査側へ書き写すと本体を変えたとき古くなる
const petalsStart = source.indexOf('const EIKI_SAKURA_PETALS = Object.freeze([');
const petalsEnd = source.indexOf(']);', petalsStart);
if (petalsStart < 0 || petalsEnd < 0) { console.error('NG: 花びらの定義を切り出せません'); process.exit(1); }
// eslint-disable-next-line no-new-func
const petals = new Function(`return ${source.slice(petalsStart + 'const EIKI_SAKURA_PETALS = Object.freeze('.length, petalsEnd + 1)};`)();
check('花びらは10〜12枚に固定されている', petals.length >= 10 && petals.length <= 12, `${petals.length}枚`);

// EikiSakuraPetals と同じDOM。枠は実戦で描く全身画像と同じ64x64に置く。
const petalHtml = petals.map(p =>
  `<span class="eiki-sakura__petal" style="left:${p.left};top:${p.top};width:${p.size};height:${parseFloat(p.size)*1.45}px;animation-delay:${p.delay};`
  + `--eiki-petal-flow-x:${p.flowX};--eiki-petal-flow-y:${p.flowY};--eiki-petal-burst-x:${p.burstX};--eiki-petal-burst-y:${p.burstY};`
  + `--eiki-petal-trail-x:${p.trailX};--eiki-petal-trail-y:${p.trailY};--eiki-petal-spin-mid:${parseFloat(p.spin)*.55}deg;`
  + `--eiki-petal-spin-burst:${parseFloat(p.spin)*.8}deg;--eiki-petal-spin:${p.spin}"></span>`).join('');
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
html,body{margin:0;background:#111}
.stage{position:relative;width:64px;height:64px;margin:140px;background:#222;overflow:visible}
${css}
</style></head><body>
<div class="stage"><span class="eiki-sakura" aria-hidden="true">${petalHtml}</span></div>
</body></html>`;

const sample = async (page) => page.evaluate(() => {
  const list = [...document.querySelectorAll('.eiki-sakura__petal')];
  return list.map(el => {
    const cs = getComputedStyle(el);
    return { transform: cs.transform, opacity: Number(cs.opacity), name: cs.animationName, duration: cs.animationDuration, fill: cs.animationFillMode, iteration: cs.animationIterationCount };
  });
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // --- ① 通常の端末 ---
    const page = await browser.newPage({ viewport: { width: 390, height: 720 } });
    await page.setContent(html);
    await page.waitForTimeout(60);
    const early = await sample(page);
    await page.waitForTimeout(140);
    const mid = await sample(page);

    check('花びらが12枚描かれている', early.length === 12, `${early.length}枚`);
    check('全枚 eikiSakuraFall で動いている', early.every(p => p.name === 'eikiSakuraFall'), early.map(p => p.name).join('/'));
    check('繰り返さない(1回で終わる)', early.every(p => p.iteration === '1'), early.map(p => p.iteration).join('/'));
    check('斬撃後の余韻を含めても0.55秒以下',
      early.every(p => parseFloat(p.duration) > 0.32 && parseFloat(p.duration) <= 0.55), early[0].duration);
    check('終わったあとの状態を保つ(forwards)', early.every(p => p.fill === 'forwards'), early[0].fill);
    const moved = early.filter((p, i) => p.transform !== mid[i].transform).length;
    check('実際に動いている(transformが時間で変わる)', moved === 12, `${moved}/12枚`);

    // 高速斬撃(320ms)のあとに短い余韻を残し、500ms前後で消えているか
    await page.waitForTimeout(160);
    const tail = await sample(page);
    const lingering = tail.some(p => p.opacity > 0.1);
    check('高速斬撃のあとまで花びらの余韻が見える', lingering);
    await page.waitForTimeout(250);
    const done = await sample(page);
    check('モーション終了後は透明になり残らない', done.every(p => p.opacity < 0.02), done.map(p => p.opacity.toFixed(2)).join('/'));

    // --- 実戦の64px枠で斬撃方向へ流れた花びらが切られないか ---
    const box = await page.evaluate(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const layer = document.querySelector('.eiki-sakura').getBoundingClientRect();
      return { stage: { w: stage.width, h: stage.height }, layer: { w: layer.width, h: layer.height },
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
    });
    check('花びらの層は実戦枠と同じ大きさ(inset:0)',
      Math.abs(box.layer.w - box.stage.w) < 1 && Math.abs(box.layer.h - box.stage.h) < 1,
      `層 ${box.layer.w}x${box.layer.h} / 枠 ${box.stage.w}x${box.stage.h}`);
    check('実戦の小枠で花びらを切らない', css.includes('overflow: visible'));
    check('花びらで横スクロールが増えない', box.scrollW <= box.clientW, `${box.scrollW} / ${box.clientW}`);
    await page.close();

    // --- ② 動きを減らす設定の端末 ---
    const reduced = await browser.newPage({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await reduced.setContent(html);
    await reduced.waitForTimeout(60);
    const r1 = await sample(reduced);
    await reduced.waitForTimeout(140);
    const r2 = await sample(reduced);
    check('動きを減らす設定では eikiSakuraFade へ切り替わる',
      r1.every(p => p.name === 'eikiSakuraFade'), r1.map(p => p.name).join('/'));
    const rMoved = r1.filter((p, i) => p.transform !== r2[i].transform).length;
    check('動きを減らす設定では流れない(transformが変わらない)', rMoved === 0, `${rMoved}枚が動いた`);
    const faded = r1.some(p => p.opacity > 0.1) || r2.some(p => p.opacity > 0.1);
    check('動きを減らす設定でも花びらは見える(淡く出る)', faded);
    await reduced.close();
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
