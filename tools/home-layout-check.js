// HOME画面の配置を、実際のブラウザで測って確かめる。
//
// HOMEは絶対配置の1画面レイアウトなので、少し数値を変えるだけで
// 「みゅあの吹き出しがプロフィールに重なる」「はじめての案内の説明が、
// 光らせた施設の上に重なって見えなくなる」といったことが起きる。実際に2回起こした。
//
// 以前は HOME の CSS だけを取り出して見本の DOM へ当てて測っていたが、見本は本物とずれて
// 62件の NG を出し続けた(2026-11-11)。いまは全部の大きさで本物の画面を開いて測る。
// 2026-11-17 のホーム一新で、施設は下のドック(絶対配置)に集約され、吹き出しは流れで置く形になった
// (押し下げの仕組みは撤去)。測るのは「吹き出しがドックにかからない」「ドックのボタンと顔バッジが重ならない」。
//
//   node tools/home-layout-check.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
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
  // ---- 本物の画面でも測る(2026-10-20 改善部 M7) ----
  // 上の見本は .mh-home- の CSS だけで組むので、index.html の CSS や吹き出しの本当の文の長さが入らない。
  // 320×568 で「みゅあの吹き出しが施設の左上を隠す」のを見逃していた。本物を開いて、
  // 吹き出しの文の行数と、吹き出しの下端が下のドックの上端を越えないかを見る
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
          const l = [...document.querySelectorAll('button')].filter(b => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|(?:分|わ)かった|はい|スキップ|あとで読む)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
          if (!l.length) return false; l[0].click(); return true; });
        if (!did) break; await page.waitForTimeout(300);
      }
      // いちばん長くなりやすい文(3行ぶん)に差し替えて測る。ふだんのひとことは毎回ちがうので、長い文で確かめる
      await page.evaluate(() => { const t = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (t) t.textContent = '今日はどんな勇者モンが育つかなぁ〜٩(*´ᵕ`*)۶ワクワク まずはミッションとギフトを見てから、バトルへいこ！'; });
      // 吹き出しは流れで置く(伸びても下のドックとは重ならない)。落ち着いてから測る
      await page.waitForTimeout(300);
      const res = await page.evaluate(() => {
        const t = document.querySelector('.mh-home-assistant [data-bubble-text]');
        const st = t ? getComputedStyle(t) : null;
        const lh = st ? parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.6 : 0;
        const lines = t ? Math.round(t.getBoundingClientRect().height / lh) : 0;
        const a = document.querySelector('.mh-home-assistant');
        const dk = document.querySelector('.mh-home-dock');
        // 吹き出しの本体(顔の絵を除く、文の枠)の下端
        const bubble = t && t.closest('button,div[style*="border"]');
        const bb = (bubble || a).getBoundingClientRect(), lb = dk ? dk.getBoundingClientRect() : null;
        return { lines, cut: t ? t.scrollHeight > t.clientHeight + 1 || st.webkitLineClamp !== 'none' : false, bubbleBottom: Math.round(bb.bottom), dockTop: lb ? Math.round(lb.top) : null };
      });
      // 2026-10-24 窓口「幅320で『ついてるから大丈夫！…』と切れている」。文は切らずに全部出す
      check('  みゅあの文が「…」で切れずに全部見える', !res.cut, `${res.lines}行`);
      check('  みゅあの吹き出しが下のドックを隠さない', res.dockTop === null || res.bubbleBottom <= res.dockTop + 1,
        `吹き出しの下端 ${res.bubbleBottom}px / ドックの上端 ${res.dockTop}px`);
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
        // 避ける対象は本体(homeRaidSayObstacles)と同じ: ジャックの枠の中と画面の4割を超える大きいものを除く、ボタン全部(ドック・吹き出し・右端ボタンなど)
        const labels = [...document.querySelectorAll('main.mh-home-scene button')].filter(x => x.offsetParent && !x.closest('[data-home-raid-jack]')).map(x => ({ t: (x.getAttribute('aria-label') || x.innerText || '').replace(/\s+/g, '').slice(0, 8), r: x.getBoundingClientRect() }))
          .filter(x => x.r.width > 2 && x.r.width * x.r.height <= innerWidth * innerHeight * 0.4 && hit(x.r)).map(x => x.t);
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
        check(`  ${label}ジャックの吹き出しがHOMEのボタン(ドック・吹き出しなど)にかからない`, jack.labels.length === 0, `${jack.labels.join('・')} / 吹き出し ${jack.box.join(',')}`);
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
    // 背の低い横画面(568×320・640×360・667×375)で、HOME のドック・顔バッジが重ならず、画面の外へ出ない(2026-11-08 統括部長: 568×320 で
    // 「モンヒロバトル」と「ミッション」、吹き出しが長いと「M/B管理」と「鍵の向こう側へ」が重なった)。みゅあの台詞は長い文にして測る
    {
      const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, 'boot/quiet-boot-seed'));
      const { STORY_IDS, seed, toHome, waitFaces, finishTalk, homeFacesProblems } = require(path.resolve(__dirname, 'assistant/life-browser-shared'));
      for (const size of [{ name: '本物 横 568x320', width: 568, height: 320 }, { name: '本物 横 640x360', width: 640, height: 360 }, { name: '本物 横 667x375', width: 667, height: 375 }]) {
        console.log(`--- ${size.name}`);
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
        await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
        await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
        await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await toHome(page); await waitFaces(page); await finishTalk(page);
        for (const [label, text] of [['ふつうの台詞', null], ['長い台詞', '今日はどんな勇者モンが育つかなぁ〜٩(*´ᵕ`*)۶ワクワク まずはクイックで1周してみよっか！ あたしがついてるから大丈夫！']]) {
          if (text) await page.evaluate((t) => { const e = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (e) e.textContent = t; }, text);
          await page.waitForTimeout(2500); // 顔バッジの測定(700msごと)が落ち着くのを待つ
          const ng = await homeFacesProblems(page);
          check(`  (${label})ドック・顔バッジが重ならず、画面の外へ出ない`, ng.length === 0, ng.join(' / '));
        }
        await page.close();
      }
    }
    // 横画面(844x390)とタブレット(768x1024・1024x768)の観点(2026-11-17・横・タブレット対応フルセット+正方形の絵と広い画面の1段ドック)。
    // 横画面では背景が横長版になり、ドックは1段で施設カードが同じ大きさ・同じ形(正方形の絵)になる。
    // タブレット縦では場面が600pxに張り付かず広がり、背景は正方形の絵になり、ドックは1段になる。
    // タブレット横では背景が横長版になり、ドックは1段になる。背景はクラシックに決めて測る
    // 各節では大きさに加えて、絵の上端そろえと、文字の枠の中での文字の縦中央も見る
    {
      const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, 'boot/quiet-boot-seed'));
      const { STORY_IDS, seed, toHome, waitFaces, finishTalk, homeFacesProblems } = require(path.resolve(__dirname, 'assistant/life-browser-shared'));
      const openHome = async (size) => {
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
        await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
        await page.addInitScript(() => { try { localStorage.setItem('mh_home_art', JSON.stringify('classic')); } catch {} });
        await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
        await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await toHome(page); await waitFaces(page); await finishTalk(page);
        await page.waitForTimeout(2500); // 顔バッジの測定と背景の切り替えが落ち着くのを待つ
        return page;
      };
      {
        console.log('--- 本物 横 844x390(横長版の背景・ドック1段)');
        const page = await openHome({ width: 844, height: 390 });
        const bg = await page.evaluate(() => { const p = document.querySelector('.mh-home-background'); const img = p && p.querySelector('img.mh-home-main'); return { wide: !!(p && p.classList.contains('is-wide')), src: img ? (img.getAttribute('src') || '') : '' }; });
        check('  横画面では背景が横長版(クラシック)になる', bg.wide && bg.src.includes('home-background-wide.jpg'), `${bg.src} / is-wide ${bg.wide}`);
        const cards = await page.evaluate(() => [...document.querySelectorAll('[data-home-fac],[data-home-monhero-success]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); const pic = e.querySelector('.mh-home-dock-pic,.pic'); const nm = e.querySelector('.mh-home-dock-name,.nm'); const pr = pic ? pic.getBoundingClientRect() : null; const nr = nm ? nm.getBoundingClientRect() : null; const sb = e.querySelector('.mh-home-dock-sub,.sb'); const sr = sb ? sb.getBoundingClientRect() : null; const tx = e.querySelector('.mh-home-dock-txt,.txt'); const tr = tx ? tx.getBoundingClientRect() : null; return { k: e.getAttribute('data-home-fac') || 'success', w: r.width, h: r.height, top: r.top, picW: pr ? pr.width : 0, picH: pr ? pr.height : 0, picOff: pr ? pr.top - r.top : -1, nameGap: pr && nr ? nr.top - pr.bottom : -1, below: (sr || nr) ? r.bottom - (sr ? sr.bottom : nr.bottom) : -1, fh: tr ? tr.height : 0, ctr: (tr && nr) ? (nr.top + (sr ? sr.bottom : nr.bottom)) / 2 - (tr.top + tr.bottom) / 2 : 999 }; }));
        const ws = cards.map(c => c.w), hs = cards.map(c => c.h), tops = cards.map(c => c.top);
        check('  横画面のドックは1段で、施設カードが同じ大きさ', cards.length >= 7 && Math.max(...ws) - Math.min(...ws) <= 2 && Math.max(...hs) - Math.min(...hs) <= 2 && Math.max(...tops) - Math.min(...tops) <= 2,
          cards.map(c => `${c.k}:${Math.round(c.w)}x${Math.round(c.h)}`).join(' / '));
        check('  横画面でも絵の上端がそろっている(カードごとの差が2px以内)', cards.length >= 7 && cards.every(c => c.picOff >= 0) && Math.max(...cards.map(c => c.picOff)) - Math.min(...cards.map(c => c.picOff)) <= 2,
          cards.map(c => `${c.k}:上端${Math.round(c.picOff)}`).join(' / '));
        check('  横画面でも文字の枠の中で文字が縦中央にある(枠の中心と文字の中心の差が2px以内・枠の高さもそろっている)', cards.length >= 7 && cards.every(c => c.fh > 0 && Math.abs(c.ctr) <= 2) && Math.max(...cards.map(c => c.fh)) - Math.min(...cards.map(c => c.fh)) <= 2,
          cards.map(c => `${c.k}:枠${Math.round(c.fh)} 中心差${c.ctr.toFixed(1)}`).join(' / '));
        check('  横画面でもカードの絵は正方形', cards.length >= 7 && cards.every(c => c.picW > 0 && Math.abs(c.picW - c.picH) <= Math.max(2, c.picW * 0.06)),
          cards.map(c => `${c.k}:${Math.round(c.picW)}x${Math.round(c.picH)}`).join(' / '));
        const ng = await homeFacesProblems(page);
        check('  (横画面)ドック・細バナー・右端ボタン・吹き出しが重ならず、画面の外へ出ない', ng.length === 0, ng.join(' / '));
        await page.close();
      }
      {
        console.log('--- 本物 タブレット 768x1024(正方形の背景・ドック1段)');
        const page = await openHome({ width: 768, height: 1024 });
        const bg = await page.evaluate(() => { const p = document.querySelector('.mh-home-background'); const img = p && p.querySelector('img.mh-home-main'); return { square: !!(p && p.classList.contains('is-square')), src: img ? (img.getAttribute('src') || '') : '' }; });
        check('  タブレット縦では背景が正方形の絵(クラシック)になる', bg.square && bg.src.includes('home-background-square.jpg'), `${bg.src} / is-square ${bg.square}`);
        const m = await page.evaluate(() => { const s = document.querySelector('.mh-home-scene'); return { sceneW: s ? s.getBoundingClientRect().width : 0 }; });
        check('  タブレットでは場面が600pxに張り付かず広がる', m.sceneW >= 700, `場面の幅 ${Math.round(m.sceneW)}px`);
        const cards = await page.evaluate(() => [...document.querySelectorAll('[data-home-fac],[data-home-monhero-success]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); const pic = e.querySelector('.mh-home-dock-pic,.pic'); const nm = e.querySelector('.mh-home-dock-name,.nm'); const pr = pic ? pic.getBoundingClientRect() : null; const nr = nm ? nm.getBoundingClientRect() : null; const sb = e.querySelector('.mh-home-dock-sub,.sb'); const sr = sb ? sb.getBoundingClientRect() : null; const tx = e.querySelector('.mh-home-dock-txt,.txt'); const tr = tx ? tx.getBoundingClientRect() : null; return { k: e.getAttribute('data-home-fac') || 'success', w: r.width, h: r.height, top: r.top, picW: pr ? pr.width : 0, picH: pr ? pr.height : 0, picOff: pr ? pr.top - r.top : -1, nameGap: pr && nr ? nr.top - pr.bottom : -1, below: (sr || nr) ? r.bottom - (sr ? sr.bottom : nr.bottom) : -1, fh: tr ? tr.height : 0, ctr: (tr && nr) ? (nr.top + (sr ? sr.bottom : nr.bottom)) / 2 - (tr.top + tr.bottom) / 2 : 999 }; }));
        const ws = cards.map(c => c.w), hs = cards.map(c => c.h), tops = cards.map(c => c.top);
        check('  タブレット縦のドックは1段で、施設カードが同じ大きさ', cards.length >= 7 && Math.max(...ws) - Math.min(...ws) <= 2 && Math.max(...hs) - Math.min(...hs) <= 2 && Math.max(...tops) - Math.min(...tops) <= 2,
          cards.map(c => `${c.k}:${Math.round(c.w)}x${Math.round(c.h)}`).join(' / '));
        check('  タブレット縦でも絵の上端がそろっている(カードごとの差が2px以内)', cards.length >= 7 && cards.every(c => c.picOff >= 0) && Math.max(...cards.map(c => c.picOff)) - Math.min(...cards.map(c => c.picOff)) <= 2,
          cards.map(c => `${c.k}:上端${Math.round(c.picOff)}`).join(' / '));
        check('  タブレット縦でも文字の枠の中で文字が縦中央にある(枠の中心と文字の中心の差が2px以内・枠の高さもそろっている)', cards.length >= 7 && cards.every(c => c.fh > 0 && Math.abs(c.ctr) <= 2) && Math.max(...cards.map(c => c.fh)) - Math.min(...cards.map(c => c.fh)) <= 2,
          cards.map(c => `${c.k}:枠${Math.round(c.fh)} 中心差${c.ctr.toFixed(1)}`).join(' / '));
        check('  タブレット縦でもカードの絵は正方形', cards.length >= 7 && cards.every(c => c.picW > 0 && Math.abs(c.picW - c.picH) <= Math.max(2, c.picW * 0.06)),
          cards.map(c => `${c.k}:${Math.round(c.picW)}x${Math.round(c.picH)}`).join(' / '));
        const ng = await homeFacesProblems(page);
        check('  (タブレット)ドック・顔バッジが重ならず、画面の外へ出ない', ng.length === 0, ng.join(' / '));
        await page.close();
      }
      {
        console.log('--- 本物 タブレット横 1024x768(横長版の背景・ドック1段)');
        const page = await openHome({ width: 1024, height: 768 });
        const bg = await page.evaluate(() => { const p = document.querySelector('.mh-home-background'); const img = p && p.querySelector('img.mh-home-main'); return { wide: !!(p && p.classList.contains('is-wide')), src: img ? (img.getAttribute('src') || '') : '' }; });
        check('  タブレット横では背景が横長版(クラシック)になる', bg.wide && bg.src.includes('home-background-wide.jpg'), `${bg.src} / is-wide ${bg.wide}`);
        const cards = await page.evaluate(() => [...document.querySelectorAll('[data-home-fac],[data-home-monhero-success]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); const pic = e.querySelector('.mh-home-dock-pic,.pic'); const nm = e.querySelector('.mh-home-dock-name,.nm'); const pr = pic ? pic.getBoundingClientRect() : null; const nr = nm ? nm.getBoundingClientRect() : null; const sb = e.querySelector('.mh-home-dock-sub,.sb'); const sr = sb ? sb.getBoundingClientRect() : null; const tx = e.querySelector('.mh-home-dock-txt,.txt'); const tr = tx ? tx.getBoundingClientRect() : null; return { k: e.getAttribute('data-home-fac') || 'success', w: r.width, h: r.height, top: r.top, picOff: pr ? pr.top - r.top : -1, nameGap: pr && nr ? nr.top - pr.bottom : -1, below: (sr || nr) ? r.bottom - (sr ? sr.bottom : nr.bottom) : -1, fh: tr ? tr.height : 0, ctr: (tr && nr) ? (nr.top + (sr ? sr.bottom : nr.bottom)) / 2 - (tr.top + tr.bottom) / 2 : 999 }; }));
        const ws = cards.map(c => c.w), hs = cards.map(c => c.h), tops = cards.map(c => c.top);
        check('  タブレット横のドックは1段で、施設カードが同じ大きさ', cards.length >= 7 && Math.max(...ws) - Math.min(...ws) <= 2 && Math.max(...hs) - Math.min(...hs) <= 2 && Math.max(...tops) - Math.min(...tops) <= 2,
          cards.map(c => `${c.k}:${Math.round(c.w)}x${Math.round(c.h)}`).join(' / '));
        check('  タブレット横でも絵の上端がそろっている(カードごとの差が2px以内)', cards.length >= 7 && cards.every(c => c.picOff >= 0) && Math.max(...cards.map(c => c.picOff)) - Math.min(...cards.map(c => c.picOff)) <= 2,
          cards.map(c => `${c.k}:上端${Math.round(c.picOff)}`).join(' / '));
        check('  タブレット横でも文字の枠の中で文字が縦中央にある(枠の中心と文字の中心の差が2px以内・枠の高さもそろっている)', cards.length >= 7 && cards.every(c => c.fh > 0 && Math.abs(c.ctr) <= 2) && Math.max(...cards.map(c => c.fh)) - Math.min(...cards.map(c => c.fh)) <= 2,
          cards.map(c => `${c.k}:枠${Math.round(c.fh)} 中心差${c.ctr.toFixed(1)}`).join(' / '));
        const ng = await homeFacesProblems(page);
        check('  (タブレット横)ドック・右端ボタン・吹き出しが重ならず、画面の外へ出ない', ng.length === 0, ng.join(' / '));
        await page.close();
      }
    }
    // 模型(HOME の CSS だけを当てた見本)をやめ、上の大きさ全部で本物の画面を開いて測る(2026-11-11 窓口: 模型は本物とずれて 62件の NG を出し続けていた)。
    // 模型で見ていたこと → 本物での見方:
    //   ボタンの重なり・画面からのはみ出し・上下の切れ・みゅあの吹き出しとドック → homeFacesProblems(中身は homeDockProblems。本物の位置で測る)
    //   みゅあの吹き出しがプロフィールに重ならない → 本物の箱どうしで測る
    //   右上の枠が8桁でも1行のまま・高さが変わらない → 本物の財布の数を8桁に差し替えて測る(9桁からは縮めて出す。上の節で見る)
    //   期間ものの細バナーの重なり → 本物で、いま出ているもので測る。イベントのバナーは出し入れして両方を見る
    //   案内の説明を出す向き → 本体が光らせた場所の位置を測って決める(60-app.jsx の tutorialPanelAtTop)。その結線は assistant-check.js が見る
    {
      const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, 'boot/quiet-boot-seed'));
      const { STORY_IDS, seed, toHome, waitFaces, finishTalk, homeFacesProblems } = require(path.resolve(__dirname, 'assistant/life-browser-shared'));
      for (const size of SIZES) {
        console.log(`--- 本物 ${size.name}`);
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
        await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
        await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
        await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await toHome(page); await waitFaces(page); await finishTalk(page);
        await page.waitForTimeout(2500); // 顔バッジの測定(700msごと)が落ち着くのを待つ
        const ng = await homeFacesProblems(page);
        check(`  ドック・吹き出し・顔バッジが重ならず、画面の外へ出ない`, ng.length === 0, ng.join(' / '));
        const over = await page.evaluate(() => { const a = document.querySelector('.mh-home-assistant'), p = document.querySelector('.mh-home-player'); if (!a || !p) return 'みゅあの吹き出しかプロフィールが無い';
          const r = a.getBoundingClientRect(), q = p.getBoundingClientRect(); return (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) ? `重なり ${Math.round(Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top))}px` : ''; });
        check('  みゅあの吹き出しがプロフィールに重ならない', !over, over);
        // 施設カードの縦位置(2026-11-17 あっくん追加指示)。絵は全カードで上端をそろえ、文字は「名前1行+間+下の言葉1行」ぶんの
        // 固定の高さの枠(.mh-home-dock-txt。サクセス入口は .txt)の中で縦に中央寄せする。見るのは2つ:
        // (1) 絵の上端(カード自身の箱から測る)が8枚でそろっているか
        // (2) 枠の中心と文字の塊(名前〜下の言葉)の中心が合っているかと、枠の高さが8枚で同じか
        // カードの箱・枠からの相対で測るので、2段(縦画面)でも1段(横画面)でも同じ物差しで見られる
        const align = await page.evaluate(() => [...document.querySelectorAll('[data-home-fac],[data-home-monhero-success]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); const pic = e.querySelector('.mh-home-dock-pic,.pic'); const nm = e.querySelector('.mh-home-dock-name,.nm'); const sb = e.querySelector('.mh-home-dock-sub,.sb'); const tx = e.querySelector('.mh-home-dock-txt,.txt'); const pr = pic ? pic.getBoundingClientRect() : null; const nr = nm ? nm.getBoundingClientRect() : null; const sr = sb ? sb.getBoundingClientRect() : null; const tr = tx ? tx.getBoundingClientRect() : null; const last = sr || nr; return { k: e.getAttribute('data-home-fac') || 'success', picOff: pr ? pr.top - r.top : -1, fh: tr ? tr.height : 0, ctr: (tr && nr && last) ? (nr.top + last.bottom) / 2 - (tr.top + tr.bottom) / 2 : 999 }; }));
        check('  施設カードの絵の上端がそろっている(8枚の差が2px以内)', align.length >= 7 && align.every(c => c.picOff >= 0) && Math.max(...align.map(c => c.picOff)) - Math.min(...align.map(c => c.picOff)) <= 2,
          align.map(c => `${c.k}:上端${Math.round(c.picOff)}`).join(' / '));
        check('  文字の枠の中で文字が縦中央にある(枠の中心と文字の中心の差が2px以内・枠の高さもそろっている)', align.length >= 7 && align.every(c => c.fh > 0 && Math.abs(c.ctr) <= 2) && Math.max(...align.map(c => c.fh)) - Math.min(...align.map(c => c.fh)) <= 2,
          align.map(c => `${c.k}:枠${Math.round(c.fh)} 中心差${c.ctr.toFixed(1)}`).join(' / '));
        // 期間ものの細バナー: イベントのバナーがあれば、隠して(無いとき)もう一度測る
        const hasEvent = await page.locator('.mh-home-event-banner').count();
        if (hasEvent) {
          await page.evaluate(() => { document.querySelector('.mh-home-event-banner').style.display = 'none'; window.dispatchEvent(new Event('resize')); });
          await page.waitForTimeout(1500);
          const ng2 = await homeFacesProblems(page);
          check('  (イベントのバナーが無いとき)ドック・顔バッジが重ならず、画面の外へ出ない', ng2.length === 0, ng2.join(' / '));
          await page.evaluate(() => { document.querySelector('.mh-home-event-banner').style.display = ''; });
        }
        // 右上の枠: 8桁でも数とラベルが1行のまま・枠とプロフィールの高さが変わらない(2026-10-13 社長「8桁で『ダイヤ』が縦に折れた」)
        const wal = await page.evaluate(() => {
          const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; };
          const w = document.querySelector('.mh-home-wallet'), p = document.querySelector('.mh-home-player');
          if (!w || !p) return null;
          const h0 = [w.getBoundingClientRect().height, p.getBoundingClientRect().height];
          for (const b of w.querySelectorAll('b')) { b.textContent = '54,065,882'; b.style.setProperty('--len', '10'); }
          const wrapped = [...w.querySelectorAll('b,small')].filter(el => lines(el) > 1).map(el => el.textContent);
          return { wrapped, dw: w.getBoundingClientRect().height - h0[0], dp: p.getBoundingClientRect().height - h0[1] };
        });
        check('  右上の枠が8桁でも1行のまま・高さが変わらない', !!wal && !wal.wrapped.length && Math.abs(wal.dw) < 0.5 && Math.abs(wal.dp) < 0.5,
          wal ? `折り返し ${wal.wrapped.join(',') || 'なし'} / 枠の高さ +${Math.round(wal.dw)}px / プロフィール +${Math.round(wal.dp)}px` : '財布かプロフィールが無い');
        await page.close();
      }
    }
    server.close();
  }
  await browser.close();
  // 助手の吹き出しは下へ伸びるので、絶対配置の施設へかぶって押せなくなる事故が起きた
  // (2026-10-23 社長「MB管理に助手のコメントが被ってくる」。きゅうこの3行のセリフで起きた)。2行で切っていたが、幅320で「…」で切れた
  // (2026-10-24 窓口)。2026-11-17 のホーム一新で、吹き出しは流れで置き・施設は下のドックに集約したので、
  // 押し下げの仕組み(--mh-home-* の測定)は撤去済みのはず。文は切らずに全部出す
  check('HOMEの助手の吹き出しは切らずに全部出し、ドック式の置き方になっている(押し下げの仕組みは無い)',
    !/<AssistantBubble scene="home"[^>]*\bmaxLines=/.test(source)
    && source.includes('.mh-home-dock{position:absolute')
    && source.includes('data-home-fac="battle"')
    && source.includes('data-assistant-life-home-faces-ids')
    && !source.includes('--mh-home-assistant-bottom'));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
