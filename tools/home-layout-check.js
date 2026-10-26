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
// 右上の枠を桁が多いときだけ広げる計算(69-screen-home.jsx の homeWalletGrowPx)を、本物の1行から作る
const growLine = (source.match(/^const homeWalletGrowPx=.*$/m) || [''])[0];
const homeWalletGrowPx = growLine ? new Function(`${growLine}; return homeWalletGrowPx;`)() : null;
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
/* 本体(index.html)と同じ: 横画面のスマホではコラムを広げる(#146) */
@media (orientation: landscape) and (max-height: 600px){#shell{max-width:1024px}}
${css}
</style></head><body>
<div id="shell">
<main class="mh-home-scene">
  <header class="mh-home-status">
    <button class="mh-home-player"><div class="mh-home-avatar"></div><div class="mh-home-player-copy"><strong>あつ</strong><span>ブリーダー Lv.38</span><div class="mh-home-xp"><i style="width:60%"></i></div><small>414 / 651 XP</small></div></button>
    <section class="mh-home-wallet"><div><svg width="14" height="14"></svg><b style="--len:6">19,003</b><small>ダイヤ</small></div><div><svg width="14" height="14"></svg><b style="--len:3">138</b><small>ブリーダーP</small></div><button class="mh-home-settings"><svg width="20" height="20"></svg><span>設定</span></button></section>
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
  <button class="mh-home-event-banner"><b>🎃 ハロウィン・ナイト</b><small>開催中 〜11/1 13:59</small></button>
  <button class="mh-home-card-battle"><span>🃏 MFバトルカード</span></button>
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
  // 横画面(#146・2026-09-05)。コラムが画面いっぱいになり、施設の配置も横画面用に変わる。
  // 高さが390pxしか無いので、吹き出しと施設の重なり・上下の切れは縦画面より起きやすい
  { name: '横画面     844x390', width: 844, height: 390 },
  { name: '横画面     932x430', width: 932, height: 430 },
  { name: '横画面 小  667x375', width: 667, height: 375 },
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
    // ⑦ 左の列の札(モンヒロビート・イベントの札・MFバトルカード)が重ならない(2026-10-26 320×568〜375×667 で 3〜6px 重なっていた)。
    //    イベントの札が無いときは、MFバトルカードの札が1段上がる(.raised)ので、そちらも見る
    const leftCol = async (event) => page.evaluate((event) => {
      const ev = document.querySelector('.mh-home-event-banner'); const cardBtn = document.querySelector('.mh-home-card-battle');
      ev.style.display = event ? '' : 'none'; cardBtn.classList.toggle('raised', !event);
      const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
      const items = [['モンヒロビート', document.querySelector('.mh-home-facility.rhythm>span')], ['イベントの札', ev], ['MFバトルカード', cardBtn.querySelector('span')], ['バトル', document.querySelector('.mh-home-facility.battle>span')]]
        .map(([n, el]) => [n, r(el)]).filter(([, b]) => b.h > 0);
      const hits = [];
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const [na, a] = items[i], [nb, b] = items[j];
        if (a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left) hits.push(`${na}と${nb}(${Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))}px)`);
      }
      ev.style.display = ''; cardBtn.classList.remove('raised');
      return hits;
    }, event);
    for (const [label, event] of [['イベントの札があるとき', true], ['イベントの札が無いとき', false]]) {
      const hits = await leftCol(event);
      check(`  左の列の札が重ならない(${label})`, hits.length === 0, hits.join(', '));
    }
    // ⑥ 右上の枠(ダイヤ・ブリーダーP)は桁が増えても高さが変わらない(2026-10-13 社長「8桁で『ダイヤ』が縦に折れた」)。
    //    0・8桁・10桁で、数とラベルが1行のまま・枠とプロフィールの高さが同じかを見る
    const walletAt = async (gold, bp) => page.evaluate(([g, p, grow]) => {
      document.querySelector('.mh-home-wallet').style.setProperty('--wal-grow', `${grow}px`);
      const rows = document.querySelectorAll('.mh-home-wallet>div');
      [[rows[0], g], [rows[1], p]].forEach(([row, value]) => {
        const b = row.querySelector('b'); const text = Number(value).toLocaleString('en');
        b.textContent = text; b.style.setProperty('--len', String(text.length));
      });
      const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; };
      const wrapped = [...document.querySelectorAll('.mh-home-wallet>div b,.mh-home-wallet>div small')].filter(el => lines(el) > 1).map(el => el.textContent);
      return { wallet: document.querySelector('.mh-home-wallet').getBoundingClientRect().height, player: document.querySelector('.mh-home-player').getBoundingClientRect().height, wrapped };
    }, [gold, bp, homeWalletGrowPx(Number(gold).toLocaleString('en'), Number(bp).toLocaleString('en'))]);
    check('  右上の枠を広げる計算(homeWalletGrowPx)を本物から取り出せる', typeof homeWalletGrowPx === 'function');
    const base = await walletAt(0, 0);
    for (const [label, gold, bp] of [['8桁', 54065882, 54065882], ['10桁', 1234567890, 1234567890]]) {
      const w = await walletAt(gold, bp);
      check(`  右上の枠が${label}でも1行のまま・高さが変わらない`, w.wrapped.length === 0 && Math.abs(w.wallet - base.wallet) < 0.5 && Math.abs(w.player - base.player) < 0.5,
        `枠 ${Math.round(base.wallet)}→${Math.round(w.wallet)}px / プロフィール ${Math.round(base.player)}→${Math.round(w.player)}px${w.wrapped.length ? ` / 折り返し ${w.wrapped.join(',')}` : ''}`);
    }
    await page.close();
  }
  // ---- 本物の画面でも測る(2026-10-20 改善部 M7) ----
  // 上の見本は .mh-home- の CSS だけで組むので、index.html の CSS や吹き出しの本当の文の長さが入らない。
  // 320×568 で「みゅあの吹き出しが M/B管理 の札の左上を隠す」のを見逃していた。本物を開いて、
  // 吹き出しの文の行数(幅360未満は2行まで)と、吹き出しの下端が「M/B管理」の札の上端を越えないかを見る
  {
    const http = require('http');
    const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    const PORT = 8963;
    const server = await new Promise(r => { const sv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, u);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); sv.listen(PORT, () => r(sv)); });
    for (const size of [{ name: '本物 320x568', width: 320, height: 568 }, { name: '本物 375x667(SE)', width: 375, height: 667 }, { name: '本物 390x844', width: 390, height: 844 }]) {
      console.log(`--- ${size.name}`);
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
        put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
        // 10桁のダイヤ・9桁のブリーダーP(2026-10-21 改善部 N5「数の字が約6px まで縮む」)。財布の字の大きさを下で測る
        put('mh_gold', 6736760000); put('mh_breeder_points', 123456790); put('mh_breeder_points_granted', true); });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.querySelector('.mh-home-assistant [data-bubble-text]'), { timeout: 40000 });
      for (let i = 0; i < 14; i++) {
        const did = await page.evaluate(() => { const inO = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.position === 'fixed' || (st.position === 'absolute' && Number(st.zIndex) >= 40)) return true; } return false; };
          const l = [...document.querySelectorAll('button')].filter(b => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
          if (!l.length) return false; l[0].click(); return true; });
        if (!did) break; await page.waitForTimeout(300);
      }
      // いちばん長くなりやすい文(3行ぶん)に差し替えて測る。ふだんのひとことは毎回ちがうので、長い文で確かめる
      await page.evaluate(() => { const t = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (t) t.textContent = '今日はどんな勇者モンが育つかなぁ〜٩(*´ᵕ`*)۶ワクワク まずはミッションとギフトを見てから、バトルへいこ！'; });
      // 吹き出しが伸びたぶん札が下がる(ResizeObserver)のを待ってから測る
      await page.waitForTimeout(300);
      const res = await page.evaluate(() => {
        const t = document.querySelector('.mh-home-assistant [data-bubble-text]');
        const st = t ? getComputedStyle(t) : null;
        const lh = st ? parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.6 : 0;
        const lines = t ? Math.round(t.getBoundingClientRect().height / lh) : 0;
        const a = document.querySelector('.mh-home-assistant');
        const mb = [...document.querySelectorAll('.mh-home-facility')].find(x => /M\/B管理/.test(x.innerText));
        const label = mb && (mb.querySelector('span') || mb);
        // 吹き出しの本体(顔の絵を除く、文の枠)の下端
        const bubble = t && t.closest('button,div[style*="border"]');
        const bb = (bubble || a).getBoundingClientRect(), lb = label ? label.getBoundingClientRect() : null;
        const overlapX = lb ? Math.min(bb.right, lb.right) - Math.max(bb.left, lb.left) : 0;
        return { lines, cut: t ? t.scrollHeight > t.clientHeight + 1 || st.webkitLineClamp !== 'none' : false, bubbleBottom: Math.round(bb.bottom), labelTop: lb ? Math.round(lb.top) : null, overlapX: Math.round(overlapX) };
      });
      // 2026-10-24 窓口「幅320で『ついてるから大丈夫！…』と切れている」。文は切らずに全部出し、伸びたぶん札を下げる
      check('  みゅあの文が「…」で切れずに全部見える', !res.cut, `${res.lines}行`);
      check('  みゅあの吹き出しが「M/B管理」の札を隠さない', res.labelTop === null || res.overlapX <= 0 || res.bubbleBottom <= res.labelTop + 1,
        `吹き出しの下端 ${res.bubbleBottom}px / 札の上端 ${res.labelTop}px`);
      // N5: 9桁(1億)からは「67.3億」のように縮めて出し、財布の字が8px 以上に保たれる。押すと細かい数が出る
      const wallet = await page.evaluate(() => [...document.querySelectorAll('.mh-home-wallet > div b')].map(b => ({ t: b.innerText.trim(), px: parseFloat(getComputedStyle(b).fontSize) })));
      check('  財布の数は9桁から縮めて出し、字は8px 以上(10桁のダイヤ・9桁のブリーダーP)', wallet.length === 2 && wallet[0].t === '67.3億' && wallet[1].t === '1.23億' && wallet.every(x => x.px >= 8),
        wallet.map(x => `${x.t}@${x.px}px`).join(' / '));
      const exact = await page.evaluate(() => { const b = document.querySelector('.mh-home-wallet [data-compact-count]'); if (!b) return ''; b.click(); return new Promise(r => setTimeout(() => r((document.querySelector('[data-compact-count-exact]') || {}).textContent || ''), 200)); });
      check('  縮めた数を押すと、細かい数(6,736,760,000)が出る', exact === '6,736,760,000', exact);
      // ジャックの吹き出し(2026-10-21 窓口「幅320で ジャックのセリフの吹き出しが M/B管理 の札にかかる」)。
      // 置き場所はときどき測り直すので、落ち着くのを待ってから、施設の札(見える札)とジャックの絵に重ならず、画面の中にあるかを見る
      await page.evaluate(() => { const t = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (t) t.textContent = 'あたしがついてるから大丈夫！ いってらっしゃい〜(｡･ω･)ﾉﾞ'; });
      await page.waitForTimeout(2000);
      const readJack = () => page.evaluate(() => {
        const say = document.querySelector('[data-home-raid-say]');
        if (!say) return null;
        const r = say.getBoundingClientRect();
        // 絵は跳ねているので、アプリ(homeRaidSayPlace)と同じく、跳ねる前の置き位置(offset)で測る
        const art = document.querySelector('[data-home-raid-jack] [data-jack-aura], [data-home-raid-jack] [data-home-raid-pumpkin]');
        const img = art && art.querySelector('img.mh-home-raid-jack-img');
        const ar = art ? art.getBoundingClientRect() : null;
        const jr = img ? { left: ar.left + img.offsetLeft, top: ar.top + img.offsetTop, right: ar.left + img.offsetLeft + img.offsetWidth, bottom: ar.top + img.offsetTop + img.offsetHeight, width: img.offsetWidth, height: img.offsetHeight } : null;
        const hit = (o) => Math.min(r.right, o.right) - Math.max(r.left, o.left) > 0 && Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top) > 0;
        const labels = [...document.querySelectorAll('.mh-home-facility')].map(x => ({ t: x.innerText.replace(/\s+/g, '').slice(0, 8), r: (x.querySelector(':scope > span') || x).getBoundingClientRect() }))
          .filter(x => x.r.width > 2 && hit(x.r)).map(x => x.t);
        const jackHit = jr ? Math.max(0, Math.min(r.right, jr.right) - Math.max(r.left, jr.left)) * Math.max(0, Math.min(r.bottom, jr.bottom) - Math.max(r.top, jr.top)) / Math.max(1, jr.width * jr.height) : 0;
        const title = document.querySelector('[data-home-raid-jack] [data-home-raid-jack-title]');
        const band = title ? title.parentElement.getBoundingClientRect() : null;
        const titleLines = title ? Math.round(title.getBoundingClientRect().height / (parseFloat(getComputedStyle(title).fontSize) * 1.3)) : 0;
        return { labels, jackHit: Math.round(jackHit * 100), faceTop: jr ? Math.round(jr.top + jr.height * 0.45 - 8) : 0, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, box: [r.left, r.top, r.right, r.bottom].map(Math.round),
          side: say.getAttribute('data-say-side'), hidden: say.getAttribute('data-say-hidden') === 'true', bandTop: band ? Math.round(band.top) : null, titleLines };
      });
      // ① みゅあがふつうの長さ(2行)の台詞のとき: ジャックの吹き出しは必ず出て、札・帯・絵を隠さない
      const sayJack = (jack, label) => {
        if (!jack) return;
        check(`  ${label}ジャックの吹き出しが施設の札(M/B管理・神殿など)にかからない`, jack.labels.length === 0, `${jack.labels.join('・')} / 吹き出し ${jack.box.join(',')}`);
        // 2026-10-24 窓口「320 で大王の吹き出しがかぼちゃの顔を隠している」。しっぽの先まで、目の高さ(絵の箱の上から45%)より8px上に置く
        check(`  ${label}ジャックの吹き出しがかぼちゃの顔を隠さない・画面の中にある`, jack.box[3] + 9 <= jack.faceTop + 1 && jack.inside, `吹き出しの下端+しっぽ ${jack.box[3] + 9}px / 顔の線 ${jack.faceTop}px / 吹き出し ${jack.box.join(',')}`);
        // 2026-10-24 窓口「SE・320 で、帯の右に出て帯を隠している」。どの幅でもかぼちゃの上(帯より上。しっぽ9pxも含めて)に置く
        check(`  ${label}ジャックの吹き出しはかぼちゃの上に出て、帯(〜があらわれた！・共有HP)に乗らない`, jack.side === 'top' && jack.bandTop !== null && jack.box[3] + 9 <= jack.bandTop, `${jack.side} / 吹き出しの下端 ${jack.box[3]}px / 帯の上端 ${jack.bandTop}px`);
      };
      const short = await readJack();
      if (short) {
        check('  帯の「〜があらわれた！」が1行に収まる', short.titleLines === 1, `${short.titleLines}行`);
        // 幅360未満は、ジャックの台詞が長いと置ける所が無く、出さないことがある(2026-10-24 窓口「置ける場所がなければ出さない扱いで構わない」)
        check('  (みゅあが2行のとき)ジャックの吹き出しが出ている(出さないのは幅360未満だけ)', !short.hidden || size.width < 360, `幅${size.width}`);
        if (!short.hidden) sayJack(short, '(みゅあが2行のとき)');
      }
      // ② みゅあが長い台詞(上で差し替えた3〜4行)のとき。札にも顔にもかからない置き場所が無いなら出さない。出さないのは幅360未満だけ
      await page.evaluate(() => { const t = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (t) t.textContent = '今日はどんな勇者モンが育つかなぁ〜٩(*´ᵕ`*)۶ワクワク まずはミッションとギフトを見てから、バトルへいこ！'; });
      await page.waitForTimeout(2000);
      const jack = await readJack();
      if (jack && jack.hidden) check('  (みゅあが長いとき)ジャックの吹き出しを出さないのは幅360未満だけ', size.width < 360, `幅${size.width}`);
      else sayJack(jack, '(みゅあが長いとき)');
      await page.close();
    }
    server.close();
  }
  await browser.close();
  // 助手の吹き出しは下へ伸びるので、そのままだとセリフが長いときに施設の札「M/B管理」へかぶって押せなくなる
  // (2026-10-23 社長「MB管理に助手のコメントが被ってくる」。きゅうこの3行のセリフで起きた)。2行で切っていたが、幅320で「…」で切れた
  // (2026-10-24 窓口)。いまは全文を出し、吹き出しの下端(--mh-home-assistant-bottom)より下へ M/B管理・神殿の札を下げる
  check('HOMEの助手の吹き出しは切らずに全部出し、伸びたぶん施設の札を下げる',
    !/<AssistantBubble scene="home"[^>]*\bmaxLines=/.test(source)
    && source.includes("scene.style.setProperty('--mh-home-assistant-bottom'")
    && source.includes('.mh-home-facility.management{left:2.52%;top:max(26.58%,calc(var(--mh-home-assistant-bottom,0px) + 6px))}')
    && source.includes('.mh-home-facility.temple{right:2.94%;top:max(25.9%,calc(var(--mh-home-assistant-bottom,0px) + 6px))}'));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
