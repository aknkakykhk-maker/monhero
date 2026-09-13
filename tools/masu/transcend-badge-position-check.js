// 超越マーク(「超」の丸バッジ)が、モンスターの絵に重なっていないかをブラウザで測る。
//
//   node tools/masu/transcend-badge-position-check.js
//
// 【なぜ道具にするか】
// モンスターの絵はまるく切り抜いて出しているので、四角い枠の「角」は絵の外側になる。
// マークをその角へ置けば、せっかく染色した絵を隠さずに済む。
// ただし「角へ置けば必ず外」ではなく、絵の丸とマークの丸が離れているかは
// 大きさとずらし量の組み合わせで決まる。目で見て確かめるのは当てにならないので、
// 実際に描いて「中心どうしの距離 ≧ 半径の和」かを数値で確かめる。
//
// このサンドボックスはTailwindを読めないため、アプリを開いて測ると幅が実寸にならない。
// そこで、本番のCSS(.mh-transcend-badge)と、本番で使っている枠の大きさだけを取り出し、
// 同じ条件を作って測る。枠の大きさが本体から消えたら気づけるよう、実在も確かめる。
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

// 本番でマークを重ねている丸い枠。左が画面での使いどころ、右がその大きさ(px)
const SPOTS = [
  { where: '一覧・編成のカード', cls: 'w-12 h-12', size: 48, small: true },
  { where: 'マスモンの詳細', cls: 'w-[68px] h-[68px]', size: 68, small: false },
  { where: '神殿・超越の候補', cls: 'w-14 h-14', size: 56, small: true },
  { where: '神殿・超越で選んだ個体', cls: 'w-20 h-20', size: 80, small: false },
  { where: '超越強化のヘッダー', cls: 'w-9 h-9', size: 36, small: true },
  { where: 'デバッグの見本', cls: 'w-16 h-16', size: 64, small: false },
];
SPOTS.forEach(spot => check(`${spot.where}の枠(${spot.cls})が本体にある`, source.includes(spot.cls)));

// 本番のCSSをそのまま持ち込む(書き写すとテストだけ古くなるため)。
// 魂格バッジも同じ場所へ重ねるので一緒に測る。こちらは王冠(::before)が上へ伸びるので、
// 丸どうしの距離だけでなく王冠が絵にかかっていないかも見る
// (2026-09-13・ユーザー指摘「魂格のマークがしょぼい」で王冠を足したときに追加)。
const cssOf = (head) => { const at = source.indexOf(head); return at < 0 ? '' : source.slice(at, source.indexOf('}', at) + 1); };
const badgeCss = ['.mh-transcend-badge{', '.mh-transcend-badge>b{', '.mh-transcend-badge.is-small{'].map(cssOf).join('\n');
const soulCss = ['.mh-soul-rank-badge{', '.mh-soul-rank-badge::before{', '.mh-soul-rank-badge::after{', '.mh-soul-rank-badge>b{',
  '.mh-soul-rank-badge.is-small{', '.mh-soul-rank-badge.is-small::before{', '.mh-soul-rank-badge.is-small::after{',
  '.mh-soul-rank-badge.is-small>b{', '.mh-soul-rank-badge.is-stage-3{'].map(cssOf).join('\n');
check('超越マークのCSSを本体から取り出せる', badgeCss.includes('.mh-transcend-badge{') && badgeCss.includes('is-small'));
check('魂格バッジのCSSを本体から取り出せる', soulCss.includes('.mh-soul-rank-badge{') && soulCss.includes('::before'));

