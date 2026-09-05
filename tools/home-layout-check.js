// HOME画面の配置を、実際のブラウザで測って確かめる。
//
// HOMEは絶対配置の1画面レイアウトなので、少し数値を変えるだけで
// 「みゅあの吹き出しがプロフィールに重なる」「はじめての案内の説明が、
// 光らせた施設の上に重なって見えなくなる」といったことが起きる。実際に2回起こした。
//
// HOMEのCSSは自前のスタイル(Tailwindを使っていない)ので、CSSだけを取り出して
// 同じ形のDOMへ当てれば、このサンドボックスでも本物と同じ位置を測れる。
//
//   node tools/home-layout-check.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
// createAnimationStyle のCSSから、HOMEに関する行だけを集める
const css = source.split('\n').filter(l => l.includes('.mh-home-')).join('\n')
  .replace(/^\s*`?/, '').replace(/`;?\s*$/, '');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 本物と同じ組み立て(施設・ミッション・ギフト・設定・みゅあの吹き出し)
// 本体は #root > div を max-width:600px で中央へ寄せている。
// 幅の広い端末(折りたたみ)では、そこが効いた状態で測らないと意味が無いので同じにする。
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
html,body{margin:0;height:100%}
body{display:flex;justify-content:center}
#shell{width:100%;height:100%;max-width:600px;margin:0 auto;display:flex;flex-direction:column;overflow:hidden}
${css}
</style></head><body>
<div id="shell">
<main class="mh-home-scene">
  <header class="mh-home-status">
    <button class="mh-home-player"><div class="mh-home-avatar"></div><div class="mh-home-player-copy"><strong>あつ</strong><span>ブリーダー Lv.38</span><div class="mh-home-xp"><i style="width:60%"></i></div><small>414 / 651 XP</small></div></button>
    <section class="mh-home-wallet"><div><b>19003</b><small>ダイヤ</small></div><div><b>138</b><small>pt</small></div><button class="mh-home-settings"><span>設定</span></button></section>
  </header>
  <nav class="mh-home-facilities">
    <button class="mh-home-facility management"><span>M/B管理</span></button>
    <button class="mh-home-facility temple"><span>神殿</span></button>
    <button class="mh-home-facility market"><span>マーケット</span></button>
    <button class="mh-home-facility rhythm"><span>🎵 モンヒロビート<small>準備中</small></span></button>
    <button class="mh-home-facility battle"><span>バトル</span></button>
  </nav>
  <button class="mh-home-mission">ミッション</button>
  <button class="mh-home-gift">ギフト</button>
  <button class="mh-home-update">更新履歴</button>
  <div class="mh-home-assistant" style="height:70px">みゅあ</div>
