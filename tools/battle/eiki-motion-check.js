// エイキの攻撃モーション(桜の花びら)を、実際のブラウザで測って確かめる。
//
//   node tools/battle/eiki-motion-check.js
//
// 花びらは「攻撃したときだけ出す」約束で入れたので、次の3つを実測する。
//   ① 6枚が枠の中で本当に動いているか(transform が時間で変わるか)
//   ② 攻撃モーションと同じ長さで終わるか(常時アニメーションになっていないか)
//   ③ 動きを減らす設定の端末では、流さず淡く出て消えるだけになっているか
// あわせて、枠(.eiki-sakura)からはみ出して画面をずらしていないかも見る。
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
check('花びらは6枚に固定されている', petals.length === 6, `${petals.length}枚`);
check('スマホ負荷を増やさないため枚数は8枚以下', petals.length <= 8);

// EikiSakuraPetals と同じDOM。枠は攻撃中のカード相当(180x220)に置く
const petalHtml = petals.map(p =>
  `<span class="eiki-sakura__petal" style="left:${p.left};font-size:${p.size};animation-delay:${p.delay};`
  + `--eiki-petal-drift:${p.drift};--eiki-petal-spin:${p.spin}">🌸</span>`).join('');
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
html,body{margin:0;background:#111}
.stage{position:relative;width:180px;height:220px;margin:40px;background:#222;overflow:hidden}
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

    check('花びらが6枚描かれている', early.length === 6, `${early.length}枚`);
    check('全枚 eikiSakuraFall で動いている', early.every(p => p.name === 'eikiSakuraFall'), early.map(p => p.name).join('/'));
    check('繰り返さない(1回で終わる)', early.every(p => p.iteration === '1'), early.map(p => p.iteration).join('/'));
    check('攻撃モーションと同じ短さ(0.5秒以下)',
      early.every(p => parseFloat(p.duration) > 0 && parseFloat(p.duration) <= 0.5), early[0].duration);
    check('終わったあとの状態を保つ(forwards)', early.every(p => p.fill === 'forwards'), early[0].fill);
    const moved = early.filter((p, i) => p.transform !== mid[i].transform).length;
    check('実際に動いている(transformが時間で変わる)', moved === 6, `${moved}/6枚`);

    // 攻撃モーション(320ms)が終わったあと、花びらが消えているか
    await page.waitForTimeout(400);
    const done = await sample(page);
    check('モーション終了後は透明になり残らない', done.every(p => p.opacity < 0.02), done.map(p => p.opacity.toFixed(2)).join('/'));

    // --- 枠からはみ出して画面をずらしていないか ---
    const box = await page.evaluate(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const layer = document.querySelector('.eiki-sakura').getBoundingClientRect();
      return { stage: { w: stage.width, h: stage.height }, layer: { w: layer.width, h: layer.height },
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
    });
    check('花びらの層は枠と同じ大きさ(inset:0)',
      Math.abs(box.layer.w - box.stage.w) < 1 && Math.abs(box.layer.h - box.stage.h) < 1,
      `層 ${box.layer.w}x${box.layer.h} / 枠 ${box.stage.w}x${box.stage.h}`);
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