const page$ = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#020617;padding:60px}
  .spot{position:relative;margin:60px}
  .art{border-radius:50%;overflow:hidden;background:#f472b6}
  ${badgeCss}
  ${soulCss}
</style>` + SPOTS.map((s, i) => `
  <div class="spot" data-i="${i}" style="width:${s.size}px;height:${s.size}px">
    <div class="art" style="width:${s.size}px;height:${s.size}px"></div>
    <span class="mh-transcend-badge${s.small ? ' is-small' : ''}"><b>超</b></span>
  </div>
  <div class="spot soul" data-i="${i}" style="width:${s.size}px;height:${s.size}px">
    <div class="art" style="width:${s.size}px;height:${s.size}px"></div>
    <span class="mh-soul-rank-badge is-stage-3${s.small ? ' is-small' : ''}"><b>Ⅲ</b></span>
  </div>`).join('');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
    await page.setContent(page$);
    await page.waitForTimeout(300);
    const measured = await page.evaluate(() => [...document.querySelectorAll('.spot:not(.soul)')].map((spot) => {
      const art = spot.querySelector('.art').getBoundingClientRect();
      const badge = spot.querySelector('.mh-transcend-badge').getBoundingClientRect();
      const ar = art.width / 2, br = badge.width / 2;
      const dx = (badge.left + br) - (art.left + ar);
      const dy = (badge.top + br) - (art.top + ar);
      // 丸どうしの隙間。0以上なら絵にかかっていない
      return { art: Math.round(art.width), badge: Math.round(badge.width),
        gap: +(Math.sqrt(dx*dx + dy*dy) - (ar + br)).toFixed(2),
        outsideBox: +(badge.right - art.right).toFixed(1) };
    }));
    measured.forEach((m, i) => {
      const spot = SPOTS[i];
      check(`${spot.where}（絵${m.art}px）でマークが絵にかかっていない`, m.gap >= 0,
        `丸どうしの隙間 ${m.gap}px / マーク${m.badge}px`);
    });
    // 角から離れすぎて浮いて見えないことも見る(枠の外へ出る量が小さいこと)
    check('マークが枠から離れすぎていない', measured.every(m => m.outsideBox <= 10),
      measured.map(m => m.outsideBox).join(' / '));

    // ---- 魂格バッジ(王冠つき) ----
    // 丸の本体に加えて、上へ伸びる王冠が絵にかかっていないかまで測る。
    // 王冠は擬似要素なので getBoundingClientRect には出ない。四隅を手で当てる
    const soulMeasured = await page.evaluate(() => [...document.querySelectorAll('.spot.soul')].map((spot) => {
      const art = spot.querySelector('.art').getBoundingClientRect();
      const el = spot.querySelector('.mh-soul-rank-badge');
      const badge = el.getBoundingClientRect();
      const ar = art.width / 2, br = badge.width / 2;
      const acx = art.left + ar, acy = art.top + ar;
      const dx = (badge.left + br) - acx, dy = (badge.top + br) - acy;
      // 王冠(::before)の位置と大きさを計算値から復元する
      const cs = getComputedStyle(el, '::before');
      const cw = parseFloat(cs.width), ch = parseFloat(cs.height), ctop = parseFloat(cs.top);
      const ccx = badge.left + br;           // translateX(-50%) で丸の中心へそろえている
      const crownLeft = ccx - cw / 2, crownRight = ccx + cw / 2;
      const crownTop = badge.top + ctop, crownBottom = crownTop + ch;
      // 王冠の四隅のうち、絵の中心にいちばん近い点までの距離
      const nearX = Math.max(crownLeft, Math.min(acx, crownRight));
      const nearY = Math.max(crownTop, Math.min(acy, crownBottom));
      const crownGap = Math.hypot(nearX - acx, nearY - acy) - ar;
      return { art: Math.round(art.width), badge: Math.round(badge.width),
        gap: +(Math.sqrt(dx*dx + dy*dy) - (ar + br)).toFixed(2),
        crown: +(crownGap).toFixed(2), crownW: Math.round(cw) };
    }));
    check('魂格バッジも描けている(王冠の大きさが取れる)', soulMeasured.every(m => m.crownW > 0),
      soulMeasured.map(m => m.crownW).join(' / '));
    soulMeasured.forEach((m, i) => {
      const spot = SPOTS[i];
      check(`${spot.where}（絵${m.art}px）で魂格バッジが絵にかかっていない`, m.gap >= 0,
        `丸どうしの隙間 ${m.gap}px / マーク${m.badge}px`);
    });
    check('魂格の王冠が絵にかかっていない', soulMeasured.every(m => m.crown >= 0),
      soulMeasured.map(m => `${m.crown}px`).join(' / '));
    await browser.close();
  } catch (e) {
    check('ブラウザで測れた', false, e.message.split('\n')[0]);
    if (browser) await browser.close().catch(() => {});
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