</main></div></body></html>`;

// 光らせる場所と、そこを説明するときに吹き出しを上へ寄せるべきか
// (画面の下半分にあるものは、下に出すと説明が重なってしまう)
const SPOTS = {
  management: { sel: '.mh-home-facility.management', wantTop: false },
  temple:     { sel: '.mh-home-facility.temple',     wantTop: false },
  market:     { sel: '.mh-home-facility.market',     wantTop: true },
  battle:     { sel: '.mh-home-facility.battle',     wantTop: true },
  reward:     { sel: '.mh-home-mission,.mh-home-gift', wantTop: true },
  settings:   { sel: '.mh-home-settings',            wantTop: false },
  assistant:  { sel: '.mh-home-assistant',           wantTop: false },
};
// 代表的な画面の大きさ(小さい端末・ふつう・大きい端末・折りたたみ)
// 折りたたみ端末は「幅が広く、高さが低い」。ふつうのスマホより150pxほど低いので、
// 縦に置いたものが入りきらないかどうかは、ここで初めて分かる
// (2026-09-05・ユーザー指摘、Galaxy Z Fold6)。
const SIZES = [
  { name: 'iPhone SE  375x667', width: 375, height: 667 },
  { name: '小さい端末 320x568', width: 320, height: 568 },
  { name: 'ふつう     390x844', width: 390, height: 844 },
  { name: '大きい端末 428x926', width: 428, height: 926 },
  { name: 'Fold6 内側 690x700', width: 690, height: 700 },
  { name: 'Fold6 外側 344x882', width: 344, height: 882 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.setContent(html);
    const res = await page.evaluate((spots) => {
      const box = (sel) => {
        let top = Infinity, bottom = -Infinity;
        document.querySelectorAll(sel).forEach(el => {
          // 施設は当たり判定の枠が広く、見えているのは中のラベルなので、そちらを測る
          const target = el.classList.contains('mh-home-facility') ? (el.querySelector('span') || el) : el;
          const r = target.getBoundingClientRect();
          if (r.height > 0) { top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); }
        });
        return { top, bottom };
      };
      const out = { spots: {}, height: window.innerHeight, width: window.innerWidth };
      for (const [name, sel] of Object.entries(spots)) {
        const b = box(sel);
        out.spots[name] = { ...b, atTop: b.bottom > window.innerHeight * 0.5 };
      }
      const card = document.querySelector('.mh-home-player').getBoundingClientRect();
      const bubble = document.querySelector('.mh-home-assistant').getBoundingClientRect();
      const facilities = [...document.querySelectorAll('.mh-home-facility')].map(el => {
        const s = el.querySelector('span');
        const r = (s || el).getBoundingClientRect();
        return { name: el.className.replace('mh-home-facility ', ''), top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      return { ...out, card: { bottom: card.bottom }, bubble: { top: bubble.top, bottom: bubble.bottom, left: bubble.left, right: bubble.right }, facilities };
    }, Object.fromEntries(Object.entries(SPOTS).map(([k, v]) => [k, v.sel])));

    console.log(`\n【${size.name}】`);
    // ① プロフィールカードに重ならないか
    const gap = Math.round(res.bubble.top - res.card.bottom);
    check('  みゅあの吹き出しがプロフィールに重ならない', gap >= 6, `すき間 ${gap}px`);
    // ② 施設のラベルに重ならないか
    const hit = res.facilities.filter(f =>
      f.top < res.bubble.bottom && f.bottom > res.bubble.top && f.left < res.bubble.right && f.right > res.bubble.left);
    check('  みゅあの吹き出しが施設に重ならない', hit.length === 0, hit.map(f => f.name).join(', '));
    // ③ 案内の説明を上下どちらへ出すかが、光らせる場所ごとに正しいか
    const wrong = Object.entries(SPOTS).filter(([name, def]) => res.spots[name].atTop !== def.wantTop)
      .map(([name]) => `${name}(下端${Math.round(res.spots[name].bottom)}/画面${res.height})`);
    check('  案内の説明を出す向きが正しい', wrong.length === 0, wrong.join(', '));
    // ④ 施設のラベルが画面の外へはみ出していないか
    // (名前を長くしたときに、狭い端末で右や左が切れるのを拾う)
    const overflow = res.facilities.filter(f => f.left < -0.5 || f.right > res.width + 0.5);
    check('  施設のラベルが画面からはみ出さない', overflow.length === 0,
      overflow.map(f => `${f.name}(${Math.round(f.left)}〜${Math.round(f.right)} / 画面${res.width})`).join(', '));
    // ⑤ 上下に切れていないか。折りたたみ端末は高さが低いので、
    //    「バトル」のように下端へ置いたものが画面の外へ出ていないかを見る。
    const cut = res.facilities.filter(f => f.bottom > res.height + 0.5 || f.top < -0.5);
    check('  施設のラベルが上下に切れない', cut.length === 0,
      cut.map(f => `${f.name}(上${Math.round(f.top)} 下${Math.round(f.bottom)} / 画面高${res.height})`).join(', '));
    await page.close();
  }
  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
